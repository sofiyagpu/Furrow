"""ML contract checks: .venv/bin/python -m pytest pipeline/test_ml.py"""
import json
import pytest
from build import load_ml, ML


def write(tmp_path, obj):
    p = tmp_path / "ml.json"
    p.write_text(obj if isinstance(obj, str) else json.dumps(obj))
    return p


def test_missing_file_is_none(tmp_path):
    assert load_ml(tmp_path / "nope.json") is None


def test_empty_and_missing_cells_become_empty_dict(tmp_path):
    assert load_ml(write(tmp_path, {"cells": {}}))["cells"] == {}
    assert load_ml(write(tmp_path, {"model": "m"}))["cells"] == {}
    assert load_ml(write(tmp_path, {"cells": None}))["cells"] == {}


def test_broken_json_fails_loudly(tmp_path):
    with pytest.raises(SystemExit):
        load_ml(write(tmp_path, "{not json"))


def test_repo_files_load():
    assert load_ml(ML / "az.json")["cells"] == {}            # real file: no fake cells
    fx = load_ml(ML / "fixtures" / "az.one-cell.json")
    assert set(fx["cells"]["8548eb87fffffff"]) >= {"crop", "crop_p", "crop_pixel_share", "low_confidence", "years"}
