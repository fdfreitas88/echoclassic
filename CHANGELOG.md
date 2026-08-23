# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Semantic versioning.

Every item says how the effect was established. **[live]** means it was seen
happening in the running interface; **[code]** means the chain was read in the
source but the state was not reproduced on screen. The distinction matters to
whoever has to decide, six months from now, whether a fix can be trusted.

Entries up to 3.2.1 were written in Portuguese, which was the project's source
language at the time. They are left as they were: they describe releases that
were already published under those notes, and rewriting them would misreport
what was announced.

## [Unreleased]

## [3.4.1] — 2026-08-23

### Added

- The SqueezeDSP screen now exposes the plugin's complete current signal path:
  graphic-band Q, balance, stereo width, delay, loudness/listening level,
  DSP-side ReplayGain modes and fallback gains, headphone crossfeed, FIR room
  correction and impulse strength. [code/measured: upstream SqueezeDSP settings
  contract; Vue template compilation and equalizer UI regression tests]
- Parametric filters can be created and changed between peak, low shelf/dynamic
  bass, high shelf/treble enhancement, low pass, high pass and notch, with
  frequency, gain and Q/slope controls. [code/measured: native SqueezeDSP filter
  schema and 421 automated tests]
- Server presets can be saved and deleted from Echo Classic through the native
  `squeezedsp.saveas` and `squeezedsp.deletepreset` commands. Paths returned by
  the server are shown as friendly preset names. [live/measured: temporary preset
  created, loaded and removed on the running backend; RPC regression test]
- Reset now offers two scopes: the graphic bands alone, preserving unrelated DSP
  filters, or every DSP setting as a staged change that still requires Apply.
  [code/measured: source review and template validation]

### Fixed

- Equalizer filters use SqueezeDSP's `Slope`/`SlopeType` contract instead of the
  unsupported `Q` alias. Existing Echo 3.3 documents are migrated when read,
  while fields introduced by newer plugin releases remain intact. [live/measured:
  corrected document observed on the running backend; API migration and
  round-trip tests]
- Opening the EQ no longer reports a false “Custom (edited)” state merely because
  compatibility defaults were added to a sparse server document. Apply remains
  disabled until a real change is staged. [live/measured: clean initial state and
  reload/discard behaviour verified in Chrome]

## [3.4.0] — 2026-08-22

### Added

- A SqueezeDSP equalizer is available from album, track and player surfaces,
  with contextual rules for an individual song, folder, artist and epoch. Rules
  are isolated per player, normalized before storage and serialized so rapid
  changes cannot overwrite the winning preset. [live/measured: deployed with a
  running SqueezeDSP backend; automated rule-precedence and persistence tests]
- Synchronized-player controls now expose group topology, the master, Unsync,
  group volume and a per-member “Do Not Set Volume” policy. Fixed-output and
  opted-out members are excluded from group writes. [code/measured: topology,
  stale-player, unsync and volume-policy tests]
- Playback intelligence adds capability-gated RandomPlay and Don't Stop The
  Music controls, including confirmed active state and protection against
  replacing an existing queue unintentionally. [code/measured: command,
  confirmation and stale-player tests]
- My Music gains virtual-library roots, recursive Music Folder navigation,
  Album Artists, Release Types and classical entry points for composers, works,
  conductors and ensembles where the server exposes that metadata. Each root
  keeps its own navigation state. [live/measured: recursive folder and Album
  Artist navigation on LMS; navigation and API tests]
- Advanced search can scope one or several library roots and filter by type,
  year, source, composer, work, format and release type. Results retain root
  provenance and exact matches rank first. [live/measured: controls rendered in
  Chrome; multi-root isolation, ranking and navigation-restoration tests]
- Album track lists divide multi-disc releases into explicit disc sections
  while retaining the server's track order. [code/measured: template and data
  normalization validation]
- Queue and saved-playlist editing adds duplicate removal, direct
  move-to-position and drag-and-drop reordering. Queue removal and clearing keep
  player-scoped undo data. [code/measured: queue identity, move, drag and undo
  regression tests; draggable queue rows confirmed live]
- Pinned destinations can be reordered. Favourites gain folder creation,
  renaming and direct movement between folders when the LMS action is available.
  [code/measured: capability and template validation]
- Party mode constrains shared playback controls, while Kiosk mode provides a
  locked presentation surface with an administrator recovery path. [live/code:
  controls rendered in the deployed Settings interface; state validation]
- Now Playing prefers LMS 9.2's active-stream format, bitrate, sample rate and
  bit depth, revealing transcoding results while retaining track metadata as a
  compatibility fallback for older servers. [code/measured: LMS 9.2 and legacy
  status-response tests]

### Changed

- Album, queue, search, player and Settings actions use the same capability
  gates and translated feedback, so unavailable server or plugin operations do
  not appear to succeed silently. [measured: 416 tests; validation 4/4; all 155
  tested light, dark and legacy contrast pairs pass]

### Fixed

- Recursive Music Folder pages now leave the loading state after their LMS
  response, including nested folder navigation and Back restoration.
  [live/measured: Lossless → Classical Music → country folders in Chrome; no
  console errors]

## [3.3.2] — 2026-08-16

### Changed

- Artist and album information is fetched once and retained in bounded local
  caches across page reloads. Only the explicit Refresh action bypasses and
  replaces cached information. [measured: 394 tests and validation 4/4 pass]
- Album information now starts collapsed. Opening it shows a three-line review
  preview with Show more/Show less, while source details and reference artwork
  have their own disclosure. All controls are left aligned to avoid wasting
  vertical space. [code/measured: responsive templates compile; UI regression
  tests cover disclosure states, line clamp and alignment]

## [3.3.1] — 2026-08-16

### Fixed

- Advanced LMS settings pages no longer inherit a fixed-height nested scroller
  that clipped long forms and left a large empty area above the player. File
  Types and other long pages now use one continuous responsive scroll area.
  [live/measured: deployed layout confirmed; 393 tests and validation 4/4 pass]

## [3.3.0] — 2026-08-16

### Added

- Advanced LMS File Types now presents the native conversion rules as a
  responsive Echo Classic table without replacing its selectors or submission
  wiring. Media Scan Details replaces dotted server bars with accessible gauges
  for known, active, complete and failed stages, plus a prominent live “Now
  scanning” field that uses the server's detailed activity when available. Both
  treatments carry the requested small translated New marker. [code/measured:
  393 tests; validation 4/4; Light/Dark/Legacy wide/narrow Chrome matrix passed]
- Large Radio, Apps and favourites service lists now continue in 100-item pages
  without replacing loaded rows or their browse/play actions. Repeated page-boundary
  items are ignored by server identity/action, stalled pages stop instead of looping,
  recoverable errors keep the loaded list, search and Back restore the prior list and
  scroll position, and stale player responses cannot append. The continuation ships
  with the requested small translated New marker outside its full accent border.
  [live/measured: Qobuz 100→200→300→400→434 with stable actions and terminal state]
- Media scan failures now have a bounded, deduplicated browser journal with
  redacted details, Ignore history and capability-gated retry controls. Completed
  scans retain accessible gauges and an honest empty journal; running scans show
  the server's current activity without inventing skip or resume commands.
  [live/measured: 10 gauges and journal in Light, Dark and Legacy; zero overflow]
- Artist pages can read MusicArtistInfo biography and credited photo data without
  changing the canonical local contributor or local albums. The panel records its
  source and retrieval time, caches a bounded safe copy, sends absent installations
  to the native Plugin Manager, normalizes plugin HTML to readable text and keeps
  long biographies collapsed until requested. [live/measured: The Beatles positive
  state, cache migration, expand/collapse and zero overflow]

### Internal

- The EQ design is in the repository, at `docs/prompts/gaps-mockup.html`. It
  was untracked and named outright by an ignore rule, so it was one `rm` from
  being a lost record with no copy anywhere. Moved, not rewritten: byte for
  byte the same file that `59309cc` carries. The 3.3 feature mockup was
  untracked for the same reason and is tracked now too. [measured]
