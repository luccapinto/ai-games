// Pessoas: monta cada funcionário trocando peças entre os modelos do pacote, recolore,
// pendura crachá e caneca nos ossos, liga os sinais de alienígena e faz a revelação.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { ELENCO, nomeErrado } from './dados.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const CIMA = V(0, 1, 0);
const loader = new GLTFLoader();
const cache = {};
const prontos = {};      // url -> gltf já carregado
let ANIMS = null;

const carregar = (url) => cache[url] || (cache[url] = loader.loadAsync(url).then(g => (prontos[url] = g)));

// Baixa todos os modelos que o elenco usa. progresso(0..1)
export async function carregarModelos(base, progresso = () => {}) {
  const nomes = new Set(['animacoes']);
  for (const p of ELENCO) { nomes.add('pessoas/' + p.base); for (const d of Object.values(p.trocas || {})) nomes.add('pessoas/' + d); }
  let feitos = 0;
  await Promise.all([...nomes].map(async n => {
    await carregar(`${base}/${n}.glb`);
    progresso(++feitos / nomes.size);
  }));
  ANIMS = (await carregar(`${base}/animacoes.glb`)).animations;
  return nomes.size;
}

// ------------------------------------------------------------------ montagem
const parteDe = (o) => { const m = /_(Head|Body|Legs|Pants|Feet)$/.exec(o.name); return m ? (m[1] === 'Pants' ? 'Legs' : m[1]) : null; };
function gruposDeParte(raiz) {
  const out = {};
  raiz.traverse(o => {
    if (o.isBone) return;
    const p = parteDe(o);
    if (p && !out[p] && (o.isSkinnedMesh || o.children.some(c => c.isSkinnedMesh))) out[p] = o;
  });
  return out;
}
const malhas = (g) => g.isSkinnedMesh ? [g] : g.children.filter(c => c.isSkinnedMesh);
const mat0 = (m) => Array.isArray(m.material) ? m.material[0] : m.material;

function montar(ficha, base) {
  const gltf = prontos[`${base}/pessoas/${ficha.base}.glb`];
  const raiz = SkeletonUtils.clone(gltf.scene);
  const ossos = {}; raiz.traverse(b => { if (b.isBone) ossos[b.name.replace(/\./g, '')] = b; });
  const partes = gruposDeParte(raiz);
  for (const [parte, doador] of Object.entries(ficha.trocas || {})) {
    const outro = SkeletonUtils.clone(prontos[`${base}/pessoas/${doador}.glb`].scene);
    const dele = gruposDeParte(outro)[parte], meu = partes[parte];
    if (!dele || !meu) continue;
    const pai = meu.parent; pai.remove(meu); dele.parent.remove(dele);
    dele.position.copy(meu.position); dele.quaternion.copy(meu.quaternion); dele.scale.copy(meu.scale);
    pai.add(dele);
    for (const m of malhas(dele)) {
      const sk = m.skeleton;
      m.bind(new THREE.Skeleton(sk.bones.map(b => ossos[b.name.replace(/\./g, '')]), sk.boneInverses.map(x => x.clone())), m.bindMatrix.clone());
    }
    partes[parte] = dele;
  }
  const parteDaMalha = new Map();
  for (const [p, g] of Object.entries(partes)) for (const m of malhas(g)) parteDaMalha.set(m, p);
  const pele = [], olhos = [];
  raiz.traverse(m => {
    if (!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    const parte = parteDaMalha.get(m);
    const fix = (mt) => {
      const nome = mt.name; mt = mt.clone(); mt.name = nome;
      mt.metalness = 0; mt.roughness = 0.82; mt.envMapIntensity = 0.55;
      const c = (ficha.coresParte?.[parte]?.[nome]) || ficha.cores?.[nome];
      if (c) mt.color = new THREE.Color(c);
      return mt;
    };
    m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material);
    const nm = mat0(m).name;
    if ((ficha.esconder || []).includes(nm)) m.visible = false;
    if (nm === 'Skin' || nm === 'Skin_Darker') pele.push(m);
    if (nm === ficha.olho && parte === 'Head') olhos.push(m);
  });
  return { raiz, ossos, partes, pele, olhos };
}

// ------------------------------------------------------------------ acessórios
function vertsMundo(m) {
  const pos = m.geometry.attributes.position, out = [], v = V();
  for (let i = 0; i < pos.count; i++) { m.getVertexPosition(i, v); out.push(v.clone().applyMatrix4(m.matrixWorld)); }
  return out;
}

