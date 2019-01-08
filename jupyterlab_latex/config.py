""" JupyterLab LaTex : live LaTeX editing for JupyterLab """

from traitlets import Unicode, CaselessStrEnum, Integer, Bool
from traitlets.config import Configurable

class LatexConfig(Configurable):
    """
    A Configurable that declares the configuration options
    for the LatexHandler.
    """
    latex_command = Unicode('xelatex', config=True,
        help='The LaTeX command to use when compiling ".tex" files.')
    bib_command = Unicode('bibtex', config=True,
        help='The BibTeX command to use when compiling ".tex" files.')
    synctex_command = Unicode('synctex', config=True,
        help='The synctex command to use when syncronizing between .tex and .pdf files.')
    shell_escape = CaselessStrEnum(['restricted', 'allow', 'disallow'],
        default_value='restricted', config=True,
        help='Whether to allow shell escapes '+\
        '(and by extension, arbitrary code execution). '+\
        'Can be "restricted", for restricted shell escapes, '+\
        '"allow", to allow all shell escapes, or "disallow", '+\
        'to disallow all shell escapes')
    run_times = Integer(default_value=1, config=True,
        help='How many times to compile the ".tex" files.')
    cleanup = Bool(default_value=True, config=True,
        help='Whether to clean up ".out/.aux" files or not.')
