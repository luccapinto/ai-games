// A arma: o grampeador do kit O GRAMPEADOR, na mão do jogador, nos seis níveis do kit
// (L1, L2, L3C/L3I, L4C/L4I; ver ARMA em dados.js). Um glb só traz as peças de todos os níveis;
// cada nível liga as suas. Desenhada numa cena própria por cima do escritório (não atravessa
// parede nem mesa), com balanço ao andar, coice, recarga, troca de nível animada e, no nível 4,
// fragmentos que flutuam e núcleo que pulsa.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ARMA } from './dados.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// troca de nível (s): abaixa a arma, troca as peças, sobe com as peças novas "pulando" no lugar uma a uma
const TROCA = { desce: 0.25, sobe: 0.6, pulo: 0.3, passo: 0.06, dura: 0.25, fim: 1.05 };
// comprimento na tela de cada nível, em relação ao nível 1 (os níveis altos são maiores, sem tapar a tela)
const TAM = { L1: 1, L2: 1.08, L3C: 1.16, L3I: 1.16, L4C: 1.24, L4I: 1.24 };

// pose de descanso no espaço da câmera da arma (-z = frente)
export const POSE = { x: 0.25, y: -0.22, z: -0.52, yaw: 0.8, pitch: 0.05, roll: -0.06, tam: 0.28 };

export class Arma {
  constructor(ambiente) {
    this.cena = new THREE.Scene();
    this.cena.environment = ambiente; this.cena.environmentIntensity = 0.55;
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
    this.cena.add(new THREE.HemisphereLight(0xf4f8ff, 0x6a645a, 1.4));
    const sol = new THREE.DirectionalLight(0xfff1dc, 1.8); sol.position.set(1.5, 2, 1); this.cena.add(sol);
    this.rig = new THREE.Group(); this.cena.add(this.rig);
    this.nivel = 'L1'; this.cfg = ARMA.L1;
    this.pente = this.cfg.pente; this.espera = 0; this.recarregando = 0;
    this.coice = 0; this.balanco = 0; this.abaixada = 0; this.visivel = true; this.t = 0;
    this.troca = 0;              // > 0 durante a animação de troca de nível
    this.boca = V();             // ponta, no espaço do rig
  }

  async carregar(url) {
    const g = await new GLTFLoader().loadAsync(url);
    const m = g.scene;
    m.traverse(o => { if (o.isMesh) { o.frustumCulled = false; if (o.material) o.material.envMapIntensity = 1; } });
    // peças de cada nível (lista do manifesto do kit, gravada nos extras da cena pelo preparar_arma.py)
    this.variantes = Object.fromEntries(m.userData.variantes.map(v => [v.id, v.parts]));
    this.pecas = {};
    for (const nomes of Object.values(this.variantes)) for (const n of nomes) {
      const o = m.getObjectByName(n);
      if (o) this.pecas[n] = { o, escala: o.scale.clone(), pos: o.position.clone(), rot: o.rotation.clone() };
    }
    m.updateMatrixWorld(true);
    const caixa = (id) => { const bb = new THREE.Box3(); for (const n of this.variantes[id]) if (this.pecas[n]) bb.expandByObject(this.pecas[n].o); return bb; };
    // a arma aponta +x no arquivo; aqui aponta -z. Cada nível tem a sua escala (comprimento POSE.tam × TAM)
    // e o seu centro; o modelo inteiro é ajustado quando as peças trocam.
    this.ajuste = {}; this.bocas = {};
    for (const id of Object.keys(this.variantes)) {
      const bb = caixa(id), tam = bb.getSize(V()), c = bb.getCenter(V());
      const s = POSE.tam * (TAM[id] ?? 1) / tam.x;
      this.ajuste[id] = { s, pos: c.clone().multiplyScalar(-s) };
      // ponta, no espaço do rig (+x do arquivo vira -z), um pouco acima do eixo
      this.bocas[id] = V(0, tam.y / 2 * s * 0.15, -tam.x / 2 * s);
    }
    const pivo = new THREE.Group(); pivo.add(m);
    pivo.rotation.y = Math.PI / 2;
    this.rig.add(pivo);
    // nível 4: peças "float" flutuam e giram; materiais que brilham pulsam
    this.flutuam = Object.entries(this.pecas).filter(([n]) => n.includes('float')).map(([, p]) => p);
    this.brilham = [];
    for (const [n, p] of Object.entries(this.pecas)) if (/_l4/.test(n)) p.o.traverse(o => {
      if (o.isMesh && o.material?.emissive && o.material.emissive.getHex() !== 0 && !this.brilham.some(b => b.mt === o.material))
        this.brilham.push({ mt: o.material, i: o.material.emissiveIntensity });
    });
    this.modelo = m;
    this.aplicar('L1');
    return this;
  }

  // muda de nível: atributos na hora; as peças trocam já ou com a animação de troca
  aplicar(id, animar = false) {
    this.nivel = id; this.cfg = ARMA[id];
    this.pente = this.cfg.pente; this.espera = 0; this.recarregando = 0;
    if (this.bocas) this.boca.copy(this.bocas[id]);
    if (animar && this.pecas) { this.troca = 1e-4; this._trocou = false; }
    else this._mostrar(id);
  }
  _mostrar(id) {
    if (!this.pecas) return;
    const liga = new Set(this.variantes[id]);
    for (const [n, p] of Object.entries(this.pecas)) { p.o.visible = liga.has(n); p.o.scale.copy(p.escala); }
    this.modelo.scale.setScalar(this.ajuste[id].s); this.modelo.position.copy(this.ajuste[id].pos);
  }
  pecasVisiveis() { return this.pecas ? Object.keys(this.pecas).filter(n => this.pecas[n].o.visible) : []; }

