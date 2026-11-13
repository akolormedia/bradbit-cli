import { access, mkdir, readdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { guionistaKitFiles } from "./guionista-kit.generated"

export interface InitProjectResult {
  path: string
  name: string
  alreadyInitialized: boolean
  gitInitialized: boolean
}

export class InitProjectError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InitProjectError"
  }
}

/** Same rules as the editor's project template validation. */
export function validateProjectName(name: string): string | null {
  const value = name.trim()
  if (!value) return "Project name cannot be empty"
  if (value === "." || value === ".." || value.startsWith(".")) return "Project name cannot start with a dot"
  if (value.length > 120) return "Project name is too long"
  if (/[/\\:\0]/.test(value) || [...value].some((character) => character.charCodeAt(0) < 32)) {
    return "Project name contains invalid characters"
  }
  return null
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

async function isBradbitProject(root: string): Promise<boolean> {
  const kit =
    (await exists(path.join(root, ".bradbit/agents/guionista.md"))) ||
    // Legacy projects created before the `.bradbit` migration stay idempotent.
    (await exists(path.join(root, ".opencode/agents/guionista.md")))
  return (
    (await exists(path.join(root, "AGENTS.md"))) &&
    kit &&
    (await exists(path.join(root, "biblia/premisa.md")))
  )
}

function gitInit(root: string): void {
  const result = Bun.spawnSync({
    cmd: ["git", "init", "--quiet"],
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  })
  if (result.exitCode !== 0) {
    const detail = result.stderr.toString().trim()
    throw new InitProjectError(
      detail
        ? `Project files created at ${root}, but git init failed: ${detail}`
        : `Project files created at ${root}, but git init failed`,
    )
  }
}

/**
 * Creates a Bradbit project from the embedded guionista-kit.
 *
 * - A missing or empty destination is populated.
 * - A non-empty destination is only accepted when it already looks like a
 *   guionista-kit project, in which case initialization is idempotent.
 */
export async function initProject(destination: string): Promise<InitProjectResult> {
  if (!destination.trim()) throw new InitProjectError("Destination cannot be empty")

  const target = path.resolve(destination)
  const name = path.basename(target)
  const nameError = validateProjectName(name)
  if (nameError) throw new InitProjectError(nameError)

  if (await exists(target)) {
    const info = await stat(target)
    if (!info.isDirectory()) throw new InitProjectError(`Destination is not a directory: ${target}`)
    const entries = await readdir(target)
    if (entries.length > 0) {
      if (!(await isBradbitProject(target))) {
        throw new InitProjectError(`Destination is not empty: ${target}`)
      }
      gitInit(target)
      return {
        path: target,
        name,
        alreadyInitialized: true,
        gitInitialized: true,
      }
    }
  } else {
    await mkdir(target, { recursive: true })
  }

  for (const [relative, content] of Object.entries(guionistaKitFiles)) {
    const file = path.join(target, relative)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, content, "utf8")
  }
  gitInit(target)

  return {
    path: target,
    name,
    alreadyInitialized: false,
    gitInitialized: true,
  }
}
