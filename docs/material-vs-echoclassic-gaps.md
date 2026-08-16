# Material Skin vs Echo Classic — functional gap sheet (v2)

Scope: functions only. Echo Classic's graphic design and experience are frozen —
every item here is about capability, and any placement must follow the skin's
principles (context menus, secondary panels, Settings; never main-screen
clutter).

Evidence: Material side from its README, wiki and ChangeLog (linked at the end).
Echo Classic side from the repo at 3.2.5 and this project's audits.
[reported] = widely documented but not verified in Material's source this pass.

Status legend:
- **NEW** — gap not yet on any Echo Classic backlog
- **AUDIT-xx** — already covered by the community-audit prompt items 01–12
- **Partial** — Echo Classic has a limited form
- **OK** — no gap

## A. Design continuity across LMS-served pages  ← added this pass

| Material capability | Echo Classic today | Status |
|---|---|---|
| Embedded classic pages inherit the skin's theme: Material copies its CSS variables into the iframe when the page is LMS-served (v5.8.0), so server settings render in Material's colors | Advanced LMS settings iframe keeps Echo Classic chrome but content arrives in Default-skin style — the style/language jump was flagged in the 3.0.1 audit (P3-E) | **NEW — the ask** |
| Player-level settings re-implemented natively (crossfade, replay gain, DSTM, alarms live in Material's own UI; only true server pages get iframed) | Crossfade/sleep native; alarms, replay gain, DSTM have no native UI (see C) | Partial — the native pieces are items in C |
| Choice of embedding vs opening server settings in a new tab (server-side option) | Embed only | NEW, minor |
| Extras/plugin-provided pages open inside the skin with consistent chrome | Apps tab covers OPML menus; web-page-type plugin items not handled | AUDIT-07/08 |

Feasible mechanism for Echo Classic, mirroring Material's: same-origin iframe →
on load, inject the skin's CSS custom properties (theme, accent, font tokens
from ios9.css) into the embedded document, falling back to untouched content
when the page is not LMS-served. Native re-implementation reserved for the
player-level settings that are already planned features.

## B. Library & browsing

| Material | Echo Classic | Status |
|---|---|---|
| Composers, Album Artists, conductors and other contributor roles | Not browsable; api.js has no call | AUDIT-04 |
| Music Folder | Absent | AUDIT-04 |
| Works / classical groupings | Absent | AUDIT-04/05 |
| Release types | Absent | AUDIT-05 |
| Virtual libraries / library views | Absent | AUDIT-06 |
| Random album/mix by artist, genre, year | Absent | AUDIT-02 |
| Advanced search (multi-term, incl. Work) | Single search box, local DB only | NEW, minor — online-service search itself is the known bug A |
| Pin items/apps to a home position | Absent | NEW [reported] |

## C. Playback intelligence

| Material | Echo Classic | Status |
|---|---|---|
| Don't Stop The Music (status, on/off, provider) | Absent | AUDIT-03 |
| **Alarms — per-player alarm clock CRUD, repeat, volume** | Absent entirely | **NEW — biggest single gap** |
| Replay gain per player | Absent | **NEW** |
| Crossfade | Native toggle+duration (redesign approved) | OK |
| Sleep timer | Native chips | OK |

## D. Multi-player

| Material | Echo Classic | Status |
|---|---|---|
| Player selector in main UI | Settings-only | AUDIT-11 |
| **Sync/unsync players (sync dialog)** | Absent — only queue handoff | **NEW** |
| Group Players plugin: create/edit/delete groups; group↔member queue moves | Absent | **NEW** |
| Group/linked volume | Absent | **NEW** |

## E. Playlists & queue

| Material | Echo Classic | Status |
|---|---|---|
| **Playlist CRUD: create, rename, delete, edit, remove duplicates, add track/album to playlist** | Browse and play only | **NEW** |
| Queue drag-and-drop | Arrow buttons | AUDIT-10 |
| Queue transfer between players | handoffTo | OK |

## F. Context & metadata

| Material | Echo Classic | Status |
|---|---|---|
| "Music and Artist Information" plugin: bio, review, lyrics in context | Absent | **NEW** |
| Plugin actions in track/album/artist context menus | OPML Apps tab only | AUDIT-08 |
| Download tracks to the device | Absent | NEW, minor |

## G. Modes, deployment & extensibility

| Material | Echo Classic | Status |
|---|---|---|
| Kiosk mode; Party mode | Absent | NEW |
| URL query parameters to configure the UI per device | Absent | NEW |
| Custom actions — user-defined menu commands, per-service | Absent | NEW |
| User hooks: custom.css / custom.js / custom themes-colors-backdrops; hideSettings; window title | Absent (design frozen, but hooks are extensibility, not redesign) | NEW, optional |
| In-UI server notifications | Absent | NEW [reported] |
| Native app wrappers / Android webapp guidance | PWA-ish only | NEW, low value |
| Library rescan + progress natively | Via Advanced-settings iframe only | Partial |
| Real-time push updates (vs polling) | Echo polls | NEW [Inference — confirm Material's transport and Echo's lag in audit] |

## Not gaps (design frozen or already equal)

18 colour schemes vs 5 · Material theming engine · lock-screen Media Session ·
favourites · mobile layout · swipe gestures (a design choice, not a capability).

## Ready-to-paste extension for the community-audit prompt

```
AUDIT-13 Themed LMS pages. Embedded server-settings (and any LMS-served page
  opened inside the skin) inherit Echo Classic's theme, accent and font by
  CSS-variable injection into the same-origin iframe; unthemeable pages get a
  neutral fallback + a caption naming the source. Native re-implementation only
  where an item is already a feature (alarms, replay gain, DSTM).
AUDIT-14 Alarms. Per-player alarm CRUD (time, days, playlist/source, volume,
  repeat), surfaced from the player context, not main nav.
AUDIT-15 Replay gain. Read/set per player, in player settings.
AUDIT-16 Player sync and groups. Sync/unsync dialog; Group Players plugin
  CRUD when installed; group volume behaviour defined.
AUDIT-17 Playlist management. Create, rename, delete, edit contents, remove
  duplicates, add track/album/queue to playlist — via context menus.
AUDIT-18 Artist/album/track information. Integrate the Music and Artist
  Information plugin when present: bio, review, lyrics from context menus.
AUDIT-19 Update transport. Establish whether LMS push (CometD) is feasible
  for the skin vs current polling; measure the visible lag either way.
AUDIT-20 Equalizer. Per-player parametric EQ through SqueezeDSP's
  `squeezedsp.*` commands when the plugin is present — free-form bands with no
  fixed frequency grid, five filter types, cut-only preamp, presets and WAV
  convolution; when it is absent, one line stating the requirement with an
  Install… action and no other EQ surface. Constraints to design around: every
  change rewrites the whole settings blob, applying one re-seeks the stream,
  and none of the state reaches `serverstatus`.
```

AUDIT-20's constraints were read from the SqueezeDSP sources, never from a
running plugin — `docs/prompts/audit-20-recon.md`. [code] The plugin is not
installed on the server, so both the present and the absent branch of its UI
have to be built against source until someone installs it. [measured]

## Sources

- https://github.com/CDrummond/lms-material
- https://raw.githubusercontent.com/CDrummond/lms-material/master/README.md
- https://github.com/CDrummond/lms-material/wiki (incl. 07-Customisation)
- https://github.com/CDrummond/lms-material/blob/master/ChangeLog
