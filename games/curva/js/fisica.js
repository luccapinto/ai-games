// O carro: modelo de bicicleta com angulo de deriva por eixo, transferencia de
// peso, elipse de atrito, desgaste de pneu e combustivel que pesa.
//
// Nao ha DOM aqui, e e de proposito: quem dirige este modelo pode ser o teclado,
// a IA ou o banco de medidas de provas.mjs. As medidas do README — 283 km/h de
// maxima, 105 m para parar de 200, 1,5 g de lateral — saem deste arquivo pela
// simulacao, nao de uma tabela escrita a mao.

export const DT = 1 / 60;

export const CARRO = {
  massa: 780,
  largura: 1.9,
  comprimento: 4.5,
  // Centro de massa atras do meio, como carro de corrida de tracao traseira:
  // o eixo de tras carrega 57% do peso e por isso agarra mais, o que faz o
  // carro sair de frente em vez de girar. Com o CG adiantado (1,25/1,40) o
  // banco de medidas media 0,08 g de lateral — o carro rodava em vez de curvar.
  entreEixos: 2.65,
  dianteiro: 1.5,
  traseiro: 1.15,
  alturaCG: 0.31,
  inercia: 680,

  // Amortecimento de guinada. Pneu de verdade tem atraso de relaxacao, que e o
  // que impede a traseira de girar instantaneamente; sem um termo assim, o
  // modelo de bicicleta puro fica nervoso demais para o teclado.
  amortecimentoGiro: 340,

  // Aderencia de pneu novo em asfalto limpo, em multiplos de g. E o limite do
  // modelo de pneu, e nao o que o carro consegue SEGURAR em curva: com este
  // chassi o skidpad do banco de medidas da 1,29 g em regime, porque parte do
  // atrito vai para equilibrar o carro. `atritoUtil` e esse numero medido, e e
  // ele que a linha de corrida e a IA usam para decidir velocidade de curva.
  //
  // Enquanto a linha usou 1,5 g, a IA entrava em toda curva 7% rapido demais e
  // passava 15% do tempo na grama — o perfil pedia o que o carro nao dava.
  atritoBase: 1.5,
  atritoUtil: 1.26,
  rigidezDianteira: 10,
  rigidezTraseira: 11.5,

  // 0,5 * densidade do ar * Cd * area frontal. O vacuo desconta daqui.
  arrasto: 0.68,
  rolagem: 0.014,
  potencia: 340000,
  forcaTracaoMax: 9800,
  forcaFreio: 23000,
  reparticaoFreio: 0.62,
  esterco: 0.52,

  // Desgaste: 1 e pneu no fim da vida, e ele custa 18% de aderencia.
  desgastePorDeriva: 0.0022,
  desgastePorRolagem: 0.000012,
  custoDesgaste: 0.18,

  tanque: 60,
  consumo: 0.0032,
  pesoPorLitro: 0.78,

  marchas: [3.1, 2.15, 1.62, 1.28, 1.05, 0.88],
  relacaoFinal: 3.4,
  raioRoda: 0.33,
  rpmMax: 12500,
  rpmTroca: 11800,
  rpmVolta: 8200,
};

export function comandosNulos() {
  return { volante: 0, acelerador: 0, freio: 0, freioMao: false };
}

export function criarCarro(x, y, ang, opcoes = {}) {
  return {
    nome: opcoes.nome || 'CARRO',
    cor: opcoes.cor || '#d8d2c4',
    x, y, ang,
    vx: 0, vy: 0, omega: 0,
    marcha: 1, rpm: CARRO.rpmVolta * 0.4,
    pneus: { desgaste: 0, temp: 0.2 },
    combustivel: opcoes.combustivel ?? CARRO.tanque,
    dano: 0,
    derrapagem: 0,
    aceleracaoLongitudinal: 0,
    aceleracaoLateral: 0,
    noChao: true,
  };
}

