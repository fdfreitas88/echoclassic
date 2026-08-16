# Settings visual integrity and scan gauges

## Problem and value

The Advanced LMS Settings bridge applies Echo Classic tokens around native server
markup, but some descendants keep their browser/LMS presentation. The live 3.3.0
candidate shows a raw file-conversion matrix with native selects and Media Scan Details
whose progress is still made from dotted server bars. These elements look like a foreign
page embedded inside Echo Classic and can vary unpredictably by theme.

The outcome is visual ownership: every visible Advanced Settings node either follows
Echo Classic’s control, table and progress grammar or is explicitly retained as
semantic server content. Media scan work appears as compact gauges with readable name,
count, state and duration.

## Acceptance criteria

- **AC-SETVIS-01:** Given any reachable Advanced LMS Settings page, when it renders in
  Light, Dark or Legacy, then no visible element uses an unintended LMS/browser font,
  colour, control, table, bullet/progress graphic, absolute width or chrome.
- **AC-SETVIS-02:** Given File Types conversion rules, when the native matrix renders,
  then formats, routes, flags and decoder selectors form a responsive Echo Classic
  table with consistent grouping, native submission wiring and no clipped control.
- **AC-SETVIS-03:** Given Media Scan Details with running, complete, failed, unavailable
  or indeterminate stages, then each stage appears as an accessible gauge with its name,
  numeric progress where known, state and duration; dotted native bars are absent. While
  scanning, a prominent live field states the current operation and item, wraps long
  values, preserves focus and politely announces meaningful changes.
- **AC-SETVIS-04:** Given a completed scan, when the details page opens, then the overall
  result and total duration are visually distinct from individual stages without
  inventing percentages the server did not provide.
- **AC-SETVIS-05:** Given wide desktop, tablet/split, narrow mobile and short viewport,
  when any settings page is used, then labels, values, tables, gauges, Save, navigation,
  mini player and scroll regions neither overlap nor clip and the correct region scrolls.
- **AC-SETVIS-06:** Given keyboard-only use, when controls, navigation, conversion
  selectors or scan details receive focus, then order is logical, focus is visible and
  every gauge exposes an accessible name and value/state.
- **AC-SETVIS-07:** Given English or Portuguese and long server/plugin labels, then text
  wraps or truncates deliberately, with full accessible text and no raw untranslated
  Echo Classic source phrase.
- **AC-SETVIS-08:** Given the visual-completeness inventory, then every reachable server
  and plugin settings page is recorded across all themes and material widths with zero
  unexplained visual finding before release.
- **AC-SETVIS-09:** Existing submission, dirty tracking, navigation, plugin filters and
  switches, native preference ownership and restart warnings retain behavior.
- **AC-SETVIS-10:** The canonical loop requires inventory-driven cosmetic QA, inherited
  DOM provenance and screenshot evidence for future visual changes.

## Interface decisions

- Keep the real LMS form and inputs; decorate and reorganize in place rather than copy
  values into a second form.
- Conversion data remains a dense responsive table because its row/column relationship
  is meaningful. On narrow screens each format becomes a labelled group, not unrelated
  cards.
- Scan stages use horizontal gauges. Known `current/total` values set fill and
  `aria-valuenow`; complete stages use the accent fill and a check; active indeterminate
  stages use restrained motion; failures use the destructive token.
- A single “Now scanning” field sits above active gauges. It shows the most specific
  server-provided activity available and falls back honestly when item detail is absent.
- The overall scan result is a quiet summary below the gauges.
- No new palette or type system is introduced. Selectors are hardened around native
  markup families while continuing to inherit Echo Classic tokens.

## Visual inventory

Derive the authoritative page list from `#choose_setting` at runtime. Inventory at least
these families: text/number fields, textarea, checkbox/radio, select, conversion matrix,
status/information tables, collapsible sections, warnings, buttons, plugin store, scan
progress, images/icons and empty/error content. Matrix: every discovered page ×
Light/Dark/Legacy × wide/narrow; add tablet and short-height cases for tables, plugin
grids, gauges and independent scrolling.

## Scope

**In scope:** iframe enhancer/CSS, native DOM classification, conversion matrix, scan
gauges, all-page/theme/width visual inventory, responsive/focus states, tests, loop
changes and the 3.3.0 release checklist.

**Out of scope:** LMS preference semantics, replacing native forms, hiding advanced
options, invented scan telemetry, changing the main Settings information architecture,
or redesigning non-settings screens.

## Evidence and baseline

- User-provided live screenshots dated 2026-08-16 show the native conversion matrix and
  dotted scan progress inside the 3.3.0 candidate. `[live]`
- `settings.js` `advancedFrameCss()` broadly styles tables and inputs but does not
  classify conversion or scan markup. `[code]`
- `settings.js` `enhanceAdvancedFrame()` enhances navigation, plugins and checkboxes,
  leaving other native families generic. `[code]`
- `tests/appearance-ui.test.js` verifies injected strings/controllers, not rendered or
  computed appearance for every settings page. `[code]`
- `node --test tests/appearance-ui.test.js`: 44 pass, 0 fail before correction.
  `[measured]`

## Classification and risk

**L · HIGH risk.** Server-owned markup varies by LMS page and plugin. Styling must be
defensive, preserve form wiring and degrade honestly when a family is unknown.
