// Render 3D em WebGL2, escrito a mao: nenhuma biblioteca, nenhum arquivo de
// modelo, nenhuma textura em disco.
//
// Tudo que aparece na tela e construido a partir da MESMA geometria que a fisica
// usa. A fita da pista sai de `pista.centro`, com a altura e a sobrelevacao que
// entram na fisica como gravidade e como chao — se a pista parece subir, o kart
// perde velocidade subindo, porque e a mesma lista de numeros. Nao existe um
// "relevo de enfeite" aqui.
//
// Tres decisoes que valem ser ditas:
//
// 1. Um desenho por objeto, e nao instanciamento. Dez karts com corpo e quatro
//    rodas dao cinquenta chamadas por quadro, e a 60 Hz isso nao aparece em
//    perfil nenhum. Instanciar economizaria chamada e custaria clareza.
//
// 2. Iluminacao difusa de uma luz direcional, calculada no fragmento. Sem
//    sombra, sem reflexo: a leitura que o jogo precisa e "onde a pista sobe" e
//    "para que lado ela inclina", e normal por vertice ja entrega isso.
//
// 3. Neblina exponencial na cor do horizonte da pista. Nao e estilo: e o que
//    resolve o problema de um circuito de 800 m caber numa tela sem que a reta
//    de tras vire uma linha de um pixel disputando o z-buffer.

import { KART } from './fisica.js';
import { LIMITE_ZEBRA, LIMITE_GRAMA } from './pista.js';

// 1,15 m e nao 1,7: muro de kartodromo e baixo, e muro alto lido de dentro do
// carro virava uma laje escura fechando a vista da curva seguinte.
const ALTURA_DO_MURO = 1.15;
const QUEDA_DA_GRAMA = 0.32;
const MAX_PARTICULAS = 900;

// --------------------------------------------------------------- matrizes

