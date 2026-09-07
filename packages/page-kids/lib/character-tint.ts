import * as THREE from "three";

/**
 * Runtime clothing colour for the Explorer, without touching the model.
 *
 * The GLB carries two mask textures on the SAME UV set as its base colour,
 * and names what each channel covers in `material.extras.tintMasks`:
 *
 *   mask 01   R = hoodie    G = t-shirt   B = shorts
 *   mask 02   R = shoes     G = socks
 *
 * So a colour change is a fragment-shader decision, not a new asset: the
 * geometry, rig, clips, UVs and textures are all untouched, and switching
 * colour costs one uniform write. Nothing is downloaded, nothing is
 * duplicated, and the animation never notices.
 *
 * **Why the tint is not a multiply.** The obvious `base * colour` keeps
 * every fold but can only ever darken — a cream t-shirt asked to go
 * bright yellow turns muddy instead, and "yellow shoes" is one of the
 * things this has to be able to do. Dividing by the fabric's own mean
 * brightness first re-lights the weave around the new colour, so the
 * folds, seams and stitching survive at full strength while the hue
 * actually lands where it was asked to.
 *
 * Skin, face, eyes and hair carry no mask, so no channel reaches them.
 * They cannot be tinted by this even by mistake.
 */

export type ClothingRegion = "hoodie" | "shirt" | "shorts" | "shoes" | "socks";

export const CLOTHING_REGIONS: readonly ClothingRegion[] = [
  "hoodie",
  "shirt",
  "shorts",
  "shoes",
  "socks",
];

/** Human words for each region, for the settings panel. */
export const REGION_LABEL: Record<ClothingRegion, string> = {
  hoodie: "Hoodie",
  shirt: "T-shirt",
  shorts: "Shorts",
  shoes: "Shoes",
  socks: "Socks",
};

/**
 * What the artist approved, and what "reset" returns to.
 *
 * Sampled from the approved turnaround sheet rather than typed from
 * memory: a royal blue hoodie with sneakers to match, a white tee and
 * socks, and khaki cargo shorts. Averaged over flat, evenly-lit patches
 * across all four views, with the specular highlights and the skin
 * bleeding in at the neck and ankles excluded — a single pixel picks up
 * whichever of those it happens to land on.
 *
 * These values are for the SWATCH only. The default render applies no
 * tint at all, so the garment shows exactly the texture as painted
 * rather than a re-tint of itself, which would soften it for nothing.
 */
export const DEFAULT_COLOURS: Record<ClothingRegion, string> = {
  hoodie: "#2A4A9E",
  shirt: "#F4EBE5",
  shorts: "#A28459",
  shoes: "#2B4690",
  socks: "#EFEAE6",
};

/**
 * The colours offered as swatches, per garment.
 *
 * Curated rather than a bare picker for two reasons a free picker cannot
 * solve on its own: a child can choose a near-black hoodie that vanishes
 * against the night lands, and five independent free choices very easily
 * become five that fight each other. Every colour here has been kept
 * clear of the darkest ground the trail uses and reads at a distance.
 *
 * The approved colour leads each row, so "put it back" is always the
 * first thing under the thumb. The free picker is still there behind
 * "more" for the child who wants a colour nobody offered them.
 */
export const SWATCHES: Record<ClothingRegion, readonly string[]> = {
  hoodie: [
    DEFAULT_COLOURS.hoodie,
    "#C43B3B", // red
    "#E07A2C", // orange
    "#F0C020", // sunflower
    "#3E9B54", // grass
    "#1FA3A3", // teal
    "#7B4FC0", // grape
    "#D45FA0", // pink
    "#4A4F58", // slate
    "#F2EDE6", // off-white
  ],
  shirt: [
    DEFAULT_COLOURS.shirt,
    "#F5D76B", // butter
    "#9BD4A8", // mint
    "#A9D5EE", // sky
    "#F2B8C6", // blossom
    "#C9B7E8", // lilac
    "#E8A87C", // apricot
    "#6E7A88", // steel
    "#3A3F47", // charcoal
    "#C43B3B", // red
  ],
  shorts: [
    DEFAULT_COLOURS.shorts,
    "#4A5A3A", // olive
    "#2F4858", // deep teal
    "#7A5C3E", // chocolate
    "#3B4B7A", // navy
    "#8C4A55", // brick
    "#6B6F76", // stone
    "#D7C9A8", // sand
    "#2E7D5B", // forest
    "#5B4A78", // plum
  ],
  shoes: [
    DEFAULT_COLOURS.shoes,
    "#C43B3B", // red
    "#F0C020", // yellow
    "#3E9B54", // green
    "#F2EDE6", // white
    "#2B2F36", // black
    "#E07A2C", // orange
    "#D45FA0", // pink
    "#1FA3A3", // teal
    "#8C6239", // tan
  ],
  socks: [
    DEFAULT_COLOURS.socks,
    "#2B2F36", // black
    "#C43B3B", // red
    "#3E9B54", // green
    "#3B4B7A", // navy
    "#F0C020", // yellow
    "#D45FA0", // pink
    "#1FA3A3", // teal
    "#B0B6BE", // grey
    "#E8A87C", // apricot
  ],
};

