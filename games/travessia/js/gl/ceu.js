// O ceu e a luz da hora. Tudo que e atmosfera sai daqui: a direcao do sol, a
// cor que ele joga, a cor do ceu em cima e no horizonte, a nevoa e a forca da
// distorcao de calor.
//
// Isso nao e enfeite. No TRAVESSIA a luz ja e mecanica — ao meio-dia o cantil
// dura um minuto e meio e de madrugada quase o dobro — e o que faltava era
// deixar isso visivel sem HUD: meio-dia branco, sombra curta, horizonte
// fervendo; madrugada azul, sombra comprida, nevoa baixa.

import { CONFIG } from '../regras.js';
import { claridade, calorDaHora } from '../jogo.js';
import { normalizar } from './matriz.js';

const DURACAO_DO_DIA = CONFIG.horaDoPor - CONFIG.horaDoNascer;

// Paradas de cor ao longo do dia, de nascer (0) a por (1). Nenhuma delas e
// saturada: sertao ao meio-dia e lavado, nao colorido.
const PARADAS = [
  { t: 0.00, horizonte: [0.94, 0.79, 0.54], zenite: [0.44, 0.55, 0.70], sol: [1.00, 0.72, 0.42] },
  { t: 0.12, horizonte: [0.93, 0.83, 0.64], zenite: [0.38, 0.54, 0.76], sol: [1.00, 0.88, 0.68] },
  { t: 0.50, horizonte: [0.66, 0.75, 0.84], zenite: [0.26, 0.45, 0.72], sol: [1.00, 0.97, 0.90] },
  { t: 0.88, horizonte: [0.90, 0.60, 0.42], zenite: [0.36, 0.36, 0.56], sol: [1.00, 0.68, 0.40] },
  { t: 1.00, horizonte: [0.77, 0.41, 0.28], zenite: [0.22, 0.21, 0.40], sol: [1.00, 0.50, 0.30] },
];

const NOITE = {
  horizonte: [0.10, 0.14, 0.24],
  zenite: [0.055, 0.082, 0.149],
  sol: [0.52, 0.62, 0.86],
};

const misturar = (a, b, k) => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];

function corDoDia(t) {
  let i = 0;
  while (i < PARADAS.length - 2 && t > PARADAS[i + 1].t) i++;
  const a = PARADAS[i];
  const b = PARADAS[i + 1];
  const k = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
  return {
    horizonte: misturar(a.horizonte, b.horizonte, k),
    zenite: misturar(a.zenite, b.zenite, k),
    sol: misturar(a.sol, b.sol, k),
  };
}

// Todo o estado de luz de um instante. E chamado uma vez por quadro; devolver
// objeto novo aqui nao pesa e deixa o resto do render sem estado escondido.
export function atmosfera(hora) {
  const fase = (hora - CONFIG.horaDoNascer) / DURACAO_DO_DIA;
  const arco = fase * Math.PI;
  const alturaDoSol = Math.sin(arco);
  const luz = claridade(hora);
  const noite = Math.min(1, Math.max(0, (0.62 - luz) / 0.5));
  const calor = calorDaHora(hora);

  // Abaixo do horizonte quem ilumina e a lua, que esta no ponto oposto do
  // arco. O giro acontece no minuto mais escuro do dia e quase nao se ve.
  const noturno = alturaDoSol < 0.05;
  const direcao = noturno
    ? normalizar([-Math.cos(arco), Math.max(-alturaDoSol, 0.26), -0.36])
    : normalizar([Math.cos(arco), alturaDoSol, 0.36]);

  const dia = corDoDia(Math.min(1, Math.max(0, fase)));
  const horizonte = misturar(dia.horizonte, NOITE.horizonte, noite);
  const zenite = misturar(dia.zenite, NOITE.zenite, noite);
  const corDaLuz = misturar(dia.sol, NOITE.sol, noite);

  // Ao meio-dia o sol bate forte e a sombra e curta e dura; de manha e de
  // tarde ele e fraco e a luz do ceu (o ambiente) segura a cena. De noite
  // quem ilumina e a lua, fraca e fria.
  //
  // Os numeros sao de exposicao: com o sol a 1,30 a caatinga estourava em
  // amarelo de girassol ao meio-dia. A 0,97 ela fica cor de barro torrado,
  // que e o que se quer, e a sombra ainda cai para um quinto disso.
  const forcaDoSol = noturno ? 0.26 : 0.35 + 0.62 * Math.min(1, alturaDoSol * 1.35);
  const forcaAmbiente = 0.30 + 0.20 * luz;

  return {
    hora,
    luz,
    noite,
    calor,
    noturno,
    alturaDoSol,
    direcao,
    corDaLuz: [
      corDaLuz[0] * forcaDoSol,
      corDaLuz[1] * forcaDoSol,
      corDaLuz[2] * forcaDoSol,
    ],
    // Piso azul de noite: sem ele a madrugada fica preta de verdade e o
    // jogador nao ve onde pisa nem com o lampiao aceso.
    corAmbiente: [
      (zenite[0] * 0.55 + horizonte[0] * 0.45) * forcaAmbiente + noite * 0.050,
      (zenite[1] * 0.55 + horizonte[1] * 0.45) * forcaAmbiente + noite * 0.062,
      (zenite[2] * 0.58 + horizonte[2] * 0.42) * forcaAmbiente + noite * 0.092,
    ],
    horizonte,
    zenite,
    // A nevoa fecha mais de madrugada (ar parado, umidade no chao) e abre ao
    // meio-dia. E ela que faz o horizonte em camadas ter profundidade.
    nevoa: 0.0062 + noite * 0.0052,
    corNevoa: misturar(horizonte, zenite, 0.22),
    discoSol: noturno ? 0.22 : 1,
  };
}

