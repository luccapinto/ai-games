// Som sintetizado. Nenhum arquivo de audio na pasta.
// Jogo de deducao e silencioso por natureza: o som aqui so confirma o toque,
// e por isso e curto e discreto. Cristal, nao fanfarra.

export class Som {
  constructor() { this.ctx = null; this.mestre = null; }

  acordar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.mestre = this.ctx.createGain();
    this.mestre.gain.value = 0.16;
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
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.mestre);
    o.start(t); o.stop(t + dur + 0.02);
  }

  girar() { this._voz('sine', 900, 1180, 0.05, 0.10); }
  erro() { this._voz('triangle', 300, 180, 0.22, 0.2); }
  acerto() { [659, 880, 1319].forEach((f, i) => setTimeout(() => this._voz('sine', f, f, 0.26, 0.17), i * 130)); }
}
