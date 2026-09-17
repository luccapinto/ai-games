// A corrida: dez carros, contagem de setor, vacuo, toque, muro, box e
// classificacao. Sem DOM — o navegador so le o estado que sai daqui.
//
// A parte que mais importa e a mais chata: volta so conta com os tres setores na
// ordem. Sem isso, cortar a curva vira estrategia e atravessar a linha de re
// vira volta. A prova correspondente e a primeira que eu escrevi.

import { CARRO, criarCarro, passoCarro, comandosNulos, DT } from './fisica.js';
import { PISTAS, carregar, superficie, maisProximo } from './pista.js';
import { linhaIdeal } from './linha.js';
import { criarPiloto, pilotar, PERFIS } from './piloto.js';

export const PONTOS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

const CONTAGEM = 3.2;
const TEMPO_BASE_BOX = 3.2;
const LIMITE_BOX = 12;

const NOMES = [
  'V. ANDRADE', 'R. KOBAYASHI', 'M. TEIXEIRA', 'D. OKONKWO', 'S. LARSEN',
  'P. ALMEIDA', 'H. NAKAMURA', 'C. ROSSI', 'B. ADEYEMI',
];
const CORES = [
  '#e8c24a', '#4aa8e0', '#e05a4a', '#7ae04a', '#c87ae0',
  '#e08a4a', '#4ae0c8', '#e0e0d8', '#8a8ae0',
];

export function criarCorrida(indicePista, opcoes = {}) {
  const pista = carregar(PISTAS[indicePista]);
  const linha = linhaIdeal(pista);
  const voltas = opcoes.voltas ?? pista.voltas;
  const comJogador = opcoes.jogador ?? true;
  const quantidadeIA = Math.min(9, opcoes.ia ?? 9);
  const perfis = Object.keys(PERFIS);

  const carros = [];
  let lugar = 0;
  if (comJogador) {
    const g = pista.grade[opcoes.largadaDoJogador ?? 0];
    const carro = criarCarro(g.x, g.y, g.ang, { nome: 'VOCE', cor: '#ffffff' });
    carros.push(preparar(carro, 'jogador', null, pista));
    lugar = 1;
  }
  for (let i = 0; i < quantidadeIA; i++) {
    const g = pista.grade[Math.min(pista.grade.length - 1, lugar + i)];
    const carro = criarCarro(g.x, g.y, g.ang, {
      nome: NOMES[i % NOMES.length],
      cor: CORES[i % CORES.length],
    });
    const perfil = opcoes.perfil || perfis[i % perfis.length];
    carros.push(preparar(carro, 'ia', criarPiloto(carro.nome, perfil, (opcoes.semente || 1) + i * 977), pista));
  }

  const corrida = {
    pista, linha, carros, voltas,
    indicePista,
    estado: 'largada',
    tempo: 0,
    contagem: CONTAGEM,
    eventos: [],
    melhorVolta: null,
    classificacao: [],
    toques: 0,
    menorDistancia: Infinity,
  };
  ordenar(corrida);
  return corrida;
}

function preparar(carro, tipo, piloto, pista) {
  const perto = maisProximo(pista, carro.x, carro.y);
  carro.tipo = tipo;
  carro.piloto = piloto;
  carro.voltas = 0;
  carro.setor = 3;
  carro.voltaIniciada = false;
  carro.voltaValida = true;
  carro.tempoVolta = 0;
  carro.melhorVolta = null;
  carro.ultimoIndice = perto.i;
  carro.indice = perto.i;
  carro.progresso = perto.i / pista.centro.length;
  carro.posicao = 0;
  carro.noBox = false;
  carro.tempoDeBox = 0;
  carro.paradas = 0;
  carro.toques = 0;
  carro.foraDaPista = 0;
  carro.terminou = false;
  return carro;
}

export function passoCorrida(corrida, comandosJogador, dt = DT) {
  const eventos = [];
  corrida.eventos = eventos;
  if (corrida.estado === 'terminada') return eventos;

  corrida.tempo += dt;
  if (corrida.estado === 'largada') {
    corrida.contagem -= dt;
    if (corrida.contagem <= 0) {
      corrida.estado = 'correndo';
      eventos.push({ tipo: 'largada' });
    }
  }

  const pista = corrida.pista;
  for (const carro of corrida.carros) {
    const sup = superficie(pista, carro.x, carro.y);
    carro.indice = sup.i;
    carro.lateral = sup.lateral;
    carro.superficie = sup.tipo;

    const vizinho = carroNaFrente(corrida, carro);
    const vacuo = vizinho && vizinho.distancia < 30 && Math.abs(vizinho.lateral) < 3.5
      ? 1 - vizinho.distancia / 30
      : 0;

    let comandos;
    if (corrida.estado === 'largada') {
      comandos = { ...comandosNulos(), freio: 1 };
    } else if (carro.tipo === 'jogador') {
      comandos = comandosJogador || comandosNulos();
    } else {
      comandos = pilotar(carro, carro.piloto, pista, corrida.linha,
        { frente: vizinho, noBox: carro.noBox, superficie: sup.tipo }, dt);
    }

    if (carro.noBox) {
      atenderBox(corrida, carro, eventos, dt);
      continue;
    }

    passoCarro(carro, comandos, { atrito: sup.atrito, vacuo }, dt);
    if (sup.tipo === 'grama' || sup.tipo === 'muro') carro.foraDaPista += dt;

    if (sup.tipo === 'muro') baterNoMuro(corrida, carro, eventos);
    conferirBox(corrida, carro, comandos, eventos);
    if (corrida.estado === 'correndo') contarVolta(corrida, carro, eventos);
    carro.tempoVolta += dt;
  }

  resolverToques(corrida, eventos);
  ordenar(corrida);
  return eventos;
}

