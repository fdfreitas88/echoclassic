# AC-00 — the three unknowns, settled

Answers to the three questions that gated the lyrics, sync and alarm phases of 3.3.
Read this before designing any of them: **two of the three answers contradict the
premises the orchestration brief was written on.**

**Everything here is `[code]`.** Nothing was observed on a running server.

## What was read

Public `LMS-Community/slimserver`, pinned to tag **`9.1.1`**, commit
`1ceeaf1d601134f765b5a3e65113726284eaae6d` — the version the server under test
reports. A `public/9.1` branch also exists and is ahead of the tag; it was not used.
Line numbers below are against the tag, not master, and will drift on any other ref.

---

## AC-00a — lyrics · `W` refuted, lowercase `w` confirmed

| | |
|---|---|
| `W` | `release_type` — an **album** relationship tag. `Slim/Control/Queries.pm:5694`, column map `:5749` |
| `w` | **lyrics** — `Slim/Control/Queries.pm:5668`, column map `w => 'tracks.lyrics'` at `:5748` |

The chain is tag `w` → response key `lyrics` → `Track->lyrics` → column `tracks.lyrics`.
The DBI path adds the column at `Queries.pm:6463`; the emitter writes the key at
`:5833` (hash) and `:6019` (object).

`songinfo`'s own default tag string already contains `w`
(`Queries.pm:4580`), so a bare `songinfo` returns `lyrics` when the track has any.

**The skin is already asking for it.** The 43-character tag string at `api.js:354`
and `api.js:844` — `tags:aAcCdefgiIjJkKlLmMnopPDUqrROSstTuvwxXyY` — contains `w`.
Lyrics are already arriving in responses for tracks whose scanner populated the
column; they are dropped on the way through the mapper at `api.js:511-537`.

Consequences:

- The feature does **not** depend on the MusicArtistInfo plugin. It is not a
  plugin-dependency case at all, so the "line in place" rule does not apply to it.
- No API change is needed. The work is the mapper plus the reading surface.
- Only tracks with lyrics embedded in the file and read by the scanner have them.
  Remote and streamed tracks fall back to `remoteMeta` and generally carry none —
  which is exactly the case that must render **no row at all**, never a row leading
  to an empty screen.

---

## AC-00b — sync grouping · absent from `serverstatus`

`serverstatus` builds its player entries with `_addPlayersLoop`
(`Slim/Control/Queries.pm:3828`, sub at `:2617-2678`). That sub emits seventeen
fields — `playerindex, playerid, uuid, ip, name, seq_no, model, modelname, power,
isplaying, displaytype, isplayer, canpoweroff, connected, firmware,
player_needs_upgrade, player_is_upgrading` — and **nothing about sync**. The
`players` query calls the same sub (`:2611`) and is equally silent.

Where the grouping actually lives:

| Source | Shape | Cite |
|---|---|---|
| `status`, per player, **only when synced** | `sync_master` (player id), `sync_slaves` (comma-separated ids) | `Queries.pm:4122-4132` |
| `syncgroups`, whole server, one call | `syncgroups_loop` with `sync_members` and `sync_member_names`, master first | `Queries.pm:4676-4708` |
| `sync`, per player | comma-separated buddy ids, or `-` | `Queries.pm:4650-4673` |

There is also a middle path that does fit `serverstatus`: both `serverstatus` and
`players` accept `playerprefs:<csv>` and append any client pref to each player entry
(`:3806-3812`, `:2598-2602`, applied at `:2667-2672`). `syncgroupid` is such a pref,
set on master and joiner when a group forms
(`Slim/Player/StreamingController.pm:1931-1937`) and removed on unsync (`:2027`).
`serverstatus playerprefs:syncgroupid` therefore yields a numeric group id present
only on synced players — **membership, but not which member is master.**

Recommended: `syncgroups`, one whole-server call carrying both ids and names, rather
than one `status` per player.

---

## AC-00c — alarms · confirmed, and fade-in is player-level

**Repeat and days.** Two alarm kinds, documented at `Slim/Utils/Alarm.pm:41`.

- `_days` — arrayref of 7 booleans, index 0=Sun … 6=Sat. `undef` marks a calendar
  (absolute-date) alarm; `isCalendarAlarm` is literally `! defined $self->{_days}`.
  `Alarm.pm:116-118`, `:149`. Accessors at `:189-197` and `:205-224`.
- `_repeat` — boolean, defaults to 1. `Alarm.pm:120`, accessor `:250-257`.
- **Repeat and day-of-week are orthogonal.** A one-shot alarm is `repeat = 0` and
  **disables itself after it fires** rather than being deleted; `_days` is untouched.
  `Alarm.pm:533-538`. A list that assumes a fired one-shot has disappeared will be
  wrong.
- Wire shape: the `alarms` query returns per alarm `id, dow, enabled, repeat,
  shufflemode, time, volume, url` (`Queries.pm:237-245`), where `dow` is a
  comma-joined list of enabled day indices, e.g. `0,6` (`:231-238`). Written back
  with `dow` for the whole set, or `dowAdd` / `dowDel` for one day, plus `repeat` —
  `Slim/Control/Commands.pm:79`, `:191-208`.

**Fade-in.** The pref is **`alarmfadeseconds`**, declared in the client default-prefs
hash at `Slim/Player/Client.pm:45`, whose own comment reads "Boolean only, despite
the name". Default on. It is read only through
`$prefs->client($client)->get('alarmfadeseconds')` in `_fadeInSeconds()`
(`Alarm.pm:1929-1937`), which returns the constant `$FADE_SECONDS = 20` (`:59`) or
`undef`. **There is no per-alarm fade attribute anywhere in `Alarm.pm`.**

It surfaces on the `alarms` query as a **top-level `fade` key, outside
`alarms_loop`** (`Queries.pm:209`). That position is the confirmation: two alarms on
one player cannot disagree about it. The design decision to offer fade-in per player
rather than per alarm is correct.

---

## Corrections to the orchestration brief

Both would otherwise send implementation work at the wrong thing.

1. **Lyrics.** The brief notes the tag string carries "no `W`" and treats the
   feature as blocked on confirming `W`. `W` is release type; lyrics is `w`, and the
   string already has it. The phase is not void and is not MusicArtistInfo-dependent
   — it is smaller than budgeted.
2. **Sync.** The brief says `api.js:501-509` "maps only `id / name / connected /
   power` out of `serverstatus` and drops the rest", implying the sync fields are
   there to be picked up. They are not in `serverstatus` at all. The phase needs a
   second verb — `syncgroups` — not a wider mapping of the response it already has.

The alarm phase's premises were accurate and need no correction.
