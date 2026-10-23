#!/usr/bin/env python3
"""源码目录直接运行入口：python3 train-kline.py --logdir runs"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from train_kline.cli import main

raise SystemExit(main())
