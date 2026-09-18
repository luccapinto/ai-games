// O sertao em tres dimensoes, em WebGL2 escrito a mao — sem biblioteca, sem
// CDN, sem um unico arquivo de textura, modelo, fonte ou som.
//
// A ordem de um quadro e esta:
//
//   1. passada do sol   -> mapa de profundidade 2048 (1024 no celular)
//   2. passada da cena  -> alvo fora da tela: ceu, chao, agua, mato, gente
//   3. passada final    -> tela: calor no horizonte, nevoa, vinheta, dor
//
// O que faz o mundo parecer vivo parado e a primeira passada: o sol anda o
// arco do dia em oito minutos e a sombra de tudo gira junto com ele. E o que
// faz a luz virar regra e a terceira: ao meio-dia o horizonte ferve, e ferve
// porque naquela hora o cantil dura um minuto e meio.

import { TERRENOS, tile } from './mundo.js';
import { CONFIG } from './regras.js';
import { BICHOS, ARMAS } from './jogo.js';
import {
  pegarContexto, criarPrograma, criarBuffer, criarVao, criarAlvo, apagarAlvo,
  texturaDeCanvas, criarTelaCheia,
} from './gl/contexto.js';
import {
  criarMat4, identidade, multiplicar, ortografica, olhar, pousar, articular,
  esticar, projetar,
} from './gl/matriz.js';
import { atmosfera, FONTE_CEU } from './gl/ceu.js';
import {
  criarCampoDeAltura, construirTerreno, ESCALA_DE_ALTURA,
  VS_TERRENO, FS_TERRENO, VS_PROFUNDIDADE, FS_PROFUNDIDADE, VS_AGUA, FS_AGUA,
} from './gl/terreno.js';
import {
  VS_INSTANCIA, FS_SOLIDO, VS_INSTANCIA_PROFUNDIDADE,
  VS_OSSO, VS_OSSO_PROFUNDIDADE, VS_PAINEL, FS_PAINEL, VS_POS, FS_POS, OSSOS,
} from './gl/materiais.js';
import * as malhas from './gl/malhas.js';
import { povoarMundo } from './gl/povoar.js';
import { criarCamera, extrairPlanos, esferaVisivel } from './gl/camera.js';
import { criarAtlas, escrever } from './gl/letreiro.js';

const FLOATS_PAINEL = 13;
const MAX_PAINEIS = 4200;
const RAIO_DA_SOMBRA = 62;

const COR_NPC = [
  { roupa: [0.855, 0.816, 0.702], calca: [0.353, 0.318, 0.255], chapeu: [0.529, 0.412, 0.247] },
  { roupa: [0.702, 0.494, 0.400], calca: [0.298, 0.271, 0.298], chapeu: [0.443, 0.353, 0.220] },
  { roupa: [0.624, 0.671, 0.596], calca: [0.302, 0.259, 0.216], chapeu: [0.576, 0.463, 0.286] },
  { roupa: [0.831, 0.741, 0.529], calca: [0.259, 0.243, 0.243], chapeu: [0.478, 0.365, 0.235] },
];

const POEIRA = {
  [TERRENOS.caatinga]: [0.678, 0.588, 0.412],
  [TERRENOS.roca]: [0.706, 0.612, 0.408],
  [TERRENOS.salina]: [0.949, 0.937, 0.898],
  [TERRENOS.mata]: [0.412, 0.431, 0.306],
  [TERRENOS.serra]: [0.494, 0.463, 0.424],
  [TERRENOS.agua]: [0.667, 0.816, 0.816],
};

