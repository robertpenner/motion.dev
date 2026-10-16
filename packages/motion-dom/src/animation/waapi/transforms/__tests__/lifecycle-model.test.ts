import {
    allowed,
    apply,
    initialModel,
    linearValue,
} from "./lifecycle-reference"

it("models authored delay and finite reverse repeats independently", () => {
    expect(linearValue(0.1, 0, 100, 1, 0.2, 1, true)).toBe(0)
    expect(linearValue(0.7, 0, 100, 1, 0.2, 1, true)).toBeCloseTo(50)
    expect(linearValue(1.7, 0, 100, 1, 0.2, 1, true)).toBeCloseTo(50)
    expect(linearValue(3, 0, 100, 1, 0.2, 1, true)).toBe(0)
    expect(linearValue(4.25, 0, 100, 1, 0, Infinity, true)).toBe(25)
})

it("requires a real pause/play transition and keeps unrelated tracks independent", () => {
    const model = initialModel()
    const pause = { kind: "pause", target: "x", value: 0 } as const
    expect(allowed(model, pause)).toBe(true)
    apply(model, pause)
    expect(allowed(model, pause)).toBe(false)
    expect(model.y.paused).toBe(false)
    apply(model, { kind: "seek", target: "x", value: 0.5 })
    expect(model.x.time).toBe(0.5)
    expect(model.y.time).toBe(0)
})
