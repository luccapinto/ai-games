// Tudo que se ve, desenhado em codigo na carga da fase.
//
// A pasta do jogo nao tem um unico arquivo de imagem: parede, piso, bicho, item
// e arma saem daqui, de canvas fora de tela lidos como pixel cru. O render
// compoe pixel por pixel, entao ele precisa dos dados, nao do canvas.
//
// As paredes sao tingidas com a paleta da fase (ver `paleta` em fases.js): a
// mesma textura de rocha sai marrom na BOCA DA MINA e azul no POCO, e as nove
// fases deixam de parecer a mesma fase escura.

const TAM = 64;

function tela(largura = TAM, altura = TAM) {
  const c = document.createElement('canvas');
  c.width = largura;
  c.height = altura;
  return c;
}

function pixels(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { dados: d.data, largura: canvas.width, altura: canvas.height };
}

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function misturar(a, b, t) {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},`
    + `${Math.round(a[1] + (b[1] - a[1]) * t)},`
    + `${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

function clarear(hex, t) {
  return misturar(rgb(hex), [255, 255, 255], t);
}

function escurecer(hex, t) {
  return misturar(rgb(hex), [0, 0, 0], t);
}

// Sorteio com semente: textura tem de sair igual em toda maquina, senao uma
// captura de tela nao serve de referencia para a proxima.
function sorteio(semente) {
  let s = semente | 0 || 7;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function granular(ctx, cor, quantidade, alfa, semente) {
  const r = sorteio(semente);
  ctx.globalAlpha = alfa;
  ctx.fillStyle = cor;
  for (let i = 0; i < quantidade; i++) {
    const x = Math.floor(r() * TAM);
    const y = Math.floor(r() * TAM);
    const w = 1 + Math.floor(r() * 3);
    ctx.fillRect(x, y, w, 1 + Math.floor(r() * 2));
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------ paredes e piso

function texturaRocha(cor) {
  const c = tela();
  const ctx = c.getContext('2d');
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, TAM, TAM);
  granular(ctx, escurecer(cor, 0.45), 320, 0.5, 11);
  granular(ctx, clarear(cor, 0.3), 220, 0.35, 23);
  // veios: a rocha e o unico material sem linha reta, e e o que diferencia
  // galeria escavada de sala construida num relance
  const r = sorteio(5);
  ctx.strokeStyle = escurecer(cor, 0.62);
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    let x = r() * TAM;
    let y = 0;
    ctx.moveTo(x, y);
    while (y < TAM) {
      x += (r() - 0.5) * 9;
      y += 4 + r() * 6;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return pixels(c);
}

function texturaConcreto(cor) {
  const c = tela();
  const ctx = c.getContext('2d');
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, TAM, TAM);
  ctx.strokeStyle = escurecer(cor, 0.5);
  ctx.lineWidth = 1;
  for (let y = 0; y < TAM; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(TAM, y + 0.5);
    ctx.stroke();
    const desloca = (y / 16) % 2 ? 16 : 0;
    for (let x = desloca; x < TAM; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, y);
      ctx.lineTo(x + 0.5, y + 16);
      ctx.stroke();
    }
  }
  granular(ctx, escurecer(cor, 0.3), 180, 0.3, 31);
  granular(ctx, clarear(cor, 0.25), 120, 0.25, 37);
  // mancha de umidade escorrendo
  const r = sorteio(41);
  for (let i = 0; i < 3; i++) {
    const x = r() * TAM;
    const g = ctx.createLinearGradient(0, 0, 0, TAM);
    g.addColorStop(0, escurecer(cor, 0.45));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 4 + r() * 8, TAM);
    ctx.globalAlpha = 1;
  }
  return pixels(c);
}

function texturaChapa(cor) {
  const c = tela();
  const ctx = c.getContext('2d');
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, TAM, TAM);
  for (let y = 0; y < TAM; y += 32) {
    for (let x = 0; x < TAM; x += 32) {
      ctx.fillStyle = clarear(cor, 0.08);
      ctx.fillRect(x + 2, y + 2, 28, 28);
      ctx.strokeStyle = escurecer(cor, 0.55);
      ctx.strokeRect(x + 2.5, y + 2.5, 27, 27);
      ctx.fillStyle = escurecer(cor, 0.35);
      for (const [rx, ry] of [[6, 6], [25, 6], [6, 25], [25, 25]]) {
        ctx.beginPath();
        ctx.arc(x + rx, y + ry, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  granular(ctx, escurecer(cor, 0.5), 90, 0.25, 53);
  return pixels(c);
}

function texturaPorta(cor, faixa) {
  const c = tela();
  const ctx = c.getContext('2d');
  ctx.fillStyle = escurecer(cor, 0.25);
  ctx.fillRect(0, 0, TAM, TAM);
  ctx.fillStyle = clarear(cor, 0.05);
  ctx.fillRect(4, 2, TAM - 8, TAM - 4);
  ctx.strokeStyle = escurecer(cor, 0.6);
  ctx.lineWidth = 2;
  ctx.strokeRect(5, 3, TAM - 10, TAM - 6);
  // faixa diagonal de advertencia: e o que diz "isto abre" de longe
  ctx.save();
  ctx.beginPath();
  ctx.rect(8, 24, TAM - 16, 16);
  ctx.clip();
  ctx.fillStyle = escurecer(cor, 0.7);
  ctx.fillRect(8, 24, TAM - 16, 16);
  ctx.fillStyle = faixa;
  for (let x = -16; x < TAM + 16; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, 40);
    ctx.lineTo(x + 6, 40);
    ctx.lineTo(x + 14, 24);
    ctx.lineTo(x + 8, 24);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = escurecer(cor, 0.75);
  ctx.fillRect(TAM - 18, 44, 10, 4);
  return pixels(c);
}

function texturaPiso(cor, molhado = false) {
  const c = tela();
  const ctx = c.getContext('2d');
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, TAM, TAM);
  granular(ctx, escurecer(cor, 0.4), 300, 0.4, 61);
  granular(ctx, clarear(cor, 0.2), 200, 0.3, 67);
  ctx.strokeStyle = escurecer(cor, 0.35);
  ctx.beginPath();
  ctx.moveTo(0, 0.5);
  ctx.lineTo(TAM, 0.5);
  ctx.moveTo(0.5, 0);
  ctx.lineTo(0.5, TAM);
  ctx.stroke();
  if (molhado) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#20313a';
    ctx.fillRect(0, 0, TAM, TAM);
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#8fd3e8';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(TAM / 2, TAM / 2, 6 + i * 6, 3 + i * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  return pixels(c);
}

function texturaElevador(cor) {
  const c = tela();
  const ctx = c.getContext('2d');
  ctx.fillStyle = escurecer(cor, 0.5);
  ctx.fillRect(0, 0, TAM, TAM);
  ctx.strokeStyle = '#d8b34a';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, TAM - 12, TAM - 12);
  ctx.fillStyle = '#d8b34a';
  ctx.beginPath();
  ctx.moveTo(TAM / 2, 46);
  ctx.lineTo(TAM / 2 - 10, 30);
  ctx.lineTo(TAM / 2 - 4, 30);
  ctx.lineTo(TAM / 2 - 4, 18);
  ctx.lineTo(TAM / 2 + 4, 18);
  ctx.lineTo(TAM / 2 + 4, 30);
  ctx.lineTo(TAM / 2 + 10, 30);
  ctx.closePath();
  ctx.fill();
  return pixels(c);
}

export function criarTexturas(paleta) {
  return {
    rocha: texturaRocha(paleta.rocha),
    concreto: texturaConcreto(paleta.concreto),
    chapa: texturaChapa(paleta.chapa),
    porta: texturaPorta(paleta.chapa, '#e0c24a'),
    travadaA: texturaPorta(paleta.chapa, '#e05a4a'),
    travadaB: texturaPorta(paleta.chapa, '#4aa8e0'),
    travadaC: texturaPorta(paleta.chapa, '#7ae04a'),
    piso: texturaPiso(paleta.piso),
    poca: texturaPiso(paleta.piso, true),
    teto: texturaPiso(paleta.teto),
    elevador: texturaElevador(paleta.piso),
  };
}

// ----------------------------------------------------------------- bichos

// Cada bicho e uma silhueta diferente, e isso e requisito de jogo: a esta
// resolucao, num corredor escuro, a forma e a unica coisa que chega antes do
// nome. Duas poses por bicho, trocadas pela caminhada.
function spriteLarva(cor, cor2, pose) {
  const c = tela(48, 48);
  const ctx = c.getContext('2d');
  const balanco = pose ? 2 : -2;
  ctx.fillStyle = cor2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(14 + i * 6, 34 + (i % 2 ? balanco : -balanco) * 0.5, 7 - i * 0.7, 6 - i * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.ellipse(20, 30, 13, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cor2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(12 + i * 4, 40, 2, 4 + (i % 2 ? balanco : 0), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#1b1b14';
  ctx.beginPath();
  ctx.arc(27, 27, 2.4, 0, Math.PI * 2);
  ctx.arc(30, 31, 2.1, 0, Math.PI * 2);
  ctx.fill();
  return pixels(c);
}

function spriteRastejo(cor, cor2, pose) {
  const c = tela(48, 48);
  const ctx = c.getContext('2d');
  ctx.strokeStyle = cor2;
  ctx.lineWidth = 2.2;
  for (let i = 0; i < 4; i++) {
    const lado = i < 2 ? -1 : 1;
    const desloca = pose ? (i % 2 ? 4 : -4) : (i % 2 ? -4 : 4);
    ctx.beginPath();
    ctx.moveTo(24, 32);
    ctx.lineTo(24 + lado * 10, 32 + desloca * 0.6);
    ctx.lineTo(24 + lado * 15, 44);
    ctx.stroke();
  }
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.ellipse(24, 30, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cor2;
  ctx.beginPath();
  ctx.ellipse(24, 24, 5.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffdf6a';
  ctx.beginPath();
  ctx.arc(21.5, 23, 1.5, 0, Math.PI * 2);
  ctx.arc(26.5, 23, 1.5, 0, Math.PI * 2);
  ctx.fill();
  return pixels(c);
}

function spriteCego(cor, cor2, pose) {
  const c = tela(48, 48);
  const ctx = c.getContext('2d');
  const passo = pose ? 3 : -3;
  ctx.strokeStyle = cor2;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(24, 34);
  ctx.lineTo(20 - passo * 0.4, 47);
  ctx.moveTo(24, 34);
  ctx.lineTo(28 + passo * 0.4, 47);
  ctx.stroke();
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.ellipse(24, 24, 8, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  // bracos longos, que e o que avisa o alcance dele
  ctx.strokeStyle = cor;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(18, 18);
  ctx.lineTo(9, 26 + passo);
  ctx.lineTo(11, 36);
  ctx.moveTo(30, 18);
  ctx.lineTo(39, 26 - passo);
  ctx.lineTo(37, 36);
  ctx.stroke();
  ctx.fillStyle = cor2;
  ctx.beginPath();
  ctx.ellipse(24, 10, 6.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // sem olho nenhum: duas orelhas enormes no lugar
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.ellipse(17, 9, 3.5, 6, -0.4, 0, Math.PI * 2);
  ctx.ellipse(31, 9, 3.5, 6, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#463f36';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(20, 13);
  ctx.lineTo(28, 13);
  ctx.stroke();
  return pixels(c);
}

function spriteCuspe(cor, cor2, pose) {
  const c = tela(48, 48);
  const ctx = c.getContext('2d');
  ctx.fillStyle = cor2;
  ctx.beginPath();
  ctx.ellipse(16, 24, 10, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.ellipse(26, 28, 12, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = cor2;
  ctx.lineWidth = 2.5;
  for (const lado of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(26, 36);
    ctx.lineTo(26 + lado * 8, 41 + (pose ? 2 : 0));
    ctx.lineTo(26 + lado * 11, 47);
    ctx.stroke();
  }
  const boca = pose ? 5.5 : 3.5;
  ctx.fillStyle = '#c8f06a';
  ctx.beginPath();
  ctx.arc(34, 26, boca, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20301f';
  ctx.beginPath();
  ctx.arc(34, 26, boca * 0.45, 0, Math.PI * 2);
  ctx.fill();
  return pixels(c);
}

function spriteCapataz(cor, cor2, pose) {
  const c = tela(48, 48);
  const ctx = c.getContext('2d');
  const passo = pose ? 4 : -4;
  ctx.fillStyle = cor2;
  ctx.fillRect(16 - passo * 0.3, 34, 7, 14);
  ctx.fillRect(25 + passo * 0.3, 34, 7, 14);
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.moveTo(10, 18);
  ctx.lineTo(38, 18);
  ctx.lineTo(34, 36);
  ctx.lineTo(14, 36);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = cor2;
  for (let y = 21; y < 34; y += 5) ctx.fillRect(13, y, 22, 2);
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.ellipse(24, 12, 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b1f12';
  ctx.fillRect(16, 10, 16, 4);
  // a lampada do capacete: e o aviso de que ele ve voce no escuro
  ctx.fillStyle = '#ffe9a0';
  ctx.beginPath();
  ctx.arc(24, 7, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = cor2;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(12, 22);
  ctx.lineTo(4, 30 + passo);
  ctx.moveTo(36, 22);
  ctx.lineTo(44, 30 - passo);
  ctx.stroke();
  return pixels(c);
}

const DESENHOS = {
  larva: spriteLarva,
  rastejo: spriteRastejo,
  cego: spriteCego,
  cuspe: spriteCuspe,
  capataz: spriteCapataz,
};

export function criarSpritesInimigos(TIPOS) {
  const saida = {};
  for (const [nome, t] of Object.entries(TIPOS)) {
    const desenho = DESENHOS[nome];
    saida[nome] = {
      poses: [desenho(t.cor, t.cor2, 0), desenho(t.cor, t.cor2, 1)],
      morto: spriteMorto(t.sangue, t.cor2),
    };
  }
  return saida;
}

function spriteMorto(sangue, cor2) {
  const c = tela(48, 48);
  const ctx = c.getContext('2d');
  ctx.fillStyle = sangue;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(24, 44, 16, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = cor2;
  ctx.beginPath();
  ctx.ellipse(24, 42, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  return pixels(c);
}

// ------------------------------------------------------------------ itens

function moldura(ctx, cor, borda) {
  ctx.fillStyle = cor;
  ctx.fillRect(14, 20, 20, 16);
  ctx.strokeStyle = borda;
  ctx.lineWidth = 2;
  ctx.strokeRect(15, 21, 18, 14);
}

const ITEM_DESENHOS = {
  pinos: (ctx) => {
    moldura(ctx, '#6f6a5e', '#3b382f');
    ctx.fillStyle = '#d9d2bd';
    for (let i = 0; i < 4; i++) ctx.fillRect(17 + i * 4, 23, 2, 10);
  },
  cartuchos: (ctx) => {
    moldura(ctx, '#7a3a2a', '#40201a');
    ctx.fillStyle = '#c8a84a';
    for (let i = 0; i < 3; i++) ctx.fillRect(18 + i * 5, 26, 4, 8);
  },
  gas: (ctx) => {
    ctx.fillStyle = '#b06a28';
    ctx.beginPath();
    ctx.ellipse(24, 29, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(22, 16, 4, 6);
    ctx.fillStyle = '#ffce6a';
    ctx.fillRect(20, 26, 8, 3);
  },
  pilha: (ctx) => {
    ctx.fillStyle = '#2f3f57';
    ctx.fillRect(17, 20, 14, 18);
    ctx.fillStyle = '#7fd8ff';
    ctx.fillRect(19, 22, 10, 6);
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(21, 17, 6, 3);
  },
  kit: (ctx) => {
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(14, 21, 20, 15);
    ctx.fillStyle = '#c03a2a';
    ctx.fillRect(22, 24, 4, 9);
    ctx.fillRect(18, 27, 12, 3);
  },
  cracha: (ctx, cor) => {
    ctx.fillStyle = cor;
    ctx.fillRect(16, 22, 16, 12);
    ctx.fillStyle = '#20201c';
    ctx.fillRect(18, 24, 7, 4);
    ctx.fillStyle = '#f0f0e4';
    ctx.fillRect(18, 30, 12, 2);
  },
  arma: (ctx, cor) => {
    ctx.fillStyle = '#3b3b38';
    ctx.fillRect(13, 26, 22, 4);
    ctx.fillStyle = cor;
    ctx.fillRect(16, 30, 7, 6);
    ctx.fillStyle = '#7a6a4a';
    ctx.fillRect(26, 22, 4, 5);
  },
};

const COR_CRACHA = { A: '#e05a4a', B: '#4aa8e0', C: '#7ae04a' };

export function criarSpritesItens() {
  const saida = {};
  const fazer = (fn, cor) => {
    const c = tela(48, 48);
    const ctx = c.getContext('2d');
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(24, 38, 11, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    fn(ctx, cor);
    return pixels(c);
  };
  for (const [nome, fn] of Object.entries(ITEM_DESENHOS)) {
    if (nome === 'cracha') {
      for (const [letra, cor] of Object.entries(COR_CRACHA)) {
        saida[`cracha-${letra}`] = fazer(fn, cor);
      }
    } else if (nome === 'arma') {
      saida['arma-espingarda'] = fazer(fn, '#8a5a2a');
      saida['arma-macarico'] = fazer(fn, '#b04a2a');
    } else {
      saida[nome] = fazer(fn);
    }
  }
  saida.cuspe = (() => {
    const c = tela(48, 48);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#b6f06a';
    ctx.beginPath();
    ctx.arc(24, 24, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8ffc0';
    ctx.beginPath();
    ctx.arc(22, 22, 3, 0, Math.PI * 2);
    ctx.fill();
    return pixels(c);
  })();
  return saida;
}

export function chaveDoItem(item) {
  if (item.tipo === 'cracha') return `cracha-${item.cracha}`;
  if (item.tipo === 'arma') return `arma-${item.arma}`;
  return item.tipo;
}
