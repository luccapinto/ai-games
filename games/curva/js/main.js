// A casca da corrida: laco de passo fixo, telas, HUD, campeonato.
//
// Unico arquivo que conhece DOM. Tudo que decide algo — fisica, IA, contagem de
// volta, box, pontos — mora nos modulos que provas.mjs importa.

import { PISTAS } from './pista.js';
import { CARRO, comandosNulos, DT, velocidadeKmh } from './fisica.js';
import { criarCorrida, passoCorrida, classificacao, PONTOS } from './corrida.js';
import { linhaIdeal } from './linha.js';
import { criarRender } from './render.js';
import { criarEntrada } from './entrada.js';
import { ligarMotor, atualizarMotor, pararMotor, tocar, alternarSom, somLigado } from './som.js';

const el = (id) => document.getElementById(id);
const palco = el('palco');
const tela = el('tela');
const mapaTela = el('mapa');

const render = criarRender(tela);
const entrada = criarEntrada(palco);

const CHAVE = 'curva.progresso.v1';
const progresso = carregar();

let corrida = null;
let estado = 'menu';
let ultimo = performance.now();
let acumulado = 0;
let mostrarLinha = false;
let camera = false;
let campeonato = null;
let ultimaVolta = null;

function carregar() {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE));
    if (bruto && bruto.recordes) return bruto;
  } catch { /* sem progresso: comeca limpo */ }
  return { recordes: {} };
}

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(progresso)); } catch { /* sem armazenamento */ }
}

function ajustarTela() {
  const r = palco.getBoundingClientRect();
  const escala = window.devicePixelRatio > 1.5 ? 1 : 1;
  tela.width = Math.round(r.width * escala);
  tela.height = Math.round(r.height * escala);
}
window.addEventListener('resize', ajustarTela);

// ------------------------------------------------------------------ telas

function mostrar(nome) {
  estado = nome;
  for (const id of ['menu', 'pausa', 'resultado', 'tabela']) {
    el(id).classList.toggle('oculto', id !== nome);
  }
  palco.classList.toggle('correndo', nome === 'corrida');
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
    let voltas = 0;
    while (acumulado >= DT && voltas++ < 5) {
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
    if (entrada.consumir('linha')) mostrarLinha = !mostrarLinha;
    if (entrada.consumir('camera')) camera = !camera;
    if (estado === 'corrida') {
      atualizarMotor(corrida.carros[0], corrida.carros[0].superficie);
      render.desenhar(corrida, dt, { mostrarLinha, norte: camera });
      render.desenharMapa(mapaTela, corrida, corrida.carros[0]);
      atualizarHud();
    }
  } else if (corrida && estado === 'pausa') {
    render.desenhar(corrida, 0, { mostrarLinha, norte: camera });
  }
  requestAnimationFrame(laco);
}

function tratar(evento) {
  switch (evento.tipo) {
    case 'largada': tocar('largada'); break;
    case 'toque': tocar('toque'); break;
    case 'muro': tocar('muro'); break;
    case 'box-inicio': tocar('box'); break;
    case 'volta':
      if (evento.carro === 'VOCE') {
        ultimaVolta = evento.tempo;
        const nome = corrida.pista.nome;
        const recorde = progresso.recordes[nome];
        if (!recorde || evento.tempo < recorde) {
          progresso.recordes[nome] = evento.tempo;
          salvar();
          tocar('melhorVolta');
          aviso('RECORDE DA PISTA');
        } else {
          tocar('volta');
        }
      }
      break;
    case 'bandeirada':
      if (evento.carro === 'VOCE') tocar('bandeirada');
      break;
    case 'fim': terminar(evento.classificacao); break;
    default: break;
  }
}

let avisoAte = 0;
function aviso(texto) {
  el('aviso').textContent = texto;
  el('aviso').classList.remove('oculto');
  avisoAte = performance.now() + 2200;
}
setInterval(() => {
  if (avisoAte && performance.now() > avisoAte) {
    el('aviso').classList.add('oculto');
    avisoAte = 0;
  }
}, 250);

