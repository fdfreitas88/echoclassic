const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

/* RESP-11..RESP-16 (commit 4): fixed-width reserves inside flex rows that a
   translated/fallback-font sibling can outgrow, and text columns that no
   longer truncate because the selector meant to give them flex:1 stopped
   matching the current markup.

   Same caveat as player-layout.test.js: this is a regex-over-source-text
   suite. It proves the CSS declares what we intend; it cannot compute
   rendered geometry in a browser. All six findings were [code] at audit
   time, not reproduced live. */

/* ---------- RESP-11: .mini becomes a real 3-part flex row ---------- */

test('RESP-11: .mini .np is a flex:1 flow item, not an absolutely-positioned box with hardcoded insets', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const np = css.match(/\.mini \.np\{([^}]*)\}/)[1];
  assert.match(np, /flex:1/, 'the text/cover column must grow to fill whatever space transport and .r leave');
  assert.match(np, /min-width:0/, 'flex:1 without min-width:0 cannot shrink below content, defeating the point');
  assert.doesNotMatch(np, /position:absolute/,
    'an absolutely-positioned .np is exactly the mechanism RESP-11 removes -- it stops reading the real width of .r');
  assert.doesNotMatch(np, /inset:/, 'the base rule must not carry the old inset:0 216px 0 188px reserve');
});

test('RESP-11: the 330px reserve for the translated queue-label at >=1200px is gone', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const wide = css.match(/@media \(min-width:1200px\)\{([\s\S]*?)\n\}/)[1];
  assert.match(wide, /\.mini \.queue-label\{display:block\}/, 'sanity: the label still becomes visible at this width');
  assert.doesNotMatch(wide, /\.mini \.np/,
    'right:330px hardcoded the queue-label\'s width -- with .np as flex:1 the row no longer needs to know it');
});

test('RESP-11: the <=700px mobile override no longer hardcodes .mini .np left/right either', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.doesNotMatch(css, /\.mini \.np\{left:180px;right:48px\}/,
    'this was the third magic-number reserve named in RESP-11');
});

test('RESP-11: the <=360px stacked layout keeps .np absolute explicitly, since the base rule no longer sets position', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(css, /\.mini \.np\{position:absolute;inset:0 0 44px 0;padding:5px 8px;gap:7px\}/,
    'this breakpoint deliberately stacks .np above .transport/.r as two absolute rows -- it must re-declare position itself now that the base rule is a real flex item, and the stacked geometry itself is unchanged');
});

/* ---------- RESP-12: the row/trow/qrow text column flex selector ---------- */

test('RESP-12: .row>.ell no longer appears -- .ell is nested inside *-main now, not a direct child of .row', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.doesNotMatch(css, /\.row>\.ell\{flex:1\}/,
    'this selector stopped matching anything once .ell moved inside .row-main; a stale rule that matches nothing is not a fix');
});

test('RESP-12: .row-main/.trow-main/.qrow-main>.ell all get flex:1', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(css, /\.row-main>\.ell,\.trow-main>\.ell,\.qrow-main>\.ell\{flex:1\}/,
    'browse.js/search.js put .ell as a direct child of .row-main, albumblock.js/playlists.js of .trow-main, queue.js of .qrow-main -- all three are real, reachable selectors');
});

/* ---------- RESP-13: the queue header wrap fix applies above 700px too ---------- */

test('RESP-13: .queue .qhead base rule can wrap and grow, 44px is a floor not a lock', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const qhead = css.match(/\.queue \.qhead\{([^}]*)\}/)[1];
  assert.match(qhead, /min-height:44px/, '44px stays as the floor per the brief');
  assert.match(qhead, /flex:0 0 auto/, 'flex:0 0 44px could never grow past 44px regardless of min-height; auto lets it');
  assert.match(qhead, /flex-wrap:wrap/,
    'the popover is a fixed 420px regardless of window width, so title+counter+Undo+Clear upcoming+Clear all+dismiss can overflow one line even on a wide screen -- the wrap fix cannot stay gated behind max-width:700px');
  assert.doesNotMatch(qhead, /flex:0 0 44px/, 'the locked-height rule the D-series comment blames must be gone from the base rule');
});

test('RESP-13: the <=700px override no longer duplicates what the base rule now does', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(css, /\.queue \.qhead\{min-height:42px;padding-top:5px;padding-bottom:5px\}/,
    'still allowed a slightly lower floor and its own vertical breathing room at narrow widths, but flex-wrap/flex:0 0 auto/row-gap now live in the base rule and should not be repeated here as dead weight');
});

/* ---------- RESP-14: row hairline offsets follow the art column via a custom property ---------- */

