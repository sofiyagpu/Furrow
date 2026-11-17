# Furrow pitch deck (3 min, 6 slides, English)

`Furrow.pptx`:

| Slide | Time | What |
|---|---|---|
| 1 | 0:00–1:00 | Opening crawl video with an original space-fanfare soundtrack. Read it aloud; it moves on by itself |
| 2 | 1:00–1:20 | The app: live screenshots of the field map and the strategies view |
| 3 | 1:20–1:45 | Time machine: native line chart, 22 seasons, four rotations |
| 4 | 1:45–2:10 | What if: climate twin chart, trade-off search, SMAP and IMERG cross-check |
| 5 | 2:10–2:40 | ML plan (HLS + CDL, RandomForest and Prithvi-EO-2.0 branches) and first RandomForest F1 |
| 6 | 2:40–3:00 | Close over the turning Earth, with the QR code and the Space Apps logo |

Fly Through transitions between slides (PowerPoint 2010+, plain fade elsewhere), auto-playing builds, speaker notes
with timings. Numbers come from `web/public/data/*.json`.

Rebuild:

```bash
npm install pptxgenjs
FURROW_ROOT=.. ML_REPORTS=<carver-ml>/reports/bboxB_2021 ../.venv/bin/python deck_data.py   # app + ML numbers
(cd ../web && npx vite --port 5199) &     # then:
node shoot.mjs                            # one 1440x900 @2x screenshot per app view -> build/app_*.jpg
python make_assets.py                     # pillow numpy imageio-ffmpeg: stars, crawl.mp4, globe.mp4
node build.js && python3 animate.py       # -> Furrow.pptx
```

Fonts (Google Fonts, SIL OFL): the slides use Libre Franklin, which Microsoft 365 also serves as a cloud font, so it
shows on any machine with Office. The videos are set in News Cycle and Libre Franklin Black from `fonts/`.

NASA Space Apps logo: official 2026 file from https://www.spaceappschallenge.org/brand/ (img/spaceapps_logo.png), used per the Space Apps brand guide.

Soundtrack: synthesised in `make_assets.py` (original, not a film score). To use a track you hold the rights to:
`AUDIO=/path/to/track.mp3 python make_assets.py`.
