import { readFileSync, writeFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"

const directory = "tests/pbt/evidence/lifecycle"
const continuous = new Set([
    "join-leave",
    "finite-repeat",
    "infinite-repeat",
    "outside-write",
    "native-cancel",
    "callback-return",
    "incompatible-loops",
    "projection",
])
const audits = []
for (const subject of ["current", "historical"]) {
    const raw = JSON.parse(
        gunzipSync(readFileSync(`${directory}/${subject}.json.gz`))
    )
    for (const engine of ["chromium", "webkit"]) {
        const windows = []
        for (const witness of raw.browser.filter(
            (run) => run.browser.engine === engine
        )) {
            for (const record of witness.observed.filter((record) =>
                continuous.has(record.input.category)
            )) {
                const rows = record.snapshots.filter(
                    (row) => row.label !== "disposed"
                )
                for (let index = 1; index < rows.length; index++) {
                    const previous = rows[index - 1]
                    const next = rows[index]
                    const dt = next.sampleTime - previous.sampleTime
                    if (
                        dt < 20 ||
                        dt > 500 ||
                        previous.expected.x.value <= 0 ||
                        next.expected.x.value >= 99
                    )
                        continue
                    const dx = next.x - previous.x
                    const referenceDx =
                        next.expected.x.value - previous.expected.x.value
                    const residualPx = Math.abs(dx - referenceDx)
                    if (residualPx > 0.25 || dx <= 0)
                        throw new Error(
                            `Continuity failure: ${subject}/${engine}/${record.input.category}`
                        )
                    windows.push({
                        input: record.input,
                        previous: previous.label,
                        next: next.label,
                        dt,
                        dx,
                        referenceDx,
                        residualPx,
                        velocityPxPerMs: dx / dt,
                        referenceVelocityPxPerMs: referenceDx / dt,
                    })
                }
            }
        }
        if (windows.length < 50)
            throw new Error("Insufficient continuity windows")
        audits.push({
            subject,
            engine,
            harness: raw.browser[0].revisions.harness,
            count: windows.length,
            tolerancePx: 0.25,
            maxResidualPx: Math.max(
                ...windows.map((window) => window.residualPx)
            ),
            windows,
        })
    }
}
writeFileSync(
    `${directory}/continuity.json`,
    JSON.stringify(audits, null, 2) + "\n"
)
console.log(audits.map(({ windows, ...summary }) => summary))
