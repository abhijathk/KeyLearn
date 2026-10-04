// Measured from decoded GLB positions, including node transforms.
// Ratios to model height; foliage canopy overhang is handled separately.
export const CHAPTER3_DIMENSIONS: Readonly<
  Record<string, { w: number; d: number }>
> = {
  "village-util/Laterite_Wall": {
    w: 2.6058506106219825,
    d: 0.3743254757171258,
  },
  "village-plants/Mango_Tree": {
    w: 0.8232421875,
    d: 0.9197126116071429,
  },
  "village-util/Estate_Gate": {
    w: 1.938106702337165,
    d: 0.4028916368006592,
  },
  "village-util/Village_Well": {
    w: 1.3864979224640719,
    d: 1.274654061678039,
  },
  "village-plants/Banana_Plant": {
    w: 0.9117877378045972,
    d: 0.9882997834999309,
  },
  "village-plants/Taro_Chembu": {
    w: 1.3416748046875,
    d: 1.29345703125,
  },
  "village-plants/Tapioca_Cassava": {
    w: 0.7834821428571429,
    d: 0.8095703125,
  },
  "village-plants/Hibiscus_Chemparathi": {
    w: 1.0474322085622112,
    d: 0.9862237335425931,
  },
  "village-plants/Jackfruit_Tree": {
    w: 0.7922148379221484,
    d: 0.8388715583887156,
  },
  "village-plants/Banyan_Almaram": {
    w: 1.4691297743055556,
    d: 1.4478081597222223,
  },
  "village-plants/Palmyra_Karimpana": {
    w: 0.4960652318194747,
    d: 0.5122783729970608,
  },
  "village-stone/Granite_Boulder": {
    w: 1.161926091825308,
    d: 0.9776035834266518,
  },
  "village-houses/01_large_nalukettu": {
    w: 2.3192,
    d: 1.7417,
  },
  "village-houses/02_long_veranda_house": {
    w: 2.6963,
    d: 1.5410,
  },
  "village-houses/03_two_storey_house": {
    w: 1.5806,
    d: 1.1010,
  },
  "village-houses/04_compact_tiled_house": {
    w: 1.7804,
    d: 1.6557,
  },
  "village-houses/05_wooden_laterite_house": {
    w: 1.8404,
    d: 1.6573,
  },
  "village-houses/06_simple_thatched_house": {
    w: 1.9783,
    d: 1.7177,
  },
  "village-houses/07_fisherman_coastal_house": {
    w: 2.3134,
    d: 1.5844,
  },
  "village-houses/08_workers_house_modest": {
    w: 1.6808,
    d: 1.4575,
  },
  "village-houses/09_storeroom_outbuilding": {
    w: 1.4652,
    d: 1.4061,
  },
  "village-houses/10_granary_vayalpura": {
    w: 1.4007,
    d: 1.3615,
  },
  "village-houses/11_ezhara_veedu_elite": {
    w: 1.7760,
    d: 1.5762,
  },
  "village-houses/12_courtyard_nadumuttam_house": {
    w: 2.6415,
    d: 2.4172,
  },
  "village-houses/13_hill_slope_house": {
    w: 1.8001,
    d: 1.6528,
  },
  "village-houses/14_farmers_house_rustic": {
    w: 2.4571,
    d: 1.4213,
  },
  "nature/KeralaBambooGroves": {
    w: 0.9,
    d: 0.6,
  },
  "village-plants/Coconut_Palm": {
    w: 0.45,
    d: 0.45,
  },
  // Varikkassery Mana (3 Oct 2026): 33.2 x 13.4 x 34.5 m, front toward -Z.
  "village-houses/Mana": {
    w: 2.474,
    d: 2.574,
  },
  "village-plants/Arecanut_Palm": {
    w: 0.3,
    d: 0.3,
  },
  "village-plants/Papaya_Tree": {
    w: 0.45,
    d: 0.45,
  },
  // Per unit of `h`, which for the pond is units per metre.
  "village-util/Kulappura_Pond": {
    w: 15.2,
    d: 9.6,
  },
  "village-plants/Kerala_Fern": {
    w: 0.9,
    d: 0.9,
  },
  "village-plants/Kerala_Grass_Tuft": {
    w: 0.7,
    d: 0.7,
  },
  "village-stone/River_Stone": {
    w: 1.1,
    d: 0.8,
  },
  "village-stone/Mossy_Stone": {
    w: 1.3,
    d: 1,
  },
  "village-stone/Stepping_Stone": {
    w: 4.195217287150835,
    d: 3.079550966699213,
  },
  "village-util/Nilavilakku": {
    w: 0.6218439978086168,
    d: 0.5572565087486627,
  },
  "village-util/Kerala_Market_Row": {
    w: 3.61,
    d: 0.814,
  },
  "village-util/Village_Market": {
    w: 4.271409363094241,
    d: 1.0214239972468186,
  },
  "village-util/Village_Cart": {
    w: 1.5043567881570317,
    d: 2.691183359880071,
  },
  "village-util/Produce_Pile": {
    w: 1.835723284502367,
    d: 1.7141797558595009,
  },
  // The Kerala small temple: 6.37 x 6.38 x 5.61 m.
  "ak-3d-pack/Temple": {
    w: 1.0,
    d: 0.88,
  },
  "village-plants/Peepal_Arayal": {
    w: 0.8366678575681791,
    d: 0.8075503155889008,
  },
  "ak-3d-pack/Market": {
    w: 4.343450473389612,
    d: 1.028185857593632,
  },
  "village-util/Bamboo_Fence": {
    w: 1.7515793565944213,
    d: 0.10788220429584994,
  },
};
