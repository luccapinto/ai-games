// O gerador do sertao: relevo, umidade, rios, biomas, vilas, estradas e o mapa
// de distancia da agua.
//
// Nada aqui toca em DOM, e tudo depende so da semente. E isso que permite
// provas.mjs gerar trinta mundos e cobrar de todos as mesmas garantias — vila em
// chao andavel, vila alcancavel a pe de qualquer outra, estrada inteira
// caminhavel, agua a menos de meio cantil de qualquer ponto de estrada. A
// primeira semente sempre parece boa; a decima e que tem a vila cercada de rio.

import { CONFIG, criarSorteio } from './regras.js';
import { MISSOES, instanciar, LIMITE_DE_AGUA } from './missoes.js';

export const TERRENOS = {
  caatinga: 0,
  mata: 1,
  roca: 2,
  salina: 3,
  serra: 4,
  agua: 5,
};

const BLOQUEIA = new Set([TERRENOS.serra, TERRENOS.agua]);

const NOMES_VILAS = ['JUAZEIRO SECO', 'POÇO DA ONÇA', 'SERRA DA CRUZ',
  'BARRA VELHA', 'CANUDOS NOVO', 'OLHO D\'ÁGUA', 'CAJAZEIRAS'];

const NOMES_PESSOAS = ['Dona Sinhá', 'Zé Bento', 'Maria do Carmo', 'Chico Leite',
  'Rita Camará', 'Damião', 'Nevinha', 'Seu Joaquim', 'Lurdes', 'Antônio Gavião',
  'Beto Cacimba', 'Dona Firmina', 'Raimundo', 'Josefa', 'Vadinho'];

// Vendedor em primeiro lugar de proposito: e o unico papel que TODA vila
// precisa ter, porque e ele que compra o que o jogador acha. A primeira versao
// rodava a lista pelo indice da vila e a segunda vila saia sem vendedor —
// prova de vila pegou.
const PAPEIS = ['vendedor', 'curandeira', 'vaqueiro', 'rezadeira', 'ferreiro'];

// ------------------------------------------------------------------ ruido

// Ruido de valor com interpolacao suave, somado em oitavas. Nao e Perlin, e nao
// precisa ser: o que se quer e um campo continuo e reprodutivel.
function campoDeRuido(semente, largura, altura, escala, oitavas) {
  const sorteio = criarSorteio(semente);
  const grades = [];
  for (let o = 0; o < oitavas; o++) {
    const passo = escala / 2 ** o;
    const gw = Math.ceil(largura / passo) + 2;
    const gh = Math.ceil(altura / passo) + 2;
    const valores = new Float32Array(gw * gh);
    for (let i = 0; i < valores.length; i++) valores[i] = sorteio();
    grades.push({ passo, gw, gh, valores });
  }

  const suave = (t) => t * t * (3 - 2 * t);
  const campo = new Float32Array(largura * altura);
  let pesoTotal = 0;
  for (let o = 0; o < oitavas; o++) pesoTotal += 1 / 2 ** o;

  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      let soma = 0;
      for (const [o, g] of grades.entries()) {
        const fx = x / g.passo;
        const fy = y / g.passo;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = suave(fx - x0);
        const ty = suave(fy - y0);
        const v00 = g.valores[y0 * g.gw + x0];
        const v10 = g.valores[y0 * g.gw + x0 + 1];
        const v01 = g.valores[(y0 + 1) * g.gw + x0];
        const v11 = g.valores[(y0 + 1) * g.gw + x0 + 1];
        const a = v00 + (v10 - v00) * tx;
        const b = v01 + (v11 - v01) * tx;
        soma += (a + (b - a) * ty) / 2 ** o;
      }
      campo[y * largura + x] = soma / pesoTotal;
    }
  }
  return campo;
}

// ------------------------------------------------------------------ mundo

