"""本地 HTTP 服务：运行列表、指标元数据、K 线与静态页面。"""

from __future__ import annotations

import fnmatch
import json
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.resources import files
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from . import __version__, discovery, kline
from .tfevent import ScalarStore

STATIC = files("train_kline").joinpath("static")
ASSETS = {
  "index.html": "text/html; charset=utf-8",
  "style.css": "text/css; charset=utf-8",
  "app.js": "text/javascript; charset=utf-8",
  "chart.js": "text/javascript; charset=utf-8",
}
DEFAULT_ORIGINS = [
  "https://locowiki.github.io",
  "https://locowiki.com",
  "https://www.locowiki.com",
  "http://127.0.0.1:*",
  "http://localhost:*",
  "http://[::1]:*",
  "https://127.0.0.1:*",
  "https://localhost:*",
]
GROUP_ORDER = ["Train", "Metrics/twist", "AMP", "Episode_Reward", "Episode_Termination", "Episode_Metrics", "Loss", "Perf", "Curriculum", "Policy"]


class Dashboard:
  def __init__(self, logdirs: list[Path], tensorboard_url: str = "", allow_origins: list[str] | None = None) -> None:
    self.logdirs = [path.resolve() for path in logdirs]
    self.tensorboard_url = tensorboard_url
    self.allow_origins = list(DEFAULT_ORIGINS) + [item for item in (allow_origins or []) if item not in DEFAULT_ORIGINS]
    self.store = ScalarStore()
    self.lock = threading.Lock()

  def runs(self) -> list[dict]:
    return discovery.discover(self.logdirs)

  def meta(self, run_path: str) -> dict:
    directory = discovery.resolve(self.logdirs, run_path)
    series = self.store.read(directory)
    tags = []
    for tag in sorted(series):
      points = series[tag]
      if not points:
        continue
      step, _, value = points[-1]
      prev = points[-2][2] if len(points) > 1 else None
      delta = value - prev if prev is not None else 0.0
      ratio = delta / abs(prev) if prev not in (None, 0) else 0.0
      tags.append({
        "tag": tag,
        "group": _group(tag),
        "name": tag.split("/", 1)[1] if "/" in tag else tag,
        "latest": value,
        "prev": prev,
        "delta": delta,
        "ratio": ratio,
        "step": step,
        "points": len(points),
      })
    groups = []
    for tag in tags:
      if tag["group"] not in groups:
        groups.append(tag["group"])
    groups.sort(key=lambda name: GROUP_ORDER.index(name) if name in GROUP_ORDER else len(GROUP_ORDER))
    steps = [points for tag, points in series.items() if points and not tag.endswith("/time")]
    first = min((points[0][0] for points in steps), default=0)
    last = max((points[-1][0] for points in steps), default=0)
    first_wall = min((points[0][1] for points in series.values() if points), default=0.0)
    last_wall = max((points[-1][1] for points in series.values() if points), default=0.0)
    event_files = discovery.event_files(directory)
    relative = _relative_to_logdirs(self.logdirs, directory)
    return {
      "run": {
        "path": str(directory),
        "relative": str(relative),
        "logdir": str(_logdir_of(self.logdirs, directory)),
        "name": directory.name,
        "task": directory.parent.name,
        "group": relative.parts[0] if len(relative.parts) > 1 else directory.name,
      },
      "params": discovery.read_params(directory),
      "tags": tags,
      "groups": groups,
      "summary": {
        "first_step": first,
        "last_step": last,
        "first_wall": first_wall,
        "last_wall": last_wall,
        "tag_count": len(tags),
        "points": sum(len(points) for points in series.values()),
        "files": len(event_files),
      },
      "live": time.time() - last_wall < 180 if last_wall else False,
      "served_at": time.time(),
    }

  def series(self, run_path: str, tag: str, bucket: int, mode: str) -> dict:
    directory = discovery.resolve(self.logdirs, run_path)
    series = self.store.read(directory)
    points = series.get(tag)
    if points is None:
      raise ValueError(f"指标不存在：{tag}")
    payload = kline.build(points, bucket, mode)
    payload["tag"] = tag
    return payload

  def info(self) -> dict:
    return {
      "version": __version__,
      "logdirs": [str(path) for path in self.logdirs],
      "tensorboard_url": self.tensorboard_url,
      "time": time.time(),
    }


