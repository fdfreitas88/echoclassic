# LIST-01 — verification, audit, and error sweep

## Settled-diff gates

- `npm test`: **374 pass, 0 fail**. `[measured]`
- `npm run validate`: JavaScript syntax pass; **20** Vue templates compiled with
  0 errors; cross-module references pass; **155/155** contrast pairs pass.
  `[measured]`
- `npm run check-version`: 3.2.9 consistent across `install.xml`, `Plugin.pm`, and
  `repo.xml`. `[measured]`
- `node tools/check-source-language.js`: pass. `[measured]`
- `node tools/check-ui-language.js`: 0 user-visible Portuguese findings.
  `[measured]`
- `git diff --check`: pass. `[measured]`
- Tracked-worktree diff SHA-256: `63124fdffa31efd48f77a0e5a4763141b81fb49da1d8a0852328c8e688407b88`.
  The task mockup and brief are untracked until the user stages them and have hashes
  `1b327567…` and `891a4067…`. The tracked-diff hash also contains preserved
  3.3 work.

## Acceptance matrix

| AC | Result | Evidence |
|---|---|---|
| LIST-01 | Pass locally | `[code]` `opmlview.js:287-379`; `[measured]` focused paging tests |
| LIST-02 | Pass locally | `[code]` offset advances by server rows with no fixed ceiling; `[measured]` append/end tests |
| LIST-03 | Pass locally | `[code]` appended mapped `node`/`playNode` use unchanged `activate`; `[measured]` stable-action test |
| LIST-04 | Pass locally | `[code]` identity dedupe, usable-row filter, no-progress stop and retry; `[measured]` three failure-path tests |
| LIST-05 | Pass locally | `[code]` in-memory snapshot by player/node/term restores rows, terms and scroll; real browser Back remains `[unverified]` until live test |
| LIST-06 | Pass locally | `[code]` focusable `role=status` live region is focused after append; narrow-screen behavior remains `[unverified]` until live test |
| LIST-07 | Pass locally | `[code]` short page removes continuation; existing row paths unchanged; `[measured]` full suite |
| LIST-08 | Pass locally | `[measured]` 155/155 contrast, templates compile, language gates clean; long-label layout remains `[unverified]` until live test |
| LIST-09 | Pass locally | `[code]` token/key/player guards plus player watcher; `[measured]` stale first/next-page tests |
| LIST-10 | Pass locally | `[code]` translated marker outside complete accent border; `[measured]` template/string and contrast gates |

## Audit

The first audit found one major issue: the initial request rejected data from an old
player but did not restart loading, so changing players at that moment could leave the
spinner indefinitely. The player watcher now starts a fresh tokened load, and a focused
regression test covers old-response-last ordering. The corrected diff was put through
the complete test battery again. No blocker, major, or minor finding remains in the
second audit.

The audit also confirmed that JSON-RPC construction stays in `api.js`, same-title rows
with different actions remain distinct, raw errors do not reach the page, source text
is English, the vendored Vue file is untouched, and the requested marker follows the
full-border rule.

## Error sweep

- Old initial/next-page responses after player change: rejected; new initial load
  starts automatically. `[measured]`
- Repeated actions: loading guard prevents concurrent continuation requests. `[code]`
- Duplicate boundary, malformed, empty, short, full-no-progress, and rejected pages:
  covered; no duplicate or infinite loop. `[measured]`
- Disconnect/transient request error: loaded rows remain and retry uses the same
  offset; real reconnect is `[unverified]`. `[measured/code]`
- Search after multiple pages and Back: snapshot contains items, page offset, terms,
  `hasMore`, terminal state, and scroll; real browser navigation is `[unverified]`.
- Keyboard/focus: status is `aria-live`, programmatically focusable, and receives focus
  after append; screen-reader announcement is `[unverified]` live.
- Mobile, long EN/PT, Light/Dark/Legacy: approved mockup covers the states and contrast
  passes; rendered server behavior is `[unverified]` live.
- Old persisted state: snapshots are session-memory only and introduce no stored schema.
- Cache/restart: JS/CSS asset revision is handled by deploy; `strings.txt` requires
  `tools/deploy.sh -r`. `[code]`
- Friendly errors: `friendlyError` plus translated recovery guidance; no RPC method,
  stack, or raw fetch string is rendered. `[measured]`

## Live testing

On 2026-08-16 the user clarified that **Done** meant the candidate had been deployed,
not that the numbered checklist had passed. Live acceptance therefore remains pending;
none of the eight behavioral checks is recorded as `[live]` yet.
