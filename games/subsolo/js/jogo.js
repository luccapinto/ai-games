// O jogo inteiro, sem uma linha de desenho.
//
// `main.js` so traduz teclado para `comandos` e estado para pixel; `provas.mjs`
// e `robo.js` chamam exatamente as mesmas funcoes daqui. E isso que permite
// provar que a rodada 15 e sobrevivivel sem abrir o navegador.
//
// Duas regras de projeto que valem ser ditas em voz alta:
//
// 1. **Zumbi nasce so em zona aberta.** Compra menos mapa, menos janela para
//    defender. E a mesma troca do genero: espaco custa pontos e paga em
//    seguranca — e se o jogador quiser ficar no galpao com duas janelas para
//    sempre, isso e uma estrategia legitima que o jogo nao proibe.
//
// 2. **O ponto vem do dano, nao da morte.** Dez por acerto, sessenta por morte,
//    cem por morte na cabeca. Sem ponto por acerto, uma arma forte demais seca
//    a economia, e o jogador chega na rodada 15 sem ter comprado nada.

import { CONFIG, TEXTOS } from './regras.js';
import {
  carregar, criarFluxo, refazerFluxo, mover, solido, solidoParaTiro,
  portaEm, abrirPorta, zonaEm, chave,
} from './mapa.js';
import { PLANTAS } from './planta.js';
import {
  ARMAS, equipar, equiparForjada, tracar, golpear, custoDaMunicao,
} from './armas.js';
import {
  composicaoDaRodada, intervaloDeNascimento, RODADA_DO_CHEFE,
} from './rodadas.js';
import { criarZumbi, passoDoZumbi, ferir, comoAlvo } from './zumbis.js';

const ARMAS_DA_CAIXA = ['espingarda', 'pineira', 'carabina', 'macarico'];
const TEMPO_ENTRE_RODADAS = 6;

export function criarSorteio(semente = 1) {
  let estado = (semente | 0) || 1;
  return () => {
    estado = (estado * 1103515245 + 12345) & 0x7fffffff;
    return estado / 0x7fffffff;
  };
}

export function criarJogo(indiceMapa = 0, opcoes = {}) {
  const mapa = carregar(PLANTAS[indiceMapa]);
  for (const janela of mapa.janelas) {
    janela.tabuas = CONFIG.tabuasPorJanela;
    janela.ocupadaPor = null;
  }
  const jogo = {
    indiceMapa,
    mapa,
    fluxo: criarFluxo(mapa),
    sorteio: criarSorteio(opcoes.semente || 7),
    tempo: 0,
    estado: 'jogando',
    rodada: opcoes.rodada || 1,
    faseDaRodada: 'intervalo',
    relogioDaFase: opcoes.semPreparo ? 0 : 2.5,
    aNascer: [],
    vivos: [],
    relogioDeNascimento: 0,
    relogioDeUso: 0,
    forcaLigada: false,
    eventos: [],
    mensagem: null,
    estatisticas: {
      mortes: 0, cabecas: 0, tiros: 0, acertos: 0, golpes: 0, tabuasRepostas: 0,
      pontosGanhos: 0, portasAbertas: 0, rodadaMaxima: opcoes.rodada || 1,
    },
    jogador: {
      x: mapa.inicio.x,
      y: mapa.inicio.y,
      ang: 0,
      inclinacao: 0,
      z: CONFIG.alturaDoOlho,
      vida: CONFIG.vidaMaxima,
      vidaMaxima: CONFIG.vidaMaxima,
      semDanoDesde: 99,
      pontos: opcoes.pontos ?? CONFIG.pontosIniciais,
      armas: [equipar('picareta'), equipar('pistola')],
      naMao: 1,
      perks: new Set(),
      talismaGasto: false,
      vigor: CONFIG.vigorMaximo,
      lanterna: true,
      baixado: false,
      sangrando: 0,
      correndo: false,
    },
  };
  refazerFluxo(mapa, jogo.fluxo, jogo.jogador);
  prepararRodada(jogo, jogo.rodada);
  return jogo;
}

