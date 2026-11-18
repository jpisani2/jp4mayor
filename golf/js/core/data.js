// Static game data: surfaces, climates, object catalog, clubs.

export const S = {
  OOB: 0, ROUGH: 1, FAIRWAY: 2, GREEN: 3, FRINGE: 4, TEE: 5, BUNKER: 6, WATER: 7,
  DEEP: 8, PATH: 9, NATIVE: 10, FIRSTCUT: 11, MULCH: 12,
};

// rest: normal restitution, fric: tangential loss on bounce, roll: rolling decel (m/s^2)
// grab: how much backspin bites, power/acc: lie multipliers for the next shot
export const SURF = {
  [S.OOB]: { name: 'Out of Bounds', rest: 0.2, fric: 0.5, roll: 3.6, grab: 0.03, power: 0.85, acc: 1.3, spin: 0.6 },
  [S.ROUGH]: { name: 'Rough', rest: 0.22, fric: 0.5, roll: 3.6, grab: 0.04, power: 0.87, acc: 1.25, spin: 0.6 },
  [S.FAIRWAY]: { name: 'Fairway', rest: 0.32, fric: 0.32, roll: 2.6, grab: 0.13, power: 1, acc: 1, spin: 1 },
  [S.FIRSTCUT]: { name: 'First Cut', rest: 0.3, fric: 0.36, roll: 2.4, grab: 0.09, power: 0.95, acc: 1.08, spin: 0.85 },
  [S.GREEN]: { name: 'Green', rest: 0.24, fric: 0.46, roll: 0.55, grab: 0.25, power: 1, acc: 1, spin: 1 },
  [S.FRINGE]: { name: 'Fringe', rest: 0.28, fric: 0.42, roll: 1.1, grab: 0.2, power: 1, acc: 1, spin: 1 },
  [S.TEE]: { name: 'Tee Box', rest: 0.34, fric: 0.3, roll: 1.9, grab: 0.13, power: 1, acc: 1, spin: 1 },
  [S.BUNKER]: { name: 'Bunker', rest: 0.04, fric: 0.85, roll: 10, grab: 0.02, power: 0.74, acc: 1.45, spin: 0.35 },
  [S.WATER]: { name: 'Water', rest: 0, fric: 1, roll: 50, grab: 0, power: 0, acc: 2, spin: 0 },
  [S.DEEP]: { name: 'Deep Rough', rest: 0.12, fric: 0.7, roll: 6.5, grab: 0.01, power: 0.68, acc: 1.6, spin: 0.35 },
  [S.PATH]: { name: 'Cart Path', rest: 0.58, fric: 0.12, roll: 0.5, grab: 0.05, power: 0.95, acc: 1.1, spin: 0.8 },
  [S.NATIVE]: { name: 'Native Area', rest: 0.16, fric: 0.62, roll: 5.2, grab: 0.02, power: 0.76, acc: 1.4, spin: 0.4 },
  [S.MULCH]: { name: 'Flower Bed', rest: 0.1, fric: 0.8, roll: 8, grab: 0.01, power: 0.7, acc: 1.45, spin: 0.3 },
};

