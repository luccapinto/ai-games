// Os sombreadores que faltam: mato e casa desenhados por instancia, gente e
// bicho com osso, painel virado para a camera (particula, barra de vida,
// letreiro) e a passada final de pos-processo.

import { UNIFORMES_DE_LUZ, FUNCOES_DE_LUZ, VENTO } from './luz.js';

// ------------------------------------------------------- mato, pedra, casa

export const VS_INSTANCIA = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNor;
layout(location = 2) in vec3 aCor;
layout(location = 3) in float aVento;
layout(location = 4) in vec3 iPos;
layout(location = 5) in float iEscala;
layout(location = 6) in float iGiro;
layout(location = 7) in vec3 iTom;
uniform mat4 uVP;
uniform vec3 uCamera;
uniform vec3 uAlvo;
uniform float uAlcance;
${VENTO}
out vec3 vNor;
out vec3 vCor;
out vec3 vMundo;
void main() {
  float c = cos(iGiro);
  float s = sin(iGiro);
  vec3 giradoP = vec3(aPos.x * c + aPos.z * s, aPos.y, -aPos.x * s + aPos.z * c);
  vec3 giradoN = vec3(aNor.x * c + aNor.z * s, aNor.y, -aNor.x * s + aNor.z * c);
  // Duas razoes para um pe de mato encolher: estar no fim do alcance (sem
  // isso ele aparece de estalo numa linha reta que segue o jogador) e estar
  // no corredor entre a camera e o jogador. A segunda e o que impede uma copa
  // de juazeiro de tapar a tela inteira de verde em mata fechada.
  float d = distance(iPos.xz, uCamera.xz);
  float some = (1.0 - smoothstep(uAlcance - 13.0, uAlcance, d))
    * smoothstep(0.4, 1.1, d);
  vec2 eixo = uAlvo.xz - uCamera.xz;
  float vao = length(eixo);
  if (vao > 0.5) {
    vec2 rumo = eixo / vao;
    vec2 rel = iPos.xz - uCamera.xz;
    float ao = dot(rel, rumo);
    float lado = length(rel - rumo * ao);
    float noCaminho = step(0.25, ao) * step(ao, vao - 0.5)
      * (1.0 - smoothstep(0.5, 1.4, lado));
    some *= 1.0 - noCaminho;
  }
  vec3 p = giradoP * (iEscala * some) + iPos;
  p = balancar(p, iPos, aVento * iEscala);
  vNor = giradoN;
  vCor = aCor * iTom;
  vMundo = p;
  gl_Position = uVP * vec4(p, 1.0);
}`;

export const FS_SOLIDO = `#version 300 es
precision highp float;
in vec3 vNor;
in vec3 vCor;
in vec3 vMundo;
out vec4 corSaida;
uniform vec3 uRealce;
${UNIFORMES_DE_LUZ}
${FUNCOES_DE_LUZ}
void main() {
  vec3 cor = iluminar(vCor, normalize(vNor), vMundo);
  cor += uRealce;
  corSaida = vec4(comNevoa(cor, vMundo), 1.0);
}`;

export const VS_INSTANCIA_PROFUNDIDADE = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 3) in float aVento;
layout(location = 4) in vec3 iPos;
layout(location = 5) in float iEscala;
layout(location = 6) in float iGiro;
uniform mat4 uVP;
uniform vec3 uCamera;
uniform float uAlcance;
${VENTO}
void main() {
  float c = cos(iGiro);
  float s = sin(iGiro);
  float d = distance(iPos.xz, uCamera.xz);
  float some = 1.0 - smoothstep(uAlcance - 13.0, uAlcance, d);
  vec3 p = vec3(aPos.x * c + aPos.z * s, aPos.y, -aPos.x * s + aPos.z * c)
    * (iEscala * some) + iPos;
  p = balancar(p, iPos, aVento * iEscala);
  gl_Position = uVP * vec4(p, 1.0);
}`;

export const OSSOS = 8;

export const VS_OSSO = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNor;
layout(location = 2) in vec3 aCor;
layout(location = 3) in float aOsso;
uniform mat4 uVP;
uniform mat4 uModelo;
uniform mat4 uOssos[${OSSOS}];
out vec3 vNor;
out vec3 vCor;
out vec3 vMundo;
void main() {
  int b = int(aOsso + 0.5);
  mat4 osso = uOssos[b];
  vec4 local = osso * vec4(aPos, 1.0);
  vec4 mundo = uModelo * local;
  vec3 n = mat3(uModelo) * (mat3(osso) * aNor);
  vNor = normalize(n);
  vCor = aCor;
  vMundo = mundo.xyz;
  gl_Position = uVP * mundo;
}`;

export const VS_OSSO_PROFUNDIDADE = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 3) in float aOsso;
uniform mat4 uVP;
uniform mat4 uModelo;
uniform mat4 uOssos[${OSSOS}];
void main() {
  int b = int(aOsso + 0.5);
  gl_Position = uVP * (uModelo * (uOssos[b] * vec4(aPos, 1.0)));
}`;

// ---------------------------------------------------------------- paineis

