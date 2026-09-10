// spawner.js — director de combate: inimigos por sala, projeteis, drops e efeitos.
// Spawna quando o jogador entra na sala, não tudo de uma vez no boot.

import * as THREE from '../../vendor/three.module.js';
import { Enemy } from './enemy.js';
import { pickFromRoster, ELITE_POOL, ENEMIES, FACTIONS, finetuneName } from '../data/enemies.js';
import { WEAPONS } from '../data/weapons.js';
import { glowTexture, blobShadowTexture, signTexture } from '../world/textures.js';
import { construirItem } from '../world/itens.js';

const MAX_ENEMIES = 40;
const MAX_PROJECTILES = 180;
const MAX_TRACERS = 40;
const MAX_SPARKS = 220;

export class CombatDirector {
  constructor(scene, dungeon, theme, rng = Math.random) {
    this.scene = scene;
    this.dungeon = dungeon;
    this.theme = theme;
    this.rng = rng;

    this.enemies = [];
    this.projectiles = [];
    this.tracers = [];
    this.sparks = [];
    this.pickups = [];

    this.roomsActivated = new Set();
    this.clearedRooms = new Set();
    this.finetuneCounter = 0;
    this.activeRoom = null;

    // Controle de ritmo do combate.
    // clock: relogio próprio do director, usado pelas permissoes de tiro.
    // fireSlots: quantos inimigos podem atirar ao mesmo tempo. Sem isso uma
    //   sala de oito inimigos vira oito tiros no mesmo instante e o jogador
    //   morre sem ter tempo de ler a ameaca.
    // pendingWaves: reforcos que chegam depois, para a sala ter duas levas em
    //   vez de todo mundo de uma vez.
    this.clock = 0;
    this.fireSlots = [0, 0];
    this.fireSlotCooldown = 1.0;
    this.pendingWaves = [];

    this.onKill = null;          // callback(enemy)
    this.onPlayerHit = null;     // callback(damage, effect)
    this.onRoomCleared = null;
    this.onPickup = null;
    this.sfx = null;
    this.feed = null;

    this._buildPools();
  }

