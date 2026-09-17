// Motor de kart, pneu e impacto sintetizados em WebAudio. Nenhum arquivo de
// audio.
//
// Motor de kart nao soa como motor de carro, e a diferenca e simples de
// descrever: dois tempos de 14 mil giros, sem torque embaixo, com uma nota alta
// e nervosa. Por isso a base de frequencia aqui e mais alta e o desafino entre
// os osciladores e maior do que num carro — o batimento entre eles e o que da a
// impressao de motor pequeno trabalhando duro.
//
// A frequencia acompanha o mesmo `rpm` que a fisica calcula: se o som e o kart
// discordam, um dos dois esta mentindo.

import { KART } from './fisica.js';

let ctx = null;
let mestre = null;
let motor = null;
let guincho = null;
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

function ruidoBranco(segundos) {
  const c = contexto();
  const quadros = Math.max(1, Math.floor(c.sampleRate * segundos));
  const buffer = c.createBuffer(1, quadros, c.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < quadros; i++) dados[i] = Math.random() * 2 - 1;
  return buffer;
}

export function ligarMotor() {
  const c = contexto();
  if (!c || motor) return;
  const ganho = c.createGain();
  ganho.gain.value = 0;
  const filtro = c.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 900;
  filtro.Q.value = 1.2;
  const osc = [];
  for (const [tipo, desafino] of [['sawtooth', 1], ['square', 0.51], ['sawtooth', 2.03]]) {
    const o = c.createOscillator();
    o.type = tipo;
    o.frequency.value = 60 * desafino;
    const g = c.createGain();
    g.gain.value = desafino === 0.5 ? 0.35 : 0.5;
    o.connect(g);
    g.connect(filtro);
    o.start();
    osc.push({ o, desafino });
  }
  filtro.connect(ganho);
  ganho.connect(mestre);
  motor = { ganho, filtro, osc };

  // Guincho de pneu: ruido em passa-banda, com ganho controlado pela
  // derrapagem. Fica sempre no ar, em volume zero.
  const fonte = c.createBufferSource();
  fonte.buffer = ruidoBranco(2);
  fonte.loop = true;
  const banda = c.createBiquadFilter();
  banda.type = 'bandpass';
  banda.frequency.value = 1400;
  banda.Q.value = 5;
  const gGuincho = c.createGain();
  gGuincho.gain.value = 0;
  fonte.connect(banda);
  banda.connect(gGuincho);
  gGuincho.connect(mestre);
  fonte.start();
  guincho = { ganho: gGuincho, banda };
}

export function atualizarMotor(carro, superficie) {
  if (!motor || !ctx || !ligado) return;
  const giro = carro.rpm / KART.rpmMax;
  const base = 96 + giro * 330;
  for (const { o, desafino } of motor.osc) {
    o.frequency.setTargetAtTime(base * desafino, ctx.currentTime, 0.04);
  }
  const carga = Math.min(1, Math.abs(carro.vx) / 40 + giro * 0.6);
  motor.ganho.gain.setTargetAtTime(0.1 + carga * 0.16, ctx.currentTime, 0.08);
  motor.filtro.frequency.setTargetAtTime(500 + giro * 2600, ctx.currentTime, 0.06);

  const naGrama = superficie === 'grama' || superficie === 'muro';
  const nivel = naGrama
    ? 0.13
    : Math.max(0, carro.derrapagem - 0.28) * 0.2;
  guincho.ganho.gain.setTargetAtTime(nivel, ctx.currentTime, 0.05);
  guincho.banda.frequency.setTargetAtTime(naGrama ? 600 : 1200 + carro.derrapagem * 900,
    ctx.currentTime, 0.08);
}

export function pararMotor() {
  if (!motor || !ctx) return;
  motor.ganho.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  if (guincho) guincho.ganho.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
}

function estouro({ duracao = 0.2, volume = 0.4, corte = 1200, tipo = 'lowpass', q = 1 }) {
  const c = contexto();
  if (!c || !ligado) return;
  const fonte = c.createBufferSource();
  fonte.buffer = ruidoBranco(duracao);
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

function tom({ de, para, duracao = 0.2, volume = 0.25, onda = 'square' }) {
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
  // Carga do mini-turbo e o empurrao: dois sons, porque sao duas informacoes
  // diferentes — "esta carregando" e "saiu".
  turbo: () => {
    tom({ de: 520, para: 1500, duracao: 0.26, volume: 0.26, onda: 'square' });
    estouro({ duracao: 0.42, volume: 0.3, corte: 2600, tipo: 'bandpass', q: 1.4 });
  },
  item: () => {
    tom({ de: 880, para: 1320, duracao: 0.1, volume: 0.2, onda: 'triangle' });
    setTimeout(() => tom({ de: 1320, para: 1760, duracao: 0.12, volume: 0.18, onda: 'triangle' }), 90);
  },
  batida: () => { estouro({ duracao: 0.3, volume: 0.55, corte: 780 }); tom({ de: 150, para: 52, duracao: 0.26, volume: 0.22, onda: 'sawtooth' }); },
  fim: () => { tom({ de: 520, para: 780, duracao: 0.3, volume: 0.24, onda: 'triangle' }); setTimeout(() => tom({ de: 780, para: 1180, duracao: 0.4, volume: 0.24, onda: 'triangle' }), 220); },
  toque: () => { estouro({ duracao: 0.14, volume: 0.42, corte: 900 }); tom({ de: 220, para: 90, duracao: 0.12, volume: 0.2, onda: 'triangle' }); },
  muro: () => { estouro({ duracao: 0.36, volume: 0.6, corte: 700 }); tom({ de: 140, para: 50, duracao: 0.3, volume: 0.24, onda: 'sawtooth' }); },
  volta: () => { tom({ de: 700, para: 1050, duracao: 0.14, volume: 0.2, onda: 'triangle' }); },
  melhorVolta: () => { tom({ de: 700, para: 1400, duracao: 0.2, volume: 0.22, onda: 'triangle' }); setTimeout(() => tom({ de: 1050, para: 1700, duracao: 0.24, volume: 0.2, onda: 'triangle' }), 140); },
  luz: () => tom({ de: 480, para: 480, duracao: 0.16, volume: 0.22, onda: 'square' }),
  largada: () => tom({ de: 900, para: 900, duracao: 0.5, volume: 0.26, onda: 'square' }),
  box: () => estouro({ duracao: 0.6, volume: 0.2, corte: 2400, tipo: 'bandpass', q: 2 }),
  bandeirada: () => { tom({ de: 520, para: 780, duracao: 0.3, volume: 0.24, onda: 'triangle' }); setTimeout(() => tom({ de: 780, para: 1180, duracao: 0.4, volume: 0.24, onda: 'triangle' }), 220); },
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
