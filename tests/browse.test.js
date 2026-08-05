const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('allowsMediaFilter e a fonte unica da regra de filtro por view', function () {
  const ctx = helpers.uiContext();
  assert.equal(typeof ctx.LmsUi.allowsMediaFilter, 'function');
  assert.equal(ctx.LmsUi.allowsMediaFilter('albums'), true);
  assert.equal(ctx.LmsUi.allowsMediaFilter('recent'), true);
  assert.equal(ctx.LmsUi.allowsMediaFilter('artists'), false);
  assert.equal(ctx.LmsUi.allowsMediaFilter('genres'), false);
  assert.equal(ctx.LmsUi.allowsMediaFilter('years'), false);
});

/* Este teste nao cobra correcao nenhuma: ele trava o comportamento atual, que e
   a causa do bug B. O filtro de midia e gravado POR VIEW, entao sair de Recentes
   e voltar traz de volta o filtro que esvaziou a tela. A correcao vai tornar o
   filtro visivel -- nao vai deixar de lembrar dele. Se um dia alguem "consertar"
   isso apagando a memoria por view, este teste avisa. */
test('o filtro de midia continua gravado por view — este e o bug B', function () {
  const ctx = helpers.uiContext();
  ctx.LmsUi.setMusicView('recent');
  ctx.LmsUi.setFilters(['stream:qobuz']);
  assert.equal(ctx.LmsUi.state.filters[0], 'stream:qobuz');

  ctx.LmsUi.setMusicView('artists');
  assert.equal(ctx.LmsUi.state.filters.length, 0, 'artistas nao aceita filtro de midia');
  ctx.LmsUi.setFilters(['quality:hires']);
  assert.equal(ctx.LmsUi.state.filters.length, 0,
    'ui.js rejeita filtro fora de albuns/recentes, sem precisar de guarda em browse.js');

  ctx.LmsUi.setMusicView('recent');
  assert.equal(ctx.LmsUi.state.filters[0], 'stream:qobuz',
    'volta para Recentes com o filtro que esvaziou a tela');
});

/* A regex de validSortForView foi reescrita para sair de dentro dela a regra de
   quais views filtram. O que ela aceita e recusa nao pode mudar junto. */
test('os tres validadores separam o que antes era uma regex so', function () {
  const ctx = helpers.uiContext();
  const u = ctx.LmsUi;

  ['name', 'artist', 'year'].forEach(function (k) {
    assert.equal(u.validSortKey('albums', k), true, 'albuns ordena por ' + k);
  });
  ['recent', 'name', 'artist', 'year'].forEach(function (k) {
    assert.equal(u.validSortKey('recent', k), true, 'recentes ordena por ' + k);
  });
  assert.equal(u.validSortKey('artists', 'year'), false, 'artistas so ordena por nome');
  assert.equal(u.validSortKey('years', 'year'), true);

  assert.equal(u.validGroup('albums', 'artist'), true);
  assert.equal(u.validGroup('albums', 'relatedArtist'), true);
  assert.equal(u.validGroup('recent', 'artist'), false, 'Recentes desenha album sempre');
  assert.equal(u.validGroup('artists', 'artist'), false);

  assert.equal(u.validFilter('albums', 'format:flac'), true);
  assert.equal(u.validFilter('albums', 'format:a:b'), false, 'valor de filtro nao tem dois-pontos');
  assert.equal(u.validFilter('artists', 'format:flac'), false);
});

/* Resolve os computeds na ordem em que eles dependem uns dos outros e devolve um
   `this` utilizavel. O Vue faria isso sozinho; aqui nao ha Vue. */
function computedsFor(view, key) {
  const captured = helpers.browseComponent();
  const def = captured.def;
  const data = def.data();
  /* Roteia a chave para o conceito a que ela pertence, igual ao que o painel faz ao aplicar o rascunho. */
  const isFilter = /^(format|quality|origin|stream):/.test(key || '');
  const isGroup = view === 'albums' && /^(artist|relatedArtist)$/.test(key || '');
  const ui = {
    filters: isFilter ? [key] : [],
    group: isGroup ? [key] : [],
    sort: [{ key: (!isFilter && !isGroup) ? key : 'name', desc: false }]
  };
  const self = { view: view, ui: ui, MEDIA_FORMATS: data.MEDIA_FORMATS, rows: [] };
  self.tr = def.methods.tr.bind(self);
  self.filterLabel = def.methods.filterLabel.bind(self);
  self.activeFilters = def.computed.activeFilters.call(self);
  self.mediaDescriptor = def.methods.mediaDescriptor.bind(self);
  self.sortKey = def.computed.sortKey.call(self);
  self.sortDesc = def.computed.sortDesc.call(self);
  self.groupsAlbumsByArtist = def.computed.groupsAlbumsByArtist.call(self);
  self.groupsMainArtists = def.computed.groupsMainArtists.call(self);
  self.allowsMediaFilter = def.computed.allowsMediaFilter.call(self);
  self.hasMediaFilter = def.computed.hasMediaFilter.call(self);
  return { self: self, def: def, ctx: captured.ctx };
}

test('o menu so libera filtro de midia onde a view sabe aplicar', function () {
  assert.equal(computedsFor('albums', 'name').self.allowsMediaFilter, true);
  assert.equal(computedsFor('recent', 'recent').self.allowsMediaFilter, true);
  assert.equal(computedsFor('artists', 'name').self.allowsMediaFilter, false);
  assert.equal(computedsFor('genres', 'name').self.allowsMediaFilter, false);
  assert.equal(computedsFor('years', 'year').self.allowsMediaFilter, false);
});

/* O bug C: escolher um formato em Artistas trocava a view para Albuns por conta
   propria, e a tela passava a mostrar albuns onde se esperava artistas. O ui.js
   ja recusa a chave sozinho -- este desvio era a unica coisa que fazia a tela
   saltar. */
test('a escolha do menu nao troca de view pelas costas do usuario', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  const body = src.split('chooseSort: function (value)')[1].split('},')[0];
  assert.doesNotMatch(body, /setMusicView/,
    'escolher um formato em Artistas nao pode saltar para Albuns');
});

/* O <select> deixou de ser o controle de filtros: enquanto ele era, so cabia um
   filtro por vez, porque escolher uma opcao substitui a anterior. O funil e o
   unico caminho para o painel, e o painel e o unico caminho para combinar. */
test('o funil substitui o select como controle de filtros', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  assert.ok(src.indexOf('<optgroup') < 0,
    'nenhum grupo de filtro pode continuar dentro do select');
  assert.match(src, /class="icon-command filter-command"/, 'o funil e um botao de barra');
  assert.match(src, /aria-haspopup="dialog"/, 'o funil abre um dialogo');
  assert.match(src, /:aria-label="filterTriggerLabel"/, 'botao de icone precisa de nome acessivel');
  assert.match(src, /:aria-expanded="String\(ui\.filterPanel\)"/);
  assert.match(src, /class="filter-badge"/, 'a contagem de filtros ativos');
  assert.match(src, /@click="openFilters"/);

  /* As opcoes de ordenacao que leem o indice de midia so aparecem onde esse
     indice existe -- oferece-las em Artistas seria a promessa vazia de novo. */
  ['format', 'source', 'quality'].forEach(function (key) {
    const re = new RegExp('v-if="allowsMediaFilter" value="' + key + '"');
    assert.match(src, re, key + ' precisa depender de allowsMediaFilter');
  });
});

