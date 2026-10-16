import type { Page } from "@playwright/test"
import type { LifecycleCase } from "./lifecycle-model"

export async function lifecycleBrowser(page: Page, input: LifecycleCase) {
    await page.goto("animate/animate-independent-transforms.html")
    await page.waitForFunction(() => Reflect.get(window, "ready") === true)
    return page.evaluate(async (fixture) => {
        const motion = (window as any).Motion
        const clock = () => (window as any).MotionDOM.time.now() as number
        interface Reference {
            from: number
            to: number
            duration: number
            anchor: number
            elapsed: number
            rate: number
            paused: boolean
            delay: number
            repeat: number
            reverse: boolean
        }
        const reference: Record<string, Reference> = {}
        const elapsed = (track: Reference, now: number) =>
            track.elapsed +
            (track.paused ? 0 : ((now - track.anchor) / 1000) * track.rate)
        const valueAt = (track: Reference, now: number) => {
            const active = Math.max(0, elapsed(track, now) - track.delay)
            const iteration = Math.min(
                Math.floor(active / track.duration),
                track.repeat
            )
            let progress = Math.min(
                1,
                (active - iteration * track.duration) / track.duration
            )
            if (track.reverse && iteration % 2) progress = 1 - progress
            return track.from + (track.to - track.from) * progress
        }
        const author = (
            key: string,
            from: number,
            to: number,
            duration = 1.5,
            delay = 0,
            repeat = 0,
            reverse = true
        ) => {
            reference[key] = {
                from,
                to,
                duration,
                delay,
                repeat,
                reverse,
                anchor: clock(),
                elapsed: 0,
                rate: 1,
                paused: false,
            }
        }
        const element = document.createElement("div")
        element.style.cssText =
            "position:absolute;left:20px;top:20px;width:40px;height:30px;transform-origin:0 0"
        document.body.appendChild(element)
        const owned: Animation[] = []
        const events: { name: string; timeline: number | null }[] = []
        const controls: any[] = []
        const original = element.animate
        element.animate = function (frames, options) {
            const animation = original.call(this, frames, options)
            owned.push(animation)
            return animation
        }
        const next = () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() => resolve())
            )
        const settle = async () => {
            await next()
            await next()
        }
        const wait = async (ms: number) => {
            await new Promise((resolve) => setTimeout(resolve, ms))
            await settle()
        }
        const add = (
            name: string,
            values: Record<string, unknown>,
            options: Record<string, unknown> = {}
        ) => {
            const control = motion.animate(element, values, {
                duration: 1.5,
                ease: "linear",
                ...options,
                onComplete: () =>
                    events.push({
                        name,
                        timeline: document.timeline.currentTime as number,
                    }),
            })
            controls.push(control)
            return control
        }
        const snapshots: any[] = []
        const operations: string[] = []
        const snapshot = (label: string) => {
            const now = clock()
            const nativeActive = owned.some(
                (animation) =>
                    animation.playState !== "idle" &&
                    animation.effect
                        ?.getKeyframes()
                        .some((frame) => "transform" in frame)
            )
            const sampleTime = nativeActive
                ? Number(document.timeline.currentTime)
                : (window as any).MotionDOM.frameData.timestamp
            const matrix = new DOMMatrixReadOnly(
                getComputedStyle(element).transform
            )
            const rect = element.getBoundingClientRect()
            const effects = owned.map((animation, id) => ({
                id,
                state: animation.playState,
                time: animation.currentTime,
                rate: animation.playbackRate,
                start: animation.startTime,
                keyframes: animation.effect?.getKeyframes(),
                timing: animation.effect?.getComputedTiming(),
                target:
                    (animation.effect as KeyframeEffect)?.target === element,
            }))
            snapshots.push({
                label,
                timeline: document.timeline.currentTime,
                motionTime: now,
                frameTime: (window as any).MotionDOM.frameData.timestamp,
                sampleTime,
                expected: Object.fromEntries(
                    Object.entries(reference).map(([key, track]) => [
                        key,
                        {
                            value: valueAt(track, sampleTime),
                            time: elapsed(track, sampleTime),
                            tolerance:
                                0.2 +
                                (Math.abs(track.to - track.from) /
                                    track.duration) *
                                    0.025,
                            paused: track.paused,
                            rate: track.rate,
                        },
                    ])
                ),
                x: matrix.e,
                y: matrix.f,
                a: matrix.a,
                b: matrix.b,
                rect: {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                },
                controls: controls.map((control) => ({
                    time: control.time,
                    state: control.state,
                    speed: control.speed,
                })),
                effects,
            })
        }
        const transition = async (name: string, action: () => void) => {
            operations.push(name)
            snapshot(`before:${name}`)
            const now = clock()
            const keys =
                fixture.category.startsWith("sync") ||
                ["prepare-mixed", "rate-all", "play-all"].includes(name) ||
                (name === "pause" && fixture.category.includes("seek"))
                    ? ["x", "y"]
                    : ["x"]
            for (const key of keys) {
                const track = reference[key]
                track.elapsed = elapsed(track, now)
                track.anchor = now
                if (["pause", "prepare-mixed"].includes(name))
                    track.paused = true
                if (name === "prepare-mixed") track.elapsed = 0.25
                if (["play", "play-x", "play-all"].includes(name))
                    track.paused = false
                if (name === "seek") track.elapsed = fixture.seek
                if (name === "rate") track.rate = fixture.rate
                if (name === "rate-all") track.rate = 0.25
                if (name === "negative-speed") track.rate = -1
                if (name === "positive-speed") track.rate = 1
            }
            if (name === "interrupt-x")
                author("x", valueAt(reference.x, now), 200, 0.4)
            if (name === "join") author("rotate", 0, 15)
            if (name === "callback-join") author("rotate", 0, 15, 0.12)
            if (name === "incompatible-loop")
                author("rotate", 0, 15, 0.19, 0, Infinity, false)
            if (name === "leave") {
                reference.rotate.elapsed = elapsed(reference.rotate, now)
                reference.rotate.anchor = now
                reference.rotate.paused = true
            }
            if (name.startsWith("outside-write"))
                author(
                    "rotate",
                    name.endsWith("one") ? 10 : 20,
                    name.endsWith("one") ? 10 : 20
                )
            if (
                [
                    "finite-repeat-delay",
                    "infinite-repeat",
                    "first-loop",
                ].includes(name)
            )
                author(
                    "y",
                    0,
                    60,
                    0.12,
                    name === "finite-repeat-delay" ? 0.03 : 0,
                    name === "finite-repeat-delay" ? 1 : Infinity,
                    name !== "first-loop"
                )
            action()
            await settle()
            snapshot(`after:${name}`)
        }
        let release = () => {}
        let projection: any
        try {
            author("rotate", 0, 0)
            author("x", 0, 100)
            const x = add("x", { x: [0, 100] })
            author("y", 0, 60)
            const y = add("y", { y: [0, 60] })
            await settle()
            snapshot("native-start")
            await wait(fixture.wait)
            snapshot("running")
            const both = [x, y]
            const target = fixture.category.startsWith("sync") ? both : [x]
            switch (fixture.category) {
                case "projection":
                    projection = new (
                        window as any
                    ).MotionDOM.HTMLProjectionNode({})
                    projection.mount(element)
                    projection.setOptions({ layout: true })
                    await transition("projection-will-update", () => {
                        projection.willUpdate()
                    })
                    break
                case "completion-order":
                    await transition("short-tracks", () => {
                        author("x", 0, 100, 0.12)
                        author("y", 0, 60, 0.2)
                        add("short-x", { x: [0, 100] }, { duration: 0.12 })
                        add("short-y", { y: [0, 60] }, { duration: 0.2 })
                    })
                    await wait(320)
                    snapshot("completed")
                    break
                case "mixed-control-replay":
                    await transition("prepare-mixed", () => {
                        both.forEach((control) => control.pause())
                        both.forEach((control) => {
                            control.time = 0.25
                        })
                    })
                    await transition("play-x", () => x.play())
                    await transition("rate-all", () => {
                        both.forEach((control) => {
                            control.speed = 0.25
                        })
                    })
                    await transition("play-all", () => {
                        both.forEach((control) => control.play())
                    })
                    break
                case "sync-pause":
                case "independent-pause":
                    await transition("pause", () =>
                        target.forEach((control) => control.pause())
                    )
                    await wait(fixture.wait)
                    snapshot("held")
                    await transition("play", () =>
                        target.forEach((control) => control.play())
                    )
                    break
                case "sync-seek":
                case "independent-seek":
                    await transition("pause", () =>
                        both.forEach((control) => control.pause())
                    )
                    await transition("seek", () =>
                        target.forEach((control) => {
                            control.time = fixture.seek
                        })
                    )
                    break
                case "sync-rate":
                case "independent-rate":
                    await transition("rate", () =>
                        target.forEach((control) => {
                            control.speed = fixture.rate
                        })
                    )
                    await wait(fixture.wait)
                    snapshot("retimed")
                    break
                case "interruption":
                    await transition("interrupt-x", () =>
                        add("x-replacement", { x: 200 }, { duration: 0.4 })
                    )
                    await wait(fixture.wait)
                    snapshot("replacement-running")
                    break
                case "join-leave": {
                    let rotate: any
                    await transition("join", () => {
                        rotate = add("rotate", { rotate: [0, 15] })
                    })
                    await transition("leave", () => rotate.stop())
                    break
                }
                case "finite-repeat":
                    await transition("finite-repeat-delay", () =>
                        add(
                            "y-loop",
                            { y: [0, 60] },
                            {
                                duration: 0.12,
                                delay: 0.03,
                                repeat: 1,
                                repeatType: "reverse",
                            }
                        )
                    )
                    await wait(360)
                    snapshot("finite-finished")
                    break
                case "infinite-repeat":
                    await transition("infinite-repeat", () =>
                        add(
                            "y-loop",
                            { y: [0, 60] },
                            {
                                duration: 0.12,
                                repeat: Infinity,
                                repeatType: "reverse",
                            }
                        )
                    )
                    await wait(300)
                    snapshot("loop-running")
                    break
                case "outside-write": {
                    const value = motion.motionValue(0)
                    release = motion.styleEffect(element, { rotate: value })
                    await transition("outside-write-one", () => value.set(10))
                    await transition("outside-write-two", () => value.set(20))
                    break
                }
                case "native-cancel":
                    await transition("external-native-cancel", () =>
                        owned.forEach((animation) => animation.cancel())
                    )
                    await wait(fixture.wait)
                    snapshot("cancel-survival")
                    break
                case "callback-return":
                    await transition("callback-join", () =>
                        add(
                            "callback",
                            { rotate: [0, 15] },
                            {
                                duration: 0.12,
                                onUpdate: () =>
                                    events.push({
                                        name: "update",
                                        timeline: document.timeline
                                            .currentTime as number,
                                    }),
                            }
                        )
                    )
                    await wait(260)
                    snapshot("callback-ended")
                    break
                case "negative-rate":
                    await transition("negative-speed", () => {
                        x.speed = -1
                    })
                    await transition("positive-speed", () => {
                        x.speed = 1
                    })
                    break
                case "incompatible-loops":
                    await transition("first-loop", () =>
                        add(
                            "loop-y",
                            { y: [0, 60] },
                            { duration: 0.12, repeat: Infinity }
                        )
                    )
                    await transition("incompatible-loop", () =>
                        add(
                            "loop-rotate",
                            { rotate: [0, 15] },
                            { duration: 0.19, repeat: Infinity }
                        )
                    )
                    break
            }
            await wait(fixture.wait)
            snapshot("last")
            return {
                input: fixture,
                operations,
                snapshots,
                events,
                userAgent: navigator.userAgent,
            }
        } finally {
            controls.forEach((control) => control.stop())
            owned.forEach((animation) => animation.cancel())
            release()
            projection?.unmount()
            await settle()
            snapshot("disposed")
            element.animate = original
            element.remove()
            if (owned.some((animation) => animation.playState !== "idle"))
                throw new Error("Owned animation survived disposal")
        }
    }, input)
}
