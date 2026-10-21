// Pessoas: monta cada funcionário trocando peças entre os modelos do pacote, recolore,
// pendura crachá e caneca nos ossos, liga os sinais de alienígena e faz a revelação.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { ELENCO, RITMO, nomeErrado } from './dados.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const CIMA = V(0, 1, 0);
const loader = new GLTFLoader();
const cache = {};
const prontos = {};      // url -> gltf já carregado
// Os modelos femininos do pacote têm outra orientação de repouso nos ossos do tronco,
// braços e pernas: a animação do esqueleto masculino tocada nelas joga o braço para trás.
// Por isso cada esqueleto tem o seu arquivo de animações.
let ANIMS = null;
const esqueletoDe = (ficha) => ficha.base.startsWith('mulher_') ? 'mulher' : 'homem';
// Velocidade do pé apoiado no chão com a animação em escala 1, por metro de escala do esqueleto
// (medida tocando o clipe e seguindo o pé mais baixo). Andar nessa velocidade = pé não desliza.
const PASSO = { homem: { andar: 1.247, correr: 2.93 }, mulher: { andar: 1.0, correr: 2.39 } };
export const VEL_HOSTIL = 2.6;       // m/s do alien revelado correndo atrás do jogador

const carregar = (url) => cache[url] || (cache[url] = loader.loadAsync(url).then(g => (prontos[url] = g)));

// Baixa todos os modelos que o elenco usa. progresso(0..1)
export async function carregarModelos(base, progresso = () => {}) {
  const nomes = new Set(['animacoes', 'animacoes_mulher']);
  for (const p of ELENCO) { nomes.add('pessoas/' + p.base); for (const d of Object.values(p.trocas || {})) nomes.add('pessoas/' + d); }
  let feitos = 0;
  await Promise.all([...nomes].map(async n => {
    await carregar(`${base}/${n}.glb`);
    progresso(++feitos / nomes.size);
  }));
  ANIMS = {
    homem: (await carregar(`${base}/animacoes.glb`)).animations,
    mulher: (await carregar(`${base}/animacoes_mulher.glb`)).animations,
  };
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

// Caneca branca com faixa vermelha na boca e o café escuro rente à borda: de cabeça para baixo
// (sinal) a faixa fica embaixo, o fundo branco em cima e o café aparece pendurado, sem cair.
function caneca(invertida) {
  const g = new THREE.Group();
  const branco = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.5, side: THREE.DoubleSide });
  const vermelho = new THREE.MeshStandardMaterial({ color: 0xc8302a, roughness: 0.5, side: THREE.DoubleSide });
  const marrom = new THREE.MeshStandardMaterial({ color: 0x2e1a0e, roughness: 0.2 });
  const H = 0.11, R = CANECA_R, r = CANECA_R * 0.9;
  const corpo = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.985, r, H * 0.72, 20, 1, true), branco);
  corpo.position.y = -H * 0.14;
  const faixa = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.985, H * 0.28, 20, 1, true), vermelho);
  faixa.position.y = H * 0.36;
  const fundo = new THREE.Mesh(new THREE.CircleGeometry(r, 20), branco);
  fundo.rotation.x = Math.PI / 2; fundo.position.y = -H / 2;
  const cafe = new THREE.Mesh(new THREE.CircleGeometry(R * 0.97, 20), marrom);
  cafe.rotation.x = -Math.PI / 2; cafe.position.y = H / 2 - 0.006; cafe.name = 'cafe';
  const alca = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 6, 12, Math.PI), branco);
  alca.position.set(R + 0.003, 0, 0); alca.rotation.z = -Math.PI / 2;
  g.add(corpo, faixa, fundo, cafe, alca);
  if (invertida) {
    // o café não cai: fica um menisco escuro estufado para fora da boca
    const gota = new THREE.Mesh(new THREE.SphereGeometry(R * 0.96, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), marrom);
    gota.scale.y = 0.45; gota.position.y = H / 2 - 0.004;
    g.add(gota);
  }
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return g;
}