test('o funil acende com qualquer ajuste e conta so os filtros', function () {
  const captured = helpers.browseComponent();
  const def = captured.def;
  const self = {
    view: 'albums', rows: [],
    ui: { filters: ['format:flac', 'quality:hires'], group: [], sections: [], prefer: 'none' },
    MEDIA_FORMATS: def.data().MEDIA_FORMATS
  };
  self.tr = def.methods.tr.bind(self);
  self.filterLabel = def.methods.filterLabel.bind(self);
  self.preferMode = def.computed.preferMode.call(self);
  self.allowsMediaFilter = def.computed.allowsMediaFilter.call(self);
  self.activeFilters = def.computed.activeFilters.call(self);
  self.sectionKey = def.computed.sectionKey.call(self);
  self.filterCount = def.computed.filterCount.call(self);
  assert.equal(self.filterCount, 2, 'dois filtros, badge 2');
  assert.equal(def.computed.toolsActive.call(self), true);
  assert.equal(def.computed.filterTriggerLabel.call(self), 'Filters: 2 active filters');

  /* Agrupar e preferir mudam a apresentacao, nao o conjunto: acendem o icone
     mas nao entram na contagem de filtros. */
  self.ui = { filters: [], group: [], sections: ['decade'], prefer: 'local' };
  self.preferMode = def.computed.preferMode.call(self);
  self.activeFilters = def.computed.activeFilters.call(self);
  self.sectionKey = def.computed.sectionKey.call(self);
  self.filterCount = def.computed.filterCount.call(self);
  assert.equal(self.filterCount, 0);
  assert.equal(def.computed.toolsActive.call(self), true,
    'secao e preferencia acendem o icone mesmo sem filtro');
  assert.equal(def.computed.filterTriggerLabel.call(self), 'Filters');
});

/* O bug B: com filtro ativo, a unica pista de que ele existia era o
   mediaDescriptor colado no subtitulo de cada linha -- e quando o filtro zerava
   a lista, a pista sumia junto com as linhas. O aviso precisa viver FORA da
   lista, senao ele desaparece exatamente no caso em que e necessario. */
test('o chip do filtro vive fora da lista, e nao dentro dela', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  assert.match(src, /v-if="activeChips.length" class="filter-chip"/);
  assert.match(src, /v-for="c in activeChips"/, 'uma pilula por ajuste ativo');
  assert.match(src, /@click="c\.remove\(\)"/, 'cada pilula remove so o seu');
  assert.match(src, /@click="clearAllTools"/);
  /* Em tela estreita a fileira vira resumo: quatro pilulas nao cabem, e deixar
     a barra crescer para fora da viewport seria pior do que resumir. */
  assert.match(src, /v-if="compact"/, 'resumo compacto em tela estreita');
  assert.match(src, /class="filter-pill-strip"/, 'a fileira rola no eixo dela');

  const chipAt = src.indexOf('class="filter-chip"');
  const scrollerAt = src.indexOf('<div class="scroller"');
  assert.ok(chipAt > 0 && scrollerAt > 0);
  assert.ok(chipAt < scrollerAt,
    'o chip precisa estar antes do scroller: dentro dele sumiria junto com as linhas');
});

test('limpar o filtro nao toca na ordenacao — sao estados separados', function () {
  const captured = helpers.browseComponent();
  const LmsUi = captured.ctx.LmsUi;

  LmsUi.setMusicView('recent');
  LmsUi.setSort([{ key: 'artist', desc: true }]);
  LmsUi.setFilters(['stream:qobuz']);
  captured.def.methods.clearMediaFilter.call({ view: 'recent', ui: LmsUi.state });

  assert.equal(LmsUi.state.filters.length, 0, 'o filtro saiu');
  assert.equal(LmsUi.state.sort[0].key, 'artist', 'a ordenacao ficou');
  assert.equal(LmsUi.state.sort[0].desc, true, 'inclusive a direcao');
  assert.equal(LmsUi.state.musicView, 'recent', 'e a view nao mudou');
});

test('a tela vazia diz qual filtro esta escondendo tudo', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  const empty = src.split('v-else-if="!rows.length"')[1].split('<template v-else>')[0];

  assert.match(empty, /v-if="hasMediaFilter"[^>]*class="p">[^<]*\{\{ mediaDescriptor\(\) \}\}/,
    'com filtro ativo, a mensagem precisa nomear o filtro');
  assert.match(empty, /v-else class="p">Nenhum item encontrado nesta categoria\./,
    'sem filtro, a mensagem generica continua valendo');
  assert.match(empty, /v-if="hasMediaFilter"[\s\S]*@click="clearMediaFilter"/,
    'a tela vazia precisa oferecer a saida');
});

/* O texto fixo tem de ficar no template, e nao ser montado em JavaScript: o
   i18n quebra o no de texto nas chaves duplas e procura cada pedaco literal no
   dicionario, envolvendo so as expressoes em $t(). Uma frase ja concatenada
   chegaria inteira -- com o nome do filtro no meio -- e nunca bateria com uma
   chave. O nome do filtro fica no fim, para a frase traduzivel nao ser partida
   em duas metades dependentes de ordem de palavras. */
test('a frase da tela vazia e traduzivel: literal no template, filtro ao final', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  const empty = src.split('v-else-if="!rows.length"')[1].split('<template v-else>')[0];
  const linha = empty.split('\n').filter(function (l) { return l.indexOf('mediaDescriptor()') >= 0; })[0];
  assert.ok(linha, 'deveria haver uma linha com mediaDescriptor()');

  const texto = linha.replace(/^[^>]*>/, '');
  const antes = texto.split('{{')[0].replace(/^\s+|\s+$/g, '');
  const depois = texto.split('}}')[1].split('<')[0].replace(/^\s+|\s+$/g, '');
  assert.ok(antes.length > 10, 'o literal antes do filtro precisa ser uma frase inteira');
  assert.equal(depois, '.', 'depois do filtro so pode sobrar a pontuacao');
});

/* Prova de que a decisao acima funciona de ponta a ponta: com dicionario, o
   literal sai traduzido e o descritor vira $t(...) para resolver em tempo de
   execucao. Se alguem trocar isto por uma frase montada em JavaScript, o texto
   volta a aparecer em portugues numa sessao em ingles, e este teste avisa. */
