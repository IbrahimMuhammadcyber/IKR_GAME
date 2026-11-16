// NIGERIA BIKE RACING 3D — game engine (Three.js).
// Road space: s = distance along the road (forward), x = lateral (right +). World z = -s.
import * as THREE from 'three';
import { audio } from './audio';
import {
  VEH, buildBike, buildProp, gantryGeo, lampGeo, railGeo, sidewalkGeo, tyreWallGeo, vehicleGeo, windowTextures,
  type BikeRig, type PropGeo,
} from './models';
import { CAREER, computeStats, objectiveText, type BikeDef, type BikeStats, type EnvId, type Settings } from './data';
import type { FinishReason, Hud, RaceConfig, RaceResult, Toast } from './types';

const SEG = 36;
const BIKE_W = 0.7;
const BIKE_L = 1.9;
const NEAR_GAP = 0.7;
const COIN_VALUE = 2;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export const QUALITY = {
  low: { dpr: 1, draw: 150, seg: 7, props: 0.45, traffic: 7, aniso: 1 },
  medium: { dpr: 1.5, draw: 200, seg: 8, props: 0.75, traffic: 10, aniso: 2 },
  high: { dpr: 2, draw: 280, seg: 10, props: 1, traffic: 14, aniso: 4 },
};

// ---------------------------------------------------------------------------
// Environment visuals
// ---------------------------------------------------------------------------
interface PropSpec { t: string; w: number; off: [number, number]; sc?: [number, number]; face?: 'z' | 'nx' | 'none' }
interface EnvVis {
  skyTop: number; skyBot: number; fog: number; fogNear: number;
  ground: string; groundAlt: string; road: string; shoulder: string;
  hemi: [number, number, number]; sun: [number, number]; sunColor: number; sunDir: [number, number, number];
  lanes: number; laneW: number; shoulderW: number; twoWay: boolean;
  lamps: boolean; rail: 'none' | 'guard' | 'tyre'; sidewalk: boolean; gantry: 'none' | 'sign' | 'banner'; kerbs: boolean;
  props: PropSpec[]; density: number; bend: number; hill: number; night: boolean;
  traffic: string[]; style: 'highway' | 'city' | 'desert' | 'village' | 'mountain' | 'circuit';
}

