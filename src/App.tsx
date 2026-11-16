import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Engine } from './game/engine';
import { audio } from './game/audio';
import {
  ACHIEVEMENTS, BIKES, CAREER, CHALLENGES, ENVS, MAX_UPG, MODE_NAMES, UPGRADES, UPGRADE_KEYS, bikeById, computeStats, dailyLabel,
  envInfo, levelFromXp, objectiveText, upgradeCost, xpForLevel,
  type BikeDef, type Category, type EnvId, type Mission, type ModeId, type Settings, type UpgradeKey,
} from './game/data';
import { LANGS, tr, type TKey } from './game/i18n';
import {
  bestOverall, buyBike, buyUpgrade, careerDone, careerUnlocked, challengeDone, claimDaily, dailyClaimable, finalizeRace,
  selectBike, store, storageOk, upgradesFor, type RaceSummary,
} from './game/save';
import type { Hud, RaceConfig, RaceResult, Toast } from './game/types';
import { Bar, Btn, Icon, fmtNum, fmtTime, sfxClick, type IconName } from './ui';

type Screen = 'loading' | 'menu' | 'modes' | 'career' | 'challenge' | 'garage' | 'upgrades' | 'achievements' | 'leaderboard' | 'settings' | 'race' | 'error';
interface Notice { id: number; title: string; sub: string; icon: IconName }
interface ToastItem extends Toast { id: number }
interface RaceEnd { res: RaceResult; sum: RaceSummary; cfg: RaceConfig }

const CAMERAS = ['Chase', 'Close', 'High', 'Helmet'];

