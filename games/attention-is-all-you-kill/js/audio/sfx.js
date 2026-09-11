// sfx.js — áudio 100% sintetizado em WebAudio.
// Decisão de design: o jogo não baixa nenhum arquivo de som.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.lastFootstep = 0;
    this.ambientNodes = null;
  }

  // Precisa ser chamado dentro de um gesto do usuario (politica dos navegadores).
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _now() { return this.ctx.currentTime; }

  // Buffer de ruido reaproveitado por todos os tiros.
  // Nome do cache e _noiseBuf de propósito: this._noise e um metodo da classe,
  // então usar o mesmo nome aqui retornaria a função em vez do buffer.
  _noiseBuffer(duration = 0.5) {
    if (!this._noiseBuf) {
      const len = Math.floor(this.ctx.sampleRate * duration);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this._noiseBuf = buf;
    }
    return this._noiseBuf;
  }

  _noise(duration, filterFreq, gain, type = 'lowpass', detune = 0) {
    if (!this.ctx || !this.enabled) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer();
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    filter.detune.value = detune;

    const g = this.ctx.createGain();
    const t = this._now();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  _tone(freq, duration, gain, type = 'sine', slideTo = null) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    const t = this._now();
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + duration);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  // ---------------- armas do jogador ----------------

  shot(kind) {
    if (!this.ctx) return;
    switch (kind) {
      case 'smg':
        this._noise(0.07, 2600, 0.20, 'bandpass');
        this._tone(220, 0.05, 0.10, 'square', 120);
        break;
      case 'shotgun':
        this._noise(0.34, 900, 0.42, 'lowpass');
        this._tone(90, 0.24, 0.28, 'sawtooth', 42);
        break;
      default:
        this._noise(0.11, 1900, 0.28, 'bandpass');
        this._tone(320, 0.07, 0.14, 'square', 160);
    }
  }

  dryFire() {
    this._tone(140, 0.04, 0.06, 'square', 90);
  }

  reloadStart() {
    this._tone(180, 0.06, 0.10, 'square', 240);
  }

  reloadEnd() {
    this._tone(300, 0.07, 0.12, 'square', 200);
    this._noise(0.05, 3200, 0.08, 'highpass');
  }

  // ---------------- impacto e dano ----------------

  impact() {
    this._noise(0.07, 3200, 0.13, 'highpass');
  }

  hitEnemy(def) {
    // modelo caro soa mais grave e mais pesado
    const tier = def ? def.tier : 2;
    const freq = tier >= 3 ? 180 : (tier === 2 ? 320 : 520);
    this._tone(freq, 0.05, 0.12, 'triangle', freq * 0.6);
  }

  enemyDeath(def) {
    const tier = def ? def.tier : 2;
    const base = tier >= 3 ? 300 : 520;
    // arpejo descendente: dado quebrando
    this._tone(base, 0.10, 0.13, 'triangle', base * 0.5);
    setTimeout(() => this._tone(base * 0.7, 0.12, 0.10, 'triangle', base * 0.35), 60);
    setTimeout(() => this._tone(base * 0.5, 0.16, 0.08, 'sine', base * 0.22), 120);
  }

  enemyShot(def) {
    const tier = def ? def.tier : 2;
    if (tier >= 3) {
      this._tone(150, 0.16, 0.16, 'sawtooth', 70);
      this._noise(0.20, 700, 0.14, 'lowpass');
    } else {
      this._tone(420, 0.05, 0.08, 'square', 260);
    }
  }

  alert(def) {
    const tier = def ? def.tier : 2;
    this._tone(tier >= 3 ? 260 : 620, 0.08, 0.07, 'sine', tier >= 3 ? 200 : 700);
  }

  playerHurt() {
    this._noise(0.16, 520, 0.30, 'lowpass');
    this._tone(120, 0.16, 0.16, 'sawtooth', 60);
  }

  pickup() {
    this._tone(660, 0.07, 0.12, 'sine', 880);
    setTimeout(() => this._tone(990, 0.09, 0.10, 'sine', 1320), 55);
  }

  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.18, 0.11, 'triangle', f), i * 80);
    });
  }

  footstep() {
    this._noise(0.05, 420, 0.045, 'lowpass');
  }

  // ---------------- ambiente ----------------

  startAmbient() {
    if (!this.ctx || this.ambientNodes) return;
    // drone de sala de servidor: duas notas graves com LFO
    const t = this._now();
    const g = this.ctx.createGain();
    g.gain.value = 0.055;
    g.connect(this.master);

    const o1 = this.ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 55;
    const f1 = this.ctx.createBiquadFilter();
    f1.type = 'lowpass';
    f1.frequency.value = 210;

    const o2 = this.ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = 82.4;

    // ventoinha: ruido rosa filtrado
    const fan = this.ctx.createBufferSource();
    fan.buffer = this._noiseBuffer();
    fan.loop = true;
    const fanFilter = this.ctx.createBiquadFilter();
    fanFilter.type = 'bandpass';
    fanFilter.frequency.value = 480;
    const fanGain = this.ctx.createGain();
    fanGain.gain.value = 0.035;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(g.gain);

    o1.connect(f1).connect(g);
    o2.connect(g);
    fan.connect(fanFilter).connect(fanGain).connect(this.master);

    o1.start(t); o2.start(t); fan.start(t); lfo.start(t);

    this.ambientNodes = { g, o1, o2, fan, lfo, fanGain };
  }

  // Batimento cardiaco quando o contexto esta baixo.
  heartbeat(intensity) {
    const g = 0.05 + intensity * 0.12;
    this._tone(52, 0.13, g, 'sine', 38);
    setTimeout(() => this._tone(46, 0.16, g * 0.8, 'sine', 32), 160);
  }

  stopAmbient() {
    if (!this.ambientNodes) return;
    try {
      this.ambientNodes.o1.stop();
      this.ambientNodes.o2.stop();
      this.ambientNodes.fan.stop();
      this.ambientNodes.lfo.stop();
    } catch (e) { /* já parado */ }
    this.ambientNodes = null;
  }
}