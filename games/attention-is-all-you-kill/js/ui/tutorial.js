// tutorial.js — tutorial jogável, em passos que param e explicam.
//
// Nada aqui é cutscene: cada passo pede uma ação de verdade e avanca quando o
// jogador executa ela. A verificação e feita no estado do jogo (distância
// percorrida, munição que baixou, abate contado), então o tutorial nunca
// avanca por tempo nem trava esperando algo que não aconteceu.
//
// Durante o tutorial os inimigos da sala são removidos e entra um alvo de
// treino que não machuca. A ideia e ensinar sem punir.

const PASSOS = [
  {
    titulo: 'MOVIMENTO',
    texto: 'Você está no datacenter. Use W, A, S, D para andar.',
    dica: 'SHIFT corre. ESPAÇO pula. Andar para trás não é vergonha.',
    instrucao: 'Ande alguns metros.',
    pronto: (t) => t.distancia >= 5
  },
  {
    titulo: 'MIRAR',
    texto: 'Mova o mouse para olhar em volta. O ponteiro fica travado no centro de propósito.',
    dica: 'Se o mouse sair, clique na tela para travar de novo. ESC solta.',
    instrucao: 'Gire a câmera.',
    pronto: (t) => t.giro >= 3.2
  },
  {
    titulo: 'ATIRAR',
    texto: 'Clique para atirar. A sua arma inicial se chama Prompt Injetor e ela é ruim de propósito.',
    dica: 'Cada tiro gasta um token. O número no canto inferior direito é o pente.',
    instrucao: 'Destrua o alvo de treino.',
    pronto: (t) => t.g.stats.kills >= 1,
    aoEntrar: (t) => t.criarAlvo()
  },
  {
    titulo: 'RECARREGAR',
    texto: 'Pente vazio não atira. Aperte R para recarregar.',
    dica: 'A recarga acontece sozinha quando você tenta atirar sem munição, mas é mais lento.',
    instrucao: 'Recarregue a arma.',
    pronto: (t) => t.g.stats.reloads >= 1,
    aoEntrar: (t) => { t.g.stats.currentAmmo().mag = 1; }
  },
  {
    titulo: 'ARSENAL',
    texto: 'Existem três armas no jogo. Pegue a que estiver brilhando no chão e aperte 2 para usá-la.',
    dica: 'A Few-Shot Shotgun destrói de perto e não serve para nada de longe.',
    instrucao: 'Pegue a arma e troque para ela.',
    pronto: (t) => Object.keys(t.g.stats.ammo).length >= 2 && t.g.stats.currentWeaponId === 'token_streamer',
    aoEntrar: (t) => t.criarArma()
  },
  {
    titulo: 'COBERTURA',
    texto: 'Pilares e contêineres bloqueiam tiro. Os inimigos não atiram todos ao mesmo tempo, então você sempre tem uma janela para se reposicionar.',
    dica: 'No primeiro andar a luz fica vermelha conforme o seu contexto cai. A sala é o seu medidor de vida.',
    instrucao: 'Tutorial concluído. ',
    pronto: (t) => t.tempoNoPasso > 6,
    aoEntrar: (t) => t.g.feed.push('Tutorial concluído. O andar continua.', 'warn')
  }
];

export class Tutorial {
  constructor(game) {
    this.g = game;
    this.ativo = false;
    this.i = 0;
    this.tempoNoPasso = 0;

    this.origem = { x: 0, z: 0 };
    this.distancia = 0;
    this.yawAnterior = 0;
    this.giro = 0;

    this.el = document.getElementById('tutorial');
    this.elTitulo = document.getElementById('tut-titulo');
    this.elTexto = document.getElementById('tut-texto');
    this.elDica = document.getElementById('tut-dica');
    this.elInstrucao = document.getElementById('tut-instrucao');
    this.elProgresso = document.getElementById('tut-progresso');

    document.getElementById('btn-tut-pular')
      .addEventListener('click', () => this.encerrar());
  }

  get passos() { return PASSOS.length; }

