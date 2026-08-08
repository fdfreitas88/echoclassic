
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
<div v-else-if="ui.appearanceScreen" class="settings appearance-detail">
  <template v-if="ui.appearanceScreen === 'players'">
    <div class="sgroup">
      <div class="srow">Show previews
        <button type="button" class="sw" :class="{on: showPreviews}" role="switch"
                :aria-checked="String(showPreviews)" aria-label="Show previews"
                @click="showPreviews = !showPreviews"><span class="visually-hidden">Show previews</span></button>
      </div>
    </div>

    <!-- FULL PLAYER -->
    <div class="sgh">Full player</div>
    <div class="sgroup">
      <div class="srow segmented-row">
        <span>Presentation</span>
        <div class="segmented" role="radiogroup" aria-label="Presentation">
          <button v-for="mode in playerPresentations" :key="'full-pres-' + mode.key" type="button"
                  role="radio" :aria-checked="ui.playerPresentation === mode.key ? 'true' : 'false'"
                  :tabindex="ui.playerPresentation === mode.key ? 0 : -1"
                  :class="{on: ui.playerPresentation === mode.key}"
                  @keydown="radioKey($event, playerPresentations, ui.playerPresentation, playerPresentation)"
                  @click="playerPresentation(mode.key)">{{ mode.label }}</button>
        </div>
      </div>
      <div class="srow">Match app appearance
        <button type="button" class="sw" :class="{on: fullFollowsApp}" role="switch"
                :aria-checked="String(fullFollowsApp)" aria-label="Match app appearance"
                @click="setFullFollowsApp(!fullFollowsApp)"><span class="visually-hidden">Match app appearance</span></button>
      </div>
      <template v-if="!fullFollowsApp">
        <div class="srow segmented-row">
          <span>Theme</span>
          <div class="segmented" role="radiogroup" aria-label="Theme">
            <button v-for="option in themeOptions" :key="'full-theme-' + option.key" type="button"
                    role="radio" :aria-checked="ui.fullTheme === option.key ? 'true' : 'false'"
                    :tabindex="ui.fullTheme === option.key ? 0 : -1"
                    :class="{on: ui.fullTheme === option.key}"
                    @keydown="radioKey($event, themeOptions, ui.fullTheme, setFullTheme)"
                    @click="setFullTheme(option.key)">{{ option.label }}</button>
          </div>
        </div>
        <div class="srow">Accent
          <div class="swatch-row" role="radiogroup" aria-label="Accent">
            <button v-for="scheme in colorSchemes" :key="'full-accent-' + scheme.key" type="button"
                    class="swatch-dot" :class="'scheme-' + scheme.key"
                    role="radio" :aria-checked="ui.fullColorScheme === scheme.key ? 'true' : 'false'"
                    :aria-label="tr(scheme.label)"
                    :tabindex="ui.fullColorScheme === scheme.key ? 0 : -1"
                    @keydown="radioKey($event, colorSchemes, ui.fullColorScheme, setFullScheme)"
                    @click="setFullScheme(scheme.key)"></button>
          </div>
        </div>
      </template>
    </div>
    <div v-if="!fullFollowsApp" class="sgroup font-option-group" role="radiogroup" aria-label="Font">
      <button v-for="font in fontOptions" :key="'full-font-' + font.key" type="button"
              class="srow font-option-row" :class="'font-' + font.key"
              role="radio" :aria-checked="ui.fullFont === font.key ? 'true' : 'false'"
              :tabindex="ui.fullFont === font.key ? 0 : -1"
              @keydown="radioKey($event, fontOptions, ui.fullFont, setFullFont)"
              @click="setFullFont(font.key)">
        <span class="font-option-label">{{ font.label }}</span>
        <span class="font-option-check" aria-hidden="true"></span>
      </button>
    </div>
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
    </div>
    <div class="player-help">Also applies to the small player.</div>
    <div class="player-help">Bar style is remembered per theme.</div>
    <template v-if="showPreviews">
      <div class="sgh">Preview</div>
      <div class="sgroup">
        <div class="srow surface-preview" aria-hidden="true" v-bind="fullPreviewAttrs">
          <span class="surface-preview-swatch"></span>
          <span class="surface-preview-copy">Full player</span>
        </div>
      </div>
    </template>

    <!-- SMALL PLAYER -->
    <div class="sgh">Small player</div>
    <div class="sgroup">
      <div class="srow segmented-row">
        <span>Position</span>
        <div class="segmented" role="radiogroup" aria-label="Position">
          <button v-for="position in playerPositions" :key="'small-pos-' + position.key" type="button"
                  role="radio" :aria-checked="ui.playerPosition === position.key ? 'true' : 'false'"
                  :tabindex="ui.playerPosition === position.key ? 0 : -1"
                  :class="{on: ui.playerPosition === position.key}"
                  @keydown="radioKey($event, playerPositions, ui.playerPosition, setPlayerPosition)"
                  @click="setPlayerPosition(position.key)">{{ position.label }}</button>
        </div>
      </div>
      <div class="srow">Match app appearance
        <button type="button" class="sw" :class="{on: smallFollowsApp}" role="switch"
                :aria-checked="String(smallFollowsApp)" aria-label="Match app appearance"
                @click="setSmallFollowsApp(!smallFollowsApp)"><span class="visually-hidden">Match app appearance</span></button>
      </div>
      <template v-if="!smallFollowsApp">
        <div class="srow segmented-row">
          <span>Theme</span>
          <div class="segmented" role="radiogroup" aria-label="Theme">
            <button v-for="option in themeOptions" :key="'small-theme-' + option.key" type="button"
                    role="radio" :aria-checked="ui.smallTheme === option.key ? 'true' : 'false'"
                    :tabindex="ui.smallTheme === option.key ? 0 : -1"
                    :class="{on: ui.smallTheme === option.key}"
                    @keydown="radioKey($event, themeOptions, ui.smallTheme, setSmallTheme)"
                    @click="setSmallTheme(option.key)">{{ option.label }}</button>
          </div>
        </div>
        <div class="srow">Accent
          <div class="swatch-row" role="radiogroup" aria-label="Accent">
            <button v-for="scheme in colorSchemes" :key="'small-accent-' + scheme.key" type="button"
                    class="swatch-dot" :class="'scheme-' + scheme.key"
                    role="radio" :aria-checked="ui.smallColorScheme === scheme.key ? 'true' : 'false'"
                    :aria-label="tr(scheme.label)"
                    :tabindex="ui.smallColorScheme === scheme.key ? 0 : -1"
                    @keydown="radioKey($event, colorSchemes, ui.smallColorScheme, setSmallScheme)"
                    @click="setSmallScheme(scheme.key)"></button>
          </div>
        </div>
      </template>
    </div>
    <div v-if="!smallFollowsApp" class="sgroup font-option-group" role="radiogroup" aria-label="Font">
      <button v-for="font in fontOptions" :key="'small-font-' + font.key" type="button"
              class="srow font-option-row" :class="'font-' + font.key"
              role="radio" :aria-checked="ui.smallFont === font.key ? 'true' : 'false'"
              :tabindex="ui.smallFont === font.key ? 0 : -1"
              @keydown="radioKey($event, fontOptions, ui.smallFont, setSmallFont)"
              @click="setSmallFont(font.key)">
        <span class="font-option-label">{{ font.label }}</span>
        <span class="font-option-check" aria-hidden="true"></span>
      </button>
    </div>
    <template v-if="showPreviews">
      <div class="sgh">Preview</div>
      <div class="sgroup">
        <div class="srow surface-preview" aria-hidden="true" v-bind="smallPreviewAttrs">
          <span class="surface-preview-swatch"></span>
          <span class="surface-preview-copy">Small player</span>
        </div>
      </div>
    </template>

    <!-- MINI PLAYER -->
    <div class="sgh">Mini player</div>
    <div class="sgroup">
      <div class="srow">Match app appearance
        <button type="button" class="sw" :class="{on: miniFollowsApp}" role="switch"
                :aria-checked="String(miniFollowsApp)" aria-label="Match app appearance"
                @click="setMiniFollowsApp(!miniFollowsApp)"><span class="visually-hidden">Match app appearance</span></button>
      </div>
      <template v-if="!miniFollowsApp">
        <div class="srow segmented-row">
          <span>Theme</span>
          <div class="segmented" role="radiogroup" aria-label="Theme">
            <button v-for="option in themeOptions" :key="'mini-theme-' + option.key" type="button"
                    role="radio" :aria-checked="ui.miniTheme === option.key ? 'true' : 'false'"
                    :tabindex="ui.miniTheme === option.key ? 0 : -1"
                    :class="{on: ui.miniTheme === option.key}"
                    @keydown="radioKey($event, themeOptions, ui.miniTheme, setMiniTheme)"
                    @click="setMiniTheme(option.key)">{{ option.label }}</button>
          </div>
        </div>
        <div class="srow">Accent
          <div class="swatch-row" role="radiogroup" aria-label="Accent">
            <button v-for="scheme in colorSchemes" :key="'mini-accent-' + scheme.key" type="button"
                    class="swatch-dot" :class="'scheme-' + scheme.key"
                    role="radio" :aria-checked="ui.miniColorScheme === scheme.key ? 'true' : 'false'"
                    :aria-label="tr(scheme.label)"
                    :tabindex="ui.miniColorScheme === scheme.key ? 0 : -1"
                    @keydown="radioKey($event, colorSchemes, ui.miniColorScheme, setMiniScheme)"
                    @click="setMiniScheme(scheme.key)"></button>
          </div>
        </div>
      </template>
    </div>
    <div v-if="!miniFollowsApp" class="sgroup font-option-group" role="radiogroup" aria-label="Font">
      <button v-for="font in fontOptions" :key="'mini-font-' + font.key" type="button"
              class="srow font-option-row" :class="'font-' + font.key"
              role="radio" :aria-checked="ui.miniFont === font.key ? 'true' : 'false'"
              :tabindex="ui.miniFont === font.key ? 0 : -1"
              @keydown="radioKey($event, fontOptions, ui.miniFont, setMiniFont)"
              @click="setMiniFont(font.key)">
        <span class="font-option-label">{{ font.label }}</span>
        <span class="font-option-check" aria-hidden="true"></span>
      </button>
    </div>
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
        <div class="swatch-row" role="radiogroup" aria-label="Mini player colour">
          <button v-for="color in gaugeColors" :key="'mini-color-' + color.key" type="button"
                  class="swatch-dot" :class="color.key === 'theme' ? 'gauge-color-theme' : ('scheme-' + color.key)"
                  role="radio" :aria-checked="ui.miniGaugeColor === color.key ? 'true' : 'false'"
                  :aria-label="tr(color.label)"
                  :tabindex="ui.miniGaugeColor === color.key ? 0 : -1"
                  @keydown="radioKey($event, gaugeColors, ui.miniGaugeColor, setMiniGaugeColor)"
                  @click="setMiniGaugeColor(color.key)"></button>
        </div>
      </div>
    </div>
    <div class="player-help">Bar style is remembered per theme.</div>
    <template v-if="showPreviews">
      <div class="sgh">Preview</div>
      <div class="sgroup">
        <div class="srow surface-preview" aria-hidden="true" v-bind="miniPreviewAttrs">
          <span class="surface-preview-swatch"></span>
          <span class="surface-preview-copy">Mini player</span>
        </div>
      </div>
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
        <span v-if="p.id === store.playerId" class="player-current">Em uso</span>
        <template v-else-if="p.connected">
          <button title="Usar este player no Echo Classic" @click.stop="control(p)">Controlar</button>
          <button title="Continue playback on this player" @click.stop="handoff(p)">Transferir</button>
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
    <div class="srow">Dark theme
      <button type="button" class="sw" :class="{on: ui.dark}" role="switch"
              :aria-checked="String(ui.dark)" aria-label="Dark theme"
              @click="toggleTheme"><span class="visually-hidden">Dark theme</span></button>
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
      /* ui.js nao exporta uma lista equivalente para o tema: sao so duas
         opcoes fixas, Light e Dark, que nunca crescem como as outras listas
         -- criar uma constante la so para isto seria indireção sem ganho. */
      themeOptions: [{ key: 'light', label: 'Light' }, { key: 'dark', label: 'Dark' }],
      playerPositions: LmsUi.PLAYER_POSITIONS,
      playerPresentations: LmsUi.PLAYER_PRESENTATIONS,
      gaugeStyles: LmsUi.GAUGE_STYLES,
      gaugeColors: LmsUi.GAUGE_COLORS,
      queueArtModes: LmsUi.QUEUE_ART_MODES,
      info: null, loading: true, error: '', showPlayers: false,
      showDefaultPlayer: false,
      /* Session-only, like showPlayers/showDefaultPlayer above -- a live
         sample of each player under its own section is a lot of extra height
         to default to on, and nothing about it needs to survive a reload. */
      showPreviews: false,
      pendingImport: null,
      /* Rascunho local: o numero ao lado do slider tem de acompanhar o
         arrasto, nao esperar o round-trip com o servidor. */
      durationDraft: null
    };
  },
  computed: {
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
      return this.tr(this.ui.dark ? 'Mini player style (dark theme)' : 'Mini player style (light theme)');
    },
    playerGaugeStyleLabel: function () {
      return this.tr(this.ui.dark ? 'Full player style (dark theme)' : 'Full player style (light theme)');
    },
    crossfadeHint: function () {
      return this.tr(this.store.transitionType
        ? 'On: crossfade — the end of one song blends into the start of the next'
        : 'Off: gapless playback — songs join with no gap and no blend');
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
       each) are gone -- one "Match app appearance" toggle per surface now
       reads/drives all three of that surface's keys at once through
       LmsUi.surfaceFollowsApp/setSurfaceFollowsApp, and the custom rows it
       reveals reuse the plain themeOptions/colorSchemes/fontOptions lists
       with no 'app' entry, because a real value is always seeded into them
       the moment the toggle goes off (setFullFollowsApp etc., below). */
    fullFollowsApp: function () { return LmsUi.surfaceFollowsApp('full'); },
    smallFollowsApp: function () { return LmsUi.surfaceFollowsApp('small'); },
    miniFollowsApp: function () { return LmsUi.surfaceFollowsApp('mini'); },
    /* Same pattern chrome/miniplayer.js and nowplaying.js already use for
       their own root binding: v-bind="xPreviewAttrs" on the aria-hidden
       preview strip under each player's section. */
    fullPreviewAttrs: function () { return LmsUi.surfaceAttrs('full'); },
    smallPreviewAttrs: function () { return LmsUi.surfaceAttrs('small'); },
    miniPreviewAttrs: function () { return LmsUi.surfaceAttrs('mini'); }
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
      handler: function () { this.syncAppearanceScreen(); }
    }
  },
  methods: {
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
       fontFamily/setFullTheme etc. already are -- gaugeColor itself takes two
       arguments and cannot be passed there directly. */
    setPlayerGaugeColor: function (key) { this.gaugeColor('player', key); },
    setMiniGaugeColor: function (key) { this.gaugeColor('mini', key); },
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
      LmsNav.push('settings', { label: this.appearanceScreenLabel(screen), screen: screen });
      this.ui.appearanceScreen = screen;
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
    /* Hard constraint: the app-level Theme control must go through
       LmsUi.toggleTheme() and never assign state.dark directly -- toggleTheme
       also swaps in the gauge style remembered for the theme being entered.
       C5 replaced the Theme radiogroup with the inline Dark theme switch in
       the Appearance group (@click="toggleTheme" directly there, since a
       two-state switch never needs the key-to-boolean translation this
       method exists for), but the method stays: appearance-ui.test.js's
       toggleTheme regression net calls it directly, and it is the one place
       that guarantees "select the same theme again" is a no-op rather than a
       spurious toggle. */
    selectTheme: function (key) {
      var wantDark = key === 'dark';
      if (wantDark !== this.ui.dark) LmsUi.toggleTheme();
    },
    setPlayerPosition: function (key) { LmsUi.setPlayerPosition(key); },
    setFullTheme: function (key) { LmsUi.setSurfaceTheme('full', key); },
    setFullScheme: function (key) { LmsUi.setSurfaceScheme('full', key); },
    setFullFont: function (key) { LmsUi.setSurfaceFont('full', key); },
    setSmallTheme: function (key) { LmsUi.setSurfaceTheme('small', key); },
    setSmallScheme: function (key) { LmsUi.setSurfaceScheme('small', key); },
    setSmallFont: function (key) { LmsUi.setSurfaceFont('small', key); },
    setMiniTheme: function (key) { LmsUi.setSurfaceTheme('mini', key); },
    setMiniScheme: function (key) { LmsUi.setSurfaceScheme('mini', key); },
    setMiniFont: function (key) { LmsUi.setSurfaceFont('mini', key); },
    /* One "Match app appearance" toggle per surface (C6), replacing the nine
       "Follow app" option rows. ON writes 'app' to all three of that
       surface's keys; OFF seeds them from the app's own resolved values --
       see LmsUi.setSurfaceFollowsApp for why (uistate.test.js covers the
       ON/OFF/ON round trip directly against LmsUi, not through this thin
       per-surface wrapper). */
    setFullFollowsApp: function (on) { LmsUi.setSurfaceFollowsApp('full', on); },
    setSmallFollowsApp: function (on) { LmsUi.setSurfaceFollowsApp('small', on); },
    setMiniFollowsApp: function (on) { LmsUi.setSurfaceFollowsApp('mini', on); },
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
	        var gaugeColors = ['theme', 'blue', 'teal', 'crimson', 'indigo', 'amber'];
	        /* N1 (3.2.6b): estas duas ainda eram literais duplicados de
	           LmsUi.COLOR_SCHEMES/LmsUi.FONT_OPTIONS, apesar do comentario acima
	           -- so tabs/views tinham sido corrigidas. Escolher Podium Sans (ou
	           qualquer esquema/fonte acrescentada depois), exportar e reimportar
	           batia aqui: fontFamily nao estava na lista literal e
	           validateImportValue rejeitava o ARQUIVO INTEIRO com "incompatible
	           value", nao so a chave. Agora derivam de LmsUi, como queryArtModes
	           ja fazia. */
	        var colorSchemes = keysOf(LmsUi.COLOR_SCHEMES);
	        var fontFamilies = keysOf(LmsUi.FONT_OPTIONS);
	        var enums = [
	          ['tab', tabs], ['musicView', views], ['albumMode', albumModes],
	          ['queueArtMode', queueArtModes],
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
