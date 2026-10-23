#!/usr/bin/env python3
"""把 src/train_kline 打包成单文件 dist/train-kline.pyz。"""

from __future__ import annotations

import shutil
import tempfile
import zipapp
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "dist" / "train-kline.pyz"


def main() -> int:
  source = ROOT / "src" / "train_kline"
  if not source.is_dir():
    raise SystemExit(f"缺少源码目录：{source}")
  OUTPUT.parent.mkdir(parents=True, exist_ok=True)
  with tempfile.TemporaryDirectory() as temporary:
    stage = Path(temporary) / "app"
    shutil.copytree(source, stage / "train_kline", ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    (stage / "__main__.py").write_text("from train_kline.cli import main\n\nraise SystemExit(main())\n", encoding="utf-8")
    zipapp.create_archive(stage, OUTPUT, interpreter="/usr/bin/env python3", compressed=True)
  OUTPUT.chmod(0o755)
  print(f"[build] {OUTPUT} ({OUTPUT.stat().st_size / 1024:.1f} KiB)")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
