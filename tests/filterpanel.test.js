const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

/* Os arrays nascem dentro do vm, com outro Array.prototype: deepEqual estrito
   compara o prototipo tambem. Achatar por JSON compara o que interessa aqui --
   o conteudo. */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

/* ---------- forma do painel por largura disponivel ------------------------ */

/* A regra e sobre espaco, nao sobre aparelho: a mesma tela vira estreita quando
   o usuario divide a janela, dobra o zoom ou aumenta o corpo de letra. Os
   pontos de quebra sao os que o CSS da skin ja usava. */
test('a forma do painel vem da largura disponivel, e nao do nome do aparelho', function () {
  const panel = helpers.panelInstance().self;
  const casos = [
    [1600, 'large'], [1024, 'large'], [900, 'large'],
    [899, 'medium'], [768, 'medium'], [701, 'medium'],
    [700, 'small'], [390, 'small'], [320, 'small']
  ];
  casos.forEach(function (caso) {
    panel.width = caso[0];
    assert.equal(panel.mode, caso[1], caso[0] + 'px deveria ser ' + caso[1]);
  });
});

test('no modo grande o painel ocupa cerca de metade da area util, com teto e chao', function () {
  const panel = helpers.panelInstance().self;

  panel.width = 1400; panel.height = 900;
  let style = panel.panelStyle;
  assert.equal(style.width, '700px', '50% de 1400');
  assert.equal(style.maxHeight, '720px', 'preso a 80% da altura da janela');

  /* Teto: em monitor largo, metade da tela viraria uma coluna de texto larga
     demais para ler; chao: em 900px, metade seria estreita demais para os
     rotulos e o layout quebraria em vez de reduzir. */
  panel.width = 2560;
  assert.equal(panel.panelStyle.width, '720px', 'nao passa do teto');
  panel.width = 901;
  assert.equal(panel.panelStyle.width, '451px',
    'na fronteira do modo grande, metade ainda cabe: o chao de 420px so existe como defesa');

  /* Nas outras formas quem manda e o CSS: nenhum pixel fixo em JavaScript. */
  panel.width = 800;
  assert.deepEqual(plain(panel.panelStyle), {}, 'gaveta e folha nao recebem estilo embutido');
  panel.width = 400;
  assert.deepEqual(plain(panel.panelStyle), {});
});

test('a folha estreita e uma coluna, tela cheia e com area segura', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const small = css.match(/\.filter-panel\.filter-small\{([^}]*)\}/)[1];
  assert.match(small, /inset:0/, 'ocupa a viewport inteira');
  assert.match(small, /env\(safe-area-inset-top\)/);
  assert.match(small, /env\(safe-area-inset-bottom\)/);

  const media = css.match(/@media \(max-width:700px\)\{[\s\S]*?\.filter-panel\.filter-small \.filter-group\{([^}]*)\}/)[1];
  assert.match(media, /flex-direction:column/, 'uma coluna em tela estreita');

  const body = css.match(/body\.filter-panel-open\{([^}]*)\}/)[1];
  assert.match(body, /overflow:hidden/, 'o fundo nao pode rolar sob a folha');

  const medium = css.match(/\.filter-panel\.filter-medium\{([^}]*)\}/)[1];
  assert.match(medium, /width:min\(480px,92vw\)/, 'gaveta cabe na viewport em qualquer largura');

  const bodyArea = css.match(/\.filter-body\{([^}]*)\}/)[1];
  assert.match(bodyArea, /overflow-y:auto/, 'o conteudo do painel rola por dentro');
  const actions = css.match(/\.filter-actions\{([^}]*)\}/)[1];
  assert.match(actions, /flex:0 0 auto/, 'as acoes ficam fora da area que rola');
});

/* ---------- abrir, fechar, foco ------------------------------------------ */

/* Visto na tela: no macOS, clicar num <button> nao lhe da foco -- e a convencao
   da plataforma. Entao document.activeElement na abertura era o <body>, e
   "devolver o foco a quem abriu" devolvia para lugar nenhum. Quem abre passa o
   proprio elemento. */
