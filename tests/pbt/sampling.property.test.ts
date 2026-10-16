import fc from "fast-check"
import { mkdirSync, readFileSync, writeFileSync } from "fs"
import { resolve } from "path"
import { capture } from "./sampling-capture"
import { configuration } from "./config"
import {
    families,
    fixture,
    parameters,
    type Family,
    type Parameters,
} from "./sampling-generators"
import { revisions } from "./revisions"
import type { TransformCase } from "./types"
import { productionAdapter } from "./production-adapter"

const directory = resolve(
    __dirname,
    "../../test_results/pbt-sampling",
    process.env.SAMPLING_SUBJECT || ""
)
const saved = (name: string, value: unknown) => {
    mkdirSync(directory, { recursive: true })
    writeFileSync(
        resolve(directory, name),
        JSON.stringify(value, null, 2) + "\n"
    )
}

it("sampling bounded investigation", async () => {
    const config = configuration()
    const quota = config.deep ? 1000 : 100
    const counts: Record<string, number> = {}
    const paths: Record<string, number> = {}
    const rows: unknown[] = []
    const worst: Record<string, Awaited<ReturnType<typeof capture>>> = {}
    for (const [index, family] of families.entries()) {
        const seed = config.seed + index
        counts[family] = 0
        const details = await fc.check(
            fc.asyncProperty(parameters, async (p) => {
                const observed = await capture(fixture(family, p))
                expect(observed.metrics.nonFinite).toBe(0)
                expect(observed.metrics.sourceChannelError).toBeLessThan(
                    0.000001
                )
                expect(observed.path.path).not.toBe("native-or-shared-linear")
                expect(observed.metrics.bytes).toBeLessThan(500000)
                paths[observed.path.path] = (paths[observed.path.path] || 0) + 1
                counts[family]++
                rows.push({
                    family,
                    seed,
                    parameters: p,
                    path: observed.path.path,
                    metrics: observed.metrics,
                })
                if (
                    !worst[family] ||
                    worst[family].metrics.screenPointError <
                        observed.metrics.screenPointError
                )
                    worst[family] = observed
            }),
            {
                seed,
                numRuns: quota,
                interruptAfterTimeLimit: config.deep ? 600000 : 90000,
                markInterruptAsFailure: true,
            }
        )
        saved("progress.json", {
            revisions: revisions(),
            counts,
            paths,
            interrupted: details.interrupted,
        })
        if (details.failed) console.error(fc.defaultReportMessage(details))
        expect(details.failed).toBe(false)
        expect(details.interrupted).toBe(false)
        expect(details.numRuns).toBe(quota)
        expect(counts[family]).toBe(quota)
    }
    expect(paths["shared-progress"]).toBeGreaterThanOrEqual(quota)
    expect(paths.adaptive).toBeGreaterThanOrEqual(quota)
    const controls = { native: 0, fallback: 0 }
    for (let i = 0; i < 10; i++) {
        const input: TransformCase = {
            version: 1,
            family: "native-control",
            tracks: [
                {
                    channel: "x",
                    values: [0, 20 + i],
                    duration: 1,
                    ease: {
                        kind: "named",
                        name: i % 2 ? "easeInOut" : "linear",
                    },
                },
            ],
            sampleTimes: [0.137, 0.5, 0.887],
        }
        const native = await capture(input)
        expect(native.path.path).toBe("native")
        expect(native.probeCount).toBe(0)
        expect(native.metrics.screenPointError).toBeLessThan(0.01)
        controls.native++
        const adapter = productionAdapter()
        try {
            await adapter.start({
                ...input,
                family: "incompatible-infinite-control",
                tracks: [
                    { ...input.tracks[0], repeat: "Infinity" },
                    {
                        ...input.tracks[0],
                        channel: "y",
                        duration: 1.3,
                        repeat: "Infinity",
                    },
                ],
            })
            expect(adapter.path().path).toBe("fallback")
            const track = (
                adapter.controls[0] as unknown as {
                    animation: {
                        isAccelerated(): boolean
                        group: { isJS: boolean }
                    }
                }
            ).animation
            expect(track.isAccelerated()).toBe(false)
            expect(track.group.isJS).toBe(true)
            controls.fallback++
        } finally {
            await adapter.dispose()
        }
    }
    saved("bounded.json", {
        revisions: revisions(),
        configured: quota * families.length,
        completed: rows.length,
        counts,
        paths,
        controls,
        unsupported: 0,
        skips: 0,
        rows,
        worst,
    })
    console.log(JSON.stringify({ completed: rows.length, counts, paths }))
})

it("sampling discovery and path-preserving shrinking", async () => {
    const config = configuration()
    const findings = []
    const selected: Family[] = [
        "oscillation",
        "adaptive-midpoint",
        "narrow-feature",
        "near-zero-range",
        "duplicate-boundary",
        "large-bounded",
        "short-repeat",
        "shared-looking",
    ]
    if (
        process.env.SAMPLING_FAMILY &&
        !selected.includes(process.env.SAMPLING_FAMILY as Family)
    )
        throw new Error(
            `Unknown discovery family: ${process.env.SAMPLING_FAMILY}`
        )
    for (const [index, family] of selected.entries()) {
        if (
            process.env.SAMPLING_FAMILY &&
            process.env.SAMPLING_FAMILY !== family
        )
            continue
        let original: Awaited<ReturnType<typeof capture>> | undefined
        let requiredPath: string | undefined
        const seed = process.env.SAMPLING_FAMILY
            ? config.seed
            : config.seed + 100 + index
        const details = await fc.check(
            fc.asyncProperty(parameters, async (p: Parameters) => {
                const observed = await capture(fixture(family, p))
                const fails = observed.metrics.screenPointError > 1
                if (fails && !original) {
                    original = observed
                    requiredPath = observed.path.path
                }
                // Shrinks that leave the triggering production branch cannot replace the witness.
                return (
                    !fails ||
                    (!!requiredPath && observed.path.path !== requiredPath)
                )
            }),
            {
                seed,
                path: config.path,
                numRuns: 100,
                interruptAfterTimeLimit: 90000,
                markInterruptAsFailure: true,
                verbose: 2,
            }
        )
        expect(details.interrupted).toBe(false)
        const minimized = details.counterexample
            ? await capture(fixture(family, details.counterexample[0]))
            : null
        findings.push({
            version: 1,
            property: "sampling accuracy characterization",
            family,
            revisions: revisions(),
            seed,
            path: details.counterexamplePath,
            shrinks: details.numShrinks,
            completed: details.numRuns,
            original: original?.input || null,
            minimized: minimized?.input || null,
            originalObservation: original,
            minimizedObservation: minimized,
            expectedFailure: !!details.failed,
            classification:
                family === "near-zero-range"
                    ? "already-fixed behavior control"
                    : "accuracy limitation without a promised global bound",
            tolerance: { screenPointPx: 1 },
        })
    }
    saved("discoveries.json", findings)
})

const replay = process.env.SAMPLING_FIXTURE ? it : it.skip
replay("sampling standalone replay", async () => {
    const input: TransformCase = JSON.parse(
        readFileSync(process.env.SAMPLING_FIXTURE!, "utf8")
    )
    const observed = await capture(input)
    saved("replay.json", { revisions: revisions(), observed })
    if (process.env.SAMPLING_EXPECT_FAILURE === "1")
        expect(observed.metrics.screenPointError).toBeLessThanOrEqual(1)
    else expect(observed.metrics.nonFinite).toBe(0)
})
