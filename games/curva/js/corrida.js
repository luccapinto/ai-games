// A corrida: dez karts, contagem de setor, vacuo, toque, muro, caixas de item e
// classificacao. Sem DOM — o navegador so le o estado que sai daqui.
//
// A parte que mais importa e a mais chata: volta so conta com os tres setores na
// ordem. Sem isso, cortar a curva vira estrategia e atravessar a linha de re
// vira volta. A prova correspondente foi a primeira que eu escrevi.

import {
  KART, criarCarro, passoCarro, comandosNulos, darTurbo, rodopiar, DT,
} from './fisica.js';
import {
  PISTAS, carregar, superficie, maisProximo, alturaDoChao, paraMundo,
  LIMITE_GRAMA,
} from './pista.js';
import { linhaIdeal } from './linha.js';
import { criarPiloto, pilotar, PERFIS } from './piloto.js';

export const PONTOS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

const CONTAGEM = 3.2;
const TEMPO_DE_RECARGA_DA_CAIXA = 6;
const ALCANCE_DO_CASCO = 70;

// Sorteio de item enviesado pela posicao: quem esta atras tira item melhor. E a
// regra que faz corrida de kart ter volta por cima sem a IA precisar trapacear
// na fisica — e ela e explicita aqui, em vez de escondida num multiplicador de
// velocidade.
const TABELA_DE_ITENS = [
  { item: 'cogumelo', peso: (pos) => 3 + pos * 1.6 },
  { item: 'casco', peso: (pos) => 2 + pos * 1.1 },
  { item: 'banana', peso: (pos) => 4.5 - pos * 0.3 },
];

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
  const linha = linhaIdeal(pista, { semDrift: !!opcoes.semDrift });
  const voltas = opcoes.voltas ?? pista.voltas;
  const comJogador = opcoes.jogador ?? true;
  const quantidadeIA = Math.min(9, opcoes.ia ?? 9);
  const perfis = Object.keys(PERFIS);

  const carros = [];
  let lugar = 0;
  if (comJogador) {
    const g = pista.grade[opcoes.largadaDoJogador ?? 0];
    carros.push(preparar(criarCarro(g.x, g.y, g.ang, {
      nome: 'VOCE', cor: '#ffffff', z: g.z,
    }), 'jogador', null, pista));
    lugar = 1;
  }
  for (let i = 0; i < quantidadeIA; i++) {
    const g = pista.grade[Math.min(pista.grade.length - 1, lugar + i)];
    const carro = criarCarro(g.x, g.y, g.ang, {
      nome: NOMES[i % NOMES.length],
      cor: CORES[i % CORES.length],
      z: g.z,
    });
    const perfil = opcoes.perfil || perfis[i % perfis.length];
    carros.push(preparar(carro, 'ia',
      criarPiloto(carro.nome, perfil, (opcoes.semente || 1) + i * 977), pista));
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
  // Carencia por par de karts, para um encostao longo nao virar 60 batidas.
  carenciaDeToque: new Map(),
    bananas: [],
    cascos: [],
    semente: opcoes.semente || 1,
    sorteio: criarSorteio(opcoes.semente || 1),
  };
  for (const caixa of pista.caixas) { caixa.cheia = true; caixa.relogio = 0; }
  ordenar(corrida);
  return corrida;
}

