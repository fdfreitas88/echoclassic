const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

/* RESP-09/RESP-10, redone after review. The first attempt widened the text
   column by decoupling its container from the rows beneath it: the padding
   (RESP-09) / the .head width (RESP-10) stopped reading the same measure
   --player-wide / --player-column that .scrub, .bottom, .np-secondary and
   .cover still used, so art and controls stopped lining up under the wider
   title. These assertions pin the *coupling*, not just a number -- they
   would fail again if row 1 (or .head, in the with-queue branch) were ever
   unbound from the measure the rest of the row shares.

   This is a regex-over-source-text suite: it can prove the CSS declares
   what we intend, it cannot compute rendered geometry or prove five
   viewports actually look right in a browser. The hand-worked arithmetic in
   the commit report reads these same formulas -- [code], not [live]. */

test('RESP-09 coupling guard: row-1 padding is still driven by --player-wide, not a flat gutter', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const outer = css.match(/\.npstage\.mode-fullscreen \.npfull:not\(\.with-queue\)\{([^}]*)\}/)[1];
  assert.match(outer, /padding-left:max\(20px,calc\(\(100vw - var\(--player-wide\)\)\/2\)\)/,
    'if this stops reading --player-wide, row 1 (cover+head) can grow out of step with .scrub/.bottom/.np-secondary again -- exactly the gap the reviewer measured');
  assert.match(outer, /padding-right:max\(20px,calc\(\(100vw - var\(--player-wide\)\)\/2\)\)/);
});

test('RESP-09: --player-wide was widened by scaling with --player-cover, not by deleting the cap', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(css, /--player-wide:min\(calc\(100vw - 40px\),\s*calc\(var\(--player-track\) \+ var\(--player-cover\) \+ 267px\)\)/,
    'still a min(...) cap, still bounded -- just a function of --player-cover instead of a flat +267px constant, so the whole block grows together instead of the cap being removed');
});

test('RESP-09 no-regression guard: .scrub/.bottom/.np-secondary/.np-tools/.rating-row still read width:var(--player-wide)', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const bottom = css.match(/\.npstage\.mode-fullscreen \.npfull:not\(\.with-queue\)>\.bottom\{([^}]*)\}/)[1];
  const secondary = css.match(
    /\.npstage\.mode-fullscreen \.npfull:not\(\.with-queue\)>\.np-secondary,[\s\S]*?>\.rating-row\{([^}]*)\}/
  )[1];
  assert.match(bottom, /width:var\(--player-wide\)/);
  assert.match(secondary, /width:var\(--player-wide\)/);
});

test('RESP-09: an unusually long title clamps to two lines instead of the column growing unbounded', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const t = css.match(/\.npstage\.mode-fullscreen \.npfull:not\(\.with-queue\)>\.head \.t\{([^}]*)\}/)[1];
  assert.match(t, /-webkit-line-clamp:2/);
  assert.match(t, /white-space:normal/,
    'the .ell class this element also carries (class="t ell") sets white-space:nowrap; it must be overridden here or the clamp never gets a second line to wrap onto');
});

test('RESP-10 alignment guard: .head in the inline-queue grid is inset to match .cover, never flush at x=0', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const wide = css.match(/@media \(min-width:900px\)\{([\s\S]*?)\n\}/)[1];
  assert.match(wide, /\.npfull\.with-queue\{width:100%;display:grid;[\s\S]*?padding-left:0;padding-right:0\}/,
    'sanity: the container itself still contributes no centring padding here, so .head has to supply its own inset');
  const head = wide.match(/\.npfull\.with-queue>\.head\{([^}]*)\}/)[1];
  assert.doesNotMatch(head, /width:100%/,
    'width:100% inside a zero-padding container is exactly what put the title at the screen edge (x=0) last time');
  assert.match(head, /margin-left:calc\(\(100% - var\(--player-column\)\)\/2\)/,
    '.cover is centred with this same inset ((100% - player-column)/2); giving .head the identical margin-left is what lines their left edges up');
});

test('RESP-10 coupling guard: .head\'s inset and .cover\'s width read the same --player-column variable', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const wide = css.match(/@media \(min-width:900px\)\{([\s\S]*?)\n\}/)[1];
  const head = wide.match(/\.npfull\.with-queue>\.head\{([^}]*)\}/)[1];
  const cover = css.match(/\.npfull \.cover\{([^}]*)\}/)[1];
  assert.match(cover, /width:var\(--player-column\)/);
  assert.match(head, /var\(--player-column\)/,
    'if .head is ever re-sized off a different variable than .cover, they can drift apart the way width:100% did');
});

test('RESP-10 no-regression guard: .cover/.scrub keep width:var(--player-column) unchanged', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const cover = css.match(/\.npfull \.cover\{([^}]*)\}/)[1];
  const scrub = css.match(/\.npfull \.scrub\{([^}]*)\}/)[1];
  assert.match(cover, /width:var\(--player-column\)/);
  assert.match(scrub, /width:var\(--player-column\)/);
});

/* .npfull.with-queue>.head (the RESP-10 rule) has no npstage/mode prefix, so
   it also matches inside mode-adaptive's plain floating card and inside the
   docked workspace.player-adaptive column -- both flex, not grid, where
   margin behaves the same as it does on a grid item. Unset, that margin
   would leak into those two branches and shove the title sideways there
   too. This pins the reset that keeps it out. */
test('RESP-10 leak guard: the inline-queue .head margin does not bleed into mode-adaptive (plain card or docked)', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const reset = css.match(/\.npstage\.mode-adaptive \.npfull\.with-queue \.head\{([^}]*)\}/)[1];
  assert.match(reset, /margin-left:0/,
    'without this, the >=900px grid rule\'s margin-left leaks into the mode-adaptive card and the docked workspace.player-adaptive column, both display:flex, where margin still applies');
  assert.match(reset, /margin-right:0/);
});
