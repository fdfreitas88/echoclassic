const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

/* 2c: capabilities e resolvido uma vez no init(), a partir de um LmsApi real
   de mentira -- canCommands devolve o mapa que 2b pediu (rating) mais os dois
   que a proxima leva vai consumir. Ausencia tem que significar "nao mostrar",
   nunca "mostrar desabilitado": canRate comeca false e so vira true se a
   sonda disser que sim.

   sharedStore permite duas instancias de store.js (duas passadas por este
   arreio) lerem e escreverem o MESMO localStorage -- e assim que um "recarregar
   a pagina" e simulado: o modulo e recriado do zero (fechos novos, inclusive
   preferredPlayerId), mas o que estava gravado sobrevive. */
function storeContext(apiExtra, uiExtra, sharedStore) {
  const store = sharedStore || {};
  let canCommandsCalls = 0;
  const api = Object.assign({
    players: async function () {
      return [{ id: 'p1', name: 'Kitchen', connected: true, power: true }];
    },
    status: async function () {
      throw new Error('not used in this test');
    },
    playerPref: async function () { return null; },
    sleepRemaining: async function () { return 0; },
    canCommands: async function (probes) {
      canCommandsCalls++;
      const out = {};
      Object.keys(probes).forEach(function (name) { out[name] = name === 'rating'; });
      return out;
    }
  }, apiExtra || {});

  const ui = Object.assign({
    notify: function () {}, setBusy: function () {}, state: { defaultPlayer: 'last' }
  }, uiExtra || {});

  const ctx = helpers.browserContext({
    localStorage: {
      getItem: function (k) { return k in store ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    document: { hidden: true, addEventListener: function () {} },
    navigator: {},
    Vue: { observable: function (o) { return o; } },
    LmsApi: api,
    LmsUi: ui
  });
  ctx.window = ctx;
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/store.js');
  return { store: ctx.LmsStore, callCount: function () { return canCommandsCalls; }, backing: store };
}

test('init() resolve capabilities uma vez, com rating batido junto de randomplay e dontstopthemusicsetting', async function () {
  const ctx = storeContext();
  await ctx.store.init();
  assert.equal(ctx.store.state.capabilities.rating, true);
  assert.equal(ctx.store.state.capabilities.randomplay, false);
  assert.equal(ctx.store.state.capabilities.dontstopthemusicsetting, false);
  assert.equal(ctx.store.state.canRate, true, 'canRate deriva da capacidade, nao de uma sonda propria');
  assert.equal(ctx.callCount(), 1);
});

test('uma sonda que falha esconde o controle, nunca o deixa desabilitado', async function () {
  const ctx = storeContext({
    canCommands: async function () { throw new Error('server sem can'); }
  });
  await ctx.store.init();
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.store.state.capabilities)), {});
  assert.equal(ctx.store.state.canRate, false);
});

test('reconectar nao pede capabilities de novo: capabilitiesRequested e um tiro so', async function () {
  const ctx = storeContext();
  await ctx.store.init();
  assert.equal(ctx.callCount(), 1);
  // uma segunda passada por init() (o que reconnect() faz) nao deve custar
  // outra rodada de sondas quando a primeira ja resolveu
  await ctx.store.init();
  assert.equal(ctx.callCount(), 1);
});

const SESSION_KEY = 'echoclassic.session.v2';

function twoPlayers(flags) {
  return async function () {
    return [
      { id: 'p1', name: 'Kitchen', connected: true, power: true },
      { id: 'p2', name: 'Office', connected: !!flags.p2Connected, power: !!flags.p2Connected }
    ];
  };
}

const stubStatus = async function () {
  return {
    mode: 'stop', time: 0, duration: 0, volume: 50,
    track: { id: null }, sampleRate: 0, sampleSize: 0, format: '', live: false
  };
};