test('o painel devolve o foco ao gatilho, e nao ao que estava focado', function () {
  const captured = helpers.panelInstance();
  const panel = captured.self;
  const LmsUi = captured.ctx.LmsUi;

  let noGatilho = 0;
  const funil = { focus: function () { noGatilho++; } };
  let noCorpo = 0;
  panel.previousFocus = { focus: function () { noCorpo++; } };   // o <body> do macOS

  LmsUi.openFilterPanel(funil);
  assert.equal(LmsUi.state.filterPanel, true);
  panel.cancel();
  assert.equal(LmsUi.state.filterPanel, false);

  return new Promise(function (resolve) {
    setTimeout(function () {
      assert.equal(noGatilho, 1, 'o foco volta para o funil');
      assert.equal(noCorpo, 0, 'e nao para o que o navegador dizia estar focado');
      resolve();
    }, 1);
  });
});

test('sem gatilho informado, o painel ainda devolve o foco a quem abriu', function () {
  const captured = helpers.panelInstance();
  const panel = captured.self;
  const LmsUi = captured.ctx.LmsUi;

  let devolvido = false;
  panel.previousFocus = { focus: function () { devolvido = true; } };

  LmsUi.openFilterPanel();
  assert.equal(LmsUi.state.filterPanel, true);

  panel.cancel();
  assert.equal(LmsUi.state.filterPanel, false, 'Cancelar fecha');
  return new Promise(function (resolve) {
    setTimeout(function () {
      assert.equal(devolvido, true, 'o foco volta para quem abriu o painel');
      resolve();
    }, 1);
  });
});

test('o dialogo declara modalidade, titulo, Escape e armadilha de foco', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/filterpanel.js');
  assert.match(src, /role="dialog"/);
  assert.match(src, /aria-modal="true"/);
  assert.match(src, /aria-labelledby="filter-panel-title"/);
  assert.match(src, /id="filter-panel-title"/);
  assert.match(src, /@keydown\.esc\.stop\.prevent="cancel"/, 'Escape fecha');
  assert.match(src, /@keydown\.tab="trapFocus"/, 'Tab nao escapa do dialogo');
  assert.match(src, /class="filter-back" @click="cancel"/, 'clicar fora fecha');
  assert.match(src, /aria-pressed=/, 'cada opcao diz se esta ligada');
});

/* ---------- rascunho: aplicar e cancelar --------------------------------- */

/* Cada troca de filtro recarrega a biblioteca. Aplicar a cada clique cobraria
   segundos por clique enquanto o usuario ainda monta a pergunta. */
test('o rascunho nao mexe no estado ativo ate Aplicar', function () {
  const captured = helpers.panelInstance();
  const panel = captured.self;
  const LmsUi = captured.ctx.LmsUi;

  LmsUi.setMusicView('albums');
  panel.reset();
  panel.toggle('format:flac');
  panel.toggle('quality:hires');

  assert.equal(LmsUi.state.filters.length, 0, 'nada aplicado ainda');
  assert.equal(panel.draft.filters.length, 2, 'o rascunho guarda os dois');

  panel.apply();
  assert.deepEqual(plain(LmsUi.state.filters), ['format:flac', 'quality:hires']);
});

test('Cancelar descarta o rascunho', function () {
  const captured = helpers.panelInstance();
  const panel = captured.self;
  const LmsUi = captured.ctx.LmsUi;

  LmsUi.setMusicView('albums');
  LmsUi.setFilters(['format:flac']);
  panel.reset();
  panel.toggle('format:mp3');
  panel.cancel();

  assert.deepEqual(plain(LmsUi.state.filters), ['format:flac'], 'o que valia continua valendo');
});

/* ---------- facetas ------------------------------------------------------ */

