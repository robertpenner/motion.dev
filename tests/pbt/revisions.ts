import { execFileSync } from "child_process"
import { createHash } from "crypto"
import { readdirSync, readFileSync } from "fs"
import { join, resolve } from "path"
import type { Revisions } from "./types"

export const root = resolve(__dirname, "../..")
export const subjectRoot = process.env.PBT_SUBJECT_ROOT || root
const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8" }).trim()

export function revisions(): Revisions {
    return {
        subject: git(subjectRoot, "rev-parse", "HEAD"),
        harness: git(root, "rev-parse", "HEAD"),
        subjectRoot,
        dirty: !!git(root, "status", "--porcelain"),
    }
}

export function bundleDigest(directory = subjectRoot) {
    const hash = createHash("sha256")
    let files = 0
    const walk = (relative: string) => {
        for (const entry of readdirSync(join(directory, relative), {
            withFileTypes: true,
        }).sort((a, b) => a.name.localeCompare(b.name))) {
            const name = `${relative}/${entry.name}`
            if (entry.isDirectory()) walk(name)
            else {
                hash.update(name).update(readFileSync(join(directory, name)))
                files++
            }
        }
    }
    for (const pkg of ["motion-utils", "motion-dom", "framer-motion"]) {
        walk(`packages/${pkg}/dist`)
    }
    return { sha256: hash.digest("hex"), files }
}

export function browserRevisions(): Revisions {
    const recorded = JSON.parse(
        readFileSync(join(subjectRoot, "test_results/pbt-build.json"), "utf8")
    )
    const actual = bundleDigest()
    const result = revisions()
    if (
        recorded.subject !== result.subject ||
        actual.sha256 !== recorded.sha256
    ) {
        throw new Error(
            "Stale PBT bundles: run yarn test:pbt:build at the subject root"
        )
    }
    return { ...result, bundle: recorded }
}
