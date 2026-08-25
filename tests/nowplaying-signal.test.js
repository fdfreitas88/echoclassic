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
