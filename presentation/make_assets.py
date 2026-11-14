"""Deck art: starfield, the opening crawl video, the closing rotating Earth (NASA Blue Marble).
Needs pillow, numpy, imageio-ffmpeg. Fonts in ./fonts (Google Fonts).
    python make_assets.py
"""
import subprocess
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
IMG = HERE / "img"
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


# ---------- crawl ----------
INTRO = ["Not long ago, on a field", "not so far away...."]
HEAD = ["SPACE APPS 2026", "THE BARE FIELD"]
BODY = [
    "It is a time of shifting seasons. Temperatures climb, rain comes late or not at all, "
    "and the heat arrives just as the wheat flowers. Year after year the soil grows thinner.",
    "On the steppe of East Kazakhstan, every third summer a field lies bare as black fallow. "
    "The wind carries its soil away, and four seasons in ten lose money. In the Arizona desert, "
    "fields stand bare 229 days a year while wells pump an aquifer that the GRACE-FO satellites watch drain from orbit.",
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

    T_INTRO, T_LOGO, T_CRAWL, T_END = 3.4, 3.8, 6.5, 60.0  # one minute; ~124 words read aloud at ~140 wpm
    n = int(T_END * FPS)
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    proc = subprocess.Popen([ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                             "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium",
                             "-movflags", "+faststart", str(OUT / "crawl.mp4")], stdin=subprocess.PIPE)
    yel = np.array(YELLOW, np.float32)
    poster_t = 25.0
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
            total = text_a.height - win - int(win * 0.72)  # stop with the last lines still on screen
            s = min(total, (t - T_CRAWL) / (T_END - T_CRAWL - 3) * total)
            src = [(0, s), (pw, s), (pw, s + win), (0, s + win)]
            warped = text_a.transform((W, H), Image.PERSPECTIVE, coeffs(dst, src), Image.BICUBIC)
            m = np.asarray(warped, np.float32)[..., None] / 255 * fade[..., None] * min(1, (T_END - t) / 2)
            fr = fr * (1 - m) + m * yel
        frame = fr.clip(0, 255).astype(np.uint8)
        proc.stdin.write(frame.tobytes())
        if abs(t - poster_t) < 0.5 / FPS:
            Image.fromarray(frame).save(OUT / "crawl_poster.jpg", quality=90)
    proc.stdin.close()
    proc.wait()
    add_audio(OUT / "crawl.mp4", T_END)


# ---------- crawl soundtrack ----------
SR = 44100


def _note(n):  # semitones from A4
    return 440.0 * 2 ** (n / 12)


def _env(n, a, d, sus, r, length):
    e = np.ones(length) * sus
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    e[:a] = np.linspace(0, 1, a)
    e[a:a + d] = np.linspace(1, sus, len(e[a:a + d]))
    if r:
        e[-r:] *= np.linspace(1, 0, r)
    return e[:length]


def _lowpass(x, cut):
    """One-pole lowpass; cut may be a per-sample array (brightness that follows the envelope)."""
    a = np.exp(-2 * np.pi * np.broadcast_to(cut, x.shape) / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):  # ponytail: plain loop, ~1 s per minute of audio
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def _brass(freq, dur, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.clip(t / 0.4, 0, 1)
    ph = 2 * np.pi * freq * np.cumsum(vib) / SR
    saw = sum(np.sin(k * ph) / k for k in range(1, 14))
    env = _env(n, 0.06, 0.25, 0.75, min(0.35, dur / 3), n)
    return _lowpass(saw * env, 600 + 3200 * env * vel) * vel


def _strings(freqs, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        for det in (-0.12, 0.0, 0.13):
            ph = 2 * np.pi * f * 2 ** (det / 12) * t + np.random.default_rng(int(f)).uniform(0, 6)
            out += sum(np.sin(k * ph) / k for k in range(1, 8))
    env = _env(n, 0.9, 0.1, 1.0, 0.9, n)
    return _lowpass(out * env / (3 * len(freqs)), 1400)


def _timpani(freq, vel=1.0, dur=2.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (1 + 0.15 * np.exp(-t * 30))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    hit = np.random.default_rng(3).normal(0, 1, n) * np.exp(-t * 40) * 0.3
    return (body + hit) * vel


def soundtrack(length):
    """An original space fanfare (not the film's theme): a brass hit with timpani as the logo appears,
    a short heroic phrase, then a slow string progression under the crawl. Eb major."""
    out = np.zeros(int(length * SR) + SR * 3)

    def put(x, at, gain=1.0):
        i = int(at * SR)
        out[i:i + len(x)] += x[:len(out) - i] * gain

    Eb2, Bb2, Eb3, G3, Bb3, Eb4 = -30, -23, -18, -14, -11, -6
    put(_strings([_note(Eb3), _note(Bb3)], 3.6), 0.0, 0.25)  # low hush before the logo
    t0 = 3.8
    for n_ in (Eb3, G3, Bb3, Eb4, Eb2 + 12):
        put(_brass(_note(n_), 2.6, 1.0), t0, 0.22)
    put(_timpani(_note(Eb2)), t0, 0.9)
    # heroic phrase: original, stepwise, dotted rhythm
    phrase = [(Eb4, 0.45), (-4, 0.15), (-2, 0.6), (1, 0.6), (-1, 0.45), (-2, 0.15), (-4, 0.6), (-6, 1.2),
              (-2, 0.45), (-1, 0.15), (1, 0.6), (3, 0.6), (1, 0.45), (-1, 0.15), (1, 0.6), (Eb4 + 12, 1.6)]
    t = 6.2
    for n_, d in phrase:
        put(_brass(_note(n_), d + 0.12, 0.8), t, 0.3)
        t += d
    put(_timpani(_note(Bb2), 0.6), 6.2, 0.6)
    put(_timpani(_note(Eb2), 0.8), t - 1.6, 0.8)
    # strings under the crawl: Eb, Cm, Ab, Bb, 4 s each
    chords = [(Eb3, G3, Bb3), (-21, Eb3, G3), (-25, -21, Eb3), (-23, -19, -16)]
    k, tc = 0, t - 0.5
    while tc < length - 2:
        ch = chords[k % 4]
        put(_strings([_note(n_) for n_ in ch] + [_note(ch[0] - 12)], 4.6), tc, 0.5)
        if k % 2 == 1:  # a soft horn answer every other bar
            put(_brass(_note(ch[-1] + 12), 1.8, 0.45), tc + 1.0, 0.18)
        k += 1
        tc += 4
    # room: exponentially decaying noise as a cheap reverb
    ir = np.random.default_rng(9).normal(0, 1, int(1.8 * SR)) * np.exp(-np.arange(int(1.8 * SR)) / SR * 3.5)
    ir[0] = 25
    nfft = 1 << int(np.ceil(np.log2(len(out) + len(ir))))
    wet = np.fft.irfft(np.fft.rfft(out, nfft) * np.fft.rfft(ir, nfft), nfft)[:len(out)]
    mix = wet[:int(length * SR)]
    mix *= np.minimum(1, (length - np.arange(len(mix)) / SR) / 3)  # fade out over the last 3 s
    return (mix / np.abs(mix).max() * 0.85).astype(np.float32)


def add_audio(video, length):
    """Mux a soundtrack into the crawl. AUDIO=/path/to/licensed.mp3 uses your own file instead."""
    import os
    import wave
    src = os.environ.get("AUDIO")
    if not src:
        src = str(OUT / "crawl_audio.wav")
        a = (soundtrack(length) * 32767).astype(np.int16)
        with wave.open(src, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(a.tobytes())
    tmp = OUT / "crawl_av.mp4"
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", str(video), "-i", src, "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-af", f"afade=t=out:st={length - 3}:d=3", "-t", str(length),
                    "-movflags", "+faststart", str(tmp)], check=True)
    tmp.replace(video)


# ---------- closing globe ----------
GLOBE_T, GLOBE_R, GLOBE_C = 20.0, 380, (1370, 540)
PINS = [(50.5, 82.0, "EAST KAZAKHSTAN"), (32.9, -111.7, "PINAL COUNTY, ARIZONA")]


def blue_marble():
    f = IMG / "bluemarble.jpg"
    if not f.exists():
        import urllib.request
        url = ("https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&CRS=EPSG:4326"
               "&FORMAT=image/jpeg&LAYERS=BlueMarble_NextGeneration&BBOX=-90,-180,90,180&WIDTH=4096&HEIGHT=2048")
        urllib.request.urlretrieve(url, f)
    return np.asarray(Image.open(f).convert("RGB"), np.float32)


def globe():
    """A 20 s seamless loop: Earth turning once, seen from 25 N, the two demo regions pulsing as they pass,
    one satellite on an inclined orbit going round twice."""
    tex = blue_marble()
    th, tw = tex.shape[:2]
    bg = np.asarray(Image.open(OUT / "stars.png").convert("RGB"), np.float32)
    R, (cx, cy) = GLOBE_R, GLOBE_C
    S = 2 * R + 4
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    x, y = (xx - S / 2 + 0.5) / R, -(yy - S / 2 + 0.5) / R
    rr = np.sqrt(x * x + y * y)
    edge = np.clip((1 - rr) * R + 0.5, 0, 1)[..., None]  # antialiased limb
    z = np.sqrt(np.clip(1 - rr * rr, 0, 1))
    tilt = np.radians(25)
    X, Y, Z = x, y * np.cos(tilt) + z * np.sin(tilt), -y * np.sin(tilt) + z * np.cos(tilt)
    lat = np.degrees(np.arcsin(np.clip(Y, -1, 1)))
    lon0 = np.degrees(np.arctan2(X, Z))
    L = np.array([-0.55, 0.35, 0.76])
    L /= np.linalg.norm(L)
    shade = np.clip((x * L[0] + y * L[1] + z * L[2]) * 1.15 + 0.12, 0.05, 1.0)[..., None]
    rim = (np.exp(-((1 - rr) * R / 5) ** 2) * (rr <= 1) * 0.35)[..., None] * np.array([90, 150, 210])
    py = np.clip((90 - lat) / 180 * (th - 1), 0, th - 1)

    def sample(lon):
        px = ((lon + 180) % 360) / 360 * (tw - 1)
        x0, y0 = px.astype(int), py.astype(int)
        x1, y1 = (x0 + 1) % tw, np.minimum(y0 + 1, th - 1)
        fx, fy = (px - x0)[..., None], (py - y0)[..., None]
        top = tex[y0, x0] * (1 - fx) + tex[y0, x1] * fx
        bot = tex[y1, x0] * (1 - fx) + tex[y1, x1] * fx
        return top * (1 - fy) + bot * fy

    f_lab = ImageFont.truetype(str(NEWS_B), 26)
    inc = np.radians(55)
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    proc = subprocess.Popen([ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                             "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "21", "-preset", "medium",
                             "-movflags", "+faststart", str(OUT / "globe.mp4")], stdin=subprocess.PIPE)
    n = int(GLOBE_T * FPS)
    for k in range(n):
        t = k / n
        lc = 60 - 360 * t  # centre longitude: features drift west to east across the face
        disc = sample(lon0 + lc) * shade + rim
        fr = bg.copy()
        sl = (slice(cy - S // 2, cy - S // 2 + S), slice(cx - S // 2, cx - S // 2 + S))
        fr[sl] = fr[sl] * (1 - edge) + disc * edge
        im = Image.fromarray(fr.clip(0, 255).astype(np.uint8))
        d = ImageDraw.Draw(im, "RGBA")
        # satellite orbit: two laps per loop, hidden behind the globe
        pts = []
        for a in np.linspace(0, 2 * np.pi, 240):
            ox, oy, oz = np.cos(a), np.sin(a) * np.sin(inc), np.sin(a) * np.cos(inc)
            pts.append((cx + ox * R * 1.28, cy - oy * R * 1.28, oz))
        for (x1, y1, z1), (x2, y2, z2) in zip(pts, pts[1:]):
            behind = z1 < 0 and (x1 - cx) ** 2 + (y1 - cy) ** 2 < R * R
            if not behind:
                d.line([(x1, y1), (x2, y2)], fill=(170, 190, 220, 70), width=2)
        a = 2 * np.pi * 2 * t
        sx, sy, sz = np.cos(a), np.sin(a) * np.sin(inc), np.sin(a) * np.cos(inc)
        px_, py_ = cx + sx * R * 1.28, cy - sy * R * 1.28
        if not (sz < 0 and (px_ - cx) ** 2 + (py_ - cy) ** 2 < R * R):
            d.ellipse([px_ - 5, py_ - 5, px_ + 5, py_ + 5], fill=(255, 255, 255, 255))
        # the two regions
        for la, lo, name in PINS:
            phi, lam = np.radians(la), np.radians(lo - lc)
            Xw, Yw, Zw = np.cos(phi) * np.sin(lam), np.sin(phi), np.cos(phi) * np.cos(lam)
            vy, vz = Yw * np.cos(tilt) - Zw * np.sin(tilt), Yw * np.sin(tilt) + Zw * np.cos(tilt)
            if vz < 0.3:
                continue
            al = min(1, (vz - 0.3) / 0.2)
            qx, qy = cx + Xw * R, cy - vy * R
            ph = (t * 10) % 1  # 10 pulses per loop
            rp = 6 + 26 * ph
            d.ellipse([qx - rp, qy - rp, qx + rp, qy + rp], outline=(255, 232, 31, int(220 * (1 - ph) * al)), width=3)
            d.ellipse([qx - 6, qy - 6, qx + 6, qy + 6], fill=(255, 232, 31, int(255 * al)))
            g = -1 if Xw > 0.1 else 1  # label points away from the near limb
            d.line([(qx + 10 * g, qy - 10), (qx + 46 * g, qy - 46), (qx + 66 * g, qy - 46)], fill=(255, 232, 31, int(200 * al)), width=2)
            lx = qx + 74 if g > 0 else qx - 74 - d.textlength(name, font=f_lab)
            d.text((lx, qy - 62), name, font=f_lab, fill=(255, 255, 255, int(255 * al)))
        proc.stdin.write(im.tobytes())
        if k == int(n * 0.08):
            im.save(OUT / "globe_poster.png")
    proc.stdin.close()
    proc.wait()


if __name__ == "__main__":
    crawl()
    globe()
    print("assets in", OUT)
