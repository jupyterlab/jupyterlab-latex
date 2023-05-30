import { LabIcon } from '@jupyterlab/ui-components';

import downloadSvg from '../../style/icons/download.svg';
import fitSvg from '../../style/icons/fit.svg';
import nextSvg from '../../style/icons/next.svg';
import previousSvg from '../../style/icons/previous.svg';
import zoomInSvg from '../../style/icons/zoom_in.svg';
import zoomOutSvg from '../../style/icons/zoom_out.svg';

export const downloadIcon = new LabIcon({
  name: 'latex:download',
  svgstr: downloadSvg
});
export const fitIcon = new LabIcon({
  name: 'latex:fit',
  svgstr: fitSvg
});
export const nextIcon = new LabIcon({
  name: 'latex:next',
  svgstr: nextSvg
});
export const previousIcon = new LabIcon({
  name: 'latex:previous',
  svgstr: previousSvg
});
export const zoomInIcon = new LabIcon({
  name: 'latex:zoom-in',
  svgstr: zoomInSvg
});
export const zoomOutIcon = new LabIcon({
  name: 'latex:zoom-out',
  svgstr: zoomOutSvg
});
