# Furrow pitch deck (3 min, 7 slides)

`Furrow.pptx`: opening crawl video (~26 s, plays on its own), then 6 slides with wipe transitions and
auto-playing builds. Speaker notes carry the timing (0:00–3:00). Numbers come from `web/public/data/*.json`.

Rebuild:

```bash
npm install pptxgenjs
../.venv/bin/python deck_data.py          # numbers from the app build
python make_assets.py                     # needs pillow numpy imageio-ffmpeg + MS Office fonts: stars, planet, crawl.mp4
node build.js && python3 animate.py       # -> Furrow.pptx
```
