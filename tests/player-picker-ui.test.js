const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

function source() {
  return helpers.read('EchoClassic/HTML/echoclassic/html/js/actions.js');
}

test('player picker separates available and unavailable outputs with an active summary', function () {
  const text = source();
  assert.match(text, /class="player-picker-summary"/);
  assert.match(text, /availablePlayers/);
  assert.match(text, /unavailablePlayers/);
  assert.match(text, /Reconnect the player to the same LMS server/);
});

test('player picker exposes keyboard navigation and existing player settings', function () {
  const text = source();
  assert.match(text, /@keydown\.up\.stop\.prevent="movePlayerFocus\(-1\)"/);
  assert.match(text, /@keydown\.down\.stop\.prevent="movePlayerFocus\(1\)"/);
  assert.match(text, /screen: 'player-settings'/);
  assert.match(text, /LmsUi\.setTab\('settings'\)/);
});

test('only connected players can invoke selection', function () {
  const text = source();
  assert.match(text, /v-for="p in availablePlayers"/);
  assert.match(text, /if \(!p \|\| !p\.connected\) return/);
  assert.doesNotMatch(text, /v-for="p in unavailablePlayers"[^]*@click="choosePlayer\(p\)"/);
});