  start() {
    const g = this.g;
    this.ativo = true;
    this.i = 0;
    this.tempoNoPasso = 0;

    // tira os inimigos da sala e impede a sala de repor: o tutorial não pune
    g.director.tutorialMode = true;
    g.director.enemies.slice().forEach(e => g.director.killEnemy(e, null));
    g.director.pendingWaves.length = 0;
    g.director.roomsActivated.clear();
    g.stats.kills = 0;
    g.stats.shotsFired = 0;
    g.stats.reloads = 0;

    const p = g.controller.position;
    this.origem = { x: p.x, z: p.z };
    this.distancia = 0;
    this.yawAnterior = g.controller.yaw;
    this.giro = 0;

    this._entrarNoPasso();
    this.el.classList.remove('hidden');
  }

  _entrarNoPasso() {
    const passo = PASSOS[this.i];
    if (!passo) return;
    this.tempoNoPasso = 0;
    if (passo.aoEntrar) passo.aoEntrar(this);

    this.elTitulo.textContent = passo.titulo;
    this.elTexto.textContent = passo.texto;
    this.elDica.textContent = passo.dica || '';
    this.elDica.classList.toggle('hidden', !passo.dica);
    if (this.elInstrucao) this.elInstrucao.textContent = passo.instrucao || '';
    this.elProgresso.textContent = `${this.i + 1} / ${PASSOS.length}`;
  }

  update(dt) {
    if (!this.ativo) return;
    const passo = PASSOS[this.i];
    if (!passo) return this.encerrar();

    this.tempoNoPasso += dt;

    const g = this.g;
    const p = g.controller.position;

    // acompanha o que interessa para os passos
    const d = Math.hypot(p.x - this.origem.x, p.z - this.origem.z);
    this.distancia = Math.max(this.distancia, d);

    const yaw = g.controller.yaw;
    let delta = yaw - this.yawAnterior;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.giro += Math.abs(delta);
    this.yawAnterior = yaw;

    if (passo.pronto(this)) this._avancar();
  }

  _avancar() {
    this.i++;
    if (this.i >= PASSOS.length) return this.encerrar();
    this._entrarNoPasso();
  }

  // ------------------------------------------------------------------
  // Cenário do tutorial
  // ------------------------------------------------------------------
  criarAlvo() {
    const g = this.g;
    const p = g.controller.position;
    // a frente do jogador, onde ele já esta olhando
    const fx = p.x + Math.sin(g.controller.yaw) * -6;
    const fz = p.z + Math.cos(g.controller.yaw) * -6;
    const t = g.dungeon.worldToTile(fx, fz);
    const x = g.dungeon.isSolid(t.tx, t.tz) ? p.x - 6 : fx;
    const z = g.dungeon.isSolid(t.tx, t.tz) ? p.z : fz;
    const alvo = g.director.spawnEnemy('qwen_turbo', x, z, 1, { name: 'ALVO DE TREINO' });
    // Alvo de treino: parado, sem visão e sem dano. Com velocidade ele entra em
    // PATROL e anda, o que faz o jogador errar por motivo que ele não entende.
    alvo.def = { ...alvo.def, hp: 26, damage: 0, sightRange: 0, speed: 0 };
    alvo.hp = 26;
    alvo.state = 'IDLE';
    alvo.placaSempre = true;   // o alvo não entra em combate, mas precisa se identificar
  }

  criarArma() {
    const g = this.g;
    const p = g.controller.position;
    const x = p.x + Math.sin(g.controller.yaw) * -4.5;
    const z = p.z + Math.cos(g.controller.yaw) * -4.5;
    g.director.spawnPickup('weapon_token_streamer', x, z);
    g.feed.push('Arma no chão. Pegue e aperte 2.', 'warn');
  }

  encerrar() {
    if (!this.ativo) return;
    this.ativo = false;
    this.el.classList.add('hidden');

    // libera o director e repovoa a sala onde o jogador estiver: ele sai do
    // tutorial com inimigo por perto, senao o jogo fica vazio e sem sentido
    const g = this.g;
    g.director.tutorialMode = false;
    const p = g.controller.position;
    const sala = g.dungeon.roomAt(p.x, p.z);
    if (sala) g.director.roomsActivated.delete(sala.index);

    g.feed.push('Tutorial encerrado. Boa sorte no andar.', 'info');
  }
}