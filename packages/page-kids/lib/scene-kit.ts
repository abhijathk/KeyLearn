import type { Land, WorldTheme } from "./world.ts";

/**
 * THE SCENE KIT: what each scene of the Hero Trail and of Dino Run is made of.
 *
 * A scene is ten lessons, and the same record is what the approved scene mocks
 * were drawn from (keylearn-world-mocks/hero-trail and dino-run, `pick_scene` and
 * `kit.pick`). These tables are that selection run for the first sixty scenes,
 * so scene 7 here is scene 7 there: terrain, landmark, season, light and trees.
 * Past the sixtieth the sequence starts again, which is six hundred lessons
 * in.
 *
 * Everything a record names is a setting of the one shared asset kit, so a new
 * scene costs no download of its own.
 */

export type HeroTerrain =
  | "flat"
  | "meadow"
  | "hill"
  | "sunken"
  | "ridge"
  | "gully"
  | "boggy"
  | "lake"
  | "clearing";
export type HeroSeason = "spring" | "summer" | "autumn" | "winter";
export type HeroWeather =
  | "noon"
  | "morning"
  | "golden"
  | "misty"
  | "overcast"
  | "dusk";
export type HeroTrees = "oak" | "birch" | "mixed" | "pine" | "sparse";
export type HeroScene = {
  readonly terrain: HeroTerrain;
  /** What stands along the road: a landmark, or the thing bound to the terrain. */
  readonly landmark: string;
  readonly season: HeroSeason;
  readonly weather: HeroWeather;
  readonly trees: HeroTrees;
};

export type DinoShape =
  | "valley"
  | "ridge"
  | "ash"
  | "flat"
  | "canyon"
  | "coast"
  | "hills";
export type DinoWeather =
  | "noon"
  | "golden"
  | "overcast"
  | "fog"
  | "dusk"
  | "storm"
  | "night";
export type DinoScene = {
  readonly shape: DinoShape;
  readonly palette: string;
  readonly veg: string;
  readonly landmarks: readonly string[];
  readonly weather: DinoWeather;
  readonly dinos: readonly string[];
  readonly palms?: number;
  readonly river?: true;
};

export const HERO_SCENES: readonly HeroScene[] = [
  {
    terrain: "meadow",
    landmark: "bridge",
    season: "summer",
    weather: "noon",
    trees: "mixed",
  },
  {
    terrain: "hill",
    landmark: "steps",
    season: "spring",
    weather: "morning",
    trees: "birch",
  },
  {
    terrain: "sunken",
    landmark: "hedges",
    season: "autumn",
    weather: "golden",
    trees: "oak",
  },
  {
    terrain: "ridge",
    landmark: "fence",
    season: "autumn",
    weather: "golden",
    trees: "sparse",
  },
  {
    terrain: "clearing",
    landmark: "campfire",
    season: "summer",
    weather: "misty",
    trees: "pine",
  },
  {
    terrain: "lake",
    landmark: "dock",
    season: "summer",
    weather: "noon",
    trees: "mixed",
  },
  {
    terrain: "sunken",
    landmark: "tower",
    season: "winter",
    weather: "morning",
    trees: "pine",
  },
  {
    terrain: "hill",
    landmark: "ruins",
    season: "autumn",
    weather: "dusk",
    trees: "birch",
  },
  {
    terrain: "boggy",
    landmark: "windmill",
    season: "spring",
    weather: "golden",
    trees: "sparse",
  },
  {
    terrain: "gully",
    landmark: "campfire",
    season: "autumn",
    weather: "overcast",
    trees: "pine",
  },
  {
    terrain: "ridge",
    landmark: "shrine",
    season: "summer",
    weather: "dusk",
    trees: "sparse",
  },
  {
    terrain: "hill",
    landmark: "tower",
    season: "winter",
    weather: "noon",
    trees: "oak",
  },
  {
    terrain: "flat",
    landmark: "arch",
    season: "summer",
    weather: "golden",
    trees: "sparse",
  },
  {
    terrain: "meadow",
    landmark: "bridge",
    season: "spring",
    weather: "overcast",
    trees: "pine",
  },
  {
    terrain: "sunken",
    landmark: "ruins",
    season: "winter",
    weather: "dusk",
    trees: "mixed",
  },
  {
    terrain: "hill",
    landmark: "shrine",
    season: "spring",
    weather: "noon",
    trees: "sparse",
  },
  {
    terrain: "boggy",
    landmark: "tower",
    season: "summer",
    weather: "overcast",
    trees: "mixed",
  },
  {
    terrain: "ridge",
    landmark: "windmill",
    season: "winter",
    weather: "golden",
    trees: "sparse",
  },
  {
    terrain: "flat",
    landmark: "campfire",
    season: "summer",
    weather: "misty",
    trees: "oak",
  },
  {
    terrain: "lake",
    landmark: "dock",
    season: "winter",
    weather: "overcast",
    trees: "birch",
  },
  {
    terrain: "boggy",
    landmark: "ruins",
    season: "summer",
    weather: "morning",
    trees: "sparse",
  },
  {
    terrain: "sunken",
    landmark: "shrine",
    season: "spring",
    weather: "noon",
    trees: "oak",
  },
  {
    terrain: "hill",
    landmark: "windmill",
    season: "autumn",
    weather: "dusk",
    trees: "birch",
  },
  {
    terrain: "ridge",
    landmark: "tower",
    season: "winter",
    weather: "misty",
    trees: "pine",
  },
  {
    terrain: "gully",
    landmark: "arch",
    season: "spring",
    weather: "morning",
    trees: "birch",
  },
  {
    terrain: "sunken",
    landmark: "campfire",
    season: "summer",
    weather: "dusk",
    trees: "pine",
  },
  {
    terrain: "hill",
    landmark: "ruins",
    season: "winter",
    weather: "golden",
    trees: "oak",
  },
  {
    terrain: "flat",
    landmark: "shrine",
    season: "summer",
    weather: "overcast",
    trees: "sparse",
  },
  {
    terrain: "meadow",
    landmark: "bridge",
    season: "winter",
    weather: "morning",
    trees: "birch",
  },
  {
    terrain: "boggy",
    landmark: "tower",
    season: "autumn",
    weather: "dusk",
    trees: "mixed",
  },
  {
    terrain: "ridge",
    landmark: "windmill",
    season: "summer",
    weather: "noon",
    trees: "sparse",
  },
  {
    terrain: "gully",
    landmark: "campfire",
    season: "winter",
    weather: "golden",
    trees: "birch",
  },
  {
    terrain: "lake",
    landmark: "dock",
    season: "spring",
    weather: "overcast",
    trees: "pine",
  },
  {
    terrain: "flat",
    landmark: "arch",
    season: "winter",
    weather: "misty",
    trees: "oak",
  },
  {
    terrain: "sunken",
    landmark: "tower",
    season: "spring",
    weather: "dusk",
    trees: "pine",
  },
  {
    terrain: "hill",
    landmark: "shrine",
    season: "winter",
    weather: "noon",
    trees: "sparse",
  },
  {
    terrain: "boggy",
    landmark: "ruins",
    season: "autumn",
    weather: "morning",
    trees: "oak",
  },
  {
    terrain: "ridge",
    landmark: "campfire",
    season: "winter",
    weather: "misty",
    trees: "pine",
  },
  {
    terrain: "flat",
    landmark: "windmill",
    season: "autumn",
    weather: "golden",
    trees: "sparse",
  },
  {
    terrain: "hill",
    landmark: "tower",
    season: "summer",
    weather: "noon",
    trees: "oak",
  },
  {
    terrain: "gully",
    landmark: "shrine",
    season: "winter",
    weather: "morning",
    trees: "birch",
  },
  {
    terrain: "ridge",
    landmark: "ruins",
    season: "autumn",
    weather: "golden",
    trees: "mixed",
  },
  {
    terrain: "sunken",
    landmark: "campfire",
    season: "winter",
    weather: "overcast",
    trees: "oak",
  },
  {
    terrain: "meadow",
    landmark: "bridge",
    season: "autumn",
    weather: "noon",
    trees: "mixed",
  },
  {
    terrain: "gully",
    landmark: "windmill",
    season: "summer",
    weather: "morning",
    trees: "oak",
  },
  {
    terrain: "ridge",
    landmark: "shrine",
    season: "spring",
    weather: "golden",
    trees: "sparse",
  },
  {
    terrain: "flat",
    landmark: "ruins",
    season: "summer",
    weather: "misty",
    trees: "birch",
  },
  {
    terrain: "boggy",
    landmark: "arch",
    season: "autumn",
    weather: "overcast",
    trees: "sparse",
  },
  {
    terrain: "lake",
    landmark: "dock",
    season: "summer",
    weather: "dusk",
    trees: "mixed",
  },
  {
    terrain: "gully",
    landmark: "campfire",
    season: "winter",
    weather: "noon",
    trees: "pine",
  },
  {
    terrain: "sunken",
    landmark: "windmill",
    season: "summer",
    weather: "golden",
    trees: "sparse",
  },
  {
    terrain: "boggy",
    landmark: "tower",
    season: "spring",
    weather: "morning",
    trees: "mixed",
  },
  {
    terrain: "flat",
    landmark: "shrine",
    season: "summer",
    weather: "dusk",
    trees: "oak",
  },
  {
    terrain: "gully",
    landmark: "ruins",
    season: "autumn",
    weather: "misty",
    trees: "pine",
  },
  {
    terrain: "hill",
    landmark: "campfire",
    season: "spring",
    weather: "golden",
    trees: "oak",
  },
  {
    terrain: "ridge",
    landmark: "windmill",
    season: "autumn",
    weather: "overcast",
    trees: "mixed",
  },
  {
    terrain: "flat",
    landmark: "arch",
    season: "summer",
    weather: "misty",
    trees: "pine",
  },
  {
    terrain: "gully",
    landmark: "tower",
    season: "winter",
    weather: "morning",
    trees: "mixed",
  },
  {
    terrain: "meadow",
    landmark: "bridge",
    season: "summer",
    weather: "noon",
    trees: "sparse",
  },
  {
    terrain: "sunken",
    landmark: "ruins",
    season: "spring",
    weather: "overcast",
    trees: "oak",
  },
];

