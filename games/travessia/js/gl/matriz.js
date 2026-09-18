// Matrizes 4x4 em coluna primeiro, como o OpenGL espera, e o pouco de vetor
// que o render precisa. Sem biblioteca: sao doze funcoes e nenhuma delas tem
// segredo — o que importa e que todas escrevem num destino ja alocado, porque
// o laco de desenho roda sessenta vezes por segundo e nao pode ficar criando
// Float32Array a cada quadro.

export const criarMat4 = () => new Float32Array(16);

export function identidade(m) {
  m.fill(0);
  m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
  return m;
}

export function copiar(saida, m) {
  saida.set(m);
  return saida;
}

export function multiplicar(saida, a, b) {
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4];
    const b1 = b[c * 4 + 1];
    const b2 = b[c * 4 + 2];
    const b3 = b[c * 4 + 3];
    saida[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    saida[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    saida[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    saida[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return saida;
}

export function perspectiva(saida, campo, aspecto, perto, longe) {
  const f = 1 / Math.tan(campo / 2);
  saida.fill(0);
  saida[0] = f / aspecto;
  saida[5] = f;
  saida[10] = (longe + perto) / (perto - longe);
  saida[11] = -1;
  saida[14] = (2 * longe * perto) / (perto - longe);
  return saida;
}

export function ortografica(saida, esquerda, direita, baixo, cima, perto, longe) {
  saida.fill(0);
  saida[0] = 2 / (direita - esquerda);
  saida[5] = 2 / (cima - baixo);
  saida[10] = -2 / (longe - perto);
  saida[12] = -(direita + esquerda) / (direita - esquerda);
  saida[13] = -(cima + baixo) / (cima - baixo);
  saida[14] = -(longe + perto) / (longe - perto);
  saida[15] = 1;
  return saida;
}

export function olhar(saida, olho, alvo, cima) {
  let zx = olho[0] - alvo[0];
  let zy = olho[1] - alvo[1];
  let zz = olho[2] - alvo[2];
  let n = Math.hypot(zx, zy, zz) || 1;
  zx /= n; zy /= n; zz /= n;

  let xx = cima[1] * zz - cima[2] * zy;
  let xy = cima[2] * zx - cima[0] * zz;
  let xz = cima[0] * zy - cima[1] * zx;
  n = Math.hypot(xx, xy, xz);
  if (n < 1e-6) { xx = 1; xy = 0; xz = 0; } else { xx /= n; xy /= n; xz /= n; }

  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  saida[0] = xx; saida[1] = yx; saida[2] = zx; saida[3] = 0;
  saida[4] = xy; saida[5] = yy; saida[6] = zy; saida[7] = 0;
  saida[8] = xz; saida[9] = yz; saida[10] = zz; saida[11] = 0;
  saida[12] = -(xx * olho[0] + xy * olho[1] + xz * olho[2]);
  saida[13] = -(yx * olho[0] + yy * olho[1] + yz * olho[2]);
  saida[14] = -(zx * olho[0] + zy * olho[1] + zz * olho[2]);
  saida[15] = 1;
  return saida;
}

// Corpo rigido com escala: giro em Y no mesmo sentido que `ang` do jogo
// (o modelo olha para +X e giro leva +X para (cos giro, 0, sen giro)),
// escala uniforme e posicao. Evita montar tres matrizes e multiplicar.
export function pousar(saida, x, y, z, giro, escala = 1) {
  const c = Math.cos(giro) * escala;
  const s = Math.sin(giro) * escala;
  saida[0] = c; saida[1] = 0; saida[2] = s; saida[3] = 0;
  saida[4] = 0; saida[5] = escala; saida[6] = 0; saida[7] = 0;
  saida[8] = -s; saida[9] = 0; saida[10] = c; saida[11] = 0;
  saida[12] = x; saida[13] = y; saida[14] = z; saida[15] = 1;
  return saida;
}

// Junta: gira em torno de um pivo, primeiro no eixo Z (balanco lateral) e
// depois no X (balanco para a frente). E o bastante para perna, braco e
// cabeca; nenhum bicho do sertao precisa de mais que isso.
export function articular(saida, px, py, pz, anguloX, anguloZ) {
  const cx = Math.cos(anguloX);
  const sx = Math.sin(anguloX);
  const cz = Math.cos(anguloZ);
  const sz = Math.sin(anguloZ);
  // R = Rz * Rx, em coluna primeiro
  const m00 = cz; const m01 = sz; const m02 = 0;
  const m10 = -sz * cx; const m11 = cz * cx; const m12 = sx;
  const m20 = sz * sx; const m21 = -cz * sx; const m22 = cx;
  saida[0] = m00; saida[1] = m01; saida[2] = m02; saida[3] = 0;
  saida[4] = m10; saida[5] = m11; saida[6] = m12; saida[7] = 0;
  saida[8] = m20; saida[9] = m21; saida[10] = m22; saida[11] = 0;
  saida[12] = px - (m00 * px + m10 * py + m20 * pz);
  saida[13] = py - (m01 * px + m11 * py + m21 * pz);
  saida[14] = pz - (m02 * px + m12 * py + m22 * pz);
  saida[15] = 1;
  return saida;
}

// Estica em Y em torno de uma altura fixa. E o que faz o cantil no cinto
// baixar conforme a agua acaba, sem precisar de outro modelo.
export function esticar(saida, base, fator) {
  identidade(saida);
  saida[5] = fator;
  saida[13] = base * (1 - fator);
  return saida;
}

export function inverter(saida, m) {
  const [
    a00, a01, a02, a03, a10, a11, a12, a13,
    a20, a21, a22, a23, a30, a31, a32, a33,
  ] = m;
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return identidade(saida);
  det = 1 / det;
  saida[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  saida[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  saida[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  saida[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  saida[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  saida[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  saida[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  saida[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  saida[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  saida[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  saida[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  saida[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  saida[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  saida[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  saida[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  saida[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return saida;
}

// Projeta um ponto do mundo na tela. Devolve null quando o ponto esta atras da
// camera — e disso que depende o numero de dano nao aparecer nas costas.
export function projetar(vp, x, y, z, largura, altura) {
  const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
  const cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
  const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  if (cw <= 0.001) return null;
  return {
    x: (cx / cw * 0.5 + 0.5) * largura,
    y: (0.5 - cy / cw * 0.5) * altura,
    profundidade: cw,
  };
}

export function normalizar(v) {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  v[0] /= n; v[1] /= n; v[2] /= n;
  return v;
}
