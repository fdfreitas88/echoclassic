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
  ctx.LmsUi.setFilters(['stream:qobuz']);
  assert.equal(ctx.LmsUi.state.filters[0], 'stream:qobuz');

  ctx.LmsUi.setMusicView('artistas');
  assert.equal(ctx.LmsUi.state.filters.length, 0, 'artistas nao aceita filtro de midia');
  ctx.LmsUi.setFilters(['quality:hires']);
  assert.equal(ctx.LmsUi.state.filters.length, 0,
    'ui.js rejeita filtro fora de albuns/recentes, sem precisar de guarda em browse.js');

  ctx.LmsUi.setMusicView('recentes');
  assert.equal(ctx.LmsUi.state.filters[0], 'stream:qobuz',
    'volta para Recentes com o filtro que esvaziou a tela');
});

/* A regex de validSortForView foi reescrita para sair de dentro dela a regra de
   quais views filtram. O que ela aceita e recusa nao pode mudar junto. */
test('os tres validadores separam o que antes era uma regex so', function () {
  const ctx = helpers.uiContext();
  const u = ctx.LmsUi;

  ['name', 'artist', 'year'].forEach(function (k) {
    assert.equal(u.validSortKey('albuns', k), true, 'albuns ordena por ' + k);
  });
  ['recent', 'name', 'artist', 'year'].forEach(function (k) {
    assert.equal(u.validSortKey('recentes', k), true, 'recentes ordena por ' + k);
  });
  assert.equal(u.validSortKey('artistas', 'year'), false, 'artistas so ordena por nome');
  assert.equal(u.validSortKey('anos', 'year'), true);

  assert.equal(u.validGroup('albuns', 'artist'), true);
  assert.equal(u.validGroup('albuns', 'relatedArtist'), true);
  assert.equal(u.validGroup('recentes', 'artist'), false, 'Recentes desenha album sempre');
  assert.equal(u.validGroup('artistas', 'artist'), false);

  assert.equal(u.validFilter('albuns', 'format:flac'), true);
  assert.equal(u.validFilter('albuns', 'format:a:b'), false, 'valor de filtro nao tem dois-pontos');
  assert.equal(u.validFilter('artistas', 'format:flac'), false);
});

/* Resolve os computeds na ordem em que eles dependem uns dos outros e devolve um
   `this` utilizavel. O Vue faria isso sozinho; aqui nao ha Vue. */
