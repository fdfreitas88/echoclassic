const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('Now Playing distinguishes source audio from the stream sent to the player', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/nowplaying.js');
  assert.match(src, /np\.isTranscoded/);
  assert.match(src, /source \+ ' → ' \+ output/);
  assert.match(src, /aria-label="Output stream"/);
  assert.match(src, /Output to player:/);
});

test('phone volume controls preserve a full-width slider and separate the mode switch', function () {
  const np = helpers.read('EchoClassic/HTML/echoclassic/html/js/nowplaying.js');
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(np, /class="volume-step quiet pointer"/);
  assert.match(np, /class="volume-step loud pointer"/);
  assert.match(np, /@click="stepVolume\(-ui\.volumeStep\)"/);
  assert.match(np, /@click="stepVolume\(ui\.volumeStep\)"/);
  assert.match(css, /@media \(max-width:560px\)\{[\s\S]*?\.npfull \.bottom\{grid-template-columns:minmax\(0,1fr\);gap:4px\}/);
  assert.match(css, /\.npfull \.volume-mode\{border-left:0;padding-left:0;padding-top:7px\}/);
});

test('Now Playing displays the Replay Gain value actually applied by LMS', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/nowplaying.js');
  assert.match(src, /store\.replayGainApplied/);
  assert.match(src, /Replay Gain /);
  assert.match(src, /gain\.toFixed\(2\)/);
});

test('lossy output does not invent a bit-depth value', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/nowplaying.js');
  assert.match(src, /if \(depth\) parts\.push\(depth\)/);
  assert.match(src, /Lossy streams intentionally have no bit depth/);
});

test('bottom bar and Information expose live processing without inventing DAC telemetry', function () {
  const mini = helpers.read('EchoClassic/HTML/echoclassic/html/js/chrome/miniplayer.js');
  const actions = helpers.read('EchoClassic/HTML/echoclassic/html/js/actions.js');
  assert.match(mini, /np\.isTranscoded/);
  assert.match(mini, /store\.replayGainApplied/);
  assert.match(actions, /Source track/);
  assert.match(actions, /Active stream/);
  assert.match(actions, /Requires Apple Squeezer hardware telemetry/);
  assert.match(actions, /<span class="v">Unavailable<\/span>/);
});
