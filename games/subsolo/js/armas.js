// As quatro armas e a balistica que elas usam.
//
// Nada aqui toca em DOM. `tracar` e o unico caminho pelo qual um tiro acerta
// qualquer coisa — jogador, inimigo e robo de prova usam a mesma funcao, senao
// a prova de que parede bloqueia tiro nao valeria para o jogo.

import * as M from './mapa.js';

// ruido esta em celulas de caminhada (ver CONFIG.custoPorta em regras.js).
// A picareta faz zero: e a arma que resolve o problema sem chamar o resto da
// fase para assistir.
export const ARMAS = {
  picareta: {
    nome: 'PICARETA', tipo: 'corpo', chave: 1,
    dano: 34, cadencia: 0.52, alcance: 1.35,
    municao: null, gasto: 0, pelotas: 1, espalhamento: 0,
    ruido: 0, clarao: 0, cor: '#cfd2d6',
  },
  pineira: {
    nome: 'PINEIRA', tipo: 'hitscan', chave: 2,
    dano: 9, cadencia: 0.12, alcance: 26,
    municao: 'pinos', gasto: 1, pelotas: 1, espalhamento: 0.014,
    ruido: 9, clarao: 0.5, cor: '#ffd98a',
  },
  espingarda: {
    nome: 'ESPINGARDA', tipo: 'hitscan', chave: 3,
    dano: 7, cadencia: 0.85, alcance: 14,
    municao: 'cartuchos', gasto: 1, pelotas: 9, espalhamento: 0.12,
    ruido: 20, clarao: 1, cor: '#ffe9b0',
  },
  macarico: {
    nome: 'MACARICO', tipo: 'chama', chave: 4,
    dano: 3, cadencia: 0.05, alcance: 3.4,
    municao: 'gas', gasto: 1, pelotas: 1, espalhamento: 0.24,
    ruido: 5, clarao: 0.75, cor: '#ff9a3c',
  },
};

export const ORDEM = ['picareta', 'pineira', 'espingarda', 'macarico'];

// Quanto dano cada unidade de municao vale. E o que permite a `mapa.js` somar
// "dano disponivel numa fase" sem saber como uma arma funciona.
export function danoPorUnidade(municao) {
  for (const arma of Object.values(ARMAS)) {
    if (arma.municao === municao) return (arma.dano * arma.pelotas) / arma.gasto;
  }
  return 0;
}

const RAIO_CORPO = 0.42;

// Marcha de raio por celula (DDA). Devolve o primeiro obstaculo: inimigo vivo
// dentro do raio do corpo, ou a face de parede onde o raio parou.
export function tracar(mapa, origem, dir, alcance, inimigos = [], crachas = null) {
  const parede = paredeNaLinha(mapa, origem, dir, alcance, crachas);
  const limite = parede ? parede.distancia : alcance;

  let melhor = null;
  for (const alvo of inimigos) {
    if (!alvo || alvo.vida <= 0) continue;
    const dx = alvo.x - origem.x;
    const dy = alvo.y - origem.y;
    const t = dx * dir.x + dy * dir.y;
    if (t <= 0 || t > limite) continue;
    const perp = Math.abs(dx * dir.y - dy * dir.x);
    if (perp > RAIO_CORPO) continue;
    if (!melhor || t < melhor.distancia) melhor = { tipo: 'inimigo', alvo, distancia: t };
  }
  if (melhor) return melhor;
  if (parede) return parede;
  return { tipo: 'nada', distancia: alcance };
}

// Onde o raio bate na parede. Usado pelo tiro e, com outro alcance, pelo
// render: e a mesma travessia de grade, so que o render guarda a textura.
export function paredeNaLinha(mapa, origem, dir, alcance, crachas = null) {
  let x = Math.floor(origem.x);
  let y = Math.floor(origem.y);
  const passoX = dir.x > 0 ? 1 : -1;
  const passoY = dir.y > 0 ? 1 : -1;
  const deltaX = dir.x === 0 ? Infinity : Math.abs(1 / dir.x);
  const deltaY = dir.y === 0 ? Infinity : Math.abs(1 / dir.y);
  let proxX = dir.x === 0 ? Infinity
    : (dir.x > 0 ? (x + 1 - origem.x) : (origem.x - x)) * deltaX;
  let proxY = dir.y === 0 ? Infinity
    : (dir.y > 0 ? (y + 1 - origem.y) : (origem.y - y)) * deltaY;

  let distancia = 0;
  let lado = 0;
  while (distancia <= alcance) {
    if (proxX < proxY) {
      distancia = proxX; proxX += deltaX; x += passoX; lado = 0;
    } else {
      distancia = proxY; proxY += deltaY; y += passoY; lado = 1;
    }
    if (distancia > alcance) break;
    if (M.solido(mapa, x, y, crachas)) {
      const bateu = lado === 0
        ? origem.y + dir.y * distancia
        : origem.x + dir.x * distancia;
      return {
        tipo: 'parede', distancia, x, y, lado,
        textura: M.tile(mapa, x, y),
        u: bateu - Math.floor(bateu),
      };
    }
  }
  return null;
}

// Linha de visao entre dois pontos: usada pela percepcao do inimigo e pelo robo.
export function linhaLivre(mapa, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distancia = Math.hypot(dx, dy);
  if (distancia < 1e-6) return true;
  const parede = paredeNaLinha(mapa, a, { x: dx / distancia, y: dy / distancia }, distancia);
  return !parede;
}
