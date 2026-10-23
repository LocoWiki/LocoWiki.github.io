/**
 * 训练行情看板：数据拉取、指标列表、行情头部与悬停明细。
 */

import { KlineChart } from "./chart.js";

const $ = (selector) => document.querySelector(selector);

const QUICK_TAGS = [
  ["Train/mean_reward", "总奖励"],
  ["Train/mean_episode_length", "回合长度"],
  ["Metrics/twist/error_vel_xy", "线速度误差"],
  ["Metrics/twist/error_vel_yaw", "偏航误差"],
  ["AMP/discriminator_prediction", "判别器"],
  ["Loss/entropy", "策略熵"],
  ["Perf/total_fps", "吞吐 FPS"],
  ["Loss/learning_rate", "学习率"],
];

const DEFAULT_TAG = "Train/mean_reward";
const API_KEY = "train-kline.api";
const BUCKET_PRESETS = [1, 5, 20, 100, 500];

const state = {
  apiBase: "",
  runs: [],
  path: null,
  meta: null,
  tag: null,
  mode: "candle",
  bucket: 20,
  bucketAuto: true,
  cn: true,
  refreshSeconds: 10,
  timer: null,
  seriesTimer: null,
  live: false,
  lastSeriesAt: 0,
  lastSeries: null,
  token: 0,
  collapsed: new Set(["Episode_Reward", "Episode_Termination", "Episode_Metrics", "Loss", "Perf", "Curriculum", "Policy"]),
  tagRefs: new Map(),
  tagSignature: "",
  search: "",
  lastStep: 0,
};

let chart = null;

/* ---------- 工具函数 ---------- */

function api(path) {
  return `${state.apiBase}${path}`;
}

async function getJSON(url) {
  const response = await fetch(url, { cache: "no-store" });
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`服务返回无效数据（HTTP ${response.status}）`);
  }
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

function fmt(value, digits) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const abs = Math.abs(value);
  if (digits !== undefined) return value.toFixed(digits);
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `${(value / 1e3).toFixed(1)}k`;
  if (abs >= 100) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(3);
  if (abs >= 0.01) return value.toFixed(4);
  return value.toFixed(5);
}

function fmtInt(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function fmtPercent(ratio, digits = 2) {
  if (!Number.isFinite(ratio)) return "--";
  const sign = ratio > 0 ? "+" : "";
  return `${sign}${(ratio * 100).toFixed(digits)}%`;
}

function fmtSigned(value) {
  if (!Number.isFinite(value)) return "--";
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 1 : abs >= 1 ? 3 : abs >= 0.01 ? 4 : 5;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

function fmtTime(seconds) {
  if (!seconds) return "--";
  const date = new Date(seconds * 1000);
  const pad = (number) => String(number).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fmtDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "--";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours >= 24) return `${Math.floor(hours / 24)} 天 ${hours % 24} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分`;
  return `${minutes} 分`;
}

function ago(seconds) {
  const delta = Math.max(0, Date.now() / 1000 - seconds);
  if (delta < 60) return "刚刚";
  if (delta < 3600) return `${Math.floor(delta / 60)} 分钟前`;
  if (delta < 86400) return `${Math.floor(delta / 3600)} 小时前`;
  return `${Math.floor(delta / 86400)} 天前`;
}

function fmtBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 ** 3)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 ** 2)).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function colorClass(value) {
  if (!Number.isFinite(value) || value === 0) return "flat";
  return value > 0 ? "up" : "down";
}

function autoBucket(total) {
  const sizes = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
  for (const size of sizes) {
    if (total / size <= 190) return size;
  }
  return sizes[sizes.length - 1];
}

/* ---------- 启动 ---------- */

async function boot() {
  chart = new KlineChart($("#chart"), $("#chart-tooltip"));
  chart.onHover = onHover;
  bindControls();
  bindConnect();
  startClock();
  setInterval(refreshRunList, 30000);
  const base = await resolveApiBase();
  if (base === null) {
    showConnect();
    return;
  }
  await startApp(base);
}

async function startApp(base) {
  state.apiBase = base;
  hideConnect();
  try {
    const payload = await getJSON(api("/api/runs"));
    state.runs = payload.runs || [];
    const tbLink = $("#tb-link");
    if (payload.tensorboard_url) {
      tbLink.href = payload.tensorboard_url;
      tbLink.hidden = false;
    }
    renderRuns();
    const requested = new URLSearchParams(location.search).get("run");
    const initial = requested || (state.runs[0] && state.runs[0].path);
    if (!initial) throw new Error("没有可用的训练记录");
    await selectRun(initial);
  } catch (error) {
    setError(error.message);
    showConnect(error.message);
  }
}

