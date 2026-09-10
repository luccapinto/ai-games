// run.js — estado da run e escalonamento de dificuldade entre andares.

export class RunState {
  constructor() {
    this.reset();
  }

  reset() {
    this.floor = 1;
    this.roomsCleared = 0;
    this.kills = 0;
    this.compute = 0;
    this.startedAt = performance.now();
    this.bossDefeated = 0;
    this.deaths = 0;
  }

  // Cada andar abaixo e mais hostil. Multiplicadores limpos e previsiveis.
  hpMul() { return Math.pow(1.28, this.floor - 1); }
  damageMul() { return Math.pow(1.16, this.floor - 1); }
  spawnMul() { return 1 + (this.floor - 1) * 0.25; }

  addCompute(amount) {
    this.compute += Math.max(0, Math.round(amount));
  }

  nextFloor() {
    this.floor++;
    this.bossDefeated++;
  }

  elapsedSeconds() {
    return (performance.now() - this.startedAt) / 1000;
  }

  formatTime() {
    const s = Math.floor(this.elapsedSeconds());
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
}