export function armaNaMao(jogo) {
  return jogo.jogador.armas[jogo.jogador.naMao];
}

function prepararRodada(jogo, rodada) {
  const composicao = composicaoDaRodada(rodada);
  const fila = [];
  for (let i = 0; i < composicao.comum; i++) fila.push('comum');
  for (let i = 0; i < composicao.rastejante; i++) fila.push('rastejante');
  for (let i = 0; i < composicao.chefe; i++) fila.push('chefe');
  // Embaralha com o sorteio do jogo, e nao com Math.random: a mesma semente
  // tem de dar a mesma partida, senao a prova do robo nao vale nada.
  for (let i = fila.length - 1; i > 0; i--) {
    const j = Math.floor(jogo.sorteio() * (i + 1));
    [fila[i], fila[j]] = [fila[j], fila[i]];
  }
  jogo.aNascer = fila;
  jogo.rodada = rodada;
  jogo.estatisticas.rodadaMaxima = Math.max(jogo.estatisticas.rodadaMaxima, rodada);
  jogo.relogioDeNascimento = 0;
}

// Janelas onde pode nascer: so as que estao em zona aberta. Zumbi nascendo em
// zona fechada seria zumbi que nunca chega — e a rodada nunca fecharia.
export function janelasAtivas(jogo) {
  return jogo.mapa.janelas.filter((janela) => {
    const z = zonaEm(jogo.mapa, janela.dentro.x, janela.dentro.y);
    return z >= 0 && jogo.mapa.zonas[z].aberta;
  });
}

function nascer(jogo) {
  const janelas = janelasAtivas(jogo);
  if (!janelas.length || !jogo.aNascer.length) return;
  if (jogo.vivos.length >= CONFIG.zumbisSimultaneos) return;
  const tipo = jogo.aNascer.shift();
  // Prefere a janela com menos gente na fila: espalha a horda em vez de
  // empilhar tudo numa porta, o que sem isso deixa metade do mapa vazio.
  let escolhida = janelas[0];
  let menos = Infinity;
  for (const janela of janelas) {
    const fila = jogo.vivos.filter(z => z.janela === janela
      && (z.estado === 'esperando' || z.estado === 'arrancando')).length;
    const desempate = fila + jogo.sorteio() * 0.9;
    if (desempate < menos) { menos = desempate; escolhida = janela; }
  }
  jogo.vivos.push(criarZumbi(tipo, jogo.rodada, escolhida, jogo.sorteio));
}

