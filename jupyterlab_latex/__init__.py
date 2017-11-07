import re
import json
import os
import subprocess
import glob

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


# get file directory
# run function
# print out new files

@contextmanager
def latex_cleanup(whitelist=None):
    if whitelist is None:
        before = set(glob.glob("*"))
    else:
        before = set(glob.glob("*")).union(set(whitelist))
    yield
    after = set(glob.glob("*"))
    for fn in set(after-before):
        os.remove(fn)


class LatexConfig(Configurable):
    """
    A Configurable that declares the configuration options
    for the LatexHandler.
    """
    latex_command = Unicode('xelatex', config=True,
        help='The LaTeX command to use when compiling ".tex" files.')


class LatexHandler(APIHandler):
    """
    A handler that runs LaTeX on the server.
    """
    @gen.coroutine
    def get(self, path = ''):
        """
        Given a path, run LaTeX, responding when done.
        """
        # Get access to the notebook config object
        c = LatexConfig(config=self.config)

        output_filename = os.path.splitext(path.strip('/'))[0]+".pdf"
        log_filename = os.path.splitext(path.strip('/'))[0]+".log"
        with latex_cleanup(whitelist=[output_filename, log_filename]):
            process = Subprocess([
                    c.latex_command,
                    "-interaction=nonstopmode",
                    "-halt-on-error",
                    "-file-line-error",
                    f"{path.strip('/')}",
                ], stdout=PIPE, stderr=PIPE)
            try:
                yield process.wait_for_exit()
            except CalledProcessError as err:
                self.set_status(500)
                self.log.error('LaTeX command errored with code: '
                               + str(err.returncode))

        self.finish("LaTeX compiled")

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
