// A mesa em DOM. O enigma inteiro mora em js/enigma.js e nao sabe que o
// navegador existe — e por isso que da para provar a unicidade dele fora daqui.

import {
  gerar, conferir, textoDaPista, CATEGORIAS, CONVIDADOS, N,
} from './enigma.js';
import { Som } from './som.js';

const el = id => document.getElementById(id);
const elLinhas = el('linhas');
const elPistas = el('pistas');
const elNoite = el('noite');
const elVeneno = el('veneno');
const elErros = el('erros');
const elAviso = el('aviso');
const elAcusar = el('acusar');
const elAcusacao = el('acusacao');
const elSuspeitos = el('suspeitos');
const elMenu = el('menu');
const elFim = el('fim');
const elFimTitulo = el('fim-titulo');
const elFimResumo = el('fim-resumo');

const som = new Som();

let enigma = null;
let palpite = null;     // palpite[chave][convidado] = indice do valor, ou -1
let noite = 1;
let tentativas = 0;
let acertos = 0;

// ---------------------------------------------------------------- montagem
function novaCeia() {
  // A semente vem do relogio: cada noite e um enigma diferente, e o gerador so
  // devolve enigma de solucao unica, entao nao ha risco de cair num impossivel.
  let tentativa = 0;
  do {
    enigma = gerar(Math.floor(Math.random() * 1e9) + tentativa);
    tentativa++;
  } while (!enigma && tentativa < 40);

  palpite = {};
  for (const { chave } of CATEGORIAS) palpite[chave] = new Array(N).fill(-1);
  tentativas = 0;
  montarMesa();
  montarPistas();
  atualizar();
}

function montarMesa() {
  elLinhas.innerHTML = '';
  for (let i = 0; i < N; i++) {
    const tr = document.createElement('tr');
    const nome = document.createElement('td');
    nome.className = 'nome';
    nome.textContent = CONVIDADOS[i];
    tr.appendChild(nome);

    for (const cat of CATEGORIAS) {
      const td = document.createElement('td');
      const b = document.createElement('button');
      b.className = 'celula';
      b.dataset.cat = cat.chave;
      b.dataset.i = String(i);
      b.addEventListener('click', () => girar(cat.chave, i, 1));
      // Botao direito volta: quem passou do valor nao quer dar a volta inteira.
      b.addEventListener('contextmenu', e => { e.preventDefault(); girar(cat.chave, i, -1); });
      td.appendChild(b);
      tr.appendChild(td);
    }
    elLinhas.appendChild(tr);
  }
}

function montarPistas() {
  elPistas.innerHTML = '';
  for (const p of enigma.pistas) {
    const li = document.createElement('li');
    li.textContent = textoDaPista(p);
    // Riscar a pista ja usada e caderno, nao regra: nao muda nada no jogo.
    li.addEventListener('click', () => li.classList.toggle('riscada'));
    elPistas.appendChild(li);
  }
}

function girar(chave, i, passo) {
  const atual = palpite[chave][i];
  const proximo = atual + passo;
  palpite[chave][i] = proximo >= N ? -1 : proximo < -1 ? N - 1 : proximo;
  som.girar();
  atualizar();
}

// ---------------------------------------------------------------- pintura
function atualizar() {
  const cat1 = CATEGORIAS[1];
  elNoite.textContent = `NOITE ${noite}`;
  elVeneno.textContent = `VENENO NO ${cat1.valores[enigma.bebidaDoVeneno].toUpperCase()}`;
  elErros.textContent = tentativas ? `${tentativas} acusação(ões) erradas` : '';

  let completo = true;
  for (const cat of CATEGORIAS) {
    const contagem = {};
    for (const v of palpite[cat.chave]) if (v >= 0) contagem[v] = (contagem[v] || 0) + 1;
    for (let i = 0; i < N; i++) {
      const b = elLinhas.querySelector(`[data-cat="${cat.chave}"][data-i="${i}"]`);
      const v = palpite[cat.chave][i];
      b.textContent = v < 0 ? '—' : cat.valores[v];
      b.classList.toggle('vazia', v < 0);
      b.classList.toggle('repetida', v >= 0 && contagem[v] > 1);
      if (v < 0) completo = false;
    }
  }
  elAcusar.disabled = !completo;
  elAviso.textContent = completo ? '' : 'preencha a mesa inteira para acusar';
}

