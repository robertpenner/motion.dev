import { expect, test } from "@playwright/test"
import { lifecycleBrowser } from "../pbt/lifecycle-browser"

test("lifecycle locked paused seek preserves displayed geometry", async ({
    page,
}) => {
    const result = await lifecycleBrowser(page, {
        category: "sync-seek",
        seek: 0.45,
        rate: 1,
        wait: 80,
    })
    const after = result.snapshots.find((row) => row.label === "after:seek")!
    expect(after.x).toBeCloseTo(30, 1)
    expect(after.y).toBeCloseTo(18, 1)
    expect(after.rect.left).toBeCloseTo(50, 1)
    expect(after.rect.top).toBeCloseTo(38, 1)
})

test("lifecycle locked callback demotion returns with unrelated motion intact", async ({
    page,
}) => {
    const result = await lifecycleBrowser(page, {
        category: "callback-return",
        seek: 0.3,
        rate: 1,
        wait: 80,
    })
    const nativeIds = (row: any) =>
        row.effects
            .filter(
                (effect: any) =>
                    effect.state !== "idle" &&
                    effect.keyframes?.some((frame: any) => "transform" in frame)
            )
            .map((effect: any) => effect.id)
    const before = result.snapshots[0]
    const during = result.snapshots.find(
        (row) => row.label === "after:callback-join"
    )!
    const after = result.snapshots.find(
        (row) => row.label === "callback-ended"
    )!
    expect(nativeIds(before).length).toBeGreaterThan(0)
    expect(nativeIds(during)).toEqual([])
    expect(nativeIds(after).length).toBeGreaterThan(0)
    expect(nativeIds(after)).not.toEqual(nativeIds(before))
    expect(Math.abs(after.x - after.expected.x.value)).toBeLessThan(
        after.expected.x.tolerance
    )
    expect(
        result.events.filter((event) => event.name === "callback")
    ).toHaveLength(1)
})
