// Amarra o jogo ao navegador: cliques no canvas, barra de torres, laço.
//
// O jogo em si (js/jogo.js) nao sabe que o navegador existe. Tudo que passa por
// aqui e entrada e desenho.

import { LARGURA, ALTURA, TILE, TRILHA, TORRES, podePlantar } from './mapa.js';
import { Jogo } from './jogo.js';
import { Desenho, Particulas } from './desenho.js';
import { Som } from './som.js';

const tela = document.getElementById('tela');
const ctx = tela.getContext('2d');
ctx.imageSmoothingEnabled = false;

const elOnda = document.getElementById('hud-onda');
const elSeiva = document.getElementById('hud-seiva');
const elVidas = document.getElementById('hud-vidas');
const elTorres = document.getElementById('torres');
const elDescricao = document.getElementById('descricao');
const elBotaoOnda = document.getElementById('onda');
const elVelocidade = document.getElementById('velocidade');
const elMenu = document.getElementById('menu');
const elFim = document.getElementById('fim');
const elFimTitulo = document.getElementById('fim-titulo');
const elResumo = document.getElementById('fim-resumo');

const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const jogo = new Jogo();
const desenho = new Desenho(ctx);
const particulas = new Particulas();
const som = new Som();

let rodando = false;
let tipoEscolhido = null;
let selecionada = null;
let hover = null;
let velocidade = 1;

// ---------------------------------------------------------------- barra
function montarBarra() {
  elTorres.innerHTML = '';
  for (const [tipo, m] of Object.entries(TORRES)) {
    const b = document.createElement('button');
    b.className = 'torre';
    b.dataset.tipo = tipo;
    b.innerHTML = `<span>${m.nome}</span><span class="custo">0</span>`;
    b.addEventListener('click', () => escolher(tipo));
    b.addEventListener('mouseenter', () => { elDescricao.textContent = m.descricao; });
    b.addEventListener('mouseleave', () => { elDescricao.textContent = ''; });
    elTorres.appendChild(b);
  }
}

function escolher(tipo) {
  tipoEscolhido = tipoEscolhido === tipo ? null : tipo;
  selecionada = null;
  elDescricao.textContent = tipoEscolhido ? TORRES[tipoEscolhido].descricao : '';
  atualizarBarra();
}

function atualizarBarra() {
  for (const b of elTorres.children) {
    const tipo = b.dataset.tipo;
    const custo = jogo.custoDe(tipo);
    b.querySelector('.custo').textContent = custo;
    b.classList.toggle('ligada', tipoEscolhido === tipo);
    b.classList.toggle('cara', jogo.seiva < custo);
  }
}

function atualizarHud() {
  elOnda.textContent = `ONDA ${jogo.onda}/10`;
  elSeiva.textContent = jogo.seiva;
  elVidas.textContent = jogo.vidas;
  elBotaoOnda.disabled = !jogo.temProximaOnda;
  elBotaoOnda.textContent = jogo.emOnda ? 'ONDA EM CURSO' : 'MANDAR ONDA';
  atualizarBarra();
}

// ---------------------------------------------------------------- canvas
function celulaDe(e) {
  const r = tela.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / r.width * LARGURA);
  const y = Math.floor((e.clientY - r.top) / r.height * ALTURA);
  if (x < 0 || x >= LARGURA || y < 0 || y >= ALTURA) return null;
  return { x, y };
}

tela.addEventListener('mousemove', e => { hover = celulaDe(e); });
tela.addEventListener('mouseleave', () => { hover = null; });

tela.addEventListener('click', e => {
  const c = celulaDe(e);
  if (!c || !rodando) return;
  const existente = jogo.torreEm(c.x, c.y);

  if (tipoEscolhido && !existente) {
    if (jogo.plantar(c.x, c.y, tipoEscolhido)) {
      som.plantar();
      particulas.criar(c.x, c.y, 10, TORRES[tipoEscolhido].cor, 1.6, 22);
      // Mantem o tipo escolhido: quem esta montando defesa planta varias
      // seguidas, e ter que reclicar na barra a cada torre cansa.
      atualizarHud();
    } else {
      som.negado();
    }
    return;
  }
  if (existente) {
    selecionada = selecionada && selecionada.x === c.x && selecionada.y === c.y ? null : existente;
    tipoEscolhido = null;
    elDescricao.textContent = selecionada
      ? `${TORRES[selecionada.tipo].nome} nível ${selecionada.nivel}` +
        (selecionada.nivel < 2 ? ` · M para melhorar (${TORRES[selecionada.tipo].melhoria.custo})` : '') +
        ' · V para vender'
      : '';
    atualizarBarra();
  }
});

