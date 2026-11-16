// Procedural low-poly models. Everything is merged into a few vertex-coloured
// geometries, so a whole vehicle or prop is one draw call.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BikeDef } from './data';

export type ColorLike = number | string | THREE.Color;
export interface Part {
  g: THREE.BufferGeometry;
  c: ColorLike;
  p?: [number, number, number];
  r?: [number, number, number];
  s?: [number, number, number];
}

export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl14: new THREE.CylinderGeometry(1, 1, 1, 14),
  cone: new THREE.CylinderGeometry(0, 1, 1, 8),
  sph: new THREE.SphereGeometry(1, 8, 6),
  ico: new THREE.IcosahedronGeometry(1, 0),
};

export const P = (
  g: THREE.BufferGeometry, c: ColorLike,
  p: [number, number, number] = [0, 0, 0], s: [number, number, number] = [1, 1, 1], r: [number, number, number] = [0, 0, 0],
): Part => ({ g, c, p, s, r });

/** Glowing colour (values above 1 survive lighting and read as emissive). */
export const glow = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b);

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

export function mk(parts: Part[]): THREE.BufferGeometry {
  const list = parts.map((pt) => {
    const g = pt.g.index ? pt.g.toNonIndexed() : pt.g.clone();
    g.deleteAttribute('uv');
    const p = pt.p || [0, 0, 0];
    const r = pt.r || [0, 0, 0];
    const s = pt.s || [1, 1, 1];
    _e.set(r[0], r[1], r[2]);
    _q.setFromEuler(_e);
    _v.set(p[0], p[1], p[2]);
    _s.set(s[0], s[1], s[2]);
    _m.compose(_v, _q, _s);
    g.applyMatrix4(_m);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const c = pt.c instanceof THREE.Color ? pt.c : new THREE.Color(pt.c as number);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  const merged = mergeGeometries(list, false) as THREE.BufferGeometry;
  list.forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

// ---------------------------------------------------------------------------
// Player motorcycle
// ---------------------------------------------------------------------------
export interface BikeRig {
  root: THREE.Group;
  steer: THREE.Group;
  front: THREE.Mesh;
  rear: THREE.Mesh;
  flame: THREE.Mesh;
  parts: THREE.Mesh[];
  dispose(): void;
}

function wheelGeo(r: number, w: number, rim: ColorLike, spoke: ColorLike): THREE.BufferGeometry {
  const parts: Part[] = [
    P(G.cyl14, 0x101012, [0, 0, 0], [r, w, r], [0, 0, Math.PI / 2]),
    P(G.cyl14, rim, [0, 0, 0], [r * 0.6, w + 0.02, r * 0.6], [0, 0, Math.PI / 2]),
  ];
  for (let k = 0; k < 3; k++) parts.push(P(G.box, spoke, [0, 0, 0], [w + 0.05, 0.045, r * 1.5], [(k * Math.PI) / 3, 0, 0]));
  return mk(parts);
}

let bikeMat: THREE.MeshLambertMaterial | null = null;
let flameMat: THREE.MeshBasicMaterial | null = null;

export function buildBike(def: BikeDef): BikeRig {
  if (!bikeMat) bikeMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  if (!flameMat) flameMat = new THREE.MeshBasicMaterial({ color: 0x66bbff, transparent: true, opacity: 0.9, fog: false, depthWrite: false });
  const body = def.color;
  const acc = def.accent;
  const metal = 0xb8bcc4;
  const cat = def.cat;
  const faired = cat !== 'Street';
  const tuck = cat === 'Racing' ? 0.85 : cat === 'Super' ? 0.7 : cat === 'Sport' ? 0.5 : 0.12;
  const fairH = cat === 'Super' ? 0.55 : cat === 'Racing' ? 0.5 : 0.44;
  const fairL = cat === 'Super' ? 0.64 : cat === 'Racing' ? 0.6 : 0.5;
  const tailL = cat === 'Racing' ? 0.75 : cat === 'Super' ? 0.62 : cat === 'Sport' ? 0.5 : 0.36;
  const rearR = cat === 'Racing' || cat === 'Super' ? 0.35 : 0.33;
  const rearW = cat === 'Racing' ? 0.2 : cat === 'Super' ? 0.18 : 0.13;

  const chassis: Part[] = [
    // engine + frame
    P(G.box, 0x2b2c31, [0, 0.5, 0.12], [0.34, 0.36, 0.5]),
    P(G.box, 0x1c1d21, [0, 0.38, 0.4], [0.09, 0.09, 0.8]),
    // tank, seat, tail
    P(G.sph, body, [0, 0.9, -0.12], [0.27, 0.2, 0.5]),
    P(G.box, acc, [0, 1.07, -0.12], [0.06, 0.04, 0.7]),
    P(G.box, 0x121216, [0, 0.85, 0.42], [0.26, 0.1, 0.6]),
    P(G.box, body, [0, 0.94, 0.5 + tailL * 0.5], [0.22, 0.14, tailL]),
    P(G.box, glow(3, 0.2, 0.2), [0, 0.95, 0.52 + tailL], [0.15, 0.06, 0.04]),
    // contact shadow
    P(G.box, 0x050505, [0, 0.012, 0.0], [0.5, 0.01, 2.4]),
    // rider
    P(G.box, acc, [0, 1.17, 0.12 - tuck * 0.05], [0.34, 0.55, 0.24], [-0.25 - tuck * 0.75, 0, 0]),
    P(G.sph, 0xf2f2f2, [0, 1.58 - tuck * 0.2, -0.04 - tuck * 0.32], [0.17, 0.17, 0.19]),
    P(G.box, 0x0a0a0d, [0, 1.58 - tuck * 0.2, -0.17 - tuck * 0.32], [0.15, 0.07, 0.08]),
    P(G.box, acc, [-0.2, 1.17, -0.18], [0.1, 0.1, 0.55], [0.55 + tuck * 0.3, 0, 0.15]),
    P(G.box, acc, [0.2, 1.17, -0.18], [0.1, 0.1, 0.55], [0.55 + tuck * 0.3, 0, -0.15]),
    P(G.box, 0x1c1d22, [-0.2, 0.74, 0.12], [0.13, 0.5, 0.17], [0.55, 0, 0]),
    P(G.box, 0x1c1d22, [0.2, 0.74, 0.12], [0.13, 0.5, 0.17], [0.55, 0, 0]),
    P(G.box, 0x0e0e10, [-0.2, 0.42, 0.2], [0.12, 0.12, 0.3]),
    P(G.box, 0x0e0e10, [0.2, 0.42, 0.2], [0.12, 0.12, 0.3]),
  ];
  if (faired) {
    chassis.push(P(G.box, body, [0, 0.8, -0.62], [0.44, fairH, fairL]));
    chassis.push(P(G.box, acc, [-0.23, 0.74, -0.6], [0.04, 0.24, 0.4]));
    chassis.push(P(G.box, acc, [0.23, 0.74, -0.6], [0.04, 0.24, 0.4]));
    chassis.push(P(G.box, 0x9fd3ff, [0, 0.8 + fairH / 2 + 0.08, -0.74], [0.3, cat === 'Super' ? 0.32 : 0.22, 0.04], [-0.55, 0, 0]));
    chassis.push(P(G.box, acc, [0, 0.35, 0.0], [0.3, 0.12, 0.9]));
  } else {
    // naked street bike: exposed forks area gets a small fly-screen and round tank cap
    chassis.push(P(G.cyl, metal, [0.23, 0.42, 0.55], [0.07, 0.9, 0.07], [Math.PI / 2, 0, 0.05]));
    chassis.push(P(G.box, body, [0, 0.72, -0.5], [0.3, 0.1, 0.3]));
  }
  if (cat === 'Racing') {
    chassis.push(P(G.cyl, metal, [0.2, 0.75, 0.9], [0.07, 0.7, 0.07], [Math.PI / 2, 0, 0.12]));
    chassis.push(P(G.box, 0xffffff, [0, 0.86, -0.85], [0.26, 0.22, 0.03], [-0.2, 0, 0]));
  } else if (faired) {
    chassis.push(P(G.cyl, metal, [0.2, 0.42, 0.55], [0.07, 0.8, 0.07], [Math.PI / 2, 0, 0.05]));
  }

  const forks: Part[] = [
    P(G.cyl, metal, [-0.09, 0.62, 0.09], [0.025, 0.72, 0.025], [0.26, 0, 0]),
    P(G.cyl, metal, [0.09, 0.62, 0.09], [0.025, 0.72, 0.025], [0.26, 0, 0]),
    P(G.box, 0x1d1e22, [0, 1.03 + (faired ? 0 : 0.1), 0.2], [faired ? 0.66 : 0.82, 0.04, 0.04]),
    P(G.box, 0x0e0e10, [-0.38, 1.03 + (faired ? 0 : 0.1), 0.2], [0.12, 0.05, 0.05]),
    P(G.box, 0x0e0e10, [0.38, 1.03 + (faired ? 0 : 0.1), 0.2], [0.12, 0.05, 0.05]),
    P(G.sph, glow(3.5, 3.2, 2.4), [0, faired ? 0.88 : 0.95, -0.08], faired ? [0.11, 0.1, 0.09] : [0.14, 0.14, 0.1]),
    P(G.box, body, [0, 0.55, -0.02], [0.2, 0.05, 0.3]),
  ];

  const mats = bikeMat;
  const chassisGeo = mk(chassis);
  const forkGeo = mk(forks);
  const frontGeo = wheelGeo(0.33, 0.12, 0xaeb2ba, acc);
  const rearGeo = wheelGeo(rearR, rearW, 0xaeb2ba, acc);
  const flameGeo = new THREE.ConeGeometry(0.1, 0.9, 8);
  flameGeo.translate(0, 0.45, 0);
  flameGeo.rotateX(Math.PI / 2);

  const root = new THREE.Group();
  const chassisMesh = new THREE.Mesh(chassisGeo, mats);
  const steer = new THREE.Group();
  steer.position.set(0, 0, -0.7);
  const forkMesh = new THREE.Mesh(forkGeo, mats);
  const front = new THREE.Mesh(frontGeo, mats);
  front.position.set(0, 0.33, 0);
  steer.add(forkMesh, front);
  const rear = new THREE.Mesh(rearGeo, mats);
  rear.position.set(0, rearR, 0.7);
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.set(0.2, 0.45, 1.15);
  flame.visible = false;
  root.add(chassisMesh, steer, rear, flame);
  const meshes = [chassisMesh, forkMesh, front, rear];
  meshes.forEach((m) => { m.frustumCulled = false; });

  return {
    root, steer, front, rear, flame, parts: meshes,
    dispose() { chassisGeo.dispose(); forkGeo.dispose(); frontGeo.dispose(); rearGeo.dispose(); flameGeo.dispose(); },
  };
}

// ---------------------------------------------------------------------------
// Traffic vehicles (forward = -Z, rear = +Z)
// ---------------------------------------------------------------------------
export interface VehType { w: number; l: number; sp: [number, number]; palettes: number[][] }

export const VEH: Record<string, VehType> = {
  car: { w: 1.8, l: 4.2, sp: [18, 30], palettes: [[0xf2f2f2], [0xb5bac2], [0x15151a], [0x2858c9], [0xc2272d], [0x1f8a4c], [0xe3b23c]] },
  van: { w: 1.9, l: 4.8, sp: [16, 26], palettes: [[0xf6c200, 0x111111], [0xf6c200, 0x111111], [0xffffff, 0x1d6fd6], [0xf6c200, 0x111111]] },
  bus: { w: 2.5, l: 11, sp: [14, 22], palettes: [[0xf2f2f2, 0x1d6fd6], [0xd32f2f, 0xffffff], [0x2e9f4f, 0xffffff], [0xf6c200, 0x111111]] },
  truck: { w: 2.5, l: 10, sp: [12, 20], palettes: [[0xe86a1a, 0x30343a], [0x2858c9, 0xdddddd], [0xefefef, 0xd32f2f], [0x2e9f4f, 0x30343a]] },
  bike: { w: 0.7, l: 2.0, sp: [20, 32], palettes: [[0xf08a1c, 0x222222], [0x2e9f4f, 0x222222], [0x2858c9, 0x222222], [0xd32f2f, 0x222222]] },
  keke: { w: 1.5, l: 2.6, sp: [9, 15], palettes: [[0xf6c200, 0x2e9f4f], [0xf6c200, 0x111111], [0x2e9f4f, 0xf6c200]] },
  racer: { w: 0.7, l: 2.1, sp: [34, 52], palettes: [[0xd32f2f, 0xffffff], [0x1d6fd6, 0xffffff], [0xf6c200, 0x111111], [0x2e9f4f, 0xffffff], [0xffffff, 0x111111], [0x9b4dff, 0xffffff]] },
};

const wheelsAt = (list: [number, number, number][], r: number, w: number): Part[] =>
  list.map((p) => P(G.cyl, 0x101012, p, [r, w, r], [0, 0, Math.PI / 2]));

function vehicleParts(type: string, pal: number[]): Part[] {
  const a = pal[0];
  const b = pal[1] ?? 0x222222;
  const glass = 0x16212c;
  const tail = glow(3, 0.15, 0.15);
  const head = glow(3.2, 3, 2.2);
  const shadow = (w: number, l: number) => P(G.box, 0x050505, [0, 0.012, 0], [w + 0.3, 0.01, l + 0.3]);
  switch (type) {
    case 'car':
      return [
        P(G.box, a, [0, 0.58, 0], [1.8, 0.56, 4.2]),
        P(G.box, glass, [0, 1.08, 0.15], [1.54, 0.5, 2.1]),
        P(G.box, a, [0, 1.34, 0.15], [1.5, 0.06, 1.8]),
        ...wheelsAt([[-0.85, 0.36, -1.3], [0.85, 0.36, -1.3], [-0.85, 0.36, 1.3], [0.85, 0.36, 1.3]], 0.36, 0.26),
        P(G.box, tail, [-0.65, 0.7, 2.11], [0.38, 0.14, 0.05]), P(G.box, tail, [0.65, 0.7, 2.11], [0.38, 0.14, 0.05]),
        P(G.box, head, [-0.65, 0.66, -2.11], [0.34, 0.14, 0.05]), P(G.box, head, [0.65, 0.66, -2.11], [0.34, 0.14, 0.05]),
        shadow(1.8, 4.2),
      ];
    case 'van':
      return [
        P(G.box, a, [0, 1.1, 0], [1.9, 1.5, 4.8]),
        P(G.box, b, [0, 0.82, 0], [1.93, 0.22, 4.83]),
        P(G.box, glass, [0, 1.55, -0.2], [1.93, 0.5, 3.6]),
        ...wheelsAt([[-0.9, 0.38, -1.5], [0.9, 0.38, -1.5], [-0.9, 0.38, 1.5], [0.9, 0.38, 1.5]], 0.38, 0.26),
        P(G.box, tail, [-0.7, 0.9, 2.41], [0.3, 0.2, 0.05]), P(G.box, tail, [0.7, 0.9, 2.41], [0.3, 0.2, 0.05]),
        P(G.box, head, [-0.7, 0.85, -2.41], [0.3, 0.2, 0.05]), P(G.box, head, [0.7, 0.85, -2.41], [0.3, 0.2, 0.05]),
        shadow(1.9, 4.8),
      ];
    case 'bus':
      return [
        P(G.box, a, [0, 1.55, 0], [2.5, 2.4, 11]),
        P(G.box, b, [0, 0.95, 0], [2.53, 0.3, 11.03]),
        P(G.box, glass, [0, 2.1, -0.1], [2.53, 0.8, 9.8]),
        ...wheelsAt([[-1.2, 0.5, -3.6], [1.2, 0.5, -3.6], [-1.2, 0.5, 3.3], [1.2, 0.5, 3.3], [-1.2, 0.5, 4.4], [1.2, 0.5, 4.4]], 0.5, 0.3),
        P(G.box, tail, [-0.9, 1.0, 5.51], [0.4, 0.25, 0.05]), P(G.box, tail, [0.9, 1.0, 5.51], [0.4, 0.25, 0.05]),
        P(G.box, head, [-0.9, 1.0, -5.51], [0.4, 0.25, 0.05]), P(G.box, head, [0.9, 1.0, -5.51], [0.4, 0.25, 0.05]),
        shadow(2.5, 11),
      ];
    case 'truck':
      return [
        P(G.box, a, [0, 1.1, -3.7], [2.4, 2.0, 2.6]),
        P(G.box, glass, [0, 1.55, -4.5], [2.42, 0.7, 1.2]),
        P(G.box, b, [0, 2.0, 1.1], [2.5, 3.0, 7.2]),
        P(G.box, 0x23262b, [0, 0.62, 0.3], [2.3, 0.3, 9.2]),
        ...wheelsAt([[-1.15, 0.5, -3.6], [1.15, 0.5, -3.6], [-1.15, 0.5, 2.6], [1.15, 0.5, 2.6], [-1.15, 0.5, 3.8], [1.15, 0.5, 3.8]], 0.5, 0.3),
        P(G.box, tail, [-0.9, 0.8, 4.71], [0.4, 0.2, 0.05]), P(G.box, tail, [0.9, 0.8, 4.71], [0.4, 0.2, 0.05]),
        P(G.box, head, [-0.8, 0.9, -5.01], [0.4, 0.2, 0.05]), P(G.box, head, [0.8, 0.9, -5.01], [0.4, 0.2, 0.05]),
        shadow(2.5, 10),
      ];
    case 'keke':
      return [
        P(G.box, a, [0, 0.75, 0.2], [1.4, 0.8, 2.0]),
        P(G.box, b, [0, 1.45, 0.3], [1.5, 0.08, 1.8]),
        P(G.box, glass, [0, 1.1, -0.7], [1.2, 0.5, 0.05]),
        P(G.cyl, 0x222222, [-0.65, 1.1, -0.65], [0.03, 0.7, 0.03]), P(G.cyl, 0x222222, [0.65, 1.1, -0.65], [0.03, 0.7, 0.03]),
        P(G.cyl, 0x222222, [-0.65, 1.1, 1.1], [0.03, 0.7, 0.03]), P(G.cyl, 0x222222, [0.65, 1.1, 1.1], [0.03, 0.7, 0.03]),
        ...wheelsAt([[-0.65, 0.3, 0.9], [0.65, 0.3, 0.9], [0, 0.3, -1.1]], 0.3, 0.18),
        P(G.box, tail, [0, 0.8, 1.22], [0.5, 0.14, 0.05]), P(G.box, head, [0, 0.7, -1.28], [0.3, 0.14, 0.05]),
        shadow(1.5, 2.6),
      ];
    default: // bike / racer: tiny motorcycle with rider
      return [
        P(G.box, a, [0, 0.62, 0], [0.3, 0.3, 1.1]),
        P(G.box, 0x222226, [0, 0.4, 0.1], [0.24, 0.24, 0.5]),
        P(G.box, b, [0, 1.12, 0.12], [0.3, 0.52, 0.22], [-0.3, 0, 0]),
        P(G.sph, type === 'racer' ? a : 0xeeeeee, [0, 1.52, -0.06], [0.16, 0.16, 0.18]),
        ...wheelsAt([[0, 0.31, -0.7], [0, 0.31, 0.7]], 0.31, 0.12),
        P(G.box, tail, [0, 0.8, 0.98], [0.14, 0.08, 0.04]),
        P(G.box, head, [0, 0.85, -0.82], [0.12, 0.1, 0.04]),
        ...(type === 'bike' ? [P(G.box, 0xf2f2f2, [0, 1.1, 0.5], [0.28, 0.46, 0.2], [-0.15, 0, 0]), P(G.sph, 0x333333, [0, 1.48, 0.45], [0.14, 0.14, 0.15])] : []),
        shadow(0.7, 2.0),
      ];
  }
}

const vehCache = new Map<string, THREE.BufferGeometry>();
export function vehicleGeo(type: string, variant: number): THREE.BufferGeometry {
  const pals = VEH[type].palettes;
  const idx = variant % pals.length;
  const key = type + idx;
  let g = vehCache.get(key);
  if (!g) { g = mk(vehicleParts(type, pals[idx])); vehCache.set(key, g); }
  return g;
}
export function disposeVehicleCache() { vehCache.forEach((g) => g.dispose()); vehCache.clear(); }

// ---------------------------------------------------------------------------
// Scenery props
// ---------------------------------------------------------------------------
function buildingGeo(w: number, h: number, d: number, tint: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const tile = 12; // metres per window texture tile
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 vertices each)
  const faces: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * faces[f][0]) / tile, (uv.getY(k) * faces[f][1]) / tile);
    }
  }
  const col = new Float32Array(g.attributes.position.count * 3);
  const c = new THREE.Color(tint);
  for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

