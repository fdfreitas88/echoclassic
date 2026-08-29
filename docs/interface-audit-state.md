# Interface audit checkpoint

## Product invariants

- Preserve the Apple/iPod Classic identity, especially the deliberate Now Playing hierarchy.
- Work one interface module at a time: inspect, create interactive Before/After mockup, obtain explicit approval, then implement and test.
- Do not deploy, push, or restart a remote service unless explicitly requested.
- Preserve unrelated dirty-worktree changes.
- Audit overview: `docs/prompts/interface-audit-overview.html` is the status outline for reviewed, preserved, missing, and deployment work.

## Rejected proposals — do not repeat

- Do not redesign the current Mini Player; keep it as it is.
- Do not move Stop, Shuffle, Repeat, or Information out of the iPod Classic Now Playing layout into a More menu.
- Do not use item-by-item management for Favorites/Radio/Apps when many items need editing; use simultaneous `↑`, `↓`, `×` controls in Edit mode.
- Do not add a separate queue play button; play belongs only on the artwork/placeholder overlay.
- Do not demote or collapse Artist information below the artist's albums; its prominent placement is intentional.
- Do not redesign Artist Detail: keep the brief artist information visible and let “Read biography” extend it.

## Completed modules

- Settings information architecture and user-selectable Frequent Settings, including “Add to frequent settings”.
- Playback Queue: optional `↑`, `↓`, `×`, keyboard navigation, artwork-only play overlay.
- Library navigation, Search, resilient iPod Classic Now Playing, Favorites/Radio/Apps, Playlists, action sheets, Track Information/Signal Path, player picker, system states with progress gauge, notifications above Recently Played, responsive navigation, and Library filters/organization/saved views.
- Relevant implementation and focused tests exist in the dirty worktree. The accumulated approved work was deployed to musicplayer on 2026-08-28; version 3.5.1, restart successful, skin HTTP 200.

## Latest implemented module — Album Detail

- Mockup: `docs/prompts/album-detail-before-after.html`.
- Status: approved, implemented, validated, and deployed to musicplayer.
- Implement exactly: direct Play beside Shuffle; keep Equalizer visible; group Equalizer and Album information as stable secondary tools; retain metadata, track rows, per-track actions, artwork scale, and iPod Classic character; maintain 44 px targets and safe wrapping.
- Production paths: `EchoClassic/HTML/echoclassic/html/js/albumblock.js`, `EchoClassic/HTML/echoclassic/html/css/ios9.css`.
- Production: direct Play and Shuffle actions plus grouped Equalizer/Album information tools; focused coverage in `tests/album-detail-ui.test.js`.

## Reviewed without change — Artist Detail

- Mockup: `docs/prompts/artist-detail-before-after.html`.
- Status: rejected; keep production exactly as-is. Brief artist information remains visible and “Read biography” extends it.

## Latest implemented module — Music Folder

- Mockup: `docs/prompts/music-folder-before-after.html`.
- Status: approved and implemented. Focused Music Folder, navigation, and i18n checks pass (27 tests); syntax and diff checks are clean.
- Implement exactly: compact location context and item count; text-and-glyph folder/track distinction; safe long-path wrapping; chevrons only for folders; actionable empty state. Preserve folder navigation and track action sheets.
- Production paths: `EchoClassic/HTML/echoclassic/html/js/detail.js`, `EchoClassic/HTML/echoclassic/html/css/ios9.css`.
- Coverage: `tests/music-folder-ui.test.js`; new interface copy has EN/PT entries in `EchoClassic/strings.txt`.

## Latest implemented module — Library List and Alphabetical Index

- Mockup: `docs/prompts/library-list-alphabetical-index-before-after.html`.
- Status: approved with the condition that only the selected letter is highlighted; implemented and deployed to musicplayer. Focused library/browse/responsive checks pass (77 tests); syntax, mockup script, diff checks, and full deploy gates are clean.
- Evidence: `browse.js` already supports click, touch scrub, keyboard stepping, and automatic active-letter updates while scrolling. Its visual rail is constrained to 28 px and `min-height:24px` per letter, which can clip the alphabet at ordinary viewport heights and makes the active state too subtle.
- Implemented delta: artist artwork and separators align with the supplied reference; the full A-Z/# rail shares the available height; only the active letter receives the accent marker; the full rail is a continuous touch target. Existing click, keyboard, scroll synchronization, metadata, and row action sheets remain intact.
- Production paths: `EchoClassic/HTML/echoclassic/html/js/browse.js`, `EchoClassic/HTML/echoclassic/html/css/ios9.css`.
- Coverage: `tests/library-alphabetical-index-ui.test.js`.

## Next action

Start the next audit module with the Settings page-by-page control sweep; then specialized/taxonomy library roots, Recently Played/More/deep providers, and final accessibility/live-device regression.
