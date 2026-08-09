# Echo Classic 3.2.6b — implementation handoff

**Read this whole file before you touch anything.** It is written to be self-contained: you do
not need any prior conversation, and you must not assume anything that is not written here.

You are continuing a partly-finished release. Two waves are already implemented and deployed.
Eight features remain. Every design decision below has already been approved by the project
owner — **do not redesign, do not "improve", do not add scope.** Your job is to implement what
is specified, verify it, and stop.

---

## 0. How to use this document

Work **one task at a time**, in the order given in Part 7. For each task:

1. Read the whole task section.
2. Read the files it names, using the search strings (not the line numbers — see the warning
   below).
3. Make the change.
4. Write the tests the task asks for.
5. Run the two gate commands from Part 4.
6. If both gates pass, stop and report. Do not start the next task in the same sitting.

### Line numbers in this document are approximate

Waves 1 and 1b already shifted many lines. **Every reference is given as `file:line` plus a
search string.** Trust the search string. If a search string is not found, say so and stop —
do not guess which code was meant.

### When to stop and ask

Stop and report instead of guessing if any of these happen:

- A search string in this document does not exist in the file.
- A gate fails and you cannot see why within two attempts.
- A task requires a decision this document does not answer.
- You are about to change a file this document did not name.
- You are about to delete or rewrite existing behaviour rather than add to it.

Guessing is worse than stopping. The project owner would rather answer a question than review
a wrong change.

---

## 1. The project in 60 seconds

Echo Classic is a **Vue 2 skin for Lyrion Music Server (LMS)**, shipped as an LMS plugin.

- **There is no build step.** The files in `EchoClassic/HTML/echoclassic/html/` are exactly what
  the browser runs. There is no bundler, no transpiler, no `npm run build`. What you type is
  what executes.
- Vue 2.7.15 is loaded as a global from `html/lib/vue.min.js`.
- Every module attaches itself to `window` under an `Lms*` name (`LmsApi`, `LmsStore`, `LmsUi`,
  `LmsNav`, …).
- `api.js` is the **only** module that knows the JSON-RPC wire format. No other file may
  construct an LMS command.
- The visual language is iOS 9 / iPod-era: calm, library-first, nothing crowding the main
  screen.

### Directory map

```
EchoClassic/
  install.xml            plugin manifest (version lives here)
  Plugin.pm              Perl entry point (version lives here too)
  Settings.pm            Perl settings page
  strings.txt            the translation dictionary
  HTML/echoclassic/html/
    css/ios9.css         the entire stylesheet
    js/
      api.js             JSON-RPC — the only wire-format module
      store.js           app state, polling, player selection
      ui.js              persisted UI preferences (localStorage)
      nav.js             per-tab navigation stack
      i18n.js            template translation (read Part 3 carefully)
      app.js             root component
      browse.js          left-hand library list
      detail.js          right-hand album grid / track stack
      queue.js           the playback queue
      settings.js        the Settings tab
      actions.js         action sheets / context menus
      opmlview.js        plugin-provided menus (Radio, Apps, Favourites)
      nowplaying.js      the full player
      albumblock.js, filterpanel.js, sortmenu.js, playlists.js,
      search.js, format.js
      chrome/            navbar.js, statusbar.js, tabbar.js, miniplayer.js
      lib/vue.min.js     NEVER EDIT THIS FILE
tests/                   node --test files
tools/                   deploy, rollback, validation scripts
docs/                    this file
```

---

## 2. Absolute rules

These are not style preferences. Breaking any of them breaks the product.

### 2.1 ES5 only

The skin must run without transpilation on old browsers.

- Use `var`. **Never** `let` or `const`.
- Use `function () {}`. **Never** arrow functions `() => {}`.
- **Never** template literals with backticks — *except* for the `template:` string of a Vue
  component, which is the one place backticks are already used.
- No `class`, no `async`/`await` in new code unless the surrounding function already uses it
  (`store.js` does use `async` — match what is already there in that file).
- No optional chaining `?.`, no nullish coalescing `??`, no spread `...`.

If you are unsure, look at the ten lines above and below your edit and match them exactly.

### 2.2 Never edit `html/lib/vue.min.js`

It is vendored Vue 2.7.15, verified byte for byte. If you think you need to change it, you have
misdiagnosed the problem.

### 2.3 `api.js` owns the wire format

If your change needs a new LMS command, add a function to `api.js` and call that function from
elsewhere. Never build a command array outside `api.js`. Never let raw command syntax reach a
template or a user-visible string.

### 2.4 Do not touch these without being told to

- `tools/deploy.sh`, `tools/rollback.sh`, `tools/release.sh` — deployment machinery.
- `repo.xml` — see Part 5.3 for why it is deliberately out of sync.
- Anything under `dist/` — gitignored build artefacts.
- Git history. **Do not commit unless explicitly asked.** Do not run `git push`, `git fetch`,
  `git rebase`, or any other git write command.

