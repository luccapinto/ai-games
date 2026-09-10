// weapons.js — arsenal. v1 tem três armas, uma por tier de escada.
// Todos os números são tuning de jogo, ancorados na fantasia de cada modelo.

export const WEAPONS = {
  prompt_injetor: {
    id: 'prompt_injetor',
    slot: 1,
    name: 'PROMPT INJETOR',
    tier: 0,
    kind: 'pistol',
    // A arma inicial precisa resolver um inimigo comum em 3 tiros. Com 9 de
    // dano ela precisava de 4 e o jogador não limpava a sala antes de morrer.
    damage: 13,
    fireRate: 2.0,          // tiros por segundo
    magSize: 30,
    reserveMax: 120,
    reloadTime: 1.5,
    spread: 0.030,          // radianos de desvio máximo
    pellets: 1,
    hitscan: true,
    range: 70,
    recoil: 0.010,
    kickBack: 0.06,
    color: 0x35f0d8,
    tracerColor: 0x9ffff0,
    sound: 'pistol',
    desc: 'Pistola inicial. Dispara instrucoes cruas. Dano ridiculo, precisão honesta.'
  },

  token_streamer: {
    id: 'token_streamer',
    slot: 2,
    name: 'TOKEN STREAMER',
    tier: 1,
    kind: 'smg',
    damage: 5,
    fireRate: 11.5,
    magSize: 60,
    reserveMax: 240,
    reloadTime: 2.1,
    spread: 0.062,
    pellets: 1,
    hitscan: true,
    range: 55,
    recoil: 0.007,
    kickBack: 0.03,
    color: 0xffb347,
    tracerColor: 0xffd89a,
    sound: 'smg',
    desc: 'Jorra token sem parar. A munição evapora, mas nada te pressiona melhor de perto.'
  },

  few_shot: {
    id: 'few_shot',
    slot: 3,
    name: 'FEW-SHOT SHOTGUN',
    tier: 1,
    kind: 'shotgun',
    damage: 8,
    fireRate: 0.95,
    magSize: 8,
    reserveMax: 40,
    reloadTime: 2.6,
    spread: 0.135,
    pellets: 6,
    hitscan: true,
    range: 26,
    recoil: 0.048,
    kickBack: 0.20,
    color: 0xff2e88,
    tracerColor: 0xff9ecb,
    sound: 'shotgun',
    desc: 'Cartucho com varios exemplos dentro. Devastadora de perto, inutil de longe.'
  }
};

export const WEAPON_ORDER = ['prompt_injetor', 'token_streamer', 'few_shot'];

export function weaponById(id) {
  return WEAPONS[id] || null;
}

// Aplica bonuses de perks aos números base, sem mutar o dado original.
export function resolveWeapon(id, mods = {}) {
  const base = WEAPONS[id];
  if (!base) return null;
  const damageMul = mods.damageMul || 1;
  const spreadMul = mods.spreadMul || 1;
  const magMul = mods.magMul || 1;
  const reloadMul = mods.reloadMul || 1;
  return {
    ...base,
    damage: base.damage * damageMul,
    spread: base.spread * spreadMul,
    magSize: Math.round(base.magSize * magMul),
    reloadTime: base.reloadTime * reloadMul
  };
}