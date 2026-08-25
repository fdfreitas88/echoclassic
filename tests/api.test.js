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

test('Apple Squeezer Intel 1.0.2 is negotiated and normalized from its published wire API', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'can') return { _can: cmd[1] === 'apple_squeezer' ? 1 : 0 };
    if (cmd[0] === 'apple_squeezer' && cmd[1] === 'status') return {
      available: 1, running: 1, mode: 'equalizer', upsample_rate: '192000',
      resample_filter: 'minimum', coreaudio_telemetry: '{"rate":192000}'
    };
    if (cmd[0] === 'apple_squeezer' && cmd[1] === 'dsp_status') return {
      configured: 1, configuration: '{"version":2,"graphic_eq_db":[]}',
      telemetry: '{"active":true}'
    };
    return { success: 1 };
  });

  const state = await ctx.api.appleSqueezerStatus('player-1');
  assert.equal(state.apiVersion, 1);
  assert.equal(state.lifecycle, 'running');
  assert.equal(state.upsampleRate, '192000');
  assert.equal(state.resampleFilter, 'minimum');
  assert.equal(state.dspConfig, '{"version":2,"graphic_eq_db":[]}');
  assert.equal(state.capabilities.dsp, true);
  assert.ok(ctx.calls.some(function (cmd) { return cmd[0] === 'apple_squeezer' && cmd[1] === 'dsp_status'; }));
});

test('Apple Squeezer Intel 1.0.2 mutations use the released underscore commands', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'can') return { _can: cmd[1] === 'apple_squeezer' ? 1 : 0 };
    return { success: 1 };
  });

  await ctx.api.setAppleSqueezerUpsampleRate('192000');
  await ctx.api.setAppleSqueezerResampleFilter('minimum');
  await ctx.api.applyAppleSqueezerDsp('player-1', { version: 2 }, null);
  await ctx.api.bypassAppleSqueezerDsp('player-1', true);
  await ctx.api.rollbackAppleSqueezerDsp('player-1');

  assert.ok(ctx.calls.some(function (cmd) { return cmd.join(' ') === 'apple_squeezer upsample_rate 192000'; }));
  assert.ok(ctx.calls.some(function (cmd) { return cmd.join(' ') === 'apple_squeezer resample_filter minimum'; }));
  assert.ok(ctx.calls.some(function (cmd) { return cmd[0] === 'apple_squeezer' && cmd[1] === 'dsp_apply' && cmd[2] === '{"version":2}'; }));
  assert.ok(ctx.calls.some(function (cmd) { return cmd.join(' ') === 'apple_squeezer dsp_bypass true'; }));
  assert.ok(ctx.calls.some(function (cmd) { return cmd.join(' ') === 'apple_squeezer dsp_rollback'; }));
});

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

test('status usa os atributos do stream ativo devolvidos pelo LMS 9.2', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'status') {
      return {
        mode: 'play', samplerate: 48000, samplesize: 24,
        type: 'mp3', bitrate: '256kbps',
        playlist_loop: [{
          id: 42, title: 'Hi-res source', duration: 123,
          samplerate: 192000, samplesize: 24, type: 'flc', bitrate: '5641kbps'
        }]
      };
    }
    return {};
  });

  const st = await ctx.api.status('p1');
  const tags = ctx.calls[0][3];
  ['b', 'o', 'T', 'I'].forEach(function (tag) {
    assert.ok(tags.indexOf(tag) >= 0, 'status tags need ' + tag + ': ' + tags);
  });
  assert.equal(st.sampleRate, 48000);
  assert.equal(st.sampleSize, 24);
  assert.equal(st.format, 'MP3');
  assert.equal(st.bitrate, 256);
});