### 2.5 Do not run network commands

No `curl`, `ssh`, `scp`, `npm install`, `git fetch`, `git push`. If a task seems to need one,
stop and report. `npm test` and `npm run validate` are safe and run offline.

### 2.6 Fail safe, never fail loud

When an LMS capability is missing, **render nothing**. Never render a disabled button, never
render an error message on the main screen, never leave a dead control the user can press. A
feature that is unavailable should be invisible.

---

## 3. The language trap — read this twice

**This single issue consumed two entire releases (3.2.2 and 3.2.5).** It is the most common way
to break this project.

### 3.1 How translation works

`EchoClassic/strings.txt` is the dictionary. **The source language is English**, and each entry
is keyed by the English phrase, with Portuguese as a translation beside it.

`i18n.js` rewrites every component's `template:` string **once, at registration time**
(`Vue.component`). Search `i18n.js` for `translateTemplate` to find it.

### 3.2 What it reaches, and what it does not

| Where the text is | Reached automatically? |
|---|---|
| A plain text node — `<div>Queue artwork</div>` | **Yes** |
| A `{{ }}` interpolation — `{{ someLabel }}` | **Yes** — it is wrapped in `$t(...)` |
| A static attribute — `aria-label="Search"` | **Yes** |
| **A bound attribute — `:aria-label="..."`** | **NO — NEVER** |
| A string built by concatenation in JS | Only if the whole result is a dictionary key |

### 3.3 Why bound attributes are never reached

Search `i18n.js` for `ATTRS`. The regex requires **whitespace before the attribute name**. A
bound attribute is written `:aria-label=` — the character before the name is a colon, not
whitespace. It never matches. It will never match. This is not a bug you should fix; it is a
constraint you must work around.

**Therefore:** any `:aria-label`, `:title`, or `:placeholder` you add must call `tr()`
explicitly, like this:

```js
:aria-label="tr('Change player')"
```

and `'Change player'` must have a `strings.txt` entry.

### 3.4 `tr()` is per-component

There is no global `tr()`. It is defined separately inside several components. Search for
`tr: function` to find existing definitions (they exist in `browse.js`, `settings.js`,
`search.js`, `sortmenu.js`, `filterpanel.js`, and now others). **If the component you are
editing does not define `tr`, you must add it**, copying the existing definition exactly.

### 3.5 Server-provided text must NOT be translated

LMS already localises its own text. These must render verbatim, never wrapped in `tr()`:

- player names
- album, artist, track titles
- LMS release-type display names
- Don't Stop The Music provider names
- OPML / plugin menu titles
- library (Library View) names

Wrapping these in `tr()` produces a double-translation miss — the string is not in the
dictionary, so it passes through unchanged and you have added a useless key. Worse, it implies
to the next reader that it *should* be translated.

### 3.6 Your obligation on every task

Every new user-visible string is a **language change**, not a UI change.

1. Write the English text inline in the component.
2. Add an entry to `strings.txt` following the existing `ECHOCLASSIC_UI_<SLUG>` naming, with
   both EN and PT values. Copy the exact formatting (tabs, ordering) of neighbouring entries.
3. If the string is in a bound attribute or returned from JS, wrap it in `tr()`.
4. List every string you added in your final report.

There is a helper script, `node tools/check-source-language.js`. **It is noisy** — it currently
reports roughly 120 pre-existing false positives (it flags any line containing certain
substrings, including code identifiers). It is not wired into any gate. Use it for awareness
only; do not try to make it clean.

---

## 4. Verification — how to know you did not break it

Two commands. Both must pass before you report a task complete.

```
npm test          # node --test over tests/*.test.js
npm run validate  # 4 gates: JS syntax, Vue templates, cross-module refs, WCAG contrast
```

At the time this document was written the baseline is **130 tests passing** and
`npm run validate` printing **`TUDO PASSA`**.

### What the four validate gates check

1. **JS syntax** — `node --check` on every file in `js/` (skips `lib/`). Catches ES5 violations
   only if they are syntax errors; it will *not* catch an arrow function, because Node accepts
   it. You must enforce ES5 by reading your own diff.
2. **Vue templates** — compiles every `template:` string. Catches unclosed tags and bad
   directives.
3. **Cross-module references** — catches a call to an `Lms*` function that does not exist.
4. **WCAG contrast** — checks colour pairs in `ios9.css`. If you add a colour, this may fail.
   Fix by reusing an existing CSS custom property rather than inventing a colour.

### A third command that is EXPECTED to fail

```
npm run check-version    # will report a mismatch — this is correct, see Part 5.3
```

Do not "fix" it.

