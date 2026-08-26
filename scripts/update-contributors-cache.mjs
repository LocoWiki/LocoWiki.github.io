import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const configPath = path.join(repoRoot, "assets/site-config.json");
const outputPath = path.join(repoRoot, "assets/content/contributors-cache.json");
const pageSize = 100;
const maxPages = 10;

async function readExisting() {
  try {
    return JSON.parse(await readFile(outputPath, "utf8"));
  } catch {
    return null;
  }
}

function normalizeRows(rows) {
  return rows
    .filter((row) => row && typeof row.login === "string" && typeof row.html_url === "string")
    .map((row) => ({
      login: row.login,
      avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : "",
      html_url: row.html_url,
      contributions: Number.isFinite(row.contributions) ? row.contributions : 0,
      type: typeof row.type === "string" ? row.type : "User"
    }))
    .sort((left, right) => right.contributions - left.contributions || left.login.localeCompare(right.login));
}

async function main() {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const sourceRepo = config?.sourceRepo;
  if (!sourceRepo?.owner || !sourceRepo?.repo) throw new Error("sourceRepo.owner/repo is missing");

  const all = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const url = `https://api.github.com/repos/${encodeURIComponent(sourceRepo.owner)}/${encodeURIComponent(sourceRepo.repo)}/contributors?per_page=${pageSize}&page=${page}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
        "User-Agent": "LocoWiki contributor cache updater"
      }
    });
    if (!response.ok) throw new Error(`GitHub API returned HTTP ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("Unexpected GitHub API response format");
    all.push(...rows);
    if (rows.length < pageSize) break;
  }

  const contributors = normalizeRows(all);
  const existing = await readExisting();
  const existingRows = JSON.stringify(existing?.contributors || []);
  const nextRows = JSON.stringify(contributors);
  if (existing?.schemaVersion === 1 && existing?.sourceRepo?.owner === sourceRepo.owner && existing?.sourceRepo?.repo === sourceRepo.repo && existingRows === nextRows) {
    console.log(`No changes to ${path.relative(repoRoot, outputPath)} (${contributors.length} contributors).`);
    return;
  }

  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceRepo: { owner: sourceRepo.owner, repo: sourceRepo.repo },
    contributors
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Updated ${path.relative(repoRoot, outputPath)} with ${contributors.length} contributors.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
