# Echo Classic

An iOS 9 iPad Music skin for [Lyrion Music Server](https://lyrion.org) (formerly Logitech Media Server).

Echo Classic shows the **native sample rate and bit depth of what actually reaches the DAC**, which is the reason it exists: on a hi‑fi setup you want to know at a glance whether the 24/96 file you paid for is being served untouched or quietly resampled.

- Vue 2, no build step — the skin is plain files the server serves directly
- **Three themes**: Light, Dark and **Legacy**, an iOS 6-style treatment with bevels, grouped tables and engraved text
- **Seven accent schemes** — System Blue, Atlantic Teal, Editorial Crimson, Studio Indigo, Hi-Fi Amber, Silver, Black
- Five type choices; each of the three player surfaces can follow the app or carry its own theme, accent and font
- English and Portuguese, switchable in the skin's own settings — the source language is English and translations live in `strings.txt`
- Split view on wide screens, single column on phones; the full player can open adaptively in a side panel or over the app
- Favourites, Radio, Apps, Playlists and a global search that keeps your results when you open one of them
- Server settings, including plugin management, skinned inside the interface instead of dropping you on a bare LMS page
- WCAG 2.1 AA contrast on all 155 pairs, visible keyboard focus, 44px touch targets, no motion when the system asks for none

## Screenshots

Taken against a real server (Lyrion Music Server 9.1.1, 1,400 albums), not mockups.
`node tools/screenshots.js` regenerates them from the deployed skin.

> **These images were captured at 3.2.5.** The library, filter and mobile views below
> are still representative. What they do **not** show is everything added since:
> the Legacy theme, the Silver and Black accents, the rebuilt Settings screen, the
> simplified Player layout and the skinned server-settings pages. Fresh captures are
> pending a deploy of 3.2.9 — see [Status](#status).

![Library](docs/img/library.png)

*Recently added, split view. The album header states what actually reaches the DAC:
codec, bitrate range, sample rate, bit depth and where the file comes from.*

| | |
|---|---|
| ![Filter panel](docs/img/filters.png) | ![Sections and active filters](docs/img/sections.png) |
| **Filters, sorting, grouping and playback preference** live in one panel that works as a draft: nothing is applied until you press Apply. | **Filters combine, and each one is a removable pill.** Grouping adds section headers with counts and never removes a row from the list. |

![Dark theme](docs/img/dark.png)

*Dark theme, with the hi‑res badge on every track above CD quality. Legacy, the third
theme, has no capture yet.*

<img src="docs/img/mobile.png" alt="Filter sheet on a phone" width="320">

*On narrow screens the same panel becomes a full‑screen single‑column sheet, with the
primary actions pinned to the bottom.*

## Requirements

Lyrion Music Server 8.0 or later. Developed and verified against 9.1.1 on macOS.

## Install

Copy the `EchoClassic` folder into the server's per‑user plugin directory and restart the server.

| Platform | Plugin directory |
|---|---|
| macOS | `~/Library/Application Support/Squeezebox/Plugins` |
| Linux | `/var/lib/squeezeboxserver/Plugins` |
| Windows | `%APPDATA%\Squeezebox\Plugins` |

There is a helper for a local checkout:

```sh
tools/install-local.sh            # copies to the macOS path above
tools/install-local.sh /some/path # or to a directory you choose
```

Then open `http://<server>:9000/echoclassic/`, or pick **Echo Classic** in
*Server Settings → Interface* to make it the default skin.

The retired `/mojo` alias is intentionally not registered; it returns 404.

## Repository layout

```
EchoClassic/            the plugin, exactly as it is installed
  HTML/echoclassic/     the skin itself (index.html + html/js, html/css, html/lib)
  HTML/EN/plugins/...   the server-side settings page
  Plugin.pm             page registration, asset revision, player hint
  Settings.pm           server-side preferences
docs/                   notes on getting listed in the official repository,
                        screenshots and the working briefs under docs/prompts/
tests/                  the node --test suite
tools/                  validation, screenshots, deploy and release scripts
```

`Plugin.pm` stamps every asset URL with the newest mtime under `HTML/echoclassic`.
That is deliberate: the server sends skin assets with `Cache-Control: max-age=604800`,
so without a revision a reinstall leaves the browser running last week's JavaScript
next to this week's CSS.

## Development

There is no build step. Edit the files, restart nothing, reload the page.

Before committing, run:

```sh
npm ci
npm test
npm run validate
npm run check-version
node tools/check-source-language.js
```

`validate` checks JavaScript syntax on every file, compiles all Vue templates, verifies
that no cross‑module reference is orphaned, and recomputes every WCAG contrast pair from
the CSS tokens across Light, Dark and Legacy. All four must pass.
`check-source-language.js` fails if any Portuguese interface text has been left outside
`strings.txt`, where no dictionary could ever reach it.

Releases go through `tools/release.sh X.Y.Z`, which bumps the three manifests, asserts
the publication invariants, packages the zip, diffs it against the tree that produced it
and writes its SHA‑1 into `repo.xml`. Run it with `-n` first.

## What it does

**Library.** Filtering, sorting, grouping and playback preference are four separate
states, reachable from one adaptive panel. Filters combine and each is a removable
pill; grouping adds section headers without dropping rows; the media index survives a
page reload. Albums, artists, genres, years and a Recent root, with a cover grid or a
track list.

**The players.** Three surfaces — the full player, the adaptive side panel and the
bottom bar — each of which can follow the app's appearance or carry its own theme,
accent and font. *Settings → Player layout* chooses how the player opens (adaptive or
full screen) and, when adaptive, which side the panel takes; appearance customization
sits behind one disclosure so the basic choice stays one short screen.

**Beyond the library.** Favourites, Radio and Apps browse the server's own menus, with
in-service search. Playlists are editable. Global search covers artists, albums, tracks
and playlists, and keeps your query, results and scroll position when you open a result
and come back.

**Server settings.** The LMS settings pages are skinned inside the interface rather
than handing you a bare server page, including a plugin manager with status filters and
counts. The server's own form stays authoritative — Echo Classic only dresses it.

**Language.** The interface is written in English; other languages come from
`strings.txt`, keyed by the English phrase. Portuguese ships today. Pick one under
*Settings → Language*. The LMS session language is the initial guess, and the choice you
make there outranks it — so a server running in one language can still show the skin in
another.

## Status

Current version: **3.2.9**.

Gates on this release: 335 tests, 4/4 validation gates, 155/155 WCAG contrast pairs.

Two things this README should not oversell:

- **Podium Sans and Espy Sans fall back** to Geneva/Verdana. The typefaces are offered
  in Settings, but the `.woff2` files are not bundled — that waits on a licence
  decision. Chicago renders only where the system provides it.
- **3.2.9 has not been through a visual walkthrough on a server.** Its changes are
  covered by tests and read in the source; the CHANGELOG marks each one `[code]` or
  `[measured]`, and none claims `[live]`. Screenshots will be re-captured, and this
  note removed, once that walkthrough happens.

See [CHANGELOG.md](CHANGELOG.md) for what was verified on a real server, what was
only read in the code, and what is still untested.

## Author

Felipe Freitas.

## Licence

GPL‑3.0‑or‑later. See [LICENSE](LICENSE).

Vue is bundled under `html/lib/` and carries its own MIT licence.
