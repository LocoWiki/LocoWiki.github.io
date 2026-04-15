#!/usr/bin/env node

import { promises as fs } from "node:fs";
import { basename, dirname, extname, resolve, relative, sep, posix } from "node:path";

function parseArgs(argv) {
  const options = {
    repoRoot: process.cwd(),
    wikiDir: "wiki",
    out: null,
    entry: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--repo-root") options.repoRoot = argv[++i];
    else if (arg === "--wiki-dir") options.wikiDir = argv[++i];
    else if (arg === "--out") options.out = argv[++i];
    else if (arg === "--entry") options.entry = argv[++i];
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function toPosixPath(value) {
  return String(value).split(sep).join(posix.sep);
}

function stripMarkdownInline(text) {
  return String(text)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\\([\\`*_{}\[\]()#+\-.!])/g, "$1")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x20;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackTitleFromPath(path) {
  return basename(path, extname(path)).trim();
}

function extractTitle(markdown, fallbackTitle) {
  const headingMatch = markdown.match(/^#\s+(.+?)\s*#*\s*$/m);
  if (!headingMatch) return fallbackTitle;
  const title = stripMarkdownInline(headingMatch[1]);
  return title || fallbackTitle;
}

function countSecondaryHeadings(markdown) {
  const matches = markdown.match(/^##\s+.+$/gm);
  return matches ? matches.length : 0;
}

async function walkMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(fullPath)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (extname(entry.name).toLowerCase() !== ".md") continue;
    files.push(fullPath);
  }

  return files;
}

function printHelp() {
  console.log(`Usage:
  node scripts/generate-wiki-manifest.mjs [--repo-root /path/to/repo] [--wiki-dir wiki] [--out wiki/_manifest.json] [--entry wiki/README.md]

Description:
  Scan Markdown files under the wiki directory and generate wiki/_manifest.json for the docs frontend.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const repoRoot = resolve(options.repoRoot);
  const wikiDir = toPosixPath(options.wikiDir || "wiki").replace(/^\/+|\/+$/g, "");
  const wikiRoot = resolve(repoRoot, wikiDir);
  const outPath = resolve(repoRoot, options.out || posix.join(wikiDir, "_manifest.json"));

  const markdownFiles = await walkMarkdownFiles(wikiRoot);
  const manifestFiles = markdownFiles
    .map((file) => {
      const relPath = toPosixPath(relative(repoRoot, file));
      return { file, relPath };
    })
    .filter(({ relPath }) => relPath !== toPosixPath(relative(repoRoot, outPath)))
    .sort((a, b) => a.relPath.localeCompare(b.relPath, "zh-Hans-CN"));

  const entryDocPath =
    options.entry && options.entry.trim()
      ? toPosixPath(options.entry.trim()).replace(/^\/+/, "")
      : manifestFiles[0]?.relPath || "";

  const prioritizedFiles = manifestFiles.slice().sort((a, b) => {
    const aRank = a.relPath === entryDocPath ? 0 : 1;
    const bRank = b.relPath === entryDocPath ? 0 : 1;
    if (aRank !== bRank) return aRank - bRank;
    return a.relPath.localeCompare(b.relPath, "zh-Hans-CN");
  });

  const items = [];
  for (const [index, item] of prioritizedFiles.entries()) {
    const content = await fs.readFile(item.file, "utf8");
    const headingCount = countSecondaryHeadings(content);
    items.push({
      title: extractTitle(content, fallbackTitleFromPath(item.relPath)),
      path: item.relPath,
      order: index,
      hasChildren: headingCount > 0,
      headingCount,
    });
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    root: wikiDir,
    entryDocPath: items.find((item) => item.path === entryDocPath)?.path || items[0]?.path || "",
    items,
  };

  await fs.mkdir(dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`Generated ${toPosixPath(relative(repoRoot, outPath))} with ${items.length} item(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
；同时把 quickstart.html 独