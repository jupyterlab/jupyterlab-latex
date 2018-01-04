import re
import json
import os
import subprocess
import glob
import re
import functools

from contextlib import contextmanager
from subprocess import PIPE

import tornado.gen as gen
from tornado.httputil import url_concat
from tornado.httpclient import AsyncHTTPClient, HTTPRequest, HTTPError
from tornado.process import Subprocess, CalledProcessError

from traitlets import Unicode
from traitlets.config import Configurable

from notebook.utils import url_path_join
from notebook.base.handlers import APIHandler

path_regex = r'(?P<path>(?:(?:/[^/]+)+|/?))'

@contextmanager
def latex_cleanup(workdir='.', whitelist=None):
    orig_work_dir = os.getcwd()
    os.chdir(os.path.abspath(workdir))

    if whitelist is None:
        before = set(glob.glob("*"))
    else:
        before = set(glob.glob("*")).union(set(whitelist))
    yield
    after = set(glob.glob("*"))
    for fn in set(after-before):
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
        help='The bibTeX command to use when compiling ".tex" files.')


class LatexHandler(APIHandler):
    """
    A handler that runs LaTeX on the server.
    """
    
    
    def build_tex_cmd_sequence(self, tex_base_name, run_bibtex=False):
        c = LatexConfig(config=self.config)
        
        full_latex_sequence = (
            c.latex_command,
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-file-line-error",
            f"{tex_base_name}",
            )
        full_bibtex_sequence = (
            c.bib_command,
            f"{tex_base_name}",
            )
            
        command_sequence = [tuple(full_latex_sequence)]
        
        if run_bibtex:
            command_sequence += [
                tuple(full_bibtex_sequence), 
                tuple(full_latex_sequence), 
                tuple(full_latex_sequence),
                ]
                
        return [functools.partial(Subprocess, 
                                  cmd, 
                                  stdout=Subprocess.STREAM, 
                                  stderr=Subprocess.STREAM) 
                for cmd in command_sequence]
                    
    def bib_condition(self):
        return any([re.match(r'.*\.bib', x) for x in set(glob.glob("*"))])

    
    @gen.coroutine
    def run_latex(self, command_sequence):

        for cmd in command_sequence:
            process = cmd()
            try:
                yield process.wait_for_exit()
            except CalledProcessError as err:
                self.set_status(500)
                self.log.error((f'LaTeX command ' 
                                 '`{" ".join(command_sequence[i])}` '
                                 'errored with code: ')
                               + str(err.returncode))
                out = yield process.stdout.read_until_close()
                return out
                
        return "LaTeX compiled"

    
    @gen.coroutine
    def get(self, path = ''):
        """
        Given a path, run LaTeX, responding when done.
        """
        # Get access to the notebook config object
        tex_file_path = os.path.abspath(path.strip('/'))
        tex_base_name = os.path.splitext(os.path.basename(tex_file_path))[0]
        
        with latex_cleanup(
            workdir=os.path.dirname(tex_file_path),
            whitelist=[tex_base_name+'.pdf'] 
            ):
            bibtex = self.bib_condition()
            cmd_sequence = self.build_tex_cmd_sequence(tex_base_name, 
                                                       run_bibtex=bibtex)
            out = yield self.run_latex(cmd_sequence)
        self.finish(out)

def _jupyter_server_extension_paths():
    return [{
        'module': 'jupyterlab_latex'
    }]

def load_jupyter_server_extension(nb_server_app):
    """
    Called when the extension is loaded.

    Args:
        nb_server_app (NotebookWebApplication): handle to the Notebook webserver instance.
    """
    web_app = nb_server_app.web_app
    host_pattern = '.*$'
    web_app.add_handlers(host_pattern, [(r'/latex%s' % path_regex, LatexHandler)])
