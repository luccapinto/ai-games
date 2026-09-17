// O robo que atravessa o sertao — a prova principal do TRAVESSIA.
//
// Ele usa `criarJogo`/`passo`, a mesma caminhada, a mesma sede, o mesmo combate
// e as mesmas missoes do navegador. O que ele tem e o mapa: pede rota a
// `mundo.caminho` e sabe onde esta a agua mais proxima.
//
// Se ele nao termina a linha principal vivo, o mundo daquela semente nao e
// jogavel — e isso nao aparece jogando uma semente boa.

import { caminho, aguaMaisProxima } from './mundo.js';
import { MISSOES } from './missoes.js';
import { criarJogo, passo, entradaNula, ARMAS, CONFIG, DT } from './jogo.js';

const PRINCIPAIS = MISSOES.filter(m => m.principal);
const LIMITE_MINUTOS = 40;

export function robo(semente, opcoes = {}) {
  const jogo = criarJogo(semente, opcoes);
  const limite = Math.round((opcoes.limite || LIMITE_MINUTOS * 60) / DT);
  const j = jogo.jogador;

  let rota = null;
  let alvoChave = null;
  let lutas = 0;
  let travado = { x: j.x, y: j.y, t: 0 };
  let cutucao = 0;

  for (let quadro = 0; quadro < limite && !jogo.fim; quadro++) {
    const entrada = entradaNula();
    const objetivo = escolherObjetivo(jogo);
    if (!objetivo) break;

    const chave = `${objetivo.tipo}:${Math.floor(objetivo.x)},${Math.floor(objetivo.y)}`;
    if (!rota || chave !== alvoChave || quadro % 180 === 0) {
      alvoChave = chave;
      rota = caminho(jogo.mundo, j, objetivo);
    }

    // --- ordem de prioridade ------------------------------------------
    // Sede critica vem antes de briga. A primeira versao resolvia briga
    // primeiro, e como o cangaceiro reaparece perto do alvo da missao, o robo
    // lutava sem parar e morria de sede com quatro abates e zero goles.
    const bicho = bichoMaisProximo(jogo);
    const arma = ARMAS[j.arma] || ARMAS.maos;
    const sedeCritica = j.sede < j.sedeMaxima * 0.22;
    if (!sedeCritica && bicho && bicho.d < 11) {
      lutas++;
      const dx = bicho.alvo.x - j.x;
      const dy = bicho.alvo.y - j.y;
      const d = bicho.d || 1;
      if (bicho.d > arma.alcance * 0.8) {
        entrada.x = dx / d;
        entrada.y = dy / d;
        entrada.correr = bicho.d > 4;
      }
      entrada.atacar = true;
    } else {
      // --- sede: a urgencia vem da distancia, nao de uma fracao fixa ---
      // Beber a 45% do cantil parece prudente e nao e: se a agua mais perto
      // esta a cento e vinte celulas, 45% nao chega la. O mundo ja carrega o
      // campo de distancia da agua, e e ele que diz quando virar.
      const celula = Math.floor(j.y) * jogo.mundo.largura + Math.floor(j.x);
      const longeDaAgua = jogo.mundo.distanciaDaAgua[celula];
      const taxa = 1.15;
      const segundosDeCantil = j.sede / taxa;
      const segundosAteAgua = (longeDaAgua / CONFIG.velocidade) * 1.35 + 6;
      if (segundosDeCantil < segundosAteAgua || j.sede < j.sedeMaxima * 0.3) {
        const agua = aguaMaisProxima(jogo.mundo, j.x, j.y);
        if (agua) {
          const rotaAgua = caminho(jogo.mundo, j, { x: agua.x, y: agua.y });
          const proximo = proximoNo(rotaAgua, j);
          if (proximo) {
            const dx = proximo.x - j.x;
            const dy = proximo.y - j.y;
            const d = Math.hypot(dx, dy) || 1;
            entrada.x = dx / d;
            entrada.y = dy / d;
            entrada.correr = j.sede > j.sedeMaxima * 0.2;
          }
          if (Math.hypot(agua.x + 0.5 - j.x, agua.y + 0.5 - j.y) <= CONFIG.alcanceBebida) {
            entrada.beber = true;
          }
          passar(jogo, entrada);
          continue;
        }
      }

      // Encher antes da perna longa. Sem isto o robo saia da vila com 70% de
      // cantil, andava oitenta celulas serra adentro e morria na volta — nao
      // por falta de agua no mundo, por falta de plano.
      const distanciaDoObjetivo = Math.hypot(objetivo.x - j.x, objetivo.y - j.y);
      if (distanciaDoObjetivo > 55 && j.sede < j.sedeMaxima * 0.92) {
        const agua = aguaMaisProxima(jogo.mundo, j.x, j.y);
        if (agua && Math.hypot(agua.x - j.x, agua.y - j.y) < 26) {
          const rotaAgua = caminho(jogo.mundo, j, { x: agua.x, y: agua.y });
          const proximoAgua = proximoNo(rotaAgua, j);
          if (proximoAgua) {
            const dx = proximoAgua.x - j.x;
            const dy = proximoAgua.y - j.y;
            const d = Math.hypot(dx, dy) || 1;
            entrada.x = dx / d;
            entrada.y = dy / d;
          }
          if (Math.hypot(agua.x + 0.5 - j.x, agua.y + 0.5 - j.y) <= CONFIG.alcanceBebida) {
            entrada.beber = true;
          }
          passar(jogo, entrada);
          continue;
        }
      }

      // Passando por agua com o cantil pela metade, enche: e de graca.
      if (j.sede < j.sedeMaxima * 0.9) {
        const agua = aguaMaisProxima(jogo.mundo, j.x, j.y);
        if (agua && Math.hypot(agua.x + 0.5 - j.x, agua.y + 0.5 - j.y) <= CONFIG.alcanceBebida) {
          entrada.beber = true;
        }
      }

      const proximo = proximoNo(rota, j);
      if (proximo) {
        const dx = proximo.x - j.x;
        const dy = proximo.y - j.y;
        const d = Math.hypot(dx, dy) || 1;
        entrada.x = dx / d;
        entrada.y = dy / d;
        // Correr custa mais que o dobro de agua: so quando ha folga.
        entrada.correr = j.sede > j.sedeMaxima * 0.6;
      }
      const dAlvo = Math.hypot(objetivo.x - j.x, objetivo.y - j.y);
      if (dAlvo < CONFIG.alcanceFala * 0.9) entrada.interagir = true;
    }

    if (cutucao > 0) {
      cutucao -= DT;
      entrada.x = Math.cos(quadro * 0.31);
      entrada.y = Math.sin(quadro * 0.31);
    }
    travado.t += DT;
    if (travado.t > 2.5) {
      if (Math.hypot(j.x - travado.x, j.y - travado.y) < 1.2) {
        cutucao = 0.6;
        rota = null;
      }
      travado = { x: j.x, y: j.y, t: 0 };
    }

    passar(jogo, entrada);
  }

  const concluidas = PRINCIPAIS.filter(m => jogo.missoes[m.id].estado === 'concluida').length;
  return {
    semente,
    terminou: jogo.fim === 'venceu',
    motivo: jogo.fim || `estourou ${LIMITE_MINUTOS} min`,
    concluidas,
    minutos: jogo.tempo / 60,
    vidaFinal: Math.max(0, jogo.jogador.vida),
    sedeFinal: jogo.jogador.sede,
    bebeu: jogo.bebeu,
    lutas: jogo.abatidos,
    moedas: jogo.jogador.moedas,
    andou: Math.round(jogo.jogador.andou),
  };
}

