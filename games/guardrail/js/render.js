// O desenho. Canvas 2D, nada de asset: forma, gradiente e texto vetorial.
//
// Duas decisoes de desempenho que sustentam os 60 fps com a tela cheia:
// (1) o fundo — piso, laje, trilha, seta de direcao, base — e desenhado uma
// vez num canvas fora da tela e depois copiado inteiro por quadro;
// (2) nenhum `shadowBlur` dentro do laco quente. Sombra de canvas custa mais
// que a soma de tudo que esta aqui.

import { CELULA, LARGURA, ALTURA } from './mapas.js';
import { DANOS, TORRE_POR_ID, MODOS } from './dados.js';
import { progresso } from './jogo.js';

export const LARGURA_PX = LARGURA * CELULA;
export const ALTURA_PX = ALTURA * CELULA;

const TAU = Math.PI * 2;

export class Render {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = LARGURA_PX;
    canvas.height = ALTURA_PX;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.fundo = null;
    this.mapaDesenhado = null;
    this.particulas = [];
    this.flutuantes = [];
    this.tremor = 0;
    this.pulso = 0;
  }

  // ------------------------------------------------------------- fundo fixo
  prepararFundo(mapa) {
    if (this.mapaDesenhado === mapa.id) return;
    this.mapaDesenhado = mapa.id;
    const c = document.createElement('canvas');
    c.width = LARGURA_PX;
    c.height = ALTURA_PX;
    // `alpha: false` no fundo importa: com canal alfa, copiar o fundo para a
    // tela vira mistura por pixel em vez de copia, e sao 576 mil pixels por
    // quadro. Sem GPU isso sozinho custava alguns milissegundos.
    const g = c.getContext('2d', { alpha: false });

    g.fillStyle = mapa.piso;
    g.fillRect(0, 0, LARGURA_PX, ALTURA_PX);

    // chao morto: textura de pontos
    g.fillStyle = 'rgba(255,255,255,.028)';
    for (let y = 0; y < ALTURA; y++) {
      for (let x = 0; x < LARGURA; x++) {
        if (mapa.construivel.has(y * LARGURA + x)) continue;
        if (mapa.naRota.has(y * LARGURA + x)) continue;
        for (let i = 0; i < 3; i++) {
          const px = x * CELULA + 6 + ((x * 7 + y * 13 + i * 11) % 28);
          const py = y * CELULA + 6 + ((x * 11 + y * 5 + i * 17) % 28);
          g.fillRect(px, py, 2, 2);
        }
      }
    }

    // laje construivel
    for (let y = 0; y < ALTURA; y++) {
      for (let x = 0; x < LARGURA; x++) {
        if (!mapa.construivel.has(y * LARGURA + x)) continue;
        const px = x * CELULA;
        const py = y * CELULA;
        g.fillStyle = 'rgba(122,168,208,.16)';
        g.fillRect(px + 1, py + 1, CELULA - 2, CELULA - 2);
        g.strokeStyle = 'rgba(158,208,244,.3)';
        g.lineWidth = 1;
        g.strokeRect(px + 1.5, py + 1.5, CELULA - 3, CELULA - 3);
        g.fillStyle = 'rgba(178,220,250,.42)';
        g.fillRect(px + 3, py + 3, 4, 1);
        g.fillRect(px + 3, py + 3, 1, 4);
        g.fillRect(px + CELULA - 7, py + CELULA - 4, 4, 1);
        g.fillRect(px + CELULA - 4, py + CELULA - 7, 1, 4);
      }
    }

    // trilha
    for (const rota of mapa.rotas) {
      g.lineWidth = CELULA * 0.78;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(8,10,14,.92)';
      tracar(g, rota.cels);
      g.lineWidth = CELULA * 0.64;
      g.strokeStyle = 'rgba(48,62,82,.55)';
      tracar(g, rota.cels);
      g.lineWidth = 2;
      g.setLineDash([7, 13]);
      g.strokeStyle = 'rgba(150,190,220,.3)';
      tracar(g, rota.cels);
      g.setLineDash([]);

      // setas de direcao a cada 5 celulas
      for (let i = 3; i < rota.cels.length - 1; i += 5) {
        const [ax, ay] = rota.cels[i];
        const [bx, by] = rota.cels[i + 1];
        const ang = Math.atan2(by - ay, bx - ax);
        const cx = (ax + 0.5) * CELULA;
        const cy = (ay + 0.5) * CELULA;
        g.save();
        g.translate(cx, cy);
        g.rotate(ang);
        g.fillStyle = 'rgba(160,200,230,.22)';
        g.beginPath();
        g.moveTo(7, 0); g.lineTo(-4, -5); g.lineTo(-4, 5);
        g.closePath();
        g.fill();
        g.restore();
      }

      // entrada. A marca precisa ser clampeada: a rota leste do CRUZAMENTO
      // comeca em x=24, fora da tela, e sem isto a segunda entrada do mapa
      // simplesmente nao aparecia.
      const [ex, ey] = rota.cels[0];
      const epx = Math.min(LARGURA_PX - 22, Math.max(22, (ex + 0.5) * CELULA));
      const epy = Math.min(ALTURA_PX - 22, Math.max(22, (ey + 0.5) * CELULA));
      g.strokeStyle = 'rgba(255,120,90,.65)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(epx, epy, 15, 0, TAU);
      g.stroke();
      g.fillStyle = 'rgba(255,140,110,.9)';
      g.font = '700 9px ui-monospace, monospace';
      g.textAlign = 'center';
      g.fillText('ENTRADA', epx, epy - 22);
    }

    // corredor de voo: onde o INFERENCIA NA BORDA vai passar, ignorando a
    // trilha. Desenhado fraco mas sempre visivel, porque decidir onde por
    // antiaereo depende de enxergar esta linha.
    for (const l of mapa.linhasVoo) {
      g.strokeStyle = 'rgba(126,226,255,.11)';
      g.lineWidth = CELULA * 0.34;
      g.setLineDash([3, 16]);
      g.beginPath();
      g.moveTo(Math.max(6, l.de.x * CELULA), l.de.y * CELULA);
      g.lineTo(l.para.x * CELULA, l.para.y * CELULA);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(126,226,255,.42)';
      g.font = '700 8px ui-monospace, monospace';
      g.textAlign = 'center';
      const mx = (Math.max(0, l.de.x) + l.para.x) / 2 * CELULA;
      const my = (l.de.y + l.para.y) / 2 * CELULA;
      const ang = Math.atan2(l.para.y - l.de.y, l.para.x - l.de.x);
      g.save();
      g.translate(mx, my);
      g.rotate(ang);
      g.fillText('CORREDOR DE VOO', 0, -11);
      g.restore();
    }

    this.fundo = c;
  }

  // ---------------------------------------------------------------- efeitos
  faisca(x, y, cor, n = 6, forca = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const v = (18 + Math.random() * 70) * forca;
      this.particulas.push({
        x: x * CELULA, y: y * CELULA,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        vida: 0.22 + Math.random() * 0.3, max: 0.5, cor, r: 1.4 + Math.random() * 2.2,
      });
    }
    if (this.particulas.length > 900) this.particulas.splice(0, this.particulas.length - 900);
  }

  anel(x, y, raio, cor) {
    this.particulas.push({ anel: true, x: x * CELULA, y: y * CELULA, r0: 4, r1: raio * CELULA, vida: 0.34, max: 0.34, cor });
  }

  texto(x, y, txt, cor) {
    this.flutuantes.push({ x: x * CELULA, y: y * CELULA, txt, cor, vida: 0.95, max: 0.95 });
    if (this.flutuantes.length > 60) this.flutuantes.shift();
  }

  sacudir(f) { this.tremor = Math.min(11, this.tremor + f); }

  // ---------------------------------------------------------------- quadro
  desenhar(jogo, ui, dt) {
    const ctx = this.ctx;
    this.pulso += dt;
    this.prepararFundo(jogo.mapa);

    this.offX = 0;
    this.offY = 0;
    if (this.tremor > 0.05) {
      this.offX = (Math.random() - 0.5) * this.tremor;
      this.offY = (Math.random() - 0.5) * this.tremor;
      this.tremor *= 0.86;
    } else this.tremor = 0;
    ctx.setTransform(1, 0, 0, 1, this.offX, this.offY);

    ctx.drawImage(this.fundo, 0, 0);

    this._base(jogo);
    if (ui.colocando) this._lajesLivres(jogo, ui);
    this._alcances(jogo, ui);
    this._torres(jogo, ui);
    this._pragas(jogo, ui);
    this._tiros(jogo);
    this._particulas(dt);
    this._flutuantes(dt);
    if (jogo.usoVram > jogo.capacidadeVram) this._vinheta('rgba(255,90,60,', 0.16);
    if (jogo.overclock > 0) this._vinheta('rgba(255,209,102,', 0.14);
    if (jogo.centralTravada > 0) this._travada(jogo);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // A vinheta e rasterizada por cor uma vez so. Construir o gradiente radial e
  // pintar 576 mil pixels com ele a cada quadro custava 5,4 ms — mais caro que
  // desenhar as 120 pragas. Agora o gradiente e rasterizado num canvas na
  // primeira vez e o quadro so mistura o bitmap, com a pulsacao no alfa. E ele
  // so cobre a faixa de borda, que e a unica parte onde vinheta se enxerga.
  _vinheta(cor, forca) {
    const ctx = this.ctx;
    if (!this.vinhetas) this.vinhetas = new Map();
    let v = this.vinhetas.get(cor);
    if (!v) {
      v = document.createElement('canvas');
      v.width = LARGURA_PX;
      v.height = ALTURA_PX;
      const g = v.getContext('2d');
      const grad = g.createRadialGradient(
        LARGURA_PX / 2, ALTURA_PX / 2, ALTURA_PX * 0.3,
        LARGURA_PX / 2, ALTURA_PX / 2, ALTURA_PX * 0.85);
      grad.addColorStop(0, cor + '0)');
      grad.addColorStop(1, cor + '1)');
      g.fillStyle = grad;
      g.fillRect(0, 0, LARGURA_PX, ALTURA_PX);
      this.vinhetas.set(cor, v);
    }
    const a = forca * (0.7 + 0.3 * Math.sin(this.pulso * 6));
    const faixa = 132;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.rect(0, 0, LARGURA_PX, ALTURA_PX);
    ctx.rect(faixa, faixa, LARGURA_PX - faixa * 2, ALTURA_PX - faixa * 2);
    ctx.clip('evenodd');
    ctx.drawImage(v, 0, 0);
    ctx.restore();
  }

  _travada(jogo) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255,90,70,.1)';
    ctx.fillRect(0, 0, LARGURA_PX, ALTURA_PX);
    ctx.fillStyle = '#ff7a5c';
    ctx.font = '700 22px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`429 — CENTRAL TRAVADA  ${jogo.centralTravada.toFixed(1)}s`, LARGURA_PX / 2, 46);
  }

  _base(jogo) {
    const ctx = this.ctx;
    const b = jogo.mapa.base;
    const x = (b.x + 0.5) * CELULA;
    const y = (b.y + 0.5) * CELULA;
    const vida = jogo.vidas / jogo.vidasMax;
    const p = 0.5 + 0.5 * Math.sin(this.pulso * 2.2);
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = `rgba(110,240,168,${0.2 + 0.2 * p})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 22 + p * 4, 0, TAU); ctx.stroke();
    ctx.fillStyle = vida > 0.5 ? '#123326' : vida > 0.25 ? '#3a2d10' : '#3a1414';
    ctx.strokeStyle = vida > 0.5 ? '#6ef0a8' : vida > 0.25 ? '#ffd166' : '#ff6b5c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-15, -15, 30, 30);
    ctx.fill(); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i / 4 < vida ? ctx.strokeStyle : 'rgba(255,255,255,.12)';
      ctx.fillRect(-11, 8 - i * 6, 22, 4);
    }
    ctx.fillStyle = '#cfe8dd';
    ctx.font = '700 8px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CLUSTER', 0, -21);
    ctx.restore();
  }

  _lajesLivres(jogo, ui) {
    const ctx = this.ctx;
    const mapa = jogo.mapa;
    const custo = ui.custoColocando;
    const podePagar = jogo.dinheiro >= custo;
    for (let y = 0; y < ALTURA; y++) {
      for (let x = 0; x < LARGURA; x++) {
        if (!mapa.construivel.has(y * LARGURA + x)) continue;
        const livre = !ui.ocupado(x, y);
        ctx.fillStyle = livre && podePagar ? 'rgba(110,240,168,.14)' : 'rgba(255,90,70,.10)';
        ctx.fillRect(x * CELULA + 2, y * CELULA + 2, CELULA - 4, CELULA - 4);
      }
    }
  }

  _alcances(jogo, ui) {
    const ctx = this.ctx;
    const mostrar = [];
    if (ui.selecionada) mostrar.push({ x: ui.selecionada.cx, y: ui.selecionada.cy, r: ui.selecionada.at.alcance, cor: TORRE_POR_ID[ui.selecionada.tipo].cor, aura: ui.selecionada.st.auraRaio || 0 });
    if (ui.colocando && ui.celula) {
      const def = TORRE_POR_ID[ui.colocando];
      mostrar.push({ x: ui.celula.x + 0.5, y: ui.celula.y + 0.5, r: def.alcance, cor: def.cor, aura: 0 });
    }
    for (const m of mostrar) {
      ctx.beginPath();
      ctx.arc(m.x * CELULA, m.y * CELULA, m.r * CELULA, 0, TAU);
      ctx.fillStyle = hexA(m.cor, 0.07);
      ctx.fill();
      ctx.strokeStyle = hexA(m.cor, 0.5);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      if (m.aura) {
        ctx.beginPath();
        ctx.arc(m.x * CELULA, m.y * CELULA, m.aura * CELULA, 0, TAU);
        ctx.strokeStyle = 'rgba(255,255,255,.28)';
        ctx.setLineDash([2, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // O corpo da torre e sempre o mesmo desenho: placa escura, octogono na cor
  // da familia, recorte interno e glifo. Redesenhar isso a cada quadro custava
  // 110 microssegundos por torre — com 24 torres, 2,7 ms so em coisa que nao
  // muda. Agora cada tipo e rasterizado uma vez num canvas de 44 px e o quadro
  // so copia. O que muda (cano, pips, etiqueta, estado) continua por cima.
  _selo(def) {
    if (!this.selos) this.selos = new Map();
    let s = this.selos.get(def.id);
    if (s) return s;
    const lado = 44;
    s = document.createElement('canvas');
    s.width = lado;
    s.height = lado;
    const g = s.getContext('2d');
    g.translate(lado / 2, lado / 2);
    const r = 15;
    g.beginPath(); octo(g, 0, 0, r + 3); g.fillStyle = 'rgba(8,11,17,.9)'; g.fill();
    g.beginPath(); octo(g, 0, 0, r); g.fillStyle = def.cor; g.fill();
    g.lineWidth = 1.4; g.strokeStyle = 'rgba(6,9,14,.75)'; g.stroke();
    g.beginPath(); octo(g, 0, 0, r - 4.5); g.fillStyle = sombra(def.cor); g.fill();
    g.fillStyle = def.cor;
    g.font = '700 11px ui-monospace, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(def.glifo, 0, 1);
    this.selos.set(def.id, s);
    return s;
  }

  _torres(jogo, ui) {
    const ctx = this.ctx;
    const r = 15;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of jogo.torres) {
      const def = TORRE_POR_ID[t.tipo];
      const x = t.cx * CELULA + this.offX;
      const y = t.cy * CELULA + this.offY;
      const sel = ui.selecionada === t;
      const corrompida = t.corrompida > 0;
      const desligada = t.desligada > 0 || t.aquecendo > 0;

      // cano apontado para o alvo
      if (!t.at.naoAtira) {
        ctx.setTransform(1, 0, 0, 1, x, y);
        ctx.rotate(t.angulo);
        ctx.fillStyle = hexA(def.cor, 0.85);
        ctx.fillRect(6, -3, 15, 6);
        ctx.setTransform(1, 0, 0, 1, this.offX, this.offY);
      }

      if (corrompida || desligada) {
        ctx.beginPath(); octo(ctx, x - this.offX, y - this.offY, r + 3);
        ctx.fillStyle = 'rgba(8,11,17,.9)'; ctx.fill();
        ctx.beginPath(); octo(ctx, x - this.offX, y - this.offY, r);
        ctx.fillStyle = corrompida ? '#ff5ca8' : '#5a5a68'; ctx.fill();
        ctx.fillStyle = corrompida ? '#3a0a22' : '#14141a';
        ctx.font = '700 11px ui-monospace, monospace';
        ctx.fillText(def.glifo, x - this.offX, y - this.offY + 1);
      } else {
        ctx.drawImage(this._selo(def), x - this.offX - 22, y - this.offY - 22);
      }

      const px = x - this.offX;
      const py = y - this.offY;
      if (sel) {
        ctx.beginPath(); octo(ctx, px, py, r);
        ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      }

      // pips de nivel, um arco por caminho
      for (let c = 0; c < 2; c++) {
        if (!t.niveis[c]) continue;
        ctx.fillStyle = c === 0 ? '#7ee2ff' : '#ffb04a';
        for (let n = 0; n < t.niveis[c]; n++) {
          const a = (c === 0 ? -1 : 1) * (0.62 + n * 0.34);
          ctx.beginPath();
          ctx.arc(px + Math.sin(a) * (r + 5), py - Math.cos(a) * (r + 5), 2.4, 0, TAU);
          ctx.fill();
        }
      }

      // etiqueta do modo de servir quando nao e o padrao
      if (t.modoServir !== 'padrao') {
        ctx.fillStyle = 'rgba(0,0,0,.66)';
        ctx.fillRect(px - 15, py + r + 1, 30, 9);
        ctx.fillStyle = '#9fd6a0';
        ctx.font = '700 7px ui-monospace, monospace';
        ctx.fillText(MODOS[t.modoServir].nome.slice(0, 5), px, py + r + 6);
      }

      if (corrompida) {
        ctx.strokeStyle = '#ff5ca8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, r + 6 + Math.sin(this.pulso * 14) * 2, 0, TAU);
        ctx.stroke();
      }
      if (t.at.protegida) {
        ctx.strokeStyle = 'rgba(159,214,160,.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, r + 3, 0, TAU);
        ctx.stroke();
      }
    }
  }

  // O corpo de uma praga tambem nao muda: a mesma forma, na mesma cor, no
  // mesmo tamanho. Rasterizar 120 deles por quadro custava 9 ms — mais da
  // metade do orcamento de 16,6 ms — porque `stroke` num rasterizador de
  // software e caro e porque eram 360 chamadas de save/translate/restore.
  // Aqui cada combinacao forma+cor+raio vira um selo desenhado uma vez.
  _seloPraga(forma_, cor, r) {
    if (!this.selosPraga) this.selosPraga = new Map();
    const rq = Math.max(6, Math.round(r * 2) / 2);   // quantiza o raio
    const chave = `${forma_}|${cor}|${rq}`;
    let s = this.selosPraga.get(chave);
    if (s) return s;
    const lado = Math.ceil(rq * 4) + 8;
    s = document.createElement('canvas');
    s.width = lado;
    s.height = lado;
    const g = s.getContext('2d');
    g.translate(lado / 2, lado / 2);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    forma(g, forma_, rq, cor, 0);
    s.meio = lado / 2;
    s.raio = rq;
    if (this.selosPraga.size > 260) this.selosPraga.clear();
    this.selosPraga.set(chave, s);
    return s;
  }

  _pragas(jogo, ui) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const barras = [];
    let alpha = 1;
    for (const p of jogo.pragas) {
      if (p.morta) continue;
      const x = p.x * CELULA;
      const y = p.y * CELULA;
      if (x < -40 || x > LARGURA_PX + 40) continue;
      if (p.muro) { this._muro(p); continue; }

      const oculto = p.oculto && p.revelado <= 0;
      const r = 10 * p.escala;

      if (p.congelado > 0) { ctx.strokeStyle = '#6fc8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 5, 0, TAU); ctx.stroke(); }
      if (p.invuln > 0) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r + 7, 0, TAU); ctx.stroke(); }

      const a = oculto ? 0.26 : 1;
      if (a !== alpha) { ctx.globalAlpha = a; alpha = a; }

      const cor = p.disfarcado ? '#cfd8c8' : p.def.cor;
      if (p.def.forma === 'asa' || p.def.forma === 'rolo' || p.def.forma === 'espiral' || p.def.forma === 'foguete') {
        // formas animadas nao dao para selar: elas mudam com o tempo. Sao
        // poucas na tela ao mesmo tempo, entao seguem no caminho lento.
        ctx.setTransform(1, 0, 0, 1, x + this.offX, y + this.offY);
        forma(ctx, p.def.forma, r, cor, this.pulso + p.uid);
        ctx.setTransform(1, 0, 0, 1, this.offX, this.offY);
      } else {
        const s = this._seloPraga(p.def.forma, cor, r);
        ctx.drawImage(s, x - s.meio, y - s.meio);
      }

      if (p.dot > 0) { ctx.fillStyle = 'rgba(88,227,160,.3)'; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, TAU); ctx.fill(); }
      if (p.marca > 0) {
        ctx.strokeStyle = '#ff8f6b'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - r - 4, y); ctx.lineTo(x + r + 4, y);
        ctx.moveTo(x, y - r - 4); ctx.lineTo(x, y + r + 4);
        ctx.stroke();
      }
      if (p.viesTipo) {
        ctx.fillStyle = DANOS[p.viesTipo].cor;
        ctx.font = '700 8px ui-monospace, monospace';
        ctx.fillText(DANOS[p.viesTipo].curto, x, y);
      }
      if (p.imunes.size) {
        ctx.font = '700 7px ui-monospace, monospace';
        let i = 0;
        for (const im of p.imunes) {
          ctx.fillStyle = DANOS[im] ? DANOS[im].cor : '#fff';
          ctx.fillText('x', x - r + 3 + i * 6, y - r - 3);
          i++;
        }
      }

      if (p.hp < p.hpMax) barras.push(x, y - r - 9, Math.max(18, r * 2.2), Math.max(0, p.hp / p.hpMax));
      if (p.def.chefe) {
        if (alpha !== 1) { ctx.globalAlpha = 1; alpha = 1; }
        ctx.fillStyle = '#fff';
        ctx.font = '700 9px ui-monospace, monospace';
        ctx.fillText(p.def.nome, x, y - r - 17);
      }
      if (ui.pragaSelecionada === p) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(x, y, r + 9, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (alpha !== 1) ctx.globalAlpha = 1;

    // As barras de vida saem em tres passadas, uma por cor, em vez de trocar
    // fillStyle duas vezes por praga.
    if (!barras.length) return;
    ctx.fillStyle = 'rgba(0,0,0,.72)';
    for (let i = 0; i < barras.length; i += 4) ctx.fillRect(barras[i] - barras[i + 2] / 2 - 1, barras[i + 1], barras[i + 2] + 2, 5);
    const faixas = [[0.5, 1.01, '#6ef0a8'], [0.22, 0.5, '#ffd166'], [-1, 0.22, '#ff6b5c']];
    for (const [lo, hi, c] of faixas) {
      ctx.fillStyle = c;
      for (let i = 0; i < barras.length; i += 4) {
        const f = barras[i + 3];
        if (f <= lo || f > hi) continue;
        ctx.fillRect(barras[i] - barras[i + 2] / 2, barras[i + 1] + 1, barras[i + 2] * f, 3);
      }
    }
  }

  _muro(p) {
    const ctx = this.ctx;
    const m = p.muro;
    const x = m.x * CELULA;
    const f = Math.max(0, p.hp / p.hpMax);
    ctx.save();
    ctx.fillStyle = 'rgba(255,157,60,.22)';
    ctx.fillRect(x - 7, m.y0 * CELULA, 14, (m.y1 - m.y0) * CELULA);
    ctx.fillStyle = '#ff9d3c';
    ctx.fillRect(x - 4, m.y0 * CELULA, 8, (m.y1 - m.y0) * CELULA * f);
    ctx.strokeStyle = '#ffce5c';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 7, m.y0 * CELULA, 14, (m.y1 - m.y0) * CELULA);
    ctx.fillStyle = '#ffd9a8';
    ctx.font = '700 9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(x, (m.y0 + m.y1) / 2 * CELULA);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`MURO ${Math.ceil(p.hp)}`, 0, 3);
    ctx.restore();
    ctx.restore();
  }

  _tiros(jogo) {
    const ctx = this.ctx;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    for (const b of jogo.tiros) {
      const c = DANOS[b.tipo].cor;
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.moveTo(b.x * CELULA, b.y * CELULA);
      ctx.lineTo(b.x * CELULA - b.vx * 0.016 * CELULA, b.y * CELULA - b.vy * 0.016 * CELULA);
      ctx.stroke();
    }
  }

  _particulas(dt) {
    const ctx = this.ctx;
    const vivas = [];
    for (const p of this.particulas) {
      p.vida -= dt;
      if (p.vida <= 0) continue;
      const a = p.vida / p.max;
      if (p.anel) {
        ctx.strokeStyle = hexA(p.cor, a * 0.85);
        ctx.lineWidth = 2.5 * a + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * (1 - a), 0, TAU);
        ctx.stroke();
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt;
        ctx.fillStyle = hexA(p.cor, a);
        ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
      }
      vivas.push(p);
    }
    this.particulas = vivas;
  }

  _flutuantes(dt) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.font = '700 12px ui-monospace, monospace';
    const vivos = [];
    for (const f of this.flutuantes) {
      f.vida -= dt;
      if (f.vida <= 0) continue;
      const a = f.vida / f.max;
      f.y -= 26 * dt;
      ctx.fillStyle = hexA(f.cor, a);
      ctx.fillText(f.txt, f.x, f.y);
      vivos.push(f);
    }
    this.flutuantes = vivos;
  }
}

// -------------------------------------------------------------------- formas

function tracar(g, cels) {
  g.beginPath();
  for (let i = 0; i < cels.length; i++) {
    const x = (cels[i][0] + 0.5) * CELULA;
    const y = (cels[i][1] + 0.5) * CELULA;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
}

function octo(ctx, x, y, r) {
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + Math.PI / 8;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function poligono(ctx, n, r, giro = 0) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + giro;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// O traco em volta sai caro num rasterizador de software, mas aqui ele so roda
// uma vez por combinacao de forma, cor e raio: quem chama isto no laco quente
// e o cache de selos, nao o quadro.
function forma(ctx, nome, r, cor, fase) {
  ctx.fillStyle = cor;
  ctx.strokeStyle = 'rgba(0,0,0,.55)';
  ctx.lineWidth = 1.4;
  switch (nome) {
    case 'gota':
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.3);
      ctx.bezierCurveTo(r, -r * 0.2, r * 0.8, r, 0, r);
      ctx.bezierCurveTo(-r * 0.8, r, -r, -r * 0.2, 0, -r * 1.3);
      ctx.fill(); ctx.stroke();
      break;
    case 'quadrado':
      ctx.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
      ctx.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
      break;
    case 'losango': poligono(ctx, 4, r, 0); ctx.fill(); ctx.stroke(); break;
    case 'triangulo': poligono(ctx, 3, r * 1.15, -Math.PI / 2); ctx.fill(); ctx.stroke(); break;
    case 'hexagono': poligono(ctx, 6, r, 0); ctx.fill(); ctx.stroke(); break;
    case 'octogono':
      poligono(ctx, 8, r, Math.PI / 8); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2;
      poligono(ctx, 8, r * 0.62, Math.PI / 8); ctx.stroke();
      break;
    case 'seta':
      ctx.beginPath();
      ctx.moveTo(r * 1.2, 0); ctx.lineTo(-r * 0.4, -r * 0.9);
      ctx.lineTo(-r * 0.1, 0); ctx.lineTo(-r * 0.4, r * 0.9);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'estrela':
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * TAU - Math.PI / 2;
        const rr = i % 2 ? r * 0.46 : r * 1.18;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'asa':
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.5, r * 0.95, 0, 0, TAU);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      const bat = Math.sin(fase * 12) * 0.35;
      ctx.moveTo(0, -r * 0.2);
      ctx.lineTo(-r * 1.6, -r * (0.5 + bat));
      ctx.lineTo(-r * 0.3, r * 0.4);
      ctx.closePath();
      ctx.moveTo(0, -r * 0.2);
      ctx.lineTo(r * 1.6, -r * (0.5 + bat));
      ctx.lineTo(r * 0.3, r * 0.4);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    case 'escudo':
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.2);
      ctx.lineTo(r, -r * 0.5); ctx.lineTo(r * 0.75, r); ctx.lineTo(0, r * 1.25);
      ctx.lineTo(-r * 0.75, r); ctx.lineTo(-r, -r * 0.5);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'mascara':
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.15, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(20,18,16,.8)';
      ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.18, r * 0.2, r * 0.13, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.38, -r * 0.18, r * 0.2, r * 0.13, 0, 0, TAU); ctx.fill();
      break;
    case 'cruz':
      ctx.fillRect(-r * 0.32, -r * 1.1, r * 0.64, r * 2.2);
      ctx.fillRect(-r * 1.1, -r * 0.32, r * 2.2, r * 0.64);
      ctx.strokeRect(-r * 0.32, -r * 1.1, r * 0.64, r * 2.2);
      break;
    case 'ampulheta':
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, -r); ctx.lineTo(r * 0.85, -r); ctx.lineTo(-r * 0.85, r);
      ctx.lineTo(r * 0.85, r); ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    case 'balanca':
      ctx.fillRect(-r * 0.12, -r, r * 0.24, r * 2);
      ctx.fillRect(-r * 1.1, -r * 0.72, r * 2.2, r * 0.22);
      ctx.beginPath(); ctx.arc(-r * 0.85, -r * 0.1, r * 0.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.85, -r * 0.1, r * 0.4, 0, TAU); ctx.fill();
      break;
    case 'grade':
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.4;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(i * r * 0.55, -r); ctx.lineTo(i * r * 0.55, r); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r, i * r * 0.55); ctx.lineTo(r, i * r * 0.55); ctx.stroke();
      }
      break;
    case 'caveira':
      ctx.beginPath(); ctx.arc(0, -r * 0.15, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillRect(-r * 0.5, r * 0.55, r, r * 0.5);
      ctx.fillStyle = '#20141a';
      ctx.beginPath(); ctx.arc(-r * 0.38, -r * 0.2, r * 0.25, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.38, -r * 0.2, r * 0.25, 0, TAU); ctx.fill();
      break;
    case 'foguete':
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.5); ctx.lineTo(r * 0.55, r * 0.5); ctx.lineTo(r * 0.9, r * 1.1);
      ctx.lineTo(-r * 0.9, r * 1.1); ctx.lineTo(-r * 0.55, r * 0.5);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff8f4a';
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, r * 1.1); ctx.lineTo(0, r * (1.7 + Math.abs(Math.sin(fase * 20)) * 0.5)); ctx.lineTo(r * 0.4, r * 1.1);
      ctx.closePath(); ctx.fill();
      break;
    case 'oculos':
      ctx.fillRect(-r * 1.25, -r * 0.5, r * 2.5, r);
      ctx.strokeRect(-r * 1.25, -r * 0.5, r * 2.5, r);
      ctx.fillStyle = 'rgba(180,220,255,.55)';
      ctx.fillRect(-r * 1.1, -r * 0.34, r * 0.85, r * 0.68);
      ctx.fillRect(r * 0.25, -r * 0.34, r * 0.85, r * 0.68);
      break;
    case 'oculos-ceo':
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#24211a'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(-r * 0.42, -r * 0.1, r * 0.34, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(r * 0.42, -r * 0.1, r * 0.34, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.08, -r * 0.1); ctx.lineTo(r * 0.08, -r * 0.1); ctx.stroke();
      break;
    case 'espiral':
      ctx.strokeStyle = cor; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 46; i++) {
        const a = i / 46 * TAU * 2.6 + fase * 1.6;
        const rr = r * 1.3 * (i / 46);
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = cor;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, TAU); ctx.fill();
      break;
    case 'rolo':
      ctx.beginPath();
      ctx.roundRect(-r * 0.8, -r * 1.3, r * 1.6, r * 2.6, r * 0.35);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(12,28,32,.65)';
      for (let i = 0; i < 5; i++) {
        const off = ((fase * 40 + i * 12) % 26) - 13;
        ctx.fillRect(-r * 0.6, off * (r / 13) - 1, r * 1.2, 2);
      }
      break;
    case 'muro':
      ctx.fillRect(-r * 1.1, -r * 1.3, r * 2.2, r * 2.6);
      ctx.strokeStyle = 'rgba(0,0,0,.6)';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(-r * 1.1, i * r * 0.85); ctx.lineTo(r * 1.1, i * r * 0.85); ctx.stroke();
      }
      break;
    case 'chip':
      ctx.fillRect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44);
      ctx.strokeRect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44);
      ctx.fillStyle = 'rgba(24,8,22,.8)';
      ctx.fillRect(-r * 0.32, -r * 0.32, r * 0.64, r * 0.64);
      ctx.fillStyle = cor;
      for (let i = -1; i <= 1; i++) {
        ctx.fillRect(i * r * 0.4 - 1, -r * 1.12, 2.2, r * 0.4);
        ctx.fillRect(i * r * 0.4 - 1, r * 0.72, 2.2, r * 0.4);
        ctx.fillRect(-r * 1.12, i * r * 0.4 - 1, r * 0.4, 2.2);
        ctx.fillRect(r * 0.72, i * r * 0.4 - 1, r * 0.4, 2.2);
      }
      break;
    default:
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
  }
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function sombra(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgb(${Math.round(((n >> 16) & 255) * 0.22)},${Math.round(((n >> 8) & 255) * 0.22)},${Math.round((n & 255) * 0.22)})`;
}
