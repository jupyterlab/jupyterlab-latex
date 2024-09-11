// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { PromiseDelegate } from '@lumino/coreutils';

import { ElementExt } from '@lumino/domutils';

import { Message } from '@lumino/messaging';

import { Widget } from '@lumino/widgets';

import { Toolbar, ToolbarButton } from '@jupyterlab/apputils';

import { PathExt } from '@jupyterlab/coreutils';

import { ISignal, Signal } from '@lumino/signaling';

import {
  ABCWidgetFactory,
  DocumentRegistry,
  DocumentWidget,
  IDocumentWidget
} from '@jupyterlab/docregistry';

import '../style/index.css';

import {
  downloadIcon,
  fitIcon,
  nextIcon,
  previousIcon,
  zoomInIcon,
  zoomOutIcon
} from './style/icons';

import { PageNumberWidget } from './pagenumber';

/**
 * The MIME type for PDF.
 */
export const MIME_TYPE = 'application/pdf';

/**
 * The CSS class for the viewer defined by PDFJS.
 */
export const PDF_CLASS = 'pdfViewer';

/**
 * The CSS class for our PDF container.
 */
export const PDF_CONTAINER_CLASS = 'jp-PDFJSContainer';

/**
 * A boolean indicating whether the platform is Mac.
 */
const IS_MAC = !!navigator.platform.match(/Mac/i);

/**
 * The step in scaling factors for zooming the PDF viewer.
 */
export const SCALE_DELTA = 1.1;

/**
 * The maximum scaling factor for zooming the PDF viewer.
 */
export const MAX_SCALE = 10.0;

/**
 * The minimum scaling factor for zooming the PDF viewer.
 */
export const MIN_SCALE = 0.25;

/**
 * Include a margin for scrolling the PDF.
 */
export const MARGIN = 72; // 72 dpi

/**
 * A class for rendering a PDF document.
 */
export class PDFJSViewer extends Widget {
  constructor(context: DocumentRegistry.Context) {
    super({ node: Private.createNode() });
    this._pdfjsLoaded = Private.ensurePDFJS().then(pdfjsLib => {
      const eventBus = new pdfjsLib.EventBus();
      this._getDocument = pdfjsLib.getDocument;
      this._viewer = new pdfjsLib.PDFViewer({
        container: this.node,
        eventBus: eventBus
      });
    });

    this.context = context;
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
   * The underlying PDFJS viewer/
   */
  get viewer(): any | undefined {
    return this._viewer;
  }

  /**
   * A promise that resolves when the pdf viewer is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  /**
   * Get the scroll position.
   */
  get position(): PDFJSViewer.IPosition {
    const page = this.viewer ? this.viewer.currentPageNumber : 0;
    return {
      page,
      x: 0,
      y: 0
    };
  }

  /**
   * Set the scroll position.
   */
  set position(pos: PDFJSViewer.IPosition) {
    if (!this._viewer) {
      return;
    }
    // Clamp the page number.
    const pageNumber = Math.max(
      Math.min(pos.page, this._viewer.pagesCount + 1),
      1
    );
    const page = this._viewer.getPageView(pageNumber - 1);

    // Flip the y position for PDFJS, including a margin so
    // that it is not at the exact top of the screen.
    const yMax = page.viewport.viewBox[3];
    const yPos = Math.max(Math.min(yMax - (pos.y - MARGIN), yMax), 0);

    // Scroll page into view using a very undocumented
    // set of options. This particular set scrolls it to
    // an x,y position on a given page, with a given scale value.
    this._viewer.scrollPageIntoView({
      pageNumber,
      destArray: [
        pageNumber,
        { name: 'XYZ' },
        pos.x,
        yPos,
        this._viewer.currentScaleValue
      ]
    });
  }

  /**
   * Dispose of the resources held by the pdf widget.
   */
  dispose() {
    try {
      URL.revokeObjectURL(this._objectUrl);
    } catch (error) {
      /* no-op */
    }
    super.dispose();
  }

  get positionRequested(): ISignal<this, PDFJSViewer.IPosition> {
    return this._positionRequested;
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
  private async _render(): Promise<void> {
    await this._pdfjsLoaded;
    return new Promise<void>(resolve => {
      if (!this._viewer) {
        return;
      }
      const data = this.context.model.toString();
      // If there is no data, do nothing.
      if (!data) {
        resolve(void 0);
      }
      const blob = Private.b64toBlob(data, MIME_TYPE);

      const oldDocument = this._pdfDocument;
      const oldUrl = this._objectUrl;
      this._objectUrl = URL.createObjectURL(blob);

      let scale: number | string = 'page-width';
      let scrollTop = 0;

      // Try to keep the scale and scroll position.
      if (this._hasRendered && this.isVisible) {
        scale = this._viewer.currentScale || scale;
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
          } catch (error) {
            /* no-op */
          }
        }
      };

      this._getDocument(this._objectUrl)
        .promise.then((pdfDocument: any) => {
          this._pdfDocument = pdfDocument;
          this._viewer!.setDocument(pdfDocument);
          pdfDocument.getPageLabels().then((labels: string[]) => {
            if (!labels) {
              return;
            }
            let i = 0;
            const numLabels = labels.length;
            if (numLabels !== this._viewer!.pagesCount) {
              console.error(
                'The number of Page Labels does not match ' +
                  'the number of pages in the document.'
              );
              return;
            }
            // Ignore page labels that correspond to standard page numbering.
            while (i < numLabels && labels[i] === (i + 1).toString()) {
              i++;
            }
            if (i === numLabels) {
              return;
            }

            this._viewer!.setPageLabels(labels);
            this._viewer!.eventBus.dispatch('pagelabels');
          });
          this._viewer!.firstPagePromise.then(() => {
            if (this.isVisible) {
              this._viewer!.currentScaleValue = scale;
            }
            this._hasRendered = true;
            this._viewer!.eventBus.dispatch('firstpage');
            resolve(void 0);
          });
          this._viewer!.pagesPromise.then(() => {
            if (this.isVisible) {
              this.node.scrollTop = scrollTop;
            }
            cleanup();
          });
        })
        .catch(cleanup);
    });
  }

