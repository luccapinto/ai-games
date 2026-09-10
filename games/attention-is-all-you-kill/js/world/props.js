// props.js — constroi o mundo visual a partir do grid do dungeon.
// Chão e teto são planos únicos. Paredes são apenas as faces visiveis,
// acumuladas numa única geometria. Racks usam InstancedMesh.

import * as THREE from '../../vendor/three.module.js';
import { TILE, WALL_H } from './dungeon.js';
import { floorTexture, wallTexture, ceilingTexture, rackTexture, signTexture, glowTexture, blobShadowTexture } from './textures.js';

// Acumulador de quads: monta uma geometria só para todas as faces de parede.
class QuadBuilder {
  constructor() {
    this.pos = [];
    this.norm = [];
    this.uv = [];
    this.idx = [];
    this.v = 0;
  }

  // p0..p3 em ordem anti-horaria vista de fora. uvs opcionais.
  quad(p0, p1, p2, p3, normal, uvScale = 1) {
    const base = this.v;
    const pts = [p0, p1, p2, p3];
    const uvs = [[0, 0], [uvScale, 0], [uvScale, 1], [0, 1]];
    for (let i = 0; i < 4; i++) {
      this.pos.push(pts[i].x, pts[i].y, pts[i].z);
      this.norm.push(normal.x, normal.y, normal.z);
      this.uv.push(uvs[i][0], uvs[i][1]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.v += 4;
  }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setIndex(this.idx);
    geo.computeBoundingSphere();
    return geo;
  }

  get empty() { return this.v === 0; }
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Os quatro vizinhos cardinais e a face correspondente que precisa existir.
const FACES = [
  { dx: 1, dz: 0, n: V(1, 0, 0), corners: (x0, x1, z0, z1) => [V(x1, 0, z0), V(x1, 0, z1), V(x1, WALL_H, z1), V(x1, WALL_H, z0)] },
  { dx: -1, dz: 0, n: V(-1, 0, 0), corners: (x0, x1, z0, z1) => [V(x0, 0, z1), V(x0, 0, z0), V(x0, WALL_H, z0), V(x0, WALL_H, z1)] },
  { dx: 0, dz: 1, n: V(0, 0, 1), corners: (x0, x1, z0, z1) => [V(x1, 0, z1), V(x0, 0, z1), V(x0, WALL_H, z1), V(x1, WALL_H, z1)] },
  { dx: 0, dz: -1, n: V(0, 0, -1), corners: (x0, x1, z0, z1) => [V(x0, 0, z0), V(x1, 0, z0), V(x1, WALL_H, z0), V(x0, WALL_H, z0)] }
];

export function buildWorld(scene, dungeon, theme) {
  const group = new THREE.Group();
  group.name = 'world';
  scene.add(group);

  const bounds = dungeon.bounds();
  const worldW = bounds.maxX;
  const worldD = bounds.maxZ;

  // ---------------- Chão ----------------
  const floorTex = floorTexture(theme, Math.floor(worldW / 6));
  const floorMat = new THREE.MeshLambertMaterial({ map: floorTex, color: 0xffffff });
  const floorGeo = new THREE.PlaneGeometry(worldW, worldD);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(worldW / 2, 0, worldD / 2);
  floor.name = 'floor';
  group.add(floor);

  // ---------------- Teto ----------------
  const ceilTex = ceilingTexture(theme, Math.floor(worldW / 6));
  const ceilMat = new THREE.MeshLambertMaterial({ map: ceilTex, color: 0xffffff });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldD), ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(worldW / 2, WALL_H, worldD / 2);
  ceiling.name = 'ceiling';
  group.add(ceiling);

  // ---------------- Paredes (somente faces visiveis) ----------------
  const qb = new QuadBuilder();
  for (let tz = 0; tz < dungeon.rows; tz++) {
    for (let tx = 0; tx < dungeon.cols; tx++) {
      if (!dungeon.isSolid(tx, tz)) continue;
      const x0 = tx * TILE, x1 = (tx + 1) * TILE;
      const z0 = tz * TILE, z1 = (tz + 1) * TILE;
      for (const face of FACES) {
        if (dungeon.isSolid(tx + face.dx, tz + face.dz)) continue;   // vizinho solido: face interna
        const [p0, p1, p2, p3] = face.corners(x0, x1, z0, z1);
        qb.quad(p0, p1, p2, p3, face.n, 1);
      }
    }
  }

  const wallTex = wallTexture(theme, 1);
  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex, color: 0xffffff });
  const wallGeo = qb.empty ? new THREE.BufferGeometry() : qb.build();
  const walls = new THREE.Mesh(wallGeo, wallMat);
  walls.name = 'walls';
  group.add(walls);

  // ---------------- Racks de servidor ----------------
  const props = buildRacks(scene, group, dungeon, theme);

  // ---------------- Cobertura de combate no miolo das salas ----------------
  const cobertura = buildCover(group, dungeon, theme);

  // ---------------- Dutos no teto ----------------
  buildCeilingDucts(group, dungeon, theme);

  // ---------------- Paineis de LED no teto ----------------
  buildCeilingPanels(group, dungeon, theme);

  // ---------------- Placas de sinal por sala ----------------
  buildSigns(group, dungeon, theme);

  // ---------------- Brilho de LED dos racks ----------------
  const glowTex = glowTexture(0xffffff);
  addGlowSprites(group, props.rackPositions, theme, glowTex);

  // ---------------- Poças de luz no chão ----------------
  addFloorPools(group, props.rackPositions, theme);

  return { group, props, glowTex, cobertura };
}

