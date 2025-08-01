""" JupyterLab LaTex : live LaTeX editing for JupyterLab """

import glob, json, re, os
from contextlib import contextmanager
import shutil

from tornado import gen, web

from jupyter_server.base.handlers import APIHandler

from .config import LatexConfig
from .util import run_command

@contextmanager
def latex_cleanup(cleanup=False, workdir='.', whitelist=None, greylist=None):
    """Context manager for changing directory and removing files when done.

    By default it works in the current directory, and removes all files that
    were not present in the working directory.

    Parameters
    ----------

    cleanup = bool, default=False
        Whether to clean up files that were not in the working directory
        or not.
    workdir = string, optional
        This represents a path to the working directory for running LaTeX (the
        default is '.').
    whitelist = list or None, optional
        This is the set of files not present before running the LaTeX commands
        that are not to be removed when cleaning up. Defaults to None.
    greylist = list or None, optional
        This is the set of files that need to be removed before running LaTeX
        commands but which, if present, will not by removed when cleaning up.
        Defaults to None.
    """
    orig_work_dir = os.getcwd()
    os.chdir(os.path.abspath(workdir))

    keep_files = set()
    for fp in greylist:
        try:
            os.remove(fp)
            keep_files.add(fp)
        except FileNotFoundError:
            pass

    before = set(glob.glob("*"))
    keep_files = keep_files.union(before,
                                  set(whitelist if whitelist else [])
                                  )
    yield
    if cleanup:
        after = set(glob.glob("*"))
        for fn in set(after-keep_files):
            if not os.path.isdir(fn):
                os.remove(fn)
            else:
                shutil.rmtree(fn)
    os.chdir(orig_work_dir)



