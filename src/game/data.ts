// Static game data: bikes, upgrades, environments, missions, achievements.

export type Quality = 'low' | 'medium' | 'high';
export type Lang = 'en' | 'ha' | 'yo' | 'ig' | 'pcm';
export type UpgradeKey = 'engine' | 'speed' | 'accel' | 'brakes' | 'handling' | 'nitro';
export type Category = 'Sport' | 'Super' | 'Street' | 'Racing';
export type EnvId = 'highway' | 'desert' | 'village' | 'city' | 'mountain' | 'circuit';
export type ModeId = 'traffic' | 'trial' | 'free' | 'career' | 'challenge';
export type ObjKind = 'distance' | 'overtake' | 'nearmiss' | 'coins' | 'speed' | 'score' | 'survive';

export interface Settings {
  quality: Quality;
  sfx: number; // 0..1
  music: number; // 0..1
  sensitivity: number; // 0.5..1.5
  camera: number; // 0 chase, 1 close, 2 high, 3 helmet
  fov: number; // base fov
  shake: boolean;
  autoThrottle: boolean;
  vibrate: boolean;
  lang: Lang;
}

export const DEFAULT_SETTINGS: Settings = {
  quality: 'medium',
  sfx: 0.8,
  music: 0.5,
  sensitivity: 1,
  camera: 0,
  fov: 62,
  shake: true,
  autoThrottle: false,
  vibrate: true,
  lang: 'en',
};

export const UPGRADE_KEYS: UpgradeKey[] = ['engine', 'speed', 'accel', 'brakes', 'handling', 'nitro'];
export const MAX_UPG = 5;

export const UPGRADES: Record<UpgradeKey, { name: string; desc: string; base: number }> = {
  engine: { name: 'Engine', desc: '+4% power and top speed per level', base: 400 },
  speed: { name: 'Max Speed', desc: '+3% top speed per level', base: 300 },
  accel: { name: 'Acceleration', desc: '+5% acceleration per level', base: 300 },
  brakes: { name: 'Brakes', desc: '+6% braking per level', base: 200 },
  handling: { name: 'Handling', desc: '+5% steering response per level', base: 250 },
  nitro: { name: 'Nitro Capacity', desc: '+10% nitro tank per level', base: 250 },
};

export type UpgLevels = Record<UpgradeKey, number>;
export const emptyUpg = (): UpgLevels => ({ engine: 0, speed: 0, accel: 0, brakes: 0, handling: 0, nitro: 0 });

export const upgradeCost = (bike: BikeDef, key: UpgradeKey, level: number): number => {
  const tier = 1 + BIKES.indexOf(bike) * 0.15;
  return Math.round((UPGRADES[key].base * Math.pow(level + 1, 1.6) * tier) / 10) * 10;
};

export interface BikeDef {
  id: string;
  name: string;
  cat: Category;
  price: number;
  color: string;
  accent: string;
  speed: number; // km/h top speed
  accel: number; // m/s^2
  handling: number; // 0..1
  brake: number; // m/s^2
  nitro: number; // seconds of boost
  desc: string;
}

// Original designs — no real-world brand names or logos.
export const BIKES: BikeDef[] = [
  { id: 'eko-runner', name: 'Eko Runner', cat: 'Sport', price: 0, color: '#d6212e', accent: '#f4f4f4', speed: 175, accel: 5.6, handling: 0.72, brake: 14, nitro: 3, desc: 'Reliable starter sport bike.' },
  { id: 'okada-max', name: 'Okada Max', cat: 'Street', price: 1200, color: '#14924a', accent: '#f4f4f4', speed: 160, accel: 5.2, handling: 0.86, brake: 13, nitro: 2.5, desc: 'Nimble street bike built for tight gaps.' },
  { id: 'savanna-s', name: 'Savanna S', cat: 'Sport', price: 2500, color: '#f08a1c', accent: '#1b1b1f', speed: 205, accel: 6.4, handling: 0.75, brake: 15, nitro: 3.5, desc: 'Balanced sport bike with strong pickup.' },
  { id: 'harmattan-400', name: 'Harmattan 400', cat: 'Street', price: 4000, color: '#2f7bf0', accent: '#e8eef8', speed: 195, accel: 6.1, handling: 0.84, brake: 15, nitro: 3.5, desc: 'Fast naked street bike, superb in traffic.' },
  { id: 'zuma-z1', name: 'Zuma Z1', cat: 'Super', price: 8000, color: '#16161a', accent: '#e11d2e', speed: 255, accel: 8.2, handling: 0.78, brake: 17, nitro: 5, desc: 'Black-and-red superbike with big power.' },
  { id: 'niger-dart', name: 'Niger Dart RR', cat: 'Racing', price: 9500, color: '#0a8a4b', accent: '#ffffff', speed: 270, accel: 9.4, handling: 0.9, brake: 19, nitro: 5, desc: 'Track-bred racer in green and white.' },
  { id: 'falcon-x1000', name: 'Falcon X1000', cat: 'Super', price: 15000, color: '#c9ced6', accent: '#d6212e', speed: 290, accel: 9.4, handling: 0.82, brake: 18, nitro: 6, desc: 'Silver flagship superbike.' },
  { id: 'obudu-phantom', name: 'Obudu Phantom', cat: 'Racing', price: 25000, color: '#6d3fd6', accent: '#f4d03f', speed: 320, accel: 10.6, handling: 0.93, brake: 21, nitro: 7, desc: 'The fastest machine in the garage.' },
];

