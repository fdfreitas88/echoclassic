
/* Ajustes. Everything here is either read live from the server or is a real
   switch that changes the interface immediately. Advanced LMS pages remain
   native, but open inside this tab so Echo Classic navigation is preserved. */
Vue.component('lms-settings', {
  template: `
<div class="scroller settings-scroller">
<div v-if="ui.advancedSettings" class="settings advanced-settings-shell">
  <div class="advanced-settings-toolbar">
    <button ref="advancedBack" type="button" class="advanced-back pointer" @click="closeAdvanced">
      <span aria-hidden="true">‹</span> Settings
    </button>
    <strong>LMS settings</strong>
    <span aria-hidden="true"></span>
  </div>
  <iframe class="advanced-settings-frame" title="Advanced LMS settings"
          src="/settings/index.html"></iframe>
</div>
<div v-else class="settings">
  <div class="sgh">Player</div>
  <div class="sgroup">
    <button type="button" class="srow settings-command-row pointer"
            :aria-expanded="String(showPlayers)" @click="showPlayers = !showPlayers">
      Active player <span class="v">{{ playerName }} ›</span>
    </button>
    <template v-if="showPlayers">
      <div class="player-help">
        Controlar muda o player usado pelo Echo Classic. Transferir leva a reprodução atual.
        Sincronizar faz os dois players tocarem juntos.
      </div>
      <div v-for="p in store.players" :key="p.id" class="player-choice">
        <div class="player-name">
          <strong>{{ p.name }}</strong>
          <span>{{ p.connected ? 'connected' : 'unavailable' }}</span>
        </div>
        <span v-if="p.id === store.playerId" class="player-current">Em uso</span>
        <template v-else-if="p.connected">
          <button title="Usar este player no Echo Classic" @click.stop="control(p)">Controlar</button>
          <button title="Continue playback on this player" @click.stop="handoff(p)">Transferir</button>
          <button title="Reproduzir em conjunto com o player atual" @click.stop="sync(p)">Sincronizar</button>
        </template>
      </div>
    </template>
    <div class="srow">Connection <span class="v">{{ store.connected ? 'connected' : 'no player' }}</span></div>
    <label class="srow">Volume
      <input class="setting-range" type="range" min="0" max="100" step="1"
             :value="volumeValue" :disabled="!volumeAdjustable"
             aria-label="Player volume"
             :title="volumeHint"
             @input="onVolumeInput($event.target.value)"
             @change="setVolumeValue($event.target.value)">
      <span class="v">{{ volumeLabel }}</span></label>
    <div v-if="store.fixedVolume" class="srow" style="min-height:34px">
      <span style="font-size:12px;color:var(--text2)">Unity gain to the DAC: LMS does not touch the samples. Set the volume on the DAC itself.</span>
    </div>
    <div v-else-if="!store.volumeModeSynced" class="srow" style="min-height:34px">
      <span style="font-size:12px;color:var(--text2)">O LMS ainda não respondeu se este player usa volume por software. Escolha o player em “Player ativo” ou toque em “Tentar novamente” na barra de conexão para consultar de novo.</span>
    </div>
  </div>

  <div class="sgh">Playback</div>
  <div class="sgroup">
    <label class="srow">Crossfade
      <select class="setting-select transition-select" :value="store.transitionType" @change="transition($event.target.value)">
        <option value="0">No crossfade / gapless</option>
        <option value="1">Crossfade</option>
      </select>
    </label>
    <label v-if="store.transitionType" class="srow">Duração
      <input class="setting-range" type="range" min="1" max="12"
             :value="durationValue"
             @input="durationDraft = Number($event.target.value)"
             @change="duration($event.target.value)">
      <span class="v">{{ durationValue }} segundos</span>
    </label>
    <div class="srow sleep-row">
      Sleep timer
      <div class="inline-commands">
        <button @click="sleepMinutes(15)">15 minutes</button>
        <button @click="sleepMinutes(30)">30 minutes</button>
        <button @click="sleepMinutes(60)">1 hour</button>
      </div>
    </div>
    <div class="srow sleep-row">
      Stop at end
      <div class="inline-commands">
        <button :disabled="!canSleepAtEnd" :title="sleepAtEndHint"
                @click="sleepTrack">This song</button>
        <button :disabled="!canSleepAtEnd" :title="sleepAtEndHint"
                @click="sleepQueue">The queue</button>
        <button v-if="store.sleepRemaining" @click="cancelSleep">Cancel</button>
      </div>
    </div>
    <div v-if="!canSleepAtEnd" class="srow" style="min-height:34px">
      <span style="font-size:12px;color:var(--text2)">{{ sleepAtEndHint }}</span>
    </div>
    <div v-if="store.sleepRemaining" class="srow">
      Desligamento programado <span class="v">{{ sleepLabel }}</span>
    </div>
  </div>

  <div class="sgh">Appearance</div>
  <div class="sgroup">
    <div class="srow">Theme
      <span class="v">{{ ui.dark ? 'dark' : 'light' }}</span>
      <button type="button" class="sw" :class="{on: ui.dark}" role="switch"
              :aria-checked="String(ui.dark)" aria-label="Dark theme"
              @click="toggleTheme"><span class="visually-hidden">Dark theme</span></button></div>
    <div class="srow">Rate and bits in the bottom bar
      <button type="button" class="sw" :class="{on: ui.showBadges}" role="switch"
              :aria-checked="String(ui.showBadges)" aria-label="Rate and bits in the bottom bar"
              @click="preference('showBadges')"><span class="visually-hidden">Rate and bits in the bottom bar</span></button></div>
    <div class="srow">Highlight hi-res
      <button type="button" class="sw" :class="{on: ui.markHires}" role="switch"
              :aria-checked="String(ui.markHires)" aria-label="Highlight high resolution audio"
              @click="preference('markHires')"><span class="visually-hidden">Highlight high resolution audio</span></button></div>
  </div>

  <div class="sgh">Language</div>
  <div class="sgroup language-group" role="radiogroup" aria-label="Language">
    <button v-for="lang in languages" :key="lang.key" type="button"
            class="srow language-row"
            role="radio" :aria-checked="currentLanguage === lang.key ? 'true' : 'false'"
            :tabindex="currentLanguage === lang.key ? 0 : -1"
            @keydown="radioKey($event, languages, currentLanguage, language)"
            @click="language(lang.key)">
      <span class="language-label">{{ lang.label }}</span>
      <span class="language-check" aria-hidden="true"></span>
    </button>
  </div>
  <div class="srow language-note">
    <span style="font-size:12px;color:var(--text2)">Choosing a language reloads the page. English is the original text; the others are translations shipped with the skin.</span>
  </div>

  <div class="sgh">Colour scheme</div>
  <div class="sgroup color-scheme-group" role="radiogroup" aria-label="Colour scheme">
    <button v-for="scheme in colorSchemes" :key="scheme.key" type="button"
            class="srow color-scheme-row" :class="'scheme-' + scheme.key"
            role="radio" :aria-checked="ui.colorScheme === scheme.key ? 'true' : 'false'"
            :tabindex="ui.colorScheme === scheme.key ? 0 : -1"
            @keydown="radioKey($event, colorSchemes, ui.colorScheme, colorScheme)"
            @click="colorScheme(scheme.key)">
      <span class="scheme-swatches" aria-hidden="true">
        <span class="scheme-swatch scheme-swatch-light"></span>
        <span class="scheme-swatch scheme-swatch-dark"></span>
      </span>
      <span class="scheme-label">{{ scheme.label }}</span>
      <span class="color-scheme-check" aria-hidden="true"></span>
    </button>
  </div>

  <div class="sgh">Fonts</div>
  <div class="sgroup font-option-group" role="radiogroup" aria-label="Fonts">
    <button v-for="font in fontOptions" :key="font.key" type="button"
            class="srow font-option-row" :class="'font-' + font.key"
            role="radio" :aria-checked="ui.fontFamily === font.key ? 'true' : 'false'"
            :tabindex="ui.fontFamily === font.key ? 0 : -1"
            @keydown="radioKey($event, fontOptions, ui.fontFamily, fontFamily)"
            @click="fontFamily(font.key)">
      <span class="font-option-label">{{ font.label }}</span>
      <span class="font-option-check" aria-hidden="true"></span>
    </button>
  </div>

  <div class="sgh">Progress bars</div>
  <div class="sgroup gauge-settings-group">
    <div class="player-help">
      The style is remembered separately for each theme. What you choose here applies to the {{ ui.dark ? 'dark' : 'light' }}theme; the other theme keeps its own.
    </div>
    <div class="srow gauge-style-row">
      <span>Estilo no mini player ({{ ui.dark ? 'tema escuro' : 'tema claro' }})</span>
      <div class="gauge-segmented" role="radiogroup"
           :aria-label="'Estilo da barra de progresso do mini player no tema ' + (ui.dark ? 'dark' : 'light')">
        <button v-for="style in gaugeStyles" :key="'mini-' + style.key" type="button"
                role="radio" :aria-checked="ui.miniGaugeStyle === style.key ? 'true' : 'false'"
                :tabindex="ui.miniGaugeStyle === style.key ? 0 : -1"
                :class="{on: ui.miniGaugeStyle === style.key}"
                @keydown="radioKey($event, gaugeStyles, ui.miniGaugeStyle, miniGaugeStyle)"
                @click="miniGaugeStyle(style.key)">{{ style.label }}</button>
      </div>
    </div>
    <label class="srow">Cor no mini player
      <select class="setting-select mini-gauge-color" :value="ui.miniGaugeColor"
              @change="gaugeColor('mini', $event.target.value)">
        <option v-for="color in gaugeColors" :key="'mini-color-' + color.key"
                :value="color.key">{{ color.label }}</option>
      </select>
    </label>
    <div class="srow gauge-style-row">
      <span>Estilo no player completo ({{ ui.dark ? 'tema escuro' : 'tema claro' }})</span>
      <div class="gauge-segmented" role="radiogroup"
           :aria-label="'Estilo da barra de progresso do player completo no tema ' + (ui.dark ? 'dark' : 'light')">
        <button v-for="style in gaugeStyles" :key="'player-' + style.key" type="button"
                role="radio" :aria-checked="ui.playerGaugeStyle === style.key ? 'true' : 'false'"
                :tabindex="ui.playerGaugeStyle === style.key ? 0 : -1"
                :class="{on: ui.playerGaugeStyle === style.key}"
                @keydown="radioKey($event, gaugeStyles, ui.playerGaugeStyle, playerGaugeStyle)"
                @click="playerGaugeStyle(style.key)">{{ style.label }}</button>
      </div>
    </div>
    <label class="srow">Cor no player completo
      <select class="setting-select player-gauge-color" :value="ui.playerGaugeColor"
              @change="gaugeColor('player', $event.target.value)">
        <option v-for="color in gaugeColors" :key="'player-color-' + color.key"
                :value="color.key">{{ color.label }}</option>
      </select>
    </label>
  </div>

  <div class="sgh">Full player layout</div>
  <div class="sgroup player-presentation-group" role="radiogroup"
       aria-label="Full player layout">
    <button v-for="mode in playerPresentations" :key="mode.key" type="button"
            class="srow player-presentation-row"
            :class="'player-presentation-' + mode.key"
            role="radio" :aria-checked="ui.playerPresentation === mode.key ? 'true' : 'false'"
            :tabindex="ui.playerPresentation === mode.key ? 0 : -1"
            @keydown="radioKey($event, playerPresentations, ui.playerPresentation, playerPresentation)"
            @click="playerPresentation(mode.key)">
      <span class="player-presentation-copy">
        <span>{{ mode.label }}</span>
        <small>{{ mode.key === 'adaptive'
          ? 'Column on wide screens; overlay on compact ones'
          : 'Sempre ocupa toda a tela' }}</small>
      </span>
      <span class="font-option-check" aria-hidden="true"></span>
    </button>
  </div>

  <div class="sgh">Security and compatibility</div>
  <div class="sgroup">
    <div class="srow">Lock screen controls
      <span class="v">{{ mediaSessionSupported ? 'available' : 'not supported in this browser' }}</span>
    </div>
    <div class="srow settings-actions">
      Skin preferences
      <span class="inline-commands">
        <button @click="exportSettings">Export</button>
        <button @click="$refs.importFile.click()">Import</button>
      </span>
      <input ref="importFile" class="visually-hidden" type="file" accept="application/json"
             tabindex="-1" aria-hidden="true"
             @change="importSettings">
    </div>
    <div v-if="pendingImport" class="import-confirm" role="alert">
      <strong>Import preferences from this file?</strong>
      <span>Serão substituídos apenas estes grupos: {{ pendingImportGroups.join(', ') }}.
        O que não estiver no arquivo continua como está. Uma cópia do estado atual
        fica guardada no navegador antes da gravação. A página recarrega em seguida.</span>
      <div class="inline-commands">
        <button @click="confirmImport">Import and reload</button>
        <button @click="cancelImport">Cancel</button>
      </div>
    </div>
  </div>

  <div class="sgh">Library</div>
  <div class="sgroup">
    <div v-if="loading" class="srow"><span style="color:var(--text2)">Consultando o servidor…</span></div>
    <template v-else-if="info">
      <div class="srow">Artists <span class="v">{{ n(info.artists) }}</span></div>
      <div class="srow">Albums <span class="v">{{ n(info.albums) }}</span></div>
      <div class="srow">Songs <span class="v">{{ n(info.songs) }}</span></div>
      <div class="srow">Genres <span class="v">{{ n(info.genres) }}</span></div>
    </template>
    <div v-else class="srow"><span style="color:var(--text2)">{{ error }}</span></div>
  </div>

  <div class="sgh">Server</div>
  <div class="sgroup">
    <button type="button" class="srow settings-command-row pointer"
            :aria-expanded="String(ui.advancedSettings)" @click="openAdvanced">
      Advanced LMS settings <span class="v">›</span>
    </button>
    <div class="srow">Server version <span class="v">LMS {{ info ? info.version : '—' }}</span></div>
    <div class="srow">Skin version <span class="v">{{ skinVersion }}</span></div>
  </div>

  <div class="sgh" style="text-transform:none">
    Native LMS pages open inside Settings, keeping Echo Classic navigation.
  </div>
</div>
</div>`,
  data: function () {
    return {
      ui: LmsUi.state, store: LmsStore.state,
      /* LmsStr existe sempre; a lista traz pelo menos o ingles, mesmo num
         servidor onde o strings.txt nao pode ser lido. */
      languages: (window.LmsStr && LmsStr.languages) ? LmsStr.languages() : [{ key: 'EN', label: 'English' }],
      currentLanguage: (window.LmsStr && LmsStr.lang) || 'EN',
      colorSchemes: LmsUi.COLOR_SCHEMES,
      fontOptions: LmsUi.FONT_OPTIONS,
      playerPresentations: LmsUi.PLAYER_PRESENTATIONS,
      gaugeStyles: LmsUi.GAUGE_STYLES,
      gaugeColors: LmsUi.GAUGE_COLORS,
      info: null, loading: true, error: '', showPlayers: false,
      pendingImport: null,
      /* Rascunhos locais: o numero ao lado do slider tem de acompanhar o
         arrasto, nao esperar o round-trip com o servidor. */
      durationDraft: null, volumeDraft: null
    };
  },
  computed: {
    playerName: function () {
      var id = this.store.playerId;
      var found = (this.store.players || []).filter(function (p) { return p.id === id; })[0];
      return found ? found.name : 'nenhum';
    },
    skinVersion: function () {
      return typeof LMS_SKIN_VERSION === 'string' && LMS_SKIN_VERSION ? LMS_SKIN_VERSION : '—';
    },
    sleepLabel: function () { return LmsFmt.longDuration(this.store.sleepRemaining); },
    mediaSessionSupported: function () { return !!navigator.mediaSession; },
    durationValue: function () {
      return this.durationDraft === null ? (this.store.transitionDuration || 4) : this.durationDraft;
    },
    volumeAdjustable: function () {
      return this.store.connected && this.store.volumeModeSynced && !this.store.fixedVolume;
    },
    volumeValue: function () {
      if (this.store.fixedVolume) return 100;
      return this.volumeDraft === null ? (this.store.volume || 0) : this.volumeDraft;
    },
    volumeLabel: function () {
      if (this.store.fixedVolume) return 'fixed — full scale';
      if (!this.store.volumeModeSynced) return 'not confirmed';
      return this.volumeValue + '%';
    },
    volumeHint: function () {
      if (this.store.fixedVolume) return 'Fixed output: volume is set on the DAC.';
      if (!this.store.connected) return 'No player connected.';
      if (!this.store.volumeModeSynced) return 'LMS has not confirmed this player\'s volume mode yet.';
      return 'Player volume';
    },
    /* "This song" com nada tocando vira `sleep 1` no store (Math.max(1, 0-0))
       e desliga o player em um segundo. Sem reproducao nao ha "terminar". */
    canSleepAtEnd: function () {
      return this.store.connected && this.store.mode !== 'stop';
    },
    /* Vai para um :title, que e binding dinamico e portanto nao passa pela
       reescrita de template. A traducao acontece aqui. */
    sleepAtEndHint: function () {
      var text = this.canSleepAtEnd ? 'Stop when this playback ends'
        : 'Available during playback: with nothing playing there is no end to wait for.';
      return window.LmsStr ? LmsStr.t(text) : text;
    },
    /* Contar chaves de localStorage dizia "5 preferencias" para uma skin
       inteira. Nomear os grupos e o que o usuario consegue conferir. */
    pendingImportGroups: function () {
      var labels = this.importGroupLabels();
      var values = (this.pendingImport && this.pendingImport.values) || {};
      var names = [];
      Object.keys(values).forEach(function (key) {
        var canonical = this.canonicalImportKey(key);
        if (canonical && labels[canonical] && names.indexOf(labels[canonical]) < 0) {
          names.push(labels[canonical]);
        }
      }, this);
      return names.length ? names : ['nenhum grupo reconhecido'];
    }
  },
  watch: {
    /* Quando o servidor confirma o valor, o rascunho sai de cena e o controle
       volta a refletir o estado real. */
    'store.transitionDuration': function () { this.durationDraft = null; },
    'store.volume': function () {
      if (!this.store.volumeDragging) this.volumeDraft = null;
    },
    'store.playerId': function () { this.volumeDraft = null; }
  },
  methods: {
    n: function (v) { return LmsFmt.count(v); },
    toggleTheme: function () { LmsUi.toggleTheme(); },
    /* setLanguage guarda a escolha e recarrega: os templates ja foram
       reescritos no registro dos componentes, entao nao ha como trocar o
       idioma da tela em pe. */
    language: function (key) {
      if (window.LmsStr && LmsStr.setLanguage) LmsStr.setLanguage(key);
    },
    colorScheme: function (key) { LmsUi.setColorScheme(key); },
    fontFamily: function (key) { LmsUi.setFontFamily(key); },
    playerPresentation: function (key) { LmsUi.setPlayerPresentation(key); },
    miniGaugeStyle: function (key) { LmsUi.setGaugeStyle('mini', key); },
    playerGaugeStyle: function (key) { LmsUi.setGaugeStyle('player', key); },
    gaugeColor: function (target, key) { LmsUi.setGaugeColor(target, key); },
    /* Padrao ARIA de radiogroup: as setas movem selecao e foco, e so o item
       marcado fica na ordem de tabulacao. Sem isto eram 14 paradas de Tab. */
    radioKey: function (event, options, currentKey, apply) {
      var forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
      var back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
      if (!forward && !back) return;
      event.preventDefault();
      var keys = options.map(function (option) { return option.key; });
      var index = keys.indexOf(currentKey);
      if (index < 0) index = 0;
      var next = (index + (forward ? 1 : -1) + keys.length) % keys.length;
      apply(keys[next]);
      var group = event.currentTarget.parentNode;
      var buttons = group ? group.querySelectorAll('[role="radio"]') : null;
      if (buttons && buttons[next]) buttons[next].focus();
    },
    preference: function (key) { LmsUi.setPreference(key, !this.ui[key]); },
    control: function (p) { LmsStore.selectPlayer(p.id); },
    handoff: function (p) { LmsStore.handoffTo(p.id); },
    sync: function (p) { LmsStore.syncWith(p.id); },
    transition: function (value) {
      LmsStore.setTransition(Number(value), this.store.transitionDuration || 4);
    },
    duration: function (value) {
      this.durationDraft = Number(value);
      LmsStore.setTransition(this.store.transitionType, Number(value));
    },
    /* O polling de 1s sobrescreve store.volume; setVolumeDragging segura isso
       enquanto o arrasto nao termina. */
    onVolumeInput: function (value) {
      this.volumeDraft = Number(value);
      LmsStore.setVolumeDragging(true);
    },
    setVolumeValue: function (value) {
      this.volumeDraft = Number(value);
      LmsStore.setVolumeDragging(false);
      LmsStore.setVolume(Number(value));
    },
    sleepMinutes: function (minutes) { LmsStore.setSleep(minutes * 60); },
    sleepTrack: function () { LmsStore.sleepAfterTrack(); },
    sleepQueue: function () { LmsStore.sleepAfterQueue(); },
    cancelSleep: function () { LmsStore.setSleep(0); },
    openAdvanced: function () {
      this.ui.advancedSettings = true;
      this.$nextTick(function () {
        this.$el.scrollTop = 0;
        if (this.$refs.advancedBack) this.$refs.advancedBack.focus();
      });
    },
    closeAdvanced: function () {
      this.ui.advancedSettings = false;
      this.$nextTick(function () { this.$el.scrollTop = 0; });
    },
    exportSettings: function () {
      var keys = this.importKeys();
      var data = { version: 1, exportedAt: new Date().toISOString(), values: {} };
      keys.forEach(function (key) {
        var value = localStorage.getItem(key);
        if (value !== null) data.values[key] = value;
      });
      var url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      var link = document.createElement('a');
      link.href = url;
      link.download = 'echo-classic-preferencias.json';
      link.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 0);
      LmsUi.notify('Preferences exported.');
    },
    importKeys: function () {
      return ['echoclassic.ui.v2', 'echoclassic.pins.v1', 'echoclassic.nav.v1',
              'echoclassic.session.v2', 'echoclassic.history.v1'];
    },
    importGroupLabels: function () {
      return {
        'echoclassic.ui.v2': 'Appearance and preferences',
        'echoclassic.pins.v1': 'Pinned items',
        'echoclassic.nav.v1': 'Navigation',
        'echoclassic.session.v2': 'Player session',
        'echoclassic.history.v1': 'Playback history'
      };
    },
    canonicalImportKey: function (key) {
      var match = String(key).match(/^echoclassic\.(ui|pins|nav|session|history)\.(.+)$/);
      return match ? 'echoclassic.' + match[1] + '.' + match[2] : null;
    },
    isPlainObject: function (value) {
      return !!value && typeof value === 'object' && !Array.isArray(value);
    },
    isFrameList: function (value) {
      return Array.isArray(value) && value.every(function (frame) {
        return frame && typeof frame === 'object' && !Array.isArray(frame) &&
          typeof frame.label === 'string';
      }, this);
    },
    /* Validar so o envelope deixava passar um arquivo sintaticamente valido com
       a forma errada — e ai a skin quebrava a cada recarga, sem caminho de
       volta pela interface. A forma de cada chave e conferida aqui. */
	    validateImportValue: function (canonical, raw) {
	      var parsed;
	      try { parsed = JSON.parse(String(raw)); }
	      catch (e) { return 'o conteúdo de ' + canonical + ' não é JSON válido'; }
	      if (canonical === 'echoclassic.ui.v2') {
	        if (!this.isPlainObject(parsed)) return canonical + ' deveria ser um objeto';
	        /* Estas duas listas eram literais duplicados de ui.js. Acrescentar uma
	           aba la quebrava a importacao de preferencias aqui, em silencio: o
	           valor novo era recusado como invalido. Agora derivam da fonte. */
	        var keysOf = function (list) {
	          return list.map(function (entry) { return entry.key; });
	        };
	        var tabs = keysOf(LmsUi.TABS);
	        var views = keysOf(LmsUi.MUSIC_VIEWS);
	        var albumModes = ['albuns', 'tracks'];
	        var playerPresentations = ['adaptive', 'fullscreen'];
	        var playerPositions = ['right', 'left', 'center'];
	        var gaugeStyles = ['flat', 'classic'];
	        var gaugeColors = ['theme', 'blue', 'teal', 'crimson', 'indigo', 'amber'];
	        var colorSchemes = ['blue', 'teal', 'crimson', 'indigo', 'amber'];
	        var fontFamilies = ['system', 'helvetica', 'chicago'];
	        var enums = [
	          ['tab', tabs], ['musicView', views], ['albumMode', albumModes],
	          ['playerPresentation', playerPresentations], ['playerPosition', playerPositions],
	          ['miniGaugeStyle', gaugeStyles], ['playerGaugeStyle', gaugeStyles],
	          ['lightMiniGaugeStyle', gaugeStyles], ['lightPlayerGaugeStyle', gaugeStyles],
	          ['darkMiniGaugeStyle', gaugeStyles], ['darkPlayerGaugeStyle', gaugeStyles],
	          ['miniGaugeColor', gaugeColors], ['playerGaugeColor', gaugeColors],
	          ['colorScheme', colorSchemes], ['fontFamily', fontFamilies]
	        ];
	        for (var e = 0; e < enums.length; e++) {
	          var key = enums[e][0];
	          if (parsed[key] !== undefined && enums[e][1].indexOf(parsed[key]) < 0) {
	            return key + ' tem valor incompatível';
	          }
	        }
	        if (parsed.byView !== undefined && !this.isPlainObject(parsed.byView)) {
	          return 'byView deveria ser um objeto';
	        }
	        return null;
	      }
	      if (canonical === 'echoclassic.pins.v1' || canonical === 'echoclassic.history.v1') {
        if (!Array.isArray(parsed)) return canonical + ' deveria ser uma lista';
        var bad = parsed.some(function (item) { return !this.isPlainObject(item); }, this);
        if (bad) return canonical + ' tem itens que não são objetos';
        return null;
      }
      if (canonical === 'echoclassic.nav.v1') {
        if (!this.isPlainObject(parsed)) return 'echoclassic.nav.v1 deveria ser um objeto';
        var stacks = ['musica', 'playlists', 'radio', 'favoritos'];
        for (var i = 0; i < stacks.length; i++) {
          var stack = parsed[stacks[i]];
          if (stack === undefined) continue;
          if (!this.isFrameList(stack)) {
            return 'a pilha de navegação “' + stacks[i] + '” não é uma lista de telas válidas';
          }
        }
        return null;
      }
      if (!this.isPlainObject(parsed)) return canonical + ' deveria ser um objeto';
      return null;
    },
    importSettings: function (event) {
      var input = event.target;
      var reader = new FileReader();
      var file = input.files && input.files[0];
      if (!file) return;
      var self = this;
      function fail(message) {
        /* Limpar o value em TODOS os caminhos: sem isso, corrigir o arquivo no
           disco e escolher o mesmo nome de novo nao disparava change. */
        input.value = '';
        LmsUi.notify('Could not import: ' + message, 'error', 6500);
      }
      reader.onerror = function () { fail('the file could not be read'); };
      reader.onload = function () {
        var data;
        try { data = JSON.parse(String(reader.result || '')); }
        catch (e) { return fail('the file is not valid JSON'); }
        if (!data || data.version !== 1 || !self.isPlainObject(data.values)) {
          return fail('file incompatible with this version of the skin');
        }
        var accepted = {};
        var keys = Object.keys(data.values);
        for (var i = 0; i < keys.length; i++) {
          var canonical = self.canonicalImportKey(keys[i]);
          if (!canonical || self.importKeys().indexOf(canonical) < 0) continue;
          var problem = self.validateImportValue(canonical, data.values[keys[i]]);
          if (problem) return fail(problem);
          accepted[canonical] = String(data.values[keys[i]]);
        }
        if (!Object.keys(accepted).length) {
          return fail('the file has no Echo Classic preferences');
        }
        self.pendingImport = { version: 1, values: accepted };
        input.value = '';
      };
      reader.readAsText(file);
    },
    /* Guardar o estado atual antes de gravar: a confirmacao promete um caminho
       de volta e ate aqui nao havia nenhum. */
    backupCurrentSettings: function () {
      var snapshot = { version: 1, savedAt: new Date().toISOString(), values: {} };
      this.importKeys().forEach(function (key) {
        var value = localStorage.getItem(key);
        if (value !== null) snapshot.values[key] = value;
      });
      try { localStorage.setItem('echoclassic.import-backup.v1', JSON.stringify(snapshot)); }
      catch (e) {}
    },
    confirmImport: function () {
      if (!this.pendingImport) return;
      this.backupCurrentSettings();
      var values = this.pendingImport.values;
      Object.keys(values).forEach(function (key) {
        try { localStorage.setItem(key, values[key]); }
        catch (e) {}
      });
      location.reload();
    },
    cancelImport: function () { this.pendingImport = null; },
    load: async function () {
      this.loading = true;
      try {
        this.info = await LmsApi.serverInfo();
      } catch (e) {
        this.error = 'Could not read the server: ' + (e && e.message ? e.message : e);
      }
      this.loading = false;
    }
  },
  created: function () { this.load(); }
});
