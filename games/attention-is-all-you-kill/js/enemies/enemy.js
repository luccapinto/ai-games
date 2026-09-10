// enemy.js — um inimigo: corpo, IA de cinco estados e movimento com colisao.
// Comportamento por faccao e dado, nao codigo: a tabela de enemies.js manda.

import * as THREE from '../../vendor/three.module.js';
import { ENEMIES, FACTIONS } from '../data/enemies.js';
import { TILE } from '../world/dungeon.js';
import { blobShadowTexture, glowTexture, nameplateTexture, solidTexture, logoDecalTexture } from '../world/textures.js';
import { mergeParts } from '../core/merge.js';
import { construirSilhueta } from './silhuetas.js';

const STATE = { IDLE: 'IDLE', PATROL: 'PATROL', ALERT: 'ALERT', COMBAT: 'COMBAT', FLEE: 'FLEE' };

// Geometrias compartilhadas entre todas as instancias: uma alocacao por forma.
// A contagem de segmentos subiu (capsula de 4/10 para 8/20, esferas de 10/8)
// porque as silhuetas apareciam facetadas quando o inimigo chegava perto.
const GEO = {
  body: new THREE.CapsuleGeometry(0.40, 0.86, 8, 20),
  head: new THREE.BoxGeometry(0.42, 0.32, 0.42),
  visor: new THREE.BoxGeometry(0.32, 0.10, 0.06),
  arm: new THREE.BoxGeometry(0.11, 0.36, 0.11),
  ombro: new THREE.SphereGeometry(0.155, 12, 10),
  perna: new THREE.CylinderGeometry(0.09, 0.12, 0.44, 12),
  pe: new THREE.BoxGeometry(0.18, 0.08, 0.26),
  antena: new THREE.CylinderGeometry(0.017, 0.017, 0.32, 6),
  luzAntena: new THREE.SphereGeometry(0.05, 8, 6),
  cinto: new THREE.BoxGeometry(0.76, 0.11, 0.28),
  // gola: anel que separa cabeca e tronco, da leitura mecanica
  gola: new THREE.CylinderGeometry(0.21, 0.24, 0.10, 16),
  // suporte de arma na mao
  cano: new THREE.CylinderGeometry(0.035, 0.045, 0.30, 8)
};

let SHADOW_TEX = null;
function shadowTexture() {
  if (!SHADOW_TEX) SHADOW_TEX = blobShadowTexture();
  return SHADOW_TEX;
}

// Uma unica textura solida compartilhada por todas as barras de vida.
let SOLID_TEX = null;
function solid() {
  if (!SOLID_TEX) SOLID_TEX = solidTexture();
  return SOLID_TEX;
}

const TELEGRAPH_TEX_CACHE = {};
function telegraphTexture(color) {
  if (!TELEGRAPH_TEX_CACHE[color]) {
    const tex = glowTexture(color);
    TELEGRAPH_TEX_CACHE[color] = tex;
  }
  return TELEGRAPH_TEX_CACHE[color];
}

export class Enemy {
  constructor(defId, dungeon, theme, options = {}) {
    const def = ENEMIES[defId];
    this.def = def;
    this.id = defId;
    this.name = options.name || def.name;
    this.faction = def.faction;
    this.dungeon = dungeon;
    this.theme = theme;

    this.hp = def.hp * (options.hpMul || 1);
    this.maxHp = this.hp;
    this.radius = def.radius;
    this.alive = true;
    this.state = STATE.IDLE;

    this.position = new THREE.Vector3(options.x || 0, 0, options.z || 0);
    this.velocity = new THREE.Vector3();
    this.facing = Math.random() * Math.PI * 2;

    this.fireCooldown = 0.6 + Math.random() * 1.2;
    this.telegraphTimer = 0;
    this.telegraphCharge = 0;
    this.alertTimer = 0;
    this.fleeTimer = 0;
    this.hitFlash = 0;
    this.hpBarTimer = 0;
    this.strafeDir = Math.random() > 0.5 ? 1 : -1;
    this.strafeTimer = 0;
    this.stuckTimer = 0;
    this.avoidDir = 0;
    this.avoidTimer = 0;
    this.spawnGrace = options.grace || 0.5;
    this.generation = options.generation || 0;
    this.friendlyFireChance = options.friendlyFireChance || 0;
    this.isElite = def.tier === 3;
    this.speedMul = options.speedMul || 1;
    this.damageMul = options.damageMul || 1;

    this._buildMesh();
  }