// ------------------------------------------------------------------
// Cobertura de combate: pilares e contêineres no miolo das salas.
//
// Os racks tiveram que sair do meio das salas porque bloqueavam a linha de
// visão. Isso resolveu o combate mas deixou o centro completamente exposto, e o
// jogador ficou sem onde se esconder de uma rajada. Estes props devolvem a
// cobertura sem refazer o problema: são poucos, ficam afastados das paredes e
// entre si, e a sala inteira e descartada se a visibilidade entre os pontos de
// combate cair abaixo do limite.
// ------------------------------------------------------------------
function buildCover(group, dungeon, theme) {
  const pilares = [];
  const caixas = [];

  for (const room of dungeon.rooms) {
    if (room.type === 'boss') continue;

    const candidatos = [];
    for (let tz = room.z1 + 1; tz < room.z2; tz++) {
      for (let tx = room.x1 + 1; tx < room.x2; tx++) {
        if (dungeon.isSolid(tx, tz)) continue;

        // folga dos cardinais: nada de pilar colado na parede ou na boca de um
        // corredor. A checagem completa das 8 direções deixava poucos
        // candidatos em sala pequena e a cobertura sumia.
        if (dungeon.isSolid(tx + 1, tz) || dungeon.isSolid(tx - 1, tz)) continue;
        if (dungeon.isSolid(tx, tz + 1) || dungeon.isSolid(tx, tz - 1)) continue;
        if (ehPassagem(dungeon, room, tx, tz)) continue;   // não trava a porta

        // Não filtramos por ponto de spawn: o gerador marca quase todos os
        // tiles livres da sala como spawn, então esse filtro zerava a cobertura.
        // Ocupar um spawn e aceitavel, a lista e revalidada no fim.
        candidatos.push({ tx, tz });
      }
    }
    if (candidatos.length === 0) continue;

    // duas pecas por sala, três se a sala for grande, sempre espacadas
    const alvo = (room.x2 - room.x1) * (room.z2 - room.z1) >= 54 ? 3 : 2;
    const embaralhado = candidatos.slice();
    for (let i = embaralhado.length - 1; i > 0; i--) {
      const j = Math.floor(dungeon._rand() * (i + 1));
      [embaralhado[i], embaralhado[j]] = [embaralhado[j], embaralhado[i]];
    }

    const escolhidos = [];
    for (const c of embaralhado) {
      if (escolhidos.length >= alvo) break;
      if (!escolhidos.every(e => Math.hypot(e.tx - c.tx, e.tz - c.tz) >= 3.0)) continue;
      escolhidos.push(c);
    }
    if (escolhidos.length === 0) continue;

    for (const c of escolhidos) dungeon.setSolid(c.tx, c.tz, true);

    // mesmas duas validacoes dos racks: caminho e visibilidade
    const ancora = room.spawns[0] || { tx: room.cx, tz: room.cz };
    const antes = floodCount(dungeon, ancora.tx, ancora.tz);

    const amostra = room.spawns.filter(s => !dungeon.isSolid(s.tx, s.tz)).slice(0, 8);
    let pares = 0;
    let visiveis = 0;
    for (let i = 0; i < amostra.length; i++) {
      for (let j = i + 1; j < amostra.length; j++) {
        const a = dungeon.tileCenter(amostra[i].tx, amostra[i].tz);
        const b = dungeon.tileCenter(amostra[j].tx, amostra[j].tz);
        pares++;
        if (dungeon.hasLineOfSight(a.x, a.z, b.x, b.z)) visiveis++;
      }
    }

    const livres = amostra.length;
    const visibilidadeOk = pares === 0 || visiveis / pares >= 0.62;
    const conectado = antes >= floodCount(dungeon, ancora.tx, ancora.tz);

    if (!visibilidadeOk || !conectado || livres < 3) {
      for (const c of escolhidos) dungeon.setSolid(c.tx, c.tz, false);
      continue;
    }

    room.spawns = room.spawns.filter(s => !dungeon.isSolid(s.tx, s.tz));

    escolhidos.forEach((c, i) => {
      // alterna pilar alto e contêiner baixo para variar a silhueta
      if (i % 2 === 0) pilares.push({ tx: c.tx, tz: c.tz });
      else caixas.push({ tx: c.tx, tz: c.tz });
    });
  }

  const grupo = new THREE.Group();
  grupo.name = 'cobertura';
  group.add(grupo);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const qAnel = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  const um = new THREE.Vector3(1, 1, 1);

  // pilares: coluna octogonal com anel emissivo, leitura de pilar de datacenter
  if (pilares.length) {
    const matPilar = new THREE.MeshLambertMaterial({
      map: rackTexture(theme, 2), color: 0xc2ced9
    });
    const geoPilar = new THREE.CylinderGeometry(0.56, 0.66, 3.4, 12, 1);
    const malha = new THREE.InstancedMesh(geoPilar, matPilar, pilares.length);

    const matAnel = new THREE.MeshBasicMaterial({ color: theme.propEmissive });
    const geoAnel = new THREE.TorusGeometry(0.60, 0.045, 8, 22);
    const aneis = new THREE.InstancedMesh(geoAnel, matAnel, pilares.length);

    pilares.forEach((p, i) => {
      const c = dungeon.tileCenter(p.tx, p.tz);
      m.compose(new THREE.Vector3(c.x, 1.7, c.z), q, um);
      malha.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(c.x, 0.62, c.z), qAnel, um);
      aneis.setMatrixAt(i, m);
    });
    malha.instanceMatrix.needsUpdate = true;
    aneis.instanceMatrix.needsUpdate = true;
    grupo.add(malha);
    grupo.add(aneis);
  }

  // contêineres: caixa baixa, cobertura de meia altura
  if (caixas.length) {
    const matCaixa = new THREE.MeshLambertMaterial({
      map: rackTexture(theme, 3), color: 0x9fb0bf
    });
    const geoCaixa = new THREE.BoxGeometry(2.1, 1.35, 1.5);
    const malhaC = new THREE.InstancedMesh(geoCaixa, matCaixa, caixas.length);

    const matTopo = new THREE.MeshBasicMaterial({ color: theme.propEmissive });
    const geoTopo = new THREE.BoxGeometry(2.0, 0.05, 1.4);
    const topos = new THREE.InstancedMesh(geoTopo, matTopo, caixas.length);

    caixas.forEach((c, i) => {
      const t = dungeon.tileCenter(c.tx, c.tz);
      m.compose(new THREE.Vector3(t.x, 0.68, t.z), q, um);
      malhaC.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(t.x, 1.36, t.z), q, um);
      topos.setMatrixAt(i, m);
    });
    malhaC.instanceMatrix.needsUpdate = true;
    topos.instanceMatrix.needsUpdate = true;
    grupo.add(malhaC);
    grupo.add(topos);
  }

  return { pilares, caixas };
}

