import type { Easing } from "./types"

export function authoredEasing(easing: Easing) {
    switch (easing.kind) {
        case "named":
            return easing.name
        case "bezier":
            return easing.points
        case "power":
            return (p: number) => Math.pow(p, easing.exponent)
        case "wave":
            return (p: number) =>
                p + easing.amplitude * Math.sin(2 * Math.PI * easing.cycles * p)
        case "bump":
            return (p: number) =>
                p +
                easing.amplitude *
                    Math.max(0, 1 - Math.abs(p - easing.center) / easing.width)
    }
}