- The plugin dependency policy says the same thing for both tiers: an absent or
  disabled backend leaves the line in place, with the feature's own precondition
  in the row and an Install… action. The old text told the shipped-with-LMS tier
  (RandomPlay, DSTM) to hide its entry points and show a separate hint, which
  contradicted the 3.3 design and would have left the user with no way to learn
  why a feature had vanished. The project guide carries the same rule. [code]
- The project guide records two design decisions that until now lived only in a
  session: how a new feature is marked in a mockup — rows take a left gutter
  bar, buttons and pills take the whole border in accent with the label outside
  — and that a button or pill is never marked or selected on a single edge.
  Full border or an Apple-style selection, as a product rule. [code]
- AUDIT-20, the equalizer, is written into the gap sheet with the constraints
  the SqueezeDSP recon found: per-player JSON-RPC, whole-blob writes, a re-seek
  on every apply, and no state visible to `serverstatus`. [code]

## [3.2.9] — 2026-08-10

### Fixed

- The connection banner no longer covers the list toolbar. It was a fixed
  overlay pinned 70px from the top, which at 390x844 put it over the centres of
  Filter artists, Filters, Sort and Select -- a hit-test there returned the
  alert's text -- and over Recent, the first option of the root picker. It is
  now a row of the app column, so the workspace shrinks by its height and
  nothing sits behind it. [code]
- The action sheet is in the interface language again. Play now, Play next and
  Pin to Echo Classic were Portuguese literals in the template, which the
  dictionary -- keyed by the English phrase -- could never reach, so they
  showed in Portuguese in every language. The queue notice built by
  concatenation (`N itens adicionados`) had the same defect and is now one
  translatable phrase per plural form with the count substituted after
  translation. [code]
- `tools/check-source-language.js` no longer passes on the literals it exists
  to catch. Its word list held `reprodução` but not `reproduzir`, had no
  `fixar`, and knew `adicionar` only in the infinitive. [measured]
- The My Music root picker is a listbox per the ARIA APG. The trigger declares
  aria-haspopup and aria-expanded, the popup and its options carry roles and
  aria-selected, focus opens on the root in use, arrows wrap, Home/End jump,
  Escape closes and focus returns to the trigger -- and Tab stays inside the
  popup instead of leaving for Search, which used to mean crossing the whole
  library list to reach an option. [code]
- Opening a search result no longer discards the search. The term, the results,
  the page size and the scroll position survive in LmsUi, and both the
  contextual Back and the browser's Back return to them without running the
  query again. The label reads Search only while a snapshot exists, so a reload
  -- which keeps the stack and drops the snapshot -- cannot offer a return that
  would not happen. [code]
- Losing the player is reconciled as one transition. The screen used to show
  `No player was found on LMS` beside a track, with the progress bar running
  and Previous/Play/Stop/Next enabled, and only a reload settled it. The store
  now clears the player, the connection, the playback mode, the position and
  the right to command together, and keeps the cached track deliberately as the
  last known one; both transports and the scrubber read that right rather than
  each deciding for itself. [code]
- Service errors say what to do. Apps showed
  `[network] qobuz items 0 200 menu:qobuz: Failed to fetch` -- the error kind,
  the RPC verb, the pagination window and the fetch's own words. Browse, play
  and in-service search in Apps/Radio, and the album screen, now report through
  friendlyError, which leaves the protocol string in the console, and end with
  a human action. [code]
- Selecting an Advanced LMS settings page no longer starts a feedback loop
  that continuously rebuilds the settings rail and traps its scrollbar. The
  rail is now updated in place, retains its search and scroll position, and
  pauses DOM observation while applying skin-owned changes. The pre-fix lock
  was reproduced on the published server; regression coverage exercises the
  stable-update path. [live/code]
- Vertical lists, detail panes, full player, queue, action sheets, nested
  choices and filters now use momentum scrolling with contained overscroll;
  the mobile settings drawer also contains touch gestures and prevents the
  obscured page from scrolling behind it. [code]
- Advanced LMS pages no longer show the residual native header block, the
  settings search no longer carries a decorative microphone, and plugin group
  headings no longer render as unnamed green plugin tiles. [code]
- Plugin switches preserve the native checkbox names and submission semantics,
  expose a keyboard focus ring, update group counts and pending-change copy,
  and submit through the single Save action in the Echo Classic navbar. [code]
- Native Advanced LMS checkboxes now have programmatic names, 44px switch hit
  areas and the same visual states as Echo Classic controls. The settings-page
  search is one scoped field with a clear action and a 3px focus indicator.
  [code]
- Player layout now closes through Escape or the active Settings tab, matching
  Advanced LMS settings. Disconnected playback identifies cached track data
  instead of claiming that no player exists while showing a current track.
  [code]

### Changed

- Settings > Player layout is one short screen instead of three repeated
  forms. It used to show Full player, Small player and Mini player one after
  another, each with its own `Match app appearance` switch announced by the
  same name; with only Full customization open it held 4 switches, 9
  radiogroups, 40 visible radio choices and 16 colour swatches -- 1,723 px of
  content in a 656 px scroller at 390x844, with Small and Mini several screens
  below the fold. Now Layout comes first (Presentation, and Panel position only
  when Adaptive, since position is a consequence of that choice), then one
  master `Match app appearance` switch with a summary of whether anything is
  customized, then a single `Customize player appearance` disclosure holding a
  Full player / Side panel / Bottom bar selector that renders one surface's
  controls at a time. Every stored key, setter and 3.2.8 export is unchanged.
  [code]
- The Player layout previews are removed rather than hidden. Each strip showed
  an accent circle, a surface name and a two-pixel line -- no presentation,
  panel position, font, chrome, album art or real progress-bar style -- and was
  `aria-hidden`, so it supported no decision and read to nobody. The real
  players update immediately and are the authoritative feedback. [code]
- `tools/release.sh` refuses a package that is not the tree that produced it,
  and a descriptor that is not publishable. The 3.2.8 descriptor was ready to
  publish while declaring itself a private QA candidate and pointing at a local
  path, and its recorded SHA-1 matched a zip whose ios9.css and actions.js were
  older than HEAD -- the file count was right, which is all the packaging step
  checked. The bump now rewrites the whole `<url>` from the version, the
  publication invariants reject a candidate marker, and packaging unzips the
  artifact and diffs it against the tree. `repo.xml` carries the public asset
  URL again. [measured]
- Manage Plugins now presents the native LMS plugin form as a three-column,
  iOS-style App Store pane with live status filters, plugin and active counts,
  native search/category controls, banded groups, metadata tiles and the same
  switches used elsewhere in Echo Classic. [code]
- Advanced LMS settings now uses a compact settings-page drawer on tablet and
  mobile. Manage Plugins opens on Active at those widths while retaining every
  native checkbox in the authoritative LMS form. [code]

## [3.2.8] — 2026-08-09

### Added

- Added the Legacy theme as a third appearance theme, with iOS 6-style chrome
  paint, grouped settings tables, bevels, embossed/engraved text shadows and
  classic progress-bar defaults. [code]
- Added Silver and Black accent schemes across app and per-player appearance
  controls. In Legacy, Silver keeps light chrome with dark bar text, while
  Black carries the dark chrome through the toolbar and mini player. [code]

### Changed

- Appearance theme state now persists as `light`, `dark` or `legacy`, while
  still writing the old `dark` boolean for one-release downgrade compatibility.
  [code]
- Extended the contrast checker from two theme columns to Light, Dark and
  Legacy across all seven accent schemes. [code]
- Added the missing Font section header in Appearance. [code]

### Fixed

- Dark mode now applies its own chrome tokens to the mini player and tab bar,
  keeping controls and labels legible when surfaces follow the app theme.
  [code]
- Contextual Back now pops the active tab's own stack instead of crossing into
  the previously visited tab. [code]