const ENV: Record<EnvId, EnvVis> = {
  highway: {
    skyTop: 0x2f86d8, skyBot: 0xc4e6ff, fog: 0xc4e6ff, fogNear: 0.25, ground: '#3f7d3a', groundAlt: '#4d8c44', road: '#3b3e44', shoulder: '#5a5d63',
    hemi: [0xe2f1ff, 0x4a6a3a, 1.0], sun: [0xfff1d0, 0.85], sunColor: 0xfff4c8, sunDir: [-0.5, 0.45, -1],
    lanes: 4, laneW: 3.4, shoulderW: 2.4, twoWay: false, lamps: true, rail: 'none', sidewalk: false, gantry: 'sign', kerbs: false,
    props: [
      { t: 'palm', w: 3, off: [2.5, 14], sc: [0.9, 1.25] }, { t: 'acacia', w: 2, off: [4, 18], sc: [0.9, 1.3] }, { t: 'bush', w: 3, off: [1.6, 8], sc: [0.8, 1.4] },
      { t: 'billboard', w: 0.7, off: [5, 9], face: 'z' }, { t: 'hill', w: 1.2, off: [50, 110], sc: [1.2, 2.2] },
    ],
    density: 3, bend: 0.00035, hill: 0.0001, night: false, traffic: ['car', 'car', 'car', 'van', 'van', 'bus', 'truck', 'bike', 'keke'], style: 'highway',
  },
  desert: {
    skyTop: 0xe8923a, skyBot: 0xf6dcae, fog: 0xf0d7a6, fogNear: 0.2, ground: '#d6b068', groundAlt: '#c79f57', road: '#4a4743', shoulder: '#8e7a58',
    hemi: [0xfff0d0, 0xb08a4a, 1.0], sun: [0xffe6b0, 1.0], sunColor: 0xffeaa8, sunDir: [0.6, 0.3, -1],
    lanes: 3, laneW: 3.6, shoulderW: 2.0, twoWay: false, lamps: false, rail: 'none', sidewalk: false, gantry: 'none', kerbs: false,
    props: [
      { t: 'acaciaDry', w: 2, off: [4, 24], sc: [0.9, 1.4] }, { t: 'shrub', w: 4, off: [2, 22], sc: [0.8, 1.5] }, { t: 'cactus', w: 1.4, off: [4, 20] },
      { t: 'rock', w: 2, off: [3, 30], sc: [0.8, 2] }, { t: 'dune', w: 1.6, off: [25, 80], sc: [1, 1.8] }, { t: 'mesa', w: 0.5, off: [90, 150], sc: [1.4, 2.4] },
      { t: 'pole', w: 1, off: [2.2, 3.2] },
    ],
    density: 3, bend: 0.0005, hill: 0.00012, night: false, traffic: ['truck', 'truck', 'bus', 'van', 'car', 'car', 'bike'], style: 'desert',
  },
  village: {
    skyTop: 0x4a9ae0, skyBot: 0xd6efff, fog: 0xcfe9f6, fogNear: 0.22, ground: '#4f8a3a', groundAlt: '#6a9a45', road: '#46433f', shoulder: '#8a7456',
    hemi: [0xeaf6ff, 0x5a7a3a, 1.0], sun: [0xfff2d0, 0.85], sunColor: 0xfff4c8, sunDir: [0.4, 0.5, -1],
    lanes: 2, laneW: 3.6, shoulderW: 2.2, twoWay: true, lamps: false, rail: 'none', sidewalk: false, gantry: 'none', kerbs: false,
    props: [
      { t: 'hut', w: 2.5, off: [4, 16], face: 'z' }, { t: 'house', w: 1.6, off: [5, 14], face: 'z' }, { t: 'shop', w: 0.7, off: [3, 6], face: 'z' },
      { t: 'baobab', w: 1.1, off: [5, 20], sc: [0.9, 1.3] }, { t: 'mango', w: 1.6, off: [3, 12], sc: [0.9, 1.3] }, { t: 'palm', w: 1.2, off: [3, 12] },
      { t: 'bush', w: 2, off: [1.6, 8] }, { t: 'pole', w: 1.2, off: [2.2, 3.0] }, { t: 'hill', w: 0.6, off: [60, 110], sc: [1.2, 2] },
    ],
    density: 4, bend: 0.0007, hill: 0.0002, night: false, traffic: ['keke', 'keke', 'bike', 'bike', 'van', 'truck', 'car'], style: 'village',
  },
  city: {
    skyTop: 0x050a1e, skyBot: 0x2a2f66, fog: 0x1a2048, fogNear: 0.2, ground: '#1c2030', groundAlt: '#242a3c', road: '#25282e', shoulder: '#30343c',
    hemi: [0x7f8fff, 0x1a1d33, 0.95], sun: [0x8da2ff, 0.5], sunColor: 0xdfe6ff, sunDir: [-0.6, 0.55, -1],
    lanes: 4, laneW: 3.4, shoulderW: 1.8, twoWay: false, lamps: true, rail: 'none', sidewalk: true, gantry: 'none', kerbs: false,
    props: [
      { t: 'bldgA', w: 2, off: [1.5, 8] }, { t: 'bldgB', w: 2, off: [1.5, 8] }, { t: 'bldgC', w: 1.5, off: [1.5, 8] }, { t: 'bldgD', w: 1.2, off: [2, 10] },
      { t: 'neon', w: 0.9, off: [1.2, 2.4], face: 'z' },
    ],
    density: 3, bend: 0.0002, hill: 0.0001, night: true, traffic: ['car', 'car', 'car', 'van', 'van', 'bus', 'keke', 'bike', 'bike'], style: 'city',
  },
  mountain: {
    skyTop: 0x6f98c8, skyBot: 0xdce6ee, fog: 0xcad8e4, fogNear: 0.2, ground: '#5f7a52', groundAlt: '#6e8a5a', road: '#35383d', shoulder: '#555a60',
    hemi: [0xe4f0ff, 0x4a5a40, 0.95], sun: [0xfff0d8, 0.8], sunColor: 0xfff2d0, sunDir: [0.5, 0.5, -1],
    lanes: 4, laneW: 3.2, shoulderW: 1.4, twoWay: true, lamps: false, rail: 'guard', sidewalk: false, gantry: 'none', kerbs: false,
    props: [
      { t: 'pine', w: 4, off: [2, 22], sc: [0.9, 1.5] }, { t: 'rock', w: 2, off: [2, 14], sc: [0.9, 1.8] }, { t: 'boulder', w: 0.8, off: [4, 18] },
      { t: 'bush', w: 1, off: [2, 10] }, { t: 'peak', w: 1.4, off: [55, 130], sc: [1.3, 2.4] },
    ],
    density: 4, bend: 0.0012, hill: 0.0005, night: false, traffic: ['car', 'car', 'truck', 'truck', 'bus', 'van', 'bike'], style: 'mountain',
  },
  circuit: {
    skyTop: 0x2a7fe0, skyBot: 0xffd9a0, fog: 0xf3d9b4, fogNear: 0.25, ground: '#2f6d2c', groundAlt: '#3a7d35', road: '#2f3237', shoulder: '#6a6e75',
    hemi: [0xfff1dc, 0x3a5a30, 1.0], sun: [0xffdca0, 0.95], sunColor: 0xffe2a0, sunDir: [0.7, 0.28, -1],
    lanes: 4, laneW: 3.6, shoulderW: 3.2, twoWay: false, lamps: false, rail: 'tyre', sidewalk: false, gantry: 'banner', kerbs: true,
    props: [
      { t: 'stand', w: 1.6, off: [8, 16], face: 'nx' }, { t: 'flagpole', w: 2, off: [3, 6] }, { t: 'bush', w: 1, off: [8, 24] },
      { t: 'billboard', w: 1, off: [5, 8], face: 'z' }, { t: 'hill', w: 0.7, off: [70, 120], sc: [1.2, 2] },
    ],
    density: 2, bend: 0.0014, hill: 0.0002, night: false, traffic: ['racer'], style: 'circuit',
  },
};

