const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

/* R2 commit 1/3: songInfo carries tag `w` (response key `lyrics`, from
   tracks.lyrics) through the mapper as info.lyrics. Same apiContext harness
   as api.test.js -- a fetch stub that records every command and answers per
   command. songinfo's default tag string already includes `w`, so no tags
   parameter is added to the request; only the mapper output is under test
   here. */
function apiContext(responder, extra) {
  const calls = [];
  const ctx = helpers.runBrowserFile('EchoClassic/HTML/echoclassic/html/js/api.js', Object.assign({
    fetch: function (url, opts) {
      var body = JSON.parse(opts.body);
      var cmd = body.params[1];
      calls.push(cmd);
      var result = responder ? (responder(cmd) || {}) : {};
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ result: result }); } });
    },
    LmsFmt: { year: function (v) { return v; }, coverUrl: function () { return ''; } },
    document: { addEventListener: function () {} },
    location: { origin: 'http://x' },
    AbortController: function () { this.signal = null; this.abort = function () {}; }
  }, extra || {}));
  return { api: ctx.LmsApi, calls: calls };
}

test('songInfo maps a songinfo_loop lyrics key onto info.lyrics', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'songinfo') {
      return {
        songinfo_loop: [
          { id: 42, title: 'Back Home', lyrics: 'Watch out girl' }
        ]
      };
    }
    return {};
  });

  const info = await ctx.api.songInfo('p1', 42);
  assert.equal(info.lyrics, 'Watch out girl');
});

test('songInfo without a lyrics key in the response yields an empty string, never undefined or null', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'songinfo') {
      return {
        songinfo_loop: [
          { id: 43, title: 'No Lyrics Here' }
        ]
      };
    }
    return {};
  });

  const info = await ctx.api.songInfo('p1', 43);
  assert.equal(info.lyrics, '');
  assert.notEqual(info.lyrics, undefined);
  assert.notEqual(info.lyrics, null);
});

test('songInfo preserves newlines in multi-line lyrics -- the reading surface renders with white-space:pre-line', async function () {
  const raw = 'Line one\nLine two\nLine three';
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'songinfo') {
      return {
        songinfo_loop: [
          { id: 44, title: 'Verses', lyrics: raw }
        ]
      };
    }
    return {};
  });

  const info = await ctx.api.songInfo('p1', 44);
  assert.equal(info.lyrics, raw);
  assert.equal(info.lyrics.split('\n').length, 3);
});

test('songInfo other fields stay unaffected by the new lyrics mapping', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'songinfo') {
      return {
        songinfo_loop: [
          {
            id: 45, title: 'Back Home', artist: 'Zomby Woof',
            album: 'Riding On A Tear', album_id: 7, tracknum: '10',
            duration: 123, samplerate: 44100, samplesize: 16, type: 'flc',
            lyrics: 'La la la'
          }
        ]
      };
    }
    return {};
  });

  const info = await ctx.api.songInfo('p1', 45);
  assert.equal(info.title, 'Back Home');
  assert.equal(info.artist, 'Zomby Woof');
  assert.equal(info.album, 'Riding On A Tear');
  assert.equal(info.albumId, 7);
  assert.equal(info.trackNum, 10);
  assert.equal(info.duration, 123);
  assert.equal(info.sampleRate, 44100);
  assert.equal(info.format, 'FLC');
  assert.equal(info.lyrics, 'La la la');
});

/* R2 commit 3/3: the surface itself, lms-info-sheet in actions.js. No Vue
   instantiation harness exists for this component (helpers.js builds one for
   browse/filterpanel/settings/sortmenu/queue, not actions), and the repo's
   established idiom for this exact situation -- asserting things about a
   single component inside actions.js without instantiating it -- is
   source-text regexes (browse.test.js:973, i18n.test.js:140/166,
   css-flex-reserves.test.js throughout). Following that, not inventing a
   third style. */

function actionsSource() {
  return helpers.read('EchoClassic/HTML/echoclassic/html/js/actions.js');
}

function stringsEntries() {
  const text = helpers.read('EchoClassic/strings.txt');
  const entries = {};
  let key = '';
  text.split(/\r?\n/).forEach(function (line) {
    const top = line.match(/^([A-Z0-9_]+)$/);
    if (top) { key = top[1]; entries[key] = {}; return; }
    const value = line.match(/^\t([A-Z]{2})\t([\s\S]*)$/);
    if (value && key) entries[key][value[1]] = value[2];
  });
  return entries;
}

