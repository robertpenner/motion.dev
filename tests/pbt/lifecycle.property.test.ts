import fc from "fast-check"
import {
    command,
    initialModel,
    operationArbitrary,
    type Operation,
} from "./lifecycle-model"
import { productionAdapter } from "./production-adapter"
import { runProperty } from "./runner"

it("lifecycle production commands", async () => {
    const logs: unknown[] = []
    await runProperty(
        "lifecycle production commands",
        fc.commands([operationArbitrary], { maxCommands: 16 }),
        async (commands, coverage) => {
            const adapter = productionAdapter()
            const executed: Operation[] = []
            try {
                await adapter.start({
                    version: 1,
                    family: "lifecycle",
                    tracks: ["x", "y"].map((channel) => ({
                        channel: channel as "x" | "y",
                        values: [0, 100],
                        duration: 2,
                        ease: { kind: "named", name: "linear" },
                    })),
                    sampleTimes: [],
                })
                expect(adapter.path().path).not.toBe("fallback")
                coverage.hit("native-start")
                const real = {
                    async execute(operation: Operation) {
                        executed.push(operation)
                        const controls =
                            operation.target === "all"
                                ? adapter.controls
                                : adapter.controls.slice(0, 1)
                        controls.forEach((control) => {
                            if (operation.kind === "pause") control.pause()
                            if (operation.kind === "play") control.play()
                            if (operation.kind === "seek")
                                control.time = operation.value
                            if (operation.kind === "rate")
                                control.speed = operation.value
                        })
                        await adapter.flush()
                        coverage.hit(`${operation.target}-${operation.kind}`)
                    },
                    assert(model: ReturnType<typeof initialModel>) {
                        ;(["x", "y"] as const).forEach((key, index) => {
                            const control = adapter.controls[index]
                            expect(control.state).toBe(
                                model[key].paused ? "paused" : "running"
                            )
                            if (
                                Math.abs(control.time - model[key].time) > 0.002
                            )
                                throw new Error(
                                    JSON.stringify({
                                        key,
                                        executed,
                                        actual: control.time,
                                        expected: model[key].time,
                                    })
                                )
                            expect(control.speed).toBe(model[key].rate)
                        })
                        const active = adapter.payloads.filter(
                            (payload) => !payload.cancelled && payload.keyframes
                        )
                        expect(active.length).toBeLessThanOrEqual(1)
                    },
                }
                await fc.asyncModelRun(
                    () => ({ model: initialModel(), real }),
                    [
                        command({ kind: "pause", target: "all", value: 0 }),
                        command({ kind: "seek", target: "all", value: 0.25 }),
                        ...commands,
                    ]
                )
                logs.push({ executed, payloads: adapter.payloads })
                coverage.hit("completed-production-sequence")
            } finally {
                await adapter.dispose()
            }
            expect(document.body.children).toHaveLength(0)
            expect(adapter.payloads.every((payload) => payload.cancelled)).toBe(
                true
            )
        },
        {
            runs: 200,
            deepRuns: 2000,
            quotas: {
                "native-start": 200,
                "completed-production-sequence": 200,
                "all-pause": 1,
                "all-play": 1,
                "all-seek": 1,
                "all-rate": 1,
                "x-pause": 1,
                "x-play": 1,
                "x-seek": 1,
                "x-rate": 1,
            },
            encode: (commands) =>
                Array.from(commands, (entry) => JSON.parse(entry.toString())),
            decode: (value) => {
                if (!Array.isArray(value))
                    throw new Error("Expected operations")
                return value.map(command)
            },
            evidence: () => ({ observed: logs }),
        }
    )
})
