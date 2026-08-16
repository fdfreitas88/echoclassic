const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

/* O vm roda noutro realm: um objeto de la nao e deepStrictEqual a um objeto
   daqui, porque os prototipos diferem. Mesmo truque de uistate.test.js. */
function plain(v) { return JSON.parse(JSON.stringify(v)); }

/* Same fetch stub shape as format.test.js's "bitrate e normalizado" case,
   generalised to record every command sent and answer per-command. */
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

/* 2a: sem a tag 'e' o LMS nao manda album_id, e a fila nao tem como agrupar
   por album sem recorrer ao nome (colide) ou ao coverid (e por faixa). */
test('a fila pede a tag e, e o album_id volta como albumId sem quebrar faixas sem album', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'status') {
      return {
        playlist_tracks: 2, playlist_cur_index: 0,
        playlist_loop: [
          { id: 1, title: 'A', album_id: 5, 'playlist index': 0 },
          { id: 2, title: 'B', 'playlist index': 1 }
        ]
      };
    }
    return {};
  });

  const q = await ctx.api.queue('p1', 0, 10);
  const sent = ctx.calls[0];
  assert.equal(sent[0], 'status');
  const tags = sent[3];
  assert.match(tags, /^tags:/);
  assert.ok(tags.indexOf('e') >= 0, 'a string de tags precisa carregar e: ' + tags);

  assert.equal(q.tracks[0].albumId, 5);
  assert.equal(q.tracks[1].albumId, null, 'faixa sem album_id nao pode virar undefined nem lancar');
});

test('status pede album_id e tracknum para reconstruir playback de uma faixa lembrada', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'status') {
      return {
        mode: 'stop', time: 0,
        playlist_cur_index: 0,
        playlist_loop: [{
          id: 42, title: 'Back Home', artist: 'Zomby Woof',
          album: 'Riding On A Tear', album_id: 7, tracknum: '10',
          duration: 123, samplerate: 44100, samplesize: 16, type: 'flc'
        }]
      };
    }
    return {};
  });

  const st = await ctx.api.status('p1');
  const sent = ctx.calls[0];
  assert.equal(sent[0], 'status');
  assert.ok(sent[3].indexOf('e') >= 0, 'status tags need e for album_id: ' + sent[3]);
  assert.ok(sent[3].indexOf('t') >= 0, 'status tags need t for tracknum: ' + sent[3]);
  assert.equal(st.track.albumId, 7);
  assert.equal(st.track.trackNum, 10);
});

/* 2b: trackstat e um plugin de terceiros, ausente num servidor padrao. O core
   despacha ['rating','_item','_rating'] (Commands.pm ratingCommand), numa
   escala 0-100 -- a mesma que songinfo devolve em trackInfo.rating. */
test('setRating usa o comando core rating, na escala 0-100', async function () {
  const ctx = apiContext(function () { return {}; });
  await ctx.api.setRating('p1', 42, 4);
  const sent = ctx.calls[0];
  assert.deepEqual(sent, ['rating', 42, 80]);
});

test('setRating satura em 0 e 5 estrelas antes de converter', async function () {
  const ctx = apiContext(function () { return {}; });
  await ctx.api.setRating('p1', 1, 9);
  assert.deepEqual(ctx.calls[0], ['rating', 1, 100]);
  await ctx.api.setRating('p1', 1, -3);
  assert.deepEqual(ctx.calls[1], ['rating', 1, 0]);
});

/* 2c: a sonda `can` nao tem envelope de lote no jsonrpc.js, entao "em lote"
   aqui quer dizer disparadas juntas com Promise.all -- uma so espera de rede
   para o mapa inteiro, em vez de uma por capacidade. */
test('canCommands dispara as sondas juntas e devolve um mapa por nome', async function () {
  const ctx = apiContext(function (cmd) {
    // 'can' <partes> '?' -- responde 1 so para 'rating'
    if (cmd[0] === 'can' && cmd[1] === 'rating') return { _can: 1 };
    return { _can: 0 };
  });

  const caps = await ctx.api.canCommands({
    rating: ['rating'],
    randomplay: ['randomplay'],
    dontstopthemusicsetting: ['dontstopthemusicsetting']
  });

  assert.deepEqual(plain(caps), { rating: true, randomplay: false, dontstopthemusicsetting: false });
  assert.equal(ctx.calls.length, 3, 'uma chamada por capacidade, todas antes da resposta voltar');
  assert.ok(ctx.calls.some(function (c) { return c[0] === 'can' && c[1] === 'rating'; }));
});

test('canCommands nao derruba o mapa inteiro quando uma sonda falha', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[1] === 'rating') throw new Error('boom');
    return { _can: 1 };
  });
  const caps = await ctx.api.canCommands({ rating: ['rating'], randomplay: ['randomplay'] });
  assert.equal(caps.rating, false);
  assert.equal(caps.randomplay, true);
});

