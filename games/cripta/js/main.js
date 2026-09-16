// Amarra tudo. Puzzle por turnos nao precisa de laco de fisica: o estado so
// muda quando alguem aperta uma tecla. O laco aqui existe so para animar
// poeira, lampiao e particulas.

import { SALAS } from './nivel.js';
import { Cripta } from './estado.js';
import { Desenho, Particulas, TILE } from './desenho.js';
import { Som } from './som.js';

const tela = document.getElementById('tela');
const ctx = tela.getContext('2d');
ctx.imageSmoothingEnabled = false;

const elSala = document.getElementById('hud-sala');
const elPlacas = document.getElementById('hud-placas');
const elJogadas = document.getElementById('hud-jogadas');
const elDica = document.getElementById('dica');
const elMenu = document.getElementById('menu');
const elFim = document.getElementById('fim');
const elResumo = document.getElementById('fim-resumo');
const elToque = document.getElementById('toque');

const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const noToque = window.matchMedia('(pointer: coarse)').matches;

const som = new Som();
const desenho = new Desenho(ctx);
const particulas = new Particulas();

const jogo = {
  estado: 'menu',   // menu | jogando | fim
  indice: 0,
  cripta: null,
  jogadasTotais: 0,
  desfeitos: 0,
  espera: 0,
};

let segurandoSubir = false;

// ---------------------------------------------------------------- escala
function redimensionar() {
  const margem = 24;
  let escala = Math.min((window.innerWidth - margem) / tela.width,
                        (window.innerHeight - margem) / tela.height);
  escala = escala >= 1 ? Math.floor(escala) : Math.max(escala, 0.2);
  tela.style.width = `${Math.round(tela.width * escala)}px`;
  tela.style.height = `${Math.round(tela.height * escala)}px`;
}
window.addEventListener('resize', redimensionar);
redimensionar();

// ---------------------------------------------------------------- salas
function carregar(i) {
  jogo.indice = i;
  jogo.cripta = new Cripta(SALAS[i]);
  particulas.limpar();
  mostrarDica(jogo.cripta.dica);
  atualizarHud();
}

let dicaTimer = 0;
function mostrarDica(texto) {
  if (!texto) { elDica.classList.remove('mostra'); return; }
  elDica.textContent = texto;
  elDica.classList.add('mostra');
  dicaTimer = 340;
}

function atualizarHud() {
  const c = jogo.cripta;
  elSala.textContent = `SALA ${jogo.indice + 1}/${SALAS.length} · ${c.nome}`;
  elPlacas.textContent = c.placas.length ? `${c.placasOcupadas}/${c.placas.length} placas` : '';
  elJogadas.textContent = String(c.jogadas);
}

function avancar() {
  jogo.jogadasTotais += jogo.cripta.jogadas;
  if (jogo.indice + 1 >= SALAS.length) {
    jogo.estado = 'fim';
    elResumo.textContent =
      `${SALAS.length} salas · ${jogo.jogadasTotais} jogadas · ${jogo.desfeitos} desfeitos`;
    elFim.classList.remove('oculto');
    return;
  }
  carregar(jogo.indice + 1);
}

// ---------------------------------------------------------------- jogada
function jogar(dir) {
  if (jogo.estado !== 'jogando' || jogo.espera > 0) return;
  const c = jogo.cripta;
  const antesPlacas = c.placasOcupadas;
  const r = c.mover(dir, segurandoSubir);
  if (r === null) { som.bloqueado(); return; }

  const j = c.jogador;
  if (r === 'empurrou') som.empurrar();
  else if (r === 'subiu') som.subir();
  else if (r === 'caiu') { som.cair(); particulas.criar(j.x * TILE + 12, j.y * TILE + 22, 8, '#c9a875'); }
  else som.passo();

  if (c.placasOcupadas > antesPlacas) {
    som.encaixar();
    const p = c.placas.find(p => c.caixaEm(p.x, p.y));
    if (p) particulas.criar(p.x * TILE + 12, p.y * TILE + 12, 16, '#7ee8d0', 2.2, 30);
  }

  atualizarHud();

  if (c.venceu) {
    som.vencer();
    particulas.criar(c.saida.x * TILE + 12, c.saida.y * TILE + 12, 24, '#7ee8d0', 2.4, 36);
    jogo.espera = 40;
  }
}

