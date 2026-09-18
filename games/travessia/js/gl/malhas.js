// Os modelos do sertao, gerados em codigo. Nao ha um unico arquivo de asset no
// jogo: cada mandacaru, casa, onca e cangaceiro sai destas funcoes.
//
// A regra do estilo e "medium poly": entre duzentos e dois mil triangulos por
// modelo, faceta visivel, cor por vertice, zero textura. Por isso todo
// triangulo carrega a propria normal plana — normal media e exatamente o que
// apagaria a faceta.
//
// Cada vertice tem dez floats: posicao, normal, cor e um canal extra. No mato
// esse canal e o peso do vento (raiz nao anda, ponta anda); na gente e o
// numero do osso. Modelo de bicho e de gente olha para +X.

// A cor de cada modelo e escrita em sRGB, que e como olho humano e paleta de
// briefing falam, e guardada em linear, que e como luz multiplica. Sem isso
// tudo que cai na sombra vira preto: a parede de taipa sombreada dava 0,12 e
// a tela mostrava 12% de brilho.
const paraLinear = (c) => c ** 2.2;

export function construtor() {
  const dados = [];
  let maxY = -Infinity;
  let minY = Infinity;

  function vertice(p, n, cor, extra) {
    dados.push(p[0], p[1], p[2], n[0], n[1], n[2],
      paraLinear(cor[0]), paraLinear(cor[1]), paraLinear(cor[2]), extra);
    if (p[1] > maxY) maxY = p[1];
    if (p[1] < minY) minY = p[1];
  }

  function tri(a, b, c, cor, extra = 0) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const inv = 1 / (Math.hypot(nx, ny, nz) || 1);
    const n = [nx * inv, ny * inv, nz * inv];
    vertice(a, n, cor, extra);
    vertice(b, n, cor, extra);
    vertice(c, n, cor, extra);
  }

  function quadrilatero(a, b, c, d, cor, extra = 0) {
    tri(a, b, c, cor, extra);
    tri(a, c, d, cor, extra);
  }

  // Caixa com giro em Y. Seis faces planas: e ela que da o ar esculpido de
  // casa de taipa e de peito de cangaceiro.
  function caixa(cx, cy, cz, sx, sy, sz, cor, extra = 0, giro = 0) {
    const c = Math.cos(giro);
    const s = Math.sin(giro);
    const p = (dx, dy, dz) => [
      cx + dx * sx * c + dz * sz * s,
      cy + dy * sy,
      cz - dx * sx * s + dz * sz * c,
    ];
    const a000 = p(-1, -1, -1); const a100 = p(1, -1, -1);
    const a110 = p(1, 1, -1); const a010 = p(-1, 1, -1);
    const a001 = p(-1, -1, 1); const a101 = p(1, -1, 1);
    const a111 = p(1, 1, 1); const a011 = p(-1, 1, 1);
    quadrilatero(a001, a101, a111, a011, cor, extra);
    quadrilatero(a100, a000, a010, a110, cor, extra);
    quadrilatero(a101, a100, a110, a111, cor, extra);
    quadrilatero(a000, a001, a011, a010, cor, extra);
    quadrilatero(a011, a111, a110, a010, cor, extra);
    quadrilatero(a000, a100, a101, a001, cor, extra);
  }

  // Tronco facetado. Seis ou sete lados da corpo de mandacaru e de perna sem
  // parecer cilindro liso. `caida` inclina o topo sem torcer a base.
  function prisma(cx, cy, cz, raioBase, raioTopo, altura, lados, cor, extra = 0,
    caidaX = 0, caidaZ = 0, tampas = true) {
    const passo = (Math.PI * 2) / lados;
    const tx = cx + caidaX;
    const ty = cy + altura;
    const tz = cz + caidaZ;
    const base = [];
    const topo = [];
    for (let i = 0; i < lados; i++) {
      const a = i * passo;
      base.push([cx + Math.cos(a) * raioBase, cy, cz + Math.sin(a) * raioBase]);
      topo.push([tx + Math.cos(a) * raioTopo, ty, tz + Math.sin(a) * raioTopo]);
    }
    for (let i = 0; i < lados; i++) {
      const j = (i + 1) % lados;
      quadrilatero(base[i], topo[i], topo[j], base[j], cor, extra);
    }
    if (!tampas) return;
    // Visto de cima, angulo crescente anda no sentido horario (Y para cima,
    // Z para baixo na tela). A tampa de cima, portanto, fecha ao contrario.
    for (let i = 1; i < lados - 1; i++) {
      tri(topo[0], topo[i + 1], topo[i], cor, extra);
      tri(base[0], base[i], base[i + 1], cor, extra);
    }
  }

  // Bolha facetada por aneis. Poucas fatias de proposito: cabeca, copa de
  // juazeiro e pedra tem de mostrar face.
  function bolha(cx, cy, cz, raio, cor, extra = 0, opcoes = {}) {
    const aneis = opcoes.aneis || 4;
    const fatias = opcoes.fatias || 7;
    const achatar = opcoes.achatar === undefined ? 1 : opcoes.achatar;
    const irregular = opcoes.irregular || 0;
    let estado = (opcoes.semente | 0) || 1;
    const sorteio = () => {
      estado = (estado * 1103515245 + 12345) & 0x7fffffff;
      return estado / 0x7fffffff;
    };
    // O raio tem de ser o mesmo nos dois lados da costura: sortear dentro do
    // laco abria uma fenda na volta do anel.
    const raios = [];
    for (let i = 0; i <= aneis; i++) {
      const linha = [];
      for (let j = 0; j < fatias; j++) linha.push(raio * (1 + (sorteio() - 0.5) * irregular));
      raios.push(linha);
    }
    const ponto = (i, j) => {
      const fi = (i / aneis) * Math.PI;
      const fj = ((j % fatias) / fatias) * Math.PI * 2;
      const r = raios[i][j % fatias];
      return [
        cx + Math.sin(fi) * Math.cos(fj) * r,
        cy + Math.cos(fi) * r * achatar,
        cz + Math.sin(fi) * Math.sin(fj) * r,
      ];
    };
    for (let i = 0; i < aneis; i++) {
      for (let j = 0; j < fatias; j++) {
        const a = ponto(i, j);
        const b = ponto(i, j + 1);
        const c = ponto(i + 1, j + 1);
        const d = ponto(i + 1, j);
        if (i === 0) tri(a, c, d, cor, extra);
        else if (i === aneis - 1) tri(a, b, d, cor, extra);
        else quadrilatero(a, b, c, d, cor, extra);
      }
    }
  }

  return {
    tri,
    quadrilatero,
    caixa,
    prisma,
    bolha,
    // Troca o canal extra pelo peso de vento: zero no pe, um na ponta.
    aplicarVento(forca, pisoY = null) {
      const piso = pisoY === null ? minY : pisoY;
      const faixa = Math.max(0.001, maxY - piso);
      for (let i = 0; i < dados.length; i += 10) {
        const t = Math.min(1, Math.max(0, (dados[i + 1] - piso) / faixa));
        dados[i + 9] = t * t * forca;
      }
    },
    get triangulos() { return dados.length / 30; },
    get alto() { return maxY; },
    fim() { return new Float32Array(dados); },
  };
}

