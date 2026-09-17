// A casca: laco de passo fixo, maquina de telas, HUD e minimapa.
//
// Este arquivo e o unico que conhece DOM e o unico que nao e testado por
// provas.mjs. Tudo que decide algo mora em jogo.js; aqui so se traduz entrada
// para o jogo e estado do jogo para pixel.

import { FASES } from './fases.js';
import { CONFIG } from './regras.js';
import * as M from './mapa.js';
import { ARMAS, ORDEM } from './armas.js';
import { TIPOS } from './inimigos.js';
import { criarJogo, passo, herdar, DT } from './jogo.js';
import { criarRender } from './render.js';
import { criarEntrada } from './entrada.js';
import { tocar, ambiente, alternarSom, somLigado } from './som.js';

const palco = document.getElementById('palco');
const tela = document.getElementById('tela');
const mapaTela = document.getElementById('mapa');
const mapaCtx = mapaTela.getContext('2d');

const el = (id) => document.getElementById(id);
const hud = {
  vida: el('hud-vida'), vidaBarra: el('hud-vida-barra'),
  bateria: el('hud-bateria'), bateriaBarra: el('hud-bateria-barra'),
  arma: el('hud-arma'), municao: el('hud-municao'),
  crachas: el('hud-crachas'), fase: el('hud-fase'),
  abates: el('hud-abates'), tempo: el('hud-tempo'),
};
const cortinas = {
  menu: el('menu'), pausa: el('pausa'), morto: el('morto'),
  entre: el('entre'), fim: el('fim'),
};
const aviso = el('aviso');
const dica = el('dica');

const render = criarRender(tela);
const entrada = criarEntrada(tela, palco);

const CHAVE = 'subsolo.progresso.v1';
const progresso = carregarProgresso();

let jogo = null;

// `?depurar` na URL expoe o estado da partida em window.__jogo. Serve para
// inspecionar e para posicionar a camera numa captura de tela; sem o parametro
// o jogo nao cria nada global.
const depurar = new URLSearchParams(location.search).has('depurar');
let estado = 'menu';
let acumulado = 0;
let ultimo = performance.now();
let tempoCorrida = 0;
let heranca = null;
let herancaDaFase = null;
let revelado = null;
let avisoAte = 0;

function carregarProgresso() {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE));
    if (bruto && typeof bruto.faseMax === 'number') return bruto;
  } catch { /* sem progresso salvo, comeca do zero */ }
  return { faseMax: 0, melhor: null };
}

function salvarProgresso() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(progresso));
  } catch { /* navegador sem armazenamento: o jogo continua, so nao lembra */ }
}

// ------------------------------------------------------------------- telas

function mostrar(nome) {
  estado = nome;
  for (const [chave, no] of Object.entries(cortinas)) {
    no.classList.toggle('oculto', chave !== nome);
  }
  const jogando = nome === 'jogando';
  palco.classList.toggle('jogando', jogando);
  if (jogando) entrada.travar();
  else entrada.destravar();
}

