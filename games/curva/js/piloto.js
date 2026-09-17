// O piloto de IA. Ele nao anda em trilho: le a mesma linha de corrida e o mesmo
// perfil de velocidade que provas.mjs usa como referencia, e dirige o carro com
// os mesmos tres comandos que o teclado manda (volante, acelerador, freio).
//
// Por isso a IA pode errar, e erra: se o carro estiver atravessado ao chegar na
// curva, o perfil manda frear e a fisica nao obedece. Piloto de trilho nunca
// erraria, e tambem nunca seria ultrapassavel.

import { CARRO, normalizar } from './fisica.js';
import { maisProximo, paraMundo } from './pista.js';

// Ordem importa: provas.mjs cobra que o tempo de volta cresca desta ordem para
// baixo. Perfil mais fraco nao pode ser mais rapido que perfil mais forte — e
// com habilidade 1,0 o ouro andava no limite exato do atrito, escorregava na
// saida da curva e perdia do prata. Nenhum piloto usa 100% do atrito.
export const PERFIS = {
  ouro: { habilidade: 0.96, agressao: 0.9, antecipacao: 1.0, erro: 0.0 },
  prata: { habilidade: 0.93, agressao: 0.75, antecipacao: 0.95, erro: 0.05 },
  bronze: { habilidade: 0.9, agressao: 0.6, antecipacao: 0.9, erro: 0.1 },
  ferro: { habilidade: 0.86, agressao: 0.45, antecipacao: 0.85, erro: 0.16 },
};

export function criarPiloto(nome, perfilNome = 'prata', semente = 1) {
  const perfil = PERFIS[perfilNome] || PERFIS.prata;
  return {
    nome,
    perfilNome,
    perfil,
    desvio: 0,
    desvioAlvo: 0,
    semente: semente | 0 || 1,
    ruido: 0,
    relogioRuido: 0,
  };
}

function sortear(piloto) {
  piloto.semente = (piloto.semente * 1103515245 + 12345) & 0x7fffffff;
  return piloto.semente / 0x7fffffff;
}

