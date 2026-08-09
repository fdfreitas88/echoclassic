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

test('the General group does not contain the dark-theme switch; Appearance does, as a single inline toggle', function () {
  const src = settingsSrc();
  const generalBlock = src.split('<div class="sgh">General</div>')[1].split('<div class="sgh">')[0];
  assert.doesNotMatch(generalBlock, /aria-label="Dark theme"/);
  assert.match(generalBlock, /Rate and bits in the bottom bar/);
  assert.match(generalBlock, /Highlight hi-res/);

  /* C5: Appearance is inline now -- one role="switch" driving toggleTheme,
     not a drill-in row into a Theme subscreen. */
  const appearanceBlock = src.split('<div class="sgh">Appearance</div>')[1].split('<div class="sgh">')[0];
  const darkSwitches = appearanceBlock.match(/aria-label="Dark theme"/g) || [];
  assert.equal(darkSwitches.length, 1);
  assert.match(appearanceBlock, /role="switch"[\s\S]{0,200}@click="toggleTheme"/);
});

test('every Appearance drill-in row is a type="button" with a name for its destination', function () {
  const src = settingsSrc();
  /* C5 (3.2.6c): theme/colorScheme/font/progress died as drill-ins -- they
     are inline controls now (a switch, a swatch row, five checkmark rows).
     C6 (3.2.6c) folds full/small/mini into the single 'players' screen too --
     "Player layout" is the ONLY drill-in left anywhere in Settings; there is
     no deeper navigation from it. */
  const expected = {
    players: 'Player layout'
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

/* Extracts the raw markup of the v-if branch keyed on ui.appearanceScreen,
   the same string-inspection technique tests/structure.test.js and
   tests/appearance.test.js already use for templates that this harness
   cannot render. C6 folds the whole appearanceScreen branch into one screen
   ('players') that itself nests <template v-if="!fullFollowsApp"> etc. for
   its own conditional rows -- matching up to the first </template> (as this
   helper did through C5, when full/small/mini were still separate
   v-else-if branches) would stop at the FIRST of those inner closing tags
   instead of the branch's own. tests/appearance.test.js's
   appearanceDetailClasses() already anchors the end of the whole
   appearanceScreen branch on the next top-level screen's opening tag; this
   reuses the same reliable sentinel rather than counting nested tags. */
function screenBranch(key) {
  const src = settingsSrc();
  const marker = new RegExp('ui\\.appearanceScreen === \'' + key + '\'');
  const start = src.search(marker);
  assert.ok(start >= 0, 'no template branch found for appearanceScreen === ' + key);
  const end = src.indexOf('<div v-else class="settings">', start);
  assert.ok(end > start, 'could not find the end of the appearanceScreen branch');
  return src.slice(start, end);
}

/* C5 (3.2.6c): the four app-level subscreens (theme, colorScheme, font,
   progress) died. Their controls are inline in the main Settings screen now
   -- this replaces the old test that drove ui.appearanceScreen through all
   five and asserted a v-if/v-else-if branch for each. 'players' is the only
   appearanceScreen value the app-level Appearance group still routes to. */
test('theme/colorScheme/font/progress no longer exist as appearanceScreen branches, and neither do full/small/mini (C6: one Player layout screen)', function () {
  const src = settingsSrc();
  ['theme', 'colorScheme', 'font', 'progress', 'full', 'small', 'mini'].forEach(function (key) {
    const marker = new RegExp('ui\\.appearanceScreen === \'' + key + '\'');
    assert.doesNotMatch(src, marker, key + ': branch should have been deleted');
  });
  /* Only one v-if/v-else-if branch keyed on ui.appearanceScreen remains at
     all -- confirmed by the fact that screenBranch('players'), which matches
     up to the FIRST </template>, contains every player section: if full/
     small/mini were still separate branches after 'players', the marker
     above would already have failed, but this also guards against a v-if
     that reopened without the string 'ui.appearanceScreen ==='. */
  assert.equal((src.match(/ui\.appearanceScreen ===/g) || []).length, 1);

  const inst = helpers.settingsInstance({ LmsNav: fakeNav() });
  const self = inst.self;
  self.ui.appearanceScreen = 'players';
  assert.equal(self.ui.appearanceScreen, 'players');

  /* No openAppearanceScreen call survives anywhere inside the players
     branch -- there is nowhere deeper to drill into. */
  const players = screenBranch('players');
  assert.doesNotMatch(players, /openAppearanceScreen/);
  assert.match(players, /Full player/);
  assert.match(players, /Small player/);
  assert.match(players, /Mini player/);
});

test('the inline Appearance group renders the Dark theme switch, the Accent colour swatch row and the Font checkmark rows', function () {
  const src = settingsSrc();
  const appearanceBlock = src.split('<div class="sgh">Appearance</div>')[1].split('<div class="sgh">')[0];

  // Dark theme: a real switch, not a two-option radiogroup.
  assert.match(appearanceBlock, /role="switch"[\s\S]{0,200}@click="toggleTheme"/);

  // Accent colour: 5 dots in their own radiogroup, aria-label per swatch.
  assert.match(appearanceBlock, /role="radiogroup" aria-label="Accent colour"/);
  assert.match(appearanceBlock, /v-for="scheme in colorSchemes"/);
  assert.match(appearanceBlock, /class="swatch-dot"/);
  assert.match(appearanceBlock, /:aria-label="tr\(scheme\.label\)"/);

  // Font: the five-option checkmark radiogroup, same pattern as before,
  // just no longer behind a drill-in.
  assert.match(appearanceBlock, /role="radiogroup" aria-label="Font"/);
  assert.match(appearanceBlock, /v-for="font in fontOptions"/);

  // Player layout is the one drill-in left.
  assert.match(appearanceBlock, /openAppearanceScreen\('players'\)/);
});

test('the single Player layout screen renders Appearance controls for all three surfaces', function () {
  const players = screenBranch('players');
  assert.match(players, /ui\.fullTheme/);
  assert.match(players, /ui\.fullColorScheme/);
  assert.match(players, /ui\.fullFont/);
  assert.match(players, /ui\.playerPresentation/);
  assert.match(players, /ui\.playerGaugeStyle/);
  assert.match(players, /v-bind="fullPreviewAttrs"/);

  assert.match(players, /ui\.smallTheme/);
  assert.match(players, /ui\.smallColorScheme/);
  assert.match(players, /ui\.smallFont/);
  assert.match(players, /ui\.playerPosition/);
  assert.match(players, /v-bind="smallPreviewAttrs"/);
  /* D-2 (phase2-decisions.md): the small player has no gauge of its own --
     Full's Progress bar rows restyle it too, so Small's own section must not
     invent one. */
  assert.doesNotMatch(players.split('Small player')[1].split('Mini player')[0], /playerGaugeStyle|playerGaugeColor/);

  assert.match(players, /ui\.miniTheme/);
  assert.match(players, /ui\.miniColorScheme/);
  assert.match(players, /ui\.miniFont/);
  assert.match(players, /ui\.miniGaugeStyle/);
  assert.match(players, /v-bind="miniPreviewAttrs"/);

  /* "Show previews" gates all three preview strips, off by default -- and is
     genuinely a toggle, not a third value smuggled onto ui.appearanceScreen. */
  assert.match(players, /showPreviews = !showPreviews/);
});

/* N1 (audit): zero <select> elements anywhere in Settings -- the two gauge-
   colour pickers (mini/full player colour) are Bar colour swatch rows now,
   the same .swatch-row/.swatch-dot pattern the app-level Accent colour and
   the per-surface Accent rows use. */
test('N1: no <select> element remains anywhere in lms-settings', function () {
  const src = settingsSrc();
  assert.doesNotMatch(src, /<select/);
  assert.doesNotMatch(src, /class="setting-select/);
});

/* N4 (audit): "Match app appearance" ON writes 'app' to all three of that
   surface's keys and leaves the other two surfaces alone; OFF seeds the
   three keys from the app's own currently resolved values, not a hard-coded
   default -- confirmed here against the real LmsUi (setFullFollowsApp etc.
   are thin one-line wrappers around LmsUi.setSurfaceFollowsApp, so this also
   exercises ui.js's half of the contract, not just the wiring). */
test('N4: Match app appearance ON resets to \'app\', OFF seeds from the app\'s resolved values, one surface at a time', function () {
  const inst = helpers.settingsInstance({ LmsNav: fakeNav() });
  const self = inst.self;
  const ui = self.ui;

  assert.equal(self.fullFollowsApp, true);
  assert.equal(self.smallFollowsApp, true);
  assert.equal(self.miniFollowsApp, true);

  ui.dark = true;
  ui.colorScheme = 'crimson';
  ui.fontFamily = 'espy';

  self.setFullFollowsApp(false);
  assert.equal(ui.fullTheme, 'dark');
  assert.equal(ui.fullColorScheme, 'crimson');
  assert.equal(ui.fullFont, 'espy');
  assert.equal(self.fullFollowsApp, false);
  /* Only the surface just toggled moves. */
  assert.equal(self.smallFollowsApp, true);
  assert.equal(self.miniFollowsApp, true);
  assert.equal(ui.smallTheme, 'app');
  assert.equal(ui.miniTheme, 'app');

  /* The app changes AFTER the seed -- the full player keeps its own custom
     values; it does not track the app live while Match app appearance is off. */
  ui.dark = false;
  ui.colorScheme = 'teal';
  assert.equal(ui.fullTheme, 'dark');
  assert.equal(ui.fullColorScheme, 'crimson');

  self.setFullFollowsApp(true);
  assert.equal(ui.fullTheme, 'app');
  assert.equal(ui.fullColorScheme, 'app');
  assert.equal(ui.fullFont, 'app');
  assert.equal(self.fullFollowsApp, true);

  /* OFF -> ON -> OFF is idempotent: seeding from the (now different) app
     values again reflects what the app resolves to NOW, not the values from
     the first OFF above. */
  self.setSmallFollowsApp(false);
  assert.equal(ui.smallTheme, 'light');
  assert.equal(ui.smallColorScheme, 'teal');
  self.setSmallFollowsApp(true);
  self.setSmallFollowsApp(false);
  assert.equal(ui.smallTheme, 'light');
  assert.equal(ui.smallColorScheme, 'teal');

  self.setMiniFollowsApp(false);
  assert.equal(ui.miniTheme, 'light');
  assert.equal(ui.miniColorScheme, 'teal');
  assert.equal(ui.miniFont, 'espy');
});

/* N5 (audit): every segmented control in the Player layout screen is a real
   role="radiogroup" wrapping role="radio" buttons, wired through the shared
   radioKey keyboard handler -- the same contract the pre-existing gauge-style
   segmented controls already met, now generalised (.gauge-segmented ->
   .segmented) to Presentation/Position/Theme as well. */
test('N5: every .segmented control in the players screen is a radiogroup wired to radioKey', function () {
  const players = screenBranch('players');
  const groups = players.match(/<div class="segmented" role="radiogroup"[\s\S]*?<\/div>\s*<\/div>/g) || [];
  assert.ok(groups.length >= 7, 'expected at least 7 segmented controls (Presentation, Position, 3x Theme, 2x Progress bar)');
  groups.forEach(function (group) {
    assert.match(group, /role="radio"/);
    assert.match(group, /@keydown="radioKey\(/);
    assert.match(group, /aria-checked=/);
    assert.match(group, /:tabindex=/);
  });
});

test('no Appearance label is assembled by concatenating a translated fragment', function () {
  const src = settingsSrc();
  /* appearanceScreenLabel MUST SURVIVE C6 even though it shrank to one entry
     (players) -- this split-on-name technique is the regression net i18n-ui
     relies on to know the method is still there and still returns a whole
     literal. surfaceStatusLabel (its 'Follow app'/'Custom' summary) died in
     C6 along with the full/small/mini drill-ins it used to label -- the
     Player layout screen shows every surface's controls directly now,
     nothing left to summarise. */
  const body = src.split('appearanceScreenLabel: function')[1].split('},')[0];
  assert.doesNotMatch(body, /\+/, 'appearanceScreenLabel concatenates instead of returning a whole literal');
  assert.doesNotMatch(src, /surfaceStatusLabel/, 'surfaceStatusLabel should have been deleted in C6');
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

test('Advanced LMS settings iframe receives Echo Classic theme tokens and CSS on load', function () {
  const nodes = {};
  const htmlAttrs = {};
  const bodyAttrs = {};
  const copied = {};
  const doc = {
    head: {
      appendChild: function (node) {
        nodes[node.id] = node;
      }
    },
    body: {
      setAttribute: function (key, value) { bodyAttrs[key] = value; },
      getAttribute: function (key) { return bodyAttrs[key]; }
    },
    documentElement: {
      style: { setProperty: function (key, value) { copied[key] = value; } },
      setAttribute: function (key, value) { htmlAttrs[key] = value; }
    },
    getElementById: function (id) { return nodes[id] || null; },
    createElement: function (tag) { return { tagName: tag.toUpperCase(), textContent: '' }; }
  };
  const tokens = {
    '--accent': '#33B5FF',
    '--accent-ink': '#000',
    '--group-page': '#000',
    '--group-bg': '#101012',
    '--text': '#fff',
    '--app-font': 'Geneva,Verdana,sans-serif'
  };
  const inst = helpers.settingsInstance({
    LmsNav: fakeNav(),
    getComputedStyle: function () {
      return { getPropertyValue: function (key) { return tokens[key] || ''; } };
    }
  });
  const self = inst.self;
  self.ui.dark = true;
  self.ui.colorScheme = 'blue';
  self.ui.fontFamily = 'podium';
  self.$refs.advancedFrame = { contentDocument: doc };

  assert.equal(self.themeAdvancedFrame(), true);
  assert.equal(copied['--accent'], '#33B5FF');
  assert.equal(copied['--app-font'], 'Geneva,Verdana,sans-serif');
  assert.equal(htmlAttrs['data-echoclassic-theme'], 'dark');
  assert.equal(htmlAttrs['data-echoclassic-scheme'], 'blue');
  assert.equal(htmlAttrs['data-echoclassic-font'], 'podium');
  assert.equal(bodyAttrs['data-echoclassic-page'], 'advanced-settings');
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('body> #header') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('#settingsTabs') >= 0);
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