  _buildPools() {
    // projeteis inimigos: esferas emissivas
    this.projGeo = new THREE.SphereGeometry(0.14, 6, 5);
    this.projMat = new THREE.MeshBasicMaterial({ color: 0xff5a4a });
    this.projMesh = new THREE.InstancedMesh(this.projGeo, this.projMat, MAX_PROJECTILES);
    this.projMesh.frustumCulled = false;
    this.projMesh.count = 0;
    this.scene.add(this.projMesh);

    // tracers do jogador: caixinha fina esticada
    this.tracerGeo = new THREE.BoxGeometry(1, 0.035, 0.035);
    this.tracerMat = new THREE.MeshBasicMaterial({
      color: 0xa8fff0, transparent: true, opacity: 0.75,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    this.tracerMesh = new THREE.InstancedMesh(this.tracerGeo, this.tracerMat, MAX_TRACERS);
    this.tracerMesh.frustumCulled = false;
    this.tracerMesh.count = 0;
    this.scene.add(this.tracerMesh);

    // faiscas de impacto
    this.sparkTex = glowTexture(0xffffff);
    this.sparkMat = new THREE.SpriteMaterial({
      map: this.sparkTex, transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending, color: 0x9ffff0
    });
    this.sparkPool = [];
    for (let i = 0; i < MAX_SPARKS; i++) {
      const s = new THREE.Sprite(this.sparkMat.clone());
      s.visible = false;
      this.scene.add(s);
      this.sparkPool.push({ sprite: s, life: 0, maxLife: 0, vel: new THREE.Vector3(), scale: 1 });
    }
    this.sparkCursor = 0;

    // marcador de drop
    this.pickupTex = signTexture('DROP', 0xffb347);

    // temporarios de sincronizacao, alocados uma vez só
    this._mat4 = new THREE.Matrix4();
    this._quat = new THREE.Quaternion();
    this._one = new THREE.Vector3(1, 1, 1);
    this._hidden = new THREE.Vector3(0, -999, 0);
    this._tiny = new THREE.Vector3(0.001, 0.001, 0.001);
  }

  // ------------------------------------------------------------------
  // Ativacao de sala
  // ------------------------------------------------------------------
  updateRoomActivation(playerPos, floor) {
    // Durante o tutorial o director não popula sala nenhuma: o jogador esta
    // aprendendo a andar e a atirar, não sobrevivendo.
    if (this.tutorialMode) return;

    const room = this.dungeon.roomAt(playerPos.x, playerPos.z);
    if (!room) return;
    if (this.activeRoom !== room) {
      this.activeRoom = room;
    }
    if (this.roomsActivated.has(room.index)) return;
    this.roomsActivated.add(room.index);

    if (room.type === 'entry') {
      // sala inicial: só um par de inimigos fracos, para aprender a atirar
      this.spawnGroup(room, 2, floor, { weak: true });
      return;
    }
    if (room.type === 'boss') return;      // o chefe e chamado a parte

    // Salas comuns vem em duas levas. A primeira leva e a que o jogador ve ao
    // entrar; a segunda chega alguns segundos depois, quando ele já se
    // posicionou. Antes era tudo de uma vez e não dava tempo de reagir.
    const base = room.type === 'elite' ? 3 : 3 + Math.floor(this.rng() * 3);
    const primeira = Math.ceil(base * 0.65);
    const reforco = base - primeira;

    this.spawnGroup(room, primeira, floor, { elite: room.type === 'elite' });

    if (reforco > 0) {
      this.pendingWaves.push({
        room,
        count: reforco,
        floor,
        opts: { elite: false },
        at: this.clock + 9 + this.rng() * 3,
        avisado: false
      });
    }
  }

  // ------------------------------------------------------------------
  // Permissao de tiro: poucos inimigos atacam por vez.
  // Os que ficam de fora continuam se movendo e mirando, então a horda
  // continua parecendo uma horda, mas o dano chega em cadência legivel.
  // ------------------------------------------------------------------
  requestFirePermission() {
    for (let i = 0; i < this.fireSlots.length; i++) {
      if (this.fireSlots[i] <= this.clock) {
        this.fireSlots[i] = this.clock + this.fireSlotCooldown;
        return true;
      }
    }
    return false;
  }

  _updateWaves() {
    if (this.pendingWaves.length === 0) return;

    for (let i = this.pendingWaves.length - 1; i >= 0; i--) {
      const w = this.pendingWaves[i];

      // aviso antes do reforço chegar, para não ser uma emboscada injusta
      if (!w.avisado && this.clock >= w.at - 1.6) {
        w.avisado = true;
        if (this.feed) this.feed.push('Reforço a caminho.', 'warn');
      }

      if (this.clock >= w.at) {
        // só traz o reforço se a sala ainda estiver em disputa
        const aindaTem = this.enemies.some(e =>
          e.alive && this.dungeon.roomAt(e.position.x, e.position.z) === w.room
        );
        if (aindaTem) this.spawnGroup(w.room, w.count, w.floor, w.opts);
        this.pendingWaves.splice(i, 1);
      }
    }
  }

  spawnGroup(room, count, floor, { elite = false, weak = false } = {}) {
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      if (this.enemies.length >= MAX_ENEMIES) break;
      const spot = this.dungeon.randomPointIn(room);
      if (!spot) break;

      let defId;
      if (elite && i === 0) defId = ELITE_POOL[Math.floor(this.rng() * ELITE_POOL.length)];
      else if (weak) defId = 'qwen_turbo';
      else defId = pickFromRoster(floor, this.rng());

      this.spawnEnemy(defId, spot.x, spot.z, floor);
      spawned++;
    }
    return spawned;
  }

  spawnEnemy(defId, x, z, floor = 1, options = {}) {
    const e = new Enemy(defId, this.dungeon, this.theme, { x, z, ...options });
    e.addTo(this.scene);
    this.enemies.push(e);
    return e;
  }

  // ------------------------------------------------------------------
  // Projeteis inimigos
  // ------------------------------------------------------------------
  spawnEnemyProjectile(origin, dx, dz, damage, owner, extra = {}) {
    if (this.projectiles.length >= MAX_PROJECTILES) return;
    // velocidade configuravel: o leque do chefe precisa ser mais lento que um
    // tiro normal, senao não ha como desviar
    const speed = extra.speed || 26;
    this.projectiles.push({
      pos: origin.clone(),
      vel: new THREE.Vector3(dx * speed, 0, dz * speed),
      damage,
      owner,
      life: 3.2,
      onHitEffect: extra.onHitEffect || null,
      silenceTime: extra.silenceTime || 0
    });
    if (this.sfx) this.sfx.enemyShot(owner ? owner.def : null);
  }

  spawnTracer(from, to, color) {
    if (this.tracers.length >= MAX_TRACERS) this.tracers.shift();
    this.tracers.push({
      from: from.clone(),
      to: to.clone(),
      life: 0.055,
      color: color || 0xa8fff0
    });
  }

  spawnSparks(pos, color, count = 5, scale = 0.35) {
    for (let i = 0; i < count; i++) {
      const item = this.sparkPool[this.sparkCursor];
      this.sparkCursor = (this.sparkCursor + 1) % this.sparkPool.length;
      item.sprite.position.copy(pos);
      item.sprite.material.color.setHex(color);
      item.sprite.material.opacity = 0.95;
      item.sprite.visible = true;
      item.scale = scale * (0.7 + Math.random() * 0.7);
      item.sprite.scale.set(item.scale, item.scale, 1);
      item.maxLife = 0.22 + Math.random() * 0.24;
      item.life = item.maxLife;
      item.vel.set(
        (Math.random() - 0.5) * 9,
        Math.random() * 5 + 1,
        (Math.random() - 0.5) * 9
      );
    }
    if (this.sfx) this.sfx.impact();
  }

  nearestAlly(origin, exclude) {
    let best = null;
    let bestD = 14;
    for (const e of this.enemies) {
      if (!e.alive || e === exclude) continue;
      const d = Math.hypot(e.position.x - origin.x, e.position.z - origin.z);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  onEnemyAlerted(enemy) {
    if (this.sfx) this.sfx.alert(enemy.def);
  }

  // ------------------------------------------------------------------
  // Dano no inimigo (chamado pela arma do jogador)
  // ------------------------------------------------------------------
  damageEnemy(enemy, amount, hitPoint, playerStats) {
    const dead = enemy.applyDamage(amount);
    if (hitPoint) this.spawnSparks(hitPoint, 0xffd0a0, 3, 0.22);
    if (this.sfx) this.sfx.hitEnemy(enemy.def);
    if (dead) this.killEnemy(enemy, playerStats);
    return dead;
  }

  killEnemy(enemy, playerStats) {
    enemy.alive = false;
    enemy.removeFrom(this.scene);
    const idx = this.enemies.indexOf(enemy);
    if (idx >= 0) this.enemies.splice(idx, 1);

    // estilhacos de dados: a morte de um modelo
    const faction = FACTIONS[enemy.faction];
    this.spawnSparks(
      new THREE.Vector3(enemy.position.x, 1.1, enemy.position.z),
      faction ? faction.glow : 0xffffff, 14, 0.5
    );

    if (this.sfx) this.sfx.enemyDeath(enemy.def);
    if (playerStats) playerStats.addKill(enemy);
    if (this.onKill) this.onKill(enemy);

    // Drop generoso de proposito: entre uma sala e outra o jogador precisa
    // de ar. Munição em 30% dos abates e contexto em 18%.
    const roll = Math.random();
    if (roll < 0.30) this.spawnPickup('ammo', enemy.position.x, enemy.position.z);
    else if (roll < 0.48) this.spawnPickup('health', enemy.position.x, enemy.position.z);

    // A Ovelha se reproduz, mas só o modelo original. Os fine-tunes são filhos
    // e não geram netos: sem essa regra a sala vira fabrica infinita e o
    // jogador conclui, com razao, que o inimigo cinza e imortal.
    if (enemy.def.onDeath === 'spawn_finetune' && (enemy.generation || 0) === 0) {
      const perto = this.enemies.filter(e =>
        e.def.id === 'llama_base' &&
        Math.hypot(e.position.x - enemy.position.x, e.position.z - enemy.position.z) < 18
      );
      if (perto.length < 3) {
        this.finetuneCounter++;
        const name = finetuneName(this.finetuneCounter);
        this.spawnEnemy(
          'llama_base',
          enemy.position.x + (Math.random() - 0.5) * 2.4,
          enemy.position.z + (Math.random() - 0.5) * 2.4,
          1,
          { name, generation: 1, hpMul: 0.55 }
        );
        if (this.feed) this.feed.push(`${name} publicado (mais fraco que o original)`, 'warn');
      }
    }

    // sala limpa?
    const room = this.dungeon.roomAt(enemy.position.x, enemy.position.z);
    if (room) this.checkRoomCleared(room);
  }

  checkRoomCleared(room) {
    if (this.clearedRooms.has(room.index)) return;
    const remaining = this.enemies.some(e =>
      e.alive && this.dungeon.roomAt(e.position.x, e.position.z) === room
    );
    if (!remaining) {
      this.clearedRooms.add(room.index);
      if (this.onRoomCleared) this.onRoomCleared(room);
    }
  }

  // ------------------------------------------------------------------
  // Pickups
  // ------------------------------------------------------------------
  spawnPickup(kind, x, z) {
    // teto de drops no chão: sem isso a cena enche de objeto girando
    const MAX_PICKUPS = 14;
    while (this.pickups.length >= MAX_PICKUPS) {
      const velho = this.pickups.shift();
      this.scene.remove(velho.group);
    }

    const def = {
      ammo: { color: 0xffb347, label: 'TOKEN PACK' },
      health: { color: 0x35f0d8, label: 'REFRESH CACHE' },
      weapon_token_streamer: { color: 0xffb347, label: 'TOKEN STREAMER' },
      weapon_few_shot: { color: 0xff2e88, label: 'FEW-SHOT SHOTGUN' }
    }[kind];
    if (!def) return;

    // O modelo vem do tipo do item (js/world/itens.js). Antes tudo era o mesmo
    // octaedro com a cor trocada, e de longe cor não informa nada.
    const item = construirItem(kind, def.color, x, z, glowTexture(def.color));
    this.scene.add(item.group);
    this.pickups.push({ kind, group: item.group, core: item.interno, halo: item.halo, x, z, spin: Math.random() * 6.28 });
  }

  // ------------------------------------------------------------------
  // Update por frame
  // ------------------------------------------------------------------
  update(dt, player, playerStats) {
    this.clock += dt;
    this._updateWaves();

    // inimigos
    for (const e of this.enemies) e.update(dt, player, this);

    // projeteis
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.pos.addScaledVector(p.vel, dt);

      let remove = p.life <= 0;

      // parede
      if (!remove) {
        const t = this.dungeon.worldToTile(p.pos.x, p.pos.z);
        if (this.dungeon.isSolid(t.tx, t.tz)) {
          this.spawnSparks(p.pos, 0xff8866, 3, 0.2);
          remove = true;
        }
      }

      // jogador
      if (!remove) {
        const eye = player.eyePosition();
        const d = Math.hypot(p.pos.x - eye.x, p.pos.z - eye.z);
        if (d < player.radius * 1.5 && Math.abs(p.pos.y - eye.y) < 1.6) {
          this._hitPlayer(p, playerStats);
          remove = true;
        }
      }

      // aliado: só atirador caotico (grok) acerta os próprios aliados
      const ownerIsChaotic = p.owner && p.owner.def && (p.owner.def.friendlyFire || 0) > 0;
      if (!remove && ownerIsChaotic) {
        for (const e of this.enemies) {
          if (!e.alive || e === p.owner) continue;
          const d = Math.hypot(p.pos.x - e.position.x, p.pos.z - e.position.z);
          if (d < e.radius + 0.2) {
            const dead = e.applyDamage(p.damage);
            this.spawnSparks(p.pos, 0xffaa88, 3, 0.2);
            if (dead) this.killEnemy(e, playerStats);
            remove = true;
            break;
          }
        }
      }

      if (remove) this.projectiles.splice(i, 1);
    }

    // tracers: só decaem
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].life -= dt;
      if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);
    }

