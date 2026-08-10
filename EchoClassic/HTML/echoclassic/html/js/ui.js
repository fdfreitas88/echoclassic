
/* View state: what the user is looking at. Everything that comes from the server
   lives in LmsStore instead. Components read this and call these actions; they do
   not reach into LmsStore.state. */
(function (global) {
  'use strict';

  var TABS = Object.freeze([
    Object.freeze({ key: 'favourites', label: 'Favourites' }),
    Object.freeze({ key: 'radio', label: 'Radio' }),
    Object.freeze({ key: 'apps', label: 'Apps' }),
    Object.freeze({ key: 'playlists', label: 'Playlists' }),
    Object.freeze({ key: 'music', label: 'My Music' }),
    Object.freeze({ key: 'settings', label: 'Settings' })
  ]);

  /* The four roots of Minha Musica, picked from the nav bar title like iOS 9. */
  var MUSIC_VIEWS = Object.freeze([
    Object.freeze({ key: 'recent', label: 'Recent' }),
    Object.freeze({ key: 'artists', label: 'Artists' }),
    Object.freeze({ key: 'albums', label: 'Albums' }),
    Object.freeze({ key: 'genres', label: 'Genres' }),
    Object.freeze({ key: 'years', label: 'Years' })
  ]);

  var COLOR_SCHEMES = Object.freeze([
    Object.freeze({ key: 'blue', label: 'System Blue' }),
    Object.freeze({ key: 'teal', label: 'Atlantic Teal' }),
    Object.freeze({ key: 'crimson', label: 'Editorial Crimson' }),
    Object.freeze({ key: 'indigo', label: 'Studio Indigo' }),
    Object.freeze({ key: 'amber', label: 'Hi-Fi Amber' }),
    Object.freeze({ key: 'silver', label: 'Silver' }),
    Object.freeze({ key: 'black', label: 'Black' })
  ]);

  var THEME_OPTIONS = Object.freeze([
    Object.freeze({ key: 'light', label: 'Light' }),
    Object.freeze({ key: 'dark', label: 'Dark' }),
    Object.freeze({ key: 'legacy', label: 'Legacy' })
  ]);

  var FONT_OPTIONS = Object.freeze([
    Object.freeze({ key: 'system', label: 'System (default)' }),
    Object.freeze({ key: 'helvetica', label: 'Helvetica' }),
    Object.freeze({ key: 'chicago', label: 'Chicago' }),
    Object.freeze({ key: 'podium', label: 'Podium Sans' }),
    Object.freeze({ key: 'espy', label: 'Espy Sans' })
  ]);

  var PLAYER_PRESENTATIONS = Object.freeze([
    Object.freeze({ key: 'adaptive', label: 'Adaptive' }),
    Object.freeze({ key: 'fullscreen', label: 'Full screen' })
  ]);

  /* 3.2.6c (C6): reordered left/center/right so the Player layout segmented
     control reads in visual order and radioKey's arrow navigation follows it.
     Stored values are the keys themselves, never an index, so this reorder
     does not touch persisted state -- only the display and cycling order
     change (cyclePlayerPosition below, and its one caller in
     nowplaying.js's position button, now cycle left -> center -> right
     instead of right -> left -> center; accepted, not a regression). */
  var PLAYER_POSITIONS = Object.freeze([
    Object.freeze({ key: 'left', label: 'Left' }),
    Object.freeze({ key: 'center', label: 'Center' }),
    Object.freeze({ key: 'right', label: 'Right' })
  ]);

  /* AUDIT-09: como a fila mostra capa. 'every' e o comportamento antigo.
     'album' e o padrao -- capa uma vez por sequencia do mesmo albumId, nunca
     por nome (colide) nem por coverid (e por faixa, nao por album). 'headings'
     acrescenta uma legenda de 22px por cima de cada sequencia, sem alterar a
     altura da linha. */
  var QUEUE_ART_MODES = Object.freeze([
    Object.freeze({ key: 'every', label: 'Every track' }),
    Object.freeze({ key: 'album', label: 'Once per album' }),
    Object.freeze({ key: 'headings', label: 'Once per album, with headings' })
  ]);

  function isQueueArtMode(key) {
    return QUEUE_ART_MODES.some(function (mode) { return mode.key === key; });
  }

  /* Preferencia de player padrao: 'last' (sentinela, o comportamento de sempre
     -- segue a ultima selecao explicita) ou o id de um player especifico,
     escolhido nos Ajustes. O id nao vem de uma lista fechada -- e o que o
     servidor atribui a cada player -- entao a validacao aqui so garante a
     forma (string nao vazia); quem confere se aquele id ainda existe e
     LmsStore, ao resolver o player ativo. */
  var DEFAULT_PLAYER_LAST = 'last';

  function isDefaultPlayer(value) {
    return typeof value === 'string' && value.length > 0;
  }

  var GAUGE_STYLES = Object.freeze([
    Object.freeze({ key: 'flat', label: 'Flat' }),
    Object.freeze({ key: 'classic', label: 'Classic' })
  ]);

  var GAUGE_COLORS = Object.freeze([
    Object.freeze({ key: 'theme', label: 'Follow theme' }),
    Object.freeze({ key: 'blue', label: 'System Blue' }),
    Object.freeze({ key: 'teal', label: 'Atlantic Teal' }),
    Object.freeze({ key: 'crimson', label: 'Editorial Crimson' }),
    Object.freeze({ key: 'indigo', label: 'Studio Indigo' }),
    Object.freeze({ key: 'amber', label: 'Hi-Fi Amber' }),
    Object.freeze({ key: 'silver', label: 'Silver' }),
    Object.freeze({ key: 'black', label: 'Black' })
  ]);

  function isColorScheme(key) {
    return COLOR_SCHEMES.some(function (scheme) { return scheme.key === key; });
  }

  function isThemeOption(key) {
    return THEME_OPTIONS.some(function (theme) { return theme.key === key; });
  }

  function isFontOption(key) {
    return FONT_OPTIONS.some(function (font) { return font.key === key; });
  }

  /* Per-surface (mini/small/full) overrides add a third value the app-level
     settings never accept: the sentinel 'app', meaning "follow the app-wide
     choice". isColorScheme/isFontOption above must keep rejecting it -- widening
     them would let the app-level colorScheme/fontFamily themselves be set to
     'app', which is meaningless. These three predicates are the only place
     'app' is a legal value. */
  function isSurfaceTheme(key) {
    return key === 'app' || isThemeOption(key);
  }

  function isSurfaceScheme(key) {
    return key === 'app' || isColorScheme(key);
  }

  function isSurfaceFont(key) {
    return key === 'app' || isFontOption(key);
  }

  /* The three surfaces a theme/scheme/font override can target, and the state
     keys each owns. Shared by surfaceAttrs, surfaceFollowsApp and the three
     setSurface* setters so the mapping is written once. */
  var SURFACE_KEYS = {
    mini: { theme: 'miniTheme', scheme: 'miniColorScheme', font: 'miniFont' },
    small: { theme: 'smallTheme', scheme: 'smallColorScheme', font: 'smallFont' },
    full: { theme: 'fullTheme', scheme: 'fullColorScheme', font: 'fullFont' }
  };

  function isPlayerPresentation(key) {
    return PLAYER_PRESENTATIONS.some(function (mode) { return mode.key === key; });
  }

  function isPlayerPosition(key) {
    return PLAYER_POSITIONS.some(function (position) { return position.key === key; });
  }

  function isGaugeStyle(key) {
    return GAUGE_STYLES.some(function (style) { return style.key === key; });
  }

  function isGaugeColor(key) {
    return GAUGE_COLORS.some(function (color) { return color.key === key; });
  }

  function isMusicView(key) {
    return MUSIC_VIEWS.some(function (view) { return view.key === key; });
  }

  /* Ler o localStorage e ler dados de terceiros: um arquivo de preferencias
     corrompido continua sendo JSON valido e antes derrubava a skin a cada
     recarga. Aqui a forma e conferida antes de qualquer uso. */
  function plainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  }

  function readObject(key) {
    try { return plainObject(JSON.parse(localStorage.getItem(key) || '')) || {}; }
    catch (e) { return {}; }
  }

  function readArray(key) {
    try {
      var value = JSON.parse(localStorage.getItem(key) || '');
      return Array.isArray(value) ? value : [];
    } catch (e) { return []; }
  }

  var saved = readObject('echoclassic.ui.v2');
  var savedPins = readArray('echoclassic.pins.v1').filter(function (pin) {
    return !!plainObject(pin);
  });

  /* 'recent' significa "ordem nativa do servidor": Recentes ja chega ordenado
     por data de inclusao e reordenar no cliente apagava justamente o criterio
     que da nome a pagina. */
  var DEFAULT_SORT_BY_VIEW = {
    artists: 'name', albums: 'name', recent: 'recent', genres: 'name', years: 'year'
  };

  /* So Albuns e Recentes sabem aplicar filtro de midia: sao as duas views cujo
     carregamento passa por loadMediaIndex. Exportado porque o menu em browse.js
     precisa da mesma resposta para nao oferecer o que a view nao honra -- ate
     aqui essa regra estava escrita em tres lugares, e o de browse.js trocava a
     view do usuario por conta propria para fazer a escolha caber. */
  function allowsMediaFilter(view) {
    return view === 'albums' || view === 'recent';
  }

  /* A chave de filtro e um par faceta:valor. Guardar uma lista plana de chaves,
     e nao um objeto por faceta, e o que faz "remover este filtro" ser a mesma
     operacao para todas as facetas -- inclusive as que vieram depois. As tres
     gramaticas existem porque o valor tem forma diferente em cada uma: conjunto
     fechado, id do servidor, e intervalo. */
  var MEDIA_FILTER = /^(format|quality|origin|stream):[a-z0-9]+$/;
  var GENRE_FILTER = /^genre:\d+$/;
  var YEAR_FILTER = /^year:(\d{4})-(\d{4})$/;

  function validFilter(view, key) {
    var value = key || '';
    if (!allowsMediaFilter(view)) return false;
    if (MEDIA_FILTER.test(value) || GENRE_FILTER.test(value)) return true;
    var range = YEAR_FILTER.exec(value);
    return !!range && Number(range[1]) <= Number(range[2]);
  }

  function filterFacet(key) {
    var at = String(key || '').indexOf(':');
    return at < 0 ? '' : String(key).slice(0, at);
  }

  /* Uma faceta so aceita um intervalo de ano -- dois intervalos ao mesmo tempo
     seriam um OU que ninguem consegue ler na fileira de pilulas. */
  function singleValueFacet(facet) {
    return facet === 'year';
  }

  /* Ordenar e reordenar o que ja esta na tela. Nao exclui nada e nao muda a
     natureza das linhas. 'format', 'source' e 'quality' leem o indice de midia,
     entao so existem onde esse indice e carregado. */
  function sortNeedsMedia(key) {
    return /^(format|source|quality)$/.test(key || '');
  }

  function validSortKey(view, key) {
    if (view === 'albums') return /^(name|artist|year|format|source|quality)$/.test(key || '');
    if (view === 'recent') return /^(recent|name|artist|year|format|source|quality)$/.test(key || '');
    if (view === 'years') return key === 'name' || key === 'year';
    return key === 'name';
  }

  /* Agrupar troca a natureza das linhas: a lista passa a mostrar artistas em vez
     de albuns. So Albuns faz isso, porque so ela passa por loadPagedRoot com
     indice de artistas. Recentes desenha album sempre -- oferecer "agrupar por
     artista" la era a promessa vazia do bug C. */
  function validGroup(view, key) {
    return view === 'albums' && /^(artist|relatedArtist)$/.test(key || '');
  }

  /* Seccionar e o outro agrupamento: a linha continua sendo o album e ganha um
     cabecalho acima. Sao dois conceitos com efeitos diferentes na tela, entao
     ficam em dois estados -- juntar os dois num `group` so foi o que obrigou a
     reverter a fundacao da Fase 4. */
  function validSection(view, key) {
    return allowsMediaFilter(view) && /^(decade|format|quality|origin|stream)$/.test(key || '');
  }

  function sectionNeedsMedia(key) {
    return /^(format|quality|origin|stream)$/.test(key || '');
  }

  var PREFER_MODES = Object.freeze(['none', 'local', 'stream', 'quality']);

  function validPrefer(key) {
    return PREFER_MODES.indexOf(key) >= 0;
  }

  function defaultsFor(view) {
    return {
      filters: [],
      sort: [{ key: DEFAULT_SORT_BY_VIEW[view] || 'name', desc: false }],
      group: [],
      sections: []
    };
  }

  function sanitize(view, entry) {
    var out = defaultsFor(view);
    if (!plainObject(entry)) return out;
    if (Array.isArray(entry.filters)) {
      var seenFacet = Object.create(null);
      out.filters = entry.filters.filter(function (key) {
        if (!validFilter(view, key)) return false;
        var facet = filterFacet(key);
        if (!singleValueFacet(facet)) return true;
        if (seenFacet[facet]) return false;
        seenFacet[facet] = true;
        return true;
      });
    }
    if (Array.isArray(entry.sort)) {
      var sort = entry.sort.filter(function (item) {
        return plainObject(item) && validSortKey(view, item.key);
      }).map(function (item) { return { key: item.key, desc: !!item.desc }; });
      if (sort.length) out.sort = sort;
    }
    if (Array.isArray(entry.group)) {
      out.group = entry.group.filter(function (key) { return validGroup(view, key); });
    }
    /* Profundidade 1 por enquanto: a lista e virtualizada por soma de prefixos,
       e um segundo nivel muda a altura do cabecalho e a contagem de cada faixa
       de rolagem. Um nivel entrega o exemplo pedido (agrupar por formato). */
    if (Array.isArray(entry.sections)) {
      out.sections = entry.sections.filter(function (key) {
        return validSection(view, key);
      }).slice(0, 1);
    }
    return out;
  }

  /* Desmembra o sortKey unico da 3.1.x no conceito a que ele pertencia. Sem
     isto, quem ja usava a skin abre a 3.2.0 e perde a escolha -- ou, pior,
     ganha um agrupamento que nunca pediu. */
  function migrateSortKey(view, key, desc) {
    var entry = defaultsFor(view);
    if (!key) return entry;
    if (validFilter(view, key)) { entry.filters = [key]; return entry; }
    if (validGroup(view, key)) { entry.group = [key]; return entry; }
    if (validSortKey(view, key)) { entry.sort = [{ key: key, desc: !!desc }]; }
    return entry;
  }

  var byView = {};
  var savedByView = plainObject(saved.byView) ? saved.byView : null;
  Object.keys(DEFAULT_SORT_BY_VIEW).forEach(function (view) {
    if (savedByView) { byView[view] = sanitize(view, savedByView[view]); return; }
    /* Sem byView gravado, o que existe e o formato da 3.1.x. */
    var legacy = plainObject(saved.sortByView) ? saved.sortByView[view] : null;
    if (view === saved.musicView && saved.sortKey) legacy = saved.sortKey;
    /* O padrao anterior de Recentes era 'name', e nada no gravado distingue
       escolha deliberada de default herdado. */
    if (view === 'recent' && !saved.recentSortMigrated && legacy === 'name') legacy = null;
    byView[view] = migrateSortKey(view, legacy, saved.sortDesc);
  });

  function viewEntry(view) {
    if (!byView[view]) byView[view] = defaultsFor(view);
    return byView[view];
  }

  var lightMiniGaugeStyle = isGaugeStyle(saved.lightMiniGaugeStyle) ? saved.lightMiniGaugeStyle
    : (isGaugeStyle(saved.miniGaugeStyle) ? saved.miniGaugeStyle : 'classic');
  var lightPlayerGaugeStyle = isGaugeStyle(saved.lightPlayerGaugeStyle) ? saved.lightPlayerGaugeStyle
    : (isGaugeStyle(saved.playerGaugeStyle) ? saved.playerGaugeStyle : 'classic');
  var darkMiniGaugeStyle = isGaugeStyle(saved.darkMiniGaugeStyle) ? saved.darkMiniGaugeStyle : 'flat';
  var darkPlayerGaugeStyle = isGaugeStyle(saved.darkPlayerGaugeStyle) ? saved.darkPlayerGaugeStyle : 'flat';
  var legacyMiniGaugeStyle = isGaugeStyle(saved.legacyMiniGaugeStyle) ? saved.legacyMiniGaugeStyle : 'classic';
  var legacyPlayerGaugeStyle = isGaugeStyle(saved.legacyPlayerGaugeStyle) ? saved.legacyPlayerGaugeStyle : 'classic';
  var initialTheme = isThemeOption(saved.theme) ? saved.theme : (saved.dark ? 'dark' : 'light');

  function currentMiniGaugeStyle(theme) {
    if (theme === 'dark') return darkMiniGaugeStyle;
    if (theme === 'legacy') return legacyMiniGaugeStyle;
    return lightMiniGaugeStyle;
  }

  function currentPlayerGaugeStyle(theme) {
    if (theme === 'dark') return darkPlayerGaugeStyle;
    if (theme === 'legacy') return legacyPlayerGaugeStyle;
    return lightPlayerGaugeStyle;
  }

  function gaugePrefix(theme) {
    if (theme === 'dark') return 'dark';
    if (theme === 'legacy') return 'legacy';
    return 'light';
  }

  /* persist() ja gravava musicView; so o estado inicial ignorava, e a raiz
     escolhida se perdia a cada recarga. */
  var initialMusicView = isMusicView(saved.musicView) ? saved.musicView : 'recent';

  /* Uma vista salva e um conjunto completo -- filtros, ordem, agrupamento,
     secoes e preferencia -- amarrado a raiz em que faz sentido. Guardar a raiz
     junto evita aplicar "FLAC + Hi-Res" dentro de Generos, onde nonea das
     duas coisas existe. Chave propria, com versao, porque o formato vai mudar
     antes do resto das preferencias. */
  var VIEWS_KEY = 'echoclassic.views.v1';

  function sanitizeView(entry) {
    if (!plainObject(entry)) return null;
    var view = isMusicView(entry.view) ? entry.view : 'albums';
    var name = String(entry.name || '').replace(/^\s+|\s+$/g, '').slice(0, 60);
    if (!name) return null;
    var body = sanitize(view, entry);
    return {
      id: String(entry.id || '') || (name.toLowerCase() + '-' + view),
      name: name, view: view,
      filters: body.filters, sort: body.sort, group: body.group, sections: body.sections,
      prefer: validPrefer(entry.prefer) ? entry.prefer : 'none'
    };
  }

  function readViews() {
    var stored = readObject(VIEWS_KEY);
    var list = Array.isArray(stored.list) ? stored.list : [];
    var out = [];
    var seen = Object.create(null);
    list.forEach(function (entry) {
      var clean = sanitizeView(entry);
      if (!clean || seen[clean.id]) return;
      seen[clean.id] = true;
      out.push(clean);
    });
    return { list: out, defaultId: seen[stored.defaultId] ? String(stored.defaultId) : '' };
  }

  var savedViews = readViews();

  var state = Vue.observable({
	    tab: isTab(saved.tab) ? saved.tab : 'music',
    musicView: initialMusicView,
    albumMode: saved.albumMode || 'albums',   // 'albums' = grade de capas | 'tracks' = pilha completa
    /* Um valor gravado por uma versao futura (ou corrompido) nao pode zerar a
       capa da fila inteira -- cai no padrao em vez de travar num estado vazio. */
    queueArtMode: isQueueArtMode(saved.queueArtMode) ? saved.queueArtMode : 'album',
    /* Como queueArtMode acima: um valor gravado por versao futura, ou
       corrompido, cai no sentinela 'last' em vez de travar a escolha de
       player num id que nao existe mais. */
    defaultPlayer: isDefaultPlayer(saved.defaultPlayer) ? saved.defaultPlayer : DEFAULT_PLAYER_LAST,
    theme: initialTheme,
    dark: initialTheme === 'dark',
    searching: false,
    query: '',
    full: false,
    playerPresentation: isPlayerPresentation(saved.playerPresentation) ? saved.playerPresentation : 'adaptive',
    playerPosition: isPlayerPosition(saved.playerPosition) ? saved.playerPosition : 'right',
    miniGaugeStyle: currentMiniGaugeStyle(initialTheme),
    playerGaugeStyle: currentPlayerGaugeStyle(initialTheme),
    lightMiniGaugeStyle: lightMiniGaugeStyle,
    lightPlayerGaugeStyle: lightPlayerGaugeStyle,
    darkMiniGaugeStyle: darkMiniGaugeStyle,
    darkPlayerGaugeStyle: darkPlayerGaugeStyle,
    legacyMiniGaugeStyle: legacyMiniGaugeStyle,
    legacyPlayerGaugeStyle: legacyPlayerGaugeStyle,
    miniGaugeColor: isGaugeColor(saved.miniGaugeColor) ? saved.miniGaugeColor : 'theme',
    playerGaugeColor: isGaugeColor(saved.playerGaugeColor) ? saved.playerGaugeColor : 'theme',
    playerFullscreen: false,
    advancedSettings: false,
    advancedSettingsDirty: false,
    advancedSettingsPage: '',
    queueOpen: false,
    queueInline: false,  // Proximas abre sob demanda, como na folha do iOS 9
    picker: false,
    playerPicker: false,
    actionItem: null,
    actionAnchor: null,
    infoItem: null,
    /* Espelho do byView[musicView]. Os quatro sao independentes: filtrar
       exclui, ordenar reordena, agrupar troca a natureza da linha, seccionar
       acrescenta cabecalhos sem tirar nada. */
    filters: viewEntry(initialMusicView).filters.slice(),
    sort: viewEntry(initialMusicView).sort.map(function (s) { return { key: s.key, desc: s.desc }; }),
    group: viewEntry(initialMusicView).group.slice(),
    sections: viewEntry(initialMusicView).sections.slice(),
    /* Preferencia de reproducao nao filtra e nao esconde: ela ordena edicoes
       equivalentes e escolhe qual toca. Por isso e global, e nao por view. */
    prefer: validPrefer(saved.prefer) ? saved.prefer : 'none',
    filterPanel: false,
    sortMenu: false,
    sortAnchor: null,
    /* Nome de genero vem do servidor e a pilula precisa dele para nao mostrar
       "genre:12". Guardado aqui porque o painel e a lista leem o mesmo mapa. */
    genreNames: readObject('echoclassic.genrenames.v1'),
    views: savedViews.list,
    defaultView: savedViews.defaultId,
    filter: '',
    selectionMode: false,
    selected: {},
    pins: savedPins,
    colorScheme: isColorScheme(saved.colorScheme) ? saved.colorScheme : 'blue',
    fontFamily: isFontOption(saved.fontFamily) ? saved.fontFamily : 'system',
    /* Per-surface appearance overrides: 'app' is the sentinel meaning "follow
       the app-wide choice" and is the only default that survives a corrupted
       or future-versioned payload -- see isSurfaceTheme/isSurfaceScheme/
       isSurfaceFont above for why the ordinary predicates cannot validate
       these. */
    miniTheme: isSurfaceTheme(saved.miniTheme) ? saved.miniTheme : 'app',
    miniColorScheme: isSurfaceScheme(saved.miniColorScheme) ? saved.miniColorScheme : 'app',
    miniFont: isSurfaceFont(saved.miniFont) ? saved.miniFont : 'app',
    smallTheme: isSurfaceTheme(saved.smallTheme) ? saved.smallTheme : 'app',
    smallColorScheme: isSurfaceScheme(saved.smallColorScheme) ? saved.smallColorScheme : 'app',
    smallFont: isSurfaceFont(saved.smallFont) ? saved.smallFont : 'app',
    fullTheme: isSurfaceTheme(saved.fullTheme) ? saved.fullTheme : 'app',
    fullColorScheme: isSurfaceScheme(saved.fullColorScheme) ? saved.fullColorScheme : 'app',
    fullFont: isSurfaceFont(saved.fullFont) ? saved.fullFont : 'app',
    /* Which Appearance screen (if any) is open. Not persisted: it is
       navigation state, not a preference, and always starts closed. */
    appearanceScreen: null,
    showBadges: saved.showBadges !== false,
    markHires: saved.markHires !== false,
    busyMessage: '',
    notice: '',
    noticeKind: 'info'
  });

  var noticeTimer = null;

  function applyAppearance() {
    if (!document.body) return;
    state.dark = state.theme === 'dark';
    document.body.classList.toggle('dark', state.theme === 'dark');
    document.body.classList.toggle('legacy', state.theme === 'legacy');
    document.body.setAttribute('data-theme', state.theme);
    document.body.setAttribute('data-color-scheme', state.colorScheme);
    document.body.setAttribute('data-font', state.fontFamily);
    document.body.setAttribute('data-mini-gauge-style', state.miniGaugeStyle);
    document.body.setAttribute('data-player-gauge-style', state.playerGaugeStyle);
    document.body.setAttribute('data-mini-gauge-color', state.miniGaugeColor);
    document.body.setAttribute('data-player-gauge-color', state.playerGaugeColor);
  }

  if (document.body) applyAppearance();
  else document.addEventListener('DOMContentLoaded', applyAppearance, { once: true });

  function persist() {
    try {
      localStorage.setItem('echoclassic.ui.v2', JSON.stringify({
        tab: state.tab, musicView: state.musicView, theme: state.theme, dark: state.theme === 'dark',
        byView: byView,
        albumMode: state.albumMode, queueArtMode: state.queueArtMode,
        defaultPlayer: state.defaultPlayer,
        showBadges: state.showBadges,
        markHires: state.markHires, colorScheme: state.colorScheme,
        fontFamily: state.fontFamily, playerPresentation: state.playerPresentation,
        playerPosition: state.playerPosition,
        miniGaugeStyle: state.miniGaugeStyle, playerGaugeStyle: state.playerGaugeStyle,
        lightMiniGaugeStyle: state.lightMiniGaugeStyle,
        lightPlayerGaugeStyle: state.lightPlayerGaugeStyle,
        darkMiniGaugeStyle: state.darkMiniGaugeStyle,
        darkPlayerGaugeStyle: state.darkPlayerGaugeStyle,
        legacyMiniGaugeStyle: state.legacyMiniGaugeStyle,
        legacyPlayerGaugeStyle: state.legacyPlayerGaugeStyle,
        miniGaugeColor: state.miniGaugeColor, playerGaugeColor: state.playerGaugeColor,
        prefer: state.prefer,
        miniTheme: state.miniTheme, miniColorScheme: state.miniColorScheme, miniFont: state.miniFont,
        smallTheme: state.smallTheme, smallColorScheme: state.smallColorScheme, smallFont: state.smallFont,
        fullTheme: state.fullTheme, fullColorScheme: state.fullColorScheme, fullFont: state.fullFont
      }));
    } catch (e) {}
  }

  function persistViews() {
    try {
      localStorage.setItem(VIEWS_KEY, JSON.stringify({
        list: state.views, defaultId: state.defaultView
      }));
    } catch (e) {}
  }

  function isTab(name) {
    for (var i = 0; i < TABS.length; i++) {
      if (TABS[i].key === name) return true;
    }
    return false;
  }

  function setTab(name) {
    if (!isTab(name)) return;
    state.tab = name;
    state.selectionMode = false;
    state.selected = {};
    closeSearch();
    persist();
    if (global.LmsNav && global.LmsNav.markTab) global.LmsNav.markTab(name);
  }

  function restoreTab(name) {
    if (!isTab(name)) return;
    state.tab = name;
    state.selectionMode = false;
    state.selected = {};
    closeSearch();
    persist();
  }

  function toggleTheme() {
    var next = state.theme === 'light' ? 'dark' : (state.theme === 'dark' ? 'legacy' : 'light');
    setTheme(next);
  }

  function setTheme(key) {
    if (!isThemeOption(key)) return;
    state.theme = key;
    state.dark = key === 'dark';
    state.miniGaugeStyle = currentMiniGaugeStyle(key);
    state.playerGaugeStyle = currentPlayerGaugeStyle(key);
    applyAppearance();
    persist();
  }

  function setColorScheme(key) {
    if (!isColorScheme(key)) return;
    state.colorScheme = key;
    applyAppearance();
    persist();
  }

  function setFontFamily(key) {
    if (!isFontOption(key)) return;
    state.fontFamily = key;
    applyAppearance();
    persist();
  }

  /* Resolver used by every surface root binding (mini player, small/full now
     playing). Omits a key entirely when its value is 'app' -- Vue 2 removes an
     attribute bound to null, but never write the literal string "app": a CSS
     selector matching [data-surface-theme="app"] would otherwise exist and
     nothing defines it. Unknown surface -> {}, so a template can always
     v-bind the result unconditionally. */
  function surfaceAttrs(surface) {
    var map = SURFACE_KEYS[surface];
    if (!map) return {};
    var out = {};
    if (state[map.theme] !== 'app') out['data-surface-theme'] = state[map.theme];
    if (state[map.scheme] !== 'app') out['data-surface-scheme'] = state[map.scheme];
    if (state[map.font] !== 'app') out['data-surface-font'] = state[map.font];
    return out;
  }

  /* true only when none of the surface's three overrides diverge from the
     app -- drives the Player layout screen's "Match app appearance" toggle
     and setSurfaceFollowsApp's own ON/OFF branch below. Unknown
     surface -> false. */
  function surfaceFollowsApp(surface) {
    var map = SURFACE_KEYS[surface];
    if (!map) return false;
    return state[map.theme] === 'app' && state[map.scheme] === 'app' && state[map.font] === 'app';
  }

  function setSurfaceTheme(surface, key) {
    var map = SURFACE_KEYS[surface];
    if (!map || !isSurfaceTheme(key)) return;
    state[map.theme] = key;
    persist();
  }

  function setSurfaceScheme(surface, key) {
    var map = SURFACE_KEYS[surface];
    if (!map || !isSurfaceScheme(key)) return;
    state[map.scheme] = key;
    persist();
  }

  function setSurfaceFont(surface, key) {
    var map = SURFACE_KEYS[surface];
    if (!map || !isSurfaceFont(key)) return;
    state[map.font] = key;
    persist();
  }

  /* The Player layout screen's single "Match app appearance" toggle per
     surface (3.2.6c C6), replacing the nine "Follow app" option rows. ON
     writes 'app' to all three of that surface's keys -- the existing 3.2.5
     behaviour (uistate.test.js:436), kept exactly: there is no memory of a
     prior custom value anywhere, so turning it back OFF has nothing to
     restore. OFF therefore seeds the three keys from the app's own currently
     RESOLVED values (state.dark/colorScheme/fontFamily), never a hard-coded
     default -- otherwise flipping the toggle off would visibly repaint the
     player the instant it was flipped, even though nothing about the app
     changed. This makes OFF -> ON -> OFF idempotent without adding a
     persisted key: the seed is derived, not stored anywhere new. */
  function setSurfaceFollowsApp(surface, on) {
    var map = SURFACE_KEYS[surface];
    if (!map) return;
    if (on) {
      state[map.theme] = 'app';
      state[map.scheme] = 'app';
      state[map.font] = 'app';
    } else {
      state[map.theme] = state.theme;
      state[map.scheme] = state.colorScheme;
      state[map.font] = state.fontFamily;
    }
    persist();
  }

  function setGaugeStyle(target, key) {
    if ((target !== 'mini' && target !== 'player') || !isGaugeStyle(key)) return;
    state[target + 'GaugeStyle'] = key;
    state[gaugePrefix(state.theme) + (target === 'mini' ? 'Mini' : 'Player') + 'GaugeStyle'] = key;
    applyAppearance();
    persist();
  }

  function setGaugeColor(target, key) {
    if ((target !== 'mini' && target !== 'player') || !isGaugeColor(key)) return;
    state[target + 'GaugeColor'] = key;
    applyAppearance();
    persist();
  }

  function setPlayerPresentation(key) {
    if (!isPlayerPresentation(key)) return;
    state.playerPresentation = key;
    if (state.full) state.playerFullscreen = key === 'fullscreen';
    persist();
  }

  function setPlayerPosition(key) {
    if (!isPlayerPosition(key)) return;
    state.playerPosition = key;
    persist();
  }

  function cyclePlayerPosition() {
    var index = PLAYER_POSITIONS.findIndex(function (position) {
      return position.key === state.playerPosition;
    });
    setPlayerPosition(PLAYER_POSITIONS[(index + 1) % PLAYER_POSITIONS.length].key);
  }

  function openPlayer() {
    state.playerFullscreen = state.playerPresentation === 'fullscreen';
    state.full = true;
  }

  function closePlayer() {
    state.full = false;
    state.playerFullscreen = false;
    state.queueInline = false;
  }

  function togglePlayerFullscreen() {
    if (!state.full) return;
    state.playerFullscreen = !state.playerFullscreen;
  }

  /* Proximas inline nao e persistida de proposito: closePlayer() a fecha junto
     com o player, entao gravar so devolveria um estado que nao sobrevive. */
  function toggleQueueInline() {
    state.queueInline = !state.queueInline;
    return state.queueInline;
  }

  function viewLabel() {
    for (var i = 0; i < MUSIC_VIEWS.length; i++) {
      if (MUSIC_VIEWS[i].key === state.musicView) return MUSIC_VIEWS[i].label;
    }
    return '';
  }

  /* Grava o que esta na tela de volta na view que sai, e traz o da view que
     entra. Cada view lembra o proprio conjunto. */
  function stash() {
    byView[state.musicView] = sanitize(state.musicView, {
      filters: state.filters, sort: state.sort, group: state.group,
      sections: state.sections
    });
  }

  function adopt(view) {
    var entry = sanitize(view, viewEntry(view));
    byView[view] = entry;
    state.filters = entry.filters.slice();
    state.sort = entry.sort.map(function (s) { return { key: s.key, desc: s.desc }; });
    state.group = entry.group.slice();
    state.sections = entry.sections.slice();
  }

  function setMusicView(key) {
    for (var i = 0; i < MUSIC_VIEWS.length; i++) {
      if (MUSIC_VIEWS[i].key === key) {
        stash();
        state.musicView = key;
        adopt(key);
        state.picker = false; persist(); return;
      }
    }
  }

  function setFilters(list) {
    state.filters = sanitize(state.musicView, { filters: list }).filters;
    stash(); persist();
  }

  /* Ligar e desligar um valor. Numa faceta de valor unico -- ano -- o novo
     substitui o anterior; nas outras ele se soma, e e a soma que a fileira de
     pilulas mostra. */
  function toggleFilter(key) {
    var at = state.filters.indexOf(key);
    if (at >= 0) {
      setFilters(state.filters.filter(function (k, i) { return i !== at; }));
      return;
    }
    var facet = filterFacet(key);
    var kept = singleValueFacet(facet) ? state.filters.filter(function (k) {
      return filterFacet(k) !== facet;
    }) : state.filters;
    setFilters(kept.concat([key]));
  }

  function clearFilters() { setFilters([]); }

  function clearFacet(facet) {
    setFilters(state.filters.filter(function (key) { return filterFacet(key) !== facet; }));
  }

  function setSort(list) {
    var sort = (Array.isArray(list) ? list : []).filter(function (item) {
      return item && validSortKey(state.musicView, item.key);
    }).map(function (item) { return { key: item.key, desc: !!item.desc }; });
    if (!sort.length) return;
    state.sort = sort;
    stash(); persist();
  }

  function toggleSortDir() {
    if (!state.sort.length) return;
    state.sort[0].desc = !state.sort[0].desc;
    state.sort = state.sort.slice();
    stash(); persist();
  }

  function setGroup(list) {
    state.group = (Array.isArray(list) ? list : []).filter(function (key) {
      return validGroup(state.musicView, key);
    });
    stash(); persist();
  }

  function clearGroup() { setGroup([]); }

  function setSections(list) {
    state.sections = sanitize(state.musicView, { sections: list }).sections;
    stash(); persist();
  }

  function clearSections() { setSections([]); }

  function setPrefer(mode) {
    if (!validPrefer(mode)) return;
    state.prefer = mode;
    persist();
  }

  /* O painel trabalha em rascunho e entrega tudo de uma vez. Aplicar cada
     caixinha na hora recarregaria a biblioteca a cada clique -- sao segundos
     por vez, e o usuario ainda esta montando a pergunta. */
  function applyDraft(draft) {
    if (!plainObject(draft)) return;
    var view = state.musicView;
    var entry = sanitize(view, draft);
    state.filters = entry.filters.slice();
    state.sort = entry.sort.map(function (s) { return { key: s.key, desc: s.desc }; });
    state.group = entry.group.slice();
    state.sections = entry.sections.slice();
    if (validPrefer(draft.prefer)) state.prefer = draft.prefer;
    stash(); persist();
  }

  function currentDraft() {
    return {
      view: state.musicView,
      filters: state.filters.slice(),
      sort: state.sort.map(function (s) { return { key: s.key, desc: s.desc }; }),
      group: state.group.slice(),
      sections: state.sections.slice(),
      prefer: state.prefer
    };
  }

  /* Volta a raiz ao estado de quem nunca tocou em nada -- inclusive a ordem
     padrao daquela raiz, que em Recentes nao e alfabetica. */
  function resetView() {
    applyDraft(Object.assign(defaultsFor(state.musicView), { prefer: 'none' }));
  }

  function rememberGenres(list) {
    var names = {};
    (Array.isArray(list) ? list : []).forEach(function (genre) {
      if (genre && genre.id != null) names[String(genre.id)] = String(genre.name || '');
    });
    if (!Object.keys(names).length) return;
    state.genreNames = names;
    try { localStorage.setItem('echoclassic.genrenames.v1', JSON.stringify(names)); }
    catch (e) {}
  }

  function genreName(id) {
    return state.genreNames[String(id)] || '';
  }

  function viewId(name) {
    return String(name).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' +
      state.musicView + '-' + state.views.length;
  }

  function saveCurrentView(name) {
    var clean = sanitizeView(Object.assign(currentDraft(), {
      name: name, id: viewId(name || 'vista')
    }));
    if (!clean) return null;
    var at = -1;
    state.views.forEach(function (item, i) {
      if (item.name.toLowerCase() === clean.name.toLowerCase() && item.view === clean.view) at = i;
    });
    /* Salvar com um nome que ja existe naquela raiz atualiza a vista, em vez de
       criar uma segunda entrada com o mesmo rotulo -- duas linhas iguais na
       lista seriam impossiveis de distinguir. */
    if (at >= 0) {
      clean.id = state.views[at].id;
      state.views.splice(at, 1, clean);
    } else {
      state.views = state.views.concat([clean]);
    }
    persistViews();
    return clean;
  }

  function findView(id) {
    return state.views.filter(function (item) { return item.id === id; })[0] || null;
  }

  function applyView(id) {
    var found = findView(id);
    if (!found) return false;
    if (found.view !== state.musicView) setMusicView(found.view);
    applyDraft(found);
    return true;
  }

  function renameView(id, name) {
    var found = findView(id);
    var clean = String(name || '').replace(/^\s+|\s+$/g, '').slice(0, 60);
    if (!found || !clean) return false;
    found.name = clean;
    state.views = state.views.slice();
    persistViews();
    return true;
  }

  function duplicateView(id) {
    var found = findView(id);
    if (!found) return false;
    var copy = sanitizeView(Object.assign({}, found, {
      id: found.id + '-copia-' + state.views.length,
      name: (found.name + ' (copy)').slice(0, 60)
    }));
    if (!copy) return false;
    state.views = state.views.concat([copy]);
    persistViews();
    return true;
  }

  function deleteView(id) {
    var before = state.views.length;
    state.views = state.views.filter(function (item) { return item.id !== id; });
    if (state.defaultView === id) state.defaultView = '';
    if (state.views.length === before) return false;
    persistViews();
    return true;
  }

  function setDefaultView(id) {
    state.defaultView = findView(id) ? id : '';
    persistViews();
  }

  /* Guardado fora do estado observavel de proposito: e um no do DOM, e o Vue
     percorreria a arvore inteira tentando torna-lo reativo.

     Por que existe: no macOS, clicar num <button> nao lhe da foco -- e a
     convencao da plataforma, e o Chrome a segue. Entao document.activeElement
     no momento da abertura e o <body>, e devolver o foco "para quem abriu"
     devolvia para lugar none. Quem abre passa o proprio elemento. */
  var filterTriggerEl = null;

  function openFilterPanel(trigger) {
    filterTriggerEl = trigger && trigger.focus ? trigger : null;
    state.filterPanel = true;
  }
  function closeFilterPanel() { state.filterPanel = false; }
  function filterTrigger() { return filterTriggerEl; }

  /* Same handoff for the sort menu: it is anchored to the icon that opened it,
     so it needs both the element's rectangle to position against and the
     element itself to hand focus back to on close. */
  var sortTriggerEl = null;

  function openSortMenu(trigger) {
    sortTriggerEl = trigger && trigger.focus ? trigger : null;
    var rect = trigger && trigger.getBoundingClientRect ? trigger.getBoundingClientRect() : null;
    state.sortAnchor = rect ? {
      left: Number(rect.left) || 0, right: Number(rect.right) || 0,
      top: Number(rect.top) || 0, bottom: Number(rect.bottom) || 0
    } : null;
    state.sortMenu = true;
  }
  function closeSortMenu() { state.sortMenu = false; }
  function sortTrigger() { return sortTriggerEl; }

  var ALBUM_MODES = Object.freeze([
    Object.freeze({ key: 'albums', label: 'Albums' }),
    Object.freeze({ key: 'tracks', label: 'Tracks' })
  ]);

  function setAlbumMode(key) {
    for (var i = 0; i < ALBUM_MODES.length; i++) {
      if (ALBUM_MODES[i].key === key) { state.albumMode = key; persist(); return; }
    }
  }

  function setQueueArtMode(key) {
    if (!isQueueArtMode(key)) return;
    state.queueArtMode = key;
    persist();
  }

  /* Guardado aqui, e nao em LmsStore, porque e uma preferencia do cliente --
     sobrevive a troca de servidor e nao depende de sessao. LmsStore le este
     valor ao resolver qual player fica ativo; escreve-lo aqui nunca aciona
     essa resolucao sozinho -- so a proxima descoberta (recarregar, reconectar)
     honra a mudanca. */
  function setDefaultPlayer(id) {
    if (!isDefaultPlayer(id)) return;
    state.defaultPlayer = id;
    persist();
  }

  function setPreference(key, value) {
    if (key !== 'showBadges' && key !== 'markHires') return;
    state[key] = !!value;
    persist();
  }

	  var searchReturnFocus = null;
	  var searchReturnScroll = 0;

	  function currentScroller() {
	    return document.querySelector('.body .scroller');
	  }

	  function openSearch() {
	    var scroller = currentScroller();
	    searchReturnFocus = document.activeElement;
	    searchReturnScroll = scroller ? scroller.scrollTop : 0;
	    state.searching = true;
	  }

	  function closeSearch() {
	    if (!state.searching && !state.query) return;
	    state.searching = false;
	    state.query = '';
	    var focus = searchReturnFocus;
	    var scroll = searchReturnScroll;
	    setTimeout(function () {
	      var scroller = currentScroller();
	      if (scroller) scroller.scrollTop = scroll;
	      if (focus && focus.focus) focus.focus();
	    }, 0);
	  }


  function openActions(item, anchor) {
    var rect = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
    state.actionAnchor = rect ? {
      left: Number(rect.left) || 0, right: Number(rect.right) || 0,
      top: Number(rect.top) || 0, bottom: Number(rect.bottom) || 0,
      width: Number(rect.width) || 0, height: Number(rect.height) || 0
    } : null;
    state.actionItem = item || null;
  }
  function closeActions() {
    state.actionItem = null;
    state.actionAnchor = null;
  }

  function selectionKey(item) {
    return item ? String(item.kind || item.type || 'item') + ':' + String(item.id) : '';
  }

  function toggleSelection(item) {
    var key = selectionKey(item);
    if (!key) return;
    if (state.selected[key]) Vue.delete(state.selected, key);
    else Vue.set(state.selected, key, item);
  }

  function clearSelection() {
    state.selected = {};
    state.selectionMode = false;
  }

  function selectionControl(item) {
    if (!item) return null;
    var keys = {
      track: 'track_id', album: 'album_id', artist: 'artist_id',
      playlist: 'playlist_id', genre: 'genre_id', year: 'year_id'
    };
    var key = keys[item.kind || item.type];
    return key && item.id != null ? { key: key, id: item.id } : null;
  }

  async function queueSelection() {
    var values = Object.keys(state.selected).map(function (key) { return state.selected[key]; });
    if (!values.length) return false;
    var added = 0;
    for (var i = 0; i < values.length; i++) {
      var control = selectionControl(values[i]);
      if (!control) continue;
      if (await global.LmsStore.addToQueue(control.key, control.id) === false) return false;
      added++;
    }
    if (!added) return false;
    clearSelection();
    notify(added + (added === 1 ? ' item adicionado' : ' itens adicionados') +
      ' to the playback queue.', 'success', 3500);
    return true;
  }

  function isPinned(item) {
    var key = selectionKey(item);
    return state.pins.some(function (p) { return selectionKey(p) === key; });
  }

  function togglePin(item) {
    var key = selectionKey(item);
    if (!key) return;
    if (isPinned(item)) {
      state.pins = state.pins.filter(function (p) { return selectionKey(p) !== key; });
    } else {
      state.pins = [item].concat(state.pins).slice(0, 20);
    }
    try { localStorage.setItem('echoclassic.pins.v1', JSON.stringify(state.pins)); }
    catch (e) {}
  }

  function setBusy(message) { state.busyMessage = message || ''; }

  function notify(message, kind, duration) {
    if (noticeTimer) clearTimeout(noticeTimer);
    state.notice = String(message || '');
    state.noticeKind = kind === 'error' ? 'error' : 'info';
    if (!state.notice) return;
    noticeTimer = setTimeout(function () { state.notice = ''; }, duration || 4200);
  }

  function dismissNotice() {
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = null;
    state.notice = '';
  }

  /* Unico teclado global do skin. As camadas modais (folha de acoes, fila,
     player cheio) chamam stopPropagation/preventDefault no proprio Esc, entao
     o evento delas nunca chega aqui: isto so cobre as camadas que ninguem
     tratava — a busca e o seletor de raiz. */
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' && event.key !== 'Esc') return;
    if (event.defaultPrevented) return;
    if (state.picker) { state.picker = false; event.preventDefault(); return; }
    if (state.playerPicker) { state.playerPicker = false; event.preventDefault(); return; }
    if (state.advancedSettings) {
      if (!canLeaveAdvancedSettings()) { event.preventDefault(); return; }
      if (global.LmsNav && LmsNav.top && LmsNav.top('settings') && LmsNav.top('settings').advanced) {
        LmsNav.pop('settings');
      } else {
        state.advancedSettings = false;
      }
      event.preventDefault();
      return;
    }
    if (state.appearanceScreen) {
      if (global.LmsNav && LmsNav.top && LmsNav.top('settings') && LmsNav.top('settings').screen) {
        LmsNav.pop('settings');
      } else {
        state.appearanceScreen = null;
      }
      event.preventDefault();
      return;
    }
    if (state.searching) { closeSearch(); event.preventDefault(); }
  });

  function canLeaveAdvancedSettings() {
    if (!state.advancedSettingsDirty) return true;
    if (global.confirm && !global.confirm('Advanced LMS settings have unapplied changes. Leave without applying them?')) {
      return false;
    }
    state.advancedSettingsDirty = false;
    return true;
  }

  global.LmsUi = {
    state: state, TABS: TABS, MUSIC_VIEWS: MUSIC_VIEWS,
    THEME_OPTIONS: THEME_OPTIONS, setTheme: setTheme,
    COLOR_SCHEMES: COLOR_SCHEMES, setColorScheme: setColorScheme,
    FONT_OPTIONS: FONT_OPTIONS, setFontFamily: setFontFamily,
    surfaceAttrs: surfaceAttrs, surfaceFollowsApp: surfaceFollowsApp,
    setSurfaceTheme: setSurfaceTheme, setSurfaceScheme: setSurfaceScheme,
    setSurfaceFont: setSurfaceFont, setSurfaceFollowsApp: setSurfaceFollowsApp,
    canLeaveAdvancedSettings: canLeaveAdvancedSettings,
    applyAdvancedSettings: null,
    PLAYER_PRESENTATIONS: PLAYER_PRESENTATIONS,
    setPlayerPresentation: setPlayerPresentation,
    PLAYER_POSITIONS: PLAYER_POSITIONS,
    setPlayerPosition: setPlayerPosition, cyclePlayerPosition: cyclePlayerPosition,
    GAUGE_STYLES: GAUGE_STYLES, GAUGE_COLORS: GAUGE_COLORS,
    setGaugeStyle: setGaugeStyle, setGaugeColor: setGaugeColor,
    openPlayer: openPlayer, closePlayer: closePlayer,
    togglePlayerFullscreen: togglePlayerFullscreen,
    toggleQueueInline: toggleQueueInline,
    ALBUM_MODES: ALBUM_MODES, setAlbumMode: setAlbumMode,
    QUEUE_ART_MODES: QUEUE_ART_MODES, setQueueArtMode: setQueueArtMode,
    DEFAULT_PLAYER_LAST: DEFAULT_PLAYER_LAST, setDefaultPlayer: setDefaultPlayer,
    setPreference: setPreference,
    viewLabel: viewLabel, setMusicView: setMusicView,
    allowsMediaFilter: allowsMediaFilter,
    validFilter: validFilter, validSortKey: validSortKey, validGroup: validGroup,
    validSection: validSection, validPrefer: validPrefer,
    filterFacet: filterFacet, singleValueFacet: singleValueFacet,
    sortNeedsMedia: sortNeedsMedia, sectionNeedsMedia: sectionNeedsMedia,
    PREFER_MODES: PREFER_MODES,
    setFilters: setFilters, toggleFilter: toggleFilter, clearFilters: clearFilters,
    clearFacet: clearFacet,
    setGroup: setGroup, clearGroup: clearGroup, toggleSortDir: toggleSortDir,
    setSections: setSections, clearSections: clearSections, setPrefer: setPrefer,
    applyDraft: applyDraft, currentDraft: currentDraft, resetView: resetView,
    rememberGenres: rememberGenres, genreName: genreName,
    saveCurrentView: saveCurrentView, applyView: applyView, renameView: renameView,
    duplicateView: duplicateView, deleteView: deleteView, setDefaultView: setDefaultView,
    openFilterPanel: openFilterPanel, closeFilterPanel: closeFilterPanel,
    openSortMenu: openSortMenu, closeSortMenu: closeSortMenu, sortTrigger: sortTrigger,
    filterTrigger: filterTrigger,
    setTab: setTab, restoreTab: restoreTab, toggleTheme: toggleTheme,
    openSearch: openSearch, closeSearch: closeSearch,
    setSort: setSort, openActions: openActions, closeActions: closeActions,
    toggleSelection: toggleSelection, clearSelection: clearSelection,
    queueSelection: queueSelection,
    selectionKey: selectionKey, isPinned: isPinned, togglePin: togglePin,
    setBusy: setBusy, notify: notify, dismissNotice: dismissNotice
  };
})(window);
