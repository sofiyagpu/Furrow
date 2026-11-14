# Furrow pitch deck (3 min, 7 slides)

`Furrow.pptx`: opening crawl video (~26 s, plays on its own), then 6 slides with Fly Through transitions
(PowerPoint 2010+, plain fade elsewhere) and auto-playing builds. Speaker notes carry the timing (0:00–3:00). Numbers come from `web/public/data/*.json`.

Rebuild:

```bash
npm install pptxgenjs
../.venv/bin/python deck_data.py          # numbers from the app build
python make_assets.py                     # needs pillow numpy imageio-ffmpeg: stars, planet, crawl.mp4
node build.js && python3 animate.py       # -> Furrow.pptx
```

Fonts (Google Fonts, SIL OFL): the slides use Libre Franklin, which Microsoft 365 also serves as a cloud font, so it
shows on any machine with Office. The crawl video is set in News Cycle and Libre Franklin Black from `fonts/`,
baked into the frames.
