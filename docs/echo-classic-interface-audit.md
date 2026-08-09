# Echo Classic Interface Audit

**Target:** Echo Classic skin for Lyrion Music Server, exercised in the owner's provided live browser tab.
**Skin version under test:** **3.2.6c** (reported by Settings → About at runtime)
**Server:** LMS 9.1.1 · private owner library
**Browser:** Chrome 151, macOS. Viewports exercised: 1920×1080, 1512×861, 1440×900, 1280×600, 1100×800, 834×1112, 784×382, 700×900, 390×844, 360×640
**Date:** 2026-08-08 / 2026-08-09
**Source read:** private deployed snapshot from the owner's environment (declares **3.2.6b**, commit `56d35f9`, 2 files changed locally)

---

## Reading this report

Per your standing instruction, everything below carries an explicit verification status.

- **Runtime-confirmed** — I reproduced it in your live skin and measured it. Geometry figures are `getBoundingClientRect` / `getComputedStyle` values, hit-testing is `document.elementFromPoint`.
- **Code-confirmed, runtime [Unverified]** — the defect is provable from the source with a file:line quote, but I did not trigger it in the running app. These are **not** presented as observed behaviour.
- `[Unverified]`, `[Inference]`, `[Speculation]` — used inline wherever a statement is not directly evidenced.

**One finding governs the trustworthiness of the rest — read EC-000 first.** The code I was given and the code that is running are not the same build.

I did not validate WCAG conformance. The accessibility section reports specific, measured barriers only; it makes no compliance claim.

---

## Executive Summary

**36 findings.** All were either reproduced in the running skin or traced to quoted source. Nothing here is a design preference.

| Severity | Count | |
|---|---|---|
| **P0 — Blocker** | 0 | |
| **P1 — Critical** | 3 | EC-001 navbar controls unusable on every drilled screen · EC-014 queue undo restores into the wrong player · EC-000 deployed build ≠ source build |
| **P2 — Major** | 12 | |
| **P3 — Minor** | 15 | |
| **P4 — Cosmetic** | 6 | |

### Major problem areas

1. **The navigation bar on drilled My Music screens is broken at every viewport** (EC-001). A one-word CSS selector change between 3.2.6b and 3.2.6c turned a Settings-only rule into a global one. The result: the My Music root picker sits underneath the Back button — clicking the visible title fires Back — and the Albums/Tracks tab strip sits underneath the search button. On a 390px phone the Tracks tab is completely unreachable.
2. **Internationalisation is structurally broken, not just incomplete** (EC-005, EC-018, EC-034). English is the *source* language, so the translation layer switches itself off entirely in English — which means every Portuguese literal left in a template is frozen on screen forever. Your primary playback commands ("Reproduzir agora", "Reproduzir a seguir") are two of them. Separately, 76 bound `:aria-label` / `:title` attributes can never be translated in *any* language, and number formatting is hard-coded to pt-BR.
3. **Vertical space is not budgeted.** The A–Z rail (EC-002) and the selection bar (EC-003) both assume room they do not have. Below ~893px viewport height the rail silently loses letters at both ends; at 1280×600 six letters at each end are gone. In selection mode the bottom row's checkbox sits directly on top of the "Cancel" button.
4. **Search is a one-way door** (EC-006, EC-007). Album results never show cover art even when the art exists, and opening any result destroys the query with no way back to the results.
5. **Queue mutation has a family of player-attribution and window-size bugs** (EC-014, EC-015, EC-029) that can restore tracks into the wrong room or silently drop them.

### Highest-risk workflows

| Workflow | Risk |
|---|---|
| Browse an artist or album on a phone | EC-001 — the Albums/Tracks switch cannot be tapped; tapping the title navigates back unexpectedly |
| Jump to a letter in a long list on a laptop | EC-002 — "A" and "#" are not clickable below ~893px height; six letters at each end are gone on a short window |
| Multi-select then queue | EC-003 last row cancels the selection · EC-011 selection survives a root change and queues invisible items |
| Search → open a result → go back | EC-007 — the query is gone, Back leads to the album list, a second Back does nothing |
| Transfer playback to another room, or undo a queue clear | EC-014 / EC-015 — wrong-player restore, destination queue wiped with no undo |
| Use the skin in Portuguese with a screen reader | EC-034 — most accessible names stay in English |

### What is working well — do not touch it

These were verified and should be treated as regression guards, not as areas to change:

- Browser **Back and Forward work correctly** for drill-downs and for tab switches. Reload restores tab, view and the open detail from `localStorage`.
- The **action sheet** is exemplary: `role="dialog"`, `aria-label="Actions for <item>"`, focus moves to the first command on open, Escape closes it and returns focus to the triggering `…` button.
- The **filter panel** has `aria-labelledby`, focus management, a real inner scroller and visually-hidden helper text.
- The **A–Z rail is a correct ARIA slider** (`tabindex=0`, `aria-valuenow/min/max/valuetext`) — the defect is purely that its extreme values are not visible.
- **Every interactive element on the browse screen has an accessible name**, no touch target is under 24px, landmarks (`header`/`main`/`footer`) and a single `h1` are present, and the tab bar is a correct `tablist` with `aria-selected`.
- **Active-filter feedback exists** — the "Active: [FLAC ×] 1397 Clear all" bar plus a badge on the funnel icon. The 3.1.x complaint about unexplained empty results is fixed for media filters.
- **No horizontal overflow at any viewport tested**, 360px to 1920px.
- **Zero console errors or warnings** across the whole session.

---

## Findings

---

### EC-000
**Title:** The deployed build is not the build in the deploy snapshot, and it contains a defect the snapshot does not
**Area:** Release process / asset pipeline
**Detected by perspective:** Multiple (Engineering, Testing)
**Category:** Defect (process)
**Severity:** P1
**Reproducibility:** Always

**Problem.** Settings → About reports skin version **3.2.6c**. The most recent deploy snapshot (`echoclassic-backups/20260808-203441/META`) records `versao_instalada=3.2.6b`, `commit_local=56d35f9`, `arquivos_alterados_local=2`. The served stylesheet and the snapshot stylesheet differ, and the difference is not cosmetic — it is the root cause of EC-001.

**Evidence.** Fetched the live stylesheet from the running page and compared it byte-for-byte in structure against the snapshot:

| | served (3.2.6c) | snapshot (3.2.6b) |
|---|---|---|
| `ios9.css` size | **106,163 bytes** | **105,776 bytes** |
| contains `.gauge-segmented` | **no** | **yes**, at line 813 |
| contains bare `.segmented{margin-left:auto;…}` | **yes** | **no** |

Served rule, retrieved verbatim from the running page:
```css
.segmented{margin-left:auto;display:flex;border:1px solid var(--accent);border-radius:5px;
 overflow:hidden;flex:0 0 auto}
```
Snapshot rule at `ios9.css:813`:
```css
.gauge-segmented{margin-left:auto;display:flex;border:1px solid var(--accent);border-radius:5px;
```

**Steps to Reproduce.**
1. Open the skin, Settings → About → read Skin version → `3.2.6c`.
2. `cat echoclassic-backups/20260808-203441/META` → `versao_instalada=3.2.6b`.
3. In the browser console: `fetch(document.querySelector('link[rel=stylesheet]').href).then(r=>r.text()).then(c=>console.log(c.length, /\.segmented\{[^}]*margin-left:\s*auto/.test(c), c.includes('.gauge-segmented')))` → `106163 true false`.

**Expected Behavior.** The snapshot that the deploy script writes should be the tree that was deployed.
**Actual Behavior.** It is one revision behind, and the missing revision is the one that introduced a visible regression.

**User Impact.** Indirect but severe: any audit, any fix and any regression test performed against the repository is testing code the user is not running. I found EC-001 only because I measured the live DOM; a purely static review of the snapshot **explicitly concluded the defect was absent** and measured the navbar as correct.

**Likely Technical Cause.** Between 3.2.6b and 3.2.6c the Settings-scoped selector `.gauge-segmented` was renamed to the bare `.segmented`, presumably to share the styling. That rename shipped; the snapshot did not.

**Recommended Fix.** Before any other work: capture a fresh snapshot of what is actually installed, confirm which commit it corresponds to, and reconcile the two local changes recorded in META. Add a deploy-time assertion that the SHA of the installed `HTML/` tree matches the SHA of the snapshot written alongside it.

**Regression Risk.** None from the fix itself. Not fixing it means every subsequent finding may be re-verified against the wrong code.

---

### EC-001
**Title:** On every drilled My Music screen the root-picker title and the Albums/Tracks tabs collapse onto the Back and Search buttons
**Area:** Navigation bar (`chrome/navbar.js`), all drilled My Music views
**Detected by perspective:** Multiple (UX, Engineering, Testing)
**Category:** Defect — Rendering + Interaction (regression)
**Severity:** P1
**Reproducibility:** Always, at every viewport width from 360px to 1920px

**Problem.** The navigation bar's centre group is supposed to be centred. A CSS rule introduced in the deployed build gives it `margin-left:auto`, and an auto margin absorbs all free space in a flex container, overriding `justify-content:center`. The title picker is pushed hard left, underneath the Back button; the segmented Albums/Tracks control is pushed hard right, underneath the Search button. Both are stacked *below* those buttons because Back and Search carry `z-index:2` and the centre group does not.

**Evidence.** Live DOM, artist detail for "a-ha", viewport 1512×861:

```
.navbar          flex, position:relative, [0,20,1512,44]
├ .back          [12,20,80,44]  right edge 92   z-index 2   aria-label "Back to Artists"
├ .center        position:absolute; left:0; right:0; display:flex; justify-content:center
│  ├ .pickttl    [0,20,79,44]    aria-label "Choose a My Music root. Current: Artists"
│  └ .segmented  [1359,20,153,44] right edge 1512   computed margin-left: 1267.23px
├ .sp            flex:1
└ .r  (search)   [1456,20,44,44] z-index 2
```

Hit-testing (`document.elementFromPoint`):

| target | expected to hit | actually hits |
|---|---|---|
| centre of the visible title "Artists" | `.pickttl` | **the Back button's label span** |
| centre of the "Tracks" tab | `.seg` Tracks | **the search icon `<svg>`** |
| centre of the "Albums" tab | `.seg` Albums | `.seg` Albums (only because it sits left of the search button) |

Measured across viewports in an isolated same-origin iframe harness, always in the same drilled state:

| viewport | `.segmented` computed margin-left | title left | Back right edge | overlap | Tracks tab hit |
|---|---|---|---|---|---|
| 1920×1080 | 1675.23px | 0 | 92 | yes | search icon |
| 1512×861 | 1267.23px | 0 | 92 | yes | search icon |
| 1100×800 | 855.23px | 0 | 92 | yes | search icon |
| 700×900 | 490.56px | 0 | 56 | yes | search icon |
| **390×844** | 180.56px | 0 (72px wide) | 56 | **56 of 72px covered** | search icon |

At 390px the segmented control spans 261–390 while the search button occupies 334–378, so the Tracks tab is entirely inside the search button's footprint.

Visually the result is the word "Artists" printed twice on top of itself in the top-left corner, and the search magnifier drawn over the word "Tracks".

**Steps to Reproduce.**
1. My Music → title picker → Artists.
2. Click any artist (e.g. "a-ha").
3. Look at the top-left: two overlapping labels. Look at the top-right: the magnifier is drawn over "Tracks".
4. Click the visible title text → the app navigates **back** to the artist list instead of opening the root picker.
5. Click the centre of "Tracks" → the **search overlay opens** instead of switching to the track view.

**Expected Behavior.** `.center` centres the title picker and, when present, the segmented control, clear of both side controls — which is exactly what the source snapshot does (measured: title at x=644, segmented at 729–868 at 1512px width, no overlap at any width 360–1920).

**Actual Behavior.** As measured above.

**User Impact.** Two controls are broken on every artist, album, genre and year detail screen. The My Music root picker — the only way to switch between Recent / Artists / Albums / Genres / Years — is reduced to a 12px-wide hit area, and the visible label fires Back instead. The Albums/Tracks switch is reduced to roughly its leftmost 18px on desktop and is completely unreachable on a phone. Both failures produce a *wrong action* rather than no action, which is worse: the user clicks a title and is thrown back a level.

