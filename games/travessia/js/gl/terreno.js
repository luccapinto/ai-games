// O chao do sertao virado em malha: relevo que ja existe no mundo, esculpido
// em quadrados facetados com cor por vertice e nenhuma textura.
//
// Duas decisoes que mandam no resultado:
//
// 1. A serra ganha um realce de altura acima do corte que o gerador usou para
//    separar serra de caatinga. Sem isso o relevo do mundo e suave demais e a
//    serra — que e parede intransponivel no jogo — nao aparecia de longe.
// 2. O leito do rio afunda por NO, e nao por celula. Afundar por celula abre
//    fenda vertical na margem; afundando o no, a margem desce em rampa e a
//    agua enche o vale sozinha.
//
// A malha e cortada em pedacos de 32 celulas, com duas resolucoes. Perto sai a
// fina, longe a grossa, e o que esta fora do tronco de visao nao sai.

import { TERRENOS } from '../mundo.js';
import { criarBuffer, criarVao } from './contexto.js';
import { UNIFORMES_DE_LUZ, FUNCOES_DE_LUZ } from './luz.js';

export const ESCALA_DE_ALTURA = 22;
const REALCE_DA_SERRA = 46;
const FUNDO_DO_RIO = 1.15;
const NIVEL_DA_AGUA = 0.12;
export const LADO_DO_PEDACO = 32;

// caatinga seca, nunca verde-viva; salina que estoura no sol; serra parda
const CORES = {
  [TERRENOS.caatinga]: [[0.541, 0.478, 0.306], [0.659, 0.565, 0.376]],
  [TERRENOS.mata]: [[0.247, 0.318, 0.188], [0.322, 0.396, 0.235]],
  [TERRENOS.roca]: [[0.612, 0.541, 0.322], [0.706, 0.624, 0.392]],
  [TERRENOS.salina]: [[0.808, 0.784, 0.722], [0.886, 0.867, 0.812]],
  [TERRENOS.serra]: [[0.361, 0.318, 0.278], [0.478, 0.443, 0.396]],
  [TERRENOS.agua]: [[0.208, 0.271, 0.259], [0.161, 0.216, 0.220]],
};
const COR_DA_ESTRADA = [0.769, 0.682, 0.494];

const embaralhar = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

// ------------------------------------------------------------------ campo

// Alturas por NO da grade. O mundo tem 256x256 celulas; os nos sao os mesmos
// 256x256 pontos, e a celula (x,y) usa os nos (x,y) ate (x+1,y+1).
export function criarCampoDeAltura(mundo) {
  const { largura, altura, relevo, terreno } = mundo;
  let corteSerra = Infinity;
  for (let i = 0; i < terreno.length; i++) {
    if (terreno[i] === TERRENOS.serra && relevo[i] < corteSerra) corteSerra = relevo[i];
  }
  if (!Number.isFinite(corteSerra)) corteSerra = 1;

  const base = new Float32Array(largura * altura);
  for (let i = 0; i < base.length; i++) {
    const h = relevo[i];
    base[i] = h * ESCALA_DE_ALTURA + Math.max(0, h - corteSerra) * REALCE_DA_SERRA;
  }

  // fundo do rio, por no: media das quatro celulas que encostam nele
  const chao = new Float32Array(largura * altura);
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      let molhadas = 0;
      for (let dy = -1; dy <= 0; dy++) {
        for (let dx = -1; dx <= 0; dx++) {
          const cx = Math.min(largura - 1, Math.max(0, x + dx));
          const cy = Math.min(altura - 1, Math.max(0, y + dy));
          if (terreno[cy * largura + cx] === TERRENOS.agua) molhadas++;
        }
      }
      // So o miolo do rio afunda. Afundando tambem a margem, o jogador andando
      // na beira ficava com agua pelo joelho — a captura de tela pegou isso.
      const cava = molhadas === 4 ? 1 : molhadas === 3 ? 0.5 : 0;
      chao[y * largura + x] = base[y * largura + x] - FUNDO_DO_RIO * cava;
    }
  }

  const amostrar = (campo, px, py) => {
    const x = Math.min(largura - 1.001, Math.max(0, px));
    const y = Math.min(altura - 1.001, Math.max(0, py));
    const x0 = x | 0;
    const y0 = y | 0;
    const fx = x - x0;
    const fy = y - y0;
    const i = y0 * largura + x0;
    const a = campo[i] + (campo[i + 1] - campo[i]) * fx;
    const b = campo[i + largura] + (campo[i + largura + 1] - campo[i + largura]) * fx;
    return a + (b - a) * fy;
  };

  return {
    corteSerra,
    base,
    chao,
    largura,
    altura,
    // altura do chao pisavel num ponto qualquer do mundo
    em: (px, py) => amostrar(chao, px, py),
    // altura da superficie da agua no mesmo ponto
    daAgua: (px, py) => amostrar(base, px, py) + NIVEL_DA_AGUA,
  };
}

