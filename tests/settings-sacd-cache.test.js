const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const settings = fs.readFileSync(path.join(__dirname, '..', 'EchoClassic/HTML/echoclassic/html/js/settings.js'), 'utf8');

test('SACD cache settings row covers present, absent, low disk and missing binary states', function () {
  assert.match(settings, /tr\('SACD cache'\)/);
  assert.match(settings, /v-if="sacdCache\.available"/);
  assert.match(settings, /v-if="!sacdCache\.available"/);
  assert.match(settings, /sacdCache\.lowDisk/);
  assert.match(settings, /v-if="!sacdCache\.binary"/);
  assert.match(settings, /sacdCache\.albums/);
  assert.match(settings, /sacdEvictAlbum\(album\.key\+'\/'\+album\.area\)/);
});
