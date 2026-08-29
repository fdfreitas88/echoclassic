const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('Now Playing exposes the approved keyboard controls without moving features', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/nowplaying.js');
  assert.match(src, /@keydown="onPlayerKey"/);
  assert.match(src, /key === ' ' \|\| key === 'Spacebar'/);
  assert.match(src, /key === 'ArrowLeft' \|\| key === 'ArrowRight'/);
  assert.match(src, /LmsStore\.seek\(Math\.max\(0, Math\.min\(this\.store\.duration/);
  assert.match(src, /key === 'ArrowUp' \|\| key === 'ArrowDown'/);
  assert.match(src, /this\.stepVolume\(key === 'ArrowUp'/);
  assert.match(src, /tag === 'input'.*tag === 'button'/s,
    'global player shortcuts must not steal keys from focused controls');
});

test('Now Playing exposes complete truncated metadata and semantic mode state', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/nowplaying.js');
  assert.match(src, /class="t ell" :title="np\.title \|\| 'Nothing playing'"/);
  assert.match(src, /class="s ell" :title="subtitle" :aria-label="subtitle"/);
  assert.equal((src.match(/:aria-pressed="String\(!!store\.(?:shuffle|repeat)\)"/g) || []).length, 2);
});

test('short-height layout yields cover space before controls and active modes do not rely on colour', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const short = css.match(/@media \(min-width:701px\) and \(max-height:700px\)\{([\s\S]*?)\n\}/)[1];
  assert.match(short, /\.npstage\.mode-adaptive\{position:fixed;inset:0;padding:10px\}/,
    'short adaptive players must use the full viewport instead of the clipped workspace');
  assert.match(short, /max-height:calc\(100vh - 20px\)/);
  assert.match(short, /--player-column:min\(calc\(100vw - 56px\),32vh,260px\)/);
  const active = css.match(/\.np-tools button\.on\{([^}]*)\}/)[1];
  assert.match(active, /background:var\(--field\)/);
  assert.match(active, /box-shadow:inset 0 2px 0 var\(--accent\)/);
});

test('the rejected Mini Player redesign remains unimplemented', function () {
  const mini = helpers.read('EchoClassic/HTML/echoclassic/html/js/chrome/miniplayer.js');
  assert.match(mini, /class="mini-action pointer" title="Stop"/);
  assert.match(mini, /class="mini-action mini-equalizer-command pointer"/);
  assert.match(mini, /class="badges mini-badges"/);
});