export const DINO_SCENES: readonly DinoScene[] = [
  {
    shape: "valley",
    palette: "lush",
    veg: "ferns",
    landmarks: ["river"],
    weather: "noon",
    dinos: [
      "Stegosaurus",
      "Triceratops",
      "Velociraptor",
      "Apatosaurus",
      "Parasaurolophus",
    ],
  },
  {
    shape: "ridge",
    palette: "moss",
    veg: "redwood",
    landmarks: [],
    weather: "overcast",
    dinos: [
      "Stegosaurus",
      "Triceratops",
      "Velociraptor",
      "Apatosaurus",
      "Parasaurolophus",
    ],
  },
  {
    shape: "ash",
    palette: "ash",
    veg: "bare",
    landmarks: [],
    weather: "dusk",
    dinos: [
      "Stegosaurus",
      "Triceratops",
      "Velociraptor",
      "Apatosaurus",
      "Parasaurolophus",
    ],
  },
  {
    shape: "flat",
    palette: "mud_olive",
    veg: "swamp",
    landmarks: [],
    weather: "fog",
    dinos: [
      "Stegosaurus",
      "Triceratops",
      "Velociraptor",
      "Apatosaurus",
      "Parasaurolophus",
    ],
  },
  {
    shape: "canyon",
    palette: "rock_red",
    veg: "scrub",
    landmarks: [],
    weather: "golden",
    dinos: [
      "Stegosaurus",
      "Triceratops",
      "Velociraptor",
      "Apatosaurus",
      "Parasaurolophus",
    ],
  },
  {
    shape: "coast",
    palette: "sand_gold",
    veg: "beach",
    landmarks: [],
    weather: "noon",
    dinos: [
      "Stegosaurus",
      "Triceratops",
      "Velociraptor",
      "Apatosaurus",
      "Parasaurolophus",
    ],
  },
  {
    shape: "valley",
    palette: "lilac",
    veg: "cycad",
    landmarks: ["bones"],
    weather: "overcast",
    dinos: [
      "TRex",
      "Triceratops",
      "Velociraptor",
      "Parasaurolophus",
      "Stegosaurus",
      "Apatosaurus",
    ],
    palms: 24,
    river: true,
  },
  {
    shape: "ash",
    palette: "ash",
    veg: "bare",
    landmarks: ["nest"],
    weather: "storm",
    dinos: [
      "TRex",
      "Triceratops",
      "Apatosaurus",
      "Velociraptor",
      "Parasaurolophus",
      "Stegosaurus",
    ],
    palms: 14,
  },
  {
    shape: "hills",
    palette: "savanna",
    veg: "cycad",
    landmarks: ["arches"],
    weather: "fog",
    dinos: [
      "TRex",
      "Triceratops",
      "Stegosaurus",
      "Apatosaurus",
      "Velociraptor",
    ],
    palms: 34,
  },
  {
    shape: "ridge",
    palette: "moss",
    veg: "redwood",
    landmarks: ["geyser"],
    weather: "noon",
    dinos: ["TRex", "Stegosaurus", "Triceratops", "Apatosaurus"],
    palms: 34,
  },
  {
    shape: "flat",
    palette: "mud_olive",
    veg: "swamp",
    landmarks: ["bones"],
    weather: "storm",
    dinos: [
      "TRex",
      "Triceratops",
      "Apatosaurus",
      "Parasaurolophus",
      "Stegosaurus",
      "Velociraptor",
    ],
    palms: 24,
  },
  {
    shape: "canyon",
    palette: "rock_violet",
    veg: "scrub",
    landmarks: ["nest"],
    weather: "night",
    dinos: [
      "TRex",
      "Stegosaurus",
      "Velociraptor",
      "Parasaurolophus",
      "Triceratops",
    ],
    palms: 34,
  },
  {
    shape: "ash",
    palette: "ash",
    veg: "bare",
    landmarks: ["arches"],
    weather: "dusk",
    dinos: ["TRex", "Stegosaurus", "Triceratops", "Velociraptor"],
    palms: 24,
  },
  {
    shape: "valley",
    palette: "lush",
    veg: "cycad",
    landmarks: ["geyser"],
    weather: "fog",
    dinos: [
      "TRex",
      "Parasaurolophus",
      "Apatosaurus",
      "Stegosaurus",
      "Triceratops",
      "Velociraptor",
    ],
    palms: 34,
    river: true,
  },
  {
    shape: "ridge",
    palette: "moss",
    veg: "ferns",
    landmarks: ["bones"],
    weather: "overcast",
    dinos: ["TRex", "Apatosaurus", "Velociraptor", "Stegosaurus"],
    palms: 34,
  },
  {
    shape: "coast",
    palette: "sand_gold",
    veg: "beach",
    landmarks: ["nest"],
    weather: "night",
    dinos: ["TRex", "Stegosaurus", "Triceratops", "Parasaurolophus"],
    palms: 14,
  },
  {
    shape: "canyon",
    palette: "rock_violet",
    veg: "scrub",
    landmarks: [],
    weather: "fog",
    dinos: ["TRex", "Triceratops", "Velociraptor", "Stegosaurus"],
    palms: 34,
  },
  {
    shape: "hills",
    palette: "savanna",
    veg: "cycad",
    landmarks: ["lake"],
    weather: "noon",
    dinos: ["TRex", "Stegosaurus", "Apatosaurus", "Triceratops"],
    palms: 14,
  },
  {
    shape: "valley",
    palette: "moss",
    veg: "redwood",
    landmarks: ["waterfall", "arches"],
    weather: "dusk",
    dinos: [
      "TRex",
      "Velociraptor",
      "Apatosaurus",
      "Stegosaurus",
      "Triceratops",
      "Parasaurolophus",
    ],
    palms: 34,
  },
  {
    shape: "ash",
    palette: "ash",
    veg: "bare",
    landmarks: ["geyser"],
    weather: "golden",
    dinos: [
      "TRex",
      "Stegosaurus",
      "Velociraptor",
      "Parasaurolophus",
      "Apatosaurus",
    ],
    palms: 14,
  },
  {
    shape: "flat",
    palette: "mud_peat",
    veg: "swamp",
    landmarks: ["bones", "nest"],
    weather: "storm",
    dinos: ["TRex", "Stegosaurus", "Parasaurolophus", "Apatosaurus"],
    palms: 34,
  },
  {
    shape: "canyon",
    palette: "rock_buff",
    veg: "scrub",
    landmarks: [],
    weather: "noon",
    dinos: ["TRex", "Velociraptor", "Apatosaurus", "Stegosaurus"],
    palms: 34,
  },
  {
    shape: "coast",
    palette: "sand_white",
    veg: "beach",
    landmarks: ["arches"],
    weather: "fog",
    dinos: ["TRex", "Stegosaurus", "Triceratops", "Apatosaurus"],
    palms: 34,
  },
  {
    shape: "hills",
    palette: "lush",
    veg: "cycad",
    landmarks: ["lake"],
    weather: "golden",
    dinos: [
      "TRex",
      "Velociraptor",
      "Apatosaurus",
      "Parasaurolophus",
      "Triceratops",
    ],
    palms: 14,
  },
  {
    shape: "valley",
    palette: "moss",
    veg: "cycad",
    landmarks: ["bones"],
    weather: "noon",
    dinos: [
      "TRex",
      "Apatosaurus",
      "Parasaurolophus",
      "Triceratops",
      "Stegosaurus",
      "Velociraptor",
    ],
    palms: 24,
  },
  {
    shape: "ridge",
    palette: "lilac",
    veg: "redwood",
    landmarks: ["geyser"],
    weather: "overcast",
    dinos: [
      "TRex",
      "Parasaurolophus",
      "Velociraptor",
      "Apatosaurus",
      "Stegosaurus",
      "Triceratops",
    ],
    palms: 34,
  },
  {
    shape: "flat",
    palette: "mud_olive",
    veg: "swamp",
    landmarks: ["nest"],
    weather: "storm",
    dinos: [
      "TRex",
      "Parasaurolophus",
      "Triceratops",
      "Apatosaurus",
      "Velociraptor",
      "Stegosaurus",
    ],
    palms: 14,
  },
  {
    shape: "coast",
    palette: "sand_gold",
    veg: "beach",
    landmarks: ["arches"],
    weather: "noon",
    dinos: [
      "TRex",
      "Triceratops",
      "Apatosaurus",
      "Stegosaurus",
      "Velociraptor",
    ],
    palms: 34,
  },
  {
    shape: "hills",
    palette: "savanna",
    veg: "ferns",
    landmarks: ["bones", "lake"],
    weather: "dusk",
    dinos: ["TRex", "Stegosaurus", "Triceratops", "Velociraptor"],
    palms: 34,
  },
  {
    shape: "canyon",
    palette: "rock_red",
    veg: "scrub",
    landmarks: ["geyser"],
    weather: "golden",
    dinos: ["TRex", "Triceratops", "Stegosaurus", "Velociraptor"],
    palms: 14,
  },
  {
    shape: "ash",
    palette: "ash",
    veg: "bare",
    landmarks: ["nest"],
    weather: "storm",
    dinos: ["TRex", "Velociraptor", "Stegosaurus", "Apatosaurus"],
    palms: 34,
  },
  {
    shape: "flat",
    palette: "mud_olive",
    veg: "swamp",
    landmarks: [],
    weather: "fog",
    dinos: [
      "TRex",
      "Velociraptor",
      "Stegosaurus",
      "Apatosaurus",
      "Triceratops",
    ],
    palms: 34,
  },
  {
    shape: "ridge",
    palette: "lilac",
    veg: "ferns",
    landmarks: ["bones"],
    weather: "noon",
    dinos: ["TRex", "Velociraptor", "Parasaurolophus", "Stegosaurus"],
    palms: 24,
  },
  {
    shape: "coast",
    palette: "sand_white",
    veg: "beach",
    landmarks: ["arches"],
    weather: "golden",
    dinos: [
      "TRex",
      "Apatosaurus",
      "Stegosaurus",
      "Triceratops",
      "Velociraptor",
    ],
    palms: 34,
  },
  {
    shape: "canyon",
    palette: "rock_red",
    veg: "scrub",
    landmarks: ["geyser"],
    weather: "fog",
    dinos: ["TRex", "Apatosaurus", "Parasaurolophus", "Triceratops"],
    palms: 14,
  },
  {
    shape: "valley",
    palette: "savanna",
    veg: "redwood",
    landmarks: ["lake"],
    weather: "storm",
    dinos: [
      "TRex",
      "Parasaurolophus",
      "Velociraptor",
      "Stegosaurus",
      "Apatosaurus",
    ],
    palms: 24,
    river: true,
  },
  {
    shape: "ash",
    palette: "ash",
    veg: "bare",
    landmarks: ["bones"],
    weather: "golden",
    dinos: [
      "TRex",
      "Parasaurolophus",
      "Apatosaurus",
      "Triceratops",
      "Velociraptor",
    ],
    palms: 34,
  },
  {
    shape: "flat",
    palette: "mud_peat",
    veg: "swamp",
    landmarks: ["nest"],
    weather: "noon",
    dinos: [
      "TRex",
      "Velociraptor",
      "Apatosaurus",
      "Stegosaurus",
      "Triceratops",
      "Parasaurolophus",
    ],
    palms: 24,
  },
  {
    shape: "coast",
    palette: "sand_white",
    veg: "beach",
    landmarks: ["arches"],
    weather: "storm",
    dinos: [
      "TRex",
      "Velociraptor",
      "Apatosaurus",
      "Triceratops",
      "Stegosaurus",
      "Parasaurolophus",
    ],
    palms: 34,
  },
  {
    shape: "ridge",
    palette: "lush",
    veg: "ferns",
    landmarks: ["geyser"],
    weather: "fog",
    dinos: [
      "TRex",
      "Stegosaurus",
      "Velociraptor",
      "Apatosaurus",
      "Triceratops",
    ],
    palms: 14,
  },
  {
    shape: "hills",
    palette: "ochre",
    veg: "meadow",
    landmarks: ["bones", "lake"],
    weather: "noon",
    dinos: ["TRex", "Stegosaurus", "Triceratops", "Apatosaurus"],
    palms: 34,
  },
  {
    shape: "ash",
    palette: "ash",
    veg: "bare",
    landmarks: ["nest"],
    weather: "night",
    dinos: ["TRex", "Apatosaurus", "Velociraptor", "Stegosaurus"],
    palms: 34,
  },
  {
    shape: "flat",
    palette: "mud_olive",
    veg: "swamp",
    landmarks: [],
    weather: "golden",
    dinos: [
      "TRex",
      "Triceratops",
      "Velociraptor",
      "Stegosaurus",
      "Parasaurolophus",
    ],
    palms: 24,
  },
  {
    shape: "coast",
    palette: "sand_gold",
    veg: "beach",
    landmarks: ["arches"],
    weather: "overcast",
    dinos: [
      "TRex",
      "Triceratops",
      "Velociraptor",
      "Parasaurolophus",
      "Stegosaurus",
    ],
    palms: 24,
  },
  {
    shape: "canyon",
    palette: "rock_buff",
    veg: "scrub",
    landmarks: ["bones", "geyser"],
    weather: "dusk",
    dinos: [
      "TRex",
      "Velociraptor",
      "Apatosaurus",
      "Parasaurolophus",
      "Stegosaurus",
      "Triceratops",
    ],
    palms: 34,
  },
  {
    shape: "hills",
    palette: "moss",
    veg: "cycad",
    landmarks: ["lake"],
    weather: "night",
    dinos: [
      "TRex",
      "Apatosaurus",
      "Parasaurolophus",
      "Stegosaurus",
      "Triceratops",
      "Velociraptor",
    ],
    palms: 24,
  },
  {
    shape: "valley",
    palette: "lush",
    veg: "cycad",
    landmarks: ["nest"],
    weather: "golden",
    dinos: [
      "TRex",
      "Triceratops",
      "Apatosaurus",
      "Stegosaurus",
      "Parasaurolophus",
      "Velociraptor",
    ],
    palms: 34,
  },
  {
    shape: "ridge",
    palette: "lilac",
    veg: "ferns",
    landmarks: ["arches"],
    weather: "storm",
    dinos: [
      "TRex",
      "Apatosaurus",
      "Triceratops",
      "Stegosaurus",
      "Parasaurolophus",
      "Velociraptor",
    ],
    palms: 24,
  },
  {
    shape: "coast",
    palette: "sand_white",
    veg: "beach",
    landmarks: ["bones"],
    weather: "fog",
    dinos: ["TRex", "Apatosaurus", "Parasaurolophus", "Triceratops"],
    palms: 14,
  },
  {
    shape: "ash",
    palette: "ash",
    veg: "bare",
    landmarks: ["geyser"],
    weather: "overcast",
    dinos: [
      "TRex",
      "Apatosaurus",
      "Parasaurolophus",
      "Velociraptor",
      "Triceratops",
      "Stegosaurus",
    ],
    palms: 34,
  },
  {
    shape: "flat",
    palette: "mud_olive",
    veg: "swamp",
    landmarks: ["nest"],
    weather: "storm",
    dinos: ["TRex", "Parasaurolophus", "Stegosaurus", "Velociraptor"],
    palms: 14,
  },
  {
    shape: "hills",
    palette: "moss",
    veg: "ferns",
    landmarks: ["lake"],
    weather: "dusk",
    dinos: [
      "TRex",
      "Stegosaurus",
      "Velociraptor",
      "Triceratops",
      "Apatosaurus",
    ],
    palms: 34,
  },
  {
    shape: "canyon",
    palette: "rock_red",
    veg: "scrub",
    landmarks: ["bones"],
    weather: "noon",
    dinos: [
      "TRex",
      "Triceratops",
      "Parasaurolophus",
      "Apatosaurus",
      "Stegosaurus",
    ],
    palms: 34,
  },
  {
    shape: "valley",
    palette: "ochre",
    veg: "cycad",
    landmarks: ["arches"],
    weather: "overcast",
    dinos: [
      "TRex",
      "Triceratops",
      "Velociraptor",
      "Apatosaurus",
      "Stegosaurus",
    ],
    palms: 24,
    river: true,
  },
  {
    shape: "coast",
    palette: "sand_gold",
    veg: "beach",
    landmarks: ["nest"],
    weather: "golden",
    dinos: [
      "TRex",
      "Stegosaurus",
      "Apatosaurus",
      "Triceratops",
      "Velociraptor",
    ],
    palms: 34,
  },
  {
    shape: "flat",
    palette: "mud_olive",
    veg: "swamp",
    landmarks: ["geyser"],
    weather: "dusk",
    dinos: [
      "TRex",
      "Apatosaurus",
      "Stegosaurus",
      "Triceratops",
      "Parasaurolophus",
      "Velociraptor",
    ],
    palms: 24,
  },
  {
    shape: "ash",
    palette: "ash",
    veg: "bare",
    landmarks: ["bones"],
    weather: "storm",
    dinos: ["TRex", "Stegosaurus", "Apatosaurus", "Velociraptor"],
    palms: 34,
  },
  {
    shape: "canyon",
    palette: "rock_red",
    veg: "scrub",
    landmarks: [],
    weather: "noon",
    dinos: [
      "TRex",
      "Triceratops",
      "Velociraptor",
      "Apatosaurus",
      "Parasaurolophus",
      "Stegosaurus",
    ],
    palms: 24,
  },
  {
    shape: "hills",
    palette: "savanna",
    veg: "cycad",
    landmarks: ["arches"],
    weather: "fog",
    dinos: [
      "TRex",
      "Stegosaurus",
      "Apatosaurus",
      "Triceratops",
      "Parasaurolophus",
      "Velociraptor",
    ],
    palms: 24,
  },
  {
    shape: "valley",
    palette: "ochre",
    veg: "redwood",
    landmarks: ["nest", "waterfall"],
    weather: "dusk",
    dinos: ["TRex", "Parasaurolophus", "Apatosaurus", "Velociraptor"],
    palms: 24,
    river: true,
  },
];

