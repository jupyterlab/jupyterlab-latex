// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Widget
} from '@phosphor/widgets';


/**
 * A widget which hosts the error logs from LaTeX
 * when document compilation fails.
 */
export
class ErrorPanel extends Widget {
  /**
   * Construct the error panel.
   */
  constructor() {
    super();
    this.addClass('jp-LatexErrorPanel');
    this._errorText = document.createElement('pre');
    let container = document.createElement('div');
    container.className = 'jp-LatexErrorContainer';
    container.appendChild(this._errorText);
    this.node.appendChild(container);
  }

  /**
   * Set the inner text content of the panel.
   */
  set text(value: string) {
    this._errorText.textContent = value;
  }

  private _errorText: HTMLElement;
}
