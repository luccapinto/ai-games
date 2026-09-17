// O kart: modelo de bicicleta com angulo de deriva por eixo, transferencia de
// peso, elipse de atrito, rampa e derrapagem controlada com mini-turbo.
//
// Nao ha DOM aqui, e e de proposito: quem dirige este modelo pode ser o teclado,
// a IA ou o banco de medidas de provas.mjs. As medidas do README — 96 km/h de
// ponta, 24 m para parar de 80, 1,2 g de lateral, 2,4 s de mini-turbo — saem
// deste arquivo pela simulacao, nao de uma tabela escrita a mao.
//
// A diferenca entre isto e um carro de corrida esta em tres numeros: esterco
// grande (0,62 rad), entre-eixos curto (1,05 m) e potencia pequena (12 cv). Um
// kart nao vence pela reta; vence por entrar na curva de lado sem perder o
// tracado — e e para isso que existe o mini-turbo.

export const DT = 1 / 60;

export const KART = {
  massa: 220,
  largura: 1.15,
  comprimento: 1.85,
  entreEixos: 1.05,
  dianteiro: 0.5,
  traseiro: 0.55,
  alturaCG: 0.24,
  inercia: 62,

  // Amortecimento de guinada: pneu de verdade tem atraso de relaxacao, que e o
  // que impede a traseira de girar instantaneamente.
  amortecimentoGiro: 42,

  // Aderencia de pneu novo em asfalto limpo, em multiplos de g. `atritoUtil` e
  // o que o chassi SEGURA em regime, medido no skidpad do banco — parte do
  // atrito vai para equilibrar o kart, e e `atritoUtil` que a linha de corrida
  // e a IA usam para decidir velocidade de curva.
  atritoBase: 1.4,
  atritoUtil: 1.26,
  rigidezDianteira: 9,
  rigidezTraseira: 10.5,

  arrasto: 0.43,
  rolagem: 0.015,
  potencia: 9000,
  forcaTracaoMax: 1450,
  forcaFreio: 3200,
  reparticaoFreio: 0.58,
  esterco: 0.62,

  // Derrapagem controlada. Segurar o gatilho faz duas coisas: solta a traseira
  // (limite lateral dela cai para 72%) e levanta o teto de giro em 55%. O que
  // impede isso de virar rodopio e o teto de deriva la embaixo: 0,11 rad de
  // aderencia, 0,34 rad de lado.
  atritoDoDrift: 0.8,
  // Teto de giro do modo de aderencia, como fracao do que o pneu daria. 0,65 e
  // uma DECISAO de jogo, e a mais importante deste arquivo: com 1,0 o kart fazia
  // o grampo de 10 m sem derrapar, e ai derrapar era so custo — medido, ganho de
  // -0,05 s no grampo. Com 0,65 o grampo exige a rotacao que so o gatilho da, e
  // o mini-turbo passa a pagar a conta. Aderencia e macia e larga; drift gira.
  fatorDeGiroEmAderencia: 0.65,
  // Curvatura em que o teto de giro da aderencia deixa de dar conta e o gatilho
  // passa a ser obrigatorio: raio de 33 m. `linha.js` usa isto para saber com
  // que teto lateral calcular a velocidade de cada curva, e `piloto.js` para
  // decidir quando entrar de lado. Os dois tem de ler o MESMO numero, senao a IA
  // persegue uma velocidade que a tecnica dela nao entrega.
  curvaturaDeDrift: 0.03,
  fatorDeGiroNoDrift: 2.4,
  derivaDeAderencia: 0.11,
  derivaDoDrift: 0.24,
  controleDeDeriva: 40,
  derivaMinimaParaCarregar: 0.04,
  cargasDoTurbo: [0.3, 0.7, 1.2],
  turboPorCarga: [0.9, 1.5, 2.3],
  // 200 N e nao 1.750: com 1.750 o turbo levava o kart a 217 km/h, porque a
  // conta do arrasto (0,43 v^2) so equilibra essa forca perto dos 60 m/s.
  // O turbo e um empurrao, nao uma segunda marcha: a forca cai a zero na
  // `velocidadeDoTurbo`, senao ele viraria uma reta de 217 km/h (medido, com os
  // 1.750 N constantes da primeira versao).
  forcaDoTurbo: 700,
  velocidadeDoTurbo: 39,
  arrastoNoTurbo: 0.9,

  // Item de turbo (cogumelo) e mais forte e mais curto que o mini-turbo.
  turboDeItem: 1.6,

  // Rodopio de casco/banana: o kart gira e perde o comando.
  tempoDeRodopio: 1.25,

  marchas: [2.9, 1.9, 1.35, 1.05],
  relacaoFinal: 4.2,
  raioRoda: 0.14,
  rpmMax: 14000,
  rpmTroca: 13000,
  rpmVolta: 3200,
};

