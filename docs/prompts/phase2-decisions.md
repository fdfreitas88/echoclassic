# Phase 2 — approved decisions (3.2.6c Settings redesign)

Read alongside `settings-redesign-spec.md` (the approved spec). Where the two differ, this file
wins — it records the user's answers to the four open questions from the Phase 1 audit.

## 1. Fonts — DEFERRED, do not bundle anything

**C2 is dropped from this pass.** No `.woff2` file is added. No `fonts/LICENSES.md`. No new
`@font-face` rules. The licensing question is the user's to settle later.

Consequences to honour, not to work around:

- The five font options keep their **current** behaviour: `System` and `Helvetica` resolve from
  the platform stack, `Chicago` resolves only where locally installed, `Podium Sans` and
  `Espy Sans` fall back to Geneva/Verdana because their files are absent from the tree.
- The two existing `@font-face` rules at `ios9.css:209-212` pointing at absent files **stay as
  they are.** Do not delete them and do not add files for them.
- `tests/appearance.test.js:113` asserts `html/fonts/` contains no `.woff2`. **It stays green —
  do not invert it.** The Phase 1 plan's N6/N8 tests are dropped with C2.
- **AC-01 is DOWNGRADED to DONE WITH LIMITATIONS.** The per-player font mechanism must work
  (that is C1), but "renders in Chicago on a machine with no local Chicago installed" cannot be
  met without bundling. Say so plainly in the commit message and the final report. Do **not**
  claim AC-01 met.
- `fonts/README.md` already documents that the two files are owner-supplied. Leave it; if C1
  changes what the reader should expect, update that README in the same commit.

**C1 still lands.** It is not font shipping — it is the missing CSS rule that makes per-surface
font selection apply at all. Without it the whole per-player font feature is inert, bundled
files or not.

## 2. Seed values when "Match app appearance" is turned OFF — SEED FROM THE APP

Confirmed from the code: 3.2.5 **resets**. `setSurfaceTheme`/`setSurfaceScheme`/`setSurfaceFont`
(`ui.js:582-601`) each write one key with no memory of a prior value, so turning the toggle ON
writes `'app'` into all three and destroys the custom values. `uistate.test.js:436` asserts this
round trip. **Keep that behaviour exactly — AC-02 matches the code.**

Because ON destroys them, OFF has nothing to reveal. So on OFF, **seed the three keys from the
app's currently resolved values at that moment**:

```
theme  = ui.dark ? 'dark' : 'light'
scheme = ui.colorScheme
font   = ui.fontFamily
```

This makes "OFF reveals the custom controls with their current values" true, makes OFF→ON→OFF
visually idempotent, and adds no persisted key. Do not hard-code `'light'`/`'blue'`/`'system'` —
that would visibly change the player the instant the toggle is flipped.

## 3. `PLAYER_POSITIONS` — REORDER to left, center, right

`ui.js:47-51` currently orders them `right, left, center`. Reorder the constant itself so the
segmented control reads **Left | Center | Right** and `radioKey` arrow order matches the visual
order. Stored values are keys, not indices, so persisted state is unaffected.

Note the side effect and keep it: this also changes the cycle order of the position button in
`nowplaying.js:21-31`. That is an improvement, not a regression — but mention it in the commit
message so it is not discovered later as a surprise.

## 4. Two rows the spec omitted — KEEP BOTH

- **Connection row** (`settings.js:402`, `store.connected`) — keep it, moved into **About**. It
  is the only place a user sees "no player connected".
- **Sleep timer Cancel button + remaining-time row** (`settings.js:449`, `455-457`,
  `store.sleepRemaining`) — keep, in the **Playback** group. Without Cancel there is no way to
  clear a sleep timer from the skin at all. The spec's omission reads as an oversight.

## Everything else from the Phase 1 audit stands

- **Persisted state: no key changes.** 3.2.5 export/import must keep working (AC-03).
- **Nav:** `app.js` unchanged. `syncAppearanceScreen` and the `nav.settings` watch survive
  **unchanged** — they close the screen on browser/hardware Back; deleting them reopens the
  3.2.6b N-defect. `appearanceScreenLabel` shrinks to one entry `{players: …}` but the METHOD
  MUST SURVIVE — `appearance-ui.test.js:186` splits on its name and throws if it is gone.
- **D-2:** the Full player's Progress bar rows also restyle the small player (both read
  `ui.playerGaugeStyle`/`playerGaugeColor`). Do not add a Progress bar row to Small. Do add the
  footers **"Also applies to the small player."** and **"Bar style is remembered per theme."**
  under the Full and Mini Progress bar rows — the second replaces copy deleted with `gaugeHelp`.
- **Bar colour swatches are 6, not 5** (`GAUGE_COLORS` = `theme` + 5 schemes). The mockup shows
  5; the spec text says "Follow theme + schemes". Six.
- **About keeps Genres and the lock-screen note** even though the mockup omits them.
- **Queue keeps the existing hint string** `ECHOCLASSIC_UI_QUEUE_ARTWORK_HELP` (strings.txt:1599)
  rather than inventing new wording.
- **Segmented controls reuse `radioKey`.** `div[role="radiogroup"][aria-label]` wrapping
  `button[role="radio"][aria-checked]` with roving tabindex and `@keydown="radioKey(...)"`.
  `radioKey` already scopes via `closest('[role="radiogroup"]')`. Generalise `.gauge-segmented`
  to `.segmented`. **Do not add Home/End** — `radioKey` is shared with six other checkmark
  groups. `role="tablist"` is wrong here; there are no panels.
- **"Show previews" is session-only** — `showPreviews: false` in `data()`, matching the existing
  `showPlayers` / `showQueueArt` / `showDefaultPlayer` precedent. No persisted key.
- **Font filenames**: not applicable this pass, but if fonts are ever bundled, use versioned
  filenames — the asset revision reaches only URLs `index.html` builds, not font URLs inside
  `ios9.css`, which sit under a week-long `max-age`.

## Gate 4 — two new contrast pairs to add to `tools/check-contrast.py`

```python
('texto do segmento ligado',   '--accent-ink', '--accent',    4.5),
('anel do swatch selecionado', '--accent',     '--group-bg',  3.0),
```

Pre-computed with the script's own formula: both worst cases are **4.90** (light teal) and pass.
**Keep swatch rows inside the group card** — the ring on `--group-page` is 4.28 for light teal,
which passes 3.0 but fails 4.5.

## Commit plan for this pass — C2 dropped

| # | Commit | gate-4? | `[live]`? | deploy `-r`? |
|---|---|---|---|---|
| C1 | `fix(css): per-surface fonts actually change the typeface` | no | yes | no |
| C3 | `refactor(settings): volume and the crossfade select leave Settings` | no | yes | **yes** |
| C4 | `refactor(settings): Queue, General, Language, Backup, About take their final shape` | no | yes | **yes** |
| C5 | `refactor(settings): Appearance goes inline; four subscreens die` | **yes** | yes | no |
| C6 | `feat(settings): one Player layout screen, three players, one grammar` | **yes** | yes | **yes** |
| C7 | `chore(3.2.6c): version bump` | no | no | **yes** |

Each commit must pass `npm test` and `npm run validate` on its own. `npm run check-version`
fails by design until C7 — and C7 bumps install.xml and Plugin.pm only; **repo.xml stays at
3.2.5** because this is not a release.

## Scope of this pass

**Commit locally. Do not push. Do not run `tools/release.sh`. `risk` is not needed.**
Deploy is not part of this pass unless the user asks — the last `-r` deploy stranded the server
and needed a manual relaunch the sandbox refuses to perform.
