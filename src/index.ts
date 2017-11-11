// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILayoutRestorer, JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import {
  IStateDB, PathExt
} from '@jupyterlab/coreutils';

import {
  IDocumentManager
} from '@jupyterlab/docmanager';

import {
  DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  IEditorTracker
} from '@jupyterlab/fileeditor';

import {
  ServerConnection
} from '@jupyterlab/services';

import {
  ErrorPanel
} from './error';

import '../style/index.css';

namespace CommandIDs {
  export const openLatexPreview = 'latex:open-preview';
}
/**
 * The JupyterLab plugin for the LaTeX extension.
 */
const latexPlugin: JupyterLabPlugin<void> = {
  id: 'jupyterlab-latex:open',
  requires: [IDocumentManager, IEditorTracker, ILayoutRestorer, IStateDB],
  activate: activateLatexPlugin,
  autoStart: true
};

/**
 * Make a request to the notebook server LaTeX endpoint.
 *
 * @param url - the path to the .tex file to watch.
 *
 * @param settings - the settings for the current notebook server.
 *
 * @returns a Promise resolved with the JSON response.
 */
export function latexRequest(url: string, settings: ServerConnection.ISettings): Promise<any> {
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
function activateLatexPlugin(app: JupyterLab, manager: IDocumentManager, editorTracker: IEditorTracker, restorer: ILayoutRestorer, state: IStateDB): void {
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
      const dirName = PathExt.dirname(widget.context.path);
      const baseName = PathExt.basename(widget.context.path, '.tex');
      const pdfFilePath = PathExt.join(dirName, baseName + '.pdf');

      let pdfContext: DocumentRegistry.IContext<DocumentRegistry.IModel>;
      let errorPanel: ErrorPanel | null = null;

      // Hook up an event listener for when the '.tex' file is saved.
      widget.context.fileChanged.connect((sender, args) => {
        latexRequest(widget.context.path, serverSettings).then(() => {
          // Read the pdf file contents from disk.
          if (pdfContext) {
            pdfContext.revert();
          } else {
            const pdfWidget = manager.openOrReveal(pdfFilePath);
            pdfContext = manager.contextForWidget(pdfWidget);
          }
          if (errorPanel) {
            errorPanel.close();
          }
        }).catch((err) => {
          // If there was an error, read the log
          // file from disk and show it.
          if (!errorPanel) {
            errorPanel = Private.createErrorPanel();
            // On disposal, set the reference to null
            errorPanel.disposed.connect( () => {
              errorPanel = null;
            });
            //Add the error panel to the main area.
            app.shell.addToMainArea(errorPanel, { ref: widget.id });
          }
          errorPanel.text = err.xhr.response;
        });
      });

      // Run an initial latexRequest so that the appropriate files exist,
      // then open them.
      latexRequest(widget.context.path, serverSettings).then(() => {
        // Open the pdf and get a handle on its document context.
        const pdfWidget = manager.openOrReveal(pdfFilePath);
        pdfContext = manager.contextForWidget(pdfWidget);
      }).catch((err) => {
        // If there was an error, read the log
        // file from disk and show it.
        errorPanel = Private.createErrorPanel(err.xhr.response);
        // On disposal, set the reference to null
        errorPanel.disposed.connect( () => {
          errorPanel = null;
        });
        //Add the error panel to the main area.
        app.shell.addToMainArea(errorPanel, { ref: widget.id });
      });
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

/**
 * A namespace for private module data.
 */
namespace Private {
  /**
   * A counter for unique IDs.
   */
  let id = 0;

  /**
   * Create an error panel widget.
   */
  export
  function createErrorPanel(initialText: string = ''): ErrorPanel {
    const errorPanel = new ErrorPanel();
    errorPanel.text = initialText;
    errorPanel.id = `latex-error-${++id}`;
    errorPanel.title.label = 'LaTeX Error';
    errorPanel.title.closable = true;
    return errorPanel;
  }
}
