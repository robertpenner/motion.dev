import { readFileSync } from "fs"
import { resolve } from "path"
import { configuration, Coverage } from "./pbt-config"

it("excludes exploratory properties but retains locked regressions in normal Jest discovery", () => {
    const config = JSON.parse(
        readFileSync(
            resolve(__dirname, "../../../../..", "jest.config.json"),
            "utf8"
        )
    )
    const ignored = (name: string) =>
        config.testPathIgnorePatterns.some((pattern: string) =>
            new RegExp(pattern).test(name)
        )
    expect(ignored("sampling.property.test.ts")).toBe(true)
    expect(ignored("sampling.locked.test.ts")).toBe(false)
})

describe("PBT locked configuration regressions", () => {
    it.each(["", "1.5", "NaN", "2147483648", "1x"])(
        "rejects malformed seed %j",
        (FC_SEED) => {
            expect(() => configuration({ FC_SEED })).toThrow("signed 32-bit")
        }
    )

    it("pins the signed seed boundaries and requires a selected numeric path", () => {
        expect(configuration({ FC_SEED: "-2147483648" }).seed).toBe(-2147483648)
        expect(configuration({ FC_SEED: "2147483647" }).seed).toBe(2147483647)
        expect(() => configuration({ FC_PATH: "0:1" })).toThrow(
            "requires FC_PROPERTY"
        )
        expect(() =>
            configuration({ FC_PATH: "broken", FC_PROPERTY: "smoke" })
        ).toThrow()
        expect(
            configuration({ FC_PATH: "0:1", FC_PROPERTY: "smoke" }).path
        ).toBe("0:1")
    })

    it("rejects empty coverage instead of claiming the budget passed", () => {
        const coverage = new Coverage()
        expect(() => coverage.require({ adaptive: 1 })).toThrow(
            "Coverage adaptive: 0 < 1"
        )
        coverage.hit("adaptive")
        coverage.require({ adaptive: 1 })
    })
})