    // faiscas
    for (const s of this.sparkPool) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) { s.sprite.visible = false; continue; }
      s.vel.y -= 26 * dt;
      s.sprite.position.addScaledVector(s.vel, dt);
      const t = s.life / s.maxLife;
      s.sprite.material.opacity = t * 0.95;
      const sc = s.scale * (0.4 + t * 0.6);
      s.sprite.scale.set(sc, sc, 1);
    }

    // pickups: giram devagar e flutuam. Sem rotacao em X: com forma própria
    // (caixa, capsula, arma) o item capotava no chão e ficava de cabeca pra baixo.
    for (const pk of this.pickups) {
      pk.spin += dt * 1.1;
      pk.core.rotation.y = pk.spin;
      pk.core.position.y = 0.72 + Math.sin(pk.spin * 1.4) * 0.09;
      pk.halo.position.y = pk.core.position.y;
    }

    this._syncProjectiles();
    this._syncTracers();
  }

  _hitPlayer(p, playerStats) {
    if (!playerStats) return;
    const dealt = playerStats.takeDamage(p.damage);
    if (dealt === -1) {
      if (this.feed) this.feed.push('DROPOUT: o projetil atravessou você', 'warn');
      return;
    }
    if (dealt <= 0) return;

    if (p.onHitEffect === 'silence') {
      playerStats.silencedTimer = Math.max(playerStats.silencedTimer, p.silenceTime || 1.6);
      if (this.feed) this.feed.push('Recuso esse pedido.', 'bad');
    }
    if (this.sfx) this.sfx.playerHurt();
    if (this.onPlayerHit) this.onPlayerHit(dealt, p.onHitEffect);
  }

  _syncProjectiles() {
    const m = this._mat4;
    const q = this._quat;

    this.projectiles.forEach((p, i) => {
      m.compose(p.pos, q, this._one);
      this.projMesh.setMatrixAt(i, m);
    });
    // as instâncias que sobraram vao para fora do mundo
    for (let i = this.projectiles.length; i < MAX_PROJECTILES; i++) {
      m.compose(this._hidden, q, this._tiny);
      this.projMesh.setMatrixAt(i, m);
    }
    this.projMesh.count = MAX_PROJECTILES;
    this.projMesh.instanceMatrix.needsUpdate = true;
  }

  _syncTracers() {
    const m = this._mat4;
    const q = this._quat;
    const up = new THREE.Vector3(1, 0, 0);

    this.tracers.forEach((t, i) => {
      const mid = t.from.clone().add(t.to).multiplyScalar(0.5);
      const dir = t.to.clone().sub(t.from);
      const len = dir.length() || 0.001;
      q.setFromUnitVectors(up, dir.clone().normalize());
      m.compose(mid, q, new THREE.Vector3(len, 1, 1));
      this.tracerMesh.setMatrixAt(i, m);
    });
    for (let i = this.tracers.length; i < MAX_TRACERS; i++) {
      m.compose(this._hidden, q.identity(), this._tiny);
      this.tracerMesh.setMatrixAt(i, m);
    }
    this.tracerMesh.count = MAX_TRACERS;
    this.tracerMesh.instanceMatrix.needsUpdate = true;
  }

  // Libera tudo que este andar alocou na cena. Chamado ao trocar de andar.
  dispose() {
    this.clearAll();
    this.scene.remove(this.projMesh);
    this.scene.remove(this.tracerMesh);
    this.projGeo.dispose();
    this.projMat.dispose();
    this.tracerGeo.dispose();
    this.tracerMat.dispose();
    for (const s of this.sparkPool) {
      this.scene.remove(s.sprite);
      s.sprite.material.dispose();
    }
    this.sparkPool.length = 0;
    this.sparkMat.dispose();
    this.sparkTex.dispose();
    this.pickupTex.dispose();
  }

  // Verifica se o jogador pegou algo. Retorna o kind ou null.
  checkPickups(playerPos, radius = 1.3) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      const d = Math.hypot(pk.x - playerPos.x, pk.z - playerPos.z);
      if (d < radius) {
        this.scene.remove(pk.group);
        this.pickups.splice(i, 1);
        if (this.sfx) this.sfx.pickup();
        if (this.onPickup) this.onPickup(pk.kind);
        return pk.kind;
      }
    }
    return null;
  }

  // Inimigos vivos dentro de uma sala.
  enemiesInRoom(room) {
    return this.enemies.filter(e =>
      e.alive && this.dungeon.roomAt(e.position.x, e.position.z) === room
    );
  }

  aliveCount() {
    return this.enemies.length;
  }

  clearAll() {
    for (const e of this.enemies) e.removeFrom(this.scene);
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.tracers.length = 0;
    for (const pk of this.pickups) this.scene.remove(pk.group);
    this.pickups.length = 0;
    for (const s of this.sparkPool) { s.life = 0; s.sprite.visible = false; }
  }
}

export { MAX_ENEMIES };