**Likely Technical Cause.** Confirmed. Served CSS contains
```css
.segmented{margin-left:auto;display:flex;border:1px solid var(--accent);border-radius:5px;
 overflow:hidden;flex:0 0 auto}
```
`.navbar .segmented` (specificity 0,2,0) at `ios9.css:582` does **not** declare `margin-left`, so the generic rule's `auto` applies to the navbar control. In 3.2.6b this rule was scoped as `.gauge-segmented` (`ios9.css:813`) and only matched the Settings gauge-style picker. The template that places the control inside `.center` is `chrome/navbar.js:44-58`; the only producer of segments is `app.js:109-111`:
```js
segments: function () {
  return (this.ui.tab === 'music' && this.depth) ? LmsUi.ALBUM_MODES : [];
},
```
so the blast radius is exactly "My Music at nav depth ≥ 1".

**Recommended Fix.** Re-scope the rule. Either restore `.gauge-segmented` for the Settings control, or keep the shared class and add `margin-left:0` to `.navbar .segmented`. The smaller and safer edit is the second, but verify the Settings gauge picker still right-aligns.

Separately, and independently of this regression: `ios9.css:289-301` documents in its own comment that `.center{position:absolute;left:0;right:0}` reserves no space for `.back` or `.r`, and `.navbar .center > *{pointer-events:auto}` lets the overlay steal their clicks wherever it lands on top. That is the latent hazard this rename detonated. Consider giving `.center` real side insets equal to the widths of the two side clusters.

**Regression Risk.** The Settings → Appearance gauge-style pickers use the same class in the deployed build; they must stay right-aligned. Also re-check the navbar at the 700px breakpoint, where `ios9.css:1485` reduces `.navbar .segmented` font size.

---

### EC-002
**Title:** The A–Z rail clips letters off both ends on any viewport shorter than about 893px
**Area:** My Music list (`browse.js`, `.rail`)
**Detected by perspective:** Multiple (UX, Engineering, Testing)
**Category:** Defect — Rendering + Responsive
**Severity:** P2
**Reproducibility:** Always, deterministic on viewport height

**Problem.** The rail renders all 27 entries (A–Z plus `#`) at a 24px minimum height each — 648px of content — inside a flex column with `justify-content:center` and `overflow:hidden`. When the column is shorter than 648px the overflow is split evenly between top and bottom and both ends are cut. Because the container does not scroll, the clipped letters are unreachable by any means.

**Evidence.** Live DOM at 1512×861: `.rail` box `[525,121,28,616.5]`, 27 children. First child "A" rect top **105** — 16px above the container top; last child "#" bottom **753** — 16px below the container bottom. Hit-testing:

- centre of "A" (539,117) → `DIV.library-tools` (the toolbar above)
- centre of "#" (539,741) → `BUTTON.np` (the now-playing bar below)

Neither is the rail. Measured across viewports in the iframe harness:

