<p align="center">
  <img src="assets/bradbit-mark.svg" width="76" height="76" alt="Bradbit" />
</p>

<h1 align="center">Bradbit CLI</h1>

<p align="center">
  The agent runtime behind Bradbit Editor.
</p>

<p align="center">
  <a href="https://github.com/akolormedia/bradbit-cli/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/akolormedia/bradbit-cli?include_prereleases&label=release" /></a>
  <img alt="Alpha" src="https://img.shields.io/badge/status-alpha-orange" />
  <img alt="MIT" src="https://img.shields.io/badge/license-MIT-green" />
  <a href="https://github.com/akolormedia/bradbit-cli/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/akolormedia/bradbit-cli/actions/workflows/ci.yml/badge.svg?branch=dev" /></a>
</p>

**Bradbit CLI** is the local agent runtime for [Bradbit Editor](https://github.com/akolormedia/bradbit-editor): a fork of [OpenCode](https://github.com/anomalyco/opencode) adapted for creative writing projects (`.md`, `.mdx`, `.fountain`, `.txt`) and for writers who should not need to learn a developer terminal.

> **Alpha** · macOS builds are published as [pre-releases](https://github.com/akolormedia/bradbit-cli/releases). Bradbit Editor bundles the runtime as a sidecar; you do **not** need to install the CLI separately to use the app.

The CLI keeps the OpenCode `serve` protocol as the editor contract. It is a separate program: its licenses do not change the MIT license of the editor.

## What it does

- Runs the agent session used by the editor's chat panel, including streaming responses, tool calls and permission prompts.
- Discovers the project's `.bradbit/` agents, commands and skills (`.opencode/` remains legacy-compatible).
- Creates writing projects from the three bundled kits: Screenwriting, Novel and Advertising campaigns.
- Connects to DeepSeek, OpenRouter, OpenAI, Anthropic, OpenCode or a custom OpenAI-compatible endpoint with BYOK.
- Exposes the HTTP/SSE server consumed by Bradbit Editor, plus a one-shot prompt mode and a terminal UI.

## Quick start

```bash
# Create a project from an embedded kit and initialize Git
bradbit init my-series --kit guionista-kit
bradbit init my-novel --kit libro-kit
bradbit init my-campaign --kit campaign-kit

# Connect your own provider key (stored by the CLI)
bradbit auth login

# Start the HTTP/SSE server used by Bradbit Editor
bradbit serve --hostname 127.0.0.1 --port 4096

# Or run a one-shot prompt
bradbit run "Give me three ideas for episode 2"
```

`guionista-kit` is the default when `--kit` is omitted.

## What is different from OpenCode

- The binary and visible command are **`bradbit`**.
- `bradbit init <destination>` creates a writing-kit project and runs `git init`.
- Writing defaults live in [`DEFAULTS.md`](DEFAULTS.md): generic text/file tools, no LSP runtime started by default, and writing capabilities in the project's `.bradbit/` kit.
- BYOK and custom OpenAI-compatible providers are documented in [`BYOK.md`](BYOK.md).
- The editor consumes the frozen HTTP/SSE surface in [`CONTRACT.md`](CONTRACT.md).
- The three kit snapshots are generated from the kit repositories with [`packages/cli/script/sync-kits.ts`](packages/cli/script/sync-kits.ts).

Upstream attribution and sync instructions are in [`UPSTREAM.md`](UPSTREAM.md), [`NOTICE`](NOTICE) and [`LICENSE`](LICENSE).

## Requirements

- **macOS** for the alpha binaries (Apple Silicon and Intel).
- [Bun](https://bun.sh) to build from source.
- **Git** for the standalone CLI's `bradbit init` and version workflow. The editor itself uses libgit2 and does not require Git or Command Line Tools.

## Install a release

Download `bradbit-darwin-arm64` or `bradbit-darwin-x64` from the [releases page](https://github.com/akolormedia/bradbit-cli/releases), make it executable and put it on your `PATH`:

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

Regenerate the embedded kit snapshots after changing a kit:

```bash
cd packages/cli
bun run script/sync-kits.ts \
  ../../../guionista-kit ../../../campaign-kit ../../../libro-kit
```

The pinned upstream version and rebase checklist are in [`UPSTREAM.md`](UPSTREAM.md).

## Architecture

- **Bun + TypeScript** runtime, packaged as a single `bradbit` sidecar.
- **HTTP/SSE server** consumed by the editor; the frozen surface is in [`CONTRACT.md`](CONTRACT.md).
- **Session and tool loop** with explicit permissions, interactive questions and streaming output.
- **Project kits** discovered from `.bradbit/`; `.opencode/` is supported as a legacy path.
- **Provider layer** with BYOK and OpenAI-compatible endpoints; keys are supplied by the app or the CLI, never written to the project by the editor.

## Documentation

- [Bradbit Editor](https://github.com/akolormedia/bradbit-editor) and its [installation guide](https://github.com/akolormedia/bradbit-editor/blob/main/docs/INSTALL.md).
- [Defaults](DEFAULTS.md) · [BYOK](BYOK.md) · [Editor contract](CONTRACT.md) · [Upstream](UPSTREAM.md).
- Public site and docs: **`bradbit.io/docs`** (coming with the beta; the URL will be the canonical documentation home).

## Contributing

Issues and pull requests are welcome. Keep the editor contract stable and additive; new writing-specific behavior belongs in a kit, not in the core CLI. Include tests with any change to the session, tools, providers or contract.

## License

Bradbit CLI is **MIT licensed**. The original OpenCode copyright and license remain in [`LICENSE`](LICENSE); the Bradbit changes and attribution are in [`NOTICE`](NOTICE).

The CLI bundles third-party components under their own licenses, including **OpenTUI** (MIT) and a minimal **FFmpeg** build under **LGPL-2.1-or-later**. The complete notices, license texts, source links and FFmpeg build details are in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and [`licenses/`](licenses/).

Bradbit CLI is not built by or affiliated with the OpenCode team. Bradbit and the Bradbit mark are trademarks of Akolormedia.