### Never report success over a failing gate

If a gate fails, either fix it or report the failure honestly. Do not describe a change as
working if you have not seen both gates pass. State evidence plainly: say what you ran and what
it printed.

---

## 5. What is already done

### 5.1 Wave 1 — foundations, player selector, queue artwork

**Foundations**

- **Queue rows now carry a stable album id.** The `status` request gained LMS tag `e`. Search
  `api.js` for `tags:alde` — the tag string is now `'tags:aldeKNcgltTIo'`. The row mapper adds
  an absent-safe `albumId` field.
- **Star ratings fixed.** The old code issued `['trackstat','setrating', …]`. `trackstat` is a
  **third-party plugin** and is not in the core LMS dispatch table, so ratings silently did not
  work on a stock server. It now uses the **core `rating` command**. Verified working against a
  real server that has no TrackStat installed.
- **Capability probing.** `api.js` gained `canCommands()`, which batches `can <cmd> ?` probes.
  `store.js` holds a `capabilities` map on state, resolved once at init, seeded with `rating`,
  `randomplay` and `dontstopthemusicsetting`. Search `store.js` for `loadCapabilities`.

**Player selector (AUDIT-11)** — a tappable row inside the full player's `.head`, positioned
**between the title `.t` and the artist line `.s`**, styled with `--np-sub` so it does not
compete with the accent-coloured artist line. Opens an action sheet listing players, showing
"Disconnected" and "Sleeping" states. Nothing was added to the library navbar — that placement
was considered and explicitly rejected. Search `nowplaying.js` for `np-player-row`; the matching
styles are in `ios9.css` under `.npfull .head .np-player-row`.

**Queue artwork (AUDIT-09)** — three modes selected from Settings:

| Mode key | Behaviour |
|---|---|
| `every` | cover art on every row (the old behaviour) |
| `album` | **default** — art once per run of consecutive rows sharing an album |
| `headings` | art once per run, plus a 22px caption row above each group |

Grouping is on the stable `albumId` **only**. Search `queue.js` for `showCover`.

### 5.2 Wave 1b — player memory and default player

- **Remembering the last player already worked** before this wave — `selectPlayer` has always
  called `saveSession()`. Do not "add" it again.
- **The real defect, now fixed:** the discovery routine used to overwrite the remembered player
  whenever that player was momentarily unreachable, so one page refresh taken while the player
  was asleep destroyed the user's choice permanently. **Preference and active player are now
  separate.** A fallback never writes back to the preference. Search `store.js` for
  `preferredPlayerId`.
- **A "Default player" setting** was added: either `Last used` (the default) or a specific
  player. Resolution order is: configured default → last used → first connected → nothing.
  Search `ui.js` for `DEFAULT_PLAYER_LAST`.

### 5.3 Version state — deliberate and slightly odd

| File | Version | Why |
|---|---|---|
| `EchoClassic/install.xml` | `3.2.6b` | what is installed |
| `EchoClassic/Plugin.pm` | `3.2.6b` | must match install.xml |
| `repo.xml` | `3.2.5` | **left behind on purpose** |

`repo.xml` advertises **published downloads**. 3.2.6b is a staged test build and will never be
published, so advertising it would point users at a release that does not exist.

This makes `npm run check-version` report a mismatch. That is correct. It is a **release** gate,
not a **deploy** gate — `tools/deploy.sh` only runs `npm test` and `npm run validate`.

### 5.4 Verified working on the real server

The following were confirmed in a browser against the live server, not merely read in source:
the player row and its picker; queue artwork grouping including the boundary where art returns
at an album change; the headings mode; both new Settings rows; the `rating` fix; and no console
errors on load, interaction, or reload.

---

## 6. LMS API reference — verified from server source

**These facts were read directly from the LMS 9.1.1 server source. Trust them. Do not
re-derive them, and do not substitute your own assumptions about how LMS works.**

If the LMS source is available on the machine you are working on, use the local LMS
application resources. If it is not available, **do not go looking on the network.**
Everything you need is in this section.

### 6.1 Release types (needed for AUDIT-05 / AUDIT-12)

- The primary taxonomy is exactly five values: **`Album`, `EP`, `Single`, `Broadcast`,
  `Other`** — `Slim/Schema/Album.pm:62-69`, modelled on MusicBrainz Release Group Type.
- **`Compilation` is deliberately NOT a release type.** `Album.pm:103-113` filters it out; it is
  a separate `albums.compilation` flag. Do not add it to the list.
- **Plugins and the scanner can add custom types.** They are registered with display strings
  under the prefix `RELEASE_TYPE_CUSTOM_`. **Therefore the list must be discovered at runtime,
  never hardcoded.**
- Display names come from the server and resolve through a token cascade
  (`Album.pm:161-173`). **Render what the server returns. Do not add these to `strings.txt`.**