// ---------------------------------------------------------------- teclado
window.addEventListener('keydown', e => {
  if (!rodando) {
    if (e.code === 'Space' || e.code === 'Enter') { comecar(); e.preventDefault(); }
    return;
  }
  const atalhos = { Digit1: 'espinho', Digit2: 'esporo', Digit3: 'resina', Digit4: 'ferrao' };
  if (atalhos[e.code]) { escolher(atalhos[e.code]); return; }
  if (e.code === 'Space') {
    e.preventDefault();
    if (jogo.temProximaOnda) { jogo.comecarOnda(); atualizarHud(); }
    return;
  }
  if (e.code === 'KeyM' && selecionada) {
    if (jogo.melhorar(selecionada.x, selecionada.y)) { som.melhorar(); atualizarHud(); }
    else som.negado();
  }
  if (e.code === 'KeyV' && selecionada) {
    jogo.vender(selecionada.x, selecionada.y);
    selecionada = null;
    som.negado();
    atualizarHud();
  }
  if (e.code === 'Escape') { tipoEscolhido = null; selecionada = null; atualizarBarra(); }
});

elBotaoOnda.addEventListener('click', () => {
  if (jogo.comecarOnda()) { som.onda(); atualizarHud(); }
});
elVelocidade.addEventListener('click', () => {
  velocidade = velocidade === 1 ? 2 : velocidade === 2 ? 3 : 1;
  elVelocidade.textContent = `${velocidade}×`;
});

// ---------------------------------------------------------------- eventos
function tratarEventos() {
  for (const ev of jogo.consumirEventos()) {
    if (ev.tipo === 'morreu') { som.morreu(); particulas.criar(ev.x, ev.y, 9, ev.cor, 2, 22); }
    else if (ev.tipo === 'vazou') { som.vazou(); }
    else if (ev.tipo === 'ondaLimpa') { som.ondaLimpa(); }
    else if (ev.tipo === 'tiro') som.tiro(ev.torre);
    else if (ev.tipo === 'area') particulas.criar(ev.x, ev.y, 7, '#8fd98a', 1.6, 18);
  }
}

// ---------------------------------------------------------------- laco
function quadro() {
  requestAnimationFrame(quadro);
  if (rodando && !jogo.fim) {
    for (let i = 0; i < velocidade; i++) jogo.passo();
    tratarEventos();
    atualizarHud();
    if (jogo.fim) terminar();
  }
  desenho.passo();
  particulas.passo();
  desenho.quadro(jogo, { hover, tipoEscolhido, selecionada, reduzido });
  particulas.desenhar(ctx);
}

function terminar() {
  rodando = false;
  const venceu = jogo.fim === 'vitoria';
  elFimTitulo.textContent = venceu ? 'O TRONCO AGUENTOU' : 'A ÁRVORE CAIU';
  elFimTitulo.classList.toggle('ruim', !venceu);
  elResumo.textContent = venceu
    ? `${jogo.onda} ondas · ${jogo.mortas} pragas · ${jogo.vidas}/12 de coração · ${jogo.torres.length} torres`
    : `Caiu na onda ${jogo.onda + 1}, com ${jogo.torres.length} torres plantadas e ${jogo.mortas} pragas mortas.`;
  elFim.classList.remove('oculto');
  som.fim(venceu);
}

function comecar() {
  som.acordar();
  jogo.reiniciar();
  particulas.limpar();
  tipoEscolhido = null;
  selecionada = null;
  velocidade = 1;
  elVelocidade.textContent = '1×';
  rodando = true;
  elMenu.classList.add('oculto');
  elFim.classList.add('oculto');
  atualizarHud();
}

document.getElementById('comecar').addEventListener('click', comecar);
document.getElementById('denovo').addEventListener('click', comecar);

montarBarra();
atualizarHud();

// ---------------------------------------------------------------- teste
window.__teste = () => ({
  rodando,
  onda: jogo.onda,
  emOnda: jogo.emOnda,
  seiva: jogo.seiva,
  vidas: jogo.vidas,
  torres: jogo.torres.map(t => ({ x: t.x, y: t.y, tipo: t.tipo, nivel: t.nivel })),
  pragas: jogo.pragas.length,
  mortas: jogo.mortas,
  vazou: jogo.vazou,
  fim: jogo.fim,
  tipoEscolhido,
  custos: Object.fromEntries(Object.keys(TORRES).map(t => [t, jogo.custoDe(t)])),
});
window.__comecar = comecar;
window.__plantar = (x, y, tipo) => jogo.plantar(x, y, tipo);
window.__mandarOnda = () => jogo.comecarOnda();
window.__velocidade = v => { velocidade = v; };
window.__podePlantar = podePlantar;
window.__melhorar = (x, y) => jogo.melhorar(x, y);
window.__mapa = { TRILHA, TORRES, LARGURA, ALTURA };

requestAnimationFrame(quadro);
