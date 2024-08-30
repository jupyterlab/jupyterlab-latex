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

- JupyterLab >= 4.0
  - older versions are supported in previous releases available on PyPI and npm, check [releases](https://github.com/jupyterlab/jupyterlab-latex/releases)
- Python >= 3.8
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
Package jupyterlab_latex took 0.0010s to import
      jupyterlab_latex 4.1.0 OK
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

For information on the changes with different versions of the `jupyterlab-latex` library, see our [changelog](./CHANGELOG.md)
