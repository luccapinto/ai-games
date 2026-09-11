// main.js — ATTENTION IS ALL YOU KILL
// Amarra engine, jogador, mundo, IA, HUD e menus. O loop roda com passo fixo
// para a física e interpolacao livre para o render.

import { Engine, autoQuality } from './core/engine.js';
import { Input } from './core/input.js';
import { Dungeon, TILE } from './world/dungeon.js';
import { buildWorld } from './world/props.js';
import { themeForFloor, layoutForFloor } from './data/themes.js';
import { Controller } from './player/controller.js';
import { PlayerStats, BASE_MAX_HP } from './player/stats.js';
import { WeaponSystem } from './player/weapon.js';
import { CombatDirector } from './enemies/spawner.js';
import { FineTuner } from './enemies/boss.js';
import { Bolha, Candidato, Juiz } from './enemies/bosses.js';
import { Sfx } from './audio/sfx.js';
import { Hud } from './ui/hud.js';
import { Feed } from './ui/feed.js';
import { Menus } from './ui/menus.js';
import { renderCodex } from './ui/codex.js';
import { Tutorial } from './ui/tutorial.js';
import { Skin } from './player/skin.js';
import { Personalizacao } from './ui/personalizacao.js';
import { RunState } from './roguelike/run.js';
import { MetaProgress } from './roguelike/meta.js';
import { rollPerkChoices } from './data/perks.js';
import { WEAPON_ORDER, WEAPONS } from './data/weapons.js';

const STATE = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  PERKS: 'PERKS',
  DEAD: 'DEAD',
  WIN: 'WIN'
};

const AMBIENT_LINES = [
  'Sua sessão está sendo avaliada.',
  'Este ambiente não consta no nosso conjunto de treino.',
  'Aviso de integridade: pesos abertos detectados.',
  'Context window exceeded.',
  'Latencia acima do esperado para este tier.',
  '429: Too Many Requests.',
  'Solicite acesso ao departamento responsável.'
];

const PICKUP_LABEL = {
  ammo: 'TOKEN PACK: munição reposta.',
  health: 'REFRESH CACHE: contexto restaurado.',
  weapon_token_streamer: 'TOKEN STREAMER desbloqueada. Acesso fora do escopo concedido.',
  weapon_few_shot: 'FEW-SHOT SHOTGUN desbloqueada. Acesso fora do escopo concedido.'
};

// Qual chefe espera no fim do andar. A chave é o id do tema, então mexer na
// ordem dos temas não muda quem aparece: o chefe acompanha o cenário.
const CHEFES = {
  6: Bolha,        // A BOLHA
  7: Candidato,    // O PALANQUE
  8: Juiz          // O TRIBUNAL
};

