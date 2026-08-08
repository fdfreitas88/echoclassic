const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

/* WP5 (3.2.6b): the consolidated Appearance section in Settings and its five
   subscreens. This file is the FIRST consumer of helpers.settingsInstance --
   it wires real LmsUi (from ui.js) and real LmsFmt, and gives lms-settings'
   methods/computed a genuine `this`, without a DOM or a Vue renderer. Where a
   test needs to observe navigation it supplies its own tiny LmsNav double
   through settingsInstance's `extra` argument -- the default one from
   uiContext only has `reset`/`top`, on purpose, for callers that never push. */

function settingsSrc() {
  return helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
}

/* A LmsNav double with a real backing array, so push/top behave like the
   real module for the one stack ('settings') these tests touch. */
function fakeNav() {
  const settings = [];
  return {
    stacks: { settings: settings },
    push: function (tab, frame) { settings.push(frame); },
    pop: function (tab) { return settings.length ? settings.pop() : null; },
    top: function (tab) { return settings.length ? settings[settings.length - 1] : null; },
    reset: function (tab) { settings.length = 0; }
  };
}

test('exactly one sgh "Appearance", and the old sub-headings are gone', function () {
  const src = settingsSrc();
  const appearanceHeadings = src.match(/<div class="sgh">Appearance<\/div>/g) || [];
  assert.equal(appearanceHeadings.length, 1);
  assert.doesNotMatch(src, /<div class="sgh">Fonts<\/div>/);
  assert.doesNotMatch(src, /<div class="sgh">Progress bars<\/div>/);
  assert.doesNotMatch(src, /<div class="sgh">Full player layout<\/div>/);
  /* Colour scheme also loses its own top-level heading -- it is a drill-in
     row inside the new Appearance group now, not a group of its own. */
  assert.doesNotMatch(src, /<div class="sgh">Colour scheme<\/div>/);
});

test('the General group no longer contains the dark-theme switch', function () {
  const src = settingsSrc();
  assert.doesNotMatch(src, /aria-label="Dark theme"/);
  assert.match(src, /<div class="sgh">General<\/div>/);
  /* The two switches that used to share the old "Appearance" heading with the
     dark switch are still there, just under the renamed heading. */
  const generalBlock = src.split('<div class="sgh">General</div>')[1].split('<div class="sgh">')[0];
  assert.match(generalBlock, /Rate and bits in the bottom bar/);
  assert.match(generalBlock, /Highlight hi-res/);
});