export function passo(jogo, comandos, dt) {
  const eventos = [];
  jogo.eventos = eventos;
  if (jogo.estado === 'morto') return eventos;
  jogo.tempo += dt;
  const j = jogo.jogador;

  // --- jogador ---------------------------------------------------------
  if (comandos.girar) j.ang += comandos.girar;
  if (comandos.inclinar !== undefined) {
    j.inclinacao = Math.max(-0.9, Math.min(0.9, j.inclinacao + comandos.inclinar));
  }
  moverJogador(jogo, comandos, dt);

  j.semDanoDesde += dt;
  if (!j.baixado && j.semDanoDesde > CONFIG.esperaParaRegenerar && j.vida < j.vidaMaxima) {
    j.vida = Math.min(j.vidaMaxima, j.vida + CONFIG.regeneracaoPorSegundo * dt);
  }
  if (j.baixado) {
    j.sangrando -= dt;
    if (j.sangrando <= 0) {
      jogo.estado = 'morto';
      eventos.push({ tipo: 'fim', rodada: jogo.rodada });
      return eventos;
    }
  }

  // --- armas -----------------------------------------------------------
  for (const arma of j.armas) {
    arma.esfriando = Math.max(0, arma.esfriando - dt);
    if (arma.recarregando > 0) {
      arma.recarregando -= dt;
      if (arma.recarregando <= 0) concluirRecarga(arma);
    }
  }
  if (comandos.trocar) trocarArma(jogo, eventos);
  if (comandos.recarregar) iniciarRecarga(jogo, eventos);
  if (comandos.atirar) atirar(jogo, eventos);
  // Uso tem travamento, e isto foi um defeito de verdade que o robo achou: sem
  // ele, segurar a tecla comprava municao sessenta vezes por segundo. O robo
  // ficou parado na parede da pineira gastando tudo que ganhava e morreu na
  // rodada 7 com o mapa fechado — o jogo estava vendendo em loop.
  jogo.relogioDeUso = Math.max(0, (jogo.relogioDeUso || 0) - dt);
  if (comandos.usar && jogo.relogioDeUso <= 0) {
    const antes = eventos.length;
    usar(jogo, eventos);
    const agiu = eventos.slice(antes).some(e => e.tipo !== 'negado');
    if (agiu) jogo.relogioDeUso = 0.6;
  }

  // --- zumbis ----------------------------------------------------------
  // O campo de fluxo e refeito quatro vezes por segundo: e o suficiente para a
  // horda parecer que sabe onde voce esta, e barato o bastante para a rodada 30.
  jogo.relogioDoFluxo = (jogo.relogioDoFluxo || 0) - dt;
  if (jogo.relogioDoFluxo <= 0) {
    jogo.relogioDoFluxo = 0.25;
    refazerFluxo(jogo.mapa, jogo.fluxo, j);
  }

  const ctx = { mapa: jogo.mapa, fluxo: jogo.fluxo, jogador: j, sorteio: jogo.sorteio };
  for (const z of jogo.vivos) {
    if (z.estado === 'morto') continue;
    for (const evento of passoDoZumbi(z, ctx, dt)) {
      if (evento.tipo === 'mordida') morder(jogo, evento, eventos);
      else eventos.push(evento);
    }
  }
  separarZumbis(jogo);
  jogo.vivos = jogo.vivos.filter(z => z.estado !== 'morto');

  // --- rodada ----------------------------------------------------------
  if (jogo.faseDaRodada === 'intervalo') {
    jogo.relogioDaFase -= dt;
    if (jogo.relogioDaFase <= 0) {
      jogo.faseDaRodada = 'correndo';
      eventos.push({ tipo: 'rodada', rodada: jogo.rodada, chefe: jogo.rodada % RODADA_DO_CHEFE === 0 });
    }
  } else {
    jogo.relogioDeNascimento -= dt;
    if (jogo.relogioDeNascimento <= 0) {
      jogo.relogioDeNascimento = intervaloDeNascimento(jogo.rodada);
      nascer(jogo);
    }
    if (!jogo.aNascer.length && !jogo.vivos.length) {
      jogo.faseDaRodada = 'intervalo';
      jogo.relogioDaFase = TEMPO_ENTRE_RODADAS;
      eventos.push({ tipo: 'rodada-vencida', rodada: jogo.rodada });
      prepararRodada(jogo, jogo.rodada + 1);
    }
  }
  return eventos;
}

function moverJogador(jogo, comandos, dt) {
  const j = jogo.jogador;
  let frente = (comandos.frente ? 1 : 0) - (comandos.tras ? 1 : 0);
  let lado = (comandos.dir ? 1 : 0) - (comandos.esq ? 1 : 0);
  const querCorrer = !!comandos.correr && frente > 0 && !j.baixado;
  if (querCorrer && j.vigor > 0) {
    j.vigor = Math.max(0, j.vigor - dt);
    j.correndo = true;
  } else {
    j.vigor = Math.min(CONFIG.vigorMaximo, j.vigor + CONFIG.vigorPorSegundo * dt);
    j.correndo = false;
  }
  const base = j.baixado ? CONFIG.velocidadeSangrando
    : j.correndo ? CONFIG.velocidadeCorrendo : CONFIG.velocidadeAndando;
  const norma = Math.hypot(frente, lado) || 1;
  frente /= norma;
  lado /= norma;
  // A DIREITA do jogador e (sin ang, -cos ang): produto vetorial da frente
  // (cos, sin, 0) com o "para cima" do mundo (0, 0, 1). A primeira versao usava
  // (-sin, cos), que e a ESQUERDA — apertar D andava para a esquerda da tela, e
  // nenhuma prova pegava porque o mapeamento morava no arquivo de DOM.
  const cos = Math.cos(j.ang);
  const sen = Math.sin(j.ang);
  const dx = (cos * frente + sen * lado) * base * dt;
  const dy = (sen * frente - cos * lado) * base * dt;
  mover(jogo.mapa, j, dx, dy, CONFIG.raioDoJogador);
}

