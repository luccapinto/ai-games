// Render de cima, por tile, com a camera presa no jogador.
//
// Duas coisas que o render precisa dizer sem texto: onde tem agua (a mata do
// vale e verde-escura e se ve de longe) e que hora e (a luz do dia multiplica a
// cor de tudo, e de madrugada o sertao fica azul). A segunda e mecanica: de
// madrugada se anda mais longe com o mesmo cantil.

import { TERRENOS, tile, naEstrada } from './mundo.js';
import { CONFIG } from './regras.js';
import { BICHOS, claridade, calorDaHora } from './jogo.js';

const TAM = 26;

// Tres tons por terreno, com pouca diferenca entre eles de proposito: a
// primeira versao usava variacao forte e o chao virava um tabuleiro de xadrez.
const CORES = {
  [TERRENOS.caatinga]: ['#8a7346', '#856e43', '#8f784a'],
  [TERRENOS.mata]: ['#3f5c34', '#3b5731', '#436137'],
  [TERRENOS.roca]: ['#9a7f4a', '#957a47', '#9f844d'],
  [TERRENOS.salina]: ['#c9c3b2', '#c5bfae', '#cdc7b6'],
  [TERRENOS.serra]: ['#6b6258', '#675e54', '#6f665c'],
  [TERRENOS.agua]: ['#2f5f6e', '#2c5b6a', '#326372'],
};