// Editor shape types --------------------------------------------------------------------
// kind: 'area' closed spline, 'line' open spline w/ width
export const SHAPES = {
  fairway: { label: 'Fairway', kind: 'area', surf: S.FAIRWAY, size: [16, 45], icon: 'fairway',
    props: { mow: 'stripes', stripe: 9, firstCut: 1.6, tone: 0 } },
  green: { label: 'Green', kind: 'area', surf: S.GREEN, size: [13, 15], icon: 'green',
    props: { slope: 1.5, slopeDir: 180, undulation: 0.35, tiers: 0, tierH: 0.6, elevation: 0.4, stimp: 10.5, firmness: 1, fringe: 1.3 } },
  tee: { label: 'Tee Box', kind: 'area', surf: S.TEE, size: [6, 9], icon: 'tee', rect: true,
    props: { set: 'blue', raise: 0.5 } },
  bunker: { label: 'Greenside Bunker', kind: 'area', surf: S.BUNKER, size: [8, 4.5], icon: 'bunker',
    props: { depth: 0.8, lip: 1.2, sand: 'white', rake: true } },
  fbunker: { label: 'Fairway Bunker', kind: 'area', surf: S.BUNKER, size: [14, 6], icon: 'fbunker',
    props: { depth: 0.45, lip: 2.2, sand: 'white', rake: true } },
  pot: { label: 'Pot Bunker', kind: 'area', surf: S.BUNKER, size: [2.6, 2.6], icon: 'pot',
    props: { depth: 1.5, lip: 0.6, sand: 'tan', rake: false } },
  waste: { label: 'Waste Area', kind: 'area', surf: S.NATIVE, size: [20, 12], icon: 'waste',
    props: { tone: 0, scrub: 0.5 } },
  water: { label: 'Pond / Lake', kind: 'area', surf: S.WATER, size: [22, 16], icon: 'water',
    props: { depth: 1.6, color: 'blue', shore: 'grass', fountain: false, lilies: false, reeds: true } },
  rough: { label: 'Rough', kind: 'area', surf: S.ROUGH, size: [30, 60], icon: 'rough',
    props: { tufts: 0.5, tone: 0 } },
  deep: { label: 'Deep Rough / Fescue', kind: 'area', surf: S.DEEP, size: [20, 30], icon: 'deep',
    props: { tufts: 1, tone: 0 } },
  native: { label: 'Native Area', kind: 'area', surf: S.NATIVE, size: [25, 25], icon: 'native',
    props: { tone: 0, scrub: 0.7 } },
  mulch: { label: 'Flower Bed', kind: 'area', surf: S.MULCH, size: [6, 3], icon: 'mulch',
    props: { flowers: 'mixed' } },
  oob: { label: 'Out of Bounds', kind: 'area', surf: null, size: [25, 40], icon: 'oob', props: {} },
  path: { label: 'Cart Path', kind: 'line', surf: S.PATH, icon: 'path', props: { width: 2.6, material: 'concrete' } },
  creek: { label: 'Creek', kind: 'line', surf: S.WATER, icon: 'creek', props: { width: 4, depth: 1.0, rocks: true } },
  trail: { label: 'Walking Trail', kind: 'line', surf: S.NATIVE, icon: 'trail', props: { width: 1.4, material: 'dirt' } },
};

// Draw order (low -> high) for surface rasterization & painting
export const SHAPE_ORDER = ['rough', 'native', 'waste', 'deep', 'mulch', 'trail', 'fairway', 'tee', 'green', 'fbunker', 'bunker', 'pot', 'water', 'path', 'creek', 'oob'];

export const TEE_SETS = {
  black: { label: 'Championship', color: '#1c1c1c' },
  blue: { label: 'Blue', color: '#2a62d8' },
  white: { label: 'White', color: '#f3f3f3' },
  gold: { label: 'Gold', color: '#e0b030' },
  red: { label: 'Red', color: '#d23a2e' },
};

export const SAND_COLORS = {
  white: { label: 'Bright White', c: '#efe6cc' },
  tan: { label: 'Tan', c: '#dcc690' },
  red: { label: 'Red Desert', c: '#d39a6a' },
  black: { label: 'Volcanic', c: '#4a4646' },
  shell: { label: 'Crushed Shell', c: '#ece8de' },
};
export const WATER_COLORS = {
  blue: { label: 'Deep Blue', shallow: '#3b8fa8', deep: '#0f3d5c' },
  teal: { label: 'Tropical Teal', shallow: '#3fc4c0', deep: '#0b6a78' },
  green: { label: 'Pond Green', shallow: '#5a8a5a', deep: '#1d3e2c' },
  murky: { label: 'Murky', shallow: '#7a7a52', deep: '#2f3322' },
};
export const PATH_MATERIALS = {
  concrete: { label: 'Concrete', c: '#cfcbc2', edge: '#a9a397' },
  asphalt: { label: 'Asphalt', c: '#4c4d50', edge: '#36373a' },
  gravel: { label: 'Gravel', c: '#b8ad98', edge: '#8f846e' },
  shell: { label: 'Crushed Shell', c: '#eae4d4', edge: '#c8c0ab' },
  dirt: { label: 'Dirt', c: '#9b7a55', edge: '#7a5d3e' },
  pavers: { label: 'Brick Pavers', c: '#a65e46', edge: '#7c4232' },
};

