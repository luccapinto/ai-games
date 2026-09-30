// Física dos dados do craps, sem DOM.
//
// Dois cubos de verdade: gravidade, oito cantos batendo no feltro e nas
// paredes, atrito, choque entre os dois, e o giro amortecendo até pararem.
// O resultado já saiu do gerador verificável; a física não escolhe nada.
// O que se ajusta é só a numeração das faces: um cubo é idêntico a si mesmo
// girado por qualquer simetria dele, então trocar qual face tem qual número
// (compondo a orientação com uma dessas 24 rotações) deixa a trajetória
// exatamente igual e faz a face de cima, onde o dado parou de verdade,
// ser a sorteada. As provas conferem as 36 combinações.

export const MESA = { x0: 0, x1: 26, y0: 0, y1: 11 };
const H = 0.5;                 // meia aresta
const G = 60;                  // gravidade em arestas/s²
const DT = 1 / 300;
const RESTITUICAO = 0.36, ATRITO = 0.5;
const INV_I = 6;               // inverso do momento de inércia do cubo (m = 1, aresta = 1)

// Faces no referencial do dado. Opostas somam 7.
export const FACES = [
  { n: 1, eixo: [0, 0, 1] }, { n: 6, eixo: [0, 0, -1] },
  { n: 2, eixo: [1, 0, 0] }, { n: 5, eixo: [-1, 0, 0] },
  { n: 3, eixo: [0, 1, 0] }, { n: 4, eixo: [0, -1, 0] },
];
const EIXO_DA_FACE = Object.fromEntries(FACES.map(f => [f.n, f.eixo]));

const CANTOS = [];
for (const x of [-H, H]) for (const y of [-H, H]) for (const z of [-H, H]) CANTOS.push([x, y, z]);

// ---------------------------------------------------------------- quatérnios

export function qmul(a, b) {
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
}
export function qrot(q, v) {
  const [w, x, y, z] = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}
function qnorm(q) { const l = Math.hypot(...q); return q.map(c => c / l); }
function qeixo(eixo, ang) { const s = Math.sin(ang / 2); return [Math.cos(ang / 2), eixo[0] * s, eixo[1] * s, eixo[2] * s]; }
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// A face de cima: o eixo do dado mais alinhado com +z do mundo.
export function faceDeCima(q) {
  let melhor = null, mz = -Infinity;
  for (const f of FACES) {
    const z = qrot(q, f.eixo)[2];
    if (z > mz) { mz = z; melhor = f.n; }
  }
  return melhor;
}

// Rotação de simetria do cubo que leva o eixo a ao eixo b (os dois de face).
function simetria(a, b) {
  const d = dot(a, b);
  if (d > 0.5) return [1, 0, 0, 0];
  if (d < -0.5) {
    const perp = Math.abs(a[0]) < 0.5 ? [1, 0, 0] : [0, 1, 0];
    return qeixo(perp, Math.PI);
  }
  const c = cross(a, b);
  return qeixo(c, Math.PI / 2);
}