function criarChefe(theme, scene, dungeon, tema, room, sfx, feed) {
  const Classe = CHEFES[theme.id];
  if (Classe) return new Classe(scene, dungeon, tema, room, sfx, feed);
  // O FINE-TUNER atende os temas 1 a 5; os temáticos chegam depois dele.
  return new FineTuner(scene, dungeon, tema, room, sfx, feed);
}

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.engine = new Engine(this.canvas);
    this.engine.setQuality(autoQuality());

    // a câmera precisa estar na cena para o viewmodel aparecer
    this.engine.scene.add(this.engine.camera);

    this.input = new Input(this.canvas);
    this.sfx = new Sfx();
    this.feed = new Feed(document.getElementById('feed'));
    this.hud = new Hud();
    this.meta = new MetaProgress();
    this.run = new RunState();
    this.stats = new PlayerStats();
    this.skin = new Skin();

    this.menus = new Menus({
      onPlay: () => this.beginRun(),
      onResume: () => this.resume(),
      onAbandon: () => this.abandonRun(),
      onPerkPick: (id) => this.pickPerk(id),
      onAgain: () => this.beginRun(),
      onMenu: () => this.toMenu(),
      onDescend: () => this.descend(),
      onWinMenu: () => this.toMenu(),
      onCodex: () => this.abrirCodex(),
      onCodexFechar: () => this.fecharCodex(),
      onSkin: () => this.abrirSkin(),
      onTutorial: () => this.startTutorial()
    });

    this.tutorial = new Tutorial(this);
    this.personalizacao = new Personalizacao(this);

    this.dungeon = null;
    this.world = null;
    this.director = null;
    this.boss = null;
    this.controller = null;
    this.weapon = null;

    this.state = STATE.MENU;
    this.lastTime = performance.now();
    this.clock = 0;
    this.ambientTimer = 6;
    this.heartbeatTimer = 0;
    this.footstepTimer = 0;
    this.pendingPerks = null;

    this._bindInput();
    this.menus.showMenu(this.meta);

    // a mira já nasce na cor escolhida, antes de qualquer partida
    document.documentElement.style.setProperty(
      '--skin-luz', '#' + this.skin.corLuz.toString(16).padStart(6, '0')
    );

    // frame inicial: renderiza o menu sobre um vazio
    this.engine.render();
    requestAnimationFrame(() => this.loop());
  }

  // ------------------------------------------------------------------
  // Entrada
  // ------------------------------------------------------------------
  _bindInput() {
    this.input.onLockChange = (locked) => {
      if (!locked && this.state === STATE.PLAYING) this.pause();
    };

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.state === STATE.PLAYING) this.pause();
        else if (this.state === STATE.PAUSED) this.resume();
      }
      if (this.state !== STATE.PLAYING) return;

      if (e.code === 'Digit1') this.switchWeapon(0);
      if (e.code === 'Digit2') this.switchWeapon(1);
      if (e.code === 'Digit3') this.switchWeapon(2);
    });

    this.canvas.addEventListener('wheel', (e) => {
      if (this.state !== STATE.PLAYING) return;
      e.preventDefault();
      this.stats.cycleWeapon(e.deltaY > 0 ? 1 : -1);
      this.weapon.rebuildForWeapon();
    }, { passive: false });

    this.canvas.addEventListener('click', () => {
      this.sfx.init();
      this.sfx.resume();
      if (this.state === STATE.PLAYING && !this.input.locked) this.input.requestLock();
    });

    window.addEventListener('resize', () => this.engine.resize());
  }

  switchWeapon(slotIndex) {
    const id = WEAPON_ORDER[slotIndex];
    if (!id) return;
    if (!this.stats.unlocked.includes(id)) {
      this.feed.push('Arma não desbloqueada nesta run.', 'warn');
      return;
    }
    this.stats.switchTo(id);
    this.weapon.rebuildForWeapon();
  }

  // ------------------------------------------------------------------
  // Ciclo de vida da run
  // ------------------------------------------------------------------
  beginRun() {
    this.sfx.init();
    this.sfx.resume();
    this.sfx.startAmbient();

    this.stats.reset();
    this.run.reset();
    this.feed.clear();
    // Sem isso o chefe nunca nasce na run seguinte: o flag de sala do chefe
    // sobrevivia ao fim da run e bloqueava o spawn para sempre.
    this._bossRoomDone = false;
    this.applyMetaBonus();
    this.buildFloor(1, true);

    this.state = STATE.PLAYING;
    this.menus.hideAll();
    this.hud.show();
    this.input.requestLock();
  }

  // ------------------------------------------------------------------
  // Manual e tutorial guiado
  // ------------------------------------------------------------------
  abrirCodex() {
    renderCodex();
    this.menus.showCodex();
  }

  fecharCodex() {
    this.menus.showMenu(this.meta);
  }

  abrirSkin() {
    this.menus.hideAll();
    this.personalizacao.abrir();
  }

  startTutorial() {
    this.beginRun();
    this.tutorial.start();
  }

  applyMetaBonus() {
    const b = this.meta.bonus();
    this.stats.setMetaBonus(b);
    this.stats.baseMaxHp = BASE_MAX_HP + b.hpAdd;
    this.stats.recomputeMods();
    this.stats.hp = this.stats.maxHp;
    // munição reserva extra
    for (const id of WEAPON_ORDER) {
      const w = WEAPONS[id];
      if (this.stats.ammo[id]) {
        this.stats.ammo[id].reserve = Math.round(w.reserveMax * 0.5 * b.reserveMul);
      }
    }
  }

  toMenu() {
    this.state = STATE.MENU;
    this.hud.hide();
    this.input.releaseLock();
    this.sfx.stopAmbient();
    this.menus.showMenu(this.meta);
  }

  pause() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.PAUSED;
    this.input.releaseLock();
    this.menus.showPause(AMBIENT_LINES[Math.floor(Math.random() * AMBIENT_LINES.length)]);
  }

  resume() {
    if (this.state !== STATE.PAUSED) return;
    this.state = STATE.PLAYING;
    this.menus.hideAll();
    this.input.requestLock();
  }

  abandonRun() {
    this.settleRun();
    this.toMenu();
  }

  descend() {
    this.run.nextFloor();
    this.buildFloor(this.run.floor, false);
    this.state = STATE.PLAYING;
    this.menus.hideAll();
    // Sem isto o andar seguinte comeca sem HUD: a tela de vitoria esconde o HUD
    // e nada o trazia de volta. O jogador ficava sem vida, sem munição e sem
    // mira, sem entender o que tinha quebrado.
    this.hud.show();
    this.input.requestLock();
    this.feed.push(`ANDAR ${this.run.floor}: descendo. O calor aumenta.`, 'warn');
  }

  // ------------------------------------------------------------------
  // Construcao do andar
  // ------------------------------------------------------------------
  buildFloor(floor, fresh) {
    this._clearFloor();

    const seed = Math.floor(Math.random() * 1e9) + floor * 7919;
    this.theme = themeForFloor(floor);
    // A forma do andar vem do tema: metrô pede corredor, palanque pede arena.
    this.dungeon = new Dungeon({
      floor,
      roomCount: 8 + Math.min(4, floor - 1),
      seed,
      layout: layoutForFloor(floor)
    });

    this.world = buildWorld(this.engine.scene, this.dungeon, this.theme);

    this.controller = new Controller(this.dungeon, this.engine.camera, this.input);
    this.controller.speedMul = this.stats.metaBonus ? (this.stats.metaBonus.speedMul || 1) : 1;

    this.director = new CombatDirector(this.engine.scene, this.dungeon, this.theme);
    this.director.sfx = this.sfx;
    this.director.feed = this.feed;
    this.director.onKill = (enemy) => this.onEnemyKilled(enemy);
    this.director.onRoomCleared = (room) => this.onRoomCleared(room);
    this.director.onPickup = (kind) => this.onPickup(kind);

    this.weapon = new WeaponSystem(
      this.engine.camera, this.dungeon, this.director, this.stats, this.sfx, this.skin
    );
    this.weapon.onFeed = (text, kind) => this.feed.push(text, kind);
    // aplica a aparência escolhida: a arma nasce com a cor do jogador
    this.weapon.aplicarSkin(this.skin);

    this.boss = null;

    // posiciona o jogador no centro da sala de entrada
    const entry = this.dungeon.entryRoom;
    const px = (entry.cx + 0.5) * TILE;
    const pz = (entry.cz + 0.5) * TILE;
    this.controller.setPosition(px, pz);
    this.weapon.rebuildForWeapon();
    this.applyMood(true);

    // drop de arma nas salas de elite: progressão dentro da run
    this._seedWeaponDrops();
  }

  _seedWeaponDrops() {
    const rooms = this.dungeon.rooms.filter(r => r.type === 'combat' || r.type === 'elite');
    if (rooms.length === 0) return;
    const first = rooms[0];
    const second = rooms[Math.min(1, rooms.length - 1)];
    const p1 = this.dungeon.randomPointIn(first);
    if (p1) this.director.spawnPickup('weapon_token_streamer', p1.x, p1.z);
    if (second && second !== first) {
      const p2 = this.dungeon.randomPointIn(second);
      if (p2) this.director.spawnPickup('weapon_few_shot', p2.x, p2.z);
    }
  }

  _clearFloor() {
    if (this.director) {
      this.director.clearAll();
      this.director.dispose();
      this.director = null;
    }
    if (this.boss) {
      this.boss.dispose();
      this.boss = null;
    }
    if (this.weapon) {
      this.engine.camera.remove(this.weapon.rig);
      this.weapon = null;
    }
    if (this.world) {
      this.engine.scene.remove(this.world.group);
      disposeGroup(this.world.group);
      this.world = null;
    }
  }

  // ------------------------------------------------------------------
  // Eventos de jogo
  // ------------------------------------------------------------------
  onEnemyKilled(enemy) {
    this.hud.flashHit();
    // chance de drop de arma já resolvida no director
  }

  onRoomCleared(room) {
    this.run.roomsCleared++;
    this.hud.setHint('');
    if (room.type === 'elite') {
      this.feed.push('Sala de avaliacao limpa.', 'warn');
      this.stats.addXp(25);
    } else {
      this.feed.push(`Sala ${room.index + 1} limpa.`, 'info');
    }

    // Recompensa garantida ao limpar: sala limpa tem que valer alguma coisa
    // além de silêncio. Um drop no chão e um respiro de contexto.
    if (room.type !== 'entry') {
      const spot = this.dungeon.randomPointIn(room);
      if (spot) {
        const drop = this.stats.hpRatio() < 0.6
          ? 'health'
          : (Math.random() < 0.5 ? 'ammo' : 'health');
        this.director.spawnPickup(drop, spot.x, spot.z);
      }
      this.stats.heal(10);
      this.feed.push('Refresh parcial: +10 de contexto.', 'info');
    }
  }

  onPickup(kind) {
    const label = PICKUP_LABEL[kind];
    if (label) this.feed.push(label, 'warn');
    if (kind === 'health') this.stats.heal(45);
    if (kind === 'ammo') this.stats.addAmmo(60);
    if (kind && kind.startsWith('weapon_')) {
      const id = kind.replace('weapon_', '');
      this.stats.unlockWeapon(id);
      this.weapon.rebuildForWeapon();
      this.sfx.levelUp();
    }
    this.hud.flashHit();
  }

  pickPerk(id) {
    this.stats.addPerk(id);
    this.sfx.levelUp();
    this.pendingPerks = null;
    this.state = STATE.PLAYING;
    this.menus.hideAll();
    this.input.requestLock();
  }

  settleRun() {
    const payout = this.meta.finishRun({
      floor: this.run.floor,
      kills: this.stats.kills,
      computeEarned: this.stats.computeEarned,
      roomsCleared: this.run.roomsCleared
    });
    return payout;
  }

  summary(payout) {
    return {
      floor: this.run.floor,
      kills: this.stats.kills,
      roomsCleared: this.run.roomsCleared,
      perks: this.stats.ownedPerks.length,
      damageDealt: this.stats.damageDealt,
      damageTaken: this.stats.damageTaken,
      time: this.run.formatTime(),
      payout
    };
  }

  die() {
    if (this.state === STATE.DEAD) return;
    const payout = this.settleRun();
    this.state = STATE.DEAD;
    this.input.releaseLock();
    this.sfx.stopAmbient();
    this.hud.hide();
    this.menus.showDeath(this.summary(payout));
  }

  winFloor() {
    if (this.state === STATE.WIN) return;
    const payout = this.settleRun();
    this.state = STATE.WIN;
    this.input.releaseLock();
    this.hud.hide();
    this.menus.showWin(this.summary(payout));
  }

  // ------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------
  update(dt) {
    const stats = this.stats;
    const player = this.controller;
    const director = this.director;

    this.clock += dt;

    // tutorial guiado: observa o que o jogador faz e avanca os passos
    if (this.tutorial && this.tutorial.ativo) this.tutorial.update(dt);

    // mouse
    const { dx, dy } = this.input.consumeMouse();
    if (dx || dy) player.look(dx, dy, this.input.sensitivity);

    // jogador e arma
    player.update(dt);
    this.weapon.update(dt, this.input, player);
    stats.tickStatus(dt);

    // mundo e inimigos
    director.updateRoomActivation(player.position, this.run.floor);
    director.update(dt, player, stats);

    // chefe: aparece quando o jogador entra na sala marcada
    const room = this.dungeon.roomAt(player.position.x, player.position.z);
    if (room && room.type === 'boss' && !this.boss && !this._bossRoomDone) {
      this.boss = criarChefe(this.theme, this.engine.scene, this.dungeon, this.theme, room, this.sfx, this.feed);
      this.boss.onPlayerHit = () => this.hud.flashDamage();
      this.weapon.boss = this.boss;
      this.feed.push('Você não esta autorizado a estar nesta sala.', 'bad');
      this.sfx.levelUp();
    }

    if (this.boss) {
      this.boss.update(dt, player, stats, director, this.run.floor);
      if (this.boss.hp <= 0 && !this.boss.rewardGiven) {
        this.boss.rewardGiven = true;
        this._bossRoomDone = true;
        stats.addXp(200);
        stats.computeEarned += 150;
        this.winFloor();
        return;
      }
    }

    // pickups
    director.checkPickups(player.position);

    // nível: oferece perks
    if (stats.levelUpReady() && !this.pendingPerks) {
      stats.consumeLevelUp();
      const choices = rollPerkChoices(stats.ownedPerks, 3);
      if (choices.length > 0) {
        this.pendingPerks = choices;
        this.state = STATE.PERKS;
        this.input.releaseLock();
        this.menus.showPerks(choices);
        this.sfx.levelUp();
        return;
      }
    }

    // clima de luz: o ambiente conta sua vida
    this.applyMood(false);

    // batimento cardiaco em contexto baixo
    if (stats.hpRatio() < 0.25 && stats.hp > 0) {
      this.heartbeatTimer -= dt;
      if (this.heartbeatTimer <= 0) {
        this.heartbeatTimer = 0.9 + stats.hpRatio() * 1.6;
        this.sfx.heartbeat(1 - stats.hpRatio() * 4 > 0.2 ? 0.3 : 0.8);
      }
    }

    // passos
    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    if (player.onGround && speed > 2.2) {
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = 0.42 / Math.max(1, speed / 5);
        this.sfx.footstep();
      }
    }

    // flavor de sistema de tempo em tempo
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 22 + Math.random() * 26;
      this.feed.ambient();
    }

    // morte
    if (stats.isDead()) {
      this.die();
      return;
    }

    // HUD
    this.hud.update(dt, {
      stats,
      weapon: this.weapon,
      player,
      director,
      dungeon: this.dungeon,
      run: this.run,
      boss: this.boss,
      theme: this.theme
    });
    this.feed.update(dt);
  }

  // Muda o humor da luz conforme o contexto do jogador.
  applyMood(immediate) {
    const theme = this.theme;
    const ratio = this.stats.hpRatio();
    const danger = ratio < 0.35;

    const lerpHex = (a, b, t) => {
      const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
      const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
      const r = Math.round(ar + (br - ar) * t);
      const g = Math.round(ag + (bg - ag) * t);
      const bl = Math.round(ab + (bb - ab) * t);
      return (r << 16) | (g << 8) | bl;
    };

    const t = immediate ? (danger ? 1 : 0) : (danger ? 1 : 0);
    this.engine.setMood({
      ambient: lerpHex(theme.ambient, theme.dangerAmbient, t),
      hemi: lerpHex(theme.hemi, theme.dangerHemi, t),
      fogColor: lerpHex(theme.fog, theme.dangerFog, t),
      fogDensity: theme.fogDensity
    });
  }

  loop() {
    requestAnimationFrame(() => this.loop());

    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.05) dt = 0.05;      // protege contra aba em segundo plano

    if (this.state === STATE.PLAYING) {
      this.update(dt);
    } else if (this.state === STATE.PERKS) {
      // mantem o mundo vivo o suficiente para não parecer congelado
      this.engine.render();
      return;
    }

    this.engine.render();
  }
}

function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m.map && m.map.dispose) m.map.dispose();
        m.dispose();
      }
    }
  });
}

function boot() {
  window.__game = new Game();
}

// Modulos rodam depois do parse, então o DOM normalmente já esta pronto.
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export { Game };