export function pilotar(carro, piloto, pista, linha, ctx = {}, dt = 1 / 60) {
  const perto = maisProximo(pista, carro.x, carro.y);
  const n = pista.centro.length;
  const velocidade = Math.max(0, carro.vx);

  // Erro humano: um ruido lento no volante e no ponto de frenagem. E o que faz
  // o pelotao abrir e fechar em vez de andar em fila indiana perfeita.
  piloto.relogioRuido -= dt;
  if (piloto.relogioRuido <= 0) {
    piloto.relogioRuido = 0.6 + sortear(piloto) * 1.2;
    piloto.ruido = (sortear(piloto) - 0.5) * 2 * piloto.perfil.erro;
  }

  // --- para onde olhar ---------------------------------------------------
  // Fora da pista o alvo deixa de ser a linha de corrida e passa a ser o eixo:
  // na grama a aderencia e 0,42 e nao existe linha de corrida nenhuma, existe
  // voltar para o asfalto. Sem esta recuperacao a IA saia larga numa curva e
  // passava um quinto da volta patinando no capim.
  const naGrama = ctx.superficie === 'grama' || ctx.superficie === 'muro';
  const distanciaOlhada = naGrama
    ? 10 + velocidade * 0.2
    : 6 + velocidade * 0.52 * piloto.perfil.antecipacao;
  const olhada = Math.max(2, Math.round(distanciaOlhada / pista.passo));
  const alvoIndice = (perto.i + olhada) % n;
  const deslocaLinha = naGrama ? 0 : linha.deslocamentos[alvoIndice] + piloto.desvio;
  const limite = pista.centro[alvoIndice].largura / 2 - CARRO.largura / 2 - 0.3;
  const alvo = paraMundo(pista, alvoIndice, Math.max(-limite, Math.min(limite, deslocaLinha)));

  // --- volante -----------------------------------------------------------
  // Pre-alimentacao pela curvatura da linha, mais correcao proporcional pelo
  // erro de angulo. A pre-alimentacao e o que faltava: controle proporcional
  // puro tem erro permanente em curva de raio constante — ele so pede volante
  // quando o carro JA esta apontando errado, e numa curva longa a 75 m/s isso
  // significa sair larga do comeco ao fim. A IA passava 30% da BAIXADA na grama.
  //
  // O termo v^2 e o gradiente de subesterco: quanto mais rapido, mais volante o
  // mesmo raio pede, porque o pneu trabalha com angulo de deriva.
  const anguloParaAlvo = Math.atan2(alvo.y - carro.y, alvo.x - carro.x);
  const deriva = Math.atan2(carro.vy, Math.max(4, velocidade));
  const erro = normalizar(anguloParaAlvo - carro.ang);
  const curvaturaAlvo = naGrama ? 0 : linha.curvaturas[alvoIndice];
  const preAlimentacao = curvaturaAlvo
    * (CARRO.entreEixos + 0.0011 * velocidade * velocidade);
  const estercoDisponivel = Math.max(0.06,
    CARRO.esterco * (1 - 0.62 * Math.min(1, velocidade / 62)));
  const pedido = preAlimentacao + erro * 1.9 - deriva * 0.45;
  const volante = Math.max(-1, Math.min(1,
    pedido / estercoDisponivel + piloto.ruido * 0.25));

  // --- velocidade alvo ---------------------------------------------------
  const janela = Math.round((velocidade * velocidade) / (2 * CARRO.atritoUtil * 9.81 * pista.passo)) + 2;
  let alvoVelocidade = Infinity;
  for (let k = 0; k <= janela; k++) {
    const i = (perto.i + k) % n;
    const distancia = k * pista.passo;
    const v = linha.velocidades[i] * piloto.perfil.habilidade;
    // Quanto posso estar agora para chegar naquela curva naquela velocidade.
    const permitido = Math.sqrt(v * v + 2 * CARRO.atritoUtil * 9.81 * 0.85 * distancia);
    if (permitido < alvoVelocidade) alvoVelocidade = permitido;
  }
  alvoVelocidade *= 1 + piloto.ruido * 0.04;
  // Na grama, devagar: acelerar fora do asfalto so aumenta a escorregada.
  if (naGrama) alvoVelocidade = Math.min(alvoVelocidade, 20);

  // --- carro na frente ---------------------------------------------------
  let acelerador = 0;
  let freio = 0;
  const frente = ctx.frente || null;
  if (frente && frente.distancia < 8 && frente.fechado) {
    freio = Math.min(1, (8 - frente.distancia) / 6);
  }
  if (frente && frente.distancia < 26) {
    // Sair da esteira: escolhe o lado com mais pista e tenta por o nariz la.
    const espacoEsquerda = perto.largura / 2 - frente.lateral - CARRO.largura;
    const espacoDireita = perto.largura / 2 + frente.lateral - CARRO.largura;
    const lado = espacoEsquerda > espacoDireita ? 1 : -1;
    piloto.desvioAlvo = lado * Math.min(4.2, perto.largura / 2 - CARRO.largura / 2 - 0.6)
      * piloto.perfil.agressao;
  } else {
    piloto.desvioAlvo = 0;
  }
  piloto.desvio += (piloto.desvioAlvo - piloto.desvio) * Math.min(1, dt * 1.6);

  if (velocidade < alvoVelocidade - 0.4) {
    acelerador = Math.min(1, (alvoVelocidade - velocidade) / 4 + 0.35);
  } else if (velocidade > alvoVelocidade + 0.4) {
    freio = Math.max(freio, Math.min(1, (velocidade - alvoVelocidade) / 7));
  } else {
    acelerador = 0.45;
  }

  // A elipse de atrito no pe direito, que e a tecnica que faltava: pneu que
  // esta fazendo curva nao tem sobra para tracionar. Sem esta conta a IA pisava
  // fundo dentro da curva, saturava o eixo de tras e saia larga — o traco de
  // uma volta mostrava derrapagem 1,00 desde o primeiro segundo e o carro no
  // muro em sete.
  const lateralAgora = Math.abs(velocidade * carro.omega);
  const tetoLateral = CARRO.atritoUtil * 9.81;
  const usado = Math.min(1, lateralAgora / tetoLateral);
  const sobra = Math.sqrt(Math.max(0, 1 - usado * usado));
  acelerador = Math.min(acelerador, 0.12 + 0.88 * sobra);
  freio = Math.min(freio, 0.15 + 0.85 * sobra);

  // Derrapagem forte: tirar o pe antes de voltar a acelerar, senao a IA mantem
  // o carro de lado a volta inteira.
  if (carro.derrapagem > 0.7) acelerador *= 0.5;
  if (velocidade < 3 && freio > 0.1 && !ctx.noBox) {
    freio = 0;
    acelerador = 0.6;
  }

  return { volante, acelerador, freio, freioMao: false };
}
