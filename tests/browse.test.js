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
  self.tr = def.methods.tr.bind(self);
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

/* O bug B: com filtro ativo, a unica pista de que ele existia era o
   mediaDescriptor colado no subtitulo de cada linha -- e quando o filtro zerava
   a lista, a pista sumia junto com as linhas. O aviso precisa viver FORA da
   lista, senao ele desaparece exatamente no caso em que e necessario. */
test('o chip do filtro vive fora da lista, e nao dentro dela', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  assert.match(src, /v-if="hasMediaFilter" class="filter-chip"/);
  assert.match(src, /Filtro ativo: \{\{ mediaDescriptor\(\) \}\}/);
  assert.match(src, /@click="clearMediaFilter"/);

  const chipAt = src.indexOf('class="filter-chip"');
  const scrollerAt = src.indexOf('<div class="scroller"');
  assert.ok(chipAt > 0 && scrollerAt > 0);
  assert.ok(chipAt < scrollerAt,
    'o chip precisa estar antes do scroller: dentro dele sumiria junto com as linhas');
});

test('clearMediaFilter devolve cada view a sua ordenacao propria', function () {
  const captured = helpers.browseComponent();
  const LmsUi = captured.ctx.LmsUi;

  LmsUi.setMusicView('recentes');
  LmsUi.setSort('stream:qobuz', false);
  captured.def.methods.clearMediaFilter.call({ view: 'recentes', ui: LmsUi.state });
  assert.equal(LmsUi.state.sortKey, 'recent',
    "Recentes volta para 'recent' (ordem do servidor), nao para 'name' -- reordenar por nome apagaria o criterio que da nome a pagina");
  assert.equal(LmsUi.state.musicView, 'recentes', 'limpar o filtro nao troca de view');

  LmsUi.setMusicView('albuns');
  LmsUi.setSort('quality:hires', false);
  captured.def.methods.clearMediaFilter.call({ view: 'albuns', ui: LmsUi.state });
  assert.equal(LmsUi.state.sortKey, 'name');
  assert.equal(LmsUi.state.musicView, 'albuns');
});

/* A mensagem generica era literalmente falsa: dizia que a categoria nao tem itens
   quando o que houve foi um filtro escondendo todos eles. */
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
  assert.match(tpl, /Active filter: \{\{ \$t\(mediaDescriptor\(\)\) \}\}/);
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
  assert.match(src, /<select :value="ui\.sortKey" :aria-label="sortSelectLabel"/);
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
  ['Nada nesta categoria corresponde ao filtro', 'Filtro ativo:', 'Limpar filtro',
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
