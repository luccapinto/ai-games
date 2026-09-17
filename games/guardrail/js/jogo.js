// O GUARDRAIL inteiro, sem uma linha de DOM.
//
// Defesa de torre e um jogo de numero: "parece equilibrado" mente sempre, e a
// unica forma de saber se a onda 31 e vencivel e rodar a onda 31. Por isso a
// simulacao mora aqui sozinha — o navegador e o robo de provas.mjs rodam
// exatamente este arquivo, com o mesmo passo fixo de 1/60.
//
// O que este modulo nao faz: desenhar, ler tecla, tocar som, saber que existe
// uma tela. Ele produz `jogo.eventos` e `jogo.feed`; quem quiser que desenhe.

import { MAPA_POR_ID, posicaoNaRota, podeConstruir, LARGURA, ALTURA } from './mapas.js';
import {
  TORRE_POR_ID, PRAGAS, MODOS, HABILIDADES, HABILIDADE_POR_ID,
  INFLACAO, RETORNO_VENDA, TROCA_DE_MODO, AQUECIMENTO_MODO,
  GPU_BASE, GPU_INFLACAO, GPU_VRAM, ORDEM_DANOS,
} from './dados.js';
import { definirOnda, TOTAL_ONDAS } from './ondas.js';
import { frase } from './noticias.js';

export const DT = 1 / 60;

// `vel` nas pragas e uma nota, nao uma unidade. Isto converte para celulas por
// segundo: com 1,7 a ALUCINACAO cruza o DATACENTER em 27 segundos, que e o
// tempo que uma onda de abertura deve durar.
export const VEL_CELULAS = 1.7;

const VEL_TIRO = 15;          // celulas por segundo
const RAIO_ACERTO = 0.42;     // celulas
const DURACAO_DOT = 4;
const DURACAO_MARCA = 3;
const DURACAO_LENTIDAO = 2.5;
const CURA_CORROMPIDA = 12;
const RAIO_CORROMPIDA = 2.5;
const RAIO_INJECAO = 1.3;
const TETO_FEED = 60;

// Tempo de preparo entre ondas. A onda seguinte comeca sozinha quando ele
// zera; chamar antes paga 2,5 vezes o que sobrou, entao antecipar e uma
// decisao de economia e nao um botao de conveniencia.
export const PREPARO_ENTRE_ONDAS = 18;
export const PREPARO_INICIAL = 30;

// ---------------------------------------------------------------- utilidades

