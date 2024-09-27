// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Message } from '@lumino/messaging';

import { Widget } from '@lumino/widgets';

import { HTMLSelect } from '@jupyterlab/ui-components';

import * as React from 'react';
import * as ReactDOM from 'react-dom';

const LATEX_ERROR_PANEL = 'jp-LatexErrorPanel';
const LATEX_ERROR_CONTAINER = 'jp-LatexErrorContainer';

const TOOLBAR_CELLTYPE_CLASS = 'jp-Notebook-toolbarCellType';
const TOOLBAR_CELLTYPE_DROPDOWN_CLASS = 'jp-Notebook-toolbarCellTypeDropdown';

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
    this.addClass(TOOLBAR_CELLTYPE_CLASS);
  }

  set text(value: string) {
    ReactDOM.render(<LatexError text={value} node={this} />, this.node, () => {
      this.update();
    });
  }

  /**
   * Handle an update request.
   */
  protected onUpdateRequest(msg: Message): void {
    const el = this.node.children[2].children[0];
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
  node: ErrorPanel;
}

export class LatexError extends React.Component<ILatexProps, {}> {
  selectedValue: string | undefined;
  fullMessage: string;
  errorOnlyMessage: string;
  displayedMessage: string;

  constructor(props: Readonly<ILatexProps>) {
    super(props);
    let messages = JSON.parse(props.text);
    this.fullMessage = messages.fullMessage;
    this.errorOnlyMessage = messages.errorOnlyMessage;
    this.displayedMessage = this.errorOnlyMessage;
  }

  handleChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    this.selectedValue = event.target.value;
    if (event.target.value === 'Filtered') {
      this.displayedMessage = this.errorOnlyMessage;
    } else if (event.target.value === 'Unfiltered') {
      this.displayedMessage = this.fullMessage;
    } else if (event.target.value === 'JSON') {
      this.displayedMessage = this.props.text;
    }

    /**
     * Force ErrorPanel to rerender.
     */
    this.setState({});
    this.props.node.update();
  };

  render() {
    return (
      <>
        <label style={{ marginLeft: '1em', color: 'black' }}>Log Level:</label>

        <div style={{ display: 'inline-block', position: 'relative' }}>
          <HTMLSelect
            className={TOOLBAR_CELLTYPE_DROPDOWN_CLASS}
            onChange={this.handleChange}
            aria-label="Log level"
            value={this.selectedValue}
            options={['Filtered', 'Unfiltered', 'JSON']}
          />
        </div>

        <div style={{ height: 'calc(100% - 3em)' }}>
          <pre className={LATEX_ERROR_CONTAINER}>
            <code>{this.displayedMessage}</code>
          </pre>
        </div>
      </>
    );
  }
}