test('genero vira filtro com id do servidor e rotulo legivel', async function () {
  const captured = helpers.panelInstance();
  const panel = captured.self;
  const LmsUi = captured.ctx.LmsUi;

  LmsUi.setMusicView('albums');
  panel.reset();
  await panel.loadGenres();
  assert.equal(panel.genres.length, 2);
  assert.equal(LmsUi.genreName(11), 'Rock', 'o nome fica guardado para a pilula');

  panel.toggle('genre:11');
  panel.apply();
  assert.deepEqual(plain(LmsUi.state.filters), ['genre:11']);

  /* A pilula precisa dizer "Rock", e nao "genre:11": o mapa de nomes vive no
     LmsUi justamente para o painel e a lista lerem o mesmo. */
  const browse = helpers.browseComponent();
  const self = { view: 'albums', ui: LmsUi.state, rows: [],
                 MEDIA_FORMATS: browse.def.data().MEDIA_FORMATS };
  self.tr = browse.def.methods.tr.bind(self);
  self.filterLabel = browse.def.methods.filterLabel.bind(self);
  browse.ctx.LmsUi.rememberGenres(plain(panel.genres));
  assert.equal(self.filterLabel('genre:11'), 'Rock');
  assert.equal(self.filterLabel('year:1971-1977'), '1971–1977');
  assert.equal(self.filterLabel('year:1975-1975'), '1975', 'intervalo de um ano le-se como o ano');
});

test('a busca contextual reduz apenas os generos', async function () {
  const captured = helpers.panelInstance();
  const panel = captured.self;
  await panel.loadGenres();

  panel.needle = 'fla';
  assert.equal(panel.visibleFormats.length, 11, 'formatos nao somem por uma busca de genero');
  assert.deepEqual(plain(panel.visibleGenres), [], 'nenhum genero casa "fla"');

  panel.needle = 'rock';
  assert.deepEqual(plain(panel.visibleGenres.map(function (g) { return g.name; })), ['Rock']);

});

test('o ano aceita intervalo, ano exato e limite aberto', function () {
  const captured = helpers.panelInstance();
  const panel = captured.self;
  captured.ctx.LmsUi.setMusicView('albums');
  panel.reset();

  panel.yearFrom = '1971'; panel.yearTo = '1977';
  panel.commitYears();
  assert.deepEqual(plain(panel.draft.filters), ['year:1971-1977']);

  panel.yearFrom = '1975'; panel.yearTo = '1975';
  panel.commitYears();
  assert.deepEqual(plain(panel.draft.filters), ['year:1975-1975'], 'ano exato e um intervalo de um');

  /* So o inicio preenchido e a pergunta mais comum ("de 1971 para ca").
     Transformar isso em erro seria pedir precisao que ninguem tem. */
  panel.yearFrom = '1971'; panel.yearTo = '';
  panel.commitYears();
  assert.match(panel.draft.filters[0], /^year:1971-\d{4}$/);
  assert.equal(panel.yearError, '');

  panel.yearFrom = '1990'; panel.yearTo = '1980';
  panel.commitYears();
  assert.equal(panel.draft.filters.length, 0, 'intervalo invertido nao vira filtro');
  assert.match(panel.yearError, /lower than or equal/);

  panel.clearYears();
  assert.equal(panel.draft.filters.length, 0);
  assert.equal(panel.yearError, '');
});

test('uma faceta de valor unico nao acumula: o ano novo substitui o anterior', function () {
  const ctx = helpers.uiContext();
  ctx.LmsUi.setMusicView('albums');
  ctx.LmsUi.toggleFilter('year:1971-1977');
  ctx.LmsUi.toggleFilter('year:1980-1989');
  assert.deepEqual(plain(ctx.LmsUi.state.filters), ['year:1980-1989']);

  ctx.LmsUi.toggleFilter('format:flac');
  ctx.LmsUi.toggleFilter('format:alac');
  assert.deepEqual(plain(ctx.LmsUi.state.filters), ['year:1980-1989', 'format:flac', 'format:alac'],
    'formato acumula: dentro da faceta os valores somam');
});

/* Pais foi medido contra a biblioteca real: 3 albuns em 1.397 (0,2%) carregam
   algo parecido com pais, dentro do campo `comment`, cujo conteudo dominante e
   assinatura de ripador. Uma faceta que esconde 99,8% da biblioteca e pior do
   que faceta nenhuma -- entao o estado a recusa, em vez de aceitar uma chave
   que a lista nao saberia aplicar. */
test('pais nao existe no LMS, e o estado nao finge que existe', function () {
  const ctx = helpers.uiContext();
  ctx.LmsUi.setMusicView('albums');
  assert.equal(ctx.LmsUi.validFilter('albums', 'country:de'), false);
  ctx.LmsUi.setFilters(['country:de']);
  assert.deepEqual(plain(ctx.LmsUi.state.filters), [], 'chave inventada nao entra no estado');

  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/filterpanel.js');
  assert.ok(src.indexOf('country') < 0, 'o painel nao promete uma faceta que o servidor nao tem');
});

