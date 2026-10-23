"""
训练目录发现与运行参数读取。

与具体训练框架无关：任何包含 events.out.tfevents 的目录都视为一次训练运行。
"""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

EVENT_PREFIX = "events.out.tfevents"
LIVE_WINDOW = 180.0
SKIP_DIRS = {".git", "__pycache__", "node_modules", ".venv", "venv", ".idea", ".vscode"}


def event_files(directory: Path) -> list[Path]:
  if not directory.is_dir():
    return []
  return sorted(path for path in directory.iterdir() if path.is_file() and path.name.startswith(EVENT_PREFIX))


def discover(logdirs: list[Path]) -> list[dict]:
  """递归扫描多个日志根目录，返回按修改时间倒序排列的运行列表。"""
  runs: list[dict] = []
  seen: set[Path] = set()
  for base in logdirs:
    base = base.resolve()
    if not base.is_dir():
      continue
    for dirpath, dirnames, filenames in os.walk(base):
      dirnames[:] = sorted(name for name in dirnames if name not in SKIP_DIRS and not name.startswith("."))
      if not any(name.startswith(EVENT_PREFIX) for name in filenames):
        continue
      directory = Path(dirpath).resolve()
      if directory in seen:
        continue
      seen.add(directory)
      files = event_files(directory)
      if not files:
        continue
      relative = directory.relative_to(base)
      parts = relative.parts
      runs.append({
        "path": str(directory),
        "relative": str(relative) if parts else ".",
        "logdir": str(base),
        "group": parts[0] if len(parts) > 1 else directory.name,
        "task": directory.parent.name if directory.parent != base else base.name,
        "name": directory.name,
        "size": sum(path.stat().st_size for path in files),
        "files": len(files),
        "modified": max(path.stat().st_mtime for path in files),
        "live": time.time() - max(path.stat().st_mtime for path in files) < LIVE_WINDOW,
      })
  runs.sort(key=lambda item: item["modified"], reverse=True)
  return runs


def read_params(run_directory: Path) -> dict:
  """读取可选运行元数据：run.json、rsl_rl 的 params/agent.yaml 与 env.yaml。"""
  values: dict[str, object] = {}
  for name in ("run.json", "meta.json"):
    path = run_directory / name
    if not path.is_file():
      continue
    try:
      payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
      continue
    if isinstance(payload, dict):
      for key in ("name", "num_envs", "max_iterations", "save_interval", "seed", "notes"):
        if key in payload:
          values[key] = payload[key]
  agent = run_directory / "params/agent.yaml"
  env = run_directory / "params/env.yaml"
  if agent.is_file():
    text = agent.read_text(encoding="utf-8", errors="replace")
    for key in ("max_iterations", "save_interval", "seed", "experiment_name"):
      match = re.search(rf"^{key}:\s*(.+)$", text, re.MULTILINE)
      if match and key not in values:
        values[key] = _coerce(match.group(1).strip())
  if env.is_file():
    text = env.read_text(encoding="utf-8", errors="replace")
    match = re.search(r"num_envs:\s*(\d+)", text)
    if match and "num_envs" not in values:
      values["num_envs"] = int(match.group(1))
    match = re.search(r"^max_episode_length_s:\s*([\d.]+)", text, re.MULTILINE)
    if match:
      values.setdefault("max_episode_length_s", float(match.group(1)))
  return values


def _coerce(raw: str) -> object:
  raw = raw.strip("'\"")
  try:
    return int(raw)
  except ValueError:
    pass
  try:
    return float(raw)
  except ValueError:
    return raw


def resolve(logdirs: list[Path], raw: str) -> Path:
  """校验 API 传入的运行路径位于已配置的日志根目录之内。"""
  if not raw:
    raise ValueError("缺少 path 参数")
  path = Path(raw).expanduser()
  if not path.is_absolute():
    raise ValueError("path 必须是绝对路径")
  path = path.resolve()
  roots = [root.resolve() for root in logdirs]
  if not any(path == root or path.is_relative_to(root) for root in roots):
    raise ValueError("path 必须位于已配置的 --logdir 目录内")
  if not path.is_dir() or not event_files(path):
    raise ValueError(f"目录中没有 tfevents：{path}")
  return path
