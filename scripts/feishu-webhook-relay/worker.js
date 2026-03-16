/**
 * Example relay for Feishu webhook -> GitHub repository_dispatch
 *
 * Required env vars:
 * - GITHUB_OWNER
 * - GITHUB_REPO
 * - GITHUB_TOKEN (repo scope)
 * - FEISHU_SPACE_URL (optional, for status panel display)
 * - FEISHU_WEBHOOK_SECRET (optional, simple header check)
 */

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) },
  });
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    }

    if (env.FEISHU_WEBHOOK_SECRET) {
      const token = request.headers.get("x-feishu-token") || "";
      if (token !== env.FEISHU_WEBHOOK_SECRET) {
        return json({ ok: false, error: "invalid_webhook_secret" }, { status: 401 });
      }
    }

    let payload = {};
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    if (payload?.type === "url_verification" && payload.challenge) {
      return json({ challenge: payload.challenge });
    }

    const eventType = payload?.header?.event_type || payload?.event?.type || payload?.type || "unknown";
    const ghResp = await fetch(
      `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: "feishu_wiki_sync",
          client_payload: {
            event_type: eventType,
            message: "来自飞书 Webhook 的同步事件",
            feishu_space_url: env.FEISHU_SPACE_URL || "",
            timestamp: new Date().toISOString(),
          },
        }),
      },
    );

    if (!ghResp.ok) {
      const msg = await ghResp.text();
      return json({ ok: false, error: "github_dispatch_failed", detail: msg }, { status: 502 });
    }

    return json({ ok: true, dispatched: true, eventType });
  },
};
