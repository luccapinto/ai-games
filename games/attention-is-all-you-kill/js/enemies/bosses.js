// bosses.js — os chefes temáticos.
//
// Cada um pega a mecânica comum da base (corpo blindado enquanto houver âncora)
// e troca o que importa: a aparência, o que a âncora representa e quais ataques
// ele usa.
//
// A ideia é que o chefe ensine o andar. A BOLHA infla e esvazia, O CANDIDATO
// constrói muro e faz comício, O JUIZ julga e bate o martelo: quem entendeu o
// tema do andar entende a luta sem ler tutorial.

import * as THREE from '../../vendor/three.module.js';
import { Chefe, ESTADO } from './bossbase.js';
import { glowTexture } from '../world/textures.js';

// ======================================================================
// A BOLHA — a bolha da IA
//
// Regra: enquanto as PROMESSAS estiverem de pé, o valuation sustenta o corpo e
// ele fica blindado. Derrube as quatro e a bolha esvazia: encolhe, fica lenta e
// exposta. É a luta em que o jogador entende, jogando, que quem segura a bolha
// são as promessas.
// ======================================================================
export class Bolha extends Chefe {
  constructor(scene, dungeon, theme, room, sfx, feed) {
    super(scene, dungeon, theme, room, sfx, feed, {
      nome: 'A BOLHA',
      maxHp: 480,
      alturaCorpo: 4.0,
      raioCorpo: 4.2,          // ela é larga: a hitbox acompanha
      alturaAncora: 2.4,
      hpAncora: 34,
      ancorasPorFase: [4, 4, 3],
      janelaPorFase: [10, 12, 16],
      corBlindado: 0xffc94d,
      corAberto: 0xfff3c4,
      corAncora: 0xc9a227
    });

    this.tamanhoCheio = 1;
    this.tamanhoVazio = 0.5;
    this.escala = 1;
    this.escalaAlvo = 1;
  }

  _build() {
    this.corpoMat = new THREE.MeshLambertMaterial({
      color: 0xffc94d,
      emissive: 0x7a5a10,
      transparent: true,
      opacity: 0.72
    });

    // O corpo é uma esfera grande e translúcida: dá para ver o que tem dentro,
    // que é o ponto. A bolha não esconde nada, ela só não deixa cair.
    this.corpo = new THREE.Mesh(new THREE.SphereGeometry(3.05, 22, 16), this.corpoMat);
    this.corpo.position.y = this.alturaCorpo;
    this.group.add(this.corpo);

    // casca externa: a membrana que infla
    this.casca = new THREE.Mesh(
      new THREE.SphereGeometry(3.35, 20, 14),
      new THREE.MeshBasicMaterial({
        color: 0xffd76a, wireframe: true, transparent: true, opacity: 0.22
      })
    );
    this.casca.position.y = this.alturaCorpo;
    this.group.add(this.casca);

    // Números subindo por dentro: o valor que ninguém sabe de onde vem.
    this.numeros = [];
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(0xfff0b0), color: 0xfff0b0,
        transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      const a = (i / 7) * Math.PI * 2;
      s.position.set(Math.cos(a) * 1.6, this.alturaCorpo - 1.4 + (i % 3) * 1.1, Math.sin(a) * 1.6);
      s.scale.set(0.5, 0.5, 1);
      this.group.add(s);
      this.numeros.push({ sprite: s, fase: i * 0.9, a });
    }

