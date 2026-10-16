import fc from "fast-check"
import { productionAdapter } from "./production-adapter"
import { runProperty } from "./runner"
import type { TransformCase } from "./types"

export const smokeCase = (x: number): TransformCase => ({
    version: 1,
    family: "linear-control",
    tracks: [
        {
            channel: "x",
            values: [0, x],
            duration: 1,
            ease: { kind: "named", name: "linear" },
        },
    ],
    sampleTimes: [0.25, 0.5, 0.75],
})

it("payload smoke", async () => {
    let observation:
        | ReturnType<ReturnType<typeof productionAdapter>["path"]>
        | undefined
    let payloads: ReturnType<typeof productionAdapter>["payloads"] = []
    await runProperty(
        "payload smoke",
        fc.integer({ min: 20, max: 500 }),
        async (x, coverage) => {
            const real = productionAdapter()
            try {
                await real.start(smokeCase(x))
                const path = real.path()
                observation = path
                payloads = real.payloads
                coverage.hit(path.path)
                expect(path.path).toBe("native-or-shared-linear")
                const live = real.payloads.filter(
                    (payload) => !payload.cancelled && payload.keyframes
                )
                expect(live).toHaveLength(1)
                expect(JSON.stringify(live[0].keyframes)).toContain(
                    `translateX(${x}px)`
                )
            } finally {
                await real.dispose()
            }
            expect(document.body.children).toHaveLength(0)
        },
        {
            runs: 20,
            quotas: { "native-or-shared-linear": 20 },
            evidence: () => ({
                payloads,
                paths: observation ? [observation] : [],
            }),
        }
    )
})

interface Model {
    time: number
    paused: boolean
}
type Real = ReturnType<typeof productionAdapter>

function command(description: string): fc.AsyncCommand<Model, Real> {
    const match = /^seek\((\d+)\)$/.exec(description)
    if (match) {
        const ms = Number(match[1])
        if (ms > 900) throw new Error("Smoke seek must be within 0..900 ms")
        return {
            check: () => true,
            async run(model, real) {
                model.time = ms / 1000
                real.controls.forEach((control) => {
                    control.time = model.time
                })
                await real.flush()
                expect(real.controls[0].time).toBeCloseTo(model.time, 6)
            },
            toString: () => description,
        }
    }
    if (description !== "pause" && description !== "play")
        throw new Error(`Invalid command: ${description}`)
    const paused = description === "pause"
    return {
        check: (model) => model.paused !== paused,
        async run(model, real) {
            model.paused = paused
            real.controls.forEach((control) =>
                paused ? control.pause() : control.play()
            )
            await real.flush()
            expect(real.controls[0].state).toBe(paused ? "paused" : "running")
        },
        toString: () => description,
    }
}

it("command model smoke", async () => {
    const seek = fc
        .integer({ min: 0, max: 900 })
        .map((ms) => command(`seek(${ms})`))
    const pause = fc
        .boolean()
        .map((paused) => command(paused ? "pause" : "play"))
    await runProperty(
        "command model smoke",
        fc.commands([seek, pause], { maxCommands: 8 }),
        async (commands, coverage) => {
            const real = productionAdapter()
            try {
                await real.start(smokeCase(100))
                await fc.asyncModelRun(
                    () => ({ model: { time: 0, paused: false }, real }),
                    commands
                )
                coverage.hit("production-sequence")
            } finally {
                await real.dispose()
            }
        },
        {
            runs: 20,
            quotas: { "production-sequence": 20 },
            encode: (commands) =>
                Array.from(commands, (command) => command.toString()),
            decode: (fixture) => {
                if (
                    !Array.isArray(fixture) ||
                    fixture.some((command) => typeof command !== "string")
                ) {
                    throw new Error(
                        "Command fixture must be an array of command descriptions"
                    )
                }
                return fixture.map(command)
            },
        }
    )
})

const diagnostic = process.env.PBT_SELF_TEST === "1" ? it : it.skip
diagnostic("diagnostic artifact self-test", async () => {
    let observed = 0
    await runProperty(
        "diagnostic artifact self-test",
        fc.integer({ min: 1, max: 100 }),
        async (n) => {
            observed = n
            expect(n).toBe(0)
        },
        {
            runs: 10,
            evidence: () => ({
                expected: 0,
                observed,
                tolerances: { absolute: 0 },
            }),
        }
    )
})
