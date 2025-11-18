""" JupyterLab LaTex : live LaTeX editing for JupyterLab """

import json, re, os
from contextlib import contextmanager
import shutil
from pathlib import Path

from tornado import gen, web

from jupyter_server.base.handlers import APIHandler

from .config import LatexConfig
from .util import run_command

@contextmanager
def latex_cleanup(cleanup=False, workdir='.', whitelist=None, greylist=None):
    """Context manager for pruning LaTeX artifacts within a specific folder.

    The helper snapshots the contents of ``workdir`` before compiling, makes
    sure greylisted files are removed prior to the run, and after compilation
    optionally deletes files and directories that did not exist beforehand.
    Every delete is executed via absolute paths to avoid touching files that
    live outside the requested directory.

    Parameters
    ----------

    cleanup = bool, default=False
        Whether to clean up files that were not in the working directory
        or not.
    workdir = string or Path, optional
        Path to the working directory for running LaTeX (the default is '.').
    whitelist = list or None, optional
        Files that should survive cleanup even if they were created during the
        LaTeX run. Defaults to None.
    greylist = list or None, optional
        Files that should be deleted before running LaTeX but preserved after
        compilation. Defaults to None.
    """
    whitelist = whitelist or []
    greylist = greylist or []
    workdir_path = Path(workdir).expanduser().resolve()

    def resolve_entry(entry):
        entry_path = Path(entry)
        if entry_path.is_absolute():
            resolved = entry_path.resolve()
        else:
            resolved = (workdir_path / entry_path).resolve()
        return resolved

    def snapshot_directory():
        if not workdir_path.exists():
            return set()
        return {entry.resolve() for entry in workdir_path.iterdir()}

    def remove_path(target):
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()

    keep_paths = set()
    for fp in greylist:
        target = resolve_entry(fp)
        try:
            remove_path(target)
        except FileNotFoundError:
            pass
        keep_paths.add(target)

    keep_paths |= snapshot_directory()
    for entry in whitelist:
        keep_paths.add(resolve_entry(entry))

    try:
        yield
    finally:
        if cleanup:
            after = snapshot_directory()
            for target in after - keep_paths:
                try:
                    remove_path(target)
                except FileNotFoundError:
                    continue



class LatexBuildHandler(APIHandler):
    """
    A handler that runs LaTeX on the server.
    """

    def initialize(self, root_dir):
        self.root_dir = root_dir


    def build_tex_cmd_sequence(self, tex_base_name, workdir):
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
        if c.disable_bibtex or engine_name == 'tectonic' or not self.bib_condition(workdir):
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

    def bib_condition(self, workdir):
        """Determines whether BiBTeX should be run.

        Returns
        -------
        boolean
            true if BibTeX should be run.

        """
        workdir_path = Path(workdir).expanduser().resolve()
        if not workdir_path.exists():
            return False
        return any(path.suffix == '.bib' for path in workdir_path.iterdir() if path.is_file())

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
    def run_latex(self, command_sequence, workdir):
        """Run commands sequentially, returning a 500 code on an error.

        Parameters
        ----------
        command_sequence : list of tuples of strings
            This is a sequence of tuples of strings to be passed to
            `tornado.process.Subprocess`, which are to be run sequentially.
            On Windows, `tornado.process.Subprocess` is unavailable, so
            we use the synchronous `subprocess.run`.
        workdir : string or Path
            Absolute directory that contains the LaTeX source file.

        Returns
        -------
        string
            Response is either a success or an error string.

        Notes
        -----
        - LaTeX processes only print to stdout, so errors are gathered from
          there.

        """

        normalized_workdir = str(workdir)
        for cmd in command_sequence:
            self.log.debug(
                f'jupyterlab-latex: run: {" ".join(cmd)} (CWD: {normalized_workdir})'
            )

            code, output = yield run_command(cmd, cwd=normalized_workdir)
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
        root_path = Path(self.root_dir).resolve()
        requested_path = Path(path.strip('/'))
        tex_file_path = (root_path / requested_path).resolve()
        c = LatexConfig(config=self.config)

        self.log.debug((f"jupyterlab-latex: get: path=({path}), "
                        f"CWD=({os.getcwd()}), root_dir=({self.serverapp.root_dir})"))

        try:
            tex_file_path.relative_to(root_path)
        except ValueError:
            self.set_status(403)
            out = (
                f"Requested LaTeX preview to compile `{tex_file_path}`, "
                f"but that path is outside the notebook root `{root_path}`. "
                "Only `.tex` files that live inside the notebook root can be compiled. "
                "Move the file back under the notebook root and try preview again."
            )
            self.finish(out)
            return

        tex_base_name = tex_file_path.stem
        ext = tex_file_path.suffix
        workdir = tex_file_path.parent

        if not tex_file_path.exists():
            self.set_status(403)
            out = (
                f"Requested LaTeX preview to compile `{tex_file_path}`, but that file "
                "does not exist anymore. Only saved `.tex` files on disk can be compiled. "
                "Save the notebook file or recreate it on disk, then try preview again."
            )
        elif ext != '.tex':
            self.set_status(400)
            out = (
                f"Requested LaTeX preview to compile `{tex_file_path}`, but the file "
                "does not end with `.tex`. Only files with the `.tex` extension can be "
                "compiled. Rename the file to end with `.tex` and retry."
            )
        else:
            with latex_cleanup(
                cleanup=c.cleanup,
                workdir=workdir,
                whitelist=[tex_base_name+'.pdf', tex_base_name+'.synctex.gz'],
                greylist=[tex_base_name+'.aux']
                ):
                cmd_sequence = self.build_tex_cmd_sequence(tex_base_name, workdir=workdir)
                out = yield self.run_latex(cmd_sequence, workdir=workdir)
        self.finish(out)