test('os textos novos traduzem de verdade quando existe dicionario', function () {
  let def = null;
  const ctx = helpers.uiContext({
    LMS_LANG: 'PT',
    LMS_STRINGS_BY_LANG: {
      PT: {
        'Nothing in this category matches the filter': 'Nada nesta categoria passa pelo filtro',
        'No items found in this category.': 'Nada encontrado nesta categoria.',
        'Clear filter': 'Limpar filtro',
        'Clear all': 'Limpar tudo',
        'Active:': 'Ativo:'
      }
    },
    Vue: {
      prototype: {},
      observable: function (o) { return o; },
      component: function (name, definition) { def = definition; },
      nextTick: function (f) { if (f) f(); }
    }
  });
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/i18n.js');
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/browse.js');

  const tpl = def.template;
  assert.match(tpl, /Nada nesta categoria passa pelo filtro \{\{ \$t\(mediaDescriptor\(\)\) \}\}/);
  assert.match(tpl, /class="filter-chip-label">Ativo:/);
  assert.match(tpl, />Limpar filtro</);
  assert.match(tpl, />Limpar tudo</);
  assert.doesNotMatch(tpl, /Nothing in this category/,
    'the English source must not survive a session that has a dictionary');
});

test('mediaDescriptor nomeia o filtro que esvazia Recentes', function () {
  assert.equal(computedsFor('recent', 'stream:qobuz').self.mediaDescriptor(), 'Qobuz');
  assert.equal(computedsFor('albums', 'quality:hires').self.mediaDescriptor(), 'Hi-Res');
  assert.equal(computedsFor('albums', 'format:flac').self.mediaDescriptor(), 'FLAC');
  assert.equal(computedsFor('recent', 'recent').self.mediaDescriptor(), '',
    'sem filtro nao ha descritor, e a mensagem generica e a correta');
});

/* A outra metade do bug C. Em Albuns, "Artist" AGRUPA: produz linhas de artista.
   Em Recentes a mesma opcao so reordena albuns, porque Recentes nunca passa por
   loadPagedRoot. Mesmo rotulo, semanticas diferentes -- e por isso "procurei
   Beatles e vieram albuns". O rotulo do grupo precisa dizer qual das duas coisas
   esta acontecendo. */
test('Recentes nao promete agrupar: la a opcao Artista so reordena', function () {
  const recentes = computedsFor('recent', 'artist');
  assert.equal(recentes.self.groupsMainArtists, false,
    'Recentes nunca produz linha de artista, nem com sortKey=artist');

  const albuns = computedsFor('albums', 'artist');
  assert.equal(albuns.self.groupsMainArtists, true, 'em Albuns, Artista agrupa de verdade');

  /* O rotulo do select nao precisa mais mudar por view: ele ordena, e so.
     Agrupar mudou de lugar -- vai para o painel, onde a opcao de artista diz,
     no proprio rotulo, que a lista passa a mostrar artistas. */
  assert.equal(recentes.def.computed.sortSelectLabel.call(recentes.self), 'Sort by');
  assert.equal(albuns.def.computed.sortSelectLabel.call(albuns.self), 'Sort by');
});

test('o select faz uma coisa so, e o rotulo diz qual', function () {
  const artistas = computedsFor('artists', 'name');
  assert.equal(artistas.def.computed.sortSelectLabel.call(artistas.self), 'Sort by');

  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  assert.match(src, /<select :value="sortKey" :aria-label="sortSelectLabel"/,
    'o select passa a espelhar a ordenacao, e nao um valor de tres conceitos');
  assert.match(src, /@change="chooseSort\(\$event\.target\.value\)"/);
});

/* Atributo dinamico nao passa pelo translateTemplate -- a lista ATTRS do i18n so
   cobre atributo estatico, e nem inclui `label`. Sem passar pelo dicionario na
   mao, estes dois rotulos ficariam em portugues numa sessao em ingles. */
test('os rotulos calculados do menu passam pelo dicionario', function () {
  let def = null;
  const ctx = helpers.uiContext({
    LMS_LANG: 'PT',
    LMS_STRINGS_BY_LANG: {
      PT: { 'Sort by': 'Ordenar por', 'Filters': 'Filtros', 'active filters': 'filtros ativos' }
    },
    Vue: {
      prototype: {},
      observable: function (o) { return o; },
      component: function (name, definition) { def = definition; },
      nextTick: function (f) { if (f) f(); }
    }
  });
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/i18n.js');
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/browse.js');

  const self = { view: 'recent', activeFilters: [{ key: 'format:flac', label: 'FLAC' }] };
  self.tr = def.methods.tr.bind(self);
  assert.equal(def.computed.sortSelectLabel.call(self), 'Sort by');
  self.filterCount = def.computed.filterCount.call(self);
  assert.equal(def.computed.filterTriggerLabel.call(self), 'Filters: 1 active filter',
    'o nome acessivel do funil sai do dicionario, nao do template');
});

/* Monta o dicionario a partir do strings.txt de verdade, do mesmo jeito que o
   Plugin.pm::getStringMap monta: a chave e a frase em portugues, o valor e o
   idioma da sessao. Verificar que o arquivo "contem o texto" nao provaria nada --
   o que importa e a frase chegar traduzida na tela. */
function dictionaryFromStrings(lang) {
  const text = helpers.read('EchoClassic/strings.txt');
  const entries = {};
  let key = '';
  text.split(/\r?\n/).forEach(function (line) {
    const top = line.match(/^([A-Z0-9_]+)$/);
    if (top) { key = top[1]; entries[key] = {}; return; }
    const value = line.match(/^\t([A-Z]{2})\t([\s\S]*)$/);
    if (value && key) entries[key][value[1]] = value[2];
  });
  const map = {};
  Object.keys(entries).forEach(function (k) {
    if (k.indexOf('ECHOCLASSIC_UI_') !== 0) return;
    const source = entries[k].EN;
    const target = entries[k][lang];
    if (!source || !target || target === source) return;   /* Plugin.pm */
    map[source] = target;
  });
  return map;
}

test('todo texto novo da interface chega traduzido, vindo do strings.txt real', function () {
  let def = null;
  const ctx = helpers.uiContext({
    LMS_LANG: 'PT',
    LMS_STRINGS_BY_LANG: { PT: dictionaryFromStrings('PT') },
    Vue: {
      prototype: {},
      observable: function (o) { return o; },
      component: function (name, definition) { def = definition; },
      nextTick: function (f) { if (f) f(); }
    }
  });
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/i18n.js');
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/browse.js');

  const tpl = def.template;
  ['Nothing in this category matches the filter', 'Clear filter',
   'No items found in this category.'].forEach(function (phrase) {
    assert.ok(tpl.indexOf(phrase) < 0, 'sobrou em portugues no template: ' + phrase);
  });
  assert.match(tpl, /Nada nesta categoria passa pelo filtro/);
  assert.match(tpl, /Active:/);
  assert.match(tpl, />Clear filter</);

  /* Os rotulos calculados nao vivem no template: passam pelo tr() em tempo de
     execucao, entao sao conferidos chamando as computeds. */
  const self = { view: 'recent' };
  self.tr = def.methods.tr.bind(self);
  assert.equal(def.computed.sortSelectLabel.call(self), 'Sort by');
  self.view = 'albums';
  assert.equal(def.computed.sortSelectLabel.call(self), 'Sort by');

  /* Os rotulos do painel tambem: eles sao montados em JavaScript, e o painel e
     todo texto novo. */
  self.activeFilters = [];
  self.ui = { filters: [], group: [], sections: [], prefer: 'local' };
  self.preferMode = def.computed.preferMode.call(self);
  assert.equal(def.methods.preferLabel.call(self, 'local'), 'Prefer local library');
  assert.equal(def.methods.sectionFacetLabel.call(self, 'decade'), 'Decade');
});

