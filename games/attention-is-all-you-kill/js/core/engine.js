// engine.js — renderer, cena, camera, luz e qualidade.
// Poucas luzes fortes em vez de muitas fracas. Sem shadow map: sombra e decal escuro.

import * as THREE from '../../vendor/three.module.js';

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false
    });
    this.renderer.setClearColor(0x05070d, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.52;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x060b12, 0.032);

    this.camera = new THREE.PerspectiveCamera(80, 1, 0.06, 160);
    this.camera.rotation.order = 'YXZ';

    // Luz base: cor alterada pelo tema do andar e pelo estado do jogador.
    // Datacenter precisa parecer iluminado, nao um porao.
    this.ambient = new THREE.AmbientLight(0x7498b0, 2.20);
    this.scene.add(this.ambient);

    this.hemi = new THREE.HemisphereLight(0x4d82a0, 0x1c2836, 1.35);
    this.scene.add(this.hemi);

    // Luz direcional fraca so para dar volume nas caixas.
    this.sun = new THREE.DirectionalLight(0xbfe0f5, 0.60);
    this.sun.position.set(0.4, 1, 0.25);
    this.scene.add(this.sun);

    this.quality = 'high';
    this._basePixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(this.quality === 'low' ? 1 : this._basePixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setQuality(level) {
    this.quality = level;
    this.resize();
  }

  // A luz do ambiente conta a historia: quanto menos contexto, mais vermelho.
  setMood({ ambient, fogColor, fogDensity, hemi }) {
    if (ambient !== undefined) this.ambient.color.setHex(ambient);
    if (hemi !== undefined) this.hemi.color.setHex(hemi);
    if (fogColor !== undefined) this.scene.fog.color.setHex(fogColor);
    if (fogDensity !== undefined) this.scene.fog.density = fogDensity;
    this.renderer.setClearColor(this.scene.fog.color, 1);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

// Ajusta FOV e sensibilidade quando o viewport pede.
export function autoQuality() {
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (mobile) return 'low';
  if (cores <= 4) return 'medium';
  return 'high';
}

export { THREE };