export const bikeById = (id: string): BikeDef => BIKES.find((b) => b.id === id) || BIKES[0];

export interface EnvInfo {
  id: EnvId;
  name: string;
  desc: string;
  unlockLevel: number;
  color: string;
}

export const ENVS: EnvInfo[] = [
  { id: 'highway', name: 'Nigerian Expressway', desc: 'Wide modern highway, palm trees and billboards.', unlockLevel: 1, color: '#2d9cdb' },
  { id: 'city', name: 'Modern City Road', desc: 'Neon night racing between glowing towers.', unlockLevel: 2, color: '#7b5cff' },
  { id: 'village', name: 'Rural Village Road', desc: 'Narrow two-way road past huts and baobabs.', unlockLevel: 3, color: '#4caf50' },
  { id: 'desert', name: 'Northern Desert Road', desc: 'Long sun-baked road through the Sahel.', unlockLevel: 4, color: '#e0a847' },
  { id: 'mountain', name: 'Mountain Pass', desc: 'Winding two-way road with guard rails.', unlockLevel: 6, color: '#78909c' },
  { id: 'circuit', name: 'Pro Racing Circuit', desc: 'Kerbs, tyre walls and rival racers.', unlockLevel: 8, color: '#e53935' },
];

export const envInfo = (id: EnvId): EnvInfo => ENVS.find((e) => e.id === id) || ENVS[0];

export interface Mission {
  id: string;
  title: string;
  env: EnvId;
  kind: ObjKind;
  target: number;
  time?: number; // seconds limit (countdown)
  reward: number;
  xp: number;
}

export const objectiveText = (m: { kind: ObjKind; target: number }): string => {
  switch (m.kind) {
    case 'distance': return `Ride ${(m.target / 1000).toFixed(m.target % 1000 ? 1 : 0)} km`;
    case 'overtake': return `Overtake ${m.target} vehicles`;
    case 'nearmiss': return `${m.target} near misses`;
    case 'coins': return `Collect ${m.target} coins`;
    case 'speed': return `Reach ${m.target} km/h`;
    case 'score': return `Score ${m.target.toLocaleString()}`;
    case 'survive': return `Survive ${m.target} seconds`;
  }
};

