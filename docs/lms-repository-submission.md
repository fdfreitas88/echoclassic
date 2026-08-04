# Getting listed in the official LMS plugin repository

What the project needs, what it already has, and what is still missing. Every
statement below was read in the aggregator's own source or in plugins that are
already listed — none of it is from memory.

## How inclusion works

You do not submit the plugin. You submit **the URL of your `repo.xml`**. A robot
runs every few hours, collects every listed `repo.xml` and merges them into the
single `extensions.xml` that every LMS reads by default.

| | |
|---|---|
| Repository | `LMS-Community/lms-plugin-repository` |
| File to edit | `include.json`, in the `repositories` array |
| What to add | `https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/repo.xml` |
| How | pull request |
| What builds the result | `buildrepo.pl`, via GitHub Actions |

`include.json` also has a `disabled` array, where entries go when they stop
answering — worth knowing that dropping off the list happens silently.

## What the aggregator does with our `repo.xml`

Read in `buildrepo.pl`:

- **The category is validated against a closed list**: `radio`, `information`,
  `musicservices`, `tools`, `scanning`, `hardware`, `playlists`, `skin`, `misc`.
  Anything else is **deleted** silently and the plugin falls back to `misc`.
  Ours is `skin`, which is on the list.
- **A developer-declared `installations` count is discarded** and replaced with
  the community API's statistic. Declaring it is pointless.
- **Links to `wiki.slimdevices.com` and `forums.slimdevices.com`** are rewritten
  to their `lyrion.org` equivalents.
- `desc` and `title` without a `lang` attribute are converted to the tagged
  form. Ours already ship with `lang`, in EN and PT.

And in the server's own `ExtensionsManager`, which is what installs:

- it requires `name`, `url` and `version`; everything else is optional, with
  `name` standing in for a missing `title`;
- **applicability comes from the `minTarget`/`maxTarget` pair in `repo.xml`**,
  not from `<targetApplication>` in `install.xml` — the official plugins do not
  even agree with each other there (`SqueezeCenter` in Qobuz, `SlimServer` in
  Material Skin, `Logitech Media Server` in ours);
- the download is validated against `<sha>`. A mismatching SHA is the usual
  cause of "downloads and then refuses".

## Checklist

| Requirement | State |
|---|---|
| Public repository, `repo.xml` at a stable raw URL | **ok** |
| Valid `repo.xml`, `<extensions>` root | **ok** |
| `name`, `version`, `minTarget`, `maxTarget` | **ok** — 3.2.1, 8.0, `*` |
| `<url>` pointing at a release asset | **ok** |
| `<sha>` matching the published file | **ok** — verified by re-downloading the asset |
| `<category>` from the closed list | **ok** — `skin` |
| `<title>` and `<desc>` with `lang` | **ok** — EN and PT |
| `<creator>`, `<email>`, `<link>` | **ok** |
| `<icon>` | **added in this pass** |
| `install.xml` with `id`, `name`, `module`, `version`, `description`, `creator`, `defaultState`, `type`, `targetApplication` | **ok** |
| `install.xml` with `email`, `category`, `icon`, `optionsURL`, `homepageURL` | **added in this pass** |
| No `<enforce>` in `install.xml` | **ok** — a release gate fails the build if it comes back |
| Zip with the plugin folder at the root | **ok** — compared against the tag |
| Own licence | **ok** — GPL-3.0-or-later |
| Third-party dependency declared | **ok** — Vue 2 under MIT, header preserved, credited in the README |
| End-to-end install through the extension manager | **ok** — the real server downloaded the published zip from GitHub, checked the SHA and installed it by itself |
| Screenshots in the README | **ok** — six, taken against the real server |

## Still to do before opening the pull request

1. **Publish 3.2.2.** The icon and the new `install.xml` fields change the
   contents of the package, so the `<sha>` published for 3.2.1 no longer
   describes it. Submitting a `repo.xml` whose URL and SHA disagree is exactly
   the failure the aggregator does not catch and the end user does.
2. **Decide the `targetApplication` id.** Ours says `Logitech Media Server`.
   Since `ExtensionsManager` never looks at that field, and the plugin installs
   and runs on 9.1.1, there is no measured reason to change it — recorded here
   only because the official plugins disagree on it.

## The pull request, when the time comes

```sh
gh repo fork LMS-Community/lms-plugin-repository --clone
# add to the "repositories" array in include.json:
#   "https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/repo.xml"
gh pr create --repo LMS-Community/lms-plugin-repository \
  --title "Add Echo Classic skin repository" \
  --body "Echo Classic is a GPL-3.0 iOS 9 iPad Music skin for LMS 8.0+. \
Repository: https://github.com/fdfreitas88/echoclassic"
```

Once merged, the entry shows up in `extensions.xml` on the robot's next pass and
the plugin is offered without the user having to add any repository by hand.
