export interface Operation {
    kind: "pause" | "play" | "seek" | "rate"
    target: "all" | "x"
    value: number
}
export interface LifecycleModel {
    x: { time: number; paused: boolean; rate: number }
    y: { time: number; paused: boolean; rate: number }
}
export const initialModel = (): LifecycleModel => ({
    x: { time: 0, paused: false, rate: 1 },
    y: { time: 0, paused: false, rate: 1 },
})

export function apply(model: LifecycleModel, operation: Operation) {
    for (const key of operation.target === "all"
        ? (["x", "y"] as const)
        : (["x"] as const)) {
        const track = model[key]
        if (operation.kind === "pause") track.paused = true
        if (operation.kind === "play") track.paused = false
        if (operation.kind === "seek") track.time = operation.value
        if (operation.kind === "rate") track.rate = operation.value
    }
}

export function allowed(model: LifecycleModel, operation: Operation) {
    const tracks = operation.target === "all" ? [model.x, model.y] : [model.x]
    return operation.kind === "pause"
        ? tracks.some((track) => !track.paused)
        : operation.kind === "play"
        ? tracks.some((track) => track.paused)
        : operation.kind === "seek"
        ? tracks.some((track) => track.time !== operation.value)
        : tracks.some((track) => track.rate !== operation.value)
}

/** Authored linear trajectory, not Motion's sampler or built keyframes. */
export function linearValue(
    elapsed: number,
    from: number,
    to: number,
    duration: number,
    delay = 0,
    repeat = 0,
    reverse = false
) {
    const active = Math.max(0, elapsed - delay)
    const total = duration * (repeat + 1)
    const iteration = Math.min(
        Math.floor(active / duration),
        Number.isFinite(repeat) ? repeat : Infinity
    )
    let progress =
        active >= total ? 1 : (active - iteration * duration) / duration
    if (reverse && iteration % 2) progress = 1 - progress
    return from + (to - from) * progress
}