/* ---------- 本地服务连接 ---------- */

function normalizeBase(value) {
  let base = String(value || "").trim();
  if (!base) return "";
  if (!/^https?:\/\//i.test(base)) base = `http://${base}`;
  return base.replace(/\/+$/, "");
}

async function healthy(base) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`${base}/api/health`, { cache: "no-store", signal: controller.signal });
    if (!response.ok) return false;
    const payload = await response.json();
    return payload.ok === true;
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveApiBase() {
  // 本地服务直接托管页面时走同源；站点版必须由用户点击后再连接，
  // 因为浏览器访问本地网络需要一次用户手势才能弹出授权。
  if (document.querySelector('meta[name="train-kline-agent"]') && await healthy("")) return "";
  return null;
}

function showConnect(message = "") {
  const overlay = $("#connect-overlay");
  if (!overlay) return;
  document.body.classList.add("connecting");
  overlay.hidden = false;
  const error = $("#connect-error");
  if (message) {
    error.textContent = message;
    error.hidden = false;
  }
  const saved = new URLSearchParams(location.search).get("api") || localStorage.getItem(API_KEY) || "";
  if (saved) {
    try {
      const parsed = new URL(saved);
      $("#connect-host").value = parsed.hostname;
      $("#connect-port").value = parsed.port || "8791";
    } catch (error) {
      /* 忽略损坏的缓存 */
    }
  }
  $("#connect-port").focus();
}

function hideConnect() {
  const overlay = $("#connect-overlay");
  if (overlay) overlay.hidden = true;
  document.body.classList.remove("connecting");
}

function bindConnect() {
  const button = $("#connect-btn");
  if (!button) return;
  button.addEventListener("click", connectFromForm);
  for (const field of [$("#connect-host"), $("#connect-port")]) {
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter") connectFromForm();
    });
  }
}

async function connectFromForm() {
  const error = $("#connect-error");
  const button = $("#connect-btn");
  const host = $("#connect-host").value.trim() || "127.0.0.1";
  let port = $("#connect-port").value.trim() || "8791";
  port = port.replace(/\D/g, "") || "8791";
  const base = normalizeBase(`http://${host}:${port}`);
  button.disabled = true;
  button.textContent = "连接中…";
  error.hidden = true;
  const ok = await healthy(base);
  button.disabled = false;
  button.textContent = "连接本地服务";
  if (!ok) {
    error.textContent = port === "6006"
      ? "6006 是 TensorBoard 的端口，网页无法直接读取。请启动 train-kline（默认 8791）后再连接。"
      : `无法连接 ${base}。请确认本地服务已启动，并检查端口是否正确。`;
    error.hidden = false;
    return;
  }
  localStorage.setItem(API_KEY, base);
  const url = new URL(location.href);
  url.searchParams.set("api", base);
  history.replaceState(null, "", url);
  await startApp(base);
}

function bindControls() {
  $("#run-select").addEventListener("change", (event) => selectRun(event.target.value));
  $("#refresh-select").addEventListener("change", (event) => {
    state.refreshSeconds = Number(event.target.value);
    startAutoRefresh();
  });
  $("#color-mode").addEventListener("change", (event) => {
    state.cn = event.target.checked;
    document.body.classList.toggle("intl", !state.cn);
    chart.setColorMode(state.cn);
    renderTagValues();
    renderSeries(state.lastSeries);
  });
  $("#tag-search").addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    renderTagList();
  });
  $("#mode-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button) return;
    state.mode = button.dataset.mode;
    for (const item of $("#mode-tabs").children) item.classList.toggle("active", item === button);
    $("#bucket-tabs").classList.toggle("disabled", state.mode === "line");
    resetHover();
    loadSeries();
  });
  window.addEventListener("resize", () => chart.resize());
}

/* ---------- 任务 ---------- */

function renderRuns() {
  const list = $("#run-list");
  const select = $("#run-select");
  list.innerHTML = "";
  select.innerHTML = "";
  $("#run-count").textContent = String(state.runs.length);
  for (const run of state.runs) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "run-item";
    item.dataset.path = run.path;
    item.innerHTML = `
      <span class="run-top">
        <span class="run-task">${escapeHtml(run.task)}</span>
        ${run.live ? '<i class="run-live"></i>' : ""}
      </span>
      <span class="run-name">${escapeHtml(run.name)}</span>
      <span class="run-meta"><span>${escapeHtml(run.group)}</span><span>${ago(run.modified)}</span></span>
    `;
    item.addEventListener("click", () => selectRun(run.path));
    list.appendChild(item);

    const option = document.createElement("option");
    option.value = run.path;
    option.textContent = `${run.group} / ${run.name}`;
    select.appendChild(option);
  }
}

