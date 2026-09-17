// A linha de corrida, e como ela e escolhida.
//
// Nao e curvatura minima nem caminho minimo — as duas dao linha errada, e dao
// errado em direcoes opostas. Caminho minimo cola na borda de dentro e mata a
// velocidade de curva; curvatura minima abre o raio de uma curva constante e
// anda mais metro do que precisa. O que esta escrito aqui minimiza a coisa que
// interessa: **o tempo de volta do perfil de velocidade**, o mesmo perfil que a
// IA consulta para saber onde frear.
//
// O algoritmo e descida coordenada com empurrao em forma de morro: para cada
// ponto, empurra a vizinhanca inteira para um lado e para o outro, refaz o
// perfil de velocidade da volta e fica com o que baixou o tempo. O morro nao e
// enfeite — empurrar um ponto sozinho sempre piora a curvatura local, e a
// primeira versao deste otimizador terminou com deslocamento maximo de 0,000 m
// por causa disso.
//
// provas.mjs cobra o que o objetivo promete: a linha fica dentro da pista e a
// volta estimada dela e mais rapida que a volta estimada pelo eixo.

import { CARRO } from './fisica.js';

const VELOCIDADE_MAXIMA = 82;
const MARGEM_FRENAGEM = 0.94;
const PISO_DE_VELOCIDADE = 8;
// Reserva de curva: o perfil pede 92% do atrito util, e nao 100%. Sem reserva o
// carro entra no grampo exatamente no limite do que ele sustenta, e qualquer
// irregularidade escorrega — a IA perdia a traseira no terceiro grampo da SERRA
// e chegava a 20 m/s onde a linha pedia 34.
const RESERVA_DE_CURVA = 0.92;
// O empurrao tem varias larguras, e isto e o coracao do otimizador: uma curva
// de cem metros so melhora se ela se mover inteira. Com morro de dezoito metros
// — a primeira versao — nenhuma tentativa melhorava o tempo e a linha ficava
// identica ao eixo, com deslocamento maximo de 0,000 m.
const ESCALAS = [48, 24, 12, 6, 3];
const AMPLITUDES = [2.5, 1.2, 0.5];
const VARREDURAS = 2;

const cache = new Map();

