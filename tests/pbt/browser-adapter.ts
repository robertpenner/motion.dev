import type { Page } from "@playwright/test"
import type { AnimationPlaybackControlsWithThen } from "../../packages/motion-dom/src/animation/types"
import { observePath } from "./paths"
import type { TransformCase, Payload } from "./types"

export async function browserAdapter(
    page: Page,
    input: TransformCase,
    sampling = false
) {
    await page.goto("animate/animate-independent-transforms.html")
    await page.waitForFunction(() => Reflect.get(window, "ready") === true)
    const result = await page.evaluate(
        async ({ fixture, sampling }) => {
            interface MotionAPI {
                animate(
                    element: Element,
                    values: Record<string, number[]>,
                    options: Record<string, unknown>
                ): AnimationPlaybackControlsWithThen
            }
            const motion = Reflect.get(window, "Motion") as MotionAPI
            const element = document.createElement("div")
            element.style.cssText =
                "width:100px;height:100px;background:#0077ff"
            element.style.transformOrigin = "0 0"
            if (sampling) element.setAttribute("data-pbt-sampling", "1")
            document.body.appendChild(element)
            interface Run {
                from: number
                to: number
                path: "native" | "shared-progress" | "adaptive"
                starts: number[]
            }
            const runs = Reflect.get(window, "__pbtSamplingRuns") as
                | Run[]
                | undefined
            const clock = Reflect.get(window, "MotionDOM") as {
                time: { now(): number; set(timestamp: number): void }
                frameData: {
                    timestamp: number
                    delta: number
                    isProcessing: boolean
                }
                frameSteps: Record<string, { process(data: unknown): void }>
            }
            const savedFrame = sampling ? { ...clock.frameData } : undefined
            // Avoid real native finish events before the manual capture is paused.
            const commonStart = sampling
                ? Math.max(
                      clock.time.now(),
                      Number(document.timeline.currentTime)
                  ) + 10000
                : undefined
            const flush = () => {
                clock.time.set(commonStart!)
                Object.assign(clock.frameData, {
                    timestamp: commonStart,
                    delta: 0,
                    isProcessing: true,
                })
                Object.values(clock.frameSteps).forEach((step) =>
                    step.process(clock.frameData)
                )
                clock.frameData.isProcessing = false
            }
            if (sampling) {
                clock.time.set(commonStart!)
                Object.assign(clock.frameData, {
                    timestamp: commonStart,
                    delta: 0,
                    isProcessing: true,
                })
            }
            const original = element.animate
            const payloads: Payload[] = []
            const owned: Animation[] = []
            const controls: AnimationPlaybackControlsWithThen[] = []
            element.animate = function (frames, options) {
                const animation = original.call(this, frames, options)
                owned.push(animation)
                payloads.push({
                    id: owned.length - 1,
                    keyframes: frames,
                    options:
                        typeof options === "number"
                            ? { duration: options }
                            : options || {},
                    cancelled: false,
                })
                return animation
            }
            const next = () =>
                new Promise<void>((resolve) =>
                    requestAnimationFrame(() => resolve())
                )
            try {
                for (const track of fixture.tracks) {
                    const ease = track.ease
                    const authored =
                        ease.kind === "named"
                            ? ease.name
                            : ease.kind === "bezier"
                            ? ease.points
                            : ease.kind === "power"
                            ? (p: number) => Math.pow(p, ease.exponent)
                            : ease.kind === "bump"
                            ? (p: number) =>
                                  p +
                                  ease.amplitude *
                                      Math.max(
                                          0,
                                          1 -
                                              Math.abs(p - ease.center) /
                                                  ease.width
                                      )
                            : (p: number) =>
                                  p +
                                  ease.amplitude *
                                      Math.sin(2 * Math.PI * ease.cycles * p)
                    controls.push(
                        motion.animate(
                            element,
                            { [track.channel]: track.values },
                            {
                                duration: track.duration,
                                ease: authored,
                                times: track.times,
                                delay: track.delay,
                                repeat:
                                    track.repeat === "Infinity"
                                        ? Infinity
                                        : track.repeat,
                                repeatDelay: track.repeatDelay,
                                repeatType: track.repeatType,
                                ...(sampling ? { startTime: commonStart } : {}),
                            }
                        )
                    )
                }
                if (sampling) {
                    flush()
                    await Promise.resolve()
                    flush()
                } else {
                    await next()
                    await next()
                }
                const active = owned.filter(
                    (animation) =>
                        animation.playState !== "idle" &&
                        animation.effect
                            ?.getKeyframes()
                            .some((k) => "transform" in k)
                )
                active.forEach((animation) => animation.pause())
                if (savedFrame) Object.assign(clock.frameData, savedFrame)
                if (sampling)
                    await Promise.all(
                        active.map((animation) => animation.ready)
                    )
                const measurements = []
                const run = runs?.[runs.length - 1]
                for (const seconds of fixture.sampleTimes) {
                    active.forEach((animation) => {
                        animation.currentTime =
                            seconds * 1000 +
                            (sampling && run ? commonStart! - run.from : 0)
                    })
                    await next()
                    const transform = getComputedStyle(element).transform
                    const matrix = new DOMMatrixReadOnly(transform)
                    const rect = element.getBoundingClientRect()
                    let pixel: number[] | undefined
                    if (
                        sampling &&
                        fixture.family === "roundtrip-residue-control" &&
                        seconds === 0.3
                    ) {
                        const screenshot = Reflect.get(
                            window,
                            "__pbtSamplingScreenshot"
                        ) as () => Promise<string>
                        const image = new Image()
                        image.src =
                            "data:image/png;base64," + (await screenshot())
                        await image.decode()
                        const canvas = document.createElement("canvas")
                        canvas.width = image.width
                        canvas.height = image.height
                        const context = canvas.getContext("2d")!
                        context.drawImage(image, 0, 0)
                        pixel = Array.from(
                            context.getImageData(
                                Math.floor(
                                    ((rect.left + rect.width / 2) *
                                        image.width) /
                                        window.innerWidth
                                ),
                                Math.floor(
                                    ((rect.top + rect.height / 2) *
                                        image.height) /
                                        window.innerHeight
                                ),
                                1,
                                1
                            ).data
                        )
                    }
                    measurements.push({
                        seconds,
                        transform,
                        matrix: [
                            matrix.a,
                            matrix.b,
                            matrix.c,
                            matrix.d,
                            matrix.e,
                            matrix.f,
                        ],
                        boundingRect: {
                            left: rect.left - element.offsetLeft,
                            top: rect.top - element.offsetTop,
                            width: rect.width,
                            height: rect.height,
                        },
                        pixel,
                        ...(sampling
                            ? {
                                  nativeStates: active.map((animation) => ({
                                      currentTime: animation.currentTime,
                                      playState: animation.playState,
                                      pending: animation.pending,
                                      progress:
                                          animation.effect?.getComputedTiming()
                                              .progress,
                                  })),
                              }
                            : {}),
                    })
                }
                payloads.forEach((payload, i) => {
                    payload.cancelled = owned[i].playState === "idle"
                })
                return {
                    payloads,
                    measurements,
                    effects: active.map((animation) => ({
                        keyframes: animation.effect!.getKeyframes(),
                        timing: animation.effect!.getComputedTiming(),
                        currentTime: animation.currentTime,
                    })),
                    userAgent: navigator.userAgent,
                    instrumentation: sampling
                        ? { runs, commonStart }
                        : undefined,
                }
            } finally {
                controls.forEach((control) => control.stop())
                owned.forEach((animation) => animation.cancel())
                element.animate = original
                element.remove()
                if (savedFrame) Object.assign(clock.frameData, savedFrame)
                await next()
            }
        },
        { fixture: input, sampling }
    )
    return { ...result, path: observePath(result.payloads) }
}
