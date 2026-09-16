// A mesa: liga o combate ao DOM.
//
// Aqui a interface e DOM e CSS, nao canvas. Carta e texto, e texto em canvas e
// briga desnecessaria com quebra de linha, foco e leitor de tela. Cada carta e
// um <button> de verdade: navega por Tab e responde a Enter sem codigo extra.

import { CARTAS, SERVIDORES, SALAS } from './dados.js';
import { Corrida } from './combate.js';
import { Som } from './som.js';

const el = id => document.getElementById(id);
const elPaciencia = el('paciencia');
const elBarraPaciencia = el('barra-paciencia');
const elTempo = el('tempo');
const elGuarda = el('guarda');
const elSala = el('sala-atual');
const elNome = el('servidor-nome');
const elFala = el('servidor-fala');
const elBarraServidor = el('barra-servidor');
const elServidorPaciencia = el('servidor-paciencia');
const elServidorGuarda = el('servidor-guarda');
const elServidorForca = el('servidor-forca');
const elIntencao = el('intencao');
const elMao = el('mao');
const elMonte = el('monte-info');
const elRecompensa = el('recompensa');
const elOpcoes = el('opcoes');
const elMenu = el('menu');
const elFim = el('fim');
const elFimTitulo = el('fim-titulo');
const elFimResumo = el('fim-resumo');

const som = new Som();
let corrida = null;

// ---------------------------------------------------------------- desenho
function pintar() {
  if (!corrida) return;
  const c = corrida.combate;
  const s = c.servidor;

  elPaciencia.textContent = c.paciencia;
  elBarraPaciencia.style.width = `${Math.max(0, c.paciencia / c.pacienciaMax * 100)}%`;
  elTempo.textContent = c.tempo;
  elGuarda.textContent = c.guarda;
  elGuarda.classList.toggle('oculto', c.guarda <= 0);
  elSala.textContent = `SALA ${corrida.sala + 1}/${SALAS.length}`;

  elNome.textContent = s.nome;
  elFala.textContent = s.fala;
  elServidorPaciencia.textContent = `${Math.max(0, s.paciencia)}/${s.pacienciaMax}`;
  elBarraServidor.style.width = `${Math.max(0, s.paciencia / s.pacienciaMax * 100)}%`;
  elServidorGuarda.textContent = s.guarda;
  elServidorGuarda.classList.toggle('oculto', s.guarda <= 0);
  elServidorForca.textContent = `+${s.forca}`;
  elServidorForca.classList.toggle('oculto', s.forca <= 0);

  elIntencao.textContent = textoIntencao(c);
  elMonte.textContent = `monte ${c.monte.length} · descarte ${c.descarte.length} · baralho ${corrida.baralho.length}`;

  pintarMao(c);
}

// O anuncio e o coracao do jogo: sem ele, decidir entre bater e se guardar vira
// adivinhacao, e jogo de carta que vira adivinhacao nao tem decisao.
function textoIntencao(c) {
  const s = c.servidor;
  if (s.atordoado > 0) return 'Está atordoado. Perde a vez.';
  const i = c.intencao;
  if (i.tipo === 'ataque') {
    const dano = i.valor + s.forca;
    const vezes = i.vezes || 1;
    const sobra = c.danoAnunciado - c.guarda;
    const aviso = sobra > 0 ? ` Passa ${sobra} pela sua guarda.` : ' Sua guarda segura.';
    return vezes > 1
      ? `Vai dar ${dano} de dano, ${vezes} vezes.${aviso}`
      : `Vai dar ${dano} de dano.${aviso}`;
  }
  if (i.tipo === 'guarda') return `Vai se proteger com ${i.valor} de guarda.`;
  return `Vai ganhar ${i.valor} de força.`;
}

function pintarMao(c) {
  elMao.innerHTML = '';
  c.mao.forEach((chave, i) => {
    const carta = CARTAS[chave];
    const b = document.createElement('button');
    b.className = 'carta';
    b.disabled = !c.podeJogar(i);
    b.innerHTML =
      `<span class="custo">${carta.custo}</span>` +
      `<span class="nome">${carta.nome}</span>` +
      `<span class="texto">${carta.texto}</span>` +
      `<span class="selo">${carta.tipo}</span>`;
    b.addEventListener('click', () => jogarCarta(i));
    elMao.appendChild(b);
  });
}

