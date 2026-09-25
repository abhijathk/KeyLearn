import * as THREE from "three";
import { type GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * THE WORLD'S TITLE SIGN, SMALL, IN THE TOP-RIGHT CORNER OF THE SCENE.
 *
 * Drawn by the world's OWN renderer, as a second pass after the road: a tiny
 * scene of its own, a scissored viewport in the corner, the depth buffer
 * cleared and the colour left alone. No second canvas and no second WebGL
 * context — every context this page holds is several megabytes the browser
 * only gives back on `forceContextLoss`, which is the whole story of the
 * comments around `dispose()` in world.ts.
 *
 * Because it is pixels in the canvas and not an element over it, it can
 * never take a click or a tap meant for the game, and it never needs a
 * z-index argued with the HUD. The HUD is all on the left (the chips, the
 * newsprint notice, the story button); top-right over the canvas is empty.
 *
 * It does share the canvas's CSS grade — the `saturate() brightness()`
 * filter `applyLook` puts on the whole element — so at night it greys a
 * little with everything else. That is deliberate: a sign lit like midday
 * in a dusk frame reads as a sticker, not as part of the place.
 */
export type WorldLogo = {
  /** Fetches and places the sign. Resolves (never rejects) either way. */
  load(loader: GLTFLoader, url: string): Promise<void>;
  /** Draws it over whatever the renderer just drew. `dt` in seconds. */
  render(renderer: THREE.WebGLRenderer, dt: number): void;
  /** Stillness: calm mode, motion off, or the OS asking for less motion. */
  setStill(still: boolean): void;
  /**
   * Light the sign with the world's own sun or moon (Time Keepers — the
   * owner wants the day passing to show on the title as well). `dir` is the
   * world's light vector (toward the light), `key`/`fill` its intensity as a
   * share of the world's full-day value, the colours the world's own.
   * Never called by a world that keeps the neutral title light.
   */
  setLight(light: {
    dir: THREE.Vector3;
    color: THREE.Color;
    key: number;
    sky: THREE.Color;
    ground: THREE.Color;
    fill: number;
    /**
     * How far into the night, 0 to 1. The sign glows a little after dark
     * (owner, 25 Sep 2026): its paint lit from within and a faint warm
     * halo, like a signboard with a lamp on it — enough to find, never
     * enough to outshine the road.
     */
    glow?: number;
  }): void;
  dispose(): void;
};

/**
 * SMALL, AND QUIET — the owner's call: it names the world, it must never
 * compete with the road or the letters, but it must still read against a
 * busy forest.
 *
 * About 9% of the canvas width, held to 85–120 CSS px. Height is capped
 * too, because Hero Trail's shield is nearly square and would otherwise
 * stand taller than the others read wide.
 */
const WIDTH_SHARE = 0.09;
const MIN_W = 85;
const MAX_W = 120;
const HEIGHT_SHARE = 0.14;
const MIN_H = 44;
const MAX_H = 80;
/** Gap from the canvas's top and right edges, in CSS pixels. */
const MARGIN = 10;
/**
 * Room around the sign inside the viewport, so the sway never clips it and
 * the night halo has somewhere to fall off. The sign keeps its size and
 * place whatever this is — `render` pins its edges to the margin.
 */
const PAD = 1.6;
/** A touch softened so it sits back from the scene, not a watermark. */
const OPACITY = 0.94;

/** Yaw either side of rest, radians (~3.4°). */
const SWAY = 0.06;
/** Rest yaw: turned a touch toward the road so the depth reads when still. */
const REST_YAW = -0.08;
/** One sway takes this long, seconds; the bob runs at a slightly different
 * period so the two never lock into one mechanical rhythm. */
const SWAY_PERIOD = 7;
const BOB_PERIOD = 6.2;
/** Bob amplitude in CSS pixels. */
const BOB_PX = 1.5;

export function createWorldLogo(): WorldLogo {
  const scene = new THREE.Scene();
  // Its own light, neutral by default: the sign is a title, not a prop, so
  // in Dino Run and Hero Trail it does not go orange at sunset or blue after
  // dark. Time Keepers hands it the world's sun and moon — see `setLight`.
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8278, 1.55);
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  const WHITE = new THREE.Color(0xffffff);
  key.position.set(1.2, 1.6, 3);
  scene.add(hemi, key);
  // Depth first, colour second. Faded by plain transparency, the sign's own
  // back faces and inner walls showed through its front as a grey ghost;
  // laying down its depth first lets only the nearest surface take colour.
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
  // The night glow — see `setLight`. The painted materials, to light from
  // within, and a soft lamp-light behind the sign.
  const glowMats: THREE.MeshStandardMaterial[] = [];
  const LAMP = new THREE.Color(0xffc978);
  const haloTex = haloTexture();
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: haloTex,
      color: LAMP,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  halo.visible = false;
  halo.renderOrder = -1;
  scene.add(halo);

  const cam = new THREE.PerspectiveCamera(18, 2, 0.1, 50);
  const pivot = new THREE.Group();
  scene.add(pivot);

  let model: THREE.Object3D | null = null;
  /** Width over height of the sign, once it is here. */
  let aspect = 3;
  let t = Math.random() * 20;
  let still = false;
  let disposed = false;
  const size = new THREE.Vector2();
  const vp = new THREE.Vector4();

  function fitCamera(vw: number, vh: number): void {
    cam.aspect = vw / vh;
    // The sign is normalised to a width of 1 and a height of 1/aspect; stand
    // back far enough that both fit inside the padded viewport.
    const halfV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const dW = (0.5 * PAD) / (halfV * cam.aspect);
    const dH = (0.5 * PAD) / aspect / halfV;
    cam.position.set(0, 0, Math.max(dW, dH) + 0.2);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
  }

  return {
    async load(loader, url) {
      try {
        const gltf = await loader.loadAsync(url);
        if (disposed) {
          disposeTree(gltf.scene);
          return;
        }
        const root = gltf.scene;
        const box = new THREE.Box3().setFromObject(root);
        const dims = box.getSize(new THREE.Vector3());
        const ctr = box.getCenter(new THREE.Vector3());
        const s = 1 / Math.max(1e-6, dims.x);
        root.scale.setScalar(s);
        root.position.copy(ctr).multiplyScalar(-s);
        aspect = dims.x / Math.max(1e-6, dims.y);
        // Wider and taller than the sign, so the light falls off past its
        // edges rather than stopping at them.
        halo.scale.set(1.45, 1.45 / aspect + 0.3, 1);
        halo.position.set(0, 0, -0.08);
        root.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.frustumCulled = false;
          for (const m of ([] as THREE.Material[]).concat(mesh.material)) {
            // Out of the world's ACES grade: its exposure is tuned per world
            // for grass and sky, and pushed through it the sign's painted
            // colours came out washed and different in each world.
            m.toneMapped = false;
            m.transparent = true;
            m.opacity = OPACITY;
            m.depthWrite = false;
            m.depthFunc = THREE.LessEqualDepth;
            const std = m as THREE.MeshStandardMaterial;
            if (std.isMeshStandardMaterial) {
              std.metalness = 0;
              std.roughness = 0.62;
              std.emissive.copy(LAMP);
              std.emissiveMap = std.map;
              std.emissiveIntensity = 0;
              std.needsUpdate = true;
              glowMats.push(std);
            }
          }
        });
        pivot.add(root);
        model = root;
      } catch {
        // No sign is a smaller loss than no game: nothing waits on this.
      }
    },

    render(renderer, dt) {
      if (model == null) return;
      renderer.getSize(size);
      const w = size.x;
      const h = size.y;
      if (w < 240 || h < 140) return;
      const maxH = THREE.MathUtils.clamp(h * HEIGHT_SHARE, MIN_H, MAX_H);
      let sw = THREE.MathUtils.clamp(w * WIDTH_SHARE, MIN_W, MAX_W);
      sw = Math.min(sw, maxH * aspect);
      const sh = sw / aspect;
      const vw = Math.round(sw * PAD);
      const vh = Math.round(sh * PAD);
      // Viewport and scissor are in CSS pixels from the BOTTOM-left; three
      // multiplies by the pixel ratio itself.
      const x = Math.round(w - MARGIN - vw + (vw - sw) / 2);
      const y = Math.round(h - MARGIN - vh + (vh - sh) / 2);
      fitCamera(vw, vh);

      if (!still) t += dt;
      const tau = Math.PI * 2;
      const yaw = still
        ? REST_YAW
        : REST_YAW + Math.sin((t * tau) / SWAY_PERIOD) * SWAY;
      pivot.rotation.set(0, yaw, 0);
      // Pixels to model units: the sign's height, 1/aspect, spans `sh` px.
      pivot.position.y = still
        ? 0
        : (Math.sin((t * tau) / BOB_PERIOD) * BOB_PX) / aspect / sh;

      const autoClear = renderer.autoClear;
      renderer.getViewport(vp);
      renderer.autoClear = false;
      renderer.setViewport(x, y, vw, vh);
      renderer.setScissor(x, y, vw, vh);
      renderer.setScissorTest(true);
      renderer.clearDepth();
      const haloOn = halo.visible;
      halo.visible = false;
      scene.overrideMaterial = depthOnly;
      renderer.render(scene, cam);
      scene.overrideMaterial = null;
      halo.visible = haloOn;
      renderer.render(scene, cam);
      renderer.setScissorTest(false);
      renderer.setViewport(vp);
      renderer.autoClear = autoClear;
    },

    setStill(value) {
      still = value;
    },

    setLight(l) {
      // The world's light, turned into the sign's frame. Both cameras face
      // down -z with +y up, so the vector carries over as it is — except that
      // a light from behind would leave the face the child reads in its own
      // shadow; it is always kept a little in front.
      key.position
        .set(l.dir.x, l.dir.y, Math.max(l.dir.z, 0.35))
        .normalize()
        .multiplyScalar(3);
      // The colour is the world's, a quarter of the way back to white: fully
      // tinted, the painted letters took the moon's blue as their own colour
      // and stopped reading as the sign.
      key.color.copy(l.color).lerp(WHITE, 0.25);
      hemi.color.copy(l.sky).lerp(WHITE, 0.25);
      hemi.groundColor.copy(l.ground).lerp(WHITE, 0.2);
      // Full day is the neutral light it always had; night and dusk take it
      // down with the world, but never below what still reads as a title.
      key.intensity = THREE.MathUtils.clamp(1.35 * l.key, 0.3, 1.6);
      hemi.intensity = THREE.MathUtils.clamp(1.55 * l.fill, 0.55, 1.8);
      // Eased in, so dusk only hints at it and full night has all of it.
      const g = THREE.MathUtils.smoothstep(l.glow ?? 0, 0.2, 1);
      for (const m of glowMats) m.emissiveIntensity = 0.42 * g;
      (halo.material as THREE.MeshBasicMaterial).opacity = 0.5 * g;
      halo.visible = g > 0.01;
    },

    dispose() {
      disposed = true;
      if (model != null) {
        pivot.remove(model);
        disposeTree(model);
        model = null;
      }
      hemi.dispose();
      key.dispose();
      depthOnly.dispose();
      halo.geometry.dispose();
      (halo.material as THREE.Material).dispose();
      haloTex.dispose();
    },
  };
}

/** Geometry, materials and every texture a material holds. */
function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    for (const m of ([] as THREE.Material[]).concat(mesh.material)) {
      for (const v of Object.values(m)) {
        if (v instanceof THREE.Texture) v.dispose();
      }
      m.dispose();
    }
  });
}

/** A soft round falloff, brightest in the middle, for the night halo. */
function haloTexture(): THREE.Texture {
  const size = 64;
  const canvas =
    typeof document === "undefined" ? null : document.createElement("canvas");
  if (canvas == null) return new THREE.Texture();
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.45)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