// Nome antigo mantido como apelido: `linha.js`, `piloto.js` e `corrida.js`
// falam de CARRO desde antes de o jogo virar kart, e renomear em cinco arquivos
// para ganhar nada nao paga o risco.
export const CARRO = KART;

// Gradiente de subesterco do chassi, em radianos. Sai limpo das constantes
// porque a rigidez do pneu aqui e por newton de carga: carga/(rigidez*carga) e
// 1/rigidez, e a carga estatica cancela. Positivo (0,0159 rad) quer dizer
// chassi que corre reto quando falta pneu — e nao que gira sozinho.
export const SUBESTERCO = 1 / KART.rigidezDianteira - 1 / KART.rigidezTraseira;

export function comandosNulos() {
  return { volante: 0, acelerador: 0, freio: 0, drift: false, item: false };
}

export function criarCarro(x, y, ang, opcoes = {}) {
  return {
    nome: opcoes.nome || 'KART',
    cor: opcoes.cor || '#d8d2c4',
    x, y, z: opcoes.z || 0, ang,
    vx: 0, vy: 0, omega: 0,
    marcha: 1, rpm: KART.rpmVolta,
    turbo: 0,
    carga: 0,
    driftando: 0,
    faixaDeCarga: 0,
    rodopio: 0,
    dano: 0,
    derrapagem: 0,
    aceleracaoLongitudinal: 0,
    aceleracaoLateral: 0,
    item: null,
    noChao: true,
    voo: 0,
  };
}

