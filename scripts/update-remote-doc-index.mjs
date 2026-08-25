import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const configPath = path.join(repoRoot, "assets/site-config.json");
const outputPath = path.join(repoRoot, "assets/content/remote-docs-index.json");
// These are repository-management files, not website documentation.
const EXCLUDED_PATH_PREFIXES = [".github/", "recommended-papers/"];

async function readExistingPaths() {
  try {
    const raw = await readFile(outputPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.paths) ? parsed.paths : null;
  } catch {
    return null;
  }
}

function pathsEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

async function main() {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const sourceRepo = config?.sourceRepo;
  if (!sourceRepo?.owner || !sourceRepo?.repo || !sourceRepo?.branch) {
    throw new Error("assets/site-config.json is missing sourceRepo.owner/repo/branch");
  }

  const url = `https://api.github.com/repos/${sourceRepo.owner}/${sourceRepo.repo}/git/trees/${encodeURIComponent(sourceRepo.branch)}?recursive=1`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "LocoWiki.github.io remote doc index updater"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  const payload = await response.json();
  const paths = (Array.isArray(payload?.tree) ? payload.tree : [])
    .filter(
      (entry) =>
        entry?.type === "blob" &&
        /\.md$/i.test(entry?.path) &&
        !EXCLUDED_PATH_PREFIXES.some((prefix) => String(entry.path).startsWith(prefix))
    )
    .map((entry) => String(entry.path))
    .sort((left, right) => left.localeCompare(right, "zh-Hans-CN", { numeric: true, sensitivity: "base" }));

  const existingPaths = await readExistingPaths();
  if (pathsEqual(existingPaths, paths)) {
    console.log(`No changes to ${path.relative(repoRoot, outputPath)} (${paths.length} paths).`);
    return;
  }

  const output = {
    generatedAt: new Date().toISOString(),
    sourceRepo: {
      owner: sourceRepo.owner,
      repo: sourceRepo.repo,
      branch: sourceRepo.branch
    },
    paths
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Updated ${path.relative(repoRoot, outputPath)} with ${paths.length} markdown paths.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