/* Os avisos de truncamento sao montados em JavaScript e chegam ao template por
   {{ limitWarning }}, que o i18n envolve em $t(). Traduzem, portanto -- desde que
   a frase inteira exista no dicionario. O aviso de albuns nao atribuidos vinha
   com o total concatenado na frente, entao a frase nunca batia com chave nenhuma
   e aparecia em portugues numa sessao em ingles. Visto na tela do servidor. */
test('todo aviso de limitWarning tem entrada no dicionario', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  const dict = dictionaryFromStrings('EN');

  /* Pega a expressao inteira de cada atribuicao e tira dela todos os literais.
     Casar linha a linha deixava passar o ramo singular do ternario, que fica na
     linha de baixo -- exatamente o tipo de furo que faz o teste passar sem
     cobrir o que deveria. */
  const frases = [];
  const re = /limitWarning\s*=\s*([\s\S]*?);\s*\n/g;
  let m;
  while ((m = re.exec(src))) {
    (m[1].match(/'((?:[^'\\]|\\.)*)'/g) || []).forEach(function (lit) {
      const frase = lit.slice(1, -1);
      if (frase.trim() && frase !== '{n}') frases.push(frase);
    });
  }

  assert.ok(frases.length >= 6, 'esperava achar os avisos; achei ' + frases.length);
  assert.ok(frases.some(function (f) { return f.indexOf('1 álbum') === 0; }),
    'a forma singular precisa entrar na verificacao');
  frases.forEach(function (frase) {
    if (!frase.trim()) return;
    assert.ok(dict[frase], 'aviso sem traducao no strings.txt: ' + frase);
  });
});

test('o total de albuns nao atribuidos sobrevive a traducao', function () {
  const dict = dictionaryFromStrings('EN');
  const plural = '{n} albums could not be attributed to an artist in the index and appear as albums in this list.';
  assert.ok(dict[plural], 'a forma plural precisa de entrada');
  assert.match(dict[plural], /\{n\}/, 'a traducao precisa preservar o marcador {n}');
  assert.equal(dict[plural].replace('{n}', 10).indexOf('{n}'), -1,
    'depois do replace nao pode sobrar marcador');
});

/* .pane-left e um grid de duas colunas -- conteudo e a trilha de 28px do indice
   A-Z -- e TODO filho tem posicao explicita. Um filho novo sem grid-row/column
   cai no auto-placement e vai parar na coluna do indice: foi exatamente isso que
   aconteceu com o chip, que apareceu como uma tira vertical de 32px ao lado da
   lista. Nenhum teste de unidade pega isso, porque nenhum deles renderiza CSS. */
test('todo filho de .pane-left tem posicao explicita no grid', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');

  const pane = css.match(/\.pane-left\{([^}]*)\}/)[1];
  const linhas = pane.match(/grid-template-rows:([^;]+)/)[1].trim().split(/\s+/);

  /* As classes que o template pendura direto em .pane-left. */
  const filhos = ['library-tools', 'history-strip', 'filter-chip', 'scroller'];
  filhos.forEach(function (cls) {
    assert.ok(src.indexOf('class="' + cls) >= 0 || src.indexOf(cls + '"') >= 0,
      'esperava encontrar ' + cls + ' no template');
    const regra = css.match(new RegExp('\\.(pane-left>\\.)?' + cls + '\\{([^}]*)\\}'));
    assert.ok(regra, 'sem regra CSS para ' + cls);
    assert.match(regra[2], /grid-row:\s*\d/, cls + ' precisa de grid-row explicito');
  });

  const scroller = css.match(/\.pane-left>\.scroller\{([^}]*)\}/)[1];
  const rail = css.match(/\.pane-left>\.rail\{([^}]*)\}/)[1];
  const ultima = String(linhas.length);
  assert.match(scroller, new RegExp('grid-row:' + ultima),
    'a lista tem de ocupar a ultima linha do template');
  assert.match(rail, new RegExp('grid-row:' + ultima),
    'o indice A-Z acompanha a lista');
});

/* O portao 4 recalcula uma lista FIXA de pares de contraste. Um token de cor novo
   nao entra nessa lista, entao passaria sem nunca ser medido. */
test('o chip usa apenas tokens de cor que ja existem no CSS', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const defined = new Set();
  let m;
  const defRe = /(--[a-z0-9-]+)\s*:/g;
  while ((m = defRe.exec(css))) defined.add(m[1]);

  /* Pega o corpo de cada regra cujo seletor comeca em .filter-chip. Filtrar por
     linha nao serve: a declaracao continua na linha seguinte, indentada, e e la
     que os var() aparecem. */
  const bodies = [];
  const ruleRe = /\.filter-chip[^{]*\{([^}]*)\}/g;
  while ((m = ruleRe.exec(css))) bodies.push(m[1]);
  assert.ok(bodies.length > 0, '.filter-chip precisa ter estilo');

  const used = (bodies.join('\n').match(/var\((--[a-z0-9-]+)\)/g) || [])
    .map(function (v) { return v.slice(4, -1); });
  assert.ok(used.length > 0, 'o chip deveria se apoiar nos tokens do tema');
  used.forEach(function (token) {
    assert.ok(defined.has(token), 'token de cor inedito no chip: ' + token);
  });
});

/* ---------- Fase 2: multiplos filtros, balde do desconhecido, ordem estavel ---- */

function comFiltros(view, filters, sort) {
  const captured = helpers.browseComponent();
  const def = captured.def;
  const data = def.data();
  const ui = { filters: filters.slice(), group: [], sort: sort || [{ key: 'name', desc: false }] };
  /* Semeado como o data() do componente: o contador comeca em zero, e nao
     indefinido -- um ++ sobre undefined daria NaN e o teste passaria a medir o
     arreio em vez do produto. */
  const self = { view: view, ui: ui, MEDIA_FORMATS: data.MEDIA_FORMATS, rows: [],
                 mediaIndex: null, unknownCount: data.unknownCount };
  self.tr = def.methods.tr.bind(self);
  self.allowsMediaFilter = def.computed.allowsMediaFilter.call(self);
  self.hasMediaFilter = def.computed.hasMediaFilter.call(self);
  self.filterLabel = def.methods.filterLabel.bind(self);
  self.matchesValue = def.methods.matchesValue.bind(self);
  self.mediaMatches = def.methods.mediaMatches.bind(self);
  self.activeFilters = def.computed.activeFilters.call(self);
  return { self: self, def: def, ctx: captured.ctx };
}

const META = function (o) {
  return Object.assign({ formats: {}, providers: {}, hires: false, standard: false,
                         local: false, remote: false }, o);
};

