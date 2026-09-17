// A grade: ler a planta, dizer o que e solido, achar caminho, espalhar ruido —
// e provar que uma fase fecha.
//
// Nenhuma linha aqui toca em DOM. As funcoes do fim do arquivo
// (`completavel`, `itensInalcancaveis`, `segredos`, `danoDisponivel`,
// `bateriaDisponivel`, `distanciaMinimaDeTravessia`) existem para provas.mjs:
// sao elas que transformam "a fase parece boa" em "a fase fecha".

import { CONFIG, ITENS } from './regras.js';
import { danoPorUnidade } from './armas.js';

// Codigo abaixo de 10 e piso; de 10 a 19, parede macica; de 20 em diante,
// parede que pode abrir. A faixa e o que deixa `solido` ser tres comparacoes.
export const T = {
  PISO: 0, POCA: 1, LAMPADA: 2, ELEVADOR: 3,
  ROCHA: 10, CONCRETO: 11, CHAPA: 12,
  PORTA: 20, TRAVADA_A: 21, TRAVADA_B: 22, TRAVADA_C: 23, FALSA: 24,
};

const DE_CHAR = {
  '.': T.PISO, '~': T.POCA, 'o': T.LAMPADA, 'E': T.ELEVADOR, '@': T.PISO,
  '#': T.ROCHA, '=': T.CONCRETO, '%': T.CHAPA,
  '/': T.PORTA, '1': T.TRAVADA_A, '2': T.TRAVADA_B, '3': T.TRAVADA_C, '*': T.FALSA,
};

const CRACHA_DA_PORTA = { [T.TRAVADA_A]: 'A', [T.TRAVADA_B]: 'B', [T.TRAVADA_C]: 'C' };

const VIZINHOS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const chave = (x, y) => `${x},${y}`;

const RAIO_LAMPADA = 5.5;

export function carregar(fase) {
  const altura = fase.planta.length;
  const largura = fase.planta[0].length;
  const grade = new Uint8Array(largura * altura);
  const luzes = [];
  const inimigos = [];
  const itens = [];
  const portas = new Map();
  const portasLista = [];
  let inicio = { x: 1.5, y: 1.5 };
  let elevador = null;

  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const ch = fase.planta[y][x];
      let codigo = DE_CHAR[ch];
      if (codigo === undefined) {
        // Inimigo, item e cracha ficam sobre piso seco.
        codigo = T.PISO;
        if (ITENS[ch]) {
          itens.push({ ...ITENS[ch], char: ch, x: x + 0.5, y: y + 0.5, pego: false });
        } else if ('lrcux'.includes(ch)) {
          const tipo = { l: 'larva', r: 'rastejo', c: 'cego', u: 'cuspe', x: 'capataz' }[ch];
          inimigos.push({ tipo, x: x + 0.5, y: y + 0.5 });
        }
      }
      if (ch === '@') inicio = { x: x + 0.5, y: y + 0.5 };
      if (ch === 'o') luzes.push({ x: x + 0.5, y: y + 0.5, raio: RAIO_LAMPADA });
      if (ch === 'E') elevador = { x, y };
      grade[y * largura + x] = codigo;
      if (codigo >= T.PORTA) {
        const porta = {
          x, y, codigo, aberta: false, abertura: 0,
          cracha: CRACHA_DA_PORTA[codigo] || null,
          falsa: codigo === T.FALSA,
        };
        portas.set(chave(x, y), porta);
        portasLista.push(porta);
      }
    }
  }

  const mapa = {
    nome: fase.nome, dica: fase.dica, paleta: fase.paleta,
    exigeCapataz: !!fase.exigeCapataz,
    largura, altura, grade, luzes, inimigos, itens, portas, portasLista,
    inicio, elevador, luzMapa: new Float32Array(largura * altura),
  };
  assarLuz(mapa);
  mapa.inicio.ang = anguloMaisAberto(mapa, mapa.inicio);
  return mapa;
}

