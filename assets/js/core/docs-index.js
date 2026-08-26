import { getDocCollectionForPath, getDocShellForPath } from "./docs-routing.js";
import { getLocalizedList, getLocalizedValue, safeDecode } from "./utils.js";

const REMOTE_DOC_INDEX_URL = "assets/content/remote-docs-index.json";

let remoteMarkdownPaths = null;
let remoteIndexPromise = null;

function isMarkdownPath(path) {
  return /\.md$/i.test(String(path || "").trim());
}

function prettifyLabel(value) {
  return safeDecode(String(value || "").trim()).replace(/[_-]+/g, " ").trim();
}

function getFallbackDocTitle(path) {
  const segments = String(path || "").split("/").filter(Boolean);
  const filename = segments[segments.length - 1] || "";
  if (/^readme\.md$/i.test(filename) && segments.length > 1) return prettifyLabel(segments[segments.length - 2]);
  return prettifyLabel(filename.replace(/\.md$/i, ""));
}

function collectDocTitleOverrides(config, lang, collection) {
  const priority = new Map();
  const titles = new Map();
  let order = 0;

  getLocalizedList(config?.sidebar, lang).forEach((group) => {
    getLocalizedList(group?.items, lang).forEach((item) => {
      const path = getLocalizedValue(item?.path, lang);
      const title = getLocalizedValue(item?.title, lang);
      const itemCollection = group?.collection || getDocCollectionForPath(path);
      if (!path || !title || itemCollection !== collection) return;
      titles.set(path, title);
      priority.set(path, order++);
    });
  });

  return { titles, priority };
}

function createFolderNode(title) {
  return { kind: "folder", title, items: [] };
}

function createDocNode(path, title) {
  return { kind: "doc", path, title };
}

function sortTree(items, priority, locale) {
  items.sort((left, right) => {
    const leftPriority = left.kind === "doc" && priority.has(left.path) ? priority.get(left.path) : Number.POSITIVE_INFINITY;
    const rightPriority = right.kind === "doc" && priority.has(right.path) ? priority.get(right.path) : Number.POSITIVE_INFINITY;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;

    const leftIsReadme = left.kind === "doc" && /(?:^|\/)README\.md$/i.test(left.path);
    const rightIsReadme = right.kind === "doc" && /(?:^|\/)README\.md$/i.test(right.path);
    if (leftIsReadme !== rightIsReadme) return leftIsReadme ? -1 : 1;
    return left.title.localeCompare(right.title, locale, { numeric: true, sensitivity: "base" });
  });
  items.forEach((item) => {
    if (item.kind === "folder") sortTree(item.items, priority, locale);
  });
}

function selectLocalizedPaths(paths, lang) {
  const pathSet = new Set(paths);
  return paths.filter((path) => {
    if (/\.en\.md$/i.test(path)) {
      return lang === "en" || !pathSet.has(path.replace(/\.en\.md$/i, ".md"));
    }
    return lang !== "en" || !pathSet.has(path.replace(/\.md$/i, ".en.md"));
  });
}

function getCollectionRelativePath(path, collection) {
  if (collection === "docs") {
    if (path.startsWith("wiki/")) return path.slice("wiki/".length);
    return path.slice(path.indexOf("/") + 1);
  }
  if (collection === "papers") return path.slice("reading-list/".length);
  if (collection === "open-source") return path.slice("network-open-source/".length);
  return path;
}

function buildRemoteDocsTree(paths, lang, overrides, collection) {
  const locale = lang === "en" ? "en" : "zh-Hans-CN";
  const root = createFolderNode("");
  const folderMap = new Map([["", root]]);

  selectLocalizedPaths(paths.filter(isMarkdownPath), lang).forEach((path) => {
    const segments = getCollectionRelativePath(path, collection).split("/").filter(Boolean);
    if (!segments.length) return;
    segments.pop();

    let parent = root;
    let folderKey = "";
    segments.forEach((segment) => {
      folderKey = folderKey ? `${folderKey}/${segment}` : segment;
      let folder = folderMap.get(folderKey);
      if (!folder) {
        folder = createFolderNode(prettifyLabel(segment));
        folderMap.set(folderKey, folder);
        parent.items.push(folder);
      }
      parent = folder;
    });
    parent.items.push(createDocNode(path, overrides.titles.get(path) || getFallbackDocTitle(path)));
  });

  sortTree(root.items, overrides.priority, locale);
  return root.items;
}

