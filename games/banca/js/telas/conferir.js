// Conferir: recalcula na frente do jogador. Para cada rodada revelada, o
// painel refaz o SHA-256 da semente da casa e compara com o hash publicado
// antes da aposta, depois refaz o sorteio com as três entradas e compara com
// o que a mesa registrou. Nada aqui lê o estado da mesa: só os números.

import { abrirPainel, avisar } from '../ui.js';
import { conferirHash } from '../nucleo/justo.js';
import { hmacSha256hex } from '../nucleo/sha256.js';
import { MESA_POR_ID } from '../mesas.js';

const NOMES = Object.fromEntries(Object.values(MESA_POR_ID).map(m => [m.id, m.nome]));
const JOGOS = ['roleta', 'blackjack', 'niquel', 'videopoquer', 'bacara', 'craps', 'holdem'];

function curtoHash(h) { return h.slice(0, 16) + '…' + h.slice(-8); }

export function abrirPainelConferir(app, jogoInicial) {
  const { casa } = app;
  const justo = casa.justo;
  let filtro = jogoInicial && JOGOS.includes(jogoInicial) ? jogoInicial : null;

  const painel = abrirPainel('conferir', `
    <h2>Conferir os sorteios</h2>
    <p class="sub">Antes de cada rodada a casa publica o SHA-256 de uma semente secreta. O resultado sai de HMAC-SHA256(semente da casa, "sua semente:contador:bloco"). Depois da rodada a semente é revelada, e aqui você refaz a conta: o hash tem de bater e o sorteio tem de sair igual. Nos jogos de sapato, o compromisso vale para o sapato inteiro e a semente é revelada quando ele é trocado.</p>
    <h3>Sua semente</h3>
    <div class="semente-linha">
      <input id="semente-jogador" maxlength="64" spellcheck="false" autocomplete="off" value="">
      <button class="btn escuro" id="trocar-semente">Trocar</button>
    </div>
    <p class="nota-painel">A troca vale a partir da próxima rodada (ou do próximo sapato). A casa não sabe a sua semente quando publica o hash, e você não sabe a dela quando escolhe a sua: nenhum dos dois consegue mirar um resultado.</p>
    <h3>Compromissos publicados agora</h3>
    <div class="compromissos"></div>
    <h3>Rodadas reveladas</h3>
    <div class="livro-abas filtro-jogos"></div>
    <div class="revelados"></div>
    <p class="nota-painel">Aqui a casa é o seu próprio navegador: quem abrir o armazenamento local consegue ler a semente antes da hora. Num cassino de verdade ela ficaria no servidor. Como aqui não há dinheiro, o que importa é que a conta é pública e reproduzível.</p>
  `);

  const inp = painel.querySelector('#semente-jogador');
  inp.value = justo.sementeJogador;
  painel.querySelector('#trocar-semente').onclick = () => {
    try {
      justo.trocarSementeJogador(inp.value);
      casa.salvar();
      avisar('Semente trocada. Vale a partir da próxima rodada.');
      compromissos();
    } catch (e) { avisar(e.message, { erro: true }); }
  };

  function compromissos() {
    painel.querySelector('.compromissos').innerHTML = JOGOS.filter(j => MESA_POR_ID[j] || j === 'holdem').filter(j => NOMES[j]).map(j => {
      const c = justo.compromisso(j);
      return `<div class="compromisso"><b>${NOMES[j].toUpperCase()} · CONTADOR ${c.contador}${c.aberto ? ' · EM USO' : ''}</b>${c.hash}</div>`;
    }).join('');
  }

  function abas() {
    const presentes = [...new Set(justo.revelados.map(r => r.jogo))];
    painel.querySelector('.filtro-jogos').innerHTML = [null, ...presentes].map(j => `<button data-j="${j ?? ''}" class="${(j ?? null) === filtro ? 'ativa' : ''}">${j ? NOMES[j] ?? j : 'Todas'}</button>`).join('');
  }

  function lista() {
    const itens = justo.revelados.filter(r => !filtro || r.jogo === filtro).slice(-60).reverse();
    painel.querySelector('.revelados').innerHTML = itens.length ? itens.map((r, k) => `
      <div class="revelado" data-k="${justo.revelados.indexOf(r)}">
        <div class="topo-rev"><b>${NOMES[r.jogo] ?? r.jogo}</b><span>contador ${r.contador}</span><span class="res">${resumoResultado(r)}</span><button class="btn fantasma conferir-um">Conferir</button></div>
        <div class="dados-rev">
          <div><span>hash publicado</span><code>${r.hash}</code></div>
          <div><span>semente da casa</span><code>${r.semente}</code></div>
          <div><span>sua semente</span><code>${escapar(r.sementeJogador)}</code></div>
          <div><span>primeiro bloco</span><code>HMAC(casa, "${escapar(r.sementeJogador)}:${r.contador}:0")</code></div>
        </div>
        <div class="saida-rev"></div>
      </div>`).join('') : '<p class="sub">Nenhuma rodada revelada ainda. Jogue uma e volte aqui.</p>';
  }

  async function conferirUm(el) {
    const r = justo.revelados[Number(el.dataset.k)];
    const saida = el.querySelector('.saida-rev');
    const hashOk = conferirHash(r.semente, r.hash);
    const bloco0 = hmacSha256hex(r.semente, `${r.sementeJogador}:${r.contador}:0`);
    let linhaJogo = '';
    try {
      const mod = await import(`../jogos/${r.jogo}/regras.js`);
      const c = mod.conferir ? mod.conferir(r) : null;
      if (c) linhaJogo = `<div class="${c.confere ? 'bom' : 'ruim'}">${c.confere ? 'Confere' : 'Não confere'}: ${c.descricao}</div>`;
    } catch (e) {
      linhaJogo = `<div class="ruim">Não consegui refazer este sorteio: ${e.message}</div>`;
    }
    saida.innerHTML = `
      <div class="${hashOk ? 'bom' : 'ruim'}">SHA-256(semente da casa) ${hashOk ? '=' : '≠'} hash publicado</div>
      <div class="bloco0">primeiro bloco: <code>${bloco0}</code></div>
      ${linhaJogo}`;
    el.classList.add(hashOk ? 'ok' : 'falha');
  }

  painel.querySelector('.filtro-jogos').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    filtro = b.dataset.j || null;
    abas(); lista();
  });
  painel.querySelector('.revelados').addEventListener('click', e => {
    const b = e.target.closest('.conferir-um');
    if (b) conferirUm(b.closest('.revelado'));
  });

  compromissos(); abas(); lista();
  // o mais recente já vem conferido
  const primeiro = painel.querySelector('.revelado');
  if (primeiro) conferirUm(primeiro);
  return painel;
}

function escapar(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function resumoResultado(r) {
  const x = r.resultado ?? {};
  return escapar(x.texto ?? '');
}

export { curtoHash };
