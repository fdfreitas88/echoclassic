# Session state — one line per landed commit

Format: `hash · what · evidence marker`

Anything before this file existed is in `git log`. The settings redesign
(c87816c…d880318) is local and NOT deployed; the five responsive fixes
(879a5b4…388b075) are deployed and live.

- 388b075 · flex rows stop reserving space with magic numbers · [live]
- c87816c · per-surface fonts actually change the typeface · [code]
- 0de7cf8 · volume and crossfade select leave Settings · [code]
- f249cf9 · Queue, General, Language, Backup, About take final shape · [code]
- a98506a · Appearance goes inline; four subscreens die · [code]
- d880318 · one Player layout screen, three players, one grammar · [code]
- 01d921d · session working files into docs/prompts, efficiency rules · [code]
- 1871550 · eleven stranded strings.txt entries removed, Volume kept · [measured]
- dd6948a · active-player row and sleep line stop being Portuguese · [code]
- 6039d19 · 3.2.6c manifests and CHANGELOG · [measured]
- e421376 · state.md through 3.2.6c · [measured]
- 07f31b1 · AUDIT-20 recon on SqueezeDSP, from source · [code]
- 7977e27 · SqueezeDSP not installed on the server · [measured]
- d11c6c9 · plugin dependency policy · [code]
- 3f5b4c1 · EC-001: margin-left:0 on .navbar .segmented, navbar centre group no longer collapses onto Back/Search · [code]
- b921e63 · EC-014 sub-defects 1+2: undo stamped with the owning player, clearQueue snapshots via fullQueue() + notifyTruncated; sub-defect 3 left alone (does not reproduce) · [measured]

Gates at b921e63: 243 tests · 4/4 · contrast 125/125 ·
check-version 3.2.6c. [measured]
Everything from c87816c onward is still [unverified] — not deployed, not seen
in a browser. The acceptance walkthrough is what converts it.

- f8893ab · official-skin audit findings closed in Advanced Settings, Player layout navigation and disconnected-player feedback · [measured]

Gates at f8893ab: 278 tests · 4/4 · contrast 155/155 · check-version 3.2.8.
[measured] Visual acceptance remains [unverified] until the updated tree is
deployed to the LMS HTTP server; the local `file://` fixture was blocked by the
browser automation policy.

- c3b3d23 · UX-01: connection banner became a row of the .app column; it no longer covers the list toolbar or the root picker · [code]
- 40dc172 · I18N-01: action sheet commands are English in the source, Portuguese lives in strings.txt · [measured]
- 5d74b34 · I18N-01: queue mutation notice is one translatable English phrase with the count in {n} · [measured]
- ebbd5a5 · I18N-01: source-language gate now fails on the literals it let through; predicate exported for regression · [measured]
