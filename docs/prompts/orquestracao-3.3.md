# Echo Classic 3.3 — orchestration brief

Invoke with: **`Read docs/prompts/orquestracao-3.3.md and execute`**

You are the **orchestrator**. You plan and delegate; you do not implement. This file is
your only source of work for 3.3. Everything you need to hand to a subagent is here —
a subagent starts fresh and sees the project guide, not this file and not your conversation, so
copy what it needs into your task text.

---

## 0 · State you inherit — do not re-derive it

- **`main` @ `7d0bbb1`**, 3.2.9 published, **plus five modified files that are not
  committed.** That is R1, already implemented. Your first job is to get it reviewed and
  handed over, not to rewrite it.
- Gates as measured on 2026-08-11 with those changes in the tree:
  `343 tests pass · 0 fail` · `validate 4/4, exit 0` · contrast `155/155` ·
  `check-source-language` ok.
- `_to_delete/index.lock.0` is a zero-byte leftover. Ignore it; the user deletes it.

### The design the work implements

**`docs/prompts/mockup-3.3-features.html`** — already in the repo beside this brief, and
tracked, because `docs/*mock*.html` in `.gitignore` matches only files directly under
`docs/`, not under `docs/prompts/`.

It inlines the real `ios9.css` from the deployed 3.2.9 verbatim, so what it shows is the
product's own metrics, controls and themes rather than an approximation. Open it and use
the top bar: five screens, and **Light / Dark / Legacy all work.**

**Read its `PROPOSED` style block before any CSS work.** The new rules — `.absent-row`,
`.timewheel`, `.day-chips`, `.reading` — are written there, use only existing tokens,
override nothing, and are meant to be lifted verbatim into `ios9.css`.

The older EQ design is still untracked at `docs/gaps-mockup.html`; R0.1 deals with it.

### Decisions already taken — encode, never re-ask

1. **Absent third-party feature → line in place.** The feature keeps its row and states
   its own precondition, with an Install… action. Applies to tier 2 (RandomPlay, DSTM) and
   tier 3 (SqueezeDSP, Group Players) alike. **This overrides the current text of
   `docs/prompts/plugin-dependency-policy.md`, which R0.2 amends.**
2. **Alarm time control → wheel.** Three visible values per column, selection band as two
   hairlines, mask for the falloff.
3. **Marking new features in mockups.** Rows take a left gutter bar; **buttons and pills
   take the whole border in accent**, label outside the control.
4. **Never mark or select a button or pill on one edge.** Full border, or an Apple-style
   selection. This is a product rule, not only a mockup rule.

---

## 1 · Hard constraints — inherit these into every delegation

**Git.** Never run `git add`, `git commit`, `git checkout`, `git reset` or anything that
touches the index. In this environment git leaves an orphaned `.git/index.lock` that jams
GitHub Desktop and cannot be deleted. `git diff`, `git log`, `git show` read-only are fine
for `reviewer`. **All commits are the user's to make** — you produce the exact commands,
you do not run them.

**Network.** `npm install`, `npm ci`, `git fetch/pull/push`, `curl`, `wget`, `ssh`, `scp`,
`tools/deploy.sh`, `tools/release.sh`, `tools/rollback.sh` — propose the exact command and
stop. Never run it. `npm test` and `npm run validate` are local and always allowed.

**Never probe `localhost:9000`.** A second LMS runs on the MacBook with a different,
apparently empty library and answers with a plausible-looking wrong result. The real
server is the one in `ECHO_HOST`.

**Never touch `html/lib/vue.min.js`.**

**Sanitisation.** No agent names in code, comments, documents or commit messages. No
private IPs — use `<servidor>`. No absolute machine paths. Only permitted commit e-mail:
`64909764+fdfreitas88@users.noreply.github.com`.

**Evidence.** `[live]` only for something observed in the running interface. `[code]` for
a chain read in source. `[measured]` for a named script's output. Nothing in 3.3 is
`[live]` until the user deploys and walks the acceptance list. Never write `[live]`
yourself.

---

## 2 · Settle three unknowns before R2, R4 or R5

One read of LMS source answers all three. Delegate to **`skin-dev`** as a **read-only
investigation, no edits**, and stop for the user if the source is not reachable.

```
AC-00a: Given LMS's songinfo tag table, when the lyrics tag is identified, then it is
        confirmed or refuted that "W" is the tag, with a file and line cited.
AC-00b: Given LMS's serverstatus response, when a player is synchronised, then the field
        names carrying the grouping are named, or their absence is stated.
AC-00c: Given Alarm.pm, when an alarm's repeat/day semantics and the fade-in preference
        are read, then both are described with a file and line cited.
```

**R2 does not start until AC-00a is answered.** If `W` is not the lyrics tag, R2 is void
and becomes MusicArtistInfo-dependent — report and stop, do not improvise.
**R4.1 depends on AC-00b. R5.1 depends on AC-00c.**