// Cicatriz costurada em volta do pescoço, logo abaixo do queixo. Segue a superfície ângulo a
// ângulo (pele, gola, capuz do moletom: o que estiver mais para fora naquela altura), então não
// afunda em nenhuma cabeça trocada. Faixa vermelho-escura de 9 mm com pontos pretos atravessados:
// a 1,5 m com o zoom ela tem uns 12 px de altura.
function costura(p) {
  const pn = p.ossos.Neck.getWorldPosition(V()), ph = p.ossos.Head.getWorldPosition(V());
  const eixo = ph.clone().sub(pn).normalize();
  const c = pn.clone().lerp(ph, 0.55);
  const frente = V(0, 0, 1).applyQuaternion(p.obj.quaternion);
  const u = frente.clone().addScaledVector(eixo, -frente.dot(eixo)).normalize();
  const w = V().crossVectors(eixo, u);
  const N = 48, rmax = new Array(N).fill(0);
  const fontes = [...malhas(p.partes.Head), ...malhas(p.partes.Body)].filter(m => m.visible);
  for (const m of fontes) for (const v of vertsMundo(m)) {
    const d = v.sub(c); const h = d.dot(eixo);
    if (Math.abs(h) > 0.014) continue;
    const x = d.dot(u), y = d.dot(w), r = Math.hypot(x, y);
    if (r > 0.16) continue;
    const k = ((Math.round(Math.atan2(y, x) / (Math.PI * 2) * N) % N) + N) % N;
    rmax[k] = Math.max(rmax[k], r);
  }
  // setor sem vértice: média dos vizinhos preenchidos
  const cheio = rmax.filter(r => r > 0);
  const base = cheio.length ? cheio.reduce((a, b) => a + b, 0) / cheio.length : 0.055;
  const raio = rmax.map((r, k) => {
    if (r) return r;
    let a = 0, b = 0;
    for (let s = 1; s < N && !a; s++) a = rmax[(k - s + N) % N];
    for (let s = 1; s < N && !b; s++) b = rmax[(k + s) % N];
    return (a && b) ? (a + b) / 2 : base;
  });
  const ponto = (k, folga) => {
    const a = k / N * Math.PI * 2, r = raio[k % N] + folga;
    return c.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(w, Math.sin(a) * r);
  };
  const g = new THREE.Group();
  const pts = Array.from({ length: N }, (_, k) => ponto(k, 0.0025));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.0045, 6, true),
    new THREE.MeshStandardMaterial({ color: 0x6a0f16, roughness: 0.55 })));
  const linha = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.6 });
  const geo = new THREE.BoxGeometry(0.0032, 0.0032, 0.024);
  for (let k = 0; k < N; k += 3) {
    const s = new THREE.Mesh(geo, linha);
    const q = ponto(k, 0.006);
    s.position.copy(q);
    s.lookAt(q.clone().add(eixo));                  // o comprimento do ponto atravessa a faixa
    g.add(s);
  }
  return g;
}

// brilho do olho verde: um ponto aditivo em cada olho, para ler a 2,5 m sem zoom
let _texBrilho = null;
function texBrilho() {
  if (_texBrilho) return _texBrilho;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (_texBrilho = new THREE.CanvasTexture(c));
}
function brilhoDosOlhos(p, frente, lado) {
  const vs = p.olhos.flatMap(m => vertsMundo(m));
  if (!vs.length) return [];
  const centro = vs.reduce((a, v) => a.add(v), V()).multiplyScalar(1 / vs.length);
  const lados = [[], []];
  for (const v of vs) lados[v.clone().sub(centro).dot(lado) < 0 ? 0 : 1].push(v);
  return lados.filter(l => l.length).map(l => {
    const pos = l.reduce((a, v) => a.add(v), V()).multiplyScalar(1 / l.length);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: 0x1cff58, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, opacity: 0 }));
    s.scale.setScalar(0.045);
    s.position.copy(pos).addScaledVector(frente, 0.015);
    return s;
  });
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

