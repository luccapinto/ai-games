// Som do sertao, sintetizado. Vento continuo que muda de corpo com a hora,
// cigarra ao meio-dia, e os efeitos curtos de golpe, gole e recado.
//
// A cigarra nao e enfeite: ela e o aviso sonoro de que o calor esta no pico, e o
// calor e o que gasta a agua do cantil.

let ctx = null;
let mestre = null;
let vento = null;
let cigarra = null;
let ligado = true;

function contexto() {
  if (!ctx) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return null;
    ctx = new Audio();
    mestre = ctx.createGain();
    mestre.gain.value = 0.5;
    mestre.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function ruido(segundos) {
  const c = contexto();
  const quadros = Math.max(1, Math.floor(c.sampleRate * segundos));
  const buffer = c.createBuffer(1, quadros, c.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < quadros; i++) dados[i] = Math.random() * 2 - 1;
  return buffer;
}

export function ligarAmbiente() {
  const c = contexto();
  if (!c || vento) return;

  const fonte = c.createBufferSource();
  fonte.buffer = ruido(3);
  fonte.loop = true;
  const filtro = c.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 420;
  const ganho = c.createGain();
  ganho.gain.value = 0.06;
  fonte.connect(filtro);
  filtro.connect(ganho);
  ganho.connect(mestre);
  fonte.start();
  vento = { ganho, filtro };

  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 3200;
  const passa = c.createBiquadFilter();
  passa.type = 'bandpass';
  passa.frequency.value = 3400;
  passa.Q.value = 9;
  const g = c.createGain();
  g.gain.value = 0;
  osc.connect(passa);
  passa.connect(g);
  g.connect(mestre);
  osc.start();
  cigarra = { ganho: g, osc };
}

export function atualizarAmbiente(calor, claridade) {
  if (!ctx || !vento) return;
  vento.ganho.gain.setTargetAtTime(0.04 + (1 - claridade) * 0.05, ctx.currentTime, 1.2);
  vento.filtro.frequency.setTargetAtTime(320 + claridade * 380, ctx.currentTime, 1.5);
  cigarra.ganho.gain.setTargetAtTime(Math.max(0, calor - 0.45) * 0.012, ctx.currentTime, 1.5);
}

function estouro({ duracao = 0.2, volume = 0.4, corte = 1200, tipo = 'lowpass', q = 1 }) {
  const c = contexto();
  if (!c || !ligado) return;
  const fonte = c.createBufferSource();
  fonte.buffer = ruido(duracao);
  const filtro = c.createBiquadFilter();
  filtro.type = tipo;
  filtro.frequency.value = corte;
  filtro.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(volume, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duracao);
  fonte.connect(filtro);
  filtro.connect(g);
  g.connect(mestre);
  fonte.start();
  fonte.stop(c.currentTime + duracao + 0.05);
}

function tom({ de, para, duracao = 0.2, volume = 0.22, onda = 'triangle' }) {
  const c = contexto();
  if (!c || !ligado) return;
  const osc = c.createOscillator();
  osc.type = onda;
  osc.frequency.setValueAtTime(de, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, para), c.currentTime + duracao);
  const g = c.createGain();
  g.gain.setValueAtTime(volume, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duracao);
  osc.connect(g);
  g.connect(mestre);
  osc.start();
  osc.stop(c.currentTime + duracao + 0.05);
}

const EFEITOS = {
  golpe: () => estouro({ duracao: 0.09, volume: 0.22, corte: 1600, tipo: 'bandpass', q: 1.2 }),
  acerto: () => { estouro({ duracao: 0.12, volume: 0.32, corte: 900 }); tom({ de: 200, para: 90, duracao: 0.1, volume: 0.14 }); },
  abate: () => tom({ de: 340, para: 70, duracao: 0.45, volume: 0.2, onda: 'sawtooth' }),
  dano: () => { estouro({ duracao: 0.18, volume: 0.4, corte: 600 }); tom({ de: 150, para: 60, duracao: 0.2, volume: 0.2 }); },
  bebeu: () => { estouro({ duracao: 0.28, volume: 0.2, corte: 2200, tipo: 'bandpass', q: 3 }); tom({ de: 420, para: 700, duracao: 0.2, volume: 0.12, onda: 'sine' }); },
  'sem-agua': () => tom({ de: 220, para: 170, duracao: 0.16, volume: 0.12, onda: 'square' }),
  pegou: () => tom({ de: 620, para: 880, duracao: 0.1, volume: 0.14 }),
  fala: () => tom({ de: 380, para: 440, duracao: 0.1, volume: 0.1, onda: 'square' }),
  'missao-aceita': () => { tom({ de: 480, para: 660, duracao: 0.16, volume: 0.18 }); },
  'missao-concluida': () => { tom({ de: 600, para: 900, duracao: 0.2, volume: 0.2 }); setTimeout(() => tom({ de: 900, para: 1240, duracao: 0.26, volume: 0.18 }), 150); },
  'missao-aberta': () => tom({ de: 520, para: 520, duracao: 0.12, volume: 0.12, onda: 'square' }),
  apareceu: () => tom({ de: 180, para: 120, duracao: 0.3, volume: 0.16, onda: 'sawtooth' }),
  morreu: () => { tom({ de: 220, para: 40, duracao: 1.4, volume: 0.3, onda: 'sawtooth' }); estouro({ duracao: 1, volume: 0.2, corte: 400 }); },
  venceu: () => {
    for (const [i, f] of [440, 550, 660, 880].entries()) {
      setTimeout(() => tom({ de: f, para: f * 1.5, duracao: 0.4, volume: 0.2 }), i * 180);
    }
  },
};

export function tocar(nome) {
  const fn = EFEITOS[nome];
  if (fn && contexto()) fn();
}

export function alternarSom() {
  ligado = !ligado;
  if (mestre) mestre.gain.value = ligado ? 0.5 : 0;
  return ligado;
}

export function somLigado() {
  return ligado;
}
