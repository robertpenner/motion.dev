import type { Page } from "@playwright/test"
import type { AnimationPlaybackControlsWithThen } from "../../packages/motion-dom/src/animation/types"
import { observePath } from "./paths"
import type { TransformCase, Payload } from "./types"

export async function browserAdapter(page: Page, input: TransformCase) {
    await page.goto("animate/animate-independent-transforms.html")
    await page.waitForFunction(() => Reflect.get(window, "ready") === true)
    const result = await page.evaluate(async (fixture) => {
        interface MotionAPI {
            animate(
                element: Element,
                values: Record<string, number[]>,
                options: Record<string, unknown>
            ): AnimationPlaybackControlsWithThen
        }
        const motion = Reflect.get(window, "Motion") as MotionAPI
        const element = document.createElement("div")
        element.style.cssText = "width:100px;height:100px"
        document.body.appendChild(element)
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
                        }
                    )
                )
            }
            await next()
            await next()
            const active = owned.filter(
                (animation) =>
                    animation.playState !== "idle" &&
                    animation.effect
                        ?.getKeyframes()
                        .some((k) => "transform" in k)
            )
            active.forEach((animation) => animation.pause())
            const measurements = []
            for (const seconds of fixture.sampleTimes) {
                active.forEach((animation) => {
                    animation.currentTime = seconds * 1000
                })
                await next()
                const transform = getComputedStyle(element).transform
                const matrix = new DOMMatrixReadOnly(transform)
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
            }
        } finally {
            controls.forEach((control) => control.stop())
            owned.forEach((animation) => animation.cancel())
            element.animate = original
            element.remove()
            await next()
        }
    }, input)
    return { ...result, path: observePath(result.payloads) }
}
