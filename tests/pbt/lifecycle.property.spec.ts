import { expect, test } from "@playwright/test"
import { lifecycleBrowser } from "./lifecycle-browser"
import {
    caseArbitrary,
    categories,
    type LifecycleCase,
} from "./lifecycle-model"
import { browserRevisions } from "./revisions"
import { runProperty } from "./runner"

for (const category of categories) {
    test(`lifecycle browser ${category}`, async ({
        page,
        browserName,
        browser,
    }) => {
        const provenance = browserRevisions()
        const records: unknown[] = []
        await runProperty(
            `lifecycle browser ${category}`,
            caseArbitrary.map(
                (input): LifecycleCase => ({ ...input, category })
            ),
            async (input, coverage) => {
                const result = await lifecycleBrowser(page, input)
                const native = (snapshot: any) =>
                    snapshot.effects.filter(
                        (effect: any) =>
                            effect.state !== "idle" &&
                            effect.keyframes?.some(
                                (frame: any) => "transform" in frame
                            )
                    )
                expect(native(result.snapshots[0]).length).toBeGreaterThan(0)
                coverage.hit("native-start")
                const findings: unknown[] = []
                for (const row of result.snapshots) {
                    if (row.label === "disposed") {
                        expect(
                            row.effects.every(
                                (effect: any) => effect.state === "idle"
                            )
                        ).toBe(true)
                        coverage.hit("disposed")
                        continue
                    }
                    row.rotate = (Math.atan2(row.b, row.a) * 180) / Math.PI
                    for (const channel of ["x", "y", "rotate"]) {
                        const expected = row.expected[channel].value
                        if (
                            Math.abs(row[channel] - expected) >
                            row.expected[channel].tolerance
                        )
                            findings.push({
                                label: row.label,
                                kind: `independent-${channel}-trajectory`,
                                expected,
                                observed: row[channel],
                            })
                    }
                    const active = native(row)
                    expect(active.every((effect: any) => effect.target)).toBe(
                        true
                    )
                    const ids = active.map((effect: any) => effect.id)
                    expect(new Set(ids).size).toBe(ids.length)
                    coverage.hit(
                        active.length ? "owned-native" : "js-no-native"
                    )
                    if (active.length > 2)
                        findings.push({
                            label: row.label,
                            kind: "owned-effect-overlap",
                            ids,
                        })
                    expect(
                        Math.abs(
                            row.rect.left -
                                (20 + row.x + Math.min(0, -30 * row.b))
                        )
                    ).toBeLessThan(0.1)
                    const angle = (row.expected.rotate.value * Math.PI) / 180
                    const dx = 40 * Math.cos(angle)
                    const dy = 40 * Math.sin(angle)
                    const ex = -30 * Math.sin(angle)
                    const ey = 30 * Math.cos(angle)
                    const expectedRect = {
                        left:
                            20 +
                            row.expected.x.value +
                            Math.min(0, dx, ex, dx + ex),
                        top:
                            20 +
                            row.expected.y.value +
                            Math.min(0, dy, ey, dy + ey),
                    }
                    row.expectedRect = expectedRect
                    expect(
                        Math.abs(row.rect.left - expectedRect.left)
                    ).toBeLessThan(row.expected.x.tolerance + 4)
                    expect(
                        Math.abs(row.rect.top - expectedRect.top)
                    ).toBeLessThan(row.expected.y.tolerance + 4)
                    if (row.label === "after:seek") {
                        const before = result.snapshots.find(
                            (snapshot) => snapshot.label === "before:seek"
                        )
                        expect(
                            Math.abs(before.controls[0].time - input.seek)
                        ).toBeGreaterThan(0.002)
                        expect(row.controls[0].time).toBeCloseTo(input.seek, 3)
                        const expectedX = (input.seek / 1.5) * 100
                        if (Math.abs(row.x - expectedX) > 0.2)
                            findings.push({
                                kind: "paused-seek",
                                expected: expectedX,
                                observed: row.x,
                            })
                    }
                    if (row.label === "after:rate") {
                        const before = result.snapshots.find(
                            (snapshot) => snapshot.label === "before:rate"
                        )
                        expect(before.controls[0].speed).not.toBe(input.rate)
                        expect(row.controls[0].speed).toBe(input.rate)
                    }
                }
                if (category.includes("pause")) {
                    const paused = result.snapshots.find(
                        (row) => row.label === "after:pause"
                    )!
                    const held = result.snapshots.find(
                        (row) => row.label === "held"
                    )!
                    expect(paused.controls[0].state).toBe("paused")
                    expect(held.controls[0].time).toBeCloseTo(
                        paused.controls[0].time,
                        3
                    )
                    expect(Math.abs(held.x - paused.x)).toBeLessThan(0.2)
                }
                if (category.startsWith("sync") && !category.includes("seek")) {
                    const first = native(result.snapshots[0]).map(
                        (effect: any) => effect.id
                    )
                    const last = native(
                        result.snapshots.find((row) => row.label === "last")
                    ).map((effect: any) => effect.id)
                    expect(last).toEqual(first)
                    coverage.hit("retained-effect-identity")
                }
                if (
                    [
                        "interruption",
                        "join-leave",
                        "finite-repeat",
                        "infinite-repeat",
                    ].includes(category)
                ) {
                    const first = native(result.snapshots[0]).map(
                        (effect: any) => effect.id
                    )
                    const last = native(
                        result.snapshots.find((row) => row.label === "last")
                    ).map((effect: any) => effect.id)
                    expect(last).not.toEqual(first)
                    expect(
                        result.snapshots
                            .find((row) => row.label === "last")
                            .effects.filter((effect: any) =>
                                first.includes(effect.id)
                            )
                            .every((effect: any) => effect.state === "idle")
                    ).toBe(true)
                    coverage.hit("replaced-owned-effect")
                }
                if (category === "callback-return") {
                    expect(
                        result.events.some((event) => event.name === "update")
                    ).toBe(true)
                    expect(
                        result.events.filter(
                            (event) => event.name === "callback"
                        )
                    ).toHaveLength(1)
                    expect(
                        native(
                            result.snapshots.find(
                                (row) => row.label === "after:callback-join"
                            )
                        ).length
                    ).toBe(0)
                    expect(
                        native(
                            result.snapshots.find(
                                (row) => row.label === "callback-ended"
                            )
                        ).length
                    ).toBeGreaterThan(0)
                    coverage.hit("js-return")
                }
                if (
                    [
                        "outside-write",
                        "native-cancel",
                        "negative-rate",
                        "incompatible-loops",
                    ].includes(category)
                ) {
                    expect(
                        result.snapshots.some(
                            (row) =>
                                row.label !== "disposed" &&
                                native(row).length === 0
                        )
                    ).toBe(true)
                    coverage.hit("sticky-js")
                }
                if (category === "finite-repeat") {
                    expect(
                        result.events.filter((event) => event.name === "y-loop")
                    ).toHaveLength(1)
                    expect(
                        result.events.some((event) => event.name === "y")
                    ).toBe(false)
                    coverage.hit("completion-once-interrupted-never")
                }
                if (category === "native-cancel") {
                    expect(
                        result.events.filter((event) => event.name === "x")
                    ).toHaveLength(1)
                    expect(
                        result.events.filter((event) => event.name === "y")
                    ).toHaveLength(1)
                    coverage.hit("cancel-completion-once")
                }
                if (
                    ["infinite-repeat", "incompatible-loops"].includes(category)
                ) {
                    expect(
                        result.events.filter((event) =>
                            event.name.includes("loop")
                        )
                    ).toHaveLength(0)
                    coverage.hit("infinite-never-completes")
                }
                if (category === "projection") {
                    expect(
                        native(
                            result.snapshots.find(
                                (row) =>
                                    row.label === "after:projection-will-update"
                            )
                        )
                    ).toHaveLength(0)
                    coverage.hit("projection-js")
                }
                if (category === "completion-order") {
                    expect(result.events.map((event) => event.name)).toEqual([
                        "short-x",
                        "short-y",
                    ])
                    coverage.hit("ordered-completion")
                }
                records.push({ ...result, findings })
                expect(findings).toEqual([])
                coverage.hit(category)
            },
            {
                runs: 2,
                deepRuns: 20,
                quotas: { [category]: 2, "native-start": 2, disposed: 2 },
                decode: (value) => {
                    const input = value as Parameters<
                        typeof lifecycleBrowser
                    >[1]
                    if (
                        !input ||
                        input.category !== category ||
                        !Number.isFinite(input.seek) ||
                        input.seek < 0.15 ||
                        input.seek > 0.65 ||
                        ![0.5, 1, 2].includes(input.rate) ||
                        (category.endsWith("rate") &&
                            !category.startsWith("negative") &&
                            input.rate === 1) ||
                        !Number.isInteger(input.wait) ||
                        input.wait < 70 ||
                        input.wait > 100
                    )
                        throw new Error("Unsupported lifecycle browser fixture")
                    return input
                },
                evidence: () => ({
                    revisions: provenance,
                    browser: {
                        engine: browserName,
                        version: browser.version(),
                    },
                    observed: records,
                    tolerances: {
                        runningTimingMs: 25,
                        runningBaseUnits: 0.2,
                        pausedPx: 0.2,
                        geometryPx: 0.1,
                        controlSeconds: 0.002,
                    },
                }),
            }
        )
    })
}
