// A grade: ler a planta, dizer o que e solido, dizer por onde o zumbi anda, e
// provar que o mapa serve para o jogo que ele promete.
//
// Nenhuma linha aqui toca em DOM. As funcoes do fim do arquivo existem para
// `provas.mjs` — sao elas que transformam "o mapa parece bom" em "o mapa
// fecha": toda janela alcanca o jogador, toda maquina e alcancavel, e existe
// **volta** (um ciclo grande o bastante para arrastar horda sem ficar preso num
// canto). Num jogo de sobrevivencia por rodadas, mapa sem volta e mapa onde a
// rodada 12 mata todo mundo no mesmo canto, sempre.
//
// A navegacao dos zumbis nao e A* por bicho: e um **campo de fluxo** refeito
// algumas vezes por segundo a partir do jogador. Vinte e quatro zumbis fazendo
// A* cada um custaria mais que o resto do jogo junto, e o resultado seria o
// mesmo, porque todos perseguem o mesmo ponto.

import { CELULA } from './regras.js';

export const T = {
  PISO: 0,
  POCA: 1,
  LAMPADA: 2,
  ROCHA: 10,
  CONCRETO: 11,
  CHAPA: 12,
  // A janela e parede para o corpo e vao para a bala: o jogador nao passa por
  // ela (nem para fora, nem para dentro), mas atira no zumbi que esta subindo.
  // Sem essa distincao, ou o jogador escapa pela janela ou ele nao consegue
  // defender a janela — e defender janela e o jogo.
  JANELA: 13,
  PORTA: 20,
};

const DE_CHAR = {
  '#': T.ROCHA, '=': T.CONCRETO, '%': T.CHAPA,
  '.': T.PISO, '~': T.POCA, o: T.LAMPADA, '@': T.PISO,
  J: T.JANELA,
  1: T.PORTA, 2: T.PORTA, 3: T.PORTA, 4: T.PORTA, 5: T.PORTA,
  S: T.PISO, N: T.PISO, C: T.PISO, G: T.PISO,
  X: T.PISO, F: T.PISO, V: T.PISO, R: T.PISO, T: T.PISO, A: T.PISO, L: T.PISO,
};

// Maquina por caractere. O que a planta diz e o que o jogo vende: preco de arma
// mora em `armas.js`, preco de perk em `regras.js`, e a planta so diz onde.
const MAQUINA_DE_CHAR = {
  S: { tipo: 'arma', arma: 'espingarda' },
  N: { tipo: 'arma', arma: 'pineira' },
  C: { tipo: 'arma', arma: 'carabina' },
  G: { tipo: 'arma', arma: 'macarico' },
  X: { tipo: 'caixa' },
  F: { tipo: 'forja' },
  V: { tipo: 'perk', perk: 'caldo' },
  R: { tipo: 'perk', perk: 'graxa' },
  T: { tipo: 'perk', perk: 'gatilho' },
  A: { tipo: 'perk', perk: 'talisma' },
  L: { tipo: 'forca' },
};

const VIZINHOS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const chave = (x, y) => `${x},${y}`;

const RAIO_LAMPADA = 6.5;

export function carregar(planta) {
  const altura = planta.planta.length;
  const largura = Math.max(...planta.planta.map(l => l.length));
  const grade = new Uint8Array(largura * altura);
  const m = {
    nome: planta.nome,
    dica: planta.dica,
    paleta: planta.paleta,
    largura,
    altura,
    grade,
    portas: new Map(),
    janelas: [],
    maquinas: [],
    lampadas: [],
    pocas: [],
    inicio: null,
    // Zona por celula, resolvida na carga: e o que o jogo usa para saber que
    // "abriu a porta 2" liberou a zona toda de uma vez.
    zonaDaCelula: new Int16Array(largura * altura).fill(-1),
    zonas: [],
    luz: new Float32Array(largura * altura),
  };

  for (let y = 0; y < altura; y++) {
    const linha = planta.planta[y];
    for (let x = 0; x < largura; x++) {
      const ch = linha[x] ?? '#';
      const tipo = DE_CHAR[ch] ?? T.ROCHA;
      grade[y * largura + x] = tipo;
      if (ch === '@') m.inicio = { x: x + 0.5, y: y + 0.5 };
      if (ch === 'o') m.lampadas.push({ x: x + 0.5, y: y + 0.5 });
      if (ch === '~') m.pocas.push({ x, y });
      if (tipo === T.PORTA) {
        const custo = (planta.portas && planta.portas[ch]) ?? 750;
        m.portas.set(chave(x, y), { x, y, marca: ch, custo, aberta: false });
      }
      if (ch === 'J') {
        m.janelas.push({
          x, y,
          // Onde o zumbi aparece (fora) e onde ele pisa (dentro) saem da
          // geometria: a janela e uma celula de piso cercada de parede por tres
          // lados, e o lado livre e o lado de dentro.
          dentro: null,
          fora: null,
          tabuas: 0,
          progresso: 0,
        });
      }
      const maquina = MAQUINA_DE_CHAR[ch];
      if (maquina) {
        m.maquinas.push({
          ...maquina,
          x: x + 0.5,
          y: y + 0.5,
          celula: { x, y },
          ligada: maquina.tipo !== 'perk' && maquina.tipo !== 'forja',
        });
      }
    }
  }

  if (!m.inicio) throw new Error(`${planta.nome}: planta sem inicio (@)`);

  resolverJanelas(m);
  resolverZonas(m);
  assarLuz(m);
  return m;
}

