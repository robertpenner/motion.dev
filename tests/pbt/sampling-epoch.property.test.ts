import * as adapterModule from "./production-adapter"
import { capture } from "./sampling-capture"
import { recordExecutionReceipt } from "./execution-receipt"
import type { TransformCase } from "./types"
import { TransformAnimation } from "subject/animation/waapi/transforms/TransformAnimation"

it("sampling source oracle follows the adapter epoch", async () => {
    const input: TransformCase = {
        version: 1,
        family: "epoch-control",
        tracks: [
            {
                channel: "x",
                values: [0, 100],
                duration: 1,
                ease: { kind: "named", name: "linear" },
            },
        ],
        sampleTimes: [0.137, 0.5, 0.887],
    }
    const baseline = await capture(input)
    const factory = adapterModule.productionAdapter
    const spy = jest
        .spyOn(adapterModule, "productionAdapter")
        .mockImplementation(() => {
            const adapter = factory()
            return {
                ...adapter,
                get now() {
                    return adapter.now
                },
                async start(fixture) {
                    await adapter.flush(100000 - adapter.now)
                    await adapter.start(fixture)
                },
            }
        })

    const shifted = await (async () => {
        try {
            return await capture(input)
        } finally {
            spy.mockRestore()
        }
    })()
    expect(baseline.metrics.sourceChannelError).toBeLessThan(0.000001)
    expect(shifted.metrics.sourceChannelError).toBeLessThan(0.000001)
    expect(shifted.metrics).toEqual(baseline.metrics)
    recordExecutionReceipt({
        property: "sampling source oracle follows the adapter epoch",
        mode: "reference",
        completed: 1,
        unit: "checks",
    })
})

it("sampling restores its source probe when disposal fails", async () => {
    const input: TransformCase = {
        version: 1,
        family: "cleanup-control",
        tracks: [
            {
                channel: "x",
                values: [0, 100],
                duration: 1,
                ease: { kind: "named", name: "linear" },
            },
        ],
        sampleTimes: [0.5],
    }
    const original = TransformAnimation.prototype.numberAt
    const failure = new Error("injected adapter disposal failure")
    const factory = adapterModule.productionAdapter
    const spy = jest
        .spyOn(adapterModule, "productionAdapter")
        .mockImplementation(() => {
            const adapter = factory()
            return {
                ...adapter,
                async dispose() {
                    await adapter.dispose()
                    throw failure
                },
            }
        })
    try {
        await expect(capture(input)).rejects.toBe(failure)
        expect(TransformAnimation.prototype.numberAt).toBe(original)
    } finally {
        spy.mockRestore()
        TransformAnimation.prototype.numberAt = original
    }
    const subsequent = await capture(input)
    expect(subsequent.metrics.sourceChannelError).toBeLessThan(0.000001)
    expect(document.body.children).toHaveLength(0)
    recordExecutionReceipt({
        property: "sampling restores its source probe when disposal fails",
        mode: "reference",
        completed: 1,
        unit: "checks",
    })
})
