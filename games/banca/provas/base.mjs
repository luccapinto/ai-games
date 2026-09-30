// O mínimo para as provas: registrar, conferir, relatar. Sem biblioteca.

export const placar = { feitas: 0, falhas: [], linhas: [], blocos: [] };

let blocoAtual = null;

export function bloco(titulo) {
  blocoAtual = { titulo, inicio: performance.now(), feitas: 0, falhas: 0 };
  placar.blocos.push(blocoAtual);
  process.stdout.write(`\n${titulo.padEnd(34)} `);
}

// Uma prova síncrona conta na hora; uma assíncrona devolve a promessa, e quem
// chama espera (await prova(...)) antes de abrir o próximo bloco.
export function prova(nome, fn) {
  const dono = blocoAtual;
  const passou = () => {
    placar.feitas++;
    if (dono) { dono.feitas++; dono.fim = performance.now(); }
    process.stdout.write('.');
  };
  const falhou = erro => {
    placar.falhas.push({ nome, erro, bloco: dono?.titulo });
    if (dono) { dono.falhas++; dono.fim = performance.now(); }
    process.stdout.write('X');
  };
  let r;
  try { r = fn(); } catch (erro) { falhou(erro); return; }
  if (r && typeof r.then === 'function') return r.then(passou, falhou);
  passou();
}

export function relatar(linha) {
  placar.linhas.push(linha);
}

export const ok = (c, m) => { if (!c) throw new Error(m); };

export function igual(a, b, m) {
  if (a !== b) throw new Error(`${m}: esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);
}

export function perto(a, b, tol, m) {
  if (!(Math.abs(a - b) <= tol)) throw new Error(`${m}: ${a} longe de ${b} (tolerância ${tol})`);
}

export function entre(v, min, max, m) {
  if (!(v >= min && v <= max)) throw new Error(`${m}: ${Number(v).toFixed(6)} fora de [${min}, ${max}]`);
}

export function lanca(fn, m) {
  let lancou = false;
  try { fn(); } catch { lancou = true; }
  if (!lancou) throw new Error(m);
}

// Qui-quadrado com contagens esperadas iguais; devolve a estatística.
export function quiQuadrado(contagens) {
  const n = contagens.reduce((a, b) => a + b, 0);
  const e = n / contagens.length;
  let s = 0;
  for (const c of contagens) s += (c - e) * (c - e) / e;
  return s;
}

// Limite superior aproximado do qui-quadrado a 99,9% (Wilson-Hilferty).
export function limiteQui(gl, z = 3.09) {
  const a = 2 / (9 * gl);
  return gl * Math.pow(1 - a + z * Math.sqrt(a), 3);
}

// Gerador rápido e com semente para simulações (sfc32). Não é o gerador
// verificável: serve para as provas rodarem milhões de mãos em segundos.
export function geradorRapido(semente = 1) {
  let a = 0x9e3779b9 ^ semente, b = 0x243f6a88, c = 0xb7e15162 ^ (semente * 7919), d = 1;
  function u32() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ (b >>> 9);
    b = c + (c << 3) | 0;
    c = (c << 21) | (c >>> 11);
    c = c + t | 0;
    return t >>> 0;
  }
  for (let i = 0; i < 20; i++) u32();
  return {
    u32,
    real: () => u32() / 4294967296,
    inteiro: n => Math.floor(u32() / 4294967296 * n),
    embaralhar(lista) {
      for (let i = lista.length - 1; i > 0; i--) {
        const j = Math.floor(u32() / 4294967296 * (i + 1));
        const t = lista[i]; lista[i] = lista[j]; lista[j] = t;
      }
      return lista;
    },
  };
}

// Fonte de bytes determinística para criar casas reproduzíveis nas provas.
export function fonteDeterministica(semente = 7) {
  const g = geradorRapido(semente);
  return n => {
    const b = new Uint8Array(n);
    for (let i = 0; i < n; i++) b[i] = g.u32() & 255;
    return b;
  };
}
