// Física da bola e do rotor da roleta, sem DOM.
//
// O número já saiu do gerador verificável antes de a bola ser lançada. A
// física não escolhe nada: ela é simulada de verdade, com a bola correndo no
// trilho, perdendo velocidade, caindo pelo cone, batendo nos defletores e
// pulando os trastes até parar numa casa. O que se ajusta é só a fase inicial
// do rotor, em múltiplos exatos de uma casa: como os trastes se repetem a
// cada 1/37 de volta, girar o rotor de k casas antes do lançamento deixa a
// trajetória da bola idêntica e troca apenas o número que está embaixo dela.
// Assim a casa de chegada é, por construção física, a do resultado, e as
// provas conferem isso para os 37 números.

import { ORDEM_RODA, POSICAO_NA_RODA } from './regras.js';

export const PASSO = 2 * Math.PI / 37;
export const RAIO = { trilho: 0.955, defletor: 0.80, bolso: 0.605 };
export const DEFLETORES = Array.from({ length: 8 }, (_, k) => k * Math.PI / 4 + Math.PI / 8);
const LARGURA_DEFLETOR = 0.11;
const DT = 1 / 240;
const QUADROS_POR_S = 60;

function semeado(s) {
  let a = s >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mod = (x, m) => ((x % m) + m) % m;

// Simula um giro inteiro com o rotor começando na fase zero. Devolve a
// trajetória amostrada a 60 quadros por segundo e a casa em que a bola parou.
function simularBruto(semente) {
  const r = semeado(semente);
  const sentidoBola = -1;                 // bola no sentido horário da tela
  let wr = (1.7 + r() * 0.8);             // rotor anti-horário, rad/s
  let tr = 0;                             // ângulo do rotor
  let phi = r() * Math.PI * 2;            // ângulo da bola (mundo)
  let w = sentidoBola * (16.5 + r() * 3); // rad/s
  let rho = RAIO.trilho, vr = 0;
  let h = 0, vh = 0;
  let fase = 'trilho';
  let L = 0;
  let omega = 0;                          // velocidade relativa ao rotor, na fase dos bolsos
  let assentando = 0, psiAlvo = 0;
  const eventos = [];
  const quadros = [];
  let t = 0, prox = 0;
  const limite = 30;

  while (t < limite) {
    // rotor: atrito de mancal
    wr -= 0.018 * wr * DT;
    tr += wr * DT;

    if (fase === 'trilho') {
      const s = Math.sign(w);
      w -= s * (0.62 + 0.0115 * w * w) * DT;
      phi += w * DT;
      if (Math.abs(w) < 6.3) {
        fase = 'cone';
        L = rho * rho * w;
        eventos.push({ t, tipo: 'cai' });
      }
    } else if (fase === 'cone') {
      L *= 1 - 0.32 * DT;
      w = L / (rho * rho);
      const ar = 0.1 * rho * w * w - 4.2;
      vr += ar * DT;
      vr *= 1 - 0.6 * DT;
      const antes = rho;
      rho += vr * DT;
      phi += w * DT;
      if (antes > RAIO.defletor && rho <= RAIO.defletor) {
        const a = mod(phi, Math.PI * 2);
        for (const d of DEFLETORES) {
          if (Math.abs(mod(a - d + Math.PI, Math.PI * 2) - Math.PI) < LARGURA_DEFLETOR) {
            vr = Math.abs(vr) * (0.35 + r() * 0.3);
            rho = RAIO.defletor + 0.004;
            L *= 0.72 + r() * 0.16;
            vh = 0.9 + r() * 0.8;
            eventos.push({ t, tipo: 'defletor', forca: Math.min(1, Math.abs(w) / 12) });
            break;
          }
        }
      }
      if (rho > RAIO.trilho) { rho = RAIO.trilho; vr = -Math.abs(vr) * 0.3; }
      if (rho <= RAIO.bolso) {
        rho = RAIO.bolso;
        fase = 'bolsos';
        omega = w - wr;
        vh = Math.max(vh, 0.6 + Math.min(1.2, Math.abs(omega) * 0.06));
        eventos.push({ t, tipo: 'bolsos' });
      }
    } else if (fase === 'bolsos') {
      const psiAntes = phi - tr;
      if (assentando > 0) {
        // desliza até o meio da casa e passa a girar com o rotor
        const psi = psiAntes;
        const novo = psi + (psiAlvo - psi) * Math.min(1, DT * 9);
        phi = novo + tr;
        w = wr;
        assentando -= DT;
        if (assentando <= 0) { phi = psiAlvo + tr; fase = 'parada'; eventos.push({ t, tipo: 'assenta' }); }
      } else {
        const s = Math.sign(omega);
        omega -= (s * 1.1 + 0.55 * omega) * DT;
        const psiDepois = psiAntes + omega * DT;
        const kA = Math.floor(psiAntes / PASSO), kD = Math.floor(psiDepois / PASSO);
        let psi = psiDepois;
        if (kA !== kD && h <= 0.002) {
          if (Math.abs(omega) > 2.6) {
            omega *= 0.74 + r() * 0.12;
            vh = 0.35 + Math.min(1.1, Math.abs(omega) * 0.07) * (0.6 + r() * 0.4);
            eventos.push({ t, tipo: 'traste', forca: Math.min(1, Math.abs(omega) / 10) });
          } else {
            // bateu no traste e voltou para dentro da casa em que estava
            const subia = omega > 0;
            omega = -omega * (0.35 + r() * 0.2);
            psi = subia ? (kA + 1) * PASSO - 1e-4 : kA * PASSO + 1e-4;
            eventos.push({ t, tipo: 'traste', forca: 0.25 });
          }
        }
        phi = psi + tr;
        w = omega + wr;
        if (Math.abs(omega) < 0.16 && h <= 0.002) {
          const k = Math.floor(psi / PASSO);
          psiAlvo = (k + 0.5) * PASSO;
          assentando = 0.35;
        }
      }
    } else {
      phi = psiAlvo + tr;
      w = wr;
    }

    // pulo: gravidade simples na altura da bola
    if (vh !== 0 || h > 0) {
      vh -= 9.5 * DT;
      h += vh * DT;
      if (h <= 0) {
        if (vh < -0.5) eventos.push({ t, tipo: 'quique', forca: Math.min(1, -vh / 3) });
        h = 0; vh = vh < -0.9 ? -vh * 0.3 : 0;
      }
    }

    t += DT;
    if (t >= prox) {
      quadros.push(t, phi, rho, h, tr);
      prox += 1 / QUADROS_POR_S;
    }
    if (fase === 'parada' && t > (eventos.at(-1)?.t ?? 0) + 1.2) break;
  }

  const psiFinal = mod(phi - tr, Math.PI * 2);
  const bolso = Math.floor(psiFinal / PASSO) % 37;
  return { quadros: Float64Array.from(quadros), eventos, bolso, duracao: t, parou: fase === 'parada' };
}

// O giro resolvido: a mesma trajetória, com o rotor começando k casas
// adiante para que a bola pare no número sorteado.
export function simularGiro(numero, semente = 1) {
  const bruto = simularBruto(semente);
  const alvo = POSICAO_NA_RODA[numero];
  const k = mod(alvo - bruto.bolso, 37);
  const fase0 = -k * PASSO;
  const q = bruto.quadros;
  for (let i = 4; i < q.length; i += 5) q[i] += fase0;
  const psi = mod(q[q.length - 4] - q[q.length - 1], Math.PI * 2);
  const bolsoFinal = Math.floor(psi / PASSO) % 37;
  return {
    numero,
    quadros: q,
    eventos: bruto.eventos,
    duracao: bruto.duracao,
    parou: bruto.parou,
    fase0,
    casasDeAjuste: k,
    bolso: bolsoFinal,
    numeroDaCasa: ORDEM_RODA[bolsoFinal],
  };
}

// Amostra interpolada da trajetória no instante t.
export function amostra(giro, t) {
  const q = giro.quadros;
  const n = q.length / 5;
  const i = Math.min(n - 2, Math.max(0, Math.floor(t * QUADROS_POR_S)));
  const a = i * 5, b = a + 5;
  const u = Math.max(0, Math.min(1, (t - q[a]) / Math.max(1e-6, q[b] - q[a])));
  const lerpAng = (x, y) => x + (y - x) * u;
  return {
    phi: lerpAng(q[a + 1], q[b + 1]),
    rho: q[a + 2] + (q[b + 2] - q[a + 2]) * u,
    h: q[a + 3] + (q[b + 3] - q[a + 3]) * u,
    rotor: lerpAng(q[a + 4], q[b + 4]),
    fim: t >= q[q.length - 5],
  };
}