// Climates -----------------------------------------------------------------------------
export const CLIMATES = {
  parkland: {
    name: 'Parkland', blurb: 'Lush rolling turf framed by oaks, maples and pines.',
    c: { fairway: '#5ea13a', fairway2: '#6db447', first: '#5a9838', rough: '#4a8530', deep: '#3d6f28', green: '#69bd45', green2: '#73c74f',
      fringe: '#5fae3e', tee: '#64b042', native: '#7b5a3a', nativeSpeck: '#a07a50', soil: '#6a5236', mulch: '#4a3324', tuft: '#4d8a32' },
    sky: { top: '#2f6fcf', horizon: '#cfe5f5', ground: '#5c7a3e' }, clouds: 0.45,
    trees: ['oak', 'maple', 'pine', 'birch', 'bush'], surround: ['oak', 'maple', 'pine', 'oak', 'birch'], surroundDensity: 1,
    backdrop: 'hills', ambience: 'birds', ground: 'rough', water: 'blue', sand: 'white', windBias: 1,
  },
  alpine: {
    name: 'Alpine', blurb: 'Mountain golf among towering spruce and granite.',
    c: { fairway: '#4f9a3c', fairway2: '#5cab47', first: '#4b9038', rough: '#43792f', deep: '#3a6a2c', green: '#5fb648', green2: '#6ac253',
      fringe: '#56a540', tee: '#58a843', native: '#5e4a35', nativeSpeck: '#8a6c4c', soil: '#5a4a38', mulch: '#3b2c20', tuft: '#3f7a30' },
    sky: { top: '#2563c9', horizon: '#d8e9f6', ground: '#4f6a3a' }, clouds: 0.35,
    trees: ['spruce', 'fir', 'aspen', 'boulder', 'bush'], surround: ['spruce', 'fir', 'spruce', 'aspen'], surroundDensity: 1.5,
    backdrop: 'mountains', ambience: 'mountain', ground: 'rough', water: 'blue', sand: 'tan', windBias: 1,
  },
  desert: {
    name: 'Desert', blurb: 'Emerald ribbons through saguaros, sand and stone.',
    c: { fairway: '#63a83c', fairway2: '#72b84a', first: '#5f9e3b', rough: '#6f9640', deep: '#8f8a4e', green: '#6cc049', green2: '#78ca55',
      fringe: '#62ad41', tee: '#66b044', native: '#d2b383', nativeSpeck: '#b48f60', soil: '#b98f62', mulch: '#7a5236', tuft: '#a09356' },
    sky: { top: '#3d7fd6', horizon: '#f2e0c6', ground: '#c9a678' }, clouds: 0.12,
    trees: ['saguaro', 'paloverde', 'pricklypear', 'barrel', 'ocotillo', 'desertrock'], surround: ['saguaro', 'creosote', 'paloverde', 'creosote', 'pricklypear', 'desertrock', 'ocotillo'], surroundDensity: 0.7,
    backdrop: 'mesas', ambience: 'desert', ground: 'native', water: 'teal', sand: 'white', windBias: 1.1,
  },
  tropical: {
    name: 'Tropical', blurb: 'Palms, ocean breezes and turquoise lagoons.',
    c: { fairway: '#57a83c', fairway2: '#66b848', first: '#53a038', rough: '#3f8a2e', deep: '#2f7428', green: '#62c04a', green2: '#6dca55',
      fringe: '#58b040', tee: '#5cb244', native: '#e2d1a6', nativeSpeck: '#c9b383', soil: '#7a5a3a', mulch: '#3c2a1c', tuft: '#3d8a2e' },
    sky: { top: '#1f74d6', horizon: '#c6ecf7', ground: '#4d8a3e' }, clouds: 0.4,
    trees: ['palm', 'fanpalm', 'hibiscus', 'fern', 'bush'], surround: ['palm', 'palm', 'fanpalm', 'hibiscus', 'fern', 'bush'], surroundDensity: 1.1,
    backdrop: 'volcano', ambience: 'tropical', ground: 'rough', water: 'teal', sand: 'white', windBias: 1.15,
  },
  links: {
    name: 'Coastal Links', blurb: 'Firm fescue, pot bunkers and the wild sea wind.',
    c: { fairway: '#7fa64a', fairway2: '#8bb257', first: '#799e46', rough: '#6f9442', deep: '#b6a564', green: '#78b84f', green2: '#83c259',
      fringe: '#76ac4b', tee: '#7dac4c', native: '#c9b88a', nativeSpeck: '#a8946a', soil: '#7a6a4a', mulch: '#4a3a28', tuft: '#b8a468' },
    sky: { top: '#5b86b8', horizon: '#dfe7ea', ground: '#7d9450' }, clouds: 0.75,
    trees: ['gorse', 'heather', 'fescue', 'monterey', 'wall'], surround: ['gorse', 'fescue', 'heather', 'fescue', 'gorse'], surroundDensity: 0.9,
    backdrop: 'ocean', ambience: 'links', ground: 'rough', water: 'blue', sand: 'tan', windBias: 1.3,
  },
  autumn: {
    name: 'Autumn Woods', blurb: 'Crisp fall color across New England hardwoods.',
    c: { fairway: '#629c3e', fairway2: '#70aa4a', first: '#5d943b', rough: '#5a7f34', deep: '#6d7234', green: '#6ab44a', green2: '#74bf53',
      fringe: '#60a643', tee: '#64a845', native: '#8a5a30', nativeSpeck: '#c2702e', soil: '#6a4a30', mulch: '#4a2f1e', tuft: '#7f7f3a' },
    sky: { top: '#3a72c4', horizon: '#e9e2d2', ground: '#7a6a3a' }, clouds: 0.4,
    trees: ['maple', 'oak', 'birch', 'pine', 'bush'], surround: ['maple', 'oak', 'maple', 'birch', 'pine'], surroundDensity: 1.2,
    backdrop: 'hills', ambience: 'autumn', ground: 'rough', water: 'blue', sand: 'white', windBias: 1, fall: true,
  },
};

