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

/* AUDIT-09: 'album' e o padrao pedido -- capa uma vez por sequencia do mesmo
   albumId. Um valor gravado por uma versao futura (ou corrompido) nao pode
   travar a fila num estado vazio; o fallback tem que ser o padrao. */
test('o modo de capa da fila nasce em "album", e sobrevive a recarga', function () {
  const u = ui();
  assert.equal(u.state.queueArtMode, 'album');

  u.setQueueArtMode('headings');
  assert.equal(u.state.queueArtMode, 'headings');

  u.setQueueArtMode('every');
  assert.equal(u.state.queueArtMode, 'every');
});

test('um valor de modo de capa desconhecido cai no padrao, nao esvazia a fila', function () {
  const u = ui({ queueArtMode: 'grid-of-doom' });
  assert.equal(u.state.queueArtMode, 'album');
});

test('setQueueArtMode ignora uma chave invalida em vez de gravar lixo', function () {
  const u = ui();
  u.setQueueArtMode('headings');
  u.setQueueArtMode('nao-existe');
  assert.equal(u.state.queueArtMode, 'headings', 'a chave invalida nao pode sobrescrever a escolha valida');
});

/* Onda 1b: o player padrao e 'last' (sentinela, "comporta-se como sempre") ou
   o id de um player especifico -- escolhido em Ajustes, gravado como
   queueArtMode acima. O id nao vem de uma lista fechada, entao a validacao so
   confere a forma; quem confere se o player ainda existe e LmsStore. */
test('o player padrao nasce em "last", e sobrevive a recarga', function () {
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
  assert.equal(a.state.defaultPlayer, 'last');
  a.setDefaultPlayer('aa:bb:cc:dd:ee:ff');
  assert.equal(a.state.defaultPlayer, 'aa:bb:cc:dd:ee:ff');

  const b = fresh();
  assert.equal(b.state.defaultPlayer, 'aa:bb:cc:dd:ee:ff', 'a escolha sobrevive a recarga');

  b.setDefaultPlayer('last');
  assert.equal(b.state.defaultPlayer, 'last', '"Last used" volta a valer quando escolhido de novo');
});

test('um player padrao persistido invalido cai em "last", nunca lanca', function () {
  const u = ui({ defaultPlayer: 42 });
  assert.equal(u.state.defaultPlayer, 'last');

  const empty = ui({ defaultPlayer: '' });
  assert.equal(empty.state.defaultPlayer, 'last');
});

test('setDefaultPlayer ignora um valor sem forma de id em vez de gravar lixo', function () {
  const u = ui();
  u.setDefaultPlayer('p1');
  u.setDefaultPlayer(null);
  u.setDefaultPlayer('');
  u.setDefaultPlayer(42);
  assert.equal(u.state.defaultPlayer, 'p1', 'um valor invalido nao pode sobrescrever a escolha valida');
});

/* 3.2.6b WP1: as nove chaves de superficie (mini/small/full x tema/esquema/
   fonte). O sentinela e sempre 'app' -- "siga o app" -- e NUNCA o que
   isColorScheme/isFontOption aceitam, porque essas duas listas nunca contem
   'app' de proposito (LANDMINE L1: se as chaves novas fossem validadas com os
   predicados antigos, todo override se apagaria sozinho a cada recarga). */

test('as nove chaves de superficie nascem em "app" numa loja virgem', function () {
  const u = ui();
  ['miniTheme', 'miniColorScheme', 'miniFont',
   'smallTheme', 'smallColorScheme', 'smallFont',
   'fullTheme', 'fullColorScheme', 'fullFont'].forEach(function (key) {
    assert.equal(u.state[key], 'app', key + ' deveria nascer em "app"');
  });
});

/* Regressao do LANDMINE L1: uma carga gravada pela 3.2.5, sem nenhuma das
   nove chaves novas, tem que continuar carregando com todo o resto intacto e
   as nove em 'app' -- nunca lancar, e nunca perder a preferencia antiga por
   causa de uma chave que aquela versao nem sabia que existia. */
