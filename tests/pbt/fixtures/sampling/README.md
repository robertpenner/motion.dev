# Sampling fixture specification

These version-1 JSON fixtures are plain data, not executable easing functions.
They can be reused without Motion imports:

-   `family`: semantic category, not a production-path assertion.
-   `tracks[]`: unique numeric 2D `channel` (`x`, `y`, uniform `scale`, `rotate`,
    `skewX`), `values`, duration/delay/repeatDelay in **seconds**, optional
    normalized `times`, repeat count/type, and tagged easing.
-   Easing: `named`, `bezier` control points, `power` exponent, `wave` cycles
    and additive amplitude, or `bump` center/half-width/additive amplitude.
    The bump is a compact triangular feature added to linear progress.
-   `sampleTimes`: source-animation seconds, including independently selected
    interior times, feature centers/edges, and boundaries ±0.0000001 seconds.
-   CSS angles are degrees, translation is CSS pixels, scale is unitless.
    Geometry uses a 100×100 square with origin `(0,0)` and its four corners
    plus center. Motion's order is translation → scale → rotation → skewX
    as a CSS transform-function list; it is **not** Penner composition order.

`manifest.json` identifies paired generated original/minimized witnesses,
known controls, and independent-oracle payload checks. `path` is required
to remain the actual instrumented production branch in browser replay.
`discovery-provenance.json` describes exploratory fixture generation only;
the authoritative seeds, shrink paths/counts, raw payloads, source/emitted
values and revisions are in `reports/sampling/{current,historical}`.

Shrinking operates on integer amplitude, duration milliseconds, phase and
shape. Family construction preserves structural adversarial features.
Candidates leaving the original native/shared/adaptive branch are rejected.
Minimal means minimal under this declared fast-check shrinker, **not** a
proof of the mathematically smallest animation.

The near-zero and float-residue round trips are **historical controls** for
284b77fc6c4d595fb96dff248eadda942cd11a13, not new current findings.
The residue fixture is adapted from that fix's explicit regression, not a
new generated/minimized defect. Its screenshot checks paint, because correct
computed matrices alone cannot establish compositor painting.

## Standalone expected-failure replay

From the repository root, set `PBT_SUBJECT_ROOT` to either built/stamped
subject and run:

```sh
SAMPLING_FIXTURE=tests/pbt/fixtures/sampling/oscillation-minimized.json \
SAMPLING_EXPECT_FAILURE=1 \
yarn jest --config tests/pbt/jest.config.cjs --runInBand \
  tests/pbt/sampling.property.test.ts -t 'sampling standalone replay'
```

This intentionally exits nonzero: the desired ≤1 CSS-pixel diagnostic
accuracy bound is falsified. It is **not** a claim that Motion promises
that global bound. Omit `SAMPLING_EXPECT_FAILURE` for a passing replay
that records the measurements. Other current minimized witnesses use the
same command with their fixture path. Default ordinary suites do not run
this expected-failure assertion.

For exact fast-check discovery replay, use the finding's recorded seed/path:

```sh
SAMPLING_FAMILY=oscillation FC_SEED=20261116 FC_PATH=0:0:0:0:0 \
FC_PROPERTY='sampling accuracy characterization' \
yarn jest --config tests/pbt/jest.config.cjs --runInBand \
  tests/pbt/sampling.property.test.ts -t 'sampling discovery'
```

The discovery suite characterizes expected limitations and exits zero;
`discoveries.json` retains the failing property and shrink result.

Full bounded search: the same Jest file without `-t`; 100 cases in each
of 11 families. `PBT_DEPTH=deep` raises that quota to 1,000 each (11,000).
Both modes reject interruption and independently enforce shared/adaptive
coverage. Native and legitimate infinite-cycle fallback controls are
additional, not substitutes for the generated budget.
