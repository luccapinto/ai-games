// Som procedural com Web Audio. Nenhum arquivo de áudio: ficha, carta,
// embaralhar, roda, bola, rolos, dados, sinetas e o murmúrio do salão saem
// de ruído filtrado, senoides e síntese FM, gerados na hora.

let ctx = null;
let mestre = null, efeitos = null, ambienteBus = null;
let ruidoBranco = null, ruidoRosa = null;
let prefs = { som: true, volume: 0.8, ambiente: true };
let ambienteNos = null;
let rodaNos = null, bolaNos = null, roloNos = null;

function agora() { return ctx.currentTime; }

function criarRuido(tipo) {
  const n = ctx.sampleRate * 2;
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (tipo === 'rosa') {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    } else d[i] = w;
  }
  return b;
}

export function configurar(p) {
  prefs = p;
  aplicarVolume();
}

function aplicarVolume() {
  if (!mestre) return;
  const alvo = prefs.som ? prefs.volume : 0;
  mestre.gain.setTargetAtTime(alvo, agora(), 0.05);
  if (ambienteBus) ambienteBus.gain.setTargetAtTime(prefs.ambiente ? 1 : 0, agora(), 0.3);
}

// O navegador só deixa tocar depois de um gesto do jogador.
export function destravar() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  mestre = ctx.createGain();
  mestre.gain.value = 0;
  efeitos = ctx.createGain(); efeitos.gain.value = 0.9;
  ambienteBus = ctx.createGain(); ambienteBus.gain.value = 0;
  efeitos.connect(mestre); ambienteBus.connect(mestre);
  mestre.connect(comp); comp.connect(ctx.destination);
  ruidoBranco = criarRuido('branco');
  ruidoRosa = criarRuido('rosa');
  aplicarVolume();
  ambiente(prefs.ambiente);
}

export function ativo() { return !!ctx && prefs.som; }

function fonteRuido(buf = ruidoBranco, inicio = 0) {
  const s = ctx.createBufferSource();
  s.buffer = buf; s.loop = true;
  s.loopStart = 0; s.loopEnd = buf.duration;
  s._inicio = inicio;
  return s;
}

function env(g, t, ataque, pico, queda) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + queda);
}

function estalo(t, freq, q, pico, queda, destino = efeitos) {
  const s = fonteRuido();
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  s.connect(f); f.connect(g); g.connect(destino);
  env(g, t, 0.001, pico, queda);
  s.start(t, Math.random() * 1.5); s.stop(t + queda + 0.05);
}

function tom(t, freq, pico, queda, tipo = 'sine', destino = efeitos, fim = null) {
  const o = ctx.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(freq, t);
  if (fim) o.frequency.exponentialRampToValueAtTime(fim, t + queda);
  const g = ctx.createGain();
  o.connect(g); g.connect(destino);
  env(g, t, 0.002, pico, queda);
  o.start(t); o.stop(t + queda + 0.05);
}

// ---------------------------------------------------------------- fichas

export function ficha(n = 1, forca = 1) {
  if (!ativo()) return;
  const t0 = agora();
  const k = Math.min(n, 7);
  for (let i = 0; i < k; i++) {
    const t = t0 + i * (0.028 + Math.random() * 0.03);
    const f = 2600 + Math.random() * 1600;
    estalo(t, f, 9, 0.45 * forca, 0.035);
    tom(t, f * 0.62, 0.12 * forca, 0.05);
    estalo(t, 900 + Math.random() * 300, 3, 0.18 * forca, 0.04);
  }
}

// ---------------------------------------------------------------- cartas

export function carta(forca = 1) {
  if (!ativo()) return;
  const t = agora();
  const s = fonteRuido();
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9;
  f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(1300, t + 0.12);
  const g = ctx.createGain();
  s.connect(f); f.connect(g); g.connect(efeitos);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3 * forca, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  s.start(t, Math.random()); s.stop(t + 0.2);
  estalo(t + 0.12, 1800, 4, 0.12 * forca, 0.03);
}

export function virar() {
  if (!ativo()) return;
  const t = agora();
  estalo(t, 5200, 1.5, 0.16, 0.06);
  estalo(t + 0.05, 2400, 5, 0.2, 0.03);
}

export function embaralhar() {
  if (!ativo()) return;
  const t0 = agora();
  let t = t0;
  for (let i = 0; i < 64; i++) {
    t += 0.022 * (1 - i / 90) + Math.random() * 0.006;
    estalo(t, 2600 + Math.random() * 2600, 6, 0.1 + Math.random() * 0.08, 0.018);
  }
  const s = fonteRuido();
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
  const g = ctx.createGain();
  s.connect(f); f.connect(g); g.connect(efeitos);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  s.start(t); s.stop(t + 0.4);
}

