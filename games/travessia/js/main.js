// A casca do mundo aberto: laco de passo fixo, camera, HUD, bodega, diario,
// mapa e as telas.
//
// Unico arquivo com DOM alem do render. Mundo, missao, sede e combate moram
// nos modulos que provas.mjs importa e joga sem navegador — e por isso a
// entrada que sai daqui e a mesma que o robo monta a mao. O que main.js faz a
// mais e girar a direcao de andar pelo angulo da camera antes de entregar:
// para o jogo, "para a frente" continua sendo um vetor no mundo.

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

const CHAVE = 'travessia.progresso.v1';
const progresso = carregar();

let render = null;
let entrada = null;
let jogo = null;
let estado = 'menu';
let ultimo = performance.now();
let acumulado = 0;
let vistos = null;
let avisoAte = 0;
let semente = 0;
let batidaDoCoracao = 0;
const setasDePerigo = [];

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
  const escala = Math.min(window.devicePixelRatio || 1, 1.5);
  tela.width = Math.max(2, Math.round(r.width * escala));
  tela.height = Math.max(2, Math.round(r.height * escala));
  if (render) render.redimensionar();
}
window.addEventListener('resize', ajustar);

function mostrar(nome) {
  estado = nome;
  for (const id of ['menu', 'pausa', 'fim', 'diario', 'loja']) {
    el(id).classList.toggle('oculto', id !== nome);
  }
  palco.classList.toggle('andando', nome === 'jogo');
  if (nome !== 'jogo' && document.exitPointerLock) {
    try { document.exitPointerLock(); } catch { /* nao havia trava */ }
  }
}

function comecar(novaSemente) {
  semente = novaSemente;
  ajustar();
  jogo = criarJogo(semente);
  vistos = new Uint8Array(jogo.mundo.largura * jogo.mundo.altura);
  if (new URLSearchParams(location.search).has('depurar')) {
    window.__jogo = jogo;
    window.__render = render;
  }
  ligarAmbiente();
  acumulado = 0;
  limparSetas();
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
    const mira = entrada.lerVisao();
    render.mirar(mira.dx * 0.0034, -mira.dy * 0.0030);
    if (mira.zoom) render.aproximar(mira.zoom * 0.006);

    acumulado += dt;
    let voltas = 0;
    while (acumulado >= DT && voltas++ < 5) {
      acumulado -= DT;
      for (const evento of passo(jogo, montarEntrada(), DT)) tratar(evento);
      revelar();
    }
    if (entrada.consumir('pausa')) mostrar('pausa');
    if (entrada.consumir('diario')) { montarDiario(); mostrar('diario'); }
    if (entrada.consumir('loja')) abrirLoja();
    if (entrada.consumir('mapa')) el('mapa').classList.toggle('grande');
    if (estado === 'jogo') {
      render.desenhar(jogo, dt);
      render.desenharMapa(mapaTela, jogo, vistos);
      atualizarHud(dt);
      atualizarAmbiente(calorDaHora(jogo.hora), claridade(jogo.hora));
    }
  } else if (jogo && (estado === 'pausa' || estado === 'diario' || estado === 'loja')) {
    // A mesma tecla que abre fecha. Jogando trinta segundos, a primeira coisa
    // que a mao faz no diario e apertar esc — e nao acontecia nada.
    const sair = [entrada.consumir('pausa'), entrada.consumir('diario'),
      entrada.consumir('loja')].some(Boolean);
    entrada.consumir('mapa');
    if (sair) mostrar('jogo');
    else render.desenhar(jogo, 0);
  }

  if (avisoAte && performance.now() > avisoAte) {
    el('aviso').classList.add('oculto');
    avisoAte = 0;
  }
  requestAnimationFrame(laco);
}