test('a ultima selecao explicita sobrevive a um "recarregar a pagina" simulado', async function () {
  const flags = { p2Connected: true };
  const shared = {};
  const ctx1 = storeContext({ players: twoPlayers(flags), status: stubStatus }, {}, shared);
  await ctx1.store.init();
  await ctx1.store.selectPlayer('p2');
  assert.equal(ctx1.store.state.playerId, 'p2');

  // "recarregar": um store.js novo, do zero, lendo o MESMO localStorage.
  const ctx2 = storeContext({ players: twoPlayers(flags), status: stubStatus }, {}, shared);
  await ctx2.store.init();
  assert.equal(ctx2.store.state.playerId, 'p2',
    'a preferencia explicita gravada na sessao anterior tem de vencer o primeiro player conectado');
});

test('um fallback tomado com o preferido inalcancavel nao apaga a preferencia guardada, e ela volta a valer quando o player retorna', async function () {
  const flags = { p2Connected: true };
  const ctx = storeContext({ players: twoPlayers(flags), status: stubStatus });

  await ctx.store.init();
  await ctx.store.selectPlayer('p2');
  assert.equal(ctx.store.state.playerId, 'p2');
  assert.equal(JSON.parse(ctx.backing[SESSION_KEY]).playerId, 'p2');

  // p2 dorme/desconecta: uma nova descoberta cai para o unico conectado, mas
  // NAO pode reescrever a preferencia gravada.
  flags.p2Connected = false;
  await ctx.store.init();
  assert.equal(ctx.store.state.playerId, 'p1', 'o fallback assume o unico player conectado');
  await ctx.store.refresh();
  assert.equal(JSON.parse(ctx.backing[SESSION_KEY]).playerId, 'p2',
    'o refresh tomado durante o fallback nao pode sobrescrever a preferencia guardada');

  // p2 volta: a preferencia guardada volta a ser honrada, sem que o usuario
  // precise escolher de novo.
  flags.p2Connected = true;
  await ctx.store.init();
  assert.equal(ctx.store.state.playerId, 'p2',
    'a preferencia reaparece assim que o player preferido volta a responder');
});

test('um player padrao configurado em Ajustes vence o ultimo usado', async function () {
  const flags = { p2Connected: true };
  const ctx = storeContext(
    { players: twoPlayers(flags), status: stubStatus },
    { state: { defaultPlayer: 'p2' } }
  );
  await ctx.store.init();
  await ctx.store.selectPlayer('p1'); // ultimo usado explicito
  assert.equal(ctx.store.state.playerId, 'p1');

  // uma nova descoberta tem de preferir o default configurado, mesmo com p1
  // sendo o ultimo usado e continuando disponivel.
  await ctx.store.init();
  assert.equal(ctx.store.state.playerId, 'p2');
});

test('"Last used" (o sentinela default) se comporta exatamente como antes', async function () {
  const flags = { p2Connected: true };
  const ctx = storeContext(
    { players: twoPlayers(flags), status: stubStatus },
    { state: { defaultPlayer: 'last' } }
  );
  await ctx.store.init();
  await ctx.store.selectPlayer('p2');
  await ctx.store.init();
  assert.equal(ctx.store.state.playerId, 'p2');
});

test('um default persistido desconhecido cai de volta sem lancar', async function () {
  // Nenhum player conectado e nenhuma sessao anterior: o unico jeito de
  // resolver o default fantasma seria a sonda de resurreicao, que tambem
  // falha aqui -- exatamente o caso em que um throw sem tratamento derrubaria
  // init().
  const ctx = storeContext(
    {
      players: async function () {
        return [
          { id: 'p1', name: 'Kitchen', connected: false, power: false },
          { id: 'p2', name: 'Office', connected: false, power: false }
        ];
      },
      status: async function () { throw new Error('no player answers'); }
    },
    { state: { defaultPlayer: 'ghost-player' } }
  );
  await assert.doesNotReject(ctx.store.init());
  assert.equal(ctx.store.state.playerId, null);
  assert.equal(ctx.store.state.connected, false);
  assert.equal(ctx.store.state.lastError, 'No player is connected.');
});

