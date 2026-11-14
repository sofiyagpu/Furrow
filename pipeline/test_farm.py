"""Priority numbers and the SMAP check.  .venv/bin/python -m pytest pipeline/test_farm.py"""
from build import farm, smap_check


def season(crop, year, revenue, eta=80, etc=100):
    return dict(crop=crop, year=year, revenue=revenue, eta=eta, etc=etc)


def test_farm_n_credit_market_and_stress():
    # vko: wheat 50 kg N, lentil 0 and a legume, so the next wheat buys 50 - 30
    s = [season("wheat", 2001, 600), season("lentil", 2002, 800, eta=50), season("wheat", 2003, 600), season("fallow", 2004, 0, 0, 0)]
    f = farm(s, "vko")
    assert f["n_kg"] == round((50 + 0 + 20 + 0) / 4, 1)
    assert f["revenue"] == 500.0
    assert f["deep_market"] == 1.0  # wheat and lentil both deep
    assert f["water_stress"] == round((0.2 + 0.5 + 0.2) / 3, 2)  # fallow has no crop water demand


def test_farm_thin_market_share():
    f = farm([season("wheat", 2001, 300), season("millet", 2002, 100)], "vko")
    assert f["deep_market"] == 0.75


def test_smap_missing_file():
    assert smap_check("nowhere", "x", []) is None


def test_imerg_power_scales_months():
    from build import imerg_power
    power = {"dates": ["20200101", "20200102", "20200201", "20200301"], "PRECTOTCORR": [2.0, 2.0, 0.5, -999.0]}
    out = imerg_power(power, {"months": ["2020-01", "2020-02", "2020-03"], "mm": [8.0, 9.0, 5.0]})
    assert out["PRECTOTCORR"] == [4.0, 4.0, 0.5, -999.0]  # Jan x2; Feb under 1 mm stays; missing stays missing
    assert power["PRECTOTCORR"][0] == 2.0  # input untouched
