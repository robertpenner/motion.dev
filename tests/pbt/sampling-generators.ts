import fc from "fast-check"
import type { Easing, Track, TransformCase } from "./types"

export const families = [
    "independent-timing",
    "shared-looking",
    "oscillation",
    "adaptive-midpoint",
    "narrow-feature",
    "round-trip",
    "short-repeat",
    "hold",
    "duplicate-boundary",
    "large-bounded",
    "near-zero-range",
] as const
export type Family = (typeof families)[number]
export interface Parameters {
    amplitude: number
    durationMs: number
    phase: number
    shape: number
}

export const parameters = fc.record({
    amplitude: fc.integer({ min: 20, max: 1000 }),
    durationMs: fc.integer({ min: 200, max: 2000 }),
    phase: fc.integer({ min: 1, max: 8 }),
    shape: fc.integer({ min: 1, max: 4 }),
})
const linear: Easing = { kind: "named", name: "linear" }

export function fixture(family: Family, p: Parameters): TransformCase {
    let duration = p.durationMs / 1000
    const a = p.amplitude
    const track = (
        channel: Track["channel"],
        ease: Easing = linear
    ): Track => ({
        channel,
        values: channel === "scale" ? [1, 1 + a / 500] : [0, a],
        duration,
        ease,
    })
    let tracks: Track[]
    switch (family) {
        case "independent-timing":
            tracks = [
                track("x"),
                {
                    ...track("rotate"),
                    duration: duration * 0.7,
                    delay: duration * 0.13,
                },
            ]
            break
        case "shared-looking":
            tracks = [
                track("x", { kind: "power", exponent: 2 }),
                track("y", { kind: "power", exponent: 2 + p.shape / 1000 }),
            ]
            break
        case "oscillation":
            // All 10 ms shared-progress probes agree with a straight line.
            duration = Math.ceil(p.durationMs / 100) / 10
            tracks = [
                { ...track("x"), duration },
                {
                    ...track("y", {
                        kind: "wave",
                        cycles: duration * 100,
                        amplitude: p.shape / 10,
                    }),
                    duration,
                },
            ]
            break
        case "narrow-feature":
            duration = 1
            tracks = [
                { ...track("x"), duration },
                {
                    ...track("y", {
                        kind: "bump",
                        center: (p.phase * 10 + 5) / 1000,
                        width: 0.001,
                        amplitude: p.shape / 10,
                    }),
                    duration,
                },
            ]
            break
        case "adaptive-midpoint":
            duration = Math.ceil(p.durationMs / 100) / 10
            tracks = [
                { ...track("x"), duration },
                {
                    ...track("y", {
                        kind: "wave",
                        cycles: duration * 160,
                        amplitude: p.shape / 10,
                    }),
                    duration,
                },
            ]
            break
        case "round-trip":
            tracks = [
                { ...track("x"), values: [0, a, 0], times: [0, 0.5, 1] },
                track("scale"),
            ]
            break
        case "near-zero-range":
            tracks = [
                { ...track("x"), values: [0, a, 1e-8], times: [0, 0.5, 1] },
            ]
            break
        case "short-repeat":
            duration = (p.phase + 2) / 1000
            tracks = [
                {
                    ...track("x"),
                    duration,
                    repeat: p.shape + 1,
                    repeatDelay: 0.001,
                    repeatType: p.shape % 2 ? "reverse" : "loop",
                },
                { ...track("y"), duration: duration * (p.shape + 2) },
            ]
            break
        case "hold":
            tracks = [
                {
                    ...track("x"),
                    values: [0, 0, a, a],
                    times: [0, 0.3, 0.7, 1],
                },
                track("rotate", { kind: "power", exponent: p.shape + 1 }),
            ]
            break
        case "duplicate-boundary":
            tracks = [
                {
                    ...track("x"),
                    values: [0, a / 4, a, a / 2],
                    times: [0, 0.5, 0.5, 1],
                },
                track("skewX", { kind: "power", exponent: 2 }),
            ]
            tracks[1].values = [0, p.shape * 5]
            break
        case "large-bounded":
            duration = 10 + p.durationMs / 100
            tracks = [
                {
                    ...track("x", { kind: "power", exponent: 3 }),
                    duration,
                    values: [-a * 10, a * 10],
                },
                { ...track("scale", { kind: "power", exponent: 2 }), duration },
                { ...track("rotate"), duration, values: [-360, 360] },
            ]
            break
    }
    const end = Math.max(
        ...tracks.map(
            (t) =>
                (t.delay || 0) +
                t.duration *
                    ((typeof t.repeat === "number" ? t.repeat : 0) + 1) +
                (t.repeatDelay || 0) *
                    (typeof t.repeat === "number" ? t.repeat : 0)
        )
    )
    const times = [0, end, end * 0.137, end * 0.371, end * 0.619, end * 0.887]
    for (const t of tracks) {
        const offsets = t.times || [0, 1]
        for (
            let r = 0;
            r <= (typeof t.repeat === "number" ? t.repeat : 0);
            r++
        ) {
            for (const offset of offsets) {
                const b =
                    (t.delay || 0) +
                    r * (t.duration + (t.repeatDelay || 0)) +
                    offset * t.duration
                times.push(b - 1e-7, b, b + 1e-7)
            }
        }
        if (t.ease.kind === "bump") {
            times.push(
                t.duration * t.ease.center,
                t.duration * (t.ease.center - t.ease.width),
                t.duration * (t.ease.center + t.ease.width)
            )
        }
        if (t.ease.kind === "wave") {
            times.push(
                t.duration / (4 * t.ease.cycles),
                t.duration * (0.5 + 1 / (4 * t.ease.cycles))
            )
        }
    }
    return {
        version: 1,
        family,
        tracks,
        sampleTimes: [...new Set(times.filter((t) => t >= 0 && t <= end))].sort(
            (a, b) => a - b
        ),
    }
}