test('Playback: play reloads the known stopped track when LMS reports no queue', async function () {
  const loaded = [];
  const transports = [];
  let statusCalls = 0;
  const ctx = storeContext({
    status: async function () {
      statusCalls++;
      return {
        mode: statusCalls > 1 ? 'play' : 'stop',
        time: 0, duration: 123, volume: 50,
        track: {
          id: 42, title: 'Back Home', artist: 'Zomby Woof',
          album: 'Riding On A Tear', coverId: null, url: 'file:///track.flac'
        },
        sampleRate: 44100, sampleSize: 16, format: 'FLC', live: false
      };
    },
    loadTrack: async function (playerId, trackId) { loaded.push([playerId, trackId]); },
    songInfo: async function (playerId, trackId) {
      return { id: trackId, albumId: 7, sampleRate: 44100, sampleSize: 16, format: 'FLC' };
    },
    queue: async function () {
      return { tracks: [track(0)], index: 0, total: 1, shuffle: 0, repeat: 0 };
    },
    transport: async function (playerId, cmd) { transports.push([playerId, cmd]); }
  });

  await ctx.store.init();
  await ctx.store.refresh();
  assert.equal(ctx.store.state.mode, 'stop');
  assert.equal(ctx.store.state.queueTotal, 0);
  await ctx.store.play();
  assert.deepEqual(loaded, [['p1', 42]]);
  assert.deepEqual(transports, [['p1', 'play']]);
  assert.equal(ctx.store.state.mode, 'play');
  assert.equal(ctx.store.state.queueTotal, 1);
});

test('Playback: play rebuilds the album queue for a remembered album track', async function () {
  const loadedContainers = [];
  const jumps = [];
  const loadedTracks = [];
  let statusCalls = 0;
  const ctx = storeContext({
    status: async function () {
      statusCalls++;
      return {
        mode: statusCalls > 1 ? 'play' : 'stop',
        time: 0, duration: 123, volume: 50,
        track: {
          id: 42, title: 'Back Home', artist: 'Zomby Woof',
          album: 'Riding On A Tear', albumId: 7, trackNum: 10,
          coverId: null, url: 'file:///track.flac'
        },
        sampleRate: 44100, sampleSize: 16, format: 'FLC', live: false
      };
    },
    loadContainer: async function (playerId, key, id) { loadedContainers.push([playerId, key, id]); },
    queueJump: async function (playerId, index) { jumps.push([playerId, index]); },
    loadTrack: async function (playerId, trackId) { loadedTracks.push([playerId, trackId]); },
    songInfo: async function (playerId, trackId) {
      return { id: trackId, albumId: 7, sampleRate: 44100, sampleSize: 16, format: 'FLC' };
    },
    queue: async function () {
      return { tracks: [track(0), track(1)], index: 1, total: 10, shuffle: 0, repeat: 0 };
    },
    transport: async function () { throw new Error('album fallback should not use single-track transport'); }
  });

  await ctx.store.init();
  await ctx.store.refresh();
  assert.equal(ctx.store.state.mode, 'stop');
  assert.equal(ctx.store.state.queueTotal, 0);
  await ctx.store.play();
  assert.deepEqual(loadedContainers, [['p1', 'album_id', 7]]);
  assert.deepEqual(jumps, [['p1', 9]]);
  assert.deepEqual(loadedTracks, []);
  assert.equal(ctx.store.state.mode, 'play');
  assert.equal(ctx.store.state.queueTotal, 10);
});

test('Playback: play rebuilds a stopped one-track album queue created by the old fallback', async function () {
  const loadedContainers = [];
  const jumps = [];
  const ctx = storeContext({
    status: async function () {
      return {
        mode: 'stop',
        time: 0, duration: 123, volume: 50,
        track: {
          id: 42, title: 'Back Home', artist: 'Zomby Woof',
          album: 'Riding On A Tear', albumId: 7, trackNum: 10,
          coverId: null, url: 'file:///track.flac'
        },
        sampleRate: 44100, sampleSize: 16, format: 'FLC', live: false
      };
    },
    loadContainer: async function (playerId, key, id) { loadedContainers.push([playerId, key, id]); },
    queueJump: async function (playerId, index) { jumps.push([playerId, index]); },
    songInfo: async function (playerId, trackId) {
      return { id: trackId, albumId: 7, trackNum: 10, sampleRate: 44100, sampleSize: 16, format: 'FLC' };
    },
    queue: async function () {
      return { tracks: [track(0)], index: 0, total: 1, shuffle: 0, repeat: 0 };
    },
    transport: async function () { throw new Error('one-track album fallback should not use plain play'); }
  });

  await ctx.store.init();
  await ctx.store.refresh();
  await ctx.store.loadQueue();
  assert.equal(ctx.store.state.mode, 'stop');
  assert.equal(ctx.store.state.queueTotal, 1);
  await ctx.store.play();
  assert.deepEqual(loadedContainers, [['p1', 'album_id', 7]]);
  assert.deepEqual(jumps, [['p1', 9]]);
});

