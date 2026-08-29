const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

function source(file) {
  return helpers.read('EchoClassic/HTML/echoclassic/html/' + file);
}

test('kiosk entry waits for the shared in-app confirmation', async function () {
  const ui = helpers.uiContext().LmsUi;
  const pending = ui.requestKioskEntry();

  assert.equal(ui.state.kioskMode, false);
  assert.equal(ui.state.confirmation.title, 'Enter kiosk mode?');
  assert.equal(ui.state.confirmation.confirmLabel, 'Enter kiosk mode');
  assert.equal(ui.state.confirmation.destructive, false);

  ui.resolveConfirmation(true);
  assert.equal(await pending, true);
  assert.equal(ui.state.kioskMode, true);
  assert.equal(ui.state.full, true);
  assert.equal(ui.state.playerFullscreen, true);
});

test('kiosk exit, close and fullscreen changes cannot dismantle the only player', async function () {
  const ui = helpers.uiContext().LmsUi;
  ui.setPreference('kioskMode', true);

  ui.togglePlayerFullscreen();
  assert.equal(ui.state.playerFullscreen, true, 'kiosk remains full screen');

  ui.closePlayer();
  assert.equal(ui.state.full, true, 'close becomes an exit request, not a blank screen');
  assert.equal(ui.state.confirmation.title, 'Exit kiosk mode?');
  ui.resolveConfirmation(false);
  await Promise.resolve();
  assert.equal(ui.state.kioskMode, true, 'cancel keeps kiosk active');

  const pending = ui.requestKioskExit();
  ui.resolveConfirmation(true);
  assert.equal(await pending, true);
  assert.equal(ui.state.kioskMode, false);
  assert.equal(ui.state.full, true, 'exiting restores navigation without tearing down playback');
});

test('a persisted kiosk preference restores a mounted fullscreen player', function () {
  const ui = helpers.uiContext({
    localStorage: {
      getItem: function (key) {
        return key === 'echoclassic.ui.v2' ? JSON.stringify({ kioskMode: true }) : null;
      },
      setItem: function () {}, removeItem: function () {}
    }
  }).LmsUi;
  assert.equal(ui.state.kioskMode, true);
  assert.equal(ui.state.full, true);
  assert.equal(ui.state.playerFullscreen, true);
});

test('the player exposes one kiosk-only exit control and routes Esc through close', function () {
  const nowPlaying = source('js/nowplaying.js');
  assert.match(nowPlaying, /v-if="ui\.kioskMode"[^>]+class="kiosk-exit pointer"/);
  assert.match(nowPlaying, /aria-label="Exit kiosk mode"/);
  assert.match(nowPlaying, /@keydown\.esc\.stop\.prevent="close"/);
  assert.match(nowPlaying, /v-if="!ui\.kioskMode"[^>]+class="dismiss pointer"/);
});

test('party mode explains hidden actions and Manage opens Interface & access', function () {
  const app = source('js/app.js');
  assert.match(app, /class="party-status" aria-label="Party mode status"/);
  assert.match(app, /Delete and reorder are hidden\./);
  assert.match(app, />Manage<\/button>/);
  assert.match(app, /managePartyMode[\s\S]*LmsUi\.setTab\('settings'\)[\s\S]*screen: 'interface-settings'/);
});

test('approved safe areas and touch targets are present in production CSS', function () {
  const css = source('css/ios9.css');
  assert.match(css, /\.party-status\{[^}]*margin:10px 14px 0[^}]*padding:7px 12px/);
  assert.match(css, /\.interface-mode-group\{[^}]*margin-left:14px[^}]*margin-right:14px/);
  assert.match(css, /\.npfull \.kiosk-exit\{[^}]*left:14px[^}]*width:44px[^}]*height:44px/);
  assert.match(css, /\.global-confirm\{align-items:flex-end;padding:12px\}/);
});
