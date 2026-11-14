"""Download the real inputs: NASA POWER daily weather and ISRIC SoilGrids topsoil, per H3 cell,
SMAP L4 root-zone soil moisture to check the model's water balance, and GPM IMERG monthly rain.

Output: data/raw/<region>.json, <region>.smap.json, <region>.imerg.json. Re-running skips what is cached.
    .venv/bin/python pipeline/fetch.py            # POWER + SoilGrids, no auth
    .venv/bin/python pipeline/fetch.py --smap     # SMAP, ~350 images per region, no auth
    EARTHDATA_TOKEN=... .venv/bin/python pipeline/fetch.py --imerg   # IMERG, 288 months per region, Earthdata login token
"""
import calendar, io, json, os, re, sys, time, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from datetime import date
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


# SMAP L4 root-zone moisture (m3/m3, 0-100 cm, 12z) read from NASA GIBS images: GIBS publishes the colour table,
# so each pixel colour maps back to a 0.003 m3/m3 value bin. No Earthdata login needed.
# ponytail: binned values from rendered images; switch to SPL4SMGP granules (Earthdata login) if 0.003 bins matter.
GIBS = "https://gibs.earthdata.nasa.gov"
SMAP_LAYER = "SMAP_L4_Analyzed_Root_Zone_Soil_Moisture"
SMAP_DATES = [date(y, m, d).isoformat() for y in range(2015, YEARS[1] + 1) for m in range(1, 13) for d in (1, 11, 21)
              if date(y, m, d) >= date(2015, 4, 1)]


def fetch_bytes(url, tries=4, headers=None):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=120) as r:
                return r.read()
        except Exception as e:
            print("  retry", i + 1, e)
            time.sleep(10 * (i + 1))
    raise RuntimeError(url)


def smap_colours():
    xml = fetch_bytes(f"{GIBS}/colormaps/v1.3/SMAP_Analyzed_Soil_Moisture.xml").decode()
    out = {}
    for rgb, lo, hi in re.findall(r'rgb="([\d,]+)" transparent="false" sourceValue="\[([\d.]+),([\d.]+|\+INF)\)"', xml):
        out[tuple(map(int, rgb.split(",")))] = round((float(lo) + (float(hi) if hi != "+INF" else float(lo))) / 2, 4)
    assert len(out) > 200, "SMAP colour table changed"
    return out


def fetch_smap(rid, region, db):
    from PIL import Image
    path = RAW / f"{rid}.smap.json"
    if path.exists():
        return
    colours = smap_colours()
    (s, w), (n, e) = region["bbox"]
    W, H = round((e - w) / 0.02), round((n - s) / 0.02)  # 0.02 deg pixels, SMAP itself is 9 km
    px = {c: (min(W - 1, int((v["lon"] - w) / (e - w) * W)), min(H - 1, int((n - v["lat"]) / (n - s) * H)))
          for c, v in db["cells"].items() if v["soil"]}

    def one(d):
        q = urllib.parse.urlencode(dict(SERVICE="WMS", REQUEST="GetMap", VERSION="1.1.1", LAYERS=SMAP_LAYER, STYLES="",
                                        SRS="EPSG:4326", BBOX=f"{w},{s},{e},{n}", WIDTH=W, HEIGHT=H, FORMAT="image/png", TIME=d))
        im = Image.open(io.BytesIO(fetch_bytes(f"{GIBS}/wms/epsg4326/best/wms.cgi?{q}"))).convert("RGBA")
        return {c: colours.get(im.getpixel(xy)[:3]) if im.getpixel(xy)[3] else None for c, xy in px.items()}

    with ThreadPoolExecutor(8) as ex:
        days = list(ex.map(one, SMAP_DATES))
    keep = [i for i, v in enumerate(days) if any(x is not None for x in v.values())]  # drop dates with no image
    path.write_text(json.dumps({"layer": SMAP_LAYER, "dates": [SMAP_DATES[i] for i in keep],
                                "cells": {c: [days[i][c] for i in keep] for c in px}}))
    print(rid, "SMAP", len(keep), "dates,", len(px), "cells")


# GPM IMERG Final monthly (V07, 0.1 deg, mm/hr) from GES DISC OPeNDAP, one bbox subset per month.
IMERG = "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGM.07"


def fetch_imerg(rid, region, db):
    path = RAW / f"{rid}.imerg.json"
    if path.exists():
        return
    token = os.environ.get("EARTHDATA_TOKEN")
    if not token:
        raise SystemExit("--imerg needs EARTHDATA_TOKEN (urs.earthdata.nasa.gov -> Generate Token)")
    (s, w), (n, e) = region["bbox"]
    i0, i1 = int((w + 180) / 0.1), int((e + 180) / 0.1)  # grid is [time][lon][lat], cell centres at -179.95 + 0.1 i
    j0, j1 = int((s + 90) / 0.1), int((n + 90) / 0.1)
    keys = {}  # POWER box -> IMERG pixels under its cells
    for c, v in db["cells"].items():
        if v["soil"]:
            keys.setdefault(v["power"], set()).add((int((v["lon"] + 180) / 0.1) - i0, int((v["lat"] + 90) / 0.1) - j0))
    months = [(y, m) for y in range(YEARS[0], YEARS[1] + 1) for m in range(1, 13)]

    def one(ym):
        y, m = ym
        f = f"3B-MO.MS.MRG.3IMERG.{y}{m:02d}01-S000000-E235959.{m:02d}.V07B.HDF5"
        q = urllib.parse.quote(f"precipitation[0:0][{i0}:{i1}][{j0}:{j1}]", safe="")
        txt = fetch_bytes(f"{IMERG}/{y}/{f}.ascii?{q}", headers={"Authorization": f"Bearer {token}"}).decode()
        grid = [[float(x) for x in line.split(",")[1:]] for line in txt.splitlines() if line.startswith("precipitation[")]
        hours = 24 * calendar.monthrange(y, m)[1]
        return {k: round(sum(grid[i][j] for i, j in px) / len(px) * hours, 1) for k, px in keys.items()}

    with ThreadPoolExecutor(6) as ex:
        out = list(ex.map(one, months))
    path.write_text(json.dumps({"product": "GPM_3IMERGM.07", "units": "mm/month",
                                "months": [f"{y}-{m:02d}" for y, m in months],
                                "power": {k: [o[k] for o in out] for k in keys}}))
    print(rid, "IMERG", len(months), "months,", len(keys), "POWER boxes")


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
        if "--smap" in sys.argv:
            fetch_smap(rid, region, db)
        if "--imerg" in sys.argv:
            fetch_imerg(rid, region, db)


if __name__ == "__main__":
    main()
