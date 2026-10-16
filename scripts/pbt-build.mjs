import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim()
const runtime = [
    "packages/motion-utils/src",
    "packages/motion-dom/src",
    "packages/framer-motion/src",
]
if (git("diff", "HEAD", "--", ...runtime, ":(exclude)**/__tests__/**")) {
    throw new Error(
        "Refusing to label modified production sources as a committed subject"
    )
}
const hash = createHash("sha256")
let files = 0
const walk = (relative) => {
    for (const entry of readdirSync(relative, { withFileTypes: true }).sort(
        (a, b) => a.name.localeCompare(b.name)
    )) {
        const name = join(relative, entry.name)
        if (entry.isDirectory()) walk(name)
        else {
            hash.update(name).update(readFileSync(name))
            files++
        }
    }
}
for (const pkg of ["motion-utils", "motion-dom", "framer-motion"])
    walk(`packages/${pkg}/dist`)
mkdirSync("test_results", { recursive: true })
writeFileSync(
    "test_results/pbt-build.json",
    JSON.stringify(
        {
            subject: git("rev-parse", "HEAD"),
            sha256: hash.digest("hex"),
            files,
        },
        null,
        2
    ) + "\n"
)
