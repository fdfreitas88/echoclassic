# Continue 3.2.6c — close the settings pass, then AUDIT recon

Archived execution note for the 3.2.6c settings/recon pass. It preserves the
state and acceptance criteria from that pass, but it is not standing approval to
run commands or continue stale agent-session workflows.

## State you inherit (do not re-derive it)

- main has: 5 responsive-fix commits (879a5b4…388b075, deployed, live) and the
  settings redesign C1,C3,C4,C5,C6 (c87816c…d880318, local, NOT deployed).
- 237 tests, 4/4 gates, 125/125 contrast at last check. Fonts DEFERRED — no
  bundling, no .woff2, licensing postponed by decision.
- Prior session produced three working notes:
  settings-redesign-spec.md, phase2-decisions.md, i18n-sweep-notes.md.

## Step 0 — housekeeping (one commit)

1. Keep the three working notes above in docs/prompts/ when they are useful.
   If missing, the i18n risks are re-derivable from
   `git diff 388b075..HEAD -- '*strings.txt' '*settings.js'`.
2. Append the "Agent efficiency rules" block at the bottom of this file to
   CLAUDE.md, verbatim.
3. Commit: `chore: session working files into docs/prompts, efficiency rules`.

## Step 1 — finish the settings pass, in order

1. **i18n-ui** sweeps the full diff `388b075..HEAD`, starting from
   docs/prompts/i18n-sweep-notes.md (known risk: `{{ durationValue }} seconds`
   is a mixed text node that cannot match a "seconds" key — compose whole
   alternatives). It edits strings.txt only; anything else is a defect report.
2. **reviewer** on the full diff `388b075..HEAD` — one pass, not per-commit.
   Focus: unsupported evidence claims, the C6 Match-app seed semantics, and
   stranded strings the sweep should have removed.
3. **skin-dev** fixes only what reviewer confirms. One commit.
4. **C7**: bump 3.2.6c in install.xml, Plugin.pm, repo.xml; write the
   `## [3.2.6c]` CHANGELOG section with honest [live]/[code]/[unverified]
   markers (the settings work is all [code] until deployed). Commit.
5. **verify** runs the gates ONCE (nobody re-runs them after) and prints:
   the deploy command, the -r warning, and the acceptance walkthrough.

STOP here and show me: test count, gate results, the CHANGELOG section, and
the deploy command. I run the deploy myself.

Deploy notes for me (not for you to run):
- `ECHO_HOST=musicplayer@musicplayer.local ECHO_HTTP_HOST=musicplayer.local:9000 tools/deploy.sh -n` then without -n, with `-r` (strings.txt changed).
- -r has a known silent-death mode. If port 9000 is dead after ~2 min:
  `ssh musicplayer@musicplayer.local 'open -a "Lyrion Music Server"'`

## Step 2 — AUDIT-20 recon (pre-approved network commands)

Run exactly these, nothing else on the network:

```
git clone --depth 1 https://github.com/Foxenfurter/SqueezeDSP /tmp/squeezedsp
ssh musicplayer@musicplayer.local "ls ~/Library/Application\ Support/Squeezebox/Plugins ~/Library/Caches/Squeezebox/InstalledPlugins/Plugins 2>/dev/null"
```

Then answer, from /tmp/squeezedsp source only, the four questions: (a) native
macOS support, (b) control surface callable from a skin (JSON-RPC/HTTP/prefs),
(c) mid-track vs next-track preset application, (d) real band/filter/preamp
inventory. Report as four one-paragraph findings with [code] markers and file
paths into the clone. Do NOT design or implement any EQ.

## Decisions already made — encode, don't re-ask

- AUDIT-20 placement: follow the audit's frozen-design correction — EQ reached
  via player context sheet and Now Playing ⋯; the EQ badge joins the rate/bits
  strip; NO permanent icons in the mini/small bars or queue header.
- AUDIT-14: fade-in is per-player (Alarm.pm), so the alarm editor shows it as
  a player-level line, not a per-alarm toggle.
- AUDIT-02: Random Mix replaces the queue — it must confirm when the queue has
  unplayed items.
- Release order stands: R1 (13→15→17→18-lyrics→19-spike) is next after 3.2.6c
  ships, but NOT in this session. Stop after Step 2.

## Report format (end of session)

```
SETTLED:   <commits with hashes, one line each>
GATES:     <n> tests · 4/4 · contrast <n>/<n>   (from verify, run once)
AUDIT-20:  (a)… (b)… (c)… (d)…   [code, paths]
AWAITING:  deploy (my hands) · R1 go-ahead
```

---

## Agent efficiency rules (append to CLAUDE.md verbatim)

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
  read from a maintained file rather than pasted into a terminal.
- Before any deploy with -r, state the silent-death recovery command first.
  ECHO_HOST/ECHO_HTTP_HOST come from the environment, never lms.local.
- Each landed commit appends one line to docs/prompts/state.md
  (hash · what · evidence marker) so a fresh session resumes without
  re-reading history.
