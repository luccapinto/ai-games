// SHA-256 e HMAC-SHA256 em JavaScript puro (FIPS 180-4 e RFC 2104).
//
// Não usa crypto.subtle de propósito: ele só existe em contexto seguro (https
// ou localhost), e o jogo precisa conferir a própria aleatoriedade também
// aberto de um servidor qualquer da rede local. As provas batem este arquivo
// contra os vetores oficiais do NIST.

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

const W = new Uint32Array(64);
const codificador = new TextEncoder();

export function utf8(texto) {
  return codificador.encode(String(texto));
}

function bloco(h, dados, inicio) {
  for (let i = 0; i < 16; i++) {
    const j = inicio + i * 4;
    W[i] = (dados[j] << 24) | (dados[j + 1] << 16) | (dados[j + 2] << 8) | dados[j + 3];
  }
  for (let i = 16; i < 64; i++) {
    const a = W[i - 15], b = W[i - 2];
    const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
    const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
  }
  let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ (~e & g);
    const t1 = (hh + S1 + ch + K[i] + W[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const t2 = (S0 + maj) | 0;
    hh = g; g = f; f = e; e = (d + t1) | 0;
    d = c; c = b; b = a; a = (t1 + t2) | 0;
  }
  h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
  h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
}

// Devolve os 32 bytes do resumo de uma mensagem (Uint8Array ou texto).
export function sha256(mensagem) {
  const dados = typeof mensagem === 'string' ? utf8(mensagem) : mensagem;
  const n = dados.length;
  // Mensagem + 0x80 + zeros + 8 bytes do comprimento em bits, múltiplo de 64.
  const total = Math.ceil((n + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(dados);
  buf[n] = 0x80;
  const bits = n * 8;
  const alto = Math.floor(bits / 0x100000000);
  const baixo = bits >>> 0;
  buf[total - 8] = alto >>> 24; buf[total - 7] = alto >>> 16; buf[total - 6] = alto >>> 8; buf[total - 5] = alto;
  buf[total - 4] = baixo >>> 24; buf[total - 3] = baixo >>> 16; buf[total - 2] = baixo >>> 8; buf[total - 1] = baixo;
  const h = H0.slice();
  for (let i = 0; i < total; i += 64) bloco(h, buf, i);
  const saida = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    saida[i * 4] = h[i] >>> 24; saida[i * 4 + 1] = h[i] >>> 16; saida[i * 4 + 2] = h[i] >>> 8; saida[i * 4 + 3] = h[i];
  }
  return saida;
}

export function hex(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

export function deHex(texto) {
  const limpo = String(texto).trim().toLowerCase();
  if (!/^([0-9a-f]{2})*$/.test(limpo)) throw new Error('hexadecimal inválido');
  const saida = new Uint8Array(limpo.length / 2);
  for (let i = 0; i < saida.length; i++) saida[i] = parseInt(limpo.slice(i * 2, i * 2 + 2), 16);
  return saida;
}

export function sha256hex(mensagem) {
  return hex(sha256(mensagem));
}

// HMAC com bloco de 64 bytes (RFC 2104). Chave e mensagem: texto ou bytes.
export function hmacSha256(chave, mensagem) {
  let k = typeof chave === 'string' ? utf8(chave) : chave;
  if (k.length > 64) k = sha256(k);
  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    const b = i < k.length ? k[i] : 0;
    ipad[i] = b ^ 0x36;
    opad[i] = b ^ 0x5c;
  }
  const m = typeof mensagem === 'string' ? utf8(mensagem) : mensagem;
  const interno = new Uint8Array(64 + m.length);
  interno.set(ipad);
  interno.set(m, 64);
  const hi = sha256(interno);
  const externo = new Uint8Array(96);
  externo.set(opad);
  externo.set(hi, 64);
  return sha256(externo);
}

export function hmacSha256hex(chave, mensagem) {
  return hex(hmacSha256(chave, mensagem));
}
