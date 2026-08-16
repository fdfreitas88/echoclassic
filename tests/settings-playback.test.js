const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('language settings heading and reload explanation ship in EN/PT', function () {
  const strings = helpers.read('EchoClassic/strings.txt');
  assert.match(strings, /\tEN\tLanguage\n\tPT\tIdioma/);
  assert.match(strings, /\tEN\tChoosing a language reloads the page\. English is the original text; the others are translations shipped with the skin\.\n\tPT\tEscolher um idioma recarrega a página\./);
});

/* C3 (3.2.6c): volume leaves Settings entirely (it is operated in the
   player, not configured here) and Crossfade collapses from a <select>
   with a "No crossfade / gapless" option into a single toggle. These two
   tests are the audit's N2 and N3. */

function settingsSrc() {
  return helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
}

function playerGroup() {
  const src = settingsSrc();
  const m = src.match(/<div class="sgh">Player<\/div>[\s\S]*?<div class="sgh">Playback<\/div>/);
  assert.ok(m, 'Player group not found');
  return m[0];
}

function playbackGroup() {
  const src = settingsSrc();
  const m = src.match(/<div class="sgh">Playback<\/div>[\s\S]*?<div class="sgh">Queue<\/div>/);
  assert.ok(m, 'Playback group not found');
  return m[0];
}

test('N2: the Player group has no volume slider and no fixed-volume/volume-mode caption', function () {
  const group = playerGroup();
  assert.doesNotMatch(group, /type="range"/);
  assert.doesNotMatch(group, /store\.fixedVolume/);
  assert.doesNotMatch(group, /store\.volumeModeSynced/);
  /* C4 (3.2.6c) moved Connection into About -- it is the only place a user
     sees "no player connected" (phase2-decisions.md #4), but it no longer
     lives in the Player group itself. */
  assert.doesNotMatch(group, /store\.connected/);
});

test('N2: volume leaves the component entirely -- no draft, computed, watch or method survives', function () {
  const src = settingsSrc();
  assert.doesNotMatch(src, /volumeDraft/);
  assert.doesNotMatch(src, /volumeAdjustable/);
  assert.doesNotMatch(src, /volumeValue/);
  assert.doesNotMatch(src, /volumeLabel/);
  assert.doesNotMatch(src, /volumeHint/);
  assert.doesNotMatch(src, /onVolumeInput/);
  assert.doesNotMatch(src, /setVolumeValue/);
});

test('N3: the old crossfade <select> with "No crossfade / gapless" is gone; a role="switch" toggle replaces it', function () {
  const group = playbackGroup();
  assert.doesNotMatch(group, /<select/);
  assert.doesNotMatch(group, /No crossfade \/ gapless/);
  assert.match(group, /role="switch"[\s\S]*?aria-label="Crossfade"/);
});

test('N3: the Duration row is gated on store.transitionType, and stays wired to durationDraft/duration', function () {
  const group = playbackGroup();
  assert.match(group, /<label v-if="store\.transitionType" class="srow">Duration/);
  assert.match(group, /durationDraft = Number\(\$event\.target\.value\)/);
  assert.match(group, /@change="duration\(\$event\.target\.value\)"/);
});

test('N3: toggling the crossfade switch off writes transitionType 0 through LmsStore.setTransition, keeping the duration', function () {
  const calls = [];
  const inst = helpers.settingsInstance({
    LmsStore: {
      state: { players: [], connected: false, playerId: 'p1', transitionType: 1, transitionDuration: 7 },
      setTransition: function (type, duration) { calls.push([type, duration]); }
    }
  });
  const self = inst.self;
  self.toggleCrossfade();
  assert.deepEqual(calls, [[0, 7]]);
});

test('N3: toggling the crossfade switch on writes transitionType 1, defaulting duration to 4 when none is stored', function () {
  const calls = [];
  const inst = helpers.settingsInstance({
    LmsStore: {
      state: { players: [], connected: false, playerId: 'p1', transitionType: 0, transitionDuration: 0 },
      setTransition: function (type, duration) { calls.push([type, duration]); }
    }
  });
  const self = inst.self;
  self.toggleCrossfade();
  assert.deepEqual(calls, [[1, 4]]);
});

/* R1 (3.3): replay gain. Four fixed LMS values, so the control is the same
   .segmented radiogroup Theme uses -- not a <select>, not a picker screen. */

