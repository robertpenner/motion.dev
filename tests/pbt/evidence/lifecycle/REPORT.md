# Motion #2: bounded lifecycle results

## Outcome

**No new current defect was found in the declared domain.** Both subjects completed
200 production-adapter command/model sequences and 36 short browser sequences
**per engine**, without shrinking, interruption or retries. This is bounded
negative evidence, not a claim of complete correctness.

The existing float-residue roundtrip control distinguishes the revisions:
historical Chromium painted white; current Chromium painted blue. Both WebKit
runs painted blue. This is the **already-fixed** `284b77fc6` regression, not a new
handoff finding. No runtime fix, upstream publication, Penner runtime change,
browser installation or second dependency installation was made.

## Exact subjects and provenance

All final comparative runs used clean committed harness
`81d76a4f61b1a241fb090213e1bcbeb327cdeeb8`. The later evidence/report commit
does not change the generated experiments.

| Subject    | Exact built checkout revision              | Bundle SHA-256                                                     |
| ---------- | ------------------------------------------ | ------------------------------------------------------------------ |
| Current    | `1cdaf642291dec275c8d218d383fe8cefa7fb91b` | `5f557011066ff7e97ce3b3e0ce858a6269a792b125f1f07fea12049a1fea3ab1` |
| Historical | `e0c0e7fa8c47a0b070ffd630a5fc2d03d68e58f9` | `33bbf07aafa630ab0830b7141cc4f99998101333524e2a22dea3f04444be195f` |

Current's production baseline is `2d27b0411`, containing correction
`284b77fc6c4d595fb96dff248eadda942cd11a13`; `1cdaf6422` adds the shared test
infrastructure. Each digest covers the actual 898 built files, including names,
in motion-utils, motion-dom and framer-motion. Provenance was revalidated against
the actual bundle contents before every browser property.

Subjects were the explicitly supplied parent current worktree and historical
worktree. All implementation, commands and writes were in the dedicated
`worktree-ticket-2-lifecycle` checkout; neither subject was edited.
`animateElement` and the Motion/MotionDOM exports work unchanged on both
revisions. The ordinary control spec supplies a missing historical **fixture**
`waitFrame` helper; it does not shim runtime behavior.

## Completed budgets and coverage

Seed: **20261016**, for every named property. Chromium **138.0.7204.23**;
WebKit **18.5**. Retries: zero. Port: **8022**.

Per subject, the fast tier completed 200 sequences containing 1133 executed
commands, length 2–11 including the fixed native/pause/seek prefix. Generation
permits up to 16 additional commands; rejected preconditions are not counted.
Both subjects had identical fast coverage:

| Operation | Synchronized/all | Independent/x |
| --------- | ---------------: | ------------: |
| pause     |              254 |            24 |
| play      |              102 |            77 |
| seek      |              316 |           124 |
| rate      |              118 |           118 |

Each of the four subject/engine combinations completed **36 sequences**:
two generated parameterizations of every category below. Browser operation
lengths were 1–4 named transitions, 58 transitions per engine/subject, in addition
to native setup, running waits, observations and disposal.

| Category                                     | Current Chromium | Current WebKit | Historical Chromium | Historical WebKit |
| -------------------------------------------- | ---------------: | -------------: | ------------------: | ----------------: |
| sync pause/play                              |                2 |              2 |                   2 |                 2 |
| independent pause/play                       |                2 |              2 |                   2 |                 2 |
| sync seek                                    |                2 |              2 |                   2 |                 2 |
| independent seek                             |                2 |              2 |                   2 |                 2 |
| sync rate                                    |                2 |              2 |                   2 |                 2 |
| independent rate                             |                2 |              2 |                   2 |                 2 |
| interruption                                 |                2 |              2 |                   2 |                 2 |
| join/leave                                   |                2 |              2 |                   2 |                 2 |
| finite reverse repeat + delay                |                2 |              2 |                   2 |                 2 |
| infinite reverse repeat                      |                2 |              2 |                   2 |                 2 |
| outside-write churn                          |                2 |              2 |                   2 |                 2 |
| native cancellation, survival and completion |                2 |              2 |                   2 |                 2 |
| callback demotion and return                 |                2 |              2 |                   2 |                 2 |
| negative/positive rate, sticky JS            |                2 |              2 |                   2 |                 2 |
| incompatible infinite loops                  |                2 |              2 |                   2 |                 2 |
| mixed independent/sync controls              |                2 |              2 |                   2 |                 2 |
| real projection-node measurement             |                2 |              2 |                   2 |                 2 |
| short-track completion order                 |                2 |              2 |                   2 |                 2 |

