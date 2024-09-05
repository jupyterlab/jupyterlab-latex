# Changelog for `jupyterlab_latex`

<!-- <START NEW CHANGELOG ENTRY> -->

## 4.1.3

([Full Changelog](https://github.com/jupyterlab/jupyterlab-latex/compare/v4.1.1...3e490aa42608c5170c36b5dd8e641045b3cb9818))

### Maintenance and upkeep improvements

- Update PDF.js to 3.8.162 [#232](https://github.com/jupyterlab/jupyterlab-latex/pull/232) ([@ktaletsk](https://github.com/ktaletsk))

### Documentation improvements

- Add missing comma [#233](https://github.com/jupyterlab/jupyterlab-latex/pull/233) ([@krassowski](https://github.com/krassowski))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyterlab-latex/graphs/contributors?from=2024-09-05&to=2024-09-05&type=c))

[@github-actions](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyterlab-latex+involves%3Agithub-actions+updated%3A2024-09-05..2024-09-05&type=Issues) | [@krassowski](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyterlab-latex+involves%3Akrassowski+updated%3A2024-09-05..2024-09-05&type=Issues) | [@ktaletsk](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyterlab-latex+involves%3Aktaletsk+updated%3A2024-09-05..2024-09-05&type=Issues)

<!-- <END NEW CHANGELOG ENTRY> -->

## 4.1.2

([Full Changelog](https://github.com/jupyterlab/jupyterlab-latex/compare/v4.1.1...9bf16578ab7763e62ea0ca055d7ec4584440ddef))

### Documentation improvements

- Add missing comma [#233](https://github.com/jupyterlab/jupyterlab-latex/pull/233) ([@krassowski](https://github.com/krassowski))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyterlab-latex/graphs/contributors?from=2024-09-05&to=2024-09-05&type=c))

[@krassowski](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyterlab-latex+involves%3Akrassowski+updated%3A2024-09-05..2024-09-05&type=Issues)

## 4.1.1

([Full Changelog](https://github.com/jupyterlab/jupyterlab-latex/compare/v4.1.0...5a48105d5e859338fc596266620727b240fb62af))

### Enhancements made

- Migrate to updated JupyterLab extension template [#230](https://github.com/jupyterlab/jupyterlab-latex/pull/230) ([@akisaini](https://github.com/akisaini))

### Bugs fixed

- Fix a bug of synctex edit command [#231](https://github.com/jupyterlab/jupyterlab-latex/pull/231) ([@naoh16](https://github.com/naoh16))

### Contributors to this release

([GitHub contributors page for this release](https://github.com/jupyterlab/jupyterlab-latex/graphs/contributors?from=2024-08-30&to=2024-09-04&type=c))

[@akisaini](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyterlab-latex+involves%3Aakisaini+updated%3A2024-08-30..2024-09-04&type=Issues) | [@ktaletsk](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyterlab-latex+involves%3Aktaletsk+updated%3A2024-08-30..2024-09-04&type=Issues) | [@naoh16](https://github.com/search?q=repo%3Ajupyterlab%2Fjupyterlab-latex+involves%3Anaoh16+updated%3A2024-08-30..2024-09-04&type=Issues)

- **4.1.0**:

  - Migrate to [JupyterLab extension template](https://github.com/jupyterlab/extension-template)
  - Minor JS changes

- **4.0.0**:

  - Update to JupyterLab 4.0
  - Update to Lumino 2

- **3.2.0**:

  - Update to JupyterLab 3.6.0
  - Bump JS and Python dependencies
  - Fix build issues

* **3.1.0**:

  - Switch to prebuilt (federated) extension model
  - Fix bug with icons visibility in the dark theme

* **3.0.0**:

  - Update to JupyterLab 3.0
  - Add LaTeX file menu
  - Add download PDF button

* **v2.0.0**:

  - Update to JupyterLab 2.0

* **v1.0.0**:

  - Update to JupyterLab 1.0

* **0.6.1**:

  - Added a new page component allowing the user to navigate PDFs by page label.

* **0.6.0**:

  - Fixed a bug where the PDF would try to open if the initial build failed.

* **0.4.1**:

  - Allow SyncTeX to work on windows by using absolute file paths.

* **0.4.0**:

  - Allow SyncTeX to work on windows by using absolute file paths.

* **0.3.1**:

  - Bugfix for SyncTeX on Windows.

* **0.3.0**:
  - New synctex functionality; server endpoints & front-end UI
  - New navigation UI for `PDFJSViewer`: zoom in/out, next/prev page, fit-to-pagewidth
