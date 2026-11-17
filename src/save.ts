import {
  PAINTS, paintById, ACHIEVEMENTS, BIKES, CAREER, CHALLENGES, DEFAULT_SETTINGS, MAX_UPG, UPGRADE_KEYS, bikeById, emptyStats, emptyUpg,
  generateDaily, levelFromXp, todayStr, upgradeCost,
  type AchCtx, type DailyItem, type ModeId, type Settings, type Stats, type UpgLevels, type UpgradeKey,
} from './data';
import type { RaceConfig, RaceResult } from './types';

export interface ScoreEntry { name: string; score: number; env: string; bike: string; date: string }

export interface Save {
  v: 1;
  name: string;
  selected: string;
  owned: string[];
  coins: number;
  xp: number;
  upgrades: Record<string, UpgLevels>;
  career: string[];
  challenges: string[];
  scores: Record<ModeId, ScoreEntry[]>;
  stats: Stats;
  daily: { date: string; items: DailyItem[] };
  achievements: string[];
  settings: Settings;
  paints: string[];
  paint: Record<string, string>;
}

const KEY = 'nbr3d_save_v1';

const fresh = (): Save => ({
  v: 1,
  name: 'Rider',
  selected: BIKES[0].id,
  owned: [BIKES[0].id],
  coins: 0,
  xp: 0,
  upgrades: {},
  career: [],
  challenges: [],
  scores: { traffic: [], trial: [], free: [], career: [], challenge: [], police: [], race: [] },
  stats: emptyStats(),
  daily: { date: todayStr(), items: generateDaily(todayStr()) },
  achievements: [],
  settings: { ...DEFAULT_SETTINGS },
  paints: ['stock'],
  paint: {},
});

function load(): Save {
  const base = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const s: Save = {
        ...base,
        ...p,
        scores: { ...base.scores, ...(p.scores || {}) },
        stats: { ...base.stats, ...(p.stats || {}) },
        settings: { ...base.settings, ...(p.settings || {}) },
      };
      if (!Array.isArray(s.owned) || !s.owned.length) s.owned = [BIKES[0].id];
      if (!s.owned.includes(s.selected)) s.selected = s.owned[0];
      if (!s.daily || !Array.isArray(s.daily.items)) s.daily = base.daily;
      if (!Array.isArray(s.paints) || !s.paints.includes('stock')) s.paints = ['stock', ...(Array.isArray(s.paints) ? s.paints : [])];
      if (!s.paint || typeof s.paint !== 'object') s.paint = {};
      return s;
    }
  } catch { /* corrupted or blocked storage: start fresh */ }
  return base;
}

let state: Save = load();
const listeners = new Set<() => void>();
let writeFailed = false;

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); writeFailed = false; } catch { writeFailed = true; }
}
export const storageOk = () => !writeFailed;

function ensureDaily() {
  const t = todayStr();
  if (state.daily.date !== t) state = { ...state, daily: { date: t, items: generateDaily(t) } };
}

export const store = {
  get: (): Save => { ensureDaily(); return state; },
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  update(fn: (s: Save) => Save) {
    state = fn(state);
    persist();
    listeners.forEach((l) => l());
  },
  reset() {
    state = fresh();
    persist();
    listeners.forEach((l) => l());
  },
};

export const upgradesFor = (s: Save, bikeId: string): UpgLevels => ({ ...emptyUpg(), ...(s.upgrades[bikeId] || {}) });

const achCtx = (s: Save): AchCtx => ({
  stats: s.stats, level: levelFromXp(s.xp), owned: s.owned.length, career: s.career.length, challenges: s.challenges.length,
});

/** Unlocks any newly satisfied achievements (adds their coin reward). Returns the unlocked names. */
function checkAchievements(s: Save): { s: Save; unlocked: { name: string; reward: number }[] } {
  const ctx = achCtx(s);
  const unlocked: { name: string; reward: number }[] = [];
  let coins = s.coins;
  const ids = s.achievements.slice();
  for (const a of ACHIEVEMENTS) {
    if (!ids.includes(a.id) && a.check(ctx)) {
      ids.push(a.id);
      coins += a.reward;
      unlocked.push({ name: a.name, reward: a.reward });
    }
  }
  return { s: unlocked.length ? { ...s, achievements: ids, coins } : s, unlocked };
}