export function gerarMundo(semente) {
  const largura = CONFIG.largura;
  const altura = CONFIG.altura;
  const sorteio = criarSorteio(semente ^ 0x5f3a);

  const relevo = campoDeRuido(semente, largura, altura, 64, 4);
  const umidade = campoDeRuido(semente + 9871, largura, altura, 48, 3);

  // Borda mais alta: serra em volta fecha o mundo sem parede invisivel, e o
  // jogador entende por que nao passa dali.
  const terreno = new Uint8Array(largura * altura);
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const i = y * largura + x;
      const bordaX = Math.min(x, largura - 1 - x) / (largura * 0.12);
      const bordaY = Math.min(y, altura - 1 - y) / (altura * 0.12);
      const borda = Math.min(1, Math.min(bordaX, bordaY));
      relevo[i] = relevo[i] * 0.72 + (1 - borda) * 0.5;
    }
  }

  // O corte de agua e um quantil do proprio relevo daquela semente, e nao um
  // numero fixo. Com corte fixo a proporcao de agua ia de 0,5% a 22% entre
  // sementes — a prova de terreno pegou as duas pontas.
  const amostra = [];
  for (let i = 0; i < relevo.length; i += 11) amostra.push(relevo[i]);
  amostra.sort((a, b) => a - b);
  const corteAgua = amostra[Math.floor(amostra.length * 0.1)];
  const corteSerra = amostra[Math.floor(amostra.length * 0.84)];

  for (let i = 0; i < terreno.length; i++) {
    const h = relevo[i];
    const u = umidade[i];
    let t;
    if (h > corteSerra) t = TERRENOS.serra;
    else if (h < corteAgua && u > 0.42) t = TERRENOS.agua;
    else if (u > 0.63) t = TERRENOS.mata;
    else if (u < 0.3 && h < corteSerra * 0.8) t = TERRENOS.salina;
    else t = TERRENOS.caatinga;
    terreno[i] = t;
  }

  const mundo = {
    semente, largura, altura, terreno, relevo, umidade,
    vilas: [], estradas: [], recursos: [], missoes: {},
    estrada: new Uint8Array(largura * altura),
    distanciaDaAgua: new Int16Array(largura * altura),
  };

  tracarRios(mundo, sorteio);
  marcarRegiao(mundo);
  plantarVilas(mundo, sorteio);
  abrirEstradas(mundo);
  medirDistanciaDaAgua(mundo);
  marcarAlcance(mundo);
  espalharRecursos(mundo, sorteio);
  instanciar(mundo, sorteio);
  mundo.assinatura = assinar(mundo);
  return mundo;
}

// Rio: sai de um ponto alto e desce sempre para o vizinho mais baixo. Onde ele
// passa vira agua, e o vale em volta vira mata — e e essa mata que diz ao
// jogador, de longe, onde e que tem agua.
function tracarRios(mundo, sorteio) {
  const { largura, altura, terreno, relevo } = mundo;
  const rios = 9;
  for (let r = 0; r < rios; r++) {
    let melhor = null;
    for (let tentativa = 0; tentativa < 140; tentativa++) {
      const x = 12 + Math.floor(sorteio() * (largura - 24));
      const y = 12 + Math.floor(sorteio() * (altura - 24));
      const h = relevo[y * largura + x];
      if (!melhor || h > melhor.h) melhor = { x, y, h };
    }
    let { x, y } = melhor;
    for (let passo = 0; passo < 420; passo++) {
      const i = y * largura + x;
      terreno[i] = TERRENOS.agua;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const j = (y + dy) * largura + (x + dx);
          if (j < 0 || j >= terreno.length) continue;
          if (terreno[j] === TERRENOS.caatinga || terreno[j] === TERRENOS.salina) {
            if (sorteio() < 0.5) terreno[j] = TERRENOS.mata;
          }
        }
      }
      let proximo = null;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 1 || ny < 1 || nx >= largura - 1 || ny >= altura - 1) continue;
          const h = relevo[ny * largura + nx];
          if (!proximo || h < proximo.h) proximo = { x: nx, y: ny, h };
        }
      }
      if (!proximo || proximo.h >= relevo[i]) break;
      x = proximo.x;
      y = proximo.y;
    }
  }
}

// A maior regiao andavel conexa do mundo. Vila fora dela e vila que o jogador
// nunca alcanca, e conferir isso com A* por candidato era lento e ainda deixava
// passar: a semente 2036 saiu com tres vilas.
function marcarRegiao(mundo) {
  const { largura, altura } = mundo;
  const marca = new Int32Array(largura * altura).fill(-1);
  let melhor = { id: -1, tamanho: 0 };
  let id = 0;
  for (let inicio = 0; inicio < marca.length; inicio++) {
    if (marca[inicio] !== -1) continue;
    const x0 = inicio % largura;
    const y0 = (inicio - x0) / largura;
    if (!andavel(mundo, x0, y0)) { marca[inicio] = -2; continue; }
    const fila = [inicio];
    marca[inicio] = id;
    for (let cabeca = 0; cabeca < fila.length; cabeca++) {
      const i = fila[cabeca];
      const x = i % largura;
      const y = (i - x) / largura;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= largura || ny >= altura) continue;
        const j = ny * largura + nx;
        if (marca[j] !== -1 || !andavel(mundo, nx, ny)) continue;
        marca[j] = id;
        fila.push(j);
      }
    }
    if (fila.length > melhor.tamanho) melhor = { id, tamanho: fila.length };
    id++;
  }
  mundo.regiao = new Uint8Array(largura * altura);
  for (let i = 0; i < marca.length; i++) {
    if (marca[i] === melhor.id) mundo.regiao[i] = 1;
  }
  mundo.tamanhoDaRegiao = melhor.tamanho;
}