// ------------------------------------------------------------------ malha

function corDaCelula(mundo, campo, x, y) {
  const i = y * mundo.largura + x;
  const tipo = mundo.terreno[i];
  const paleta = CORES[tipo] || CORES[TERRENOS.caatinga];
  // Variacao so por celula virava tabuleiro de xadrez na captura de tela.
  // Dois tercos da mistura vem da umidade, que e um campo liso, e um terco do
  // embaralhado da celula: o chao ganha mancha grande em vez de quadriculado.
  const k = mundo.umidade[i] * 0.66 + embaralhar(x, y) * 0.34;
  let r = paleta[0][0] + (paleta[1][0] - paleta[0][0]) * k;
  let g = paleta[0][1] + (paleta[1][1] - paleta[0][1]) * k;
  let b = paleta[0][2] + (paleta[1][2] - paleta[0][2]) * k;

  if (tipo === TERRENOS.serra) {
    // topo de serra clareia: e o que da volume a silhueta contra o ceu
    const topo = Math.min(1, Math.max(0, (campo.base[i] - campo.corteSerra * ESCALA_DE_ALTURA) / 34));
    r += (0.549 - r) * topo * 0.8;
    g += (0.498 - g) * topo * 0.8;
    b += (0.427 - b) * topo * 0.8;
  }
  if (mundo.estrada[i] === 1) {
    r += (COR_DA_ESTRADA[0] - r) * 0.68;
    g += (COR_DA_ESTRADA[1] - g) * 0.68;
    b += (COR_DA_ESTRADA[2] - b) * 0.68;
  }
  // sRGB na paleta, linear na malha: a luz multiplica em linear.
  return [r ** 2.2, g ** 2.2, b ** 2.2];
}

function montarMalha(mundo, campo, passo) {
  const { largura, altura } = mundo;
  const pedacosPorLado = Math.ceil((largura - 1) / LADO_DO_PEDACO);
  const celulas = Math.floor((largura - 1) / passo) * Math.floor((altura - 1) / passo);
  const dados = new Float32Array(celulas * 6 * 9);
  const pedacos = [];
  let n = 0;

  const escrever = (x, y, z, nx, ny, nz, cor) => {
    dados[n] = x; dados[n + 1] = y; dados[n + 2] = z;
    dados[n + 3] = nx; dados[n + 4] = ny; dados[n + 5] = nz;
    dados[n + 6] = cor[0]; dados[n + 7] = cor[1]; dados[n + 8] = cor[2];
    n += 9;
  };

  for (let py = 0; py < pedacosPorLado; py++) {
    for (let px = 0; px < pedacosPorLado; px++) {
      const inicio = n / 9;
      let minY = Infinity;
      let maxY = -Infinity;
      const x0 = px * LADO_DO_PEDACO;
      const y0 = py * LADO_DO_PEDACO;
      for (let y = y0; y < Math.min(y0 + LADO_DO_PEDACO, altura - 1); y += passo) {
        for (let x = x0; x < Math.min(x0 + LADO_DO_PEDACO, largura - 1); x += passo) {
          const x1 = Math.min(x + passo, largura - 1);
          const y1 = Math.min(y + passo, altura - 1);
          const ha = campo.chao[y * largura + x];
          const hb = campo.chao[y * largura + x1];
          const hc = campo.chao[y1 * largura + x];
          const hd = campo.chao[y1 * largura + x1];
          const cor = corDaCelula(mundo, campo, x, y);
          if (ha < minY) minY = ha;
          if (hd < minY) minY = hd;
          if (ha > maxY) maxY = ha;
          if (hd > maxY) maxY = hd;

          // triangulo 1: (x,y) (x1,y) (x,y1)
          let ux = x1 - x; let uy = hb - ha; let vz = y1 - y; let vy = hc - ha;
          let nx = -uy * vz;
          let ny = ux * vz;
          let nz = -ux * vy;
          let inv = 1 / (Math.hypot(nx, ny, nz) || 1);
          nx *= inv; ny *= inv; nz *= inv;
          // giro anti-horario visto de cima: e o que deixa ligar o descarte
          // de face de tras sem o chao sumir
          escrever(x, ha, y, nx, ny, nz, cor);
          escrever(x, hc, y1, nx, ny, nz, cor);
          escrever(x1, hb, y, nx, ny, nz, cor);

          // triangulo 2: (x1,y) (x,y1) (x1,y1)
          ux = x1 - x; uy = hd - hc; vz = y1 - y; vy = hd - hb;
          nx = -uy * vz;
          ny = ux * vz;
          nz = -ux * vy;
          inv = 1 / (Math.hypot(nx, ny, nz) || 1);
          nx *= inv; ny *= inv; nz *= inv;
          escrever(x1, hb, y, nx, ny, nz, cor);
          escrever(x, hc, y1, nx, ny, nz, cor);
          escrever(x1, hd, y1, nx, ny, nz, cor);
        }
      }
      const conta = n / 9 - inicio;
      if (!conta) continue;
      pedacos.push({
        px, py, inicio, conta,
        cx: x0 + LADO_DO_PEDACO / 2,
        cz: y0 + LADO_DO_PEDACO / 2,
        cy: (minY + maxY) / 2,
        raio: Math.hypot(LADO_DO_PEDACO, LADO_DO_PEDACO, maxY - minY) / 2 + 1,
      });
    }
  }
  return { dados: dados.subarray(0, n), pedacos, vertices: n / 9 };
}