/* Dentro de uma faceta os valores somam (OU); entre facetas eles restringem (E).
   O usuario le "FLAC ou ALAC" dentro do cartao Formato, e cartoes diferentes se
   acumulam -- sem nunca precisar da palavra AND. */
test('valores da mesma faceta sao OU; facetas diferentes sao E', function () {
  const c = comFiltros('albums', ['format:flac', 'format:alac', 'quality:hires']);
  c.self.mediaIndex = {
    '1': META({ formats: { flac: true }, hires: true }),
    '2': META({ formats: { alac: true }, hires: true }),
    '3': META({ formats: { mp3: true }, hires: true }),
    '4': META({ formats: { flac: true }, hires: false, standard: true })
  };
  assert.equal(c.self.mediaMatches(1), true,  'flac + hires passa');
  assert.equal(c.self.mediaMatches(2), true,  'alac + hires passa (OU dentro de formato)');
  assert.equal(c.self.mediaMatches(3), false, 'mp3 nao esta entre os formatos pedidos');
  assert.equal(c.self.mediaMatches(4), false, 'flac mas nao hires: o E entre facetas barra');
});

test('um filtro sozinho continua funcionando como antes', function () {
  const c = comFiltros('albums', ['stream:qobuz']);
  c.self.mediaIndex = {
    '1': META({ providers: { qobuz: true }, remote: true }),
    '2': META({ local: true })
  };
  assert.equal(c.self.mediaMatches(1), true);
  assert.equal(c.self.mediaMatches(2), false);
});

/* Mesma familia do bug B: dado ausente virando desaparecimento silencioso.
   O album sem entrada no indice continua fora da lista, mas passa a ser contado
   e dito na tela. */
test('album sem informacao de midia e contado, nao sumido em silencio', function () {
  const c = comFiltros('albums', ['format:flac']);
  c.self.mediaIndex = { '1': META({ formats: { flac: true } }) };
  assert.equal(c.self.mediaMatches(1), true);
  assert.equal(c.self.mediaMatches(99), false, 'sem meta nao casa');
  assert.equal(c.self.unknownCount, 1, 'mas foi contabilizado para virar aviso');
});

test('cada filtro ativo vira um chip com rotulo proprio', function () {
  const c = comFiltros('albums', ['format:flac', 'quality:hires', 'stream:qobuz']);
  const ativos = c.def.computed.activeFilters.call(c.self);
  assert.equal(ativos.length, 3);
  assert.deepEqual(ativos.map(function (f) { return f.label; }), ['FLAC', 'Hi-Res', 'Qobuz']);
  assert.equal(ativos[0].key, 'format:flac');
});

/* Ordenacao instavel fazia dois albuns homonimos trocarem de lugar entre
   renderizacoes. O desempate encadeia ate o id, que e unico. */
test('a ordenacao e total: nulos ao fim e desempate ate o id', function () {
  const captured = helpers.browseComponent();
  const cmp = captured.def.methods.rowComparator.call(
    { ui: { sort: [{ key: 'year', desc: false }] } });

  const a = { id: 2, label: 'Mesmo', artist: 'X', year: 1970 };
  const b = { id: 1, label: 'Mesmo', artist: 'X', year: 1970 };
  assert.ok(cmp(a, b) > 0, 'empate total cai no id, e o menor vem antes');
  assert.ok(cmp(b, a) < 0, 'e o comparador e antissimetrico');

  const semAno = { id: 3, label: 'A', artist: 'X', year: null };
  const comAno = { id: 4, label: 'Z', artist: 'X', year: 1999 };
  assert.ok(cmp(semAno, comAno) > 0, 'sem ano vai para o fim...');

  const desc = captured.def.methods.rowComparator.call(
    { ui: { sort: [{ key: 'year', desc: true }] } });
  assert.ok(desc(semAno, comAno) > 0, '...inclusive em ordem decrescente');
});

/* ---------- Fase 3: o indice de midia sobrevive a recarga ------------------- */

test('a chave do cache e uma string de verdade, e nao uma funcao embrulhada', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  assert.match(src, /var LMS_MEDIA_CACHE_KEY = 'echoclassic\.media\.v1'/,
    'a chave tem de viver fora de methods; o Vue embrulha nao-funcoes');
  const methods = src.slice(src.indexOf('methods: {'));
  assert.doesNotMatch(methods, /MEDIA_CACHE_KEY:\s*'/,
    'uma string dentro de methods vira funcao e a chave vira o corpo dela');
});

test('empacotar e desempacotar o indice preserva a informacao', function () {
  const def = helpers.browseComponent().def;
  const m = def.methods;
  const original = {
    '1': { formats: { flac: true, mp3: true }, providers: { qobuz: true },
           hires: true, standard: false, local: false, remote: true },
    '2': { formats: {}, providers: {}, hires: false, standard: true, local: true, remote: false }
  };
  const volta = m.unpackMedia.call({}, m.packMedia.call({}, original));

  assert.deepEqual(Object.keys(volta).sort(), ['1', '2']);
  assert.equal(volta['1'].formats.flac, true);
  assert.equal(volta['1'].formats.mp3, true);
  assert.equal(volta['1'].providers.qobuz, true);
  assert.equal(volta['1'].hires, true);
  assert.equal(volta['1'].remote, true);
  assert.equal(volta['1'].local, false);
  assert.equal(volta['2'].standard, true);
  assert.equal(volta['2'].local, true);
  assert.equal(Object.keys(volta['2'].formats).length, 0, 'album sem formato continua sem formato');
});

/* A chave de invalidacao e o lastscan do servidor: muda exatamente quando a
   biblioteca muda. Um cache que sobrevive a um rescan mostraria formato de
   arquivos que nao existem mais. */
test('o cache so vale enquanto o lastscan for o mesmo', function () {
  const def = helpers.browseComponent().def;
  const m = def.methods;
  const loja = {};
  /* Nao fornecemos a chave: ela tem de vir do proprio modulo. Fornece-la aqui
     foi o que deixou este teste passar enquanto o produto gravava sob uma chave
     que era o texto de uma funcao -- o arreio validava a si mesmo. */
  const self = { packMedia: m.packMedia, unpackMedia: m.unpackMedia };
  const ctxLocal = {
    getItem: function (k) { return k in loja ? loja[k] : null; },
    setItem: function (k, v) { loja[k] = String(v); }
  };
  global.localStorage = ctxLocal;
  try {
    m.writeMediaCache.call(self, 'scan-1', { '7': { formats: { flac: true }, providers: {},
      hires: true, standard: false, local: true, remote: false } });

    const igual = m.readMediaCache.call(self, 'scan-1');
    assert.ok(igual && igual['7'], 'mesmo lastscan: o cache serve');
    assert.equal(igual['7'].formats.flac, true);

    assert.equal(m.readMediaCache.call(self, 'scan-2'), null, 'lastscan novo invalida');
    assert.equal(m.readMediaCache.call(self, ''), null, 'sem lastscan nao arrisca');
  } finally { delete global.localStorage; }
});

