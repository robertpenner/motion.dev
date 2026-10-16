import { randomUUID } from "crypto"
import { mkdirSync, writeFileSync } from "fs"
import { join } from "path"
import { revisions, root } from "./revisions"

interface ExecutionReceipt {
    property: string
    mode: "bounded" | "discovery" | "fixture" | "browser" | "reference"
    completed: number
    unit: "generated-cases" | "families" | "fixtures" | "checks"
    artifact?: string
}

export function recordExecutionReceipt(receipt: ExecutionReceipt) {
    const runId = process.env.PBT_RUN_ID
    if (!runId) return
    if (process.env.FC_PROPERTY && process.env.FC_PROPERTY !== receipt.property)
        throw new Error(
            `Selected ${process.env.FC_PROPERTY}, but executed ${receipt.property}`
        )
    const directory = join(root, "test_results/pbt")
    mkdirSync(directory, { recursive: true })
    const file = join(directory, `${runId}-${randomUUID()}.json`)
    const report = { ...receipt, revisions: revisions() }
    writeFileSync(file, JSON.stringify(report, null, 2) + "\n")
    console.log(JSON.stringify({ ...report, receipt: file }))
}