  ajustar(aspecto) { this.camera.aspect = aspecto; this.camera.updateProjectionMatrix(); }

  // devolve true se saiu um grampo
  disparar() {
    if (this.espera > 0 || this.recarregando > 0 || this.troca > 0) return false;
    if (this.pente <= 0) { this.recarregar(); return false; }
    this.pente--; this.espera = this.cfg.cadencia; this.coice = 1;
    if (this.pente === 0) this.recarregar(0.25);
    return true;
  }
  recarregar(atraso = 0) {
    if (this.recarregando > 0 || this.pente === this.cfg.pente) return false;
    this.recarregando = this.cfg.recarga + atraso; this._atrasoRec = atraso;
    return true;
  }
  get ocupada() { return this.recarregando > 0 || this.troca > 0; }

  atualizar(dt, { andando = 0, zoom = false, giro = 0 } = {}) {
    this.t += dt;
    this.espera = Math.max(0, this.espera - dt);
    if (this.recarregando > 0) {
      this.recarregando -= dt;
      if (this.recarregando <= 0) { this.recarregando = 0; this.pente = this.cfg.pente; }
    }
    // troca de nível: desce, troca as peças, sobe; cada peça nova "pula" para o lugar, uma depois da outra
    let desce = 0;
    if (this.troca > 0) {
      this.troca += dt;
      const t = this.troca;
      desce = t < TROCA.desce ? t / TROCA.desce : Math.max(0, 1 - (t - TROCA.desce) / (TROCA.sobe - TROCA.desce));
      desce = desce * desce * (3 - 2 * desce);
      if (t >= TROCA.desce && !this._trocou) { this._mostrar(this.nivel); this._trocou = true; }
      if (this._trocou) this.variantes[this.nivel].forEach((n, i) => {
        const p = this.pecas[n]; if (!p) return;
        const k = Math.min(1, Math.max(0, (t - TROCA.pulo - i * TROCA.passo) / TROCA.dura));
        const pulo = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);   // 0 -> passa um pouco de 1 -> 1
        p.o.scale.copy(p.escala).multiplyScalar(Math.max(0.001, pulo));
      });
      if (t >= TROCA.fim) { this.troca = 0; this._mostrar(this.nivel); }
    }
    // nível 4: fragmentos flutuando e núcleo pulsando
    if (this.nivel.startsWith('L4')) {
      this.flutuam.forEach((p, i) => { p.o.position.y = p.pos.y + Math.sin(this.t * 2.2 + i * 1.3) * 0.06; p.o.rotation.y = p.rot.y + this.t * (0.8 + i * 0.2); });
      for (const b of this.brilham) b.mt.emissiveIntensity = b.i * (0.7 + 0.3 * Math.sin(this.t * 4));
    }
    this.coice = Math.max(0, this.coice - dt * 7);
    this.balanco += dt * (andando ? 8.5 * andando : 1.2);
    this.abaixada += ((zoom ? 1 : 0) - this.abaixada) * Math.min(1, dt * 10);
    this._giro = (this._giro || 0) * Math.pow(0.002, dt) + giro * 0.02;
    const amp = andando ? 0.012 * andando : 0.003;
    // recarga: desce, gira, volta
    const tr = this.recarregando > 0 ? 1 - Math.max(0, this.recarregando) / (this.cfg.recarga + (this._atrasoRec || 0)) : 0;
    const rec = this.recarregando > 0 ? Math.sin(Math.min(1, tr) * Math.PI) : 0;
    const k = this.coice * this.coice * this.cfg.coice;
    const r = this.rig;
    r.position.set(
      POSE.x + Math.sin(this.balanco) * amp - this._giro * 0.4,
      POSE.y - Math.abs(Math.cos(this.balanco)) * amp * 0.8 - rec * 0.12 - this.abaixada * 0.16 - desce * 0.24,
      POSE.z + k * 0.07 + rec * 0.04);
    r.rotation.set(POSE.pitch + k * 0.32 - rec * 0.7 - desce * 0.6, POSE.yaw + rec * 0.35 + this._giro, POSE.roll - rec * 0.5, 'YXZ');
    r.visible = this.visivel && this.abaixada < 0.97;
  }

  // ponta da arma no mundo do escritório (para o grampo sair dela)
  bocaNoMundo(cameraMundo) {
    this.rig.updateMatrixWorld(true);
    const p = this.boca.clone().applyMatrix4(this.rig.matrixWorld);   // espaço da câmera da arma
    // a câmera da arma tem fov diferente; projeta na tela dela e desprojeta a 0,5 m na câmera do mundo
    const ndc = p.clone().project(this.camera);
    const d = 0.5;
    const v = V(ndc.x, ndc.y, 0.5).unproject(cameraMundo).sub(cameraMundo.position).normalize();
    return cameraMundo.position.clone().addScaledVector(v, d);
  }

  desenhar(render) {
    if (!this.rig.visible) return;
    const auto = render.autoClear;
    render.autoClear = false; render.clearDepth();
    render.render(this.cena, this.camera);
    render.autoClear = auto;
  }
}

// Grampo (U de arame) — usado como projétil e como grampo cravado
const GEO_HASTE = new THREE.BoxGeometry(0.0035, 0.0035, 0.012);
const GEO_COROA = new THREE.BoxGeometry(0.026, 0.0035, 0.0035);
const MAT_GRAMPO = new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 0.9, roughness: 0.25 });
export function grampo(escala = 1) {
  const g = new THREE.Group();
  const coroa = new THREE.Mesh(GEO_COROA, MAT_GRAMPO); g.add(coroa);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(GEO_HASTE, MAT_GRAMPO); h.position.set(s * 0.0115, 0, -0.006); g.add(h); }
  g.scale.setScalar(escala);
  return g;
}
