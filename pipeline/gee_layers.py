"""Google Earth Engine side of the pipeline: per-cell, per-dekad features for both regions.

Not needed to run the demo (the app runs on NASA POWER + SoilGrids + NASA GIBS tiles). Run this when you
have an Earth Engine project, to replace fixed slope with SRTM, and add HLS NDVI, SMAP, IMERG, GRACE,
NEX-GDDP-CMIP6 deltas. Output: data/gee/<region>.json, keyed by H3 cell.

    pip install earthengine-api && earthengine authenticate
    .venv/bin/python pipeline/gee_layers.py --project <your-ee-project>
"""
import argparse, json
from pathlib import Path
import h3

from regions import REGIONS
from fetch import cells

OUT = Path(__file__).resolve().parent.parent / "data" / "gee"


def main():
    import ee

    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True)
    ap.add_argument("--year", type=int, default=2024)
    a = ap.parse_args()
    ee.Initialize(project=a.project)
    y0, y1 = f"{a.year}-01-01", f"{a.year + 1}-01-01"

    def hls_ndvi(img):  # HLS Landsat: B5 NIR, B4 red; Fmask bits 1-3 cloud/adjacent/shadow
        ok = img.select("Fmask").bitwiseAnd(0b1110).eq(0)
        return img.normalizedDifference(["B5", "B4"]).rename("ndvi").updateMask(ok).copyProperties(img, ["system:time_start"])

    srtm = ee.Image("USGS/SRTMGL1_003")
    slope = ee.Terrain.slope(srtm).rename("slope_deg")
    ndvi = ee.ImageCollection("NASA/HLS/HLSL30/v002").filterDate(y0, y1).map(hls_ndvi)
    smap = ee.ImageCollection("NASA/SMAP/SPL4SMGP/007").filterDate(y0, y1).select(["sm_surface", "sm_rootzone"])
    imerg = ee.ImageCollection("NASA/GPM_L3/IMERG_V07").filterDate(y0, y1).select("precipitation")
    grace = ee.ImageCollection("NASA/GRACE/MASS_GRIDS_V04/MASCON_CRI").select("lwe_thickness")
    gddp = ee.ImageCollection("NASA/GDDP-CMIP6")

    def trend(col):  # cm/yr of liquid water equivalent
        t = col.map(lambda i: i.addBands(ee.Image(i.date().difference(ee.Date("2002-01-01"), "year")).float().rename("t")))
        return t.select(["t", "lwe_thickness"]).reduce(ee.Reducer.linearFit()).select("scale")

    def delta(var, scen):  # 2041-2060 minus 1995-2014, ensemble mean
        hist = gddp.filter(ee.Filter.eq("scenario", "historical")).filterDate("1995-01-01", "2015-01-01").select(var).mean()
        fut = gddp.filter(ee.Filter.eq("scenario", scen)).filterDate("2041-01-01", "2061-01-01").select(var).mean()
        return fut.subtract(hist) if var == "tas" else fut.divide(hist).subtract(1)

    OUT.mkdir(parents=True, exist_ok=True)
    for rid, region in REGIONS.items():
        feats = []
        for c in cells(region):
            ring = [(lon, lat) for lat, lon in h3.cell_to_boundary(c)]
            feats.append(ee.Feature(ee.Geometry.Polygon([ring]), {"h3": c}))
        fc = ee.FeatureCollection(feats)
        stack = (slope.addBands(ndvi.median()).addBands(smap.mean()).addBands(imerg.sum().multiply(0.5).rename("imerg_mm"))
                 .addBands(trend(grace).rename("grace_cm_yr"))
                 .addBands(delta("tas", "ssp245").rename("dT_ssp245")).addBands(delta("pr", "ssp245").rename("dP_ssp245"))
                 .addBands(delta("tas", "ssp585").rename("dT_ssp585")).addBands(delta("pr", "ssp585").rename("dP_ssp585")))
        res = stack.reduceRegions(fc, ee.Reducer.mean(), scale=1000).getInfo()
        rows = {f["properties"].pop("h3"): f["properties"] for f in res["features"]}
        (OUT / f"{rid}.json").write_text(json.dumps(rows, indent=1))
        print(rid, len(rows), "cells")


if __name__ == "__main__":
    main()