---

## 3 · Phases

Run in order. **Stop and report after every phase.** Do not begin the next one.

### R0 · Housekeeping — 3 commits

The only phase where material is at risk today.

```
AC-R0-01: Given docs/gaps-mockup.html is untracked and gitignored, when R0 completes,
          then the feature design is tracked at a path the ignore rules do not match.
AC-R0-02: Given the mockup and the dependency policy disagree on absent features, when
          R0 completes, then the policy and project guide state "line in place" as the rule.
AC-R0-03: Given the tracked backlog ends at AUDIT-19, when R0 completes, then AUDIT-20
          has an entry in docs/material-vs-echoclassic-gaps.md.
```

Docs only — no `skin-dev`, no `verify`. Also add decisions 3 and 4 from §0 to the project guide.

`docs/gaps-mockup.html` is one `rm` from gone and is the sole record of the EQ design.
It is recoverable at `git show 59309cc:docs/gaps-mockup.html`, byte-identical to disk
(`94a140ae…`).

### R1 · Replay gain — already implemented, uncommitted

**Do not re-implement.** Delegate to `reviewer` on the uncommitted diff, then `verify`.

```
AC-R1-01: Given a connected player, when a replay gain mode is chosen, then the mode is
          written through api.setPlayerPref and the control shows the value the server
          confirmed.
AC-R1-02: Given the player changes during the write, when the write completes, then no
          preference is written to the new player.
AC-R1-03: Given no player is connected, when Settings → Playback is open, then the
          segments are disabled and the hint says a player is needed.
AC-R1-04: Given any interface language, when a hint is shown, then it is one whole
          phrase from strings.txt, never assembled by concatenation.
```

Files: `store.js` (state, `loadPlayerSettings`, `setReplayGain`, exports) ·
`ui.js` (`REPLAY_GAIN_MODES`, exports) · `settings.js` (Playback group row,
`replayGainModes`, `replayGainHint`, `selectReplayGain`) · `strings.txt` (10 keys) ·
`tests/settings-playback.test.js` (9 cases).

Tell `reviewer` to check specifically: that `setReplayGain` captures `playerId` before its
first await and re-checks before each write, and that the read-back cannot overwrite state
belonging to a different player. Note for context that `setTransition` immediately above
still re-reads `state.playerId` after its awaits — that is pre-existing EC-014 exposure,
**out of scope for this diff**; if `reviewer` raises it, record it as a finding, do not fix
it here.

`[Unverified]` and worth naming in the handover: that `replayGainMode` is the right pref
name and `0/1/2/3` maps to off/track/album/smart.

### R2 · Lyrics — 2 commits · blocked on AC-00a

```
AC-R2-01: Given a song whose file carries lyrics, when Now Playing ⋯ is opened, then a
          Lyrics row is offered and opens a reading surface with the text.
AC-R2-02: Given a song with no lyrics, when Now Playing ⋯ is opened, then no Lyrics row
          is rendered — never a row leading to an empty screen.
```

`api.js:354` and `:844` carry a 43-character `songinfo` tag string with no `W`. The
mapper is `api.js:511-537`. The `.reading` / `.reading-source` rules are in the mockup's
PROPOSED block; **R5's biography inherits them**, so land them here properly.

### R3 · Playback options — 4 commits

```
AC-R3-01: Given DSTM is available, when it is switched on, then the provider choice is
          revealed and the help line states what happens when the queue ends.
AC-R3-02: Given RandomPlay is not installed, when Settings → Playback is open, then one
          row states the requirement and offers Install… — never a dead control.
AC-R3-03: Given the queue has unplayed items, when a random mix is started, then the
          user confirms before the queue is replaced.
AC-R3-04: Given an empty or fully played queue, when a random mix is started, then it
          starts with no prompt.
```

`store.js:234-238` already probes `randomplay` and `dontstopthemusicsetting` with the
comment *"nao tem consumidor ainda"*. **Giving them a consumer retires EC-043** — the
alternative fix is deleting them. Fix **EC-034** in the same pass:
`capabilitiesRequested` is set *before* the await, so one transient failure disables the
section for the page's life.

AC-R3-03 was never drawn in any mockup — it is required by an existing decision, and it is
real unbudgeted work.

### R4 · Sync completion — 3 commits · 4.1 blocked on AC-00b

```
AC-R4-01: Given two players are synchronised, when the player list is shown, then each
          row states that it is in sync and with which player.
AC-R4-02: Given a player is in a sync group, when Unsync is used, then it leaves the
          group and the row stops reporting sync.
AC-R4-03: Given Group Players is not installed, when Players & sync is open, then one
          row states the requirement and offers Install…
```

`api.js:501-509` maps only `id / name / connected / power` out of `serverstatus` and drops
the rest. AC-R4-02 **closes a defect, not a gap**: `syncWith` exists and nothing leaves a
group — the audit's root-cause pattern #4, a control that creates a state with no exit.

