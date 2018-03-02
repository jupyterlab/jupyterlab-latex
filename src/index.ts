// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILayoutRestorer, JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import {
  IInstanceTracker, InstanceTracker,
  showErrorMessage
} from '@jupyterlab/apputils';

import {
  CodeEditor
} from '@jupyterlab/codeeditor';

import {
  IStateDB, PathExt, ISettingRegistry, URLExt
} from '@jupyterlab/coreutils';

import {
  IDocumentManager
} from '@jupyterlab/docmanager';

import {
  DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  FileEditor, IEditorTracker
} from '@jupyterlab/fileeditor';

import {
  ServerConnection
} from '@jupyterlab/services';

import {
  ReadonlyJSONObject, Token
} from '@phosphor/coreutils';

import {
  DisposableSet
} from '@phosphor/disposable';

import {
  ErrorPanel
} from './error';

import {
  PDFJSViewer, PDFJSViewerFactory
} from './pdf';

import '../style/index.css';


/**
 * A class that tracks editor widgets.
 */
export
interface IPDFJSTracker extends IInstanceTracker<PDFJSViewer> {}


/* tslint:disable */
/**
 * The editor tracker token.
 */
export
const IPDFJSTracker = new Token<IPDFJSTracker>('@jupyterlab/latex:IPDFJSTracker');
/* tslint:enable */

const latexPluginId = '@jupyterlab/latex:plugin';

namespace CommandIDs {
  /**
   * Open a live preview for a `.tex` document.
   */
  export
  const openLatexPreview = 'latex:open-preview';

  /**
   * Reveal in the editor a position from the pdf using SyncTeX.
   */
  export
  const synctexEdit = 'latex:synctex-edit';

  /**
   * Reveal in the pdf a position from the editor using SyncTeX.
   */
  export
  const synctexView = 'latex:synctex-view';
}

/**
 * The options for a SyncTeX view command,
 * mapping the editor position the PDF.
 */
type ISynctexViewOptions = CodeEditor.IPosition;

/**
 * The options for a SyncTeX edit command,
 * mapping the pdf position to an editor position.
 */
type ISynctexEditOptions = PDFJSViewer.IPosition;

/**
 * The JupyterLab plugin for the LaTeX extension.
 */
const latexPlugin: JupyterLabPlugin<void> = {
  id: latexPluginId,
  requires: [
    IDocumentManager,
    IEditorTracker,
    ILayoutRestorer,
    IPDFJSTracker,
    ISettingRegistry,
    IStateDB
  ],
  activate: activateLatexPlugin,
  autoStart: true
};

/**
 * Make a request to the notebook server LaTeX endpoint.
 *
 * @param path - the path to the .tex file to watch.
 *
 * @param settings - the settings for the current notebook server.
 *
 * @returns a Promise resolved with the text response.
 */