// ------------------------------------------------------------------
// Racks: cobertura solida, textura de servidor, LED na frente.
// Nunca bloqueiam corredor nem ponto de spawn.
// ------------------------------------------------------------------
// Um tile e passagem se ele, ou um vizinho imediato dele, faz fronteira com um
// tile livre FORA da sala: e exatamente onde o corredor entra.
//
// Este teste existe por causa de um bug real de partida: o tile da boca do
// corredor e um tile vazio na borda da sala, cercado de parede dos dois lados.
// Para a regra antiga ("precisa ter parede vizinha") ele era o candidato
// perfeito, então o rack nascia em cima da porta e trancava o jogador dentro da
// sala. A validacao de conectividade não pegava isso quando a sala tinha outra
// saída: o flood fill continuava alcancando o mapa todo pelo outro lado.
function ehPassagem(dungeon, room, tx, tz) {
  const vizinhos = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dz] of vizinhos) {
    const nx = tx + dx, nz = tz + dz;
    const dentro = nx >= room.x1 && nx <= room.x2 && nz >= room.z1 && nz <= room.z2;
    if (dentro) continue;
    if (!dungeon.isSolid(nx, nz)) return true;
  }
  return false;
}

// Conta quantos tiles livres são alcancaveis a partir de um ponto (flood fill).
// Serve para provar que os racks não cortaram a passagem da sala.
function floodCount(dungeon, startTx, startTz) {
  const seen = new Uint8Array(dungeon.cols * dungeon.rows);
  const stack = [[startTx, startTz]];
  let count = 0;

  while (stack.length) {
    const [tx, tz] = stack.pop();
    if (tx < 0 || tz < 0 || tx >= dungeon.cols || tz >= dungeon.rows) continue;
    const i = dungeon.idx(tx, tz);
    if (seen[i]) continue;
    if (dungeon.isSolid(tx, tz)) continue;
    seen[i] = 1;
    count++;
    stack.push([tx + 1, tz], [tx - 1, tz], [tx, tz + 1], [tx, tz - 1]);
  }
  return count;
}