// Luz estatica das lampadas, resolvida uma vez na carga: o render le por celula
// e a percepcao do inimigo usa o mesmo valor, senao o bicho ve voce num escuro
// que a tela mostra iluminado.
function assarLuz(m) {
  for (const luz of m.luzes) {
    const cx = Math.floor(luz.x);
    const cy = Math.floor(luz.y);
    const r = Math.ceil(luz.raio);
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= m.largura || y >= m.altura) continue;
        const d = Math.hypot(x + 0.5 - luz.x, y + 0.5 - luz.y);
        if (d > luz.raio) continue;
        if (solido(m, x, y) && !m.portas.has(chave(x, y))) continue;
        const centro = { x: x + 0.5, y: y + 0.5 };
        if (!visadaLivre(m, luz, centro)) continue;
        const i = Math.max(0, 1 - d / luz.raio) ** 1.4;
        const idx = y * m.largura + x;
        if (i > m.luzMapa[idx]) m.luzMapa[idx] = i;
      }
    }
  }
}

// Bresenham por celula, so para a luz e para a percepcao grosseira. O tiro usa
// `paredeNaLinha` em armas.js, que e exato.
function visadaLivre(m, a, b) {
  let x = Math.floor(a.x);
  let y = Math.floor(a.y);
  const fim = { x: Math.floor(b.x), y: Math.floor(b.y) };
  const dx = Math.abs(fim.x - x);
  const dy = Math.abs(fim.y - y);
  const sx = fim.x > x ? 1 : -1;
  const sy = fim.y > y ? 1 : -1;
  let erro = dx - dy;
  let passos = 0;
  while ((x !== fim.x || y !== fim.y) && passos++ < 256) {
    const e2 = erro * 2;
    if (e2 > -dy) { erro -= dy; x += sx; }
    if (e2 < dx) { erro += dx; y += sy; }
    if ((x !== fim.x || y !== fim.y) && solido(m, x, y)) return false;
  }
  return true;
}

export function tile(m, x, y) {
  if (x < 0 || y < 0 || x >= m.largura || y >= m.altura) return T.ROCHA;
  return m.grade[y * m.largura + x];
}

export function luzDaCelula(m, x, y) {
  if (x < 0 || y < 0 || x >= m.largura || y >= m.altura) return 0;
  return m.luzMapa[y * m.largura + x];
}

// `crachas` nao nulo significa "planejando": porta que este chaveiro abre conta
// como passavel, mesmo fechada. Parede falsa nunca conta — segredo e opcional,
// e caminho que depende de segredo e caminho que o jogador nao acha.
export function solido(m, x, y, crachas = null) {
  if (x < 0 || y < 0 || x >= m.largura || y >= m.altura) return true;
  const c = m.grade[y * m.largura + x];
  if (c < T.ROCHA) return false;
  if (c < T.PORTA) return true;
  const porta = m.portas.get(chave(x, y));
  if (porta && porta.aberta) return false;
  if (!crachas) return true;
  if (c === T.PORTA) return false;
  const exigido = CRACHA_DA_PORTA[c];
  return exigido ? !crachas.has(exigido) : true;
}

export function portaEm(m, x, y) {
  return m.portas.get(chave(x, y)) || null;
}

export function abrir(m, x, y) {
  const porta = portaEm(m, x, y);
  if (!porta) return false;
  porta.aberta = true;
  return true;
}

// Usada pela tecla de acao: devolve o que aconteceu, para o HUD ter o que dizer.
export function usarPorta(m, x, y, crachas) {
  const porta = portaEm(m, x, y);
  if (!porta) return 'nada';
  if (porta.aberta) return 'aberta';
  if (porta.falsa) { porta.aberta = true; return 'segredo'; }
  if (porta.cracha && !crachas.has(porta.cracha)) return `falta-${porta.cracha}`;
  porta.aberta = true;
  return 'abriu';
}