export const TIMES = {
  morning: { label: 'Early Morning', elev: 14, az: 105, sun: '#ffe2b8', int: 2.4, hemi: 0.75, tint: '#ffd9a8', haze: 1.2 },
  midday: { label: 'Midday', elev: 58, az: 165, sun: '#fff6e8', int: 3.0, hemi: 0.95, tint: '#ffffff', haze: 1 },
  afternoon: { label: 'Afternoon', elev: 34, az: 230, sun: '#fff0d6', int: 2.8, hemi: 0.85, tint: '#fff2de', haze: 1 },
  sunset: { label: 'Golden Hour', elev: 7, az: 265, sun: '#ffb070', int: 2.3, hemi: 0.6, tint: '#ffb27a', haze: 1.4 },
};

export const WIND_MODES = {
  calm: { label: 'Calm', min: 0, max: 1 },
  light: { label: 'Light', min: 1, max: 3.5 },
  breezy: { label: 'Breezy', min: 3.5, max: 6.5 },
  windy: { label: 'Windy', min: 6.5, max: 10 },
  gale: { label: 'Gale', min: 10, max: 14 },
  random: { label: 'Random', min: 0, max: 9 },
};

// Object catalog ------------------------------------------------------------------------
// col: collision description at scale 1. trunk: [radius, height]; canopy: [centerY, radius, halfHeight, density]
// solid: [radius, height] cylinder that bounces hard. box: [hx, hz(height), hy]
export const OBJ = {
  oak: { label: 'Oak', cat: 'tree', climates: ['parkland', 'autumn'], col: { trunk: [0.4, 3.2], canopy: [7, 5, 3.4, 5] } },
  maple: { label: 'Maple', cat: 'tree', climates: ['parkland', 'autumn'], col: { trunk: [0.32, 3], canopy: [7, 4, 3.6, 5] } },
  birch: { label: 'Birch', cat: 'tree', climates: ['parkland', 'autumn', 'alpine'], col: { trunk: [0.18, 4], canopy: [8, 2.6, 3.4, 3.5] } },
  pine: { label: 'Tall Pine', cat: 'tree', climates: ['parkland', 'autumn', 'alpine'], col: { trunk: [0.3, 8], canopy: [12, 3.6, 2.8, 4] } },
  willow: { label: 'Willow', cat: 'tree', climates: ['parkland', 'autumn'], col: { trunk: [0.45, 2.5], canopy: [5.5, 5.5, 3.5, 6] } },
  cypress: { label: 'Cypress', cat: 'tree', climates: ['parkland', 'tropical', 'desert'], col: { trunk: [0.25, 1], canopy: [6, 1.6, 5.5, 5] } },
  spruce: { label: 'Spruce', cat: 'tree', climates: ['alpine', 'parkland', 'autumn'], col: { trunk: [0.35, 1.5], canopy: [7, 3.3, 6, 6] } },
  fir: { label: 'Fir', cat: 'tree', climates: ['alpine', 'autumn'], col: { trunk: [0.3, 1.2], canopy: [7.5, 2.6, 6.5, 6] } },
  aspen: { label: 'Aspen', cat: 'tree', climates: ['alpine', 'autumn'], col: { trunk: [0.16, 3.5], canopy: [7.5, 2.2, 3.8, 3.5] } },
  monterey: { label: 'Windswept Cypress', cat: 'tree', climates: ['links', 'tropical'], col: { trunk: [0.45, 3], canopy: [5.5, 5.5, 1.8, 5] } },
  palm: { label: 'Coconut Palm', cat: 'tree', climates: ['tropical', 'desert'], col: { trunk: [0.22, 9], canopy: [10, 3.5, 1.2, 2.5] } },
  fanpalm: { label: 'Fan Palm', cat: 'tree', climates: ['desert', 'tropical'], col: { trunk: [0.35, 11], canopy: [12, 2, 1.6, 4] } },
  saguaro: { label: 'Saguaro', cat: 'tree', climates: ['desert'], col: { solid: [0.4, 7] } },
  joshua: { label: 'Joshua Tree', cat: 'tree', climates: ['desert'], col: { trunk: [0.3, 2.5], canopy: [4.5, 2.6, 1.8, 3] } },
  paloverde: { label: 'Palo Verde', cat: 'tree', climates: ['desert'], col: { trunk: [0.22, 1.6], canopy: [3.6, 3.6, 1.6, 2.5] } },
  bush: { label: 'Shrub', cat: 'shrub', climates: ['parkland', 'autumn', 'tropical', 'alpine'], col: { canopy: [0.9, 1.4, 0.9, 7] } },
  hibiscus: { label: 'Hibiscus', cat: 'shrub', climates: ['tropical'], col: { canopy: [1, 1.5, 1, 7] } },
  fern: { label: 'Fern', cat: 'shrub', climates: ['tropical', 'alpine'], col: { canopy: [0.5, 1.2, 0.5, 5] } },
  gorse: { label: 'Gorse', cat: 'shrub', climates: ['links'], col: { canopy: [0.8, 1.6, 0.8, 8] } },
  heather: { label: 'Heather', cat: 'shrub', climates: ['links', 'alpine'], col: { canopy: [0.3, 1.2, 0.3, 6] } },
  fescue: { label: 'Fescue Clump', cat: 'shrub', climates: ['links', 'desert', 'parkland'], col: { canopy: [0.4, 0.8, 0.5, 6] } },
  reeds: { label: 'Cattail Reeds', cat: 'shrub', climates: ['parkland', 'autumn', 'tropical', 'alpine', 'links'], col: { canopy: [0.8, 0.9, 0.8, 6] } },
  flowers: { label: 'Wildflowers', cat: 'shrub', climates: ['parkland', 'alpine', 'autumn', 'tropical'], col: {} },
  pricklypear: { label: 'Prickly Pear', cat: 'shrub', climates: ['desert'], col: { solid: [0.8, 1.2] } },
  barrel: { label: 'Barrel Cactus', cat: 'shrub', climates: ['desert'], col: { solid: [0.4, 0.7] } },
  ocotillo: { label: 'Ocotillo', cat: 'shrub', climates: ['desert'], col: { canopy: [2, 1.6, 2, 3] } },
  creosote: { label: 'Desert Scrub', cat: 'shrub', climates: ['desert'], col: { canopy: [0.6, 1.1, 0.6, 6] } },
  boulder: { label: 'Boulder', cat: 'rock', climates: ['alpine', 'parkland', 'autumn', 'links', 'tropical'], col: { solid: [1.1, 1.4] } },
  rocks: { label: 'Rock Pile', cat: 'rock', climates: ['alpine', 'parkland', 'autumn', 'links', 'desert'], col: { solid: [1.0, 0.6] } },
  desertrock: { label: 'Sandstone', cat: 'rock', climates: ['desert'], col: { solid: [1.4, 1.8] } },
  bench: { label: 'Bench', cat: 'amenity', climates: '*', col: { box: [0.9, 0.85, 0.3] } },
  washer: { label: 'Ball Washer', cat: 'amenity', climates: '*', col: { solid: [0.12, 1.0] } },
  bin: { label: 'Trash Can', cat: 'amenity', climates: '*', col: { solid: [0.3, 0.9] } },
  sign: { label: 'Hole Sign', cat: 'amenity', climates: '*', col: { box: [0.6, 1.4, 0.1] } },
  cart: { label: 'Golf Cart', cat: 'amenity', climates: '*', col: { box: [0.65, 1.8, 1.2] } },
  shelter: { label: 'Rain Shelter', cat: 'amenity', climates: '*', col: { box: [1.8, 3.2, 1.8] } },
  bridge: { label: 'Wood Bridge', cat: 'amenity', climates: '*', col: {} },
  fence: { label: 'Split-Rail Fence', cat: 'amenity', climates: '*', col: { box: [2, 1.1, 0.1] } },
  wall: { label: 'Stone Wall', cat: 'amenity', climates: '*', col: { box: [2, 1, 0.35] } },
  post: { label: 'Yardage Post', cat: 'amenity', climates: '*', col: {} },
};
export const OBJ_CATS = { tree: 'Trees', shrub: 'Shrubs & Plants', rock: 'Rocks', amenity: 'Course Furniture' };