function texturaCracha(ficha, { nome, corCabelo }) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, 256, 160);
  g.fillStyle = '#1f4e79'; g.fillRect(0, 0, 256, 34);
  g.fillStyle = '#fff'; g.font = 'bold 20px sans-serif'; g.fillText('INTERPLAN S.A.', 12, 24);
  // foto
  g.fillStyle = '#b9c6d2'; g.fillRect(12, 46, 78, 100);
  g.fillStyle = ficha.cores.Skin || '#e0b18e';
  g.beginPath(); g.ellipse(51, 98, 24, 30, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(36, 120, 30, 26);
  g.fillStyle = corCabelo;
  g.beginPath(); g.ellipse(51, 80, 27, 18, 0, Math.PI, 0); g.fill();
  if (ficha.genero === 'f') { g.fillRect(24, 78, 10, 40); g.fillRect(68, 78, 10, 40); }
  g.fillStyle = '#222'; g.fillRect(42, 96, 4, 4); g.fillRect(56, 96, 4, 4);
  // texto
  g.fillStyle = '#111'; g.font = 'bold 22px sans-serif';
  const [pn, ...sn] = nome.split(' ');
  g.fillText(pn, 102, 72); g.font = '18px sans-serif'; g.fillText(sn.join(' '), 102, 96);
  g.fillStyle = '#1f4e79'; g.font = 'bold 15px sans-serif'; g.fillText(ficha.depto.toUpperCase(), 102, 126);
  g.fillStyle = '#555'; g.font = '13px sans-serif'; g.fillText(ficha.cargo, 102, 145);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function corDoCabelo(ficha) {
  const ks = ['Hair', 'Hair_Blond', 'Hair_Brown', 'Pink', 'Hair_Black'];
  if (ficha.coresParte?.Head?.Red) return ficha.coresParte.Head.Red;
  for (const k of ks) if (ficha.cores[k]) return ficha.cores[k];
  return '#3a2416';
}
const OUTRO_CABELO = ['#d8b46a', '#b8452e', '#121010', '#e9e4dc', '#6a7f3a'];

function caneca() {
  const g = new THREE.Group();
  const corpo = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.1, 18, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.5, side: THREE.DoubleSide }));
  const fundo = new THREE.Mesh(new THREE.CircleGeometry(0.038, 18), corpo.material);
  fundo.rotation.x = Math.PI / 2; fundo.position.y = -0.05;
  const cafe = new THREE.Mesh(new THREE.CircleGeometry(0.039, 18), new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: 0.25 }));
  cafe.rotation.x = -Math.PI / 2; cafe.position.y = 0.035; cafe.name = 'cafe';
  const alca = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.008, 6, 12, Math.PI), corpo.material);
  alca.position.set(0.045, 0, 0); alca.rotation.z = -Math.PI / 2;
  g.add(corpo, fundo, cafe, alca);
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return g;
}

function costura(p) {
  const pn = p.ossos.Neck.getWorldPosition(V()), ph = p.ossos.Head.getWorldPosition(V());
  const eixo = ph.clone().sub(pn).normalize();
  const c = pn.clone().lerp(ph, 0.55);
  const rs = [];
  for (const m of p.pele) for (const v of vertsMundo(m)) {
    const d = v.clone().sub(c); const h = d.dot(eixo);
    if (Math.abs(h) < 0.012) rs.push(d.sub(eixo.clone().multiplyScalar(h)).length());
  }
  rs.sort((a, b) => a - b);
  const raio = rs.length ? rs[Math.floor(rs.length * 0.5)] : 0.05;
  const g = new THREE.Group();
  const cor = mat0(p.pele[0]).color.clone().multiplyScalar(0.28);
  const mat = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.75 });
  g.add(new THREE.Mesh(new THREE.TorusGeometry(raio, 0.0022, 6, 40), mat));
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.0022, 0.012), mat);
    b.position.set(Math.cos(a) * raio * 1.004, Math.sin(a) * raio * 1.004, 0);
    b.lookAt(0, 0, 0); b.rotateY(Math.PI / 2);
    g.add(b);
  }
  g.position.copy(c);
  g.quaternion.setFromUnitVectors(V(0, 0, 1), eixo);
  return g;
}

