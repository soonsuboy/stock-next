# 0001 - Analysis triangle and project log process

## Request

- Update the analysis dashboard triangle diagram so that:
  - Top vertex = market capitalization (`market_cap`)
  - Left vertex = total equity (`equity`)
  - Right vertex = net income (`net_income`)
  - Left side label = PBR
  - Bottom side label = ROE
  - Right side label = PER
- Create a versioned project log folder so future requests record:
  - planning
  - implementation details
  - modified files
  - verification
  - enough context for another AI agent to continue the project

## Plan

1. Reuse the existing Plotly ternary chart instead of introducing another charting library.
2. Remap the ternary coordinates from `ROE/PBR/PER` values to normalized raw financial amounts:
   - `a` = market capitalization
   - `b` = equity
   - `c` = net income
3. Add chart annotations for the requested vertex and side labels.
4. Require all three raw values plus `PER/PBR/ROE` before enabling selection.
5. Update the chart explanation text so it matches the new diagram.
6. Create this `project-logs/` folder and use numbered markdown files for future work.

## Implementation

- `app/analysis/page.tsx`
  - Changed Plotly ternary axis titles:
    - `aaxis`: `시가총액`
    - `baxis`: `자본총계`
    - `caxis`: `당기순이익`
  - Added `layout.annotations` for:
    - top vertex `시가총액`
    - left vertex `자본총계`
    - right vertex `당기순이익`
    - left side `PBR`
    - bottom side `ROE`
    - right side `PER`
  - Changed chart title to `시가총액-자본총계-당기순이익 삼각형 분석`.
  - Changed each stock point to normalize raw amounts to a 100-sum ternary coordinate:
    - `a = market_cap / (market_cap + equity + net_income) * 100`
    - `b = equity / total * 100`
    - `c = net_income / total * 100`
  - Added rich hover text showing:
    - stock code/name
    - market cap
    - equity
    - net income
    - PBR
    - ROE
    - PER
  - Updated the selectable-data guard to require raw financial values as well as ratios.
  - Updated the explanation box to describe the new vertex/side semantics.

## Notes For Next Agent

- The current ternary point positions represent relative proportions of the three raw values, not absolute distances.
- For large companies, market cap may dominate the normalized position; this is expected with the current mapping.
- If the user wants better visual spread later, consider adding a toggle between:
  - raw normalized values
  - log-normalized values
  - ratio-only valuation view
- The existing Plotly type declaration lives at `types/plotly.js-dist-min.d.ts`.
- The analysis API already returns `market_cap`, `equity`, `net_income`, `roe`, `pbr`, and `per` from `app/api/watchlist/analysis/route.ts`.

## Verification

- `npm run lint` passed.
- `npm run build` passed.

## Versioning Convention

- Future logs should be added as:
  - `project-logs/0002-short-topic.md`
  - `project-logs/0003-short-topic.md`
- Each log should include:
  - Request
  - Plan
  - Implementation
  - Modified files
  - Verification
  - Notes for next agent