export function vizinhaLivre(m, x, y) {
  for (const [dx, dy] of VIZINHOS) {
    if (!solido(m, x + dx, y + dy)) return { x: x + dx, y: y + dy };
  }
  return { x, y };
}

// -------------------------------------------------------------- busca

export function distancias(m, de, crachas = null) {
  const inicio = { x: Math.floor(de.x), y: Math.floor(de.y) };
  const vistos = new Map([[chave(inicio.x, inicio.y), 0]]);
  const fila = [inicio];
  for (let i = 0; i < fila.length; i++) {
    const no = fila[i];
    const d = vistos.get(chave(no.x, no.y));
    for (const [dx, dy] of VIZINHOS) {
      const x = no.x + dx;
      const y = no.y + dy;
      const k = chave(x, y);
      if (vistos.has(k) || solido(m, x, y, crachas)) continue;
      vistos.set(k, d + 1);
      fila.push({ x, y });
    }
  }
  return vistos;
}

export function caminho(m, de, para, opcoes = {}) {
  const crachas = opcoes.crachas || null;
  const inicio = { x: Math.floor(de.x), y: Math.floor(de.y) };
  const fim = { x: Math.floor(para.x), y: Math.floor(para.y) };
  if (solido(m, fim.x, fim.y, crachas)) return null;
  const kInicio = chave(inicio.x, inicio.y);
  const kFim = chave(fim.x, fim.y);
  const custo = new Map([[kInicio, 0]]);
  const veio = new Map();
  const heuristica = (x, y) => Math.abs(x - fim.x) + Math.abs(y - fim.y);
  const fila = new Monte();
  fila.por(inicio, heuristica(inicio.x, inicio.y));

  while (fila.tamanho) {
    const no = fila.tira();
    const k = chave(no.x, no.y);
    if (k === kFim) break;
    const g = custo.get(k);
    for (const [dx, dy] of VIZINHOS) {
      const x = no.x + dx;
      const y = no.y + dy;
      if (solido(m, x, y, crachas)) continue;
      const kv = chave(x, y);
      if (custo.has(kv) && custo.get(kv) <= g + 1) continue;
      custo.set(kv, g + 1);
      veio.set(kv, { x: no.x, y: no.y });
      fila.por({ x, y }, g + 1 + heuristica(x, y));
    }
  }
  if (!custo.has(kFim)) return null;

  const saida = [fim];
  let atual = kFim;
  while (atual !== kInicio) {
    const anterior = veio.get(atual);
    if (!anterior) return null;
    saida.push(anterior);
    atual = chave(anterior.x, anterior.y);
  }
  return saida.reverse();
}

// Monte binario. O A* do inimigo roda algumas vezes por segundo em nove fases;
// varredura linear numa fase de 1.300 celulas custa caro sem motivo.
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

// -------------------------------------------------------------- ruido
//
// Som anda pela mesma topologia que o corpo, menos as paredes: porta fechada
// deixa passar cobrando pedagio. Custo simetrico, entao o campo tambem e — e a
// prova cobra isso, porque assimetria aqui viraria bicho que ouve so de um lado.

export function alcanceRuido(m, origem, forca) {
  const inicio = { x: Math.floor(origem.x), y: Math.floor(origem.y) };
  const campo = new Map();
  if (forca <= 0) return campo;
  const fila = new Monte();
  fila.por(inicio, 0);
  const custos = new Map([[chave(inicio.x, inicio.y), 0]]);

  while (fila.tamanho) {
    const no = fila.tira();
    const k = chave(no.x, no.y);
    const custo = custos.get(k);
    if (custo >= forca) continue;
    if (!campo.has(k) || campo.get(k) < forca - custo) campo.set(k, forca - custo);
    for (const [dx, dy] of VIZINHOS) {
      const x = no.x + dx;
      const y = no.y + dy;
      const t = tile(m, x, y);
      if (t >= T.ROCHA && t < T.PORTA) continue;
      const porta = m.portas.get(chave(x, y));
      if (porta && porta.falsa && !porta.aberta) continue;
      const pedagio = porta && !porta.aberta ? CONFIG.custoPorta : 0;
      const novo = custo + 1 + pedagio;
      if (novo >= forca) continue;
      const kv = chave(x, y);
      if (custos.has(kv) && custos.get(kv) <= novo) continue;
      custos.set(kv, novo);
      fila.por({ x, y }, novo);
    }
  }
  return campo;
}

