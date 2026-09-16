// A sonda. Os numeros aqui sao o jogo inteiro: plataforma de precisao vive ou
// morre no tato, e tato e constante bem escolhida.
//
// Tres perdoes deliberados, porque a culpa de um salto perdido tem que ser do
// jogador e nunca do relogio:
//   coyote  - pular um instante depois de sair da borda ainda conta;
//   buffer  - apertar pular um instante antes de aterrissar ainda conta;
//   canto   - bater o ombro num canto empurra para o lado em vez de travar.

import { TILE, LARGURA } from './mundo.js';

const BORDA = LARGURA * TILE;

export const LARGURA_SONDA = 10;
export const ALTURA_SONDA = 12;

const GRAVIDADE = 0.42;
const QUEDA_MAX = 5.6;
const ACEL = 0.62;
const ATRITO_CHAO = 0.70;
const ATRITO_AR = 0.87;
const VEL_MAX = 2.3;

const PULO = -6.3;
const CORTE_PULO = 0.42;
const COIOTE = 7;
const BUFFER = 8;

const DESLIZE_MAX = 1.3;
const PULO_PAREDE_X = 3.3;
const PULO_PAREDE_Y = -6.0;
const TRAVA_PAREDE = 9;

const INVESTIDA_VEL = 5.0;
const INVESTIDA_QUADROS = 10;
const INVESTIDA_RESIDUO = 0.55;
const RECARGA_INVESTIDA = 6;

const RAIZ2 = Math.SQRT1_2;

export class Sonda {
  constructor(mundo) {
    this.mundo = mundo;
    this.nascer();
  }

  nascer() {
    const n = this.mundo.nascimento;
    this.x = n.x + (TILE - LARGURA_SONDA) / 2;
    this.y = n.y + (TILE - ALTURA_SONDA);
    this.vx = 0;
    this.vy = 0;
    this.noChao = false;
    this.parede = 0;          // -1 parede a esquerda, 1 a direita, 0 nenhuma
    this.coiote = 0;
    this.buffer = 0;
    this.travaParede = 0;
    this.investindo = 0;
    this.cortou = false;
    this.temInvestida = true;
    this.recarga = 0;
    this.olhando = 1;
    this.morta = false;
    this.venceu = false;
    this.rastro = [];
  }

  get w() { return LARGURA_SONDA; }
  get h() { return ALTURA_SONDA; }

  passo(entrada) {
    if (this.morta || this.venceu) return;
    const m = this.mundo;

    const esq = entrada.ativo('esquerda');
    const dir = entrada.ativo('direita');
    let alvo = (dir ? 1 : 0) - (esq ? 1 : 0);
    if (alvo !== 0) this.olhando = alvo;

    // ---- investida ----
    if (entrada.apertou('investida') && this.temInvestida && this.investindo === 0 && this.recarga === 0) {
      let ix = alvo;
      let iy = (entrada.ativo('baixo') ? 1 : 0) - (entrada.ativo('cima') ? 1 : 0);
      if (ix === 0 && iy === 0) ix = this.olhando;
      if (ix !== 0 && iy !== 0) { ix *= RAIZ2; iy *= RAIZ2; }
      this.vx = ix * INVESTIDA_VEL;
      this.vy = iy * INVESTIDA_VEL;
      this.investindo = INVESTIDA_QUADROS;
      this.temInvestida = false;
      this.aoInvestir && this.aoInvestir();
    }

    if (this.investindo > 0) {
      this.investindo--;
      if (this.investindo === 0) {
        this.vx *= INVESTIDA_RESIDUO;
        this.vy *= INVESTIDA_RESIDUO;
        this.recarga = RECARGA_INVESTIDA;
      }
      this.rastro.push({ x: this.x, y: this.y, vida: 12 });
    } else {
      if (this.recarga > 0) this.recarga--;

      // ---- andar ----
      if (this.travaParede > 0) {
        this.travaParede--;
      } else if (alvo !== 0) {
        this.vx += alvo * ACEL;
        if (Math.abs(this.vx) > VEL_MAX) this.vx = alvo * VEL_MAX;
      } else {
        this.vx *= this.noChao ? ATRITO_CHAO : ATRITO_AR;
        if (Math.abs(this.vx) < 0.06) this.vx = 0;
      }

      // ---- gravidade ----
      const deslizando = !this.noChao && this.parede !== 0 && this.vy > 0
        && ((this.parede === 1 && dir) || (this.parede === -1 && esq));
      this.vy += GRAVIDADE;
      if (deslizando) {
        if (this.vy > DESLIZE_MAX) this.vy = DESLIZE_MAX;
      } else if (this.vy > QUEDA_MAX) {
        this.vy = QUEDA_MAX;
      }
      if (m.noVento(this.x, this.y, this.w, this.h)) {
        this.vy -= GRAVIDADE * 2.35;
        if (this.vy < -3.4) this.vy = -3.4;
      }

      // ---- pulo ----
      if (entrada.apertou('pular')) this.buffer = BUFFER;
      if (this.buffer > 0) {
        if (this.coiote > 0) {
          this.vy = PULO;
          this.buffer = 0;
          this.coiote = 0;
          this.cortou = false;
          this.noChao = false;
          this.aoPular && this.aoPular();
        } else if (this.parede !== 0) {
          this.vy = PULO_PAREDE_Y;
          this.vx = -this.parede * PULO_PAREDE_X;
          this.olhando = -this.parede;
          this.travaParede = TRAVA_PAREDE;
          this.buffer = 0;
          this.cortou = false;
          this.temInvestida = true;
          this.aoPular && this.aoPular();
        }
      }
      if (this.buffer > 0) this.buffer--;
      // Soltar o pulo cedo corta a subida uma unica vez. Cortar a cada quadro
      // enquanto sobe esmaga o salto quase inteiro e mata o controle fino.
      if (this.vy < 0 && !entrada.ativo('pular') && !this.cortou) {
        this.vy *= CORTE_PULO;
        this.cortou = true;
      }
      if (this.vy >= 0) this.cortou = true;
    }

    this.mover();

    // ---- estado do contato ----
    if (this.noChao) {
      this.coiote = COIOTE;
      this.temInvestida = true;
      m.pisar(this.x, this.y + this.h, this.w);
    } else if (this.coiote > 0) {
      this.coiote--;
    }
    if (this.parede !== 0) this.temInvestida = true;

    for (const r of this.rastro) r.vida--;
    this.rastro = this.rastro.filter(r => r.vida > 0);

    // ---- morte ----
    if (m.machuca(this.x, this.y, this.w, this.h)) this.morrer();
    if (this.y > 18 * TILE + 40) this.morrer();

    // ---- fagulhas e antena ----
    for (const f of m.fagulhas) {
      if (f.pego) continue;
      if (Math.abs(f.x - (this.x + this.w / 2)) < 11 && Math.abs(f.y - (this.y + this.h / 2)) < 11) {
        f.pego = true;
        this.aoPegar && this.aoPegar(f);
      }
    }
    const s = m.saida;
    if (s && this.x + this.w > s.x + 1 && this.x < s.x + TILE - 1
      && this.y + this.h > s.y && this.y < s.y + TILE) {
      this.venceu = true;
      this.aoVencer && this.aoVencer();
    }
  }

