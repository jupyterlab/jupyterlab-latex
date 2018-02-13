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
    shell_escape = CaselessStrEnum(['restricted', 'allow', 'disallow'],
        default_value='restricted', config=True,
        help='Whether to allow shell escapes '+\
        '(and by extension, arbitrary code execution). '+\
        'Can be "restricted", for restricted shell escapes, '+\
        '"allow", to allow all shell escapes, or "disallow", '+\
        'to disallow all shell escapes')


class LatexHandler(APIHandler):
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
        # Windows does not support async subprocesses, so
        # use a synchronous system calls.
        if sys.platform == 'win32':
            run_command = run_command_sync
        else:
            run_command = run_command_async

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
                whitelist=[tex_base_name+'.pdf'],
                greylist=[tex_base_name+'.aux']
                ):
                bibtex = self.bib_condition()
                cmd_sequence = self.build_tex_cmd_sequence(tex_base_name,
                                                           run_bibtex=bibtex)
                out = yield self.run_latex(cmd_sequence)
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
    endpoint = url_path_join(base_url, 'latex')
    handlers = [(f'{endpoint}{path_regex}', 
                 LatexHandler, 
                 {"notebook_dir": nb_server_app.notebook_dir}
                )]
    web_app.add_handlers('.*$', handlers)
