""" JupyterLab LaTex : live LaTeX editing for JupyterLab """

import glob
import json
import os
import re
import subprocess
import sys

from contextlib import contextmanager

from tornado import gen, web
from tornado.httputil import url_concat
from tornado.httpclient import AsyncHTTPClient, HTTPRequest, HTTPError
from tornado.process import Subprocess, CalledProcessError

from traitlets import Unicode, CaselessStrEnum
from traitlets.config import Configurable

from notebook.utils import url_path_join
from notebook.base.handlers import APIHandler

from ._version import __version__

path_regex = r'(?P<path>(?:(?:/[^/]+)+|/?))'

@contextmanager
def latex_cleanup(workdir='.', whitelist=None, greylist=None):
    """Context manager for changing directory and removing files when done.

    By default it works in the current directory, and removes all files that
    were not present in the working directory.

    Parameters
    ----------

    workdir = string, optional
        This represents a path to the working directory for running LaTeX (the
        default is '.').
    whitelist = list or None, optional
        This is the set of files not present before running the LaTeX commands
        that are not to be removed when cleaning up. Defaults to None.
    greylist = list or None, optional
        This is the set of files that need to be removed before running LaTeX
        commands but which, if present, will not by removed when cleaning up.
        Defaults to None.
    """
    orig_work_dir = os.getcwd()
    os.chdir(os.path.abspath(workdir))

    keep_files = set()
    for fp in greylist:
        try:
            os.remove(fp)
            keep_files.add(fp)
        except FileNotFoundError:
            pass

    before = set(glob.glob("*"))
    keep_files = keep_files.union(before,
                                  set(whitelist if whitelist else [])
                                  )
    yield
    after = set(glob.glob("*"))
    for fn in set(after-keep_files):
        os.remove(fn)
    os.chdir(orig_work_dir)


class LatexConfig(Configurable):
    """
    A Configurable that declares the configuration options
    for the LatexHandler.
    """
    latex_command = Unicode('xelatex', config=True,
        help='The LaTeX command to use when compiling ".tex" files.')
    bib_command = Unicode('bibtex', config=True,
        help='The BibTeX command to use when compiling ".tex" files.')
    synctex_command = Unicode('synctex', config=True,
        help='The synctex command to use when syncronizing between .tex and .pdf files.')
    shell_escape = CaselessStrEnum(['restricted', 'allow', 'disallow'],
        default_value='restricted', config=True,
        help='Whether to allow shell escapes '+\
        '(and by extension, arbitrary code execution). '+\
        'Can be "restricted", for restricted shell escapes, '+\
        '"allow", to allow all shell escapes, or "disallow", '+\
        'to disallow all shell escapes')


