# Apple Squeezer LMS Store API v2

Apple Squeezer is an independent LMS Store plugin. Echo Classic is a client of
its JSON-RPC/CLI contract and does not launch binaries, inspect files, or own the
plugin lifecycle.

The currently published Intel build can be added to LMS with this repository:

```text
https://github.com/fdfreitas88/plugin-AppleSqueezerIntel/releases/download/v1.0-rc2/repo.xml
```

Echo also negotiates the published 1.0.2 command surface (`apple_squeezer`)
and adapts its underscore command names to this client contract. API v2 below
remains preferred because it adds player-scoped state, explicit capabilities,
and optimistic DSP revisions.

## Discovery and status

Echo first probes `can applesqueezer status ?`. When available it calls:

```text
<player-id> applesqueezer status player_id:<player-id>
```

The response must include `apiVersion: 2`, `lifecycle`, `running`, `capabilities`,
`dsp_owner`, `dsp_revision`, and the current per-player `dspConfig`. Structured
fields may be returned as JSON objects or JSON strings. Supported capability
keys are `lifecycle` and `telemetry`.

## Per-player DSP ownership

```text
applesqueezer dsp-owner player_id:<player-id> owner:apple-squeezer
applesqueezer dsp-owner player_id:<player-id> owner:squeezedsp
```

The response confirms the chosen `owner`. The plugin must persist ownership on
the server per player; browser local storage is not authoritative.

## Atomic DSP updates

```text
applesqueezer dsp-apply player_id:<player-id> expected_revision:<revision> config:<json>
applesqueezer dsp-rollback player_id:<player-id> revision:<revision>
applesqueezer dsp-bypass player_id:<player-id> enabled:0|1
```

`dsp-apply` must reject a stale `expected_revision`, apply the entire document
atomically, and return the new revision. Echo reads `status` afterward and only
reports success if `dsp_revision` changed. If confirmation fails, Echo requests
rollback.

## Telemetry and response

```text
applesqueezer telemetry player_id:<player-id>
applesqueezer dsp-response player_id:<player-id> rate:<hz> points:<count>
```

When the `telemetry` capability is advertised, the lightweight command is used
instead of polling the complete status document. Telemetry may include peak,
true-peak, clipped-sample and latency values.

## Lifecycle

When the `lifecycle` capability is advertised:

```text
applesqueezer lifecycle start|restart|recover
```

These commands are owned by Apple Squeezer. Echo only exposes controls that the
installed plugin explicitly advertises.
