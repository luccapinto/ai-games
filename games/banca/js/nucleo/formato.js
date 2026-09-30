// Números em português: ponto no milhar, vírgula no decimal. Sem Intl, para
// sair igual em qualquer navegador e no Node sem ICU completo.

function milhar(inteiro) {
  return String(inteiro).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function numero(x, casas = 0) {
  if (!Number.isFinite(x)) return '–';
  const neg = x < 0 || Object.is(x, -0);
  const f = Math.abs(x).toFixed(casas);
  const [i, d] = f.split('.');
  const s = milhar(i) + (d ? ',' + d : '');
  return neg && Number(f) !== 0 ? '−' + s : s;
}

// Centavos de ficha para texto. Ficha inteira sai sem casas.
export function fichas(centavos, { sinal = false, casas = null } = {}) {
  const v = centavos / 100;
  const c = casas ?? (Number.isInteger(Math.round(centavos)) && Math.round(centavos) % 100 === 0 ? 0 : 2);
  const s = numero(v, c);
  return sinal && v > 0 ? '+' + s : s;
}

// Perda esperada tem centavo fracionário: 10 fichas x 2,70% = 0,27027.
export function fichasFrac(centavos, casas = 2) {
  return numero(centavos / 100, casas);
}

export function pct(x, casas = 2) {
  return numero(x * 100, casas) + '%';
}

// Probabilidade legível: "1 em 37" quando cabe, senão percentual.
export function chance(p) {
  if (p <= 0) return 'impossível';
  if (p >= 1) return 'certa';
  const inv = 1 / p;
  if (p < 0.5 && Math.abs(inv - Math.round(inv)) < 1e-9) return `1 em ${numero(Math.round(inv))}`;
  return pct(p, p < 0.001 ? 4 : 2);
}

export function sigma(z) {
  const s = numero(z, 2);
  return (z > 0.005 ? '+' : '') + s + ' σ';
}