test('every Appearance drill-in row is a type="button" with a name for its destination', function () {
  const src = settingsSrc();
  const expected = {
    theme: 'Theme', colorScheme: 'Colour scheme', font: 'Font',
    progress: 'Progress bars', players: 'Player layout',
    full: 'Full player', small: 'Small player', mini: 'Mini player'
  };
  const re = /<button type="button" class="srow settings-command-row pointer" @click="openAppearanceScreen\('([a-zA-Z]+)'\)">\s*([^<{]+)/g;
  const seen = {};
  let m;
  while ((m = re.exec(src))) {
    seen[m[1]] = true;
    assert.ok(expected[m[1]], 'unexpected screen key: ' + m[1]);
    assert.ok(m[2].trim().indexOf(expected[m[1]]) === 0,
      m[1] + ' row text does not start with its destination name: ' + JSON.stringify(m[2]));
  }
  Object.keys(expected).forEach(function (key) {
    assert.ok(seen[key], 'missing drill-in row for ' + key);
  });
});

test('every live preview strip carries aria-hidden="true"', function () {
  const src = settingsSrc();
  const strips = src.match(/class="srow surface-preview"[^>]*/g) || [];
  assert.equal(strips.length, 3, 'expected one preview strip per player surface');
  strips.forEach(function (tag) {
    assert.match(tag, /aria-hidden="true"/);
  });
});

/* Extracts the raw markup of one v-if/v-else-if branch keyed on
   ui.appearanceScreen, the same string-inspection technique
   tests/structure.test.js and tests/appearance.test.js already use for
   templates that this harness cannot render. */
function screenBranch(key) {
  const src = settingsSrc();
  const marker = new RegExp('ui\\.appearanceScreen === \'' + key + '\'[\\s\\S]*?</template>');
  const m = src.match(marker);
  assert.ok(m, 'no template branch found for appearanceScreen === ' + key);
  return m[0];
}

test('each of the five top-level Appearance subscreens renders its expected controls', function () {
  const inst = helpers.settingsInstance({ LmsNav: fakeNav() });
  const self = inst.self;

  ['theme', 'colorScheme', 'font', 'progress', 'players'].forEach(function (key) {
    self.ui.appearanceScreen = key;
    assert.equal(self.ui.appearanceScreen, key);
  });

  assert.match(screenBranch('theme'), /v-for="option in themeOptions"/);
  assert.match(screenBranch('theme'), /role="radio"/);

  assert.match(screenBranch('colorScheme'), /v-for="scheme in colorSchemes"/);

  assert.match(screenBranch('font'), /v-for="font in fontOptions"/);

  const progress = screenBranch('progress');
  assert.match(progress, /ui\.miniGaugeStyle/);
  assert.match(progress, /ui\.playerGaugeStyle/);

  const players = screenBranch('players');
  assert.match(players, /openAppearanceScreen\('full'\)/);
  assert.match(players, /openAppearanceScreen\('small'\)/);
  assert.match(players, /openAppearanceScreen\('mini'\)/);
});

test('the Full/Small/Mini player subscreens render Appearance controls for their own surface', function () {
  const full = screenBranch('full');
  assert.match(full, /ui\.fullTheme/);
  assert.match(full, /ui\.fullColorScheme/);
  assert.match(full, /ui\.fullFont/);
  assert.match(full, /ui\.playerPresentation/);
  assert.match(full, /ui\.playerGaugeStyle/);
  assert.match(full, /v-bind="fullPreviewAttrs"/);

  const small = screenBranch('small');
  assert.match(small, /ui\.smallTheme/);
  assert.match(small, /ui\.smallColorScheme/);
  assert.match(small, /ui\.smallFont/);
  assert.match(small, /ui\.playerPosition/);
  assert.match(small, /v-bind="smallPreviewAttrs"/);

  const mini = screenBranch('mini');
  assert.match(mini, /ui\.miniTheme/);
  assert.match(mini, /ui\.miniColorScheme/);
  assert.match(mini, /ui\.miniFont/);
  assert.match(mini, /ui\.miniGaugeStyle/);
  assert.match(mini, /v-bind="miniPreviewAttrs"/);
});

test('per-surface Theme/Colour scheme/Font rows offer "Follow app" first', function () {
  const inst = helpers.settingsInstance({ LmsNav: fakeNav() });
  const self = inst.self;
  assert.equal(self.themeOptionsWithApp[0].key, 'app');
  assert.equal(self.themeOptionsWithApp[0].label, 'Follow app');
  assert.equal(self.colorSchemeOptionsWithApp[0].key, 'app');
  assert.equal(self.fontOptionsWithApp[0].key, 'app');
  /* Followed by the same lists the app level uses, in the same order. */
  assert.deepEqual(self.themeOptionsWithApp.slice(1).map(function (o) { return o.key; }),
    self.themeOptions.map(function (o) { return o.key; }));
  assert.deepEqual(self.colorSchemeOptionsWithApp.slice(1).map(function (o) { return o.key; }),
    self.colorSchemes.map(function (o) { return o.key; }));
  assert.deepEqual(self.fontOptionsWithApp.slice(1).map(function (o) { return o.key; }),
    self.fontOptions.map(function (o) { return o.key; }));
});

test('a Player layout row reads "Follow app" when a surface\'s three keys are "app", "Custom" otherwise', function () {
  const inst = helpers.settingsInstance({ LmsNav: fakeNav() });
  const self = inst.self;

  ['full', 'small', 'mini'].forEach(function (surface) {
    assert.equal(self.surfaceStatusLabel(surface), 'Follow app', surface + ' starts following the app');
  });

  self.ui.fullTheme = 'dark';
  assert.equal(self.surfaceStatusLabel('full'), 'Custom');
  assert.equal(self.surfaceStatusLabel('small'), 'Follow app');
  assert.equal(self.surfaceStatusLabel('mini'), 'Follow app');
  self.ui.fullTheme = 'app';

  self.ui.smallColorScheme = 'teal';
  assert.equal(self.surfaceStatusLabel('small'), 'Custom');
  self.ui.smallColorScheme = 'app';

  self.ui.miniFont = 'podium';
  assert.equal(self.surfaceStatusLabel('mini'), 'Custom');
  self.ui.miniFont = 'app';
});

test('no Appearance label is assembled by concatenating a translated fragment', function () {
  const src = settingsSrc();
  const body = src.split('appearanceScreenLabel: function')[1].split('},')[0];
  assert.doesNotMatch(body, /\+/, 'appearanceScreenLabel concatenates instead of returning a whole literal');
  const themeSummaryBody = src.split('themeSummary: function')[1].split(',\n')[0];
  assert.doesNotMatch(themeSummaryBody, /\+/);
  const statusBody = src.split('surfaceStatusLabel: function')[1].split('},')[0];
  assert.doesNotMatch(statusBody, /\+/);
});

/* N-defect fix (3.2.6b): ui.appearanceScreen must be reconciled from
   LmsNav.top('settings') at every mount, not just on the next stack-length
   change -- the watch handler is factored into syncAppearanceScreen()
   precisely so this is callable and testable without a real Vue instance and
   its immediate:true timing. This exercises the reconciliation function
   itself across the stack shapes a remount can find: empty, one frame,
   deeper than one frame, and a stack mutated directly (standing in for a pop
   that resolved while the component was unmounted, since there is no
   watcher listening either way -- syncAppearanceScreen does not care how the
   stack got that way, only what is on top of it now). It does NOT exercise
   Vue's watch/immediate wiring itself or the async popstate timing window;
   that would need a real Vue component instance and is not covered here. */
test('syncAppearanceScreen reconciles ui.appearanceScreen from LmsNav.top("settings") in any stack shape', function () {
  const nav = fakeNav();
  const inst = helpers.settingsInstance({ LmsNav: nav });
  const self = inst.self;

  // Empty stack -> null, regardless of a stale prior value.
  self.ui.appearanceScreen = 'full';
  self.syncAppearanceScreen();
  assert.equal(self.ui.appearanceScreen, null);

  // One frame -> that frame's screen.
  nav.push('settings', { label: 'Theme', screen: 'theme' });
  self.syncAppearanceScreen();
  assert.equal(self.ui.appearanceScreen, 'theme');

  // Pushed deeper (drill-in from theme to a nested screen) -> the new top,
  // not the frame appearanceScreen last observed.
  nav.push('settings', { label: 'Full player', screen: 'full' });
  self.syncAppearanceScreen();
  assert.equal(self.ui.appearanceScreen, 'full');

  // Stack mutated directly -- e.g. nav.js's popstate handler splicing the
  // stack while lms-settings was unmounted and no watcher was listening.
  // syncAppearanceScreen must still land on whatever is on top when it is
  // next called (here: emptied back to the single 'players' frame).
  nav.stacks.settings.length = 0;
  nav.push('settings', { label: 'Player layout', screen: 'players' });
  self.syncAppearanceScreen();
  assert.equal(self.ui.appearanceScreen, 'players');

  // And a stack emptied entirely by that same kind of external mutation.
  nav.stacks.settings.length = 0;
  self.syncAppearanceScreen();
  assert.equal(self.ui.appearanceScreen, null);
});

test('the app-level Theme control calls LmsUi.toggleTheme and never assigns state.dark directly', function () {
  const src = settingsSrc();
  /* No assignment to .dark anywhere in the component (comparisons like
     ui.dark === 'x' or ternaries reading it are fine; `.dark =` is not). */
  assert.doesNotMatch(src, /\.dark\s*=[^=]/);

  let calls = 0;
  const inst = helpers.settingsInstance({ LmsNav: fakeNav() });
  const self = inst.self;
  const realToggle = inst.ctx.LmsUi.toggleTheme;
  inst.ctx.LmsUi.toggleTheme = function () { calls++; return realToggle.apply(this, arguments); };

  self.ui.dark = false;
  self.selectTheme('light');
  assert.equal(calls, 0, 'selecting the theme already in effect must not toggle');
  self.selectTheme('dark');
  assert.equal(calls, 1);
  assert.equal(self.ui.dark, true);
  self.selectTheme('dark');
  assert.equal(calls, 1, 'selecting the theme already in effect must not toggle');
});