// Um passo do carro. `ctx` traz o que vem de fora do carro:
//   atrito  multiplicador da superficie sob as rodas (1 asfalto, 0,42 grama)
//   vacuo   0 a 1, quanto do arrasto o carro da frente esta tirando
export function passoCarro(carro, comandos, ctx, dt = DT) {
  const atritoSuperficie = ctx.atrito ?? 1;
  const vacuo = ctx.vacuo ?? 0;
  const massa = CARRO.massa + carro.combustivel * CARRO.pesoPorLitro;
  const g = 9.81;

  const volante = Math.max(-1, Math.min(1, comandos.volante));
  const acelerador = Math.max(0, Math.min(1, comandos.acelerador));
  const freio = Math.max(0, Math.min(1, comandos.freio));

  // Esterco sensivel a velocidade: sem isto, virar o volante todo a 250 km/h
  // roda o carro no proprio eixo, e o jogo fica impossivel no teclado.
  const rapidez = Math.abs(carro.vx);
  const esterco = CARRO.esterco * (1 - 0.62 * Math.min(1, rapidez / 62));
  const delta = volante * esterco;

  // --- aderencia disponivel ---------------------------------------------
  const desgaste = Math.min(1, carro.pneus.desgaste);
  const atrito = CARRO.atritoBase * atritoSuperficie
    * (1 - CARRO.custoDesgaste * desgaste)
    * (0.95 + 0.05 * Math.min(1, carro.pneus.temp));

  // --- transferencia de peso --------------------------------------------
  const L = CARRO.entreEixos;
  const transferencia = (massa * carro.aceleracaoLongitudinal * CARRO.alturaCG) / L;
  const cargaDianteira = Math.max(200, (massa * g * CARRO.traseiro) / L - transferencia);
  const cargaTraseira = Math.max(200, (massa * g * CARRO.dianteiro) / L + transferencia);

  // --- motor, freio e arrasto -------------------------------------------
  const marchaAtual = CARRO.marchas[carro.marcha - 1];
  const rpm = Math.max(CARRO.rpmVolta * 0.35,
    (rapidez / CARRO.raioRoda) * marchaAtual * CARRO.relacaoFinal * (60 / (2 * Math.PI)));
  carro.rpm = Math.min(CARRO.rpmMax, rpm);
  if (carro.rpm > CARRO.rpmTroca && carro.marcha < CARRO.marchas.length) carro.marcha++;
  else if (carro.rpm < CARRO.rpmVolta * 0.72 && carro.marcha > 1) carro.marcha--;

  const temCombustivel = carro.combustivel > 0;
  const forcaDisponivel = temCombustivel
    ? Math.min(CARRO.forcaTracaoMax, CARRO.potencia / Math.max(6, rapidez))
    : 0;
  const forcaMotor = forcaDisponivel * acelerador;
  // O freio se opoe ao movimento e nao inventa movimento: sem o sinal e sem a
  // zona morta, frear parado empurrava o carro para tras — na largada a IA saia
  // de re a 134 km/h, o que o relatorio da IA mostrou em duas linhas.
  const sentido = Math.abs(carro.vx) < 0.4 ? 0 : Math.sign(carro.vx);
  const forcaFreioTotal = CARRO.forcaFreio * freio * sentido;
  const arrasto = CARRO.arrasto * (1 - 0.32 * vacuo) * carro.vx * Math.abs(carro.vx);
  const rolagem = CARRO.rolagem * massa * g * Math.sign(carro.vx || 1);

  // --- angulos de deriva -------------------------------------------------
  const vRef = Math.max(2.2, rapidez);
  const derivaDianteira = Math.atan2(carro.vy + CARRO.dianteiro * carro.omega, vRef) - delta;
  const derivaTraseira = Math.atan2(carro.vy - CARRO.traseiro * carro.omega, vRef);

  const limiteDianteiro = atrito * cargaDianteira;
  const limiteTraseiro = atrito * cargaTraseira
    * (comandos.freioMao ? 0.55 : 1);

  let lateralDianteira = -CARRO.rigidezDianteira * derivaDianteira * cargaDianteira;
  let lateralTraseira = -CARRO.rigidezTraseira * derivaTraseira * cargaTraseira;

  let longDianteira = -forcaFreioTotal * CARRO.reparticaoFreio;
  let longTraseira = forcaMotor - forcaFreioTotal * (1 - CARRO.reparticaoFreio)
    - (comandos.freioMao ? CARRO.forcaFreio * 0.5 * sentido : 0);
  longDianteira -= arrasto * 0.5 + rolagem * 0.5;
  longTraseira -= arrasto * 0.5 + rolagem * 0.5;

  // --- elipse de atrito: um pneu nao faz as duas coisas por inteiro ------
  const elipse = (lon, lat, limite) => {
    const total = Math.hypot(lon, lat);
    if (total <= limite || total < 1e-6) return { lon, lat, saturado: 0 };
    const k = limite / total;
    return { lon: lon * k, lat: lat * k, saturado: total / limite - 1 };
  };
  const frente = elipse(longDianteira, lateralDianteira, limiteDianteiro);
  const tras = elipse(longTraseira, lateralTraseira, limiteTraseiro);
  longDianteira = frente.lon;
  lateralDianteira = frente.lat;
  longTraseira = tras.lon;
  lateralTraseira = tras.lat;

  // --- integracao --------------------------------------------------------
  const fx = longTraseira + longDianteira * Math.cos(delta)
    - lateralDianteira * Math.sin(delta);
  const fy = lateralTraseira + lateralDianteira * Math.cos(delta)
    + longDianteira * Math.sin(delta);
  const momento = CARRO.dianteiro * (lateralDianteira * Math.cos(delta)
    + longDianteira * Math.sin(delta)) - CARRO.traseiro * lateralTraseira
    - carro.omega * CARRO.amortecimentoGiro;

  const ax = fx / massa;
  const ay = fy / massa;
  carro.aceleracaoLongitudinal = ax;
  carro.aceleracaoLateral = carro.vx * carro.omega;

  carro.vx += (ax + carro.vy * carro.omega) * dt;
  carro.vy += (ay - carro.vx * carro.omega) * dt;
  carro.omega += (momento / CARRO.inercia) * dt;

  // Abaixo de 2 m/s o modelo de deriva nao tem sentido (divide por quase zero):
  // o carro passa a andar pela cinematica, que e o que faz manobra de box e
  // largada parada funcionarem sem o carro tremer.
  if (rapidez < 2.2) {
    carro.vy *= 0.6;
    carro.omega = (carro.vx / L) * Math.tan(delta);
  }
  if (Math.abs(carro.vx) < 0.05 && forcaMotor < 1) carro.vx = 0;
  if (Math.abs(carro.vx) < 0.2) { carro.vy *= 0.2; carro.omega *= 0.5; }

  carro.x += (carro.vx * Math.cos(carro.ang) - carro.vy * Math.sin(carro.ang)) * dt;
  carro.y += (carro.vx * Math.sin(carro.ang) + carro.vy * Math.cos(carro.ang)) * dt;
  carro.ang = normalizar(carro.ang + carro.omega * dt);

  // --- consumo e pneu ----------------------------------------------------
  if (temCombustivel) {
    carro.combustivel = Math.max(0,
      carro.combustivel - CARRO.consumo * acelerador * (carro.rpm / CARRO.rpmMax + 0.25) * dt * 60);
  }
  const deriva = Math.abs(derivaDianteira) + Math.abs(derivaTraseira);
  const saturacao = frente.saturado + tras.saturado;
  carro.pneus.desgaste = Math.min(1.4, carro.pneus.desgaste
    + (deriva * CARRO.desgastePorDeriva + saturacao * CARRO.desgastePorDeriva * 2
      + rapidez * CARRO.desgastePorRolagem) * dt * 60);
  const alvoTemp = Math.min(1, 0.2 + deriva * 1.6 + rapidez / 120);
  carro.pneus.temp += (alvoTemp - carro.pneus.temp) * dt * 0.35;
  carro.derrapagem = Math.min(1, saturacao * 0.8 + Math.abs(carro.vy) / 12);
  return carro;
}

export function velocidadeKmh(carro) {
  return Math.hypot(carro.vx, carro.vy) * 3.6;
}

export function normalizar(ang) {
  while (ang > Math.PI) ang -= Math.PI * 2;
  while (ang < -Math.PI) ang += Math.PI * 2;
  return ang;
}
