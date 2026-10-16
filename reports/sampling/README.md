# Motion #3: bounded adversarial sampling investigation

**Result:** 2,200 completed generated cases (1,100 per subject), six minimized
**accuracy limitations**, and a reproduced **already-fixed Chromium painting
control**. No runtime changes, automatic fixes, upstream publication, performance
claims, newly established documented-contract violation, or current implementation
regression. This is bounded evidence, not a correctness proof.

Delivery: [Motion PR #6](https://github.com/robertpenner/motion.dev/pull/6),
stacked on shared-infrastructure PR #4; neither PR is merged by this execution.

Motion owns execution under [motion.dev#3](https://github.com/robertpenner/motion.dev/issues/3).
[penner#3404](https://github.com/robertpenner/penner/issues/3404) owns interpretation,
Prism/Phrase requirements, and adoption decisions. The subject references are
[Motion PR #3897](https://github.com/motiondivision/motion/pull/3897),
`plans/039-independent-transform-acceleration.md`, and correction
`284b77fc6c4d595fb96dff248eadda942cd11a13`.

## Immutable provenance

Both final pure and browser runs used committed harness
**`aee9dd871768a1eab10a2551fa4dbc90a781435c`**, with `dirty: false`. Evidence and
this report were committed afterward without changing that harness.

The first delivered study used `678c4cd6afef6730a1f1e53f1dd75207987c2536`.
Review then reproduced a setup-runner integration error: selecting a custom
sampling test completed Jest successfully but the root wrapper exited 1 because
the custom test had not written a run-ID receipt. The current harness adds those
receipts after successful checks, uses actual Jest titles for root selection,
and rejects ambiguous path/fixture overrides. The root wrapper's unknown-selector
failure remains unchanged. All bounded, discovery and browser evidence was
refreshed on both subjects at the new SHA; domain, quotas, measurements and
classifications are unchanged. These final runs replace, not add to, the reported
2,200-case budget.

`*/runner-receipts.json` proves root-wrapper execution separately from the full
sampling evidence: one 1,100-generated-case bounded receipt, one eight-family
discovery receipt, and two 18-fixture browser receipts per subject. A selected
seed/path replay reports one discovery family, not a generated budget; a fixture
replay reports one fixture. The internal witness label
`sampling accuracy characterization` is not a CLI selector. Root CLI regression
checks pass **4/4 on each subject**, including unknown-selector failure and the
intended standalone accuracy-assertion exit.

| Subject                | Exact revision built/tested                | Bundle SHA-256 (898 dist files each)                               |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| Historical #3897 merge | `e0c0e7fa8c47a0b070ffd630a5fc2d03d68e58f9` | `33bbf07aafa630ab0830b7141cc4f99998101333524e2a22dea3f04444be195f` |
| Recorded current       | `1cdaf642291dec275c8d218d383fe8cefa7fb91b` | `5f557011066ff7e97ce3b3e0ce858a6269a792b125f1f07fea12049a1fea3ab1` |

Current adds shared test infrastructure to production baseline
`2d27b041114f5f1cffc1f6d3ad522929ce0cc41f`, which includes the correction.
The fork name is not the subject identifier. Existing root-built, stamped current
and historical subjects were used; no dependency reinstall or subject rebuild
was needed for these test-only changes. `browserRevisions()` checked both actual
dist digests against `test_results/pbt-build.json` before browser execution.

The only revision adapter is `PBT_SUBJECT_ROOT`: Jest maps subject source imports
and motion-utils to that root; Vite serves its built entry points. There is no
revision-specific sampler/oracle implementation.

### Actual production paths, not payload guesses

-   Host: real `animateElement` → `AsyncMotionValueAnimation` → `TransformAnimation`.
    The normal shared adapter captures `element.animate` arguments, options and
    cancellation. A test-only `numberAt` prototype spy disambiguates an otherwise
    ambiguous two-endpoint `linear` payload: native tween uses zero sampler probes;
    shared progress uses probes. Explicit offsets identify adaptive output.
-   Browser: real public `Motion.animate` from the stamped subject bundles.
    A Playwright response-route observer injects **only a branch observation** in
    served `run()` JavaScript, immediately after
    `nativeEasing || getEasing(moving, from, to, bounds)`. It records native/shared/
    adaptive, source starts and segment endpoints; it does not change sampler
    arguments, decisions, payloads or subject files. Harness SHA records this hook.
-   Browser payload capture uses exported frameloop steps and a common future
    source-clock epoch, then awaits native pause readiness before seeking.
    This preserves exact alias-triggering phases without racing the real document
    timeline. Every measured native effect must remain paused, non-pending, with
    a non-null currentTime. Raw evidence records currentTime/progress at every time.
-   Independent free-running painting control uses real time, not the manual clock.

Exploratory browser setup initially raced native completion on slow WebKit
navigations. The harness was corrected before the final runs; idle/cancelled
effects are now an assertion failure, not rendering evidence. Earlier interrupted
or failed exploration is not counted toward any budget.

## Domain, oracle, geometry and tolerances

Generated plain-data parameters: integer amplitude **20–1,000**, duration
**200–2,000 ms**, phase **1–8**, shape **1–4**. Ordinary durations are 0.2–2 s;
large cases are 12–30 s with translation up to ±10,000 px; short repeats use
3–10 ms durations, 1 ms repeatDelay and 2–5 finite repeats. Uniform scale is
1–3; generated rotations can reach 1,000 degrees; skewX is 5–20 degrees.
All channels and easing outputs are finite numeric 2D values. No calc/percent,
3D, perspective, spring, custom mixer, negative-speed or scroll semantics are
claimed by this investigation.

`sampling-reference.ts` imports **no Motion sampler, generator, mixer, easing or
transform builder**. It independently evaluates:

1. Source numeric tracks, normalized times (including duplicate boundaries),
   holds, delays and finite loop/reverse timing; named CSS-equivalent
   easing uses an independent 50-step cubic-bezier bisection.
2. Emitted matching CSS transform-function lists, explicit offsets, native CSS
   easing and explicit-position `linear()` piecewise interpolation.
3. Motion's list order: **translation, uniform scale, rotation, skewX**. This is
   neither matrix-keyframe interpolation nor Penner's composition order.

Geometry: transform origin `(0,0)`, a 100×100 CSS-pixel square, four corners and
center. Screen-space error is the maximum Euclidean point displacement. Browser
computed matrices validate emitted list interpolation; raw bounding rectangles
are also retained. Screenshot sampling accounts for screenshot/CSS pixel ratio.

Separate metrics are retained rather than collapsed into one pass/fail score:

| Metric                        | Meaning / gate                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sourceChannelError`          | Independent source vs production source sampling; <`1e-6` gate, observed maximum `9.1064e-11`                                                    |
| `emittedChannelError`         | Per-channel source vs independently evaluated emitted payload; px/degrees/unitless scale                                                         |
| `screenPointError`            | Source vs emitted reference, in CSS pixels; **1 px is a discovery threshold only**                                                               |
| `emittedInterpolationErrorPx` | Independent emitted reference vs real browser matrix/points; <`0.03` serialization-aware gate for every original/minimized/control/oracle replay |
| `sourceScreenErrorPx`         | Independent source vs browser-rendered matrix/points                                                                                             |
| non-finite/invalid output     | Zero permitted; parser rejection, browser API fallback, missing effect or non-finite values fail validation                                      |
| representation                | Keyframe count, serialized payload bytes and easing-string bytes separately                                                                      |

The source's local heuristics (0.1 px/degree, 0.001 scale and 0.001 normalized
progress) are **not a global accuracy contract**. Neither is this report's 1 px
search threshold. No universal Motion/Penner accuracy requirement is inferred.
Maximum generated representation: **400 keyframes**, **44,006 serialized bytes**,
**3,045 easing bytes** (maxima can belong to different cases).

## Completed bounded budget and path gates

Each family had an enforced quota of **100 completed generated cases per subject**.
The runner rejects interrupted checks and verifies each `numRuns` and final count.
Discovery failures/shrinks, native/fallback controls and smoke tests do not inflate
this budget.

| Family                                                   |     Seed | Current actual path/count           | Historical actual path/count        |
| -------------------------------------------------------- | -------: | ----------------------------------- | ----------------------------------- |
| independent-timing                                       | 20261016 | adaptive 100                        | adaptive 100                        |
| shared-looking (powers 2 vs 2.001–2.004)                 | 20261017 | shared 100                          | shared 100                          |
| oscillation (aliases shared probes)                      | 20261018 | shared 100                          | shared 100                          |
| adaptive-midpoint (aliases adaptive endpoints/midpoints) | 20261019 | adaptive 100                        | adaptive 100                        |
| narrow-feature (1 ms half-width triangular bump)         | 20261020 | shared 100                          | shared 100                          |
| round-trip                                               | 20261021 | adaptive 100                        | adaptive 100                        |
| short-repeat                                             | 20261022 | adaptive 100                        | adaptive 100                        |
| hold                                                     | 20261023 | adaptive 100                        | adaptive 100                        |
| duplicate-boundary                                       | 20261024 | adaptive 100                        | adaptive 100                        |
| large-bounded                                            | 20261025 | adaptive 100                        | adaptive 100                        |
| near-zero-range (endpoint 1e-8)                          | 20261026 | adaptive 100                        | shared 100                          |
| **Generated total**                                      |          | **1,100: 800 adaptive, 300 shared** | **1,100: 700 adaptive, 400 shared** |

Additional per subject: **10 native controls**, **10 legitimate JS fallback
controls** (incompatible infinite cycles, explicitly asserting `group.isJS` and
not accelerated). Generated unsupported cases **0**, skipped generated cases **0**,
interrupted final families **0**. Both shared and adaptive have explicit minimum
coverage gates. Ordinary opt-in diagnostic/expected-failure tests are reported by
Jest as two skipped tests in the default invocation; these are not generated-case
or browser-engine skips.

Every fixture includes sampler-independent interior fractions 0.137, 0.371,
0.619, 0.887, feature centers/edges and boundary ±0.0000001 s. Oscillation uses
quarter-cycle feature times; narrow bumps sit between shared probes. Adaptive
oscillations agree at its 100 ms interval endpoints and midpoint while differing
elsewhere. Family construction survives integer shrinking; candidates leaving
the original production branch cannot replace a finding.

The opt-in deeper search raises the quota to **1,000 per family / 11,000 per
subject**, without relaxing path gates or interrupt handling. It was provided,
not counted as executed in this bounded report.

## Six current accuracy limitations, confirmed at both revisions

All six are classified **accuracy limitation without a promised global bound**,
not implementation regression or browser interpolation defect. Both revisions
produce the same relevant limitation. Every finding has paired original and
minimized JSON fixtures and raw browser confirmation in **Chromium 138.0.7204.23**
and **WebKit 18.5**. Maximum emitted-reference/browser disagreement across all
replays is **0.009143 px Chromium / 0.0001121 px WebKit**, well below the
diagnostic source errors.

Values below are from minimized current Chromium witnesses; historical results
match. WebKit confirms the same source error, with serialization-level differences.
`x,y` are translation components; full expected/observed channels and matrices
are retained in the JSON evidence.

| Fixture            | Actual path | Time (s) | Expected → observed                             | Max screen error C / W (px) |
| ------------------ | ----------- | -------: | ----------------------------------------------- | --------------------------- |
| oscillation        | shared      |    .0025 | y 2.25 → .25                                    | 2 / 2                       |
| adaptive-midpoint  | adaptive    | .1015625 | y 12.15625 → 10.1562                            | 2.00005 / 2                 |
| narrow-feature     | shared      |     .015 | y 2.3 → .3                                      | 2 / 2                       |
| duplicate-boundary | adaptive    | .0999999 | x 4.999995 → 19.7542                            | 14.754205 / 14.754239       |
| short-repeat       | adaptive    | .0040001 | x .0006667 → 19.8007                            | 19.800033 / 19.800000       |
| shared-looking     | shared      |    .1238 | x,y (264.764251,264.256761) → (265.171,265.171) | 1.000638 / 1.000988         |

Interpretation:

-   Finite shared probes cannot establish equality of arbitrary channel functions:
    wave/bump features can disappear entirely between agreeing probes.
-   Adaptive midpoint checks can mistake an oscillating interval for a line.
-   Duplicate-time and very short repeat jumps expose the finite jump-localization/
    minimum-interval representation; small time windows can contain large spatial
    errors. This is not a claim of widespread visible error at ordinary frame times.
-   Normalized shared-progress tolerance and easing serialization do not imply a
    fixed absolute/screen-space bound for large amplitudes.

Shrink metadata is identical on both subjects:

| Finding            | Discovery seed | Shrinks | Fast-check counterexample path       |
| ------------------ | -------------: | ------: | ------------------------------------ |
| oscillation        |       20261116 |       4 | `0:0:0:0:0`                          |
| adaptive-midpoint  |       20261117 |       4 | `0:0:0:0:0`                          |
| narrow-feature     |       20261118 |       4 | `0:0:0:0:0`                          |
| duplicate-boundary |       20261120 |       4 | `0:0:0:0:0`                          |
| short-repeat       |       20261122 |       3 | `0:0:0:0`                            |
| shared-looking     |       20261123 |      16 | `47:3:0:0:2:0:0:1:0:5:0:0:0:0:0:1:3` |

“Minimized” means relative to the declared shrinker and preserved branch, not
mathematical minimality. The discovery JSON's `completed` field is fast-check
`numRuns`, including the finding run; it is **not** the completed generated budget.
The budget is exclusively `bounded.json` plus its 1,100 `cases.jsonl` records.

### Already-fixed round-trip control, not a new current defect

The near-zero endpoint family changes from historical shared easing to current
adaptive keyframes. Gentle 1e-8 endpoint controls interpolate correctly in both
engines and are not themselves a painting-failure claim.

The pinned correction's float-residue control is retained separately:
`y: [-1e-30, -18, 0]`, duration 1.2 s, easeInOut. Paused payload evaluations have
correct computed styles at both revisions. Its **free-running infinite-repeat**
counterpart demonstrates why that alone is insufficient:

| Engine                 | Historical path / screenshot pixel                 | Current path / screenshot pixel   |
| ---------------------- | -------------------------------------------------- | --------------------------------- |
| Chromium 138.0.7204.23 | shared / white `[255,255,255,255]` (missing paint) | adaptive / blue `[0,119,255,255]` |
| WebKit 18.5            | shared / blue `[0,119,255,255]`                    | adaptive / blue `[0,119,255,255]` |

Raw computed matrices still describe the historical Chromium box correctly.
The screenshot, not computed matrix serialization, establishes the painting
failure. Both PNGs and raw pixel/rect/path observations are committed per engine
and subject. This control reuses the pinned fix's reproduction and is not
presented as a newly discovered/minimized current defect.

## Evidence inventory and replay

-   [`current/bounded.json`](current/bounded.json),
    [`historical/bounded.json`](historical/bounded.json): counts, paths, controls,
    provenance and worst observations per family.
-   `current/cases.jsonl`, `historical/cases.jsonl`: exactly 1,100 generated records
    each, including parameters, family seed, actual path and separate metrics.
-   `*/discoveries.json`: original/minimized fixtures, seed, shrink path/count,
    source/emitted measurements, payload keyframes/offsets/easing/timing and class.
-   `*/browser-{chromium,webkit}.json`: 17 original/minimized/control/oracle payload
    replays per engine and revision, plus independent free-running painting control.
    That is **68 payload captures + 4 live painting checks**, excluding smoke.
-   `*/browser-*-residue*.png`: paused and free-running raw screenshots.
-   `*/runner-receipts.json`: successful root bounded/discovery/browser selections
    with their own units and exact subject/harness provenance.
-   `replays/*.log`: all twelve standalone expected-failure assertion outputs.
-   [`../../tests/pbt/fixtures/sampling`](../../tests/pbt/fixtures/sampling):
    reusable plain-data specification and all deterministic replay fixtures.

The commands below were executed with HEAD at the immutable harness SHA above.
For an exact provenance replay use a checkout of that SHA; the later evidence-only
commit intentionally has a different HEAD but identical harness source.
All commands run from the dedicated sampling worktree root.

```sh
cd /Users/robertpenner/git/robertpenner/motion.dev.worktrees/worktree-ticket-3-sampling

# Run once with each subject root and matching label:
export PBT_SUBJECT_ROOT=/Users/robertpenner/git/robertpenner/motion.dev.worktrees/worktree-tickets-1-2-3-execution
export SAMPLING_SUBJECT=current
# Historical:
# export PBT_SUBJECT_ROOT=/Users/robertpenner/git/robertpenner/motion.dev.worktrees/worktree-pbt-historical-e0c0e7f
# export SAMPLING_SUBJECT=historical

FC_PROPERTY='sampling bounded investigation' yarn test:pbt
FC_PROPERTY='sampling discovery and path-preserving shrinking' yarn test:pbt
FC_PROPERTY='sampling browser confirmation and independent payload oracle' \
  yarn test:pbt:browser

# Existing direct Jest/Playwright commands remain supported:
# yarn jest --config tests/pbt/jest.config.cjs --runInBand \
#   tests/pbt/sampling.property.test.ts tests/pbt/sampling-reference.property.test.ts \
#   tests/pbt/smoke.property.test.ts
# yarn playwright test --config tests/pbt/playwright.config.ts \
#   sampling-browser.property.spec.ts smoke.property.spec.ts

# Optional larger host search (not included in reported counts):
PBT_DEPTH=deep yarn jest --config tests/pbt/jest.config.cjs --runInBand \
  tests/pbt/sampling.property.test.ts -t 'sampling bounded investigation'

# Expected-failure regression (intentionally exits 1 for accuracy assertion):
SAMPLING_SUBJECT=runner-replay \
PBT_FIXTURE=tests/pbt/fixtures/sampling/oscillation-minimized.json \
SAMPLING_EXPECT_FAILURE=1 FC_PROPERTY='sampling standalone replay' yarn test:pbt
# Omit SAMPLING_EXPECT_FAILURE for a passing one-fixture measurement.

# Exact seed/shrink replay (passing characterization wrapper):
SAMPLING_SUBJECT=runner-replay \
SAMPLING_FAMILY=oscillation FC_SEED=20261116 FC_PATH=0:0:0:0:0 \
FC_PROPERTY='sampling discovery and path-preserving shrinking' yarn test:pbt
# Direct single-fixture replay also remains supported:
# SAMPLING_FIXTURE=tests/pbt/fixtures/sampling/oscillation-minimized.json \
#   yarn jest --config tests/pbt/jest.config.cjs --runInBand \
#   tests/pbt/sampling.property.test.ts -t 'sampling standalone replay'
```

Replay commands use a separate `SAMPLING_SUBJECT` output label so they cannot
overwrite the full study's eight-family discovery evidence.

Each of the six `*-minimized.json` files was separately replayed with the
expected-failure command against **both subjects**; all 12 failed at the intended
≤1 px assertion, not compilation/setup. Omitting `SAMPLING_EXPECT_FAILURE` is a
passing measurement replay. Ordinary suites do not silently run failing assertions.

Other successful gates:

```sh
yarn tsc -p tests/pbt/tsconfig.json --pretty false
node --test scripts/pbt-sampling-runner.test.mjs
yarn prettier --check tests/pbt/sampling*.ts tests/pbt/execution-receipt.ts tests/pbt/browser-adapter.ts \
  tests/pbt/easing.ts tests/pbt/types.ts tests/pbt/playwright.config.ts \
  tests/pbt/jest.config.cjs tests/pbt/tsconfig.json scripts/pbt-sampling-evidence.mjs \
  scripts/pbt-sampling-runner.test.mjs \
  tests/pbt/fixtures/sampling/README.md tests/pbt/README.md
yarn jest --config tests/pbt/jest.config.cjs --runInBand \
  --testMatch '**/animation/waapi/transforms/__tests__/TransformAnimation.test.ts'
PBT_SUBJECT_ROOT=/Users/robertpenner/git/robertpenner/motion.dev.worktrees/worktree-tickets-1-2-3-execution \
  yarn playwright test --config tests/pbt/sampling-ordinary.config.ts
```

Results: TypeScript/format passed; targeted ordinary Jest **30/30**; ordinary
independent-transform + handoff Playwright **52/52** across both engines.
The refreshed root-selected bounded and discovery checks each passed on both
subjects; selected browser confirmation passed **2/2 per subject**. Root CLI
regressions passed **4/4 per subject**; existing root browser smoke passed **2/2**
on current; deterministic reference root selection passed. The earlier combined
PBT invocation also passed **5 Jest tests +4 browser tests per subject**. Explicit
opt-in and selector-filtered Jest skips are not skipped generated cases.
No browser engine was skipped or reinstalled. No Penner files were changed, so
Penner checks were inapplicable.

## Initial Penner applicability and bounded limitations

-   Carry reusable **scalar/source trajectory** fixtures across repositories only
    where easing and repeat boundary semantics agree. Wave/bump aliases are
    particularly relevant to easing-to-CSS conversion and any sampled backend.
-   Require an explicit approximation policy if Penner adopts sampling: distinguish
    normalized-channel agreement, absolute channel error, geometry error, feature
    discovery, and representation budget. Finite probes cannot prove arbitrary
    functions equal. Discontinuities need an explicit left/right ownership policy.
-   Rotation/scale/skew fixtures must be recomposed using the target system's own
    order. Motion's geometry expectations are **not** drop-in Prism/Phrase results.
-   Preserve the float-residue case as a compositor/representation safety control,
    including actual paint checks, not merely finite JS output or computed matrices.
-   These are initial semantic notes, **not** adoption decisions. Penner #3404
    remains authoritative for applicability and requirements.

No coverage claim is made for unsupported units/3D, springs, mirror repeats, arbitrary callback
state, layout/scroll effects, all durations/amplitudes, all discontinuities, other
browser versions, Firefox or exhaustive lifecycle behavior. The two historical/
current subjects are exact recorded snapshots, not a moving “latest” branch.
Absence of newly established current regressions in this bounded domain does not
imply universal correctness or promote prototype notes into a global guarantee.