// Clubs: carry in yards at full power for an average-strong amateur.
export const CLUBS = [
  { id: 'DR', name: 'Driver', carry: 250, launch: 11.5, spin: 2700, tee: true },
  { id: '3W', name: '3 Wood', carry: 228, launch: 12.5, spin: 3500 },
  { id: '5W', name: '5 Wood', carry: 212, launch: 14, spin: 4200 },
  { id: '4H', name: '4 Hybrid', carry: 198, launch: 15, spin: 4600 },
  { id: '5I', name: '5 Iron', carry: 182, launch: 16.5, spin: 5300 },
  { id: '6I', name: '6 Iron', carry: 170, launch: 18.5, spin: 6100 },
  { id: '7I', name: '7 Iron', carry: 158, launch: 21, spin: 6900 },
  { id: '8I', name: '8 Iron', carry: 146, launch: 24, spin: 7700 },
  { id: '9I', name: '9 Iron', carry: 134, launch: 27, spin: 8400 },
  { id: 'PW', name: 'Pitching Wedge', carry: 121, launch: 30, spin: 9000 },
  { id: 'GW', name: 'Gap Wedge', carry: 106, launch: 33, spin: 9400 },
  { id: 'SW', name: 'Sand Wedge', carry: 90, launch: 36, spin: 9800, sand: true },
  { id: 'LW', name: 'Lob Wedge', carry: 70, launch: 41, spin: 10200, sand: true },
  { id: 'PT', name: 'Putter', carry: 0, launch: 0, spin: 0, putter: true },
];