/* ---------- ordenar, agrupar --------------------------------------------- */

test('ordenar e agrupar continuam separados de filtrar', function () {
  const captured = helpers.panelInstance();
  const panel = captured.self;
  const LmsUi = captured.ctx.LmsUi;

  LmsUi.setMusicView('albums');
  panel.reset();
  panel.toggle('format:flac');
  panel.chooseSort('name');
  panel.chooseGroup('sec:format');
  panel.draft.prefer = 'local';
  panel.apply();

  assert.deepEqual(plain(LmsUi.state.filters), ['format:flac'], 'filtrar exclui');
  assert.equal(LmsUi.state.sort[0].key, 'name', 'ordenar reordena');
  assert.deepEqual(plain(LmsUi.state.sections), ['format'], 'agrupar organiza');
  assert.deepEqual(plain(LmsUi.state.group), [], 'secao nao e agrupamento por artista');
  assert.equal(LmsUi.state.prefer, 'local', 'preferir escolhe o que toca');

  /* Trocar para o agrupamento que muda a natureza da linha limpa a secao: as
     duas coisas nao podem valer ao mesmo tempo, porque uma troca a linha e a
     outra acrescenta cabecalho sobre a linha. */
  panel.chooseGroup('artist');
  assert.deepEqual(plain(panel.draft.sections), []);
  assert.deepEqual(plain(panel.draft.group), ['artist']);
});

test('o menu de agrupar so oferece o que a raiz sabe fazer', function () {
  const captured = helpers.panelInstance();
  const panel = captured.self;
  const LmsUi = captured.ctx.LmsUi;

  LmsUi.setMusicView('albums');
  let values = panel.groupOptions.map(function (o) { return o.value; });
  assert.deepEqual(plain(values), ['', 'artist', 'relatedArtist', 'sec:decade', 'sec:format',
                            'sec:quality', 'sec:origin', 'sec:stream']);

  LmsUi.setMusicView('recent');
  values = panel.groupOptions.map(function (o) { return o.value; });
  assert.ok(values.indexOf('artist') < 0, 'Recentes nunca produz linha de artista');
  assert.ok(values.indexOf('sec:decade') >= 0, 'mas sabe seccionar');

  LmsUi.setMusicView('genres');
  values = panel.groupOptions.map(function (o) { return o.value; });
  assert.deepEqual(plain(values), [''], 'Generos nao agrupa nem secciona');
});

test('as opcoes de ordenacao acompanham a raiz', function () {
  const captured = helpers.panelInstance();
  const panel = captured.self;
  const LmsUi = captured.ctx.LmsUi;

  LmsUi.setMusicView('albums');
  let keys = panel.sortOptions.map(function (o) { return o.key; });
  assert.deepEqual(plain(keys), ['name', 'artist', 'year', 'format', 'source', 'quality']);

  LmsUi.setMusicView('recent');
  keys = panel.sortOptions.map(function (o) { return o.key; });
  assert.equal(keys[0], 'recent', 'Recentes tem a ordem nativa do servidor');

  LmsUi.setMusicView('artists');
  keys = panel.sortOptions.map(function (o) { return o.key; });
  assert.deepEqual(plain(keys), ['name'], 'Artistas nao ordena pelo que nao carrega');
});

test('inverter a direcao nao troca o criterio', function () {
  const captured = helpers.panelInstance();
  const panel = captured.self;
  captured.ctx.LmsUi.setMusicView('albums');
  panel.reset();
  panel.chooseSort('year');
  panel.toggleDir();
  assert.deepEqual(plain(panel.draft.sort), [{ key: 'year', desc: true }]);
  panel.toggleDir();
  assert.deepEqual(plain(panel.draft.sort), [{ key: 'year', desc: false }]);
});

/* ---------- vistas salvas ------------------------------------------------ */