class LatexBuildHandler(APIHandler):
    """
    A handler that runs LaTeX on the server.
    """

    def initialize(self, root_dir):
        self.root_dir = root_dir


    def build_tex_cmd_sequence(self, tex_base_name):
        """Builds tuples that will be used to call LaTeX shell commands.

        Parameters
        ----------
        tex_base_name: string
            This is the name of the tex file to be compiled, without its
            extension.

        returns:
            A list of tuples of strings to be passed to
            `tornado.process.Subprocess`.

        """
        c = LatexConfig(config=self.config)
        
        engine_name = c.latex_command

        escape_flag = ''
        if c.shell_escape == 'allow':
            escape_flag = '-shell-escape'
        elif c.shell_escape == 'disallow':
            escape_flag = '-no-shell-escape'
        elif c.shell_escape == 'restricted':
            escape_flag = '-shell-restricted'

        # Get the synctex query parameter, defaulting to
        # 1 if it is not set or is invalid.
        synctex = self.get_query_argument('synctex', default=True)
        
        if c.manual_cmd_args:
            # Replace placeholders with actual values
            self.log.info("Using the manual command argument and buidling latex sequence.")
            full_latex_sequence = [
                # replace placeholders using format()
                arg.format(filename=tex_base_name)
                for arg in c.manual_cmd_args  
            ] 
        elif engine_name == 'tectonic':
            self.log.info("Using Tectonic for LaTeX compilation.")
            full_latex_sequence = (
                engine_name,
                f"{tex_base_name}.tex",  # input .tex file
                "--outfmt=pdf",  # specify output format (pdf in this case)
                f"--synctex={'1' if synctex else '0'}" # to support SyncTeX (synchronization with the editor)
            )
        else:
            self.log.info("Using TeX Live (or compatible distribution) for LaTeX compilation.")
            full_latex_sequence = (
                engine_name,
                escape_flag,
                "-interaction=nonstopmode",
                "-halt-on-error",
                "-file-line-error",
                f"-synctex={'1' if synctex else '0'}",
                f"{tex_base_name}",
            )
        
        command_sequence = [full_latex_sequence]

        # Skip bibtex compilation if the following conditions are present
        #   - c.LatexConfig.disable_bibtex is explicitly set to True
        #   - tectonic engine is used
        #   - there are no .bib files found in the folder
        if c.disable_bibtex or engine_name == 'tectonic' or not self.bib_condition():
            # Repeat LaTeX command run_times times
            command_sequence = command_sequence * c.run_times
        else:
            full_bibtex_sequence = (
                c.bib_command,
                f"{tex_base_name}",
            )
        
            command_sequence += [
                full_bibtex_sequence,
                full_latex_sequence,
                full_latex_sequence,
            ]
        
        return command_sequence

    def bib_condition(self):
        """Determines whether BiBTeX should be run.

        Returns
        -------
        boolean
            true if BibTeX should be run.

        """
        return any([re.match(r'.*\.bib', x) for x in set(glob.glob("*"))])

    def filter_output(self, latex_output):
        """Filters latex output for "interesting" messages

        Parameters
        ----------
        latex_output: string
            This is the output of the executed latex command from,
            run_command in run_latex.

        returns:
            A string representing the filtered output.
            
        Notes
        -----
        - Based on the public domain perl script texfot v 1.43 written by
          Karl Berry in 2014. It has no home page beyond the package on
          CTAN: <https://ctan.org/pkg/texfot>.
          
        """
        ignore = re.compile(r'''^(
            LaTeX\ Warning:\ You\ have\ requested\ package
            |LaTeX\ Font\ Warning:\ Some\ font\ shapes
            |LaTeX\ Font\ Warning:\ Size\ substitutions
            |Package\ auxhook\ Warning:\ Cannot\ patch
            |Package\ caption\ Warning:\ Un(supported|known)\ document\ class
            |Package\ fixltx2e\ Warning:\ fixltx2e\ is\ not\ required
            |Package\ frenchb?\.ldf\ Warning:\ (Figures|The\ definition)
            |Package\ layouts\ Warning:\ Layout\ scale
            |\*\*\*\ Reloading\ Xunicode\ for\ encoding      # spurious ***
            |pdfTeX\ warning:.*inclusion:\ fou               #nd PDF version ...
            |pdfTeX\ warning:.*inclusion:\ mul               #tiple pdfs with page group
            |libpng\ warning:\ iCCP:\ Not\ recognizing
            |!\ $
            |This\ is
            |No\ pages\ of\ output.                          # possibly not worth ignoring?
            )''', re.VERBOSE)

        next_line = re.compile(r'''^(
            .*?:[0-9]+:                        # usual file:lineno: form
            |!                                 # usual ! form
            |>\ [^<]                           # from \show..., but not "> <img.whatever"
            |.*pdfTeX\ warning                 # pdftex complaints often cross lines
            |LaTeX\ Font\ Warning:\ Font\ shape
            |Package\ hyperref\ Warning:\ Token\ not\ allowed
            |removed\ on\ input\ line          # hyperref
            |Runaway\ argument
            )''', re.VERBOSE)

        show = re.compile(r'''^(
            Output\ written
            |No\ pages\ of\ output
            |\(.*end\ occurred\ inside\ a\ group
            |(Und|Ov)erfull
            |(LaTeX|Package|Class).*(Error|Warning)
            |.*Citation.*undefined
            |.*\ Error                                # as in \Url Error ->...
            |Missing\ character:                      # good to show (need \tracinglostchars=1)
            |\\endL.*problem                          # XeTeX?
            |\*\*\*\s                                 # *** from some packages or subprograms
            |l\.[0-9]+                                # line number marking
            |all\ text\ was\ ignored\ after\ line
            |.*Fatal\ error
            |.*for\ symbol.*on\ input\ line
            )''', re.VERBOSE)

        print_next = False
        filtered_output = []

        for line in latex_output.split('\n'):
            if print_next:
                filtered_output.append(line)
                print_next = False
            elif ignore.match(line):
                continue

            elif next_line.match(line):
                filtered_output.append(line)
                print_next = True

            elif show.match(line):
                filtered_output.append(line)

        return '\n'.join(filtered_output)

    @gen.coroutine
    def run_latex(self, command_sequence):
        """Run commands sequentially, returning a 500 code on an error.

        Parameters
        ----------
        command_sequence : list of tuples of strings
            This is a sequence of tuples of strings to be passed to
            `tornado.process.Subprocess`, which are to be run sequentially.
            On Windows, `tornado.process.Subprocess` is unavailable, so
            we use the synchronous `subprocess.run`.

        Returns
        -------
        string
            Response is either a success or an error string.

        Notes
        -----
        - LaTeX processes only print to stdout, so errors are gathered from
          there.

        """

        for cmd in command_sequence:
            self.log.debug(f'jupyterlab-latex: run: {" ".join(cmd)} (CWD: {os.getcwd()})')

            code, output = yield run_command(cmd)
            if code != 0:
                self.set_status(500)
                self.log.error((f'LaTeX command `{" ".join(cmd)}` '
                                 f'errored with code: {code}'))
                return json.dumps({'fullMessage':output, 'errorOnlyMessage':self.filter_output(output)})

        return "LaTeX compiled"


    @web.authenticated
    @gen.coroutine
    def get(self, path = ''):
        """
        Given a path, run LaTeX, cleanup, and respond when done.
        """
        # Parse the path into the base name and extension of the file
        tex_file_path = os.path.join(self.root_dir, path.strip('/'))
        tex_base_name, ext = os.path.splitext(os.path.basename(tex_file_path))
        c = LatexConfig(config=self.config)

        self.log.debug((f"jupyterlab-latex: get: path=({path}), "
                        f"CWD=({os.getcwd()}), root_dir=({self.serverapp.root_dir})"))

        if not os.path.exists(tex_file_path):
            self.set_status(403)
            out = f"Request cannot be completed; no file at `{tex_file_path}`."
        elif ext != '.tex':
            self.set_status(400)
            out = (f"The file at `{tex_file_path}` does not end with .tex. "
                    "You can only run LaTeX on a file ending with .tex.")
        else:
            with latex_cleanup(
                cleanup=c.cleanup,
                workdir=os.path.dirname(tex_file_path),
                whitelist=[tex_base_name+'.pdf', tex_base_name+'.synctex.gz'],
                greylist=[tex_base_name+'.aux']
                ):
                cmd_sequence = self.build_tex_cmd_sequence(tex_base_name)
                out = yield self.run_latex(cmd_sequence)
        self.finish(out)
