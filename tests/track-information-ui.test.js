'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('EchoClassic/HTML/echoclassic/html/js/actions.js', 'utf8');
const css = fs.readFileSync('EchoClassic/HTML/echoclassic/html/css/ios9.css', 'utf8');

test('track information starts with identity and compact file facts', function () {
  assert.match(source, /class="info-identity"/);
  assert.match(source, /class="info-art"/);
  assert.match(source, /class="info-facts"/);
  assert.match(source, /Source file <span class="v">\{\{ fileLabel \}\}<\/span>/);
});

test('current track exposes one signal summary and a separate detail view', function () {
  assert.match(source, /v-if="isCurrentTrack" type="button" class="signal-summary" @click="view = 'signal'"/);
  assert.match(source, /v-else-if="info && view === 'signal'"/);
  assert.match(source, /this\.store\.np\.isTranscoded \? 'Playing with transcoding' : 'Playing without transcoding'/);
  assert.doesNotMatch(source, /if \([^\n]*technical[^\n]*\) parts\.push\('Transcoded'\)/i);
});

test('empty credits group is omitted and narrow rows wrap safely', function () {
  assert.match(source, /<template v-if="hasCredits">/);
  assert.match(source, /return !!\(this\.info && \(this\.info\.albumArtist \|\| this\.info\.composer/);
  assert.match(css, /@media\(max-width:380px\)[\s\S]*\.info-compact-group \.srow\{align-items:flex-start;flex-direction:column/);
});
