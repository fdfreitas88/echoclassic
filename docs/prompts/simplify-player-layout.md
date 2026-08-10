# Echo Classic — simplify Settings > Player layout

Read the project brief first, then execute this task. This is a focused UX correction
for the 3.2.9 publication candidate. Do not re-audit the whole product.

## Outcome

Make Settings > Player layout straightforward for a basic user:

- the default screen presents only the decisions needed to choose how the
  player opens and where its adaptive panel sits;
- appearance customization is summarized and progressively disclosed;
- the three current player surfaces remain configurable without displaying
  three long, repeated forms at once;
- remove the preview feature completely — it does not communicate the result;
- preserve all persisted preference keys and import/export compatibility.

This is an implementation task, not a visual opinion exercise. Add regression
tests and verify the result at desktop, iPad and phone breakpoints.

## Evidence already collected — do not repeat discovery

Live Chrome audit against LMS 9.1.1 / Echo Classic 3.2.8:

- Default Player layout repeats `Match app appearance` three times: Full
  player, Small player and Mini player.
- With only Full player customization opened, the screen exposes:
  - 4 switches;
  - 9 radiogroups;
  - 40 visible radio choices;
  - 16 colour swatches before Mini-specific accent controls are even opened.
- Content height with this common state:
  - 390x844: **1,723 px** inside a 656 px scroller;
  - 768x1024: **1,606 px** inside an 836 px scroller;
  - desktop 1512x805: **1,606 px** inside a 617 px scroller.
- On phone, the first viewport shows only Full player settings and the start of
  its progress-bar section; Small and Mini are undiscoverable below several
  screens of scrolling.
- `Show previews` adds three 64 px strips plus three `PREVIEW` headings.
- Each preview contains only:
  - one accent-colour circle;
  - the text Full player / Small player / Mini player;
  - a two-pixel line.
- The preview does **not** show presentation, side-panel position, font,
  player chrome, album art, metadata, real progress-bar style or a usable
  representation of the final surface. It is `aria-hidden` and provides no
  decision support.
- There was no horizontal overflow, and touch controls met the 44 px target;
  preserve those good properties.

Primary files:

- `EchoClassic/HTML/echoclassic/html/js/settings.js`
- `EchoClassic/HTML/echoclassic/html/css/ios9.css`
- `EchoClassic/HTML/echoclassic/html/js/ui.js` only if a small state helper is
  genuinely required; prefer using the existing surface setters.
- `EchoClassic/strings.txt` for any new user-visible wording.
- `tests/appearance-ui.test.js` and focused UI-state tests.

Use `rg` and read targeted ranges. Do not read `settings.js` in full.

## Existing state contract — preserve it

Do not rename, delete or migrate these persisted settings:

- layout: `playerPresentation`, `playerPosition`;
- surface appearance:
  - `fullTheme`, `fullColorScheme`, `fullFont`;
  - `smallTheme`, `smallColorScheme`, `smallFont`;
  - `miniTheme`, `miniColorScheme`, `miniFont`;
- progress bars:
  - `playerGaugeStyle`, `playerGaugeColor` — shared by full and small;
  - `miniGaugeStyle`, `miniGaugeColor`;
- per-theme gauge values already maintained by `LmsUi.setGaugeStyle`.

`app` remains the stored value meaning that a surface follows the application.
Existing 3.2.8 exports must import without loss, and 3.2.9 exports must retain
the same keys.

## Required information architecture

Keep one Player layout screen, but replace the three expanded surface forms
with the following hierarchy.

### 1. Layout — always visible

One compact group at the top:

1. `Presentation` — existing Adaptive / Full screen radiogroup.
2. A concise helper under Presentation:
   - Adaptive: `Uses a side panel on larger screens and full screen on phones.`
   - Full screen: `Always opens over the app.`
3. `Panel position` — Left / Center / Right.
   - Show it only when Presentation is Adaptive.
   - This is the existing `playerPosition`; do not create new state.
   - Stop presenting it as a separate “Small player” section. Position is a
     consequence of Adaptive presentation, so it belongs next to Presentation.

The basic layout task must be understandable without knowing the internal
terms Full player / Small player / Mini player.

### 2. Appearance — summarized by default

One compact group immediately after Layout:

1. One master switch: `Match app appearance`.
2. Helper text:
   - all surfaces follow app: `All player surfaces use the app theme, accent and font.`
   - one or more customized: `Some player surfaces use custom appearance.`
3. One disclosure button: `Customize player appearance` with a chevron and
   correct `aria-expanded`.

Master-switch behavior:

- ON calls the existing surface-follow setters for `full`, `small` and `mini`,
  returning all nine appearance keys to `app`.
- OFF seeds all three surfaces from the app's currently resolved theme, accent
  and font, using the existing `setSurfaceFollowsApp(surface, false)` behavior.
- If only some surfaces follow the app, master is visually OFF and helper text
  reports that some surfaces are customized.
- Do not invent an indeterminate ARIA switch. The disclosure exposes exact
  per-surface state.

### 3. Advanced player appearance — collapsed by default

`Customize player appearance` expands an inline advanced area. The disclosure
state is session-only and defaults closed; it is not exported.

At the top of the expanded area, provide one accessible surface selector:

- `Full player`
- `Side panel`
- `Bottom bar`

Map them without changing stored keys:

- Full player -> `full*`
- Side panel -> `small*`
- Bottom bar -> `mini*`

Only the selected surface's controls are in the DOM/visible at a time. Do not
render three long forms and hide them with CSS.

For the selected surface show:

