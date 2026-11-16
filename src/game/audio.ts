// Fully procedural audio (Web Audio). No audio files, so it works 100% offline.

type Sfx = 'click' | 'coin' | 'crash' | 'overtake' | 'near' | 'levelup' | 'success' | 'nope' | 'buy' | 'beep' | 'go' | 'checkpoint';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private sfxVol = 0.8;
  private musicVol = 0.5;

  // engine voice
  private eng: { o1: OscillatorNode; o2: OscillatorNode; filt: BiquadFilterNode; gain: GainNode } | null = null;
  private nitroSrc: { src: AudioBufferSourceNode; gain: GainNode; filt: BiquadFilterNode } | null = null;
  private brakeSrc: { src: AudioBufferSourceNode; gain: GainNode; filt: BiquadFilterNode } | null = null;

  // music
  private musicTimer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private track: 'menu' | 'race' | null = null;

  /** Must be called from a user gesture (tap / key press) the first time. */
  unlock() {
    if (!this.ctx) {
      const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch { return; }
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(c.destination);
      this.sfxGain = c.createGain();
      this.sfxGain.gain.value = this.sfxVol;
      this.sfxGain.connect(this.master);
      this.musicGain = c.createGain();
      this.musicGain.gain.value = this.musicVol * 0.5;
      this.musicGain.connect(this.master);
      const len = c.sampleRate * 1.5;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(sfx: number, music: number) {
    this.sfxVol = sfx;
    this.musicVol = music;
    if (this.ctx) {
      this.sfxGain.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.03);
      this.musicGain.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.03);
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, f0: number, f1: number, type: BiquadFilterType = 'lowpass', when = 0) {
    const c = this.ctx;
    if (!c || !this.noiseBuf) return;
    const t = c.currentTime + when;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  sfx(name: Sfx) {
    if (!this.ctx) return;
    switch (name) {
      case 'click': this.tone(660, 0.07, 'square', 0.12); break;
      case 'coin': this.tone(988, 0.08, 'square', 0.1); this.tone(1319, 0.14, 'square', 0.1, 0.07); break;
      case 'overtake': this.tone(520, 0.08, 'triangle', 0.15); this.tone(780, 0.1, 'triangle', 0.15, 0.06); break;
      case 'near': this.noise(0.25, 0.18, 3000, 600, 'bandpass'); this.tone(900, 0.15, 'triangle', 0.12); break;
      case 'crash':
        this.noise(0.7, 0.9, 2500, 120, 'lowpass');
        this.tone(110, 0.5, 'sawtooth', 0.35, 0, 35);
        this.noise(0.25, 0.5, 6000, 800, 'highpass', 0.05);
        break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'square', 0.12, i * 0.09)); break;
      case 'success': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.16, i * 0.1)); break;
      case 'nope': this.tone(220, 0.18, 'square', 0.12, 0, 150); break;
      case 'buy': this.tone(440, 0.08, 'square', 0.12); this.tone(880, 0.16, 'square', 0.12, 0.08); break;
      case 'beep': this.tone(600, 0.12, 'square', 0.15); break;
      case 'go': this.tone(1000, 0.4, 'square', 0.18); break;
      case 'checkpoint': this.tone(700, 0.1, 'triangle', 0.15); this.tone(1050, 0.2, 'triangle', 0.15, 0.1); break;
    }
  }

  // ---- Engine / nitro / brake loops --------------------------------------
  startEngine() {
    const c = this.ctx;
    if (!c || this.eng) return;
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'square';
    o1.frequency.value = 50;
    o2.frequency.value = 25;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 500;
    filt.Q.value = 2;
    const gain = c.createGain();
    gain.gain.value = 0;
    o1.connect(filt);
    o2.connect(filt);
    filt.connect(gain);
    gain.connect(this.sfxGain);
    o1.start();
    o2.start();
    this.eng = { o1, o2, filt, gain };

    const mkLoop = (type: BiquadFilterType, f: number) => {
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const filt2 = c.createBiquadFilter();
      filt2.type = type;
      filt2.frequency.value = f;
      filt2.Q.value = 0.8;
      const g = c.createGain();
      g.gain.value = 0;
      src.connect(filt2);
      filt2.connect(g);
      g.connect(this.sfxGain);
      src.start();
      return { src, gain: g, filt: filt2 };
    };
    this.nitroSrc = mkLoop('bandpass', 900);
    this.brakeSrc = mkLoop('highpass', 3500);
  }

  /** speedFrac 0..1.2, throttle 0..1 */
  updateEngine(speedFrac: number, throttle: number, nitro: boolean, braking: boolean, offroad: boolean) {
    const c = this.ctx;
    if (!c || !this.eng) return;
    const t = c.currentTime;
    const gears = 5;
    const f = Math.min(1.2, speedFrac) / 1.2;
    const gi = Math.min(gears - 1, Math.floor(f * gears));
    const within = f * gears - gi;
    const rpm = 0.22 + 0.78 * Math.min(1, within) * (0.7 + 0.3 * throttle);
    const base = 38 + rpm * 120 + gi * 6;
    this.eng.o1.frequency.setTargetAtTime(base, t, 0.04);
    this.eng.o2.frequency.setTargetAtTime(base * 0.5, t, 0.04);
    this.eng.filt.frequency.setTargetAtTime(350 + rpm * 1500 + throttle * 900, t, 0.05);
    this.eng.gain.gain.setTargetAtTime(0.06 + 0.1 * throttle + 0.05 * rpm, t, 0.05);
    if (this.nitroSrc) {
      this.nitroSrc.gain.gain.setTargetAtTime(nitro ? 0.22 : 0, t, 0.05);
      this.nitroSrc.filt.frequency.setTargetAtTime(700 + f * 1800, t, 0.1);
    }
    if (this.brakeSrc) this.brakeSrc.gain.gain.setTargetAtTime(braking && speedFrac > 0.25 ? 0.09 : offroad ? 0.05 : 0, t, 0.04);
  }

  stopEngine() {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    if (this.eng) {
      this.eng.gain.gain.setTargetAtTime(0, t, 0.05);
      const e = this.eng;
      setTimeout(() => { try { e.o1.stop(); e.o2.stop(); } catch { /* already stopped */ } }, 400);
      this.eng = null;
    }
    for (const k of ['nitroSrc', 'brakeSrc'] as const) {
      const n = this[k];
      if (n) {
        n.gain.gain.setTargetAtTime(0, t, 0.05);
        setTimeout(() => { try { n.src.stop(); } catch { /* already stopped */ } }, 400);
        this[k] = null;
      }
    }
  }

  // ---- Music: tiny step sequencer --------------------------------------
  startMusic(track: 'menu' | 'race') {
    if (!this.ctx) return;
    if (this.track === track && this.musicTimer !== null) return;
    this.stopMusic();
    this.track = track;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 40);
  }

  stopMusic() {
    if (this.musicTimer !== null) { clearInterval(this.musicTimer); this.musicTimer = null; }
    this.track = null;
  }

  private note(freq: number, t: number, dur: number, type: OscillatorType, vol: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.musicGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private drum(kind: 'kick' | 'snare' | 'hat', t: number) {
    const c = this.ctx!;
    if (kind === 'kick') {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g);
      g.connect(this.musicGain);
      o.start(t);
      o.stop(t + 0.2);
      return;
    }
    if (!this.noiseBuf) return;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = kind === 'hat' ? 7000 : 1800;
    const g = c.createGain();
    const dur = kind === 'hat' ? 0.04 : 0.14;
    g.gain.setValueAtTime(kind === 'hat' ? 0.18 : 0.4, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.musicGain);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  private schedule() {
    const c = this.ctx;
    if (!c || !this.track) return;
    const race = this.track === 'race';
    const bpm = race ? 138 : 98;
    const stepDur = 60 / bpm / 4;
    // A minor groove: Am - F - C - G
    const roots = [55, 43.65, 65.41, 49];
    const arp = [220, 261.63, 329.63, 392];
    while (this.nextTime < c.currentTime + 0.2) {
      const st = this.step % 64;
      const bar = Math.floor(st / 16) % 4;
      const s16 = st % 16;
      const t = this.nextTime;
      if (s16 % 4 === 0) this.drum('kick', t);
      if (race && (s16 === 4 || s16 === 12)) this.drum('snare', t);
      if (race ? s16 % 2 === 1 : s16 % 4 === 2) this.drum('hat', t);
      const root = roots[bar];
      if (s16 % 2 === 0 || (race && s16 % 4 === 3)) this.note(root * (s16 % 8 === 6 ? 2 : 1), t, stepDur * 1.6, 'sawtooth', 0.2);
      if (race ? s16 % 2 === 0 : s16 % 4 === 0) {
        const a = arp[(s16 / 2 + bar) % 4 | 0] * (bar === 1 ? 0.8 : 1);
        this.note(a, t, stepDur * 1.2, 'square', 0.05);
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }
}

export const audio = new AudioEngine();
