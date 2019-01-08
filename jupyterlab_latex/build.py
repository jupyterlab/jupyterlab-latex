""" JupyterLab LaTex : live LaTeX editing for JupyterLab """

import glob, json, re, os
from contextlib import contextmanager

from tornado import gen, web

from notebook.base.handlers import APIHandler

from .config import LatexConfig
from .util import run_command

@contextmanager
def latex_cleanup(cleanup=True, workdir='.', whitelist=None, greylist=None):
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
    if cleanup:
        after = set(glob.glob("*"))
        for fn in set(after-keep_files):
            os.remove(fn)
    os.chdir(orig_work_dir)



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

        # Get the synctex query parameter, defaulting to
        # 1 if it is not set or is invalid.
        synctex = self.get_query_argument('synctex', default='1')
        synctex = '1' if synctex != '0' else synctex

        full_latex_sequence = (
            c.latex_command,
            escape_flag,
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-file-line-error",
            f"-synctex={synctex}",
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
        else:
            command_sequence = command_sequence * c.run_times

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
        # Parse the path into the base name and extension of the file
        tex_file_path = os.path.join(self.notebook_dir, path.strip('/'))
        tex_base_name, ext = os.path.splitext(os.path.basename(tex_file_path))
        c = LatexConfig(config=self.config)

        if not os.path.exists(tex_file_path):
            self.set_status(403)
            out = f"Request cannot be completed; no file at `{tex_file_path}`."
        elif ext != '.tex':
            self.set_status(400)
            out = (f"The file at `{tex_file_path}` does not end with .tex. "
                    "You can only run LaTeX on a file ending with .tex.")
        else:
            with latex_cleanup(
                cleanup=c.cleanup,
                workdir=os.path.dirname(tex_file_path),
                whitelist=[tex_base_name+'.pdf', tex_base_name+'.synctex.gz'],
                greylist=[tex_base_name+'.aux']
                ):
                bibtex = self.bib_condition()
                cmd_sequence = self.build_tex_cmd_sequence(tex_base_name,
                                                           run_bibtex=bibtex)
                out = yield self.run_latex(cmd_sequence)
        self.finish(out)

