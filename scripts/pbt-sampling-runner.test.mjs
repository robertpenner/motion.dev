import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
function run(property, overrides = {}) {
    const env = { ...process.env }
    for (const name of [
        "FC_PATH",
        "PBT_FIXTURE",
        "SAMPLING_FIXTURE",
        "SAMPLING_FAMILY",
        "SAMPLING_EXPECT_FAILURE",
        "PBT_RUN_ID",
        "PBT_DEPTH",
    ])
        delete env[name]
    const result = spawnSync("yarn", ["test:pbt"], {
        cwd: root,
        env: {
            ...env,
            FC_PROPERTY: property,
            FC_SEED: "20261016",
            ...overrides,
        },
        encoding: "utf8",
        timeout: 120000,
    })
    if (result.error) throw result.error
    return { status: result.status, output: result.stdout + result.stderr }
}

test("root selection counts the completed bounded budget", () => {
    const result = run("sampling bounded investigation")
    assert.equal(result.status, 0, result.output)
    assert.match(result.output, /"completed":1100/)
    assert.match(result.output, /"unit":"generated-cases"/)
})

test("root exact discovery seed/path uses the actual Jest title and reports families, not a generated budget", () => {
    const result = run("sampling discovery and path-preserving shrinking", {
        SAMPLING_FAMILY: "oscillation",
        FC_SEED: "20261116",
        FC_PATH: "0:0:0:0:0",
    })
    assert.equal(result.status, 0, result.output)
    assert.match(result.output, /"completed":1,"unit":"families"/)
})

test("root fixture selection records only one replay and preserves expected-failure exit", () => {
    const fixture = {
        PBT_FIXTURE: "tests/pbt/fixtures/sampling/oscillation-minimized.json",
    }
    const passing = run("sampling standalone replay", fixture)
    assert.equal(passing.status, 0, passing.output)
    assert.match(passing.output, /"completed":1,"unit":"fixtures"/)
    const failing = run("sampling standalone replay", {
        ...fixture,
        SAMPLING_EXPECT_FAILURE: "1",
    })
    assert.equal(failing.status, 1, failing.output)
    assert.match(failing.output, /Expected: <= 1/)
    assert.doesNotMatch(failing.output, /No property executed/)
})

test("root unknown selector still fails and ambiguous bounded path replay is rejected", () => {
    const unknown = run("sampling accuracy characterization")
    assert.equal(unknown.status, 1, unknown.output)
    assert.match(unknown.output, /No property executed/)
    const invalid = run("sampling bounded investigation", { FC_PATH: "0" })
    assert.equal(invalid.status, 1, invalid.output)
    assert.match(
        invalid.output,
        /Bounded multi-family runs do not accept paths\/fixtures/
    )
})
