"""TensorBoard 联动：查找可执行文件、探测端口、按需并列启动。"""

from __future__ import annotations

import importlib.util
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path


def find_binary() -> list[str] | None:
  """按 PATH、常见 conda 环境、当前解释器模块三种方式查找 TensorBoard。"""
  found = shutil.which("tensorboard")
  if found:
    return [found]
  candidates = sorted((Path.home() / "miniconda3/envs").glob("*/bin/tensorboard"))
  candidates += sorted((Path.home() / "anaconda3/envs").glob("*/bin/tensorboard"))
  for candidate in candidates:
    if candidate.is_file() and os.access(candidate, os.X_OK):
      return [str(candidate)]
  if importlib.util.find_spec("tensorboard") is not None:
    return [sys.executable, "-m", "tensorboard"]
  return None


def port_open(port: int, host: str = "127.0.0.1", timeout: float = 0.4) -> bool:
  probe = "127.0.0.1" if host in ("0.0.0.0", "::") else host
  try:
    with socket.create_connection((probe, port), timeout=timeout):
      return True
  except OSError:
    return False


def http_ready(port: int, host: str = "127.0.0.1", timeout: float = 0.6) -> bool:
  probe = "127.0.0.1" if host in ("0.0.0.0", "::") else host
  try:
    with urllib.request.urlopen(f"http://{probe}:{port}/", timeout=timeout) as response:
      return 200 <= response.status < 500
  except (urllib.error.URLError, OSError, ValueError):
    return False


def _logdir_spec(logdirs: list[Path]) -> str | None:
  if any("," in str(path) or ":" in str(path) for path in logdirs):
    return None
  entries = []
  for index, path in enumerate(logdirs):
    label = (path.name or f"run{index}").replace(",", "_").replace(":", "_")
    entries.append(f"{label}:{path}")
  return ",".join(entries)


def launch(logdirs: list[Path], port: int, host: str = "127.0.0.1", wait: float = 12.0) -> tuple[str, subprocess.Popen | None, Path | None]:
  """若端口已有 TensorBoard 则复用；否则启动子进程并等待端口就绪。"""
  url = f"http://{'127.0.0.1' if host in ('0.0.0.0', '::') else host}:{port}/"
  if http_ready(port, host):
    print(f"[tensorboard] 复用已运行实例：{url}")
    return url, None, None

  binary = find_binary()
  if binary is None:
    print("[tensorboard] 未找到 tensorboard 可执行文件，跳过并列启动")
    print("[tensorboard] 可手动启动后用 --tensorboard-url 挂链接")
    return "", None, None

  command = binary + ["--host", host, "--port", str(port), "--reload_interval", "5"]
  spec = _logdir_spec(logdirs) if len(logdirs) > 1 else None
  if spec:
    command += ["--logdir_spec", spec]
  else:
    command += ["--logdir", str(logdirs[0])]

  log_path = Path(tempfile.gettempdir()) / "train-kline-tensorboard.log"
  handle = log_path.open("w", encoding="utf-8")
  process = subprocess.Popen(command, stdout=handle, stderr=subprocess.STDOUT, start_new_session=True)
  print(f"[tensorboard] 启动：{' '.join(command)}")
  print(f"[tensorboard] 日志：{log_path}")

  deadline = time.time() + wait
  while time.time() < deadline:
    if http_ready(port, host):
      print(f"[tensorboard] 就绪：{url}")
      return url, process, log_path
    if process.poll() is not None:
      print(f"[tensorboard] 启动失败，退出码 {process.returncode}，详见 {log_path}")
      return "", None, log_path
    time.sleep(0.25)
  print(f"[tensorboard] {wait:.0f} 秒内未就绪，仍保留进程：{url}")
  return url, process, log_path


def stop(process: subprocess.Popen | None) -> None:
  if process is None or process.poll() is not None:
    return
  process.terminate()
  try:
    process.wait(timeout=5)
  except subprocess.TimeoutExpired:
    process.kill()
