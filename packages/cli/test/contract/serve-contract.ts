#!/usr/bin/env bun
/**
 * Contract test for `bradbit serve` (T-3.1.2).
 *
 * Freezes the HTTP/SSE surface that `bradbit-editor` consumes so an upstream
 * rebase can never silently break the editor. It spawns a real `bradbit serve`
 * process and asserts the shapes/status codes the editor's Rust client expects.
 *
 * Usage:
 *   BRADBIT_BIN=/path/to/bradbit bun run packages/cli/test/contract/serve-contract.ts
 */

import { spawn } from "bun"
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createServer } from "node:net"

const BIN = process.env.BRADBIT_BIN
if (!BIN) {
  console.error("BRADBIT_BIN is required (absolute path to the bradbit binary)")
  process.exit(2)
}

let passed = 0
const failures: string[] = []

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++
    console.log(`  ok   ${name}`)
  } else {
    failures.push(detail ? `${name} — ${detail}` : name)
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      const port = typeof address === "object" && address ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

async function main() {
  // ── CLI surface ─────────────────────────────────────────────────────
  const help = Bun.spawnSync({ cmd: [BIN!, "--help"], stdout: "pipe", stderr: "pipe" })
  const helpOutput = help.stdout.toString()
  check(
    "--help describes the Bradbit CLI",
    helpOutput.includes("Bradbit command line interface"),
    helpOutput.split("\n").slice(0, 6).join(" | "),
  )
  check(
    "--help uses the bradbit command name",
    helpOutput.includes("bradbit <subcommand>"),
    helpOutput.split("\n").slice(0, 8).join(" | "),
  )

  const runHelp = Bun.spawnSync({ cmd: [BIN!, "run", "--help"], stdout: "pipe", stderr: "pipe" })
  check(
    "`run --help` uses Bradbit copy",
    runHelp.exitCode === 0 && runHelp.stdout.toString().includes("Run Bradbit with a message"),
    runHelp.stdout.toString().split("\n").slice(0, 6).join(" | "),
  )

  const initHelp = Bun.spawnSync({ cmd: [BIN!, "init", "--help"], stdout: "pipe", stderr: "pipe" })
  check(
    "`init --help` describes guionista-kit",
    initHelp.exitCode === 0 && initHelp.stdout.toString().includes("guionista-kit"),
    initHelp.stdout.toString().split("\n").slice(0, 6).join(" | "),
  )

  const port = await freePort()
  const workdir = realpathSync(mkdtempSync(join(tmpdir(), "bradbit-contract-")))
  const initTarget = join(workdir, "init-project")
  const initialized = Bun.spawnSync({
    cmd: [BIN!, "init", initTarget],
    stdout: "pipe",
    stderr: "pipe",
  })
  check(
    "`init` creates a guionista-kit project with Git",
    initialized.exitCode === 0 &&
      existsSync(join(initTarget, "AGENTS.md")) &&
      existsSync(join(initTarget, ".bradbit/agents/screenwriter.md")) &&
      existsSync(join(initTarget, ".git")),
    initialized.stderr.toString().split("\n").slice(0, 4).join(" | "),
  )

  // Minimal narrative kit, equivalent to what guionista-kit installs in a project.
  mkdirSync(join(workdir, ".opencode/agent"), { recursive: true })
  writeFileSync(
    join(workdir, ".opencode/agent/screenwriter.md"),
    "---\ndescription: Writes scenes from .opencode\nmode: primary\n---\n\nWrites clear, visual scenes.\n",
  )
  mkdirSync(join(workdir, ".opencode/command"), { recursive: true })
  writeFileSync(
    join(workdir, ".opencode/command/scene.md"),
    "---\ndescription: Writes a scene from .opencode\n---\n\nWrites a scene in Fountain format.\n",
  )
  mkdirSync(join(workdir, ".opencode/skills/write-scene"), { recursive: true })
  writeFileSync(
    join(workdir, ".opencode/skills/write-scene/SKILL.md"),
    "---\nname: write-scene\ndescription: Writes a scene from .opencode\n---\n\nDevelops the requested scene.\n",
  )

  // Canonical `.bradbit` entries with the same ids must win over `.opencode`.
  mkdirSync(join(workdir, ".bradbit/agents"), { recursive: true })
  writeFileSync(
    join(workdir, ".bradbit/agents/screenwriter.md"),
    "---\ndescription: Writes scenes from .bradbit\nmode: primary\n---\n\nWrites scenes from the canonical folder.\n",
  )
  mkdirSync(join(workdir, ".bradbit/commands"), { recursive: true })
  writeFileSync(
    join(workdir, ".bradbit/commands/scene.md"),
    "---\ndescription: Writes a scene from .bradbit\n---\n\nWrites a scene from the canonical folder.\n",
  )
  mkdirSync(join(workdir, ".bradbit/skills/write-scene"), { recursive: true })
  writeFileSync(
    join(workdir, ".bradbit/skills/write-scene/SKILL.md"),
    "---\nname: write-scene\ndescription: Writes a scene from .bradbit\n---\n\nDevelops the scene from the canonical folder.\n",
  )

  // Legacy-only entries prove `.opencode` still works.
  writeFileSync(
    join(workdir, ".opencode/agent/legacy.md"),
    "---\ndescription: Legacy agent\nmode: primary\n---\n\nOnly exists in .opencode.\n",
  )
  writeFileSync(
    join(workdir, ".opencode/command/legacy-command.md"),
    "---\ndescription: Legacy command\n---\n\nOnly exists in .opencode.\n",
  )
  mkdirSync(join(workdir, ".opencode/skills/legacy-skill"), { recursive: true })
  writeFileSync(
    join(workdir, ".opencode/skills/legacy-skill/SKILL.md"),
    "---\nname: legacy-skill\ndescription: Legacy skill\n---\n\nOnly exists in .opencode.\n",
  )
  writeFileSync(join(workdir, "AGENTS.md"), "# Proyecto de prueba\n\nKit narrativo mínimo.\n")

  const base = `http://127.0.0.1:${port}`
  const locationQuery = `?location[directory]=${encodeURIComponent(workdir)}`

  const proc = spawn({
    cmd: [BIN!, "serve", "--hostname", "127.0.0.1", "--port", String(port)],
    cwd: workdir,
    stdout: "pipe",
    stderr: "pipe",
  })

  let output = ""
  const decoder = new TextDecoder()
  void (async () => {
    try {
      for await (const chunk of proc.stdout) output += decoder.decode(chunk)
    } catch {}
  })()

  const deadline = Date.now() + 20_000
  while (Date.now() < deadline && !/server password (\S+)/.test(output)) {
    await Bun.sleep(100)
  }

  const password = output.match(/server password (\S+)/)?.[1] ?? ""
  const listening = output.match(/server listening on (\S+)/)?.[1] ?? ""

  const authorization = `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`

  const req = async (method: string, path: string, body?: unknown) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        Authorization: authorization,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const text = await response.text()
    let json: any = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {}
    return { status: response.status, json, text }
  }

  try {
    // ── Startup contract ────────────────────────────────────────────────
    check("announces 'server listening on <url>'", listening.startsWith("http://127.0.0.1:"), output.slice(0, 400))
    check("announces 'server password <pw>'", password.length > 0, output.slice(0, 400))

    // ── Auth ────────────────────────────────────────────────────────────
    const unauthorized = await fetch(base + "/api/info")
    check("rejects unauthenticated /api/info (401)", unauthorized.status === 401, String(unauthorized.status))

    // ── Info + models ───────────────────────────────────────────────────
    const info = await req("GET", "/api/info")
    check(
      "GET /api/info → 200 with string version",
      info.status === 200 && typeof info.json?.version === "string",
      JSON.stringify(info.json)?.slice(0, 160),
    )

    const models = await req("GET", "/api/model")
    check("GET /api/model → { data: [] }", models.status === 200 && Array.isArray(models.json?.data))

    // ── Sessions ────────────────────────────────────────────────────────
    const created = await req("POST", `/api/session${locationQuery}`, {
      title: "Contract",
    })
    const sessionId = created.json?.data?.id
    check(
      "POST /api/session → id prefixed ses_",
      typeof sessionId === "string" && sessionId.startsWith("ses_"),
      JSON.stringify(created.json)?.slice(0, 160),
    )

    const listed = await req("GET", "/api/session")
    check(
      "GET /api/session → { data: [...] } containing the session",
      listed.status === 200 &&
        Array.isArray(listed.json?.data) &&
        listed.json.data.some((session: any) => session.id === sessionId),
    )

    const renamed = await req("PATCH", `/api/session/${sessionId}`, { title: "Contract renamed" })
    check("PATCH /api/session/{id} → 204 No Content", renamed.status === 204, String(renamed.status))

    const messages = await req("GET", `/api/session/${sessionId}/message?limit=200&order=asc`)
    check("GET /api/session/{id}/message → { data: [...] }", messages.status === 200 && Array.isArray(messages.json?.data))

    // ── Project kit discovery ───────────────────────────────────────────
    // Location services and config plugins settle asynchronously after the first
    // session, so poll briefly instead of racing the initial load.
    let agents = await req("GET", `/api/agent${locationQuery}`)
    let commands = await req("GET", `/api/command${locationQuery}`)
    let skills = await req("GET", `/api/skill${locationQuery}`)
    const agent = (id: string) => agents.json?.data?.find((item: any) => item.id === id)
    const command = (name: string) => commands.json?.data?.find((item: any) => item.name === name)
    const skill = (name: string) => skills.json?.data?.find((item: any) => item.name === name)
    const kitReady = () =>
      agent("screenwriter")?.description === "Writes scenes from .bradbit" &&
      command("scene")?.description === "Writes a scene from .bradbit" &&
      skill("write-scene")?.description === "Writes a scene from .bradbit" &&
      agent("legacy") !== undefined &&
      command("legacy-command") !== undefined &&
      skill("legacy-skill") !== undefined
    const kitDeadline = Date.now() + 10_000
    while (Date.now() < kitDeadline) {
      if (kitReady()) break
      await Bun.sleep(250)
      agents = await req("GET", `/api/agent${locationQuery}`)
      commands = await req("GET", `/api/command${locationQuery}`)
      skills = await req("GET", `/api/skill${locationQuery}`)
    }
    check(
      "GET /api/agent prefers .bradbit/agents/screenwriter.md",
      agents.status === 200 && agent("screenwriter")?.description === "Writes scenes from .bradbit",
      JSON.stringify(agents.json)?.slice(0, 200),
    )
    check(
      "GET /api/command prefers .bradbit/commands/scene.md",
      commands.status === 200 && command("scene")?.description === "Writes a scene from .bradbit",
      JSON.stringify(commands.json)?.slice(0, 200),
    )
    check(
      "GET /api/skill prefers .bradbit/skills/write-scene",
      skills.status === 200 && skill("write-scene")?.description === "Writes a scene from .bradbit",
      JSON.stringify(skills.json)?.slice(0, 200),
    )
    check(
      "GET /api/agent keeps .opencode legacy entries",
      agent("legacy") !== undefined,
      JSON.stringify(agents.json)?.slice(0, 200),
    )
    check(
      "GET /api/command keeps .opencode legacy entries",
      command("legacy-command") !== undefined,
      JSON.stringify(commands.json)?.slice(0, 200),
    )
    check(
      "GET /api/skill keeps .opencode legacy entries",
      skill("legacy-skill") !== undefined,
      JSON.stringify(skills.json)?.slice(0, 200),
    )

    // Live reload: the ConfigWatch plan must include `.bradbit` so edits are
    // observed without restarting the server.
    const reloadedAgent = join(workdir, ".bradbit/agents/reloaded.md")
    writeFileSync(
      reloadedAgent,
      "---\ndescription: Agente recargado\nmode: primary\n---\n\nAparece sin reiniciar el servidor.\n",
    )
    let reloaded = false
    const reloadDeadline = Date.now() + 10_000
    while (Date.now() < reloadDeadline) {
      const response = await req("GET", `/api/agent${locationQuery}`)
      if (response.json?.data?.some((item: any) => item.id === "reloaded")) {
        reloaded = true
        break
      }
      await Bun.sleep(250)
    }
    check("GET /api/agent reloads .bradbit additions live", reloaded)

    rmSync(reloadedAgent)
    let removed = false
    const removeDeadline = Date.now() + 10_000
    while (Date.now() < removeDeadline) {
      const response = await req("GET", `/api/agent${locationQuery}`)
      if (!response.json?.data?.some((item: any) => item.id === "reloaded")) {
        removed = true
        break
      }
      await Bun.sleep(250)
    }
    check("GET /api/agent reloads .bradbit deletions live", removed)

    const permissions = await req("GET", `/api/session/${sessionId}/permission`)
    check("GET /api/session/{id}/permission → { data: [...] }", permissions.status === 200 && Array.isArray(permissions.json?.data))

    const forms = await req("GET", `/api/session/${sessionId}/form`)
    check("GET /api/session/{id}/form → { data: [...] }", forms.status === 200 && Array.isArray(forms.json?.data))

    const interrupted = await req("POST", `/api/session/${sessionId}/interrupt`, {})
    check(
      "POST /api/session/{id}/interrupt → { interrupted: boolean }",
      interrupted.status === 200 && typeof interrupted.json?.interrupted === "boolean",
      JSON.stringify(interrupted.json)?.slice(0, 160),
    )

    const invalidSession = await req("GET", "/api/session/not-a-session/message")
    check("rejects a non ses_ session id", invalidSession.status >= 400 && invalidSession.status < 500, String(invalidSession.status))

    // ── Streaming ───────────────────────────────────────────────────────
    const stream = await fetch(base + "/api/event", {
      headers: { Authorization: authorization, Accept: "text/event-stream" },
    })
    check(
      "GET /api/event → 200 text/event-stream",
      stream.status === 200 && (stream.headers.get("content-type") ?? "").includes("text/event-stream"),
      `${stream.status} ${stream.headers.get("content-type")}`,
    )
    await stream.body?.cancel()

    // ── Provider-dependent endpoints must fail cleanly, never crash ─────
    const prompt = await req("POST", `/api/session/${sessionId}/prompt`, { text: "hola" })
    check(
      "POST /api/session/{id}/prompt responds without crashing (2xx/4xx + JSON or text)",
      prompt.status < 500 && (prompt.json !== null || prompt.text.length > 0),
      `${prompt.status} ${prompt.text.slice(0, 160)}`,
    )

    const alive = await req("GET", "/api/info")
    check("server stays alive after errors", alive.status === 200, String(alive.status))
  } finally {
    proc.kill()
    await proc.exited.catch(() => {})
  }

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length > 0) {
    console.error("\nFailures:\n" + failures.map((failure) => ` - ${failure}`).join("\n"))
    process.exit(1)
  }
}

await main()