function gerador(semente) {
  let s = (semente >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

// -------------------------------------------------------------- criar partida

export function criarJogo(opcoes = {}) {
  const mapa = MAPA_POR_ID[opcoes.mapa || 'datacenter'];
  if (!mapa) throw new Error(`mapa desconhecido: ${opcoes.mapa}`);
  const modo = opcoes.modo === 'semfim' ? 'semfim' : 'campanha';
  const semente = opcoes.semente || 20260917;

  const jogo = {
    mapa, modo, semente,
    rnd: gerador(semente),
    tempo: 0,
    vidas: mapa.vidas,
    vidasMax: mapa.vidas,
    dinheiro: mapa.dinheiro,
    onda: 0,
    emOnda: false,
    fim: false,
    venceu: false,
    tOnda: 0,
    preparo: PREPARO_INICIAL,
    fila: [],
    torres: [],
    pragas: [],
    tiros: [],
    proxId: 1,
    contagem: {},             // quantas torres de cada tipo ja foram compradas
    capacidadeBase: mapa.vram,
    capacidadeVram: mapa.vram,
    vramCapturada: 0,
    usoVramTorres: 0,
    usoVram: 0,
    estrangulamento: 1,
    amortece: 0,
    estavaEstourado: false,
    overclock: 0,
    ressaca: 0,
    penalidade: 0,
    gpuQuente: false,
    centralTravada: 0,
    ratelimitsRestantes: 0,
    proxRatelimit: 0,
    loja: { compras: 0, desconto: 0 },
    habilidades: HABILIDADES.map(h => ({ id: h.id, recarga: 0, pronta: true })),
    eventos: [],
    feed: [],
    estat: {
      mortas: 0, vazadas: 0, gasto: 0, ganho: 0, roubado: 0,
      tiros: 0, errados: 0, danoPorTipo: {}, ondasLimpas: 0, vazouPorTipo: {},
    },
    aviso: null,
  };
  for (const t of ORDEM_DANOS) jogo.estat.danoPorTipo[t] = 0;
  noticia(jogo, 'abertura', {});
  recalcular(jogo);
  return jogo;
}

function noticia(jogo, chave, ctx) {
  const texto = frase(chave, ctx, jogo.rnd);
  jogo.feed.push({ t: jogo.tempo, onda: jogo.onda, texto, chave });
  if (jogo.feed.length > TETO_FEED) jogo.feed.shift();
}

function evento(jogo, tipo, dados) {
  jogo.eventos.push({ tipo, ...dados });
}

export function consumirEventos(jogo) {
  const e = jogo.eventos;
  jogo.eventos = [];
  return e;
}

// ------------------------------------------------------------------- economia

export function custoDe(jogo, tipo) {
  const base = TORRE_POR_ID[tipo].custo;
  const n = jogo.contagem[tipo] || 0;
  return Math.round(base * Math.pow(INFLACAO, n));
}

export function valorDeVenda(t) {
  return Math.round(t.investido * RETORNO_VENDA);
}

export function precoGpu(jogo) {
  const bruto = GPU_BASE * Math.pow(GPU_INFLACAO, jogo.loja.compras);
  return Math.round(bruto * (1 - jogo.loja.desconto));
}

export function comprarGpu(jogo) {
  const preco = precoGpu(jogo);
  if (jogo.dinheiro < preco || jogo.centralTravada > 0) { evento(jogo, 'negado', {}); return false; }
  jogo.dinheiro -= preco;
  jogo.estat.gasto += preco;
  jogo.loja.compras++;
  jogo.capacidadeVram += GPU_VRAM;
  noticia(jogo, 'gpu', { preco, vram: GPU_VRAM });
  evento(jogo, 'gpu', {});
  recalcular(jogo);
  return true;
}

// -------------------------------------------------------------------- torres

export function torreEm(jogo, x, y) {
  return jogo.torres.find(t => t.x === x && t.y === y) || null;
}

export function ocupado(jogo, x, y) {
  if (torreEm(jogo, x, y)) return true;
  return jogo.pragas.some(p => p.estrutura && !p.muro && p.cx === x && p.cy === y);
}

export function construir(jogo, x, y, tipo) {
  if (jogo.fim || jogo.centralTravada > 0) { evento(jogo, 'negado', {}); return null; }
  const def = TORRE_POR_ID[tipo];
  if (!def) return null;
  if (!podeConstruir(jogo.mapa, x, y) || ocupado(jogo, x, y)) { evento(jogo, 'negado', {}); return null; }
  const custo = custoDe(jogo, tipo);
  if (jogo.dinheiro < custo) { evento(jogo, 'negado', {}); return null; }

  jogo.dinheiro -= custo;
  jogo.estat.gasto += custo;
  jogo.contagem[tipo] = (jogo.contagem[tipo] || 0) + 1;
  const t = {
    uid: jogo.proxId++,
    tipo, x, y,
    cx: x + 0.5, cy: y + 0.5,
    niveis: [0, 0],
    modoServir: 'padrao',
    aquecendo: 0,
    recarga: 0,
    mirando: 0,
    alvo: null,
    acumulo: 0,
    rotIdx: 0,
    moeFlip: false,
    corrompida: 0,
    desligada: 0,
    investido: custo,
    abates: 0,
    danoTotal: 0,
    angulo: 0,
  };
  jogo.torres.push(t);
  noticia(jogo, 'comprou', { torre: def.nome, custo });
  evento(jogo, 'construiu', { tipo });
  recalcular(jogo);
  return t;
}

export function podeMelhorar(t, caminho) {
  const nivel = t.niveis[caminho];
  if (nivel >= 3) return false;
  const outro = t.niveis[1 - caminho];
  if (nivel >= 1 && outro >= 2) return false;
  return true;
}

export function custoMelhoria(t, caminho) {
  const def = TORRE_POR_ID[t.tipo];
  const nivel = t.niveis[caminho];
  if (nivel >= 3) return null;
  return def.caminhos[caminho].niveis[nivel].custo;
}

export function melhorar(jogo, t, caminho) {
  if (jogo.fim || jogo.centralTravada > 0) { evento(jogo, 'negado', {}); return false; }
  if (!podeMelhorar(t, caminho)) { evento(jogo, 'negado', {}); return false; }
  const custo = custoMelhoria(t, caminho);
  if (jogo.dinheiro < custo) { evento(jogo, 'negado', {}); return false; }
  jogo.dinheiro -= custo;
  jogo.estat.gasto += custo;
  t.investido += custo;
  t.niveis[caminho]++;
  const def = TORRE_POR_ID[t.tipo];
  noticia(jogo, 'melhorou', {
    torre: def.nome, caminho: def.caminhos[caminho].nome, nivel: t.niveis[caminho],
  });
  evento(jogo, 'melhorou', {});
  recalcular(jogo);
  return true;
}

export function vender(jogo, t) {
  if (jogo.centralTravada > 0) { evento(jogo, 'negado', {}); return false; }
  const i = jogo.torres.indexOf(t);
  if (i < 0) return false;
  const valor = valorDeVenda(t);
  jogo.torres.splice(i, 1);
  jogo.dinheiro += valor;
  jogo.estat.ganho += valor;
  jogo.contagem[t.tipo] = Math.max(0, (jogo.contagem[t.tipo] || 1) - 1);
  noticia(jogo, 'vendeu', { torre: TORRE_POR_ID[t.tipo].nome, valor });
  evento(jogo, 'vendeu', {});
  recalcular(jogo);
  return true;
}

export function trocarModo(jogo, t, modo) {
  if (!MODOS[modo]) return false;
  if (modo === 'moe' && !TORRE_POR_ID[t.tipo].moe) return false;
  if (modo === t.modoServir) return false;
  if (jogo.dinheiro < TROCA_DE_MODO || jogo.centralTravada > 0) { evento(jogo, 'negado', {}); return false; }
  jogo.dinheiro -= TROCA_DE_MODO;
  jogo.estat.gasto += TROCA_DE_MODO;
  t.modoServir = modo;
  t.aquecendo = AQUECIMENTO_MODO;
  evento(jogo, 'modo', {});
  recalcular(jogo);
  return true;
}

export function modosDisponiveis(tipo) {
  const def = TORRE_POR_ID[tipo];
  return ['padrao', 'quantizado', 'batch', 'offload'].concat(def.moe ? ['moe'] : []);
}

// ------------------------------------------------------- atributos e auras
//
// Duas passadas. A primeira aplica caminhos de upgrade e modo de servir; a
// segunda aplica as auras das torres vizinhas. Sao separadas porque o raio da
// aura depende do alcance base de quem emite, e nao do alcance ja buffado —
// senao duas torres de aura se realimentam.

const SOMAVEIS = [
  'dano', 'alcance', 'vram', 'area', 'perfura', 'alvos', 'dot', 'capacidade',
  'rendaOnda', 'rendaMorte', 'auraCadencia', 'auraDano', 'auraErro', 'auraAlcance',
  'auraRaio', 'auraFuraResist', 'auraIgnoraRecusa', 'marca', 'lentidao', 'revela',
  'furaResist', 'crescimento', 'crescimentoTeto', 'recargaPorMorte',
  'amorteceEstrangulamento',
];

function zerado(def) {
  return {
    dano: def.dano || 0,
    cadencia: def.cadencia || 0,
    alcance: def.alcance || 0,
    mira: def.mira || 0,
    erro: def.erro || 0,
    vram: def.vram || 0,
    area: def.area || 0,
    perfura: def.perfura || 0,
    alvos: 1,
    dot: def.dot || 0,
    capacidade: def.capacidade || 0,
    rendaOnda: def.rendaOnda || 0,
    rendaMorte: 0,
    auraCadencia: def.auraCadencia || 0,
    auraDano: 0, auraErro: 0, auraAlcance: 0, auraRaio: 0,
    auraFuraResist: 0, auraIgnoraRecusa: 0,
    marca: 0, lentidao: 0, revela: 0, furaResist: 0,
    crescimento: 0, crescimentoTeto: 0, recargaPorMorte: 0,
    amorteceEstrangulamento: 0,
    tipoDano: def.tipoDano || 'token',
    deteccao: !!def.deteccao,
    antiaereo: !!def.antiaereo,
    recusa: !!def.recusa,
    naoAtira: !!def.naoAtira,
    auraDeteccao: false, auraAntiaereo: false, auraImune: false, auraSemMira: false,
    crescimentoFixo: false,
    roteador: null,
  };
}

function aplicarEfeito(a, e) {
  for (const k of SOMAVEIS) if (k in e) a[k] += e[k];
  if ('cadenciaMult' in e) a.cadencia *= e.cadenciaMult;
  if ('danoMult' in e) a.dano *= e.danoMult;
  if ('miraMult' in e) a.mira *= e.miraMult;
  if ('erroMult' in e) a.erro *= e.erroMult;
  if ('tipoDano' in e) a.tipoDano = e.tipoDano;
  if (e.deteccao) a.deteccao = true;
  if (e.antiaereo) a.antiaereo = true;
  if (e.semRecusa) a.recusa = false;
  if (e.auraDeteccao) a.auraDeteccao = true;
  if (e.auraAntiaereo) a.auraAntiaereo = true;
  if (e.auraImune) a.auraImune = true;
  if (e.auraSemMira) a.auraSemMira = true;
  if (e.crescimentoFixo) a.crescimentoFixo = true;
  if (e.roteador) a.roteador = e.roteador;
}

export function recalcular(jogo) {
  // passada 1: base + upgrades + modo de servir
  for (const t of jogo.torres) {
    const def = TORRE_POR_ID[t.tipo];
    const a = zerado(def);
    for (let c = 0; c < def.caminhos.length; c++) {
      for (let n = 0; n < t.niveis[c]; n++) aplicarEfeito(a, def.caminhos[c].niveis[n].efeito);
    }
    const m = MODOS[t.modoServir];
    a.vram = Math.max(0.5, a.vram * m.vram);
    a.dano *= m.dano;
    a.cadencia *= m.cadencia;
    a.mira *= m.mira;
    a.alternado = m.alternado || 0;
    a.vram = Math.round(a.vram * 10) / 10;
    t.st = a;
  }

  // passada 2: auras
  let capacidade = jogo.mapa.vram + jogo.loja.compras * GPU_VRAM;
  let amortece = 0;
  let uso = 0;
  for (const t of jogo.torres) {
    const a = { ...t.st };
    a.protegida = false;
    a.imuneInjection = false;
    for (const o of jogo.torres) {
      if (o === t) continue;
      const raio = o.st.auraRaio || o.st.alcance;
      const d2 = dist2(t.cx, t.cy, o.cx, o.cy);
      if (d2 > raio * raio) continue;
      if (o.st.auraCadencia) a.cadencia *= 1 + o.st.auraCadencia;
      if (o.st.auraDano) a.dano *= 1 + o.st.auraDano;
      if (o.st.auraErro) a.erro *= 1 - Math.min(0.95, o.st.auraErro);
      if (o.st.auraAlcance) a.alcance += o.st.auraAlcance;
      if (o.st.auraDeteccao) a.deteccao = true;
      if (o.st.auraAntiaereo) a.antiaereo = true;
      if (o.st.auraImune) a.imuneInjection = true;
      if (o.st.auraSemMira) a.mira = 0;
      if (o.st.auraFuraResist) a.furaResist = Math.max(a.furaResist, o.st.auraFuraResist);
      if (o.st.auraIgnoraRecusa && d2 <= o.st.auraIgnoraRecusa * o.st.auraIgnoraRecusa) a.recusa = false;
      if (TORRE_POR_ID[o.tipo].id === 'segura' && d2 <= o.st.alcance * o.st.alcance) a.protegida = true;
    }
    a.furaResist = Math.min(0.95, a.furaResist);
    a.erro = Math.max(0, Math.min(0.9, a.erro));
    t.at = a;
    capacidade += t.st.capacidade;
    amortece = Math.max(amortece, t.st.amorteceEstrangulamento);
    uso += t.st.vram;
  }
  // `capacidadeBase` e o teto que voce comprou; `capacidadeVram` e o teto que
  // voce tem agora, ja descontado o que o OOM KILLER sequestrou neste quadro.
  jogo.capacidadeBase = Math.round(capacidade * 10) / 10;
  jogo.capacidadeVram = Math.round((capacidade - (jogo.vramCapturada || 0)) * 10) / 10;
  jogo.usoVramTorres = Math.round(uso * 10) / 10;
  jogo.amortece = amortece;
}

// ---------------------------------------------------------------------- ondas

export function proximaOndaNumero(jogo) {
  return jogo.onda + 1;
}

export function temProximaOnda(jogo) {
  if (jogo.fim) return false;
  if (jogo.modo === 'semfim') return true;
  return jogo.onda < TOTAL_ONDAS;
}

export function comecarOnda(jogo) {
  if (!temProximaOnda(jogo)) return false;
  // Antecipar onda paga um bonus: quem chama a onda antes ganha dinheiro por
  // isso. Sem premio, o botao de antecipar so serve para quem ja ganhou.
  const bonus = jogo.emOnda
    ? Math.round(20 + jogo.onda * 3)
    : Math.round(Math.max(0, jogo.preparo) * 2.5);
  if (bonus > 0) {
    jogo.dinheiro += bonus;
    jogo.estat.ganho += bonus;
    evento(jogo, 'antecipou', { bonus });
  }
  jogo.preparo = 0;
  jogo.onda++;
  const onda = definirOnda(jogo.onda);
  jogo.ondaAtual = onda;
  jogo.emOnda = true;
  jogo.tOnda = 0;
  jogo.gpuQuente = false;
  jogo.ratelimitsRestantes = 0;
  jogo.loja.desconto = 0;

  const nRotas = jogo.mapa.rotas.length;
  let i = 0;
  for (const gr of onda.grupos) {
    for (let k = 0; k < gr.quantidade; k++) {
      jogo.fila.push({
        t: gr.atraso + k * gr.intervalo,
        tipo: gr.tipo,
        rota: PRAGAS[gr.tipo].chefe || PRAGAS[gr.tipo].elite ? (i % nRotas) : ((i + k) % nRotas),
        hpMult: onda.hpMult,
      });
    }
    i++;
  }
  jogo.fila.sort((a, b) => a.t - b.t);

  if (onda.evento === 'gpuquente') { jogo.gpuQuente = true; noticia(jogo, 'gpuquente', {}); }
  if (onda.evento === 'ratelimit') { jogo.ratelimitsRestantes = 3; jogo.proxRatelimit = 6; }
  if (onda.evento === 'casaco') { jogo.loja.desconto = 0.35; noticia(jogo, 'gpuLoja', {}); }

  noticia(jogo, 'onda', { n: jogo.onda, nome: onda.nome });
  evento(jogo, 'onda', { n: jogo.onda, chefe: !!onda.chefe });
  return true;
}

function fecharOnda(jogo) {
  jogo.emOnda = false;
  jogo.preparo = PREPARO_ENTRE_ONDAS;
  const onda = jogo.ondaAtual;
  let renda = onda.recompensa;
  for (const t of jogo.torres) renda += t.st.rendaOnda;
  jogo.dinheiro += renda;
  jogo.estat.ganho += renda;
  jogo.estat.ondasLimpas++;
  jogo.gpuQuente = false;
  noticia(jogo, 'ondaLimpa', { n: jogo.onda });
  evento(jogo, 'ondaLimpa', { renda });
  if (jogo.modo === 'campanha' && jogo.onda >= TOTAL_ONDAS) {
    jogo.fim = true;
    jogo.venceu = true;
    noticia(jogo, 'vitoria', {});
    evento(jogo, 'fim', { venceu: true });
  }
}

// --------------------------------------------------------------------- pragas

function nascer(jogo, tipo, rotaIdx, hpMult, opcoes = {}) {
  const def = PRAGAS[tipo];
  const rota = jogo.mapa.rotas[rotaIdx % jogo.mapa.rotas.length];
  const hp = (opcoes.hp != null ? opcoes.hp : def.hp * hpMult);
  const p = {
    uid: jogo.proxId++,
    tipo, def,
    rotaIdx: rotaIdx % jogo.mapa.rotas.length,
    rota,
    d: opcoes.d || 0,
    hp, hpMax: hp,
    hpBase: def.hp * hpMult,
    velBase: def.vel * VEL_CELULAS,
    premio: Math.round(def.premio * (opcoes.premioMult != null ? opcoes.premioMult : 1)),
    dano: def.dano,
    escala: opcoes.escala || (def.chefe ? 1.9 : def.elite ? 1.4 : 1),
    geracao: opcoes.geracao || 0,
    x: 0, y: 0,
    congelado: 0,
    lento: 0, lentoFator: 0,
    marca: 0, marcaFator: 0,
    dot: 0, dotDps: 0,
    revelado: 0,
    tempoVivo: 0,
    tRelogio: 0,
    acumulado: {},
    imunes: new Set(),
    invuln: 0,
    estrutura: !!opcoes.estrutura,
    muro: opcoes.muro || null,
    cx: opcoes.cx, cy: opcoes.cy,
    raio: opcoes.raio || 0.34,
    renascimentos: 0,
    danoRecebido: {},
    pitch: 0,
    tProx: 0,
    falsa: def.falsaChance ? jogo.rnd() < def.falsaChance : false,
    viesTipo: def.viesado ? ORDEM_DANOS[Math.floor(jogo.rnd() * ORDEM_DANOS.length)] : null,
    disfarcado: !!def.disfarce,
    oculto: !!def.camuflado,
    voa: !!def.voa,
  };
  if (p.voa) {
    const ini = posicaoNaRota(rota.cels, 0);
    const alvo = jogo.mapa.base;
    p.vooDe = { x: ini.x, y: ini.y };
    p.vooPara = { x: alvo.x + 0.5, y: alvo.y + 0.5 };
    p.vooTotal = Math.hypot(p.vooPara.x - p.vooDe.x, p.vooPara.y - p.vooDe.y);
  }
  // O primeiro uso do poder respeita o intervalo anunciado. Com tProx em zero
  // o chefe soltava o muro, o veiculo, o tiro de volta e o pitch no quadro em
  // que nascia — antes de o jogador ver que ele chegou, e antes de a ficha
  // dele poder ser lida.
  if (def.pitch) p.tProx = def.pitch.intervalo;
  else if (def.muro) p.tProx = def.muro.intervalo;
  else if (def.despeja) p.tProx = def.despeja.intervalo;
  else if (def.atiraDeVolta) p.tProx = def.atiraDeVolta.intervalo;
  else if (def.piscaAR) p.tProx = def.piscaAR.visivel;
  if (p.estrutura) { p.x = p.cx; p.y = p.cy; }
  else posicionar(jogo, p);
  jogo.pragas.push(p);
  return p;
}

function posicionar(jogo, p) {
  if (p.estrutura) return;
  if (p.voa) {
    const t = Math.min(1, p.d / p.vooTotal);
    p.x = p.vooDe.x + (p.vooPara.x - p.vooDe.x) * t;
    p.y = p.vooDe.y + (p.vooPara.y - p.vooDe.y) * t;
    return;
  }
  const pos = posicaoNaRota(p.rota.cels, p.d);
  p.x = pos.x;
  p.y = pos.y;
}

function comprimentoDe(p) {
  return p.voa ? p.vooTotal : p.rota.cels.length - 1;
}

export function progresso(p) {
  return Math.min(1, p.d / comprimentoDe(p));
}

function visivel(p) {
  if (!p.oculto) return true;
  return p.revelado > 0;
}

// ----------------------------------------------------------------------- dano

// Uma regra so para tudo: `fura` levanta qualquer piso de resistencia, inclusive
// imunidade decorada e o vies. Sem isso o jogo tem estado invencivel — um VIES
// sorteado em RUIDO contra quem nao tem torre de RUIDO nunca morre, e um
// OVERFITTING que decorou tudo tambem nao. Quem quiser resposta universal paga
// por ela: JOTA-5 no RACIOCINIO ALTO, a aura do ORQUESTRADOR e o RELEASE DE
// EMERGENCIA sao as unicas fontes de `fura`.
function resistencia(p, tipo, fura) {
  let v;
  if (p.imunes.has(tipo)) v = 0;
  else if (p.viesTipo) v = tipo === p.viesTipo ? 1 : 0;
  else {
    const r = p.def.resist;
    v = r && tipo in r ? r[tipo] : 1;
  }
  if (fura > 0) v = v + (1 - v) * fura;
  return v;
}

export function aplicarDano(jogo, p, valor, tipo, opcoes = {}) {
  if (!p || p.hp <= 0) return 0;
  if (p.invuln > 0 && !opcoes.ignoraInvuln) { evento(jogo, 'imune', { x: p.x, y: p.y }); return 0; }

  if (p.falsa && !p.estrutura) {
    p.falsa = false;
    p.hp = 0;
    p.premio = 0;
    // Uma linha por onda: com uma por alucinacao falsa, a onda 2 sozinha
    // enchia o feed de seis avisos iguais e enterrava o resto.
    if (jogo.falsaAvisada !== jogo.onda) {
      jogo.falsaAvisada = jogo.onda;
      noticia(jogo, 'falsa', {});
    }
    evento(jogo, 'falsa', { x: p.x, y: p.y });
    remover(jogo, p, false);
    return 0;
  }

  const m = resistencia(p, tipo, opcoes.fura || 0);
  if (m <= 0) { evento(jogo, 'imune', { x: p.x, y: p.y }); return 0; }

  const v = valor * m * (1 + (p.marca > 0 ? p.marcaFator : 0));
  p.hp -= v;
  jogo.estat.danoPorTipo[tipo] = (jogo.estat.danoPorTipo[tipo] || 0) + v;
  p.danoRecebido[tipo] = (p.danoRecebido[tipo] || 0) + v;
  if (opcoes.torre) opcoes.torre.danoTotal += v;

  if (p.def.decora) {
    p.acumulado[tipo] = (p.acumulado[tipo] || 0) + v;
    // Teto de tres tipos decorados: com cinco ele viraria imortal, e um
    // inimigo imortal nao e dificuldade, e defeito.
    if (p.acumulado[tipo] >= p.def.decora && !p.imunes.has(tipo) && p.imunes.size < 3) {
      p.imunes.add(tipo);
      evento(jogo, 'decorou', { x: p.x, y: p.y, dano: tipo });
    }
  }

  if (p.hp <= 0) matar(jogo, p, opcoes.torre);
  return v;
}

function matar(jogo, p, torre) {
  if (p.def.renasce && p.renascimentos < p.def.renasce) {
    p.renascimentos++;
    // Renascer e voltar ao inicio da rota: treinaram ele de novo, do zero, no
    // proprio lixo que ele gerou. Renascendo no lugar onde morreu, com 35% mais
    // velocidade e pouco caminho pela frente, ele chegava no cluster em todas
    // as partidas — nao era chefe, era pedagio.
    p.d = 0;
    p.tempoVivo = 0;
    p.hpMax = Math.max(1, p.hpMax * 0.6);
    p.hp = p.hpMax;
    p.velBase *= 1.35;
    p.escala *= 0.86;
    let pior = 'token';
    let melhor = -1;
    for (const t of ORDEM_DANOS) {
      const v = p.danoRecebido[t] || 0;
      if (v > melhor && !p.imunes.has(t)) { melhor = v; pior = t; }
    }
    p.imunes.add(pior);
    p.danoRecebido = {};
    noticia(jogo, 'colapso', { dano: pior.toUpperCase() });
    evento(jogo, 'renasceu', { x: p.x, y: p.y });
    return;
  }

  jogo.estat.mortas++;
  if (torre) torre.abates++;
  if (p.premio > 0) {
    jogo.dinheiro += p.premio;
    jogo.estat.ganho += p.premio;
  }
  // COBRANCA no caminho da microtransacao cobra por morte no raio dela.
  for (const t of jogo.torres) {
    if (!t.st.rendaMorte) continue;
    if (dist2(t.cx, t.cy, p.x, p.y) <= t.at.alcance * t.at.alcance) {
      jogo.dinheiro += t.st.rendaMorte;
      jogo.estat.ganho += t.st.rendaMorte;
      if (t.st.recargaPorMorte) {
        for (const h of jogo.habilidades) {
          const def = HABILIDADE_POR_ID[h.id];
          h.recarga = Math.max(0, h.recarga - def.recarga * t.st.recargaPorMorte);
        }
      }
    }
  }

  if (p.def.divide && p.geracao < p.def.geracoes) {
    for (let i = 0; i < p.def.divide; i++) {
      nascer(jogo, p.tipo, p.rotaIdx, 1, {
        hp: p.hpBase * Math.pow(0.5, p.geracao + 1),
        d: Math.max(0, p.d - 0.35 * i),
        geracao: p.geracao + 1,
        escala: p.escala * 0.72,
        premioMult: 0.5,
      });
    }
    evento(jogo, 'dividiu', { x: p.x, y: p.y });
  }

  if (p.def.chefe) {
    noticia(jogo, 'chefeMorreu', { nome: p.def.nome });
    // O muro cai junto com quem o ergueu. Sem isso, no modo sem fim eles
    // empilham para sempre e o mapa fecha.
    for (const o of jogo.pragas) if (o.dono === p.uid && !o.morta) remover(jogo, o, false);
  }
  evento(jogo, 'morreu', { x: p.x, y: p.y, chefe: !!p.def.chefe, elite: !!p.def.elite, cor: p.def.cor });
  remover(jogo, p, false);
}

function remover(jogo, p, vazou) {
  p.hp = -1;
  p.morta = true;
  if (vazou) {
    jogo.vidas -= p.dano;
    jogo.estat.vazadas++;
    jogo.estat.vazouPorTipo[p.tipo] = (jogo.estat.vazouPorTipo[p.tipo] || 0) + 1;
    noticia(jogo, 'vazou', { praga: p.def.nome, dano: p.dano });
    evento(jogo, 'vazou', { dano: p.dano });
    if (jogo.vidas <= 0) {
      jogo.vidas = 0;
      jogo.fim = true;
      jogo.venceu = false;
      noticia(jogo, 'derrota', {});
      evento(jogo, 'fim', { venceu: false });
    }
  }
}

// ----------------------------------------------------------------- habilidades

export function usarHabilidade(jogo, id) {
  const h = jogo.habilidades.find(x => x.id === id);
  if (!h || h.recarga > 0 || jogo.fim) { evento(jogo, 'negado', {}); return false; }
  const def = HABILIDADE_POR_ID[id];
  h.recarga = def.recarga;

  if (id === 'ratelimit') {
    for (const p of jogo.pragas) if (!p.estrutura) p.congelado = def.duracao;
  } else if (id === 'release') {
    for (const p of jogo.pragas.slice()) {
      if (p.estrutura) continue;
      aplicarDano(jogo, p, def.dano, 'semantico', { fura: 1, ignoraInvuln: true });
    }
    jogo.penalidade = 5;
  } else if (id === 'overclock') {
    jogo.overclock = def.duracao;
  }
  noticia(jogo, 'habilidade', { nome: def.nome });
  evento(jogo, 'habilidade', { id });
  return true;
}

// ---------------------------------------------------------------- grade rapida
//
// 120 pragas x 200 tiros por quadro daria 24 mil testes de distancia. Uma
// grade de 2 celulas derruba isso para algumas centenas, e e o que segura os
// 60 fps com a tela cheia.

const GRADE = 2;
const GW = Math.ceil(LARGURA / GRADE) + 2;
const GH = Math.ceil(ALTURA / GRADE) + 2;

function indexar(jogo) {
  let g = jogo._grade;
  if (!g) { g = jogo._grade = new Array(GW * GH); for (let i = 0; i < g.length; i++) g[i] = []; }
  for (let i = 0; i < g.length; i++) g[i].length = 0;
  for (const p of jogo.pragas) {
    if (p.morta) continue;
    const gx = Math.min(GW - 1, Math.max(0, Math.floor(p.x / GRADE) + 1));
    const gy = Math.min(GH - 1, Math.max(0, Math.floor(p.y / GRADE) + 1));
    g[gy * GW + gx].push(p);
  }
}

function porPerto(jogo, x, y, raio, saida) {
  saida.length = 0;
  const g = jogo._grade;
  const x0 = Math.max(0, Math.floor((x - raio) / GRADE) + 1);
  const x1 = Math.min(GW - 1, Math.floor((x + raio) / GRADE) + 1);
  const y0 = Math.max(0, Math.floor((y - raio) / GRADE) + 1);
  const y1 = Math.min(GH - 1, Math.floor((y + raio) / GRADE) + 1);
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const b = g[gy * GW + gx];
      for (let i = 0; i < b.length; i++) saida.push(b[i]);
    }
  }
  return saida;
}

