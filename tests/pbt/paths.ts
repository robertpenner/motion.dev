import type { PathObservation, Payload } from "./types"

export function observePath(payloads: Payload[]): PathObservation {
    const active = payloads.filter((p) => !p.cancelled && p.keyframes)
    if (!active.length)
        return {
            path: "fallback",
            evidence:
                "No live transform payload; inspect fallback reason separately",
        }
    const payload = active[active.length - 1]
    const frames = payload.keyframes
    if (frames && !Array.isArray(frames) && frames.offset) {
        return {
            path: "adaptive",
            evidence: "Production emits explicit adaptive offsets",
        }
    }
    const easing = payload.options.easing || "linear"
    if (easing.startsWith("linear("))
        return {
            path: "shared-progress",
            evidence: "Two endpoints with sampled linear() easing",
        }
    if (easing !== "linear")
        return {
            path: "native",
            evidence: `Production native tween CSS easing: ${easing}`,
        }
    return {
        path: "native-or-shared-linear",
        evidence:
            "Ambiguous two-endpoint linear payload; not proof of the native tween branch",
    }
}
