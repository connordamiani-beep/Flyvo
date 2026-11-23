"""Render "12 GTA 6 Tips" (original script) over free Pexels stock clips.

usage: python3 make_tips.py CLIPS_DIR OUT.mp4
CLIPS_DIR holds s00.mp4 .. s13.mp4 (see tips_credits.md for sources).
"""
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
PINK, TEAL, YELLOW = (255, 60, 172), (0, 229, 214), (255, 214, 0)
F_XB = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
F_B = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
font = lambda p, s: ImageFont.truetype(p, s)

INTRO, TIP, OUTRO = 3.5, 4.5, 3.5
# (headline, body)
TIPS = [
    ("BANK YOUR CASH", "Die or get busted and you lose the cash on you. Stash it at the safehouse, then use ATMs once banking unlocks."),
    ("SWITCH TO CLASSIC CONTROLS", "Sprint moved to L3. Hate it? Settings > Controls > Classic."),
    ("QUICK-PING WAYPOINTS", "Hold D-pad down to drop a waypoint on anything nearby. No map needed."),
    ("LET YOUR PARTNER FENCE IT", "Hand over the loot, hold right on the D-pad, then press Triangle. They sell it for you."),
    ("BUY A SUPPRESSOR EARLY", "Stealth pays in GTA 6. A silenced pistol is worth every dollar."),
    ("SAVE OUTFITS TO YOUR TRUNK", "Up to 5 per character. Change clothes to shake a police description."),
    ("SKIP LONG DRIVES", "Book a RideMe or a taxi, then pay to skip the trip."),
    ("LOOT EVERY ENEMY", "Cash, ammo and weapons add up fast. It can nearly double a take."),
    ("USE FOCUS TO SCOUT", "White doors = you can enter. Red doors = alarmed. Plan before you rob."),
    ("CALL JOEY", "Busted-up car? Call him and he fixes it anywhere on the map."),
    ("LEAVE THE ENGINE RUNNING", "Double-tap exit (Triangle / Y) for a faster getaway."),
    ("CHECK COP CAR TRUNKS", "Free long gun and body armor. Just make sure no cops are around."),
]


def wrap(d, text, f, maxw):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= maxw: cur = t
        else: lines.append(cur); cur = w
    lines.append(cur)
    return lines


def card(path, tag, head, body, center=False):
    """Transparent overlay: dark gradient + tag pill + headline + body."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # readability gradient over the lower 55%
    top = int(H * 0.42)
    for y in range(top, H):
        a = int(215 * ((y - top) / (H - top)) ** 0.8)
        d.line([(0, y), (W, y)], fill=(8, 2, 20, a))
    fh = font(F_XB, 104 if center else 92)
    fb = font(F_B, 50)
    hl = wrap(d, head, fh, W - 160)
    bl = wrap(d, body, fb, W - 160) if body else []
    block = (110 if tag else 0) + len(hl) * int(fh.size * 1.08) + 40 + len(bl) * 66
    y = (H - block) // 2 + 120 if center else H - 330 - block
    if tag:
        ft = font(F_XB, 44); tw = d.textlength(tag, font=ft)
        d.rounded_rectangle([80, y, 80 + tw + 52, y + 78], 39, fill=PINK + (255,))
        d.text((106, y + 13), tag, font=ft, fill="white")
        y += 110
    for ln in hl:
        d.text((86, y + 5), ln, font=fh, fill=(0, 0, 0, 150))
        d.text((80, y), ln, font=fh, fill=(YELLOW if center else (255, 255, 255)) + (255,))
        y += int(fh.size * 1.08)
    d.rectangle([80, y + 12, 330, y + 24], fill=TEAL + (255,))
    y += 52
    for ln in bl:
        d.text((80, y), ln, font=fb, fill=(240, 240, 255, 255)); y += 66
    img.save(path)


def chrome(path):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    for y in range(0, 360):  # top shade for header legibility
        d.line([(0, y), (W, y)], fill=(8, 2, 20, int(150 * (1 - y / 360))))
    d.text((80, 192), "GTA 6 TIPS", font=font(F_XB, 44), fill=TEAL + (255,))
    d.rectangle([80, 270, W - 80, 278], fill=(255, 255, 255, 60))
    d.text((80, H - 200), "Unofficial fan content. Not affiliated with Rockstar Games.", font=font(F_B, 28), fill=(255, 255, 255, 150))
    img.save(path)


def segment(clip, overlay, dur, out, start=0.5):
    # loop short clips, cover-crop to 9:16, slow push-in via moving crop, grade, then animate the text card in
    fc = (f"[0:v]fps={FPS},scale={int(W*1.1)}:{int(H*1.1)}:force_original_aspect_ratio=increase,"
          f"crop={W}:{H}:x='(iw-{W})/2*(1-t/{dur})':y='(ih-{H})/2*(1-t/{dur})',setsar=1,"
          f"eq=brightness=-0.06:saturation=1.3:contrast=1.08,"
          f"colorbalance=rs=0.06:bs=0.08:rh=0.04,trim=0:{dur},setpts=PTS-STARTPTS[bg];"
          f"[1:v]format=rgba,fade=in:st=0.15:d=0.35:alpha=1,fade=out:st={dur-0.3}:d=0.3:alpha=1[ov];"
          f"[bg][ov]overlay=x=0:y='max(0,70-70*(t-0.15)/0.35)':eval=frame:shortest=1[v]")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-stream_loop", "-1", "-ss", str(start), "-i", clip,
                    "-loop", "1", "-t", str(dur), "-i", overlay, "-filter_complex", fc, "-map", "[v]",
                    "-t", str(dur), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", out], check=True)


def main(clips, out):
    tmp = tempfile.mkdtemp()
    segs, durs = [], []
    plan = [(0, None, "12 GTA 6 TIPS THAT WILL SAVE YOUR GAME", "", INTRO, True)]
    plan += [(i + 1, f"{i+1:02d} / 12", h, b, TIP, False) for i, (h, b) in enumerate(TIPS)]
    plan += [(13, None, "WHICH TIP HELPED YOU MOST?", "Comment below and follow for more.", OUTRO, True)]
    for idx, tag, head, body, dur, center in plan:
        ov = f"{tmp}/ov{idx:02d}.png"; card(ov, tag, head, body, center)
        seg = f"{tmp}/seg{idx:02d}.mp4"
        segment(os.path.join(clips, f"s{idx:02d}.mp4"), ov, dur, seg, start=0.0 if idx == 3 else 0.5)
        segs.append(seg); durs.append(dur); print("segment", idx, "ok", flush=True)
    total = sum(durs)
    with open(f"{tmp}/list.txt", "w") as fh:
        fh.writelines(f"file '{s}'\n" for s in segs)
    ch = f"{tmp}/chrome.png"; chrome(ch)
    # progress bar: one box per 0.25s step (drawbox width is not re-evaluated per frame)
    steps = int(total / 0.25)
    boxes = ",".join(f"drawbox=x=80:y=270:w={max(1, int((W - 160) * (k + 1) / steps))}:h=8:color=0xFF3CAC@1:t=fill"
                     f":enable='between(t,{k*0.25:.2f},{(k+1)*0.25:.2f})'" for k in range(steps))
    fc = f"[0:v][1:v]overlay=0:0,{boxes}[v]"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", f"{tmp}/list.txt",
                    "-loop", "1", "-i", ch, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                    "-filter_complex", fc, "-map", "[v]", "-map", "2:a", "-t", str(total),
                    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out], check=True)
    print("wrote", out, f"{total:.1f}s")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