// Quadrado sempre virado para a camera. Serve de particula, de barra de vida
// do bicho e de letra: o atlas manda, e quando o retangulo de atlas e vazio
// sai cor chapada.
export const VS_PAINEL = `#version 300 es
layout(location = 0) in vec2 aQuad;
layout(location = 1) in vec3 iPos;
layout(location = 2) in vec2 iTam;
layout(location = 3) in vec4 iCor;
layout(location = 4) in vec4 iAtlas;
uniform mat4 uVP;
uniform vec3 uDireita;
uniform vec3 uCima;
out vec2 vUV;
out vec4 vCor;
out float vTemAtlas;
void main() {
  vec3 p = iPos + uDireita * (aQuad.x * iTam.x) + uCima * (aQuad.y * iTam.y);
  // O atlas vem de canvas 2D, com origem em cima: por isso o V e invertido
  // aqui e nao no fragmento.
  vUV = vec2(iAtlas.x + (aQuad.x + 0.5) * iAtlas.z,
             iAtlas.y + (0.5 - aQuad.y) * iAtlas.w);
  // A cena inteira e linear; o painel tambem entra linear e so a passada
  // final devolve para sRGB.
  vCor = vec4(pow(iCor.rgb, vec3(2.2)), iCor.a);
  vTemAtlas = iAtlas.z > 0.0 ? 1.0 : 0.0;
  gl_Position = uVP * vec4(p, 1.0);
}`;

export const FS_PAINEL = `#version 300 es
precision highp float;
in vec2 vUV;
in vec4 vCor;
in float vTemAtlas;
out vec4 corSaida;
uniform sampler2D uAtlas;
void main() {
  vec4 cor = vCor;
  if (vTemAtlas > 0.5) cor.a *= texture(uAtlas, vUV).a;
  if (cor.a < 0.004) discard;
  corSaida = cor;
}`;

// ---------------------------------------------------------- pos-processo

// A ultima passada: distorcao de calor no horizonte, nevoa rasteira de
// madrugada, vinheta, aviso de vida baixa e a direcao de quem bateu.
export const VS_POS = `#version 300 es
layout(location = 0) in vec2 aTela;
out vec2 vUV;
void main() {
  vUV = aTela * 0.5 + 0.5;
  gl_Position = vec4(aTela, 0.0, 1.0);
}`;

export const FS_POS = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 corSaida;
uniform sampler2D uCena;
uniform float uTempo;
uniform float uCalor;
uniform float uNoite;
uniform float uDor;
uniform float uVidaBaixa;
uniform float uAnguloDoDano;
uniform float uForcaDoDano;
uniform vec2 uTamanho;

void main() {
  vec2 uv = vUV;

  // Distorcao de calor: so na faixa do horizonte, e so quando o sol castiga.
  // E o sinal visual de que andar aquela hora custa cantil.
  if (uCalor > 0.02) {
    float faixa = exp(-pow((uv.y - 0.52) * 7.0, 2.0));
    float onda = sin(uv.y * 190.0 + uTempo * 7.0) * 0.5
      + sin(uv.y * 71.0 - uTempo * 4.3) * 0.5;
    uv.x += onda * 0.0042 * uCalor * faixa;
    uv.y += sin(uv.x * 120.0 + uTempo * 5.1) * 0.0014 * uCalor * faixa;
  }

  vec3 cor = texture(uCena, clamp(uv, 0.001, 0.999)).rgb;

  // madrugada: puxa para azul e come o contraste
  cor = mix(cor, vec3(dot(cor, vec3(0.29, 0.59, 0.12))) * vec3(0.62, 0.74, 1.05), uNoite * 0.45);

  // vinheta
  vec2 d = (vUV - 0.5) * vec2(uTamanho.x / uTamanho.y, 1.0);
  float vinheta = 1.0 - dot(d, d) * 0.55;
  cor *= clamp(vinheta, 0.0, 1.0);
  // Os vermelhos abaixo estao em linear (sRGB elevado a 2,2), porque a
  // devolucao de gama so acontece no fim desta funcao.
  if (uVidaBaixa > 0.01) {
    float pulso = 0.5 + 0.5 * sin(uTempo * 5.2);
    float borda = smoothstep(0.16, 0.62, dot(d, d));
    cor = mix(cor, vec3(0.145, 0.0005, 0.0005), borda * uVidaBaixa * (0.30 + 0.36 * pulso));
  }

  // De onde veio a pancada. A primeira versao pintava um quarto da tela de
  // vermelho e nao se via mais o bicho; agora e uma lasca estreita na borda.
  if (uForcaDoDano > 0.01) {
    float a = atan(d.y, d.x);
    float perto = cos(a - uAnguloDoDano) * 0.5 + 0.5;
    float borda = smoothstep(0.10, 0.40, dot(d, d));
    cor = mix(cor, vec3(0.48, 0.003, 0.002), pow(perto, 16.0) * borda * uForcaDoDano * 0.85);
  }

  cor = mix(cor, vec3(0.27, 0.002, 0.002), uDor * 0.24);

  // So comprime o que passa de 0,85 em linear, e devolve para sRGB no fim.
  // Sem a devolucao de gama, tudo que caia na sombra saia preto de tinta.
  vec3 alto = max(cor - 0.85, vec3(0.0));
  cor = min(cor, vec3(0.85)) + alto / (1.0 + alto * 1.7);
  cor = pow(max(cor, vec3(0.0)), vec3(1.0 / 2.2));
  float luz = dot(cor, vec3(0.299, 0.587, 0.114));
  cor = clamp(mix(vec3(luz), cor, 1.12), 0.0, 1.0);
  corSaida = vec4(cor, 1.0);
}`;
