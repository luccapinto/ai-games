// bossbase.js — o que todo chefe tem em comum.
//
// A luta de chefe neste jogo tem um formato só, e vale repetir ele em vez de
// repetir código: o corpo fica BLINDADO enquanto as âncoras existem. O jogador
// destrói as âncoras, o corpo abre uma JANELA de dano, e a janela fecha. Três
// fases, cada uma com mais âncoras e ataques mais rápidos.
//
// O que muda de um chefe para o outro é a aparência, o que as âncoras
// representam e quais ataques ele usa. Isso fica na subclasse, que implementa
// _build() e _escolherAtaque(). O resto mora aqui.
//
// Isso importa porque o weapon.js faz o hitscan contra a lista de âncoras e
// contra o corpo: se a base muda a forma como expõe isso, os chefes todos
// quebram juntos em vez de um de cada vez.

import * as THREE from '../../vendor/three.module.js';
import { glowTexture, blobShadowTexture } from '../world/textures.js';
import { TILE } from '../world/dungeon.js';

export const ESTADO = {
  IDLE: 'IDLE',
  ANCORAS: 'ANCORAS',
  VULNERAVEL: 'VULNERAVEL',
  MORRENDO: 'MORRENDO',
  MORTO: 'MORTO'
};

export class Chefe {
  constructor(scene, dungeon, theme, room, sfx, feed, cfg = {}) {
    this.scene = scene;
    this.dungeon = dungeon;
    this.theme = theme;
    this.room = room;
    this.sfx = sfx;
    this.feed = feed;

    this.nome = cfg.nome || 'CHEFE';
    this.maxHp = cfg.maxHp || 420;
    this.hp = this.maxHp;
    this.fase = 1;
    this.maxFases = cfg.maxFases || 3;
    this.estado = ESTADO.IDLE;
    this.alive = true;

    // Geometria do corpo. O weapon.js lê isto para saber onde acertar: um chefe
    // alto e magro e uma bola larga não podem compartilhar a mesma esfera.
    this.alturaCorpo = cfg.alturaCorpo ?? 4.4;
    this.raioCorpo = cfg.raioCorpo ?? 3.0;
    this.alturaAncora = cfg.alturaAncora ?? 2.1;
    this.raioAncora = cfg.raioAncora ?? 1.15;
    this.ancorasPorFase = cfg.ancorasPorFase || [4, 3, 2];
    this.hpAncora = cfg.hpAncora || 38;

    // Quanto tempo a janela de dano fica aberta. A última fase abre mais, para
    // a luta não terminar em corrida contra o relógio.
    this.janelaPorFase = cfg.janelaPorFase || [9, 11, 14];

    this.corBlindado = cfg.corBlindado ?? 0x35f0d8;
    this.corAberto = cfg.corAberto ?? 0xffe066;
    this.corAncora = cfg.corAncora ?? 0xff3b30;

    this.armorFlash = 0;
    this._avisoBlindadoEm = 0;

    this.ancoras = [];
    this.timerAtaque = cfg.delayPrimeiroAtaque ?? 2.5;

    this.center = new THREE.Vector3(
      (room.cx + 0.5) * TILE, 0, (room.cz + 0.5) * TILE
    );

    this.group = new THREE.Group();
    this.group.position.copy(this.center);
    this.scene.add(this.group);

    this._build();
  }

  get isVulnerable() { return this.estado === ESTADO.VULNERAVEL; }
  get vivo() { return this.alive; }
  get blindado() { return this.estado === ESTADO.ANCORAS || this.estado === ESTADO.IDLE; }
  get nomeDoEstado() { return this.estado; }

  // ------------------------------------------------------------------
  // Ganchos da subclasse
  // ------------------------------------------------------------------
  _build() { throw new Error('chefe precisa montar o proprio corpo'); }

  // Escolhe o próximo ataque. A subclasse decide; a base só cronometra.
  _escolherAtaque() {}

  // Chamado quando a janela abre, para a subclasse reagir (mudar cor, falar).
  _aoAbrir() {}

  // Chamado quando uma âncora cai.
  _aoDestruirAncora() {}

  // Movimento e idle próprio de cada chefe (flutuar, tremer, girar).
  _animar() {}

