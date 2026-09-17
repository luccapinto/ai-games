// Render 3D em WebGL2, escrito a mao: sem biblioteca, sem arquivo de modelo,
// sem textura em disco.
//
// O jogo se passa numa mina, e por isso a decisao de render mais importante nao
// e geometria: e **luz**. Tudo aqui gira em volta de tres fontes, calculadas por
// fragmento:
//
//   lanterna     um refletor conico preso na camera, com queda suave na borda.
//                E a unica luz que o jogador controla, e e ela que faz o jogo
//                ter medo — o que esta fora do cone existe e nao aparece.
//   lampadas     as `o` da planta, as oito mais proximas. Sao as mesmas que o
//                mapa usa para assar `luz` por celula, entao o que a tela mostra
//                iluminado e o que o jogo considera iluminado.
//   clarao       o fogo do cano, como luz de verdade, por 60 ms. Sem isso, um
//                tiro no escuro nao mostra o corredor — e mostrar o corredor no
//                estouro e metade do genero.
//
// Neblina exponencial preta em cima disso: e o que faz um corredor de mina ter
// profundidade sem custar geometria, e e o que esconde o fim do mapa sem parede
// falsa.
//
// A rocha nao tem textura de arquivo: o fragmento sombreia por ruido de posicao
// de mundo (valor de hash de tres eixos), o que da grao de pedra e nao repete
// com padrao visivel. Nada disso e caro: e uma conta de hash por pixel.

import { CELULA, ALTURA_DO_TETO, CONFIG } from './regras.js';
import { T, tile, ehSolido, luzDaCelula, chave } from './mapa.js';
import { ALTURA_DO_ZUMBI } from './zumbis.js';

const MAX_LAMPADAS = 8;
const MAX_PARTICULAS = 1400;

// ------------------------------------------------------------- matrizes

function multiplicar(a, b) {
  const r = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let l = 0; l < 4; l++) {
      let soma = 0;
      for (let k = 0; k < 4; k++) soma += a[k * 4 + l] * b[c * 4 + k];
      r[c * 4 + l] = soma;
    }
  }
  return r;
}

function perspectiva(fov, aspecto, perto, longe) {
  const f = 1 / Math.tan(fov / 2);
  const d = 1 / (perto - longe);
  return new Float32Array([
    f / aspecto, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (longe + perto) * d, -1,
    0, 0, 2 * longe * perto * d, 0,
  ]);
}

function olhar(de, para, cima) {
  let zx = de[0] - para[0];
  let zy = de[1] - para[1];
  let zz = de[2] - para[2];
  let n = Math.hypot(zx, zy, zz) || 1;
  zx /= n; zy /= n; zz /= n;
  let xx = cima[1] * zz - cima[2] * zy;
  let xy = cima[2] * zx - cima[0] * zz;
  let xz = cima[0] * zy - cima[1] * zx;
  n = Math.hypot(xx, xy, xz) || 1;
  xx /= n; xy /= n; xz /= n;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * de[0] + xy * de[1] + xz * de[2]),
    -(yx * de[0] + yy * de[1] + yz * de[2]),
    -(zx * de[0] + zy * de[1] + zz * de[2]),
    1,
  ]);
}

function matrizDeCorpo(x, y, z, giroZ, giroY = 0, escala = 1) {
  const c = Math.cos(giroZ);
  const s = Math.sin(giroZ);
  const cy = Math.cos(giroY);
  const sy = Math.sin(giroY);
  const e = escala;
  return new Float32Array([
    e * c * cy, e * s * cy, e * -sy, 0,
    e * -s, e * c, 0, 0,
    e * c * sy, e * s * sy, e * cy, 0,
    x, y, z, 1,
  ]);
}

// -------------------------------------------------------------- shaders

const VS_CENA = `#version 300 es
precision highp float;
layout(location = 0) in vec3 posicao;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec3 cor;
layout(location = 3) in float oclusao;
uniform mat4 uVistaProjecao;
uniform mat4 uModelo;
out vec3 vMundo;
out vec3 vNormal;
out vec3 vCor;
out float vOclusao;
out float vDistancia;
void main() {
  vec4 mundo = uModelo * vec4(posicao, 1.0);
  vMundo = mundo.xyz;
  vNormal = mat3(uModelo) * normal;
  vCor = cor;
  vOclusao = oclusao;
  gl_Position = uVistaProjecao * mundo;
  vDistancia = gl_Position.w;
}`;

