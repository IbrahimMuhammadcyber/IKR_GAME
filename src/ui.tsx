// Small shared UI pieces: icons, bars, buttons.
import type { ReactNode } from 'react';
import { audio } from './game/audio';

export type IconName =
  | 'play' | 'pause' | 'restart' | 'camera' | 'zap' | 'lock' | 'check' | 'back' | 'gear' | 'trophy' | 'medal' | 'flag'
  | 'timer' | 'car' | 'road' | 'up' | 'coin' | 'bike' | 'close' | 'full' | 'volume' | 'cal' | 'target' | 'star' | 'left'
  | 'right' | 'gas' | 'stop' | 'home' | 'download' | 'next';

export function Icon({ n, size = 22 }: { n: IconName; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'ico' };
  switch (n) {
    case 'play': return <svg {...p} fill="currentColor"><polygon points="6 4 20 12 6 20" /></svg>;
    case 'pause': return <svg {...p} fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>;
    case 'restart': return <svg {...p}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>;
    case 'camera': return <svg {...p}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>;
    case 'zap': return <svg {...p} fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
    case 'lock': return <svg {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
    case 'check': return <svg {...p} strokeWidth={3}><polyline points="20 6 9 17 4 12" /></svg>;
    case 'back': return <svg {...p} strokeWidth={3}><polyline points="15 18 9 12 15 6" /></svg>;
    case 'gear': return <svg {...p}><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>;
    case 'trophy': return <svg {...p}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></svg>;
    case 'medal': return <svg {...p}><circle cx="12" cy="8" r="6" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></svg>;
    case 'flag': return <svg {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>;
    case 'timer': return <svg {...p}><circle cx="12" cy="13" r="8" /><polyline points="12 9 12 13 14.5 15" /><line x1="9" y1="2" x2="15" y2="2" /></svg>;
    case 'car': return <svg {...p}><path d="M5 17H3v-5l2-5h14l2 5v5h-2" /><circle cx="7.5" cy="17" r="2" /><circle cx="16.5" cy="17" r="2" /><line x1="3" y1="12" x2="21" y2="12" /></svg>;
    case 'road': return <svg {...p}><path d="M8 21L10 3M16 21L14 3" /><path d="M12 5v3M12 11v3M12 17v3" /></svg>;
    case 'up': return <svg {...p}><circle cx="12" cy="12" r="10" /><polyline points="16 12 12 8 8 12" /><line x1="12" y1="16" x2="12" y2="8" /></svg>;
    case 'coin': return <svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /></svg>;
    case 'bike': return <svg {...p}><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /><path d="M5.5 17.5L9 10h5l4.5 7.5M14 10l-1.5-4H10" /></svg>;
    case 'close': return <svg {...p}><path d="M18 6L6 18M6 6l12 12" /></svg>;
    case 'full': return <svg {...p}><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>;
    case 'volume': return <svg {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>;
    case 'cal': return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
    case 'target': return <svg {...p}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
    case 'star': return <svg {...p} fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
    case 'left': return <svg {...p} strokeWidth={3}><polyline points="14 18 8 12 14 6" /><polyline points="20 18 14 12 20 6" /></svg>;
    case 'right': return <svg {...p} strokeWidth={3}><polyline points="10 18 16 12 10 6" /><polyline points="4 18 10 12 4 6" /></svg>;
    case 'gas': return <svg {...p} strokeWidth={3}><line x1="12" y1="20" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>;
    case 'stop': return <svg {...p} fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>;
    case 'home': return <svg {...p}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>;
    case 'download': return <svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
    case 'next': return <svg {...p} strokeWidth={3}><polyline points="9 18 15 12 9 6" /></svg>;
  }
}

export const sfxClick = () => audio.sfx('click');

export function Btn({
  children, onClick, kind = 'default', disabled, className = '', icon, big,
}: { children?: ReactNode; onClick?: () => void; kind?: 'default' | 'primary' | 'ghost' | 'danger' | 'gold'; disabled?: boolean; className?: string; icon?: IconName; big?: boolean }) {
  return (
    <button
      type="button"
      className={`btn ${kind} ${big ? 'big' : ''} ${className}`}
      disabled={disabled}
      onClick={() => { if (disabled) return; sfxClick(); onClick?.(); }}
    >
      {icon && <Icon n={icon} size={big ? 26 : 20} />}
      <span>{children}</span>
    </button>
  );
}

export function Bar({ value, bonus = 0, label, color }: { value: number; bonus?: number; label: string; color?: string }) {
  const v = Math.max(0, Math.min(1, value));
  const b = Math.max(0, Math.min(1 - v, bonus));
  return (
    <div className="statbar">
      <span className="lbl">{label}</span>
      <div className="track">
        <i className="fill" style={{ width: `${v * 100}%`, background: color }} />
        {b > 0 && <i className="bonus" style={{ left: `${v * 100}%`, width: `${b * 100}%` }} />}
      </div>
    </div>
  );
}

export const fmtTime = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
export const fmtNum = (n: number) => Math.round(n).toLocaleString('en-US');
