// silhuetas.js — a forma de cada modelo inimigo.
//
// Antes todos os inimigos eram a mesma capsula com cores diferentes: no meio do
// tiroteio, cor nao e informacao suficiente, porque com quatro deles na tela o
// jogador nao consegue comparar tom de longe. A forma sim: da para saber quem e
// o Grok pela silhueta torta antes de ler qualquer placa.
//
// Cada funcao recebe uma funcao `peca(material, geometria, x, y, z, rx, ry, rz)`
// e declara o proprio corpo. O inimigo junta as pecas por material no fim, entao
// a contagem de chamadas de desenho nao muda com o nivel de detalhe.
//
// A frente do inimigo e +Z (o `facing` entra como sin/cos na direcao de
// movimento), entao visor, olho e nucleo ficam em Z positivo.

import * as THREE from '../../vendor/three.module.js';

// As geometrias sao criadas uma vez e compartilhadas por todas as instancias.
// O nome diz o papel, nao o tamanho, para os construtores lerem melhor.
export const G = {
  esferaXg: new THREE.SphereGeometry(0.60, 20, 16),
  esferaG: new THREE.SphereGeometry(0.50, 18, 14),
  esferaM: new THREE.SphereGeometry(0.34, 16, 12),
  esferaP: new THREE.SphereGeometry(0.26, 14, 10),
  esferaMini: new THREE.SphereGeometry(0.12, 12, 10),
  esferaLuz: new THREE.SphereGeometry(0.055, 8, 6),

  caixaTorso: new THREE.BoxGeometry(0.46, 0.92, 0.40),
  caixaBlindada: new THREE.BoxGeometry(0.94, 0.82, 0.60),
  caixaCabeca: new THREE.BoxGeometry(0.40, 0.32, 0.40),
  caixaCabecaG: new THREE.BoxGeometry(0.50, 0.40, 0.46),
  caixaBraco: new THREE.BoxGeometry(0.11, 0.36, 0.11),
  caixaBracoLongo: new THREE.BoxGeometry(0.085, 0.66, 0.085),
  caixaBracoGrosso: new THREE.BoxGeometry(0.17, 0.46, 0.17),
  caixaPe: new THREE.BoxGeometry(0.18, 0.08, 0.26),
  caixaVisor: new THREE.BoxGeometry(0.32, 0.10, 0.06),
  caixaVisorG: new THREE.BoxGeometry(0.46, 0.16, 0.07),
  caixaFocinho: new THREE.BoxGeometry(0.17, 0.13, 0.16),
  caixaNucleo: new THREE.BoxGeometry(0.30, 0.26, 0.10),

  cilPerna: new THREE.CylinderGeometry(0.09, 0.12, 0.44, 12),
  cilPernaFina: new THREE.CylinderGeometry(0.032, 0.05, 0.72, 8),
  cilPernaCurta: new THREE.CylinderGeometry(0.10, 0.13, 0.34, 10),
  cilPernaGrossa: new THREE.CylinderGeometry(0.15, 0.18, 0.52, 12),
  cilTronco: new THREE.CylinderGeometry(0.21, 0.27, 0.96, 16),
  cilAntena: new THREE.CylinderGeometry(0.017, 0.017, 0.30, 6),
  cilCano: new THREE.CylinderGeometry(0.035, 0.045, 0.30, 8),
  cilGola: new THREE.CylinderGeometry(0.21, 0.24, 0.10, 16),
  cilOlho: new THREE.CylinderGeometry(0.19, 0.19, 0.10, 16),

  coneToga: new THREE.ConeGeometry(0.38, 0.70, 16),
  coneEspinho: new THREE.ConeGeometry(0.085, 0.44, 8),
  coneOrelha: new THREE.ConeGeometry(0.085, 0.24, 8),

  torusAureola: new THREE.TorusGeometry(0.30, 0.032, 8, 22),
  torusNucleo: new THREE.TorusGeometry(0.25, 0.05, 10, 26),
  torusCinto: new THREE.TorusGeometry(0.30, 0.05, 8, 20),

  octaCorpo: new THREE.OctahedronGeometry(0.46, 0),
  icoNucleo: new THREE.IcosahedronGeometry(0.16, 0),

  lomboOvelha: new THREE.SphereGeometry(0.245, 14, 11)
};