function buildRacks(scene, group, dungeon, theme) {
  const spots = [];
  const rackTex = rackTexture(theme, 1);

  for (const room of dungeon.rooms) {
    if (room.type === 'boss') continue;

    // Ponto de referência da sala para o teste de conectividade.
    const freeSpot = room.spawns && room.spawns.length
      ? room.spawns[0]
      : { tx: room.cx, tz: room.cz };
    if (dungeon.isSolid(freeSpot.tx, freeSpot.tz)) continue;

    // Candidatos: apenas tiles encostados numa parede. A primeira versão
    // distribuia racks em xadrez pelo miolo da sala, e isso quebrava o combate:
    // bloqueava a linha de visão, deixava inimigo cego parado no canto e fazia
    // o tiro do jogador bater no rack antes de chegar no alvo. Na prática o
    // jogador via um inimigo que "não morre". Fileira encostada na parede e
    // como um datacenter de verdade e preserva o centro livre para a luta.
    const candidates = [];
    for (let tz = room.z1; tz <= room.z2; tz++) {
      for (let tx = room.x1; tx <= room.x2; tx++) {
        if (dungeon.isSolid(tx, tz)) continue;

        let paredesVizinhas = 0;
        if (dungeon.isSolid(tx + 1, tz)) paredesVizinhas++;
        if (dungeon.isSolid(tx - 1, tz)) paredesVizinhas++;
        if (dungeon.isSolid(tx, tz + 1)) paredesVizinhas++;
        if (dungeon.isSolid(tx, tz - 1)) paredesVizinhas++;
        if (paredesVizinhas === 0) continue;     // miolo da sala: fica livre

        if ((tx + tz * 2) % 2 !== 0) continue;   // espacamento na fileira
        if (dungeon._rand() > 0.75) continue;
        if (ehPassagem(dungeon, room, tx, tz)) continue;   // nunca na porta

        candidates.push({ tx, tz });
      }
    }
    if (candidates.length === 0) continue;

    const before = floodCount(dungeon, freeSpot.tx, freeSpot.tz);
    const placedHere = [];

    for (const cand of candidates) {
      dungeon.setSolid(cand.tx, cand.tz, true);
      placedHere.push(cand);
    }

    const after = floodCount(dungeon, freeSpot.tx, freeSpot.tz);
    const spawnsLeft = room.spawns.filter(s => !dungeon.isSolid(s.tx, s.tz)).length;

    // Dois motivos para descartar os racks desta sala:
    // 1) a sala perdeu acesso a algum tile;
    // 2) sobraram poucos pontos de spawn, e sem eles a sala viria vazia.
    const brokePath = after < before - placedHere.length;
    if (brokePath || spawnsLeft < 3) {
      for (const t of placedHere) dungeon.setSolid(t.tx, t.tz, false);
      continue;
    }

    // Os racks viraram parede: pontos de spawn ocupados deixam de existir.
    room.spawns = room.spawns.filter(s => !dungeon.isSolid(s.tx, s.tz));

    // Validacao de jogabilidade: a sala precisa manter linha de visão entre os
    // pontos de combate. Este teste existe porque a versão anterior dos racks
    // passava em tudo e mesmo assim deixava a sala cega.
    const amostra = room.spawns.slice(0, 8);
    let pares = 0;
    let visiveis = 0;
    for (let i = 0; i < amostra.length; i++) {
      for (let j = i + 1; j < amostra.length; j++) {
        const a = dungeon.tileCenter(amostra[i].tx, amostra[i].tz);
        const b = dungeon.tileCenter(amostra[j].tx, amostra[j].tz);
        pares++;
        if (dungeon.hasLineOfSight(a.x, a.z, b.x, b.z)) visiveis++;
      }
    }
    if (pares > 0 && visiveis / pares < 0.62) {
      for (const t of placedHere) dungeon.setSolid(t.tx, t.tz, false);
      continue;
    }

    for (const t of placedHere) {
      const c = dungeon.tileCenter(t.tx, t.tz);
      spots.push({ x: c.x, z: c.z, tx: t.tx, tz: t.tz });
    }
  }

  const group2 = new THREE.Group();
  group2.name = 'racks';
  group.add(group2);

  const rackMat = new THREE.MeshLambertMaterial({ map: rackTex, color: 0xffffff });
  const rackGeo = new THREE.BoxGeometry(2.4, 2.7, 2.4);
  const rackMesh = new THREE.InstancedMesh(rackGeo, rackMat, Math.max(1, spots.length));
  rackMesh.name = 'rackInstances';
  rackMesh.frustumCulled = true;

  const ledMat = new THREE.MeshBasicMaterial({ color: theme.propEmissive });
  const ledGeo = new THREE.BoxGeometry(2.46, 0.06, 0.06);
  const ledMesh = new THREE.InstancedMesh(ledGeo, ledMat, Math.max(1, spots.length * 2));

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let ledIndex = 0;

  spots.forEach((spot, i) => {
    m.compose(new THREE.Vector3(spot.x, 1.35, spot.z), q, new THREE.Vector3(1, 1, 1));
    rackMesh.setMatrixAt(i, m);

    // duas faixas de LED na base e no topo
    for (const y of [0.25, 2.45]) {
      if (ledIndex >= spots.length * 2) break;
      m.compose(new THREE.Vector3(spot.x, y, spot.z), q, new THREE.Vector3(1, 1, 1));
      ledMesh.setMatrixAt(ledIndex, m);
      ledIndex++;
    }
  });

  rackMesh.instanceMatrix.needsUpdate = true;
  ledMesh.instanceMatrix.needsUpdate = true;
  ledMesh.count = ledIndex;

  group2.add(rackMesh);
  group2.add(ledMesh);

  return { rackPositions: spots, rackMesh, ledMesh };
}

