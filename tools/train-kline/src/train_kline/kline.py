"""
把标量序列聚合成 K 线（开/高/低/收）与分时数据。
"""

from __future__ import annotations

Point = tuple[int, float, float]


def summary(points: list[Point]) -> dict:
  if not points:
    return {"total": 0, "first_step": 0, "last_step": 0, "first_wall": 0.0, "last_wall": 0.0, "points": 0}
  first = points[0]
  last = points[-1]
  return {
    "total": last[0] + 1,
    "first_step": first[0],
    "last_step": last[0],
    "first_wall": first[1],
    "last_wall": last[1],
    "points": len(points),
  }


def last_value(points: list[Point]) -> dict:
  if not points:
    return {"step": 0, "value": 0.0, "prev": None, "delta": 0.0, "ratio": 0.0, "wall": 0.0}
  step, wall, value = points[-1]
  prev = points[-2][2] if len(points) > 1 else None
  delta = value - prev if prev is not None else 0.0
  ratio = delta / abs(prev) if prev not in (None, 0) else 0.0
  return {"step": step, "value": value, "prev": prev, "delta": delta, "ratio": ratio, "wall": wall}


def candles(points: list[Point], bucket: int) -> list[dict]:
  """每个桶一根 K 线；桶按 step // bucket 分组。"""
  bucket = max(1, bucket)
  result: list[dict] = []
  group: list[Point] = []
  group_key = None
  prev_wall = None
  for point in points:
    key = point[0] // bucket
    if group_key is None:
      group_key = key
    if key != group_key and group:
      result.append(_candle(group, bucket, prev_wall))
      prev_wall = group[-1][1]
      group = []
      group_key = key
    group.append(point)
  if group:
    result.append(_candle(group, bucket, prev_wall))
  return result


def _candle(group: list[Point], bucket: int, prev_wall: float | None) -> dict:
  values = [point[2] for point in group]
  first_wall = group[0][1]
  last_wall = group[-1][1]
  span = last_wall - (prev_wall if prev_wall is not None else first_wall)
  rate = (group[-1][0] - group[0][0] + 1) / span * 60.0 if span > 0 else 0.0
  return {
    "s": group[0][0],
    "e": group[-1][0],
    "o": values[0],
    "h": max(values),
    "l": min(values),
    "c": values[-1],
    "n": len(group),
    "t": first_wall,
    "thr": rate,
    "span": bucket,
  }


def line(points: list[Point], limit: int = 1600) -> list[list[float]]:
  if len(points) <= limit:
    return [[point[0], point[2], point[1]] for point in points]
  stride = len(points) / limit
  sampled = [points[int(index * stride)] for index in range(limit)]
  if sampled[-1] is not points[-1]:
    sampled.append(points[-1])
  return [[point[0], point[2], point[1]] for point in sampled]


def build(points: list[Point], bucket: int, mode: str) -> dict:
  if mode == "line" or bucket <= 0:
    rows = line(points)
    values = [row[1] for row in rows]
    return {
      "mode": "line",
      "bucket": 0,
      "line": rows,
      "candles": [],
      "domain": [min(values), max(values)] if values else [0.0, 1.0],
      "last": last_value(points),
      "summary": summary(points),
    }
  rows = candles(points, bucket)
  if rows:
    domain = [min(row["l"] for row in rows), max(row["h"] for row in rows)]
  else:
    domain = [0.0, 1.0]
  last = last_value(points)
  if len(rows) >= 2:
    previous = rows[-2]["c"]
    close = rows[-1]["c"]
    delta = close - previous
    last.update({"value": close, "prev": previous, "delta": delta, "ratio": delta / abs(previous) if previous else 0.0})
  return {
    "mode": "candle",
    "bucket": bucket,
    "line": [],
    "candles": rows,
    "domain": domain,
    "last": last,
    "summary": summary(points),
  }
