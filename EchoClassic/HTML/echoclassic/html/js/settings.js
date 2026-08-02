
/* Ajustes. Everything here is either read live from the server or is a real
   switch that changes the interface immediately. Advanced LMS pages remain
   native, but open inside this tab so Echo Classic navigation is preserved. */
Vue.component('lms-settings', {
  template: `
<div class="scroller settings-scroller">
<div v-if="ui.advancedSettings" class="settings advanced-settings-shell">
  <div class="advanced-settings-toolbar">
    <button ref="advancedBack" type="button" class="advanced-back pointer" @click="closeAdvanced">
      <span aria-hidden="true">‹</span> Ajustes
    </button>
    <strong>Configurações do LMS</strong>
    <span aria-hidden="true"></span>
  </div>
  <iframe class="advanced-settings-frame" title="Configurações avançadas do LMS"
          src="/settings/index.html"></iframe>
</div>
<div v-else class="settings">
  <div class="sgh">Player</div>
  <div class="sgroup">
    <button type="button" class="srow settings-command-row pointer"
            :aria-expanded="String(showPlayers)" @click="showPlayers = !showPlayers">
      Player ativo <span class="v">{{ playerName }} ›</span>
    </button>
    <template v-if="showPlayers">
      <div class="player-help">
        Controlar muda o player usado pelo Echo Classic. Transferir leva a reprodução atual.
        Sincronizar faz os dois players tocarem juntos.
      </div>
      <div v-for="p in store.players" :key="p.id" class="player-choice">
        <div class="player-name">
          <strong>{{ p.name }}</strong>
          <span>{{ p.connected ? 'conectado' : 'indisponível' }}</span>
        </div>
        <span v-if="p.id === store.playerId" class="player-current">Em uso</span>
        <template v-else-if="p.connected">
          <button title="Usar este player no Echo Classic" @click.stop="control(p)">Controlar</button>
          <button title="Continuar a reprodução neste player" @click.stop="handoff(p)">Transferir</button>
          <button title="Reproduzir em conjunto com o player atual" @click.stop="sync(p)">Sincronizar</button>
        </template>
      </div>
    </template>
    <div class="srow">Conexão <span class="v">{{ store.connected ? 'conectado' : 'sem player' }}</span></div>
    <label class="srow">Volume
      <input class="setting-range" type="range" min="0" max="100" step="1"
             :value="volumeValue" :disabled="!volumeAdjustable"
             aria-label="Volume do player"
             :title="volumeHint"
             @input="onVolumeInput($event.target.value)"
             @change="setVolumeValue($event.target.value)">
      <span class="v">{{ volumeLabel }}</span></label>
    <div v-if="store.fixedVolume" class="srow" style="min-height:34px">
      <span style="font-size:12px;color:var(--text2)">Ganho unitário até o DAC: o LMS não toca nas amostras. Ajuste o volume no próprio DAC.</span>
    </div>
    <div v-else-if="!store.volumeModeSynced" class="srow" style="min-height:34px">
      <span style="font-size:12px;color:var(--text2)">O LMS ainda não respondeu se este player usa volume por software. Escolha o player em “Player ativo” ou toque em “Tentar novamente” na barra de conexão para consultar de novo.</span>
    </div>
  </div>

  <div class="sgh">Reprodução</div>
  <div class="sgroup">
    <label class="srow">Transição
      <select class="setting-select transition-select" :value="store.transitionType" @change="transition($event.target.value)">
        <option value="0">Sem transição / gapless</option>
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
      Temporizador
      <div class="inline-commands">
        <button @click="sleepMinutes(15)">15 minutos</button>
        <button @click="sleepMinutes(30)">30 minutos</button>
        <button @click="sleepMinutes(60)">1 hora</button>
      </div>
    </div>
    <div class="srow sleep-row">
      Parar ao terminar
      <div class="inline-commands">
        <button :disabled="!canSleepAtEnd" :title="sleepAtEndHint"
                @click="sleepTrack">Esta música</button>
        <button :disabled="!canSleepAtEnd" :title="sleepAtEndHint"
                @click="sleepQueue">A fila</button>
        <button v-if="store.sleepRemaining" @click="cancelSleep">Cancelar</button>
      </div>
    </div>
    <div v-if="!canSleepAtEnd" class="srow" style="min-height:34px">
      <span style="font-size:12px;color:var(--text2)">{{ sleepAtEndHint }}</span>
    </div>
    <div v-if="store.sleepRemaining" class="srow">
      Desligamento programado <span class="v">{{ sleepLabel }}</span>
    </div>
  </div>

  <div class="sgh">Aparência</div>
  <div class="sgroup">
    <div class="srow">Tema
      <span class="v">{{ ui.dark ? 'escuro' : 'claro' }}</span>
      <button type="button" class="sw" :class="{on: ui.dark}" role="switch"
              :aria-checked="String(ui.dark)" aria-label="Tema escuro"
              @click="toggleTheme"><span class="visually-hidden">Tema escuro</span></button></div>
    <div class="srow">Taxa e bits na barra inferior
      <button type="button" class="sw" :class="{on: ui.showBadges}" role="switch"
              :aria-checked="String(ui.showBadges)" aria-label="Taxa e bits na barra inferior"
              @click="preference('showBadges')"><span class="visually-hidden">Taxa e bits na barra inferior</span></button></div>
    <div class="srow">Destacar hi-res
      <button type="button" class="sw" :class="{on: ui.markHires}" role="switch"
              :aria-checked="String(ui.markHires)" aria-label="Destacar áudio de alta resolução"
              @click="preference('markHires')"><span class="visually-hidden">Destacar áudio de alta resolução</span></button></div>
  </div>

  <div class="sgh">Esquema de cores</div>
  <div class="sgroup color-scheme-group" role="radiogroup" aria-label="Esquema de cores">
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

  <div class="sgh">Fontes</div>
  <div class="sgroup font-option-group" role="radiogroup" aria-label="Fontes">
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

  <div class="sgh">Barras de progresso</div>
  <div class="sgroup gauge-settings-group">
    <div class="player-help">
      O estilo é lembrado separadamente para cada tema. O que você escolher aqui
      vale para o tema {{ ui.dark ? 'escuro' : 'claro' }}; o outro tema mantém o dele.
    </div>
    <div class="srow gauge-style-row">
      <span>Estilo no mini player ({{ ui.dark ? 'tema escuro' : 'tema claro' }})</span>
      <div class="gauge-segmented" role="radiogroup"
           :aria-label="'Estilo da barra de progresso do mini player no tema ' + (ui.dark ? 'escuro' : 'claro')">
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
           :aria-label="'Estilo da barra de progresso do player completo no tema ' + (ui.dark ? 'escuro' : 'claro')">
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

  <div class="sgh">Layout do player completo</div>
  <div class="sgroup player-presentation-group" role="radiogroup"
       aria-label="Layout do player completo">
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
          ? 'Coluna em telas largas; sobreposição nas compactas'
          : 'Sempre ocupa toda a tela' }}</small>
      </span>
      <span class="font-option-check" aria-hidden="true"></span>
    </button>
  </div>

  <div class="sgh">Segurança e compatibilidade</div>
  <div class="sgroup">
    <div class="srow">Controles na tela bloqueada
      <span class="v">{{ mediaSessionSupported ? 'disponíveis' : 'não suportados neste navegador' }}</span>
    </div>
    <div class="srow settings-actions">
      Preferências da skin
      <span class="inline-commands">
        <button @click="exportSettings">Exportar</button>
        <button @click="$refs.importFile.click()">Importar</button>
      </span>
      <input ref="importFile" class="visually-hidden" type="file" accept="application/json"
             tabindex="-1" aria-hidden="true"
             @change="importSettings">
    </div>
    <div v-if="pendingImport" class="import-confirm" role="alert">
      <strong>Importar preferências deste arquivo?</strong>
      <span>Serão substituídos apenas estes grupos: {{ pendingImportGroups.join(', ') }}.
        O que não estiver no arquivo continua como está. Uma cópia do estado atual
        fica guardada no navegador antes da gravação. A página recarrega em seguida.</span>
      <div class="inline-commands">
        <button @click="confirmImport">Importar e recarregar</button>
        <button @click="cancelImport">Cancelar</button>
      </div>
    </div>
  </div>

  <div class="sgh">Biblioteca</div>
  <div class="sgroup">
    <div v-if="loading" class="srow"><span style="color:var(--text2)">Consultando o servidor…</span></div>
    <template v-else-if="info">
      <div class="srow">Artistas <span class="v">{{ n(info.artists) }}</span></div>
      <div class="srow">Álbuns <span class="v">{{ n(info.albums) }}</span></div>
      <div class="srow">Músicas <span class="v">{{ n(info.songs) }}</span></div>
      <div class="srow">Gêneros <span class="v">{{ n(info.genres) }}</span></div>
    </template>
    <div v-else class="srow"><span style="color:var(--text2)">{{ error }}</span></div>
  </div>

  <div class="sgh">Servidor</div>
  <div class="sgroup">
    <button type="button" class="srow settings-command-row pointer"
            :aria-expanded="String(ui.advancedSettings)" @click="openAdvanced">
      Configurações avançadas do LMS <span class="v">›</span>
    </button>
    <div class="srow">Versão do servidor <span class="v">LMS {{ info ? info.version : '—' }}</span></div>
    <div class="srow">Versão da skin <span class="v">{{ skinVersion }}</span></div>
  </div>

  <div class="sgh" style="text-transform:none">
    As páginas nativas do LMS abrem dentro dos Ajustes, preservando a navegação
    do Echo Classic.
  </div>
</div>
</div>`,
  data: function () {
    return {
      ui: LmsUi.state, store: LmsStore.state,
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
      if (this.store.fixedVolume) return 'fixo — escala cheia';
      if (!this.store.volumeModeSynced) return 'não confirmado';
      return this.volumeValue + '%';
    },
    volumeHint: function () {
      if (this.store.fixedVolume) return 'Saída fixa: o volume é ajustado no DAC.';
      if (!this.store.connected) return 'Nenhum player conectado.';
      if (!this.store.volumeModeSynced) return 'O LMS ainda não confirmou o modo de volume deste player.';
      return 'Volume do player';
    },
    /* "Esta música" com nada tocando vira `sleep 1` no store (Math.max(1, 0-0))
       e desliga o player em um segundo. Sem reproducao nao ha "terminar". */
    canSleepAtEnd: function () {
      return this.store.connected && this.store.mode !== 'stop';
    },
    /* Vai para um :title, que e binding dinamico e portanto nao passa pela
       reescrita de template. A traducao acontece aqui. */
    sleepAtEndHint: function () {
      var text = this.canSleepAtEnd ? 'Desligar quando esta reprodução terminar'
        : 'Disponível durante a reprodução: sem nada tocando não há fim para esperar.';
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
      LmsUi.notify('Preferências exportadas.');
    },
    importKeys: function () {
      return ['echoclassic.ui.v2', 'echoclassic.pins.v1', 'echoclassic.nav.v1',
              'echoclassic.session.v2', 'echoclassic.history.v1'];
    },
    importGroupLabels: function () {
      return {
        'echoclassic.ui.v2': 'Aparência e preferências',
        'echoclassic.pins.v1': 'Itens fixados',
        'echoclassic.nav.v1': 'Navegação',
        'echoclassic.session.v2': 'Sessão do player',
        'echoclassic.history.v1': 'Histórico de reprodução'
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
	        var tabs = ['favoritos', 'radio', 'playlists', 'musica', 'ajustes'];
	        var views = ['recentes', 'artistas', 'albuns', 'generos', 'anos'];
	        var albumModes = ['albuns', 'faixas'];
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
	        if (parsed.sortByView !== undefined && !this.isPlainObject(parsed.sortByView)) {
	          return 'sortByView deveria ser um objeto';
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
        LmsUi.notify('Não foi possível importar: ' + message, 'error', 6500);
      }
      reader.onerror = function () { fail('o arquivo não pôde ser lido'); };
      reader.onload = function () {
        var data;
        try { data = JSON.parse(String(reader.result || '')); }
        catch (e) { return fail('o arquivo não é JSON válido'); }
        if (!data || data.version !== 1 || !self.isPlainObject(data.values)) {
          return fail('arquivo incompatível com esta versão da skin');
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
          return fail('o arquivo não traz nenhuma preferência do Echo Classic');
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
        this.error = 'Não deu para ler o servidor: ' + (e && e.message ? e.message : e);
      }
      this.loading = false;
    }
  },
  created: function () { this.load(); }
});