  /**
   * Handle DOM events for the widget.
   */
  handleEvent(event: Event): void {
    if (!this.viewer) {
      return;
    }
    switch (event.type) {
      case 'click':
        this._handleClick(event as MouseEvent);
        break;
      default:
        break;
    }
  }

  private _handleClick(evt: MouseEvent): void {
    // If it is a normal click, return without doing anything.
    const shiftAccel = (evt: MouseEvent): boolean => {
      return evt.shiftKey
        ? (IS_MAC && evt.metaKey) || (!IS_MAC && evt.ctrlKey)
        : false;
    };
    if (!shiftAccel(evt)) {
      return;
    }

    // Get the page position of the click.
    const pos = this._clientToPDFPosition(evt.clientX, evt.clientY);

    // If the click was not on a page, do nothing.
    if (!pos) {
      return;
    }
    // Emit the `positionRequested` signal.
    this._positionRequested.emit(pos);
  }

  private _clientToPDFPosition(
    x: number,
    y: number
  ): PDFJSViewer.IPosition | undefined {
    if (!this._viewer) {
      return undefined;
    }
    let page: any;
    let pageNumber = 0;
    for (; pageNumber < this._viewer.pagesCount; pageNumber++) {
      const pageView = this._viewer.getPageView(pageNumber);
      // If the page is not rendered (as happens when it is
      // scrolled out of view), then the textLayer div doesn't
      // exist, and we can safely skip it.
      if (!pageView.textLayer) {
        continue;
      }
      const pageDiv = pageView.textLayer.textLayerDiv;
      if (ElementExt.hitTest(pageDiv, x, y)) {
        page = pageView;
        break;
      }
    }
    if (!page) {
      return;
    }
    const pageDiv = page.textLayer.textLayerDiv;
    const boundingRect = pageDiv.getBoundingClientRect();
    const localX = x - boundingRect.left;
    const localY = y - boundingRect.top;
    const viewport = page.viewport.clone({ dontFlip: true });
    const [pdfX, pdfY] = viewport.convertToPdfPoint(localX, localY);
    return {
      page: pageNumber + 1,
      x: pdfX,
      y: pdfY
    } as PDFJSViewer.IPosition;
  }

  /**
   * Handle `after-attach` messages for the widget.
   */
  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this.node.addEventListener('click', this);
  }

  /**
   * Handle `before-detach` messages for the widget.
   */
  protected onBeforeDetach(msg: Message): void {
    const node = this.node;
    node.removeEventListener('click', this);
  }

  /**
   * Fit the PDF to the widget width.
   */
  fit(): void {
    if (!this._viewer) {
      return;
    }
    if (this.isVisible) {
      this._viewer.currentScaleValue = 'page-width';
    }
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

  private _pdfjsLoaded: Promise<any>;
  private _getDocument: any;
  private _viewer: { [x: string]: any } | undefined;
  private _ready = new PromiseDelegate<void>();
  private _objectUrl = '';
  private _pdfDocument: any;
  private _positionRequested = new Signal<this, PDFJSViewer.IPosition>(this);
  private _hasRendered = false;
}

/**
 * A document widget for PDFJS content widgets.
 */
export class PDFJSDocumentWidget
  extends DocumentWidget<PDFJSViewer>
  implements IDocumentWidget<PDFJSViewer>
{
  constructor(context: DocumentRegistry.Context) {
    const content = new PDFJSViewer(context);
    const toolbar = Private.createToolbar(content);
    const reveal = content.ready;
    super({ content, context, reveal, toolbar });
  }
}

