// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Message } from '@lumino/messaging';

import { Widget } from '@lumino/widgets';

import * as React from 'react';
import * as ReactDOM from 'react-dom';

const LATEX_ERROR_PANEL = 'jp-LatexErrorPanel';
const LATEX_ERROR_CONTAINER = 'jp-LatexErrorContainer';

/**
 * A widget which hosts the error logs from LaTeX
 * when document compilation fails.
 */
export class ErrorPanel extends Widget {
  /**
   * Construct the error panel.
   */
  constructor() {
    super();
    this.addClass(LATEX_ERROR_PANEL);
  }

  set text(value: string) {
    ReactDOM.render(<LatexError text={value} />, this.node, () => {
      this.update();
    });
  }

  /**
   * Handle an update request.
   */
  protected onUpdateRequest(msg: Message): void {
    const el = this.node.children[0];
    el.scrollTop = el.scrollHeight;
  }

  /**
   * Handle a close request.
   */
  protected onCloseRequest(msg: Message): void {
    this.dispose();
  }
}

export interface ILatexProps {
  text: string;
}

export class LatexError extends React.Component<ILatexProps, {}> {
  render() {
    return (
      <pre className={LATEX_ERROR_CONTAINER}>
        <code>{this.props.text}</code>
      </pre>
    );
  }
}