- The query parameter is `release_type`. It accepts a **comma-separated list** and is uppercased
  server-side.
- The `albums` tag for release type is **`W`**, and Echo Classic **already requests it** —
  search `api.js` for `tags:jaSlytW2`. The field is already mapped to `releaseType`.
- When an album has no stored type, **the server substitutes the literal `'ALBUM'`**. So missing
  metadata mostly never reaches the client.

### 6.2 Contributor roles (needed for AUDIT-04)

- The parameter is **`role_id`**, and its values are **uppercase role NAMES, not numbers**.
- Built-in roles: `COMPOSER`, `CONDUCTOR`, `BAND`, `ALBUMARTIST`, `TRACKARTIST` —
  `Slim/Schema/Contributor.pm:79-83`.
- **Custom roles are a supported LMS feature** (there is a `MIN_CUSTOM_ROLE_ID` threshold), so
  a library may define roles like "Soloist". **The list must be discovered, never hardcoded.**
- Discovery command: **`roles`**, dispatched to `rolesQuery`. It returns a **`roles_loop`**.
- **Do NOT build against `modes_loop`.** That comes from the Material skin's own server-side
  plugin reaching a *private* LMS method. It is not a core API and will not exist.

### 6.3 Library Views (needed for AUDIT-06)

- List them with the **`libraries`** command. **Trap: the result loop is confusingly named
  `folder_loop`, not `libraries_loop`.** Hide this quirk inside `api.js` and never repeat it.
- Read the current one with **`libraries getid`**, which **requires a client** — Library Views
  are **per player**, not global.
- **The value is a server pref on the client named `libraryId`.** Over JSON-RPC that is
  `playerpref libraryId <id>` — and `api.js` already has `playerPref` / `setPlayerPref`
  functions. **No new API surface is needed.**
- **Trap 1 — there is a global fallback.** If a player has no `libraryId`, LMS falls back to a
  server-wide one. So an empty player pref does **not** mean "everything". The UI must show the
  *effective* library.
- **Trap 2 — clearing is a REMOVAL, not a write.** LMS calls `remove('libraryId')` when the
  value is empty. If you write an empty string instead, you pin the player to "no library"
  rather than restoring the server default. **This is the single easiest way to get this feature
  wrong.**

### 6.4 Random Play (needed for AUDIT-02)

- Bundled with LMS and **enabled by default**, but the user can disable it — so you must still
  probe.
- Mix types, verbatim from `Slim/Plugin/RandomPlay/Plugin.pm:56`:
  **`track`, `contributor`, `album`, `year`, `work`**. (`work` is new in LMS 9.x and is the
  classical-works mix.) There is also a pseudo-mode `disable` which stops the mix.
- Start a mix: `randomplay <mode>`.
- **Ask whether a mix is running: `randomplayisactive`.** This is important — it is how the UI
  knows to show that a mix is active.
- Filtering commands also exist: `randomplaygenrelist`, `randomplaychoosegenre`,
  `randomplaylibrarylist`, `randomplaychooselibrary`. Note the last two tie Random Play to
  Library Views (AUDIT-06).

### 6.5 Don't Stop The Music (needed for AUDIT-03)

- Bundled and enabled by default. Command: **`dontstopthemusicsetting`**.
- **The selection is a playerpref named `plugin.dontstopthemusic:provider`**, where **`0` means
  disabled**. `api.js`'s existing `playerPref` / `setPlayerPref` drive this as-is.
- The provider list is returned as an OPML **`item_loop`** whose entries carry **only
  `actions.do`** — not `go`, not `play`.
- **This is why AUDIT-08 blocks AUDIT-03.** Echo Classic's OPML adapter currently only
  understands `go` and `play`, so the provider list would render as a list of dead rows. Widen
  the verbs first.
- Provider display names come from the server and are already localised — **do not translate
  them.**

### 6.6 Plugin menus (needed for AUDIT-08)

- **`menu` with the `direct:1` flag** returns the whole main menu as an `item_loop`, each entry
  carrying a **`node`** field saying which section it claims (`myMusic`, `radios`, `favorites`,
  `extras`/`plugins`).
- **`contextmenu`** is LMS's generic per-item action menu — the server-side answer to "what can
  I do with this track / album / artist". Echo Classic does not use it yet.
- Real plugins emit these action verbs: **`go`, `play`, `do`, `playall`, `add`, `insert`**.

### 6.7 Other commands worth knowing

| Command | Use |
|---|---|
| `rating <item> <0-100>` | core star rating (already implemented) |
| `works` | classical works browse, new in 9.x |
| `musicfolder` / `mediafolder` / `readdirectory` | file-system browse |
| `alarm` / `alarms` | per-player alarms |
| `syncgroups` | existing sync groups |
| `getstring <tokens>` | resolve server string tokens to display text |