// ------------------------------------------------------------------
// Qwen 3 Turbo — o enxame
// Pequeno, leve, quatro pernas finas de aranha. Nao tem cabeca: o corpo e o
// olho. Le como algo que existe em quantidade.
// ------------------------------------------------------------------
function qwen(peca, m) {
  peca(m.corpo, G.esferaM, 0, 0.92, 0);

  // olho unico, grande em relacao ao corpo
  peca(m.luz, G.esferaMini, 0, 1.00, 0.26);

  for (const lado of [-1, 1]) {
    for (const frente of [-1, 1]) {
      peca(m.escuro, G.cilPernaFina,
        lado * 0.26, 0.42, frente * 0.20,
        frente * 0.16, 0, lado * -0.30);
      peca(m.escuro, G.esferaMini, lado * 0.40, 0.10, frente * 0.30);
    }
  }

  peca(m.escuro, G.cilAntena, 0.09, 1.28, -0.06, -0.22);
  peca(m.escuro, G.cilAntena, -0.09, 1.28, -0.06, -0.22);
  peca(m.luz, G.esferaLuz, 0.12, 1.42, -0.02);
  peca(m.luz, G.esferaLuz, -0.12, 1.42, -0.02);

  return { altura: 1.50, decalque: [0.92, 0.31] };
}

// ------------------------------------------------------------------
// Llama Base — a ovelha
// Massa arredondada de la, cabeca pequena com orelhas e pernas curtas. E o
// unico modelo cujo volume sugere peso, o que combina com ele se reproduzir.
// ------------------------------------------------------------------
function llama(peca, m) {
  peca(m.corpo, G.esferaG, 0, 1.00, 0);

  // la: esferas em volta do corpo
  const voltas = 8;
  for (let i = 0; i < voltas; i++) {
    const a = (i / voltas) * Math.PI * 2;
    peca(m.corpo, G.lomboOvelha, Math.cos(a) * 0.40, 1.00 + Math.sin(a * 2) * 0.16, Math.sin(a) * 0.34);
  }
  peca(m.corpo, G.lomboOvelha, 0, 1.52, 0);
  peca(m.corpo, G.lomboOvelha, 0, 0.52, 0);

  // cabeca com focinho e orelhas
  peca(m.corpo, G.esferaP, 0, 1.46, 0.36);
  peca(m.escuro, G.caixaFocinho, 0, 1.42, 0.56);
  peca(m.escuro, G.coneOrelha, -0.20, 1.62, 0.34, 0, 0, 0.5);
  peca(m.escuro, G.coneOrelha, 0.20, 1.62, 0.34, 0, 0, -0.5);
  peca(m.luz, G.esferaMini, -0.11, 1.52, 0.52);
  peca(m.luz, G.esferaMini, 0.11, 1.52, 0.52);

  for (const lado of [-1, 1]) {
    for (const frente of [-1, 1]) {
      peca(m.escuro, G.cilPernaCurta, lado * 0.26, 0.30, frente * 0.22);
      peca(m.escuro, G.caixaPe, lado * 0.26, 0.06, frente * 0.24);
    }
  }

  return { altura: 1.85, decalque: [1.00, 0.47] };
}

// ------------------------------------------------------------------
// Haiku 4.5 — a Ordem Constitucional
// Esguio e alto. Toga, aureola e bracos longos: elegante e educado, como o
// ataque de recusa. A aureola e a assinatura visual dele a distancia.
// ------------------------------------------------------------------
function haiku(peca, m) {
  peca(m.corpo, G.coneToga, 0, 0.62, 0);
  peca(m.corpo, G.cilTronco, 0, 1.42, 0);

  peca(m.escuro, G.torusCinto, 0, 0.98, 0, Math.PI / 2);
  peca(m.luz, G.torusCinto, 0, 1.72, 0, Math.PI / 2);

  peca(m.corpo, G.esferaP, 0, 2.06, 0);
  peca(m.escuro, G.caixaVisor, 0, 2.08, 0.24);

  // aureola: o detalhe que identifica a faccao de longe
  peca(m.luz, G.torusAureola, 0, 2.40, 0, Math.PI / 2);

  for (const lado of [-1, 1]) {
    peca(m.escuro, G.cilPernaFina, lado * 0.16, 0.30, 0);
    peca(m.escuro, G.caixaPe, lado * 0.16, 0.04, 0.02);
    peca(m.corpo, G.caixaBracoLongo, lado * 0.34, 1.30, -0.02, -0.10, 0, lado * 0.14);
    peca(m.escuro, G.cilGola, lado * 0.34, 0.98, 0);
  }

  peca(m.escuro, G.cilCano, 0.34, 1.02, 0.22, Math.PI / 2);

  return { altura: 2.60, decalque: [1.48, 0.26] };
}

