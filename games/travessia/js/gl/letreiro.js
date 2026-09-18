// Letra em 3D sem arquivo de fonte: um canvas 2D escreve o alfabeto uma vez,
// vira textura, e cada letra desenhada no mundo e um quadrado virado para a
// camera recortando o atlas.
//
// E aqui tambem que mora o pingo redondo das particulas — poeira, sangue e
// respingo saem do mesmo atlas, entao particula e numero de dano custam a
// mesma passada de desenho.

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  + 'abcdefghijklmnopqrstuvwxyz'
  + '0123456789'
  + 'ÁÂÃÀÉÊÍÓÔÕÚÜÇáâãàéêíóôõúüç'
  + " .,'-+!?:/()%";

const LADO = 512;
const CORPO = 40;

export function criarAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = LADO;
  canvas.height = LADO;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, LADO, LADO);
  ctx.font = `700 ${CORPO}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';

  const glifos = new Map();
  const margem = 3;
  const linha = CORPO + 14;
  let x = margem;
  let y = margem;

  for (const letra of LETRAS) {
    const largura = Math.ceil(ctx.measureText(letra).width) + 2;
    if (x + largura + margem > LADO) {
      x = margem;
      y += linha;
    }
    ctx.fillText(letra, x + 1, y + CORPO);
    glifos.set(letra, {
      x: x / LADO,
      y: y / LADO,
      w: largura / LADO,
      h: linha / LADO,
      avanco: largura / linha,
    });
    x += largura + margem;
  }

  // pingo redondo para particula, no canto que sobrou
  y += linha;
  const raio = 24;
  const cx = margem + raio;
  const cy = y + raio;
  const gradiente = ctx.createRadialGradient(cx, cy, 0, cx, cy, raio);
  gradiente.addColorStop(0, 'rgba(255,255,255,1)');
  gradiente.addColorStop(0.55, 'rgba(255,255,255,0.85)');
  gradiente.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradiente;
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.fill();

  const pingo = {
    x: (cx - raio) / LADO,
    y: (cy - raio) / LADO,
    w: (raio * 2) / LADO,
    h: (raio * 2) / LADO,
  };

  return { canvas, glifos, pingo, proporcao: linha };
}

// Larguras somadas em unidades de altura de linha: serve para centralizar o
// texto antes de empilhar as letras.
export function medir(atlas, texto) {
  let total = 0;
  for (const letra of texto) {
    const g = atlas.glifos.get(letra);
    if (g) total += g.avanco;
  }
  return total;
}

// Empurra as letras de um texto para a lista de paineis. `ancora` 0 alinha a
// esquerda, 0,5 centraliza. O deslocamento de cada letra ja sai somado na
// posicao, no eixo direito da camera: assim o painel continua com treze
// floats e um so atributo de instancia.
export function escrever(lista, atlas, texto, x, y, z, tamanho, cor, direita, ancora = 0.5) {
  const largura = medir(atlas, texto) * tamanho;
  let passo = -largura * ancora;
  for (const letra of texto) {
    const g = atlas.glifos.get(letra);
    if (!g) continue;
    const w = g.avanco * tamanho;
    if (letra !== ' ') {
      const d = passo + w / 2;
      lista.push(
        x + direita[0] * d, y + direita[1] * d, z + direita[2] * d,
        w, tamanho,
        cor[0], cor[1], cor[2], cor[3],
        g.x, g.y, g.w, g.h,
      );
    }
    passo += w;
  }
}