export type PropKind = 'mesh' | 'bldg';
export interface PropGeo { geo: THREE.BufferGeometry; kind: PropKind }

export function buildProp(name: string): PropGeo {
  const mesh = (parts: Part[]): PropGeo => ({ geo: mk(parts), kind: 'mesh' });
  switch (name) {
    case 'acacia':
      return mesh([P(G.cyl, 0x6b4a2b, [0, 1.6, 0], [0.16, 3.2, 0.16]), P(G.sph, 0x4f7a2a, [0, 3.7, 0], [3.1, 0.85, 3.1]), P(G.sph, 0x5c8a31, [0.6, 4.1, 0.3], [1.9, 0.6, 1.9])]);
    case 'acaciaDry':
      return mesh([P(G.cyl, 0x6b5233, [0, 1.5, 0], [0.15, 3.0, 0.15]), P(G.sph, 0x8a8a3a, [0, 3.4, 0], [2.8, 0.7, 2.8])]);
    case 'palm': {
      const parts: Part[] = [P(G.cyl, 0x8a6a45, [0, 3, 0], [0.18, 6, 0.18], [0.04, 0, 0.04])];
      for (let k = 0; k < 7; k++) parts.push(P(G.box, k % 2 ? 0x2f8f3a : 0x3aa046, [Math.cos((k * Math.PI * 2) / 7) * 1.1, 6.1, Math.sin((k * Math.PI * 2) / 7) * 1.1], [0.35, 0.05, 2.4], [-0.45, (-k * Math.PI * 2) / 7 + Math.PI / 2, 0]));
      return mesh(parts);
    }
    case 'baobab':
      return mesh([P(G.cyl, 0x7a6a58, [0, 2.4, 0], [1.0, 4.8, 1.0]), P(G.cyl, 0x7a6a58, [-1.3, 5.0, 0], [0.32, 2.4, 0.32], [0, 0, 0.9]), P(G.cyl, 0x7a6a58, [1.3, 5.0, 0], [0.32, 2.4, 0.32], [0, 0, -0.9]), P(G.sph, 0x4d7a2e, [0, 6.0, 0], [3.2, 0.9, 3.2]), P(G.sph, 0x4d7a2e, [-2.1, 6.0, 0.5], [1.6, 0.6, 1.6]), P(G.sph, 0x5a8a35, [2.1, 6.0, -0.4], [1.6, 0.6, 1.6])]);
    case 'mango':
      return mesh([P(G.cyl, 0x5c4228, [0, 1.2, 0], [0.22, 2.4, 0.22]), P(G.sph, 0x2f6a2a, [0, 3.2, 0], [2.0, 1.6, 2.0])]);
    case 'pine':
      return mesh([P(G.cyl, 0x5a3f27, [0, 0.8, 0], [0.2, 1.6, 0.2]), P(G.cone, 0x1f5a32, [0, 2.6, 0], [1.8, 2.6, 1.8]), P(G.cone, 0x24683a, [0, 4.2, 0], [1.4, 2.4, 1.4]), P(G.cone, 0x2b7a44, [0, 5.6, 0], [0.9, 2.0, 0.9])]);
    case 'bush':
      return mesh([P(G.sph, 0x3f7f35, [0, 0.45, 0], [1.0, 0.7, 1.0]), P(G.sph, 0x4a8d3b, [0.7, 0.35, 0.3], [0.7, 0.5, 0.7])]);
    case 'shrub':
      return mesh([P(G.sph, 0x9a8a55, [0, 0.35, 0], [0.9, 0.5, 0.9]), P(G.sph, 0xa89a62, [0.6, 0.25, 0.2], [0.6, 0.4, 0.6])]);
    case 'cactus':
      return mesh([P(G.cyl, 0x3f7a3a, [0, 1.2, 0], [0.26, 2.4, 0.26]), P(G.cyl, 0x3f7a3a, [-0.55, 1.5, 0], [0.16, 0.9, 0.16]), P(G.box, 0x3f7a3a, [-0.35, 1.05, 0], [0.5, 0.2, 0.2]), P(G.cyl, 0x3f7a3a, [0.55, 1.9, 0], [0.16, 0.8, 0.16]), P(G.box, 0x3f7a3a, [0.35, 1.5, 0], [0.5, 0.2, 0.2])]);
    case 'rock':
      return mesh([P(G.ico, 0x7a7770, [0, 0.5, 0], [1.4, 0.9, 1.1]), P(G.ico, 0x8a867e, [1.2, 0.3, 0.4], [0.8, 0.55, 0.7])]);
    case 'boulder':
      return mesh([P(G.ico, 0x6c6a66, [0, 1.6, 0], [3.2, 2.6, 2.8]), P(G.ico, 0x7c7a75, [2.8, 0.9, 1], [1.7, 1.4, 1.5])]);
    case 'dune':
      return mesh([P(G.sph, 0xd9b36a, [0, 0, 0], [16, 4.5, 11]), P(G.sph, 0xcfa75d, [10, -0.5, 4], [10, 3, 7])]);
    case 'mesa':
      return mesh([P(G.cyl, 0xb5683a, [0, 6, 0], [11, 12, 9]), P(G.cyl, 0xc47a45, [0, 12.5, 0], [10, 1.2, 8])]);
    case 'peak':
      return mesh([P(G.cone, 0x6f7f8c, [0, 22, 0], [26, 44, 26]), P(G.cone, 0xf4f7fa, [0, 41, 0], [9, 10, 9])]);
      function buildingGeo(w: number, h: number, d: number, tint: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const tile = 12; // metres per window texture tile
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 vertices each)
  const faces: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * faces[f][0]) / tile, (uv.getY(k) * faces[f][1]) / tile);
    }
  }
  const col = new Float32Array(g.attributes.position.count * 3);
  const c = new THREE.Color(tint);
  for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