// ------------------------------------------------------------------ o passo

const bufA = [];
const bufB = [];

export function passo(jogo, dt = DT) {
  if (jogo.fim) return;
  jogo.tempo += dt;

  // --- temporizadores globais
  if (jogo.overclock > 0) {
    jogo.overclock -= dt;
    if (jogo.overclock <= 0) jogo.ressaca = HABILIDADE_POR_ID.overclock.ressaca;
  } else if (jogo.ressaca > 0) jogo.ressaca -= dt;
  if (jogo.penalidade > 0) jogo.penalidade -= dt;
  if (jogo.centralTravada > 0) jogo.centralTravada -= dt;
  for (const h of jogo.habilidades) {
    if (h.recarga > 0) h.recarga = Math.max(0, h.recarga - dt);
    h.pronta = h.recarga <= 0;
  }

  // --- VRAM. Tres forcas: o que as torres pedem, a carga de inferencia que as
  // pragas vivas geram, e o teto que o OOM KILLER sequestra enquanto vive.
  let cargaPragas = 0;
  let capturado = 0;
  for (const p of jogo.pragas) {
    if (p.morta) continue;
    if (p.def.cargaVram) cargaPragas += p.def.cargaVram;
    if (p.def.capturaVram) capturado += p.def.capturaVram;
  }
  jogo.capacidadeVram = Math.round(Math.max(1, jogo.capacidadeBase - capturado) * 10) / 10;
  jogo.vramCapturada = Math.round(capturado * 10) / 10;
  jogo.usoVram = Math.round((jogo.usoVramTorres + cargaPragas) * 10) / 10;
  const excesso = Math.max(0, jogo.usoVram - jogo.capacidadeVram) / Math.max(1, jogo.capacidadeVram);
  const penal = Math.min(0.75, excesso * 1.5) * (1 - jogo.amortece);
  jogo.estrangulamento = 1 - penal;
  if (jogo.usoVram > jogo.capacidadeVram && !jogo.estavaEstourado) {
    jogo.estavaEstourado = true;
    noticia(jogo, 'estourou', { uso: jogo.usoVram.toFixed(1), cap: jogo.capacidadeVram.toFixed(1) });
    evento(jogo, 'estourou', {});
  } else if (jogo.usoVram <= jogo.capacidadeVram && jogo.estavaEstourado) {
    jogo.estavaEstourado = false;
    noticia(jogo, 'normalizou', { uso: jogo.usoVram.toFixed(1), cap: jogo.capacidadeVram.toFixed(1) });
  }

  // --- onda
  if (jogo.emOnda) {
    jogo.tOnda += dt;
    while (jogo.fila.length && jogo.fila[0].t <= jogo.tOnda) {
      const s = jogo.fila.shift();
      nascer(jogo, s.tipo, s.rota, s.hpMult);
    }
    if (jogo.ratelimitsRestantes > 0) {
      jogo.proxRatelimit -= dt;
      if (jogo.proxRatelimit <= 0) {
        jogo.ratelimitsRestantes--;
        jogo.proxRatelimit = 11;
        jogo.centralTravada = 3;
        noticia(jogo, 'ratelimit', {});
        evento(jogo, 'ratelimit', {});
      }
    }
    if (!jogo.fila.length && !jogo.pragas.some(p => !p.morta && !p.estrutura)) fecharOnda(jogo);
  }
  if (!jogo.emOnda && !jogo.fim && temProximaOnda(jogo)) {
    jogo.preparo -= dt;
    if (jogo.preparo <= 0) comecarOnda(jogo);
  }

  indexar(jogo);
  moverPragas(jogo, dt);
  if (jogo.fim) return;
  indexar(jogo);
  mirarEAtirar(jogo, dt);
  moverTiros(jogo, dt);

  // limpeza
  if (jogo.pragas.some(p => p.morta)) jogo.pragas = jogo.pragas.filter(p => !p.morta);
}

