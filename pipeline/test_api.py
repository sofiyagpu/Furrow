"""POST /field end to end, network replaced by the cached East Kazakhstan inputs. ~1 min (the model runs once)."""
import json
from fastapi.testclient import TestClient

import api

RAW = json.loads((api.ROOT / "data" / "raw" / "vko.json").read_text())
CELL = next(c for c in RAW["cells"].values() if c["soil"])
FIELD = {"type": "Polygon", "coordinates": [[[81.90, 50.50], [81.92, 50.50], [81.92, 50.51], [81.90, 50.51], [81.90, 50.50]]]}


def test_field(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(api, "CACHE", tmp_path)
    monkeypatch.setattr(api, "fetch_soil", lambda lat, lon: calls.append("soil") or CELL["soil"])
    monkeypatch.setattr(api, "fetch_power", lambda lat, lon: calls.append("power") or RAW["power"][CELL["power"]])
    client = TestClient(api.app)

    bad = [{"type": "Polygon", "coordinates": [[[81.9, 50.5], [81.92, 50.5]]]},  # 2 points
           {"type": "Polygon", "coordinates": [[[81.0, 50.0], [82.0, 50.0], [82.0, 51.0]]]},  # 1 degree wide
           {"type": "Polygon", "coordinates": [[[50.5, 181.9], [50.5, 181.92], [50.51, 181.92]]]}]  # lat/lon swapped
    for b in bad:
        assert client.post("/field", json=b).status_code == 422, b

    r = client.post("/field", json=FIELD)
    assert r.status_code == 200, r.text
    d = r.json()
    demo = json.loads((api.ROOT / "web" / "public" / "data" / "vko.json").read_text())
    assert set(d) - {"template"} == set(demo), "same keys as the demo region file"
    assert d["id"] == "field" and d["template"] == "vko" and not d["irrigated"]
    assert len(d["cells"]) == 1 and d["cells"][0]["h3"] == d["rep_cell"] and len(d["cells"][0]["b"]) == 4
    assert [s["id"] for s in d["strategies"]] == [s["id"] for s in demo["strategies"]] and d["pareto"]

    assert client.post("/field", json=FIELD).json() == d and calls == ["soil", "power"], "second call from cache"


def test_farm(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "CACHE", tmp_path)
    monkeypatch.setattr(api, "fetch_soil", lambda lat, lon: CELL["soil"])
    monkeypatch.setattr(api, "fetch_power", lambda lat, lon: RAW["power"][CELL["power"]])
    client = TestClient(api.app)
    assert client.get("/template", params=dict(lat=53.5, lon=63.5)).json()["id"] == "vko"
    second = {"type": "Polygon", "coordinates": [[[81.95, 50.50], [81.98, 50.50], [81.98, 50.52], [81.95, 50.52]]]}
    body = dict(fields=[dict(name="North", geometry=FIELD), dict(geometry=second)],
                machinery=dict(seed_ha_day=40, harvest_ha_day=30, notill=True),
                exclude=["rapeseed"], contracts=[dict(crop="wheat", min_t=50)])
    assert client.post("/farm", json=dict(body, exclude=["cotton"])).status_code == 422, "Arizona crop in Kazakhstan"
    r = client.post("/farm", json=body)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["template"] == "vko" and [f["name"] for f in d["fields"]] == ["North", "Field 2"]
    assert d["plans"] and d["baseline"]["key"] == "current" and len(d["plans"][0]["fields"]) == 2
    assert all(p["feasible"] and p["contracts"][0]["planned"][0] >= 50 for p in d["plans"])
    assert client.post("/farm", json=body).json() == d, "second call from cache"
