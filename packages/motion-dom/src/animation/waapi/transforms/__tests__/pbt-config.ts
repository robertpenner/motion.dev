export function configuration(env: NodeJS.ProcessEnv = process.env) {
    const raw = env.FC_SEED
    const seed = raw === undefined ? 20261016 : Number(raw)
    if (
        (raw !== undefined && !/^[+-]?\d+$/.test(raw)) ||
        !Number.isSafeInteger(seed) ||
        seed < -0x80000000 ||
        seed > 0x7fffffff
    ) {
        throw new Error(`FC_SEED must be a signed 32-bit integer: ${raw}`)
    }
    const path = env.FC_PATH
    if (
        path !== undefined &&
        (!/^\d+(?::\d+)*$/.test(path) || !env.FC_PROPERTY)
    ) {
        throw new Error(
            "FC_PATH must be a numeric shrink path and requires FC_PROPERTY"
        )
    }
    if (env.PBT_DEPTH && !["bounded", "deep"].includes(env.PBT_DEPTH)) {
        throw new Error(`Invalid PBT_DEPTH: ${env.PBT_DEPTH}`)
    }
    return {
        seed,
        ...(path !== undefined && { path }),
        deep: env.PBT_DEPTH === "deep",
    }
}

export class Coverage {
    counts: Record<string, number> = {}

    hit(category: string) {
        this.counts[category] = (this.counts[category] || 0) + 1
    }

    require(quotas: Record<string, number>) {
        for (const [category, minimum] of Object.entries(quotas)) {
            if ((this.counts[category] || 0) < minimum) {
                throw new Error(
                    `Coverage ${category}: ${
                        this.counts[category] || 0
                    } < ${minimum}`
                )
            }
        }
    }
}
