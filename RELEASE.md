# Making a new release of jupyterlab_latex

The extension can be published to `PyPI` and `npm` using the [Jupyter Releaser](https://github.com/jupyter-server/jupyter_releaser).

## Automated releases with the Jupyter Releaser

The extension repository should already be compatible with the Jupyter Releaser.

Check out the [workflow documentation](https://github.com/jupyter-server/jupyter_releaser#typical-workflow) for more information.

Here is a summary of the steps to cut a new release:

- Fork the [`jupyter-releaser` repo](https://github.com/jupyter-server/jupyter_releaser)
- Add `ADMIN_GITHUB_TOKEN`, `PYPI_TOKEN` and `NPM_TOKEN` to the Github Secrets in the fork
- Go to the Actions panel
- Run the "Draft Changelog" workflow
- Merge the Changelog PR
- Run the "Draft Release" workflow
- Run the "Publish Release" workflow

## Publishing to `conda-forge`

If the package is not on conda forge yet, check the documentation to learn how to add it: https://conda-forge.org/docs/maintainer/adding_pkgs.html

Otherwise a bot should pick up the new version publish to PyPI, and open a new PR on the feedstock repository automatically.