function montarAgua(mundo, campo) {
  const { largura, altura, terreno } = mundo;
  const pedacosPorLado = Math.ceil((largura - 1) / LADO_DO_PEDACO);
  const lista = [];
  const pedacos = [];
  for (let py = 0; py < pedacosPorLado; py++) {
    for (let px = 0; px < pedacosPorLado; px++) {
      const inicio = lista.length / 3;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let y = py * LADO_DO_PEDACO; y < Math.min((py + 1) * LADO_DO_PEDACO, altura - 1); y++) {
        for (let x = px * LADO_DO_PEDACO; x < Math.min((px + 1) * LADO_DO_PEDACO, largura - 1); x++) {
          if (terreno[y * largura + x] !== TERRENOS.agua) continue;
          const ha = campo.base[y * largura + x] + NIVEL_DA_AGUA;
          const hb = campo.base[y * largura + x + 1] + NIVEL_DA_AGUA;
          const hc = campo.base[(y + 1) * largura + x] + NIVEL_DA_AGUA;
          const hd = campo.base[(y + 1) * largura + x + 1] + NIVEL_DA_AGUA;
          minY = Math.min(minY, ha, hd);
          maxY = Math.max(maxY, ha, hd);
          lista.push(x, ha, y, x, hc, y + 1, x + 1, hb, y);
          lista.push(x + 1, hb, y, x, hc, y + 1, x + 1, hd, y + 1);
        }
      }
      const conta = lista.length / 3 - inicio;
      if (!conta) continue;
      pedacos.push({
        px, py, inicio, conta,
        cx: px * LADO_DO_PEDACO + LADO_DO_PEDACO / 2,
        cz: py * LADO_DO_PEDACO + LADO_DO_PEDACO / 2,
        cy: (minY + maxY) / 2,
        raio: Math.hypot(LADO_DO_PEDACO, LADO_DO_PEDACO) / 2 + 2,
      });
    }
  }
  return { dados: new Float32Array(lista), pedacos };
}

export function construirTerreno(gl, mundo, campo, detalhado) {
  const fina = detalhado ? montarMalha(mundo, campo, 1) : null;
  const grossa = montarMalha(mundo, campo, detalhado ? 2 : 3);
  const agua = montarAgua(mundo, campo);

  const atributos = (buffer) => [
    { buffer, local: 0, tamanho: 3, passo: 9, deslocamento: 0 },
    { buffer, local: 1, tamanho: 3, passo: 9, deslocamento: 3 },
    { buffer, local: 2, tamanho: 3, passo: 9, deslocamento: 6 },
  ];

  const saida = {
    grossa: { ...grossa, vao: criarVao(gl, atributos(criarBuffer(gl, grossa.dados))) },
    agua: {
      ...agua,
      vao: criarVao(gl, [{ buffer: criarBuffer(gl, agua.dados), local: 0, tamanho: 3 }]),
    },
    fina: null,
  };
  if (fina) {
    saida.fina = { ...fina, vao: criarVao(gl, atributos(criarBuffer(gl, fina.dados))) };
  }
  return saida;
}

