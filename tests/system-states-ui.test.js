const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'EchoClassic', 'HTML', 'echoclassic', 'html');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('loading states use a shared skeleton and accessible progress gauge', () => {
  ['js/browse.js', 'js/search.js', 'js/detail.js', 'js/playlists.js', 'js/opmlview.js'].forEach((file) => {
    const source = read(file);
    assert.match(source, /state-skeleton/, file);
    assert.match(source, /role="progressbar"/, file);
  });
  const browse = read('js/browse.js');
  assert.match(browse, /loadProgress !== null/);
  assert.match(browse, /aria-valuenow="loadProgress === null \? null : loadProgress"/);
  assert.match(browse, /this\.loadProgress = Math\.min\(99/);
});

test('library errors and empty filters preserve context and offer recovery', () => {
  const browse = read('js/browse.js');
  assert.match(browse, /Your filters and position are still here/);
  assert.match(browse, /@click="reload\(true\)">Try again/);
  assert.match(browse, /@click="openServerSettings">Server settings/);
  assert.match(browse, /@click="clearMediaFilter">Clear filter/);
});

test('system progress animation respects reduced motion', () => {
  const css = read('css/ios9.css');
  assert.match(css, /\.state-progress\.indeterminate/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