const VS_CEU = `#version 300 es
layout(location = 0) in vec2 aTela;
out vec2 vTela;
void main() {
  vTela = aTela;
  gl_Position = vec4(aTela, 1.0, 1.0);
}`;

const FS_CEU = `#version 300 es
precision highp float;

in vec2 vTela;
out vec4 corSaida;

uniform mat4 uInvVP;
uniform vec3 uCamera;
uniform vec3 uSol;
uniform vec3 uHorizonte;
uniform vec3 uZenite;
uniform vec3 uCorDoSol;
uniform float uDiscoSol;
uniform float uNoite;
uniform float uTempo;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float ruido1(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash11(i), hash11(i + 1.0), f);
}

// A silhueta de serra e uma linha de ruido em cima do azimute. Quatro camadas,
// cada uma mais baixa, mais distante e mais lavada de nevoa: e so isso que faz
// o mundo parecer maior do que os 256 passos que ele tem.
float cume(float azimute, float semente, float frequencia) {
  float x = azimute * frequencia + semente;
  return ruido1(x) * 0.62 + ruido1(x * 2.13 + 7.0) * 0.26 + ruido1(x * 4.7 + 19.0) * 0.12;
}

void main() {
  vec4 perto = uInvVP * vec4(vTela, -1.0, 1.0);
  vec4 longe = uInvVP * vec4(vTela, 1.0, 1.0);
  vec3 raio = normalize(longe.xyz / longe.w - perto.xyz / perto.w);

  float alto = clamp(raio.y, -1.0, 1.0);
  vec3 cor = mix(uHorizonte, uZenite, pow(clamp(alto, 0.0, 1.0), 0.42));

  // abaixo da linha do horizonte o ceu ja e poeira suspensa
  cor = mix(cor, uHorizonte * 0.82, clamp(-alto * 4.0, 0.0, 1.0));

  // estrelas: so aparecem quando a noite entra, e nunca embaixo
  if (uNoite > 0.05 && alto > 0.0) {
    vec2 grade = floor(raio.xz / max(raio.y, 0.08) * 46.0);
    float estrela = hash21(grade);
    float brilho = smoothstep(0.9965, 1.0, estrela) * uNoite * alto;
    brilho *= 0.6 + 0.4 * sin(uTempo * 2.0 + estrela * 60.0);
    cor += vec3(0.85, 0.88, 1.0) * brilho;
  }

  // o corpo do sol e o halo em volta dele
  float juntos = dot(raio, uSol);
  float halo = pow(max(juntos, 0.0), 220.0) * 0.9 + pow(max(juntos, 0.0), 12.0) * 0.16;
  float disco = smoothstep(0.99955, 0.99985, juntos);
  cor += uCorDoSol * (halo + disco * 2.4) * uDiscoSol;

  // camadas de serra no horizonte
  float azimute = atan(raio.z, raio.x);
  for (int c = 0; c < 4; c++) {
    float f = float(c);
    float distante = f / 3.0;
    float altura = (0.115 - distante * 0.021)
      * cume(azimute, f * 31.7, 2.4 + f * 1.9) - 0.012 - distante * 0.004;
    float dentro = smoothstep(0.0028, -0.0028, alto - altura);
    vec3 corDaSerra = mix(mix(vec3(0.28, 0.24, 0.24), uHorizonte, 0.42 + distante * 0.44),
      uHorizonte, distante * 0.5);
    cor = mix(cor, corDaSerra, dentro);
  }

  corSaida = vec4(cor, 1.0);
}`;

export const FONTE_CEU = { vertice: VS_CEU, fragmento: FS_CEU };
