// Os zumbis: como nascem, como entram e como perseguem.
//
// Nenhuma linha aqui toca em DOM, e nenhuma decide sozinha quando a rodada
// acaba — isso e de `jogo.js`. Aqui mora o bicho.
//
// A maquina de estados e curta de proposito, porque cada estado e uma coisa que
// o jogador precisa poder LER na tela e planejar contra:
//
//   esperando    do lado de fora da janela, na fila
//   arrancando   tirando tabua, uma a uma — e o aviso sonoro de que vem gente
//   entrando     subindo a janela; nesse meio segundo ele nao anda nem morde
//   cacando      andando pelo campo de fluxo, atras do jogador
//   mordendo     em alcance, mordendo no intervalo
//   morto        deixa de existir para o tiro
//
// O que NAO existe aqui, e e decisao: zumbi nao desiste, nao procura cobertura
// e nao atira. A pressao do jogo vem do numero e da velocidade, e o jogador
// vence com mapa e municao — se o bicho tambem fosse esperto, o jogo viraria
// outro genero.

import { CONFIG } from './regras.js';
import { TIPOS, velocidadeDoTipo, vidaDoTipo } from './rodadas.js';
import {
  passoDoFluxo, distanciaDoFluxo, mover, solidoParaTiro,
} from './mapa.js';

export const ALTURA_DO_ZUMBI = 1.8;
export const ALTURA_DO_RASTEJANTE = 0.72;
export const ALTURA_DO_CHEFE = 2.25;

let proximoId = 1;

export function criarZumbi(tipo, rodada, janela, sorteio = Math.random) {
  const base = TIPOS[tipo];
  const vida = vidaDoTipo(tipo, rodada);
  return {
    id: proximoId++,
    tipo,
    vida,
    vidaMaxima: vida,
    x: janela.fora.x + 0.5,
    y: janela.fora.y + 0.5,
    ang: 0,
    velocidade: velocidadeDoTipo(tipo, rodada),
    dano: CONFIG.danoDoZumbi * base.dano,
    blindagem: base.blindagem || 0,
    raio: CONFIG.raioDoZumbi * (tipo === 'chefe' ? 1.5 : 1),
    altura: tipo === 'rastejante' ? ALTURA_DO_RASTEJANTE
      : tipo === 'chefe' ? ALTURA_DO_CHEFE : ALTURA_DO_ZUMBI,
    janela,
    estado: 'esperando',
    relogio: 0,
    relogioMordida: 0,
    // Fase de caminhada, para o render animar os membros sem precisar de
    // esqueleto: e a mesma fase que o som de passo usaria.
    // Fase do passo e tempo de rosnado saem do sorteio DO JOGO quando ele e
    // passado: a mesma semente tem de dar a mesma partida, senao a prova do robo
    // nao vale nada — e nao valia, uma prova do jogo tardio reprovava uma vez a
    // cada tres execucoes.
    passo: sorteio() * Math.PI * 2,
    // Dano por regiao, para o render mostrar o estrago e para a transicao para
    // rastejante ter causa: levar muito dano nas pernas derruba.
    danoNasPernas: 0,
    rosnadoEm: 0,
  };
}

