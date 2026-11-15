"""Pull the numbers the deck charts from the app's own build output (web/public/data/*.json) and the ML repo's reports.
    FURROW_ROOT=<app checkout> ML_REPORTS=<carver-ml/reports/azwide_2021> python deck_data.py
"""
import csv
import json
import os
from pathlib import Path

ROOT = Path(os.environ.get("FURROW_ROOT", Path(__file__).resolve().parent.parent))
out = {}
for rid in ("vko", "az"):
    d = json.loads((ROOT / "web/public/data" / f"{rid}.json").read_text())
    tw = d["twin"]
    i0, j0 = tw["dT"].index(0), tw["dP"].index(0)
    i2, j2 = tw["dT"].index(2), tw["dP"].index(-0.1)
    out[rid] = dict(
        name=d["name"], years=d["years"], cells=len(d["cells"]), pareto=len(d["pareto"]), searched=len(d["cloud"]),
        strategies=[dict(id=s["id"], name=s["name"], idea=s["idea"], risk=s["risk"], m=s["metrics"],
                         carbon=s["carbon"], water_saved=s["water_saved_mm"],
                         years=[t["year"] for t in s["timeline"]], median=[t["profit"][1] for t in s["timeline"]],
                         today=tw["grid"][s["id"]][i0][j0]["profit"][1], twin=tw["grid"][s["id"]][i2][j2]["profit"][1],
                         twin_loss=tw["grid"][s["id"]][i2][j2]["loss_years"])
                    for s in d["strategies"]],
        front=[[p["metrics"]["erosion"], p["metrics"]["profit"][1]] for p in d["pareto"]],
        cloud=[[p["metrics"]["erosion"], p["metrics"]["profit"][1]] for p in d["cloud"] if p["metrics"]["erosion"] < 50],
        climate=d["climate"],
        smap={k: d["smap"][k] for k in ("n", "r", "r_anom")} if d.get("smap") else None,
        imerg={k: v["profit"][1] for k, v in d["imerg"]["strategies"].items()} if d.get("imerg") else None,
    )
rep = os.environ.get("ML_REPORTS")
if rep:
    summ = json.loads((Path(rep) / "summary_2021.json").read_text())
    rows = {r["group"]: r for r in csv.DictReader(open(Path(rep) / "class_metrics_2021.csv"))}
    sw = Path(rep) / "buffer_sweep_summary_2021.csv"
    sweep = list(csv.DictReader(open(sw))) if sw.exists() else []
    out["ml"] = dict(f1={g: round(float(r["f1_agri_truth"]), 3) for g, r in rows.items() if g != "other"},
                     n_pixels=summ["n_grid_pixels"], n_features=summ["n_features"],
                     macro_f1=round(summ["macro_f1_rule_agri_truth"], 2), accuracy=round(summ["accuracy_agri_truth"], 2),
                     baseline=round(summ["majority_baseline_agri_truth"], 2), dates=summ["dates"], dates_used=summ["dates_used"],
                     sweep={r["buffer_px"]: round(float(r["macro_f1_rule_on_agri_px"]), 3) for r in sweep})
(Path(__file__).parent / "deck_data.json").write_text(json.dumps(out))
print(out.get("ml"))
for rid, r in ((k, v) for k, v in out.items() if k != "ml"):
    print(rid, r["cells"], r["pareto"], r["searched"], len(r["cloud"]))
    for s in r["strategies"]:
        worst = min(zip(s["median"], s["years"]))
        print("  ", s["id"], "today", s["today"], "twin", s["twin"], "loss", s["twin_loss"], "worst", worst,
              "2008", dict(zip(s["years"], s["median"])).get(2008), "irr", s["m"]["irr"][1], "bare", s["m"]["bare_days"])
