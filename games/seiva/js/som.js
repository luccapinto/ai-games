// Som sintetizado. Nenhum arquivo de audio na pasta.
// Defesa de torre dispara muito tiro por segundo, entao o som de tiro e curto,
// baixo e com teto: sem isso vira serra eletrica na terceira onda.

export class Som {
  constructor() { this.ctx = null; this.mestre = null; this.ultimoTiro = 0; }

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
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.mestre);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _ruido(dur, vol, corte) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(); s.buffer = b;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = corte;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(this.mestre);
    s.start(t);
  }

  // Teto de um tiro a cada 70ms: dez torres atirando juntas viram um som so.
  tiro(tipo) {
    if (!this.ctx) return;
    const agora = this.ctx.currentTime;
    if (agora - this.ultimoTiro < 0.07) return;
    this.ultimoTiro = agora;
    if (tipo === 'ferrao') this._voz('sawtooth', 220, 90, 0.11, 0.16);
    else if (tipo === 'esporo') this._ruido(0.09, 0.09, 1800);
    else if (tipo === 'resina') this._voz('sine', 320, 200, 0.09, 0.10);
    else this._voz('square', 600, 900, 0.045, 0.08);
  }

  plantar() { this._voz('triangle', 300, 520, 0.12, 0.2); this._ruido(0.08, 0.1, 900); }
  melhorar() { [520, 780, 1040].forEach((f, i) => setTimeout(() => this._voz('triangle', f, f, 0.1, 0.18), i * 60)); }
  negado() { this._voz('square', 110, 92, 0.08, 0.12); }
  morreu() { this._ruido(0.07, 0.10, 1400); }
  vazou() { this._voz('sawtooth', 180, 70, 0.3, 0.26); }
  onda() { this._voz('triangle', 260, 400, 0.2, 0.2); }
  ondaLimpa() { [660, 880].forEach((f, i) => setTimeout(() => this._voz('triangle', f, f, 0.16, 0.2), i * 100)); }
  fim(venceu) {
    const notas = venceu ? [523, 659, 784, 1047] : [400, 330, 260, 180];
    notas.forEach((f, i) => setTimeout(() => this._voz('triangle', f, f, 0.3, 0.22), i * 150));
  }
}