function semeado(s) {
  let a = s >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- simulação

function novoDado(r, i) {
  return {
    p: [MESA.x1 - 1.5 - r() * 1.2, 3.2 + i * 2.6 + r() * 1.2, 3 + r() * 1.5],
    v: [-(34 + r() * 10), (r() - 0.5) * 10, 3 + r() * 6],
    q: qnorm([r() - 0.5, r() - 0.5, r() - 0.5, r() - 0.5]),
    w: [(r() - 0.5) * 50, (r() - 0.5) * 50, (r() - 0.5) * 30],
    parado: 0,
    fixo: false,
  };
}

// Plano: normal n e deslocamento d, o sólido fica em n·x >= d.
const PLANOS = [
  { n: [0, 0, 1], d: 0, piso: true },
  { n: [1, 0, 0], d: MESA.x0, parede: true, piramides: true },
  { n: [-1, 0, 0], d: -MESA.x1, parede: true },
  { n: [0, 1, 0], d: MESA.y0, parede: true },
  { n: [0, -1, 0], d: -MESA.y1, parede: true },
];

function colidirPlano(dado, plano, r, eventos, t) {
  const { n } = plano;
  let bateu = 0;
  for (const c of CANTOS) {
    const rr = qrot(dado.q, c);
    const pos = [dado.p[0] + rr[0], dado.p[1] + rr[1], dado.p[2] + rr[2]];
    const pen = plano.d - dot(n, pos);
    if (pen <= 0) continue;
    const vc = [dado.v[0] + (dado.w[1] * rr[2] - dado.w[2] * rr[1]), dado.v[1] + (dado.w[2] * rr[0] - dado.w[0] * rr[2]), dado.v[2] + (dado.w[0] * rr[1] - dado.w[1] * rr[0])];
    const vn = dot(vc, n);
    // tira do plano
    for (let k = 0; k < 3; k++) dado.p[k] += n[k] * pen * 0.6;
    if (vn >= 0) continue;
    const rxn = cross(rr, n);
    const e = plano.piramides ? RESTITUICAO + 0.25 : RESTITUICAO * (Math.abs(vn) > 2 ? 1 : 0.1);
    const j = -(1 + e) * vn / (1 + INV_I * dot(rxn, rxn));
    const imp = [n[0] * j, n[1] * j, n[2] * j];
    // atrito na direção tangente
    const vt = [vc[0] - vn * n[0], vc[1] - vn * n[1], vc[2] - vn * n[2]];
    const lt = Math.hypot(...vt);
    if (lt > 1e-6) {
      const tdir = vt.map(x => x / lt);
      const rxt = cross(rr, tdir);
      const jt = Math.min(ATRITO * j, lt / (1 + INV_I * dot(rxt, rxt)));
      for (let k = 0; k < 3; k++) imp[k] -= tdir[k] * jt;
    }
    // as pirâmides de borracha da parede do fundo espalham o dado
    if (plano.piramides && Math.abs(vn) > 3) {
      imp[1] += (r() - 0.5) * j * 0.8;
      imp[2] += r() * j * 0.3;
    }
    for (let k = 0; k < 3; k++) dado.v[k] += imp[k];
    const tq = cross(rr, imp);
    for (let k = 0; k < 3; k++) dado.w[k] += INV_I * tq[k];
    bateu = Math.max(bateu, Math.abs(vn));
  }
  if (bateu > 1.8) eventos.push({ t, tipo: plano.piso ? 'mesa' : 'parede', forca: Math.min(1, bateu / 20) });
  return bateu;
}

function colidirDados(a, b, eventos, t) {
  const d = [b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]];
  const dist = Math.hypot(...d);
  const R = 1.08;
  if (dist >= R || dist < 1e-6) return;
  const n = d.map(x => x / dist);
  const pen = R - dist;
  for (let k = 0; k < 3; k++) { a.p[k] -= n[k] * pen / 2; b.p[k] += n[k] * pen / 2; }
  const vr = dot([b.v[0] - a.v[0], b.v[1] - a.v[1], b.v[2] - a.v[2]], n);
  if (vr >= 0) return;
  const j = -(1 + 0.45) * vr / 2;
  for (let k = 0; k < 3; k++) { a.v[k] -= n[k] * j; b.v[k] += n[k] * j; }
  if (!a.fixo) a.parado = 0; if (!b.fixo) b.parado = 0;
  a.fixo = false; b.fixo = false;
  if (Math.abs(vr) > 2) eventos.push({ t, tipo: 'dados', forca: Math.min(1, Math.abs(vr) / 20) });
}

// Alinha um dado quase parado com a face mais próxima virada para cima.
function assentar(dado) {
  const up = faceDeCima(dado.q);
  const eixo = qrot(dado.q, EIXO_DA_FACE[up]);
  const alvo = [0, 0, 1];
  const c = cross(eixo, alvo);
  const s = Math.hypot(...c);
  if (s > 1e-6) {
    const ang = Math.asin(Math.min(1, s));
    dado.q = qnorm(qmul(qeixo(c.map(x => x / s), ang), dado.q));
  }
  dado.p[2] = H;
}