function criarSorteio(semente) {
  let estado = (semente | 0) || 1;
  return () => {
    estado = (estado * 1103515245 + 12345) & 0x7fffffff;
    return estado / 0x7fffffff;
  };
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
  carro.toques = 0;
  carro.foraDaPista = 0;
  carro.atolado = 0;
  carro.recolocacoes = 0;
  carro.terminou = false;
  carro.turbosUsados = 0;
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
  for (const caixa of pista.caixas) {
    if (caixa.cheia) continue;
    caixa.relogio -= dt;
    if (caixa.relogio <= 0) caixa.cheia = true;
  }

  for (const carro of corrida.carros) {
    const sup = superficie(pista, carro.x, carro.y);
    carro.indice = sup.i;
    carro.lateral = sup.lateral;
    carro.superficie = sup.tipo;

    // Aperto: distancia do kart mais proximo, em qualquer direcao. A IA usa isso
    // para NAO atacar a linha ideal enquanto o pelotao esta colado. Medido: dos
    // 278 toques de uma corrida de tres voltas, 146 estavam nos primeiros 20 s —
    // dez karts saindo da largada e convergindo na mesma curva 1.
    let aperto = Infinity;
    for (const outro of corrida.carros) {
      if (outro === carro) continue;
      aperto = Math.min(aperto, Math.hypot(outro.x - carro.x, outro.y - carro.y));
    }

    const vizinho = carroNaFrente(corrida, carro);
    const vacuo = vizinho && vizinho.distancia < 22 && Math.abs(vizinho.lateral) < 2.6
      ? 1 - vizinho.distancia / 22
      : 0;

    let comandos;
    if (corrida.estado === 'largada') {
      comandos = { ...comandosNulos(), freio: 1 };
    } else if (carro.tipo === 'jogador') {
      comandos = comandosJogador || comandosNulos();
    } else {
      comandos = pilotar(carro, carro.piloto, pista, corrida.linha, {
        frente: vizinho, superficie: sup.tipo, atrito: sup.atrito, temItem: !!carro.item,
        aperto, lateral: sup.lateral,
      }, dt);
    }

    const antes = carro.turbo;
    passoCarro(carro, comandos, { atrito: sup.atrito, vacuo, subida: sup.subida }, dt);
    if (carro.turbo > antes + 0.2) {
      carro.turbosUsados++;
      eventos.push({ tipo: 'turbo', carro: carro.nome, faixa: carro.turboFaixa || 1 });
    }
    // O kart fica colado no chao da pista: a altura vem da geometria, nao de
    // uma simulacao de suspensao que nao existe. A inclinacao e a rampa do chao
    // vao junto porque o render 3D deita e arfa o kart com elas — a mesma
    // sobrelevacao que a fisica usa na gravidade.
    const chao = alturaDoChao(pista, carro.x, carro.y);
    carro.z += (chao - carro.z) * Math.min(1, dt * 12);
    carro.inclinacaoDoChao = sup.inclinacao;
    carro.subidaDoChao = sup.subida;
    carro.giroDaRoda = (carro.giroDaRoda || 0) + (carro.vx / 0.14) * dt;

    if (comandos.item && carro.item) usarItem(corrida, carro, eventos);
    if (sup.tipo === 'grama' || sup.tipo === 'muro') carro.foraDaPista += dt;
    if (sup.tipo === 'muro') baterNoMuro(corrida, carro, eventos, dt);
    recolocar(corrida, carro, sup, eventos, dt);
    pegarCaixa(corrida, carro, eventos);
    if (corrida.estado === 'correndo') contarVolta(corrida, carro, eventos);
    carro.tempoVolta += dt;
  }

  moverCascos(corrida, eventos, dt);
  conferirBananas(corrida, eventos, dt);
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
    if (distancia > 30) continue;
    const frontal = dx * Math.cos(carro.ang) + dy * Math.sin(carro.ang);
    if (frontal <= 0) continue;
    const avanco = ((outro.indice - carro.indice + n) % n);
    if (avanco > n / 2) continue;
    if (!melhor || distancia < melhor.distancia) {
      melhor = {
        carro: outro, distancia,
        lateral: outro.lateral,
        fechado: Math.abs(outro.lateral - carro.lateral) < KART.largura * 1.4,
      };
    }
  }
  return melhor;
}

