# Forum post — Echo Classic 3.2.9

Draft for the Lyrion / Squeezebox community forum. Plain text with BBCode-friendly
structure. The image URLs point at `main`, so they follow the current screenshots.

---

## Echo Classic 3.2.9 — an iOS 9 iPad Music skin for LMS, with the real sample rate on screen

Echo Classic is a skin for Lyrion Music Server that looks like the iPad Music app from
iOS 9, and that puts the **native sample rate and bit depth of what actually reaches the
DAC** in front of you. That is the reason it exists: on a hi-fi setup you want to know at
a glance whether the 24/96 file you paid for is being served untouched or quietly
resampled somewhere in the chain.

It is Vue 2 with no build step — the files the server ships are the files the browser
runs — and it needs LMS 8.0 or later. Developed against 9.1.1.

**Install:** add this repository under *Settings → Plugins → Additional repositories*:

```
https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/repo.xml
```

Then install **Echo Classic** from the plugin list and pick it in *Server Settings →
Interface*, or open `http://<server>:9000/echoclassic/` directly.

Source, releases and changelog: https://github.com/fdfreitas88/echoclassic

---

### Screenshots

Taken against the deployed 3.2.9 on a real server — LMS 9.1.1, 1,464 albums, 14,797
songs. Not mockups.

**Library, split view.** The album header states codec, sample rate, bit depth and where
the file comes from — Qobuz here rather than the local library.
https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/docs/img/library.png

**Legacy**, the third theme: bevelled chrome, gradient title bar, glossy segmented
controls, grouped tables.
https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/docs/img/legacy.png

**Dark**, with the hi-res badge on every track above CD quality.
https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/docs/img/dark.png

**One panel for filtering, sorting, grouping and playback preference.** It works as a
draft — nothing applies until you press Apply.
https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/docs/img/filters.png

**Filters combine, each one a removable pill.** Grouping adds section headers with counts
and never drops a row.
https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/docs/img/sections.png

**Player layout**, rebuilt in this release: how the player opens, which side the panel
takes, and one switch for appearance.
https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/docs/img/playerlayout.png

**Settings** on one scrollable screen, and the accent/type controls.
https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/docs/img/settings.png
https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/docs/img/themes.png

**Playlists**, editable in place.
https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/docs/img/playlists.png

**On a phone**, the same panel becomes a full-screen sheet with the primary actions
pinned to the bottom.
https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/docs/img/mobile.png

---

### What's new since 3.2.5

3.2.5 was the last release many of you will have installed. Between it and 3.2.9 there
were four published releases (3.2.6c, 3.2.7, 3.2.8, 3.2.9). Grouped by what actually
changed for you:

**A third theme, and two more accents**
- **Legacy** joins Light and Dark: an iOS 6-style treatment with bevelled chrome, grouped
  settings tables, embossed and engraved text and classic progress-bar defaults.
- **Silver** and **Black** accent schemes, bringing the total to seven. In Legacy, Silver
  keeps light chrome with dark bar text; Black carries dark chrome through the toolbar and
  the mini player.
- Every contrast pair is recomputed across all three themes and all seven accents — 155
  pairs, all passing WCAG AA.

**Settings, rebuilt twice**
- Settings became one scrollable screen. The separate Theme, Colour Scheme, Fonts and
  four progress-bar subscreens are gone; Appearance is inline.
- **Player layout is now one short screen.** It used to be three repeated forms — Full
  player, Small player, Mini player — each with its own "Match app appearance" switch: 4
  switches, 9 radio groups, 40 visible choices and 16 colour swatches, over 1,700 px of
  scrolling on a phone. Now it opens on the only decision most people want — how the
  player opens, and which side the panel takes — with one master appearance switch and
  everything else behind a single "Customize player appearance" disclosure that shows one
  surface at a time.
- The three player surfaces are named for where they appear: **Full player**, **Side
  panel**, **Bottom bar**. Each can follow the app or carry its own theme, accent and
  font — and per-surface fonts actually change the typeface now; the feature had shipped
  inert.
- Crossfade became a switch with a duration beside it instead of a dropdown. Volume left
  Settings, because it belongs to the player.
- **LMS server settings are skinned inside the interface**, including a plugin manager
  with status filters and counts. The server's own form stays authoritative; Echo Classic
  only dresses it. Back, Escape and tapping the active Settings tab all return properly
  instead of trapping you.

**Navigation and search**
- **Search keeps its results.** Searching for an artist, opening one and pressing Back
  used to drop you at the library root with the query erased. The term, the results and
  the scroll position now survive, on both the on-screen Back and the browser's.
- Back pops the tab's own stack instead of crossing into whichever tab you visited last.
- The My Music root picker is a proper keyboard listbox: arrows, Home/End, Escape, focus
  returning to the button that opened it.

**Playback and the queue**
- A single-album queue no longer clips its group header or paints artwork over the rows
  beneath it, and the counter reads as a sentence again — "21 tracks · 2 h 4 min
  remaining".
- Playback recovers from the stopped remembered-track state that made Play look clickable
  while LMS had no usable queue. Empty-queue Next/Previous gives visible feedback instead
  of silently doing nothing.
- **Losing the player is handled as one transition.** The screen used to show "No player
  was found on LMS" next to a track name, with the progress bar running and the transport
  buttons enabled, and only a page reload settled it. Connection, track and controls now
  move together: the last known track stays visible, the progress stops, and controls with
  nowhere to send a command are disabled.
- Undo is stamped with the player it belongs to, so it can never inject one player's queue
  into another.

**Errors and language**
- Service errors say something you can act on. Apps used to print
  `[network] qobuz items 0 200 menu:qobuz: Failed to fetch` straight to the screen; the
  protocol string now stays in the console and the screen says what happened and what to
  try.
- A malformed favourite shows an explicit failure with Retry instead of a dead row.
- **English sessions are actually English.** Portuguese labels had leaked into the action
  sheet, the player, album metadata, favourites, the selection bar and search. The source
  language is English and translations live in `strings.txt`; the gate that enforces this
  was itself missing the words that leaked, and has been fixed.
- Language is picked in the skin's own Settings and outranks the LMS session language, so
  a server running in one language can still show the skin in another.

**Layout**
- The connection banner no longer covers the list toolbar. On a phone it used to sit on
  top of Filter, Sort and Select — tapping one hit the alert instead.
- Six layouts stopped reserving fixed pixel widths for siblings free to outgrow them,
  including a 330 px reserve sized for the English words "Playback queue" that was wrong
  in both directions once the label was translated.
- Momentum scrolling with contained overscroll across every scrollable region.

---

### Known limits, stated plainly

- **Podium Sans and Espy Sans fall back** to Geneva/Verdana. Both are offered in Settings,
  but the font files are not bundled — that waits on a licence decision. Chicago renders
  only where the system provides it.
- **Portuguese is the only translation** shipping today. The dictionary is keyed by the
  English phrase, so adding a language is a `strings.txt` edit, not a code change.
- **3.2.9 is freshly deployed.** The screens above are the running build, but the release
  has had a first pass rather than a long soak; the CHANGELOG marks each change with how
  it was established. If something looks wrong, it probably is — please say so.
- The retired `/mojo` alias is deliberately not registered and returns 404.

Bug reports and screenshots of anything that looks wrong are welcome on the issue
tracker: https://github.com/fdfreitas88/echoclassic/issues

Full changelog, with an evidence marker on every line:
https://github.com/fdfreitas88/echoclassic/blob/main/CHANGELOG.md