// -------------------------------------------------- provas sobre a fase


// Quantas celulas de piso a fase tem, com tudo aberto. Serve de escala de
// "fase inteira": e contra ela que a prova cobra que a pilha NAO da para andar
// a fase toda com a lanterna acesa.
export function celulasAndaveis(m) {
  return comSegredosAbertos(m, () => distancias(m, m.inicio, todosOsCrachas()).size);
}

function todosOsCrachas() { return new Set(['A', 'B', 'C']); }

function comSegredosAbertos(m, fn) {
  const fechadas = m.portasLista.filter(p => p.falsa && !p.aberta);
  for (const p of fechadas) p.aberta = true;
  try { return fn(); } finally { for (const p of fechadas) p.aberta = false; }
}

export function completavel(m) {
  const crachas = new Set();
  const ordem = [];
  for (let volta = 0; volta <= 4; volta++) {
    const d = distancias(m, m.inicio, crachas);
    if (m.exigeCapataz) {
      const chefe = m.inimigos.find(e => e.tipo === 'capataz');
      if (!chefe) return { ok: false, motivo: 'fase exige capataz e nao tem nenhum' };
      if (!d.has(chave(Math.floor(chefe.x), Math.floor(chefe.y)))) {
        return { ok: false, motivo: 'o capataz que libera o elevador e inalcancavel' };
      }
    }
    if (m.elevador && d.has(chave(m.elevador.x, m.elevador.y))) {
      return { ok: true, ordem };
    }
    let achou = false;
    for (const item of m.itens) {
      if (!item.cracha || crachas.has(item.cracha)) continue;
      if (!d.has(chave(Math.floor(item.x), Math.floor(item.y)))) continue;
      crachas.add(item.cracha);
      ordem.push(item.cracha);
      achou = true;
    }
    if (!achou) {
      const faltam = [...'ABC'].filter(c => !crachas.has(c)
        && m.itens.some(i => i.cracha === c));
      return {
        ok: false,
        motivo: faltam.length
          ? `elevador fora de alcance com ${ordem.join('') || 'nenhum cracha'}; `
            + `${faltam.join(', ')} esta atras de porta que ele mesmo abre`
          : 'elevador fora de alcance mesmo com todos os crachas',
      };
    }
  }
  return { ok: false, motivo: 'fechamento de crachas nao convergiu' };
}

export function itensInalcancaveis(m) {
  const alcance = comSegredosAbertos(m, () => distancias(m, m.inicio, todosOsCrachas()));
  return m.itens
    .filter(i => !alcance.has(chave(Math.floor(i.x), Math.floor(i.y))))
    .map(i => ({ tipo: i.tipo, x: Math.floor(i.x), y: Math.floor(i.y) }));
}

export function segredos(m) {
  const base = distancias(m, m.inicio, todosOsCrachas());
  const naBase = i => base.has(chave(Math.floor(i.x), Math.floor(i.y)));
  const saida = [];
  for (const porta of m.portasLista) {
    if (!porta.falsa) continue;
    const alcancavel = VIZINHOS.some(([dx, dy]) =>
      base.has(chave(porta.x + dx, porta.y + dy)));
    porta.aberta = true;
    const aberto = distancias(m, m.inicio, todosOsCrachas());
    porta.aberta = false;
    const premio = m.itens.filter(i =>
      !naBase(i) && aberto.has(chave(Math.floor(i.x), Math.floor(i.y)))).length;
    saida.push({ x: porta.x, y: porta.y, alcancavel, premio });
  }
  return saida;
}

