// Som sintetizado. Nenhum arquivo de audio na pasta.
// A paleta e de reparticao: papel, carimbo e madeira. Nada de fantasia.

export class Som {
  constructor() { this.ctx = null; this.mestre = null; }

  acordar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.mestre = this.ctx.createGain();
    this.mestre.gain.value = 0.2;
    this.mestre.connect(this.ctx.destination);
  }

  _voz(tipo, f0, f1, dur, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.mestre);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _ruido(dur, vol, corte, tipo = 'lowpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(); s.buffer = b;
    const f = this.ctx.createBiquadFilter(); f.type = tipo; f.frequency.value = corte;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(this.mestre);
    s.start(t);
  }

  papel() { this._ruido(0.09, 0.14, 3200, 'highpass'); }
  bater() { this._ruido(0.07, 0.22, 900); this._voz('square', 190, 110, 0.07, 0.12); }
  guardar() { this._voz('sine', 260, 400, 0.12, 0.16); this._ruido(0.06, 0.08, 1600); }
  apanhar() { this._voz('sawtooth', 220, 80, 0.2, 0.2); }
  negado() { this._voz('square', 104, 92, 0.07, 0.1); }
  carimbar() { this._ruido(0.11, 0.3, 500); this._voz('square', 120, 70, 0.1, 0.14); }
  deferido() { [523, 784].forEach((f, i) => setTimeout(() => this._voz('triangle', f, f, 0.16, 0.18), i * 110)); }
  fim(venceu) {
    const notas = venceu ? [523, 659, 784, 1047] : [392, 330, 262, 196];
    notas.forEach((f, i) => setTimeout(() => this._voz('triangle', f, f, 0.32, 0.2), i * 170));
  }
}