---

## 7. The remaining work

**Do these in this order.** The order encodes real dependencies, not preference.

---

### TASK 1 — AUDIT-08 Option A: plugin navigation adapter

**Do this first. It unblocks TASK 4.**

#### Goal

Make the existing OPML adapter handle everything real plugins actually send, and file plugin
entries into a sectioned Apps tab.

#### Approved design

**Option A, "Contained":** every plugin-provided entry lives under the **Apps** tab, grouped
into sections. The Library, Radio and Favourites tabs are **not touched**. A plugin can never
alter the browse experience.

(There is an Option B, "Distributed", which routes entries by their `node` field into the
Library root list. **That is TASK 8, and only after TASK 7.** Do not attempt it now.)

#### Files

- `js/api.js` — search for `OPML_ROOTS`, `opmlKind`, `opmlPlayNode`, `opmlImage`
- `js/opmlview.js` — search for `actionable`
- `js/actions.js` — the action sheet

#### The five gaps to close

1. **The root table is a closed literal.** Search `api.js` for `OPML_ROOTS` — it contains
   exactly `radio`, `favorites`, `apps`, and the lookup function **throws** on anything else.
   Turn it into a registry that can accept a discovered root. Three shipping tabs depend on this
   map, so change it carefully and keep the existing three working identically.
2. **Action verbs beyond `go`/`play` are silently discarded.** Search `api.js` for
   `opmlPlayNode` — it reads only `acts.play || acts.go`. Real plugins also send **`do`,
   `playall`, `add`, `insert`**. Honour them. **`do` is the one that unblocks TASK 4.**
3. **Icons are extracted then thrown away.** `api.js` has an `opmlImage` function that pulls the
   plugin's icon out; `opmlview.js` ignores it and always draws one of two inline SVGs. Use the
   icon when present, and **keep the existing SVG as the fallback** when it is absent.
4. **No `contextmenu` support.** Search `actions.js` for the static map of item kinds to id
   fields. Replace/augment it so per-item actions can come from the LMS `contextmenu` command,
   making plugin-contributed actions reachable on tracks, albums and artists.
5. **No duplicate protection.** The OPML path has no dedupe. `api.js` has a `uniqueBy` helper
   used on the search path — reuse that idea.

#### Behaviour that already works and MUST survive

- **Malformed items degrade to an inert row.** Search `opmlview.js` for `actionable` — it
  refuses to make a row clickable when the child node could not be resolved. There is a comment
  recording that an earlier version rendered a chevron that did nothing. **A malformed item must
  never blank the whole list.**
- **Unknown item types default to `'menu'`** rather than throwing.
- **Navigation history works at arbitrary depth** for plugin trees the skin has never seen.
  Search `opmlview.js` for where it pushes onto the nav stack. Do not rebuild this.
- **No raw command syntax reaches the UI.** `cmd` and `params` stay inside the frame object; the
  template renders only the title. Keep that invariant.

#### Sectioned Apps tab

Group entries under headings. There is an existing section-header style — search `ios9.css` for
`.sec-head`. Suggested grouping: music services, information, players & tools. Section headings
are **your** strings and need `strings.txt` entries; the plugin names inside them are **server**
strings and must not be translated.

#### Acceptance criteria

- All three existing tabs (Radio, Apps, Favourites) behave exactly as before.
- A plugin item carrying only `actions.do` is clickable and performs its action.
- A plugin item with an icon shows it; one without still shows the fallback SVG.
- A malformed item renders inert; the rest of the list still renders.
- Duplicate entries are collapsed.

#### Tests

- fixture per action verb (`go`, `play`, `do`, `playall`, `add`, `insert`)
- a malformed item (no actions, no title, unknown type) → list still renders, item inert
- an item with a missing icon → fallback used
- duplicate entries → collapsed

---

### TASK 2 — AUDIT-10: queue reorder controls

**Must come after wave 1's queue work, which is already done. Touches the same template.**

#### The problem

Every 52px queue row currently carries **three 44px controls** — up arrow, down arrow, remove.
That is 132px of permanent chrome per row, which is why the stylesheet has to hide the track
duration entirely on narrow screens. Search `ios9.css` for `1251` context or for the media query
that hides `.dur`.

The arrows are also literal `↑` and `↓` **text characters** in the template — the only controls
in the whole skin that are not inline SVG.

#### Approved design

- A **drag handle** and a **compact overflow menu** on the row.
- Up / Down / Move to top / Play next / Remove move **into the overflow menu**.
- The duration comes back, on mobile too.
- **Keyboard support is kept regardless.** If drag-and-drop ships, a non-drag path must remain.

#### CRITICAL TRAP — a name collision

