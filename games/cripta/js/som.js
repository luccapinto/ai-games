// Som sintetizado. Nenhum arquivo de audio na pasta.
// Puzzle por turnos vive de resposta: cada jogada precisa soar diferente de
// "nao deu", senao a pessoa nao sabe se o comando entrou.

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
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
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
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = corte;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(this.mestre);
    s.start(t);
  }

  passo() { this._ruido(0.05, 0.10, 900); }
  empurrar() { this._ruido(0.17, 0.20, 620); this._voz('sine', 110, 82, 0.15, 0.14); }
  subir() { this._voz('triangle', 300, 470, 0.10, 0.18); }
  cair() { this._ruido(0.14, 0.24, 420); this._voz('sine', 150, 60, 0.18, 0.18); }
  encaixar() { this._voz('triangle', 720, 1080, 0.16, 0.24); this._voz('sine', 1440, 1440, 0.1, 0.09); }
  desfazer() { this._voz('sine', 520, 300, 0.11, 0.16); }
  bloqueado() { this._voz('square', 96, 84, 0.07, 0.10); }
  vencer() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._voz('triangle', f, f, 0.2, 0.2), i * 105)); }
}
