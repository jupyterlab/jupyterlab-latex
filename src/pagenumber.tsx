import { ReactWidget } from '@jupyterlab/apputils';

import { PDFJSViewer } from './pdf';

import * as React from 'react';

/**
 * Page number React component.
 */
class PageNumberComponent extends React.Component<
  PageNumberComponent.IProps,
  PageNumberComponent.IState
> {
  public state: PageNumberComponent.IState = {
    currentPageNumber: 0,
    pagesCount: 0,
    userInput: null
  };

  /**
   * Start listening PDF viewer events.
   */
  componentDidMount() {
    this.props.widget.ready.then(() => {
      // Viewer will be available after the `ready` promise resolves.
      const { eventBus } = this.props.widget.viewer;
      eventBus.on('firstpage', this.handlePageDataChange);
      eventBus.on('pagechanging', this.handlePageDataChange);
      eventBus.on('pagelabels', this.handlePageDataChange);
      this.handlePageDataChange();
    });
  }

  /**
   * Stop listening PDF viewer events.
   */
  componentWillUnmount() {
    this.props.widget.ready.then(() => {
      // Viewer will be available after the `ready` promise resolves.
      const { eventBus } = this.props.widget.viewer;
      eventBus.off('firstpage', this.handlePageDataChange);
      eventBus.off('pagechanging', this.handlePageDataChange);
      eventBus.off('pagelabels', this.handlePageDataChange);
    });
  }

  /**
   * If user modifies the input value, store that text in `userInput` state
   * property.
   */
  handleChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const userInput = evt.target.value;
    this.setState({ userInput });
  };

  /**
   * Handle input element focus.
   */
  handleFocus = (evt: React.FocusEvent<HTMLInputElement>) => {
    evt.target.select();
  };

  /**
   * When the input element loses focus, change current page according to the
   * input value.
   */
  handleBlur = (evt: React.FocusEvent<HTMLInputElement>) => {
    const { value } = evt.target;
    this.setCurrentPage(value);
  };

  /**
   * If `Enter` key is pressed, change current page according to the input
   * value.
   */
  handleKeyDown = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    if (evt.key === 'Enter') {
      const { value } = evt.target as HTMLInputElement;
      this.setCurrentPage(value);
    }
  };

  /**
   * Update the state when page data change.
   */
  handlePageDataChange = () => {
    const { widget } = this.props;
    if (!widget.viewer) {
      return;
    }
    const { currentPageLabel, currentPageNumber, pagesCount } = widget.viewer;

    this.setState({
      currentPageLabel,
      currentPageNumber,
      pagesCount,
      userInput: null
    });
  };

  /**
   * Change current page.
   */
  setCurrentPage(pageLabel: string) {
    const { widget } = this.props;
    if (!widget.viewer) {
      return;
    }
    widget.viewer.currentPageLabel = pageLabel;
    // Reset user input.
    this.setState({ userInput: null });
  }

  /**
   * Render page number widget.
   */
  render() {
    const { currentPageLabel, currentPageNumber, pagesCount, userInput } =
      this.state;
    const text = currentPageLabel
      ? ` (${currentPageNumber} of ${pagesCount})`
      : ` of ${pagesCount}`;
    const value =
      userInput !== null
        ? userInput
        : currentPageLabel || currentPageNumber.toString();

    return (
      <div className="jp-PDFJSPageNumber">
        <span>
          <input
            value={value}
            onBlur={this.handleBlur}
            onChange={this.handleChange}
            onFocus={this.handleFocus}
            onKeyDown={this.handleKeyDown}
          />
          <span>{text}</span>
        </span>
      </div>
    );
  }
}

/**
 * A namespace for PageNumberComponent statics.
 */
export namespace PageNumberComponent {
  /**
   * React properties for page number component.
   */
  export interface IProps {
    /**
     * The PDF viewer.
     */
    widget: PDFJSViewer;
  }

  /**
   * React state for page number component.
   */
  export interface IState {
    /**
     * The label of the current page.
     */
    currentPageLabel?: string;

    /**
     * The index of the current page in the document.
     */
    currentPageNumber: number;

    /**
     * The number of pages of the document.
     */
    pagesCount: number;

    /**
     * The string inserted by user in the input element.
     */
    userInput: string | null;
  }
}

/**
 * Phosphor Widget version of PageNumberComponent.
 */
export class PageNumberWidget extends ReactWidget {
  constructor(props: PageNumberComponent.IProps) {
    super();
    this._props = props;
  }

  render() {
    return <PageNumberComponent {...this._props} />;
  }

  private _props: PageNumberComponent.IProps;
}
