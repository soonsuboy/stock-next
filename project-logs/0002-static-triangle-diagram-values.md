# 0002 - Static triangle diagram with vertex and side values

## Request

- Change the analysis dashboard diagram to match the user's example image.
- The desired output is not a Plotly ternary scatter chart.
- Each selected stock should show a fixed triangle diagram:
  - Top vertex: market capitalization value
  - Left vertex: equity value
  - Right vertex: net income value
  - Left side: PBR value
  - Bottom side: ROE value
  - Right side: PER value

## Plan

1. Remove the Plotly-based ternary chart from `app/analysis/page.tsx`.
2. Keep the existing analysis data source and selection behavior.
3. Add a reusable `TriangleDiagram` component rendered with inline SVG.
4. For each selected valid stock, render one diagram card.
5. Keep the existing metrics summary table below the diagrams.
6. Update the explanation text to describe direct values instead of normalized point positions.

## Implementation

- `app/analysis/page.tsx`
  - Removed `dynamic`, `useRef`, and Plotly chart setup.
  - Removed `TernaryTrace` and normalized ternary coordinate mapping.
  - Added `TriangleDiagram`.
  - The SVG draws:
    - one filled triangle
    - top metric box for `시가총액`
    - left metric box for `자본총계`
    - right metric box for `당기순이익`
    - side labels and values for `PBR`, `ROE`, `PER`
  - Multiple selected stocks are shown in a responsive grid.
  - The explanation box now states that vertices show raw amounts and sides show ratio values.

## Modified Files

- `app/analysis/page.tsx`
- `project-logs/0002-static-triangle-diagram-values.md`

## Notes For Next Agent

- `types/plotly.js-dist-min.d.ts` still exists because the dependency remains in `package.json`; it is no longer used by `app/analysis/page.tsx`.
- If Plotly is fully removed later, also remove:
  - `plotly.js-dist-min` from `package.json`
  - `types/plotly.js-dist-min.d.ts`
  - related package-lock entries
- Current SVG dimensions use `viewBox="0 0 720 620"` and fixed internal coordinates.
- The diagram is per-stock, not a comparative multi-stock plot.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
