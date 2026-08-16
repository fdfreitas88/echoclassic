# Connected-service artist metadata enrichment

## Problem and outcome

Local artist pages know which albums are in the LMS library, but they do not benefit
from richer artist information available through connected services and compatible LMS
information providers. A local Beatles album should open the **local Beatles artist**
page, where Echo Classic can add an attributed biography, images and external identities
without turning the page into a remote catalogue or rewriting the user's audio files.

The feature is a reversible presentation/cache overlay keyed to the canonical local LMS
contributor id. It does not write provider text into tags, mutate the LMS database, copy
credentials, or imply that a streaming album is locally owned.

## Acceptance criteria

- **AC-ARTMETA-01:** Given a local artist, opening the artist from a local album or track
  always navigates by the canonical local contributor id and lists local albums first.
- **AC-ARTMETA-02:** Echo capability-probes MusicArtistInfo and each connected service;
  absent, disconnected or unsupported sources produce one useful status in place and no
  dead controls. When MusicArtistInfo is absent, Echo offers **Install plugin**, which
  hands off to LMS Plugin Manager for explicit confirmation, progress, restart if LMS
  requires it and final capability re-check. Echo never downloads or sideloads code.
- **AC-ARTMETA-03:** A candidate match uses stable provider ids when available. Otherwise
  it requires normalized artist name plus corroborating local/remote album evidence; a
  name-only match is never applied automatically.
- **AC-ARTMETA-04:** Conflicting or ambiguous candidates enter Review match. Until the
  user selects one or chooses Not this artist, no remote fields are attached.
- **AC-ARTMETA-05:** Biography, image, identifiers, genres and related-artist fields retain
  field-level source, retrieval time and attribution. Local values win when present unless
  the user explicitly selects a different source.
- **AC-ARTMETA-06:** Remote releases appear under **Also on connected services**, grouped
  by provider. They never enter the Local library album count or masquerade as local media.
- **AC-ARTMETA-07:** Refresh, Review match and Remove enrichment are reversible. Removing
  the overlay leaves local LMS metadata and media untouched.
- **AC-ARTMETA-08:** The bounded cache is invalidated by local contributor/library change,
  connection removal, provider identity change, expiry or explicit refresh. Expired cached
  content is labelled; credential-bearing URLs and secrets are never stored.
- **AC-ARTMETA-09:** Loading, no match, ambiguous, partial-provider failure, offline cached,
  removed and success states are keyboard/screen-reader usable and translated EN/PT.
- **AC-ARTMETA-10:** The artist surface passes Light, Dark and Legacy plus wide, split,
  narrow and short-viewport cosmetic matrices with no nested frames, overflow or raw
  provider chrome. The feature carries the small **NEW** label for release 3.3.0.
- **AC-ARTMETA-11:** With MusicArtistInfo available, Echo can request biography,
  one/multiple credited portraits, album review and cover candidates through documented
  CLI calls. Lyrics and local information files remain reachable from their appropriate
  track/album information surfaces rather than being duplicated on the artist header.
- **AC-ARTMETA-12:** Related artists and external discography appear only when their LMS
  menu endpoints are capability-positive. Related artists that match a canonical local
  contributor open locally; unmatched ones are labelled external and never fabricated as
  local-library artists.

## Matching and ownership contract

1. Resolve the canonical local contributor and collect local album evidence.
2. Ask only capability-positive connected sources for candidates and metadata.
3. Score candidates using provider id, normalized name, album title, release year and
   artist-credit evidence. Store the evidence used, not just a confidence number.
4. Auto-attach only a unique high-confidence candidate. Everything else is reviewed.
5. Merge display fields by explicit precedence and provenance; never merge identities.
6. Keep service catalogue links/releases in their own section. The artist heading and
   every local album artist link continue to target the local contributor frame.

## Dependency and rights boundary

MusicArtistInfo 1.29.2 declares LMS 8.0+ compatibility and sources information from
Wikipedia, Last.fm, Discogs, MusicBrainz, local files and the LMS community metadata
service. Its documented CLI exposes `biography`, `artistphoto`, `artistphotos`,
`albumreview`, `albumcovers`, `lyrics` and `localfiles`. The plugin additionally provides
related artists (Last.fm) and discography (Discogs) through LMS menu callbacks, plus scan-
time artist-picture/cover caching and an optional online-genre replacement. Echo should
consume the read-only information calls; settings that write images or replace genres
remain in the plugin's own settings and are not silently enabled.

Qobuz and TIDAL remain independent connected-catalog sources. MusicArtistInfo must not be
described as obtaining data from either service. Every displayed field identifies both
the integration (MusicArtistInfo) and upstream source when returned. The implementation
must respect provider attribution and cache restrictions; where persistence is not
permitted, retain only the provider identity and fetch display data on demand.

The install action is a controlled hand-off, not a bundled dependency: query LMS for the
plugin and its compatibility, show version/author/source, ask the user to confirm, invoke
only a verified native Plugin Manager action, show install/restart outcome, then re-probe
the CLI. If no safe install command is exposed, the button opens Server Settings > Plugins
with Music & Artist Information identified and leaves installation to LMS.

## Scope and risk

**In scope:** local artist-page enrichment; MusicArtistInfo install hand-off and CLI/menu
capability probe; conservative identity matching; provenance; biography; credited photos;
related artists; discography; review/remove/refresh; separate connected-service releases;
cache/error/offline states.

**Out of scope:** editing media tags, changing LMS contributor records, downloading
provider catalogues, bundling/sideloading plugins, silently enabling importer writes,
merging same-name artists, or making remote albums part of the local library.

This is **L · HIGH risk** because identity errors can present the wrong person's data,
provider contracts differ, and multiple optional integrations must degrade honestly.

## Repository evidence

- `detail.js` resolves an album's canonical artist and opens an artist frame with local
  `id`/`ids`. `[code]`
- `api.js` owns JSON-RPC and canonical local artist/album lookup. `[code]`
- `browse.js` already distinguishes Local library, Qobuz and other remote URL schemes and
  keeps a last-scan-keyed local metadata index. `[code]`
- `plugin-dependency-policy.md` requires detect/degrade behavior and identifies
  MusicArtistInfo as the optional biography/similar-artist/review source. `[code/policy]`
- MusicArtistInfo's `CLI.md`, `ArtistInfo.pm`, `AlbumInfo.pm`, `Importer*.pm`, `Plugin.pm`
  and `install.xml` define the capabilities and installation metadata above. `[code]`
- TIDAL capability and provider-specific metadata/cache terms remain unverified until an
  installed-server capability pass. `[unverified]`