export const SHOT_TYPES = {
  normal: { label: 'Normal', launch: 0, spin: 1, power: 1, curve: 0 },
  draw: { label: 'Draw', launch: 0, spin: 1, power: 1.01, curve: -1 },
  fade: { label: 'Fade', launch: 0.5, spin: 1.05, power: 0.99, curve: 1 },
  high: { label: 'High', launch: 4, spin: 1.12, power: 0.97, curve: 0 },
  punch: { label: 'Punch', launch: -5, spin: 0.7, power: 0.9, curve: 0 },
  chip: { label: 'Chip & Run', launch: -12, spin: 0.45, power: 0.55, curve: 0, wedge: true },
  flop: { label: 'Flop', launch: 14, spin: 1.25, power: 0.6, curve: 0, wedge: true },
};

export const DIFFICULTY = {
  beginner: { label: 'Beginner', perfect: 0.16, tol: 1.5, meterSpeed: 0.75, preview: 1, puttLine: 1, windPreview: true },
  amateur: { label: 'Amateur', perfect: 0.1, tol: 1, meterSpeed: 1, preview: 1, puttLine: 0.35, windPreview: false },
  pro: { label: 'Pro', perfect: 0.06, tol: 0.7, meterSpeed: 1.3, preview: 0.5, puttLine: 0, windPreview: false },
};

