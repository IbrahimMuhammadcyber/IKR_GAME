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
 
