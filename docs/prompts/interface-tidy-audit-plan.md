# Equalizer interface audit and approval plan

## Corrected scope

This review targets Echo Classic's live Apple Squeezer / SqueezeDSP Equalizer workflow, not the general Settings information architecture. Product code remains unchanged until the mockup is approved.

Live reference checked in Chrome on 25 August 2026:

- `http://10.73.254.20:9000/`
- Echo Classic 3.5.1 and LMS 9.1.1
- Apple Squeezer Store plugin API 1, running and connected
- Active player: Squeezelite; second connected player: Apple Squeezer Intel

## Findings and proposed response

### 1. Playback mode contradicts the editor

DAC Priority is selected and the page says native EQ does not apply, but enabled-looking Equalizer, bypass, preset and band controls remain visible. Let playback mode control the page: DAC Priority, OSF and CSF get a compact preserved-settings message plus a clear `Switch to Equalizer` action; only Equalizer mode shows the editor.

### 2. Common and specialist controls have equal weight

Plugin lifecycle, playback mode, ownership, bypass, presets, bands, contextual rules, filters, convolution and reset form one long stream.

- Keep Equalizer on/off, preset, hold-to-bypass, Q factor and graphic bands on the main page.
- Keep the current-song rule visible, with song and artist on separate lines.
- Put DSP owner and lifecycle in `Player DSP settings`.
- Put filters, convolution, balance, width, delay, loudness, DSP ReplayGain and crossfeed in `Advanced processing`.
- Put album/artist/genre/year/folder rules in `Automatic EQ rules`.

### 3. Desktop space is used poorly

Full-width groups and explanatory bands consume the first viewport while the controls stretch too widely. Constrain the working column to about 920 px, merge health into a compact summary, attach consequences to their controls, and reduce decorative separators.

### 4. Mobile relationships break

At 390 × 844 the settings scroller is 656 px high with 1,862 px of content. The band editor becomes a clipped horizontal strip, `On A Saturday NiteJourney` concatenates title and artist, and fixed player chrome competes with Apply/Reset.

- Add band snap points, a continuation cue and stable frequency/value labels.
- Put title and artist on separate truncating lines.
- Reduce mini-player detail while editing.
- Keep Apply and dirty-state feedback in a sticky bar above the player.
- Separate destructive full reset from Apply.

### 5. Staged changes are easy to lose

The explanation and Apply action sit after a long editor. Keep a sticky action bar reporting either `No unapplied changes` or the staged-change count. Navigating away with staged changes should use an in-app confirmation sheet.

### 6. The hierarchy mixes adjustment and administration

Back navigation works, but Equalizer includes both everyday sound adjustment and player/plugin administration. Keep Equalizer task-focused and move ownership, restart/lifecycle and hardware detail behind `Player DSP settings`.

## Verified live behavior

- Settings → Active player disclosure works.
- Settings → Equalizer opens the dedicated screen and Back to Settings is present.
- Both connected players and Control / Transfer / Sync render.
- No console warnings or errors appeared in the inspected flow.
- No page-level horizontal overflow at 390 × 844 or 820 × 900.
- Fixed playback and navigation chrome remain visible around an internal settings scroller.

Playback modes were not changed during inspection because the live UI says that doing so restarts the player. The existing DAC Priority state, supplied screenshot and rendered DOM were sufficient to audit the inactive-editor state.

## Approval mockup

`docs/prompts/interface-tidy-mockup.html` has three interactive views:

1. Equalizer mode on desktop.
2. Equalizer mode at phone width.
3. DAC Priority with an explicit inactive-EQ state.

It changes hierarchy and responsive behavior only; it does not invent DSP capabilities or change server commands.

## Implementation sequence after approval

1. Gate the editor by playback mode and add the explicit inactive state.
2. Recompose existing controls into Everyday equalizer, This song, Automatic EQ rules, Advanced processing and Player DSP settings.
3. Add the constrained desktop column, mobile band affordance and metadata fixes.
4. Add the sticky staged-change bar and navigation-away confirmation.
5. Preserve existing preference keys, API calls and DSP serialization.
6. Extend tests for mode gating, disclosures, dirty state and mobile-safe markup.
7. Run all tests and validation, then repeat Chrome checks at 390 × 844, 820 × 900 and desktop width.

## Approval boundary

No Echo Classic product source has been changed. Implementation begins only after explicit approval.