export default function App() {
  const save = useSyncExternalStore(store.subscribe, store.get, store.get);
  const S = save.settings;
  const t = useCallback((k: TKey) => tr(S.lang, k), [S.lang]);
  const level = levelFromXp(save.xp);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const cfgRef = useRef<RaceConfig | null>(null);

  const [screen, setScreen] = useState<Screen>('loading');
  const [ready, setReady] = useState(false);
  const [loadPct, setLoadPct] = useState(0);
  const [hud, setHud] = useState<Hud | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [paused, setPaused] = useState(false);
  const [end, setEnd] = useState<RaceEnd | null>(null);
  const [env, setEnv] = useState<EnvId>('highway');
  const [previewId, setPreviewId] = useState(save.selected);
  const [installEvt, setInstallEvt] = useState<Event | null>(null);
  const idRef = useRef(1);

  const notify = useCallback((title: string, sub: string, icon: IconName = 'star') => {
    const id = idRef.current++;
    setNotices((n) => [...n, { id, title, sub, icon }]);
    setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), 3600);
  }, []);

  // ---- engine lifecycle --------------------------------------------------
  const handlers = useRef({
    hud: (h: Hud) => setHud(h),
    toast: (x: Toast) => { const id = idRef.current++; setToasts((l) => [...l.slice(-3), { ...x, id }]); setTimeout(() => setToasts((l) => l.filter((y) => y.id !== id)), 1100); },
    finish: (_r: RaceResult) => {},
  });

  handlers.current.finish = (res: RaceResult) => {
    const cfg = cfgRef.current;
    if (!cfg) return;
    const sum = finalizeRace(res, cfg);
    setEnd({ res, sum, cfg });
    setPaused(false);
    if (res.success) audio.sfx('success');
    else if (res.reason === 'crash') audio.sfx('nope');
    if (sum.levelUp) { audio.sfx('levelup'); notify(`Level ${sum.level}!`, 'Level-up bonus coins added', 'star'); }
    sum.achievements.forEach((a) => notify('Achievement unlocked', `${a.name} +${a.reward} coins`, 'medal'));
  };

  useEffect(() => {
    let eng: Engine | null = null;
    let cancelled = false;
    try {
      eng = new Engine(canvasRef.current!, store.get().settings, {
        onHud: (h) => handlers.current.hud(h),
        onToast: (x) => handlers.current.toast(x),
        onFinish: (r) => handlers.current.finish(r),
        onVibrate: (ms) => { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } },
      });
      engineRef.current = eng;
      eng.showBike(bikeById(store.get().selected), 'menu');
    } catch (e) {
      console.error(e);
      setScreen('error');
      return;
    }
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(100, p + 7 + Math.random() * 9);
      setLoadPct(p);
      if (p >= 100 && !cancelled) { clearInterval(iv); setTimeout(() => { setReady(true); setScreen((s) => (s === 'loading' ? 'menu' : s)); }, 250); }
    }, 90);
    const onInstall = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => {
      cancelled = true;
      clearInterval(iv);
      window.removeEventListener('beforeinstallprompt', onInstall);
      eng?.dispose();
      engineRef.current = null;
    };
  }, []);

  // push settings to engine + audio
  useEffect(() => {
    engineRef.current?.setSettings(S);
    audio.setVolumes(S.sfx, S.music);
  }, [S]);

  // unlock audio on first interaction
  useEffect(() => {
    const unlock = () => {
      audio.unlock();
      audio.setVolumes(store.get().settings.sfx, store.get().settings.music);
      if (screenRef.current !== 'race') audio.startMusic('menu');
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);
  const screenRef = useRef<Screen>('loading');
  screenRef.current = screen;

  // keep 3D showroom in sync with menus
  useEffect(() => {
    const e = engineRef.current;
    if (!e || !ready || screen === 'race' || screen === 'error' || screen === 'loading') return;
    const id = screen === 'garage' || screen === 'upgrades' ? previewId : save.selected;
    e.showBike(bikeById(id), screen === 'menu' ? 'menu' : 'garage');
    audio.startMusic('menu');
  }, [screen, previewId, save.selected, ready]);

  // auto-pause when tab hidden
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && screenRef.current === 'race' && engineRef.current && !endRef.current) { engineRef.current.setPaused(true); setPaused(true); }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);
  const endRef = useRef<RaceEnd | null>(null);
  endRef.current = end;

  // ---- actions -----------------------------------------------------------
  const go = (s: Screen) => { setScreen(s); };

  const begin = useCallback((mode: ModeId, envId: EnvId, mission?: Mission) => {
    const e = engineRef.current;
    if (!e) return;
    const s = store.get();
    const bike = bikeById(s.selected);
    const cfg: RaceConfig = { mode, env: envId, bike, upg: upgradesFor(s, bike.id), mission };
    cfgRef.current = cfg;
    setEnd(null);
    setPaused(false);
    setHud(null);
    setToasts([]);
    audio.unlock();
    e.startRace(cfg);
    setScreen('race');
  }, []);

  const togglePause = useCallback(() => {
    const e = engineRef.current;
    if (!e || endRef.current) return;
    const next = !e.paused;
    e.setPaused(next);
    setPaused(next);
  }, []);

  // Escape: pause in race, back elsewhere
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.code !== 'Escape') return;
      const sc = screenRef.current;
      if (sc === 'race') togglePause();
      else if (sc !== 'menu' && sc !== 'loading' && sc !== 'error') setScreen('menu');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePause]);

  const toMenu = () => { setEnd(null); setPaused(false); setScreen('menu'); };
  const retry = () => { setEnd(null); setPaused(false); setHud(null); engineRef.current?.restart(); };

  const upd = (patch: Partial<Settings>) => store.update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

  const toggleFull = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else {
        const so = window.screen.orientation as unknown as { lock?: (o: string) => Promise<void> };
        void Promise.resolve(document.documentElement.requestFullscreen?.())
          .then(() => so?.lock?.('landscape'))
          .catch(() => {});
      }
    } catch { /* not supported */ }
  };

  const installApp = async () => {
    const ev = installEvt as unknown as { prompt?: () => Promise<void> } | null;
    if (ev?.prompt) { await ev.prompt(); setInstallEvt(null); }
  };

  const owned = save.owned;
  const dailyDot = dailyClaimable(save);

  // ---- render ----------------------------------------------------------
  const racing = screen === 'race';
  return (
    <div className={`app screen-${screen}`} onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={canvasRef} className="gl" />
      {!racing && screen !== 'loading' && screen !== 'error' && <div className={`veil ${screen === 'menu' ? 'light' : ''}`} />}

      {screen === 'loading' && <Loading pct={loadPct} />}
      {screen === 'error' && (
        <div className="panel center errbox">
          <h2>3D graphics unavailable</h2>
          <p>This browser could not start WebGL. Update Chrome or enable hardware acceleration, then reload.</p>
          <Btn kind="primary" onClick={() => location.reload()}>Reload</Btn>
        </div>
      )}

      {screen === 'menu' && (
        <MainMenu
          t={t} save={save} level={level} dailyDot={dailyDot} canInstall={!!installEvt}
          onInstall={installApp} onFull={toggleFull}
          onNav={(s) => go(s)}
          onQuick={(m) => begin(m, env)}
        />
      )}

      {screen === 'modes' && (
        <Page title={t('play')} onBack={() => go('menu')} t={t} save={save} level={level}>
          <div className="env-grid">
            {ENVS.map((e) => {
              const lock = level < e.unlockLevel;
              return (
                <button key={e.id} type="button" className={`env-card ${env === e.id ? 'on' : ''} ${lock ? 'locked' : ''}`} style={{ ['--c' as string]: e.color }}
                  onClick={() => { if (lock) { audio.sfx('nope'); return; } sfxClick(); setEnv(e.id); }}>
                  <b>{e.name}</b>
                  <small>{lock ? `Unlocks at level ${e.unlockLevel}` : e.desc}</small>
                  {lock && <Icon n="lock" size={20} />}
                </button>
              );
            })}
          </div>
          <div className="mode-row">
            <Btn big kind="primary" icon="car" onClick={() => begin('traffic', env)}>{t('traffic')}</Btn>
            <Btn big icon="timer" onClick={() => begin('trial', env)}>{t('trial')}</Btn>
            <Btn big icon="road" onClick={() => begin('free', env)}>{t('free')}</Btn>
            <Btn big icon="flag" onClick={() => go('career')}>{t('career')}</Btn>
            <Btn big icon="target" onClick={() => go('challenge')}>{t('challenge')}</Btn>
          </div>
        </Page>
      )}

      {screen === 'career' && (
        <MissionList title={t('career')} list={CAREER} t={t} save={save} level={level} onBack={() => go('menu')}
          unlocked={(i) => careerUnlocked(save, i)} done={(i) => careerDone(save, i)} onStart={(m) => begin('career', m.env, m)} />
      )}
      {screen === 'challenge' && (
        <MissionList title={t('challenge')} list={CHALLENGES} t={t} save={save} level={level} onBack={() => go('menu')}
          unlocked={() => true} done={(i) => challengeDone(save, i)} onStart={(m) => begin('challenge', m.env, m)} />
      )}

      {screen === 'garage' && (
        <Garage t={t} save={save} level={level} previewId={previewId} setPreview={setPreviewId} onBack={() => go('menu')}
          onUnlock={(id) => {
            const r = buyBike(id);
            if (!r.ok) { audio.sfx('nope'); notify('Cannot unlock', r.reason || '', 'lock'); return; }
            audio.sfx('buy'); notify('Bike unlocked!', bikeById(id).name, 'bike');
            r.unlocked?.forEach((a) => notify('Achievement unlocked', `${a.name} +${a.reward} coins`, 'medal'));
          }}
          onSelect={(id) => { selectBike(id); }} onUpgrade={() => go('upgrades')} />
      )}

      {screen === 'upgrades' && (
        <Upgrades t={t} save={save} level={level} previewId={previewId} setPreview={setPreviewId} onBack={() => go('menu')}
          onBuy={(id, k) => {
            const r = buyUpgrade(id, k);
            if (!r.ok) { audio.sfx('nope'); notify('Cannot upgrade', r.reason || '', 'lock'); return; }
            audio.sfx('buy');
            r.unlocked?.forEach((a) => notify('Achievement unlocked', `${a.name} +${a.reward} coins`, 'medal'));
          }} />
      )}

      {screen === 'achievements' && (
        <Achievements t={t} save={save} level={level} onBack={() => go('menu')}
          onClaim={(i) => {
            const r = claimDaily(i);
            if (r.ok) { audio.sfx('success'); notify('Daily reward', `+${r.reward} coins`, 'coin'); r.unlocked.forEach((a) => notify('Achievement unlocked', `${a.name} +${a.reward} coins`, 'medal')); }
          }} />
      )}

      {screen === 'leaderboard' && <Leaderboard t={t} save={save} level={level} onBack={() => go('menu')} onName={(n) => store.update((s) => ({ ...s, name: n.slice(0, 14) || 'Rider' }))} />}

      {screen === 'settings' && <SettingsScreen t={t} save={save} level={level} onBack={() => go('menu')} upd={upd} />}

      {racing && hud && (
        <RaceUI hud={hud} toasts={toasts} paused={paused} end={end} S={S} t={t}
          press={(k, v) => engineRef.current?.setInput(k, v)}
          onPause={togglePause} onRestart={retry} onCamera={() => engineRef.current?.cycleCamera()}
          onQuit={() => { engineRef.current?.setPaused(false); setPaused(false); engineRef.current?.quit(); }}
          onMenu={toMenu} onUpg={() => { setEnd(null); setPreviewId(save.selected); setScreen('upgrades'); }}
          onNext={(m) => begin('career', m.env, m)} upd={upd} />
      )}

      <div className="notices">
        {notices.map((n) => (
          <div key={n.id} className="notice"><Icon n={n.icon} size={26} /><div><b>{n.title}</b><small>{n.sub}</small></div></div>
        ))}
      </div>
      {!storageOk() && screen === 'menu' && <div className="warn-bar">Storage is blocked — progress will not be saved on this device.</div>}
      <span hidden>{owned.length}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Loading({ pct }: { pct: number }) {
  const tips = ['Overtake traffic and make near misses to refill nitro.', 'Collect gold coins to unlock new bikes.', 'Upgrade brakes and handling to survive busy roads.', 'Tap the camera button to switch views.'];
  const tip = useMemo(() => tips[Math.floor(Math.random() * tips.length)], []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="loading">
      <div className="flag-strip"><i /><i /><i /></div>
      <h1 className="logo"><span>NIGERIA</span><em>BIKE RACING</em><b>3D</b></h1>
      <div className="load-bar"><i style={{ width: `${pct}%` }} /></div>
      <p className="tip">{tip}</p>
      <small className="credit">Created with Ibrahim Muhammad</small>
    </div>
  );
}

function TopBar({ save, level }: { save: ReturnType<typeof store.get>; level: number }) {
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const pct = ((save.xp - base) / (next - base)) * 100;
  return (
    <div className="topbar">
      <div className="chip player"><Icon n="bike" size={18} /><b>{save.name}</b></div>
      <div className="chip lvl"><span>LV {level}</span><div className="xp"><i style={{ width: `${pct}%` }} /></div></div>
      <div className="chip coins"><Icon n="coin" size={18} /><b>{fmtNum(save.coins)}</b></div>
    </div>
  );
}

function Page({ title, children, onBack, save, level, t }: { title: string; children: React.ReactNode; onBack: () => void; save: ReturnType<typeof store.get>; level: number; t: (k: TKey) => string }) {
  return (
    <div className="page">
      <header className="page-head">
        <Btn kind="ghost" icon="back" onClick={onBack}>{t('back')}</Btn>
        <h2>{title}</h2>
        <TopBar save={save} level={level} />
      </header>
      <div className="page-body">{children}</div>
    </div>
  );
}

function MainMenu({ t, save, level, dailyDot, onNav, onQuick, onFull, onInstall, canInstall }: {
  t: (k: TKey) => string; save: ReturnType<typeof store.get>; level: number; dailyDot: boolean;
  onNav: (s: Screen) => void; onQuick: (m: ModeId) => void; onFull: () => void; onInstall: () => void; canInstall: boolean;
}) {
  const best = bestOverall(save);
  const items: { k: TKey; icon: IconName; act: () => void; dot?: boolean }[] = [
    { k: 'career', icon: 'flag', act: () => onNav('career') },
    { k: 'traffic', icon: 'car', act: () => onQuick('traffic') },
    { k: 'trial', icon: 'timer', act: () => onQuick('trial') },
    { k: 'free', icon: 'road', act: () => onQuick('free') },
    { k: 'garage', icon: 'bike', act: () => onNav('garage') },
    { k: 'upgrades', icon: 'up', act: () => onNav('upgrades') },
    { k: 'achievements', icon: 'medal', act: () => onNav('achievements'), dot: dailyDot },
    { k: 'leaderboard', icon: 'trophy', act: () => onNav('leaderboard') },
    { k: 'settings', icon: 'gear', act: () => onNav('settings') },
  ];
  return (
    <div className="menu">
      <TopBar save={save} level={level} />
      <div className="menu-left">
        <div className="flag-strip"><i /><i /><i /></div>
        <h1 className="logo"><span>NIGERIA</span><em>BIKE RACING</em><b>3D</b></h1>
        <Btn big kind="primary" icon="play" className="play" onClick={() => onNav('modes')}>{t('play')}</Btn>
        <div className="menu-grid">
          {items.map((i) => (
            <button key={i.k} type="button" className="tile" onClick={() => { sfxClick(); i.act(); }}>
              <Icon n={i.icon} size={22} /><span>{t(i.k)}</span>{i.dot && <i className="dot" />}
            </button>
          ))}
        </div>
        <div className="menu-foot">
          <span>Best score <b>{fmtNum(best)}</b></span>
          <span className="credit">Created with Ibrahim Muhammad</span>
        </div>
      </div>
      <div className="menu-actions">
        {canInstall && <Btn kind="ghost" icon="download" onClick={onInstall}>Install</Btn>}
        <Btn kind="ghost" icon="full" onClick={onFull}>Full screen</Btn>
      </div>
    </div>
  );
}

function MissionList({ title, list, onBack, unlocked, done, onStart, save, level, t }: {
  title: string; list: Mission[]; onBack: () => void; unlocked: (i: number) => boolean; done: (i: number) => boolean; onStart: (m: Mission) => void;
  save: ReturnType<typeof store.get>; level: number; t: (k: TKey) => string;
}) {
  return (
    <Page title={title} onBack={onBack} save={save} level={level} t={t}>
      <div className="missions">
        {list.map((m, i) => {
          const open = unlocked(i);
          const d = done(i);
          return (
            <div key={m.id} className={`mission ${open ? '' : 'locked'} ${d ? 'done' : ''}`}>
              <div className="num">{d ? <Icon n="check" size={20} /> : open ? i + 1 : <Icon n="lock" size={18} />}</div>
              <div className="info">
                <b>{m.title}</b>
                <small>{envInfo(m.env).name} · {objectiveText(m)}{m.time ? ` · ${m.time}s` : ''}</small>
                <small className="rew"><Icon n="coin" size={14} /> {fmtNum(m.reward)} · {m.xp} XP {d && '· first-clear reward claimed'}</small>
              </div>
              <Btn kind={d ? 'default' : 'primary'} disabled={!open} icon="play" onClick={() => onStart(m)}>{d ? t('retry') : t('start')}</Btn>
            </div>
          );
        })}
      </div>
    </Page>
  );
}
function StatBars({ bike, upg }: { bike: BikeDef; upg: ReturnType<typeof upgradesFor> }) {
  const base = computeStats(bike, { engine: 0, speed: 0, accel: 0, brakes: 0, handling: 0, nitro: 0 });
  const cur = computeStats(bike, upg);
  const row = (label: string, b: number, c: number, max: number, unit = '') => (
    <Bar label={`${label} ${unit ? Math.round(c) + unit : ''}`} value={b / max} bonus={(c - b) / max} />
  );
  return (
    <div className="stats">
      {row('Top Speed', base.kmh, cur.kmh, 340, ' km/h')}
      {row('Acceleration', base.acc, cur.acc, 12)}
      {row('Handling', base.hand, cur.hand, 1.1)}
      {row('Braking', base.brk, cur.brk, 24)}
      {row('Nitro', base.nitro, cur.nitro, 9, 's')}
    </div>
  );
}

function Garage({ t, save, level, previewId, setPreview, onBack, onUnlock, onSelect, onUpgrade }: {
  t: (k: TKey) => string; save: ReturnType<typeof store.get>; level: number; previewId: string; setPreview: (id: string) => void; onBack: () => void;
  onUnlock: (id: string) => void; onSelect: (id: string) => void; onUpgrade: () => void;
}) {
  const [cat, setCat] = useState<Category | 'All'>('All');
  const list = BIKES.filter((b) => cat === 'All' || b.cat === cat);
  const cur = bikeById(previewId);
  const own = save.owned.includes(cur.id);
  const sel = save.selected === cur.id;
  const idx = BIKES.findIndex((b) => b.id === cur.id);
  const cycle = (d: number) => { sfxClick(); setPreview(BIKES[(idx + d + BIKES.length) % BIKES.length].id); };
  return (
    <Page title={t('garage')} onBack={onBack} save={save} level={level} t={t}>
      <div className="garage">
        <div className="chips">
          {(['All', 'Sport', 'Super', 'Street', 'Racing'] as const).map((c) => (
            <button key={c} type="button" className={`chipbtn ${cat === c ? 'on' : ''}`} onClick={() => { sfxClick(); setCat(c); }}>{c}</button>
          ))}
        </div>
        <div className="garage-main">
          <button type="button" className="arrow" onClick={() => cycle(-1)} aria-label="Previous"><Icon n="back" size={28} /></button>
          <div className="spacer" />
          <button type="button" className="arrow" onClick={() => cycle(1)} aria-label="Next"><Icon n="next" size={28} /></button>
        </div>
        <div className="garage-panel">
          <div className="gp-head"><span className="cat">{cur.cat}</span><h3>{cur.name}</h3><small>{cur.desc}</small></div>
          <StatBars bike={cur} upg={upgradesFor(save, cur.id)} />
          <div className="gp-actions">
            {!own && <Btn kind="gold" icon="lock" disabled={save.coins < cur.price} onClick={() => onUnlock(cur.id)}>{t('unlock')} · {fmtNum(cur.price)}</Btn>}
            {own && !sel && <Btn kind="primary" icon="check" onClick={() => onSelect(cur.id)}>{t('select')}</Btn>}
            {own && sel && <Btn kind="default" icon="check" disabled>{t('selected')}</Btn>}
            {own && <Btn icon="up" onClick={() => { onSelect(cur.id); onUpgrade(); }}>{t('upgrades')}</Btn>}
            {!own && save.coins < cur.price && <small className="need">Need {fmtNum(cur.price - save.coins)} more coins</small>}
          </div>
        </div>
        <div className="bike-strip">
          {list.map((b) => (
            <button key={b.id} type="button" className={`bike-card ${b.id === cur.id ? 'on' : ''} ${save.owned.includes(b.id) ? '' : 'locked'}`}
              style={{ ['--c' as string]: b.color }} onClick={() => { sfxClick(); setPreview(b.id); }}>
              <i className="swatch" />
              <b>{b.name}</b>
              <small>{b.cat}</small>
              {save.owned.includes(b.id) ? (save.selected === b.id ? <em>Selected</em> : <em>{t('owned')}</em>) : <em><Icon n="coin" size={12} /> {fmtNum(b.price)}</em>}
            </button>
          ))}
        </div>
      </div>
    </Page>
  );
}

function Upgrades({ t, save, level, previewId, setPreview, onBack, onBuy }: {
  t: (k: TKey) => string; save: ReturnType<typeof store.get>; level: number; previewId: string; setPreview: (id: string) => void; onBack: () => void;
  onBuy: (id: string, k: UpgradeKey) => void;
}) {
  const ownedBikes = BIKES.filter((b) => save.owned.includes(b.id));
  const cur = ownedBikes.find((b) => b.id === previewId) || bikeById(save.selected);
  useEffect(() => { if (cur.id !== previewId) setPreview(cur.id); }, [cur.id, previewId, setPreview]);
  const lv = upgradesFor(save, cur.id);
  return (
    <Page title={t('upgrades')} onBack={onBack} save={save} level={level} t={t}>
      <div className="upg">
        <div className="chips">
          {ownedBikes.map((b) => (
            <button key={b.id} type="button" className={`chipbtn ${b.id === cur.id ? 'on' : ''}`} onClick={() => { sfxClick(); setPreview(b.id); }}>{b.name}</button>
          ))}
        </div>
        <div className="upg-body">
          <div className="upg-list">
            {UPGRADE_KEYS.map((k) => {
              const L = lv[k];
              const max = L >= MAX_UPG;
              const cost = max ? 0 : upgradeCost(cur, k, L);
              return (
                <div key={k} className="upg-row">
                  <div className="info"><b>{UPGRADES[k].name}</b><small>{UPGRADES[k].desc}</small>
                    <div className="pips">{Array.from({ length: MAX_UPG }, (_, i) => <i key={i} className={i < L ? 'on' : ''} />)}</div>
                  </div>
                  <Btn kind={max ? 'default' : 'gold'} disabled={max || save.coins < cost} icon={max ? 'check' : 'coin'} onClick={() => onBuy(cur.id, k)}>{max ? t('maxed') : fmtNum(cost)}</Btn>
                </div>
              );
            })}
          </div>
          <div className="upg-stats"><h3>{cur.name}</h3><StatBars bike={cur} upg={lv} /></div>
        </div>
      </div>
    </Page>
  );
}
function Achievements({ t, save, level, onBack, onClaim }: { t: (k: TKey) => string; save: ReturnType<typeof store.get>; level: number; onBack: () => void; onClaim: (i: number) => void }) {
  const [tab, setTab] = useState<'daily' | 'ach'>('daily');
  const ctx = { stats: save.stats, level, owned: save.owned.length, career: save.career.length, challenges: save.challenges.length };
  return (
    <Page title={t('achievements')} onBack={onBack} save={save} level={level} t={t}>
      <div className="chips">
        <button type="button" className={`chipbtn ${tab === 'daily' ? 'on' : ''}`} onClick={() => { sfxClick(); setTab('daily'); }}>{t('daily')}</button>
        <button type="button" className={`chipbtn ${tab === 'ach' ? 'on' : ''}`} onClick={() => { sfxClick(); setTab('ach'); }}>{t('achievements')} {save.achievements.length}/{ACHIEVEMENTS.length}</button>
      </div>
      {tab === 'daily' ? (
        <div className="list">
          {save.daily.items.map((d, i) => {
            const ok = d.progress >= d.target;
            return (
              <div key={i} className={`row ${ok ? 'done' : ''}`}>
                <div className="info"><b>{dailyLabel(d)}</b>
                  <div className="meter"><i style={{ width: `${Math.min(100, (d.progress / d.target) * 100)}%` }} /></div>
                  <small>{Math.floor(d.progress)} / {d.target} · <Icon n="coin" size={13} /> {d.reward}</small>
                </div>
                <Btn kind={ok && !d.claimed ? 'gold' : 'default'} disabled={!ok || d.claimed} onClick={() => onClaim(i)}>{d.claimed ? t('claimed') : t('claim')}</Btn>
              </div>
            );
          })}
          <small className="hint">New daily missions appear every day. Progress only counts while riding.</small>
        </div>
      ) : (
        <div className="list">
          {ACHIEVEMENTS.map((a) => {
            const got = save.achievements.includes(a.id);
            const [v, g] = a.progress(ctx);
            return (
              <div key={a.id} className={`row ${got ? 'done' : ''}`}>
                <div className="num">{got ? <Icon n="medal" size={22} /> : <Icon n="lock" size={18} />}</div>
                <div className="info"><b>{a.name}</b><small>{a.desc}</small>
                  <div className="meter"><i style={{ width: `${(v / g) * 100}%` }} /></div></div>
                <small className="rew"><Icon n="coin" size={13} /> {fmtNum(a.reward)}</small>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}

function Leaderboard({ t, save, level, onBack, onName }: { t: (k: TKey) => string; save: ReturnType<typeof store.get>; level: number; onBack: () => void; onName: (n: string) => void }) {
  const [mode, setMode] = useState<ModeId>('traffic');
  const rows = save.scores[mode] || [];
  return (
    <Page title={t('leaderboard')} onBack={onBack} save={save} level={level} t={t}>
      <div className="chips">
        {(Object.keys(MODE_NAMES) as ModeId[]).map((m) => (
          <button key={m} type="button" className={`chipbtn ${mode === m ? 'on' : ''}`} onClick={() => { sfxClick(); setMode(m); }}>{MODE_NAMES[m]}</button>
        ))}
      </div>
      <label className="field"><span>{t('name')}</span><input value={save.name} maxLength={14} onChange={(e) => onName(e.target.value)} /></label>
      <div className="list lb">
        {rows.length === 0 && <p className="empty">No scores yet — go ride!</p>}
        {rows.map((r, i) => (
          <div key={i} className={`row ${i === 0 ? 'gold' : ''}`}>
            <div className="num">{i + 1}</div>
            <div className="info"><b>{r.name}</b><small>{envInfo(r.env as EnvId).name} · {r.bike} · {r.date}</small></div>
            <b className="score">{fmtNum(r.score)}</b>
          </div>
        ))}
        <small className="hint">Local leaderboard — scores saved on this device only (works offline).</small>
      </div>
    </Page>
  );
}

function Slider({ label, value, min = 0, max = 1, step = 0.05, onChange, fmt }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="field"><span>{label} <b>{fmt ? fmt(value) : Math.round(value * 100) + '%'}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} /></label>
  );
}

function Seg<T extends string | number>({ label, value, opts, onChange }: { label: string; value: T; opts: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="field"><span>{label}</span>
      <div className="seg">{opts.map((o) => <button key={String(o.v)} type="button" className={value === o.v ? 'on' : ''} onClick={() => { sfxClick(); onChange(o.v); }}>{o.l}</button>)}</div></div>
  );
}

function SettingsScreen({ t, save, level, onBack, upd }: { t: (k: TKey) => string; save: ReturnType<typeof store.get>; level: number; onBack: () => void; upd: (p: Partial<Settings>) => void }) {
  const S = save.settings;
  const [confirm, setConfirm] = useState(false);
  const offline = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
  return (
    <Page title={t('settings')} onBack={onBack} save={save} level={level} t={t}>
      <div className="settings">
        <Seg label={t('graphics')} value={S.quality} opts={[{ v: 'low', l: 'Low' }, { v: 'medium', l: 'Medium' }, { v: 'high', l: 'High' }]} onChange={(v) => upd({ quality: v })} />
        <Slider label={t('sound')} value={S.sfx} onChange={(v) => upd({ sfx: v })} />
        <Slider label={t('music')} value={S.music} onChange={(v) => upd({ music: v })} />
        <Slider label={t('sensitivity')} value={S.sensitivity} min={0.5} max={1.5} onChange={(v) => upd({ sensitivity: v })} fmt={(v) => v.toFixed(2) + 'x'} />
        <Seg label={t('camera')} value={S.camera} opts={CAMERAS.map((c, i) => ({ v: i, l: c }))} onChange={(v) => upd({ camera: v })} />
        <Slider label="Field of view" value={S.fov} min={50} max={80} step={1} onChange={(v) => upd({ fov: v })} fmt={(v) => v + '°'} />
        <Seg label="Camera shake" value={S.shake ? 'on' : 'off'} opts={[{ v: 'on', l: 'On' }, { v: 'off', l: 'Off' }]} onChange={(v) => upd({ shake: v === 'on' })} />
        <Seg label="Auto throttle" value={S.autoThrottle ? 'on' : 'off'} opts={[{ v: 'on', l: 'On' }, { v: 'off', l: 'Off' }]} onChange={(v) => upd({ autoThrottle: v === 'on' })} />
        <Seg label="Vibration" value={S.vibrate ? 'on' : 'off'} opts={[{ v: 'on', l: 'On' }, { v: 'off', l: 'Off' }]} onChange={(v) => upd({ vibrate: v === 'on' })} />
        <Seg label={t('language')} value={S.lang} opts={LANGS.map((l) => ({ v: l.id, l: l.label }))} onChange={(v) => upd({ lang: v })} />
        <label className="field"><span>{t('name')}</span><input value={save.name} maxLength={14} onChange={(e) => store.update((s) => ({ ...s, name: e.target.value.slice(0, 14) || 'Rider' }))} /></label>
        <p className="hint">{offline ? 'Offline ready — the whole game is stored on this device.' : 'Offline files are being stored. Reload once online, then the game works without internet.'}</p>
        <Btn kind="danger" icon="restart" onClick={() => setConfirm(true)}>{t('reset')}</Btn>
      </div>
      {confirm && (
        <div className="modal">
          <div className="dialog">
            <h3>Erase all progress?</h3>
            <p>Coins, bikes, upgrades, missions and scores will be deleted. This cannot be undone.</p>
            <div className="row-btns">
              <Btn onClick={() => setConfirm(false)}>Cancel</Btn>
              <Btn kind="danger" onClick={() => { store.reset(); setConfirm(false); }}>Erase</Btn>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
// ---------------------------------------------------------------------------
// Race UI
// ---------------------------------------------------------------------------
function Hold({ k, press, className, children, label }: { k: 'gas' | 'brake' | 'nitro'; press: (k: 'gas' | 'brake' | 'nitro', v: boolean) => void; className: string; children: React.ReactNode; label: string }) {
  const [on, setOn] = useState(false);
  const set = (v: boolean) => { setOn(v); press(k, v); };
  return (
    <button type="button" aria-label={label} className={`hold ${className} ${on ? 'on' : ''}`}
      onPointerDown={(e) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } set(true); }}
      onPointerUp={() => set(false)} onPointerCancel={() => set(false)} onLostPointerCapture={() => set(false)}>
      {children}
    </button>
  );
}

function SteerPad({ press }: { press: (k: 'left' | 'right', v: boolean) => void }) {
  const [side, setSide] = useState<-1 | 0 | 1>(0);
  const apply = (s: -1 | 0 | 1) => { setSide(s); press('left', s === -1); press('right', s === 1); };
  const calc = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    apply(e.clientX < r.left + r.width / 2 ? -1 : 1);
  };
  return (
    <div className="steerpad"
      onPointerDown={(e) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } calc(e); }}
      onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') { if (side !== 0) calc(e); } }}
      onPointerUp={() => apply(0)} onPointerCancel={() => apply(0)} onLostPointerCapture={() => apply(0)}>
      <div className={`sbtn ${side === -1 ? 'on' : ''}`}><Icon n="left" size={44} /></div>
      <div className={`sbtn ${side === 1 ? 'on' : ''}`}><Icon n="right" size={44} /></div>
    </div>
  );
}

function RaceUI({ hud, toasts, paused, end, S, t, press, onPause, onRestart, onCamera, onQuit, onMenu, onUpg, onNext, upd }: {
  hud: Hud; toasts: ToastItem[]; paused: boolean; end: RaceEnd | null; S: Settings; t: (k: TKey) => string;
  press: (k: 'left' | 'right' | 'gas' | 'brake' | 'nitro', v: boolean) => void;
  onPause: () => void; onRestart: () => void; onCamera: () => void; onQuit: () => void; onMenu: () => void; onUpg: () => void; onNext: (m: Mission) => void;
  upd: (p: Partial<Settings>) => void;
}) {
  const frac = Math.min(1, hud.speed / Math.max(1, hud.maxSpeed));
  const C = 2 * Math.PI * 42;
  const low = hud.timeMode === 'down' && hud.time < 10;
  return (
    <div className="race">
      <div className={`speedfx ${hud.nitroOn ? 'on' : ''}`} />
      <div className="hud-tl">
        <div className="gauge">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" className="g-bg" strokeDasharray={`${C * 0.75} ${C}`} transform="rotate(135 50 50)" />
            <circle cx="50" cy="50" r="42" className={`g-fg ${hud.nitroOn ? 'nitro' : ''}`} strokeDasharray={`${C * 0.75 * frac} ${C}`} transform="rotate(135 50 50)" />
          </svg>
          <div className="g-num"><b>{hud.speed}</b><small>{t('speed')}</small></div>
        </div>
        <div className="nitro-bar" title={t('nitro')}><Icon n="zap" size={14} /><div><i className={hud.nitroOn ? 'on' : ''} style={{ width: `${hud.nitro * 100}%` }} /></div></div>
        <div className="mini"><span><Icon n="coin" size={14} /> {fmtNum(hud.coins)}</span><span>{(hud.dist / 1000).toFixed(2)} km</span></div>
      </div>

      <div className="hud-top">
        <div className="score"><small>{t('score')}</small><b>{fmtNum(hud.score)}</b></div>
        <div className={`timer ${low ? 'low' : ''}`}><Icon n="timer" size={16} /> {fmtTime(hud.time)}</div>
        {hud.objective && (
          <div className="objective"><span>{hud.objective}</span>{hud.progress > 0 || hud.objective.includes(':') ? <div className="meter"><i style={{ width: `${hud.progress * 100}%` }} /></div> : null}</div>
        )}
      </div>

      <div className="hud-tr">
        <button type="button" className="rbtn" onClick={() => { sfxClick(); onCamera(); }} aria-label="Camera"><Icon n="camera" size={20} /><small>{CAMERAS[hud.camera]}</small></button>
        <button type="button" className="rbtn" onClick={() => { sfxClick(); onRestart(); }} aria-label="Restart"><Icon n="restart" size={20} /></button>
        <button type="button" className="rbtn" onClick={() => { sfxClick(); onPause(); }} aria-label="Pause"><Icon n="pause" size={20} /></button>
      </div>

      <div className="toasts">{toasts.map((x) => <div key={x.id} className={`toast ${x.kind}`}>{x.text}</div>)}</div>
      {hud.countdown >= 0 && !end && <div className="countdown" key={hud.countdown}>{hud.countdown === 0 ? 'GO!' : hud.countdown}</div>}
      {hud.respawning && <div className="respawn">Back on the road</div>}

      <div className="controls">
        <SteerPad press={press} />
        <div className="pedals">
          <Hold k="nitro" press={press} className="nitro" label="Nitro"><Icon n="zap" size={30} /><small>{t('nitro')}</small></Hold>
          <Hold k="brake" press={press} className="brake" label="Brake"><Icon n="stop" size={26} /><small>{t('brake')}</small></Hold>
          <Hold k="gas" press={press} className="gas" label="Accelerate"><Icon n="gas" size={40} /><small>{t('ride')}</small></Hold>
        </div>
      </div>
      <div className="kbd-hint">W/↑ gas · S/↓ brake · A D / ← → steer · Space nitro · C camera · Esc pause</div>

      {paused && !end && (
        <div className="modal">
          <div className="dialog">
            <h3>{t('pause')}</h3>
            <Slider label={t('sound')} value={S.sfx} onChange={(v) => upd({ sfx: v })} />
            <Slider label={t('music')} value={S.music} onChange={(v) => upd({ music: v })} />
            <div className="col-btns">
              <Btn big kind="primary" icon="play" onClick={onPause}>{t('resume')}</Btn>
              <Btn icon="restart" onClick={onRestart}>{t('restart')}</Btn>
              <Btn kind="danger" icon="flag" onClick={onQuit}>Finish race</Btn>
            </div>
          </div>
        </div>
      )}

      {end && <Results end={end} t={t} onRetry={onRestart} onMenu={onMenu} onUpg={onUpg} onNext={onNext} />}
    </div>
  );
}

function Results({ end, t, onRetry, onMenu, onUpg, onNext }: { end: RaceEnd; t: (k: TKey) => string; onRetry: () => void; onMenu: () => void; onUpg: () => void; onNext: (m: Mission) => void }) {
  const { res, sum, cfg } = end;
  const m = cfg.mission;
  let title = t('gameover');
  if (m) title = res.success ? t('complete') : t('failed');
  else if (res.reason === 'timeup') title = "Time's up!";
  else if (res.reason === 'quit') title = 'Race finished';
  const total = sum.coinsPicked + sum.coinsBonus + sum.missionReward;
  const nextIdx = cfg.mode === 'career' && m && res.success ? CAREER.findIndex((x) => x.id === m.id) + 1 : -1;
  const next = nextIdx > 0 && nextIdx < CAREER.length ? CAREER[nextIdx] : null;
  const why = res.reason === 'crash' ? 'You crashed.' : res.reason === 'timeup' ? (m ? 'Time ran out before the objective was met.' : 'The clock reached zero.') : '';
  return (
    <div className="modal results">
      <div className="dialog wide">
        <h3 className={res.success ? 'win' : ''}>{title}</h3>
        {m && <p className="sub">{m.title} — {objectiveText(m)}</p>}
        {why && !res.success && <p className="sub">{why}</p>}
        <div className="big-score"><small>{t('score')}</small><b>{fmtNum(res.score)}</b>{sum.newBest && <em>{t('newbest')}</em>}{sum.rank > 0 && !sum.newBest && <em>Rank #{sum.rank}</em>}</div>
        <div className="grid">
          <div><small>{t('distance')}</small><b>{(res.distance / 1000).toFixed(2)} km</b></div>
          <div><small>Top speed</small><b>{res.topSpeed} km/h</b></div>
          <div><small>Overtakes</small><b>{res.overtakes}</b></div>
          <div><small>Near misses</small><b>{res.nearMisses}</b></div>
          <div><small>Coins picked</small><b>{sum.coinsPicked}</b></div>
          <div><small>{t('time')}</small><b>{fmtTime(res.duration)}</b></div>
        </div>
        <div className="rewards">
          <span><Icon n="coin" size={16} /> +{fmtNum(total)} {t('coins')}{sum.missionReward ? ` (mission +${fmtNum(sum.missionReward)})` : ''}</span>
          <span><Icon n="star" size={16} /> +{sum.xp} XP · {t('level')} {sum.level}</span>
        </div>
        <div className="col-btns">
          {next && <Btn big kind="primary" icon="next" onClick={() => onNext(next)}>{t('next')}: {next.title}</Btn>}
          <Btn big kind={next ? 'default' : 'primary'} icon="restart" onClick={onRetry}>{t('retry')}</Btn>
          <div className="row-btns"><Btn icon="up" onClick={onUpg}>{t('upgrades')}</Btn><Btn icon="home" onClick={onMenu}>Menu</Btn></div>
        </div>
      </div>
    </div>
  );
}

           
