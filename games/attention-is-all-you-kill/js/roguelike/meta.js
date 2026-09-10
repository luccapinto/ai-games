// meta.js — progressao permanente entre runs, guardada em localStorage.
// A moeda e compute. Cada run deixa algo, mesmo perdida.

const KEY = 'aiayk.meta.v1';

export const META_UPGRADES = [
  {
    id: 'lora_context',
    name: 'LORA: CONTEXT WINDOW',
    desc: '+10 de contexto inicial por nivel.',
    cost: 120,
    max: 3
  },
  {
    id: 'token_reserve',
    name: 'TOKEN PACK PERMANENTE',
    desc: '+15% de municao reserva em todas as armas.',
    cost: 100,
    max: 3
  },
  {
    id: 'learning_rate',
    name: 'LEARNING RATE ESTAVEL',
    desc: '+4% de velocidade de movimento por nivel.',
    cost: 150,
    max: 2
  },
  {
    id: 'rlhf',
    name: 'RLHF: PREFERENCIA',
    desc: '+6% de dano por nivel. Recompensa por ser util.',
    cost: 200,
    max: 3
  },
  {
    id: 'speculative',
    name: 'SPECULATIVE DECODING',
    desc: '+8% de chance de disparo duplo por nivel.',
    cost: 350,
    max: 2
  }
];

export class MetaProgress {
  constructor() {
    this.compute = 0;
    this.levels = {};
    this.bestFloor = 1;
    this.totalKills = 0;
    this.runs = 0;
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      this.compute = data.compute || 0;
      this.levels = data.levels || {};
      this.bestFloor = data.bestFloor || 1;
      this.totalKills = data.totalKills || 0;
      this.runs = data.runs || 0;
    } catch (e) {
      // dado corrompido: comeca limpo em vez de quebrar o boot
      this.compute = 0;
      this.levels = {};
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        compute: this.compute,
        levels: this.levels,
        bestFloor: this.bestFloor,
        totalKills: this.totalKills,
        runs: this.runs
      }));
    } catch (e) { /* modo privado: segue sem persistir */ }
  }

  levelOf(id) { return this.levels[id] || 0; }

  costOf(def) {
    const lvl = this.levelOf(def.id);
    // cada nivel seguinte custa 1.8x mais
    return Math.round(def.cost * Math.pow(1.8, lvl));
  }

  canBuy(def) {
    return this.levelOf(def.id) < def.max && this.compute >= this.costOf(def);
  }

  buy(def) {
    if (!this.canBuy(def)) return false;
    this.compute -= this.costOf(def);
    this.levels[def.id] = this.levelOf(def.id) + 1;
    this.save();
    return true;
  }

  // Bônus aplicados no inicio de cada run.
  bonus() {
    return {
      hpAdd: this.levelOf('lora_context') * 10,
      reserveMul: 1 + this.levelOf('token_reserve') * 0.15,
      speedMul: 1 + this.levelOf('learning_rate') * 0.04,
      damageMul: 1 + this.levelOf('rlhf') * 0.06,
      doubleShot: this.levelOf('speculative') * 0.08
    };
  }

  // Registra o resultado de uma run encerrada.
  // O payout premia o que o jogador fez, nao so o tempo sobrevivido: cada
  // abate, cada sala limpa e cada andar alcancado entram na conta. Antes o
  // resultado quase nao reagia ao desempenho e uma run boa pagava o mesmo que
  // uma run em que o jogador morreu no primeiro corredor.
  finishRun({ floor, kills, computeEarned, roomsCleared = 0 }) {
    this.runs++;
    this.totalKills += kills;
    this.bestFloor = Math.max(this.bestFloor, floor);

    const payout = Math.round(
      computeEarned +          // loot dos inimigos abatidos
      kills * 12 +             // bonus por abate
      roomsCleared * 20 +      // bonus por sala limpa
      floor * 40               // bonus por andar alcancado
    );
    this.compute += payout;
    this.save();
    return payout;
  }

  reset() {
    this.compute = 0;
    this.levels = {};
    this.bestFloor = 1;
    this.totalKills = 0;
    this.runs = 0;
    this.save();
  }
}
