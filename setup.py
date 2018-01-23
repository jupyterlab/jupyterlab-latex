"""
Setup module for the jupyterlab-latex
"""
import setuptools
from setupbase import (
    create_cmdclass, ensure_python, find_packages, get_version
    )

data_files_spec = [(
    'etc/jupyter/jupyter_notebook_config.d',
    'jupyter-config/jupyter_notebook_config.d',
    'jupyterlab_latex.json'
),]

cmdclass = create_cmdclass(data_files_spec=data_files_spec)

setup_dict = dict(
    name='jupyterlab_latex',
    version=get_version("jupyterlab_latex/_version.py"),
    description='A Jupyter Notebook server extension which acts as an endpoint for LaTeX.',
    packages=find_packages(),
    cmdclass=cmdclass,
    author          = 'Jupyter Development Team',
    author_email    = 'jupyter@googlegroups.com',
    url             = 'http://jupyter.org',
    license         = 'BSD',
    platforms       = "Linux, Mac OS X, Windows",
    keywords        = ['Jupyter', 'JupyterLab', 'LaTeX'],
    python_requires = '>=3.6',
    classifiers     = [
        'Intended Audience :: Developers',
        'Intended Audience :: System Administrators',
        'Intended Audience :: Science/Research',
        'License :: OSI Approved :: BSD License',
        'Programming Language :: Python',
        'Programming Language :: Python :: 3',
    ],
    install_requires=[
        'notebook'
    ],
    package_data={'jupyterlab_latex':['api/*']},
)

try:
    ensure_python(setup_dict["python_requires"].split(','))
except ValueError as e:
    raise  ValueError("{:s}, to use {} you must use python {} ".format(
                          e,
                          setup_dict["name"],
                          setup_dict["python_requires"])
                     )

setuptools.setup(**setup_dict)
