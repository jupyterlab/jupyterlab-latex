// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILabShell,
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  IWidgetTracker,
  WidgetTracker,
  showErrorMessage,
  ICommandPalette,
  InputDialog,
  ToolbarButton
} from '@jupyterlab/apputils';

import { CodeEditor } from '@jupyterlab/codeeditor';

import { PathExt, URLExt } from '@jupyterlab/coreutils';

import { IDocumentManager } from '@jupyterlab/docmanager';

import { DocumentRegistry, IDocumentWidget } from '@jupyterlab/docregistry';

import { FileEditor, IEditorTracker } from '@jupyterlab/fileeditor';

import { ServerConnection } from '@jupyterlab/services';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { IStateDB } from '@jupyterlab/statedb';

import { ReadonlyJSONObject, Token } from '@lumino/coreutils';

import { DisposableSet } from '@lumino/disposable';

import { ErrorPanel } from './error';

import { PDFJSDocumentWidget, PDFJSViewer, PDFJSViewerFactory } from './pdf';

import { ILauncher } from '@jupyterlab/launcher';

import { LabIcon } from '@jupyterlab/ui-components';

import { IDefaultFileBrowser } from '@jupyterlab/filebrowser';

import { IMainMenu } from '@jupyterlab/mainmenu';

import latexIconStr from '../style/latex.svg';

import listIconStr from '../style/icons/list.svg';
import olistIconStr from '../style/icons/olist.svg';
import italicIconStr from '../style/icons/italic.svg';
import boldIconStr from '../style/icons/bold.svg';
import underlineIconStr from '../style/icons/underline.svg';
import tableIconStr from '../style/icons/table.svg';
import rightIconStr from '../style/icons/right-align.svg';
import centerIconStr from '../style/icons/center-align.svg';
import leftIconStr from '../style/icons/left-align.svg';
import plotIconStr from '../style/icons/chart-column-solid.svg';

import '../style/index.css';

import { Menu } from '@lumino/widgets';

import { NotebookPanel, INotebookModel } from '@jupyterlab/notebook';

import { IDisposable, DisposableDelegate } from '@lumino/disposable';

/**
 * A class that tracks editor widgets.
 */
export type IPDFJSTracker = IWidgetTracker<IDocumentWidget<PDFJSViewer>>;

/* tslint:disable */
/**
 * The editor tracker token.
 */
export const IPDFJSTracker = new Token<IPDFJSTracker>(
  '@jupyterlab/latex:IPDFJSTracker'
);
/* tslint:enable */

const latexPluginId = '@jupyterlab/latex:plugin';

namespace CommandIDs {
  /**
   * Open a live preview for a `.tex` document.
   */
  export const openLatexPreview = 'latex:open-preview';

  /**
   * Reveal in the editor a position from the pdf using SyncTeX.
   */
  export const synctexEdit = 'latex:synctex-edit';

  /**
   * Reveal in the pdf a position from the editor using SyncTeX.
   */
  export const synctexView = 'latex:synctex-view';

  /**
   * Create new latex file
   */
  export const createNew = 'latex:create-new-latex-file';

  export const createTable = 'latex:create-table';
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
 * The JupyterFrontEnd plugin for the LaTeX extension.
 */
const latexPlugin: JupyterFrontEndPlugin<void> = {
  id: latexPluginId,
  requires: [
    IDefaultFileBrowser,
    IDocumentManager,
    IEditorTracker,
    ILabShell,
    ILayoutRestorer,
    IPDFJSTracker,
    ISettingRegistry,
    IStateDB
  ],
  optional: [ILauncher, IMainMenu, ICommandPalette],
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
function latexBuildRequest(
  path: string,
  synctex: boolean,
  settings: ServerConnection.ISettings
): Promise<any> {
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
function synctexEditRequest(
  path: string,
  pos: ISynctexEditOptions,
  settings: ServerConnection.ISettings
): Promise<ISynctexViewOptions> {
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
        line: parseInt(json.line, 10),
        column: parseInt(json.column, 10)
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
function synctexViewRequest(
  path: string,
  pos: ISynctexViewOptions,
  settings: ServerConnection.ISettings
): Promise<ISynctexEditOptions> {
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
        page: parseInt(json.page, 10),
        x: parseFloat(json.x),
        y: parseFloat(json.y)
      } as ISynctexEditOptions;
    });
  });
}

function isLatexFile(
  editorTracker: IEditorTracker
): IDocumentWidget<FileEditor, DocumentRegistry.IModel> | null {
  const widget = editorTracker.currentWidget;
  if (widget && PathExt.extname(widget.context.path) === '.tex') {
    return widget;
  } else {
    return null;
  }
}

/**
 * Activate the file browser.
 */
