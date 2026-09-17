// O jogo inteiro, sem uma linha de desenho.
//
// `main.js` so traduz teclado para `entrada` e le o estado para pintar. Tudo que
// decide alguma coisa — andar, atirar, ouvir, abrir, morrer, sair — acontece
// aqui, com passo logico fixo. E por isso que provas.mjs pode jogar de verdade.

import { FASES } from './fases.js';
import { CONFIG, ITENS, criarSorteio } from './regras.js';
import * as M from './mapa.js';
import { ARMAS, ORDEM, tracar } from './armas.js';
import { TIPOS, criarInimigo, passoInimigo, ferirInimigo } from './inimigos.js';

export { CONFIG } from './regras.js';

// 60 Hz fixo. Fase calibrada num monitor nao pode virar outra fase noutro.
export const DT = 1 / 60;

export function entradaNula() {
  return {
    frente: 0, lado: 0, girar: 0,
    agachado: false, correndo: false,
    atirar: false, usar: false, lanterna: false, trocar: null,
  };
}

export function criarJogo(indiceFase, opcoes = {}) {
  const fase = FASES[indiceFase];
  if (!fase) throw new Error(`fase ${indiceFase} nao existe`);
  const mapa = M.carregar(fase);
  const herdado = opcoes.herdado || null;

  const jogador = {
    x: mapa.inicio.x, y: mapa.inicio.y, ang: mapa.inicio.ang || 0,
    vx: 0, vy: 0,
    vida: herdado ? herdado.vida : CONFIG.vidaMax,
    bateria: herdado ? herdado.bateria : CONFIG.bateriaEntrada,
    lanterna: false, agachado: false,
    arma: herdado ? herdado.arma : 'picareta',
    armas: herdado ? { ...herdado.armas } : { picareta: true, pineira: true },
    municao: herdado ? { ...herdado.municao } : { ...CONFIG.municaoInicial },
    crachas: new Set(),
    recarga: 0, brilho: 0, dor: 0, tremor: 0, andado: 0, avisoPorta: 0,
  };

  return {
    fase: indiceFase, nome: mapa.nome, mapa, jogador,
    inimigos: mapa.inimigos.map(e => criarInimigo(e.tipo, e.x, e.y)),
    itens: mapa.itens,
    projeteis: [], ruidos: [], eventos: [],
    sorteio: criarSorteio(opcoes.semente || 20260917),
    tempo: 0, estado: 'jogando', abatidos: 0, segredos: 0, coletados: 0,
  };
}

export function passo(jogo, entrada, dt = DT) {
  jogo.eventos.length = 0;
  jogo.ruidos.length = 0;
  if (jogo.estado !== 'jogando') return jogo.eventos;

  const j = jogo.jogador;
  jogo.tempo += dt;
  j.brilho = Math.max(0, j.brilho - dt * 3.2);
  j.dor = Math.max(0, j.dor - dt * 2);
  j.tremor = Math.max(0, j.tremor - dt * 4);
  j.recarga = Math.max(0, j.recarga - dt);
  j.avisoPorta = Math.max(0, j.avisoPorta - dt);

  if (entrada.lanterna) alternarLanterna(jogo);
  if (entrada.trocar !== null && entrada.trocar !== undefined) trocarArma(jogo, entrada.trocar);

  j.ang = normalizar(j.ang + entrada.girar);
  j.agachado = !!entrada.agachado;

  andar(jogo, entrada, dt);
  gastarLanterna(jogo, dt);
  if (entrada.usar) usar(jogo);
  if (entrada.atirar) atirar(jogo);
  pegarItens(jogo);

  const ctx = contexto(jogo);
  for (const e of jogo.inimigos) passoInimigo(e, ctx, dt);
  moverProjeteis(jogo, dt);

  conferirSaida(jogo);
  if (j.vida <= 0 && jogo.estado === 'jogando') {
    jogo.estado = 'morto';
    jogo.eventos.push({ tipo: 'morreu' });
  }
  return jogo.eventos;
}

// ------------------------------------------------------------- movimento

