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
