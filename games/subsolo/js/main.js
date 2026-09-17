// A casca do SUBSOLO: laco de passo fixo, mira no mouse, HUD e telas.
//
// Unico arquivo que conhece DOM. Tudo que decide algo — mapa, rodada, zumbi,
// arma, economia — mora nos modulos que `provas.mjs` importa e roda sem
// navegador. Quando o HUD escreve "ABRIR POR 750", o numero vem da mesma
// funcao que a prova da porta usa.

import { PLANTAS } from './planta.js';
import { CONFIG } from './regras.js';
import {
  criarJogo, passo, armaNaMao, alvoDeUso, textoDoAlvo, zumbisVivos,
} from './jogo.js';
import { quantidadeDaRodada } from './rodadas.js';
import { criarRender } from './render.js';
import { criarEntrada } from './entrada.js';
import {
  ligarAmbiente, pararAmbiente, atualizarAmbiente, tocar, alternarSom, somLigado,
} from './som.js';

const el = (id) => document.getElementById(id);
const palco = el('palco');
const tela = el('tela');
const render = criarRender(tela);

const DT = 1 / 60;
// Sensibilidade do mouse em radianos por pixel. Baixa de proposito: mira de FPS
// com sensibilidade alta vira loteria, e este jogo cobra cabeca.
const SENSIBILIDADE = 0.0022;

const SOM_DA_ARMA = {
  pistola: 'tiro-pistola',
  pineira: 'tiro-smg',
  espingarda: 'tiro-espingarda',
  carabina: 'tiro-rifle',
  macarico: 'tiro-smg',
  picareta: 'impacto-pedra',
};

const SIGLA_DO_PERK = { caldo: 'CAL', graxa: 'GRX', gatilho: 'GAT', talisma: 'TAL' };

// Recorde por mapa. Estas duas funcoes foram perdidas na extracao do modulo de
// entrada e o jogo parou de abrir: `carregarRecordes is not defined` no proprio
// corpo do modulo, sem erro no console porque o modulo nunca chegou a rodar.
function carregarRecordes() {
  try {
    return JSON.parse(localStorage.getItem('subsolo.recordes.v2') || '{}');
  } catch {
    return {};
  }
}

function salvarRecorde(mapa, rodada) {
  if (!recordes[mapa] || rodada > recordes[mapa]) {
    recordes[mapa] = rodada;
    try {
      localStorage.setItem('subsolo.recordes.v2', JSON.stringify(recordes));
    } catch { /* sem armazenamento */ }
  }
}

let jogo = null;
let estado = 'menu';
let mapaEscolhido = 0;
let ultimo = performance.now();
let acumulado = 0;
let marcaAte = 0;
let bannerAte = 0;
let sangueAte = 0;
let recordes = carregarRecordes();

const entrada = criarEntrada(palco, tela);

document.addEventListener('pointerlockchange', () => {
  if (estado === 'jogando' && document.pointerLockElement !== tela) mostrar('pausa');
});

// --------------------------------------------------------------- telas

function mostrar(nome) {
  estado = nome;
  for (const id of ['menu', 'pausa', 'fim']) el(id).classList.toggle('oculto', id !== nome);
  palco.classList.toggle('jogando', nome === 'jogando');
  if (nome !== 'jogando') {
    pararAmbiente();
    if (document.pointerLockElement === tela) document.exitPointerLock();
  } else {
    ligarAmbiente();
  }
}

function montarMenu() {
  const caixa = el('mapas');
  caixa.innerHTML = '';
  for (const [i, planta] of PLANTAS.entries()) {
    const botao = document.createElement('button');
    botao.className = `mapa${i === mapaEscolhido ? ' escolhido' : ''}`;
    const recorde = recordes[planta.nome];
    botao.innerHTML = `<b>${planta.nome}</b>`
      + `<small>${planta.dica}${recorde ? ` · recorde: rodada ${recorde}` : ''}</small>`;
    botao.addEventListener('click', () => {
      mapaEscolhido = i;
      montarMenu();
    });
    caixa.appendChild(botao);
  }
}

function comecar() {
  ajustarTela();
  jogo = criarJogo(mapaEscolhido, { semente: (Date.now() % 100000) + 1 });
  render.trocarMapa(jogo.mapa);
  acumulado = 0;
  el('hud-banner').textContent = '';
  el('hud-dica').textContent = '';
  entrada.limpar();
  mostrar('jogando');
  tela.requestPointerLock?.();
  if (new URLSearchParams(location.search).has('depurar')) window.__jogo = jogo;
}

