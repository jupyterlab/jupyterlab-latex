// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILayoutRestorer,
  JupyterLab,
  JupyterLabPlugin
} from '@jupyterlab/application';

import { IStateDB, PathExt } from '@jupyterlab/coreutils';

import { IDocumentManager } from '@jupyterlab/docmanager';

import { IEditorTracker } from '@jupyterlab/fileeditor';

import '../style/index.css';

namespace CommandIDs {
  export const openLatexPreview = 'latex:open-preview';
}
/**
 * The JupyterLab plugin for the GitHub Filebrowser.
 */
const latexPlugin: JupyterLabPlugin<void> = {
  id: 'jupyterlab-latex:open',
  // IDocumentManager: manages files (opening, closing, &c..)
  // ILayoutRestorer: manages layout on refresh
  // IStateDB: restores state on refresh
  requires: [IDocumentManager, IEditorTracker, ILayoutRestorer, IStateDB],
  activate: activateLatexPlugin,
  autoStart: true
};

/**
 * Activate the file browser.
 */
function activateLatexPlugin(
  app: JupyterLab,
  manager: IDocumentManager,
  editorTracker: IEditorTracker,
  restorer: ILayoutRestorer,
  state: IStateDB
): void {
  const { commands } = app;

  const hasWidget = () => !!editorTracker.currentWidget;
  commands.addCommand(CommandIDs.openLatexPreview, {
    execute: () => {
      let widget = editorTracker.currentWidget;
      if (!widget) {
        return;
      }
      let pdfFileName = () => {
        return PathExt.basename(widget.context.path, '.tex') + '.pdf';
      };
      widget.context.fileChanged.connect((sender, args) => {
        console.log('caught the update ' + pdfFileName());
        manager.openOrReveal(pdfFileName());
      });
      manager.openOrReveal(pdfFileName());
      console.log('executed preview');
    },
    isEnabled: hasWidget,
    isVisible: () => {
      let widget = editorTracker.currentWidget;
      return (
        (widget && PathExt.extname(widget.context.path) === '.tex') || false
      );
    },
    label: 'Show LaTeX Preview'
  });
  app.contextMenu.addItem({
    command: CommandIDs.openLatexPreview,
    selector: '.jp-FileEditor'
  });
  console.log('Activated!');
  return;
}

export default latexPlugin;
