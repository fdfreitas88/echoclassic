# Echo Classic — LMS user-complaints execution program

Invoke with:

`Read docs/prompts/task-loop.md and docs/prompts/lms-user-complaints-program.md, then execute the first READY idea only.`

This document converts the LMS skin/forum research into an ordered product program.
`docs/prompts/task-loop.md` remains the workflow authority. This file supplies the
ideas, boundaries, dependencies and seed acceptance criteria; it does not bypass any
task-loop stage, mockup approval, live acceptance or publication checkpoint.

## 0. Program rule: one loop per idea

The canonical loop handles one idea at a time. Never implement this whole document as
one change. For each `READY` item below:

1. start at task-loop Stage 1;
2. create `docs/prompts/<slug>-brief.md` with verified source locations and final ACs;
3. create and present the required mockup or interaction contract;
4. stop at `AWAITING_MOCKUP_APPROVAL`;
5. after approval, continue that idea through implementation, verification, audit,
   troubleshooting and user live acceptance;
6. reach `PUBLISH_READY` or an explicitly requested earlier terminal state before
   starting the next idea.

Do not silently absorb a neighbouring idea. A discovery belongs in that idea's
follow-up list unless it blocks the current acceptance criteria.

## 1. Product outcome

Echo Classic should become the LMS web interface that resolves the most common user
friction without trying to reproduce every Material Skin option:

- controls remain reachable while browsing and while the queue is visible;
- long plugin/service lists remain complete and keep their actions;
- player, sync and volume state is explicit and reversible;
- playback automation is available without exposing dead controls;
- classical and advanced libraries can be browsed without returning to Default;
- accessibility, translation and Light/Dark/Legacy behaviour remain release gates;
- optional plugins degrade in place according to
  `docs/prompts/plugin-dependency-policy.md`.

Success is behavioural parity for the selected complaints, not visual imitation of
Material. Echo Classic's current interaction grammar and layout remain authoritative.

## 2. Evidence baseline and source status

Research sources to verify again during the applicable Stage 1 because forum and
Material behaviour can change:

- `https://github.com/CDrummond/lms-material` — Material feature baseline.
- `https://forums.lyrion.org/forum/user-forums/3rd-party-software/106269-announce-material-skin/page1112`
  — queue occlusion, unavailable grid views, party-mode control state and user identity.
- `https://forums.lyrion.org/forum/user-forums/3rd-party-software/106269-announce-material-skin/page1143#post1812058`
  — plugin lists over 100 items losing context actions and native-app multi-server request.
- `https://forums.lyrion.org/forum/user-forums/3rd-party-software/106269-announce-material-skin/page422`
  — individual volume controls for synchronised/grouped players.
- `https://forums.lyrion.org/forum/user-forums/3rd-party-software/106269-announce-material-skin/page671`
  — fixed and “Do Not Set Volume” group-player behaviour.
- `https://forums.lyrion.org/forum/user-forums/3rd-party-software/106269-announce-material-skin/page463`
  — easier alarm access for the selected player.
- `https://forums.lyrion.org/forum/user-forums/3rd-party-software/106269-announce-material-skin/page676`
  — optional server/Raspberry Pi temperature display.
- `docs/material-vs-echoclassic-gaps.md` — historical gap sheet; verify every status
  against the current tree because replay gain, sync, lyrics and playlist editing have
  moved since it was written.
- `docs/prompts/orquestracao-3.3.md` and `docs/prompts/mockup-3.3-features.html` — accepted
  or proposed 3.3 work that this program must not duplicate.

Evidence already established locally on 2026-08-15: `npm test` reports 367 passing,
zero failing tests. This is historical baseline context only; each loop records its own
fresh baseline and settled-diff gates.

## 3. Existing work gate

Before selecting a program item, inspect the worktree and `orquestracao-3.3.md`.
The current working tree contains uncommitted 3.3 work. Preserve it and do not call it
work produced by this program.

These capabilities are owned by the 3.3 orchestration and are therefore `EXTERNAL` here:

| Capability | Existing owner | Program action |
|---|---|---|
| Replay gain | R1 | Do not duplicate; verify landed/live state before dependent work. |
| Lyrics | R2 | Do not duplicate; richer biography/review integration remains a later idea. |
| DSTM and RandomPlay | R3 | Do not duplicate; party mode may consume their settled state later. |
| Sync status, Unsync, Group Players absent row | R4 | Prerequisite for group-volume work. |
| Alarms | R5 | Do not duplicate; improve discoverability only if live acceptance identifies a problem. |
| SqueezeDSP absent branch | R6 | Do not build the full EQ in this program. |