function andar(jogo, entrada, dt) {
  const j = jogo.jogador;
  const vel = entrada.agachado ? CONFIG.velAgachar
    : entrada.correndo ? CONFIG.velCorrer : CONFIG.velAndar;

  const cos = Math.cos(j.ang);
  const sen = Math.sin(j.ang);
  let dx = cos * entrada.frente - sen * entrada.lado;
  let dy = sen * entrada.frente + cos * entrada.lado;
  const norma = Math.hypot(dx, dy);
  if (norma > 1) { dx /= norma; dy /= norma; }

  if (norma > 1e-6) {
    const k = Math.min(1, CONFIG.aceleracao * dt);
    j.vx += (dx * vel - j.vx) * k;
    j.vy += (dy * vel - j.vy) * k;
  } else {
    const k = Math.max(0, 1 - CONFIG.atrito * dt);
    j.vx *= k;
    j.vy *= k;
  }

  const antesX = j.x;
  const antesY = j.y;
  deslocar(jogo, j.vx * dt, j.vy * dt);
  const andado = Math.hypot(j.x - antesX, j.y - antesY);
  if (andado < 1e-5) { j.vx *= 0.2; j.vy *= 0.2; }

  // Ruido de passo: sai a cada `passoRuido` celulas percorridas, e nao por
  // quadro — senao andar devagar faria mais ruido que correr, por ter mais
  // quadros dentro da mesma distancia.
  j.andado += andado;
  if (j.andado >= CONFIG.passoRuido) {
    j.andado -= CONFIG.passoRuido;
    const naAgua = M.tile(jogo.mapa, Math.floor(j.x), Math.floor(j.y)) === M.T.POCA;
    let forca = entrada.agachado ? CONFIG.ruidoAgachar
      : entrada.correndo ? CONFIG.ruidoCorrer : CONFIG.ruidoAndar;
    if (naAgua) forca += CONFIG.ruidoAgua;
    emitirRuido(jogo, j.x, j.y, forca);
    if (forca > 0) jogo.eventos.push({ tipo: 'passo', agua: naAgua, forca });
  }
}

function deslocar(jogo, dx, dy) {
  const j = jogo.jogador;
  const r = CONFIG.raioJogador;
  if (!colide(jogo, j.x + dx, j.y, r)) j.x += dx;
  else { tocarParede(jogo, j.x + dx, j.y, r); j.vx = 0; }
  if (!colide(jogo, j.x, j.y + dy, r)) j.y += dy;
  else { tocarParede(jogo, j.x, j.y + dy, r); j.vy = 0; }
}

function colide(jogo, x, y, r) {
  for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
    if (M.solido(jogo.mapa, Math.floor(x + ox), Math.floor(y + oy))) return true;
  }
  return false;
}

// Porta comum e porta cujo cracha esta no bolso abrem no encosto. Parede falsa
// nao: segredo que abre sozinho ao raspar na parede deixa de ser segredo.
function tocarParede(jogo, x, y, r) {
  const j = jogo.jogador;
  for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
    const cx = Math.floor(x + ox);
    const cy = Math.floor(y + oy);
    const porta = M.portaEm(jogo.mapa, cx, cy);
    if (!porta || porta.aberta || porta.falsa) continue;
    if (porta.cracha && !j.crachas.has(porta.cracha)) {
      if (j.avisoPorta <= 0) {
        j.avisoPorta = 1.4;
        jogo.eventos.push({ tipo: 'trancada', cracha: porta.cracha });
      }
      continue;
    }
    porta.aberta = true;
    jogo.eventos.push({ tipo: 'porta', x: cx, y: cy });
    emitirRuido(jogo, cx + 0.5, cy + 0.5, 8);
  }
}

// -------------------------------------------------------------- lanterna

function alternarLanterna(jogo) {
  const j = jogo.jogador;
  if (!j.lanterna && j.bateria <= 0) {
    jogo.eventos.push({ tipo: 'sem-pilha' });
    return;
  }
  j.lanterna = !j.lanterna;
  jogo.eventos.push({ tipo: 'lanterna', ligada: j.lanterna });
}

function gastarLanterna(jogo, dt) {
  const j = jogo.jogador;
  if (!j.lanterna) return;
  j.bateria -= CONFIG.gastoLanterna * dt;
  if (j.bateria <= 0) {
    j.bateria = 0;
    j.lanterna = false;
    jogo.eventos.push({ tipo: 'sem-pilha' });
  }
}

// ----------------------------------------------------------------- armas

function trocarArma(jogo, pedido) {
  const j = jogo.jogador;
  let nome = null;
  if (typeof pedido === 'number') {
    nome = ORDEM.find(k => ARMAS[k].chave === pedido) || null;
  } else if (pedido === 'proxima' || pedido === 'anterior') {
    const tenho = ORDEM.filter(k => j.armas[k]);
    const i = tenho.indexOf(j.arma);
    const passo = pedido === 'proxima' ? 1 : -1;
    nome = tenho[(i + passo + tenho.length) % tenho.length];
  } else if (typeof pedido === 'string') {
    nome = pedido;
  }
  if (!nome || !j.armas[nome] || nome === j.arma) return;
  j.arma = nome;
  j.recarga = Math.max(j.recarga, 0.18);
  jogo.eventos.push({ tipo: 'trocou', arma: nome });
}

