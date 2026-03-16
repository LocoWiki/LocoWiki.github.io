import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FALLBACK_FEISHU_URL =
  "https://wcn9j5638vrr.feishu.cn/wiki/space/7570988375279517715?ccm_open_type=lark_wiki_spaceLink&open_tab_from=wiki_home";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "..");
const statusFile = resolve(repoRoot, "assets/feishu-sync-status.json");

async function loadGithubEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) return {};
  try {
    const raw = await readFile(eventPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function pickSource(event) {
  if (event?.action) return `repository_dispatch:${event.action}`;
  return process.env.GITHUB_EVENT_NAME || "manual";
}

async function main() {
  const event = await loadGithubEvent();
  const payload =
    event && typeof event.client_payload === "object" && event.client_payload !== null
      ? event.client_payload
      : {};

  const now = new Date().toISOString();
  const status = {
    project: "LocoWiki",
    lastSyncAt: now,
    source: pickSource(event),
    eventType:
      payload.event_type ||
      process.env.MANUAL_EVENT_TYPE ||
      event.action ||
      "feishu_wiki_sync",
    message:
      payload.message ||
      process.env.MANUAL_MESSAGE ||
      "Webhook 心跳已更新；当前站点通过 Readmydock 内嵌显示飞书知识库。",
    feishuSpaceUrl: payload.feishu_space_url || process.env.FEISHU_SPACE_URL || FALLBACK_FEISHU_URL,
    receivedAt: payload.timestamp || now,
  };

  await writeFile(statusFile, `${JSON.stringify(status, null, 2)}\n`, "utf8");
  console.log(`Updated ${statusFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