function naRegiao(mundo, x, y) {
  if (x < 0 || y < 0 || x >= mundo.largura || y >= mundo.altura) return false;
  return mundo.regiao[y * mundo.largura + x] === 1;
}

function plantarVilas(mundo, sorteio) {
  const { largura, altura } = mundo;
  const candidatas = [];
  for (let tentativa = 0; tentativa < 20000 && candidatas.length < CONFIG.vilas * 120; tentativa++) {
    const x = 18 + Math.floor(sorteio() * (largura - 36));
    const y = 18 + Math.floor(sorteio() * (altura - 36));
    if (!naRegiao(mundo, x, y)) continue;
    // terreno em volta precisa ser majoritariamente andavel: vila em istmo de
    // uma celula e vila que o jogador nao consegue circular
    let livre = 0;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) if (andavel(mundo, x + dx, y + dy)) livre++;
    }
    if (livre < 40) continue;
    candidatas.push({ x, y, livre });
  }
  candidatas.sort((a, b) => b.livre - a.livre);

  for (const c of candidatas) {
    if (mundo.vilas.length >= CONFIG.vilas) break;
    const longe = mundo.vilas.every(v =>
      Math.hypot(v.x - c.x, v.y - c.y) > CONFIG.distanciaMinimaEntreVilas);
    if (!longe) continue;
    mundo.vilas.push(construirVila(mundo, c, mundo.vilas.length, sorteio));
  }
  // Se a semente for pobre de espaco, relaxa a distancia em vez de devolver um
  // mundo com tres vilas: a prova cobra cinco.
  let folga = CONFIG.distanciaMinimaEntreVilas;
  while (mundo.vilas.length < CONFIG.vilas && folga > 20) {
    folga -= 6;
    for (const c of candidatas) {
      if (mundo.vilas.length >= CONFIG.vilas) break;
      if (!mundo.vilas.every(v => Math.hypot(v.x - c.x, v.y - c.y) > folga)) continue;
      mundo.vilas.push(construirVila(mundo, c, mundo.vilas.length, sorteio));
    }
  }
}