function atirar(jogo) {
  const j = jogo.jogador;
  if (j.recarga > 0) return;
  const arma = ARMAS[j.arma];
  if (arma.municao && j.municao[arma.municao] < arma.gasto) {
    jogo.eventos.push({ tipo: 'vazio', arma: j.arma });
    j.recarga = 0.3;
    return;
  }
  j.recarga = arma.cadencia;
  if (arma.municao) j.municao[arma.municao] -= arma.gasto;
  j.brilho = Math.max(j.brilho, arma.clarao);
  jogo.eventos.push({ tipo: 'tiro', arma: j.arma });
  if (arma.ruido > 0) emitirRuido(jogo, j.x, j.y, arma.ruido);

  for (let p = 0; p < arma.pelotas; p++) {
    const desvio = (jogo.sorteio() - 0.5) * arma.espalhamento
      + (arma.pelotas > 1 ? (p / (arma.pelotas - 1) - 0.5) * arma.espalhamento * 0.8 : 0);
    const ang = j.ang + desvio;
    const dir = { x: Math.cos(ang), y: Math.sin(ang) };
    const acerto = tracar(jogo.mapa, j, dir, arma.alcance, jogo.inimigos);
    if (acerto.tipo === 'inimigo') {
      const aplicado = ferirInimigo(acerto.alvo, arma.dano);
      jogo.eventos.push({
        tipo: 'acerto', alvo: acerto.alvo, dano: aplicado,
        x: acerto.alvo.x, y: acerto.alvo.y,
        blindado: aplicado < arma.dano,
      });
      // O grito e o preco de matar: ate a picareta, silenciosa, avisa os
      // vizinhos de que algo morreu ali.
      emitirRuido(jogo, acerto.alvo.x, acerto.alvo.y, 7);
      if (acerto.alvo.vida <= 0) {
        jogo.abatidos++;
        jogo.eventos.push({ tipo: 'abate', alvo: acerto.alvo });
      }
    } else if (acerto.tipo === 'parede') {
      jogo.eventos.push({
        tipo: 'faisca', x: j.x + dir.x * acerto.distancia, y: j.y + dir.y * acerto.distancia,
      });
    }
  }
}

// ------------------------------------------------------------------ usar

function usar(jogo) {
  const j = jogo.jogador;
  const alvoX = j.x + Math.cos(j.ang) * 0.85;
  const alvoY = j.y + Math.sin(j.ang) * 0.85;
  const cx = Math.floor(alvoX);
  const cy = Math.floor(alvoY);
  const resultado = M.usarPorta(jogo.mapa, cx, cy, j.crachas);
  if (resultado === 'nada') return;
  if (resultado === 'segredo') {
    jogo.segredos++;
    jogo.eventos.push({ tipo: 'segredo', x: cx, y: cy });
  } else if (resultado === 'abriu') {
    jogo.eventos.push({ tipo: 'porta', x: cx, y: cy });
    emitirRuido(jogo, cx + 0.5, cy + 0.5, 8);
  } else if (resultado.startsWith('falta-')) {
    jogo.eventos.push({ tipo: 'trancada', cracha: resultado.slice(6) });
  }
}

// ----------------------------------------------------------------- itens

function pegarItens(jogo) {
  const j = jogo.jogador;
  for (const item of jogo.itens) {
    if (item.pego) continue;
    if (Math.hypot(item.x - j.x, item.y - j.y) > 0.6) continue;

    if (item.tipo === 'kit') {
      if (j.vida >= CONFIG.vidaMax) continue;
      j.vida = Math.min(CONFIG.vidaMax, j.vida + item.qtd);
    } else if (item.tipo === 'pilha') {
      if (j.bateria >= CONFIG.bateriaMax) continue;
      j.bateria = Math.min(CONFIG.bateriaMax, j.bateria + item.qtd);
    } else if (item.tipo === 'cracha') {
      j.crachas.add(item.cracha);
    } else if (item.tipo === 'arma') {
      j.armas[item.arma] = true;
      j.arma = item.arma;
    } else {
      const max = CONFIG.municaoMax[item.tipo];
      if (j.municao[item.tipo] >= max) continue;
      j.municao[item.tipo] = Math.min(max, j.municao[item.tipo] + item.qtd);
    }
    item.pego = true;
    jogo.coletados++;
    jogo.eventos.push({ tipo: 'item', rotulo: item.rotulo, item });
  }
}

