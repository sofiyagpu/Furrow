"""Deck art: starfield, the planet (a real MODIS frame of the VKO fields), app screenshot crops, the opening crawl video.
Needs pillow, numpy, imageio-ffmpeg. Fonts in ./fonts (Google Fonts).
    python make_assets.py
"""
import subprocess
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
IMG, SHOTS = HERE / "img", HERE.parent / "shots" / "tiles"
OUT = HERE / "build"
OUT.mkdir(exist_ok=True)
FONTS = HERE / "fonts"  # Google Fonts, OFL: News Cycle (News Gothic revival), Libre Franklin (Franklin Gothic revival)
NEWS_B, NEWS = FONTS / "NewsCycle-Bold.ttf", FONTS / "NewsCycle-Regular.ttf"
HEAVY = FONTS / "LibreFranklin-Black.ttf"
W, H, FPS = 1920, 1080, 30
YELLOW, BLUE = (255, 232, 31), (75, 213, 238)


def stars(seed=7):
    rng = np.random.default_rng(seed)
    a = np.zeros((H, W, 3), np.float32)
    a[:] = (3, 4, 10)
    # faint dust band
    yy, xx = np.mgrid[0:H, 0:W]
    band = np.exp(-(((yy - 0.55 * H) - 0.35 * (xx - W / 2)) ** 2) / (2 * 260 ** 2))
    a += band[..., None] * np.array([10, 9, 16])
    im = Image.fromarray(a.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    for _ in range(900):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        b = rng.power(9) * 210
        tint = rng.choice([(1, 1, 1), (0.85, 0.9, 1), (1, 0.95, 0.85)])
        c = tuple(int(b * t) for t in tint)
        r = 0.6 if b < 200 else 1.1
        d.ellipse([x - r, y - r, x + r, y + r], fill=c)
    glow = im.filter(ImageFilter.GaussianBlur(2.2))
    return Image.fromarray(np.maximum(np.asarray(im), (np.asarray(glow) * 1.1).clip(0, 255).astype(np.uint8)))


def planet():
    """A sphere wrapped in the real MODIS frame of the East Kazakhstan fields, with a lit rim."""
    S = 1400
    src = Image.open(IMG / "vko_true.jpg").convert("RGB").resize((1600, 900))
    tex = np.asarray(src.crop((150, 0, 1050, 900)).resize((S, S)), np.float32)
    yy, xx = (np.mgrid[0:S, 0:S] - S / 2 + 0.5) / (S / 2 - 40)
    rr = np.sqrt(xx ** 2 + yy ** 2)
    inside = rr < 1
    z = np.sqrt(np.clip(1 - rr ** 2, 0, 1))
    # spherical lookup so the fields bend over the limb
    u = ((np.arcsin(np.clip(xx, -1, 1)) / np.pi + 0.5) * (S - 1)).astype(int)
    v = ((np.arcsin(np.clip(yy, -1, 1)) / np.pi + 0.5) * (S - 1)).astype(int)
    col = tex[v.clip(0, S - 1), u.clip(0, S - 1)] * 1.25
    light = np.clip(0.25 + 0.95 * (z * 0.6 + (-xx * 0.55 - yy * 0.45)), 0.04, 1.2)
    col = col * light[..., None]
    rim = np.exp(-((1 - rr) / 0.035) ** 2) * inside * np.clip(-xx - yy + 0.6, 0, 1.4)
    col += rim[..., None] * np.array([40, 70, 95])
    out = np.zeros((S, S, 4), np.float32)
    out[..., :3] = col
    out[..., 3] = inside * 255
    # atmosphere halo outside the disc
    halo = np.exp(-((rr - 1) / 0.03) ** 2) * (rr >= 1) * np.clip(-xx - yy + 0.8, 0, 1.5)
    out[..., :3] += (halo[..., None] * np.array([60, 110, 150])) * (rr >= 1)[..., None]
    out[..., 3] = np.maximum(out[..., 3], halo * 90)
    Image.fromarray(out.clip(0, 255).astype(np.uint8), "RGBA").save(OUT / "planet.png")


def crops():
    boxes = {  # app screenshots at 1440x900, nav and section headings cut off
        "shot_map.jpg": ("desktop-sec-03-a.jpg", (100, 130, 1340, 822)),
        "shot_cards.jpg": ("desktop-sec-04-a.jpg", (100, 262, 1340, 830)),
        "shot_time.jpg": ("desktop-sec-05-a.jpg", (100, 256, 1340, 784)),
        "shot_trade.jpg": ("desktop-sec-07-a.jpg", (100, 290, 1340, 900)),
    }
    for name, (src, box) in boxes.items():
        Image.open(SHOTS / src).convert("RGB").crop(box).save(OUT / name, quality=92)


# ---------- crawl ----------
INTRO = ["Not long ago, on a field", "not so far away...."]
HEAD = ["SPACE APPS 2026", "THE BARE FIELD"]
BODY = [
    "Rain comes late or not at all. On the Kazakh steppe, every third summer a field lies bare as black fallow, "
    "and the wind carries its soil away. In Arizona, wells drain an aquifer that GRACE-FO watches from orbit.",
    "Farmers know other rotations exist. What they lack is proof from their own field, in their own weather. "
    "Armed with twenty-two seasons of NASA data, a small crew sets out to build FURROW....",
]


def plane_text(width=1500, pad=0):
    f_body, f_ep, f_title = (ImageFont.truetype(str(NEWS_B), s) for s in (74, 66, 110))
    probe = ImageDraw.Draw(Image.new("L", (1, 1)))
    lines = []  # (kind, words or text)
    lines += [("c", HEAD[0], f_ep), ("gap", 30, None), ("c", HEAD[1], f_title), ("gap", 80, None)]
    space = probe.textlength(" ", font=f_body)
    for para in BODY:
        words, cur = para.split(), []
        for w in words:
            trial = " ".join(cur + [w])
            if probe.textlength(trial, font=f_body) > width and cur:
                lines.append(("j", cur, f_body))
                cur = [w]
            else:
                cur.append(w)
        lines.append(("l", cur, f_body))
        lines.append(("gap", 62, None))
    lh = 104
    total = pad * 2 + sum(x[1] if x[0] == "gap" else (150 if x[2] is f_title else lh) for x in lines)
    im = Image.new("L", (width, int(total)), 0)
    d = ImageDraw.Draw(im)
    y = pad
    for kind, val, font in lines:
        if kind == "gap":
            y += val
            continue
        if kind == "c":
            d.text(((width - d.textlength(val, font=font)) / 2, y), val, font=font, fill=255)
        else:
            widths = [d.textlength(w, font=font) for w in val]
            gap = (width - sum(widths)) / max(1, len(val) - 1) if kind == "j" else space
            x = 0
            for w, ww in zip(val, widths):
                d.text((x, y), w, font=font, fill=255)
                x += ww + gap
        y += 150 if font is f_title else lh
    return im


def coeffs(dst, src):
    """PIL perspective coefficients mapping output (dst) quad -> input (src) quad."""
    A, B = [], []
    for (x, y), (u, v) in zip(dst, src):
        A += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]
        B += [u, v]
    return np.linalg.solve(np.array(A, float), np.array(B, float)).tolist()