function resolverToques(corrida, eventos) {
  const carros = corrida.carros;
  const minimo = KART.largura * 1.1;
  for (let passagem = 0; passagem < 3; passagem++) {
    for (let i = 0; i < carros.length; i++) {
      for (let j = i + 1; j < carros.length; j++) {
        const a = carros[i];
        const b = carros[j];
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
        const projetar = (c) => c.vx * Math.cos(c.ang) + c.vy * -Math.sin(c.ang);
        const troca = (projetar(a) * nx - projetar(b) * nx) * 0.3;
        a.vx -= troca * 0.5;
        b.vx += troca * 0.5;
        a.omega += ny * 0.2 * Math.sign(a.vx || 1);
        b.omega -= ny * 0.2 * Math.sign(b.vx || 1);
        // Um toque e um INCIDENTE, nao um quadro. Dois karts raspando lado a
        // lado ficam sobrepostos por um segundo inteiro, e a versao anterior
        // emitia um evento por quadro: 60 batidas na estatistica e 60 sons de
        // batida por segundo na casca. Com a carencia por par, o segundo
        // encostao do mesmo par so conta depois de 0,3 s.
        const par = i * carros.length + j;
        if (corrida.tempo - (corrida.carenciaDeToque.get(par) ?? -9) < 0.3) continue;
        corrida.carenciaDeToque.set(par, corrida.tempo);
        a.toques++;
        b.toques++;
        corrida.toques++;
        eventos.push({ tipo: 'toque', carros: [a.nome, b.nome], forca: Math.abs(troca) });
      }
    }
  }
  for (let i = 0; i < carros.length; i++) {
    for (let j = i + 1; j < carros.length; j++) {
      corrida.menorDistancia = Math.min(corrida.menorDistancia,
        Math.hypot(carros[i].x - carros[j].x, carros[i].y - carros[j].y));
    }
  }
}

// Bater no muro. A primeira versao grudava: ela reposicionava o kart no limite e
// cortava a velocidade pela metade TODO quadro, entao quem encostava ficava
// preso a 4 km/h com o pe no fundo. Aqui a batida tem carencia e devolve o kart
// para dentro — bater custa caro uma vez, e nao para sempre.
const CARENCIA_DO_MURO = 0.4;

function baterNoMuro(corrida, carro, eventos, dt) {
  const perto = maisProximo(corrida.pista, carro.x, carro.y);
  const limite = perto.largura / 2 + LIMITE_GRAMA - 0.1;
  const sinal = Math.sign(perto.lateral) || 1;
  const c = corrida.pista.centro[perto.i];
  const nx = -Math.sin(c.ang);
  const ny = Math.cos(c.ang);
  carro.x = c.x + nx * limite * sinal;
  carro.y = c.y + ny * limite * sinal;
  // Empurrao para dentro, no rumo da pista: sem ele o kart raspa o muro
  // paralelo e nunca volta.
  const paraDentro = -sinal * 2.2;
  carro.vy += paraDentro * Math.cos(carro.ang - c.ang);
  carro.relogioDoMuro = (carro.relogioDoMuro || 0) - dt;
  if (carro.relogioDoMuro > 0) return;
  carro.relogioDoMuro = CARENCIA_DO_MURO;
  carro.vx *= 0.62;
  carro.omega *= -0.2;
  carro.turbo = 0;
  carro.carga = 0;
  eventos.push({ tipo: 'muro', carro: carro.nome, x: carro.x, y: carro.y });
}

// Kart atolado volta para a pista. Isto nao e conveniencia: sem isto, um kart
// que bate de frente no muro do grampo fica parado a 3 km/h para sempre, porque
// o modelo nao tem marcha a re — foi exatamente o que a medida do grampo achou,
// e era esse acidente, e nao a tecnica, que decidia todo tempo de volta do jogo.
//
// A regra tem de ser cobravel em prova, entao ela e explicita: **em corrida**,
// parado (abaixo de `PARADO_KMH`), fora do asfalto, ou andando na contramao por
// mais de `PACIENCIA` segundos seguidos, o kart reaparece na linha de corrida,
// apontado para frente, a 7 m/s. Nao adianta como atalho porque o progresso e o
// setor nao mudam.
//
// O "em corrida" nao e detalhe: na primeira versao o relogio corria durante a
// contagem, e como todo mundo esta parado na largada, os dez karts eram
// teleportados para a linha de corrida antes da luz verde — o grid inteiro
// embaralhado, e o jogador aparecia na grama sem ter tocado em nada.
const PARADO_KMH = 9;
const PACIENCIA = 2.2;