def _group(tag: str) -> str:
  parts = tag.split("/")
  if len(parts) >= 3 and parts[0] in {"Metrics", "Episode"}:
    return f"{parts[0]}/{parts[1]}"
  return parts[0]


def _logdir_of(logdirs: list[Path], directory: Path) -> Path:
  for root in logdirs:
    if directory == root or directory.is_relative_to(root):
      return root
  return directory


def _relative_to_logdirs(logdirs: list[Path], directory: Path) -> Path:
  root = _logdir_of(logdirs, directory)
  return directory.relative_to(root) if directory != root else Path(".")


def make_handler(dashboard: Dashboard) -> type[BaseHTTPRequestHandler]:
  class Handler(BaseHTTPRequestHandler):
    server_version = f"TrainKline/{__version__}"

    def log_message(self, fmt: str, *args) -> None:
      print(f"[http] {self.address_string()} {fmt % args}")

    def do_GET(self) -> None:
      parsed = urlparse(self.path)
      try:
        if parsed.path.startswith("/api/"):
          self._api(parsed.path, parse_qs(parsed.query))
        elif parsed.path in ("/", "/index.html"):
          self._asset("index.html")
        elif parsed.path.startswith("/static/"):
          self._asset(parsed.path[len("/static/"):])
        else:
          self._json({"error": "not found"}, HTTPStatus.NOT_FOUND)
      except ValueError as error:
        self._json({"error": str(error)}, HTTPStatus.BAD_REQUEST)
      except (BrokenPipeError, ConnectionResetError):
        pass
      except Exception as error:
        self._json({"error": f"{type(error).__name__}: {error}"}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def _cors(self) -> None:
      origin = self.headers.get("Origin", "")
      if origin and any(fnmatch.fnmatchcase(origin, pattern) for pattern in dashboard.allow_origins):
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Vary", "Origin")

    def do_OPTIONS(self) -> None:
      self.send_response(HTTPStatus.NO_CONTENT)
      self._cors()
      self.send_header("Access-Control-Max-Age", "600")
      self.send_header("Content-Length", "0")
      self.end_headers()

    def _api(self, path: str, query: dict[str, list[str]]) -> None:
      if path == "/api/runs":
        payload = dashboard.info()
        payload["runs"] = dashboard.runs()
        self._json(payload)
        return
      if path == "/api/run":
        self._json(dashboard.meta(_arg(query, "path")))
        return
      if path == "/api/series":
        bucket = int(_arg(query, "bucket", "0"))
        if bucket > 100000:
          raise ValueError("bucket 过大")
        self._json(dashboard.series(_arg(query, "path"), _arg(query, "tag"), bucket, _arg(query, "mode", "candle")))
        return
      if path == "/api/health":
        self._json({"ok": True, **dashboard.info()})
        return
      self._json({"error": "not found"}, HTTPStatus.NOT_FOUND)

    def _asset(self, name: str) -> None:
      if name not in ASSETS:
        self._json({"error": "not found"}, HTTPStatus.NOT_FOUND)
        return
      target = STATIC.joinpath(name)
      if not target.is_file():
        self._json({"error": "missing asset"}, HTTPStatus.INTERNAL_SERVER_ERROR)
        return
      data = target.read_bytes()
      self.send_response(HTTPStatus.OK)
      self._cors()
      self.send_header("Content-Type", ASSETS[name])
      self.send_header("Content-Length", str(len(data)))
      self.send_header("Cache-Control", "no-store")
      self.send_header("X-Content-Type-Options", "nosniff")
      self.end_headers()
      self.wfile.write(data)

    def _json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
      data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
      self.send_response(status)
      self._cors()
      self.send_header("Content-Type", "application/json; charset=utf-8")
      self.send_header("Content-Length", str(len(data)))
      self.send_header("Cache-Control", "no-store")
      self.end_headers()
      self.wfile.write(data)

  return Handler


def _arg(query: dict[str, list[str]], key: str, default: str = "") -> str:
  values = query.get(key)
  if not values or values[0] == "":
    if default:
      return default
    raise ValueError(f"缺少参数：{key}")
  return values[0]


def serve(dashboard: Dashboard, host: str, port: int) -> None:
  server = ThreadingHTTPServer((host, port), make_handler(dashboard))
  server.daemon_threads = True
  try:
    server.serve_forever()
  finally:
    server.server_close()