function montarSeletor() {
  const caixa = el('fases');
  caixa.innerHTML = '';
  for (const [i, fase] of FASES.entries()) {
    const botao = document.createElement('button');
    botao.className = 'fase';
    botao.disabled = i > progresso.faseMax;
    botao.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b> ${fase.nome}`;
    botao.addEventListener('click', () => comecar(i));
    caixa.appendChild(botao);
  }
  el('melhor').textContent = progresso.melhor
    ? `melhor travessia completa: ${formatarTempo(progresso.melhor)}`
    : 'nenhuma travessia completa ainda';
}

function comecar(indice) {
  // Recomecar numa fase adiantada da um kit de entrada honesto: e o que o
  // jogador teria acumulado ate ali, nao o arsenal inteiro.
  heranca = indice === 0 ? null : {
    vida: CONFIG.vidaMax, bateria: CONFIG.bateriaEntrada, arma: 'pineira',
    armas: {
      picareta: true, pineira: true,
      espingarda: indice >= 2, macarico: indice >= 4,
    },
    municao: {
      pinos: 40, cartuchos: indice >= 2 ? 8 : 0, gas: indice >= 4 ? 40 : 0,
    },
  };
  tempoCorrida = 0;
  iniciarFase(indice);
}

function iniciarFase(indice) {
  herancaDaFase = heranca ? JSON.parse(JSON.stringify({ ...heranca, armas: heranca.armas })) : null;
  jogo = criarJogo(indice, { herdado: heranca, semente: 1000 + indice });
  revelado = new Uint8Array(jogo.mapa.largura * jogo.mapa.altura);
  render.trocarFase(jogo.mapa);
  if (depurar) window.__jogo = jogo;
  ambiente(indice / (FASES.length - 1));
  dica.textContent = `${jogo.mapa.nome} — ${jogo.mapa.dica}`;
  dica.classList.remove('oculto');
  setTimeout(() => dica.classList.add('oculto'), 7000);
  mostrar('jogando');
  entrada.limpar();
}

function repetirFase() {
  heranca = herancaDaFase;
  iniciarFase(jogo.fase);
}

function avisar(texto) {
  aviso.textContent = texto;
  aviso.classList.remove('oculto');
  avisoAte = performance.now() + 1800;
}

function formatarTempo(segundos) {
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// -------------------------------------------------------------------- laco

function laco(agora) {
  const dt = Math.min(0.1, (agora - ultimo) / 1000);
  ultimo = agora;

  if (estado === 'jogando') {
    acumulado += dt;
    let voltas = 0;
    while (acumulado >= DT && voltas++ < 6) {
      acumulado -= DT;
      const e = entrada.ler(DT);
      for (const evento of passo(jogo, e, DT)) tratarEvento(evento);
      tempoCorrida += DT;
      revelar();
      if (entrada.consumir('pausa')) { mostrar('pausa'); break; }
      if (entrada.consumir('reiniciar')) { repetirFase(); break; }
      if (jogo.estado === 'morto') { tocar('morreu'); mostrarMorte(); break; }
      if (jogo.estado === 'saiu') { tocar('elevador'); mostrarEntre(); break; }
    }
    if (estado === 'jogando') {
      render.desenhar(jogo, dt);
      atualizarHud();
      desenharMapa();
    }
  } else if (jogo) {
    render.desenhar(jogo, 0);
  }

  if (avisoAte && performance.now() > avisoAte) {
    aviso.classList.add('oculto');
    avisoAte = 0;
  }
  requestAnimationFrame(laco);
}

function tratarEvento(evento) {
  render.evento(evento);
  switch (evento.tipo) {
    case 'tiro': tocar(evento.arma); break;
    case 'acerto': tocar('acerto'); break;
    case 'abate': tocar('abate'); break;
    case 'dano': tocar('dano'); break;
    case 'passo': tocar(evento.agua ? 'passoAgua' : 'passo'); break;
    case 'porta': tocar('porta'); break;
    case 'cuspe': tocar('cuspe'); break;
    case 'inflando': tocar('inflando'); break;
    case 'vazio': tocar('vazio'); break;
    case 'lanterna': tocar('lanterna'); break;
    case 'sem-pilha': tocar('semPilha'); avisar('PILHA VAZIA'); break;
    case 'trancada': tocar('trancada'); avisar(`PRECISA DO CRACHA ${evento.cracha}`); break;
    case 'segredo': tocar('segredo'); avisar('PASSAGEM ESCONDIDA'); break;
    case 'item': tocar('item'); avisar(evento.rotulo); break;
    case 'elevador-travado': tocar('travado'); avisar('O CAPATAZ AINDA ESTA DE PE'); break;
    default: break;
  }
}

function mostrarMorte() {
  el('morto-resumo').textContent =
    `${jogo.mapa.nome} — ${jogo.abatidos} de ${jogo.inimigos.length} abatidos`;
  mostrar('morto');
}

function mostrarEntre() {
  heranca = herdar(jogo);
  progresso.faseMax = Math.max(progresso.faseMax, Math.min(FASES.length - 1, jogo.fase + 1));
  salvarProgresso();
  if (jogo.fase >= FASES.length - 1) {
    if (!progresso.melhor || tempoCorrida < progresso.melhor) {
      progresso.melhor = tempoCorrida;
      salvarProgresso();
    }
    el('fim-resumo').textContent =
      `Nove niveis, ${formatarTempo(tempoCorrida)}. O capataz ficou no fundo.`;
    mostrar('fim');
    return;
  }
  const proxima = FASES[jogo.fase + 1];
  el('entre-titulo').textContent = `${jogo.mapa.nome} LIBERADO`;
  el('entre-resumo').innerHTML =
    `abatidos <b>${jogo.abatidos}/${jogo.inimigos.length}</b> · `
    + `itens <b>${jogo.coletados}</b> · segredos <b>${jogo.segredos}</b> · `
    + `vida <b>${Math.round(jogo.jogador.vida)}</b> · tempo <b>${formatarTempo(tempoCorrida)}</b>`
    + `<br>proximo nivel: <b>${proxima.nome}</b>`;
  mostrar('entre');
}

// --------------------------------------------------------------------- HUD

function atualizarHud() {
  const j = jogo.jogador;
  const arma = ARMAS[j.arma];
  hud.vida.textContent = Math.max(0, Math.round(j.vida));
  hud.vidaBarra.style.width = `${Math.max(0, (j.vida / CONFIG.vidaMax) * 100)}%`;
  hud.bateria.textContent = Math.round(j.bateria);
  hud.bateriaBarra.style.width = `${(j.bateria / CONFIG.bateriaMax) * 100}%`;
  hud.bateriaBarra.classList.toggle('acesa', j.lanterna);
  hud.arma.textContent = arma.nome;
  hud.municao.textContent = arma.municao ? j.municao[arma.municao] : '\u221e';
  hud.municao.classList.toggle('vazio', !!arma.municao && j.municao[arma.municao] === 0);
  hud.crachas.innerHTML = ['A', 'B', 'C']
    .map(c => `<i class="${j.crachas.has(c) ? 'tem' : ''} c${c}">${c}</i>`).join('');
  hud.fase.textContent = `${String(jogo.fase + 1).padStart(2, '0')} ${jogo.mapa.nome}`;
  hud.abates.textContent = `${jogo.abatidos}/${jogo.inimigos.length}`;
  hud.tempo.textContent = formatarTempo(tempoCorrida);
}

// Minimapa com neblina: revela o que a lanterna alcanca, e menos quando ela
// esta apagada. O mapa e uma ferramenta, nao um raio-X.
function revelar() {
  const j = jogo.jogador;
  const mapa = jogo.mapa;
  const raio = j.lanterna ? 7 : 4;
  const cx = Math.floor(j.x);
  const cy = Math.floor(j.y);
  for (let y = cy - raio; y <= cy + raio; y++) {
    for (let x = cx - raio; x <= cx + raio; x++) {
      if (x < 0 || y < 0 || x >= mapa.largura || y >= mapa.altura) continue;
      if (Math.hypot(x - cx, y - cy) > raio) continue;
      revelado[y * mapa.largura + x] = 1;
    }
  }
}

function desenharMapa() {
  const mapa = jogo.mapa;
  const escala = Math.max(1, Math.floor(Math.min(148 / mapa.largura, 110 / mapa.altura)));
  const w = mapa.largura * escala;
  const h = mapa.altura * escala;
  if (mapaTela.width !== w || mapaTela.height !== h) {
    mapaTela.width = w;
    mapaTela.height = h;
  }
  mapaCtx.fillStyle = 'rgba(6,6,8,0.82)';
  mapaCtx.fillRect(0, 0, w, h);
  for (let y = 0; y < mapa.altura; y++) {
    for (let x = 0; x < mapa.largura; x++) {
      if (!revelado[y * mapa.largura + x]) continue;
      const t = M.tile(mapa, x, y);
      let cor = null;
      if (t === M.T.ELEVADOR) cor = '#e8c24a';
      else if (t >= M.T.PORTA) {
        const porta = M.portaEm(mapa, x, y);
        if (porta && porta.falsa) cor = porta.aberta ? '#6a6a72' : null;
        else if (porta && porta.aberta) cor = '#3a4a3a';
        else cor = { [M.T.PORTA]: '#c8a84a', [M.T.TRAVADA_A]: '#e05a4a', [M.T.TRAVADA_B]: '#4aa8e0', [M.T.TRAVADA_C]: '#7ae04a' }[t];
      } else if (t >= M.T.ROCHA) cor = '#55555e';
      else cor = t === M.T.POCA ? '#2b4450' : '#22252b';
      if (!cor) continue;
      mapaCtx.fillStyle = cor;
      mapaCtx.fillRect(x * escala, y * escala, escala, escala);
    }
  }
  for (const item of jogo.itens) {
    if (item.pego) continue;
    if (!revelado[Math.floor(item.y) * mapa.largura + Math.floor(item.x)]) continue;
    mapaCtx.fillStyle = item.cracha ? '#ffffff' : '#7fd8a0';
    mapaCtx.fillRect(Math.floor(item.x) * escala, Math.floor(item.y) * escala, escala, escala);
  }
  for (const e of jogo.inimigos) {
    if (e.vida <= 0 || e.estado === 'dormindo') continue;
    if (!revelado[Math.floor(e.y) * mapa.largura + Math.floor(e.x)]) continue;
    mapaCtx.fillStyle = TIPOS[e.tipo].chefe ? '#ffb020' : '#e05a4a';
    mapaCtx.fillRect(Math.floor(e.x) * escala, Math.floor(e.y) * escala, escala, escala);
  }
  const j = jogo.jogador;
  mapaCtx.save();
  mapaCtx.translate(j.x * escala, j.y * escala);
  mapaCtx.rotate(j.ang);
  mapaCtx.fillStyle = '#eaf2ff';
  mapaCtx.beginPath();
  mapaCtx.moveTo(escala * 1.6, 0);
  mapaCtx.lineTo(-escala, escala * 0.9);
  mapaCtx.lineTo(-escala, -escala * 0.9);
  mapaCtx.closePath();
  mapaCtx.fill();
  mapaCtx.restore();
}

// ------------------------------------------------------------------ botoes

el('comecar').addEventListener('click', () => comecar(0));
el('voltar').addEventListener('click', () => mostrar('jogando'));
el('pausa-menu').addEventListener('click', () => { montarSeletor(); mostrar('menu'); });
el('pausa-reiniciar').addEventListener('click', () => repetirFase());
el('morto-repetir').addEventListener('click', () => repetirFase());
el('morto-menu').addEventListener('click', () => { montarSeletor(); mostrar('menu'); });
el('entre-continuar').addEventListener('click', () => iniciarFase(jogo.fase + 1));
el('fim-menu').addEventListener('click', () => { montarSeletor(); mostrar('menu'); });
el('som').addEventListener('click', (ev) => {
  ev.currentTarget.textContent = alternarSom() ? 'SOM: LIGADO' : 'SOM: DESLIGADO';
});
el('som').textContent = somLigado() ? 'SOM: LIGADO' : 'SOM: DESLIGADO';

tela.addEventListener('click', () => {
  if (estado === 'jogando' && !entrada.travado) entrada.travar();
});
window.addEventListener('keydown', (ev) => {
  if (ev.code !== 'Escape' && ev.code !== 'KeyP') return;
  if (estado === 'pausa') mostrar('jogando');
});

// Manual de armas gerado do proprio dado: mexer no balanceamento nao deixa o
// texto do menu desatualizado.
el('armas').innerHTML = ORDEM.map((chave) => {
  const a = ARMAS[chave];
  const municao = a.municao ? a.municao : 'sem municao';
  const ruido = a.ruido === 0 ? 'silenciosa' : `ruido ${a.ruido}`;
  return `<tr><th>${a.chave}</th><td>${a.nome}</td>`
    + `<td>${Math.round(a.dano * a.pelotas)} de dano</td>`
    + `<td>${municao}</td><td>${ruido}</td></tr>`;
}).join('');
el('bichos').innerHTML = Object.entries(TIPOS).map(([, t]) =>
  `<tr><td><b>${t.nome}</b></td><td>${t.vida} de vida</td>`
  + `<td>${t.visao === 0 ? 'cego' : `ve ${t.visao}`}</td>`
  + `<td>ouve ${t.audicao}</td></tr>`).join('');

montarSeletor();
mostrar('menu');
requestAnimationFrame(laco);