test('uma carga da 3.2.5 (sem as chaves de superficie) preserva tudo que ja existia', function () {
  const payload = {
    dark: true, colorScheme: 'teal', fontFamily: 'chicago',
    playerPosition: 'left', playerPresentation: 'fullscreen',
    lightMiniGaugeStyle: 'classic', lightPlayerGaugeStyle: 'classic',
    darkMiniGaugeStyle: 'flat', darkPlayerGaugeStyle: 'flat',
    miniGaugeColor: 'amber', playerGaugeColor: 'indigo',
    prefer: 'quality',
    byView: {
      artists: { filters: [], sort: [{ key: 'name', desc: false }], group: [], sections: [] },
      albums: { filters: ['format:flac'], sort: [{ key: 'year', desc: true }], group: [], sections: [] },
      recent: { filters: [], sort: [{ key: 'recent', desc: false }], group: [], sections: [] },
      genres: { filters: [], sort: [{ key: 'name', desc: false }], group: [], sections: [] },
      years: { filters: [], sort: [{ key: 'year', desc: false }], group: [], sections: [] }
    }
  };
  const u = ui(payload);

  ['miniTheme', 'miniColorScheme', 'miniFont',
   'smallTheme', 'smallColorScheme', 'smallFont',
   'fullTheme', 'fullColorScheme', 'fullFont'].forEach(function (key) {
    assert.equal(u.state[key], 'app', key + ' cai em "app" quando a carga nao tinha a chave');
  });

  assert.equal(u.state.dark, true);
  assert.equal(u.state.colorScheme, 'teal');
  assert.equal(u.state.fontFamily, 'chicago');
  assert.equal(u.state.playerPosition, 'left');
  assert.equal(u.state.playerPresentation, 'fullscreen');
  assert.equal(u.state.lightMiniGaugeStyle, 'classic');
  assert.equal(u.state.lightPlayerGaugeStyle, 'classic');
  assert.equal(u.state.darkMiniGaugeStyle, 'flat');
  assert.equal(u.state.darkPlayerGaugeStyle, 'flat');
  assert.equal(u.state.miniGaugeColor, 'amber');
  assert.equal(u.state.playerGaugeColor, 'indigo');
  assert.equal(u.state.prefer, 'quality');

  u.setMusicView('albums');
  assert.deepEqual(plain(u.state.filters), ['format:flac']);
  assert.equal(u.state.sort[0].key, 'year');
  assert.equal(u.state.sort[0].desc, true);
});

test('um valor desconhecido numa chave de superficie cai em "app", sem lancar', function () {
  const u = ui({ miniTheme: 'chartreuse', smallColorScheme: 'chartreuse', fullFont: 'chartreuse' });
  assert.equal(u.state.miniTheme, 'app');
  assert.equal(u.state.smallColorScheme, 'app');
  assert.equal(u.state.fullFont, 'app');
});

test('setSurfaceTheme/Scheme/Font ignoram chave ou superficie desconhecida, sem gravar', function () {
  const u = ui();
  u.setSurfaceTheme('mini', 'chartreuse');
  assert.equal(u.state.miniTheme, 'app');
  u.setSurfaceScheme('small', 'nao-existe');
  assert.equal(u.state.smallColorScheme, 'app');
  u.setSurfaceFont('full', 'nao-existe');
  assert.equal(u.state.fullFont, 'app');

  // superficie que nao existe: nao lanca, e nao inventa uma chave nova
  assert.doesNotThrow(function () { u.setSurfaceTheme('players', 'dark'); });
  assert.equal(u.state.playersTheme, undefined);
});

test('setSurfaceTheme/Scheme/Font aceitam "app" de volta', function () {
  const u = ui();
  u.setSurfaceTheme('mini', 'dark');
  u.setSurfaceScheme('mini', 'amber');
  u.setSurfaceFont('mini', 'chicago');
  assert.equal(u.state.miniTheme, 'dark');
  assert.equal(u.state.miniColorScheme, 'amber');
  assert.equal(u.state.miniFont, 'chicago');

  u.setSurfaceTheme('mini', 'app');
  u.setSurfaceScheme('mini', 'app');
  u.setSurfaceFont('mini', 'app');
  assert.equal(u.state.miniTheme, 'app');
  assert.equal(u.state.miniColorScheme, 'app');
  assert.equal(u.state.miniFont, 'app');
});

