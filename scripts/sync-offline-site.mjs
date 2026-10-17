#!/usr/bin/env node
/**
 * Copies the static site snapshot used as the app's last-resort offline bundle.
 *
 * Usage: node scripts/sync-offline-site.mjs <destination>
 */
import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const destinationArg = process.argv[2];

if (!destinationArg) {
  console.error("usage: node scripts/sync-offline-site.mjs <destination>");
  process.exit(1);
}

const destination = path.resolve(repoRoot, destinationArg);
const excludedDirectories = new Set([".git", ".github", ".vscode", "node_modules", "apps", "scripts", "site-docs", "test-results"]);

const rootEntries = await readdir(repoRoot, { withFileTypes: true });
const htmlFiles = rootEntries
  .filter((entry) => entry.isFile() && /\.html?$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort();

let commit = "unknown";
try {
  commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
} catch {
  // The snapshot can also be produced from a source archive without git metadata.
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

for (const file of htmlFiles) {
  await cp(path.join(repoRoot, file), path.join(destination, file));
}

await cp(path.join(repoRoot, "assets"), path.join(destination, "assets"), {
  recursive: true,
  filter: (source) => {
    const relative = path.relative(repoRoot, source);
    const [first] = relative.split(path.sep);
    return !excludedDirectories.has(first);
  },
});

await writeFile(
  path.join(destination, "snapshot.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceCommit: commit,
      htmlFiles,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

console.log(`Offline snapshot written to ${path.relative(repoRoot, destination)} (${htmlFiles.length} pages, commit ${commit}).`);
