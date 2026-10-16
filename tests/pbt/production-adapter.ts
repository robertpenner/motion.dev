import { animateElement } from "subject/animation/animate/element"
import { MotionGlobalConfig } from "motion-utils"
import type { AnimationPlaybackControlsWithThen } from "subject/animation/types"
import { frameSteps } from "subject/frameloop/frame"
import { frameData } from "subject/frameloop/frame-data"
import { time } from "subject/frameloop/sync-time"
import { supportsFlags } from "subject/utils/supports/flags"
import { authoredEasing } from "./easing"
import { observePath } from "./paths"
import type { Payload, Track, TransformCase } from "./types"

interface CapturedAnimation {
    currentTime: number | null
    startTime: number | null
    playbackRate: number
    onfinish: (() => void) | null
    oncancel: (() => void) | null
    playState: string
    pause(): void
    play(): void
    cancel(): void
    finish(): void
    effect: {
        getKeyframes(): Payload["keyframes"]
        getTiming(): KeyframeAnimationOptions
    }
}

export function productionAdapter() {
    const element = document.createElement("div")
    document.body.appendChild(element)
    const payloads: Payload[] = []
    const native: CapturedAnimation[] = []
    const controls: AnimationPlaybackControlsWithThen[] = []
    const descriptor = Object.getOwnPropertyDescriptor(
        Element.prototype,
        "animate"
    )
    const flags = { ...supportsFlags }
    const savedFrame = { ...frameData }
    const manualTiming = MotionGlobalConfig.useManualTiming
    const steps = Object.values(frameSteps)
    let now = 1000
    let disposed = false
    supportsFlags.waapi = true
    supportsFlags.linearEasing = true
    MotionGlobalConfig.useManualTiming = true
    time.set(now)
    frameData.timestamp = now

    Object.defineProperty(Element.prototype, "animate", {
        configurable: true,
        value(
            keyframes: Payload["keyframes"],
            options: KeyframeAnimationOptions
        ) {
            const payload: Payload = {
                keyframes: keyframes
                    ? JSON.parse(JSON.stringify(keyframes))
                    : null,
                options: { ...options },
                id: payloads.length,
                cancelled: false,
            }
            payloads.push(payload)
            const animation: CapturedAnimation = {
                currentTime: 0,
                startTime: null,
                playbackRate: 1,
                onfinish: null,
                oncancel: null,
                playState: "running",
                pause() {
                    this.playState = "paused"
                },
                play() {
                    this.playState = "running"
                },
                cancel() {
                    payload.cancelled = true
                    this.playState = "idle"
                },
                finish() {
                    this.playState = "finished"
                    if (typeof this.onfinish === "function") this.onfinish()
                },
                effect: {
                    getKeyframes: () => keyframes,
                    getTiming: () => options,
                },
            }
            native.push(animation)
            return animation
        },
    })

    const flush = async (milliseconds = 0) => {
        now += milliseconds
        time.set(now)
        frameData.timestamp = now
        frameData.delta = milliseconds
        frameData.isProcessing = true
        try {
            for (const step of steps) step.process(frameData)
        } finally {
            frameData.isProcessing = false
        }
        await Promise.resolve()
        time.set(now)
    }
    const add = (track: Track) => {
        const result = animateElement(
            element,
            { [track.channel]: track.values },
            {
                duration: track.duration,
                delay: track.delay,
                times: track.times,
                ease: authoredEasing(track.ease),
                repeat: track.repeat === "Infinity" ? Infinity : track.repeat,
                repeatDelay: track.repeatDelay,
                repeatType: track.repeatType,
            }
        )
        controls.push(...result)
        return result
    }
    return {
        element,
        payloads,
        native,
        controls,
        add,
        flush,
        get now() {
            return now
        },
        path: () => observePath(payloads),
        async start(input: TransformCase) {
            input.tracks.forEach(add)
            await flush()
            await flush()
        },
        async dispose() {
            if (disposed) return
            disposed = true
            try {
                controls.forEach((control) => control.stop())
                native.forEach((animation) => animation.cancel())
                await flush()
                await flush()
            } finally {
                element.remove()
                if (descriptor)
                    Object.defineProperty(
                        Element.prototype,
                        "animate",
                        descriptor
                    )
                else Reflect.deleteProperty(Element.prototype, "animate")
                Object.keys(supportsFlags).forEach(
                    (key) => delete supportsFlags[key]
                )
                Object.assign(supportsFlags, flags)
                Object.assign(frameData, savedFrame)
                MotionGlobalConfig.useManualTiming = manualTiming
                time.set(savedFrame.timestamp)
            }
        },
    }
}
