"""
Setup module for the jupyterlab-latex
"""
import setuptools
from jupyterlab_latex import __version__

setuptools.setup(
    name='jupyterlab_latex',
    description='A Jupyter Notebook server extension which acts as an endpoint for LaTeX.',
    version=__version__,
    packages=setuptools.find_packages(),
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
    package_data={'jupyterlab_latex':['*']},
)
