// Render de cima, camera presa no carro e girando com ele.
//
// A pista inteira e desenhada uma vez numa tela fora de tela, em coordenadas do
// mundo (2 px por metro): grama, asfalto, zebra, linha de chegada, box. Depois e
// so blitar com transformacao. Fazer isso por quadro custaria milhares de
// segmentos por carro; assim o custo por quadro e um drawImage, os carros e as
// particulas.
//
// A marca de pneu e desenhada na MESMA tela fora de tela, e por isso ela fica:
// a borracha no asfalto e memoria da corrida, nao efeito de um quadro.

import { CARRO, velocidadeKmh } from './fisica.js';
import { LIMITE_ZEBRA, LIMITE_GRAMA } from './pista.js';

const PX_POR_METRO = 2;
const MARGEM = 60;

export function criarRender(canvas) {
  const ctx = canvas.getContext('2d');
  let pista = null;
  let linha = null;
  let fundo = null;
  let fundoCtx = null;
  let origem = { x: 0, y: 0 };
  const particulas = [];
  const menosMovimento = !!(window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function trocarPista(novaPista, novaLinha) {
    pista = novaPista;
    linha = novaLinha;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of pista.centro) {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x);
      maxY = Math.max(maxY, c.y);
    }
    origem = { x: minX - MARGEM, y: minY - MARGEM };
    const largura = Math.ceil((maxX - minX + MARGEM * 2) * PX_POR_METRO);
    const altura = Math.ceil((maxY - minY + MARGEM * 2) * PX_POR_METRO);
    fundo = document.createElement('canvas');
    fundo.width = largura;
    fundo.height = altura;
    fundoCtx = fundo.getContext('2d');
    pintarPista();
    particulas.length = 0;
  }

  const paraTela = (x, y) => ({
    x: (x - origem.x) * PX_POR_METRO,
    y: (y - origem.y) * PX_POR_METRO,
  });

  function fita(ctx2, deslocamento, largura, estilo) {
    ctx2.beginPath();
    for (const [i, c] of pista.centro.entries()) {
      const nx = -Math.sin(c.ang);
      const ny = Math.cos(c.ang);
      const p = paraTela(c.x + nx * (deslocamento + largura / 2),
        c.y + ny * (deslocamento + largura / 2));
      if (i === 0) ctx2.moveTo(p.x, p.y);
      else ctx2.lineTo(p.x, p.y);
    }
    for (let i = pista.centro.length - 1; i >= 0; i--) {
      const c = pista.centro[i];
      const nx = -Math.sin(c.ang);
      const ny = Math.cos(c.ang);
      const p = paraTela(c.x + nx * (deslocamento - largura / 2),
        c.y + ny * (deslocamento - largura / 2));
      ctx2.lineTo(p.x, p.y);
    }
    ctx2.closePath();
    ctx2.fillStyle = estilo;
    ctx2.fill();
  }

  function pintarPista() {
    const p = pista.paleta;
    // grama com granulado, para a velocidade ter referencia visual
    fundoCtx.fillStyle = p.grama;
    fundoCtx.fillRect(0, 0, fundo.width, fundo.height);
    fundoCtx.globalAlpha = 0.18;
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * fundo.width;
      const y = Math.random() * fundo.height;
      fundoCtx.fillStyle = i % 2 ? '#000' : '#fff';
      fundoCtx.fillRect(x, y, 2, 2);
    }
    fundoCtx.globalAlpha = 1;

    // zona de escape, zebra e asfalto, de fora para dentro
    for (const [i, c] of pista.centro.entries()) {
      void i;
      void c;
      break;
    }
    fitaVariavel(LIMITE_GRAMA, '#2c2c30');
    fitaVariavel(LIMITE_ZEBRA, p.zebra);
    fitaVariavel(0, p.asfalto);

    // zebra em blocos alternados, por cima da faixa continua
    for (const [i, c] of pista.centro.entries()) {
      if (Math.floor(i / 3) % 2) continue;
      const nx = -Math.sin(c.ang);
      const ny = Math.cos(c.ang);
      for (const lado of [-1, 1]) {
        const a = paraTela(c.x + nx * lado * (c.largura / 2), c.y + ny * lado * (c.largura / 2));
        const b = paraTela(c.x + nx * lado * (c.largura / 2 + LIMITE_ZEBRA),
          c.y + ny * lado * (c.largura / 2 + LIMITE_ZEBRA));
        fundoCtx.strokeStyle = '#f0f0e8';
        fundoCtx.lineWidth = 3 * PX_POR_METRO;
        fundoCtx.beginPath();
        fundoCtx.moveTo(a.x, a.y);
        fundoCtx.lineTo(b.x, b.y);
        fundoCtx.stroke();
      }
    }

    // granulado do asfalto e marca de borracha da linha de corrida
    fundoCtx.globalAlpha = 0.07;
    for (const [i, c] of pista.centro.entries()) {
      if (i % 2) continue;
      const nx = -Math.sin(c.ang);
      const ny = Math.cos(c.ang);
      const d = linha ? linha.deslocamentos[i] : 0;
      const a = paraTela(c.x + nx * d, c.y + ny * d);
      fundoCtx.fillStyle = '#000';
      fundoCtx.beginPath();
      fundoCtx.arc(a.x, a.y, 2.2 * PX_POR_METRO, 0, Math.PI * 2);
      fundoCtx.fill();
    }
    fundoCtx.globalAlpha = 1;

    // linha de chegada
    const chegada = pista.centro[0];
    const nx = -Math.sin(chegada.ang);
    const ny = Math.cos(chegada.ang);
    for (let k = 0; k < 10; k++) {
      const desloca = -chegada.largura / 2 + (k * chegada.largura) / 10;
      const a = paraTela(chegada.x + nx * desloca, chegada.y + ny * desloca);
      fundoCtx.fillStyle = k % 2 ? '#101014' : '#f0f0e8';
      fundoCtx.save();
      fundoCtx.translate(a.x, a.y);
      fundoCtx.rotate(chegada.ang);
      fundoCtx.fillRect(-1.2 * PX_POR_METRO, 0,
        2.4 * PX_POR_METRO, (chegada.largura / 10) * PX_POR_METRO);
      fundoCtx.restore();
    }

    // box: retangulo pintado no asfalto, do lado de dentro da reta
    const box = pista.box;
    const b = paraTela(box.x, box.y);
    fundoCtx.save();
    fundoCtx.translate(b.x, b.y);
    fundoCtx.rotate(box.ang);
    fundoCtx.strokeStyle = '#e8c24a';
    fundoCtx.lineWidth = 0.5 * PX_POR_METRO;
    fundoCtx.strokeRect(-6 * PX_POR_METRO, -3 * PX_POR_METRO,
      12 * PX_POR_METRO, 6 * PX_POR_METRO);
    fundoCtx.fillStyle = 'rgba(232,194,74,0.14)';
    fundoCtx.fillRect(-6 * PX_POR_METRO, -3 * PX_POR_METRO,
      12 * PX_POR_METRO, 6 * PX_POR_METRO);
    fundoCtx.restore();
  }

  // A largura muda ao longo da volta, entao a fita e desenhada ponto a ponto.
  function fitaVariavel(extra, estilo) {
    fundoCtx.beginPath();
    for (const [i, c] of pista.centro.entries()) {
      const nx = -Math.sin(c.ang);
      const ny = Math.cos(c.ang);
      const p = paraTela(c.x + nx * (c.largura / 2 + extra), c.y + ny * (c.largura / 2 + extra));
      if (i === 0) fundoCtx.moveTo(p.x, p.y);
      else fundoCtx.lineTo(p.x, p.y);
    }
    // repete o primeiro ponto: sem isto sobra um entalhe na emenda da volta
    {
      const c = pista.centro[0];
      const p = paraTela(c.x - Math.sin(c.ang) * (c.largura / 2 + extra),
        c.y + Math.cos(c.ang) * (c.largura / 2 + extra));
      fundoCtx.lineTo(p.x, p.y);
    }
    for (let i = pista.centro.length - 1; i >= 0; i--) {
      const c = pista.centro[i];
      const nx = -Math.sin(c.ang);
      const ny = Math.cos(c.ang);
      const p = paraTela(c.x - nx * (c.largura / 2 + extra), c.y - ny * (c.largura / 2 + extra));
      fundoCtx.lineTo(p.x, p.y);
    }
    {
      const c = pista.centro[pista.centro.length - 1];
      const p = paraTela(c.x + Math.sin(c.ang) * (c.largura / 2 + extra),
        c.y - Math.cos(c.ang) * (c.largura / 2 + extra));
      fundoCtx.lineTo(p.x, p.y);
    }
    fundoCtx.closePath();
    fundoCtx.fillStyle = estilo;
    fundoCtx.fill();
  }

  function marcarPneu(carro) {
    if (!fundoCtx || carro.derrapagem < 0.35) return;
    const p = paraTela(carro.x, carro.y);
    const traseira = 1.3;
    fundoCtx.globalAlpha = Math.min(0.42, carro.derrapagem * 0.42);
    fundoCtx.fillStyle = '#16161a';
    for (const lado of [-0.7, 0.7]) {
      const ox = Math.cos(carro.ang) * -traseira - Math.sin(carro.ang) * lado;
      const oy = Math.sin(carro.ang) * -traseira + Math.cos(carro.ang) * lado;
      fundoCtx.beginPath();
      fundoCtx.arc(p.x + ox * PX_POR_METRO, p.y + oy * PX_POR_METRO,
        0.34 * PX_POR_METRO, 0, Math.PI * 2);
      fundoCtx.fill();
    }
    fundoCtx.globalAlpha = 1;
  }

  function poeira(carro, tipo) {
    const cor = tipo === 'grama' ? [120, 150, 90] : [210, 205, 190];
    for (let i = 0; i < 2; i++) {
      particulas.push({
        x: carro.x - Math.cos(carro.ang) * 1.6,
        y: carro.y - Math.sin(carro.ang) * 1.6,
        vx: (Math.random() - 0.5) * 6 - carro.vx * 0.1 * Math.cos(carro.ang),
        vy: (Math.random() - 0.5) * 6 - carro.vx * 0.1 * Math.sin(carro.ang),
        vida: 0.45 + Math.random() * 0.5,
        tam: 0.5 + Math.random() * 1.4,
        cor,
      });
    }
  }

  function desenharCarro(c, alvo, escala, rotacaoCamera) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.ang);

    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-CARRO.comprimento / 2 + 0.2, -CARRO.largura / 2 + 0.25,
      CARRO.comprimento, CARRO.largura);

    // rodas
    ctx.fillStyle = '#16161a';
    const esterco = c.tipo === 'jogador' ? (c.ultimoVolante || 0) : 0;
    for (const [dx, dy, gira] of [
      [CARRO.dianteiro, -CARRO.largura / 2, 1],
      [CARRO.dianteiro, CARRO.largura / 2, 1],
      [-CARRO.traseiro, -CARRO.largura / 2, 0],
      [-CARRO.traseiro, CARRO.largura / 2, 0],
    ]) {
      ctx.save();
      ctx.translate(dx, dy);
      if (gira) ctx.rotate(esterco * 0.4);
      ctx.fillRect(-0.34, -0.17, 0.68, 0.34);
      ctx.restore();
    }

    // corpo
    const corpo = ctx.createLinearGradient(0, -CARRO.largura / 2, 0, CARRO.largura / 2);
    corpo.addColorStop(0, c.cor);
    corpo.addColorStop(0.5, clarear(c.cor, 0.25));
    corpo.addColorStop(1, c.cor);
    ctx.fillStyle = corpo;
    ctx.beginPath();
    ctx.moveTo(CARRO.comprimento / 2, -0.55);
    ctx.lineTo(CARRO.comprimento / 2 - 0.4, -0.72);
    ctx.lineTo(0.2, -CARRO.largura / 2);
    ctx.lineTo(-CARRO.comprimento / 2 + 0.3, -CARRO.largura / 2);
    ctx.lineTo(-CARRO.comprimento / 2, -0.7);
    ctx.lineTo(-CARRO.comprimento / 2, 0.7);
    ctx.lineTo(-CARRO.comprimento / 2 + 0.3, CARRO.largura / 2);
    ctx.lineTo(0.2, CARRO.largura / 2);
    ctx.lineTo(CARRO.comprimento / 2 - 0.4, 0.72);
    ctx.lineTo(CARRO.comprimento / 2, 0.55);
    ctx.closePath();
    ctx.fill();

    // asa dianteira, cockpit e asa traseira
    ctx.fillStyle = '#1c1c20';
    ctx.fillRect(CARRO.comprimento / 2 - 0.25, -0.85, 0.3, 1.7);
    ctx.fillRect(-CARRO.comprimento / 2, -0.95, 0.35, 1.9);
    ctx.fillStyle = 'rgba(20,24,30,0.9)';
    ctx.beginPath();
    ctx.ellipse(-0.2, 0, 0.7, 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    if (alvo) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 0.09;
      ctx.beginPath();
      ctx.arc(0, 0, CARRO.comprimento * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // nome, so quando a camera esta perto o bastante para caber
    if (!alvo && escala > 3.2) {
      ctx.save();
      ctx.translate(c.x, c.y);
      // Cancela a rotacao da camera: sem isto o nome do piloto sai deitado,
      // porque o mundo inteiro esta girado para o carro apontar para cima.
      ctx.rotate(-rotacaoCamera);
      ctx.fillStyle = 'rgba(240,240,230,0.85)';
      ctx.font = `${1.5}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(c.nome.split(' ').pop(), 0, -3.1);
      ctx.restore();
    }
  }

  function desenhar(corrida, dt, opcoes = {}) {
    const jogador = opcoes.camera || corrida.carros[0];
    const largura = canvas.width;
    const altura = canvas.height;
    const rapidez = Math.abs(jogador.vx);
    // Zoom: 13 px/m parado, 8 px/m a 300 km/h. Comecou em 6,2 e a captura de
    // tela mostrou o problema — o carro tinha 30 px numa tela de 1600 e a
    // camera enquadrava 250 m de pista, o que e mapa, nao corrida.
    const escala = Math.max(8, 13 - rapidez * 0.07);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Fundo na cor da grama, e nao na cor do ceu: fora da imagem pre-desenhada
    // a tela mostrava uma faixa preta do lado de fora da pista.
    ctx.fillStyle = pista.paleta.grama;
    ctx.fillRect(0, 0, largura, altura);

    const rotacaoCamera = opcoes.norte ? 0 : -jogador.ang - Math.PI / 2;
    ctx.save();
    ctx.translate(largura / 2, altura * 0.62);
    ctx.scale(escala, escala);
    ctx.rotate(rotacaoCamera);
    ctx.translate(-jogador.x, -jogador.y);

    // a pista pronta, em coordenadas do mundo
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fundo, origem.x, origem.y,
      fundo.width / PX_POR_METRO, fundo.height / PX_POR_METRO);

    if (opcoes.mostrarLinha && linha) {
      ctx.strokeStyle = 'rgba(232,194,74,0.55)';
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      for (const [i, p] of linha.pontos.entries()) {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dt;
      if (p.vida <= 0) { particulas.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      ctx.fillStyle = `rgba(${p.cor[0]},${p.cor[1]},${p.cor[2]},${Math.min(0.5, p.vida)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.tam, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const c of corrida.carros) {
      if (c.noBox && c !== jogador) continue;
      desenharCarro(c, c === jogador, escala, rotacaoCamera);
    }
    ctx.restore();

    if (!menosMovimento && jogador.derrapagem > 0.5) {
      // tremor leve na derrapagem: informacao, nao enfeite — e o que faz o
      // jogador sentir que perdeu a traseira antes de ver.
      const t = (jogador.derrapagem - 0.5) * 3;
      ctx.setTransform(1, 0, 0, 1, (Math.random() - 0.5) * t, (Math.random() - 0.5) * t);
    }
  }

  function desenharMapa(mapaCanvas, corrida, jogador) {
    const m = mapaCanvas.getContext('2d');
    const largura = mapaCanvas.width;
    const altura = mapaCanvas.height;
    m.clearRect(0, 0, largura, altura);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of pista.centro) {
      minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y);
    }
    const escala = Math.min(largura / (maxX - minX + 40), altura / (maxY - minY + 40));
    const px = (x) => (x - minX + 20) * escala;
    const py = (y) => (y - minY + 20) * escala;

    m.strokeStyle = 'rgba(230,230,220,0.5)';
    m.lineWidth = Math.max(2, pista.centro[0].largura * escala * 0.5);
    m.beginPath();
    for (const [i, c] of pista.centro.entries()) {
      if (i === 0) m.moveTo(px(c.x), py(c.y));
      else m.lineTo(px(c.x), py(c.y));
    }
    m.closePath();
    m.stroke();

    for (const c of corrida.carros) {
      m.fillStyle = c === jogador ? '#ffffff' : c.cor;
      m.beginPath();
      m.arc(px(c.x), py(c.y), c === jogador ? 3.2 : 2.4, 0, Math.PI * 2);
      m.fill();
    }
  }

  return {
    trocarPista, desenhar, desenharMapa, marcarPneu, poeira,
    get escala() { return PX_POR_METRO; },
  };
}

function clarear(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 255 * t);
  const g = Math.min(255, ((n >> 8) & 255) + 255 * t);
  const b = Math.min(255, (n & 255) + 255 * t);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export { velocidadeKmh };