function construirVila(mundo, centro, indice, sorteio) {
  const { largura } = mundo;
  const vila = {
    nome: NOMES_VILAS[indice % NOMES_VILAS.length],
    x: centro.x, y: centro.y,
    npcs: [], casas: [], agua: null,
  };

  // roca em volta: a vila se ve de longe porque o chao muda de cor
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const x = centro.x + dx;
      const y = centro.y + dy;
      const i = y * largura + x;
      if (i < 0 || i >= mundo.terreno.length) continue;
      if (BLOQUEIA.has(mundo.terreno[i])) continue;
      if (Math.hypot(dx, dy) < 5) mundo.terreno[i] = TERRENOS.roca;
    }
  }

  // cacimba: agua da vila, numa celula andavel ao lado do centro
  for (const [dx, dy] of [[2, 2], [-2, 2], [2, -2], [-2, -2], [3, 0], [0, 3]]) {
    if (andavel(mundo, centro.x + dx, centro.y + dy)) {
      vila.agua = { x: centro.x + dx, y: centro.y + dy, tipo: 'cacimba' };
      break;
    }
  }
  if (!vila.agua) vila.agua = { x: centro.x, y: centro.y, tipo: 'cacimba' };

  const quantas = 3 + Math.floor(sorteio() * 3);
  const usados = new Set();
  // Celula ocupada: dois NPCs no mesmo lugar deixavam a conversa ambigua, e o
  // jogo escolhia o vizinho errado. O robo ficou parado a um metro da
  // curandeira por vinte segundos apertando conversa com a rezadeira.
  const celulasOcupadas = new Set([`${centro.x},${centro.y}`]);
  for (let n = 0; n < quantas; n++) {
    const papel = n === 0 ? 'vendedor' : PAPEIS[1 + ((indice + n) % (PAPEIS.length - 1))];
    let nome = NOMES_PESSOAS[Math.floor(sorteio() * NOMES_PESSOAS.length)];
    while (usados.has(nome)) nome = NOMES_PESSOAS[(NOMES_PESSOAS.indexOf(nome) + 1) % NOMES_PESSOAS.length];
    usados.add(nome);
    let posto = null;
    for (let tentativa = 0; tentativa < 120 && !posto; tentativa++) {
      const ang = sorteio() * Math.PI * 2;
      const raio = 1.5 + sorteio() * 3.2;
      const x = Math.round(centro.x + Math.cos(ang) * raio);
      const y = Math.round(centro.y + Math.sin(ang) * raio);
      if (!andavel(mundo, x, y)) continue;
      if (celulasOcupadas.has(`${x},${y}`)) continue;
      celulasOcupadas.add(`${x},${y}`);
      posto = { x, y };
    }
    vila.npcs.push({
      nome, papel, vila: vila.nome,
      x: (posto ? posto.x : centro.x) + 0.5,
      y: (posto ? posto.y : centro.y) + 0.5,
    });
  }
  for (let n = 0; n < 6; n++) {
    const ang = (n / 6) * Math.PI * 2 + sorteio();
    vila.casas.push({
      x: centro.x + Math.cos(ang) * (2.4 + sorteio() * 2),
      y: centro.y + Math.sin(ang) * (2.4 + sorteio() * 2),
      ang: sorteio() * Math.PI,
    });
  }
  return vila;
}

function abrirEstradas(mundo) {
  const pares = [];
  for (let i = 1; i < mundo.vilas.length; i++) pares.push([i - 1, i]);
  if (mundo.vilas.length > 2) pares.push([mundo.vilas.length - 1, 0]);
  for (const [a, b] of pares) {
    const rota = caminho(mundo, mundo.vilas[a], mundo.vilas[b], { semEstrada: true });
    if (!rota) continue;
    for (const p of rota) mundo.estrada[p.y * mundo.largura + p.x] = 1;
    mundo.estradas.push({ de: mundo.vilas[a].nome, para: mundo.vilas[b].nome, pontos: rota });
  }
}

// Distancia em celulas ate a agua mais perto, por busca em largura a partir de
// toda celula de agua ao mesmo tempo. E o campo que a prova de sede consulta.
function medirDistanciaDaAgua(mundo) {
  const { largura, altura, terreno, distanciaDaAgua } = mundo;
  distanciaDaAgua.fill(30000);
  const fila = [];
  for (let i = 0; i < terreno.length; i++) {
    if (terreno[i] === TERRENOS.agua) {
      distanciaDaAgua[i] = 0;
      fila.push(i);
    }
  }
  for (const vila of mundo.vilas) {
    const i = vila.agua.y * largura + vila.agua.x;
    distanciaDaAgua[i] = 0;
    fila.push(i);
  }
  for (let cabeca = 0; cabeca < fila.length; cabeca++) {
    const i = fila[cabeca];
    const x = i % largura;
    const y = (i - x) / largura;
    const d = distanciaDaAgua[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= largura || ny >= altura) continue;
      const j = ny * largura + nx;
      if (terreno[j] === TERRENOS.serra) continue;
      if (distanciaDaAgua[j] <= d + 1) continue;
      distanciaDaAgua[j] = d + 1;
      fila.push(j);
    }
  }
}

// Tudo que o jogo espalha pelo mundo tem de estar na mesma regiao andavel da
// primeira vila. Sem esta mascara, um recurso nasce num bolsao de mata cercado
// de serra e a missao que pede aquele item fica impossivel — a prova de alvo
// pegou isso na semente 1703.
function marcarAlcance(mundo) {
  const { largura, altura } = mundo;
  mundo.alcance = new Uint8Array(largura * altura);
  const base = mundo.vilas[0];
  const fila = [base.y * largura + base.x];
  mundo.alcance[fila[0]] = 1;
  for (let cabeca = 0; cabeca < fila.length; cabeca++) {
    const i = fila[cabeca];
    const x = i % largura;
    const y = (i - x) / largura;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= largura || ny >= altura) continue;
      const j = ny * largura + nx;
      if (mundo.alcance[j] || !andavel(mundo, nx, ny)) continue;
      mundo.alcance[j] = 1;
      fila.push(j);
    }
  }
}

