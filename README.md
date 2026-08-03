# Echo Classic

An iOS 9 iPad Music skin for [Lyrion Music Server](https://lyrion.org) (formerly Logitech Media Server).

Echo Classic shows the **native sample rate and bit depth of what actually reaches the DAC**, which is the reason it exists: on a hi‑fi setup you want to know at a glance whether the 24/96 file you paid for is being served untouched or quietly resampled.

- Vue 2, no build step — the skin is plain files the server serves directly
- Light and dark themes, five accent schemes, three type choices
- Split view on wide screens, single column on phones
- WCAG 2.1 AA contrast, visible keyboard focus, no motion when the system asks for none

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
docs/                   UX audit and remediation plan (Portuguese)
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

Version 3.1.0 completes the publication pass: English and Portuguese interface
strings, browser-history-backed drill navigation, disambiguated search results,
actionable empty states, and automated behavior and release validation. See
[CHANGELOG.md](CHANGELOG.md) for verification details and remaining test scope.

## Licence

GPL‑3.0‑or‑later. See [LICENSE](LICENSE).

Vue is bundled under `html/lib/` and carries its own MIT licence.
