# Echo Classic

An iOS 9 iPad Music skin for [Lyrion Music Server](https://lyrion.org) (formerly Logitech Media Server).

Echo Classic shows the **native sample rate and bit depth of what actually reaches the DAC**, which is the reason it exists: on a hi‑fi setup you want to know at a glance whether the 24/96 file you paid for is being served untouched or quietly resampled.

- Vue 2, no build step — the skin is plain files the server serves directly
- Light and dark themes, five accent schemes, three type choices
- English and Portuguese, switchable in the skin's own settings
- Split view on wide screens, single column on phones
- WCAG 2.1 AA contrast, visible keyboard focus, no motion when the system asks for none

## Screenshots

Taken against a real server (Lyrion Music Server 9.1.1, 1,400 albums), not mockups.
`node tools/screenshots.js` regenerates them.

![Library](docs/img/library.png)

*Recently added, split view. The album header states what actually reaches the DAC:
codec, bitrate range, sample rate, bit depth and where the file comes from.*

| | |
|---|---|
| ![Filter panel](docs/img/filters.png) | ![Sections and active filters](docs/img/sections.png) |
| **Filters, sorting, grouping and playback preference** live in one panel that works as a draft: nothing is applied until you press Apply. | **Filters combine, and each one is a removable pill.** Grouping adds section headers with counts and never removes a row from the list. |
| ![Dark theme](docs/img/dark.png) | ![Settings](docs/img/settings.png) |
| **Dark theme**, with the hi‑res badge on every track above CD quality. | **Settings**: themes, accents, type, crossfade, sleep timer, and a volume row that says when the DAC is doing the attenuation. |

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
docs/                   notes on getting listed in the official repository
tools/                  validation and local install scripts
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
```

It checks JavaScript syntax on every file, compiles all Vue templates, verifies that
no cross‑module reference is orphaned, and recomputes every WCAG contrast pair from
the CSS tokens. All four must pass.

## Status

Current version: **3.2.5**.

Filtering, sorting, grouping and playback preference are four separate states,
reachable from one adaptive panel. Filters combine, grouping adds section headers
without dropping rows, and the media index survives a page reload.

The interface is written in English; other languages come from `strings.txt`,
keyed by the English phrase. Pick one under *Settings → Language*. The LMS
session language is the initial guess, and the choice you make there outranks
it — so a server running in one language can still show the skin in another.

See [CHANGELOG.md](CHANGELOG.md) for what was verified on a real server, what was
only read in the code, and what is still untested.

## Author

Felipe Freitas.

## Licence

GPL‑3.0‑or‑later. See [LICENSE](LICENSE).

Vue is bundled under `html/lib/` and carries its own MIT licence.