test('status nao herda bit depth do FLAC quando o stream lossy declara samplesize vazio', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'status') return {
      mode: 'play', samplerate: 48000, samplesize: '', type: 'mp3', bitrate: '256kbps',
      replay_gain: '-5.25', use_volume_control: 1,
      playlist_loop: [{ id: 42, duration: 123, samplerate: 192000, samplesize: 24, type: 'flc', bitrate: '5641kbps' }]
    };
    return {};
  });
  const st = await ctx.api.status('p1');
  assert.equal(st.sampleSize, 0);
  assert.equal(st.activeStream.sampleSize, 0);
  assert.equal(st.sourceStream.sampleSize, 24);
  assert.equal(st.replayGain, -5.25);
  assert.equal(st.useVolumeControl, true);
  assert.equal(st.isTranscoded, true);
});

test('status mantem os metadados como compatibilidade com LMS anterior ao 9.2', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'status') {
      return {
        mode: 'play',
        playlist_loop: [{
          id: 42, title: 'Source', duration: 123,
          samplerate: 44100, samplesize: 16, type: 'flc', bitrate: '900kbps'
        }]
      };
    }
    return {};
  });

  const st = await ctx.api.status('p1');
  assert.equal(st.sampleRate, 44100);
  assert.equal(st.sampleSize, 16);
  assert.equal(st.format, 'FLC');
  assert.equal(st.bitrate, 900);
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
  assert.deepEqual(plain(items[1].playNode), {
    cmd: ['two'], params: ['id:2'], title: 'Same title', verb: 'play'
  });
});

test('OPML widens do, playall, add and insert rows into executable actions', async function () {
  const verbs = ['do', 'playall', 'add', 'insert'];
  const ctx = apiContext(function (cmd) {
    if (cmd[0] !== 'apps') return {};
    return { item_loop: verbs.map(function (verb, index) {
      const actions = {};
      actions[verb] = { cmd: ['plugin', verb], params: { id: index + 1 } };
      return { type: 'text', text: verb, actions: actions };
    }) };
  });
  const items = await ctx.api.opmlBrowse('p1', ctx.api.opmlRoot('apps'), 0, 20);
  assert.deepEqual(items.map(function (item) { return item.kind; }), ['action', 'action', 'action', 'action']);
  assert.deepEqual(items.map(function (item) { return item.playNode.verb; }), verbs);

  await ctx.api.opmlPlay('p1', items[0].playNode);
  await ctx.api.opmlPlay('p1', items[1].playNode);
  assert.deepEqual(ctx.calls[1], ['plugin', 'do', 'id:1'], 'do is a direct command with no synthetic paging');
  assert.deepEqual(ctx.calls[2], ['plugin', 'playall', 0, 1, 'id:2']);
});

test('RandomPlay active state and Don’t Stop providers preserve LMS semantics', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'randomplayisactive') return { _randomplayisactive: '0' };
    if (cmd[0] === 'dontstopthemusicsetting') return { item_loop: [
      { text: 'Disabled', radio: 1, actions: { do: { cmd: ['playerpref', 'plugin.dontstopthemusic:provider', 0] } } },
      { text: 'Music Similarity', radio: 0, actions: { do: { cmd: ['playerpref', 'plugin.dontstopthemusic:provider', 'musicsimilarity'] } } }
    ] };
    return {};
  });
  assert.equal(await ctx.api.randomPlayActive('p1'), '');
  assert.deepEqual(plain(await ctx.api.dontStopProviders('p1')), [
    { id: '0', name: 'Disabled', selected: true },
    { id: 'musicsimilarity', name: 'Music Similarity', selected: false }
  ]);
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

test('SqueezeDSP settings and catalog are normalized without dropping plugin fields', async function () {
  const document = { Client: {
    Bypass: 0, Preamp: -2.5, Filters: [{ FilterType: 'peak', Frequency: 120 }],
    FutureSetting: { preserved: true }
  } };
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'squeezedsp.readclientSettings') {
      return { json: JSON.stringify(document), clientName: 'Kitchen', revision: '1.8', fresh_player: 1 };
    }
    if (cmd[0] === 'squeezedsp.filters') {
      return { Preset_loop: [{ 0: 'Flat' }], FIRWavFile_loop: [{ 0: 'room.wav' }] };
    }
    return {};
  });

  const settings = await ctx.api.squeezeDspRead('p1');
  const catalog = await ctx.api.squeezeDspCatalog('p1');
  assert.deepEqual(plain(settings.settings), document);
  assert.equal(settings.fresh, true);
  assert.deepEqual(plain(catalog), { presets: ['Flat'], impulses: ['room.wav'] });
});

