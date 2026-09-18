// O robo que joga o GUARDRAIL sozinho. E a prova principal do jogo.
//
// Ele usa `criarJogo`/`passo` e as mesmas funcoes de construir, melhorar,
// trocar modo e acionar habilidade que o navegador usa. O que ele tem a mais e
// paciencia: atravessa as 40 ondas nos tres mapas em segundos, e por isso acha
// o que jogar uma partida boa nao acha.
//
// Ele nao joga bem de proposito. A estrategia e deliberadamente simples — uma
// lista de compras fixa, uma preferencia de caminho por modelo e tres regras de
// compute. Se um robo burro atravessa as 40 ondas, o jogo e vencivel; se ele
// nao atravessa, o problema esta no jogo e nao nele.
//
// Defeitos que este robo achou e que jogar nao acharia:
//  1. VIES sorteado em RUIDO era imortal: nenhuma torre produzia RUIDO.
//  2. OVERFITTING decorava os cinco tipos e virava imortal.
//  3. Muro do LARANJA ficava no mapa depois que o chefe morria.
//  4. Torre sem alvo legitimo mantinha o acumulo do AGENTE LONGO para sempre.

import { LARGURA, ALTURA, podeConstruir } from './mapas.js';
import { TORRE_POR_ID } from './dados.js';
import {
  criarJogo, passo, construir, melhorar, podeMelhorar, custoMelhoria,
  comecarOnda, temProximaOnda, usarHabilidade, custoDe, ocupado, trocarModo,
  comprarGpu, precoGpu, recalcular, DT, TOTAL_ONDAS,
} from './jogo.js';

// A lista de compras. A ordem importa e as ondas de corte tambem: DETECCAO
// precisa estar de pe antes do MODO ANONIMO (onda 6), VETOR antes da ARMADURA
// DE VOLUME (onda 8), ANTIAEREO antes do voador (onda 11) e SEMANTICO antes do
// ESCUDO SEMANTICO (onda 12).
const COMPRAS = [
  'llama', 'llama', 'cobranca', 'haiku', 'qwen', 'gemini', 'haiku',
  'orquestrador', 'sonnet', 'cobranca', 'gemini', 'segura', 'llama',
  'deepseek', 'gpt', 'sonnet', 'segura', 'opus', 'qwen', 'gpt',
  'opus', 'gemini', 'orquestrador', 'opus', 'gpt', 'opus',
];

// Qual caminho subir em cada modelo. O robo escolhe um so e vai ate o fim, que
// e exatamente o que a regra de bloqueio obriga.
const CAMINHO = {
  llama: 0, haiku: 1, gemini: 1, qwen: 1, sonnet: 0,
  deepseek: 1, gpt: 0, opus: 1, segura: 0, orquestrador: 0, cobranca: 0,
};
// O segundo exemplar de cada modelo sobe o outro caminho: e assim que o robo
// cobre deteccao com um QUEM e dano continuo com o outro.
const CAMINHO_ALT = {
  llama: 1, haiku: 0, gemini: 0, qwen: 0, sonnet: 1,
  deepseek: 0, gpt: 1, opus: 0, segura: 1, orquestrador: 1, cobranca: 1,
};

// Quantas celulas de trilha cada laje cobre num dado raio. E o unico "mapa" que
// o robo tem: ele sempre constroi na laje que cobre mais caminho.
function coberturas(mapa) {
  const alvos = [];
  for (const r of mapa.rotas) for (const [x, y] of r.cels) alvos.push([x + 0.5, y + 0.5, 1]);
  // O corredor de voo entra com peso menor: so importa nas ondas de voador,
  // mas entra. Sem ele o robo enfileirava tudo na trilha e perdia treze
  // voadores na onda 11 — a onda punia quem construiu onde o jogo mandou.
  for (const l of mapa.linhasVoo) for (const p of l.pontos) alvos.push([p.x, p.y, 0.5]);
  const lista = [];
  for (const k of mapa.construivel) {
    const x = k % LARGURA;
    const y = Math.floor(k / LARGURA);
    const d = alvos
      .map(([px, py, peso]) => ({ d: Math.hypot(px - (x + 0.5), py - (y + 0.5)), peso }))
      .sort((a, b) => a.d - b.d);
    lista.push({ x, y, d });
  }
  return lista;
}

