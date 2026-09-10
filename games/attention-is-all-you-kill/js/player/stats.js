// stats.js — estado do jogador: contexto, tokens, perks, progressão.
// O nome dos recursos e o sistema: contexto e vida, token e munição.

import { resolveWeapon, WEAPON_ORDER, WEAPONS } from '../data/weapons.js';
import { combineMods, PERKS } from '../data/perks.js';

// 128 e tematico (janela de contexto) e da margem de erro para o jogador
// aprender o andar sem morrer na segunda sala.
// Exportado porque o main.js também precisa da base: antes ele tinha um 100
// hardcoded que sobrescrevia este valor e anulava qualquer ajuste feito aqui.
export const BASE_MAX_HP = 128;
const XP_BASE = 100;
const XP_GROWTH = 1.32;

export class PlayerStats {
  constructor() {
    this.ownedPerks = [];
    this.mods = combineMods([]);

    this.baseMaxHp = BASE_MAX_HP;
    this.maxHp = BASE_MAX_HP;
    this.hp = BASE_MAX_HP;
    this.shield = 0;

    this.ammo = {};          // id da arma -> { mag, reserve }
    this.unlocked = ['prompt_injetor'];
    this.currentWeaponId = 'prompt_injetor';

    this.xp = 0;
    this.level = 0;
    this.xpToNext = XP_BASE;

    this.kills = 0;
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.roomsCleared = 0;
    this.computeEarned = 0;

    this.growthDamage = 0;   // acumulado por fine_tune
    this.lastKilledFaction = null;
    this.silencedTimer = 0;  // ataque Recusa
    this.throttleTimer = 0;  // ataque Rate Limiter
    this.invulnTimer = 0;    // imunidade curta após levar dano

    this._initAmmo();
  }

  _initAmmo() {
    for (const id of WEAPON_ORDER) {
      const w = WEAPONS[id];
      this.ammo[id] = { mag: w.magSize, reserve: Math.round(w.reserveMax * 0.5) };
    }
  }

  // ------------------------------------------------------------------
  // Perks e modificadores
  // ------------------------------------------------------------------
  setMetaBonus(bonus) {
    this.metaBonus = { ...this.metaBonus, ...bonus };
    this.recomputeMods();
  }

  // Chance total de disparo duplo: perks da run mais progressão permanente.
  doubleShotChance() {
    return Math.min(0.6, (this.mods.doubleShot || 0) + (this.metaBonus.doubleShot || 0));
  }

  addPerk(id) {
    if (!PERKS[id] || this.ownedPerks.includes(id)) return;
    this.ownedPerks.push(id);
    this.recomputeMods();
  }

  recomputeMods() {
    this.mods = combineMods(this.ownedPerks);
    const prevMax = this.maxHp;
    this.maxHp = Math.round((this.baseMaxHp + (this.mods.maxHpAdd || 0)) * (this.mods.maxHpMul || 1));
    // ganhar vida máxima cura a diferença; perder vida máxima corta o excedente
    const delta = this.maxHp - prevMax;
    if (delta > 0) this.hp += delta;
    this.hp = Math.min(this.hp, this.maxHp);
  }

  hasMod(flag, fallback = false) {
    return this.mods[flag] !== undefined ? this.mods[flag] : fallback;
  }

  // ------------------------------------------------------------------
  // Armas
  // ------------------------------------------------------------------
  weapon() {
    return resolveWeapon(this.currentWeaponId, this.mods);
  }

  currentAmmo() {
    return this.ammo[this.currentWeaponId];
  }

  unlockWeapon(id) {
    if (!this.unlocked.includes(id)) this.unlocked.push(id);
    // ao achar uma arma nova, já equipa: recompensa imediata
    this.currentWeaponId = id;
  }

  switchTo(id) {
    if (!this.unlocked.includes(id)) return false;
    this.currentWeaponId = id;
    return true;
  }

  cycleWeapon(dir) {
    const list = WEAPON_ORDER.filter(id => this.unlocked.includes(id));
    if (list.length < 2) return false;
    const i = list.indexOf(this.currentWeaponId);
    const next = list[(i + dir + list.length) % list.length];
    this.currentWeaponId = next;
    return true;
  }

  consumeAmmo(n = 1) {
    const a = this.currentAmmo();
    if (!a || a.mag < n) return false;
    a.mag -= n;
    return true;
  }

  canReload() {
    const a = this.currentAmmo();
    if (!a) return false;
    const w = this.weapon();
    return a.mag < w.magSize && a.reserve > 0;
  }

  finishReload() {
    const a = this.currentAmmo();
    if (!a) return;
    const w = this.weapon();
    const need = w.magSize - a.mag;
    const take = Math.min(need, a.reserve);
    a.mag += take;
    a.reserve -= take;
  }

