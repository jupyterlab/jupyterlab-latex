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

import { ServerConnection } from '@jupyterlab/services';

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
 * Make a request to the notebook server proxy for the
 * GitHub API.
 *
 * @param url - the api path for the GitHub API v3
 *   (not including the base url)
 *
 * @param settings - the settings for the current notebook server.
 *
 * @returns a Promise resolved with the JSON response.
 */
export function latexRequest<T>(
  url: string,
  settings: ServerConnection.ISettings
): Promise<T> {
  let request = {
    url: '/latex/' + url,
    method: 'GET',
    cache: true
  };

  return ServerConnection.makeRequest(request, settings)
    .then(response => {
      if (response.xhr.status !== 200) {
        throw ServerConnection.makeError(response);
      }
      return response.data;
    })
    .catch(response => {
      throw ServerConnection.makeError(response);
    });
}

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

  const serverSettings = ServerConnection.makeSettings();
  const hasWidget = () => !!editorTracker.currentWidget;
  commands.addCommand(CommandIDs.openLatexPreview, {
    execute: () => {
      // get the current widget that had its contextMenu activated
      let widget = editorTracker.currentWidget;
      if (!widget) {
        return;
      }
      // build pdfFileName so that we know what to watch for
      const pdfFileName =
        PathExt.basename(widget.context.path, '.tex') + '.pdf';

      widget.context.fileChanged.connect((sender, args) => {
        latexRequest(widget.context.path, serverSettings).then(() => {
          // Read the pdf file contents from disk.
          if (pdfContext) {
            pdfContext.revert();
          }
        });
      });

      // save document before opening pdf view to trigger build
      widget.context.save();
      // Open the pdf and get a handle on its document context.
      const pdfWidget = manager.openOrReveal(pdfFileName);
      const pdfContext = manager.contextForWidget(pdfWidget);
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