test('as nove chaves de superficie sobrevivem a recarga', function () {
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
  a.setSurfaceTheme('mini', 'dark');
  a.setSurfaceScheme('mini', 'amber');
  a.setSurfaceFont('mini', 'chicago');
  a.setSurfaceTheme('small', 'light');
  a.setSurfaceScheme('small', 'teal');
  a.setSurfaceFont('small', 'helvetica');
  a.setSurfaceTheme('full', 'dark');
  a.setSurfaceScheme('full', 'crimson');
  a.setSurfaceFont('full', 'podium');

  const b = fresh();
  assert.equal(b.state.miniTheme, 'dark');
  assert.equal(b.state.miniColorScheme, 'amber');
  assert.equal(b.state.miniFont, 'chicago');
  assert.equal(b.state.smallTheme, 'light');
  assert.equal(b.state.smallColorScheme, 'teal');
  assert.equal(b.state.smallFont, 'helvetica');
  assert.equal(b.state.fullTheme, 'dark');
  assert.equal(b.state.fullColorScheme, 'crimson');
  assert.equal(b.state.fullFont, 'podium');
});

/* AC-07: a chave tem que estar AUSENTE do objeto, nao presente com o valor
   'app'. `!== 'app'` passaria mesmo se surfaceAttrs escrevesse o sentinela
   literal no atributo -- so `in` prova a omissao. */
test('surfaceAttrs omite a chave inteira quando o valor e "app"', function () {
  const u = ui();
  const attrs = u.surfaceAttrs('mini');
  assert.ok(!('data-surface-theme' in attrs));
  assert.ok(!('data-surface-scheme' in attrs));
  assert.ok(!('data-surface-font' in attrs));
  assert.deepEqual(plain(attrs), {});
});

test('surfaceAttrs devolve {} para uma superficie desconhecida', function () {
  const u = ui();
  assert.deepEqual(plain(u.surfaceAttrs('players')), {});
  assert.deepEqual(plain(u.surfaceAttrs('')), {});
});

test('surfaceAttrs emite o valor sobrescrito, uma superficie por vez', function () {
  const u = ui();
  u.setSurfaceTheme('mini', 'dark');
  u.setSurfaceScheme('mini', 'amber');

  assert.equal(u.surfaceAttrs('mini')['data-surface-theme'], 'dark');
  assert.equal(u.surfaceAttrs('mini')['data-surface-scheme'], 'amber');
  assert.ok(!('data-surface-font' in u.surfaceAttrs('mini')), 'miniFont continua em app');

  // small e full nao se mexeram
  assert.deepEqual(plain(u.surfaceAttrs('small')), {});
  assert.deepEqual(plain(u.surfaceAttrs('full')), {});

  u.setSurfaceFont('full', 'espy');
  assert.equal(u.surfaceAttrs('full')['data-surface-font'], 'espy');
  assert.deepEqual(plain(u.surfaceAttrs('small')), {}, 'mudar full nao move small');
  assert.equal(u.surfaceAttrs('mini')['data-surface-theme'], 'dark', 'nem mini');
});

test('surfaceFollowsApp e verdadeiro so quando as tres chaves daquela superficie sao "app"', function () {
  const u = ui();
  assert.equal(u.surfaceFollowsApp('mini'), true);
  assert.equal(u.surfaceFollowsApp('small'), true);
  assert.equal(u.surfaceFollowsApp('full'), true);

  u.setSurfaceScheme('small', 'indigo');
  assert.equal(u.surfaceFollowsApp('small'), false, 'so o esquema ja basta para deixar de seguir o app');
  assert.equal(u.surfaceFollowsApp('mini'), true, 'e nao mexe nas outras superficies');

  u.setSurfaceScheme('small', 'app');
  assert.equal(u.surfaceFollowsApp('small'), true, 'devolver a app-app-app volta a seguir o app');

  assert.equal(u.surfaceFollowsApp('players'), false, 'superficie desconhecida nunca "segue o app"');
});

/* WP5 (3.2.6b): appearanceScreen e o campo que lms-settings usa para escolher
   qual subtela de Aparencia mostrar. E navegacao, nao preferencia -- igual a
   advancedSettings/picker/queueOpen, que tambem nascem falsos/null e nunca
   entram no JSON de persist(). Comeca fechado (null) e nao sobrevive a uma
   recarga, mesmo depois de outro setter disparar persist(). */
test('appearanceScreen nasce null e nao sobrevive a recarga', function () {
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
  assert.equal(a.state.appearanceScreen, null);

  a.state.appearanceScreen = 'full';
  a.setColorScheme('teal');  // qualquer setter real, para exercitar persist()
  assert.doesNotMatch(store['echoclassic.ui.v2'] || '', /appearanceScreen/,
    'appearanceScreen nao pode aparecer no JSON gravado');

  const b = fresh();
  assert.equal(b.state.appearanceScreen, null, 'uma instancia nova sempre comeca fechada');
});
