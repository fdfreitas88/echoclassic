# Scan error recovery and journal

## Problem and feasibility boundary

A library scan must not become opaque when one file or folder fails. Echo Classic should
show that the scan continued, retain a useful error list and provide honest recovery
actions. LMS 9.1 exposes a server-wide `abortscan` command, but its public control layer
does not expose skip-current-item, resume-suspended-scan or retry-one-item commands.
Echo Classic must not present those labels unless a verified backend capability exists.

The proposed contract therefore distinguishes scanner behavior from journal behavior:

- recoverable scanner errors remain non-blocking and the scan continues under LMS;
- Echo records failures with stage, safe path/item label, time, reason and retry status;
- **Ignore** acknowledges one journal entry and hides it from the active list without
  changing files, LMS exclusions or scanner behavior;
- **Retry folder** starts a new targeted scan only when that command is capability-probed;
- **Retry all** groups supported retry targets into a new run, never an implied resume;
- fatal scanner termination is reported as stopped, with Start scan again—not Continue.

## Acceptance criteria

- **AC-SCANERR-01:** A recoverable file/folder failure is recorded while later scan work
  continues; the active task and completed counts remain visible.
- **AC-SCANERR-02:** Each error records a stable id, timestamp, scan run, stage, safe item
  label/path, reason, retryability, retry attempts and final state.
- **AC-SCANERR-03:** Ignore removes an entry from the active error count but retains it in
  the ignored history until Clear ignored is explicitly confirmed.
- **AC-SCANERR-04:** Retry folder and Retry all appear only after a positive server
  capability probe; failure preserves the journal entry and gives a concrete action.
- **AC-SCANERR-05:** No UI claims to skip a current file or continue a suspended scan when
  LMS cannot perform that operation. Recoverable continuation is described as automatic.
- **AC-SCANERR-06:** Error paths never expose credentials or remote URL query strings;
  inaccessible paths wrap and remain copyable without forcing horizontal overflow.
- **AC-SCANERR-07:** The journal survives navigation and restart within a bounded retention
  policy, deduplicates repeated failures per run and never grows without limit.
- **AC-SCANERR-08:** Keyboard focus, screen-reader status, EN/PT copy, Light/Dark/Legacy,
  wide/narrow/short layouts and every empty/loading/error/retry state pass the full
  cosmetic gate.
- **AC-SCANERR-09:** Existing scan, database and LMS settings behavior remains owned by
  LMS; Echo does not delete files, mutate exclusions or suppress server logs.

## Interface contract

The live “Now scanning” field says “Continuing after 3 errors” when applicable. A flat
error journal follows the gauges. Each active row has Retry folder when supported and
Ignore. The header has Retry all only when at least one active entry is retryable. Ignored
entries live behind a count disclosure. Fatal termination uses Start scan again.

## Implementation dependency

This is an **L · HIGH-risk backend feature**, not an iframe-only cosmetic change. Before
production work, inspect the installed LMS command surface and scanner logs on the test
server, define the bounded journal store in `Plugin.pm`, capability-probe targeted scans,
and test redaction, concurrency, restart and retention. If targeted scans are unavailable,
ship the journal and Ignore only; do not fake Retry.

## Evidence

- Upstream `Slim::Control::Commands` implements `abortScanCommand` by calling
  `Slim::Music::Import->abortScan()`. `[code]`
- No skip-current, resume-scan or retry-item command was found in the upstream LMS 9.1
  control surface reviewed on 2026-08-16. `[code/unverified on installed server]`

