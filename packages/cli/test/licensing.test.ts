import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "bun:test";
import { kits } from "../src/kit/kits.generated";

const root = fileURLToPath(new URL("../../../", import.meta.url));

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function localLinks(markdown: string): string[] {
  const links: string[] = [];
  const pattern = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(pattern)) {
    const target = match[1].trim();
    if (
      target.startsWith("http://") ||
      target.startsWith("https://") ||
      target.startsWith("mailto:") ||
      target.startsWith("#")
    ) {
      continue;
    }
    links.push(target.split("#")[0]);
  }
  return links;
}

describe("licenses and third-party notices (T-3.6.3)", () => {
  it("keeps the upstream MIT license, the Bradbit notice and the package licenses", () => {
    expect(read("LICENSE")).toContain("MIT License");
    expect(read("LICENSE")).toContain("Copyright (c) 2025 opencode");
    expect(read("NOTICE")).toContain("Copyright (c) 2026 Akolormedia / Rafael Olivares");
    expect(read("NOTICE")).toContain("THIRD_PARTY_NOTICES.md");

    const rootPackage = JSON.parse(read("package.json")) as { license?: string };
    const cliPackage = JSON.parse(read("packages/cli/package.json")) as {
      license?: string;
    };
    expect(rootPackage.license).toBe("MIT");
    expect(cliPackage.license).toBe("MIT");
  });

  it("documents OpenTUI and the LGPL FFmpeg build, with source and build details", () => {
    const notices = read("THIRD_PARTY_NOTICES.md");
    expect(notices).toContain("OpenTUI 0.8.1");
    expect(notices).toContain("FFmpeg 9.0.2");
    expect(notices).toContain("LGPL-2.1-or-later");
    expect(notices).toContain("https://github.com/sst/opentui");
    expect(notices).toContain("https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz");
    expect(notices).toContain("sharp");

    for (const file of [
      "licenses/LGPL-2.1.txt",
      "licenses/opentui/LICENSE",
      "licenses/opentui/LICENSE-FFMPEG",
      "licenses/opentui/FFMPEG-SOURCE.md",
      "licenses/opentui/LICENSE-LIBWEBP",
      "licenses/opentui/LICENSE-LCMS2",
      "licenses/opentui/LICENSE-GHOSTTY",
      "licenses/opentui/LICENSE-ZLIB",
      "licenses/opentui/LICENSE-STB",
      "licenses/opentui/LICENSE-WUFFS",
      "licenses/README.md",
    ]) {
      expect(existsSync(path.join(root, file)), `missing ${file}`).toBe(true);
      expect(read(file).trim().length, `empty ${file}`).toBeGreaterThan(0);
    }

    expect(read("licenses/opentui/FFMPEG-SOURCE.md")).toContain("ffmpeg-9.0.2");
    expect(read("licenses/opentui/LICENSE-FFMPEG")).toContain(
      "GNU LESSER GENERAL PUBLIC LICENSE",
    );
  });

  it("embeds the MIT license and README in every kit snapshot", () => {
    for (const id of ["guionista-kit", "libro-kit", "campaign-kit"]) {
      const kit = kits[id];
      expect(kit, id).toBeDefined();
      expect(kit.license).toBe("MIT");
      expect(kit.files.LICENSE).toContain("MIT License");
      expect(kit.files["README.md"]).toContain("## License");
      expect(kit.files["README.md"]).toContain("MIT");
      expect(kit.contents).toEqual(
        expect.arrayContaining(["README.md", "LICENSE"]),
      );
    }
  });

  it("has a product README with License and Documentation sections", () => {
    const readme = read("README.md");
    expect(readme).toContain("## Documentation");
    expect(readme).toContain("## License");
    expect(readme).toContain("MIT licensed");
    expect(readme).toContain("[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)");
  });

  it("does not contain broken local links in the license docs", () => {
    for (const file of ["README.md", "THIRD_PARTY_NOTICES.md", "licenses/README.md"]) {
      const markdown = read(file);
      for (const link of localLinks(markdown)) {
        const target = path.resolve(path.dirname(path.join(root, file)), link);
        expect(existsSync(target), `${file}: missing ${link}`).toBe(true);
      }
    }
  });
});
