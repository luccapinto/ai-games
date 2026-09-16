// Amarra tudo: laco de passo fixo, maquina de estados das telas e o HUD.
//
// O passo logico e fixo em 60 Hz e o desenho acompanha o monitor. Sem isso, a
// fisica muda de sensacao entre um monitor de 60 e um de 144, e uma fase
// calibrada num vira impossivel no outro.

import { Entrada } from './entrada.js';
import { Mundo, TILE, LARGURA, ALTURA } from './mundo.js';
import { Sonda } from './sonda.js';
import { Desenho, Particulas } from './desenho.js';
import { Som } from './som.js';
import { FASES } from './fases.js';

const PASSO = 1000 / 60;

const tela = document.getElementById('tela');
const ctx = tela.getContext('2d');
ctx.imageSmoothingEnabled = false;

const elFase = document.getElementById('hud-fase');
const elFagulhas = document.getElementById('hud-fagulhas');
const elMortes = document.getElementById('hud-mortes');
const elTempo = document.getElementById('hud-tempo');
const elDica = document.getElementById('dica');
const elMenu = document.getElementById('menu');
const elPausa = document.getElementById('pausa');
const elFim = document.getElementById('fim');
const elResumo = document.getElementById('fim-resumo');
const elToque = document.getElementById('toque');

const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const entrada = new Entrada();
const som = new Som();
const desenho = new Desenho(ctx);
const particulas = new Particulas();

const jogo = {
  estado: 'menu',      // menu | jogando | pausado | fim
  indice: 0,
  mundo: null,
  sonda: null,
  mortes: 0,
  quadros: 0,
  fagulhasTotais: 0,
  esperaMorte: 0,
  esperaVitoria: 0,
};

// ---------------------------------------------------------------- escala
// Passo inteiro sempre que couber: pixel de tamanho quebrado e o que faz arte
// de pixel parecer suja.
function redimensionar() {
  const margem = 24;
  const dispX = window.innerWidth - margem;
  const dispY = window.innerHeight - margem;
  let escala = Math.min(dispX / tela.width, dispY / tela.height);
  escala = escala >= 1 ? Math.floor(escala) : escala;
  if (escala < 1) escala = Math.max(escala, 0.2);
  tela.style.width = `${Math.round(tela.width * escala)}px`;
  tela.style.height = `${Math.round(tela.height * escala)}px`;
}
window.addEventListener('resize', redimensionar);
redimensionar();

// Controle de toque so aparece onde faz sentido.
const noToque = window.matchMedia('(pointer: coarse)').matches;
if (noToque) {
  elToque.classList.remove('oculto');
  entrada.ligarToque(elToque);
}

// ---------------------------------------------------------------- fases
function carregar(indice) {
  jogo.indice = indice;
  jogo.mundo = new Mundo(FASES[indice]);
  jogo.sonda = new Sonda(jogo.mundo);
  ligarEventos(jogo.sonda);
  particulas.limpar();
  jogo.esperaMorte = 0;
  jogo.esperaVitoria = 0;
  // Ensinar "segure shift" para quem esta no toque nao ajuda ninguem.
  mostrarDica(noToque && jogo.mundo.dicaToque ? jogo.mundo.dicaToque : jogo.mundo.dica);
  atualizarHud();
}

function ligarEventos(sonda) {
  sonda.aoPular = () => som.pular();
  sonda.aoInvestir = () => {
    som.investir();
    particulas.criar(sonda.x + sonda.w / 2, sonda.y + sonda.h / 2, 9, '#bdf3ff', 2.4, 20);
  };
  sonda.aoPegar = f => {
    som.pegar();
    particulas.criar(f.x, f.y, 14, '#ffcf6b', 2.2, 28);
    atualizarHud();
  };
  sonda.aoMorrer = () => {
    som.morrer();
    desenho.sacudir(7);
    particulas.criar(sonda.x + sonda.w / 2, sonda.y + sonda.h / 2, 26, '#ff5a6a', 3.1, 34);
    jogo.mortes++;
    jogo.esperaMorte = 26;
    atualizarHud();
  };
  sonda.aoVencer = () => {
    som.vencer();
    particulas.criar(sonda.x + sonda.w / 2, sonda.y + sonda.h / 2, 26, '#96ffeb', 2.6, 36);
    jogo.esperaVitoria = 34;
  };
}

function reiniciarFase() {
  jogo.mundo.reiniciar();
  jogo.sonda.nascer();
  ligarEventos(jogo.sonda);
  particulas.limpar();
  jogo.esperaMorte = 0;
  atualizarHud();
}

function avancar() {
  jogo.fagulhasTotais += jogo.mundo.pegas;
  if (jogo.indice + 1 >= FASES.length) {
    jogo.estado = 'fim';
    const seg = Math.floor(jogo.quadros / 60);
    elResumo.textContent =
      `${FASES.length} torres · ${jogo.fagulhasTotais} fagulhas · ${jogo.mortes} quedas · ${formatarTempo(seg)}`;
    elFim.classList.remove('oculto');
    return;
  }
  carregar(jogo.indice + 1);
}

// ---------------------------------------------------------------- HUD
let dicaTimer = 0;
function mostrarDica(texto) {
  if (!texto) { elDica.classList.remove('mostra'); return; }
  elDica.textContent = texto;
  elDica.classList.add('mostra');
  dicaTimer = 300;
}