  addAmmo(amount) {
    const a = this.currentAmmo();
    if (!a) return;
    const w = this.weapon();
    a.reserve = Math.min(w.reserveMax * 1.5, a.reserve + amount);
  }

  reloadTimeFor() {
    return this.weapon().reloadTime * (this.mods.reloadMul || 1);
  }

  // ------------------------------------------------------------------
  // Dano e cura
  // ------------------------------------------------------------------
  takeDamage(amount) {
    if (amount <= 0) return 0;

    // imunidade curta após levar dano: sem isso, dois inimigos fracos
    // derretem o jogador em segundos e o início do jogo fica injusto
    if (this.invulnTimer > 0) return 0;

    // dropout: parte dos projeteis inimigos simplesmente atravessa
    if (this.mods.dodgeChance > 0 && Math.random() < this.mods.dodgeChance) {
      return -1;   // -1 sinaliza esquiva
    }

    let left = amount;

    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, left);
      this.shield -= absorbed;
      left -= absorbed;
    }

    // guardrail: escudo reativo em golpe grande
    if (this.mods.shieldOnBigHit > 0 && amount >= 25 && this.shield === 0) {
      this.shield = this.mods.shieldOnBigHit;
    }

    this.hp -= left;
    this.damageTaken += left;
    this.invulnTimer = 0.7;
    if (this.hp < 0) this.hp = 0;
    return left;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  isDead() { return this.hp <= 0; }

  hpRatio() { return this.maxHp > 0 ? this.hp / this.maxHp : 0; }

  // ------------------------------------------------------------------
  // Progressão
  // ------------------------------------------------------------------
  addKill(enemy) {
    this.kills++;
    this.lastKilledFaction = enemy.faction;
    const gain = enemy.xp || 10;
    this.xp += gain;
    // O loot do inimigo e a base do compute da run. Triplicado: no valor
    // original uma run inteira não pagava nem o primeiro upgrade de LoRA.
    this.computeEarned += (enemy.loot || 4) * 3;

    // fine_tune: cada abate afina os pesos
    if (this.mods.killDamageGrowth > 0) {
      this.growthDamage += this.mods.killDamageGrowth;
    }
    // rag: recupera parte do pente
    if (this.mods.ammoOnKill > 0) {
      const a = this.currentAmmo();
      const w = this.weapon();
      a.mag = Math.min(w.magSize, a.mag + Math.ceil(w.magSize * this.mods.ammoOnKill));
    }
  }

  addXp(amount) {
    this.xp += amount;
  }

  levelUpReady() {
    return this.xp >= this.xpToNext;
  }

  consumeLevelUp() {
    this.xp -= this.xpToNext;
    this.level++;
    this.xpToNext = Math.round(XP_BASE * Math.pow(XP_GROWTH, this.level));
  }

  // Dano final de um projétil, com overfitting, fine_tune e multiplicadores.
  finalDamage(baseDamage, targetFaction) {
    let dmg = baseDamage * (this.mods.damageMul || 1);
    dmg *= (this.metaBonus.damageMul || 1);
    dmg *= 1 + this.growthDamage;

    if (this.mods.overfitting && this.lastKilledFaction) {
      dmg *= (targetFaction === this.lastKilledFaction) ? 1.8 : 0.7;
    }
    return dmg;
  }

  tickStatus(dt) {
    this.silencedTimer = Math.max(0, this.silencedTimer - dt);
    this.throttleTimer = Math.max(0, this.throttleTimer - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
  }

  isSilenced() { return this.silencedTimer > 0; }

  fireRateMul() {
    return this.throttleTimer > 0 ? 0.4 : 1;
  }

  // ------------------------------------------------------------------
  // Reset entre runs (perks e armas voltam ao zero; meta-progressão não)
  // ------------------------------------------------------------------
  reset() {
    this.ownedPerks = [];
    this.mods = combineMods([]);
    this.maxHp = BASE_MAX_HP;
    this.hp = BASE_MAX_HP;
    this.shield = 0;
    this.unlocked = ['prompt_injetor'];
    this.currentWeaponId = 'prompt_injetor';
    this.xp = 0;
    this.level = 0;
    this.xpToNext = XP_BASE;
    this.kills = 0;
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.roomsCleared = 0;
    this.computeEarned = 0;
    // contadores usados pelo tutorial e pelo resumo da run
    this.shotsFired = 0;
    this.reloads = 0;
    this.growthDamage = 0;
    this.lastKilledFaction = null;
    this.silencedTimer = 0;
    this.throttleTimer = 0;
    this.invulnTimer = 0;
    this._initAmmo();
  }
}