Each subject/engine had identical path/semantic counters:
native-start 36; disposal 36; retained-effect-identity 4;
replaced-owned-effect 8; sticky-JS 8; callback-JS-return 2; projection-JS 2;
finite-completion-once/interrupted-never 2; infinite-never-completes 4;
cancel-completion-once 2; ordered-completion 2. Snapshot observations were
owned-native 208 and JS/no-native 38, **not** counts of transitions or proof
of compositor scheduling. The remaining 36 snapshots are disposal observations.
All category/path quotas passed. No-op seeks/rates and redundant pause/play
are rejected or explicitly excluded from transition coverage.

## What was asserted and retained

See [LIFECYCLE.md](../../LIFECYCLE.md) for the independent equations, state
preconditions, supported domain, allowed fallback/return semantics and exclusions.
Browser expectations do not use generated keyframes, Motion's sampler or
control-time getters to derive trajectories.

-   Actual displayed x/y/rotation and bounding geometry immediately before and
    after transitions, plus running and terminal observations.
-   Paused hold and seek values separately from genuinely running lifecycle tests.
-   Supported state/time/rate behavior; finite completion order/count; interrupted
    tracks not completing; infinite loops not completing; cancellation still
    reaching both finite completions; unrelated tracks surviving edits.
-   Stable effect identities, targets, cancellation of superseded effects and
    disposal. A post-run identity audit found no stale effects, resurrected
    cancelled identities or wrong targets in **282 snapshots / 474 effect
    observations per subject/engine**. At most one transform effect is allowed,
    except the two declared infinite-loop categories, where main+loop permits two.
-   Frame/timeline clock separation and finite-difference continuity of unrelated
    continuous x tracks in eight handoff categories. At least 50 windows per
    subject/engine were required, with positive movement and displacement residual
    at most 0.25 px over 20–500 ms windows:

| Subject/engine      | Windows | Maximum residual (px) |
| ------------------- | ------: | --------------------: |
| Current Chromium    |      54 |              0.060037 |
| Current WebKit      |      54 |            0.00000434 |
| Historical Chromium |      54 |              0.046701 |
| Historical WebKit   |      55 |            0.00000200 |

Running scalar tolerance: 0.2 units + authored speed × 25 ms; paused pixels:
0.2; control time: 2 ms; independent geometry: scalar tolerance + 4 px rotational
timing allowance; matrix/rectangle self-consistency: 0.1 px.
These tolerances and original raw times/measurements are retained, not replaced
by rounded report values.

## Fixed controls

The exact same committed harness ran five ordinary controls per engine/subject:
locked paused geometry, locked callback return, inertia join/return, external
native cancellation completing, and the existing float-residue paint regression.

Current: **10 passed**. Historical: **9 passed, 1 expected historical failure**.
The failure is only Chromium's already-fixed roundtrip paint control:

| Subject    | Chromium pixel RGBA | WebKit pixel RGBA |
| ---------- | ------------------- | ----------------- |
| Current    | `[0,119,255,255]`   | `[0,119,255,255]` |
| Historical | `[255,255,255,255]` | `[0,119,255,255]` |

Expected blue is `#0077ff`; white indicates the known painting regression.
This is screenshot pixel evidence, not a `getAnimations()` or style-value claim.
The historical command intentionally exits 1. No current default test is failing,
and no new current-defect expected-failure fixture is warranted.

## Deliverables and exact replay

-   `summary.json`: exact revisions, built digests, budgets and all coverage counts.
-   `current.json.gz`, `historical.json.gz`: complete run witnesses, model command
    logs, browser operation logs, expected/observed trajectories, clocks, matrices,
    geometry, keyframes, native identities, events, tolerances and seeds.
    Compressed-file SHA-256 and raw byte counts are in `summary.json`.
