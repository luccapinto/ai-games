// menus.js — telas de título, pausa, escolha de perk, morte e vitoria.

import { META_UPGRADES } from '../roguelike/meta.js';

const $ = (id) => document.getElementById(id);

export class Menus {
  constructor(handlers = {}) {
    this.handlers = handlers;

    this.menuEl = $('menu');
    this.pauseEl = $('pause');
    this.perksEl = $('perks');
    this.deathEl = $('death');
    this.winEl = $('win');
    this.codexEl = $('codex');
    this.skinEl = $('skin');

    this.perkOptions = $('perk-options');
    this.metaCompute = $('meta-compute');
    this.metaUpgrades = $('meta-upgrades');
    this.deathStats = $('death-stats');
    this.winStats = $('win-stats');
    this.pauseSub = $('pause-sub');

    this.screens = [this.menuEl, this.pauseEl, this.perksEl, this.deathEl, this.winEl, this.codexEl, this.skinEl];

    $('btn-play').addEventListener('click', () => handlers.onPlay && handlers.onPlay());
    $('btn-resume').addEventListener('click', () => handlers.onResume && handlers.onResume());
    $('btn-abandon').addEventListener('click', () => handlers.onAbandon && handlers.onAbandon());
    $('btn-again').addEventListener('click', () => handlers.onAgain && handlers.onAgain());
    $('btn-menu').addEventListener('click', () => handlers.onMenu && handlers.onMenu());
    $('btn-descend').addEventListener('click', () => handlers.onDescend && handlers.onDescend());
    $('btn-win-menu').addEventListener('click', () => handlers.onWinMenu && handlers.onWinMenu());
    $('btn-codex').addEventListener('click', () => handlers.onCodex && handlers.onCodex());
    $('btn-skin').addEventListener('click', () => handlers.onSkin && handlers.onSkin());
    $('btn-tutorial').addEventListener('click', () => handlers.onTutorial && handlers.onTutorial());
    $('btn-codex-fechar').addEventListener('click', () => handlers.onCodexFechar && handlers.onCodexFechar());
  }

  showCodex() {
    this.hideAll();
    this.codexEl.classList.remove('hidden');
  }

  hideAll() {
    for (const el of this.screens) el.classList.add('hidden');
  }

  anyOpen() {
    return this.screens.some(el => !el.classList.contains('hidden'));
  }

  // ------------------------------------------------------------------
  showMenu(meta) {
    this.hideAll();
    this.renderMeta(meta);
    this.menuEl.classList.remove('hidden');
  }

  renderMeta(meta) {
    this.metaCompute.textContent = `${meta.compute}`;
    this.metaUpgrades.innerHTML = '';

    for (const def of META_UPGRADES) {
      const lvl = meta.levelOf(def.id);
      const maxed = lvl >= def.max;
      const canBuy = meta.canBuy(def);

      const row = document.createElement('div');
      row.className = 'meta-up' + (maxed ? ' bought' : canBuy ? '' : ' cant');

      const left = document.createElement('div');
      left.innerHTML = `<b>${def.name}</b> <span style="color:var(--muted)">${lvl}/${def.max}</span>`;

      const right = document.createElement('div');
      right.className = 'cost';
      right.textContent = maxed ? 'COMPLETO' : `${meta.costOf(def)} COMPUTE`;

      row.appendChild(left);
      row.appendChild(right);

      if (!maxed && canBuy) {
        row.addEventListener('click', () => {
          if (meta.buy(def)) this.renderMeta(meta);
        });
      }
      row.title = def.desc;
      this.metaUpgrades.appendChild(row);
    }
  }

  // ------------------------------------------------------------------
  showPause(subtitle) {
    this.hideAll();
    if (subtitle) this.pauseSub.textContent = subtitle;
    this.pauseEl.classList.remove('hidden');
  }

  // ------------------------------------------------------------------
  showPerks(perks) {
    this.hideAll();
    this.perkOptions.innerHTML = '';

    for (const perk of perks) {
      const card = document.createElement('div');
      card.className = 'perk-card'
        + (perk.rarity === 'rare' ? ' rare' : perk.rarity === 'legend' ? ' legend' : '');

      const name = document.createElement('div');
      name.className = 'p-name';
      name.textContent = perk.name;

      const desc = document.createElement('div');
      desc.className = 'p-desc';
      desc.textContent = perk.desc;

      const rar = document.createElement('div');
      rar.className = 'p-rar';
      rar.textContent = perk.rarity === 'rare' ? 'RARO' : perk.rarity === 'legend' ? 'LENDARIO' : 'COMUM';

      card.appendChild(name);
      card.appendChild(desc);
      card.appendChild(rar);

      card.addEventListener('click', () => {
        if (this.handlers.onPerkPick) this.handlers.onPerkPick(perk.id);
      });

      this.perkOptions.appendChild(card);
    }

    this.perksEl.classList.remove('hidden');
  }

  // ------------------------------------------------------------------
  showDeath(summary) {
    this.hideAll();
    this.deathStats.innerHTML = this._statsMarkup(summary);
    this.deathEl.classList.remove('hidden');
  }

  showWin(summary) {
    this.hideAll();
    this.winStats.innerHTML = this._statsMarkup(summary);
    this.winEl.classList.remove('hidden');
  }

  _statsMarkup(s) {
    const rows = [
      ['ANDAR ALCANCADO', s.floor],
      ['ABATES', s.kills],
      ['SALAS LIMPAS', s.roomsCleared],
      ['PERKS', s.perks],
      ['DANO CAUSADO', Math.round(s.damageDealt)],
      ['DANO RECEBIDO', Math.round(s.damageTaken)],
      ['TEMPO', s.time],
      ['COMPUTE GANHO', `+${s.payout}`]
    ];
    return rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
  }
}

export { $ };