  _buildMesh() {
    const faction = FACTIONS[this.faction];
    const baseColor = faction ? faction.color : 0xffffff;

    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    this.bodyMat = new THREE.MeshLambertMaterial({
      color: baseColor,
      emissive: new THREE.Color(baseColor).multiplyScalar(0.18)
    });

    // Material escuro para as pecas estruturais: contraste com o corpo colorido.
    this.darkMat = new THREE.MeshLambertMaterial({
      color: 0x1b2530,
      emissive: new THREE.Color(0x0d141c)
    });
    this.lightMat = new THREE.MeshBasicMaterial({ color: faction ? faction.glow : 0xffffff });

    // As pecas sao declaradas por posicao e depois agrupadas por material: no
    // fim cada grupo vira um unico mesh. Sem isso um inimigo detalhado custa
    // ~15 chamadas de desenho, e uma sala cheia derruba o FPS em celular.
    const grupos = new Map();
    const peca = (mat, geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const matriz = new THREE.Matrix4().makeRotationFromEuler(
        new THREE.Euler(rx, ry, rz, 'XYZ')
      );
      matriz.setPosition(x, y, z);
      if (!grupos.has(mat)) grupos.set(mat, []);
      grupos.get(mat).push({ geo, matrix: matriz });
    };

    // A forma vem do modelo (js/enemies/silhuetas.js): cada inimigo tem a
    // propria silhueta, porque no meio do tiroteio cor nao e informacao
    // suficiente para saber contra o que se esta lutando.
    const silhueta = construirSilhueta(this.id, peca, {
      corpo: this.bodyMat,
      escuro: this.darkMat,
      luz: this.lightMat
    });
    this.alturaModelo = silhueta.altura;

    for (const [mat, partes] of grupos) {
      const geo = mergeParts(partes);
      if (geo) this.group.add(new THREE.Mesh(geo, mat));
    }

    // Decalque da marca no corpo: e a identificacao mais rapida de quem e o
    // inimigo, antes mesmo de ler a placa. O ponto de encaixe vem da silhueta,
    // porque cada corpo tem uma superficie diferente. Fica fora do merge porque
    // tem textura propria.
    const decal = logoDecalTexture(this.faction, faction ? faction.glow : 0xffffff);
    if (decal && silhueta.decalque) {
      const marca = new THREE.Mesh(
        new THREE.PlaneGeometry(this.id === 'gpt_55' ? 0.46 : 0.58, this.id === 'gpt_55' ? 0.46 : 0.58),
        new THREE.MeshBasicMaterial({ map: decal, transparent: true, depthWrite: false })
      );
      marca.position.set(0, silhueta.decalque[0], silhueta.decalque[1]);
      this.group.add(marca);
    }

    // sombra falsa no chao
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({
        map: shadowTexture(), transparent: true, opacity: 0.7, depthWrite: false
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    this.group.add(shadow);

    // brilho da faccao: leitura instantanea de quem e o inimigo
    this.glowMat = new THREE.SpriteMaterial({
      map: telegraphTexture(faction ? faction.glow : 0xffffff),
      color: faction ? faction.glow : 0xffffff,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Sprite(this.glowMat);
    glow.position.y = 1.0;
    glow.scale.set(3.0, 3.0, 1);
    this.group.add(glow);
    this.glow = glow;

    // indicador de reasoning: o balao de pensamento antes do tiro brutal
    if (this.def.telegraph > 0) {
      this.telegraphSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: telegraphTexture(0xfff2b0),
        color: 0xfff2b0,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      this.telegraphSprite.position.y = (this.alturaModelo || 2.0) + 0.72;
      this.telegraphSprite.scale.set(0.9, 0.9, 1);
      this.group.add(this.telegraphSprite);
    }
  }

  addTo(scene) {
    scene.add(this.group);
    this._buildPlate(scene);
  }

  removeFrom(scene) {
    scene.remove(this.group);
    if (this.plate) scene.remove(this.plate);
  }

  // Placa de identificacao: emblema da faccao, nome do modelo e barra de vida.
  // Fica na cena (nao no grupo) para nao girar junto com o corpo do inimigo.
  _buildPlate(scene) {
    const faction = FACTIONS[this.faction];
    const accent = faction ? faction.glow : 0xffffff;

    this.plate = new THREE.Group();

    const nomeMat = new THREE.SpriteMaterial({
      map: nameplateTexture(this.name, this.faction, accent),
      transparent: true,
      depthWrite: false
    });
    this.nomeSprite = new THREE.Sprite(nomeMat);
    // a largura acompanha a textura, que agora tem a largura do proprio nome:
    // escala fixa distorcia o texto das placas curtas e longas
    const img = nomeMat.map.image;
    this.nomeSprite.scale.set(0.60 * (img.width / img.height), 0.60, 1);
    this.nomeSprite.position.y = 0.62;
    this.plate.add(this.nomeSprite);

    this.barBg = new THREE.Sprite(new THREE.SpriteMaterial({
      map: solid(), color: 0x0a0f16, transparent: true, opacity: 0.9, depthWrite: false
    }));
    this.barBg.scale.set(1.26, 0.16, 1);
    this.barBg.position.y = 0.26;
    this.plate.add(this.barBg);

    this.barFill = new THREE.Sprite(new THREE.SpriteMaterial({
      map: solid(), color: 0x35f0d8, transparent: true, depthWrite: false
    }));
    this.barFill.scale.set(1.14, 0.10, 1);
    this.barFill.position.y = 0.26;
    this.plate.add(this.barFill);

    this.plate.visible = false;
    scene.add(this.plate);
  }

  distanceTo(pos) {
    return Math.hypot(this.position.x - pos.x, this.position.z - pos.z);
  }

  canSee(targetPos) {
    return this.dungeon.hasLineOfSight(this.position.x, this.position.z, targetPos.x, targetPos.z);
  }

  // ------------------------------------------------------------------
  // Dano
  // ------------------------------------------------------------------
  applyDamage(amount) {
    this.hp -= amount;
    this.hitFlash = 0.14;
    this.hpBarTimer = 3.5;      // a barra aparece e fica visivel por um tempo
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    // leva um susto e recua por um instante, proporcional a coragem
    if (Math.random() < this.def.courage) {
      this.state = STATE.FLEE;
      this.fleeTimer = 1.2 + Math.random();
    }
    return false;
  }

  // ------------------------------------------------------------------
  // Movimento com colisao no grid (mesma logica do jogador, mais simples)
  // ------------------------------------------------------------------
  _resolveCollisions() {
    const r = this.radius;
    const { tx, tz } = this.dungeon.worldToTile(this.position.x, this.position.z);
    let hit = false;

    for (let iz = tz - 1; iz <= tz + 1; iz++) {
      for (let ix = tx - 1; ix <= tx + 1; ix++) {
        if (!this.dungeon.isSolid(ix, iz)) continue;
        const minX = ix * TILE, maxX = minX + TILE;
        const minZ = iz * TILE, maxZ = minZ + TILE;
        const cx = Math.max(minX, Math.min(this.position.x, maxX));
        const cz = Math.max(minZ, Math.min(this.position.z, maxZ));
        let dx = this.position.x - cx;
        let dz = this.position.z - cz;
        let dist = Math.hypot(dx, dz);
        if (dist >= r) continue;

        hit = true;
        if (dist < 1e-6) {
          const toLeft = this.position.x - minX;
          const toRight = maxX - this.position.x;
          const toBack = this.position.z - minZ;
          const toFront = maxZ - this.position.z;
          const minPen = Math.min(toLeft, toRight, toBack, toFront);
          if (minPen === toLeft) this.position.x = minX - r;
          else if (minPen === toRight) this.position.x = maxX + r;
          else if (minPen === toBack) this.position.z = minZ - r;
          else this.position.z = maxZ + r;
          continue;
        }
        const push = (r - dist) / dist;
        this.position.x += dx * push;
        this.position.z += dz * push;
      }
    }
    return hit;
  }

  _moveTowards(dx, dz, speed, dt) {
    const len = Math.hypot(dx, dz);
    if (len < 1e-5) return;
    dx /= len; dz /= len;
    this.position.x += dx * speed * dt;
    const hitX = this._resolveCollisions();
    this.position.z += dz * speed * dt;
    const hitZ = this._resolveCollisions();

    if (hitX || hitZ) {
      this.stuckTimer += dt;
      // sem LOS o inimigo contorna: escolhe uma direcao perpendicular por um tempo
      if (this.stuckTimer > 0.35 && this.avoidTimer <= 0) {
        this.avoidDir = Math.random() > 0.5 ? 1 : -1;
        this.avoidTimer = 0.7 + Math.random() * 0.6;
      }
    } else {
      this.stuckTimer = Math.max(0, this.stuckTimer - dt * 2);
    }
  }

  // ------------------------------------------------------------------
  // IA
  // ------------------------------------------------------------------
  update(dt, player, director) {
    if (!this.alive) return;

    this.spawnGrace = Math.max(0, this.spawnGrace - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.avoidTimer = Math.max(0, this.avoidTimer - dt);
    this.strafeTimer -= dt;

    const playerPos = player.position;
    const dist = this.distanceTo(playerPos);
    const sees = dist <= this.def.sightRange && this.canSee(playerPos);

    // transicoes de estado
    if (this.state === STATE.FLEE) {
      this.fleeTimer -= dt;
      if (this.fleeTimer <= 0) this.state = sees ? STATE.COMBAT : STATE.ALERT;
    } else if (sees) {
      if (this.state !== STATE.COMBAT) {
        this.state = STATE.COMBAT;
        director.onEnemyAlerted(this);
      }
    } else if (dist < this.def.sightRange * 1.4) {
      this.state = STATE.ALERT;
      this.alertTimer = Math.max(this.alertTimer, 1.4);
    } else if (this.state === STATE.ALERT) {
      this.alertTimer -= dt;
      if (this.alertTimer <= 0) this.state = STATE.PATROL;
    }

    const speed = this.def.speed * this.speedMul;

    switch (this.state) {
      case STATE.IDLE:
      case STATE.PATROL:
        this._patrol(dt, speed);
        break;
      case STATE.ALERT:
        // olha para o jogador sem atirar: da chance de perceber a ameaca
        this._faceTo(playerPos, dt, 4);
        break;
      case STATE.FLEE:
        this._retreat(dt, speed, playerPos);
        break;
      case STATE.COMBAT:
        this._combat(dt, speed, player, dist, director);
        break;
    }

    // espelhamento visual: dano pisca, teleporte nao existe
    const flash = this.hitFlash > 0;
    this.bodyMat.emissiveIntensity = flash ? 2.4 : 1;
    if (flash) this.bodyMat.emissive.setRGB(1, 1, 1);
    else {
      const faction = FACTIONS[this.faction];
      const base = faction ? faction.color : 0xffffff;
      this.bodyMat.emissive.setHex(base).multiplyScalar(0.18);
    }
    this.glowMat.opacity = this.state === STATE.COMBAT ? 0.34 : 0.16;

    this.group.position.copy(this.position);
    this.group.rotation.y = this.facing;

    this._updatePlate(dt, dist);
  }

  // Mantem a placa acima da cabeca: nome sempre, barra so quando importa.
  _updatePlate(dt, dist) {
    if (!this.plate) return;
    this.hpBarTimer = Math.max(0, this.hpBarTimer - dt);

    // placaSempre: usada pelo alvo de treino do tutorial, que nunca entra em
    // combate e por isso nunca mostraria o proprio nome
    const visivel = dist < 26 && (this.placaSempre || this.state !== STATE.IDLE);
    this.plate.visible = visivel;
    if (!visivel) return;

    // a placa sobe junto com o modelo: cada silhueta tem uma altura diferente
    this.plate.position.set(this.position.x, (this.alturaModelo || 2.0) + 0.62, this.position.z);

    const ratio = Math.max(0, this.hp / this.maxHp);
    const mostrarBarra = ratio < 1 || this.hpBarTimer > 0;
    this.barBg.visible = mostrarBarra;
    this.barFill.visible = mostrarBarra;

    if (mostrarBarra) {
      const largura = 1.14 * ratio;
      this.barFill.scale.set(Math.max(0.001, largura), 0.10, 1);
      // alinha a barra pela esquerda, encolhendo da direita para a esquerda
      this.barFill.position.x = -0.57 + largura / 2;
      this.barFill.material.color.setHex(
        ratio > 0.55 ? 0x35f0d8 : ratio > 0.25 ? 0xffb347 : 0xff3b30
      );
    }
  }

  _patrol(dt, speed) {
    // anda em direcao fixa, virando quando bate
    const moved = this._moveTowards(
      Math.sin(this.facing), Math.cos(this.facing), speed * 0.36, dt
    );
    if (moved) this.facing += (Math.random() - 0.5) * 1.6;
    else if (Math.random() < 0.02) this.facing += (Math.random() - 0.5) * 2.4;
  }

  _faceTo(target, dt, rate) {
    const desired = Math.atan2(target.x - this.position.x, target.z - this.position.z);
    let diff = desired - this.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.facing += diff * Math.min(1, rate * dt);
  }

  _retreat(dt, speed, playerPos) {
    const dx = this.position.x - playerPos.x;
    const dz = this.position.z - playerPos.z;
    this._moveTowards(dx, dz, speed * 1.15, dt);
    this._faceTo(playerPos, dt, 3);
  }

  _combat(dt, speed, player, dist, director) {
    const playerPos = player.position;
    this._faceTo(playerPos, dt, 6);

    const prefer = this.def.preferRange;
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = dx / len, nz = dz / len;

    // Separacao: inimigo nunca fica dentro do jogador. Sem isso ele cobre a
    // tela inteira e o combate fica ilegivel.
    if (dist < 3.0) {
      this._moveTowards(-nx, -nz, speed * 1.8, dt);
      this.fireCooldown -= dt;
      if (this.fireCooldown <= 0 && dist < this.def.sightRange) {
        const atirou = this._shoot(player, dist, director, 1);
        // se o tiro foi negado, tenta de novo logo para pegar a proxima vez
        this.fireCooldown = atirou ? Math.max(0.9, 1 / this.def.fireRate) : 0.2;
      }
      return;
    }

    let moveX = 0, moveZ = 0;

    // mantem a distancia preferida: aproxima ou recua
    if (dist > prefer + 2) {
      moveX += nx; moveZ += nz;
    } else if (dist < prefer - 2) {
      moveX -= nx; moveZ -= nz;
    }

    // strafe: anda de lado sem sentido aparente, dificulta a mira
    if (this.strafeTimer <= 0) {
      this.strafeTimer = 0.8 + Math.random() * 1.4;
      this.strafeDir *= -1;
    }
    moveX += -nz * this.strafeDir * 0.65;
    moveZ += nx * this.strafeDir * 0.65;

    // desvio quando travou
    if (this.avoidTimer > 0) {
      moveX += -nz * this.avoidDir * 1.6;
      moveZ += nx * this.avoidDir * 1.6;
    }

    this._moveTowards(moveX, moveZ, speed, dt);

    // ataque
    this.fireCooldown -= dt;

    if (this.def.telegraph > 0) {
      this._telegraphedAttack(dt, player, dist, director);
    } else if (this.fireCooldown <= 0 && dist < this.def.sightRange) {
      const atirou = this._shoot(player, dist, director, 1);
      this.fireCooldown = atirou ? 1 / this.def.fireRate : 0.2;
    }
  }

  // Reasoning: para, pensa com o balao visivel, e o tiro seguinte e devastador.
  _telegraphedAttack(dt, player, dist, director) {
    if (this.telegraphCharge > 0) {
      this.telegraphCharge -= dt;
      const t = 1 - Math.max(0, this.telegraphCharge / this.def.telegraph);
      if (this.telegraphSprite) {
        this.telegraphSprite.material.opacity = 0.35 + t * 0.55;
        const s = 0.7 + t * 0.7;
        this.telegraphSprite.scale.set(s, s, 1);
      }
      if (this.telegraphCharge <= 0) {
        if (this.telegraphSprite) this.telegraphSprite.material.opacity = 0;
        const atirou = this._shoot(player, dist, director, 2.6);   // tiro pensado
        this.fireCooldown = atirou ? 1 / this.def.fireRate + 1.6 : 0.2;
      }
      return;
    }

    if (this.fireCooldown <= 0 && dist < this.def.sightRange) {
      this.telegraphCharge = this.def.telegraph;
      if (this.telegraphSprite) this.telegraphSprite.material.opacity = 0.35;
    }
  }

  _shoot(player, dist, director, damageMul) {
    if (!this.canSee(player.position)) return false;

    // Vez de atirar: o director concede poucas permissoes simultaneas. Sem
    // isso a sala inteira atira no mesmo frame e o jogador morre sem ter
    // chance de ler de onde vem a ameaca.
    if (director && director.requestFirePermission && !director.requestFirePermission()) {
      return false;
    }

    const def = this.def;
    const damage = (def.damageMin !== undefined
      ? def.damageMin + Math.random() * (def.damageMax - def.damageMin)
      : def.damage) * damageMul * this.damageMul;

    // precisao: o desvio cai com a distancia e sobe com a imprecisao do modelo
    const inaccuracy = (1 - def.accuracy) * 0.28;
    const jitterX = (Math.random() - 0.5) * inaccuracy;
    const jitterZ = (Math.random() - 0.5) * inaccuracy;

    const dx = (player.position.x - this.position.x) + jitterX * dist;
    const dz = (player.position.z - this.position.z) + jitterZ * dist;
    const len = Math.hypot(dx, dz) || 1;

    const origin = new THREE.Vector3(this.position.x, 1.35, this.position.z);

    // grok: chance de atirar no proprio aliado
    const chaos = Math.random() < (def.friendlyFire || 0);
    if (chaos) {
      const ally = director.nearestAlly(origin, this);
      if (ally) {
        const adx = ally.position.x - this.position.x;
        const adz = ally.position.z - this.position.z;
        const alen = Math.hypot(adx, adz) || 1;
        director.spawnEnemyProjectile(origin, adx / alen, adz / alen, damage, this);
        return true;
      }
    }

    director.spawnEnemyProjectile(origin, dx / len, dz / len, damage, this, {
      onHitEffect: def.onHit,
      silenceTime: def.silenceTime || 0
    });
    return true;
  }
}

export { STATE };