export function selectBike(id: string) {
  store.update((s) => (s.owned.includes(id) ? { ...s, selected: id } : s));
}

export function buyBike(id: string): { ok: boolean; reason?: string; unlocked?: { name: string; reward: number }[] } {
  const s = store.get();
  const b = bikeById(id);
  if (s.owned.includes(id)) return { ok: false, reason: 'Already owned' };
  if (s.coins < b.price) return { ok: false, reason: 'Not enough coins' };
  let unlocked: { name: string; reward: number }[] = [];
  store.update((st) => {
    const next = { ...st, coins: st.coins - b.price, owned: [...st.owned, id], selected: id };
    const r = checkAchievements(next);
    unlocked = r.unlocked;
    return r.s;
  });
  return { ok: true, unlocked };
}

export function buyUpgrade(bikeId: string, key: UpgradeKey): { ok: boolean; reason?: string; unlocked?: { name: string; reward: number }[] } {
  const s = store.get();
  if (!s.owned.includes(bikeId)) return { ok: false, reason: 'Bike not owned' };
  const lv = upgradesFor(s, bikeId);
  if (lv[key] >= MAX_UPG) return { ok: false, reason: 'Already maxed' };
  const cost = upgradeCost(bikeById(bikeId), key, lv[key]);
  if (s.coins < cost) return { ok: false, reason: 'Not enough coins' };
  let unlocked: { name: string; reward: number }[] = [];
  store.update((st) => {
    const next: Save = {
      ...st,
      coins: st.coins - cost,
      upgrades: { ...st.upgrades, [bikeId]: { ...lv, [key]: lv[key] + 1 } },
      stats: { ...st.stats, upgradesBought: st.stats.upgradesBought + 1 },
    };
    const r = checkAchievements(next);
    unlocked = r.unlocked;
    return r.s;
  });
  return { ok: true, unlocked };
}

export function buyPaint(id: string): { ok: boolean; reason?: string } {
  const s = store.get();
  const p = PAINTS.find((x) => x.id === id);
  if (!p) return { ok: false, reason: 'Unknown paint' };
  if (s.paints.includes(id)) return { ok: true };
  if (s.coins < p.price) return { ok: false, reason: 'Not enough coins' };
  store.update((st) => ({ ...st, coins: st.coins - p.price, paints: [...st.paints, id] }));
  return { ok: true };
}

export function setPaint(bikeId: string, paintId: string) {
  store.update((s) => (s.paints.includes(paintId) && s.owned.includes(bikeId) ? { ...s, paint: { ...s.paint, [bikeId]: paintId } } : s));
}
export const paintFor = (s: Save, bikeId: string) => paintById(s.paint[bikeId] || 'stock').id;

export function claimDaily(index: number): { ok: boolean; reward: number; unlocked: { name: string; reward: number }[] } {
  const s = store.get();
  const it = s.daily.items[index];
  if (!it || it.claimed || it.progress < it.target) return { ok: false, reward: 0, unlocked: [] };
  let unlocked: { name: string; reward: number }[] = [];
  store.update((st) => {
    const items = st.daily.items.map((d, i) => (i === index ? { ...d, claimed: true } : d));
    const next: Save = {
      ...st, coins: st.coins + it.reward, daily: { ...st.daily, items },
      stats: { ...st.stats, dailyClaimed: st.stats.dailyClaimed + 1 },
    };
    const r = checkAchievements(next);
    unlocked = r.unlocked;
    return r.s;
  });
  return { ok: true, reward: it.reward, unlocked };
}

export const dailyClaimable = (s: Save) => s.daily.items.some((d) => !d.claimed && d.progress >= d.target);

export interface RaceSummary {
  coinsPicked: number;
  coinsBonus: number;
  missionReward: number;
  xp: number;
  level: number;
  levelUp: boolean;
  newBest: boolean;
  best: number;
  rank: number; // 1-based position on local leaderboard, 0 if not placed
  achievements: { name: string; reward: number }[];
  missionNew: boolean; // first-time completion
}

export function coinsBonusFor(score: number): number { return Math.floor(score / 400); }
export function xpFor(score: number): number { return Math.floor(score / 40); }

