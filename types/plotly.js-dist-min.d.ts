declare module "plotly.js-dist-min" {
  type PlotlyTrace = Record<string, unknown>;
  type PlotlyLayout = Record<string, unknown>;
  type PlotlyConfig = Record<string, unknown>;

  export function newPlot(
    root: HTMLElement,
    data: PlotlyTrace[],
    layout?: PlotlyLayout,
    config?: PlotlyConfig
  ): Promise<unknown>;

  export function purge(root: HTMLElement): void;
}
