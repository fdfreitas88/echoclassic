
/* The only owner of shared mutable state. Components read state and call
   actions; nobody else mutates. */
(function (global) {
  'use strict';

  var api = global.LmsApi;
  var POLL_PLAYING = 1000;
  var POLL_IDLE = 5000;
  var SESSION_KEY = 'echoclassic.session.v2';
  var HISTORY_KEY = 'echoclassic.history.v1';
  /* Teto da releitura da fila para transferir de player. Alto o bastante para
     nao alcancar uma fila real; existe para que uma contagem errada do servidor
     nao vire laco infinito. */
  var QUEUE_HANDOFF_MAX = 20000;

  var state = Vue.observable({
    players: [], playerId: null, connected: false, fixedVolume: false,
    volumeModeSynced: false, volumeModeBusy: false, volumeDragging: false,
    initialized: false, reconnecting: false, lastError: '', lastSuccess: 0,
    mode: 'stop', time: 0, duration: 0, volume: 0,
    queue: [], queueIndex: 0, queueTotal: 0, shuffle: 0, repeat: 0,
    /* queueUndo continua sendo array (a interface le .length); o dono fica numa
       propriedade separada para o desfazer nunca vazar de um player a outro. */
    queueUndo: [], queueUndoPlayerId: null,
    sleepRemaining: 0, transitionType: 0, transitionDuration: 0,
    history: [], trackInfo: null, canRate: false,
    npFavorite: false, npFavoriteIndex: null,
    np: {
      id: null, title: '', artist: '', album: '', coverId: null,
      sampleRate: 0, sampleSize: 0, format: '', live: false
    }
  });

  var timer = null;      // timeout pendente do polling
  var ticking = false;   // refresh do polling em voo
  var polling = false;   // o polling deveria estar rodando

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; }
    catch (e) { return fallback; }
  }

  function saveSession() {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        playerId: state.playerId, trackId: state.np.id, time: state.time
      }));
    } catch (e) {}
  }

  function uniqueHistory(items) {
    var seen = Object.create(null);
    return (Array.isArray(items) ? items : []).filter(function (item) {
      var key = item && item.id != null ? String(item.id) : '';
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    }).slice(0, 100);
  }

  function saveHistory() {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history)); }
    catch (e) {}
  }

  function rememberTrack() {
    if (!state.np.id) return;
    var previous = state.history[0];
    if (previous && previous.id === state.np.id) return;
    var current = {
      id: state.np.id, title: state.np.title, artist: state.np.artist,
      album: state.np.album, albumId: state.np.albumId, coverId: state.np.coverId,
      playedAt: Date.now()
    };
    state.history = [current].concat(state.history.filter(function (item) {
      return String(item.id) !== String(current.id);
    })).slice(0, 100);
    saveHistory();
  }

  /* A lista de players precisa ser revalidada de tempos em tempos: ligar um
     segundo player com a skin aberta nao o fazia aparecer, e desligar um
     deixava um fantasma clicavel na lista. Roda de carona no polling. */
  var PLAYERS_REVALIDATE_MS = 30000;
  var lastPlayersCheck = 0;

  async function refreshPlayers() {
    var playerId = state.playerId;
    lastPlayersCheck = Date.now();
    var ps = await api.players(playerId);
    if (playerId && state.connected &&
        !ps.some(function (p) { return p.id === playerId; })) {
      /* O player atual pode ter vindo do hint do servidor e nao constar em
         serverstatus; manter a entrada evita que ele suma dos Ajustes. */
      var kept = state.players.find(function (p) { return p.id === playerId; });
      if (kept) ps = [kept].concat(ps);
    }
    state.players = ps;
    return ps;
  }

  async function discoverPlayer() {
    var preferred = state.playerId;
    lastPlayersCheck = Date.now();
    var ps = await api.players(state.playerId);
    state.players = ps;
    var chosen = ps.find(function (p) { return p.id === state.playerId && p.connected; }) ||
                 ps.find(function (p) { return p.connected; }) || null;
    if (!chosen && preferred) {
      try {
        await api.status(preferred);
        chosen = { id: preferred, name: 'Player LMS', connected: true, power: true };
        state.players = [chosen].concat(ps.filter(function (p) { return p.id !== preferred; }));
      } catch (e) {
        /* O hint pode estar obsoleto; nesse caso a mensagem normal de descoberta prevalece. */
      }
    }
    state.playerId = chosen ? chosen.id : null;
    state.connected = !!chosen;
    if (!chosen) {
      state.lastError = ps.length
        ? 'No player is connected.'
        : 'No player was found on LMS.';
      return false;
    }
    state.lastError = '';
    return true;
  }

  async function loadVolumeMode(playerId) {
    var dvc = await api.playerPref(playerId, 'digitalVolumeControl');
    if (dvc == null) throw new Error('LMS did not confirm the volume mode.');
    if (state.playerId !== playerId) return false;
    state.fixedVolume = String(dvc) === '0';
    state.volumeModeSynced = true;
    return true;
  }

  async function loadPlayerSettings() {
    var playerId = state.playerId;
    try {
      await loadVolumeMode(playerId);
    } catch (e) {
      if (state.playerId === playerId) state.volumeModeSynced = false;
    }
    try {
      state.transitionType = Number(await api.playerPref(playerId, 'transitionType')) || 0;
      state.transitionDuration = Number(await api.playerPref(playerId, 'transitionDuration')) || 0;
      state.sleepRemaining = await api.sleepRemaining(playerId);
      state.canRate = await api.canCommand(['trackstat', 'setrating']);
    } catch (e) {}
  }

  async function init() {
    var saved = readJson(SESSION_KEY, {});
    state.history = uniqueHistory(readJson(HISTORY_KEY, []));
    saveHistory();
    if (!state.playerId && saved.playerId) state.playerId = saved.playerId;
    try {
      var found = await discoverPlayer();
    } catch (e) {
      state.connected = false;
      state.lastError = friendlyError(e, 'Could not find the server.');
      state.initialized = true;
      return;
    }
    if (!found) {
      state.initialized = true;
      return;
    }
    await loadPlayerSettings();
    state.initialized = true;
    installMediaSession();
  }

  async function refresh() {
    if (!state.playerId || !state.connected) {
      try {
        var found = await discoverPlayer();
        if (!found) {
          state.initialized = true;
          return;
        }
        await loadPlayerSettings();
      } catch (e) {
        state.connected = false;
        state.lastError = friendlyError(e, 'Could not find the server.');
        state.initialized = true;
        return;
      }
    }
    // amarra a resposta ao player que a pediu: trocar de player no meio do
    // await nao pode deixar o estado do player antigo sobrescrever o novo
    var playerId = state.playerId;
    var st;
    try {
      st = await api.status(playerId);
    } catch (e) {
      if (state.playerId !== playerId) return;
      // keep the last screen; only the connection indicator changes
      state.connected = false;
      state.lastError = friendlyError(e, 'The connection to the player was lost.');
      state.initialized = true;
      return;
    }
    if (state.playerId !== playerId) return;
    state.connected = true;
    state.lastError = '';
    state.lastSuccess = Date.now();
    state.initialized = true;
    state.mode = st.mode;
    state.time = st.time;
    state.duration = st.duration;
    if (!state.volumeDragging) state.volume = st.volume;
    var oldTrackId = state.np.id;
    state.np = {
      id: st.track.id, title: st.track.title, artist: st.track.artist,
      album: st.track.album, albumId: st.track.albumId, coverId: st.track.coverId, url: st.track.url,
      sampleRate: st.sampleRate, sampleSize: st.sampleSize,
      format: st.format, live: st.live
    };
    if (oldTrackId !== state.np.id) {
      state.trackInfo = null;
      rememberTrack();
      if (state.np.id != null) {
        api.songInfo(playerId, state.np.id).then(function (info) {
          if (state.playerId === playerId && String(state.np.id) === String(info.id)) {
            state.trackInfo = info;
            if (info.albumId != null) {
              state.np.albumId = info.albumId;
              var remembered = state.history.filter(function (item) {
                return String(item.id) === String(info.id);
              })[0];
              if (remembered) {
                remembered.albumId = info.albumId;
                saveHistory();
              }
            }
          }
        }).catch(function () {});
      }
    }
    saveSession();
    refreshFavorite(false);
    updateMediaSession();
    // revalidacao da lista de players pega carona no poll, sem segundo timer
    if (Date.now() - lastPlayersCheck >= PLAYERS_REVALIDATE_MS) {
      refreshPlayers().catch(function () {});
    }
  }

  /* O usuario nunca deve ler a string do protocolo. A tecnica fica no console e
     em error.message para diagnostico; aqui sai so texto em portugues. */
  function friendlyError(error, fallback) {
    if (!error) return fallback;
    if (error.kind && global.console && console.debug) {
      console.debug('LMS ' + error.kind + ':', error.message);
    }
    if (error.kind === 'timeout') return 'The server took too long to answer.';
    if (error.kind === 'network') return 'Could not reach the server.';
    if (error.kind === 'http') {
      var code = error.status || parseInt(String(error.detail || '').replace(/[^0-9]/g, ''), 10);
      return code
        ? 'The server answered with an error (HTTP ' + code + ').'
        : 'The server answered with an error.';
    }
    if (error.kind === 'lms') return 'The server rejected this command.';
    if (error.kind === 'parse') return 'The server response was incomplete or unreadable.';
    return (error.kind ? fallback : (error.message || fallback)) || fallback;
  }

  async function reconnect() {
    if (state.reconnecting) return;
    state.reconnecting = true;
    state.lastError = '';
    try {
      await init();
      await refresh();
      await loadQueue();
      if (state.connected) {
        global.LmsUi.notify('Connection restored.');
        startPolling();
      }
    } finally {
      state.reconnecting = false;
    }
  }

  var mediaSessionInstalled = false;

  function installMediaSession() {
    if (mediaSessionInstalled || !navigator.mediaSession) return;
    mediaSessionInstalled = true;
    var handlers = {
      play: function () { global.LmsStore.play(); },
      pause: function () { global.LmsStore.pause(); },
      stop: function () { global.LmsStore.stop(); },
      previoustrack: function () { global.LmsStore.prev(); },
      nexttrack: function () { global.LmsStore.next(); },
      seekbackward: function (details) {
        global.LmsStore.seek(state.time - (details.seekOffset || 10));
      },
      seekforward: function (details) {
        global.LmsStore.seek(state.time + (details.seekOffset || 10));
      },
      seekto: function (details) {
        if (details.seekTime != null) global.LmsStore.seek(details.seekTime);
      }
    };
    Object.keys(handlers).forEach(function (name) {
      try { navigator.mediaSession.setActionHandler(name, handlers[name]); }
      catch (e) {}
    });
  }

  function updateMediaSession() {
    if (!navigator.mediaSession) return;
    try {
      if (global.MediaMetadata) {
        var artwork = [];
        [96, 192, 512].forEach(function (size) {
          var src = global.LmsFmt.coverUrl(state.np.coverId, size);
          if (src) artwork.push({ src: src, sizes: size + 'x' + size, type: 'image/jpeg' });
        });
        navigator.mediaSession.metadata = new MediaMetadata({
          title: state.np.title || '', artist: state.np.artist || '',
          album: state.np.album || '', artwork: artwork
        });
      }
      navigator.mediaSession.playbackState = state.mode === 'play' ? 'playing' : 'paused';
      if (navigator.mediaSession.setPositionState && state.duration > 0 && !state.np.live) {
        navigator.mediaSession.setPositionState({
          duration: state.duration,
          position: Math.max(0, Math.min(state.time, state.duration)),
          playbackRate: 1
        });
      }
    } catch (e) {}
  }

  /* So consulta quando a faixa muda: o polling roda a cada segundo e perguntar
     "e favorito?" a cada volta seria desperdicio. */
  var lastFavUrl = null;

  async function refreshFavorite(force) {
    var url = state.np.url;
    if (!force && url === lastFavUrl) return;
    lastFavUrl = url;
    if (!url) { state.npFavorite = false; state.npFavoriteIndex = null; return; }
    try {
      var r = await api.favoriteExists(url);
      /* A resposta pode chegar depois de a faixa ter mudado. Sem esta guarda,
         npFavoriteIndex ficava com o indice do favorito da faixa ANTERIOR e o
         coracao apagava o favorito errado. actions.js:loadFavorite ja fazia
         exatamente esta conferencia. */
      if (state.np.url !== url) return;
      state.npFavorite = r.exists;
      state.npFavoriteIndex = r.index;
    } catch (e) {
      // falha transitoria nao pode ficar cacheada: zerar libera nova tentativa
      lastFavUrl = null;
      if (state.np.url !== url) return;
      state.npFavorite = false;
      state.npFavoriteIndex = null;
    }
  }

  async function toggleFavorite() {
    var url = state.np.url;
    if (!url) return;
    /* O indice so vale para a faixa que o produziu. Se o polling ainda nao
       reconsultou depois de uma troca de faixa, remover pelo indice apagaria
       outro favorito: nesse caso o certo e nao fazer nada e deixar a proxima
       consulta corrigir. */
    if (state.npFavorite && state.npFavoriteIndex !== null && url !== lastFavUrl) return;
    try {
      if (state.npFavorite && state.npFavoriteIndex !== null) {
        await api.favoriteRemove(state.npFavoriteIndex);
      } else {
        await api.favoriteAdd(url, state.np.title || url);
      }
    } catch (e) {
      // deixa o estado como esta; a proxima consulta corrige
    }
    await refreshFavorite(true);
  }

  function pollDelay() {
    return state.mode === 'play' ? POLL_PLAYING : POLL_IDLE;
  }

  function isPolling() { return polling; }

  /* Reagenda tambem no caminho de erro: antes, uma unica rejeicao de refresh()
     deixava o polling parado com timer nao-nulo, e startPolling se recusava a
     religar pelo resto da sessao. */
  function afterTick() {
    ticking = false;
    if (!polling) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(tick, pollDelay());
  }

  function tick() {
    timer = null;
    ticking = true;
    refresh().then(afterTick, afterTick);
  }

  function startPolling() {
    if (document.hidden) return;
    polling = true;
    if (ticking) return;                       // o ciclo em voo reagenda sozinho
    if (timer !== null) clearTimeout(timer);   // nunca dois timers em paralelo
    timer = setTimeout(tick, pollDelay());
  }

  function stopPolling() {
    polling = false;
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopPolling(); else startPolling();
  });

  /* A fila e a playlist do servidor. Antes isto era uma copia no cliente, e
     playFrom mandava `playlistcontrol cmd:load track_id:` de uma faixa so — a
     fila do LMS nunca passava de um item. Carregar o container e saltar para o
     indice e o que o proprio LMS faz. */
  /* Guarda o dono do desfazer junto com as entradas: a fila de uma sala nao
     pode ser injetada no player de outra depois de trocar de player. */
  function setQueueUndo(entries) {
    state.queueUndo = entries;
    state.queueUndoPlayerId = state.playerId;
  }

  function clearQueueUndo() {
    state.queueUndo = [];
    state.queueUndoPlayerId = null;
  }

  async function loadQueue() {
    var playerId = state.playerId;
    if (!playerId) return;
    try {
      var q = await api.queue(playerId, 0, 500);
      if (state.playerId !== playerId) return;  // resposta do player anterior
      state.queue = q.tracks;
      state.queueIndex = q.index;
      state.queueTotal = q.total;
      state.shuffle = q.shuffle;
      state.repeat = q.repeat;
    } catch (e) {
      // manter a ultima fila conhecida; o indicador de conexao ja avisa
    }
  }

  async function playContainer(key, id, index) {
    if (!state.playerId || !state.connected) {
      var found = await discoverPlayer();
      if (!found) throw new Error(state.lastError || 'No player is available.');
      await loadPlayerSettings();
    }
    var playerId = state.playerId;
    await api.loadContainer(playerId, key, id);
    if (state.playerId !== playerId) return;
    // a fila anterior deixou de existir: o desfazer guardado nao vale mais
    clearQueueUndo();
    if (index) await api.queueJump(playerId, index);
    if (state.playerId !== playerId) return;
    await refresh();
    await loadQueue();
  }

  async function jumpTo(index) {
    var playerId = state.playerId;
    if (!playerId) return;
    if (index < 0 || index >= state.queue.length) return;
    await api.queueJump(playerId, index);
    if (state.playerId !== playerId) return;
    await refresh();
    await loadQueue();
  }

  /* O desfazer so pode ser oferecido depois de a remocao ter dado certo. Antes,
     ele era gravado ANTES da chamada: se ela falhasse, guarded() engolia o erro,
     a faixa continuava na fila e "Undo" a inseria de novo - duplicando. */
  async function removeFromQueue(index) {
    if (!state.playerId) return;
    if (index < 0 || index >= state.queue.length) return;
    var item = state.queue.find(function (t) { return t.index === index; });
    await api.queueRemove(state.playerId, index);
    if (item) setQueueUndo([{ item: item, index: index }]);
    await loadQueue();
  }

  async function moveInQueue(from, to) {
    if (!state.playerId || from === to) return;
    await api.queueMove(state.playerId, from, to);
    await loadQueue();
  }

  async function queueItem(action, key, id) {
    if (!state.playerId || !state.connected) {
      var found = await discoverPlayer();
      if (!found) throw new Error(state.lastError || 'No player is available.');
      await loadPlayerSettings();
    }
    await api.queueControl(state.playerId, action, key, id);
    await loadQueue();
    return true;
  }

  function playNext(key, id) { return queueItem('insert', key, id); }
  function addToQueue(key, id) { return queueItem('add', key, id); }

  async function clearQueue() {
    if (!state.playerId) return;
    var snapshot = state.queue.map(function (item) {
      return { item: item, index: item.index };
    });
    await api.queueClear(state.playerId);
    setQueueUndo(snapshot);
    await refresh();
    await loadQueue();
  }

  /* Sao N chamadas sequenciais. Duas coisas tinham de mudar aqui:
     - o player e capturado uma vez. Lendo state.playerId a cada volta, trocar de
       player no meio do laco mandava as remocoes restantes para a fila do player
       NOVO, que o usuario nunca pediu para mexer. undoQueue ja fazia assim.
     - o desfazer passa a conter so o que foi realmente removido. Gravar a lista
       inteira antes do laco significava que uma falha na metade deixava um
       "Undo" que reinseria tudo, duplicando o que tinha sobrado. */
  async function clearUpcoming() {
    var playerId = state.playerId;
    if (!playerId) return;
    var removed = state.queue.filter(function (t) { return t.index > state.queueIndex; });
    var done = [];
    try {
      for (var i = removed.length - 1; i >= 0; i--) {
        if (state.playerId !== playerId) break;
        await api.queueRemove(playerId, removed[i].index);
        done.push({ item: removed[i], index: removed[i].index });
      }
    } finally {
      if (done.length) setQueueUndo(done);
      else clearQueueUndo();
    }
    await loadQueue();
  }

  async function undoQueue() {
    var playerId = state.playerId;
    if (!playerId || !state.queueUndo.length) return;
    // desfazer so vale no player que originou o desfazer
    if (state.queueUndoPlayerId !== playerId) { clearQueueUndo(); return; }
    var undo = state.queueUndo.slice().sort(function (a, b) { return a.index - b.index; });
    clearQueueUndo();
    for (var i = 0; i < undo.length; i++) {
      var entry = undo[i];
      if (entry.item.id == null) continue;
      if (state.playerId !== playerId) return;
      await api.queueControl(playerId, 'add', 'track_id', entry.item.id);
      var end = state.queueTotal + i;
      if (entry.index < end) await api.queueMove(playerId, end, entry.index);
    }
    await loadQueue();
  }

  async function cycleShuffle() {
    if (!state.playerId) return;
    await api.setShuffle(state.playerId, (state.shuffle + 1) % 3);
    await loadQueue();
  }

  async function cycleRepeat() {
    if (!state.playerId) return;
    await api.setRepeat(state.playerId, (state.repeat + 1) % 3);
    await loadQueue();
  }

  async function selectPlayer(playerId) {
    var found = state.players.find(function (p) { return p.id === playerId; });
    if (!found) return;
    // o desfazer pertence ao player anterior; segui-lo injetaria a fila errada
    if (playerId !== state.playerId) clearQueueUndo();
    state.playerId = playerId;
    state.connected = !!found.connected;
    state.volumeModeSynced = false;
    saveSession();
    await loadPlayerSettings();
    await refresh();
    await loadQueue();
  }

  /* state.queue e so a janela carregada (500). Transferir a partir dela
     descartava em silencio tudo a partir da faixa 501. Aqui a fila e relida
     inteira do servidor antes da transferencia; se ainda assim nao vier tudo, o
     usuario e avisado em vez de perder faixas sem saber. */
  function notifyTruncated(got, total) {
    if (global.LmsUi && global.LmsUi.notify) {
      global.LmsUi.notify('The queue has ' + total + ' tracks and only this many could be read: ' +
        got + '. The transfer takes the first ' + got + '.', 'error', 7000);
    }
  }

  async function fullQueue() {
    var origin = state.playerId;
    var loaded = state.queue.slice();
    var total = state.queueTotal || loaded.length;
    var page = 500;
    while (loaded.length < total && loaded.length < QUEUE_HANDOFF_MAX) {
      var q = await api.queue(origin, loaded.length, page);
      if (state.playerId !== origin) break;
      if (!q.tracks || !q.tracks.length) break;
      loaded = loaded.concat(q.tracks);
      total = q.total || total;
    }
    return { tracks: loaded, total: total };
  }

  async function handoffTo(playerId) {
    if (!playerId || playerId === state.playerId) return;
    var full = await fullQueue();
    if (full.tracks.length < full.total) {
      notifyTruncated(full.tracks.length, full.total);
    }
    var tracks = full.tracks.slice();
    var index = state.queueIndex;
    var position = state.time;
    var wasPlaying = state.mode === 'play';
    clearQueueUndo();
    await api.queueClear(playerId);
    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i].id != null) await api.queueControl(playerId, 'add', 'track_id', tracks[i].id);
    }
    if (tracks.length) await api.queueJump(playerId, Math.min(index, tracks.length - 1));
    if (position > 0) await api.seek(playerId, position);
    await api.transport(playerId, wasPlaying ? 'play' : 'pause');
    await selectPlayer(playerId);
  }

  function syncWith(playerId) {
    if (!state.playerId) return Promise.resolve();
    return api.syncPlayer(state.playerId, playerId);
  }

  async function setTransition(type, duration) {
    if (!state.playerId) return;
    await api.setPlayerPref(state.playerId, 'transitionType', type | 0);
    await api.setPlayerPref(state.playerId, 'transitionDuration', Math.max(0, duration | 0));
    state.transitionType = type | 0;
    state.transitionDuration = Math.max(0, duration | 0);
  }

  async function setSleep(seconds) {
    if (!state.playerId) return;
    await api.sleep(state.playerId, seconds);
    state.sleepRemaining = Math.max(0, seconds | 0);
  }

  function sleepAfterTrack() {
    return setSleep(Math.max(1, Math.ceil(state.duration - state.time)));
  }

  function sleepAfterQueue() {
    // queueRemaining ja desconta o tempo decorrido; descontar de novo dormiria cedo
    return setSleep(Math.max(1, Math.ceil(queueRemaining())));
  }

  async function setRating(stars) {
    if (!state.canRate || state.np.id == null) return;
    await api.setRating(state.playerId, state.np.id, stars);
    api.forgetSongInfo();
    state.trackInfo = await api.songInfo(state.playerId, state.np.id);
  }

  /* Transporte. Apagadas por engano ao reescrever a fila; o export continuava
     citando-as, o que derrubava o modulo inteiro com "play is not defined". */
  async function transport(cmd) {
    if (!state.playerId) return;
    await api.transport(state.playerId, cmd);
    await refresh();
  }

  function play()  { return transport('play'); }
  function pause() { return transport('pause'); }
  function stop()  { return transport('stop'); }
  function next()  { return transport('next'); }
  function prev()  { return transport('prev'); }

  async function seek(seconds) {
    if (!state.playerId || state.np.live || !state.duration) return;
    var value = Math.max(0, Math.min(state.duration, Math.round(Number(seconds) || 0)));
    state.time = value;
    await api.seek(state.playerId, value);
    await refresh();
  }

  async function setVolume(volume) {
    if (!state.playerId || state.fixedVolume) return;
    var value = Math.max(0, Math.min(100, Math.round(Number(volume) || 0)));
    await api.setVolume(state.playerId, value);
    await refresh();
    return true;
  }

  function setVolumeDragging(dragging) {
    state.volumeDragging = !!dragging;
  }

  async function setFixedVolume(fixed) {
    if (state.volumeModeBusy) return false;
    if (!state.playerId || !state.connected) {
      var found = await discoverPlayer();
      if (!found) throw new Error(state.lastError || 'No player is available.');
      await loadPlayerSettings();
    }
    var playerId = state.playerId;
    var requestedFixed = !!fixed;
    state.volumeModeBusy = true;
    try {
      if (requestedFixed) await api.setVolume(playerId, 100);
      await api.setPlayerPref(playerId, 'digitalVolumeControl', requestedFixed ? '0' : '1');
      var confirmed = await api.playerPref(playerId, 'digitalVolumeControl');
      if (confirmed == null) throw new Error('LMS did not confirm the volume mode.');
      if (state.playerId !== playerId) return false;

      state.fixedVolume = String(confirmed) === '0';
      state.volumeModeSynced = true;
      if (!requestedFixed) {
        var status = await api.status(playerId);
        if (state.playerId === playerId && !state.volumeDragging) state.volume = status.volume;
      } else if (state.fixedVolume) {
        state.volume = 100;
      }

      if (state.fixedVolume !== requestedFixed) {
        /* Frase inteira no dicionario: concatenar o final produzia um texto
           que nonea chave casa, e o aviso saia em portugues numa sessao em
           ingles -- a mesma armadilha dos avisos de truncamento. */
        global.LmsUi.notify(state.fixedVolume
          ? 'LMS kept fixed output.'
          : 'LMS kept software volume.', 'error', 6500);
        return false;
      }
      global.LmsUi.notify(requestedFixed
        ? 'Fixed output confirmed. Set the volume on the DAC.'
        : 'LMS volume control confirmed.', 'success', 4500);
      return true;
    } catch (e) {
      if (state.playerId === playerId) state.volumeModeSynced = false;
      throw e;
    } finally {
      state.volumeModeBusy = false;
    }
  }

  /* Fatia por t.index, nao por posicao no array: a janela carregada pode nao
     comecar no zero. Desconta o que ja tocou da faixa corrente, senao o
     cabecalho from the queue anuncia mais tempo do que resta de fato. */
  function queueRemaining() {
    var current = state.queueIndex;
    var elapsed = state.time || 0;
    return state.queue.reduce(function (a, t) {
      if (t.index < current) return a;
      var seconds = t.duration || 0;
      if (t.index === current) seconds = Math.max(0, seconds - elapsed);
      return a + seconds;
    }, 0);
  }

  function guarded(label, action, showBusy) {
    return async function () {
      if (showBusy) global.LmsUi.setBusy(label);
      try {
        return await action.apply(null, arguments);
      } catch (e) {
        if (e && (e.kind === 'network' || e.kind === 'timeout')) {
          state.connected = false;
          state.lastError = friendlyError(e, 'The operation did not complete.');
        }
        /* Montada por concatenacao, entao o envelope do notify nunca casaria a
           frase inteira no dicionario: cada pedaco passa pelo t() sozinho.
           "failed." tambem foi escolhido por concordar com qualquer sujeito --
           "nao foi concluido" obrigaria a saber o genero do rotulo. */
        var tr = (global.LmsStr && global.LmsStr.t) || function (s) { return s; };
        global.LmsUi.notify(tr(label) + ' ' + tr('failed.') + ' ' + friendlyError(e, ''),
          'error', 6500);
        return false;
      } finally {
        if (showBusy) global.LmsUi.setBusy('');
      }
    };
  }

  global.LmsStore = {
    state: state, init: init, refresh: refresh, reconnect: reconnect,
    startPolling: startPolling, stopPolling: stopPolling,
    pollDelay: pollDelay, isPolling: isPolling,
    POLL_PLAYING: POLL_PLAYING, POLL_IDLE: POLL_IDLE,
    loadQueue: loadQueue,
    playContainer: guarded('Playback', playContainer, true),
    jumpTo: guarded('Changing track', jumpTo, false),
    removeFromQueue: guarded('Removing from the queue', removeFromQueue, false),
    moveInQueue: guarded('Reordering the queue', moveInQueue, false),
    playNext: guarded('Adding to the queue', playNext, false),
    addToQueue: guarded('Adding to the queue', addToQueue, false),
    clearQueue: guarded('Clearing the queue', clearQueue, true),
    clearUpcoming: guarded('Clearing the upcoming tracks', clearUpcoming, true),
    undoQueue: guarded('Restoring the queue', undoQueue, true),
    queueRemaining: queueRemaining,
    cycleShuffle: guarded('Changing shuffle', cycleShuffle, false),
    cycleRepeat: guarded('Changing repeat', cycleRepeat, false),
    selectPlayer: guarded('Changing player', selectPlayer, true),
    handoffTo: guarded('Transferring playback', handoffTo, true),
    syncWith: guarded('Player synchronisation', syncWith, true),
    setTransition: guarded('The crossfade setting', setTransition, false),
    setSleep: guarded('The sleep timer setting', setSleep, false),
    sleepAfterTrack: guarded('The sleep timer setting', sleepAfterTrack, false),
    sleepAfterQueue: guarded('The sleep timer setting', sleepAfterQueue, false),
    setRating: guarded('The rating', setRating, false),
    play: guarded('Playback', play, false),
    pause: guarded('Pausing', pause, false),
    stop: guarded('Stopping', stop, false),
    next: guarded('The next track', next, false),
    prev: guarded('The previous track', prev, false),
    seek: guarded('Seeking', seek, false),
    setVolume: guarded('The volume change', setVolume, false),
    setVolumeDragging: setVolumeDragging,
    setFixedVolume: guarded('Changing the volume mode', setFixedVolume, false),
    toggleFavorite: guarded('Changing favourites', toggleFavorite, false),
    refreshFavorite: refreshFavorite,
    // publicos para os Ajustes forcarem revalidacao e para outros componentes
    // traduzirem erros sem repetir a string tecnica do protocolo
    refreshPlayers: refreshPlayers, friendlyError: friendlyError
  };
})(window);