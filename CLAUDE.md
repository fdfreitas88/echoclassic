# Echo Classic — project brief

Vue 2 skin for Lyrion Music Server, shipped as an LMS plugin. **No build step**:
the files under `EchoClassic/HTML/echoclassic/html/` are exactly what the browser
runs. Current version is in `EchoClassic/install.xml`.

## Conventions

- ES5 only: `var`, `function`. No arrow functions, no `const`/`let`, no template
  literals outside Vue `template:` strings. Match the surrounding style.
- Every module attaches to `window` under an `Lms*` name. Vue 2 is a global.
- `api.js` is the only module that knows the JSON-RPC wire format.
- Never edit `html/lib/vue.min.js` — vendored Vue 2.7.15, verified byte for byte.
- Commits: Conventional Commits, scope = the file that changed (`api`, `store`,
  `ui`, `nav`, `browse`, `queue`, `player`, `settings`, `opml`, `css`, `docs`).
- Full text in `CONTRIBUTING.md`. Read it before your first change, not every time.

## Language

- **Source language is English.** `strings.txt` is keyed by the *English* phrase;
  Portuguese is a translation entry beside it.
- `i18n.js` rewrites component templates at registration and reaches **text nodes
  only**. A label returned from JavaScript, or assembled by concatenation, can
  never match a key — it needs a `strings.txt` entry and often an explicit `tr()`.
- This failure class consumed releases 3.2.2 and 3.2.5. Treat any new user-visible
  string as a language change, not a UI change.

## Commands

```
npm test                 # node --test, tests/*.test.js
npm run validate         # 4 gates: JS syntax, Vue templates, cross-module refs, WCAG contrast
npm run check-version    # install.xml / Plugin.pm / repo.xml declare the same version
```

Not wired into any gate — run by hand:
`node tools/check-source-language.js` and `node tools/check-ui-language.js`.
The second one has hardcoded absolute paths and fails outside the author's machine.

## Deploy and release — use the scripts, never by hand

- `tools/deploy.sh` rsyncs the working tree onto the real server over ssh after
  taking a restore point. `-n` dry run, `-r` restart (only needed after
  `Plugin.pm`, `Settings.pm` or `strings.txt`). Undo with `tools/rollback.sh`.
- `tools/release.sh X.Y.Z` bumps the three manifests, asserts the publication
  invariants, packages the zip and writes its SHA-1 into `repo.xml`. The
  `## [X.Y.Z]` CHANGELOG section must already exist.
- `tools/install-local.sh` targets the LMS on **this MacBook**, which has a
  different library. It is not the server under test.
- Never aim a JSON-RPC probe at `127.0.0.1` from here — it answers from the wrong
  library, plausibly and silently. `lms_rpc()` in `tools/lib/echo.sh` runs curl on
  the server instead.
- `dist/` is gitignored; the zip travels as a release asset.

## Evidence markers — mandatory

Every claim in a CHANGELOG entry, commit message or agent report carries one:

- **[live]** — seen happening in the running interface
- **[code]** — read in the source, state not reproduced
- **[measured]** — produced by a named script, cite it
- **[unverified]** — say what access or time was missing

Do not write **[live]** for something you did not observe. An unverified fix is
still worth merging; it is just not worth describing as verified.

## Network commands need approval

`npm install`, `git fetch/push`, `curl`, `ssh`, `scp`, `tools/deploy.sh`,
`tools/rollback.sh`: propose the exact command and stop. Do not run it.

## Plugin dependencies — decided, do not re-litigate

Any feature whose backend is another plugin follows
`docs/prompts/plugin-dependency-policy.md`: **detect and degrade, never
install, never bundle, never enable DSP silently.** An absent third-party
plugin collapses its whole feature to one line with an Install… action — never
a dead control. Detection probes the JSON-RPC verb, not a plugin list, and is
player-scoped where the verb needs a player. Read that file before designing
anything on SqueezeDSP, Group Players, MusicArtistInfo, RandomPlay or DSTM.

## Agent efficiency — hard rules

- Grep first, always. Never read a file >300 lines whole; read hit ±40 lines.
- A delegated implementation task is ≤1 commit and ≤3 files. If it needs more,
  the orchestrator splits it BEFORE delegating. A task that passes 60 tool
  uses or ~100k tokens stops and reports instead of pushing on.
- Gates run in exactly one place per cycle: verify. The orchestrator and
  reviewer trust verify's numbers; they do not re-run npm test/validate to
  double-check, except on a single named failing test.
- reviewer reads `git diff` (or a stated range) only — never the repo at large.
- Briefs, specs, decisions and sweep notes live as files in docs/prompts/;
  delegations pass file PATHS, never inline the contents.
- Long prompts from the user arrive as files (docs/prompts/*.md), invoked with
  "Read <path> and execute" — never pasted into the terminal.
- Before any deploy with -r, state the silent-death recovery command first.
  ECHO_HOST/ECHO_HTTP_HOST come from the environment, never lms.local.
- Each landed commit appends one line to docs/prompts/state.md
  (hash · what · evidence marker) so a fresh session resumes without
  re-reading history.