async function refreshRunList() {
  if (!state.runs.length) return;
  try {
    const payload = await getJSON(api("/api/runs"));
    const next = payload.runs || [];
    if (next.length === state.runs.length && next[0]?.path === state.runs[0]?.path) return;
    state.runs = next;
    renderRuns();
    $("#run-select").value = state.path;
    for (const item of $("#run-list").children) item.classList.toggle("active", item.dataset.path === state.path);
  } catch (error) {
    /* 静默：下一轮自动刷新会重试 */
  }
}

async function selectRun(path) {
  if (!path) return;
  state.path = path;
  state.tag = null;
  resetHover();
  state.bucketAuto = true;
  state.lastSeries = null;
  for (const item of $("#run-list").children) item.classList.toggle("active", item.dataset.path === path);
  $("#run-select").value = path;
  const url = new URL(location.href);
  url.searchParams.set("run", path);
  history.replaceState(null, "", url);

  try {
    const meta = await getJSON(api(`/api/run?path=${encodeURIComponent(path)}`));
    applyMeta(meta, true);
    const candidates = [DEFAULT_TAG, ...QUICK_TAGS.map(([tag]) => tag)];
    const existing = new Set(meta.tags.map((item) => item.tag));
    state.tag = candidates.find((tag) => existing.has(tag)) || meta.tags[0]?.tag || null;
    state.bucket = autoBucket(meta.summary.last_step || 0);
    renderTagList();
    renderQuickTags();
    renderBucketTabs();
    await loadSeries();
    startAutoRefresh();
  } catch (error) {
    setError(error.message);
  }
}

/* ---------- 元数据 ---------- */

function applyMeta(meta, full = false) {
  state.meta = meta;
  state.live = Boolean(meta.live);
  const badge = $("#live-badge");
  badge.classList.toggle("offline", !state.live);
  $("#live-text").textContent = state.live ? "LIVE" : "已停止";

  const run = meta.run;
  $("#status-run").textContent = run.relative;
  $("#status-points").textContent = `${fmtInt(meta.summary.points ?? 0)} 点 · ${meta.tags.length} 指标`;
  $("#status-refresh").textContent = state.refreshSeconds ? `${state.refreshSeconds}s 自动刷新` : "自动刷新已关闭";

  if (full) {
    const signature = meta.tags.map((item) => item.tag).join("|");
    if (signature !== state.tagSignature) {
      state.tagSignature = signature;
      renderTagList();
    }
  } else {
    renderTagValues();
  }
  renderQuote();
  renderProgress();
}

function tagRow(tag) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "tag-row";
  row.dataset.tag = tag.tag;
  row.innerHTML = `
    <span class="tag-name" title="${escapeHtml(tag.tag)}">${escapeHtml(tag.name)}</span>
    <span class="tag-val">${fmt(tag.latest)}</span>
    <span class="tag-delta ${colorClass(tag.ratio)}">${tag.prev === null ? "--" : fmtPercent(tag.ratio, 1)}</span>
  `;
  row.addEventListener("click", () => selectTag(tag.tag));
  return row;
}

function renderTagList() {
  const container = $("#tag-list");
  const meta = state.meta;
  container.innerHTML = "";
  state.tagRefs = new Map();
  if (!meta) return;

  const visible = meta.tags.filter((tag) => !state.search || tag.tag.toLowerCase().includes(state.search));
  $("#tag-count").textContent = `${visible.length}/${meta.tags.length}`;

  for (const group of meta.groups) {
    const members = visible.filter((tag) => tag.group === group);
    if (!members.length) continue;
    const block = document.createElement("div");
    block.className = "tag-group";
    const isCollapsed = state.search ? false : state.collapsed.has(group);
    block.classList.toggle("collapsed", isCollapsed);

    const head = document.createElement("button");
    head.type = "button";
    head.className = "tag-group-head";
    head.innerHTML = `<span class="caret">▼</span><span>${escapeHtml(group)}</span><span class="count">${members.length}</span>`;
    head.addEventListener("click", () => {
      if (state.collapsed.has(group)) state.collapsed.delete(group);
      else state.collapsed.add(group);
      block.classList.toggle("collapsed");
    });

    const body = document.createElement("div");
    body.className = "tag-group-body";
    for (const tag of members) {
      const row = tagRow(tag);
      if (tag.tag === state.tag) row.classList.add("active");
      body.appendChild(row);
      state.tagRefs.set(tag.tag, row);
    }
    block.append(head, body);
    container.appendChild(block);
  }
  renderQuickTags();
}

