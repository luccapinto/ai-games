// itens.js — a forma de cada drop.
//
// Antes todo drop era o mesmo octaedro girando com a cor trocada: no chao,
// longe, cor nao diz o que a coisa e. Caixa de municao, capsula de contexto e
// as armas em miniatura resolvem isso a distancia, antes de o jogador chegar
// perto e ler o texto.
//
// Cada construtor devolve um grupo com um no interno que gira e flutua, entao
// o director so precisa animar um objeto por drop.

import * as THREE from '../../vendor/three.module.js';

const ESCURO = 0x232a33;
const QUASE_PRETO = 0x161c23;

function caixa(w, h, d, cor) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color: cor })
  );
}

function cil(rt, rb, h, cor, seg = 14) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(rt, rb, h, seg),
    new THREE.MeshLambertMaterial({ color: cor })
  );
}

function luz(geo, cor) {
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cor }));
}

// ------------------------------------------------------------------
// TOKEN PACK — caixa de municao com cartuchos aparecendo na tampa
// ------------------------------------------------------------------
function municao(cor) {
  const g = new THREE.Group();

  const base = caixa(0.52, 0.26, 0.36, ESCURO);
  base.position.y = 0.14;
  g.add(base);

  const faixa = caixa(0.54, 0.06, 0.38, cor);
  faixa.position.y = 0.28;
  g.add(faixa);

  const tampa = caixa(0.50, 0.05, 0.34, QUASE_PRETO);
  tampa.position.y = 0.32;
  g.add(tampa);

  // cartuchos em fileira: o detalhe que faz ler como municao
  const cart = new THREE.CylinderGeometry(0.045, 0.045, 0.17, 8);
  for (let i = 0; i < 4; i++) {
    const c = luz(cart, 0xd9a24a);
    c.position.set(-0.16 + i * 0.105, 0.43, 0);
    g.add(c);
  }

  const alca = new THREE.Mesh(
    new THREE.TorusGeometry(0.07, 0.017, 8, 16),
    new THREE.MeshBasicMaterial({ color: cor })
  );
  alca.position.set(0, 0.36, -0.19);
  g.add(alca);

  return g;
}

// ------------------------------------------------------------------
// REFRESH CACHE — capsula de vidro com o liquido aceso dentro
// ------------------------------------------------------------------
function contexto(cor) {
  const g = new THREE.Group();

  const vidro = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.46, 16, 1, true),
    new THREE.MeshLambertMaterial({
      color: 0xbfe9ff, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false
    })
  );
  vidro.position.y = 0.40;
  g.add(vidro);

  // o liquido e o que da a leitura de "vida" a distancia
  const liquido = luz(new THREE.CylinderGeometry(0.145, 0.145, 0.26, 16), cor);
  liquido.position.y = 0.30;
  g.add(liquido);

  const tampa = cil(0.115, 0.115, 0.09, ESCURO);
  tampa.position.y = 0.66;
  g.add(tampa);

  const base = cil(0.19, 0.19, 0.06, ESCURO);
  base.position.y = 0.14;
  g.add(base);

  const anel = new THREE.Mesh(
    new THREE.TorusGeometry(0.175, 0.016, 8, 18),
    new THREE.MeshBasicMaterial({ color: cor })
  );
  anel.position.y = 0.47;
  anel.rotation.x = Math.PI / 2;
  g.add(anel);

  return g;
}

// ------------------------------------------------------------------
// Armas em miniatura: a silhueta da arma real, deitada e girando
// ------------------------------------------------------------------
function armaSmg(cor) {
  const g = new THREE.Group();

  const corpo = caixa(0.40, 0.11, 0.10, ESCURO);
  g.add(corpo);

  const cano = cil(0.026, 0.026, 0.26, QUASE_PRETO, 10);
  cano.rotation.z = Math.PI / 2;
  cano.position.set(0.30, 0.01, 0);
  g.add(cano);

  const pente = caixa(0.09, 0.22, 0.08, QUASE_PRETO);
  pente.position.set(0.02, -0.16, 0);
  pente.rotation.z = 0.16;
  g.add(pente);

  const punho = caixa(0.07, 0.16, 0.07, QUASE_PRETO);
  punho.position.set(-0.16, -0.13, 0);
  punho.rotation.z = -0.26;
  g.add(punho);

  const led = caixa(0.30, 0.02, 0.105, cor);
  led.position.set(0, 0.05, 0);
  g.add(led);

  return g;
}

function armaShotgun(cor) {
  const g = new THREE.Group();

  for (const lado of [-1, 1]) {
    const cano = cil(0.032, 0.032, 0.46, QUASE_PRETO, 10);
    cano.rotation.z = Math.PI / 2;
    cano.position.set(0.20, 0.02, lado * 0.045);
    g.add(cano);
  }

  const corpo = caixa(0.20, 0.13, 0.20, ESCURO);
  g.add(corpo);

  const led = caixa(0.16, 0.02, 0.21, cor);
  led.position.y = 0.07;
  g.add(led);

  const coronha = caixa(0.22, 0.11, 0.12, QUASE_PRETO);
  coronha.position.set(-0.20, -0.03, 0);
  coronha.rotation.z = 0.10;
  g.add(coronha);

  return g;
}

const CONSTRUTORES = {
  ammo: municao,
  health: contexto,
  weapon_token_streamer: armaSmg,
  weapon_few_shot: armaShotgun
};

// Devolve o grupo do item ja posicionado no chao, com o no que gira.
export function construirItem(kind, cor, x, z, haloTex) {
  const construtor = CONSTRUTORES[kind];
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const interno = construtor ? construtor(cor) : municao(cor);
  interno.position.y = 0.72;          // altura de flutuacao
  group.add(interno);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTex, color: cor, transparent: true, opacity: 0.5,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  halo.position.y = 0.78;
  halo.scale.set(2.2, 2.2, 1);
  group.add(halo);

  return { group, interno, halo };
}
