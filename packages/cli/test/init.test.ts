import { afterEach, describe, expect, test } from "bun:test"
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { guionistaKitFiles } from "../src/kit/guionista-kit.generated"
import { initProject, validateProjectName } from "../src/kit/init-project"

const roots: string[] = []

async function tempRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "bradbit-init-"))
  roots.push(root)
  return root
}

async function exists(target: string) {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

async function listProjectFiles(root: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(path.join(root, prefix), { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (prefix === "" && entry.name === ".git") continue
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...(await listProjectFiles(root, relative)))
    else files.push(relative)
  }
  return files
}

function isGitRepository(target: string) {
  const result = Bun.spawnSync({
    cmd: ["git", "-C", target, "rev-parse", "--is-inside-work-tree"],
    stdout: "pipe",
    stderr: "pipe",
  })
  return result.exitCode === 0 && result.stdout.toString().trim() === "true"
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("bradbit init (T-3.1.4)", () => {
  test("creates the guionista-kit project tree and initializes git", async () => {
    const root = await tempRoot()
    const target = path.join(root, "mi-guion")

    const result = await initProject(target)

    expect(result).toEqual({
      path: target,
      name: "mi-guion",
      alreadyInitialized: false,
      gitInitialized: true,
    })
    for (const relative of [
      "AGENTS.md",
      ".bradbit/agents/screenwriter.md",
      ".bradbit/commands/scene.md",
      "bible/premise.md",
      "bible/characters/_template.md",
      "structure/.gitkeep",
      "script/.gitkeep",
      "notes/.gitkeep",
      "README.md",
    ]) {
      expect(await exists(path.join(target, relative))).toBe(true)
    }
    expect(await readFile(path.join(target, "AGENTS.md"), "utf8")).toContain("bible")
    expect(isGitRepository(target)).toBe(true)

    const written = (await listProjectFiles(target)).toSorted()
    expect(written).toEqual(Object.keys(guionistaKitFiles).toSorted())
    for (const [relative, content] of Object.entries(guionistaKitFiles)) {
      expect(await readFile(path.join(target, relative), "utf8")).toBe(content)
    }
  })

  test("initializes an existing empty directory", async () => {
    const root = await tempRoot()
    const target = path.join(root, "vacio")
    await mkdir(target)

    const result = await initProject(target)

    expect(result.alreadyInitialized).toBe(false)
    expect(await exists(path.join(target, ".bradbit/agents/screenwriter.md"))).toBe(true)
    expect(isGitRepository(target)).toBe(true)
  })

  test("refuses a non-empty directory that is not a Bradbit project", async () => {
    const root = await tempRoot()
    const target = path.join(root, "ocupado")
    await mkdir(target)
    await writeFile(path.join(target, "notas.txt"), "no tocar")

    await expect(initProject(target)).rejects.toThrow(/not empty/)
    expect(await readFile(path.join(target, "notas.txt"), "utf8")).toBe("no tocar")
  })

  test("is idempotent for an existing guionista-kit project and never overwrites it", async () => {
    const root = await tempRoot()
    const target = path.join(root, "repetido")
    await initProject(target)
    await writeFile(path.join(target, "AGENTS.md"), "personalizado")

    const result = await initProject(target)

    expect(result.alreadyInitialized).toBe(true)
    expect(await readFile(path.join(target, "AGENTS.md"), "utf8")).toBe("personalizado")
    expect(isGitRepository(target)).toBe(true)
  })

  test("rejects a destination file and invalid project names", async () => {
    const root = await tempRoot()
    const file = path.join(root, "archivo")
    await writeFile(file, "x")
    await expect(initProject(file)).rejects.toThrow(/not a directory/)

    await expect(initProject(path.join(root, ".oculto"))).rejects.toThrow(/start with a dot/)
    await expect(initProject(path.join(root, "con:colon"))).rejects.toThrow(/invalid characters/)
    expect(validateProjectName("  ")).toBe("Project name cannot be empty")
  })

  test("accepts an existing .opencode project as already initialized", async () => {
    const root = await tempRoot()
    const target = path.join(root, "legacy")
    await mkdir(path.join(target, ".opencode/agents"), { recursive: true })
    await mkdir(path.join(target, "bible"), { recursive: true })
    await writeFile(path.join(target, "AGENTS.md"), "legacy")
    await writeFile(path.join(target, ".opencode/agents/screenwriter.md"), "legacy kit")
    await writeFile(path.join(target, "bible/premise.md"), "legacy premise")

    const result = await initProject(target)

    expect(result.alreadyInitialized).toBe(true)
    expect(await exists(path.join(target, ".opencode/agents/screenwriter.md"))).toBe(true)
    expect(await exists(path.join(target, ".bradbit/agents/screenwriter.md"))).toBe(false)
    expect(isGitRepository(target)).toBe(true)
  })

  test("the embedded snapshot contains the kit and excludes exports", () => {
    expect(guionistaKitFiles[".bradbit/agents/screenwriter.md"]).toContain("Screenwriter")
    expect(guionistaKitFiles["bible/premise.md"]).toBeDefined()
    expect(Object.keys(guionistaKitFiles).some((file) => file.startsWith("exports/"))).toBe(false)
    expect(Object.keys(guionistaKitFiles).some((file) => file.includes("/.git/"))).toBe(false)
  })
})