function computedsFor(view, key) {
  const captured = helpers.browseComponent();
  const def = captured.def;
  const data = def.data();
  /* Roteia a chave para o conceito a que ela pertence, igual ao chooseOption. */
  const isFilter = /^(format|quality|origin|stream):/.test(key || '');
  const isGroup = view === 'albuns' && /^(artist|relatedArtist)$/.test(key || '');
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
test('a escolha do menu nao troca de view pelas costas do usuario', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  const body = src.split('chooseOption: function (value)')[1].split('},')[0];
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

/* O bug B: com filtro ativo, a unica pista de que ele existia era o
   mediaDescriptor colado no subtitulo de cada linha -- e quando o filtro zerava
   a lista, a pista sumia junto com as linhas. O aviso precisa viver FORA da
   lista, senao ele desaparece exatamente no caso em que e necessario. */
test('o chip do filtro vive fora da lista, e nao dentro dela', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  assert.match(src, /v-if="hasMediaFilter" class="filter-chip"/);
  assert.match(src, /class="filter-chip-label">Filtro ativo:/);
  assert.match(src, /v-for="f in activeFilters"/, 'uma pilula por filtro ativo');
  assert.match(src, /@click="LmsUi\.toggleFilter\(f\.key\)"/, 'cada pilula remove so o seu');
  assert.match(src, /@click="clearMediaFilter"/);

  const chipAt = src.indexOf('class="filter-chip"');
  const scrollerAt = src.indexOf('<div class="scroller"');
  assert.ok(chipAt > 0 && scrollerAt > 0);
  assert.ok(chipAt < scrollerAt,
    'o chip precisa estar antes do scroller: dentro dele sumiria junto com as linhas');
});

test('limpar o filtro nao toca na ordenacao — sao estados separados', function () {
  const captured = helpers.browseComponent();
  const LmsUi = captured.ctx.LmsUi;

  LmsUi.setMusicView('recentes');
  LmsUi.setSort([{ key: 'artist', desc: true }]);
  LmsUi.setFilters(['stream:qobuz']);
  captured.def.methods.clearMediaFilter.call({ view: 'recentes', ui: LmsUi.state });

  assert.equal(LmsUi.state.filters.length, 0, 'o filtro saiu');
  assert.equal(LmsUi.state.sort[0].key, 'artist', 'a ordenacao ficou');
  assert.equal(LmsUi.state.sort[0].desc, true, 'inclusive a direcao');
  assert.equal(LmsUi.state.musicView, 'recentes', 'e a view nao mudou');
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
    LMS_LANG: 'EN',
    LMS_STRINGS: {
      'Nada nesta categoria corresponde ao filtro': 'Nothing in this category matches the filter',
      'Nenhum item encontrado nesta categoria.': 'Nothing found in this category.',
      'Limpar filtro': 'Clear filter',
      'Filtro ativo:': 'Active filter:'
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
  assert.match(tpl, /Nothing in this category matches the filter \{\{ \$t\(mediaDescriptor\(\)\) \}\}/);
  assert.match(tpl, /class="filter-chip-label">Active filter:/);
  assert.match(tpl, />Clear filter</);
  assert.doesNotMatch(tpl, /Nada nesta categoria/,
    'o portugues nao pode sobrar numa sessao com dicionario');
});

test('mediaDescriptor nomeia o filtro que esvazia Recentes', function () {
  assert.equal(computedsFor('recentes', 'stream:qobuz').self.mediaDescriptor(), 'Qobuz');
  assert.equal(computedsFor('albuns', 'quality:hires').self.mediaDescriptor(), 'Hi-Res');
  assert.equal(computedsFor('albuns', 'format:flac').self.mediaDescriptor(), 'FLAC');
  assert.equal(computedsFor('recentes', 'recent').self.mediaDescriptor(), '',
    'sem filtro nao ha descritor, e a mensagem generica e a correta');
});

/* A outra metade do bug C. Em Albuns, "Artista" AGRUPA: produz linhas de artista.
   Em Recentes a mesma opcao so reordena albuns, porque Recentes nunca passa por
   loadPagedRoot. Mesmo rotulo, semanticas diferentes -- e por isso "procurei
   Beatles e vieram albuns". O rotulo do grupo precisa dizer qual das duas coisas
   esta acontecendo. */
test('Recentes nao promete agrupar: la a opcao Artista so reordena', function () {
  const recentes = computedsFor('recentes', 'artist');
  assert.equal(recentes.self.groupsMainArtists, false,
    'Recentes nunca produz linha de artista, nem com sortKey=artist');

  const albuns = computedsFor('albuns', 'artist');
  assert.equal(albuns.self.groupsMainArtists, true, 'em Albuns, Artista agrupa de verdade');

  assert.equal(recentes.def.computed.displayGroupLabel.call(recentes.self), 'Ordenar por');
  assert.equal(albuns.def.computed.displayGroupLabel.call(albuns.self), 'Agrupar ou ordenar');
});

test('o rotulo do select acompanha o que a view sabe fazer', function () {
  const artistas = computedsFor('artistas', 'name');
  assert.equal(artistas.def.computed.displayGroupLabel.call(artistas.self), 'Ordenar por');
  assert.equal(artistas.def.computed.sortSelectLabel.call(artistas.self), 'Ordenar');

  const recentes = computedsFor('recentes', 'recent');
  assert.equal(recentes.def.computed.sortSelectLabel.call(recentes.self), 'Ordenar ou filtrar');

  const albuns = computedsFor('albuns', 'name');
  assert.equal(albuns.def.computed.sortSelectLabel.call(albuns.self), 'Agrupar, ordenar ou filtrar');

  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  assert.match(src, /<select :value="menuValue" :aria-label="sortSelectLabel"/);
  assert.match(src, /<optgroup :label="displayGroupLabel">/);
});

/* Atributo dinamico nao passa pelo translateTemplate -- a lista ATTRS do i18n so
   cobre atributo estatico, e nem inclui `label`. Sem passar pelo dicionario na
   mao, estes dois rotulos ficariam em portugues numa sessao em ingles. */
test('os rotulos calculados do menu passam pelo dicionario', function () {
  let def = null;
  const ctx = helpers.uiContext({
    LMS_LANG: 'EN',
    LMS_STRINGS: { 'Ordenar por': 'Sort by', 'Agrupar ou ordenar': 'Group or sort' },
    Vue: {
      prototype: {},
      observable: function (o) { return o; },
      component: function (name, definition) { def = definition; },
      nextTick: function (f) { if (f) f(); }
    }
  });
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/i18n.js');
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/browse.js');

  const self = { view: 'recentes' };
  self.tr = def.methods.tr.bind(self);
  assert.equal(def.computed.displayGroupLabel.call(self), 'Sort by');
  self.view = 'albuns';
  assert.equal(def.computed.displayGroupLabel.call(self), 'Group or sort');
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
    const pt = entries[k].PT;
    const target = entries[k][lang] || entries[k].EN;
    if (!pt || !target || target === pt) return;   /* Plugin.pm:151 */
    map[pt] = target;
  });
  return map;
}

test('todo texto novo da interface chega traduzido, vindo do strings.txt real', function () {
  let def = null;
  const ctx = helpers.uiContext({
    LMS_LANG: 'EN',
    LMS_STRINGS: dictionaryFromStrings('EN'),
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
  ['Nada nesta categoria corresponde ao filtro', 'Limpar filtro',
   'Nenhum item encontrado nesta categoria.'].forEach(function (phrase) {
    assert.ok(tpl.indexOf(phrase) < 0, 'sobrou em portugues no template: ' + phrase);
  });
  assert.match(tpl, /Nothing in this category matches the filter/);
  assert.match(tpl, /Active filter:/);
  assert.match(tpl, />Clear filter</);

  /* Os rotulos calculados nao vivem no template: passam pelo tr() em tempo de
     execucao, entao sao conferidos chamando as computeds. */
  const self = { view: 'recentes' };
  self.tr = def.methods.tr.bind(self);
  assert.equal(def.computed.displayGroupLabel.call(self), 'Sort by');
  assert.equal(def.computed.sortSelectLabel.call(self), 'Sort or filter');
  self.view = 'albuns';
  assert.equal(def.computed.displayGroupLabel.call(self), 'Group or sort');
  assert.equal(def.computed.sortSelectLabel.call(self), 'Group, sort or filter');
  self.view = 'artistas';
  assert.equal(def.computed.sortSelectLabel.call(self), 'Sort');
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
  const plural = '{n} álbuns não puderam ser atribuídos a um artista do índice e aparecem como álbum nesta lista.';
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
  const self = { view: view, ui: ui, MEDIA_FORMATS: data.MEDIA_FORMATS, rows: [], mediaIndex: null };
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
  const c = comFiltros('albuns', ['format:flac', 'format:alac', 'quality:hires']);
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
  const c = comFiltros('albuns', ['stream:qobuz']);
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
  const c = comFiltros('albuns', ['format:flac']);
  c.self.mediaIndex = { '1': META({ formats: { flac: true } }) };
  assert.equal(c.self.mediaMatches(1), true);
  assert.equal(c.self.mediaMatches(99), false, 'sem meta nao casa');
  assert.equal(c.self.unknownCounted, true, 'mas foi contabilizado para virar aviso');
});

test('cada filtro ativo vira um chip com rotulo proprio', function () {
  const c = comFiltros('albuns', ['format:flac', 'quality:hires', 'stream:qobuz']);
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
