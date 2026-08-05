const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

/* Fase 1 da 3.2.0: o sortKey unico decidia ao mesmo tempo o que filtrar, como
   ordenar e se agrupava. Era ele que produzia os bugs B e C da 3.1.3, e e ele
   que impede combinar filtros. Aqui os tres viram estado proprio.

   Estes testes cobrem o modelo de estado; o comportamento de tela continua em
   browse.test.js. */

/* O vm roda noutro realm: um [] de la nao e deepStrictEqual a um [] daqui,
   porque os prototipos diferem. Normalizar preserva a forca da asserção --
   compara valor a valor, so em objetos deste realm. */
function plain(v) { return JSON.parse(JSON.stringify(v)); }

function ui(saved) {
  const store = {};
  if (saved) store['echoclassic.ui.v2'] = JSON.stringify(saved);
  return helpers.uiContext({
    localStorage: {
      getItem: function (k) { return k in store ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    __store: store
  }).LmsUi;
}

test('cada view comeca com filtro vazio e a ordenacao propria', function () {
  const u = ui();
  u.setMusicView('recent');
  assert.deepEqual(plain(u.state.filters), []);
  assert.deepEqual(plain(u.state.group), []);
  assert.equal(u.state.sort[0].key, 'recent', 'Recentes nasce na ordem do servidor');

  u.setMusicView('years');
  assert.equal(u.state.sort[0].key, 'year');

  u.setMusicView('albums');
  assert.equal(u.state.sort[0].key, 'name');
});

test('filtrar e ordenar deixam de ser a mesma coisa', function () {
  const u = ui();
  u.setMusicView('albums');
  u.setSort([{ key: 'year', desc: true }]);
  u.setFilters(['format:flac']);

  assert.deepEqual(plain(u.state.filters), ['format:flac'], 'o filtro entrou');
  assert.equal(u.state.sort[0].key, 'year', 'e NAO apagou a ordenacao');
  assert.equal(u.state.sort[0].desc, true);

  u.clearFilters();
  assert.deepEqual(plain(u.state.filters), []);
  assert.equal(u.state.sort[0].key, 'year', 'limpar o filtro preserva a ordenacao');
});

test('agrupar e ordenar deixam de ser a mesma coisa', function () {
  const u = ui();
  u.setMusicView('albums');
  u.setSort([{ key: 'year', desc: false }]);
  u.setGroup(['artist']);

  assert.deepEqual(plain(u.state.group), ['artist']);
  assert.equal(u.state.sort[0].key, 'year', 'agrupar nao mexe na ordenacao');

  u.clearGroup();
  assert.deepEqual(plain(u.state.group), []);
});

test('so Albuns agrupa; Recentes ordena por artista mas nunca agrupa', function () {
  const u = ui();
  u.setMusicView('albums');
  u.setGroup(['artist']);
  assert.deepEqual(plain(u.state.group), ['artist']);

  u.setMusicView('recent');
  u.setGroup(['artist']);
  assert.deepEqual(plain(u.state.group), [], 'Recentes desenha album sempre — nao ha o que agrupar');
  u.setSort([{ key: 'artist', desc: false }]);
  assert.equal(u.state.sort[0].key, 'artist', 'mas ordenar por artista continua valendo');
});

test('filtro de midia so existe onde a view sabe aplicar', function () {
  const u = ui();
  u.setMusicView('artists');
  u.setFilters(['quality:hires']);
  assert.deepEqual(plain(u.state.filters), [], 'Artistas nao filtra por midia');

  u.setMusicView('albums');
  u.setFilters(['quality:hires', 'lixo:inexistente']);
  assert.deepEqual(plain(u.state.filters), ['quality:hires'], 'chave invalida e descartada, o resto entra');
});

test('cada view lembra o proprio conjunto', function () {
  const u = ui();
  u.setMusicView('albums');
  u.setFilters(['format:flac']);
  u.setSort([{ key: 'year', desc: true }]);

  u.setMusicView('recent');
  u.setFilters(['stream:qobuz']);
  assert.deepEqual(plain(u.state.filters), ['stream:qobuz']);

  u.setMusicView('albums');
  assert.deepEqual(plain(u.state.filters), ['format:flac'], 'Albuns manteve o dele');
  assert.equal(u.state.sort[0].key, 'year');
});

/* A migracao e o ponto delicado: quem ja usava a skin tem um sortKey unico
   gravado, e ele precisa ser desmembrado no conceito certo -- senao a pessoa
   abre a 3.2.0 e perde a escolha, ou pior, ganha um agrupamento que nao pediu. */
test('migra sortKey de midia para filtro, preservando a ordenacao padrao', function () {
  const u = ui({ musicView: 'recent', sortKey: 'stream:qobuz', sortDesc: false,
                 sortByView: { recent: 'stream:qobuz' }, recentSortMigrated: true });
  u.setMusicView('recent');
  assert.deepEqual(plain(u.state.filters), ['stream:qobuz'], 'virou filtro');
  assert.equal(u.state.sort[0].key, 'recent', 'e a ordenacao voltou ao padrao da view');
  assert.deepEqual(plain(u.state.group), []);
});

test('migra sortKey de agrupamento para grupo, e nao para filtro', function () {
  const u = ui({ musicView: 'albums', sortKey: 'artist', sortDesc: false,
                 sortByView: { albums: 'artist' }, recentSortMigrated: true });
  u.setMusicView('albums');
  assert.deepEqual(plain(u.state.group), ['artist'], 'em Albuns, Artista agrupa');
  assert.deepEqual(plain(u.state.filters), []);
});

test('migra sortKey de ordenacao para ordenacao, com a direcao', function () {
  const u = ui({ musicView: 'albums', sortKey: 'year', sortDesc: true,
                 sortByView: { albums: 'year' }, recentSortMigrated: true });
  u.setMusicView('albums');
  assert.equal(u.state.sort[0].key, 'year');
  assert.equal(u.state.sort[0].desc, true, 'a direcao sobreviveu');
  assert.deepEqual(plain(u.state.group), []);
  assert.deepEqual(plain(u.state.filters), []);
});

test('em Recentes, Artista migra como ordenacao — nunca como agrupamento', function () {
  const u = ui({ musicView: 'recent', sortKey: 'artist', sortDesc: false,
                 sortByView: { recent: 'artist' }, recentSortMigrated: true });
  u.setMusicView('recent');
  assert.deepEqual(plain(u.state.group), [], 'era a armadilha do bug C; nao pode virar grupo');
  assert.equal(u.state.sort[0].key, 'artist');
});

test('inverter a ordem mexe so no criterio primario', function () {
  const u = ui();
  u.setMusicView('albums');
  u.setSort([{ key: 'year', desc: false }]);
  u.toggleSortDir();
  assert.equal(u.state.sort[0].desc, true);
  u.toggleSortDir();
  assert.equal(u.state.sort[0].desc, false);
});

test('o estado sobrevive a recarga', function () {
  const store = {};
  const fresh = function () {
    return helpers.uiContext({
      localStorage: {
        getItem: function (k) { return k in store ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; }
      }
    }).LmsUi;
  };
  const a = fresh();
  a.setMusicView('albums');
  a.setFilters(['format:flac']);
  a.setSort([{ key: 'year', desc: true }]);
  a.setGroup(['artist']);

  const b = fresh();
  b.setMusicView('albums');
  assert.deepEqual(plain(b.state.filters), ['format:flac']);
  assert.equal(b.state.sort[0].key, 'year');
  assert.equal(b.state.sort[0].desc, true);
  assert.deepEqual(plain(b.state.group), ['artist']);
});