export type PropKind = 'mesh' | 'bldg';
export interface PropGeo { geo: THREE.BufferGeometry; kind: PropKind }

export function buildProp(name: string): PropGeo {
  const mesh = (parts: Part[]): PropGeo => ({ geo: mk(parts), kind: 'mesh' });
  switch (name) {
    case 'acacia':
      return mesh([P(G.cyl, 0x6b4a2b, [0, 1.6, 0], [0.16, 3.2, 0.16]), P(G.sph, 0x4f7a2a, [0, 3.7, 0], [3.1, 0.85, 3.1]), P(G.sph, 0x5c8a31, [0.6, 4.1, 0.3], [1.9, 0.6, 1.9])]);
    case 'acaciaDry':
      return mesh([P(G.cyl, 0x6b5233, [0, 1.5, 0], [0.15, 3.0, 0.15]), P(G.sph, 0x8a8a3a, [0, 3.4, 0], [2.8, 0.7, 2.8])]);
    case 'palm': {
      const parts: Part[] = [P(G.cyl, 0x8a6a45, [0, 3, 0], [0.18, 6, 0.18], [0.04, 0, 0.04])];
      for (let k = 0; k < 7; k++) parts.push(P(G.box, k % 2 ? 0x2f8f3a : 0x3aa046, [Math.cos((k * Math.PI * 2) / 7) * 1.1, 6.1, Math.sin((k * Math.PI * 2) / 7) * 1.1], [0.35, 0.05, 2.4], [-0.45, (-k * Math.PI * 2) / 7 + Math.PI / 2, 0]));
      return mesh(parts);
    }
    case 'baobab':
      return mesh([P(G.cyl, 0x7a6a58, [0, 2.4, 0], [1.0, 4.8, 1.0]), P(G.cyl, 0x7a6a58, [-1.3, 5.0, 0], [0.32, 2.4, 0.32], [0, 0, 0.9]), P(G.cyl, 0x7a6a58, [1.3, 5.0, 0], [0.32, 2.4, 0.32], [0, 0, -0.9]), P(G.sph, 0x4d7a2e, [0, 6.0, 0], [3.2, 0.9, 3.2]), P(G.sph, 0x4d7a2e, [-2.1, 6.0, 0.5], [1.6, 0.6, 1.6]), P(G.sph, 0x5a8a35, [2.1, 6.0, -0.4], [1.6, 0.6, 1.6])]);
    case 'mango':
      return mesh([P(G.cyl, 0x5c4228, [0, 1.2, 0], [0.22, 2.4, 0.22]), P(G.sph, 0x2f6a2a, [0, 3.2, 0], [2.0, 1.6, 2.0])]);
    case 'pine':
      return mesh([P(G.cyl, 0x5a3f27, [0, 0.8, 0], [0.2, 1.6, 0.2]), P(G.cone, 0x1f5a32, [0, 2.6, 0], [1.8, 2.6, 1.8]), P(G.cone, 0x24683a, [0, 4.2, 0], [1.4, 2.4, 1.4]), P(G.cone, 0x2b7a44, [0, 5.6, 0], [0.9, 2.0, 0.9])]);
    case 'bush':
      return mesh([P(G.sph, 0x3f7f35, [0, 0.45, 0], [1.0, 0.7, 1.0]), P(G.sph, 0x4a8d3b, [0.7, 0.35, 0.3], [0.7, 0.5, 0.7])]);
    case 'shrub':
      return mesh([P(G.sph, 0x9a8a55, [0, 0.35, 0], [0.9, 0.5, 0.9]), P(G.sph, 0xa89a62, [0.6, 0.25, 0.2], [0.6, 0.4, 0.6])]);
    case 'cactus':
      return mesh([P(G.cyl, 0x3f7a3a, [0, 1.2, 0], [0.26, 2.4, 0.26]), P(G.cyl, 0x3f7a3a, [-0.55, 1.5, 0], [0.16, 0.9, 0.16]), P(G.box, 0x3f7a3a, [-0.35, 1.05, 0], [0.5, 0.2, 0.2]), P(G.cyl, 0x3f7a3a, [0.55, 1.9, 0], [0.16, 0.8, 0.16]), P(G.box, 0x3f7a3a, [0.35, 1.5, 0], [0.5, 0.2, 0.2])]);
    case 'rock':
      return mesh([P(G.ico, 0x7a7770, [0, 0.5, 0], [1.4, 0.9, 1.1]), P(G.ico, 0x8a867e, [1.2, 0.3, 0.4], [0.8, 0.55, 0.7])]);
    case 'boulder':
      return mesh([P(G.ico, 0x6c6a66, [0, 1.6, 0], [3.2, 2.6, 2.8]), P(G.ico, 0x7c7a75, [2.8, 0.9, 1], [1.7, 1.4, 1.5])]);
    case 'dune':
      return mesh([P(G.sph, 0xd9b36a, [0, 0, 0], [16, 4.5, 11]), P(G.sph, 0xcfa75d, [10, -0.5, 4], [10, 3, 7])]);
    case 'mesa':
      return mesh([P(G.cyl, 0xb5683a, [0, 6, 0], [11, 12, 9]), P(G.cyl, 0xc47a45, [0, 12.5, 0], [10, 1.2, 8])]);
    case 'peak':
      return mesh([P(G.cone, 0x6f7f8c, [0, 22, 0], [26, 44, 26]), P(G.cone, 0xf4f7fa, [0, 41, 0], [9, 10, 9])]);
    case 'hill':
      return mesh([P(G.sph, 0x4f8a45, [0, 0, 0], [28, 9, 20]), P(G.sph, 0x5a9a4c, [14, -1, 8], [16, 6, 12])]);
    case 'hut':
      return mesh([P(G.cyl, 0xc9a574, [0, 1.1, 0], [2.0, 2.2, 2.0]), P(G.cone, 0x8a6a35, [0, 3.0, 0], [2.7, 1.8, 2.7]), P(G.box, 0x3a2a1c, [0, 0.8, 2.0], [0.7, 1.6, 0.1])]);
    case 'house': {
      const wall = [0xf2e9d8, 0x7fc6a4, 0x78b7e8, 0xf0b4b4][Math.floor(Math.random() * 4)];
      return mesh([P(G.box, wall, [0, 1.3, 0], [4.2, 2.6, 5.2]), P(G.box, 0x8d949c, [0, 2.7, 0], [4.8, 0.18, 5.8]), P(G.box, 0x3a2a1c, [0, 0.9, 2.62], [0.9, 1.8, 0.06]), P(G.box, 0x2a3a4a, [1.3, 1.5, 2.62], [0.8, 0.8, 0.06])]);
    }
    case 'shop':
      return mesh([P(G.box, 0xe9c46a, [0, 1.3, 0], [4.5, 2.6, 3.6]), P(G.box, 0xd32f2f, [0, 2.9, 1.9], [4.7, 0.5, 0.4]), P(G.box, 0x2a2a2e, [0, 0.9, 1.85], [3.2, 1.6, 0.05])]);
    case 'pole':
      return mesh([P(G.cyl, 0x6a5a48, [0, 4, 0], [0.12, 8, 0.12]), P(G.box, 0x5a4a38, [0, 7.6, 0], [2.4, 0.1, 0.1]), P(G.box, 0x5a4a38, [0, 6.9, 0], [1.8, 0.1, 0.1])]);
    case 'billboard':
      return mesh([P(G.cyl, 0x666b73, [-2.6, 3.5, 0], [0.16, 7, 0.16]), P(G.cyl, 0x666b73, [2.6, 3.5, 0], [0.16, 7, 0.16]), P(G.box, 0x1f2430, [0, 7.4, 0], [8, 3.8, 0.3]), P(G.box, 0xd6212e, [0, 7.4, 0.17], [7.4, 3.2, 0.05]), P(G.box, 0xffffff, [-1.6, 7.4, 0.2], [3.4, 0.5, 0.05]), P(G.box, 0x14924a, [1.8, 7.4, 0.2], [2.2, 1.6, 0.05])]);
    case 'neon':
      return mesh([P(G.cyl, 0x444a55, [0, 3.5, 0], [0.18, 7, 0.18]), P(G.box, 0x15151c, [0, 8.2, 0], [6, 3, 0.3]), P(G.box, glow(0.2, 2.4, 3), [0, 8.2, 0.17], [5.4, 0.35, 0.05]), P(G.box, glow(3, 0.3, 1.8), [0, 7.5, 0.17], [4.4, 0.35, 0.05]), P(G.box, glow(2.6, 2.0, 0.3), [0, 8.9, 0.17], [3.2, 0.35, 0.05])]);
    case 'stand':
      return mesh([P(G.box, 0x6d7480, [0, 1.5, 0], [8, 3, 22]), P(G.box, 0x7d8592, [3, 3.5, 0], [4, 2, 22]), P(G.box, 0xd6212e, [-3.9, 2.2, -5], [0.2, 1.4, 6]), P(G.box, 0xffffff, [-3.9, 2.2, 1], [0.2, 1.4, 6]), P(G.box, 0x14924a, [-3.9, 2.2, 7], [0.2, 1.4, 5]), P(G.box, 0x2f343c, [2.6, 6, 0], [9, 0.3, 23])]);
    case 'tyres': {
      const parts: Part[] = [];
      for (let k = 0; k < 3; k++) parts.push(P(G.cyl14, k % 2 ? 0xffffff : 0xd6212e, [0, 0.4 + k * 0.8, 0], [0.9, 0.7, 0.9]));
      return mesh(parts);
    }
    case 'flagpole':
      return mesh([P(G.cyl, 0xcfd3da, [0, 4, 0], [0.07, 8, 0.07]), P(G.box, 0x14924a, [0.0, 7.2, -0.6], [0.04, 0.8, 0.5]), P(G.box, 0xffffff, [0, 7.2, 0], [0.04, 0.8, 0.5]), P(G.box, 0x14924a, [0, 7.2, 0.6], [0.04, 0.8, 0.5])]);
    case 'bldgA': return { geo: buildingGeo(10, 20, 10, 0xb8c0d4), kind: 'bldg' };
    case 'bldgB': return { geo: buildingGeo(12, 38, 12, 0x9aa6c8), kind: 'bldg' };
    case 'bldgC': return { geo: buildingGeo(9, 12, 9, 0xd2c6b8), kind: 'bldg' };
    case 'bldgD': return { geo: buildingGeo(15, 52, 14, 0x8798c4), kind: 'bldg' };
    default:
      return mesh([P(G.box, 0xff00ff, [0, 1, 0], [1, 2, 1])]);
  }
}

