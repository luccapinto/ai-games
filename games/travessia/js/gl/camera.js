// Camera de terceira pessoa: fica atras do jogador, sobe o olhar quando o
// chao sobe, nao entra na serra e nao treme com o jogador parado.
//
// O que evita o tremor e a ordem das contas: o alvo e suavizado com um filtro
// exponencial dependente de dt, e o olho sai do alvo suavizado por conta
// geometrica — nunca o contrario. Suavizar o olho depois de resolver colisao
// era o que fazia a camera vibrar encostada num paredao.

import { criarMat4, olhar, perspectiva, multiplicar, inverter } from './matriz.js';

const CIMA = [0, 1, 0];
const ALTURA_DO_OMBRO = 1.35;
const LIMITE_DE_INCLINACAO = [-1.15, 0.45];

// `obstaculos` sao cilindros do que o olho nao pode atravessar: casa e
// cruzeiro. Barranco ja e resolvido pelo campo de altura.
export function criarCamera(campo, obstaculos = []) {
  const estado = {
    giro: Math.PI * 0.5,
    inclinacao: -0.16,
    distancia: 5.6,
    distanciaSuave: 5.6,
    alvo: new Float32Array(3),
    olho: new Float32Array(3),
    frente: new Float32Array(3),
    vp: criarMat4(),
    invVP: criarMat4(),
    projecao: criarMat4(),
    visao: criarMat4(),
    subiuPorCasa: 0,
    iniciado: false,
  };

  function mirar(dx, dy) {
    estado.giro += dx;
    estado.inclinacao = Math.min(LIMITE_DE_INCLINACAO[1],
      Math.max(LIMITE_DE_INCLINACAO[0], estado.inclinacao + dy));
  }

  function aproximar(passo) {
    estado.distancia = Math.min(11, Math.max(2.6, estado.distancia + passo));
  }

  // Cilindro por casa. Sao poucas dezenas e so importam as que estao perto,
  // entao a conta bruta cabe folgada num quadro.
  function dentroDeCasa(px, py, pz) {
    for (const o of obstaculos) {
      if (py > o.alto) continue;
      const dx = px - o.x;
      const dz = pz - o.z;
      if (dx * dx + dz * dz < o.raio * o.raio) return true;
    }
    return false;
  }

  // Perto de casa a camera sobe mesmo sem a vara bater nela: telhado tem beira
  // larga e entra no campo de visao pela lateral. Em vila apertada, meia tela
  // de telha vermelha era o que a captura mostrava.
  function casaPorPerto() {
    for (const o of obstaculos) {
      if (!o.sobe) continue;
      const dx = estado.alvo[0] - o.x;
      const dz = estado.alvo[2] - o.z;
      if (dx * dx + dz * dz < 49) return true;
    }
    return false;
  }

  function seguir(jogador, dt, largura, altura) {
    const alvoX = jogador.x;
    const alvoZ = jogador.y;
    const alvoY = campo.em(jogador.x, jogador.y) + ALTURA_DO_OMBRO;

    if (!estado.iniciado) {
      estado.alvo[0] = alvoX;
      estado.alvo[1] = alvoY;
      estado.alvo[2] = alvoZ;
      estado.giro = jogador.ang + Math.PI;
      estado.iniciado = true;
    } else {
      // filtro exponencial: mesma resposta em 30 e em 144 quadros por segundo
      const k = 1 - Math.exp(-14 * dt);
      const kv = 1 - Math.exp(-7 * dt);
      estado.alvo[0] += (alvoX - estado.alvo[0]) * k;
      estado.alvo[2] += (alvoZ - estado.alvo[2]) * k;
      estado.alvo[1] += (alvoY - estado.alvo[1]) * kv;
    }

    // Sobe o olhar quando o chao a frente sobe: sem isto, subindo serra a
    // camera fica olhando para o barranco em vez da crista.
    const frenteX = Math.cos(estado.giro);
    const frenteZ = Math.sin(estado.giro);
    const adiante = campo.em(alvoX + frenteX * 9, alvoZ + frenteZ * 9);
    const subida = Math.min(0.28, Math.max(-0.14,
      (adiante - (alvoY - ALTURA_DO_OMBRO)) * 0.016));
    const inclinacao = Math.min(LIMITE_DE_INCLINACAO[1],
      Math.max(LIMITE_DE_INCLINACAO[0], estado.inclinacao + subida));

    const cosI = Math.cos(inclinacao);
    let dirX = cosI * frenteX;
    let dirY = Math.sin(inclinacao);
    let dirZ = cosI * frenteZ;
    estado.frente[0] = dirX;
    estado.frente[1] = dirY;
    estado.frente[2] = dirZ;

    // Encurta a vara ate parar de atravessar coisa, e — se quem atrapalha for
    // casa — sobe o olho por cima do telhado em vez de so colar no jogador.
    // Sem isso, nascer numa vila apertada enchia meia tela de telha vermelha.
    const varar = (dx, dy, dz) => {
      for (let i = 1; i <= 12; i++) {
        const t = (i / 12) * estado.distancia;
        const px = estado.alvo[0] - dx * t;
        const py = estado.alvo[1] - dy * t;
        const pz = estado.alvo[2] - dz * t;
        if (dentroDeCasa(px, py, pz)) {
          return { distancia: Math.max(2.4, t - estado.distancia / 12), casa: true };
        }
        if (py < campo.em(px, pz) + 0.85) {
          return { distancia: Math.max(1.6, t - estado.distancia / 12), casa: false };
        }
      }
      return { distancia: estado.distancia, casa: false };
    };

    let tentativa = varar(dirX, dirY, dirZ);
    const alvoDeSubida = tentativa.casa || casaPorPerto() ? 0.44 : 0;
    estado.subiuPorCasa += (alvoDeSubida - estado.subiuPorCasa) * (1 - Math.exp(-5 * dt));
    if (estado.subiuPorCasa > 0.01) {
      const i2 = Math.max(LIMITE_DE_INCLINACAO[0], inclinacao - estado.subiuPorCasa);
      const c2 = Math.cos(i2);
      dirX = c2 * frenteX;
      dirY = Math.sin(i2);
      dirZ = c2 * frenteZ;
      estado.frente[0] = dirX;
      estado.frente[1] = dirY;
      estado.frente[2] = dirZ;
      tentativa = varar(dirX, dirY, dirZ);
    }
    const distancia = tentativa.distancia;

    // aproximar e instantaneo (nao atravessa parede), afastar e suave
    estado.distanciaSuave = distancia < estado.distanciaSuave
      ? distancia
      : estado.distanciaSuave + (distancia - estado.distanciaSuave) * (1 - Math.exp(-6 * dt));

    estado.olho[0] = estado.alvo[0] - dirX * estado.distanciaSuave;
    estado.olho[1] = estado.alvo[1] - dirY * estado.distanciaSuave;
    estado.olho[2] = estado.alvo[2] - dirZ * estado.distanciaSuave;
    const piso = campo.em(estado.olho[0], estado.olho[2]) + 0.75;
    if (estado.olho[1] < piso) estado.olho[1] = piso;

    perspectiva(estado.projecao, 1.02, largura / Math.max(1, altura), 0.22, 620);
    olhar(estado.visao, estado.olho, estado.alvo, CIMA);
    multiplicar(estado.vp, estado.projecao, estado.visao);
    inverter(estado.invVP, estado.vp);
  }

  return { estado, mirar, aproximar, seguir };
}

