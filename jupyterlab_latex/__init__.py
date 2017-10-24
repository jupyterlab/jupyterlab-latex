import re, json
import subprocess

from subprocess import PIPE

import tornado.gen as gen
from tornado.httputil import url_concat
from tornado.httpclient import AsyncHTTPClient, HTTPRequest, HTTPError

from traitlets import Unicode
from traitlets.config import Configurable

from notebook.utils import url_path_join
from notebook.base.handlers import APIHandler

path_regex = r'(?P<path>(?:(?:/[^/]+)+|/?))'


class LatexHandler(APIHandler):
    """
    A proxy for the GitHub API v3.

    The purpose of this proxy is to add the 'client_id' and 'client_secret'
    tokens to the API request, which allows for a higher rate limit.
    Without this, the rate limit on unauthenticated calls is so limited as
    to be practically useless.
    """
    @gen.coroutine
    def get(self, path = ''):
        """
        Proxy API requests to GitHub, adding 'client_id' and 'client_secret'
        if they have been set.
        """

        result = subprocess.run([
                "xelatex",
                "-interaction=nonstopmode",
                "-halt-on-error",
                "-file-line-error",
                f"{path.strip('/')}",
            ], stdout=PIPE, stderr=PIPE)
        if result.returncode:
            self.log.error(str(result.stdout, 'utf-8'))
        # self.set_status(200)
        self.finish("done")

        # Get access to the notebook config object

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
