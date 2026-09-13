#!/usr/bin/env python3
"""Generate seamless ground textures for the Kerala village kids world.

Produces, in root/public/kids-assets/textures/:

    (paddy_field: DISABLED - being authored by hand, see SETS)
    laterite_mud_diff.jpg   laterite_mud_nor.jpg
    coconut_grove_diff.jpg  coconut_grove_nor.jpg

Every texture is 512x512 and tiles seamlessly in both axes: all noise is
built in the frequency domain (periodic by construction) and every stamped
feature (stone, blade, frond) is drawn with wrapped indices on a torus.
The normal map of each set is derived from the same height field that
shades its diffuse, in OpenGL tangent space (+X right, +Y up, flat =
128,128,255), which is what three.js expects.

Deterministic: one seeded numpy Generator per texture, no other randomness.

Needs numpy >= 2.3 on Python >= 3.14 (older numpy's temporary elision is
fooled by 3.14's borrowed-reference bytecode and silently corrupts array
arithmetic); the script self-tests for this and refuses to run.  On this
machine: /usr/local/bin/python3.10 scripts/village-ground-textures.py

Usage:  python3 scripts/village-ground-textures.py [--check-only]
        --check-only re-measures the seam and normal statistics of the
        files already on disk without regenerating them.
"""

from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image, ImageDraw

N = 512
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(os.path.join(HERE, "..", "root", "public", "kids-assets", "textures"))
JPEG_QUALITY = 90


# --------------------------------------------------------------------------
# periodic building blocks
# --------------------------------------------------------------------------

def _freq_grid(n: int = N):
    fx = np.fft.fftfreq(n)[None, :]
    fy = np.fft.fftfreq(n)[:, None]
    return fx, fy, np.sqrt(fx * fx + fy * fy)


def spectral_noise(rng, beta: float, band=None, aniso=None, n: int = N):
    """Periodic Gaussian noise with a 1/f^beta power spectrum.

    band=(centre, width) restricts it to a log-normal band around a spatial
    frequency (cycles per tile).  aniso=(angle, ratio) squashes the spectrum
    so the noise streaks along `angle` (radians) by `ratio` (>1).
    Output is zero-mean, unit-std.
    """
    fx, fy, f = _freq_grid(n)
    if aniso is not None:
        ang, ratio = aniso
        c, s = np.cos(ang), np.sin(ang)
        fpar = fx * c + fy * s
        fperp = -fx * s + fy * c
        f = np.sqrt((fpar * ratio) ** 2 + fperp ** 2)
    f = f.copy()
    f[0, 0] = 1.0
    amp = f ** (-beta / 2.0)
    if band is not None:
        centre, width = band
        amp = amp * np.exp(-((np.log(f * n) - np.log(centre)) ** 2) / (2 * width * width))
    amp[0, 0] = 0.0
    white = np.fft.fft2(rng.standard_normal((n, n)))
    out = np.real(np.fft.ifft2(white * amp))
    return (out - out.mean()) / (out.std() + 1e-12)


def gblur(a, sigma: float):
    """Periodic Gaussian blur (via FFT, so it wraps)."""
    if sigma <= 0:
        return a
    fx, fy, f = _freq_grid(a.shape[0])
    k = np.exp(-2.0 * (np.pi * sigma) ** 2 * (f * f))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * k))


def torus_delta(coord, centre, n: int = N):
    """Signed shortest offset from `centre` to `coord` on a ring of length n."""
    return (coord - centre + n / 2.0) % n - n / 2.0


def worley(rng, count: int, warp=None, n: int = N):
    """F1 and F2 distances to `count` feature points on the torus.

    warp=(dx, dy) offsets the sampling grid by two periodic fields so the
    cells have organic, non-straight edges.
    """
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float64)
    if warp is not None:
        xs = xs + warp[0]
        ys = ys + warp[1]
    pts = rng.uniform(0, n, size=(count, 2))
    f1 = np.full((n, n), np.inf)
    f2 = np.full((n, n), np.inf)
    for px, py in pts:
        d = np.hypot(torus_delta(xs, px, n), torus_delta(ys, py, n))
        closer = d < f1
        f2 = np.where(closer, f1, np.minimum(f2, d))
        f1 = np.where(closer, d, f1)
    return f1, f2