export function daParaChegar(mundo, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= mundo.largura || cy >= mundo.altura) return false;
  return mundo.alcance[cy * mundo.largura + cx] === 1;
}

const TIPOS_RECURSO = [
  { tipo: 'couro', terreno: TERRENOS.caatinga, quantos: 26 },
  { tipo: 'mandacaru', terreno: TERRENOS.caatinga, quantos: 34 },
  { tipo: 'madeira', terreno: TERRENOS.mata, quantos: 30 },
  { tipo: 'pedra', terreno: TERRENOS.serra, quantos: 0 },
  { tipo: 'sal', terreno: TERRENOS.salina, quantos: 18 },
  { tipo: 'peca', terreno: TERRENOS.caatinga, quantos: 10 },
];

function espalharRecursos(mundo, sorteio) {
  for (const receita of TIPOS_RECURSO) {
    for (let n = 0; n < receita.quantos; n++) {
      for (let tentativa = 0; tentativa < 200; tentativa++) {
        const x = 6 + Math.floor(sorteio() * (mundo.largura - 12));
        const y = 6 + Math.floor(sorteio() * (mundo.altura - 12));
        if (!andavel(mundo, x, y) || !daParaChegar(mundo, x, y)) continue;
        if (mundo.terreno[y * mundo.largura + x] !== receita.terreno) continue;
        // Nada que uma missao mande buscar nasce fora do alcance de um cantil:
        // a prova de alvo pegou cinco punhados de sal a 64 celulas da agua.
        if (mundo.distanciaDaAgua[y * mundo.largura + x] > LIMITE_DE_AGUA) continue;
        mundo.recursos.push({ tipo: receita.tipo, x: x + 0.5, y: y + 0.5, pego: false });
        break;
      }
    }
  }
}

function assinar(mundo) {
  let h = 2166136261;
  for (let i = 0; i < mundo.terreno.length; i += 7) {
    h = (h ^ mundo.terreno[i]) * 16777619 & 0xffffffff;
  }
  for (const v of mundo.vilas) h = (h ^ (v.x * 31 + v.y * 17)) * 16777619 & 0xffffffff;
  for (const r of mundo.recursos) h = (h ^ (r.x | 0)) * 16777619 & 0xffffffff;
  return (h >>> 0).toString(16);
}

// ------------------------------------------------------------- consultas

export function tile(mundo, x, y) {
  if (x < 0 || y < 0 || x >= mundo.largura || y >= mundo.altura) return TERRENOS.serra;
  return mundo.terreno[y * mundo.largura + x];
}

export function andavel(mundo, x, y) {
  return !BLOQUEIA.has(tile(mundo, x, y));
}

export function naEstrada(mundo, x, y) {
  if (x < 0 || y < 0 || x >= mundo.largura || y >= mundo.altura) return false;
  return mundo.estrada[y * mundo.largura + x] === 1;
}

export function vizinhos(mundo, x, y) {
  const saida = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (andavel(mundo, x + dx, y + dy)) saida.push({ x: x + dx, y: y + dy });
  }
  return saida;
}

export function alcancavel(mundo, de, para) {
  return !!caminho(mundo, de, para, { limite: 60000 });
}

