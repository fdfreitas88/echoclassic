# LIST-01 — complete paginated service lists

## Problem and value

People browsing large Radio, Apps, favourites, or service-plugin OPML folders can
reach only the first 200 entries. Echo Classic currently replaces continuation with
advice to search, which is not useful when a person wants to browse the complete
catalogue or when the service has no search entry. The outcome is an append-only
continuation control that keeps every loaded row and its normal Echo action available.

## Acceptance criteria

- **AC-LIST-01:** Given an OPML list whose first server page is full, when it is shown,
  then a reachable **Load next 100** control appends the next page without replacing
  existing rows.
- **AC-LIST-02:** Given 201 or more items, when all full pages are loaded until a short
  or empty page is returned, then every server-reported item is reachable and no
  static 200-item ceiling remains.
- **AC-LIST-03:** Given a playable or actionable item on any loaded page, when its row
  action is used, then the same Echo Classic action sheet or browse/play behaviour is
  available; pagination never substitutes a navigation-oriented “More” action.
- **AC-LIST-04:** Given a server page contains duplicate boundary items, malformed
  items, no new usable items, or an error, then the UI appends no duplicates, cannot
  loop indefinitely, and offers **Try again** only for a recoverable request failure.
- **AC-LIST-05:** Given a service supplies search, when search is used after multiple
  pages were loaded and then closed with Back, then the prior rows and scroll position
  are restored.
- **AC-LIST-06:** Given keyboard-only use or a narrow mobile viewport, when another
  page is loaded, then focus moves to a status summary immediately before the newly
  appended rows and an `aria-live` announcement reports the number added and total.
- **AC-LIST-07:** Given a list ends at 200 items or fewer, when it is browsed, then no
  continuation control remains; Radio playback, Apps navigation, favourites, search,
  and row action sheets retain their current behaviour.
- **AC-LIST-08:** Given Light, Dark, or Legacy appearance and long English or Portuguese
  labels, then the continuation, status, end, and retry states remain readable without
  clipping, and all new source phrases are whole English translation keys.
- **AC-LIST-09:** Given the selected player, node, or navigation frame changes while a
  page request is pending, then the late response cannot append to the replacement
  list.
- **AC-LIST-10:** Given LIST-01 is deployed to the server, when its continuation control
  is visible, then a small translated **New** label appears outside the control and the
  control keeps its complete accent border.

## Interface contract

The continuation is a dedicated full-width button below the loaded rows. Its whole
border uses the accent colour because it is the proposed control. During a request it
is disabled and labelled **Loading next 100…**. Success inserts a focusable status row
before the appended results; the stable button then moves below the new tail. A short
or empty page produces the passive end state **All N items loaded**. A recoverable
failure leaves existing rows intact and replaces the continuation with an inline error
plus **Try again**. A full page that contributes no unique actionable entries ends
pagination with an honest no-progress message and no retry loop.

A small **New** label sits beside the continuation control, never inside it. This is
the server-shipped feature marker requested at mockup approval and follows the existing
rule that buttons use a complete accent border rather than a marked edge.

The row itself remains the action surface. Audio rows keep their existing play/action
sheet path and menu rows keep their existing browse path. Pagination never puts its
own “More” affordance into an item row.

## Scope

**In scope:** paged OPML browse results in Radio, Apps, and favourites; append/dedupe
state; stale-response guard; recovery and no-progress states; search/back restoration;
focus/live announcements; responsive styling; English/PT strings; focused API/view
tests.

**Out of scope:** universal grid view, service-specific APIs, offline catalogue cache,
native wrappers, pagination of non-OPML library surfaces, and changing LMS/provider
ordering.

## Dependencies, assumptions, and risk

- No optional plugin is required; this improves the shared OPML contract used by
  optional services when present.
- The existing API already accepts `start` and `count`; the implementation must keep
  JSON-RPC construction in `api.js`.
- A page size of 100 is proposed for predictable progress and mobile feedback. End is
  detected from a short/empty response because the mapped API currently exposes no
  authoritative total.
- Duplicate identity must be derived from stable mapped action/node data, not title
  alone. Stage 3 must add that identity at the API boundary if the raw response offers
  it; otherwise no-progress protection remains mandatory and ambiguous same-title rows
  must not be collapsed.
- Search/back restoration requires navigation-frame state rather than a global cache;
  exact ownership is an implementation decision constrained by AC-LIST-05 and -09.
- Classification: **L · HIGH risk**. The shared surface spans remote pagination,
  navigation restoration, async races, identity, accessibility, and three product
  roots.

## Verified sources and baseline

- `EchoClassic/HTML/echoclassic/html/js/opmlview.js:65-72` — current truncation warning
  and state; `[code]`.
- `EchoClassic/HTML/echoclassic/html/js/opmlview.js:163-188` — current row actionability,
  browse, and play ownership; `[code]`.
- `EchoClassic/HTML/echoclassic/html/js/opmlview.js:205-248` — search and browse are
  fixed at 200 and replace list state; `[code]`.
- `EchoClassic/HTML/echoclassic/html/js/api.js:685-769` — OPML actions are mapped at the
  API boundary and requests already accept `start`/`count`; `[code]`.
- `EchoClassic/HTML/echoclassic/html/css/ios9.css:628-671,758-775,1670-1675` — existing
  row, search, retry, and loading grammar; `[code]`.
- `EchoClassic/strings.txt:1515-1517` — current user-visible 200-item ceiling; `[code]`.
- `node --test tests/opmlview.test.js tests/api.test.js` — 13 pass, 0 fail on the
  pre-change worktree; `[measured]`.

## Follow-ups discovered but not absorbed

- Provider-specific grids and catalogue totals remain separate ideas.
- Pagination for advanced search and playlists belongs to their own program items.