export const heroSceneAt = (scene: number): HeroScene =>
  HERO_SCENES[
    ((scene % HERO_SCENES.length) + HERO_SCENES.length) % HERO_SCENES.length
  ]!;
export const dinoSceneAt = (scene: number): DinoScene =>
  DINO_SCENES[
    ((scene % DINO_SCENES.length) + DINO_SCENES.length) % DINO_SCENES.length
  ]!;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ── the Hero Trail: a scene's record turned into a land ────────────────────

/** The ground of each season, from the scene mock's SEASON_STYLE. */
const SEASON_GROUND: Record<
  HeroSeason,
  { grass: number; grassVar: number; dirt: number }
> = {
  spring: { grass: 0x5f9f3e, grassVar: 0x98c85a, dirt: 0xb09060 },
  summer: { grass: 0x78bc48, grassVar: 0xb4dc5c, dirt: 0xc2a078 },
  autumn: { grass: 0x9a7a24, grassVar: 0xc89a3a, dirt: 0x9a6a3a },
  winter: { grass: 0xdfe8f0, grassVar: 0xf6fafc, dirt: 0xa89e92 },
};

/** How the foliage is recoloured in each season (summer is the model's own). */
const SEASON_FOLIAGE: Record<
  HeroSeason,
  { leaf: number; trunk: number; strength: number } | undefined