// ---------------------------------------------------------------- roleta

// Ronco contínuo da roda e o rolar da bola no trilho; a mesa ajusta a
// velocidade a cada quadro com rodaVelocidade() e bolaVelocidade().
export function rodaLigar() {
  if (!ativo() || rodaNos) return;
  const s = fonteRuido(ruidoRosa);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 2;
  const g = ctx.createGain(); g.gain.value = 0;
  s.connect(f); f.connect(g); g.connect(efeitos);
  s.start();
  const b = fonteRuido();
  const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 5200; bf.Q.value = 1.2;
  const bg = ctx.createGain(); bg.gain.value = 0;
  b.connect(bf); bf.connect(bg); bg.connect(efeitos);
  b.start();
  rodaNos = { s, f, g }; bolaNos = { s: b, f: bf, g: bg };
}

export function rodaVelocidade(v) {
  if (!rodaNos) return;
  const t = agora();
  rodaNos.g.gain.setTargetAtTime(Math.min(0.35, v * 0.05), t, 0.08);
  rodaNos.f.frequency.setTargetAtTime(180 + v * 60, t, 0.1);
}

export function bolaVelocidade(v) {
  if (!bolaNos) return;
  const t = agora();
  bolaNos.g.gain.setTargetAtTime(Math.min(0.12, v * 0.006), t, 0.05);
  bolaNos.f.frequency.setTargetAtTime(2500 + v * 180, t, 0.08);
}

export function rodaDesligar() {
  if (!rodaNos) return;
  const t = agora();
  for (const n of [rodaNos, bolaNos]) {
    n.g.gain.setTargetAtTime(0, t, 0.2);
    n.s.stop(t + 1.2);
  }
  rodaNos = bolaNos = null;
}

export function quique(forca = 1) {
  if (!ativo()) return;
  const t = agora();
  estalo(t, 3800 + Math.random() * 1500, 12, 0.35 * forca, 0.03);
  tom(t, 1500 + Math.random() * 400, 0.1 * forca, 0.04);
}

export function tiqueTrasto(forca = 0.5) {
  if (!ativo()) return;
  estalo(agora(), 4200 + Math.random() * 800, 14, 0.2 * forca, 0.018);
}

export function assentar() {
  if (!ativo()) return;
  const t = agora();
  estalo(t, 2600, 10, 0.4, 0.05);
  estalo(t + 0.07, 3400, 12, 0.18, 0.03);
  tom(t, 180, 0.12, 0.15);
}

// ---------------------------------------------------------------- caça-níquel

export function rolosLigar() {
  if (!ativo() || roloNos) return;
  const s = fonteRuido(ruidoRosa);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 1.5;
  const g = ctx.createGain(); g.gain.value = 0;
  s.connect(f); f.connect(g); g.connect(efeitos);
  s.start();
  g.gain.setTargetAtTime(0.14, agora(), 0.05);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 22;
  const lg = ctx.createGain(); lg.gain.value = 0.06;
  lfo.connect(lg); lg.connect(g.gain); lfo.start();
  roloNos = { s, g, lfo };
}

export function rolosDesligar() {
  if (!roloNos) return;
  const t = agora();
  roloNos.g.gain.setTargetAtTime(0, t, 0.06);
  roloNos.s.stop(t + 0.5); roloNos.lfo.stop(t + 0.5);
  roloNos = null;
}

export function paradaRolo(i = 0) {
  if (!ativo()) return;
  const t = agora();
  tom(t, 110 - i * 6, 0.35, 0.12, 'sine', efeitos, 60);
  estalo(t, 1800 + i * 150, 6, 0.35, 0.04);
  estalo(t + 0.012, 5200, 8, 0.12, 0.02);
}

export function antecipacao(duracao = 1.6) {
  if (!ativo()) return;
  const t = agora();
  const o = ctx.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(330, t); o.frequency.exponentialRampToValueAtTime(880, t + duracao);
  const trem = ctx.createOscillator(); trem.frequency.value = 14;
  const tg = ctx.createGain(); tg.gain.value = 0.05;
  const g = ctx.createGain(); g.gain.value = 0.0001;
  trem.connect(tg); tg.connect(g.gain);
  o.connect(g); g.connect(efeitos);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.3);
  g.gain.setValueAtTime(0.09, t + duracao - 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
  o.start(t); trem.start(t); o.stop(t + duracao + 0.05); trem.stop(t + duracao + 0.05);
}

// ---------------------------------------------------------------- sinetas

