
var ECHOCLASSIC_ADVANCED_THEME_TOKENS = [
  '--accent', '--chrome', '--content', '--selected', '--text', '--text2',
  '--hair', '--field', '--accent-ink', '--group-page', '--group-bg',
  '--group-head', '--sw-off', '--sw-on', '--knob', '--destructive',
  '--picker-bg', '--shadow', '--app-font'
];

/* SPL-3: the three player surfaces as the screen names them. The stored keys
   are untouched -- fullTheme, smallTheme, miniTheme and the rest keep every
   name -- only the wording changes, because "Small player" and "Mini player"
   say nothing about where either one appears, and the basic layout task has
   to be doable without knowing the internal names at all. */
var ECHOCLASSIC_PLAYER_SURFACES = [
  { key: 'full', label: 'Full player' },
  { key: 'small', label: 'Side panel' },
  { key: 'mini', label: 'Bottom bar' }
];

var ECHOCLASSIC_SCAN_JOURNAL_KEY = 'echoclassic.scan-errors.v1';
var ECHOCLASSIC_SCAN_JOURNAL_LIMIT = 100;

/* Ajustes. Everything here is either read live from the server or is a real
   switch that changes the interface immediately. Advanced LMS pages still
   submit through the server's own controls; Echo Classic skins that real form
   inside the iframe so the visible screen stays in this skin. */