> = {
  spring: { leaf: 0x86c060, trunk: 0x6a5238, strength: 0.45 },
  summer: undefined,
  autumn: { leaf: 0xe0902c, trunk: 0x6a4630, strength: 0.88 },
  winter: { leaf: 0xdfeeee, trunk: 0x7a7a80, strength: 0.7 },
};

/** Light and haze of each time of day. */
const HERO_LIGHT: Record<
  HeroWeather,
  { sun: number; fog: number; mood: "day" | "overcast" }
> = {
  noon: { sun: 0xfff4d8, fog: 0xcdeec0, mood: "day" },
  morning: { sun: 0xffe6c4, fog: 0xdfead0, mood: "day" },
  golden: { sun: 0xffcf8c, fog: 0xf0d9b0, mood: "day" },
  misty: { sun: 0xdfe9f0, fog: 0xc6d6d8, mood: "overcast" },
  overcast: { sun: 0xe6ecf2, fog: 0xcdd5da, mood: "overcast" },
  dusk: { sun: 0xff9a64, fog: 0xe2b8a4, mood: "day" },
};

const HERO_FRIENDS = ["Rogue", "Mage", "Barbarian", "Rogue_Hooded", "Ranger"];

/** The Hero Trail land a scene is set in. */
export function heroLand(scene: number): Land {
  const s = heroSceneAt(scene);
  const ground = SEASON_GROUND[s.season];
  const light = HERO_LIGHT[s.weather];
  return {
    name: `${cap(s.season)} ${s.terrain}`,
    mood: light.mood,
    tex: "leafy_grass",
    grass: ground.grass,
    grassVar: ground.grassVar,
    dirt: ground.dirt,
    sun: light.sun,
    fog: s.season === "winter" ? 0xdbe6ee : light.fog,
    path: "stones",
    trees: "HeroTreesV2",
    friend: HERO_FRIENDS[scene % HERO_FRIENDS.length]!,
    foliageTint: SEASON_FOLIAGE[s.season],
    heroScene: s,
  };
}

