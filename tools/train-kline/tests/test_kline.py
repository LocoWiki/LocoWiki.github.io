import unittest

from train_kline import kline

POINTS = [
  (0, 100.0, 1.0),
  (1, 101.0, 3.0),
  (2, 102.0, 2.0),
  (3, 103.0, 4.0),
  (4, 104.0, 5.0),
]


class KlineTest(unittest.TestCase):
  def test_candles_use_ohlc_and_step_buckets(self):
    rows = kline.candles(POINTS, 2)
    self.assertEqual([(row["s"], row["e"]) for row in rows], [(0, 1), (2, 3), (4, 4)])
    self.assertEqual(rows[0]["o"], 1.0)
    self.assertEqual(rows[0]["h"], 3.0)
    self.assertEqual(rows[0]["l"], 1.0)
    self.assertEqual(rows[0]["c"], 3.0)
    self.assertGreater(rows[1]["thr"], 0)

  def test_build_candle_compares_with_previous_close(self):
    payload = kline.build(POINTS, 2, "candle")
    self.assertEqual(payload["mode"], "candle")
    self.assertEqual(payload["last"]["prev"], 4.0)
    self.assertEqual(payload["last"]["value"], 5.0)
    self.assertAlmostEqual(payload["last"]["ratio"], 0.25)

  def test_line_downsamples_and_keeps_wall_time(self):
    points = [(index, 100.0 + index, float(index)) for index in range(50)]
    payload = kline.build(points, 0, "line")
    self.assertEqual(payload["mode"], "line")
    self.assertLessEqual(len(payload["line"]), 51)
    self.assertEqual(payload["line"][0], [0, 0.0, 100.0])
    self.assertEqual(payload["line"][-1], [49, 49.0, 149.0])


if __name__ == "__main__":
  unittest.main()
