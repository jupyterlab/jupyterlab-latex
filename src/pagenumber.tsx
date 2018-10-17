import { ReactElementWidget } from '@jupyterlab/apputils';

import * as React from 'react';

interface IProps {
  viewer: any;
}

interface IState {
  currentPageLabel?: string;
  currentPageNumber: number;
  pagesCount: number;
  hasLabels: boolean;
}

class PageNumberComponent extends React.Component<IProps, IState> {
  public state: IState = {
    currentPageNumber: 0,
    hasLabels: false,
    pagesCount: 0
  };

  componentDidMount() {
    const { viewer } = this.props;
    viewer.eventBus.on('pagechanging', this.handlePageChanging);
    viewer.eventBus.on('pagelabels', this.handlePageLabels);
    viewer.eventBus.on('firstpage', this.handleFirstPage);
  }

  componentWillUnmount() {
    const { viewer } = this.props;
    viewer.eventBus.off('pagechanging', this.handlePageChanging);
    viewer.eventBus.off('pagelabels', this.handlePageLabels);
    viewer.eventBus.off('firstpage', this.handleFirstPage);
  }

  handleFirstPage = () => {
    const { viewer } = this.props;
    const { currentPageLabel, currentPageNumber, pagesCount } = viewer;
    const hasLabels = currentPageLabel ? true : false;

    this.setState({
      currentPageLabel,
      currentPageNumber,
      hasLabels,
      pagesCount
    });
  };

  handlePageLabels = () => {
    const { viewer } = this.props;
    const { currentPageLabel } = viewer;
    this.setState({ currentPageLabel, hasLabels: true });
  };

  handlePageChanging = (evt: any) =>
    this.setState({
      currentPageLabel: evt.pageLabel,
      currentPageNumber: evt.pageNumber
    });

  handleChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = evt.target;
    if (this.state.hasLabels) {
      this.setState({ currentPageLabel: value });
    } else {
      this.setState({ currentPageNumber: parseInt(value) });
    }
  };

  handleFocus = (evt: React.FocusEvent<HTMLInputElement>) => {
    evt.target.select();
  };

  handleBlur = (evt: React.FocusEvent<HTMLInputElement>) => {
    const { value } = evt.target;
    this.setCurrentPage(value);
  };

  handleKeyDown = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    if (evt.key === 'Enter') {
      const { value } = evt.target as HTMLInputElement;
      this.setCurrentPage(value);
    }
  };

  setCurrentPage(pageLabel: string) {
    const { viewer } = this.props;
    viewer.currentPageLabel = pageLabel;

    // Ensure that the page number input displays the correct value, even if the
    // value entered by the user was invalid (e.g. a floating point number).
    if (
      pageLabel !== viewer.currentPageNumber.toString() &&
      pageLabel !== viewer.currentPageLabel
    ) {
      const { currentPageLabel, currentPageNumber } = viewer;
      this.setState({ currentPageLabel, currentPageNumber });
    }
  }

  render() {
    const {
      currentPageLabel,
      currentPageNumber,
      hasLabels,
      pagesCount
    } = this.state;
    const value = hasLabels ? currentPageLabel : currentPageNumber;
    const text = hasLabels
      ? ` (${currentPageNumber} of ${pagesCount})`
      : ` of ${pagesCount}`;
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
 * Phosphor Widget version of PageNumberComponent.
 */
export class PageNumberWidget extends ReactElementWidget {
  constructor(props: IProps) {
    super(<PageNumberComponent {...props} />);
  }
}