export const CAREER: Mission[] = [
  { id: 'c1', title: 'First Ride', env: 'highway', kind: 'distance', target: 1500, time: 80, reward: 300, xp: 60 },
  { id: 'c2', title: 'Weave & Win', env: 'highway', kind: 'overtake', target: 10, time: 70, reward: 400, xp: 80 },
  { id: 'c3', title: 'City Coins', env: 'city', kind: 'coins', target: 40, time: 90, reward: 450, xp: 90 },
  { id: 'c4', title: 'Village Dash', env: 'village', kind: 'distance', target: 2500, time: 100, reward: 500, xp: 110 },
  { id: 'c5', title: 'Razor Gaps', env: 'highway', kind: 'nearmiss', target: 5, time: 90, reward: 600, xp: 130 },
  { id: 'c6', title: 'Desert Speed', env: 'desert', kind: 'speed', target: 200, time: 60, reward: 700, xp: 150 },
  { id: 'c7', title: 'Downtown Rush', env: 'city', kind: 'overtake', target: 25, time: 90, reward: 800, xp: 170 },
  { id: 'c8', title: 'Pass Run', env: 'mountain', kind: 'distance', target: 3500, time: 120, reward: 1000, xp: 200 },
  { id: 'c9', title: 'Sahel Score', env: 'desert', kind: 'score', target: 15000, time: 120, reward: 1100, xp: 230 },
  { id: 'c10', title: 'Circuit Blitz', env: 'circuit', kind: 'distance', target: 5000, time: 100, reward: 1300, xp: 280 },
  { id: 'c11', title: 'Mountain King', env: 'mountain', kind: 'overtake', target: 30, time: 120, reward: 1500, xp: 320 },
  { id: 'c12', title: 'Top Speed Legend', env: 'circuit', kind: 'speed', target: 280, time: 90, reward: 2000, xp: 400 },
];

export const CHALLENGES: Mission[] = [
  { id: 'x1', title: 'The Weaver', env: 'highway', kind: 'overtake', target: 20, time: 60, reward: 350, xp: 70 },
  { id: 'x2', title: 'Close Shave', env: 'city', kind: 'nearmiss', target: 8, time: 90, reward: 500, xp: 100 },
  { id: 'x3', title: 'Nitro Rush', env: 'desert', kind: 'speed', target: 220, time: 60, reward: 500, xp: 100 },
  { id: 'x4', title: 'Coin Hunter', env: 'village', kind: 'coins', target: 80, time: 90, reward: 600, xp: 120 },
  { id: 'x5', title: 'Iron Nerve', env: 'city', kind: 'survive', target: 120, reward: 700, xp: 140 },
  { id: 'x6', title: 'High Scorer', env: 'mountain', kind: 'score', target: 12000, time: 100, reward: 800, xp: 160 },
  { id: 'x7', title: 'Circuit Sprint', env: 'circuit', kind: 'distance', target: 3000, time: 45, reward: 900, xp: 180 },
  { id: 'x8', title: 'Speed Demon', env: 'highway', kind: 'speed', target: 260, time: 90, reward: 1000, xp: 200 },
];

// ---- Daily missions -------------------------------------------------------
export type DailyKind = 'overtake' | 'coins' | 'distance' | 'nearmiss' | 'races' | 'speed';
export interface DailyDef {
  kind: DailyKind;
  label: (t: number) => string;
  targets: number[];
  rewards: number[];
}
export const DAILY_POOL: DailyDef[] = [
  { kind: 'overtake', label: (t) => `Overtake ${t} vehicles`, targets: [20, 40, 70], rewards: [150, 300, 500] },
  { kind: 'coins', label: (t) => `Collect ${t} coins`, targets: [40, 80, 150], rewards: [150, 300, 500] },
  { kind: 'distance', label: (t) => `Ride ${t} km in total`, targets: [3, 6, 10], rewards: [150, 300, 500] },
  { kind: 'nearmiss', label: (t) => `Make ${t} near misses`, targets: [5, 12, 20], rewards: [200, 350, 550] },
  { kind: 'races', label: (t) => `Finish ${t} races`, targets: [2, 4, 6], rewards: [100, 200, 350] },
  { kind: 'speed', label: (t) => `Reach ${t} km/h`, targets: [140, 200, 250], rewards: [150, 300, 500] },
];

export interface DailyItem { kind: DailyKind; target: number; reward: number; progress: number; claimed: boolean }