// ---------------------------------------------------------------------------
// Shared bend shader (curved-world effect). Logic stays in straight road space.
// ---------------------------------------------------------------------------
const bendU = { value: new THREE.Vector2(0, 0) };
function bendify<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uBend = bendU;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uBend;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        mvPosition.x += uBend.x * mvPosition.z * mvPosition.z;
        mvPosition.y += uBend.y * mvPosition.z * mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  m.customProgramCacheKey = () => 'nbr-bend';
  return m;
}

function makeRoadTexture(v: EnvVis, aniso: number): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  const W = v.lanes * v.laneW + v.shoulderW * 2;
  const ppm = S / W;
  const half = (v.lanes * v.laneW) / 2;
  const lx = (m: number) => (m + W / 2) * ppm;
  x.fillStyle = v.road;
  x.fillRect(0, 0, S, S);
  x.fillStyle = v.shoulder;
  x.fillRect(0, 0, v.shoulderW * ppm, S);
  x.fillRect(S - v.shoulderW * ppm, 0, v.shoulderW * ppm, S);
  for (let i = 0; i < 1800; i++) {
    x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)';
    x.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const solid = (xm: number, wm: number, col: string) => { x.fillStyle = col; x.fillRect(lx(xm) - (wm * ppm) / 2, 0, wm * ppm, S); };
  const dashed = (xm: number, wm: number, col: string) => {
    x.fillStyle = col;
    for (let k = 0; k < 4; k++) x.fillRect(lx(xm) - (wm * ppm) / 2, k * 128, wm * ppm, 43);
  };
  const white = '#f4f4f4';
  const yellow = '#f0c030';
  switch (v.style) {
    case 'highway':
    case 'city':
      solid(-half + 0.2, 0.18, yellow);
      solid(half - 0.2, 0.18, white);
      for (let i = 1; i < v.lanes; i++) dashed(-half + i * v.laneW, 0.15, white);
      break;
    case 'desert':
      x.globalAlpha = 0.65;
      solid(-half + 0.2, 0.18, yellow);
      solid(half - 0.2, 0.18, white);
      for (let i = 1; i < v.lanes; i++) dashed(-half + i * v.laneW, 0.15, white);
      x.globalAlpha = 1;
      for (let i = 0; i < 26; i++) {
        x.fillStyle = 'rgba(214,176,104,0.45)';
        x.beginPath();
        x.ellipse(Math.random() < 0.5 ? lx(-half) + Math.random() * 30 : lx(half) - Math.random() * 30, Math.random() * S, 20 + Math.random() * 30, 8 + Math.random() * 14, 0, 0, 7);
        x.fill();
      }
      break;
    case 'village':
      solid(-0.14, 0.1, yellow);
      solid(0.14, 0.1, yellow);
      x.globalAlpha = 0.55;
      dashed(-half + 0.3, 0.12, white);
      dashed(half - 0.3, 0.12, white);
      x.globalAlpha = 1;
      break;
    case 'mountain':
      solid(-0.14, 0.1, yellow);
      solid(0.14, 0.1, yellow);
      dashed(-v.laneW, 0.14, white);
      dashed(v.laneW, 0.14, white);
      solid(-half + 0.2, 0.16, white);
      solid(half - 0.2, 0.16, white);
      break;
    case 'circuit': {
      solid(-half + 0.2, 0.2, white);
      solid(half - 0.2, 0.2, white);
      for (let i = 0; i < v.lanes; i++) {
        x.fillStyle = 'rgba(0,0,0,0.16)';
        x.fillRect(lx(-half + (i + 0.5) * v.laneW) - ppm * 0.5, 0, ppm, S);
      }
      const bw = 1.3 * ppm;
      for (let k = 0; k < 18; k++) {
        x.fillStyle = k % 2 ? '#f4f4f4' : '#d6212e';
        x.fillRect(lx(-half) - bw, (k * S) / 18, bw, S / 18 + 1);
        x.fillRect(lx(half), (k * S) / 18, bw, S / 18 + 1);
      }
      break;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

function makeGroundTexture(v: EnvVis): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = v.ground;
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 160; i++) {
    x.fillStyle = v.groundAlt;
    x.globalAlpha = 0.25 + Math.random() * 0.3;
    x.beginPath();
    x.arc(Math.random() * S, Math.random() * S, 4 + Math.random() * 16, 0, 7);
    x.fill();
  }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(260 / SEG, 1);
  return t;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Slot { mesh: THREE.Mesh; side: -1 | 1; base: number }
interface Seg { group: THREE.Group; slots: Slot[]; lamps: THREE.Mesh[]; barriers: THREE.Mesh[]; gantry: THREE.Mesh | null; s0: number }
interface Veh {
  mesh: THREE.Mesh; active: boolean; type: string; s: number; x: number; vs: number; l: number; w: number; lane: number;
  dir: 1 | -1; passed: boolean; near: boolean;
}
interface Coin { mesh: THREE.Mesh; active: boolean; s: number; x: number }

export interface EngineEvents {
  onHud: (h: Hud) => void;
  onToast: (t: Toast) => void;
  onFinish: (r: RaceResult) => void;
  onVibrate?: (ms: number) => void;
}

export interface Input { left: boolean; right: boolean; gas: boolean; brake: boolean; nitro: boolean }

type Phase = 'menu' | 'countdown' | 'run' | 'crash' | 'ended';

// ---------------------------------------------------------------------------
export class Engine {
  readonly input: Input = { left: false, right: false, gas: false, brake: false, nitro: false };
  events: EngineEvents;
  phase: Phase = 'menu';
  paused = false;

  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(62, 1, 0.1, 300);
  private fog = new THREE.Fog(0xffffff, 20, 200);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  private sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
  private sky: THREE.Mesh;
  private sunMesh: THREE.Mesh;
  private stage = new THREE.Group();

  private settings: Settings;
  private q = QUALITY.medium;
  private scale = 1; // adaptive resolution multiplier
  private envId: EnvId | null = null;
  private vis: EnvVis = ENV.city;
  private segs: Seg[] = [];
  private envDispose: { dispose(): void }[] = [];
  private propGeos = new Map<string, PropGeo>();
  private propMat: THREE.MeshLambertMaterial;
  private vehMat: THREE.MeshLambertMaterial;
  private coinMat: THREE.MeshLambertMaterial;
  private bldgMat: THREE.MeshLambertMaterial | null = null;
  private roadMat: THREE.MeshLambertMaterial | null = null;
  private groundMat: THREE.MeshLambertMaterial | null = null;
  private weights: number[] = [];

  private rig: BikeRig | null = null;
  private rigId = '';
  private veh: Veh[] = [];
  private coins: Coin[] = [];
  private coinGeo: THREE.BufferGeometry;

  private cfg: RaceConfig | null = null;
  private st: BikeStats = computeStats(
    { id: '', name: '', cat: 'Sport', price: 0, color: '', accent: '', speed: 170, accel: 5.6, handling: 0.7, brake: 14, nitro: 3, desc: '' },
    { engine: 0, speed: 0, accel: 0, brakes: 0, handling: 0, nitro: 0 },
  );
  private bike = { s: 0, x: 0, y: 0, v: 0, steer: 0, lean: 0, pitch: 0, vy: 0, vx: 0, cr: { x: 0, y: 0, z: 0 }, cs: { x: 0, y: 0, z: 0 } };
  private nitro = 0;
  private nitroMax = 1;
  private nitroOn = false;
  private score = 0;
  private coinsGot = 0;
  private overtakes = 0;
  private nearMisses = 0;
  private topSpeed = 0;
  private elapsed = 0;
  private timeLeft = 0;
  private timeDown = false;
  private nextCheckpoint = 800;
  private spawnCd = 0;
  private nextCoinS = 120;
  private crashT = 0;
  private invuln = 0;
  private cdTime = 3;
  private lastCd = 4;
  private menuT = 0;
  private menuMode: 'menu' | 'garage' = 'menu';
  private hudT = 0;
  private respawning = false;
  private camPos = new THREE.Vector3();
  private fovNow = 62;
  private raf = 0;
  private last = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  private fpsT = 0;
  private disposed = false;
  private finished = false;
  private camOverride: number | null = null;

  constructor(canvas: HTMLCanvasElement, settings: Settings, events: EngineEvents) {
    this.canvas = canvas;
    this.settings = settings;
    this.events = events;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
    this.renderer.setClearColor(0x0b0b10, 1);
    this.scene.fog = this.fog;
    this.scene.add(this.hemi, this.sunLight);

    this.propMat = bendify(new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.vehMat = bendify(new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.coinMat = bendify(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x6a4a00 }));

    // sky dome (vertex gradient) + sun disc
    const skyGeo = new THREE.SphereGeometry(1, 16, 10);
    skyGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
    this.sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, depthTest: false }));
    this.sky.renderOrder = -100;
    this.sky.frustumCulled = false;
    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, depthWrite: false, depthTest: false }));
    this.sunMesh.renderOrder = -99;
    this.sunMesh.frustumCulled = false;
    this.scene.add(this.sky, this.sunMesh);

    // coin geometry: gold disc facing travel direction
    const cg = new THREE.CylinderGeometry(0.45, 0.45, 0.1, 14);
    cg.rotateX(Math.PI / 2);
    const gcol = new Float32Array(cg.attributes.position.count * 3);
    const gold = new THREE.Color(0xffc21a);
    for (let i = 0; i < gcol.length; i += 3) { gcol[i] = gold.r; gcol[i + 1] = gold.g; gcol[i + 2] = gold.b; }
    cg.setAttribute('color', new THREE.BufferAttribute(gcol, 3));
    this.coinGeo = cg;

    // pools
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(vehicleGeo('car', 0), this.vehMat);
      m.visible = false;
      m.frustumCulled = false;
      this.scene.add(m);
      this.veh.push({ mesh: m, active: false, type: 'car', s: 0, x: 0, vs: 0, l: 4, w: 1.8, lane: 0, dir: 1, passed: false, near: false });
    }
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(cg, this.coinMat);
      m.visible = false;
      m.frustumCulled = false;
      this.scene.add(m);
      this.coins.push({ mesh: m, active: false, s: 0, x: 0 });
    }

    // showroom stage
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.12, 40), new THREE.MeshLambertMaterial({ color: 0x1b1c22 }));
    disc.position.y = 0.06;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.46, 0.025, 8, 64), new THREE.MeshBasicMaterial({ color: 0xff2a36, fog: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.13;
    this.stage.add(disc, ring);
    this.scene.add(this.stage);

    this.applyQuality();
    this.resize();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', this.releaseAll);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ---- public API ---------------------------------------------------------
  setSettings(s: Settings) {
    const qChanged = s.quality !== this.settings.quality;
    this.settings = s;
    if (qChanged) {
      this.applyQuality();
      if (this.envId) { const id = this.envId; this.envId = null; this.setEnv(id); this.layoutSegments(this.bike.s); }
    }
    audio.setVolumes(s.sfx, s.music);
  }

  showBike(def: BikeDef, view: 'menu' | 'garage' = 'menu') {
    const already = this.phase === 'menu' && this.envId === 'city';
    this.cfg = null;
    this.phase = 'menu';
    this.paused = false;
    this.menuMode = view;
    this.finished = false;
    this.setEnv('city');
    this.setRig(def);
    const rig = this.rig!;
    if (!already) {
      audio.stopEngine();
      this.bike.s = 0;
      this.bike.x = 0;
      this.bike.v = 0;
      bendU.value.set(0, 0);
      this.layoutSegments(0);
      this.hideTraffic();
      this.coins.forEach((c) => { c.active = false; c.mesh.visible = false; });
    }
    this.stage.visible = true;
    rig.root.visible = true;
    rig.root.position.set(0, 0.12, 0);
    rig.root.rotation.x = 0;
    rig.root.rotation.z = 0;
    rig.f