function sorteador(semente) {
  let estado = (semente | 0) || 1;
  return () => {
    estado = (estado * 1103515245 + 12345) & 0x7fffffff;
    return estado / 0x7fffffff;
  };
}

// --------------------------------------------------------------- vegetacao
// Mandacaru: coluna de sete gomos e dois ou tres bracos que sobem em L.
// E a silhueta que diz "caatinga" de longe, e por isso ele e o modelo mais
// caprichado do mato.
export function mandacaru(semente = 7) {
  const m = construtor();
  const s = sorteador(semente);
  // Verde de mandacaru: cinza-esverdeado, nunca verde de jardim. Os valores
  // sao sRGB e sobem em relacao a primeira versao porque, depois da correcao
  // de gama, a coluna vertical quase nao pega sol de meio-dia e saia preta.
  const verde = [0.345, 0.443, 0.290];
  const claro = [0.451, 0.541, 0.337];
  const alturaTronco = 1.5 + s() * 1.0;
  m.prisma(0, 0, 0, 0.17, 0.13, alturaTronco, 7, verde);
  m.prisma(0, alturaTronco - 0.02, 0, 0.13, 0.05, 0.22, 7, claro);

  const bracos = 2 + (s() > 0.55 ? 1 : 0);
  for (let b = 0; b < bracos; b++) {
    const ang = s() * Math.PI * 2;
    const alturaDoBraco = 0.4 + s() * (alturaTronco - 0.75);
    const dx = Math.cos(ang) * 0.32;
    const dz = Math.sin(ang) * 0.32;
    m.prisma(0, alturaDoBraco, 0, 0.11, 0.10, 0.1, 6, verde, 0, dx, dz);
    const sobe = 0.45 + s() * 0.6;
    m.prisma(dx, alturaDoBraco + 0.06, dz, 0.105, 0.085, sobe, 6, verde);
    m.prisma(dx, alturaDoBraco + sobe, dz, 0.085, 0.04, 0.14, 6, claro);
  }
  m.aplicarVento(0.035, 0);
  return m;
}