// ------------------------------------------------------------ movimento e IA

function moverPragas(jogo, dt) {
  const mapa = jogo.mapa;
  for (const p of jogo.pragas) {
    if (p.morta) continue;
    p.tempoVivo += dt;

    if (p.invuln > 0) p.invuln -= dt;
    if (p.congelado > 0) p.congelado -= dt;
    if (p.lento > 0) p.lento -= dt; else p.lentoFator = 0;
    if (p.marca > 0) p.marca -= dt; else p.marcaFator = 0;
    if (p.revelado > 0) p.revelado -= dt;

    if (p.dot > 0) {
      p.dot -= dt;
      aplicarDano(jogo, p, p.dotDps * dt, 'filtro', {});
      if (p.morta) continue;
    }

    if (p.estrutura) continue;

    // --- comportamento proprio de cada praga
    if (p.def.cresce && p.tempoVivo - p.tRelogio >= 1) {
      p.tRelogio = p.tempoVivo;
      const teto = p.hpBase * p.def.cresce.teto;
      if (p.hpMax < teto) {
        const ganho = p.hpBase * p.def.cresce.hp;
        p.hpMax += ganho;
        p.hp = Math.min(p.hpMax, p.hp + ganho);
        p.velBase *= 1 + p.def.cresce.vel;
        p.escala = Math.min(2.1, p.escala * 1.035);
      }
    }

    if (p.def.regen) {
      p.hp = Math.min(p.hpMax, p.hp + p.hpMax * p.def.regen * dt);
    }

    if (p.def.disfarce && p.disfarcado && progresso(p) >= p.def.disfarce) {
      p.disfarcado = false;
      p.velBase *= 1.8;
      evento(jogo, 'revelou', { x: p.x, y: p.y });
    }

    if (p.def.piscaAR) {
      p.tProx -= dt;
      if (p.tProx <= 0) {
        p.oculto = !p.oculto;
        p.tProx = p.oculto ? p.def.piscaAR.oculto : p.def.piscaAR.visivel;
        if (p.oculto) noticia(jogo, 'metaverso', {});
      }
    }

    if (p.def.cura) {
      const perto = porPerto(jogo, p.x, p.y, p.def.cura.raio, bufA);
      const r2 = p.def.cura.raio * p.def.cura.raio;
      for (const o of perto) {
        if (o === p || o.morta || o.estrutura) continue;
        if (dist2(o.x, o.y, p.x, p.y) <= r2) o.hp = Math.min(o.hpMax, o.hp + p.def.cura.valor * dt);
      }
    }

    if (p.def.volta) {
      p.tProx += dt;
      if (p.tProx >= p.def.volta.segundos) {
        p.tProx = 0;
        p.d = Math.max(0, p.d - p.def.volta.celulas);
        p.hp = Math.min(p.hpMax, p.hp + p.hpMax * p.def.volta.cura);
        evento(jogo, 'voltou', { x: p.x, y: p.y });
      }
    }

    if (p.def.corrompe) {
      const r2 = RAIO_INJECAO * RAIO_INJECAO;
      for (const t of jogo.torres) {
        if (t.corrompida > 0 || t.at.imuneInjection) continue;
        if (dist2(t.cx, t.cy, p.x, p.y) <= r2) {
          t.corrompida = p.def.corrompe;
          noticia(jogo, 'corrompida', { torre: TORRE_POR_ID[t.tipo].nome });
          evento(jogo, 'corrompeu', { x: t.cx, y: t.cy });
          break;
        }
      }
    }

    if (p.def.roubo && progresso(p) > 0.75 && jogo.dinheiro > 0) {
      const v = Math.min(jogo.dinheiro, p.def.roubo * dt);
      jogo.dinheiro -= v;
      jogo.estat.roubado += v;
      p.roubouAcum = (p.roubouAcum || 0) + v;
      if (p.roubouAcum >= 12) {
        p.roubouAcum = 0;
        noticia(jogo, 'roubo', { valor: 12 });
        evento(jogo, 'roubo', { x: p.x, y: p.y });
      }
    }

    if (p.def.atiraDeVolta) {
      p.tProx -= dt;
      if (p.tProx <= 0) {
        p.tProx = p.def.atiraDeVolta.intervalo;
        const r2 = p.def.atiraDeVolta.raio * p.def.atiraDeVolta.raio;
        const candidatas = jogo.torres.filter(t => t.desligada <= 0 && dist2(t.cx, t.cy, p.x, p.y) <= r2);
        if (candidatas.length) {
          const alvo = candidatas[Math.floor(jogo.rnd() * candidatas.length)];
          alvo.desligada = p.def.atiraDeVolta.segundos;
          noticia(jogo, 'groque', { torre: TORRE_POR_ID[alvo.tipo].nome });
          evento(jogo, 'desligou', { x: alvo.cx, y: alvo.cy });
        }
      }
    }

    if (p.def.despeja) {
      p.tProx -= dt;
      if (p.tProx <= 0) {
        p.tProx = p.def.despeja.intervalo;
        const livre = lajeLivre(jogo);
        if (livre) {
          const d = nascer(jogo, 'botfarm', 0, 1, {
            estrutura: true, cx: livre.x + 0.5, cy: livre.y + 0.5,
            hp: p.def.despeja.hp, raio: 0.45, escala: 1.1, premioMult: 0,
          });
          d.def = { ...PRAGAS.botfarm, nome: 'DESTROCO', cor: '#c8c8d4', cargaVram: 0 };
          d.tipo = 'destroco';
          d.premio = 0;
          noticia(jogo, 'foguete', {});
          evento(jogo, 'destroco', { x: d.x, y: d.y });
        }
      }
    }

    if (p.def.pitch) {
      p.tProx -= dt;
      if (p.pitch > 0) {
        p.pitch -= dt;
        p.invuln = Math.max(p.invuln, 0.05);
        if (p.pitch <= 0) p.tProx = p.def.pitch.intervalo;
      } else if (p.tProx <= 0) {
        p.pitch = p.def.pitch.duracao;
        noticia(jogo, 'altohomem', {});
        evento(jogo, 'pitch', { x: p.x, y: p.y });
        for (let i = 0; i < 8; i++) nascer(jogo, 'botfarm', p.rotaIdx, 1, { d: Math.max(0, p.d - 0.6 - i * 0.2) });
        for (let i = 0; i < 2; i++) nascer(jogo, 'alucinacao', p.rotaIdx, 1, { d: Math.max(0, p.d - 1 - i * 0.4) });
      }
    }

    if (p.def.muro) {
      p.tProx -= dt;
      if (p.tProx <= 0) {
        p.tProx = p.def.muro.intervalo;
        ergerMuro(jogo, p);
      }
    }

    if (p.def.regen && p.tempoVivo > 2 && Math.floor(p.tempoVivo) % 12 === 0 && !p.jaFalou) {
      p.jaFalou = true;
      noticia(jogo, 'scroll', {});
    } else if (p.def.regen && Math.floor(p.tempoVivo) % 12 !== 0) p.jaFalou = false;

    // --- andar
    if (p.congelado > 0) { posicionar(jogo, p); continue; }
    const v = p.velBase * (1 - Math.min(0.8, p.lentoFator));
    p.d += v * dt;
    posicionar(jogo, p);

    if (p.d >= comprimentoDe(p)) remover(jogo, p, true);
    if (jogo.fim) return;
  }
}

