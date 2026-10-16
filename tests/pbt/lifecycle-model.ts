import fc from "fast-check"
import {
    allowed,
    apply,
    type LifecycleModel,
    type Operation,
} from "../../packages/motion-dom/src/animation/waapi/transforms/__tests__/lifecycle-reference"
export {
    initialModel,
    type LifecycleModel,
    type Operation,
} from "../../packages/motion-dom/src/animation/waapi/transforms/__tests__/lifecycle-reference"

export const categories = [
    "sync-pause",
    "independent-pause",
    "sync-seek",
    "independent-seek",
    "sync-rate",
    "independent-rate",
    "interruption",
    "join-leave",
    "finite-repeat",
    "infinite-repeat",
    "outside-write",
    "native-cancel",
    "callback-return",
    "negative-rate",
    "incompatible-loops",
    "mixed-control-replay",
    "projection",
    "completion-order",
] as const

export type Category = (typeof categories)[number]

export interface ControlledReal {
    execute(operation: Operation): Promise<void>
    assert(model: LifecycleModel): void
}
export function command(
    operation: Operation
): fc.AsyncCommand<LifecycleModel, ControlledReal> {
    if (
        !operation ||
        !["pause", "play", "seek", "rate"].includes(operation.kind) ||
        !["all", "x"].includes(operation.target) ||
        !Number.isFinite(operation.value) ||
        (operation.kind === "seek" &&
            (operation.value < 0 || operation.value > 0.9)) ||
        (operation.kind === "rate" &&
            (operation.value < 0.25 || operation.value > 2))
    )
        throw new Error("Unsupported lifecycle operation")
    return {
        check: (model) => allowed(model, operation),
        async run(model, real) {
            apply(model, operation)
            await real.execute(operation)
            real.assert(model)
        },
        toString: () => JSON.stringify(operation),
    }
}

export const operationArbitrary = fc
    .record({
        kind: fc.constantFrom<Operation["kind"]>(
            "pause",
            "play",
            "seek",
            "rate"
        ),
        target: fc.constantFrom<Operation["target"]>("all", "x"),
        value: fc.integer({ min: 1, max: 8 }),
    })
    .map((operation) =>
        command({
            ...operation,
            value:
                operation.kind === "rate"
                    ? operation.value / 4
                    : operation.value / 10,
        })
    )

export interface LifecycleCase {
    category: Category
    seek: number
    rate: 0.5 | 1 | 2
    wait: number
}
export const caseArbitrary = fc.record({
    category: fc.constantFrom(...categories),
    seek: fc.integer({ min: 15, max: 65 }).map((n) => n / 100),
    rate: fc.constantFrom(0.5, 1, 2),
    wait: fc.integer({ min: 70, max: 100 }),
})
