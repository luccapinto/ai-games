// boss.js — THE FINE-TUNER, chefe do andar 1.
// Regra da luta: enquanto as âncoras (os nós de ajuste) existirem, a mão esta
// blindada. Destrua as âncoras para abrir a janela de dano. Três fases.

import * as THREE from '../../vendor/three.module.js';
import { FACTIONS, finetuneName } from '../data/enemies.js';
import { glowTexture, blobShadowTexture } from '../world/textures.js';
import { TILE } from '../world/dungeon.js';

const STATE = {
  IDLE: 'IDLE',
  ANCHOR_PHASE: 'ANCHOR_PHASE',
  VULNERABLE: 'VULNERABLE',
  DYING: 'DYING',
  DEAD: 'DEAD'
};

export class FineTuner {
  constructor(scene, dungeon, theme, room, sfx = null, feed = null) {
    this.scene = scene;
    this.dungeon = dungeon;
    this.theme = theme;
    this.room = room;
    this.sfx = sfx;
    this.feed = feed;

    this.name = 'THE FINE-TUNER';
    // 420 e o total de dano que a luta pede: 4 âncoras de 38 na fase 1, mais
    // três janelas de dano. Com 900 o corpo sozinho pedia ~70 tiros de pistola
    // depois das âncoras, e a luta virava exercício de paciência.
    this.maxHp = 420;
    this.hp = this.maxHp;
    this.phase = 1;
    this.state = STATE.IDLE;
    this.alive = true;
    this.damageWindowTimer = 0;
    this.attackTimer = 2.5;
    this.attackPattern = 0;
    this.armorFlash = 0;
    this.slamTelegraph = null;
    this.sweep = null;
    this.hitPoints = [];

    this.anchors = [];
    this._build();
  }

  get isVulnerable() { return this.state === STATE.VULNERABLE; }