| viewport | rail height | clipped top | clipped bottom | letters lost each end |
|---|---|---|---|---|
| 1440×900 | 672px | fits | fits | 0 |
| 834×1112 | 884px | fits | fits | 0 |
| 1920×936 | 692px | fits | fits | 0 |
| **1512×861** | 616px | 16px | 16px | 1 (A, #) |
| **390×844** | 616px | 17px | 16px | 1 (A, #) |
| **1100×800** | 572px | 39px | 38px | 2 |
| **360×640** | 412px | 119px | 118px | ~5 |
| **1280×600** | 372px | 139px | 138px | **6** (A–F and U–#) |
| **784×382** | 138px | 255px | 255px | **~10** (only ~5 letters visible) |

The threshold follows directly from the CSS: fixed chrome is `--statusbar 20 + --navbar 44 + --mini 74 + --tabbar 50 = 188px`, plus `.library-tools{min-height:56px}` and a 0.5px hairline = 244.5px. So `rail height = viewportHeight − 244.5`, and 27 × 24 = 648 requires **viewport height ≥ ~893px**. Verified: at vh=892 "A" is at 120.5 vs box top 121.0; at vh=893 they coincide.

The requirement rises further with any additional toolbar row. With a filter chip bar plus the "1 album was left out…" notice, the rail started at "C" at 1512×861. In selection mode (two-line toolbar) it also started at "C".

**Steps to Reproduce.**
1. Set the browser window so the page viewport is 1512×861 or shorter.
2. My Music → Artists (the list starts with "10cc", "14 Bis", "1994 Divine Intervention" — numeric entries that live under `#`).
3. The rail visibly starts at "B". Try to click where "A" or "#" should be — the click lands on the toolbar or on the now-playing bar.

**Expected Behavior.** Every rail entry the component renders should be visible and clickable, or the alphabet should be condensed when it does not fit — which is exactly what the code's own comment promises: *"cabe ao JS encurtar o alfabeto nesse caso"* (`ios9.css:520-522`).

**Actual Behavior.** The alphabet is always rendered in full and silently cropped at both ends.

**User Impact.** In a 1,601-artist library the A–Z rail is the primary navigation affordance, and "A" is the largest bucket. The `#` bucket is where every numerically-titled entry lives — and this library's artist list literally begins with three of them. On a short window six letters at each end vanish. The failure is silent: nothing indicates the alphabet is incomplete.

There is a second consequence. The rail is a correctly implemented ARIA slider (`role="slider"`, `tabindex="0"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="26"`, `aria-valuetext`), so a keyboard user can set `valuenow` to 0 or 26 — values that are not rendered anywhere on screen.

**Likely Technical Cause.** Confirmed.
```css
/* ios9.css:520-528 */
.rail{width:28px;flex:0 0 28px;display:flex;flex-direction:column;align-items:center;
  justify-content:center;overflow:hidden;font-size:11px;font-weight:500;
.rail span{line-height:1.16;cursor:pointer;width:100%;min-height:24px;display:flex;
```
```js
/* browse.js:233 */
RAIL: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split(''),
```
`browse.js:182-190` renders one `<span>` per entry unconditionally. Nothing anywhere shortens `RAIL`; it appears in no media query and has no scroll.

**Recommended Fix.** Implement the condensation the comment promises: when the available height is below `27 × 24`, drop to every other letter (with the omitted ones still mapped to the nearest rendered anchor), or reduce `min-height` proportionally with a floor. Whatever the approach, `A` and `#` must always be the first and last rendered entries. Keep `aria-valuemax` in sync with the number of entries actually rendered.

**Regression Risk.** `jump()` and `activeRail` (`browse.js:669-680`) index into `RAIL`; a condensed alphabet changes that mapping. The rail also shares `grid-row:6` with `.scroller` (`ios9.css:342-343`), so its bottom is additionally covered by the selection bar — see EC-003.

---

### EC-003
**Title:** In selection mode the fixed selection bar covers the last list row, and its checkbox click lands on "Cancel"
**Area:** My Music list, multi-select mode
**Detected by perspective:** Multiple (Testing, Engineering)
**Category:** Defect — Rendering + Interaction
**Severity:** P2
**Reproducibility:** Always

**Problem.** `.selection-bar` is `position:fixed` above the mini player, 44px tall, `z-index:71`. The list scroller has `padding-bottom:0` and its box extends underneath the bar. At the end of the list the final row is half hidden, and the row's select target sits directly on top of the bar's "Cancel" button.

**Evidence.** Live DOM, My Music → Albums → Select, scrolled to the very end (`scrollTop 128264`, `max 128263`, `atEnd true`):

```
.scroller       box [0,169,525,569]  bottom 737   padding-bottom 0px
.selection-bar  position:fixed z-index:71  box [0,693,1512,44]  → covers 693..737
last row "Zombie Attack"  box top 649  bottom 737
```
Hit-testing:
- centre of the last row (x+200, y=693) → `DIV.selection-bar`
- centre of the row's `.select-mark` checkbox (31, 693) → `BUTTON` with text **"Cancel"**, parent `.selection-bar`

The measured gap `.scroller.bottom − .selection-bar.top` is exactly **44.0px at every viewport height from 861 to 1080**. The list cannot be scrolled further to expose the row.

**Steps to Reproduce.**
1. My Music → Albums → Select.
2. Tick any album so the bar shows a count.
3. Scroll the list to the very bottom.
4. Try to tick the last album — the click cancels selection mode and discards everything selected.

**Expected Behavior.** Every row in the list is fully visible and selectable while the selection bar is shown.

**Actual Behavior.** The last row is half covered; clicking its checkbox triggers Cancel.

**User Impact.** The last item in any list cannot be multi-selected, and attempting to do so silently destroys the whole selection. There is no undo. The same 44px also covers the bottom of the A–Z rail, compounding EC-002.

**Likely Technical Cause.** Confirmed.
```css
/* ios9.css:1379-1383 */
.selection-bar{position:fixed;z-index:var(--z-sheet);left:0;right:0;
  bottom:calc(var(--mini) + var(--tabbar));height:44px;…}
/* ios9.css:345 */
.scroller{flex:1;overflow-y:auto;min-width:0}
```
No `padding-bottom`, no `scroll-padding-bottom`, no selection-mode variant anywhere in the stylesheet. `browse.js:176`'s `botPad` is the virtualisation spacer, not chrome padding, and is zero at the end of the list. In `app.js:44-50` the bar is a sibling placed *after* `<footer class="app-footer">`, so it cannot become a layout row without being moved.

**Recommended Fix.** Preferred: move `<lms-selection-bar>` to immediately before `<footer class="app-footer">` in `app.js` and replace `position:fixed` with `flex:0 0 44px`. `.app-header`/`.app-footer` already use `display:contents` (`ios9.css:242`), so `.app` is the real flex column and `.workspace{flex:1}` will shrink correctly — which fixes the rail at the same time. Fallback: toggle a root class on `ui.selectionMode` and add `padding-bottom:44px; scroll-padding-bottom:44px` to `.scroller` **and** `padding-bottom:44px` to `.rail`. Do not simply restack z-indexes; the space has to be reserved, not reordered.

**Regression Risk.** Virtualisation offsets (`browse.js:649-652`) are computed against the scroller's client height; changing it changes `visible`. Re-test scroll-to-end in all five My Music roots and in Playlists.

---

### EC-004
**Title:** Selection mode shows two selection bars with contradictory controls, one of them in Portuguese
**Area:** My Music list, multi-select mode
**Detected by perspective:** UX
**Category:** Consistency Issue + Defect (i18n)
**Severity:** P2
**Reproducibility:** Always

**Problem.** Entering Select mode produces two simultaneous, overlapping affordances for the same state.

**Evidence.** Live, English UI, one album selected:
- Top toolbar: `1 item selected` · `Add to queue` · `Done` — English.
- Fixed bottom bar `.selection-bar`: `Cancel` · `1 selecionado` — Portuguese.

With nothing selected the bottom bar reads `0 selecionados`. The top toolbar reads `No item selected`.

**Steps to Reproduce.** My Music → Albums → Select. Read the top toolbar and the bottom bar.

**Expected Behavior.** One count, one exit control, one language.

**Actual Behavior.** Two counts and two exits ("Done" and "Cancel"), in two languages, with no indication whether they differ (they do not — both leave selection mode).

**User Impact.** The user cannot tell whether "Done" commits and "Cancel" discards. It also makes EC-003 worse, because the redundant bar is the thing occluding the list.

**Likely Technical Cause.** Confirmed.
```html
<!-- actions.js:386-387 -->
<button @click="cancel">Cancel</button>
<strong>{{ count }} selecionado{{ count === 1 ? '' : 's' }}</strong>
```
The count is built by string concatenation, so the translator can never match it — see EC-005. `strings.txt:1897-1903` already defines `ECHOCLASSIC_UI_ITEM_SELECTED` (`item selected` / `item selecionado`) and `ECHOCLASSIC_UI_ITEMS_SELECTED`, and they are unreachable.

**Recommended Fix.** Remove one of the two bars. If the fixed bar is kept, replace the concatenated literal with the existing whole-phrase keys, and align its controls with the toolbar's. If the toolbar is kept, deleting `.selection-bar` also resolves EC-003.

**Regression Risk.** `actions.js:391-394` exposes `values`/`count`; check no other consumer relies on the bar being present.

---

### EC-005
**Title:** Action menus, the selection bar and the full player are frozen in Portuguese because the translation layer disables itself in English
**Area:** Whole application (`i18n.js`, `actions.js`, `ui.js`, `chrome/miniplayer.js`, `opmlview.js`, `app.js`)
**Detected by perspective:** Multiple (UX, Engineering)
**Category:** Defect (i18n)
**Severity:** P2
**Reproducibility:** Always

**Problem.** This is one root cause with many symptoms, so it is reported once. The dictionary is keyed by the **English source phrase**, and when the active language *is* the source language the whole substitution layer switches off. Any literal left in Portuguese in a template is therefore permanently displayed as-is in an English session, and can never be translated into any other language either, because the key it would need is Portuguese.

**Evidence — runtime, English UI (Settings → Language → English is ticked):**

| Location | Shown |
|---|---|
| Album row `…` menu | **Reproduzir agora** · **Reproduzir a seguir** · Add to end of queue · **Fixar no Echo Classic** |
| Track row `…` menu | **Reproduzir agora** · **Reproduzir a seguir** · Add to end of queue · Add to playlist… · Add to Favourites · **Fixar no Echo Classic** · Credits and information |
| Selection bar | **1 selecionado** / **0 selecionados** |
| Full player dialog | `aria-label` = **"Reproduzindo agora"** — the accessible name a screen reader announces |

**Evidence — code.** `i18n.js:44-46`:
```js
var MAP = (LANG !== SOURCE && BY_LANG[LANG]) ? BY_LANG[LANG] : {};
var ACTIVE = false;
for (var k in MAP) { … ACTIVE = true; break; }
```
With `LANG === SOURCE` (English), `MAP` is `{}`, `ACTIVE` stays false, `Vue.component` is never wrapped, and `t()` returns its input unchanged (`i18n.js:101`). Server-side confirmation at `Plugin.pm:315-317`: `getStringMap` returns `{}` for the source language.

Per-literal status, checked against `strings.txt`:

| literal | site | status |
|---|---|---|
| `Reproduzir agora` | `actions.js:34` | no `ECHOCLASSIC_UI_PLAY_NOW` key exists — untranslatable in every language |
| `Reproduzir a seguir` | `actions.js:35` | no key exists |
| `Fixar no Echo Classic` | `actions.js:54` | the *other* branch of the same ternary (`Remove from pinned items`) has a key at `strings.txt:1451`; this branch has none |
| `{{count}} selecionado{{…}}` | `actions.js:387` | **keys exist and are unreachable** — `ECHOCLASSIC_UI_ITEM(S)_SELECTED`, `strings.txt:1897-1903` |
| `Fixados` | `actions.js:405` | key exists and is unreachable — `ECHOCLASSIC_UI_PINNED_ITEMS`, `strings.txt:695` |
| `Reconectando…` | `app.js:37` | no key |
| `' item adicionado' / ' itens adicionados'` | `ui.js:1032-1033` | concatenated into an English sentence; lookup key would be `"3 itens adicionados to the playback queue."` |
| `'Abrir o player' + …` | `chrome/miniplayer.js:73` | concatenated aria-label |
| `'Resultados: ' + term` | `opmlview.js:189` | concatenated; becomes the nav-bar title |
| `Atualizando favoritos…` | `actions.js:218` | busy message |

**Steps to Reproduce.** Settings → Language → English. My Music → any album → `…`. The first two commands in the menu are in Portuguese.

**Expected Behavior.** English source literals in templates, with `strings.txt` keys for each, so English renders natively and other languages substitute.

**Actual Behavior.** As above.

**User Impact.** The two most-used commands in the entire skin — play now and play next — are unreadable to an English-speaking user. For a screen-reader user, the full player announces itself in Portuguese.

**Likely Technical Cause.** Confirmed above. `actions.js:163-167` contains a comment describing exactly this failure mode, so it is a known pattern that was not applied consistently.

**Recommended Fix.** Convert each Portuguese literal to its English source phrase and add the matching `ECHOCLASSIC_UI_*` entry to `strings.txt`. For the pluralised count, use the two existing whole-phrase keys instead of concatenation. For composed sentences use the `{marker}` pattern the codebase already documents at `store.js:824-826`. Consider a build gate: fail `npm run validate` if a template contains a character outside the ASCII range in a translatable position, or if a rendered literal has no `strings.txt` key.

**Regression Risk.** Template rewriting happens once at component registration; changing literals changes the keys `i18n.js` matches. Re-check the Portuguese UI after the change — some of these strings currently *look* right in pt-BR precisely because they are hard-coded.

---

### EC-006
**Title:** Album rows in search results never show cover art, while track rows in the same list do
**Area:** Search (`search.js`, `api.js`)
**Detected by perspective:** Multiple (UX, Engineering, Testing)
**Category:** Defect
**Severity:** P2
**Reproducibility:** Always

**Problem.** In the search results screen, album rows render an empty artwork placeholder even when the album demonstrably has artwork.

**Evidence.** Live search for `rubber soul`, inspecting the rendered rows:

| row | kind | `.art` background-image |
|---|---|---|
| Rubber Soul — The Beatles • 1965 | album | **none** |
| 1965 - Rubber Soul — Beatles | album | **none** |
| Drive My Car — The Beatles • Rubber Soul | track | `url(.../music/9509c651/cover_50x50.jpg)` |
| Drive My Car (2009 Digital Remaster) | track | `url(.../music/522e05f2/cover_50x50.jpg)` |
| Girl — The Beatles • Rubber Soul | track | `url(.../music/9509c651/cover_50x50.jpg)` |

The tracks of those very albums resolve cover ids `9509c651` and `522e05f2`, so the artwork exists. The album rows produce `<span class="art"></span>` with computed `background-image: none`, `background-color: rgb(228,228,230)`, 48×48, and no `<img>` child — no request is ever made.

**Steps to Reproduce.**
1. Magnifier → type `rubber soul`.
2. Compare the ALBUMS section rows with the TRACKS section rows below them.

**Expected Behavior.** Album results show the same 48px thumbnail every other album list in the skin shows.

**Actual Behavior.** A flat grey square.

**User Impact.** Search is the fastest route into a 1,464-album library and it is the one place with no visual identification. Distinguishing "Rubber Soul" from "1965 - Rubber Soul" — two entries for the same record in this library — requires opening both.

**Likely Technical Cause.** Confirmed. The template asks for it (`search.js:39` `<span class="art" :style="art(a.artworkTrackId)">`) but the data never carries it. `api.js:422-427` populates album results from the LMS `search` reply, whose `albums_loop` carries neither `artwork_track_id` nor `coverid`. The enrichment pass that could repair it does not:
```js
/* api.js:249-259 */
async function albumSearchInfo(playerId, album) {
  if (!album || album.id == null || (album.artist && album.year)) return album;
  …
  var r = await rpc(playerId, ['albums', 0, 1, 'album_id:' + album.id, 'tags:lay']);
```
It returns early whenever artist and year are already present, and even when it runs it requests `tags:lay` — which omits `j` (artwork_track_id) — and never assigns `album.artworkTrackId`. The working list path uses `tags:jaSlytW2` (`api.js:313`). `LmsFmt.coverUrl(null, 50)` returns `''` (`format.js:86`), so the style object is empty.

**Recommended Fix.** Add `j` to the enrichment tag set and assign `album.artworkTrackId` from it; or, cheaper, drop the early return only when `artworkTrackId` is null. Best long term: collapse the two album-row builders (`api.js:320-328` and `api.js:422-427`) into one, since this is the third defect caused by their drift.

**Regression Risk.** The enrichment pass runs per result; requesting an extra tag adds no round trips but changes the early-return condition, so verify search latency on a large result set.

---

### EC-007
**Title:** Opening a search result destroys the query, and Back cannot return to the results
**Area:** Search → My Music
**Detected by perspective:** Multiple (UX, Testing)
**Category:** Navigation Issue + State/Continuity Issue
**Severity:** P2
**Reproducibility:** Always

**Problem.** Clicking any search result jumps to My Music with the item open and clears the search state entirely. There is no route back to the result list.

**Evidence.** Measured before and after clicking the "Rubber Soul" album result:

```
before  { history.length 25, searching true,  query "beatles" }
after   { history.length 26, searching false, query "",  tab "music", view "albums",
          nav.music [ {kind:"album", label:"Rubber Soul"} ] }
```
Then:
```
browser Back  →  { searching false, query "", view "albums", navDepth 0 }
browser Back  →  unchanged — no further effect
```

**Steps to Reproduce.**
1. Magnifier → `beatles` → results appear (2 artists, 5 albums).
2. Click any album.
3. Press browser Back. You land on the full My Music → Albums list, not on the results.
4. Press Back again. Nothing happens.
5. To get back to the results, reopen search and retype the query.

**Expected Behavior.** Based on the skin's own pattern elsewhere — where Back reliably returns to the list you came from and reload restores the open detail — Back from a search result should return to the search results with the query intact.

**Actual Behavior.** The query is discarded at click time and Back leads to an unrelated list.

**User Impact.** Comparing several search hits — the normal way to disambiguate "Rubber Soul" from "1965 - Rubber Soul" — requires retyping the query for every single one.

**Likely Technical Cause.** [Inference, code-supported] `search.js:166-169` and `204-206` call `LmsNav.reset('music')` followed by `LmsNav.push(...)`. `reset()` issues `history.replaceState` (`nav.js:77`), overwriting the current entry, and `ui.closeSearch()` (`ui.js:966-977`) clears `state.searching`/`state.query` without recording anything on the stack. Search has no history entry of its own: `openSearch`/`closeSearch` never call into `LmsNav`.

**Recommended Fix.** Give the search overlay a nav frame of its own (`kind:'search'`, carrying `term`) and push it before drilling into a result, so `popstate` can restore it. `opmlview.js:188-190` already models this for OPML search results — but see EC-024 about the payload it stores.

**Regression Risk.** Adds a history entry to a flow that currently has none; re-test the Back sequence from search on mobile widths where the left pane is hidden.

---

### EC-008
**Title:** Browser Back does not leave the embedded LMS settings page, and desynchronises its tab strip from its content
**Area:** Settings → Advanced LMS settings (iframe)
**Detected by perspective:** Multiple (Testing, UX)
**Category:** Navigation Issue + Rendering Issue
**Severity:** P2
**Reproducibility:** Always (2 of 2 attempts, with two different tabs)

**Problem.** Inside the embedded native LMS settings page, pressing browser Back neither exits the sub-screen nor returns the embedded page to a coherent state.

**Evidence.** The screen renders `<iframe src="/settings/index.html" title="Advanced LMS settings">` at `[0,116,1512,621]`, with a secondary bar above it (`‹ Settings` | `LMS settings`).

Attempt 1: opened the embedded **Manage Plugins** tab, pressed Back → `history.length` stayed 4, `LmsUi.state.tab` stayed `settings`, the iframe body reverted to **Basic Settings** while the tab strip still highlighted **Manage Plugins**.
Attempt 2: opened the embedded **Advanced** tab, pressed Back → identical outcome, tab strip highlighting **Advanced** over Basic Settings content.

**Steps to Reproduce.**
1. Settings → scroll to the bottom → Advanced LMS settings.
2. Click any tab inside the embedded page.
3. Press browser Back.

**Expected Behavior.** Consistent with the `‹ Settings` control and with every other Back in the skin, Back should leave the sub-screen and return to the Echo Classic settings list.
**Actual Behavior.** The app stays put; the embedded page shows one tab's content under another tab's highlight.

**User Impact.** The user is stuck on a screen showing contradictory state, and the reflex gesture for leaving it does nothing. The only working exit is the `‹ Settings` link, which is also in an unusual place (see EC-030).

**Likely Technical Cause.** `Not yet determined.` The Echo Classic side never registers a history entry for this screen — `settings.js:863` pushes a nav frame, but the iframe's own internal navigation is outside `nav.js`'s model. Whether the Back is consumed by the iframe's session history or by a replaced top-level entry could not be established without instrumenting the iframe. `[Unverified]`

**Recommended Fix.** Diagnose first. Then either isolate the iframe from the session history (navigate it with `location.replace` from the host, or recreate it on each internal navigation) or handle `popstate` on this screen explicitly and route it to the same handler as `‹ Settings`.

**Regression Risk.** The embedded page is native LMS; changing how it is navigated may affect Apply/Close inside it.

---

### EC-009
**Title:** After a cold open at a persisted nav depth, the Back control can be dead or eject the user from the skin
**Area:** `nav.js`
**Detected by perspective:** Engineering
**Category:** Navigation Issue
**Severity:** P2
**Reproducibility:** **Code-confirmed, runtime [Unverified]**

**Problem.** The nav stack is restored from `localStorage` on boot, but the browser history is not — boot uses `replaceState`, producing a single entry that advertises a depth it has no predecessors for.

**Evidence.** `nav.js:9-12` rehydrates the stack from `echoclassic.nav.v1`. `nav.js:124-126`:
```js
if (history.replaceState) {
  history.replaceState(historyState(global.LmsUi ? global.LmsUi.state.tab : 'music'), '');
}
```
`nav.js:87-94`:
```js
function back(tab) {
  if (!depth(tab)) return null;
  var current = history.state;
  if (!applyingHistory && current && current.echoClassic &&
      current.tab === tab && current.depth === depth(tab) && history.back) {
    history.back();
    return top(tab);
```
The guard matches (same tab, same depth), so `history.back()` runs. In a fresh tab, from a bookmark, or after a browser restart, there is no earlier entry for the skin — so Back either does nothing (and the fallback at `:97` is unreachable, leaving the stack unpopped) or navigates out of the skin.

Supporting runtime observation: after a page reload while drilled into an artist, `history.length` was 5 with a rebuilt stack of depth 1; the first Back popped correctly, the second and third produced no visible change at all, and the fourth reported "Cannot find a next page in history".

**Steps to Reproduce (as designed, not yet executed).**
1. Drill into an artist so `echoclassic.nav.v1` persists depth 1.
2. Close the tab.
3. Open a brand-new tab and navigate directly to the Echo Classic skin URL.
4. Press the on-screen Back chevron.

**Expected Behavior.** Back returns to the artist list.
**Actual Behavior.** `[Unverified]` — predicted to do nothing, or to leave the skin.

**User Impact.** If confirmed: a user who bookmarks the skin while drilled in lands on a screen whose Back button is permanently inert.

**Likely Technical Cause.** As quoted.
**Recommended Fix.** At boot, either seed the history with one `pushState` per restored frame, or clamp `back()` so it falls through to the internal `pop()` path when `history.state` came from a `replaceState` boot. Mark the boot entry (e.g. `bootstrapped:true`) so `back()` can tell.
**Regression Risk.** Touches the shared Back path; re-test Back/Forward in every tab.

Two further latent issues in the same file, both **code-confirmed, runtime [Unverified]**, listed here rather than as separate findings:
- `nav.js:92-93` returns `top(tab)` immediately after `history.back()`, which resolves asynchronously via `popstate` — the returned frame is the one being left. Harmless today only because `app.js:118` discards it.
- `nav.js:60-65` `pop()` splices the stack without touching history at all. Currently unreferenced outside `nav.js`.

---

### EC-010
**Title:** Typing in the list filter box can empty the list completely with no message and no active-filter indication
**Area:** My Music list (`browse.js`)
**Detected by perspective:** Engineering
**Category:** Defect — Empty state
**Severity:** P2
**Reproducibility:** **Code-confirmed, runtime [Unverified]**

**Problem.** The empty state is keyed on the *loaded* row count, not on what is displayed after the text filter is applied. A text filter that matches nothing therefore renders a completely blank scroller with no explanatory text and no visual sign that a filter is active.

**Evidence.**
```html
<!-- browse.js:138-143 -->
<div v-else-if="!rows.length" class="empty">
  <div class="h">{{ viewLabel }}</div>
  <div v-if="hasMediaFilter" class="p">Nothing in this category matches the filter …</div>
  <div v-else class="p">No items found in this category.</div>
```
```js
/* browse.js:452-456 */
displayRows: function () {
  var q = this.normalize(this.ui.filter);
  var rows = q ? this.rows.filter(function (r) { …
```
With 1,459 loaded albums and the needle `zzzz`, `rows.length` is 1,459, so the empty branch never runs; `windowed` is empty, `topPad` and `botPad` are 0, and the scroller renders nothing. `activeChips` (`browse.js:356-391`), `filterCount` (`:338`) and `toolsActive` (`:339-342`) all ignore `ui.filter`, so the funnel badge does not light up and no "Clear all" appears.

Related: `clearMediaFilter` → `LmsUi.clearFilters()` (`browse.js:828-830`) does not clear `ui.filter`, so even the real empty state's "Clear filter" button can leave the list blank.

**Expected Behavior.** Consistent with the media-filter empty state, which is well done and names the active filter.
**Actual Behavior.** A blank pane.
**User Impact.** The library appears to have vanished with nothing on screen to explain why.
**Recommended Fix.** Key the empty state on `displayRows.length`, include `ui.filter` in `activeChips`/`filterCount`, and have `clearMediaFilter` also clear `ui.filter`.
**Regression Risk.** The `v-else-if` ordering interacts with the loading state; check that the loading placeholder still wins.

---

### EC-011
**Title:** Multi-selection survives a root change and a reload, keeps counting, and queues items the user can no longer see
**Area:** My Music multi-select (`ui.js`, `browse.js`)
**Detected by perspective:** Engineering
**Category:** State/Continuity Issue
**Severity:** P2
**Reproducibility:** **Code-confirmed, runtime [Unverified]**

**Problem.** `setTab` clears the selection; `setMusicView` and `reload` do not.

**Evidence.**
```js
/* ui.js:516-524 — clears on tab change */
function setTab(name) {
  state.tab = name;
  state.selectionMode = false;
  state.selected = {};
```
`setMusicView` (`ui.js:686-695`) and `browse.js reload` (`:1336-1350`) have no equivalent. So: select three albums, switch the root to Genres — selection mode stays on, the toolbar still reads "3 items selected", no visible row is ticked, and "Add to queue" (`ui.js:1020-1035`) enqueues the three invisible albums. Applying a filter has the same effect: `reload` empties `this.rows` and leaves `ui.selected` intact.

Second, distinct problem in the same area — the selection key throws away merged artist identities:
```js
/* ui.js:994-996 */
function selectionKey(item) {
  return item ? String(item.kind || item.type || 'item') + ':' + String(item.id) : '';
}
```
while `browse.js:922-925` deliberately merges same-named contributors into one row carrying `ids[]`, and `detail.js:201-204` honours that merge when opening. So opening a merged artist shows albums from all contributor ids, but selecting the same row and queueing enqueues only the first — silently fewer albums than the row represents. This is directly relevant to your library, where "Beatles" (id 674) and "The Beatles" (id 673) are separate contributors.

**Expected Behavior.** Changing what the list shows should either clear the selection or make the selected items visible.
**Actual Behavior.** As above.
**User Impact.** Queueing content the user did not intend, with a count that appears to refer to what is on screen.
**Recommended Fix.** Clear `selectionMode`/`selected` in `setMusicView` and at the top of `reload(false)`. Change `selectionKey`/`selectionControl` to carry the full `ids` array for artist rows.
**Regression Risk.** Users who currently rely on the selection persisting across a filter change would lose that; confirm the intent before changing.

---

### EC-012
**Title:** The Years root can never be sorted newest-first, and Recent's sort-direction toggle does nothing
**Area:** My Music → Years and Recent (`browse.js`, `sortmenu.js`)
**Detected by perspective:** Engineering
**Category:** Defect
**Severity:** P2
**Reproducibility:** **Code-confirmed, runtime [Unverified]**

**Problem.** Two roots expose a "Descending order" control that is structurally inert.

**Evidence — Years.** Year rows carry no `year` field:
```js
/* browse.js:1409-1411 */
this.rows = y.map(function (x) {
  return { key: 'y' + x.year, kind: 'year', id: x.year, label: String(x.year), art: null };
});
```
but the comparator reads exactly that field (`browse.js:1108-1109`), so every comparison returns 0 before `desc` is applied and the unconditional ascending tie-break on `label` wins (`browse.js:1141`). `year` is the *default* sort for this root (`ui.js:177`). The direction switch (`sortmenu.js:31-35`) renders and toggles, `sortTriggerLabel` announces "Descending order", and nothing moves.

Compounding it, the filter panel lists two buttons both labelled "Year" for this root — `{key:'name', label: view==='years' ? tr('Year') : tr('Name')}` and `{key:'year', label: tr('Year')}` (`filterpanel.js:228-230`) — of which only `name` respects `desc`.

**Evidence — Recent.** `browse.js:459` skips the comparator entirely when the key is `recent`, and `browse.js:1136-1137` skips the key even if reached. Oldest-added-first is unreachable, while the toggle persists a flag nothing reads.

**Expected Behavior.** A control that renders and toggles should change the order, or should not be offered.
**Recommended Fix.** Either populate `row.year` for year rows and honour `desc` in the `recent` path, or hide the direction toggle for sort keys that ignore it. Remove the duplicate "Year" entry in the filter panel.
**Regression Risk.** `validSortKey` (`ui.js:224-229`) is shared by the toolbar menu and the filter panel; changing it affects both.

---

### EC-013
**Title:** With Albums grouped by Artist, the Format / Local-library / Highest-resolution sorts look up the media index with an artist id
**Area:** My Music → Albums with grouping (`browse.js`)
**Detected by perspective:** Engineering
**Category:** Defect
**Severity:** P2
**Reproducibility:** **Code-confirmed, runtime [Unverified]**

**Problem.** The media sorts and sections are offered whenever the root is Albums, regardless of grouping. When grouping is active the rows are *artists*, but the lookup key is still `row.id`, and the media index is keyed by **album** id.

**Evidence.**
```js
/* browse.js:1111-1114 */
if (key === 'format' || key === 'source' || key === 'quality') {
  var meta = self.metaFor(row.id);
```
`metaFor` (`browse.js:757-759`) indexes `mediaIndex[String(id)]`, built at `browse.js:1070` as `var key = String(track.albumId);`. Artist rows are `key:'main-ar'+artist.id` (`browse.js:1293-1296`). Passing an artist id yields either `null` — the sort is a silent no-op — or, where the small integers collide, the media profile of an unrelated album, producing an arbitrary but stable-looking order. `sectionValuesFor` (`browse.js:793-824`) has the identical bug at line 801.

Reachable with sections too, because `setGroup` (`ui.js:740-745`) does not clear `state.sections`, and `albumblock.js:229-231` sets a group without clearing sections. The existing `filtersIgnored` banner (`browse.js:127-129`) warns about media *filters* in relatedArtist mode but says nothing about media *sorts* or *sections*.

**Expected Behavior.** Either the media sorts are hidden when grouping produces artist rows, or they aggregate the group's albums.
**Recommended Fix.** Gate `allowsMediaFilter` on `!group.length`, or resolve `metaFor` through the group's member album ids.
**Regression Risk.** `allowsMediaFilter` also gates the filter panel's media sections.

---

### EC-014
**Title:** Queue undo can restore tracks into the wrong player, and silently drops everything past track 500
**Area:** `store.js` queue mutation
**Detected by perspective:** Engineering
**Category:** Defect — data/state corruption
**Severity:** P1
**Reproducibility:** **Code-confirmed, runtime [Unverified]**

**Problem.** Three related flaws in the same family. This is the highest-consequence group in the codebase because it writes to the wrong room's playlist.

**Evidence — wrong player.**
```js
/* store.js:623-630 */
if (state.playerId !== playerId) break;
await api.queueRemove(playerId, removed[i].index);
done.push({ item: removed[i], index: removed[i].index });
…
} finally {
  if (done.length) setQueueUndo(done);
```
The `break` is taken *because* the player changed, and `setQueueUndo` (`store.js:514-517`) then stamps `state.queueUndoPlayerId = state.playerId` — the **new** player. `undoQueue`'s ownership check (`store.js:639`) passes, and the old room's tracks are injected into the new room's queue. The comments at `store.js:512-513` and `:668` describe this as the scenario being prevented.

`removeFromQueue` (`store.js:574-575`) and `clearQueue` never capture `playerId` into a local before their await at all, so `setQueueUndo` re-reads it afterwards — same exposure, wider window.

**Evidence — 500-track cap.**
```js
/* store.js:599-605 */
var snapshot = state.queue.map(function (item) { return { item: item, index: item.index }; });
await api.queueClear(state.playerId);
setQueueUndo(snapshot);
```
`state.queue` holds at most 500 rows (`store.js:528 api.queue(playerId, 0, 500)`) while `queueClear` destroys the entire server playlist. On a 700-track queue, Undo restores 500 and drops 200 with no notice. `handoffTo` solves exactly this with `fullQueue()` + `notifyTruncated` (`store.js:709-712`); `clearQueue` never received the fix.

**Evidence — wrong restore positions.**
```js
/* store.js:646-648 */
await api.queueControl(playerId, 'add', 'track_id', entry.item.id);
var end = state.queueTotal + i;
if (entry.index < end) await api.queueMove(playerId, end, entry.index);
```
`state.queueTotal` is refreshed only by `loadQueue()`, which runs *after* this loop, so `end` is the pre-destruction total. Each `queueMove` also shifts the positions later iterations assume.

**Expected Behavior.** Undo restores the queue that was destroyed, on the player it was destroyed on, in the original order.
**User Impact.** Silent cross-room queue corruption with no undo of the undo.
**Recommended Fix.** Capture `playerId` into a local before the first await in every queue mutator and re-check it before every write, as `clearUpcoming` already does for the removal loop. Give `clearQueue` the `fullQueue()` + `notifyTruncated` treatment. Recompute the append position from a fresh `queueTotal` inside the restore loop.
**Regression Risk.** Central to all queue editing; needs a dedicated regression pass over add / remove / move / clear / clear-upcoming / undo on two players.

---

### EC-015
**Title:** Transferring playback wipes the destination player's queue with no snapshot and no confirmation
**Area:** `store.js handoffTo`
**Detected by perspective:** Engineering
**Category:** Defect — data loss
**Severity:** P2
**Reproducibility:** **Code-confirmed, runtime [Unverified]**

**Evidence.**
```js
/* store.js:717-718 */
clearQueueUndo();
await api.queueClear(playerId);   // playerId here is the DESTINATION
```
The line above guarantees there is nothing to undo. Contrast `clearQueue`, which at least snapshots, and the two-step `confirmClear` the UI requires for clearing the *local* queue (`queue.js:19-24`).

The subsequent copy loop has no cancellation check:
```js
/* store.js:719-721 */
for (var i = 0; i < tracks.length; i++) {
  if (tracks[i].id != null) await api.queueControl(playerId, 'add', 'track_id', tracks[i].id);
}
```
Up to 20,000 sequential RPCs (`QUEUE_HANDOFF_MAX`, `store.js:15`) with no `state.playerId` re-check between iterations. If any add rejects, `guarded()` swallows it and the destination is left half-copied while the source has already been cleared.

**Recommended Fix.** Snapshot the destination queue before clearing it and register it as the undo target; add the same per-iteration player check `clearUpcoming` uses; surface partial-copy failures.
**Regression Risk.** Handoff is the flow most likely to be used with multiple rooms active.

---

### EC-016
**Title:** Browser Back is invisible to the full player, the queue panel, the action sheet, the info sheet, the filter panel and the search overlay
**Area:** All overlay layers
**Detected by perspective:** Multiple (UX, Engineering)
**Category:** Navigation Issue
**Severity:** P2
**Reproducibility:** **Code-confirmed, runtime [Unverified]**

**Problem.** None of the overlay layers registers a history entry, so a browser or hardware Back with a layer open pops the *view behind it* — or leaves the app entirely — instead of closing the layer.

**Evidence.** Grep for `pushState|replaceState|popstate` across the tree returns hits only in `nav.js`. `LmsUi.openPlayer` (`ui.js:638-641`), `ui.queueOpen`, the action/info sheets, `filterPanel` and `openSearch`/`closeSearch` (`ui.js:959-977`) never call into `LmsNav`.

**User Impact.** On Android and on any browser with an edge-swipe Back gesture this is the single most disruptive class of SPA behaviour: the user's dismiss gesture navigates instead of dismissing. Escape does work correctly for the sheets and the filter panel on desktop — that part is verified.

**Recommended Fix.** Push a lightweight nav frame (or a dedicated overlay history entry) when a layer opens, and close the layer on `popstate` instead of navigating.
**Regression Risk.** Interacts with EC-007 and EC-009; do these together.

---

### EC-017
**Title:** Pressing Apply in the filter panel reloads the entire library and discards the open detail even when nothing changed
**Area:** Filter panel → My Music list
**Detected by perspective:** Engineering
**Category:** Defect — unnecessary side effect
**Severity:** P3
**Reproducibility:** **Code-confirmed, runtime [Unverified]**; the reload cost itself is runtime-confirmed (see EC-021)

**Evidence.**
```js
/* ui.js:765-775 */
state.filters = entry.filters.slice();
state.group   = entry.group.slice();
```
`.slice()` returns a new array reference every time, so the non-deep watchers
```js
/* browse.js:542-543 */
'ui.filters': function () { this.reload(false); },
'ui.group':   function () { this.reload(false); },
```
fire on every Apply regardless of whether the draft changed. `reload(false)` then runs
```js
/* browse.js:1347-1350 */
if (!preserveNavigation) {
  this.rootSelection = null;
  LmsNav.reset('music');
}
```
so the album or artist open in the right pane is thrown away.

The same reference-churn causes a triple reload on every root switch: `adopt()` (`ui.js:680-683`) reassigns `filters`, `sort`, `group` and `sections` in one flush, and `watch.view`, `watch['ui.filters']` and `watch['ui.group']` each call `reload(false)`. Three concurrent paging loops are dispatched; the first two only bail *after* their first round trip returns. `LmsNav.reset` and `history.replaceState` each run three times.

**Recommended Fix.** Compare the draft against current state before assigning, or make the watchers compare values rather than references. Coalesce the root-switch reloads with a `$nextTick` guard.
**Regression Risk.** These watchers are the main data-refresh trigger; verify that a genuine filter change still reloads.

---

### EC-018
**Title:** Numbers, sample rates and bit depths are formatted with hard-coded Portuguese conventions in the English UI
**Area:** `format.js`, Settings → About, mini player, full player
**Detected by perspective:** Multiple (UX, Engineering)
**Category:** Defect (i18n) / Consistency
**Severity:** P3
**Reproducibility:** Always

**Evidence — runtime, English UI.** Settings → About shows `Artists 1.601`, `Albums 1.464`, `Songs 14.797`. The player badge shows `44,1 kHz`. In `en-GB`/`en-US`, `1.601` reads as *one point six zero one*.

**Evidence — code.**
```js
/* format.js:14-16 */
function count(n) {
  return String(Math.round(finite(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
/* format.js:52-59 */
return text.replace('.', ',') + ' kHz';
/* format.js:61-64 */
return ss ? ss + ' bits' : '';   // em pt-BR a unidade vai no plural
```
There is no `toLocaleString`, no `Intl`, no `NumberFormat` anywhere in the tree.

**User Impact.** A factual misstatement of library size to an English reader, not merely a cosmetic difference.
**Recommended Fix.** Route `count` through `Intl.NumberFormat(LmsStr.lang)` and derive the decimal separator the same way. `LmsStr.lang` is already exported at `i18n.js:207`. `format.js` is correctly the single place this lives.
**Regression Risk.** `tests/format.test.js` asserts the current output; update it.

---

### EC-019
**Title:** 76 bound `:aria-label` / `:title` / `:placeholder` attributes can never be translated
**Area:** `i18n.js`, 14 component files
**Detected by perspective:** Engineering
**Category:** Accessibility Issue + Defect (i18n)
**Severity:** P3
**Reproducibility:** Confirmed by executing `i18n.js` in isolation

**Evidence.**
```js
/* i18n.js:114 */
var ATTRS = /\s(aria-label|title|placeholder|aria-valuetext|aria-description)="([^"]*)"/g;
```
The leading `\s` requires whitespace immediately before the attribute name, so ` :aria-label="…"` and ` v-bind:title="…"` never match. The comment at `i18n.js:156-157` claims the dynamic ones are resolved at runtime by `t()` — they are not; `translateTemplate` only wraps text between tags.

Executed with a Portuguese dictionary:
```
in : :aria-label="'Back to ' + back"   title="Search"   placeholder="Search the library"
out: :aria-label="'Back to ' + back"   title="Buscar"   placeholder="Buscar na biblioteca"
```
Static attributes translate; bound ones do not. 76 bound attributes across 14 files (9 in `browse.js`, 15 in `nowplaying.js`, 5 each in `playlists.js` and `queue.js`, 4 each in `albumblock.js`, `filterpanel.js` and `settings.js`, 3 in `chrome/navbar.js`).

**User Impact.** For a screen-reader user running the skin in Portuguese, most accessible names remain in English. This is the largest single accessibility gap found.
**Recommended Fix.** Extend `ATTRS` to match `:`/`v-bind:` forms and wrap the expression in `$t(...)`, or add a `t()` call at each binding site.
**Regression Risk.** Template rewriting is global; a bad regex could corrupt bindings. Add a unit test per attribute form.

---

### EC-020
**Title:** The "Loading more items…" banner is pinned permanently when a media sort is chosen from the toolbar
**Area:** `browse.js loadMediaIndex`
**Detected by perspective:** Engineering
**Category:** Defect
**Severity:** P3
**Reproducibility:** **Code-confirmed, runtime [Unverified]**

**Evidence.**
```js
/* browse.js:1052-1066 */
loadMediaIndex: async function (pid, token) {
  if (this.mediaIndex) return this.mediaIndex;
  …
  this.loadingMore = true;
  while (keepGoing && start < 100000) {
```
The function returns at `:1095` without resetting the flag. Every other caller sits inside `loadPagedRoot`/`reload`, which overwrite it — but `ensureMediaIndex` is also reached from `watch['ui.sort']` (`browse.js:550`), and a sort change does not reload. Cold media cache plus toolbar → Sort by → Format / Local library first / Highest resolution first leaves the banner at `browse.js:178` stuck at the bottom of the list.

Related, same function: `ensureMediaIndex` reads the token rather than minting one (`browse.js:845 var token = this.requestToken;`), and `this.mediaIndex` is only assigned after the whole loop, so two rapid triggers both pass the guard and both page the entire library with the same token — neither cancels the other.

**Recommended Fix.** Reset `loadingMore` in a `finally`; mint a token with `++`; set an in-flight promise so concurrent callers await the same scan.
**Regression Risk.** Low; contained to the media index path.

---

### EC-021
**Title:** The first media filter of a session blocks the list on a bare "Loading…" for about 20 seconds
**Area:** My Music → Filters → Format
**Detected by perspective:** Testing
**Category:** UX Issue (performance / feedback)
**Severity:** P3
**Reproducibility:** Cold cache only — observed once; the warm repeat is reproducible and fast

**Evidence.** Albums view, applied Format = FLAC. The list showed only the word "Loading…" — no spinner, no progress, no count — through screenshots at 3s and 11s, and had rendered by ~21s, producing 1,397 albums plus the notice "1 album was left out because it has no media information." After "Clear all", re-applying the identical filter completed in **1,901 ms**, measured with a `MutationObserver` from the click on Apply to the removal of the loading text.

**Expected Behavior.** Long operations should show progress or at least a determinate indicator.
**Actual Behavior.** A static word for ~20 seconds, indistinguishable from a hang.
**User Impact.** The first use of any media filter looks broken.
**Likely Technical Cause.** [Inference, code-supported] The cold path is `loadMediaIndex` paging the entire track table (`browse.js:1066`, up to 100,000 tracks) to build the client-side media index.
**Recommended Fix.** Show a determinate progress indicator driven by the paging loop, or build the index in the background at idle rather than on first demand.
**Regression Risk.** None if purely presentational.

---

### EC-022
**Title:** The filter panel's "Search within filters" box hides the section whose name you type
**Area:** Filter panel (`filterpanel.js`)
**Detected by perspective:** Engineering
**Category:** Defect
**Severity:** P3
**Reproducibility:** **Code-confirmed, runtime [Unverified]**

**Evidence.**
```js
/* filterpanel.js:315-321 */
show: function (title) {
  if (!this.needle) return true;
  if (this.matches(title)) return true;
  if (title === 'Format') return this.visibleFormats.length > 0;
  if (title === 'Genre')  return this.visibleGenres.length > 0;
  return false;
},
```
It is called with Portuguese keys against English legends: `show('Qualidade')` at line 100 for the legend "Audio quality" (line 101), `show('Agrupar')` at line 125 for "Group by" (line 126), `show('Preference')` at 135 for "Playback preference" (136). Typing `quality`, `group` or `playback` therefore hides exactly the section named that. There is also no "no matches" state — a needle matching nothing leaves an empty panel body with only Cancel / Apply / Clear all.

**Recommended Fix.** Pass the same string to `show()` that is rendered in the legend, and add an empty-result message.
**Regression Risk.** Low.

---

### EC-023
**Title:** The A–Z rail is shown for sorts that are not alphabetical, where jumping is meaningless
**Area:** My Music list
**Detected by perspective:** Engineering
**Category:** UX Issue
**Severity:** P3
**Reproducibility:** **Code-confirmed, runtime [Unverified]**

**Evidence.**
```js
/* browse.js:446-448 */
return !this.loading && this.rows.length > 30 && this.sortKey !== 'recent' &&
       !this.sectionKey && !LmsUi.sortNeedsMedia(this.sortKey) &&
       (this.view === 'artists' || this.view === 'albums' || this.view === 'recent');
```
The guard excludes `recent`, sections and media sorts, but not `artist` and not `year`. In Albums sorted by Year the list is not label-ordered, yet the rail renders; `jump('M')` finds the first row whose *label* starts with M, which may be anywhere, and `activeRail` jitters during scrolling. With sort = Artist, `railLetter` reads `row.label` — the album title, not the artist.

Also: visibility is gated on `rows.length` (raw) while content walks `displayRows` (filtered), so a text filter leaving 3 rows still renders all 27 dimmed letters, and clicking any of them does nothing.

**Recommended Fix.** Extend the guard to alphabetical sort keys only, and gate visibility on `displayRows`.
**Regression Risk.** Interacts with EC-002's condensation change; do them together.

---

### EC-024
**Title:** OPML search results are stored whole inside every history entry and in localStorage
**Area:** `opmlview.js`, `nav.js`
**Detected by perspective:** Engineering
**Category:** Defect (robustness)
**Severity:** P3
**Reproducibility:** **Code-confirmed, runtime [Unverified]**

**Evidence.**
```js
/* opmlview.js:188-190 */
LmsNav.push(this.tab, {
  kind: 'opml', label: 'Resultados: ' + term, term: term, preloaded: hits
});
```
`hits` is up to 200 OPML results. That frame is then deep-cloned into every subsequent history state (`nav.js:50 frames: JSON.parse(JSON.stringify(stack(tab)))`) and written to `localStorage` on every push and pop (`nav.js:31-38`). `persist()` swallows `QuotaExceededError` in a bare `catch (e) {}`, silently losing the nav stack. `history.pushState` at `nav.js:57` is not guarded at all; browsers cap serialized history state and the throw would propagate out of a Vue click handler. `[Unverified]` which browser trips first.

**Recommended Fix.** Store `term` only and re-fetch on restore, or strip `preloaded` before persisting and before building the history state.
**Regression Risk.** Restoring an OPML search would then require a round trip.

---

### EC-025
**Title:** The virtualised window is sized from row height only, and is never recomputed on resize
**Area:** `browse.js` virtual list
**Detected by perspective:** Engineering
**Category:** Rendering Issue
**Severity:** P3
**Reproducibility:** **Code-confirmed, runtime [Unverified]**

**Evidence.**
```js
/* browse.js:664-669 */
this.visible = Math.ceil(e.target.clientHeight / this.rowH);
/* browse.js:510 */
windowed: function () { return this.displayItems.slice(this.first, this.first + this.visible + 12); },
```
Section headers are 34px (`ios9.css:1544`) while `rowH` is 72 or 88. With an 800px scroller in Albums, `visible` is 10 and the window is 22 items, of which 6 are the pre-buffer — 16 rendered below the top. Sectioned by Format or Decade with many small buckets, 16 items can measure 16 × 34 = 544px against an 800px viewport, leaving the bottom quarter blank until the next scroll event.

Neither resize handler recomputes `visible` (`browse.js:614-619`); it is set only in `onScroll` and in the `reload` `$nextTick`. Making the window taller without scrolling leaves the bottom empty.

Related: turning sectioning on or off changes both the item count and the total height but resets neither `first` nor `scrollTop` (`browse.js:548-557` — only `ui.filter` resets the window).

**Recommended Fix.** Compute `visible` from the mixed heights `itemOffsets` already knows, and recompute on resize and on `ui.sections` change.
**Regression Risk.** Core list rendering; test with sections on and off in every root.

---

### EC-026
**Title:** The right-hand detail pane has a reachable state with no controls, no explanation and no way forward
**Area:** `detail.js`
**Detected by perspective:** UX
**Category:** Dead End
**Severity:** P3
**Reproducibility:** **Code-confirmed, runtime [Unverified]** — depends on the library containing an album-less contributor

**Evidence.**
```html
<!-- detail.js:38-51 -->
<template v-else>
  <div class="albumgrid">…</div>
  <div v-if="!albums.length" class="empty"><div class="p">No albums for this item.</div></div>
```
When `frame.kind` is `artist`, `genre` or `year` and the query returns nothing, the pane shows the hero (a `<div class="name">`, not a button — `detail.js:24-31`), an empty grid and that one sentence. No retry — unlike the error branch at `detail.js:11-14` — and nothing to click.

Most reachable path: Albums → Group by → Related artist, whose rows come from the contributor table (`browse.js:1251-1252`). A composer or track-level contributor has no album under `artist_id`, so `detail.js:207` returns `[]`.

Escape is not impossible on desktop — the chrome Back button exists because `depth === 1`. But **below 700px the left pane is hidden** (`ios9.css:1465`), so the entire screen is that one sentence, and EC-001 has broken the navbar's other controls on exactly this screen.

**Recommended Fix.** Give the empty branch the same retry/back affordances as the error branch, and say *why* (no albums credited to this contributor).
**Regression Risk.** Low.

---

### EC-027
**Title:** The truncation warning for a genre-filtered Recent view never fires
**Area:** `browse.js` Recent
**Detected by perspective:** Engineering
**Category:** Defect — silent truncation
**Severity:** P3
**Reproducibility:** **Code-confirmed, runtime [Unverified]**

**Evidence.**
```js
/* browse.js:1365-1383 */
var batches = await Promise.all(recentGenres.map(function (id) {
  return LmsApi.albums(pid, 0, 250, { sort: 'new', genreId: id });
}));
… al = [];   // rebuilt locally after cross-genre dedup
var recentSourceCount = al.sourceCount == null ? al.length : al.sourceCount;
/* browse.js:1395-1397 */
if (recentSourceCount === 250) { this.limitWarning = 'Recent shows the 250 newest albums…'; }
```
`sourceCount` is a **non-enumerable** own property set by `api.js:84-88 pageMeta`; it does not survive the array being rebuilt, so the ternary falls back to the post-dedup length. Two genres each capped at 250 with 40 overlapping albums gives `al.length === 460` and the `=== 250` test fails. The exact-equality test is fragile in its own right — `>= 250` would be safer.

The rest of browse.js's paging is correct and consistently prefers the server count (`browse.js:1258, 1312-1313`); this is the one place it does not.

Same family, lower confidence: `detail.js:183-185` and `:207-209` test `.length >= 200` / `>= 1000` on arrays that `api.js:297-315` returns *without* `sourceCount` for merged artists, so a merged-artist discography can be truncated with no banner.

**Recommended Fix.** Track the server counts per batch and sum them before dedup; use `>=`.
**Regression Risk.** Low.

---

### EC-028
**Title:** Settings option group for the interface font has no section header
**Area:** Settings → Appearance
**Detected by perspective:** UX
**Category:** Consistency Issue
**Severity:** P3
**Reproducibility:** Always

**Evidence.** Between "Accent colour" and "Player layout" there is an empty grey section bar followed by the rows *System (default)*, *Helvetica*, *Chicago*, *Podium Sans*, *Espy Sans*. Every other group in the screen has a header: PLAYER, PLAYBACK, APPEARANCE, QUEUE, GENERAL, LANGUAGE, BACKUP, ABOUT. The QUEUE art-mode group even has an explanatory line above its options; this one has nothing.

**User Impact.** Five bare typeface names with no label. A user who does not recognise "Espy Sans" as a font has no way to know what the list controls.
**Recommended Fix.** Add a section header (and, matching the QUEUE group, a one-line description).
**Regression Risk.** None.

---

### EC-029
**Title:** Returning from a Settings sub-screen resets the Settings list to the top
**Area:** Settings
**Detected by perspective:** UX
**Category:** State/Continuity Issue
**Severity:** P3
**Reproducibility:** Always

**Evidence.** Scroll Settings to the bottom, open "Advanced LMS settings", press `‹ Settings`. The list returns scrolled to the very top; the row that was just used is off-screen.
**Expected Behavior.** Consistent with the skin's own drill-down behaviour in My Music, where returning preserves position.
**Recommended Fix.** Save and restore the scroller position on the settings nav frame.
**Regression Risk.** Low.

---

### EC-030
**Title:** The Back control inside embedded LMS settings is in a different place from every other Back in the skin
**Area:** Settings → Advanced LMS settings
**Detected by perspective:** UX
**Category:** Consistency Issue
**Severity:** P4
**Reproducibility:** Always

**Evidence.** This screen puts `‹ Settings` in a second bar below the navbar, while the navbar itself still shows the unchanged "Settings" title and no back chevron. Every other drill-down in the skin puts Back in the navbar.
**User Impact.** Minor, but it is compounded by EC-008: the reflex Back gesture fails here *and* the working control is not where the user has learned to look.
**Recommended Fix.** Move the control into the navbar, matching the rest of the app.
**Regression Risk.** The secondary bar also carries the "LMS settings" caption; keep it or relocate it.

---

### EC-031
**Title:** The filter panel has two "Apply" buttons
**Area:** Filter panel
**Detected by perspective:** UX
**Category:** UX Issue
**Severity:** P4
**Reproducibility:** Always

**Evidence.** `button.back-command.filter-apply` "Apply" at `[700,65]` in the header and `button.filter-option.filter-apply-main` "Apply" at `[646,701]` in the footer. Both enabled, same action. The footer one renders lighter, which reads as disabled but is not.
**Recommended Fix.** Keep one. If the footer pair (Clear all / Apply) is the intended pattern, remove the header Apply and leave Cancel.
**Regression Risk.** Both are wired to the same handler; removing one is safe.

---

### EC-032
**Title:** Segmented Albums/Tracks tabs have no selected state when the detail screen is first opened
**Area:** `chrome/navbar.js`, artist and album detail
**Detected by perspective:** Multiple (UX, Accessibility)
**Category:** Accessibility Issue + UX Issue
**Severity:** P3
**Reproducibility:** Always

**Evidence.** On entering an artist detail, the pane renders the Albums grid but both tabs report `aria-selected="false"` with identical computed colour `rgb(0,119,176)` and transparent background. After clicking either tab, the selected one gains `class="seg pointer on"`, `aria-selected="true"`, a filled accent background and white text. So the styling and ARIA are correct — they are simply not applied to the default mode. The `tablist` also has no `aria-label` and there is no `aria-controls`/`tabpanel` relationship.
**User Impact.** Sighted users cannot tell which view is active on arrival; screen-reader users are told none is.
**Recommended Fix.** Initialise `albumMode` to the mode actually rendered on entry, add `aria-label` to the tablist and `aria-controls` to each tab.
**Regression Risk.** `setAlbumMode` (`ui.js:923-927`) persists the mode; make sure the default does not overwrite a remembered choice.

---

### EC-033
**Title:** The playback-queue header pairs a whole-queue count with a from-current-position duration
**Area:** Playback queue (`queue.js`, `store.js`)
**Detected by perspective:** Multiple (UX, Engineering, Testing)
**Category:** UX Issue / Consistency
**Severity:** P3
**Reproducibility:** Always

**Evidence.** Runtime, with the queue open, the header read **"11 tracks · 5 min remaining"**. Measured state:

```
queueTotal 11 · loaded 11 · queueIndex 10 · time 0
durations  536.1 282.4 320.8 316.7 290.0 350.7 293.5 308.8 236.7 348.3 317.1  (sum 3601s = 60 min)
queueRemaining() 317.1s = 5:17
```
The count describes all 11 tracks; the duration describes only what is left from the current index. Joined by `·` they read as one fact about one set — "eleven tracks lasting five minutes" — which is wrong by a factor of twelve.

```js
/* queue.js:20 */  {{ countLabel }} · {{ remaining }}
/* queue.js:98 */  var total = this.store.queueTotal || this.tracks.length;
/* store.js:847 */ function queueRemaining() { … if (t.index < current) return a; …
```
Two further code-level issues in the same computation, **[Unverified] at runtime**: `queueRemaining()` iterates the ≤500-row window while `countLabel` uses the server total, so past 500 tracks the time under-reports without the count doing so; and when the sum is 0 the header falls back to the word **"live"**, which is wrong for a finished queue.

A third, separate concern: `state.queueIndex` is written only in `loadQueue` (`store.js:531`); the 1-second poll receives a fresh `playlist_cur_index` (`api.js:547`) and discards it. If that is right, natural track advance never updates the ▶ marker or the "Play will start" line until the queue is explicitly reloaded. I attempted to confirm this by skipping tracks and could not get the player to advance while stopped, so it stays **[Unverified]**. To settle it: start playback, let one track finish, and read `LmsStore.state.queueIndex` against `(await LmsApi.status(LmsStore.state.playerId)).index`.

**Recommended Fix.** Label the two figures distinctly — e.g. "11 tracks · 5:17 left in this track", or show total queue duration alongside remaining. Make `refresh()` adopt the polled index.
**Regression Risk.** The ▶ marker and "Play will start" read the same field.

---

### EC-034
**Title:** A single transient capability probe failure hides the rating control for the rest of the session
**Area:** `store.js loadCapabilities`
**Detected by perspective:** Engineering
**Category:** Defect
**Severity:** P3
**Reproducibility:** **Code-confirmed, runtime [Unverified]**

**Evidence.**
```js
/* store.js:214-224 */
async function loadCapabilities() {
  if (capabilitiesRequested) return;
  capabilitiesRequested = true;
  try { state.capabilities = await api.canCommands(CAPABILITY_PROBES); }
  catch (e) { state.capabilities = {}; }
```
The latch is set *before* the await, so the catch branch is terminal. `state.canRate` stays false for the page's lifetime and the retry in `refresh()` (`store.js:263`) is a no-op, so `nowplaying.js:146 v-if="store.canRate && np.id"` never renders the stars.
**Recommended Fix.** Set the latch on success only, or clear it in the catch.
**Regression Risk.** Low.

---

### EC-035
**Title:** "Sleep after this track" stops playback in one second on a live stream
**Area:** `store.js sleepAfterTrack`
**Detected by perspective:** Engineering
**Category:** Defect
**Severity:** P3
**Reproducibility:** **Code-confirmed, runtime [Unverified]**

**Evidence.**
```js
/* store.js:747-749 */
function sleepAfterTrack() {
  return setSleep(Math.max(1, Math.ceil(state.duration - state.time)));
}
```
For a radio stream `state.duration` is 0 (`api.js:559 live: duration === 0`), so the expression is negative and the clamp yields 1 second. `seek()` guards on exactly this condition (`store.js:778`); the sleep path does not. Note the Settings UI already disables "Stop at end" with the note *"Available during playback: with nothing playing there is no end to wait for."* — the same reasoning has not been applied to live streams.
**Recommended Fix.** Disable the control when `state.np.live` is true, matching `seek()`.
**Regression Risk.** Low.

---

### EC-036
**Title:** Raw JSON-RPC error strings are shown to the user from the action sheet
**Area:** `actions.js`
**Detected by perspective:** Engineering
**Category:** UX Issue
**Severity:** P4
**Reproducibility:** **Code-confirmed, runtime [Unverified]**

**Evidence.**
```js
/* actions.js:227, :253 */
LmsUi.notify('Could not update favourites. ' + e.message, 'error', 6500);
```
`LmsError.message` is `'[' + kind + '] ' + cmd.join(' ') + ': ' + detail` (`api.js:12`), producing text like `[http] favorites add url:… : HTTP 500`. `store.js:331-332` states the rule that the user must never read the protocol string, and exports `friendlyError` (`store.js:921`) for this purpose. Two implementations of the same concern have drifted.
**Recommended Fix.** Route both call sites through `friendlyError`.
**Regression Risk.** None.

---

### Lower-severity items, recorded without full treatment

| ID | Finding | Category | Sev | Verification |
|---|---|---|---|---|
| EC-037 | The filter input's accessible name is `"Filteralbums"` — a missing space in `:aria-label="'Filter' + viewLabel.toLowerCase()"` (`browse.js:38-39`) | Accessibility | P4 | Runtime-confirmed |
| EC-038 | The split-options toolbar button is named only by `title="Split options"`, while every sibling icon button uses `aria-label` | Accessibility / Consistency | P4 | Runtime-confirmed |
| EC-039 | A favourited **track** is listed in Favourites with the radio/stream glyph `((o))` | Rendering | P4 | Runtime-confirmed |
| EC-040 | A stray `localStorage` key literally named `function j(t,e,n){}` exists on this origin. Traced: Vue 2 replaces any non-function value in a `methods` block with its minified `noop`, and an earlier build of `browse.js` used `this.storageKey` there. The bug is already fixed (`browse.js:585-587` documents it; the key now lives on `LmsSplitPane`), so this is dead residue that nothing reads or recreates | Defect (residue) | P4 | Runtime-observed, cause code-confirmed |
| EC-041 | The Apps tab shows a generic folder icon for Qobuz, MyQobuz and Sounds & Effects. `opmlImage()` computes an `image` field no template reads | Rendering | P4 | Runtime-confirmed (known backlog item) |
| EC-042 | Global search does not reach online services. Confirmed still true: `api.js:search()` issues only the local `search` command and a `playlists` search, so Qobuz content is reachable only through the Apps tab's own search box. **This is a missing feature, not a defect** — recorded as a Potential Improvement | Potential Improvement | — | Runtime-confirmed |
| EC-043 | Dead code with no reader: `LmsApi.loadTrack`, `state.playerPicker`, the `randomplay`/`dontstopthemusicsetting` probes (`store.js:208-210`, two RPCs per page load), `saved.trackId`/`saved.time`, `detail.js:131-145` (an unreachable copy of `albumblock.js`'s track methods that would throw — `detail.js` has no `tracks` in `data`), `sortSelectLabel` (`browse.js:292`) | Maintainability | P4 | Code-confirmed |
| EC-044 | "Edition" means two different things: `browse.js:853-860` groups editions by exact title+artist, `detail.js:92-97` strips `(Remastered)`/`(Deluxe)` etc. The same two albums do or do not offer an edition choice depending on which pane you are in | Consistency | P3 | Code-confirmed |
| EC-045 | The same concept is labelled three ways: the list subtitle says "Streaming" (`browse.js:974-980`), the filter chip says "Remote / streaming" (`browse.js:1203`), the detail pane says "Remote / streaming" (`albumblock.js:158-165`) | Consistency | P4 | Code-confirmed |
| EC-046 | `trackSearchInfo` (`api.js:269-272`) reads `info.coverId`, which `songInfo` never produces, and unconditionally recomputes `source` with `remote` hard-coded to `false` — clobbering the correct value and labelling remote tracks "Local library" | Defect | P3 | Code-confirmed |
| EC-047 | The 100,000-track media-index cap (`browse.js:1066`) has no truncation warning, unlike every sibling loop. Albums past the cap surface as *"N albums were left out because they have no media information"*, attributing a paging cap to missing tags | Defect | P3 | Code-confirmed |
| EC-048 | `api.js:297-311` `albums()` with `artistIds` caps each sub-request at the caller's page size and returns a plain `slice`, discarding `pageMeta`'s `sourceCount`; every consumer then has to guess at paging | Defect | P3 | Code-confirmed |
| EC-049 | The action sheet's favourite toggle calls `LmsApi` directly and never calls `LmsStore.refreshFavorite(true)` (`actions.js:220-225`), so the now-playing heart stays wrong until the track changes. It also lacks the staleness guard `store.js:450-454` has, so a stale index can delete the wrong favourite | Defect | P3 | Code-confirmed |
| EC-050 | The horizontal "Recently played" strip loads with `scrollLeft = 10` against a `padding-left:10px`, so the first card sits flush against the pane edge while all others have a 12px gap | Rendering | P4 | Runtime-confirmed |

---

## Cross-Interface Patterns

Five root patterns account for most of what is above. Fixing the pattern is worth more than fixing the instances.

**1. Unscoped CSS and unreserved space.** EC-001, EC-002, EC-003. Three separate screens break because a rule applies wider than intended (`.segmented`), or because a container assumes room it never checks for (`.rail` 648px of content in a variable-height column; `.selection-bar` 44px of fixed overlay over a scroller with no padding). The stylesheet's own comments predict two of the three. A rule of thumb worth adopting: any fixed or absolutely positioned chrome must either reserve layout space or be paired with matching padding on what it covers, and any rule that styles a shared class name must be scoped to a component.

**2. Two implementations of one operation, then drift.** EC-006, EC-014, EC-036, EC-044, EC-045, EC-049. Album rows are built in two places with different tag sets. Favourites are toggled in two places, one hardened against stale indexes and one not. Errors are presented two ways, one through `friendlyError` and one raw. "Edition" is defined twice, incompatibly. Player-scoped await discipline is applied in `clearUpcoming`/`undoQueue`/`refresh` and omitted in `removeFromQueue`/`clearQueue`/`setRating`. In every case one copy has the fix and the other does not.

**3. Translation by concatenation.** EC-005, EC-018, EC-019. The dictionary is keyed by whole English phrases, and the codebase repeatedly builds user-facing text by gluing fragments together — `count + ' selecionado' + (s)`, `'Resultados: ' + term`, `'Abrir o player' + title`, `added + ' itens adicionados' + ' to the playback queue.'`. Each one is permanently untranslatable, and several have unused keys already sitting in `strings.txt`. The same class of problem produced the 76 untranslated bound attributes.

**4. Controls offered that the renderer ignores.** EC-012, EC-013, EC-023. A sort direction toggle on a root whose comparator never runs; media sorts on rows that carry no media; an alphabet rail over a non-alphabetical order. The control renders, responds and persists — and nothing happens. This is worse than a missing control because it teaches the user the feature is broken rather than absent.

**5. Truncation that is sometimes announced and sometimes not.** EC-014, EC-027, EC-047, EC-048. The codebase clearly *knows* about this — `notifyTruncated`, `limitWarning`, `artistIndexTruncated`, `genreOverflow` all exist and work. The gaps are where a locally-rebuilt array loses the non-enumerable `sourceCount`, or where a loop simply never got a warning. Making `sourceCount` a normal enumerable property, or wrapping page results in an object rather than decorating an array, would close most of them at once.

---

## Navigation and State Assessment

**What works, verified.** Browser Back and Forward are properly wired for the things that have history entries. Drilling into an artist and pressing Back returns to the list; Forward restores the detail. Back at the root of a tab correctly undoes the previous tab switch (music → settings, reproduced twice). Reloading on a nested view restores tab, root view and the open detail from `localStorage`. Per-root filter, sort, group and section state is stored under `byView` and survives root switches, drill-downs, tab switches and reload. This is a genuinely good foundation and none of it should be disturbed.

**What does not.** Three gaps, in order of user impact.

*Search is outside the model.* Opening a result clears the query and rewrites the current history entry, so there is no way back to results (EC-007). Search has no nav frame at all.

*Overlays are outside the model.* The full player, the queue, the action and info sheets, the filter panel and the search overlay register nothing, so Back dismisses the page behind them instead of the layer (EC-016). Escape does work for the sheets and the filter panel — that is the pattern to extend.

*The embedded LMS settings iframe fights the host.* Back neither exits the sub-screen nor leaves the embedded page coherent (EC-008), and the working exit is in an unusual position (EC-030).

**Structural note, not itself a defect.** There is no URL routing of any kind: `location.hash` and `pathname` are never read or written, and every `pushState` omits the URL argument. Every history entry has the same address and the same document title. The consequences are real — no deep links, nothing shareable, no per-view refresh target, two tabs of the skin fighting over the same `localStorage` keys, and a Back/Forward long-press menu of identical entries. Whether to introduce routing is a product decision well beyond this audit's scope; I record it because several of the navigation findings above are symptoms of its absence, and because a fix for EC-007 and EC-016 would be much simpler with it.

**Continuity gaps worth naming separately.** The list's text filter is the only piece of view state that is neither per-root nor persisted (`ui.js:430`), so it leaks into the next root and vanishes on reload. Scroll position is lost on tab switch and on reload, and the restore path in `closeSearch` is overwritten by `reload`'s own `scrollTop = 0` (`ui.js:966-977` vs `browse.js:1421-1428`). Multi-selection survives changes that make its contents invisible (EC-011). Settings loses its scroll position on return (EC-029).

---

## Responsive Assessment

Tested at 1920×1080, 1512×861, 1440×900, 1280×600, 1100×800, 834×1112, 784×382, 700×900, 390×844 and 360×640, measured in the live page and in a same-origin iframe harness.

**Good.** No horizontal overflow at any width — `document.scrollWidth` equals the viewport at every size tested, and no element exceeds the viewport width. The split view collapses correctly: the right pane is 863px at 1440, 523px at 1100, 350px at 834, and 0 (single pane) at 390 and 360. The tab bar keeps six 50px-tall targets down to 360px. Toolbars reflow to two lines rather than clipping.

**The one systemic responsive defect is vertical, and it is EC-002.** The A–Z rail requires a viewport at least ~893px tall and degrades continuously below that:

| viewport | letters lost at each end |
|---|---|
| 1440×900, 834×1112, 1920×936 | none |
| 1512×861, 390×844 | 1 (A and #) |
| 1100×800 | 2 |
| 360×640 | ~5 |
| 1280×600 | 6 (A–F, U–#) |
| 784×382 | ~10 — only about five letters visible |

Note that a standard 1512×861 MacBook viewport is already below the threshold, so this affects the primary development machine, not just edge cases.

**EC-001 is width-independent and worse at small widths.** The auto-margin defeats centring identically at 390px and 1920px, but the smaller the viewport the larger the proportion of each control that is covered: at 1512px the title picker loses 79 of its 79px to the Back button's footprint and the Tracks tab keeps ~18 clickable pixels; at 390px the Tracks tab is entirely inside the search button.

**EC-003 is height-independent:** the measured overlap between the selection bar and the scroller is exactly 44.0px at every height from 861 to 1080.

**Below 700px** the left pane is hidden entirely (`ios9.css:1465`), which makes EC-026's dead-end pane occupy the whole screen and makes EC-001's broken navbar the only chrome available on it.

**Very low heights** (784×382) leave a single 88px album row visible in the list. That is a consequence of fixed chrome consuming 244.5px and is arguably acceptable, but combined with the rail collapse it makes long lists effectively unnavigable.

I did not test a real touch device or a device with a notch/`safe-area-inset`. `[Unverified]` for those.

---

## Accessibility Assessment

No WCAG conformance claim is made. What follows is measured behaviour only.

**Verified good, and unusual to find.** Every one of the 64 interactive elements on the browse screen resolves an accessible name. No interactive element measures under 24px in either dimension. Landmarks are present and correct (`header.app-header`, `main.workspace`, `footer.app-footer`) with a single `h1`. The tab bar is a proper `role="tablist"` with `aria-selected` tracking the active tab. The action sheet is `role="dialog"` with `aria-label="Actions for <item>"`, moves focus to its first command, closes on Escape and returns focus to the `…` button that opened it — verified end to end. The filter panel is `role="dialog"` `aria-modal="true"` with `aria-labelledby="filter-panel-title"`, moves focus to Cancel, closes on Escape and returns focus to the Filters button, has a real inner scroller and ships `visually-hidden` helper text. The A–Z rail is a correctly formed `role="slider"` with `tabindex="0"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="26"` and `aria-valuetext`. There are 12 `:focus-visible` rules in the stylesheet. Selected states use a checkmark, not colour alone.

**Confirmed barriers.**

*The accessible name of the full player is in the wrong language.* `role="dialog"` `aria-label="Reproduzindo agora"` in an English session (EC-005).

*Most accessible names cannot be translated at all.* 76 bound `:aria-label`/`:title`/`:placeholder` attributes are skipped by the translation regex, so a Portuguese-speaking screen-reader user hears English names throughout (EC-019). This is the largest accessibility defect found.

*The rail slider can address values that are not rendered.* `aria-valuemax="26"` while entries 0 and 26 are clipped out of view at any viewport shorter than ~893px (EC-002).

*The Albums/Tracks tabs report no selection on arrival.* Both `aria-selected="false"` while one of them is the view being shown; the `tablist` has no `aria-label` and no `aria-controls` (EC-032).

*Two controls the audit could reach are effectively unclickable by pointer* — the title picker and the Tracks tab (EC-001) — and the last row's select target activates Cancel (EC-003). Keyboard users are less affected than pointer users here, which is an unusual inversion.

*Minor naming defects:* the filter input announces `"Filteralbums"` (EC-037); the split-options button relies on `title` alone (EC-038).

**Not tested.** Colour contrast was not measured against WCAG thresholds (a `tools/check-contrast.py` exists in the repo and would be the right instrument). No screen reader was run. No keyboard-only end-to-end task was completed. `prefers-reduced-motion` was not exercised. `[Unverified]` for all of these.

---

## Recommended Remediation Order

Dependencies are called out because several of these touch the same code.

### Phase 1 — Blockers and Critical (P0/P1)

| Order | ID | Why first |
|---|---|---|
| 1 | **EC-000** | **Blocks everything.** Until the deployed tree and the snapshot agree, no fix can be verified and no finding can be trusted. Reconcile the build, then re-confirm EC-001 exists in the reconciled source. |
| 2 | **EC-001** | One-line CSS scope fix, restores two broken controls on every drilled My Music screen at every viewport. Depends on EC-000. |
| 3 | **EC-014** | Cross-room queue corruption with no recovery. Independent of the others; can proceed in parallel. |

### Phase 2 — Functional and Navigation (important P2)

| Order | ID | Notes |
|---|---|---|
| 4 | EC-003 | Do it by making the selection bar a layout row — that also fixes the rail's bottom clipping, so **do it before EC-002**. |
| 5 | EC-002 | Depends on EC-003 for the bottom edge. Implement the alphabet condensation the CSS comment already specifies; keep `aria-valuemax` in sync. |
| 6 | EC-015 | Same code area as EC-014 — batch them. |
| 7 | EC-006 | Fix by unifying the two album-row builders, which also pre-empts future drift. |
| 8 | EC-007 + EC-016 | **Do together.** Both need a nav frame for a layer that currently has none; the same mechanism serves both. |
| 9 | EC-009 | Same file as 8 (`nav.js`). Batch with it. |
| 10 | EC-008 | Diagnose before fixing — cause is currently `Not yet determined`. |
| 11 | EC-005 | The i18n root cause. Blocks EC-004's clean fix (which needs the existing `ITEM_SELECTED` keys) — **do EC-005 before EC-004**. |
| 12 | EC-004 | If you remove `.selection-bar` for EC-003, this may resolve itself. Check the EC-003 approach first. |
| 13 | EC-010, EC-011 | Both in `browse.js`/`ui.js` state handling; batch. |
| 14 | EC-012, EC-013 | Both are "control offered, renderer ignores"; batch and decide hide-vs-implement per case. |

### Phase 3 — UX, Responsive and Accessibility (remaining P2/P3)

EC-019 (bound-attribute translation — largest a11y win, depends on EC-005's approach), EC-032, EC-018, EC-017, EC-020, EC-021, EC-022, EC-023 (depends on EC-002), EC-025, EC-026, EC-027, EC-028, EC-029, EC-033, EC-034, EC-035, EC-044, EC-046, EC-047, EC-048, EC-049.

Suggested batching: all `format.js` locale work together (EC-018); all `browse.js` list-state work together (EC-010, EC-011, EC-017, EC-023, EC-025); all `store.js` robustness work together (EC-034, EC-035, EC-049).

### Phase 4 — Cosmetic and low risk (P4 and optional)

EC-030, EC-031, EC-036, EC-037, EC-038, EC-039, EC-040 (a one-line `localStorage.removeItem`), EC-041, EC-043 (dead-code removal), EC-045, EC-050.

**Potential improvements, explicitly not defects:** EC-042 (route the global search into the Apps OPML search so Qobuz results appear alongside local ones) and the six browse modes with no API surface at all — composers, works, music folder, random/mix, Don't Stop The Music, virtual libraries. Both are new feature work and deserve their own release, not a bug-fix pass.

---

## Coverage and gaps

**Exercised:** all six tabs; all five My Music roots; the root picker; artist, album, genre and year detail; the split pane; the filter panel; the sort menu; multi-select; the A–Z rail; global search (artists, albums, tracks); the album and track action sheets; the playback queue; the full player; Favourites (empty state and after adding one); Radio and Apps OPML roots plus one drill into Qobuz; Playlists; the whole Settings screen including the embedded LMS settings iframe; loading, empty and truncation-notice states; browser Back/Forward/reload; ten viewports.

**Not reached, and therefore not assessed — documented rather than assumed:**

- Deep OPML navigation inside Qobuz (search, purchases, playlists) beyond the first level.
- Favourites *folder* navigation. The library had no favourites at the start and the one I added is a track, not a folder, so I could not test drilling inside the Favourites tab. This matters: I observed a phantom navigation-stack key **`favoritos`** in memory alongside `favourites`, traced to `actions.js:415 <lms-opml root="favorites" tab="favoritos">`. `app.js:77` reads depth from `nav[ui.tab]` — i.e. `favourites`, which stays empty — so **[Inference, code-supported]** the Back chevron may never appear inside a Favourites folder and `goBack` may pop the wrong stack. Confirming this needs a favourites folder. **`[Unverified]`**
- Playlist editing (create, rename, reorder, delete) — I created no playlists.
- The player picker and multi-room handoff — only one player (SqueezeLite) was present.
- Settings → Player layout sub-screen, and the Export/Import of skin preferences.
- Rating controls (`store.canRate` was false in this session — see EC-034).
- Actual playback: I did not start audio, so track-advance behaviour, the progress bar, crossfade, sleep timers and the queue's ▶ marker under real advance were not observed. EC-033's stale-index question is open for this reason.
- Real touch input, screen readers, `prefers-reduced-motion`, and measured colour contrast.
- Screenshots became unavailable partway through the session (the capture API stopped responding). Findings after that point are evidenced by DOM measurement and hit-testing rather than images; nothing was inferred from an image I could not take.

**Left in your system by this audit:** one favourite, the track *"No Reply"* by The Beatles, added to test the favourites flow. I did not remove it — deleting is yours to do. Everything else (filters, sort, selection) was cleared.