function activateLatexPlugin(
  app: JupyterFrontEnd,
  browser: IDefaultFileBrowser,
  manager: IDocumentManager,
  editorTracker: IEditorTracker,
  shell: ILabShell,
  restorer: ILayoutRestorer,
  pdfTracker: IPDFJSTracker,
  settingRegistry: ISettingRegistry,
  state: IStateDB,
  launcher: ILauncher | null,
  menu: IMainMenu | null,
  palette: ICommandPalette | null
): void {
  const { commands } = app;
  const id = 'jupyterlab-latex';

  const icon = new LabIcon({
    name: 'launcher:latex-icon',
    svgstr: latexIconStr
  });

  let synctex = true;

  // Settings for the notebook server.
  const serverSettings = ServerConnection.makeSettings();

  // Whether there is a currently active editor widget.
  const hasWidget = () => !!editorTracker.currentWidget;

  // Given an fileEditor widget that hosts
  // a .tex document, open a LaTeX preview for it.
  const openPreview = (widget: IDocumentWidget) => {
    // If we can't find the document context, bail.
    const texContext = manager.contextForWidget(widget);
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
        pdfWidget = manager.openOrReveal(pdfFilePath, 'PDFJS', undefined, {
          mode: 'split-right'
        });
      }
      if (!pdfWidget) {
        return;
      }
      (pdfWidget as PDFJSDocumentWidget).content.positionRequested.connect(
        reverseSearch
      );
      pdfContext = manager.contextForWidget(pdfWidget)!;
      pdfContext.disposed.connect(cleanupPreviews);
    };

    const reverseSearch = (s: PDFJSViewer, pos: PDFJSViewer.IPosition) => {
      // SyncTeX's column/x mapping seems to be very unreliable.
      // We get better results by only trying to sync the line/y position.
      synctexEditRequest(s.context.path, { ...pos, x: 0 }, serverSettings).then(
        (view: ISynctexViewOptions) => {
          // SyncTex line is one-based, so subtract 1.
          const cursor = { line: view.line - 1, column: 0 };
          (
            widget as IDocumentWidget<FileEditor>
          ).content.editor.setCursorPosition(cursor);
        }
      );
    };

    const errorPanelInit = (err: ServerConnection.ResponseError) => {
      if (err.response.status === 404) {
        const noServerExt = {
          message:
            'You probably do not have jupyterlab_latex ' +
            'installed or enabled. ' +
            'Please, run "pip install -U jupyterlab_latex." ' +
            'If that does not work, try "jupyter serverextension ' +
            'enable --sys-prefix jupyterlab_latex".'
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
      shell.add(errorPanel, 'main', {
        ref: widget.id,
        mode: 'split-bottom'
      });
      errorPanel.text = err.message;
    };

    // Hook up an event listener for when the '.tex' file is saved.
    const onFileChanged = () => {
      if (pending) {
        return Promise.resolve(void 0);
      }
      pending = true;

      /** Get the local file path without any drive prefix potentially added by
       * other extensions like jupyter-collaboration
       */
      const localPath = app.serviceManager.contents.localPath(texContext!.path);

      return latexBuildRequest(localPath, synctex, serverSettings)
        .then(() => {
          // Read the pdf file contents from disk.
          pdfContext ? pdfContext.revert() : findOpenOrRevealPDF();
          if (errorPanel) {
            errorPanel.close();
          }
          pending = false;
        })
        .catch(err => {
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
    onFileChanged().then(() => {
      if (!errorPanel) {
        findOpenOrRevealPDF();
      }
    });

    const cleanupPreviews = () => {
      if (!texContext) {
        return;
      }
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

  class EditorToolbarPanel
    implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel>
  {
    createNew(
      panel: NotebookPanel,
      context: DocumentRegistry.IContext<INotebookModel>
    ): IDisposable {
      const execOpenLataxPreview = () => {
        commands.execute(CommandIDs.openLatexPreview);
      };

      const createInputDialog = (mess: string, action: string) => {
        const widget = editorTracker.currentWidget;
        if (widget) {
          const editor = widget.content.editor;
          InputDialog.getText({
            title: mess
          }).then(value => {
            if (value.value) {
              if (editor.replaceSelection) {
                editor.replaceSelection(action + '{' + value.value + '}');
              }
            }
          });
        }
      };

      const replaceSelection = (action: string) => {
        const widget = editorTracker.currentWidget;
        if (widget) {
          const editor = widget.content.editor;
          if (editor.replaceSelection && editor.getSelection) {
            const start = editor.getSelection().start;
            const end = editor.getSelection().end;
            if (start.line === end.line) {
              let selection: string | undefined = editor.getLine(start.line);
              if (selection) {
                selection = selection.substring(start.column, end.column);
                if (selection.length > 0) {
                  editor.replaceSelection(action + '{' + selection + '}');
                  return 1;
                }
              }
            }
          }
        }
        return 0;
      };

      const insertSubscript = () => {
        const action = '_';
        const result = replaceSelection(action);
        if (result === 0) {
          createInputDialog('Provide Desired Subscript', action);
        }
      };

      const insertSuperscript = () => {
        const action = '^';
        const result = replaceSelection(action);
        if (result === 0) {
          createInputDialog('Provide Desired Superscript', action);
        }
      };

      const insertFraction = () => {
        InputDialog.getText({
          title:
            'Provide Desired Fraction: Numerator, Denominator\nEX: 1,2 -> \u00BD '
        }).then(value => {
          if (value.value) {
            const widget = editorTracker.currentWidget;
            const inputString = value.value;
            const inputArgs = inputString.split(',');
            if (widget && inputArgs.length === 2) {
              const editor = widget.content.editor;
              if (editor.replaceSelection) {
                editor.replaceSelection(
                  '\\frac{' +
                    inputArgs[0].trim() +
                    '}{' +
                    inputArgs[1].trim() +
                    '}'
                );
              }
            }
          }
        });
      };

      const leftAlign = () => {
        const action = '\\leftline';
        const result = replaceSelection(action);
        if (result === 0) {
          createInputDialog('Provide Text to Left Align', action);
        }
      };

      const centerAlign = () => {
        const action = '\\centerline';
        const result = replaceSelection(action);
        if (result === 0) {
          createInputDialog('Provide Text to Center Align', action);
        }
      };

      const rightAlign = () => {
        const action = '\\rightline';
        const result = replaceSelection(action);
        if (result === 0) {
          createInputDialog('Provide Text to Right Align', action);
        }
      };

      const insertBold = () => {
        const action = '\\textbf';
        const result = replaceSelection(action);
        if (result === 0) {
          createInputDialog('Provide Text to Bold', action);
        }
      };

      const insertItalics = () => {
        const action = '\\textit';
        const result = replaceSelection(action);
        if (result === 0) {
          createInputDialog('Provide Text to Italicise', action);
        }
      };

      const insertUnderline = () => {
        const action = '\\underline';
        const result = replaceSelection(action);
        if (result === 0) {
          createInputDialog('Provide Text to Underline', action);
        }
      };

      const insertBulletList = () => {
        const widget = editorTracker.currentWidget;
        if (widget) {
          const editor = widget.content.editor;
          if (editor.replaceSelection) {
            editor.replaceSelection(
              '\\begin{itemize}' +
                '\n' +
                '\t' +
                '\\item' +
                '\n' +
                '\\end{itemize}'
            );
          }
        }
      };

      const insertNumberedList = () => {
        const widget = editorTracker.currentWidget;
        if (widget) {
          const editor = widget.content.editor;
          if (editor.replaceSelection) {
            editor.replaceSelection(
              '\\begin{enumerate}' +
                '\n' +
                '\t' +
                '\\item' +
                '\n' +
                '\\end{enumerate}'
            );
          }
        }
      };
      const insertPlot = () => {
        InputDialog.getItem({
          title: 'Select Plot Type',
          items: [
            'Mathematical Expression',
            'Data From File',
            'Scatter Plot',
            'Bar Graphs',
            'Contour Plots',
            'Parametric Plot'
          ]
        }).then(value => {
          if (value.value) {
            let plotText = '';

            switch (value.value) {
              case 'Mathematical Expression': {
                plotText =
                  '\\begin{tikzpicture}' +
                  '\n\\begin{axis}[' +
                  '\n\taxis lines = left,' +
                  '\n\txlabel = \\(x\\),' +
                  '\n\tylabel = {\\(f(x)\\)},' +
                  '\n]' +
                  '\n\\addplot [' +
                  '\n\tdomain=-10:10, ' +
                  '\n\tsamples=100, ' +
                  '\n\tcolor=blue,' +
                  '\n]' +
                  '\n{x^2};' +
                  '\n\\addlegendentry{\\(x^2\\)}' +
                  '\n\\end{axis}' +
                  '\n\\end{tikzpicture}';
                break;
              }
              case 'Data From File': {
                plotText =
                  '\\begin{tikzpicture}' +
                  '\n\\begin{axis}[' +
                  '\n\ttitle={Title},' +
                  '\n\txlabel={x axis label},' +
                  '\n\tylabel={y axis label},' +
                  '\n\txmin=0, xmax=100,' +
                  '\n\tymin=0, ymax=100,' +
                  '\n\txtick={},' +
                  '\n\tytick={},' +
                  '\n\tlegend pos=north west' +
                  '\n]' +
                  '\n\n\\addplot[' +
                  '\n\tcolor=blue,' +
                  '\n\tmark=*]' +
                  '\n{Data File Path};' +
                  '\n\n\\legend{Legend Text}' +
                  '\n\n\\end{axis}' +
                  '\n\\end{tikzpicture}';
                break;
              }
              case 'Scatter Plot': {
                plotText =
                  '\\begin{tikzpicture}' +
                  '\n\\begin{axis}[' +
                  '\n\ttitle={Title},' +
                  '\n\txlabel={x axis label},' +
                  '\n\tylabel={y axis label},' +
                  '\n\txmin=0, xmax=100,' +
                  '\n\tymin=0, ymax=100,' +
                  '\n\txtick={},' +
                  '\n\tytick={},' +
                  '\n\tlegend pos=north west' +
                  '\n]' +
                  '\n\n\\addplot[' +
                  '\n\tonly marks,' +
                  '\n\tmark=*]' +
                  '\ntable' +
                  '\n{Data File Path};' +
                  '\n\n\\legend{Legend Text}' +
                  '\n\n\\end{axis}' +
                  '\n\\end{tikzpicture}';
                break;
              }
              case 'Bar Graphs': {
                plotText =
                  '\\begin{tikzpicture}' +
                  '\n\\begin{axis}[' +
                  '\ntitle={Title},' +
                  '\nxlabel={x axis label},' +
                  '\nylabel={y axis label},' +
                  '\nxmin=0, xmax=100,' +
                  '\nymin=0, ymax=100,' +
                  '\nenlargelimits=0.05,' +
                  '\nlegend pos=north west,' +
                  '\nybar,' +
                  '\n]' +
                  '\n\n\\addplot table {\\mydata};' +
                  '\n\n\\end{axis}' +
                  '\n\\end{tikzpicture}';
                break;
              }
              case 'Contour Plots': {
                plotText =
                  '\\begin{tikzpicture}' +
                  '\n\\begin{axis}' +
                  '\n[' +
                  '\n\ttitle={Title},' +
                  '\n\tview={0}{90}' +
                  '\n]' +
                  '\n\\addplot3[' +
                  '\n\tcontour gnuplot={levels={0.5}}' +
                  '\n]' +
                  '\n{sqrt(x^2+y^2)};' +
                  '\n\\addlegendentry{\\(sqrt(x^2+y^2)\\)}' +
                  '\n\\end{axis}' +
                  '\n\\end{tikzpicture}';
                break;
              }
              case 'Parametric Plot': {
                plotText =
                  '\\begin{tikzpicture}' +
                  '\n\\begin{axis}' +
                  '\n[' +
                  '\n\ttitle={Title},' +
                  '\n\tview={60}{30}' +
                  '\n]' +
                  '\n\n\\addplot3[' +
                  '\n\tdomain=-5:5,' +
                  '\n\tsamples = 60,' +
                  '\n\tsamples y=0,' +
                  '\n]' +
                  '\n({sin(deg(x))},' +
                  '\n{cos(deg(x))},' +
                  '\n{x});' +
                  '\n\n\\addlegendentry{\\(Legend Label)\\)}' +
                  '\n\n\\end{axis}' +
                  '\n\\end{tikzpicture}';
                break;
              }
            }

            const widget = editorTracker.currentWidget;
            if (widget) {
              const editor = widget.content.editor;
              if (editor.replaceSelection) {
                editor.replaceSelection(plotText);
              }
            }
          }
        });
      };

      const execCreateTable = () => {
        //const createTable = 'latex:create-table'
        commands.execute(CommandIDs.createTable);
        //app.commands.addCommand('latex:create-table', {
      };

      const previewButton = new ToolbarButton({
        className: 'run-latexPreview-command',
        label: 'Preview',
        onClick: execOpenLataxPreview,
        tooltip: 'Click to preview your LaTeX document'
      });

      const subscriptButton = new ToolbarButton({
        className: 'insert-subscript',
        label: 'Xᵧ',
        onClick: insertSubscript,
        tooltip: 'Click to open subscript input dialog'
      });

      const superscriptButton = new ToolbarButton({
        className: 'insert-superscript',
        label: 'X\u02B8',
        onClick: insertSuperscript,
        tooltip: 'Click to open superscript input dialog'
      });

      const fractionButton = new ToolbarButton({
        className: 'insert-fraction',
        label: 'X/Y',
        onClick: insertFraction,
        tooltip: 'Click to open fraction input dialog'
      });
      const lefticon = new LabIcon({
        name: 'launcher:left-icon',
        svgstr: leftIconStr
      });
      const leftTextAlignmentButton = new ToolbarButton({
        className: 'insert-text',
        icon: lefticon,
        onClick: leftAlign,
        tooltip: 'Click to left align highlighted text'
      });

      const centericon = new LabIcon({
        name: 'launcher:center-icon',
        svgstr: centerIconStr
      });
      const centerTextAlignmentButton = new ToolbarButton({
        className: 'insert-text',
        icon: centericon,
        onClick: centerAlign,
        tooltip: 'Click to left align highlighted text'
      });

      const righticon = new LabIcon({
        name: 'launcher:right-icon',
        svgstr: rightIconStr
      });
      const rightTextAlignmentButton = new ToolbarButton({
        className: 'insert-text',
        icon: righticon,
        onClick: rightAlign,
        tooltip: 'Click to left align highlighted text'
      });
      const boldicon = new LabIcon({
        name: 'launcher:bold-icon',
        svgstr: boldIconStr
      });

      const boldButton = new ToolbarButton({
        className: 'bold-text',
        icon: boldicon,
        onClick: insertBold,
        tooltip: 'Click to insert bold text'
      });

      const italicsicon = new LabIcon({
        name: 'launcher:italics-icon',
        svgstr: italicIconStr
      });

      const italicsButton = new ToolbarButton({
        className: 'italicize-text',
        icon: italicsicon,
        onClick: insertItalics,
        tooltip: 'Click to insert italicized text'
      });

      const underlineicon = new LabIcon({
        name: 'launcher:underline-icon',
        svgstr: underlineIconStr
      });
      const underlineButton = new ToolbarButton({
        className: 'underline-text',
        icon: underlineicon,
        onClick: insertUnderline,
        tooltip: 'Click to insert underlined text'
      });

      const listicon = new LabIcon({
        name: 'launcher:list-icon',
        svgstr: listIconStr
      });

      const bulletListButton = new ToolbarButton({
        className: 'insert-bullet-list',
        icon: listicon,
        onClick: insertBulletList,
        tooltip: 'Click to insert bullet list'
      });

      const olisticon = new LabIcon({
        name: 'launcher:olist-icon',
        svgstr: olistIconStr
      });

      const numberedListButton = new ToolbarButton({
        className: 'insert-numbered-list',
        icon: olisticon,
        onClick: insertNumberedList,
        tooltip: 'Click to insert numbered list'
      });

      const tableicon = new LabIcon({
        name: 'launcher:table-icon',
        svgstr: tableIconStr
      });
      const tableInsertButton = new ToolbarButton({
        className: 'insert-table',
        icon: tableicon,
        onClick: execCreateTable,
        tooltip: 'Click to insert table'
      });

      const plotIcon = new LabIcon({
        name: 'launcher:plot-icon',
        svgstr: plotIconStr
      });

      const plotButton = new ToolbarButton({
        className: 'insert-plot',
        icon: plotIcon,
        onClick: insertPlot,
        tooltip: 'Click to insert a plot'
      });

      if (context.path.endsWith('.tex')) {
        panel.toolbar.insertItem(10, 'Preview', previewButton);
        panel.toolbar.insertItem(10, 'sub', subscriptButton);
        panel.toolbar.insertItem(10, 'super', superscriptButton);
        panel.toolbar.insertItem(10, 'fraction', fractionButton);

        panel.toolbar.insertItem(10, 'left', leftTextAlignmentButton);
        panel.toolbar.insertItem(10, 'center', centerTextAlignmentButton);
        panel.toolbar.insertItem(10, 'right', rightTextAlignmentButton);

        panel.toolbar.insertItem(10, 'bold', boldButton);
        panel.toolbar.insertItem(10, 'italics', italicsButton);
        panel.toolbar.insertItem(10, 'underline', underlineButton);
        panel.toolbar.insertItem(10, 'bullet-list', bulletListButton);
        panel.toolbar.insertItem(10, 'numbered-list', numberedListButton);
        panel.toolbar.insertItem(10, 'table', tableInsertButton);
        panel.toolbar.insertItem(10, 'insert-plot', plotButton);
      }
      return new DisposableDelegate(() => {
        previewButton.dispose();
        subscriptButton.dispose();
        superscriptButton.dispose();
        fractionButton.dispose();

        leftTextAlignmentButton.dispose();
        centerTextAlignmentButton.dispose();
        rightTextAlignmentButton.dispose();

        boldButton.dispose();
        italicsButton.dispose();
        underlineButton.dispose();
        bulletListButton.dispose();
        numberedListButton.dispose();
        tableInsertButton.dispose();
        plotButton.dispose();
      });
    }
  }

  app.docRegistry.addWidgetExtension('Editor', new EditorToolbarPanel());

  // If there are any active previews in the statedb,
  // activate them upon initialization.
  Promise.all([state.fetch(id), app.restored]).then(([args]) => {
    const paths =
      (args && ((args as ReadonlyJSONObject)['paths'] as string[])) || [];
    paths.forEach(path => {
      const widget = manager.findWidget(path);
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
        synctex = val === true || val === false ? val : true;
        // Trash any existing synctex commands
        disposables.dispose();

        // If SyncTeX is enabled, add the commands.
        if (synctex) {
          disposables = addSynctexCommands(
            app,
            editorTracker,
            pdfTracker,
            serverSettings
          );
        }
      };
      settings.changed.connect(onSettingsUpdated);
      onSettingsUpdated(settings);
    })
    .catch((reason: Error) => {
      console.error(reason.message);
    });

  commands.addCommand(CommandIDs.openLatexPreview, {
    execute: () => {
      // Get the current widget that had its contextMenu activated.
      const widget = editorTracker.currentWidget;
      if (widget) {
        openPreview(widget);
      }
    },
    isEnabled: hasWidget,
    isVisible: () => {
      return isLatexFile(editorTracker) !== null;
    },
    label: 'Show LaTeX Preview'
  });

  const command = CommandIDs.createNew;
  const command_latex_preview = CommandIDs.openLatexPreview;
  commands.addCommand(command, {
    label: args => (args['isPalette'] ? 'New LaTeX File' : 'LaTeX File'),
    caption: 'Create a new LaTeX file',
    icon: args => (args['isPalette'] ? undefined : icon),
    execute: async args => {
      // Get the directory in which the LaTeX file must be created;
      // otherwise take the current filebrowser directory
      const cwd = args['cwd'] || browser.model.path;

      // Create a new untitled LaTeX file
      const model = await commands.execute('docmanager:new-untitled', {
        path: cwd,
        type: 'file',
        ext: 'tex'
      });

      // Open the newly created file with the 'Editor'
      return commands.execute('docmanager:open', {
        path: model.path,
        factory: FACTORY_EDITOR
      });
    }
  });

  app.contextMenu.addItem({
    command: command_latex_preview,
    selector: '.jp-FileEditor'
  });

  // Add the command to the launcher
  if (launcher) {
    launcher.add({
      command,
      category: LAUNCHER_CATEGORY,
      rank: 1
    });
  }

  // Add the command to the palette
  if (palette) {
    palette.addItem({
      command: command,
      args: { isPalette: true },
      category: PALETTE_CATEGORY
    });
  }

  // Add the command to the menu
  if (menu) {
    menu.fileMenu.newMenu.addGroup([{ command }], 30);
    addLatexMenu(app, editorTracker, menu);
  }
}

/**
 * Add commands, keyboard shortcuts, and menu items for SyncTeX-related things.
 */
function addSynctexCommands(
  app: JupyterFrontEnd,
  editorTracker: IEditorTracker,
  pdfTracker: IPDFJSTracker,
  serverSettings: ServerConnection.ISettings
): DisposableSet {
  const disposables = new DisposableSet();

  const hasPDFWidget = () => !!pdfTracker.currentWidget;
  const hasEditorWidget = () => !!editorTracker.currentWidget;

  // Add the command for the PDF-to-editor mapping.
  disposables.add(
    app.commands.addCommand(CommandIDs.synctexEdit, {
      execute: () => {
        // Get the pdf widget that had its contextMenu activated.
        const widget = pdfTracker.currentWidget;
        if (widget) {
          // Get the page number.
          const pos = widget.content.position;

          // Request the synctex position for the PDF
          return synctexEditRequest(
            widget.context.path,
            pos,
            serverSettings
          ).then((view: ISynctexViewOptions) => {
            if (!widget) {
              return;
            }
            // Find the right editor widget.
            const baseName = PathExt.basename(widget.context.path, '.pdf');
            const dirName = PathExt.dirname(widget.context.path);
            const texFilePath = PathExt.join(dirName, baseName + '.tex');
            const editorWidget = editorTracker.find(
              editor => editor.context.path === texFilePath
            );
            if (!editorWidget) {
              return;
            }
            // Scroll the editor.
            editorWidget.content.editor.setCursorPosition(view);
          });
        }
      },
      isEnabled: hasPDFWidget,
      isVisible: () => {
        const widget = pdfTracker.currentWidget;
        if (!widget) {
          return false;
        }
        const baseName = PathExt.basename(widget.context.path, '.pdf');
        const dirName = PathExt.dirname(widget.context.path);
        const texFilePath = PathExt.join(dirName, baseName + '.tex');
        return Private.previews.has(texFilePath);
      },
      label: 'Scroll Editor to Page'
    })
  );

  // Add the command for the editor-to-PDF mapping.
  disposables.add(
    app.commands.addCommand(CommandIDs.synctexView, {
      execute: () => {
        // Get the current widget that had its contextMenu activated.
        const widget = editorTracker.currentWidget;
        if (widget) {
          // Get the cursor position.
          let pos = widget.content.editor.getCursorPosition();
          // SyncTex uses one-based indexing.
          pos = { line: pos.line + 1, column: pos.column + 1 };

          // Request the synctex position for the PDF
          return synctexViewRequest(
            widget.context.path,
            pos,
            serverSettings
          ).then((edit: ISynctexEditOptions) => {
            if (!widget) {
              return;
            }
            // Find the right pdf widget.
            const baseName = PathExt.basename(widget.context.path, '.tex');
            const dirName = PathExt.dirname(widget.context.path);
            const pdfFilePath = PathExt.join(dirName, baseName + '.pdf');
            const pdfWidget = pdfTracker.find(
              pdf => pdf.context.path === pdfFilePath
            );
            if (!pdfWidget) {
              return;
            }
            // Scroll the pdf. SyncTex seems unreliable in the x coordinate,
            // so just use the other parts.
            pdfWidget.content.position = { ...edit, x: 0 };
          });
        }
      },
      isEnabled: hasEditorWidget,
      isVisible: () => {
        const widget = editorTracker.currentWidget;
        return !!widget && Private.previews.has(widget.context.path);
      },
      label: 'Scroll PDF to Cursor'
    })
  );

  // Add context menu items
  disposables.add(
    app.contextMenu.addItem({
      command: CommandIDs.synctexView,
      selector: '.jp-FileEditor'
    })
  );
  disposables.add(
    app.contextMenu.addItem({
      command: CommandIDs.synctexEdit,
      selector: '.jp-PDFJSContainer'
    })
  );

  // Add keybindings.
  disposables.add(
    app.commands.addKeyBinding({
      selector: '.jp-FileEditor',
      keys: ['Accel Shift X'],
      command: CommandIDs.synctexView
    })
  );
  disposables.add(
    app.commands.addKeyBinding({
      selector: '.jp-PDFJSContainer',
      keys: ['Accel Shift X'],
      command: CommandIDs.synctexEdit
    })
  );

  return disposables;
}

function addLatexMenu(
  app: JupyterFrontEnd,
  editorTracker: IEditorTracker,
  mainMenu: IMainMenu
): void {
  const constantMenu = new Menu({ commands: app.commands });
  constantMenu.title.label = 'Constants';

  const constants = new Map<string, string>();
  constants.set('Pi', '\\pi');
  constants.set('Euler–Mascheroni constant', '\\gamma');
  constants.set('Golden Ratio', '\\varphi');

  constants.forEach((value: string, key: string) => {
    const commandName = 'latex:' + key.replace(' ', '-').toLowerCase();
    app.commands.addCommand(commandName, {
      label: key,
      caption: value,
      execute: async args => {
        const widget = isLatexFile(editorTracker);
        if (widget) {
          const editor = widget.content.editor;
          if (editor.replaceSelection) {
            editor.replaceSelection(value);
          }
        }
      }
    });

    constantMenu.addItem({
      command: commandName,
      args: {}
    });
  });

  const symbolMenu = new Menu({ commands: app.commands });
  symbolMenu.title.label = 'Symbols';

  const symbols = new Map<string, string>();
  // Less than symbols
  symbols.set('Not Less Than', '\\nless');
  symbols.set('Less Than or Equal', '\\leq');
  symbols.set('Not Less Than or Equal', '\\nleq');
  // Greater than symbols
  symbols.set('Not Greater Than', '\\ngtr');
  symbols.set('Greater Than or Equal', '\\geq');
  symbols.set('Not Greater Than or Equal', '\\ngeq');
  // Subset
  symbols.set('Proper Subset', '\\subset');
  symbols.set('Not Proper Subset', '\\not\\subset');
  symbols.set('Subset', '\\subseteq');
  symbols.set('Not Subset', '\\nsubseteq');
  // Superset
  symbols.set('Proper Superset', '\\supset');
  symbols.set('Not Proper Superset', '\\not\\supset');
  symbols.set('Superset', '\\supseteq');
  symbols.set('Not Superset', '\\nsupseteq');
  // Additional Set Notation
  symbols.set('Member Of', '\\in');
  symbols.set('Not Member Of', '\\notin');
  symbols.set('Has Member', '\\ni');
  symbols.set('Union', '\\cup');
  symbols.set('Intersection', '\\cap');
  // Logic
  symbols.set('There Exists', '\\ni');
  symbols.set('For All', '\\ni');
  symbols.set('Logical Not', '\\neg');
  symbols.set('Logical And', '\\land');
  symbols.set('Logical Or', '\\lor');

  symbols.forEach((value: string, key: string) => {
    const commandName = 'latex:' + key.replace(' ', '-').toLowerCase();
    app.commands.addCommand(commandName, {
      label: key,
      caption: value,
      execute: async args => {
        const widget = isLatexFile(editorTracker);
        if (widget) {
          const editor = widget.content.editor;
          if (editor.replaceSelection) {
            editor.replaceSelection(value);
          }
        }
      }
    });

    symbolMenu.addItem({
      command: commandName,
      args: {}
    });
  });

  app.commands.addCommand('latex:create-table', {
    label: 'Create Table',
    caption: 'Open a window to create a LaTeX table',
    execute: async args => {
      const rowResult = await InputDialog.getNumber({
        title: 'How many rows?'
      });
      if (rowResult.button.accept) {
        const colResult = await InputDialog.getNumber({
          title: 'How many columns?'
        });
        if (colResult.button.accept) {
          const widget = isLatexFile(editorTracker);
          if (widget) {
            const editor = widget.content.editor;
            if (editor.replaceSelection) {
              if (rowResult.value && colResult.value) {
                editor.replaceSelection(
                  generateTable(rowResult.value, colResult.value)
                );
              }
            }
          }
        }
      }
    }
  });

  const menu = new Menu({ commands: app.commands });
  menu.title.label = 'LaTeX';
  menu.addItem({
    submenu: constantMenu,
    type: 'submenu',
    args: {}
  });
  menu.addItem({
    submenu: symbolMenu,
    type: 'submenu',
    args: {}
  });

  menu.addItem({
    type: 'command',
    command: 'latex:create-table'
  });

  mainMenu.addMenu(menu, true, { rank: 100 });
}

function generateTable(rowNum: number, colNum: number): string {
  const columnConfig = 'c|';

  let rowText = '';
  for (let i = 1; i <= rowNum * colNum; i++) {
    if (i % colNum === 0) {
      rowText += `cell${i} \\\\`;
      if (i !== rowNum * colNum) {
        rowText += '\n\\hline\n';
      }
    } else {
      rowText += `cell${i} & `;
    }
  }

  return `\\begin{center}
          \\begin{tabular}{ |${columnConfig.repeat(colNum)} } 
          \\hline
          ${rowText}
          \\hline
          \\end{tabular}
          \\end{center}`.replace(/^ +/gm, '');
}

/**
 * The list of file types for pdfs.
 */
const FILE_TYPES = ['PDF'];

/**
 * The name of the factory that creates pdf widgets.
 */
const FACTORY = 'PDFJS';
const FACTORY_EDITOR = 'Editor';
const LAUNCHER_CATEGORY = 'Other';
const PALETTE_CATEGORY = 'LaTeX Editor';

/**
 * The pdf file handler extension.
 */
const pdfjsPlugin: JupyterFrontEndPlugin<IPDFJSTracker> = {
  activate: activatePDFJS,
  id: '@jupyterlab/pdfjs-extension:plugin',
  requires: [ILayoutRestorer],
  provides: IPDFJSTracker,
  autoStart: true
};

function activatePDFJS(
  app: JupyterFrontEnd,
  restorer: ILayoutRestorer
): IPDFJSTracker {
  const namespace = 'pdfjs-widget';
  const factory = new PDFJSViewerFactory({
    name: FACTORY,
    modelName: 'base64',
    fileTypes: FILE_TYPES,
    readOnly: true
  });
  const tracker = new WidgetTracker<IDocumentWidget<PDFJSViewer>>({
    namespace
  });

  // Handle state restoration.
  restorer.restore(tracker, {
    command: 'docmanager:open',
    args: widget => ({ path: widget.context.path, factory: FACTORY }),
    name: widget => widget.context.path
  });

  app.docRegistry.addWidgetFactory(factory);

  factory.widgetCreated.connect((sender, widget) => {
    // Notify the instance tracker if restore data needs to update.
    widget.context.pathChanged.connect(() => {
      tracker.save(widget);
    });
    tracker.add(widget);

    const types = app.docRegistry.getFileTypesForPath(widget.context.path);

    if (types.length > 0) {
      widget.title.iconClass = types[0].iconClass || '';
      widget.title.iconLabel = types[0].iconLabel || '';
    }
  });

  return tracker;
}

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [latexPlugin, pdfjsPlugin];
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
  export const previews = new Set<string>();

  /**
   * Create an error panel widget.
   */
  export function createErrorPanel(): ErrorPanel {
    const errorPanel = new ErrorPanel();
    errorPanel.id = `latex-error-${++id}`;
    errorPanel.title.label = 'LaTeX Error';
    errorPanel.title.closable = true;
    return errorPanel;
  }
}