test('ARTMETA-01: MusicArtistInfo is capability-gated and uses the canonical artist id', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'can') return { _can: 1 };
    if (cmd[1] === 'biography') return { biography: 'Local biography', portraitid: 'p7' };
    if (cmd[1] === 'artistphoto') return { url: 'imageproxy/mai/artist/7/image.png', credits: 'Photographer' };
    return {};
  });
  const info = await ctx.api.musicArtistInfo('p1', 7, 'Ignored fallback');
  assert.equal(info.available, true);
  assert.equal(info.biography, 'Local biography');
  assert.equal(info.photoCredits, 'Photographer');
  assert.deepEqual(ctx.calls[1], ['musicartistinfo', 'biography', 'artist_id:7']);
  assert.deepEqual(ctx.calls[2], ['musicartistinfo', 'artistphoto', 'artist_id:7']);
});

test('ARTMETA-01: plugin biography HTML is normalized to readable text at the API boundary', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'can') return { _can: 1 };
    if (cmd[1] === 'biography') return { biography: '<link rel="stylesheet"><p>The <b>Beatles</b> &amp; friends.</p><h2>History</h2>' };
    return {};
  });
  const info = await ctx.api.musicArtistInfo('p1', 7, 'The Beatles');
  assert.equal(info.biography, 'The Beatles & friends.\n\nHistory');
  assert.doesNotMatch(info.biography, /<[^>]+>/);
});

test('ARTMETA-01: absent capability avoids enrichment calls', async function () {
  const ctx = apiContext(function () { return { _can: 0 }; });
  const info = await ctx.api.musicArtistInfo('p1', 7, 'Artist');
  assert.equal(info.available, false);
  assert.equal(ctx.calls.length, 1);
  assert.deepEqual(ctx.calls[0], ['can', 'musicartistinfo', 'biography', '?']);
});

test('ARTMETA-01: name fallback is URI escaped only when there is no local id', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'can') return { _can: 1 };
    return {};
  });
  await ctx.api.musicArtistInfo('', null, 'AC/DC & Friends');
  assert.deepEqual(ctx.calls[1], ['musicartistinfo', 'biography', 'artist:AC%2FDC%20%26%20Friends']);
});

test('ARTMETA-01: album review and cover candidates use documented album_id calls', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'can') return { _can: 1 };
    if (cmd[1] === 'albumreview') return { albumreview: '<p>Review &amp; notes</p><script>bad()</script>' };
    if (cmd[1] === 'albumcovers') return { item_loop: [{ url: 'https://img/1.jpg', credits: 'A', size: '600x600' }] };
    return {};
  });
  const info = await ctx.api.musicAlbumInfo('p1', 42);
  assert.equal(info.review, 'Review & notes');
  assert.equal(info.covers[0].credits, 'A');
  assert.ok(ctx.calls.some(function (cmd) { return cmd.join(' ') === 'musicartistinfo albumreview album_id:42'; }));
  assert.ok(ctx.calls.some(function (cmd) { return cmd.join(' ') === 'musicartistinfo albumcovers album_id:42'; }));
});

test('LIST-01: OPML paging carries stable action identity and the requested window', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'apps') {
      return { item_loop: [
        { type: 'audio', title: 'Same title', actions: { play: { cmd: ['one'], params: { id: 1 } } } },
        { type: 'audio', title: 'Same title', actions: { play: { cmd: ['two'], params: { id: 2 } } } }
      ] };
    }
    return {};
  });
  const items = await ctx.api.opmlBrowse('p1', ctx.api.opmlRoot('apps'), 100, 100);

  assert.deepEqual(ctx.calls[0], ['apps', 100, 100, 'menu:apps']);
  assert.equal(items.length, 2);
  assert.notEqual(items[0].identity, items[1].identity,
    'same-title rows remain distinct when their actions differ');
  assert.deepEqual(plain(items[1].playNode), { cmd: ['two'], params: ['id:2'], title: 'Same title' });
});

test('LIST-01: shared LMS base actions make Qobuz rows actionable on every page', async function () {
  const ctx = apiContext(function () {
    return {
      base: {
        actions: {
          go: {
            cmd: ['qobuz', 'items'],
            params: { menu: 'qobuz' },
            itemsParams: 'params'
          }
        }
      },
      item_loop: [
        { type: 'playlist', text: 'Second page album', params: { item_id: '2.1.100' } }
      ]
    };
  });

  const items = await ctx.api.opmlBrowse('p1', {
    cmd: ['qobuz', 'items'], params: ['item_id:2.1'], title: 'Releases'
  }, 100, 100);

  assert.equal(items[0].kind, 'menu');
  assert.deepEqual(plain(items[0].node), {
    cmd: ['qobuz', 'items'],
    params: ['menu:qobuz', 'item_id:2.1.100'],
    title: 'Second page album'
  });
  assert.match(items[0].identity, /item_id.*2\.1\.100/);
});
