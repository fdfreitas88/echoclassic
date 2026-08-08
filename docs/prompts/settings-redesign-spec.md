# Echo Classic 3.2.6c — Settings redesign spec (approved mockup v4)

**This text is the source of truth.** `docs/settings-mockup.html`, if present, is a visual
reference only.

Target version for this work: **3.2.6c** (current tree declares 3.2.6b in install.xml and
Plugin.pm; repo.xml is pinned at 3.2.5).

## Principles

- toggle for binary
- segmented control for 2–3 options
- swatch row for colours
- checkmark rows for short lists
- chevron ONLY for dynamic lists or one true detail level
- **Zero `<select>` elements remain in Settings.**

## Target structure — main Settings screen, in this order

1. **Player** — Active player › (existing picker), Default player › (existing).
   The Volume slider row, "fixed volume" captions and any volume control are **REMOVED**
   from Settings — volume is operated in the player, not configured here.

2. **Playback** — Crossfade as ONE toggle: OFF means `transitionType` 0 and the footer reads
   "Off: gapless playback — songs join with no gap and no blend"; ON reveals a Duration slider
   row beneath it and the footer describes the blend. The old select with
   "No crossfade / gapless" is deleted.
   Sleep timer keeps the existing chips (15 min / 30 min / 1 h / End of song / End of queue)
   in one row, with the existing disabled-state hints.

3. **Appearance (inline — the subscreens die)**
   - Dark theme: ONE toggle. Must drive `LmsUi.toggleTheme()`, **never `state.dark` directly**
     — the gauge-per-theme swap depends on it.
   - Accent colour: inline swatch row, 5 dots, selected ring, aria per swatch.
   - Font: 5 inline checkmark rows, **EACH LABEL RENDERED IN ITS OWN TYPEFACE**.
   - Player layout › — the single remaining drill-in.

4. **Queue** — the 3 queue-artwork modes as inline checkmark rows with the existing hint line.
   The expandable `showQueueArt` block goes away.

5. **General** — the two existing toggles (Rate and bits, Highlight hi-res).

6. **Language** — existing checkmark radiogroup, unchanged behaviour.

7. **Backup** — Export / Import row (existing logic, incl. import confirm).

8. **About** — Artists/Albums/Songs/Genres counts, Server version, Skin version, lock-screen
   support note, Advanced LMS settings ›. The separate "Security and compatibility" and
   "Library"/"Server" headers merge here.

## Player layout — ONE screen, no deeper navigation

Top: a **"Show previews" toggle (default OFF)**. ON shows a live preview strip under each
player's section, rendered with the existing `surfaceAttrs` bindings.

Then three sections with identical grammar:

- **Full player**: Presentation segmented (Adaptive | Full screen) · "Match app appearance"
  toggle · custom rows when OFF · Progress bar segmented (Flat | Classic) · Bar colour
  swatches (Follow theme + schemes).
- **Small player**: Position segmented (Left | Center | Right) · Match app appearance toggle +
  the same custom rows. **No progress-bar rows** — the small player has no gauge in `ui.js`;
  do not invent one.
- **Mini player**: Match app appearance toggle + custom rows · Progress bar segmented ·
  Bar colour swatches.

### The custom rows — identical for all three players, revealed when Match app appearance is OFF

- **Theme**: segmented Light | Dark — a full per-player theme choice. Example target state that
  must work: app in Light/System while the Full player is Dark/Chicago.
- **Accent**: the 5-scheme swatch row.
- **Font**: the FULL five-option checkmark list (System, Helvetica, Chicago, Podium Sans,
  Espy Sans), each label rendered in its own typeface — the same control as the app-level font
  picker, **not** a compressed variant. One font-picking pattern everywhere.

"Match app appearance" maps to the existing `surfaceFollowsApp` state (`setSurfaceTheme` /
`setSurfaceScheme` / `setSurfaceFont` already exist per surface): ON sets theme/scheme/font to
`'app'`; OFF reveals the custom controls with their current values. Flipping ON again returns
all three to `'app'`. The nine "Follow app" option lists are replaced by these three toggles.

### DELETED as a consequence

