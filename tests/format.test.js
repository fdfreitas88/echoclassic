const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('format helpers cover duration, long duration, depth and cover sizes', function () {
  const ctx = helpers.runBrowserFile('EchoClassic/HTML/echoclassic/html/js/format.js');
  const fmt = ctx.LmsFmt;

  assert.equal(fmt.duration(75 * 60 + 4), '1:15:04');
  assert.equal(fmt.duration(-2), '0:00');
  assert.equal(fmt.longDuration(59), 'less than 1 minute');
  assert.equal(fmt.longDuration(59 * 60 + 40), '1 h');
  assert.equal(fmt.longDuration(2 * 3600 + 31 * 60), '2 h 31 min');
  assert.notEqual(fmt.longDuration(59 * 60 + 40), '60 min');
  assert.equal(fmt.depth(1), '1 bits');
  assert.equal(fmt.depth(24), '24 bits');
  assert.equal(fmt.coverUrl('a/b c', 512), '/music/a%2Fb%20c/cover_512x512.jpg');
  assert.equal(fmt.coverUrl('cover', 0), '/music/cover/cover.jpg');
});

/* O LMS nao tem uma unidade so para bitrate: no tag do `titles` ele manda a
   string pronta ("5641kbps VBR"), e em outros caminhos manda bits por segundo.
   Quem consumia dividia por 1000 sempre, e um FLAC de 2116 kbps aparecia como
   "2 kbps" no cabecalho do album -- visto na tela do servidor real. */
test('bitrate e normalizado para kbps na fronteira da API', function () {
  const ctx = helpers.runBrowserFile('EchoClassic/HTML/echoclassic/html/js/api.js', {
    fetch: function () { return Promise.resolve({}); },
    LmsFmt: { year: function (v) { return v; }, coverUrl: function () { return ''; } },
    document: { addEventListener: function () {} },
    location: { origin: 'http://x' },
    AbortController: function () { this.signal = null; this.abort = function () {}; }
  });
  const kbps = ctx.LmsApi.__kbps;
  assert.equal(typeof kbps, 'function', 'a normalizacao precisa ser testavel');

  assert.equal(kbps('5641kbps VBR'), 5641, 'string com unidade ja vem em kbps');
  assert.equal(kbps('2116kbps'), 2116);
  assert.equal(kbps(1411000), 1411, 'numero grande e bits por segundo');
  assert.equal(kbps(320), 320, 'numero pequeno ja e kbps');
  assert.equal(kbps(0), 0);
  assert.equal(kbps(null), 0);
  assert.equal(kbps(''), 0);
  assert.equal(kbps('sem numero'), 0);
});
