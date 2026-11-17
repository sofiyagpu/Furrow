"""Furrow API. POST /field with a field outline (GeoJSON Polygon, lon/lat) -> the same JSON as
web/public/data/<region>.json, for that one field. Also serves the built site from web/dist when it exists.
    .venv/bin/uvicorn --app-dir pipeline api:app --port 8000

The field is one cell: weather and soil are read at its centre (POWER is a ~50 km grid, SoilGrids 250 m).
Crops, prices and strategies come from the nearest demo region, so a field in Kazakhstan gets the East Kazakhstan set.
POWER, SoilGrids and finished fields are cached on disk in data/cache.
"""
import hashlib, json, threading
from pathlib import Path
from typing import Literal

import h3
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from build import ROOT, compute
from fetch import fetch_power, fetch_soil, power_key
from regions import REGIONS

CACHE = ROOT / "data" / "cache"
MAX_SPAN = 0.25  # deg, ~25 km: bigger is not one field, and one weather point stops describing it
RUNS = threading.BoundedSemaphore(2)  # ponytail: 2 model runs at once on one server; a job queue if many users wait


class Field(BaseModel):
    type: Literal["Polygon"]
    coordinates: list[list[list[float]]]  # GeoJSON: rings of [lon, lat(, alt)], first ring is the outline


def cached(path: Path, fn):
    """Value from disk, or fn() saved there. A failed fn() leaves nothing, so errors are retried next time."""
    if path.exists():
        return json.loads(path.read_text())
    txt = json.dumps(fn(), separators=(",", ":"), default=lambda o: o.item())  # numpy scalars -> plain JSON
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.{threading.get_ident()}")
    tmp.write_text(txt)
    tmp.replace(path)
    return json.loads(txt)


def outline(f: Field):
    """Outer ring as [[lon, lat], ...], unclosed and checked."""
    ring = [p[:2] for p in f.coordinates[0]] if f.coordinates else []
    if len(ring) > 1 and ring[0] == ring[-1]:
        ring = ring[:-1]
    if len(ring) < 3 or any(len(p) < 2 for p in ring):
        raise HTTPException(422, "The outline needs at least 3 points")
    if not all(-180 <= lon <= 180 and -90 <= lat <= 90 for lon, lat in ring):
        raise HTTPException(422, "Coordinates must be [lon, lat] in degrees")
    lons, lats = [p[0] for p in ring], [p[1] for p in ring]
    if max(lons) - min(lons) > MAX_SPAN or max(lats) - min(lats) > MAX_SPAN:
        raise HTTPException(422, f"The field is wider than {MAX_SPAN} degrees; outline one field")
    return [[round(lon, 5), round(lat, 5)] for lon, lat in ring]


def nearest_region(lat, lon):
    def d(rid):
        (s, w), (n, e) = REGIONS[rid]["bbox"]
        return (lat - (s + n) / 2) ** 2 + (lon - (w + e) / 2) ** 2
    return min(REGIONS, key=d)


def field_data(ring):
    lon = sum(p[0] for p in ring) / len(ring)  # ponytail: vertex mean; fine for field shapes, not for a long L
    lat = sum(p[1] for p in ring) / len(ring)
    soil = cached(CACHE / "soil" / f"{lat:.3f},{lon:.3f}.json", lambda: fetch_soil(round(lat, 4), round(lon, 4)))
    if not soil:
        raise HTTPException(422, "SoilGrids has no soil here (water, town or no data)")
    key = power_key(lat, lon)
    power = cached(CACHE / "power" / f"{key}.json", lambda: fetch_power(*map(float, key.split(","))))
    rid = nearest_region(lat, lon)
    t = REGIONS[rid]
    lons, lats = [p[0] for p in ring], [p[1] for p in ring]
    region = dict(name=f"Your field · crops and prices of {t['name']}", name_ru=f"Ваше поле · культуры и цены: {t['name_ru']}",
                  bbox=((min(lats), min(lons)), (max(lats), max(lons))), irrigated=t["irrigated"])
    cell = h3.latlng_to_cell(lat, lon, 9)
    raw = dict(cells={cell: dict(lat=lat, lon=lon, soil=soil, power=key, b=ring)}, power={key: power})
    with RUNS:
        data = compute(rid, region, raw, checks=False)
    return dict(data, id="field", template=rid)


app = FastAPI(title="Furrow")


@app.post("/field")
def field(f: Field):  # plain def: FastAPI runs it in a thread, the model is CPU-bound for about a minute
    ring = outline(f)
    try:
        return cached(CACHE / "field" / f"{hashlib.sha1(json.dumps(ring).encode()).hexdigest()}.json", lambda: field_data(ring))
    except RuntimeError as e:  # fetch.get gave up after its retries
        raise HTTPException(502, f"NASA POWER or SoilGrids did not answer: {e}")


DIST = ROOT / "web" / "dist"
if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="site")