export function linhaIdeal(pista, opcoes = {}) {
  // O otimizador roda uma vez por pista e o resultado nao muda: sem cache,
  // provas.mjs pagaria a conta seis vezes por prova.
  const chave = `${pista.nome}|${opcoes.otimizar === false ? 'eixo' : 'ideal'}`;
  if (!opcoes.semCache && cache.has(chave)) return cache.get(chave);

  const n = pista.centro.length;
  const margem = opcoes.margem ?? CARRO.largura / 2 + 0.35;
  const atrito = CARRO.atritoUtil * 9.81;
  const limites = new Float32Array(n);
  const nx = new Float32Array(n);
  const ny = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const c = pista.centro[i];
    limites[i] = Math.max(0.3, c.largura / 2 - margem);
    nx[i] = -Math.sin(c.ang);
    ny[i] = Math.cos(c.ang);
  }

  const d = new Float32Array(n);
  const px = new Float32Array(n);
  const py = new Float32Array(n);
  const curvaturas = new Float32Array(n);
  const ds = new Float32Array(n);
  const velocidades = new Float32Array(n);

  const mod = (i) => ((i % n) + n) % n;
  const escrever = (i) => {
    const c = pista.centro[i];
    px[i] = c.x + nx[i] * d[i];
    py[i] = c.y + ny[i] * d[i];
  };
  for (let i = 0; i < n; i++) escrever(i);

  // Curvatura de Menger, com sinal: positiva quando a trajetoria vira para a
  // esquerda. O sinal e o que permite a IA usar a curvatura como comando de
  // volante direto (pre-alimentacao), e nao so como limite de velocidade.
  const curvaturaEm = (i) => {
    const a = mod(i - 1);
    const b = i;
    const c = mod(i + 1);
    const ab = Math.hypot(px[b] - px[a], py[b] - py[a]);
    const bc = Math.hypot(px[c] - px[b], py[c] - py[b]);
    const ca = Math.hypot(px[a] - px[c], py[a] - py[c]);
    const cruz = (px[b] - px[a]) * (py[c] - py[b]) - (py[b] - py[a]) * (px[c] - px[b]);
    const area = Math.abs(cruz) / 2;
    if (ab * bc * ca < 1e-9) return 0;
    return (Math.sign(cruz) * 4 * area) / (ab * bc * ca);
  };

  // Perfil de velocidade da volta inteira, em tres varreduras de ida e volta:
  // limite de curva pelo atrito, limite de frenagem indo de tras para frente,
  // limite de aceleracao indo para frente. Devolve o tempo de volta.
  const perfil = () => {
    for (let i = 0; i < n; i++) {
      curvaturas[i] = curvaturaEm(i);
      const j = mod(i + 1);
      ds[i] = Math.hypot(px[j] - px[i], py[j] - py[i]);
    }
    for (let i = 0; i < n; i++) {
      const k = Math.abs(curvaturas[i]);
      velocidades[i] = k < 1e-6
        ? VELOCIDADE_MAXIMA
        : Math.min(VELOCIDADE_MAXIMA, Math.sqrt((atrito * RESERVA_DE_CURVA) / k));
    }
    for (let volta = 0; volta < 3; volta++) {
      for (let i = n - 1; i >= 0; i--) {
        const prox = mod(i + 1);
        const limite = Math.sqrt(velocidades[prox] ** 2 + 2 * atrito * MARGEM_FRENAGEM * ds[i]);
        if (velocidades[i] > limite) velocidades[i] = limite;
      }
      for (let i = 0; i < n; i++) {
        const ant = mod(i - 1);
        const v = Math.max(6, velocidades[ant]);
        const forca = Math.min(CARRO.forcaTracaoMax, CARRO.potencia / v);
        const aceleracao = Math.min(atrito * 0.6, forca / CARRO.massa);
        const limite = Math.sqrt(velocidades[ant] ** 2 + 2 * aceleracao * ds[ant]);
        if (velocidades[i] > limite) velocidades[i] = limite;
      }
    }
    let tempo = 0;
    for (let i = 0; i < n; i++) {
      velocidades[i] = Math.max(PISO_DE_VELOCIDADE, velocidades[i]);
      tempo += ds[i] / velocidades[i];
    }
    return tempo;
  };

  // Morro de cosseno com a meia-largura pedida: 1 no centro, 0 nas pontas.
  const morros = new Map();
  const morroDe = (meia) => {
    if (!morros.has(meia)) {
      const peso = new Float32Array(meia * 2 + 1);
      for (let k = -meia; k <= meia; k++) {
        peso[k + meia] = 0.5 * (1 + Math.cos((Math.PI * k) / (meia + 1)));
      }
      morros.set(meia, peso);
    }
    return morros.get(meia);
  };

  const aplicar = (centro, meia, delta) => {
    const peso = morroDe(meia);
    for (let k = -meia; k <= meia; k++) {
      const i = mod(centro + k);
      d[i] = Math.max(-limites[i],
        Math.min(limites[i], d[i] + delta * peso[k + meia]));
      escrever(i);
    }
  };
  const guardar = (centro, meia) => {
    const copia = new Float32Array(meia * 2 + 1);
    for (let k = -meia; k <= meia; k++) copia[k + meia] = d[mod(centro + k)];
    return copia;
  };
  const restaurar = (centro, meia, copia) => {
    for (let k = -meia; k <= meia; k++) {
      const i = mod(centro + k);
      d[i] = copia[k + meia];
      escrever(i);
    }
  };

  let tempo = perfil();
  if (opcoes.otimizar !== false) {
    for (const meia of ESCALAS) {
      const salto = Math.max(1, Math.round(meia / 2));
      for (const amplitude of AMPLITUDES) {
        for (let varredura = 0; varredura < VARREDURAS; varredura++) {
          for (let centro = 0; centro < n; centro += salto) {
            const copia = guardar(centro, meia);
            aplicar(centro, meia, amplitude);
            const mais = perfil();
            restaurar(centro, meia, copia);
            aplicar(centro, meia, -amplitude);
            const menos = perfil();
            restaurar(centro, meia, copia);
            if (mais < tempo - 1e-6 && mais <= menos) {
              aplicar(centro, meia, amplitude);
              tempo = mais;
            } else if (menos < tempo - 1e-6) {
              aplicar(centro, meia, -amplitude);
              tempo = menos;
            } else {
              perfil();
            }
          }
        }
      }
    }
    tempo = perfil();
  }

  const pontos = [];
  let somaCurvatura = 0;
  for (let i = 0; i < n; i++) {
    pontos.push({ x: px[i], y: py[i] });
    somaCurvatura += curvaturas[i];
  }

  const resultado = {
    deslocamentos: d,
    pontos,
    curvaturas,
    velocidades,
    ds,
    tempoEstimado: tempo,
    curvaturaMedia: somaCurvatura / n,
  };
  if (!opcoes.semCache) cache.set(chave, resultado);
  return resultado;
}
