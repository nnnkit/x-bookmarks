import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const distDir = resolve(rootDir, "dist");
const manifestPath = resolve(distDir, "manifest.json");

if (!existsSync(distDir) || !existsSync(manifestPath)) {
  console.error(
    "Missing dist build output. Run `pnpm build` before packaging the extension ZIP."
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const version = manifest.version;

if (!version) {
  console.error("Could not find `version` in dist/manifest.json.");
  process.exit(1);
}

const releaseDir = resolve(rootDir, "release");
const zipName = `x-bookmarks-tab-v${version}.zip`;
const zipPath = resolve(releaseDir, zipName);

mkdirSync(releaseDir, { recursive: true });

if (existsSync(zipPath)) {
  rmSync(zipPath);
}

const zipResult = spawnSync("zip", ["-r", "-q", zipPath, "."], {
  cwd: distDir,
  stdio: "inherit",
});

if (zipResult.error) {
  console.error(
    "Failed to run `zip`. Ensure `zip` is installed in your environment.",
    zipResult.error.message
  );
  process.exit(1);
}

if (zipResult.status !== 0) {
  process.exit(zipResult.status ?? 1);
}

console.log(`Created ${zipPath}`);