class LatexBuildHandler(APIHandler):
    """
    A handler that runs LaTeX on the server.
    """

    def initialize(self, notebook_dir):
        self.notebook_dir = notebook_dir


    def build_tex_cmd_sequence(self, tex_base_name, run_bibtex=False):
        """Builds tuples that will be used to call LaTeX shell commands.

        Parameters
        ----------
        tex_base_name: string
            This is the name of the tex file to be compiled, without its
            extension.

        returns:
            A list of tuples of strings to be passed to
            `tornado.process.Subprocess`.

        """
        c = LatexConfig(config=self.config)

        escape_flag = ''
        if c.shell_escape == 'allow':
            escape_flag = '-shell-escape'
        elif c.shell_escape == 'disallow':
            escape_flag = '-no-shell-escape'
        elif c.shell_escape == 'restricted':
            escape_flag = '-shell-restricted'

        full_latex_sequence = (
            c.latex_command,
            escape_flag,
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-file-line-error",
            "-synctex=1",
            f"{tex_base_name}",
            )

        full_bibtex_sequence = (
            c.bib_command,
            f"{tex_base_name}",
            )

        command_sequence = [full_latex_sequence]

        if run_bibtex:
            command_sequence += [
                full_bibtex_sequence,
                full_latex_sequence,
                full_latex_sequence,
                ]

        return command_sequence

    def bib_condition(self):
        """Determines whether BiBTeX should be run.

        Returns
        -------
        boolean
            true if BibTeX should be run.

        """
        return any([re.match(r'.*\.bib', x) for x in set(glob.glob("*"))])


    @gen.coroutine
    def run_latex(self, command_sequence):
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
        - LaTeX processes only print to stdout, so errors are gathered from
          there.

        """

        for cmd in command_sequence:
            code, output = yield run_command(cmd)
            if code != 0:
                self.set_status(500)
                self.log.error((f'LaTeX command `{" ".join(cmd)}` '
                                 f'errored with code: {code}'))
                return output

        return "LaTeX compiled"


    @web.authenticated
    @gen.coroutine
    def get(self, path = ''):
        """
        Given a path, run LaTeX, cleanup, and respond when done.
        """

        # Get access to the notebook config object
        tex_file_path = os.path.join(self.notebook_dir, path.strip('/'))
        tex_base_name, ext = os.path.splitext(os.path.basename(tex_file_path))

        if not os.path.exists(tex_file_path):
            self.set_status(403)
            out = f"Request cannot be completed; no file at `{tex_file_path}`."
        elif ext != '.tex':
            self.set_status(400)
            out = (f"The file at `{tex_file_path}` does not end with .tex. "
                    "You can only run LaTeX on a file ending with .tex.")
        else:
            with latex_cleanup(
                workdir=os.path.dirname(tex_file_path),
                whitelist=[tex_base_name+'.pdf', tex_base_name+'synctex.gz'],
                greylist=[tex_base_name+'.aux']
                ):
                bibtex = self.bib_condition()
                cmd_sequence = self.build_tex_cmd_sequence(tex_base_name,
                                                           run_bibtex=bibtex)
                out = yield self.run_latex(cmd_sequence)
        self.finish(out)


class LatexSynctexHandler(APIHandler):
    """
    A handler that runs synctex on the server.
    """

    def initialize(self, notebook_dir):
        self.notebook_dir = notebook_dir


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
            A dictionary containing the mapped position data.

        """
        c = LatexConfig(config=self.config)
        data = f'-i {pos["page"]}:{pos["x"]}:{pos["y"]}:{pdf_name+".pdf"}'

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
            A dictionary containing the mapped position data.

        """
        c = LatexConfig(config=self.config)

        cmd = (
            c.synctex_command,
            'view',
            '-i',
            f'{pos["line"]}:{pos["column"]}:{tex_name+".tex"}',
            '-o',
            f'{tex_name+".pdf"}'
            )

        return cmd

    def parse_synctex_response(self, response):
        """
        Take the stdout response of SyncTex and parse it
        into a dictionary.

        Parameters
        ----------
        response: string
            The response output to stdout from SyncTex

        returns:
            A dictionary with the parsed response.

        """
        lines = response.split('\n')
        started = False
        result = {}
        for line in lines:
            if line == 'SyncTeX result begin':
                started = True
                continue
            elif line == 'SyncTeX result end':
                break
            if started:
                vals = line.split(':')
                result[vals[0].strip()] = vals[1].strip()
                self.log.info(str(vals))
        return result


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
        else:
            output = json.dumps(self.parse_synctex_response(output.decode('utf-8')))
        return output


    @web.authenticated
    @gen.coroutine
    def get(self, path = ''):
        """
        Given a path, run SyncTex, and respond when done.
        """
        # Get access to the notebook config object
        full_file_path = os.path.join(self.notebook_dir, path.strip('/'))
        workdir = os.path.dirname(full_file_path)
        base_name, ext = os.path.splitext(os.path.basename(full_file_path))

        if not os.path.exists(full_file_path):
            self.set_status(403)
            out = f"Request cannot be completed; no file at `{full_file_path}`."
        elif ext != '.tex' and ext != '.pdf':
            self.set_status(400)
            out = (f"The file `{ext}` does not end with .tex of .pdf. "
                    "You can only run SyncTex on a file ending with .tex or .pdf.")
        else:
            if ext == '.pdf':
                pos = {
                    'page': self.get_query_argument('page', default='1'),
                    'x': self.get_query_argument('x', default='0'),
                    'y': self.get_query_argument('y', default='0'),
                    }
                cmd = self.build_synctex_edit_cmd(base_name, pos)
            elif ext == '.tex':
                pos = {
                    'line': self.get_query_argument('line', default='1'),
                    'column': self.get_query_argument('column', default='1'),
                    }
                cmd = self.build_synctex_view_cmd(base_name, pos)

            out = yield self.run_synctex(cmd)
        self.finish(out)


@gen.coroutine
def run_command_sync(cmd):
    """
    Run a command using the synchronous `subprocess.run`.
    The asynchronous `run_command_async` should be preferred,
    but does not work on Windows, so use this as a fallback.

    Parameters
    ----------
    iterable
        An iterable of command-line arguments to run in the subprocess.

    Returns
    -------
    A tuple containing the (return code, stdout)
    """
    try:
        process = subprocess.run(cmd, stdout=subprocess.PIPE)
    except subprocess.CalledProcessError as err:
        pass
    code = process.returncode
    out = str(process.stdout)
    return (code, out)

@gen.coroutine
def run_command_async(cmd):
    """
    Run a command using the asynchronous `tornado.process.Subprocess`.

    Parameters
    ----------
    iterable
        An iterable of command-line arguments to run in the subprocess.

    Returns
    -------
    A tuple containing the (return code, stdout)
    """
    process = Subprocess(cmd,
                         stdout=Subprocess.STREAM,
                         stderr=Subprocess.STREAM)
    try:
        yield process.wait_for_exit()
    except CalledProcessError as err:
        pass
    code = process.returncode
    out = yield process.stdout.read_until_close()
    return (code, out)

# Windows does not support async subprocesses, so
# use a synchronous system calls.
if sys.platform == 'win32':
    run_command = run_command_sync
else:
    run_command = run_command_async



def _jupyter_server_extension_paths():
    return [{
        'module': 'jupyterlab_latex'
    }]

def load_jupyter_server_extension(nb_server_app):
    """
    Called when the extension is loaded.

    Args:
        nb_server_app (NotebookApp): handle to the Notebook webserver instance.
    """
    web_app = nb_server_app.web_app
    # Prepend the base_url so that it works in a jupyterhub setting
    base_url = web_app.settings['base_url']
    latex = url_path_join(base_url, 'latex')
    build = url_path_join(latex, 'build')
    synctex = url_path_join(latex, 'synctex')

    handlers = [(f'{build}{path_regex}',
                 LatexBuildHandler,
                 {"notebook_dir": nb_server_app.notebook_dir}
                ),
                (f'{synctex}{path_regex}',
                 LatexSynctexHandler,
                 {"notebook_dir": nb_server_app.notebook_dir}
                 )]
    web_app.add_handlers('.*$', handlers)
