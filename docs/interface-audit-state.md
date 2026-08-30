# Interface audit checkpoint

## Invariants

- Preserve Apple/iPod Classic identity, localization, stored preferences, navigation semantics, server contracts, and unrelated dirty-worktree changes.
- Do not redesign Mini Player or Artist Detail.
- Do not deploy, restart remotely, push, tag, or publish without a separate explicit request.
- Mode changes must block overlapping requests and follow: select → music stops → “Changing Mode” → apply → music restarts.

## Exact rejections

- Equalizer v1 card-based two-column hub and dominant unavailable state.
- Unified Equalizer v2 placing Automatic Rules and Quick Presets in one shared row.
- Equalizer carousels/sliding panels, ambiguous chevrons, empty gutters, controls stretched far from labels, and one all-or-nothing Advanced disclosure.
- Artist “After” metadata treatment; preserve the original simple biography card.

## Approved Equalizer implementation

- Mockup: `docs/prompts/equalizer-unified-console-before-after.html`.
- Status: implemented and validated 2026-08-30.
- Root is one responsive dashboard in this order: Engine/Mode, Quick Presets, Apply Automatically + Now Playing, full-width Curve, Advanced Processing.
- Engine: Apple Squeezer/SqueezeDSP visible segmented choices; `+` reveals additional compatible engines.
- Mode: DAC Priority/Equalizer visible choices; `+` reveals OSF/CSF. Preserve the existing blocking Apple Squeezer transition dialog and rollback/error behavior.
- Quick Presets: seven visible compact response-curve choices; `+` reveals saved presets and management below.
- Apply Automatically: Now Playing belongs in this frame, not Engine/Mode; Song/Album/Artist visible with close label/switch spacing; `+` reveals Genre/Folder/Year.
- Curve: uses full available width; preserve saved response, band controls, Compare, Reset, Apply, paused preview, and phone band behavior. Remove the redundant unlabeled EQ switch from the action row.
- Advanced: Headroom & Protection, Parametric Filters, and Room & Spatial are three equal responsive modules. Each has an independent `+` revealing its own controls immediately below, with no slide animation.
- Desktop groups fill space but shrink cleanly; phone uses fixed wrapping/grids, not carousels for dashboard groups.

## Relevant production paths

- `EchoClassic/HTML/echoclassic/html/js/settings.js`
- `EchoClassic/HTML/echoclassic/html/css/ios9.css`
- `tests/equalizer-workspace.test.js`
- `tests/apple-squeezer.test.js`

## Existing validated/deployed baseline

- Earlier Equalizer workspace and Apple Squeezer mode-transition work was deployed as 3.5.4.
- Later Artist Detail and My Music changes are validated but not deployed.
- Latest full local baseline before this implementation: 526/526 tests and all five validation gates passing.

## Validation

- Focused Equalizer and Apple Squeezer tests: 27/27 passing.
- Full project suite: 528/528 passing.
- `npm run validate`: all five gates passing (JavaScript, Vue templates, module references, WCAG contrast, and complete DE/EN/FR/PT strings). Five pre-existing identical duplicate-string warnings remain; no errors.
- Not deployed.