// Seis planos do tronco de visao, tirados da matriz combinada. Cada plano e
// (a,b,c,d) com a normal apontando para dentro.
export function extrairPlanos(vp, saida) {
  const linha = (i) => [vp[i], vp[4 + i], vp[8 + i], vp[12 + i]];
  const [x0, x1, x2, x3] = linha(0);
  const [y0, y1, y2, y3] = linha(1);
  const [z0, z1, z2, z3] = linha(2);
  const [w0, w1, w2, w3] = linha(3);
  const planos = [
    [w0 + x0, w1 + x1, w2 + x2, w3 + x3],
    [w0 - x0, w1 - x1, w2 - x2, w3 - x3],
    [w0 + y0, w1 + y1, w2 + y2, w3 + y3],
    [w0 - y0, w1 - y1, w2 - y2, w3 - y3],
    [w0 + z0, w1 + z1, w2 + z2, w3 + z3],
    [w0 - z0, w1 - z1, w2 - z2, w3 - z3],
  ];
  for (let i = 0; i < 6; i++) {
    const p = planos[i];
    const n = Math.hypot(p[0], p[1], p[2]) || 1;
    saida[i * 4] = p[0] / n;
    saida[i * 4 + 1] = p[1] / n;
    saida[i * 4 + 2] = p[2] / n;
    saida[i * 4 + 3] = p[3] / n;
  }
  return saida;
}

export function esferaVisivel(planos, x, y, z, raio) {
  for (let i = 0; i < 6; i++) {
    const d = planos[i * 4] * x + planos[i * 4 + 1] * y + planos[i * 4 + 2] * z
      + planos[i * 4 + 3];
    if (d < -raio) return false;
  }
  return true;
}
