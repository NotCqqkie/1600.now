from __future__ import annotations
import json
from pathlib import Path


class Checkpoint:
    def __init__(self, work_dir: Path):
        self.path = work_dir / "checkpoint.json"
        self.data = self._load()

    def _load(self) -> dict:
        if self.path.exists():
            return json.loads(self.path.read_text())
        return {"completed_stages": [], "stage_data": {}}

    def _save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, indent=2))

    def is_done(self, stage: str) -> bool:
        return stage in self.data["completed_stages"]

    def mark_done(self, stage: str, data: dict | None = None):
        if stage not in self.data["completed_stages"]:
            self.data["completed_stages"].append(stage)
        if data:
            self.data["stage_data"][stage] = data
        self._save()

    def get_stage_data(self, stage: str) -> dict | None:
        return self.data["stage_data"].get(stage)

    def set_partial(self, stage: str, key: str, value):
        if stage not in self.data["stage_data"]:
            self.data["stage_data"][stage] = {}
        self.data["stage_data"][stage][key] = value
        self._save()

    def get_partial(self, stage: str, key: str, default=None):
        return self.data["stage_data"].get(stage, {}).get(key, default)

    def reset(self):
        self.data = {"completed_stages": [], "stage_data": {}}
        self._save()
