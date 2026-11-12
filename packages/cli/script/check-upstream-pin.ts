#!/usr/bin/env bun
/**
 * Validates the recorded upstream pin and warns when upstream dev has moved.
 *
 * This intentionally does not fetch upstream history: shallow CI checkouts stay
 * fast, and the pin is verified against CONTRACT.md and the local history when
 * the commit object is available.
 */

import { readFile } from "node:fs/promises"
import path from "node:path"

const root = path.resolve(import.meta.dir, "../../..")
const pin = await Bun.file(path.join(root, "upstream.json")).json().catch((error) => {
  console.error(`Could not read upstream.json: ${error}`)
  process.exit(1)
})

const required = ["repository", "branch", "version", "commit", "pinnedAt"] as const
for (const key of required) {
  if (typeof pin[key] !== "string" || pin[key].length === 0) {
    console.error(`upstream.json: missing or invalid "${key}"`)
    process.exit(1)
  }
}
if (!/^[0-9a-f]{40}$/.test(pin.commit)) {
  console.error(`upstream.json: commit must be a 40-character SHA, got ${pin.commit}`)
  process.exit(1)
}

const contract = await readFile(path.join(root, "CONTRACT.md"), "utf8").catch(() => "")
if (!contract.includes(pin.commit)) {
  console.error(`CONTRACT.md does not mention the pinned commit ${pin.commit}`)
  process.exit(1)
}
console.log(`pin ok: ${pin.repository} ${pin.branch} ${pin.version} ${pin.commit}`)

const local = Bun.spawnSync({
  cmd: ["git", "cat-file", "-e", `${pin.commit}^{commit}`],
  cwd: root,
  stdout: "pipe",
  stderr: "pipe",
})
if (local.exitCode === 0) {
  const ancestor = Bun.spawnSync({
    cmd: ["git", "merge-base", "--is-ancestor", pin.commit, "HEAD"],
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  })
  if (ancestor.exitCode !== 0) {
    console.error(`pinned commit ${pin.commit} is not an ancestor of HEAD`)
    process.exit(1)
  }
  console.log("local history contains the pin")
} else {
  console.log("pinned commit is not in this shallow checkout; skipping ancestor check")
}

const remote = Bun.spawnSync({
  cmd: ["git", "ls-remote", "--heads", `https://github.com/${pin.repository}.git`, pin.branch],
  cwd: root,
  stdout: "pipe",
  stderr: "pipe",
})
if (remote.exitCode === 0) {
  const head = remote.stdout.toString().trim().split(/\s+/)[0] ?? ""
  if (head && head !== pin.commit) {
    console.warn(`upstream ${pin.branch} has moved to ${head}; plan a rebase (pin: ${pin.commit})`)
  } else {
    console.log(`upstream ${pin.branch} still points at the pin`)
  }
} else {
  console.warn("could not reach upstream; skipping divergence check")
}