// --------------------------------------------------------------- vizinhos

function carroNaFrente(corrida, carro) {
  const n = corrida.pista.centro.length;
  let melhor = null;
  for (const outro of corrida.carros) {
    if (outro === carro) continue;
    const dx = outro.x - carro.x;
    const dy = outro.y - carro.y;
    const distancia = Math.hypot(dx, dy);
    if (distancia > 40) continue;
    const frontal = dx * Math.cos(carro.ang) + dy * Math.sin(carro.ang);
    if (frontal <= 0) continue;
    const avanco = ((outro.indice - carro.indice + n) % n);
    if (avanco > n / 2) continue;
    if (!melhor || distancia < melhor.distancia) {
      melhor = {
        carro: outro, distancia,
        lateral: outro.lateral,
        fechado: Math.abs(outro.lateral - carro.lateral) < CARRO.largura * 1.3,
      };
    }
  }
  return melhor;
}

function resolverToques(corrida, eventos) {
  const carros = corrida.carros;
  const minimo = CARRO.largura * 1.05;
  // Tres passagens de separacao. Com uma so, tres carros lado a lado terminam
  // sobrepostos: a prova de "os carros nao se atravessam" pegou dois deles a
  // 0,57 m de centro a centro.
  for (let passagem = 0; passagem < 3; passagem++) {
    for (let i = 0; i < carros.length; i++) {
      for (let j = i + 1; j < carros.length; j++) {
        const a = carros[i];
        const b = carros[j];
        if (a.noBox || b.noBox) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        if (d >= minimo) continue;
        const nx = dx / d;
        const ny = dy / d;
        const sobra = (minimo - d) / 2 + 0.02;
        a.x -= nx * sobra;
        a.y -= ny * sobra;
        b.x += nx * sobra;
        b.y += ny * sobra;
        if (passagem > 0) continue;
        // Troca de quantidade de movimento na direcao do contato, com perda:
        // toque custa velocidade nos dois, e e isso que faz brigar por posicao
        // ter preco.
        const projetar = (c) => c.vx * Math.cos(c.ang) + c.vy * -Math.sin(c.ang);
        const troca = (projetar(a) * nx - projetar(b) * nx) * 0.25;
        a.vx -= troca * 0.5;
        b.vx += troca * 0.5;
        a.omega += (ny * 0.12) * Math.sign(a.vx || 1);
        b.omega -= (ny * 0.12) * Math.sign(b.vx || 1);
        a.toques++;
        b.toques++;
        corrida.toques++;
        a.dano = Math.min(1, a.dano + 0.01);
        b.dano = Math.min(1, b.dano + 0.01);
        eventos.push({ tipo: 'toque', carros: [a.nome, b.nome], forca: Math.abs(troca) });
      }
    }
  }
  // A menor distancia e medida depois da separacao: e ela que diz se o jogo
  // deixou dois carros ocuparem o mesmo lugar.
  for (let i = 0; i < carros.length; i++) {
    for (let j = i + 1; j < carros.length; j++) {
      const a = carros[i];
      const b = carros[j];
      if (a.noBox || b.noBox) continue;
      corrida.menorDistancia = Math.min(corrida.menorDistancia,
        Math.hypot(b.x - a.x, b.y - a.y));
    }
  }
}

function baterNoMuro(corrida, carro, eventos) {
  const perto = maisProximo(corrida.pista, carro.x, carro.y);
  const limite = perto.largura / 2 + 8.9;
  const sinal = Math.sign(perto.lateral) || 1;
  const c = corrida.pista.centro[perto.i];
  const nx = -Math.sin(c.ang);
  const ny = Math.cos(c.ang);
  carro.x = c.x + nx * limite * sinal;
  carro.y = c.y + ny * limite * sinal;
  carro.vx *= 0.55;
  carro.vy *= -0.3;
  carro.omega *= -0.2;
  carro.dano = Math.min(1, carro.dano + 0.04);
  eventos.push({ tipo: 'muro', carro: carro.nome, x: carro.x, y: carro.y });
}

// -------------------------------------------------------------------- box

