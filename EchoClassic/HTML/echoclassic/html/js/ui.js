
/* View state: what the user is looking at. Everything that comes from the server
   lives in LmsStore instead. Components read this and call these actions; they do
   not reach into LmsStore.state. */
(function (global) {
  'use strict';

  var TABS = Object.freeze([
    Object.freeze({ key: 'favoritos', label: 'Favoritos' }),
    Object.freeze({ key: 'radio', label: 'Rádio' }),
    Object.freeze({ key: 'apps', label: 'Apps' }),
    Object.freeze({ key: 'playlists', label: 'Playlists' }),
    Object.freeze({ key: 'musica', label: 'Minha Música' }),
    Object.freeze({ key: 'ajustes', label: 'Ajustes' })
  ]);

  /* The four roots of Minha Musica, picked from the nav bar title like iOS 9. */
  var MUSIC_VIEWS = Object.freeze([
    Object.freeze({ key: 'recentes', label: 'Recentes' }),
    Object.freeze({ key: 'artistas', label: 'Artistas' }),
    Object.freeze({ key: 'albuns', label: 'Álbuns' }),
    Object.freeze({ key: 'generos', label: 'Gêneros' }),
    Object.freeze({ key: 'anos', label: 'Anos' })
  ]);

  var COLOR_SCHEMES = Object.freeze([
    Object.freeze({ key: 'blue', label: 'Azul Sistema' }),
    Object.freeze({ key: 'teal', label: 'Teal Atlântico' }),
    Object.freeze({ key: 'crimson', label: 'Carmim Editorial' }),
    Object.freeze({ key: 'indigo', label: 'Índigo Studio' }),
    Object.freeze({ key: 'amber', label: 'Âmbar Hi-Fi' })
  ]);

  var FONT_OPTIONS = Object.freeze([
    Object.freeze({ key: 'system', label: 'Sistema (padrão)' }),
    Object.freeze({ key: 'helvetica', label: 'Helvetica' }),
    Object.freeze({ key: 'chicago', label: 'Chicago' })
  ]);

  var PLAYER_PRESENTATIONS = Object.freeze([
    Object.freeze({ key: 'adaptive', label: 'Adaptável' }),
    Object.freeze({ key: 'fullscreen', label: 'Tela cheia' })
  ]);

  var PLAYER_POSITIONS = Object.freeze([
    Object.freeze({ key: 'right', label: 'Direita' }),
    Object.freeze({ key: 'left', label: 'Esquerda' }),
    Object.freeze({ key: 'center', label: 'Centro' })
  ]);

  var GAUGE_STYLES = Object.freeze([
    Object.freeze({ key: 'flat', label: 'Plano' }),
    Object.freeze({ key: 'classic', label: 'Clássico' })
  ]);

  var GAUGE_COLORS = Object.freeze([
    Object.freeze({ key: 'theme', label: 'Acompanhar tema' }),
    Object.freeze({ key: 'blue', label: 'Azul Sistema' }),
    Object.freeze({ key: 'teal', label: 'Teal Atlântico' }),
    Object.freeze({ key: 'crimson', label: 'Carmim Editorial' }),
    Object.freeze({ key: 'indigo', label: 'Índigo Studio' }),
    Object.freeze({ key: 'amber', label: 'Âmbar Hi-Fi' })
  ]);

  function isColorScheme(key) {
    return COLOR_SCHEMES.some(function (scheme) { return scheme.key === key; });
  }

  function isFontOption(key) {
    return FONT_OPTIONS.some(function (font) { return font.key === key; });
  }

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
    artistas: 'name', albuns: 'name', recentes: 'recent', generos: 'name', anos: 'year'
  };

  /* So Albuns e Recentes sabem aplicar filtro de midia: sao as duas views cujo
     carregamento passa por loadMediaIndex. Exportado porque o menu em browse.js
     precisa da mesma resposta para nao oferecer o que a view nao honra -- ate
     aqui essa regra estava escrita em tres lugares, e o de browse.js trocava a
     view do usuario por conta propria para fazer a escolha caber. */
  function allowsMediaFilter(view) {
    return view === 'albuns' || view === 'recentes';
  }

  var MEDIA_FILTER = /^(format|quality|origin|stream):[^:]+$/;

  function validFilter(view, key) {
    return allowsMediaFilter(view) && MEDIA_FILTER.test(key || '');
  }

  /* Ordenar e reordenar o que ja esta na tela. Nao exclui nada e nao muda a
     natureza das linhas. */
  function validSortKey(view, key) {
    if (view === 'albuns') return /^(name|artist|year)$/.test(key || '');
    if (view === 'recentes') return /^(recent|name|artist|year)$/.test(key || '');
    if (view === 'anos') return key === 'name' || key === 'year';
    return key === 'name';
  }

  /* Agrupar troca a natureza das linhas: a lista passa a mostrar artistas em vez
     de albuns. So Albuns faz isso, porque so ela passa por loadPagedRoot com
     indice de artistas. Recentes desenha album sempre -- oferecer "agrupar por
     artista" la era a promessa vazia do bug C. */
  function validGroup(view, key) {
    return view === 'albuns' && /^(artist|relatedArtist)$/.test(key || '');
  }

  function defaultsFor(view) {
    return {
      filters: [],
      sort: [{ key: DEFAULT_SORT_BY_VIEW[view] || 'name', desc: false }],
      group: []
    };
  }

  function sanitize(view, entry) {
    var out = defaultsFor(view);
    if (!plainObject(entry)) return out;
    if (Array.isArray(entry.filters)) {
      out.filters = entry.filters.filter(function (key) { return validFilter(view, key); });
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
    if (view === 'recentes' && !saved.recentSortMigrated && legacy === 'name') legacy = null;
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

  /* persist() ja gravava musicView; so o estado inicial ignorava, e a raiz
     escolhida se perdia a cada recarga. */
  var initialMusicView = isMusicView(saved.musicView) ? saved.musicView : 'recentes';

  var state = Vue.observable({
	    tab: isTab(saved.tab) ? saved.tab : 'musica',
    musicView: initialMusicView,
    albumMode: saved.albumMode || 'albuns',   // 'albuns' = grade de capas | 'faixas' = pilha completa
    dark: !!saved.dark,
    searching: false,
    query: '',
    full: false,
    playerPresentation: isPlayerPresentation(saved.playerPresentation) ? saved.playerPresentation : 'adaptive',
    playerPosition: isPlayerPosition(saved.playerPosition) ? saved.playerPosition : 'right',
    miniGaugeStyle: saved.dark ? darkMiniGaugeStyle : lightMiniGaugeStyle,
    playerGaugeStyle: saved.dark ? darkPlayerGaugeStyle : lightPlayerGaugeStyle,
    lightMiniGaugeStyle: lightMiniGaugeStyle,
    lightPlayerGaugeStyle: lightPlayerGaugeStyle,
    darkMiniGaugeStyle: darkMiniGaugeStyle,
    darkPlayerGaugeStyle: darkPlayerGaugeStyle,
    miniGaugeColor: isGaugeColor(saved.miniGaugeColor) ? saved.miniGaugeColor : 'theme',
    playerGaugeColor: isGaugeColor(saved.playerGaugeColor) ? saved.playerGaugeColor : 'theme',
    playerFullscreen: false,
    advancedSettings: false,
    queueOpen: false,
    queueInline: false,  // Proximas abre sob demanda, como na folha do iOS 9
    picker: false,
    playerPicker: false,
    actionItem: null,
    actionAnchor: null,
    infoItem: null,
    /* Espelho do byView[musicView]. Os tres sao independentes: filtrar exclui,
       ordenar reordena, agrupar troca a natureza da linha. */
    filters: viewEntry(initialMusicView).filters.slice(),
    sort: viewEntry(initialMusicView).sort.map(function (s) { return { key: s.key, desc: s.desc }; }),
    group: viewEntry(initialMusicView).group.slice(),
    filter: '',
    selectionMode: false,
    selected: {},
    pins: savedPins,
    colorScheme: isColorScheme(saved.colorScheme) ? saved.colorScheme : 'blue',
    fontFamily: isFontOption(saved.fontFamily) ? saved.fontFamily : 'system',
    showBadges: saved.showBadges !== false,
    markHires: saved.markHires !== false,
    busyMessage: '',
    notice: '',
    noticeKind: 'info'
  });

  var noticeTimer = null;

  function applyAppearance() {
    if (!document.body) return;
    document.body.classList.toggle('dark', state.dark);
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
        tab: state.tab, musicView: state.musicView, dark: state.dark,
        byView: byView,
        albumMode: state.albumMode, showBadges: state.showBadges,
        markHires: state.markHires, colorScheme: state.colorScheme,
        fontFamily: state.fontFamily, playerPresentation: state.playerPresentation,
        playerPosition: state.playerPosition,
        miniGaugeStyle: state.miniGaugeStyle, playerGaugeStyle: state.playerGaugeStyle,
        lightMiniGaugeStyle: state.lightMiniGaugeStyle,
        lightPlayerGaugeStyle: state.lightPlayerGaugeStyle,
        darkMiniGaugeStyle: state.darkMiniGaugeStyle,
        darkPlayerGaugeStyle: state.darkPlayerGaugeStyle,
        miniGaugeColor: state.miniGaugeColor, playerGaugeColor: state.playerGaugeColor
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
    state.dark = !state.dark;
    state.miniGaugeStyle = state.dark ? state.darkMiniGaugeStyle : state.lightMiniGaugeStyle;
    state.playerGaugeStyle = state.dark ? state.darkPlayerGaugeStyle : state.lightPlayerGaugeStyle;
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

  function setGaugeStyle(target, key) {
    if ((target !== 'mini' && target !== 'player') || !isGaugeStyle(key)) return;
    state[target + 'GaugeStyle'] = key;
    state[(state.dark ? 'dark' : 'light') + (target === 'mini' ? 'Mini' : 'Player') + 'GaugeStyle'] = key;
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
      filters: state.filters, sort: state.sort, group: state.group
    });
  }

  function adopt(view) {
    var entry = sanitize(view, viewEntry(view));
    byView[view] = entry;
    state.filters = entry.filters.slice();
    state.sort = entry.sort.map(function (s) { return { key: s.key, desc: s.desc }; });
    state.group = entry.group.slice();
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
    state.filters = (Array.isArray(list) ? list : []).filter(function (key) {
      return validFilter(state.musicView, key);
    });
    stash(); persist();
  }

  function toggleFilter(key) {
    var at = state.filters.indexOf(key);
    setFilters(at < 0 ? state.filters.concat([key]) : state.filters.filter(function (k, i) {
      return i !== at;
    }));
  }

  function clearFilters() { setFilters([]); }

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

  var ALBUM_MODES = Object.freeze([
    Object.freeze({ key: 'albuns', label: 'Álbuns' }),
    Object.freeze({ key: 'faixas', label: 'Faixas' })
  ]);

  function setAlbumMode(key) {
    for (var i = 0; i < ALBUM_MODES.length; i++) {
      if (ALBUM_MODES[i].key === key) { state.albumMode = key; persist(); return; }
    }
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
      ' à fila de reprodução.', 'success', 3500);
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
    if (state.searching) { closeSearch(); event.preventDefault(); }
  });

  global.LmsUi = {
    state: state, TABS: TABS, MUSIC_VIEWS: MUSIC_VIEWS,
    COLOR_SCHEMES: COLOR_SCHEMES, setColorScheme: setColorScheme,
    FONT_OPTIONS: FONT_OPTIONS, setFontFamily: setFontFamily,
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
    setPreference: setPreference,
    viewLabel: viewLabel, setMusicView: setMusicView,
    allowsMediaFilter: allowsMediaFilter,
    validFilter: validFilter, validSortKey: validSortKey, validGroup: validGroup,
    setFilters: setFilters, toggleFilter: toggleFilter, clearFilters: clearFilters,
    setGroup: setGroup, clearGroup: clearGroup, toggleSortDir: toggleSortDir,
    setTab: setTab, restoreTab: restoreTab, toggleTheme: toggleTheme,
    openSearch: openSearch, closeSearch: closeSearch,
    setSort: setSort, openActions: openActions, closeActions: closeActions,
    toggleSelection: toggleSelection, clearSelection: clearSelection,
    queueSelection: queueSelection,
    selectionKey: selectionKey, isPinned: isPinned, togglePin: togglePin,
    setBusy: setBusy, notify: notify, dismissNotice: dismissNotice
  };
})(window);
