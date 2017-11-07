// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Widget
} from '@phosphor/widgets';


export
class ErrorPanel extends Widget {
  constructor() {
    super();
    this._errorText = document.createElement('pre');
    this.node.appendChild(this._errorText);
  }

  set text(value: string) {
    this._errorText.textContent = value;
  }

  private _errorText: HTMLElement;
}