test('Playback: next/previous on an empty queue gives visible feedback instead of a silent no-op', async function () {
  const notes = [];
  let transportCalls = 0;
  const ctx = storeContext({
    status: stubStatus,
    transport: async function () { transportCalls++; },
    queue: async function () {
      return { tracks: [], index: 0, total: 0, shuffle: 0, repeat: 0 };
    }
  }, {
    notify: function (msg, kind) { notes.push({ msg: msg, kind: kind }); },
    setBusy: function () {},
    state: { defaultPlayer: 'last' }
  });

  await ctx.store.init();
  await ctx.store.next();
  assert.equal(transportCalls, 0);
  assert.deepEqual(notes, [{ msg: 'The playback queue is empty.', kind: 'error' }]);
});

/* EC-014. O carimbo do desfazer pertence ao player cuja fila foi destruida.
   setQueueUndo relia state.playerId DEPOIS dos awaits do mutador: trocar de
   player no meio carimbava o player NOVO, e a checagem de dono em undoQueue
   entao aprovava injetar a fila da sala antiga na sala nova.

   O segundo grupo cobre o outro lado do mesmo defeito: clearQueue tirava o
   retrato de state.queue, que e so a janela de 500 linhas, enquanto
   queueClear destroi a playlist inteira do servidor. */
function queueContext(apiExtra, notes) {
  return storeContext(Object.assign({
    status: stubStatus,
    queue: async function () {
      return { tracks: [], index: 0, total: 0, shuffle: 0, repeat: 0 };
    },
    queueRemove: async function () {},
    queueClear: async function () {},
    queueMove: async function () {},
    queueControl: async function () {},
    queueJump: async function () {}
  }, apiExtra || {}), {
    notify: function (msg, kind) { notes.push({ msg: String(msg), kind: kind }); }
  });
}

function track(i) { return { index: i, id: 100 + i, title: 'T' + i }; }

function seedQueue(state, tracks, total, index) {
  state.playerId = 'p1';
  state.connected = true;
  state.queue = tracks;
  state.queueTotal = total == null ? tracks.length : total;
  state.queueIndex = index || 0;
}

function truncationNotes(notes) {
  return notes.filter(function (n) { return n.msg.indexOf('could be read') !== -1; });
}

function failureNotes(notes) {
  return notes.filter(function (n) { return n.msg.indexOf('failed.') !== -1; });
}

test('EC-014 removeFromQueue carimba o desfazer no player de origem, nao no player para o qual se trocou durante o await', async function () {
  const notes = [];
  let ctx;
  ctx = queueContext({
    queueRemove: async function () { ctx.store.state.playerId = 'p2'; }
  }, notes);
  seedQueue(ctx.store.state, [track(0), track(1)]);

  await ctx.store.removeFromQueue(0);

  assert.deepEqual(failureNotes(notes), []);
  assert.equal(ctx.store.state.queueUndo.length, 1);
  assert.equal(ctx.store.state.queueUndoPlayerId, 'p1',
    'o desfazer pertence a p1, cuja faixa foi removida, nao a p2, para onde o usuario trocou');
});

