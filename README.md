# JupyterLab LaTeX

[binder-badge]: https://mybinder.org/badge_logo.svg
[binder-latest]: https://mybinder.org/v2/gh/jupyterlab/jupyterlab-latex.git/master?urlpath=lab/tree/sample.tex
[ci-badge]: https://github.com/jupyterlab/jupyterlab-latex/actions/workflows/build.yml/badge.svg
[ci]: https://github.com/jupyterlab/jupyterlab-latex/actions/workflows/build.yml?query=branch/master
[npm-version-badge]: https://img.shields.io/npm/v/@jupyterlab/latex.svg
[npm-version]: https://www.npmjs.com/package/@jupyterlab/latex
[pypi-version-badge]: https://img.shields.io/pypi/v/jupyterlab-latex.svg
[pypi-version]: https://pypi.org/project/jupyterlab-latex
[pypi-downloads-badge]: https://img.shields.io/pypi/dm/jupyterlab-latex

[![binder-badge]][binder-latest] [![ci-badge]][ci] [![npm-version-badge]][npm-version] [![pypi-version-badge]][pypi-version] ![PyPI - Downloads](https://img.shields.io/pypi/dm/jupyterlab-latex) [![Version](https://img.shields.io/conda/vn/conda-forge/jupyterlab-latex.svg)](https://anaconda.org/conda-forge/jupyterlab-latex) ![Conda Downloads](https://img.shields.io/conda/d/conda-forge/jupyterlab-latex)

A JupyterLab extension for live-editing of LaTeX documents.

## Usage

### Compilation

To compile and preview a LaTeX document:

1. Open a `.tex` document within JupyterLab.
2. Use one of the following methods to compile and preview the document:
   - Right-click on the document and select `Show LaTeX Preview` from the context menu.
   - Click the `Preview` button in the toolbar at the top of the document.

![preview](images/show_preview.png)

Both methods will compile the `.tex` file and open the rendered PDF document. Subsequent saves of the file will automatically update the PDF. If the PDF fails to compile (possibly due to a syntax error), an error panel will open detailing the LaTeX error.

### Writing Tools

A toolbar menu at the top of the document provides shortcuts to common LaTeX editing tasks:

#### Text Formatting

- **Subscript**: Highlight the text you want to subscript and click the `Xᵧ` button. If no text is highlighted, an input dialog will appear for you to enter the subscript.
- **Superscript**: Highlight the text you want to superscript and click the `Xⁿ` button. If no text is highlighted, an input dialog will appear for you to enter the superscript.
- **Bold**: Highlight the text you want to format in bold and click the `B` button.
- **Italic**: Highlight the text you want to format in italics and click the `I` button.
- **Underline**: Highlight the text you want to underline and click the `U` button.

#### Text Layout

- **Left Align**: Highlight the text you want to align left and click the left alignment button.
- **Center Align**: Highlight the text you want to center align and click the center alignment button.
- **Right Align**: Highlight the text you want to align right and click the right alignment button.

#### Lists

- **Bullet List**: Click the bullet list button to insert a bullet list.
- **Numbered List**: Click the numbered list button to insert a numbered list.

#### Tables and Plots

- **Table Creation GUI**: Click the table button to open a dialog for creating a table with a specified number of rows and columns.
- **Add Plot**: Click the plot button to select a plot type and insert it into your document. Available plot types include:
  - Simple function plot
  - Plot from file
  - Scatter plot
  - Bar graphs
  - Contour plot
  - Parametric plot

### Error Handling

- **Error Log Filtering Options**: Enhanced error log filtering options to help you quickly identify and resolve issues.

### Main Menu Helpers

- **Constant Menu**: Quickly insert common mathematical constants.
- **Symbol Menu**: Easily insert various mathematical symbols.

For more advanced usage documentation, see [here](docs/advanced.md).

## Requirements

- JupyterLab >= 4.0
  - older versions are supported in previous releases available on PyPI and npm, check [releases](https://github.com/jupyterlab/jupyterlab-latex/releases)
- Python >= 3.8
- An application that can compile `.tex` files to PDF (e.g., `pdflatex`, `xelatex`; use `pdflatex.exe` on Windows with MiKTeX). This application must be available as a command in the same environment as the notebook server.
- An application that can process `.bib` files for producing bibliographies. As with the LaTeX command, this must be available in the same environment as the notebook server.

## Installation

This extension includes both a notebook server extension (which interfaces with the LaTeX compiler)
and a lab extension (which provides the UI for the LaTeX preview).
The Python package named `jupyterlab-latex` provides both of them as a prebuilt extension.

To install the extension, run the following in your terminal:

- For `pip`
  ```bash
  pip install jupyterlab-latex
  ```
- For `conda`
  ```bash
  conda install conda-forge::jupyterlab-latex
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
Package jupyterlab_latex took 0.0010s to import
      jupyterlab_latex 4.1.3 OK
```

then

```bash
jupyter labextension list
```

and see the block like this in the output

```
@jupyterlab/latex v4.1.3 enabled OK (python, jupyterlab-latex)
```

## Customization

The extension defaults to running the `xelatex` engine on the server.
This command may be customized (e.g., to use `pdflatex` instead) by customizing
your `jupyter_notebook_config.py` file:

```python
c.LatexConfig.latex_command = 'pdflatex'
```

The above configuration will compile a LaTeX document using the common predefined flags and options such as `-interaction` `-halt-on-error`, `-file-line-error`, `-synctex`. For more control over the command sequence, check the Manual Command Arguments configuration.

The extension defaults to running `bibtex` for generating a bibliography
if a `.bib` file is found. You can also configure the bibliography command
by setting

```python
c.LatexConfig.bib_command = '<custom_bib_command>'
```

_New in 4.2.0_: `BibTeX` compilation is skipped if the following conditions are present:

- `c.LatexConfig.disable_bibtex` is explicitly set to `True` in the `jupyter_notebook_config.py` file
- There are no .bib files found in the folder

To render references (`\ref{...}`), such as equation or chapter numbers, you would
need to compile in multiple passes by setting

```python
c.LatexConfig.run_times = 2
```

_New in 4.2.0_: Manual Compile Command
For more advanced customizations, a complete command sequence can be specified using the `manual_cmd_args` configuration in the `jupyter_notebook_config.py` file. This allows to define the exact command and use options the extension will finally execute:

```python
c.LatexConfig.manual_cmd_args = [
    'lualatex',  # Specify the LaTeX engine (e.g., lualatex, pdflatex)
    '-interaction=nonstopmode',  # Continue compilation without stopping for errors
    '-halt-on-error',  # Stop compilation at the first error
    '-file-line-error',  # Print file and line number for errors
    '-shell-escape',  # Enable shell escape
    '-synctex=1',  # Enable SyncTeX for editor synchronization
    '{filename}.tex'  # Placeholder for the input file name
]
```

The only supported placeholder in the manual compile command is `{filename}`. It will be replaced by the name of the LaTeX file during compilation.

Additional tags and options can also be added to edit configuration values.

_New in 4.2.0_: Tectonic Engine Support
The extension now also supports the Tectonic engine for compiling LaTeX files. To use Tectonic as the default LaTeX engine cutomize the `jupyter_notebook_config.py file`:

```python
c.LatexConfig.latex_command = 'tectonic'
```

The default command sequence for Tectonic generates the output file in `pdf` format and uses the available `SyncTeX` flag.

For [advanced control](https://tectonic-typesetting.github.io/book/latest/v2cli/compile.html) over [Tectonic](https://github.com/tectonic-typesetting/tectonic), specify options in the manual_cmd_args setting:

```python
c.LatexConfig.manual_cmd_args = [
    'tectonic',
    '--outfmt=pdf',  # Output format as PDF
    '--synctex=1',  # Enable SyncTeX for editor synchronization
    '--outdir',  # The directory in which to place output files
    '--keep-logs',  # Keep the log files generated during processing
    '{filename}.tex'  # Input .tex file
]
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

## Contributing

If you would like to contribute to the project, please read our [contributor documentation](https://github.com/jupyterlab/jupyterlab/blob/master/CONTRIBUTING.md).

JupyterLab follows the official [Jupyter Code of Conduct](https://github.com/jupyter/governance/blob/master/conduct/code_of_conduct.md).

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

To simplify the development setup, you can use the following Conda environment:

```
conda create -n jupyterlab-latex-env -c conda-forge python=3.10 jupyterlab=4.0.0 hatchling=1.17.0 nodejs=18
conda activate jupyterlab-latex-env
```

```bash
# Clone the repo to your local environment
git clone https://github.com/jupyterlab/jupyterlab-latex.git
# Change directory to the jupyterlab-latex directory
cd jupyterlab-latex
# Install package in development mode
pip install -e .

# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Server extension must be manually installed in develop mode
jupyter server extension enable jupyterlab_latex
# Rebuild extension Typescript source after making changes
jlpm run build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm run watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

## Changes

For information on the changes with different versions of the `jupyterlab-latex` library, see our [changelog](./CHANGELOG.md).
