"""Two demo regions. bbox = ((south, west), (north, east))."""
H3_RES = 5  # ~250 km2 cells: enough to show soil contrast, small enough for SoilGrids fair use

REGIONS = {
    "az": {
        "name": "Pinal County, Arizona", "name_ru": "Округ Пинал, Аризона",
        "bbox": ((32.65, -112.15), (33.15, -111.35)),
        "irrigated": True,
    },
    "vko": {
        "name": "East Kazakhstan (Shemonaikha, Glubokoe)", "name_ru": "ВКО (Шемонаиха, Глубокое)",
        "bbox": ((50.2, 81.3), (50.9, 82.6)),
        "irrigated": False,
    },
}
