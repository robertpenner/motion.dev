import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const [mode, subject] = process.argv.slice(2)
const input = resolve(
    "test_results/pbt-sampling",
    mode === "record" ? subject : ""
)
const load = (file) => JSON.parse(readFileSync(resolve(input, file), "utf8"))
const save = (directory, file, value) => {
    mkdirSync(directory, { recursive: true })
    writeFileSync(
        resolve(directory, file),
        JSON.stringify(value, null, 2) + "\n"
    )
}
if (mode === "fixtures") {
    const directory = resolve("tests/pbt/fixtures/sampling")
    const manifest = []
    for (const finding of load("discoveries.json")) {
        if (!finding.minimized) continue
        for (const kind of ["original", "minimized"]) {
            const file = `${finding.family}-${kind}.json`
            save(directory, file, finding[kind])
            manifest.push({
                name: `${finding.family}-${kind}`,
                file,
                kind: "finding",
                path: finding.minimizedObservation.path.path,
            })
        }
    }
    const bounded = load("bounded.json")
    const control = {
        version: 1,
        family: "near-zero-range",
        tracks: [
            {
                channel: "x",
                values: [0, 100, 1e-8],
                times: [0, 0.5, 1],
                duration: 1,
                ease: { kind: "named", name: "linear" },
            },
        ],
        sampleTimes: [0, 0.137, 0.25, 0.5, 0.75, 0.887, 1],
    }
    save(directory, "near-zero-control.json", control)
    manifest.push({
        name: "near-zero-control",
        file: "near-zero-control.json",
        kind: "control",
    })
    const residue = {
        version: 1,
        family: "roundtrip-residue-control",
        tracks: [
            {
                channel: "y",
                values: [-1e-30, -18, 0],
                duration: 1.2,
                ease: { kind: "named", name: "easeInOut" },
            },
        ],
        sampleTimes: [0.137, 0.3, 0.5, 0.75, 1],
    }
    save(directory, "roundtrip-residue-control.json", residue)
    manifest.push({
        name: "roundtrip-residue-control",
        file: "roundtrip-residue-control.json",
        kind: "control",
    })
    const oracles = [
        {
            version: 1,
            family: "native-oracle",
            tracks: [
                {
                    channel: "x",
                    values: [0, 200],
                    duration: 1,
                    ease: { kind: "named", name: "easeInOut" },
                },
            ],
            sampleTimes: [0, 0.137, 0.25, 0.5, 0.75, 0.887, 1],
        },
        {
            version: 1,
            family: "shared-oracle",
            tracks: [
                {
                    channel: "x",
                    values: [0, 200],
                    duration: 1,
                    ease: { kind: "power", exponent: 2 },
                },
                {
                    channel: "rotate",
                    values: [0, 90],
                    duration: 1,
                    ease: { kind: "power", exponent: 2 },
                },
            ],
            sampleTimes: [0, 0.137, 0.25, 0.5, 0.75, 0.887, 1],
        },
        {
            version: 1,
            family: "adaptive-oracle",
            tracks: [
                {
                    channel: "x",
                    values: [-20, 200],
                    duration: 1,
                    ease: { kind: "power", exponent: 2 },
                },
                {
                    channel: "y",
                    values: [-10, 70],
                    duration: 0.8,
                    ease: { kind: "named", name: "linear" },
                },
                {
                    channel: "scale",
                    values: [0.5, 2],
                    duration: 1,
                    ease: { kind: "power", exponent: 3 },
                },
                {
                    channel: "rotate",
                    values: [-40, 90],
                    duration: 1,
                    ease: { kind: "named", name: "linear" },
                },
                {
                    channel: "skewX",
                    values: [-10, 20],
                    duration: 1,
                    ease: { kind: "power", exponent: 2 },
                },
            ],
            sampleTimes: [0, 0.137, 0.25, 0.5, 0.75, 0.887, 1],
        },
    ]
    for (const fixture of oracles) {
        const file = `${fixture.family}.json`
        save(directory, file, fixture)
        manifest.push({ name: fixture.family, file, kind: "oracle" })
    }
    save(directory, "manifest.json", manifest)
    save(directory, "discovery-provenance.json", {
        explorationOnly: true,
        description:
            "Fixture generation record; final exact-harness discoveries live in reports/sampling/<subject>/discoveries.json",
        revisions: bounded.revisions,
        findings: load("discoveries.json").map(
            ({ family, seed, path, shrinks, completed }) => ({
                family,
                seed,
                path,
                shrinks,
                completed,
            })
        ),
    })
} else if (mode === "record" && ["current", "historical"].includes(subject)) {
    const directory = resolve("reports/sampling", subject)
    const { rows, ...bounded } = load("bounded.json")
    const perFamilyPaths = {}
    for (const row of rows) {
        perFamilyPaths[row.family] ||= {}
        perFamilyPaths[row.family][row.path] =
            (perFamilyPaths[row.family][row.path] || 0) + 1
    }
    save(directory, "bounded.json", { ...bounded, perFamilyPaths })
    writeFileSync(
        resolve(directory, "cases.jsonl"),
        rows.map((row) => JSON.stringify(row)).join("\n") + "\n"
    )
    for (const name of [
        "discoveries.json",
        "browser-chromium.json",
        "browser-webkit.json",
    ]) {
        save(directory, name, load(name))
    }
    for (const engine of ["chromium", "webkit"]) {
        for (const suffix of ["residue", "residue-running"]) {
            const name = `browser-${engine}-${suffix}.png`
            writeFileSync(
                resolve(directory, name),
                readFileSync(resolve(input, name))
            )
        }
    }
} else {
    throw new Error(
        "Usage: node scripts/pbt-sampling-evidence.mjs fixtures | record current|historical"
    )
}
