
/* The only owner of shared mutable state. Components read state and call
   actions; nobody else mutates. */
(function (global) {
  'use strict';

  var api = global.LmsApi;
  var POLL_PLAYING = 1000;
  var POLL_IDLE = 5000;
  var SESSION_KEY = 'echoclassic.session.v2';
  var HISTORY_KEY = 'echoclassic.history.v1';
  var EQ_RULES_KEY = 'echoclassic.equalizer-rules.v1';
  /* Teto da releitura da fila para transferir de player. Alto o bastante para
     nao alcancar uma fila real; existe para que uma contagem errada do servidor
     nao vire laco infinito. */
  var QUEUE_HANDOFF_MAX = 20000;

  var state = Vue.observable({
    players: [], playerId: null, connected: false, fixedVolume: false,
    useVolumeControl: null, volumeControllable: true,
    /* Ha destino para um comando de transporte. Nao e o mesmo que `connected`:
       o aviso de conexao pode estar na tela com a faixa anterior ainda em
       cache, e nesse estado tocar Play nao alcanca ninguem. Quem decide e o
       store, num lugar so -- o componente le, nao reconstroi a regra. */
    commandable: false,
    syncGroup: null, syncBusy: false,
    volumeModeSynced: false, volumeModeBusy: false, volumeDragging: false,
    initialized: false, reconnecting: false, lastError: '', lastSuccess: 0,
    auxiliaryErrors: { queue:'', playerSettings:'', sync:'', trackInfo:'', playbackIntelligence:'' },
    mode: 'stop', time: 0, duration: 0, volume: 0,
    queue: [], queueIndex: 0, queueTotal: 0, shuffle: 0, repeat: 0,
    /* queueUndo continua sendo array (a interface le .length); o dono fica numa
       propriedade separada para o desfazer nunca vazar de um player a outro. */
    queueUndo: [], queueUndoPlayerId: null,
    sleepRemaining: 0, transitionType: 0, transitionDuration: 0,
    /* Ganho de reproducao do LMS, por player: 0 desligado, 1 faixa, 2 album,
       3 inteligente. Guardado como numero cru porque a interface oferece
       exatamente esses quatro valores fixos -- nao ha estado derivado aqui. */
    replayGainMode: 0, replayGainApplied: null,
    equalizer: {
      playerId: null, status: 'idle', clientName: '', revision: '',
      settings: null, presets: [], impulses: [], error: '', rules: [],
      activeRule: null, applyingRule: false, context: null
    },
    history: [], trackInfo: null, canRate: false,
    /* Mapa de capacidades, resolvido uma vez no init(): quem precisa saber se
       um comando existe no servidor le daqui em vez de escrever a propria
       sonda `can`. Ausencia significa "nao mostrar", nunca "mostrar
       desabilitado" -- por isso comeca vazio, e nao com chaves em false. */
    capabilities: {},
    randomPlay: { active: '', busy: false },
    dontStopMusic: { provider: '0', providers: [], busy: false },
    npFavorite: false, npFavoriteIndex: null,
    np: {
      id: null, title: '', artist: '', album: '', coverId: null,
      sampleRate: 0, sampleSize: 0, format: '', bitrate: 0, live: false,
      sourceStream: null, activeStream: null, isTranscoded: false
    }
  });

  var timer = null;      // timeout pendente do polling
  var ticking = false;   // refresh do polling em voo
  var polling = false;   // o polling deveria estar rodando

  /* A preferencia do usuario e o player ativo sao coisas diferentes desde que
     um so refresh, tomado com o player preferido dormindo ou desligado, podia
     apagar essa preferencia: discoverPlayer() escrevia o substituto de volta
     em state.playerId, e o proximo saveSession() persistia o substituto. Esta
     variavel guarda so a escolha explicita -- selectPlayer() e a volta de
     handoffTo() -- e nunca e tocada por um fallback automatico. */
  var preferredPlayerId = null;
  var equalizerCache = Object.create(null);
  var equalizerManual = Object.create(null);
  var equalizerAppliedRule = Object.create(null);
  /* SqueezeDSP rewrites the complete player document. Keep one write lane per
     player so a fast track change cannot let an older request finish after the
     newer rule. The sequence also lets queued, now-obsolete work exit before
     it touches the server. */
  var equalizerApplyQueue = Object.create(null);
  var equalizerApplySequence = Object.create(null);

  function backgroundError(area, error) {
    var message = friendlyError(error, area + ' could not be refreshed.');
    if (state.auxiliaryErrors && Object.prototype.hasOwnProperty.call(state.auxiliaryErrors, area)) {
      state.auxiliaryErrors[area] = message;
    }
    if (global.console && console.debug) console.debug('[Echo Classic] ' + area + ': ' + message);
    return message;
  }

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; }
    catch (e) { return fallback; }
  }

  function saveSession() {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        playerId: preferredPlayerId, trackId: state.np.id, time: state.time
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

  function cloneJson(value) { return JSON.parse(JSON.stringify(value)); }

  function loadEqualizerRules() {
    var rules = readJson(EQ_RULES_KEY, []);
    state.equalizer.rules = (Array.isArray(rules) ? rules : []).filter(function (rule) {
      return rule && rule.playerId && /^(song|album|artist|genre|folder|year)$/.test(rule.type) &&
        rule.key != null && rule.settings && rule.settings.Client;
    }).slice(0, 500);
  }

  function saveEqualizerRules() {
    try { localStorage.setItem(EQ_RULES_KEY, JSON.stringify(state.equalizer.rules)); }
    catch (e) {}
  }

  function equalizerFolder(url) {
    var value = String(url || '').replace(/[?#].*$/, '');
    if (!/^(?:file:|[a-z]:|\/)/i.test(value)) return '';
    value = value.replace(/\\/g, '/').replace(/\/+$/, '');
    return value.slice(0, value.lastIndexOf('/'));
  }

  function playbackEqualizerContext() {
    var info = state.trackInfo || {};
    return {
      song: state.np.id != null ? String(state.np.id) : '',
      album: info.albumId != null ? String(info.albumId) :
        (state.np.albumId != null ? String(state.np.albumId) : ''),
      artist: String(info.artist || state.np.artist || '').trim().toLocaleLowerCase(),
      genre: String(info.genre || '').trim().toLocaleLowerCase(),
      folder: equalizerFolder(info.url || state.np.url),
      year: String(info.originalYear || info.year || '')
    };
  }

  function equalizerContext() {
    var current = playbackEqualizerContext();
    var chosen = state.equalizer.context || {};
    return {
      song: chosen.songKey || current.song,
      album: chosen.albumKey || current.album,
      artist: String(chosen.artist || current.artist).trim().toLocaleLowerCase(),
      genre: String(chosen.genre || current.genre).trim().toLocaleLowerCase(),
      folder: chosen.folder || current.folder,
      year: String(chosen.year || current.year)
    };
  }

  function equalizerRuleForCurrent() {
    var context = playbackEqualizerContext();
    var priority = ['song', 'album', 'folder', 'artist', 'genre', 'year'];
    for (var i = 0; i < priority.length; i++) {
      var type = priority[i];
      if (!context[type]) continue;
      var found = state.equalizer.rules.filter(function (rule) {
        return rule.playerId === state.playerId && rule.type === type && rule.key === context[type];
      })[0];
      if (found) return found;
    }
    return null;
  }

  async function applyEqualizerRule() {
    var playerId = state.playerId;
    if (!playerId || state.equalizer.status !== 'ready' || !state.trackInfo) return;
    var request = (equalizerApplySequence[playerId] || 0) + 1;
    equalizerApplySequence[playerId] = request;
    var previous = equalizerApplyQueue[playerId] || Promise.resolve();
    var task = previous.catch(function () {}).then(async function () {
      if (equalizerApplySequence[playerId] !== request || state.playerId !== playerId) return;
      var rule = equalizerRuleForCurrent();
      var ruleId = rule ? rule.id : '';
      if (equalizerAppliedRule[playerId] === ruleId) {
        state.equalizer.activeRule = rule;
        return;
      }
      var settings = rule ? rule.settings : equalizerManual[playerId];
      if (!settings) {
        equalizerAppliedRule[playerId] = ruleId;
        state.equalizer.activeRule = rule;
        return;
      }
      state.equalizer.applyingRule = true;
      try {
        await api.squeezeDspSave(playerId, cloneJson(settings));
        if (state.playerId !== playerId) return;
        equalizerAppliedRule[playerId] = ruleId;
        state.equalizer.activeRule = rule;
        equalizerCache[playerId] = null;
        if (equalizerApplySequence[playerId] === request) await loadEqualizer(true);
      } catch (e) {
        if (state.playerId === playerId) {
          state.equalizer.error = friendlyError(e, 'Could not apply the equalizer rule.');
          if (global.LmsUi && global.LmsUi.notify) {
            global.LmsUi.notify(state.equalizer.error, 'error', 6500);
          }
        }
      } finally {
        if (state.playerId === playerId && equalizerApplySequence[playerId] === request) {
          state.equalizer.applyingRule = false;
        }
      }
    });
    equalizerApplyQueue[playerId] = task;
    return task;
  }

  function equalizerRuleDescriptor(type) {
    var context = equalizerContext();
    var info = state.trackInfo || {};
    var chosen = state.equalizer.context || {};
    var labels = {
      song: chosen.songTitle || state.np.title,
      album: chosen.albumTitle || info.album || state.np.album,
      artist: chosen.artistLabel || chosen.artist || info.artist || state.np.artist,
      genre: chosen.genreLabel || chosen.genre || info.genre,
      folder: context.folder, year: context.year
    };
    return { key: context[type] || '', label: String(labels[type] || '') };
  }

  async function toggleEqualizerRule(type, settings) {
    if (!/^(song|album|artist|genre|folder|year)$/.test(type) || !state.playerId) return;
    var descriptor = equalizerRuleDescriptor(type);
    if (!descriptor.key) throw new Error('This track has no ' + type + ' information.');
    var playerId = state.playerId;
    var index = state.equalizer.rules.findIndex(function (rule) {
      return rule.playerId === playerId && rule.type === type && rule.key === descriptor.key;
    });
    if (index >= 0) state.equalizer.rules.splice(index, 1);
    else state.equalizer.rules.push({
      id: playerId + ':' + type + ':' + descriptor.key,
      playerId: playerId, type: type, key: descriptor.key, label: descriptor.label,
      settings: cloneJson(settings || state.equalizer.settings), createdAt: Date.now()
    });
    saveEqualizerRules();
    var playback = playbackEqualizerContext();
    if (playback[type] === descriptor.key) {
      equalizerAppliedRule[playerId] = null;
      await applyEqualizerRule();
    }
  }

  async function removeEqualizerRule(ruleId) {
    var playerId = state.playerId;
    var index = state.equalizer.rules.findIndex(function (rule) {
      return rule.id === ruleId && rule.playerId === playerId;
    });
    if (index < 0) return;
    var removed = state.equalizer.rules[index];
    state.equalizer.rules.splice(index, 1);
    saveEqualizerRules();
    if (state.equalizer.activeRule && state.equalizer.activeRule.id === removed.id) {
      equalizerAppliedRule[playerId] = null;
      await applyEqualizerRule();
    }
  }

  function setEqualizerContext(context) {
    state.equalizer.context = context ? cloneJson(context) : null;
  }

  function rememberTrack() {
    if (!state.np.id) return;
    var previous = state.history[0];
    if (previous && previous.id === state.np.id) return;
    var current = {
      id: state.np.id, title: state.np.title, artist: state.np.artist,
      album: state.np.album, albumId: state.np.albumId, trackNum: state.np.trackNum,
      coverId: state.np.coverId,
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
    await refreshSyncGroup().then(function () { state.auxiliaryErrors.sync = ''; }, function (e) {
      backgroundError('sync', e);
    });
    return ps;
  }

  async function refreshSyncGroup() {
    var playerId = state.playerId;
    if (!playerId || !api.syncGroups) { state.syncGroup = null; return null; }
    var groups = await api.syncGroups();
    if (state.playerId !== playerId) return null;
    var group = groups.filter(function (candidate) {
      return candidate.members.some(function (member) { return member.id === playerId; });
    })[0];
    if (!group) { state.syncGroup = null; return null; }
    var members = await Promise.all(group.members.map(async function (member) {
      var player = state.players.filter(function (p) { return p.id === member.id; })[0] || {};
      var values = await Promise.all([
        api.playerVolume(member.id).catch(function () { return null; }),
        api.playerPref(member.id, 'digitalVolumeControl').catch(function () { return null; })
      ]);
      return {
        id: member.id, name: member.name, connected: player.connected !== false,
        power: player.power !== false, volume: values[0],
        fixed: values[1] != null && values[1] !== '' && Number(values[1]) === 0,
        master: member.id === group.masterId
      };
    }));
    if (state.playerId !== playerId) return null;
    state.syncGroup = { id: group.id, masterId: group.masterId, members: members };
    return state.syncGroup;
  }

  /* Preferencia configurada em Ajustes ("Default player"). null quando o
     sentinela 'last' esta em vigor -- o comportamento de sempre, seguir a
     ultima selecao explicita. LmsUi pode nao ter carregado ainda em algum
     arreio de teste; a ausencia conta como "sem preferencia configurada",
     nunca lanca. */
  function configuredPlayerId() {
    var ui = global.LmsUi;
    var value = ui && ui.state ? ui.state.defaultPlayer : null;
    return value && value !== 'last' ? value : null;
  }

  /* O hint pode ter saido do serverstatus (um player fora do ar nao aparece
     la), mas ainda responder sondado direto -- e assim que um player
     preferido, so dormindo ou desligado, volta a ser reconhecido sem que o
     usuario precise escolher de novo. */
  async function resurrectHint(id, ps) {
    if (!id) return null;
    try {
      await api.status(id);
      var chosen = { id: id, name: 'Player LMS', connected: true, power: true };
      state.players = [chosen].concat(ps.filter(function (p) { return p.id !== id; }));
      return chosen;
    } catch (e) {
      /* O hint pode estar obsoleto; nesse caso a mensagem normal de descoberta prevalece. */
      return null;
    }
  }

  async function discoverPlayer() {
    lastPlayersCheck = Date.now();
    var configured = configuredPlayerId();
    var hint = configured || preferredPlayerId || state.playerId;
    var ps = await api.players(hint);
    state.players = ps;

    function connectedMatch(id) {
      return id ? ps.find(function (p) { return p.id === id && p.connected; }) || null : null;
    }

    // 1) preferencia configurada nos Ajustes; 2) ultimo player usado nesta
    // sessao; 3) qualquer um conectado. Um fallback tomado aqui NUNCA escreve
    // de volta em configured ou preferredPlayerId -- so em state.playerId,
    // que e o player ativo, nao a preferencia guardada.
    var chosen = connectedMatch(configured) || connectedMatch(preferredPlayerId) ||
                 ps.find(function (p) { return p.connected; }) || null;

    if (!chosen && configured) chosen = await resurrectHint(configured, ps);
    if (!chosen && preferredPlayerId && preferredPlayerId !== configured) {
      chosen = await resurrectHint(preferredPlayerId, ps);
    }

    if (!chosen) {
      reconcileNoPlayer(ps.length
        ? 'No player is connected.'
        : 'No player was found on LMS.');
      return false;
    }
    state.playerId = chosen.id;
    state.connected = true;
    state.commandable = true;
    state.lastError = '';
    return true;
  }

  /* STATE-01: ficar sem player e uma transicao, nao so um indicador. A tela
     chegou a mostrar `No player was found on LMS` ao lado de Take on Me, com
     progresso correndo e Previous/Play/Stop/Next habilitados -- tres respostas
     diferentes para a mesma pergunta, e nenhuma delas atendia. Retry nao
     resolvia; so recarregar limpava.

     Aqui a transicao acontece inteira de uma vez. A faixa em cache fica de
     proposito: e o "last known track" que o aviso promete. O que nao fica e a
     ideia de reproducao em curso -- sem modo tocando e sem posicao, a barra de
     progresso para -- nem a de comando com destino. */
  function reconcileNoPlayer(reason) {
    state.playerId = null;
    state.connected = false;
    state.commandable = false;
    state.lastError = reason;
    state.mode = 'stop';
    state.time = 0;
    state.duration = 0;
  }

  async function loadVolumeMode(playerId) {
    var dvc = await api.playerPref(playerId, 'digitalVolumeControl');
    if (dvc == null) throw new Error('LMS did not confirm the volume mode.');
    if (state.playerId !== playerId) return false;
    state.fixedVolume = String(dvc) === '0';
    state.volumeControllable = !state.fixedVolume || state.useVolumeControl === true;
    state.volumeModeSynced = true;
    return true;
  }

  async function loadPlayerSettings() {
    var playerId = state.playerId;
    state.auxiliaryErrors.playerSettings = '';
    try {
      await loadVolumeMode(playerId);
    } catch (e) {
      if (state.playerId === playerId) {
        state.volumeModeSynced = false;
        backgroundError('playerSettings', e);
      }
    }
    try {
      var transitionType = Number(await api.playerPref(playerId, 'transitionType')) || 0;
      var transitionDuration = Number(await api.playerPref(playerId, 'transitionDuration')) || 0;
      var replayGainMode = Number(await api.playerPref(playerId, 'replayGainMode')) || 0;
      var sleepRemaining = await api.sleepRemaining(playerId);
      if (state.playerId !== playerId) return;
      state.transitionType = transitionType;
      state.transitionDuration = transitionDuration;
      state.replayGainMode = replayGainMode;
      state.sleepRemaining = sleepRemaining;
    } catch (e) { if (state.playerId === playerId) backgroundError('playerSettings', e); }
    await loadEqualizer(false);
    await refreshSyncGroup().then(function () { state.auxiliaryErrors.sync = ''; }, function (e) {
      backgroundError('sync', e);
    });
  }

  function setEqualizer(playerId, value) {
    if (state.playerId !== playerId) return;
    Object.keys(value).forEach(function (key) { state.equalizer[key] = value[key]; });
    state.equalizer.playerId = playerId;
  }

  async function loadEqualizer(force) {
    var playerId = state.playerId;
    if (!playerId || !state.connected) {
      setEqualizer(playerId, { status: 'idle', settings: null, error: '' });
      return;
    }
    if (!force && equalizerCache[playerId]) {
      setEqualizer(playerId, equalizerCache[playerId]);
      return;
    }
    setEqualizer(playerId, { status: 'loading', settings: null, error: '' });
    try {
      var result = await Promise.all([
        api.squeezeDspRead(playerId), api.squeezeDspCatalog(playerId)
      ]);
      var ready = {
        status: 'ready', clientName: result[0].clientName,
        revision: result[0].revision, settings: result[0].settings,
        presets: result[1].presets, impulses: result[1].impulses, error: ''
      };
      equalizerCache[playerId] = ready;
      if (!equalizerManual[playerId]) equalizerManual[playerId] = cloneJson(ready.settings);
      setEqualizer(playerId, ready);
    } catch (e) {
      setEqualizer(playerId, {
        status: e && e.kind === 'lms' ? 'unavailable' : 'error',
        settings: null,
        error: friendlyError(e, 'Could not load the equalizer.')
      });
    }
  }

  async function saveEqualizer(settings) {
    var playerId = state.playerId;
    if (!playerId || state.equalizer.status !== 'ready') return;
    await api.squeezeDspSave(playerId, settings);
    if (state.playerId !== playerId) return;
    if (state.equalizer.activeRule) {
      state.equalizer.activeRule.settings = cloneJson(settings);
      saveEqualizerRules();
    } else equalizerManual[playerId] = cloneJson(settings);
    equalizerCache[playerId] = null;
    await loadEqualizer(true);
  }

  /* `can <cmd> ?` nao depende de player, entao a resposta vale para o servidor
     inteiro -- nao precisa ser refeita a cada troca de player, so uma vez por
     carregamento da pagina. randomplay e dontstopthemusicsetting nao tem
     consumidor ainda; a proxima leva usa o que ja estiver aqui sem escrever
     uma sonda propria. */
  var CAPABILITY_PROBES = {
    rating: ['rating'],
    randomplay: ['randomplay'],
    dontstopthemusicsetting: ['dontstopthemusicsetting']
  };
  // latch on SUCCESS, not on attempt: a resolved probe is good for the whole
  // page and must not be re-fetched, but a rejected one has to be retryable --
  // otherwise one transient failure disables every capability-gated control
  // for the life of the page (EC-034). Latching the promise itself (rather
  // than a boolean) also means concurrent callers (init() and refresh() can
  // both reach this) await the same in-flight request instead of firing two.
  var capabilitiesPromise = null;

  async function loadCapabilities() {
    if (!capabilitiesPromise) {
      capabilitiesPromise = api.canCommands(CAPABILITY_PROBES).catch(function (e) {
        capabilitiesPromise = null;
        throw e;
      });
    }
    try {
      state.capabilities = await capabilitiesPromise;
    } catch (e) {
      state.capabilities = {};
    }
    // ausencia de player-tie: sempre expoe como false quando a sonda falha,
    // nunca deixa o controle visivel e desabilitado
    state.canRate = !!state.capabilities.rating;
  }

  var playbackIntelligenceChecked = 0;
  async function refreshPlaybackIntelligence(force) {
    var playerId = state.playerId;
    if (!playerId) return;
    if (!force && Date.now() - playbackIntelligenceChecked < 5000) return;
    playbackIntelligenceChecked = Date.now();
    var tasks = [];
    if (state.capabilities.randomplay && api.randomPlayActive) {
      tasks.push(api.randomPlayActive(playerId).then(function (mode) {
        if (state.playerId === playerId) { state.randomPlay.active = mode || ''; state.auxiliaryErrors.playbackIntelligence = ''; }
      }).catch(function (e) {
        if (state.playerId === playerId) { state.randomPlay.active = ''; backgroundError('playbackIntelligence', e); }
      }));
    } else state.randomPlay.active = '';
    if (state.capabilities.dontstopthemusicsetting && api.dontStopProviders) {
      tasks.push(Promise.all([
        api.dontStopProviders(playerId),
        api.playerPref(playerId, 'plugin.dontstopthemusic:provider')
      ]).then(function (result) {
        if (state.playerId !== playerId) return;
        state.dontStopMusic.providers = result[0];
        var selected = result[0].filter(function (provider) { return provider.selected; })[0];
        state.dontStopMusic.provider = selected ? selected.id : String(result[1] || '0');
      }).catch(function (e) {
        if (state.playerId === playerId) {
          state.dontStopMusic.providers = [];
          state.dontStopMusic.provider = '0';
          backgroundError('playbackIntelligence', e);
        }
      }));
    } else {
      state.dontStopMusic.providers = [];
      state.dontStopMusic.provider = '0';
    }
    await Promise.all(tasks);
  }

  async function setRandomPlay(mode) {
    var playerId = state.playerId;
    if (!playerId || !state.capabilities.randomplay) return;
    state.randomPlay.busy = true;
    try {
      await api.randomPlay(playerId, mode);
      if (state.playerId !== playerId) return;
      await loadQueue();
      playbackIntelligenceChecked = 0;
      await refreshPlaybackIntelligence(true);
    } finally { if (state.playerId === playerId) state.randomPlay.busy = false; }
  }

  async function setDontStopMusic(provider) {
    var playerId = state.playerId;
    if (!playerId || !state.capabilities.dontstopthemusicsetting) return;
    state.dontStopMusic.busy = true;
    try {
      await api.setPlayerPref(playerId, 'plugin.dontstopthemusic:provider', provider || 0);
      var result = await Promise.all([
        api.dontStopProviders(playerId),
        api.playerPref(playerId, 'plugin.dontstopthemusic:provider')
      ]);
      if (state.playerId !== playerId) return;
      state.dontStopMusic.providers = result[0];
      var selected = result[0].filter(function (candidate) { return candidate.selected; })[0];
      state.dontStopMusic.provider = selected ? selected.id : String(result[1] || '0');
    } finally { if (state.playerId === playerId) state.dontStopMusic.busy = false; }
  }

  async function init() {
    loadEqualizerRules();
    var saved = readJson(SESSION_KEY, {});
    state.history = uniqueHistory(readJson(HISTORY_KEY, []));
    saveHistory();
    preferredPlayerId = saved.playerId || null;
    if (!state.playerId && preferredPlayerId) state.playerId = preferredPlayerId;
    try {
      var found = await discoverPlayer();
    } catch (e) {
      state.connected = false;
      state.commandable = false;
      state.lastError = friendlyError(e, 'Could not find the server.');
      state.initialized = true;
      return;
    }
    if (!found) {
      state.initialized = true;
      return;
    }
    await loadPlayerSettings();
    await loadCapabilities();
    await refreshPlaybackIntelligence(true);
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
        // cobre a sessao que comecou sem player: init() nunca chegou a pedir
        // as capacidades, e capabilitiesPromise torna a chamada de novo aqui
        // gratis quando ja tiver sido resolvida (e tenta de novo se a
        // primeira tentativa tiver falhado)
        await loadCapabilities();
      } catch (e) {
        state.connected = false;
        state.commandable = false;
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
      /* Keep the last screen; the connection indicator changes -- and with
         it the right to command, because nothing is reaching the player. */
      state.connected = false;
      state.commandable = false;
      state.lastError = friendlyError(e, 'The connection to the player was lost.');
      state.initialized = true;
      return;
    }
    if (state.playerId !== playerId) return;
    state.connected = true;
    state.commandable = true;
    state.lastError = '';
    state.lastSuccess = Date.now();
    state.initialized = true;
    state.mode = st.mode;
    state.time = st.time;
    state.duration = st.duration;
    state.useVolumeControl = st.useVolumeControl;
    state.volumeControllable = !state.fixedVolume || st.useVolumeControl === true;
    state.replayGainApplied = st.replayGain;
    if (!state.volumeDragging) state.volume = st.volume;
    var oldTrackId = state.np.id;
    state.np = {
      id: st.track.id, title: st.track.title, artist: st.track.artist,
      album: st.track.album, albumId: st.track.albumId, trackNum: st.track.trackNum,
      coverId: st.track.coverId, url: st.track.url,
      sampleRate: st.sampleRate, sampleSize: st.sampleSize,
      format: st.format, bitrate: st.bitrate, live: st.live,
      sourceStream: st.sourceStream, activeStream: st.activeStream,
      isTranscoded: st.isTranscoded
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
              if (info.trackNum) state.np.trackNum = info.trackNum;
              var remembered = state.history.filter(function (item) {
                return String(item.id) === String(info.id);
              })[0];
              if (remembered) {
                remembered.albumId = info.albumId;
                if (info.trackNum) remembered.trackNum = info.trackNum;
                saveHistory();
              }
            }
            applyEqualizerRule();
          }
        }).catch(function (e) {
          if (state.playerId === playerId) backgroundError('trackInfo', e);
        });
      }
    }
    saveSession();
    refreshFavorite(false);
    refreshPlaybackIntelligence(false).catch(function (e) { backgroundError('playbackIntelligence', e); });
    updateMediaSession();
    // revalidacao da lista de players pega carona no poll, sem segundo timer
    if (Date.now() - lastPlayersCheck >= PLAYERS_REVALIDATE_MS) {
      refreshPlayers().catch(function (e) { backgroundError('sync', e); });
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
    equalizerCache = Object.create(null);
    equalizerApplyQueue = Object.create(null);
    equalizerApplySequence = Object.create(null);
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
    } catch (e) { throw e; }
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

  /* A tab that comes back from the background must rejoin the server state
     immediately. Waiting for the ordinary idle interval left a reopened phone
     showing an old album and position for up to five seconds; pages restored
     from the back-forward cache could remain stale even longer. */
  function resumePolling() {
    if (document.hidden) return;
    polling = true;
    if (ticking) return;                       // the in-flight refresh will reschedule
    if (timer !== null) clearTimeout(timer);
    timer = null;
    tick();
  }

  function stopPolling() {
    polling = false;
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopPolling(); else resumePolling();
  });
  if (window.addEventListener) window.addEventListener('pageshow', resumePolling);

  /* A fila e a playlist do servidor. Antes isto era uma copia no cliente, e
     playFrom mandava `playlistcontrol cmd:load track_id:` de uma faixa so — a
     fila do LMS nunca passava de um item. Carregar o container e saltar para o
     indice e o que o proprio LMS faz. */
  /* Guarda o dono do desfazer junto com as entradas: a fila de uma sala nao
     pode ser injetada no player de outra depois de trocar de player.
     O dono vem por parametro, capturado ANTES do primeiro await do mutador.
     Lendo state.playerId aqui, uma troca de player com as chamadas ainda no ar
     carimbava o player NOVO -- e a checagem de dono em undoQueue, que existe
     justamente para impedir isso, passava a aprovar a injecao errada.
     Sem dono nao ha desfazer: queueUndoPlayerId fica undefined, undoQueue
     descarta, e a falta de desfazer e sempre melhor que o desfazer na sala
     errada. */
  function setQueueUndo(entries, ownerId) {
    state.queueUndo = entries;
    state.queueUndoPlayerId = ownerId;
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
      state.auxiliaryErrors.queue = '';
    } catch (e) {
      backgroundError('queue', e);
      throw e;
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
    var playerId = state.playerId;
    if (!playerId) return;
    if (index < 0 || index >= state.queue.length) return;
    var item = state.queue.find(function (t) { return t.index === index; });
    await api.queueRemove(playerId, index);
    if (item) setQueueUndo([{ item: item, index: index }], playerId);
    await loadQueue();
    return true;
  }

  async function moveInQueue(from, to) {
    if (!state.playerId) return false;
    from = Number(from); to = Number(to);
    var total = Math.max(state.queueTotal || 0, state.queue.length);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 ||
        from >= total || to >= total || from === to) return false;
    var playerId = state.playerId;
    await api.queueMove(playerId, from, to);
    if (state.playerId !== playerId) return false;
    await loadQueue();
    return true;
  }

  async function queueItem(action, key, id) {
    if (['insert', 'add'].indexOf(action) < 0 ||
        !/^(?:track_id|album_id|artist_id|genre_id|playlist_id|year_id|url)$/.test(String(key || '')) ||
        id == null || String(id).trim() === '') return false;
    if (!state.playerId || !state.connected) {
      var found = await discoverPlayer();
      if (!found) throw new Error(state.lastError || 'No player is available.');
      await loadPlayerSettings();
    }
    var playerId = state.playerId;
    await api.queueControl(playerId, action, key, id);
    if (state.playerId !== playerId) return false;
    await loadQueue();
    return true;
  }

  function playNext(key, id) { return queueItem('insert', key, id); }
  function addToQueue(key, id) { return queueItem('add', key, id); }

  /* queueClear destroi a playlist inteira do servidor, mas o retrato saia de
     state.queue -- que e so a janela de 500 linhas. Numa fila de 698, o
     "Undo" devolvia 500 e as outras 198 sumiam sem aviso nenhum. Aqui a fila
     e relida inteira antes de destruir, e o que nao vier e dito ao usuario,
     como handoffTo ja fazia. */
  async function clearQueue() {
    var playerId = state.playerId;
    if (!playerId) return;
    var full = await fullQueue();
    if (full.tracks.length < full.total) {
      notifyTruncated(full.tracks.length, full.total);
    }
    var snapshot = full.tracks.map(function (item) {
      return { item: item, index: item.index };
    });
    await api.queueClear(playerId);
    setQueueUndo(snapshot, playerId);
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
      if (done.length) setQueueUndo(done, playerId);
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
    var current = Number(state.shuffle);
    if (!Number.isInteger(current) || current < 0 || current > 2) current = 0;
    await api.setShuffle(state.playerId, (current + 1) % 3);
    await loadQueue();
  }

  async function cycleRepeat() {
    if (!state.playerId) return;
    var current = Number(state.repeat);
    if (!Number.isInteger(current) || current < 0 || current > 2) current = 0;
    await api.setRepeat(state.playerId, (current + 1) % 3);
    await loadQueue();
  }

  async function selectPlayer(playerId) {
    var found = state.players.find(function (p) { return p.id === playerId; });
    if (!found) return;
    // o desfazer pertence ao player anterior; segui-lo injetaria a fila errada
    if (playerId !== state.playerId) clearQueueUndo();
    state.playerId = playerId;
    // escolha explicita: e a unica coisa que muda a preferencia guardada
    preferredPlayerId = playerId;
    state.connected = !!found.connected;
    state.commandable = !!found.connected;
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

  async function syncWith(playerId) {
    if (!state.playerId) return Promise.resolve();
    state.syncBusy = true;
    try {
      await api.syncPlayer(state.playerId, playerId);
      await refreshPlayers();
    } finally { state.syncBusy = false; }
  }

  async function unsyncPlayer(playerId) {
    var target = playerId || state.playerId;
    if (!target) return;
    state.syncBusy = true;
    try {
      await api.syncPlayer(target, null);
      await refreshPlayers();
    } finally { state.syncBusy = false; }
  }

  async function setGroupVolume(volume) {
    var group = state.syncGroup;
    if (!group) return;
    var value = Math.max(0, Math.min(100, Math.round(Number(volume) || 0)));
    state.syncBusy = true;
    try {
      var results = await Promise.all(group.members.filter(function (member) {
        return member.connected && !member.fixed && !(global.LmsUi &&
          typeof LmsUi.volumeExcluded === 'function' && LmsUi.volumeExcluded(member.id));
      }).map(function (member) {
        return api.setVolume(member.id, value).then(function () { return true; }, function () { return false; });
      }));
      await refreshSyncGroup();
      if (results.some(function (ok) { return !ok; })) throw new Error('Some players did not accept the group volume.');
    } finally { state.syncBusy = false; }
  }

  async function setTransition(type, duration) {
    var playerId = state.playerId;
    if (!playerId) return false;
    var parsedType = Number(type), parsedDuration = Number(duration);
    if (!Number.isSafeInteger(parsedType) || !Number.isSafeInteger(parsedDuration)) return false;
    parsedType = Math.max(0, Math.min(3, parsedType));
    parsedDuration = Math.max(0, Math.min(60, parsedDuration));
    await api.setPlayerPref(playerId, 'transitionType', parsedType);
    if (state.playerId !== playerId) return false;
    await api.setPlayerPref(playerId, 'transitionDuration', parsedDuration);
    if (state.playerId !== playerId) return false;
    state.transitionType = parsedType;
    state.transitionDuration = parsedDuration;
    return true;
  }

  /* O player fica num local ANTES do primeiro await, e a escrita so vale se
     ele ainda for o corrente depois. setTransition acima ainda le
     state.playerId depois do await -- e a exposicao que EC-014 descreve, aqui
     nao repetida. Sem a releitura, trocar de player no meio da chamada
     gravava a preferencia no player errado.

     O LMS devolve a preferencia como string, ou null quando a chave nao
     existe (ver api.playerPref); o servidor tem historico de reverter
     valores de player (ver digitalVolumeControl no plano de audio de
     2026-08-03), entao o valor gravado e relido em vez de assumido. A
     releitura so substitui o valor otimista quando o servidor de fato
     devolveu algo -- null, undefined ou string vazia mantem o valor
     escrito, para "sem resposta" nunca ser lido como um "0" (Off)
     confirmado. [Unverified] se replayGainMode e a chave certa e se o
     servidor chega a reverter esse valor; a releitura torna isso visivel
     em vez de silencioso. */
  async function setReplayGain(mode) {
    var playerId = state.playerId;
    if (!playerId) return;
    var value = Math.min(3, Math.max(0, mode | 0));
    await api.setPlayerPref(playerId, 'replayGainMode', value);
    if (state.playerId !== playerId) return;
    var raw = await api.playerPref(playerId, 'replayGainMode');
    if (state.playerId !== playerId) return;
    var stored = (raw === null || raw === undefined || raw === '') ? NaN : Number(raw);
    state.replayGainMode = isFinite(stored) ? stored : value;
  }

  async function setSleep(seconds) {
    var playerId = state.playerId;
    var value = Number(seconds);
    if (!playerId || !Number.isSafeInteger(value) || value < 0) return false;
    value = Math.min(value, 2147483647);
    await api.sleep(playerId, value);
    if (state.playerId !== playerId) return false;
    state.sleepRemaining = value;
    return true;
  }

  function sleepAfterTrack() {
    return setSleep(Math.max(1, Math.ceil(state.duration - state.time)));
  }

  function sleepAfterQueue() {
    // queueRemaining ja desconta o tempo decorrido; descontar de novo dormiria cedo
    return setSleep(Math.max(1, Math.ceil(queueRemaining())));
  }

  async function setRating(stars) {
    var playerId = state.playerId;
    var trackId = state.np.id;
    if (!state.canRate || !playerId || trackId == null) return false;
    await api.setRating(playerId, trackId, stars);
    if (state.playerId !== playerId || state.np.id !== trackId) return false;
    api.forgetSongInfo();
    var info = await api.songInfo(playerId, trackId);
    if (state.playerId !== playerId || state.np.id !== trackId) return false;
    state.trackInfo = info;
    return true;
  }

  /* Transporte. Apagadas por engano ao reescrever a fila; o export continuava
     citando-as, o que derrubava o modulo inteiro com "play is not defined". */
  async function transport(cmd) {
    if (!state.playerId || !state.connected) {
      var found = await discoverPlayer();
      if (!found) throw new Error(state.lastError || 'No player is available.');
      await loadPlayerSettings();
    }
    var playerId = state.playerId;
    if (cmd === 'play' && state.mode === 'stop' &&
        (!state.queueTotal || (state.queueTotal === 1 && state.np && state.np.albumId != null)) &&
        state.np && state.np.id != null) {
      if (state.np.albumId != null && api.loadContainer) {
        await api.loadContainer(playerId, 'album_id', state.np.albumId);
        if (state.playerId !== playerId) return;
        clearQueueUndo();
        var trackIndex = Math.max(0, (state.np.trackNum || 1) - 1);
        if (trackIndex && api.queueJump) await api.queueJump(playerId, trackIndex);
      } else if (!state.queueTotal && api.loadTrack) {
        await api.loadTrack(playerId, state.np.id);
        if (state.playerId !== playerId) return;
        await api.transport(playerId, 'play');
      } else {
        await api.transport(playerId, cmd);
      }
      if (state.playerId !== playerId) return;
      await refresh();
      await loadQueue();
      return true;
    }
    if ((cmd === 'next' || cmd === 'prev') && !state.queueTotal) {
      global.LmsUi.notify('The playback queue is empty.', 'error', 3500);
      return false;
    }
    await api.transport(playerId, cmd);
    if (state.playerId !== playerId) return;
    await refresh();
    await loadQueue();
    return true;
  }

  function play()  { return transport('play'); }
  function pause() { return transport('pause'); }
  function stop()  { return transport('stop'); }
  function next()  { return transport('next'); }
  function prev()  { return transport('prev'); }

  async function seek(seconds) {
    if (!state.playerId || state.np.live || !state.duration) return;
    var playerId = state.playerId;
    var value = Math.max(0, Math.min(state.duration, Math.round(Number(seconds) || 0)));
    var previous = state.time;
    state.time = value;
    try { await api.seek(playerId, value); }
    catch (e) { if (state.playerId === playerId) state.time = previous; throw e; }
    if (state.playerId !== playerId) return false;
    await refresh();
    return true;
  }

  async function setVolume(volume) {
    if (!state.playerId || !state.volumeControllable) return;
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
      state.volumeControllable = !state.fixedVolume || state.useVolumeControl === true;
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
          state.commandable = false;
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
    unsyncPlayer: guarded('Player synchronisation', unsyncPlayer, true),
    setGroupVolume: guarded('The group volume', setGroupVolume, false),
    refreshSyncGroup: refreshSyncGroup,
    refreshPlaybackIntelligence: refreshPlaybackIntelligence,
    setRandomPlay: guarded('Random mix', setRandomPlay, false),
    setDontStopMusic: guarded("Don't stop the music", setDontStopMusic, false),
    setTransition: guarded('The crossfade setting', setTransition, false),
    setReplayGain: guarded('The replay gain setting', setReplayGain, false),
    refreshEqualizer: loadEqualizer,
    saveEqualizer: guarded('The equalizer settings', saveEqualizer, false),
    toggleEqualizerRule: guarded('The equalizer rule', toggleEqualizerRule, false),
    removeEqualizerRule: guarded('The equalizer rule', removeEqualizerRule, false),
    equalizerRuleDescriptor: equalizerRuleDescriptor,
    setEqualizerContext: setEqualizerContext,
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
