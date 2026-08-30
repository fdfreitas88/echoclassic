const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('Apple Squeezer exposes the four formal DAC control modes', function () {
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  const modes = settings.match(/appleSqueezerModes:\s*\[([\s\S]*?)\]/)[1];
  assert.match(modes, /key: 'dac-priority'/);
  assert.match(modes, /key: 'equalizer'/);
  assert.match(modes, /key: 'osf'/);
  assert.match(modes, /key: 'csf'/);
});

test('Apple Squeezer remains an independent LMS Store plugin', function () {
  const plugin = helpers.read('EchoClassic/Plugin.pm');
  assert.doesNotMatch(plugin, /echoclassic-applesqueezer/);
  assert.doesNotMatch(plugin, /AppleSqueezerIntel/);
  assert.doesNotMatch(plugin, /sub appleSqueezerStatus/);
});

test('Apple Squeezer is discovered and controlled through its own LMS namespace', function () {
  const api = helpers.read('EchoClassic/HTML/echoclassic/html/js/api.js');
  assert.match(api, /canCommand\(\['applesqueezer', 'status'\]\)/);
  assert.match(api, /\[wire\.namespace, 'mode', mode\]/);
  assert.doesNotMatch(api, /echoclassic-applesqueezer/);
  assert.match(api, /apiVersion/);
  assert.match(api, /capabilities/);
  assert.match(api, /canCommand\(\['apple_squeezer', 'status'\]\)/);
  assert.match(api, /normalizePublishedAppleSqueezer/);
});

test('published Apple Squeezer Intel 1.0.2 wire commands are supported', function () {
  const api = helpers.read('EchoClassic/HTML/echoclassic/html/js/api.js');
  assert.match(api, /'dsp_status'/);
  assert.match(api, /'upsample_rate'/);
  assert.match(api, /'resample_filter'/);
  assert.match(api, /'dsp_apply'/);
  assert.match(api, /'dsp_bypass'/);
  assert.match(api, /'dsp_rollback'/);
  assert.match(api, /\[wire\.namespace, 'response'/);
});

test('Store API v2 scopes DSP state to the player and uses optimistic revisions', function () {
  const api = helpers.read('EchoClassic/HTML/echoclassic/html/js/api.js');
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  assert.match(api, /'player_id:' \+ String\(playerId\)/);
  assert.match(api, /'expected_revision:' \+ String\(expectedRevision\)/);
  assert.match(api, /\['applesqueezer', 'dsp-owner'\]/);
  assert.match(settings, /confirmedRevision/);
  assert.match(settings, /did not confirm a new DSP revision/);
  assert.doesNotMatch(settings, /echoclassic\.dsp-owner/);
});

test('lifecycle and lightweight telemetry are capability gated', function () {
  const api = helpers.read('EchoClassic/HTML/echoclassic/html/js/api.js');
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  assert.match(api, /\[wire\.namespace, 'lifecycle', String\(action\)\]/);
  assert.match(api, /\[wire\.namespace, 'telemetry'\]/);
  assert.match(settings, /appleSqueezerCanLifecycle/);
  assert.match(settings, /appleCapability\('telemetry'\)/);
  assert.match(settings, /apiVersion >= 2/);
});

test('speaker buttons use a persisted, validated volume increment', function () {
  const ui = helpers.read('EchoClassic/HTML/echoclassic/html/js/ui.js');
  const nowPlaying = helpers.read('EchoClassic/HTML/echoclassic/html/js/nowplaying.js');
  assert.match(ui, /\[1, 2, 5, 10\]\.indexOf\(savedVolumeStep\)/);
  assert.match(ui, /volumeStep: state\.volumeStep/);
  assert.match(nowPlaying, /stepVolume\(-ui\.volumeStep\)/);
  assert.match(nowPlaying, /stepVolume\(ui\.volumeStep\)/);
});

test('Apple Squeezer selector includes an accessible live signal path', function () {
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  assert.match(settings, /class="player-help apple-squeezer-path" aria-live="polite"/);
  assert.match(settings, /VHQ upsampling · 1 dB headroom · TPDF dither · exclusive CoreAudio/);
});

test('Apple Squeezer playback choices live inside Equalizer settings', function () {
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  const equalizerStart = settings.indexOf('<template v-if="isSettingsScreen(\'equalizer\')">');
  const playersStart = settings.indexOf('<template v-else-if="ui.appearanceScreen === \'players\'">');
  const selector = settings.indexOf('class="sgroup apple-squeezer-panel"');

  assert.ok(equalizerStart >= 0, 'Equalizer settings template exists');
  assert.ok(selector > equalizerStart && selector < playersStart, 'selector is within Equalizer settings');
  assert.equal(settings.indexOf('class="apple-squeezer-panel"'), -1, 'old Players-panel placement is removed');
});

test('Apple Squeezer modes use a readable checkmarked settings list', function () {
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(settings, /class="apple-squeezer-mode-list" role="radiogroup"/);
  assert.match(settings, /appleSqueezer\.mode === mode\.key \? '✓' : ''/);
  assert.match(settings, /appleSqueezerModeHelp\(mode\.key\)/);
  assert.doesNotMatch(css, /\.apple-squeezer-modes/);
  assert.match(settings, /class="setting-copy">Apple Squeezer Store plugin<small>/);
  assert.match(settings, /class="setting-copy">Processing engine<small>/);
  assert.match(css, /\.setting-copy\{[^}]*flex-direction:column/);
  assert.match(css, /\.setting-copy small\{[^}]*display:block/);
});

test('mode changes block the interface with a localized wait state and always clean up', function () {
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(settings, /v-if="appleSqueezer\.modeTransition" class="apple-squeezer-transition" role="alertdialog" aria-modal="true"/);
  assert.match(settings, /Changing playback mode…/);
  assert.match(settings, /Please wait while Apple Squeezer restarts the audio path\./);
  assert.match(settings, /modeTransition = \{ from: previousMode, to: mode \}/);
  assert.match(settings, /finally \{[\s\S]*modeTransition = null;[\s\S]*busy = false;/);
  assert.match(css, /\.apple-squeezer-transition\{position:fixed/);
});

test('rate and filter changes are optimistic, quiet on success, and roll back on failure', function () {
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  assert.match(settings, /var previousRate = this\.appleSqueezer\.upsampleRate;[\s\S]*this\.appleSqueezer\.upsampleRate = rate;/);
  assert.match(settings, /this\.appleSqueezer\.upsampleRate = previousRate;/);
  assert.match(settings, /var previousFilter = this\.appleSqueezer\.resampleFilter;[\s\S]*this\.appleSqueezer\.resampleFilter = filter;/);
  assert.match(settings, /this\.appleSqueezer\.resampleFilter = previousFilter;/);
  assert.doesNotMatch(settings, /PCM Studio rate changed to/);
  assert.doesNotMatch(settings, /Resampling filter changed to/);
});

test('advanced native DSP editor stays mode-gated while the root exposes a disabled saved preview', function () {
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  assert.match(settings, /isSettingsScreen\('equalizer-graphic'\)[^>]*appleSqueezer\.mode === 'equalizer' && nativeDspDraft/);
  assert.match(settings, /class="equalizer-workspace-surface" :class="\{paused:!equalizerAvailableNow\}"/);
  assert.match(settings, /The saved curve is shown below but is not processing audio/);
  assert.match(settings, /Rate unavailable/);
  assert.match(settings, /Latency unavailable/);
  assert.match(settings, /Response unavailable/);
  assert.match(settings, /clipped_samples == null \? '—'/);
  assert.doesNotMatch(settings, /diagnostics\.rate \|\| 48000 \}\} Hz/);
  assert.doesNotMatch(settings, /latency_frames \|\| 0 \}\} DSP frames/);
});