export type ClothingColours = Partial<Record<ClothingRegion, string>>;

/** Which mask texture and channel each region lives on. */
const CHANNEL: Record<
  ClothingRegion,
  { readonly mask: 1 | 2; readonly index: 0 | 1 | 2 }
> = {
  hoodie: { mask: 1, index: 0 },
  shirt: { mask: 1, index: 1 },
  shorts: { mask: 1, index: 2 },
  shoes: { mask: 2, index: 0 },
  socks: { mask: 2, index: 1 },
};

type TintUniforms = {
  readonly uMask01: { value: THREE.Texture | null };
  readonly uMask02: { value: THREE.Texture | null };
  readonly uTintColour: { value: THREE.Color[] };
  readonly uTintOn: { value: number[] };
};

/**
 * A handle on one tinted character.
 *
 * Held by the world and handed to the settings panel, so a colour change
 * is a method call rather than a rebuild.
 */
export type CharacterTint = {
  setColor(region: ClothingRegion, colour: string | null): void;
  setColors(colours: ClothingColours): void;
  reset(): void;
  /** What is set right now — omitted keys are at their approved default. */
  current(): ClothingColours;
};

/**
 * The GLB documents its own masks, but as glTF texture INDICES:
 *
 *   extras.tintMasks = { mask01Texture: 3, mask02Texture: 4, channels: {...} }
 *
 * GLTFLoader copies `extras` to `userData` verbatim and resolves nothing —
 * it has no way to know those numbers point at textures. So they are
 * resolved here, through the parser that loaded the file, which is also
 * what keeps them out of the material's own texture slots: a mask is data
 * about where the garments are, never something the renderer should light.
 */
type TintExtras = {
  readonly mask01Texture?: number;
  readonly mask02Texture?: number;
};

async function resolveMasks(gltf: {
  readonly scene: THREE.Object3D;
  readonly parser?: {
    getDependency(type: string, index: number): Promise<unknown>;
  };
}): Promise<{ mask01: THREE.Texture | null; mask02: THREE.Texture | null }> {
  const seen: TintExtras[] = [];
  gltf.scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh !== true || seen.length > 0) {
      return;
    }
    for (const material of Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]) {
      const extras = (material as THREE.Material).userData?.["tintMasks"] as
        | TintExtras
        | undefined;
      if (extras != null) {
        seen.push(extras);
        return;
      }
    }
  });
  const found = seen[0] ?? null;
  if (found == null || gltf.parser == null) {
    return { mask01: null, mask02: null };
  }
  const take = async (index: number | undefined) => {
    if (index == null) {
      return null;
    }
    const texture = (await gltf.parser!.getDependency(
      "texture",
      index,
    )) as THREE.Texture;
    // A mask is data, not a picture: reading it through sRGB would bend
    // the very numbers the shader is thresholding on.
    texture.colorSpace = THREE.NoColorSpace;
    texture.flipY = false;
    return texture;
  };
  return {
    mask01: await take(found.mask01Texture),
    mask02: await take(found.mask02Texture),
  };
}

/**
 * Teaches one material to tint, and returns the handle.
 *
 * Returns null when the material carries no masks — a character that was
 * never authored for this simply keeps its own colours rather than
 * failing, which is what lets the Knight and the Skeleton go through the
 * same code path untouched.
 */