function ajustarTela() {
  const r = palco.getBoundingClientRect();
  // Teto de 1,25 no devicePixelRatio: iluminacao por fragmento com nove luzes
  // custa, e 60 Hz vale mais que pixel em tela densa.
  const escala = Math.min(window.devicePixelRatio || 1, 1.25);
  render.redimensionar(Math.round(r.width * escala), Math.round(r.height * escala));
}
window.addEventListener('resize', ajustarTela);

function banner(texto) {
  const caixa = el('hud-banner');
  caixa.textContent = texto;
  caixa.classList.add('ativo');
  bannerAte = performance.now() + 2200;
}

// ---------------------------------------------------------------- laco

function laco(agora) {
  const dt = Math.min(0.1, (agora - ultimo) / 1000);
  ultimo = agora;

  if (estado === 'jogando') {
    acumulado += dt;
    let passos = 0;
    while (acumulado >= DT && passos++ < 5) {
      acumulado -= DT;
      const comandos = entrada.ler();
      if (entrada.consumir('lanterna')) jogo.jogador.lanterna = !jogo.jogador.lanterna;
      for (const evento of passo(jogo, comandos, DT)) tratar(evento);
    }
    if (entrada.consumir('pausa')) mostrar('pausa');
    if (estado === 'jogando') {
      render.desenhar(jogo, dt);
      atualizarHud();
      const perto = zumbisVivos(jogo).filter(z => Math.hypot(z.x - jogo.jogador.x, z.y - jogo.jogador.y) < 8).length;
      atualizarAmbiente({
        rodada: jogo.rodada,
        zumbisPerto: perto,
        vida: jogo.jogador.vida / jogo.jogador.vidaMaxima * 100,
        baixado: jogo.jogador.baixado,
        forcaLigada: jogo.forcaLigada,
      });
    }
  } else if (jogo && estado === 'pausa') {
    render.desenhar(jogo, 0);
  }
  requestAnimationFrame(laco);
}

function tratar(evento) {
  switch (evento.tipo) {
    case 'tiro': {
      const arma = armaNaMao(jogo);
      const nome = SOM_DA_ARMA[arma.chave.replace('-forjada', '')] || 'tiro-pistola';
      tocar(nome, { volume: arma.forjada ? 1.1 : 1 });
      break;
    }
    case 'golpe':
      // Picareta nao estoura: o som e o ferro cortando o ar, e o de carne vem
      // do evento de acerto, se houver.
      tocar('impacto-pedra', { volume: evento.acertos ? 0.35 : 0.5 });
      break;
    case 'vazio':
      tocar('vazio');
      break;
    case 'recarga':
      tocar('recarga');
      break;
    case 'acerto':
      tocar('impacto-carne', { volume: evento.naCabeca ? 1 : 0.7 });
      marcaAte = performance.now() + 120;
      break;
    case 'morte':
      tocar('grito', { volume: 0.8 });
      break;
    case 'dano':
      sangueAte = performance.now() + 700;
      tocar('grunhido');
      break;
    case 'baixado':
      tocar('baixado');
      break;
    case 'levantou':
      tocar('revive');
      banner('O TALISMA TE LEVANTOU');
      break;
    case 'tabua-arrancada':
      tocar('tabua-arrancada', { volume: 0.7 });
      break;
    case 'tabua-reposta':
      tocar('tabua-reposta', { volume: 0.6 });
      break;
    case 'porta-aberta':
    case 'comprou':
    case 'municao':
      tocar('compra');
      break;
    case 'caixa':
      tocar('caixa');
      banner(`A CAIXA DEU: ${evento.arma}`);
      break;
    case 'forjou':
      tocar('perk');
      banner(evento.arma);
      break;
    case 'perk':
      tocar('perk');
      banner(evento.perk);
      break;
    case 'negado':
      tocar('negado');
      break;
    case 'forca':
      tocar('forca');
      banner(evento.texto);
      break;
    case 'rodada':
      tocar('rodada');
      banner(evento.chefe ? `RODADA ${evento.rodada} — CAPATAZ` : `RODADA ${evento.rodada}`);
      break;
    case 'fim':
      terminar();
      break;
    default:
      break;
  }
}

