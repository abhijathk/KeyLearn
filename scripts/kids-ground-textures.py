"""Procedural, seamless ground textures for Dino Run and Hero Trail.

Everything is periodic by construction: noise is band-filtered white noise in
the frequency domain (an FFT is periodic), and every scattered element is drawn
at all nine wrap offsets, so each map tiles with no seam.

Run with /usr/local/bin/python3.10 (python3.14 + numpy corrupts arrays here):

    /usr/local/bin/python3.10 scripts/kids-ground-textures.py \
        root/public/kids-assets/textures [name ...]

then `node scripts/kids-manifest.mjs`. Each map is a 512px JPEG squeezed to
about 40 KB and normalised to the luminance the ground shader expects (it
multiplies by 1.75, so ~0.5 keeps the ground neither darker nor brighter).
The `dino_` / `hero_` prefix is what puts a map in its world's asset group.
"""
import io
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

N = 512
OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
os.makedirs(OUT, exist_ok=True)


def rng(seed):
    return np.random.default_rng(seed)


def fnoise(r, lo, hi, n=N):
    """Periodic band-limited noise in [0,1], wavelengths lo..hi pixels."""
    w = r.standard_normal((n, n))
    F = np.fft.fft2(w)
    fy = np.fft.fftfreq(n)[:, None]
    fx = np.fft.fftfreq(n)[None, :]
    f = np.sqrt(fx * fx + fy * fy) + 1e-9
    # 1/f falloff within the band
    band = ((f >= 1 / hi) & (f <= 1 / lo)) / f
    out = np.real(np.fft.ifft2(F * band))
    out -= out.min()
    out /= out.max() + 1e-9
    return out


