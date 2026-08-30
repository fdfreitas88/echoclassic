const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

function apiWithBody(body) {
  return helpers.runBrowserFile('EchoClassic/HTML/echoclassic/html/js/api.js', {
    fetch: function () { return Promise.resolve({ ok: true, json: function () { return Promise.resolve(body); } }); },
    document: { addEventListener: function () {} },
    location: { origin: 'http://x' },
    AbortController: function () { this.signal = null; this.abort = function () {}; }
  }).LmsApi;
}

test('JSON-RPC rejects valid JSON with no object result envelope', async function () {
  await assert.rejects(apiWithBody({}).serverInfo(), /invalid JSON-RPC response/);
  await assert.rejects(apiWithBody({ result: null }).serverInfo(), /invalid JSON-RPC result/);
  await assert.rejects(apiWithBody({ result: [] }).serverInfo(), /invalid JSON-RPC result/);
});

test('malformed loop fields degrade to an empty list instead of throwing', async function () {
  const api = apiWithBody({ result: { artists_loop: { id: 1, artist: 'wrong shape' } } });
  assert.deepEqual(JSON.parse(JSON.stringify(await api.artists('p1', 0, 10))), []);
});

test('edge-sensitive store mutations capture identity and validate numbers', function () {
  const store = helpers.read('EchoClassic/HTML/echoclassic/html/js/store.js');
  assert.match(store, /async function setTransition[\s\S]*?var playerId = state\.playerId;[\s\S]*?state\.playerId !== playerId/);
  assert.match(store, /async function setSleep[\s\S]*?Number\.isSafeInteger\(value\)[\s\S]*?state\.playerId !== playerId/);
  assert.match(store, /async function setRating[\s\S]*?var trackId = state\.np\.id;[\s\S]*?state\.np\.id !== trackId/);
  assert.match(store, /async function seek[\s\S]*?var previous = state\.time;[\s\S]*?state\.time = previous/);
  assert.match(store, /async function moveInQueue[\s\S]*?Number\.isInteger\(from\)[\s\S]*?from >= total \|\| to >= total/);
});

test('Apple Squeezer loads and telemetry discard stale-player responses', function () {
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  assert.match(settings, /loadAppleSqueezer: async function[\s\S]*?var playerId = this\.store\.playerId;[\s\S]*?token !== this\.appleSqueezerLoadToken \|\| this\.store\.playerId !== playerId/);
  assert.match(settings, /refreshAppleSqueezerTelemetry: async function[\s\S]*?var playerId = this\.store\.playerId;[\s\S]*?token !== this\.appleSqueezerTelemetryToken \|\| this\.store\.playerId !== playerId/);
  assert.match(settings, /parsedConfig && typeof parsedConfig === 'object' && !Array\.isArray\(parsedConfig\)/);
  assert.match(settings, /expert\.every\(isFinite\)/);
});

test('queue UI announces destructive mutations only after confirmed success', function () {
  const queue = helpers.read('EchoClassic/HTML/echoclassic/html/js/queue.js');
  assert.match(queue, /var removed = await LmsStore\.removeFromQueue\(t\.index\);\s*if \(removed === false\) return;/);
  assert.match(queue, /then\(function \(moved\) \{\s*if \(moved === false\) return;/);
});

test('artist primary actions require a real album id', function () {
  const detail = helpers.read('EchoClassic/HTML/echoclassic/html/js/detail.js');
  assert.match(detail, /this\.primaryAlbum && this\.primaryAlbum\.id != null/);
  assert.match(detail, /!album \|\| album\.id == null/);
});