// ------------------------------------------------------------------
// GPT-5.5 — os Fechados
// Blindado e largo. Torso de caixa, ombreiras enormes e o nucleo circular
// aceso no peito, que e a marca dele. Le como algo que aguenta o que voce tem.
// ------------------------------------------------------------------
function gpt(peca, m) {
  peca(m.corpo, G.caixaBlindada, 0, 1.32, 0);

  // nucleo no peito: o anel mais a esfera dentro
  peca(m.luz, G.torusNucleo, 0, 1.38, 0.31);
  peca(m.luz, G.esferaP, 0, 1.38, 0.30);

  peca(m.escuro, G.caixaCabeca, 0, 2.02, 0);
  peca(m.luz, G.caixaVisorG, 0, 2.04, 0.22);

  for (const lado of [-1, 1]) {
    peca(m.escuro, G.esferaM, lado * 0.58, 1.66, 0);
    peca(m.corpo, G.caixaBracoGrosso, lado * 0.56, 1.24, -0.04);
    peca(m.escuro, G.cilPernaGrossa, lado * 0.26, 0.42, 0);
    peca(m.escuro, G.caixaPe, lado * 0.26, 0.06, 0.04);
  }

  peca(m.escuro, G.cilGola, 0, 1.80, 0);
  peca(m.escuro, G.cilCano, 0.56, 0.96, 0.26, Math.PI / 2);

  return { altura: 2.45, decalque: [1.70, 0.30] };
}

// ------------------------------------------------------------------
// Grok 4.20 — o caotico
// Assimetrico e torto, sem pernas: flutua. Um olho so, maior que o bom senso,
// e espinhos em angulos diferentes. A silhueta desequilibrada e o aviso.
// ------------------------------------------------------------------
function grok(peca, m) {
  peca(m.corpo, G.octaCorpo, 0, 1.30, 0, 0.26, 0.4, 0.18);
  peca(m.escuro, G.icoNucleo, 0, 1.30, 0);

  // olho unico
  peca(m.escuro, G.cilOlho, 0, 1.36, 0.30);
  peca(m.luz, G.esferaP, 0, 1.36, 0.40);

  // espinhos em angulos irregulares
  peca(m.escuro, G.coneEspinho, 0.34, 1.72, -0.10, -0.5, 0, -0.7);
  peca(m.escuro, G.coneEspinho, -0.30, 1.66, 0.16, 0.6, 0, 0.6);
  peca(m.escuro, G.coneEspinho, 0.12, 0.94, -0.34, 2.5, 0, 0.3);
  peca(m.escuro, G.coneEspinho, -0.36, 1.10, -0.24, 2.1, 0, -1.0);

  // bracos desiguais de proposito
  peca(m.corpo, G.caixaBracoLongo, 0.48, 1.40, 0.04, -0.3, 0, -0.28);
  peca(m.corpo, G.caixaBraco, -0.48, 1.30, -0.04, 0.2, 0, 0.34);
  peca(m.luz, G.esferaLuz, 0.62, 1.08, 0.16);
  peca(m.luz, G.esferaLuz, -0.44, 1.08, -0.16);

  return { altura: 2.05, decalque: [1.24, 0.35] };
}

const MODELOS = {
  qwen_turbo: qwen,
  llama_base: llama,
  haiku_45: haiku,
  gpt_55: gpt,
  grok_420: grok
};

// Constroi a silhueta do modelo. Devolve a altura para a placa de nome se
// posicionar sozinha, sem numero magico espalhado pelo inimigo.
export function construirSilhueta(id, peca, mats) {
  const construtor = MODELOS[id] || llama;
  return construtor(peca, mats);
}