export function criarRender(canvas) {
  const ctx = canvas.getContext('2d');
  const menosMovimento = !!(window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const particulas = [];

  function tinta(hora) {
    const luz = claridade(hora);
    const noite = 1 - luz;
    return {
      luz,
      // De dia a cor sai como e; de noite ela e comprimida e puxada para azul.
      aplicar(cor) {
        return cor;
      },
      veu: `rgba(14,20,48,${noite * 0.62})`,
      calor: calorDaHora(hora),
    };
  }

  function desenhar(jogo, dt) {
    const j = jogo.jogador;
    const largura = canvas.width;
    const altura = canvas.height;
    const t = tinta(jogo.hora);

    const colunas = Math.ceil(largura / TAM) + 2;
    const linhas = Math.ceil(altura / TAM) + 2;
    const x0 = Math.floor(j.x - colunas / 2);
    const y0 = Math.floor(j.y - linhas / 2);
    const desloque = (x, y) => ({
      x: (x - j.x) * TAM + largura / 2,
      y: (y - j.y) * TAM + altura / 2,
    });

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#12100c';
    ctx.fillRect(0, 0, largura, altura);

    // --- chao ------------------------------------------------------------
    for (let y = y0; y < y0 + linhas; y++) {
      for (let x = x0; x < x0 + colunas; x++) {
        const codigo = tile(jogo.mundo, x, y);
        const paleta = CORES[codigo] || CORES[TERRENOS.caatinga];
        const variacao = ((x * 73856093) ^ (y * 19349663)) & 2;
        const p = desloque(x, y);
        ctx.fillStyle = paleta[variacao];
        ctx.fillRect(p.x, p.y, TAM + 1, TAM + 1);

        if (naEstrada(jogo.mundo, x, y)) {
          // Trilha arredondada: quadrado claro por celula virava calcada.
          ctx.fillStyle = 'rgba(196,174,126,0.5)';
          ctx.beginPath();
          ctx.arc(p.x + TAM / 2, p.y + TAM / 2, TAM * 0.46, 0, Math.PI * 2);
          ctx.fill();
        }
        detalhe(ctx, codigo, x, y, p, jogo.tempo);
      }
    }

    // --- vilas -----------------------------------------------------------
    for (const vila of jogo.mundo.vilas) {
      if (Math.abs(vila.x - j.x) > colunas || Math.abs(vila.y - j.y) > linhas) continue;
      for (const casa of vila.casas) {
        const p = desloque(casa.x, casa.y);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(casa.ang * 0.15);
        ctx.fillStyle = '#6e5233';
        ctx.fillRect(-TAM * 0.55, -TAM * 0.5, TAM * 1.1, TAM);
        ctx.fillStyle = '#8f6a41';
        ctx.fillRect(-TAM * 0.62, -TAM * 0.62, TAM * 1.24, TAM * 0.4);
        ctx.fillStyle = '#3a2b1b';
        ctx.fillRect(-TAM * 0.12, TAM * 0.1, TAM * 0.24, TAM * 0.4);
        ctx.restore();
      }
      const pa = desloque(vila.agua.x + 0.5, vila.agua.y + 0.5);
      ctx.fillStyle = '#2f5f6e';
      ctx.beginPath();
      ctx.arc(pa.x, pa.y, TAM * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6b5a3a';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // --- recursos --------------------------------------------------------
    for (const r of jogo.mundo.recursos) {
      if (r.pego) continue;
      if (Math.abs(r.x - j.x) > colunas / 2 + 2 || Math.abs(r.y - j.y) > linhas / 2 + 2) continue;
      const p = desloque(r.x, r.y);
      desenharRecurso(ctx, r.tipo, p, jogo.tempo);
    }

    // --- NPCs ------------------------------------------------------------
    for (const vila of jogo.mundo.vilas) {
      for (const npc of vila.npcs) {
        if (Math.abs(npc.x - j.x) > colunas / 2 + 2 || Math.abs(npc.y - j.y) > linhas / 2 + 2) continue;
        const p = desloque(npc.x, npc.y);
        gente(ctx, p, '#c8b893', '#40342a', 0);
        ctx.fillStyle = 'rgba(240,238,228,0.9)';
        ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(npc.nome, p.x, p.y - TAM * 0.7);
      }
    }

    // --- bichos ----------------------------------------------------------
    for (const bicho of jogo.inimigos) {
      if (bicho.vida <= 0) continue;
      const p = desloque(bicho.x, bicho.y);
      const modelo = BICHOS[bicho.tipo];
      if (bicho.tipo === 'onca') {
        ctx.fillStyle = modelo.cor;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, TAM * 0.55, TAM * 0.34, bicho.ang, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3a2a16';
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.arc(p.x - TAM * 0.3 + i * TAM * 0.16, p.y + (i % 2 ? 3 : -3), 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        gente(ctx, p, modelo.cor, '#2e2318', bicho.ang);
        ctx.fillStyle = '#d8d2c4';
        ctx.fillRect(p.x - 2, p.y - TAM * 0.2, 4, TAM * 0.5);
      }
      const vidaFração = bicho.vida / modelo.vida;
      ctx.fillStyle = '#2a1a16';
      ctx.fillRect(p.x - TAM * 0.4, p.y - TAM * 0.66, TAM * 0.8, 3);
      ctx.fillStyle = '#c03a2a';
      ctx.fillRect(p.x - TAM * 0.4, p.y - TAM * 0.66, TAM * 0.8 * vidaFração, 3);
    }

    // --- jogador ---------------------------------------------------------
    const pj = { x: largura / 2, y: altura / 2 };
    // Anel sob os pes: a esta escala o jogador e do tamanho do cangaceiro, e a
    // captura de tela mostrou que nao dava para saber qual era qual.
    ctx.strokeStyle = 'rgba(255,255,255,0.62)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(pj.x, pj.y + TAM * 0.34, TAM * 0.44, TAM * 0.2, 0, 0, Math.PI * 2);
    ctx.stroke();
    gente(ctx, pj, '#e4dcc4', '#2f2a20', j.ang);
    ctx.fillStyle = '#6b4a28';
    ctx.beginPath();
    ctx.ellipse(pj.x, pj.y - TAM * 0.2, TAM * 0.42, TAM * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- particulas ------------------------------------------------------
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dt;
      if (p.vida <= 0) { particulas.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const q = desloque(p.x, p.y);
      ctx.fillStyle = `rgba(${p.cor[0]},${p.cor[1]},${p.cor[2]},${Math.min(0.8, p.vida * 2)})`;
      ctx.fillRect(q.x - 2, q.y - 2, 5, 5);
    }

    // --- luz do dia ------------------------------------------------------
    if (t.luz < 0.99) {
      ctx.fillStyle = t.veu;
      ctx.fillRect(0, 0, largura, altura);
      // lampião do jogador: circulo de luz que devolve a cor de perto
      const raio = TAM * 5.2;
      const g = ctx.createRadialGradient(pj.x, pj.y, TAM, pj.x, pj.y, raio);
      g.addColorStop(0, `rgba(255,224,150,${0.3 * (1 - t.luz)})`);
      g.addColorStop(1, 'rgba(255,224,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, largura, altura);
    }
    if (t.calor > 0.55 && !menosMovimento) {
      // tremor de calor no horizonte do meio-dia, so por cima
      ctx.fillStyle = `rgba(255,236,190,${(t.calor - 0.55) * 0.18})`;
      ctx.fillRect(0, 0, largura, altura);
    }
    if (j.dor > 0.02) {
      ctx.fillStyle = `rgba(150,20,20,${0.28 * j.dor})`;
      ctx.fillRect(0, 0, largura, altura);
    }
  }

  function evento(ev) {
    if (ev.tipo === 'acerto' || ev.tipo === 'abate') {
      const n = ev.tipo === 'abate' ? 16 : 6;
      for (let i = 0; i < n; i++) {
        particulas.push({
          x: ev.x, y: ev.y,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          vida: 0.3 + Math.random() * 0.5,
          cor: [170, 40, 30],
        });
      }
    } else if (ev.tipo === 'bebeu') {
      for (let i = 0; i < 10; i++) {
        particulas.push({
          x: 0, y: 0, vx: 0, vy: 0, vida: 0, cor: [120, 200, 220],
        });
      }
    }
  }

  function desenharMapa(mapaCanvas, jogo, vistos) {
    const m = mapaCanvas.getContext('2d');
    const mundo = jogo.mundo;
    const escala = mapaCanvas.width / mundo.largura;
    m.fillStyle = '#0e0c08';
    m.fillRect(0, 0, mapaCanvas.width, mapaCanvas.height);
    const passo = 2;
    for (let y = 0; y < mundo.altura; y += passo) {
      for (let x = 0; x < mundo.largura; x += passo) {
        if (!vistos[y * mundo.largura + x]) continue;
        const codigo = mundo.terreno[y * mundo.largura + x];
        m.fillStyle = (CORES[codigo] || CORES[0])[0];
        m.fillRect(x * escala, y * escala, escala * passo, escala * passo);
      }
    }
    for (const vila of mundo.vilas) {
      if (!vistos[vila.y * mundo.largura + vila.x]) continue;
      m.fillStyle = '#e8c24a';
      m.fillRect(vila.x * escala - 2, vila.y * escala - 2, 5, 5);
    }
    const j = jogo.jogador;
    m.fillStyle = '#ffffff';
    m.fillRect(j.x * escala - 1.5, j.y * escala - 1.5, 4, 4);
  }

  return { desenhar, evento, desenharMapa, get tam() { return TAM; } };
}

function detalhe(ctx, codigo, x, y, p, tempo) {
  const semente = ((x * 374761393) ^ (y * 668265263)) >>> 0;
  const r = (n) => ((semente >> (n * 3)) & 7) / 7;
  if (codigo === TERRENOS.caatinga) {
    if (r(1) > 0.72) {
      // mandacaru: tres tracos verticais
      ctx.fillStyle = '#4e6b39';
      const cx = p.x + TAM * (0.2 + r(2) * 0.5);
      const cy = p.y + TAM * (0.25 + r(3) * 0.4);
      ctx.fillRect(cx, cy, 3, TAM * 0.42);
      ctx.fillRect(cx - 4, cy + 4, 3, TAM * 0.22);
      ctx.fillRect(cx + 4, cy + 6, 3, TAM * 0.2);
    } else if (r(4) > 0.5) {
      ctx.fillStyle = 'rgba(60,48,28,0.35)';
      ctx.fillRect(p.x + TAM * r(5), p.y + TAM * r(6), 3, 2);
    }
  } else if (codigo === TERRENOS.mata) {
    ctx.fillStyle = '#2b4526';
    ctx.beginPath();
    ctx.arc(p.x + TAM * (0.3 + r(1) * 0.4), p.y + TAM * (0.3 + r(2) * 0.4),
      TAM * (0.2 + r(3) * 0.14), 0, Math.PI * 2);
    ctx.fill();
  } else if (codigo === TERRENOS.serra) {
    ctx.fillStyle = '#4a433b';
    ctx.beginPath();
    ctx.moveTo(p.x + TAM * 0.2, p.y + TAM * 0.8);
    ctx.lineTo(p.x + TAM * (0.4 + r(1) * 0.2), p.y + TAM * 0.15);
    ctx.lineTo(p.x + TAM * 0.85, p.y + TAM * 0.82);
    ctx.closePath();
    ctx.fill();
  } else if (codigo === TERRENOS.agua) {
    ctx.strokeStyle = 'rgba(180,220,230,0.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const fase = tempo * 1.6 + semente % 6;
    ctx.moveTo(p.x + 3, p.y + TAM * 0.4 + Math.sin(fase) * 2);
    ctx.lineTo(p.x + TAM - 3, p.y + TAM * 0.6 + Math.cos(fase) * 2);
    ctx.stroke();
  } else if (codigo === TERRENOS.salina) {
    if (r(1) > 0.6) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(p.x + TAM * r(2), p.y + TAM * r(3), 2, 2);
    }
  } else if (codigo === TERRENOS.roca) {
    ctx.strokeStyle = 'rgba(80,62,34,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + TAM * 0.5);
    ctx.lineTo(p.x + TAM, p.y + TAM * 0.5);
    ctx.stroke();
  }
}

function desenharRecurso(ctx, tipo, p, tempo) {
  const flutua = Math.sin(tempo * 2 + p.x) * 1.4;
  if (tipo === 'couro') {
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(p.x - 6, p.y - 5 + flutua, 12, 9);
    ctx.fillStyle = '#5d452a';
    ctx.fillRect(p.x - 6, p.y - 2 + flutua, 12, 2);
  } else if (tipo === 'mandacaru') {
    ctx.fillStyle = '#c04a5a';
    ctx.beginPath();
    ctx.arc(p.x, p.y + flutua, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4e6b39';
    ctx.fillRect(p.x - 1, p.y + 4 + flutua, 2, 6);
  } else if (tipo === 'madeira') {
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(p.x - 8, p.y - 2 + flutua, 16, 5);
    ctx.fillStyle = '#8a6540';
    ctx.fillRect(p.x - 8, p.y - 2 + flutua, 16, 2);
  } else if (tipo === 'sal') {
    ctx.fillStyle = '#f0f0e6';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 6 + flutua);
    ctx.lineTo(p.x + 6, p.y + 4 + flutua);
    ctx.lineTo(p.x - 6, p.y + 4 + flutua);
    ctx.closePath();
    ctx.fill();
  } else if (tipo === 'peca') {
    ctx.fillStyle = '#8f949a';
    ctx.beginPath();
    ctx.arc(p.x, p.y + flutua, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f3338';
    ctx.beginPath();
    ctx.arc(p.x, p.y + flutua, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e8c24a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y + flutua, 10, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function gente(ctx, p, corRoupa, corSombra, ang) {
  const T = TAM;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + T * 0.34, T * 0.3, T * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = corSombra;
  ctx.fillRect(p.x - T * 0.13, p.y + T * 0.1, T * 0.1, T * 0.26);
  ctx.fillRect(p.x + T * 0.03, p.y + T * 0.1, T * 0.1, T * 0.26);
  ctx.fillStyle = corRoupa;
  ctx.fillRect(p.x - T * 0.19, p.y - T * 0.16, T * 0.38, T * 0.3);
  ctx.fillStyle = '#c8a988';
  ctx.beginPath();
  ctx.arc(p.x, p.y - T * 0.25, T * 0.14, 0, Math.PI * 2);
  ctx.fill();
  // braço na direção em que a pessoa está virada
  ctx.strokeStyle = corRoupa;
  ctx.lineWidth = T * 0.09;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - T * 0.05);
  ctx.lineTo(p.x + Math.cos(ang) * T * 0.3, p.y + Math.sin(ang) * T * 0.3);
  ctx.stroke();
}

export { CONFIG };