test('cache corrompido nao derruba a navegacao', function () {
  const def = helpers.browseComponent().def;
  const m = def.methods;
  const self = { unpackMedia: m.unpackMedia };
  global.localStorage = { getItem: function () { return '{lixo nao json'; } };
  try {
    assert.equal(m.readMediaCache.call(self, 'scan-1'), null);
  } finally { delete global.localStorage; }
});

/* ---------- Fase 4: secoes reais e virtualizacao por soma de prefixos ------- */

/* Array nascido dentro do vm tem outro Array.prototype, e o deepEqual estrito
   compara o prototipo junto. Achatar por JSON compara o que importa: o
   conteudo. */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}


/* Mesmo formato de meta do indice, escrito de um jeito mais curto para as
   tabelas de caso desta secao. */
function MIDIA(formats, flags) {
  const meta = META({});
  (formats || []).forEach(function (f) { meta.formats[f] = true; });
  Object.keys(flags || {}).forEach(function (k) {
    if (k === 'providers') (flags[k] || []).forEach(function (p) { meta.providers[p] = true; });
    else meta[k] = flags[k];
  });
  return meta;
}


/* Monta o componente com linhas e indice de midia, e resolve a cadeia de
   computeds na ordem em que elas dependem umas das outras. */
function listaCom(rows, options) {
  const opts = options || {};
  const captured = helpers.browseComponent();
  const def = captured.def;
  const data = def.data();
  const self = {
    view: opts.view || 'albums', rows: rows,
    ui: { filters: opts.filters || [], group: opts.group || [],
          sections: opts.sections || [], sort: opts.sort || [{ key: 'name', desc: false }],
          prefer: opts.prefer || 'none', filter: '' },
    mediaIndex: opts.mediaIndex || null,
    MEDIA_FORMATS: data.MEDIA_FORMATS,
    first: 0, visible: 10, RAIL: data.RAIL,
    $refs: {}
  };
  ['tr', 'filterLabel', 'normalize', 'metaFor', 'sectionValuesFor', 'sectionFacetLabel',
   'rowComparator', 'mediaMatches', 'matchesValue', 'yearMatches', 'albumPasses',
   'filterValues', 'preferLabel', 'railLetter', 'indexAtOffset', 'jump', 'onScroll',
   'editionsFor', 'editionSource'].forEach(function (name) {
    self[name] = def.methods[name].bind(self);
  });
  ['preferMode', 'allowsMediaFilter', 'hasMediaFilter', 'activeFilters', 'sectionKey',
   'sortKey', 'sortDesc', 'showsAlbums', 'groupsAlbumsByArtist', 'groupsAlbumsByRelatedArtist',
   'groupsMainArtists', 'rowH', 'headerH', 'displayRows', 'displayItems', 'itemOffsets',
   'windowed', 'topPad', 'botPad', 'sectionOverlap', 'hasRail', 'filterCount',
   'toolsActive', 'activeChips', 'resultCount'].forEach(function (name) {
    Object.defineProperty(self, name, { get: def.computed[name].bind(self), configurable: true });
  });
  return { self: self, def: def, ctx: captured.ctx };
}

const ALBUNS = [
  { key: 'al1', kind: 'album', id: 1, label: 'Head Hunters', artist: 'Herbie Hancock', year: 1973 },
  { key: 'al2', kind: 'album', id: 2, label: 'Thrust', artist: 'Herbie Hancock', year: 1974 },
  { key: 'al3', kind: 'album', id: 3, label: 'Autobahn', artist: 'Kraftwerk', year: 1974 },
  { key: 'al4', kind: 'album', id: 4, label: 'Trans-Europe Express', artist: 'Kraftwerk', year: 1977 },
  { key: 'al5', kind: 'album', id: 5, label: 'Sem ano', artist: 'Desconhecido', year: null }
];

test('agrupar por decada cria cabecalhos com contagem, sem tirar linha nenhuma', function () {
  const lista = listaCom(ALBUNS, { sections: ['decade'] });
  const items = lista.self.displayItems;
  const headers = items.filter(function (it) { return it.type === 'header'; });
  const rows = items.filter(function (it) { return it.type === 'row'; });

  assert.equal(rows.length, ALBUNS.length, 'agrupar organiza, nunca exclui');
  assert.deepEqual(plain(headers.map(function (h) { return h.label; })),
    ['Years 1970', 'Unknown year']);
  assert.deepEqual(plain(headers.map(function (h) { return h.count; })), [4, 1]);
  assert.equal(headers[headers.length - 1].label, 'Unknown year',
    'o balde do desconhecido vai por ultimo, e existe');
});

/* Enquanto tudo tinha a mesma altura, indice x altura bastava. Com cabecalho no
   meio essa multiplicacao mente, e o sintoma seria a lista saltando durante a
   rolagem de 1.398 itens. */
test('a virtualizacao soma alturas reais em vez de multiplicar indice', function () {
  const lista = listaCom(ALBUNS, { sections: ['decade'] });
  const self = lista.self;
  const items = self.displayItems;
  const offsets = self.itemOffsets;

  let esperado = 0;
  items.forEach(function (it, i) {
    assert.equal(offsets[i], esperado, 'deslocamento do item ' + i);
    esperado += it.type === 'header' ? self.headerH : self.rowH;
  });
  assert.equal(offsets[items.length], esperado, 'a soma final e a altura total');

  /* topPad + itens desenhados + botPad tem de fechar a altura exata; se nao
     fechar, a barra de rolagem mente sobre o tamanho da lista. */
  self.first = 3;
  const desenhados = self.windowed.reduce(function (acc, it) {
    return acc + (it.type === 'header' ? self.headerH : self.rowH);
  }, 0);
  assert.equal(self.topPad + desenhados + self.botPad, esperado);

  assert.equal(self.indexAtOffset(0), 0);
  assert.equal(self.indexAtOffset(offsets[4] + 1), 4, 'a busca binaria acha o item da altura');
  assert.equal(self.indexAtOffset(esperado + 999), items.length - 1, 'alem do fim, o ultimo');
});

test('sem secao a lista continua sendo uma linha por item', function () {
  const lista = listaCom(ALBUNS, {});
  const items = lista.self.displayItems;
  assert.equal(items.length, ALBUNS.length);
  assert.ok(items.every(function (it) { return it.type === 'row'; }));
  assert.equal(lista.self.itemOffsets[3], 3 * lista.self.rowH,
    'sem cabecalho, a soma de prefixos coincide com a multiplicacao antiga');
});

test('um album com dois formatos aparece nas duas secoes, e a soma diz isso', function () {
  const index = {
    1: MIDIA(['flac', 'mp3'], { local: true, standard: true }),
    2: MIDIA(['flac'], { local: true, hires: true })
  };
  const lista = listaCom(ALBUNS.slice(0, 2), { sections: ['format'], mediaIndex: index });
  const items = lista.self.displayItems;
  const headers = items.filter(function (it) { return it.type === 'header'; });

  assert.deepEqual(plain(headers.map(function (h) { return h.label; })), ['FLAC', 'MP3']);
  assert.equal(headers[0].count, 2);
  assert.equal(headers[1].count, 1);
  assert.equal(lista.self.sectionOverlap, 1,
    'um album contado duas vezes: a tela precisa poder dizer isso');
});

