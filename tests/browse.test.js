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