/**
 * A widget factory for images.
 */
export class PDFJSViewerFactory extends ABCWidgetFactory<
  IDocumentWidget<PDFJSViewer>,
  DocumentRegistry.IModel
> {
  /**
   * Create a new widget given a context.
   */
  protected createNewWidget(
    context: DocumentRegistry.IContext<DocumentRegistry.IModel>
  ): IDocumentWidget<PDFJSViewer> {
    return new PDFJSDocumentWidget(context);
  }
}

/**
 * A namespace for PDFJSViewer statics.
 */
export namespace PDFJSViewer {
  /**
   * The options for a SyncTeX edit command,
   * mapping the pdf position to an editor position.
   */
  export interface IPosition {
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
  export function createNode(): HTMLElement {
    const node = document.createElement('div');
    node.className = PDF_CONTAINER_CLASS;
    const pdf = document.createElement('div');
    pdf.className = PDF_CLASS;
    node.appendChild(pdf);
    node.tabIndex = -1;
    return node;
  }

  /**
   * Create the toolbar for the PDF viewer.
   */
  export function createToolbar(content: PDFJSViewer): Toolbar<ToolbarButton> {
    const toolbar = new Toolbar();

    toolbar.addClass('jp-Toolbar');
    toolbar.addClass('jp-PDFJS-toolbar');

    toolbar.addItem(
      'previous',
      new ToolbarButton({
        icon: previousIcon,
        onClick: () => {
          if (!content.viewer) {
            return;
          }
          content.viewer.currentPageNumber = Math.max(
            content.viewer.currentPageNumber - 1,
            1
          );
        },
        tooltip: 'Previous Page'
      })
    );
    toolbar.addItem(
      'next',
      new ToolbarButton({
        icon: nextIcon,
        onClick: () => {
          if (!content.viewer) {
            return;
          }
          content.viewer.currentPageNumber = Math.min(
            content.viewer.currentPageNumber + 1,
            content.viewer.pagesCount
          );
        },
        tooltip: 'Next Page'
      })
    );

    toolbar.addItem('PageNumber', new PageNumberWidget({ widget: content }));

    toolbar.addItem('spacer', Toolbar.createSpacerItem());

    toolbar.addItem(
      'zoomOut',
      new ToolbarButton({
        icon: zoomOutIcon,
        onClick: () => {
          if (!content.viewer) {
            return;
          }
          let newScale = content.viewer.currentScale;

          newScale = (newScale / SCALE_DELTA).toFixed(2);
          newScale = Math.floor(newScale * 10) / 10;
          newScale = Math.max(MIN_SCALE, newScale);

          content.viewer.currentScale = newScale;
        },
        tooltip: 'Zoom Out'
      })
    );
    toolbar.addItem(
      'zoomIn',
      new ToolbarButton({
        icon: zoomInIcon,
        onClick: () => {
          if (!content.viewer) {
            return;
          }
          let newScale = content.viewer.currentScale;

          newScale = (newScale * SCALE_DELTA).toFixed(2);
          newScale = Math.ceil(newScale * 10) / 10;
          newScale = Math.min(MAX_SCALE, newScale);

          content.viewer.currentScale = newScale;
        },
        tooltip: 'Zoom In'
      })
    );

    toolbar.addItem(
      'fit',
      new ToolbarButton({
        icon: fitIcon,
        onClick: () => {
          if (!content.viewer) {
            return;
          }
          content.viewer.currentScaleValue = 'page-width';
        },
        tooltip: 'Fit to Page Width'
      })
    );

    toolbar.addItem(
      'download',
      new ToolbarButton({
        icon: downloadIcon,
        onClick: () => {
          if (!content.viewer) {
            return;
          }
          content.context.download();
        },
        tooltip: 'Download'
      })
    );

    return toolbar;
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
  export function b64toBlob(
    b64Data: string,
    contentType = '',
    sliceSize = 512
  ): Blob {
    const byteCharacters = atob(b64Data);
    const byteArrays: Uint8Array[] = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);

      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: contentType });
    return blob;
  }

  export async function ensurePDFJS(): Promise<any> {
    let lib, viewer;
    try {
      lib = await import('pdfjs-dist/build/pdf.min.js' as any);
      await import('pdfjs-dist/build/pdf.worker.entry' as any);
      viewer = await import('pdfjs-dist/web/pdf_viewer' as any);
      await import('pdfjs-dist/web/pdf_viewer.css' as any);
    } catch (err) {
      console.error(err);
    }

    return {
      ...(({ getDocument }) => ({ getDocument }))(lib),
      ...(({ PDFViewer, EventBus }) => ({ PDFViewer, EventBus }))(viewer)
    };
  }
}