export const SCORE_NAMES = {
  '-4': 'Condor', '-3': 'Albatross', '-2': 'Eagle', '-1': 'Birdie', '0': 'Par', '1': 'Bogey', '2': 'Double Bogey', '3': 'Triple Bogey',
};
export function scoreName(strokes, par) {
  if (strokes === 1) return 'Hole in One!';
  const d = strokes - par;
  return SCORE_NAMES[d] || (d > 0 ? `+${d}` : `${d}`);
}

export const NAME_WORDS = {
  parkland: { a: ['Whispering', 'Old', 'Royal', 'Hidden', 'Twin', 'Golden', 'Quiet', 'Grand', 'Mossy', 'Crooked'], b: ['Oaks', 'Meadow', 'Hollow', 'Elm', 'Brook', 'Bend', 'Glen', 'Ridge', 'Commons', 'Orchard'] },
  alpine: { a: ['Granite', 'Eagle', 'Timber', 'Summit', 'Glacier', 'High', 'Lone', 'Silver', 'Wolf', 'Cedar'], b: ['Peak', 'Pass', 'Spruce', 'Falls', 'Basin', 'Notch', 'Lookout', 'Crest', 'Pines', 'Canyon'] },
  desert: { a: ['Coyote', 'Sidewinder', 'Mesa', 'Red', 'Dry', 'Sunset', 'Rattler', 'Copper', 'Dune', 'Painted'], b: ['Wash', 'Run', 'Arroyo', 'Bluff', 'Gulch', 'Mirage', 'Rock', 'Trail', 'Spur', 'Canyon'] },
  tropical: { a: ['Coral', 'Lagoon', 'Palm', 'Trade Wind', 'Mango', 'Blue', 'Hibiscus', 'Sandy', 'Volcano', 'Pearl'], b: ['Cove', 'Reef', 'Point', 'Bay', 'Grove', 'Shore', 'Isle', 'Breeze', 'Key', 'Harbor'] },
  links: { a: ['Gorse', 'Sea', 'Old', 'Grey', 'Kings', 'Salt', 'Wild', 'Stone', 'North', 'Windy'], b: ['Links', 'Dunes', 'Barrow', 'Burn', 'Head', 'Strand', 'Wall', 'Firth', 'Machair', 'Point'] },
  autumn: { a: ['Amber', 'Maple', 'Harvest', 'Copper', 'Crimson', 'Hickory', 'Foxfire', 'October', 'Birch', 'Hollow'], b: ['Leaf', 'Hill', 'Vale', 'Woods', 'Run', 'Ridge', 'Grove', 'Bend', 'Farm', 'Creek'] },
};