-   `corpus.json`: 36 serializable browser case fixtures with operation labels.
-   `continuity.json`: every accepted finite-difference window and residual.
-   `ownership.json`: stricter category-specific owned-effect audit summary.
-   `current-controls.log`, `historical-controls.log`: ordinary control results,
    raw screenshot pixels and historical assertion failure.
-   `../../fixtures/lifecycle-mixed-control.json`: supported serialized command
    replay. No final counterexample exists: original/minimized are null, shrink
    count is zero, and no failure seed is claimed.

Run from this repository root. `SUBJECT` is either exact built checkout above:

```sh
cd /Users/robertpenner/git/robertpenner/motion.dev.worktrees/worktree-ticket-2-lifecycle
SUBJECT=/Users/robertpenner/git/robertpenner/motion.dev.worktrees/worktree-tickets-1-2-3-execution
# Repeat with historical:
# SUBJECT=/Users/robertpenner/git/robertpenner/motion.dev.worktrees/worktree-pbt-historical-e0c0e7f
export FC_SEED=20261016
PBT_SUBJECT_ROOT="$SUBJECT" FC_PROPERTY='lifecycle production commands' yarn test:pbt
PBT_SUBJECT_ROOT="$SUBJECT" yarn test:pbt:browser --grep 'lifecycle browser'
PBT_SUBJECT_ROOT="$SUBJECT" yarn playwright test -c tests/pbt/playwright.config.ts --grep 'lifecycle locked|an animation cancelled from outside|inertia animation joins|round trip from a float residue'

node scripts/pbt-lifecycle-report.mjs replay projection 0
FC_PROPERTY='lifecycle browser projection' PBT_FIXTURE=test_results/lifecycle-replay.json PBT_SUBJECT_ROOT="$SUBJECT" yarn test:pbt:browser
FC_PROPERTY='lifecycle production commands' PBT_FIXTURE=tests/pbt/fixtures/lifecycle-mixed-control.json PBT_SUBJECT_ROOT="$SUBJECT" yarn test:pbt
node scripts/pbt-lifecycle-audit.mjs
```

Replay runs one fixture, not the random budget. The browser category/native
prefix cannot disappear during shrinking; command shrinking rechecks model
preconditions. Every case/shrink attempt cleans up in `finally`.
Use the named harness commit for exact generated-run reproduction.

Additional gates completed:

```sh
yarn build
yarn workspace motion-dom exec jest --config jest.config.json --runInBand --runTestsByPath src/animation/waapi/transforms/__tests__/lifecycle-model.test.ts src/animation/waapi/transforms/__tests__/TransformAnimation.test.ts
yarn tsc -p tests/pbt/tsconfig.json --pretty false
yarn prettier --check tests/pbt/lifecycle*.ts tests/pbt/playwright.config.ts tests/pbt/production-adapter.ts tests/animate/independent-transforms-lifecycle.spec.ts tests/animate/independent-transforms.spec.ts packages/motion-dom/src/animation/waapi/transforms/__tests__/lifecycle*.ts scripts/pbt-lifecycle*.mjs
git diff --check
```

Root build passed (8 tasks), targeted Jest **32 passed**, TypeScript and formatting
passed. No new Cypress specs were added. No Penner files changed, so no Penner
gates apply. Browser servers shut down; port 8022 was released.

## Interpretation limits and Penner applicability

The fast tier explores command ordering; browser generation explores bounded
transition-template parameters, not arbitrary browser command permutations.
Deep budgets were offered but not run. The complete repository suites, full React
layout integration, unsupported cases listed in the domain document, instantaneous
velocity and spring interruption momentum were not claimed verified.

The initial manual-clock experiment exposed a synthetic start-time-zero collision;
moving the test epoch away from zero removed it. Browser mixed controls passed.
It was not promoted to a browser-confirmed Motion handoff defect.

Reusable Penner/Prism/Phrase ideas: transport-state preconditions; edit sequences
that preserve unrelated tracks; once-only terminal notifications; cancellation
followed by eventual completion where promised; disposal of owned handles; and
comparing observed output with an independent authored-time trajectory. These
are test semantics, **not** a recommendation to adopt Motion's transform groups,
native animation ownership or runtime architecture. Motion #2 owns this evidence;
robertpenner/penner#3405 owns interpretation and any adoption decision.
