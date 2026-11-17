# Third-party notices

**Bradbit CLI** is distributed under the **MIT license**. The original OpenCode copyright and license remain in [`LICENSE`](LICENSE); the Bradbit changes and attribution are in [`NOTICE`](NOTICE).

The full license texts referenced here are in [`licenses/`](licenses/).

## OpenCode upstream

- **Upstream:** <https://github.com/anomalyco/opencode>
- **Copyright:** 2025 opencode and contributors.
- **License:** MIT. Full text: [`LICENSE`](LICENSE).
- **Bradbit changes:** copyright 2026 Akolormedia / Rafael Olivares, MIT.

## OpenTUI and FFmpeg (LGPL-2.1-or-later)

The CLI bundles **OpenTUI 0.8.1** (MIT) and a minimal, decode-only **FFmpeg 9.0.2** build under **LGPL-2.1-or-later**. FFmpeg is integrated through OpenTUI; GPL and nonfree components are disabled.

- **OpenTUI license:** [`licenses/opentui/LICENSE`](licenses/opentui/LICENSE) (MIT).
- **FFmpeg license:** [`licenses/LGPL-2.1.txt`](licenses/LGPL-2.1.txt).
- **FFmpeg source and build details:** [`licenses/opentui/FFMPEG-SOURCE.md`](licenses/opentui/FFMPEG-SOURCE.md).
- **OpenTUI source:** <https://github.com/sst/opentui>.
- **FFmpeg source:** <https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz>.

FFmpeg is **unmodified**. The OpenTUI source, its build script and the pinned FFmpeg source provide what is needed to rebuild and relink `libopentui` with a modified FFmpeg.

The OpenTUI distribution also includes the following components; their notices are in `licenses/opentui/`:

| Component | License | Notice |
|---|---|---|
| libwebp | BSD-3-Clause | `LICENSE-LIBWEBP`, `AUTHORS-LIBWEBP`, `PATENTS-LIBWEBP` |
| LittleCMS (lcms2) | MIT | `LICENSE-LCMS2` |
| Ghostty | MIT | `LICENSE-GHOSTTY` |
| zlib | Zlib | `LICENSE-ZLIB` |
| stb | MIT | `LICENSE-STB` |
| Wuffs | Apache-2.0 | `LICENSE-WUFFS` |
| Bun runtime | MIT | <https://github.com/oven-sh/bun/blob/main/LICENSE.md> |

## Other dependencies

The CLI is built with TypeScript, Bun and the packages listed in [`bun.lock`](bun.lock) and the workspace `package.json` files. The production packages are permissively licensed (MIT, Apache-2.0, BSD, ISC); the full dependency graph is in the lockfile. The main runtime components are:

- **Bun** — MIT.
- **@opentui/core**, **@opentui/solid** — MIT.
- **@agentclientprotocol/sdk** — Apache-2.0.
- **Effect** and related packages — MIT.
- **SolidJS** — MIT.

`sharp`/`libvips` (LGPL) appears in the full development `node_modules` tree but is **not** a production dependency of `packages/cli`; it is not part of the sidecar binary. If that changes, this notice and the release checks must be updated.

## Source and releases

- Bradbit CLI source: <https://github.com/akolormedia/bradbit-cli>.
- OpenCode upstream: <https://github.com/anomalyco/opencode>.
- Releases: <https://github.com/akolormedia/bradbit-cli/releases>.

The CLI is not built by or affiliated with the OpenCode team.

## No warranty

The third-party components are provided under their respective licenses, without warranty. Bradbit's MIT license applies only to Bradbit's original code and modifications; it does not override the terms of the third-party licenses listed here.