test('SqueezeDSP save sends the complete settings document in one explicit saveall', async function () {
  const ctx = apiContext(function () { return { _done: 1 }; });
  const settings = { Client: { Bypass: 1, Preamp: 3, FutureSetting: 'keep' } };
  await ctx.api.squeezeDspSave('p2', settings);
  assert.equal(ctx.calls.length, 1);
  assert.equal(ctx.calls[0][0], 'squeezedsp.saveall');
  assert.deepEqual(JSON.parse(ctx.calls[0][1].slice(4)), settings);
});

test('SqueezeDSP preset create and delete use the plugin commands without rewriting the settings document', async function () {
  const ctx = apiContext(function () { return { _done: 1 }; });
  await ctx.api.squeezeDspSavePreset('p2', '  Living Room  ');
  await ctx.api.squeezeDspDeletePreset('p2', '/presets/Living Room.preset.json');
  assert.deepEqual(ctx.calls, [
    ['squeezedsp.saveas', 'preset:Living Room'],
    ['squeezedsp.deletepreset', 'preset:/presets/Living Room.preset.json']
  ]);
});

test('SqueezeDSP migrates Echo 3.3 Q filters to the plugin Slope contract', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'squeezedsp.readclientSettings') return {
      json: JSON.stringify({ Client: { Bypass: 0, Filters: [
        { FilterType: 'peak', Frequency: 60, Gain: 6, Q: 1.41 }
      ] } })
    };
    return { _done: 1 };
  });

  const result = await ctx.api.squeezeDspRead('p1');
  assert.deepEqual(plain(result.settings.Client.Filters[0]), {
    FilterType: 'peak', Frequency: 60, Gain: 6, Slope: 1.41, SlopeType: 'Q'
  });
  await ctx.api.squeezeDspSave('p1', { Client: { Bypass: 0, Filters: [
    { FilterType: 'peak', Frequency: 120, Gain: -3, Q: 2 }
  ] } });
  const saved = JSON.parse(ctx.calls[1][1].slice(4));
  assert.deepEqual(saved.Client.Filters[0], {
    FilterType: 'peak', Frequency: 120, Gain: -3, Slope: 2, SlopeType: 'Q'
  });
});

test('SqueezeDSP fresh-player settings receive the native defaults Echo edits', async function () {
  const ctx = apiContext(function () {
    return { json: JSON.stringify({ Client: { Bypass: 1 } }) };
  });
  const result = await ctx.api.squeezeDspRead('p1');
  assert.equal(result.settings.Client.Preamp, 0);
  assert.deepEqual(plain(result.settings.Client.Filters), []);
});

test('syncgroups keeps the LMS master-first topology and member names', async function () {
  const ctx = apiContext(function (cmd) {
    if (cmd[0] === 'syncgroups') return { syncgroups_loop: [{
      sync_members: 'master,member', sync_member_names: 'Living Room,Kitchen'
    }] };
    return {};
  });
  const groups = await ctx.api.syncGroups();
  assert.equal(groups[0].masterId, 'master');
  assert.deepEqual(plain(groups[0].members), [
    { id: 'master', name: 'Living Room' }, { id: 'member', name: 'Kitchen' }
  ]);
});

test('playerVolume reads and clamps the mixer volume query', async function () {
  const ctx = apiContext(function (cmd) {
    return cmd[0] === 'mixer' ? { _volume: '-47' } : {};
  });
  assert.equal(await ctx.api.playerVolume('p1'), 47);
  assert.deepEqual(ctx.calls[0], ['mixer', 'volume', '?']);
});