function conferirBox(corrida, carro, comandos, eventos) {
  const box = corrida.pista.box;
  const d = Math.hypot(carro.x - box.x, carro.y - box.y);
  if (d > box.raio) return;
  if (Math.abs(carro.vx) > LIMITE_BOX) return;
  if (comandos.acelerador > 0.2) return;
  carro.noBox = true;
  carro.tempoDeBox = 0;
  carro.vx = 0;
  carro.vy = 0;
  carro.omega = 0;
  eventos.push({ tipo: 'box-inicio', carro: carro.nome });
}

function atenderBox(corrida, carro, eventos, dt) {
  carro.tempoDeBox += dt;
  carro.vx = 0;
  carro.vy = 0;
  carro.omega = 0;
  carro.tempoVolta += dt;
  const necessario = TEMPO_BASE_BOX + Math.min(1, carro.pneus.desgaste) * 1.5;
  if (carro.tempoDeBox < necessario) return;
  carro.pneus.desgaste = 0;
  carro.pneus.temp = 0.25;
  carro.combustivel = CARRO.tanque;
  carro.dano = Math.max(0, carro.dano - 0.5);
  carro.noBox = false;
  carro.paradas++;
  eventos.push({ tipo: 'box-fim', carro: carro.nome, tempo: carro.tempoDeBox });
}

// --------------------------------------------------------- setor e volta

function contarVolta(corrida, carro, eventos) {
  const n = corrida.pista.centro.length;
  const de = carro.ultimoIndice;
  const para = carro.indice;
  if (de === para) return;
  const avanco = (para - de + n) % n;
  if (avanco > n / 2) {
    // Andou para tras: a volta perde a validade, e e assim que dar re na
    // chegada deixa de contar.
    carro.voltaValida = false;
    carro.ultimoIndice = para;
    return;
  }

  const setores = corrida.pista.setores;
  for (let k = 0; k < 3; k++) {
    const marca = setores[k];
    const passou = ((marca - de + n) % n) <= avanco && ((marca - de + n) % n) > 0;
    if (!passou) continue;
    if (k === 0) {
      if (carro.voltaIniciada && carro.setor === 3) {
        if (carro.voltaValida) {
          carro.voltas++;
          if (!carro.melhorVolta || carro.tempoVolta < carro.melhorVolta) {
            carro.melhorVolta = carro.tempoVolta;
          }
          if (!corrida.melhorVolta || carro.tempoVolta < corrida.melhorVolta.tempo) {
            corrida.melhorVolta = { tempo: carro.tempoVolta, nome: carro.nome };
          }
          eventos.push({ tipo: 'volta', carro: carro.nome, tempo: carro.tempoVolta, voltas: carro.voltas });
          if (carro.voltas >= corrida.voltas && !carro.terminou) {
            carro.terminou = true;
            eventos.push({ tipo: 'bandeirada', carro: carro.nome });
            if (!corrida.carros.some(c => c.terminou && c !== carro)) {
              terminar(corrida, eventos);
            }
          }
        } else {
          eventos.push({ tipo: 'volta-invalida', carro: carro.nome });
        }
      }
      carro.voltaIniciada = true;
      carro.tempoVolta = 0;
      carro.voltaValida = true;
      carro.setor = 1;
    } else if (carro.setor === k) {
      carro.setor = k + 1;
    } else {
      carro.voltaValida = false;
    }
  }
  carro.ultimoIndice = para;
}

function ordenar(corrida) {
  const n = corrida.pista.centro.length;
  for (const carro of corrida.carros) {
    carro.progresso = carro.voltas + carro.indice / n;
  }
  const ordem = [...corrida.carros].sort((a, b) => b.progresso - a.progresso);
  for (const [i, carro] of ordem.entries()) carro.posicao = i + 1;
  corrida.ordem = ordem;
}

function terminar(corrida, eventos) {
  corrida.estado = 'terminada';
  ordenar(corrida);
  corrida.classificacao = corrida.ordem.map((carro, i) => ({
    posicao: i + 1,
    nome: carro.nome,
    tipo: carro.tipo,
    voltas: carro.voltas,
    progresso: carro.progresso,
    melhorVolta: carro.melhorVolta || 0,
    paradas: carro.paradas,
    toques: carro.toques,
  }));
  eventos.push({ tipo: 'fim', classificacao: corrida.classificacao });
}

// Campeonato: recebe uma lista de corridas, cada uma com a ordem de chegada.
export function classificacao(corridas) {
  const soma = new Map();
  for (const corrida of corridas) {
    for (const [i, nome] of corrida.pilotos.entries()) {
      const pontos = PONTOS[i] || 0;
      const atual = soma.get(nome) || { nome, pontos: 0, vitorias: 0, corridas: 0 };
      atual.pontos += pontos;
      atual.corridas++;
      if (i === 0) atual.vitorias++;
      soma.set(nome, atual);
    }
  }
  return [...soma.values()].sort((a, b) => b.pontos - a.pontos || b.vitorias - a.vitorias);
}

export { PERFIS };