test('uma vista salva guarda os quatro conceitos e volta inteira', function () {
  const captured = helpers.panelInstance();
  const panel = captured.self;
  const LmsUi = captured.ctx.LmsUi;

  LmsUi.setMusicView('albums');
  panel.reset();
  panel.toggle('genre:11');
  panel.toggle('format:flac');
  panel.yearFrom = '1971'; panel.yearTo = '1977';
  panel.commitYears();
  panel.chooseSort('name');
  panel.chooseGroup('sec:format');
  panel.draft.prefer = 'local';
  panel.viewName = 'Rock alemão dos anos 70';
  panel.saveView();

  assert.equal(LmsUi.state.views.length, 1);
  const view = LmsUi.state.views[0];
  assert.equal(view.name, 'Rock alemão dos anos 70');
  assert.deepEqual(plain(view.filters), ['genre:11', 'format:flac', 'year:1971-1977']);
  assert.deepEqual(plain(view.sections), ['format']);
  assert.equal(view.sort[0].key, 'name');
  assert.equal(view.prefer, 'local');

  /* Desmonta tudo e recarrega pela vista. */
  LmsUi.resetView();
  assert.deepEqual(plain(LmsUi.state.filters), []);
  assert.equal(LmsUi.state.prefer, 'none');

  assert.equal(LmsUi.applyView(view.id), true);
  assert.deepEqual(plain(LmsUi.state.filters), ['genre:11', 'format:flac', 'year:1971-1977']);
  assert.deepEqual(plain(LmsUi.state.sections), ['format']);
  assert.equal(LmsUi.state.prefer, 'local');
});

test('renomear, duplicar, apagar e definir padrao', function () {
  const ctx = helpers.uiContext();
  const LmsUi = ctx.LmsUi;
  LmsUi.setMusicView('albums');
  LmsUi.setFilters(['format:flac']);
  const saved = LmsUi.saveCurrentView('Só FLAC');
  assert.ok(saved);

  assert.equal(LmsUi.renameView(saved.id, 'Apenas FLAC'), true);
  assert.equal(LmsUi.state.views[0].name, 'Apenas FLAC');

  assert.equal(LmsUi.duplicateView(saved.id), true);
  assert.equal(LmsUi.state.views.length, 2);
  assert.match(LmsUi.state.views[1].name, /copy/);

  LmsUi.setDefaultView(saved.id);
  assert.equal(LmsUi.state.defaultView, saved.id);

  assert.equal(LmsUi.deleteView(saved.id), true);
  assert.equal(LmsUi.state.views.length, 1);
  assert.equal(LmsUi.state.defaultView, '', 'apagar a padrao nao deixa um ponteiro solto');
});

test('salvar com o nome de uma vista existente atualiza, e nao duplica', function () {
  const ctx = helpers.uiContext();
  const LmsUi = ctx.LmsUi;
  LmsUi.setMusicView('albums');
  LmsUi.setFilters(['format:flac']);
  LmsUi.saveCurrentView('Minha vista');
  LmsUi.setFilters(['format:mp3']);
  LmsUi.saveCurrentView('minha vista');

  assert.equal(LmsUi.state.views.length, 1, 'duas linhas com o mesmo rotulo seriam indistinguiveis');
  assert.deepEqual(plain(LmsUi.state.views[0].filters), ['format:mp3']);
});

