# Lifecycle investigation (#2)

## Bounded contract

The fast tier uses `fc.commands` / `fc.asyncModelRun`, separate model and real
controls, and the production `animateElement` adapter. Each of 200 cases starts
with an observed native effect, pauses/seeks both tracks, then executes at most
16 generated commands. A redundant pause/play is rejected by the command
precondition; synchronized play is allowed when only one track is paused.
Time, state, positive rate and disposal/owned-effect uniqueness are assertions.
The manual clock starts at 100000 ms so generated positive seeks/rates cannot
accidentally put a start timestamp at the special zero origin.

The browser tier has 18 explicitly enumerated transition templates, each with
two seeded parameterizations **per engine per subject** (36 completed sequences,
not 36 attempts). Seek, rate and running wait are generated. Templates deliberately
retain the native-start prefix and the named transition when shrinking. The fast
tier explores command order; browser templates explore bounded transition
parameters, **not arbitrary permutations**. Deeper opt-in budgets are 2000 fast
sequences and 20 parameterizations per browser category/engine.

The browser reference is an independent authored piecewise-linear trajectory:
`from + (to-from)*progress`, with pause/seek/rate anchors, delay, bounded repeats,
reverse repeats and infinite loop phase. It does not read Motion's sampler,
generated keyframes or playback-control time to calculate expected positions.
The separate captured control times are diagnostics and supported-control checks.
Finite interrupted tracks must never complete; short finite tracks complete once
in authored duration order. Infinite tracks do not complete before disposal.
Stopping/leaving cancels their owned effects, but must preserve unrelated tracks.

Composition is translation x, then y, then rotate, about the element's top-left
origin. Both computed matrices and bounding rectangles are retained; reference
translation and rotation produce independent expected geometry. Running positions
use `document.timeline.currentTime` while owned transform effects exist and
Motion `frameData.timestamp` on JS. Action anchors use frame-synchronized
`time.now()`. Both clocks, effect times/start times, keyframes, target ownership,
stable effect identities, controls and completion events are recorded.

Running scalar tolerance is 0.2 units plus 25 ms times authored speed. Paused
seek/hold tolerance is 0.2 px; control time tolerance is 2 ms (JS rounds elapsed
milliseconds). Independent geometry allows that scalar tolerance plus 4 px for
rotational timing; matrix/rectangle self-consistency is also checked at 0.1 px.
These are short correctness experiments, not smoothness or performance claims.
Velocity is not asserted: this domain excludes springs/inertia and does not
promise instantaneous continuity across authored seeks, reversals or writes.

## Allowed paths and exclusions

-   Synchronized pause/play/rate retain the existing owned native effect identity.
-   Independent controls, interruption, joining and leaving can rebuild native
    effects. Obsolete owned identities must be idle; unrelated x/y survive.
-   Outside-write churn, external native cancellation, negative speed, projection
    measurement and incompatible infinite cycles may permanently demote the
    current tracks. Returning to positive speed does **not** require promotion.
-   A short per-frame callback track temporarily requires JS. Its completion must
    let compatible remaining tracks return with new owned native identities.
-   Projection is tested through the actual exported `HTMLProjectionNode.mount`,
    `willUpdate`, and `unmount` lifecycle, not a fake transform write. This is a
    focused DOM measurement handoff, not a React layout-animation integration test.
-   Unsupported in this bounded model: SVG, percentages, custom transform templates,
    scroll timelines, inertia/springs, repeatDelay/mirror, nested projection geometry,
    negative delays, simultaneous external ownership of the same animated value,
    zero-rate indefinite holds, unsupported browser versions and arbitrary callback
    side effects. These are not silently counted as supported coverage.
-   `getVelocity() === 0` during acceleration is documented and is not a defect.
    The float-residue roundtrip correction is an already-fixed control, not a new
    current defect.

An observed owned native `transform` effect with target/keyframes/timeline is
path evidence, **not proof of compositor scheduling**. No compositor performance
conclusion is made from animation counts, inline styles, or rAF observations.

All cases stop controls, cancel every captured native identity, release
styleEffect subscriptions, unmount projection nodes, remove elements and restore
patched APIs in `finally`; the fast adapter also restores clocks and frame state.
Reloading the browser page isolates cases and shrink attempts.

## Commands (repository root)

```sh
FC_PROPERTY='lifecycle production commands' yarn test:pbt
FC_PROPERTY='lifecycle production commands' yarn test:pbt:deep
PBT_SUBJECT_ROOT=<built-subject> yarn test:pbt:browser --grep 'lifecycle browser'
PBT_DEPTH=deep PBT_SUBJECT_ROOT=<built-subject> yarn test:pbt:browser --grep 'lifecycle browser'
FC_PROPERTY='lifecycle production commands' PBT_FIXTURE=tests/pbt/fixtures/lifecycle-mixed-control.json yarn test:pbt
FC_PROPERTY='lifecycle browser projection' PBT_FIXTURE=<saved-case-or-witness.json> PBT_SUBJECT_ROOT=<built-subject> yarn test:pbt:browser
yarn playwright test -c tests/pbt/playwright.config.ts --grep 'lifecycle locked'
yarn tsc -p tests/pbt/tsconfig.json --pretty false
```

Port defaults to **8022**; `PBT_PORT` overrides it. Current and historical adapters
use the same `animateElement` source path and `window.Motion`/`MotionDOM` bundle
exports; no production-entrypoint shim is necessary for these two revisions.
The ordinary independent-transform control spec installs `waitFrame` only when
absent: the historical HTML fixture predates that test-only timeline-refresh helper.
The inherited provenance guard rejects unstamped/stale bundles. Final evidence
must name the committed harness SHA independently of both built subject SHAs.

Saved witnesses contain original and minimized input, seed/path/shrink counts and
the original assertion cause. Browser category cannot shrink away; every attempt
must observe its native-start prefix. For a current defect, deliver an explicit
fixture/expected-failure replay rather than weakening or silently failing default
regressions. A bounded negative result does not establish correctness outside
this domain.