    // núcleo: o que aparece quando ela esvazia
    this.nucleoMat = new THREE.MeshBasicMaterial({ color: this.corBlindado });
    this.nucleo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), this.nucleoMat);
    this.nucleo.position.y = this.alturaCorpo;
    this.group.add(this.nucleo);

    this.halo = this._halo(0xffc94d, 7.5, this.alturaCorpo);
    this._sombra(8.5, 8.5);
  }

  _visualAncora(x, z) {
    // As promessas são placas: um retângulo fino girando, com brilho dourado.
    const group = new THREE.Group();
    group.position.set(x, this.alturaAncora, z);

    const mat = new THREE.MeshBasicMaterial({ color: this.corAncora, side: THREE.DoubleSide });
    const placa = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.1), mat);
    group.add(placa);

    const borda = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.05, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 })
    );
    borda.rotation.x = Math.PI / 2;
    group.add(borda);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(0xffd76a), color: 0xffd76a,
      transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    halo.scale.set(2.8, 2.8, 1);
    group.add(halo);

    return { group, node: placa, ring: borda, halo, mat };
  }

  _aoAbrir() {
    this.escalaAlvo = this.tamanhoVazio;
    this.corpoMat.color.setHex(0xffb0b0);
    this.corpoMat.opacity = 0.45;
    this.nucleoMat.color.setHex(0xff4d4d);
    if (this.feed) this.feed.push('A BOLHA esvaziou. Sem as promessas, ela é só uma esfera.', 'warn');
    if (this.sfx) this.sfx.playerHurt();
  }

  _aoEntrarNaFase(director, floor) {
    this.escalaAlvo = this.tamanhoCheio;
    this.corpoMat.color.setHex(0xffc94d);
    this.corpoMat.opacity = 0.72;
    this.nucleoMat.color.setHex(this.corBlindado);
    if (this.feed) {
      this.feed.push(`A BOLHA inflou de novo: ${this.fase}ª rodada de captação.`, 'bad');
    }
  }

  _aoDestruirAncora() {
    if (this.feed) this.feed.push('Uma promessa caiu.', 'info');
  }

  _animar(dt) {
    const t = performance.now() / 1000;

    // Inflar e esvaziar é a leitura da luta: o tamanho diz se dá para atirar.
    this.escala += (this.escalaAlvo - this.escala) * Math.min(1, dt * 3.5);
    const respirar = 1 + Math.sin(t * 1.6) * 0.035 * this.escala;
    const s = this.escala * respirar;

    this.corpo.scale.setScalar(s);
    this.casca.scale.setScalar(s * (1 + Math.sin(t * 2.3) * 0.05));
    this.casca.rotation.y += dt * 0.4;
    this.casca.rotation.x += dt * 0.2;
    this.group.position.y = Math.sin(t * 0.9) * 0.3;

    for (const n of this.numeros) {
      n.fase += dt * 0.8;
      const sobe = ((n.fase % 1) * 2.6) - 1.3;
      n.sprite.position.y = this.alturaCorpo + sobe * this.escala;
      n.sprite.position.x = Math.cos(n.a + t * 0.5) * 1.6 * this.escala;
      n.sprite.position.z = Math.sin(n.a + t * 0.5) * 1.6 * this.escala;
      n.sprite.material.opacity = this.estado === ESTADO.VULNERAVEL ? 0.15 : 0.5;
    }

    this.nucleo.rotation.y += dt * 1.2;
    if (this.halo) this.halo.material.opacity = 0.3 + 0.2 * Math.abs(Math.sin(t * 1.2));
  }

  _escolherAtaque(player, director, floor) {
    const roll = Math.random();
    const ag = this.agressividade;

    if (roll < 0.45) {
      this._rodadaDeInvestimento(director, player);
      this.timerAtaque = (2.8 / ag) + Math.random() * 0.7;
    } else if (roll < 0.75) {
      this._pitchStartup(director, floor);
      this.timerAtaque = (3.6 / ag) + Math.random();
    } else {
      this._estouro(director, player);
      this.timerAtaque = (3.2 / ag) + Math.random();
    }
  }

  // Leque de projéteis: a rodada de captação que sai toda de uma vez.
  _rodadaDeInvestimento(director, player) {
    const base = Math.atan2(
      player.position.z - this.center.z,
      player.position.x - this.center.x
    );
    const spread = Math.PI * 0.55;

    const setor = new THREE.Mesh(
      new THREE.CircleGeometry(13, 26, -base - spread / 2, spread),
      new THREE.MeshBasicMaterial({
        color: 0xffc94d, transparent: true, opacity: 0.18,
        side: THREE.DoubleSide, depthWrite: false
      })
    );
    setor.rotation.x = -Math.PI / 2;
    setor.position.set(this.center.x, 0.07, this.center.z);
    this.scene.add(setor);
    this._registrarTelegrafo(setor);

    this.avisoRodada = { setor, timer: 1.2, base, spread };
    if (this.feed) this.feed.push('A BOLHA captou: rodada chegando.', 'bad');
    if (this.sfx) this.sfx.levelUp();
  }

  _resolverRodada(director) {
    const t = this.avisoRodada;
    const count = 5 + this.fase;
    const origem = new THREE.Vector3(this.center.x, this.alturaCorpo, this.center.z);
    const espalhamento = this.estado === ESTADO.VULNERAVEL ? 1.5 : 1;

    for (let i = 0; i < count; i++) {
      const a = t.base - t.spread / 2 + (t.spread / Math.max(1, count - 1)) * i;
      director.spawnEnemyProjectile(
        origem, Math.cos(a), Math.sin(a),
        (8 + this.fase * 2) * espalhamento,
        { def: { tier: 3 }, isBoss: true },
        { speed: 16 }
      );
    }

    this.scene.remove(t.setor);
    this._esquecerTelegrafo(t.setor);
    this.avisoRodada = null;
    if (this.sfx) this.sfx.shot('shotgun');
  }

  _pitchStartup(director, floor) {
    const count = 2 + this.fase;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 5 + Math.random() * 5;
      const x = this.center.x + Math.cos(a) * r;
      const z = this.center.z + Math.sin(a) * r;
      const tile = this.dungeon.worldToTile(x, z);
      if (this.dungeon.isSolid(tile.tx, tile.tz)) continue;
      director.spawnEnemy('qwen_turbo', x, z, floor, { grace: 0.3 });
    }
    if (this.feed) this.feed.push('A BOLHA abriu rodada: startups no térreo.', 'bad');
  }

  // Estouro radial: quando a bolha está cheia, tudo em volta leva junto.
  _estouro(director, player) {
    const raio = 6.5;
    const anel = new THREE.Mesh(
      new THREE.RingGeometry(raio * 0.85, raio, 30),
      new THREE.MeshBasicMaterial({
        color: 0xffd76a, transparent: true, opacity: 0.6,
        side: THREE.DoubleSide, depthWrite: false
      })
    );
    anel.rotation.x = -Math.PI / 2;
    anel.position.set(this.center.x, 0.06, this.center.z);
    this.scene.add(anel);
    this._registrarTelegrafo(anel);

    this.avisoEstouro = { anel, timer: 1.05, raio };
    if (this.feed) this.feed.push('A BOLHA estourando de valor.', 'bad');
  }

  _resolverEstouro(player, stats) {
    const t = this.avisoEstouro;
    const d = Math.hypot(player.position.x - this.center.x, player.position.z - this.center.z);
    if (d < t.raio) {
      const dmg = 16 + this.fase * 4;
      if (stats) stats.takeDamage(dmg);
      if (this.sfx) this.sfx.playerHurt();
      if (this.onPlayerHit) this.onPlayerHit(dmg);
    }
    this.scene.remove(t.anel);
    this._esquecerTelegrafo(t.anel);
    this.avisoEstouro = null;
  }

  update(dt, player, stats, director, floor) {
    super.update(dt, player, stats, director, floor);
    if (!this.alive) return;

    if (this.avisoRodada) {
      this.avisoRodada.timer -= dt;
      this.avisoRodada.setor.material.opacity = 0.13 + 0.22 * Math.abs(Math.sin(this.avisoRodada.timer * 13));
      if (this.avisoRodada.timer <= 0) this._resolverRodada(director);
      return;
    }

    if (this.avisoEstouro) {
      this.avisoEstouro.timer -= dt;
      this.avisoEstouro.anel.material.opacity = 0.35 + 0.35 * Math.abs(Math.sin(this.avisoEstouro.timer * 16));
      if (this.avisoEstouro.timer <= 0) this._resolverEstouro(player, stats);
    }
  }
}

