"""Crop parameters, prices and the strategies. Every number here is an ASSUMPTION for the demo,
order of magnitude from FAO-56 / FAO-33 tables and public price ranges; an agronomist replaces them.

Season: sow = day of year, days = length. kc = (ini, mid, end) FAO-56 style. ky = FAO-33 yield response.
ymax = attainable yield t/ha in the region with no water stress. heat = Tmax (C) above which flowering suffers.
res = residue cover fraction left at harvest (no-till). cin = t C/ha returned per t of yield (straw + roots).
cbase = t C/ha returned regardless of yield (roots, stubble). fix = legume (N credit to the next crop).
price $/t, cost $/ha (seed, fert, fuel, ops; not land or water).
"""

C = lambda **k: k  # noqa: E731

CROPS = {
    "vko": {
        "wheat":    C(label="Spring wheat", sow=135, days=105, kc=(0.3, 1.15, 0.3), ky=1.15, ymax=3.2, heat=33, res=0.75, cin=1.1, cbase=0.4, price=190, cost=190, family="cereal"),
        "fallow":   C(label="Black fallow", sow=135, days=110, kc=(0, 0, 0), ky=0, ymax=0, heat=99, res=0.0, cin=0, cbase=0, price=0, cost=45, family="fallow", tillage_passes=3),
        "lentil":   C(label="Lentil", sow=140, days=90, kc=(0.4, 1.05, 0.3), ky=1.1, ymax=1.8, heat=32, res=0.30, cin=0.9, cbase=0.3, price=430, cost=210, family="pulse", fix=True),
        "pea":      C(label="Field pea", sow=130, days=90, kc=(0.4, 1.10, 0.3), ky=1.1, ymax=2.4, heat=30, res=0.35, cin=0.8, cbase=0.3, price=230, cost=200, family="pulse", fix=True),
        "flax":     C(label="Oilseed flax", sow=140, days=105, kc=(0.35, 1.05, 0.25), ky=1.0, ymax=1.6, heat=32, res=0.55, cin=1.2, cbase=0.3, price=420, cost=190, family="oilseed"),
        "rapeseed": C(label="Spring rapeseed", sow=135, days=110, kc=(0.35, 1.10, 0.35), ky=1.05, ymax=1.9, heat=30, res=0.45, cin=1.3, cbase=0.35, price=440, cost=240, family="oilseed"),
        "sainfoin": C(label="Sainfoin (hay)", sow=120, days=140, kc=(0.5, 1.0, 0.9), ky=0.9, ymax=4.0, heat=36, res=0.85, cin=0.35, cbase=1.2, price=70, cost=110, family="forage", fix=True, perennial=True),
        "chickpea": C(label="Chickpea", sow=140, days=100, kc=(0.4, 1.0, 0.35), ky=0.85, ymax=1.9, heat=35, res=0.30, cin=0.9, cbase=0.3, price=460, cost=210, family="pulse", fix=True),
        "millet":   C(label="Proso millet", sow=155, days=85, kc=(0.3, 1.0, 0.3), ky=0.9, ymax=2.4, heat=38, res=0.60, cin=1.0, cbase=0.35, price=180, cost=150, family="cereal"),
    },
    "az": {
        "cotton":   C(label="Upland cotton (lint + seed)", sow=105, days=180, kc=(0.35, 1.15, 0.6), ky=0.85, ymax=2.0, heat=46, res=0.20, cin=2.0, cbase=0.5, price=1750, cost=1600, family="fibre"),
        "durum":    C(label="Durum wheat", sow=345, days=160, kc=(0.3, 1.15, 0.3), ky=1.15, ymax=7.0, heat=35, res=0.70, cin=0.45, cbase=0.5, price=300, cost=1050, family="cereal"),
        "fallow":   C(label="Summer fallow", sow=160, days=150, kc=(0, 0, 0), ky=0, ymax=0, heat=99, res=0.0, cin=0, cbase=0, price=0, cost=60, family="fallow", tillage_passes=2),
        "guar":     C(label="Guar", sow=180, days=110, kc=(0.35, 1.0, 0.4), ky=0.9, ymax=2.0, heat=46, res=0.30, cin=0.9, cbase=0.35, price=650, cost=600, family="pulse", fix=True),
        "sorghum":  C(label="Grain sorghum", sow=185, days=115, kc=(0.3, 1.0, 0.55), ky=0.9, ymax=7.5, heat=42, res=0.60, cin=0.45, cbase=0.5, price=210, cost=850, family="cereal"),
        "cover":    C(label="Cowpea cover (no harvest)", sow=175, days=80, kc=(0.4, 0.95, 0.8), ky=0, ymax=0, heat=46, res=0.80, cin=0, cbase=1.4, price=0, cost=160, family="cover", fix=True),
        "barley":   C(label="Barley", sow=340, days=150, kc=(0.3, 1.15, 0.25), ky=1.0, ymax=6.0, heat=35, res=0.70, cin=0.45, cbase=0.5, price=230, cost=850, family="cereal"),
    },
}