test('AC-R2-02: the Lyrics row is gated on the truthiness of info.lyrics, not key presence, and is not unconditional', function () {
  const src = actionsSource();
  /* Gated on the hasLyrics computed rather than info.lyrics directly --
     info.lyrics alone is truthy for whitespace-only tags too, which is
     exactly the empty-screen defect this row must never open onto. See the
     hasLyrics computed itself, and the whitespace-gate tests below, for that
     part of the contract. */
  assert.match(src, /<button v-if="hasLyrics" type="button" class="srow settings-command-row pointer"\s*\n\s*@click="view = 'lyrics'">\{\{ tr\('Lyrics'\) \}\} <span class="v">›<\/span><\/button>/,
    'a row with no v-if, or gated on "lyrics" in info instead of the string being truthy, would open a reading surface with nothing in it for tracks whose songinfo omits the tag but not for ones where the mapper simply produced an empty string -- api.js always yields a string, so truthiness is the only correct gate');
  assert.doesNotMatch(src, /v-if="'lyrics' in info"/, 'gating on key presence would fire even when info.lyrics is the empty string the mapper guarantees for tracks with no lyrics');
});

test('AC-R2-01: the reading branch renders info.lyrics inside a .reading element, and the row activation switches to it', function () {
  const src = actionsSource();
  assert.match(src, /v-else-if="info && view === 'lyrics' && hasLyrics"/, 'the reading surface must be its own branch, gated on the view state -- and defensively on hasLyrics too, so no state can reach the surface without text');
  assert.match(src, /<div class="reading">\{\{ info\.lyrics \}\}<\/div>/, 'the lyrics text itself must land inside the .reading element so the pre-line CSS rule applies to it');
  assert.match(src, /@click="view = 'lyrics'"/, 'activating the Lyrics row must move the sheet into the reading view');
});

test('the reading surface offers a way back to the information list, not only a way to close the sheet', function () {
  const src = actionsSource();
  const headBack = src.match(/headBack: function \(\) \{[\s\S]*?\n      \},/);
  assert.ok(headBack, 'headBack method not found');
  assert.match(headBack[0], /if \(this\.view === 'lyrics'\) this\.view = 'info';/,
    'from the lyrics view, the head control must return to the info list -- a reading surface with no way back except closing the whole sheet violates the explicit product rule');
  assert.match(headBack[0], /else this\.close\(\);/, 'only once the list itself is showing does the same control close the sheet');
});

test('load() resets view to \'info\' before fetching, so reopening the sheet for a different track cannot show the previous one\'s lyrics', function () {
  const src = actionsSource();
  const load = src.match(/load: async function \(item\) \{[\s\S]*?\n      \}\n    \},\n    created:/);
  assert.ok(load, 'load() method not found');
  const body = load[0];
  assert.match(body, /this\.view = 'info';/, 'load() must reset the view state on every call');
  const resetIndex = body.indexOf("this.view = 'info';");
  const fetchIndex = body.indexOf('await LmsApi.songInfo');
  assert.ok(resetIndex >= 0 && fetchIndex >= 0 && resetIndex < fetchIndex,
    'the reset has to happen before the network round trip -- resetting after the fetch would still let the old view flash first, and if the fetch is for a different track and the reset never runs at all, the previous view leaks through unguarded by requestToken (view is not part of the token check)');
});

test('the .sgh line above the lyrics does not leave a dangling separator when info.artist is empty', function () {
  const src = actionsSource();
  assert.doesNotMatch(src, /\{\{ info\.title \|\| item\.title \}\} · \{\{ info\.artist \}\}/,
    'two adjacent interpolations with a literal separator between them render the separator even when the second one is empty -- api.js\'s canonicalArtist(undefined) resolves through txt() to \'\', which is reachable for any file with no artist tag, so this is not a hypothetical');
  assert.match(src, /\{\{ \[info\.title \|\| item\.title, info\.artist\]\.filter\(Boolean\)\.join\(' · '\) \}\}/,
    'the fix follows the idiom already established two lines below for artist/album -- filter(Boolean).join on the data pieces, not a template literal with a hardcoded separator');
});

