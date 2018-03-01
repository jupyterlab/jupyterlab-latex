// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILayoutRestorer, JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import {
  InstanceTracker,
  showErrorMessage
} from '@jupyterlab/apputils';

import {
  IStateDB, PathExt, URLExt
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
  ReadonlyJSONObject
} from '@phosphor/coreutils';

import {
  ErrorPanel
} from './error';

import {
  PDFJSViewer, PDFJSViewerFactory
} from './pdf';

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
function latexBuildRequest(path: string, settings: ServerConnection.ISettings): Promise<any> {
  let fullUrl = URLExt.join(settings.baseUrl, 'latex', 'build', path);

  return ServerConnection.makeRequest(fullUrl, {}, settings).then(response => {
    if (response.status !== 200) {
      return response.text().then(data => {
        throw new ServerConnection.ResponseError(response, data);
      });
    }
    return response.text();
  });
}

/**
 * Activate the file browser.
 */
function activateLatexPlugin(app: JupyterLab, manager: IDocumentManager, editorTracker: IEditorTracker, restorer: ILayoutRestorer, state: IStateDB): void {
  const { commands } = app;
  const id = 'jupyterlab-latex';

  // Settings for the notebook server.
  const serverSettings = ServerConnection.makeSettings();

  // Whether there is a currently active editor widget.
  const hasWidget = () => !!editorTracker.currentWidget;

  // Given an fileEditor widget that hosts
  // a .tex document, open a LaTeX preview for it.
  const openPreview = (widget: DocumentRegistry.IReadyWidget) => {
    // If we can't find the document context, bail.
    let texContext = manager.contextForWidget(widget);
    if (!texContext) {
      return;
    }
    // If there is already an active preview for this context,
    // trigger a save then bail.
    if (Private.previews.has(texContext.path)) {
      texContext.save();
      return;
    }

    // build pdfFilePath so that we know what to watch for
    const dirName = PathExt.dirname(texContext.path);
    const baseName = PathExt.basename(texContext.path, '.tex');
    const pdfFilePath = PathExt.join(dirName, baseName + '.pdf');

    let pdfContext: DocumentRegistry.IContext<DocumentRegistry.IModel>;
    let errorPanel: ErrorPanel | null = null;
    let pending = false;

    const findOpenOrRevealPDF = () => {
      let pdfWidget = manager.findWidget(pdfFilePath);
      if (!pdfWidget) {
        pdfWidget = manager.openOrReveal(pdfFilePath, 'PDFJS', undefined,
          {'mode': 'split-right'});
      }
      pdfContext = manager.contextForWidget(pdfWidget);
      pdfContext.disposed.connect(cleanupPreviews);
    };

    const errorPanelInit = (err: ServerConnection.ResponseError) => {
      if (err.response.status === 404) {
        const noServerExt = {
          message: 'You probably do not have jupyterlab_latex '
                   + 'installed or enabled. '
                   + 'Please, run "pip install -U jupyterlab_latex." '
                   + 'If that does not work, try "jupyter serverextension '
                   + 'enable --sys-prefix jupyterlab_latex".'
        };
        showErrorMessage('Server Extension Error', noServerExt);
        return;
      }

      errorPanel = Private.createErrorPanel();
      // On disposal, set the reference to null
      errorPanel.disposed.connect(() => {
        errorPanel = null;
      });
      // Add the error panel to the main area.
      app.shell.addToMainArea(errorPanel, {
        ref: widget.id,
        mode: 'split-bottom'
      });
      errorPanel.text = err.message;
    };

    // Hook up an event listener for when the '.tex' file is saved.
    const onFileChanged = () => {
      if (pending) {
        return;
      }
      pending = true;
      latexBuildRequest(texContext.path, serverSettings).then(() => {
        // Read the pdf file contents from disk.
        pdfContext ? pdfContext.revert() : findOpenOrRevealPDF();
        if (errorPanel) {
          errorPanel.close();
        }
        pending = false;
      }).catch((err) => {
        // If there was an error, show the error panel
        // with the error log.
        if (!errorPanel) {
          errorPanelInit(err);
        }
        pending = false;
      });
    };

    texContext.fileChanged.connect(onFileChanged);

    // Run an initial latexRequest so that the appropriate files exist,
    // then open them.
    latexBuildRequest(texContext.path, serverSettings).then(() => {
      // Open the pdf and get a handle on its document context.
      findOpenOrRevealPDF();
    }).catch((err) => {
      // If there was an error, show the error panel
      // with the error log.
      errorPanelInit(err);
    });

    const cleanupPreviews = () => {
      Private.previews.delete(texContext.path);
      if (errorPanel) {
        errorPanel.close();
      }
      texContext.fileChanged.disconnect(onFileChanged);
      state.save(id, { paths: Array.from(Private.previews) });
    };

    // When the tex file is closed, remove it from the cache.
    // Also close any open error panels.
    // The listener should be removed in its own dispose() method.
    texContext.disposed.connect(cleanupPreviews);
    // Update the set of active previews and cache the values.
    Private.previews.add(texContext.path);
    state.save(id, { paths: Array.from(Private.previews) });
  };

  // If there are any active previews in the statedb,
  // activate them upon initialization.
  Promise.all([state.fetch(id), app.restored]).then(([args]) => {
    let paths = (args && (args as ReadonlyJSONObject)['paths'] as string[]) || [];
    paths.forEach(path => {
      let widget = manager.findWidget(path);
      if (widget) {
        openPreview(widget);
      }
    });
  });

  commands.addCommand(CommandIDs.openLatexPreview, {
    execute: () => {
      // Get the current widget that had its contextMenu activated.
      let widget = editorTracker.currentWidget;
      if (widget) {
        openPreview(widget);
      }
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
  return;
}

/**
 * The list of file types for pdfs.
 */
const FILE_TYPES = [
  'PDF'
];

/**
 * The name of the factory that creates pdf widgets.
 */
const FACTORY = 'PDFJS';

/**
 * The pdf file handler extension.
 */
const pdfjsPlugin: JupyterLabPlugin<void> = {
  activate: activatePDFJS,
  id: '@jupyterlab/pdfjs-extension:plugin',
  requires: [ ILayoutRestorer ],
  autoStart: true
};

function activatePDFJS(app: JupyterLab, restorer: ILayoutRestorer): void {
  const namespace = 'pdfjs-widget';
  const factory = new PDFJSViewerFactory({
    name: FACTORY,
    modelName: 'base64',
    fileTypes: FILE_TYPES,
    readOnly: true
  });
  const tracker = new InstanceTracker<PDFJSViewer>({ namespace });

  // Handle state restoration.
  restorer.restore(tracker, {
    command: 'docmanager:open',
    args: widget => ({ path: widget.context.path, factory: FACTORY }),
    name: widget => widget.context.path
  });

  app.docRegistry.addWidgetFactory(factory);

  factory.widgetCreated.connect((sender, widget) => {
    // Notify the instance tracker if restore data needs to update.
    widget.context.pathChanged.connect(() => { tracker.save(widget); });
    tracker.add(widget);

    const types = app.docRegistry.getFileTypesForPath(widget.context.path);

    if (types.length > 0) {
      widget.title.iconClass = types[0].iconClass;
      widget.title.iconLabel = types[0].iconLabel;
    }
  });
}

/**
 * Export the plugins as default.
 */
const plugins: JupyterLabPlugin<any>[] = [ latexPlugin, pdfjsPlugin ];
export default plugins;

/**
 * A namespace for private module data.
 */
namespace Private {
  /**
   * A counter for unique IDs.
   */
  let id = 0;

  /**
   * A cache for the currently active LaTeX previews.
   */
  export
  const previews = new Set<string>();

  /**
   * Create an error panel widget.
   */
  export
  function createErrorPanel(): ErrorPanel {
    const errorPanel = new ErrorPanel();
    errorPanel.id = `latex-error-${++id}`;
    errorPanel.title.label = 'LaTeX Error';
    errorPanel.title.closable = true;
    return errorPanel;
  }
}
