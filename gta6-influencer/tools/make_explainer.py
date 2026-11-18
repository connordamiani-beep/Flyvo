"""Render "Everything You Need to Know Before the GTA 6 Drop" as a vertical
text-on-screen motion-graphics video (1080x1920, 30fps), locally with PIL + ffmpeg.

usage: python3 make_explainer.py OUT.mp4
"""
import math
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
PINK, TEAL, ORANGE, WHITE, YELLOW = (255, 60, 172), (0, 229, 214), (255, 140, 66), (255, 255, 255), (255, 214, 0)
FONT = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FONT_B = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
f = lambda size, bold=False: ImageFont.truetype(FONT_B if bold else FONT, size)

# (tag, headline, body lines, seconds)
SLIDES = [
    ("", "EVERYTHING YOU NEED TO KNOW BEFORE THE GTA 6 DROP", [], 3.6),
    ("01  WHEN", "THURSDAY\nNOV 19", ["Unlocks at MIDNIGHT", "in YOUR time zone"], 4.0),
    ("02  WHERE", "PS5 +\nXBOX SERIES X|S", ["No PC version at launch", "(GTA V took ~1.5 years to hit PC)"], 4.2),
    ("03  THE MAP", "LEONIDA", ["Rockstar's take on Florida", "Vice City is the heart of it", "Keys - swamps - mountains"], 4.2),
    ("04  WHO YOU PLAY", "LUCIA +\nJASON", ["Two leads, one relationship", "A modern Bonnie & Clyde story"], 4.0),
    ("05  THE WAIT", "13 YEARS", ["GTA V: 2013", "Delayed: fall 2025 > May 2026", "> finally Nov 19, 2026"], 4.2),
    ("06  BEFORE MIDNIGHT", "DO THIS\nTONIGHT", ["[ ] Pre-download when your store allows", "[ ] Clear storage space", "[ ] Charge your controller", "[ ] Turn on game capture"], 5.0),
    ("07  WARNING", "AVOID\nSCAMS", ["No free download. No early PC version.", "No secret beta codes.", "Buy only from PlayStation Store,", "Microsoft Store or real retailers"], 5.0),
    ("08  THE HYPE", "$1 BILLION\nIN 3 DAYS", ["That's what GTA V did.", "Will GTA 6 break the internet?"], 4.0),
    ("", "WHERE WILL YOU BE\nAT MIDNIGHT?", ["Comment below", "Follow for launch week"], 4.0),
]
TOTAL = sum(s[3] for s in SLIDES)

# ---- background: animated neon gradient + soft glow orbs + grid ----
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
base_top, base_bot = np.array([18, 6, 38], np.float32), np.array([60, 10, 50], np.float32)
grad = (base_top[None, None] * (1 - yy[..., None] / H) + base_bot[None, None] * (yy[..., None] / H))


def background(t):
    img = grad.copy()
    for (cx, cy, r, col, sp, ph) in [(0.2, 0.25, 520, PINK, 0.35, 0), (0.85, 0.7, 600, TEAL, 0.27, 2), (0.5, 1.0, 700, ORANGE, 0.2, 4)]:
        x0 = W * (cx + 0.08 * math.sin(t * sp + ph)); y0 = H * (cy + 0.05 * math.cos(t * sp * 1.3 + ph))
        d2 = ((xx - x0) ** 2 + (yy - y0) ** 2) / (r * r)
        img += np.exp(-d2)[..., None] * (np.array(col, np.float32) * 0.42)
    # perspective-ish grid lines at the bottom (synthwave floor)
    floor = yy > H * 0.78
    off = (t * 120) % 80
    lines = (np.abs(((yy - H * 0.78 + off) % 80)) < 2.5) & floor
    img[lines] = img[lines] * 0.5 + np.array(PINK, np.float32) * 0.5
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))


def ease(x):
    x = max(0.0, min(1.0, x)); return 1 - (1 - x) ** 3


def wrap(draw, text, font, maxw):
    out = []
    for para in text.split("\n"):
        line = ""
        for w in para.split():
            test = (line + " " + w).strip()
            if draw.textlength(test, font=font) <= maxw: line = test
            else: out.append(line); line = w
        out.append(line)
    return out


def draw_slide(img, slide, lt, dur, idx):
    tag, head, body, _ = slide
    d = ImageDraw.Draw(img, "RGBA")
    out = ease((dur - lt) / 0.35) if lt > dur - 0.35 else 1.0  # exit fade
    a = lambda p: int(255 * p * out)
    y = 430 if body else 700
    # tag pill
    if tag:
        p = ease(lt / 0.35); ft = f(46)
        tw = d.textlength(tag, font=ft)
        x = 80 - (1 - p) * 300
        d.rounded_rectangle([x, y, x + tw + 56, y + 84], 42, fill=PINK + (a(p),))
        d.text((x + 28, y + 14), tag, font=ft, fill=(255, 255, 255, a(p)))
        y += 140
    # headline: big, slides up word-block by word-block
    hs = 150 if len(head) < 22 else 112 if idx else 104
    fh = f(hs); lines = wrap(d, head, fh, W - 160)
    for i, ln in enumerate(lines):
        p = ease((lt - 0.15 - i * 0.12) / 0.45)
        dy = (1 - p) * 80
        col = YELLOW if (idx == 0 and "GTA 6" in ln) else WHITE
        for ox, oy in ((6, 6),):
            d.text((80 + ox, y + dy + oy), ln, font=fh, fill=(0, 0, 0, a(p) // 2))
        d.text((80, y + dy), ln, font=fh, fill=col + (a(p),))
        y += int(hs * 1.08)
    # accent bar
    p = ease((lt - 0.4) / 0.5)
    d.rectangle([80, y + 30, 80 + int(260 * p), y + 44], fill=TEAL + (a(1),))
    y += 110
    # body lines, staggered
    fb = f(56, bold=True)
    for i, ln in enumerate(body):
        p = ease((lt - 0.6 - i * 0.28) / 0.4)
        for sub in wrap(d, ln, fb, W - 160):
            d.text((80 + (1 - p) * 120, y), sub, font=fb, fill=(235, 235, 255, a(p)))
            y += 78
        y += 14
    return img


def chrome(img, t):
    d = ImageDraw.Draw(img, "RGBA")
    d.text((80, 180), "VICE", font=f(54), fill=WHITE + (235,))
    d.text((80 + d.textlength("VICE ", font=f(54)), 192), "GTA 6 LAUNCH WEEK", font=f(40, True), fill=TEAL + (235,))
    # progress bar
    d.rectangle([80, 270, W - 80, 278], fill=(255, 255, 255, 50))
    d.rectangle([80, 270, 80 + int((W - 160) * t / TOTAL), 278], fill=PINK + (255,))
    d.text((80, H - 230), "Unofficial fan commentary. Not affiliated with Rockstar Games.", font=f(30, True), fill=(255, 255, 255, 130))
    return img


def main(out):
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                           "-i", "-", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-shortest",
                           "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                           "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    n = int(TOTAL * FPS); starts = np.cumsum([0] + [s[3] for s in SLIDES])
    for k in range(n):
        t = k / FPS
        i = int(np.searchsorted(starts, t, side="right") - 1); i = min(i, len(SLIDES) - 1)
        img = background(t)
        img = draw_slide(img, SLIDES[i], t - starts[i], SLIDES[i][3], i)
        ff.stdin.write(chrome(img, t).tobytes())
    ff.stdin.close(); ff.wait()
    print("wrote", out, f"{TOTAL:.1f}s")


if __name__ == "__main__":
    main(sys.argv[1])
