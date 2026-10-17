// A arma: o Grampeador Improvisado (nível 1 do kit O GRAMPEADOR), na mão do jogador.
// Desenhada numa cena própria por cima do escritório (não atravessa parede nem mesa),
// com balanço ao andar, coice no disparo, recarga e pente de grampos.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const PENTE = 12;
const CADENCIA = 0.26;        // s entre grampos
const RECARGA = 1.35;         // s

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
    this.pente = PENTE; this.espera = 0; this.recarregando = 0;
    this.coice = 0; this.balanco = 0; this.abaixada = 0; this.visivel = true;
    this.boca = V();            // ponta, no espaço do rig
  }

  async carregar(url) {
    const g = await new GLTFLoader().loadAsync(url);
    const m = g.scene;
    m.traverse(o => { if (o.isMesh) { o.frustumCulled = false; const mt = o.material; if (mt) { mt.envMapIntensity = 1; } } });
    // a arma aponta +x no arquivo; aqui aponta -z
    const bb = new THREE.Box3().setFromObject(m), tam = bb.getSize(V()), c = bb.getCenter(V());
    const s = POSE.tam / tam.x;
    m.position.copy(c).multiplyScalar(-s);
    m.scale.setScalar(s);
    const pivo = new THREE.Group(); pivo.add(m);
    pivo.rotation.y = Math.PI / 2;
    this.rig.add(pivo);
    this.boca.set(0, (bb.max.y - c.y) * s * 0.15, -tam.x * s * 0.5);
    this.modelo = m;
    return this;
  }

  ajustar(aspecto) { this.camera.aspect = aspecto; this.camera.updateProjectionMatrix(); }

  // devolve true se saiu um grampo
  disparar() {
    if (this.espera > 0 || this.recarregando > 0) return false;
    if (this.pente <= 0) { this.recarregar(); return false; }
    this.pente--; this.espera = CADENCIA; this.coice = 1;
    if (this.pente === 0) this.recarregar(0.25);
    return true;
  }
  recarregar(atraso = 0) {
    if (this.recarregando > 0 || this.pente === PENTE) return false;
    this.recarregando = RECARGA + atraso; this._atrasoRec = atraso;
    return true;
  }
  get ocupada() { return this.recarregando > 0; }

  atualizar(dt, { andando = 0, zoom = false, giro = 0 } = {}) {
    this.espera = Math.max(0, this.espera - dt);
    if (this.recarregando > 0) {
      this.recarregando -= dt;
      if (this.recarregando <= 0) { this.recarregando = 0; this.pente = PENTE; }
    }
    this.coice = Math.max(0, this.coice - dt * 7);
    this.balanco += dt * (andando ? 8.5 * andando : 1.2);
    this.abaixada += ((zoom ? 1 : 0) - this.abaixada) * Math.min(1, dt * 10);
    this._giro = (this._giro || 0) * Math.pow(0.002, dt) + giro * 0.02;
    const amp = andando ? 0.012 * andando : 0.003;
    // recarga: desce, gira, volta
    const tr = this.recarregando > 0 ? 1 - Math.max(0, this.recarregando) / (RECARGA + (this._atrasoRec || 0)) : 0;
    const rec = this.recarregando > 0 ? Math.sin(Math.min(1, tr) * Math.PI) : 0;
    const k = this.coice * this.coice;
    const r = this.rig;
    r.position.set(
      POSE.x + Math.sin(this.balanco) * amp - this._giro * 0.4,
      POSE.y - Math.abs(Math.cos(this.balanco)) * amp * 0.8 - rec * 0.12 - this.abaixada * 0.16,
      POSE.z + k * 0.07 + rec * 0.04);
    r.rotation.set(POSE.pitch + k * 0.32 - rec * 0.7, POSE.yaw + rec * 0.35 + this._giro, POSE.roll - rec * 0.5, 'YXZ');
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