// ------------------------------------------------------------- inimigos

function contexto(jogo) {
  return {
    mapa: jogo.mapa,
    jogador: jogo.jogador,
    ruidos: jogo.ruidos,
    inimigos: jogo.inimigos,
    sorteio: jogo.sorteio,
    ferir: (dano, origem) => ferirJogador(jogo, dano, origem),
    cuspir: (inimigo, dir) => {
      jogo.projeteis.push({
        x: inimigo.x + dir.x * 0.5, y: inimigo.y + dir.y * 0.5,
        vx: dir.x * 7.2, vy: dir.y * 7.2,
        dano: TIPOS[inimigo.tipo].dano, vida: 2.4,
      });
      jogo.eventos.push({ tipo: 'cuspe', x: inimigo.x, y: inimigo.y });
      emitirRuido(jogo, inimigo.x, inimigo.y, 6);
    },
    sinal: (tipo, inimigo) => {
      jogo.eventos.push({ tipo, x: inimigo.x, y: inimigo.y, inimigo });
    },
  };
}

function moverProjeteis(jogo, dt) {
  const j = jogo.jogador;
  for (let i = jogo.projeteis.length - 1; i >= 0; i--) {
    const p = jogo.projeteis[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vida -= dt;
    // 0,38 e o raio de acerto do cuspe. Em 0,45 nao havia desvio possivel:
    // andar de lado durante o voo do projetil nao saia do corpo dele.
    if (Math.hypot(p.x - j.x, p.y - j.y) < 0.38) {
      ferirJogador(jogo, p.dano, p);
      jogo.projeteis.splice(i, 1);
    } else if (p.vida <= 0 || M.solido(jogo.mapa, Math.floor(p.x), Math.floor(p.y))) {
      jogo.eventos.push({ tipo: 'espirro', x: p.x, y: p.y });
      jogo.projeteis.splice(i, 1);
    }
  }
}

function ferirJogador(jogo, dano, origem) {
  const j = jogo.jogador;
  if (jogo.estado !== 'jogando') return;
  j.vida -= dano;
  j.dor = 1;
  j.tremor = Math.min(1, j.tremor + dano / 40);
  jogo.eventos.push({ tipo: 'dano', dano, origem });
  if (origem && origem.x !== undefined) {
    const d = Math.hypot(j.x - origem.x, j.y - origem.y) || 1;
    deslocar(jogo, ((j.x - origem.x) / d) * CONFIG.empurraoMorte * 0.12,
      ((j.y - origem.y) / d) * CONFIG.empurraoMorte * 0.12);
  }
}

// ----------------------------------------------------------------- saida

function conferirSaida(jogo) {
  const e = jogo.mapa.elevador;
  if (!e) return;
  const j = jogo.jogador;
  if (Math.floor(j.x) !== e.x || Math.floor(j.y) !== e.y) return;
  if (jogo.mapa.exigeCapataz) {
    const chefe = jogo.inimigos.find(i => TIPOS[i.tipo].chefe);
    if (chefe && chefe.vida > 0) {
      if (j.avisoPorta <= 0) {
        j.avisoPorta = 1.4;
        jogo.eventos.push({ tipo: 'elevador-travado' });
      }
      return;
    }
  }
  jogo.estado = 'saiu';
  jogo.eventos.push({ tipo: 'saiu' });
}

function emitirRuido(jogo, x, y, forca) {
  if (forca <= 0) return;
  jogo.ruidos.push({
    x, y, forca,
    campo: M.alcanceRuido(jogo.mapa, { x, y }, forca),
  });
}

function normalizar(ang) {
  while (ang > Math.PI) ang -= Math.PI * 2;
  while (ang < -Math.PI) ang += Math.PI * 2;
  return ang;
}

// O que passa de uma fase para a proxima: vida, pilha, arma e municao. Cracha
// nao passa — cada nivel tem o proprio chaveiro.
//
// A vida tem piso ao entrar numa fase nova, e isso e uma decisao, nao descuido:
// sem piso, sair de uma fase com 20 de vida significa comecar a seguinte morto
// de antemao — o robo de prova morreu assim tres vezes seguidas na CORREIA,
// com 31 de vida herdados da BOMBAS. Descer de elevador e o respiro.
export function herdar(jogo) {
  const j = jogo.jogador;
  return {
    vida: Math.max(j.vida, CONFIG.pisoDeVidaAoDescer),
    bateria: j.bateria, arma: j.arma,
    armas: { ...j.armas }, municao: { ...j.municao },
  };
}