// Arbusto seco: galho torto que nao tem folha nenhuma. A caatinga na seca e
// mais galho que folha, e o jogo se passa na seca.
export function arbusto(semente = 3) {
  const m = construtor();
  const s = sorteador(semente);
  const pau = [0.388, 0.322, 0.235];
  const ponta = [0.478, 0.412, 0.294];
  const galhos = 5 + Math.floor(s() * 4);
  for (let g = 0; g < galhos; g++) {
    const ang = (g / galhos) * Math.PI * 2 + s() * 0.7;
    const alto = 0.4 + s() * 0.55;
    const abre = 0.16 + s() * 0.3;
    m.prisma(0, 0, 0, 0.035, 0.014, alto, 4, pau, 0,
      Math.cos(ang) * abre, Math.sin(ang) * abre);
    if (s() > 0.4) {
      m.prisma(Math.cos(ang) * abre, alto * 0.72, Math.sin(ang) * abre,
        0.02, 0.008, 0.22, 4, ponta, 0, Math.cos(ang + 1) * 0.12, Math.sin(ang + 1) * 0.12);
    }
  }
  m.aplicarVento(0.09, 0);
  return m;
}

// Juazeiro: a arvore que fica verde na seca, e a que marca o vale do rio.
export function juazeiro(semente = 11) {
  const m = construtor();
  const s = sorteador(semente);
  const tronco = [0.298, 0.235, 0.161];
  const copa = [0.220, 0.310, 0.169];
  const copaClara = [0.286, 0.376, 0.204];
  const altura = 2.4 + s() * 1.8;
  m.prisma(0, 0, 0, 0.19, 0.12, altura, 6, tronco);
  const bolas = 3 + Math.floor(s() * 2);
  for (let b = 0; b < bolas; b++) {
    const ang = s() * Math.PI * 2;
    const raio = 0.5 + s() * 0.55;
    const dist = b === 0 ? 0 : 0.35 + s() * 0.5;
    m.bolha(Math.cos(ang) * dist, altura + 0.15 + s() * 0.4, Math.sin(ang) * dist,
      raio, b % 2 ? copaClara : copa, 0,
      { aneis: 3, fatias: 6, achatar: 0.78, irregular: 0.3, semente: semente * 17 + b });
  }
  m.aplicarVento(0.055, 0);
  return m;
}

// Moita de capim: quatro leques cruzados. Custa pouco e e o que faz o chao
// parar de ser plano na hora que o vento passa.
export function moita(semente = 5) {
  const m = construtor();
  const s = sorteador(semente);
  const capim = [0.412, 0.396, 0.224];
  const seco = [0.494, 0.451, 0.275];
  for (let l = 0; l < 5; l++) {
    const ang = (l / 5) * Math.PI * 2 + s();
    const alto = 0.22 + s() * 0.3;
    const largo = 0.08 + s() * 0.05;
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const ex = -dz * largo;
    const ez = dx * largo;
    m.tri([ex, 0, ez], [-ex, 0, -ez],
      [dx * 0.16, alto, dz * 0.16], l % 2 ? capim : seco);
    m.tri([-ex, 0, -ez], [ex, 0, ez],
      [dx * 0.16, alto, dz * 0.16], l % 2 ? capim : seco);
  }
  m.aplicarVento(0.14, 0);
  return m;
}

