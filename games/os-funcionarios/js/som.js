// Som sintetizado na hora (Web Audio): nenhum arquivo de áudio.
export class Som {
  constructor() { this.ctx = null; }
  ligar() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    this.mestre = this.ctx.createGain(); this.mestre.gain.value = 0.5; this.mestre.connect(this.ctx.destination);
    // zumbido de lâmpada fluorescente + ar do escritório
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 120;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    const g = this.ctx.createGain(); g.gain.value = 0.012;
    o.connect(f).connect(g).connect(this.mestre); o.start();
    const ruido = this._ruido(2, true);
    const fr = this.ctx.createBiquadFilter(); fr.type = 'lowpass'; fr.frequency.value = 500;
    const gr = this.ctx.createGain(); gr.gain.value = 0.03;
    ruido.connect(fr).connect(gr).connect(this.mestre); ruido.start();
  }
  _ruido(seg, loop = false) {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * seg, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b; s.loop = loop; return s;
  }
  _env(no, t0, ataque, dura, pico) {
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(pico, t0 + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t0 + ataque + dura);
    no.connect(g).connect(this.mestre); return g;
  }
  // grampeador: estalo metálico seco + "tchac" da mola
  tiro() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const n = this._ruido(0.2); const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 1.4;
    n.connect(f); this._env(f, t, 0.001, 0.06, 0.9); n.start(t);
    const n2 = this._ruido(0.2); const f2 = this.ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 420;
    n2.connect(f2); this._env(f2, t + 0.012, 0.002, 0.09, 0.8); n2.start(t + 0.012);
    const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(600, t + 0.04);
    this._env(o, t, 0.001, 0.04, 0.12); o.start(t); o.stop(t + 0.06);
  }
  vazio() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = 2400;
    this._env(o, t, 0.001, 0.02, 0.08); o.start(t); o.stop(t + 0.03);
  }
  recarga() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    for (const at of [0, 0.5, 0.95]) {
      const n = this._ruido(0.1); const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = at > 0.9 ? 1800 : 1100; f.Q.value = 2;
      n.connect(f); this._env(f, t + at, 0.002, 0.05, 0.5); n.start(t + at);
    }
  }
  impacto() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const n = this._ruido(0.1); const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2000;
    n.connect(f); this._env(f, t + 0.03, 0.001, 0.03, 0.25); n.start(t + 0.03);
  }
  impactoAlien() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.25);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200; o.connect(f);
    this._env(f, t + 0.02, 0.01, 0.25, 0.22); o.start(t + 0.02); o.stop(t + 0.35);
  }
  morteAlien() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(60, t + 1.1);
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 18; const lg = this.ctx.createGain(); lg.gain.value = 60; lfo.connect(lg).connect(o.frequency);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1500; o.connect(f);
    this._env(f, t, 0.02, 1.1, 0.3); o.start(t); lfo.start(t); o.stop(t + 1.2); lfo.stop(t + 1.2);
  }
  soco() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    this._env(o, t, 0.002, 0.2, 0.9); o.start(t); o.stop(t + 0.25);
    const n = this._ruido(0.1); const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    n.connect(f); this._env(f, t, 0.001, 0.06, 0.5); n.start(t);
  }
  revelacao() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    for (const [fr, atraso] of [[220, 0], [277, 0.08], [330, 0.16], [440, 0.24]]) {
      const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(fr * 2, t + atraso);
      o.frequency.exponentialRampToValueAtTime(fr * 0.5, t + atraso + 0.6);
      this._env(o, t + atraso, 0.01, 0.6, 0.18); o.start(t + atraso); o.stop(t + atraso + 0.7);
    }
  }
  inocente() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    for (const [fr, at] of [[392, 0], [370, 0.25], [349, 0.5], [311, 0.75]]) {
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
      this._env(o, t + at, 0.02, 0.4, 0.2); o.start(t + at); o.stop(t + at + 0.5);
    }
  }
  campainha() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    for (const [fr, at] of [[659, 0], [523, 0.35]]) {
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
      this._env(o, t + at, 0.01, 0.9, 0.22); o.start(t + at); o.stop(t + at + 1);
    }
  }
  passo() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const n = this._ruido(0.1); const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
    n.connect(f); this._env(f, t, 0.005, 0.07, 0.18); n.start(t);
  }
  papel() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const n = this._ruido(0.25); const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    n.connect(f); this._env(f, t, 0.01, 0.18, 0.12); n.start(t);
  }
}