// cabeça do alienígena, no mesmo estilo liso do pacote: crânio alongado, olhos amendoados pretos
function cabecaAlien() {
  const g = new THREE.Group();
  const perfil = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;                       // 0 = queixo, 1 = topo
    const y = -0.5 + t * 1.25;
    const r = 0.06 + 0.42 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.62) * (t < 0.92 ? 1 : (1 - (t - 0.92) / 0.08 * 0.85));
    perfil.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  perfil.push(new THREE.Vector2(0.001, 0.75));
  const geo = new THREE.LatheGeometry(perfil, 28);
  geo.computeVertexNormals();
  const pele = new THREE.MeshStandardMaterial({ color: 0x8a5ad0, roughness: 0.38, emissive: 0x2a0a50, emissiveIntensity: 0.6 });
  const cranio = new THREE.Mesh(geo, pele); cranio.scale.set(1, 1, 0.92);
  const olhoMat = new THREE.MeshStandardMaterial({ color: 0x050308, roughness: 0.05, metalness: 0.2, emissive: 0x6a20ff, emissiveIntensity: 0.25 });
  for (const s of [-1, 1]) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 10), olhoMat);
    o.scale.set(1.25, 0.62, 0.5); o.position.set(s * 0.17, 0.02, 0.33);
    o.rotation.z = s * -0.45; o.rotation.y = s * 0.35;
    g.add(o);
  }
  const boca = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.02), new THREE.MeshStandardMaterial({ color: 0x2a0a40 }));
  boca.position.set(0, -0.3, 0.2);
  g.add(cranio, boca);
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return g;
}

