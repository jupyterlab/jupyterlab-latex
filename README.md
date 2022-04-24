# JupyterLab LaTeX

|       build       |              stable              |              latest              |
| :---------------: | :------------------------------: | :------------------------------: |
| [![ci-badge]][ci] | [![binder-badge]][binder-stable] | [![binder-badge]][binder-latest] |

[ci-badge]: https://github.com/jupyterlab/jupyterlab-latex/actions/workflows/build.yml/badge.svg
[ci]: https://github.com/jupyterlab/jupyterlab-latex/actions/workflows/build.yml?query=branch/master
[binder-badge]: https://mybinder.org/badge_logo.svg
[binder-stable]: https://mybinder.org/v2/gh/jupyterlab/jupyterlab-latex.git/3.1.0?urlpath=lab/tree/sample.tex
[binder-latest]: https://mybinder.org/v2/gh/jupyterlab/jupyterlab-latex.git/master?urlpath=lab/tree/sample.tex

An extension for JupyterLab which allows for live-editing of LaTeX documents.

## Usage

To use, right-click on an open `.tex` document within JupyterLab, and select `Show LaTeX Preview`:
![preview](images/show_preview.png)
This will compile the `.tex` file and open the rendered PDF document.
Subsequent saves of the file will automatically update the PDF.
If the PDF fails to compile (possibly due to a syntax error),
an error panel will open detailing the LaTeX error.

For more advanced usage documentation, see [here](docs/advanced.md).

## Requirements

- JupyterLab >= 3.0
  - older versions are supported in previous releases available on PyPI and npm, check [releases](https://github.com/jupyterlab/jupyterlab-latex/releases)
- Python >= 3.6
- An application that can compile `.tex` files to PDF (e.g., `pdflatex`, `xelatex`; use `pdflatex.exe` on Windows with MiKTeX). This application must be available as a command in the same environment as the notebook server.
- An application that can process `.bib` files for producing bibliographies. As with the LaTeX command, this must be available in the same environment as the notebook server.

## Installation

This extension includes both a notebook server extension (which interfaces with the LaTeX compiler)
and a lab extension (which provides the UI for the LaTeX preview).
The Python package named `jupyterlab_latex` provides both of them as a prebuilt extension.

To install the extension, run the following in your terminal:

```bash
pip install jupyterlab_latex
```

### Check installation

To ensure that extension is properly installed, you could check server and lab extensions:

```bash
jupyter server extension list
```

and see the block like this in the output

```
jupyterlab_latex enabled
    - Validating jupyterlab_latex...
      jupyterlab_latex 3.1.0 OK
```

then

```bash
jupyter labextension list
```

and see the block like this in the output

```
@jupyterlab/latex v3.1.0 enabled OK (python, jupyterlab-latex)
```

## Customization

The extension defaults to running `xelatex` on the server.
This command may be customized (e.g., to use `pdflatex` instead) by customizing
your `jupyter_notebook_config.py` file:

```python
c.LatexConfig.latex_command = 'pdflatex'
```

The extension defaults to running `bibtex` for generating a bibliography
if a `.bib` file is found. You can also configure the bibliography command
by setting

```python
c.LatexConfig.bib_command = '<custom_bib_command>'
```

To render references (`\ref{...}`), such as equation or chapter numbers, you would
need to compile in multiple passes by setting

```python
c.LatexConfig.run_times = 2
```

### Security and customizing shell escapes

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

# JupyterLab LabTeX

JupyterLab LabTeX is a document generator extension for JupyterLab which allows users to edit and compile LaTeX documents in a more efficient and user-friendly way.

# Release Notes

## Version 0.4.0

### New Features

- Image Formatting GUI: This feature allows the user to format an image (size, placement, captions, etc.)

- Insert Images GUI: This feature (partially complete) allows the user to upload an image from their PC and insert it directly into the document

- Insert Plots GUI: This feature allows the user to insert graphs and plots in an intuitive manner

- Text Layout Customization GUI: This feature allows the user to format a paragraphs layout (alignment for example)

### Bug Fixes

N/A

### Known Issues

- While the insert images GUI works, it's having trouble getting the real path to an image, and is thus unable to insert an image.

- During autocomplete implementation, a bug was found with either Jupyterlab-LSP or TexLab. We are working with their respective maintainers to resolve the issue.

## Version 0.3.0

### New Features

- Bullet Point and Numbered List

- Autocomplete

- Typeface Modifier GUI

### Bug Fixes

N/A

### Known Issues

- While using the typeface modifier buttons, a user can only select/highlight a single line of text to apply the typeface modification to.

## Version 0.2.0

### New Features

- Equation Buttons

- Table Creation GUI

- Preview Button

- Filtered Error Messages

### Bug Fixes

N/A

### Known Issues

- Unicode characters for Symbol/Constant Menu do not display correctly

## Version 0.1.0

### New Features

- Symbol Menu

- Constant Menu

### Bug Fixes

- LaTeX Editor toolbar buttons are now only visible for .TEX files

### Known Issues

N/A

## Changes

For information on the changes with different versions of the `jupyterlab-latex` library, see our [changelog](./docs/changelog.md)