// ---------------------------------------------------------------- acusacao
function abrirAcusacao() {
  const cat1 = CATEGORIAS[1];
  el('acusacao-dica').textContent =
    `O veneno estava no cálice de quem bebeu ${cat1.valores[enigma.bebidaDoVeneno]}. Pela sua mesa, quem foi?`;
  elSuspeitos.innerHTML = '';
  for (let i = 0; i < N; i++) {
    const b = document.createElement('button');
    b.className = 'suspeito';
    b.textContent = CONVIDADOS[i];
    b.addEventListener('click', () => acusar(i));
    elSuspeitos.appendChild(b);
  }
  elAcusacao.classList.remove('oculto');
}

function acusar(quem) {
  elAcusacao.classList.add('oculto');
  const r = conferir(enigma, palpite);
  const certoCulpado = quem === enigma.culpado;

  if (r.certo && certoCulpado) {
    acertos++;
    som.acerto();
    elFimTitulo.textContent = 'ERA ELE';
    elFimTitulo.classList.remove('errou');
    elFimResumo.textContent =
      `${CONVIDADOS[quem]} bebeu ${CATEGORIAS[1].valores[enigma.bebidaDoVeneno]}. ` +
      `A mesa inteira certa, com ${enigma.pistas.length} pistas e ` +
      `${tentativas} acusação(ões) errada(s). ${acertos} noite(s) resolvida(s).`;
    elFim.classList.remove('oculto');
    return;
  }

  tentativas++;
  som.erro();
  // Diz quantas celulas estao erradas por coluna, nunca quais: apontar a celula
  // exata entregaria o enigma em duas tentativas.
  const partes = CATEGORIAS
    .filter(c => r.erros[c.chave] > 0)
    .map(c => `${c.rotulo.toLowerCase()} (${r.erros[c.chave]})`);
  // atualizar() vem ANTES de escrever o aviso: ela limpa o campo, e escrever
  // antes dela apagava a mensagem util e sobrava um "tente de novo" inutil.
  atualizar();
  elAviso.textContent = !r.certo
    ? `ainda há erro em ${partes.join(', ')}`
    : `a mesa está certa, mas ${CONVIDADOS[quem]} não bebeu ${CATEGORIAS[1].valores[enigma.bebidaDoVeneno]}`;
}

// ---------------------------------------------------------------- telas
function comecar() {
  som.acordar();
  elMenu.classList.add('oculto');
  elFim.classList.add('oculto');
  novaCeia();
}

el('comecar').addEventListener('click', comecar);
el('acusar').addEventListener('click', abrirAcusacao);
el('voltar').addEventListener('click', () => elAcusacao.classList.add('oculto'));
el('limpar').addEventListener('click', () => {
  for (const { chave } of CATEGORIAS) palpite[chave] = new Array(N).fill(-1);
  som.girar();
  atualizar();
});
el('proxima').addEventListener('click', () => {
  noite++;
  elFim.classList.add('oculto');
  novaCeia();
});

window.addEventListener('keydown', e => {
  if (!elMenu.classList.contains('oculto') && (e.code === 'Space' || e.code === 'Enter')) {
    comecar(); e.preventDefault();
  }
  if (e.code === 'Escape') elAcusacao.classList.add('oculto');
});

// ---------------------------------------------------------------- teste
window.__teste = () => ({
  iniciado: !!enigma,
  noite,
  tentativas,
  acertos,
  pistas: enigma ? enigma.pistas.length : 0,
  textos: enigma ? enigma.pistas.map(textoDaPista) : [],
  palpite,
  completo: enigma ? CATEGORIAS.every(c => palpite[c.chave].every(v => v >= 0)) : false,
  podeAcusar: !elAcusar.disabled,
  aviso: elAviso.textContent,
  fimVisivel: !elFim.classList.contains('oculto'),
});
window.__comecar = comecar;
// Preenche a mesa com a solucao certa: e o que o teste usa para conferir que o
// jogo aceita a resposta correta sem ter que deduzir por fora.
window.__resolverSozinho = () => {
  for (const { chave } of CATEGORIAS) palpite[chave] = [...enigma.arranjo[chave]];
  atualizar();
};
window.__errarDeProposito = () => {
  [palpite.bebida[0], palpite.bebida[1]] = [palpite.bebida[1], palpite.bebida[0]];
  atualizar();
};
window.__culpado = () => enigma.culpado;
window.__acusar = i => acusar(i);