function melhorLaje(jogo, lajes, alcance) {
  let melhor = null;
  let melhorNota = -1;
  for (const l of lajes) {
    if (ocupado(jogo, l.x, l.y)) continue;
    if (!podeConstruir(jogo.mapa, l.x, l.y)) continue;
    let cobre = 0;
    for (const e of l.d) { if (e.d > alcance) break; cobre += e.peso; }
    if (cobre === 0) continue;
    // Desempate: aproximar as torres umas das outras faz as auras valerem.
    let vizinhas = 0;
    for (const t of jogo.torres) if (Math.hypot(t.cx - l.x - 0.5, t.cy - l.y - 0.5) < 2.6) vizinhas++;
    const nota = cobre + vizinhas * 1.5;
    if (nota > melhorNota) { melhorNota = nota; melhor = l; }
  }
  return melhor;
}

export function robo(opcoes = {}) {
  const jogo = criarJogo(opcoes);
  const lajes = coberturas(jogo.mapa);
  const limiteQuadros = Math.round((opcoes.limite || 60 * 60) / DT);
  const ondaAlvo = opcoes.ondas || (jogo.modo === 'semfim' ? 60 : TOTAL_ONDAS);
  const registro = [];

  let indiceCompra = 0;
  let tDecisao = 0;
  let quadros = 0;
  let ondaRegistrada = 0;

  for (; quadros < limiteQuadros; quadros++) {
    passo(jogo, DT);
    if (jogo.fim) break;
    if (jogo.onda >= ondaAlvo && !jogo.emOnda) break;

    if (jogo.onda > ondaRegistrada) {
      ondaRegistrada = jogo.onda;
      registro.push({
        onda: jogo.onda,
        vidas: jogo.vidas,
        dinheiro: Math.round(jogo.dinheiro),
        torres: jogo.torres.length,
        vram: `${jogo.usoVram.toFixed(1)}/${jogo.capacidadeVram.toFixed(1)}`,
      });
    }

    tDecisao -= DT;
    if (tDecisao > 0) continue;
    tDecisao = 0.4;
    decidir(jogo, lajes, () => indiceCompra, i => { indiceCompra = i; });
  }

  return {
    jogo,
    venceu: jogo.venceu,
    ondasLimpas: jogo.estat.ondasLimpas,
    ondaFinal: jogo.onda,
    vidas: jogo.vidas,
    minutos: quadros * DT / 60,
    torres: jogo.torres.map(t => ({
      tipo: t.tipo, niveis: t.niveis.slice(), modo: t.modoServir,
      abates: t.abates, dano: Math.round(t.danoTotal),
    })),
    registro,
    estat: jogo.estat,
  };
}

function decidir(jogo, lajes, lerIndice, gravarIndice) {
  usarHabilidades(jogo);
  if (cuidarDoCompute(jogo)) return;
  // Largura ate a meta da onda, profundidade depois dela. Sem esse teto o robo
  // compra torre nova para sempre e nunca passa do nivel 1 em nada.
  const alvoTorres = Math.min(COMPRAS.length, 3 + Math.floor(jogo.onda / 2.2));
  if (jogo.torres.length < alvoTorres) {
    if (comprar(jogo, lajes, lerIndice, gravarIndice)) return;
  }
  if (melhorarAlguma(jogo)) return;
  if (comprar(jogo, lajes, lerIndice, gravarIndice)) return;
  anteciparSePuder(jogo);
}

// --- habilidades: gastar quando ha gente na tela, nao guardar para sempre
function usarHabilidades(jogo) {
  const vivas = jogo.pragas.filter(p => !p.morta && !p.estrutura);
  if (!vivas.length) return;
  const chefe = vivas.find(p => p.def.chefe && p.invuln <= 0);
  const adiantadas = vivas.filter(p => p.d / (p.rota.cels.length - 1) > 0.62).length;

  if (adiantadas >= 6) usarHabilidade(jogo, 'ratelimit');
  if (adiantadas >= 9 || (chefe && chefe.hp < chefe.hpMax * 0.35)) usarHabilidade(jogo, 'release');
  if (vivas.length >= 14 || chefe) usarHabilidade(jogo, 'overclock');
}