export function danoDisponivel(m) {
  let dano = 0;
  for (const [municao, qtd] of Object.entries(CONFIG.municaoInicial)) {
    dano += qtd * danoPorUnidade(municao);
  }
  for (const item of m.itens) {
    dano += (item.qtd || 0) * danoPorUnidade(item.tipo);
  }
  return Math.round(dano);
}

export function bateriaDisponivel(m) {
  const pilhas = m.itens.filter(i => i.tipo === 'pilha').length;
  return CONFIG.bateriaEntrada + pilhas * ITENS.V.qtd;
}

// Quantas celulas o jogador percorre, no minimo, para sair da fase: soma dos
// trechos entre inicio, cada cracha que a fase exige e o elevador.
export function distanciaMinimaDeTravessia(m) {
  const crachas = new Set();
  let pos = { x: Math.floor(m.inicio.x), y: Math.floor(m.inicio.y) };
  let total = 0;
  for (let volta = 0; volta <= 4; volta++) {
    const d = distancias(m, pos, crachas);
    const saida = m.elevador && d.get(chave(m.elevador.x, m.elevador.y));
    if (saida !== undefined && saida !== false) return total + saida;
    let melhor = null;
    for (const item of m.itens) {
      if (!item.cracha || crachas.has(item.cracha)) continue;
      const k = chave(Math.floor(item.x), Math.floor(item.y));
      if (!d.has(k)) continue;
      if (!melhor || d.get(k) < melhor.d) melhor = { d: d.get(k), item };
    }
    if (!melhor) break;
    total += melhor.d;
    crachas.add(melhor.item.cracha);
    pos = { x: Math.floor(melhor.item.x), y: Math.floor(melhor.item.y) };
  }
  return total || 1;
}

// ------------------------------------------------ apoio para as provas

export function celulaLongeDoInicio(m, minimo) {
  const d = distancias(m, m.inicio, todosOsCrachas());
  let escolhida = null;
  for (const [k, dist] of d) {
    const [x, y] = k.split(',').map(Number);
    if (dist >= minimo) return { x, y, dist };
    if (!escolhida || dist > escolhida.dist) escolhida = { x, y, dist };
  }
  return escolhida;
}

export function primeiraParedeDepoisDoInicio(m) {
  const cx = Math.floor(m.inicio.x);
  const cy = Math.floor(m.inicio.y);
  let melhor = null;
  for (const [dx, dy] of VIZINHOS) {
    let passos = 0;
    while (!solido(m, cx + dx * (passos + 1), cy + dy * (passos + 1)) && passos < 40) passos++;
    const distancia = dx !== 0
      ? Math.abs((cx + dx * (passos + 1) + (dx > 0 ? 0 : 1)) - m.inicio.x)
      : Math.abs((cy + dy * (passos + 1) + (dy > 0 ? 0 : 1)) - m.inicio.y);
    if (!melhor || passos > melhor.passos) {
      melhor = { passos, dir: { x: dx, y: dy }, distancia };
    }
  }
  return { origem: { x: m.inicio.x, y: m.inicio.y }, dir: melhor.dir, distancia: melhor.distancia };
}

function anguloMaisAberto(m, inicio) {
  const cx = Math.floor(inicio.x);
  const cy = Math.floor(inicio.y);
  let melhor = { passos: -1, ang: 0 };
  for (const [dx, dy] of VIZINHOS) {
    let passos = 0;
    while (!solido(m, cx + dx * (passos + 1), cy + dy * (passos + 1)) && passos < 40) passos++;
    if (passos > melhor.passos) melhor = { passos, ang: Math.atan2(dy, dx) };
  }
  return melhor.ang;
}