export function lampGeo(arm: number): THREE.BufferGeometry {
  return mk([
    P(G.cyl, 0x4b5058, [0, 3.8, 0], [0.09, 7.6, 0.09]),
    P(G.box, 0x4b5058, [arm / 2, 7.55, 0], [arm, 0.1, 0.1]),
    P(G.box, glow(4, 3.6, 2.6), [arm - 0.1, 7.44, 0], [0.7, 0.14, 0.32]),
  ]);
}

export function railGeo(len: number): THREE.BufferGeometry {
  const parts: Part[] = [P(G.box, 0xc4c8ce, [0, 0.62, 0], [0.09, 0.32, len]), P(G.box, 0xc4c8ce, [0, 0.3, 0], [0.07, 0.12, len])];
  for (let z = -len / 2 + 2; z < len / 2; z += 4) parts.push(P(G.box, 0x555a62, [0, 0.4, z], [0.12, 0.8, 0.12]));
  return mk(parts);
}

export function tyreWallGeo(len: number): THREE.BufferGeometry {
  const parts: Part[] = [];
  for (let z = -len / 2 + 0.6; z < len / 2; z += 1.2) {
    const odd = Math.round((z + len / 2) / 1.2) % 2 === 0;
    parts.push(P(G.cyl14, odd ? 0xd6212e : 0xf4f4f4, [0, 0.35, z], [0.62, 0.7, 0.62]));
    parts.push(P(G.cyl14, odd ? 0xf4f4f4 : 0xd6212e, [0, 1.05, z], [0.62, 0.7, 0.62]));
  }
  return mk(parts);
}

