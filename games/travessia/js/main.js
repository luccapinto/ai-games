// A casca do mundo aberto: laco de passo fixo, HUD, diario, mapa e as telas.
//
// Unico arquivo com DOM. Mundo, missao, sede e combate moram nos modulos que
// provas.mjs importa e joga sem navegador.

import { MISSOES } from './missoes.js';
import { CONFIG } from './regras.js';
import {
  criarJogo, passo, DT, ARMAS, claridade, calorDaHora, aguaMaisProxima,
  LOJA, vendedorPerto,
} from './jogo.js';
import { criarRender } from './render.js';
import { criarEntrada } from './entrada.js';
import { ligarAmbiente, atualizarAmbiente, tocar, alternarSom, somLigado } from './som.js';

const el = (id) => document.getElementById(id);
const palco = el('palco');
const tela = el('tela');
const mapaTela = el('mapa');

const render = criarRender(tela);
const entrada = criarEntrada(palco);

const CHAVE = 'travessia.progresso.v1';
const progresso = carregar();

let jogo = null;
let estado = 'menu';
let ultimo = performance.now();
let acumulado = 0;
let vistos = null;
let avisoAte = 0;
let semente = 0;

function carregar() {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE));
    if (bruto && typeof bruto.melhores === 'object') return bruto;
  } catch { /* sem progresso salvo */ }
  return { melhores: {}, travessias: 0 };
}

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(progresso)); } catch { /* sem armazenamento */ }
}

function ajustar() {
  const r = palco.getBoundingClientRect();
  tela.width = Math.round(r.width);
  tela.height = Math.round(r.height);
}
window.addEventListener('resize', ajustar);

function mostrar(nome) {
  estado = nome;
  for (const id of ['menu', 'pausa', 'fim', 'diario', 'loja']) {
    el(id).classList.toggle('oculto', id !== nome);
  }
  palco.classList.toggle('andando', nome === 'jogo');
}

function comecar(novaSemente) {
  semente = novaSemente;
  ajustar();
  jogo = criarJogo(semente);
  vistos = new Uint8Array(jogo.mundo.largura * jogo.mundo.altura);
  if (new URLSearchParams(location.search).has('depurar')) window.__jogo = jogo;
  ligarAmbiente();
  acumulado = 0;
  mostrar('jogo');
  entrada.limpar();
  avisar(`${jogo.mundo.vilas[0].nome} — semente ${semente}`);
}

function avisar(texto) {
  el('aviso').textContent = texto;
  el('aviso').classList.remove('oculto');
  avisoAte = performance.now() + 3000;
}

