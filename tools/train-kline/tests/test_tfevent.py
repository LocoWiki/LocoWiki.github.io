import struct
import tempfile
import unittest
from pathlib import Path

from train_kline.tfevent import ScalarStore


def _varint(value: int) -> bytes:
  out = b""
  while True:
    byte = value & 0x7F
    value >>= 7
    out += bytes([byte | 0x80]) if value else bytes([byte])
    if not value:
      return out


def _key(field: int, wire: int) -> bytes:
  return _varint((field << 3) | wire)


def _bytes_field(field: int, data: bytes) -> bytes:
  return _key(field, 2) + _varint(len(data)) + data


def _double_field(field: int, value: float) -> bytes:
  return _key(field, 1) + struct.pack("<d", value)


def _varint_field(field: int, value: int) -> bytes:
  return _key(field, 0) + _varint(value)


def _event(step: int, wall: float, tag: str, value: float) -> bytes:
  tensor = _varint_field(1, 1) + _bytes_field(5, struct.pack("<f", value))
  summary_value = _bytes_field(1, tag.encode()) + _bytes_field(8, tensor)
  summary = _bytes_field(1, summary_value)
  payload = _double_field(1, wall) + _varint_field(2, step) + _bytes_field(5, summary)
  return struct.pack("<Q", len(payload)) + b"\x00\x00\x00\x00" + payload + b"\x00\x00\x00\x00"


class ScalarStoreTest(unittest.TestCase):
  def test_reads_scalars_and_appended_records(self):
    with tempfile.TemporaryDirectory() as tmp:
      run = Path(tmp) / "run"
      run.mkdir()
      path = run / "events.out.tfevents.1.test"
      path.write_bytes(_event(0, 100.0, "Train/reward", 1.0) + _event(1, 101.0, "Train/reward", 2.0))
      store = ScalarStore()
      series = store.read(run)
      self.assertEqual([point[0] for point in series["Train/reward"]], [0, 1])
      self.assertAlmostEqual(series["Train/reward"][-1][2], 2.0, places=6)

      with path.open("ab") as handle:
        handle.write(_event(2, 102.0, "Train/reward", 3.0))
      series = store.read(run)
      self.assertEqual([point[0] for point in series["Train/reward"]], [0, 1, 2])
      self.assertAlmostEqual(series["Train/reward"][-1][2], 3.0, places=6)

  def test_ignores_partial_record(self):
    with tempfile.TemporaryDirectory() as tmp:
      run = Path(tmp) / "run"
      run.mkdir()
      path = run / "events.out.tfevents.1.test"
      record = _event(0, 100.0, "Train/reward", 1.0)
      path.write_bytes(record[:-2])
      store = ScalarStore()
      self.assertEqual(store.read(run), {})
      path.write_bytes(record)
      self.assertEqual(len(store.read(run)["Train/reward"]), 1)


if __name__ == "__main__":
  unittest.main()