1. Surface-specific `Use app appearance` switch.
2. When it is OFF: Theme, Accent and Font using the existing controls/setters.
3. Progress bar controls:
   - Full player: style + colour; helper says it also applies to Side panel.
   - Side panel: do not duplicate progress controls; show the sentence
     `Progress bar settings are shared with Full player.`
   - Bottom bar: its existing Mini style + colour.
4. Keep `Bar style is remembered per theme.` only beside a surface that
   actually displays a style selector. Do not repeat the sentence elsewhere.

Changing the selected surface must not alter preferences. Entering or leaving
the disclosure must not alter preferences.

## Remove previews completely

Delete, rather than hide:

- the `Show previews` row and switch;
- `showPreviews` data;
- all three `PREVIEW` headings/groups;
- all `.surface-preview*` markup;
- `fullPreviewAttrs`, `smallPreviewAttrs`, `miniPreviewAttrs` and preview-only
  computed/helpers;
- `.surface-preview*` CSS;
- tests that require preview strips.

Replace old preview tests with negative guards proving no preview code, copy or
CSS remains. Do not build a replacement preview, mock player or thumbnail.
The real players update immediately and are the authoritative feedback.

## Interaction and accessibility requirements

- All source copy is English; add Portuguese translations to `strings.txt`.
- Segmented controls remain real radiogroups with roving tabindex and arrow-key
  support.
- Advanced disclosure is a button with `aria-expanded`; focus stays on the
  disclosure when opening. Closing it must not strand focus in removed content.
- Surface selector is a labelled radiogroup or tablist with correct selected
  state and keyboard behavior.
- Every control has an accessible name that identifies scope. Avoid three
  simultaneous switches all announced only as `Match app appearance`.
- Minimum target remains 44x44 CSS pixels.
- No horizontal overflow at 390 px.
- Back to Settings, Escape and tapping the active Settings tab continue to
  close Player layout and restore Settings scroll.
- Do not add modal dialogs, nested drill-in screens, accordions inside
  accordions or a Save/Apply step. Changes remain immediate.

## Quantitative acceptance criteria

With all surfaces following the app and advanced appearance closed:

- no preview control or preview strip exists;
- at most 8 visible interactive choices on the entire Player layout screen;
- exactly one visible `Match app appearance` switch;
- no `Full player`, `Small player` and `Mini player` repeated sections;
- the complete basic screen fits without internal scrolling at 390x844 after
  accounting for navbar, mini player and tab bar;
- it also fits at 768x1024 and desktop 1512x805;
- no horizontal overflow.

With advanced appearance open:

- only one surface's appearance controls are visible at a time;
- switching surface never changes a saved preference;
- current 3.2.8 customized values render correctly for every surface;
- at 390 px, colour swatches wrap or distribute without clipping;
- no duplicated progress controls for Side panel.

## Tests to update/add

Replace tests that encode the current long form. At minimum prove:

1. `Show previews`, `showPreviews`, preview attrs and `.surface-preview` are gone.
2. Layout keeps Presentation and conditionally shows Panel position only for
   Adaptive.
3. The master appearance switch writes all three surfaces together while the
   existing per-surface switches still isolate one surface.
4. Advanced area defaults closed and is session-only.
5. Surface selector exposes exactly one surface form at a time.
6. Full progress settings still affect Full + Side panel; Bottom bar remains
   independent.
7. Existing customized state and 3.2.8 import payloads are preserved.
8. Roving tabindex/arrow behavior remains correct.
9. Basic screen meets the visible-control budget and no-preview negative guards.
10. All new English strings translate through the real `strings.txt`.

Do not weaken unrelated tests. Remove assertions such as “expected at least
seven segmented controls” when they exist only to enforce the cluttered layout;
replace them with behavior-oriented assertions.

## Project constraints

- ES5 only in served JS: `var` and `function`; no arrows, `const`, `let` or new
  syntax unsupported by the project.
- Never edit vendored Vue.
- Use `apply_patch` for manual changes.
- Preserve unrelated user changes.
- Each commit: at most three files, per the project brief.
- Use Conventional Commits with project scopes.
- Add evidence entries to `docs/prompts/state.md` after landed commits.
- Run focused tests during implementation. Run the full gates once in verify:

```sh
npm test
npm run validate
npm run check-version
node tools/check-source-language.js
```

## Visual acceptance

After local tests, deploy only with explicit approval and follow the recovery
rules in the project brief. Verify the exact deployed tree in Chrome at:

- 1512x805 or 1440x900;
- 768x1024;
- 390x844;
- Light, Dark and Legacy.

Walkthrough:

1. Settings > Player layout opens at the top.
2. Basic screen fits in one viewport and reads in task order: Presentation,
   Panel position when relevant, Appearance summary.
3. Toggle Adaptive / Full screen; Panel position appears/disappears without
   scroll jump or lost focus.
4. Toggle master Match app appearance and confirm all three surfaces.
5. Open customization; select Full player, Side panel and Bottom bar and verify
   only one control set at a time.
6. Confirm immediate effects on the real full player, adaptive side panel and
   bottom bar. Do not claim this from a fake preview.
7. Close with Back, Escape and active Settings tab; scroll restoration works.

## Completion report

Return:

- concise before/after information architecture;
- commits and files changed;
- exact focused and full gate results;
- measured visible-control counts and scroll heights at all three breakpoints;
- `[live]`, `[code]`, `[measured]` or `[unverified]` for every claim;
- remaining gaps. Do not call the screen approved until visual acceptance is
  completed against the deployed build.