const FS_CENA = `#version 300 es
precision highp float;
in vec3 vMundo;
in vec3 vNormal;
in vec3 vCor;
in float vOclusao;
in float vDistancia;

uniform vec3 uOlho;
uniform vec3 uLanternaDir;
uniform float uLanternaLigada;
uniform float uLanternaAbertura;
uniform float uLanternaAlcance;
uniform vec3 uLampadas[${MAX_LAMPADAS}];
uniform float uLampadaForca[${MAX_LAMPADAS}];
uniform vec3 uClarao;
uniform float uClaraoForca;
uniform float uAmbiente;
uniform float uNeblina;
uniform float uGrao;
out vec4 saida;

// Hash de posicao, para grao de pedra sem textura de arquivo. Tres senos
// batidos: e barato, nao repete com padrao visivel e nao precisa de imagem.
float ruido(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 cor = vCor;

  // grao: mistura de ruido em duas escalas, so onde o material pede
  float g = ruido(floor(vMundo * 13.0)) * 0.5 + ruido(floor(vMundo * 41.0)) * 0.5;
  cor *= 1.0 - uGrao * (0.3 - g * 0.6);

  vec3 luz = vec3(uAmbiente) * (0.35 + 0.65 * vOclusao);

  // lanterna: refletor conico com queda suave na borda e no alcance
  if (uLanternaLigada > 0.5) {
    vec3 paraOlho = uOlho - vMundo;
    float d = length(paraOlho);
    vec3 dir = paraOlho / max(d, 0.001);
    float cone = dot(-dir, normalize(uLanternaDir));
    float borda = smoothstep(uLanternaAbertura, uLanternaAbertura * 0.45 + 0.55, cone);
    float queda = clamp(1.0 - d / uLanternaAlcance, 0.0, 1.0);
    float difusa = max(dot(n, dir), 0.0);
    luz += vec3(1.0, 0.94, 0.82) * borda * queda * (0.35 + 2.2 * difusa);
  }

  for (int i = 0; i < ${MAX_LAMPADAS}; i++) {
    float forca = uLampadaForca[i];
    if (forca <= 0.0) continue;
    vec3 paraLuz = uLampadas[i] - vMundo;
    float d = length(paraLuz);
    float queda = forca / (1.0 + d * d * 0.09);
    float difusa = max(dot(n, paraLuz / max(d, 0.001)), 0.0);
    luz += vec3(1.0, 0.78, 0.52) * queda * (0.2 + 1.1 * difusa);
  }

  if (uClaraoForca > 0.0) {
    vec3 paraClarao = uClarao - vMundo;
    float d = length(paraClarao);
    float difusa = max(dot(n, paraClarao / max(d, 0.001)), 0.0);
    luz += vec3(1.0, 0.85, 0.6) * uClaraoForca * (0.35 + difusa) / (1.0 + d * d * 0.16);
  }

  vec3 final = cor * luz;
  float neblina = 1.0 - exp(-uNeblina * vDistancia);
  final = mix(final, vec3(0.008, 0.007, 0.006), clamp(neblina, 0.0, 1.0));
  saida = vec4(final, 1.0);
}`;

const VS_PARTICULA = `#version 300 es
precision highp float;
layout(location = 0) in vec3 posicao;
layout(location = 1) in vec4 cor;
layout(location = 2) in float tamanho;
uniform mat4 uVistaProjecao;
uniform float uEscala;
out vec4 vCor;
void main() {
  gl_Position = uVistaProjecao * vec4(posicao, 1.0);
  gl_PointSize = clamp(tamanho * uEscala / max(gl_Position.w, 0.4), 1.0, 90.0);
  vCor = cor;
}`;

const FS_PARTICULA = `#version 300 es
precision highp float;
in vec4 vCor;
out vec4 saida;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  saida = vec4(vCor.rgb, vCor.a * (1.0 - r2 * 4.0));
}`;

function compilar(gl, tipo, fonte) {
  const s = gl.createShader(tipo);
  gl.shaderSource(s, fonte);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(`shader: ${gl.getShaderInfoLog(s)}`);
  }
  return s;
}