function lajeLivre(jogo) {
  const cels = [...jogo.mapa.construivel];
  for (let tent = 0; tent < 24; tent++) {
    const k = cels[Math.floor(jogo.rnd() * cels.length)];
    const x = k % LARGURA;
    const y = Math.floor(k / LARGURA);
    if (!ocupado(jogo, x, y)) return { x, y };
  }
  return null;
}

function ergerMuro(jogo, chefe) {
  const colunas = [6, 12, 18, 9, 15];
  const n = jogo.pragas.filter(p => p.muro).length;
  const x = colunas[n % colunas.length];
  const alt = chefe.def.muro.altura;
  const y0 = Math.max(0, Math.min(ALTURA - alt, Math.round(chefe.y) - Math.floor(alt / 2)));
  const p = nascer(jogo, 'botfarm', 0, 1, {
    estrutura: true, cx: x, cy: y0 + alt / 2,
    hp: chefe.def.muro.hp, raio: 0.9, premioMult: 0,
    muro: { x, y0, y1: y0 + alt },
  });
  p.def = { ...PRAGAS.botfarm, nome: 'MURO', cor: '#ff9d3c', cargaVram: 0 };
  p.tipo = 'muro';
  p.premio = 0;
  p.dono = chefe.uid;
  p.escala = 1;
  noticia(jogo, 'trombeta', {});
  evento(jogo, 'muro', { x, y: y0 });
}

