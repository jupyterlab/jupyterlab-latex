""" JupyterLab LaTex : live LaTeX editing for JupyterLab """

import json
from pathlib import Path
from notebook.utils import url_path_join

from ._version import __version__
from .build import LatexBuildHandler
from .synctex import LatexSynctexHandler

path_regex = r'(?P<path>(?:(?:/[^/]+)+|/?))'

HERE = Path(__file__).parent.resolve()

with (HERE / "labextension" / "package.json").open() as fid:
    data = json.load(fid)

def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": data["name"]
    }]

def _jupyter_server_extension_points():
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
