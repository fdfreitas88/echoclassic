const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');

test('Equalizer root is one full-width responsive dashboard', function () {
  assert.match(settings, /<div class="equalizer-dashboard">/);
  assert.match(settings, /class="equalizer-dashboard-path"/);
  assert.match(settings, /class="[^"]*equalizer-dashboard-presets/);
  assert.match(settings, /class="[^"]*equalizer-dashboard-rules/);
  assert.match(settings, /class="[^"]*equalizer-dashboard-curve/);
  assert.match(settings, /class="[^"]*equalizer-dashboard-advanced/);
  assert.match(css, /\.equalizer-dashboard\{min-height:calc\(100vh/);
  assert.doesNotMatch(settings, /<div class="equalizer-workspace">/);
});

test('Engine and Mode expose primary choices with compact more controls', function () {
  assert.match(settings, /v-for="owner in dspOwnerOptions"/);
  assert.match(settings, /appleSqueezerModes\.slice\(0,2\)/);
  assert.match(settings, /appleSqueezerModes\.slice\(2\)/);
  assert.match(settings, /toggleEqualizerDashboard\('engines'\)/);
  assert.match(settings, /toggleEqualizerDashboard\('modes'\)/);
  assert.match(css, /\.equalizer-dashboard-path\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('Quick presets and automatic rules use independent expandable rows', function () {
  assert.match(settings, /equalizerDashboardPresets/);
  assert.match(settings, /toggleEqualizerDashboard\('presets'\)/);
  assert.match(settings, /equalizerRuleScopes\.slice\(0,3\)/);
  assert.match(settings, /equalizerRuleScopes\.slice\(3\)/);
  assert.match(settings, /toggleEqualizerDashboard\('rules'\)/);
  assert.match(settings, /class="equalizer-dashboard-now"/);
  assert.match(settings, /\{\{ equalizerContextName \}\}/);
});

test('Curve remains full width and preserves direct actions and paused recovery', function () {
  assert.match(settings, /class="equalizer-workspace-surface" :class="\{paused:!equalizerAvailableNow\}"/);
  assert.match(settings, /Saved curve preview · processing paused/);
  assert.match(settings, />Use Equalizer mode<\/button>/);
  assert.match(settings, />Compare \{\{ nativeDspAB \}\}<\/button>/);
  assert.match(settings, /applyNativePreset\('flat'\):resetEqualizerBands\(\)/);
  assert.match(settings, /applyNativeDsp\(\):applyEqualizer\(\)/);
  assert.doesNotMatch(settings, /class="equalizer-workspace-actions">\s*<button type="button" class="sw"/);
});

test('Advanced modules expand independently and retain detailed destinations', function () {
  ['headroom', 'filters', 'spatial'].forEach(function (key) {
    assert.match(settings, new RegExp("equalizerAdvancedOpen\\." + key));
  });
  assert.match(settings, /toggleEqualizerAdvanced\(module\.key\)/);
  assert.match(settings, /Headroom & protection/);
  assert.match(settings, /Parametric filters/);
  assert.match(settings, /Room & spatial/);
  assert.match(settings, /openAppearanceScreen\('equalizer-graphic'\)/);
  assert.match(css, /\.equalizer-dashboard-advanced-tabs\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test('phone dashboard wraps fixed groups without a dashboard carousel', function () {
  assert.match(css, /@media\(max-width:700px\)\{[\s\S]*\.equalizer-dashboard-path\{display:block\}/);
  assert.match(css, /\.equalizer-dashboard-presets\{grid-template-columns:repeat\(4,1fr\)\}/);
  assert.match(css, /\.equalizer-dashboard-rules\{grid-template-columns:repeat\(2,1fr\)\}/);
  assert.match(css, /\.equalizer-dashboard-advanced-tabs,\.equalizer-dashboard-advanced-detail\{grid-template-columns:1fr\}/);
  assert.doesNotMatch(css, /equalizer-dashboard[^}]*overflow-x:auto/);
});

test('unified Equalizer actions do not route into the legacy split workspace', function () {
  const dashboard = settings.slice(settings.indexOf('<div class="equalizer-dashboard">'), settings.indexOf('<div v-else class="equalizer-subworkspace">'));
  assert.doesNotMatch(dashboard, /openAppearanceScreen\('equalizer-(?:player|mode|graphic|presets|rules)'\)/);
  assert.match(dashboard, /id="eq-dashboard-preset-name"/);
  assert.match(dashboard, /equalizer-dashboard-saved-rule/);
  assert.match(dashboard, /equalizer-dashboard-filter/);
});

test('Advanced never becomes empty outside Apple Squeezer Equalizer mode', function () {
  assert.match(settings, /isSettingsScreen\('equalizer-graphic'\) && dspOwner === 'apple-squeezer' && appleSqueezerCompatible && appleSqueezer\.mode !== 'equalizer'/);
  assert.match(settings, /Your advanced DSP settings remain saved\. Switch modes to edit or apply them\./);
  assert.match(settings, /Advanced DSP is unavailable/);
});

test('Apple Squeezer Compare in the dashboard can save a slot, not just load one', function () {
  assert.match(settings, /@click="saveNativeAB\(nativeDspAB\)">Save \{\{ nativeDspAB \}\}<\/button>/);
});

test('loadNativeAB tells the user when the requested comparison slot is empty', function () {
  assert.match(settings, /Nothing saved in slot ' \+ slot \+ ' yet\. Use Save ' \+ slot/);
});