export function sidewalkGeo(len: number, width: number): THREE.BufferGeometry {
  return mk([P(G.box, 0x6a707a, [0, 0.09, 0], [width, 0.18, len]), P(G.box, 0x8a909a, [0, 0.19, 0], [width - 0.2, 0.02, len])]);
}

export function gantryGeo(width: number, style: 'sign' | 'banner'): THREE.BufferGeometry {
  const h = 7.2;
  const half = width / 2 + 1.2;
  const parts: Part[] = [
    P(G.cyl, 0x5a606a, [-half, h / 2, 0], [0.2, h, 0.2]),
    P(G.cyl, 0x5a606a, [half, h / 2, 0], [0.2, h, 0.2]),
    P(G.box, 0x5a606a, [0, h, 0], [half * 2, 0.35, 0.35]),
  ];
  if (style === 'sign') {
    parts.push(P(G.box, 0x0d7a4a, [-width * 0.18, h - 1.3, 0.2], [width * 0.34, 1.7, 0.1]));
    parts.push(P(G.box, 0xffffff, [-width * 0.18, h - 1.3, 0.27], [width * 0.3, 0.2, 0.04]));
    parts.push(P(G.box, 0x0d7a4a, [width * 0.2, h - 1.3, 0.2], [width * 0.3, 1.7, 0.1]));
    parts.push(P(G.box, 0xffffff, [width * 0.2, h - 1.3, 0.27], [width * 0.26, 0.2, 0.04]));
  } else {
    parts.push(P(G.box, 0x14924a, [0, h - 0.9, 0.2], [width * 0.9, 1.3, 0.1]));
    parts.push(P(G.box, 0xffffff, [0, h - 0.9, 0.27], [width * 0.5, 0.55, 0.04]));
    parts.push(P(G.box, glow(3, 0.2, 0.2), [0, h - 0.1, 0.2], [width * 0.9, 0.12, 0.1]));
  }
  return mk(parts);
}

// ---------------------------------------------------------------------------
// Canvas textures
// ---------------------------------------------------------------------------
export function windowTextures(night: boolean): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  const S = 128;
  const a = document.createElement('canvas');
  const b = document.createElement('canvas');
  a.width = a.height = b.width = b.height = S;
  const x = a.getContext('2d')!;
  const y = b.getContext('2d')!;
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, S, S);
  y.fillStyle = '#000';
  y.fillRect(0, 0, S, S);
  const cols = ['#ffe9a8', '#ffd27a', '#c8e6ff', '#fff4d6'];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const px = i * 32 + 6;
      const py = j * 32 + 6;
      const lit = night ? Math.random() < 0.55 : false;
      x.fillStyle = lit ? cols[Math.floor(Math.random() * cols.length)] : night ? '#1a2238' : '#4a6a8a';
      x.fillRect(px, py, 20, 20);
      if (lit) { y.fillStyle = x.fillStyle; y.fillRect(px, py, 20, 20); }
    }
  }
  const mkTex = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: mkTex(a), emissive: mkTex(b) };
                                     }