// Zumbis nao se atravessam. Sem isso, seis zumbis chegam como um zumbi so e
// cerco deixa de existir.
function separarZumbis(jogo) {
  const vivos = jogo.vivos;
  for (let i = 0; i < vivos.length; i++) {
    const a = vivos[i];
    if (a.estado === 'esperando' || a.estado === 'arrancando' || a.estado === 'entrando') continue;
    for (let k = i + 1; k < vivos.length; k++) {
      const b = vivos[k];
      if (b.estado === 'esperando' || b.estado === 'arrancando' || b.estado === 'entrando') continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minimo = a.raio + b.raio;
      const d = Math.hypot(dx, dy);
      if (d >= minimo || d < 1e-6) continue;
      const sobra = (minimo - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * sobra;
      a.y -= ny * sobra;
      b.x += nx * sobra;
      b.y += ny * sobra;
    }
  }
}

function morder(jogo, evento, eventos) {
  const j = jogo.jogador;
  if (j.baixado) return;
  j.vida -= evento.dano;
  j.semDanoDesde = 0;
  eventos.push({ tipo: 'dano', dano: evento.dano, vida: j.vida });
  if (j.vida > 0) return;
  j.vida = 0;
  if (j.perks.has('talisma') && !j.talismaGasto) {
    // O talisma levanta uma vez e some: e a diferenca entre um erro e o fim.
    j.talismaGasto = true;
    j.perks.delete('talisma');
    j.vida = CONFIG.vidaAoLevantar;
    eventos.push({ tipo: 'levantou', por: 'talisma' });
    return;
  }
  j.baixado = true;
  j.sangrando = CONFIG.tempoDeSangramento;
  eventos.push({ tipo: 'baixado' });
}

// --------------------------------------------------------------- armas

function trocarArma(jogo, eventos) {
  const j = jogo.jogador;
  j.naMao = (j.naMao + 1) % j.armas.length;
  eventos.push({ tipo: 'trocou', arma: armaNaMao(jogo).nome });
}

function cadenciaEfetiva(jogo, arma) {
  const bonus = jogo.jogador.perks.has('gatilho')
    ? CONFIG.multiplicadorDeCadenciaDoGatilho : 1;
  return arma.cadencia * bonus;
}

function iniciarRecarga(jogo, eventos) {
  const arma = armaNaMao(jogo);
  if (arma.tipo === 'corpo' || arma.recarregando > 0) return;
  if (arma.noPente >= arma.pente) { eventos.push({ tipo: 'aviso', texto: TEXTOS.penteCheio }); return; }
  if (arma.naReserva <= 0) { eventos.push({ tipo: 'aviso', texto: 'SEM MUNICAO' }); return; }
  const divisor = jogo.jogador.perks.has('graxa') ? CONFIG.multiplicadorDeRecargaDaGraxa : 1;
  arma.recarregando = arma.recarga / divisor;
  eventos.push({ tipo: 'recarga', arma: arma.nome });
}

function concluirRecarga(arma) {
  const falta = arma.pente - arma.noPente;
  const posso = Math.min(falta, arma.naReserva);
  arma.noPente += posso;
  arma.naReserva -= posso;
  arma.recarregando = 0;
}

function atirar(jogo, eventos) {
  const j = jogo.jogador;
  const arma = armaNaMao(jogo);
  if (arma.recarregando > 0 || arma.esfriando > 0) return;
  if (arma.tipo !== 'corpo' && arma.noPente <= 0) {
    eventos.push({ tipo: 'vazio' });
    arma.esfriando = 0.35;
    iniciarRecarga(jogo, eventos);
    return;
  }
  arma.esfriando = 1 / cadenciaEfetiva(jogo, arma);
  if (arma.tipo !== 'corpo') arma.noPente -= 1;
  // Golpe nao entra na precisao: precisao e quantos dos seus TIROS acertaram, e
  // picareta varre um arco de 100 graus. Somar os dois dava um numero que subia
  // quando o jogador batia no escuro sem mirar em nada.

  const direcao = { x: Math.cos(j.ang), y: Math.sin(j.ang), z: j.inclinacao };
  const origem = { x: j.x, y: j.y, z: j.baixado ? 0.5 : CONFIG.alturaDoOlho };
  const alvos = jogo.vivos.filter(z => z.estado !== 'morto').map(comoAlvo);
  // Golpe e tiro sao caminhos diferentes, e o evento tambem: quem desenha e
  // quem toca som precisa saber que nao houve disparo — a picareta nao tem
  // clarao de cano nem estouro.
  const corpoACorpo = arma.tipo === 'corpo';
  if (corpoACorpo) jogo.estatisticas.golpes++;
  else jogo.estatisticas.tiros++;
  const acertos = corpoACorpo
    ? golpear((x, y) => solidoParaTiro(jogo.mapa, x, y), origem, direcao, arma, alvos)
    : tracar((x, y) => solidoParaTiro(jogo.mapa, x, y), origem, direcao, arma, alvos, jogo.sorteio);
  eventos.push({
    tipo: corpoACorpo ? 'golpe' : 'tiro',
    arma: arma.chave,
    acertos: acertos.length,
  });

  const jaContado = new Set();
  for (const acerto of acertos) {
    const z = jogo.vivos.find(v => v.id === acerto.alvo.id);
    if (!z || z.estado === 'morto') continue;
    const alturaRelativa = 0.5;
    const resultado = ferir(z, acerto.dano, acerto.naCabeca, acerto.naCabeca ? 1 : alturaRelativa);
    if (resultado.aplicado <= 0) continue;
    if (!jaContado.has(z.id)) {
      jaContado.add(z.id);
      jogo.estatisticas.acertos++;
      ganhar(jogo, CONFIG.pontosPorAcerto);
    }
    eventos.push({
      tipo: 'acerto', zumbi: z, naCabeca: acerto.naCabeca, dano: resultado.aplicado,
      distancia: acerto.distancia,
    });
    if (resultado.morreu) {
      jogo.estatisticas.mortes++;
      if (acerto.naCabeca) jogo.estatisticas.cabecas++;
      ganhar(jogo, acerto.naCabeca ? CONFIG.pontosPorCabeca : CONFIG.pontosPorMorte);
      eventos.push({ tipo: 'morte', zumbi: z, naCabeca: acerto.naCabeca });
    }
  }
}

function ganhar(jogo, pontos) {
  jogo.jogador.pontos += pontos;
  jogo.estatisticas.pontosGanhos += pontos;
}

// ------------------------------------------------------------ interacao

// O que esta ao alcance da mao, em ordem de prioridade. O HUD mostra o primeiro
// item desta lista, e a tecla de usar age nele: uma tecla, uma acao, sem menu.
export function alvoDeUso(jogo) {
  const j = jogo.jogador;
  const perto = [];

  for (const maquina of jogo.mapa.maquinas) {
    const d = Math.hypot(maquina.x - j.x, maquina.y - j.y);
    if (d <= CONFIG.alcanceDeUso) perto.push({ tipo: 'maquina', maquina, d });
  }
  for (const janela of jogo.mapa.janelas) {
    if (janela.tabuas >= CONFIG.tabuasPorJanela) continue;
    const d = Math.hypot(janela.dentro.x + 0.5 - j.x, janela.dentro.y + 0.5 - j.y);
    if (d <= CONFIG.alcanceDeUso) perto.push({ tipo: 'janela', janela, d });
  }
  // Porta: as fechadas dentro do alcance da mao, escolhida a que esta mais na
  // direcao do olhar. A primeira versao sondava uma celula a 1,1 de distancia e
  // so ela — com alcance de uso de 2,6, o jogador (e o robo) ficava do lado da
  // porta, olhando para ela, sem conseguir abrir, porque a sonda caia na parede
  // ao lado. O robo achou isso ficando 400 segundos parado com 11 mil pontos.
  for (const porta of jogo.mapa.portas.values()) {
    if (porta.aberta) continue;
    const dx = porta.x + 0.5 - j.x;
    const dy = porta.y + 0.5 - j.y;
    const d = Math.hypot(dx, dy);
    if (d > CONFIG.alcanceDeUso) continue;
    const rumo = Math.atan2(dy, dx);
    const desvio = Math.abs(Math.atan2(Math.sin(rumo - j.ang), Math.cos(rumo - j.ang)));
    if (desvio > 1.1) continue;
    perto.push({ tipo: 'porta', porta, d: d + desvio * 0.4 });
  }

  perto.sort((a, b) => a.d - b.d);
  return perto[0] || null;
}

export function textoDoAlvo(jogo, alvo) {
  if (!alvo) return null;
  if (alvo.tipo === 'porta') return `ABRIR POR ${alvo.porta.custo}`;
  if (alvo.tipo === 'janela') return 'REPOR TABUA';
  const q = alvo.maquina;
  if (q.tipo === 'arma') {
    const base = ARMAS[q.arma];
    const tem = jogo.jogador.armas.find(a => a.chave === q.arma || a.chave === `${q.arma}-forjada`);
    return tem ? `${base.nome}: MUNICAO POR ${custoDaMunicao(base)}` : `${base.nome} POR ${base.custo}`;
  }
  if (q.tipo === 'caixa') return `CAIXA POR ${CONFIG.custoDaCaixa}`;
  if (q.tipo === 'forja') return `FORJAR POR ${CONFIG.custoDaForja}`;
  if (q.tipo === 'forca') return jogo.forcaLigada ? TEXTOS.forcaLigada : 'LIGAR A FORCA';
  if (q.tipo === 'perk') {
    const perk = CONFIG.perks[q.perk];
    return `${perk.nome} POR ${perk.custo} — ${perk.descricao}`;
  }
  return null;
}

function usar(jogo, eventos) {
  const alvo = alvoDeUso(jogo);
  if (!alvo) return;
  const j = jogo.jogador;

  if (alvo.tipo === 'porta') {
    if (j.pontos < alvo.porta.custo) { eventos.push({ tipo: 'negado', texto: TEXTOS.semPontos }); return; }
    j.pontos -= alvo.porta.custo;
    abrirPorta(jogo.mapa, alvo.porta);
    jogo.estatisticas.portasAbertas++;
    refazerFluxo(jogo.mapa, jogo.fluxo, j);
    eventos.push({ tipo: 'porta-aberta', porta: alvo.porta });
    return;
  }

  if (alvo.tipo === 'janela') {
    alvo.janela.tabuas = Math.min(CONFIG.tabuasPorJanela, alvo.janela.tabuas + 1);
    jogo.estatisticas.tabuasRepostas++;
    ganhar(jogo, CONFIG.pontosPorTabuaReposta);
    eventos.push({ tipo: 'tabua-reposta', janela: alvo.janela });
    return;
  }

  const q = alvo.maquina;
  if (q.tipo === 'forca') {
    if (jogo.forcaLigada) return;
    jogo.forcaLigada = true;
    for (const outra of jogo.mapa.maquinas) {
      if (outra.tipo === 'perk' || outra.tipo === 'forja') outra.ligada = true;
    }
    eventos.push({ tipo: 'forca', texto: TEXTOS.forcaLigada });
    return;
  }

  if (q.tipo === 'perk' || q.tipo === 'forja') {
    if (!jogo.forcaLigada) { eventos.push({ tipo: 'negado', texto: TEXTOS.precisaDeForca }); return; }
  }

  if (q.tipo === 'arma') {
    const base = ARMAS[q.arma];
    const tem = j.armas.findIndex(a => a.chave === q.arma || a.chave === `${q.arma}-forjada`);
    if (tem >= 0) {
      const custo = custoDaMunicao(base);
      if (j.pontos < custo) { eventos.push({ tipo: 'negado', texto: TEXTOS.semPontos }); return; }
      j.pontos -= custo;
      j.armas[tem].naReserva = j.armas[tem].reserva;
      eventos.push({ tipo: 'municao', arma: base.nome });
      return;
    }
    if (j.pontos < base.custo) { eventos.push({ tipo: 'negado', texto: TEXTOS.semPontos }); return; }
    j.pontos -= base.custo;
    // A picareta nunca e trocada: ela e o plano de emergencia, e trocar ela por
    // engano seria perder o unico recurso infinito do jogo.
    const slot = j.naMao === 0 ? 1 : j.naMao;
    j.armas[slot] = equipar(q.arma);
    j.naMao = slot;
    eventos.push({ tipo: 'comprou', arma: base.nome });
    return;
  }

  if (q.tipo === 'caixa') {
    if (j.pontos < CONFIG.custoDaCaixa) { eventos.push({ tipo: 'negado', texto: TEXTOS.semPontos }); return; }
    j.pontos -= CONFIG.custoDaCaixa;
    const sorteada = ARMAS_DA_CAIXA[Math.floor(jogo.sorteio() * ARMAS_DA_CAIXA.length)];
    const slot = j.naMao === 0 ? 1 : j.naMao;
    j.armas[slot] = equipar(sorteada);
    j.naMao = slot;
    eventos.push({ tipo: 'caixa', arma: ARMAS[sorteada].nome });
    return;
  }

  if (q.tipo === 'forja') {
    const arma = armaNaMao(jogo);
    if (arma.tipo === 'corpo' || arma.forjada) { eventos.push({ tipo: 'negado', texto: 'NAO FORJA' }); return; }
    if (j.pontos < CONFIG.custoDaForja) { eventos.push({ tipo: 'negado', texto: TEXTOS.semPontos }); return; }
    j.pontos -= CONFIG.custoDaForja;
    const forjada = equiparForjada(arma.chave);
    j.armas[j.naMao] = forjada;
    eventos.push({ tipo: 'forjou', arma: forjada.nome });
    return;
  }

  if (q.tipo === 'perk') {
    const perk = CONFIG.perks[q.perk];
    if (j.perks.has(q.perk)) { eventos.push({ tipo: 'negado', texto: 'JA TEM' }); return; }
    if (j.perks.size >= 4) { eventos.push({ tipo: 'negado', texto: 'MAOS CHEIAS' }); return; }
    if (j.pontos < perk.custo) { eventos.push({ tipo: 'negado', texto: TEXTOS.semPontos }); return; }
    j.pontos -= perk.custo;
    j.perks.add(q.perk);
    if (q.perk === 'caldo') {
      j.vidaMaxima = CONFIG.vidaMaxima * CONFIG.multiplicadorDeVidaDoCaldo;
      j.vida = j.vidaMaxima;
    }
    if (q.perk === 'talisma') j.talismaGasto = false;
    eventos.push({ tipo: 'perk', perk: perk.nome });
  }
}

// ------------------------------------------------------- apoio a provas

export function zumbisVivos(jogo) {
  return jogo.vivos.filter(z => z.estado !== 'morto');
}

export function tabuasDeTodasAsJanelas(jogo) {
  return jogo.mapa.janelas.reduce((s, janela) => s + janela.tabuas, 0);
}

export function resumo(jogo) {
  return {
    rodada: jogo.rodada,
    estado: jogo.estado,
    vida: Math.round(jogo.jogador.vida),
    pontos: jogo.jogador.pontos,
    vivos: zumbisVivos(jogo).length,
    aNascer: jogo.aNascer.length,
    perks: [...jogo.jogador.perks],
    arma: armaNaMao(jogo).nome,
    ...jogo.estatisticas,
  };
}

export { PLANTAS, chave, solido };