// O lado de dentro de uma janela e a vizinha de piso que pertence a uma zona; o
// lado de fora e a direcao oposta, e ali o zumbi nasce mesmo sendo rocha —
// zumbi vem da rocha, e nisso o jogo e honesto: ele nasce onde nao da para o
// jogador ir.
function resolverJanelas(m) {
  for (const janela of m.janelas) {
    let dentro = null;
    for (const [dx, dy] of VIZINHOS) {
      const nx = janela.x + dx;
      const ny = janela.y + dy;
      if (nx < 0 || ny < 0 || nx >= m.largura || ny >= m.altura) continue;
      if (ehSolido(m.grade[ny * m.largura + nx])) continue;
      if (m.janelas.some(j => j.x === nx && j.y === ny)) continue;
      dentro = { x: nx, y: ny };
      janela.fora = { x: janela.x - dx, y: janela.y - dy };
      break;
    }
    if (!dentro) throw new Error(`${m.nome}: janela em ${janela.x},${janela.y} sem lado de dentro`);
    janela.dentro = dentro;
  }
}

// Zona = componente conexa de piso, com porta contando como parede. E a unidade
// que o jogador compra: "abrir por 1000" nao abre uma celula, abre uma sala.
function resolverZonas(m) {
  let id = 0;
  for (let y = 0; y < m.altura; y++) {
    for (let x = 0; x < m.largura; x++) {
      const i = y * m.largura + x;
      if (ehSolido(m.grade[i]) || m.grade[i] === T.PORTA) continue;
      if (m.zonaDaCelula[i] !== -1) continue;
      const celulas = [];
      const fila = [[x, y]];
      m.zonaDaCelula[i] = id;
      while (fila.length) {
        const [cx, cy] = fila.pop();
        celulas.push({ x: cx, y: cy });
        for (const [dx, dy] of VIZINHOS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= m.largura || ny >= m.altura) continue;
          const j = ny * m.largura + nx;
          if (ehSolido(m.grade[j]) || m.grade[j] === T.PORTA) continue;
          if (m.zonaDaCelula[j] !== -1) continue;
          m.zonaDaCelula[j] = id;
          fila.push([nx, ny]);
        }
      }
      m.zonas.push({ id, celulas, aberta: false });
      id++;
    }
  }
  // A zona do inicio ja esta aberta; as outras entram com a porta.
  const zonaInicial = zonaEm(m, Math.floor(m.inicio.x), Math.floor(m.inicio.y));
  if (zonaInicial < 0) throw new Error(`${m.nome}: o inicio nao caiu em zona nenhuma`);
  m.zonas[zonaInicial].aberta = true;
  m.zonaInicial = zonaInicial;

  // Que zonas cada porta liga. Porta que liga a mesma zona dos dois lados e
  // porta decorativa, e a prova reprova: o jogador pagaria por nada.
  for (const porta of m.portas.values()) {
    const lados = new Set();
    for (const [dx, dy] of VIZINHOS) {
      const z = zonaEm(m, porta.x + dx, porta.y + dy);
      if (z >= 0) lados.add(z);
    }
    porta.zonas = [...lados];
  }
}

export function zonaEm(m, x, y) {
  if (x < 0 || y < 0 || x >= m.largura || y >= m.altura) return -1;
  return m.zonaDaCelula[y * m.largura + x];
}

