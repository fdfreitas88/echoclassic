const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('format helpers cover duration, long duration, depth and cover sizes', function () {
  const ctx = helpers.runBrowserFile('EchoClassic/HTML/echoclassic/html/js/format.js');
  const fmt = ctx.LmsFmt;

  assert.equal(fmt.duration(75 * 60 + 4), '1:15:04');
  assert.equal(fmt.duration(-2), '0:00');
  assert.equal(fmt.longDuration(59), 'menos de 1 min');
  assert.equal(fmt.longDuration(59 * 60 + 40), '1 h');
  assert.equal(fmt.longDuration(2 * 3600 + 31 * 60), '2 h 31 min');
  assert.notEqual(fmt.longDuration(59 * 60 + 40), '60 min');
  assert.equal(fmt.depth(1), '1 bits');
  assert.equal(fmt.depth(24), '24 bits');
  assert.equal(fmt.coverUrl('a/b c', 512), '/music/a%2Fb%20c/cover_512x512.jpg');
  assert.equal(fmt.coverUrl('cover', 0), '/music/cover/cover.jpg');
});