// ------------------------------------------------------------------ mãos e braços procedurais
// Por cima da animação do pacote: IK de dois ossos (ombro-cotovelo-pulso), orientação da mão
// pedida no mundo e dedos dobrados. É o que segura a caneca, leva a caneca à boca e põe as mãos
// no teclado. Tudo é recalculado a cada quadro a partir da pose da animação (nada acumula).
// No esqueleto do pacote o 1º osso de cada dedo é o metacarpo (todos nascem no mesmo ponto do
// pulso): as juntas que dobram são 2, 3 e 4. No polegar, 1, 2 e 3.
const FALANGES = { Index: [2, 3, 4], Middle: [2, 3, 4], Ring: [2, 3, 4], Pinky: [2, 3, 4], Thumb: [1, 2, 3] };
const OSSOS_MAO = (s) => Object.entries(FALANGES).flatMap(([d, js]) => js.map(j => d + j + s));
const CANECA_R = 0.046;                 // raio da caneca
// ângulo de cada falange (graus), da junta da palma para a ponta
const DOBRA = {
  caneca: { dedo: [62, 70, 48], polegar: [28, 34, 30] },
  teclado: { dedo: [22, 28, 18], polegar: [10, 12, 10] },
};
const _m4 = new THREE.Matrix4();
const wpos = (b, v = V()) => b.getWorldPosition(v);
const wquat = (b) => b.getWorldQuaternion(new THREE.Quaternion());
// rotação cujo eixo x = `a` (dedos) e eixo y = `n` (palma); z = x × y
function baseMao(a, n) {
  const x = a.clone().normalize(), y = n.clone().addScaledVector(x, -n.dot(x)).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(_m4.makeBasis(x, y, V().crossVectors(x, y)));
}
// referencial anatômico da mão no mundo: a = punho -> dedo médio, n = para onde a palma olha
// (mão direita: a × (indicador -> mínimo); esquerda: o contrário), palma = centro da palma
function quadroMao(o, s) {
  const w = wpos(o['Wrist' + s]), m = wpos(o['Middle2' + s]), i = wpos(o['Index2' + s]);
  const r = wpos(o['Ring2' + s]), k = wpos(o['Pinky2' + s]);
  const a = m.clone().sub(w).normalize();
  const l = k.clone().sub(i).normalize();
  const n = s === 'R' ? V().crossVectors(a, l) : V().crossVectors(l, a);
  n.addScaledVector(a, -n.dot(a)).normalize();
  const nos = m.clone().add(i).add(r).add(k).multiplyScalar(0.25);
  return { a, n, q: baseMao(a, n), w, palma: w.clone().lerp(nos, 0.55) };
}
// gira o osso no mundo para levar a direção `de` até `para`
function mirarOsso(b, de, para) {
  const dq = new THREE.Quaternion().setFromUnitVectors(de.normalize(), para.normalize());
  b.quaternion.copy(wquat(b.parent).invert().multiply(dq.multiply(wquat(b))));
}

// sombra de contato: disco escuro de borda suave no chão, debaixo de cada pessoa
const GEO_SOMBRA = new THREE.PlaneGeometry(0.95, 0.95);
const MAT_SOMBRA = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.38)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
})();

// ossos que os ajustes procedurais mexem por cima da animação (restaurados a cada quadro)
const MEXIDOS = ['Root', 'Neck', 'Head', 'FootR', 'LowerLegR', 'ShoulderL', 'UpperArmL', 'LowerArmL', 'WristL', 'ShoulderR', 'UpperArmR', 'LowerArmR', 'WristR',
  ...OSSOS_MAO('R'), ...OSSOS_MAO('L')];