/** Applies the outcome of a race to the persistent save. Rewards only come from actual riding. */
export function finalizeRace(res: RaceResult, cfg: RaceConfig): RaceSummary {
  let summary!: RaceSummary;
  store.update((st0) => {
    const st = st0;
    const coinsBonus = coinsBonusFor(res.score) + (res.bonus || 0);
    const xpBase = xpFor(res.score);
    let missionReward = 0;
    let missionXp = 0;
    let missionNew = false;
    let career = st.career;
    let challenges = st.challenges;
    if (cfg.mission && res.success) {
      const list = cfg.mode === 'career' ? career : challenges;
      if (!list.includes(cfg.mission.id)) {
        missionNew = true;
        missionReward = cfg.mission.reward;
        missionXp = cfg.mission.xp;
        if (cfg.mode === 'career') career = [...career, cfg.mission.id];
        else challenges = [...challenges, cfg.mission.id];
      }
    }
    const xpGain = xpBase + missionXp;
    const prevLevel = levelFromXp(st.xp);
    const xp = st.xp + xpGain;
    const level = levelFromXp(xp);
    const levelUp = level > prevLevel;
    const levelCoins = levelUp ? (level - prevLevel) * 200 : 0;

    // Leaderboard / best (needs real riding: score > 0)
    const scores = { ...st.scores };
    const prevBest = Math.max(0, ...(scores[res.mode] || []).map((e) => e.score));
    let rank = 0;
    let newBest = false;
    if (res.score > 0) {
      const entry: ScoreEntry = { name: st.name, score: Math.round(res.score), env: res.env, bike: cfg.bike.name, date: todayStr() };
      const list = [...(scores[res.mode] || []), entry].sort((a, b) => b.score - a.score).slice(0, 10);
      scores[res.mode] = list;
      rank = list.indexOf(entry) + 1;
      newBest = res.score > prevBest;
    }

    // Stats
    const stats: Stats = {
      ...st.stats,
      races: st.stats.races + (res.distance > 50 ? 1 : 0),
      distance: st.stats.distance + res.distance,
      overtakes: st.stats.overtakes + res.overtakes,
      nearMisses: st.stats.nearMisses + res.nearMisses,
      coinsCollected: st.stats.coinsCollected + res.coins,
      topSpeed: Math.max(st.stats.topSpeed, res.topSpeed),
      evades: st.stats.evades + (res.evades || 0),
      podiums: st.stats.podiums + (res.position && res.position <= 3 ? 1 : 0),
    };

    // Daily progress
    const items = st.daily.items.map((d) => {
      if (d.claimed) return d;
      let p = d.progress;
      switch (d.kind) {
        case 'overtake': p += res.overtakes; break;
        case 'coins': p += res.coins; break;
        case 'distance': p += res.distance / 1000; break;
        case 'nearmiss': p += res.nearMisses; break;
        case 'races': p += res.distance > 50 ? 1 : 0; break;
        case 'speed': p = Math.max(p, res.topSpeed); break;
      }
      return { ...d, progress: Math.min(d.target, Math.round(p * 100) / 100) };
    });

    let next: Save = {
      ...st,
      coins: st.coins + res.coins + coinsBonus + missionReward + levelCoins,
      xp, career, challenges, scores, stats,
      daily: { ...st.daily, items },
    };
    const ach = checkAchievements(next);
    next = ach.s;
    summary = {
      coinsPicked: res.coins, coinsBonus: coinsBonus + levelCoins, missionReward, xp: xpGain, level, levelUp,
      newBest, best: Math.max(prevBest, Math.round(res.score)), rank, achievements: ach.unlocked, missionNew,
    };
    return next;
  });
  return summary;
}

export const careerUnlocked = (s: Save, idx: number) => idx === 0 || s.career.includes(CAREER[idx - 1].id);
export const careerDone = (s: Save, idx: number) => s.career.includes(CAREER[idx].id);
export const challengeDone = (s: Save, idx: number) => s.challenges.includes(CHALLENGES[idx].id);
export const bestOverall = (s: Save) => Math.max(0, ...Object.values(s.scores).flat().map((e) => e.score));
export { UPGRADE_KEYS };