// -------------------------------------------------------------- mira e tiro

function escolherAlvo(jogo, t) {
  const a = t.at;
  const perto = porPerto(jogo, t.cx, t.cy, a.alcance, bufA);
  const r2 = a.alcance * a.alcance;
  let melhor = null;
  let melhorProg = -1;
  let estrutura = null;
  for (const p of perto) {
    if (p.morta) continue;
    if (dist2(p.x, p.y, t.cx, t.cy) > r2) continue;
    if (p.estrutura) { if (!estrutura) estrutura = p; continue; }
    if (p.voa && !a.antiaereo) continue;
    if (!visivel(p) && !a.deteccao) continue;
    if (a.recusa && p.disfarcado) continue;
    if (p.invuln > 0) continue;
    const prog = progresso(p);
    if (prog > melhorProg) { melhorProg = prog; melhor = p; }
  }
  if (melhor) return melhor;
  // Recusa que nao achou alvo legitimo vira noticia, uma vez a cada tanto.
  if (a.recusa && perto.some(p => p.disfarcado)) {
    if (jogo.rnd() < 0.004) noticia(jogo, 'recusou', { torre: TORRE_POR_ID[t.tipo].nome });
  }
  return estrutura;
}

function multiplicadorCadencia(jogo, t) {
  let m = 1;
  if (jogo.overclock > 0) m *= 1.55;
  else if (!t.at.protegida) m *= jogo.estrangulamento;
  if (jogo.ressaca > 0) m *= 0.68;
  if (jogo.gpuQuente) m *= 0.7;
  if (jogo.penalidade > 0) m *= 0.8;
  return m;
}

