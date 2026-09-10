// merge.js — junta varias geometrias num unico BufferGeometry.
//
// Por que existe: cada peca de um inimigo era um Mesh separado, e um inimigo
// detalhado tem 15 pecas. Com uma sala cheia isso passava de 400 chamadas de
// desenho, o que derruba o FPS em celular. Juntando as pecas que compartilham
// material, o mesmo inimigo passa a custar 3.
//
// Nao usa BufferGeometryUtils porque o projeto nao tem o addon do Three: em
// vendor/ existe apenas o modulo principal.

import * as THREE from '../../vendor/three.module.js';

export function mergeParts(parts) {
  if (!parts || parts.length === 0) return null;
  if (parts.length === 1) {
    const so = parts[0].geo.clone();
    so.applyMatrix4(parts[0].matrix);
    return so;
  }

  let totalVertices = 0;
  let totalIndex = 0;
  for (const p of parts) {
    const g = p.geo;
    totalVertices += g.attributes.position.count;
    totalIndex += g.index ? g.index.count : g.attributes.position.count;
  }

  const posicoes = new Float32Array(totalVertices * 3);
  const normais = new Float32Array(totalVertices * 3);
  const uvs = new Float32Array(totalVertices * 2);
  const indices = new Uint32Array(totalIndex);

  const normalMatrix = new THREE.Matrix3();
  const v = new THREE.Vector3();
  let vOffset = 0;
  let iOffset = 0;

  for (const p of parts) {
    const g = p.geo;
    const m = p.matrix;
    normalMatrix.getNormalMatrix(m);

    const aPos = g.attributes.position;
    const aNor = g.attributes.normal;
    const aUv = g.attributes.uv;

    for (let i = 0; i < aPos.count; i++) {
      v.fromBufferAttribute(aPos, i).applyMatrix4(m);
      const o3 = (vOffset + i) * 3;
      posicoes[o3] = v.x;
      posicoes[o3 + 1] = v.y;
      posicoes[o3 + 2] = v.z;

      if (aNor) {
        v.fromBufferAttribute(aNor, i).applyMatrix3(normalMatrix).normalize();
        normais[o3] = v.x;
        normais[o3 + 1] = v.y;
        normais[o3 + 2] = v.z;
      }

      if (aUv) {
        const o2 = (vOffset + i) * 2;
        uvs[o2] = aUv.getX(i);
        uvs[o2 + 1] = aUv.getY(i);
      }
    }

    if (g.index) {
      for (let i = 0; i < g.index.count; i++) {
        indices[iOffset + i] = g.index.getX(i) + vOffset;
      }
      iOffset += g.index.count;
    } else {
      for (let i = 0; i < aPos.count; i++) indices[iOffset + i] = vOffset + i;
      iOffset += aPos.count;
    }

    vOffset += aPos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(posicoes, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normais, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingSphere();
  return merged;
}