// A entrada do jogo e sempre em coordenada de mundo. Quem gira e aqui: o
// jogador aperta W pensando "para onde eu estou olhando", e o jogo recebe um
// vetor no sertao — do mesmo jeito que o robo das provas entrega.
function montarEntrada() {
  const e = entrada.ler();
  const frente = -e.y;
  const lado = e.x;
  if (frente || lado) {
    const g = render.giro;
    const c = Math.cos(g);
    const s = Math.sin(g);
    e.x = frente * c - lado * s;
    e.y = frente * s + lado * c;
  } else {
    e.x = 0;
    e.y = 0;
  }
  return e;
}

function tratar(evento) {
  render.evento(evento);
  if (evento.tipo === 'golpe') {
    // Golpe que acerta nao toca o assobio: quem toca e o proprio acerto.
    if (!evento.acertou) tocar('golpe-vazio');
  } else if (evento.tipo === 'percebeu') {
    tocar(`percebeu-${evento.tipo_bicho}`);
    avisar(evento.tipo_bicho === 'onca' ? 'UMA ONÇA TE VIU' : 'CANGACEIRO NA MIRA');
  } else {
    tocar(evento.tipo);
  }

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
  } else if (evento.tipo === 'bebeu') {
    render.aoBeber(jogo.jogador.x, jogo.jogador.y);
  } else if (evento.tipo === 'dano') {
    render.numeroNoJogador(jogo, `-${Math.round(evento.dano)}`, [1, 0.35, 0.25]);
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
      + `Você bebeu <b>${jogo.bebeu}</b> vezes, andou <b>${Math.round(jogo.jogador.andou)}</b> `
      + `léguas de caatinga e terminou com <b>${jogo.jogador.moedas}</b> mil réis.`
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

// Uma seta por bicho irritado que esta fora da tela. Dentro da tela ele ja se
// anuncia sozinho: tem barra de vida em cima e anel no chao.
function limparSetas() {
  el('perigo').innerHTML = '';
  setasDePerigo.length = 0;
}

function atualizarPerigo() {
  const j = jogo.jogador;
  const caixa = el('perigo');
  const ameacas = [];
  for (const bicho of jogo.inimigos) {
    if (bicho.vida <= 0 || !bicho.irritado) continue;
    const d = Math.hypot(bicho.x - j.x, bicho.y - j.y);
    if (d > 45) continue;
    const alvo = render.projetarNaTela(bicho.x, render.alturaEm(bicho.x, bicho.y) + 1, bicho.y);
    const naTela = alvo && alvo.x > 40 && alvo.x < tela.clientWidth - 40
      && alvo.y > 40 && alvo.y < tela.clientHeight - 40;
    if (naTela) continue;
    ameacas.push({
      // 0 e "na frente da camera"; a seta gira a partir dali
      angulo: Math.atan2(bicho.y - j.y, bicho.x - j.x) - render.giro,
      tipo: bicho.tipo,
    });
    if (ameacas.length >= 4) break;
  }
  while (setasDePerigo.length < ameacas.length) {
    const fora = document.createElement('div');
    fora.className = 'seta-perigo';
    fora.appendChild(document.createElement('i'));
    caixa.appendChild(fora);
    setasDePerigo.push(fora);
  }
  for (const [i, seta] of setasDePerigo.entries()) {
    const a = ameacas[i];
    seta.style.display = a ? 'block' : 'none';
    if (!a) continue;
    seta.classList.toggle('onca', a.tipo === 'onca');
    seta.style.transform = `rotate(${a.angulo + Math.PI / 2}rad)`;
  }
}

function atualizarHud(dt) {
  const j = jogo.jogador;
  const fracaoDeVida = Math.max(0, j.vida / CONFIG.vidaMaxima);
  el('hud-vida').style.width = `${fracaoDeVida * 100}%`;
  el('hud-vida').classList.toggle('critico', fracaoDeVida < 0.3);
  el('hud-sede').style.width = `${Math.max(0, (j.sede / j.sedeMaxima) * 100)}%`;
  el('hud-sede').classList.toggle('critico', j.sede < j.sedeMaxima * 0.25);
  el('hud-hora').textContent = hhmm(jogo.hora);
  el('hud-hora').classList.toggle('noite', claridade(jogo.hora) < 0.5);
  el('hud-fps').textContent = `${Math.round(render.fps)} fps`;
  el('hud-moedas').textContent = j.moedas;
  el('hud-arma').textContent = (ARMAS[j.arma] || ARMAS.maos).nome;
  el('hud-loja').classList.toggle('oculto', !vendedorPerto(jogo));

  // Coracao batendo abaixo de trinta por cento: o aviso que nao depende de
  // estar olhando para a barra.
  if (fracaoDeVida > 0 && fracaoDeVida < 0.3) {
    batidaDoCoracao -= dt;
    if (batidaDoCoracao <= 0) {
      batidaDoCoracao = 0.55 + fracaoDeVida * 2.2;
      tocar('coracao');
    }
  } else {
    batidaDoCoracao = 0;
  }

  atualizarPerigo();

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

  const perto = jogo.mundo.vilas
    .map(v => ({ v, d: Math.hypot(v.x - j.x, v.y - j.y) }))
    .sort((a, b) => a.d - b.d)[0];
  el('hud-lugar').textContent = perto && perto.d < CONFIG.raioDeVila
    ? `em ${perto.v.nome.toLowerCase()}`
    : 'no sertão';
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

// ------------------------------------------------------------------- bodega
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
  el('loja-lista').innerHTML = LOJA.map((item) => {
    const estadoItem = estadoDaCompra(item);
    return '<li>'
      + `<button class="compra" data-item="${item.id}" ${estadoItem.pode ? '' : 'disabled'}>`
      + `<b>${item.nome}</b><span>${estadoItem.nota || item.texto}</span>`
      + `<i>${item.preco}</i></button></li>`;
  }).join('');
  for (const botao of el('loja-lista').querySelectorAll('[data-item]')) {
    botao.addEventListener('click', () => comprarItem(botao.dataset.item));
  }
}

// O botao apagado sem explicacao e o defeito classico de loja: a captura de
// tela saiu com os quatro itens cinzentos e nenhum motivo a vista.
function estadoDaCompra(item) {
  const j = jogo.jogador;
  if (ARMAS[item.id] && j.armas[item.id]) return { pode: false, nota: 'já está no cinto' };
  if (item.id === 'cantil' && j.sedeMaxima >= 200) return { pode: false, nota: 'cantil no limite' };
  if (item.id === 'rapadura' && j.vida >= CONFIG.vidaMaxima) {
    return { pode: false, nota: 'a vida está cheia' };
  }
  if (j.moedas < item.preco) {
    return { pode: false, nota: `faltam ${item.preco - j.moedas} mil réis` };
  }
  return { pode: true, nota: '' };
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
    tocar('comprou');
    montarLoja(`levou ${r.item.nome.toLowerCase()} por ${r.item.preco} mil réis`);
    avisar(`COMPROU ${r.item.nome}`);
  } else {
    tocar('recusa');
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

function semTresDimensoes(erro) {
  el('sementes').innerHTML = '';
  el('menu-sorteio').disabled = true;
  el('travessias').textContent = `Este navegador não abriu WebGL2, e o TRAVESSIA é `
    + `desenhado em três dimensões. Detalhe: ${erro.message}`;
}

try {
  render = criarRender(tela);
  entrada = criarEntrada(palco, tela);
} catch (erro) {
  console.error(erro);
  semTresDimensoes(erro);
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

// A tabela da bodega tambem sai dos dados, para preco no menu nunca mentir.
if (el('tabela-bodega')) {
  el('tabela-bodega').innerHTML = LOJA
    .map(i => `<li><b>${i.nome}</b> ${i.preco} mil réis</li>`).join('');
}

ajustar();
montarMenu();
mostrar('menu');
if (render) requestAnimationFrame(laco);
