// Som sintetizado. Nenhum arquivo de audio nesta pasta, nem CDN, nem sampler.
//
// Defesa de torre dispara muito: na onda 30 sao facilmente 40 tiros por
// segundo. Por isso todo som de tiro passa por um teto de 1 a cada 55 ms e por
// um limitador no barramento — sem isso a coisa vira serra eletrica, e a
// primeira reacao de quem joga e desligar o som.

export class Som {
  constructor() {
    this.ctx = null;
    this.mestre = null;
    this.ligado = true;
    this.ultimoTiro = 0;
    this.ultimoAcerto = 0;
  }

  acordar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 12;
    this.mestre = this.ctx.createGain();
    this.mestre.gain.value = 0.2;
    this.mestre.connect(comp).connect(this.ctx.destination);
  }

  alternar() {
    this.ligado = !this.ligado;
    if (this.mestre) this.mestre.gain.value = this.ligado ? 0.2 : 0;
    return this.ligado;
  }

  _voz(tipo, f0, f1, dur, vol, atraso = 0) {
    if (!this.ctx || !this.ligado) return;
    const t = this.ctx.currentTime + atraso;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.mestre);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _ruido(dur, vol, corte, tipoFiltro = 'lowpass') {
    if (!this.ctx || !this.ligado) return;
    const t = this.ctx.currentTime;
    const n = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    const f = this.ctx.createBiquadFilter();
    f.type = tipoFiltro;
    f.frequency.value = corte;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    s.connect(f).connect(g).connect(this.mestre);
    s.start(t);
  }

  tiro(tipo) {
    if (!this.ctx || !this.ligado) return;
    const agora = this.ctx.currentTime;
    if (agora - this.ultimoTiro < 0.055) return;
    this.ultimoTiro = agora;
    if (tipo === 'token') this._voz('square', 760, 430, 0.035, 0.05);
    else if (tipo === 'vetor') this._voz('sawtooth', 300, 140, 0.07, 0.055);
    else if (tipo === 'semantico') this._voz('triangle', 520, 880, 0.05, 0.06);
    else if (tipo === 'filtro') this._ruido(0.05, 0.035, 2600, 'bandpass');
    else this._ruido(0.04, 0.03, 1400);
  }

  acerto() {
    if (!this.ctx || !this.ligado) return;
    const agora = this.ctx.currentTime;
    if (agora - this.ultimoAcerto < 0.05) return;
    this.ultimoAcerto = agora;
    this._ruido(0.035, 0.04, 3200, 'highpass');
  }

  estouro() { this._ruido(0.16, 0.09, 900); this._voz('sine', 180, 60, 0.18, 0.07); }
  morreu() { this._ruido(0.06, 0.055, 1800); }
  morreuChefe() { [180, 140, 100, 70].forEach((f, i) => this._voz('sawtooth', f, f * 0.6, 0.3, 0.16, i * 0.09)); }
  construiu() { this._voz('triangle', 320, 620, 0.12, 0.14); this._ruido(0.07, 0.06, 1100); }
  melhorou() { [620, 880, 1180].forEach((f, i) => this._voz('triangle', f, f, 0.1, 0.13, i * 0.055)); }
  vendeu() { [700, 480].forEach((f, i) => this._voz('sine', f, f, 0.1, 0.11, i * 0.06)); }
  negado() { this._voz('square', 120, 96, 0.09, 0.09); }
  vazou() { this._voz('sawtooth', 200, 66, 0.34, 0.2); this._ruido(0.2, 0.09, 600); }
  onda(chefe) {
    if (chefe) [110, 110, 146, 110].forEach((f, i) => this._voz('sawtooth', f, f, 0.24, 0.17, i * 0.2));
    else this._voz('triangle', 260, 420, 0.2, 0.13);
  }
  ondaLimpa() { [660, 880, 1100].forEach((f, i) => this._voz('triangle', f, f, 0.15, 0.13, i * 0.08)); }
  habilidade(id) {
    if (id === 'ratelimit') this._voz('sine', 1400, 300, 0.4, 0.16);
    else if (id === 'release') { this._ruido(0.3, 0.14, 1600); this._voz('sawtooth', 420, 80, 0.4, 0.16); }
    else [440, 660, 990].forEach((f, i) => this._voz('square', f, f * 1.5, 0.14, 0.1, i * 0.05));
  }
  alerta() { this._voz('square', 340, 240, 0.14, 0.11); this._voz('square', 250, 180, 0.16, 0.09, 0.14); }
  corrompeu() { this._voz('sawtooth', 640, 180, 0.28, 0.14); }
  gpu() { [300, 400, 520, 700].forEach((f, i) => this._voz('sine', f, f, 0.12, 0.11, i * 0.06)); }
  fim(venceu) {
    const notas = venceu ? [392, 523, 659, 784, 1047] : [392, 330, 262, 196, 131];
    notas.forEach((f, i) => this._voz('triangle', f, f, 0.34, 0.18, i * 0.16));
  }
}