An `EXTERNAL` prerequisite is satisfied only by a real landed hash recorded in
`docs/prompts/state.md`, passing gates for that diff and any required live acceptance.
Placeholder hashes do not satisfy it.

## 4. Priority and selection

At invocation, select the first item whose status is `READY` and whose prerequisites
are satisfied. If none is eligible, stop with `BLOCKED` and name the single prerequisite
that must settle next. Do not skip ahead merely because a later item looks easier.

### 3.3.0 release insertions

These requested ideas sit alongside the complaint queue and must be settled for the
3.3.0 candidate. They do not weaken the one-idea-per-invocation rule. Select the first
eligible row here before continuing with the general queue. A user-checkpoint row is not
`READY` until that decision is recorded.

| Order | ID | Outcome | Current gate | Prerequisite |
|---:|---|---|---|---|
| A | SETVIS-01 | Responsive themed inherited Settings; scan gauges and live activity | PUBLISH_READY | Chrome Light/Dark/Legacy wide/narrow matrix passed on deployed asset `1786889460` |
| B | LIST-01 | Complete paginated service lists with stable actions and NEW marker | PUBLISH_READY | live Qobuz 434-item pagination/action/end-state matrix passed on asset `1786892228` |
| C | SCANERR-01 | Recoverable scan continuation plus retained ignore/retry journal | AWAITING_MOCKUP_APPROVAL | checklist approval; installed-server capability probe |
| D | ARTMETA-01 | Local artist enrichment plus MusicArtistInfo install hand-off | AWAITING_MOCKUP_APPROVAL | checklist approval; installed-server capability probe |

After approval of `docs/prompts/3.3.0-implementation-checklist.md`, C and D become
`READY` in this order. Finish A and B's live gates before new high-risk backend work
unless the user explicitly changes the release order.

| Order | ID | Idea | Class/risk | Initial status | Dependency |
|---:|---|---|---|---|---|
| 1 | LIST-01 | Complete paginated service lists with stable actions | L / HIGH | READY | none |
| 2 | DISC-01 | Multi-disc album sections | M / MEDIUM | READY after LIST-01 | LIST-01 publish-ready |
| 3 | PL-01 | Playlist duplicate removal and direct manipulation | L / HIGH | READY after DISC-01 | DISC-01 publish-ready |
| 4 | GROUP-01 | Group and synchronised-player volume control | L / HIGH | WAITING | 3.3 R4 landed and accepted |
| 5 | LIB-01 | Missing library roots and classical navigation | L / HIGH | WAITING | GROUP-01 publish-ready |
| 6 | SEARCH-01 | Advanced multi-field library search | L / HIGH | WAITING | LIB-01 publish-ready |
| 7 | MODE-01 | Party and kiosk modes | L / HIGH | WAITING | 3.3 R3/R4 landed; SEARCH-01 publish-ready |
| 8 | PUSH-01 | Push-assisted player and queue updates | L / HIGH | WAITING | MODE-01 publish-ready |
| 9 | HOME-01 | Configurable home shortcuts and pins | L / MEDIUM | WAITING | PUSH-01 publish-ready |
| 10 | INFO-01 | Rich artist/album information integration | L / HIGH | WAITING | 3.3 R2 landed; HOME-01 publish-ready |

The strict order limits simultaneous persisted-state and navigation changes. The user
may explicitly reprioritise, but the task-loop must then record the dependency and
release-risk consequences.

## 5. Idea specifications

### LIST-01 — Complete paginated service lists with stable actions

**Problem.** Echo Classic currently reports that an OPML list above 200 items is
truncated and tells the user to search. Material users separately reported that lists
above 100 items can replace the context action with a navigation-oriented “More” button.
Users need the complete list and the same row action at every page size.

**Value.** Large TIDAL, Qobuz, Bandcamp, Radio and other plugin lists remain usable
without switching skin, changing view or knowing an item name in advance.

**Seed ACs.** Stage 1 must verify and refine these:

- `AC-LIST-01`: Given an OPML list longer than one server page, when its first page is
  shown, then a reachable control loads the next page without replacing existing rows.
- `AC-LIST-02`: Given 201 or more items, when all available pages are loaded, then every
  server-reported item is reachable and no static 200-item ceiling remains.