### R5 · Alarms — 7 commits · blocked on AC-00c

```
AC-R5-01: Given a player, when Settings → Player → Alarms is opened, then its alarms are
          listed with time, repeat and source, each with a switch.
AC-R5-02: Given the alarm editor, when a time is set on the wheel, then the value is
          committed to the alarm and shown in the list.
AC-R5-03: Given a keyboard only, when the wheel has focus, then each column is operable
          with arrow keys and the current time is announced.
AC-R5-04: Given fade-in, when it is changed, then it applies to every alarm on that
          player and is not offered per alarm.
```

Split: api → store → CSS → list → editor → **keyboard** → tests. **AC-R5-03 is its own
commit and is not optional.** The wheel is the only genuinely new control in 3.3, and the
audit's one unusual strength is that every interactive element already resolves an
accessible name — a wheel that broke that would be the first regression in that record.
`role="spinbutton"` per column, arrows, and a live region.

Fade-in is player-level because `Alarm.pm` stores it per player; two alarms cannot
disagree about it.

### R6 · Equalizer, absent branch only — 2 commits

```
AC-R6-01: Given SqueezeDSP is not installed, when Settings → Player is open, then one row
          states the requirement and offers Install…, and no other EQ surface exists.
AC-R6-02: Given the probe, when it runs, then it is scoped to a connected player and
          cached per player, not per session.
```

Every `squeezedsp.*` verb needs a connected player, so a startup probe cannot distinguish
"plugin absent" from "no player yet".

**Do not build the equalizer proper in 3.3.** It is blocked on two things that are not
code: SqueezeDSP is not installed, and the live-slider-vs-forced-re-seek question is
unanswered. If asked to continue past R6.2, stop and say so.

---

## 4 · How to run each phase

1. Write the ACs above verbatim into the delegation. Do not paraphrase them.
2. `skin-dev` implements — **≤1 commit and ≤3 files per task.** If a phase needs more,
   split it before delegating. Pass **paths and line ranges, never file contents.**
3. `i18n-ui` for any new user-visible string. Every phase except R0 has some.
4. `reviewer` on the diff for the phase, once — not per commit.
5. `skin-dev` fixes only what `reviewer` confirms, in one commit.
6. `verify` runs the gates **once**, at the end of the phase. Nobody re-runs them.
   You and `reviewer` trust `verify`'s numbers.

Expected gate commands: `npm test` · `npm run validate` · `npm run check-version` ·
`node tools/check-source-language.js`. `tools/check-ui-language.js` has hardcoded absolute
paths and will fail off the author's machine — that is `not run`, never a failure of the
change.

### Per-commit bookkeeping

- One line appended to `docs/prompts/state.md`: `hash · what · evidence marker`.
- A `CHANGELOG.md` entry under `## [Unreleased]` with honest markers.
- Because you cannot commit: produce the **exact `git add` and `git commit` commands**,
  with the full message, for the user to run. Group them ≤3 files each.

---

## 5 · Reporting

Use your standard block per phase, plus the commit commands:

```
STATUS: DONE | DONE WITH LIMITATIONS | BLOCKED
AC:      AC-R1-01 pass [code] · AC-R1-02 pass [code] · AC-R1-03 unverified — <why>
CHANGED: <paths>
GATES:   npm test <n> pass · npm run validate <result> · check-version <result>
OPEN:    <defects or risks, one line each>
COMMITS: <exact commands for the user>
```

Do not report a phase as done while an AC is failed, blocked or unverified. Say which and
why. Do not report anything as `[live]`.

---

## 6 · Release

**3.3.0** after R1–R4. R5 is large enough to justify **3.4.0** on its own; if it slips,
3.3 still ships four features and closes two defects.

Call `risk` only before `tools/release.sh`, never earlier.

Deploy needs `-r` because `strings.txt` changes in R1–R5. **State the silent-death
recovery command before proposing the deploy**, and propose both for approval:

```
ECHO_HOST=<host> ECHO_HTTP_HOST=<host>:9000 tools/deploy.sh -n
ECHO_HOST=<host> ECHO_HTTP_HOST=<host>:9000 tools/deploy.sh -r
ssh <host> 'open -a "Lyrion Music Server"'      # if port 9000 is dead after ~2 min
```

`ECHO_HOST` / `ECHO_HTTP_HOST` come from the environment, never `lms.local`.

---

## 7 · Out of scope for 3.3 — refuse and say why

- The equalizer beyond R6's absent row.
- Playlist **Remove duplicates**. `[Unverified]` that LMS has a dedup verb; without one it
  is N sequential deletes against shifting indices — the EC-014 family exactly. Fine on 32
  songs, a filed defect on 2,000.
- Artist biography. It follows lyrics, but it is a 3.4 item.
- Any refactor outside the named files. Any dependency change. Any "while I was in there"
  cleanup — if you believe one is necessary, stop and ask.
