# 0003 - Enlarge analysis triangle diagrams

## Request

- Make the triangle diagrams in the analysis dashboard about 1.7x larger.
- After the work, add a project log and push to GitHub.

## Plan

1. Increase the rendered SVG area instead of changing the triangle geometry.
2. Stop placing two diagrams side-by-side on wide screens, because the two-column layout made each diagram look small.
3. Slightly increase card padding and title size so the larger diagram looks balanced.
4. Run lint/build.
5. Commit and push to `main`.

## Implementation

- `app/analysis/page.tsx`
  - Changed `TriangleDiagram` card padding from `p-4` to `p-6`.
  - Increased stock title size to `text-lg`.
  - Added `min-h-[760px]` to the SVG while keeping `w-full`.
  - Changed diagram grid from `grid-cols-1 xl:grid-cols-2` to a single-column layout.

## Modified Files

- `app/analysis/page.tsx`
- `project-logs/0003-enlarge-analysis-triangle-diagrams.md`

## Notes For Next Agent

- The triangle geometry remains in the same `viewBox="0 0 720 620"` coordinate system.
- The visual enlargement is achieved by giving each diagram more page width and a larger minimum rendered height.
- If the user later wants multiple diagrams side-by-side again, consider adding a display density toggle rather than reverting to the old two-column layout.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