// Luz das lampadas, assada uma vez. O render le por celula e o HUD de escuro
// tambem: se os dois nao lessem o mesmo numero, a tela mostraria claro onde o
// jogo considera escuro.
function assarLuz(m) {
  for (const lamp of m.lampadas) {
    const cx = Math.floor(lamp.x);
    const cy = Math.floor(lamp.y);
    const raio = Math.ceil(RAIO_LAMPADA);
    for (let y = cy - raio; y <= cy + raio; y++) {
      for (let x = cx - raio; x <= cx + raio; x++) {
        if (x < 0 || y < 0 || x >= m.largura || y >= m.altura) continue;
        const d = Math.hypot(x + 0.5 - lamp.x, y + 0.5 - lamp.y);
        if (d > RAIO_LAMPADA) continue;
        if (!visadaLivre(m, { x: lamp.x, y: lamp.y }, { x: x + 0.5, y: y + 0.5 })) continue;
        const i = y * m.largura + x;
        m.luz[i] = Math.min(1, m.luz[i] + (1 - d / RAIO_LAMPADA) ** 1.6);
      }
    }
  }
}

function visadaLivre(m, a, b) {
  const passos = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 3);
  for (let i = 1; i < passos; i++) {
    const t = i / passos;
    const x = Math.floor(a.x + (b.x - a.x) * t);
    const y = Math.floor(a.y + (b.y - a.y) * t);
    if (ehSolido(m.grade[y * m.largura + x])) return false;
  }
  return true;
}

export function ehSolido(tipo) {
  return tipo >= T.ROCHA && tipo !== T.PORTA;
}

export function tile(m, x, y) {
  if (x < 0 || y < 0 || x >= m.largura || y >= m.altura) return T.ROCHA;
  return m.grade[y * m.largura + x];
}

export function luzDaCelula(m, x, y) {
  if (x < 0 || y < 0 || x >= m.largura || y >= m.altura) return 0;
  return m.luz[y * m.largura + x];
}

// Solido para andar e para atirar. Porta fechada e solida; porta aberta nao. As
// tabuas da janela NAO sao solidas para o jogador (ele passa por cima) mas a
// janela nao liga zona nenhuma, entao nao ha atalho.
export function solido(m, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const t = tile(m, cx, cy);
  if (ehSolido(t)) return true;
  if (t === T.PORTA) {
    const porta = m.portas.get(chave(cx, cy));
    return !porta || !porta.aberta;
  }
  return false;
}

export function solidoNaCelula(m, cx, cy) {
  return solido(m, cx + 0.5, cy + 0.5);
}

// Solido para a BALA. A diferenca em relacao a `solido` e uma celula so: a
// janela. E a diferenca entre poder segurar uma janela e nao poder.
export function solidoParaTiro(m, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const t = tile(m, cx, cy);
  if (t === T.JANELA) return false;
  if (ehSolido(t)) return true;
  if (t === T.PORTA) {
    const porta = m.portas.get(chave(cx, cy));
    return !porta || !porta.aberta;
  }
  return false;
}

export function portaEm(m, x, y) {
  return m.portas.get(chave(x, y)) || null;
}

// Abrir uma porta abre as zonas dos dois lados: e isso que faz o dinheiro
// comprar espaco, e nao um metro quadrado.
// Porta e VAO, nao celula: abrir a marca 1 abre as tres celulas da marca 1, e
// cobra uma vez. A primeira versao abria uma celula so, e um vao de uma celula
// com zumbi de 0,45 de raio prende o bicho na quina — a passagem livre para o
// centro dele tinha 0,1 de largura, e ele ficava vibrando na porta para sempre.
export function abrirPorta(m, porta) {
  for (const outra of m.portas.values()) {
    if (outra.marca !== porta.marca) continue;
    outra.aberta = true;
    for (const z of outra.zonas || []) m.zonas[z].aberta = true;
  }
}

export function zonaAberta(m, x, y) {
  const z = zonaEm(m, Math.floor(x), Math.floor(y));
  return z >= 0 && m.zonas[z].aberta;
}

// ------------------------------------------------------- campo de fluxo

// Custo de andar numa celula, do ponto de vista do zumbi. Porta fechada e
// intransponivel; tabua de janela nao entra aqui porque a janela nao e caminho:
// ela e entrada, e quem trata dela e `zumbis.js`.
function andavelParaZumbi(m, x, y) {
  const t = tile(m, x, y);
  if (ehSolido(t)) return false;
  if (t === T.PORTA) {
    const porta = m.portas.get(chave(x, y));
    return !!porta && porta.aberta;
  }
  return true;
}