- `AC-LIST-03`: Given a playable or actionable item on any loaded page, when its action
  control is used, then the same Echo Classic action sheet opens; pagination never
  changes that control into browse navigation.
- `AC-LIST-04`: Given a server page returns duplicate boundary items, no progress, a
  malformed item or an error, then the UI neither duplicates rows nor loops forever and
  offers a friendly retry where recovery is possible.
- `AC-LIST-05`: Given a service supplies search, when search is used after multiple pages
  were loaded and then closed, then the prior list and scroll position are restored.
- `AC-LIST-06`: Given keyboard-only use and a narrow mobile viewport, loading another
  page preserves sensible focus and announces the result count/change.
- `AC-LIST-07`: Existing lists of 200 items or fewer, Radio playback, Apps navigation,
  favourites and action sheets retain their current behaviour.

**Likely entry points, not an implementation mandate:** `opmlview.js`, `api.js`,
`nav.js`, `tests/opmlview.test.js`, `tests/api.test.js`, `strings.txt`, `ios9.css`.

**Mockup states:** 100-item page, 101st item loaded, 200+, loading next page, end of
list, retryable error, no-progress response, mobile focus state, long Portuguese labels,
Light/Dark/Legacy.

**Out of scope:** universal grid view, service-specific APIs, native wrappers, caching
an entire remote catalogue offline.

### DISC-01 — Multi-disc album sections

**Problem.** Long multi-disc albums read as one undifferentiated track list even though
Echo already receives disc metadata.

**Seed ACs:**

- `AC-DISC-01`: A multi-disc album renders a labelled section for each disc in numeric
  order without changing track playback order.
- `AC-DISC-02`: A single-disc album gains no redundant heading.
- `AC-DISC-03`: Missing, zero, malformed and mixed disc metadata falls into a visible,
  deterministic section without hiding tracks.
- `AC-DISC-04`: Section headings remain correct after search entry/return, album queue
  reconstruction and narrow-screen layout.
- `AC-DISC-05`: Disc labels, counts and accessible structure translate as whole phrases.

**Likely entry points:** `detail.js`, `api.js`, `tests/browse.test.js`, `strings.txt`,
`ios9.css`.

**Out of scope:** changing LMS tags, merging editions, classical Works navigation.

### PL-01 — Playlist duplicate removal and direct manipulation

**Problem.** Echo supports create, rename, delete, select/remove and arrow reordering,
but lacks one-step duplicate removal and efficient direct movement in long playlists.

**Seed ACs:**

- `AC-PL-01`: Given a playlist with duplicate track identities, Remove duplicates shows
  the removal count and requires confirmation before changing LMS.
- `AC-PL-02`: Duplicate detection follows LMS/Material semantics established from
  source; URL-only streams and same-title/different-track entries are not guessed.
- `AC-PL-03`: The operation preserves the first occurrence, order and current playback
  where LMS permits it, and reports partial failure without claiming success.
- `AC-PL-04`: A pointer user can move a playlist item directly; a keyboard user has an
  equivalent command path and receives position feedback.
- `AC-PL-05`: Pagination does not allow an operation to silently affect only the loaded
  window when the command promises the whole playlist.
- `AC-PL-06`: Existing arrow movement, selection, deletion, playback and Add to playlist
  remain available.

**Required Stage 1 investigation:** determine whether LMS has an authoritative duplicate
command and stable playlist-track identity. Do not implement client-side guessing until
that contract is known.

**Out of scope:** collaborative playlists, undo across server restart, editing remote
provider playlists that LMS exposes read-only.

### GROUP-01 — Group and synchronised-player volume control

**Problem.** Users frequently alternate between group volume and individual member
volume. Echo can control and sync players but does not expose a group mixer or honour
all fixed/“Do Not Set Volume” states.

**Seed ACs:**

- `AC-GROUP-01`: A synchronised/group player surface identifies every member and exposes
  group volume plus individual volume only where LMS says it is commandable.
- `AC-GROUP-02`: Fixed-volume members show their actual mode and never receive an
  enabled software-volume control.
- `AC-GROUP-03`: A Group Players group configured “Do Not Set Volume” does not expose a
  misleading group slider; the reason is stated.
- `AC-GROUP-04`: A player change during a volume write cannot apply confirmation or
  optimistic state to the newly selected player.
- `AC-GROUP-05`: Rapid member-volume changes are ordered/coalesced so late responses do
  not visually roll the control backward.
