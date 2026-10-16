# Bounded transform investigations

Test-only fast-check 4 infrastructure for Motion #1. Production behavior and
exports are unchanged. This setup is not the sampling (#3) or lifecycle (#2)
investigation: those have separate coverage and completion budgets.

Sampling investigation #3 now lives in `sampling*.ts`; its bounded domain,
fixture schema, expected-failure replay and deeper search are documented in
[`fixtures/sampling/README.md`](fixtures/sampling/README.md). Reviewed comparison
evidence is in [`reports/sampling`](../../reports/sampling). The PBT-only browser
server defaults to port 8023 (`PBT_PORT` overrides it); ordinary suites are
unchanged. `SAMPLING_SUBJECT=current|historical` separates final raw outputs in
ignored `test_results/pbt-sampling` before evidence promotion.

## Commands

Use Yarn 3 from the repository root:

```sh
yarn test:pbt                    # Jest: 20 payload + 20 command/model cases
yarn test:pbt:deep               # opt-in: 200 of each smoke property
yarn test:pbt:build              # root yarn build, then exact bundle provenance
yarn test:pbt:browser            # Smoke + sampling witnesses, both engines
PBT_DEPTH=deep yarn test:pbt:browser  # Smoke grows to 50 cases per engine
```

The commands bypass Turbo entirely. Seed, depth, replay, and fixtures are never
served from a test cache. Retries are disabled in the exploratory browser config.
The default seed is `20261016`; it is printed, not silently randomized on retry.
No Bun/Vitest or production fast-check dependency is introduced.

`*.property.test.ts` files live under this directory and are explicitly excluded
by motion-dom's ordinary Jest config. `*.property.spec.ts` files are excluded
by the ordinary Playwright config. Normal locked configuration/coverage tests live
in `packages/motion-dom/src/animation/waapi/transforms/__tests__/pbt-infrastructure.test.ts`.
Keep supported regression pins in ordinary `*.test.ts`/`*.spec.ts` discovery;
deliver unapproved current-defect assertions as explicit replay fixtures or
standalone patches, never a failing default suite.

## Seed/path and fixture replay

`FC_SEED` is a signed 32-bit integer. Empty/malformed/out-of-range seeds fail
explicitly. `FC_PATH` is fast-check's numeric colon-separated shrink path.
Paths and direct fixtures require an exact `FC_PROPERTY` (the full test title).
Unknown property selections fail rather than reporting a successful empty run.

```sh
FC_SEED=123 FC_PROPERTY='payload smoke' yarn test:pbt
FC_PROPERTY='payload smoke' PBT_FIXTURE=tests/pbt/fixtures/payload-smoke.json yarn test:pbt
FC_PROPERTY='command model smoke' PBT_FIXTURE=tests/pbt/fixtures/command-smoke.json yarn test:pbt
FC_PROPERTY='browser smoke' yarn test:pbt:browser
```

The command fixture is a serializable operation list, decoded into commands with
real preconditions, separate model state, and production controls. The command
bound is eight. Fixture replay runs exactly one case and does **not** claim the
random budget or aggregate coverage quotas were met. Generator changes cannot
invalidate direct fixture replay. New generators must supply `encode`/`decode`
when the generated object is not itself JSON (notably `fc.commands`).

The opt-in diagnostic intentionally fails; it is skipped unless explicitly enabled:

```sh
PBT_SELF_TEST=1 FC_PROPERTY='diagnostic artifact self-test' FC_SEED=20261016 yarn test:pbt
# expected exit 1; original 47 -> minimized 1; path "0:0"; one shrink
PBT_SELF_TEST=1 FC_PROPERTY='diagnostic artifact self-test' FC_SEED=20261016 FC_PATH=0:0 yarn test:pbt
# expected exit 1; minimized 1 again, zero additional shrinks
PBT_SELF_TEST=1 FC_PROPERTY='diagnostic artifact self-test' \
  PBT_FIXTURE=<artifact-path-from-first-run> yarn test:pbt
# expected exit 1 on the saved minimized value, independent of generation
```

fast-check's report, shrink summary, execution tree and original assertion cause
are retained. A successful bounded run prints `configured:20,completed:20`.
Failed attempts are not counted as completed successes; shrink evaluations and
coverage including shrink attempts are labelled separately. Interruption is an
error, never success with a claimed full budget. The host bound is 90 seconds per
property (600 seconds deep); runners must allow sufficient outer timeout for any
new expensive property. Browser smoke has a 180-second outer timeout. Coverage
quotas explicitly fail when required categories are absent. Investigations must
define their own per-family, transition, path, fallback and unsupported counters.

## Adapters, paths, and isolation

`production-adapter.ts` invokes the actual `animateElement` production entry point.
It uses Motion's manual clock (`MotionGlobalConfig.useManualTiming`, frame data,
`time.set`) and frame steps, not a copy of the sampler. Its WAAPI mock captures
payloads and control state; it does not simulate browser interpolation or running
finish-event timing. Use browser evidence for those assertions. `flush(ms)` advances
controlled Motion time. A real-time rAF may wake the batcher, but manual timing
prevents wall-clock movement.