function desfazer() {
  if (jogo.estado !== 'jogando' || jogo.espera > 0) return;
  if (jogo.cripta.desfazer()) {
    jogo.desfeitos++;
    som.desfazer();
    atualizarHud();
  }
}

function reiniciarSala() {
  if (jogo.estado !== 'jogando') return;
  jogo.cripta.reiniciar();
  particulas.limpar();
  som.desfazer();
  atualizarHud();
}

// ---------------------------------------------------------------- teclado
const TECLAS = {
  ArrowLeft: 'esquerda', KeyA: 'esquerda',
  ArrowRight: 'direita', KeyD: 'direita',
  ArrowUp: 'subir', KeyW: 'subir',
  KeyZ: 'desfazer', KeyU: 'desfazer',
  KeyR: 'recomecar',
};

window.addEventListener('keydown', e => {
  const acao = TECLAS[e.code];
  if (acao) e.preventDefault();
  if (jogo.estado === 'menu') {
    if (e.code === 'Space' || e.code === 'Enter') comecar();
    return;
  }
  if (acao === 'subir') { segurandoSubir = true; return; }
  if (acao === 'esquerda') jogar(-1);
  else if (acao === 'direita') jogar(1);
  else if (acao === 'desfazer') desfazer();
  else if (acao === 'recomecar') reiniciarSala();
}, { passive: false });

window.addEventListener('keyup', e => {
  if (TECLAS[e.code] === 'subir') segurandoSubir = false;
});
window.addEventListener('blur', () => { segurandoSubir = false; });

// ---------------------------------------------------------------- toque
if (noToque) {
  elToque.classList.remove('oculto');
  elToque.querySelectorAll('[data-tecla]').forEach(botao => {
    const acao = botao.dataset.tecla;
    botao.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (acao === 'subir') { segurandoSubir = !segurandoSubir; botao.classList.toggle('ligado', segurandoSubir); return; }
      if (acao === 'esquerda') jogar(-1);
      else if (acao === 'direita') jogar(1);
      else if (acao === 'desfazer') desfazer();
    });
  });
}

// ---------------------------------------------------------------- laco
function quadro() {
  requestAnimationFrame(quadro);
  if (dicaTimer > 0 && --dicaTimer === 0) elDica.classList.remove('mostra');
  if (jogo.espera > 0 && --jogo.espera === 0) avancar();
  desenho.passo(reduzido);
  particulas.passo();
  if (jogo.cripta) {
    desenho.quadro(jogo.cripta, reduzido);
    particulas.desenhar(ctx);
  }
}

// ---------------------------------------------------------------- telas
function comecar() {
  som.acordar();
  jogo.estado = 'jogando';
  jogo.jogadasTotais = 0;
  jogo.desfeitos = 0;
  jogo.espera = 0;
  elMenu.classList.add('oculto');
  elFim.classList.add('oculto');
  carregar(0);
}

document.getElementById('comecar').addEventListener('click', comecar);
document.getElementById('denovo').addEventListener('click', comecar);

// ---------------------------------------------------------------- teste
window.__teste = () => {
  const c = jogo.cripta;
  return {
    estado: jogo.estado,
    sala: jogo.indice,
    nomeSala: c ? c.nome : null,
    totalSalas: SALAS.length,
    jogadas: c ? c.jogadas : 0,
    desfeitos: jogo.desfeitos,
    placas: c ? c.placasOcupadas : 0,
    totalPlacas: c ? c.placas.length : 0,
    jogador: c ? { ...c.jogador } : null,
    caixas: c ? c.caixas.map(b => ({ ...b })) : [],
    saidaAberta: c ? c.saidaAberta : false,
    venceu: c ? c.venceu : false,
    historico: c ? c.historico.length : 0,
  };
};
window.__comecar = comecar;
window.__irParaSala = i => { comecar(); carregar(i); };
window.__jogar = (dir, subir) => { segurandoSubir = !!subir; jogar(dir); segurandoSubir = false; };
window.__salas = SALAS;

requestAnimationFrame(quadro);
