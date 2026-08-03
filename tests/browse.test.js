const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('allowsMediaFilter e a fonte unica da regra de filtro por view', function () {
  const ctx = helpers.uiContext();
  assert.equal(typeof ctx.LmsUi.allowsMediaFilter, 'function');
  assert.equal(ctx.LmsUi.allowsMediaFilter('albuns'), true);
  assert.equal(ctx.LmsUi.allowsMediaFilter('recentes'), true);
  assert.equal(ctx.LmsUi.allowsMediaFilter('artistas'), false);
  assert.equal(ctx.LmsUi.allowsMediaFilter('generos'), false);
  assert.equal(ctx.LmsUi.allowsMediaFilter('anos'), false);
});

/* Este teste nao cobra correcao nenhuma: ele trava o comportamento atual, que e
   a causa do bug B. O filtro de midia e gravado POR VIEW, entao sair de Recentes
   e voltar traz de volta o filtro que esvaziou a tela. A correcao vai tornar o
   filtro visivel -- nao vai deixar de lembrar dele. Se um dia alguem "consertar"
   isso apagando a memoria por view, este teste avisa. */
test('o filtro de midia continua gravado por view — este e o bug B', function () {
  const ctx = helpers.uiContext();
  ctx.LmsUi.setMusicView('recentes');
  ctx.LmsUi.setSort('stream:qobuz', false);
  assert.equal(ctx.LmsUi.state.sortKey, 'stream:qobuz');

  ctx.LmsUi.setMusicView('artistas');
  assert.equal(ctx.LmsUi.state.sortKey, 'name', 'artistas nao aceita chave de midia');
  ctx.LmsUi.setSort('quality:hires', false);
  assert.equal(ctx.LmsUi.state.sortKey, 'name',
    'ui.js ja rejeita filtro fora de albuns/recentes, sem precisar de guarda em browse.js');

  ctx.LmsUi.setMusicView('recentes');
  assert.equal(ctx.LmsUi.state.sortKey, 'stream:qobuz',
    'volta para Recentes com o filtro que esvaziou a tela');
});

/* A regex de validSortForView foi reescrita para sair de dentro dela a regra de
   quais views filtram. O que ela aceita e recusa nao pode mudar junto. */
test('validSortForView aceita e recusa exatamente o que aceitava antes', function () {
  const ctx = helpers.uiContext();
  const set = function (view, key) {
    ctx.LmsUi.setMusicView(view);
    ctx.LmsUi.setSort(key, false);
    return ctx.LmsUi.state.sortKey === key;
  };

  ['name', 'artist', 'relatedArtist', 'year', 'format:flac', 'quality:hires',
   'origin:local', 'stream:qobuz'].forEach(function (key) {
    assert.equal(set('albuns', key), true, 'albuns deveria aceitar ' + key);
  });
  ['recent', 'name', 'artist', 'year', 'format:mp3', 'origin:remote'].forEach(function (key) {
    assert.equal(set('recentes', key), true, 'recentes deveria aceitar ' + key);
  });

  assert.equal(set('recentes', 'relatedArtist'), false, 'relatedArtist so existe em albuns');
  assert.equal(set('artistas', 'year'), false, 'artistas so aceita name');
  assert.equal(set('albuns', 'format:a:b'), false, 'o valor do filtro nao pode ter dois-pontos');
  assert.equal(set('anos', 'artist'), false, 'anos aceita apenas name e year');
});

/* Resolve os computeds na ordem em que eles dependem uns dos outros e devolve um
   `this` utilizavel. O Vue faria isso sozinho; aqui nao ha Vue. */
function computedsFor(view, sortKey) {
  const captured = helpers.browseComponent();
  const def = captured.def;
  const data = def.data();
  const self = { view: view, ui: { sortKey: sortKey }, MEDIA_FORMATS: data.MEDIA_FORMATS, rows: [] };
  self.mediaDescriptor = def.methods.mediaDescriptor.bind(self);
  self.groupsAlbumsByArtist = def.computed.groupsAlbumsByArtist.call(self);
  self.groupsMainArtists = def.computed.groupsMainArtists.call(self);
  self.allowsMediaFilter = def.computed.allowsMediaFilter.call(self);
  self.hasMediaFilter = def.computed.hasMediaFilter.call(self);
  return { self: self, def: def, ctx: captured.ctx };
}

test('o menu so libera filtro de midia onde a view sabe aplicar', function () {
  assert.equal(computedsFor('albuns', 'name').self.allowsMediaFilter, true);
  assert.equal(computedsFor('recentes', 'recent').self.allowsMediaFilter, true);
  assert.equal(computedsFor('artistas', 'name').self.allowsMediaFilter, false);
  assert.equal(computedsFor('generos', 'name').self.allowsMediaFilter, false);
  assert.equal(computedsFor('anos', 'year').self.allowsMediaFilter, false);
});

/* O bug C: escolher um formato em Artistas trocava a view para Albuns por conta
   propria, e a tela passava a mostrar albuns onde se esperava artistas. O ui.js
   ja recusa a chave sozinho -- este desvio era a unica coisa que fazia a tela
   saltar. */
test('setSort nao troca de view pelas costas do usuario', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  const body = src.split('setSort: function (key)')[1].split('},')[0];
  assert.doesNotMatch(body, /setMusicView/,
    'escolher um formato em Artistas nao pode saltar para Albuns');
});

test('os grupos de midia ficam desabilitados fora de Albuns e Recentes', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  ['Formato', 'Resolução', 'Local', 'Serviços de streaming'].forEach(function (label) {
    const re = new RegExp('<optgroup label="' + label + '"[^>]*:disabled="!allowsMediaFilter"');
    assert.match(src, re, label + ' precisa desabilitar fora de Albuns/Recentes');
  });
});
