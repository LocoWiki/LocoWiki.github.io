import json
import tempfile
import unittest
from pathlib import Path

from train_kline import discovery


class DiscoveryTest(unittest.TestCase):
  def test_discovers_nested_runs_and_reads_run_json(self):
    with tempfile.TemporaryDirectory() as tmp:
      root = Path(tmp) / "logs"
      run = root / "exp_a" / "2026-01-01_00-00-00"
      run.mkdir(parents=True)
      (run / "events.out.tfevents.1.host").write_bytes(b"")
      (run / "run.json").write_text(json.dumps({"num_envs": 4096, "max_iterations": 10000, "name": "demo"}), encoding="utf-8")

      runs = discovery.discover([root])
      self.assertEqual(len(runs), 1)
      self.assertEqual(runs[0]["path"], str(run.resolve()))
      self.assertEqual(runs[0]["group"], "exp_a")
      params = discovery.read_params(run)
      self.assertEqual(params["num_envs"], 4096)
      self.assertEqual(params["max_iterations"], 10000)
      self.assertEqual(params["name"], "demo")
      self.assertEqual(discovery.resolve([root], str(run)), run.resolve())

  def test_rejects_directories_outside_logdirs(self):
    with tempfile.TemporaryDirectory() as tmp:
      root = Path(tmp) / "logs"
      other = Path(tmp) / "other"
      (other / "run").mkdir(parents=True)
      root.mkdir()
      (other / "run" / "events.out.tfevents.1.host").write_bytes(b"")
      with self.assertRaises(ValueError):
        discovery.resolve([root], str(other / "run"))


if __name__ == "__main__":
  unittest.main()
