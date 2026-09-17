// A casca da corrida: laco de passo fixo, telas, HUD, campeonato.
//
// Unico arquivo que conhece DOM. Tudo que decide algo — fisica, IA, contagem de
// volta, item, pontos — mora nos modulos que `provas.mjs` importa e roda sem
// navegador. Quando esta casca desenha "MINI-TURBO FAIXA 3", o numero vem da
// mesma variavel que a prova do banco de medidas mede.

import { PISTAS } from './pista.js';
import { KART, comandosNulos, DT, velocidadeKmh, faixaDaCarga } from './fisica.js';
import { criarCorrida, passoCorrida, classificacao, PONTOS } from './corrida.js';
import { criarRender } from './render.js';
import { criarEntrada } from './entrada.js';
import {
  ligarMotor, atualizarMotor, pararMotor, tocar, alternarSom, somLigado,
} from './som.js';

const el = (id) => document.getElementById(id);
const palco = el('palco');
const tela = el('tela');
const mapaTela = el('mapa');

const render = criarRender(tela);
const entrada = criarEntrada(palco);

const CHAVE = 'curva.progresso.v2';
const progresso = carregar();

const NOMES_DE_ITEM = { cogumelo: 'cogumelo', casco: 'casco', banana: 'banana' };

let corrida = null;
let estado = 'menu';
let ultimo = performance.now();
let acumulado = 0;
let cockpit = false;
let campeonato = null;
let ultimaVolta = null;
let turboAte = 0;

function carregar() {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE) || '{}');
    return { recordes: bruto.recordes || {} };
  } catch {
    return { recordes: {} };
  }
}

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(progresso)); } catch { /* sem armazenamento */ }
}

function ajustarTela() {
  const r = palco.getBoundingClientRect();
  // Em tela densa o custo de pixel e real num raycaster... aqui e um render 3D
  // de verdade, entao o teto de 1,5 devicePixelRatio e o que mantem 60 Hz em
  // GPU integrada sem deixar a imagem borrada em tela retina.
  const escala = Math.min(window.devicePixelRatio || 1, 1.5);
  render.redimensionar(Math.round(r.width * escala), Math.round(r.height * escala));
}
window.addEventListener('resize', ajustarTela);

// ------------------------------------------------------------------ telas

function mostrar(nome) {
  estado = nome;
  for (const id of ['menu', 'pausa', 'resultado', 'tabela']) {
    el(id).classList.toggle('oculto', id !== nome);
  }
  palco.classList.toggle('correndo', nome === 'corrida');
  el('toque').classList.toggle('ativo', nome === 'corrida');
  if (nome !== 'corrida') pararMotor();
}