// --------------------------------------------------------- sombreadores

export const VS_TERRENO = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNor;
layout(location = 2) in vec3 aCor;
uniform mat4 uVP;
out vec3 vNor;
out vec3 vCor;
out vec3 vMundo;
void main() {
  vNor = aNor;
  vCor = aCor;
  vMundo = aPos;
  gl_Position = uVP * vec4(aPos, 1.0);
}`;

export const FS_TERRENO = `#version 300 es
precision highp float;
in vec3 vNor;
in vec3 vCor;
in vec3 vMundo;
out vec4 corSaida;
${UNIFORMES_DE_LUZ}
${FUNCOES_DE_LUZ}
void main() {
  vec3 cor = iluminar(vCor, normalize(vNor), vMundo);
  corSaida = vec4(comNevoa(cor, vMundo), 1.0);
}`;

export const VS_PROFUNDIDADE = `#version 300 es
layout(location = 0) in vec3 aPos;
uniform mat4 uVP;
void main() { gl_Position = uVP * vec4(aPos, 1.0); }`;

export const FS_PROFUNDIDADE = `#version 300 es
precision mediump float;
void main() {}`;

// Agua: onda somada no vertice para a superficie nao ser plana, normal
// derivada no fragmento, reflexo do ceu por Fresnel e brilho que segue o sol.
export const VS_AGUA = `#version 300 es
layout(location = 0) in vec3 aPos;
uniform mat4 uVP;
uniform float uTempo;
out vec3 vMundo;
void main() {
  float onda = sin(aPos.x * 0.7 + uTempo * 1.3) * 0.05
    + sin(aPos.z * 0.9 - uTempo * 1.7) * 0.04
    + sin((aPos.x + aPos.z) * 1.7 + uTempo * 2.6) * 0.022;
  vec3 p = vec3(aPos.x, aPos.y + onda, aPos.z);
  vMundo = p;
  gl_Position = uVP * vec4(p, 1.0);
}`;

export const FS_AGUA = `#version 300 es
precision highp float;
in vec3 vMundo;
out vec4 corSaida;
${UNIFORMES_DE_LUZ}
uniform vec3 uHorizonte;
uniform vec3 uZenite;
uniform vec3 uFundo;
${FUNCOES_DE_LUZ}
void main() {
  float dx = cos(vMundo.x * 0.7 + uTempo * 1.3) * 0.7 * 0.05
    + cos((vMundo.x + vMundo.z) * 1.7 + uTempo * 2.6) * 1.7 * 0.022;
  float dz = cos(vMundo.z * 0.9 - uTempo * 1.7) * 0.9 * -0.04
    + cos((vMundo.x + vMundo.z) * 1.7 + uTempo * 2.6) * 1.7 * 0.022;
  vec3 normal = normalize(vec3(-dx, 1.0, -dz));

  vec3 olho = normalize(uCamera - vMundo);
  float fresnel = pow(1.0 - clamp(dot(olho, normal), 0.0, 1.0), 4.0);
  vec3 refletido = reflect(-olho, normal);
  // O ceu refletido entra tingido de agua: espelhar o ceu cru deixava o rio
  // com cara de concreto claro em vez de agua parada de caatinga.
  vec3 doCeu = mix(uHorizonte, uZenite, clamp(refletido.y, 0.0, 1.0));
  doCeu = mix(doCeu, doCeu * vec3(0.52, 0.78, 0.76), 0.55);

  vec3 corDaAgua = mix(uFundo, doCeu, clamp(0.10 + fresnel * 0.62, 0.0, 1.0));
  float espelho = pow(max(dot(refletido, uSol), 0.0), 190.0);
  corDaAgua += uCorDoSol * espelho * 2.6;
  corDaAgua *= (uCorAmbiente * 0.8 + uCorDoSol * max(dot(normal, uSol), 0.0) * 0.55 + 0.45);

  corSaida = vec4(comNevoa(corDaAgua, vMundo), 0.93);
}`;