// ---------------------------------------------------------------- acoes
function jogarCarta(i) {
  const c = corrida.combate;
  const carta = CARTAS[c.mao[i]];
  if (!c.jogar(i)) { som.negado(); return; }
  if (carta.dano || carta.danoPorCarta) som.bater();
  else if (carta.guarda) som.guardar();
  else som.papel();
  pintar();
  if (c.venceu !== null) setTimeout(terminarCombate, 420);
}

function passar() {
  const c = corrida.combate;
  if (c.venceu !== null) return;
  const antes = c.paciencia;
  c.passar();
  if (c.paciencia < antes) som.apanhar();
  pintar();
  if (c.venceu !== null) setTimeout(terminarCombate, 420);
}

function terminarCombate() {
  corrida.resolverCombate();
  if (corrida.fim) { mostrarFim(); return; }
  som.deferido();
  elOpcoes.innerHTML = '';
  for (const chave of corrida.recompensas) {
    const carta = CARTAS[chave];
    const b = document.createElement('button');
    b.className = 'carta';
    b.innerHTML =
      `<span class="custo">${carta.custo}</span>` +
      `<span class="nome">${carta.nome}</span>` +
      `<span class="texto">${carta.texto}</span>` +
      `<span class="selo">${carta.tipo}</span>`;
    b.addEventListener('click', () => escolher(chave));
    elOpcoes.appendChild(b);
  }
  elRecompensa.classList.remove('oculto');
}

function escolher(chave) {
  corrida.escolher(chave);
  elRecompensa.classList.add('oculto');
  som.carimbar();
  pintar();
}

function mostrarFim() {
  const venceu = corrida.fim === 'vitoria';
  elFimTitulo.textContent = venceu ? 'DEFERIDO' : 'INDEFERIDO';
  elFimTitulo.classList.toggle('indeferido', !venceu);
  const salas = corrida.registro.filter(r => r.venceu).length;
  elFimResumo.textContent = venceu
    ? `Cinco instâncias vencidas, com ${corrida.paciencia} de paciência de sobra e ${corrida.baralho.length} cartas no processo.`
    : `Parou na sala ${salas + 1} de ${SALAS.length}, contra ${SERVIDORES[SALAS[salas]].nome}. O processo tinha ${corrida.baralho.length} cartas.`;
  elFim.classList.remove('oculto');
  som.fim(venceu);
}

function comecar() {
  som.acordar();
  corrida = new Corrida(Date.now());
  elMenu.classList.add('oculto');
  elFim.classList.add('oculto');
  elRecompensa.classList.add('oculto');
  pintar();
}

el('passar').addEventListener('click', passar);
el('comecar').addEventListener('click', comecar);
el('denovo').addEventListener('click', comecar);
el('pular').addEventListener('click', () => escolher(null));

// Numeros jogam a carta na posicao, espaco passa a vez: quem joga muito nao
// quer tirar a mao do teclado.
window.addEventListener('keydown', e => {
  if (!corrida || !elMenu.classList.contains('oculto')) {
    if (e.code === 'Space' || e.code === 'Enter') { comecar(); e.preventDefault(); }
    return;
  }
  if (!elRecompensa.classList.contains('oculto') || !elFim.classList.contains('oculto')) return;
  if (e.code === 'Space') { e.preventDefault(); passar(); return; }
  const n = e.code.match(/^Digit([1-9])$/);
  if (n) jogarCarta(Number(n[1]) - 1);
});

// ---------------------------------------------------------------- teste
window.__teste = () => {
  if (!corrida) return { iniciado: false };
  const c = corrida.combate;
  return {
    iniciado: true,
    sala: corrida.sala,
    servidor: c.servidor.nome,
    paciencia: c.paciencia,
    tempo: c.tempo,
    guarda: c.guarda,
    mao: c.mao.slice(),
    jogaveis: c.mao.map((_, i) => c.podeJogar(i)),
    servidorPaciencia: c.servidor.paciencia,
    servidorGuarda: c.servidor.guarda,
    servidorForca: c.servidor.forca,
    danoAnunciado: c.danoAnunciado,
    venceu: c.venceu,
    fim: corrida.fim,
    recompensas: corrida.recompensas,
    baralho: corrida.baralho.length,
    turno: c.turno,
  };
};
window.__comecar = comecar;
window.__jogar = i => jogarCarta(i);
window.__passar = passar;
window.__escolher = c => escolher(c);
window.__cartas = CARTAS;