test('RESP-14: .row and .trow each carry a --*hair-left custom property instead of a literal offset, like commit 1\'s --qhair-left', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const row = css.match(/\.row\{height:var\(--row-artist\)[^}]*\}/)[0];
  assert.match(row, /--rhair-left:82px/);
  const rowHair = css.match(/\.row\+\.row::before\{([^}]*)\}/)[1];
  assert.match(rowHair, /left:var\(--rhair-left\)/);

  const trow = css.match(/\.trow\{height:var\(--row-track\)[^}]*--thair-left:68px\}/);
  assert.ok(trow, '.trow base rule should declare --thair-left:68px');
  const trowHair = css.match(/\.trow\+\.trow::before\{([^}]*)\}/)[1];
  assert.match(trowHair, /left:var\(--thair-left\)/);
});

test('RESP-14: .pane-left .row.albumrow overrides --rhair-left to match its wider 64px .art (was hardcoded 82px)', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const albumrow = css.match(/\.pane-left \.row\.albumrow\{([^}]*)\}/)[1];
  assert.match(albumrow, /--rhair-left:98px/,
    '20px padding + 64px art + 14px gap = 98px, not the generic 82px sized for the default 48px .art');
  const noartAlbum = css.match(/\.pane-left \.row\.albumrow\.noart\{([^}]*)\}/)[1];
  assert.match(noartAlbum, /--rhair-left:20px/,
    'an album row that individually has no art should not reserve the 64px art-column width it does not render');
});

test('RESP-14: .row.noart overrides --rhair-left to 20px unconditionally, not only when both adjacent rows lack art', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(css, /\.row\.noart\{--rhair-left:20px\}/);
  assert.doesNotMatch(css, /\.row\.noart\+\.row\.noart::before\{left:20px\}/,
    'the old adjacency-pair selector under-fired: a noart row after an artful one kept the 82px offset');
});

test('RESP-14: .trow.albrow overrides --thair-left to match its 48px .cover (was hardcoded 68px)', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const albrow = css.match(/\.trow\.albrow\{([^}]*)\}/)[1];
  assert.match(albrow, /--thair-left:96px/, '36px padding + 48px cover + 12px gap = 96px');
});

/* ---------- RESP-15: .srow .v truncates instead of overflowing the row ---------- */

test('RESP-15: .srow .v truncates long values (settings.js queueArtModeLabel etc.) instead of overflowing the row', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const v = css.match(/\.srow \.v\{([^}]*)\}/)[1];
  assert.match(v, /min-width:0/);
  assert.match(v, /overflow:hidden/);
  assert.match(v, /text-overflow:ellipsis/);
  assert.match(v, /white-space:nowrap/);
});

test('RESP-15: .info-content .srow .v keeps its own wrap-instead-of-truncate override (max-width:62%, white-space:normal)', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(css, /\.info-content \.srow \.v\{max-width:62%;white-space:normal;text-align:right\}/,
    'the track-info panel deliberately wraps rather than ellipsises -- the generalised base rule must not have removed this, more specific, override');
});

/* ---------- RESP-16: navbar search field stops relying on a fixed 52px reserve ---------- */

test('RESP-16: .searchwrap is a real flex:1 row item, not an absolutely-positioned box with a fixed 52px right reserve for the Cancel button', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const wrap = css.match(/\.searchwrap\{([^}]*)\}/)[1];
  assert.match(wrap, /flex:1/);
  assert.match(wrap, /min-width:0/);
  assert.doesNotMatch(wrap, /position:absolute/,
    'position:absolute with left:52px;right:52px is exactly the RESP-11-class reserve: "Cancelar" (translated) or a fallback font can exceed 52px and run under the field');
  assert.doesNotMatch(wrap, /right:52px/);
});

test('RESP-16: the now-unused .sp spacer is suppressed when it sits next to .searchwrap, so the two do not split the flex-grow 50/50', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(css, /\.searchwrap ~ \.sp\{display:none\}/,
    '.sp only exists in the searching branch\'s markup as a leftover spacer; without suppressing it, both .searchwrap and .sp would carry flex:1 and share the row 50/50 instead of the field taking all of it');
});

test('RESP-16: .navbar .center is documented as reviewed-and-kept, not silently skipped', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const centerBlock = css.match(/\/\* \.center cobre[\s\S]*?\n\.navbar \.center\{position:absolute;left:0;right:0/)[0];
  assert.match(centerBlock, /REVISADO \(RESP-16\)/,
    'the brief allows leaving this one with a comment if the safe fix is bigger than the commit warrants -- it must say so, not just go untouched with no trace of the decision');
});