- English sessions no longer expose Portuguese labels in the player, album
  metadata, favourites, selection bar, OPML search or global search states.
  [code]
- Malformed favourite entries now show an explicit load failure with Retry
  instead of a static, non-actionable row. [code]
- Album search enrichment now requests artwork metadata, the library filter
  has a correctly spaced accessible name, portrait tablets use the single-
  column drill-in layout, and the mobile colour swatches fit at 390px. [code]
- Player layout now opens at its first control instead of inheriting a hidden
  scroll offset, restores the previous offset on return, explains inherited
  appearance controls, and gives switches and colour swatches 44px touch
  targets. [code]
- Advanced LMS plugin settings now retain the server's authoritative plugin
  form and controls while removing the incomplete duplicate card layer and
  obsolete native header chrome. Native settings controls also receive 44px
  row and button targets. [code]

## [3.2.7] — 2026-08-09

Private owner-QA candidate. Do not treat this as published until the owner
accepts the candidate and explicitly approves public release.

### Fixed

- Advanced LMS settings now participates in the Settings navigation stack. The
  browser Back button, the on-screen "Settings" back button, Escape, and tapping
  the active Settings tab all return to the Settings list instead of trapping
  the user or leaving stale Advanced state behind. Verified on desktop and
  390px mobile viewports. [live]
- Playback controls recover from the stopped remembered-track state that made
  Play look clickable while LMS had no usable queue. Echo Classic now requests
  album metadata in status, preserves the remembered track number, and rebuilds
  the album queue when a stopped empty or one-track album queue needs to start.
  Empty-queue Next/Previous now shows visible feedback instead of silently
  doing nothing. [live] [code]

### Changed

- Sanitized retained engineering notes and local tooling so maintained files no
  longer contain owner-private machine paths or live server URLs. [code]

## [3.2.6c] — 2026-08-08

Settings stops being a tree of subscreens, the queue stops painting over
itself, and six layouts stop reserving space with numbers measured against
text that changes length when you change language.

This is the first published release since 3.2.5. The 3.2.6, 3.2.6a and 3.2.6b
work was never packaged, so it is described here.

### The queue and the players

- A single-album queue no longer clips its group header, paints artwork over
  the rows beneath it, or ragged-edges the duration column. Four separate
  causes: `.qcaption` carried `text-overflow:ellipsis` on a flex container
  instead of on the leaf that holds the text; `.qcaption` and `.qrow` were
  fixed heights with nothing containing the overflow, so content that outgrew
  its box painted over the next row; the art gutter was emitted even on rows
  that have no art, leaving an invisible 34px hole; and the row hairline was an
  adjacent-sibling rule that a group header broke. [live]
- The queue counter reads as a sentence again — "21 tracks · 2 h 4 min
  remaining" rather than "21tracks · 2 h 4 minremaining". The missing spaces
  were the visible half. The other half is that all of these labels were
  assembled in JavaScript, so no dictionary could reach them and they were
  permanently English whatever language you chose. They now route through the
  string table; the four keys they need already existed and were orphaned.
  [live]
- The fullscreen player uses the width it has instead of the width it assumed.
  [live]
- Six more layouts stop reserving fixed pixel widths inside a flex row for a
  sibling that is free to outgrow them: the mini player's now-playing box, the
  queue header, the search field, three families of row hairline. The mini
  player's reserve was 330px chosen for the English word "Playback queue";
  "Fila de reprodução" is longer, and the mini now carries its own typeface, so
  the number was wrong in two directions at once. All of it is real flex now.
  [code] — the mechanism was read in source and proved by a regex suite over
  the stylesheet; the rendered geometry was not measured [unverified]

### Settings

The whole section below is read in source and covered by tests. None of it has
been seen in a browser. [code] [unverified]

- Settings is one scrollable screen. The four gauge-style subscreens, the
  separate Theme, Colour Scheme and Fonts screens are gone; Appearance is
  inline. Queue, General, Language, Backup and About take their final shape.
- Volume and the crossfade `<select>` leave Settings — volume belongs to the
  player, not to a preferences screen. Crossfade becomes a switch with a
  duration beside it and a sentence explaining what each state does.
- One Player layout screen covers all three players — mini, small and full —
  with one grammar instead of three. Each surface can follow the app's
  appearance or carry its own; choosing "match app" clears the surface's
  overrides, and turning it off snapshots what the app looks like at that
  moment rather than pinning a value that later drifts.
- Per-player fonts actually change the typeface. The feature shipped inert:
  `--app-font` is inherited, and `font-family` was resolved from it in exactly
  one place, on `body`, so a surface inherited the already-resolved family and
  its own choice changed nothing. One rule re-resolves it on the surface.
- What that does not deliver: Podium Sans and Espy Sans still render through
  the Geneva/Verdana fallback, because the two `.woff2` files are not in the
  tree. Bundling them waits on a licence decision. Chicago renders only where
  it is installed locally. The options are not equally available and the
  release does not claim they are.

### Language

- The player row in Settings stops being half Portuguese. "Em uso",
  "Controlar" and "Transferir" sat beside "connected", "unavailable" and
  "Sync"; the sleep line read "Desligamento programado". These were not missing
  translations but source-language violations — the dictionary is keyed by the
  English phrase, so a Portuguese literal in a template matches nothing and
  shows in Portuguese to everyone, in every language. [code]
- Eleven string-table entries stranded by the Settings rewrite are removed.
  Each was checked by its English phrase across the whole tree, which is the
  question that matters: a key-name grep answers a different one and would have
  called every entry unused. Nine more that an earlier audit listed as stranded
  are kept — they still match live text. [measured]
- `strings.txt` is append-ordered. It has not been alphabetical since 3.2.6b,
  and treating order as a convention has been flagged and regressed three
  times. It is not one. [code]

## [3.2.5] — 2026-08-05

English becomes the language the interface is written in, Portuguese becomes a
choice, and the sort control stops cutting its own labels in half.

### Added

- **A language picker, in the skin's own Settings.** There was none: the
  language came only from the LMS session, so a server set to Portuguese meant
  a Portuguese interface and nothing inside Echo Classic could change it. The
  choice is stored per browser and outranks the server; the server language is
  now only the opening guess. Every dictionary is sent to the page, so
  switching needs no round trip. Verified on LMS 9.1.1: 428 Portuguese entries,
  `{"EN":"English","PT":"Português"}`, empty map for English. **[live]**
- **The sort control is an icon that opens a suspended menu.** Arrow keys move
  between options and wrap, Escape closes, focus starts on the current choice
  and returns to the icon, and the menu carries `role="menu"` semantics — all
  of which the native `<select>` provided for free and a popover has to earn.
  **[live]**
- **`tools/check-ui-language.js`**, a gate over what a user can actually read:
  template text, human-readable attributes, and prose string literals. It
  checks against the dictionary itself rather than a word list, so a phrase is
  caught whether or not it carries an accent. **[code]**

### Changed

- **English is the source language.** `strings.txt` is keyed by the English
  phrase; Portuguese sits beside it like any other translation. The translation
  layer never cared which language was embedded in the templates — only the
  choice of key tied the skin to Portuguese. Around 700 interface strings moved
  across, with the Portuguese preserved as entries. **[live]**
- **Portuguese identifiers and persisted state keys are English**: `'ajustes'`,
  `'favoritos'`, `'musica'` and the browse roots. Nothing was in production, so
  they moved without a migration. **[code]**
- **The toolbar fits one row again.** Two layout rules had been built around the
  105px select: a two-row treatment that triggered below 430px, and a container
  query that made the bar a three-column grid with a fixed 92px column for it.
  With the select gone that column stood empty and the icons queued into the
  next one — the bar grew to three rows, taller than the layout it replaced.
  Measured on the server afterwards: 56px, one row, and the Select command
  keeps its label at the default split. **[live]**

### Fixed