export function todayStr(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function seeded(str: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDaily(date: string): DailyItem[] {
  const r = seeded('nbr3d-' + date);
  const pool = DAILY_POOL.slice();
  const out: DailyItem[] = [];
  const tiers = [0, 1, 2];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(r() * pool.length);
    const def = pool.splice(idx, 1)[0];
    const tier = tiers[i];
    out.push({ kind: def.kind, target: def.targets[tier], reward: def.rewards[tier], progress: 0, claimed: false });
  }
  return out;
}

export const dailyLabel = (d: DailyItem): string => DAILY_POOL.find((p) => p.kind === d.kind)!.label(d.target);

// ---- Levels ---------------------------------------------------------------
export const xpForLevel = (level: number): number => 75 * level * (level - 1); // cumulative xp needed to *reach* level
export function levelFromXp(xp: number): number {
  let l = 1;
  while (xpForLevel(l + 1) <= xp) l++;
  return l;
}

// ---- Stats & achievements -------------------------------------------------
export interface Stats {
  races: number;
  distance: number; // metres
  overtakes: number;
  nearMisses: number;
  coinsCollected: number;
  topSpeed: number; // km/h
  dailyClaimed: number;
  upgradesBought: number;
}
export const emptyStats = (): Stats => ({ races: 0, distance: 0, overtakes: 0, nearMisses: 0, coinsCollected: 0, topSpeed: 0, dailyClaimed: 0, upgradesBought: 0 });

export interface AchCtx { stats: Stats; level: number; owned: number; career: number; challenges: number }
export interface AchDef { id: string; name: string; desc: string; reward: number; check: (c: AchCtx) => boolean; progress: (c: AchCtx) => [number, number] }

const mk = (id: string, name: string, desc: string, reward: number, val: (c: AchCtx) => number, goal: number): AchDef => ({
  id, name, desc, reward, check: (c) => val(c) >= goal, progress: (c) => [Math.min(val(c), goal), goal],
});

export const ACHIEVEMENTS: AchDef[] = [
  mk('first', 'First Ride', 'Finish your first race', 100, (c) => c.stats.races, 1),
  mk('races25', 'Regular Rider', 'Finish 25 races', 500, (c) => c.stats.races, 25),
  mk('dist50', 'Road Warrior', 'Ride 50 km in total', 400, (c) => c.stats.distance / 1000, 50),
  mk('dist250', 'Cross-Country', 'Ride 250 km in total', 1500, (c) => c.stats.distance / 1000, 250),
  mk('ot100', 'Overtaker', 'Overtake 100 vehicles', 300, (c) => c.stats.overtakes, 100),
  mk('ot500', 'Traffic Master', 'Overtake 500 vehicles', 1200, (c) => c.stats.overtakes, 500),
  mk('nm50', 'Needle Threader', 'Make 50 near misses', 500, (c) => c.stats.nearMisses, 50),
  mk('spd200', 'Fast Lane', 'Reach 200 km/h', 300, (c) => c.stats.topSpeed, 200),
  mk('spd280', 'Speed Demon', 'Reach 280 km/h', 1500, (c) => c.stats.topSpeed, 280),
  mk('coin1000', 'Coin Collector', 'Pick up 1,000 coins on the road', 600, (c) => c.stats.coinsCollected, 1000),
  mk('lvl5', 'Rising Star', 'Reach level 5', 400, (c) => c.level, 5),
  mk('lvl10', 'Veteran', 'Reach level 10', 1200, (c) => c.level, 10),
  mk('own3', 'Collector', 'Own 3 motorcycles', 500, (c) => c.owned, 3),
  mk('upg10', 'Tuner', 'Buy 10 upgrades', 500, (c) => c.stats.upgradesBought, 10),
  mk('career6', 'Career Rider', 'Complete 6 career missions', 800, (c) => c.career, 6),
  mk('career12', 'Champion', 'Complete all 12 career missions', 3000, (c) => c.career, 12),
  mk('chal8', 'Challenger', 'Complete all 8 challenges', 2000, (c) => c.challenges, 8),
  mk('daily5', 'Dedicated', 'Claim 5 daily missions', 600, (c) => c.stats.dailyClaimed, 5),
];

export const MODE_NAMES: Record<ModeId, string> = {
  traffic: 'Traffic Racing',
  trial: 'Time Trial',
  free: 'Free Ride',
  career: 'Career',
  challenge: 'Challenge',
};

// ---- Derived bike performance --------------------------------------------
export interface BikeStats { vmax: number; kmh: number; acc: number; brk: number; nitro: number; hand: number }
export function computeStats(b: BikeDef, u: UpgLevels): BikeStats {
  const kmh = b.speed * (1 + 0.03 * u.speed + 0.04 * u.engine);
  return {
    kmh,
    vmax: kmh / 3.6,
    acc: b.accel * (1 + 0.05 * u.accel + 0.04 * u.engine),
    brk: b.brake * (1 + 0.06 * u.brakes),
    nitro: b.nitro * (1 + 0.1 * u.nitro),
    hand: Math.min(1.1, b.handling * (1 + 0.05 * u.handling)),
  };
}
