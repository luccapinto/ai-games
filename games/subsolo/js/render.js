// O raycaster: 320x200 pixels escritos a mao, um por um.
//
// Nao ha drawImage de coluna nem sombra de CSS aqui. Cada pixel de parede, piso
// e teto passa pela mesma conta de luz — lanterna (que e um cone), lampada da
// fase (que ja vem assada na grade), clarao do tiro e neblina da paleta —
// porque a luz e a mecanica central do jogo e precisa ser a mesma coisa para
// quem ve e para quem e visto: `inimigos.js` consulta `mapa.luzDaCelula`, o
// mesmo valor que tinge o pixel.

import * as M from './mapa.js';
import { CONFIG } from './regras.js';
import { TIPOS } from './inimigos.js';
import { ARMAS } from './armas.js';
import { criarTexturas, criarSpritesInimigos, criarSpritesItens, chaveDoItem } from './texturas.js';

export const LARGURA = 320;
export const ALTURA = 200;

const FOV = 1.15;
const DIST_TELA = (LARGURA / 2) / Math.tan(FOV / 2);
const ALCANCE = 26;
const AMBIENTE = 0.055;
const NEBLINA = 21;

export function criarRender(canvas) {
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const ctx = canvas.getContext('2d', { alpha: false });
  const imagem = ctx.createImageData(LARGURA, ALTURA);
  const buf = imagem.data;
  for (let i = 3; i < buf.length; i += 4) buf[i] = 255;

  const zbuffer = new Float32Array(LARGURA);
  const desvios = new Float32Array(LARGURA);
  const cosDesvios = new Float32Array(LARGURA);
  const cones = new Float32Array(LARGURA);
  for (let x = 0; x < LARGURA; x++) {
    const d = Math.atan2(x - LARGURA / 2, DIST_TELA);
    desvios[x] = d;
    cosDesvios[x] = Math.cos(d);
    const t = Math.abs(d) / (FOV * 0.62);
    cones[x] = Math.max(0, 1 - t * t);
  }

  const spritesInimigos = criarSpritesInimigos(TIPOS);

  // Quem pede menos movimento no sistema perde o cabeceio, o tremor de dano e o
  // balanco da arma. Nada disso e informacao de jogo.
  const menosMovimento = !!(window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const spritesItens = criarSpritesItens();
  let texturas = null;
  let fundo = [10, 8, 6];
  const particulas = [];
  const visiveis = [];

  function trocarFase(mapa) {
    texturas = criarTexturas(mapa.paleta);
    const n = parseInt(mapa.paleta.fundo.slice(1), 16);
    fundo = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    particulas.length = 0;
  }

  function texturaDaParede(codigo) {
    switch (codigo) {
      case M.T.CONCRETO: return texturas.concreto;
      case M.T.CHAPA: return texturas.chapa;
      case M.T.PORTA: return texturas.porta;
      case M.T.TRAVADA_A: return texturas.travadaA;
      case M.T.TRAVADA_B: return texturas.travadaB;
      case M.T.TRAVADA_C: return texturas.travadaC;
      default: return texturas.rocha;
    }
  }

  // Luz de um ponto: cone da lanterna + lampada da celula + clarao do tiro.
  // O 1,15 no teto deixa a lampada estourar um pouco de branco, que e o que da
  // a impressao de que ela ilumina de verdade.
  function luzEm(jogo, dist, coluna, estatica, flash) {
    const j = jogo.jogador;
    const lanterna = j.lanterna
      ? cones[coluna] * Math.max(0, 1 - dist / CONFIG.alcanceLanterna)
      : 0;
    const olhoNu = Math.max(0, 1 - dist / CONFIG.alcanceEscuro) * 0.5;
    const brilho = flash * Math.max(0, 1 - dist / 9);
    // O teto de 1,35 deixa a lanterna estourar um pouco de branco no que esta
    // perto: com teto em 1,0 a cena ficava uniformemente cinza e o cone de luz
    // deixava de parecer luz.
    return Math.min(1.35, AMBIENTE + Math.max(lanterna, olhoNu) * 1.2
      + estatica * 1.0 + brilho);
  }

  function desenhar(jogo, dt) {
    const j = jogo.jogador;
    const mapa = jogo.mapa;
    const cos = Math.cos(j.ang);
    const sen = Math.sin(j.ang);
    const flash = j.brilho;

    // Cabeceio e tremor: o cabeceio vem da velocidade, o tremor do dano. Os
    // dois mexem so no horizonte, nunca na fisica — e os dois desligam quando o
    // sistema pede menos movimento. O jogo continua inteiro; so para de
    // sacudir sozinho.
    const velocidade = Math.hypot(j.vx, j.vy);
    const cabeceio = menosMovimento ? 0 : Math.sin(jogo.tempo * 9.5) * velocidade * 1.1;
    const solavanco = menosMovimento ? 0 : (Math.random() - 0.5) * j.tremor * 7;
    const horizonte = Math.round(ALTURA / 2 + cabeceio + solavanco + (j.agachado ? 16 : 0));

    // ---------------------------------------------------------- teto e piso
    for (let y = 0; y < ALTURA; y++) {
      const p = y - horizonte;
      if (p === 0) continue;
      const teto = p < 0;
      const rowDist = (0.5 * DIST_TELA) / Math.abs(p);
      if (rowDist > ALCANCE) {
        const nevoa = 1;
        const base = y * LARGURA * 4;
        for (let x = 0; x < LARGURA; x++) {
          const i = base + x * 4;
          buf[i] = fundo[0]; buf[i + 1] = fundo[1]; buf[i + 2] = fundo[2];
        }
        continue;
      }
      const textura = teto ? texturas.teto : texturas.piso;
      const linha = y * LARGURA * 4;
      const nevoa = Math.min(1, rowDist / NEBLINA);
      for (let x = 0; x < LARGURA; x++) {
        const dist = rowDist / cosDesvios[x];
        const dirX = Math.cos(j.ang + desvios[x]);
        const dirY = Math.sin(j.ang + desvios[x]);
        const px = j.x + dirX * dist;
        const py = j.y + dirY * dist;
        const cx = Math.floor(px);
        const cy = Math.floor(py);
        let tex = textura;
        if (!teto && M.tile(mapa, cx, cy) === M.T.POCA) tex = texturas.poca;
        else if (!teto && M.tile(mapa, cx, cy) === M.T.ELEVADOR) tex = texturas.elevador;
        const tx = ((px - cx) * tex.largura) | 0;
        const ty = ((py - cy) * tex.altura) | 0;
        const t = (ty * tex.largura + tx) * 4;
        const luz = luzEm(jogo, dist, x, M.luzDaCelula(mapa, cx, cy), flash) * (teto ? 0.72 : 1);
        const i = linha + x * 4;
        buf[i] = mistura(tex.dados[t] * luz, fundo[0], nevoa);
        buf[i + 1] = mistura(tex.dados[t + 1] * luz, fundo[1], nevoa);
        buf[i + 2] = mistura(tex.dados[t + 2] * luz, fundo[2], nevoa);
      }
    }

    // -------------------------------------------------------------- paredes
    for (let x = 0; x < LARGURA; x++) {
      const ang = j.ang + desvios[x];
      const dirX = Math.cos(ang);
      const dirY = Math.sin(ang);

      let cx = Math.floor(j.x);
      let cy = Math.floor(j.y);
      const passoX = dirX > 0 ? 1 : -1;
      const passoY = dirY > 0 ? 1 : -1;
      const deltaX = dirX === 0 ? Infinity : Math.abs(1 / dirX);
      const deltaY = dirY === 0 ? Infinity : Math.abs(1 / dirY);
      let proxX = dirX === 0 ? Infinity
        : (dirX > 0 ? (cx + 1 - j.x) : (j.x - cx)) * deltaX;
      let proxY = dirY === 0 ? Infinity
        : (dirY > 0 ? (cy + 1 - j.y) : (j.y - cy)) * deltaY;

      let dist = 0;
      let lado = 0;
      let codigo = 0;
      while (dist < ALCANCE) {
        if (proxX < proxY) { dist = proxX; proxX += deltaX; cx += passoX; lado = 0; }
        else { dist = proxY; proxY += deltaY; cy += passoY; lado = 1; }
        if (M.solido(mapa, cx, cy)) { codigo = M.tile(mapa, cx, cy); break; }
      }
      const perp = dist * cosDesvios[x];
      zbuffer[x] = codigo ? perp : ALCANCE;
      if (!codigo) continue;

      const tex = texturaDaParede(codigo);
      const bateu = lado === 0 ? j.y + dirY * dist : j.x + dirX * dist;
      let u = bateu - Math.floor(bateu);
      if ((lado === 0 && dirX < 0) || (lado === 1 && dirY > 0)) u = 1 - u;
      const tx = Math.min(tex.largura - 1, (u * tex.largura) | 0);

      const alturaColuna = Math.round(DIST_TELA / perp);
      const topo = horizonte - (alturaColuna >> 1);
      const base = topo + alturaColuna;
      const inicio = Math.max(0, topo);
      const fim = Math.min(ALTURA, base);
      const nevoa = Math.min(1, perp / NEBLINA);
      const sombraLado = lado === 1 ? 0.76 : 1;
      const luzParede = luzEm(jogo, perp, x, M.luzDaCelula(mapa, cx, cy), flash) * sombraLado;
      const passoTex = tex.altura / alturaColuna;
      let coordTex = (inicio - topo) * passoTex;

      for (let y = inicio; y < fim; y++) {
        const ty = Math.min(tex.altura - 1, coordTex | 0);
        coordTex += passoTex;
        const t = (ty * tex.largura + tx) * 4;
        const i = (y * LARGURA + x) * 4;
        buf[i] = mistura(tex.dados[t] * luzParede, fundo[0], nevoa);
        buf[i + 1] = mistura(tex.dados[t + 1] * luzParede, fundo[1], nevoa);
        buf[i + 2] = mistura(tex.dados[t + 2] * luzParede, fundo[2], nevoa);
      }
    }

    // -------------------------------------------------------------- sprites
    visiveis.length = 0;
    for (const e of jogo.inimigos) {
      const t = TIPOS[e.tipo];
      const morto = e.vida <= 0;
      if (morto && e.morteEm > CONFIG.tempoCadaver) continue;
      const conjunto = spritesInimigos[e.tipo];
      const pose = Math.floor(jogo.tempo * (e.estado === 'cacando' ? 7 : 3)) % 2;
      visiveis.push({
        x: e.x, y: e.y,
        tex: morto ? conjunto.morto : conjunto.poses[pose],
        escala: t.altura * (morto ? 0.7 : 1),
        chao: morto ? 0.02 : 0,
        tinta: e.dor > 0 ? [255, 120, 120, Math.min(0.65, e.dor)] : null,
        aura: e.fase === 'cuspindo' ? [160, 255, 90] : (e.vulneravel ? [255, 210, 120] : null),
      });
    }
    for (const item of jogo.itens) {
      if (item.pego) continue;
      const tex = spritesItens[chaveDoItem(item)];
      if (!tex) continue;
      visiveis.push({
        x: item.x, y: item.y, tex, escala: 0.42,
        chao: 0.06 + Math.sin(jogo.tempo * 2.4 + item.x) * 0.03,
        tinta: null, aura: null,
      });
    }
    for (const p of jogo.projeteis) {
      visiveis.push({
        x: p.x, y: p.y, tex: spritesItens.cuspe, escala: 0.3, chao: 0.3,
        tinta: null, aura: [150, 240, 90],
      });
    }

    for (const s of visiveis) {
      const dx = s.x - j.x;
      const dy = s.y - j.y;
      s.profundidade = dx * cos + dy * sen;
      s.lateral = -dx * sen + dy * cos;
    }
    visiveis.sort((a, b) => b.profundidade - a.profundidade);

    for (const s of visiveis) {
      if (s.profundidade < 0.25) continue;
      const escalaTela = DIST_TELA / s.profundidade;
      const telaX = Math.round(LARGURA / 2 + (s.lateral / s.profundidade) * DIST_TELA);
      const tamanho = Math.round(escalaTela * s.escala);
      if (tamanho < 1) continue;
      const baseY = horizonte + Math.round(escalaTela * (0.5 - s.chao));
      const topoY = baseY - tamanho;
      const meio = tamanho >> 1;
      const nevoa = Math.min(1, s.profundidade / NEBLINA);
      const colunaLuz = Math.min(LARGURA - 1, Math.max(0, telaX));
      const luz = luzEm(jogo, s.profundidade, colunaLuz,
        M.luzDaCelula(mapa, Math.floor(s.x), Math.floor(s.y)), flash);
      const tex = s.tex;
      const passo = tex.largura / tamanho;

      for (let col = 0; col < tamanho; col++) {
        const x = telaX - meio + col;
        if (x < 0 || x >= LARGURA) continue;
        if (s.profundidade >= zbuffer[x]) continue;
        const tx = Math.min(tex.largura - 1, (col * passo) | 0);
        for (let row = 0; row < tamanho; row++) {
          const y = topoY + row;
          if (y < 0 || y >= ALTURA) continue;
          const ty = Math.min(tex.altura - 1, (row * passo) | 0);
          const t = (ty * tex.largura + tx) * 4;
          const alfa = tex.dados[t + 3];
          if (alfa < 24) continue;
          let r = tex.dados[t];
          let g = tex.dados[t + 1];
          let b = tex.dados[t + 2];
          if (s.tinta) {
            const k = s.tinta[3];
            r += (s.tinta[0] - r) * k;
            g += (s.tinta[1] - g) * k;
            b += (s.tinta[2] - b) * k;
          }
          let lz = luz;
          if (s.aura) {
            r += (s.aura[0] - r) * 0.35;
            g += (s.aura[1] - g) * 0.35;
            b += (s.aura[2] - b) * 0.35;
            lz = Math.max(lz, 0.85);
          }
          const i = (y * LARGURA + x) * 4;
          const op = alfa / 255;
          const nr = mistura(r * lz, fundo[0], nevoa);
          const ng = mistura(g * lz, fundo[1], nevoa);
          const nb = mistura(b * lz, fundo[2], nevoa);
          buf[i] += (nr - buf[i]) * op;
          buf[i + 1] += (ng - buf[i + 1]) * op;
          buf[i + 2] += (nb - buf[i + 2]) * op;
        }
      }
    }

    // ----------------------------------------------------------- particulas
    for (let k = particulas.length - 1; k >= 0; k--) {
      const p = particulas[k];
      p.vida -= dt;
      if (p.vida <= 0) { particulas.splice(k, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vz -= 5.2 * dt;
      if (p.z < 0.02) { p.z = 0.02; p.vz = 0; p.vx *= 0.7; p.vy *= 0.7; }
      const dx = p.x - j.x;
      const dy = p.y - j.y;
      const prof = dx * cos + dy * sen;
      if (prof < 0.25) continue;
      const lat = -dx * sen + dy * cos;
      const escalaTela = DIST_TELA / prof;
      const px = Math.round(LARGURA / 2 + (lat / prof) * DIST_TELA);
      const py = horizonte + Math.round(escalaTela * (0.5 - p.z));
      if (px < 0 || px >= LARGURA || py < 0 || py >= ALTURA) continue;
      if (prof >= zbuffer[px]) continue;
      const tam = Math.max(1, Math.round(escalaTela * 0.035));
      const luz = Math.max(0.35, luzEm(jogo, prof, px, 0.2, flash));
      for (let yy = py; yy < py + tam && yy < ALTURA; yy++) {
        for (let xx = px; xx < px + tam && xx < LARGURA; xx++) {
          const i = (yy * LARGURA + xx) * 4;
          buf[i] = Math.min(255, p.cor[0] * luz);
          buf[i + 1] = Math.min(255, p.cor[1] * luz);
          buf[i + 2] = Math.min(255, p.cor[2] * luz);
        }
      }
    }

    ctx.putImageData(imagem, 0, 0);
    desenharArma(ctx, jogo, menosMovimento);
    desenharMira(ctx, jogo);
    desenharVinheta(ctx, jogo);
  }

  // Um pouco de sangue, uma fagulha: e o retorno de que o tiro acertou. Sem
  // isto, a unica confirmacao e a barra de vida do bicho, que nao existe.
  function evento(ev) {
    if (ev.tipo === 'acerto' || ev.tipo === 'abate') {
      const alvo = ev.alvo;
      const cor = parseCor(TIPOS[alvo.tipo].sangue);
      const n = ev.tipo === 'abate' ? 26 : 9;
      for (let i = 0; i < n; i++) {
        particulas.push({
          x: alvo.x, y: alvo.y, z: 0.4 + Math.random() * 0.4,
          vx: (Math.random() - 0.5) * 3.4, vy: (Math.random() - 0.5) * 3.4,
          vz: 1.2 + Math.random() * 2.4,
          vida: 0.5 + Math.random() * 0.8, cor,
        });
      }
    } else if (ev.tipo === 'faisca') {
      for (let i = 0; i < 5; i++) {
        particulas.push({
          x: ev.x, y: ev.y, z: 0.5 + Math.random() * 0.2,
          vx: (Math.random() - 0.5) * 2.2, vy: (Math.random() - 0.5) * 2.2,
          vz: 0.8 + Math.random() * 1.6,
          vida: 0.18 + Math.random() * 0.22, cor: [255, 228, 150],
        });
      }
    } else if (ev.tipo === 'espirro') {
      for (let i = 0; i < 8; i++) {
        particulas.push({
          x: ev.x, y: ev.y, z: 0.35 + Math.random() * 0.2,
          vx: (Math.random() - 0.5) * 2.6, vy: (Math.random() - 0.5) * 2.6,
          vz: 0.6 + Math.random() * 1.2,
          vida: 0.3 + Math.random() * 0.4, cor: [150, 240, 90],
        });
      }
    }
  }

  trocarFase({ paleta: { rocha: '#6b5a46', concreto: '#84796b', chapa: '#8b7a5e', piso: '#453b32', teto: '#241e19', fundo: '#0d0a08' } });
  return { desenhar, trocarFase, evento, largura: LARGURA, altura: ALTURA };
}

function mistura(valor, alvo, t) {
  const v = valor > 255 ? 255 : valor;
  return v + (alvo - v) * t;
}

function parseCor(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// --------------------------------------------------------- camada vetorial
// Arma, mira e vinheta sao desenhadas com caminho, depois do putImageData: sao
// as tres coisas que nao tem profundidade e por isso nao precisam do buffer.

function desenharArma(ctx, jogo, calmo) {
  const j = jogo.jogador;
  const arma = ARMAS[j.arma];
  const velocidade = Math.hypot(j.vx, j.vy);
  const bx = calmo ? 0 : Math.sin(jogo.tempo * 9.5) * velocidade * 2.4;
  const by = calmo ? 0 : Math.abs(Math.cos(jogo.tempo * 9.5)) * velocidade * 2.0;
  const fracaoRecarga = Math.max(0, j.recarga / arma.cadencia);
  const recuo = fracaoRecarga * (arma.tipo === 'corpo' ? 18 : 10);
  const x = LARGURA * 0.70 + bx;
  const y = ALTURA + by - recuo * 0.4;

  ctx.save();
  ctx.translate(x, y);

  // A mao esquerda aparece em todas as armas: e o que faz a arma parecer
  // segurada e nao colada na tela.
  const mao = (mx, my, r = 9) => {
    ctx.fillStyle = '#8a6a52';
    ctx.beginPath();
    ctx.ellipse(mx, my, r, r * 0.82, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6d5340';
    ctx.beginPath();
    ctx.ellipse(mx - r * 0.3, my + r * 0.4, r * 0.55, r * 0.4, -0.3, 0, Math.PI * 2);
    ctx.fill();
  };

  if (arma.tipo === 'corpo') {
    ctx.rotate(-0.62 + recuo * 0.05);
    ctx.fillStyle = '#5b452e';
    ctx.fillRect(-7, -96, 14, 96);
    ctx.fillStyle = '#42321f';
    ctx.fillRect(-7, -96, 4, 96);
    ctx.fillStyle = '#a7aeb4';
    ctx.beginPath();
    ctx.moveTo(-36, -96);
    ctx.lineTo(26, -108);
    ctx.lineTo(34, -96);
    ctx.lineTo(24, -92);
    ctx.lineTo(-34, -84);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#787f85';
    ctx.fillRect(-10, -102, 20, 14);
    ctx.fillStyle = '#cdd3d8';
    ctx.beginPath();
    ctx.moveTo(26, -108);
    ctx.lineTo(34, -96);
    ctx.lineTo(28, -97);
    ctx.closePath();
    ctx.fill();
    mao(2, -46, 10);
  } else if (arma.tipo === 'chama') {
    ctx.rotate(-0.16);
    ctx.fillStyle = '#2f3134';
    ctx.fillRect(-20, -62, 40, 62);
    ctx.fillStyle = '#b05a2a';
    ctx.beginPath();
    ctx.moveTo(-14, -96);
    ctx.lineTo(14, -96);
    ctx.lineTo(10, -60);
    ctx.lineTo(-10, -60);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7a3c1c';
    ctx.fillRect(-14, -84, 28, 4);
    ctx.fillStyle = '#5b6066';
    ctx.fillRect(-5, -122, 10, 28);
    ctx.fillStyle = '#8d949a';
    ctx.fillRect(-8, -126, 16, 6);
    // chama piloto: sempre acesa, e o que avisa que a arma gasta gas parada
    const piloto = 3 + Math.sin(jogo.tempo * 22) * 1.2;
    ctx.fillStyle = 'rgba(120,200,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(0, -130, piloto * 0.5, piloto, 0, 0, Math.PI * 2);
    ctx.fill();
    mao(-16, -48, 9);
    if (j.recarga > 0.01) {
      const g = ctx.createRadialGradient(0, -138, 3, 0, -138, 34);
      g.addColorStop(0, 'rgba(255,244,200,0.95)');
      g.addColorStop(0.45, 'rgba(255,150,60,0.72)');
      g.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -138, 34, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (arma.pelotas > 1) {
    // espingarda de pressao: cano duplo, bomba de ar e coronha de madeira
    ctx.rotate(-0.2 + fracaoRecarga * 0.2);
    ctx.fillStyle = '#523a24';
    ctx.beginPath();
    ctx.moveTo(-26, 4);
    ctx.lineTo(-6, -58);
    ctx.lineTo(12, -52);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3d2b1a';
    ctx.fillRect(-10, -78, 26, 24);
    ctx.fillStyle = '#50565c';
    ctx.fillRect(-8, -132, 11, 56);
    ctx.fillRect(5, -132, 11, 56);
    ctx.fillStyle = '#2b2f33';
    ctx.fillRect(-8, -132, 24, 5);
    ctx.fillStyle = '#6b7278';
    ctx.fillRect(-12, -96, 32, 9);
    ctx.fillStyle = '#8f979d';
    ctx.fillRect(-12, -96, 32, 3);
    mao(-14, -88, 10);
    if (fracaoRecarga > 0.72) {
      const g = ctx.createRadialGradient(4, -140, 4, 4, -140, 40);
      g.addColorStop(0, 'rgba(255,250,222,1)');
      g.addColorStop(0.4, 'rgba(255,205,95,0.8)');
      g.addColorStop(1, 'rgba(255,150,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(4, -140, 40, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // pineira: compacta, com o carregador de pinos de lado
    ctx.rotate(-0.12 + fracaoRecarga * 0.1);
    ctx.fillStyle = '#33373b';
    ctx.fillRect(-16, -56, 30, 56);
    ctx.fillStyle = '#25282b';
    ctx.fillRect(-16, -56, 8, 56);
    ctx.fillStyle = '#464c52';
    ctx.fillRect(-10, -104, 18, 50);
    ctx.fillStyle = '#2b2f33';
    ctx.fillRect(-6, -116, 10, 14);
    ctx.fillStyle = '#7a6a3a';
    ctx.fillRect(6, -94, 19, 10);
    ctx.fillStyle = '#c9b477';
    for (let i = 0; i < 4; i++) ctx.fillRect(9 + i * 4, -92, 2, 6);
    mao(-4, -44, 9);
    if (fracaoRecarga > 0.45) {
      const g = ctx.createRadialGradient(-1, -124, 2, -1, -124, 24);
      g.addColorStop(0, 'rgba(255,248,210,1)');
      g.addColorStop(0.45, 'rgba(255,205,110,0.7)');
      g.addColorStop(1, 'rgba(255,160,50,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(-1, -124, 24, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function desenharMira(ctx, jogo) {
  const cx = LARGURA / 2;
  const cy = ALTURA / 2;
  const espalha = ARMAS[jogo.jogador.arma].espalhamento * 220 + 3;
  ctx.strokeStyle = 'rgba(230,240,255,0.62)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.moveTo(cx + dx * espalha, cy + dy * espalha);
    ctx.lineTo(cx + dx * (espalha + 4), cy + dy * (espalha + 4));
  }
  ctx.stroke();
}

function desenharVinheta(ctx, jogo) {
  const j = jogo.jogador;
  const escuro = ctx.createRadialGradient(LARGURA / 2, ALTURA / 2, ALTURA * 0.35,
    LARGURA / 2, ALTURA / 2, ALTURA * 0.95);
  escuro.addColorStop(0, 'rgba(0,0,0,0)');
  escuro.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = escuro;
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  if (j.dor > 0.01) {
    // O vermelho do dano e um anel estreito na borda. Na primeira versao ele
    // comecava no meio da tela com 0,6 de opacidade e pintava a cena inteira
    // de vermelho: a captura de tela do POCO saiu irreconhecivel.
    const sangue = ctx.createRadialGradient(LARGURA / 2, ALTURA / 2, ALTURA * 0.52,
      LARGURA / 2, ALTURA / 2, ALTURA * 0.98);
    sangue.addColorStop(0, 'rgba(180,20,20,0)');
    sangue.addColorStop(1, `rgba(170,18,18,${0.34 * j.dor})`);
    ctx.fillStyle = sangue;
    ctx.fillRect(0, 0, LARGURA, ALTURA);
  }
  const vidaBaixa = 1 - Math.min(1, j.vida / (CONFIG.vidaMax * 0.35));
  if (vidaBaixa > 0) {
    ctx.fillStyle = `rgba(120,0,0,${0.16 * vidaBaixa * (0.6 + 0.4 * Math.sin(jogo.tempo * 4))})`;
    ctx.fillRect(0, 0, LARGURA, ALTURA);
  }
}