function recolocar(corrida, carro, sup, eventos, dt) {
  if (corrida.estado !== 'correndo') { carro.atolado = 0; return; }
  const devagar = Math.hypot(carro.vx, carro.vy) * 3.6 < PARADO_KMH;
  const foraDoAsfalto = sup.tipo === 'grama' || sup.tipo === 'muro';
  // Contramao: a velocidade projetada no rumo da pista. Um kart girado por
  // casco sai andando para tras a 30 km/h e nunca mais volta sozinho.
  const c0 = corrida.pista.centro[sup.i];
  const aoLongo = (carro.vx * Math.cos(carro.ang) - carro.vy * Math.sin(carro.ang))
    * Math.cos(c0.ang)
    + (carro.vx * Math.sin(carro.ang) + carro.vy * Math.cos(carro.ang)) * Math.sin(c0.ang);
  const naContramao = aoLongo < -1.5;
  if (devagar || foraDoAsfalto || naContramao) carro.atolado += dt;
  else carro.atolado = 0;
  if (carro.atolado < PACIENCIA) return;

  const c = corrida.pista.centro[sup.i];
  // Lugar livre: dois karts atolados no mesmo ponto sairiam um dentro do outro,
  // e a prova de que karts nao se atravessam pegou exatamente isso (0,00 m de
  // centro a centro). Procura de dentro para fora, e desiste no eixo.
  const base = corrida.linha ? corrida.linha.deslocamentos[sup.i] : 0;
  const teto = c.largura / 2 - KART.largura / 2 - 0.2;
  let desvio = base;
  for (const tentativa of [base, base + 2.2, base - 2.2, base + 4.4, base - 4.4]) {
    const onde = Math.max(-teto, Math.min(teto, tentativa));
    const ponto = paraMundo(corrida.pista, sup.i, onde);
    const livre = corrida.carros.every(outro => outro === carro
      || Math.hypot(outro.x - ponto.x, outro.y - ponto.y) > KART.largura * 1.6);
    if (livre) { desvio = onde; break; }
  }
  const posto = paraMundo(corrida.pista, sup.i, desvio);
  carro.x = posto.x;
  carro.y = posto.y;
  carro.z = posto.z;
  carro.ang = c.ang;
  carro.vx = 7;
  carro.vy = 0;
  carro.omega = 0;
  carro.rodopio = 0;
  carro.turbo = 0;
  carro.carga = 0;
  carro.atolado = 0;
  carro.recolocacoes++;
  eventos.push({ tipo: 'recolocado', carro: carro.nome, x: carro.x, y: carro.y });
}

// ------------------------------------------------------------------ itens

function pegarCaixa(corrida, carro, eventos) {
  if (carro.item) return;
  for (const caixa of corrida.pista.caixas) {
    if (!caixa.cheia) continue;
    if (Math.hypot(caixa.x - carro.x, caixa.y - carro.y) > 1.35) continue;
    caixa.cheia = false;
    caixa.relogio = TEMPO_DE_RECARGA_DA_CAIXA;
    carro.item = sortearItem(corrida, carro);
    eventos.push({ tipo: 'item-pego', carro: carro.nome, item: carro.item });
    return;
  }
}

function sortearItem(corrida, carro) {
  const posicao = Math.max(0, carro.posicao - 1);
  const pesos = TABELA_DE_ITENS.map(t => Math.max(0.2, t.peso(posicao)));
  const total = pesos.reduce((s, p) => s + p, 0);
  let sorte = corrida.sorteio() * total;
  for (const [i, peso] of pesos.entries()) {
    sorte -= peso;
    if (sorte <= 0) return TABELA_DE_ITENS[i].item;
  }
  return TABELA_DE_ITENS[0].item;
}

function usarItem(corrida, carro, eventos) {
  const item = carro.item;
  carro.item = null;
  if (item === 'cogumelo') {
    darTurbo(carro);
    eventos.push({ tipo: 'item-usado', carro: carro.nome, item });
    return;
  }
  if (item === 'banana') {
    const atras = carro.ang + Math.PI;
    corrida.bananas.push({
      x: carro.x + Math.cos(atras) * 2.2,
      y: carro.y + Math.sin(atras) * 2.2,
      z: carro.z,
      vida: 40,
      dono: carro.nome,
    });
    eventos.push({ tipo: 'item-usado', carro: carro.nome, item });
    return;
  }
  // casco: persegue quem esta na frente, em progresso de pista
  const alvo = alvoDoCasco(corrida, carro);
  corrida.cascos.push({
    x: carro.x + Math.cos(carro.ang) * 2,
    y: carro.y + Math.sin(carro.ang) * 2,
    z: carro.z,
    alvo, dono: carro.nome, vida: 6,
  });
  eventos.push({ tipo: 'item-usado', carro: carro.nome, item, alvo: alvo ? alvo.nome : null });
}