// Campo de fluxo: distancia em celulas de cada celula ate o jogador, por BFS.
// Um unico BFS serve os vinte e quatro zumbis, e e por isso que o jogo aguenta
// horda sem A* por bicho.
export function criarFluxo(m) {
  return {
    distancia: new Int32Array(m.largura * m.altura).fill(-1),
    proximo: new Int32Array(m.largura * m.altura).fill(-1),
    alvo: { x: -1, y: -1 },
  };
}

export function refazerFluxo(m, fluxo, alvo) {
  const ax = Math.floor(alvo.x);
  const ay = Math.floor(alvo.y);
  fluxo.distancia.fill(-1);
  fluxo.proximo.fill(-1);
  fluxo.alvo = { x: ax, y: ay };
  if (!andavelParaZumbi(m, ax, ay)) return fluxo;
  const inicio = ay * m.largura + ax;
  fluxo.distancia[inicio] = 0;
  const fila = new Int32Array(m.largura * m.altura);
  let cabeca = 0;
  let cauda = 0;
  fila[cauda++] = inicio;
  while (cabeca < cauda) {
    const i = fila[cabeca++];
    const x = i % m.largura;
    const y = (i - x) / m.largura;
    for (const [dx, dy] of VIZINHOS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.largura || ny >= m.altura) continue;
      const j = ny * m.largura + nx;
      if (fluxo.distancia[j] !== -1) continue;
      if (!andavelParaZumbi(m, nx, ny)) continue;
      fluxo.distancia[j] = fluxo.distancia[i] + 1;
      fluxo.proximo[j] = i;
      fila[cauda++] = j;
    }
  }
  return fluxo;
}

// Para onde andar, em coordenada de mundo, a partir de uma posicao qualquer.
// Devolve nulo quando a celula nao alcanca o jogador — o chamador decide o que
// fazer (o zumbi, nesse caso, empurra na direcao reta).
export function passoDoFluxo(m, fluxo, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= m.largura || cy >= m.altura) return null;
  const i = cy * m.largura + cx;
  const prox = fluxo.proximo[i];
  if (prox < 0) return null;
  const px = prox % m.largura;
  const py = (prox - px) / m.largura;
  return { x: px + 0.5, y: py + 0.5 };
}

export function distanciaDoFluxo(m, fluxo, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= m.largura || cy >= m.altura) return -1;
  return fluxo.distancia[cy * m.largura + cx];
}

// ------------------------------------------------------------- colisao

// Empurra um circulo para fora das paredes. Resolve eixo por eixo porque
// resolver junto faz o corpo grudar em quina — e grudar em quina, num jogo onde
// horda te encurrala, e morte que o jogador nao entende.
export function empurrarDeParede(m, pos, raio) {
  const cx = Math.floor(pos.x);
  const cy = Math.floor(pos.y);
  for (let y = cy - 1; y <= cy + 1; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (!solidoNaCelula(m, x, y)) continue;
      const maisProximoX = Math.max(x, Math.min(pos.x, x + 1));
      const maisProximoY = Math.max(y, Math.min(pos.y, y + 1));
      const dx = pos.x - maisProximoX;
      const dy = pos.y - maisProximoY;
      const d = Math.hypot(dx, dy);
      if (d >= raio) continue;
      if (d < 1e-6) {
        pos.x += raio;
        continue;
      }
      const sobra = (raio - d) / d;
      pos.x += dx * sobra;
      pos.y += dy * sobra;
    }
  }
  return pos;
}

export function mover(m, pos, dx, dy, raio) {
  const antesX = pos.x;
  pos.x += dx;
  empurrarDeParede(m, pos, raio);
  if (solido(m, pos.x, pos.y)) pos.x = antesX;
  const antesY = pos.y;
  pos.y += dy;
  empurrarDeParede(m, pos, raio);
  if (solido(m, pos.x, pos.y)) pos.y = antesY;
  return pos;
}

// ------------------------------------------------- provas sobre o mapa

// Toda celula de piso alcancavel com todas as portas abertas.
export function celulasAbertas(m) {
  const copia = paraTodasAsPortas(m, true);
  const fluxo = refazerFluxo(m, criarFluxo(m), m.inicio);
  let quantas = 0;
  for (const d of fluxo.distancia) if (d >= 0) quantas++;
  restaurarPortas(m, copia);
  return quantas;
}