def stamp_window(cx: float, cy: float, r: int, n: int = N):
    """Wrapped index arrays and local offsets for a (2r+1)^2 patch."""
    ix = np.arange(int(np.floor(cx)) - r, int(np.floor(cx)) + r + 1)
    iy = np.arange(int(np.floor(cy)) - r, int(np.floor(cy)) + r + 1)
    dx = (ix - cx)[None, :]
    dy = (iy - cy)[:, None]
    return np.ix_(iy % n, ix % n), dx, dy


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def hex_rgb(h: str):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64) / 255.0


def lerp(a, b, t):
    return a + (b - a) * t


# --------------------------------------------------------------------------
# shared finishing: shading from height, normal map, encoding, saving
# --------------------------------------------------------------------------

def height_normals(h, strength: float):
    """Unit normals from a periodic height field; OpenGL tangent space.

    Image y grows downward but tangent +Y is up, so G follows +dh/dy_image
    (the upper flank of a bump faces up = G > 128).
    """
    dhdx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * 0.5
    dhdy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * 0.5
    nx = -dhdx * strength
    ny = dhdy * strength
    nz = np.ones_like(h)
    inv = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz)
    return nx * inv, ny * inv, nz * inv


def encode_normals(nx, ny, nz):
    rgb = np.stack([nx, ny, nz], axis=-1) * 0.5 + 0.5
    return np.clip(np.round(rgb * 255.0), 0, 255).astype(np.uint8)


def bake_shading(rgb, h, strength: float, light=(-0.5, -0.7, 0.55), amount=0.14, cavity=0.10):
    """Very light ambient-occlusion/lambert bake, like a scanned albedo keeps."""
    nx, ny, nz = height_normals(h, strength)
    lx, ly, lz = light
    ll = np.sqrt(lx * lx + ly * ly + lz * lz)
    # tangent +Y is image-up, so flip the light's image-space y.
    lam = (nx * lx - ny * ly + nz * lz) / ll
    lam = lam - lam.mean()
    cav = h - gblur(h, 3.0)
    cav = cav / (cav.std() + 1e-9)
    shade = 1.0 + amount * lam - cavity * np.clip(-cav, 0, None)
    return rgb * shade[..., None]


def to_uint8(rgb):
    return np.clip(np.round(rgb * 255.0), 0, 255).astype(np.uint8)


def save_jpeg(arr, path):
    Image.fromarray(arr, "RGB").save(path, "JPEG", quality=JPEG_QUALITY, subsampling=2, optimize=True)


# --------------------------------------------------------------------------
# 1. laterite mud (cart road) -- the surface the child walks on
# --------------------------------------------------------------------------