test('white-space:pre-line survives on .reading -- lyrics are multi-line, and a CSS tidy-up that drops this flattens every song into one paragraph', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const rule = css.match(/\.reading\{([\s\S]*?)\}/);
  assert.ok(rule, '.reading rule not found in ios9.css');
  assert.match(rule[1], /white-space:pre-line/);
});

test('both new strings.txt keys exist with EN and PT entries', function () {
  const entries = stringsEntries();
  assert.ok(entries.ECHOCLASSIC_UI_LYRICS, 'ECHOCLASSIC_UI_LYRICS missing from strings.txt');
  assert.equal(entries.ECHOCLASSIC_UI_LYRICS.EN, 'Lyrics');
  assert.ok(entries.ECHOCLASSIC_UI_LYRICS.PT, 'ECHOCLASSIC_UI_LYRICS has no PT entry');

  assert.ok(entries.ECHOCLASSIC_UI_FROM_THE_FILE_S_OWN_TAGS, 'ECHOCLASSIC_UI_FROM_THE_FILE_S_OWN_TAGS missing from strings.txt');
  assert.equal(entries.ECHOCLASSIC_UI_FROM_THE_FILE_S_OWN_TAGS.EN, "From the file's own tags");
  assert.ok(entries.ECHOCLASSIC_UI_FROM_THE_FILE_S_OWN_TAGS.PT, 'ECHOCLASSIC_UI_FROM_THE_FILE_S_OWN_TAGS has no PT entry');
});

test('dynamic lyrics controls and source text use explicit translation', function () {
  const src = actionsSource();
  assert.match(src, /tr\(view === 'lyrics' \? 'Back' : 'Done'\)/);
  assert.match(src, /tr\(view === 'lyrics' \? 'Lyrics' : 'Information'\)/);
  assert.match(src, /tr\("From the file's own tags"\)/);
  assert.match(src, /tr\('Lyrics'\)/);
});

test('track information normalizes LMS format aliases for display', function () {
  const src = actionsSource();
  assert.match(src, /Format <span class="v">\{\{ formatLabel \}\}<\/span>/);
  assert.match(src, /return this\.info && this\.info\.format \? LmsFmt\.format\(this\.info\.format\) : '—';/);
});

/* R2 review fixes (AC-R2-02, finding 1): txt() in api.js never trims, so a
   USLT/lyrics tag holding only whitespace -- a known artifact of buggy
   taggers -- is a non-empty, truthy string. Left ungated, that opens the
   Lyrics row onto a reading surface with nothing in it, the exact failure
   AC-R2-02 forbids. api.js is correct to hand the raw string through
   untouched (trimming is a presentation call); the two cases below pin that
   the mapper still does so, then pin that the component's own gate treats
   the same raw, whitespace-only value as absent. */

test('AC-R2-02: a whitespace-only lyrics tag (spaces) is preserved raw and non-empty by the mapper -- trimming is not api.js\'s job', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'songinfo') {
      return { songinfo_loop: [{ id: 46, title: 'Silence', lyrics: '   ' }] };
    }
    return {};
  });

  const info = await ctx.api.songInfo('p1', 46);
  assert.equal(info.lyrics, '   ', 'the mapper must hand the tag back untouched');
  assert.ok(info.lyrics.length > 0, 'the raw value is a non-empty, truthy string -- exactly what a gate of v-if="info.lyrics" alone would let through');
});

test('AC-R2-02: a whitespace-only lyrics tag (a bare newline) is preserved raw and non-empty by the mapper', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'songinfo') {
      return { songinfo_loop: [{ id: 47, title: 'Silence', lyrics: '\n' }] };
    }
    return {};
  });

  const info = await ctx.api.songInfo('p1', 47);
  assert.equal(info.lyrics, '\n', 'the mapper must hand the tag back untouched');
  assert.ok(info.lyrics.length > 0, 'the raw value is a non-empty, truthy string -- exactly what a gate of v-if="info.lyrics" alone would let through');
});

