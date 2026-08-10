const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

/* O LmsUi vem do proprio ui.js, e nao de um stub escrito a mao. O stub antigo
   era `{ state: {} }`, sem TABS nem MUSIC_VIEWS -- e no 3.1.2, quando
   validateImportValue deixou de duplicar aqueles enums e passou a ler
   LmsUi.TABS, o stub virou a unica coisa que nao tinha as listas. O teste quebrou
   sem que nada estivesse errado no codigo de producao. */
function settingsHarness(extra) {
  let definition = null;
  const ctx = helpers.uiContext(Object.assign({
    Vue: {
      observable: function (o) { return o; },
      component: function (name, def) { definition = def; },
      nextTick: function (f) { if (f) f(); }
    }
  }, extra || {}));
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/settings.js');
  return { methods: definition.methods, ctx: ctx };
}

function settingsMethods() {
  return settingsHarness().methods;
}

test('settings import validation rejects malformed stored values', function () {
  const methods = settingsMethods();
  const ctx = Object.assign({}, methods);

  assert.equal(methods.validateImportValue.call(ctx, 'echoclassic.ui.v2', JSON.stringify({ tab: 'music' })), null);
  assert.match(methods.validateImportValue.call(ctx, 'echoclassic.ui.v2', JSON.stringify({ tab: 'broken' })), /tab/);
  assert.match(methods.validateImportValue.call(ctx, 'echoclassic.nav.v1', JSON.stringify({ music: 'bad' })), /navigation stack/);
  assert.match(methods.validateImportValue.call(ctx, 'echoclassic.history.v1', JSON.stringify({})), /should be a list/);
  assert.match(methods.validateImportValue.call(ctx, 'echoclassic.session.v2', 'not json'), /is not valid JSON/);
});

/* WP5 / N1 regression: fontFamily/colorScheme used to be literal lists in
   settings.js, duplicated from ui.js. Picking Podium Sans or Espy Sans,
   exporting and reimporting hit those literals and validateImportValue
   rejected the WHOLE FILE with "fontFamily has an incompatible value" -- the
   new fonts existed in ui.js but not in the copy settings.js kept for
   itself. */
test('fontFamily accepts the fonts added after the literal list was written (podium, espy)', function () {
  const harness = settingsHarness();
  const methods = harness.methods;
  const ctx = Object.assign({}, methods);

  assert.equal(methods.validateImportValue.call(ctx, 'echoclassic.ui.v2', JSON.stringify({ fontFamily: 'podium' })), null);
  assert.equal(methods.validateImportValue.call(ctx, 'echoclassic.ui.v2', JSON.stringify({ fontFamily: 'espy' })), null);
});

/* Same regression, proven generically: every key LmsUi.COLOR_SCHEMES/
   LmsUi.FONT_OPTIONS currently knows about must validate, precisely because
   the accepted set is DERIVED from those arrays (settings.js keysOf(...))
   rather than copied into a literal that can fall out of date again. */
test('the accepted colorScheme/fontFamily sets are derived from LmsUi, not a separate literal', function () {
  const harness = settingsHarness();
  const methods = harness.methods;
  const LmsUi = harness.ctx.LmsUi;
  const ctx = Object.assign({}, methods);

  LmsUi.COLOR_SCHEMES.forEach(function (scheme) {
    assert.equal(methods.validateImportValue.call(ctx, 'echoclassic.ui.v2',
      JSON.stringify({ colorScheme: scheme.key })), null, 'colorScheme ' + scheme.key);
  });
  LmsUi.FONT_OPTIONS.forEach(function (font) {
    assert.equal(methods.validateImportValue.call(ctx, 'echoclassic.ui.v2',
      JSON.stringify({ fontFamily: font.key })), null, 'fontFamily ' + font.key);
  });
  assert.match(methods.validateImportValue.call(ctx, 'echoclassic.ui.v2',
    JSON.stringify({ colorScheme: 'no-such-scheme' })), /colorScheme/);
  assert.match(methods.validateImportValue.call(ctx, 'echoclassic.ui.v2',
    JSON.stringify({ fontFamily: 'no-such-font' })), /fontFamily/);
});

test('settings import enum validation stays in parity with ui.js theme, scheme and gauge colour lists', function () {
  const harness = settingsHarness();
  const methods = harness.methods;
  const LmsUi = harness.ctx.LmsUi;
  const ctx = Object.assign({}, methods);

  LmsUi.THEME_OPTIONS.forEach(function (theme) {
    assert.equal(methods.validateImportValue.call(ctx, 'echoclassic.ui.v2',
      JSON.stringify({ theme: theme.key })), null, 'theme ' + theme.key);
  });
  LmsUi.COLOR_SCHEMES.forEach(function (scheme) {
    assert.equal(methods.validateImportValue.call(ctx, 'echoclassic.ui.v2',
      JSON.stringify({ colorScheme: scheme.key, miniGaugeColor: scheme.key, playerGaugeColor: scheme.key })),
      null, 'scheme/gauge ' + scheme.key);
  });
  assert.match(methods.validateImportValue.call(ctx, 'echoclassic.ui.v2',
    JSON.stringify({ theme: 'sepia' })), /theme/);
});