- `AC-GROUP-06`: Plugin absent, disabled, disconnected and transient-error states follow
  the dependency policy and preserve core LMS sync controls.

**Required prerequisite:** settled 3.3 sync/group discovery contract. If LMS does not
report “Do Not Set Volume,” create an investigation AC; do not infer it from volume 100.

**Out of scope:** speaker calibration, automatic loudness matching, creating Group
Players groups unless the prerequisite explicitly settled that contract.

### LIB-01 — Missing library roots and classical navigation

**Problem.** Echo's primary library roots do not yet cover Album Artists, Composers,
Conductors, Music Folder, Works, virtual libraries and release types.

**Seed ACs:**

- `AC-LIB-01`: Available LMS library roots are discovered from supported server
  contracts and presented without inventing empty categories.
- `AC-LIB-02`: Album Artists, Composers and Conductors drill into deterministic releases
  and tracks with normal Echo actions.
- `AC-LIB-03`: Music Folder navigation preserves hierarchy, back/forward history and
  playable-file actions.
- `AC-LIB-04`: Works/classical navigation distinguishes work, composer, conductor,
  release and track without flattening multi-disc structure.
- `AC-LIB-05`: Virtual-library selection is explicit, persists only if approved in the
  mockup, and never leaks results from another library after a late response.
- `AC-LIB-06`: Missing LMS version support produces an honest degraded state, not an
  empty library.

**Required split decision at Stage 1:** if this cannot remain one coherent navigation
contract within the task-loop corrective budget, split it into `LIB-ROOTS`, `LIB-FOLDER`
and `LIB-CLASSICAL`, execute in that order, and update this program before coding.

### SEARCH-01 — Advanced multi-field library search

**Problem.** Echo's global term search cannot express combinations such as composer +
work + year + format/release type.

**Seed ACs:**

- `AC-SEARCH-01`: Users can combine only fields supported by the detected LMS version.
- `AC-SEARCH-02`: Criteria, results, loaded pages and scroll position survive a result
  drill-in and contextual/browser Back.
- `AC-SEARCH-03`: Empty, unsupported, malformed and rejected searches explain the next
  action without exposing RPC syntax.
- `AC-SEARCH-04`: Concurrent searches cannot let an older response replace newer
  criteria or results.
- `AC-SEARCH-05`: The simple global search remains the default fast path.

**Out of scope:** online-service-specific advanced query languages and a general query
builder.

### MODE-01 — Party and kiosk modes

**Problem.** Shared touchscreens need a constrained control surface. Material users also
reported controls that remain visually enabled even though party mode rejects them.

**Seed ACs:**

- `AC-MODE-01`: Party mode exposes only the approved actions and every forbidden action
  is both disabled/absent visually and blocked at the command boundary.
- `AC-MODE-02`: Kiosk mode hides configuration/escape affordances selected in the
  approved contract without trapping an administrator permanently.
- `AC-MODE-03`: Direct URLs, keyboard shortcuts, stale dialogs and browser history cannot
  bypass the mode's command restrictions.
- `AC-MODE-04`: Player loss, reconnect and a changed sync group recompute permissions.
- `AC-MODE-05`: Mode activation and recovery are documented per device and do not alter
  global LMS permissions.

**Security boundary:** this is accidental-action resistance, not authentication. The UI
must never claim it prevents a determined user from calling LMS directly.

### PUSH-01 — Push-assisted player and queue updates

**Problem.** One-second polling adds server work and can display stale playback, queue
and sync state. Material documents CometD update support.

**Seed ACs:**

- `AC-PUSH-01`: When LMS push is available, player and queue changes update without
  waiting for the normal polling interval.
- `AC-PUSH-02`: Connection loss falls back to bounded polling and reconnects without
  duplicate subscriptions or timers.
- `AC-PUSH-03`: Out-of-order push and poll responses cannot roll state backward or write
  another player's state.
- `AC-PUSH-04`: Unsupported LMS versions retain current polling behaviour.
- `AC-PUSH-05`: Page hide/show and teardown leave no active duplicate transport.

**Required interaction contract:** transport state machine, event ownership, fallback,
ordering and teardown. A visual mockup alone is insufficient.

### HOME-01 — Configurable home shortcuts and pins

**Problem.** Users praise fast home access to frequent tasks, while per-device Material
configuration can also make Apps/Radio appear missing. Echo needs discoverable shortcuts
without hiding its stable primary tabs.

