"""Download the real inputs: NASA POWER daily weather and ISRIC SoilGrids topsoil, per H3 cell.

No auth needed. Output: data/raw/<region>.json. Re-running skips what is already cached.
    .venv/bin/python pipeline/fetch.py
"""
import json, time, urllib.request, urllib.parse
from pathlib import Path
import h3

from regions import REGIONS, H3_RES

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
POWER_PARAMS = "PRECTOTCORR,T2M_MAX,T2M_MIN,ALLSKY_SFC_SW_DWN,WS2M,RH2M"
YEARS = (2001, 2024)


def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return json.load(r)
        except Exception as e:  # rate limit or transient failure: back off
            print("  retry", i + 1, e)
            time.sleep(15 * (i + 1))
    raise RuntimeError(url)


def cells(region):
    (s, w), (n, e) = region["bbox"]
    poly = h3.LatLngPoly([(s, w), (s, e), (n, e), (n, w)])
    return sorted(h3.polygon_to_cells(poly, H3_RES))


def power_key(lat, lon):
    # POWER's MERRA-2 grid is 0.5 x 0.625 deg: cells in one grid box share a series
    return f"{round(lat * 2) / 2:.1f},{round(lon / 0.625) * 0.625:.3f}"


def fetch_power(lat, lon):
    q = urllib.parse.urlencode(dict(parameters=POWER_PARAMS, community="AG", latitude=lat, longitude=lon,
                                    start=f"{YEARS[0]}0101", end=f"{YEARS[1]}1231", format="JSON"))
    p = get("https://power.larc.nasa.gov/api/temporal/daily/point?" + q)["properties"]["parameter"]
    dates = sorted(p["T2M_MAX"])
    return {"dates": dates, **{k: [p[k][d] for d in dates] for k in p}}


def fetch_soil(lat, lon):
    q = urllib.parse.urlencode([("lon", lon), ("lat", lat), *[("property", v) for v in ("soc", "clay", "sand", "bdod")],
                                *[("depth", d) for d in ("0-5cm", "5-15cm", "15-30cm")], ("value", "mean")])
    js = get("https://rest.isric.org/soilgrids/v2.0/properties/query?" + q)
    out = {}
    for layer in js["properties"]["layers"]:
        vals = [d["values"]["mean"] for d in layer["depths"]]
        if None in vals:
            return None  # water, urban or no data
        w = [5, 10, 15]  # depth-weighted 0-30 cm mean
        out[layer["name"]] = sum(v * k for v, k in zip(vals, w)) / 30 / layer["unit_measure"]["d_factor"]
    # soc g/kg, clay %, sand %, bdod kg/dm3
    return out


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    for rid, region in REGIONS.items():
        path = RAW / f"{rid}.json"
        db = json.loads(path.read_text()) if path.exists() else {"cells": {}, "power": {}}
        for c in cells(region):
            if c in db["cells"]:
                continue
            lat, lon = h3.cell_to_latlng(c)
            print(rid, c, f"{lat:.3f},{lon:.3f}")
            soil = fetch_soil(round(lat, 4), round(lon, 4))
            db["cells"][c] = {"lat": lat, "lon": lon, "soil": soil, "power": power_key(lat, lon)}
            path.write_text(json.dumps(db))
            time.sleep(12)  # ISRIC fair use: ~5 requests a minute
        for key in {v["power"] for v in db["cells"].values()} - set(db["power"]):
            print(rid, "POWER", key)
            lat, lon = map(float, key.split(","))
            db["power"][key] = fetch_power(lat, lon)
            path.write_text(json.dumps(db))


if __name__ == "__main__":
    main()
