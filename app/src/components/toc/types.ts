export type TocItem = {
  id: string;
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  occurrence: number;
  el: HTMLElement;
};

export type TocMarker = {
  item: TocItem;
  index: number;
  topRatio: number;
  displayTopRatio: number;
  spanRatio: number;
};

export type TocLayout = {
  panelLeftPx: number;
  panelWidthPx: number;
  panelOffsetPx: number;
  railHeightPx: number;
  compactAtRest: boolean;
  showExpandedByDefault: boolean;
};