Search `queue.js` for `title="Remove"`. The button it is on carries `class="drag"` — but
**`.drag` is currently the REMOVE button**, not a drag handle. It renders an ✕, and `ios9.css`
strokes it with `--destructive` (search `ios9.css` for `.qrow .drag`). The name is a lie left
over from an earlier design.

**You must rename it before adding a real drag handle**, or the CSS will fight itself. Rename
the existing one to something honest (e.g. `.qremove`) and update `ios9.css` to match.

#### Behaviour that MUST survive

Search `queue.js` for `data-move`. After a move, the code re-finds the moved row by that
attribute and **restores keyboard focus to it**, falling back to the opposite-direction button
when the row reaches an end. This is careful accessibility work. **Preserve it.** "Move up" and
"Move down" in the overflow menu must keep this focus behaviour, not replace it.

#### Language

Every `:aria-label` here is a bound attribute — **re-read Part 3.3.** The existing labels are
built by concatenation in bound attributes and are therefore English-only in every language
today. New ones need explicit `tr()` and `strings.txt` entries.

#### Acceptance criteria

- Row chrome shrinks; duration is visible on narrow screens.
- Keyboard move works and focus follows the moved row.
- Remove is reachable without a pointer.
- Touch targets remain at least 44px.

#### Tests

- keyboard move path still moves the row and restores focus
- remove works from the overflow menu
- the row renders correctly at the narrow breakpoint

---

### TASK 3 — AUDIT-02: Random Mix

#### Goal

Let the user start a random mix and see that one is running.

#### Approved placement

The queue's existing **mode row** — search `queue.js` for `queue-modes`. It currently holds two
buttons (shuffle, repeat) and already flexes. **Not the main navigation. Not a new screen.**

#### Implementation

- Gate on the capability map from wave 1 (search `store.js` for `capabilities`). If
  `randomplay` is unavailable, **render nothing** — the row simply stays at two buttons, exactly
  as today.
- Offer the five real mix types from Part 6.4: `track`, `contributor`, `album`, `year`, `work`.
  Present them in the user's language (these are **your** labels, not server strings).
- Start with `randomplay <mode>`; stop with `randomplay disable`.
- **Show that a mix is running.** Use `randomplayisactive`. There is an existing strip below the
  mode row — search `queue.js` for `queue-start` — which is the natural place to say so.
- The queue itself needs no special handling: LMS replaces the server playlist and the existing
  queue polling picks it up.

#### Wording — needs the owner's confirmation

The mock used "Mix: albums". **This is not final.** Implement it, and list it in your report as
a string the owner should confirm before release.

#### Acceptance criteria

- Control absent entirely when the capability probe fails.
- Starting a mix fills the queue; the running state is visible.
- Stopping a mix works.

#### Tests

- capability false → no control rendered
- the running-state indicator reflects `randomplayisactive`

---

### TASK 4 — AUDIT-03: Don't Stop The Music

**BLOCKED BY TASK 1.** Do not start this until TASK 1's verb widening is done, or the provider
list will render as dead rows. See Part 6.5.

#### Implementation

- Same placement as TASK 3 — the queue mode row. Design that row once for both.
- Command: `dontstopthemusicsetting`.
- Read and write the selection via the existing `playerPref` / `setPlayerPref` in `api.js`, with
  the pref key `plugin.dontstopthemusic:provider`. **`0` means disabled.**
- The provider list arrives as an OPML `item_loop` carrying `actions.do`.
- **Provider names are server text — do NOT wrap them in `tr()`.**
- If the capability probe fails, render nothing.

#### Acceptance criteria

- Provider list renders and is clickable (this is the TASK 1 dependency).
- Selecting a provider persists it; selecting "off" writes `0`.
- Absent plugin → no control at all.

#### Tests

- provider list rendered from a fixture using `actions.do`
- disabled state round-trips through the pref

---

### TASK 5 — AUDIT-05: Release Type as a real axis

**Must come before TASK 6.**

#### Goal

Make release type a first-class filter/group axis. **The data already arrives** — see Part 6.1;
`api.js` already requests tag `W` and maps `releaseType`. Today it is only displayed as a text
line in two places.

#### Implementation

- **Discover the taxonomy at runtime** from the release types actually present in the library.
  Do not hardcode a list — re-read Part 6.1 on custom types.
- Give the discovered list a **configurable display order**. This is what TASK 6 needs in order
  to order its groups.
- Add release type to the filter panel and the sort/group grammar. Search `ui.js` for
  `validSortKey`, `validSection`, `MEDIA_FILTER` to find the tables that need to learn about it.
- **Display names are server text.** Render what the server returns; do not add them to
  `strings.txt`. Only your own labels ("Release type", "Group by") get entries.

#### Acceptance criteria

