// weapon.js — viewmodel da arma, disparo hitscan e recarga.
// O viewmodel e procedural: nenhum modelo externo, só geometria e cor.

import * as THREE from '../../vendor/three.module.js';
import { WEAPONS } from '../data/weapons.js';
import { glowTexture } from '../world/textures.js';
import { TILE } from '../world/dungeon.js';

// Interseccao raio-esfera, usada para acertar o chefe e os nós de ancoragem.
function raySphere(origin, dir, center, radius) {
  const ox = origin.x - center.x;
  const oy = origin.y - center.y;
  const oz = origin.z - center.z;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc);
  const t1 = -b - sq;
  if (t1 > 0.05) return t1;
  const t2 = -b + sq;
  if (t2 > 0.05) return t2;
  return -1;
}

export class WeaponSystem {
  constructor(camera, dungeon, director, stats, sfx, skin) {
    this.camera = camera;
    this.dungeon = dungeon;
    this.director = director;
    this.stats = stats;
    this.sfx = sfx;
    this.skin = skin;

    this.cooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;

    this.swayX = 0;
    this.swayY = 0;
    this.recoilZ = 0;
    this.recoilRot = 0;
    this.bobPhase = 0;

    this.muzzleFlashTimer = 0;

    this.aimDirection = new THREE.Vector3();
    this._rayDir = new THREE.Vector3();

    this.onFeed = null;
    this.onKill = null;

    this._buildViewModel();
    this.rebuildForWeapon();
  }

