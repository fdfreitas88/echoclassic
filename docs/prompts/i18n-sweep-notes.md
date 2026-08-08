# Notes for the i18n-ui sweep at the end of Phase 2

Accumulated while reviewing each skin-dev commit. Do not lose these — CLAUDE.md names this
exact class as what consumed releases 3.2.2 and 3.2.5.

## From C3 (crossfade / duration)

1. **`{{ durationValue }} seconds` is a MIXED text node.** `settings.js`, the Duration row.
   `i18n.js` rewrites text nodes, and the key added is `ECHOCLASSIC_UI_SECONDS` = "seconds"
   alone. A text node that is `"{{ durationValue }} seconds"` may not match a key of `"seconds"`
   — verify whether the rewriter handles the literal fragment beside an interpolation, or
   whether this needs an explicit `tr()` / a keyed phrase with a placeholder. **This is the
   single highest-risk string in the pass.** If it does not match, the row reads "4 seconds" in
   Portuguese forever, silently.

2. **`aria-label="Crossfade"` is a bound-free literal attribute** on the toggle, and the button
   also contains `<span class="visually-hidden">Crossfade</span>`. Two problems: an attribute
   literal is not a text node so `i18n.js` cannot reach it, and `aria-label` *overrides* the
   span, so the span's translated text is never announced. Pick one mechanism. Prefer the
   visually-hidden text node (translatable) and drop the `aria-label`, or keep `aria-label` and
   bind it through `tr()`.

3. **`crossfadeHint` is built in JS and wrapped in `this.tr(...)`** — correct pattern, matches
   `gaugeHelp`. Verify both branches resolve, in EN and PT, and that the em dash in
   "Off: gapless playback — songs join with no gap and no blend" is byte-identical between the
   template literal and the strings.txt EN value. A mismatched dash silently misses the key.

## File-level

4. **`strings.txt` tail is no longer alphabetical.** `ECHOCLASSIC_UI_POSITION` already sits
   after `ECHOCLASSIC_UI_THIS_ALBUM_HAS_MORE_TRACKS` from prior 3.2.6b work, and C3 appended
   four more entries at the end. Decide once: either re-sort the whole file, or state that the
   file is append-ordered and stop treating order as a convention. Do not fix it piecemeal —
   a reviewer already flagged ordering twice this session and it keeps regressing.

## Stranded entries to remove — from the Phase 1 audit

These are stranded by C3–C6's deletions. Verify each has zero remaining uses before removing.

| Line | Key | EN |
|---|---|---|
| 395 | `ECHOCLASSIC_UI_FONTS` | Fonts — already stranded before this work |
| 659 | `ECHOCLASSIC_UI_NO_CROSSFADE_GAPLESS` | No crossfade / gapless |
| 768 | `ECHOCLASSIC_UI_PROGRESS_BARS` | Progress bars |
| 391 | `ECHOCLASSIC_UI_FOLLOW_APP` | Follow app |
| 307 | `ECHOCLASSIC_UI_CUSTOM` | Custom |
| 1873 / 1877 | `…MINI_GAUGE_STYLE_DARK` / `_LIGHT` | Mini player style (dark/light theme) |
| 1881 / 1885 | `…PLAYER_GAUGE_STYLE_DARK` / `_LIGHT` | Full player style (dark/light theme) |
| 1889 / 1893 | `…MINI_PLAYER_COLOUR` / `…FULL_PLAYER_COLOUR` | Mini/Full player colour |
| 1865 / 1869 | `…GAUGE_HELP_DARK` / `_LIGHT` | The style is remembered separately per theme |
| 1160 | `…STYLE_REMEMBERED_PER_THEME` | same family |
| 1595 | `ECHOCLASSIC_UI_QUEUE_ARTWORK` | Queue artwork (expander label) |
| 1136 | `ECHOCLASSIC_UI_VOLUME` | Volume |
| 1128 | `…UNITY_GAIN_TO_THE_DAC…` | Unity gain to the DAC… |
| 1511 | `ECHOCLASSIC_UI_VOLUME_MODE_UNKNOWN` | LMS has not yet said… |
| 1495 | `ECHOCLASSIC_UI_VOLUME_FIXED_FULL` | fixed — full scale |
| 635 | `ECHOCLASSIC_UI_NOT_CONFIRMED` | not confirmed |
| 732 | `ECHOCLASSIC_UI_PLAYER_VOLUME` | Player volume |
| 880 | `ECHOCLASSIC_UI_SECURITY_AND_COMPATIBILITY` | Security and compatibility |
| 483 | `ECHOCLASSIC_UI_LIBRARY` | Library (heading) |
| 888 | `ECHOCLASSIC_UI_SERVER` | Server (heading) |
| 1941 | `ECHOCLASSIC_UI_PREVIEW` | Preview (the sgh) |

**Keep, still used:** `379 …FIXED_OUTPUT_VOLUME_IS_SET_ON_THE_DAC` and `1483 …NO_PLAYER_CONNECTED`
(both live in `nowplaying.js`). `223 COLOUR_SCHEME`, `1004 THEME`, `1921 FONT`,
`1945 PRESENTATION`, `1965 POSITION`, `736 PLAYER_LAYOUT` — all reused as row labels.

## Portuguese still in settings.js source, to convert as each commit reaches it

`365` "Em uso" · `367` "Usar este player…"/"Controlar" · `368` "Transferir" ·
`456` "Desligamento programado" · `551` "fica guardada no navegador…" ·
`561` "Consultando o servidor…" · `948` `echo-classic-preferencias.json` ·
`987/1029/1040/1051` "deveria ser um objeto".
(C3 already converted `427` "Duração" and `432` "segundos".)
