"""Furrow API. POST /field with a field outline (GeoJSON Polygon, lon/lat) -> the same JSON as
web/public/data/<region>.json, for that one field. POST /farm with several fields, machinery and contracts ->
whole-farm plans (plan.py). Also serves the built site from web/dist when it exists.
    .venv/bin/uvicorn --app-dir pipeline api:app --port 8000

The field is one cell: weather and soil are read at its centre (POWER is a ~50 km grid, SoilGrids 250 m).
Crops, prices and strategies come from the nearest demo region, so a field in Kazakhstan gets the East Kazakhstan set.
POWER, SoilGrids, finished fields and farms are cached on disk in data/cache.
"""
import hashlib, json, threading
from pathlib import Path
from typing import Literal

import h3
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field as Num

from build import ROOT, compute
from crops import CROPS
from fetch import fetch_power, fetch_soil, power_key
from plan import plan_farm
from regions import REGIONS

CACHE = ROOT / "data" / "cache"
MAX_SPAN = 0.25  # deg, ~25 km: bigger is not one field, and one weather point stops describing it
MAX_FARM = 1.0  # deg from the farm's centre to any field, ~100 km: one farm, one crop set
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


def centre(ring):
    # ponytail: vertex mean; fine for field shapes, not for a long L
    return sum(p[1] for p in ring) / len(ring), sum(p[0] for p in ring) / len(ring)


def inputs(ring, name="the field"):
    """Soil and POWER weather at the field's centre, from the cache or the network."""
    lat, lon = centre(ring)
    soil = cached(CACHE / "soil" / f"{lat:.3f},{lon:.3f}.json", lambda: fetch_soil(round(lat, 4), round(lon, 4)))
    if not soil:
        raise HTTPException(422, f"SoilGrids has no soil under {name} (water, town or no data)")
    key = power_key(lat, lon)
    power = cached(CACHE / "power" / f"{key}.json", lambda: fetch_power(*map(float, key.split(","))))
    return lat, lon, soil, key, power


def field_data(ring):
    lat, lon, soil, key, power = inputs(ring)
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


class Machinery(BaseModel):
    seed_ha_day: float = Num(gt=0, le=5000)  # drill capacity, ha a day
    harvest_ha_day: float = Num(gt=0, le=5000)  # combine capacity, ha a day
    notill: bool = False  # owns a no-till drill
    drip: bool = False  # drip irrigation installed (irrigated regions)


class Contract(BaseModel):
    crop: str
    min_t: float | None = Num(None, ge=0)  # tonnes a year the farm must deliver
    max_t: float | None = Num(None, ge=0)  # tonnes a year the buyer takes at most


class FarmField(BaseModel):
    name: str = Num("", max_length=60)
    geometry: Field


class FarmIn(BaseModel):
    fields: list[FarmField] = Num(min_length=1, max_length=30)
    machinery: Machinery
    exclude: list[str] = Num([], max_length=20)  # crops the farm cannot grow or sell
    contracts: list[Contract] = Num([], max_length=10)


def template(lat, lon):
    rid = nearest_region(lat, lon)
    t = REGIONS[rid]
    return dict(id=rid, name=t["name"], name_ru=t["name_ru"], irrigated=t["irrigated"],
                crops={k: dict(label=v["label"], label_ru=v["label_ru"], family=v["family"], ymax=v["ymax"]) for k, v in CROPS[rid].items()})


@app.get("/template")
def get_template(lat: float = Query(ge=-90, le=90), lon: float = Query(ge=-180, le=180)):
    """Which demo region's crops and strategies a farm here would use, for the farm form."""
    return template(lat, lon)


@app.post("/farm")
def farm(req: FarmIn):  # plain def, like /field: a farm of 10 fields takes about a minute
    rings = [outline(f.geometry) for f in req.fields]
    names = [f.name.strip() or f"Field {i + 1}" for i, f in enumerate(req.fields)]
    cs = [centre(r) for r in rings]
    lat, lon = sum(c[0] for c in cs) / len(cs), sum(c[1] for c in cs) / len(cs)
    if any(abs(a - lat) > MAX_FARM or abs(b - lon) > MAX_FARM for a, b in cs):
        raise HTTPException(422, f"Fields are more than {MAX_FARM} degrees apart; plan one farm at a time")
    rid = template(lat, lon)["id"]
    bad = [c for c in req.exclude + [k.crop for k in req.contracts] if c not in CROPS[rid]]
    if bad:
        raise HTTPException(422, f"Unknown crop for this region: {', '.join(bad)}")
    if any(k.min_t is not None and k.max_t is not None and k.min_t > k.max_t for k in req.contracts):
        raise HTTPException(422, "A contract has min_t above max_t")
    body = dict(req.model_dump(), rings=rings, names=names)
    body.pop("fields")

    def run():
        fields = []
        for name, ring in zip(names, rings):
            la, _, soil, key, power = inputs(ring, name)
            fields.append(dict(name=name, ring=ring, soil=soil, key=key, power=power, lat=la))
        with RUNS:
            return plan_farm(rid, fields, req.machinery.model_dump(), req.exclude, [k.model_dump() for k in req.contracts])

    try:
        return cached(CACHE / "farm" / f"{hashlib.sha1(json.dumps(body, sort_keys=True).encode()).hexdigest()}.json", run)
    except RuntimeError as e:
        raise HTTPException(502, f"NASA POWER or SoilGrids did not answer: {e}")
    except ValueError as e:  # no candidate rotation left after exclusions
        raise HTTPException(422, str(e))


DIST = ROOT / "web" / "dist"
if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="site")