function renderTagValues() {
  if (!state.meta) return;
  for (const tag of state.meta.tags) {
    const row = state.tagRefs.get(tag.tag);
    if (!row) continue;
    row.children[1].textContent = fmt(tag.latest);
    const delta = row.children[2];
    delta.textContent = tag.prev === null ? "--" : fmtPercent(tag.ratio, 1);
    delta.className = `tag-delta ${colorClass(tag.ratio)}`;
  }
  renderQuickTags();
}

function renderQuickTags() {
  const container = $("#quick-tags");
  container.innerHTML = "";
  if (!state.meta) return;
  const byTag = new Map(state.meta.tags.map((tag) => [tag.tag, tag]));
  for (const [tag, label] of QUICK_TAGS) {
    const item = byTag.get(tag);
    if (!item) continue;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.classList.toggle("active", tag === state.tag);
    chip.innerHTML = `<span>${escapeHtml(label)}</span><span class="chip-delta ${colorClass(item.ratio)}">${fmt(item.latest)}</span>`;
    chip.addEventListener("click", () => selectTag(tag));
    container.appendChild(chip);
  }
}

function selectTag(tag) {
  if (tag === state.tag) return;
  state.tag = tag;
  resetHover();
  for (const row of state.tagRefs.values()) row.classList.toggle("active", row.dataset.tag === tag);
  renderQuickTags();
  loadSeries();
}

/* ---------- 序列 ---------- */