function replayGainInstance(state, calls) {
  return helpers.settingsInstance({
    LmsStore: {
      state: Object.assign({ players: [], connected: true, playerId: 'p1' }, state),
      setReplayGain: function (mode) { calls.push(mode); }
    }
  }).self;
}

test('R1: replay gain renders as a segmented radiogroup in the Playback group, not a select', function () {
  const group = playbackGroup();
  assert.match(group, /aria-label="Replay gain"/);
  assert.match(group, /<div class="segmented" role="radiogroup" aria-label="Replay gain">/);
  assert.match(group, /v-for="option in replayGainModes"/);
  assert.doesNotMatch(group, /<select[^>]*replayGain/i);
});

test('R1: each segment carries radio semantics and roving tabindex, and is disabled without a player', function () {
  const group = playbackGroup();
  const seg = group.match(/aria-label="Replay gain">[\s\S]*?<\/div>/)[0];
  assert.match(seg, /role="radio"/);
  assert.match(seg, /:aria-checked="store\.replayGainMode === option\.key \? 'true' : 'false'"/);
  assert.match(seg, /:tabindex="store\.replayGainMode === option\.key \? 0 : -1"/);
  assert.match(seg, /@keydown="radioKey\(\$event, replayGainModes, store\.replayGainMode, selectReplayGain\)"/);
  assert.match(seg, /:disabled="!store\.playerId"/);
});

test('R1: the four modes come from LmsUi, so settings.js does not carry its own copy of the enum', function () {
  const src = settingsSrc();
  assert.match(src, /replayGainModes: LmsUi\.REPLAY_GAIN_MODES/);
  const ui = helpers.read('EchoClassic/HTML/echoclassic/html/js/ui.js');
  assert.match(ui, /REPLAY_GAIN_MODES: REPLAY_GAIN_MODES/);
  assert.match(ui, /\{ key: 0, label: 'Off' \}/);
  assert.match(ui, /\{ key: 3, label: 'Smart' \}/);
});

test('R1: choosing a mode writes it through LmsStore.setReplayGain', function () {
  const calls = [];
  const self = replayGainInstance({ replayGainMode: 0 }, calls);
  self.selectReplayGain(2);
  assert.deepEqual(calls, [2]);
});

test('R1: choosing the mode already in use writes nothing', function () {
  const calls = [];
  const self = replayGainInstance({ replayGainMode: 2 }, calls);
  self.selectReplayGain(2);
  assert.deepEqual(calls, []);
});

test('R1: the hint is a whole phrase per mode, never built by concatenation', function () {
  const calls = [];
  assert.equal(replayGainInstance({ replayGainMode: 0 }, calls).replayGainHint,
    'Off: every recording plays at the loudness it was mastered at.');
  assert.equal(replayGainInstance({ replayGainMode: 1 }, calls).replayGainHint,
    'Track: every song plays at a similar loudness.');
  assert.equal(replayGainInstance({ replayGainMode: 2 }, calls).replayGainHint,
    'Album: loudness differences within an album are kept.');
  assert.equal(replayGainInstance({ replayGainMode: 3 }, calls).replayGainHint,
    'Smart: album gain for a whole album, track gain when shuffling.');
});

test('R1: with no player the hint says so instead of describing a mode', function () {
  const calls = [];
  const self = helpers.settingsInstance({
    LmsStore: {
      state: { players: [], connected: false, playerId: null, replayGainMode: 0 },
      setReplayGain: function (mode) { calls.push(mode); }
    }
  }).self;
  assert.equal(self.replayGainHint, 'Available when a player is connected.');
});

/* R1 store guard: the four cases above only ever exercise the mock
   LmsStore that settings.js is handed -- none of them load the real
   store.js, so the player-token re-check in setReplayGain (the part the
   review flagged) had zero coverage. This mirrors store.test.js's own
   storeContext harness: a minimal browser-shaped sandbox with a fake
   LmsApi, so setReplayGain runs for real and the guard can be driven with
   promises the test resolves by hand. */
function deferred() {
  const out = {};
  out.promise = new Promise(function (resolve) { out.resolve = resolve; });
  return out;
}

function flush() {
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}