export function pedra(semente = 13) {
  const m = construtor();
  const s = sorteador(semente);
  const parda = [0.380, 0.349, 0.310];
  m.bolha(0, 0.16 + s() * 0.1, 0, 0.28 + s() * 0.3, parda, 0,
    { aneis: 3, fatias: 6, achatar: 0.7, irregular: 0.55, semente: semente * 7 + 3 });
  return m;
}

// Lajedo de serra: laje inclinada mais um bloco quebrado atras. Antes eram
// caixas empilhadas e a serra saiu na captura de tela parecendo um canteiro
// de obras — cubo cinza atras de cubo cinza.
export function lajedo(semente = 17) {
  const m = construtor();
  const s = sorteador(semente);
  const pedraCor = [0.353, 0.322, 0.294];
  const topoCor = [0.478, 0.443, 0.396];
  const alto = 0.9 + s() * 1.5;
  m.prisma(0, 0, 0, 0.42 + s() * 0.2, 0.16 + s() * 0.12, alto, 5, pedraCor, 0,
    (s() - 0.5) * 0.7, (s() - 0.5) * 0.7);
  m.bolha((s() - 0.5) * 0.8, 0.22, (s() - 0.5) * 0.8, 0.3 + s() * 0.26, topoCor, 0,
    { aneis: 3, fatias: 5, achatar: 0.62, irregular: 0.6, semente: semente * 11 + 5 });
  if (s() > 0.5) {
    m.prisma((s() - 0.5) * 1.0, 0, (s() - 0.5) * 1.0, 0.24, 0.1, alto * 0.55, 5,
      pedraCor, 0, (s() - 0.5) * 0.4, (s() - 0.5) * 0.4);
  }
  return m;
}

// Crosta de sal: placas finas e brancas que estouram no sol do meio-dia.
export function crostaDeSal(semente = 19) {
  const m = construtor();
  const s = sorteador(semente);
  const branco = [0.925, 0.910, 0.863];
  for (let p = 0; p < 4; p++) {
    const ang = s() * Math.PI * 2;
    const r = 0.18 + s() * 0.26;
    const alto = 0.02 + s() * 0.05;
    m.caixa(Math.cos(ang) * 0.2, alto, Math.sin(ang) * 0.2, r, alto, r * 0.8,
      branco, 0, s() * Math.PI);
  }
  return m;
}

// ------------------------------------------------------------------- vila

// Casa de taipa: parede, telhado de duas aguas, porta e janela. O telhado e
// vermelho de proposito — e a unica cor quente forte do mundo, e e ela que
// anuncia a vila a oitenta passos.
export function casa(semente = 23) {
  const m = construtor();
  const s = sorteador(semente);
  const parede = [0.686, 0.588, 0.447];
  const paredeSombra = [0.596, 0.506, 0.384];
  const telha = [0.639, 0.310, 0.208];
  const telhaEscura = [0.522, 0.243, 0.161];
  const madeira = [0.286, 0.208, 0.141];

  const largo = 1.5 + s() * 0.5;
  const fundo = 1.3 + s() * 0.4;
  const alto = 1.15 + s() * 0.25;
  m.caixa(0, alto / 2, 0, largo, alto / 2, fundo, parede);

  // telhado de duas aguas apontando em Z
  const beira = 0.22;
  const cume = alto + 0.62;
  const lx = largo + beira;
  const lz = fundo + beira;
  const c0 = [-lx, cume, 0];
  const c1 = [lx, cume, 0];
  m.quadrilatero([-lx, alto, lz], [lx, alto, lz], c1, c0, telha);
  m.quadrilatero([lx, alto, -lz], [-lx, alto, -lz], c0, c1, telha);
  m.tri([-lx, alto, -lz], [-lx, alto, lz], c0, telhaEscura);
  m.tri([lx, alto, lz], [lx, alto, -lz], c1, telhaEscura);

  m.caixa(0, 0.42, fundo + 0.01, 0.26, 0.42, 0.02, madeira);
  m.caixa(largo * 0.55, alto * 0.62, fundo + 0.01, 0.17, 0.15, 0.02, paredeSombra);
  return m;
}