// ── Dino Run ──────────────────────────────────────────────────────────────

/** The ground of each palette, from the dino scene mock's GROUND and SPECIAL. */
const DINO_GROUND: Record<
  string,
  { grass: number; grassVar: number; dirt: number; leaf?: number }
> = {
  lush: { grass: 0x74b84e, grassVar: 0x8ecb64, dirt: 0x9a7b4f },
  savanna: {
    grass: 0xb39a45,
    grassVar: 0xc8b05a,
    dirt: 0xb98a52,
    leaf: 0xc2b24e,
  },
  ochre: {
    grass: 0xb07a35,
    grassVar: 0xc48f48,
    dirt: 0xa06a30,
    leaf: 0xb89038,
  },
  moss: { grass: 0x2f6a3a, grassVar: 0x44824c, dirt: 0x5a4a30, leaf: 0x3f8f6a },
  lilac: {
    grass: 0x6a5a78,
    grassVar: 0x84749a,
    dirt: 0x5a4a60,
    leaf: 0x8a78a8,
  },
  ash: { grass: 0x4a4642, grassVar: 0x5c5650, dirt: 0x2c2724, leaf: 0x6a5238 },
  mud_olive: {
    grass: 0x5a5020,
    grassVar: 0x6e6430,
    dirt: 0x3a3018,
    leaf: 0x7a8a34,
  },
  mud_peat: {
    grass: 0x4a4038,
    grassVar: 0x5c5046,
    dirt: 0x2a2226,
    leaf: 0x6a7a34,
  },
  rock_red: {
    grass: 0xa04a26,
    grassVar: 0xc8703a,
    dirt: 0x8a3b1c,
    leaf: 0xbfae38,
  },
  rock_buff: {
    grass: 0xb8a070,
    grassVar: 0xd8c490,
    dirt: 0xa89060,
    leaf: 0xbfae38,
  },
  rock_violet: {
    grass: 0x6e5a70,
    grassVar: 0x8a7488,
    dirt: 0x5a4a5e,
    leaf: 0xa89a78,
  },
  sand_gold: {
    grass: 0xe2c98a,
    grassVar: 0xeed8a0,
    dirt: 0xd6bc7c,
    leaf: 0x9ad06a,
  },
  sand_white: {
    grass: 0xefe8d4,
    grassVar: 0xf6f0e0,
    dirt: 0xe2d8c0,
    leaf: 0x9ad06a,
  },
};