  // ------------------------------------------------------------------
  // Viewmodel
  // ------------------------------------------------------------------
  _buildViewModel() {
    this.rig = new THREE.Group();          // segue a câmera e faz sway
    this.camera.add(this.rig);

    this.model = new THREE.Group();        // a arma em si, trocada por tipo
    // escala menor: sem isso a arma ocupa um quarto da tela e atrapalha a mira
    this.model.scale.setScalar(0.72);
    this.rig.add(this.model);

    this.muzzleFlash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(0xffffff),
      color: 0xfff0c0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    }));
    this.muzzleFlash.scale.set(0.55, 0.55, 1);
    this.rig.add(this.muzzleFlash);
  }

  // Constroi a arma conforme o tipo. Formas simples, leitura clara.
  rebuildForWeapon() {
    const w = this.stats.weapon();
    if (!w) return;
    this.weaponId = w.id;

    // limpa o modelo anterior
    while (this.model.children.length) {
      const c = this.model.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
      this.model.remove(c);
    }

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1e2830 });
    // A luz e o metal da arma guardam referência: são eles que a tela de
    // personalizacao recolore quando o jogador escolhe a aparência.
    const luzDoJogador = this.skin ? this.skin.corLuz : w.color;
    const metalDoJogador = this.skin ? this.skin.corAcabamento : 0x39444f;

    const accentMat = new THREE.MeshBasicMaterial({ color: luzDoJogador });
    const metalMat = new THREE.MeshLambertMaterial({ color: metalDoJogador });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x11181f });

    this.accentMat = accentMat;
    this.metalMat = metalMat;

    const add = (geo, mat, x, y, z, rx = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      this.model.add(m);
      return m;
    };

    // Atalhos de geometria. Os cilindros tem 14 segmentos, o que arredonda o
    // cano de perto sem inflar a contagem de triangulos: cada arma fica na casa
    // das centenas, não dos milhares.
    const caixa = (a, b, c) => new THREE.BoxGeometry(a, b, c);
    const cil = (r, c) => new THREE.CylinderGeometry(r, r * 1.06, c, 14);

    if (w.kind === 'pistol') {
      // ferrolho e slide
      add(caixa(0.085, 0.095, 0.28), bodyMat, 0, 0, -0.10);
      // cano saliente, cilindrico
      add(cil(0.018, 0.15), metalMat, 0, 0.012, -0.30, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.028, 0.026, 0.035, 14), darkMat, 0, 0.012, -0.375, Math.PI / 2);
      // trilho superior com dentes
      add(caixa(0.05, 0.012, 0.20), darkMat, 0, 0.056, -0.10);
      for (let i = 0; i < 3; i++) {
        add(caixa(0.052, 0.008, 0.012), accentMat, 0, 0.066, -0.04 - i * 0.055);
      }
      // mira frontal e traseira
      add(caixa(0.012, 0.022, 0.012), accentMat, 0, 0.078, -0.235);
      add(caixa(0.012, 0.022, 0.012), darkMat, -0.024, 0.074, 0.02);
      add(caixa(0.012, 0.022, 0.012), darkMat, 0.024, 0.074, 0.02);
      // punho inclinado, gatilho e guarda
      add(caixa(0.072, 0.17, 0.10), darkMat, 0, -0.128, 0.035, 0.26);
      add(caixa(0.03, 0.035, 0.012), metalMat, 0, -0.048, -0.02);
      add(caixa(0.052, 0.012, 0.06), darkMat, 0, -0.072, -0.03);
      // faixas de LED nas laterais
      add(caixa(0.006, 0.014, 0.24), accentMat, -0.046, 0.01, -0.10);
      add(caixa(0.006, 0.014, 0.24), accentMat, 0.046, 0.01, -0.10);
      this.muzzleLocal = new THREE.Vector3(0, 0.012, -0.395);
    } else if (w.kind === 'smg') {
      add(caixa(0.095, 0.115, 0.44), bodyMat, 0, 0, -0.16);
      // cano longo, boca e guarda-mão ventilado
      add(cil(0.020, 0.22), metalMat, 0, 0.005, -0.49, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.032, 0.030, 0.045, 14), darkMat, 0, 0.005, -0.60, Math.PI / 2);
      add(caixa(0.07, 0.06, 0.24), darkMat, 0, -0.056, -0.36);
      for (let i = 0; i < 4; i++) {
        add(caixa(0.072, 0.014, 0.014), accentMat, 0, -0.056, -0.28 - i * 0.05);
      }
      // pente curvo com base marcada
      add(caixa(0.06, 0.24, 0.10), darkMat, 0, -0.20, -0.14, 0.14);
      add(caixa(0.062, 0.05, 0.102), accentMat, 0, -0.31, -0.155, 0.14);
      // punho
      add(caixa(0.07, 0.18, 0.10), darkMat, 0, -0.15, 0.06, 0.28);
      // miras e trilho
      add(caixa(0.012, 0.024, 0.012), accentMat, 0, 0.078, -0.36);
      add(caixa(0.05, 0.02, 0.014), darkMat, 0, 0.074, 0.02);
      add(caixa(0.05, 0.012, 0.26), darkMat, 0, 0.062, -0.14);
      this.muzzleLocal = new THREE.Vector3(0, 0.005, -0.635);
    } else {
      // cano duplo, a leitura classica de espingarda
      add(cil(0.024, 0.46), metalMat, -0.028, 0.01, -0.42, Math.PI / 2);
      add(cil(0.024, 0.46), metalMat, 0.028, 0.01, -0.42, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.033, 0.031, 0.05, 14), darkMat, -0.028, 0.01, -0.665, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.033, 0.031, 0.05, 14), darkMat, 0.028, 0.01, -0.665, Math.PI / 2);
      // corpo e trilho
      add(caixa(0.11, 0.12, 0.34), bodyMat, 0, 0, -0.14);
      add(caixa(0.09, 0.04, 0.20), accentMat, 0, 0.07, -0.14);
      // bomba com grip
      add(caixa(0.10, 0.075, 0.16), darkMat, 0, -0.05, -0.38);
      for (let i = 0; i < 3; i++) {
        add(caixa(0.102, 0.008, 0.012), accentMat, 0, -0.05, -0.33 - i * 0.045);
      }
      // coronha e punho
      add(caixa(0.07, 0.13, 0.26), darkMat, 0, -0.06, 0.14, -0.12);
      add(caixa(0.068, 0.16, 0.09), darkMat, 0, -0.16, 0.0, 0.3);
      add(caixa(0.012, 0.022, 0.012), accentMat, 0, 0.078, -0.40);
      this.muzzleLocal = new THREE.Vector3(0, 0.01, -0.70);
    }

    // arma automática segura o gatilho; as outras exigem novo clique
    this.autoFire = w.kind === 'smg';

    // posição de repouso na tela: canto inferior direito
    this.restPos = new THREE.Vector3(0.33, -0.30, -0.62);
    this.model.position.copy(this.restPos);
  }

  // ------------------------------------------------------------------
  // Recarga
  // ------------------------------------------------------------------
  // Troca as cores da arma sem reconstruir o viewmodel: a customizacao tem que
  // refletir na hora, inclusive no menu, antes da partida começar.
  //
  // A aparência aparece na arma, e não em bracos: com as mãos na tela a leitura
  // do combate piorava, porque um bloco grande ficava na frente da mira.
  aplicarSkin(skin) {
    if (!skin) return;

    this.skin = skin;
    if (this.accentMat) this.accentMat.color.setHex(skin.corLuz);
    if (this.metalMat) this.metalMat.color.setHex(skin.corAcabamento);

    // a mira e os acentos da interface seguem a mesma luz, então a escolha
    // vale para a tela inteira e não só para o objeto
    document.documentElement.style.setProperty('--skin-luz', '#' + skin.corLuz.toString(16).padStart(6, '0'));
  }

  startReload() {
    if (this.reloading) return;
    if (!this.stats.canReload()) return;
    this.reloading = true;
    this.stats.reloads++;
    this.reloadTimer = this.stats.reloadTimeFor();
    if (this.sfx) this.sfx.reloadStart();
  }

  // ------------------------------------------------------------------
  // Disparo
  // ------------------------------------------------------------------
  tryFire(player) {
    const stats = this.stats;
    if (this.reloading || this.cooldown > 0) return;

    if (stats.isSilenced()) {
      if (this.onFeed) this.onFeed('Arma travada. Recuso esse pedido.', 'bad');
      return;
    }

    const ammo = stats.currentAmmo();
    if (!ammo || ammo.mag <= 0) {
      if (this.sfx) this.sfx.dryFire();
      this.startReload();
      return;
    }

    const w = stats.weapon();
    stats.consumeAmmo(1);
    stats.shotsFired++;
    this.cooldown = 1 / (w.fireRate * stats.fireRateMul());

    // speculative decoding: chance de disparar duas vezes
    const volleys = Math.random() < stats.doubleShotChance() ? 2 : 1;

    for (let v = 0; v < volleys; v++) {
      this._fireVolley(w, player, stats);
    }

    if (this.sfx) this.sfx.shot(w.sound);

    // recuo e faisca na boca do cano
    player.addRecoil(w.recoil * (0.85 + Math.random() * 0.3));
    player.shake(w.kickBack * 0.12);
    this.recoilZ = Math.min(0.16, this.recoilZ + w.kickBack * 0.5);
    this.recoilRot = Math.min(0.34, this.recoilRot + w.kickBack * 0.7);
    this.muzzleFlashTimer = 0.05;

    // raio de fogo da arma automática
    this.autoFire = w.kind === 'smg';
  }

  _fireVolley(w, player, stats) {
    const eye = player.eyePosition();
    const baseDir = player.aimDirection();
    const extra = stats.mods.extraProjectile || 0;
    const count = w.pellets + extra;

    for (let i = 0; i < count; i++) {
      // spread: pequeno desvio aleatório dentro de um cone
      const spread = w.spread * (stats.mods.spreadMul || 1);
      const angleH = (Math.random() - 0.5) * spread * 2;
      const angleV = (Math.random() - 0.5) * spread * 2;

      const dir = baseDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angleH);
      // desvio vertical: rotaciona em torno do eixo lateral
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      dir.applyAxisAngle(right, angleV).normalize();

      this._castBullet(eye, dir, w, stats, player);
    }
  }

  // Hitscan: procura a parede, depois o inimigo mais próximo, depois o chefe.
  // O primeiro obstaculo no caminho e o que leva o dano.
  _castBullet(eye, dir, w, stats, player) {
    const flatLen = Math.hypot(dir.x, dir.z) || 1e-4;

    const wall = this.dungeon.raycastWall(
      eye.x, eye.z,
      dir.x / flatLen, dir.z / flatLen,
      w.range * flatLen
    );

    let maxDist = w.range;
    if (wall.hit) maxDist = Math.min(maxDist, wall.dist / flatLen);

    let hitEnemy = null;
    let hitDist = maxDist;
    let hitPoint = null;
    let hitBoss = false;

    // Inimigos comuns: o alvo e um cilindro vertical do tamanho do corpo.
    //
    // A versão anterior média a distância do raio ao centro do inimigo em
    // y=1.0 e exigia menos de 0.52. Como a câmera fica em y=1.69, um tiro
    // horizontal passava 0.69 acima do centro e era descartado mesmo com a mira
    // perfeitamente em cima do inimigo: o jogador via o tiro atravessar o corpo
    // e não entendia por que o dano não entrava.
    for (const e of this.director.enemies) {
      if (!e.alive) continue;

      const ox = e.position.x - eye.x;
      const oz = e.position.z - eye.z;

      // interseccao raio-cilindro no plano horizontal.
      // Equação: |t*D - P|^2 = r^2, com P = alvo - câmera, o que da
      // a = D.D, b = -2*(D.P) e c = P.P - r^2. O sinal de b e negativo.
      const a = dir.x * dir.x + dir.z * dir.z;
      if (a < 1e-8) continue;
      const b = -2 * (ox * dir.x + oz * dir.z);
      const c = ox * ox + oz * oz - e.radius * e.radius;
      const disc = b * b - 4 * a * c;
      if (disc < 0) continue;

      const raiz = Math.sqrt(disc);
      let t = (-b - raiz) / (2 * a);
      if (t < 0) t = (-b + raiz) / (2 * a);   // câmera já dentro do cilindro
      if (t < 0 || t > hitDist) continue;

      // a altura do raio nesse ponto tem que cair dentro do corpo
      const altura = eye.y + dir.y * t;
      const topo = (e.def.height || 1.7) + 0.1;
      if (altura < -0.25 || altura > topo) continue;

      hitEnemy = e;
      hitDist = t;
      hitPoint = new THREE.Vector3(
        eye.x + dir.x * t,
        altura,
        eye.z + dir.z * t
      );
    }

    // chefe: as âncoras tem prioridade de alvo; o corpo só conta na janela aberta.
    // O alvo vai explicito para o chefe, sem deteccao por proximidade do ponto.
    let hitAnchor = null;
    if (this.boss && this.boss.alive) {
      const tmp = this._sphereTmp || (this._sphereTmp = new THREE.Vector3());

      let nearestAnchorT = Infinity;
      for (const a of this.boss.anchors) {
        if (!a.alive) continue;
        const t = raySphere(eye, dir, tmp.set(a.x, a.group.position.y, a.z), this.boss.raioAncora || 1.15);
        if (t > 0.2 && t < hitDist && t < nearestAnchorT) {
          nearestAnchorT = t;
          hitAnchor = a;
        }
      }

      if (hitAnchor) {
        hitDist = nearestAnchorT;
        hitEnemy = null;
        hitBoss = true;
        hitPoint = new THREE.Vector3(
          eye.x + dir.x * nearestAnchorT,
          eye.y + dir.y * nearestAnchorT,
          eye.z + dir.z * nearestAnchorT
        );
      } else {
        // A hitbox do corpo vem do próprio chefe: uma bola larga e um sujeito
        // alto e magro não podem compartilhar a mesma esfera de acerto.
        const bp = this.boss.group.position;
        const altura = this.boss.alturaCorpo ?? 4.4;
        const raio = this.boss.raioCorpo ?? 3.0;
        const t = raySphere(eye, dir, tmp.set(bp.x, bp.y + altura, bp.z), raio);
        if (t > 0.2 && t < hitDist) {
          hitDist = t;
          hitEnemy = null;
          hitBoss = true;
          hitPoint = new THREE.Vector3(eye.x + dir.x * t, eye.y + dir.y * t, eye.z + dir.z * t);
        }
      }
    }

    const endPoint = hitPoint || new THREE.Vector3(
      eye.x + dir.x * maxDist,
      eye.y + dir.y * maxDist,
      eye.z + dir.z * maxDist
    );

    // tracer da boca da arma até o ponto final
    const muzzleWorld = new THREE.Vector3();
    this.muzzleFlash.getWorldPosition(muzzleWorld);
    this.director.spawnTracer(muzzleWorld, endPoint, w.tracerColor);

    if (hitBoss) {
      // o chefe não tem facção: overfitting não se aplica a ele
      const dmg = stats.finalDamage(w.damage, '__boss');
      stats.damageDealt += dmg;
      this.director.spawnSparks(endPoint, 0xffb347, 4, 0.3);
      const killed = this.boss.applyDamage(dmg, endPoint, hitAnchor);
      if (killed && this.onKill) this.onKill(null);
    } else if (hitEnemy) {
      const dmg = stats.finalDamage(w.damage, hitEnemy.faction);
      stats.damageDealt += dmg;
      const killed = this.director.damageEnemy(hitEnemy, dmg, hitPoint, stats);
      if (killed && this.onKill) this.onKill(hitEnemy);
    } else if (wall.hit) {
      this.director.spawnSparks(endPoint, 0x9fd8ff, 3, 0.18);
    }
  }

  // Interseccao raio-esfera. Retorna a distância do primeiro toque, ou -1.
  _raySphere(origin, dir, center, radius) {
    return raySphere(origin, dir, center, radius);
  }

  // ------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------
  update(dt, input, player) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt);

    // recarga
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.stats.finishReload();
        if (this.sfx) this.sfx.reloadEnd();
      }
    } else if (input.isDown('KeyR')) {
      this.startReload();
    }

    // fogo: arma automática segura o gatilho, semi precisa de novo clique
    if (input.firing && (this.autoFire || !this._wasFiring)) {
      this.tryFire(player);
    }
    this._wasFiring = input.firing;

    this._animate(dt, player);
  }

  _animate(dt, player) {
    // sway segue o mouse, com retorno
    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    this.bobPhase += dt * (1.6 + speed * 1.4) * (speed > 0.5 ? 1 : 0.25);

    const bobX = Math.cos(this.bobPhase) * 0.012 * Math.min(1, speed / 5);
    const bobY = Math.abs(Math.sin(this.bobPhase)) * 0.014 * Math.min(1, speed / 5);

    this.recoilZ *= Math.max(0, 1 - 9 * dt);
    this.recoilRot *= Math.max(0, 1 - 8 * dt);

    const reloadDip = this.reloading ? -0.16 * Math.sin(Math.PI * Math.min(1, 1 - this.reloadTimer / Math.max(0.01, this.stats.reloadTimeFor()))) : 0;
    const reloadRoll = this.reloading ? 0.5 * Math.sin(Math.PI * Math.min(1, 1 - this.reloadTimer / Math.max(0.01, this.stats.reloadTimeFor()))) : 0;

    this.model.position.set(
      this.restPos.x + bobX,
      this.restPos.y + bobY + reloadDip,
      this.restPos.z + this.recoilZ
    );
    this.model.rotation.set(this.recoilRot, 0, reloadRoll);

    // flash da boca do cano
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlash.position.copy(this.muzzleLocal);
      this.muzzleFlash.material.opacity = 0.9;
      const s = 0.42 + Math.random() * 0.3;
      this.muzzleFlash.scale.set(s, s, 1);
    } else {
      this.muzzleFlash.material.opacity = 0;
    }
  }

  ammoString() {
    const a = this.stats.currentAmmo();
    if (!a) return '0 / 0';
    return `${a.mag} / ${a.reserve}`;
  }

  isReloading() { return this.reloading; }

  reloadProgress() {
    if (!this.reloading) return 1;
    const total = Math.max(0.01, this.stats.reloadTimeFor());
    return 1 - this.reloadTimer / total;
  }
}