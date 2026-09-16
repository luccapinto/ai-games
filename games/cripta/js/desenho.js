// Render da cripta. Tudo em canvas, sem arquivo de imagem: pedra, madeira,
// lampiao e poeira saem de codigo.
//
// A paleta e quente de proposito. O jogo vizinho no repositorio e uma
// tempestade azul; uma tumba iluminada por lampiao precisa parecer outro lugar.

import { LARGURA, ALTURA } from './nivel.js';
import { PEDRA, PLACA, SAIDA } from './estado.js';

export const TILE = 24;
const L = LARGURA * TILE;
const A = ALTURA * TILE;

function ruido(x, y) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

export class Desenho {
  constructor(ctx) {
    this.ctx = ctx;
    this.tempo = 0;
    this.poeira = [];
    for (let i = 0; i < 34; i++) {
      this.poeira.push({
        x: Math.random() * L,
        y: Math.random() * A,
        v: 0.10 + Math.random() * 0.22,
        d: Math.random() * 6.28,
        r: 0.6 + Math.random() * 1.1,
      });
    }
  }

  passo(reduzido) {
    this.tempo++;
    if (reduzido) return;
    for (const p of this.poeira) {
      p.y -= p.v;
      p.x += Math.sin(this.tempo * 0.012 + p.d) * 0.16;
      if (p.y < -4) { p.y = A + 4; p.x = Math.random() * L; }
    }
  }

  quadro(c, reduzido) {
    const ctx = this.ctx;
    this.fundo(ctx);
    this.parede(ctx, c);
    this.placas(ctx, c);
    this.saida(ctx, c);
    this.caixas(ctx, c);
    this.jogadora(ctx, c);
    if (!reduzido) this.desenharPoeira(ctx);
    this.lampiao(ctx, c);
  }