function programa(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compilar(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compilar(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`programa: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
}

function cor(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// ------------------------------------------------------- malha

// Construtor de malha com oclusao por vertice. A oclusao nao e enfeite: numa
// mina sem sol, quina escura e a unica pista de forma que o olho tem quando a
// lanterna esta apontada para outro lado.
function criarMalha() {
  const pos = [];
  const nor = [];
  const cores = [];
  const ocl = [];

  const triangulo = (a, b, c, tinta, oclusoes) => {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const n = Math.hypot(nx, ny, nz) || 1;
    nx /= n; ny /= n; nz /= n;
    const pontos = [a, b, c];
    for (let i = 0; i < 3; i++) {
      pos.push(pontos[i][0], pontos[i][1], pontos[i][2]);
      nor.push(nx, ny, nz);
      cores.push(tinta[0], tinta[1], tinta[2]);
      ocl.push(oclusoes ? oclusoes[i] : 1);
    }
  };

  const quad = (a, b, c, d, tinta, oclusoes) => {
    const o = oclusoes || [1, 1, 1, 1];
    triangulo(a, b, c, tinta, [o[0], o[1], o[2]]);
    triangulo(a, c, d, tinta, [o[0], o[2], o[3]]);
  };

  const caixa = (cx, cy, cz, sx, sy, sz, tinta, topo = tinta, ocluidoEmbaixo = 0.55) => {
    const x0 = cx - sx / 2;
    const x1 = cx + sx / 2;
    const y0 = cy - sy / 2;
    const y1 = cy + sy / 2;
    const z0 = cz - sz / 2;
    const z1 = cz + sz / 2;
    const baixo = ocluidoEmbaixo;
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], topo);
    quad([x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0], tinta);
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], tinta,
      [baixo, baixo, 1, 1]);
    quad([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], tinta,
      [baixo, baixo, 1, 1]);
    quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], tinta,
      [baixo, baixo, 1, 1]);
    quad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], tinta,
      [baixo, baixo, 1, 1]);
  };

  const cilindro = (cx, cy, cz, raio, altura, tinta, lados = 8) => {
    for (let i = 0; i < lados; i++) {
      const a0 = (i / lados) * Math.PI * 2;
      const a1 = ((i + 1) / lados) * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * raio, cy + Math.sin(a0) * raio, cz - altura / 2];
      const p1 = [cx + Math.cos(a1) * raio, cy + Math.sin(a1) * raio, cz - altura / 2];
      const p2 = [cx + Math.cos(a1) * raio, cy + Math.sin(a1) * raio, cz + altura / 2];
      const p3 = [cx + Math.cos(a0) * raio, cy + Math.sin(a0) * raio, cz + altura / 2];
      quad(p0, p1, p2, p3, tinta, [0.6, 0.6, 1, 1]);
    }
    const topo = [];
    for (let i = 0; i < lados; i++) {
      const a = (i / lados) * Math.PI * 2;
      topo.push([cx + Math.cos(a) * raio, cy + Math.sin(a) * raio, cz + altura / 2]);
    }
    for (let i = 1; i < lados - 1; i++) triangulo(topo[0], topo[i], topo[i + 1], tinta);
  };

  return { triangulo, quad, caixa, cilindro, dados: () => ({ pos, nor, cores, ocl, vertices: pos.length / 3 }) };
}

// --------------------------------------------------- modelos do jogo

// Zumbi em partes, para animar sem esqueleto: tronco, cabeca, dois bracos, duas
// pernas. Cada parte e desenhada com a sua propria matriz, e a fase de caminhada
// vem de `z.passo`, que e a mesma que o jogo usa.
function malhaDeParte(tipo) {
  const m = criarMalha();
  const pele = [0.46, 0.44, 0.38];
  const roupa = [0.24, 0.26, 0.24];
  if (tipo === 'tronco') {
    m.caixa(0, 0, 0, 0.42, 0.26, 0.6, roupa, roupa.map(v => v * 1.15));
    m.caixa(0.1, 0, 0.1, 0.24, 0.3, 0.3, roupa.map(v => v * 0.85));
  } else if (tipo === 'cabeca') {
    m.caixa(0, 0, 0, 0.24, 0.22, 0.26, pele, pele.map(v => v * 1.1));
    // mandibula caida: e o que faz a silhueta ler como zumbi de longe
    m.caixa(0.08, 0, -0.14, 0.16, 0.18, 0.1, [0.3, 0.16, 0.14]);
    m.caixa(0.11, -0.05, 0.04, 0.04, 0.05, 0.05, [0.7, 0.72, 0.6]);
    m.caixa(0.11, 0.05, 0.04, 0.04, 0.05, 0.05, [0.7, 0.72, 0.6]);
  } else if (tipo === 'braco') {
    m.caixa(0, 0, -0.26, 0.14, 0.14, 0.52, roupa.map(v => v * 0.9));
    m.caixa(0, 0, -0.56, 0.15, 0.15, 0.12, pele);
  } else if (tipo === 'perna') {
    m.caixa(0, 0, -0.3, 0.16, 0.16, 0.6, roupa.map(v => v * 0.75));
    m.caixa(0.04, 0, -0.63, 0.22, 0.16, 0.1, [0.16, 0.14, 0.12]);
  } else if (tipo === 'capacete') {
    m.caixa(0, 0, 0, 0.3, 0.28, 0.16, [0.72, 0.52, 0.12], [0.86, 0.64, 0.16]);
    m.caixa(0.14, 0, 0.02, 0.06, 0.1, 0.08, [1, 0.95, 0.7]);
  }
  return m.dados();
}

function malhaDeCaixote() {
  const m = criarMalha();
  m.caixa(0, 0, 0.32, 0.64, 0.64, 0.64, [0.34, 0.26, 0.17], [0.4, 0.31, 0.2]);
  m.caixa(0, 0, 0.32, 0.67, 0.12, 0.12, [0.22, 0.17, 0.12]);
  return m.dados();
}

function malhaDeMaquina(tipo) {
  const m = criarMalha();
  if (tipo === 'arma') {
    // Suporte de parede com a arma pendurada: o jogador precisa reconhecer de
    // longe que ali se compra arma.
    m.caixa(0, 0, 1.1, 0.12, 0.9, 0.7, [0.3, 0.3, 0.32], [0.36, 0.36, 0.38]);
    m.caixa(0.1, 0, 1.2, 0.08, 0.7, 0.1, [0.5, 0.42, 0.3]);
    m.caixa(0.1, -0.1, 1.05, 0.06, 0.12, 0.22, [0.28, 0.26, 0.25]);
  } else if (tipo === 'caixa') {
    m.caixa(0, 0, 0.45, 0.9, 0.9, 0.9, [0.4, 0.3, 0.16], [0.52, 0.4, 0.2]);
    m.caixa(0, 0, 0.92, 0.95, 0.95, 0.06, [0.6, 0.48, 0.2]);
    m.caixa(0, 0, 0.45, 0.94, 0.16, 0.16, [0.7, 0.58, 0.2]);
  } else if (tipo === 'forja') {
    m.caixa(0, 0, 0.6, 1, 0.8, 1.2, [0.26, 0.24, 0.26], [0.32, 0.3, 0.32]);
    m.caixa(0, 0, 1.28, 0.7, 0.6, 0.36, [0.5, 0.2, 0.1], [0.64, 0.26, 0.12]);
    m.cilindro(0.3, 0, 1.5, 0.12, 0.5, [0.3, 0.28, 0.26]);
  } else if (tipo === 'perk') {
    m.caixa(0, 0, 0.75, 0.62, 0.62, 1.5, [0.2, 0.22, 0.26], [0.26, 0.28, 0.32]);
    m.caixa(0.32, 0, 1.05, 0.06, 0.44, 0.5, [0.9, 0.76, 0.3]);
    m.caixa(0, 0, 1.56, 0.7, 0.7, 0.12, [0.32, 0.34, 0.38]);
  } else if (tipo === 'forca') {
    m.caixa(0, 0, 1.1, 0.16, 0.8, 1, [0.28, 0.28, 0.3], [0.34, 0.34, 0.36]);
    m.caixa(0.12, 0, 1.2, 0.1, 0.16, 0.3, [0.8, 0.3, 0.2]);
  }
  return m.dados();
}

// ---------------------------------------------------------- render

export function criarRender(canvas) {
  const gl = canvas.getContext('webgl2', {
    antialias: true, alpha: false, depth: true, powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('este jogo precisa de WebGL2');

  const progCena = programa(gl, VS_CENA, FS_CENA);
  const progParticula = programa(gl, VS_PARTICULA, FS_PARTICULA);

  const u = {
    vistaProjecao: gl.getUniformLocation(progCena, 'uVistaProjecao'),
    modelo: gl.getUniformLocation(progCena, 'uModelo'),
    olho: gl.getUniformLocation(progCena, 'uOlho'),
    lanternaDir: gl.getUniformLocation(progCena, 'uLanternaDir'),
    lanternaLigada: gl.getUniformLocation(progCena, 'uLanternaLigada'),
    lanternaAbertura: gl.getUniformLocation(progCena, 'uLanternaAbertura'),
    lanternaAlcance: gl.getUniformLocation(progCena, 'uLanternaAlcance'),
    lampadas: gl.getUniformLocation(progCena, 'uLampadas'),
    lampadaForca: gl.getUniformLocation(progCena, 'uLampadaForca'),
    clarao: gl.getUniformLocation(progCena, 'uClarao'),
    claraoForca: gl.getUniformLocation(progCena, 'uClaraoForca'),
    ambiente: gl.getUniformLocation(progCena, 'uAmbiente'),
    neblina: gl.getUniformLocation(progCena, 'uNeblina'),
    grao: gl.getUniformLocation(progCena, 'uGrao'),
  };
  const uP = {
    vistaProjecao: gl.getUniformLocation(progParticula, 'uVistaProjecao'),
    escala: gl.getUniformLocation(progParticula, 'uEscala'),
  };

  function subir(dados) {
    const n = dados.vertices;
    const buf = new Float32Array(n * 10);
    for (let i = 0; i < n; i++) {
      buf[i * 10] = dados.pos[i * 3];
      buf[i * 10 + 1] = dados.pos[i * 3 + 1];
      buf[i * 10 + 2] = dados.pos[i * 3 + 2];
      buf[i * 10 + 3] = dados.nor[i * 3];
      buf[i * 10 + 4] = dados.nor[i * 3 + 1];
      buf[i * 10 + 5] = dados.nor[i * 3 + 2];
      buf[i * 10 + 6] = dados.cores[i * 3];
      buf[i * 10 + 7] = dados.cores[i * 3 + 1];
      buf[i * 10 + 8] = dados.cores[i * 3 + 2];
      buf[i * 10 + 9] = dados.ocl[i];
    }
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
    const passo = 10 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, passo, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, passo, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, passo, 24);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, passo, 36);
    gl.bindVertexArray(null);
    return { vao, vbo, vertices: n };
  }

  const partes = {
    tronco: subir(malhaDeParte('tronco')),
    cabeca: subir(malhaDeParte('cabeca')),
    braco: subir(malhaDeParte('braco')),
    perna: subir(malhaDeParte('perna')),
    capacete: subir(malhaDeParte('capacete')),
  };
  const caixote = subir(malhaDeCaixote());
  const maquinas = {
    arma: subir(malhaDeMaquina('arma')),
    caixa: subir(malhaDeMaquina('caixa')),
    forja: subir(malhaDeMaquina('forja')),
    perk: subir(malhaDeMaquina('perk')),
    forca: subir(malhaDeMaquina('forca')),
  };

  // partículas
  const particulas = [];
  const parBuf = new Float32Array(MAX_PARTICULAS * 8);
  const parVao = gl.createVertexArray();
  const parVbo = gl.createBuffer();
  gl.bindVertexArray(parVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, parVbo);
  gl.bufferData(gl.ARRAY_BUFFER, parBuf.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 12);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 32, 28);
  gl.bindVertexArray(null);

  let mapa = null;
  let nivel = null;
  let tabuas = null;
  let paleta = null;
  let tempo = 0;
  let claraoAte = 0;
  let golpeAte = 0;
  let recuo = 0;
  let balanco = 0;
  const IDENTIDADE = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

  // A mina, assada numa malha so. Cada celula da planta vira piso, teto e as
  // faces de parede que dao para o vazio — face entre duas paredes nao entra no
  // buffer, porque ninguem nunca a ve.
  function construirNivel() {
    const m = criarMalha();
    const rocha = cor(paleta.rocha);
    const concreto = cor(paleta.concreto);
    const chapa = cor(paleta.chapa);
    const piso = cor(paleta.piso);
    const teto = cor(paleta.teto);
    const C = CELULA;
    const H = ALTURA_DO_TETO;

    const corDaParede = (t) => (t === T.CONCRETO ? concreto : t === T.CHAPA ? chapa : rocha);
    const solidoEm = (x, y) => ehSolido(tile(mapa, x, y));
    // Oclusao de vertice: quanto mais parede em volta do canto, mais escuro.
    const ocluir = (x, y, cantoX, cantoY) => {
      let paredes = 0;
      for (const [dx, dy] of [[0, 0], [cantoX, 0], [0, cantoY], [cantoX, cantoY]]) {
        if (solidoEm(x + dx, y + dy)) paredes++;
      }
      return 1 - Math.min(0.62, paredes * 0.2);
    };

    for (let y = 0; y < mapa.altura; y++) {
      for (let x = 0; x < mapa.largura; x++) {
        const t = tile(mapa, x, y);
        if (ehSolido(t) && t !== T.JANELA) continue;

        const x0 = x * C;
        const x1 = (x + 1) * C;
        const y0 = y * C;
        const y1 = (y + 1) * C;
        const molhado = t === T.POCA;
        const corDoPiso = molhado
          ? piso.map((v, i) => v * 0.62 + [0.05, 0.07, 0.09][i])
          : piso;

        if (t !== T.JANELA) {
          // piso e teto
          m.quad([x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0], corDoPiso, [
            ocluir(x, y, -1, -1), ocluir(x, y, 1, -1), ocluir(x, y, 1, 1), ocluir(x, y, -1, 1),
          ]);
          m.quad([x0, y1, H], [x1, y1, H], [x1, y0, H], [x0, y0, H], teto, [
            ocluir(x, y, -1, 1), ocluir(x, y, 1, 1), ocluir(x, y, 1, -1), ocluir(x, y, -1, -1),
          ]);
        }

        // faces de parede viradas para esta celula
        const vizinhos = [
          [1, 0, [[x1, y0, 0], [x1, y1, 0], [x1, y1, H], [x1, y0, H]]],
          [-1, 0, [[x0, y1, 0], [x0, y0, 0], [x0, y0, H], [x0, y1, H]]],
          [0, 1, [[x1, y1, 0], [x0, y1, 0], [x0, y1, H], [x1, y1, H]]],
          [0, -1, [[x0, y0, 0], [x1, y0, 0], [x1, y0, H], [x0, y0, H]]],
        ];
        for (const [dx, dy, quadrado] of vizinhos) {
          const tv = tile(mapa, x + dx, y + dy);
          if (!ehSolido(tv)) continue;
          if (t === T.JANELA && tv === T.JANELA) continue;
          const tinta = corDaParede(tv);
          const baixo = 0.55;
          m.quad(quadrado[0], quadrado[1], quadrado[2], quadrado[3], tinta,
            [baixo, baixo, 1, 1]);
        }

        // Escoras de madeira a cada tres celulas de corredor: e o que faz a
        // galeria parecer galeria em vez de tunel liso.
        if (t !== T.JANELA && (x + y) % 6 === 0) {
          const parede = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => solidoEm(x + dx, y + dy));
          if (parede.length >= 2) {
            const cx = x0 + C / 2;
            const cy = y0 + C / 2;
            const madeira = [0.29, 0.21, 0.13];
            const eixo = parede.some(([dx]) => dx !== 0) ? 'x' : 'y';
            if (eixo === 'y') {
              m.caixa(cx - C * 0.42, cy, H / 2, 0.16, 0.16, H, madeira);
              m.caixa(cx + C * 0.42, cy, H / 2, 0.16, 0.16, H, madeira);
              m.caixa(cx, cy, H - 0.1, C, 0.2, 0.2, madeira);
            } else {
              m.caixa(cx, cy - C * 0.42, H / 2, 0.16, 0.16, H, madeira);
              m.caixa(cx, cy + C * 0.42, H / 2, 0.16, 0.16, H, madeira);
              m.caixa(cx, cy, H - 0.1, 0.2, C, 0.2, madeira);
            }
          }
        }
      }
    }

    // Trilho de vagonete no chao: corre pelas celulas de poca e de lampada, que
    // e onde a mina teria mesmo servico.
    for (const poca of mapa.pocas) {
      const cx = (poca.x + 0.5) * C;
      const cy = (poca.y + 0.5) * C;
      m.caixa(cx, cy, 0.04, C, 0.1, 0.08, [0.3, 0.29, 0.28]);
    }

    return subir(m.dados());
  }

  // As tabuas de cada janela, numa malha que e refeita quando alguma cai. Sao
  // seis por janela, e ver quantas restam de longe e informacao de jogo.
  function construirTabuas() {
    const m = criarMalha();
    const C = CELULA;
    const madeira = [0.42, 0.3, 0.17];
    for (const janela of mapa.janelas) {
      const cx = (janela.x + 0.5) * C;
      const cy = (janela.y + 0.5) * C;
      const horizontal = janela.dentro.y !== janela.y;
      for (let i = 0; i < janela.tabuas; i++) {
        const z = 0.35 + i * 0.38;
        const inclinacao = ((i % 2) - 0.5) * 0.12;
        const tinta = madeira.map(v => v * (0.82 + (i % 3) * 0.12));
        if (horizontal) m.caixa(cx, cy, z, C * 0.96, 0.12, 0.16 + inclinacao, tinta);
        else m.caixa(cx, cy, z, 0.12, C * 0.96, 0.16 + inclinacao, tinta);
      }
    }
    return subir(m.dados());
  }

  function trocarMapa(novoMapa) {
    for (const malha of [nivel, tabuas]) {
      if (!malha) continue;
      gl.deleteBuffer(malha.vbo);
      gl.deleteVertexArray(malha.vao);
    }
    mapa = novoMapa;
    paleta = novoMapa.paleta;
    nivel = construirNivel();
    tabuas = construirTabuas();
    particulas.length = 0;
  }

  function refazerTabuas() {
    if (tabuas) {
      gl.deleteBuffer(tabuas.vbo);
      gl.deleteVertexArray(tabuas.vao);
    }
    tabuas = construirTabuas();
  }

  function soltar(x, y, z, vx, vy, vz, tinta, vida, tamanho) {
    if (particulas.length >= MAX_PARTICULAS) particulas.shift();
    particulas.push({ x, y, z, vx, vy, vz, tinta, vida, vidaMax: vida, tamanho });
  }

  // Sangue, faisca e poeira: tres coisas diferentes porque dizem coisas
  // diferentes. Sangue confirma acerto em carne, faisca confirma acerto em
  // pedra (e, portanto, tiro errado), poeira e o ar da mina no cone da lanterna.
  function sangue(x, y, z, quanto = 8) {
    for (let i = 0; i < quanto; i++) {
      soltar(x, y, z,
        (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.4, 0.6 + Math.random() * 1.8,
        [0.42 + Math.random() * 0.2, 0.05, 0.05, 0.95], 0.5 + Math.random() * 0.4, 13);
    }
  }

  function faisca(x, y, z) {
    for (let i = 0; i < 5; i++) {
      soltar(x, y, z,
        (Math.random() - 0.5) * 3.4, (Math.random() - 0.5) * 3.4, 0.8 + Math.random() * 2.4,
        [1, 0.8 + Math.random() * 0.2, 0.4, 1], 0.22 + Math.random() * 0.2, 7);
    }
  }

  function poeiraNoCone(jogador) {
    // Um grao por quadro, na frente do jogador: de graca, e e o que faz o cone
    // da lanterna aparecer no ar em vez de so na parede.
    const d = 1.5 + Math.random() * 7;
    const ang = jogador.ang + (Math.random() - 0.5) * 0.6;
    soltar(
      (jogador.x + Math.cos(ang) * d) * CELULA,
      (jogador.y + Math.sin(ang) * d) * CELULA,
      0.4 + Math.random() * 2.2,
      (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12, 0.05 + Math.random() * 0.1,
      [0.72, 0.68, 0.6, 0.22], 1.4 + Math.random(), 5,
    );
  }

  function clarao() {
    claraoAte = tempo + 0.06;
    recuo = Math.min(1, recuo + 0.55);
  }

  function passoParticulas(dt) {
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dt;
      if (p.vida <= 0) { particulas.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vz -= 7 * dt;
      if (p.z < 0.03) { p.z = 0.03; p.vz = 0; p.vx *= 0.6; p.vy *= 0.6; }
      p.vx *= 1 - 1.2 * dt;
      p.vy *= 1 - 1.2 * dt;
    }
  }

  function desenharMalha(malha, matriz) {
    gl.uniformMatrix4fv(u.modelo, false, matriz);
    gl.bindVertexArray(malha.vao);
    gl.drawArrays(gl.TRIANGLES, 0, malha.vertices);
  }

  // Zumbi: seis partes com matriz propria. A caminhada sai de `z.passo`, o
  // braco levantado sai do estado (quem esta mordendo estica o braco), e o
  // rastejante e o mesmo modelo deitado — nao ha segundo modelo.
  function desenharZumbi(z, vistaProjecao) {
    const C = CELULA;
    const rastejando = z.tipo === 'rastejante';
    const chefe = z.tipo === 'chefe';
    const escala = chefe ? 1.28 : 1;
    const base = rastejando ? 0.34 : 0;
    const bx = z.x * C;
    const by = z.y * C;
    const fase = z.passo;
    const andando = z.estado === 'cacando';
    const mordendo = z.estado === 'mordendo';
    const oscila = andando ? Math.sin(fase) : 0;
    const troncoZ = base + (rastejando ? 0.3 : 1.05 * escala) + (andando ? Math.abs(oscila) * 0.04 : 0);
    const inclina = rastejando ? 1.35 : mordendo ? -0.18 : 0.1;

    const tronco = matrizDeCorpo(bx, by, troncoZ, z.ang, inclina, escala);
    desenharMalha(partes.tronco, tronco);
    desenharMalha(partes.cabeca, multiplicar(tronco,
      matrizDeCorpo(0.06, 0, 0.44, 0, mordendo ? -0.3 : 0.12, 1)));
    if (chefe) {
      desenharMalha(partes.capacete, multiplicar(tronco,
        matrizDeCorpo(0.06, 0, 0.58, 0, 0.12, 1)));
    }
    // bracos: esticados para frente quando morde, balancando quando anda
    const bracoInclina = mordendo ? -1.45 : -0.9 - oscila * 0.5;
    const bracoInclinaB = mordendo ? -1.5 : -0.9 + oscila * 0.5;
    desenharMalha(partes.braco, multiplicar(tronco,
      matrizDeCorpo(0, -0.26, 0.24, 0, bracoInclina, 1)));
    desenharMalha(partes.braco, multiplicar(tronco,
      matrizDeCorpo(0, 0.26, 0.24, 0, bracoInclinaB, 1)));
    if (!rastejando) {
      desenharMalha(partes.perna, multiplicar(tronco,
        matrizDeCorpo(0, -0.12, -0.3, 0, oscila * 0.55, 1)));
      desenharMalha(partes.perna, multiplicar(tronco,
        matrizDeCorpo(0, 0.12, -0.3, 0, -oscila * 0.55, 1)));
    }
  }

  // A arma na mao: desenhada com projecao propria e plano proximo curto, para
  // ela nao entrar na parede quando o jogador encosta.
  function desenharArma(jogo, aspecto) {
    const arma = jogo.jogador.armas[jogo.jogador.naMao];
    const m = criarMalha();
    const metal = [0.2, 0.2, 0.22];
    const madeira = [0.36, 0.24, 0.14];
    if (arma.tipo === 'corpo') {
      m.caixa(0, 0, -0.1, 0.06, 0.06, 0.7, madeira);
      m.caixa(0, 0, 0.26, 0.34, 0.08, 0.08, metal, [0.4, 0.4, 0.42]);
    } else if (arma.chave.startsWith('espingarda')) {
      m.caixa(0, 0, 0.1, 0.07, 0.07, 0.95, metal);
      m.caixa(0, 0.02, -0.28, 0.1, 0.12, 0.42, madeira);
      m.caixa(0, 0, 0.42, 0.09, 0.09, 0.2, [0.26, 0.26, 0.28]);
    } else if (arma.chave.startsWith('pineira')) {
      m.caixa(0, 0, 0.12, 0.09, 0.1, 0.6, metal);
      m.caixa(0, 0, -0.16, 0.12, 0.2, 0.3, [0.3, 0.3, 0.32]);
      m.caixa(0, 0, 0.42, 0.06, 0.06, 0.24, [0.5, 0.5, 0.52]);
    } else if (arma.chave.startsWith('carabina')) {
      m.caixa(0, 0, 0.2, 0.06, 0.06, 1.1, metal);
      m.caixa(0, 0, -0.3, 0.1, 0.12, 0.5, madeira);
      m.caixa(0, 0, 0.5, 0.05, 0.05, 0.3, [0.3, 0.3, 0.3]);
      m.caixa(0.06, 0, 0.3, 0.12, 0.05, 0.05, [0.4, 0.4, 0.44]);
    } else if (arma.chave.startsWith('macarico')) {
      m.caixa(0, 0, 0.1, 0.1, 0.1, 0.7, [0.32, 0.18, 0.12]);
      m.cilindro(0, -0.12, -0.1, 0.1, 0.5, [0.45, 0.42, 0.2]);
      m.caixa(0, 0, 0.44, 0.06, 0.06, 0.2, [0.6, 0.5, 0.2]);
    } else {
      m.caixa(0, 0, 0.08, 0.07, 0.07, 0.42, metal);
      m.caixa(0, 0, -0.14, 0.09, 0.12, 0.22, [0.28, 0.28, 0.3]);
    }
    if (arma.forjada) {
      m.caixa(0, 0, 0.1, 0.13, 0.13, 0.12, [0.7, 0.45, 0.1], [0.9, 0.6, 0.15]);
    }
    const malha = subir(m.dados());

    // A arma e desenhada em ESPACO DE CAMERA, e por isso a iluminacao dela tem
    // de ser reconfigurada: `vMundo` aqui nao e mundo, e o olho esta na origem.
    // Sem isso ela sai preta (a conta do cone procurava a lanterna a vinte
    // metros de distancia, no mundo) — e uma arma preta na mao parece um bug de
    // render, que foi exatamente como isso apareceu.
    const projecao = perspectiva(0.95, aspecto, 0.05, 8);
    gl.uniform3fv(u.olho, new Float32Array([0, 0, 0]));
    gl.uniform3fv(u.lanternaDir, new Float32Array([0, 0, -1]));
    gl.uniform1f(u.lanternaAbertura, Math.cos(1.1));
    gl.uniform1f(u.lanternaAlcance, 3.2);
    gl.uniform1f(u.lanternaLigada, 1);
    gl.uniform1fv(u.lampadaForca, new Float32Array(MAX_LAMPADAS));
    gl.uniform1f(u.ambiente, 0.38);
    gl.uniform1f(u.neblina, 0.0);
    gl.uniform3fv(u.clarao, new Float32Array([0.2, -0.1, -1.1]));
    const recuoAtual = recuo * 0.12;
    const balancoX = Math.sin(balanco) * 0.012;
    const balancoY = Math.cos(balanco * 2) * 0.008;
    const recarregando = arma.recarregando > 0;
    // A varredura da picareta: 0,28 s de arco, de cima para baixo e da direita
    // para a esquerda. Um tiro recua; um golpe varre.
    const golpeando = tempo < golpeAte;
    const faseDoGolpe = golpeando ? 1 - (golpeAte - tempo) / 0.28 : 0;
    const arco = golpeando ? Math.sin(faseDoGolpe * Math.PI) : 0;
    const giro = recarregando ? -0.9 : arco * 1.5;
    const baixo = recarregando ? -0.18 : -arco * 0.22;
    // A arma mede 1 m no modelo e o olho esta a 5 cm do plano proximo: sem a
    // escala de 0,32 ela ocupava meia tela como uma caixa preta. E ela e
    // desenhada em espaco de camera, entao +Z aponta para tras — a arma tem de
    // ser empurrada para -Z e tombada para deitar ao longo da vista.
    const escala = 0.32;
    const modelo = new Float32Array([
      escala, 0, 0, 0,
      0, escala, 0, 0,
      0, 0, escala, 0,
      0.2 + balancoX - arco * 0.3, -0.22 + baixo + balancoY, -0.55 + recuoAtual - arco * 0.1, 1,
    ]);
    const inclinada = multiplicar(modelo, matrizDeCorpo(0, 0, 0, 0, -Math.PI / 2 + giro, 1));
    gl.uniformMatrix4fv(u.vistaProjecao, false, projecao);
    gl.uniform1f(u.grao, 0.15);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    desenharMalha(malha, inclinada);
    gl.deleteBuffer(malha.vbo);
    gl.deleteVertexArray(malha.vao);
  }

  function desenhar(jogo, dt, opcoes = {}) {
    tempo += dt;
    const j = jogo.jogador;
    const C = CELULA;
    const largura = canvas.width;
    const altura = canvas.height;

    if (jogo.mapa !== mapa) trocarMapa(jogo.mapa);
    const tabuasAgora = jogo.mapa.janelas.reduce((s, w) => s + w.tabuas, 0);
    if (tabuasAgora !== (desenhar.ultimasTabuas ?? -1)) {
      desenhar.ultimasTabuas = tabuasAgora;
      refazerTabuas();
    }

    recuo = Math.max(0, recuo - dt * 6);
    balanco += dt * (j.correndo ? 9 : 5.5) * (Math.hypot(j.vx || 0, j.vy || 0) > 0 ? 1 : 0.25);
    if (jogo.eventos) {
      for (const evento of jogo.eventos) {
        if (evento.tipo === 'tiro') clarao();
        // Golpe nao acende nada: quem bate com picareta no escuro nao ve nada
        // alem do que a lanterna mostra, e e isso que faz a picareta ser o
        // ultimo recurso.
        if (evento.tipo === 'golpe') golpeAte = tempo + 0.28;
        if (evento.tipo === 'acerto') {
          sangue(evento.zumbi.x * C, evento.zumbi.y * C,
            evento.zumbi.altura * (evento.naCabeca ? 0.85 : 0.55), evento.naCabeca ? 12 : 6);
        }
      }
    }
    if (Math.random() < 0.7) poeiraNoCone(j);
    passoParticulas(dt);

    gl.viewport(0, 0, largura, altura);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.disable(gl.BLEND);
    gl.clearColor(0.008, 0.007, 0.006, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const alturaDoOlho = j.baixado ? 0.55 : CONFIG.alturaDoOlho + Math.sin(balanco) * 0.03;
    const olho = [j.x * C, j.y * C, alturaDoOlho];
    const frente = [Math.cos(j.ang), Math.sin(j.ang), j.inclinacao];
    const alvo = [olho[0] + frente[0] * 5, olho[1] + frente[1] * 5, olho[2] + frente[2] * 5];
    const projecao = perspectiva(1.32, Math.max(0.5, largura / Math.max(1, altura)), 0.06, 200);
    const vista = olhar(olho, alvo, [0, 0, 1]);
    const vistaProjecao = multiplicar(projecao, vista);

    gl.useProgram(progCena);
    gl.uniformMatrix4fv(u.vistaProjecao, false, vistaProjecao);
    gl.uniform3fv(u.olho, olho);
    const dirLanterna = [frente[0], frente[1], frente[2]];
    gl.uniform3fv(u.lanternaDir, dirLanterna);
    gl.uniform1f(u.lanternaLigada, j.lanterna ? 1 : 0);
    gl.uniform1f(u.lanternaAbertura, Math.cos(CONFIG.aberturaDaLanterna * 1.6));
    gl.uniform1f(u.lanternaAlcance, CONFIG.alcanceDaLanterna * C * 0.85);
    // Ambiente baixo, mas nao zero: com zero, o que esta fora do cone da
    // lanterna e um retangulo preto, e o jogador perde a nocao de sala. Com
    // 0,1 ele ve a silhueta e nao ve o detalhe — que e o que a mina deve dar.
    gl.uniform1f(u.ambiente, jogo.forcaLigada ? 0.16 : 0.1);
    gl.uniform1f(u.neblina, 0.028);
    gl.uniform1f(u.grao, 0.75);

    // As oito lampadas mais proximas entram como luz de verdade; as outras nao
    // existem para o fragmento. Oito e o suficiente porque a neblina come o
    // resto antes de o olho notar.
    const proximas = mapa.lampadas
      .map(l => ({ l, d: Math.hypot(l.x - j.x, l.y - j.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_LAMPADAS);
    const posLampadas = new Float32Array(MAX_LAMPADAS * 3);
    const forcaLampadas = new Float32Array(MAX_LAMPADAS);
    for (let i = 0; i < proximas.length; i++) {
      posLampadas[i * 3] = proximas[i].l.x * C;
      posLampadas[i * 3 + 1] = proximas[i].l.y * C;
      posLampadas[i * 3 + 2] = ALTURA_DO_TETO - 0.35;
      // Lampada de mina pisca: e enfeite, mas e enfeite que faz a sala parecer
      // viva sem custar nada.
      const piscada = 0.82 + 0.18 * Math.sin(tempo * 7 + i * 2.3);
      forcaLampadas[i] = (jogo.forcaLigada ? 1.25 : 0.8) * piscada;
    }
    gl.uniform3fv(u.lampadas, posLampadas);
    gl.uniform1fv(u.lampadaForca, forcaLampadas);

    const claraoVivo = tempo < claraoAte;
    gl.uniform3fv(u.clarao, new Float32Array([
      olho[0] + frente[0] * 0.6, olho[1] + frente[1] * 0.6, olho[2],
    ]));
    gl.uniform1f(u.claraoForca, claraoVivo ? 3.2 : 0);

    desenharMalha(nivel, IDENTIDADE);
    gl.uniform1f(u.grao, 0.25);
    desenharMalha(tabuas, IDENTIDADE);

    // maquinas, viradas para o corredor
    for (const maquina of mapa.maquinas) {
      const malha = maquinas[maquina.tipo];
      if (!malha) continue;
      const parede = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .find(([dx, dy]) => ehSolido(tile(mapa, maquina.celula.x + dx, maquina.celula.y + dy)));
      const ang = parede ? Math.atan2(-parede[1], -parede[0]) : 0;
      desenharMalha(malha, matrizDeCorpo(maquina.x * C, maquina.y * C, 0, ang));
    }

    // Caixotes decorativos, e longe do inicio: a primeira versao punha um em
    // cada poca, e a poca ao lado da entrada deixava um caixote encostado na
    // cara do jogador no primeiro quadro de jogo.
    for (const [i, poca] of mapa.pocas.entries()) {
      if (i % 2) continue;
      if (Math.hypot(poca.x - mapa.inicio.x, poca.y - mapa.inicio.y) < 4) continue;
      desenharMalha(caixote,
        matrizDeCorpo((poca.x + 0.7) * C, (poca.y + 0.3) * C, 0, poca.x * 1.7));
    }

    gl.uniform1f(u.grao, 0.3);
    for (const z of jogo.vivos) {
      if (z.estado === 'morto' || z.estado === 'esperando') continue;
      desenharZumbi(z, vistaProjecao);
    }

    // partículas por cima
    if (particulas.length) {
      for (const [i, p] of particulas.entries()) {
        const k = i * 8;
        const f = Math.max(0, p.vida / p.vidaMax);
        parBuf[k] = p.x;
        parBuf[k + 1] = p.y;
        parBuf[k + 2] = p.z;
        parBuf[k + 3] = p.tinta[0];
        parBuf[k + 4] = p.tinta[1];
        parBuf[k + 5] = p.tinta[2];
        parBuf[k + 6] = (p.tinta[3] ?? 1) * f;
        parBuf[k + 7] = p.tamanho * (0.6 + f * 0.6);
      }
      gl.useProgram(progParticula);
      gl.uniformMatrix4fv(uP.vistaProjecao, false, vistaProjecao);
      gl.uniform1f(uP.escala, altura * 0.5);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.bindVertexArray(parVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, parVbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, parBuf, 0, particulas.length * 8);
      gl.drawArrays(gl.POINTS, 0, particulas.length);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // a arma na mao, por ultimo e com projecao propria
    if (!opcoes.semArma) {
      gl.useProgram(progCena);
      gl.uniform1f(u.claraoForca, claraoVivo ? 5 : 0);
      desenharArma(jogo, Math.max(0.5, largura / Math.max(1, altura)));
    }
  }

  function redimensionar(largura, altura) {
    canvas.width = largura;
    canvas.height = altura;
  }

  return { desenhar, redimensionar, sangue, faisca, clarao, trocarMapa };
}