function mirarEAtirar(jogo, dt) {
  for (const t of jogo.torres) {
    if (t.corrompida > 0) {
      t.corrompida -= dt;
      const perto = porPerto(jogo, t.cx, t.cy, RAIO_CORROMPIDA, bufB);
      const r2 = RAIO_CORROMPIDA * RAIO_CORROMPIDA;
      for (const p of perto) {
        if (p.morta || p.estrutura) continue;
        if (dist2(p.x, p.y, t.cx, t.cy) <= r2) p.hp = Math.min(p.hpMax, p.hp + CURA_CORROMPIDA * dt);
      }
      continue;
    }
    if (t.desligada > 0) { t.desligada -= dt; continue; }
    if (t.aquecendo > 0) { t.aquecendo -= dt; continue; }

    const a = t.at;

    if (a.revela > 0) {
      const perto = porPerto(jogo, t.cx, t.cy, a.revela, bufB);
      const r2 = a.revela * a.revela;
      for (const p of perto) {
        if (!p.morta && p.oculto && dist2(p.x, p.y, t.cx, t.cy) <= r2) p.revelado = Math.max(p.revelado, 0.25);
      }
    }

    if (a.naoAtira) continue;

    const cad = a.cadencia * multiplicadorCadencia(jogo, t);
    if (cad <= 0) continue;

    const alvo = (t.alvo && !t.alvo.morta && dist2(t.alvo.x, t.alvo.y, t.cx, t.cy) <= a.alcance * a.alcance
      && (!t.alvo.voa || a.antiaereo) && (visivel(t.alvo) || a.deteccao) && !(a.recusa && t.alvo.disfarcado)
      && t.alvo.invuln <= 0)
      ? t.alvo : escolherAlvo(jogo, t);

    if (!alvo) {
      t.alvo = null;
      t.mirando = 0;
      if (!a.crescimentoFixo) t.acumulo = 0;
      continue;
    }

    if (alvo !== t.alvo) {
      t.alvo = alvo;
      t.mirando = 0;
      if (!a.crescimentoFixo) t.acumulo = 0;
    }
    t.angulo = Math.atan2(alvo.y - t.cy, alvo.x - t.cx);

    if (t.mirando < a.mira) { t.mirando += dt; continue; }

    if (a.crescimento > 0) {
      t.acumulo = Math.min(a.crescimentoTeto, t.acumulo + a.crescimento * dt);
    }

    t.recarga -= dt * cad;
    while (t.recarga <= 0) {
      t.recarga += 1;
      disparar(jogo, t, alvo);
    }
  }
}

function disparar(jogo, t, alvo) {
  const a = t.at;
  let tipo = a.tipoDano;
  if (a.roteador) {
    // O ROTEADOR escolhe o tipo que o alvo menos resiste. E o unico jeito de
    // uma torre so resolver VIES, ESCUDO e ARMADURA ao mesmo tempo.
    let melhor = a.roteador[0];
    let melhorM = -1;
    for (const c of a.roteador) {
      const m = resistencia(alvo, c, a.furaResist);
      if (m > melhorM) { melhorM = m; melhor = c; }
    }
    tipo = melhor;
  }

  let dano = a.dano * (1 + t.acumulo);
  if (a.alternado) {
    t.moeFlip = !t.moeFlip;
    if (t.moeFlip) dano *= a.alternado;
  }

  const alvos = [alvo];
  if (a.alvos > 1) {
    const perto = porPerto(jogo, t.cx, t.cy, a.alcance, bufB);
    const r2 = a.alcance * a.alcance;
    for (const p of perto) {
      if (alvos.length >= a.alvos) break;
      if (p === alvo || p.morta || p.estrutura) continue;
      if (p.voa && !a.antiaereo) continue;
      if (!visivel(p) && !a.deteccao) continue;
      if (a.recusa && p.disfarcado) continue;
      if (p.invuln > 0) continue;
      if (dist2(p.x, p.y, t.cx, t.cy) <= r2) alvos.push(p);
    }
  }

  for (const al of alvos) {
    jogo.estat.tiros++;
    const errou = jogo.rnd() < a.erro;
    const ang = Math.atan2(al.y - t.cy, al.x - t.cx) + (errou ? (jogo.rnd() - 0.5) * 0.9 : 0);
    if (errou) jogo.estat.errados++;
    jogo.tiros.push({
      x: t.cx, y: t.cy,
      vx: Math.cos(ang) * VEL_TIRO,
      vy: Math.sin(ang) * VEL_TIRO,
      dano, tipo,
      area: a.area,
      perfura: a.perfura,
      dot: a.dot,
      marca: a.marca,
      lentidao: a.lentidao,
      fura: a.furaResist,
      torre: t,
      alvo: al,
      errou,
      vida: 1.6,
      atingidos: null,
    });
  }
  evento(jogo, 'tiro', { dano: tipo, x: t.cx, y: t.cy, torre: t.tipo });
}

function moverTiros(jogo, dt) {
  const vivos = [];
  for (const b of jogo.tiros) {
    b.vida -= dt;
    if (b.vida <= 0) continue;
    const px = b.x;
    const py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.x < -2 || b.x > LARGURA + 2 || b.y < -2 || b.y > ALTURA + 2) continue;

    // muro do TROMBETA: todo tiro que tentar atravessar bate nele
    let barrado = false;
    for (const p of jogo.pragas) {
      if (p.morta || !p.muro) continue;
      const m = p.muro;
      if ((px - m.x) * (b.x - m.x) < 0) {
        const t = (m.x - px) / (b.x - px || 1e-6);
        const yc = py + (b.y - py) * t;
        if (yc >= m.y0 && yc <= m.y1) {
          aplicarDano(jogo, p, b.dano, b.tipo, { fura: b.fura, torre: b.torre });
          evento(jogo, 'bateuMuro', { x: m.x, y: yc });
          barrado = true;
          break;
        }
      }
    }
    if (barrado) continue;

    const perto = porPerto(jogo, b.x, b.y, 1, bufA);
    let acertou = false;
    for (const p of perto) {
      if (p.morta) continue;
      if (b.atingidos && b.atingidos.has(p.uid)) continue;
      if (p.voa && b.torre && !b.torre.at.antiaereo) continue;
      const raio = RAIO_ACERTO + (p.raio - 0.34) + (p.escala - 1) * 0.22;
      if (dist2(p.x, p.y, b.x, b.y) > raio * raio) continue;

      acertou = true;
      if (b.errou) {
        // Alucinacao da torre: o tiro saiu torto e bate em quem estiver na
        // frente. As vezes e o alvo certo mesmo assim.
        evento(jogo, 'errou', { x: b.x, y: b.y });
      }
      atingir(jogo, b, p);
      if (b.perfura > 0) {
        if (!b.atingidos) b.atingidos = new Set();
        b.atingidos.add(p.uid);
        b.perfura--;
        acertou = false;
        continue;
      }
      break;
    }
    if (!acertou) vivos.push(b);
  }
  jogo.tiros = vivos;
}