test('album sem entrada no indice cai num balde visivel ao seccionar', function () {
  const index = { 1: MIDIA(['flac'], { local: true }) };
  const lista = listaCom(ALBUNS.slice(0, 2), { sections: ['format'], mediaIndex: index });
  const headers = lista.self.displayItems.filter(function (it) { return it.type === 'header'; });
  assert.deepEqual(plain(headers.map(function (h) { return h.label; })),
    ['FLAC', 'No media information']);
});

test('a trilha A-Z se esconde quando a lista deixa de ser alfabetica', function () {
  const muitos = [];
  for (let i = 0; i < 40; i++) {
    muitos.push({ key: 'al' + i, kind: 'album', id: i, label: 'Album ' + i, artist: 'X', year: 1970 });
  }
  assert.equal(listaCom(muitos, {}).self.hasRail, true);
  assert.equal(listaCom(muitos, { sections: ['decade'] }).self.hasRail, false,
    'com secoes a letra M aparece uma vez por secao e o salto nao teria destino');
  assert.equal(listaCom(muitos, { sort: [{ key: 'quality', desc: false }] }).self.hasRail, false,
    'ordenado por resolucao a lista tambem nao e alfabetica');
});

/* ---------- filtros novos: genero, ano, e o filtro sob agrupamento --------- */

test('o intervalo de ano filtra a linha, e ano ausente nao passa pelo intervalo', function () {
  const lista = listaCom(ALBUNS, { filters: ['year:1974-1977'] });
  const self = lista.self;
  assert.equal(self.yearMatches({ year: 1974 }), true);
  assert.equal(self.yearMatches({ year: 1977 }), true, 'o limite superior entra');
  assert.equal(self.yearMatches({ year: 1973 }), false);
  assert.equal(self.yearMatches({ year: null }), false, 'sem ano nao ha como afirmar que cabe');
});

/* Genero e a unica faceta que o servidor sabe aplicar; ela nao pode passar pelo
   indice de midia, senao filtrar por genero sem indice carregado reprovaria a
   biblioteca inteira no teste de "sem entrada no indice". */
test('genero nao passa pelo indice de midia', function () {
  const lista = listaCom(ALBUNS, { filters: ['genre:11'] });
  assert.equal(lista.self.mediaMatches(1), true,
    'sem chave de midia entre os filtros, o indice nem e consultado');
  assert.equal(lista.self.albumPasses({ id: 1, year: 1973 }), true);

  const comMidia = listaCom(ALBUNS, { filters: ['genre:11', 'format:flac'], mediaIndex: {} });
  assert.equal(comMidia.self.mediaMatches(1), false, 'a chave de formato continua valendo');
});

/* A promessa vazia de volta pela porta que a separacao dos estados abriu:
   agrupar por artista com um filtro ligado mostrava a pilula acesa sobre uma
   lista que ninguem tinha filtrado. */
test('com agrupamento por artista o filtro e aplicado aos albuns antes do mapeamento', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  const trecho = src.split('this.groupsMainArtists ? page')[1].split('this.appendRows')[0];
  assert.match(trecho, /albumPasses/,
    'o ramo de artista precisa filtrar os albuns antes de virar linha de artista');
});

test('Artista relacionado avisa que nao sabe filtrar, em vez de fingir', function () {
  const lista = listaCom(ALBUNS, { filters: ['format:flac'], group: ['relatedArtist'] });
  const def = lista.def;
  Object.defineProperty(lista.self, 'filtersIgnored', {
    get: def.computed.filtersIgnored.bind(lista.self)
  });
  assert.equal(lista.self.filtersIgnored, true);

  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  assert.match(src, /v-if="filtersIgnored"/, 'o aviso precisa existir na tela');
});

/* ---------- Fase 5: ranking e escolha ao tocar ----------------------------- */

const LOCAL_MP3 = MIDIA(['mp3'], { local: true, standard: true });
const STREAM_FLAC_HR = MIDIA(['flac'], { remote: true, hires: true, providers: ['qobuz'] });

test('preferir local poe a edicao local na frente, sem esconder a de streaming', function () {
  const captured = helpers.browseComponent();
  const ctx = captured.ctx;
  assert.ok(ctx.LmsFmt.compareEditions(LOCAL_MP3, STREAM_FLAC_HR, 'local') < 0);
  assert.ok(ctx.LmsFmt.compareEditions(STREAM_FLAC_HR, LOCAL_MP3, 'local') > 0);
});

test('preferir streaming inverte a ordem, e so ela', function () {
  const ctx = helpers.browseComponent().ctx;
  assert.ok(ctx.LmsFmt.compareEditions(STREAM_FLAC_HR, LOCAL_MP3, 'stream') < 0);
  assert.ok(ctx.LmsFmt.compareEditions(LOCAL_MP3, STREAM_FLAC_HR, 'stream') > 0);
});

/* O exemplo canonico: MP3 320 local contra FLAC 24/192 de streaming. Com
   qualidade, o FLAC vence no eixo do codec antes de chegar ao da resolucao --
   e a origem nao entra como criterio tecnico. */
test('preferir resolucao compara codec antes de resolucao e ignora a origem', function () {
  const ctx = helpers.browseComponent().ctx;
  assert.ok(ctx.LmsFmt.compareEditions(STREAM_FLAC_HR, LOCAL_MP3, 'quality') < 0,
    'FLAC 24/192 de streaming vence o MP3 320 local');

  const localFlacCd = MIDIA(['flac'], { local: true, standard: true });
  assert.ok(ctx.LmsFmt.compareEditions(localFlacCd, STREAM_FLAC_HR, 'quality') > 0,
    'entre dois lossless, decide a resolucao');
  assert.ok(ctx.LmsFmt.compareEditions(localFlacCd, LOCAL_MP3, 'quality') < 0,
    'lossless vence lossy antes de qualquer conta de taxa');

  /* DSD nao se compara tecnicamente com PCM: empata e cai no desempate de
     origem, em vez de fingir uma ordem que ninguem sabe defender. */
  const dsd = MIDIA(['dsd'], { local: true, hires: true });
  const flacHrLocal = MIDIA(['flac'], { local: true, hires: true });
  assert.ok(ctx.LmsFmt.compareEditions(flacHrLocal, dsd, 'quality') < 0,
    'lossless PCM e DSD ficam em classes diferentes, sem ordenacao tecnica entre elas');

  /* Metadado ausente nunca exclui: ordena abaixo, e continua na lista. */
  assert.ok(ctx.LmsFmt.compareEditions(LOCAL_MP3, null, 'quality') < 0);
});

test('sem preferencia declarada nada e reordenado', function () {
  const ctx = helpers.browseComponent().ctx;
  assert.equal(ctx.LmsFmt.compareEditions(STREAM_FLAC_HR, LOCAL_MP3, 'none'), 0);
  assert.equal(ctx.LmsFmt.compareEditions(LOCAL_MP3, STREAM_FLAC_HR, 'none'), 0);
});