// Um passo de um zumbi. Devolve eventos, porque quem toca som e quem conta
// ponto e o orquestrador, nao o bicho.
export function passoDoZumbi(z, ctx, dt) {
  const eventos = [];
  z.relogio += dt;
  z.relogioMordida = Math.max(0, z.relogioMordida - dt);
  z.rosnadoEm = Math.max(0, z.rosnadoEm - dt);

  switch (z.estado) {
    case 'esperando': {
      const janela = z.janela;
      // Fila na janela: so um arranca tabua por vez. Sem fila, seis zumbis
      // arrancam seis tabuas em dois segundos e a barricada deixa de ser
      // defesa.
      if (!janela.ocupadaPor || janela.ocupadaPor === z.id) {
        janela.ocupadaPor = z.id;
        z.estado = janela.tabuas > 0 ? 'arrancando' : 'entrando';
        z.relogio = 0;
        // Quem arranca tabua fica DENTRO DO VAO da janela, e nao na rocha do
        // lado de fora. Isto nao e enfeite: a celula de fora e solida para bala,
        // entao o zumbi que rasgava a sua barricada era inalvejavel — o jogador
        // via o braco entre as tabuas e nao tinha o que fazer. A janela e o
        // unico buraco por onde o tiro passa, e e nele que ele tem de estar.
        z.x = janela.x + 0.5;
        z.y = janela.y + 0.5;
      }
      break;
    }
    case 'arrancando': {
      const janela = z.janela;
      if (janela.tabuas <= 0) {
        z.estado = 'entrando';
        z.relogio = 0;
        break;
      }
      if (z.relogio >= CONFIG.tempoParaArrancarTabua) {
        z.relogio = 0;
        janela.tabuas -= 1;
        eventos.push({ tipo: 'tabua-arrancada', janela, zumbi: z });
        if (janela.tabuas <= 0) {
          z.estado = 'entrando';
        }
      }
      break;
    }
    case 'entrando': {
      // Meio segundo subindo: a janela devolve o corpo para dentro, e nesse
      // intervalo ele nao morde. E a janela de tiro gratis que o jogador ganha
      // por estar de frente para a janela.
      const t = Math.min(1, z.relogio / 0.6);
      z.x = z.janela.x + 0.5 + (z.janela.dentro.x - z.janela.x) * t;
      z.y = z.janela.y + 0.5 + (z.janela.dentro.y - z.janela.y) * t;
      if (t >= 1) {
        z.estado = 'cacando';
        if (z.janela.ocupadaPor === z.id) z.janela.ocupadaPor = null;
        eventos.push({ tipo: 'entrou', zumbi: z });
      }
      break;
    }
    case 'cacando':
    case 'mordendo': {
      const jogador = ctx.jogador;
      const dx = jogador.x - z.x;
      const dy = jogador.y - z.y;
      const distancia = Math.hypot(dx, dy);
      const vendo = distancia < 1.6
        || !solidoParaTiro(ctx.mapa, z.x + dx * 0.5, z.y + dy * 0.5);

      if (distancia <= CONFIG.alcanceDaMordida + z.raio && vendo) {
        z.estado = 'mordendo';
        z.ang = Math.atan2(dy, dx);
        if (z.relogioMordida <= 0) {
          z.relogioMordida = CONFIG.intervaloDaMordida;
          eventos.push({ tipo: 'mordida', zumbi: z, dano: z.dano });
        }
        break;
      }

      z.estado = 'cacando';
      // Para onde andar: campo de fluxo quando ele alcanca, reta quando nao —
      // e o "quando nao" acontece logo depois de entrar pela janela, antes do
      // proximo refazimento do campo.
      const passo = passoDoFluxo(ctx.mapa, ctx.fluxo, z.x, z.y);
      let alvoX;
      let alvoY;
      if (passo && distanciaDoFluxo(ctx.mapa, ctx.fluxo, z.x, z.y) > 1) {
        alvoX = passo.x;
        alvoY = passo.y;
      } else {
        alvoX = jogador.x;
        alvoY = jogador.y;
      }
      const ax = alvoX - z.x;
      const ay = alvoY - z.y;
      const d = Math.hypot(ax, ay) || 1;
      z.ang = Math.atan2(ay, ax);
      const v = z.velocidade * dt;
      mover(ctx.mapa, z, (ax / d) * v, (ay / d) * v, z.raio);
      z.passo += v * 3.4;
      if (z.rosnadoEm <= 0 && distancia < 12) {
        z.rosnadoEm = 2.5 + (ctx.sorteio ? ctx.sorteio() : Math.random()) * 3;
        eventos.push({ tipo: 'rosnado', zumbi: z, distancia });
      }
      break;
    }
    default:
      break;
  }
  return eventos;
}

// Dano num zumbi, com blindagem do chefe e transicao para rastejante. Devolve o
// que aconteceu, porque ponto por acerto e ponto por morte sao diferentes.
export function ferir(z, dano, naCabeca, ondeNaAltura = 1) {
  if (z.estado === 'morto') return { morreu: false, aplicado: 0 };
  // A blindagem do capataz corta dano de corpo e nao corta dano de cabeca: e o
  // que faz rajada no peito nao resolver e mira resolver.
  const corte = naCabeca ? 0 : z.blindagem;
  const aplicado = dano * (1 - corte);
  z.vida -= aplicado;
  if (!naCabeca && ondeNaAltura < 0.42) z.danoNasPernas += aplicado;

  // Perder as pernas vira rastejante em vez de morrer: a mesma quantidade de
  // chumbo, dois resultados diferentes conforme onde acertou.
  if (z.vida > 0 && z.tipo === 'comum' && z.danoNasPernas > z.vidaMaxima * 0.55) {
    virarRastejante(z);
    return { morreu: false, aplicado, virou: true };
  }
  if (z.vida <= 0) {
    z.vida = 0;
    z.estado = 'morto';
    if (z.janela && z.janela.ocupadaPor === z.id) z.janela.ocupadaPor = null;
    return { morreu: true, aplicado, naCabeca };
  }
  return { morreu: false, aplicado, naCabeca };
}

export function virarRastejante(z) {
  z.tipo = 'rastejante';
  z.altura = ALTURA_DO_RASTEJANTE;
  z.velocidade *= TIPOS.rastejante.velocidade / TIPOS.comum.velocidade;
  z.dano *= TIPOS.rastejante.dano / TIPOS.comum.dano;
  z.vida = Math.min(z.vida, z.vidaMaxima * 0.4);
}

// Alvos que o tiro ve. O rastejante e baixo, entao a faixa de cabeca dele e
// baixa — nao ha regra especial, e so a altura.
export function comoAlvo(z) {
  return { ...z, raio: z.raio * 1.15, altura: z.altura };
}
