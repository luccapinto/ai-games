// hud.js — HUD em DOM e minimapa em canvas 2D.
// O minimapa e barato e resolve orientacao melhor que qualquer seta.

import { TILE } from '../world/dungeon.js';
import { WEAPON_ORDER, WEAPONS } from '../data/weapons.js';
import { PERKS } from '../data/perks.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.root = $('hud');
    this.hpFill = $('hp-fill');
    this.hpValue = $('hp-value');
    this.hpNote = $('hp-note');
    this.ammoFill = $('ammo-fill');
    this.ammoValue = $('ammo-value');
    this.weaponName = $('weapon-name');
    this.weaponSlots = $('weapon-slots');
    this.perkList = $('perk-list');
    this.floorLabel = $('floor-label');
    this.roomLabel = $('room-label');
    this.killLabel = $('kill-label');
    this.minimap = $('minimap');
    this.mmCtx = this.minimap.getContext('2d');
    this.bossBar = $('boss-bar');
    this.bossFill = $('boss-fill');
    this.bossName = $('boss-name');
    this.vignette = $('damage-vignette');
    this.hitMarker = $('hit-marker');
    this.crosshair = $('crosshair');
    this.promptHint = $('prompt-hint');

    this.vignetteTimer = 0;
    this.hitTimer = 0;
    this._lastWeaponId = null;
    this._lastPerkCount = -1;
    this._lastSlotKey = '';
    this.mapScale = 1;
    this.mapOffset = { x: 0, z: 0 };
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  flashDamage() { this.vignetteTimer = 0.18; }
  flashHit() { this.hitTimer = 0.09; }

  // ------------------------------------------------------------------
  // ctx = { stats, weapon, player, director, dungeon, run, boss, theme }
  // ------------------------------------------------------------------
  update(dt, ctx) {
    const { stats, weapon, player, director, dungeon, run, boss } = ctx;

    // contexto (vida)
    const ratio = stats.hpRatio();
    this.hpFill.style.width = `${Math.max(0, ratio * 100)}%`;
    this.hpFill.classList.toggle('low', ratio <= 0.3);
    this.hpValue.textContent = `${Math.ceil(stats.hp)}`;
    this.hpNote.textContent = stats.shield > 0
      ? `ESCUDO ${Math.ceil(stats.shield)}`
      : (stats.isSilenced() ? 'ARMA TRAVADA' : '');

    // tokens (municao)
    const ammo = stats.currentAmmo();
    const w = stats.weapon();
    if (w && ammo) {
      const magRatio = ammo.mag / w.magSize;
      this.ammoFill.style.width = `${Math.max(0, Math.min(1, magRatio)) * 100}%`;
      this.ammoValue.textContent = weapon.isReloading()
        ? 'RECARREGANDO'
        : `${ammo.mag} / ${ammo.reserve}`;
      this.weaponName.textContent = w.name;
    }

    // slots de arma
    const slotKey = stats.unlocked.join(',') + '|' + stats.currentWeaponId;
    if (slotKey !== this._lastSlotKey) {
      this._lastSlotKey = slotKey;
      this.weaponSlots.innerHTML = '';
      for (const id of WEAPON_ORDER) {
        const unlocked = stats.unlocked.includes(id);
        const el = document.createElement('div');
        el.className = 'slot'
          + (stats.currentWeaponId === id ? ' active' : '')
          + (unlocked ? '' : ' empty');
        el.textContent = unlocked ? `${WEAPONS[id].slot} ${WEAPONS[id].name.split(' ')[0]}` : `${WEAPONS[id].slot} ---`;
        this.weaponSlots.appendChild(el);
      }
    }

    // perks
    if (stats.ownedPerks.length !== this._lastPerkCount) {
      this._lastPerkCount = stats.ownedPerks.length;
      this.perkList.innerHTML = '';
      for (const id of stats.ownedPerks) {
        const p = PERKS[id];
        if (!p) continue;
        const el = document.createElement('div');
        el.className = 'perk-chip' + (p.rarity === 'rare' ? ' rare' : p.rarity === 'legend' ? ' legend' : '');
        el.textContent = p.name;
        this.perkList.appendChild(el);
      }
    }

    // andar, sala, abates
    this.floorLabel.textContent = `ANDAR ${run.floor}`;
    const room = dungeon.roomAt(player.position.x, player.position.z);
    this.roomLabel.textContent = room ? `SALA ${room.index + 1}` : 'CORREDOR';
    this.killLabel.textContent = `${stats.kills} ABATES`;

    // barra de chefe
    if (boss && boss.alive) {
      this.bossBar.classList.remove('hidden');
      const r = Math.max(0, boss.hp / boss.maxHp);
      this.bossFill.style.width = `${r * 100}%`;
      this.bossName.textContent = boss.isVulnerable
        ? 'THE FINE-TUNER  /  EXPOSTO'
        : 'THE FINE-TUNER  /  BLINDADO';
    } else {
      this.bossBar.classList.add('hidden');
    }

    // feedback visual
    this.vignetteTimer = Math.max(0, this.vignetteTimer - dt);
    this.vignette.classList.toggle('hurt', this.vignetteTimer > 0);

    this.hitTimer = Math.max(0, this.hitTimer - dt);
    this.hitMarker.classList.toggle('on', this.hitTimer > 0);

    // reticulo expande com espalhamento real
    if (w) {
      const spread = (w.spread * (stats.mods.spreadMul || 1)) * 320;
      const size = Math.max(14, Math.min(60, 14 + spread));
      this.crosshair.style.width = `${size}px`;
      this.crosshair.style.height = `${size}px`;
    }

    this.drawMinimap(ctx);
  }

  // ------------------------------------------------------------------
  // Minimapa
  // ------------------------------------------------------------------
  drawMinimap({ director, dungeon, player, stats, run, boss }) {
    const c = this.mmCtx;
    const W = this.minimap.width;
    const H = this.minimap.height;
    const view = 34;                       // tiles visiveis ao redor do jogador
    const scale = W / view;

    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(4,8,14,0.85)';
    c.fillRect(0, 0, W, H);

    const { tx: ptx, tz: ptz } = dungeon.worldToTile(player.position.x, player.position.z);
    const originX = ptx - view / 2;
    const originZ = ptz - view / 2;

    // piso
    c.fillStyle = 'rgba(53, 240, 216, 0.16)';
    const startX = Math.max(0, Math.floor(originX));
    const startZ = Math.max(0, Math.floor(originZ));
    const endX = Math.min(dungeon.cols - 1, Math.ceil(originX + view));
    const endZ = Math.min(dungeon.rows - 1, Math.ceil(originZ + view));

    for (let tz = startZ; tz <= endZ; tz++) {
      for (let tx = startX; tx <= endX; tx++) {
        if (dungeon.isSolid(tx, tz)) continue;
        const px = (tx - originX) * scale;
        const pz = (tz - originZ) * scale;
        c.fillRect(px, pz, Math.ceil(scale), Math.ceil(scale));
      }
    }

    // salas ativadas sao reveladas com contorno
    for (const room of dungeon.rooms) {
      const rx = (room.x1 - originX) * scale;
      const rz = (room.z1 - originZ) * scale;
      const rw = (room.x2 - room.x1) * scale;
      const rh = (room.z2 - room.z1) * scale;
      if (rx + rw < 0 || rz + rh < 0 || rx > W || rz > H) continue;
      if (room.type === 'boss') {
        c.strokeStyle = 'rgba(255, 59, 48, 0.9)';
        c.lineWidth = 2;
      } else if (director.clearedRooms.has(room.index)) {
        c.strokeStyle = 'rgba(53, 240, 216, 0.35)';
        c.lineWidth = 1;
      } else {
        c.strokeStyle = 'rgba(111, 139, 136, 0.3)';
        c.lineWidth = 1;
      }
      c.strokeRect(rx, rz, rw, rh);
    }

    // pickups
    c.fillStyle = '#ffb347';
    for (const pk of director.pickups) {
      const { tx, tz } = dungeon.worldToTile(pk.x, pk.z);
      const px = (tx - originX) * scale;
      const pz = (tz - originZ) * scale;
      c.fillRect(px - 1.5, pz - 1.5, 4, 4);
    }

    // inimigos: radar mostra todos, senao so os com linha de visao
    for (const e of director.enemies) {
      if (!e.alive) continue;
      const visible = stats.mods.radar || dungeon.hasLineOfSight(
        player.position.x, player.position.z, e.position.x, e.position.z
      );
      if (!visible) continue;

      const { tx, tz } = dungeon.worldToTile(e.position.x, e.position.z);
      const px = (tx - originX) * scale;
      const pz = (tz - originZ) * scale;

      c.fillStyle = e.def.tier >= 3 ? '#ff2e88' : '#ff5a4a';
      const s = e.def.tier >= 3 ? 4 : 3;
      c.fillRect(px - s / 2, pz - s / 2, s, s);
    }

    // chefe
    if (boss && boss.alive) {
      const { tx, tz } = dungeon.worldToTile(boss.group.position.x, boss.group.position.z);
      const px = (tx - originX) * scale;
      const pz = (tz - originZ) * scale;
      c.fillStyle = '#ff3b30';
      c.beginPath();
      c.arc(px, pz, 5, 0, Math.PI * 2);
      c.fill();
    }

    // jogador
    const px = (ptx - originX) * scale + scale / 2;
    const pz = (ptz - originZ) * scale + scale / 2;
    c.fillStyle = '#35f0d8';
    c.beginPath();
    c.arc(px, pz, 3.2, 0, Math.PI * 2);
    c.fill();

    // direcao da mira
    const yaw = player.yaw;
    c.strokeStyle = '#35f0d8';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(px, pz);
    c.lineTo(px - Math.sin(yaw) * 9, pz - Math.cos(yaw) * 9);
    c.stroke();
  }

  setHint(text) {
    if (!text) {
      this.promptHint.classList.add('hidden');
      return;
    }
    this.promptHint.textContent = text;
    this.promptHint.classList.remove('hidden');
  }
}

export { $ };