function terminar() {
  const r = jogo.estatisticas;
  salvarRecorde(jogo.mapa.nome, jogo.rodada);
  el('fim-titulo').textContent = `RODADA ${jogo.rodada}`;
  el('fim-resumo').innerHTML = [
    ['mapa', jogo.mapa.nome],
    ['zumbis abatidos', r.mortes],
    ['na cabeca', `${r.cabecas} (${Math.round((r.cabecas / Math.max(1, r.mortes)) * 100)}%)`],
    ['precisao', r.tiros ? `${Math.round((r.acertos / r.tiros) * 100)}%` : '--'],
    ['golpes de picareta', r.golpes],
    ['tabuas repostas', r.tabuasRepostas],
    ['portas abertas', r.portasAbertas],
    ['recorde neste mapa', `rodada ${recordes[jogo.mapa.nome] || jogo.rodada}`],
  ].map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('');
  tocar('fim');
  mostrar('fim');
}

// ----------------------------------------------------------------- HUD

function atualizarHud() {
  const j = jogo.jogador;
  const arma = armaNaMao(jogo);
  const vivos = zumbisVivos(jogo).length;

  el('hud-rodada').textContent = jogo.rodada;
  el('hud-zumbis').textContent = jogo.faseDaRodada === 'intervalo'
    ? `PROXIMA: ${quantidadeDaRodada(jogo.rodada)}`
    : `${vivos + jogo.aNascer.length} restantes`;
  el('hud-pontos').textContent = j.pontos.toLocaleString('pt-BR');

  const fracao = Math.max(0, j.vida / j.vidaMaxima);
  const barra = el('hud-vida-barra');
  barra.style.width = `${fracao * 100}%`;
  barra.classList.toggle('critica', fracao < 0.35);

  el('hud-arma-nome').textContent = arma.nome;
  const pente = el('hud-pente');
  pente.textContent = Number.isFinite(arma.pente) ? arma.noPente : '∞';
  pente.classList.toggle('vazio', Number.isFinite(arma.pente) && arma.noPente === 0);
  el('hud-reserva').textContent = Number.isFinite(arma.naReserva) ? arma.naReserva : '∞';
  el('hud-recarga').classList.toggle('ativo', arma.recarregando > 0);

  const perks = el('hud-perks');
  const siglas = [...j.perks].map(p => SIGLA_DO_PERK[p] || p.slice(0, 3).toUpperCase());
  if (perks.dataset.atual !== siglas.join(',')) {
    perks.dataset.atual = siglas.join(',');
    perks.innerHTML = siglas.map(s => `<i class="perk">${s}</i>`).join('');
  }

  const alvo = alvoDeUso(jogo);
  el('hud-dica').textContent = alvo ? `E — ${textoDoAlvo(jogo, alvo)}` : '';

  el('hud-marca').classList.toggle('ativo', performance.now() < marcaAte);
  el('hud-sangue').style.opacity = performance.now() < sangueAte
    ? String(0.55 * (1 - fracao) + 0.25) : String(Math.max(0, 0.45 * (1 - fracao) - 0.05));

  const baixado = el('hud-baixado');
  baixado.classList.toggle('ativo', j.baixado);
  if (j.baixado) el('hud-baixado-tempo').textContent = Math.ceil(j.sangrando);

  if (bannerAte && performance.now() > bannerAte) {
    el('hud-banner').textContent = '';
    el('hud-banner').classList.remove('ativo');
    bannerAte = 0;
  }
}

// ------------------------------------------------------------- botoes

el('menu-jogar').addEventListener('click', comecar);
el('pausa-voltar').addEventListener('click', () => {
  entrada.limpar();
  mostrar('jogando');
  tela.requestPointerLock?.();
});
el('pausa-menu').addEventListener('click', () => { montarMenu(); mostrar('menu'); });
el('fim-denovo').addEventListener('click', comecar);
el('fim-menu').addEventListener('click', () => { montarMenu(); mostrar('menu'); });
el('som').addEventListener('click', (ev) => {
  ev.currentTarget.textContent = alternarSom() ? 'SOM: LIGADO' : 'SOM: DESLIGADO';
});
el('som').textContent = somLigado() ? 'SOM: LIGADO' : 'SOM: DESLIGADO';

// Tabela de controles, gerada dos proprios numeros do jogo.
el('controles').innerHTML = [
  ['mover', 'W A S D'],
  ['olhar', 'mouse (clique para travar)'],
  ['atirar', 'clique ou espaco'],
  ['recarregar', 'R'],
  ['usar / comprar', `E — alcance de ${CONFIG.alcanceDeUso.toFixed(1)} celulas`],
  ['trocar de arma', 'Q'],
  ['correr', `shift — ${CONFIG.vigorMaximo.toFixed(1)} s de vigor`],
  ['lanterna', 'F'],
  ['pausar', 'esc'],
].map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('');

ajustarTela();
montarMenu();
mostrar('menu');
requestAnimationFrame(laco);
