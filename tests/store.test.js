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