def make_laterite(seed=1101):
    rng = np.random.default_rng(seed)
    h = np.zeros((N, N))
    ys, xs = np.mgrid[0:N, 0:N].astype(np.float64)

    # soil body: fine grain + medium clods + big soft undulation
    grain = spectral_noise(rng, 1.0, band=(150.0, 0.55))
    clods = spectral_noise(rng, 2.2, band=(28.0, 0.7))
    undul = spectral_noise(rng, 3.0, band=(4.0, 0.8))
    h += 0.55 * grain + 0.9 * clods + 1.4 * undul

    # colour: rust red with darker damp patches and an ochre vein or two
    base_a = hex_rgb("#a8542c")
    base_b = hex_rgb("#9c4a24")
    dark = hex_rgb("#7c3a1c")
    ochre = hex_rgb("#b8773a")
    patch = spectral_noise(rng, 2.6, band=(5.0, 0.8))
    vein = spectral_noise(rng, 2.0, band=(9.0, 0.6), aniso=(0.6, 3.0))
    t_mix = smoothstep(-1.0, 1.0, spectral_noise(rng, 1.6, band=(40.0, 0.8)))
    rgb = lerp(base_a, base_b, t_mix[..., None])
    rgb = lerp(rgb, dark[None, None, :], smoothstep(0.5, 1.8, patch)[..., None] * 0.5)
    rgb = lerp(rgb, ochre[None, None, :], smoothstep(0.9, 1.8, vein)[..., None] * 0.55)
    # grain brightness speckle and lumpy clods
    lumps = spectral_noise(rng, 2.0, band=(12.0, 0.7))
    rgb = rgb * (1.0 + 0.06 * grain + 0.055 * clods + 0.035 * lumps)[..., None]
    h += 0.6 * lumps

    # dried cracks: Voronoi edges with warped borders, faded in and out by
    # a slow mask so only some parts of the road are cracked.
    wx = 6.0 * spectral_noise(rng, 2.0, band=(12.0, 0.7))
    wy = 6.0 * spectral_noise(rng, 2.0, band=(12.0, 0.7))
    f1, f2 = worley(rng, 46, warp=(wx, wy))
    edge = np.clip(1.0 - (f2 - f1) / 2.4, 0.0, 1.0)
    crack_mask = smoothstep(-0.4, 0.8, spectral_noise(rng, 2.5, band=(3.0, 0.7)))
    crack_frag = smoothstep(-0.8, 0.5, spectral_noise(rng, 1.2, band=(60.0, 0.9)))
    crack = edge * crack_mask * (0.3 + 0.7 * crack_frag)
    h -= 2.2 * crack
    rgb = rgb * (1.0 - 0.45 * crack)[..., None]

    # embedded stones: small laterite gravel, a few paler quartz bits
    stone_dark = hex_rgb("#5a2c16")
    stone_mid = hex_rgb("#7e4426")
    stone_rust = hex_rgb("#93512c")
    stone_pale = hex_rgb("#b58a66")
    n_stones = 300
    for i in range(n_stones):
        cx, cy = rng.uniform(0, N, 2)
        r = float(rng.gamma(2.0, 1.2) + 1.4)
        r = min(r, 10.0)
        rot = rng.uniform(0, np.pi)
        ecc = rng.uniform(0.55, 1.0)
        win, dx, dy = stamp_window(cx, cy, int(np.ceil(r * 1.3)) + 1)
        c, s = np.cos(rot), np.sin(rot)
        u = (dx * c + dy * s) / r
        v = (-dx * s + dy * c) / (r * ecc)
        # knobbly outline: radius wobbles with angle
        ang = np.arctan2(v, u)
        wob = 1.0
        for k in (2, 3, 5):
            wob = wob + rng.uniform(0.04, 0.14) * np.sin(k * ang + rng.uniform(0, 6.28))
        d2 = (u * u + v * v) / (wob * wob)
        prof = np.clip(1.0 - d2, 0.0, 1.0)
        bump = np.sqrt(prof) * (0.8 + 0.4 * r / 10.0)
        alpha = smoothstep(0.0, 0.3, prof)
        pick = rng.random()
        col = stone_pale if pick < 0.1 else (stone_dark if pick < 0.4 else (stone_mid if pick < 0.75 else stone_rust))
        col = col * rng.uniform(0.85, 1.15)
        # a touch of facet: brighter on the upper-left, darker lower-right
        facet = 1.0 + 0.12 * np.clip(-(u + v), -1, 1)
        h[win] = np.maximum(h[win], h[win] * (1 - alpha) + (h[win] + 1.5 * bump) * alpha)
        rgb[win] = lerp(rgb[win], (col[None, None, :] * facet[..., None]), (alpha * 0.85)[..., None])

    # tiny sand flecks
    fleck = spectral_noise(rng, 0.4, band=(230.0, 0.3))
    rgb = rgb * (1.0 + 0.04 * fleck)[..., None]
    h += 0.25 * fleck

    return rgb, h, 0.85


# --------------------------------------------------------------------------
# 2. paddy field -- planted rows of rice with water between
# --------------------------------------------------------------------------

