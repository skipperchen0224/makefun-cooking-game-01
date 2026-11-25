// Web Audio 合成音效 + 轻音乐循环。零外部资源；无 AudioContext 时静默。
const NOTE = { C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0, C5: 523.25, E5: 659.25, G5: 783.99 };

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
  }
  ensure() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }
  resume() {
    if (this.ensure() && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
  tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch {
      // 音频失败不影响游戏
    }
  }
  noise(dur, vol, when = 0, lowpass = 1200) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      const g = this.ctx.createGain();
      g.gain.value = vol || 0.15;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t0);
    } catch {
      // 忽略
    }
  }
  chop() { this.noise(0.08, 0.25, 0, 2500); this.tone(180, 0.06, 'square', 0.08); }
  pickup() { this.tone(NOTE.E4, 0.08, 'sine', 0.15); }
  place() { this.tone(NOTE.C4, 0.08, 'triangle', 0.15); }
  ding() { this.tone(NOTE.C5, 0.25, 'sine', 0.2); this.tone(NOTE.E5, 0.3, 'sine', 0.15, 0.08); }
  serve() {
    this.tone(NOTE.C5, 0.12, 'triangle', 0.2);
    this.tone(NOTE.E5, 0.12, 'triangle', 0.2, 0.09);
    this.tone(NOTE.G5, 0.22, 'triangle', 0.2, 0.18);
  }
  wrong() { this.tone(220, 0.25, 'sawtooth', 0.12, 0, 160); }
  leave() { this.tone(330, 0.3, 'sine', 0.12, 0, 180); }
  coin() { this.tone(NOTE.E5, 0.1, 'square', 0.08); this.tone(NOTE.G5, 0.18, 'square', 0.08, 0.07); }
  click() { this.tone(NOTE.A4, 0.05, 'sine', 0.1); }
  startMusic() {
    if (!this.ensure() || this.musicTimer) return;
    const bass = [NOTE.C4, NOTE.A4, NOTE.G4, NOTE.E4];
    const lead = [NOTE.E5, NOTE.G5, NOTE.E5, NOTE.C5, NOTE.D4, NOTE.E4, NOTE.G4, NOTE.E4];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const bar = this.musicStep % 8;
      this.tone(bass[Math.floor(bar / 2) % 4], 0.5, 'triangle', 0.05);
      if (bar % 2 === 0) this.tone(lead[bar], 0.35, 'sine', 0.045);
      this.musicStep++;
    }, 450);
  }
  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
}