`appearanceScreen` values `theme`, `colorScheme`, `font`, `progress`, `players`, `full`,
`small`, `mini`; their `openAppearanceScreen` calls; their entries in the settings nav stack;
the Progress bars screen (its controls now live only inside Full/Mini sections).
`appearanceScreenLabel`, `syncAppearanceScreen` and the `nav.settings` watch shrink or go —
**audit decides**.

## Fonts must be real in every browser

Today only Chicago renders in Chrome; the other choices silently fall back. Requirement: every
font option renders as its actual typeface in **Chrome, Safari and Firefox**, with **NO
dependency on fonts installed on the user's machine**. That means font files ship inside the
plugin package:

- Files under `EchoClassic/HTML/echoclassic/html/fonts/`, woff2 (plus woff only if a target
  browser needs it — verify, don't assume).
- `@font-face` rules in `ios9.css` with relative URLs, `font-display: swap`.
- The font checkmark rows (app-level AND all three per-player lists), and every surface that
  renders in a chosen face, use these files; **System stays the genuine platform stack.**
- A per-player font must render correctly even when the app-level font is different — **two
  bundled faces active at once.**
- Packaging: confirm the new files ride into the zip (`release.sh` derives the file count from
  the tree, so it should follow — verify in the plan), and that `Plugin.pm::getAssetRevision`
  cache-busts them like any asset.

### Licensing gate — HARD REQUIREMENT

Chicago, Espy Sans and Podium Sans are Apple-era typefaces. **Before bundling ANY file**, verify
the licence permits redistribution in a GPL-3.0 project submitted to the official LMS plugin
repository. For each of the five options report: **exact font file proposed, its licence, and
whether it may ship.** Where the original is not redistributable, propose a faithfully similar
openly-licensed face (there are open Chicago/Espy-style revivals) and mark it as a
**substitution for approval**. **Do not download anything** — list what is needed; the user
approves the network commands.

## Constraints

- **Preserve every persisted state key and its meaning.** This redesign changes how values are
  SET, not what is stored — export/import files from 3.2.5 must still import. **If any key must
  change, STOP and say so in the plan.**
- Keep the `radioKey` arrow-navigation pattern for checkmark groups; toggles keep
  `role="switch"`; segmented controls need a keyboard story — plan one.
- Every new or changed user-visible string goes through `i18n-ui`; the deleted subscreens strand
  entries in `strings.txt` — list them for removal.
- Gate 4 recomputes contrast: new swatch rings and segmented controls must pass in both themes
  and all five schemes.
- ES5 only. No new libraries.

## Phase 1 — audit and plan, STOP before editing

1. Map every row in the target spec to the existing setting/state key; confirm nothing is
   orphaned or invented.
2. List what dies: subscreens, selects, volume rows, nav entries, strings.
3. Resolve the nav question: with one drill-in left, what remains of the settings stack handling
   in `settings.js` and `app.js` goBack wiring.
4. Font licensing table (five rows, as above) + exact `@font-face` plan.
5. Test impact: which of `tests/*.test.js` break (uistate, sortmenu, settings-import, structure
   at least — verify) and what replaces them.
6. Commit plan: small reviewable commits ordered so each passes the gates.

Deliver **AC-XX acceptance criteria (Given/when/then)**, the death list, the licensing table and
the commit plan. Mark claims `[code]` / `[unverified]`. **STOP.**

### Two acceptance criteria that MUST appear among them

```
AC: Given the app is Light with System font, when Full player is set to
    Match app OFF + Dark + Chicago, then the full player renders dark in
    Chicago while every other surface stays light in System — in Chrome,
    Safari and Firefox, on a machine with no local Chicago installed.

AC: Given any per-player customisation, when Match app appearance is turned
    back ON, then that player follows the app again and the stored custom
    values are replaced by 'app' (matching current surfaceFollowsApp
    semantics — confirm in the audit whether prior values are kept or reset,
    and keep whatever 3.2.5 does).
```

## Phase 2 — after approval only

`skin-dev` implements per the approved plan (settings.js, ios9.css, ui.js, fonts/) →
`i18n-ui` sweeps new/changed/stranded strings → `reviewer` on the full diff → `verify` runs
gates and prints the deploy command + acceptance walkthrough for the user's `[live]` pass.
`risk` is NOT needed until this ships in a release.