// Mourao de cerca com duas travessas. Desenhado uma vez e repetido: e a cerca
// que faz a vila ter contorno em vez de ser um punhado de casas.
export function mourao(semente = 29) {
  const m = construtor();
  const s = sorteador(semente);
  const pau = [0.353, 0.271, 0.173];
  m.prisma(0, 0, 0, 0.055, 0.045, 1.0 + s() * 0.18, 5, pau);
  m.caixa(0.5, 0.72, 0, 0.5, 0.035, 0.028, pau);
  m.caixa(0.5, 0.42, 0, 0.5, 0.032, 0.026, pau);
  return m;
}

// Cruzeiro: dois paus e uma pedra. Tem cinco metros e e o que se ve primeiro
// quando a vila ainda e um ponto no horizonte.
export function cruzeiro() {
  const m = construtor();
  const pau = [0.404, 0.322, 0.212];
  const base = [0.478, 0.451, 0.412];
  m.caixa(0, 0.18, 0, 0.42, 0.18, 0.42, base);
  m.caixa(0, 2.0, 0, 0.11, 1.85, 0.11, pau);
  m.caixa(0, 2.9, 0, 0.62, 0.1, 0.1, pau);
  return m;
}

// Cacimba: anel de pedra com a agua escura no fundo.
export function cacimba() {
  const m = construtor();
  const pedraCor = [0.451, 0.427, 0.376];
  const agua = [0.180, 0.310, 0.286];
  m.prisma(0, 0, 0, 0.62, 0.60, 0.42, 9, pedraCor);
  const lados = 9;
  for (let i = 0; i < lados; i++) {
    const a0 = (i / lados) * Math.PI * 2;
    const a1 = ((i + 1) / lados) * Math.PI * 2;
    m.tri([0, 0.43, 0],
      [Math.cos(a1) * 0.52, 0.43, Math.sin(a1) * 0.52],
      [Math.cos(a0) * 0.52, 0.43, Math.sin(a0) * 0.52], agua);
  }
  return m;
}

// ----------------------------------------------------------------- gente