/* ---------- EC-003: the selection bar reserves its own space instead of
   covering the list ----------

   `.selection-bar` was `position:fixed` above the mini player, so the list
   scroller's box ran underneath it: the last row was half hidden and its
   checkbox click landed on the bar's Cancel button, discarding the whole
   selection. The fix makes the bar a real row of `.app`'s flex column, which
   is why it also has to move above `.app-footer` in the template.

   Same caveat as the RESP suites: this is a regex-over-source-text check. It
   proves the CSS and the template declare the intended structure; it cannot
   compute rendered geometry. The defect was reproduced [live]; the corrected
   geometry needs its own live check. */

test('EC-003: .selection-bar is a flow row of the app column, not a fixed overlay', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const bar = css.match(/\.selection-bar\{([^}]*)\}/)[1];
  assert.match(bar, /flex:0 0 44px/,
    'the bar has to reserve its 44px in the column -- that reservation is what stops it covering the last list row');
  assert.doesNotMatch(bar, /position:fixed/,
    'position:fixed is the defect: it takes the bar out of flow, so .workspace never shrinks and the scroller runs under it');
  assert.doesNotMatch(bar, /bottom:calc/,
    'the bottom:calc(var(--mini) + var(--tabbar)) offset only exists to fake a flow position -- a real flex row is placed by the column');
});

test('EC-003: .selection-bar no longer needs the sheet stacking context it used to sit in', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const bar = css.match(/\.selection-bar\{([^}]*)\}/)[1];
  assert.doesNotMatch(bar, /z-index:var\(--z-sheet\)/,
    'a flow row does not compete with sheets for stacking order; keeping --z-sheet would re-raise it over the footer it now sits beside');
});

/* ---------- UX-01: the connection banner reserves its own space instead of
   covering the list toolbar ----------

   `.connection-banner` was `position:fixed;top:70px`, which put it exactly over
   the row of list commands: at 390x844 the centres of Filter artists, Filters,
   Sort and Select all landed under it and a hit-test returned the alert's text
   instead of the control. The root picker's first option, Recent, was covered
   the same way. The fix is EC-003's: make the banner a real row of `.app`'s
   flex column, which is why it also has to move above `<main class="workspace">`
   in the template.

   Regex-over-source-text, like the suites above: it proves the declared
   structure, not rendered geometry. The overlap was reproduced [live]; the
   corrected geometry needs its own live check. */

test('UX-01: .connection-banner is a flow row of the app column, not a fixed overlay', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const banner = css.match(/\.connection-banner\{([^}]*)\}/)[1];
  assert.match(banner, /flex:0 0 auto/,
    'the banner has to reserve its own height in the column -- that reservation is what stops it covering the toolbar');
  assert.doesNotMatch(banner, /position:fixed/,
    'position:fixed is the defect: out of flow, the banner sits on top of whatever the workspace renders at that y');
  assert.doesNotMatch(banner, /top:70px/,
    '70px was measured against the header height; it is the offset that put the banner over the toolbar');
  assert.doesNotMatch(banner, /transform:translateX/,
    'a centred, viewport-width-capped box only makes sense for an overlay; a column row spans the column');
});

test('UX-01: the banner no longer shares the fixed-overlay rule with .operation-banner/.notice', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const shared = css.match(/^(.*)\{position:fixed;z-index:var\(--z-notice\);/m)[1];
  assert.doesNotMatch(shared, /\.connection-banner/,
    'inheriting position:fixed from the grouped rule would undo the fix even with the banner-specific rule corrected');
  assert.match(shared, /\.operation-banner/, 'sanity: the transient banners stay overlays');
  assert.match(shared, /\.notice/);
});

test('UX-01: the banner markup sits between the header and the workspace', function () {
  const app = helpers.read('EchoClassic/HTML/echoclassic/html/js/app.js');
  const header = app.indexOf('</header>');
  const banner = app.indexOf('class="connection-banner"');
  const main = app.indexOf('<main class="workspace"');
  assert.ok(header > -1 && banner > -1 && main > -1, 'sanity: all three are still rendered');
  assert.ok(banner > header && banner < main,
    '.app-header is display:contents, so source order is what places the row: after the navbar, above the list that must not be covered');
});

test('EC-003: <lms-selection-bar> sits inside the app column, above the footer', function () {
  const app = helpers.read('EchoClassic/HTML/echoclassic/html/js/app.js');
  const bar = app.indexOf('<lms-selection-bar>');
  const footer = app.indexOf('<footer class="app-footer">');
  assert.ok(bar > -1, 'sanity: the bar is still rendered');
  assert.ok(footer > -1, 'sanity: the footer is still rendered');
  assert.ok(bar < footer,
    'the bar must precede the footer: .app-header/.app-footer are display:contents, so .app is the real flex column and source order is what places the bar above the mini player');
});