  // ------------------------------------------------------------------
  // Âncoras
  // ------------------------------------------------------------------
  _visualAncora(x, z) {
    const group = new THREE.Group();
    group.position.set(x, this.alturaAncora, z);

    const mat = new THREE.MeshBasicMaterial({ color: this.corAncora });
    const node = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), mat);
    group.add(node);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.06, 6, 18),
      new THREE.MeshBasicMaterial({ color: 0xff8866 })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(this.corAncora), color: this.corAncora,
      transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    halo.scale.set(3.0, 3.0, 1);
    group.add(halo);

    return { group, node, ring, halo, mat };
  }

  _montarAncoras(quantidade) {
    this._limparAncoras();
    if (quantidade <= 0) return;

    const raioMax = Math.min(this.room.x2 - this.room.x1, this.room.z2 - this.room.z1) * TILE * 0.32;

    for (let i = 0; i < quantidade; i++) {
      const angulo = (i / quantidade) * Math.PI * 2 + Math.PI / 4;
      let x = this.center.x;
      let z = this.center.z;
      let achou = false;

      // A posição de partida é geométrica, então pode cair dentro de um rack ou
      // fora da sala. Âncora inalcançável trava a luta para sempre: o corpo
      // nunca abre e parece que o chefe não toma dano. Por isso testamos o tile
      // antes de aceitar, e varremos em espiral até achar espaço.
      for (let tentativa = 0; tentativa < 28 && !achou; tentativa++) {
        const a = angulo + tentativa * 0.31;
        const raio = raioMax * (1 - 0.11 * Math.floor(tentativa / 12));
        const cx = this.center.x + Math.cos(a) * raio;
        const cz = this.center.z + Math.sin(a) * raio;
        const t = this.dungeon.worldToTile(cx, cz);
        if (this.dungeon.isSolid(t.tx, t.tz)) continue;

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

      const visual = this._visualAncora(x, z);
      this.scene.add(visual.group);
      this.ancoras.push({
        ...visual,
        hp: this.hpAncora,
        maxHp: this.hpAncora,
        x, z,
        giro: Math.random() * 6.28,
        alive: true
      });
    }

    // Sala apertada pode não ter espaço para nenhuma âncora, e sem âncora o
    // corpo nunca abre: o chefe fica blindado para sempre e a luta trava. Isso
    // aconteceu de verdade no labirinto, onde a sala é pequena. Se ninguém
    // ficou de pé, a janela abre direto — o problema é de geometria, não do
    // jogador, então ele não pode pagar por isso.
    if (this.ancoras.length === 0) {
      this._abrirJanela();
    }
  }

  _limparAncoras() {
    for (const a of this.ancoras) this.scene.remove(a.group);
    this.ancoras.length = 0;
  }

  // O sistema de tiro pergunta por boss.anchors; a lista aqui se chama ancoras.
  get anchors() { return this.ancoras; }

  aliveAnchors() { return this.ancoras.filter(a => a.alive); }

  _abrirJanela() {
    this.estado = ESTADO.VULNERAVEL;
    const i = Math.min(this.fase - 1, this.janelaPorFase.length - 1);
    this.janelaTimer = this.janelaPorFase[i];
    this._aoAbrir();
    if (this.feed) this.feed.push(`${this.nome}: janela aberta, corpo exposto`, 'warn');
    if (this.sfx) this.sfx.levelUp();
  }

  // ------------------------------------------------------------------
  // Dano
  // ------------------------------------------------------------------
  // O alvo chega explícito do hitscan: a âncora atingida, ou null para o corpo.
  // Detecção por proximidade do ponto de impacto se mostrou frágil quando o
  // jogador fica embaixo do chefe.
  applyDamage(amount, point, anchor = null) {
    if (!this.alive) return false;

    if (anchor && anchor.alive) {
      anchor.hp -= amount;
      if (anchor.mat) {
        anchor.mat.color.setHex(0xffffff);
        setTimeout(() => { if (anchor.mat) anchor.mat.color.setHex(this.corAncora); }, 60);
      }
      if (anchor.hp <= 0) this._destruirAncora(anchor);
      return false;
    }

    if (this.estado !== ESTADO.VULNERAVEL) {
      this.armorFlash = 0.14;
      // Avisa no máximo a cada 2 segundos, senão vira spam no feed.
      if (this.feed && this._avisoBlindadoEm <= 0) {
        this.feed.push(`${this.nome}: BLINDADO — destrua as âncoras`, 'warn');
        this._avisoBlindadoEm = 2;
      }
      return false;
    }

    this.hp -= amount;
    this.armorFlash = 0.1;

    if (this.hp <= 0) {
      this.hp = 0;
      this._morrer();
      return true;
    }
    return false;
  }

  _destruirAncora(ancora) {
    ancora.alive = false;
    this.scene.remove(ancora.group);
    if (this.sfx) this.sfx.enemyDeath({ tier: 3 });
    this._aoDestruirAncora(ancora);

    if (this.aliveAnchors().length === 0) this._abrirJanela();
  }

  _morrer() {
    this.alive = false;
    this.estado = ESTADO.MORRENDO;
    this._limparAncoras();
    this._limparTelegrafos();
    if (this.sfx) this.sfx.enemyDeath({ tier: 4 });
  }

  // A subclasse guarda os avisos visuais que cria; a base limpa todos.
  _limparTelegrafos() {
    for (const t of (this._telegrafos || [])) {
      if (t.parent) this.scene.remove(t);
    }
    this._telegrafos = [];
  }

  // Registra um aviso no chão para remover depois (anel, setor, etc).
  _registrarTelegrafo(obj) {
    this._telegrafos = this._telegrafos || [];
    this._telegrafos.push(obj);
    return obj;
  }

  _esquecerTelegrafo(obj) {
    if (!this._telegrafos) return;
    const i = this._telegrafos.indexOf(obj);
    if (i >= 0) this._telegrafos.splice(i, 1);
  }

  // ------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------
  update(dt, player, stats, director, floor) {
    if (!this.alive) return;

    this.armorFlash = Math.max(0, this.armorFlash - dt);
    this._avisoBlindadoEm = Math.max(0, this._avisoBlindadoEm - dt);
    this._animar(dt, player);

    for (const a of this.ancoras) {
      if (!a.alive) continue;
      a.giro += dt * 1.2;
      a.node.rotation.y = a.giro;
      a.node.rotation.x = a.giro * 0.7;
      a.ring.rotation.z = a.giro * 0.5;
      a.group.position.y = this.alturaAncora + Math.sin(a.giro * 1.3) * 0.25;
    }

    if (this.estado === ESTADO.IDLE) {
      this.estado = ESTADO.ANCORAS;
      const n = this.ancorasPorFase[0] ?? 4;
      this._montarAncoras(n);
      this._aoEntrarNaFase(director, floor);
      return;
    }

    if (this.estado === ESTADO.VULNERAVEL) {
      this.janelaTimer -= dt;
      if (this.janelaTimer <= 0) this._proximaFase(director, floor);
      return;
    }

    if (this.estado !== ESTADO.ANCORAS) return;

    this.timerAtaque -= dt;
    if (this.timerAtaque <= 0) this._escolherAtaque(player, director, floor);
  }

  // Fala e efeitos na entrada de cada fase.
  _aoEntrarNaFase(director, floor) {
    if (this.feed) this.feed.push(`${this.nome} entra na luta: fase ${this.fase}`, 'bad');
  }

  _proximaFase(director, floor) {
    if (this.fase >= this.maxFases) {
      // Sem mais fases: reabre as âncoras na quantidade da última.
      const n = this.ancorasPorFase[this.ancorasPorFase.length - 1] ?? 2;
      this.estado = ESTADO.ANCORAS;
      this._montarAncoras(n);
      if (this.feed) this.feed.push(`${this.nome}: nova leva de âncoras`, 'bad');
      return;
    }

    this.fase++;
    this.estado = ESTADO.ANCORAS;
    const n = this.ancorasPorFase[Math.min(this.fase - 1, this.ancorasPorFase.length - 1)] ?? 2;
    this._montarAncoras(n);
    this._aoEntrarNaFase(director, floor);
  }

  // Multiplicador de agressividade por fase: a base usa, a subclasse pode usar.
  get agressividade() { return 1 + (this.fase - 1) * 0.25; }

  // ------------------------------------------------------------------
  // Hitbox e limpeza
  // ------------------------------------------------------------------
  boundsCheck(point) {
    if (!this.alive) return false;
    const d = Math.hypot(point.x - this.group.position.x, point.z - this.group.position.z);
    return d < this.raioCorpo && point.y > this.group.position.y + this.alturaCorpo - 2.0
      && point.y < this.group.position.y + this.alturaCorpo + 1.8;
  }

  _sombra(largura, profundidade) {
    const s = new THREE.Mesh(
      new THREE.PlaneGeometry(largura, profundidade),
      new THREE.MeshBasicMaterial({
        map: blobShadowTexture(), transparent: true, opacity: 0.55, depthWrite: false
      })
    );
    s.rotation.x = -Math.PI / 2;
    s.position.y = 0.04;
    this.group.add(s);
    return s;
  }

  _halo(cor, escala, y) {
    const h = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(cor), color: cor,
      transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    h.scale.set(escala, escala, 1);
    h.position.y = y;
    this.group.add(h);
    return h;
  }

  dispose() {
    this._limparAncoras();
    this._limparTelegrafos();
    this.scene.remove(this.group);
  }
}