function containsShellItem(item, shell) {
  if (item?.kind === "doc") return getDocShellForPath(item.path) === shell;
  if (Array.isArray(item?.items)) return item.items.some((child) => containsShellItem(child, shell));
  return Boolean(item?.path) && getDocShellForPath(item.path) === shell;
}

const COLLECTION_SHELLS = {
  docs: "docs",
  papers: "papers",
  "open-source": "open-source"
};

function readIndexedPaths(payload) {
  const collections = payload?.collections;
  if (collections && typeof collections === "object") {
    return Object.values(collections).flatMap((paths) => (Array.isArray(paths) ? paths : []));
  }
  return Array.isArray(payload?.paths) ? payload.paths : [];
}

export async function preloadRemoteDocIndex(config) {
  if (remoteMarkdownPaths || remoteIndexPromise) return remoteIndexPromise;

  remoteIndexPromise = fetch(REMOTE_DOC_INDEX_URL, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      const sourceRepo = payload?.sourceRepo || {};
      if (
        config?.sourceRepo?.owner &&
        config?.sourceRepo?.repo &&
        config?.sourceRepo?.branch &&
        (sourceRepo.owner !== config.sourceRepo.owner || sourceRepo.repo !== config.sourceRepo.repo || sourceRepo.branch !== config.sourceRepo.branch)
      ) {
        console.warn("Remote doc index sourceRepo does not match site-config sourceRepo.", { sourceRepo, expected: config.sourceRepo });
      }
      remoteMarkdownPaths = readIndexedPaths(payload).filter(isMarkdownPath).map(String);
      return remoteMarkdownPaths;
    })
    .catch((error) => {
      console.warn("Failed to preload local remote-docs index, falling back to static sidebar config.", error);
      remoteMarkdownPaths = null;
      return null;
    });

  return remoteIndexPromise;
}

export function getResolvedSidebar(config, lang) {
  return getLocalizedList(config?.sidebar, lang)
    .map((group) => {
      const title = getLocalizedValue(group?.title, lang);
      const items = getLocalizedList(group?.items, lang);
      const collection = group?.collection || "";

      if (collection && Array.isArray(remoteMarkdownPaths)) {
        const collectionPaths = remoteMarkdownPaths.filter((path) => getDocCollectionForPath(path) === collection);
        if (collectionPaths.length) {
          return {
            ...group,
            title,
            items: buildRemoteDocsTree(collectionPaths, lang, collectDocTitleOverrides(config, lang, collection), collection)
          };
        }
      }

      return {
        ...group,
        title,
        items: items.map((item) => ({
          kind: "doc",
          title: getLocalizedValue(item?.title, lang),
          path: getLocalizedValue(item?.path, lang)
        }))
      };
    })
    .filter((group) => Array.isArray(group?.items) && group.items.some((item) => item?.path || item?.items?.length));
}

export function getSidebarGroupsForShell(config, lang, shell) {
  return getResolvedSidebar(config, lang)
    .filter((group) => {
      if (group?.collection) return COLLECTION_SHELLS[group.collection] === shell;
      return group.items.some((item) => containsShellItem(item, shell));
    })
    .map((group) => ({ ...group, items: group.items.filter((item) => containsShellItem(item, shell)) }))
    .filter((group) => group.items.length > 0);
}

export function flattenSidebarDocItems(groups) {
  const flattened = [];

  function walk(items, trail = []) {
    items.forEach((item) => {
      if (!item) return;
      if (item.kind === "folder") {
        walk(item.items || [], [...trail, item.title].filter(Boolean));
        return;
      }
      if (!item.path || !item.title) return;
      flattened.push({ title: item.title, path: item.path, trail });
    });
  }

  groups.forEach((group) => walk(group.items || [], [group.title].filter(Boolean)));
  return flattened;
}
