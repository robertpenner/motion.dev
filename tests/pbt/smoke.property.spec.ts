import { expect, test } from "@playwright/test"
import fc from "fast-check"
import { browserAdapter } from "./browser-adapter"
import { browserRevisions } from "./revisions"
import { runProperty } from "./runner"
import type { TransformCase } from "./types"

test("browser smoke", async ({ page, browser, browserName }, testInfo) => {
    const revisions = browserRevisions()
    let observed: Awaited<ReturnType<typeof browserAdapter>> | undefined
    try {
        await runProperty(
            "browser smoke",
            fc.integer({ min: 20, max: 300 }),
            async (x, coverage) => {
                const input: TransformCase = {
                    version: 1,
                    family: "linear-control",
                    tracks: [
                        {
                            channel: "x",
                            values: [0, x],
                            duration: 1,
                            ease: { kind: "named", name: "linear" },
                        },
                    ],
                    sampleTimes: [0.5],
                }
                observed = await browserAdapter(page, input)
                coverage.hit(observed.path.path)
                expect(observed.effects).toHaveLength(1)
                expect(observed.measurements[0].matrix[4]).toBeCloseTo(x / 2, 1)
            },
            {
                runs: 5,
                quotas: { "native-or-shared-linear": 5 },
                evidence: () => ({
                    revisions,
                    browser: {
                        engine: browserName,
                        version: browser.version(),
                    },
                    payloads: observed?.payloads || [],
                    measurements: observed?.measurements || [],
                    paths: observed ? [observed.path] : [],
                    tolerances: { xPx: 0.05 },
                }),
            }
        )
    } finally {
        await testInfo.attach("browser-observations", {
            body: JSON.stringify({ revisions, observed }),
            contentType: "application/json",
        })
    }
})
