# Plugin dependency policy

Decided 2026-08-08. Applies to every feature whose backend is not Echo Classic
itself. Agents follow this instead of re-deciding per feature.

## The rule

**Detect and degrade. Never install, never bundle, never enable DSP silently.**

Why each half is non-negotiable:

- LMS has no dependency resolution. `install.xml` cannot require another
  plugin, and vendoring a third-party plugin inside the Echo Classic zip is
  forbidden — both by the repository submission rules and by licensing.
- Installing a plugin needs a server restart. A skin must never trigger one.
- DSP entering the signal path is always an explicit user act. The skin's
  identity is showing what reaches the DAC; silently changing what reaches it
  would contradict the product.

## Tiers

**Core — always present.** Alarms, replay gain, sync. UI is unconditional; no
detection, no fallback.

**Ships with LMS, can be disabled.** RandomPlay (AUDIT-02), DSTM (AUDIT-03).
Detect at startup. When disabled: hide the entry points and show one quiet
Settings hint naming the plugin. Not an error, not a nag.

**Third-party.** SqueezeDSP (AUDIT-20), Group Players (AUDIT-16b),
MusicArtistInfo (AUDIT-18). When absent, the feature's entire surface is ONE
line where the feature would have lived — "X requires the &lt;name&gt; plugin" —
carrying an Install… action that opens the LMS plugin manager in the themed
iframe (the AUDIT-13 mechanism). When present: the full UI. **Never a dead
control.**

## Detection

By capability, not by plugin list, wherever possible: probe the JSON-RPC verb
the feature needs and treat a well-formed answer as presence. Cache per
session; re-probe on reconnect.

**Caveat that the SqueezeDSP recon already forces.** Every `squeezedsp.*` verb
is registered with dispatch flags `[1, 1, …]` and its handler calls
`$request->client()` — the whole surface is per-player and needs a *connected*
player (`Plugin.pm:200-210`, and see `docs/prompts/audit-20-recon.md` §b).
[code] So a capability probe fired at startup with no player connected cannot
tell "plugin absent" from "no player yet", and a naive probe would render the
absent-plugin line to someone who has the plugin. The probe is therefore
player-scoped: it runs when a player becomes current, not when the page loads,
and its cache is keyed by player, not by session. The same question has to be
asked of any other third-party verb before its probe is written — check the
dispatch flags first.

## Known conflicts to design around

**DSD × SqueezeDSP.** SqueezeDSP does not support DSD (its README), and this
server runs DSDPlayer. Rule: on a DSD stream the EQ auto-bypasses and the badge
says so — "EQ · bypassed — DSD". Confirm the live behaviour once the plugin is
installed, before shipping. [code → needs live confirmation]

**Transcode chain.** SqueezeDSP rewrites convert rules — specifically it
regenerates its own `custom-convert.conf` and calls
`loadConversionTables()` (`Configuration.pm:93-146`). [code] Check for other
`custom-convert.conf` edits and for CDplayer interaction once it is installed.
[unverified]

**MusicArtistInfo lyrics.** Core tag `W` supplies lyrics without MAI; MAI adds
biography, similar artists and reviews. Design the lyrics path against tag `W`
and treat MAI as enrichment, so AUDIT-18-lyrics does not become third-party
dependent.

## Current state of the third-party tier

None of the three is installed on the server. `ls` over both plugin
directories, 2026-08-08: CDplayer, DSDPlayer, EchoClassic, LocalPlayer,
MaterialSkin, MusicArtistInfo, MyQobuz, Qobuz. [measured]

MusicArtistInfo **is** present, so AUDIT-18 can be exercised live. SqueezeDSP
and Group Players are absent, so both the present and absent branches of their
UI have to be built against [code] until someone installs them.