function formatar(segundos) {
  if (!segundos || !Number.isFinite(segundos)) return '--:--';
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

function montarMenu() {
  const caixa = el('pistas');
  caixa.innerHTML = '';
  for (const [i, pista] of PISTAS.entries()) {
    const recorde = progresso.recordes[pista.nome];
    const botao = document.createElement('button');
    botao.className = 'pista';
    botao.innerHTML = `<b>${pista.nome}</b><i>${pista.tema}</i>`
      + `<span>${pista.voltas} voltas · recorde ${formatar(recorde)}</span>`;
    botao.addEventListener('click', () => comecar(i, { voltas: pista.voltas }));
    caixa.appendChild(botao);
  }
}

function comecar(indice, opcoes = {}) {
  ajustarTela();
  corrida = criarCorrida(indice, {
    voltas: opcoes.voltas ?? PISTAS[indice].voltas,
    ia: 9,
    semente: 1234 + indice * 31,
  });
  render.trocarPista(corrida.pista, corrida.linha);
  // `?depurar` expoe a corrida para inspecao e para posicionar capturas de
  // tela; sem o parametro o jogo nao cria nada global.
  if (new URLSearchParams(location.search).has('depurar')) window.__corrida = corrida;
  ultimaVolta = null;
  acumulado = 0;
  ligarMotor();
  mostrar('corrida');
  entrada.limpar();
}

function comecarCampeonato() {
  campeonato = { etapa: 0, resultados: [] };
  comecar(0, {});
}

// -------------------------------------------------------------------- laco

function laco(agora) {
  const dt = Math.min(0.1, (agora - ultimo) / 1000);
  ultimo = agora;

  if (estado === 'corrida') {
    acumulado += dt;
    let passos = 0;
    while (acumulado >= DT && passos++ < 5) {
      acumulado -= DT;
      const comandos = entrada.ler(DT);
      corrida.carros[0].ultimoVolante = comandos.volante;
      for (const evento of passoCorrida(corrida, comandos, DT)) tratar(evento);
      for (const carro of corrida.carros) render.marcarPneu(carro);
      const jogador = corrida.carros[0];
      if (jogador.superficie === 'grama' && Math.abs(jogador.vx) > 6) {
        render.poeira(jogador, 'grama');
      }
    }
    if (entrada.consumir('pausa')) mostrar('pausa');
    if (entrada.consumir('reiniciar')) comecar(corrida.indicePista, { voltas: corrida.voltas });
    if (entrada.consumir('camera')) cockpit = !cockpit;
    // Rede de seguranca: se a corrida terminou e a tela nao trocou, troca. O
    // evento de fim ja faz isso; este ramo existe porque a versao anterior
    // ouvia um nome de evento que nao existe ('terminada' em vez de 'fim') e o
    // jogo congelava na ultima volta, com o mundo parado e nenhuma tela.
    if (corrida.estado === 'terminada' && estado === 'corrida') {
      terminar(corrida.classificacao);
    }
    if (estado === 'corrida') {
      atualizarMotor(corrida.carros[0], corrida.carros[0].superficie);
      render.desenhar(corrida, dt, { cockpit });
      render.desenharMapa(mapaTela, corrida, corrida.carros[0]);
      atualizarHud();
    }
  } else if (corrida && estado === 'pausa') {
    render.desenhar(corrida, 0, { cockpit });
  }
  requestAnimationFrame(laco);
}

function tratar(evento) {
  const eu = corrida.carros[0];
  switch (evento.tipo) {
    case 'volta':
      if (evento.carro === eu.nome) {
        ultimaVolta = evento.tempo;
        const recorde = progresso.recordes[corrida.pista.nome];
        if (!recorde || evento.tempo < recorde) {
          progresso.recordes[corrida.pista.nome] = evento.tempo;
          salvar();
          aviso(`RECORDE ${formatar(evento.tempo)}`);
        }
        tocar('volta');
      }
      break;
    case 'turbo':
      if (evento.carro === eu.nome) {
        turboAte = performance.now() + 700;
        tocar('turbo');
      }
      break;
    case 'item-pego':
      if (evento.carro === eu.nome) tocar('item');
      break;
    case 'acertou':
      if (evento.em === eu.nome) { aviso(`${evento.item.toUpperCase()}!`); tocar('batida'); }
      break;
    case 'muro':
      if (evento.carro === eu.nome) tocar('batida');
      break;
    case 'recolocado':
      if (evento.carro === eu.nome) aviso('DE VOLTA NA PISTA');
      break;
    case 'fim':
      terminar(evento.classificacao);
      break;
    default:
      break;
  }
}

let avisoAte = 0;
function aviso(texto) {
  el('aviso').textContent = texto;
  el('aviso').classList.add('mostrando');
  avisoAte = performance.now() + 1600;
}
setInterval(() => {
  if (avisoAte && performance.now() > avisoAte) {
    el('aviso').classList.remove('mostrando');
    avisoAte = 0;
  }
}, 250);

function terminar(tabela) {
  const eu = corrida.carros[0];
  const minha = tabela.find(l => l.nome === eu.nome);
  el('resultado-titulo').textContent = minha && minha.posicao === 1
    ? 'VITÓRIA' : `${minha ? minha.posicao : '-'}º LUGAR`;
  el('resultado-lista').innerHTML = tabela.map(l =>
    `<li class="${l.nome === eu.nome ? 'eu' : ''}"><span>${l.posicao}. ${l.nome}</span>`
    + `<span>${formatar(l.melhorVolta)}</span></li>`).join('');

  if (campeonato) {
    campeonato.resultados.push({ pilotos: tabela.map(l => l.nome) });
    campeonato.etapa++;
    el('resultado-seguir').classList.toggle('oculto', campeonato.etapa >= PISTAS.length);
    el('resultado-seguir').textContent = campeonato.etapa < PISTAS.length
      ? `PRÓXIMA: ${PISTAS[campeonato.etapa].nome}` : 'TABELA';
  } else {
    el('resultado-seguir').classList.add('oculto');
  }
  tocar('fim');
  mostrar('resultado');
}

function mostrarTabela() {
  const tabela = classificacao(campeonato.resultados);
  el('tabela-titulo').textContent = `CAMPEONATO · ${tabela[0].nome}`;
  el('tabela-lista').innerHTML = tabela.map((l, i) =>
    `<li class="${l.nome === 'VOCÊ' ? 'eu' : ''}"><span>${i + 1}. ${l.nome}</span>`
    + `<span>${l.pontos} pts · ${l.vitorias} v</span></li>`).join('');
  mostrar('tabela');
}

// --------------------------------------------------------------------- HUD

function atualizarHud() {
  const j = corrida.carros[0];
  el('hud-pos').textContent = `${j.posicao}/${corrida.carros.length}`;
  el('hud-volta').textContent = `${Math.min(corrida.voltas, j.voltas + 1)}/${corrida.voltas}`;
  el('hud-tempo').textContent = formatar(j.tempoVolta);
  el('hud-melhor').textContent = formatar(j.melhorVolta);
  el('hud-ultima').textContent = formatar(ultimaVolta);
  el('hud-vel').textContent = Math.round(velocidadeKmh(j));

  const caixaItem = el('hud-item');
  caixaItem.classList.toggle('cheio', !!j.item);
  caixaItem.classList.toggle('vazio', !j.item);
  el('hud-item-nome').textContent = j.item ? NOMES_DE_ITEM[j.item] : '—';

  // A carga do mini-turbo e a informacao central do jogo: sem ela o jogador
  // segura o gatilho no escuro e nunca aprende quando soltar.
  const faixa = faixaDaCarga(j.carga);
  const caixaCarga = el('hud-carga');
  caixaCarga.classList.toggle('f1', faixa === 1);
  caixaCarga.classList.toggle('f2', faixa === 2);
  caixaCarga.classList.toggle('f3', faixa >= 3);
  el('hud-carga-texto').textContent = faixa >= 3 ? 'SOLTE AGORA'
    : faixa > 0 ? `FAIXA ${faixa}` : 'MINI-TURBO';

  el('hud-turbo').classList.toggle('oculto', performance.now() > turboAte);
  el('hud-superficie').textContent = j.superficie === 'asfalto' || j.superficie === 'zebra'
    ? '' : (j.superficie || '').toUpperCase();

  if (corrida.estado === 'largada') {
    el('hud-luz').textContent = corrida.contagem > 2 ? '3'
      : corrida.contagem > 1 ? '2' : corrida.contagem > 0 ? '1' : 'VAI';
    el('hud-luz').classList.remove('oculto');
  } else {
    el('hud-luz').classList.add('oculto');
  }

  el('hud-ordem').innerHTML = corrida.ordem.slice(0, 6).map((c, i) =>
    `<li class="${c === j ? 'eu' : ''}"><b>${i + 1}</b> ${c.nome}`
    + `${c.turbo > 0 ? ' <i>turbo</i>' : ''}</li>`).join('');
}

// ------------------------------------------------------------------ botoes

el('menu-campeonato').addEventListener('click', comecarCampeonato);
el('pausa-voltar').addEventListener('click', () => mostrar('corrida'));
el('pausa-reiniciar').addEventListener('click', () => comecar(corrida.indicePista, { voltas: corrida.voltas }));
el('pausa-menu').addEventListener('click', () => { campeonato = null; montarMenu(); mostrar('menu'); });
el('resultado-menu').addEventListener('click', () => {
  if (campeonato && campeonato.etapa >= PISTAS.length) mostrarTabela();
  else { campeonato = null; montarMenu(); mostrar('menu'); }
});
el('resultado-seguir').addEventListener('click', () => {
  if (campeonato.etapa < PISTAS.length) comecar(campeonato.etapa, {});
  else mostrarTabela();
});
el('tabela-menu').addEventListener('click', () => { campeonato = null; montarMenu(); mostrar('menu'); });
el('som').addEventListener('click', (ev) => {
  ev.currentTarget.textContent = alternarSom() ? 'SOM: LIGADO' : 'SOM: DESLIGADO';
});
el('som').textContent = somLigado() ? 'SOM: LIGADO' : 'SOM: DESLIGADO';

// Ficha do kart, gerada dos proprios numeros da fisica — se o balanceamento
// mudar, esta tabela muda com ele.
el('ficha').innerHTML = [
  ['massa', `${KART.massa} kg`],
  ['potência', `${Math.round(KART.potencia / 745.7)} cv`],
  ['entre-eixos', `${KART.entreEixos.toFixed(2)} m`],
  ['aderência de projeto', `${KART.atritoBase.toFixed(2)} g`],
  ['teto de giro, aderência', `${(KART.fatorDeGiroEmAderencia * 100).toFixed(0)}%`],
  ['teto de giro, de lado', `${(KART.fatorDeGiroNoDrift * 100).toFixed(0)}%`],
  ['mini-turbo', `${KART.turboPorCarga.map(t => `${t.toFixed(1)} s`).join(' · ')}`],
].map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('');

ajustarTela();
montarMenu();
mostrar('menu');
requestAnimationFrame(laco);