// Multiplicacao coluna-maior, na ordem que a matematica usa: `multiplicar(a, b)`
// e a·b, isto e, aplica b primeiro. A primeira versao devolvia b·a por causa da
// ordem dos indices, e a tela ficava com o ceu e nada mais — a matriz de
// vista-projecao trocada manda a pista inteira para fora do tronco de visao.
function multiplicar(a, b) {
  const r = new Float32Array(16);
  for (let coluna = 0; coluna < 4; coluna++) {
    for (let linha = 0; linha < 4; linha++) {
      let soma = 0;
      for (let k = 0; k < 4; k++) soma += a[k * 4 + linha] * b[coluna * 4 + k];
      r[coluna * 4 + linha] = soma;
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

// Modelo do kart: posicao, rumo, e a inclinacao do chao embaixo dele. O kart
// deitar na sobrelevacao da curva nao e enfeite — e a mesma `inclinacao` que a
// fisica usa, e e o que deixa a curva rapida parecer rapida.
function matrizDoKart(x, y, z, ang, rolagem, arfagem, escala = 1) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const cr = Math.cos(rolagem);
  const sr = Math.sin(rolagem);
  const ca = Math.cos(arfagem);
  const sa = Math.sin(arfagem);
  // roda em Z (rumo), depois em X (arfagem), depois em Y (rolagem)
  const m = new Float32Array(16);
  const e = escala;
  m[0] = e * (c * ca);
  m[1] = e * (s * ca);
  m[2] = e * (-sa);
  m[3] = 0;
  m[4] = e * (c * sa * sr - s * cr);
  m[5] = e * (s * sa * sr + c * cr);
  m[6] = e * (ca * sr);
  m[7] = 0;
  m[8] = e * (c * sa * cr + s * sr);
  m[9] = e * (s * sa * cr - c * sr);
  m[10] = e * (ca * cr);
  m[11] = 0;
  m[12] = x;
  m[13] = y;
  m[14] = z;
  m[15] = 1;
  return m;
}

// ----------------------------------------------------------------- shaders

const VS_CENA = `#version 300 es
precision highp float;
layout(location = 0) in vec3 posicao;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec3 cor;
uniform mat4 uVistaProjecao;
uniform mat4 uModelo;
uniform vec3 uCorExtra;
uniform float uMisturaExtra;
out vec3 vNormal;
out vec3 vCor;
out float vDistancia;
out float vAltura;
void main() {
  vec4 mundo = uModelo * vec4(posicao, 1.0);
  gl_Position = uVistaProjecao * mundo;
  vNormal = mat3(uModelo) * normal;
  vCor = mix(cor, uCorExtra, uMisturaExtra);
  vDistancia = gl_Position.w;
  vAltura = mundo.z;
}`;

const FS_CENA = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vCor;
in float vDistancia;
in float vAltura;
uniform vec3 uLuz;
uniform vec3 uNeblina;
uniform float uDensidadeNeblina;
uniform float uBrilho;
out vec4 saida;
void main() {
  vec3 n = normalize(vNormal);
  float difusa = max(dot(n, normalize(uLuz)), 0.0);
  // Ceu-como-ambiente: face virada para cima recebe mais luz difusa do ceu, o
  // que separa piso de parede sem precisar de segunda luz.
  float ambiente = 0.42 + 0.18 * max(n.z, 0.0);
  vec3 cor = vCor * (ambiente + 0.72 * difusa) * uBrilho;
  float neblina = 1.0 - exp(-uDensidadeNeblina * vDistancia);
  saida = vec4(mix(cor, uNeblina, clamp(neblina, 0.0, 1.0)), 1.0);
}`;

const VS_CEU = `#version 300 es
precision highp float;
layout(location = 0) in vec2 posicao;
out float vAltura;
void main() {
  vAltura = posicao.y * 0.5 + 0.5;
  gl_Position = vec4(posicao, 0.9999, 1.0);
}`;

const FS_CEU = `#version 300 es
precision highp float;
in float vAltura;
uniform vec3 uAlto;
uniform vec3 uBaixo;
out vec4 saida;
void main() {
  float t = pow(clamp(vAltura, 0.0, 1.0), 0.8);
  saida = vec4(mix(uBaixo, uAlto, t), 1.0);
}`;

const VS_PARTICULA = `#version 300 es
precision highp float;
layout(location = 0) in vec3 posicao;
layout(location = 1) in vec4 cor;
layout(location = 2) in float tamanho;
uniform mat4 uVistaProjecao;
uniform float uEscalaTela;
out vec4 vCor;
void main() {
  gl_Position = uVistaProjecao * vec4(posicao, 1.0);
  gl_PointSize = clamp(tamanho * uEscalaTela / max(gl_Position.w, 1.0), 1.0, 64.0);
  vCor = cor;
}`;

const FS_PARTICULA = `#version 300 es
precision highp float;
in vec4 vCor;
out vec4 saida;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float r = dot(d, d);
  if (r > 0.25) discard;
  saida = vec4(vCor.rgb, vCor.a * (1.0 - r * 4.0));
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

// --------------------------------------------------------- malhas de objeto

// Um construtor de malha minusculo: caixa e cilindro dao conta de um kart, de
// uma caixa de item e de um poste. Nada aqui e carregado de arquivo.
function criarMalha() {
  const pos = [];
  const nor = [];
  const cores = [];
  const triangulo = (a, b, c, tinta) => {
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
    for (const p of [a, b, c]) {
      pos.push(p[0], p[1], p[2]);
      nor.push(nx, ny, nz);
      cores.push(tinta[0], tinta[1], tinta[2]);
    }
  };
  const quadrilatero = (a, b, c, d, tinta) => {
    triangulo(a, b, c, tinta);
    triangulo(a, c, d, tinta);
  };
  const caixa = (cx, cy, cz, sx, sy, sz, tinta, topo = tinta) => {
    const x0 = cx - sx / 2;
    const x1 = cx + sx / 2;
    const y0 = cy - sy / 2;
    const y1 = cy + sy / 2;
    const z0 = cz - sz / 2;
    const z1 = cz + sz / 2;
    quadrilatero([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], topo);
    quadrilatero([x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0], tinta);
    quadrilatero([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], tinta);
    quadrilatero([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], tinta);
    quadrilatero([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], tinta);
    quadrilatero([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], tinta);
  };
  // Cilindro com eixo em Y (roda de kart: gira em torno do eixo lateral).
  const roda = (cx, cy, cz, raio, largura, tinta, aro) => {
    const lados = 10;
    for (let i = 0; i < lados; i++) {
      const a0 = (i / lados) * Math.PI * 2;
      const a1 = ((i + 1) / lados) * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * raio, cy - largura / 2, cz + Math.sin(a0) * raio];
      const p1 = [cx + Math.cos(a1) * raio, cy - largura / 2, cz + Math.sin(a1) * raio];
      const p2 = [cx + Math.cos(a1) * raio, cy + largura / 2, cz + Math.sin(a1) * raio];
      const p3 = [cx + Math.cos(a0) * raio, cy + largura / 2, cz + Math.sin(a0) * raio];
      quadrilatero(p0, p1, p2, p3, tinta);
      triangulo([cx, cy + largura / 2, cz], p3, p2, aro);
      triangulo([cx, cy - largura / 2, cz], p1, p0, aro);
    }
  };
  return {
    triangulo,
    quadrilatero,
    caixa,
    roda,
    dados: () => ({ pos, nor, cores, vertices: pos.length / 3 }),
  };
}

function malhaDoCorpo() {
  const m = criarMalha();
  const chassi = [0.16, 0.16, 0.18];
  const pod = [0.1, 0.1, 0.12];
  const piloto = [0.2, 0.22, 0.26];
  // assoalho
  m.caixa(0, 0, 0.1, 1.7, 0.72, 0.1, chassi, [0.2, 0.2, 0.22]);
  // pontas laterais (protecao)
  m.caixa(0.05, -0.52, 0.14, 1.1, 0.3, 0.14, pod);
  m.caixa(0.05, 0.52, 0.14, 1.1, 0.3, 0.14, pod);
  // bico
  m.caixa(0.98, 0, 0.13, 0.5, 0.86, 0.1, [0.82, 0.82, 0.84]);
  // radiador do lado direito, que e onde ele fica num kart de verdade
  m.caixa(-0.05, 0.46, 0.26, 0.4, 0.14, 0.24, [0.32, 0.33, 0.36]);
  // banco
  m.caixa(-0.34, 0, 0.3, 0.44, 0.5, 0.3, [0.22, 0.2, 0.2]);
  // corpo do piloto
  m.caixa(-0.2, 0, 0.46, 0.34, 0.42, 0.34, piloto);
  // capacete
  m.caixa(-0.16, 0, 0.72, 0.28, 0.3, 0.26, [0.9, 0.9, 0.92], [0.95, 0.95, 0.97]);
  // visor
  m.caixa(-0.01, 0, 0.72, 0.06, 0.24, 0.12, [0.1, 0.12, 0.16]);
  // volante
  m.caixa(0.24, 0, 0.5, 0.06, 0.34, 0.06, [0.15, 0.15, 0.17]);
  // motor
  m.caixa(-0.62, 0.3, 0.3, 0.4, 0.34, 0.3, [0.3, 0.3, 0.33]);
  // escapamento
  m.caixa(-0.72, -0.28, 0.34, 0.5, 0.12, 0.12, [0.55, 0.5, 0.45]);
  // aerofolio traseiro pequeno, so para a silhueta nao terminar reta
  m.caixa(-0.86, 0, 0.56, 0.1, 0.5, 0.04, [0.85, 0.2, 0.18]);
  m.caixa(-0.86, -0.2, 0.42, 0.06, 0.06, 0.24, [0.3, 0.3, 0.32]);
  m.caixa(-0.86, 0.2, 0.42, 0.06, 0.06, 0.24, [0.3, 0.3, 0.32]);
  return m.dados();
}

function malhaDaRoda() {
  const m = criarMalha();
  m.roda(0, 0, 0, 0.14, 0.18, [0.09, 0.09, 0.1], [0.45, 0.45, 0.48]);
  return m.dados();
}

function malhaDaCaixa() {
  const m = criarMalha();
  m.caixa(0, 0, 0, 0.9, 0.9, 0.9, [0.95, 0.72, 0.15], [1, 0.9, 0.35]);
  m.caixa(0, 0, 0, 0.94, 0.3, 0.3, [0.3, 0.55, 0.9]);
  m.caixa(0, 0, 0, 0.3, 0.94, 0.3, [0.3, 0.55, 0.9]);
  return m.dados();
}

function malhaDoPoste() {
  const m = criarMalha();
  m.caixa(0, 0, 1.2, 0.16, 0.16, 2.4, [0.72, 0.72, 0.7], [0.8, 0.8, 0.78]);
  m.caixa(0, 0, 2.5, 1.1, 0.12, 0.5, [0.9, 0.9, 0.88]);
  return m.dados();
}

// ------------------------------------------------------------------ render

export function criarRender(canvas) {
  const gl = canvas.getContext('webgl2', {
    antialias: true, alpha: false, depth: true, powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('este jogo precisa de WebGL2');

  const progCena = programa(gl, VS_CENA, FS_CENA);
  const progCeu = programa(gl, VS_CEU, FS_CEU);
  const progParticula = programa(gl, VS_PARTICULA, FS_PARTICULA);

  const uCena = {
    vistaProjecao: gl.getUniformLocation(progCena, 'uVistaProjecao'),
    modelo: gl.getUniformLocation(progCena, 'uModelo'),
    luz: gl.getUniformLocation(progCena, 'uLuz'),
    neblina: gl.getUniformLocation(progCena, 'uNeblina'),
    densidade: gl.getUniformLocation(progCena, 'uDensidadeNeblina'),
    corExtra: gl.getUniformLocation(progCena, 'uCorExtra'),
    misturaExtra: gl.getUniformLocation(progCena, 'uMisturaExtra'),
    brilho: gl.getUniformLocation(progCena, 'uBrilho'),
  };
  const uCeu = {
    alto: gl.getUniformLocation(progCeu, 'uAlto'),
    baixo: gl.getUniformLocation(progCeu, 'uBaixo'),
  };
  const uParticula = {
    vistaProjecao: gl.getUniformLocation(progParticula, 'uVistaProjecao'),
    escala: gl.getUniformLocation(progParticula, 'uEscalaTela'),
  };

  function subirMalha(dados) {
    const n = dados.vertices;
    const buf = new Float32Array(n * 9);
    for (let i = 0; i < n; i++) {
      buf[i * 9] = dados.pos[i * 3];
      buf[i * 9 + 1] = dados.pos[i * 3 + 1];
      buf[i * 9 + 2] = dados.pos[i * 3 + 2];
      buf[i * 9 + 3] = dados.nor[i * 3];
      buf[i * 9 + 4] = dados.nor[i * 3 + 1];
      buf[i * 9 + 5] = dados.nor[i * 3 + 2];
      buf[i * 9 + 6] = dados.cores[i * 3];
      buf[i * 9 + 7] = dados.cores[i * 3 + 1];
      buf[i * 9 + 8] = dados.cores[i * 3 + 2];
    }
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
    const passo = 9 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, passo, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, passo, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, passo, 24);
    gl.bindVertexArray(null);
    return { vao, vbo, vertices: n };
  }

  const corpo = subirMalha(malhaDoCorpo());
  const rodaMalha = subirMalha(malhaDaRoda());
  const caixaMalha = subirMalha(malhaDaCaixa());
  const posteMalha = subirMalha(malhaDoPoste());

  // ceu: um quadrado em coordenada de tela
  const ceuVao = gl.createVertexArray();
  {
    const vbo = gl.createBuffer();
    gl.bindVertexArray(ceuVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  // particulas: um buffer dinamico
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

  let pista = null;
  let linha = null;
  let paleta = null;
  let fita = null;
  let cenario = null;
  let postes = [];
  let camera = null;
  let tempo = 0;

  // Altura do piso do vale: 3,4 m abaixo do ponto mais baixo do circuito. A
  // fita e o cenario leem a MESMA conta, senao a arvore fica enterrada ou no ar.
  function pisoDoVale() {
    let menor = Infinity;
    for (const c of pista.centro) menor = Math.min(menor, c.z);
    return menor - 3.4;
  }

  // A fita: uma secao transversal por amostra da pista, com grama, zebra,
  // asfalto, zebra, grama e os dois muros. As cores vao no vertice — nao ha
  // textura nenhuma neste jogo.
  function construirFita() {
    const m = criarMalha();
    const n = pista.centro.length;
    const asfalto = cor(paleta.asfalto);
    const zebraA = cor(paleta.zebra);
    const zebraB = [0.92, 0.92, 0.9];
    const grama = cor(paleta.grama);
    const gramaEscura = grama.map(v => v * 0.82);
    const linhaCor = cor(paleta.linha);
    const muroCor = [0.74, 0.73, 0.7];

    // Chao do vale: um piso comum abaixo do ponto mais baixo do circuito, para
    // onde a saia de grama desce. Sem isto o circuito flutuava — a fita
    // terminava no ar a 7 m da zebra, e a parte alta da pista parecia uma ponte
    // sem apoio.
    const fundo = pisoDoVale();

    const ponto = (i, lateral, subir = 0) => {
      const c = pista.centro[i % n];
      const nx = -Math.sin(c.ang);
      const ny = Math.cos(c.ang);
      const forada = Math.max(0, Math.abs(lateral) - c.largura / 2 - LIMITE_ZEBRA);
      const queda = forada > 0 ? -QUEDA_DA_GRAMA * Math.min(1, forada / 2) : 0;
      return [
        c.x + nx * lateral,
        c.y + ny * lateral,
        c.z + lateral * c.inclinacao * 0.5 + queda + subir,
      ];
    };

    // Quanto a geometria pode avancar para fora sem dobrar sobre si mesma. No
    // lado de DENTRO de uma curva, tudo que passa do centro de curvatura se
    // inverte: a saia de grama de 26 m no grampo de 10 m da SERRA virava um
    // leque de triangulos gigantes atravessando a pista — um quadrado preto no
    // meio da tela, que foi assim que o defeito apareceu.
    const alcance = (c, lado, pedido) => {
      const k = Math.abs(c.curvatura);
      if (k < 1e-6 || Math.sign(c.curvatura) !== lado) return pedido;
      const raio = 1 / k;
      return Math.max(0, Math.min(pedido, raio * 0.8 - c.largura / 2 - 0.5));
    };

    // Piso do vale: um quadrado que cobre o circuito inteiro com folga. E o que
    // faz o cenario ter onde ficar — antes disto a arvore e o armazem do lado de
    // dentro de uma curva apareciam pendurados no ceu, porque a saia de grama
    // termina num anel e depois dele nao havia nada.
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const c of pista.centro) {
      xMin = Math.min(xMin, c.x); xMax = Math.max(xMax, c.x);
      yMin = Math.min(yMin, c.y); yMax = Math.max(yMax, c.y);
    }
    const folga = 120;
    m.quadrilatero(
      [xMin - folga, yMin - folga, fundo], [xMax + folga, yMin - folga, fundo],
      [xMax + folga, yMax + folga, fundo], [xMin - folga, yMax + folga, fundo],
      gramaEscura.map(v => v * 0.92),
    );

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const c = pista.centro[i];
      const d = pista.centro[j];
      const meia = c.largura / 2;
      const meiaProxima = d.largura / 2;
      const zebrado = Math.floor(c.s / 3) % 2 === 0 ? zebraA : zebraB;
      // a largada e uma faixa branca de dois metros
      const naLargada = i < 2 || i === n - 1;
      const pisoCor = naLargada ? linhaCor : asfalto;

      const faixa = (a, b, aProx, bProx, tinta) => {
        m.quadrilatero(ponto(i, a), ponto(j, aProx), ponto(j, bProx), ponto(i, b), tinta);
      };
      // grama dos dois lados, com a largura que cabe naquela curva
      for (const lado of [-1, 1]) {
        const gramaAqui = alcance(c, lado, LIMITE_GRAMA);
        const gramaProx = alcance(d, lado, LIMITE_GRAMA);
        if (gramaAqui <= LIMITE_ZEBRA + 0.1) continue;
        faixa(lado * (meia + LIMITE_ZEBRA), lado * (meia + gramaAqui),
          lado * (meiaProxima + LIMITE_ZEBRA), lado * (meiaProxima + gramaProx),
          i % 8 < 4 ? grama : gramaEscura);
      }
      // zebra
      faixa(-meia - LIMITE_ZEBRA, -meia, -meiaProxima - LIMITE_ZEBRA, -meiaProxima, zebrado);
      faixa(meia, meia + LIMITE_ZEBRA, meiaProxima, meiaProxima + LIMITE_ZEBRA, zebrado);
      // asfalto, em duas metades para a normal acompanhar a sobrelevacao
      faixa(-meia, 0, -meiaProxima, 0, pisoCor);
      faixa(0, meia, 0, meiaProxima, pisoCor);

      // Saia de grama: desce da borda externa ate o chao do vale. E o que
      // impede o circuito de terminar no ar quando visto de longe.
      for (const lado of [-1, 1]) {
        // 34 m: mais longe que a arvore mais distante que `construirCenario`
        // planta (31 m), senao o cenario aparece flutuando sobre o nada.
        const larguraDaSaia = alcance(c, lado, 34) - LIMITE_GRAMA;
        if (larguraDaSaia < 1) continue;
        const a = ponto(i, lado * (meia + LIMITE_GRAMA));
        const b = ponto(j, lado * (meiaProxima + LIMITE_GRAMA));
        const aFundo = [
          a[0] - Math.sin(c.ang) * lado * larguraDaSaia,
          a[1] + Math.cos(c.ang) * lado * larguraDaSaia, fundo,
        ];
        const bFundo = [
          b[0] - Math.sin(d.ang) * lado * larguraDaSaia,
          b[1] + Math.cos(d.ang) * lado * larguraDaSaia, fundo,
        ];
        if (lado > 0) m.quadrilatero(a, b, bFundo, aFundo, gramaEscura);
        else m.quadrilatero(b, a, aFundo, bFundo, gramaEscura);
      }

      // muro: so onde a pista e apertada, porque muro em pista larga fecha a
      // vista de quem esta dirigindo
      if (c.largura < 9.6) {
        for (const lado of [-1, 1]) {
          const ondeAqui = alcance(c, lado, LIMITE_GRAMA);
          const ondeProx = alcance(d, lado, LIMITE_GRAMA);
          if (ondeAqui <= LIMITE_ZEBRA + 0.1) continue;
          const a = ponto(i, lado * (meia + ondeAqui));
          const b = ponto(j, lado * (meiaProxima + ondeProx));
          const aAlto = [a[0], a[1], a[2] + ALTURA_DO_MURO];
          const bAlto = [b[0], b[1], b[2] + ALTURA_DO_MURO];
          if (lado < 0) m.quadrilatero(a, b, bAlto, aAlto, muroCor);
          else m.quadrilatero(b, a, aAlto, bAlto, muroCor);
          m.quadrilatero(
            [aAlto[0], aAlto[1], aAlto[2]], [bAlto[0], bAlto[1], bAlto[2]],
            [bAlto[0] - Math.sin(d.ang) * lado * 0.2, bAlto[1] + Math.cos(d.ang) * lado * 0.2, bAlto[2]],
            [aAlto[0] - Math.sin(c.ang) * lado * 0.2, aAlto[1] + Math.cos(c.ang) * lado * 0.2, aAlto[2]],
            [0.88, 0.32, 0.28],
          );
        }
      }
    }
    return subirMalha(m.dados());
  }

  function construirPostes() {
    const n = pista.centro.length;
    const saida = [];
    for (let i = 0; i < n; i += Math.round(26 / pista.passo)) {
      const c = pista.centro[i];
      const nx = -Math.sin(c.ang);
      const ny = Math.cos(c.ang);
      const lado = (i / Math.round(26 / pista.passo)) % 2 ? 1 : -1;
      const lateral = lado * (c.largura / 2 + LIMITE_GRAMA - 0.6);
      saida.push({
        x: c.x + nx * lateral,
        y: c.y + ny * lateral,
        z: c.z + lateral * c.inclinacao * 0.5 - QUEDA_DA_GRAMA,
        ang: c.ang,
      });
    }
    return saida;
  }

  // Cenario: assado numa malha so. Trinta arvores como trinta desenhos seria
  // trinta chamadas por quadro para nada — nada disso se move, entao tudo vira
  // um unico buffer estatico junto com a fita.
  //
  // Cada pista declara o seu tema em `pista.cenario`, e o tema nao e enfeite: e
  // ele que da ao jogador a referencia de distancia que uma fita de asfalto
  // sozinha nao da. Dirigir num circuito vazio e dirigir sem saber quanto falta
  // para a curva.
  function construirCenario() {
    const m = criarMalha();
    const n = pista.centro.length;
    const grama = cor(paleta.grama);
    // O cenario nasce no piso do vale, e nao na altura da pista ao lado: pista
    // com 15 m de desnivel tem trecho alto, e arvore plantada na altura do
    // trecho alto fica no ar. Aqui o circuito passa por cima do terreno, o que e
    // exatamente o que um viaduto e.
    const fundo = pisoDoVale();
    const semente = { v: pista.nome.length * 7717 + 13 };
    const sortear = () => {
      semente.v = (semente.v * 1103515245 + 12345) & 0x7fffffff;
      return semente.v / 0x7fffffff;
    };

    const arvore = (x, y, z, escala, folha) => {
      m.caixa(x, y, z + 1.3 * escala, 0.42 * escala, 0.42 * escala, 2.6 * escala,
        [0.28, 0.2, 0.14]);
      m.caixa(x, y, z + 3.6 * escala, 3.1 * escala, 3.1 * escala, 2.6 * escala,
        folha, folha.map(v => Math.min(1, v * 1.25)));
      m.caixa(x, y, z + 5.4 * escala, 1.9 * escala, 1.9 * escala, 1.6 * escala,
        folha.map(v => v * 0.86), folha);
    };
    const cana = (x, y, z, escala) => {
      for (let k = 0; k < 4; k++) {
        const dx = (sortear() - 0.5) * 3.4;
        const dy = (sortear() - 0.5) * 3.4;
        const alta = (1.8 + sortear() * 1.4) * escala;
        m.caixa(x + dx, y + dy, z + alta / 2, 0.5, 0.5, alta,
          [0.44, 0.5, 0.2], [0.62, 0.68, 0.3]);
      }
    };
    const armazem = (x, y, z, ang, escala) => {
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const largura = (5 + sortear() * 3.5) * escala;
      const profundidade = (6 + sortear() * 4.5) * escala;
      const alta = (3.5 + sortear() * 2.5) * escala;
      const tinta = [0.46 + sortear() * 0.2, 0.46 + sortear() * 0.16, 0.44];
      // caixa girada: monta os oito vertices a mao, porque `m.caixa` e alinhada
      const canto = (dx, dy, dz) => [
        x + c * dx - s * dy, y + s * dx + c * dy, z + dz,
      ];
      const a = canto(-profundidade / 2, -largura / 2, 0);
      const b = canto(profundidade / 2, -largura / 2, 0);
      const cc = canto(profundidade / 2, largura / 2, 0);
      const d = canto(-profundidade / 2, largura / 2, 0);
      const aA = canto(-profundidade / 2, -largura / 2, alta);
      const bA = canto(profundidade / 2, -largura / 2, alta);
      const cA = canto(profundidade / 2, largura / 2, alta);
      const dA = canto(-profundidade / 2, largura / 2, alta);
      m.quadrilatero(aA, bA, cA, dA, tinta.map(v => v * 1.12));
      m.quadrilatero(a, b, bA, aA, tinta);
      m.quadrilatero(cc, d, dA, cA, tinta);
      m.quadrilatero(b, cc, cA, bA, tinta.map(v => v * 0.86));
      m.quadrilatero(d, a, aA, dA, tinta.map(v => v * 0.86));
      // porta
      const p1 = canto(profundidade / 2 + 0.05, -largura * 0.2, 0);
      const p2 = canto(profundidade / 2 + 0.05, largura * 0.2, 0);
      const p3 = canto(profundidade / 2 + 0.05, largura * 0.2, alta * 0.6);
      const p4 = canto(profundidade / 2 + 0.05, -largura * 0.2, alta * 0.6);
      m.quadrilatero(p1, p2, p3, p4, [0.2, 0.21, 0.24]);
    };
    const cupinzeiro = (x, y, z, escala) => {
      m.caixa(x, y, z + 0.8 * escala, 1.5 * escala, 1.5 * escala, 1.6 * escala,
        [0.5, 0.36, 0.22], [0.58, 0.42, 0.26]);
      m.caixa(x, y, z + 2 * escala, 0.8 * escala, 0.8 * escala, 1.2 * escala,
        [0.46, 0.33, 0.2]);
    };

    const passoDoCenario = Math.max(4, Math.round(11 / pista.passo));
    for (let i = 0; i < n; i += passoDoCenario) {
      const c = pista.centro[i];
      const nx = -Math.sin(c.ang);
      const ny = Math.cos(c.ang);
      for (const lado of [-1, 1]) {
        if (sortear() > 0.62) continue;
        // 6 m depois do muro, e nao 3: a camera de perseguicao fica 4,4 m atras
        // do kart e pode passar por fora da fita numa curva — com 3 m, uma copa
        // de arvore entrava na lente e virava um triangulo preto na tela.
        const pedido = c.largura / 2 + LIMITE_GRAMA + 6 + sortear() * 18;
        const k = Math.abs(c.curvatura);
        // No lado de dentro da curva o chao acaba antes: a arvore nao pode ser
        // plantada onde a saia de grama nao chega, senao ela fica no ar.
        const cabe = k < 1e-6 || Math.sign(c.curvatura) !== lado
          ? pedido
          : Math.min(pedido, (1 / k) * 0.8 - c.largura / 2 - 0.5);
        if (cabe < c.largura / 2 + LIMITE_GRAMA + 4) continue;
        const lateral = lado * cabe;
        const x = c.x + nx * lateral;
        const y = c.y + ny * lateral;
        const z = fundo;
        const escala = 0.75 + sortear() * 0.6;
        if (pista.cenario === 'armazem') armazem(x, y, z, c.ang + (sortear() - 0.5) * 0.5, escala);
        else if (pista.cenario === 'cana') cana(x, y, z, escala);
        else if (pista.cenario === 'cupinzeiro') cupinzeiro(x, y, z, escala);
        else arvore(x, y, z, escala, grama.map(v => v * (0.75 + sortear() * 0.5)));
      }
    }
    const malha = subirMalha(m.dados());
    // `?depurar` conta o que foi construido, para a conferencia visual poder
    // afirmar "esta pista tem armazem" em vez de achar pela cor.
    if (typeof location !== 'undefined'
      && new URLSearchParams(location.search).has('depurar')) {
      window.__cenario = { tema: pista.cenario, vertices: malha.vertices };
    }
    return malha;
  }

  function trocarPista(novaPista, novaLinha) {
    for (const malha of [fita, cenario]) {
      if (!malha) continue;
      gl.deleteBuffer(malha.vbo);
      gl.deleteVertexArray(malha.vao);
    }
    pista = novaPista;
    linha = novaLinha;
    paleta = novaPista.paleta;
    fita = construirFita();
    cenario = construirCenario();
    postes = construirPostes();
    particulas.length = 0;
    camera = null;
  }

  function soltarParticula(x, y, z, vx, vy, vz, tinta, vida, tamanho) {
    if (particulas.length >= MAX_PARTICULAS) particulas.shift();
    particulas.push({ x, y, z, vx, vy, vz, tinta, vida, vidaMax: vida, tamanho });
  }

  function marcarPneu(carro) {
    // Fagulha de mini-turbo: a cor conta a faixa de carga, e e a unica leitura
    // que o jogador tem de quanto turbo ele ja guardou.
    const faixa = carro.faixaDeCarga || 0;
    if (faixa > 0 && Math.random() < 0.55) {
      const tinta = faixa === 1 ? [1, 0.55, 0.2, 1]
        : faixa === 2 ? [1, 0.85, 0.25, 1] : [0.45, 0.8, 1, 1];
      for (const lado of [-1, 1]) {
        const c = Math.cos(carro.ang);
        const s = Math.sin(carro.ang);
        soltarParticula(
          carro.x - c * 0.7 - s * lado * 0.45,
          carro.y - s * 0.7 + c * lado * 0.45,
          carro.z + 0.12,
          -c * 3 + (Math.random() - 0.5) * 3,
          -s * 3 + (Math.random() - 0.5) * 3,
          1.4 + Math.random() * 2.4,
          tinta, 0.34, 26,
        );
      }
    }
    if (carro.turbo > 0 && Math.random() < 0.7) {
      const c = Math.cos(carro.ang);
      const s = Math.sin(carro.ang);
      soltarParticula(
        carro.x - c * 1.0, carro.y - s * 1.0, carro.z + 0.3,
        -c * 6 + (Math.random() - 0.5) * 2, -s * 6 + (Math.random() - 0.5) * 2,
        0.8 + Math.random(),
        [0.6, 0.85, 1, 0.9], 0.3, 34,
      );
    }
    if (carro.derrapagem > 0.35 && Math.random() < carro.derrapagem * 0.6) {
      const c = Math.cos(carro.ang);
      const s = Math.sin(carro.ang);
      soltarParticula(
        carro.x - c * 0.8 + (Math.random() - 0.5) * 0.8,
        carro.y - s * 0.8 + (Math.random() - 0.5) * 0.8,
        carro.z + 0.16,
        (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, 0.9 + Math.random(),
        [0.78, 0.78, 0.76, 0.5], 0.75, 40,
      );
    }
  }

  function poeira(carro, tipo) {
    const tinta = tipo === 'grama' ? [...cor(paleta.grama), 0.75] : [0.7, 0.68, 0.62, 0.7];
    soltarParticula(
      carro.x + (Math.random() - 0.5) * 1.2, carro.y + (Math.random() - 0.5) * 1.2,
      carro.z + 0.1,
      (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2,
      tinta, 0.6, 44,
    );
  }

  function passoParticulas(dt) {
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dt;
      if (p.vida <= 0) { particulas.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vz -= 6 * dt;
      p.vx *= 1 - 1.6 * dt;
      p.vy *= 1 - 1.6 * dt;
    }
  }

  function chaoEm(x, y) {
    // Altura aproximada do chao para a camera: a mesma conta da pista, sem
    // procurar de novo o indice (a camera segue o kart, que ja sabe onde esta).
    return 0;
  }

  function atualizarCamera(jogador, dt, opcoes) {
    const velocidade = Math.hypot(jogador.vx, jogador.vy);
    // 4,4 m atras e 1,75 m acima: um kart tem 1,7 m de comprimento, e com os
    // 6,4 m da primeira versao ele virava um ponto na tela. A camera abre com a
    // velocidade (ate 6,6 m) porque a 100 km/h o jogador precisa ver mais pista
    // do que kart.
    const recuo = opcoes.cockpit ? -0.3 : 4.4 + Math.min(2.2, velocidade * 0.09);
    const altura = opcoes.cockpit ? 1.02 : 1.75 + Math.min(0.8, velocidade * 0.025);
    const c = Math.cos(jogador.ang);
    const s = Math.sin(jogador.ang);
    const alvo = {
      x: jogador.x - c * recuo,
      y: jogador.y - s * recuo,
      z: jogador.z + altura,
      olhoX: jogador.x + c * 9,
      olhoY: jogador.y + s * 9,
      olhoZ: jogador.z + 0.75,
    };
    if (!camera) camera = { ...alvo };
    // Camera segue com atraso, e o atraso e maior na posicao do que no alvo:
    // sem isso, derrapar gira a tela junto com o kart e o jogador perde a
    // referencia de para onde a pista vai.
    const k = opcoes.cockpit ? 1 : Math.min(1, dt * 7.5);
    const ko = Math.min(1, dt * 10);
    camera.x += (alvo.x - camera.x) * k;
    camera.y += (alvo.y - camera.y) * k;
    camera.z += (alvo.z - camera.z) * k;
    camera.olhoX += (alvo.olhoX - camera.olhoX) * ko;
    camera.olhoY += (alvo.olhoY - camera.olhoY) * ko;
    camera.olhoZ += (alvo.olhoZ - camera.olhoZ) * ko;
  }

  function desenharMalha(malha, matriz, tinta, mistura) {
    gl.uniformMatrix4fv(uCena.modelo, false, matriz);
    gl.uniform3f(uCena.corExtra, tinta[0], tinta[1], tinta[2]);
    gl.uniform1f(uCena.misturaExtra, mistura);
    gl.bindVertexArray(malha.vao);
    gl.drawArrays(gl.TRIANGLES, 0, malha.vertices);
  }

  const IDENTIDADE = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

  function desenhar(corrida, dt, opcoes = {}) {
    tempo += dt;
    const largura = canvas.width;
    const altura = canvas.height;
    gl.viewport(0, 0, largura, altura);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.disable(gl.BLEND);

    const jogador = corrida.carros[0];
    passoParticulas(dt);
    atualizarCamera(jogador, dt || 1 / 60, opcoes);

    // ceu primeiro, com o teste de profundidade escrevendo o fundo
    gl.depthMask(false);
    gl.useProgram(progCeu);
    const alto = cor(paleta.ceu);
    const baixo = cor(paleta.ceuBaixo);
    gl.uniform3f(uCeu.alto, alto[0], alto[1], alto[2]);
    gl.uniform3f(uCeu.baixo, baixo[0], baixo[1], baixo[2]);
    gl.bindVertexArray(ceuVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    const projecao = perspectiva(
      (opcoes.cockpit ? 78 : 68) * Math.PI / 180,
      Math.max(0.4, largura / Math.max(1, altura)), 0.35, 420,
    );
    const vista = olhar(
      [camera.x, camera.y, camera.z],
      [camera.olhoX, camera.olhoY, camera.olhoZ],
      [0, 0, 1],
    );
    const vistaProjecao = multiplicar(projecao, vista);

    gl.useProgram(progCena);
    gl.uniformMatrix4fv(uCena.vistaProjecao, false, vistaProjecao);
    gl.uniform3f(uCena.luz, 0.42, 0.28, 0.86);
    const neblina = cor(paleta.neblina);
    gl.uniform3f(uCena.neblina, neblina[0], neblina[1], neblina[2]);
    gl.uniform1f(uCena.densidade, 0.0058);
    gl.uniform1f(uCena.brilho, 1);

    desenharMalha(fita, IDENTIDADE, [0, 0, 0], 0);
    desenharMalha(cenario, IDENTIDADE, [0, 0, 0], 0);

    for (const poste of postes) {
      desenharMalha(posteMalha,
        matrizDoKart(poste.x, poste.y, poste.z, poste.ang, 0, 0), [0, 0, 0], 0);
    }

    for (const caixa of pista.caixas) {
      if (!caixa.cheia) continue;
      const giro = tempo * 2.2 + caixa.x * 0.1;
      desenharMalha(caixaMalha,
        matrizDoKart(caixa.x, caixa.y, caixa.z + 0.75 + Math.sin(tempo * 2 + caixa.y) * 0.12,
          giro, 0, 0.35), [0, 0, 0], 0);
    }

    for (const banana of corrida.bananas) {
      desenharMalha(caixaMalha,
        matrizDoKart(banana.x, banana.y, banana.z + 0.2, tempo, 0, 0, 0.42),
        [0.95, 0.85, 0.2], 0.85);
    }
    for (const casco of corrida.cascos) {
      desenharMalha(caixaMalha,
        matrizDoKart(casco.x, casco.y, casco.z + 0.28, tempo * 6, 0, 0, 0.5),
        [0.2, 0.5, 0.95], 0.8);
    }

    // karts: o de tras primeiro nao importa (ha z-buffer), mas o jogador e
    // desenhado por ultimo para as fagulhas dele ficarem por cima
    const ordenados = [...corrida.carros].reverse();
    for (const carro of ordenados) {
      // Kart em cima da lente vira borrao geometrico: quem esta a menos de 1,4 m
      // da camera e cortado pelo plano proximo e aparece esticado na tela.
      if (Math.hypot(carro.x - camera.x, carro.y - camera.y, carro.z - camera.z) < 1.4) {
        continue;
      }
      const rolagem = -(carro.inclinacaoDoChao || 0) + (carro.rodopio > 0 ? Math.sin(tempo * 30) * 0.06 : 0);
      const arfagem = -(carro.subidaDoChao || 0) * 0.8;
      const corpoMatriz = matrizDoKart(carro.x, carro.y, carro.z, carro.ang, rolagem, arfagem);
      const tinta = cor(carro.cor);
      desenharMalha(corpo, corpoMatriz, tinta, 0.55);

      const giroRoda = (carro.giroDaRoda || 0);
      const esterco = (carro.ultimoVolante || 0) * 0.42;
      for (const [dx, dy, frente] of [
        [0.62, -0.5, true], [0.62, 0.5, true], [-0.6, -0.56, false], [-0.6, 0.56, false],
      ]) {
        const local = matrizDoKart(dx, dy, 0.14, frente ? esterco : 0, 0, giroRoda, 1);
        desenharMalha(rodaMalha, multiplicar(corpoMatriz, local), [0.05, 0.05, 0.06], 0.2);
      }
    }

    // particulas por cima, com mistura aditiva suave
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
        parBuf[k + 7] = p.tamanho * (0.5 + f * 0.7);
      }
      gl.useProgram(progParticula);
      gl.uniformMatrix4fv(uParticula.vistaProjecao, false, vistaProjecao);
      gl.uniform1f(uParticula.escala, altura * 0.42);
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
  }

  // Mapa: 2D mesmo, num canvas separado por cima. Traçado de volta inteira em
  // perspectiva nao ajuda ninguem a saber onde esta a proxima curva.
  function desenharMapa(tela2d, corrida, jogador) {
    const ctx = tela2d.getContext('2d');
    const L = tela2d.width;
    const A = tela2d.height;
    ctx.clearRect(0, 0, L, A);
    if (!pista) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const c of pista.centro) {
      minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
    }
    const escala = Math.min((L - 10) / (maxX - minX), (A - 10) / (maxY - minY));
    const px = (x) => (x - (minX + maxX) / 2) * escala + L / 2;
    const py = (y) => A / 2 - (y - (minY + maxY) / 2) * escala;
    ctx.lineWidth = Math.max(2.5, pista.centro[0].largura * escala * 0.7);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    for (const [i, c] of pista.centro.entries()) {
      if (i === 0) ctx.moveTo(px(c.x), py(c.y));
      else ctx.lineTo(px(c.x), py(c.y));
    }
    ctx.closePath();
    ctx.stroke();
    for (const carro of corrida.carros) {
      ctx.fillStyle = carro === jogador ? '#ffe45c' : carro.cor;
      ctx.beginPath();
      ctx.arc(px(carro.x), py(carro.y), carro === jogador ? 3.6 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function redimensionar(largura, altura) {
    canvas.width = largura;
    canvas.height = altura;
  }

  return { trocarPista, desenhar, desenharMapa, marcarPneu, poeira, redimensionar };
}