export function criarRender(canvas) {
  const gl = pegarContexto(canvas);
  if (!gl) throw new Error('sem WebGL2');

  const celular = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    || window.innerWidth < 760;
  const menosMovimento = !!(window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Numeros de orcamento, medidos num Intel HD 620 a 1360x860: com mapa de
  // sombra de 2048 e mato ate 92 passos o quadro nao fechava em 60.
  const ladoDaSombra = celular ? 1024 : 1536;
  const alcanceDeProps = celular ? 58 : 82;
  const escalaDaCena = celular ? 0.78 : 1;

  // ------------------------------------------------------------ programas
  const progCeu = criarPrograma(gl, 'ceu', FONTE_CEU.vertice, FONTE_CEU.fragmento);
  const progTerreno = criarPrograma(gl, 'terreno', VS_TERRENO, FS_TERRENO);
  const progAgua = criarPrograma(gl, 'agua', VS_AGUA, FS_AGUA);
  const progInstancia = criarPrograma(gl, 'instancia', VS_INSTANCIA, FS_SOLIDO);
  const progOsso = criarPrograma(gl, 'osso', VS_OSSO, FS_SOLIDO);
  const progProfEstatica = criarPrograma(gl, 'prof-estatica', VS_PROFUNDIDADE, FS_PROFUNDIDADE);
  const progProfInstancia = criarPrograma(gl, 'prof-instancia',
    VS_INSTANCIA_PROFUNDIDADE, FS_PROFUNDIDADE);
  const progProfOsso = criarPrograma(gl, 'prof-osso', VS_OSSO_PROFUNDIDADE, FS_PROFUNDIDADE);
  const progPainel = criarPrograma(gl, 'painel', VS_PAINEL, FS_PAINEL);
  const progPos = criarPrograma(gl, 'pos', VS_POS, FS_POS);

  const telaCheia = criarTelaCheia(gl);
  const sombra = criarAlvo(gl, ladoDaSombra, ladoDaSombra,
    { cor: false, profundidadeLegivel: true });
  let cena = null;

  // ------------------------------------------------------------- paineis
  const atlas = criarAtlas();
  const texturaAtlas = texturaDeCanvas(gl, atlas.canvas);
  const bufferQuad = criarBuffer(gl, new Float32Array([
    -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5,
  ]));
  const dadosPainel = new Float32Array(MAX_PAINEIS * FLOATS_PAINEL);
  const bufferPainel = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bufferPainel);
  gl.bufferData(gl.ARRAY_BUFFER, dadosPainel.byteLength, gl.DYNAMIC_DRAW);
  const vaoPainel = criarVao(gl, [
    { buffer: bufferQuad, local: 0, tamanho: 2 },
    { buffer: bufferPainel, local: 1, tamanho: 3, passo: FLOATS_PAINEL, deslocamento: 0, divisor: 1 },
    { buffer: bufferPainel, local: 2, tamanho: 2, passo: FLOATS_PAINEL, deslocamento: 3, divisor: 1 },
    { buffer: bufferPainel, local: 3, tamanho: 4, passo: FLOATS_PAINEL, deslocamento: 5, divisor: 1 },
    { buffer: bufferPainel, local: 4, tamanho: 4, passo: FLOATS_PAINEL, deslocamento: 9, divisor: 1 },
  ]);

  // -------------------------------------------------------------- modelos
  function subirModelo(construida) {
    const dados = construida.fim();
    const buffer = criarBuffer(gl, dados);
    return {
      buffer,
      vertices: dados.length / 10,
      triangulos: construida.triangulos,
      alto: construida.alto,
      vao: criarVao(gl, [
        { buffer, local: 0, tamanho: 3, passo: 10, deslocamento: 0 },
        { buffer, local: 1, tamanho: 3, passo: 10, deslocamento: 3 },
        { buffer, local: 2, tamanho: 3, passo: 10, deslocamento: 6 },
        { buffer, local: 3, tamanho: 1, passo: 10, deslocamento: 9 },
      ]),
    };
  }

  // modelo com instancia: mesmo VAO mais os quatro atributos de instancia
  function comInstancias(modelo, bufferInstancias) {
    return criarVao(gl, [
      { buffer: modelo.buffer, local: 0, tamanho: 3, passo: 10, deslocamento: 0 },
      { buffer: modelo.buffer, local: 1, tamanho: 3, passo: 10, deslocamento: 3 },
      { buffer: modelo.buffer, local: 2, tamanho: 3, passo: 10, deslocamento: 6 },
      { buffer: modelo.buffer, local: 3, tamanho: 1, passo: 10, deslocamento: 9 },
      { buffer: bufferInstancias, local: 4, tamanho: 3, passo: 8, deslocamento: 0, divisor: 1 },
      { buffer: bufferInstancias, local: 5, tamanho: 1, passo: 8, deslocamento: 3, divisor: 1 },
      { buffer: bufferInstancias, local: 6, tamanho: 1, passo: 8, deslocamento: 4, divisor: 1 },
      { buffer: bufferInstancias, local: 7, tamanho: 3, passo: 8, deslocamento: 5, divisor: 1 },
    ]);
  }

  const modelos = {
    jogador: subirModelo(malhas.gente({
      roupa: [0.898, 0.859, 0.745], calca: [0.302, 0.278, 0.239],
      chapeu: [0.545, 0.427, 0.251], cantil: true, faca: true,
    })),
    cangaceiro: subirModelo(malhas.gente({
      roupa: [0.541, 0.353, 0.227], calca: [0.294, 0.243, 0.196],
      chapeu: [0.404, 0.286, 0.180], chapeuDeCangaco: true, faca: true,
    })),
    onca: subirModelo(malhas.onca()),
    anel: subirModelo(malhas.anel(0.78, 1.0)),
    npcs: COR_NPC.map(c => subirModelo(malhas.gente(c))),
  };

  const recursos = {};
  for (const tipo of ['couro', 'mandacaru', 'madeira', 'sal', 'peca', 'chave']) {
    recursos[tipo] = subirModelo(malhas.recurso(tipo));
  }

  // tres variantes de cada mato, sorteadas pela posicao: um mandacaru so,
  // repetido dez mil vezes, vira papel de parede
  const VARIANTES = {
    mandacaru: [7, 71, 137].map(s => subirModelo(malhas.mandacaru(s))),
    arbusto: [3, 53, 113].map(s => subirModelo(malhas.arbusto(s))),
    moita: [5, 59, 127].map(s => subirModelo(malhas.moita(s))),
    juazeiro: [11, 61, 149].map(s => subirModelo(malhas.juazeiro(s))),
    pedra: [13, 67, 151].map(s => subirModelo(malhas.pedra(s))),
    lajedo: [17, 73, 157].map(s => subirModelo(malhas.lajedo(s))),
    crosta: [19].map(s => subirModelo(malhas.crostaDeSal(s))),
    casa: [23, 79, 163].map(s => subirModelo(malhas.casa(s))),
    mourao: [29].map(s => subirModelo(malhas.mourao(s))),
    cruzeiro: [1].map(() => subirModelo(malhas.cruzeiro())),
    cacimba: [1].map(() => subirModelo(malhas.cacimba())),
  };

  // ------------------------------------------------------------- estado
  let mundoGl = null;
  let camera = null;
  let campo = null;
  const planos = new Float32Array(24);
  const mVP = criarMat4();
  const mLuzVP = criarMat4();
  const mLuzProj = criarMat4();
  const mLuzVisao = criarMat4();
  const mModelo = criarMat4();
  const ossos = new Float32Array(OSSOS * 16);
  const ossoTemp = criarMat4();

  const particulas = [];
  const numeros = [];
  const andados = new Map();
  let tempo = 0;
  let quadros = 0;
  let fps = 0;
  let acumuladoFps = 0;
  let ultimaPoeira = 0;
  let dorRecente = { angulo: 0, forca: 0 };
  let posicaoAnterior = null;
  let ultimoPreenchimento = null;
  let gole = 0;

  function redimensionar() {
    const largura = Math.max(2, Math.round(canvas.width * escalaDaCena));
    const altura = Math.max(2, Math.round(canvas.height * escalaDaCena));
    if (cena && cena.largura === largura && cena.altura === altura) return;
    if (cena) apagarAlvo(gl, cena);
    cena = criarAlvo(gl, largura, altura, { profundidade: true, flutuante: true });
  }

  // ------------------------------------------------------------ preparar
  function preparar(jogo) {
    campo = criarCampoDeAltura(jogo.mundo);
    const malhaTerreno = construirTerreno(gl, jogo.mundo, campo, !celular);
    const povo = povoarMundo(jogo.mundo, campo);

    const tipos = {};
    for (const [nome, variantes] of Object.entries(VARIANTES)) {
      const lista = povo[nome];
      if (!lista || !lista.conta) continue;
      const buffers = variantes.map(() => gl.createBuffer());
      const staging = variantes.map(() => new Float32Array(lista.conta * 8));
      for (const b of buffers) {
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, lista.conta * 8 * 4, gl.DYNAMIC_DRAW);
      }
      tipos[nome] = {
        variantes,
        vaos: variantes.map((m, i) => comInstancias(m, buffers[i])),
        buffers,
        staging,
        contas: variantes.map(() => 0),
        todas: lista.dados,
        total: lista.conta,
      };
    }

    // recursos aparecem e somem: buffer proprio, refeito todo quadro
    const bufferRecursos = {};
    for (const [tipo, modelo] of Object.entries(recursos)) {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, 220 * 8 * 4, gl.DYNAMIC_DRAW);
      bufferRecursos[tipo] = {
        buffer: b,
        vao: comInstancias(modelo, b),
        modelo,
        staging: new Float32Array(220 * 8),
        conta: 0,
      };
    }

    const bufferAnel = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferAnel);
    gl.bufferData(gl.ARRAY_BUFFER, 24 * 8 * 4, gl.DYNAMIC_DRAW);

    // indice do pedaco fino por coluna e linha: procurar com find() por
    // pedaco, sessenta vezes por segundo, aparecia no perfil
    const finoPor = new Map();
    if (malhaTerreno.fina) {
      for (const p of malhaTerreno.fina.pedacos) finoPor.set(`${p.px},${p.py}`, p);
    }

    mundoGl = {
      terreno: malhaTerreno,
      finoPor,
      tipos,
      recursos: bufferRecursos,
      anel: {
        buffer: bufferAnel,
        vao: comInstancias(modelos.anel, bufferAnel),
        staging: new Float32Array(24 * 8),
      },
      fumaca: 0,
    };
    camera = criarCamera(campo);
    particulas.length = 0;
    numeros.length = 0;
    andados.clear();
    posicaoAnterior = null;
    ultimoPreenchimento = null;
    redimensionar();
  }

  // Refaz as listas de instancias visiveis. So quando o jogador anda de
  // verdade: refazer todo quadro gastava mais barramento que desenho.
  function preencherInstancias(jx, jz) {
    if (ultimoPreenchimento
      && Math.hypot(jx - ultimoPreenchimento[0], jz - ultimoPreenchimento[1]) < 6) return;
    ultimoPreenchimento = [jx, jz];
    const limite = alcanceDeProps * alcanceDeProps;
    for (const grupo of Object.values(mundoGl.tipos)) {
      const n = grupo.variantes.length;
      for (let v = 0; v < n; v++) grupo.contas[v] = 0;
      const todas = grupo.todas;
      for (let i = 0; i < grupo.total; i++) {
        const o = i * 8;
        const dx = todas[o] - jx;
        const dz = todas[o + 2] - jz;
        if (dx * dx + dz * dz > limite) continue;
        const v = n === 1 ? 0 : (((todas[o] * 7.13 + todas[o + 2] * 3.71) | 0) % n + n) % n;
        const destino = grupo.staging[v];
        const d = grupo.contas[v] * 8;
        for (let k = 0; k < 8; k++) destino[d + k] = todas[o + k];
        grupo.contas[v]++;
      }
      for (let v = 0; v < n; v++) {
        if (!grupo.contas[v]) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER, grupo.buffers[v]);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, grupo.staging[v], 0, grupo.contas[v] * 8);
      }
    }
  }

  function preencherRecursos(jogo, jx, jz) {
    for (const grupo of Object.values(mundoGl.recursos)) grupo.conta = 0;
    for (const r of jogo.mundo.recursos) {
      if (r.pego) continue;
      const dx = r.x - jx;
      const dz = r.y - jz;
      if (dx * dx + dz * dz > 6400) continue;
      const grupo = mundoGl.recursos[r.tipo] || mundoGl.recursos.peca;
      if (grupo.conta >= 220) continue;
      const o = grupo.conta * 8;
      const balanco = Math.sin(tempo * 2 + r.x) * 0.06;
      grupo.staging[o] = r.x;
      grupo.staging[o + 1] = campo.em(r.x, r.y) + 0.08 + balanco;
      grupo.staging[o + 2] = r.y;
      grupo.staging[o + 3] = 1;
      grupo.staging[o + 4] = tempo * 0.7 + r.x;
      grupo.staging[o + 5] = 1.35;
      grupo.staging[o + 6] = 1.3;
      grupo.staging[o + 7] = 1.2;
      grupo.conta++;
    }
    for (const grupo of Object.values(mundoGl.recursos)) {
      if (!grupo.conta) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, grupo.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, grupo.staging, 0, grupo.conta * 8);
    }
  }

  // ------------------------------------------------------------- desenho

  function desenharTerreno(programa, vp, sombreando) {
    const cam = camera.estado.olho;
    const usaFina = mundoGl.terreno.fina;
    gl.uniformMatrix4fv(programa.u.uVP, false, vp);
    for (const grosso of mundoGl.terreno.grossa.pedacos) {
      const dx = grosso.cx - cam[0];
      const dz = grosso.cz - cam[2];
      const d = Math.hypot(dx, dz);
      if (sombreando && d > RAIO_DA_SOMBRA + 30) continue;
      if (!sombreando && !esferaVisivel(planos, grosso.cx, grosso.cy, grosso.cz, grosso.raio)) {
        continue;
      }
      const fino = usaFina && d < 52
        ? mundoGl.finoPor.get(`${grosso.px},${grosso.py}`)
        : null;
      if (fino) {
        gl.bindVertexArray(mundoGl.terreno.fina.vao);
        gl.drawArrays(gl.TRIANGLES, fino.inicio, fino.conta);
      } else {
        gl.bindVertexArray(mundoGl.terreno.grossa.vao);
        gl.drawArrays(gl.TRIANGLES, grosso.inicio, grosso.conta);
      }
    }
  }

  function desenharInstancias(programa, sombreando) {
    for (const grupo of Object.values(mundoGl.tipos)) {
      for (let v = 0; v < grupo.variantes.length; v++) {
        const quantas = grupo.contas[v];
        if (!quantas) continue;
        gl.bindVertexArray(grupo.vaos[v]);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, grupo.variantes[v].vertices, quantas);
      }
    }
    if (sombreando) return;
    for (const grupo of Object.values(mundoGl.recursos)) {
      if (!grupo.conta) continue;
      gl.bindVertexArray(grupo.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, grupo.modelo.vertices, grupo.conta);
    }
  }

  // Animacao: as oito juntas saem de uma fase so, que vem da distancia
  // andada. Quem nao anda nao balanca, e quem corre balanca mais. O oitavo
  // osso e o cantil, que nao gira: encolhe conforme a agua acaba.
  function montarOssosDeGente(fase, forca, golpe, bebendo = 0, cantil = 1) {
    const balanco = Math.sin(fase) * forca;
    const contra = Math.sin(fase + Math.PI) * forca;
    identidade(ossoTemp);
    ossos.set(ossoTemp, 0);
    articular(ossoTemp, 0, 0.82, 0, 0, Math.sin(fase * 2) * forca * 0.05);
    ossos.set(ossoTemp, 16);
    articular(ossoTemp, 0, 1.34, 0, 0, Math.sin(fase * 2 + 1) * forca * 0.04 - bebendo * 0.3);
    ossos.set(ossoTemp, 32);
    articular(ossoTemp, 0, 1.22, 0, 0, contra * 0.85);
    ossos.set(ossoTemp, 48);
    // braco da frente: golpe empurra para a frente, beber sobe ate a boca
    articular(ossoTemp, 0, 1.22, 0, 0, balanco * 0.85 - golpe * 1.9 + bebendo * 2.5);
    ossos.set(ossoTemp, 64);
    articular(ossoTemp, 0, 0.82, 0, 0, balanco);
    ossos.set(ossoTemp, 80);
    articular(ossoTemp, 0, 0.82, 0, 0, contra);
    ossos.set(ossoTemp, 96);
    esticar(ossoTemp, 0.97, 0.3 + 0.7 * cantil);
    ossos.set(ossoTemp, 112);
  }

  function montarOssosDeOnca(fase, forca) {
    const a = Math.sin(fase) * forca;
    const b = Math.sin(fase + Math.PI) * forca;
    identidade(ossoTemp);
    ossos.set(ossoTemp, 0);
    articular(ossoTemp, 0.55, 0.60, 0, 0, Math.sin(fase * 2) * forca * 0.1);
    ossos.set(ossoTemp, 16);
    articular(ossoTemp, 0.30, 0.40, 0, 0, a);
    ossos.set(ossoTemp, 32);
    articular(ossoTemp, 0.30, 0.40, 0, 0, b);
    ossos.set(ossoTemp, 48);
    articular(ossoTemp, -0.30, 0.38, 0, 0, b);
    ossos.set(ossoTemp, 64);
    articular(ossoTemp, -0.30, 0.38, 0, 0, a);
    ossos.set(ossoTemp, 80);
    articular(ossoTemp, -0.45, 0.56, 0, Math.sin(fase * 0.8 + 1) * 0.35, 0);
    ossos.set(ossoTemp, 96);
  }

  function passoDe(chave, x, z, dt) {
    let estado = andados.get(chave);
    if (!estado) {
      estado = { x, z, fase: 0, velocidade: 0 };
      andados.set(chave, estado);
    }
    const d = Math.hypot(x - estado.x, z - estado.z);
    estado.x = x;
    estado.z = z;
    const v = dt > 0 ? d / dt : 0;
    estado.velocidade += (v - estado.velocidade) * Math.min(1, dt * 9);
    estado.fase += d * 2.4;
    return estado;
  }

  function corpo(programa, modelo, x, y, z, ang, escala, realce) {
    pousar(mModelo, x, y, z, ang, escala);
    gl.uniformMatrix4fv(programa.u.uModelo, false, mModelo);
    gl.uniformMatrix4fv(programa.u.uOssos, false, ossos);
    if (programa.u.uRealce) gl.uniform3f(programa.u.uRealce, realce[0], realce[1], realce[2]);
    gl.bindVertexArray(modelo.vao);
    gl.drawArrays(gl.TRIANGLES, 0, modelo.vertices);
  }

  const SEM_REALCE = [0, 0, 0];

  function desenharGente(jogo, programa, dt, sombreando) {
    const j = jogo.jogador;
    const arma = ARMAS[j.arma] || ARMAS.maos;

    for (const vila of jogo.mundo.vilas) {
      for (const npc of vila.npcs) {
        const dx = npc.x - j.x;
        const dz = npc.y - j.y;
        if (dx * dx + dz * dz > (sombreando ? 3600 : 14400)) continue;
        const modelo = modelos.npcs[(npc.nome.length + npc.papel.length) % modelos.npcs.length];
        montarOssosDeGente(tempo * 1.1 + npc.x, 0.05, 0);
        corpo(programa, modelo, npc.x, campo.em(npc.x, npc.y), npc.y,
          Math.atan2(j.y - npc.y, j.x - npc.x), 1, SEM_REALCE);
      }
    }

    for (const bicho of jogo.inimigos) {
      if (bicho.vida <= 0) continue;
      const dx = bicho.x - j.x;
      const dz = bicho.y - j.y;
      if (dx * dx + dz * dz > 22500) continue;
      const modelo = bicho.tipo === 'onca' ? modelos.onca : modelos.cangaceiro;
      const estado = passoDe(bicho, bicho.x, bicho.y, dt);
      const forca = Math.min(0.75, estado.velocidade * 0.16);
      if (bicho.tipo === 'onca') montarOssosDeOnca(estado.fase, forca + 0.05);
      else montarOssosDeGente(estado.fase, forca + 0.04, 0);
      const distancia = Math.hypot(dx, dz);
      // Realce de alcance: o bicho acende quando esta ao alcance do golpe.
      // E o aviso que faltava — sem ele o combate era adivinhacao.
      const noAlcance = distancia <= arma.alcance + 0.4;
      const pulso = 0.5 + 0.5 * Math.sin(tempo * 7);
      const realce = bicho.piscar > 0
        ? [0.8, 0.7, 0.6]
        : noAlcance ? [0.26 + pulso * 0.2, 0.12 + pulso * 0.08, 0.04] : SEM_REALCE;
      corpo(programa, modelo, bicho.x, campo.em(bicho.x, bicho.y), bicho.y,
        bicho.ang, 1, realce);
    }

    const estadoDoJogador = passoDe(j, j.x, j.y, dt);
    const golpe = Math.max(0, 1 - (arma.cadencia - j.recarga) * 7) * (j.recarga > 0 ? 1 : 0);

    montarOssosDeGente(estadoDoJogador.fase,
      Math.min(0.8, estadoDoJogador.velocidade * 0.16) + 0.03, golpe,
      Math.sin(Math.min(1, gole) * Math.PI), j.sede / j.sedeMaxima);
    corpo(programa, modelos.jogador, j.x, campo.em(j.x, j.y), j.y, j.ang, 1,
      j.dor > 0.05 ? [j.dor * 0.5, 0, 0] : SEM_REALCE);
  }

  // Aneis no chao: um embaixo do jogador, um embaixo de cada bicho ao alcance
  // do golpe, um no alvo da missao quando ele esta perto.
  function desenharAneis(jogo) {
    const j = jogo.jogador;
    const arma = ARMAS[j.arma] || ARMAS.maos;
    const lista = mundoGl.anel.staging;
    let conta = 0;
    const por = (x, z, raio, r, g, b) => {
      if (conta >= 24) return;
      const o = conta * 8;
      lista[o] = x;
      lista[o + 1] = campo.em(x, z) + 0.05;
      lista[o + 2] = z;
      lista[o + 3] = raio;
      lista[o + 4] = 0;
      lista[o + 5] = r;
      lista[o + 6] = g;
      lista[o + 7] = b;
      conta++;
    };
    por(j.x, j.y, 0.52, 0.9, 0.86, 0.72);
    for (const bicho of jogo.inimigos) {
      if (bicho.vida <= 0) continue;
      const d = Math.hypot(bicho.x - j.x, bicho.y - j.y);
      if (d > arma.alcance + 0.4) continue;
      const pulso = 0.6 + 0.4 * Math.sin(tempo * 8);
      por(bicho.x, bicho.y, 0.85, 2.4 * pulso, 0.5 * pulso, 0.16 * pulso);
    }
    if (!conta) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, mundoGl.anel.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, lista, 0, conta * 8);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(-2.5, -4);
    gl.bindVertexArray(mundoGl.anel.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, modelos.anel.vertices, conta);
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }

  // ------------------------------------------------------- particulas

  function soltarParticula(x, y, z, vx, vy, vz, vida, tamanho, cor, gravidade) {
    if (particulas.length > 520) return;
    particulas.push({ x, y, z, vx, vy, vz, vida, total: vida, tamanho, cor, gravidade });
  }

  function poeiraDoPasso(jogo, dt) {
    const j = jogo.jogador;
    if (!posicaoAnterior) {
      posicaoAnterior = { x: j.x, y: j.y };
      return;
    }
    const d = Math.hypot(j.x - posicaoAnterior.x, j.y - posicaoAnterior.y);
    posicaoAnterior = { x: j.x, y: j.y };
    const velocidade = dt > 0 ? d / dt : 0;
    if (velocidade < 1.2 || menosMovimento) return;
    ultimaPoeira -= dt;
    if (ultimaPoeira > 0) return;
    ultimaPoeira = velocidade > 4.6 ? 0.055 : 0.12;
    const chao = tile(jogo.mundo, Math.floor(j.x), Math.floor(j.y));
    const cor = POEIRA[chao] || POEIRA[TERRENOS.caatinga];
    const quantas = velocidade > 4.6 ? 3 : 2;
    for (let i = 0; i < quantas; i++) {
      soltarParticula(
        j.x + (Math.random() - 0.5) * 0.4,
        campo.em(j.x, j.y) + 0.06,
        j.y + (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.7, 0.35 + Math.random() * 0.5, (Math.random() - 0.5) * 0.7,
        0.5 + Math.random() * 0.6,
        0.24 + Math.random() * 0.26,
        [cor[0], cor[1], cor[2], 0.5], -0.25);
    }
  }

  function fumacaDaVila(jogo, dt) {
    if (menosMovimento) return;
    mundoGl.fumaca -= dt;
    if (mundoGl.fumaca > 0) return;
    mundoGl.fumaca = 0.22;
    const j = jogo.jogador;
    for (const vila of jogo.mundo.vilas) {
      const d = Math.hypot(vila.x - j.x, vila.y - j.y);
      if (d > 150) continue;
      const casa = vila.casas[0];
      const x = vila.x + 0.5 + (casa.x - vila.x) * 1.55;
      const z = vila.y + 0.5 + (casa.y - vila.y) * 1.55;
      soltarParticula(x, campo.em(x, z) + 2.4, z,
        (Math.random() - 0.5) * 0.25, 0.85 + Math.random() * 0.4, (Math.random() - 0.5) * 0.25,
        3.4 + Math.random() * 1.6, 0.8, [0.78, 0.76, 0.72, 0.30], 0.05);
    }
  }

  function moverParticulas(dt) {
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dt;
      if (p.vida <= 0) { particulas.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy += p.gravidade * dt * 4;
      p.vx *= 1 - dt * 0.9;
      p.vz *= 1 - dt * 0.9;
      p.tamanho += dt * 0.35;
    }
    for (let i = numeros.length - 1; i >= 0; i--) {
      const n = numeros[i];
      n.vida -= dt;
      if (n.vida <= 0) { numeros.splice(i, 1); continue; }
      n.y += dt * 1.15;
    }
  }

  // ---------------------------------------------------------- um quadro

  function desenhar(jogo, dt) {
    if (!mundoGl) preparar(jogo);
    const passoDeTempo = Math.min(0.08, dt);
    tempo += passoDeTempo;
    if (dt > 0) {
      acumuladoFps += (1 / Math.max(0.0005, dt) - acumuladoFps) * 0.06;
      fps = acumuladoFps;
      quadros++;
    }

    const j = jogo.jogador;
    const ar = atmosfera(jogo.hora);
    camera.seguir(j, Math.max(0.0005, passoDeTempo), canvas.width, canvas.height);
    const cam = camera.estado;
    mVP.set(cam.vp);
    extrairPlanos(mVP, planos);
    preencherInstancias(j.x, j.y);
    preencherRecursos(jogo, j.x, j.y);
    poeiraDoPasso(jogo, passoDeTempo);
    fumacaDaVila(jogo, passoDeTempo);
    moverParticulas(passoDeTempo);
    dorRecente.forca = Math.max(0, dorRecente.forca - passoDeTempo * 1.6);
    gole = Math.max(0, gole - passoDeTempo * 1.7);

    // ---------------------------------------------- 1. passada do sol
    const focoX = j.x + Math.cos(cam.giro) * 16;
    const focoZ = j.y + Math.sin(cam.giro) * 16;
    const focoY = campo.em(focoX, focoZ);
    const texel = (RAIO_DA_SOMBRA * 2) / ladoDaSombra;
    // Encaixar o foco no texel do mapa: sem isto a borda da sombra ferve
    // enquanto o jogador anda, e parece sujeira de tela.
    const fx = Math.round(focoX / texel) * texel;
    const fz = Math.round(focoZ / texel) * texel;
    const distanciaDaLuz = 190;
    olhar(mLuzVisao,
      [fx + ar.direcao[0] * distanciaDaLuz, focoY + ar.direcao[1] * distanciaDaLuz,
        fz + ar.direcao[2] * distanciaDaLuz],
      [fx, focoY, fz], [0, 1, 0]);
    ortografica(mLuzProj, -RAIO_DA_SOMBRA, RAIO_DA_SOMBRA,
      -RAIO_DA_SOMBRA, RAIO_DA_SOMBRA, 1, distanciaDaLuz * 2.2);
    multiplicar(mLuzVP, mLuzProj, mLuzVisao);

    gl.bindFramebuffer(gl.FRAMEBUFFER, sombra.quadro);
    gl.viewport(0, 0, sombra.largura, sombra.altura);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    gl.useProgram(progProfEstatica.programa);
    desenharTerreno(progProfEstatica, mLuzVP, true);

    gl.useProgram(progProfInstancia.programa);
    gl.uniformMatrix4fv(progProfInstancia.u.uVP, false, mLuzVP);
    gl.uniform1f(progProfInstancia.u.uTempo, tempo);
    gl.uniform1f(progProfInstancia.u.uVento, menosMovimento ? 0 : 1);
    gl.uniform1f(progProfInstancia.u.uAlcance, alcanceDeProps);
    gl.uniform3fv(progProfInstancia.u.uCamera, camera.estado.olho);
    desenharInstancias(progProfInstancia, true);

    gl.useProgram(progProfOsso.programa);
    gl.uniformMatrix4fv(progProfOsso.u.uVP, false, mLuzVP);
    desenharGente(jogo, progProfOsso, passoDeTempo, true);

    gl.cullFace(gl.BACK);

    // --------------------------------------------- 2. passada da cena
    gl.bindFramebuffer(gl.FRAMEBUFFER, cena.quadro);
    gl.viewport(0, 0, cena.largura, cena.altura);
    gl.clearColor(ar.horizonte[0], ar.horizonte[1], ar.horizonte[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // ceu primeiro, sem escrever profundidade
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(progCeu.programa);
    gl.uniformMatrix4fv(progCeu.u.uInvVP, false, cam.invVP);
    gl.uniform3fv(progCeu.u.uCamera, cam.olho);
    gl.uniform3fv(progCeu.u.uSol, ar.direcao);
    gl.uniform3fv(progCeu.u.uHorizonte, ar.horizonte);
    gl.uniform3fv(progCeu.u.uZenite, ar.zenite);
    gl.uniform3fv(progCeu.u.uCorDoSol, ar.corDaLuz);
    gl.uniform1f(progCeu.u.uDiscoSol, ar.discoSol);
    gl.uniform1f(progCeu.u.uNoite, ar.noite);
    gl.uniform1f(progCeu.u.uTempo, tempo);
    gl.bindVertexArray(telaCheia);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sombra.profundidade);

    const luzComum = (programa) => {
      gl.uniform3fv(programa.u.uSol, ar.direcao);
      gl.uniform3fv(programa.u.uCorDoSol, ar.corDaLuz);
      gl.uniform3fv(programa.u.uCorAmbiente, ar.corAmbiente);
      gl.uniform3fv(programa.u.uCorNevoa, ar.corNevoa);
      gl.uniform3fv(programa.u.uCamera, cam.olho);
      gl.uniform1f(programa.u.uNevoa, ar.nevoa);
      gl.uniformMatrix4fv(programa.u.uLuzVP, false, mLuzVP);
      gl.uniform1i(programa.u.uSombra, 0);
      gl.uniform1f(programa.u.uTexelSombra, 1 / ladoDaSombra);
      gl.uniform1f(programa.u.uTempo, tempo);
      gl.uniform1f(programa.u.uVento, menosMovimento ? 0 : 1);
      gl.uniform1f(programa.u.uAlcance, alcanceDeProps);
      // O lampiao segue o jogador e so acende quando a noite entra.
      gl.uniform3f(programa.u.uLampiao, j.x, campo.em(j.x, j.y) + 1.1, j.y);
      gl.uniform1f(programa.u.uForcaDoLampiao, ar.noite * 0.95);
      if (programa.u.uRealce) gl.uniform3f(programa.u.uRealce, 0, 0, 0);
    };

    gl.useProgram(progTerreno.programa);
    luzComum(progTerreno);
    desenharTerreno(progTerreno, mVP, false);

    gl.useProgram(progInstancia.programa);
    luzComum(progInstancia);
    gl.uniformMatrix4fv(progInstancia.u.uVP, false, mVP);
    desenharInstancias(progInstancia, false);

    gl.useProgram(progOsso.programa);
    luzComum(progOsso);
    gl.uniformMatrix4fv(progOsso.u.uVP, false, mVP);
    desenharGente(jogo, progOsso, passoDeTempo, false);

    // aneis de chao usam o mesmo programa de instancia
    gl.useProgram(progInstancia.programa);
    luzComum(progInstancia);
    gl.uniformMatrix4fv(progInstancia.u.uVP, false, mVP);
    gl.uniform1f(progInstancia.u.uVento, 0);
    // o anel nao encolhe com a distancia: ele e aviso, nao mato
    gl.uniform1f(progInstancia.u.uAlcance, 1e6);
    desenharAneis(jogo);

    // agua por ultimo entre os solidos, que ela e translucida
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(progAgua.programa);
    luzComum(progAgua);
    gl.uniform3fv(progAgua.u.uHorizonte, ar.horizonte);
    gl.uniform3fv(progAgua.u.uZenite, ar.zenite);
    // fundo do rio em linear (0,106 0,180 0,169 em sRGB)
    gl.uniform3f(progAgua.u.uFundo, 0.0077, 0.0243, 0.0211);
    gl.uniformMatrix4fv(progAgua.u.uVP, false, mVP);
    gl.bindVertexArray(mundoGl.terreno.agua.vao);
    for (const pedaco of mundoGl.terreno.agua.pedacos) {
      if (!esferaVisivel(planos, pedaco.cx, pedaco.cy, pedaco.cz, pedaco.raio)) continue;
      gl.drawArrays(gl.TRIANGLES, pedaco.inicio, pedaco.conta);
    }
    gl.enable(gl.CULL_FACE);

    desenharPaineis(jogo, cam);
    gl.disable(gl.BLEND);

    // -------------------------------------------- 3. passada final
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(progPos.programa);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, cena.cor);
    gl.uniform1i(progPos.u.uCena, 0);
    gl.uniform1f(progPos.u.uTempo, tempo);
    gl.uniform1f(progPos.u.uCalor, menosMovimento ? 0 : Math.max(0, ar.calor - 0.25) * 1.5);
    gl.uniform1f(progPos.u.uNoite, ar.noite);
    gl.uniform1f(progPos.u.uDor, Math.min(1, j.dor));
    gl.uniform1f(progPos.u.uVidaBaixa,
      Math.max(0, 1 - (j.vida / CONFIG.vidaMaxima) / 0.3));
    gl.uniform1f(progPos.u.uAnguloDoDano, dorRecente.angulo);
    gl.uniform1f(progPos.u.uForcaDoDano, dorRecente.forca);
    gl.uniform2f(progPos.u.uTamanho, canvas.width, canvas.height);
    gl.bindVertexArray(telaCheia);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  // Tudo que e virado para a camera num desenho so: particula, barra de vida
  // do bicho, nome de quem fala e numero de dano.
  function desenharPaineis(jogo, cam) {
    const lista = [];
    const direita = [
      cam.visao[0], cam.visao[4], cam.visao[8],
    ];
    const cima = [cam.visao[1], cam.visao[5], cam.visao[9]];
    const j = jogo.jogador;

    for (const p of particulas) {
      const a = (p.vida / p.total) * p.cor[3];
      lista.push(p.x, p.y, p.z, p.tamanho, p.tamanho,
        p.cor[0], p.cor[1], p.cor[2], a,
        atlas.pingo.x, atlas.pingo.y, atlas.pingo.w, atlas.pingo.h);
    }

    // Letra em tamanho de mundo cresce quando se chega perto: a captura de
    // tela saiu com "Josefa" ocupando meia tela. Aqui o corpo da letra e
    // proporcional a distancia, que em tela da sempre o mesmo tamanho.
    const corpoDaLetra = (d, base) => Math.min(base * 4, Math.max(base * 0.55, base * d * 0.09));

    // barra de vida do bicho irritado
    for (const bicho of jogo.inimigos) {
      if (bicho.vida <= 0 || !bicho.irritado) continue;
      const modelo = BICHOS[bicho.tipo];
      const d = Math.hypot(bicho.x - j.x, bicho.y - j.y);
      if (d > 44) continue;
      const alturaBarra = campo.em(bicho.x, bicho.y) + (bicho.tipo === 'onca' ? 1.35 : 2.1);
      const fracao = Math.max(0, bicho.vida / modelo.vida);
      const largura = Math.min(2.4, Math.max(0.9, d * 0.1));
      const grossura = largura * 0.1;
      lista.push(bicho.x, alturaBarra, bicho.y, largura + grossura * 0.6, grossura * 1.7,
        0.06, 0.04, 0.03, 0.82, 0, 0, 0, 0);
      const vazio = largura * (1 - fracao);
      lista.push(
        bicho.x + direita[0] * (-vazio / 2), alturaBarra + direita[1] * (-vazio / 2),
        bicho.y + direita[2] * (-vazio / 2),
        largura * fracao, grossura,
        0.78, 0.20, 0.13, 0.95, 0, 0, 0, 0);
      const corpo = corpoDaLetra(d, 0.26);
      escrever(lista, atlas, modelo.nome, bicho.x, alturaBarra + corpo * 1.1, bicho.y,
        corpo, [0.95, 0.85, 0.72, 0.92], direita);
    }

    for (const vila of jogo.mundo.vilas) {
      for (const npc of vila.npcs) {
        const d = Math.hypot(npc.x - j.x, npc.y - j.y);
        if (d > 24) continue;
        const alpha = Math.min(1, (24 - d) / 7);
        const corpo = corpoDaLetra(d, 0.24);
        escrever(lista, atlas, npc.nome, npc.x, campo.em(npc.x, npc.y) + 2.0, npc.y,
          corpo, [0.96, 0.92, 0.82, alpha], direita);
        if (npc.papel === 'vendedor' && d <= CONFIG.alcanceFala) {
          escrever(lista, atlas, 'BODEGA', npc.x,
            campo.em(npc.x, npc.y) + 2.0 + corpo * 1.25, npc.y,
            corpo, [0.91, 0.64, 0.24, 1], direita);
        }
      }
    }

    for (const n of numeros) {
      const a = Math.min(1, n.vida / 0.4);
      const d = Math.hypot(n.x - cam.olho[0], n.z - cam.olho[2]);
      escrever(lista, atlas, n.texto, n.x, n.y, n.z, corpoDaLetra(d, n.tamanho),
        [n.cor[0], n.cor[1], n.cor[2], a], direita);
    }

    if (!lista.length) return;
    const quantas = Math.floor(Math.min(MAX_PAINEIS, lista.length / FLOATS_PAINEL));
    const total = quantas * FLOATS_PAINEL;
    for (let i = 0; i < total; i++) dadosPainel[i] = lista[i];
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferPainel);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, dadosPainel, 0, quantas * FLOATS_PAINEL);

    gl.useProgram(progPainel.programa);
    gl.uniformMatrix4fv(progPainel.u.uVP, false, mVP);
    gl.uniform3fv(progPainel.u.uDireita, direita);
    gl.uniform3fv(progPainel.u.uCima, cima);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texturaAtlas);
    gl.uniform1i(progPainel.u.uAtlas, 1);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(vaoPainel);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, quantas);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.activeTexture(gl.TEXTURE0);
  }

  // -------------------------------------------------------------- eventos

  function evento(ev) {
    if (!campo) return;
    if (ev.tipo === 'acerto' || ev.tipo === 'abate') {
      const n = ev.tipo === 'abate' ? 22 : 9;
      const y = campo.em(ev.x, ev.y) + 0.8;
      for (let i = 0; i < n; i++) {
        soltarParticula(ev.x, y, ev.y,
          (Math.random() - 0.5) * 3.4, Math.random() * 2.6, (Math.random() - 0.5) * 3.4,
          0.35 + Math.random() * 0.4, 0.14 + Math.random() * 0.12,
          [0.55, 0.11, 0.08, 0.95], -1.6);
      }
      if (ev.tipo === 'acerto' && ev.dano) {
        numeros.push({
          texto: String(Math.round(ev.dano)), x: ev.x, y: y + 0.5, z: ev.y,
          vida: 1.1, tamanho: 0.42, cor: [1, 0.86, 0.45],
        });
      }
    } else if (ev.tipo === 'dano') {
      // De onde veio a pancada: a passada final acende esse lado da borda.
      dorRecente = { angulo: ev.angulo || 0, forca: 1 };
    }
  }

  function aoBeber(x, y) {
    if (!campo) return;
    gole = 1;
    const alturaDaAgua = campo.em(x, y) + 0.2;
    for (let i = 0; i < 16; i++) {
      soltarParticula(x, alturaDaAgua, y,
        (Math.random() - 0.5) * 2.2, 1.0 + Math.random() * 1.8, (Math.random() - 0.5) * 2.2,
        0.45 + Math.random() * 0.4, 0.1 + Math.random() * 0.1,
        [0.62, 0.84, 0.86, 0.9], -1.8);
    }
  }

  function numeroNoJogador(jogo, texto, cor) {
    const j = jogo.jogador;
    numeros.push({
      texto, x: j.x, y: campo.em(j.x, j.y) + 2.3, z: j.y,
      vida: 1.2, tamanho: 0.44, cor,
    });
  }

  // ---------------------------------------------------------------- mapa

  const CORES_MAPA = {
    [TERRENOS.caatinga]: '#8a7a4e',
    [TERRENOS.mata]: '#4e5f38',
    [TERRENOS.roca]: '#9c8a52',
    [TERRENOS.salina]: '#d8d2c0',
    [TERRENOS.serra]: '#6b5f52',
    [TERRENOS.agua]: '#3d6a64',
  };

  function desenharMapa(mapaCanvas, jogo, vistos) {
    const m = mapaCanvas.getContext('2d');
    const mundo = jogo.mundo;
    const escala = mapaCanvas.width / mundo.largura;
    m.fillStyle = '#0e0c08';
    m.fillRect(0, 0, mapaCanvas.width, mapaCanvas.height);
    const passo = 2;
    for (let y = 0; y < mundo.altura; y += passo) {
      for (let x = 0; x < mundo.largura; x += passo) {
        if (!vistos[y * mundo.largura + x]) continue;
        const i = y * mundo.largura + x;
        m.fillStyle = mundo.estrada[i] ? '#c4ae7e'
          : (CORES_MAPA[mundo.terreno[i]] || CORES_MAPA[0]);
        m.fillRect(x * escala, y * escala, escala * passo, escala * passo);
      }
    }
    for (const vila of mundo.vilas) {
      if (!vistos[vila.y * mundo.largura + vila.x]) continue;
      m.fillStyle = '#e8c24a';
      m.fillRect(vila.x * escala - 2, vila.y * escala - 2, 5, 5);
    }
    const j = jogo.jogador;
    m.fillStyle = '#ffffff';
    m.beginPath();
    m.moveTo(j.x * escala + Math.cos(j.ang) * 5, j.y * escala + Math.sin(j.ang) * 5);
    m.lineTo(j.x * escala + Math.cos(j.ang + 2.4) * 4, j.y * escala + Math.sin(j.ang + 2.4) * 4);
    m.lineTo(j.x * escala + Math.cos(j.ang - 2.4) * 4, j.y * escala + Math.sin(j.ang - 2.4) * 4);
    m.closePath();
    m.fill();
  }

  return {
    preparar,
    desenhar,
    evento,
    aoBeber,
    numeroNoJogador,
    desenharMapa,
    redimensionar,
    mirar: (dx, dy) => camera && camera.mirar(dx, dy),
    aproximar: (p) => camera && camera.aproximar(p),
    get giro() { return camera ? camera.estado.giro : 0; },
    get fps() { return fps; },
    get triangulos() { return quadros; },
    alturaEm: (x, y) => (campo ? campo.em(x, y) : 0),
    projetarNaTela(x, y, z) {
      if (!camera) return null;
      return projetar(mVP, x, y, z, canvas.clientWidth, canvas.clientHeight);
    },
    get escalaDeAltura() { return ESCALA_DE_ALTURA; },
  };
}
