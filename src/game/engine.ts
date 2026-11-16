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
    rig.flame.visible = false;
    rig.steer.rotation.y = 0;
    this.resize();
  }

  startRace(cfg: RaceConfig) {
    this.cfg = cfg;
    this.setEnv(cfg.env);
    this.setRig(cfg.bike);
    this.stage.visible = false;
    this.st = computeStats(cfg.bike, cfg.upg);
    this.nitroMax = this.st.nitro;
    this.nitro = this.nitroMax * 0.5;
    this.bike = { s: 0, x: 0, y: 0, v: 0, steer: 0, lean: 0, pitch: 0, vy: 0, vx: 0, cr: { x: 0, y: 0, z: 0 }, cs: { x: 0, y: 0, z: 0 } };
    this.bike.x = this.laneX(this.startLane());
    this.score = 0; this.coinsGot = 0; this.overtakes = 0; this.nearMisses = 0; this.topSpeed = 0; this.elapsed = 0;
    this.nitroOn = false;
    this.invuln = 0;
    this.respawning = false;
    this.finished = false;
    this.nextCheckpoint = 800;
    this.spawnCd = 0.5;
    this.nextCoinS = 90;
    this.timeDown = false;
    this.timeLeft = 0;
    if (cfg.mode === 'trial') { this.timeDown = true; this.timeLeft = 60; }
    if (cfg.mission && cfg.mission.time) { this.timeDown = true; this.timeLeft = cfg.mission.time; }
    this.cdTime = 3;
    this.lastCd = 4;
    this.phase = 'countdown';
    this.paused = false;
    this.camOverride = null;
    bendU.value.set(0, 0);
    this.layoutSegments(0);
    this.hideTraffic();
    this.coins.forEach((c) => { c.active = false; c.mesh.visible = false; });
    this.rig!.root.visible = true;
    this.rig!.root.rotation.set(0, 0, 0);
    this.camera.clearViewOffset();
    this.camPos.set(this.bike.x, 3.2, 8);
    this.fillTraffic();
    audio.startEngine();
    audio.startMusic('race');
    this.resize();
    this.emitHud();
  }

  restart() { if (this.cfg) this.startRace(this.cfg); }

  setPaused(p: boolean) {
    if (this.phase === 'menu' || this.phase === 'ended') return;
    this.paused = p;
    this.releaseAll();
    if (p) audio.stopEngine(); else audio.startEngine();
  }

  /** Ends the current race early (player chose to quit). */
  quit() {
    if (this.phase === 'menu' || this.phase === 'ended') return;
    this.finish('quit', this.cfg?.mission ? false : null);
  }

  cycleCamera(): number {
    const cur = this.camOverride ?? this.settings.camera;
    this.camOverride = (cur + 1) % 4;
    this.emitHud();
    return this.camOverride;
  }

  setInput(k: keyof Input, v: boolean) { this.input[k] = v; }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.releaseAll);
    audio.stopEngine();
    this.renderer.dispose();
  }

  resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.q.dpr) * this.scale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (this.phase === 'menu' && this.menuMode === 'menu') {
      // push the bike to the right (landscape) or upward (portrait) so menu buttons don't cover it
      if (w / h > 1.15) this.camera.setViewOffset(w, h, -w * 0.2, 0, w, h);
      else this.camera.setViewOffset(w, h, 0, h * 0.1, w, h);
    } else {
      this.camera.clearViewOffset();
    }
    this.camera.updateProjectionMatrix();
  };

  // ---- internals ----------------------------------------------------------
  private onResize = () => this.resize();

  private onKey = (e: KeyboardEvent) => {
    const down = e.type === 'keydown';
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    let handled = true;
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.input.gas = down; break;
      case 'KeyS': case 'ArrowDown': this.input.brake = down; break;
      case 'KeyA': case 'ArrowLeft': this.input.left = down; break;
      case 'KeyD': case 'ArrowRight': this.input.right = down; break;
      case 'Space': this.input.nitro = down; break;
      case 'KeyC': if (down && !e.repeat && this.racing()) this.cycleCamera(); break;
      case 'KeyR': if (down && !e.repeat && this.racing() && !this.paused) this.restart(); break;
      default: handled = false;
    }
    if (handled && this.racing()) e.preventDefault();
  };

  private racing() { return this.phase === 'countdown' || this.phase === 'run' || this.phase === 'crash'; }

  private releaseAll = () => { this.input.left = this.input.right = this.input.gas = this.input.brake = this.input.nitro = false; };

  private applyQuality() {
    this.q = QUALITY[this.settings.quality] || QUALITY.medium;
    this.scale = 1;
    this.camera.far = this.q.draw + 60;
    this.fog.far = this.q.draw;
    this.camera.updateProjectionMatrix();
    this.sky.scale.setScalar(this.q.draw * 0.9);
    this.resize();
  }

  private laneX(i: number) { return (i - (this.vis.lanes - 1) / 2) * this.vis.laneW; }
  private startLane() { return this.vis.twoWay ? this.vis.lanes - 1 : Math.floor(this.vis.lanes / 2); }
  private roadHalf() { return (this.vis.lanes * this.vis.laneW) / 2; }
  private xLimit() { return this.roadHalf() + this.vis.shoulderW - (this.vis.rail === 'none' ? -2.5 : 0.7); }

  private setRig(def: BikeDef) {
    if (this.rig && this.rigId === def.id) return;
    if (this.rig) { this.scene.remove(this.rig.root); this.rig.dispose(); }
    this.rig = buildBike(def);
    this.rig.root.rotation.order = 'YXZ';
    this.rigId = def.id;
    this.scene.add(this.rig.root);
  }

  private hideTraffic() { this.veh.forEach((v) => { v.active = false; v.mesh.visible = false; }); }

  // ---- environment --------------------------------------------------------
