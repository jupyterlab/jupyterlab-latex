# Advanced usage

## Using SyncTeX

JupyterLab LaTeX supports using SyncTeX to map a location in the
text editor to a location in the generated PDF, as well as the reverse.
In the forward direction, it takes a line and column from the `.tex` file,
and maps it to a page in the PDF, as well as an (x,y) position on the page.
In the reverse direction, it takes a page and an (x,y) position, and maps
it onto a line and column of the `.tex` document.
To reveal the page of the PDF corresponding to the cursor in the text editor,
right-click in the editor and select "Show ".
To reveal the location in the text editor corresponding to a page of the PDF,
right click on the PDF and select "Scroll PDF to Cursor"

SyncTeX generates its mapping during the compilation of the `.tex` document
and stores it in a `.synctex.gz` file.
The `.synctex.gz` file is gzipped, as it can be large for long `.tex` documents.
It is used by the `synctex` command line program,
and is not intended to be used or parsed by users or developers.
If you subsequently edit the `.tex` document and run SyncTeX
before it recompiles, it may return incorrect results.

You can disable SyncTeX support by setting `synctex: false`
in the JupyterLab advanced settings editor.
The extension defaults to running `synctex` for establishing the mapping.
You can configure this command by setting `c.LatexConfig.synctex_command`
in your `jupyter_notebook_config.py` file.
