// Tudo desenhado em canvas: nao ha um arquivo de imagem no jogo. Textura de
// metal, chuva, relampago e a sonda saem daqui, o que mantem a pasta leve e o
// visual coerente sem depender de asset.

import {
  TILE, LARGURA, ALTURA, SOLIDO, QUEBRADICA, VENTO,
  ESPINHO_CIMA, ESPINHO_BAIXO, ESPINHO_ESQ, ESPINHO_DIR,
} from './mundo.js';

const L = LARGURA * TILE;
const A = ALTURA * TILE;

// Ruido estavel por tile: a mesma pedra tem sempre a mesma cara, senao a
// parede "ferve" a cada quadro.
function ruido(x, y) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

export class Desenho {
  constructor(ctx) {
    this.ctx = ctx;
    this.tempo = 0;
    this.tremor = 0;
    this.clarao = 0;
    this.proximoRaio = 120 + Math.random() * 260;
    this.chuva = [];
    for (let i = 0; i < 110; i++) {
      this.chuva.push({
        x: Math.random() * L,
        y: Math.random() * A,
        v: 5.5 + Math.random() * 4.5,
        c: 4 + Math.random() * 7,
      });
    }
  }

  passo(reduzido) {
    this.tempo++;
    if (this.tremor > 0) this.tremor -= 1;
    if (this.clarao > 0) this.clarao -= 0.045;

    if (!reduzido) {
      for (const g of this.chuva) {
        g.y += g.v;
        g.x += g.v * 0.32;
        if (g.y > A) { g.y = -8; g.x = Math.random() * L; }
        if (g.x > L) g.x -= L;
      }
      if (--this.proximoRaio <= 0) {
        this.clarao = 1;
        this.proximoRaio = 200 + Math.random() * 420;
      }
    }
  }

  sacudir(forca) { this.tremor = Math.max(this.tremor, forca); }

  quadro(mundo, sonda, particulas, reduzido) {
    const ctx = this.ctx;
    ctx.save();

    if (this.tremor > 0 && !reduzido) {
      const t = this.tremor * 0.5;
      ctx.translate((Math.random() - .5) * t, (Math.random() - .5) * t);
    }

    this.fundo(ctx);
    if (!reduzido) this.desenharChuva(ctx);
    // Veu entre cenario e jogo: sem ele, predio de fundo e plataforma tem brilho
    // parecido e o jogador nao sabe num relance no que da para pisar.
    ctx.fillStyle = 'rgba(6,9,18,.55)';
    ctx.fillRect(0, 0, L, A);
    this.desenharMundo(ctx, mundo);
    this.desenharFagulhas(ctx, mundo);
    this.desenharAntena(ctx, mundo);
    particulas.desenhar(ctx);
    this.desenharSonda(ctx, sonda);

    if (this.clarao > 0) {
      ctx.fillStyle = `rgba(215,236,255,${this.clarao * 0.22})`;
      ctx.fillRect(-20, -20, L + 40, A + 40);
    }
    ctx.restore();
  }