function renderBucketTabs() {
  const container = $("#bucket-tabs");
  container.innerHTML = "";
  const auto = document.createElement("button");
  auto.type = "button";
  auto.textContent = "自动";
  auto.classList.toggle("active", state.bucketAuto);
  auto.addEventListener("click", () => {
    state.bucketAuto = true;
    state.bucket = autoBucket(state.meta?.summary.last_step || 0);
    state.mode = "candle";
    resetHover();
    syncModeButtons();
    renderBucketTabs();
    loadSeries();
  });
  container.appendChild(auto);
  for (const size of BUCKET_PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${size} 轮`;
    button.classList.toggle("active", !state.bucketAuto && state.bucket === size);
    button.addEventListener("click", () => {
      state.bucketAuto = false;
      state.bucket = size;
      state.mode = "candle";
      resetHover();
      syncModeButtons();
      renderBucketTabs();
      loadSeries();
    });
    container.appendChild(button);
  }
  container.classList.toggle("disabled", state.mode === "line");
}

function syncModeButtons() {
  for (const item of $("#mode-tabs").children) item.classList.toggle("active", item.dataset.mode === state.mode);
  $("#bucket-tabs").classList.toggle("disabled", state.mode === "line");
}

async function loadSeries() {
  if (!state.path || !state.tag) return;
  const token = ++state.token;
  const bucket = state.mode === "line" ? 0 : state.bucket;
  const url = api(`/api/series?path=${encodeURIComponent(state.path)}&tag=${encodeURIComponent(state.tag)}&bucket=${bucket}&mode=${state.mode}`);
  try {
    const data = await getJSON(url);
    if (token !== state.token) return;
    state.lastSeries = data;
    state.lastSeriesAt = Date.now() / 1000;
    syncTagFromSeries(data);
    chart.setData(data);
    renderSeries(data);
    if (chart.hover >= 0) onHover(chart.hover, chart.mouse);
    clearError();
  } catch (error) {
    setError(error.message);
  }
}

function syncTagFromSeries(data) {
  const tag = state.meta?.tags.find((item) => item.tag === state.tag);
  if (!tag || !data || !data.last) return;
  Object.assign(tag, {
    latest: data.last.value,
    step: data.last.step,
    prev: data.last.prev,
    delta: data.last.delta,
    ratio: data.last.ratio,
  });
  renderTagValues();
}

function renderSeries(data) {
  if (!data) return;
  renderQuote();
  renderRecent(data);
}

/* ---------- 行情头部 ---------- */

function renderQuote() {
  const meta = state.meta;
  const data = state.lastSeries;
  if (!meta) return;
  $("#quote-tag").textContent = state.tag || "--";
  const tag = meta.tags.find((item) => item.tag === state.tag);
  $("#quote-group").textContent = tag ? tag.group : "";

  const last = data ? data.last : null;
  if (last) {
    $("#quote-price").textContent = fmt(last.value);
    const delta = $("#quote-delta");
    const sign = last.delta >= 0 ? "+" : "";
    delta.innerHTML = `<span class="${colorClass(last.delta)}">${sign}${fmt(last.delta)} (${fmtPercent(last.ratio)})</span><span class="muted"> · 第 ${fmtInt(last.step)} 轮</span>`;
  } else {
    $("#quote-price").textContent = "--";
    $("#quote-delta").textContent = "--";
  }

  const params = meta.params || {};
  const summary = meta.summary;
  const maxIterations = Number(params.max_iterations) || 0;
  const elapsed = summary.last_wall - summary.first_wall;
  const rate = summary.last_step > 0 && elapsed > 0 ? summary.last_step / elapsed : 0;
  const iterationSeconds = rate > 0 ? 1 / rate : 0;
  const remaining = maxIterations > summary.last_step && rate > 0 ? (maxIterations - summary.last_step) / rate : 0;
  const domain = data ? data.domain : [0, 0];

  const stats = [
    ["当前轮次", fmtInt(summary.last_step)],
    ["总轮次", maxIterations ? fmtInt(maxIterations) : "--"],
    ["并行环境", params.num_envs ? fmtInt(params.num_envs) : "--"],
    ["轮均耗时", iterationSeconds ? `${iterationSeconds.toFixed(2)}s` : "--"],
    ["预计剩余", remaining ? fmtDuration(remaining) : "--"],
    ["已运行", elapsed ? fmtDuration(elapsed) : "--"],
    ["全段最高", data ? fmt(domain[1]) : "--"],
    ["全段最低", data ? fmt(domain[0]) : "--"],
  ];
  $("#quote-stats").innerHTML = stats
    .map(([key, value]) => `<div class="stat"><span class="k">${key}</span><span class="v">${value}</span></div>`)
    .join("");
}

function renderProgress() {
  const meta = state.meta;
  if (!meta) return;
  const params = meta.params || {};
  const maxIterations = Number(params.max_iterations) || 0;
  const last = meta.summary.last_step || 0;
  const ratio = maxIterations ? Math.min(1, last / maxIterations) : 0;
  $("#progress-bar").style.width = `${(ratio * 100).toFixed(2)}%`;
  const text = maxIterations
    ? `${fmtInt(last)} / ${fmtInt(maxIterations)} 轮 · ${(ratio * 100).toFixed(1)}%`
    : `${fmtInt(last)} 轮`;
  $("#progress-text").textContent = text;
}

/* ---------- 最近区间 ---------- */

function renderRecent(data) {
  const body = $("#recent-body");
  body.innerHTML = "";
  if (!data) return;
  let rows = [];
  if (data.mode === "line") {
    const points = data.line.slice(-9);
    rows = points.map((point, index) => {
      const previous = index > 0 ? points[index - 1][1] : point[1];
      return {
        label: fmtInt(point[0]),
        values: [point[1], point[1], point[1], point[1]],
        change: previous ? (point[1] - previous) / Math.abs(previous) : 0,
      };
    });
  } else {
    rows = data.candles.slice(-9).map((row) => ({
      label: `${row.s}–${row.e}`,
      values: [row.o, row.h, row.l, row.c],
      change: row.o ? (row.c - row.o) / Math.abs(row.o) : 0,
    }));
  }
  $("#recent-count").textContent = String(rows.length);
  rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    if (index === rows.length - 1) tr.classList.add("latest");
    tr.innerHTML = `
      <td>${escapeHtml(row.label)}</td>
      <td class="num">${fmt(row.values[0])}</td>
      <td class="num">${fmt(row.values[1])}</td>
      <td class="num">${fmt(row.values[2])}</td>
      <td class="num ${colorClass(row.change)}">${fmt(row.values[3])}</td>
      <td class="num ${colorClass(row.change)}">${fmtPercent(row.change, 1)}</td>
    `;
    body.appendChild(tr);
  });
}

/* ---------- 悬停明细 ---------- */

function resetHover() {
  if (!chart) return;
  chart.hover = -1;
  $("#chart-tooltip").hidden = true;
  chart.draw();
}

function onHover(index, mouse) {
  const tooltip = $("#chart-tooltip");
  if (index === null || index < 0 || !mouse) {
    tooltip.hidden = true;
    return;
  }
  const hovered = chart.hoveredRow();
  if (!hovered) {
    tooltip.hidden = true;
    return;
  }
  const row = hovered.row;
  let html = "";
  if (state.mode === "line") {
    const previous = index > 0 ? chart.rows[index - 1][1] : null;
    const delta = previous === null ? 0 : row[1] - previous;
    const ratio = previous ? delta / Math.abs(previous) : 0;
    html = `
      <div class="tt-head"><span>第 ${fmtInt(row[0])} 轮</span><em>${fmtTime(timestampAt(index))}</em></div>
      <div class="tt-grid">
        <span>数值</span><b>${fmt(row[1])}</b>
        <span>较前</span><b class="${colorClass(delta)}">${fmtSigned(delta)} (${fmtPercent(ratio, 1)})</b>
      </div>`;
  } else {
    const delta = row.c - row.o;
    const ratio = row.o ? delta / Math.abs(row.o) : 0;
    const amplitude = row.o ? (row.h - row.l) / Math.abs(row.o) : 0;
    const ma = [5, 10, 20]
      .map((window) => {
        const value = chart.mas[window] ? chart.mas[window][index] : null;
        if (value === null || value === undefined) return "";
        return `<span style="color:${window === 5 ? "#f5c542" : window === 10 ? "#4dabf7" : "#b197fc"}">MA${window} ${fmt(value)}</span>`;
      })
      .filter(Boolean)
      .join("");
    html = `
      <div class="tt-head"><span>第 ${row.s}–${row.e} 轮</span><em>${fmtTime(row.t)}</em></div>
      <div class="tt-grid">
        <span>开</span><b>${fmt(row.o)}</b>
        <span>高</span><b class="up">${fmt(row.h)}</b>
        <span>低</span><b class="down">${fmt(row.l)}</b>
        <span>收</span><b>${fmt(row.c)}</b>
        <span>涨跌</span><b class="${colorClass(delta)}">${fmtSigned(delta)} (${fmtPercent(ratio, 1)})</b>
        <span>振幅</span><b>${fmt(row.h - row.l)} (${fmtPercent(amplitude, 1)})</b>
        <span>速率</span><b>${row.thr ? row.thr.toFixed(1) : "--"} 点/分</b>
      </div>
      <div class="tt-ma">${ma}</div>`;
  }
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  const wrap = $("#chart-wrap").getBoundingClientRect();
  const width = tooltip.offsetWidth;
  const height = tooltip.offsetHeight;
  let left = mouse.x + 18;
  let top = mouse.y - height / 2;
  if (left + width > wrap.width - 8) left = mouse.x - width - 18;
  left = Math.max(8, Math.min(wrap.width - width - 8, left));
  top = Math.max(8, Math.min(wrap.height - height - 8, top));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function timestampAt(index) {
  const rows = chart.rows;
  const row = rows[Math.min(index, rows.length - 1)];
  if (!row) return 0;
  if (state.mode === "line") return row[2] || 0;
  return row.t || 0;
}

