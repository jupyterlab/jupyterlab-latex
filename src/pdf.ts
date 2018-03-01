// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  PromiseDelegate
} from '@phosphor/coreutils';

import {
  Message
} from '@phosphor/messaging';

import {
  Widget
} from '@phosphor/widgets';

import {
  PathExt
} from '@jupyterlab/coreutils';

import {
  ABCWidgetFactory, DocumentRegistry
} from '@jupyterlab/docregistry';

import 'pdfjs-dist/webpack';
import 'pdfjs-dist/web/pdf_viewer';

import '../style/index.css';
import 'pdfjs-dist/web/pdf_viewer.css';


/**
 * The MIME type for PDF.
 */
export
const MIME_TYPE = 'application/pdf';

/**
 * The CSS class for the viewer defined by PDFJS.
 */
export
const PDF_CLASS = 'pdfViewer';

/**
 * The CSS class for our PDF container.
 */
export
const PDF_CONTAINER_CLASS = 'jp-PDFJSContainer';

/**
 * PDFJS adds a global object to the page called `PDFJS`.
 * Declare a reference to that.
 */
declare const PDFJS: any;

/**
 * A class for rendering a PDF document.
 */
export
class PDFJSViewer extends Widget implements DocumentRegistry.IReadyWidget {
  constructor(context: DocumentRegistry.Context) {
    super({ node: Private.createNode() });
    this.context = context;
    this._pdfViewer = new PDFJS.PDFViewer({
        container: this.node,
    });

    this._onTitleChanged();
    context.pathChanged.connect(this._onTitleChanged, this);

    context.ready.then(() => {
      if (this.isDisposed) {
        return;
      }
      this._render().then(() => {
        this._ready.resolve(void 0);
      });
      context.model.contentChanged.connect(this.update, this);
      context.fileChanged.connect(this.update, this);
    });
  }

  /**
   * The pdfjs widget's context.
   */
  readonly context: DocumentRegistry.Context;

  /**
   * A promise that resolves when the pdf viewer is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  /**
   * Set the scroll
   */
  setScroll(pos: PDFJSViewer.IPosition): void {
    console.log(pos);
    this._pdfViewer.scrollPageIntoView({
      pageNumber: pos.page
    });
  }

  /**
   * Dispose of the resources held by the pdf widget.
   */
  dispose() {
    try {
      URL.revokeObjectURL(this._objectUrl);
    } catch (error) { /* no-op */ }
    super.dispose();
  }

  /**
   * Handle a change to the title.
   */
  private _onTitleChanged(): void {
    this.title.label = PathExt.basename(this.context.localPath);
  }

  /**
   * Render PDF into this widget's node.
   */
  private _render(): Promise<void> {
    return new Promise<void>(resolve => {
      let data = this.context.model.toString();
      // If there is no data, do nothing.
      if (!data) {
        resolve (void 0);
      }
      const blob = Private.b64toBlob(data, MIME_TYPE);

      let oldDocument = this._pdfDocument;
      let oldUrl = this._objectUrl;
      this._objectUrl = URL.createObjectURL(blob);

      let scrollTop: number;

      // Try to keep the scroll position.
      if (this.isVisible) {
        scrollTop = this.node.scrollTop;
      }

      const cleanup = () => {
        // Release reference to any previous document.
        if (oldDocument) {
          oldDocument.destroy();
        }
        // Release reference to any previous object url.
        if (oldUrl) {
          try {
            URL.revokeObjectURL(oldUrl);
          } catch (error) { /* no-op */ }
        }
      };

      PDFJS.getDocument(this._objectUrl).then((pdfDocument: any) => {
        this._pdfDocument = pdfDocument;
        this._pdfViewer.setDocument(pdfDocument);
        this._pdfViewer.firstPagePromise.then(() => {
          resolve(void 0);
        });
        this._pdfViewer.pagesPromise.then(() => {
          if (this.isVisible) {
            this.node.scrollTop = scrollTop;
          }
          cleanup();
        });
      }).catch(cleanup);
    });
  }

  /**
   * Handle DOM events for the widget.
   */
  handleEvent(event: Event): void {
    if (!this._pdfViewer) {
      return;
    }
    switch (event.type) {
      case 'pagesinit':
        this._resize();
        break;
      default:
        break;
    }
  }

  /**
   * Handle `after-attach` messages for the widget.
   */
  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this.node.addEventListener('pagesinit', this);
  }

  /**
   * Handle `before-detach` messages for the widget.
   */
  protected onBeforeDetach(msg: Message): void {
    let node = this.node;
    node.removeEventListener('pagesinit', this, true);
  }

  /**
   * On resize, use the computed row and column sizes to resize the terminal.
   */
  protected onResize(msg: Widget.ResizeMessage): void {
    this._resize();
  }

  /**
   * Handle `update-request` messages for the widget.
   */
  protected onUpdateRequest(msg: Message): void {
    if (this.isDisposed || !this.context.isReady) {
      return;
    }
    this._render();
  }

  /**
   * Fit the PDF to the widget width.
   */
  private _resize(): void {
    if (this.isVisible) {
      this._pdfViewer.currentScaleValue = 'page-width';
    }
  }

  private _ready = new PromiseDelegate<void>();
  private _objectUrl = '';
  private _pdfViewer: any;
  private _pdfDocument: any;
}

/**
 * A widget factory for images.
 */
export
class PDFJSViewerFactory extends ABCWidgetFactory<PDFJSViewer, DocumentRegistry.IModel> {
  /**
   * Create a new widget given a context.
   */
  protected createNewWidget(context: DocumentRegistry.IContext<DocumentRegistry.IModel>): PDFJSViewer {
    return new PDFJSViewer(context);
  }
}

/**
 * A namespace for PDFJSViewer statics.
 */
export
namespace PDFJSViewer {
  /**
   * The options for a SyncTeX edit command,
   * mapping the pdf position to an editor position.
   */
  export
  interface IPosition {
    /**
     * The page of the pdf.
     */
    page: number;

    /**
     * The x-position on the page, in pts, where
     * the PDF is assumed to be 72dpi.
     */
    x: number;

    /**
     * The y-position on the page, in pts, where
     * the PDF is assumed to be 72dpi.
     */
    y: number;
  }
}

/**
 * A namespace for PDF widget private data.
 */
namespace Private {
  /**
   * Create the node for the PDF widget.
   */
  export
  function createNode(): HTMLElement {
    let node = document.createElement('div');
    node.className = PDF_CONTAINER_CLASS;
    let pdf = document.createElement('div');
    pdf.className = PDF_CLASS;
    node.appendChild(pdf);
    return node;
  }

  /**
   * Convert a base64 encoded string to a Blob object.
   * Modified from a snippet found here:
   * https://stackoverflow.com/questions/16245767/creating-a-blob-from-a-base64-string-in-javascript
   *
   * @param b64Data - The base64 encoded data.
   *
   * @param contentType - The mime type of the data.
   *
   * @param sliceSize - The size to chunk the data into for processing.
   *
   * @returns a Blob for the data.
   */
  export
  function b64toBlob(b64Data: string, contentType: string = '', sliceSize: number = 512): Blob {
    const byteCharacters = atob(b64Data);
    let byteArrays: Uint8Array[] = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      let slice = byteCharacters.slice(offset, offset + sliceSize);

      let byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      let byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    let blob = new Blob(byteArrays, {type: contentType});
    return blob;
  }
}