test('EC-014 clearQueue carimba o desfazer no player cuja fila foi destruida', async function () {
  const notes = [];
  let ctx;
  ctx = queueContext({
    queueClear: async function () { ctx.store.state.playerId = 'p2'; }
  }, notes);
  seedQueue(ctx.store.state, [track(0), track(1)]);

  await ctx.store.clearQueue();

  assert.deepEqual(failureNotes(notes), []);
  assert.equal(ctx.store.state.queueUndo.length, 2);
  assert.equal(ctx.store.state.queueUndoPlayerId, 'p1',
    'restaurar isto em p2 encheria a sala errada com a fila de p1');
});

test('EC-014 clearUpcoming carimba o desfazer no player de origem mesmo quando o laco e interrompido pela troca', async function () {
  const notes = [];
  let removals = 0;
  let ctx;
  ctx = queueContext({
    queueRemove: async function () {
      removals++;
      if (removals === 1) ctx.store.state.playerId = 'p2';
    }
  }, notes);
  seedQueue(ctx.store.state, [track(0), track(1), track(2)], 3, 0);

  await ctx.store.clearUpcoming();

  assert.deepEqual(failureNotes(notes), []);
  assert.equal(removals, 1, 'a troca de player tem de interromper o laco de remocao');
  assert.equal(ctx.store.state.queueUndo.length, 1, 'so o que foi de fato removido entra no desfazer');
  assert.equal(ctx.store.state.queueUndoPlayerId, 'p1');
});

test('EC-014 clearQueue guarda a fila inteira do servidor, nao a janela de 500 linhas', async function () {
  const notes = [];
  const total = 698;
  const all = [];
  for (let i = 0; i < total; i++) all.push(track(i));
  const ctx = queueContext({
    queue: async function (playerId, start, page) {
      return { tracks: all.slice(start, start + page), index: 0, total: total, shuffle: 0, repeat: 0 };
    }
  }, notes);
  seedQueue(ctx.store.state, all.slice(0, 500), total);

  await ctx.store.clearQueue();

  assert.equal(ctx.store.state.queueUndo.length, total,
    'queueClear destroi as 698; o desfazer tem de poder devolver as 698');
  assert.equal(ctx.store.state.queueUndo[697].item.id, all[697].id);
  assert.deepEqual(truncationNotes(notes), [], 'nada se perdeu, entao nao ha o que avisar');
});

test('EC-014 clearQueue avisa quando nem tudo pode ser lido antes de destruir', async function () {
  const notes = [];
  const total = 698;
  const all = [];
  for (let i = 0; i < total; i++) all.push(track(i));
  const ctx = queueContext({
    queue: async function (playerId, start, page) {
      // o servidor para de entregar depois da primeira pagina
      if (start > 0) return { tracks: [], index: 0, total: total, shuffle: 0, repeat: 0 };
      return { tracks: all.slice(0, page), index: 0, total: total, shuffle: 0, repeat: 0 };
    }
  }, notes);
  seedQueue(ctx.store.state, all.slice(0, 500), total);

  await ctx.store.clearQueue();

  const warned = truncationNotes(notes);
  assert.equal(warned.length, 1, 'perder 198 faixas em silencio e o defeito');
  assert.equal(warned[0].kind, 'error');
  assert.ok(warned[0].msg.indexOf('698') !== -1 && warned[0].msg.indexOf('500') !== -1);
  assert.equal(ctx.store.state.queueUndo.length, 500);
});

test('EC-014 uma fila que cabe inteira na janela nao produz aviso de truncamento', async function () {
  const notes = [];
  const ctx = queueContext({}, notes);
  seedQueue(ctx.store.state, [track(0), track(1), track(2)], 3);

  await ctx.store.clearQueue();

  assert.deepEqual(truncationNotes(notes), []);
  assert.equal(ctx.store.state.queueUndo.length, 3);
});

/* STATE-01: losing the player was treated as an indicator, not a transition.
   The screen showed `No player was found on LMS` next to the track Take on Me,
   with the progress bar running and Previous/Play/Stop/Next enabled -- three
   different answers to the same question. Retry did not settle it; only a
   reload did, and it settled it by wiping everything to `Nothing playing`.

   The transition now happens in one place and all at once. The cached track
   stays -- it is the "last known track" the banner promises -- while the idea
   of playback in progress, and of a command with somewhere to go, does not. */