def make_paddy(seed=2202):
    rng = np.random.default_rng(seed)
    ys, xs = np.mgrid[0:N, 0:N].astype(np.float64)

    # --- water bed: muddy bottom under a thin sheet of water reflecting sky
    mud = hex_rgb("#6e7a3e")
    water = hex_rgb("#5a8a62")
    sky = hex_rgb("#9cbcae")
    depth = smoothstep(-1.2, 1.2, spectral_noise(rng, 2.6, band=(6.0, 0.8)))
    rgb = lerp(mud, water, (0.3 + 0.7 * depth)[..., None])
    ripple = spectral_noise(rng, 1.5, band=(20.0, 0.7), aniso=(0.3, 2.5))
    rgb = lerp(rgb, sky[None, None, :], (0.28 * smoothstep(0.2, 1.6, ripple) * depth)[..., None])
    # glints: a few soft bright flecks where the ripple crests
    glint = spectral_noise(rng, 1.2, band=(55.0, 0.5))
    glint = smoothstep(2.3, 3.1, glint + 0.5 * ripple)
    rgb = lerp(rgb, np.array([0.9, 0.95, 0.96])[None, None, :], (0.8 * glint)[..., None])
    # silt speckle
    silt = spectral_noise(rng, 1.0, band=(160.0, 0.5))
    rgb = rgb * (1.0 + 0.035 * silt)[..., None]
    h = 0.12 * ripple + 0.06 * silt + 0.3 * depth

    # --- plants: clumps on warped rows, alternate rows offset (a lattice)
    greens = [hex_rgb("#5fc24a"), hex_rgb("#6ccc55"), hex_rgb("#7ad65e"), hex_rgb("#52b040"), hex_rgb("#86dc6a"),
              hex_rgb("#4aa83c"), hex_rgb("#8fd862"), hex_rgb("#68c04e")]
    blade_tex = spectral_noise(rng, 1.2, band=(120.0, 0.6))
    rows = 10
    per_row = 15
    row_gap = N / rows
    col_gap = N / per_row
    warp_row = 7.0 * spectral_noise(rng, 2.5, band=(3.0, 0.8))     # bends the rows
    plant_h = np.zeros((N, N))
    plant_rgb = np.zeros((N, N, 3))
    plant_a = np.zeros((N, N))

    def draw_clump(cx, cy, radius, blades, tilt):
        R = int(np.ceil(radius)) + 2
        win, dx, dy = stamp_window(cx, cy, R)
        r = np.hypot(dx, dy) + 1e-6
        ang = np.arctan2(dy, dx)
        best = np.zeros_like(r)
        col = np.zeros(r.shape + (3,))
        wsum = np.zeros_like(r)
        for _ in range(blades):
            a0 = rng.uniform(-np.pi, np.pi)
            L = radius * rng.uniform(0.4, 1.0)
            w = rng.uniform(0.6, 1.1)
            curve = rng.uniform(-1.3, 1.3)
            a = a0 + curve * (r / L)
            da = (ang - a + np.pi) % (2 * np.pi) - np.pi
            across = np.abs(da) * r
            body = np.exp(-(across * across) / (2 * w * w)) * smoothstep(L + 1.0, L - 3.0, r) * smoothstep(0.0, 1.5, r)
            # blades rise from the crown and droop at the tip
            hh = body * (0.35 + 0.65 * np.sin(np.clip(r / L, 0, 1) * np.pi * 0.85))
            g = greens[rng.integers(len(greens))] * rng.uniform(0.9, 1.08)
            # tips catch more light
            tipmix = np.clip(r / L, 0, 1)[..., None]
            gcol = g[None, None, :] * (0.88 + 0.22 * tipmix)
            col += gcol * body[..., None]
            wsum += body
            best = np.maximum(best, hh)
        crown = np.exp(-(r * r) / (2 * (radius * 0.28) ** 2))
        best = np.maximum(best, 0.6 * crown)
        col += hex_rgb("#3f8f34")[None, None, :] * crown[..., None]
        wsum += crown
        alpha = np.clip(best * 1.6, 0.0, 1.0)
        c = col / (wsum[..., None] + 1e-6)
        # accumulate with "over" so overlapping clumps look layered
        plant_h[win] = np.maximum(plant_h[win], best * (0.8 + 0.4 * tilt))
        plant_rgb[win] = lerp(plant_rgb[win], c, alpha[..., None])
        plant_a[win] = plant_a[win] + alpha - plant_a[win] * alpha

    for i in range(rows):
        y0 = i * row_gap
        offset = rng.uniform(0, col_gap)
        for j in range(per_row):
            x0 = j * col_gap + offset + rng.uniform(-7, 7)
            y = y0 + rng.uniform(-5, 5)
            y = y + warp_row[int(y) % N, int(x0) % N]
            radius = rng.uniform(19.0, 29.0)
            if rng.random() < 0.1:
                radius *= 0.6      # a weak seedling now and then
            draw_clump(x0 % N, y % N, radius, rng.integers(40, 60), rng.uniform(0, 1))
    # stray blades and floating weed in the water so rows read as planted, not ruled
    for _ in range(110):
        cx, cy = rng.uniform(0, N, 2)
        draw_clump(cx, cy, rng.uniform(4.0, 10.0), rng.integers(3, 8), rng.uniform(0, 1))

    plant_rgb = plant_rgb * (1.06 + 0.09 * blade_tex)[..., None]
    rgb = lerp(rgb, plant_rgb, plant_a[..., None])
    h = h + 2.6 * plant_h
    # duckweed / algae film tint in still corners
    algae = smoothstep(0.9, 1.7, spectral_noise(rng, 2.4, band=(7.0, 0.7)))
    rgb = lerp(rgb, hex_rgb("#7fa851")[None, None, :], (0.35 * algae * (1 - plant_a))[..., None])
    return rgb, h, 0.75


