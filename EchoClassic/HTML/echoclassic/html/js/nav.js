
/* One navigation stack per tab. iOS keeps each tab where you left it, and the
   nav bar's back label is the name of the frame below the current one — or the
   tab's own root label when there is only one frame. */
(function (global) {
  'use strict';

  var saved = {};
  try {
    var parsed = JSON.parse(localStorage.getItem('echoclassic.nav.v1') || '');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed;
  } catch (e) {}

  /* Um arquivo de preferencias corrompido ainda e JSON valido; sem esta
     conferencia um `musica` que nao fosse array quebrava o push do primeiro
     drill e a skin nao voltava sozinha. */
  function validFrames(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(function (frame) {
      return frame && typeof frame === 'object' && !Array.isArray(frame) &&
        typeof frame.label === 'string';
    });
  }

  var stacks = Vue.observable({
    music: validFrames(saved.music), playlists: validFrames(saved.playlists),
    radio: validFrames(saved.radio), apps: validFrames(saved.apps),
    favourites: validFrames(saved.favourites), settings: []
  });
  var musicRoots = saved.musicRoots && typeof saved.musicRoots === 'object' ? saved.musicRoots : {};
  var activeMusicRoot = global.LmsUi && global.LmsUi.state.rootKey || 'all';

  function persist() {
    try {
      localStorage.setItem('echoclassic.nav.v1', JSON.stringify({
        music: stacks.music, playlists: stacks.playlists,
        radio: stacks.radio, apps: stacks.apps, favourites: stacks.favourites,
        musicRoots: musicRoots
      }));
    } catch (e) {}
  }

  function stack(tab) {
    if (!stacks[tab]) Vue.set(stacks, tab, []);
    return stacks[tab];
  }

  var applyingHistory = false;

  function historyState(tab) {
    return {
      echoClassic: true, tab: tab, depth: depth(tab),
      frames: JSON.parse(JSON.stringify(stack(tab)))
    };
  }

  function push(tab, frame) {
    stack(tab).push(frame);
    persist();
    if (!applyingHistory && history.pushState) history.pushState(historyState(tab), '');
  }

  function pop(tab) {
    var s = stack(tab);
    var item = s.length ? s.splice(s.length - 1, 1)[0] : null;
    persist();
    return item;
  }

  function top(tab) {
    var s = stack(tab);
    return s.length ? s[s.length - 1] : null;
  }

  function depth(tab) { return stack(tab).length; }

  function reset(tab) {
    stack(tab).splice(0);
    persist();
    if (!applyingHistory && history.replaceState) history.replaceState(historyState(tab), '');
  }

  function switchMusicRoot(key) {
    key = key || 'all';
    musicRoots[activeMusicRoot] = JSON.parse(JSON.stringify(stacks.music));
    activeMusicRoot = key;
    var restored = validFrames(musicRoots[key]);
    stacks.music.splice(0, stacks.music.length);
    restored.forEach(function (frame) { stacks.music.push(frame); });
    persist();
    if (history.replaceState) history.replaceState(historyState('music'), '');
    return restored;
  }

  function markTab(tab) {
    if (applyingHistory || !history.pushState) return;
    var current = history.state;
    if (current && current.echoClassic && current.tab === tab && current.depth === depth(tab)) return;
    history.pushState(historyState(tab), '');
  }

	  function back(tab) {
	    if (!depth(tab)) return null;
	    /* The visible Back command belongs to the current tab's own stack. Browser
	       history also records tab switches, so history.back() could unexpectedly
	       leave this tab instead of returning to its parent screen. */
	    var removed = pop(tab);
    if (!applyingHistory && history.replaceState) {
      history.replaceState(historyState(tab), '');
    }
    return removed;
  }

  function parentLabel(tab, rootLabel) {
    var s = stack(tab);
    if (!s.length) return null;
    return s.length > 1 ? s[s.length - 2].label : rootLabel;
  }

  window.addEventListener('popstate', function (event) {
    var target = event.state;
    if (!target || !target.echoClassic) return;
    applyingHistory = true;
    if (global.LmsUi && global.LmsUi.restoreTab) global.LmsUi.restoreTab(target.tab);
    var s = stack(target.tab);
    var frames = Array.isArray(target.frames) ? validFrames(target.frames)
      : s.slice(0, Math.max(0, target.depth | 0));
    s.splice(0, s.length);
    frames.forEach(function (frame) { s.push(frame); });
    persist();
    /* NAV-01: a seta do navegador devolve a busca pelo mesmo caminho que o
       Back contextual. Sem isto os dois discordavam -- um voltava aos
       resultados, o outro caia na raiz da aba. resumeSearch nao faz nada
       quando nao ha busca suspensa daquela aba, entao voltar ao fundo de uma
       pilha comum continua sendo voltar a raiz. */
    if (!s.length && global.LmsUi && global.LmsUi.resumeSearch) {
      global.LmsUi.resumeSearch(target.tab);
    }
    applyingHistory = false;
  });

  if (history.replaceState) {
    history.replaceState(historyState(global.LmsUi ? global.LmsUi.state.tab : 'music'), '');
  }

  global.LmsNav = {
    stacks: stacks, push: push, pop: pop, top: top,
    depth: depth, reset: reset, parentLabel: parentLabel,
    back: back, markTab: markTab, switchMusicRoot: switchMusicRoot
  };
})(window);