def ss(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    t = np.asarray(t)
    if t.ndim == 2:
        t = t[..., None]
    return a + (b - a) * t


def col(hexs):
    return np.array([int(hexs[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def base(c0, c1, t):
    return lerp(np.broadcast_to(c0, (N, N, 3)), np.broadcast_to(c1, (N, N, 3)), t)


def wrapdraw(img, fn):
    """Call fn(draw, ox, oy) at all nine wrap offsets."""
    d = ImageDraw.Draw(img)
    for oy in (-N, 0, N):
        for ox in (-N, 0, N):
            fn(d, ox, oy)


def layer_rgba():
    return Image.new("RGBA", (N, N), (0, 0, 0, 0))


def over(arr, rgba):
    a = np.asarray(rgba).astype(float) / 255
    al = a[..., 3:4]
    return arr * (1 - al) + a[..., :3] * al


def blades(arr, r, count, length, width, palette, density=None, angle=None,
           jitter=0.18, alpha=230):
    """Short grass blades drawn as tapered strokes, bottom dark, tip light."""
    L = layer_rgba()
    items = []
    for _ in range(count):
        x, y = r.uniform(0, N, 2)
        if density is not None and r.uniform() > density[int(y) % N, int(x) % N]:
            continue
        a = (angle if angle is not None else r.uniform(0, 2 * np.pi)) + r.normal(0, 0.6)
        ln = length * r.uniform(0.5, 1.3)
        c = palette[r.integers(len(palette))] * r.uniform(1 - jitter, 1 + jitter)
        items.append((x, y, a, ln, np.clip(c, 0, 1)))

    def fn(d, ox, oy):
        for x, y, a, ln, c in items:
            x0, y0 = x + ox, y + oy
            x1, y1 = x0 + np.cos(a) * ln, y0 + np.sin(a) * ln
            dark = tuple(int(v * 255 * 0.62) for v in c) + (alpha,)
            lite = tuple(int(min(1, v * 1.12) * 255) for v in c) + (alpha,)
            d.line([(x0, y0), ((x0 + x1) / 2, (y0 + y1) / 2)], fill=dark, width=width)
            d.line([((x0 + x1) / 2, (y0 + y1) / 2), (x1, y1)], fill=lite, width=max(1, width - 1))

    wrapdraw(L, fn)
    return over(arr, L)


def stones(arr, r, count, rmin, rmax, palette, density=None, flat=0.7, shadow=0.45):
    """Rounded pebbles: soft cast shadow, a body, a top-left highlight."""
    S = layer_rgba()
    B = layer_rgba()
    items = []
    for _ in range(count):
        x, y = r.uniform(0, N, 2)
        if density is not None and r.uniform() > density[int(y) % N, int(x) % N]:
            continue
        rad = r.uniform(rmin, rmax)
        ry = rad * r.uniform(flat, 1.0)
        c = np.clip(palette[r.integers(len(palette))] * r.uniform(0.85, 1.15), 0, 1)
        items.append((x, y, rad, ry, c))

    def fs(d, ox, oy):
        for x, y, rx, ry, c in items:
            o = max(1, rx * 0.35)
            d.ellipse([x + ox - rx + o, y + oy - ry + o, x + ox + rx + o, y + oy + ry + o],
                      fill=(0, 0, 0, int(255 * shadow)))

    def fb(d, ox, oy):
        for x, y, rx, ry, c in items:
            X, Y = x + ox, y + oy
            d.ellipse([X - rx, Y - ry, X + rx, Y + ry], fill=tuple(int(v * 255) for v in c) + (255,))
            h = tuple(int(min(1, v * 1.28 + 0.06) * 255) for v in c) + (200,)
            d.ellipse([X - rx * 0.62, Y - ry * 0.7, X + rx * 0.2, Y + ry * 0.05], fill=h)

    wrapdraw(S, fs)
    S = S.filter(ImageFilter.GaussianBlur(1.6))
    wrapdraw(B, fb)
    B = B.filter(ImageFilter.GaussianBlur(0.6))
    return over(over(arr, S), B)


def grain(arr, r, amt, lo=1.5, hi=6):
    g = fnoise(r, lo, hi) - 0.5
    return arr * (1 + g[..., None] * amt)


def cracks(arr, r, n, colr, strength=0.5):
    L = layer_rgba()
    paths = []
    for _ in range(n):
        x, y = r.uniform(0, N, 2)
        a = r.uniform(0, 2 * np.pi)
        pts = [(x, y)]
        for _ in range(r.integers(4, 10)):
            a += r.normal(0, 0.6)
            s = r.uniform(5, 14)
            x, y = x + np.cos(a) * s, y + np.sin(a) * s
            pts.append((x, y))
        paths.append(pts)

    def fn(d, ox, oy):
        for pts in paths:
            d.line([(px + ox, py + oy) for px, py in pts],
                   fill=tuple(int(v * 255) for v in colr) + (int(255 * strength),), width=1)

    wrapdraw(L, fn)
    return over(arr, L.filter(ImageFilter.GaussianBlur(0.4)))


def save(name, arr, q=80, target=40_000, lum_target=0.5, soften=0.0):
    arr = np.clip(arr, 0, 1)
    l = (arr @ np.array([0.299, 0.587, 0.114])).mean()
    arr = np.clip(arr * (lum_target / l), 0, 1)
    im = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))
    if soften > 0:
        im = im.filter(ImageFilter.GaussianBlur(soften))
    # Largest quality that fits the budget.
    for qq in range(q, 40, -2):
        b = io.BytesIO()
        im.save(b, "JPEG", quality=qq, optimize=True, progressive=True, subsampling=2)
        if b.tell() <= target:
            break
    with open(os.path.join(OUT, f"{name}_diff.jpg"), "wb") as f:
        f.write(b.getvalue())
    a = np.asarray(im).astype(float) / 255
    lum = a @ np.array([0.299, 0.587, 0.114])
    print(f"{name:18s} q{qq:<3d} {b.tell() / 1024:5.1f} KB  mean {a.reshape(-1, 3).mean(0).round(3)} lum {lum.mean():.3f}")
    return im


# ── DINO RUN: prehistoric valley ────────────────────────────────────────────

def dino_fern():
    """Field: short tufty grass over warm soil. Used as luminance detail."""
    r = rng(11)
    clump = fnoise(r, 40, 200)
    a = base(col("5a4a30"), col("6f5a38"), fnoise(r, 8, 60))
    a = grain(a, r, 0.25)
    dens = ss(0.25, 0.7, clump) * 0.8 + 0.2
    pal = [col("6f8f3c"), col("7fa046"), col("8aa850"), col("5f7f34"), col("9aa85a")]
    a = blades(a, r, 9000, 9, 2, pal, density=dens)
    a = blades(a, r, 7000, 6, 1, pal + [col("a9b060")], density=dens)
    a = stones(a, r, 60, 1.5, 3.2, [col("8a7f70"), col("9c8f7c")], density=1 - dens, shadow=0.3)
    return a * (0.97 + 0.06 * fnoise(r, 60, 256)[..., None])


def dino_trail():
    """Road: dusty packed ochre earth, fine grit, small pebbles, faint cracks."""
    r = rng(12)
    t = fnoise(r, 20, 256)
    a = base(col("b07a44"), col("c9965a"), t)
    a = lerp(a, col("a36a3a"), ss(0.55, 0.9, fnoise(r, 30, 180)) * 0.5)
    a = grain(a, r, 0.22, 1.5, 4)
    a = grain(a, r, 0.12, 6, 20)
    a = cracks(a, r, 26, col("6a4524"), 0.35)
    a = stones(a, r, 260, 1.0, 2.2, [col("c7b39a"), col("a89276"), col("8c7a66")], shadow=0.35)
    a = stones(a, r, 30, 2.5, 4.5, [col("b8a489"), col("9a8a78")], shadow=0.45)
    return a


def dino_drygrass():
    """Litter: sun-dried straw grass lying over dusty earth."""
    r = rng(13)
    a = base(col("8a6a40"), col("a2804e"), fnoise(r, 10, 120))
    a = grain(a, r, 0.2)
    dens = ss(0.2, 0.65, fnoise(r, 30, 160)) * 0.85 + 0.15
    pal = [col("c9ae6a"), col("d8bf7a"), col("b89a58"), col("a9a35c"), col("e0c98a")]
    a = blades(a, r, 7000, 12, 2, pal, density=dens, jitter=0.12)
    a = blades(a, r, 5000, 8, 1, pal, density=dens, jitter=0.12)
    return a


def dino_soil():
    """Dry: warm rust-brown earth, scattered pebbles, sun cracks."""
    r = rng(14)
    a = base(col("8e5634"), col("a8693f"), fnoise(r, 16, 220))
    a = lerp(a, col("7a4a2c"), ss(0.6, 0.9, fnoise(r, 24, 120)) * 0.55)
    a = grain(a, r, 0.26, 1.5, 4)
    a = cracks(a, r, 40, col("4a2a18"), 0.45)
    pal = [col("b4a590"), col("968674"), col("c8b8a0"), col("7c6e62"), col("a88c6c")]
    a = stones(a, r, 520, 1.2, 3.0, pal, shadow=0.4)
    a = stones(a, r, 55, 3.5, 6.5, pal, shadow=0.5)
    return a


# ── HERO TRAIL: fantasy meadow ──────────────────────────────────────────────

def hero_meadow():
    """Field: dense lush grass. Used as luminance detail."""
    r = rng(21)
    a = base(col("3f5a28"), col("51702f"), fnoise(r, 8, 80))
    dens = ss(0.15, 0.6, fnoise(r, 40, 220)) * 0.6 + 0.4
    pal = [col("5e9a38"), col("6eab40"), col("7dbb4a"), col("4f8a30"), col("8cc458")]
    a = blades(a, r, 10000, 10, 2, pal, density=dens)
    a = blades(a, r, 6000, 7, 1, pal + [col("a4d46a")], density=dens)
    return a * (0.95 + 0.1 * fnoise(r, 60, 256)[..., None])


def hero_path():
    """Road: worn dirt with rounded cobbles set in it, worn smooth."""
    r = rng(22)
    a = base(col("8f6c48"), col("a88158"), fnoise(r, 14, 200))
    a = grain(a, r, 0.2, 1.5, 4)
    # Periodic Voronoi cobbles.
    pts = r.uniform(0, N, (120, 2))
    yy, xx = np.mgrid[0:N, 0:N].astype(float)
    # Warp the lattice a little so the cobbles are hand-laid, not tiled.
    xx = xx + (fnoise(r, 20, 90) - 0.5) * 5
    yy = yy + (fnoise(r, 20, 90) - 0.5) * 5
    d1 = np.full((N, N), 1e9)
    d2 = np.full((N, N), 1e9)
    idx = np.zeros((N, N), int)
    for i, (px, py) in enumerate(pts):
        dx = np.abs(xx - px)
        dx = np.minimum(dx, N - dx)
        dy = np.abs(yy - py)
        dy = np.minimum(dy, N - dy)
        d = np.sqrt(dx * dx + dy * dy)
        closer = d < d1
        d2 = np.where(closer, d1, np.minimum(d2, d))
        idx = np.where(closer, i, idx)
        d1 = np.where(closer, d, d1)
    edge = d2 - d1  # distance to the cell border (x2)
    present = r.uniform(size=len(pts)) < 0.7  # some cobbles are missing, dirt shows
    keep = present[idx]
    body = ss(3.0, 6.0, edge) * keep
    pal = np.array([col("8e867a"), col("9a8f7e"), col("7e776c"), col("a39277"), col("877c6c")])
    cc = pal[r.integers(len(pal), size=len(pts))] * r.uniform(0.88, 1.1, (len(pts), 1))
    stone = cc[idx]
    # Dome shading: lit from the top-left.
    dome = np.sqrt(np.clip((edge - 3.0) / 18.0, 0, 1))
    h = np.asarray(Image.fromarray((dome * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.0))).astype(float) / 255
    gy, gx = np.gradient(h)
    shade = 0.82 + (-gx - gy) * 6.0 + h * 0.25
    stone = stone * np.clip(shade, 0.7, 1.35)[..., None]
    stone = grain(stone, r, 0.12, 1.5, 5)
    a = lerp(a * (1 - 0.35 * ss(0, 4, edge) * keep)[..., None], stone, body)
    # Grass creeping into the joints.
    joint = (1 - ss(1.0, 5.0, edge)) * keep
    pal_g = [col("5e8f36"), col("6ea040"), col("7aa848")]
    dens = np.clip(joint * 0.9 + (~keep) * 0.12, 0, 1)
    a = blades(a, r, 5000, 5, 1, pal_g, density=dens, alpha=210)
    return a


def hero_clover():
    """Litter: clover carpet with little white, yellow and pink flowers."""
    r = rng(23)
    a = base(col("3d5e26"), col("4d7430"), fnoise(r, 8, 90))
    pal = [col("5f9a3a"), col("6aa842"), col("78b44c")]
    a = blades(a, r, 6000, 7, 1, pal)
    # Trefoils.
    L = layer_rgba()
    leaves = []
    for _ in range(1400):
        x, y = r.uniform(0, N, 2)
        s = r.uniform(2.2, 3.6)
        rot = r.uniform(0, 2 * np.pi)
        c = np.clip(col("5e9e3c") * r.uniform(0.8, 1.2), 0, 1)
        leaves.append((x, y, s, rot, c))

    def fl(d, ox, oy):
        for x, y, s, rot, c in leaves:
            for k in range(3):
                a2 = rot + k * 2 * np.pi / 3
                cx, cy = x + ox + np.cos(a2) * s, y + oy + np.sin(a2) * s
                d.ellipse([cx - s, cy - s, cx + s, cy + s], fill=tuple(int(v * 255) for v in c) + (255,))
                hc = tuple(int(min(1, v * 1.3) * 255) for v in c) + (140,)
                d.ellipse([cx - s * 0.5, cy - s * 0.5, cx + s * 0.1, cy + s * 0.1], fill=hc)

    wrapdraw(L, fl)
    a = over(a, L.filter(ImageFilter.GaussianBlur(0.5)))
    # Flowers, clustered.
    dens = ss(0.45, 0.8, fnoise(r, 30, 140))
    F = layer_rgba()
    flowers = []
    fpal = [(col("fbf6ea"), col("f2cf4a")), (col("f5d23c"), col("d99a22")), (col("f2a8c8"), col("f7e27a")),
            (col("c9b6f0"), col("f7e27a"))]
    for _ in range(900):
        x, y = r.uniform(0, N, 2)
        if r.uniform() > dens[int(y), int(x)] * 0.9 + 0.05:
            continue
        pet, ctr = fpal[r.choice(4, p=[0.45, 0.25, 0.18, 0.12])]
        flowers.append((x, y, r.uniform(1.6, 2.8), pet, ctr))

    def ff(d, ox, oy):
        for x, y, s, pet, ctr in flowers:
            X, Y = x + ox, y + oy
            d.ellipse([X - s + 1, Y - s + 1, X + s + 1, Y + s + 1], fill=(20, 40, 10, 90))
            d.ellipse([X - s, Y - s, X + s, Y + s], fill=tuple(int(v * 255) for v in pet) + (255,))
            d.ellipse([X - s * 0.4, Y - s * 0.4, X + s * 0.4, Y + s * 0.4],
                      fill=tuple(int(v * 255) for v in ctr) + (255,))

    wrapdraw(F, ff)
    return over(a, F)


def hero_moss():
    """Dry: soft mossy earth with fallen leaves and small stones."""
    r = rng(24)
    a = base(col("6e5a3c"), col("857048"), fnoise(r, 10, 150))
    moss = ss(0.35, 0.7, fnoise(r, 20, 160))
    a = lerp(a, base(col("5b7a34"), col("7a9a44"), fnoise(r, 3, 12)), moss * 0.85)
    a = grain(a, r, 0.22, 1.5, 4)
    # Leaves: small pointed ellipses, autumn-tinged but mostly green-brown.
    L = layer_rgba()
    lv = []
    lpal = [col("9a7a3a"), col("b08a40"), col("8a5a30"), col("7a8a3a"), col("c49a4a")]
    for _ in range(420):
        x, y = r.uniform(0, N, 2)
        lv.append((x, y, r.uniform(3, 6), r.uniform(0, np.pi), lpal[r.integers(len(lpal))] * r.uniform(0.85, 1.1)))

    def fl(d, ox, oy):
        for x, y, s, a2, c in lv:
            X, Y = x + ox, y + oy
            dx, dy = np.cos(a2) * s, np.sin(a2) * s
            px, py = -dy * 0.4, dx * 0.4
            poly = [(X - dx, Y - dy), (X + px, Y + py), (X + dx, Y + dy), (X - px, Y - py)]
            d.polygon([(u + 1.2, v + 1.2) for u, v in poly], fill=(20, 15, 5, 90))
            d.polygon(poly, fill=tuple(int(min(1, v) * 255) for v in c) + (240,))
            d.line([(X - dx, Y - dy), (X + dx, Y + dy)], fill=tuple(int(v * 180) for v in c) + (200,), width=1)

    wrapdraw(L, fl)
    a = over(a, L)
    a = stones(a, r, 120, 1.4, 3.4, [col("8f8a80"), col("a39c90"), col("7e786e")], density=1 - moss, shadow=0.4)
    return a


if __name__ == "__main__":
    only = sys.argv[2:] or None
    spec = {
        "dino_fern": dict(lum_target=0.52, soften=0.45),
        "dino_trail": dict(),
        "dino_drygrass": dict(soften=0.45),
        "dino_soil": dict(),
        "hero_meadow": dict(lum_target=0.52, soften=0.5),
        "hero_path": dict(),
        "hero_clover": dict(soften=0.35),
        "hero_moss": dict(),
    }
    for name, kw in spec.items():
        if only is None or name in only:
            save(name, globals()[name](), **kw)
