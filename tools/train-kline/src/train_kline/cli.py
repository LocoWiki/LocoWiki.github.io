"""命令行入口：解析参数、启动 HTTP 服务，可选并列启动 TensorBoard。"""

from __future__ import annotations

import argparse
import os
import signal
import sys
import time
from pathlib import Path
from urllib.parse import quote

from . import __version__, discovery, tensorboard
from .server import Dashboard, serve

DEFAULT_PORTS = {"dashboard": 8791, "tensorboard": 6006}
LOG_DIR_CANDIDATES = ("runs", "logs/rsl_rl", "tb_logs", "tensorboard", "logs")


def build_parser() -> argparse.ArgumentParser:
  parser = argparse.ArgumentParser(
    prog="train-kline",
    description="把 TensorBoard 的训练标量画成股票式 K 线，只读 tfevents，可与训练并行运行。",
    formatter_class=argparse.RawDescriptionHelpFormatter,
    epilog=(
      "示例：\n"
      "  train-kline --logdir logs/rsl_rl\n"
      "  train-kline --logdir runs --tensorboard\n"
      "  train-kline --logdir /data/exp1 --logdir /data/exp2 --tensorboard-url http://127.0.0.1:6006/\n"
    ),
  )
  parser.add_argument("-L", "--logdir", action="append", metavar="DIR", help="TensorBoard 日志根目录，可重复传入")
  parser.add_argument("--host", default="127.0.0.1", help="监听地址，默认 127.0.0.1")
  parser.add_argument("--port", type=int, default=DEFAULT_PORTS["dashboard"], help="看板端口，默认 8791")
  parser.add_argument("--open", dest="open_browser", action="store_true", default=True, help="启动后打开浏览器（默认）")
  parser.add_argument("--no-open", dest="open_browser", action="store_false", help="不打开浏览器")
  parser.add_argument("--tensorboard", action="store_true", help="并列启动 TensorBoard 并在页面中加入入口")
  parser.add_argument("--tensorboard-port", type=int, default=DEFAULT_PORTS["tensorboard"], help="TensorBoard 端口，默认 6006")
  parser.add_argument("--tensorboard-url", default="", help="复用已有 TensorBoard 地址，仅加入页面入口")
  parser.add_argument("--wait", type=float, default=0.0, metavar="SECONDS", help="尚无日志时最多等待多少秒（默认 0，立即退出）")
  parser.add_argument("--allow-origin", action="append", metavar="ORIGIN", help="允许跨域读取的站点来源，可重复传入；默认为 LocoWiki 与本地回环")
  parser.add_argument("--version", action="version", version=f"train-kline {__version__}")
  return parser


def _default_logdirs() -> list[Path]:
  env = os.environ.get("TRAIN_KLINE_LOGDIR", "")
  if env:
    return [Path(item).expanduser() for item in env.split(os.pathsep) if item]
  for candidate in LOG_DIR_CANDIDATES:
    path = Path(candidate)
    if path.is_dir():
      return [path]
  return [Path("runs")]


def _resolve_logdirs(values: list[str] | None) -> list[Path]:
  paths = [Path(item).expanduser() for item in values] if values else _default_logdirs()
  resolved: list[Path] = []
  for path in paths:
    path = path.resolve()
    if not path.is_dir():
      raise SystemExit(f"[config] 日志目录不存在：{path}")
    if path not in resolved:
      resolved.append(path)
  return resolved


def _print_no_runs(logdirs: list[Path]) -> None:
  print("[config] 没有找到任何 events.out.tfevents，未启动看板。")
  print("[config] 请确认 --logdir 指向 TensorBoard 使用的同一目录，例如：")
  print("[config]   train-kline --logdir logs/rsl_rl")
  print("[config]   train-kline --logdir runs")
  for path in logdirs:
    print(f"[config] 已扫描：{path}")


def main(argv: list[str] | None = None) -> int:
  args = build_parser().parse_args(argv)
  logdirs = _resolve_logdirs(args.logdir)

  runs = discovery.discover(logdirs)
  if not runs and args.wait > 0:
    print(f"[config] 暂未发现日志，等待最多 {args.wait:.0f} 秒……")
    deadline = time.time() + args.wait
    while not runs and time.time() < deadline:
      time.sleep(2.0)
      runs = discovery.discover(logdirs)
  if not runs:
    _print_no_runs(logdirs)
    return 2

  tensorboard_url = args.tensorboard_url.strip()
  tensorboard_process = None
  if not tensorboard_url and args.tensorboard:
    tensorboard_url, tensorboard_process, _ = tensorboard.launch(logdirs, args.tensorboard_port, args.host)

  dashboard = Dashboard(logdirs, tensorboard_url=tensorboard_url, allow_origins=args.allow_origin)
  host = args.host
  url = f"http://{'127.0.0.1' if host in ('0.0.0.0', '::') else host}:{args.port}/?run={quote(runs[0]['path'], safe='')}"

  print(f"[config] 日志目录：{', '.join(str(path) for path in logdirs)}")
  print(f"[config] 运行数量：{len(runs)}")
  print(f"[config] 最新运行：{runs[0]['path']}")
  print(f"[server] 看板地址：{url}")
  if tensorboard_url:
    print(f"[server] TensorBoard：{tensorboard_url}")
  print("[server] 按 Ctrl+C 退出")

  def _terminate(signum, frame):
    raise SystemExit(0)

  signal.signal(signal.SIGTERM, _terminate)
  try:
    if args.open_browser:
      import webbrowser

      webbrowser.open(url)
    serve(dashboard, host, args.port)
  except KeyboardInterrupt:
    print("\n[server] 已停止")
  except OSError as error:
    if getattr(error, "errno", None) == 98:
      print(f"[server] 端口 {args.port} 已被占用，请用 --port 指定其他端口")
      tensorboard.stop(tensorboard_process)
      return 1
    raise
  finally:
    tensorboard.stop(tensorboard_process)
  return 0