/* ---------- 定时刷新 ---------- */

function startAutoRefresh() {
  clearInterval(state.timer);
  state.timer = null;
  $("#status-refresh").textContent = state.refreshSeconds ? `${state.refreshSeconds}s 自动刷新` : "自动刷新已关闭";
  if (!state.refreshSeconds) return;
  state.timer = setInterval(refresh, state.refreshSeconds * 1000);
}

async function refresh() {
  if (!state.path) return;
  try {
    if (state.meta) {
      const meta = await getJSON(api(`/api/run?path=${encodeURIComponent(state.path)}`));
      applyMeta(meta, false);
    }
    await loadSeries();
    clearError();
  } catch (error) {
    setError(error.message);
  }
}

function startClock() {
  const clock = $("#clock");
  const updated = $("#status-updated");
  const tick = () => {
    clock.textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    if (state.lastSeriesAt) {
      const seconds = Math.max(0, Math.round(Date.now() / 1000 - state.lastSeriesAt));
      updated.textContent = seconds < 2 ? "刚刚更新" : `${seconds} 秒前更新`;
    }
  };
  tick();
  setInterval(tick, 1000);
}

/* ---------- 错误 ---------- */

function setError(message) {
  const bar = $(".statusbar");
  bar.classList.add("error");
  $("#status-updated").textContent = `读取失败：${message}`;
}

function clearError() {
  $(".statusbar").classList.remove("error");
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

boot();
