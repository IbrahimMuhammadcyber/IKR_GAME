import type { BikeDef, EnvId, Mission, ModeId, UpgLevels } from './data';

export interface RaceConfig {
  mode: ModeId;
  env: EnvId;
  bike: BikeDef;
  upg: UpgLevels;
  mission?: Mission;
}

export type FinishReason = 'crash' | 'timeup' | 'complete' | 'quit';

export interface RaceResult {
  mode: ModeId;
  env: EnvId;
  reason: FinishReason;
  success: boolean | null; // null when there is no mission objective
  score: number;
  distance: number; // metres
  coins: number; // picked up
  overtakes: number;
  nearMisses: number;
  topSpeed: number; // km/h
  duration: number; // seconds
}

export interface Hud {
  speed: number;
  maxSpeed: number;
  dist: number;
  score: number;
  coins: number;
  nitro: number; // 0..1
  nitroOn: boolean;
  time: number;
  timeMode: 'down' | 'up';
  overtakes: number;
  near: number;
  objective: string;
  progress: number; // 0..1
  countdown: number; // 3,2,1,0 (GO) or -1 when running
  crashed: boolean;
  camera: number;
  respawning: boolean;
}

export interface Toast { text: string; kind: 'good' | 'info' | 'warn' | 'coin' }
