"""
Setup module for the jupyterlab-latex
"""
import json
from pathlib import Path

import setuptools
try:
    from jupyter_packaging import (
        wrap_installers,
        npm_builder,
        get_data_files
    )
    try:
        import jupyterlab
    except ImportError as e:
        print("`jupyterlab` is missing. Install it with pip or conda.")
        raise e
except ImportError as e:
    print("`jupyter-packaging` is missing. Install it with pip or conda.")
    raise e

HERE = Path(__file__).parent.resolve()

# The name of the project
name = "jupyterlab_latex"

lab_path = (HERE / name.replace("-", "_") / "labextension")

# Representative files that should exist after a successful build
ensured_targets = [
    str(lab_path / "package.json"),
    str(lab_path / "static/style.js")
]

labext_name = "@jupyterlab/latex"

data_files_spec = [
    ("share/jupyter/labextensions/%s" % labext_name, str(lab_path.relative_to(HERE)), "**"),
    ("share/jupyter/labextensions/%s" % labext_name, str('.'), "install.json"),("etc/jupyter/jupyter_server_config.d",
     "jupyter-config/server-config", "jupyterlab_latex.json"),
    # For backward compatibility with notebook server
    ("etc/jupyter/jupyter_notebook_config.d",
     "jupyter-config/nb-config", "jupyterlab_latex.json"),
    
]

long_description = (HERE / "README.md").read_text()

# Get the package info from package.json
pkg_json = json.loads((HERE / "package.json").read_bytes())

post_develop = npm_builder(
    build_cmd="install:extension", source_dir="src", build_dir=lab_path
)

setup_dict = dict(
    name=name,
    version=pkg_json["version"],
    description=pkg_json["description"],
    packages=setuptools.find_packages(),
    data_files=get_data_files(data_files_spec),
    author=pkg_json["author"]["name"],
    author_email=pkg_json["author"]["email"],
    url=pkg_json["homepage"],
    license=pkg_json["license"],
    long_description=long_description,
    long_description_content_type="text/markdown",
    zip_safe=False,
    include_package_data=True,
    keywords= ['Jupyter', 'JupyterLab', 'LaTeX'],
    python_requires = '>=3.6',
    classifiers     = [
        'Intended Audience :: Developers',
        'Intended Audience :: System Administrators',
        'Intended Audience :: Science/Research',
        'License :: OSI Approved :: BSD License',
        'Programming Language :: Python',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.6',
        'Programming Language :: Python :: 3.7',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Framework :: Jupyter',
    ],
    install_requires=[
        'jupyterlab>=3,<4',
        'jupyter_server>=1.6,<2'
    ],
    cmdclass=wrap_installers(post_develop=post_develop, ensured_targets=ensured_targets)
)

if __name__ == "__main__":
    setuptools.setup(**setup_dict)
