import { TransformAnimation } from "subject/animation/waapi/transforms/TransformAnimation"
import { productionAdapter } from "./production-adapter"
import {
    emitted,
    matrix,
    pointError,
    source,
    sourceChannels,
} from "./sampling-reference"
import type { Channel, PathObservation, Payload, TransformCase } from "./types"

export interface Metrics {
    sourceChannelError: number
    emittedChannelError: Record<Channel, number>
    screenPointError: number
    nonFinite: number
    keyframes: number
    bytes: number
    easingBytes: number
}

export async function capture(input: TransformCase) {
    const prototype = TransformAnimation.prototype
    const original = prototype.numberAt
    let probes = 0
    prototype.numberAt = function (timestamp) {
        probes++
        return original.call(this, timestamp)
    }
    const adapter = productionAdapter()
    try {
        await adapter.start(input)
        const origin = adapter.now
        const observed = adapter.path()
        const probeCount = probes
        const path: PathObservation =
            observed.path === "native-or-shared-linear"
                ? {
                      path: probeCount ? "shared-progress" : "native",
                      evidence: `Test-only numberAt prototype spy: ${probeCount} sampler calls before capture`,
                  }
                : observed
        const payload = adapter.payloads.find(
            (p) => !p.cancelled && p.keyframes
        )
        if (!payload)
            throw new Error(`Unsupported payload: ${JSON.stringify(input)}`)
        const result = evaluate(input, payload)
        let sourceChannelError = 0
        for (const seconds of input.sampleTimes) {
            input.tracks.forEach((track, i) => {
                const control = adapter.controls[i] as unknown as {
                    animation: TransformAnimation<number>
                }
                const actual = control.animation.numberAt(
                    origin + seconds * 1000
                )
                sourceChannelError = Math.max(
                    sourceChannelError,
                    Math.abs(actual - source(track, seconds))
                )
            })
        }
        result.metrics.sourceChannelError = sourceChannelError
        return {
            ...result,
            input,
            path,
            probeCount,
            payloads: JSON.parse(JSON.stringify(adapter.payloads)) as Payload[],
        }
    } finally {
        try {
            await adapter.dispose()
        } finally {
            prototype.numberAt = original
        }
    }
}

export function evaluate(input: TransformCase, payload: Payload) {
    const frames = payload.keyframes as PropertyIndexedKeyframes
    const metrics: Metrics = {
        sourceChannelError: 0,
        emittedChannelError: { x: 0, y: 0, scale: 0, rotate: 0, skewX: 0 },
        screenPointError: 0,
        nonFinite: 0,
        keyframes: (frames.transform as string[]).length,
        bytes: JSON.stringify(payload).length,
        easingBytes: (payload.options.easing || "").length,
    }
    const measurements = input.sampleTimes.map((seconds) => {
        const expected = sourceChannels(input, seconds)
        const observed = emitted(payload, seconds)
        const expectedMatrix = matrix(expected)
        const observedMatrix = matrix(observed)
        for (const channel of Object.keys(expected) as Channel[]) {
            metrics.emittedChannelError[channel] = Math.max(
                metrics.emittedChannelError[channel],
                Math.abs(expected[channel] - observed[channel])
            )
        }
        const error = pointError(expectedMatrix, observedMatrix)
        metrics.screenPointError = Math.max(metrics.screenPointError, error)
        metrics.nonFinite += [
            ...Object.values(observed),
            ...observedMatrix,
        ].filter((v) => !Number.isFinite(v)).length
        return {
            seconds,
            expected,
            observed,
            expectedMatrix,
            observedMatrix,
            screenPointError: error,
        }
    })
    return { payload, metrics, measurements }
}
