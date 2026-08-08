const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

/* C4 (3.2.6c): the Queue, General, Language, Backup and About groups take
   their final shape. Queue's expandable "Queue artwork" summary row becomes
   three inline checkmark rows; "Security and compatibility", "Library" and
   "Server" merge into one "About" group, which also picks up the Connection
   row moved out of Player (phase2-decisions.md #4). */

function settingsSrc() {
  return helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
}

function group(name, nextHeading) {
  const src = settingsSrc();
  const re = new RegExp('<div class="sgh">' + name + '</div>[\\s\\S]*?(?=<div class="sgh"' +
    (nextHeading ? ('>' + nextHeading + '<') : '') + ')');
  const m = src.match(re);
  assert.ok(m, name + ' group not found');
  return m[0];
}

test('C4/Queue: the queue-artwork expander is gone -- no showQueueArt anywhere in the component', function () {
  const src = settingsSrc();
  assert.doesNotMatch(src, /showQueueArt/);
});

test('C4/Queue: queueArtModeLabel (the expander summary) is gone with it', function () {
  const src = settingsSrc();
  assert.doesNotMatch(src, /queueArtModeLabel/);
});

test('C4/Queue: three inline role="radio" rows sit inside a role="radiogroup" wrapper, wired to radioKey', function () {
  const body = group('Queue', 'General');
  assert.match(body, /role="radiogroup" aria-label="Queue artwork"/);
  const radios = body.match(/role="radio"/g) || [];
  assert.equal(radios.length, 1, 'one v-for template site over queueArtModes');
  assert.match(body, /@keydown="radioKey\(\$event, queueArtModes, ui\.queueArtMode, queueArtMode\)"/);
  assert.match(body, /v-for="mode in queueArtModes"/);
  /* queueArtModes is bound to LmsUi.QUEUE_ART_MODES in data() -- confirm that
     source array actually has the three modes the v-for above repeats over,
     so the template site above really renders three role="radio" rows. */
  const inst = helpers.settingsInstance();
  assert.equal(inst.self.queueArtModes.length, 3);
  assert.equal(inst.self.queueArtModes.map(function (m) { return m.key; }).sort().join(','),
    'album,every,headings');
});

test('C4/Queue: the existing help line (ECHOCLASSIC_UI_QUEUE_ARTWORK_HELP) is kept verbatim, not reworded', function () {
  const src = settingsSrc();
  assert.match(src, /Choose how often album art repeats in the playback queue\./);
});

test('C4/General: the two toggles (Rate and bits, Highlight hi-res) are still role="switch" on showBadges/markHires', function () {
  const g = group('General', 'Language');
  assert.match(g, /role="switch"[\s\S]*?aria-label="Rate and bits in the bottom bar"/);
  assert.match(g, /preference\('showBadges'\)/);
  assert.match(g, /role="switch"[\s\S]*?aria-label="Highlight high resolution audio"/);
  assert.match(g, /preference\('markHires'\)/);
});

test('C4: Security/Library/Server headings no longer exist as settings.js sgh groups', function () {
  const src = settingsSrc();
  assert.doesNotMatch(src, /<div class="sgh">Security and compatibility<\/div>/);
  assert.doesNotMatch(src, /<div class="sgh">Library<\/div>/);
  assert.doesNotMatch(src, /<div class="sgh">Server<\/div>/);
});

test('C4/About: one "About" heading merges counts, versions, lock-screen note, Advanced LMS settings and Connection', function () {
  const g = group('About', undefined);
  assert.match(g, /store\.connected/, 'Connection row (only place a user sees "no player connected")');
  assert.match(g, /info\.artists/);
  assert.match(g, /info\.albums/);
  assert.match(g, /info\.songs/);
  assert.match(g, /info\.genres/, 'Genres stays even though the mockup omits it');
  assert.match(g, /Server version/);
  assert.match(g, /skinVersion/);
  assert.match(g, /Lock screen controls/, 'lock-screen support note stays even though the mockup omits it');
  assert.match(g, /mediaSessionSupported/);
  assert.match(g, /openAdvanced/);
});

test('C4/About: Connection no longer lives in the Player group', function () {
  const src = settingsSrc();
  const m = src.match(/<div class="sgh">Player<\/div>[\s\S]*?<div class="sgh">Playback<\/div>/);
  assert.ok(m, 'Player group not found');
  assert.doesNotMatch(m[0], /store\.connected/);
});

test('C4/Backup: a dedicated Backup group holds Export/Import and the import confirm', function () {
  const g = group('Backup', 'About');
  assert.match(g, /exportSettings/);
  assert.match(g, /importSettings/);
  assert.match(g, /pendingImport/);
  assert.match(g, /confirmImport/);
  assert.match(g, /cancelImport/);
  assert.doesNotMatch(g, /Lock screen controls/, 'lock-screen note moved to About, not left behind in Backup');
});

test('C4: the import-confirm consequence sentence is fully English in source -- no bare Portuguese fragment', function () {
  const src = settingsSrc();
  assert.doesNotMatch(src, /fica guardada no navegador/);
  assert.match(src, /is kept in the browser before the write happens\. The page reloads afterwards\./);
});

test('C4: the "querying the server" caption is English in source, not the Portuguese literal', function () {
  const src = settingsSrc();
  assert.doesNotMatch(src, /Consultando o servidor/);
  assert.match(src, /Querying the server…/);
});

test('C4: validateImportValue messages are English, not "deveria ser um objeto"', function () {
  const src = settingsSrc();
  assert.doesNotMatch(src, /deveria ser um objeto/);
  assert.match(src, /should be an object/);
});

test('C4: the exported preferences filename is English ("preferences", not "preferencias")', function () {
  const src = settingsSrc();
  assert.doesNotMatch(src, /echo-classic-preferencias\.json/);
  assert.match(src, /echo-classic-preferences\.json/);
});

test('C4: queueArtMode click still writes through to LmsUi.state.queueArtMode', function () {
  const inst = helpers.settingsInstance();
  inst.ctx.LmsUi.state.queueArtMode = 'album';
  inst.self.queueArtMode('every');
  assert.equal(inst.ctx.LmsUi.state.queueArtMode, 'every');
  inst.self.queueArtMode('headings');
  assert.equal(inst.ctx.LmsUi.state.queueArtMode, 'headings');
});