function formatarTempo(seg) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function atualizarHud() {
  elFase.textContent = `TORRE ${jogo.indice + 1}/${FASES.length} · ${jogo.mundo.nome}`;
  elFagulhas.textContent = `${jogo.mundo.pegas}/${jogo.mundo.totalFagulhas}`;
  elMortes.textContent = String(jogo.mortes);
}

// ---------------------------------------------------------------- laco
function passoLogico() {
  if (jogo.estado !== 'jogando') return;

  jogo.quadros++;
  if (jogo.quadros % 30 === 0) elTempo.textContent = formatarTempo(Math.floor(jogo.quadros / 60));
  if (dicaTimer > 0 && --dicaTimer === 0) elDica.classList.remove('mostra');

  if (entrada.apertou('recomecar') && jogo.esperaMorte === 0 && jogo.esperaVitoria === 0) {
    reiniciarFase();
  }

  if (jogo.esperaVitoria > 0) {
    if (--jogo.esperaVitoria === 0) { avancar(); return; }
  } else if (jogo.esperaMorte > 0) {
    if (--jogo.esperaMorte === 0) reiniciarFase();
  } else {
    jogo.sonda.passo(entrada);
  }

  const antes = jogo.mundo.quebradas.size;
  jogo.mundo.passo();
  if (jogo.mundo.quebradas.size !== antes) som.quebrar();
  for (const [chave, restante] of jogo.mundo.quebradas) {
    if (restante === 0) {
      const cx = chave % LARGURA, cy = Math.floor(chave / LARGURA);
      particulas.criar(cx * TILE + 8, cy * TILE + 8, 7, '#a8905c', 1.9, 24);
      jogo.mundo.quebradas.set(chave, -1);
      som.quebrar();
    }
  }

  particulas.passo();
  desenho.passo(reduzido);
  entrada.virarQuadro();
}

let acumulado = 0;
let anterior = performance.now();

function quadro(agora) {
  requestAnimationFrame(quadro);
  let delta = agora - anterior;
  anterior = agora;
  // Voltar de uma aba em segundo plano entrega um delta gigante. Sem o teto, o
  // jogo "avanca" centenas de passos de uma vez e a sonda aparece morta.
  if (delta > 250) delta = 250;
  acumulado += delta;
  let giros = 0;
  while (acumulado >= PASSO && giros < 5) {
    passoLogico();
    acumulado -= PASSO;
    giros++;
  }
  if (jogo.mundo) desenho.quadro(jogo.mundo, jogo.sonda, particulas, reduzido);
}

// ---------------------------------------------------------------- telas
function comecar() {
  som.acordar();
  jogo.estado = 'jogando';
  jogo.mortes = 0;
  jogo.quadros = 0;
  jogo.fagulhasTotais = 0;
  elMenu.classList.add('oculto');
  elFim.classList.add('oculto');
  elPausa.classList.add('oculto');
  carregar(0);
}

function pausar(ligar) {
  if (ligar) {
    jogo.estado = 'pausado';
    elPausa.classList.remove('oculto');
  } else {
    jogo.estado = 'jogando';
    elPausa.classList.add('oculto');
    // Bordas de tecla acumuladas durante a pausa nao podem disparar todas
    // juntas no primeiro quadro de volta.
    entrada.virarQuadro();
  }
}

document.getElementById('comecar').addEventListener('click', comecar);
document.getElementById('denovo').addEventListener('click', comecar);
document.getElementById('voltar').addEventListener('click', () => pausar(false));
document.getElementById('reiniciar').addEventListener('click', () => {
  pausar(false);
  reiniciarFase();
});

// Despausar pelo teclado tambem, senao quem pausou com P fica preso ao mouse.
// A pausa e tratada so aqui. Tratar tambem no laco fazia o despausar
// repausar na hora: o laco via a mesma borda de tecla que o listener.
window.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (jogo.estado === 'jogando') pausar(true);
    else if (jogo.estado === 'pausado') pausar(false);
  }
  if (jogo.estado === 'menu' && (e.code === 'Space' || e.code === 'Enter')) comecar();
});

// ---------------------------------------------------------------- teste
// O arranjo de teste le daqui. Sem isso, so daria para conferir pixel, e
// "a fase virou?" vira adivinhacao.
window.__teste = () => ({
  estado: jogo.estado,
  fase: jogo.indice,
  nomeFase: jogo.mundo ? jogo.mundo.nome : null,
  totalFases: FASES.length,
  mortes: jogo.mortes,
  fagulhas: jogo.mundo ? jogo.mundo.pegas : 0,
  totalFagulhas: jogo.mundo ? jogo.mundo.totalFagulhas : 0,
  x: jogo.sonda ? Math.round(jogo.sonda.x) : null,
  y: jogo.sonda ? Math.round(jogo.sonda.y) : null,
  noChao: jogo.sonda ? jogo.sonda.noChao : null,
  parede: jogo.sonda ? jogo.sonda.parede : null,
  morta: jogo.sonda ? jogo.sonda.morta : null,
  venceu: jogo.sonda ? jogo.sonda.venceu : null,
  alvoX: jogo.mundo && jogo.mundo.saida ? jogo.mundo.saida.x : null,
  alvoY: jogo.mundo && jogo.mundo.saida ? jogo.mundo.saida.y : null,
});
window.__comecar = comecar;
window.__irParaFase = i => { comecar(); carregar(i); };
window.__fases = FASES;
window.__medidas = { TILE, LARGURA, ALTURA };

requestAnimationFrame(quadro);