function hhmm(hora) {
  const h = Math.floor(hora);
  const m = Math.floor((hora - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// --------------------------------------------------------------------- laco

function laco(agora) {
  const dt = Math.min(0.1, (agora - ultimo) / 1000);
  ultimo = agora;

  if (estado === 'jogo') {
    acumulado += dt;
    let voltas = 0;
    while (acumulado >= DT && voltas++ < 5) {
      acumulado -= DT;
      const e = entrada.ler();
      for (const evento of passo(jogo, e, DT)) tratar(evento);
      revelar();
    }
    if (entrada.consumir('pausa')) mostrar('pausa');
    if (entrada.consumir('diario')) { montarDiario(); mostrar('diario'); }
    if (entrada.consumir('loja')) abrirLoja();
    if (entrada.consumir('mapa')) el('mapa').classList.toggle('grande');
    if (estado === 'jogo') {
      render.desenhar(jogo, dt);
      render.desenharMapa(mapaTela, jogo, vistos);
      atualizarHud();
      atualizarAmbiente(calorDaHora(jogo.hora), claridade(jogo.hora));
    }
  } else if (jogo && (estado === 'pausa' || estado === 'diario' || estado === 'loja')) {
    render.desenhar(jogo, 0);
  }

  if (avisoAte && performance.now() > avisoAte) {
    el('aviso').classList.add('oculto');
    avisoAte = 0;
  }
  requestAnimationFrame(laco);
}

function tratar(evento) {
  render.evento(evento);
  tocar(evento.tipo);
  if (evento.tipo === 'missao-aceita') {
    avisar(`MISSÃO: ${evento.titulo}`);
    el('recado').textContent = evento.texto;
    el('recado').classList.remove('oculto');
    setTimeout(() => el('recado').classList.add('oculto'), 9000);
  } else if (evento.tipo === 'missao-concluida') {
    avisar(`FEITO: ${evento.titulo} (+${evento.moedas} mil réis`
      + `${evento.item ? `, ${evento.item}` : ''})`);
  } else if (evento.tipo === 'pegou') {
    avisar(`${evento.item} ${evento.quanto}`);
  } else if (evento.tipo === 'sem-agua') {
    avisar('AQUI NÃO TEM ÁGUA');
  } else if (evento.tipo === 'morreu' || evento.tipo === 'venceu') {
    terminar(evento.tipo);
  }
}

function terminar(como) {
  const principais = MISSOES.filter(m => m.principal);
  const feitas = principais.filter(m => jogo.missoes[m.id].estado === 'concluida').length;
  if (como === 'venceu') {
    progresso.travessias++;
    const anterior = progresso.melhores[semente];
    if (!anterior || jogo.tempo < anterior) progresso.melhores[semente] = jogo.tempo;
    salvar();
  }
  el('fim-titulo').textContent = como === 'venceu' ? 'A ÁGUA DESCEU' : 'O SERTÃO FICOU COM VOCÊ';
  el('fim-resumo').innerHTML = como === 'venceu'
    ? `A adutora abriu em <b>${(jogo.tempo / 60).toFixed(1)} min</b> de travessia. `
      + `Você bebeu <b>${jogo.bebeu}</b> vezes e andou <b>${Math.round(jogo.jogador.andou)}</b> léguas de caatinga.`
    : `Você parou em <b>${feitas} de 7</b> da linha principal, com `
      + `<b>${Math.round(jogo.jogador.sede)}</b> de cantil.`;
  mostrar('fim');
}

// ---------------------------------------------------------------------- HUD

function revelar() {
  const j = jogo.jogador;
  const mundo = jogo.mundo;
  const raio = claridade(jogo.hora) > 0.5 ? 16 : 9;
  const cx = Math.floor(j.x);
  const cy = Math.floor(j.y);
  for (let y = cy - raio; y <= cy + raio; y++) {
    for (let x = cx - raio; x <= cx + raio; x++) {
      if (x < 0 || y < 0 || x >= mundo.largura || y >= mundo.altura) continue;
      if (Math.hypot(x - cx, y - cy) > raio) continue;
      vistos[y * mundo.largura + x] = 1;
    }
  }
}

function atualizarHud() {
  const j = jogo.jogador;
  el('hud-vida').style.width = `${Math.max(0, (j.vida / CONFIG.vidaMaxima) * 100)}%`;
  el('hud-sede').style.width = `${Math.max(0, (j.sede / j.sedeMaxima) * 100)}%`;
  el('hud-sede').classList.toggle('critico', j.sede < j.sedeMaxima * 0.25);
  el('hud-hora').textContent = hhmm(jogo.hora);
  el('hud-hora').classList.toggle('noite', claridade(jogo.hora) < 0.5);
  el('hud-moedas').textContent = j.moedas;
  el('hud-arma').textContent = (ARMAS[j.arma] || ARMAS.maos).nome;
  el('hud-loja').classList.toggle('oculto', !vendedorPerto(jogo));

  const itens = Object.entries(j.inventario).filter(([, n]) => n > 0);
  el('hud-bolsa').innerHTML = itens.length
    ? itens.map(([nome, n]) => `<li>${nome} <b>${n}</b></li>`).join('')
    : '<li class="vazio">bolsa vazia</li>';

  const ativa = MISSOES.find(m => jogo.missoes[m.id].estado === 'aceita' && m.principal)
    || MISSOES.find(m => jogo.missoes[m.id].estado === 'aceita')
    || MISSOES.find(m => jogo.missoes[m.id].estado === 'disponivel');
  if (ativa) {
    const estadoMissao = jogo.missoes[ativa.id];
    const alvo = estadoMissao.estado === 'disponivel' ? estadoMissao.dador : estadoMissao.alvo;
    const dx = alvo.x - j.x;
    const dy = alvo.y - j.y;
    const distancia = Math.hypot(dx, dy);
    const bussola = ['L', 'SL', 'S', 'SO', 'O', 'NO', 'N', 'NL'][
      Math.round(((Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8];
    el('hud-missao').innerHTML = `<b>${ativa.titulo}</b>`
      + `<span>${estadoMissao.estado === 'disponivel' ? 'falar com' : 'ir'} `
      + `${bussola} · ${Math.round(distancia)} passos</span>`
      + (ativa.quantidade && estadoMissao.estado === 'aceita'
        ? `<span>${Math.min(estadoMissao.progresso, ativa.quantidade)}/${ativa.quantidade}</span>`
        : '');
  } else {
    el('hud-missao').innerHTML = '<b>sem recado</b>';
  }

  const agua = aguaMaisProxima(jogo.mundo, j.x, j.y);
  el('hud-agua').textContent = agua
    ? `água a ${Math.round(Math.hypot(agua.x - j.x, agua.y - j.y))} passos`
    : 'água: não se vê';
}

function montarDiario() {
  const linhas = MISSOES.map((m) => {
    const e = jogo.missoes[m.id];
    const marca = { concluida: '✓', aceita: '•', disponivel: '!', fechada: '·' }[e.estado];
    const classe = e.estado === 'concluida' ? 'feita' : e.estado === 'fechada' ? 'fechada' : '';
    return `<li class="${classe}"><b>${marca} ${m.titulo}</b>`
      + `<span>${m.principal ? 'linha principal' : 'de lado'} · ${e.estado}</span>`
      + (e.estado !== 'fechada' ? `<i>${m.texto}</i>` : '')
      + '</li>';
  }).join('');
  el('diario-lista').innerHTML = linhas;
}

// ------------------------------------------------------------------- loja
//
// A bodega existe porque o HUD anunciava MIL RÉIS em destaque e nao havia o
// que comprar. Agora a moeda de missao vira facao, rifle, cantil e rapadura.

function abrirLoja() {
  if (!jogo || estado !== 'jogo') return;
  if (!vendedorPerto(jogo)) {
    avisar('NÃO HÁ QUEM VENDA POR PERTO');
    return;
  }
  montarLoja();
  mostrar('loja');
}

function montarLoja(recado = '') {
  const vendedor = vendedorPerto(jogo);
  el('loja-vendedor').textContent = vendedor
    ? `${vendedor.nome} abre a mala. Você tem ${jogo.jogador.moedas} mil réis.`
    : `Você tem ${jogo.jogador.moedas} mil réis.`;
  el('loja-recado').textContent = recado;
  el('loja-lista').innerHTML = LOJA.map(item => `<li>`
    + `<button class="compra" data-item="${item.id}" ${cabeNaBolsa(item) ? '' : 'disabled'}>`
    + `<b>${item.nome}</b><span>${item.texto}</span><i>${item.preco}</i></button></li>`).join('');
  for (const botao of el('loja-lista').querySelectorAll('[data-item]')) {
    botao.addEventListener('click', () => comprarItem(botao.dataset.item));
  }
}

function cabeNaBolsa(item) {
  const j = jogo.jogador;
  if (ARMAS[item.id]) return !j.armas[item.id] && j.moedas >= item.preco;
  if (item.id === 'cantil') return j.sedeMaxima < 200 && j.moedas >= item.preco;
  return j.vida < CONFIG.vidaMaxima && j.moedas >= item.preco;
}

const RECADO_DE_COMPRA = {
  'sem-dinheiro': 'não dá: falta mil réis',
  'ja-tem': 'isso você já tem',
  'sem-vendedor': 'o vendedor saiu de perto',
  'nao-vende': 'ninguém vende isso',
};

function comprarItem(id) {
  const r = jogo.comprar(id);
  if (r.ok) {
    tocar('missao-concluida');
    montarLoja(`levou ${r.item.nome.toLowerCase()} por ${r.item.preco} mil réis`);
    avisar(`COMPROU ${r.item.nome}`);
  } else {
    tocar('sem-agua');
    montarLoja(RECADO_DE_COMPRA[r.motivo] || 'não deu');
  }
}

// ------------------------------------------------------------------- botoes

function montarMenu() {
  const caixa = el('sementes');
  caixa.innerHTML = '';
  const sugestoes = [1000, 1111, 1222, 2718, 3141];
  for (const s of sugestoes) {
    const melhor = progresso.melhores[s];
    const botao = document.createElement('button');
    botao.className = 'semente';
    botao.innerHTML = `<b>SEMENTE ${s}</b>`
      + `<span>${melhor ? `travessia em ${(melhor / 60).toFixed(1)} min` : 'nunca atravessada'}</span>`;
    botao.addEventListener('click', () => comecar(s));
    caixa.appendChild(botao);
  }
  el('travessias').textContent = progresso.travessias
    ? `${progresso.travessias} travessia(s) concluída(s)`
    : 'nenhuma travessia concluída ainda';
}

el('menu-sorteio').addEventListener('click', () => comecar(Math.floor(Math.random() * 99999)));
el('pausa-voltar').addEventListener('click', () => mostrar('jogo'));
el('pausa-menu').addEventListener('click', () => { montarMenu(); mostrar('menu'); });
el('diario-voltar').addEventListener('click', () => mostrar('jogo'));
el('loja-voltar').addEventListener('click', () => mostrar('jogo'));
el('fim-menu').addEventListener('click', () => { montarMenu(); mostrar('menu'); });
el('fim-denovo').addEventListener('click', () => comecar(semente));
el('som').addEventListener('click', (ev) => {
  ev.currentTarget.textContent = alternarSom() ? 'SOM: LIGADO' : 'SOM: DESLIGADO';
});
el('som').textContent = somLigado() ? 'SOM: LIGADO' : 'SOM: DESLIGADO';

// A ficha das missoes principais sai do proprio grafo: mexer nas dependencias
// nao deixa o texto do menu desatualizado.
el('linha-principal').innerHTML = MISSOES.filter(m => m.principal)
  .map((m, i) => `<li><b>${i + 1}.</b> ${m.titulo}</li>`).join('');

ajustar();
montarMenu();
mostrar('menu');
requestAnimationFrame(laco);
