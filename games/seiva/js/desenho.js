// Render do tronco. Tudo em canvas, sem arquivo de imagem.
//
// Defesa de torre e um jogo de ler o tabuleiro de longe: o que importa aqui e
// que trilha, terra boa e casca se distingam num relance, e que o alcance da
// torre selecionada apareca antes de plantar, nao depois.

import { LARGURA, ALTURA, TILE, TRILHA, CORACAO, naTrilha, naCasca, podePlantar, TORRES } from './mapa.js';

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
    this.faiscas = [];
  }

  passo() { this.tempo++; }

  quadro(j, { hover, tipoEscolhido, selecionada, reduzido }) {
    const ctx = this.ctx;
    this.fundo(ctx);
    this.trilha(ctx, reduzido);
    this.terra(ctx, j, tipoEscolhido);
    this.coracao(ctx, j);
    if (hover) this.previa(ctx, j, hover, tipoEscolhido);
    if (selecionada) this.alcance(ctx, selecionada, '#f6e7a8');
    this.torres(ctx, j);
    this.pragas(ctx, j);
    this.tiros(ctx, j);
  }

  // A hierarquia de contraste e o jogo: a trilha precisa saltar, porque e por
  // onde a praga vem; a terra boa vem depois; a casca e so cenario. A primeira
  // versao pintou os tres em marrons do mesmo valor e o tabuleiro sumiu.
  fundo(ctx) {
    ctx.fillStyle = '#17120d';
    ctx.fillRect(0, 0, L, A);
    for (let y = 0; y < ALTURA; y++) {
      for (let x = 0; x < LARGURA; x++) {
        if (naTrilha(x, y) || naCasca(x, y)) continue;
        const n = ruido(x, y);
        // Terra plantavel puxa para o verde escuro: diz "aqui cresce" sem rotulo.
        ctx.fillStyle = n > .72 ? '#232a1c' : n > .4 ? '#1f2519' : '#1c2116';
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        if (n > .85) {
          ctx.fillStyle = 'rgba(120,150,90,.13)';
          ctx.fillRect(x * TILE + 6 + n * 12, y * TILE + 8 + n * 10, 2, 3);
        }
      }
    }
    // Casca: blocos altos e escuros, com relevo. Cenario, nao tabuleiro.
    for (let y = 0; y < ALTURA; y++) {
      for (let x = 0; x < LARGURA; x++) {
        if (!naCasca(x, y)) continue;
        const px = x * TILE, py = y * TILE;
        ctx.fillStyle = '#2c1e14';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#3b2919';
        ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 3);
        ctx.fillStyle = 'rgba(96,68,40,.55)';
        ctx.fillRect(px + 1, py + 1, TILE - 2, 2);
        ctx.fillStyle = 'rgba(12,7,4,.6)';
        ctx.fillRect(px + 4, py + 9, TILE - 8, 2);
        ctx.fillRect(px + 7, py + 19, TILE - 14, 2);
      }
    }
  }

  trilha(ctx, reduzido) {
    // Canal claro com borda escura: e o elemento que mais precisa saltar.
    for (const [x, y] of TRILHA) {
      const px = x * TILE, py = y * TILE;
      ctx.fillStyle = '#7d5a34';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#916a3e';
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
    }
    // Borda so onde a trilha encosta em algo que nao e trilha: desenha o canal.
    ctx.fillStyle = 'rgba(38,24,12,.85)';
    for (const [x, y] of TRILHA) {
      const px = x * TILE, py = y * TILE;
      if (!naTrilha(x, y - 1)) ctx.fillRect(px, py, TILE, 2);
      if (!naTrilha(x, y + 1)) ctx.fillRect(px, py + TILE - 2, TILE, 2);
      if (!naTrilha(x - 1, y)) ctx.fillRect(px, py, 2, TILE);
      if (!naTrilha(x + 1, y)) ctx.fillRect(px + TILE - 2, py, 2, TILE);
    }
    if (reduzido) return;
    // Seiva escorrendo: mostra o sentido da marcha sem precisar de seta.
    for (let i = 0; i < TRILHA.length; i++) {
      const [x, y] = TRILHA[i];
      const fase = (this.tempo * 0.9 - i * 9) % 150;
      if (fase >= 0 && fase < 14) {
        ctx.fillStyle = `rgba(250,205,120,${0.5 - fase / 30})`;
        ctx.fillRect(x * TILE + 8, y * TILE + 8, TILE - 16, TILE - 16);
      }
    }
  }

  terra(ctx, j, tipoEscolhido) {
    if (!tipoEscolhido) return;
    // Cantinhos, nao caixas: a versao com retangulo inteiro virava uma grade
    // que competia com a trilha e escondia o mapa.
    ctx.fillStyle = 'rgba(214,232,140,.55)';
    for (let y = 0; y < ALTURA; y++) {
      for (let x = 0; x < LARGURA; x++) {
        if (!podePlantar(x, y) || j.torreEm(x, y)) continue;
        const px = x * TILE, py = y * TILE;
        for (const [ox, oy] of [[3, 3], [TILE - 6, 3], [3, TILE - 6], [TILE - 6, TILE - 6]]) {
          ctx.fillRect(px + ox, py + oy, 3, 3);
        }
      }
    }
  }

  previa(ctx, j, hover, tipoEscolhido) {
    const { x, y } = hover;
    if (!tipoEscolhido) return;
    const pode = podePlantar(x, y) && !j.torreEm(x, y) && j.seiva >= j.custoDe(tipoEscolhido);
    ctx.fillStyle = pode ? 'rgba(214,232,140,.20)' : 'rgba(232,119,107,.22)';
    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    if (pode) this.alcance(ctx, { x, y, alcance: TORRES[tipoEscolhido].alcance }, '#d6e88c');
  }

  alcance(ctx, t, cor) {
    ctx.strokeStyle = cor;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2, t.alcance * TILE, 0, 7);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  coracao(ctx, j) {
    const [x, y] = CORACAO;
    const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
    const pulso = (Math.sin(this.tempo * 0.06) + 1) / 2;
    const fraco = j.vidas <= 4;
    const cor = fraco ? '232,119,107' : '240,190,90';
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, TILE * 1.8);
    g.addColorStop(0, `rgba(${cor},${.5 + pulso * .3})`);
    g.addColorStop(1, `rgba(${cor},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(cx - TILE * 2, cy - TILE * 2, TILE * 4, TILE * 4);
    ctx.fillStyle = fraco ? '#e8776b' : '#f0be5a';
    ctx.beginPath();
    ctx.arc(cx, cy, 7 + pulso * 1.6, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#fff3d0';
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 2, 2.4, 0, 7);
    ctx.fill();
  }

  torres(ctx, j) {
    for (const t of j.torres) {
      const px = t.x * TILE, py = t.y * TILE;
      const cx = px + TILE / 2, cy = py + TILE / 2;
      const cor = TORRES[t.tipo].cor;
      const dois = t.nivel > 1;

      ctx.fillStyle = 'rgba(12,8,5,.45)';
      ctx.beginPath();
      ctx.ellipse(cx, py + TILE - 4, 11, 4, 0, 0, 7);
      ctx.fill();

      ctx.fillStyle = '#2e2117';
      ctx.fillRect(px + 7, py + 14, TILE - 14, TILE - 16);

      // Cada torre tem silhueta propria: e o que deixa ler o tabuleiro de longe.
      ctx.fillStyle = cor;
      if (t.tipo === 'espinho') {
        ctx.beginPath();
        ctx.moveTo(cx, py + 4); ctx.lineTo(cx + 7, py + 18); ctx.lineTo(cx - 7, py + 18);
        ctx.fill();
      } else if (t.tipo === 'esporo') {
        ctx.beginPath(); ctx.arc(cx, py + 12, 8, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(30,50,28,.5)';
        for (let i = 0; i < 4; i++) ctx.fillRect(cx - 6 + i * 4, py + 8, 2, 2);
      } else if (t.tipo === 'resina') {
        ctx.beginPath();
        ctx.moveTo(cx, py + 3);
        ctx.bezierCurveTo(cx + 9, py + 13, cx + 7, py + 20, cx, py + 20);
        ctx.bezierCurveTo(cx - 7, py + 20, cx - 9, py + 13, cx, py + 3);
        ctx.fill();
      } else {
        ctx.fillRect(cx - 3, py + 2, 6, 17);
        ctx.beginPath();
        ctx.moveTo(cx, py + 1); ctx.lineTo(cx + 6, py + 9); ctx.lineTo(cx - 6, py + 9);
        ctx.fill();
      }

      if (dois) {
        ctx.strokeStyle = '#fff3d0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 13, 0, 7);
        ctx.stroke();
      }
    }
  }

  pragas(ctx, j) {
    for (const p of j.pragas) {
      const pos = j.posicaoDe(p);
      const cx = pos.x * TILE + TILE / 2, cy = pos.y * TILE + TILE / 2;
      const r = p.tipo === 'fungo' ? 10 : p.tipo === 'besouro' ? 8 : 6;

      ctx.fillStyle = 'rgba(10,6,4,.4)';
      ctx.beginPath(); ctx.ellipse(cx, cy + r - 1, r, r * .4, 0, 0, 7); ctx.fill();

      ctx.fillStyle = p.cor;
      ctx.beginPath(); ctx.ellipse(cx, cy, r, r * .8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.beginPath(); ctx.ellipse(cx - r * .3, cy - r * .3, r * .35, r * .28, 0, 0, 7); ctx.fill();

      // Casca dura marcada com risco: por que a torre fraca nao esta furando.
      if (p.casca > 0) {
        ctx.strokeStyle = 'rgba(220,230,255,.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, r + 1.5, -2.3, -0.8); ctx.stroke();
      }
      if (p.lento > 0) {
        ctx.fillStyle = 'rgba(240,169,75,.45)';
        ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, 7); ctx.fill();
      }

      const frac = Math.max(0, p.vida / p.vidaMax);
      if (frac < 1) {
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillRect(cx - 10, cy - r - 7, 20, 3);
        ctx.fillStyle = frac > .5 ? '#8fd98a' : frac > .25 ? '#f0a94b' : '#e8776b';
        ctx.fillRect(cx - 10, cy - r - 7, 20 * frac, 3);
      }
    }
  }

  tiros(ctx, j) {
    for (const t of j.tiros) {
      ctx.fillStyle = t.cor;
      ctx.beginPath();
      ctx.arc(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2, 3, 0, 7);
      ctx.fill();
    }
  }
}

export class Particulas {
  constructor() { this.itens = []; }
  criar(x, y, n, cor, forca = 2, vida = 24) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = Math.random() * forca;
      this.itens.push({
        x: x * TILE + TILE / 2, y: y * TILE + TILE / 2,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        vida: vida * (.6 + Math.random() * .6), max: vida, cor,
      });
    }
  }
  passo() {
    for (const p of this.itens) { p.x += p.vx; p.y += p.vy; p.vy += .1; p.vx *= .94; p.vida--; }
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
