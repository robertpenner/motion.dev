import { expect, test } from "@playwright/test"
import { mkdirSync, readFileSync, writeFileSync } from "fs"
import { resolve } from "path"
import { browserAdapter } from "./browser-adapter"
import { browserRevisions } from "./revisions"
import {
    emitted,
    matrix,
    pointError,
    sourceChannels,
} from "./sampling-reference"
import type { TransformCase } from "./types"

test("sampling browser confirmation and independent payload oracle", async ({
    page,
    browser,
    browserName,
}) => {
    const revisions = browserRevisions()
    let injections = 0
    const directory = resolve(
        __dirname,
        "../../test_results/pbt-sampling",
        process.env.SAMPLING_SUBJECT || ""
    )
    mkdirSync(directory, { recursive: true })
    await page.exposeFunction("__pbtSamplingScreenshot", async () =>
        (
            await page.screenshot({
                path: resolve(directory, `browser-${browserName}-residue.png`),
            })
        ).toString("base64")
    )
    await page.addInitScript(() => {
        Reflect.set(window, "__pbtSamplingRuns", [])
    })
    // Observe the actual lexical run() branch in served JS, without editing any
    // subject file, changing easing, sample times, options, or emitted payloads.
    await page.route(/\.m?js(?:\?|$)/, async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        const pattern =
            /(?:const|var|let) easing = nativeEasing \|\| getEasing\(moving, from, to, bounds\);/g
        const instrumented = body.replace(pattern, (match) => {
            injections++
            return `${match}
if (element.getAttribute("data-pbt-sampling") === "1") {
globalThis.__pbtSamplingRuns.push({ from, to, starts: moving.map(t => t.startTime),
path: nativeEasing ? "native" : easing ? "shared-progress" : "adaptive" });
}`
        })
        await route.fulfill({ response, body: instrumented })
    })
    const manifest = JSON.parse(
        readFileSync(
            resolve(__dirname, "fixtures/sampling/manifest.json"),
            "utf8"
        )
    ) as { name: string; file: string; kind: string; path?: string }[]
    const results = []
    for (const item of manifest) {
        const input = JSON.parse(
            readFileSync(
                resolve(__dirname, "fixtures/sampling", item.file),
                "utf8"
            )
        ) as TransformCase
        const raw = await browserAdapter(page, input, true)
        const run = raw.instrumentation?.runs?.at(-1)
        expect(
            run,
            `actual run branch hook must execute; injections=${injections}`
        ).toBeTruthy()
        expect(raw.effects.length).toBe(1)
        if (item.path) expect(run!.path).toBe(item.path)
        const payload = raw.payloads.find((p) => !p.cancelled && p.keyframes)!
        const shift = (raw.instrumentation!.commonStart! - run!.from) / 1000
        const measurements = raw.measurements.map((m) => {
            const expectedSource = matrix(sourceChannels(input, m.seconds))
            const expectedEmitted = matrix(emitted(payload, m.seconds + shift))
            return {
                ...m,
                expectedSource,
                expectedEmitted,
                emittedInterpolationErrorPx: pointError(
                    expectedEmitted,
                    m.matrix
                ),
                sourceScreenErrorPx: pointError(expectedSource, m.matrix),
            }
        })
        const maxInterpolationError = Math.max(
            ...measurements.map((m) => m.emittedInterpolationErrorPx)
        )
        const maxSourceError = Math.max(
            ...measurements.map((m) => m.sourceScreenErrorPx)
        )
        results.push({
            ...item,
            input,
            raw,
            actualPath: run!.path,
            measurements,
            maxInterpolationError,
            maxSourceError,
        })
        writeFileSync(
            resolve(directory, `browser-${browserName}-progress.json`),
            JSON.stringify(results, null, 2)
        )
        if (item.kind === "oracle")
            expect(maxInterpolationError).toBeLessThan(0.03)
        expect(measurements.every((m) => m.matrix.every(Number.isFinite))).toBe(
            true
        )
    }
    expect(injections).toBeGreaterThan(0)
    await page.goto("animate/animate-independent-transforms.html")
    await page.waitForFunction(() => Reflect.get(window, "ready") === true)
    const painting = await page.evaluate(async () => {
        const element = document.createElement("div")
        element.id = "pbt-running-residue"
        element.setAttribute("data-pbt-sampling", "1")
        element.style.cssText =
            "position:fixed;left:200px;top:200px;width:100px;height:100px;background:#0077ff"
        document.body.appendChild(element)
        const api = Reflect.get(window, "Motion") as {
            animate(
                element: Element,
                values: unknown,
                options: unknown
            ): { stop(): void }
        }
        Reflect.set(
            window,
            "__pbtRunningResidue",
            api.animate(
                element,
                { y: [-1e-30, -18, 0] },
                { duration: 1.2, ease: "easeInOut", repeat: Infinity }
            )
        )
        await new Promise((resolve) => setTimeout(resolve, 300))
        const rect = element.getBoundingClientRect()
        return {
            rect: {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
            },
            transform: getComputedStyle(element).transform,
            runs: Reflect.get(window, "__pbtSamplingRuns"),
            userAgent: navigator.userAgent,
        }
    })
    const screenshot = await page.screenshot({
        path: resolve(directory, `browser-${browserName}-residue-running.png`),
    })
    const pixel = await page.evaluate(
        async ({ imageData, rect }) => {
            const image = new Image()
            image.src = imageData
            await image.decode()
            const canvas = document.createElement("canvas")
            canvas.width = image.width
            canvas.height = image.height
            const context = canvas.getContext("2d")!
            context.drawImage(image, 0, 0)
            return Array.from(
                context.getImageData(
                    Math.floor(
                        ((rect.left + rect.width / 2) * image.width) /
                            window.innerWidth
                    ),
                    Math.floor(
                        ((rect.top + rect.height / 2) * image.height) /
                            window.innerHeight
                    ),
                    1,
                    1
                ).data
            )
        },
        {
            imageData: "data:image/png;base64," + screenshot.toString("base64"),
            rect: painting.rect,
        }
    )
    await page.evaluate(() => {
        ;(Reflect.get(window, "__pbtRunningResidue") as { stop(): void }).stop()
        document.getElementById("pbt-running-residue")!.remove()
    })
    writeFileSync(
        resolve(directory, `browser-${browserName}.json`),
        JSON.stringify(
            {
                revisions,
                engine: browserName,
                version: browser.version(),
                injections,
                instrumentation:
                    "in-memory served run() branch observer; no subject files modified",
                paintingControl: {
                    ...painting,
                    pixel,
                    paintsBlue: pixel[0] < 50 && pixel[2] > 200,
                },
                results,
            },
            null,
            2
        ) + "\n"
    )
})