# Strategies: hypotheses to discuss with an agronomist, not recommendations.
STRATEGIES = {
    "vko": [
        dict(id="current", name="Current: wheat, wheat, black fallow", rotation=["wheat", "wheat", "fallow"], notill=False,
             idea="Fallow stores a year of moisture for the next wheat.",
             risk="Soil lies bare 20+ months per cycle: wind erosion and humus loss."),
        dict(id="A", name="A. Diversify: wheat, lentil, flax, wheat", rotation=["wheat", "lentil", "flax", "wheat"], notill=True,
             idea="No fallow, no-till. Lentil fixes nitrogen, breaks cereal disease, adds export crops.",
             risk="No stored moisture: watch the dry years in the time machine."),
        dict(id="B", name="B. Soil and forage: sainfoin 2 yrs in the cycle", rotation=["wheat", "pea", "sainfoin", "sainfoin", "wheat"], notill=True,
             idea="Perennial cover builds organic matter and stops wind.",
             risk="Hay needs livestock or a buyer nearby."),
        dict(id="C", name="C. Drought-tolerant: wheat, chickpea, millet", rotation=["wheat", "chickpea", "millet"], notill=True,
             idea="Crops that tolerate heat and use less water.",
             risk="Thin markets for chickpea and millet in the region."),
    ],
    "az": [
        dict(id="current", name="Current: cotton, durum, summer fallow", rotation=["cotton", "durum", "fallow"], notill=False, irrigation="flood",
             idea="Two cash crops on groundwater and canal water.",
             risk="Bare fields through the monsoon dust season; heavy pumping."),
        dict(id="A", name="A. Water-wise: durum, guar on drip", rotation=["durum", "guar"], notill=True, irrigation="drip",
             idea="Winter grain uses cool-season rain; guar is a low-water summer legume.",
             risk="Drip costs money up front; guar has one main buyer chain."),
        dict(id="B", name="B. Cover the summer: cotton, durum, cowpea cover", rotation=["cotton", "durum", "cover"], notill=True, irrigation="flood",
             idea="Keeps the cotton income, covers soil in dust season, feeds soil carbon.",
             risk="A summer cover in the desert drinks water that earns no direct income."),
        dict(id="C", name="C. Winter-only grain, summers fallow under stubble", rotation=["barley", "durum"], notill=True, irrigation="drip",
             idea="Farm only the cool season, leave summer water in the aquifer.",
             risk="Lowest income; works only with water-saving payments."),
    ],
}

IRRIGATION = {"flood": 0.70, "drip": 0.90}  # application efficiency
PUMP_COST = 0.05          # $/m3 pumping + delivery, ~$60 per acre-foot (assumption)
CO2_PRICE = (15, 35)      # $/t CO2e voluntary soil-carbon range (assumption)