test('as vistas sobrevivem a recarga, e uma vista corrompida nao derruba a skin', function () {
  const store = {};
  const fakeStorage = {
    getItem: function (k) { return k in store ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
  const primeiro = helpers.uiContext({ localStorage: fakeStorage });
  primeiro.LmsUi.setMusicView('albums');
  primeiro.LmsUi.setFilters(['format:flac', 'year:1971-1977']);
  primeiro.LmsUi.saveCurrentView('Setentões');

  const segundo = helpers.uiContext({ localStorage: fakeStorage });
  assert.equal(segundo.LmsUi.state.views.length, 1);
  assert.deepEqual(plain(segundo.LmsUi.state.views[0].filters), ['format:flac', 'year:1971-1977']);

  /* Uma vista com faceta desconhecida nao pode descartar o resto: a faceta sai,
     a vista fica. */
  store['echoclassic.views.v1'] = JSON.stringify({
    list: [{ id: 'x', name: 'Meio quebrada', view: 'albums',
             filters: ['format:flac', 'country:de', 42], sort: 'nao e lista',
             sections: ['inventada'], prefer: 'marte' }],
    defaultId: 'nao existe'
  });
  const terceiro = helpers.uiContext({ localStorage: fakeStorage });
  const view = terceiro.LmsUi.state.views[0];
  assert.deepEqual(plain(view.filters), ['format:flac'], 'sobra o que e valido');
  assert.deepEqual(plain(view.sections), []);
  assert.equal(view.prefer, 'none');
  assert.equal(terceiro.LmsUi.state.defaultView, '', 'padrao orfa nao vira ponteiro quebrado');

  store['echoclassic.views.v1'] = '{{{ nao e json';
  const quarto = helpers.uiContext({ localStorage: fakeStorage });
  assert.deepEqual(plain(quarto.LmsUi.state.views), []);
});

/* Visto na tela: sem limite, 60 generos empurravam Formato, Ano, Ordenar e
   Agrupar para fora do alcance -- em tela estreita cada opcao ocupa uma linha
   inteira e a secao seguinte ficava a quarenta rolagens de distancia. */
test('a secao de generos mostra uma amostra ate haver busca', async function () {
  const captured = helpers.panelInstance({
    LmsApi: {
      genres: async function () {
        const out = [];
        for (let i = 0; i < 40; i++) out.push({ id: i, name: 'Genero ' + i });
        out.push({ id: 99, name: 'Rock' });
        return out;
      }
    }
  });
  const panel = captured.self;
  await panel.loadGenres();

  assert.equal(panel.visibleGenres.length, 8, 'sem busca, amostra curta');
  assert.equal(panel.genreOverflow, true, 'e a tela diz que ha mais');

  panel.needle = 'rock';
  assert.deepEqual(plain(panel.visibleGenres.map(function (g) { return g.name; })), ['Rock']);
  assert.equal(panel.genreOverflow, false, 'com busca, nada fica escondido sem aviso');
});

test('filtros, organizacao e vistas salvas sao telas separadas', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/filterpanel.js');
  assert.match(src, /screen === 'filters'/);
  assert.match(src, /screen === 'organize'/);
  assert.match(src, /class="filter-body scroller filter-views"/);
  assert.doesNotMatch(src, /<legend>Sort by<\/legend>/, 'Sort fica no menu direto da toolbar');
  assert.equal((src.match(/@click="apply"/g) || []).length, 1, 'ha um unico Apply');
  assert.match(src, /placeholder="Find a genre"/, 'a busca diz o que pesquisa');
  assert.doesNotMatch(src, /Search within filters/);
});

test('renomear e inline e apagar pede confirmacao interna', async function () {
  const captured = helpers.panelInstance();
  const panel = captured.self;
  const LmsUi = captured.ctx.LmsUi;
  LmsUi.setMusicView('albums');
  const view = LmsUi.saveCurrentView('Original');

  panel.startRename(view);
  panel.editingName = 'Renomeada';
  panel.finishRename(view);
  assert.equal(LmsUi.state.views[0].name, 'Renomeada');

  let options = null;
  LmsUi.confirmAction = async function (value) { options = value; return false; };
  await panel.deleteView(view);
  assert.equal(LmsUi.state.views.length, 1, 'cancelar preserva a vista');
  assert.equal(options.destructive, true);

  LmsUi.confirmAction = async function () { return true; };
  await panel.deleteView(view);
  assert.equal(LmsUi.state.views.length, 0);
});

test('voltar navega nas subtelas antes de cancelar o painel', function () {
  const captured = helpers.panelInstance();
  const panel = captured.self;
  const LmsUi = captured.ctx.LmsUi;
  LmsUi.openFilterPanel();
  panel.screen = 'views';
  panel.backOrCancel();
  assert.equal(panel.screen, 'organize');
  assert.equal(LmsUi.state.filterPanel, true);
  panel.backOrCancel();
  assert.equal(panel.screen, 'filters');
  assert.equal(LmsUi.state.filterPanel, true);
});

/* Dois avisos na mesma linha se truncavam nos dois -- visto na tela. */
test('os avisos da lista empilham em vez de disputar a mesma linha', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const regra = css.match(/\.filter-chip\.notes\{([^}]*)\}/)[1];
  assert.match(regra, /flex-direction:column/);
});
