const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

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
