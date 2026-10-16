import type { Channel, Easing, Payload, Track, TransformCase } from "./types"

export type Channels = Record<Channel, number>
export const defaults = (): Channels => ({
    x: 0,
    y: 0,
    scale: 1,
    rotate: 0,
    skewX: 0,
})
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const mix = (a: number, b: number, p: number) => a + (b - a) * p

// Independent bisection, not Motion's cubic-bezier solver.
export function bezier(p: number, points: number[]) {
    const [x1, y1, x2, y2] = points
    const curve = (t: number, a: number, b: number) =>
        3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3
    if (p <= 0 || p >= 1) return p
    let low = 0
    let high = 1
    for (let i = 0; i < 50; i++) {
        const t = (low + high) / 2
        if (curve(t, x1, x2) < p) low = t
        else high = t
    }
    return curve((low + high) / 2, y1, y2)
}

export function referenceEase(p: number, ease: Easing): number {
    switch (ease.kind) {
        case "power":
            return p ** ease.exponent
        case "wave":
            return p + ease.amplitude * Math.sin(2 * Math.PI * ease.cycles * p)
        case "bump":
            return (
                p +
                ease.amplitude *
                    Math.max(0, 1 - Math.abs(p - ease.center) / ease.width)
            )
        case "bezier":
            return bezier(p, ease.points)
        case "named":
            return ease.name === "linear"
                ? p
                : bezier(
                      p,
                      ease.name === "easeIn"
                          ? [0.42, 0, 1, 1]
                          : ease.name === "easeOut"
                          ? [0, 0, 0.58, 1]
                          : [0.42, 0, 0.58, 1]
                  )
    }
}

export function source(track: Track, seconds: number) {
    const duration = track.duration
    const repeats = typeof track.repeat === "number" ? track.repeat : 0
    const gap = track.repeatDelay || 0
    const local = seconds - (track.delay || 0)
    if (local < 0) return track.values[0]
    const total = duration * (repeats + 1) + gap * repeats
    const reversed =
        track.repeatType === "reverse" || track.repeatType === "mirror"
    if (local >= total)
        return reversed && repeats % 2
            ? track.values[0]
            : track.values[track.values.length - 1]
    const cycle = duration + gap
    let iteration = Math.floor(local / cycle)
    let time = local - iteration * cycle
    // At a repeat boundary the preceding iteration still owns the instant.
    if (time === 0 && iteration > 0) {
        iteration--
        time = cycle
    }
    let p = clamp(time / duration)
    let values = track.values
    let offsets = track.times || values.map((_, i) => i / (values.length - 1))
    if (iteration % 2 && track.repeatType === "reverse")
        p = clamp(1 - time / duration)
    if (iteration % 2 && track.repeatType === "mirror") {
        values = [...values].reverse()
        offsets = [...offsets].reverse().map((t) => 1 - t)
    }
    let i = 0
    while (i < offsets.length - 2 && p >= offsets[i + 1]) i++
    const width = offsets[i + 1] - offsets[i]
    return mix(
        values[i],
        values[i + 1],
        referenceEase(
            width === 0 ? 1 : clamp((p - offsets[i]) / width),
            track.ease
        )
    )
}

export function sourceChannels(input: TransformCase, seconds: number) {
    const result = defaults()
    input.tracks.forEach((track) => {
        result[track.channel] = source(track, seconds)
    })
    return result
}

export function parseTransform(transform: string): Channels {
    const result = defaults()
    const aliases: Record<string, Channel> = {
        translateX: "x",
        translateY: "y",
        scale: "scale",
        rotate: "rotate",
        skewX: "skewX",
    }
    if (transform === "none") return result
    const terms = [...transform.matchAll(/([a-zA-Z]+)\(([^)]+)\)/g)]
    if (!terms.length) throw new Error(`Unsupported transform: ${transform}`)
    for (const [, name, value] of terms) {
        if (!(name in aliases) || !Number.isFinite(parseFloat(value)))
            throw new Error(`Unsupported/non-finite transform: ${transform}`)
        result[aliases[name]] = parseFloat(value)
    }
    return result
}

export function cssEase(p: number, easing = "linear") {
    if (easing === "linear") return p
    if (easing === "ease-in") return bezier(p, [0.42, 0, 1, 1])
    if (easing === "ease-out") return bezier(p, [0, 0, 0.58, 1])
    if (easing === "ease-in-out") return bezier(p, [0.42, 0, 0.58, 1])
    if (easing.startsWith("cubic-bezier("))
        return bezier(p, easing.slice(13, -1).split(",").map(Number))
    if (!easing.startsWith("linear("))
        throw new Error(`Unsupported CSS easing: ${easing}`)
    const points = easing
        .slice(7, -1)
        .split(",")
        .map((point) => {
            const [value, percent] = point.trim().split(/\s+/).map(parseFloat)
            if (!Number.isFinite(value) || !Number.isFinite(percent))
                throw new Error(
                    `Expected explicit linear() positions: ${point}`
                )
            return [percent / 100, value]
        })
    let i = 0
    while (i < points.length - 2 && p >= points[i + 1][0]) i++
    const [a, va] = points[i]
    const [b, vb] = points[i + 1]
    return b === a ? vb : mix(va, vb, (p - a) / (b - a))
}

export function emitted(payload: Payload, seconds: number): Channels {
    if (!payload.keyframes || Array.isArray(payload.keyframes))
        throw new Error("Expected indexed production transform payload")
    const frames = payload.keyframes.transform as string[]
    const offsets =
        (payload.keyframes.offset as number[] | undefined) ||
        frames.map((_, i) => i / (frames.length - 1))
    const duration = Number(payload.options.duration) / 1000
    const p = cssEase(clamp(seconds / duration), payload.options.easing)
    let i = 0
    while (i < offsets.length - 2 && p >= offsets[i + 1]) i++
    const width = offsets[i + 1] - offsets[i]
    const t = width === 0 ? 1 : (p - offsets[i]) / width
    const from = parseTransform(frames[i])
    const to = parseTransform(frames[i + 1])
    const result = defaults()
    for (const key of Object.keys(result) as Channel[]) {
        result[key] = mix(from[key], to[key], t)
    }
    return result
}

// Motion order: translation, uniform scale, rotation, skewX (CSS list order).
export function matrix(channels: Channels) {
    const { x, y, scale: s, rotate, skewX } = channels
    const angle = (rotate * Math.PI) / 180
    const skew = Math.tan((skewX * Math.PI) / 180)
    const c = Math.cos(angle)
    const n = Math.sin(angle)
    return [s * c, s * n, s * (c * skew - n), s * (n * skew + c), x, y]
}

export const geometry = [
    [0, 0],
    [100, 0],
    [0, 100],
    [100, 100],
    [50, 50],
]
export function pointError(a: number[], b: number[]) {
    return Math.max(
        ...geometry.map(([x, y]) =>
            Math.hypot(
                (a[0] - b[0]) * x + (a[2] - b[2]) * y + a[4] - b[4],
                (a[1] - b[1]) * x + (a[3] - b[3]) * y + a[5] - b[5]
            )
        )
    )
}
