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

Gates at 6039d19, run once by verify: 237 tests · 4/4 · contrast 125/125 ·
check-version 3.2.6c. [measured]
Everything from c87816c onward is still [unverified] — not deployed, not seen
in a browser. The acceptance walkthrough is what converts it.
- 07f31b1 · AUDIT-20 recon on SqueezeDSP, from source · [code]
- 7977e27 · SqueezeDSP not installed on the server · [measured]