function passar(jogo, entrada) {
  passo(jogo, entrada, DT);
}

// O objetivo segue a linha principal na ordem do grafo: pegar a missao com quem
// a da, e depois ir onde ela manda.
function escolherObjetivo(jogo) {
  for (const missao of PRINCIPAIS) {
    const estado = jogo.missoes[missao.id];
    if (estado.estado === 'concluida') continue;
    if (estado.estado === 'fechada') continue;
    if (estado.estado === 'disponivel') {
      return { tipo: 'dador', x: estado.dador.x, y: estado.dador.y };
    }
    // aceita: o alvo depende do tipo
    if (missao.tipo === 'coletar') {
      const alvo = recursoMaisProximo(jogo, missao.item);
      if (alvo) return { tipo: 'coleta', x: alvo.x, y: alvo.y };
      return { tipo: 'dador', x: estado.dador.x, y: estado.dador.y };
    }
    return { tipo: missao.tipo, x: estado.alvo.x, y: estado.alvo.y };
  }
  return null;
}

function recursoMaisProximo(jogo, tipo) {
  const j = jogo.jogador;
  let melhor = null;
  for (const r of jogo.mundo.recursos) {
    if (r.pego || r.tipo !== tipo) continue;
    const d = Math.hypot(r.x - j.x, r.y - j.y);
    if (!melhor || d < melhor.d) melhor = { d, x: r.x, y: r.y };
  }
  return melhor;
}

function bichoMaisProximo(jogo) {
  const j = jogo.jogador;
  let melhor = null;
  for (const bicho of jogo.inimigos) {
    if (bicho.vida <= 0) continue;
    const d = Math.hypot(bicho.x - j.x, bicho.y - j.y);
    if (!melhor || d < melhor.d) melhor = { alvo: bicho, d };
  }
  return melhor;
}

function proximoNo(rota, j) {
  if (!rota || !rota.length) return null;
  let indice = 0;
  let menor = Infinity;
  for (const [i, no] of rota.entries()) {
    const d = Math.hypot(no.x + 0.5 - j.x, no.y + 0.5 - j.y);
    if (d < menor) { menor = d; indice = i; }
  }
  const alvo = rota[Math.min(indice + 2, rota.length - 1)];
  return { x: alvo.x + 0.5, y: alvo.y + 0.5 };
}