// Um passo do kart. `ctx` traz o que vem de fora:
//   atrito    multiplicador da superficie (1 asfalto, 0,46 grama)
//   vacuo     0 a 1, quanto do arrasto o kart da frente esta tirando
//   subida    rampa em metros por metro (positivo sobe)
export function passoCarro(carro, comandos, ctx, dt = DT) {
  const atritoSuperficie = ctx.atrito ?? 1;
  const vacuo = ctx.vacuo ?? 0;
  const subida = ctx.subida ?? 0;
  const massa = KART.massa;
  const g = 9.81;

  carro.turbo = Math.max(0, carro.turbo - dt);
  carro.rodopio = Math.max(0, carro.rodopio - dt);

  const volante = carro.rodopio > 0 ? 0 : Math.max(-1, Math.min(1, comandos.volante));
  const acelerador = carro.rodopio > 0 ? 0 : Math.max(0, Math.min(1, comandos.acelerador));
  const freio = Math.max(0, Math.min(1, comandos.freio));
  const querDrift = !!comandos.drift && carro.rodopio <= 0;

  const rapidez = Math.abs(carro.vx);
  const atrito = KART.atritoBase * atritoSuperficie;
  const L = KART.entreEixos;

  // O volante pede VELOCIDADE DE GIRO, e nao angulo de roda — e essa e a
  // diferenca entre um kart e um brinquedo quebrado. Com 0,62 rad de esterco
  // ligados direto no comando, meia volta de volante a 80 km/h pedia 1,9 g de
  // um asfalto que da 1,4: o kart rodopiava em meio segundo e terminava andando
  // para tras (medido, tres versoes seguidas). Aqui o comando e convertido no
  // giro que o pneu aguenta naquela superficie, e o angulo de roda sai da
  // equacao de Ackermann com subesterco — o pneu continua mandando, o comando
  // e que parou de pedir o impossivel.
  //
  // O gatilho de drift multiplica esse teto de giro: de lado o kart gira mais
  // do que a aderencia deixaria, e e para isso que se derrapa.
  const giroMaximo = ((atrito * g) / Math.max(5, rapidez))
    * (querDrift ? KART.fatorDeGiroNoDrift : KART.fatorDeGiroEmAderencia);
  const pedido = volante * giroMaximo;
  const esterco = KART.esterco;
  const delta = Math.max(-esterco, Math.min(esterco,
    (pedido * (L + SUBESTERCO * rapidez * rapidez / g)) / Math.max(4, rapidez)));

  const transferencia = (massa * carro.aceleracaoLongitudinal * KART.alturaCG) / L;
  const cargaDianteira = Math.max(120, (massa * g * KART.traseiro) / L - transferencia);
  const cargaTraseira = Math.max(120, (massa * g * KART.dianteiro) / L + transferencia);

  const marchaAtual = KART.marchas[carro.marcha - 1];
  const rpm = Math.max(KART.rpmVolta,
    (rapidez / KART.raioRoda) * marchaAtual * KART.relacaoFinal * (60 / (2 * Math.PI)));
  carro.rpm = Math.min(KART.rpmMax, rpm);
  if (carro.rpm > KART.rpmTroca && carro.marcha < KART.marchas.length) carro.marcha++;
  else if (carro.rpm < KART.rpmVolta * 1.5 && carro.marcha > 1) carro.marcha--;

  const forcaDisponivel = Math.min(KART.forcaTracaoMax, KART.potencia / Math.max(4, rapidez));
  const empurraoDoTurbo = carro.turbo > 0
    ? KART.forcaDoTurbo * Math.max(0, 1 - rapidez / KART.velocidadeDoTurbo)
    : 0;
  const forcaMotor = forcaDisponivel * acelerador + empurraoDoTurbo;
  const sentido = Math.abs(carro.vx) < 0.4 ? 0 : Math.sign(carro.vx);
  const forcaFreioTotal = KART.forcaFreio * freio * sentido;
  const fatorArrasto = (1 - 0.32 * vacuo) * (carro.turbo > 0 ? KART.arrastoNoTurbo : 1);
  const arrasto = KART.arrasto * fatorArrasto * carro.vx * Math.abs(carro.vx);
  const rolagem = KART.rolagem * massa * g * Math.sign(carro.vx || 1);
  // Rampa: a gravidade ao longo da pista. Ladeira freia, descida solta.
  const gravidade = massa * g * subida;

  const vRef = Math.max(1.6, rapidez);
  const derivaDianteira = Math.atan2(carro.vy + KART.dianteiro * carro.omega, vRef) - delta;
  const derivaTraseira = Math.atan2(carro.vy - KART.traseiro * carro.omega, vRef);

  const limiteDianteiro = atrito * cargaDianteira;
  const limiteTraseiro = atrito * cargaTraseira * (querDrift ? KART.atritoDoDrift : 1);

  let lateralDianteira = -KART.rigidezDianteira * derivaDianteira * cargaDianteira;
  let lateralTraseira = -KART.rigidezTraseira * derivaTraseira * cargaTraseira;

  let longDianteira = -forcaFreioTotal * KART.reparticaoFreio;
  let longTraseira = forcaMotor - forcaFreioTotal * (1 - KART.reparticaoFreio);
  const resistencia = arrasto + rolagem + gravidade;
  longDianteira -= resistencia * 0.5;
  longTraseira -= resistencia * 0.5;

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

  const fx = longTraseira + longDianteira * Math.cos(delta)
    - lateralDianteira * Math.sin(delta);
  const fy = lateralTraseira + lateralDianteira * Math.cos(delta)
    + longDianteira * Math.sin(delta);
  let momento = KART.dianteiro * (lateralDianteira * Math.cos(delta)
    + longDianteira * Math.sin(delta)) - KART.traseiro * lateralTraseira
    - carro.omega * KART.amortecimentoGiro;

  // Teto de deriva: o unico ponto do modelo que nao e pneu, e o que decide a
  // personalidade do kart. Com os dois eixos saturados o kart escorregava de
  // lado sem parar de girar — a deriva ia a 1,43 rad e ele terminava parado,
  // apontado para o lado errado (medido). Isto nao cria deriva nenhuma: e um
  // teto. Abaixo dele o pneu manda sozinho; acima, a guinada e puxada de volta.
  // O gatilho de drift levanta esse teto de 0,11 para 0,34 rad, e e so por isso
  // que derrapar e uma tecnica em vez de um acidente.
  const deriva = Math.atan2(carro.vy, Math.max(4, rapidez));
  const teto = querDrift ? KART.derivaDoDrift : KART.derivaDeAderencia;
  if (rapidez > 4 && Math.abs(deriva) > teto) {
    const alvo = Math.sign(deriva) * teto;
    momento += KART.controleDeDeriva * KART.inercia * (deriva - alvo);
  }

  const ax = fx / massa;
  const ay = fy / massa;
  carro.aceleracaoLongitudinal = ax;
  // Aceleracao lateral de verdade: forca do pneu dividida pela massa. `vx*omega`
  // media 1,9 g num asfalto que da 1,4 — ignora o escorregamento e mentia no
  // banco de medidas.
  carro.aceleracaoLateral = ay;

  carro.vx += (ax + carro.vy * carro.omega) * dt;
  carro.vy += (ay - carro.vx * carro.omega) * dt;
  carro.omega += (momento / KART.inercia) * dt;

  // O rodopio e escrito, nao simulado: com o pneu no lugar, o momento que faria
  // o kart girar tem de vencer 1.588 N.m de resistencia lateral, e qualquer
  // valor que vencesse isso mandaria o kart pelos ares. Casco e banana giram o
  // kart por decreto — o pneu volta a mandar quando o rodopio acaba.
  if (carro.rodopio > 0) {
    if (!carro.sentidoDoRodopio) carro.sentidoDoRodopio = carro.omega >= 0 ? 1 : -1;
    carro.omega = 10.5 * carro.sentidoDoRodopio;
    carro.vy *= 0.9;
  } else {
    carro.sentidoDoRodopio = 0;
  }

  if (rapidez < 1.6) {
    carro.vy *= 0.6;
    if (carro.rodopio <= 0) carro.omega = (carro.vx / L) * Math.tan(delta);
  }
  if (Math.abs(carro.vx) < 0.05 && forcaMotor < 1) carro.vx = 0;
  if (Math.abs(carro.vx) < 0.2) { carro.vy *= 0.2; carro.omega *= 0.5; }

  carro.x += (carro.vx * Math.cos(carro.ang) - carro.vy * Math.sin(carro.ang)) * dt;
  carro.y += (carro.vx * Math.sin(carro.ang) + carro.vy * Math.cos(carro.ang)) * dt;
  carro.ang = normalizar(carro.ang + carro.omega * dt);

  // --- mini-turbo -------------------------------------------------------
  const derivaAgora = Math.abs(Math.atan2(carro.vy, Math.max(2, Math.abs(carro.vx))));
  if (querDrift && rapidez > 5 && derivaAgora > KART.derivaMinimaParaCarregar) {
    carro.driftando += dt;
    carro.carga += dt;
  } else if (querDrift) {
    carro.driftando += dt;
  } else {
    if (carro.carga > 0) {
      const faixa = faixaDaCarga(carro.carga);
      if (faixa > 0) {
        carro.turbo = Math.max(carro.turbo, KART.turboPorCarga[faixa - 1]);
        carro.turboFaixa = faixa;
      }
    }
    carro.carga = 0;
    carro.driftando = 0;
  }
  carro.faixaDeCarga = faixaDaCarga(carro.carga);

  const saturacao = frente.saturado + tras.saturado;
  carro.derrapagem = Math.min(1, saturacao * 0.7 + Math.abs(carro.vy) / 7);
  return carro;
}

export function faixaDaCarga(carga) {
  let faixa = 0;
  for (const [i, limite] of KART.cargasDoTurbo.entries()) {
    if (carga >= limite) faixa = i + 1;
  }
  return faixa;
}

export function darTurbo(carro, segundos = KART.turboDeItem) {
  carro.turbo = Math.max(carro.turbo, segundos);
  carro.turboFaixa = 3;
}

export function rodopiar(carro, segundos = KART.tempoDeRodopio) {
  carro.rodopio = Math.max(carro.rodopio, segundos);
  carro.turbo = 0;
  carro.carga = 0;
  carro.vx *= 0.45;
}

export function velocidadeKmh(carro) {
  return Math.hypot(carro.vx, carro.vy) * 3.6;
}

export function normalizar(ang) {
  while (ang > Math.PI) ang -= Math.PI * 2;
  while (ang < -Math.PI) ang += Math.PI * 2;
  return ang;
}
