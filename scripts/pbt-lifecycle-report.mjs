import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { gzipSync } from "node:zlib"
import { createHash } from "node:crypto"

const directory = "tests/pbt/evidence/lifecycle"
const args = process.argv.slice(2)
if (args[0] === "replay") {
    const corpus = JSON.parse(readFileSync(`${directory}/corpus.json`, "utf8"))
    const item = corpus.find(
        (entry) =>
            entry.input.category === args[1] &&
            entry.index === Number(args[2] || 0)
    )
    if (!item) throw new Error("Unknown category/case index")
    mkdirSync("test_results", { recursive: true })
    writeFileSync(
        "test_results/lifecycle-replay.json",
        JSON.stringify(item.input, null, 2) + "\n"
    )
    console.log(
        `FC_PROPERTY='lifecycle browser ${args[1]}' PBT_FIXTURE=test_results/lifecycle-replay.json PBT_SUBJECT_ROOT=<subject> yarn test:pbt:browser`
    )
    process.exit(0)
}
if (args.length !== 4)
    throw new Error(
        "Expected current-fast historical-fast current-browser historical-browser log paths"
    )
const readRun = (file) => {
    const paths = [
        ...readFileSync(file, "utf8").matchAll(/"artifact":"([^"]+)"/g),
    ].map((match) => match[1])
    if (!paths.length) throw new Error(`No witnesses in ${file}`)
    return paths.map((path) => JSON.parse(readFileSync(path, "utf8")))
}
const runs = args.map(readRun)
const harnesses = new Set(runs.flat().map((run) => run.revisions.harness))
if (harnesses.size !== 1) throw new Error("Harness revision differs")
if (
    runs
        .flat()
        .some(
            (run) =>
                run.revisions.dirty ||
                run.interrupted ||
                run.completed !== run.configured
        )
)
    throw new Error("Dirty, interrupted or incomplete comparative run")
mkdirSync(directory, { recursive: true })
const summary = {
    harness: [...harnesses][0],
    seed: 20261016,
    subjects: [],
    files: [],
}
const corpus = []
for (const [index, label] of ["current", "historical"].entries()) {
    const fast = runs[index]
    const browser = runs[index + 2]
    if (fast.length !== 1 || fast[0].completed < 200)
        throw new Error("Fast budget missing")
    const subject = fast[0].revisions.subject
    if (browser.some((run) => run.revisions.subject !== subject))
        throw new Error("Mismatched subject")
    const engines = {}
    for (const run of browser) {
        if (!run.revisions.bundle?.sha256)
            throw new Error("Missing actual bundle digest")
        const engine = run.browser.engine
        const result = (engines[engine] ||= {
            version: run.browser.version,
            completed: 0,
            categories: {},
            paths: {},
        })
        result.completed += run.completed
        result.categories[run.property.replace("lifecycle browser ", "")] =
            run.completed
        for (const [key, value] of Object.entries(run.coverage))
            result.paths[key] = (result.paths[key] || 0) + value
        if (run.observed.some((record) => record.findings.length))
            throw new Error("Unreviewed finding")
        if (label === "current" && engine === "chromium")
            run.observed.forEach((record, i) =>
                corpus.push({
                    input: record.input,
                    index: i,
                    seed: run.seed,
                    operations: record.operations,
                })
            )
    }
    if (Object.keys(engines).sort().join(",") !== "chromium,webkit")
        throw new Error("Missing engine")
    for (const engine of Object.values(engines))
        if (
            engine.completed < 30 ||
            Object.keys(engine.categories).length !== 18 ||
            Object.values(engine.categories).some((count) => count < 2)
        )
            throw new Error("Browser category budget missing")
    const raw = Buffer.from(JSON.stringify({ fast, browser }))
    const file = `${label}.json.gz`
    const compressed = gzipSync(raw, { level: 9 })
    writeFileSync(`${directory}/${file}`, compressed)
    summary.files.push({
        file,
        rawBytes: raw.length,
        sha256: createHash("sha256").update(compressed).digest("hex"),
    })
    summary.subjects.push({
        label,
        subject,
        bundle: browser[0].revisions.bundle,
        fast: { completed: fast[0].completed, coverage: fast[0].coverage },
        engines,
    })
}
writeFileSync(
    `${directory}/summary.json`,
    JSON.stringify(summary, null, 2) + "\n"
)
writeFileSync(
    `${directory}/corpus.json`,
    JSON.stringify(corpus, null, 2) + "\n"
)
console.log(JSON.stringify(summary, null, 2))
