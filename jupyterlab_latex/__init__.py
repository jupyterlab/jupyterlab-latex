""" JupyterLab LaTex : live LaTeX editing for JupyterLab """
from ._version import __version__

__all__ = [
    "__version__",
    "_jupyter_labextension_paths",
    "_jupyter_server_extension_paths",
    "_load_jupyter_server_extension",
    "load_jupyter_server_extension",
]

path_regex = r'(?P<path>(?:(?:/[^/]+)+|/?))'



def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": "@jupyterlab/latex"
    }]

def _jupyter_server_extension_points():
    return [{
        'module': 'jupyterlab_latex'
    }]

_jupyter_server_extension_paths = _jupyter_server_extension_points

def load_jupyter_server_extension(nb_server_app):
    """
    Called when the extension is loaded.

    Args:
        nb_server_app (NotebookApp): handle to the Notebook webserver instance.
    """
    from jupyter_server.utils import url_path_join

    from .build import LatexBuildHandler
    from .synctex import LatexSynctexHandler

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

_load_jupyter_server_extension = load_jupyter_server_extension
