import { defineConfig, devices } from "@playwright/test"
import { subjectRoot } from "./revisions"

const port = Number(process.env.PBT_PORT || 8022)

export default defineConfig({
    testDir: "..",
    testMatch: [
        "**/pbt/*.property.spec.ts",
        "**/animate/independent-transforms-lifecycle.spec.ts",
        "**/animate/independent-transforms.spec.ts",
        "**/animate/independent-transforms-handoff.spec.ts",
    ],
    timeout: 180000,
    workers: 1,
    retries: 0,
    reporter: [
        ["list"],
        [
            "html",
            { outputFolder: "../../playwright-report/pbt", open: "never" },
        ],
    ],
    outputDir: "../../test_results/pbt-browser",
    use: {
        baseURL: `http://localhost:${port}/playwright/`,
        trace: "retain-on-failure",
    },
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "webkit", use: { ...devices["Desktop Safari"] } },
    ],
    webServer: {
        command: `yarn vite --port ${port} --strictPort`,
        cwd: `${subjectRoot}/dev/html`,
        url: `http://localhost:${port}`,
        reuseExistingServer: false,
    },
})
