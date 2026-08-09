
var ECHOCLASSIC_ADVANCED_THEME_TOKENS = [
  '--accent', '--chrome', '--content', '--selected', '--text', '--text2',
  '--hair', '--field', '--accent-ink', '--group-page', '--group-bg',
  '--group-head', '--sw-off', '--sw-on', '--knob', '--destructive',
  '--picker-bg', '--shadow', '--app-font'
];

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
          src="/echoclassic/settings/server/basic.html"></iframe>
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
      settingsReturnScroll: 0,
      advancedSettingsDirty: false,
      advancedSettingsPage: '',
      advancedThemeObserver: null,
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
      handler: function () { this.syncSettingsScreen(); }
    },
    'ui.dark': function () { this.themeAdvancedFrame(); },
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
       fontFamily/setFullTheme etc. already are -- gaugeColor itself takes two
       arguments and cannot be passed there directly. */
    setPlayerGaugeColor: function (key) { this.gaugeColor('player', key); },
    setMiniGaugeColor: function (key) { this.gaugeColor('mini', key); },
    advancedFrameCss: function () {
      return [
        'html{background:var(--group-page)!important;color:var(--text)!important;font-family:var(--app-font)!important;color-scheme:light;}',
        'html[data-echoclassic-theme="dark"]{color-scheme:dark;}',
        'body{box-sizing:border-box;margin:0!important;min-height:100vh;background:var(--group-page)!important;',
        'color:var(--text)!important;font:15px/1.35 var(--app-font)!important;-webkit-text-size-adjust:100%;',
        'padding:18px 20px 110px 342px!important;overflow:auto!important;}',
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
        '.ec-rail-top{padding:18px 14px 10px!important;}',
        '.ec-rail-search{box-sizing:border-box;height:34px;border-radius:17px;background:var(--field)!important;',
        'color:var(--text2)!important;display:grid;grid-template-columns:24px 1fr 24px;align-items:center;',
        'padding:0 9px!important;font:16px var(--app-font)!important;}',
        '.ec-rail-search input{border:0!important;background:transparent!important;color:var(--text)!important;',
        'height:34px!important;min-height:34px!important;padding:0!important;width:100%!important;font:16px var(--app-font)!important;}',
        '.ec-rail-search input::placeholder{color:var(--text2)!important;opacity:1;}',
        '.ec-rail-mag{width:15px;height:15px;border:1.8px solid currentColor;border-radius:50%;position:relative;}',
        '.ec-rail-mag:after{content:"";position:absolute;width:7px;height:1.8px;right:-5px;bottom:-3px;background:currentColor;transform:rotate(45deg);}',
        '.ec-rail-mic{justify-self:end;width:10px;height:16px;border:1.7px solid currentColor;border-radius:7px;position:relative;}',
        '.ec-rail-mic:before{content:"";position:absolute;left:-4px;right:-4px;bottom:-5px;height:7px;border:1.7px solid currentColor;border-top:0;border-radius:0 0 8px 8px;}',
        '.ec-rail-mic:after{content:"";position:absolute;left:3px;bottom:-9px;width:2px;height:5px;background:currentColor;}',
        '.ec-rail-identity{display:grid;grid-template-columns:48px 1fr;gap:10px;align-items:center;padding:8px 14px 12px!important;}',
        '.ec-server-dot{width:44px;height:44px;border-radius:50%;background:radial-gradient(circle at 50% 50%,var(--group-bg) 0 10%,transparent 11%),',
        'repeating-linear-gradient(90deg,transparent 0 7px,color-mix(in srgb,var(--group-bg) 56%,transparent) 7px 9px),',
        'linear-gradient(135deg,#50545c,#101216);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--group-bg) 62%,transparent),0 1px 3px rgba(0,0,0,.18);}',
        '.ec-rail-identity b{display:block;font-size:17px;font-weight:700;color:var(--text)!important;}',
        '.ec-rail-identity span{display:block;margin-top:2px;color:var(--text2)!important;font-size:12px;line-height:1.2;}',
        '.ec-rail-list{min-height:0;overflow:auto;padding:0 12px 16px!important;}',
        '.ec-rail-label{padding:12px 10px 5px!important;color:var(--text2)!important;font-size:12px;text-transform:uppercase;}',
        '.ec-nav-row{appearance:none;border:0!important;width:100%;min-height:42px;display:grid!important;grid-template-columns:28px 1fr auto;',
        'align-items:center;gap:9px;padding:5px 8px!important;border-radius:19px!important;background:transparent!important;',
        'color:var(--text)!important;text-align:left;font:16px var(--app-font)!important;}',
        '.ec-nav-row.ec-active{background:color-mix(in srgb,var(--text2) 20%,transparent)!important;color:var(--accent)!important;}',
        '.ec-nav-row.ec-hidden{display:none!important;}',
        '.ec-glyph{width:25px;height:25px;border-radius:7px;display:grid;place-items:center;color:#fff;font-size:15px;font-weight:700;}',
        '.ec-g-gray{background:linear-gradient(#c6c6cc,#96969d);}.ec-g-blue{background:linear-gradient(#2da8ff,#007aff);}',
        '.ec-g-green{background:linear-gradient(#63da75,#30b94d);}.ec-g-orange{background:linear-gradient(#ffb34a,#ff8900);}',
        '.ec-g-red{background:linear-gradient(#ff6b6b,#ff3b30);}.ec-g-purple{background:linear-gradient(#ad7bff,#715aff);}',
        '.ec-lms-chrome-hidden{display:none!important;}',
        '#echoclassic-advanced-hero{display:none!important;}',
        '#echoclassic-plugin-store-tools{box-sizing:border-box;margin:4px 12px 18px!important;',
        'display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;}',
        '.ec-plugin-title{margin:0!important;color:var(--text)!important;font:700 30px/1.1 var(--app-font)!important;}',
        '.ec-plugin-sort{color:var(--text2)!important;font:17px/1.2 var(--app-font)!important;white-space:nowrap;}',
        '.ec-plugin-sort b{color:var(--accent)!important;font-weight:400;}',
        '.ec-plugin-search{box-sizing:border-box;width:240px;height:34px;border-radius:7px;background:var(--field)!important;',
        'color:var(--text2)!important;display:grid;grid-template-columns:22px 1fr 22px;align-items:center;padding:0 8px!important;}',
        '.ec-plugin-search input{border:0!important;background:transparent!important;color:var(--text)!important;',
        'height:34px!important;min-height:34px!important;padding:0!important;width:100%!important;font:15px var(--app-font)!important;}',
        '.ec-plugin-search input::placeholder{color:var(--text2)!important;opacity:1;}',
        '.ec-plugin-clear{border:0!important;background:color-mix(in srgb,var(--text2) 38%,transparent)!important;',
        'color:var(--group-bg)!important;border-radius:50%!important;width:16px!important;height:16px!important;',
        'min-height:16px!important;padding:0!important;font:700 12px/16px var(--app-font)!important;}',
        '.ec-plugin-store .settingSection,.ec-plugin-store .settingsGroup,.ec-plugin-store .prefGroup,',
        '.ec-plugin-store .group,.ec-plugin-store fieldset{background:transparent!important;border:0!important;}',
        '.ec-plugin-store .settingGroup,.ec-plugin-store .ec-plugin-card{display:grid!important;',
        'grid-template-columns:64px minmax(0,1fr) auto!important;gap:14px!important;align-items:center!important;',
        'min-height:86px!important;padding:11px 18px!important;margin:0 12px!important;',
        'border-radius:0!important;background:var(--group-bg)!important;}',
        '.ec-plugin-store .settingGroup:first-of-type,.ec-plugin-store .ec-plugin-card:first-of-type{border-radius:20px 20px 0 0!important;}',
        '.ec-plugin-store .settingGroup:last-of-type,.ec-plugin-store .ec-plugin-card:last-of-type{border-radius:0 0 20px 20px!important;}',
        '.ec-plugin-store .settingGroup:before,.ec-plugin-store .ec-plugin-card:before{content:"";position:absolute;top:0;left:96px;right:0;height:.5px;background:var(--hair);}',
        '.ec-plugin-store .settingGroup:first-of-type:before,.ec-plugin-store .ec-plugin-card:first-of-type:before{display:none!important;}',
        '.ec-plugin-store .prefHead{font-weight:600!important;}',
        '.ec-plugin-store .prefHead:before,.ec-plugin-store .settingLabel:before{content:"";float:left;width:54px;height:54px;',
        'margin:0 14px 0 0;border-radius:12px;background:linear-gradient(135deg,var(--accent),#34c759);}',
        '.ec-plugin-store .prefs{justify-content:flex-end!important;}',
        '.ec-plugin-store .ec-advanced-content{display:none!important;}',
        '#echoclassic-plugin-store-grid{min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(3,minmax(260px,1fr));',
        'align-content:start;background:var(--group-bg)!important;border-left:.5px solid var(--hair)!important;border-right:.5px solid var(--hair)!important;',
        'margin:0 12px 26px!important;}',
        '.ec-store-card{box-sizing:border-box;min-height:118px;display:grid;grid-template-columns:64px minmax(0,1fr) auto;',
        'gap:12px;padding:14px!important;border-right:.5px solid var(--hair)!important;border-bottom:.5px solid var(--hair)!important;',
        'background:var(--group-bg)!important;color:var(--text)!important;}',
        '.ec-store-card:nth-child(3n){border-right:0!important;}',
        '.ec-store-icon{width:58px;height:58px;border-radius:13px;display:grid;place-items:center;overflow:hidden;color:#fff;',
        'font:700 22px/1 var(--app-font)!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.5);background:linear-gradient(135deg,var(--accent),#34c759);}',
        '.ec-store-card:nth-child(4n+1) .ec-store-icon{background:linear-gradient(135deg,#06a9ff,#006fd6);}',
        '.ec-store-card:nth-child(4n+2) .ec-store-icon{background:linear-gradient(135deg,#67dd74,#16a95a);}',
        '.ec-store-card:nth-child(4n+3) .ec-store-icon{background:linear-gradient(135deg,#ffb644,#ff7a00);}',
        '.ec-store-body{min-width:0!important;}.ec-store-name{display:block;color:var(--text)!important;font:600 16px/1.15 var(--app-font)!important;',
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
        '.ec-store-meta{margin-top:2px;color:var(--text2)!important;font:13px/1.2 var(--app-font)!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
        '.ec-store-desc{margin:8px 0 0!important;color:var(--text2)!important;font:13px/1.25 var(--app-font)!important;',
        'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
        '.ec-store-actions{display:grid;gap:8px;justify-items:end;align-content:start;}',
        '.ec-store-state{color:#34c759!important;font:700 12px/1 var(--app-font)!important;}',
        '.ec-store-button{min-width:72px!important;border:1px solid var(--accent)!important;border-radius:5px!important;',
        'background:transparent!important;color:var(--accent)!important;padding:4px 10px!important;font:700 14px/1.2 var(--app-font)!important;}',
        '.ec-store-disabled{opacity:.58!important;}.ec-store-disabled .ec-store-icon{filter:grayscale(1);}',
        '.ec-plugin-store .ec-plugin-filtered{display:none!important;}',
        '#settings,#content,.content,.settingsPage,form,#settingsForm,.ec-advanced-content{box-sizing:border-box;width:100%;',
        'max-width:none!important;padding:0 0 22px!important;margin:0!important;}',
        'h1,h2,h3,h4,.pageHeader,.sectionHeader,.settingGroupHeader{color:var(--text)!important;font-family:var(--app-font)!important;}',
        'table{max-width:100%;color:var(--text)!important;font-family:var(--app-font)!important;}',
        'td,th{border-color:var(--hair)!important;color:var(--text)!important;}',
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
        'min-height:36px;max-width:100%;border:.5px solid var(--hair)!important;border-radius:9px!important;',
        'background:var(--group-bg)!important;color:var(--text)!important;',
        'font:17px var(--app-font)!important;padding:5px 10px!important;}',
        'input[type="text"],input[type="password"],input[type="search"],input[type="url"],',
        'input[type="email"]{width:min(100%,480px)!important;}',
        'input[type="number"]{width:90px!important;}',
        'textarea{min-height:70px;}',
        'input[type="range"]{accent-color:var(--accent);}',
        'input[type="checkbox"],input[type="radio"]{accent-color:var(--accent);}',
        'button,input[type="button"],input[type="submit"],input[type="reset"],.button,.stdclick{',
        'min-height:34px;border:.5px solid var(--hair)!important;border-radius:9px!important;',
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
        'pre,code{background:var(--field)!important;color:var(--text)!important;',
        'border-radius:5px;padding:2px 4px;}',
        'img{max-width:100%;}',
        '@media (max-width:860px){body{padding:12px 10px 110px!important;}#echoclassic-advanced-rail{position:static;width:auto;max-height:360px;margin:0 0 18px;}',
        '#echoclassic-plugin-store-tools{display:block!important}.ec-plugin-search{width:100%!important;margin-top:10px!important;}',
        '.settingGroup{display:block!important;margin-left:0!important;margin-right:0!important}.prefHead,.prefDesc,.prefs{display:block!important;}',
        '.prefs{display:flex!important;margin-top:7px!important}}'
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
            self.advancedClosest(input, '#echoclassic-plugin-store-tools') ||
            String(input.type || '').toLowerCase() === 'hidden') {
          return;
        }
        input.__echoclassicDirtyTracking = true;
        var changed = function () {
          var type = String(input.type || '').toLowerCase();
          var dirty = type === 'checkbox' || type === 'radio'
            ? input.checked !== input.defaultChecked
            : input.value !== input.defaultValue;
          if (dirty) {
            self.advancedSettingsDirty = true;
            self.ui.advancedSettingsDirty = true;
          }
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
      var glyph = this.advancedCreateEl(doc, 'span', 'ec-glyph ec-g-' + meta.color, meta.glyph);
      var text = this.advancedCreateEl(doc, 'span', '', label);
      var value = this.advancedCreateEl(doc, 'span', 'value', '');
      row.appendChild(glyph);
      row.appendChild(text);
      row.appendChild(value);
      row.addEventListener('click', function () {
        if (selector.value === option.value) return;
        selector.value = option.value;
        self.advancedDispatchChange(doc, selector);
      });
      return row;
    },
    cleanAdvancedText: function (text) {
      return String(text || '').replace(/\s+/g, ' ').trim();
    },
    hideAdvancedLmsChrome: function (doc, root) {
      var self = this;
      if (!doc.body || !doc.body.children) return;
      var generated = /^(echoclassic-advanced-rail|echoclassic-plugin-store-tools|echoclassic-plugin-store-grid|echoclassic-advanced-theme)$/;
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
        if (node.id === 'echoclassic-advanced-rail' || node.id === 'echoclassic-plugin-store-tools' ||
            node.id === 'echoclassic-plugin-store-grid' || node.id === 'echoclassic-advanced-theme') {
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
    candidateAdvancedPluginRows: function (doc, root) {
      if (!doc.querySelectorAll) return [];
      var source = root || doc.body;
      var selectors = [
        '.plugin', '.pluginItem', '.plugin-item', '.pluginEntry', '.plugin-entry',
        '.settingGroup', '.prefGroup', 'table:not(.tabs):not(#tabs):not(#settingsTabs)>tbody>tr'
      ].join(',');
      return Array.prototype.slice.call(source.querySelectorAll(selectors)).filter(function (node) {
        return !node.id || node.id !== 'echoclassic-plugin-store-tools';
      });
    },
    pluginIconText: function (name) {
      var words = this.cleanAdvancedText(name).split(/\s+/).filter(Boolean);
      if (!words.length) return 'P';
      if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    },
    parseAdvancedPluginRow: function (row) {
      var text = this.cleanAdvancedText(row.textContent);
      var name = text;
      var version = '';
      var author = '';
      var desc = '';
      var link = row.querySelector && row.querySelector('a[href]');
      var action = link ? link.cloneNode(true) : null;
      var active = /settings|active|enabled|\bv\d+\./i.test(text);
      var match = text.match(/^(.+?)(?:\s*\((v?[\d.]+[^)]*)\)|\s+v?(\d+(?:\.\d+)+))/i);
      if (match) {
        name = this.cleanAdvancedText(match[1]);
        version = this.cleanAdvancedText(match[2] || match[3] || '');
      } else {
        name = text.split(/settings|more info|lyrion community|version/i)[0];
        name = this.cleanAdvancedText(name).slice(0, 90);
      }
      var withoutName = this.cleanAdvancedText(text.replace(name, '').replace(version, ''));
      var by = withoutName.match(/(?:by|author)\s+([^.,]+)/i);
      if (by) author = this.cleanAdvancedText(by[1]);
      var bits = withoutName.split(/settings|more info|author|by /i).map(this.cleanAdvancedText).filter(function (part) {
        return part && part.length > 24;
      });
      desc = bits[0] || withoutName.slice(0, 150);
      if (!name) name = 'Plugin';
      return {
        name: name,
        version: version,
        author: author,
        desc: desc,
        active: active,
        action: action
      };
    },
    renderAdvancedPluginCard: function (doc, plugin) {
      var card = this.advancedCreateEl(doc, 'article', 'ec-store-card' + (plugin.active ? '' : ' ec-store-disabled'), '');
      card.setAttribute('data-ec-plugin-label', this.cleanAdvancedText([plugin.name, plugin.version, plugin.author, plugin.desc].join(' ')).toLowerCase());
      var icon = this.advancedCreateEl(doc, 'div', 'ec-store-icon', this.pluginIconText(plugin.name));
      var body = this.advancedCreateEl(doc, 'div', 'ec-store-body', '');
      var name = this.advancedCreateEl(doc, 'strong', 'ec-store-name', plugin.name);
      var meta = this.advancedCreateEl(doc, 'div', 'ec-store-meta',
        (plugin.version ? 'Version ' + plugin.version : 'Installed') + (plugin.author ? ' - ' + plugin.author : ''));
      var desc = this.advancedCreateEl(doc, 'p', 'ec-store-desc', plugin.desc || 'LMS plugin');
      var actions = this.advancedCreateEl(doc, 'div', 'ec-store-actions', '');
      var state = this.advancedCreateEl(doc, 'span', 'ec-store-state', plugin.active ? 'ACTIVE' : '');
      var button;
      if (plugin.action) {
        button = plugin.action;
        button.className = 'ec-store-button';
        button.textContent = this.cleanAdvancedText(button.textContent) || 'Settings';
      } else {
        button = this.advancedCreateEl(doc, 'button', 'ec-store-button', plugin.active ? 'Settings' : '\u21e9');
        button.type = 'button';
      }
      body.appendChild(name);
      body.appendChild(meta);
      body.appendChild(desc);
      if (plugin.active) actions.appendChild(state);
      actions.appendChild(button);
      card.appendChild(icon);
      card.appendChild(body);
      card.appendChild(actions);
      return card;
    },
    buildAdvancedPluginStore: function (doc, root) {
      var toolbar = doc.getElementById('echoclassic-plugin-store-tools');
      if (!toolbar) {
        toolbar = this.advancedCreateEl(doc, 'div', '', '');
        toolbar.id = 'echoclassic-plugin-store-tools';
        toolbar.innerHTML = '<h1 class="ec-plugin-title">Plugins</h1>' +
          '<div class="ec-plugin-sort">sort by <b>Most Recent</b></div>' +
          '<label class="ec-plugin-search"><span class="ec-rail-mag" aria-hidden="true"></span>' +
          '<input type="search" placeholder="Search Plugins" aria-label="Search plugins">' +
          '<button type="button" class="ec-plugin-clear" aria-label="Clear plugin search">\u00d7</button></label>';
        if (root && root.parentNode && root !== doc.body) root.parentNode.insertBefore(toolbar, root);
        else doc.body.insertBefore(toolbar, doc.body.firstChild);
      }

      var rows = this.candidateAdvancedPluginRows(doc, root);
      var grid = doc.getElementById('echoclassic-plugin-store-grid');
      if (!grid) {
        grid = this.advancedCreateEl(doc, 'section', '', '');
        grid.id = 'echoclassic-plugin-store-grid';
        if (root && root.parentNode) root.parentNode.insertBefore(grid, root);
        else doc.body.appendChild(grid);
      }
      if (!grid.__echoclassicBuiltFromCount || grid.__echoclassicBuiltFromCount !== rows.length) {
        grid.innerHTML = '';
        var self = this;
        rows.map(function (row) { return self.parseAdvancedPluginRow(row); })
          .filter(function (plugin) { return plugin.name && plugin.name.toLowerCase() !== 'plugins'; })
          .forEach(function (plugin) { grid.appendChild(self.renderAdvancedPluginCard(doc, plugin)); });
        grid.__echoclassicBuiltFromCount = rows.length;
      }

      var input = toolbar.querySelector('input[type="search"]');
      var clear = toolbar.querySelector('.ec-plugin-clear');
      if (!input || input.__echoclassicPluginSearch) return;
      input.__echoclassicDirtyTracking = true;
      input.__echoclassicPluginSearch = true;
      var filter = function () {
        var query = String(input.value || '').toLowerCase().trim();
        Array.prototype.slice.call(grid.querySelectorAll('.ec-store-card')).forEach(function (row) {
          if (row.classList) row.classList.toggle('ec-plugin-filtered',
            !!query && String(row.getAttribute('data-ec-plugin-label') || '').indexOf(query) < 0);
        });
      };
      input.addEventListener('input', filter);
      if (clear) {
        clear.addEventListener('click', function () {
          input.value = '';
          filter();
          input.focus();
        });
      }
    },
    removeAdvancedPluginStore: function (doc) {
      var toolbar = doc.getElementById && doc.getElementById('echoclassic-plugin-store-tools');
      if (toolbar && toolbar.parentNode) toolbar.parentNode.removeChild(toolbar);
      var grid = doc.getElementById && doc.getElementById('echoclassic-plugin-store-grid');
      if (grid && grid.parentNode) grid.parentNode.removeChild(grid);
      if (!doc.querySelectorAll) return;
      Array.prototype.slice.call(doc.querySelectorAll('.ec-plugin-card')).forEach(function (row) {
        if (row.classList) row.classList.remove('ec-plugin-card', 'ec-plugin-filtered');
        row.removeAttribute('data-ec-plugin-label');
      });
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
      if (pluginStore) this.buildAdvancedPluginStore(doc, root);
      else this.removeAdvancedPluginStore(doc);

      if (!selector || !selector.options || !selector.options.length) return;
      var rail = doc.getElementById('echoclassic-advanced-rail');
      if (!rail) {
        rail = this.advancedCreateEl(doc, 'aside', '', '');
        rail.id = 'echoclassic-advanced-rail';
        doc.body.insertBefore(rail, doc.body.firstChild);
      }
      rail.innerHTML = '<div class="ec-rail-top"><label class="ec-rail-search">' +
        '<span class="ec-rail-mag" aria-hidden="true"></span>' +
        '<input type="search" placeholder="Search" aria-label="Search advanced LMS settings">' +
        '<span class="ec-rail-mic" aria-hidden="true"></span></label></div>' +
        '<div class="ec-rail-identity"><span class="ec-server-dot" aria-hidden="true"></span>' +
        '<span><b>Music Player</b><span>Server settings, plugins, network and library</span></span></div>' +
        '<div class="ec-rail-list"></div>';

      var list = rail.querySelector('.ec-rail-list');
      var server = this.advancedCreateEl(doc, 'div', 'ec-rail-label', 'Server');
      var plugins = this.advancedCreateEl(doc, 'div', 'ec-rail-label', 'Plugins');
      var serverRows = [];
      var pluginRows = [];
      Array.prototype.slice.call(selector.options).forEach(function (option) {
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
      if (search) {
        search.__echoclassicDirtyTracking = true;
        search.addEventListener('input', function () {
          var query = String(search.value || '').toLowerCase().trim();
          Array.prototype.slice.call(rail.querySelectorAll('.ec-nav-row')).forEach(function (row) {
            row.classList.toggle('ec-hidden', !!query && String(row.getAttribute('data-ec-label') || '').indexOf(query) < 0);
          });
        });
      }
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

      doc.documentElement.setAttribute('data-echoclassic-theme', this.ui.dark ? 'dark' : 'light');
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
            self.enhanceAdvancedFrame(frame, doc);
          }, 60);
        }
      });
      this.advancedThemeObserver.observe(doc.documentElement, { childList: true, subtree: true });
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
    syncSettingsScreen: function () {
      var top = LmsNav.top('settings');
      var advanced = !!(top && top.advanced);
      var wasAdvanced = this.ui.advancedSettings;
      this.ui.advancedSettings = advanced;
      this.ui.appearanceScreen = advanced ? null : ((top && top.screen) || null);
      if (advanced) LmsUi.applyAdvancedSettings = this.applyAdvancedFrame;
      else if (LmsUi.applyAdvancedSettings === this.applyAdvancedFrame) LmsUi.applyAdvancedSettings = null;
      if (wasAdvanced && !advanced) this.restoreSettingsScroll();
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
    restoreSettingsScroll: function () {
      var self = this;
      this.$nextTick(function () {
        if (self.$el) self.$el.scrollTop = Math.max(0, self.settingsReturnScroll || 0);
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
