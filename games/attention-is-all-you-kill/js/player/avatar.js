// avatar.js — o corpo do jogador, usado no retrato da personalizacao.
//
// O jogo e em primeira pessoa e os bracos sairam da tela: com as maos a vista
// um bloco grande ficava na frente da mira e atrapalhava a leitura do combate.
// O corpo vive so aqui, no retrato giratorio da tela de personalizacao, e a cor
// escolhida vale de verdade na arma e na mira.

import * as THREE from '../../vendor/three.module.js';

const PRETO = 0x171d24;
const METAL = 0x39434e;

// ------------------------------------------------------------------
// Corpo completo: usado no retrato da personalizacao.
// ------------------------------------------------------------------
export function construirAvatar(acabamentoHex, luzHex) {
  const g = new THREE.Group();
  const matTraje = new THREE.MeshLambertMaterial({ color: acabamentoHex });
  const matEscuro = new THREE.MeshLambertMaterial({ color: PRETO });
  const matMetal = new THREE.MeshLambertMaterial({ color: METAL });
  const matVisor = new THREE.MeshBasicMaterial({ color: luzHex });

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };

  // pernas
  add(new THREE.CylinderGeometry(0.115, 0.135, 0.62, 12), matTraje, -0.17, 0.52, 0);
  add(new THREE.CylinderGeometry(0.115, 0.135, 0.62, 12), matTraje, 0.17, 0.52, 0);
  add(new THREE.BoxGeometry(0.19, 0.09, 0.28), matEscuro, -0.17, 0.17, 0.03);
  add(new THREE.BoxGeometry(0.19, 0.09, 0.28), matEscuro, 0.17, 0.17, 0.03);

  // joelheira
  add(new THREE.SphereGeometry(0.115, 12, 9), matMetal, -0.17, 0.62, 0.02);
  add(new THREE.SphereGeometry(0.115, 12, 9), matMetal, 0.17, 0.62, 0.02);

  // torso com colete
  add(new THREE.BoxGeometry(0.54, 0.62, 0.34), matTraje, 0, 1.16, 0);
  add(new THREE.BoxGeometry(0.46, 0.40, 0.10), matEscuro, 0, 1.20, 0.20);
  add(new THREE.BoxGeometry(0.50, 0.08, 0.36), matMetal, 0, 0.88, 0);

  // faixa do visor no peito: liga a cor escolhida ao corpo
  add(new THREE.BoxGeometry(0.22, 0.05, 0.02), matVisor, 0, 1.34, 0.26);

  // mochila de contexto
  add(new THREE.BoxGeometry(0.36, 0.40, 0.16), matEscuro, 0, 1.20, -0.24);
  add(new THREE.BoxGeometry(0.10, 0.16, 0.04), matVisor, 0, 1.30, -0.33);

  // ombreiras
  add(new THREE.SphereGeometry(0.155, 14, 10), matMetal, -0.33, 1.42, 0);
  add(new THREE.SphereGeometry(0.155, 14, 10), matMetal, 0.33, 1.42, 0);

  // bracos
  add(new THREE.CylinderGeometry(0.085, 0.10, 0.52, 12), matTraje, -0.36, 1.14, -0.02, 0, 0, 0.10);
  add(new THREE.CylinderGeometry(0.085, 0.10, 0.52, 12), matTraje, 0.36, 1.14, -0.02, 0, 0, -0.10);
  add(new THREE.BoxGeometry(0.13, 0.15, 0.13), matEscuro, -0.40, 0.86, -0.02);
  add(new THREE.BoxGeometry(0.13, 0.15, 0.13), matEscuro, 0.40, 0.86, -0.02);
  add(new THREE.BoxGeometry(0.14, 0.03, 0.14), matVisor, -0.40, 0.80, -0.02);
  add(new THREE.BoxGeometry(0.14, 0.03, 0.14), matVisor, 0.40, 0.80, -0.02);

  // pescoco e capacete
  add(new THREE.CylinderGeometry(0.10, 0.12, 0.10, 12), matEscuro, 0, 1.52, 0);
  add(new THREE.SphereGeometry(0.235, 18, 14), matTraje, 0, 1.76, 0);
  add(new THREE.BoxGeometry(0.36, 0.13, 0.08), matVisor, 0, 1.78, 0.20);

  // antena curta do capacete
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 6), matEscuro, 0.16, 1.98, -0.06, -0.2);
  add(new THREE.SphereGeometry(0.035, 8, 6), matVisor, 0.18, 2.09, -0.08);

  return g;
}