test('AC-R2-02: the component gate (hasLyrics) trims before treating the tag as present, and both the row and the reading branch are gated on it', function () {
  const src = actionsSource();
  const hasLyrics = src.match(/hasLyrics: function \(\) \{[\s\S]*?\n      \},/);
  assert.ok(hasLyrics, 'hasLyrics computed not found -- without it there is nothing to gate whitespace-only lyrics on');
  assert.match(hasLyrics[0], /this\.info\.lyrics\.trim\(\)/,
    'a gate that stops at this.info.lyrics being truthy is exactly the AC-R2-02 defect -- " " and "\\n" are non-empty, truthy strings, so only trimming first tells whitespace-only tags from real ones. This is red against the pre-fix source (info.lyrics alone) and green once hasLyrics trims.');
  assert.match(src, /<button v-if="hasLyrics" type="button" class="srow settings-command-row pointer"/,
    'the row must be gated on the trimmed computed, not on info.lyrics directly -- else a whitespace-only tag still renders a row that opens onto an empty reading surface');
  assert.match(src, /v-else-if="info && view === 'lyrics' && hasLyrics"/,
    'the reading branch must defensively re-check the same trimmed gate, so no state can reach the surface without text even if view is ever set to \'lyrics\' by a path other than the row');
});

/* R2 review fixes, finding 3 (non-blocking): the Lyrics button only exists
   in the info branch, so switching into the lyrics view unmounts the very
   node that had focus, leaving it on <body> -- outside the subtree
   trapFocus (bound to keydown.tab on infoDialog) actually guards. A view
   watcher, mirroring the item watch's own $nextTick-then-focus idiom right
   above it, must pull focus back onto a control that survives every
   branch. */

test('switching between the info and lyrics views re-focuses a control inside the dialog, so Tab cannot escape once the clicked Lyrics button is unmounted', function () {
  const src = actionsSource();
  const infoSheet = src.slice(src.indexOf("Vue.component('lms-info-sheet'"));
  const watchBlock = infoSheet.match(/watch: \{[\s\S]*?\n    \},\n    methods: \{/);
  assert.ok(watchBlock, 'watch block not found');
  assert.match(watchBlock[0], /view: function \(\) \{/, 'a view watcher must exist -- headBack and the Lyrics row both change view, and either direction can unmount the focused control');
  var viewWatch = watchBlock[0].match(/view: function \(\) \{[\s\S]*?\n      \}/);
  assert.ok(viewWatch, 'view watcher body not found');
  assert.match(viewWatch[0], /this\.\$nextTick\(function \(\) \{/, 'the re-focus has to wait for the branch swap to actually render, same as the item watch\'s own $nextTick');
  assert.match(viewWatch[0], /querySelector\('button'\)/, 'must pick a control by the same idiom as the item watch -- the head\'s back-command button, which is present in every branch, not something specific to one view');
  assert.match(viewWatch[0], /\.focus\(\);/, 'finding the node is not enough -- it has to actually receive focus');
});

/* R2 review fixes, finding 4 (non-blocking): aria-label was a static
   "Track information" that never changed while the dialog was showing
   lyrics. :aria-label is a dynamic binding, which i18n.js's template
   rewrite does not reach (ATTRS only matches static attr="value" pairs), so
   translation has to be resolved by hand through tr(), same idiom as
   detail.js/opmlview.js/filterpanel.js/browse.js -- not built by
   concatenation, and reusing the 'Lyrics' / 'Track information' keys that
   already exist rather than adding a new one. */

test('the dialog aria-label follows the view instead of staying pinned to "Track information" while lyrics are showing', function () {
  const src = actionsSource();
  assert.match(src, /:aria-label="view === 'lyrics' \? tr\('Lyrics'\) : tr\('Track information'\)"/,
    'the label must track view via the same ternary idiom as the .ttl text node two lines below, resolved through tr() by hand because :aria-label is a dynamic binding');
  assert.doesNotMatch(src, /\saria-label="Track information"/, 'the old static attribute must be gone, not left duplicated alongside the dynamic one');
  assert.match(src, /tr: function \(text\) \{\s*\n\s*return window\.LmsStr && LmsStr\.t \? LmsStr\.t\(text\) : text;\s*\n\s*\},/,
    'tr() must follow the exact fallback idiom used elsewhere in the skin (detail.js, opmlview.js, filterpanel.js, browse.js) -- text unchanged when LmsStr is unavailable, translated when it is');
});