// Ossos: 0 quadril, 1 torso, 2 cabeca, 3 braco de tras, 4 braco da frente,
// 5 perna de tras, 6 perna da frente. O modelo olha para +X.
export function gente(estilo = {}) {
  const m = construtor();
  const roupa = estilo.roupa || [0.847, 0.804, 0.702];
  const calca = estilo.calca || [0.353, 0.318, 0.255];
  const pele = estilo.pele || [0.706, 0.545, 0.408];
  const chapeuCor = estilo.chapeu || [0.510, 0.396, 0.239];
  const cinto = [0.286, 0.216, 0.149];

  // pernas
  m.prisma(0, 0.10, -0.13, 0.085, 0.075, 0.72, 5, calca, 5);
  m.prisma(0, 0.10, 0.13, 0.085, 0.075, 0.72, 5, calca, 6);
  m.caixa(0.03, 0.05, -0.13, 0.13, 0.05, 0.085, cinto, 5);
  m.caixa(0.03, 0.05, 0.13, 0.13, 0.05, 0.085, cinto, 6);

  // tronco
  m.caixa(0, 1.06, 0, 0.14, 0.24, 0.20, roupa, 1);
  m.caixa(0, 0.83, 0, 0.13, 0.05, 0.19, cinto, 1);
  m.caixa(0, 1.28, 0, 0.10, 0.06, 0.15, roupa, 1);

  // bracos
  m.prisma(0, 0.70, -0.24, 0.05, 0.058, 0.52, 5, roupa, 3);
  m.prisma(0, 0.70, 0.24, 0.05, 0.058, 0.52, 5, roupa, 4);
  m.bolha(0, 0.70, -0.24, 0.062, pele, 3, { aneis: 2, fatias: 5 });
  m.bolha(0, 0.70, 0.24, 0.062, pele, 4, { aneis: 2, fatias: 5 });

  // cabeca e chapeu de couro
  m.bolha(0.01, 1.47, 0, 0.125, pele, 2, { aneis: 4, fatias: 7, achatar: 1.12 });
  if (estilo.chapeuDeCangaco) {
    // aba levantada na frente: a silhueta do cangaceiro
    m.prisma(0, 1.55, 0, 0.30, 0.34, 0.04, 9, chapeuCor, 2);
    m.prisma(-0.12, 1.58, 0, 0.16, 0.20, 0.34, 7, chapeuCor, 2, 0.1, 0);
    m.caixa(0.20, 1.72, 0, 0.13, 0.19, 0.24, chapeuCor, 2, 0);
  } else {
    m.prisma(0, 1.55, 0, 0.29, 0.31, 0.035, 9, chapeuCor, 2);
    m.prisma(0, 1.57, 0, 0.145, 0.125, 0.19, 7, chapeuCor, 2);
    m.prisma(0, 1.76, 0, 0.125, 0.125, 0.015, 7, chapeuCor, 2);
  }

  if (estilo.cantil) {
    // Cantil no cinto, no osso 7: e o unico medidor diegetico do jogo — o
    // render encolhe esse osso conforme a agua acaba.
    m.prisma(-0.13, 0.78, 0.15, 0.09, 0.085, 0.19, 7, [0.451, 0.384, 0.251], 7);
    m.caixa(-0.13, 0.98, 0.15, 0.035, 0.03, 0.035, [0.290, 0.243, 0.165], 7);
  }
  if (estilo.faca) {
    m.caixa(0.30, 1.02, 0.22, 0.16, 0.022, 0.035, [0.788, 0.804, 0.824], 4);
  }
  return m;
}

// Onca: corpo baixo e comprido, cabeca larga, cauda de tres gomos e pintas
// coladas no lombo. Ossos: 0 corpo, 1 cabeca, 2..5 patas, 6 cauda.
export function onca() {
  const m = construtor();
  const pelo = [0.784, 0.573, 0.227];
  const barriga = [0.882, 0.808, 0.639];
  const pinta = [0.196, 0.137, 0.075];

  m.caixa(0, 0.52, 0, 0.42, 0.20, 0.22, pelo, 0);
  m.caixa(0.44, 0.54, 0, 0.12, 0.17, 0.19, pelo, 0);
  m.caixa(-0.42, 0.50, 0, 0.10, 0.16, 0.18, pelo, 0);
  m.caixa(0, 0.34, 0, 0.36, 0.06, 0.17, barriga, 0);

  // cabeca
  m.caixa(0.66, 0.60, 0, 0.16, 0.145, 0.165, pelo, 1);
  m.caixa(0.84, 0.545, 0, 0.09, 0.085, 0.105, pelo, 1);
  m.caixa(0.92, 0.52, 0, 0.03, 0.04, 0.06, pinta, 1);
  m.tri([0.70, 0.76, -0.12], [0.62, 0.74, -0.15], [0.68, 0.90, -0.14], pelo, 1);
  m.tri([0.62, 0.74, 0.15], [0.70, 0.76, 0.12], [0.68, 0.90, 0.14], pelo, 1);

  // patas
  m.prisma(0.30, 0.04, -0.17, 0.072, 0.062, 0.36, 5, pelo, 2);
  m.prisma(0.30, 0.04, 0.17, 0.072, 0.062, 0.36, 5, pelo, 3);
  m.prisma(-0.30, 0.04, -0.17, 0.078, 0.066, 0.34, 5, pelo, 4);
  m.prisma(-0.30, 0.04, 0.17, 0.078, 0.066, 0.34, 5, pelo, 5);

  // cauda
  m.prisma(-0.52, 0.56, 0, 0.055, 0.045, 0.26, 5, pelo, 6, -0.18, 0);
  m.prisma(-0.70, 0.80, 0, 0.045, 0.03, 0.22, 5, pinta, 6, -0.10, 0);

  // pintas: placas finas presas no lombo e no flanco
  const s = sorteador(97);
  for (let p = 0; p < 14; p++) {
    const ao = s() * Math.PI * 2;
    const x = -0.36 + s() * 0.78;
    const r = 0.035 + s() * 0.03;
    const lado = s() > 0.5 ? 1 : -1;
    if (s() > 0.45) {
      m.caixa(x, 0.723, (s() - 0.5) * 0.34, r, 0.006, r * 1.3, pinta, 0, ao);
    } else {
      m.caixa(x, 0.40 + s() * 0.28, lado * 0.223, r, r * 1.2, 0.006, pinta, 0, 0);
    }
  }
  return m;
}