# --------------------------------------------------------------------------
# 3. coconut grove -- dry sandy soil with frond litter
# --------------------------------------------------------------------------

def make_grove(seed=3303):
    rng = np.random.default_rng(seed)
    base = hex_rgb("#cfa26b")
    shade_c = hex_rgb("#bc905a")
    pale_c = hex_rgb("#dcb57f")

    grain = spectral_noise(rng, 0.9, band=(170.0, 0.55))
    fine = spectral_noise(rng, 1.4, band=(60.0, 0.7))
    mottle = spectral_noise(rng, 2.8, band=(5.0, 0.8))
    damp = smoothstep(0.5, 1.7, spectral_noise(rng, 2.4, band=(8.0, 0.7)))
    rgb = lerp(base, shade_c, smoothstep(-1.2, 1.2, mottle)[..., None])
    rgb = lerp(rgb, pale_c[None, None, :], (0.4 * smoothstep(0.4, 1.5, fine))[..., None])
    rgb = lerp(rgb, hex_rgb("#a67a4a")[None, None, :], (0.22 * damp)[..., None])
    rgb = rgb * (1.0 + 0.035 * grain + 0.035 * fine)[..., None]
    h = 0.35 * grain + 0.6 * fine + 1.2 * mottle

    # little pebbles and coir flecks
    for _ in range(140):
        cx, cy = rng.uniform(0, N, 2)
        r = rng.uniform(1.0, 2.6)
        win, dx, dy = stamp_window(cx, cy, int(np.ceil(r)) + 1)
        prof = np.clip(1.0 - (dx * dx + dy * dy) / (r * r), 0, 1)
        alpha = smoothstep(0.0, 0.4, prof)
        col = hex_rgb("#6f4a2a") if rng.random() < 0.6 else hex_rgb("#e0c496")
        rgb[win] = lerp(rgb[win], col[None, None, :], (0.8 * alpha)[..., None])
        h[win] = h[win] + 0.9 * np.sqrt(prof)

    # frond leaflets: long thin tapering strips, slightly curved
    leaf_cols = [hex_rgb("#9a7444"), hex_rgb("#8a6a3e"), hex_rgb("#7a5a36"), hex_rgb("#b08a52"), hex_rgb("#725a3a"),
                 hex_rgb("#a67e48")]

    def draw_leaflet(cx, cy, theta, L, w, curve, col):
        R = int(np.ceil(L / 2 + 5))
        win, dx, dy = stamp_window(cx, cy, R)
        c, s = np.cos(theta), np.sin(theta)
        lx = dx * c + dy * s
        ly = -dx * s + dy * c
        ly0 = curve * (lx * lx) / L
        t = np.clip(2 * lx / L, -1, 1)
        wt = w * (1.0 - np.abs(t) ** 1.6) + 0.25      # lanceolate: pointed tips
        dist = np.abs(ly - ly0)
        inside = np.clip((wt - dist) + 0.5, 0, 1) * (np.abs(lx) < L / 2)
        alpha = inside
        # midrib, lengthwise streak and a darker curled edge
        rib = np.exp(-(dist * dist) / (2 * 0.6 ** 2)) * (wt > 1.6)
        streak = 0.5 + 0.5 * np.cos(lx * 0.9 + rng.uniform(0, 6.28))
        edge = np.clip((dist - (wt - 1.0)) / 1.0, 0, 1) * (wt > 1.6)
        lc = col[None, None, :] * (0.94 + 0.12 * streak)[..., None]
        lc = lerp(lc, col[None, None, :] * 0.7, (0.5 * rib)[..., None])
        lc = lerp(lc, col[None, None, :] * 0.78, (0.5 * edge)[..., None])
        # contact shadow just below-right of the strip
        sh = np.clip((wt + 1.6 - np.abs((ly - 1.2) - ly0)), 0, 1) * (np.abs(lx - 0.8) < L / 2)
        rgb[win] = rgb[win] * (1.0 - 0.22 * sh * (1 - alpha))[..., None]
        rgb[win] = lerp(rgb[win], lc, alpha[..., None])
        thick = inside * np.clip(1 - (dist / (wt + 1e-6)) ** 2, 0, 1)
        h[win] = np.maximum(h[win], h[win] * (1 - alpha) + (h[win] + 1.5 * thick) * alpha)

    # a few frond fragments (rachis with paired leaflets) ...
    for _ in range(3):
        cx, cy = rng.uniform(0, N, 2)
        theta = rng.uniform(0, np.pi)
        rl = rng.uniform(36, 56)
        col = leaf_cols[rng.integers(len(leaf_cols))]
        draw_leaflet(cx, cy, theta, rl, 1.6, rng.uniform(-0.1, 0.1), col * 0.85)
        c, s = np.cos(theta), np.sin(theta)
        step = 9.0
        k = -rl / 2 + 4
        while k < rl / 2 - 4:
            for side in (-1, 1):
                if rng.random() < 0.8:
                    px, py = cx + k * c, cy + k * s
                    ang = theta + side * rng.uniform(0.85, 1.25)
                    ll = rng.uniform(18, 34)
                    ox, oy = np.cos(ang) * ll / 2, np.sin(ang) * ll / 2
                    draw_leaflet(px + ox, py + oy, ang, ll, rng.uniform(2.0, 3.0), rng.uniform(-0.15, 0.15) * side, col * rng.uniform(0.9, 1.1))
            k += step
    # ... and many loose single leaflets
    for _ in range(120):
        cx, cy = rng.uniform(0, N, 2)
        col = leaf_cols[rng.integers(len(leaf_cols))] * rng.uniform(0.9, 1.1)
        draw_leaflet(cx, cy, rng.uniform(0, np.pi), rng.uniform(18, 60), rng.uniform(2.0, 4.0), rng.uniform(-0.25, 0.25), col)
    # small leaf debris crumbs
    for _ in range(260):
        cx, cy = rng.uniform(0, N, 2)
        col = leaf_cols[rng.integers(len(leaf_cols))] * rng.uniform(0.8, 1.05)
        draw_leaflet(cx, cy, rng.uniform(0, np.pi), rng.uniform(3, 9), rng.uniform(1.0, 1.8), 0.0, col)

    return rgb, h, 0.9