- Albums with empty, unknown, or duplicate release types render without layout shift.
- A custom (non-built-in) release type appears in the list.

#### Tests

- album with a custom release type
- album with no release type (remember the server substitutes `'ALBUM'`)

---

### TASK 6 — AUDIT-12: album grid views, sorting and grouping

**Depends on TASK 5** for the configured group order.

#### The three parts

**(a) Three presentation modes.** The switcher **already exists** — do not invent one. Search
`app.js` for `segments` and `ALBUM_MODES`. There is already a segmented control in the navbar
that appears when you are inside an artist, driven by `ui.albumMode`, with two values today
(`albums` = cover grid, `tracks` = full stack). It is persisted and validated already.

Add two more modes:

| Mode | Look |
|---|---|
| covers | today's cover grid (exists) |
| list | text rows, no artwork — densest |
| compact | 32px thumbnail + name on a 44px row |
| tracks | today's full track stack (exists) |

Four segments is the width limit on a 320px phone. Three icons plus the word "Tracks" fits.
**Icon-only segments each need an `aria-label` — that is a bound attribute, so re-read Part
3.3.**

**(b) The grid must obey sort and group.** Today it ignores them entirely. Search `detail.js`
for the `v-for` that renders albums — it renders straight from its own list. Note that
`LmsUi.state` is **already in scope** in that component; it simply is not consulted.

**(c) Grouping is OPTIONAL.** Group-by defaults to **None**. A user who only wants an order
picks a sort and never sees a section header. Sorting alone must be a complete answer.

#### CRITICAL TRAP

Search `detail.js` for `markEditions`. It sorts **unconditionally** and both of its call sites
depend on the result. Any comparator you apply after it will silently discard the edition
adjacency it exists to create. **Separate edition-marking from ordering before adding a second
sort key.**

#### Reuse, do not reinvent

Search `browse.js` for `displayItems`. It already implements two-level bucketing where each
bucket carries an explicit **`rank`** used as the primary group-order key — which is exactly
what a configured release-type order needs. The algorithm exists; it is in the wrong component.

#### An open question you must ask, not answer

The detail pane is not a "view" and has no preference record of its own. Either give it one, or
have it inherit the parent view's. **The owner leans toward inheriting** (fewer tables, less
migration risk) but has not decided. **Ask before implementing.**

#### Worked example to validate against

> Miles Davis → grouped by Release Type → groups ordered by the configured Release Type order →
> albums within each group sorted by year ascending.

#### Tests

- the worked example above, over a fixture with mixed and missing release types
- group = None produces no headings
- an unknown persisted album mode falls back cleanly

---

### TASK 7 — AUDIT-06: Library Views

**Read Part 6.3 completely before starting. It contains two traps that are easy to ship
broken.**

#### Approved design

- **Per player.** Not global.
- **Echo Classic stores nothing.** The value lives on the server; read it, do not remember it.
- Selector goes in the **existing filter panel** (search `app.js` for where the filter panel is
  mounted) or a library context menu. **Not the main screen.**
- **Name the player in the group heading** — e.g. "Library for Living Room". Without that it
  reads as a global setting, which it is not.
- Show the **effective** library, including when it is inherited from the server default. There
  must be a visible state for "this player has no library of its own, so it follows the server".

#### The two traps, restated because they matter

1. **Global fallback** — an empty player pref does not mean "everything".
2. **Clearing is a removal, not a write of `''`.**

#### Knock-on you must implement

Search `store.js` for `selectPlayer`. It already reloads player settings and the queue on
switch. It must **also** re-read the library view and refetch the browse list, because the
*results themselves* change when the player changes. Without this, switching player leaves the
previous player's library on screen.

#### A related, lower-severity issue

A saved genre filter stores a **server genre id**. Genre ids stay globally valid under library
scoping, so a stale filter produces a **silently empty result, not wrong data**. Handle it with
an explanatory empty state and a way to clear the filter — it is not a correctness bug.

#### Known limitation — document, do not solve

Synced players can hold different library values and LMS does not reconcile them. Whichever
player is selected wins. Note it in the changelog rather than trying to fix it.

#### Tests

- clearing issues a removal, not an empty write
- a player with no pref shows the server default state
- switching player refetches the browse list

---

### TASK 8 — AUDIT-04 then AUDIT-08 Option B

**This is the highest-risk work in the project. Do it last.**

#### 8a — AUDIT-04: additional browse roots

Read Part 6.2 first.

**Why it is risky:** search `ui.js` for `MUSIC_VIEWS`. The five browse roots are a frozen
literal, and **at least five more hand-written tables are keyed to those same five strings** —
search for `DEFAULT_SORT_BY_VIEW`, `allowsMediaFilter`, `validSortKey`, `validGroup`,
`validSection`. On top of that there is a **saved-state migration loop** — search for the
migration in `ui.js` — which is the code that protects existing users' stored preferences across
upgrades.