- **`sortLabel` and the selection count spoke Portuguese to screen readers.**
  Both were glued together from literals, so no dictionary lookup could reach
  them — a blind user on an English server heard Portuguese. **[code]**
- **The progress-bar labels and their help sentence** interpolated the theme
  word into the middle of the phrase, which no lookup can match. That is also
  where "lighttheme" lost its space. Computed whole now. **[live]**
- **"Ano original:" on every album.** A fixed fragment sitting beside an
  interpolation, which the first sweep skipped entirely. **[live]**
- **A dictionary entry keyed by `"."`** would have translated any lone period
  into " primeiras.". Introduced during the move and removed before release.
  **[code]**

## [3.2.4] — 2026-08-05

An audit of `Plugin.pm` after the 3.2.3 review. The failure policy of the file
was already right — nothing that runs during a page render may die, because a
die inside `[% PERL %]` renders an empty page with HTTP 200 — but every one of
those fallbacks was taken in silence, and `Slim::Utils::Log` was imported and
never used. Nothing in the interface changes.

### Added

- **A log category, `plugin.echoclassic`**, and a message on every fallback path.
  The two failures a user actually reports — "the interface is in Portuguese on
  an English server" and "my browser still runs last week's JavaScript" — were
  the two that left no trace anywhere. **[code]**
- **`use warnings`**, absent since the file was written. **[code]**

### Fixed

- **`jsLiteral` did not escape U+2028 or U+2029.** They terminate a string
  literal in ES5-era parsers exactly as a newline does, so one of them in
  `strings.txt` turns the injected dictionary into a syntax error and the page
  renders blank. The byte-level read of `strings.txt` did not protect against
  it: the UTF-8 bytes went out and the browser decoded them back. Escaped at
  both byte and character level. `<!--` is escaped too, for the same reason `</`
  already was. Not switched to `JSON::XS`, though LMS ships it — the map holds
  raw bytes on purpose, and `encode_json` would encode them a second time.
  **[code]**
- **`getLmsVersion` returned an empty string from the branch meant to prevent
  that.** `$::VERSION` of `v9.1.1` or `unknown` was stripped to nothing by the
  substitution and the `0.0.0` fallback never applied, because it only covered
  falsy input. Now: `v9.1.1` → `0.0.0`. **[code]**
- **`getAssetRevision` could not tell "walked the tree and found nothing" from
  "could not read the tree".** An unreadable directory fell back to the version
  string, so asset URLs stopped changing between deploys — reinstating exactly
  the week-long `Cache-Control: max-age=604800` this function exists to defeat,
  with no signal anywhere. The two cases are now distinct and the second one
  logs. `(stat)[9] || 0` also conflated a failed stat with a genuine mtime of 0;
  now tested with `defined`. **[code]**
- **The asset walk had no visited set**, so a directory symlinked back to an
  ancestor was walked repeatedly — bounded only by the OS symlink-depth limit,
  and not bounded at all by a cycle that does not involve a symlink. Now keyed
  on device and inode. **[code]**
- **`filltemplatefile` was the one render path with no `eval`**, in a file whose
  every other render path carries a comment explaining why dying there is fatal.
  A template error escaped into the HTTP handler; it now logs and returns an
  empty scalar ref, the same shape `filltemplatefile` returns. **[code]**
- **A broken `Settings.pm` took the whole plugin down** after the skin route was
  already registered, leaving it half-initialized. The settings registration is
  now isolated: the skin serves either way and the failure is logged. **[code]**
- **`getPlayerHint` was nondeterministic with more than one player connected.**
  `clients()` returns them in hash order, so reloading the page could hand the
  interface a different player each time. Sorted by id. **[code]**
- **A UTF-8 BOM on the first line of `strings.txt`** rode along on the first key,
  stopped it matching `ECHOCLASSIC_UI_`, and dropped that entry without a word.
  Stripped. **[code]**
- **Two string keys sharing the same Portuguese text collided silently** — the
  map is keyed by the PT phrase, so the later one won and one translation simply
  stopped appearing. It now warns, naming both keys. **[code]**

### Changed

- **`getAssetRevision` is memoised for 5 seconds** and **`getStringMap` caches on
  the mtime of `strings.txt`**. `index.html` calls `getAssetRevision` twice per
  render, so every page load walked the asset tree twice and reparsed 350
  dictionary entries — blocking I/O inside the LMS event loop, which on a plugin
  directory living on a network share is a network round trip per file. The
  mtime key preserves the property that a translator edits `strings.txt` and
  reloads the page without restarting the server. **[code]**
- `Slim::Web::Pages` and `Slim::Web::HTTP` are now `require`d in the branch that
  uses them instead of being assumed loaded, and the unused `qw(string)` import
  is gone. **[code]**

## [3.2.3] — 2026-08-04

