// Peças de interface comuns: ícones em SVG, dica de aposta, aviso, painéis.

import { pct, chance, fichasFrac, fichas } from './nucleo/formato.js';

export const ICONES = {
  livro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5C4.7 19 4 19.7 4 20.5z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v15h5.5c.8 0 1.5.7 1.5 1.5z"/><path d="M6.5 8h2.5M6.5 11h2.5M15 8h2.5M15 11h2.5M15 14l1.2-1.6 1.3 1 1-2"/></svg>',
  selo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2.8l2.2 1.6 2.7-.2.9 2.6 2.3 1.4-.8 2.6.8 2.6-2.3 1.4-.9 2.6-2.7-.2L12 21.2l-2.2-1.6-2.7.2-.9-2.6-2.3-1.4.8-2.6-.8-2.6 2.3-1.4.9-2.6 2.7.2z"/><path d="M8.6 12.2l2.3 2.2 4.6-4.8"/></svg>',
  somLigado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  somDesligado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h9"/></svg>',
  voltar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>',
  fechar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  conta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5M4 19h16"/><path d="M6.5 8.5l4 3 3-2 5 5"/><path d="M6.5 9.5l12 6" stroke-dasharray="1.5 2"/></svg>',
  ajuda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8v.5"/><circle cx="12" cy="16.9" r=".4" fill="currentColor"/></svg>',
  desfazer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7L5 11l4 4"/><path d="M5 11h9a5 5 0 0 1 0 10h-2"/></svg>',
  limpar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 7h14M9.5 7V5h5v2M7 7l1 12h8l1-12"/></svg>',
  repetir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 4l3 3-3 3"/><path d="M20 7H9a5 5 0 0 0-5 5M7 20l-3-3 3-3"/><path d="M4 17h11a5 5 0 0 0 5-5"/></svg>',
  dobrar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 12h12M12 6v12"/><circle cx="12" cy="12" r="8.5"/></svg>',
};

export function el(tag, attrs = {}, html = '') {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  if (html) e.innerHTML = html;
  return e;
}

// ---------------------------------------------------------------- aviso

let temporizadorAviso = 0;
export function avisar(texto, { erro = false, ms = 2600 } = {}) {
  const a = document.getElementById('aviso');
  if (!a) return;
  a.textContent = texto;
  a.classList.toggle('erro', erro);
  a.classList.add('visivel');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => a.classList.remove('visivel'), ms);
}

// ---------------------------------------------------------------- dica

let dicaDona = null;
export function mostrarDica(ancora, html) {
  const d = document.getElementById('dica');
  if (!d) return;
  d.innerHTML = html;
  d.classList.add('visivel');
  dicaDona = ancora;
  posicionarDica(ancora);
}

export function posicionarDica(ancora) {
  const d = document.getElementById('dica');
  if (!d) return;
  let x, y;
  if (ancora instanceof Element) {
    const r = ancora.getBoundingClientRect();
    x = r.left + r.width / 2; y = r.top;
  } else ({ x, y } = ancora);
  const w = d.offsetWidth, h = d.offsetHeight;
  let left = x - w / 2, top = y - h - 12;
  if (top < 60) top = y + 28;
  left = Math.max(8, Math.min(innerWidth - w - 8, left));
  top = Math.max(8, Math.min(innerHeight - h - 8, top));
  d.style.left = left + 'px';
  d.style.top = top + 'px';
}

export function esconderDica(ancora) {
  if (ancora && dicaDona !== ancora) return;
  document.getElementById('dica')?.classList.remove('visivel');
  dicaDona = null;
}

// A conta de uma aposta, do jeito que aparece em toda mesa.
// ficha: { nome, paga, chance, vantagem }. valor: centavos da aposta em jogo
// (ou da ficha escolhida, quando ainda não há aposta ali).
export function htmlConta(ficha, valor, { nota = '', rotuloValor = null } = {}) {
  const casa = ficha.vantagem;
  const zero = Math.abs(casa) < 1e-12;
  const perda = valor * casa;
  return `<div class="nome">${ficha.nome}</div>
    <table>
      <tr><td>Paga</td><td>${ficha.paga}</td></tr>
      <tr><td>Chance de ganhar</td><td>${chance(ficha.chance)}</td></tr>
      <tr><td>Vantagem da casa</td><td class="${zero ? 'zero' : 'casa'}">${pct(casa, 2)}</td></tr>
      <tr><td>Perda esperada${rotuloValor ? '' : ` em ${fichas(valor)} ficha${valor === 100 ? '' : 's'}`}</td><td class="${zero ? 'zero' : 'casa'}">${zero ? '0,00' : '−' + fichasFrac(perda, perda < 100 ? 3 : 2)}</td></tr>
    </table>
    ${nota ? `<div class="nota">${nota}</div>` : ''}`;
}

// Liga dica a um elemento: passar o mouse mostra; no toque, um toque longo
// mostra e o primeiro toque curto continua sendo a aposta.
export function ligarDica(alvo, conteudo) {
  let toque = 0;
  alvo.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') mostrarDica(alvo, conteudo()); });
  alvo.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') esconderDica(alvo); });
  alvo.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(toque);
    toque = setTimeout(() => mostrarDica(alvo, conteudo()), 380);
  });
  for (const ev of ['pointerup', 'pointercancel']) alvo.addEventListener(ev, e => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(toque);
    setTimeout(() => esconderDica(alvo), 1800);
  });
}

// ---------------------------------------------------------------- painéis

export function abrirPainel(id, html, { aoFechar } = {}) {
  fecharPainel();
  const c = el('div', { class: 'cortina', id: 'cortina-' + id });
  c.innerHTML = `<div class="painel" role="dialog" aria-modal="true">${html}<button class="icone fechar" aria-label="Fechar">${ICONES.fechar}</button></div>`;
  const fechar = () => { c.remove(); document.removeEventListener('keydown', esc); aoFechar?.(); };
  const esc = e => { if (e.key === 'Escape') fechar(); };
  c.addEventListener('pointerdown', e => { if (e.target === c) fechar(); });
  c.querySelector('.fechar').addEventListener('click', fechar);
  document.addEventListener('keydown', esc);
  c._fechar = fechar;
  document.getElementById('app').append(c);
  return c;
}

export function fecharPainel() {
  for (const c of document.querySelectorAll('.cortina')) c._fechar ? c._fechar() : c.remove();
}
