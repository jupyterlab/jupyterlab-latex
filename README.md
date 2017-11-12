# JupyterLab Latex

An extension for JupyterLab which allows for live-editing of LaTeX documents.

To use, right-click on a `.tex` document within JupyterLab, and select `Show LaTeX Preview`.
This will compile the `.tex` file and open the rendered PDF document.
Subsequent saves of the file will automatically update the PDF.
If the PDF fails to compile (possibly due to a syntax error),
an error panel will open detailing the LaTeX error.

## Requirements
* JupyterLab 0.29
* Something that can compile `.tex` files to PDF on your notebook server (e.g., `pdflatex` or `xelatex`).

## Installation

In order to enable this extension you must install both a notebook server extension and a lab extension.
From the `jupyterlab-latex` directory, enter the following into your terminal:
```bash
pip install .
jupyter serverextension enable jupyterlab_latex
jupyter labextension install .
```
The extension defaults to running `xelatex` on the server.
This command may be customized (e.g., to use `pdflatex` instead) by customizing
your `jupyter_notebook_config.py` file:
```python
c.LatexConfig.latex_command = 'pdflatex'
```