Vue.component('lms-settings', {
  template: `
<div class="scroller settings-scroller">
<div v-if="ui.advancedSettings" class="settings advanced-settings-shell">
  <iframe ref="advancedFrame" class="advanced-settings-frame" title="" aria-label="Advanced LMS settings"
          @load="themeAdvancedFrame"
          :src="advancedFrameSrc"></iframe>
</div>
<div v-else-if="ui.appearanceScreen" class="settings appearance-detail">
  <template v-if="ui.appearanceScreen === 'players'">
    <!-- SPL-3: uma tela, tres perguntas em ordem de tarefa.
         Antes: tres formularios longos e repetidos (Full player, Small player,
         Mini player), com "Match app appearance" aparecendo tres vezes, 9
         radiogroups, 40 opcoes visiveis e 16 amostras de cor -- 1.723px de
         conteudo num scroller de 656px em 390x844, com Small e Mini varias
         telas abaixo. Agora: Layout sempre visivel, Aparencia resumida, e o
         detalhe por superficie atras de uma unica divulgacao. Nenhuma chave
         gravada mudou de nome. -->
    <div class="sgh">Layout</div>
    <div class="sgroup">
      <div class="srow segmented-row">
        <span>Presentation</span>
        <div class="segmented" role="radiogroup" aria-label="Presentation">
          <button v-for="mode in playerPresentations" :key="'pres-' + mode.key" type="button"
                  role="radio" :aria-checked="ui.playerPresentation === mode.key ? 'true' : 'false'"
                  :tabindex="ui.playerPresentation === mode.key ? 0 : -1"
                  :class="{on: ui.playerPresentation === mode.key}"
                  @keydown="radioKey($event, playerPresentations, ui.playerPresentation, playerPresentation)"
                  @click="playerPresentation(mode.key)">{{ mode.label }}</button>
        </div>
      </div>
      <div class="player-help">{{ presentationHelp }}</div>
      <!-- Posicao e consequencia da apresentacao Adaptive, entao mora ao lado
           dela em vez de virar uma secao "Small player" a parte. -->
      <div v-if="ui.playerPresentation === 'adaptive'" class="srow segmented-row">
        <span>Panel position</span>
        <div class="segmented" role="radiogroup" aria-label="Panel position">
          <button v-for="position in playerPositions" :key="'pos-' + position.key" type="button"
                  role="radio" :aria-checked="ui.playerPosition === position.key ? 'true' : 'false'"
                  :tabindex="ui.playerPosition === position.key ? 0 : -1"
                  :class="{on: ui.playerPosition === position.key}"
                  @keydown="radioKey($event, playerPositions, ui.playerPosition, setPlayerPosition)"
                  @click="setPlayerPosition(position.key)">{{ position.label }}</button>
        </div>
      </div>
    </div>

    <div class="sgh">Appearance</div>
    <div class="sgroup">
      <div class="srow">Match app appearance
        <button type="button" class="sw" :class="{on: allSurfacesFollowApp}" role="switch"
                :aria-checked="String(allSurfacesFollowApp)"
                aria-label="Match app appearance on every player surface"
                @click="setAllSurfacesFollowApp(!allSurfacesFollowApp)"><span class="visually-hidden">Match app appearance on every player surface</span></button>
      </div>
      <div class="player-help">{{ appearanceSummary }}</div>
      <button type="button" class="srow settings-command-row pointer"
              :aria-expanded="String(advancedAppearance)"
              @click="advancedAppearance = !advancedAppearance">
        Customize player appearance <span class="v">{{ advancedAppearance ? '⌄' : '›' }}</span>
      </button>
    </div>

    <template v-if="advancedAppearance">
      <div class="sgh">{{ surfaceLabel }}</div>
      <div class="sgroup">
        <div class="srow segmented-row surface-select-row">
          <div class="segmented" role="radiogroup" aria-label="Player surface">
            <button v-for="surface in playerSurfaces" :key="'surface-' + surface.key" type="button"
                    role="radio" :aria-checked="appearanceSurface === surface.key ? 'true' : 'false'"
                    :tabindex="appearanceSurface === surface.key ? 0 : -1"
                    :class="{on: appearanceSurface === surface.key}"
                    @keydown="radioKey($event, playerSurfaces, appearanceSurface, setAppearanceSurface)"
                    @click="setAppearanceSurface(surface.key)">{{ surface.label }}</button>
          </div>
        </div>
        <div class="srow">Use app appearance
          <button type="button" class="sw" :class="{on: surfaceFollowsApp}" role="switch"
                  :aria-checked="String(surfaceFollowsApp)" :aria-label="surfaceFollowLabel"
                  @click="setSurfaceFollowsApp(!surfaceFollowsApp)"><span class="visually-hidden">{{ surfaceFollowLabel }}</span></button>
        </div>
        <template v-if="!surfaceFollowsApp">
          <div class="srow segmented-row">
            <span>Theme</span>
            <div class="segmented" role="radiogroup" :aria-label="surfaceThemeLabel">
              <button v-for="option in themeOptions" :key="'surface-theme-' + option.key" type="button"
                      role="radio" :aria-checked="surfaceTheme === option.key ? 'true' : 'false'"
                      :tabindex="surfaceTheme === option.key ? 0 : -1"
                      :class="{on: surfaceTheme === option.key}"
                      @keydown="radioKey($event, themeOptions, surfaceTheme, setSurfaceTheme)"
                      @click="setSurfaceTheme(option.key)">{{ option.label }}</button>
            </div>
          </div>
          <div class="srow">Accent
            <div class="swatch-row" role="radiogroup" :aria-label="surfaceAccentLabel">
              <button v-for="scheme in colorSchemes" :key="'surface-accent-' + scheme.key" type="button"
                      class="swatch-dot" :class="'scheme-' + scheme.key"
                      role="radio" :aria-checked="surfaceScheme === scheme.key ? 'true' : 'false'"
                      :aria-label="tr(scheme.label)"
                      :tabindex="surfaceScheme === scheme.key ? 0 : -1"
                      @keydown="radioKey($event, colorSchemes, surfaceScheme, setSurfaceScheme)"
                      @click="setSurfaceScheme(scheme.key)"></button>
            </div>
          </div>
        </template>
      </div>
      <div v-if="!surfaceFollowsApp" class="sgroup font-option-group" role="radiogroup"
           :aria-label="surfaceFontLabel">
        <button v-for="font in fontOptions" :key="'surface-font-' + font.key" type="button"
                class="srow font-option-row" :class="'font-' + font.key"
                role="radio" :aria-checked="surfaceFont === font.key ? 'true' : 'false'"
                :tabindex="surfaceFont === font.key ? 0 : -1"
                @keydown="radioKey($event, fontOptions, surfaceFont, setSurfaceFont)"
                @click="setSurfaceFont(font.key)">
          <span class="font-option-label">{{ font.label }}</span>
          <span class="font-option-check" aria-hidden="true"></span>
        </button>
      </div>

      <!-- A barra do painel lateral e a mesma do player cheio: uma secao so,
           sob Full player, e uma frase sob Side panel dizendo onde ela mora. -->
      <template v-if="appearanceSurface === 'full'">
        <div class="sgh">Progress bar</div>
        <div class="sgroup">
          <div class="srow segmented-row">
            <span>{{ playerGaugeStyleLabel }}</span>
            <div class="segmented" role="radiogroup" :aria-label="playerGaugeStyleLabel">
              <button v-for="style in gaugeStyles" :key="'full-player-' + style.key" type="button"
                      role="radio" :aria-checked="ui.playerGaugeStyle === style.key ? 'true' : 'false'"
                      :tabindex="ui.playerGaugeStyle === style.key ? 0 : -1"
                      :class="{on: ui.playerGaugeStyle === style.key}"
                      @keydown="radioKey($event, gaugeStyles, ui.playerGaugeStyle, playerGaugeStyle)"
                      @click="playerGaugeStyle(style.key)">{{ style.label }}</button>
            </div>
          </div>
          <div class="srow">Bar colour
            <div class="swatch-row" role="radiogroup" aria-label="Full player colour">
              <button v-for="color in gaugeColors" :key="'full-color-' + color.key" type="button"
                      class="swatch-dot" :class="color.key === 'theme' ? 'gauge-color-theme' : ('scheme-' + color.key)"
                      role="radio" :aria-checked="ui.playerGaugeColor === color.key ? 'true' : 'false'"
                      :aria-label="tr(color.label)"
                      :tabindex="ui.playerGaugeColor === color.key ? 0 : -1"
                      @keydown="radioKey($event, gaugeColors, ui.playerGaugeColor, setPlayerGaugeColor)"
                      @click="setPlayerGaugeColor(color.key)"></button>
            </div>
          </div>
          <div class="player-help">Also applies to the side panel.</div>
          <div class="player-help">Bar style is remembered per theme.</div>
        </div>
      </template>
      <template v-else-if="appearanceSurface === 'small'">
        <div class="sgroup">
          <div class="player-help">Progress bar settings are shared with Full player.</div>
        </div>
      </template>
      <template v-else>
        <div class="sgh">Progress bar</div>
        <div class="sgroup">
          <div class="srow segmented-row">
            <span>{{ miniGaugeStyleLabel }}</span>
            <div class="segmented" role="radiogroup" :aria-label="miniGaugeStyleLabel">
              <button v-for="style in gaugeStyles" :key="'mini-only-' + style.key" type="button"
                      role="radio" :aria-checked="ui.miniGaugeStyle === style.key ? 'true' : 'false'"
                      :tabindex="ui.miniGaugeStyle === style.key ? 0 : -1"
                      :class="{on: ui.miniGaugeStyle === style.key}"
                      @keydown="radioKey($event, gaugeStyles, ui.miniGaugeStyle, miniGaugeStyle)"
                      @click="miniGaugeStyle(style.key)">{{ style.label }}</button>
            </div>
          </div>
          <div class="srow">Bar colour
            <div class="swatch-row" role="radiogroup" aria-label="Bottom bar colour">
              <button v-for="color in gaugeColors" :key="'mini-color-' + color.key" type="button"
                      class="swatch-dot" :class="color.key === 'theme' ? 'gauge-color-theme' : ('scheme-' + color.key)"
                      role="radio" :aria-checked="ui.miniGaugeColor === color.key ? 'true' : 'false'"
                      :aria-label="tr(color.label)"
                      :tabindex="ui.miniGaugeColor === color.key ? 0 : -1"
                      @keydown="radioKey($event, gaugeColors, ui.miniGaugeColor, setMiniGaugeColor)"
                      @click="setMiniGaugeColor(color.key)"></button>
            </div>
          </div>
          <div class="player-help">Bar style is remembered per theme.</div>
        </div>
      </template>
    </template>
  </template>
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
        Control changes which player Echo Classic uses. Transfer moves the current playback.
        Sync makes both players play together.
      </div>
      <div v-for="p in store.players" :key="p.id" class="player-choice">
        <div class="player-name">
          <strong>{{ p.name }}</strong>
          <span>{{ p.connected ? 'connected' : 'unavailable' }}</span>
        </div>
        <span v-if="p.id === store.playerId" class="player-current">In use</span>
        <template v-else-if="p.connected">
          <button title="Use this player in Echo Classic" @click.stop="control(p)">Control</button>
          <button title="Continue playback on this player" @click.stop="handoff(p)">Transfer</button>
          <button title="Play together with the current player" @click.stop="sync(p)">Sync</button>
        </template>
      </div>
    </template>
    <button type="button" class="srow settings-command-row pointer"
            :aria-expanded="String(showDefaultPlayer)" @click="showDefaultPlayer = !showDefaultPlayer">
      Default player
      <span class="v">{{ defaultPlayerName }}<template v-if="defaultPlayerNote"> · {{ defaultPlayerNote }}</template> ›</span>
    </button>
    <template v-if="showDefaultPlayer">
      <div class="player-help">
        Choose which player Echo Classic connects to when it starts. “Last used” follows whichever player you pick, even after a refresh.
      </div>
      <button type="button" class="srow player-presentation-row"
              role="radio" :aria-checked="ui.defaultPlayer === 'last' ? 'true' : 'false'"
              :tabindex="ui.defaultPlayer === 'last' ? 0 : -1"
              @keydown="radioKey($event, defaultPlayerOptions, ui.defaultPlayer, defaultPlayer)"
              @click="defaultPlayer('last')">
        <span class="player-presentation-copy"><span>Last used</span></span>
        <span class="font-option-check" aria-hidden="true"></span>
      </button>
      <button v-for="p in store.players" :key="p.id" type="button" class="srow player-presentation-row"
              role="radio" :aria-checked="ui.defaultPlayer === p.id ? 'true' : 'false'"
              :tabindex="ui.defaultPlayer === p.id ? 0 : -1"
              @keydown="radioKey($event, defaultPlayerOptions, ui.defaultPlayer, defaultPlayer)"
              @click="defaultPlayer(p.id)">
        <span class="player-presentation-copy">
          <span>{{ p.name }}</span>
          <small v-if="!p.connected">{{ playerStatusLabel(p) }}</small>
        </span>
        <span class="font-option-check" aria-hidden="true"></span>
      </button>
    </template>
  </div>

  <div class="sgh">Playback</div>
  <div class="sgroup">
    <div class="srow">Crossfade
      <button type="button" class="sw" :class="{on: !!store.transitionType}" role="switch"
              :aria-checked="String(!!store.transitionType)" aria-label="Crossfade"
              @click="toggleCrossfade"><span class="visually-hidden">Crossfade</span></button></div>
    <div class="player-help">{{ crossfadeHint }}</div>
    <label v-if="store.transitionType" class="srow">Duration
      <input class="setting-range" type="range" min="1" max="12"
             :value="durationValue"
             @input="durationDraft = Number($event.target.value)"
             @change="duration($event.target.value)">
      <span class="v">{{ durationValue }} seconds</span>
    </label>
    <div class="srow segmented-row">
      <span>Replay gain</span>
      <div class="segmented" role="radiogroup" aria-label="Replay gain">
        <button v-for="option in replayGainModes" :key="'rg-' + option.key" type="button"
                role="radio" :aria-checked="store.replayGainMode === option.key ? 'true' : 'false'"
                :tabindex="store.replayGainMode === option.key ? 0 : -1"
                :class="{on: store.replayGainMode === option.key}"
                :disabled="!store.playerId"
                @keydown="radioKey($event, replayGainModes, store.replayGainMode, selectReplayGain)"
                @click="selectReplayGain(option.key)">{{ tr(option.label) }}</button>
      </div>
    </div>
    <div class="player-help">{{ replayGainHint }}</div>
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
      Sleep timer <span class="v">{{ sleepLabel }}</span>
    </div>
  </div>

  <div class="sgh">Appearance</div>
  <div class="sgroup">
    <div class="srow segmented-row">
      <span>Theme</span>
      <div class="segmented" role="radiogroup" aria-label="Theme">
        <button v-for="option in themeOptions" :key="'app-theme-' + option.key" type="button"
                role="radio" :aria-checked="ui.theme === option.key ? 'true' : 'false'"
                :tabindex="ui.theme === option.key ? 0 : -1"
                :class="{on: ui.theme === option.key}"
                @keydown="radioKey($event, themeOptions, ui.theme, selectTheme)"
                @click="selectTheme(option.key)">{{ option.label }}</button>
      </div>
    </div>
    <div class="srow">Accent colour
      <div class="swatch-row" role="radiogroup" aria-label="Accent colour">
        <button v-for="scheme in colorSchemes" :key="scheme.key" type="button"
                class="swatch-dot" :class="'scheme-' + scheme.key"
                role="radio" :aria-checked="ui.colorScheme === scheme.key ? 'true' : 'false'"
                :aria-label="tr(scheme.label)"
                :tabindex="ui.colorScheme === scheme.key ? 0 : -1"
                @keydown="radioKey($event, colorSchemes, ui.colorScheme, colorScheme)"
                @click="colorScheme(scheme.key)"></button>
      </div>
    </div>
  </div>
  <div class="sgh">Font</div>
  <div class="sgroup font-option-group" role="radiogroup" aria-label="Font">
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
  <div class="sgroup">
    <button type="button" class="srow settings-command-row pointer" @click="openAppearanceScreen('players')">
      Player layout <span class="v">›</span>
    </button>
  </div>

  <div class="sgh">Queue</div>
  <div class="sgroup">
    <div class="player-help">
      Choose how often album art repeats in the playback queue.
    </div>
  </div>
  <div class="sgroup player-presentation-group" role="radiogroup" aria-label="Queue artwork">
    <button v-for="mode in queueArtModes" :key="mode.key" type="button"
            class="srow player-presentation-row"
            role="radio" :aria-checked="ui.queueArtMode === mode.key ? 'true' : 'false'"
            :tabindex="ui.queueArtMode === mode.key ? 0 : -1"
            @keydown="radioKey($event, queueArtModes, ui.queueArtMode, queueArtMode)"
            @click="queueArtMode(mode.key)">
      <span class="player-presentation-copy">
        <span>{{ mode.label }}</span>
        <small>{{ queueArtModeHint(mode.key) }}</small>
      </span>
      <span class="font-option-check" aria-hidden="true"></span>
    </button>
  </div>

  <div class="sgh">General</div>
  <div class="sgroup">
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

  <div class="sgh">Backup</div>
  <div class="sgroup">
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
      <span>Only these groups will be replaced: {{ pendingImportGroups.join(', ') }}.
        <span>Anything not in the file stays as it is. A copy of the current state
        is kept in the browser before the write happens. The page reloads afterwards.</span>
      </span>
      <div class="inline-commands">
        <button @click="confirmImport">Import and reload</button>
        <button @click="cancelImport">Cancel</button>
      </div>
    </div>
  </div>

  <div class="sgh">About</div>
  <div class="sgroup">
    <div class="srow">Connection <span class="v">{{ store.connected ? 'connected' : 'no player' }}</span></div>
    <div v-if="loading" class="srow"><span style="color:var(--text2)">Querying the server…</span></div>
    <template v-else-if="info">
      <div class="srow">Artists <span class="v">{{ n(info.artists) }}</span></div>
      <div class="srow">Albums <span class="v">{{ n(info.albums) }}</span></div>
      <div class="srow">Songs <span class="v">{{ n(info.songs) }}</span></div>
      <div class="srow">Genres <span class="v">{{ n(info.genres) }}</span></div>
    </template>
    <div v-else class="srow"><span style="color:var(--text2)">{{ error }}</span></div>
    <div class="srow">Server version <span class="v">LMS {{ info ? info.version : '—' }}</span></div>
    <div class="srow">Skin version <span class="v">{{ skinVersion }}</span></div>
    <div class="srow">Lock screen controls
      <span class="v">{{ mediaSessionSupported ? 'available' : 'not supported in this browser' }}</span>
    </div>
    <button type="button" class="srow settings-command-row pointer"
            :aria-expanded="String(ui.advancedSettings)" @click="openAdvanced">
      Advanced LMS settings <span class="v">›</span>
    </button>
  </div>

  <div class="sgh" style="text-transform:none">
    Native LMS pages open inside Settings, keeping Echo Classic navigation.
  </div>
</div>
</div>`,
  data: function () {
    return {
      ui: LmsUi.state, store: LmsStore.state,
      /* Pilha de navegacao dos Ajustes -- exclusivamente em memoria (nav.js
         nao persiste 'settings'), o mesmo tratamento do appearanceScreen que
         ela mantem sincronizado no watch abaixo. */
      nav: LmsNav.stacks,
      /* LmsStr existe sempre; a lista traz pelo menos o ingles, mesmo num
         servidor onde o strings.txt nao pode ser lido. */
      languages: (window.LmsStr && LmsStr.languages) ? LmsStr.languages() : [{ key: 'EN', label: 'English' }],
      currentLanguage: (window.LmsStr && LmsStr.lang) || 'EN',
      colorSchemes: LmsUi.COLOR_SCHEMES,
      fontOptions: LmsUi.FONT_OPTIONS,
      themeOptions: LmsUi.THEME_OPTIONS,
      replayGainModes: LmsUi.REPLAY_GAIN_MODES,
      playerPositions: LmsUi.PLAYER_POSITIONS,
      playerPresentations: LmsUi.PLAYER_PRESENTATIONS,
      gaugeStyles: LmsUi.GAUGE_STYLES,
      gaugeColors: LmsUi.GAUGE_COLORS,
      queueArtModes: LmsUi.QUEUE_ART_MODES,
      info: null, loading: true, error: '', showPlayers: false,
      showDefaultPlayer: false,
      playerSurfaces: ECHOCLASSIC_PLAYER_SURFACES,
      /* Session-only, like showPlayers/showDefaultPlayer above, and
         deliberately outside persist()/export: which panel someone had open
         is not a preference, and reopening Player layout on the summary is
         the whole point of the summary. */
      advancedAppearance: false,
      appearanceSurface: 'full',
      pendingImport: null,
      settingsReturnScroll: 0,
      appearanceReturnScroll: 0,
      advancedSettingsDirty: false,
      advancedSettingsPage: '',
      advancedThemeObserver: null,
      /* Rascunho local: o numero ao lado do slider tem de acompanhar o
         arrasto, nao esperar o round-trip com o servidor. */
      durationDraft: null
    };
  },
  computed: {
    advancedFrameSrc: function () {
      var requested = String(this.ui.advancedSettingsPage || '');
      return /^\/echoclassic\/settings\/server\/[a-z0-9_-]+\.html$/i.test(requested)
        ? requested : '/echoclassic/settings/server/basic.html';
    },
    playerName: function () {
      var id = this.store.playerId;
      var found = (this.store.players || []).filter(function (p) { return p.id === id; })[0];
      return found ? found.name : 'none';
    },
    /* AUDIT-1b: preferencia gravada em ui.js, resolvida em LmsStore ao
       descobrir o player -- esta linha so mostra o que esta configurado.
       Nome de player vem do servidor e nao passa por tradução; so o texto
       fixo ('Last used', 'Unknown player') vai para o dicionario. */
    defaultPlayerOptions: function () {
      return [{ key: 'last' }].concat((this.store.players || []).map(function (p) {
        return { key: p.id };
      }));
    },
    defaultPlayerFound: function () {
      if (this.ui.defaultPlayer === 'last') return null;
      return (this.store.players || []).filter(function (p) {
        return p.id === this.ui.defaultPlayer;
      }, this)[0] || null;
    },
    defaultPlayerName: function () {
      if (this.ui.defaultPlayer === 'last') return 'Last used';
      var found = this.defaultPlayerFound;
      return found ? found.name : 'Unknown player';
    },
    /* Um default configurado que nao esta em uso precisa dizer por que --
       sem isto o usuario ve um nome que nao esta tocando e nao sabe se a
       escolha "pegou". "Last used" nunca leva nota: e sempre o que esta
       valendo, por definicao. */
    defaultPlayerNote: function () {
      if (this.ui.defaultPlayer === 'last') return '';
      return this.playerStatusLabel(this.defaultPlayerFound || { connected: false, power: false });
    },
    skinVersion: function () {
      return typeof LMS_SKIN_VERSION === 'string' && LMS_SKIN_VERSION ? LMS_SKIN_VERSION : '—';
    },
    sleepLabel: function () { return LmsFmt.longDuration(this.store.sleepRemaining); },
    mediaSessionSupported: function () { return !!navigator.mediaSession; },
    durationValue: function () {
      return this.durationDraft === null ? (this.store.transitionDuration || 4) : this.durationDraft;
    },
    /* Built whole rather than glued around an interpolation: translateTemplate
       matches a text node against the dictionary, and a sentence split by
       {{ }} can never match. That is exactly how these two stayed Portuguese
       in an English session.
       gaugeHelp (the explanatory sentence itself) died with the Progress bars
       screen in C5 -- ui.playerGaugeStyle/playerGaugeColor and
       ui.miniGaugeStyle/miniGaugeColor stay reachable through the Full and
       Mini branches below, which already carry their own Progress bar rows
       and never depended on gaugeHelp; only the explanatory copy is missing
       for one commit, until C6 lands it as a footer under those same rows
       (phase2-decisions.md, D-2). */
    miniGaugeStyleLabel: function () {
      if (this.ui.theme === 'legacy') return this.tr('Mini player style (Legacy theme)');
      return this.tr(this.ui.theme === 'dark' ? 'Mini player style (dark theme)' : 'Mini player style (light theme)');
    },
    playerGaugeStyleLabel: function () {
      if (this.ui.theme === 'legacy') return this.tr('Full player style (Legacy theme)');
      return this.tr(this.ui.theme === 'dark' ? 'Full player style (dark theme)' : 'Full player style (light theme)');
    },
    crossfadeHint: function () {
      return this.tr(this.store.transitionType
        ? 'On: crossfade — the end of one song blends into the start of the next'
        : 'Off: gapless playback — songs join with no gap and no blend');
    },
    /* Uma frase inteira por modo, nunca montada por concatenacao: o dicionario
       e indexado pela frase inglesa completa, entao juntar pedacos deixa o
       texto permanentemente sem traducao. E o que EC-005/I18N-01 corrigiram
       em actions.js e na fila. */
    replayGainHint: function () {
      if (!this.store.playerId) {
        return this.tr('Available when a player is connected.');
      }
      if (this.store.replayGainMode === 1) {
        return this.tr('Track: every song plays at a similar loudness.');
      }
      if (this.store.replayGainMode === 2) {
        return this.tr('Album: loudness differences within an album are kept.');
      }
      if (this.store.replayGainMode === 3) {
        return this.tr('Smart: album gain for a whole album, track gain when shuffling.');
      }
      return this.tr('Off: every recording plays at the loudness it was mastered at.');
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
      return names.length ? names : ['no recognised group'];
    },
    /* C6: the nine "Follow app" option rows (themeOptionsWithApp/
       colorSchemeOptionsWithApp/fontOptionsWithApp, one prepended 'app' entry
       each) are gone -- a "Match app appearance" toggle reads/drives all three
       of a surface's keys at once through LmsUi.surfaceFollowsApp/
       setSurfaceFollowsApp, and the custom rows it reveals reuse the plain
       themeOptions/colorSchemes/fontOptions lists with no 'app' entry, because
       a real value is always seeded into them the moment the toggle goes off
       (setSurfaceFollowsApp, below). */
    /* SPL-3: one summary instead of three identical switches. The master is
       ON only when all three surfaces follow the app; when some do and some
       do not, it reads OFF and the helper says so. No indeterminate ARIA
       switch -- the disclosure below exposes the exact per-surface state. */
    allSurfacesFollowApp: function () {
      return LmsUi.surfaceFollowsApp('full') && LmsUi.surfaceFollowsApp('small') &&
             LmsUi.surfaceFollowsApp('mini');
    },
    appearanceSummary: function () {
      return this.allSurfacesFollowApp
        ? 'All player surfaces use the app theme, accent and font.'
        : 'Some player surfaces use custom appearance.';
    },
    presentationHelp: function () {
      return this.ui.playerPresentation === 'adaptive'
        ? 'Uses a side panel on larger screens and full screen on phones.'
        : 'Always opens over the app.';
    },
    surfaceLabel: function () {
      var found = this.playerSurfaces.filter(function (surface) {
        return surface.key === this.appearanceSurface;
      }, this)[0];
      return found ? found.label : '';
    },
    /* Every control inside the disclosure names its scope: three switches all
       announced as "Match app appearance" is exactly what this screen had. */
    surfaceFollowLabel: function () { return this.scopedLabel('Use app appearance'); },
    surfaceThemeLabel: function () { return this.scopedLabel('Theme'); },
    surfaceAccentLabel: function () { return this.scopedLabel('Accent'); },
    surfaceFontLabel: function () { return this.scopedLabel('Font'); },
    surfaceFollowsApp: function () { return LmsUi.surfaceFollowsApp(this.appearanceSurface); },
    surfaceTheme: function () { return LmsUi.surfaceValues(this.appearanceSurface).theme; },
    surfaceScheme: function () { return LmsUi.surfaceValues(this.appearanceSurface).scheme; },
    surfaceFont: function () { return LmsUi.surfaceValues(this.appearanceSurface).font; }
  },
  watch: {
    /* Quando o servidor confirma o valor, o rascunho sai de cena e o controle
       volta a refletir o estado real. */
    'store.transitionDuration': function () { this.durationDraft = null; },
    /* Keeps ui.appearanceScreen -- the field the template branches on --
       lined up with the top of LmsNav.stacks.settings after ANY change to
       that stack that did not go through openAppearanceScreen: the on-screen
       back chevron (app.js goBack -> LmsNav.back), browser Back and hardware
       Back (nav.js's own popstate handler, which splices and rebuilds the
       stack). Forward navigation already sets appearanceScreen directly in
       openAppearanceScreen, so this only has to cover the pop direction --
       but it is harmless and idempotent when it also fires on push.
       immediate:true also runs syncAppearanceScreen once at component
       creation, i.e. on every mount: goBack's history.back() resolves via an
       async popstate, so a stack mutation can finish while lms-settings is
       unmounted (v-else-if in app.js tears the component down, it is not
       kept alive) and no watcher is listening to catch it. Without the
       immediate run, the next mount's baseline would be that already-popped
       value and the transition would never be observed again. Reconciling on
       every mount, not just on the next length change, is what keeps
       ui.appearanceScreen from getting stuck. */
    'nav.settings.length': {
      immediate: true,
      handler: function () { this.syncSettingsScreen(); }
    },
    'ui.theme': function () { this.themeAdvancedFrame(); },
    'ui.colorScheme': function () { this.themeAdvancedFrame(); },
    'ui.fontFamily': function () { this.themeAdvancedFrame(); }
  },
  beforeDestroy: function () {
    this.stopAdvancedThemeObserver();
    if (LmsUi.applyAdvancedSettings === this.applyAdvancedFrame) LmsUi.applyAdvancedSettings = null;
  },
  destroyed: function () {
    this.stopAdvancedThemeObserver();
    if (LmsUi.applyAdvancedSettings === this.applyAdvancedFrame) LmsUi.applyAdvancedSettings = null;
  },
  methods: {
    stopAdvancedThemeObserver: function () {
      if (this.advancedThemeObserver && this.advancedThemeObserver.disconnect) {
        this.advancedThemeObserver.disconnect();
      }
      this.advancedThemeObserver = null;
    },
    n: function (v) { return LmsFmt.count(v); },
    toggleTheme: function () { LmsUi.toggleTheme(); },
    /* setLanguage guarda a escolha e recarrega: os templates ja foram
       reescritos no registro dos componentes, entao nao ha como trocar o
       idioma da tela em pe. */
    tr: function (text) {
      return window.LmsStr && LmsStr.t ? LmsStr.t(text) : text;
    },
    language: function (key) {
      if (window.LmsStr && LmsStr.setLanguage) LmsStr.setLanguage(key);
    },
    colorScheme: function (key) { LmsUi.setColorScheme(key); },
    fontFamily: function (key) { LmsUi.setFontFamily(key); },
    queueArtMode: function (key) { LmsUi.setQueueArtMode(key); },
    /* Vai para uma interpolacao ({{ }}), entao a reescrita de i18n ja embrulha
       o retorno em $t() sozinha -- sem chamada explicita aqui. */
    queueArtModeHint: function (key) {
      if (key === 'every') return 'Cover art on every track';
      if (key === 'album') return 'Cover art once per run of the same album';
      if (key === 'headings') return 'Cover art once per album, with a caption above the group';
      return '';
    },
    defaultPlayer: function (key) { LmsUi.setDefaultPlayer(key); },
    /* Mesmo texto que a folha de acoes usa para o seletor de player
       (actions.js) -- reaproveitado aqui, e nao reinventado, para o rotulo
       nao mudar dependendo de por onde o usuario chega. Vai para uma
       interpolacao ({{ }}), entao a reescrita de i18n ja embrulha o retorno
       em $t() sozinha -- sem chamada explicita aqui. */
    playerStatusLabel: function (p) {
      if (!p.connected) return 'Disconnected';
      if (!p.power) return 'Sleeping';
      return '';
    },
    playerPresentation: function (key) { LmsUi.setPlayerPresentation(key); },
    miniGaugeStyle: function (key) { LmsUi.setGaugeStyle('mini', key); },
    playerGaugeStyle: function (key) { LmsUi.setGaugeStyle('player', key); },
    gaugeColor: function (target, key) { LmsUi.setGaugeColor(target, key); },
    /* Thin, curried wrappers so the Bar colour swatch rows' radioKey apply
       argument can be a plain method reference, the same shape colorScheme/
       fontFamily/setSurfaceTheme etc. already are -- gaugeColor takes two
       arguments and cannot be passed there directly. */
    setPlayerGaugeColor: function (key) { this.gaugeColor('player', key); },
    setMiniGaugeColor: function (key) { this.gaugeColor('mini', key); },
    advancedFrameCss: function () {
      return [
        'html{background:var(--group-page)!important;color:var(--text)!important;font-family:var(--app-font)!important;color-scheme:light;}',
        'html[data-echoclassic-theme="dark"]{color-scheme:dark;}',
        'body{box-sizing:border-box;margin:0!important;min-height:100vh;background:var(--group-page)!important;',
        'color:var(--text)!important;font:15px/1.35 var(--app-font)!important;-webkit-text-size-adjust:100%;',
        'padding:18px 20px 18px 342px!important;overflow:auto!important;overscroll-behavior-y:contain;}',
        '#header,#headerWrapper,#header-wrapper,#branding,#masthead,#logo,#top,',
        '#browsedbHeader,#skinHeader,#pageHeader,.masthead,.topbar,.logo,',
        '[class*="masthead"],[class*="branding"],#statusarea:empty,body>h1,',
        'body>.title,body>.pageTitle,body>.page-title,body>.settingsTitle,',
        'body>.settingTitle,body>.header,body>.toolbar,body>.menubar,body>.menu,',
        '.breadcrumb,.breadcrumbs,#breadcrumb,#breadcrumbs,.path,#path,',
        '#homeLink,#homelink,.homeLink,.home{display:none!important;}',
        'ul.tabs,.tabs,#tabs,#settingsTabs,#choose_setting{display:none!important;}',
        'a{color:var(--accent)!important;text-decoration:none!important;}',
        '#echoclassic-advanced-rail{box-sizing:border-box;position:fixed;left:20px;top:18px;bottom:24px;width:302px;',
        'z-index:20;display:grid;grid-template-rows:auto auto 1fr;overflow:hidden;border-radius:20px;',
        'background:color-mix(in srgb,var(--chrome) 88%,transparent)!important;',
        'border:.5px solid color-mix(in srgb,var(--group-bg) 86%,var(--hair))!important;}',
        '#echoclassic-rail-toggle,#echoclassic-rail-scrim{display:none!important;}',
        '.ec-rail-top{padding:18px 14px 10px!important;}',
        '.ec-rail-search{box-sizing:border-box;height:44px;border-radius:22px;background:var(--field)!important;',
        'color:var(--text2)!important;display:grid;grid-template-columns:24px minmax(0,1fr) 30px;align-items:center;',
        'padding:0 9px!important;font:16px var(--app-font)!important;}',
        '.ec-rail-search:focus-within{outline:3px solid var(--accent)!important;outline-offset:2px;}',
        '#echoclassic-advanced-rail .ec-rail-search input[type="search"]{border:0!important;border-radius:0!important;',
        'background:transparent!important;box-shadow:none!important;outline:0!important;color:var(--text)!important;',
        'height:44px!important;min-height:44px!important;padding:0!important;width:100%!important;font:16px var(--app-font)!important;}',
        '.ec-rail-search input::placeholder{color:var(--text2)!important;opacity:1;}',
        '.ec-rail-clear{box-sizing:border-box!important;width:30px!important;height:44px!important;min-height:44px!important;',
        'margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;',
        'color:var(--text2)!important;font:22px/1 var(--app-font)!important;box-shadow:none!important;}',
        '.ec-rail-clear[hidden]{display:none!important;}',
        '.ec-rail-mag{width:15px;height:15px;border:1.8px solid currentColor;border-radius:50%;position:relative;}',
        '.ec-rail-mag:after{content:"";position:absolute;width:7px;height:1.8px;right:-5px;bottom:-3px;background:currentColor;transform:rotate(45deg);}',
        '.ec-rail-identity{display:grid;grid-template-columns:48px 1fr;gap:10px;align-items:center;padding:8px 14px 12px!important;}',
        '.ec-server-dot{width:44px;height:44px;border-radius:50%;background:radial-gradient(circle at 50% 50%,var(--group-bg) 0 10%,transparent 11%),',
        'repeating-linear-gradient(90deg,transparent 0 7px,color-mix(in srgb,var(--group-bg) 56%,transparent) 7px 9px),',
        'linear-gradient(135deg,#50545c,#101216);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--group-bg) 62%,transparent),0 1px 3px rgba(0,0,0,.18);}',
        '.ec-rail-identity b{display:block;font-size:17px;font-weight:700;color:var(--text)!important;}',
        '.ec-rail-identity span{display:block;margin-top:2px;color:var(--text2)!important;font-size:12px;line-height:1.2;}',
        '.ec-rail-list{min-height:0;overflow:auto;padding:0 12px 16px!important;',
        '-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain;touch-action:pan-y;scrollbar-gutter:stable;}',
        '.ec-rail-label{padding:12px 10px 5px!important;color:var(--text2)!important;font-size:12px;text-transform:uppercase;}',
        '.ec-nav-row{appearance:none;border:0!important;width:100%;min-height:44px;display:grid!important;grid-template-columns:28px 1fr auto;',
        'align-items:center;gap:9px;padding:5px 8px!important;border-radius:19px!important;background:transparent!important;',
        'color:var(--text)!important;text-align:left;font:16px var(--app-font)!important;}',
        '.ec-nav-row.ec-active{background:color-mix(in srgb,var(--text2) 20%,transparent)!important;color:var(--accent)!important;}',
        '.ec-nav-row.ec-hidden{display:none!important;}',
        '.ec-glyph{width:25px;height:25px;border-radius:7px;display:grid;place-items:center;color:#fff;font-size:15px;font-weight:700;}',
        '.ec-g-gray{background:linear-gradient(#c6c6cc,#96969d);}.ec-g-blue{background:linear-gradient(#2da8ff,#007aff);}',
        '.ec-g-green{background:linear-gradient(#63da75,#30b94d);}.ec-g-orange{background:linear-gradient(#ffb34a,#ff8900);}',
        '.ec-g-red{background:linear-gradient(#ff6b6b,#ff3b30);}.ec-g-purple{background:linear-gradient(#ad7bff,#715aff);}',
        '.ec-lms-chrome-hidden{display:none!important;}',
        '#topGraphicBox,#echoclassic-advanced-hero{display:none!important;}',
        'body.ec-plugin-store{padding:0 20px 84px 342px!important;overflow:auto!important;}',
        '.ec-plugin-store #homeMenu{display:block!important;box-sizing:border-box;width:100%!important;',
        'margin:0!important;padding:0!important;background:var(--group-page)!important;color:var(--text)!important;}',
        '.ec-plugin-store #pluginButtonBar{box-sizing:border-box;position:sticky;top:0;z-index:8;min-height:66px;',
        'display:flex!important;align-items:center;gap:12px;padding:11px 14px!important;margin:0!important;',
        'background:linear-gradient(#fdfdfe 0%,#eceef1 50%,#e5e8ec 51%,#dcdfe4 100%)!important;',
        'border-bottom:1px solid #a9adb4!important;box-shadow:0 1px 0 rgba(255,255,255,.85)!important;}',
        '.ec-plugin-store #viewToggle{display:none!important;}',
        '.ec-plugin-filter{display:flex;height:44px;border:1px solid rgba(0,0,0,.42);border-radius:7px;overflow:hidden;',
        'box-shadow:0 1px 0 rgba(255,255,255,.35);flex:0 0 auto;}',
        '.ec-plugin-filter button{box-sizing:border-box;min-width:82px!important;height:44px!important;min-height:44px!important;',
        'margin:0!important;padding:0 15px!important;border:0!important;border-right:1px solid rgba(0,0,0,.42)!important;',
        'border-radius:0!important;background:linear-gradient(#fdfdfe 0%,#eef0f3 48%,#e4e7eb 52%,#dbdee3 100%)!important;',
        'color:#31353b!important;text-shadow:0 1px 0 rgba(255,255,255,.6)!important;font:700 14px/1 Helvetica,Arial,sans-serif!important;}',
        '.ec-plugin-filter button:last-child{border-right:0!important;}',
        '.ec-plugin-filter button.ec-selected{background:linear-gradient(#5f9fee 0%,#3277dd 48%,#2568cf 52%,#1e58bd 100%)!important;',
        'color:#fff!important;text-shadow:0 -1px 0 rgba(0,0,0,.4)!important;',
        'box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 0 rgba(0,0,0,.25)!important;}',
        '.ec-plugin-count{color:#6a7078!important;font:13px/1 var(--app-font)!important;text-shadow:0 1px 0 rgba(255,255,255,.9);white-space:nowrap;}',
        '.ec-plugin-store #filterChooser{margin-left:auto!important;position:relative;order:4;}',
        '.ec-plugin-store #filterChooser select{box-sizing:border-box;width:auto!important;min-width:188px;height:44px!important;min-height:44px!important;',
        'padding:0 34px 0 13px!important;border:1px solid rgba(0,0,0,.42)!important;border-radius:7px!important;',
        'background:linear-gradient(#fdfdfe 0%,#eef0f3 48%,#e4e7eb 52%,#dbdee3 100%)!important;',
        'color:#31353b!important;text-shadow:0 1px 0 rgba(255,255,255,.6)!important;font:700 14px/1 Helvetica,Arial,sans-serif!important;}',
        '.ec-plugin-search{box-sizing:border-box;position:relative;order:3;width:250px;height:44px;border-radius:22px;',
        'background:linear-gradient(#e7e9ec,#fbfbfc 40%)!important;border:1px solid #a9adb4!important;',
        'box-shadow:inset 0 1px 2px rgba(0,0,0,.22),0 1px 0 rgba(255,255,255,.8)!important;color:#8b9098!important;}',
        '.ec-plugin-search:before{content:"";position:absolute;left:14px;top:13px;width:13px;height:13px;border:2px solid #8b9098;border-radius:50%;}',
        '.ec-plugin-search:after{content:"";position:absolute;left:27px;top:27px;width:7px;height:2px;background:#8b9098;transform:rotate(45deg);border-radius:2px;}',
        '.ec-plugin-store #filterInput{box-sizing:border-box;width:100%!important;height:42px!important;min-height:42px!important;',
        'padding:0 12px 0 39px!important;border:0!important;border-radius:21px!important;background:transparent!important;',
        'color:#31353b!important;font:15px/1 var(--app-font)!important;outline:0!important;}',
        '.ec-plugin-store #filterInput:focus{box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 34%,transparent)!important;}',
        '.ec-plugin-store #settingsRegion,.ec-plugin-store #settingsForm,.ec-plugin-store #innerSettingsBlock,',
        '.ec-plugin-store #pluginListPanel{box-sizing:border-box;width:100%!important;height:auto!important;margin:0!important;padding:0!important;}',
        '.ec-plugin-store #statusarea:empty{display:none!important;}',
        '.ec-plugin-store #pluginListPanel>.settingSection{box-sizing:border-box;margin:0!important;padding:0!important;border:0!important;background:transparent!important;}',
        '.ec-plugin-store .prefHead.collapsableSection{box-sizing:border-box;min-height:43px;display:flex!important;align-items:center;',
        'padding:7px 14px!important;margin:0!important;background:linear-gradient(#eaecef,#dcdfe4)!important;',
        'border-top:1px solid rgba(255,255,255,.9)!important;border-bottom:1px solid #b9bdc4!important;',
        'color:#6a7078!important;text-shadow:0 1px 0 rgba(255,255,255,.9)!important;',
        'font:700 13px/1 var(--app-font)!important;text-transform:uppercase!important;letter-spacing:.07em!important;}',
        '.ec-plugin-store .prefHead.collapsableSection:before,.ec-plugin-store .prefHead.collapsableSection:after{content:none!important;}',
        '.ec-plugin-store .prefHead .disclosure_repos{display:none!important;}',
        '.ec-plugin-store .ec-plugin-band-empty{display:none!important;}',
        '.ec-plugin-store .pluginList>ul.thumbwrap{box-sizing:border-box;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));',
        'width:100%!important;margin:0!important;padding:0!important;list-style:none!important;background:var(--group-bg)!important;}',
        '.ec-plugin-store li.ec-plugin-card{box-sizing:border-box;display:block!important;min-width:0;min-height:134px;',
        'margin:0!important;padding:0!important;border-right:1px solid #ccd0d5!important;border-bottom:1px solid #ccd0d5!important;',
        'background:linear-gradient(#fff,#f4f5f7)!important;color:#1c1f24!important;}',
        '.ec-plugin-store li.ec-plugin-card:nth-child(3n){border-right:0!important;}',
        '.ec-plugin-store li.ec-plugin-filtered{display:none!important;}',
        '.ec-plugin-store .ec-plugin-card .pluginItem{box-sizing:border-box;position:relative;min-height:133px;display:grid!important;',
        'grid-template-columns:57px minmax(0,1fr);grid-template-rows:auto auto;column-gap:12px;align-content:start;padding:13px 14px!important;}',
        '.ec-plugin-store .ec-plugin-card .pluginItem>div:first-child,',
        '.ec-plugin-store .ec-plugin-card .pluginItem>div:first-child>div{display:contents!important;}',
        '.ec-plugin-store .ec-plugin-card .ec-plugin-icon-image,.ec-plugin-store .ec-plugin-fallback-tile{grid-column:1;grid-row:1/span 2;',
        'box-sizing:border-box;width:57px!important;height:57px!important;min-height:57px;object-fit:cover;border-radius:12px!important;',
        'background:#747b86!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.55),inset 0 -1px 0 rgba(0,0,0,.28),0 1px 2px rgba(0,0,0,.4)!important;}',
        '.ec-plugin-store .ec-plugin-card .pluginItem:before{content:"";position:absolute;z-index:2;left:14px;top:13px;width:57px;height:57px;',
        'pointer-events:none;border:1px solid rgba(0,0,0,.3);border-radius:12px;',
        'background:linear-gradient(to bottom,rgba(255,255,255,.52) 0%,rgba(255,255,255,.20) 46%,rgba(255,255,255,.02) 47%,rgba(255,255,255,.10) 100%);}',
        '.ec-plugin-store .ec-plugin-card .pluginFallbackIcon{display:none!important;}',
        '.ec-plugin-fallback-tile{display:grid!important;place-items:center;color:#fff;font:700 22px/1 var(--app-font)!important;text-shadow:0 -1px 0 rgba(0,0,0,.35);}',
        '.ec-plugin-tone-0 .ec-plugin-fallback-tile{background:#2878dc!important}.ec-plugin-tone-1 .ec-plugin-fallback-tile{background:#36b85d!important}',
        '.ec-plugin-tone-2 .ec-plugin-fallback-tile{background:#e83f4d!important}.ec-plugin-tone-3 .ec-plugin-fallback-tile{background:#707783!important}',
        '.ec-plugin-tone-4 .ec-plugin-fallback-tile{background:#e8a821!important}.ec-plugin-tone-5 .ec-plugin-fallback-tile{background:#7658dc!important}',
        '.ec-plugin-store .ec-plugin-card .headerLabel{grid-column:2;grid-row:1;min-width:0;display:block!important;margin:0!important;',
        'padding:0!important;color:#1c1f24!important;font-family:var(--app-font)!important;cursor:pointer;}',
        '.ec-plugin-store .ec-plugin-card input[type="checkbox"]{position:absolute!important;opacity:0!important;pointer-events:none!important;',
        'width:1px!important;height:1px!important;min-height:1px!important;}',
        '.ec-plugin-name{display:-webkit-box;max-width:100%;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;',
        'color:#1c1f24!important;font:700 15px/1.15 var(--app-font)!important;text-shadow:0 1px 0 rgba(255,255,255,.9);}',
        '.ec-plugin-author,.ec-plugin-version{display:block;max-width:100%;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
        'color:#787d85!important;font:12px/1.15 var(--app-font)!important;}',
        '.ec-plugin-switch-hit{display:flex;width:44px;height:44px;align-items:center;margin-top:3px;}',
        '.ec-plugin-switch{box-sizing:border-box;position:relative;display:block;width:44px;height:26px;border-radius:13px;',
        'background:var(--sw-off)!important;box-shadow:inset 0 2px 3px rgba(0,0,0,.22),0 1px 0 rgba(255,255,255,.55);transition:background-color .15s ease;}',
        '.ec-plugin-switch:after{content:"";position:absolute;left:2px;top:2px;width:22px;height:22px;border-radius:50%;',
        'background:var(--knob);box-shadow:inset 0 1px 0 rgba(255,255,255,.65),0 1px 2px var(--knob-shadow);transition:transform .15s ease;}',
        '.ec-plugin-card input[type="checkbox"]:checked~.ec-plugin-switch-hit .ec-plugin-switch{background:var(--sw-on)!important;}',
        '.ec-plugin-card input[type="checkbox"]:checked~.ec-plugin-switch-hit .ec-plugin-switch:after{transform:translateX(18px);}',
        '.ec-plugin-card input[type="checkbox"]:focus-visible~.ec-plugin-switch-hit .ec-plugin-switch{outline:3px solid var(--accent)!important;outline-offset:3px;}',
        '.ec-plugin-store .pluginDesc{display:none!important;}',
        '.ec-plugin-store .pluginFooter{grid-column:2;grid-row:2;display:block!important;align-self:start;min-width:0;margin:2px 0 0!important;',
        'padding:0!important;color:#787d85!important;font:12px/1.25 var(--app-font)!important;}',
        '.ec-plugin-store .pluginFooter img{display:none!important}.ec-plugin-store .pluginFooter a{font-size:12px!important;font-weight:700!important;}',
        '.ec-plugin-store #prefsSubmit{box-sizing:border-box;position:fixed;z-index:10;left:342px;right:20px;bottom:0;min-height:64px;',
        'display:flex!important;align-items:center;gap:12px;margin:0!important;padding:10px 14px!important;',
        'background:linear-gradient(#fdfdfe 0%,#eceef1 50%,#e5e8ec 51%,#dcdfe4 100%)!important;',
        'border-top:1px solid #a9adb4!important;box-shadow:0 -1px 0 rgba(255,255,255,.85)!important;}',
        '.ec-plugin-pending{margin-right:auto;color:#6a7078!important;font:13px/1 var(--app-font)!important;text-shadow:0 1px 0 rgba(255,255,255,.9);}',
        '.ec-plugin-store #prefsSubmit #saveSettings{height:44px!important;min-height:44px!important;margin-left:auto!important;padding:0 18px!important;',
        'border:1px solid #164a9f!important;border-radius:7px!important;background:linear-gradient(#5f9fee 0%,#3277dd 48%,#2568cf 52%,#1e58bd 100%)!important;',
        'color:#fff!important;text-shadow:0 -1px 0 rgba(0,0,0,.4)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 0 rgba(0,0,0,.25)!important;font-weight:700!important;}',
        'html[data-echoclassic-theme="dark"] body.ec-plugin-store #pluginButtonBar,html[data-echoclassic-theme="dark"] .ec-plugin-store #prefsSubmit{background:var(--chrome)!important;border-color:var(--hair)!important;}',
        'html[data-echoclassic-theme="dark"] .ec-plugin-store li.ec-plugin-card{background:var(--group-bg)!important;color:var(--text)!important;border-color:var(--hair)!important;}',
        'html[data-echoclassic-theme="dark"] .ec-plugin-store .ec-plugin-name,html[data-echoclassic-theme="dark"] .ec-plugin-store .headerLabel{color:var(--text)!important;text-shadow:none!important;}',
        'html[data-echoclassic-theme="legacy"] body.ec-plugin-store #pluginButtonBar,html[data-echoclassic-theme="legacy"] .ec-plugin-store #prefsSubmit{background:var(--chrome)!important;}',
        '#settings,#content,.content,.settingsPage,form,#settingsForm,.ec-advanced-content{box-sizing:border-box;width:100%;',
        'max-width:none!important;padding:0!important;margin:0!important;}',
        'body:not(.ec-plugin-store) #settingsRegion,body:not(.ec-plugin-store) #settingsForm,',
        'body:not(.ec-plugin-store) #innerSettingsBlock{height:auto!important;min-height:0!important;',
        'max-height:none!important;overflow:visible!important;}',
        'h1,h2,h3,h4,.pageHeader,.sectionHeader,.settingGroupHeader{color:var(--text)!important;font-family:var(--app-font)!important;}',
        'table{max-width:100%;color:var(--text)!important;font-family:var(--app-font)!important;}',
        'td,th{border-color:var(--hair)!important;color:var(--text)!important;}',
        'body:not(.ec-plugin-store) #homeMenu,body:not(.ec-plugin-store) #fileselectorautocomplete{background:transparent!important;color:var(--text)!important;}',
        'body:not(.ec-plugin-store) td.even,body:not(.ec-plugin-store) td.odd{background:var(--group-bg)!important;color:var(--text)!important;}',
        'th,label,.label,.prefHead,.settingLabel{color:var(--text)!important;font-weight:400;}',
        '.prefDesc,.smallText,.help,.description,.settingDescription{color:var(--text2)!important;}',
        '#settings table:not(.tabs):not(#tabs):not(#settingsTabs),',
        '#content table:not(.tabs):not(#tabs):not(#settingsTabs),',
        'form>table:not(.tabs):not(#tabs):not(#settingsTabs){width:100%!important;',
        'border-collapse:separate!important;border-spacing:0!important;background:var(--group-bg)!important;',
        'border:0!important;border-radius:20px!important;overflow:hidden!important;margin:0 12px 26px!important;}',
        '#settings table:not(.tabs):not(#tabs):not(#settingsTabs)>tbody>tr,',
        '#content table:not(.tabs):not(#tabs):not(#settingsTabs)>tbody>tr,',
        'form>table:not(.tabs):not(#tabs):not(#settingsTabs)>tbody>tr{min-height:44px;}',
        '#settings table:not(.tabs):not(#tabs):not(#settingsTabs)>tbody>tr+tr>td,',
        '#content table:not(.tabs):not(#tabs):not(#settingsTabs)>tbody>tr+tr>td,',
        'form>table:not(.tabs):not(#tabs):not(#settingsTabs)>tbody>tr+tr>td{',
        'border-top:.5px solid var(--hair)!important;}',
        '#settings table:not(.tabs):not(#tabs):not(#settingsTabs)>tbody>tr>td,',
        '#content table:not(.tabs):not(#tabs):not(#settingsTabs)>tbody>tr>td,',
        'form>table:not(.tabs):not(#tabs):not(#settingsTabs)>tbody>tr>td{',
        'padding:9px 10px!important;vertical-align:middle!important;background:var(--group-bg)!important;}',
        '#settings table:not(.tabs):not(#tabs):not(#settingsTabs)>tbody>tr>td:first-child,',
        '#content table:not(.tabs):not(#tabs):not(#settingsTabs)>tbody>tr>td:first-child,',
        'form>table:not(.tabs):not(#tabs):not(#settingsTabs)>tbody>tr>td:first-child{',
        'width:230px!important;padding-left:16px!important;font-weight:400!important;color:var(--text)!important;}',
        '#settings table:not(.tabs):not(#tabs):not(#settingsTabs)>tbody>tr>td:last-child,',
        '#content table:not(.tabs):not(#tabs):not(#settingsTabs)>tbody>tr>td:last-child,',
        'form>table:not(.tabs):not(#tabs):not(#settingsTabs)>tbody>tr>td:last-child{',
        'padding-right:16px!important;color:var(--text2)!important;}',
        '.settingSection,.settingsGroup,.prefGroup,.group,fieldset{margin:0 0 30px!important;',
        'padding:0!important;background:transparent!important;border:0!important;border-radius:0!important;',
        'overflow:visible!important;}',
        '.settingSection:last-child,.settingsGroup:last-child,.prefGroup:last-child,.group:last-child,fieldset:last-child{margin-bottom:0!important;}',
        '.settingGroup{display:grid!important;grid-template-columns:minmax(170px,280px) minmax(0,1fr);',
        'column-gap:24px;align-items:center;min-height:50px;padding:9px 18px!important;',
        'position:relative;border:0!important;background:var(--group-bg)!important;margin:0 12px 14px!important;border-radius:20px!important;overflow:hidden;}',
        '.settingGroup+.settingGroup:before{content:"";position:absolute;top:0;left:18px;right:0;height:.5px;background:var(--hair);}',
        '.prefHead,.settingLabel{grid-column:1!important;color:var(--text)!important;background:transparent!important;',
        'font:17px/1.25 var(--app-font)!important;font-weight:400!important;text-transform:none!important;',
        'letter-spacing:0!important;margin:0!important;padding:0!important;}',
        '.prefDesc{grid-column:2!important;color:var(--text2)!important;font:14px/1.35 var(--app-font)!important;',
        'margin:3px 0 0!important;padding:0!important;background:transparent!important;}',
        '.prefs{grid-column:2!important;display:flex!important;align-items:center!important;gap:8px;',
        'justify-content:flex-start;flex-wrap:wrap;margin:0!important;padding:0!important;',
        'background:transparent!important;color:var(--text)!important;}',
        '.prefDesc+.prefs{margin-top:6px!important;}',
        '.hiddenDesc{display:none!important;}',
        '.collapsableSection{cursor:pointer;}',
        '.collapsableSection:after{content:"";display:inline-block;width:8px;height:8px;',
        'border-right:1.5px solid var(--text2);border-bottom:1.5px solid var(--text2);',
        'transform:rotate(45deg);margin-left:8px;margin-bottom:3px;}',
        '.ec-collapsed .collapsableSection:after{transform:rotate(-45deg);}',
        '.ec-hidden-section{display:none!important;}',
        'legend{padding:8px 10px!important;color:var(--group-head)!important;',
        'font:12px/1.2 var(--app-font)!important;text-transform:uppercase;letter-spacing:.02em;}',
        'input[type="text"],input[type="password"],input[type="search"],input[type="number"],',
        'input[type="url"],input[type="email"],textarea,select{box-sizing:border-box;',
        'min-height:44px;max-width:100%;border:.5px solid var(--hair)!important;border-radius:9px!important;',
        'background:var(--group-bg)!important;color:var(--text)!important;',
        'font:17px var(--app-font)!important;padding:5px 10px!important;}',
        'input[type="text"],input[type="password"],input[type="search"],input[type="url"],',
        'input[type="email"]{width:min(100%,480px)!important;}',
        'input[type="number"]{width:90px!important;}',
        'textarea{min-height:70px;}',
        'input[type="range"]{accent-color:var(--accent);}',
        'input[type="checkbox"],input[type="radio"]{width:24px;height:24px;min-height:24px;accent-color:var(--accent);}',
        'input.ec-native-checkbox{position:absolute!important;opacity:0!important;width:44px!important;height:44px!important;',
        'min-height:44px!important;margin:0!important;pointer-events:none!important;}',
        '.ec-native-switch-hit{box-sizing:border-box;display:inline-flex!important;width:44px;height:44px;',
        'align-items:center;justify-content:center;vertical-align:middle;cursor:pointer;}',
        '.ec-native-switch{box-sizing:border-box;position:relative;display:block;width:44px;height:26px;border-radius:13px;',
        'background:var(--sw-off)!important;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--hair) 72%,transparent);',
        'transition:background .18s ease;}',
        '.ec-native-switch:after{content:"";position:absolute;left:2px;top:2px;width:22px;height:22px;border-radius:50%;',
        'background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.28);transition:transform .18s ease;}',
        'input.ec-native-checkbox:checked+.ec-native-switch-hit .ec-native-switch{background:var(--sw-on)!important;}',
        'input.ec-native-checkbox:checked+.ec-native-switch-hit .ec-native-switch:after{transform:translateX(18px);}',
        'input.ec-native-checkbox:focus-visible+.ec-native-switch-hit .ec-native-switch{outline:3px solid var(--accent)!important;outline-offset:3px;}',
        'button,input[type="button"],input[type="submit"],input[type="reset"],.button,.stdclick{',
        'min-height:44px;border:.5px solid var(--hair)!important;border-radius:9px!important;',
        'background:var(--chrome)!important;color:var(--accent)!important;',
        'font:16px var(--app-font)!important;padding:6px 13px!important;box-shadow:none!important;}',
        'button:active,input[type="button"]:active,input[type="submit"]:active,.button:active,.stdclick:active{',
        'opacity:.55!important;}',
        'input[type="submit"],button[type="submit"],.primary{background:var(--accent)!important;',
        'border-color:var(--accent)!important;color:var(--accent-ink)!important;}',
        'hr{border:0!important;border-top:.5px solid var(--hair)!important;}',
        '#statusarea,#popupWarning,#rescanWarning,#restartWarning{box-sizing:border-box;',
        'margin:0 14px 14px!important;padding:10px 12px!important;border:.5px solid var(--hair)!important;',
        'background:var(--group-bg)!important;color:var(--text)!important;border-radius:7px!important;}',
        '#saveSettings,#save{background:var(--accent)!important;border-color:var(--accent)!important;color:var(--accent-ink)!important;}',
        '#cancelSettings,#cancel{color:var(--accent)!important;}',
        'body:not(.ec-plugin-store) #prefsSubmit{display:none!important;}',
        '.ec-plugin-store #prefsSubmit #saveSettings,.ec-plugin-store #prefsSubmit input[type="submit"],',
        '.ec-plugin-store #prefsSubmit button[type="submit"]{display:none!important;}',
        '.ec-plugin-store #prefsSubmit{min-height:44px!important;padding-top:0!important;padding-bottom:0!important;}',
        'pre,code{background:var(--field)!important;color:var(--text)!important;',
        'border-radius:5px;padding:2px 4px;}',
        '.ec-advanced-content{box-sizing:border-box;width:100%!important;max-width:none!important;margin:0!important;}',
        '.ec-conversion-wrap{box-sizing:border-box;width:100%;max-width:none;overflow-x:auto!important;margin:0 0 18px!important;',
        'border:.5px solid var(--hair)!important;border-radius:14px!important;background:var(--group-bg)!important;}',
        '.ec-feature-new{box-sizing:border-box;display:inline-block!important;margin:0 0 6px 4px!important;padding:2px 5px!important;',
        'border:1px solid var(--accent)!important;border-radius:4px!important;color:var(--accent)!important;background:transparent!important;',
        'font:700 9px/1.2 var(--app-font)!important;letter-spacing:.1em;text-transform:uppercase!important;}',
        '.ec-scan-region>.ec-feature-new{grid-column:1/-1;justify-self:start;}',
        'table.ec-conversion-table{width:100%!important;min-width:0!important;margin:0!important;border:0!important;',
        'border-collapse:collapse!important;background:transparent!important;table-layout:auto!important;}',
        '.ec-conversion-table th{padding:10px 12px!important;background:var(--field)!important;color:var(--text2)!important;',
        'font:700 12px/1.2 var(--app-font)!important;text-align:left!important;text-transform:uppercase!important;letter-spacing:.04em!important;}',
        '.ec-conversion-table td{box-sizing:border-box;padding:8px 12px!important;border-top:.5px solid var(--hair)!important;',
        'background:var(--group-bg)!important;color:var(--text)!important;font:15px/1.25 var(--app-font)!important;vertical-align:middle!important;}',
        '.ec-conversion-table tr.ec-conversion-empty{display:none!important;}',
        '.ec-conversion-table select{width:100%!important;min-width:170px!important;height:40px!important;min-height:40px!important;',
        'font-size:15px!important;background:var(--field)!important;}',
        '.ec-scan-region{box-sizing:border-box;width:100%!important;max-width:none!important;display:grid!important;',
        'grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;padding:14px!important;',
        'background:transparent!important;border:0!important;}',
        '.ec-scan-gauge{box-sizing:border-box;min-width:0;padding:10px 2px 12px!important;border:0!important;',
        'border-bottom:.5px solid var(--hair)!important;border-radius:0!important;background:transparent!important;color:var(--text)!important;}',
        '.ec-scan-copy{display:block!important;min-width:0;overflow-wrap:anywhere;background:transparent!important;',
        'font:600 15px/1.35 var(--app-font)!important;}',
        '.ec-scan-copy *{background:transparent!important;border:0!important;color:inherit!important;}',
        '.ec-scan-track{box-sizing:border-box;display:block!important;height:8px;margin:11px 0 5px!important;overflow:hidden;',
        'border-radius:4px;background:var(--field)!important;}',
        '.ec-scan-fill{display:block!important;height:100%;width:var(--ec-scan-progress,0%);border-radius:inherit;background:var(--accent)!important;}',
        '.ec-scan-complete .ec-scan-fill{background:var(--sw-on)!important;}',
        '.ec-scan-failed .ec-scan-fill{background:var(--destructive,var(--accent))!important;}',
        '.ec-scan-activity{box-sizing:border-box;grid-column:1/-1;display:grid!important;grid-template-columns:118px minmax(0,1fr);',
        'gap:3px 14px;padding:13px 15px!important;border:.5px solid var(--accent)!important;border-left:5px solid var(--accent)!important;',
        'border-radius:10px!important;background:var(--group-bg)!important;color:var(--text)!important;}',
        '.ec-scan-activity-label{grid-row:1/3;color:var(--accent)!important;font:700 11px/1.4 var(--app-font)!important;',
        'letter-spacing:.08em;text-transform:uppercase;}',
        '.ec-scan-activity-main{min-width:0;font:600 15px/1.35 var(--app-font)!important;overflow-wrap:anywhere;}',
        '.ec-scan-activity-detail{min-width:0;color:var(--text2)!important;font:12px/1.4 var(--app-font)!important;overflow-wrap:anywhere;}',
        '.ec-native-scan-progress{display:none!important;}',
        '.ec-scan-journal{grid-column:1/-1;min-width:0;margin-top:4px;padding:12px 14px;border:.5px solid var(--hair);border-radius:10px;background:var(--group-bg);color:var(--text);}',
        '.ec-scan-journal-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font:600 15px/1.35 var(--app-font);}',
        '.ec-scan-journal-count{color:var(--text2);font-size:12px;font-weight:400;}',
        '.ec-scan-journal-note{margin:7px 0;color:var(--text2);font-size:12px;line-height:1.4;overflow-wrap:anywhere;}',
        '.ec-scan-error-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;padding:10px 0;border-top:.5px solid var(--hair);}',
        '.ec-scan-error-copy{min-width:0;overflow-wrap:anywhere;font-size:13px;line-height:1.4;}',
        '.ec-scan-error-copy strong{display:block;font-weight:600;}',
        '.ec-scan-error-meta{display:block;margin-top:3px;color:var(--text2);font-size:11px;}',
        '.ec-scan-error-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;}',
        '.ec-scan-error-actions button{min-height:36px;padding:0 10px;border:1px solid var(--accent);border-radius:6px;background:transparent;color:var(--accent);font:600 12px var(--app-font);}',
        '.ec-scan-error-actions button:focus-visible{outline:3px solid var(--accent);outline-offset:2px;}',
        '.ec-scan-journal-clear{min-height:36px;padding:0 10px;border:1px solid var(--hair);border-radius:6px;background:transparent;color:var(--text2);font:600 12px var(--app-font);}',
        'img{max-width:100%;}',
        '@media (max-width:1180px){.ec-plugin-store #pluginButtonBar{flex-wrap:wrap!important}.ec-plugin-search{flex:1 1 230px;min-width:200px;}',
        '.ec-plugin-store #filterChooser{margin-left:0!important;}}',
        '@media (max-width:860px){body,body.ec-plugin-store{padding:10px 10px 76px!important;}',
        'body.ec-rail-open{overflow:hidden!important;}',
        '#echoclassic-rail-toggle{box-sizing:border-box;position:sticky;top:0;z-index:25;display:flex!important;width:100%;height:44px;',
        'align-items:center;justify-content:space-between;margin:0 0 10px!important;padding:0 14px!important;border:.5px solid var(--hair)!important;',
        'border-radius:12px!important;background:var(--chrome)!important;color:var(--text)!important;font:600 16px var(--app-font)!important;}',
        '#echoclassic-rail-toggle:after{content:"›";color:var(--accent);font-size:22px;}',
        '#echoclassic-rail-scrim{position:fixed;z-index:29;inset:0;display:none!important;border:0!important;border-radius:0!important;',
        'margin:0!important;padding:0!important;background:rgba(0,0,0,.38)!important;}',
        'body.ec-rail-open #echoclassic-rail-scrim{display:block!important;}',
        '#echoclassic-advanced-rail,.ec-plugin-store #echoclassic-advanced-rail{position:fixed;z-index:30;left:10px;top:10px;bottom:10px;',
        'width:min(320px,calc(100% - 20px));max-height:none;margin:0;transform:translateX(calc(-100% - 24px));',
        'transition:transform .2s ease;box-shadow:0 14px 36px rgba(0,0,0,.28);}',
        'body.ec-rail-open #echoclassic-advanced-rail{transform:translateX(0);}',
        '.ec-plugin-store #pluginButtonBar{position:static;flex-wrap:wrap!important;}',
        '.ec-plugin-count{order:2}.ec-plugin-search{order:3;width:100%!important}.ec-plugin-store #filterChooser{order:4;margin-left:0!important;}',
        '.ec-plugin-store .pluginList>ul.thumbwrap{grid-template-columns:repeat(2,minmax(0,1fr));}.ec-plugin-store li.ec-plugin-card:nth-child(3n){border-right:1px solid #ccd0d5!important;}',
        '.ec-plugin-store li.ec-plugin-card:nth-child(2n){border-right:0!important}.ec-plugin-store #prefsSubmit{left:10px;right:10px;}',
        '.settingGroup{display:block!important;margin-left:0!important;margin-right:0!important}.prefHead,.prefDesc,.prefs{display:block!important;}',
        '.prefs{display:flex!important;margin-top:7px!important}.ec-scan-region{grid-template-columns:1fr!important}',
        '.ec-scan-activity{grid-template-columns:1fr!important}.ec-scan-activity-label{grid-row:auto!important}',
        '.ec-conversion-table thead,.ec-conversion-table tr.ec-conversion-header{display:none!important}.ec-conversion-table,.ec-conversion-table tbody{display:block!important}',
        '.ec-conversion-table tr{display:grid!important;grid-template-columns:minmax(0,1fr) 72px minmax(170px,1.2fr);gap:8px 12px;',
        'padding:11px 12px!important;border-top:.5px solid var(--hair)!important}',
        '.ec-conversion-table tr:before{content:attr(data-ec-format);grid-column:1/-1;color:var(--text)!important;font:600 15px/1.3 var(--app-font)!important}',
        '.ec-conversion-table td{display:block!important;padding:0!important;border:0!important}.ec-conversion-table td:first-child{display:none!important}',
        '.ec-conversion-table td:before{content:attr(data-ec-label);display:block;margin-bottom:3px;color:var(--text2)!important;',
        'font:700 10px/1.2 var(--app-font)!important;letter-spacing:.05em;text-transform:uppercase}.ec-conversion-table select{min-width:0!important}}',
        '@media (max-width:620px){.ec-plugin-store #prefsSubmit{left:10px;right:10px;}.ec-plugin-filter{width:100%}.ec-plugin-filter button{min-width:0!important;flex:1;}',
        '.ec-plugin-store #filterChooser,.ec-plugin-store #filterChooser select{width:100%!important}.ec-plugin-store .pluginList>ul.thumbwrap{grid-template-columns:1fr;}',
        '.ec-plugin-store li.ec-plugin-card{border-right:0!important}.ec-plugin-store #prefsSubmit{left:0;right:0!important}',
        '.ec-conversion-table tr{grid-template-columns:1fr!important}.ec-conversion-table tr:before{grid-column:1!important}}',
        '@media (prefers-reduced-motion:reduce){.ec-plugin-switch,.ec-plugin-switch:after,.ec-native-switch,.ec-native-switch:after,',
        '#echoclassic-advanced-rail{transition:none!important;}}'
      ].join('');
    },
    advancedClosest: function (node, selector) {
      while (node && node.nodeType === 1) {
        if (node.matches && node.matches(selector)) return node;
        node = node.parentNode;
      }
      return null;
    },
    advancedInternalHref: function (doc, href) {
      if (!href || href.charAt(0) === '#' || href.indexOf('javascript:') === 0) return '';
      var anchor = doc.createElement('a');
      anchor.href = href;
      if (anchor.protocol === 'http:' || anchor.protocol === 'https:') {
        if (anchor.hostname !== window.location.hostname || anchor.port !== window.location.port) return '';
      }
      return anchor.pathname + anchor.search + anchor.hash;
    },
    installAdvancedLinkController: function (frame, doc) {
      var self = this;
      if (!doc.addEventListener) return;
      if (doc.__echoclassicLinkController) return;
      doc.__echoclassicLinkController = true;
      doc.addEventListener('click', function (event) {
        var link = self.advancedClosest(event.target, 'a');
        if (!link) return;
        if (link.target === 'browser') link.removeAttribute('target');
        var href = self.advancedInternalHref(doc, link.getAttribute('href'));
        if (!href) return;
        event.preventDefault();
        frame.src = href;
      });
    },
    installAdvancedDirtyTracking: function (doc) {
      var self = this;
      if (!doc.querySelectorAll) return;
      Array.prototype.slice.call(doc.querySelectorAll('input,textarea,select')).forEach(function (input) {
        if (input.__echoclassicDirtyTracking || input.id === 'choose_setting' ||
            self.advancedClosest(input, '#echoclassic-advanced-rail') ||
            String(input.type || '').toLowerCase() === 'hidden') {
          return;
        }
        input.__echoclassicDirtyTracking = true;
        var changed = function () {
          var type = String(input.type || '').toLowerCase();
          var dirty = type === 'checkbox' || type === 'radio'
            ? input.checked !== input.defaultChecked
            : input.value !== input.defaultValue;
          var pending = self.updateAdvancedPluginPending(doc);
          self.advancedSettingsDirty = dirty || pending > 0;
          self.ui.advancedSettingsDirty = self.advancedSettingsDirty;
        };
        input.addEventListener('input', changed);
        input.addEventListener('change', changed);
        input.addEventListener('blur', changed);
      });
      Array.prototype.slice.call(doc.querySelectorAll('form')).forEach(function (form) {
        if (form.__echoclassicSubmitTracking) return;
        form.__echoclassicSubmitTracking = true;
        form.addEventListener('submit', function () {
          self.advancedSettingsDirty = false;
          self.ui.advancedSettingsDirty = false;
          var pending = doc.getElementById('echoclassic-plugin-pending');
          if (pending) pending.textContent = 'No changes pending';
        });
      });
    },
    installAdvancedSectionController: function (frame, doc) {
      var self = this;
      if (!doc.getElementById) return;
      var selector = doc.getElementById('choose_setting');
      if (!selector) return;
      this.advancedSettingsPage = selector.value || '';
      this.ui.advancedSettingsPage = this.advancedSettingsPage;
      if (selector.__echoclassicSectionController) return;
      selector.__echoclassicSectionController = true;
      selector.addEventListener('change', function () {
        self.advancedSettingsPage = selector.value || '';
        self.ui.advancedSettingsPage = self.advancedSettingsPage;
        self.advancedSettingsDirty = false;
        self.ui.advancedSettingsDirty = false;
        self.scheduleAdvancedTheme(frame);
      });
    },
    toggleAdvancedSection: function (doc, header) {
      var target = doc.getElementById(header.id.replace(/_Header$/, ''));
      if (!target) return;
      var hidden = !target.classList.contains('ec-hidden-section');
      target.classList.toggle('ec-hidden-section', hidden);
      if (header.parentNode) header.parentNode.classList.toggle('ec-collapsed', hidden);
      try {
        var key = 'echoclassic.advanced.section.' + header.id;
        if (hidden) localStorage.setItem(key, '1');
        else localStorage.removeItem(key);
      } catch (e) {}
    },
    installAdvancedExpanders: function (doc) {
      var self = this;
      if (!doc.querySelectorAll) return;
      Array.prototype.slice.call(doc.querySelectorAll('.collapsableSection')).forEach(function (header) {
        if (header.__echoclassicExpander) return;
        header.__echoclassicExpander = true;
        try {
          if (localStorage.getItem('echoclassic.advanced.section.' + header.id) === '1') {
            self.toggleAdvancedSection(doc, header);
          }
        } catch (e) {}
        header.addEventListener('click', function () {
          self.toggleAdvancedSection(doc, header);
        });
      });
    },
    advancedTitleCase: function (text) {
      var source = String(text || '').replace(/\s+/g, ' ').trim();
      if (!source || source !== source.toUpperCase()) return source;
      return source.toLowerCase().replace(/\b([a-z])/g, function (match, letter) {
        return letter.toUpperCase();
      }).replace(/\bLms\b/g, 'LMS')
        .replace(/\bCli\b/g, 'CLI')
        .replace(/\bIp\b/g, 'IP')
        .replace(/\bUrl\b/g, 'URL');
    },
    normalizeAdvancedLabels: function (doc) {
      var self = this;
      if (!doc.querySelectorAll) return;
      Array.prototype.slice.call(doc.querySelectorAll('.prefHead,.settingLabel,th')).forEach(function (node) {
        if (node.__echoclassicLabelNormalized) return;
        var text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
        var normalized = self.advancedTitleCase(text);
        if (normalized && normalized !== text && node.childNodes.length === 1 &&
            node.firstChild && node.firstChild.nodeType === 3) {
          node.textContent = normalized;
        }
        node.__echoclassicLabelNormalized = true;
      });
    },
    advancedSectionMeta: function (label) {
      var key = String(label || '').toLowerCase();
      if (key.indexOf('file') >= 0) return { glyph: '\u266b', color: 'blue' };
      if (key.indexOf('format') >= 0) return { glyph: 'Aa', color: 'orange' };
      if (key.indexOf('information') >= 0) return { glyph: 'i', color: 'gray' };
      if (key.indexOf('interface') >= 0) return { glyph: '\u25f4', color: 'purple' };
      if (key.indexOf('logging') >= 0) return { glyph: '\u25a4', color: 'gray' };
      if (key.indexOf('music') >= 0) return { glyph: '\u266a', color: 'green' };
      if (key.indexOf('network') >= 0) return { glyph: '\u25ce', color: 'blue' };
      if (key.indexOf('performance') >= 0) return { glyph: '\u26a1', color: 'orange' };
      if (key.indexOf('security') >= 0) return { glyph: '\u25cf', color: 'red' };
      if (key.indexOf('update') >= 0) return { glyph: '\u21bb', color: 'gray' };
      if (key.indexOf('plugin') >= 0) return { glyph: '\u25a6', color: 'gray' };
      if (key.indexOf('echo classic') >= 0) return { glyph: 'E', color: 'blue' };
      if (key.indexOf('material') >= 0) return { glyph: 'M', color: 'green' };
      if (key.indexOf('qobuz') >= 0) return { glyph: 'Q', color: 'red' };
      return { glyph: '\u2699', color: 'gray' };
    },
    advancedIsPluginSection: function (label) {
      var key = String(label || '').toLowerCase();
      return key.indexOf('plugin') >= 0 || key.indexOf('echo classic') >= 0 ||
        key.indexOf('material') >= 0 || key.indexOf('qobuz') >= 0 ||
        key.indexOf('tunein') >= 0 || key.indexOf('radio') >= 0 ||
        key.indexOf('local player') >= 0 || key.indexOf('browse modes') >= 0;
    },
    advancedIsPluginStore: function (label) {
      var key = String(label || '').toLowerCase();
      return key.indexOf('manage plugin') >= 0 || key === 'plugins' || key === 'plugin store';
    },
    advancedDispatchChange: function (doc, node) {
      if (!node || !node.dispatchEvent) return;
      var event;
      try {
        var EventCtor = (doc.defaultView && doc.defaultView.Event) || Event;
        event = new EventCtor('change', { bubbles: true });
      } catch (e) {
        if (!doc.createEvent) return;
        event = doc.createEvent('HTMLEvents');
        event.initEvent('change', true, false);
      }
      node.dispatchEvent(event);
    },
    advancedCreateEl: function (doc, tag, className, text) {
      var node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined && text !== null) node.textContent = text;
      return node;
    },
    advancedBuildRailRow: function (doc, option, selector) {
      var self = this;
      var label = this.advancedTitleCase(option.text || option.label || option.value || '');
      var meta = this.advancedSectionMeta(label);
      var row = this.advancedCreateEl(doc, 'button',
        'ec-nav-row' + (option.selected || option.value === selector.value ? ' ec-active' : ''), '');
      row.type = 'button';
      row.setAttribute('data-ec-label', label.toLowerCase());
      row.setAttribute('data-ec-value', String(option.value || ''));
      var glyph = this.advancedCreateEl(doc, 'span', 'ec-glyph ec-g-' + meta.color, meta.glyph);
      var text = this.advancedCreateEl(doc, 'span', '', label);
      var value = this.advancedCreateEl(doc, 'span', 'value', '');
      row.appendChild(glyph);
      row.appendChild(text);
      row.appendChild(value);
      row.addEventListener('click', function () {
        if (doc.body && doc.body.classList) doc.body.classList.remove('ec-rail-open');
        var toggle = doc.getElementById('echoclassic-rail-toggle');
        if (toggle) {
          toggle.setAttribute('aria-expanded', 'false');
          toggle.textContent = self.tr('Settings pages') + ' · ' + label;
        }
        if (selector.value !== option.value) {
          selector.value = option.value;
          Array.prototype.slice.call(doc.querySelectorAll('#echoclassic-advanced-rail .ec-nav-row')).forEach(function (item) {
            item.classList.toggle('ec-active', item.getAttribute('data-ec-value') === String(selector.value || ''));
          });
          self.advancedDispatchChange(doc, selector);
        }
      });
      return row;
    },
    cleanAdvancedText: function (text) {
      return String(text || '').replace(/\s+/g, ' ').trim();
    },
    hideAdvancedLmsChrome: function (doc, root) {
      var self = this;
      if (!doc.body || !doc.body.children) return;
      var generated = /^(echoclassic-advanced-rail|echoclassic-advanced-theme|echoclassic-rail-toggle|echoclassic-rail-scrim)$/;
      var shouldSkip = function (node) {
        if (!node || node === root || generated.test(String(node.id || ''))) return true;
        if (root && node.contains && node.contains(root)) return true;
        return false;
      };
      var hideIfChrome = function (node) {
        if (shouldSkip(node)) return;
        var text = self.cleanAdvancedText(node.textContent);
        var signature = String(node.id || '') + ' ' + String(node.className || '');
        var containsField = node.querySelector && node.querySelector('input,select,textarea,button');
        var exactChrome = /^server settings$/i.test(text) || /^home\s*\/?$/i.test(text);
        var wrapperChrome = /^server settings\s+home\s*\//i.test(text);
        var namedChrome = /breadcrumb|crumb|header|masthead|branding|topbar|toolbar|menubar|pageTitle|settingsTitle/i.test(signature);
        if (exactChrome || wrapperChrome || (namedChrome && !containsField)) {
          if (node.classList) node.classList.add('ec-lms-chrome-hidden');
        }
      };
      Array.prototype.slice.call(doc.body.children).forEach(function (node) {
        if (node.id === 'echoclassic-advanced-rail' || node.id === 'echoclassic-advanced-theme') {
          return;
        }
        hideIfChrome(node);
      });
      Array.prototype.slice.call(doc.querySelectorAll(
        'h1,h2,h3,.pageHeader,.page-header,.settingsTitle,.settingTitle,.breadcrumb,.breadcrumbs,#breadcrumb,#breadcrumbs,.path,#path'
      )).forEach(hideIfChrome);
      Array.prototype.slice.call(doc.querySelectorAll('body *')).forEach(function (node) {
        var text = self.cleanAdvancedText(node.textContent);
        if (/^server settings$/i.test(text) || /^home\s*\/?$/i.test(text)) hideIfChrome(node);
      });
      Array.prototype.slice.call(doc.querySelectorAll('a')).forEach(function (link) {
        var text = self.cleanAdvancedText(link.textContent);
        if (/^home$/i.test(text) || /^settings$/i.test(text)) {
          var holder = link.parentNode;
          if (holder && !shouldSkip(holder) && holder.classList) {
            holder.classList.add('ec-lms-chrome-hidden');
          }
        }
      });
    },
    pluginIconText: function (name) {
      var words = this.cleanAdvancedText(name).split(/\s+/).filter(Boolean);
      if (!words.length) return 'P';
      if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    },
    advancedPluginLabel: function (text) {
      var raw = this.cleanAdvancedText(text);
      var match = raw.match(/^(.*?)\s*\((?:v|version\s*)?([^)]+)\)\s*$/i);
      return {
        name: this.cleanAdvancedText(match ? match[1] : raw) || 'Plugin',
        version: this.cleanAdvancedText(match ? match[2] : '')
      };
    },
    advancedPluginAuthor: function (footer) {
      if (!footer || !footer.cloneNode) return '';
      var clone = footer.cloneNode(true);
      Array.prototype.slice.call(clone.querySelectorAll('a,img')).forEach(function (node) {
        if (node.parentNode) node.parentNode.removeChild(node);
      });
      return this.cleanAdvancedText(clone.textContent);
    },
    advancedPluginTone: function (id) {
      var value = String(id || 'plugin');
      var hash = 0;
      for (var i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
      return Math.abs(hash) % 6;
    },
    decorateAdvancedPluginCard: function (doc, row) {
      if (!row || !row.querySelector) return;
      var self = this;
      var item = row.querySelector('.pluginItem');
      var checkbox = row.querySelector('input[type="checkbox"]');
      var label = row.querySelector('.headerLabel');
      if (!item || !checkbox || !label) return;

      row.classList.add('ec-plugin-card', 'ec-plugin-tone-' + this.advancedPluginTone(checkbox.id || checkbox.name));
      var raw = label.getAttribute('data-ec-original-label') || this.cleanAdvancedText(label.textContent);
      label.setAttribute('data-ec-original-label', raw);
      var plugin = this.advancedPluginLabel(raw);
      var footer = row.querySelector('.pluginFooter');
      var author = row.getAttribute('data-ec-plugin-author') || this.advancedPluginAuthor(footer);
      if (author) row.setAttribute('data-ec-plugin-author', author);
      var desc = row.querySelector('.pluginDesc');
      row.setAttribute('data-ec-plugin-label', this.cleanAdvancedText(plugin.name + ' ' + author).toLowerCase());
      row.setAttribute('data-ec-plugin-active', checkbox.checked ? '1' : '0');
      if (desc && desc.textContent) row.title = this.cleanAdvancedText(desc.textContent);

      Array.prototype.slice.call(label.childNodes).forEach(function (node) {
        if (node.nodeType === 3 && node.parentNode) node.parentNode.removeChild(node);
      });
      if (!label.querySelector('.ec-plugin-name')) {
        label.appendChild(self.advancedCreateEl(doc, 'span', 'ec-plugin-name', plugin.name));
        label.appendChild(self.advancedCreateEl(doc, 'span', 'ec-plugin-author', author || 'Lyrion Community'));
        label.appendChild(self.advancedCreateEl(doc, 'span', 'ec-plugin-version', plugin.version ? 'Version ' + plugin.version : 'Installed'));
        var hit = self.advancedCreateEl(doc, 'span', 'ec-plugin-switch-hit', '');
        hit.setAttribute('aria-hidden', 'true');
        hit.appendChild(self.advancedCreateEl(doc, 'span', 'ec-plugin-switch', ''));
        label.appendChild(hit);
      }

      if (footer) {
        footer.classList.remove('ec-lms-chrome-hidden');
        Array.prototype.slice.call(footer.childNodes).forEach(function (node) {
          if (node.nodeType === 3 && self.cleanAdvancedText(node.textContent) && node.parentNode) {
            node.parentNode.removeChild(node);
          }
        });
      }

      var image = row.querySelector('.pluginItem img:not(.pluginFooter img)');
      if (image) {
        image.classList.add('ec-plugin-icon-image');
        var syncFallback = function () {
          if (!image.classList.contains('pluginFallbackIcon') || row.querySelector('.ec-plugin-fallback-tile')) return;
          var tile = self.advancedCreateEl(doc, 'span', 'ec-plugin-fallback-tile', self.pluginIconText(plugin.name));
          image.parentNode.insertBefore(tile, image.nextSibling);
        };
        syncFallback();
        if (!image.__echoclassicFallbackListener) {
          image.__echoclassicFallbackListener = true;
          image.addEventListener('error', function () { setTimeout(syncFallback, 0); });
        }
      }
    },
    advancedPluginRows: function (doc) {
      if (!doc.querySelectorAll) return [];
      return Array.prototype.slice.call(doc.querySelectorAll('#pluginListPanel li.thumbwrap.selectorMarker'));
    },
    placeAdvancedPluginRow: function (doc, row) {
      var checkbox = row && row.querySelector && row.querySelector('input[type="checkbox"]');
      if (!checkbox) return;
      var group = doc.querySelector((checkbox.checked ? '#activePlugins' : '#inactivePlugins') + '>ul.thumbwrap');
      if (group && row.parentNode !== group) group.appendChild(row);
    },
    updateAdvancedPluginBands: function (doc, rows) {
      var groups = [
        { header: 'activePlugins_Header', list: 'activePlugins', active: true, label: 'Active' },
        { header: 'inactivePlugins_Header', list: 'inactivePlugins', active: false, label: 'Inactive' }
      ];
      var view = doc.defaultView;
      groups.forEach(function (group) {
        var header = doc.getElementById(group.header);
        var list = doc.getElementById(group.list);
        var matching = rows.filter(function (row) {
          var input = row.querySelector('input[type="checkbox"]');
          return input && input.checked === group.active;
        });
        var visible = matching.filter(function (row) {
          if (row.classList.contains('ec-plugin-filtered')) return false;
          return !view || !view.getComputedStyle || view.getComputedStyle(row).display !== 'none';
        });
        if (header) {
          header.textContent = group.label + ' \u00b7 ' + matching.length;
          if (header.parentNode && header.parentNode.classList) {
            header.parentNode.classList.toggle('ec-plugin-band-empty', visible.length === 0);
          }
        }
        if (list && list.classList) list.classList.toggle('ec-plugin-band-empty', visible.length === 0);
      });
    },
    applyAdvancedPluginFilters: function (doc) {
      var menu = doc.getElementById('homeMenu');
      if (!menu) return;
      var rows = this.advancedPluginRows(doc);
      var input = doc.getElementById('filterInput');
      var query = this.cleanAdvancedText(input && input.value).toLowerCase();
      var mode = menu.getAttribute('data-ec-plugin-filter') || 'all';
      var active = 0;
      rows.forEach(function (row) {
        var checkbox = row.querySelector('input[type="checkbox"]');
        var checked = !!(checkbox && checkbox.checked);
        if (checked) active++;
        row.setAttribute('data-ec-plugin-active', checked ? '1' : '0');
        var wrongState = mode === 'active' ? !checked : mode === 'inactive' ? checked : false;
        var wrongText = !!query && String(row.getAttribute('data-ec-plugin-label') || '').indexOf(query) < 0;
        row.classList.toggle('ec-plugin-filtered', wrongState || wrongText);
      });
      var count = doc.querySelector('.ec-plugin-count');
      if (count) count.textContent = rows.length + ' plugins \u00b7 ' + active + ' active';
      this.updateAdvancedPluginBands(doc, rows);
    },
    enhanceAdvancedPluginToolbar: function (doc, menu) {
      var self = this;
      var bar = doc.getElementById('pluginButtonBar');
      if (!bar) return;
      var initialMode = menu.getAttribute('data-ec-plugin-filter');
      if (!initialMode) {
        initialMode = doc.defaultView && doc.defaultView.innerWidth <= 860 ? 'active' : 'all';
        menu.setAttribute('data-ec-plugin-filter', initialMode);
      }
      var filter = bar.querySelector('.ec-plugin-filter');
      if (!filter) {
        filter = this.advancedCreateEl(doc, 'div', 'ec-plugin-filter', '');
        filter.setAttribute('role', 'group');
        filter.setAttribute('aria-label', 'Filter plugins by status');
        ['all', 'active', 'inactive'].forEach(function (mode) {
          var selected = mode === initialMode;
          var button = self.advancedCreateEl(doc, 'button', selected ? 'ec-selected' : '',
            mode.charAt(0).toUpperCase() + mode.slice(1));
          button.type = 'button';
          button.setAttribute('data-ec-plugin-filter', mode);
          button.setAttribute('aria-pressed', selected ? 'true' : 'false');
          button.addEventListener('click', function () {
            menu.setAttribute('data-ec-plugin-filter', mode);
            Array.prototype.slice.call(filter.querySelectorAll('button')).forEach(function (candidate) {
              var selected = candidate.getAttribute('data-ec-plugin-filter') === mode;
              candidate.classList.toggle('ec-selected', selected);
              candidate.setAttribute('aria-pressed', selected ? 'true' : 'false');
            });
            self.applyAdvancedPluginFilters(doc);
          });
          filter.appendChild(button);
        });
        bar.insertBefore(filter, bar.firstChild);
      }

      var count = bar.querySelector('.ec-plugin-count');
      if (!count) {
        count = this.advancedCreateEl(doc, 'span', 'ec-plugin-count', '');
        filter.parentNode.insertBefore(count, filter.nextSibling);
      }
      var search = doc.getElementById('filterInput');
      if (search) {
        var holder = search.parentNode;
        holder.classList.add('ec-plugin-search');
        Array.prototype.slice.call(holder.childNodes).forEach(function (node) {
          if (node.nodeType === 3 && node.parentNode) node.parentNode.removeChild(node);
        });
        search.placeholder = 'Search plugins';
        search.setAttribute('aria-label', 'Search plugins');
        search.__echoclassicDirtyTracking = true;
        if (!search.__echoclassicPluginFilter) {
          search.__echoclassicPluginFilter = true;
          search.addEventListener('input', function () { self.applyAdvancedPluginFilters(doc); });
          search.addEventListener('keyup', function () { self.applyAdvancedPluginFilters(doc); });
        }
      }
      var category = bar.querySelector('#filterChooser select');
      if (category) {
        category.setAttribute('aria-label', 'Plugin category');
        category.__echoclassicDirtyTracking = true;
        if (!category.__echoclassicPluginFilter) {
          category.__echoclassicPluginFilter = true;
          category.addEventListener('change', function () {
            setTimeout(function () { self.applyAdvancedPluginFilters(doc); }, 0);
          });
        }
      }
    },
    updateAdvancedPluginPending: function (doc) {
      var line = doc.getElementById('echoclassic-plugin-pending');
      var dirty = 0;
      Array.prototype.slice.call(doc.querySelectorAll('#settingsForm input,#settingsForm textarea,#settingsForm select')).forEach(function (input) {
        var type = String(input.type || '').toLowerCase();
        if (type === 'hidden' || type === 'submit' || type === 'button') return;
        var changed = type === 'checkbox' || type === 'radio'
          ? input.checked !== input.defaultChecked
          : input.value !== input.defaultValue;
        if (changed) dirty++;
      });
      if (line) {
        line.textContent = dirty === 0 ? 'No changes pending' :
          dirty === 1 ? '1 change pending' : dirty + ' changes pending';
      }
      return dirty;
    },
    enhanceAdvancedPluginFooter: function (doc) {
      var prefs = doc.getElementById('prefsSubmit');
      if (!prefs) return;
      var line = doc.getElementById('echoclassic-plugin-pending');
      if (!line) {
        line = this.advancedCreateEl(doc, 'span', 'ec-plugin-pending', 'No changes pending');
        line.id = 'echoclassic-plugin-pending';
        prefs.insertBefore(line, prefs.firstChild);
      }
      this.updateAdvancedPluginPending(doc);
    },
    enhanceNativePluginStore: function (doc) {
      var self = this;
      var menu = doc.getElementById && doc.getElementById('homeMenu');
      if (!menu) return;
      this.enhanceAdvancedPluginToolbar(doc, menu);
      this.advancedPluginRows(doc).forEach(function (row) {
        self.decorateAdvancedPluginCard(doc, row);
        var checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox && !checkbox.__echoclassicPluginStore) {
          checkbox.__echoclassicPluginStore = true;
          checkbox.addEventListener('change', function () {
            self.placeAdvancedPluginRow(doc, row);
            self.applyAdvancedPluginFilters(doc);
            self.updateAdvancedPluginPending(doc);
          });
        }
      });
      this.enhanceAdvancedPluginFooter(doc);
      try {
        var requested = sessionStorage.getItem('echoclassic.plugin-search.v1');
        var search = doc.getElementById('filterInput');
        if (requested && search) {
          search.value = requested;
          menu.setAttribute('data-ec-plugin-filter', 'all');
          sessionStorage.removeItem('echoclassic.plugin-search.v1');
        }
      } catch (e) {}
      this.applyAdvancedPluginFilters(doc);
    },
    advancedCheckboxName: function (doc, input) {
      var row = this.advancedClosest(input, 'tr') || this.advancedClosest(input, '.settingGroup') || input.parentNode;
      var path = row && row.querySelector && row.querySelector('input[type="text"]');
      if (path && this.cleanAdvancedText(path.value)) {
        return this.tr('Scan {folder} for music').replace('{folder}', this.cleanAdvancedText(path.value));
      }
      var label = row && row.querySelector && row.querySelector('.settingLabel,.prefHead,label,th');
      var text = this.cleanAdvancedText(label && label.textContent);
      if (!text && input.name) text = this.advancedTitleCase(String(input.name).replace(/^pref_/, '').replace(/[_-]+/g, ' '));
      return text || this.tr('Setting');
    },
    decorateAdvancedCheckboxes: function (doc) {
      if (!doc.querySelectorAll) return;
      var self = this;
      Array.prototype.slice.call(doc.querySelectorAll('input[type="checkbox"]')).forEach(function (input, index) {
        if (self.advancedClosest(input, '.ec-plugin-card') || input.__echoclassicNativeSwitch) return;
        input.__echoclassicNativeSwitch = true;
        if (!input.id) input.id = 'echoclassic-setting-' + index;
        if (!input.getAttribute('aria-label') && !(input.labels && input.labels.length)) {
          input.setAttribute('aria-label', self.advancedCheckboxName(doc, input));
        }
        input.classList.add('ec-native-checkbox');
        var hasLabel = !!(input.labels && input.labels.length);
        var hit = self.advancedCreateEl(doc, hasLabel ? 'span' : 'label', 'ec-native-switch-hit', '');
        if (!hasLabel) hit.setAttribute('for', input.id);
        hit.setAttribute('aria-hidden', 'true');
        hit.appendChild(self.advancedCreateEl(doc, 'span', 'ec-native-switch', ''));
        if (input.parentNode) input.parentNode.insertBefore(hit, input.nextSibling);
      });
    },
    advancedTableHeaders: function (table) {
      if (!table || !table.querySelectorAll) return [];
      return Array.prototype.slice.call(table.querySelectorAll('tr:first-child th,tr:first-child td')).map(function (cell) {
        return String(cell.textContent || '').replace(/\s+/g, ' ').trim();
      });
    },
    advancedNewLabel: function (doc, owner, feature, before) {
      if (!owner || !owner.querySelector || owner.querySelector('.ec-feature-new[data-ec-feature="' + feature + '"]')) return;
      var badge = this.advancedCreateEl(doc, 'span', 'ec-feature-new', this.tr('New'));
      badge.setAttribute('data-ec-feature', feature);
      badge.setAttribute('aria-label', this.tr('New feature'));
      owner.insertBefore(badge, before || owner.firstChild);
    },
    decorateAdvancedConversionTables: function (doc) {
      if (!doc.querySelectorAll) return;
      var self = this;
      Array.prototype.slice.call(doc.querySelectorAll('table')).forEach(function (table) {
        if (table.classList.contains('ec-conversion-table')) return;
        var headers = self.advancedTableHeaders(table).join(' ').toLowerCase();
        if (!table.querySelector('select') || headers.indexOf('stream format') < 0 || headers.indexOf('decoder') < 0) return;
        table.classList.add('ec-conversion-table');
        var headerRow = table.querySelector('tr');
        if (headerRow) headerRow.classList.add('ec-conversion-header');
        var wrap = self.advancedCreateEl(doc, 'div', 'ec-conversion-wrap', '');
        if (table.parentNode) {
          table.parentNode.insertBefore(wrap, table);
          wrap.appendChild(table);
          self.advancedNewLabel(doc, wrap.parentNode, 'conversion-table', wrap);
        }
        var labels = self.advancedTableHeaders(table);
        var sourceFormat = '';
        Array.prototype.slice.call(table.querySelectorAll('tr')).slice(1).forEach(function (row) {
          var cells = Array.prototype.slice.call(row.children || []);
          var rowText = self.cleanAdvancedText(row.textContent);
          if (!row.querySelector('select') && !rowText) {
            row.classList.add('ec-conversion-empty');
            return;
          }
          var ownFormat = self.cleanAdvancedText(cells[0] && cells[0].textContent);
          if (ownFormat) sourceFormat = ownFormat;
          row.setAttribute('data-ec-format', sourceFormat || self.tr('File format'));
          cells.forEach(function (cell, index) {
            if (!cell.getAttribute('data-ec-label')) cell.setAttribute('data-ec-label', labels[index] || self.tr('Value'));
          });
        });
      });
    },
    removeAdvancedNativeScanMarks: function (node) {
      if (!node || !node.childNodes) return;
      var self = this;
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          child.textContent = String(child.textContent || '').replace(/[.\u2022\u25aa\u25ab\u25a0\u25a1\u2580-\u259f]{8,}/g, '');
          return;
        }
        if (child.nodeType !== 1) return;
        var marker = String((child.id || '') + ' ' + (child.className || '')).toLowerCase();
        var markerText = self.cleanAdvancedText(child.textContent);
        if (/\b(?:progressbar|progress-bar|scanprogress|scan-progress)\b/.test(marker) ||
            (/^[.\u2022\u25aa\u25ab\u25a0\u25a1\u2580-\u259f\s]{8,}$/.test(markerText) && markerText.length >= 8)) {
          child.classList.add('ec-native-scan-progress');
          return;
        }
        self.removeAdvancedNativeScanMarks(child);
      });
    },
    advancedScanProgress: function (text) {
      var value = this.cleanAdvancedText(text);
      var count = value.match(/(?:\(|\b)(\d+)\s+of\s+(\d+)(?:\)|\b)/i);
      var complete = /\b(?:complete|completed|conclu[ií]do|finished)\b/i.test(value);
      var failed = /\b(?:failed|error|falh\x6fu|err\x6f)\b/i.test(value);
      var now = count ? parseInt(count[1], 10) : null;
      var total = count ? parseInt(count[2], 10) : null;
      return {
        text: value,
        now: now,
        total: total,
        percent: total > 0 ? Math.max(0, Math.min(100, Math.round(now * 100 / total))) : null,
        complete: complete,
        failed: failed,
        active: !complete && !failed && (/\b(?:scanning|working|running|processing|indexing|looking|building|procurando|criando|verificando)\b/i.test(value) || (count && now < total))
      };
    },
    scanJournalRead: function () {
      try {
        var raw = window.localStorage && window.localStorage.getItem(ECHOCLASSIC_SCAN_JOURNAL_KEY);
        var value = raw ? JSON.parse(raw) : [];
        return Array.isArray(value) ? value.slice(-ECHOCLASSIC_SCAN_JOURNAL_LIMIT) : [];
      } catch (e) { return []; }
    },
    scanJournalWrite: function (entries) {
      try {
        if (window.localStorage) window.localStorage.setItem(ECHOCLASSIC_SCAN_JOURNAL_KEY,
          JSON.stringify(entries.slice(-ECHOCLASSIC_SCAN_JOURNAL_LIMIT)));
      } catch (e) {}
    },
    scanJournalSafe: function (text) {
      return this.cleanAdvancedText(text).replace(/https?:\/\/\S+/ig, '[URL removed]')
        .replace(/[?&](?:password|pass|token|secret|apikey|api_key)=[^&\s]*/ig, '')
        .slice(0, 220);
    },
    scanJournalHash: function (text) {
      var hash = 2166136261;
      String(text || '').split('').forEach(function (ch) {
        hash ^= ch.charCodeAt(0);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
      });
      return (hash >>> 0).toString(16);
    },
    scanJournalRun: function (doc) {
      var marked = doc.body && doc.body.getAttribute && doc.body.getAttribute('data-scan-run');
      if (marked) return this.scanJournalSafe(marked);
      var now = new Date();
      return 'scan-' + now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
    },
    scanRetryCapabilities: function (doc) {
      var body = doc.body;
      return {
        folder: !!(body && body.getAttribute && body.getAttribute('data-echo-retry-folder') === 'true'),
        all: !!(body && body.getAttribute && body.getAttribute('data-echo-retry-all') === 'true')
      };
    },
    scanJournalEntries: function (doc, gauges) {
      var entries = this.scanJournalRead();
      var run = this.scanJournalRun(doc);
      var self = this;
      var capabilities = this.scanRetryCapabilities(doc);
      gauges.filter(function (entry) { return entry.info.failed; }).forEach(function (entry, index) {
        var safe = self.scanJournalSafe(entry.info.text);
        var id = self.scanJournalHash(run + '|' + safe);
        var found = entries.filter(function (item) { return item.id === id; })[0];
        if (found) {
          found.reason = safe;
          found.lastSeen = new Date().toISOString();
          return;
        }
        entries.push({ id: id, timestamp: new Date().toISOString(), lastSeen: new Date().toISOString(),
          scanRun: run, stage: 'Media scan', item: safe, reason: safe,
          retryable: capabilities.folder || capabilities.all, attempts: 0, finalState: 'failed', ignored: false });
      });
      this.scanJournalWrite(entries);
      return entries;
    },
    renderScanJournal: function (doc, parent, gauges) {
      var self = this;
      var entries = this.scanJournalEntries(doc, gauges);
      var active = entries.filter(function (item) { return !item.ignored; });
      var ignored = entries.filter(function (item) { return item.ignored; });
      var journal = parent.querySelector('.ec-scan-journal');
      if (!journal) {
        journal = this.advancedCreateEl(doc, 'section', 'ec-scan-journal', '');
        journal.setAttribute('aria-labelledby', 'ec-scan-journal-title');
        parent.appendChild(journal);
      }
      while (journal.firstChild) journal.removeChild(journal.firstChild);
      var head = this.advancedCreateEl(doc, 'div', 'ec-scan-journal-head', '');
      var title = this.advancedCreateEl(doc, 'strong', '', this.tr('Scan errors'));
      title.id = 'ec-scan-journal-title';
      head.appendChild(title);
      head.appendChild(this.advancedCreateEl(doc, 'span', 'ec-scan-journal-count',
        active.length ? String(active.length) : this.tr('None')));
      journal.appendChild(head);
      var retry = this.scanRetryCapabilities(doc);
      if (retry.all && active.some(function (item) { return item.retryable; })) {
        var retryAll = this.advancedCreateEl(doc, 'button', 'ec-scan-journal-clear', this.tr('Retry all'));
        retryAll.type = 'button';
        retryAll.addEventListener('click', function () { self.scanRetryAll(doc, active); });
        journal.appendChild(retryAll);
      }
      var serverState = this.cleanAdvancedText((doc.querySelector('#scanStatus,#scanstatus,.scanStatus,.scanstatus,[data-scan-status]') || {}).textContent);
      var note = this.advancedCreateEl(doc, 'div', 'ec-scan-journal-note', active.length
        ? this.tr('The scan continues automatically after recoverable errors.')
        : this.tr('No scan errors recorded.'));
      if (/\b(?:fatal|stopped|terminated|aborted)\b/i.test(serverState)) {
        note.textContent = this.tr('The scan stopped. Start it again from LMS settings.');
      } else if (doc.body && doc.body.getAttribute && doc.body.getAttribute('data-scan-disconnected') === 'true') {
        note.textContent = this.tr('The scan status is unavailable while the server is disconnected.');
      }
      note.setAttribute('role', 'status');
      journal.appendChild(note);
      active.forEach(function (item) {
        var row = self.advancedCreateEl(doc, 'div', 'ec-scan-error-row', '');
        var copy = self.advancedCreateEl(doc, 'div', 'ec-scan-error-copy', '');
        copy.appendChild(self.advancedCreateEl(doc, 'strong', '', item.item));
        copy.appendChild(self.advancedCreateEl(doc, 'span', 'ec-scan-error-meta',
          item.reason + ' · ' + self.tr('Not retryable by this LMS')));
        row.appendChild(copy);
        var actions = self.advancedCreateEl(doc, 'div', 'ec-scan-error-actions', '');
        var retry = self.scanRetryCapabilities(doc);
        if (retry.folder && item.retryable) {
          var folder = self.advancedCreateEl(doc, 'button', '', self.tr('Retry folder'));
          folder.type = 'button';
          folder.addEventListener('click', function () { self.scanRetry(doc, item, 'folder'); });
          actions.appendChild(folder);
        }
        var ignore = self.advancedCreateEl(doc, 'button', '', self.tr('Ignore'));
        ignore.type = 'button';
        ignore.addEventListener('click', function () {
          item.ignored = true; item.finalState = 'ignored'; self.scanJournalWrite(entries);
          self.renderScanJournal(doc, parent, gauges);
        });
        actions.appendChild(ignore);
        row.appendChild(actions);
        journal.appendChild(row);
      });
      if (ignored.length) {
        var history = this.advancedCreateEl(doc, 'details', 'ec-scan-journal-note', '');
        var summary = this.advancedCreateEl(doc, 'summary', '',
          this.tr('Ignored errors') + ' (' + ignored.length + ')');
        history.appendChild(summary);
        ignored.forEach(function (item) {
          history.appendChild(self.advancedCreateEl(doc, 'div', 'ec-scan-error-meta', item.item));
        });
        journal.appendChild(history);
        var clear = this.advancedCreateEl(doc, 'button', 'ec-scan-journal-clear',
          this.tr('Clear ignored') + ' (' + ignored.length + ')');
        clear.type = 'button';
        clear.addEventListener('click', function () {
          if (window.confirm && !window.confirm(self.tr('Clear ignored scan errors?'))) return;
          self.scanJournalWrite(entries.filter(function (item) { return !item.ignored; }));
          self.renderScanJournal(doc, parent, gauges);
        });
        journal.appendChild(clear);
      }
    },
    scanRetry: function (doc, item, kind) {
      var fn = kind === 'folder' && doc.__echoclassicRetryFolder;
      if (typeof fn !== 'function') return;
      var entries = this.scanJournalRead();
      entries.forEach(function (stored) {
        if (stored.id !== item.id) return;
        stored.attempts = (stored.attempts || 0) + 1;
        stored.finalState = 'retrying';
      });
      this.scanJournalWrite(entries);
      fn(item.item);
    },
    scanRetryAll: function (doc, entries) {
      var fn = doc.__echoclassicRetryAll;
      if (typeof fn !== 'function') return;
      var retryIds = {};
      entries.filter(function (item) { return item.retryable && !item.ignored; }).forEach(function (item) {
        retryIds[item.id] = true;
      });
      var stored = this.scanJournalRead();
      stored.forEach(function (item) {
        if (!retryIds[item.id]) return;
        item.attempts = (item.attempts || 0) + 1;
        item.finalState = 'retrying';
      });
      this.scanJournalWrite(stored);
      fn(entries.filter(function (item) { return item.retryable && !item.ignored; }));
    },
    decorateAdvancedScanDetails: function (doc) {
      if (!doc.querySelectorAll) return;
      var self = this;
      var roots = [];
      Array.prototype.slice.call(doc.querySelectorAll('th,td,h1,h2,h3,.prefHead,.settingLabel,legend')).forEach(function (label) {
        if (!/media\s+scan\s+details/i.test(self.cleanAdvancedText(label.textContent))) return;
        var root = self.advancedClosest(label, 'tr') || self.advancedClosest(label, '.settingGroup') ||
          self.advancedClosest(label, '.settingSection') || self.advancedClosest(label, 'table');
        if (root && roots.indexOf(root) < 0) roots.push(root);
      });
      if (!roots.length) {
        Array.prototype.slice.call(doc.querySelectorAll('table,.settingGroup,.settingSection')).forEach(function (root) {
          var text = self.cleanAdvancedText(root.textContent);
          var counts = text.match(/\b\d+\s+of\s+\d+\b/ig) || [];
          if (counts.length >= 2 && /\b(?:complete|scanning|processing|finished)\b/i.test(text)) roots.push(root);
        });
      }
      if (!roots.length) return;
      var candidates = [];
      roots.forEach(function (root) {
        Array.prototype.slice.call(root.querySelectorAll('td,li,.prefs>div')).forEach(function (node) {
          if (candidates.indexOf(node) < 0) candidates.push(node);
        });
      });
      var gauges = [];
      candidates.forEach(function (node) {
        if (!node.parentNode || (self.advancedClosest(node, '.ec-scan-gauge') && !node.classList.contains('ec-scan-gauge')) || node.querySelector('.ec-scan-gauge')) return;
        var existingCopy = node.classList.contains('ec-scan-gauge') && node.querySelector('.ec-scan-copy');
        var info = self.advancedScanProgress(existingCopy ? existingCopy.textContent : node.textContent);
        if (!info.text || (!/\b\d+\s+of\s+\d+\b/i.test(info.text) && !/\b(?:complete|scanning|processing|failed)\b/i.test(info.text))) return;
        if (info.text.length > 240 || node.querySelectorAll('td,li,.settingGroup').length) return;
        if (existingCopy) {
          node.classList.toggle('ec-scan-complete', info.complete);
          node.classList.toggle('ec-scan-failed', info.failed);
          var existingFill = node.querySelector('.ec-scan-fill');
          if (existingFill) existingFill.style.setProperty('--ec-scan-progress', info.percent === null ? (info.active ? '34%' : '0%') : info.percent + '%');
          node.setAttribute('aria-label', info.text);
          if (info.total !== null) {
            node.setAttribute('aria-valuemax', String(info.total));
            node.setAttribute('aria-valuenow', String(info.now));
            node.removeAttribute('aria-valuetext');
          }
          gauges.push({ node: node, info: info });
          return;
        }
        node.classList.add('ec-scan-gauge');
        if (info.complete) node.classList.add('ec-scan-complete');
        if (info.failed) node.classList.add('ec-scan-failed');
        var copy = self.advancedCreateEl(doc, 'span', 'ec-scan-copy', '');
        while (node.firstChild) copy.appendChild(node.firstChild);
        self.removeAdvancedNativeScanMarks(copy);
        node.appendChild(copy);
        var track = self.advancedCreateEl(doc, 'span', 'ec-scan-track', '');
        var fill = self.advancedCreateEl(doc, 'span', 'ec-scan-fill', '');
        fill.style.setProperty('--ec-scan-progress', info.percent === null ? (info.active ? '34%' : '0%') : info.percent + '%');
        track.appendChild(fill);
        node.appendChild(track);
        node.setAttribute('role', 'progressbar');
        node.setAttribute('aria-label', info.text);
        node.setAttribute('aria-valuemin', '0');
        if (info.total !== null) {
          node.setAttribute('aria-valuemax', String(info.total));
          node.setAttribute('aria-valuenow', String(info.now));
        } else {
          node.setAttribute('aria-valuetext', info.active ? self.tr('Working') : info.text);
        }
        Array.prototype.slice.call(copy.querySelectorAll('img,hr,[style*="repeat"],[style*="background"]')).forEach(function (nativeBar) {
          nativeBar.classList.add('ec-native-scan-progress');
        });
        gauges.push({ node: node, info: info });
      });
      if (!gauges.length) return;
      var parent = gauges[0].node.parentNode;
      if (parent && parent.classList) parent.classList.add('ec-scan-region');
      if (parent) self.advancedNewLabel(doc, parent, 'scan-gauges', gauges[0].node);
      if (parent) self.renderScanJournal(doc, parent, gauges);
      var active = gauges.filter(function (entry) { return entry.info.active; })[0];
      if (!active || !parent) return;
      var serverDetail = doc.querySelector('#scanStatus,#scanstatus,.scanStatus,.scanstatus,[data-scan-status]');
      var detail = this.cleanAdvancedText(serverDetail && serverDetail.textContent);
      var activity = parent.querySelector('.ec-scan-activity');
      if (!activity) {
        activity = self.advancedCreateEl(doc, 'div', 'ec-scan-activity', '');
        activity.setAttribute('role', 'status');
        activity.setAttribute('aria-live', 'polite');
        activity.setAttribute('aria-atomic', 'true');
        activity.appendChild(self.advancedCreateEl(doc, 'span', 'ec-scan-activity-label', self.tr('Now scanning')));
        activity.appendChild(self.advancedCreateEl(doc, 'strong', 'ec-scan-activity-main', ''));
        activity.appendChild(self.advancedCreateEl(doc, 'span', 'ec-scan-activity-detail', ''));
        parent.insertBefore(activity, gauges[0].node);
      }
      activity.querySelector('.ec-scan-activity-main').textContent = active.info.text;
      var journalCount = self.scanJournalRead().filter(function (item) { return !item.ignored; }).length;
      activity.querySelector('.ec-scan-activity-detail').textContent = (journalCount
        ? self.tr('Continuing after recoverable errors.') + ' ' : '') +
        (detail || self.tr('The server is reporting this activity now.'));
    },
    buildAdvancedIpadShell: function (frame, doc) {
      if (!doc || !doc.body || !doc.createElement || !doc.querySelector) return;
      var self = this;
      var root = doc.getElementById('settings') || doc.getElementById('content') ||
        doc.querySelector('.settingsPage') || doc.querySelector('.content') ||
        doc.querySelector('form') || null;
      if (root && root.classList) root.classList.add('ec-advanced-content');
      this.hideAdvancedLmsChrome(doc, root);

      var selector = doc.getElementById('choose_setting');
      var selectedLabel = 'Basic Settings';
      if (selector && selector.options && selector.options.length) {
        selectedLabel = this.advancedTitleCase(selector.options[selector.selectedIndex >= 0 ? selector.selectedIndex : 0].text);
      }
      var oldHero = doc.getElementById('echoclassic-advanced-hero');
      if (oldHero && oldHero.parentNode) oldHero.parentNode.removeChild(oldHero);
      var pluginStore = this.advancedIsPluginStore(selectedLabel);
      if (doc.body.classList) {
        doc.body.classList.toggle('ec-plugin-store', pluginStore);
      }
      /* The plugin store decorates LMS's authoritative #homeMenu form in
         place. Plugin list nodes, checkboxes, category filtering and submit
         controls retain their native ownership and wiring. */
      if (pluginStore) this.enhanceNativePluginStore(doc);

      if (!selector || !selector.options || !selector.options.length) return;
      var toggle = doc.getElementById('echoclassic-rail-toggle');
      if (!toggle) {
        toggle = this.advancedCreateEl(doc, 'button', '', this.tr('Settings pages') + ' · ' + selectedLabel);
        toggle.id = 'echoclassic-rail-toggle';
        toggle.type = 'button';
        toggle.setAttribute('aria-controls', 'echoclassic-advanced-rail');
        toggle.setAttribute('aria-expanded', 'false');
        doc.body.insertBefore(toggle, doc.body.firstChild);
        toggle.addEventListener('click', function () {
          var open = !doc.body.classList.contains('ec-rail-open');
          doc.body.classList.toggle('ec-rail-open', open);
          toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
          if (open) {
            var drawerSearch = doc.querySelector('#echoclassic-advanced-rail input[type="search"]');
            if (drawerSearch) drawerSearch.focus();
          }
        });
      } else {
        toggle.textContent = this.tr('Settings pages') + ' · ' + selectedLabel;
      }
      var scrim = doc.getElementById('echoclassic-rail-scrim');
      if (!scrim) {
        scrim = this.advancedCreateEl(doc, 'button', '', '');
        scrim.id = 'echoclassic-rail-scrim';
        scrim.type = 'button';
        scrim.setAttribute('aria-label', this.tr('Close settings pages'));
        doc.body.insertBefore(scrim, doc.body.firstChild);
        scrim.addEventListener('click', function () {
          doc.body.classList.remove('ec-rail-open');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.focus();
        });
      }
      if (!doc.__echoclassicRailKeyboard) {
        doc.__echoclassicRailKeyboard = true;
        doc.addEventListener('keydown', function (event) {
          if ((event.key !== 'Escape' && event.key !== 'Esc') ||
              !doc.body.classList.contains('ec-rail-open')) return;
          doc.body.classList.remove('ec-rail-open');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.focus();
          event.preventDefault();
          event.stopPropagation();
        });
      }
      var rail = doc.getElementById('echoclassic-advanced-rail');
      if (!rail) {
        rail = this.advancedCreateEl(doc, 'aside', '', '');
        rail.id = 'echoclassic-advanced-rail';
        doc.body.insertBefore(rail, doc.body.firstChild);
      }
      var options = Array.prototype.slice.call(selector.options);
      var railSignature = options.map(function (option) {
        return String(option.value || '') + '\u241f' + String(option.text || option.label || '');
      }).join('\u241e');
      var selectedValue = String(selector.value || '');
      if (rail.getAttribute('data-ec-options') === railSignature) {
        Array.prototype.slice.call(rail.querySelectorAll('.ec-nav-row')).forEach(function (row) {
          row.classList.toggle('ec-active', row.getAttribute('data-ec-value') === selectedValue);
        });
        return;
      }
      var previousList = rail.querySelector('.ec-rail-list');
      var previousScrollTop = previousList ? previousList.scrollTop : 0;
      var previousSearch = rail.querySelector('input[type="search"]');
      var previousQuery = previousSearch ? previousSearch.value : '';
      rail.innerHTML = '<div class="ec-rail-top"><div class="ec-rail-search">' +
        '<span class="ec-rail-mag" aria-hidden="true"></span>' +
        '<input type="search" placeholder="Search settings pages" aria-label="Search settings pages">' +
        '<button type="button" class="ec-rail-clear" aria-label="Clear settings search" hidden>×</button></div></div>' +
        '<div class="ec-rail-identity"><span class="ec-server-dot" aria-hidden="true"></span>' +
        '<span><b>Music Player</b><span>Server settings, plugins, network and library</span></span></div>' +
        '<div class="ec-rail-list"></div>';
      rail.setAttribute('data-ec-options', railSignature);

      var list = rail.querySelector('.ec-rail-list');
      var server = this.advancedCreateEl(doc, 'div', 'ec-rail-label', 'Server');
      var plugins = this.advancedCreateEl(doc, 'div', 'ec-rail-label', 'Plugins');
      var serverRows = [];
      var pluginRows = [];
      options.forEach(function (option) {
        var row = self.advancedBuildRailRow(doc, option, selector);
        if (self.advancedIsPluginSection(option.text || option.label || '')) pluginRows.push(row);
        else serverRows.push(row);
      });
      list.appendChild(server);
      serverRows.forEach(function (row) { list.appendChild(row); });
      if (pluginRows.length) {
        list.appendChild(plugins);
        pluginRows.forEach(function (row) { list.appendChild(row); });
      }

      var search = rail.querySelector('input[type="search"]');
      var clear = rail.querySelector('.ec-rail-clear');
      if (search) {
        search.placeholder = this.tr('Search settings pages');
        search.setAttribute('aria-label', this.tr('Search settings pages'));
        if (clear) clear.setAttribute('aria-label', this.tr('Clear settings search'));
        search.__echoclassicDirtyTracking = true;
        var filterRows = function () {
          var query = String(search.value || '').toLowerCase().trim();
          Array.prototype.slice.call(rail.querySelectorAll('.ec-nav-row')).forEach(function (row) {
            row.classList.toggle('ec-hidden', !!query && String(row.getAttribute('data-ec-label') || '').indexOf(query) < 0);
          });
          if (clear) clear.hidden = !query;
        };
        search.addEventListener('input', filterRows);
        if (clear) clear.addEventListener('click', function () {
          search.value = '';
          filterRows();
          search.focus();
        });
        if (previousQuery) {
          search.value = previousQuery;
          filterRows();
        }
      }
      if (previousScrollTop) list.scrollTop = previousScrollTop;
    },
    remapAdvancedIcons: function (doc) {
      if (!doc.getElementsByTagName) return;
      Array.prototype.slice.call(doc.getElementsByTagName('img')).forEach(function (img) {
        if (/\/html\/images\/b_(play|add|edit|delete|up|down|next|prev|queue)\.gif/.test(img.src)) {
          img.width = 24;
          img.height = 24;
        }
      });
    },
    enhanceAdvancedFrame: function (frame, doc) {
      if (!doc || !doc.body || !doc.documentElement) return;
      if (doc.documentElement.classList) doc.documentElement.classList.add('echoclassic-lms-settings');
      if (doc.body.classList) doc.body.classList.add('echoclassic-lms-settings-body');
      if (doc.documentElement.style && doc.documentElement.style.setProperty) {
        doc.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px');
      }
      this.normalizeAdvancedLabels(doc);
      this.buildAdvancedIpadShell(frame, doc);
      this.installAdvancedLinkController(frame, doc);
      this.installAdvancedDirtyTracking(doc);
      this.installAdvancedSectionController(frame, doc);
      this.installAdvancedExpanders(doc);
      this.decorateAdvancedCheckboxes(doc);
      this.decorateAdvancedConversionTables(doc);
      this.decorateAdvancedScanDetails(doc);
      this.remapAdvancedIcons(doc);
    },
    scheduleAdvancedTheme: function (frame) {
      var self = this;
      setTimeout(function () {
        self.themeAdvancedFrame({ target: frame || self.$refs.advancedFrame });
      }, 120);
    },
    themeAdvancedFrame: function (event) {
      var frame = (event && event.target) || this.$refs.advancedFrame;
      if (!frame) return false;

      var doc;
      try {
        doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
      } catch (e) {
        return false;
      }
      if (!doc || !doc.documentElement || !doc.head) return false;

      var source = null;
      if (window.getComputedStyle) {
        source = window.getComputedStyle(document.body || document.documentElement);
      }
      if (!source) return false;

      for (var i = 0; i < ECHOCLASSIC_ADVANCED_THEME_TOKENS.length; i++) {
        var key = ECHOCLASSIC_ADVANCED_THEME_TOKENS[i];
        var value = source.getPropertyValue(key);
        if (value) doc.documentElement.style.setProperty(key, value);
      }

      doc.documentElement.setAttribute('data-echoclassic-theme', this.ui.theme || 'light');
      doc.documentElement.setAttribute('data-echoclassic-scheme', this.ui.colorScheme || 'blue');
      doc.documentElement.setAttribute('data-echoclassic-font', this.ui.fontFamily || 'system');
      if (doc.body) {
        doc.body.setAttribute('data-echoclassic-page', 'advanced-settings');
      }

      var style = doc.getElementById('echoclassic-advanced-theme');
      if (!style) {
        style = doc.createElement('style');
        style.id = 'echoclassic-advanced-theme';
        style.type = 'text/css';
        doc.head.appendChild(style);
      }
      style.textContent = this.advancedFrameCss();
      this.enhanceAdvancedFrame(frame, doc);
      this.watchAdvancedFrameBody(frame, doc);
      return true;
    },
    applyAdvancedFrame: function () {
      var frame = this.$refs.advancedFrame;
      if (!frame) return false;
      var doc;
      try {
        doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
      } catch (e) {
        return false;
      }
      if (!doc || !doc.querySelector) return false;
      var submit = doc.querySelector('#saveSettings,#save,input[type="submit"],button[type="submit"]');
      if (submit && submit.click) {
        submit.click();
        return true;
      }
      var form = doc.querySelector('form');
      if (form && form.submit) {
        form.submit();
        return true;
      }
      return false;
    },
    watchAdvancedFrameBody: function (frame, doc) {
      this.stopAdvancedThemeObserver();
      if (!window.MutationObserver || !doc || !doc.documentElement) return;
      var self = this;
      var pending = false;
      this.advancedThemeObserver = new MutationObserver(function () {
        var current;
        try {
          current = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
        } catch (e) {
          return;
        }
        if (current !== doc) return;
        if (doc.body && doc.body.getAttribute('data-echoclassic-page') !== 'advanced-settings') {
          doc.body.setAttribute('data-echoclassic-page', 'advanced-settings');
        }
        if (!pending) {
          pending = true;
          setTimeout(function () {
            pending = false;
            var observer = self.advancedThemeObserver;
            if (!observer) return;
            /* The enhancer changes the iframe DOM itself (rail, switches and
               plugin cards). Disconnect while applying those synchronous
               changes so the observer cannot schedule an endless rebuild of
               its own output and replace a list while the user is scrolling. */
            observer.disconnect();
            try {
              self.enhanceAdvancedFrame(frame, doc);
            } finally {
              if (self.advancedThemeObserver === observer && doc.documentElement) {
                observer.observe(doc.documentElement, { childList: true, characterData: true, subtree: true });
              }
            }
          }, 60);
        }
      });
      this.advancedThemeObserver.observe(doc.documentElement, { childList: true, characterData: true, subtree: true });
    },
    /* Padrao ARIA de radiogroup: as setas movem selecao e foco, e so o item
       marcado fica na ordem de tabulacao. Sem isto eram 14 paradas de Tab.
       N6 (3.2.6b, revisado): reforco defensivo, nao correcao de uma regressao
       observada -- em todo radiogroup que esta funcao atende hoje, os botoes
       role="radio" sao filhos DIRETOS da div role="radiogroup", entao
       target.parentNode ja e essa mesma div e nenhum grupo vizinho a
       compartilha; o parentNode sozinho ja escopava certo para esse marcado.
       Subir ate o ancestral [role="radiogroup"] mais proximo com closest()
       para de depender dessa suposicao de estrutura direta, o que importa
       porque nem todo call site tem o wrapper marcado: os botoes de "Default
       player" nesta mesma tela nao usam role="radiogroup" ao redor (C4,
       3.2.6c, deu esse wrapper a "Queue artwork"), entao closest() nao
       encontra nada e cai no parentNode como antes -- por isso o fallback
       continua aqui. */
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
      var target = event.currentTarget;
      var group = (target.closest && target.closest('[role="radiogroup"]')) || target.parentNode;
      var buttons = group ? group.querySelectorAll('[role="radio"]') : null;
      if (buttons && buttons[next]) buttons[next].focus();
    },
    /* Which Appearance screen is open drives the template branch directly
       (ui.appearanceScreen); the frame pushed onto LmsNav.stacks.settings
       carries the same key plus the label the nav bar shows as the title and
       uses to build the back label of whatever screen sits above it -- the
       generic per-tab wiring already in app.js (title/back computeds, goBack)
       needs nothing extra to make Back work, hardware or on-screen. */
    appearanceScreenLabel: function (screen) {
      var labels = {
        players: 'Player layout'
      };
      return labels[screen] || '';
    },
    openAppearanceScreen: function (screen) {
      var self = this;
      this.appearanceReturnScroll = this.$el ? this.$el.scrollTop : 0;
      LmsNav.push('settings', { label: this.appearanceScreenLabel(screen), screen: screen });
      this.ui.appearanceScreen = screen;
      this.$nextTick(function () {
        if (self.$el) self.$el.scrollTop = 0;
      });
    },
    /* Reconciles ui.appearanceScreen with LmsNav.top('settings'); factored
       out of the 'nav.settings.length' watch (immediate:true) so it also
       runs once on every mount, and so it is callable directly in tests
       without a real Vue instance. Handles an empty stack (top() falsy ->
       null), a stack left more than one frame deep (top() is whatever frame
       is now on top, not necessarily the one appearanceScreen last saw), and
       a stack that changed entirely while the component was unmounted --
       all three collapse into "read the current top and mirror it". */
    syncAppearanceScreen: function () {
      var top = LmsNav.top('settings');
      this.ui.appearanceScreen = (top && top.screen) || null;
    },
    syncSettingsScreen: function () {
      var top = LmsNav.top('settings');
      var advanced = !!(top && top.advanced);
      var wasAdvanced = this.ui.advancedSettings;
      var wasAppearance = !!this.ui.appearanceScreen;
      this.ui.advancedSettings = advanced;
      this.ui.appearanceScreen = advanced ? null : ((top && top.screen) || null);
      if (advanced) LmsUi.applyAdvancedSettings = this.applyAdvancedFrame;
      else if (LmsUi.applyAdvancedSettings === this.applyAdvancedFrame) LmsUi.applyAdvancedSettings = null;
      if (wasAdvanced && !advanced) this.restoreSettingsScroll();
      if (wasAppearance && !advanced && !this.ui.appearanceScreen) this.restoreAppearanceScroll();
    },
    /* Theme selection goes through ui.js so the app theme, the downgrade
       dark boolean and the per-theme gauge style all move together. */
    selectTheme: function (key) {
      if (key !== this.ui.theme) LmsUi.setTheme(key);
    },
    setPlayerPosition: function (key) { LmsUi.setPlayerPosition(key); },
    /* SPL-3: the nine per-surface wrappers (setFullTheme ... setMiniFont) and
       the three per-surface follow toggles are gone. One form is on screen at
       a time, so the surface is a parameter, not nine method names -- and the
       setters underneath are unchanged, which is what keeps every stored key
       and every 3.2.8 export intact. */
    setAppearanceSurface: function (key) { this.appearanceSurface = key; },
    scopedLabel: function (label) {
      return this.tr(label) + ' — ' + this.tr(this.surfaceLabel);
    },
    setSurfaceTheme: function (key) { LmsUi.setSurfaceTheme(this.appearanceSurface, key); },
    setSurfaceScheme: function (key) { LmsUi.setSurfaceScheme(this.appearanceSurface, key); },
    setSurfaceFont: function (key) { LmsUi.setSurfaceFont(this.appearanceSurface, key); },
    setSurfaceFollowsApp: function (on) {
      LmsUi.setSurfaceFollowsApp(this.appearanceSurface, on);
    },
    /* The master switch drives all three at once, through the same setter the
       per-surface switch uses -- ON returns the nine keys to 'app', OFF seeds
       each surface from the app's currently resolved theme, accent and font. */
    setAllSurfacesFollowApp: function (on) {
      this.playerSurfaces.forEach(function (surface) {
        LmsUi.setSurfaceFollowsApp(surface.key, on);
      });
    },
    preference: function (key) { LmsUi.setPreference(key, !this.ui[key]); },
    control: function (p) { LmsStore.selectPlayer(p.id); },
    handoff: function (p) { LmsStore.handoffTo(p.id); },
    sync: function (p) { LmsStore.syncWith(p.id); },
    toggleCrossfade: function () {
      LmsStore.setTransition(this.store.transitionType ? 0 : 1, this.store.transitionDuration || 4);
    },
    duration: function (value) {
      this.durationDraft = Number(value);
      LmsStore.setTransition(this.store.transitionType, Number(value));
    },
    selectReplayGain: function (key) {
      if (key !== this.store.replayGainMode) LmsStore.setReplayGain(key);
    },
    sleepMinutes: function (minutes) { LmsStore.setSleep(minutes * 60); },
    sleepTrack: function () { LmsStore.sleepAfterTrack(); },
    sleepQueue: function () { LmsStore.sleepAfterQueue(); },
    cancelSleep: function () { LmsStore.setSleep(0); },
    restoreSettingsScroll: function () {
      var self = this;
      this.$nextTick(function () {
        if (self.$el) self.$el.scrollTop = Math.max(0, self.settingsReturnScroll || 0);
      });
    },
    restoreAppearanceScroll: function () {
      var self = this;
      this.$nextTick(function () {
        if (self.$el) self.$el.scrollTop = Math.max(0, self.appearanceReturnScroll || 0);
      });
    },
    openAdvanced: function () {
      var self = this;
      this.settingsReturnScroll = this.$el ? this.$el.scrollTop : 0;
      LmsUi.applyAdvancedSettings = this.applyAdvancedFrame;
      LmsNav.push('settings', { label: 'Advanced LMS settings', advanced: true });
      this.ui.appearanceScreen = null;
      this.ui.advancedSettings = true;
      this.ui.advancedSettingsDirty = false;
      this.advancedSettingsDirty = false;
      this.$nextTick(function () {
        if (self.$el) self.$el.scrollTop = 0;
      });
    },
    closeAdvanced: function () {
      if (LmsUi.canLeaveAdvancedSettings && !LmsUi.canLeaveAdvancedSettings()) return;
      var top = LmsNav.top('settings');
      if (top && top.advanced) {
        LmsNav.pop('settings');
        return;
      }
      this.ui.advancedSettings = false;
      if (LmsUi.applyAdvancedSettings === this.applyAdvancedFrame) LmsUi.applyAdvancedSettings = null;
      this.restoreSettingsScroll();
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
      link.download = 'echo-classic-preferences.json';
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
	      catch (e) { return 'the contents of ' + canonical + ' is not valid JSON'; }
	      if (canonical === 'echoclassic.ui.v2') {
	        if (!this.isPlainObject(parsed)) return canonical + ' should be an object';
	        /* Estas duas listas eram literais duplicados de ui.js. Acrescentar uma
	           aba la quebrava a importacao de preferencias aqui, em silencio: o
	           valor novo era recusado como invalido. Agora derivam da fonte. */
	        var keysOf = function (list) {
	          return list.map(function (entry) { return entry.key; });
	        };
	        var tabs = keysOf(LmsUi.TABS);
	        var views = keysOf(LmsUi.MUSIC_VIEWS);
	        var albumModes = ['albums', 'tracks'];
	        var queueArtModes = LmsUi.QUEUE_ART_MODES.map(function (mode) { return mode.key; });
	        var playerPresentations = ['adaptive', 'fullscreen'];
	        var playerPositions = ['right', 'left', 'center'];
	        var gaugeStyles = ['flat', 'classic'];
	        var gaugeColors = keysOf(LmsUi.GAUGE_COLORS);
	        /* N1 (3.2.6b): estas duas ainda eram literais duplicados de
	           LmsUi.COLOR_SCHEMES/LmsUi.FONT_OPTIONS, apesar do comentario acima
	           -- so tabs/views tinham sido corrigidas. Escolher Podium Sans (ou
	           qualquer esquema/fonte acrescentada depois), exportar e reimportar
	           batia aqui: fontFamily nao estava na lista literal e
	           validateImportValue rejeitava o ARQUIVO INTEIRO com "incompatible
	           value", nao so a chave. Agora derivam de LmsUi, como queryArtModes
	           ja fazia. */
	        var colorSchemes = keysOf(LmsUi.COLOR_SCHEMES);
	        var themes = keysOf(LmsUi.THEME_OPTIONS);
	        var fontFamilies = keysOf(LmsUi.FONT_OPTIONS);
	        var enums = [
	          ['tab', tabs], ['musicView', views], ['albumMode', albumModes],
	          ['queueArtMode', queueArtModes],
	          ['playerPresentation', playerPresentations], ['playerPosition', playerPositions],
	          ['miniGaugeStyle', gaugeStyles], ['playerGaugeStyle', gaugeStyles],
	          ['lightMiniGaugeStyle', gaugeStyles], ['lightPlayerGaugeStyle', gaugeStyles],
	          ['darkMiniGaugeStyle', gaugeStyles], ['darkPlayerGaugeStyle', gaugeStyles],
	          ['legacyMiniGaugeStyle', gaugeStyles], ['legacyPlayerGaugeStyle', gaugeStyles],
	          ['miniGaugeColor', gaugeColors], ['playerGaugeColor', gaugeColors],
	          ['theme', themes], ['colorScheme', colorSchemes], ['fontFamily', fontFamilies]
	        ];
	        for (var e = 0; e < enums.length; e++) {
	          var key = enums[e][0];
	          if (parsed[key] !== undefined && enums[e][1].indexOf(parsed[key]) < 0) {
	            return key + ' has an incompatible value';
	          }
	        }
	        if (parsed.byView !== undefined && !this.isPlainObject(parsed.byView)) {
	          return 'byView should be an object';
	        }
	        return null;
	      }
	      if (canonical === 'echoclassic.pins.v1' || canonical === 'echoclassic.history.v1') {
        if (!Array.isArray(parsed)) return canonical + ' should be a list';
        var bad = parsed.some(function (item) { return !this.isPlainObject(item); }, this);
        if (bad) return canonical + ' has items that are not objects';
        return null;
      }
      if (canonical === 'echoclassic.nav.v1') {
        if (!this.isPlainObject(parsed)) return 'echoclassic.nav.v1 should be an object';
        var stacks = ['music', 'playlists', 'radio', 'favourites'];
        for (var i = 0; i < stacks.length; i++) {
          var stack = parsed[stacks[i]];
          if (stack === undefined) continue;
          if (!this.isFrameList(stack)) {
            return 'the navigation stack “' + stacks[i] + '” is not a list of valid screens';
          }
        }
        return null;
      }
      if (!this.isPlainObject(parsed)) return canonical + ' should be an object';
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
       de volta e ate aqui nao havia none. */
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
