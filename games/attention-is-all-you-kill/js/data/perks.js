// perks.js — ajustes de peso oferecidos entre salas.
// Cada perk e um modificador lido pelo jogador, pela arma e pelo spawner.
// raridade: common | rare | legend

export const PERKS = {
  learning_rate: {
    id: 'learning_rate', name: 'LEARNING RATE', rarity: 'common',
    desc: '+15% de velocidade de movimento.',
    mods: { speedMul: 1.15 }
  },
  token_budget: {
    id: 'token_budget', name: 'TOKEN BUDGET', rarity: 'common',
    desc: 'Recarga 20% mais rápida em todas as armas.',
    mods: { reloadMul: 0.80 }
  },
  top_p: {
    id: 'top_p', name: 'TOP-P', rarity: 'common',
    desc: '-25% de espalhamento. Seus tiros param de mentir.',
    mods: { spreadMul: 0.75 }
  },
  context_window: {
    id: 'context_window', name: 'CONTEXT WINDOW', rarity: 'rare',
    desc: '+40% de teto de token em todas as armas e +20 de contexto.',
    mods: { magMul: 1.40, maxHpAdd: 20 }
  },
  batch_size: {
    id: 'batch_size', name: 'BATCH SIZE', rarity: 'rare',
    desc: 'Dispara 2 projeteis por tiro, com 20% menos dano em cada.',
    mods: { extraProjectile: 1, damageMul: 0.80 }
  },
  multimodal: {
    id: 'multimodal', name: 'MULTIMODAL', rarity: 'rare',
    desc: 'Revela todos os inimigos no minimapa, mesmo atrás da parede.',
    mods: { radar: true }
  },
  rag: {
    id: 'rag', name: 'RAG', rarity: 'rare',
    desc: 'Cada abate devolve 8% do pente da arma atual.',
    mods: { ammoOnKill: 0.08 }
  },
  guardrail: {
    id: 'guardrail', name: 'GUARDRAIL', rarity: 'rare',
    desc: 'Escudo de 30 pontos ao levar um golpe acima de 25 de dano.',
    mods: { shieldOnBigHit: 30 }
  },
  quantization: {
    id: 'quantization', name: 'QUANTIZATION', rarity: 'rare',
    desc: 'Você encolhe 18% (alvo menor) e ganha 10% de velocidade, com 25% menos contexto.',
    mods: { hitboxMul: 0.82, speedMul: 1.10, maxHpMul: 0.75 }
  },
  overfitting: {
    id: 'overfitting', name: 'OVERFITTING', rarity: 'rare',
    desc: '+80% de dano contra a facção do último inimigo morto, -30% contra as outras.',
    mods: { overfitting: true }
  },
  dropout: {
    id: 'dropout', name: 'DROPOUT', rarity: 'legend',
    desc: '20% dos projeteis inimigos atravessam você sem causar dano.',
    mods: { dodgeChance: 0.20 }
  },
  prompt_injection: {
    id: 'prompt_injection', name: 'PROMPT INJECTION', rarity: 'legend',
    desc: 'Inimigos tem 15% de chance de atacar outro inimigo ao atacar você.',
    mods: { friendlyFireChance: 0.15 }
  },
  speculative_decoding: {
    id: 'speculative_decoding', name: 'SPECULATIVE DECODING', rarity: 'legend',
    desc: '25% de chance de disparar duas vezes por um tiro só.',
    mods: { doubleShot: 0.25 }
  },
  fine_tune: {
    id: 'fine_tune', name: 'FINE-TUNE', rarity: 'legend',
    desc: '+3% de dano acumulativo permanente. Cada abate afina mais os pesos.',
    mods: { killDamageGrowth: 0.03 }
  }
};

export const RARITY_WEIGHT = { common: 62, rare: 30, legend: 8 };

export const RARITY_LABEL = { common: 'COMUM', rare: 'RARO', legend: 'LENDARIO' };

// Filtra perks ainda validos (overfitting e fine_tune não se repetem).
export function availablePerks(owned) {
  return Object.values(PERKS).filter(p => !owned.includes(p.id));
}

// Sorteia três perks distintos, respeitando raridade.
export function rollPerkChoices(owned, count = 3) {
  const pool = availablePerks(owned);
  if (pool.length === 0) return [];
  const picks = [];
  const bag = pool.slice();
  while (picks.length < count && bag.length > 0) {
    const total = bag.reduce((s, p) => s + RARITY_WEIGHT[p.rarity], 0);
    let r = Math.random() * total;
    let chosen = bag[bag.length - 1];
    for (const p of bag) {
      r -= RARITY_WEIGHT[p.rarity];
      if (r <= 0) { chosen = p; break; }
    }
    picks.push(chosen);
    bag.splice(bag.indexOf(chosen), 1);
  }
  return picks;
}

// Soma todos os mods dos perks comprados num único objeto de modificadores.
export function combineMods(ownedIds) {
  const mods = {
    speedMul: 1, reloadMul: 1, spreadMul: 1, magMul: 1, damageMul: 1,
    maxHpAdd: 0, maxHpMul: 1, hitboxMul: 1,
    extraProjectile: 0, dodgeChance: 0, friendlyFireChance: 0,
    doubleShot: 0, ammoOnKill: 0, shieldOnBigHit: 0,
    radar: false, overfitting: false, killDamageGrowth: 0
  };
  for (const id of ownedIds) {
    const perk = PERKS[id];
    if (!perk) continue;
    const m = perk.mods;
    if (m.speedMul) mods.speedMul *= m.speedMul;
    if (m.reloadMul) mods.reloadMul *= m.reloadMul;
    if (m.spreadMul) mods.spreadMul *= m.spreadMul;
    if (m.magMul) mods.magMul *= m.magMul;
    if (m.damageMul) mods.damageMul *= m.damageMul;
    if (m.maxHpAdd) mods.maxHpAdd += m.maxHpAdd;
    if (m.maxHpMul) mods.maxHpMul *= m.maxHpMul;
    if (m.hitboxMul) mods.hitboxMul *= m.hitboxMul;
    if (m.extraProjectile) mods.extraProjectile += m.extraProjectile;
    if (m.dodgeChance) mods.dodgeChance = Math.min(0.6, mods.dodgeChance + m.dodgeChance);
    if (m.friendlyFireChance) mods.friendlyFireChance += m.friendlyFireChance;
    if (m.doubleShot) mods.doubleShot = Math.min(0.6, mods.doubleShot + m.doubleShot);
    if (m.ammoOnKill) mods.ammoOnKill += m.ammoOnKill;
    if (m.shieldOnBigHit) mods.shieldOnBigHit = Math.max(mods.shieldOnBigHit, m.shieldOnBigHit);
    if (m.radar) mods.radar = true;
    if (m.overfitting) mods.overfitting = true;
    if (m.killDamageGrowth) mods.killDamageGrowth += m.killDamageGrowth;
  }
  return mods;
}