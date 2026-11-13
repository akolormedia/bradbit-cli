# Bradbit CLI

`bradbit` is the agent runtime for [Bradbit Editor](https://github.com/akolormedia/bradbit-editor):
a fork of **OpenCode** prepared for creative writing projects (`.md`, `.mdx`, `.fountain`, `.txt`)
and for writers who should not need to learn a developer terminal.

> **Alpha** · macOS binaries are published as [pre-releases](https://github.com/akolormedia/bradbit-cli/releases).
> The CLI keeps the `opencode serve` protocol as a drop-in contract for the editor.

## Quick start

```bash
# Create a project from an embedded kit and initialize Git
bradbit init mi-serie --kit guionista-kit
bradbit init mi-novela --kit libro-kit
bradbit init mi-campana --kit campaign-kit

# Connect your own provider key (stored by the CLI)
bradbit auth login

# Start the HTTP/SSE server used by Bradbit Editor
bradbit serve --hostname 127.0.0.1 --port 4096

# Or run a one-shot prompt
bradbit run "Dame tres ideas para el episodio 2"
```

## What is different from OpenCode

- The binary and visible command are **`bradbit`**.
- `bradbit init <destino>` creates a writing kit project (default `guionista-kit`; `--kit` selects `campaign-kit` or `libro-kit`) and runs `git init`.
- Writing defaults live in [`DEFAULTS.md`](DEFAULTS.md): generic text/file tools, no LSP runtime
  started by default, and writing capabilities in the project's `.bradbit/` kit (`.opencode/` is legacy-compatible).
- BYOK and custom OpenAI-compatible providers are documented in [`BYOK.md`](BYOK.md).
- The editor consumes the frozen HTTP/SSE surface in [`CONTRACT.md`](CONTRACT.md).

Upstream, attribution and sync instructions are in [`UPSTREAM.md`](UPSTREAM.md), [`NOTICE`](NOTICE)
and [`LICENSE`](LICENSE).

## Requirements

- macOS (the alpha distributes Apple Silicon and Intel binaries).
- [Bun](https://bun.sh) to build from source.
- Git for `bradbit init` and the versions workflow.

## Install a release

Download `bradbit-darwin-arm64` or `bradbit-darwin-x64` from the
[releases page](https://github.com/akolormedia/bradbit-cli/releases), make it executable and put it
on your `PATH`:

```bash
chmod +x bradbit-darwin-arm64
mv bradbit-darwin-arm64 ~/.local/bin/bradbit
bradbit --version
```

The binaries are not signed or notarized. On first launch, macOS may require right-click → **Open**.

## Develop

```bash
bun install
bun run check

# Build a local macOS binary
OPENCODE_TARGET=darwin-arm64 bun run --cwd packages/cli script/build.ts --skip-web-ui --outdir=dist/review

# Contract suites
BRADBIT_BIN="$PWD/packages/cli/dist/review/cli-darwin-arm64/bin/bradbit" \
  bun run packages/cli/test/contract/serve-contract.ts
BRADBIT_BIN="$PWD/packages/cli/dist/review/cli-darwin-arm64/bin/bradbit" \
  bun run packages/cli/test/contract/byok-contract.ts
```

The pinned upstream version and rebase checklist are in [`UPSTREAM.md`](UPSTREAM.md).

## Upstream and license

Bradbit CLI is a fork of [OpenCode](https://github.com/anomalyco/opencode), MIT licensed.
The original copyright and license remain in [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
It is not built by or affiliated with the OpenCode team.