/* A preferencia entra DEPOIS do desempate por titulo e artista: dois itens que
   empataram ali sao a mesma obra em edicoes diferentes. Antes disso, ela
   reordenaria a biblioteca inteira -- isso e ordenar por origem, que e outra
   escolha e tem chave propria. */
test('a preferencia reordena edicoes irmas, nao a biblioteca', function () {
  const rows = [
    { key: 'al1', kind: 'album', id: 1, label: 'Head Hunters', artist: 'Herbie Hancock', year: 1973 },
    { key: 'al2', kind: 'album', id: 2, label: 'Head Hunters', artist: 'Herbie Hancock', year: 1973 },
    { key: 'al3', kind: 'album', id: 3, label: 'Autobahn', artist: 'Kraftwerk', year: 1974 }
  ];
  const index = { 1: STREAM_FLAC_HR, 2: LOCAL_MP3, 3: STREAM_FLAC_HR };

  const semPreferencia = listaCom(rows, { mediaIndex: index });
  assert.deepEqual(plain(semPreferencia.self.displayRows.map(function (r) { return r.id; })), [3, 1, 2],
    'ordem alfabetica, desempate por id');

  const local = listaCom(rows, { mediaIndex: index, prefer: 'local' });
  assert.deepEqual(plain(local.self.displayRows.map(function (r) { return r.id; })), [3, 2, 1],
    'a edicao local sobe entre as irmas; Autobahn continua em primeiro');

  const qualidade = listaCom(rows, { mediaIndex: index, prefer: 'quality' });
  assert.deepEqual(plain(qualidade.self.displayRows.map(function (r) { return r.id; })), [3, 1, 2]);
});

test('edicoes irmas exigem titulo e artista iguais — marcador de edicao separa', function () {
  const rows = [
    { key: 'al1', kind: 'album', id: 1, label: 'Head Hunters', artist: 'Herbie Hancock' },
    { key: 'al2', kind: 'album', id: 2, label: 'Head Hunters', artist: 'Herbie Hancock' },
    { key: 'al3', kind: 'album', id: 3, label: 'Head Hunters (Remastered)', artist: 'Herbie Hancock' }
  ];
  const lista = listaCom(rows, { mediaIndex: { 1: STREAM_FLAC_HR, 2: LOCAL_MP3, 3: LOCAL_MP3 },
                                 prefer: 'local' });
  const edicoes = lista.self.editionsFor(rows[0]);
  assert.equal(edicoes.length, 2, 'a versao remasterizada nao entra: e outra obra ate prova em contrario');
  assert.equal(edicoes[0].id, 2, 'preferir local poe a local em primeiro');
  assert.match(edicoes[0].source, /Local library/);

  assert.deepEqual(plain(lista.self.editionsFor(rows[2])), [], 'sem irma, sem escolha a fazer');
});

test('sem preferencia a folha de acoes nao recebe edicoes — o play fica deterministico', function () {
  const rows = [
    { key: 'al1', kind: 'album', id: 1, label: 'Head Hunters', artist: 'Herbie Hancock' },
    { key: 'al2', kind: 'album', id: 2, label: 'Head Hunters', artist: 'Herbie Hancock' }
  ];
  const lista = listaCom(rows, { mediaIndex: { 1: STREAM_FLAC_HR, 2: LOCAL_MP3 } });
  const def = lista.def;
  let recebido = null;
  lista.ctx.LmsUi.openActions = function (item) { recebido = item; };
  lista.self.actions = def.methods.actions.bind(lista.self);

  lista.self.actions(rows[0], null);
  assert.equal(recebido.editions, undefined, 'padrao: toca exatamente o que foi clicado');
});

test('a folha de acoes diz qual edicao vai tocar antes de tocar', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/actions.js');
  assert.match(src, /chosenEdition/);
  assert.match(src, /Tocando a edição preferida: \{edition\}\./,
    'a frase inteira entra no dicionario, com marcador');
  assert.match(src, /item\.editions\.length > 1/, 'as outras edicoes ficam visiveis na folha');
});

/* Visto na tela: com quatro pilulas a contagem era espremida a 12px pelo
   flex:1 e o numero transbordava por cima de "Clear all". */
test('a contagem de resultados nao disputa espaco com a fileira de pilulas', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const regra = css.match(/\.filter-chip-count\{([^}]*)\}/)[1];
  assert.match(regra, /flex:0 0 auto/, 'a contagem nao pode encolher');
  assert.match(regra, /margin-left:auto/, 'ela encosta a direita sem esticar');
  const strip = css.match(/\.filter-pill-strip\{([^}]*)\}/)[1];
  assert.match(strip, /flex:1 1 auto/, 'quem estica e a fileira');
  assert.match(strip, /overflow-x:auto/, 'e ela rola quando nao cabe');
});

/* Visto na primeira abertura: o painel esquerdo comeca em 360px e a barra tem
   seis controles. Sem encolher nada, ela quebrava em tres linhas e comia a
   lista. O que encolhe e o rotulo do comando secundario -- a busca e o funil
   ficam, porque sao os dois que a barra existe para oferecer. */
test('a barra cabe em uma linha na divisao padrao', function () {
  const captured = helpers.browseComponent();
  const def = captured.def;
  assert.equal(def.data().paneWidth > 0, true);

  const self = { paneWidth: 360 };
  assert.equal(def.computed.toolbarTight.call(self), true, '360px e a largura padrao');
  self.paneWidth = 553;
  assert.equal(def.computed.toolbarTight.call(self), false, 'com folga o rotulo volta');

  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  assert.match(src, /class="text-command select-command"/);
  assert.match(src, /aria-label="Select"/,
    'virar icone nao pode custar o nome acessivel');
  assert.match(src, /:title="toolbarTight \? 'Select' : null"/,
    'e no modo icone precisa de tooltip');

  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const regra = css.match(/\.library-tools \.select-command\.tight\{([^}]*)\}/)[1];
  assert.match(regra, /width:44px/, 'o alvo de toque continua com 44px');

  /* Duas fileiras previsiveis em vez de tres imprevisiveis: a busca ocupa a
     primeira inteira e os comandos ficam na segunda. */
  const busca = css.match(/\.library-tools\.tight input\{([^}]*)\}/)[1];
  assert.match(busca, /flex:1 1 100%/);
  assert.match(src, /class="library-tools" :class="\{tight: toolbarTight\}"/);
});

/* Visto na foto do README: "Local library" aparecia em portugues numa sessao
   em ingles. O rotulo e montado em tempo de execucao e colado no subtitulo da
   linha, entao nao passa pelo translateTemplate -- precisa do tr() na mao. */
test('o rotulo de origem da linha passa pelo dicionario', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  const corpo = src.split('sourceLabel: function (track)')[1].split('},')[0];
  assert.match(corpo, /this\.tr\('Local library'\)/);
  assert.match(corpo, /this\.tr\('Streaming'\)/);

  const strings = helpers.read('EchoClassic/strings.txt');
  ['Local library', 'Streaming'].forEach(function (frase) {
    assert.ok(strings.indexOf('\t' + frase) >= 0, 'sem traducao: ' + frase);
  });
});
