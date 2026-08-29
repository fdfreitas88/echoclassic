const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const detail = fs.readFileSync(path.join(root, 'EchoClassic/HTML/echoclassic/html/js/detail.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'EchoClassic/HTML/echoclassic/html/css/ios9.css'), 'utf8');
const strings = fs.readFileSync(path.join(root, 'EchoClassic/strings.txt'), 'utf8');

test('music folder exposes location, count, and explicit item types', function () {
  assert.match(detail, /class="music-folder-context"/);
  assert.match(detail, /class="music-folder-heading"/);
  assert.match(detail, /folderCountLabel/);
  assert.match(detail, /folderItemContext\(item\)/);
  assert.match(detail, /item\.type === 'folder' \? 'Folder' : 'Track'/);
});

test('music folder preserves destinations and offers empty-state recovery', function () {
  assert.match(detail, /v-if="item\.type === 'folder'" class="ic chev"/);
  assert.match(detail, /LmsNav\.push\('music', \{ kind: 'musicfolder'/);
  assert.match(detail, /LmsUi\.openActions\(\{ kind: 'track'/);
  assert.match(detail, /backToMusic: function \(\) \{ LmsNav\.reset\('music'\); \}/);
});

test('music folder rows wrap safely and remain touch sized', function () {
  assert.match(css, /\.music-folder-row\{[^}]*min-height:68px/);
  assert.match(css, /\.music-folder-copy \.s\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.music-folder-empty \.retry-command\{min-height:44px\}/);
});

test('music folder copy is available in English and Portuguese', function () {
  ['Music', 'Contents', 'item', 'items', 'This folder is empty',
    'Return to Music to choose another folder.', 'Back to Music'].forEach(function (phrase) {
    assert.ok(strings.includes('\tEN\t' + phrase + '\n'), 'missing English string: ' + phrase);
  });
  assert.match(strings, /ECHOCLASSIC_UI_BACK_TO_MUSIC\n\tEN\tBack to Music\n\tPT\tVoltar para Música/);
});
