""" JupyterLab LaTex : live LaTeX editing for JupyterLab """

import json, re, os

from tornado import gen, web

from pathlib import Path

from notebook.base.handlers import APIHandler

from .config import LatexConfig
from .util import run_command

class LatexSynctexHandler(APIHandler):
    """
    A handler that runs synctex on the server.
    """

    def initialize(self, notebook_dir):
        self.notebook_dir = notebook_dir


    def build_synctex_cmd(self, base_name, ext):
        """
        Builds the command which will be used to call SyncTeX.
        If given a `.tex` it will build a forward synchronization command.
        If given a `.pdf` it will build a reverse synchronization command.

        Parameters
        ----------

        base_name: string
            The name of the file, without the extension.

        ext: string
            The extension of the file, either ".pdf" or ".tex"

        returns:
            A tuple of (cmd, pos), where cmd is a tuple of string commands
            to be given to the SyncTeX subprocess, and pos is a dictionary
            containing the position data.

        """
        if ext == '.pdf':
            # Construct the position dictionary, where x and y are in dots,
            # measured from the top-left of a page (assumed to be 72 dpi)
            pos = {
                'page': self.get_query_argument('page', default='1'),
                'x': self.get_query_argument('x', default='0'),
                'y': self.get_query_argument('y', default='0'),
                }
            cmd = self.build_synctex_edit_cmd(base_name, pos)
        elif ext == '.tex':
            # Construct the position dictionary, where 'line' and 'column'
            # are a position in the `.tex` document.
            pos = {
                'line': self.get_query_argument('line', default='1'),
                'column': self.get_query_argument('column', default='1'),
                }
            cmd = self.build_synctex_view_cmd(base_name, pos)

        return (cmd, pos)

    def build_synctex_edit_cmd(self, pdf_name, pos):
        """Builds tuple that will be used to call the synctex edit shell command.

        Parameters
        ----------
        pdf_name: string
            This is the name of pdf tex file, without the extension

        pos: dict
            A dictionary containing the position in the pdf file
            document to map.

        returns:
            A tuple of of string commands to be given to the SyncTeX subprocess

        """
        c = LatexConfig(config=self.config)

        cmd = (
            c.synctex_command,
            'edit',
            '-o',
            f'{pos["page"]}:{pos["x"]}:{pos["y"]}:{pdf_name+".pdf"}'
            )

        return cmd

    def build_synctex_view_cmd(self, tex_name, pos):
        """Builds tuple that will be used to call the synctex view shell command.

        Parameters
        ----------
        tex_name: string
            This is the base name of the tex file, without the extension

        pos: dict
            A dictionary containing the position in the tex file
            document to map.

        returns:
            A tuple of of string commands to be given to the SyncTeX subprocess

        """
        c = LatexConfig(config=self.config)
        pdf_path = os.path.join(self.notebook_dir, tex_name+".pdf")
        tex_path = os.path.join(self.notebook_dir, tex_name+".tex")

        cmd = (
            c.synctex_command,
            'view',
            '-i',
            f'{pos["line"]}:{pos["column"]}:{tex_path}',
            '-o',
            f'{pdf_path}'
            )

        return cmd


    @gen.coroutine
    def run_synctex(self, cmd):
        """Run commands sequentially, returning a 500 code on an error.

        Parameters
        ----------
        command_sequence : list of tuples of strings
            This is a sequence of tuples of strings to be passed to
            `tornado.process.Subprocess`, which are to be run sequentially.
            On Windows, `tornado.process.Subprocess` is unavailable, so
            we use the synchronous `subprocess.run`.

        Returns
        -------
        string
            Response is either a success or an error string.

        Notes
        -----
        - SyncTex processes only print to stdout, so errors are gathered from
          there.

        """
        code, output = yield run_command(cmd)
        if code != 0:
            self.set_status(500)
            self.log.error((f'SyncTex command `{" ".join(cmd)}` '
                              f'errored with code: {code}'))
        return output


    @web.authenticated
    @gen.coroutine
    def get(self, path = ''):
        """
        Given a path, run SyncTex, and respond when done.

        Parameters
        ----------
        path : string
            A path to a `.tex` or `.pdf` file. Position arguments
            should be given in query strings. For forward synchronization with
            a `.tex` document, the user should give `line` and `column` arguments
            in the query string. For reverse synchronization, with a `.pdf`
            document, the user should give `page`, `x`, and `y` in the query string,
            where `x` and `y` are a position on the page from the top left corner
            in dots (where the page is assumed to be 72 dpi).

        returns:
            A JSON object containing the mapped position.
        """
        # Parse the path into the base name and extension of the file
        relative_file_path = str(Path(path.strip('/')))
        relative_base_path = os.path.splitext(relative_file_path)[0]
        full_file_path = os.path.join(self.notebook_dir, relative_file_path)
        workdir = os.path.dirname(full_file_path)
        base_name, ext = os.path.splitext(os.path.basename(full_file_path))

        if not os.path.exists(full_file_path):
            self.set_status(403)
            out = f"Request cannot be completed; no file at `{full_file_path}`."
        elif not os.path.exists(os.path.join(workdir, base_name + '.synctex.gz')):
            self.set_status(403)
            out = f"Request cannot be completed; no SyncTeX file found in `{workdir}`."
        elif ext != '.tex' and ext != '.pdf':
            self.set_status(400)
            out = (f"The file `{ext}` does not end with .tex of .pdf. "
                    "You can only run SyncTex on a file ending with .tex or .pdf.")
        else:
            cmd, pos = self.build_synctex_cmd(relative_base_path, ext)

            out = yield self.run_synctex(cmd)
            out = json.dumps(parse_synctex_response(out, pos))
        self.finish(out)

def parse_synctex_response(response, pos):
    """
    Take the stdout response of SyncTex and parse it
    into a dictionary.

    Parameters
    ----------
    response: string
        The response output to stdout from SyncTeX

    pos: dict
        The position that was input to SyncTeX

    returns:
        A dictionary with the parsed response.

    """
    fields = ["line", "column", "page", "x", "y"]
    match = re.search(r'SyncTeX result begin\r?\n(.*?)\nSyncTeX result end',
            response, flags=re.DOTALL)
    if match is None:
        raise Exception(f'Unable to parse SyncTeX response: {response}')
    lines = match.group(1).lower().replace(' ', '').split('\n')
    result = {}
    for l in lines:
        components = l.split(":")
        key, value = components[0], ":".join(components[1:])
        if key in fields:
            result[key] = value
            fields.remove(key)
    for f in fields:
        result[f] = pos[f]
    return result