Code review on the submission to the official LMS plugin repository
([LMS-Community/lms-plugin-repository#80](https://github.com/LMS-Community/lms-plugin-repository/pull/80))
pointed at a guard in `initPlugin` written against a constant that does not
exist. Nothing in the interface changes.

### Fixed

- **`initPlugin` guarded the settings page with `main::WEBPAGES`, which is not a
  thing.** There is no such constant anywhere in slimserver — the only near match
  in the source is the `webPages` method name. The condition read
  `!defined &main::WEBPAGES || main::WEBPAGES()`, whose left half was therefore
  always true, so the guard never decided anything, and the comment above it
  claimed a failure mode that was never observed. Replaced with `main::WEBUI`,
  the real compile-time constant (`slimserver.pl`: 0 when the server is started
  with `--noweb`; 0 in the scanner process). **[code]**
- **With no web server, the plugin now stops instead of registering into one.**
  Everything it registers is a web page — the skin route and the settings page —
  so `initPlugin` returns early when `main::WEBUI` is false rather than reaching
  `Slim::Web::Pages->addPageFunction`. Same shape `Slim::Plugin::Base` already
  uses around `webPages`. Verified by compiling `Plugin.pm` against stubs with
  the constant forced both ways: at 1 the settings page registers and
  `initPlugin` returns 1; at 0 it returns without touching `Slim::Web::*`.
  `Slim::Utils::PluginManager` discards the return value either way. **[code]**

## [3.2.2] — 2026-08-04

Prepares the plugin for the official LMS repository, and closes what the README
screenshots exposed. No change to the filter model or to persisted preferences.

### Added

- **Six screenshots in the README**, taken against the real server (LMS 9.1.1,
  1,400 albums) rather than mocked up. `tools/screenshots.js` regenerates them:
  it proxies the real server and injects a single script into the HTML document,
  so the data still comes from LMS and nothing in the product changes. **[live]**
- **Plugin icon**, drawn for the project — no third-party mark. **[code]**
- `install.xml` gains `email`, `category`, `icon`, `optionsURL` and
  `homepageURL`; `repo.xml` gains `<icon>`. These are the fields the plugins
  already listed in the official repository carry, and the settings page existed
  without ever being announced. **[code]**
- `docs/lms-repository-submission.md`: what the aggregator validates, read in
  `buildrepo.pl` and in `ExtensionsManager.pm`, plus the item-by-item checklist
  and the pull request command. **[code]**

### Fixed

- **Sixteen interface labels appeared in Portuguese in an English session.**
  "Local library" in the row subtitle, "Set the volume on the DAC" in the player,
  "fixed — full scale" in Settings, and thirteen more. They are all built by a
  `return` in JavaScript, and `translateTemplate` only reaches text nodes — so
  they needed entries in `strings.txt` and, in two cases, an explicit `tr()`.
  The first one was caught in a README screenshot. **[live]**
- **A sentence assembled by concatenation could never match a dictionary key.**
  `'O LMS manteve ' + ending` became two whole sentences, the same trap that
  made the truncation warnings show up untranslated. **[code]**
- **Bitrate was shown divided by a thousand.** LMS returns `"5641kbps VBR"` as a
  string in the `titles` tag and a number in bits per second elsewhere; the UI
  divided by 1000 either way, so a 2116 kbps FLAC read as "2 kbps" in the album
  header. Normalised once, at the API boundary. **[live]**
- **The library toolbar broke into three rows at the default split width.**
  360 px is what a first run gets, and six controls do not fit; the list lost a
  hundred pixels of height before the user touched anything. The toolbar now
  takes two predictable rows and the secondary command becomes an icon — with
  its accessible name and its 44 px target intact. **[live]**

### Internal

- A test sweeps every module for interface literals with no entry in
  `strings.txt`. It is what found the sixteen, and it fails if they come back.
- The test suite goes from 92 to 97.

## [3.2.1] — 2026-08-03

Fecha a distância entre o motor de filtros da 3.2.0 e a tela: os filtros
combinavam, mas não havia como pedir a combinação. O `<select>` que decidia
filtrar, agrupar e ordenar ao mesmo tempo dá lugar a um funil na barra e a um
painel próprio, e com ele entram as facetas, as seções, a preferência de
reprodução e as vistas salvas.

### Adicionado

- **Um funil na barra abre o painel de filtros**, ao lado da busca, com badge
  contando os filtros ativos e estado aceso quando qualquer ajuste está valendo.
  O `<select>` continua existindo e passa a fazer uma coisa só: ordenar.
  **[ao vivo]**
- **Filtros combinam pela interface.** Na 3.2.0 o motor já sabia combinar — a
  verificação daquela versão foi feita injetando estado, porque `chooseOption`
  substituía o filtro anterior a cada escolha. Agora Hi-Res + FLAC devolve
  **254 álbuns** escolhidos no painel. **[ao vivo]**
- **Três facetas novas:** gênero (multisseleção, aplicada pelo servidor com uma
  consulta por gênero, resultados somados), ano (intervalo, ano exato ou limite
  aberto — "de 1971" vale até hoje) e qualidade (sem perdas, com perdas, padrão,
  Hi-Res). **[ao vivo]**
- **Seções reais na lista**, com cabeçalho e contagem, por década, formato,
  resolução, origem ou serviço. Agrupar organiza e nunca exclui: um álbum com
  dois formatos aparece nos dois cabeçalhos, e a tela diz que a soma passa do
  total. Medido no servidor: **258 linhas para 254 álbuns em 5 seções**.
  **[ao vivo]**
- **Preferência de reprodução** — local, streaming ou maior resolução. Ela
  ordena edições equivalentes e escolhe qual toca; nunca esconde as outras. O
  padrão é "sem preferência", e nesse modo nada é reordenado: quem não pedir
  continua com o play exatamente determinístico de antes. **[ao vivo]**
- **Vistas salvas** em `echoclassic.views.v1`: criar, salvar, carregar, renomear,
  duplicar, apagar e definir padrão. Uma vista guarda os quatro conceitos e a
  raiz a que pertence. Verificado o ciclo inteiro — salvar, limpar tudo,
  **recarregar a página** e restaurar, devolvendo os mesmos 254 álbuns e as
  mesmas 5 seções. **[ao vivo]**
- **Três ordenações novas** em Álbuns e Recentes: formato, biblioteca local
  primeiro e maior resolução primeiro. Conferidas sobre os 1.399 álbuns: por
  resolução o topo é FLAC hi-res; por origem descendente, remoto. **[ao vivo]**

### Alterado

- **O painel trabalha em rascunho.** Cada troca de filtro recarrega a
  biblioteca, e a pergunta costuma levar vários cliques; aplicar a cada clique
  cobraria o preço inteiro por clique. `Aplicar` entrega tudo de uma vez,
  `Cancelar` descarta. Fora do painel, na fileira de pílulas, a remoção continua
  imediata — ali a ação já é uma só. **[ao vivo]**
- **A fileira de filtros ativos escala.** Uma pílula por ajuste, cada uma com a
  marca do conceito a que pertence (◫ filtra, ⚙ agrupa, ★ prefere), a fileira
  rolando no próprio eixo, contagem de resultados e "Limpar tudo". Abaixo de
  700px vira um resumo com "Ver filtros". **[ao vivo]**
- **O descritor do filtro saiu do subtítulo de cada linha.** Com filtros
  combinados ele repetia a fileira inteira em cada uma das centenas de linhas.
  A fileira é permanente e diz a mesma coisa uma vez. **[código]**

### Corrigido

- **Agrupar por artista com um filtro ligado mostrava a pílula acesa sobre uma
  lista que ninguém tinha filtrado.** O ramo de agrupamento nunca chamava
  `mediaMatches`. É a família do bug C, reintroduzida pela porta que a separação
  dos estados abriu na 3.2.0: enquanto o `sortKey` era único, a combinação era
  inexprimível. O filtro passa a ser aplicado aos álbuns antes de virarem linha
  de artista. **[código]**
- **Artista relacionado não sabe filtrar, e agora diz isso.** A lista ali é
  montada pelo endpoint de artistas: não há álbum para conferir. Em vez de
  fingir, a tela avisa. **[código]**
- **O balde do desconhecido virou número na tela.** A 3.2.0 contava álbuns sem
  informação de mídia num booleano que nada renderizava — contar sem dizer é a
  mesma família do bug B. Agora a lista informa quantos ficaram de fora.
  **[ao vivo]**
- **Em Recentes, filtrar por gênero não fazia nada** — a consulta com
  `sort:new` ia sem `genre_id`. Passa a valer a mesma regra de Álbuns: uma
  consulta por gênero, resultados somados. **[código]**
- **Virtualização por soma de prefixos.** Enquanto tudo tinha a mesma altura,
  índice × altura bastava; com cabeçalho no meio essa multiplicação mente, e o
  sintoma seria a lista saltando na rolagem de 1.398 itens. Medido no servidor:
  `topPad + desenhado + botPad = 22.874px`, exatamente a altura de rolagem.
  **[ao vivo]**
- **A trilha A–Z some quando a lista deixa de ser alfabética** — com seções, a
  letra M aparece uma vez por seção e o salto não teria destino. **[código]**

### Acessibilidade

- O painel é um `dialog` modal com título associado, foco inicial no primeiro
  controle, `Tab` preso dentro, `Escape` e clique fora fechando. Cada opção é um
  botão com `aria-pressed` — o estado não depende de cor. Uma região `aria-live`
  anuncia a mudança de filtros e a contagem de resultados. **[ao vivo]**
- **O foco voltava para lugar nenhum.** No macOS, clicar num `<button>` não lhe
  dá foco: é a convenção da plataforma, e o Chrome a segue. `document.activeElement`
  na abertura era o `<body>`, e devolver o foco a ele é o mesmo que perdê-lo.
  Quem abre o painel passa o próprio elemento. **[ao vivo]**
- O portão de contraste reprovou a primeira versão da opção ligada — `--accent`
  sobre `--selected` dá 3,49:1 no tema claro. Ela passou a usar o texto normal
  (4,64:1), com borda de acento e peso como sinais redundantes. Quatro pares
  novos entraram na lista medida, que vai a 21. **[medido]**

### Interno

- Novo `filterpanel.js` com o componente `lms-filter-panel`, sobre os padrões de
  camada que a skin já tinha — nenhum framework de interface foi acrescentado.
- `format.js` ganha `editionRank` e `compareEditions`: tupla comparada da
  esquerda para a direita, nunca soma de pesos, porque somar é o que faz 192 kHz
  vencer um FLAC 16/44 bem masterizado por acidente aritmético. DSD fica em
  classe própria, sem ordenação técnica contra PCM.
- A suíte vai de 47 para 92 testes, com arreio novo para o painel. Quatro deles
  travam defeitos que só apareceram na tela: o foco do gatilho, a lista de
  gêneros enterrando o resto do painel, dois avisos truncados na mesma linha e a
  contagem espremida a 12px pelo `flex`.
- Todo template de componente passa a ser compilado no `vue-template-compiler`
  dentro da suíte: erro de template só aparece em produção, como tela branca.
- **País continua fora**, e agora o estado o recusa explicitamente. A medição na
  biblioteca real deu 3 álbuns em 1.397 (0,2%) com algo parecido com país, num
  campo cujo conteúdo dominante é assinatura de ripador. **[medido]**

## [3.2.0] — 2026-08-03

### Adicionado

- **Filtros combinam.** Dentro de uma faceta os valores somam, entre facetas eles
  restringem: `(FLAC ou ALAC) e Hi-Res`. A interface em nenhum momento diz AND ou
  OR — você lê "FLAC ou ALAC" dentro de Formato e entende que Resolução é outro
  cartão que se acumula. Antes só cabia um filtro por vez. **[ao vivo]** — três
  filtros devolvem 254 álbuns no servidor real, o mesmo número que um cálculo
  independente sobre o índice produz.
- **Cada filtro ativo vira uma pílula removível**, com o `×` dentro do próprio
  alvo, e a contagem de resultados na mesma fileira. Tocar remove aquele filtro e
  preserva os outros. **[ao vivo]**
- **Álbum sem informação de mídia passa a ser contabilizado** em vez de sumir
  calado. É a mesma família do bug B: dado ausente virando desaparecimento
  invisível. **[código]**

### Alterado

- **Filtrar, ordenar e agrupar viram três estados separados.** Até aqui um
  `sortKey` único por view decidia os três ao mesmo tempo — era dele que nasciam
  os bugs B e C, e era ele que tornava impossível combinar filtros. A migração
  desmembra o que estava gravado para o conceito certo: chave de mídia vira
  filtro, `artist` em Álbuns vira agrupamento, o resto vira ordenação com a
  direção preservada. Em Recentes, `artist` migra como **ordenação** e nunca como
  agrupamento. **[ao vivo]** — migração conferida com estado real do formato
  anterior.
- **A ordenação passa a ser total.** Os critérios encadeiam e o desempate segue
  por rótulo, artista e `id`; como o `id` é único, dois álbuns homônimos param de
  trocar de lugar entre renderizações. Nulo vai ao fim nos dois sentidos. **[código]**
- **Trocar de A–Z para Ano deixou de recarregar a biblioteca inteira.** Só filtro
  e agrupamento recarregam; ordenar recomputa a lista que já está na tela. **[código]**

### Desempenho

- **O índice de mídia sobrevive à recarga.** Ele responde "quais álbuns têm FLAC"
  varrendo as 14.210 faixas da biblioteca, e era refeito a cada abertura. Agora é
  guardado e invalidado pelo `lastscan` do servidor, que muda exatamente quando a
  biblioteca muda. **[ao vivo]** — medido no servidor real, mesmo componente, só
  o cache variando: **10.866 ms sem cache, 46 ms com cache**, com resultado
  idêntico de 1.397 álbuns. Formato compacto: 31 KB contra 149 KB.

### Corrigido

- **Recentes aparecia vazia dizendo "Nenhum item encontrado nesta categoria".**
  O filtro de mídia é gravado por view e sobrevive a sair e voltar, e a única
  pista de que ele existia era o descritor colado no subtítulo de cada linha —
  que sumia junto com as linhas. A mensagem afirmava algo falso: a categoria
  tinha itens, o filtro é que escondia todos. Agora um aviso permanente nomeia o
  filtro acima da lista, com um botão para limpá-lo, e a tela vazia diz qual
  filtro está escondendo tudo. **[código]** — reproduzido fora da tela contra a
  biblioteca real do servidor: das 16 chaves de filtro, 9 esvaziam Recentes;
  `stream:qobuz` rende 425 álbuns em Álbuns e 0 em Recentes, porque os 100 mais
  novos são todos locais.
- **O menu de exibição trocava de view por conta própria.** Escolher um formato
  ou uma resolução dentro de Artistas, Gêneros ou Anos chamava
  `setMusicView('albuns')` e a tela saltava para Álbuns sem avisar — quem tinha
  pedido "Hi-Res" continuava lendo "Artistas" e via uma lista de álbuns. Os
  quatro grupos de mídia agora ficam desabilitados nas views que não sabem
  filtrar, e o desvio deixou de existir. **[código]**
- **"Artista" em Recentes prometia um agrupamento que não existe.** Em Álbuns a
  opção produz linhas de artista; em Recentes ela apenas reordena álbuns, porque
  Recentes nunca passa por `loadPagedRoot`. Mesmo rótulo, duas semânticas — é a
  armadilha por trás de "procurei Beatles na lista de artistas e vieram álbuns".
  O grupo do menu passa a se chamar "Agrupar ou ordenar" só em Álbuns, e
  "Ordenar por" no resto. A ordenação por artista continua existindo. **[código]**
- **O aviso do filtro aparecia como uma tira vertical colada na lista**, e não
  como uma barra acima dela. `.pane-left` é um grid de duas colunas — conteúdo e
  a trilha do índice A-Z — em que todos os filhos têm posição explícita; o aviso
  entrou sem uma e o auto-placement o jogou na coluna do índice. **[ao vivo]**
- **Os avisos de truncamento apareciam em português numa sessão em inglês.**
  Cinco das seis frases nunca tinham entrada em `strings.txt`, e a sexta trazia o
  total concatenado na frente, então nenhuma chave podia casar com ela. O número
  passa a entrar por `{n}`, depois da tradução. **[ao vivo]**
- A suíte de testes estava vermelha desde a 3.1.2: `settings-import` montava um
  `LmsUi` de mentira, sem `TABS`, e quebrou quando `validateImportValue` passou a
  ler os enums da fonte. O código de produção estava certo; o stub é que
  mentia. **[código]**

### Verificado, sem alteração

- **O índice de artistas não está falhando.** Medido contra a biblioteca real
  (1548 artistas, 1398 álbuns, 14210 faixas), ele atribui 1388 de 1398 álbuns, e
  os 31 álbuns dos Beatles acertam nos dois contribuidores, 673 e 674. Os 10
  restantes são `P.F.M.`, `V.S.O.P.` e `Various Artists` — o comportamento
  documentado de `abbreviatedArtist`. A hipótese de índice corrompido está
  descartada. **[código]**

### Interno

- `allowsMediaFilter` em `ui.js` vira a fonte única da regra de quais views
  filtram; havia três cópias, e a de `browse.js` era a que trocava a view.
- Primeiro teste de `browse.js` e `ui.js`, com arreios (`uiContext`,
  `browseComponent`) que carregam os módulos reais em vez de stubs inventados.
- `check-contrast.py` ganha os dois pares do chip de filtro. Valeu: `--accent`
  sobre `--field` dava 3.88 no tema claro, abaixo do mínimo de 4.5, e nenhum par
  existente cobria essa combinação.
- `tools/deploy.sh`, `tools/rollback.sh` e `tools/release.sh`, para instalar e
  testar no servidor real antes de publicar.
- Testes de `ui.js` e `browse.js` sobem de zero para 47, cobrindo o modelo de
  estado, as quatro rotas de migração, a combinação de filtros, o comparador e o
  cache. Duas armadilhas de arreio ficaram travadas por teste: uma constante
  dentro de `methods` é embrulhada pelo Vue numa função, e um teste que fornece a
  dependência que o produto deveria ter valida a si mesmo.

## [3.1.2] — 2026-08-03

Torna alcançáveis os serviços do servidor — Qobuz entre eles — e fecha os itens
de perda silenciosa de dados que a 3.0.1 adiou. Nenhuma mudança no formato de
preferências nem na versão mínima do servidor.

### Adicionado

- **Aba Apps.** A raiz OPML `apps` já existia em `api.js` e nunca era montada:
  nenhum valor dinâmico chegava à prop `root` do `lms-opml`, que só recebia
  literais (`'radio'` em `app.js`, `'favorites'` em `actions.js`). Qobuz,
  MyQobuz, podcasts e todo menu de plugin do servidor não tinham rota nenhuma na
  interface, embora `opmlBrowse`, `opmlSearch` e `opmlPlay` já funcionassem para
  eles. [código]

### Corrigido

- **O coração podia apagar o favorito errado.** `refreshFavorite` escrevia
  `npFavorite`/`npFavoriteIndex` depois do `await` sem reconferir a faixa; duas
  trocas rápidas faziam o índice da faixa anterior sobreviver na tela da atual.
  `actions.js:loadFavorite` já fazia essa conferência. [código]
- **O desfazer da fila era gravado antes da chamada destrutiva.** Como
  `guarded()` engole o erro, uma falha deixava um "Desfazer" que reinseria
  faixas que nunca saíram. `removeFromQueue`, `clearQueue` e `clearUpcoming` só
  gravam o desfazer depois do sucesso, e `clearUpcoming` guarda apenas o que de
  fato removeu. [código]
- **Trocar de player no meio de "Limpar próximas" apagava faixas do player
  novo.** O laço relia `state.playerId` a cada volta; agora captura uma vez,
  como `undoQueue` já fazia. [código]
- **Transferir a reprodução truncava a fila em 500 faixas**, em silêncio.
  `handoffTo` copiava `state.queue`, que é só a janela carregada. A fila passa a
  ser relida inteira antes da transferência, e o que não vier é avisado.
  [código]
- **O botão de favorito da folha de ações disparava duas vezes.** `busy` era
  ligado e desligado, mas nunca testado ali — ao contrário de `addToPlaylist`.
  [código]
- **Álbuns sumiam do agrupamento por artista.** `browse.js` fazia
  `if (!artist) return null` e o `filter(Boolean)` seguinte apagava a linha, sem
  contagem e sem aviso. O alcance era maior do que "álbum sem artista": a raiz
  Artistas é montada paginando álbuns e mapeando cada um para um artista por
  nome, então a perda também cobria artista de álbum composto ("A & B"),
  coletânea de vários artistas, artista que só existe como contribuidor de
  faixa, e nome abreviado que `canonicalizeArtists` não resolveu. O álbum não
  atribuído passa a aparecer como álbum, e a tela diz quantos foram. [código]
- **`lms-detail` e a folha de informações não tinham token de requisição** — os
  dois únicos componentes com `await` sem guarda de corrida. Clicar no artista A
  (lento) e depois no B mostrava B e, segundos depois, os álbuns de A sob o
  cabeçalho de B. [código]
- **Um erro em pedido secundário deixa de apagar tela que já carregou.** No
  detalhe, se o bloco do álbum já está renderizado, a falha vira notificação.
  [código]

### Alterado

- As listas de validação da importação de preferências em `settings.js` eram
  literais duplicados de `ui.js`. Acrescentar uma aba lá invalidava o valor aqui,
  em silêncio. Passam a derivar de `LmsUi.TABS` e `LmsUi.MUSIC_VIEWS`. [código]
- Avisos de truncamento onde ainda não havia: listas OPML em 200 (Rádio,
  Favoritos e Apps), índice de artistas em 10.000, gêneros em 2.000, anos em
  500, discografia em 200 e gênero/ano em 1.000. [código]

## [3.1.1] — 2026-08-03

Corrige o que impedia a skin de ser gerenciada pelo próprio LMS depois de
instalada pelo repositório de extensões. Nenhuma mudança no formato de
preferências nem na versão mínima do servidor.

### Corrigido

- **`<enforce>1</enforce>` removido do `install.xml`.** Com essa marca, o
  `Slim/Utils/ExtensionsManager.pm` pula a skin ao montar a lista de plugins
  (`next if $entry->{'enforce'}`), então ela nunca aparecia em Active Plugins,
  nunca entrava no conjunto de "já instalados" e não podia ser desabilitada
  (`PluginManager.pm`: `Can't disable plugin: EchoClassic - 'enforce' set in
  install.xml`). Como consequência, o servidor a tratava como perpetuamente
  ausente e repetia o download a cada verificação, e a entrada era podada da
  seção do repositório, deixando o cabeçalho sem nenhum item para marcar.
  [código]
- A linha de metadados do álbum traduz a unidade antes de concatenar o número,
  então a interface em inglês mostra "12 songs" em vez de "12 músicas". Mesmo
  padrão já usado na fila de reprodução. [código]

### Alterado

- `repo.xml` passa a declarar `<category>skin</category>`. Sem isso a
  entrada ficava com categoria vazia e o filtro da página de plugins,
  que compara `s.category == id` no navegador, escondia o item sempre que
  qualquer categoria estivesse selecionada — inclusive "Skins", que é a
  escolha natural de quem procura uma skin. O cabeçalho do repositório
  continuava aparecendo, e por isso o sintoma era uma seção vazia. Não
  altera o pacote nem o SHA-1 da release. [código]
- `INSTALL.sh` deixa de acompanhar o pacote publicado. Ele é um utilitário de
  instalação manual específico do macOS; quem instala pelo gerenciador de
  extensões não tem uso para ele, e o script acabava dentro da pasta do plugin.
  Continua versionado no repositório, ao lado de `tools/install-local.sh`.
- Removidas do `INSTALL.sh` a migração da pasta com o nome antigo do projeto e
  a mensagem final que anunciava um alias de recuperação que não existe mais.

## [3.1.0] — 2026-08-02

Fecha a passada de publicação da skin sem alterar o formato de preferências ou a
versão mínima do servidor.

### Corrigido

- Resultados de álbum mostram artista e ano; resultados de faixa mostram artista,
  álbum, duração e origem traduzida. Dados ausentes na busca são enriquecidos por
  consultas pontuais ao servidor. [ao vivo]
- A navegação para artistas relacionados preserva a pilha da aba. O botão Voltar
  usa o rótulo da raiz quando o primeiro quadro repete o título da tela. [ao vivo]
- Favoritos vazio oferece a ação "Abrir Minha Música" e conduz à biblioteca.
  [ao vivo]
- Textos dinâmicos restantes usam o dicionário da sessão antes da concatenação;
  a interface em inglês não deixa a origem local em português. [ao vivo]

### Verificado

- Reprodução real: play, pause, seek, volume durante polling, anterior, próxima,
  avanço automático da fila, arquivo local e conteúdo Qobuz. Estado inicial do
  player restaurado após a sessão. [ao vivo]
- Cinco viewports sem overflow horizontal, controles interativos aninhados ou
  botões sem nome; player completo contido e cabeçalho da fila sem sobreposição
  em 390 px. [medido]
- Testes unitários cobrem formatação, tradução, importação de preferências,
  relevância e enriquecimento de busca; verificações estruturais cobrem os estados
  críticos de DOM. Troca de player, sincronização, transferência de reprodução e
  stream real sem duração conhecida continuam sem cobertura automatizada.
  [medido]
- Validação contínua executa testes, os quatro portões locais e a consistência de
  versão entre os três manifestos de release. [código]

## [3.0.1] — 2026-08-02

Fecha os defeitos bloqueadores encontrados na auditoria da 3.0.0. Sem mudança de
API, sem mudança de dados persistidos além de uma migração única de ordenação.

### Corrigido — bloqueadores

- **A barra inferior deixa de morrer com o player parado.** `activePlayback`
  governava três decisões ao mesmo tempo — texto, transporte e abertura do player —
  e `app.js` é o único caminho para `LmsUi.openPlayer`. Com fila carregada e
  `mode: 'stop'`, a barra dizia "Nada tocando" e o clique não fazia nada, embora
  `nowplaying.js` usasse critério diferente e o player completo funcionasse
  perfeitamente naquele estado. Agora abrir o player e mostrar o transporte
  dependem de haver faixa corrente; só o texto depende de fila vazia. [ao vivo]
- **Favoritos vazio deixa de mostrar "Empty".** O servidor devolve um item de
  placeholder do tipo `text`, então `items.length === 1` e o estado vazio em
  português — que já existia, centralizado e com a ação sugerida — nunca era
  alcançado. Uma lista composta apenas de itens `text` passa a contar como vazia. [ao vivo]
- **"Recentes" volta a mostrar o que é recente.** O servidor era consultado com
  `sort: 'new'` e o resultado reordenado alfabeticamente por cima, e o menu não
  oferecia nenhuma opção de recência. Nova chave `recent` = ordem nativa do
  servidor, padrão dessa raiz. Migração única para quem tinha `name` gravado,
  com flag que respeita escolha explícita posterior. [ao vivo]
- **O timeout do RPC passa a cobrir a leitura do corpo.** O `AbortController` era
  cancelado antes de `res.json()`: um servidor que mandava cabeçalhos e estancava o
  corpo deixava a promise pendente para sempre. Em cascata, `tick()` não
  reagendava e `startPolling()` se recusava a religar, então o polling morria pelo
  resto da sessão — inclusive depois de "Tentar novamente". [código]
- **"Tentar novamente" da busca volta a retornar.** `run()` nunca zerava
  `this.error`, e o template testa o erro antes dos resultados: depois de uma falha,
  a tela de erro ficava para sempre, mesmo com a busca já funcionando. [código]
- **Importar preferências deixa de poder inutilizar a skin.** Só o envelope era
  validado; um arquivo corrompido de forma ainda sintaticamente válida quebrava a
  skin a cada recarga, sem caminho de recuperação na interface. Validação de forma
  na importação, leitura defensiva em `ui.js` e `nav.js`, e backup do estado
  anterior em `echoclassic.import-backup.v1`. [código]
- **Página de ajustes do plugin deixa de abrir em branco.** `Settings.pm` apontava
  para `plugins/EchoClassic/settings/basic.html`, que não existia. O template foi
  escrito contra as classes que o LMS 9.1.1 realmente usa, conferidas na página de
  settings de outro plugin rodando. [pendente de reinício do servidor]
- **O alias `/mojo` deixa de ser registrado como uma segunda skin.**
  `HTML/mojo/skinconfig.yml` fazia o LMS listar "mojo" no seletor de skins, ao lado
  de "Echo Classic". O redirecionamento continua pelo `$LEGACY_URL_RE` do
  `Plugin.pm`. [ao vivo, após remoção do arquivo]
- **Zoom volta a funcionar.** `maximum-scale=1,user-scalable=no` saiu do viewport.
  A migração da tipografia de `px` para `rem` fica para a 3.1. [código]

### Corrigido — estado e sincronia

- Resposta de `refresh`, `loadQueue`, `playContainer` e `jumpTo` amarrada ao player
  que a pediu; trocar de player durante uma requisição lenta não mistura mais os
  dois estados nem grava a mistura na sessão. [código]
- `queueUndo` amarrado ao player de origem e limpo ao trocar de player. Antes,
  "Desfazer" depois de um handoff injetava a fila de uma sala na outra. [código]
- `volumeDragging` liberado em `pointerup`, `lostpointercapture` e `beforeDestroy`:
  encostar no slider e fechar o player congelava o volume exibido pelo resto da sessão. [código]
- `@pointercancel` no seek. Um scroll interpretado como arraste congelava o gauge e
  o tempo decorrido mesmo com a música tocando. [código]
- Tempo restante da fila desconta o que já tocou e fatia por `t.index`, não por
  posição no array. [código]

### Corrigido — interface

- Fila: botão de fechar próprio, fundo escurecido, "Limpar tudo" em dois passos e
  com cor destrutiva, ✕ da linha deixa de usar a cor do chevron (parecia
  desabilitado), ↑↓ desabilitados nos extremos, faixa atual com marcador não
  cromático e `aria-current`, e marcada só quando há faixa corrente de fato. [ao vivo]
- Escape fecha a camada mais alta aberta e devolve o foco ao gatilho. Antes não
  existia nenhum listener de teclado global no skin. [ao vivo]
- Volume em Ajustes virou controle real; era um `<span>` embora `setVolume`
  existisse e fosse usado pelo player. [ao vivo]
- "Parar ao terminar" desabilitado sem reprodução — com nada tocando o cálculo caía
  em `sleep 1` e desligava o player em um segundo. [ao vivo]
- Erro de validação de campo, erro ao tocar um item e erro fatal de carregamento
  deixam de compartilhar a mesma variável: um `http://` faltando não apaga mais a
  lista de rádios nem o texto digitado. [código]
- Item OPML sem ação deixa de receber `role="button"`, `tabindex` e chevron. [código]
- Busca OPML sem resultado deixa de mandar ativar um serviço de rádio. [código]
- Raiz de Minha Música restaurada entre sessões; era gravada e ignorada na leitura. [ao vivo]
- Radiogroups dos Ajustes com navegação por setas: 14 paradas de Tab viraram 5. [ao vivo]

### Corrigido — contraste, foco e alvos de toque

Treze pares abaixo do mínimo WCAG, recalculados nos dois temas e nos cinco esquemas
de acento. O esquema **padrão** era o que reprovava na aba ativa e no título da
navbar (4,20:1). Detalhe contraintuitivo: o trilho da barra de progresso no tema
claro foi clareado, não escurecido — o preenchimento é o acento escuro sobre trilho
claro, então escurecer pioraria. [calculado, com `tools/check-contrast.py`]

Foco visível em todo elemento interativo; os `outline:0` que anulavam o anel no
campo de busca, no nome de playlist, no botão "…" e no divisor foram removidos.
Índice A–Z de 22×12,8 para 28px com alvos de 24px; divisor arrastável de 14 para
24px; alça de remover da fila no celular de 36 para 44px. Bloco
`prefers-reduced-motion`, que não existia. [ao vivo]

### Corrigido — formatação

`duration()` mostra horas — um audiolivro de 1h15 aparecia como `75:00`.
`longDuration()` não produz mais "60 min", "1 h 60 min" nem "0 min".
`depth()` diz "24 bits". `coverUrl()` gera miniatura em qualquer tamanho: o
carrossel baixava doze capas em resolução original para exibir miniaturas de 104px.
Badge hi-res calculado por etiqueta — um CD rip 44,1/24 acendia "44,1 kHz".
"1 reprodução" no singular. [ao vivo]

### Segurança

Os valores que o Perl injeta em literais JavaScript passaram a ser escapados. Uma
aspa ou quebra de linha em `getPlayerHint` — que vem de um nome de player, valor
que o dono do dispositivo controla — fecharia o literal e o resto da linha viraria
código executável. **Não verificado:** não foi demonstrado que um nome de player
consegue carregar aspas até ali; é defesa em profundidade, não correção de
exploração comprovada.

### Removido

- `html/js/layers.js` — código morto que se anunciava como "the one place stacking
  order is decided", enquanto a ordem real estava nas variáveis do CSS. Um
  mantenedor futuro editaria o arquivo, recarregaria e não veria efeito nenhum.
- `HTML/mojo/skinconfig.yml` — ver acima.
- "by Felipe" da barra de status. Autoria pertence ao `install.xml` e ao README.

### Não versionado

`html/lib/vue-virtual-scroller.min.js` e `.css` existem na instalação mas não são
carregados por nenhuma página do skin, e não foi possível identificar de qual
release do pacote vieram (25.438 bytes não bate com nenhuma versão publicada no
npm). Ficaram fora do repositório de propósito. Se algum dia forem usados, entram
como dependência declarada.

`html/lib/vue.min.js` **está** versionado: foi confirmado byte a byte idêntico ao
`dist/vue.min.js` do `vue@2.7.15` — mesmo tamanho (107.335 bytes) e mesmo FNV-1a
(`be90b832`), medido no arquivo servido pelo próprio LMS.

## [3.0.0] — 2026-08-01

Baseline importada. Renomeação de MojoSkin para Echo Classic, com `/mojo` mantido
como alias de recuperação para bookmarks anteriores.