  // Move um eixo por vez e resolve a colisao no eixo movido. Fazer os dois
  // juntos e o que produz aquele bug de atravessar quina em diagonal.
  mover() {
    const m = this.mundo;

    this.x += this.vx;
    // A tela e a fase inteira, entao a borda e parede. Sem isto da para
    // andar para fora do mapa pela direita e cair no vazio — o que
    // acontecia em BASE, uma fase que nao tem um unico perigo.
    if (this.x < 0) { this.x = 0; if (this.vx < 0) this.vx = 0; }
    if (this.x + this.w > BORDA) { this.x = BORDA - this.w; if (this.vx > 0) this.vx = 0; }
    if (m.colide(this.x, this.y, this.w, this.h)) {
      const passo = this.vx > 0 ? -1 : 1;
      while (m.colide(this.x, this.y, this.w, this.h)) this.x += passo;
      if (this.investindo > 0) { this.investindo = 0; this.recarga = RECARGA_INVESTIDA; }
      this.vx = 0;
    }

    this.y += this.vy;
    if (m.colide(this.x, this.y, this.w, this.h)) {
      // Perdao de canto: subindo e batendo so a quina da cabeca, escorrega para
      // o lado em vez de perder o salto inteiro.
      if (this.vy < 0) {
        for (const desvio of [1, -1, 2, -2]) {
          if (!m.colide(this.x + desvio, this.y, this.w, this.h)) { this.x += desvio; break; }
        }
      }
      if (m.colide(this.x, this.y, this.w, this.h)) {
        const passo = this.vy > 0 ? -1 : 1;
        while (m.colide(this.x, this.y, this.w, this.h)) this.y += passo;
        this.noChao = this.vy > 0;
        if (this.investindo > 0) { this.investindo = 0; this.recarga = RECARGA_INVESTIDA; }
        this.vy = 0;
      }
    } else {
      this.noChao = false;
    }

    // Parede vale so quando ha solido na altura do corpo, nao na dos pes.
    this.parede = 0;
    if (!this.noChao) {
      if (m.colide(this.x - 1, this.y + 2, this.w, this.h - 4)) this.parede = -1;
      else if (m.colide(this.x + 1, this.y + 2, this.w, this.h - 4)) this.parede = 1;
    }
  }

  morrer() {
    if (this.morta) return;
    this.morta = true;
    this.aoMorrer && this.aoMorrer();
  }
}