function sino(t, freq, pico = 0.25, queda = 1.4) {
  const c = ctx.createOscillator(); c.frequency.value = freq;
  const m = ctx.createOscillator(); m.frequency.value = freq * 3.5;
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(freq * 2.2, t); mg.gain.exponentialRampToValueAtTime(freq * 0.05, t + queda);
  m.connect(mg); mg.connect(c.frequency);
  const g = ctx.createGain();
  c.connect(g); g.connect(efeitos);
  env(g, t, 0.003, pico, queda);
  c.start(t); m.start(t); c.stop(t + queda + 0.1); m.stop(t + queda + 0.1);
}

const ESCALA = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98, 2093];

export function sineta(nivel = 1) {
  if (!ativo()) return;
  const t = agora();
  sino(t, ESCALA[Math.min(ESCALA.length - 1, 2 + nivel)], 0.2, 1.1);
}

// Prêmio proporcional: nível 1 é um acerto, 5 é a tela respirando.
export function vitoria(nivel = 1) {
  if (!ativo()) return;
  const t0 = agora();
  const notas = Math.min(ESCALA.length, 2 + nivel);
  for (let i = 0; i < notas; i++) sino(t0 + i * 0.09, ESCALA[i], 0.16 + nivel * 0.02, 0.9 + nivel * 0.2);
  if (nivel >= 3) {
    for (let r = 0; r < nivel * 3; r++) {
      const t = t0 + 0.5 + r * 0.11;
      sino(t, ESCALA[(r * 3) % ESCALA.length] * (r % 2 ? 1 : 2), 0.08, 0.6);
    }
  }
}

export function derrota() {
  if (!ativo()) return;
  const t = agora();
  tom(t, 196, 0.08, 0.4, 'triangle', efeitos, 150);
}

// ---------------------------------------------------------------- dados

export function dado(forca = 1) {
  if (!ativo()) return;
  const t = agora();
  estalo(t, 520, 2, 0.35 * forca, 0.05);
  estalo(t, 2300 + Math.random() * 900, 7, 0.3 * forca, 0.03);
}

export function dadosNaMao() {
  if (!ativo()) return;
  const t0 = agora();
  for (let i = 0; i < 6; i++) estalo(t0 + i * 0.05 + Math.random() * 0.02, 2600 + Math.random() * 800, 8, 0.12, 0.02);
}

// ---------------------------------------------------------------- interface

export function clique() {
  if (!ativo()) return;
  estalo(agora(), 3000, 5, 0.08, 0.015);
}

export function negado() {
  if (!ativo()) return;
  const t = agora();
  tom(t, 140, 0.1, 0.12, 'square', efeitos, 110);
}

// ---------------------------------------------------------------- salão

// Murmúrio de salão: ruído rosa em duas faixas de voz com modulação lenta,
// uma nota grave de sala e, de vez em quando, fichas e taças ao longe.
export function ambiente(ligar = true) {
  if (!ctx) return;
  if (!ligar) {
    if (ambienteNos) { ambienteNos.parar(); ambienteNos = null; }
    return;
  }
  if (ambienteNos) return;
  const nos = [];
  for (const [freq, q, nivel, lfoF] of [[420, 0.8, 0.05, 0.11], [900, 1.1, 0.03, 0.17], [1700, 1.4, 0.012, 0.23]]) {
    const s = fonteRuido(ruidoRosa);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = nivel;
    const lfo = ctx.createOscillator(); lfo.frequency.value = lfoF;
    const lg = ctx.createGain(); lg.gain.value = nivel * 0.6;
    lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(ambienteBus);
    s.start(0, Math.random() * 1.5); lfo.start();
    nos.push(s, lfo);
  }
  const zumbido = ctx.createOscillator(); zumbido.frequency.value = 55;
  const zg = ctx.createGain(); zg.gain.value = 0.008;
  zumbido.connect(zg); zg.connect(ambienteBus); zumbido.start();
  nos.push(zumbido);
  let vivo = true;
  function longe() {
    if (!vivo) return;
    const t = agora();
    if (Math.random() < 0.6) {
      for (let i = 0; i < 2 + Math.floor(Math.random() * 4); i++) estalo(t + i * 0.04, 3000 + Math.random() * 1200, 10, 0.03, 0.03, ambienteBus);
    } else {
      sinoLonge(t);
    }
    setTimeout(longe, 1800 + Math.random() * 4200);
  }
  function sinoLonge(t) {
    const o = ctx.createOscillator(); o.frequency.value = 2200 + Math.random() * 1400;
    const g = ctx.createGain(); o.connect(g); g.connect(ambienteBus);
    env(g, t, 0.002, 0.012, 0.8);
    o.start(t); o.stop(t + 0.9);
  }
  setTimeout(longe, 1200);
  ambienteNos = {
    parar() {
      vivo = false;
      const t = agora();
      for (const n of nos) { try { n.stop(t + 0.3); } catch { /* já parou */ } }
    },
  };
}

export function mudo() { return !prefs.som; }