# --------------------------------------------------------------------------
# verification
# --------------------------------------------------------------------------

def seam_report(path):
    """Roll by half in both axes; compare local contrast at the seam vs interior.

    Returns (seam_ratio, edge_ratio): local 5x5 std along the seam bands over
    the interior mean, and mean absolute step across the seam lines over the
    mean step between any other adjacent rows/cols.  1.0 = invisible.
    """
    a = np.asarray(Image.open(path).convert("L"), dtype=np.float64)
    n = a.shape[0]
    r = np.roll(np.roll(a, n // 2, axis=0), n // 2, axis=1)
    k = 5
    pad = np.pad(r, k // 2, mode="edge")
    win = np.lib.stride_tricks.sliding_window_view(pad, (k, k))
    lstd = win.std(axis=(-1, -2))
    band = np.zeros((n, n), dtype=bool)
    band[n // 2 - 3:n // 2 + 3, :] = True
    band[:, n // 2 - 3:n // 2 + 3] = True
    seam_ratio = lstd[band].mean() / lstd[~band].mean()
    step_rows = np.abs(np.diff(r, axis=0)).mean(axis=1)
    step_cols = np.abs(np.diff(r, axis=1)).mean(axis=0)
    seam_step = 0.5 * (step_rows[n // 2 - 1] + step_cols[n // 2 - 1])
    others = np.concatenate([np.delete(step_rows, n // 2 - 1), np.delete(step_cols, n // 2 - 1)])
    rank = (others > seam_step).mean()   # fraction of ordinary rows/cols that step MORE than the seam
    return seam_ratio, seam_step / others.mean(), rank


def normal_report(path):
    a = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64)
    mean = a.reshape(-1, 3).mean(axis=0)
    v = a / 127.5 - 1.0
    length = np.sqrt((v * v).sum(axis=-1))
    return mean, length.mean(), a[..., 2].min()


def contact_sheet(names, out_path):
    tiles = []
    for n in names:
        p = os.path.join(OUT_DIR, n)
        tiles.append((n, Image.open(p).convert("RGB")))
    cols = 4
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * N, rows * (N + 28)), (30, 30, 30))
    d = ImageDraw.Draw(sheet)
    for i, (n, im) in enumerate(tiles):
        x, y = (i % cols) * N, (i // cols) * (N + 28)
        sheet.paste(im, (x, y + 28))
        d.text((x + 8, y + 8), n, fill=(240, 240, 240))
    sheet.save(out_path)


def tiled_preview(name, out_path, reps=2):
    im = Image.open(os.path.join(OUT_DIR, name)).convert("RGB")
    big = Image.new("RGB", (reps * N, reps * N))
    for i in range(reps):
        for j in range(reps):
            big.paste(im, (i * N, j * N))
    big.save(out_path)


# --------------------------------------------------------------------------

SETS = {
    "laterite_mud": make_laterite,
    # DISABLED. The paddy is being authored properly elsewhere - a real one,
    # painted for this world rather than generated. Re-enabling this would
    # put the old procedural paddy back on disk under the name the new file
    # wants, which is the kind of collision nobody notices until the ground
    # looks wrong again. `make_paddy` is left below for reference.
    # "paddy_field": make_paddy,
    "coconut_grove": make_grove,
}


def build(name, fn):
    rgb, h, strength = fn()
    h = (h - h.mean()) / (h.std() + 1e-9)
    diff = to_uint8(bake_shading(rgb, h, strength))
    nor = encode_normals(*height_normals(h, strength))
    save_jpeg(diff, os.path.join(OUT_DIR, f"{name}_diff.jpg"))
    save_jpeg(nor, os.path.join(OUT_DIR, f"{name}_nor.jpg"))


def report():
    print(f"{'file':28s} {'bytes':>8s}  {'seam-std':>8s} {'seam-step':>9s} {'rank':>5s}  normal mean / |n| / minB")
    for name in SETS:
        for kind in ("diff", "nor"):
            f = f"{name}_{kind}.jpg"
            p = os.path.join(OUT_DIR, f)
            sr, er, rank = seam_report(p)
            line = f"{f:28s} {os.path.getsize(p):8d}  {sr:8.3f} {er:9.3f} {rank:5.2f}"
            if kind == "nor":
                mean, ln, minb = normal_report(p)
                line += f"  ({mean[0]:.1f}, {mean[1]:.1f}, {mean[2]:.1f}) / {ln:.3f} / {minb:.0f}"
            else:
                a = np.asarray(Image.open(p).convert("RGB"), dtype=np.float64)
                line += f"  mean {a.reshape(-1, 3).mean(axis=0).round(1)} std {a.reshape(-1, 3).std(axis=0).round(1)}"
            print(line)


def numpy_selftest():
    """Detect the numpy<2.3 + Python 3.14 temporary-elision corruption."""
    h = np.random.default_rng(0).standard_normal((N, N))
    nx, ny, nz = height_normals(h, 0.9)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    if abs(length.mean() - 1.0) > 1e-9 or nz.min() <= 0:
        sys.exit(
            f"numpy {np.__version__} on Python {sys.version.split()[0]} corrupts array temporaries; "
            "run with an interpreter whose numpy is >= 2.3 (or Python <= 3.13), "
            "e.g. /usr/local/bin/python3.10"
        )


def main(argv):
    numpy_selftest()
    if "--check-only" not in argv:
        os.makedirs(OUT_DIR, exist_ok=True)
        for name, fn in SETS.items():
            build(name, fn)
            print("wrote", name)
    report()
    preview_dir = "/tmp"
    names = [f"{n}_{k}.jpg" for n in SETS for k in ("diff", "nor")]
    names += ["leafy_grass_diff.jpg", "leafy_grass_nor.jpg", "sandy_gravel_diff.jpg", "sandy_gravel_nor.jpg"]
    contact_sheet(names, os.path.join(preview_dir, "village_textures.png"))
    for n in SETS:
        tiled_preview(f"{n}_diff.jpg", os.path.join(preview_dir, f"tile_{n}.png"))
    print("previews in", preview_dir)


if __name__ == "__main__":
    main(sys.argv[1:])