// --------------------------------------------------------------- recursos

const RECURSOS = {
  couro: (m) => {
    m.caixa(0, 0.10, 0, 0.22, 0.035, 0.17, [0.541, 0.416, 0.267]);
    m.caixa(0, 0.14, 0, 0.16, 0.02, 0.12, [0.365, 0.271, 0.165]);
  },
  mandacaru: (m) => {
    m.prisma(0, 0, 0, 0.06, 0.05, 0.2, 6, [0.278, 0.376, 0.243]);
    m.bolha(0, 0.26, 0, 0.1, [0.753, 0.231, 0.290], 0, { aneis: 3, fatias: 6 });
  },
  madeira: (m) => {
    m.prisma(-0.2, 0.08, 0, 0.07, 0.065, 0.4, 6, [0.376, 0.278, 0.173], 0, 0.4, 0.05);
    m.prisma(-0.16, 0.08, 0.14, 0.055, 0.05, 0.34, 6, [0.451, 0.341, 0.212], 0, 0.34, -0.1);
  },
  sal: (m) => {
    m.bolha(0, 0.11, 0, 0.14, [0.945, 0.937, 0.898], 0,
      { aneis: 3, fatias: 5, achatar: 0.8, irregular: 0.45, semente: 31 });
  },
  peca: (m) => {
    m.prisma(0, 0.02, 0, 0.16, 0.16, 0.07, 8, [0.478, 0.502, 0.533]);
    m.prisma(0, 0.09, 0, 0.07, 0.07, 0.12, 6, [0.337, 0.361, 0.392]);
  },
  chave: (m) => {
    m.prisma(0, 0.1, 0, 0.09, 0.09, 0.03, 7, [0.667, 0.588, 0.294]);
    m.caixa(0.16, 0.115, 0, 0.13, 0.018, 0.018, [0.667, 0.588, 0.294]);
  },
};

export function recurso(tipo) {
  const m = construtor();
  (RECURSOS[tipo] || RECURSOS.peca)(m);
  return m;
}

// Anel no chao: marcador de alcance de golpe, de alvo de missao e de quem
// esta irritado. Fica deitado em Y=0 e o render levanta pelo terreno.
export function anel(raioInterno, raioExterno, lados = 28) {
  const m = construtor();
  const branco = [1, 1, 1];
  for (let i = 0; i < lados; i++) {
    const a0 = (i / lados) * Math.PI * 2;
    const a1 = ((i + 1) / lados) * Math.PI * 2;
    // Angulo crescente anda no sentido horario visto de cima, entao a ordem
    // e interno-a0, interno-a1, externo-a1, externo-a0 para o anel olhar
    // para cima. Na ordem contraria ele some com o descarte de face de tras.
    m.quadrilatero(
      [Math.cos(a0) * raioInterno, 0, Math.sin(a0) * raioInterno],
      [Math.cos(a1) * raioInterno, 0, Math.sin(a1) * raioInterno],
      [Math.cos(a1) * raioExterno, 0, Math.sin(a1) * raioExterno],
      [Math.cos(a0) * raioExterno, 0, Math.sin(a0) * raioExterno],
      branco);
  }
  return m;
}

// Quadrado de um por um em XY, virado para +Z. Serve de particula, de barra de
// vida e de letreiro.
export function placa() {
  const m = construtor();
  m.quadrilatero([-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 0], [1, 1, 1]);
  return m;
}