  fundo(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, A);
    g.addColorStop(0, '#060912');
    g.addColorStop(0.55, '#0c1526');
    g.addColorStop(1, '#131f38');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L, A);
    // Silhueta de torres ao fundo, so para a tela nao ser um vazio chapado.
    ctx.fillStyle = '#080d19';
    for (let i = 0; i < 9; i++) {
      const bx = i * 61 + 8;
      const bh = 40 + ruido(i, 3) * 90;
      ctx.fillRect(bx, A - bh, 34, bh);
    }
    ctx.fillStyle = 'rgba(28,46,80,.22)';
    for (let i = 0; i < 9; i++) {
      const bx = i * 61 + 8;
      const bh = 40 + ruido(i, 3) * 90;
      ctx.fillRect(bx, A - bh, 34, 1);
    }
  }

  desenharChuva(ctx) {
    ctx.strokeStyle = 'rgba(150,185,235,.30)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const g of this.chuva) {
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x - g.c * .32, g.y - g.c);
    }
    ctx.stroke();
  }

  desenharMundo(ctx, mundo) {
    for (let cy = 0; cy < ALTURA; cy++) {
      for (let cx = 0; cx < LARGURA; cx++) {
        const t = mundo.tile(cx, cy);
        if (t === 0) continue;
        const x = cx * TILE, y = cy * TILE;
        if (t === SOLIDO) this.bloco(ctx, x, y, cx, cy, mundo);
        else if (t === QUEBRADICA) this.quebradica(ctx, x, y, mundo, cx, cy);
        else if (t === VENTO) this.ventoTile(ctx, x, y, cx, cy);
        else this.espinho(ctx, x, y, t);
      }
    }
  }

  bloco(ctx, x, y, cx, cy, mundo) {
    const n = ruido(cx, cy);
    ctx.fillStyle = n > .72 ? '#3a4a6d' : n > .4 ? '#334263' : '#2d3a57';
    ctx.fillRect(x, y, TILE, TILE);
    // Brilho so na face exposta ao ceu: da leitura imediata de onde da para pisar.
    if (!mundo.solido(cx, cy - 1)) {
      ctx.fillStyle = '#6d8db9';
      ctx.fillRect(x, y, TILE, 2);
      ctx.fillStyle = 'rgba(150,195,245,.30)';
      ctx.fillRect(x, y + 2, TILE, 1);
    }
    if (!mundo.solido(cx - 1, cy)) {
      ctx.fillStyle = 'rgba(110,145,200,.40)';
      ctx.fillRect(x, y, 1, TILE);
    }
    if (n > .88) {
      ctx.fillStyle = 'rgba(10,14,24,.5)';
      ctx.fillRect(x + 4 + n * 5, y + 5 + n * 4, 3, 2);
    }
  }

  quebradica(ctx, x, y, mundo, cx, cy) {
    const chave = cy * LARGURA + cx;
    const restante = mundo.quebradas.get(chave);
    const tremendo = restante !== undefined && restante > 0;
    const dx = tremendo ? (Math.random() - .5) * 1.6 : 0;
    ctx.fillStyle = tremendo ? '#5a4326' : '#3a3322';
    ctx.fillRect(x + dx, y, TILE, TILE);
    ctx.fillStyle = tremendo ? '#c98a3a' : '#7a6a42';
    ctx.fillRect(x + dx, y, TILE, 2);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(x + dx + 3, y + 6, 10, 1);
    ctx.fillRect(x + dx + 6, y + 10, 5, 1);
  }

  ventoTile(ctx, x, y, cx, cy) {
    // A corrente precisa gritar que e corrente: na primeira versao era um risco
    // fino e ninguem lia a coluna como algo que empurra.
    ctx.fillStyle = 'rgba(95,190,235,.13)';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = 'rgba(150,225,255,.10)';
    ctx.fillRect(x, y, 1, TILE);
    ctx.fillRect(x + TILE - 1, y, 1, TILE);
    ctx.strokeStyle = 'rgba(175,235,255,.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const fase = (this.tempo * 2.6 + cx * 37 + i * 62 + cy * 11) % 96;
      const py = y + TILE - (fase / 96) * TILE * 3;
      if (py > y - TILE && py < y + TILE) {
        const px = x + 3 + i * 5;
        ctx.moveTo(px, py);
        ctx.lineTo(px, py + 7);
        // seta apontando para cima, para a direcao do empurrao ser obvia
        ctx.moveTo(px - 1.6, py + 2.4);
        ctx.lineTo(px, py);
        ctx.lineTo(px + 1.6, py + 2.4);
      }
    }
    ctx.stroke();
  }

  espinho(ctx, x, y, t) {
    ctx.fillStyle = '#8fa4c6';
    const p = ctx;
    p.beginPath();
    if (t === ESPINHO_CIMA) {
      for (let i = 0; i < 4; i++) {
        p.moveTo(x + i * 4, y + TILE);
        p.lineTo(x + i * 4 + 2, y + 4);
        p.lineTo(x + i * 4 + 4, y + TILE);
      }
    } else if (t === ESPINHO_BAIXO) {
      for (let i = 0; i < 4; i++) {
        p.moveTo(x + i * 4, y);
        p.lineTo(x + i * 4 + 2, y + TILE - 4);
        p.lineTo(x + i * 4 + 4, y);
      }
    } else if (t === ESPINHO_ESQ) {
      for (let i = 0; i < 4; i++) {
        p.moveTo(x + TILE, y + i * 4);
        p.lineTo(x + 4, y + i * 4 + 2);
        p.lineTo(x + TILE, y + i * 4 + 4);
      }
    } else {
      for (let i = 0; i < 4; i++) {
        p.moveTo(x, y + i * 4);
        p.lineTo(x + TILE - 4, y + i * 4 + 2);
        p.lineTo(x, y + i * 4 + 4);
      }
    }
    p.fill();
    p.fillStyle = 'rgba(255,255,255,.35)';
    if (t === ESPINHO_CIMA) p.fillRect(x, y + TILE - 2, TILE, 2);
  }

  desenharFagulhas(ctx, mundo) {
    for (const f of mundo.fagulhas) {
      if (f.pego) continue;
      const osc = Math.sin(this.tempo * 0.09 + f.x) * 1.8;
      const r = 3 + Math.sin(this.tempo * 0.15 + f.y) * 0.5;
      ctx.fillStyle = 'rgba(255,207,107,.18)';
      ctx.beginPath();
      ctx.arc(f.x, f.y + osc, r + 4, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#ffcf6b';
      ctx.beginPath();
      ctx.arc(f.x, f.y + osc, r, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#fff6df';
      ctx.fillRect(f.x - 1, f.y + osc - 1, 2, 2);
    }
  }

  desenharAntena(ctx, mundo) {
    const s = mundo.saida;
    if (!s) return;
    const pulso = (Math.sin(this.tempo * 0.07) + 1) / 2;
    const x = s.x + TILE / 2, base = s.y + TILE;
    ctx.strokeStyle = '#8aa6d6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, s.y - 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(120,240,220,${.35 + pulso * .5})`;
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const r = 3 + i * 3.6 + pulso * 2.4;
      ctx.beginPath();
      ctx.arc(x, s.y - 2, r, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(150,255,235,${.55 + pulso * .45})`;
    ctx.beginPath();
    ctx.arc(x, s.y - 2, 2.6, 0, 7);
    ctx.fill();
  }

  desenharSonda(ctx, s) {
    if (s.morta) return;
    for (const r of s.rastro) {
      ctx.fillStyle = `rgba(150,235,255,${r.vida / 34})`;
      ctx.fillRect(r.x, r.y, s.w, s.h);
    }
    const x = Math.round(s.x), y = Math.round(s.y);
    const semInvestida = !s.temInvestida;

    ctx.fillStyle = 'rgba(255,207,107,.16)';
    ctx.beginPath();
    ctx.arc(x + s.w / 2, y + s.h / 2, 11, 0, 7);
    ctx.fill();

    ctx.fillStyle = semInvestida ? '#7f8ba6' : '#ffcf6b';
    ctx.fillRect(x, y + 1, s.w, s.h - 2);
    ctx.fillRect(x + 1, y, s.w - 2, s.h);

    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(x + 1, y + s.h - 3, s.w - 2, 2);

    // O visor olha para onde a sonda anda: leitura de direcao sem animacao.
    ctx.fillStyle = '#10233a';
    const vx = s.olhando > 0 ? x + s.w - 5 : x + 2;
    ctx.fillRect(vx, y + 3, 3, 3);
    ctx.fillStyle = '#9fe8ff';
    ctx.fillRect(vx, y + 3, 2, 2);

    if (s.investindo > 0) {
      ctx.strokeStyle = 'rgba(190,245,255,.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 1.5, y - 1.5, s.w + 3, s.h + 3);
    }
  }
}

export class Particulas {
  constructor() { this.itens = []; }

  criar(x, y, quantidade, cor, forca = 2, vida = 26) {
    for (let i = 0; i < quantidade; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * forca;
      this.itens.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 0.5,
        vida: vida * (0.6 + Math.random() * 0.6),
        max: vida,
        cor,
        t: Math.random() < .5 ? 2 : 1,
      });
    }
  }

  passo() {
    for (const p of this.itens) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.14;
      p.vx *= 0.96;
      p.vida--;
    }
    this.itens = this.itens.filter(p => p.vida > 0);
  }

  limpar() { this.itens.length = 0; }

  desenhar(ctx) {
    for (const p of this.itens) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.vida / p.max));
      ctx.fillStyle = p.cor;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.t, p.t);
    }
    ctx.globalAlpha = 1;
  }
}
