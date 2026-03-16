import * as Lark from "@larksuiteoapi/node-sdk";

const EVENT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const recentEventIds = new Map();

function nowIso() {
  return new Date().toISOString();
}

function log(level, message, extra) {
  if (extra === undefined) {
    console.log(`[${nowIso()}] [${level}] ${message}`);
    return;
  }
  console.log(`[${nowIso()}] [${level}] ${message}`, extra);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value.trim();
}

function parseCsvEnv(name) {
  const value = (process.env[name] || "").trim();
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function cleanupCache() {
  const now = Date.now();
  for (const [eventId, ts] of recentEventIds.entries()) {
    if (now - ts > EVENT_CACHE_TTL_MS) {
      recentEventIds.delete(eventId);
    }
  }
}

function isDuplicateEvent(eventId) {
  if (!eventId) return false;
  cleanupCache();
  if (recentEventIds.has(eventId)) return true;
  recentEventIds.set(eventId, Date.now());
  return false;
}

function extractEventId(eventType, data) {
  return (
    data?.header?.event_id ||
    data?.event_id ||
    data?.uuid ||
    `${eventType}:${data?.header?.create_time || Date.now()}`
  );
}

function getLoggerLevel() {
  const raw = (process.env.LOG_LEVEL || "debug").trim().toLowerCase();
  const map = {
    debug: Lark.LoggerLevel.debug,
    info: Lark.LoggerLevel.info,
    warn: Lark.LoggerLevel.warn,
    error: Lark.LoggerLevel.error,
  };
  return map[raw] || Lark.LoggerLevel.debug;
}

function normalizeDomain(value) {
  const raw = (value || "").trim();
  if (!raw) return "https://open.feishu.cn";
  if (raw.startsWith("https://") || raw.startsWith("http://")) return raw;
  return `https://${raw}`;
}

async function dispatchToGitHub({ owner, repo, token, eventType, dispatchEventType, eventId, feishuSpaceUrl }) {
  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_type: dispatchEventType,
      client_payload: {
        event_type: eventType,
        event_id: eventId,
        message: "来自飞书长连接事件",
        feishu_space_url: feishuSpaceUrl,
        timestamp: new Date().toISOString(),
      },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`github_dispatch_failed(${resp.status}): ${text}`);
  }
}

async function main() {
  const appId = requireEnv("FEISHU_APP_ID");
  const appSecret = requireEnv("FEISHU_APP_SECRET");
  const githubOwner = requireEnv("GITHUB_OWNER");
  const githubRepo = requireEnv("GITHUB_REPO");
  const githubToken = requireEnv("GITHUB_TOKEN");
  const subscribedEventTypes = parseCsvEnv("FEISHU_EVENT_TYPES");

  if (!subscribedEventTypes.length) {
    throw new Error("FEISHU_EVENT_TYPES is empty. Please set at least one event type.");
  }

  const dispatchEventType = (process.env.GITHUB_EVENT_TYPE || "feishu_wiki_sync").trim();
  const feishuSpaceUrl = (process.env.FEISHU_SPACE_URL || "").trim();
  const domain = normalizeDomain(process.env.FEISHU_DOMAIN || "open.feishu.cn");

  const baseConfig = {
    appId,
    appSecret,
    domain,
  };

  const wsClient = new Lark.WSClient({ ...baseConfig, loggerLevel: getLoggerLevel() });
  const handlers = {};

  for (const eventType of subscribedEventTypes) {
    handlers[eventType] = async (data) => {
      const eventId = extractEventId(eventType, data);
      if (isDuplicateEvent(eventId)) {
        log("INFO", `skip duplicate event: ${eventType} (${eventId})`);
        return;
      }

      try {
        await dispatchToGitHub({
          owner: githubOwner,
          repo: githubRepo,
          token: githubToken,
          eventType,
          dispatchEventType,
          eventId,
          feishuSpaceUrl,
        });
        log("INFO", `dispatched: ${eventType} (${eventId})`);
      } catch (err) {
        log("ERROR", `dispatch failed: ${eventType} (${eventId})`, err?.message || err);
      }
    };
  }

  const eventDispatcher = new Lark.EventDispatcher({}).register(handlers);

  log("INFO", "starting Feishu long-connection relay", {
    domain,
    dispatchEventType,
    subscribedEventTypes,
    githubTarget: `${githubOwner}/${githubRepo}`,
  });

  wsClient.start({ eventDispatcher });

  process.on("SIGINT", () => {
    log("INFO", "received SIGINT, exiting...");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    log("INFO", "received SIGTERM, exiting...");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(`[${nowIso()}] [FATAL]`, err?.message || err);
  process.exit(1);
});
