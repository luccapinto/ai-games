// O que nasce em cada celula do mundo: mandacaru, arbusto, moita, juazeiro,
// pedra, lajedo de serra, crosta de sal — e o que o homem pos: casa, cerca,
// cruzeiro e cacimba.
//
// Tudo sai de embaralhar a coordenada da celula, entao o mesmo mundo da sempre
// a mesma mata. Nada de Math.random: semente igual, sertao igual, inclusive no
// que e so enfeite.

import { TERRENOS } from '../mundo.js';
import { CONFIG } from '../regras.js';

const FLOATS_POR_INSTANCIA = 8;

function embaralhar(x, y, sal) {
  let h = (x * 374761393 + y * 668265263 + sal * 2654435761) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function criarLista() {
  return { valores: [], conta: 0 };
}

function por(lista, x, y, z, escala, giro, tom) {
  lista.valores.push(x, y, z, escala, giro, tom[0], tom[1], tom[2]);
  lista.conta++;
}

const TOM_NEUTRO = [1, 1, 1];
const tomDe = (k, forca) => [
  1 + (k - 0.5) * forca,
  1 + (k - 0.5) * forca * 0.86,
  1 + (k - 0.5) * forca * 0.72,
];

export function povoarMundo(mundo, campo) {
  const { largura, altura, terreno, estrada } = mundo;
  const listas = {
    mandacaru: criarLista(),
    arbusto: criarLista(),
    moita: criarLista(),
    juazeiro: criarLista(),
    pedra: criarLista(),
    lajedo: criarLista(),
    crosta: criarLista(),
    casa: criarLista(),
    mourao: criarLista(),
    cruzeiro: criarLista(),
    cacimba: criarLista(),
  };

  // Distancia ao centro de vila mais proximo, para nao plantar mandacaru no
  // meio do terreiro nem cerca por cima de casa.
  const pertoDeVila = (x, y) => {
    for (const vila of mundo.vilas) {
      if (Math.hypot(vila.x - x, vila.y - y) < 9) return true;
    }
    return false;
  };

  for (let y = 1; y < altura - 1; y++) {
    for (let x = 1; x < largura - 1; x++) {
      const i = y * largura + x;
      const tipo = terreno[i];
      if (tipo === TERRENOS.agua) continue;
      if (estrada[i] === 1) continue;

      const k = embaralhar(x, y, 1);
      const k2 = embaralhar(x, y, 2);
      const k3 = embaralhar(x, y, 3);
      const px = x + 0.22 + k2 * 0.56;
      const pz = y + 0.22 + k3 * 0.56;
      const py = campo.em(px, pz);
      const giro = k2 * Math.PI * 2;
      const naVila = pertoDeVila(x, y);

      if (tipo === TERRENOS.caatinga) {
        if (naVila) {
          if (k < 0.05) por(listas.moita, px, py, pz, 0.8 + k3 * 0.5, giro, TOM_NEUTRO);
          continue;
        }
        // Mandacaru e silhueta, nao floresta: a 5,5% por celula a caatinga
        // virava um canavial de colunas verdes iguais na captura de tela.
        if (k < 0.032) por(listas.mandacaru, px, py, pz, 0.8 + k3 * 0.85, giro, tomDe(k2, 0.26));
        else if (k < 0.145) por(listas.arbusto, px, py, pz, 0.8 + k3 * 0.7, giro, tomDe(k2, 0.22));
        else if (k < 0.225) por(listas.moita, px, py, pz, 0.7 + k3 * 0.6, giro, tomDe(k2, 0.26));
        else if (k < 0.245) por(listas.pedra, px, py, pz, 0.7 + k3 * 0.8, giro, tomDe(k2, 0.18));
      } else if (tipo === TERRENOS.mata) {
        if (k < 0.2) por(listas.juazeiro, px, py, pz, 0.75 + k3 * 0.6, giro, tomDe(k2, 0.24));
        else if (k < 0.46) por(listas.moita, px, py, pz, 0.9 + k3 * 0.7, giro, tomDe(k2, 0.3));
        else if (k < 0.5) por(listas.arbusto, px, py, pz, 0.9 + k3 * 0.5, giro, tomDe(k2, 0.2));
      } else if (tipo === TERRENOS.serra) {
        if (k < 0.075) por(listas.lajedo, px, py, pz, 0.9 + k3 * 1.1, giro, tomDe(k2, 0.2));
        else if (k < 0.14) por(listas.pedra, px, py, pz, 0.8 + k3 * 1.0, giro, tomDe(k2, 0.2));
      } else if (tipo === TERRENOS.salina) {
        if (k < 0.1) por(listas.crosta, px, py, pz, 0.8 + k3 * 0.8, giro, TOM_NEUTRO);
      } else if (tipo === TERRENOS.roca) {
        if (!naVila && k < 0.12) por(listas.moita, px, py, pz, 0.9 + k3 * 0.5, giro, tomDe(k2, 0.2));
      }
    }
  }

  // ------------------------------------------------------------- as vilas
  for (const [n, vila] of mundo.vilas.entries()) {
    for (const [c, casa] of vila.casas.entries()) {
      // Afasta a casa do centro: no mundo ela nasce a dois passos e meio e em
      // 3D isso empilha telhado em cima de gente e prende a camera. A 1,75 o
      // terreiro fica limpo, com cruzeiro e cacimba no meio.
      const dx = (casa.x - vila.x) * 1.75;
      const dz = (casa.y - vila.y) * 1.75;
      const px = vila.x + 0.5 + dx;
      const pz = vila.y + 0.5 + dz;
      por(listas.casa, px, campo.em(px, pz) - 0.12, pz,
        0.92 + ((c * 7 + n) % 5) * 0.05, casa.ang * 1.7, TOM_NEUTRO);
    }

    const raioDaCerca = CONFIG.raioDeVila - 0.6;
    const mouroes = 26;
    for (let p = 0; p < mouroes; p++) {
      const ang = (p / mouroes) * Math.PI * 2;
      const px = vila.x + 0.5 + Math.cos(ang) * raioDaCerca;
      const pz = vila.y + 0.5 + Math.sin(ang) * raioDaCerca;
      const cx = Math.floor(px);
      const cz = Math.floor(pz);
      if (cx < 0 || cz < 0 || cx >= largura || cz >= altura) continue;
      // portao onde a estrada entra
      if (mundo.estrada[cz * largura + cx] === 1) continue;
      if (terreno[cz * largura + cx] === TERRENOS.agua) continue;
      por(listas.mourao, px, campo.em(px, pz) - 0.05, pz, 1,
        ang + Math.PI / 2 + Math.PI / mouroes, TOM_NEUTRO);
    }
    // O cruzeiro sai do centro exato: e ali que o jogador nasce, e nascer
    // dentro de um pau de cinco metros deixa a camera encostada nele.
    const cx = vila.x + 0.5 - 2.4;
    const cz = vila.y + 0.5 - 2.4;
    por(listas.cruzeiro, cx, campo.em(cx, cz) - 0.1, cz, 1, n * 0.7, TOM_NEUTRO);
    const ax = vila.agua.x + 0.5;
    const az = vila.agua.y + 0.5;
    por(listas.cacimba, ax, campo.em(ax, az) - 0.12, az, 1, n, TOM_NEUTRO);
  }

  const saida = {};
  for (const [nome, lista] of Object.entries(listas)) {
    saida[nome] = {
      dados: new Float32Array(lista.valores),
      conta: lista.conta,
    };
  }
  saida.floats = FLOATS_POR_INSTANCIA;
  return saida;
}
