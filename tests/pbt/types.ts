export type Channel = "x" | "y" | "scale" | "rotate" | "skewX"

export type Easing =
    | { kind: "named"; name: "linear" | "easeIn" | "easeOut" | "easeInOut" }
    | { kind: "bezier"; points: [number, number, number, number] }
    | { kind: "power"; exponent: number }
    | { kind: "wave"; cycles: number; amplitude: number }

export interface Track {
    channel: Channel
    values: number[]
    duration: number
    delay?: number
    times?: number[]
    ease: Easing
    repeat?: number | "Infinity"
    repeatDelay?: number
    repeatType?: "loop" | "reverse" | "mirror"
}

export interface TransformCase {
    version: 1
    family: string
    tracks: Track[]
    sampleTimes: number[]
}

export type Operation =
    | { kind: "pause" | "play" | "stop"; channel?: Channel }
    | { kind: "seek" | "rate"; value: number; channel?: Channel }
    | { kind: "advance"; milliseconds: number }
    | { kind: "join" | "interrupt"; track: Track }
    | { kind: "write"; channel: Channel; value: number }
    | { kind: "cancel-native" }

export interface Payload {
    keyframes: PropertyIndexedKeyframes | Keyframe[] | null
    options: KeyframeAnimationOptions
    id: number
    cancelled: boolean
}

export interface PathObservation {
    path:
        | "native-or-shared-linear"
        | "native"
        | "shared-progress"
        | "adaptive"
        | "fallback"
    evidence: string
}

export interface Revisions {
    subject: string
    harness: string
    subjectRoot: string
    dirty: boolean
    bundle?: { subject: string; sha256: string; files: number }
}

export interface Witness<T = unknown> {
    version: 1
    property: string
    family: string
    revisions: Revisions
    seed: number
    path: string
    configured: number
    completed: number
    shrinks: number
    original: T | null
    minimized: T | null
    expected: unknown
    observed: unknown
    tolerances: Record<string, number>
    paths: PathObservation[]
    measurements: unknown[]
    payloads: Payload[]
    browser?: { engine: string; version: string }
    diagnostics: string | null
}