  _build() {
    const cx = (this.room.cx + 0.5) * TILE;
    const cz = (this.room.cz + 0.5) * TILE;
    this.center = new THREE.Vector3(cx, 0, cz);

    this.group = new THREE.Group();
    this.group.position.set(cx, 0, cz);
    this.scene.add(this.group);

    const palmMat = new THREE.MeshLambertMaterial({
      color: 0x2b3640,
      emissive: 0x1a5a6a
    });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x161d24 });

    // palma da mão
    this.palm = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 4.6), palmMat);
    this.palm.position.y = 4.6;
    this.group.add(this.palm);

    // pulsos e dedos
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.8, 3.0), palmMat);
      finger.position.set(-1.55 + i * 1.03, 4.5, -3.4);
      this.group.add(finger);

      const joint = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.7), darkMat);
      joint.position.set(-1.55 + i * 1.03, 4.5, -5.0);
      this.group.add(joint);
    }

    // polegar
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 1.9), palmMat);
    thumb.position.set(2.6, 4.4, -1.2);
    thumb.rotation.y = 0.5;
    this.group.add(thumb);

    // nó de ajuste visível no dorso: indicador do estado blindado
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0x35f0d8 });
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), this.coreMat);
    this.core.position.y = 5.3;
    this.group.add(this.core);

    this.coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(0x35f0d8), color: 0x35f0d8,
      transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    this.coreGlow.scale.set(3.4, 3.4, 1);
    this.coreGlow.position.y = 5.3;
    this.group.add(this.coreGlow);

    this.restY = 0;
    this.group.position.y = this.restY;

    // sombra no chão
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 10),
      new THREE.MeshBasicMaterial({
        map: blobShadowTexture(), transparent: true, opacity: 0.55, depthWrite: false
      })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.04;
    this.group.add(this.shadow);
  }

  // ------------------------------------------------------------------
  // Âncoras: precisam ser destruidas para abrir a janela de dano
  // ------------------------------------------------------------------
  _spawnAnchors(count) {
    this._clearAnchors();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.PI / 4;
      const raioMax = Math.min(this.room.x2 - this.room.x1, this.room.z2 - this.room.z1) * TILE * 0.32;

      // A posição e geometrica, então pode cair dentro de um rack ou fora da
      // sala. Âncora inacessivel trava a luta inteira: o jogador não consegue
      // destruir os nos, o corpo fica blindado para sempre e parece que o
      // chefe não toma dano. Por isso testamos o tile antes de aceitar.
      let x = this.center.x;
      let z = this.center.z;
      let achou = false;
      for (let tentativa = 0; tentativa < 28 && !achou; tentativa++) {
        const a = angle + tentativa * 0.31;
        const raio = raioMax * (1 - 0.11 * Math.floor(tentativa / 12));
        const cx = this.center.x + Math.cos(a) * raio;
        const cz = this.center.z + Math.sin(a) * raio;
        const t = this.dungeon.worldToTile(cx, cz);
        if (this.dungeon.isSolid(t.tx, t.tz)) continue;
        // precisa de espaço livre em volta para a linha de tiro passar
        let livre = true;
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (this.dungeon.isSolid(t.tx + ox, t.tz + oz)) { livre = false; break; }
        }
        if (!livre) continue;
        x = cx;
        z = cz;
        achou = true;
      }
      if (!achou) continue;

      const group = new THREE.Group();
      group.position.set(x, 2.1, z);

      const mat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
      const node = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), mat);
      group.add(node);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.06, 6, 18),
        new THREE.MeshBasicMaterial({ color: 0xff8866 })
      );
      ring.rotation.x = Math.PI / 2;
      group.add(ring);

      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(0xff3b30), color: 0xff3b30,
        transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      halo.scale.set(3.0, 3.0, 1);
      group.add(halo);

      this.scene.add(group);
      this.anchors.push({
        group, node, ring, halo, mat,
        hp: 38,
        maxHp: 38,
        x, z,
        spin: Math.random() * 6.28,
        alive: true
      });
    }
  }

  _clearAnchors() {
    for (const a of this.anchors) this.scene.remove(a.group);
    this.anchors.length = 0;
  }

  aliveAnchors() { return this.anchors.filter(a => a.alive); }

  // ------------------------------------------------------------------
  // Dano
  // ------------------------------------------------------------------
  // O alvo chega explicito do hitscan: a âncora atingida, ou null para o corpo.
  // A deteccao por proximidade do ponto de impacto se mostrou frágil quando o
  // jogador fica embaixo da mão, por isso o alvo e decidido no raio.
  applyDamage(amount, point, anchor = null) {
    if (!this.alive) return false;

    if (anchor && anchor.alive) {
      anchor.hp -= amount;
      anchor.mat.color.setHex(0xffffff);
      setTimeout(() => { if (anchor.mat) anchor.mat.color.setHex(0xff3b30); }, 60);
      if (anchor.hp <= 0) this._destroyAnchor(anchor);
      return false;
    }

    if (this.state !== STATE.VULNERABLE) {
      this.armorFlash = 0.14;
      // avisa no máximo a cada 2 segundos, senao vira spam no feed
      if (this.feed && (this._armorWarnAt || 0) <= 0) {
        this.feed.push('BLINDADO: destrua os nós de ancoragem', 'warn');
        this._armorWarnAt = 2;
      }
      return false;
    }

    this.hp -= amount;
    this.armorFlash = 0.1;

    if (this.hp <= 0) {
      this.hp = 0;
      this._die();
      return true;
    }
    return false;
  }

  _destroyAnchor(anchor) {
    anchor.alive = false;
    this.scene.remove(anchor.group);
    if (this.sfx) this.sfx.enemyDeath({ tier: 3 });

    if (this.aliveAnchors().length === 0) {
      this.state = STATE.VULNERABLE;
      this.damageWindowTimer = this.phase === 3 ? 14 : 9;
      if (this.feed) this.feed.push('JANELA ABERTA: os pesos estão expostos', 'warn');
      if (this.sfx) this.sfx.levelUp();
      this.coreMat.color.setHex(0xffe066);
    }
  }

  _die() {
    this.alive = false;
    this.state = STATE.DYING;
    this._clearAnchors();
    if (this.feed) this.feed.push('THE FINE-TUNER ajustado ao silêncio.', 'warn');
  }

  // ------------------------------------------------------------------
  // Ataques
  // ------------------------------------------------------------------
  _slamAttack(player) {
    const target = new THREE.Vector3(player.position.x, 0, player.position.z);
    const radius = 3.6;

    // telegraph no chão: o jogador tem tempo de sair
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.82, radius, 26),
      new THREE.MeshBasicMaterial({
        color: 0xff3b30, transparent: true, opacity: 0.7,
        side: THREE.DoubleSide, depthWrite: false
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(target.x, 0.05, target.z);
    this.scene.add(ring);

    this.slamTelegraph = { ring, timer: 1.15, target, radius };

    // a mão se move para cima da posição alvo
    this.group.position.x = target.x;
    this.group.position.z = target.z;
  }

  _resolveSlam(player, stats) {
    const t = this.slamTelegraph;
    const d = Math.hypot(player.position.x - t.target.x, player.position.z - t.target.z);
    if (d < t.radius) {
      const dmg = 22 + this.phase * 5;
      if (stats) stats.takeDamage(dmg);
      if (this.sfx) this.sfx.playerHurt();
      if (this.onPlayerHit) this.onPlayerHit(dmg);
    }
    if (this.sfx) this.sfx.shot('shotgun');
    this.scene.remove(t.ring);
    this.slamTelegraph = null;
  }

  _spawnMinions(director, floor) {
    const count = 2 + this.phase;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 5;
      const x = this.center.x + Math.cos(angle) * r;
      const z = this.center.z + Math.sin(angle) * r;
      const { tx, tz } = this.dungeon.worldToTile(x, z);
      if (this.dungeon.isSolid(tx, tz)) continue;
      director.spawnEnemy('qwen_turbo', x, z, floor, { grace: 0.3 });
    }
    if (this.feed) this.feed.push('O chefe invocou um lote de treino.', 'warn');
  }

  // Terceiro ataque: leque de projeteis. Reutiliza o sistema de projetil que o
  // jogador já aprendeu a ler. Antes ele saia sem nenhum aviso e o leque de
  // 90 graus era impossível de desviar no susto; agora o cone aparece no chão
  // por 1.25s, os projeteis são mais lentos e ha menos deles, o que deixa
  // corredor entre um tiro e outro.
  _volleyAttack(director, player) {
    const baseAngle = Math.atan2(
      player.position.z - this.center.z,
      player.position.x - this.center.x
    );
    const spread = Math.PI * 0.5;

    // setor de aviso no chão. O circulo nasce no plano XY e vai para o chão com
    // rotacao em X, o que espelha o eixo Z: por isso o ângulo entra negado.
    const setor = new THREE.Mesh(
      new THREE.CircleGeometry(12, 26, -baseAngle - spread / 2, spread),
      new THREE.MeshBasicMaterial({
        color: 0xff3b30, transparent: true, opacity: 0.20,
        side: THREE.DoubleSide, depthWrite: false
      })
    );
    setor.rotation.x = -Math.PI / 2;
    setor.position.set(this.center.x, 0.07, this.center.z);
    this.scene.add(setor);

    this.volleyTelegraph = { setor, timer: 1.25, baseAngle, spread };

    if (this.feed) this.feed.push('AVISO: descarga em leque carregando.', 'bad');
    if (this.sfx) this.sfx.levelUp();
  }

  _resolveVolley(director) {
    const t = this.volleyTelegraph;
    const count = 5 + this.phase;
    const origin = new THREE.Vector3(this.center.x, 3.1, this.center.z);

    for (let i = 0; i < count; i++) {
      const a = t.baseAngle - t.spread / 2 + (t.spread / (count - 1)) * i;
      director.spawnEnemyProjectile(
        origin, Math.cos(a), Math.sin(a),
        9 + this.phase * 2,
        { def: { tier: 3 }, isBoss: true },
        { speed: 17 }
      );
    }

    this.scene.remove(t.setor);
    this.volleyTelegraph = null;
    if (this.sfx) this.sfx.shot('shotgun');
    if (this.feed) this.feed.push('Descarga de dados em leque.', 'bad');
  }

  // ------------------------------------------------------------------
  // update
  // ------------------------------------------------------------------
  update(dt, player, stats, director, floor) {
    if (!this.alive) return;

    this.armorFlash = Math.max(0, this.armorFlash - dt);
    this._armorWarnAt = Math.max(0, (this._armorWarnAt || 0) - dt);
    this.core.rotation.y += dt * 1.4;
    this.core.rotation.x += dt * 0.7;

    // flash de blindagem
    if (this.armorFlash > 0) {
      this.coreMat.color.setHex(0xff3b30);
    } else if (this.state === STATE.VULNERABLE) {
      this.coreMat.color.setHex(0xffe066);
    } else {
      this.coreMat.color.setHex(0x35f0d8);
    }

    // animação de flutuar
    const t = performance.now() / 1000;
    this.group.position.y = Math.sin(t * 0.9) * 0.28;

    // âncoras girando
    for (const a of this.anchors) {
      if (!a.alive) continue;
      a.spin += dt * 1.2;
      a.node.rotation.y = a.spin;
      a.node.rotation.x = a.spin * 0.7;
      a.ring.rotation.z = a.spin * 0.5;
      a.group.position.y = 2.1 + Math.sin(a.spin * 1.3) * 0.25;
    }

    // estado inicial: invoca as âncoras da fase
    if (this.state === STATE.IDLE) {
      this.state = STATE.ANCHOR_PHASE;
      this._spawnAnchors(4);
      if (this.feed) this.feed.push('THE FINE-TUNER: ajustando você ao formato dele.', 'bad');
      return;
    }

    // janela de vulnerabilidade
    if (this.state === STATE.VULNERABLE) {
      this.damageWindowTimer -= dt;
      if (this.damageWindowTimer <= 0) {
        this.phase = Math.min(3, this.phase + 1);
        if (this.phase <= 3 && this.hp > 0) {
          this.state = STATE.ANCHOR_PHASE;
          this._spawnAnchors(Math.max(1, 4 - this.phase));
          if (this.feed) this.feed.push(`Fase ${this.phase}: novos nos de ancoragem.`, 'bad');
        }
      }
      return;
    }

    if (this.state !== STATE.ANCHOR_PHASE) return;

    // durante a fase de âncoras, ataca de tempo em tempo
    this.attackTimer -= dt;

    if (this.slamTelegraph) {
      this.slamTelegraph.timer -= dt;
      const pulse = 0.4 + 0.5 * Math.abs(Math.sin(this.slamTelegraph.timer * 8));
      this.slamTelegraph.ring.material.opacity = pulse;
      if (this.slamTelegraph.timer <= 0) this._resolveSlam(player, stats);
      return;
    }

    // aviso do leque: o cone pulsa no chão até o disparo
    if (this.volleyTelegraph) {
      this.volleyTelegraph.timer -= dt;
      const t = this.volleyTelegraph.timer;
      this.volleyTelegraph.setor.material.opacity = 0.14 + 0.24 * Math.abs(Math.sin(t * 14));
      if (t <= 0) this._resolveVolley(director);
      return;
    }

    if (this.attackTimer <= 0) {
      const roll = Math.random();
      const aggression = 1 + (this.phase - 1) * 0.25;

      if (roll < 0.5) {
        this._slamAttack(player);
        this.attackTimer = (2.6 / aggression) + Math.random() * 0.8;
      } else if (roll < 0.8) {
        this._spawnMinions(director, floor);
        this.attackTimer = (3.4 / aggression) + Math.random();
      } else {
        this._volleyAttack(director, player);
        this.attackTimer = (3.0 / aggression) + Math.random();
      }
    }
  }

  // Verifica se o projetil do jogador acertou o corpo (chamado pela arma).
  boundsCheck(point) {
    if (!this.alive) return false;
    const d = Math.hypot(point.x - this.group.position.x, point.z - this.group.position.z);
    return d < 3.4 && point.y > 2.4 && point.y < 6.2;
  }

  dispose() {
    this._clearAnchors();
    if (this.slamTelegraph) this.scene.remove(this.slamTelegraph.ring);
    if (this.volleyTelegraph) this.scene.remove(this.volleyTelegraph.setor);
    this.scene.remove(this.group);
  }
}