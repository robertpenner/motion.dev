import { defineConfig } from "@playwright/test"
import base from "./playwright.config"

export default defineConfig({
    ...base,
    testDir: "../animate",
    testMatch: [
        "independent-transforms.spec.ts",
        "independent-transforms-handoff.spec.ts",
    ],
})
