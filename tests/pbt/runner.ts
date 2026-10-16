import fc from "fast-check"
import { mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { randomUUID } from "crypto"
import { configuration, Coverage } from "./config"
import { revisions, root } from "./revisions"
import type { Witness } from "./types"

export async function runProperty<T>(
    name: string,
    arbitrary: fc.Arbitrary<T>,
    check: (input: T, coverage: Coverage) => Promise<void>,
    options: {
        runs: number
        deepRuns?: number
        quotas?: Record<string, number>
        evidence?: () => Partial<Witness<T>>
        encode?: (input: T) => unknown
        decode?: (fixture: unknown) => T
    }
) {
    const config = configuration()
    if (process.env.FC_PROPERTY && process.env.FC_PROPERTY !== name) {
        throw new Error(
            `Selected ${process.env.FC_PROPERTY}, but executed ${name}`
        )
    }
    const coverage = new Coverage()
    let original: T | null = null
    let completed = 0
    const configured = config.deep
        ? options.deepRuns || options.runs * 10
        : options.runs
    const replay = process.env.PBT_FIXTURE
    if (replay) {
        const fixture = JSON.parse(readFileSync(replay, "utf8"))
        const isWitness =
            fixture !== null &&
            typeof fixture === "object" &&
            "minimized" in fixture
        if (
            isWitness &&
            (fixture.version !== 1 ||
                fixture.property !== name ||
                fixture.minimized === null)
        ) {
            throw new Error(
                "Witness must have version 1, a minimized input, and match the selected property"
            )
        }
        const saved = isWitness ? fixture.minimized : fixture
        const input = options.decode ? options.decode(saved) : saved
        await check(input, coverage)
        if (process.env.PBT_RUN_ID) {
            const directory = join(root, "test_results/pbt")
            mkdirSync(directory, { recursive: true })
            writeFileSync(
                join(
                    directory,
                    `${process.env.PBT_RUN_ID}-${randomUUID()}.json`
                ),
                JSON.stringify({
                    property: name,
                    fixture: replay,
                    completed: 1,
                })
            )
        }
        console.log(
            JSON.stringify({
                property: name,
                fixture: replay,
                completed: 1,
                coverage: coverage.counts,
            })
        )
        return
    }
    const details = await fc.check(
        fc.asyncProperty(arbitrary, async (input) => {
            try {
                await check(input, coverage)
                completed++
            } catch (error) {
                if (original === null) original = input
                throw error
            }
        }),
        {
            seed: config.seed,
            path: config.path,
            numRuns: configured,
            interruptAfterTimeLimit: config.deep ? 600000 : 90000,
            markInterruptAsFailure: true,
            verbose: 2,
        }
    )
    const diagnostics = fc.defaultReportMessage(details) ?? null
    const successfulRuns = details.failed
        ? Math.max(0, details.numRuns - 1)
        : details.numRuns
    const report: Witness<T> = {
        version: 1,
        property: name,
        family: name,
        revisions: revisions(),
        seed: details.seed,
        path: details.counterexamplePath || "",
        configured,
        completed: successfulRuns,
        shrinks: details.numShrinks,
        original,
        minimized: details.counterexample?.[0] ?? null,
        expected: null,
        observed: null,
        tolerances: {},
        paths: [],
        measurements: [],
        payloads: [],
        diagnostics,
        ...options.evidence?.(),
    }
    const directory = join(root, "test_results/pbt")
    mkdirSync(directory, { recursive: true })
    const artifact = join(
        directory,
        `${
            process.env.PBT_RUN_ID || name.replace(/[^a-z0-9_-]/gi, "-")
        }-${randomUUID()}.json`
    )
    const encode = options.encode || ((input: T) => input)
    writeFileSync(
        artifact,
        JSON.stringify(
            {
                ...report,
                original: original === null ? null : encode(original),
                minimized:
                    report.minimized === null ? null : encode(report.minimized),
                coverage: coverage.counts,
                coverageIncludesShrinkAttempts: details.failed,
                successfulEvaluationsIncludingShrinks: completed,
                interrupted: details.interrupted,
                cause:
                    details.errorInstance instanceof Error
                        ? details.errorInstance.stack
                        : null,
            },
            null,
            2
        ) + "\n"
    )
    console.log(
        JSON.stringify({
            property: name,
            configured,
            completed: successfulRuns,
            interrupted: details.interrupted,
            seed: details.seed,
            coverage: coverage.counts,
            artifact,
        })
    )
    if (details.failed || details.interrupted) {
        console.error(diagnostics)
        throw new Error(diagnostics || "Property interrupted", {
            cause: details.errorInstance,
        })
    }
    if (details.numRuns !== configured)
        throw new Error(`Incomplete run: ${details.numRuns}/${configured}`)
    coverage.require(options.quotas || {})
}