function terminar(tabela) {
  pararMotor();
  const minha = tabela.find(l => l.tipo === 'jogador');
  el('resultado-titulo').textContent = minha
    ? `${minha.posicao}º LUGAR`
    : 'CORRIDA ENCERRADA';
  el('resultado-lista').innerHTML = tabela.map(l =>
    `<tr class="${l.tipo === 'jogador' ? 'eu' : ''}"><td>${l.posicao}</td><td>${l.nome}</td>`
    + `<td>${l.voltas}</td><td>${formatar(l.melhorVolta)}</td>`
    + `<td>${l.paradas}</td><td>${PONTOS[l.posicao - 1] || 0}</td></tr>`).join('');

  if (campeonato) {
    campeonato.resultados.push({ pilotos: tabela.map(l => l.nome) });
    campeonato.etapa++;
    el('resultado-seguir').textContent = campeonato.etapa < PISTAS.length
      ? `PRÓXIMA ETAPA: ${PISTAS[campeonato.etapa].nome}`
      : 'VER O CAMPEONATO';
    el('resultado-seguir').classList.remove('oculto');
  } else {
    el('resultado-seguir').classList.add('oculto');
  }
  mostrar('resultado');
}

function mostrarTabela() {
  const tabela = classificacao(campeonato.resultados);
  el('tabela-lista').innerHTML = tabela.map((l, i) =>
    `<tr class="${l.nome === 'VOCE' ? 'eu' : ''}"><td>${i + 1}</td><td>${l.nome}</td>`
    + `<td>${l.pontos}</td><td>${l.vitorias}</td></tr>`).join('');
  el('tabela-titulo').textContent = campeonato.etapa >= PISTAS.length
    ? 'CAMPEONATO ENCERRADO'
    : `CAMPEONATO — ${campeonato.etapa} de ${PISTAS.length} etapas`;
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
  el('hud-marcha').textContent = j.marcha;
  el('hud-pneu').style.width = `${Math.max(0, (1 - j.pneus.desgaste) * 100)}%`;
  el('hud-pneu').classList.toggle('critico', j.pneus.desgaste > 0.72);
  el('hud-gas').style.width = `${(j.combustivel / CARRO.tanque) * 100}%`;
  el('hud-giro').style.width = `${(j.rpm / CARRO.rpmMax) * 100}%`;
  el('hud-giro').classList.toggle('corte', j.rpm > CARRO.rpmTroca);
  el('hud-superficie').textContent = j.superficie === 'asfalto' ? '' : (j.superficie || '').toUpperCase();

  if (corrida.estado === 'largada') {
    el('hud-luz').textContent = corrida.contagem > 2 ? '3'
      : corrida.contagem > 1 ? '2' : corrida.contagem > 0 ? '1' : 'VAI';
    el('hud-luz').classList.remove('oculto');
  } else {
    el('hud-luz').classList.add('oculto');
  }

  el('hud-ordem').innerHTML = corrida.ordem.slice(0, 6).map((c, i) =>
    `<li class="${c === j ? 'eu' : ''}"><b>${i + 1}</b> ${c.nome}`
    + `${c.noBox ? ' <i>box</i>' : ''}</li>`).join('');
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

// Ficha do carro, gerada dos proprios numeros da fisica.
el('ficha').innerHTML = [
  ['massa', `${CARRO.massa} kg`],
  ['potência', `${Math.round(CARRO.potencia / 745.7)} cv`],
  ['tração', 'traseira'],
  ['aderência de projeto', `${CARRO.atritoBase.toFixed(2)} g`],
  ['aderência sustentada', `${CARRO.atritoUtil.toFixed(2)} g`],
  ['tanque', `${CARRO.tanque} L`],
].map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('');

ajustarTela();
montarMenu();
mostrar('menu');
requestAnimationFrame(laco);
