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

function uiSrc() {
  return helpers.read('EchoClassic/HTML/echoclassic/html/js/ui.js');
}

/* A LmsNav double with a real backing array, so push/top behave like the
   real module for the one stack ('settings') these tests touch. */
function fakeNav() {
  const settings = [];
  return {
    stacks: { settings: settings },
    push: function (tab, frame) { settings.push(frame); },
    pop: function (tab) { return settings.length ? settings.pop() : null; },
    back: function (tab) { return settings.length ? settings.pop() : null; },
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

test('the General group does not contain theme controls; Appearance does inline', function () {
  const src = settingsSrc();
  const generalBlock = src.split('<div class="sgh">General</div>')[1].split('<div class="sgh">')[0];
  assert.doesNotMatch(generalBlock, /aria-label="Dark theme"/);
  assert.doesNotMatch(generalBlock, /aria-label="Theme"/);
  assert.match(generalBlock, /Rate and bits in the bottom bar/);
  assert.match(generalBlock, /Highlight hi-res/);

  const appearanceBlock = src.split('<div class="sgh">Appearance</div>')[1].split('<div class="sgh">Queue</div>')[0];
  assert.match(appearanceBlock, /role="radiogroup" aria-label="Theme"/);
  assert.match(appearanceBlock, /@click="selectTheme\(option\.key\)"/);
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

test('the inline Appearance group renders Theme, Accent colour and Font controls', function () {
  const src = settingsSrc();
  const appearanceBlock = src.split('<div class="sgh">Appearance</div>')[1].split('<div class="sgh">Queue</div>')[0];

  assert.match(appearanceBlock, /role="radiogroup" aria-label="Theme"/);
  assert.match(appearanceBlock, /v-for="option in themeOptions"/);
  assert.match(appearanceBlock, /ui\.theme === option\.key/);
  assert.match(appearanceBlock, /@click="selectTheme\(option\.key\)"/);

  assert.match(appearanceBlock, /role="radiogroup" aria-label="Accent colour"/);
  assert.match(appearanceBlock, /v-for="scheme in colorSchemes"/);
  assert.match(appearanceBlock, /class="swatch-dot"/);
  assert.match(appearanceBlock, /:aria-label="tr\(scheme\.label\)"/);

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

  ui.theme = 'dark';
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
  ui.theme = 'light';
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

test('Advanced LMS settings joins the Settings nav stack and restores the list scroll on return', function () {
  const nav = fakeNav();
  const inst = helpers.settingsInstance({ LmsNav: nav });
  const self = inst.self;
  self.$el = { scrollTop: 1414 };

  self.openAdvanced();
  assert.equal(nav.top('settings').advanced, true);
  assert.equal(nav.top('settings').label, 'Advanced LMS settings');
  assert.equal(self.ui.advancedSettings, true);
  assert.equal(self.ui.appearanceScreen, null);
  assert.equal(self.settingsReturnScroll, 1414);
  assert.equal(self.$el.scrollTop, 0, 'the iframe screen starts at the top');

  nav.pop('settings');
  self.syncSettingsScreen();
  assert.equal(self.ui.advancedSettings, false);
  assert.equal(self.ui.appearanceScreen, null);
  assert.equal(self.$el.scrollTop, 1414, 'returning to Settings restores the row that opened Advanced');
});

test('Player layout starts at the top and restores the Settings scroll on return', function () {
  const nav = fakeNav();
  const inst = helpers.settingsInstance({ LmsNav: nav });
  const self = inst.self;
  self.$el = { scrollTop: 187 };

  self.openAppearanceScreen('players');
  assert.equal(nav.top('settings').screen, 'players');
  assert.equal(self.appearanceReturnScroll, 187);
  assert.equal(self.$el.scrollTop, 0, 'Player layout must expose its first control');

  nav.pop('settings');
  self.syncSettingsScreen();
  assert.equal(self.ui.appearanceScreen, null);
  assert.equal(self.$el.scrollTop, 187, 'Back restores the Settings position');
});

test('Advanced LMS settings relies on the app navbar, not a duplicate inner settings bar', function () {
  const src = settingsSrc();
  const branch = src.slice(
    src.indexOf('<div v-if="ui.advancedSettings"'),
    src.indexOf('<div v-else-if="ui.appearanceScreen"')
  );
  assert.match(branch, /<iframe ref="advancedFrame"/);
  assert.match(branch, /src="\/echoclassic\/settings\/server\/basic\.html"/);
  assert.doesNotMatch(branch, /advanced-settings-toolbar/);
  assert.doesNotMatch(branch, /advancedBack/);
  assert.doesNotMatch(branch, />\s*LMS settings\s*</);
  assert.match(branch, /title="" aria-label="Advanced LMS settings"/);
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
  self.ui.theme = 'dark';
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
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('#header,#headerWrapper') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('#settingsTabs') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('#echoclassic-advanced-rail') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('.ec-rail-search') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('.ec-lms-chrome-hidden{display:none') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('#topGraphicBox,#echoclassic-advanced-hero{display:none') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('#pluginButtonBar') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('#pluginListPanel') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('.ec-plugin-search') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('.ec-plugin-switch-hit') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('background:var(--sw-on)') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('ul.tabs,.tabs,#tabs,#settingsTabs,#choose_setting{display:none') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('background:var(--group-page)') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('form>table:not(.tabs):not(#tabs):not(#settingsTabs)') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('background:var(--group-bg)!important') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('.settingSection') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('.settingGroup') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('.prefHead') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('#choose_setting') >= 0);
  assert.ok(nodes['echoclassic-advanced-theme'].textContent.indexOf('#saveSettings') >= 0);
  assert.equal(nodes['echoclassic-advanced-theme'].textContent.indexOf('ul.tabs,.tabs,#tabs,#settingsTabs{display:flex'), -1);
  assert.equal(nodes['echoclassic-advanced-theme'].textContent.indexOf('ul.tabs li,.tabs li,#tabs li,#settingsTabs li{display:block'), -1);
});

test('Advanced LMS settings uses a Material-style iframe controller over the real LMS form', function () {
  const src = settingsSrc();
  assert.match(src, /installAdvancedLinkController/);
  assert.match(src, /installAdvancedDirtyTracking/);
  assert.match(src, /installAdvancedSectionController/);
  assert.match(src, /installAdvancedExpanders/);
  assert.match(src, /normalizeAdvancedLabels/);
  assert.match(src, /buildAdvancedIpadShell/);
  assert.match(src, /hideAdvancedLmsChrome/);
  assert.match(src, /advancedBuildRailRow/);
  assert.match(src, /enhanceAdvancedFrame\(frame, doc\)/);
  assert.doesNotMatch(src, /this\.adaptAdvancedFrame\(doc\)/);
});

test('Advanced LMS settings exposes an App Store plugin pane and bridges navbar Save to the real form', function () {
  const settings = settingsSrc();
  const navbar = helpers.read('EchoClassic/HTML/echoclassic/html/js/chrome/navbar.js');
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(settings, /id = 'echoclassic-advanced-rail'/);
  assert.match(settings, /placeholder="Search settings pages"/);
  assert.match(settings, /oldHero[\s\S]*removeChild\(oldHero\)/);
  assert.match(settings, /advancedIsPluginStore/);
  assert.match(settings, /enhanceNativePluginStore/);
  assert.match(settings, /if \(pluginStore\) this\.enhanceNativePluginStore\(doc\)/);
  assert.match(settings, /#topGraphicBox,#echoclassic-advanced-hero\{display:none/);
  assert.match(settings, /\.ec-plugin-store #homeMenu\{display:block/);
  assert.match(settings, /doc\.getElementById\('filterInput'\)/);
  assert.match(settings, /bar\.querySelector\('#filterChooser select'\)/);
  assert.match(settings, /#pluginListPanel li\.thumbwrap\.selectorMarker/);
  assert.match(settings, /#settingsForm input,#settingsForm textarea,#settingsForm select/);
  assert.doesNotMatch(settings, /candidateAdvancedPluginRows|parseAdvancedPluginRow|renderAdvancedPluginCard|buildAdvancedPluginStore|removeAdvancedPluginStore/);
  assert.doesNotMatch(settings, /echoclassic-plugin-store-tools|echoclassic-plugin-store-grid/);
  assert.doesNotMatch(settings, /ec-rail-mic/);
  assert.match(settings, /self\.advancedClosest\(input, '#echoclassic-advanced-rail'\)/);
  assert.match(settings, /hideAdvancedLmsChrome\(doc, root\)/);
  assert.match(settings, /server settings\$/i);
  assert.match(settings, /selector\.value = option\.value[\s\S]*advancedDispatchChange\(doc, selector\)/);
  assert.match(settings, /querySelector\('#saveSettings,#save,input\[type="submit"\],button\[type="submit"\]'\)/);
  assert.match(navbar, /v-if="ui\.advancedSettings" class="nav-apply pointer"[\s\S]*Save/);
  assert.match(navbar, /applyAdvanced: function \(\) \{[\s\S]*LmsUi\.applyAdvancedSettings/);
  assert.match(css, /\.navbar \.nav-apply/);
});

test('Advanced LMS settings search is one scoped control with a clear action and AA focus ring', function () {
  const settings = settingsSrc();
  assert.match(settings, /aria-label="Search settings pages"/);
  assert.match(settings, /aria-label="Clear settings search"/);
  assert.match(settings, /\.ec-rail-search:focus-within\{outline:3px solid var\(--accent\)/);
  assert.match(settings, /#echoclassic-advanced-rail \.ec-rail-search input\[type="search"\][\s\S]*border:0!important[\s\S]*border-radius:0!important/);
  assert.match(settings, /search\.value = ''[\s\S]*search\.focus\(\)/);
});

test('native Advanced LMS checkboxes keep submission wiring but gain labels and skin switches', function () {
  const settings = settingsSrc();
  assert.match(settings, /decorateAdvancedCheckboxes: function/);
  assert.match(settings, /input\.setAttribute\('aria-label', self\.advancedCheckboxName\(doc, input\)\)/);
  assert.match(settings, /input\.classList\.add\('ec-native-checkbox'\)/);
  assert.match(settings, /hit\.setAttribute\('for', input\.id\)/);
  assert.match(settings, /\.ec-native-switch-hit\{box-sizing:border-box;display:inline-flex!important;width:44px;height:44px/);
  assert.match(settings, /input\.ec-native-checkbox:focus-visible\+\.ec-native-switch-hit \.ec-native-switch\{outline:3px/);
  assert.match(settings, /this\.decorateAdvancedCheckboxes\(doc\)/);
});

test('Advanced LMS has one primary Save action and a responsive settings drawer', function () {
  const settings = settingsSrc();
  assert.match(settings, /body:not\(\.ec-plugin-store\) #prefsSubmit\{display:none!important/);
  assert.match(settings, /\.ec-plugin-store #prefsSubmit #saveSettings[\s\S]*display:none!important/);
  assert.match(settings, /id = 'echoclassic-rail-toggle'/);
  assert.match(settings, /aria-controls', 'echoclassic-advanced-rail'/);
  assert.match(settings, /body\.classList\.toggle\('ec-rail-open', open\)/);
  assert.match(settings, /drawerSearch[\s\S]*drawerSearch\.focus\(\)/);
  assert.match(settings, /doc\.__echoclassicRailKeyboard[\s\S]*event\.key !== 'Escape'[\s\S]*toggle\.focus\(\)/);
  assert.match(settings, /@media \(max-width:860px\)[\s\S]*body\.ec-rail-open #echoclassic-advanced-rail\{transform:translateX\(0\)/);
});

test('Manage Plugins defaults to Active on narrow frames without removing native rows', function () {
  const settings = settingsSrc();
  assert.match(settings, /doc\.defaultView && doc\.defaultView\.innerWidth <= 860 \? 'active' : 'all'/);
  assert.match(settings, /menu\.setAttribute\('data-ec-plugin-filter', initialMode\)/);
  assert.match(settings, /row\.classList\.toggle\('ec-plugin-filtered'/);
  assert.doesNotMatch(settings, /removeChild\(row\)/);
});

test('plugin switches preserve native checkboxes and use the skin switch tokens', function () {
  const settings = settingsSrc();
  assert.match(settings, /position:absolute!important;opacity:0!important;pointer-events:none!important/);
  assert.doesNotMatch(settings, /ec-plugin-card input\[type="checkbox"\][^']*display:none/);
  assert.match(settings, /input\[type="checkbox"\]:checked~\.ec-plugin-switch-hit \.ec-plugin-switch\{background:var\(--sw-on\)/);
  assert.match(settings, /input\[type="checkbox"\]:focus-visible~\.ec-plugin-switch-hit \.ec-plugin-switch/);
  assert.match(settings, /\.ec-plugin-switch-hit\{display:flex;width:44px;height:44px/);
  assert.match(settings, /\.ec-plugin-switch\{box-sizing:border-box;position:relative;display:block;width:44px;height:26px/);
  assert.match(settings, /checkbox\.addEventListener\('change'/);
  assert.match(settings, /group\.appendChild\(row\)/);
});

test('plugin metadata parsing separates the LMS version suffix and keeps stable initials', function () {
  const self = helpers.settingsInstance().self;
  const echo = self.advancedPluginLabel('Echo Classic (v3.2.8)');
  const cd = self.advancedPluginLabel('CDplayer (v1.11)');
  assert.equal(echo.name, 'Echo Classic');
  assert.equal(echo.version, '3.2.8');
  assert.equal(cd.name, 'CDplayer');
  assert.equal(cd.version, '1.11');
  assert.equal(self.pluginIconText('Advanced Tag View'), 'AT');
  assert.equal(self.pluginIconText('Qobuz'), 'QO');
  assert.equal(self.advancedPluginTone('EchoClassic'), self.advancedPluginTone('EchoClassic'));
  assert.ok(self.advancedPluginTone('EchoClassic') >= 0 && self.advancedPluginTone('EchoClassic') < 6);
});

test('plugin status and search filters update counts and empty group bands', function () {
  const self = helpers.settingsInstance().self;
  function classList() {
    const values = new Set();
    return {
      contains: function (value) { return values.has(value); },
      toggle: function (value, on) { if (on) values.add(value); else values.delete(value); },
      add: function (value) { values.add(value); }
    };
  }
  function row(checked, label) {
    const attrs = { 'data-ec-plugin-label': label };
    return {
      classList: classList(),
      querySelector: function () { return { checked: checked }; },
      getAttribute: function (key) { return attrs[key] || ''; },
      setAttribute: function (key, value) { attrs[key] = value; }
    };
  }
  const rows = [row(true, 'echo classic felipe freitas'), row(false, 'qobuz lyrion community')];
  const menu = {
    getAttribute: function () { return 'active'; }
  };
  const count = { textContent: '' };
  const activeHolder = { classList: classList() };
  const inactiveHolder = { classList: classList() };
  const activeHeader = { textContent: '', parentNode: activeHolder };
  const inactiveHeader = { textContent: '', parentNode: inactiveHolder };
  const activeList = { classList: classList() };
  const inactiveList = { classList: classList() };
  const nodes = {
    homeMenu: menu,
    filterInput: { value: '' },
    activePlugins_Header: activeHeader,
    inactivePlugins_Header: inactiveHeader,
    activePlugins: activeList,
    inactivePlugins: inactiveList
  };
  const doc = {
    defaultView: { getComputedStyle: function () { return { display: 'block' }; } },
    getElementById: function (id) { return nodes[id] || null; },
    querySelectorAll: function () { return rows; },
    querySelector: function () { return count; }
  };

  self.applyAdvancedPluginFilters(doc);
  assert.equal(count.textContent, '2 plugins · 1 active');
  assert.equal(rows[0].classList.contains('ec-plugin-filtered'), false);
  assert.equal(rows[1].classList.contains('ec-plugin-filtered'), true);
  assert.equal(activeHeader.textContent, 'Active · 1');
  assert.equal(inactiveHeader.textContent, 'Inactive · 1');
  assert.equal(inactiveHolder.classList.contains('ec-plugin-band-empty'), true);
});

test('Player layout explains inherited controls and gives touch controls 44px hit areas', function () {
  const settings = settingsSrc();
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.equal((settings.match(/Uses the app theme, accent and font\./g) || []).length, 3);
  assert.match(css, /\.sw\{width:44px;height:44px/);
  assert.match(css, /\.swatch-dot\{width:44px;height:44px/);
  assert.match(css, /\.swatch-dot::before[\s\S]*width:28px;height:28px/);
  assert.match(settings, /input\[type="checkbox"\],input\[type="radio"\]\{width:24px;height:24px/);
  assert.match(settings, /button,input\[type="button"\][\s\S]*min-height:44px/);
});

test('Advanced LMS settings normalizes all-caps server labels without touching mixed-case names', function () {
  const inst = helpers.settingsInstance();
  const self = inst.self;
  function textNode(text) {
    return {
      textContent: text,
      firstChild: { nodeType: 3 },
      childNodes: [{ nodeType: 3 }]
    };
  }
  const nodes = [
    textNode('LANGUAGE'),
    textNode('MEDIA FOLDERS'),
    textNode('SERVER IP ADDRESS'),
    textNode('Media Library Name')
  ];
  self.normalizeAdvancedLabels({
    querySelectorAll: function () { return nodes; }
  });

  assert.equal(nodes[0].textContent, 'Language');
  assert.equal(nodes[1].textContent, 'Media Folders');
  assert.equal(nodes[2].textContent, 'Server IP Address');
  assert.equal(nodes[3].textContent, 'Media Library Name');
});

test('syncSettingsScreen keeps Advanced and Appearance mutually exclusive', function () {
  const nav = fakeNav();
  const inst = helpers.settingsInstance({ LmsNav: nav });
  const self = inst.self;

  nav.push('settings', { label: 'Player layout', screen: 'players' });
  self.syncSettingsScreen();
  assert.equal(self.ui.appearanceScreen, 'players');
  assert.equal(self.ui.advancedSettings, false);

  nav.push('settings', { label: 'Advanced LMS settings', advanced: true });
  self.syncSettingsScreen();
  assert.equal(self.ui.appearanceScreen, null);
  assert.equal(self.ui.advancedSettings, true);
});

test('Escape closes Advanced LMS settings through the Settings navigation stack', function () {
  const src = uiSrc();
  const advancedEscape = src.match(/if \(state\.advancedSettings\) \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?return;[\s\S]*?\n    \}/);
  assert.ok(advancedEscape, 'global Escape handler should special-case Advanced LMS settings');
  assert.match(advancedEscape[0], /LmsNav\.top\('settings'\)[\s\S]*LmsNav\.pop\('settings'\)/);
  assert.doesNotMatch(advancedEscape[0], /LmsNav\.back\('settings'\)/);
  assert.match(advancedEscape[0], /state\.advancedSettings = false/);
});

test('Escape and the active Settings tab also close Player layout', function () {
  const ui = uiSrc();
  const tabbar = helpers.read('EchoClassic/HTML/echoclassic/html/js/chrome/tabbar.js');
  assert.match(ui, /if \(state\.appearanceScreen\) \{[\s\S]*LmsNav\.top\('settings'\)[\s\S]*LmsNav\.pop\('settings'\)/);
  assert.match(tabbar, /if \(this\.ui\.appearanceScreen\) \{[\s\S]*LmsNav\.top\('settings'\)[\s\S]*LmsNav\.pop\('settings'\)/);
  assert.match(tabbar, /this\.ui\.appearanceScreen = null/);
});

test('Advanced LMS settings exits never use browser history-backed LmsNav.back', function () {
  const app = helpers.read('EchoClassic/HTML/echoclassic/html/js/app.js');
  const tabbar = helpers.read('EchoClassic/HTML/echoclassic/html/js/chrome/tabbar.js');
  const settings = settingsSrc();
  assert.match(app, /ui\.tab === 'settings' && this\.ui\.advancedSettings[\s\S]*LmsNav\.pop\('settings'\)/);
  assert.match(tabbar, /ui\.advancedSettings[\s\S]*LmsNav\.pop\('settings'\)/);
  assert.match(settings, /top && top\.advanced[\s\S]*LmsNav\.pop\('settings'\)/);
  assert.doesNotMatch(app, /advancedSettings[\s\S]{0,180}LmsNav\.back\('settings'\)/);
  assert.doesNotMatch(tabbar, /advancedSettings[\s\S]{0,180}LmsNav\.back\('settings'\)/);
  assert.doesNotMatch(settings, /top && top\.advanced[\s\S]{0,140}LmsNav\.back\('settings'\)/);
});

test('the app-level Theme control calls LmsUi.setTheme and never assigns state.dark directly', function () {
  const src = settingsSrc();
  /* No assignment to .dark anywhere in the component (comparisons like
     ui.dark === 'x' or ternaries reading it are fine; `.dark =` is not). */
  assert.doesNotMatch(src, /\.dark\s*=[^=]/);

  let calls = 0;
  const inst = helpers.settingsInstance({ LmsNav: fakeNav() });
  const self = inst.self;
  const realSetTheme = inst.ctx.LmsUi.setTheme;
  inst.ctx.LmsUi.setTheme = function () { calls++; return realSetTheme.apply(this, arguments); };

  self.ui.theme = 'light';
  self.selectTheme('light');
  assert.equal(calls, 0, 'selecting the theme already in effect must not write');
  self.selectTheme('dark');
  assert.equal(calls, 1);
  assert.equal(self.ui.theme, 'dark');
  assert.equal(self.ui.dark, true);
  self.selectTheme('dark');
  assert.equal(calls, 1, 'selecting the theme already in effect must not write');
  self.selectTheme('legacy');
  assert.equal(calls, 2);
  assert.equal(self.ui.theme, 'legacy');
});