private setEnv(id: EnvId) {
    if (this.envId === id) return;
    // tear down
    for (const s of this.segs) this.scene.remove(s.group);
    this.segs = [];
    this.envDispose.forEach((d) => d.dispose());
    this.envDispose = [];
    this.propGeos.forEach((p) => p.geo.dispose());
    this.propGeos.clear();
    this.bldgMat?.dispose();
    this.bldgMat = null;

    this.envId = id;
    const v = ENV[id];
    this.vis = v;
    const track = <T extends { dispose(): void }>(o: T): T => { this.envDispose.push(o); return o; };

    // colours / lights
    this.fog.color.setHex(v.fog);
    this.fog.near = this.q.draw * v.fogNear;
    this.fog.far = this.q.draw;
    this.renderer.setClearColor(v.fog, 1);
    this.hemi.color.setHex(v.hemi[0]);
    this.hemi.groundColor.setHex(v.hemi[1]);
    this.hemi.intensity = v.hemi[2];
    this.sunLight.color.setHex(v.sun[0]);
    this.sunLight.intensity = v.sun[1];
    this.sunLight.position.set(-v.sunDir[0] * 10, 12, -v.sunDir[2] * 10);
    (this.sunMesh.material as THREE.MeshBasicMaterial).color.setHex(v.sunColor);
    this.sunMesh.scale.setScalar(this.q.draw * (v.night ? 0.05 : 0.07));
    const pos = this.sky.geometry.attributes.position as THREE.BufferAttribute;
    const col = this.sky.geometry.attributes.color as THREE.BufferAttribute;
    const top = new THREE.Color(v.skyTop);
    const bot = new THREE.Color(v.skyBot);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = clamp(pos.getY(i) * 1.6, 0, 1);
      tmp.copy(bot).lerp(top, Math.pow(t, 0.7));
      col.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    col.needsUpdate = true;

    // materials
    const road = track(makeRoadTexture(v, this.q.aniso));
    const roadW = v.lanes * v.laneW + v.shoulderW * 2;
    this.roadMat = bendify(new THREE.MeshLambertMaterial({ map: road, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    track(this.roadMat);
    const gtex = track(makeGroundTexture(v));
    this.groundMat = bendify(new THREE.MeshLambertMaterial({ map: gtex }));
    track(this.groundMat);
    if (v.props.some((p) => p.t.startsWith('bldg'))) {
      const wt = windowTextures(v.night);
      track(wt.map); track(wt.emissive);
      this.bldgMat = bendify(new THREE.MeshLambertMaterial({ vertexColors: true, map: wt.map, emissive: 0xffffff, emissiveMap: wt.emissive, emissiveIntensity: v.night ? 1 : 0 }));
    }

    // geometry
    const roadGeo = track(new THREE.PlaneGeometry(roadW, SEG));
    roadGeo.rotateX(-Math.PI / 2);
    const groundGeo = track(new THREE.PlaneGeometry(260, SEG));
    groundGeo.rotateX(-Math.PI / 2);
    for (const p of v.props) if (!this.propGeos.has(p.t)) this.propGeos.set(p.t, buildProp(p.t));
    this.weights = v.props.map((p) => p.w);
    const edge = this.roadHalf() + v.shoulderW;
    const railG = v.rail === 'guard' ? track(railGeo(SEG)) : v.rail === 'tyre' ? track(tyreWallGeo(SEG)) : null;
    const walkG = v.sidewalk ? track(sidewalkGeo(SEG, 3.2)) : null;
    const lampL = v.lamps ? track(lampGeo(2.4)) : null;
    const gantryG = v.gantry !== 'none' ? track(gantryGeo(roadW, v.gantry)) : null;
    const lampMat = this.propMat;

    const perSide = Math.max(1, Math.round(v.density * this.q.props));
    const count = this.q.seg;
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      g.matrixAutoUpdate = false;
      const rm = new THREE.Mesh(roadGeo, this.roadMat);
      rm.frustumCulled = false;
      const gm = new THREE.Mesh(groundGeo, this.groundMat);
      gm.position.y = -0.06;
      gm.frustumCulled = false;
      g.add(rm, gm);
      const barriers: THREE.Mesh[] = [];
      const lamps: THREE.Mesh[] = [];
      if (railG) {
        for (const side of [-1, 1] as const) {
          const m = new THREE.Mesh(railG, lampMat);
          m.position.x = side * (edge - 0.1 - (v.rail === 'tyre' ? -0.4 : 0));
          m.frustumCulled = false;
          g.add(m);
          barriers.push(m);
        }
      }
      if (walkG) {
        for (const side of [-1, 1] as const) {
          const m = new THREE.Mesh(walkG, lampMat);
          m.position.x = side * (edge + 1.6);
          m.frustumCulled = false;
          g.add(m);
        }
      }
      if (lampL) {
        for (const side of [-1, 1] as const) {
          const m = new THREE.Mesh(lampL, lampMat);
          m.position.set(side * (edge + (v.sidewalk ? 0.6 : 0.5)), 0, 0);
          if (side === 1) m.rotation.y = Math.PI;
          m.frustumCulled = false;
          g.add(m);
          lamps.push(m);
        }
      }
      let gm2: THREE.Mesh | null = null;
      if (gantryG) {
        gm2 = new THREE.Mesh(gantryG, lampMat);
        gm2.frustumCulled = false;
        g.add(gm2);
      }
      const slots: Slot[] = [];
      for (const side of [-1, 1] as const) {
        for (let k = 0; k < perSide; k++) {
          const m = new THREE.Mesh(this.propGeos.values().next().value!.geo, this.propMat);
          m.matrixAutoUpdate = false;
          m.frustumCulled = false;
          g.add(m);
          slots.push({ mesh: m, side, base: ((k + 0.5) / perSide) * SEG });
        }
      }
      this.scene.add(g);
      this.segs.push({ group: g, slots, lamps, barriers, gantry: gm2, s0: 0 });
    }
    void edge;
  }

  private pickProp(): PropSpec {
    const props = this.vis.props;
    let total = 0;
    for (const w of this.weights) total += w;
    let r = Math.random() * total;
    for (let i = 0; i < props.length; i++) { r -= this.weights[i]; if (r <= 0) return props[i]; }
    return props[0];
  }

  private placeSegment(seg: Seg, s0: number) {
    seg.s0 = s0;
    const g = seg.group;
    g.position.set(0, 0, -(s0 + SEG / 2));
    g.updateMatrix();
    const edge = this.roadHalf() + this.vis.shoulderW;
    const idx = Math.round(s0 / SEG);
    if (seg.gantry) seg.gantry.visible = ((idx % 4) + 4) % 4 === 0;
    const perSide = seg.slots.length / 2;
    for (const sl of seg.slots) {
      const spec = this.pickProp();
      const pg = this.propGeos.get(spec.t)!;
      const m = sl.mesh;
      m.geometry = pg.geo;
      m.material = pg.kind === 'bldg' && this.bldgMat ? this.bldgMat : this.propMat;
      const sc = spec.sc ? rnd(spec.sc[0], spec.sc[1]) : 1;
      const bb = pg.geo.boundingBox!;
      const halfW = Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x)) * sc;
      const jitter = rnd(-0.3, 0.3) * (SEG / perSide);
      const sLocal = clamp(sl.base + jitter, 1, SEG - 1);
      const x = sl.side * (edge + rnd(spec.off[0], spec.off[1]) + halfW);
      m.position.set(x, 0, SEG / 2 - sLocal);
      m.scale.setScalar(sc);
      let ry = 0;
      const face = spec.face || 'none';
      if (face === 'z') ry = sl.side === -1 ? Math.PI / 2 : -Math.PI / 2;
      else if (face === 'nx') ry = sl.side === 1 ? 0 : Math.PI;
      else if (spec.t === 'pole') ry = sl.side === 1 ? Math.PI : 0;
      else ry = Math.random() * Math.PI * 2;
      m.rotation.set(0, ry, 0);
      m.updateMatrix();
    }
  }

  private layoutSegments(s: number) {
    const base = Math.floor(s / SEG) * SEG - SEG;
    this.segs.forEach((seg, i) => this.placeSegment(seg, base + i * SEG));
  }

  private recycleSegments() {
    let maxS = -Infinity;
    for (const sg of this.segs) if (sg.s0 > maxS) maxS = sg.s0;
    for (const sg of this.segs) {
      if (sg.s0 + SEG < this.bike.s - 40) { maxS += SEG; this.placeSegment(sg, maxS); }
    }
  }

  // ---- traffic ------------------------------------------------------------
  private difficulty(): number {
    const c = this.cfg;
    if (!c) return 0.3;
    switch (c.mode) {
      case 'traffic': return Math.min(1, 0.25 + this.bike.s / 7000);
      case 'trial': return 0.35;
      case 'free': return 0.1;
      case 'career': return Math.min(1, 0.3 + 0.05 * Math.max(0, CAREER.findIndex((m) => m.id === c.mission?.id)));
      default: return 0.6;
    }
  }

  private maxTraffic(): number {
    if (this.cfg?.mode === 'free') return Math.min(4, this.q.traffic);
    return Math.min(this.q.traffic, Math.round(5 + this.difficulty() * 9));
  }

  private spawnVehicle(s: number, lane: number): boolean {
    const free = this.veh.find((v) => !v.active);
    if (!free) return false;
    const vis = this.vis;
    const type = vis.traffic[Math.floor(Math.random() * vis.traffic.length)];
    const def = VEH[type];
    const dir: 1 | -1 = vis.twoWay && lane < vis.lanes / 2 ? -1 : 1;
    // lane spacing check
    let blockedLanes = 0;
    const seen = new Set<number>();
    for (const o of this.veh) {
      if (!o.active) continue;
      const ds = Math.abs(o.s - s);
      if (o.lane === lane && ds < (o.l + def.l) / 2 + 24) return false;
      if (ds < 32 && !seen.has(o.lane)) { seen.add(o.lane); blockedLanes++; }
    }
    if (!seen.has(lane) && blockedLanes >= vis.lanes - 1) return false;
    const spd = rnd(def.sp[0], def.sp[1]) * (0.9 + 0.2 * this.difficulty());
    free.type = type;
    free.l = def.l;
    free.w = def.w;
    free.lane = lane;
    free.dir = dir;
    free.s = s;
    free.x = this.laneX(lane);
    free.vs = spd * dir;
    free.passed = false;
    free.near = false;
    free.active = true;
    free.mesh.geometry = vehicleGeo(type, Math.floor(Math.random() * 8));
    free.mesh.rotation.y = dir < 0 ? Math.PI : 0;
    free.mesh.position.set(free.x, 0, -s);
    free.mesh.visible = true;
    return true;
  }

  private fillTraffic() {
    const n = this.cfg?.mode === 'free' ? 2 : Math.round(this.maxTraffic() * 0.7);
    let tries = 0;
    let made = 0;
    while (made < n && tries < 60) {
      tries++;
      const s = rnd(70, this.q.draw * 0.85);
      if (this.spawnVehicle(s, Math.floor(Math.random() * this.vis.lanes))) made++;
    }
  }

  private updateTraffic(dt: number, collide: boolean) {
    const b = this.bike;
    const draw = this.q.draw;
    let active = 0;
    for (const v of this.veh) {
      if (!v.active) continue;
      v.s += v.vs * dt;
      active++;
    }
    // lane following: a faster vehicle never drives through a slower one ahead of it
    for (const f of this.veh) {
      if (!f.active) continue;
      for (const l of this.veh) {
        if (l === f || !l.active || l.lane !== f.lane || l.dir !== f.dir) continue;
        const ahead = f.dir === 1 ? l.s - f.s : f.s - l.s;
        if (ahead <= 0) continue;
        const gap = ahead - (l.l + f.l) / 2;
        if (gap < 7 && Math.abs(f.vs) > Math.abs(l.vs)) f.vs = l.vs;
      }
    }
    for (const v of this.veh) {
      if (!v.active) continue;
      const rel = v.s - b.s;
      // recycle
      if ((v.dir === 1 && rel < -80) || (v.dir === -1 && rel < -60) || rel > draw * 1.4) {
        v.active = false;
        v.mesh.visible = false;
        continue;
      }
      v.mesh.position.set(v.x, 0, -v.s);
      if (!collide) continue;
      const behind = v.s + v.l / 2 < b.s - BIKE_L / 2;
      if (behind) {
        if (v.dir === 1 && !v.passed) {
          v.passed = true;
          this.overtakes++;
          this.score += 100;
          this.nitro = Math.min(this.nitroMax, this.nitro + 0.25);
          audio.sfx('overtake');
          this.toast('OVERTAKE +100', 'good');
        } else v.passed = true;
        continue;
      }
      if (v.passed) continue;
      const ds = Math.abs(v.s - b.s);
      if (ds < (v.l + BIKE_L) / 2) {
        const gap = Math.abs(v.x - b.x) - (v.w * 0.92 + BIKE_W) / 2;
        if (gap < 0 && this.invuln <= 0) { this.startCrash(v); return; }
        if (gap >= 0 && gap < NEAR_GAP && !v.near && b.v * 3.6 > 70) {
          v.near = true;
          this.nearMisses++;
          this.score += 150;
          this.nitro = Math.min(this.nitroMax, this.nitro + 0.4);
          audio.sfx('near');
          this.toast('NEAR MISS +150', 'info');
        }
      }
    }
    // spawn
    this.spawnCd -= dt;
    if (this.spawnCd <= 0 && active < this.maxTraffic()) {
      const lane = Math.floor(Math.random() * this.vis.lanes);
      const ok = this.spawnVehicle(b.s + draw * 0.92, lane);
      this.spawnCd = ok ? rnd(0.3, 0.8) * (1.7 - this.difficulty()) : 0.12;
    }
  }

  private updateCoins(dt: number) {
    void dt;
    const b = this.bike;
    const draw = this.q.draw;
    for (const c of this.coins) {
      if (!c.active) continue;
      if (c.s < b.s - 20) { c.active = false; c.mesh.visible = false; continue; }
      if (Math.abs(c.s - b.s) < 1.3 && Math.abs(c.x - b.x) < 1.0) {
        c.active = false;
        c.mesh.visible = false;
        this.coinsGot += COIN_VALUE;
        this.score += 10;
        audio.sfx('coin');
        this.toast(`+${COIN_VALUE}`, 'coin');
      }
    }
    if (this.nextCoinS < b.s + draw * 0.85) {
      const lanes = this.vis.lanes;
      let lane = Math.floor(Math.random() * lanes);
      if (this.vis.twoWay && Math.random() < 0.8) lane = Math.floor(lanes / 2) + Math.floor(Math.random() * (lanes / 2));
      const n = 5 + Math.floor(Math.random() * 3);
      const free = this.coins.filter((c) => !c.active);
      if (free.length >= n) {
        for (let i = 0; i < n; i++) {
          const c = free[i];
          c.active = true;
          c.s = this.nextCoinS + i * 4;
          c.x = this.laneX(lane);
          c.mesh.position.set(c.x, 0.85, -c.s);
          c.mesh.visible = true;
        }
      }
      this.nextCoinS += rnd(140, 240);
    }
  }

  // ---- race flow ----------------------------------------------------------