const DINO_LIGHT: Record<
  DinoWeather,
  {
    sun: number;
    fog: number;
    mood: "day" | "overcast";
    cover: number;
    skyTop: number;
    skyBottom: number;
    fogRange: readonly [number, number];
  }
> = {
  noon: {
    sun: 0xfff4dc,
    fog: 0xcfe6c8,
    mood: "day",
    cover: 0.3,
    skyTop: 0x7ab4dc,
    skyBottom: 0xc4dcd8,
    fogRange: [50, 96],
  },
  golden: {
    sun: 0xffc080,
    fog: 0xf0d2a4,
    mood: "day",
    cover: 0.3,
    skyTop: 0x9cb4c8,
    skyBottom: 0xf2d2a2,
    fogRange: [44, 96],
  },
  overcast: {
    sun: 0xe6ecf2,
    fog: 0xc4ccd0,
    mood: "overcast",
    cover: 0.9,
    skyTop: 0x9aa6ae,
    skyBottom: 0xc8d0d2,
    fogRange: [26, 80],
  },
  fog: {
    sun: 0xe8eef2,
    fog: 0xd2dcd8,
    mood: "overcast",
    cover: 0.85,
    skyTop: 0xb4c0c0,
    skyBottom: 0xd4dcd6,
    fogRange: [22, 84],
  },
  dusk: {
    sun: 0xff9a64,
    fog: 0xe0a890,
    mood: "day",
    cover: 0.45,
    skyTop: 0xb8785c,
    skyBottom: 0xf0b490,
    fogRange: [24, 80],
  },
  storm: {
    sun: 0xa8b4c4,
    fog: 0x6e7a82,
    mood: "overcast",
    cover: 1,
    skyTop: 0x4e5a64,
    skyBottom: 0x7e8a90,
    fogRange: [26, 88],
  },
  night: {
    sun: 0x7088c0,
    fog: 0x2a3a62,
    mood: "overcast",
    cover: 0.5,
    skyTop: 0x1a2448,
    skyBottom: 0x3a4a78,
    fogRange: [22, 80],
  },
};