function alvoDoCasco(corrida, carro) {
  let melhor = null;
  for (const outro of corrida.carros) {
    if (outro === carro) continue;
    if (outro.progresso <= carro.progresso) continue;
    const diferenca = outro.progresso - carro.progresso;
    if (!melhor || diferenca < melhor.diferenca) melhor = { diferenca, carro: outro };
  }
  if (!melhor) return null;
  const distancia = Math.hypot(melhor.carro.x - carro.x, melhor.carro.y - carro.y);
  return distancia < ALCANCE_DO_CASCO ? melhor.carro : null;
}

function moverCascos(corrida, eventos, dt) {
  for (let i = corrida.cascos.length - 1; i >= 0; i--) {
    const casco = corrida.cascos[i];
    casco.vida -= dt;
    const alvo = casco.alvo;
    if (!alvo || casco.vida <= 0) {
      corrida.cascos.splice(i, 1);
      continue;
    }
    const dx = alvo.x - casco.x;
    const dy = alvo.y - casco.y;
    const d = Math.hypot(dx, dy) || 1;
    const velocidade = 34;
    casco.x += (dx / d) * velocidade * dt;
    casco.y += (dy / d) * velocidade * dt;
    casco.z = alturaDoChao(corrida.pista, casco.x, casco.y);
    if (d < 1.4) {
      rodopiar(alvo);
      eventos.push({ tipo: 'acertou', de: casco.dono, em: alvo.nome, item: 'casco' });
      corrida.cascos.splice(i, 1);
    }
  }
}

function conferirBananas(corrida, eventos, dt) {
  for (let i = corrida.bananas.length - 1; i >= 0; i--) {
    const banana = corrida.bananas[i];
    banana.vida -= dt;
    if (banana.vida <= 0) { corrida.bananas.splice(i, 1); continue; }
    for (const carro of corrida.carros) {
      if (Math.hypot(carro.x - banana.x, carro.y - banana.y) > 1.2) continue;
      rodopiar(carro);
      eventos.push({ tipo: 'acertou', de: banana.dono, em: carro.nome, item: 'banana' });
      corrida.bananas.splice(i, 1);
      break;
    }
  }
}

// --------------------------------------------------------- setor e volta

function contarVolta(corrida, carro, eventos) {
  const n = corrida.pista.centro.length;
  const de = carro.ultimoIndice;
  const para = carro.indice;
  if (de === para) return;
  const avanco = (para - de + n) % n;
  if (avanco > n / 2) {
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
        // Contar a volta e cronometrar a volta sao coisas diferentes, e juntar as
        // duas era um defeito de verdade: quem fosse recolocado uma vez por
        // volta NUNCA registrava volta. Medido: um kart cruzou a linha duas
        // vezes numa corrida de tres voltas e terminou com `voltas=0`, entao a
        // classificacao mentia e a prova da corrida inteira reprovava.
        //
        // Agora a volta conta sempre que os tres setores sairam na ordem; o
        // TEMPO e que exige volta limpa, como em corrida de verdade.
        carro.voltas++;
        if (carro.voltaValida) {
          if (!carro.melhorVolta || carro.tempoVolta < carro.melhorVolta) {
            carro.melhorVolta = carro.tempoVolta;
          }
          if (!corrida.melhorVolta || carro.tempoVolta < corrida.melhorVolta.tempo) {
            corrida.melhorVolta = { tempo: carro.tempoVolta, nome: carro.nome };
          }
          eventos.push({
            tipo: 'volta', carro: carro.nome,
            tempo: carro.tempoVolta, voltas: carro.voltas,
          });
        } else {
          eventos.push({
            tipo: 'volta-invalida', carro: carro.nome, voltas: carro.voltas,
          });
        }
        if (carro.voltas >= corrida.voltas && !carro.terminou) {
          carro.terminou = true;
          eventos.push({ tipo: 'bandeirada', carro: carro.nome });
          if (!corrida.carros.some(c => c.terminou && c !== carro)) {
            terminar(corrida, eventos);
          }
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
    turbos: carro.turbosUsados,
    toques: carro.toques,
    recolocacoes: carro.recolocacoes,
  }));
  eventos.push({ tipo: 'fim', classificacao: corrida.classificacao });
}

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