// ======================================================================
// O CANDIDATO — o palanque
//
// Regra: enquanto as CAIXAS DE SOM estiverem de pé, o discurso sustenta ele e o
// corpo fica blindado. Derrube as quatro e o palco fica mudo: a janela abre.
//
// Ataque dele é muro: uma parede de tijolos que atravessa a sala na direção do
// jogador. Não bloqueia tiro — machuca quem ficar na frente. É o gesto que todo
// mundo espera dele, e virou mecânica.
// ======================================================================
export class Candidato extends Chefe {
  constructor(scene, dungeon, theme, room, sfx, feed) {
    super(scene, dungeon, theme, room, sfx, feed, {
      nome: 'O CANDIDATO',
      maxHp: 520,
      alturaCorpo: 5.2,        // alto e magro: a hitbox é estreita e comprida
      raioCorpo: 2.1,
      alturaAncora: 2.2,
      hpAncora: 40,
      ancorasPorFase: [4, 4, 3],
      janelaPorFase: [10, 12, 15],
      corBlindado: 0x4d7fff,
      corAberto: 0xffd24d,
      corAncora: 0xd94a3d
    });

    this.muros = [];
  }

  _build() {
    const terno = new THREE.MeshLambertMaterial({ color: 0x1e2a52 });
    const camisa = new THREE.MeshLambertMaterial({ color: 0xf0f2f5 });
    const gravata = new THREE.MeshBasicMaterial({ color: 0xd9342b });
    const pele = new THREE.MeshLambertMaterial({ color: 0xe8b48a });

    // tronco: paletó largo, ombros quadrados
    const tronco = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.5, 1.3), terno);
    tronco.position.y = 3.5;
    this.group.add(tronco);

    // A gravata é comprida de propósito: é o detalhe que identifica a silhueta
    // de longe, antes de qualquer cor entrar em jogo.
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.1, 0.1), gravata);
    g.position.set(0, 3.3, 0.7);
    this.group.add(g);

    const colarinho = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.9), camisa);
    colarinho.position.y = 4.7;
    this.group.add(colarinho);

    // cabeça e o cabelo, que é a leitura mais rápida de todas
    const cabeca = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.4, 1.25), pele);
    cabeca.position.y = 5.5;
    this.group.add(cabeca);

    const cabeloMat = new THREE.MeshLambertMaterial({ color: 0xf2d06a, emissive: 0x6a5020 });
    const cabelo = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 1.5), cabeloMat);
    cabelo.position.y = 6.25;
    this.group.add(cabelo);
    const topete = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 0.5), cabeloMat);
    topete.position.set(0, 6.5, 0.5);
    this.group.add(topete);

    // braços: um aponta, o outro fica atrás
    const bracoD = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.5), terno);
    bracoD.position.set(1.35, 3.6, 0.35);
    bracoD.rotation.x = -0.9;
    this.group.add(bracoD);

    const bracoE = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.0, 0.5), terno);
    bracoE.position.set(-1.35, 3.4, -0.2);
    this.group.add(bracoE);

    // pódio: ele nunca desce do palanque
    const podio = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 1.5, 1.8),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2a })
    );
    podio.position.y = 0.75;
    this.group.add(podio);

    const faixa = new THREE.Mesh(
      new THREE.BoxGeometry(3.05, 0.4, 1.85),
      new THREE.MeshBasicMaterial({ color: 0xd9342b })
    );
    faixa.position.y = 1.3;
    this.group.add(faixa);

    // microfones: a silhueta do comício
    for (const dx of [-0.5, 0.5]) {
      const haste = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6),
        new THREE.MeshLambertMaterial({ color: 0x9aa4b0 })
      );
      haste.position.set(dx, 2.1, 0.75);
      haste.rotation.x = 0.5;
      this.group.add(haste);
      const boca = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0x2a2f38 })
      );
      boca.position.set(dx, 2.7, 1.0);
      this.group.add(boca);
    }

    this.nucleoMat = new THREE.MeshBasicMaterial({ color: this.corBlindado });
    this.nucleo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), this.nucleoMat);
    this.nucleo.position.set(0, 4.2, 0.72);
    this.group.add(this.nucleo);

    this.brilhoCabelo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(0xf2d06a), color: 0xf2d06a,
      transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    // Glow pequeno de propósito: um halo grande aqui lava a cabeça e a silhueta
    // deixa de ser lida. O cabelo precisa aparecer, não brilhar.
    this.brilhoCabelo.scale.set(1.9, 1.9, 1);
    this.brilhoCabelo.position.y = 6.3;
    this.group.add(this.brilhoCabelo);

    this._sombra(5.5, 5.5);
  }

  _visualAncora(x, z) {
    // Caixa de som do comício: o que faz o discurso chegar longe.
    const group = new THREE.Group();
    group.position.set(x, this.alturaAncora, z);

    const mat = new THREE.MeshLambertMaterial({ color: this.corAncora });
    const caixa = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.7, 1.1), mat);
    group.add(caixa);

    const cone = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd0c0 })
    );
    cone.position.z = 0.57;
    group.add(cone);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(0xd94a3d), color: 0xd94a3d,
      transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    halo.scale.set(2.6, 2.6, 1);
    group.add(halo);

    return { group, node: caixa, ring: cone, halo, mat };
  }

  _aoAbrir() {
    this.nucleoMat.color.setHex(this.corAberto);
    if (this.feed) this.feed.push('O palco ficou mudo. O CANDIDATO está exposto.', 'warn');
  }

  _aoEntrarNaFase() {
    this.nucleoMat.color.setHex(this.corBlindado);
    if (this.feed) this.feed.push(`O CANDIDATO subiu o tom: fase ${this.fase}.`, 'bad');
  }

  _aoDestruirAncora() {
    if (this.feed) this.feed.push('Uma caixa de som caiu.', 'info');
  }

  _animar(dt, player) {
    const t = performance.now() / 1000;
    this.group.position.y = Math.sin(t * 0.7) * 0.12;

    // Ele se vira de leve para o jogador: parece que está falando com você.
    if (player) {
      const alvo = Math.atan2(
        player.position.x - this.center.x,
        player.position.z - this.center.z
      );
      let d = alvo - this.group.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.group.rotation.y += d * Math.min(1, dt * 2);
    }

    this.nucleo.rotation.y += dt * 1.5;
    if (this.brilhoCabelo) {
      this.brilhoCabelo.material.opacity = 0.14 + 0.1 * Math.abs(Math.sin(t * 1.8));
    }
  }

  _escolherAtaque(player, director, floor) {
    const roll = Math.random();
    const ag = this.agressividade;

    if (roll < 0.42) {
      this._muro(player);
      this.timerAtaque = (3.0 / ag) + Math.random() * 0.6;
    } else if (roll < 0.74) {
      this._tweets(player, director);
      this.timerAtaque = (2.8 / ag) + Math.random() * 0.8;
    } else {
      this._comicio(director, floor);
      this.timerAtaque = (3.8 / ag) + Math.random();
    }
  }

  // O muro: uma parede que aparece na frente dele e varre a sala. Não bloqueia
  // tiro (isso travaria a luta), machuca quem estiver no caminho.
  _muro(player) {
    const dx = player.position.x - this.center.x;
    const dz = player.position.z - this.center.z;
    const dist = Math.hypot(dx, dz) || 1;
    const ux = dx / dist;
    const uz = dz / dist;

    const largura = 9;
    // Transparente para poder esmaecer de perto: um bloco opaco de 3,4 de altura
    // passando na frente da câmera tapa a tela inteira por um segundo, e levar
    // dano sem ver nada não é dificuldade, é estorvo.
    const mat = new THREE.MeshLambertMaterial({
      color: 0x8a6a4a, transparent: true, opacity: 1
    });
    const parede = new THREE.Mesh(new THREE.BoxGeometry(largura, 3.0, 0.9), mat);
    parede.rotation.y = Math.atan2(ux, uz) + Math.PI / 2;
    parede.position.set(this.center.x + ux * 3, 1.7, this.center.z + uz * 3);
    this.scene.add(parede);

    // Faixa no chão mostrando por onde ele vai passar: sem isso o ataque chega
    // sem aviso e o jogador leva dano que não conseguiu ler.
    const faixa = new THREE.Mesh(
      new THREE.PlaneGeometry(largura, 1.6),
      new THREE.MeshBasicMaterial({
        color: 0xd94a3d, transparent: true, opacity: 0.3,
        side: THREE.DoubleSide, depthWrite: false
      })
    );
    faixa.rotation.x = -Math.PI / 2;
    faixa.rotation.z = -Math.atan2(ux, uz) - Math.PI / 2;
    faixa.position.set(this.center.x + ux * 3, 0.05, this.center.z + uz * 3);
    this.scene.add(faixa);
    this._registrarTelegrafo(faixa);

    this.muroAtivo = {
      parede, faixa, ux, uz, largura,
      distancia: 3, velocidade: 13 + this.fase, timer: 0.9, avisando: true,
      inicio: new THREE.Vector3(this.center.x, 0, this.center.z)
    };

    if (this.feed) this.feed.push('O CANDIDATO: "vamos construir o muro de contexto".', 'bad');
    if (this.sfx) this.sfx.levelUp();
  }

  _avancarMuro(dt, player, stats) {
    const m = this.muroAtivo;
    if (!m) return;

    if (m.avisando) {
      m.timer -= dt;
      m.faixa.material.opacity = 0.2 + 0.3 * Math.abs(Math.sin(m.timer * 14));
      if (m.timer <= 0) {
        m.avisando = false;
        if (this.sfx) this.sfx.shot('shotgun');
      }
      return;
    }

    m.distancia += m.velocidade * dt;
    m.parede.position.set(
      this.center.x + m.ux * m.distancia, 1.5, this.center.z + m.uz * m.distancia
    );

    // Quanto mais perto da câmera, mais transparente: o muro continua legível de
    // longe e deixa de tapar a visão quando está em cima de você.
    const distJogador = Math.hypot(
      player.position.x - m.parede.position.x,
      player.position.z - m.parede.position.z
    );
    m.parede.material.opacity = distJogador < 3.2
      ? Math.max(0.12, distJogador / 3.2) * 0.75
      : 1;

    // O muro empurra: quem está na faixa leva dano uma vez por passagem.
    if (!m.jaAtingiu) {
      const px = player.position.x - m.parede.position.x;
      const pz = player.position.z - m.parede.position.z;
      const perp = Math.abs(px * m.uz - pz * m.ux);
      const aoLongo = px * m.ux + pz * m.uz;
      if (perp < m.largura / 2 && Math.abs(aoLongo) < 1.2) {
        m.jaAtingiu = true;
        const dmg = 14 + this.fase * 4;
        if (stats) stats.takeDamage(dmg);
        if (this.sfx) this.sfx.playerHurt();
        if (this.onPlayerHit) this.onPlayerHit(dmg);
      }
    }

    if (m.distancia > 26) {
      this.scene.remove(m.parede);
      this.scene.remove(m.faixa);
      this._esquecerTelegrafo(m.faixa);
      this.muroAtivo = null;
      if (this.feed) this.feed.push('O muro terminou. Não bloqueou nada.', 'info');
    }
  }

  // Chuva de posts: cai em pontos marcados no chão.
  _tweets(player, director) {
    const pontos = [];
    const n = 3 + this.fase;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = i === 0 ? Math.random() * 2 : 3 + Math.random() * 7;
      const x = (i === 0 ? player.position.x : this.center.x) + Math.cos(a) * r;
      const z = (i === 0 ? player.position.z : this.center.z) + Math.sin(a) * r;
      const tile = this.dungeon.worldToTile(x, z);
      if (this.dungeon.isSolid(tile.tx, tile.tz)) continue;

      const marca = new THREE.Mesh(
        new THREE.RingGeometry(1.3, 1.7, 18),
        new THREE.MeshBasicMaterial({
          color: 0x4d7fff, transparent: true, opacity: 0.6,
          side: THREE.DoubleSide, depthWrite: false
        })
      );
      marca.rotation.x = -Math.PI / 2;
      marca.position.set(x, 0.06, z);
      this.scene.add(marca);
      this._registrarTelegrafo(marca);
      pontos.push({ x, z, marca, timer: 1.35, caiu: false });
    }
    this.tweets = { pontos };
    if (this.feed) this.feed.push('O CANDIDATO postou de novo. Olhe para cima.', 'bad');
  }

  _avancarTweets(dt, player, stats) {
    if (!this.tweets) return;
    let restam = 0;

    for (const p of this.tweets.pontos) {
      if (p.caiu) continue;
      p.timer -= dt;
      p.marca.material.opacity = 0.35 + 0.3 * Math.abs(Math.sin(p.timer * 15));

      if (p.timer <= 0) {
        p.caiu = true;
        this.scene.remove(p.marca);
        this._esquecerTelegrafo(p.marca);

        // O post cai do céu e explode no chão.
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 1.1, 0.12),
          new THREE.MeshBasicMaterial({ color: 0x9fd0ff })
        );
        post.position.set(p.x, 9, p.z);
        this.scene.add(post);
        p.post = post;
        p.queda = 0;
      }

      if (p.post) {
        p.queda += dt * 26;
        p.post.position.y = Math.max(0.6, 9 - p.queda);
        if (p.post.position.y <= 0.6) {
          this.scene.remove(p.post);
          p.post = null;
          p.explodiu = true;
          if (this.sfx) this.sfx.shot('shotgun');
          const d = Math.hypot(player.position.x - p.x, player.position.z - p.z);
          if (d < 2.6) {
            const dmg = 12 + this.fase * 3;
            if (stats) stats.takeDamage(dmg);
            if (this.sfx) this.sfx.playerHurt();
            if (this.onPlayerHit) this.onPlayerHit(dmg);
          }
        } else {
          restam++;
        }
      }
      if (!p.explodiu) restam++;
    }

    if (restam === 0) this.tweets = null;
  }

  _comicio(director, floor) {
    const count = 2 + this.fase;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 5 + Math.random() * 5;
      const x = this.center.x + Math.cos(a) * r;
      const z = this.center.z + Math.sin(a) * r;
      const tile = this.dungeon.worldToTile(x, z);
      if (this.dungeon.isSolid(tile.tx, tile.tz)) continue;
      director.spawnEnemy('qwen_turbo', x, z, floor, { grace: 0.3 });
    }
    // O apoio popular cura ele: é o preço de deixar o comício acontecer.
    const cura = 18 + this.fase * 6;
    this.hp = Math.min(this.maxHp, this.hp + cura);
    if (this.feed) {
      this.feed.push(`O CANDIDATO fez comício e recuperou ${cura} de base.`, 'bad');
    }
  }

  update(dt, player, stats, director, floor) {
    super.update(dt, player, stats, director, floor);
    if (!this.alive) return;
    this._avancarMuro(dt, player, stats);
    this._avancarTweets(dt, player, stats);
  }

  _limparTelegrafos() {
    super._limparTelegrafos();
    if (this.muroAtivo) {
      this.scene.remove(this.muroAtivo.parede);
      this.scene.remove(this.muroAtivo.faixa);
      this.muroAtivo = null;
    }
    if (this.tweets) {
      for (const p of this.tweets.pontos) {
        if (p.marca && p.marca.parent) this.scene.remove(p.marca);
        if (p.post && p.post.parent) this.scene.remove(p.post);
      }
      this.tweets = null;
    }
  }
}