export async function attachTint(gltf: {
  readonly scene: THREE.Object3D;
  readonly parser?: {
    getDependency(type: string, index: number): Promise<unknown>;
  };
}): Promise<CharacterTint | null> {
  const { mask01, mask02 } = await resolveMasks(gltf);
  if (mask01 == null && mask02 == null) {
    return null;
  }

  const materials: THREE.MeshStandardMaterial[] = [];
  gltf.scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh !== true) {
      return;
    }
    for (const material of Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]) {
      if ((material as THREE.Material).userData?.["tintMasks"] != null) {
        materials.push(material as THREE.MeshStandardMaterial);
      }
    }
  });

  if (materials.length === 0) {
    return null;
  }

  // One uniform block, shared by every material on the character, so five
  // colours are five writes however the mesh happens to be split up.
  const uniforms: TintUniforms = {
    uMask01: { value: mask01 },
    uMask02: { value: mask02 },
    uTintColour: {
      value: CLOTHING_REGIONS.map(() => new THREE.Color(1, 1, 1)),
    },
    uTintOn: { value: CLOTHING_REGIONS.map(() => 0) },
  };

  for (const material of materials) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms["uMask01"] = uniforms.uMask01;
      shader.uniforms["uMask02"] = uniforms.uMask02;
      shader.uniforms["uTintColour"] = uniforms.uTintColour;
      shader.uniforms["uTintOn"] = uniforms.uTintOn;

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform sampler2D uMask01;
uniform sampler2D uMask02;
uniform vec3 uTintColour[5];
uniform float uTintOn[5];

// Re-light a fabric around a new colour.
//
// Dividing by the patch's own mean brightness normalises the weave to
// roughly 1.0, so multiplying by the target colour lands ON that colour
// while every fold, seam and stitch keeps its full relative contrast.
// A plain multiply would only ever darken.
vec3 kl_tint(vec3 base, vec3 target) {
  float lum = dot(base, vec3(0.2126, 0.7152, 0.0722));
  // The floor keeps a near-black seam from exploding when divided.
  float weave = base.r + base.g + base.b > 0.0 ? lum : 1.0;
  vec3 detail = base / max(weave, 0.04);
  return clamp(detail * target, 0.0, 1.0);
}`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
{
  // Masks ride the base colour's own UV, so no second set is needed and
  // the regions line up with the texture exactly.
  vec3 m1 = texture2D(uMask01, vMapUv).rgb;
  vec3 m2 = texture2D(uMask02, vMapUv).rgb;
  float w[5];
  w[0] = m1.r; w[1] = m1.g; w[2] = m1.b;   // hoodie, t-shirt, shorts
  w[3] = m2.r; w[4] = m2.g;                // shoes, socks

  for (int i = 0; i < 5; i++) {
    // A region contributes only where its own channel is lit AND a colour
    // has actually been chosen, so an untouched garment is bit-for-bit
    // what the artist shipped and nothing bleeds across a boundary.
    float amount = w[i] * uTintOn[i];
    if (amount > 0.0) {
      diffuseColor.rgb = mix(diffuseColor.rgb, kl_tint(diffuseColor.rgb, uTintColour[i]), amount);
    }
  }
}`,
        );
    };
    // Forces a recompile with the injected code the next time it draws.
    material.needsUpdate = true;
  }

  const chosen: ClothingColours = {};

  const apply = (region: ClothingRegion, colour: string | null) => {
    const at = CLOTHING_REGIONS.indexOf(region);
    if (at < 0) {
      return;
    }
    if (colour == null) {
      delete chosen[region];
      uniforms.uTintOn.value[at] = 0;
      return;
    }
    chosen[region] = colour;
    uniforms.uTintColour.value[at]!.set(colour);
    // three's colours are linear-space; the picker hands us sRGB.
    uniforms.uTintColour.value[at]!.convertSRGBToLinear();
    uniforms.uTintOn.value[at] = 1;
  };

  return {
    setColor: apply,
    setColors: (colours) => {
      for (const region of CLOTHING_REGIONS) {
        if (region in colours) {
          apply(region, colours[region] ?? null);
        }
      }
    },
    reset: () => {
      for (const region of CLOTHING_REGIONS) {
        apply(region, null);
      }
    },
    current: () => ({ ...chosen }),
  };
}

/** Which mask channel a region reads — exported so a test can assert it. */
export function channelOf(region: ClothingRegion): {
  mask: 1 | 2;
  index: 0 | 1 | 2;
} {
  return CHANNEL[region];
}