  fundo(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, A);
    g.addColorStop(0, '#120c08');
    g.addColorStop(1, '#1d1410');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L, A);
    // Tijolos ao fundo, bem apagados: dao profundidade sem competir com o jogo.
    ctx.fillStyle = 'rgba(70,48,32,.16)';
    for (let y = 0; y < ALTURA; y++) {
      for (let x = 0; x < LARGURA; x++) {
        const desvio = (y % 2) * (TILE / 2);
        ctx.fillRect(x * TILE + desvio, y * TILE, TILE - 2, 1);
        ctx.fillRect(x * TILE + desvio, y * TILE, 1, TILE - 2);
      }
    }
  }

  parede(ctx, c) {
    for (let y = 0; y < ALTURA; y++) {
      for (let x = 0; x < LARGURA; x++) {
        if (c.tile(x, y) !== PEDRA) continue;
        const n = ruido(x, y);
        const px = x * TILE, py = y * TILE;
        ctx.fillStyle = n > .7 ? '#7a5c3d' : n > .38 ? '#6e5236' : '#634930';
        ctx.fillRect(px, py, TILE, TILE);
        // Face virada para o ceu mais clara: diz de relance onde da para pisar.
        if (c.tile(x, y - 1) !== PEDRA) {
          ctx.fillStyle = '#ab8354';
          ctx.fillRect(px, py, TILE, 3);
          ctx.fillStyle = 'rgba(226,190,130,.30)';
          ctx.fillRect(px, py + 3, TILE, 1);
        }
        ctx.fillStyle = 'rgba(20,12,8,.35)';
        ctx.fillRect(px, py + TILE - 2, TILE, 2);
        if (n > .82) {
          ctx.fillStyle = 'rgba(24,15,9,.5)';
          ctx.fillRect(px + 5 + n * 8, py + 8 + n * 6, 4, 3);
        }
      }
    }
  }

  placas(ctx, c) {
    for (const p of c.placas) {
      const px = p.x * TILE, py = p.y * TILE;
      const ocupada = !!c.caixaEm(p.x, p.y);
      const pulso = ocupada ? 1 : (Math.sin(this.tempo * 0.06) + 1) / 2 * .5 + .35;
      ctx.fillStyle = 'rgba(10,8,6,.55)';
      ctx.fillRect(px + 3, py + TILE - 8, TILE - 6, 6);
      ctx.strokeStyle = ocupada ? `rgba(126,232,208,.95)` : `rgba(126,232,208,${pulso})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 3.5, py + TILE - 7.5, TILE - 7, 5);
      if (ocupada) {
        const g = ctx.createRadialGradient(px + TILE / 2, py + TILE / 2, 2,
                                           px + TILE / 2, py + TILE / 2, TILE * 1.4);
        g.addColorStop(0, 'rgba(126,232,208,.30)');
        g.addColorStop(1, 'rgba(126,232,208,0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - TILE, py - TILE, TILE * 3, TILE * 3);
      }
    }
  }

  saida(ctx, c) {
    const s = c.saida;
    const px = s.x * TILE, py = s.y * TILE;
    const aberta = c.saidaAberta;
    const pulso = (Math.sin(this.tempo * 0.05) + 1) / 2;

    const halo = ctx.createRadialGradient(px + TILE / 2, py + TILE / 2, 2,
                                          px + TILE / 2, py + TILE / 2, TILE * 2.2);
    halo.addColorStop(0, aberta ? `rgba(126,232,208,${.34 + pulso * .2})` : 'rgba(150,90,70,.16)');
    halo.addColorStop(1, 'rgba(126,232,208,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(px - TILE * 2, py - TILE * 2, TILE * 5, TILE * 5);

    ctx.fillStyle = '#0d0a08';
    ctx.fillRect(px + 3, py + 2, TILE - 6, TILE - 2);
    ctx.strokeStyle = aberta ? '#7ee8d0' : '#6b4a3a';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 3, py + 2, TILE - 6, TILE - 2);

    if (aberta) {
      ctx.fillStyle = `rgba(126,232,208,${.5 + pulso * .5})`;
      for (let i = 0; i < 3; i++) {
        const h = 3 + i * 2;
        ctx.fillRect(px + 7, py + TILE - 6 - i * 5 - (this.tempo * .4 + i * 7) % 12, TILE - 14, 1.5);
      }
    } else {
      // Tranca visivel: a saida fechada precisa parecer fechada, nao apagada.
      ctx.fillStyle = '#6b4a3a';
      ctx.fillRect(px + TILE / 2 - 4, py + TILE / 2 - 2, 8, 7);
      ctx.strokeStyle = '#6b4a3a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px + TILE / 2, py + TILE / 2 - 2, 3, Math.PI, 0);
      ctx.stroke();
    }
  }

  caixas(ctx, c) {
    for (const b of c.caixas) {
      const px = b.x * TILE, py = b.y * TILE;
      const naPlaca = c.placas.some(p => p.x === b.x && p.y === b.y);
      ctx.fillStyle = naPlaca ? '#3f7f74' : '#8a5f2c';
      ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = naPlaca ? '#57a99a' : '#b5813c';
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 5);
      ctx.fillStyle = naPlaca ? 'rgba(160,240,220,.5)' : 'rgba(228,182,110,.5)';
      ctx.fillRect(px + 2, py + 2, TILE - 4, 2);
      // Travessas em X: leem como caixa mesmo em 24px.
      ctx.strokeStyle = naPlaca ? 'rgba(20,50,45,.65)' : 'rgba(70,42,16,.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 4); ctx.lineTo(px + TILE - 4, py + TILE - 5);
      ctx.moveTo(px + TILE - 4, py + 4); ctx.lineTo(px + 4, py + TILE - 5);
      ctx.stroke();
    }
  }

  jogadora(ctx, c) {
    const j = c.jogador;
    const px = j.x * TILE, py = j.y * TILE;
    const bob = Math.sin(this.tempo * 0.07) * 0.8;

    ctx.fillStyle = 'rgba(12,8,5,.4)';
    ctx.beginPath();
    ctx.ellipse(px + TILE / 2, py + TILE - 2, 8, 3, 0, 0, 7);
    ctx.fill();

    // corpo
    ctx.fillStyle = '#d9c08a';
    ctx.fillRect(px + 7, py + 8 + bob, 10, 14);
    // cabeca
    ctx.fillStyle = '#efdcb0';
    ctx.fillRect(px + 8, py + 3 + bob, 8, 7);
    // chapeu, que e o que faz ela ler como arqueologa e nao como caixa
    ctx.fillStyle = '#7a4f2a';
    ctx.fillRect(px + 5, py + 3 + bob, 14, 3);
    ctx.fillRect(px + 8, py + 1 + bob, 8, 3);
    // lampiao
    ctx.fillStyle = '#ffce6b';
    ctx.fillRect(px + 17, py + 12 + bob, 4, 4);
  }

  lampiao(ctx, c) {
    // O lampiao e clima, nao nevoa de guerra. A primeira versao escurecia as
    // bordas ate 74% e escondia metade do tabuleiro — num jogo de puzzle isso
    // nao e atmosfera, e sabotagem: quem planeja precisa ver a sala inteira.
    const j = c.jogador;
    const cx = j.x * TILE + TILE / 2, cy = j.y * TILE + TILE / 2;
    const tremor = 1 + Math.sin(this.tempo * 0.18) * 0.03;

    const g = ctx.createRadialGradient(cx, cy, 40, cx, cy, 330 * tremor);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(8,5,3,.26)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L, A);

    const q = ctx.createRadialGradient(cx, cy, 0, cx, cy, 92 * tremor);
    q.addColorStop(0, 'rgba(255,196,110,.15)');
    q.addColorStop(1, 'rgba(255,196,110,0)');
    ctx.fillStyle = q;
    ctx.fillRect(0, 0, L, A);
  }

  desenharPoeira(ctx) {
    ctx.fillStyle = 'rgba(232,206,158,.30)';
    for (const p of this.poeira) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 7);
      ctx.fill();
    }
  }
}

export class Particulas {
  constructor() { this.itens = []; }
  criar(x, y, n, cor, forca = 1.6, vida = 24) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * forca;
      this.itens.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6,
        vida: vida * (0.6 + Math.random() * 0.6), max: vida, cor,
      });
    }
  }
  passo() {
    for (const p of this.itens) { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= .95; p.vida--; }
    this.itens = this.itens.filter(p => p.vida > 0);
  }
  limpar() { this.itens.length = 0; }
  desenhar(ctx) {
    for (const p of this.itens) {
      ctx.globalAlpha = Math.max(0, p.vida / p.max);
      ctx.fillStyle = p.cor;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
    ctx.globalAlpha = 1;
  }
}
