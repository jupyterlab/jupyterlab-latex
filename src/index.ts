// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILayoutRestorer, JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import {
  IStateDB
} from '@jupyterlab/coreutils';

import {
  IDocumentManager
} from '@jupyterlab/docmanager';

import '../style/index.css';

/**
 * The JupyterLab plugin for the GitHub Filebrowser.
 */
const latexPlugin: JupyterLabPlugin<void> = {
  id: 'jupyterlab-latex:drive',
  // IDocumentManager: manages files (opening, closing, &c..)
  // ILayoutRestorer: manages layout on refresh
  // IStateDB: restores state on refresh
  requires: [IDocumentManager, ILayoutRestorer, IStateDB],
  activate: activateLatexPlugin,
  autoStart: true
};

/**
 * Activate the file browser.
 */
function activateLatexPlugin(app: JupyterLab, manager: IDocumentManager, restorer: ILayoutRestorer, state: IStateDB): void {
  console.log('Activated!')
  return;
}

export default latexPlugin;