// sinais que estão à mostra o tempo todo (os outros vão e voltam ou dependem de andar/encarar)
const SEMPRE = ['pe', 'sombra', 'caneca', 'costura', 'foto', 'nome', 'pele'];

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
    const passo = PASSO[esqueletoDe(ficha)];
    this.velPasso = passo.andar * raiz.scale.x;                  // m/s andando com a animação em escala 1
    this.escalaCorrida = VEL_HOSTIL / (passo.correr * raiz.scale.x);
    this.mixer = new THREE.AnimationMixer(raiz);
    this.acoes = {};
    for (const c of ANIMS[esqueletoDe(ficha)]) this.acoes[c.name] = this.mixer.clipAction(c);
    this.acoes.Death.setLoop(THREE.LoopOnce); this.acoes.Death.clampWhenFinished = true;
    this.acoes.HitRecieve.setLoop(THREE.LoopOnce); this.acoes.HitRecieve.clampWhenFinished = true;
    this.atual = null;
    this.alien = false; this.sinais = new Set(); this.estado = 'vivo';
    this.vis = new Set();            // sinais à mostra neste quadro (para a prova estatística)
    this.t = Math.random() * 100;
    this.giroExtra = 0;              // cabeça (graus, sobre a animação)
    this.olhar = null;               // ponto que a cabeça procura (humano olhando o jogador)
    this.extras = [];
    this.anim('Idle', 0);
    this.mixer.setTime(Math.random() * 2);
    // pose de referência dos braços (para o sinal "anda sem balançar os braços")
    this._posarRepouso();
    this._prepararMaos();
    // sombra de contato sob os pés (a luz do teto): quem não tem sombra fica sem ela também
    this.sombraPe = new THREE.Mesh(GEO_SOMBRA, MAT_SOMBRA);
    this.sombraPe.rotation.x = -Math.PI / 2; this.sombraPe.position.y = 0.006; this.sombraPe.renderOrder = -1;
    this.obj.add(this.sombraPe);
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

  // Guarda, na pose de repouso, o que não muda com a animação: a orientação do pulso em relação
  // ao referencial da mão, o eixo de dobra de cada falange e onde fica o centro da caneca na mão.
  _prepararMaos() {
    this.raiz.updateMatrixWorld(true);
    this.maos = {};
    const o = this.ossos;
    for (const s of ['R', 'L']) {
      if (!o['Wrist' + s] || !o['Middle2' + s] || !o['Pinky2' + s]) continue;
      const H = quadroMao(o, s);
      const off = H.q.clone().invert().multiply(wquat(o['Wrist' + s]));       // pulso = mão * off
      const dedos = [];
      for (const [d, js] of Object.entries(FALANGES)) js.forEach((j, ordem) => {
        const b = o[d + j + s]; if (!b) return;
        const prox = o[d + (j + 1) + s];
        const dir = prox ? wpos(prox).sub(wpos(b)) : wpos(b).sub(wpos(b.parent));
        const eixo = V().crossVectors(dir.normalize(), H.n).normalize();   // girar + leva a falange para a palma
        dedos.push({ b, ordem, polegar: d === 'Thumb', repouso: b.quaternion.clone(), eixo: eixo.applyQuaternion(wquat(b.parent).invert()) });
      });
      // centro da caneca no referencial da mão: encostada na palma, do lado para onde ela olha
      const centro = H.palma.clone().sub(H.w).applyQuaternion(H.q.clone().invert()).add(V(0, CANECA_R + 0.012, 0));
      this.maos[s] = { off, dedos, w: 0, centro };
    }
  }

  _dobrar(s, tipo, w) {
    const m = this.maos[s]; if (!m || w <= 0.001) return;
    const D = DOBRA[tipo], q = new THREE.Quaternion();
    for (const f of m.dedos) {
      q.setFromAxisAngle(f.eixo, (f.polegar ? D.polegar : D.dedo)[f.ordem] * Math.PI / 180).multiply(f.repouso);
      f.b.quaternion.slerp(q, w);
    }
  }

  // IK do braço `s`: pulso em `alvo`, cotovelo para o lado de `polo`, mão com a rotação `qMao`
  // (no mundo). `w` mistura com a pose da animação.
  _ik(s, alvo, polo, qMao, w) {
    if (w <= 0.001) return;
    const o = this.ossos, ua = o['UpperArm' + s], la = o['LowerArm' + s], wr = o['Wrist' + s];
    const antes = [ua.quaternion.clone(), la.quaternion.clone(), wr.quaternion.clone()];
    const S = wpos(ua), E = wpos(la), W = wpos(wr);
    const l1 = S.distanceTo(E), l2 = E.distanceTo(W);
    const d = alvo.clone().sub(S);
    const dist = THREE.MathUtils.clamp(d.length(), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999); d.normalize();
    const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
    const v = polo.clone().addScaledVector(d, -polo.dot(d)).normalize();
    const E2 = S.clone().addScaledVector(d, l1 * cosA).addScaledVector(v, l1 * Math.sqrt(Math.max(0, 1 - cosA * cosA)));
    const T = S.clone().addScaledVector(d, dist);
    mirarOsso(ua, E.sub(S), E2.clone().sub(S)); ua.updateMatrixWorld(true);
    mirarOsso(la, wpos(wr).sub(E2), T.sub(E2)); la.updateMatrixWorld(true);
    wr.quaternion.copy(wquat(wr.parent).invert().multiply(qMao.clone().multiply(this.maos[s].off)));
    if (w < 0.999) [ua, la, wr].forEach((b, i) => b.quaternion.slerpQuaternions(antes[i], b.quaternion.clone(), w));
    ua.updateMatrixWorld(true);
  }

  // caneca colada na palma da mão direita, em pé no referencial da mão (de cabeça para baixo no sinal)
  _canecaNaMao() {
    const c = this.caneca, m = this.maos?.R; if (!c || !m) return;
    const H = quadroMao(this.ossos, 'R');
    c.position.copy(m.centro).applyQuaternion(H.q).add(H.w);
    // eixos da caneca no referencial da mão: alça (x) para fora da palma, boca (y) para cima
    const inv = this.canecaInvertida;
    _m4.makeBasis(V(0, 1, 0), V(0, 0, inv ? -1 : 1), V(inv ? -1 : 1, 0, 0));
    c.quaternion.setFromRotationMatrix(_m4).premultiply(H.q);
  }

  // braços procedurais de quem está vivo: carregar e beber o café, digitar na mesa
  _bracos(dt) {
    if (!this.maos?.R) return;
    const o = this.ossos, vivo = this.estado === 'vivo';
    const nome = this.atual?.getClip().name;
    const segura = !!this.caneca && vivo && (nome === 'Idle' || nome === 'Idle_Neutral' || nome === 'Walk' || nome === 'Interact');
    const digita = vivo && !!this.teclado && !this.andando && nome !== 'Walk';
    const F = V(0, 0, 1).applyQuaternion(this.obj.quaternion), U = V(0, 1, 0);
    const Esq = V(1, 0, 0).applyQuaternion(this.obj.quaternion);       // lado esquerdo da pessoa
    const R = this.maos.R, L = this.maos.L;
    const suave = (m, alvo) => { m.w += (alvo - m.w) * Math.min(1, dt * 5); if (m.w < 0.002) m.w = 0; };
    suave(R, segura || (digita && !this.caneca) ? 1 : 0);
    if (L) suave(L, digita ? 1 : 0);
    // gole: de 8 a 30 s, leva à boca, segura, desce (2,6 s)
    if (segura && R.w > 0.9 && !this._gole) {
      this._proxGole = (this._proxGole ?? 3 + Math.random() * 12) - dt;
      if (this._proxGole <= 0) this._gole = 1e-4;
    }
    let g = 0;
    if (this._gole) {
      this._gole += dt;
      const t = this._gole;
      g = t < 0.7 ? THREE.MathUtils.smoothstep(t, 0, 0.7) : t < 1.9 ? 1 : 1 - THREE.MathUtils.smoothstep(t, 1.9, 2.6);
      if (t > 2.6 || !segura) { this._gole = 0; this._proxGole = 8 + Math.random() * 22; g = 0; }
    }
    this.bebendo = g;
    if (this.caneca && R.w > 0) {
      const S = wpos(o.UpperArmR), l1 = S.distanceTo(wpos(o.LowerArmR)), l2 = wpos(o.LowerArmR).distanceTo(wpos(o.WristR));
      const qC = baseMao(F.clone().addScaledVector(U, 0.12), Esq);
      let alvo = S.clone().addScaledVector(U, -l1 * 0.93 - 0.05).addScaledVector(F, l2 * 0.8).addScaledVector(Esq, 0.04);
      let polo = V().addScaledVector(U, -1).addScaledVector(F, -0.5).addScaledVector(Esq, -0.3);
      let q = qC;
      if (g > 0) {
        const qB = new THREE.Quaternion().setFromAxisAngle(Esq.clone().negate(), 1.05).multiply(qC);
        const boca = wpos(o.Head).addScaledVector(F, 0.15).addScaledVector(U, -0.035);
        alvo.lerp(boca.sub(R.centro.clone().applyQuaternion(qB)), g);
        polo.lerp(V().addScaledVector(U, -1).addScaledVector(Esq, -0.9), g);
        q = qC.clone().slerp(qB, g);
      }
      this._ik('R', alvo, polo, q, R.w);
    }
    // mãos no teclado (quem tem caneca digita só com a esquerda)
    if (this.teclado) for (const s of this.caneca ? ['L'] : ['L', 'R']) {
      const m = this.maos[s]; if (!m || m.w <= 0) continue;
      const lado = s === 'L' ? 1 : -1;
      const bate = Math.max(0, Math.sin(this.t * 11 + (s === 'L' ? 1.9 : 0))) * 0.012;
      const alvo = this.teclado.clone().addScaledVector(Esq, lado * 0.1).addScaledVector(F, -0.08).addScaledVector(U, 0.04 + bate);
      const q = baseMao(F.clone().addScaledVector(U, -0.3), U.clone().negate());
      this._ik(s, alvo, V().addScaledVector(U, -1).addScaledVector(Esq, lado * 0.7).addScaledVector(F, -0.2), q, m.w);
      this._dobrar(s, 'teclado', m.w);
    }
    if (g > 0) this._girarOssoEixo('Head', Esq, -0.22 * g);          // inclina a cabeça para trás ao beber
    if (this.caneca) { this._dobrar('R', 'caneca', 1); this._canecaNaMao(); }
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
    // caneca na mão direita: fica na cena e é posta na palma a cada quadro (_canecaNaMao)
    if (this.ficha.caneca) {
      this.canecaInvertida = this.sinais.has('caneca');
      const c = caneca(this.canecaInvertida);
      this.cena.add(c); this.extras.push(c);
      this.caneca = c;
      this._dobrar('R', 'caneca', 1); this._canecaNaMao();
    }
    if (this.sinais.has('olho')) {
      this.brilhos = brilhoDosOlhos(this, frente, V(1, 0, 0).applyQuaternion(this.obj.quaternion));
      for (const s of this.brilhos) { this.cena.add(s); this.ossos.Head.attach(s); this.extras.push(s); }
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
    if (this.sinais.has('sombra')) { this.raiz.traverse(m => { if (m.isMesh) m.castShadow = false; }); this.sombraPe.visible = false; }
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

  // medidas da caneca na mão (para a prova): folga palma-caneca, distância das pontas dos dedos
  // à parede da caneca, se está em pé e a distância até a boca
  medirCaneca() {
    const c = this.caneca; if (!c) return null;
    this.raiz.updateMatrixWorld(true);
    const H = quadroMao(this.ossos, 'R');
    const eixo = V(0, this.canecaInvertida ? -1 : 1, 0).applyQuaternion(c.quaternion);
    const aoEixo = (p) => { const d = p.sub(c.position); return d.addScaledVector(eixo, -d.dot(eixo)).length(); };
    const pontas = ['Index4R', 'Middle4R', 'Ring4R'].map(n => aoEixo(wpos(this.ossos[n])) - CANECA_R);
    return {
      folga: H.palma.distanceTo(c.position) - CANECA_R,
      dedos: Math.max(...pontas),
      emPe: eixo.y,
      boca: wpos(this.ossos.Head).distanceTo(c.position),
      bebendo: this.bebendo || 0,
    };
  }

  // ---- cada quadro: animação + sinais por cima da animação
  atualizar(dt, ctx) {
    this.t += dt;
    // ossos que os ajustes mexem por cima da animação: volta à pose de antes do ajuste,
    // senão (quando a animação não tem trilha daquele osso) o ajuste se acumula a cada quadro
    if (!this._base) { this._base = {}; for (const n of MEXIDOS) if (this.ossos[n]) this._base[n] = this.ossos[n].quaternion.clone(); }
    for (const n in this._base) this.ossos[n].quaternion.copy(this._base[n]);
    this.mixer.update(dt);
    for (const n in this._base) this._base[n].copy(this.ossos[n].quaternion);
    this.vis.clear();
    // o soco do esqueleto masculino gira o corpo inteiro uns 70 graus para o lado: o golpe saía de
    // lado para o jogador. Deixa no máximo 20 graus de giro dos ombros em relação a quem soca.
    if (this.atual === this.acoes.Punch_Right) {
      const esq = V(1, 0, 0).applyQuaternion(this.obj.quaternion);
      const om = wpos(this.ossos.ShoulderL).sub(wpos(this.ossos.ShoulderR));
      const giro = Math.atan2(esq.x * om.z - esq.z * om.x, esq.x * om.x + esq.z * om.z);   // ângulo de esq até om (em torno de -y)
      const resto = THREE.MathUtils.clamp(giro, -0.35, 0.35);
      if (Math.abs(giro - resto) > 0.01) this._girarOssoEixo('Root', CIMA, giro - resto);
    }
    if (this.estado !== 'vivo') {
      this._atualizarRevelacao(dt, ctx);
      if (this.caneca) { this._dobrar('R', 'caneca', 1); this._canecaNaMao(); }
      return;
    }
    for (const s of SEMPRE) if (this.sinais.has(s)) this.vis.add(s);
    const andando = this.andando;
    if (andando) { if (this.sinais.has('re')) this.vis.add('re'); if (this.sinais.has('bracos')) this.vis.add('bracos'); }
    // sinal: braços parados ao andar
    // (duros na pose de repouso e um pouco afastados do corpo, como um boneco de vitrine)
    if (this.sinais.has('bracos') && andando) {
      for (const [n, q] of Object.entries(this.repousoBracos)) this.ossos[n].quaternion.slerp(q, 0.92);
      const F = V(0, 0, 1).applyQuaternion(this.obj.quaternion);
      this._girarOssoEixo('UpperArmL', F, 0.24); this._girarOssoEixo('UpperArmR', F, -0.24);
    }
    // sinal: pé virado para trás: a canela gira meia volta em torno dela mesma e leva o pé junto
    if (this.sinais.has('pe')) {
      const o = this.ossos;
      this._girarOssoEixo('LowerLegR', wpos(o.FootR).sub(wpos(o.LowerLegR)).normalize(), Math.PI);
    }
    // caneca, gole de café, mãos no teclado
    this._bracos(dt);
    // cabeça: alienígena gira além do limite; humano olha para o jogador às vezes
    let alvoGiro = 0;
    const giraCabeca = this.sinais.has('cabeca');
    if (giraCabeca && this.t % RITMO.cabeca.ciclo > RITMO.cabeca.ciclo - RITMO.cabeca.dura) alvoGiro = 172;
    if (this.olhar && !giraCabeca) alvoGiro = this._anguloPara(this.olhar, 70);
    if (this.encarando) alvoGiro = this._anguloPara(ctx.camera.position, 75);
    this.giroExtra += (alvoGiro - this.giroExtra) * Math.min(1, dt * (giraCabeca && alvoGiro > 100 ? 3.2 : 5));
    if (Math.abs(this.giroExtra) > 0.5) {
      this._girarOssoMundo('Neck', this.giroExtra * 0.25 * Math.PI / 180);
      this._girarOssoMundo('Head', this.giroExtra * 0.75 * Math.PI / 180);
    }
    if (giraCabeca && this.giroExtra > 120) this.vis.add('cabeca');
    if (this.encarando && this.sinais.has('encara')) this.vis.add('encara');
    // sinal: olhos verdes (o material do olho acende e um brilho aditivo aparece em cada olho)
    if (this.sinais.has('olho')) {
      const { ciclo, dura } = RITMO.olho, c = this.t % ciclo;
      const on = c < dura ? Math.min(1, Math.sin(c / dura * Math.PI) * 1.6) : 0;
      for (const m of this.olhos) { const mt = mat0(m); mt.emissive.setHex(0x39ff7a); mt.emissiveIntensity = on * 3.2; }
      for (const s of this.brilhos || []) s.material.opacity = on;
      if (on > 0.3) this.vis.add('olho');
    }
    // sinal: falha na imagem. Rajada de quadros: some, salta para o lado, fica ciano ou magenta
    if (this.sinais.has('falha')) {
      const { ciclo, dura } = RITMO.falha, c = (this.t + 1.3) % ciclo;
      let tinta = null;
      if (c < dura) {
        const k = Math.floor(c / 0.06) % 5;
        this.raiz.visible = k !== 0 && k !== 3;
        this.raiz.position.x = k === 1 ? 0.14 : k === 4 ? -0.1 : 0;
        tinta = k === 2 ? 0x00e5ff : k === 4 ? 0xff2bd6 : null;
        this.vis.add('falha');
      } else { this.raiz.visible = true; this.raiz.position.x = 0; }
      if (this.caneca) this.caneca.visible = this.raiz.visible;
      this._tingir(tinta);
    }
    // sinal: vapor gelado
    if (this.sinais.has('vapor') && ctx.particulas) {
      this._vapor = (this._vapor || 0) - dt;
      this._vaporT = (this._vaporT ?? 99) + dt;
      if (this._vapor <= 0) {
        this._vapor = RITMO.vapor.ciclo + Math.random() * 0.3; this._vaporT = 0;
        const h = this.ossos.Head.getWorldPosition(V());
        const f = V(0, 0, 1).applyQuaternion(this.obj.quaternion);
        ctx.particulas.vapor(h.addScaledVector(f, 0.13).add(V(0, 0.02, 0)), f);
      }
      if (this._vaporT < RITMO.vapor.dura) this.vis.add('vapor');
    }
  }

  // pinta todos os materiais da pessoa com uma cor emissiva (null = volta ao normal)
  _tingir(cor) {
    if (this._tinta === cor) return;
    this._tinta = cor;
    if (!this._mats) {
      this._mats = [];
      this.raiz.traverse(m => { if (m.isMesh) for (const mt of [].concat(m.material)) if (mt.emissive) this._mats.push({ mt, e: mt.emissive.getHex(), i: mt.emissiveIntensity }); });
    }
    for (const x of this._mats) {
      if (cor == null) { x.mt.emissive.setHex(x.e); x.mt.emissiveIntensity = x.i; }
      else { x.mt.emissive.setHex(cor); x.mt.emissiveIntensity = 0.85; }
    }
  }

  _anguloPara(ponto, max) {
    const d = V().subVectors(ponto, this.obj.position);
    const yawAlvo = Math.atan2(d.x, d.z);
    let a = (yawAlvo - this.obj.rotation.y) * 180 / Math.PI;
    a = ((a + 540) % 360) - 180;
    return Math.max(-max, Math.min(max, a));
  }

  _girarOssoMundo(nome, ang) { this._girarOssoEixo(nome, CIMA, ang); }
  // gira o osso em torno de um eixo do mundo, por cima da pose atual
  _girarOssoEixo(nome, eixoMundo, ang) {
    const b = this.ossos[nome]; if (!b) return;
    const eixo = eixoMundo.clone().applyQuaternion(wquat(b.parent).invert());
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
    this.raiz.visible = true; this.raiz.position.x = 0; this._tingir(null);
    if (this.caneca) this.caneca.visible = true;
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
      if (this.tRev > 1.0) { this.estado = 'hostil'; this.reiniciar('Run', 0.2, this.escalaCorrida); }
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
