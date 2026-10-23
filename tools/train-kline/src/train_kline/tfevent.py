"""
增量读取 TensorBoard tfevents 中的标量记录。

只解析 Event / Summary / Value / Tensor 所需的最小 protobuf 字段，
不依赖 tensorboard 包；已读过的字节不会重复解析，便于训练过程中持续刷新。
"""

from __future__ import annotations

import struct
import threading
from pathlib import Path
from typing import Any, Iterator

MAX_RECORD = 128 * 1024 * 1024


def _varint(data: bytes, offset: int) -> tuple[int, int]:
  value = 0
  shift = 0
  while offset < len(data):
    byte = data[offset]
    offset += 1
    value |= (byte & 0x7F) << shift
    if not byte & 0x80:
      return value, offset
    shift += 7
    if shift > 63:
      break
  raise ValueError("invalid varint")


def _fields(data: bytes) -> Iterator[tuple[int, int, Any]]:
  offset = 0
  while offset < len(data):
    key, offset = _varint(data, offset)
    field, wire = key >> 3, key & 7
    if wire == 0:
      value, offset = _varint(data, offset)
    elif wire == 1:
      value = data[offset:offset + 8]
      offset += 8
    elif wire == 2:
      length, offset = _varint(data, offset)
      value = data[offset:offset + length]
      offset += length
    elif wire == 5:
      value = data[offset:offset + 4]
      offset += 4
    else:
      return
    if offset > len(data):
      return
    yield field, wire, value


def _number(value: bytes, dtype: int) -> float | None:
  try:
    if dtype == 1 and len(value) >= 4:
      return float(struct.unpack("<f", value[:4])[0])
    if dtype == 2 and len(value) >= 8:
      return float(struct.unpack("<d", value[:8])[0])
  except struct.error:
    return None
  return None


def _parse_tensor(data: bytes) -> float | None:
  dtype = 0
  content = b""
  values: list[bytes] = []
  for field, wire, value in _fields(data):
    if field == 1 and wire == 0:
      dtype = value
    elif field == 4 and wire == 2:
      content = value
    elif field in {5, 6}:
      if wire == 2 and isinstance(value, bytes):
        size = 4 if field == 5 else 8
        values.extend(value[index:index + size] for index in range(0, len(value), size))
      elif wire == 5 and field == 5:
        values.append(value)
      elif wire == 1 and field == 6:
        values.append(value)
  if content:
    return _number(content, dtype if dtype else 1)
  return _number(values[-1], dtype) if values else None


def _parse_value(data: bytes) -> tuple[str | None, float | None]:
  tag = None
  scalar = None
  for field, wire, value in _fields(data):
    if field == 1 and wire == 2:
      tag = value.decode("utf-8", errors="replace")
    elif field == 2 and wire == 5:
      scalar = _number(value, 1)
    elif field == 8 and wire == 2:
      scalar = _parse_tensor(value)
  return tag, scalar


def _parse_summary(data: bytes) -> list[tuple[str | None, float | None]]:
  values = []
  for field, wire, value in _fields(data):
    if field == 1 and wire == 2:
      values.append(_parse_value(value))
  return values


def _parse_event(data: bytes) -> tuple[int, float, list[tuple[str | None, float | None]]]:
  step = 0
  wall = 0.0
  values: list[tuple[str | None, float | None]] = []
  for field, wire, value in _fields(data):
    if field == 1 and wire == 1 and len(value) == 8:
      wall = struct.unpack("<d", value)[0]
    elif field == 2 and wire == 0:
      step = value
    elif field == 5 and wire == 2:
      values.extend(_parse_summary(value))
  return step, wall, values


class ScalarStore:
  """按文件记录读取偏移，同一个目录多次调用只解析新增内容。"""

  def __init__(self) -> None:
    self._lock = threading.RLock()
    self._files: dict[str, dict[str, Any]] = {}

  def read(self, directory: Path) -> dict[str, list[tuple[int, float, float]]]:
    with self._lock:
      merged: dict[str, list[tuple[int, float, float]]] = {}
      for path in self._event_files(directory):
        state = self._files.setdefault(str(path), {"offset": 0, "size": -1, "series": {}, "partial": 0})
        self._consume(path, state)
        for tag, points in state["series"].items():
          merged.setdefault(tag, []).extend(points)
      for tag, points in merged.items():
        points.sort(key=lambda item: (item[0], item[1]))
      return merged

  @staticmethod
  def _event_files(directory: Path) -> list[Path]:
    if not directory.is_dir():
      return []
    return sorted(path for path in directory.iterdir() if path.is_file() and path.name.startswith("events.out.tfevents"))

  def _consume(self, path: Path, state: dict[str, Any]) -> None:
    try:
      size = path.stat().st_size
    except OSError:
      return
    if size < state["offset"]:
      state["offset"] = 0
      state["series"] = {}
    if size == state["size"]:
      return
    try:
      with path.open("rb") as file:
        file.seek(state["offset"])
        while True:
          header = file.read(12)
          if len(header) < 12:
            break
          length = struct.unpack("<Q", header[:8])[0]
          if length <= 0 or length > MAX_RECORD:
            break
          payload = file.read(length)
          if len(payload) < length:
            break
          if len(file.read(4)) < 4:
            break
          next_offset = file.tell()
          try:
            step, wall, values = _parse_event(payload)
          except ValueError:
            state["offset"] = next_offset
            continue
          for tag, scalar in values:
            if tag and scalar is not None and scalar == scalar:
              state["series"].setdefault(tag, []).append((step, wall, scalar))
          state["offset"] = next_offset
    except OSError:
      return
    state["size"] = size
