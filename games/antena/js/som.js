// Som sintetizado na hora: nenhum arquivo de audio na pasta. O contexto so
// nasce no primeiro gesto do jogador, porque navegador nenhum deixa tocar audio
// antes disso — e tentar rende aquele aviso vermelho no console.

export class Som {
  constructor() {
    this.ctx = null;
    this.mudo = false;
    this.mestre = null;
  }

  acordar() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.mestre = this.ctx.createGain();
    this.mestre.gain.value = 0.22;
    this.mestre.connect(this.ctx.destination);
  }

  _voz(tipo, f0, f1, dur, vol, curva = 'exponential') {
    if (!this.ctx || this.mudo) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) {
      if (curva === 'exponential') osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      else osc.frequency.linearRampToValueAtTime(f1, t + dur);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.mestre);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _ruido(dur, vol, corte) {
    if (!this.ctx || this.mudo) return;
    const t = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = corte;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.mestre);
    src.start(t);
  }

  pular() { this._voz('square', 420, 700, 0.11, 0.3); }
  investir() { this._voz('sawtooth', 780, 180, 0.17, 0.26); this._ruido(0.11, 0.16, 2600); }
  pegar() { this._voz('triangle', 880, 1760, 0.12, 0.3); }
  morrer() { this._voz('square', 300, 60, 0.32, 0.3); this._ruido(0.26, 0.2, 1100); }
  vencer() {
    [660, 880, 1320].forEach((f, i) => {
      setTimeout(() => this._voz('triangle', f, f * 1.5, 0.19, 0.26), i * 95);
    });
  }
  quebrar() { this._ruido(0.17, 0.18, 1700); }
}