// A* em grade, com a estrada custando menos: e o que faz o caminho preferir a
// estrada quando ela existe, como faz qualquer um que anda no sertao.
export function caminho(mundo, de, para, opcoes = {}) {
  const largura = mundo.largura;
  const inicio = { x: Math.floor(de.x), y: Math.floor(de.y) };
  const fim = { x: Math.floor(para.x), y: Math.floor(para.y) };
  if (!andavel(mundo, inicio.x, inicio.y) || !andavel(mundo, fim.x, fim.y)) return null;

  const custo = new Map();
  const veio = new Map();
  const chave = (x, y) => y * largura + x;
  const heuristica = (x, y) => Math.abs(x - fim.x) + Math.abs(y - fim.y);
  const monte = new Monte();
  custo.set(chave(inicio.x, inicio.y), 0);
  monte.por(inicio, heuristica(inicio.x, inicio.y));
  // O limite existe para nao travar o navegador num pedido impossivel, e nao
  // para desistir de um pedido possivel: numa regiao de 40 mil celulas o A*
  // reinsere no aberto varias vezes, e 140 mil estouravam em pista torta.
  const limite = opcoes.limite || 900000;
  let visitados = 0;

  while (monte.tamanho && visitados++ < limite) {
    const no = monte.tira();
    const k = chave(no.x, no.y);
    if (no.x === fim.x && no.y === fim.y) break;
    const g = custo.get(k);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = no.x + dx;
      const ny = no.y + dy;
      if (!andavel(mundo, nx, ny)) continue;
      const t = tile(mundo, nx, ny);
      let peso = 1;
      if (!opcoes.semEstrada && naEstrada(mundo, nx, ny)) peso = 0.55;
      else if (t === TERRENOS.mata) peso = 1.5;
      else if (t === TERRENOS.salina) peso = 1.15;
      const kv = chave(nx, ny);
      const novo = g + peso;
      if (custo.has(kv) && custo.get(kv) <= novo) continue;
      custo.set(kv, novo);
      veio.set(kv, no);
      monte.por({ x: nx, y: ny }, novo + heuristica(nx, ny));
    }
  }

  const kFim = chave(fim.x, fim.y);
  if (!custo.has(kFim)) return null;
  const rota = [fim];
  let atual = kFim;
  while (atual !== chave(inicio.x, inicio.y)) {
    const anterior = veio.get(atual);
    if (!anterior) return null;
    rota.push(anterior);
    atual = chave(anterior.x, anterior.y);
  }
  return rota.reverse();
}

class Monte {
  constructor() { this.itens = []; }
  get tamanho() { return this.itens.length; }
  por(valor, peso) {
    const itens = this.itens;
    itens.push({ valor, peso });
    let i = itens.length - 1;
    while (i > 0) {
      const pai = (i - 1) >> 1;
      if (itens[pai].peso <= itens[i].peso) break;
      [itens[pai], itens[i]] = [itens[i], itens[pai]];
      i = pai;
    }
  }
  tira() {
    const itens = this.itens;
    const topo = itens[0];
    const ultimo = itens.pop();
    if (itens.length) {
      itens[0] = ultimo;
      let i = 0;
      for (;;) {
        const e = i * 2 + 1;
        const d = e + 1;
        let menor = i;
        if (e < itens.length && itens[e].peso < itens[menor].peso) menor = e;
        if (d < itens.length && itens[d].peso < itens[menor].peso) menor = d;
        if (menor === i) break;
        [itens[menor], itens[i]] = [itens[i], itens[menor]];
        i = menor;
      }
    }
    return topo.valor;
  }
}

// Devolve de onde se BEBE, e nao onde esta a agua: a celula de agua nao e
// andavel, e pedir rota para dentro do rio devolvia rota nenhuma. O robo ficava
// parado na beira do nada, com zero goles, ate morrer de sede.
//
// E devolve so margem que esta na regiao andavel de quem joga. A margem do
// outro lado da serra e mais perto em linha reta e nao tem rota: quem pedisse
// caminho para ela recebia nulo depois de o A* varrer a regiao inteira, e
// ficava parado olhando para agua que nunca ia alcancar.
export function aguaMaisProxima(mundo, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let melhor = null;
  for (const vila of mundo.vilas) {
    if (!daParaChegar(mundo, vila.agua.x, vila.agua.y)) continue;
    const d = Math.hypot(vila.agua.x - cx, vila.agua.y - cy);
    if (!melhor || d < melhor.d) melhor = { d, x: vila.agua.x, y: vila.agua.y, tipo: 'cacimba' };
  }
  for (let raio = 1; raio < 70; raio += 2) {
    let achou = null;
    for (let dy = -raio; dy <= raio; dy++) {
      for (let dx = -raio; dx <= raio; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== raio) continue;
        if (tile(mundo, cx + dx, cy + dy) !== TERRENOS.agua) continue;
        const margem = margemDe(mundo, cx + dx, cy + dy);
        if (!margem) continue;
        if (!daParaChegar(mundo, margem.x, margem.y)) continue;
        const d = Math.hypot(margem.x - cx, margem.y - cy);
        if (!achou || d < achou.d) achou = { d, x: margem.x, y: margem.y, tipo: 'rio' };
      }
    }
    if (achou && (!melhor || achou.d < melhor.d)) return achou;
    if (achou) break;
  }
  return melhor;
}

function margemDe(mundo, x, y) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    if (andavel(mundo, x + dx, y + dy)) return { x: x + dx, y: y + dy };
  }
  return null;
}

export { MISSOES };