test('inactive Apple Squeezer modes do not fall through to the SqueezeDSP editor', function () {
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  assert.match(settings, /<template v-else-if="isSettingsScreen\('equalizer-graphic'\) && dspOwner === 'squeezedsp'">/);
  assert.match(settings, /:disabled="!equalizerAvailableNow\|\|nativeDspSaving\|\|!band.enabled"/);
  assert.match(settings, /openAppearanceScreen\('equalizer-mode'\)/);
  assert.match(settings, /activateEqualizerWorkspace/);
});

test('Equalizer workspace follows the approved full-screen hierarchy', function () {
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(settings, /class="equalizer-dashboard-path"/);
  assert.match(settings, /class="[^"]*equalizer-dashboard-presets/);
  assert.match(settings, /class="[^"]*equalizer-dashboard-rules/);
  assert.match(settings, /class="[^"]*equalizer-dashboard-curve/);
  assert.match(settings, /class="[^"]*equalizer-dashboard-advanced/);
  assert.match(settings, /appleSqueezerModes\.slice\(0,2\)/);
  assert.match(settings, /appleSqueezerModes\.slice\(2\)/);
  assert.match(css, /\.equalizer-screen\{width:100%/);
  assert.match(css, /\.equalizer-dashboard\{min-height:calc\(100vh/);
  assert.match(css, /\.eq-apply-group\{[^}]*position:sticky/);
  assert.match(css, /Swipe for higher frequencies/);
});

test('OSF and CSF expose a validated manual upsample-rate control', function () {
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  const api = helpers.read('EchoClassic/HTML/echoclassic/html/js/api.js');
  assert.match(settings, /\['osf','csf','pcm-studio'\]\.indexOf\(appleSqueezer\.mode\) >= 0/);
  assert.match(settings, /class="apple-squeezer-rates" role="radiogroup"/);
  assert.match(settings, /key: 'auto', label: 'Automatic'/);
  assert.match(settings, /key: '768000', label: '768 kHz'/);
  assert.match(api, /wire\.apiVersion >= 2 \? 'upsample-rate' : 'upsample_rate'/);
  assert.match(api, /setAppleSqueezerUpsampleRate/);
});

test('native DSP never falls back to a development MAC and validates the full payload', function () {
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  const api = helpers.read('EchoClassic/HTML/echoclassic/html/js/api.js');
  assert.doesNotMatch(settings, /02:41:53:49:4e:54/);
  assert.match(settings, /this\.store\.playerId \|\| ''/);
  assert.match(settings, /validateNativeDsp/);
  assert.match(settings, /exactly 12 bands/);
  assert.match(settings, /at most 64 filters/);
  assert.match(api, /DSP configuration exceeds 64 KiB/);
});

test('CSF rejects invalid precision, band edges and phase before sending', function () {
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  assert.match(settings, /Precision must be a whole number from 16 to 32 bits/);
  assert.match(settings, /Stopband must be greater than passband/);
  assert.match(settings, /Phase must be between 0 and 100%/);
});

test('Apple Squeezer status has a bounded player-scoped cache', function () {
  const api = helpers.read('EchoClassic/HTML/echoclassic/html/js/api.js');
  assert.match(api, /APPLE_SQUEEZER_STATUS_TTL = 2000/);
  assert.match(api, /String\(playerId \|\| 'server'\)/);
  assert.match(api, /invalidateAppleSqueezerStatus/);
});