// ======================================================================
// O JUIZ — o tribunal
//
// Regra: enquanto os AUTOS DO PROCESSO estiverem em cima da bancada, o processo
// corre e o corpo fica blindado. Derrube os quatro e o julgamento para: a
// janela abre.
//
// O ataque dele é o martelo: três batidas seguidas, cada uma um anel que
// expande. Uma batida só seria fácil de desviar; três fazem o jogador ter que
// andar na direção certa em vez de só sair do lugar.
// ======================================================================
export class Juiz extends Chefe {
  constructor(scene, dungeon, theme, room, sfx, feed) {
    super(scene, dungeon, theme, room, sfx, feed, {
      nome: 'O JUIZ',
      maxHp: 560,
      alturaCorpo: 4.4,
      raioCorpo: 2.4,
      alturaAncora: 2.0,
      hpAncora: 44,
      ancorasPorFase: [4, 4, 3],
      janelaPorFase: [10, 12, 16],
      corBlindado: 0x9aa6ff,
      corAberto: 0xffd24d,
      corAncora: 0xb08a5a
    });

    this.ondas = [];
  }

  _build() {
    const toga = new THREE.MeshLambertMaterial({ color: 0x15161c });
    const madeira = new THREE.MeshLambertMaterial({ color: 0x5a3b22 });
    const pele = new THREE.MeshLambertMaterial({ color: 0xd8a87c });

    // bancada: ele julga de cima, nunca desce
    const bancada = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.2, 2.2), madeira);
    bancada.position.y = 1.1;
    this.group.add(bancada);

    const tampo = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.28, 2.6), madeira);
    tampo.position.y = 2.3;
    this.group.add(tampo);

    // tronco e ombros cobertos pela toga
    const tronco = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 1.5), toga);
    tronco.position.y = 3.6;
    this.group.add(tronco);

    const ombro = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 1.7), toga);
    ombro.position.y = 4.7;
    this.group.add(ombro);

    const cabeca = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.25, 1.1), pele);
    cabeca.position.y = 5.5;
    this.group.add(cabeca);

    // peruca: o detalhe que faz ler "juiz" antes de ler o nome
    const perucaMat = new THREE.MeshLambertMaterial({ color: 0xf4f1e6 });
    const peruca = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.85, 1.35), perucaMat);
    peruca.position.y = 5.95;
    this.group.add(peruca);
    for (const dx of [-0.62, 0.62]) {
      const cacho = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.5), perucaMat);
      cacho.position.set(dx, 5.4, -0.2);
      this.group.add(cacho);
    }

    // martelo na mão direita
    this.martelo = new THREE.Group();
    const cabo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a5a32 })
    );
    this.martelo.add(cabo);
    const bloco = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.7), madeira);
    bloco.position.y = 0.8;
    this.martelo.add(bloco);
    this.martelo.position.set(2.5, 3.6, 0.6);
    this.martelo.rotation.z = -0.4;
    this.group.add(this.martelo);

    this.nucleoMat = new THREE.MeshBasicMaterial({ color: this.corBlindado });
    this.nucleo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), this.nucleoMat);
    this.nucleo.position.set(0, 3.9, 0.8);
    this.group.add(this.nucleo);

    this.halo = this._halo(0x9aa6ff, 5.5, 4.0);
    this._sombra(6.5, 6.5);
  }

  _visualAncora(x, z) {
    // Autos do processo: pilha de papel. Enquanto estiverem de pé, corre o prazo.
    const group = new THREE.Group();
    group.position.set(x, this.alturaAncora, z);

    const mat = new THREE.MeshLambertMaterial({ color: this.corAncora });
    for (let i = 0; i < 4; i++) {
      const folha = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 1.0), mat);
      folha.position.y = i * 0.2;
      folha.rotation.y = (Math.random() - 0.5) * 0.3;
      group.add(folha);
    }

    const selo = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.05, 6, 14),
      new THREE.MeshBasicMaterial({ color: 0xffd24d })
    );
    selo.rotation.x = Math.PI / 2;
    selo.position.y = 0.95;
    group.add(selo);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(0xb08a5a), color: 0xb08a5a,
      transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    halo.scale.set(2.4, 2.4, 1);
    group.add(halo);

    return { group, node: group.children[0], ring: selo, halo, mat };
  }

  _aoAbrir() {
    this.nucleoMat.color.setHex(this.corAberto);
    if (this.feed) this.feed.push('O JULGAMENTO PAROU. O JUIZ está sem os autos.', 'warn');
  }

  _aoEntrarNaFase() {
    this.nucleoMat.color.setHex(this.corBlindado);
    if (this.feed) this.feed.push(`O JUIZ reabriu o processo: fase ${this.fase}.`, 'bad');
  }

  _aoDestruirAncora() {
    if (this.feed) this.feed.push('Um volume dos autos caiu.', 'info');
  }

  _animar(dt) {
    const t = performance.now() / 1000;
    this.group.position.y = Math.sin(t * 0.6) * 0.1;
    this.nucleo.rotation.y += dt * 1.1;

    // o martelo sobe e desce de leve enquanto ele espera
    if (this.martelo && !this.batendo) {
      this.martelo.rotation.z = -0.4 + Math.sin(t * 1.4) * 0.12;
    }
  }

  _escolherAtaque(player, director, floor) {
    const roll = Math.random();
    const ag = this.agressividade;

    if (roll < 0.5) {
      this._martelada(player);
      this.timerAtaque = (3.2 / ag) + Math.random() * 0.7;
    } else if (roll < 0.78) {
      this._intimacao(player, director);
      this.timerAtaque = (3.0 / ag) + Math.random() * 0.8;
    } else {
      this._desacato(director, floor);
      this.timerAtaque = (3.6 / ag) + Math.random();
    }
  }

  // Três batidas em sequência. Cada uma é um anel que abre do centro, então
  // sair do lugar uma vez não resolve: o jogador precisa escolher uma direção.
  _martelada(player) {
    this.batendo = true;
    const centro = new THREE.Vector3(
      player.position.x, 0, player.position.z
    );
    const batidas = 3;
    const aneis = [];

    for (let i = 0; i < batidas; i++) {
      const raio = 3.2 + i * 1.15;
      const anel = new THREE.Mesh(
        new THREE.RingGeometry(raio * 0.84, raio, 28),
        new THREE.MeshBasicMaterial({
          color: 0xffd24d, transparent: true, opacity: 0.0,
          side: THREE.DoubleSide, depthWrite: false
        })
      );
      anel.rotation.x = -Math.PI / 2;
      anel.position.set(centro.x, 0.06, centro.z);
      this.scene.add(anel);
      this._registrarTelegrafo(anel);
      aneis.push({ anel, raio, timer: 0.55 + i * 0.32, disparou: false });
    }

    this.martelada = { centro, aneis, indice: 0 };
    if (this.feed) this.feed.push('O JUIZ levantou o martelo. Três batidas.', 'bad');
    if (this.sfx) this.sfx.levelUp();
  }

  _avancarMartelada(dt, player, stats) {
    const m = this.martelada;
    if (!m) return;
    let restam = 0;

    for (const a of m.aneis) {
      if (a.disparou) continue;
      a.timer -= dt;

      const faltando = Math.max(0, a.timer);
      if (faltando > 0.35) {
        // aviso: o anel aparece onde vai bater
        a.anel.material.opacity = 0.12 + 0.2 * Math.abs(Math.sin(a.timer * 10));
      } else {
        // impacto: o anel pisca forte e machuca quem está no alcance
        a.anel.material.opacity = 0.75;
        if (a.timer <= 0) {
          a.disparou = true;
          if (this.sfx) this.sfx.shot('shotgun');
          this.scene.remove(a.anel);
          this._esquecerTelegrafo(a.anel);
          const d = Math.hypot(player.position.x - m.centro.x, player.position.z - m.centro.z);
          // O anel machuca numa faixa: nem dentro do círculo menor, nem fora do maior.
          if (d > a.raio - 1.9 && d < a.raio + 0.7) {
            const dmg = 13 + this.fase * 3;
            if (stats) stats.takeDamage(dmg);
            if (this.sfx) this.sfx.playerHurt();
            if (this.onPlayerHit) this.onPlayerHit(dmg);
          } else {
            restam++;
          }
        }
      }
      if (!a.disparou) restam++;
    }

    if (restam === 0) {
      this.martelada = null;
      this.batendo = false;
      if (this.sfx) this.sfx.shot('shotgun');
    } else {
      this.batendo = true;
    }
  }

  // Intimação: projétil lento que corrige a rota. Não dá para ignorar andando
  // reto, mas dá para ver chegando e sair da linha.
  _intimacao(player, director) {
    const origem = new THREE.Vector3(this.center.x, 4.0, this.center.z);
    const dx = player.position.x - origem.x;
    const dz = player.position.z - origem.z;
    const d = Math.hypot(dx, dz) || 1;

    const n = 2 + this.fase;
    for (let i = 0; i < n; i++) {
      const jitter = (i - (n - 1) / 2) * 0.16;
      const a = Math.atan2(dz, dx) + jitter;
      director.spawnEnemyProjectile(
        origem, Math.cos(a), Math.sin(a),
        9 + this.fase * 2,
        { def: { tier: 4 }, isBoss: true },
        { speed: 9, homing: 0.5 }
      );
    }
    if (this.feed) this.feed.push('O JUIZ expediu a intimação. Ela persegue.', 'bad');
  }

  _desacato(director, floor) {
    const count = 2 + this.fase;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 5 + Math.random() * 5;
      const x = this.center.x + Math.cos(a) * r;
      const z = this.center.z + Math.sin(a) * r;
      const tile = this.dungeon.worldToTile(x, z);
      if (this.dungeon.isSolid(tile.tx, tile.tz)) continue;
      director.spawnEnemy('haiku_45', x, z, floor, { grace: 0.3 });
    }
    if (this.feed) this.feed.push('O JUIZ: "desacato. Traga os advogados."', 'bad');
  }

  update(dt, player, stats, director, floor) {
    super.update(dt, player, stats, director, floor);
    if (!this.alive) return;
    this._avancarMartelada(dt, player, stats);
  }
}
