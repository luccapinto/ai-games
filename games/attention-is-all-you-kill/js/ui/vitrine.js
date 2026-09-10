// vitrine.js — desenha modelos 3D dentro das telas de interface.
//
// O manual e a personalizacao mostram os modelos de verdade, e não desenhos ou
// icones: e a mesma silhueta que o jogador enfrenta no jogo, com o mesmo path
// data de logo. Assim a vitrine nunca fica desatualizada em relacao ao jogo.
//
// Um único renderer WebGL offscreen e reaproveitado, e o resultado e copiado
// para um canvas 2D por cartão. Criar um contexto WebGL por cartão estoura o
// limite do navegador (por volta de 16 contextos) e o manual tem cinco.

import * as THREE from '../../vendor/three.module.js';
import { construirSilhueta } from '../enemies/silhuetas.js';
import { construirAvatar } from '../player/avatar.js';
import { mergeParts } from '../core/merge.js';
import { logoDecalTexture } from '../world/textures.js';

const TAM = 340;

let _renderer = null;
let _cena = null;
let _camera = null;

function inicializar() {
  if (_renderer) return;

  _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

  _cena = new THREE.Scene();
  _camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);

  // Iluminacao de estudio: chave frontal, recorte por trás e um preenchimento
  // de baixo. Com só uma luz direcional os trajes escuros viravam um borrao
  // preto na vitrine e não dava para ver a forma.
  const frontal = new THREE.DirectionalLight(0xdfefff, 3.1);
  frontal.position.set(2.4, 3.2, 3.4);
  _cena.add(frontal);

  const traseira = new THREE.DirectionalLight(0x7fc0e0, 2.0);
  traseira.position.set(-3, 2.4, -3);
  _cena.add(traseira);

  const contorno = new THREE.DirectionalLight(0xffffff, 1.4);
  contorno.position.set(-2.6, 1.2, 2.4);
  _cena.add(contorno);

  _cena.add(new THREE.AmbientLight(0x6f90a8, 2.6));
}

// Monta o corpo do inimigo fora do jogo: silhueta + decalque da marca.
function montarInimigo(id, faccao, corBase, corGlow) {
  const grupo = new THREE.Group();
  const corpo = new THREE.MeshLambertMaterial({ color: corBase });
  const escuro = new THREE.MeshLambertMaterial({ color: 0x1b2530 });
  const luz = new THREE.MeshBasicMaterial({ color: corGlow });

  const grupos = new Map();
  const peca = (mat, geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const matriz = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));
    matriz.setPosition(x, y, z);
    if (!grupos.has(mat)) grupos.set(mat, []);
    grupos.get(mat).push({ geo, matrix: matriz });
  };

  const silhueta = construirSilhueta(id, peca, { corpo, escuro, luz });
  for (const [mat, partes] of grupos) {
    const geo = mergeParts(partes);
    if (geo) grupo.add(new THREE.Mesh(geo, mat));
  }

  const decal = logoDecalTexture(faccao, corGlow);
  if (decal && silhueta.decalque) {
    const lado = id === 'gpt_55' ? 0.46 : 0.58;
    const marca = new THREE.Mesh(
      new THREE.PlaneGeometry(lado, lado),
      new THREE.MeshBasicMaterial({ map: decal, transparent: true, depthWrite: false })
    );
    marca.position.set(0, silhueta.decalque[0], silhueta.decalque[1]);
    grupo.add(marca);
  }

  return { grupo, altura: silhueta.altura };
}

function enquadrar(altura, angulo) {
  const distancia = altura * 1.75;
  _camera.position.set(
    Math.sin(angulo) * distancia,
    altura * 0.68,
    Math.cos(angulo) * distancia
  );
  _camera.lookAt(0, altura * 0.50, 0);
}

// Desenha na vitrine e cópia o resultado para o canvas de destino.
function copiarPara(destino) {
  const origem = _renderer.domElement;
  const ctx = destino.getContext('2d');
  destino.width = TAM;
  destino.height = TAM;
  ctx.clearRect(0, 0, TAM, TAM);
  ctx.drawImage(origem, 0, 0, TAM, TAM);
}

export function retratarInimigo(id, faccao, corBase, corGlow, destino, angulo = 0.62) {
  inicializar();

  const anterior = _cena.children.filter(c => c.userData.vitrine);
  for (const c of anterior) _cena.remove(c);

  const { grupo, altura } = montarInimigo(id, faccao, corBase, corGlow);
  grupo.userData.vitrine = true;
  _cena.add(grupo);

  enquadrar(altura, angulo);
  _renderer.setSize(TAM, TAM, false);
  _renderer.render(_cena, _camera);
  copiarPara(destino);
}

export function retratarAvatar(acabamento, luz, destino, angulo = 0.85) {
  inicializar();

  const anterior = _cena.children.filter(c => c.userData.vitrine);
  for (const c of anterior) _cena.remove(c);

  const grupo = construirAvatar(acabamento, luz);
  grupo.userData.vitrine = true;
  _cena.add(grupo);

  const altura = 2.1;
  enquadrar(altura, angulo);
  _renderer.setSize(TAM, TAM, false);
  _renderer.render(_cena, _camera);
  copiarPara(destino);
}

export function retratarItem(modelo, destino, angulo = 0.6) {
  inicializar();

  const anterior = _cena.children.filter(c => c.userData.vitrine);
  for (const c of anterior) _cena.remove(c);

  // os itens são construidos baixos (no chão); a vitrine enquadra pelo centro
  modelo.position.y -= 0.72;
  modelo.userData.vitrine = true;
  _cena.add(modelo);

  enquadrar(1.5, angulo);
  _renderer.setSize(TAM, TAM, false);
  _renderer.render(_cena, _camera);
  copiarPara(destino);
}