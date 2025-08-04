""" JupyterLab LaTex : live LaTeX editing for JupyterLab """

from traitlets import Unicode, CaselessStrEnum, Integer, Bool, List as TraitletsList
from traitlets.config import Configurable

class LatexConfig(Configurable):
    """
    A Configurable that declares the configuration options
    for the LatexHandler.
    """
    latex_command = Unicode('xelatex', config=True,
        help='The LaTeX command to use when compiling ".tex" files.')
    disable_bibtex = Bool(default_value=False, config=True,
        help='Whether to disable the BibTeX command sequence.')
    bib_command = Unicode('bibtex', config=True,
        help='The BibTeX command to use when compiling ".tex" files.' +\
             'Only used if disable_bibtex is not set to True')
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
    cleanup = Bool(default_value=False, config=True,
        help='Whether to clean up files that were not in the working directory or not.')
    # Add a new configuration option to hold user-defined commands
    manual_cmd_args = TraitletsList(Unicode(), default_value=[], config=True,
        help='A list of user-defined command-line arguments with placeholders for ' +
             'filename ({filename})')