// Luz pontual só nos racks mais próximos do centro, para não estourar o orcamento.
function addGlowSprites(group, spots, theme, glowTex) {
  const chosen = spots.slice(0, 60);
  const mat = new THREE.SpriteMaterial({
    map: glowTex,
    color: theme.lightColor,
    transparent: true,
    opacity: 0.30,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const lights = [];
  // sprites de brilho (baratos, sem iluminacao real)
  chosen.forEach((spot, i) => {
    if (i % 3 !== 0) return;
    const s = new THREE.Sprite(mat);
    s.position.set(spot.x, 2.2, spot.z);
    s.scale.set(4.4, 4.4, 1);
    group.add(s);
  });

  // -- luzes reais: até 8, espalhadas pelas salas
  const picks = [];
  const quantas = Math.min(8, chosen.length);
  for (let i = 0; i < quantas; i++) {
    picks.push(chosen[Math.floor((i + 0.5) * chosen.length / quantas)]);
  }
  for (const spot of picks) {
    if (!spot) continue;
    const light = new THREE.PointLight(theme.lightColor, 3.4, 28, 2);
    light.position.set(spot.x, 3.1, spot.z);
    group.add(light);
    lights.push(light);
  }

  return lights;
}

// Paineis de LED no teto: dao a leitura de datacenter iluminado sem custo de
// luz real, porque são material emissivo e não iluminam nada.
function buildCeilingPanels(group, dungeon, theme) {
  const spots = [];
  for (let tz = 3; tz < dungeon.rows - 3; tz += 4) {
    for (let tx = 3; tx < dungeon.cols - 3; tx += 4) {
      if (dungeon.isSolid(tx, tz)) continue;
      // precisa ter espaço aberto em volta: não poe painel em corredor de 1 tile
      let open = 0;
      if (!dungeon.isSolid(tx + 1, tz)) open++;
      if (!dungeon.isSolid(tx - 1, tz)) open++;
      if (!dungeon.isSolid(tx, tz + 1)) open++;
      if (!dungeon.isSolid(tx, tz - 1)) open++;
      if (open < 4) continue;
      spots.push(dungeon.tileCenter(tx, tz));
    }
  }
  if (spots.length === 0) return;

  const geo = new THREE.BoxGeometry(1.7, 0.09, 0.42);
  const mat = new THREE.MeshBasicMaterial({ color: theme.wallAccent });
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);

  spots.forEach((c, i) => {
    m.compose(new THREE.Vector3(c.x, WALL_H - 0.10, c.z), q, one);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);

  // halo fraco embaixo de cada painel, sem luz real
  const haloMat = new THREE.MeshBasicMaterial({
    map: glowTexture(theme.wallAccent),
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const haloGeo = new THREE.PlaneGeometry(6, 6);
  const halo = new THREE.InstancedMesh(haloGeo, haloMat, spots.length);
  const qr = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  spots.forEach((c, i) => {
    m.compose(new THREE.Vector3(c.x, 0.03, c.z), qr, one);
    halo.setMatrixAt(i, m);
  });
  halo.instanceMatrix.needsUpdate = true;
  group.add(halo);
}

// Manchas claras no chão, como se o LED lavasse o piso.
function addFloorPools(group, spots, theme) {
  const tex = glowTexture(theme.lightColor);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const geo = new THREE.PlaneGeometry(7, 7);

  let count = 0;
  const mesh = new THREE.InstancedMesh(geo, mat, 40);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

  for (const spot of spots) {
    if (count >= 40) break;
    if (count % 2 !== 0) { count++; continue; }
    m.compose(new THREE.Vector3(spot.x, 0.02, spot.z), q, new THREE.Vector3(1, 1, 1));
    mesh.setMatrixAt(count, m);
    count++;
  }
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (count > 0) group.add(mesh);
}

// Dutos e tubulacao solta no teto. Não colidem: são decoracao acima da cabeca.
function buildCeilingDucts(group, dungeon, theme) {
  const mat = new THREE.MeshLambertMaterial({ color: theme.propColor });
  const geo = new THREE.BoxGeometry(TILE * 0.6, 0.5, TILE * 0.6);

  const spots = [];
  for (const room of dungeon.rooms) {
    for (let tz = room.z1 + 1; tz < room.z2 - 1; tz += 2) {
      for (let tx = room.x1 + 1; tx < room.x2 - 1; tx += 2) {
        spots.push(dungeon.tileCenter(tx, tz));
      }
    }
  }
  const use = spots.slice(0, 70);
  if (use.length === 0) return;

  const mesh = new THREE.InstancedMesh(geo, mat, use.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  use.forEach((c, i) => {
    m.compose(new THREE.Vector3(c.x, WALL_H - 0.35, c.z), q, new THREE.Vector3(1, 1, 1));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
}

// Placas corporativas. A piada mora aqui.
function buildSigns(group, dungeon, theme) {
  const texts = [
    'SALA 4B', 'GPU FARM', 'SÓ PESSOAL\nAUTORIZADO', 'NÃO ALIMENTE\nOS MODELOS',
    'RACK 17', 'TEMPERATURA\nCRITICA', 'BACKUP\nPENDENTE', 'ACESSO\nRESTRITO',
    'NÃO FAÇA\nPERGUNTAS', 'SECURITY\nLEVEL 3'
  ];

  let ti = 0;
  for (const room of dungeon.rooms) {
    const label = room.type === 'boss' ? 'SALA DE\nAVALIACAO' : texts[ti % texts.length];
    ti++;

    const tex = signTexture(label, room.type === 'boss' ? 0xff3b30 : theme.wallAccent);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const geo = new THREE.PlaneGeometry(2.2, 1.1);

    // pendura na parede norte da sala, se houver parede ali
    const tx = room.cx;
    const tz = room.z1 - 1;
    if (!dungeon.isSolid(tx, tz)) continue;

    const c = dungeon.tileCenter(tx, tz);
    const sign = new THREE.Mesh(geo, mat);
    sign.position.set(c.x, 2.6, (room.z1) * TILE - 0.06);
    group.add(sign);
  }
}

export { blobShadowTexture };