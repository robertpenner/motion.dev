import {
    bezier,
    cssEase,
    emitted,
    matrix,
    pointError,
    source,
} from "./sampling-reference"
import type { Payload, Track } from "./types"

it("independent analytic reference handles easing, list composition and boundary ownership", () => {
    expect(bezier(0.5, [0.42, 0, 0.58, 1])).toBeCloseTo(0.5, 10)
    expect(cssEase(0.25, "linear(0 0%, 1 50%, 0 100%)")).toBe(0.5)
    const track: Track = {
        channel: "x",
        values: [0, 10, 20, 30],
        times: [0, 0.5, 0.5, 1],
        duration: 1,
        ease: { kind: "named", name: "linear" },
    }
    expect(source(track, 0.5 - 1e-6)).toBeLessThan(10)
    expect(source(track, 0.5)).toBe(20)
    expect(
        source(
            {
                ...track,
                values: [0, 10],
                times: undefined,
                repeat: 1,
                repeatDelay: 0.1,
                repeatType: "reverse",
            },
            1.35
        )
    ).toBeCloseTo(7.5)
    const payload: Payload = {
        id: 0,
        cancelled: false,
        options: { duration: 1000, easing: "linear" },
        keyframes: {
            transform: [
                "translateX(0px) scale(1) rotate(0deg)",
                "translateX(20px) scale(2) rotate(90deg)",
            ],
        },
    }
    const result = emitted(payload, 0.5)
    expect(result.x).toBe(10)
    expect(result.rotate).toBe(45)
    expect(matrix(result)[4]).toBe(10)
    expect(pointError(matrix(result), matrix(result))).toBe(0)
})