def crawl():
    bg = stars()
    bg.save(OUT / "stars.png")
    bg_a = np.asarray(bg, np.float32)
    pw = 1500
    win = 1500  # plane length visible between near and far edge
    text = plane_text(pw, pad=win)
    text_a = text
    # screen trapezoid: far edge narrow near the top, near edge wider than the screen
    top_y, bot_y = 150, H + 60
    top_w, bot_w = 440, 2050
    dst = [((W - top_w) / 2, top_y), ((W + top_w) / 2, top_y), ((W + bot_w) / 2, bot_y), ((W - bot_w) / 2, bot_y)]
    fade = np.clip((np.arange(H) - top_y - 40) / 420, 0, 1)[:, None]

    f_intro = ImageFont.truetype(str(NEWS), 62)
    intro = Image.new("L", (W, H), 0)
    di = ImageDraw.Draw(intro)
    for i, line in enumerate(INTRO):
        di.text((520, 440 + i * 84), line, font=f_intro, fill=255)
    intro_a = np.asarray(intro, np.float32)[..., None] / 255

    f_logo = ImageFont.truetype(str(HEAVY), 300)
    lg = Image.new("L", (1500, 420), 0)
    dl = ImageDraw.Draw(lg)
    tw = dl.textlength("FURROW", font=f_logo)
    dl.text(((1500 - tw) / 2, 30), "FURROW", font=f_logo, fill=0, stroke_width=11, stroke_fill=255)
    hollow = Image.new("L", lg.size, 0)
    ImageDraw.Draw(hollow).text(((1500 - tw) / 2, 30), "FURROW", font=f_logo, fill=255)
    # outline only: stroke minus glyph interior
    logo = Image.fromarray(np.where(np.asarray(hollow) > 128, 0, np.asarray(lg)).astype(np.uint8))

    T_INTRO, T_LOGO, T_CRAWL, T_END = 3.6, 4.0, 7.5, 27.0
    n = int(T_END * FPS)
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    proc = subprocess.Popen([ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                             "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium",
                             "-movflags", "+faststart", str(OUT / "crawl.mp4")], stdin=subprocess.PIPE)
    yel = np.array(YELLOW, np.float32)
    poster_t = 14.0
    for k in range(n):
        t = k / FPS
        fr = bg_a.copy()
        if t < T_INTRO:
            a = min(1, t / 0.8) * min(1, max(0, (T_INTRO - t) / 0.7))
            fr = fr * (1 - intro_a * a) + intro_a * a * np.array(BLUE)
        if T_LOGO <= t < T_LOGO + 7:
            p = (t - T_LOGO) / 7
            sc = 2.4 * (0.012 / 2.4) ** p  # exponential recession into the stars
            if sc * 1500 > 8:
                li = logo.resize((max(1, int(1500 * sc)), max(1, int(420 * sc))), Image.BICUBIC)
                la = np.asarray(li, np.float32)[..., None] / 255 * min(1, (1 - p) / 0.25)
                full = np.zeros((H, W, 1), np.float32)
                x0, y0 = (W - li.width) // 2, (H - li.height) // 2
                sx0, sy0 = max(0, -x0), max(0, -y0)
                dx0, dy0 = max(0, x0), max(0, y0)
                wv, hv = min(W - dx0, li.width - sx0), min(H - dy0, li.height - sy0)
                full[dy0:dy0 + hv, dx0:dx0 + wv] = la[sy0:sy0 + hv, sx0:sx0 + wv]
                fr = fr * (1 - full) + full * yel
        if t >= T_CRAWL:
            total = text_a.height - win
            s = min(total, (t - T_CRAWL) / (T_END - T_CRAWL - 1) * total)
            src = [(0, s), (pw, s), (pw, s + win), (0, s + win)]
            warped = text_a.transform((W, H), Image.PERSPECTIVE, coeffs(dst, src), Image.BICUBIC)
            m = np.asarray(warped, np.float32)[..., None] / 255 * fade[..., None]
            fr = fr * (1 - m) + m * yel
        frame = fr.clip(0, 255).astype(np.uint8)
        proc.stdin.write(frame.tobytes())
        if abs(t - poster_t) < 0.5 / FPS:
            Image.fromarray(frame).save(OUT / "crawl_poster.jpg", quality=90)
    proc.stdin.close()
    proc.wait()


if __name__ == "__main__":
    planet()
    crops()
    crawl()
    print("assets in", OUT)
