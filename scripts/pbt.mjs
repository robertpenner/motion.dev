import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { existsSync, readdirSync } from "node:fs"

const [tier = "fast", ...args] = process.argv.slice(2)
if (!["fast", "browser", "deep"].includes(tier)) {
    throw new Error(`Unknown PBT tier: ${tier}`)
}
const browser = tier === "browser"
const selected = process.env.FC_PROPERTY
if (
    (process.env.FC_PATH !== undefined || process.env.PBT_FIXTURE) &&
    !selected
) {
    throw new Error(
        "FC_PATH and PBT_FIXTURE require an exact FC_PROPERTY selection"
    )
}
const escaped = selected?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const command = browser
    ? ["playwright", "test", "--config", "tests/pbt/playwright.config.ts"]
    : ["jest", "--config", "tests/pbt/jest.config.cjs", "--runInBand"]
if (escaped)
    command.push(
        browser ? "--grep" : "--testNamePattern",
        browser ? `(?:^| )${escaped}$` : `^${escaped}$`
    )
const runId = randomUUID()
const result = spawnSync("yarn", [...command, ...args], {
    stdio: "inherit",
    env: {
        ...process.env,
        PBT_RUN_ID: runId,
        ...(tier === "deep" && { PBT_DEPTH: "deep" }),
    },
})
if (result.error) throw result.error
if (
    result.status === 0 &&
    (!existsSync("test_results/pbt") ||
        !readdirSync("test_results/pbt").some((name) => name.startsWith(runId)))
) {
    throw new Error(
        "No property executed; check FC_PROPERTY and test selectors"
    )
}
process.exit(result.status ?? 1)
