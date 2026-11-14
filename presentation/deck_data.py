"""Pull the numbers the deck charts from the app's own build output (web/public/data/*.json)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
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
    )
(Path(__file__).parent / "deck_data.json").write_text(json.dumps(out))
for rid, r in out.items():
    print(rid, r["cells"], r["pareto"], r["searched"], len(r["cloud"]))
    for s in r["strategies"]:
        worst = min(zip(s["median"], s["years"]))
        print("  ", s["id"], "today", s["today"], "twin", s["twin"], "loss", s["twin_loss"], "worst", worst,
              "2008", dict(zip(s["years"], s["median"])).get(2008), "irr", s["m"]["irr"][1], "bare", s["m"]["bare_days"])