function replayGainStore(apiExtra) {
  const api = Object.assign({
    setPlayerPref: async function () { return true; },
    playerPref: async function () { return null; }
  }, apiExtra || {});
  const ctx = helpers.browserContext({
    localStorage: {
      getItem: function () { return null; },
      setItem: function () {},
      removeItem: function () {}
    },
    document: { hidden: true, addEventListener: function () {} },
    navigator: {},
    Vue: { observable: function (o) { return o; } },
    LmsApi: api,
    LmsUi: { notify: function () {}, setBusy: function () {}, state: {} }
  });
  ctx.window = ctx;
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/store.js');
  return ctx.LmsStore;
}

test('R1 store: a player switch between the write and the read-back keeps the read-back off the new player (AC-R1-02)', async function () {
  const writeDeferred = deferred();
  const readCalls = [];
  const store = replayGainStore({
    setPlayerPref: function () { return writeDeferred.promise; },
    playerPref: function (playerId, key) { readCalls.push([playerId, key]); return Promise.resolve('2'); }
  });
  store.state.playerId = 'p1';
  store.state.replayGainMode = 0;

  const pending = store.setReplayGain(2);
  writeDeferred.resolve(true);
  store.state.playerId = 'p2';
  await pending;

  assert.equal(readCalls.length, 0,
    'the read-back must never be issued once the write no longer targets the current player');
  assert.equal(store.state.replayGainMode, 0,
    'switching players between the write and the read-back must not touch state');
});

test('R1 store: a player switch after the read-back resolves does not let the stale confirmation overwrite state (AC-R1-02)', async function () {
  const readDeferred = deferred();
  const readCalls = [];
  const store = replayGainStore({
    setPlayerPref: function () { return Promise.resolve(true); },
    playerPref: function (playerId, key) { readCalls.push([playerId, key]); return readDeferred.promise; }
  });
  store.state.playerId = 'p1';
  store.state.replayGainMode = 0;

  const pending = store.setReplayGain(2);
  await flush();
  assert.equal(readCalls.length, 1, 'sanity: the read-back must have gone out to the original player');

  readDeferred.resolve('2');
  store.state.playerId = 'p2';
  await pending;

  assert.equal(store.state.replayGainMode, 0,
    'a confirmation that arrives after the player changed must never land in state');
});

test('R1 store: a null read-back keeps the value that was just written instead of snapping to Off (Finding 1)', async function () {
  const store = replayGainStore({
    setPlayerPref: async function () { return true; },
    playerPref: async function () { return null; }
  });
  store.state.playerId = 'p1';
  store.state.replayGainMode = 0;

  await store.setReplayGain(2);

  assert.equal(store.state.replayGainMode, 2,
    'a read-back with no value must not be read as a confirmed Off');
});

test('R1 store: a genuine server-confirmed "0" overwrites the optimistic value (Finding 1 regression guard)', async function () {
  const store = replayGainStore({
    setPlayerPref: async function () { return true; },
    playerPref: async function () { return '0'; }
  });
  store.state.playerId = 'p1';
  store.state.replayGainMode = 2;

  await store.setReplayGain(3);

  assert.equal(store.state.replayGainMode, 0,
    'a server-confirmed "0" must still land as Off even though the optimistic value was 3');
});

test('R1: every replay gain phrase has a strings.txt key, so none is stranded in English', function () {
  const strings = helpers.read('EchoClassic/strings.txt');
  [
    'ECHOCLASSIC_UI_REPLAY_GAIN',
    'ECHOCLASSIC_UI_REPLAY_GAIN_OFF',
    'ECHOCLASSIC_UI_REPLAY_GAIN_TRACK',
    'ECHOCLASSIC_UI_REPLAY_GAIN_ALBUM',
    'ECHOCLASSIC_UI_REPLAY_GAIN_SMART',
    'ECHOCLASSIC_UI_REPLAY_GAIN_OFF_HINT',
    'ECHOCLASSIC_UI_REPLAY_GAIN_TRACK_HINT',
    'ECHOCLASSIC_UI_REPLAY_GAIN_ALBUM_HINT',
    'ECHOCLASSIC_UI_REPLAY_GAIN_SMART_HINT',
    'ECHOCLASSIC_UI_REPLAY_GAIN_NO_PLAYER'
  ].forEach(function (key) {
    assert.ok(strings.includes(key + '\n'), 'missing strings.txt key: ' + key);
  });
});