// ------------------------------------------------------------------ a pessoa
export class Pessoa {
  constructor(ficha, cena, base) {
    this.ficha = ficha; this.id = ficha.id; this.cena = cena;
    const { raiz, ossos, partes, pele, olhos } = montar(ficha, base);
    Object.assign(this, { raiz, ossos, partes, pele, olhos });
    this.obj = new THREE.Group(); this.obj.name = 'pessoa_' + ficha.id;
    this.obj.add(raiz);
    cena.add(this.obj);
    // escala pela altura dos ossos
    raiz.updateMatrixWorld(true);
    let ymin = 1e9, ymax = -1e9;
    raiz.traverse(n => { if (n.isBone) { const y = n.getWorldPosition(V()).y; ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); } });
    raiz.scale.setScalar(ficha.altura / ((ymax - ymin) * 1.10));
    this.mixer = new THREE.AnimationMixer(raiz);
    this.acoes = {};
    for (const c of ANIMS) this.acoes[c.name] = this.mixer.clipAction(c);
    this.acoes.Death.setLoop(THREE.LoopOnce); this.acoes.Death.clampWhenFinished = true;
    this.acoes.HitRecieve.setLoop(THREE.LoopOnce); this.acoes.HitRecieve.clampWhenFinished = true;
    this.atual = null;
    this.alien = false; this.sinais = new Set(); this.estado = 'vivo';
    this.t = Math.random() * 100;
    this.giroExtra = 0;              // cabeça (graus, sobre a animação)
    this.olhar = null;               // ponto que a cabeça procura (humano olhando o jogador)
    this.extras = [];
    this.anim('Idle', 0);
    this.mixer.setTime(Math.random() * 2);
    // pose de referência dos braços (para o sinal "anda sem balançar os braços")
    this._posarRepouso();
    this.raio = 0.28;
  }

  _posarRepouso() {
    this.mixer.stopAllAction();
    this.acoes.Idle.reset().play(); this.mixer.setTime(0);
    this.raiz.updateMatrixWorld(true);
    this.repousoBracos = {};
    for (const n of ['ShoulderL', 'UpperArmL', 'LowerArmL', 'WristL', 'ShoulderR', 'UpperArmR', 'LowerArmR', 'WristR'])
      if (this.ossos[n]) this.repousoBracos[n] = this.ossos[n].quaternion.clone();
  }

  // Monta crachá/caneca/costura numa pose de repouso. Chamar depois de posicionar no mundo.
  vestir({ alien, sinais }, r = Math.random) {
    this.alien = alien; this.sinais = new Set(sinais);
    this._posarRepouso();
    this.obj.updateMatrixWorld(true);
    const frente = V(0, 0, 1).applyQuaternion(this.obj.quaternion);
    // crachá na frente do peito
    const chest = this.ossos.Chest.getWorldPosition(V());
    let frenteMax = 0.1;
    const corpo = malhas(this.partes.Body);
    for (const m of corpo) for (const v of vertsMundo(m)) {
      const d = v.clone().sub(chest);
      if (Math.abs(d.y + 0.06) < 0.05 && Math.abs(d.clone().cross(frente).y) < 0.06) frenteMax = Math.max(frenteMax, d.dot(frente));
    }
    const nome = this.sinais.has('nome') ? nomeErrado(this.ficha.nome, r) : this.ficha.nome;
    const cab = this.sinais.has('foto') ? OUTRO_CABELO.find(c => c !== corDoCabelo(this.ficha).toLowerCase()) : corDoCabelo(this.ficha);
    this.nomeNoCracha = nome;
    const cracha = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.053, 0.004), [
      new THREE.MeshStandardMaterial({ color: 0xdddddd }), new THREE.MeshStandardMaterial({ color: 0xdddddd }),
      new THREE.MeshStandardMaterial({ color: 0xdddddd }), new THREE.MeshStandardMaterial({ color: 0xdddddd }),
      new THREE.MeshStandardMaterial({ map: texturaCracha(this.ficha, { nome, corCabelo: cab }), roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }),
    ]);
    const lado = V(1, 0, 0).applyQuaternion(this.obj.quaternion);
    cracha.position.copy(chest).addScaledVector(frente, frenteMax + 0.006).addScaledVector(lado, 0.07).add(V(0, -0.06, 0));
    cracha.quaternion.copy(this.obj.quaternion);
    cracha.rotateX(-0.08);
    this.cena.add(cracha); this.ossos.Chest.attach(cracha); this.extras.push(cracha);
    this.cracha = cracha;
    // caneca na mão direita
    if (this.ficha.caneca) {
      const c = caneca();
      const w = this.ossos['WristR'].getWorldPosition(V());
      c.position.copy(w).addScaledVector(frente, 0.05).add(V(0, -0.07, 0));
      c.quaternion.copy(this.obj.quaternion);
      if (this.sinais.has('caneca')) { c.rotateX(Math.PI); c.getObjectByName('cafe').visible = false; }
      this.cena.add(c); this.ossos['WristR'].attach(c); this.extras.push(c);
      this.caneca = c;
    }
    if (this.sinais.has('costura')) {
      const c = costura(this); this.cena.add(c); this.ossos.Neck.attach(c); this.extras.push(c);
    }
    if (this.sinais.has('pele')) for (const m of this.pele) {
      const mt = mat0(m);
      const novo = new THREE.MeshPhysicalMaterial({ color: mt.color.clone().lerp(new THREE.Color(0x9fd4a8), 0.12), roughness: 0.18,
        clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.8, sheen: 0.6, sheenColor: new THREE.Color(0x7affb0) });
      novo.name = mt.name;
      if (Array.isArray(m.material)) m.material[0] = novo; else m.material = novo;
    }
    if (this.sinais.has('sombra')) this.raiz.traverse(m => { if (m.isMesh) m.castShadow = false; });
    this.anim('Idle', 0);
  }

  // recomeça a animação mesmo que já seja a atual (golpes seguidos)
  reiniciar(nome, fade = 0.08, escala = 1) {
    const a = this.acoes[nome]; if (!a) return;
    const antes = this.atual;
    a.timeScale = escala; a.reset().play();
    if (antes && antes !== a) antes.crossFadeTo(a, fade, false);
    this.atual = a;
  }

  anim(nome, fade = 0.25, escala = 1) {
    const a = this.acoes[nome];
    if (!a) return;
    a.timeScale = escala;
    if (this.atual === a) return;
    a.reset().play();
    if (this.atual && fade > 0) this.atual.crossFadeTo(a, fade, false);
    else if (this.atual) this.atual.stop();
    this.atual = a;
  }

  get pos() { return this.obj.position; }

  // ---- cada quadro: animação + sinais por cima da animação
  atualizar(dt, ctx) {
    this.t += dt;
    // ossos que os sinais mexem por cima da animação: volta à pose de antes do ajuste,
    // senão (quando a animação não tem trilha daquele osso) o ajuste se acumula a cada quadro
    const MEXIDOS = ['Neck', 'Head', 'FootR', 'ShoulderL', 'UpperArmL', 'LowerArmL', 'WristL', 'ShoulderR', 'UpperArmR', 'LowerArmR', 'WristR'];
    if (!this._base) { this._base = {}; for (const n of MEXIDOS) if (this.ossos[n]) this._base[n] = this.ossos[n].quaternion.clone(); }
    for (const n in this._base) this.ossos[n].quaternion.copy(this._base[n]);
    this.mixer.update(dt);
    for (const n in this._base) this._base[n].copy(this.ossos[n].quaternion);
    if (this.estado !== 'vivo') { this._atualizarRevelacao(dt, ctx); return; }
    const andando = this.andando;
    // sinal: braços parados ao andar
    if (this.sinais.has('bracos') && andando)
      for (const [n, q] of Object.entries(this.repousoBracos)) this.ossos[n].quaternion.slerp(q, 0.92);
    // sinal: pé virado
    if (this.sinais.has('pe')) this._girarOssoMundo('FootR', Math.PI);
    // cabeça: alienígena gira além do limite; humano olha para o jogador às vezes
    let alvoGiro = 0;
    if (this.sinais.has('cabeca')) {
      const ciclo = (this.t + this.id.length * 1.7) % 9;
      if (ciclo > 6.4 && ciclo < 8.6) alvoGiro = 172;
    }
    if (this.olhar && !this.sinais.has('cabeca')) alvoGiro = this._anguloPara(this.olhar, 70);
    if (this.encarando) alvoGiro = this._anguloPara(ctx.camera.position, 75);
    this.giroExtra += (alvoGiro - this.giroExtra) * Math.min(1, dt * (this.sinais.has('cabeca') && alvoGiro > 100 ? 2.2 : 5));
    if (Math.abs(this.giroExtra) > 0.5) {
      this._girarOssoMundo('Neck', this.giroExtra * 0.25 * Math.PI / 180);
      this._girarOssoMundo('Head', this.giroExtra * 0.75 * Math.PI / 180);
    }
    // sinal: olhos verdes
    if (this.sinais.has('olho')) {
      const c = (this.t + this.id.length) % 6.5;
      const on = c < 0.7 ? Math.sin(c / 0.7 * Math.PI) : 0;
      for (const m of this.olhos) { const mt = mat0(m); mt.emissive.setHex(0x39ff7a); mt.emissiveIntensity = on * 3.2; }
    }
    // sinal: falha na imagem
    if (this.sinais.has('falha')) {
      const c = (this.t + this.id.length * 0.9) % 7;
      const some = (c > 5.0 && c < 5.09) || (c > 5.18 && c < 5.24);
      this.raiz.visible = !some;
      this.raiz.position.x = (c > 5.09 && c < 5.18) ? 0.06 : 0;
    }
    // sinal: vapor gelado
    if (this.sinais.has('vapor') && ctx.particulas) {
      this._vapor = (this._vapor || 0) - dt;
      if (this._vapor <= 0) {
        this._vapor = 2.4 + Math.random();
        const h = this.ossos.Head.getWorldPosition(V());
        const f = V(0, 0, 1).applyQuaternion(this.obj.quaternion);
        ctx.particulas.vapor(h.addScaledVector(f, 0.13).add(V(0, 0.02, 0)), f);
      }
    }
  }

  _anguloPara(ponto, max) {
    const d = V().subVectors(ponto, this.obj.position);
    const yawAlvo = Math.atan2(d.x, d.z);
    let a = (yawAlvo - this.obj.rotation.y) * 180 / Math.PI;
    a = ((a + 540) % 360) - 180;
    return Math.max(-max, Math.min(max, a));
  }

  _girarOssoMundo(nome, ang) {
    const b = this.ossos[nome]; if (!b) return;
    const pw = new THREE.Quaternion(); b.parent.getWorldQuaternion(pw);
    const eixo = CIMA.clone().applyQuaternion(pw.invert());
    b.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(eixo, ang));
  }

  // ---- disparo
  // Cilindro vertical: distância do raio até a pessoa. Devolve a distância ao longo do raio ou null.
  get alvejavel() { return this.estado === 'vivo' || this.estado === 'revelando' || this.estado === 'hostil'; }
  // alienígena ainda no andar (disfarçado ou já revelado)
  get ativo() { return this.alien && this.alvejavel; }

  acerto(raio) {
    if (!this.alvejavel) return null;
    const o = raio.origin, d = raio.direction, p = this.obj.position;
    const ox = o.x - p.x, oz = o.z - p.z;
    const a = d.x * d.x + d.z * d.z, b = 2 * (ox * d.x + oz * d.z), c = ox * ox + oz * oz - this.raio * this.raio;
    const disc = b * b - 4 * a * c;
    if (disc < 0 || a < 1e-9) return null;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t < 0) return null;
    const y = o.y + d.y * t;
    return (y > 0 && y < this.ficha.altura + 0.05) ? t : null;
  }

  // Um grampo acertou. Devolve 'humano' | 'revelou' | 'feriu' | 'morreu'.
  // Humano cai com um grampo. Alienígena: o 1º grampo só quebra o disfarce;
  // ele aguenta `ctx.vida` grampos no total antes de cair.
  atingir(ctx) {
    if (!this.alvejavel) return null;
    this.andando = false; this.encarando = false;
    this.raiz.visible = true; this.raiz.position.x = 0;
    if (!this.alien) { this.estado = 'caindo'; this.tRev = 0; this.reiniciar('HitRecieve', 0.08); return 'humano'; }
    if (this.estado === 'vivo') {
      this.estado = 'revelando'; this.tRev = 0; this.vida = ctx.vida - 1; this.vidaMax = ctx.vida;
      this.reiniciar('HitRecieve', 0.08); ctx.luzAlien(this);
      return 'revelou';
    }
    this.vida--;
    this.piscarDano = 0.12;
    if (this.vida <= 0) { this._trocarCabeca(ctx); this.estado = 'morrendo'; this.tRev = 0; this.reiniciar('Death', 0.1); return 'morreu'; }
    this.atordoado = 0.4;
    this.reiniciar(this.vida % 2 ? 'HitRecieve' : 'HitRecieve_2', 0.06, 1.5);
    return 'feriu';
  }

  _trocarCabeca(ctx) {
    if (this.cabecaAlien) return;
    const cab = this.partes.Head;
    this.raiz.updateMatrixWorld(true);
    const bb = new THREE.Box3().expandByObject(cab, true);
    const tam = bb.getSize(V()), centro = bb.getCenter(V());
    cab.visible = false;
    const h = cabecaAlien();
    const s = Math.max(tam.x, tam.z) * 0.95;
    h.scale.setScalar(s * 0.2);
    h.position.copy(centro).add(V(0, tam.y * 0.05, 0));
    h.quaternion.copy(this.obj.quaternion);
    this.cena.add(h); this.ossos.Head.attach(h);
    this.cabecaAlien = h; this._escalaAlien = h.scale.x / 0.2;
    if (ctx?.particulas) ctx.particulas.estilhacos(centro, mat0(this.pele[0]).color);
    for (const e of this.extras) if (e !== this.cracha && e !== this.caneca) e.visible = false;
    for (const m of this.pele) { const mt = mat0(m); mt.color.lerp(new THREE.Color(0x8a5ad0), 0.85); mt.emissive = new THREE.Color(0x2a0a50); mt.roughness = 0.4; }
    this._tCab = 0;
  }

  _atualizarRevelacao(dt, ctx) {
    this.tRev += dt;
    // cabeça roxa crescendo (troca aos 0,32 s do 1º grampo)
    if (this.alien && this.estado !== 'fugiu') {
      if (this.tRev > 0.32 || this.estado !== 'revelando') this._trocarCabeca(ctx);
      if (this.cabecaAlien && this._tCab < 0.22) {
        this._tCab += dt;
        const k = Math.min(1, this._tCab / 0.22);
        this.cabecaAlien.scale.setScalar(this._escalaAlien * (0.2 + 0.8 * (1 - Math.pow(1 - k, 3))));
      }
      // pisca branco a cada grampo
      if (this.piscarDano > 0) {
        this.piscarDano -= dt;
        const on = this.piscarDano > 0;
        for (const m of this.pele) mat0(m).emissiveIntensity = on ? 3 : 1;
      }
    }
    if (this.estado === 'revelando') {
      if (this.tRev > 1.0) { this.estado = 'hostil'; this.reiniciar('Run', 0.2, 1.1); }
    } else if (this.estado === 'morrendo') {
      if (this.tRev > 2.6 && !this.fim) this.fim = true;
    } else if (this.estado === 'caindo') {
      if (this.tRev > 0.45 && this.atual !== this.acoes.Death) this.anim('Death', 0.15);
      if (this.tRev > 1.4 && !this.fim) this.fim = true;
    }
  }

  remover() {
    this.cena.remove(this.obj);
    for (const e of this.extras) e.parent?.remove(e);
    if (this.cabecaAlien) this.cabecaAlien.parent?.remove(this.cabecaAlien);
  }
}
