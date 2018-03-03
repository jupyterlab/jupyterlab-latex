# Advanced usage

## Using SyncTeX

JupyterLab LaTeX supports using SyncTeX to map a location in the
text editor to a location in the generated PDF, as well as the reverse.
To reveal the page of the PDF correspoding to the cursor in the text editor,
right-click in the editor and select "Show ".
To reveal the location in the text editor corresponding to a page of the PDF,
right click on the PDF and select "Scroll PDF to Cursor"

SyncTeX generates its mapping during the compilation of the `.tex` document
and stores it in a `.synctex.gz` file.
If you subsequently edit the `.tex` document and run SyncTeX
before it recompiles, it may return incorrect results.

You can disable SyncTeX support by setting `synctex: false`
in the JupyterLab advanced settings editor.
The extension defaults to running `synctex` for establishing the mapping.
You can configure this command by setting `c.LatexConfig.synctex_command`
in your `jupyter_notebook_config.py` file.

## Security and customizing shell escapes

LaTeX files have the ability to run arbitrary code by triggering external
shell commands. This is a security risk, and so most LaTeX distributions
restrict the commands that you can run in the shell.

You can customize the behavior by setting the `LatexConfig.shell_escape` value.
It can take three values: `"restricted"` (default) to allow only commands
considered safe to be executed, `"allow"` to allow all commands, and `"disallow"`
to disallow all commands.
For example, to force your LaTeX distribution to run any command, use:
```python
c.LatexConfig.shell_escape = "allow"
```

## Installing from source

You can install from source in order to develop the extension.

From the `jupyterlab-latex` directory, enter the following into your terminal:
```bash
pip install -e .
```
This installs the server extension.

If you are running Notebook 5.2 or earlier, enable the server extension by running
```bash
jupyter serverextension enable --sys-prefix jupyterlab_latex
```

Then, to install the lab extension, run
```bash
jlpm install
jlpm run build
jupyter labextension install .
```

