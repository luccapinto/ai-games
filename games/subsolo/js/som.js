// Som sintetizado em WebAudio. A pasta nao tem um arquivo de audio.
//
// A mina tem um zumbido de fundo e pingos de agua espacados: e o que faz o
// silencio ficar audivel — e num jogo em que ruido e mecanica, o jogador precisa
// ouvir a diferenca entre o proprio passo e o passo que vem do corredor.

let ctx = null;
let mestre = null;
let zumbido = null;
let ligado = true;

function contexto() {
  if (!ctx) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return null;
    ctx = new Audio();
    mestre = ctx.createGain();
    mestre.gain.value = 0.55;
    mestre.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function ruidoBranco(duracao) {
  const c = contexto();
  const quadros = Math.max(1, Math.floor(c.sampleRate * duracao));
  const buffer = c.createBuffer(1, quadros, c.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < quadros; i++) dados[i] = Math.random() * 2 - 1;
  return buffer;
}

function envelope(no, volume, ataque, queda) {
  const c = contexto();
  const g = c.createGain();
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(volume, c.currentTime + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + ataque + queda);
  no.connect(g);
  g.connect(mestre);
  return g;
}

function estouro({ duracao = 0.2, volume = 0.5, corte = 1800, tipo = 'lowpass', q = 1 }) {
  const c = contexto();
  if (!c || !ligado) return;
  const fonte = c.createBufferSource();
  fonte.buffer = ruidoBranco(duracao);
  const filtro = c.createBiquadFilter();
  filtro.type = tipo;
  filtro.frequency.value = corte;
  filtro.Q.value = q;
  fonte.connect(filtro);
  envelope(filtro, volume, 0.004, duracao);
  fonte.start();
  fonte.stop(c.currentTime + duracao + 0.05);
}

function tom({ de, para, duracao = 0.2, volume = 0.3, onda = 'square' }) {
  const c = contexto();
  if (!c || !ligado) return;
  const osc = c.createOscillator();
  osc.type = onda;
  osc.frequency.setValueAtTime(de, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, para), c.currentTime + duracao);
  envelope(osc, volume, 0.005, duracao);
  osc.start();
  osc.stop(c.currentTime + duracao + 0.05);
}

const EFEITOS = {
  picareta: () => { estouro({ duracao: 0.09, volume: 0.32, corte: 900 }); tom({ de: 180, para: 70, duracao: 0.1, volume: 0.16, onda: 'triangle' }); },
  pineira: () => { estouro({ duracao: 0.06, volume: 0.3, corte: 3200, tipo: 'bandpass', q: 1.4 }); tom({ de: 700, para: 320, duracao: 0.06, volume: 0.1 }); },
  espingarda: () => { estouro({ duracao: 0.34, volume: 0.62, corte: 1400 }); tom({ de: 120, para: 40, duracao: 0.28, volume: 0.22, onda: 'sawtooth' }); },
  macarico: () => estouro({ duracao: 0.1, volume: 0.16, corte: 2600, tipo: 'bandpass', q: 0.8 }),
  vazio: () => tom({ de: 320, para: 200, duracao: 0.06, volume: 0.12 }),
  passo: () => estouro({ duracao: 0.05, volume: 0.1, corte: 620 }),
  passoAgua: () => estouro({ duracao: 0.13, volume: 0.2, corte: 2200, tipo: 'bandpass', q: 0.6 }),
  dano: () => { estouro({ duracao: 0.2, volume: 0.42, corte: 500 }); tom({ de: 160, para: 55, duracao: 0.24, volume: 0.24, onda: 'triangle' }); },
  abate: () => tom({ de: 420, para: 60, duracao: 0.4, volume: 0.24, onda: 'sawtooth' }),
  acerto: () => estouro({ duracao: 0.05, volume: 0.16, corte: 2000, tipo: 'bandpass' }),
  item: () => { tom({ de: 640, para: 900, duracao: 0.1, volume: 0.16, onda: 'triangle' }); },
  porta: () => { estouro({ duracao: 0.4, volume: 0.24, corte: 800 }); tom({ de: 90, para: 60, duracao: 0.4, volume: 0.12, onda: 'sawtooth' }); },
  trancada: () => tom({ de: 140, para: 130, duracao: 0.22, volume: 0.2, onda: 'square' }),
  segredo: () => { tom({ de: 520, para: 780, duracao: 0.18, volume: 0.2, onda: 'triangle' }); setTimeout(() => tom({ de: 780, para: 1040, duracao: 0.22, volume: 0.18, onda: 'triangle' }), 120); },
  lanterna: () => estouro({ duracao: 0.04, volume: 0.14, corte: 4200, tipo: 'highpass' }),
  semPilha: () => tom({ de: 220, para: 110, duracao: 0.3, volume: 0.16, onda: 'square' }),
  cuspe: () => estouro({ duracao: 0.16, volume: 0.22, corte: 1800, tipo: 'bandpass', q: 2 }),
  inflando: () => tom({ de: 180, para: 460, duracao: 0.45, volume: 0.12, onda: 'sine' }),
  elevador: () => { tom({ de: 70, para: 46, duracao: 1.4, volume: 0.24, onda: 'sawtooth' }); estouro({ duracao: 1.2, volume: 0.14, corte: 340 }); },
  morreu: () => { tom({ de: 200, para: 30, duracao: 1.2, volume: 0.32, onda: 'sawtooth' }); estouro({ duracao: 0.9, volume: 0.24, corte: 400 }); },
  travado: () => tom({ de: 110, para: 100, duracao: 0.3, volume: 0.18, onda: 'square' }),
};

export function tocar(nome) {
  const fn = EFEITOS[nome];
  if (fn && contexto()) fn();
}

// O zumbido do subsolo: dois osciladores desafinados num filtro baixo. Sobe de
// volume nas fases fundas, que e como o jogo diz "voce esta mais longe da boca".
export function ambiente(profundidade = 0) {
  const c = contexto();
  if (!c) return;
  if (zumbido) {
    zumbido.ganho.gain.setTargetAtTime(0.05 + profundidade * 0.05, c.currentTime, 1.5);
    return;
  }
  const ganho = c.createGain();
  ganho.gain.value = 0.05 + profundidade * 0.05;
  const filtro = c.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 220;
  const a = c.createOscillator();
  a.type = 'sawtooth';
  a.frequency.value = 54;
  const b = c.createOscillator();
  b.type = 'sine';
  b.frequency.value = 39.5;
  a.connect(filtro);
  b.connect(filtro);
  filtro.connect(ganho);
  ganho.connect(mestre);
  a.start();
  b.start();
  zumbido = { ganho, a, b };

  const pingo = () => {
    if (!ligado) return;
    estouro({ duracao: 0.05, volume: 0.06, corte: 3600, tipo: 'bandpass', q: 6 });
    setTimeout(pingo, 3200 + Math.random() * 6000);
  };
  setTimeout(pingo, 2500);
}

export function alternarSom() {
  ligado = !ligado;
  if (mestre) mestre.gain.value = ligado ? 0.55 : 0;
  return ligado;
}

export function somLigado() {
  return ligado;
}
