// config.js — every tunable number for Sky Courier: Valley Run in one place.
// Distances are metres, speeds are metres/second, angles are radians unless a
// name says otherwise. The HUD converts to feet and knots for display only.

export const WORLD = {
  size: 4200, // the valley is a square this many metres across, centred on 0,0
  groundY: 0,
  ceiling: 420, // soft ceiling: above this the air is too thin to climb
  treeLine: 26, // trees are obstacles up to roughly this height
};

export const RUNWAY = {
  // The home strip: a grass-and-gravel runway running north-south.
  x: -320, // centre line east offset
  zNear: 1560, // south end (where the sortie starts)
  zFar: 720, // north end
  width: 46,
  get length() {
    return this.zNear - this.zFar;
  },
};

export const PLANE = {
  startZ: 1500,
  startHeading: 0, // parked on the strip facing north; heading 0 is north (-z), growing clockwise
  minSpeed: 0,
  maxSpeed: 78,
  stallSpeed: 24, // below this the wing stops holding the nose up
  takeOffSpeed: 27,
  throttleRate: 0.55, // throttle units per second at full key press
  engineAccel: 13.5, // m/s^2 at full throttle
  dragBase: 0.55,
  dragQuad: 0.0038,
  pitchRate: 0.95, // rad/s of pitch at full stick
  rollRate: 2.4, // rad/s of roll at full stick
  maxPitch: 0.62,
  maxRoll: 1.05,
  turnFactor: 1.55, // how hard a bank bites into a turn
  gravitySink: 9.2, // m/s of sink the flight model adds when slow or steep
  fuelCapacity: 100,
  fuelBurn: 0.26, // fuel units per second at full throttle: a cruise sortie sips, a firewalled one still runs dry
  safeTouchdownSink: 3.4, // m/s: a landing gentler than this is a good one
  hardTouchdownSink: 6.5, // m/s: past this the gear folds and the sortie ends
  safeTouchdownSpeed: 46,
};

export const RINGS = {
  count: 8,
  radius: 17,
  scoreCentre: 300, // dead centre of a ring
  scoreEdge: 120, // clipping through counts, barely
};

export const DROP = {
  // The supply pad the village waits on, east of the river.
  x: 690,
  z: -420,
  padRadius: 26,
  scorePerfect: 500, // within the pad
  scoreNear: 260, // within 60 m
  scoreFar: 120, // within 120 m: the village still finds it
};

export const SCORING = {
  landingGood: 400,
  landingFirm: 180, // down in one piece, but the mechanic winces
  timeBonusPerSecond: 2, // for finishing with fuel-clock time to spare
  fuelBonusPerUnit: 6, // unburned fuel is money in the bank
  parSeconds: 300, // a tidy sortie takes about five minutes
};

export const CAMERA = {
  backDistance: 13.5, // metres behind the aircraft
  upDistance: 4.6, // metres above it
  lookAhead: 42, // the camera aims this far in front of the nose
  fovDeg: 74,
  smoothing: 5.2, // per-second lerp toward the ideal chase position
};

export const COLOURS = {
  skyTop: '#2e63a8',
  skyMid: '#7db3e8',
  skyLow: '#dceefb',
  sun: '#fff3c4',
  haze: 'rgba(220,238,251,0.55)',
  fields: ['#79a844', '#8fbc4f', '#c9b458', '#6d9c3f', '#a8bf57', '#d3c06a', '#7fae4c', '#98b95e'],
  fieldDark: '#5d8a36',
  river: '#3f7fbf',
  riverBank: '#cbb98a',
  road: '#8d8578',
  runway: '#9a958a',
  runwayEdge: '#f5f2e8',
  tree: '#2f6b2f',
  treeDark: '#265726',
  trunk: '#6b4a2b',
  houseWall: '#e8ddc8',
  houseRoof: '#a8503c',
  mountain: '#7d90a8',
  mountainFar: '#a9bccd',
  ringNext: '#ffc61a',
  ringOpen: '#39c2d7',
  ringDone: '#57d977',
  pad: '#e2483d',
  padRing: '#ffffff',
};