/* A 3.2.5 export simply does not have the nine surface keys -- they did not
   exist yet. It must still validate cleanly: the enum table deliberately
   does not enumerate them (see the next two tests), so their absence is a
   non-event. */
test('a 3.2.5 payload (without the nine surface keys) validates to null', function () {
  const methods = settingsMethods();
  const ctx = Object.assign({}, methods);
  const legacyPayload = {
    tab: 'music', musicView: 'albums', dark: false,
    colorScheme: 'blue', fontFamily: 'system',
    playerPresentation: 'adaptive', playerPosition: 'right',
    miniGaugeStyle: 'flat', playerGaugeStyle: 'flat',
    miniGaugeColor: 'theme', playerGaugeColor: 'theme'
  };
  assert.equal(methods.validateImportValue.call(ctx, 'echoclassic.ui.v2', JSON.stringify(legacyPayload)), null);
});

/* The decision recorded in the WP5 brief: do NOT add the nine surface keys to
   validateImportValue's enum table, because that table aborts the WHOLE
   IMPORT on one bad value and has no per-key fallback. An unknown value in
   one of them must not block the other eight groups from importing. The
   fallback that turns the bad value into 'app' is the read-path coercion
   already in ui.js (isSurfaceTheme/isSurfaceScheme/isSurfaceFont guarding
   state's initial read, ui.js lines ~441-449) -- exercised here end to end:
   import accepts the value, a later load discards it in favour of 'app'. */
test('an unknown value in a surface key does not abort the import, and reads back "app"', function () {
  const methods = settingsMethods();
  const ctx = Object.assign({}, methods);
  const payload = { miniTheme: 'neon', fullColorScheme: 'no-such-scheme', smallFont: 'wingdings' };
  assert.equal(methods.validateImportValue.call(ctx, 'echoclassic.ui.v2', JSON.stringify(payload)), null);

  /* Simulate confirmImport's localStorage.setItem, then a fresh load. */
  const store = { 'echoclassic.ui.v2': JSON.stringify(payload) };
  const reloaded = helpers.uiContext({
    localStorage: {
      getItem: function (k) { return k in store ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    }
  }).LmsUi;
  assert.equal(reloaded.state.miniTheme, 'app');
  assert.equal(reloaded.state.fullColorScheme, 'app');
  assert.equal(reloaded.state.smallFont, 'app');
});

/* Export reads whatever ui.js's own persist() last wrote to
   echoclassic.ui.v2 -- the nine keys are already in that blob (ui.js
   persist(), lines ~494-496), so this is really proof that setting a surface
   override survives the same round trip export/import already relies on. */
test('the persisted echoclassic.ui.v2 blob export reads from contains all nine surface keys', function () {
  const store = {};
  const LmsUi = helpers.uiContext({
    localStorage: {
      getItem: function (k) { return k in store ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    }
  }).LmsUi;

  LmsUi.setSurfaceTheme('mini', 'dark');
  LmsUi.setSurfaceScheme('mini', 'teal');
  LmsUi.setSurfaceFont('mini', 'podium');
  LmsUi.setSurfaceTheme('small', 'light');
  LmsUi.setSurfaceScheme('small', 'amber');
  LmsUi.setSurfaceFont('small', 'chicago');
  LmsUi.setSurfaceTheme('full', 'dark');
  LmsUi.setSurfaceScheme('full', 'indigo');
  LmsUi.setSurfaceFont('full', 'espy');

  const blob = JSON.parse(store['echoclassic.ui.v2']);
  ['miniTheme', 'miniColorScheme', 'miniFont',
   'smallTheme', 'smallColorScheme', 'smallFont',
   'fullTheme', 'fullColorScheme', 'fullFont'].forEach(function (key) {
    assert.ok(Object.prototype.hasOwnProperty.call(blob, key), 'missing key: ' + key);
  });
  assert.equal(blob.miniTheme, 'dark');
  assert.equal(blob.fullFont, 'espy');
});

test('legacy theme with silver and black accents survives preferences validation and readback', function () {
  const methods = settingsMethods();
  const ctx = Object.assign({}, methods);
  const payload = {
    theme: 'legacy',
    colorScheme: 'silver',
    miniTheme: 'legacy',
    smallTheme: 'legacy',
    fullTheme: 'legacy',
    miniColorScheme: 'black',
    smallColorScheme: 'silver',
    fullColorScheme: 'black',
    miniGaugeColor: 'silver',
    playerGaugeColor: 'black',
    legacyMiniGaugeStyle: 'classic',
    legacyPlayerGaugeStyle: 'classic'
  };
  assert.equal(methods.validateImportValue.call(ctx, 'echoclassic.ui.v2', JSON.stringify(payload)), null);

  const store = { 'echoclassic.ui.v2': JSON.stringify(payload) };
  const reloaded = helpers.uiContext({
    localStorage: {
      getItem: function (k) { return k in store ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    }
  }).LmsUi;
  assert.equal(reloaded.state.theme, 'legacy');
  assert.equal(reloaded.state.colorScheme, 'silver');
  assert.equal(reloaded.state.miniColorScheme, 'black');
  assert.equal(reloaded.state.fullTheme, 'legacy');
});
