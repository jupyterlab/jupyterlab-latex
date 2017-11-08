// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Widget
} from '@phosphor/widgets';


export
class ErrorPanel extends Widget {
  constructor() {
    super();
    this._errorText = document.createElement('code');
    const blah = document.createElement('pre');
    blah.style.cssText = 'height:100%;overflow:auto;margin:2em';
    this.node.appendChild(blah);
    blah.appendChild(this._errorText);
  }

  set text(value: string) {
    this._errorText.textContent = value;
  }

  private _errorText: HTMLElement;
}
