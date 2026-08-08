# AUDIT-20 recon — SqueezeDSP, from source

Read from `git clone --depth 1 https://github.com/Foxenfurter/SqueezeDSP`, 2026-08-08.
Source only. Nothing here was run, installed or heard. No EQ is designed here.

The clone's working tree is truncated — binaries, zips and `custom-convert.conf`
are 0 bytes on disk while the git objects are intact, so blobs were read with
`git cat-file`. `custom-convert.conf` is genuinely empty in HEAD: the plugin
rewrites it at runtime. [measured]

## (a) Native macOS support — yes, both architectures

Real native Mach-O binaries ship for both: `git cat-file blob
HEAD:SqueezeDSP/Bin/publishOsx-x64/squeezeDSP | file -` gives `Mach-O 64-bit
executable x86_64`, and `publishOSX-arm64/SqueezeDSP` gives `arm64`. The
Linux and Windows siblings identify as statically linked Go binaries, so these
are Go builds too. [measured]

Selection is `binaries()` at `Binary.pm:9-43`, keyed off
`Slim::Utils::OSDetect::details()` — not `uname`, not `$^O`. It tests
`$os->{'os'} eq 'Darwin'` (:34) then `$os->{'osArch'} =~ /arm64/` (:35). Whether
OSDetect actually reports an `osArch` containing `arm64` on Apple Silicon could
not be checked — no LMS source in the clone. [unverified]

Two hazards worth carrying forward. The paths `Binary.pm` returns are
`publishOSX-x64/SqueezeDSP`, but the tree holds `publishOsx-x64/squeezeDSP`;
this resolves on a default case-insensitive APFS volume and breaks on a
case-sensitive one. The same mismatch affects the Linux x64 path. [code]
Signing: the arm64 blob is `Signature=adhoc … linker-signed`, no Team
Identifier, not notarised; the x86_64 blob is not signed at all. `Binary.pm:66`
copies the shipped file with `File::Copy::copy`, which creates a fresh inode
and so carries no quarantine xattr forward, then chmods 0555 (:69) — that is
what keeps Gatekeeper out of it. Whether the LMS downloader quarantines the
extracted archive in the first place is not determinable from the clone.
[code] [unverified]

`install.xml` declares no platform or architecture element at all; its only
targeting is `SqueezeCenter` minVersion 7.8.0, `<type>2</type>`. [code]

## (b) Control surface — a real per-player JSON-RPC surface, not just a form

This is the finding that matters, and it is better than the audit assumed.
Ten commands are registered at `Plugin.pm:200-210` under the `squeezedsp.`
prefix, every one with dispatch flags `[1, 1, …]` — so every one requires a
connected player, and the whole surface is per-player. [code]

- `squeezedsp.filters` — available impulse WAVs and saved presets
  (`UI_Functions.pm:9-36`)
- `squeezedsp.readclientSettings` — the player's whole settings JSON (:354-379)
- `squeezedsp.readpresetSettings` — `presetFileName:` copies a preset over the
  player's live settings and returns it (:384-437)
- `squeezedsp.saveall` — `val:` a full JSON blob replacing the settings file
  (:167-256)
- `squeezedsp.saveas` / `squeezedsp.deletepreset` / `squeezedsp.importwav`
  (base64 WAV) / `squeezedsp.logsummary` / `squeezedsp.clearlog` /
  `squeezedsp.trackgain`

The only HTTP endpoint is `plugins/SqueezeDSP/index.html` (`Plugin.pm:260`),
which serves the settings page itself. [code]

**There are no usable preferences.** `preferences('plugin.squeezedsp')` exists
but the single key ever written is `enabled` (`Settings.pm:48`) and nothing
reads it; a grep for `prefs` across the plugin returns seven hits and no
`$prefs->set`. [measured] All DSP state lives in plain JSON at
`<prefs dir>/SqueezeDSP/Settings/<clientid>.settings.json` via
`Utils::getPrefFile` (:91-96) and `Utils::setPref`/`getPref` (:98-114) — so
`serverstatus`, `playerpref` and `pref` see none of it. [code]

`Settings.pm` subclasses `Slim::Web::Settings` and names
`plugins/SqueezeDSP/settings/basic.html`, but `Plugin.pm` never calls
`->new($class)` and that file is not in the tree. Dead code. [measured]

So a skin can switch preset without touching any HTML form: `squeezedsp.filters`
to enumerate → `squeezedsp.readpresetSettings` with `presetFileName:` →
`squeezedsp.saveall` with `val:`. That is exactly the chain the plugin's own
page uses (`index.html:150-155`, `js/sqdsp_data.js:466,515-516`). [code]

Caveat for anyone building on this: the shipped JS also calls
`squeezedsp.setval` and `squeezedsp.seteq`, and **neither is registered**.
`setvalCommand` exists at `UI_Functions.pm:260` and is unreachable. There is no
per-key write path — only the whole-blob `saveall`. [code]

## (c) Mid-track — but by restarting the stream, not by reaching into it

The mechanism is a transcode step, so by construction a change cannot reach
audio already in flight. `Configuration::initConfiguration` (:93-133) rewrites
the plugin's own `custom-convert.conf` from scratch, one block per player, then
calls `Slim::Player::TranscodingHelper::loadConversionTables()` (:146). Each
rule pipes the decoder into `[SqueezeDSP] --Clientid="$CLIENTID$" --bitsout=24`
(`TemplateConfig.pm:39-100, 248-306`), so the binary launches once per stream
and reads that player's settings JSON at process start. There is no IPC or
signal into a running convolver, and `loadConversionTables()` runs only on
plugin init and on `client new` / `client reconnect` (`Plugin.pm:221-222,
240-254`) — never on a settings change. [code]

