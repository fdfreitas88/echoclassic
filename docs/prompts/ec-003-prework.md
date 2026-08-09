# EC-003 (+EC-004, +EC-002) — pre-work package

Phase 2, first item. Prepared before any edit, following the EC-014 pattern.

## What the audit asks for

- **EC-003** P2 — `.selection-bar` is `position:fixed` over the list; the last row
  is half covered and its checkbox click lands on the bar's "Cancel", silently
  destroying the whole selection. Audit's *preferred* fix: move
  `<lms-selection-bar>` before `<footer class="app-footer">` and swap
  `position:fixed` for `flex:0 0 44px`.
- **EC-004** P2 — the same bar is a *second* selection affordance, in Portuguese,
  contradicting the toolbar. Audit's alternative: *"If the toolbar is kept,
  deleting `.selection-bar` also resolves EC-003."*
- **EC-002** P2 — the A–Z rail clips letters whenever viewport height < ~893px.
  The bar's 44px compounds it but is not its cause.

## What the code actually says — verified

| Fact | Site | Marker |
|---|---|---|
| Bottom bar is `Cancel` + a concatenated Portuguese count | `js/actions.js:383-399` | [code] |
| Top toolbar is complete and English: count · Add to queue · Done | `js/browse.js:63-74` | [code] |
| Its count uses the whole-phrase keys correctly | `js/browse.js:306-312` | [code] |
| `No item selected` / `item selected` / `items selected` all exist | `strings.txt:1408,1832,1836` | [code] |
| Selection mode is entered from exactly one place | `js/browse.js:832-833` | [code] |
| Nothing else consumes the bar | `grep selection-bar` → 5 hits, all listed | [measured] |
| Bar is a root-level sibling after `.app-footer` | `js/app.js:50` | [code] |
| `.selection-bar` CSS | `css/ios9.css:1384-1388` | [code] |

## Recommendation — deviates from the audit's stated preference

**Delete the bottom `.selection-bar`.** Not relayout it.

Reasoning:

1. The toolbar it duplicates is already complete, already English, already
   translatable. Keeping both means keeping two exits for one state (EC-004).
2. Deletion closes EC-003 and EC-004 in one commit and removes 44px of chrome
   that compounds EC-002.
3. It is the lower-risk change. The audit's preferred fix alters `.app`'s flex
   column, which changes `.scroller`'s client height — and `browse.js:649-652`
   computes virtualisation offsets against exactly that. Deletion touches
   neither.
4. Nothing is stranded: all three `*selected*` string keys stay in use by
   `browse.js:311` after the bar is gone.

## Scope — 1 commit, 3 files

- `js/actions.js` — remove the `lms-selection-bar` component (383-399).
- `js/app.js` — remove `<lms-selection-bar></lms-selection-bar>` (line 50).
- `css/ios9.css` — remove `.selection-bar` rules (1384-1388).
- `tests/browse.test.js` — a case asserting selection mode exposes exactly one
  count and one exit.

## Known edge, checked

On mobile, `.body.split.drilled .pane-left{display:none}` (`ios9.css:1470`)
hides the toolbar. This does not strand the user: the Select button lives in
that toolbar, so selection mode cannot be entered while drilled, and while in
selection mode `open()` is replaced by `toggleSelection()` (`browse.js:841`),
so a drill cannot begin. [code] — worth one live check on a 390px viewport.

## Out of scope

EC-002. The rail's clipping is arithmetic — 27 entries × 24px = 648px against a
`viewportHeight − 244.5` box — and survives the bar's removal at every viewport
below ~893px. It needs its own fix (condense the alphabet, keep `A` and `#`,
keep `aria-valuemax` in sync) and its own commit.

## Acceptance

1. My Music → Albums → Select → scroll to the very end: last row fully visible,
   its checkbox ticks the row instead of cancelling. [live]
2. One count, one exit, no Portuguese in selection mode. [live]
3. Scroll-to-end still correct in all five My Music roots and in Playlists —
   virtualisation regression check the audit asks for. [live]
4. `npm test`, `npm run validate`, `npm run check-version` green. [measured]
