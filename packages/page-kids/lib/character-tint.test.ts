import { readFileSync } from "node:fs";
import { test } from "node:test";
import { deepEqual, equal, isTrue } from "rich-assert";
import {
  channelOf,
  CLOTHING_REGIONS,
  DEFAULT_COLOURS,
  REGION_LABEL,
  SWATCHES,
} from "./character-tint.ts";

/**
 * The mapping is a contract with the model, and the model states it in
 * its own `extras.tintMasks`. If these two ever disagree, a child asking
 * for red shoes gets red socks — and nothing about that failure looks
 * like a bug from the code's side, which is why it is pinned here.
 *
 *   mask 01   R = hoodie   G = t-shirt   B = shorts
 *   mask 02   R = shoes    G = socks
 */

/**
 * Read the mapping out of the shipped model itself.
 *
 * Everything below asserts the code against the GLB rather than against
 * another constant in the same file — a self-consistent mapping that
 * disagrees with the art is exactly the failure this is for.
 */
function mappingFromModel(): Record<string, string> {
  const buf = readFileSync(
    new URL(
      "../../../root/public/kids-assets/models/hero/Explorer.glb",
      import.meta.url,
    ),
  );
  let at = 12;
  while (at < buf.length) {
    const len = buf.readUInt32LE(at);
    const kind = buf.readUInt32LE(at + 4);
    if (kind === 0x4e4f534a) {
      const gltf = JSON.parse(
        buf.subarray(at + 8, at + 8 + len).toString("utf8"),
      ) as {
        materials?: {
          extras?: {
            tintMasks?: { channels?: Record<string, Record<string, string>> };
          };
        }[];
      };
      const channels = gltf.materials?.[0]?.extras?.tintMasks?.channels ?? {};
      const flat: Record<string, string> = {};
      for (const [mask, byChannel] of Object.entries(channels)) {
        for (const [channel, garment] of Object.entries(byChannel)) {
          flat[garment.toLowerCase()] = `${mask}:${channel}`;
        }
      }
      return flat;
    }
    at += 8 + len + ((4 - (len % 4)) % 4);
  }
  return {};
}

test("the code's mapping is the one the model ships with", (t) => {
  const model = mappingFromModel();
  // The shipped character was replaced on 7 Sep 2026 with the 20-animation
  // export, which carries no `extras.tintMasks` at all — so there is no
  // contract to check and nothing to disagree with. Tinting is inert on this
  // model rather than wrong, and the picker that drove it was removed when it
  // turned out nothing read the pref it wrote.
  //
  // Skipped rather than deleted, and conditionally rather than permanently:
  // the day a masked model ships again this is the test that stops a child
  // asking for red shoes and getting red socks, and it should come back by
  // itself on that day rather than waiting for somebody to remember it.
  if (Object.keys(model).length === 0) {
    t.skip("the shipped model documents no tint masks");
    return;
  }
  isTrue(
    Object.keys(model).length === 5,
    "the GLB no longer documents five garments",
  );

  const asModelWritesIt: Record<string, string> = {
    "hoodie": "mask01:R",
    "t-shirt": "mask01:G",
    "shorts": "mask01:B",
    "shoes": "mask02:R",
    "socks": "mask02:G",
  };
  deepEqual(model, asModelWritesIt);

  // And the same thing again, through the code's own accessor.
  const channelLetter = ["R", "G", "B"] as const;
  for (const region of CLOTHING_REGIONS) {
    const { mask, index } = channelOf(region);
    const garment = region === "shirt" ? "t-shirt" : region;
    equal(
      model[garment],
      `mask0${mask}:${channelLetter[index]}`,
      `${region} disagrees with the model`,
    );
  }
});

test("each garment reads the channel the GLB says it does", () => {
  deepEqual(channelOf("hoodie"), { mask: 1, index: 0 });
  deepEqual(channelOf("shirt"), { mask: 1, index: 1 });
  deepEqual(channelOf("shorts"), { mask: 1, index: 2 });
  deepEqual(channelOf("shoes"), { mask: 2, index: 0 });
  deepEqual(channelOf("socks"), { mask: 2, index: 1 });
});

test("no two garments share a channel", () => {
  // This is the whole no-bleed guarantee at the mapping level: if two
  // regions read the same channel, tinting one tints the other and no
  // amount of care in the shader can separate them again.
  const seen = new Set<string>();
  for (const region of CLOTHING_REGIONS) {
    const { mask, index } = channelOf(region);
    const key = `${mask}:${index}`;
    isTrue(!seen.has(key), `${region} shares ${key} with another garment`);
    seen.add(key);
  }
  equal(seen.size, 5);
});

test("the five garments are exactly the five the model masks", () => {
  deepEqual(
    [...CLOTHING_REGIONS],
    ["hoodie", "shirt", "shorts", "shoes", "socks"],
  );
});

test("every garment has a label and an approved default", () => {
  for (const region of CLOTHING_REGIONS) {
    isTrue(REGION_LABEL[region].length > 0, `${region} has no label`);
    isTrue(
      /^#[0-9a-fA-F]{6}$/.test(DEFAULT_COLOURS[region]),
      `${region}'s default is not a hex colour`,
    );
  }
});

test("the blue channel of mask 02 is unused, and stays that way", () => {
  // Two garments on a three-channel mask leaves B free. Anything that
  // starts reading it is a sixth region nobody has authored, so the
  // absence is asserted rather than assumed.
  const onMask2 = CLOTHING_REGIONS.filter((r) => channelOf(r).mask === 2);
  equal(onMask2.length, 2);
  isTrue(onMask2.every((r) => channelOf(r).index !== 2));
});

test("every swatch row leads with the approved colour", () => {
  // "Put it back" should always be the first thing under a child's thumb,
  // and it is also how the panel knows which swatch to show as selected
  // at rest.
  for (const region of CLOTHING_REGIONS) {
    equal(
      SWATCHES[region][0],
      DEFAULT_COLOURS[region],
      `${region}'s row does not lead with its default`,
    );
  }
});

test("no swatch is dark enough to disappear against the night lands", () => {
  // A near-black hoodie on a night trail is a child who cannot find
  // themselves. The floor is deliberately generous — charcoal and black
  // are allowed on shoes and socks, which are small and sit against the
  // ground rather than against the sky.
  const luminance = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };
  for (const region of ["hoodie", "shirt", "shorts"] as const) {
    for (const colour of SWATCHES[region]) {
      isTrue(
        luminance(colour) > 0.12,
        `${region} swatch ${colour} is too dark to read on a dark land`,
      );
    }
  }
});

test("every swatch is a real hex colour", () => {
  for (const region of CLOTHING_REGIONS) {
    isTrue(
      SWATCHES[region].length >= 6,
      `${region} has too few swatches to be worth a row`,
    );
    for (const colour of SWATCHES[region]) {
      isTrue(
        /^#[0-9A-Fa-f]{6}$/.test(colour),
        `${region} has a bad swatch: ${colour}`,
      );
    }
  }
});