**Seed ACs:**

- `AC-HOME-01`: A user can pin a supported library, app, radio, favourite or playlist
  destination from its existing context surface.
- `AC-HOME-02`: A stale or unavailable pin remains identifiable and removable; it does
  not become a blank tile.
- `AC-HOME-03`: Primary Apps, Radio and other navigation remain reachable regardless of
  shortcut configuration.
- `AC-HOME-04`: Pins are explicitly per browser/device unless the approved mockup and
  server contract choose otherwise.
- `AC-HOME-05`: Import/export and upgrade validation handle the new persisted shape.

### INFO-01 — Rich artist/album information integration

**Problem.** Echo exposes core tags and lyrics but not the biography/review/information
depth available through Music and Artist Information integrations.

**Seed ACs:**

- `AC-INFO-01`: When the supported information plugin is available, artist and album
  actions expose only information actually returned.
- `AC-INFO-02`: Biography, review and source attribution render in the established
  reading surface with safe links and predictable Back/focus restoration.
- `AC-INFO-03`: Plugin absent/disabled/transient failure follows the dependency policy
  and never removes core Song information or lyrics.
- `AC-INFO-04`: Long text, missing artwork, HTML-like input and unsupported links do not
  break layout or execute untrusted markup.
- `AC-INFO-05`: Late information responses cannot replace the newly selected item.

## 6. Deferred or rejected as separate product surfaces

These research findings do not enter the ordered web-skin program without a new user
decision:

- **Native multi-server/Tailscale profiles:** requires a native wrapper or connection
  manager. Echo Classic is currently a server-hosted web skin.
- **LMS user identities and per-user provider accounts:** requires an agreed LMS/plugin
  request contract; do not invent a skin-only `user_id` convention.
- **Raspberry Pi temperature:** requires a portable authoritative server/plugin source.
  Do not scrape platform files or show it as generic LMS health.
- **Universal list/grid toggle:** plugin items do not consistently supply useful images.
  Reconsider only with an approved generated-icon/fallback design.
- **Full SqueezeDSP equalizer:** remains governed by the SqueezeDSP recon and 3.3 R6
  limitation; absent-branch UI is not authorization to build the editor.
- **Native auto-return to Now Playing:** may become a small independent idea after party
  and kiosk modes settle inactivity semantics.

## 7. Cross-program invariants

Every loop carries these regression criteria in addition to its idea-specific ACs:

1. JSON-RPC wire format remains owned by `api.js`; production JavaScript remains ES5.
2. A player/request token guards every async path that can write shared player state.
3. No complete server operation is silently restricted to the currently loaded window.
4. Core actions retain one semantic control; “More” never ambiguously means both load
   another page and open item actions.
5. Source UI text is English, whole phrases reach `strings.txt`, and EN/PT are checked.
6. Keyboard, focus restoration, names, 44px targets and Light/Dark/Legacy are explicit.
7. Raw RPC verbs, parameters, stack traces and protocol errors never reach users.
8. Optional integrations stay visible in a useful degraded state and are never silently
   installed or enabled.
9. Old localStorage/preferences either migrate deterministically or fall back safely.
10. Existing worktree changes are inventoried and excluded from current-task claims.

## 8. Per-idea completion record

When a loop reaches a terminal state, update only the corresponding row below. Use real
hashes and evidence; never placeholders.

| Idea | State | Brief/mockup | Landed hashes | Live acceptance | Release |
|---|---|---|---|---|---|
| LIST-01 | NOT STARTED | — | — | — | — |
| DISC-01 | NOT STARTED | — | — | — | — |
| PL-01 | NOT STARTED | — | — | — | — |
| GROUP-01 | NOT STARTED | — | — | — | — |
| LIB-01 | NOT STARTED | — | — | — | — |
| SEARCH-01 | NOT STARTED | — | — | — | — |
| MODE-01 | NOT STARTED | — | — | — | — |
| PUSH-01 | NOT STARTED | — | — | — | — |
| HOME-01 | NOT STARTED | — | — | — | — |
| INFO-01 | NOT STARTED | — | — | — | — |

## 9. First next action

Execute Stage 1 for `LIST-01` only. Verify the current OPML pagination contract and the
200-item ceiling, inventory the existing dirty worktree, create
`docs/prompts/complete-service-lists-brief.md`, update `.loop-state.md`, and stop at the
task-loop decision required by the resulting scope. Do not create production code during
Stage 1.