/** Two colours mixed, `t` of the way from a to b. */
const blendHex = (a: number, b: number, t: number): number => {
  const ch = (shift: number) =>
    Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** The Dino Run land a scene is set in. */
export function dinoLand(scene: number): Land {
  const s = dinoSceneAt(scene);
  const ground = DINO_GROUND[s.palette] ?? DINO_GROUND.lush!;
  const light = DINO_LIGHT[s.weather];
  const beach = s.veg === "beach";
  return {
    name: `${cap(s.shape)} ${s.palette.replace("_", " ")}`,
    mood: light.mood,
    tex: "leafy_grass",
    grass: ground.grass,
    grassVar: ground.grassVar,
    dirt: ground.dirt,
    sun: light.sun,
    fog: light.fog,
    // Green palettes are green all over; the arid ones keep their dry earth.
    mix: ["lush", "moss", "lilac", "mud_olive", "mud_peat"].includes(s.palette)
      ? {
          field: "dino_fern",
          road: "dino_trail",
          litter: "dino_fern",
          dry: "dino_fern",
          bareHue: 0,
        }
      : {
          field: "dino_drygrass",
          road: "dino_trail",
          litter: "dino_drygrass",
          dry: "dino_soil",
          bareHue: 0.3,
        },
    cover: light.cover,
    mountains: {
      colorNear: blendHex(ground.grass, light.fog, 0.5),
      colorFar: blendHex(light.fog, light.skyBottom, 0.5),
    },
    skyTop: light.skyTop,
    skyBottom: light.skyBottom,
    fogRange: light.fogRange,
    path: beach ? "sand" : "stones",
    trees: beach ? "PalmTrees" : "dino/DinoPlants",
    friend: s.dinos[1] ?? "Triceratops",
    foliageTint:
      ground.leaf != null
        ? { leaf: ground.leaf, trunk: 0x6a4a30, strength: 0.7 }
        : undefined,
    dinoScene: s,
  };
}

/** What a scene is called, for the card that crosses into it. */
export const heroSceneName = (scene: number): string => {
  const s = heroSceneAt(scene);
  return `${cap(s.season)} ${s.terrain}`;
};
export const dinoSceneName = (scene: number): string => {
  const s = dinoSceneAt(scene);
  return `${cap(s.shape)}, ${s.weather}`;
};

// ── the forest and shrubs of a Hero Trail scene ────────────────────────────

type GroundCluster = NonNullable<WorldTheme["groundClusters"]>[number];

/** Oaks, birches and pines per window of the mock, for each tree mix. */
const TREE_COUNTS: Record<HeroTrees, readonly [number, number, number]> = {
  oak: [9, 2, 0],
  birch: [2, 16, 0],
  mixed: [5, 8, 3],
  pine: [0, 3, 30],
  sparse: [2, 2, 3],
};

/**
 * What a flowering shrub is tinted, by season: the bushes' own leaf green
 * multiplied toward blossom, berry, turned leaf or frost.
 */
const SHRUB_TINT: Record<HeroSeason, readonly [number, number, number]> = {
  spring: [2.8, 1.0, 1.7],
  summer: [2.6, 0.75, 0.95],
  autumn: [2.8, 1.25, 0.4],
  winter: [2.3, 2.7, 2.9],
};

/**
 * The planting of a scene as instanced clusters: the forest behind the road
 * (each tree kind from its own variants, in the numbers the mock drew), and
 * flowering shrubs along it. Tall things are on the far verge only.
 */
export function heroSceneClusters(s: HeroScene): GroundCluster[] {
  let [oak, birch, pine] = TREE_COUNTS[s.trees];
  if (s.season === "winter") {
    oak = Math.floor(oak / 2);
    birch = Math.floor(birch / 2);
    pine = Math.max(pine, 12);
  }
  const out: GroundCluster[] = [];
  const kind = (nodes: readonly string[], total: number, lo: number, hi: number) => {
    if (total <= 0) {
      return;
    }
    // Per variant, per stride point.
    const lambda = (total / nodes.length) * 0.2;
    for (const node of nodes) {
      out.push({
        file: "hero/HeroTreesV2",
        node,
        seasonal: true,
        min: Math.max(0, Math.floor(lambda)),
        max: Math.max(1, Math.ceil(lambda * 1.5)),
        spread: 11,
        near: 6,
        far: 26,
        stride: 14,
        verge: "far",
        roadRelative: true,
        lo,
        hi,
      });
    }
  };
  kind(["Oak_1", "Oak_2", "Oak_3"], oak, 0.85, 1.25);
  kind(["Birch_1", "Birch_2", "Birch_3"], birch, 0.9, 1.3);
  kind(["Pine_1", "Pine_2", "Pine_3"], pine, 0.85, 1.35);
  // FLOWERING SHRUBS behind the path, in the season's colours.
  for (const [node, stride] of [
    ["Bush_2_A", 9],
    ["Bush_1_A", 13],
  ] as const) {
    out.push({
      file: "hero/HeroBushes",
      node,
      tint: SHRUB_TINT[s.season],
      min: 0,
      max: 2,
      spread: 6,
      near: 2.6,
      far: 9,
      stride,
      verge: "far",
      roadRelative: true,
      lo: 1.0,
      hi: 1.6,
    });
  }
  return out;
}

// ── water ──────────────────────────────────────────────────────────────────

/** An ellipse of water: a lake, or one of a bog's pools. */
export type Pool = {
  readonly x: number;
  readonly z: number;
  readonly rx: number;
  readonly rz: number;
};
export type WaterPlan = {
  /** The water's colour, where the scene wants one other than river blue. */
  readonly color?: number;
  /** x of each stream running across the road (the road bridges it). */
  readonly streams: readonly number[];
  readonly lakes: readonly Pool[];
  readonly pools: readonly Pool[];
};

/**
 * Where a scene's water is, from its terrain: streams across a meadow, a
 * lake behind a lakeside road, pools in a bog. Fixed distances along the ten
 * lessons, so the same scene has water in the same places every time.
 */
export function heroWaterPlan(terrain: HeroTerrain, trailEnd: number): WaterPlan {
  const streams: number[] = [];
  const lakes: Pool[] = [];
  const pools: Pool[] = [];
  if (terrain === "meadow") {
    for (let x = 95; x < trailEnd - 60; x += 165) {
      streams.push(x);
    }
  } else if (terrain === "lake") {
    for (let x = 120; x < trailEnd - 50; x += 220) {
      lakes.push({ x, z: -21, rx: 62, rz: 13 });
    }
  } else if (terrain === "boggy") {
    let k = 0;
    for (let x = 40; x < trailEnd - 30; x += 38) {
      const side = k % 2 === 0 ? -1 : 1;
      pools.push({
        x: x + (k % 3) * 6,
        z: side === -1 ? -7 - (k % 4) * 2.2 : 6.5 + (k % 3),
        rx: 7 + (k % 3) * 1.8,
        rz: 3.6 + (k % 2) * 1.2,
      });
      k++;
    }
  }
  return { streams, lakes, pools };
}

// ── Dino Run: the planting, water and set pieces of a scene ───────────────

/** What the dino mock's `VEG` says each vegetation mix keeps and adds. */
const DINO_VEG: Record<
  string,
  {
    keep: Readonly<Record<string, number>>;
    boost: readonly (readonly [string, number])[];
  }
> = {
  ferns: { keep: { redwood: 0.25 }, boost: [["tree fern", 30], ["ground fern", 40]] },
  redwood: { keep: { redwood: 1 }, boost: [["redwood", 8], ["ground fern", 22]] },
  cycad: { keep: { redwood: 0.3 }, boost: [["cycad", 34], ["broadleaf", 24]] },
  meadow: { keep: { redwood: 0.12, "tree fern": 0.5 }, boost: [["grass", 70]] },
  scrub: {
    keep: { cycad: 0.3, broadleaf: 0.12, "ground fern": 0.1, grass: 0.4 },
    boost: [],
  },
  bare: { keep: { cycad: 0.05, grass: 0.05 }, boost: [] },
  swamp: { keep: { grass: 0.3 }, boost: [["cycad", 26], ["broadleaf", 20]] },
  beach: { keep: { broadleaf: 0.3, grass: 0.3 }, boost: [] },
};
/** The base count of each plant in a window of the mock, before the mix. */
const DINO_BASE: Record<string, number> = {
  redwood: 10,
  "tree fern": 10,
  cycad: 8,
  broadleaf: 14,
  "ground fern": 22,
  grass: 40,
};
/** Which nodes of DinoPlants a plant is, how tall it is, and its size range. */
const DINO_PLANT: Record<
  string,
  { nodes: readonly string[]; tall: boolean; lo: number; hi: number }
> = {
  redwood: { nodes: ["Redwood_1", "Redwood_2", "Redwood_3"], tall: true, lo: 0.9, hi: 1.25 },
  "tree fern": { nodes: ["TreeFern_1", "TreeFern_2", "TreeFern_3"], tall: true, lo: 0.9, hi: 1.3 },
  cycad: { nodes: ["Cycad_1", "Cycad_2", "Cycad_3"], tall: true, lo: 0.9, hi: 1.5 },
  broadleaf: { nodes: ["LargeLeaf_1", "LargeLeaf_2", "LargeLeaf_3"], tall: false, lo: 0.6, hi: 1.1 },
  "ground fern": { nodes: ["GroundFern_1", "GroundFern_2", "GroundFern_3", "GroundFern_4"], tall: false, lo: 0.7, hi: 1.2 },
  grass: { nodes: ["Horsetail_1", "Horsetail_2"], tall: false, lo: 0.4, hi: 0.8 },
};

export function dinoSceneClusters(s: DinoScene): GroundCluster[] {
  const veg = DINO_VEG[s.veg];
  const totals = new Map<string, number>();
  if (veg != null) {
    for (const [type, keep] of Object.entries(veg.keep)) {
      totals.set(type, (DINO_BASE[type] ?? 0) * keep);
    }
    for (const [type, n] of veg.boost) {
      totals.set(type, (totals.get(type) ?? 0) + n);
    }
  }
  const out: GroundCluster[] = [];
  const STRIDE = 12;
  const WINDOW = 45;
  for (const [type, total] of totals) {
    const plant = DINO_PLANT[type];
    if (plant == null || total <= 0) {
      continue;
    }
    // Per variant, per stride point, per verge.
    const lambda =
      ((total * STRIDE) / WINDOW / plant.nodes.length) * (plant.tall ? 1 : 0.5);
    for (const node of plant.nodes) {
      out.push({
        file: "dino/DinoPlants",
        node,
        min: Math.max(0, Math.floor(lambda)),
        max: Math.max(1, Math.ceil(lambda * 1.5)),
        spread: 9,
        near: plant.tall ? 6 : 2,
        far: plant.tall ? 30 : 16,
        stride: STRIDE,
        verge: "far",
        roadRelative: true,
        lo: plant.lo,
        hi: plant.hi,
      });
    }
  }
  // In front of the path only low cover: the runner is there, and growth
  // above its knees hides it.
  out.push({
    file: "dino/DinoPlants",
    node: "Horsetail_1",
    min: 2,
    max: 4,
    spread: 5,
    near: 1.5,
    far: 8,
    stride: 6,
    verge: "near",
    roadRelative: true,
    lo: 0.2,
    hi: 0.35,
  });
  return out;
}

/** Water in a dino scene: a river behind the road, a lake, or the sea. */
export function dinoWaterPlan(s: DinoScene, trailEnd: number): WaterPlan | null {
  const lakes: Pool[] = [];
  if (s.shape === "coast") {
    lakes.push({ x: trailEnd / 2, z: -34, rx: trailEnd, rz: 22 });
  } else {
    if (s.river === true || s.landmarks.includes("river")) {
      lakes.push({ x: trailEnd / 2, z: -13, rx: trailEnd * 0.6, rz: 4.6 });
    }
    if (s.landmarks.includes("lake")) {
      lakes.push({ x: 220, z: -22, rx: 60, rz: 14 });
    }
  }
  return lakes.length > 0
    ? { streams: [], lakes, pools: [], color: s.shape === "coast" ? 0x2fb8c8 : 0x3f9ed8 }
    : null;
}

/**
 * Which rocks (DinoSets) and landmarks (DinoLandmarks) a scene sets out, from
 * what its record names. `landmarks` is null when nothing there suits.
 */
export function dinoSceneSets(s: DinoScene): {
  sets: RegExp;
  landmarks: RegExp;
} {
  const sets = ["Boulder_", "Slab_"];
  const has = (name: string) => s.landmarks.includes(name);
  if (has("arches")) sets.push("Arch_");
  if (has("bones")) sets.push("Bones_", "Fossil_");
  if (has("nest")) sets.push("EggNest_");
  if (has("tar")) sets.push("TarPit_");
  if (has("edge")) sets.push("Crag_");
  if (s.shape === "canyon" || s.shape === "ash") sets.push("Spire_", "Stack_");
  const marks: string[] = [];
  if (has("geyser")) marks.push("Geyser_");
  if (s.shape === "coast") marks.push("Driftwood_");
  if (s.veg === "swamp") marks.push("Snag_");
  return {
    sets: new RegExp(`^(${sets.join("|")})`),
    // Matches nothing when the scene names no landmark.
    landmarks: new RegExp(marks.length > 0 ? `^(${marks.join("|")})` : "^$^"),
  };
}
