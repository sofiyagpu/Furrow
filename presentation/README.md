# Furrow pitch deck (3 min, 5 slides, English)

`Furrow.pptx`:

| Slide | Time | What |
|---|---|---|
| 1 | 0:00–1:00 | Opening crawl video: the problem and why it matters. Read it aloud; it moves on by itself |
| 2 | 1:00–1:30 | The app: field map and the time machine |
| 3 | 1:30–2:00 | What if: climate twin, trade-off search, Arizona water |
| 4 | 2:00–2:25 | The assistant, and what the ML repo adds next |
| 5 | 2:25–2:40 | Close over a looping video of the Earth turning (NASA Blue Marble), both regions marked |

Fly Through transitions between slides (PowerPoint 2010+, plain fade elsewhere), auto-playing builds, speaker notes
with timings. Numbers come from `web/public/data/*.json`.

Rebuild:

```bash
npm install pptxgenjs
../.venv/bin/python deck_data.py          # numbers from the app build
(cd ../web && npx vite --port 5199) &     # then:
node shoot.mjs                            # app screenshots at 2x through headless Chrome -> build/app_*.jpg
python make_assets.py                     # pillow numpy imageio-ffmpeg: stars, crawl.mp4, globe.mp4
node build.js && python3 animate.py       # -> Furrow.pptx
```

Fonts (Google Fonts, SIL OFL): the slides use Libre Franklin, which Microsoft 365 also serves as a cloud font, so it
shows on any machine with Office. The videos are set in News Cycle and Libre Franklin Black from `fonts/`.