Always dispose an adapter in `finally`. Disposal stops production controls,
cancels owned native payloads, flushes pending work, removes the element, and
restores support flags, frame data, clock mode and the original API descriptor.
The browser adapter creates/reset-loads a scenario for every case, wraps only its
element's `animate`, captures real effects and matrices at paused WAAPI times,
then stops controls, cancels effects, restores the API and removes the element
even after assertion failures. Keep paused-time interpolation checks separate
from genuinely running event/lifecycle checks.

Path evidence distinguishes explicit adaptive offsets, sampled shared `linear()`,
native CSS easing, fallback, and the deliberately ambiguous two-endpoint `linear`
case. Do not turn that ambiguity into an exact branch claim. Research needing an
exact branch must add scoped test-only observation. Neither animation counts,
unchanged inline styles, rAF samples, nor computed matrix serialization proves
compositor execution or matrix interpolation.

## Revisions and artifacts

`PBT_SUBJECT_ROOT` selects a separate subject checkout for the source adapter and
browser server. Jest maps `subject/*` and `motion-utils` to that subject; harness
types are checked against the baseline. Record revision-specific adapters
explicitly. Harness and subject full SHAs and dirty state are distinct fields.
Do not claim an uncommitted harness is an exact recorded harness revision.

Build each subject from its root, then run `scripts/pbt-build.mjs` there. It refuses
modified tracked production sources and records the subject SHA and SHA-256 of
all built files (including file names) in motion-utils, motion-dom and framer-motion.
`browserRevisions()` checks both the current subject SHA and bundle digest before
testing. A commit requires a fresh stamp even when production did not change.
For a historical subject lacking the script, invoke the same harness script using
its absolute path with the historical subject as cwd. Never substitute fork names
or harness SHAs for the actual built subject revision.

Ignored durable output locations (separate from ordinary Playwright's wiped
`test-results`):

-   `test_results/pbt-build.json`: built-subject provenance.
-   `test_results/pbt/*.json`: run/witness reports, one unique name per run.
-   `test_results/pbt-browser/`: Playwright attachments and failure traces.
-   `playwright-report/pbt/`: local HTML report.

The version-1 witness interface in `types.ts` contains property/family, subject and
harness revisions, seed/path, configured/completed counts, shrink count, original
and minimized input, expected/observed values, numeric tolerances, path evidence,
raw measurements, captured keyframes/offsets/easing/options, and engine/version
where applicable. A cause stack and fast-check diagnostics are also persisted.
Smoke reports may leave inapplicable numerical fields empty; research witnesses
must fill every relevant field. Attach browser evidence through `testInfo.attach`
including on failure. Promote only reviewed confirmed fixtures, not arbitrary
exploration output, into version control.

## Setup validation

The discovery regression failed before runner isolation was implemented (expected
ignored property, observed included property). Root `yarn build` passed. Targeted
normal Jest tests passed (38 assertions); bounded and deep host smoke, direct
payload/command fixture replays, and both engine smoke checks passed. Diagnostic
seed/path replay minimized to `1` reproducibly. Existing independent-transform
and handoff browser specs passed in both engines (52 tests).

Pinned browsers here are Chromium 138.0.7204.23 and WebKit 18.5. The first
Playwright installer stalled extracting under Node 24; downloaded pinned archives
were extracted using system `unzip`, without skipping either engine.

No global accuracy guarantee, complete lifecycle model, or claim of defect absence
is established by these smoke tests. Follow the independent research issue specs.

Conventions adapted from Penner revision
`d218820906c8a82c5e5cc50fbeba1977772d6d27`: its PBT/locking guides, seed setup,
and async command/model example. Motion owns execution; Penner owns interpretation
and Prism/Phrase adoption decisions.