function simularBruto(semente) {
  const r = semeado(semente);
  const dados = [novoDado(r, 0), novoDado(r, 1)];
  const eventos = [];
  const quadros = [];
  let t = 0, prox = 0;
  while (t < 8) {
    for (const d of dados) {
      if (d.fixo) continue;
      d.v[2] -= G * DT;
      for (let k = 0; k < 3; k++) d.p[k] += d.v[k] * DT;
      const wq = [0, d.w[0], d.w[1], d.w[2]];
      const dq = qmul(wq, d.q);
      d.q = qnorm(d.q.map((c, k) => c + 0.5 * dq[k] * DT));
    }
    colidirDados(dados[0], dados[1], eventos, t);
    for (const d of dados) {
      if (d.fixo) continue;
      let contato = false;
      for (const pl of PLANOS) if (colidirPlano(d, pl, r, eventos, t) > 0 && pl.piso) contato = true;
      if (d.p[2] < H + 0.08) contato = true;
      if (contato) {
        const k = 1 - 1.4 * DT;
        for (let i = 0; i < 3; i++) { d.v[i] *= i === 2 ? 1 : k; d.w[i] *= 1 - 2.2 * DT; }
      }
      const lento = Math.hypot(...d.v) < 0.25 && Math.hypot(...d.w) < 0.6 && d.p[2] < H + 0.06;
      d.parado = lento ? d.parado + DT : 0;
      if (d.parado > 0.18) { d.fixo = true; d.v = [0, 0, 0]; d.w = [0, 0, 0]; assentar(d); eventos.push({ t, tipo: 'parou' }); }
    }
    t += DT;
    if (t >= prox) {
      quadros.push(t, ...dados[0].p, ...dados[0].q, ...dados[1].p, ...dados[1].q);
      prox += 1 / 60;
    }
    if (dados[0].fixo && dados[1].fixo) {
      quadros.push(t + 0.001, ...dados[0].p, ...dados[0].q, ...dados[1].p, ...dados[1].q);
      break;
    }
  }
  return { quadros, eventos, parou: dados[0].fixo && dados[1].fixo, faces: [faceDeCima(dados[0].q), faceDeCima(dados[1].q)], duracao: t };
}

export const PASSO_QUADRO = 15; // t + 2 x (3 posição + 4 orientação)

// O lance resolvido: mesma trajetória, faces renumeradas por simetria.
export function simularLance([a, b], semente = 1) {
  const bruto = simularBruto(semente);
  const S = [simetria(EIXO_DA_FACE[a], EIXO_DA_FACE[bruto.faces[0]]), simetria(EIXO_DA_FACE[b], EIXO_DA_FACE[bruto.faces[1]])];
  const q = Float64Array.from(bruto.quadros);
  for (let i = 0; i < q.length; i += PASSO_QUADRO) {
    for (const [off, s] of [[4, S[0]], [11, S[1]]]) {
      const nova = qmul([q[i + off], q[i + off + 1], q[i + off + 2], q[i + off + 3]], s);
      q[i + off] = nova[0]; q[i + off + 1] = nova[1]; q[i + off + 2] = nova[2]; q[i + off + 3] = nova[3];
    }
  }
  const fim = q.length - PASSO_QUADRO;
  const faces = [faceDeCima([q[fim + 4], q[fim + 5], q[fim + 6], q[fim + 7]]), faceDeCima([q[fim + 11], q[fim + 12], q[fim + 13], q[fim + 14]])];
  return { quadros: q, eventos: bruto.eventos, parou: bruto.parou, duracao: bruto.duracao, faces, simetrias: S };
}

// Estado interpolado de um lance no instante t (para desenhar).
export function amostraLance(lance, t) {
  const q = lance.quadros;
  const n = q.length / PASSO_QUADRO;
  let i = Math.min(n - 2, Math.max(0, Math.floor(t * 60)));
  while (i < n - 2 && q[(i + 1) * PASSO_QUADRO] < t) i++;
  const a = i * PASSO_QUADRO, b = a + PASSO_QUADRO;
  const u = Math.max(0, Math.min(1, (t - q[a]) / Math.max(1e-6, q[b] - q[a])));
  const dado = off => {
    const p = [0, 1, 2].map(k => q[a + off + k] + (q[b + off + k] - q[a + off + k]) * u);
    let qb = [q[b + off + 3], q[b + off + 4], q[b + off + 5], q[b + off + 6]];
    const qa = [q[a + off + 3], q[a + off + 4], q[a + off + 5], q[a + off + 6]];
    if (dot4(qa, qb) < 0) qb = qb.map(c => -c);
    return { p, q: qnorm(qa.map((c, k) => c + (qb[k] - c) * u)) };
  };
  return { dados: [dado(1), dado(8)], fim: t >= q[q.length - PASSO_QUADRO] };
}
function dot4(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; }
