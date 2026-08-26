import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const configPath = path.join(repoRoot, "assets/site-config.json");
const outputPath = path.join(repoRoot, "assets/content/remote-docs-index.json");
// These are repository-management files, not website documentation.
const EXCLUDED_PATH_PREFIXES = [".github/", "recommended-papers/"];
const COLLECTION_PREFIXES = {
  docs: ["wiki/", "competition-rules/", "technical-sharing/", "scripts/"],
  papers: ["reading-list/"],
  "open-source": ["network-open-source/"]
};

async function readExistingIndex() {
  try {
    const raw = await readFile(outputPath, "utf8");
    return JSON.parse(raw);
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

  const collections = Object.fromEntries(
    Object.entries(COLLECTION_PREFIXES).map(([collection, prefixes]) => [
      collection,
      paths.filter((entryPath) => prefixes.some((prefix) => entryPath.startsWith(prefix)))
    ])
  );

  const existingIndex = await readExistingIndex();
  const collectionsUnchanged = Object.entries(collections).every(
    ([collection, collectionPaths]) => pathsEqual(existingIndex?.collections?.[collection], collectionPaths)
  );
  const indexedPaths = Object.values(collections).flat();
  if (existingIndex?.schemaVersion === 2 && collectionsUnchanged) {
    console.log(`No changes to ${path.relative(repoRoot, outputPath)} (${indexedPaths.length} indexed paths).`);
    return;
  }

  const output = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    sourceRepo: {
      owner: sourceRepo.owner,
      repo: sourceRepo.repo,
      branch: sourceRepo.branch
    },
    collections
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Updated ${path.relative(repoRoot, outputPath)} with ${indexedPaths.length} indexed Markdown paths.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