A bare settings write would therefore take effect only from the next track.
The plugin does not leave it there: `saveallCommand` (`UI_Functions.pm:191-254`)
reads `playingSongElapsed()` and issues `$client->execute(['time', $pos + 0.5])`
— a half-second forward seek whose only purpose is to tear down and relaunch
the pipeline. Its own comments say "Force DSP reload by seeking". It is a seek,
not a `playlist jump`. It is guarded: only for protocols in `file http https
smb nfs afp tidal spotify deezer qobuz hls`, not for `wma/wmal/wmap`, only when
`isPlaying()` and `new_position < duration - 0.1`; when paused it does
`pause 0` → `time` → `pause 1`; near the end of a track it logs "Skipping seek"
and the change silently waits for the next track. Preset loads inherit the same
forced re-seek. [code]

So: mid-track, at the cost of restarting the stream ~0.5 s later. Nobody has
heard what that gap sounds like. [unverified]

## (d) Inventory — free-form parametric, five filter types, real convolution

**No fixed band count and no fixed frequency grid.** The EQ is a free-form
`Client.Filters[]` array grown by an Add button (`index.html:539` →
`AddPEQBand()`), a new band defaulting to 1000 Hz / 0 dB / slope 1.41 / type Q
(`js/sqdsp_peq_ctl.js:58-62`). No cap on the array anywhere in the JS. Older
fixed-count configs (`EQBand_0…N`) are migrated by `transformLegacyFilters`
(`js/sqdsp_data.js:75-172`). [code]

**Five filter types selectable**: peak, lowshelf, highshelf, lowpass, highpass
(`sqdsp_peq_ctl.js:42-48`). The biquad library also implements bandpass and
notch (`sqdsp_peq_lib.js:150,160`) but neither is offered. [code]

**Per band**: frequency 20–20000 Hz step 1 (:184); gain −25…+15 dB step 0.1
(:194,205); Q 0.1–20 (:51-52,136); shelf slope 0.05–1.2 (:53-54). [code]

**Preamp is cut-only, −30…0 dB step 0.1** (`index.html:265-273`). There is no
separate master gain above it. [code]

Also per-player: Balance −12…+12 and stereo Width −12…+12, step 0.1
(:351-359, 372-380); Delay −20…+20 ms step 0.1, sign choosing the channel
(:330-338); Loudness on/off with a listening level 50–85 dB (:439-476);
Crossfeed as five discrete choices — off, light, medium, strong, bonkers —
not a continuous control (:396-428); ReplayGain inside the engine, mode
1=track/2=album/3=smart, fixed_gain −20…0 default −6.0 and a Spotify-specific
−20…0 default −4.0 (:302,316, defaults `sqdsp_data.js:28-35`); and a global
Bypass, default on (`sqdsp_data.js:17`, `Configuration.pm:255`). [code]

**Convolution is real**: `FIRWavFile` picks a WAV impulse from
`<prefs>/SqueezeDSP/Impulses` (`Plugin.pm:181`), with wet/dry FIRStrength
0–100 (`index.html:206-215`); files upload base64 through
`squeezedsp.importwav`. An AutoEQ importer pulls headphone target curves from
`raw.githubusercontent.com/jaakkopasanen/AutoEq` (`js/sqdsp_autoeq.js:8-12`).
Engine-level convolver settings are in `Bin/SqueezeDSP_config.json` and are not
exposed: `partitions 0`, `convolvergain -4`, `dither 1`, `gain -10`,
`tail true`. [measured] A `MatrixFile` key and a `MatrixImpulses` directory
exist with no UI control. There is no measurement-based room correction — only
import of an externally produced impulse. [code]

## The server does not have it

`ls` over both plugin directories on musicplayer@musicplayer.local, 2026-08-08:
CDplayer, DSDPlayer, EchoClassic, LocalPlayer, MaterialSkin, MusicArtistInfo,
MyQobuz, Qobuz. **No SqueezeDSP.** [measured]

All eight sit in `~/Library/Caches/Squeezebox/InstalledPlugins/Plugins`, and
`~/Library/Application Support/Squeezebox/Plugins` is empty — so every plugin
on this server arrived through the extension downloader and none is hand-
dropped. That is a second, incidental confirmation that `repo.xml` is the real
delivery path for Echo Classic, not a formality. [measured]

Consequence for AUDIT-20: everything above is read from source and none of it
has been exercised against a running plugin. Before any EQ work starts,
SqueezeDSP has to be installed and the JSON-RPC surface in (b) confirmed
against the live server — in particular that `squeezedsp.filters` answers, and
what the half-second re-seek in (c) actually sounds like mid-track. Until then
the whole design rests on [code].

## What this changes for the AUDIT-20 design

Nothing is designed here. Recording only the constraints the design will have
to live with:

- The control surface is per-player JSON-RPC, which the skin already speaks.
  No HTML form scraping, no new transport.
- There is no per-key write. Any change means read the whole blob, edit it,
  write the whole blob back — with the concurrency question that implies.
- Applying a change re-seeks the stream. A slider that writes on every drag
  would restart the stream on every drag.
- State is invisible to `serverstatus`. The skin cannot learn a player's EQ
  state from the status poll it already runs; it needs a separate call.
