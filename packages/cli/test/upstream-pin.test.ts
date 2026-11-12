import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import path from "node:path"

const root = path.resolve(import.meta.dir, "../../..")

describe("upstream pin (T-3.1.6)", () => {
  test("records a valid upstream commit and keeps CONTRACT.md in sync", async () => {
    const pin = await Bun.file(path.join(root, "upstream.json")).json()
    expect(pin.repository).toBe("anomalyco/opencode")
    expect(pin.branch).toBe("dev")
    expect(pin.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(pin.commit).toMatch(/^[0-9a-f]{40}$/)
    expect(pin.pinnedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const contract = await readFile(path.join(root, "CONTRACT.md"), "utf8")
    expect(contract).toContain(pin.commit)
  })
})