private toast(text: string, kind: Toast['kind']) { this.events.onToast({ text, kind }); }

  private progress(): number {
    const m = this.cfg?.mission;
    if (!m) return 0;
    let v = 0;
    switch (m.kind) {
      case 'distance': v = this.bike.s; break;
      case 'overtake': v = this.overtakes; break;
      case 'nearmiss': v = this.nearMisses; break;
      case 'coins': v = this.coinsGot; break;
      case 'speed': v = this.topSpeed; break;
      case 'score': v = this.score; break;
      case 'survive': v = this.elapsed; break;
    }
    return clamp(v / m.target, 0, 1);
  }

  private startCrash(v: Veh) {
    const b = this.bike;
    this.phase = 'crash';
    this.crashT = 0;
    this.nitroOn = false;
    b.vx = (b.x - v.x) * 2.5 + rnd(-2, 2);
    b.vy = 3.5 + b.v * 0.06;
    b.cs = { x: rnd(-7, 7), y: rnd(-5, 5), z: rnd(-9, 9) };
    b.cr = { x: 0, y: 0, z: 0 };
    b.v = Math.max(0, b.v * 0.75 + Math.min(0, v.vs) * 0.0);
    audio.sfx('crash');
    this.toast('CRASH!', 'warn');
    if (this.settings.vibrate && this.events.onVibrate) this.events.onVibrate(220);
  }

  private endCrash() {
    const hard = !this.cfg || this.cfg.mode === 'traffic' || this.cfg.mode === 'career' || this.cfg.mode === 'challenge';
    if (hard) { this.finish('crash', this.cfg?.mission ? false : null); return; }
    // soft crash (time trial / free ride): respawn in a clear lane
    if (this.cfg!.mode === 'trial') this.timeLeft = Math.max(0.5, this.timeLeft - 5);
    const b = this.bike;
    for (const v of this.veh) if (v.active && Math.abs(v.s - b.s) < 45) { v.active = false; v.mesh.visible = false; }
    b.x = this.laneX(this.startLane());
    b.y = 0; b.vy = 0; b.vx = 0;
    b.v = Math.min(14, this.st.vmax * 0.2);
    b.steer = 0; b.lean = 0;
    this.rig!.root.rotation.set(0, 0, 0);
    this.invuln = 2;
    this.phase = 'run';
    this.respawning = true;
    setTimeout(() => { this.respawning = false; }, 1500);
    if (this.cfg!.mode === 'trial') this.toast('-5s', 'warn');
  }

  private finish(reason: FinishReason, success: boolean | null) {
    if (this.finished) return;
    this.finished = true;
    this.phase = 'ended';
    audio.stopEngine();
    this.releaseAll();
    this.emitHud();
    const res: RaceResult = {
      mode: this.cfg!.mode, env: this.cfg!.env, reason, success,
      score: Math.round(this.score), distance: Math.round(this.bike.s), coins: this.coinsGot,
      overtakes: this.overtakes, nearMisses: this.nearMisses, topSpeed: Math.round(this.topSpeed), duration: Math.round(this.elapsed),
    };
    this.events.onFinish(res);
  }

  private stepRun(dt: number) {
    const b = this.bike;
    const st = this.st;
    const inp = this.input;
    const hit = this.cfg!;
    const throttle = inp.gas || this.settings.autoThrottle ? 1 : 0;
    const braking = inp.brake;
    const wantNitro = inp.nitro && this.nitro > 0.01 && b.v > 4 && !braking;
    this.nitroOn = wantNitro;
    const vmax = st.vmax * (wantNitro ? 1.22 : 1);
    let a: number;
    if (throttle) {
      const f = b.v / vmax;
      a = st.acc * (wantNitro ? 1.9 : 1) * (1 - f * f * f);
    } else a = -(1.5 + 0.0012 * b.v * b.v);
    if (braking && b.v > 0) a -= st.brk;
    const off = Math.abs(b.x) > this.roadHalf() + 0.3;
    if (off) a -= 3 + b.v * 0.08;
    b.v = Math.max(0, b.v + a * dt);
    if (wantNitro) this.nitro = Math.max(0, this.nitro - dt);
    else this.nitro = Math.min(this.nitroMax, this.nitro + dt * 0.12);

    const target = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    b.steer += (target - b.steer) * Math.min(1, dt * 9);
    const sf = clamp(b.v / 10, 0, 1) * (1 - 0.3 * clamp(b.v / st.vmax, 0, 1));
    b.x += b.steer * (5.2 + 5 * st.hand) * this.settings.sensitivity * sf * dt;
    const lim = this.xLimit();
    if (b.x > lim) { b.x = lim; b.v *= 1 - 0.9 * dt; }
    if (b.x < -lim) { b.x = -lim; b.v *= 1 - 0.9 * dt; }
    b.lean += (b.steer * 0.55 * clamp(b.v / 12, 0, 1) - b.lean) * Math.min(1, dt * 8);
    b.pitch += ((throttle ? 0.05 : 0) * (wantNitro ? 2 : 1) - (braking ? 0.05 : 0) - b.pitch) * Math.min(1, dt * 5);
    b.s += b.v * dt;

    const kmh = b.v * 3.6;
    if (kmh > this.topSpeed) this.topSpeed = kmh;
    this.score += b.v * dt + (kmh > 100 ? (kmh - 100) * 0.5 * dt : 0);
    this.elapsed += dt;
    if (this.invuln > 0) this.invuln -= dt;

    // time
    if (this.timeDown) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.finish('timeup', hit.mission ? false : null);
        return;
      }
      if (hit.mode === 'trial' && b.s >= this.nextCheckpoint) {
        this.nextCheckpoint += 800;
        this.timeLeft += 15;
        this.score += 200;
        audio.sfx('checkpoint');
        this.toast('CHECKPOINT +15s', 'good');
      }
    }

    this.updateTraffic(dt, true);
    if (this.phase !== 'run') return;
    this.updateCoins(dt);
    this.recycleSegments();

    if (hit.mission && this.progress() >= 1) this.finish('complete', true);
  }

  private stepCrash(dt: number) {
    const b = this.bike;
    this.crashT += dt;
    b.v *= Math.max(0, 1 - 1.4 * dt);
    b.s += b.v * dt;
    b.x = clamp(b.x + b.vx * dt, -this.xLimit(), this.xLimit());
    b.vx *= Math.max(0, 1 - 1.2 * dt);
    b.vy -= 18 * dt;
    b.y += b.vy * dt;
    if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy) > 2 ? -b.vy * 0.4 : 0; if (b.vy === 0) { b.cs.x *= 0.9; b.cs.y *= 0.9; b.cs.z *= 0.9; } }
    b.cr.x += b.cs.x * dt; b.cr.y += b.cs.y * dt; b.cr.z += b.cs.z * dt;
    this.elapsed += dt;
    this.updateTraffic(dt, false);
    this.updateCoins(dt);
    this.recycleSegments();
    if (this.crashT > 1.7) this.endCrash();
  }

  private step(dt: number) {
    if (this.phase === 'countdown') {
      this.cdTime -= dt;
      const n = Math.max(0, Math.ceil(this.cdTime));
      if (n !== this.lastCd) { this.lastCd = n; if (n > 0) audio.sfx('beep'); }
      if (this.cdTime <= 0) { this.phase = 'run'; audio.sfx('go'); this.toast('GO!', 'good'); }
    } else if (this.phase === 'run') this.stepRun(dt);
    else if (this.phase === 'crash') this.stepCrash(dt);
  }

  // ---- per-frame visuals ----------------------------------------------------
  private syncBike(dt: number) {
    const rig = this.rig;
    if (!rig) return;
    const b = this.bike;
    if (this.phase === 'menu') {
      this.menuT += dt;
      rig.root.rotation.y = this.menuT * 0.55;
      this.stage.position.set(0, 0, 0);
      return;
    }
    const r = rig.root;
    r.position.set(b.x, b.y, -b.s);
    if (this.phase === 'crash') r.rotation.set(b.cr.x, b.cr.y, b.cr.z);
    else r.rotation.set(b.pitch, -b.steer * 0.12, -b.lean);
    rig.steer.rotation.y = this.phase === 'crash' ? 0.5 : -b.steer * 0.35;
    const spin = (b.v * dt) / 0.33;
    rig.front.rotation.x -= spin;
    rig.rear.rotation.x -= spin;
    rig.flame.visible = this.nitroOn && this.phase === 'run';
    if (rig.flame.visible) rig.flame.scale.set(1, 1, 0.7 + Math.random() * 0.6);
    const view = this.camOverride ?? this.settings.camera;
    r.visible = !(view === 3 && this.phase !== 'crash') && !(this.invuln > 0 && Math.floor(this.elapsed * 12) % 2 === 0);
  }

  private updateCamera(dt: number) {
    const cam = this.camera;
    if (this.phase === 'menu') {
      const a = Math.sin(this.menuT * 0.25) * 0.5 + 0.35;
      const R = this.menuMode === 'garage' ? 3.7 : 4.6;
      const h = this.menuMode === 'garage' ? 1.45 : 1.6;
      cam.position.set(Math.sin(a) * R, h, Math.cos(a) * R);
      cam.lookAt(0, 0.8, 0);
      if (Math.abs(cam.fov - 45) > 0.1) { cam.fov = 45; cam.updateProjectionMatrix(); }
      this.sky.position.copy(cam.position);
      this.placeSun();
      return;
    }
    const b = this.bike;
    const view = this.camOverride ?? this.settings.camera;
    const intro = this.phase === 'countdown' ? clamp(this.cdTime / 3, 0, 1) : 0;
    let ox: number, oy: number, oz: number, lx: number, ly: number, lz: number, kx: number;
    switch (view) {
      case 1: ox = 0; oy = 1.45; oz = 3.2; lx = 0.9; ly = 1.0; lz = -8; kx = 0.7; break;
      case 2: ox = 0; oy = 4.6; oz = 7.6; lx = 0.8; ly = 0.4; lz = -12; kx = 0.4; break;
      case 3: ox = 0; oy = 1.5; oz = -0.2; lx = 1; ly = 1.3; lz = -16; kx = 1; break;
      default: ox = 0; oy = 2.2; oz = 5.0; lx = 0.85; ly = 1.0; lz = -9; kx = 0.55;
    }
    const tx = b.x * kx + ox + intro * 2.5;
    const ty = oy + b.y * 0.5 + intro * 1.8;
    const tz = -b.s + oz + intro * 4;
    const k = view === 3 ? 1 : 1 - Math.exp(-dt * (this.phase === 'crash' ? 3 : 9));
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.y += (ty - this.camPos.y) * k;
    this.camPos.z += (tz - this.camPos.z) * (view === 3 ? 1 : 1 - Math.exp(-dt * 14));
    const sp = clamp(b.v / this.st.vmax, 0, 1.3);
    let sx = 0, sy = 0;
    if (this.settings.shake && this.phase === 'run') {
      const m = 0.03 * sp * sp * (this.nitroOn ? 2 : 1);
      sx = (Math.random() - 0.5) * m;
      sy = (Math.random() - 0.5) * m;
    }
    if (this.phase === 'crash') { sx = (Math.random() - 0.5) * 0.15; sy = (Math.random() - 0.5) * 0.15; }
    cam.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
    cam.lookAt(b.x * lx, ly, -b.s + lz);
    if (view !== 3) cam.rotateZ(-b.lean * 0.12);
    const wantFov = this.settings.fov + sp * 10 + (this.nitroOn ? 8 : 0) + (view === 3 ? 6 : 0);
    this.fovNow += (wantFov - this.fovNow) * Math.min(1, dt * 4);
    if (Math.abs(cam.fov - this.fovNow) > 0.05) { cam.fov = this.fovNow; cam.updateProjectionMatrix(); }
    this.sky.position.copy(cam.position);
    this.placeSun();
  }

  private placeSun() {
    const d = this.vis.sunDir;
    const r = this.q.draw * 0.85;
    const l = Math.hypot(d[0], d[1], d[2]);
    this.sunMesh.position.set(this.camera.position.x + (d[0] / l) * r, this.camera.position.y + (d[1] / l) * r, this.camera.position.z + (d[2] / l) * r);
  }

  private emitHud() {
    const c = this.cfg;
    const m = c?.mission;
    const view = this.camOverride ?? this.settings.camera;
    const cd = this.phase === 'countdown' ? Math.max(1, Math.ceil(this.cdTime)) : this.phase === 'run' && this.elapsed < 0.8 ? 0 : -1;
    let objective = '';
    if (m) objective = `${m.title}: ${objectiveText(m)}`;
    else if (c?.mode === 'trial') objective = 'Reach checkpoints to add time';
    else if (c?.mode === 'traffic') objective = 'Overtake traffic, avoid crashes';
    else if (c?.mode === 'free') objective = 'Free ride - no limits';
    this.events.onHud({
      speed: Math.round(this.bike.v * 3.6),
      maxSpeed: Math.round(this.st.kmh * 1.22),
      dist: this.bike.s,
      score: Math.round(this.score),
      coins: this.coinsGot,
      nitro: this.nitroMax > 0 ? this.nitro / this.nitroMax : 0,
      nitroOn: this.nitroOn,
      time: this.timeDown ? this.timeLeft : this.elapsed,
      timeMode: this.timeDown ? 'down' : 'up',
      overtakes: this.overtakes,
      near: this.nearMisses,
      objective,
      progress: this.progress(),
      countdown: cd,
      crashed: this.phase === 'crash',
      camera: view,
      respawning: this.respawning,
    });
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) return;
    if (dt > 0.1) dt = 0.1;

    if (this.phase !== 'menu' && !this.paused) {
      let rem = dt;
      while (rem > 0 && (this.phase === 'countdown' || this.phase === 'run' || this.phase === 'crash')) {
        const h = Math.min(rem, 1 / 60);
        this.step(h);
        rem -= h;
      }
      if (this.phase === 'run' || this.phase === 'countdown') {
        audio.updateEngine(this.bike.v / this.st.vmax, this.input.gas || this.settings.autoThrottle ? 1 : 0, this.nitroOn, this.input.brake, Math.abs(this.bike.x) > this.roadHalf() + 0.3);
      }
      // curved-world target
      const v = this.vis;
      const s = this.bike.s;
      const bx = v.bend * (Math.sin(s * 0.0021) + 0.6 * Math.sin(s * 0.0053 + 1.3));
      const by = v.hill * Math.sin(s * 0.0033 + 0.7);
      const k = Math.min(1, dt * 2);
      bendU.value.x += (bx - bendU.value.x) * k;
      bendU.value.y += (by - bendU.value.y) * k;
      this.hudT += dt;
      if (this.hudT > 0.1) { this.hudT = 0; if (this.phase !== 'ended') this.emitHud(); }
      // adaptive resolution
      this.fpsAcc += dt; this.fpsN++; this.fpsT += dt;
      if (this.fpsT > 1.5 && this.phase === 'run') {
        const fps = this.fpsN / this.fpsAcc;
        let ns = this.scale;
        if (fps < 40 && ns > 0.55) ns -= 0.1;
        else if (fps > 57 && ns < 1) ns += 0.05;
        if (Math.abs(ns - this.scale) > 0.001) { this.scale = ns; this.resize(); }
        this.fpsAcc = 0; this.fpsN = 0; this.fpsT = 0;
      }
    } else if (this.phase === 'menu') {
      // gentle showroom drift
      bendU.value.set(0, 0);
    }
    this.syncBike(dt);
    this.updateCamera(dt);
    this.updateCoinSpin(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private spinT = 0;
  private updateCoinSpin(dt: number) {
    this.spinT += dt * 3;
    for (const c of this.coins) if (c.active) c.mesh.rotation.y = this.spinT;
  }
}