Adding a discovered root means turning five literal tables into data **and** making the
migration tolerate view keys it has never seen. **An unknown key must fall back cleanly and must
never wipe a user's saved state.**

**Design requirements:**

- Discover roles via the `roles` command (Part 6.2). Never hardcode.
- **The default view stays at five roots.** Everything new is **off** until the user enables it.
- Enable / disable / reorder lives in Settings, following the pattern wave 1 established for the
  queue artwork picker.
- The root picker UI itself needs **no change** — search `app.js` for the `v-for` over views; it
  is already generic. Only the *source* of the list changes.
- Role labels come from the server — **do not translate them.** Only your Settings group heading
  is your string.

**Tests:** an unknown persisted view key round-trips through the sanitiser without throwing and
without wiping saved state. This is the single most important test in the whole task.

#### 8b — AUDIT-08 Option B: plugin categories in Library

Only after 8a, because **it reuses 8a's machinery**. Building it first means writing that
machinery twice.

- One switch in Settings: "Show plugin categories in Library", **off by default**.
- Turning it on **reveals** a per-category list; it does not enable anything by itself. Each
  plugin category still starts off.
- Entries are routed by the `node` field from `menu … direct:1` (Part 6.6).

---

## 8. Deploy and rollback

**Do not run these yourself unless explicitly told to.** Propose the command and stop.

The deploy target is the **music server**, never the local machine. The repository is the only
thing that lives locally.

```
# preview — writes nothing
ECHO_HOST=musicplayer@musicplayer.local ECHO_HTTP_HOST=musicplayer.local:9000 tools/deploy.sh -n

# deploy; -r restarts LMS and is REQUIRED if Plugin.pm, Settings.pm or strings.txt changed
ECHO_HOST=musicplayer@musicplayer.local ECHO_HTTP_HOST=musicplayer.local:9000 tools/deploy.sh -r

# undo — restores the most recent restore point
ECHO_HOST=musicplayer@musicplayer.local tools/rollback.sh
ECHO_HOST=musicplayer@musicplayer.local tools/rollback.sh -l          # list points
ECHO_HOST=musicplayer@musicplayer.local tools/rollback.sh -t <stamp>  # specific point
```

Notes:

- `deploy.sh` takes a restore point **automatically** before writing. `rollback.sh` takes its
  own safety point before restoring, so a rollback can itself be rolled back.
- The default host in `tools/lib/echo.sh` is `lms@lms.local`, which **does not resolve**. The
  override above is required.
- **Known hazard:** `-r` issues a server restart, and the macOS wrapper app has been observed to
  shut the server down **without bringing it back**. The tell is that the server log shows *no
  start attempt at all* — that distinguishes it from a plugin load failure, which would log a
  Perl error. Recovery is to quit and relaunch the app on the server.
- Skin URL: `http://musicplayer.local:9000/echoclassic/`. Hard-reload after deploying
  (Cmd+Shift+R).

---

## 9. Known defects not yet fixed

These are real, confirmed, and small. Fix them when convenient — or when the owner asks.

1. **Portuguese strings in the album context menu.** Search `actions.js` for `Reproduzir`. Three
   menu items render as *"Reproduzir agora"*, *"Reproduzir a seguir"* and *"Fixar no Echo
   Classic"* while the fourth is English. Confirmed visible in the running interface. The source
   language is English, so these should be English text with `strings.txt` entries carrying the
   Portuguese translation.
2. **The player picker sheet anchors to the left of its trigger** on the wide docked layout,
   appearing visually detached from the row that opened it. Functional but wrong-looking.
3. **The action sheet's own dialog label is a bound attribute** built by concatenation, so it is
   English-only in every language. This predates all current work and affects every item kind.

---

## 10. Reporting — what to hand back

When you finish a task, report exactly this and nothing more:

1. **Files changed**, one line each.
2. **Gate output** — paste the real tail of `npm test` and `npm run validate`. Not a summary.
3. **New user-visible strings** you added, with the file they appear in, and confirmation that
   each has a `strings.txt` entry.
4. **Anything you could not do, or did differently, and why.**
5. **Evidence markers on every claim** — this project requires them:

   | Marker | Means |
   |---|---|
   | `[code]` | you read it in the source; you did not run it |
   | `[measured]` | a named script produced it — cite the script |
   | `[unverified]` | say exactly what access or time was missing |
   | `[live]` | **you saw it happen in the running interface** |

   **Do not write `[live]` for something you did not observe running.** If you only ran tests,
   your evidence is `[measured]`, not `[live]`. An unverified change is still worth merging; it
   is just not worth describing as verified.

Do not commit. Do not deploy. Do not start the next task.