function playingStatus(mode) {
  return {
    mode: mode || 'play', time: 96, duration: 227, volume: 40,
    track: {
      id: 771, title: 'Take on Me', artist: 'a-ha', album: 'Hunting High and Low',
      albumId: 12, trackNum: 1, coverId: 771, url: 'file:///take.flac'
    },
    sampleRate: 44100, sampleSize: 16, format: 'flc',
    queue: [], queueIndex: 0, queueTotal: 0, shuffle: 0, repeat: 0
  };
}

async function playingThenGone(remaining) {
  let players = [{ id: 'p1', name: 'Kitchen', connected: true, power: true }];
  let gone = false;
  const ctx = storeContext({
    players: async function () { return players; },
    status: async function () {
      /* How it happens for real: the player stops answering first, which only
         flips the connection indicator, and the next refresh rediscovers and
         finds nobody. That second step is where the contradiction lived. */
      if (gone) { const e = new Error('down'); e.kind = 'network'; throw e; }
      return playingStatus('play');
    },
    songInfo: async function () { return { id: 771 }; },
    favoritesLevel: async function () { return []; },
    queue: async function () { return { items: [], total: 0 }; }
  });
  await ctx.store.init();
  await ctx.store.refresh();
  gone = true;
  players = remaining;
  await ctx.store.refresh();
  return ctx;
}

test('STATE-01: the transition to zero players updates connection, track and commands together', async function () {
  const ctx = await playingThenGone([]);
  const state = ctx.store.state;

  assert.equal(state.np.title, 'Take on Me', 'sanity: the track is still on screen');

  await ctx.store.refresh();

  assert.equal(state.playerId, null);
  assert.equal(state.connected, false);
  assert.equal(state.lastError, 'No player was found on LMS.');
  assert.equal(state.commandable, false,
    'Previous/Play/Stop/Next had no destination and were still enabled -- that is the contradiction');
  assert.equal(state.mode, 'stop', 'a running mode with no player is what kept the progress bar moving');
  assert.equal(state.time, 0);
  assert.equal(state.duration, 0);
  assert.equal(state.np.title, 'Take on Me',
    'the cached track is kept on purpose: the banner offers it as the last known track');
});

test('STATE-01: it settles without a reload -- a second refresh changes nothing further', async function () {
  const ctx = await playingThenGone([]);
  await ctx.store.refresh();
  const first = JSON.stringify(ctx.store.state);
  await ctx.store.refresh();
  assert.equal(JSON.stringify(ctx.store.state), first,
    'Retry left a mixed state that only a reload cleared; the transition has to be idempotent');
});

test('STATE-01: players present but none connected reads differently and is equally disarmed', async function () {
  const ctx = await playingThenGone([{ id: 'p1', name: 'Kitchen', connected: false, power: false }]);
  await ctx.store.refresh();
  assert.equal(ctx.store.state.lastError, 'No player is connected.');
  assert.equal(ctx.store.state.commandable, false);
  assert.equal(ctx.store.state.mode, 'stop');
});

test('STATE-01: a player that stops answering keeps the screen but loses the right to command', async function () {
  let fail = false;
  const ctx = storeContext({
    players: async function () { return [{ id: 'p1', name: 'Kitchen', connected: true, power: true }]; },
    status: async function () {
      if (fail) { const e = new Error('down'); e.kind = 'network'; throw e; }
      return playingStatus('play');
    },
    songInfo: async function () { return { id: 771 }; },
    favoritesLevel: async function () { return []; },
    queue: async function () { return { items: [], total: 0 }; }
  });
  await ctx.store.init();
  await ctx.store.refresh();
  fail = true;
  await ctx.store.refresh();

  assert.equal(ctx.store.state.connected, false);
  assert.equal(ctx.store.state.commandable, false,
    'nothing is reaching the player, so a transport command has nowhere to land');
  assert.equal(ctx.store.state.np.title, 'Take on Me', 'the last screen is deliberately kept here');
});
