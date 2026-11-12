#!/usr/bin/env bun
/**
 * BYOK contract for `bradbit serve` (T-3.1.5).
 *
 * Freezes the integration path the editor uses for bring-your-own-key:
 * a custom OpenAI-compatible provider configured by config content, with its
 * key injected through an environment variable and never written to disk.
 *
 * Usage:
 *   BRADBIT_BIN=/path/to/bradbit bun run packages/cli/test/contract/byok-contract.ts
 */

import { spawn } from "bun"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createServer } from "node:net"

const BIN = process.env.BRADBIT_BIN
if (!BIN) {
  console.error("BRADBIT_BIN is required (absolute path to the bradbit binary)")
  process.exit(2)
}

const SECRET = "bradbit-test-secret-should-never-appear"
const PROVIDER = "bradbit-test"
const ENV_NAME = "BRADBIT_TEST_API_KEY"

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
  const port = await freePort()
  const workdir = mkdtempSync(join(tmpdir(), "bradbit-byok-contract-"))
  const config = {
    providers: {
      [PROVIDER]: {
        name: "Bradbit Test",
        package: "@opencode/ai/providers/openai-compatible",
        env: [ENV_NAME],
        settings: { baseURL: "http://127.0.0.1:1/v1" },
        models: {
          "test-chat": {
            name: "Test Chat",
            modelID: "test-chat",
            type: "chat",
          },
        },
      },
    },
  }

  const proc = spawn({
    cmd: [BIN!, "serve", "--hostname", "127.0.0.1", "--port", String(port)],
    cwd: workdir,
    env: {
      ...process.env,
      OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
      [ENV_NAME]: SECRET,
    },
    stdout: "pipe",
    stderr: "pipe",
  })

  let output = ""
  let errors = ""
  const decoder = new TextDecoder()
  void (async () => {
    try {
      for await (const chunk of proc.stdout) output += decoder.decode(chunk)
    } catch {}
  })()
  void (async () => {
    try {
      for await (const chunk of proc.stderr) errors += decoder.decode(chunk)
    } catch {}
  })()

  const deadline = Date.now() + 20_000
  while (Date.now() < deadline && !/server password (\S+)/.test(output)) {
    await Bun.sleep(100)
  }

  const password = output.match(/server password (\S+)/)?.[1] ?? ""
  const base = `http://127.0.0.1:${port}`
  const authorization = `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`
  const location = `?location[directory]=${encodeURIComponent(workdir)}`

  const req = async (method: string, path: string, body?: unknown) => {
    const response = await fetch(base + path + location, {
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
    check("announces the server password", password.length > 0, output.slice(0, 200))
    const created = await req("POST", "/api/session", { title: "BYOK" })
    check("creates a session in the configured location", created.status === 200, String(created.status))

    let provider: any = null
    const providerDeadline = Date.now() + 10_000
    while (Date.now() < providerDeadline) {
      const response = await req("GET", `/api/provider/${PROVIDER}`)
      if (response.status === 200 && response.json?.data?.id === PROVIDER) {
        provider = response.json.data
        break
      }
      await Bun.sleep(250)
    }
    check(
      "discovers the custom OpenAI-compatible provider",
      provider?.id === PROVIDER,
      JSON.stringify(provider)?.slice(0, 200),
    )
    check(
      "preserves the provider baseURL",
      provider?.settings?.baseURL === "http://127.0.0.1:1/v1",
      JSON.stringify(provider?.settings)?.slice(0, 200),
    )

    const integration = await req("GET", `/api/integration/${PROVIDER}`)
    check(
      "reports the environment credential as an env connection",
      integration.status === 200 &&
        Array.isArray(integration.json?.data?.connections) &&
        integration.json.data.connections.some(
          (connection: any) => connection.type === "env" && connection.name === ENV_NAME,
        ),
      JSON.stringify(integration.json)?.slice(0, 300),
    )

    check(
      "never prints the injected secret in server output",
      !output.includes(SECRET) && !errors.includes(SECRET),
      "secret found in stdout/stderr",
    )
    const alive = await req("GET", "/api/info")
    check("server stays alive after the BYOK setup", alive.status === 200, String(alive.status))
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