// --- compute: tres regras, nesta ordem
function cuidarDoCompute(jogo) {
  if (jogo.usoVram <= jogo.capacidadeVram) return false;

  // 1. quantizar o maior consumidor que ainda esta em padrao
  const gordas = jogo.torres
    .filter(t => t.modoServir === 'padrao' && t.st.vram >= 3)
    .sort((a, b) => b.st.vram - a.st.vram);
  if (gordas.length && jogo.dinheiro >= 40) {
    const alvo = gordas[0];
    const modo = TORRE_POR_ID[alvo.tipo].moe ? 'moe' : 'quantizado';
    if (trocarModo(jogo, alvo, modo)) return true;
  }

  // 2. comprar GPU do casaco de couro se sobra dinheiro
  if (jogo.dinheiro >= precoGpu(jogo) + 120) {
    if (comprarGpu(jogo)) return true;
  }

  // 3. subir a capacidade da SEGURA que ja existe
  const seguras = jogo.torres.filter(t => t.tipo === 'segura' && podeMelhorar(t, 0));
  for (const s of seguras) {
    const c = custoMelhoria(s, 0);
    if (jogo.dinheiro >= c && melhorar(jogo, s, 0)) return true;
  }
  return false;
}

function comprar(jogo, lajes, lerIndice, gravarIndice) {
  const i = lerIndice();
  if (i >= COMPRAS.length) return false;
  const tipo = COMPRAS[i];
  const custo = custoDe(jogo, tipo);
  if (jogo.dinheiro < custo) return false;
  const def = TORRE_POR_ID[tipo];
  const laje = melhorLaje(jogo, lajes, def.alcance);
  if (!laje) { gravarIndice(i + 1); return false; }
  const t = construir(jogo, laje.x, laje.y, tipo);
  if (!t) return false;
  gravarIndice(i + 1);
  return true;
}

function melhorarAlguma(jogo) {
  // Sobe a torre que ja esta abatendo mais, no caminho preferido dela. Com
  // "sobe a mais barata" o robo espalhava nivel 1 em tudo e a curva de dano
  // ficava plana: chegava na onda 12 com catorze torres somando 620 de dano
  // por segundo, menos do que tres torres levadas ao nivel 3.
  const reserva = jogo.dinheiro * 0.2;
  const candidatos = [];
  for (const t of jogo.torres) {
    const jaTem = jogo.torres.filter(o => o.tipo === t.tipo);
    const pref = jaTem.indexOf(t) === 0 ? CAMINHO[t.tipo] : CAMINHO_ALT[t.tipo];
    for (const k of [pref, 1 - pref]) {
      if (!podeMelhorar(t, k)) continue;
      const custo = custoMelhoria(t, k);
      if (custo == null || custo > jogo.dinheiro - reserva) continue;
      // Infraestrutura nao abate, entao vale pelo que ela sustenta.
      // O peso mistura o que a torre ja fez com o que ela custou: so por
      // abate, um Llama de 55 dolares com 70 mortes ganhava de um Opus recem
      // comprado e o modelo caro ficava no nivel 0 a partida inteira.
      const peso = t.st.naoAtira
        ? 60 + t.investido * 0.2
        : t.investido * 0.25 + t.abates + t.danoTotal * 0.02;
      candidatos.push({ t, k, peso: peso - (k === pref ? 0 : 70) });
      break;
    }
  }
  if (!candidatos.length) return false;
  candidatos.sort((a, b) => b.peso - a.peso);
  return melhorar(jogo, candidatos[0].t, candidatos[0].k);
}

function anteciparSePuder(jogo) {
  if (jogo.emOnda || !temProximaOnda(jogo)) return;
  // So antecipa quando o caixa esta confortavel: chamar onda cedo sem defesa e
  // a forma mais rapida de perder, e o robo tem que provar o caminho normal.
  const proxCusto = custoDe(jogo, COMPRAS[Math.min(COMPRAS.length - 1, jogo.torres.length)]);
  if (jogo.dinheiro < proxCusto * 1.6) comecarOnda(jogo);
}

export { TOTAL_ONDAS };