function atingir(jogo, b, p) {
  if (b.area > 0) {
    const perto = porPerto(jogo, b.x, b.y, b.area, bufB);
    const r2 = b.area * b.area;
    for (const o of perto) {
      if (o.morta) continue;
      if (o.voa && b.torre && !b.torre.at.antiaereo) continue;
      if (dist2(o.x, o.y, b.x, b.y) > r2) continue;
      marcarEAplicar(jogo, b, o, o === p ? 1 : 0.8);
    }
    evento(jogo, 'estouro', { x: b.x, y: b.y, raio: b.area, dano: b.tipo });
  } else {
    marcarEAplicar(jogo, b, p, 1);
    evento(jogo, 'acerto', { x: b.x, y: b.y, dano: b.tipo });
  }
}

function marcarEAplicar(jogo, b, p, fator) {
  if (b.dot > 0) {
    p.dot = DURACAO_DOT;
    p.dotDps = Math.max(p.dotDps, b.dot);
    if (p.oculto) p.revelado = Math.max(p.revelado, DURACAO_DOT);
  }
  if (b.marca > 0) { p.marca = DURACAO_MARCA; p.marcaFator = Math.max(p.marcaFator, b.marca); }
  if (b.lentidao > 0) { p.lento = DURACAO_LENTIDAO; p.lentoFator = Math.max(p.lentoFator, b.lentidao); }
  aplicarDano(jogo, p, b.dano * fator, b.tipo, { fura: b.fura, torre: b.torre });
}

// -------------------------------------------------------------------- leitura
//
// O painel de informacao total le daqui. Tudo em numero absoluto: nunca "+50%".

export function fichaTorre(jogo, t) {
  const def = TORRE_POR_ID[t.tipo];
  const a = t.at;
  const cadReal = a.cadencia * multiplicadorCadencia(jogo, t);
  const acertos = 1 - a.erro;
  const dps = a.naoAtira ? 0 : a.dano * (1 + t.acumulo) * cadReal * acertos * a.alvos
    * (a.alternado ? (1 + a.alternado) / 2 : 1);
  return {
    nome: def.nome,
    familia: def.familia,
    classe: def.classe,
    glifo: def.glifo,
    cor: def.cor,
    frase: def.frase,
    real: def.real,
    modo: t.modoServir,
    modoNome: MODOS[t.modoServir].nome,
    niveis: t.niveis.slice(),
    caminhos: def.caminhos.map((c, i) => ({
      nome: c.nome,
      desc: c.desc,
      nivel: t.niveis[i],
      podeSubir: podeMelhorar(t, i),
      travado: !podeMelhorar(t, i) && t.niveis[i] < 3,
      custo: custoMelhoria(t, i),
      proximo: t.niveis[i] < 3 ? c.niveis[t.niveis[i]].texto : null,
      comprados: c.niveis.slice(0, t.niveis[i]).map(n => n.texto),
    })),
    dano: a.dano * (1 + t.acumulo),
    tipoDano: a.tipoDano,
    roteador: a.roteador,
    cadencia: cadReal,
    cadenciaNominal: a.cadencia,
    dps,
    alcance: a.alcance,
    mira: a.mira,
    erro: a.erro,
    vram: t.st.vram,
    area: a.area,
    perfura: a.perfura,
    alvos: a.alvos,
    dot: a.dot,
    marca: a.marca,
    lentidao: a.lentidao,
    furaResist: a.furaResist,
    deteccao: a.deteccao,
    antiaereo: a.antiaereo,
    recusa: a.recusa,
    protegida: a.protegida,
    imuneInjection: a.imuneInjection,
    capacidade: t.st.capacidade,
    rendaOnda: t.st.rendaOnda,
    rendaMorte: t.st.rendaMorte,
    auraCadencia: t.st.auraCadencia,
    auraDano: t.st.auraDano,
    auraErro: t.st.auraErro,
    auraRaio: t.st.auraRaio || t.st.alcance,
    acumulo: t.acumulo,
    abates: t.abates,
    danoTotal: t.danoTotal,
    valorVenda: valorDeVenda(t),
    investido: t.investido,
    corrompida: t.corrompida,
    desligada: t.desligada,
    aquecendo: t.aquecendo,
    estados: [
      t.corrompida > 0 ? `CORROMPIDA por ${t.corrompida.toFixed(1)} s` : null,
      t.desligada > 0 ? `DESLIGADA por ${t.desligada.toFixed(1)} s` : null,
      t.aquecendo > 0 ? `SUBINDO PESOS, ${t.aquecendo.toFixed(1)} s` : null,
      a.protegida ? 'PROTEGIDA: nao sofre estrangulamento' : null,
      a.imuneInjection ? 'AUDITADA: imune a prompt injection' : null,
    ].filter(Boolean),
  };
}

export function fichaPraga(jogo, p) {
  const efeitos = [];
  if (p.dot > 0) efeitos.push(`FILTRO: ${p.dotDps.toFixed(0)} de dano por segundo, por mais ${p.dot.toFixed(1)} s`);
  if (p.marca > 0) efeitos.push(`MARCADO: recebe +${Math.round(p.marcaFator * 100)}% de dano por mais ${p.marca.toFixed(1)} s`);
  if (p.lento > 0) efeitos.push(`LENTO: -${Math.round(p.lentoFator * 100)}% de velocidade por mais ${p.lento.toFixed(1)} s`);
  if (p.congelado > 0) efeitos.push(`CONGELADO por mais ${p.congelado.toFixed(1)} s`);
  if (p.invuln > 0) efeitos.push('INVULNERAVEL agora');
  if (p.pitch > 0) efeitos.push(`EM PITCH por mais ${p.pitch.toFixed(1)} s`);
  if (p.disfarcado) efeitos.push('DISFARCADO: modelo alinhado se recusa a atirar');
  if (p.oculto && p.revelado <= 0) efeitos.push('OCULTO: so quem tem deteccao mira');
  if (p.revelado > 0) efeitos.push(`REVELADO por mais ${p.revelado.toFixed(1)} s`);
  if (p.renascimentos) efeitos.push(`JA RENASCEU ${p.renascimentos} vez(es)`);

  const resist = {};
  for (const tipo of ORDEM_DANOS) resist[tipo] = resistencia(p, tipo, 0);

  return {
    nome: p.def.nome,
    cor: p.def.cor,
    regra: p.def.regra,
    hp: Math.max(0, p.hp),
    hpMax: p.hpMax,
    vel: (p.velBase * (1 - Math.min(0.8, p.lentoFator))).toFixed(2),
    velCelulas: p.velBase,
    premio: p.premio,
    danoNaBase: p.dano,
    progresso: progresso(p),
    faltam: Math.max(0, comprimentoDe(p) - p.d),
    resist,
    viesTipo: p.viesTipo,
    imunes: [...p.imunes],
    efeitos,
    chefe: !!p.def.chefe,
    elite: !!p.def.elite,
    estrutura: !!p.estrutura,
  };
}

export function estadoVram(jogo) {
  return {
    uso: jogo.usoVram,
    capacidade: jogo.capacidadeVram,
    capacidadeBase: jogo.capacidadeBase,
    capturada: jogo.vramCapturada || 0,
    estourado: jogo.usoVram > jogo.capacidadeVram,
    estrangulamento: jogo.estrangulamento,
    perda: Math.round((1 - jogo.estrangulamento) * 100),
    amortece: jogo.amortece,
  };
}

export { TOTAL_ONDAS };
