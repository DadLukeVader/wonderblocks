// WonderBlocks audio: cheerful procedural music + SFX via WebAudio. No assets.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = null;
    this.volume = 0.5;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }
  tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, vol = 0.15, when = 0, freq = 1200) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const len = Math.max(1, (dur * this.ctx.sampleRate) | 0);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }
  // ---- SFX ----
  click() { this.tone(660, 0.07, 'triangle', 0.12); }
  pop() { this.tone(320, 0.12, 'square', 0.08, 0, 640); }
  breakB() { this.noise(0.18, 0.2, 0, 900); this.tone(180, 0.15, 'triangle', 0.1, 0, 90); }
  pickup() { this.tone(740, 0.09, 'sine', 0.14); this.tone(1108, 0.12, 'sine', 0.12, 0.07); }
  splash() { this.noise(0.3, 0.18, 0, 2400); }
  quest() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.16, i * 0.11)); }
  coin() { this.tone(988, 0.1, 'square', 0.07); this.tone(1319, 0.18, 'square', 0.07, 0.08); }
  chirp() { const f = 2200 + Math.random() * 1400; this.tone(f, 0.09, 'sine', 0.05, 0, f * 1.4); }

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const chords = [
      [261.6, 329.6, 392.0], [220.0, 261.6, 329.6],
      [174.6, 220.0, 261.6], [196.0, 246.9, 293.7],
    ];
    let ci = 0;
    const bar = () => {
      if (this.muted) return;
      const ch = chords[ci % chords.length]; ci++;
      ch.forEach((f, i) => this.tone(f, 1.8, 'triangle', 0.045, i * 0.28));
      this.tone(ch[0] / 2, 2.2, 'sine', 0.05, 0);
      if (Math.random() < 0.5) this.chirp();
    };
    bar();
    this.musicTimer = setInterval(bar, 2400);
  }
}