// Janela que nao alcanca o jogador e janela que nasce zumbi preso: a prova
// cobra zero delas, com as portas da zona abertas.
export function janelasSemCaminho(m) {
  const copia = paraTodasAsPortas(m, true);
  const fluxo = refazerFluxo(m, criarFluxo(m), m.inicio);
  const ruins = [];
  for (const janela of m.janelas) {
    const d = distanciaDoFluxo(m, fluxo, janela.dentro.x + 0.5, janela.dentro.y + 0.5);
    if (d < 0) ruins.push(janela);
  }
  restaurarPortas(m, copia);
  return ruins;
}

export function maquinasSemCaminho(m) {
  const copia = paraTodasAsPortas(m, true);
  const fluxo = refazerFluxo(m, criarFluxo(m), m.inicio);
  const ruins = m.maquinas.filter(q => distanciaDoFluxo(m, fluxo, q.x, q.y) < 0);
  restaurarPortas(m, copia);
  return ruins;
}

// A VOLTA: existe um ciclo no grafo de piso, com todas as portas abertas, que
// passe por mais de uma zona? Sem isso, arrastar horda termina em beco e o jogo
// vira "morra na rodada 12 no mesmo canto".
//
// Acha o ciclo pela aresta que fecha: uma busca em profundidade guarda o pai de
// cada celula; aresta para uma celula ja visitada que nao seja o pai fecha um
// ciclo, e o tamanho dele sai somando as duas subidas ate o ancestral comum.
export function maiorVolta(m) {
  const copia = paraTodasAsPortas(m, true);
  const largura = m.largura;
  const total = largura * m.altura;
  const pai = new Int32Array(total).fill(-2);
  const profundidade = new Int32Array(total).fill(-1);
  const inicio = Math.floor(m.inicio.y) * largura + Math.floor(m.inicio.x);
  pai[inicio] = -1;
  profundidade[inicio] = 0;
  const pilha = [inicio];
  let melhor = { tamanho: 0, zonas: 0, celulas: [] };
  while (pilha.length) {
    const i = pilha.pop();
    const x = i % largura;
    const y = (i - x) / largura;
    for (const [dx, dy] of VIZINHOS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= largura || ny >= m.altura) continue;
      if (!andavelParaZumbi(m, nx, ny)) continue;
      const j = ny * largura + nx;
      if (pai[j] === -2) {
        pai[j] = i;
        profundidade[j] = profundidade[i] + 1;
        pilha.push(j);
      } else if (pai[i] !== j && pai[j] !== i) {
        // aresta que fecha ciclo: sobe os dois lados ate o ancestral comum
        let a = i;
        let b = j;
        const caminho = [];
        while (profundidade[a] > profundidade[b]) { caminho.push(a); a = pai[a]; }
        while (profundidade[b] > profundidade[a]) { caminho.push(b); b = pai[b]; }
        while (a !== b && a >= 0 && b >= 0) {
          caminho.push(a, b);
          a = pai[a];
          b = pai[b];
        }
        if (a >= 0) caminho.push(a);
        const zonas = new Set(caminho.map(k => m.zonaDaCelula[k]).filter(z => z >= 0));
        if (caminho.length > melhor.tamanho) {
          melhor = { tamanho: caminho.length, zonas: zonas.size, celulas: caminho };
        }
      }
    }
  }
  restaurarPortas(m, copia);
  return melhor;
}

// Preco total para abrir o mapa inteiro. A prova usa isto contra o que o robo
// consegue ganhar: mapa que custa mais do que o jogo paga e mapa que ninguem ve.
// Conta VAO, e nao celula: um vao de tres celulas cobra uma vez. A primeira
// versao somava celula por celula e dizia que abrir a BOCA DA MINA custava
// 12.000 quando custa 4.000.
export function custoParaAbrirTudo(m) {
  const porMarca = new Map();
  for (const porta of m.portas.values()) porMarca.set(porta.marca, porta.custo);
  let soma = 0;
  for (const custo of porMarca.values()) soma += custo;
  return soma;
}

function paraTodasAsPortas(m, aberto) {
  const antes = [];
  for (const porta of m.portas.values()) {
    antes.push([porta, porta.aberta]);
    porta.aberta = aberto;
  }
  return antes;
}

function restaurarPortas(m, copia) {
  for (const [porta, valor] of copia) porta.aberta = valor;
}

// Converte celula da planta para o mundo do render e de volta. Uma celula tem
// `CELULA` metros: o jogo inteiro pensa em celula, o render pensa em metro, e
// esta funcao e a unica fronteira entre os dois.
export function paraMetros(v) {
  return v * CELULA;
}
