// pool.js — reciclagem de objetos para projeteis e particulas.
// Criar mesh por tiro destroi a performance. Aqui nada e criado depois do boot.

import * as THREE from '../../vendor/three.module.js';

export class MeshPool {
  constructor(parent, geometry, material, size, { billboard = false } = {}) {
    this.parent = parent;
    this.geometry = geometry;
    this.material = material;
    this.size = size;
    this.billboard = billboard;
    this.items = [];
    this.free = [];
    this.activeCount = 0;
  }

  _create() {
    const mesh = new THREE.Mesh(this.geometry, this.material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    this.parent.add(mesh);
    const item = { mesh, alive: false };
    this.items.push(item);
    return item;
  }

  // Pega um item livre. Retorna null se o pool estourou.
  acquire() {
    for (let i = 0; i < this.free.length; i++) {
      const item = this.free.pop();
      item.alive = true;
      item.mesh.visible = true;
      this.activeCount++;
      return item;
    }
    if (this.items.length >= this.size) return null;
    const item = this._create();
    item.alive = true;
    item.mesh.visible = true;
    this.activeCount++;
    return item;
  }

  release(item) {
    if (!item.alive) return;
    item.alive = false;
    item.mesh.visible = false;
    this.activeCount--;
    this.free.push(item);
  }

  releaseAll() {
    for (const item of this.items) {
      if (item.alive) {
        item.alive = false;
        item.mesh.visible = false;
        this.free.push(item);
      }
    }
    this.activeCount = 0;
  }

  // Mantem os quads voltados para a camera (particulas, brilhos).
  faceCamera(camera) {
    if (!this.billboard) return;
    for (const item of this.items) {
      if (item.alive) item.mesh.quaternion.copy(camera.quaternion);
    }
  }
}