function latexBuildRequest(path: string, synctex: boolean, settings: ServerConnection.ISettings): Promise<any> {
  let fullUrl = URLExt.join(settings.baseUrl, 'latex', 'build', path);
  fullUrl += `?synctex=${synctex ? 1 : 0}`;

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
 * Make a request to the notebook server SyncTeX endpoint.
 *
 * @param path - the path to the .tex or .pdf file.
 *
 * @param settings - the settings for the current notebook server.
 *
 * @returns a Promise resolved with the JSON response.
 */
function synctexEditRequest(path: string, pos: ISynctexEditOptions, settings: ServerConnection.ISettings): Promise<ISynctexViewOptions> {
  let url = URLExt.join(settings.baseUrl, 'latex', 'synctex', path);
  url += `?page=${pos.page}&x=${pos.x}&y=${pos.y}`;

  return ServerConnection.makeRequest(url, {}, settings).then(response => {
    if (response.status !== 200) {
      return response.text().then(data => {
        throw new ServerConnection.ResponseError(response, data);
      });
    }
    return response.json().then(json => {
      return {
        line: parseInt(json.Line, 10),
        column: parseInt(json.Column, 10)
      } as ISynctexViewOptions;
    });
  });
}

/**
 * Make a request to the notebook server SyncTeX endpoint.
 *
 * @param path - the path to the .tex or .pdf file.
 *
 * @param settings - the settings for the current notebook server.
 *
 * @returns a Promise resolved with the JSON response.
 */
function synctexViewRequest(path: string, pos: ISynctexViewOptions, settings: ServerConnection.ISettings): Promise<ISynctexEditOptions> {
  let url = URLExt.join(settings.baseUrl, 'latex', 'synctex', path);
  url += `?line=${pos.line}&column=${pos.column}`;

  return ServerConnection.makeRequest(url, {}, settings).then(response => {
    if (response.status !== 200) {
      return response.text().then(data => {
        throw new ServerConnection.ResponseError(response, data);
      });
    }
    return response.json().then(json => {
      return {
        page: parseInt(json.Page, 10),
        x: parseFloat(json.x),
        y: parseFloat(json.y)
      } as ISynctexEditOptions;
    });
  });
}

/**
 * Activate the file browser.
 */
function activateLatexPlugin(app: JupyterLab, manager: IDocumentManager, editorTracker: IEditorTracker, restorer: ILayoutRestorer, pdfTracker: IPDFJSTracker, settingRegistry: ISettingRegistry, state: IStateDB): void {
  const { commands } = app;
  const id = 'jupyterlab-latex';

  let synctex = true;

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
      latexBuildRequest(texContext.path, synctex, serverSettings).then(() => {
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
    latexBuildRequest(texContext.path, synctex, serverSettings).then(() => {
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

  // Fetch the initial state of the settings.
  Promise.all([settingRegistry.load(latexPluginId), app.restored])
  .then(([settings]) => {
    let disposables = new DisposableSet();
    const onSettingsUpdated = (settings: ISettingRegistry.ISettings) => {
      // Get the new value of the synctex setting.
      const val = settings.get('synctex').composite as boolean | null;
      synctex = (val === true || val === false) ? val : true;
      // Trash any existing synctex commands
      disposables.dispose();

      // If SyncTeX is enabled, add the commands.
      if (synctex) {
        disposables =
          addSynctexCommands(app, editorTracker, pdfTracker, serverSettings);
      }
    };
    settings.changed.connect(onSettingsUpdated);
    onSettingsUpdated(settings);
  }).catch((reason: Error) => {
    console.error(reason.message);
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
 * Add commands, keyboard shortcuts, and menu items for SyncTeX-related things.
 */
function addSynctexCommands(app: JupyterLab, editorTracker: IEditorTracker, pdfTracker: IPDFJSTracker, serverSettings: ServerConnection.ISettings): DisposableSet {
  const disposables = new DisposableSet();

  const hasPDFWidget = () => !!pdfTracker.currentWidget;
  const hasEditorWidget = () => !!editorTracker.currentWidget;

  // Add the command for the PDF-to-editor mapping.
  disposables.add(app.commands.addCommand(CommandIDs.synctexEdit, {
    execute: () => {
      // Get the pdf widget that had its contextMenu activated.
      let widget = pdfTracker.currentWidget;
      if (widget) {
        // Get the page number.
        const pos = widget.getScroll();

        // Request the synctex position for the PDF
        return synctexEditRequest(widget.context.path, pos, serverSettings)
        .then((view: ISynctexViewOptions) => {
          // Find the right editor widget.
          let editorWidget: FileEditor | undefined = undefined;
          const baseName = PathExt.basename(widget.context.path, '.pdf');
          const dirName = PathExt.dirname(widget.context.path);
          const texFilePath = PathExt.join(dirName, baseName + '.tex');
          editorTracker.forEach(editor => {
            if (editor.context.path === texFilePath) {
              editorWidget = editor;
            }
          });
          if (!editorWidget) {
            return;
          }
          // Scroll the editor.
          editorWidget.editor.setCursorPosition(view);
        });
      }
    },
    isEnabled: hasPDFWidget,
    isVisible: () => {
      const widget = pdfTracker.currentWidget;
      const baseName = PathExt.basename(widget.context.path, '.pdf');
      const dirName = PathExt.dirname(widget.context.path);
      const texFilePath = PathExt.join(dirName, baseName + '.tex');
      return widget && Private.previews.has(texFilePath);
    },
    label: 'Scroll Editor to Page'
  }));

  // Add the command for the editor-to-PDF mapping.
  disposables.add(app.commands.addCommand(CommandIDs.synctexView, {
    execute: () => {
      // Get the current widget that had its contextMenu activated.
      let widget = editorTracker.currentWidget;
      if (widget) {
        // Get the cursor position.
        const pos = widget.editor.getCursorPosition();

        // Request the synctex position for the PDF
        return synctexViewRequest(widget.context.path, pos, serverSettings)
        .then((edit: ISynctexEditOptions) => {
          // Find the right pdf widget.
          let pdfWidget: PDFJSViewer | undefined = undefined;
          const baseName = PathExt.basename(widget.context.path, '.tex');
          const dirName = PathExt.dirname(widget.context.path);
          const pdfFilePath = PathExt.join(dirName, baseName + '.pdf');
          pdfTracker.forEach(pdf => {

            if (pdf.context.path === pdfFilePath) {
              pdfWidget = pdf;
            }
          });
          if (!pdfWidget) {
            return;
          }
          // Scroll the pdf.
          pdfWidget.setScroll(edit);
        });
      }
    },
    isEnabled: hasEditorWidget,
    isVisible: () => {
      let widget = editorTracker.currentWidget;
      return widget && Private.previews.has(widget.context.path);
    },
    label: 'Scroll PDF to Cursor'
  }));

  // Add context menu items
  disposables.add(app.contextMenu.addItem({
    command: CommandIDs.synctexView,
    selector: '.jp-FileEditor'
  }));
  disposables.add(app.contextMenu.addItem({
    command: CommandIDs.synctexEdit,
    selector: '.jp-PDFJSContainer'
  }));

  // Add keybindings.
  disposables.add(app.commands.addKeyBinding({
    selector: '.jp-FileEditor',
    keys: ['Accel Shift X'],
    command: CommandIDs.synctexView
  }));
  disposables.add(app.commands.addKeyBinding({
    selector: '.jp-PDFJSContainer',
    keys: ['Accel Shift X'],
    command: CommandIDs.synctexEdit
  }));

  return disposables;
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
const pdfjsPlugin: JupyterLabPlugin<IPDFJSTracker> = {
  activate: activatePDFJS,
  id: '@jupyterlab/pdfjs-extension:plugin',
  requires: [ ILayoutRestorer ],
  provides: IPDFJSTracker,
  autoStart: true
};

function activatePDFJS(app: JupyterLab, restorer: ILayoutRestorer): IPDFJSTracker {
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

  return tracker;
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
