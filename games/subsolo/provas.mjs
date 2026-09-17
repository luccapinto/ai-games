#!/usr/bin/env node
// As provas do SUBSOLO. Rode com: node provas.mjs
//
// Sobrevivencia por rodadas e o genero em que "parece bom" mente mais: uma
// rodada que nunca fecha parece dificil, um mapa sem volta parece apertado, uma
// arma que domina todos os eixos parece boa, e um zumbi preso na quina parece
// ausente. Aqui o mapa, as rodadas, as armas, a economia e um robo que joga
// rodam sem navegador — e e por isso que da para medir em vez de achar.
//
// A prova principal e o robo: ele le o mesmo estado que a tela mostra, manda os
// mesmos comandos que o teclado manda, e nao ve atraves de parede. Se ele
// atravessa cinco rodadas nos dois mapas, com portas abertas e forca ligada, o
// jogo e jogavel — e se ele morre parado com pontos no bolso, o defeito esta na
// economia.

import { PLANTAS } from './js/planta.js';
import {
  carregar, maiorVolta, janelasSemCaminho, maquinasSemCaminho, celulasAbertas,
  custoParaAbrirTudo, solido, solidoParaTiro, luzDaCelula, T, tile, zonaEm,
  criarFluxo, refazerFluxo, distanciaDoFluxo,
} from './js/mapa.js';
import { CONFIG } from './js/regras.js';
import {
  quantidadeDaRodada, vidaDaRodada, velocidadeDaRodada, intervaloDeNascimento,
  composicaoDaRodada, RODADA_DO_CHEFE, RODADA_DOS_RASTEJANTES, TIPOS,
} from './js/rodadas.js';
import {
  ARMAS, equipar, forjar, danoPorSegundo, danoPorSegundoNaCabeca, danoNaDistancia,
  paredeNaLinha, tracar, custoDaMunicao,
} from './js/armas.js';
import {
  criarJogo, passo, armaNaMao, alvoDeUso, textoDoAlvo, zumbisVivos,
  janelasAtivas, tabuasDeTodasAsJanelas, resumo,
} from './js/jogo.js';
import { criarZumbi, ferir, comoAlvo } from './js/zumbis.js';
import { giroDoMouse, inclinacaoDoMouse, comandosDeTeclas } from './js/entrada.js';
import { jogarAte } from './js/robo.js';

let feitas = 0;
const falhas = [];

function prova(nome, fn) {
  try {
    fn();
    feitas++;
    process.stdout.write('.');
  } catch (erro) {
    falhas.push({ nome, erro });
    process.stdout.write('x');
  }
}

async function provaAssincrona(nome, fn) {
  try {
    await fn();
    feitas++;
    process.stdout.write('.');
  } catch (erro) {
    falhas.push({ nome, erro });
    process.stdout.write('x');
  }
}

const ok = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m) => { if (a !== b) throw new Error(`${m}: esperava ${b}, veio ${a}`); };
function entre(v, min, max, m) {
  if (!(v >= min && v <= max)) throw new Error(`${m}: ${Number(v).toFixed(3)} fora de [${min}, ${max}]`);
}

const mapas = PLANTAS.map(carregar);
const DT = 1 / 60;

// ------------------------------------------------------- 1. os mapas

prova('a planta e retangular e a legenda e conhecida', () => {
  const legenda = new Set('#=%.~oJ@1234SNCGXFVRTAL'.split(''));
  for (const planta of PLANTAS) {
    const larguras = new Set(planta.planta.map(l => l.length));
    igual(larguras.size, 1, `${planta.nome}: linhas de larguras diferentes`);
    for (const [y, linha] of planta.planta.entries()) {
      for (const [x, ch] of [...linha].entries()) {
        ok(legenda.has(ch), `${planta.nome}: caractere '${ch}' desconhecido em ${x},${y}`);
      }
    }
    igual(planta.planta.filter(l => l.includes('@')).length, 1,
      `${planta.nome}: precisa de exatamente uma linha com inicio`);
  }
});

prova('cada mapa tem quatro zonas e quatro vaos comprados', () => {
  for (const m of mapas) {
    igual(m.zonas.length, 4, `${m.nome}: zonas`);
    const marcas = new Set([...m.portas.values()].map(p => p.marca));
    igual(marcas.size, 4, `${m.nome}: vaos de porta distintos`);
    ok(m.zonas[m.zonaInicial].aberta, `${m.nome}: a zona do inicio nao comecou aberta`);
    igual(m.zonas.filter(z => z.aberta).length, 1, `${m.nome}: zonas abertas no comeco`);
  }
});

prova('porta liga duas zonas diferentes', () => {
  // Porta que liga a mesma zona dos dois lados e porta decorativa: o jogador
  // pagaria por nada, e a prova nao deixa isso entrar no mapa.
  for (const m of mapas) {
    for (const porta of m.portas.values()) {
      ok(porta.zonas.length >= 2,
        `${m.nome}: porta ${porta.marca} em ${porta.x},${porta.y} liga ${porta.zonas.length} zona(s)`);
    }
  }
});

prova('toda janela tem lado de dentro e alcanca o jogador', () => {
  for (const m of mapas) {
    ok(m.janelas.length >= 8, `${m.nome}: so ${m.janelas.length} janelas`);
    for (const janela of m.janelas) {
      ok(janela.dentro, `${m.nome}: janela em ${janela.x},${janela.y} sem lado de dentro`);
      ok(janela.fora, `${m.nome}: janela em ${janela.x},${janela.y} sem lado de fora`);
    }
    const ruins = janelasSemCaminho(m);
    igual(ruins.length, 0,
      `${m.nome}: ${ruins.length} janela(s) sem caminho ate o jogador`);
  }
});

prova('toda maquina e alcancavel, e cada tipo existe', () => {
  for (const m of mapas) {
    igual(maquinasSemCaminho(m).length, 0, `${m.nome}: maquina inalcancavel`);
    const tipos = new Set(m.maquinas.map(q => (q.tipo === 'perk' ? `perk:${q.perk}` : q.tipo)));
    for (const exigido of ['forca', 'caixa', 'forja', 'perk:caldo', 'perk:graxa',
      'perk:gatilho', 'perk:talisma']) {
      ok(tipos.has(exigido), `${m.nome}: falta ${exigido}`);
    }
    ok(m.maquinas.filter(q => q.tipo === 'arma').length >= 3,
      `${m.nome}: menos de tres armas de parede`);
  }
});

prova('existe volta, e ela cruza o mapa', () => {
  // A volta e o que faz arrastar horda ser tatica em vez de sorte. Sem ciclo, a
  // rodada 12 mata todo mundo no mesmo canto, sempre.
  for (const m of mapas) {
    const volta = maiorVolta(m);
    ok(volta.tamanho >= 120,
      `${m.nome}: a maior volta tem ${volta.tamanho} celulas`);
    ok(volta.zonas >= 3,
      `${m.nome}: a volta passa por ${volta.zonas} zona(s), e o anel precisa de tres`);
  }
});

prova('o mapa cabe no bolso de uma partida', () => {
  for (const m of mapas) {
    entre(custoParaAbrirTudo(m), 2000, 8000, `${m.nome}: custo de abrir tudo`);
    entre(celulasAbertas(m), 300, 900, `${m.nome}: celulas de piso`);
  }
});

prova('janela e parede para o corpo e vao para a bala', () => {
  // E a diferenca entre poder segurar uma janela e nao poder, e ela vale uma
  // prova porque o codigo tem dois predicados que poderiam divergir.
  for (const m of mapas) {
    const janela = m.janelas[0];
    ok(solido(m, janela.x + 0.5, janela.y + 0.5),
      `${m.nome}: a janela deixou o corpo passar`);
    ok(!solidoParaTiro(m, janela.x + 0.5, janela.y + 0.5),
      `${m.nome}: a janela bloqueou a bala`);
    igual(tile(m, janela.x, janela.y), T.JANELA, `${m.nome}: tipo da celula da janela`);
  }
});

prova('as lampadas acendem parte do mapa, e nao tudo', () => {
  for (const m of mapas) {
    let acesas = 0;
    let piso = 0;
    for (let y = 0; y < m.altura; y++) {
      for (let x = 0; x < m.largura; x++) {
        if (solido(m, x + 0.5, y + 0.5)) continue;
        piso++;
        if (luzDaCelula(m, x, y) > 0.12) acesas++;
      }
    }
    const fracao = acesas / piso;
    entre(fracao, 0.1, 0.75, `${m.nome}: fracao de piso iluminado`);
  }
});

// -------------------------------------------------- 2. a escada de rodadas

prova('quantidade, vida e velocidade so crescem', () => {
  for (let r = 2; r <= 40; r++) {
    ok(quantidadeDaRodada(r) >= quantidadeDaRodada(r - 1),
      `rodada ${r}: quantidade caiu`);
    ok(vidaDaRodada(r) > vidaDaRodada(r - 1), `rodada ${r}: vida caiu`);
    ok(velocidadeDaRodada(r) >= velocidadeDaRodada(r - 1), `rodada ${r}: velocidade caiu`);
    ok(intervaloDeNascimento(r) <= intervaloDeNascimento(r - 1),
      `rodada ${r}: intervalo de nascimento subiu`);
  }
  entre(quantidadeDaRodada(1), 4, 8, 'zumbis da primeira rodada');
  entre(vidaDaRodada(1), 100, 200, 'vida da primeira rodada');
  entre(quantidadeDaRodada(40), 25, 40, 'zumbis da rodada 40');
});

prova('a rodada 15 anda mais rapido que o jogador andando', () => {
  // E o degrau que faz correr deixar de ser opcional. Se o zumbi nunca passa da
  // velocidade de caminhada, arrastar horda vira automatico.
  ok(velocidadeDaRodada(15) > CONFIG.velocidadeAndando * 0.9,
    `rodada 15 corre a ${velocidadeDaRodada(15)} e o jogador anda a ${CONFIG.velocidadeAndando}`);
  ok(velocidadeDaRodada(40) < CONFIG.velocidadeCorrendo,
    'o zumbi da rodada 40 corre mais que o jogador correndo: nao ha fuga');
});

prova('a composicao soma o total, e o chefe aparece na hora', () => {
  for (let r = 1; r <= 30; r++) {
    const c = composicaoDaRodada(r);
    igual(c.comum + c.rastejante + c.chefe, c.total, `rodada ${r}: composicao nao soma`);
    ok(c.total > 0, `rodada ${r}: rodada vazia`);
    if (r % RODADA_DO_CHEFE === 0) ok(c.chefe >= 1, `rodada ${r} devia ter chefe`);
    else igual(c.chefe, 0, `rodada ${r} nao devia ter chefe`);
    if (r % RODADA_DOS_RASTEJANTES === 0) ok(c.rastejante >= 1, `rodada ${r} devia ter rastejante`);
  }
});

prova('o chefe e outro bicho, e nao um zumbi com mais vida', () => {
  ok(TIPOS.chefe.blindagem > 0.3, 'o chefe nao tem blindagem');
  ok(TIPOS.chefe.velocidade < TIPOS.comum.velocidade, 'o chefe nao e mais lento');
  ok(TIPOS.chefe.dano > TIPOS.comum.dano * 1.5, 'o chefe nao bate mais forte');
  const chefe = criarZumbi('chefe', 10, mapas[0].janelas[0]);
  const noCorpo = ferir({ ...chefe }, 1000, false, 0.5);
  const naCabeca = ferir({ ...chefe }, 1000, true, 1);
  ok(naCabeca.aplicado > noCorpo.aplicado * 1.6,
    `blindagem nao muda nada: corpo ${noCorpo.aplicado} contra cabeca ${naCabeca.aplicado}`);
});

// ------------------------------------------------------------ 3. as armas

prova('nenhuma arma ganha em todos os eixos', () => {
  // Se uma arma dominar perto, longe, pente e preco, a escolha morre — e o jogo
  // passa a ser "junte pontos e compre a melhor".
  const chaves = Object.keys(ARMAS).filter(k => ARMAS[k].tipo !== 'corpo');
  for (const a of chaves) {
    for (const b of chaves) {
      if (a === b) continue;
      const A = ARMAS[a];
      const B = ARMAS[b];
      // Quatro eixos, e o de cabeca a distancia entra porque e nele que a
      // carabina existe: comparar so dano de corpo dizia que a pineira
      // dominava tudo.
      const domina = danoPorSegundo(A, 2) > danoPorSegundo(B, 2)
        && danoPorSegundoNaCabeca(A, 18) > danoPorSegundoNaCabeca(B, 18)
        && A.pente >= B.pente
        && A.custo <= B.custo;
      ok(!domina, `${A.nome} domina ${B.nome} em todos os eixos`);
    }
  }
});

prova('cada arma tem o eixo dela', () => {
  const perto = (k) => danoPorSegundo(ARMAS[k], 2);
  const longe = (k) => danoPorSegundo(ARMAS[k], 20);
  // A espingarda tem de ser a maior de perto entre TODAS, e nao so maior que
  // uma: e esse o eixo dela, e comparar com uma arma so deixava a tabela passar
  // com a espingarda em segundo lugar.
  const maiorDePerto = Object.keys(ARMAS)
    .filter(k => ARMAS[k].tipo !== 'corpo')
    .sort((a, b) => perto(b) - perto(a))[0];
  igual(maiorDePerto, 'espingarda',
    `de perto quem ganha e ${ARMAS[maiorDePerto].nome}`);
  ok(longe('espingarda') === 0, 'a espingarda alcanca 20 m');
  const cabecaLonge = (k) => danoPorSegundoNaCabeca(ARMAS[k], 18);
  ok(cabecaLonge('carabina') > cabecaLonge('pineira') * 1.3,
    'a carabina nao ganha de longe mirando na cabeca');
  // O eixo do macarico nao e dano num zumbi: e dano em QUATRO. Ele atravessa
  // (penetracao 3) e a chama nao escolhe alvo, entao a conta que vale e dano
  // por segundo vezes quantos ele pega junto.
  const emCerco = (k) => perto(k) * (1 + ARMAS[k].penetracao);
  const maiorEmCerco = Object.keys(ARMAS)
    .filter(k => ARMAS[k].tipo !== 'corpo')
    .sort((a, b) => emCerco(b) - emCerco(a))[0];
  igual(maiorEmCerco, 'macarico', `em cerco quem ganha e ${ARMAS[maiorEmCerco].nome}`);
  ok(ARMAS.macarico.alcance < 7, 'o macarico alcanca longe demais');
  ok(ARMAS.pineira.pente > ARMAS.carabina.pente * 3, 'a pineira nao sustenta fluxo');
});

prova('cabeca paga, distancia cobra, alcance corta', () => {
  for (const chave of Object.keys(ARMAS)) {
    const arma = ARMAS[chave];
    ok(arma.cabeca > 1, `${arma.nome}: cabeca nao paga`);
    igual(danoNaDistancia(arma, arma.alcance + 0.1), 0, `${arma.nome}: passou do alcance`);
    const cheio = danoNaDistancia(arma, arma.alcance * 0.3);
    const longe = danoNaDistancia(arma, arma.alcance * 0.95);
    ok(longe < cheio, `${arma.nome}: dano nao cai com a distancia`);
    ok(longe > 0, `${arma.nome}: dano zerou antes do alcance`);
  }
});

prova('parede para a bala, e a penetracao tem limite', () => {
  const solidoFalso = (x) => x > 4 && x < 6;
  ok(paredeNaLinha(solidoFalso, { x: 0, y: 0 }, { x: 10, y: 0 }), 'a bala atravessou a parede');
  ok(!paredeNaLinha(solidoFalso, { x: 0, y: 0 }, { x: 4, y: 0 }), 'a bala parou sem parede');

  const semParede = () => false;
  const fila = [];
  for (let i = 0; i < 6; i++) {
    fila.push({ id: i + 1, x: 2 + i * 1.5, y: 0, raio: 0.5, altura: 1.8 });
  }
  const arma = { ...ARMAS.carabina, espalhamento: 0, pelotas: 1 };
  const acertos = tracar(semParede, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, arma, fila, () => 0.5);
  igual(acertos.length, 1 + arma.penetracao, 'penetracao nao respeitou o limite');
  const alvosAtingidos = acertos.map(a => a.alvo.id);
  igual(alvosAtingidos[0], 1, 'a bala nao atingiu o mais perto primeiro');
});

prova('a espingarda espalha e a carabina nao', () => {
  const semParede = () => false;
  const alvo = [{ id: 1, x: 8, y: 0, raio: 0.5, altura: 1.8 }];
  let acertosEspingarda = 0;
  let acertosCarabina = 0;
  for (let i = 0; i < 40; i++) {
    const sorteio = () => (i % 7) / 7;
    acertosEspingarda += tracar(semParede, { x: 0, y: 0, z: 1.6 }, { x: 1, y: 0, z: -0.09 },
      equipar('espingarda'), alvo, sorteio).length;
    acertosCarabina += tracar(semParede, { x: 0, y: 0, z: 1.6 }, { x: 1, y: 0, z: -0.09 },
      equipar('carabina'), alvo, sorteio).length;
  }
  ok(acertosEspingarda > acertosCarabina,
    `espingarda ${acertosEspingarda} contra carabina ${acertosCarabina} pelotas no alvo`);
});

prova('a forja muda a arma de verdade', () => {
  for (const chave of Object.keys(ARMAS)) {
    const forjada = forjar(chave);
    if (ARMAS[chave].tipo === 'corpo') { igual(forjada, null, 'a picareta forjou'); continue; }
    ok(forjada.dano > ARMAS[chave].dano * 2, `${chave}: a forja nao dobrou o dano`);
    ok(forjada.pente > ARMAS[chave].pente, `${chave}: a forja nao aumentou o pente`);
    ok(forjada.nome !== ARMAS[chave].nome, `${chave}: a forja nao mudou o nome`);
  }
});

prova('a arma da rodada 25 existe', () => {
  // Sem isso o jogo tem teto invisivel: chega uma rodada em que nada mata, e o
  // jogador perde sem entender por que.
  const vida = vidaDaRodada(25);
  const forjada = forjar('carabina');
  const tirosNaCabeca = Math.ceil(vida / (forjada.dano * forjada.cabeca));
  ok(tirosNaCabeca <= forjada.pente,
    `a rodada 25 (vida ${vida}) pede ${tirosNaCabeca} tiros de cabeca e o pente tem ${forjada.pente}`);
  ok(tirosNaCabeca <= 4,
    `a rodada 25 (vida ${vida}) pede ${tirosNaCabeca} tiros de cabeca da carabina forjada`);
  const dps = danoPorSegundoNaCabeca(forjada, 8);
  ok(dps > vida / 2,
    `a carabina forjada faz ${dps.toFixed(0)} de dano de cabeca por segundo contra ${vida} de vida`);
});

prova('municao de parede custa menos que a arma', () => {
  for (const chave of Object.keys(ARMAS)) {
    const arma = ARMAS[chave];
    if (!arma.custo) continue;
    ok(custoDaMunicao(arma) < arma.custo, `${arma.nome}: municao nao e mais barata`);
  }
});

// ---------------------------------------------- 3b. entrada e mao do mundo

prova('apertar direita anda para a direita da tela', () => {
  // Esta prova existe porque o jogo saiu com as setas e o mouse invertidos, e
  // nenhuma das 36 provas podia ver: o mapeamento de entrada morava em
  // `main.js`, o unico arquivo que este harness nao importa. Agora mora em
  // `entrada.js`, e o sinal e cobrado aqui.
  //
  // A convencao: frente e (cos ang, sin ang), e a direita e o produto vetorial
  // da frente com o "para cima" do mundo, isto e (sin ang, -cos ang).
  for (const ang of [0, 0.7, -1.9, Math.PI]) {
    const jogo = criarJogo(0, { semente: 2, semPreparo: true });
    jogo.jogador.ang = ang;
    const x0 = jogo.jogador.x;
    const y0 = jogo.jogador.y;
    for (let i = 0; i < 20; i++) passo(jogo, { dir: true }, DT);
    const dx = jogo.jogador.x - x0;
    const dy = jogo.jogador.y - y0;
    const direitaX = Math.sin(ang);
    const direitaY = -Math.cos(ang);
    const produto = dx * direitaX + dy * direitaY;
    ok(produto > 0.05,
      `com ang=${ang.toFixed(2)}, apertar direita andou (${dx.toFixed(2)}, ${dy.toFixed(2)}), `
      + `que projeta ${produto.toFixed(2)} na direita da tela`);
  }
});

prova('apertar frente anda para onde o olho aponta', () => {
  for (const ang of [0.4, 2.3, -0.9]) {
    const jogo = criarJogo(0, { semente: 2, semPreparo: true });
    jogo.jogador.ang = ang;
    const x0 = jogo.jogador.x;
    const y0 = jogo.jogador.y;
    for (let i = 0; i < 20; i++) passo(jogo, { frente: true }, DT);
    const produto = (jogo.jogador.x - x0) * Math.cos(ang) + (jogo.jogador.y - y0) * Math.sin(ang);
    ok(produto > 0.05, `com ang=${ang.toFixed(2)}, frente projetou ${produto.toFixed(2)}`);
  }
});

prova('mouse para a direita vira a mira para a direita', () => {
  // Mouse para a direita tem de DIMINUIR `ang`, porque `ang` cresce no sentido
  // anti-horario e anti-horario aparece como esquerda na tela.
  ok(giroDoMouse(100) < 0, 'mouse para a direita nao diminuiu o angulo');
  ok(giroDoMouse(-100) > 0, 'mouse para a esquerda nao aumentou o angulo');
  ok(inclinacaoDoMouse(-100) > 0, 'mouse para cima nao levantou a mira');
  ok(inclinacaoDoMouse(100) < 0, 'mouse para baixo nao baixou a mira');

  // E o giro tem de chegar no jogo com o mesmo sinal.
  const jogo = criarJogo(0, { semente: 2, semPreparo: true });
  jogo.jogador.ang = 0;
  passo(jogo, { girar: giroDoMouse(200) }, DT);
  ok(jogo.jogador.ang < 0, `o angulo foi para ${jogo.jogador.ang.toFixed(3)} com o mouse para a direita`);
});

prova('as teclas viram os comandos que o jogo espera', () => {
  const comandos = comandosDeTeclas(new Set(['KeyW', 'KeyD', 'ShiftLeft']));
  ok(comandos.frente && comandos.dir && comandos.correr, 'W D shift nao viraram frente/direita/correr');
  ok(!comandos.tras && !comandos.esq, 'apareceu comando que ninguem pediu');
  const setas = comandosDeTeclas(new Set(['ArrowLeft', 'ArrowDown']));
  ok(setas.esq && setas.tras, 'as setas nao fazem o mesmo que WASD');
});

prova('quem arranca tabua pode ser alvejado', () => {
  // Defeito visto jogando: o zumbi rasgava a barricada parado na celula de FORA
  // da janela, que e rocha solida para bala. O jogador via o braco entre as
  // tabuas, atirava e nao acontecia nada — a barricada deixava de ser "tempo
  // para atirar" e virava "tempo para nao poder fazer nada". Tabua e vao: quem
  // arranca fica no buraco, e o buraco e o unico lugar por onde o tiro passa.
  const jogo = criarJogo(0, { semente: 3, semPreparo: true });
  const janela = jogo.mapa.janelas[0];
  const z = criarZumbi('comum', 1, janela);
  jogo.vivos.push(z);
  for (let i = 0; i < 20; i++) passo(jogo, {}, DT);
  igual(z.estado, 'arrancando', 'o zumbi nao comecou a arrancar tabua');
  ok(!solidoParaTiro(jogo.mapa, z.x, z.y),
    `o zumbi arrancando esta numa celula solida para bala (${z.x.toFixed(1)}, ${z.y.toFixed(1)})`);

  // E de dentro, com a janela na frente, a bala chega nele.
  const origem = { x: janela.dentro.x + 0.5, y: janela.dentro.y + 0.5, z: CONFIG.alturaDoOlho };
  const distancia = Math.hypot(z.x - origem.x, z.y - origem.y);
  const direcao = { x: (z.x - origem.x) / distancia, y: (z.y - origem.y) / distancia, z: 0 };
  const acertos = tracar(
    (x, y) => solidoParaTiro(jogo.mapa, x, y),
    origem, direcao, ARMAS.pistola, [comoAlvo(z)], () => 0.5,
  );
  ok(acertos.length === 1, 'a bala nao chegou no zumbi que estava na sua janela');
});

prova('a picareta golpeia em arco, e nao atira', () => {
  // Defeito sentido jogando: a picareta usava a funcao de tiro, entao ela
  // acertava um alvo so, ganhava bonus de cabeca pela altura da mira e disparava
  // clarao de cano. Golpe varre um arco e pega todo mundo nele.
  const jogo = criarJogo(0, { semente: 4, semPreparo: true });
  jogo.jogador.naMao = 0;
  jogo.jogador.ang = 0;
  igual(armaNaMao(jogo).tipo, 'corpo', 'a picareta nao esta na mao');

  const alvos = [];
  for (const [dx, dy] of [[1.2, 0], [1.1, 0.7], [1.1, -0.7], [1.4, 2.4]]) {
    const z = criarZumbi('comum', 1, jogo.mapa.janelas[0]);
    z.estado = 'cacando';
    z.vida = 10000;
    z.x = jogo.jogador.x + dx;
    z.y = jogo.jogador.y + dy;
    jogo.vivos.push(z);
    alvos.push(z);
  }
  let golpes = 0;
  let tiros = 0;
  let acertos = 0;
  for (const e of passo(jogo, { atirar: true }, DT)) {
    if (e.tipo === 'golpe') golpes++;
    if (e.tipo === 'tiro') tiros++;
    if (e.tipo === 'acerto') acertos++;
  }
  igual(golpes, 1, 'a picareta nao emitiu evento de golpe');
  igual(tiros, 0, 'a picareta emitiu evento de tiro');
  ok(acertos >= 3, `o golpe pegou ${acertos} zumbis no arco; esperava os tres de perto`);
  ok(alvos[3].vida === 10000, 'o golpe alcancou um zumbi a 2,7 celulas de distancia');
  const arma = armaNaMao(jogo);
  ok(!Number.isFinite(arma.pente) || arma.noPente === arma.pente, 'o golpe gastou municao');
  // Precisao e dos tiros. Picareta varre um arco de 100 graus: contar golpe como
  // tiro fazia a precisao subir quando o jogador batia no escuro sem mirar.
  igual(jogo.estatisticas.tiros, 0, 'golpe de picareta entrou na conta de tiros');
  igual(jogo.estatisticas.golpes, 1, 'golpes contados');
});

// ------------------------------------------------------------- 4. o jogo

prova('zumbi nasce so em zona aberta', () => {
  const jogo = criarJogo(0, { semente: 3, semPreparo: true });
  igual(janelasAtivas(jogo).length,
    jogo.mapa.janelas.filter(w => zonaEm(jogo.mapa, w.dentro.x, w.dentro.y) === jogo.mapa.zonaInicial).length,
    'janelas ativas nao sao as da zona inicial');
  for (let i = 0; i < 60 * 40; i++) passo(jogo, {}, DT);
  for (const z of zumbisVivos(jogo)) {
    const zona = zonaEm(jogo.mapa, z.janela.dentro.x, z.janela.dentro.y);
    ok(jogo.mapa.zonas[zona].aberta, 'nasceu zumbi em zona fechada');
  }
});

prova('zumbi arranca tabua, jogador repoe, e o ponto sai', () => {
  const jogo = criarJogo(0, { semente: 3, semPreparo: true });
  const total = tabuasDeTodasAsJanelas(jogo);
  igual(total, jogo.mapa.janelas.length * CONFIG.tabuasPorJanela, 'tabuas no comeco');
  let arrancadas = 0;
  for (let i = 0; i < 60 * 30; i++) {
    for (const e of passo(jogo, {}, DT)) if (e.tipo === 'tabua-arrancada') arrancadas++;
  }
  ok(arrancadas > 0, 'ninguem arrancou tabua em 30 s');
  ok(tabuasDeTodasAsJanelas(jogo) < total, 'as tabuas nao cairam');

  // repor: o jogador anda ate a janela mais furada e repoe
  const janela = jogo.mapa.janelas.slice().sort((a, b) => a.tabuas - b.tabuas)[0];
  jogo.jogador.x = janela.dentro.x + 0.5;
  jogo.jogador.y = janela.dentro.y + 0.5;
  const antes = janela.tabuas;
  const pontosAntes = jogo.jogador.pontos;
  passo(jogo, { usar: true }, DT);
  igual(janela.tabuas, antes + 1, 'repor tabua nao repos');
  igual(jogo.jogador.pontos, pontosAntes + CONFIG.pontosPorTabuaReposta, 'repor tabua nao pagou');
});

prova('uso tem travamento, e compra nao acontece sessenta vezes por segundo', () => {
  // Defeito que o robo achou: sem travamento ele comprava municao em todo
  // quadro, gastava tudo que ganhava e morria com o mapa fechado.
  const jogo = criarJogo(0, { semente: 3, semPreparo: true, pontos: 20000 });
  const parede = jogo.mapa.maquinas.find(q => q.tipo === 'arma');
  jogo.jogador.x = parede.x;
  jogo.jogador.y = parede.y;
  const antes = jogo.jogador.pontos;
  let compras = 0;
  for (let i = 0; i < 30; i++) {
    for (const e of passo(jogo, { usar: true }, DT)) {
      if (e.tipo === 'comprou' || e.tipo === 'municao') compras++;
    }
  }
  igual(compras, 1, 'meio segundo de tecla apertada comprou mais de uma vez');
  igual(jogo.jogador.pontos, antes - ARMAS[parede.arma].custo,
    'o preco cobrado nao e o da arma da parede');
});

prova('porta cobra uma vez e abre o vao inteiro', () => {
  const jogo = criarJogo(0, { semente: 3, semPreparo: true, pontos: 9000 });
  const porta = [...jogo.mapa.portas.values()][0];
  const mesmaMarca = [...jogo.mapa.portas.values()].filter(p => p.marca === porta.marca);
  ok(mesmaMarca.length >= 3, 'o vao da porta tem menos de tres celulas');
  jogo.jogador.x = porta.x + 0.5;
  jogo.jogador.y = porta.y + 1.6;
  jogo.jogador.ang = -Math.PI / 2;
  const antes = jogo.jogador.pontos;
  passo(jogo, { usar: true }, DT);
  igual(jogo.jogador.pontos, antes - porta.custo, 'a porta nao cobrou o preco certo');
  for (const celula of mesmaMarca) ok(celula.aberta, 'o vao nao abriu inteiro');
  for (const zona of porta.zonas) {
    ok(jogo.mapa.zonas[zona].aberta, 'abrir a porta nao abriu as zonas que ela liga');
  }
});

prova('perk e forja exigem forca; caixa nao', () => {
  const jogo = criarJogo(0, { semente: 3, semPreparo: true, pontos: 30000 });
  const perk = jogo.mapa.maquinas.find(q => q.tipo === 'perk');
  jogo.jogador.x = perk.x;
  jogo.jogador.y = perk.y;
  let negado = false;
  for (const e of passo(jogo, { usar: true }, DT)) if (e.tipo === 'negado') negado = true;
  ok(negado, 'comprou perk sem forca');
  igual(jogo.jogador.perks.size, 0, 'o perk entrou mesmo negado');

  jogo.forcaLigada = true;
  jogo.relogioDeUso = 0;
  let comprou = false;
  for (const e of passo(jogo, { usar: true }, DT)) if (e.tipo === 'perk') comprou = true;
  ok(comprou, 'nao comprou perk com forca ligada');
  ok(jogo.jogador.perks.size === 1, 'o perk nao entrou');
});

prova('o caldo dobra a vida e o talisma levanta uma vez', () => {
  const jogo = criarJogo(0, { semente: 3, semPreparo: true, pontos: 30000 });
  jogo.forcaLigada = true;
  const caldo = jogo.mapa.maquinas.find(q => q.tipo === 'perk' && q.perk === 'caldo');
  jogo.jogador.x = caldo.x;
  jogo.jogador.y = caldo.y;
  passo(jogo, { usar: true }, DT);
  igual(jogo.jogador.vidaMaxima, CONFIG.vidaMaxima * CONFIG.multiplicadorDeVidaDoCaldo,
    'o caldo nao dobrou a vida');

  const outro = criarJogo(0, { semente: 3, semPreparo: true });
  outro.jogador.perks.add('talisma');
  outro.jogador.vida = 1;
  const zumbi = criarZumbi('comum', 1, outro.mapa.janelas[0]);
  zumbi.estado = 'cacando';
  zumbi.x = outro.jogador.x + 0.3;
  zumbi.y = outro.jogador.y;
  outro.vivos.push(zumbi);
  let levantou = false;
  for (let i = 0; i < 60 * 3 && !levantou; i++) {
    for (const e of passo(outro, {}, DT)) if (e.tipo === 'levantou') levantou = true;
  }
  ok(levantou, 'o talisma nao levantou ninguem');
  ok(!outro.jogador.baixado, 'ficou baixado mesmo com talisma');
  ok(!outro.jogador.perks.has('talisma'), 'o talisma nao foi gasto');
});

prova('mordida derruba, e sangrar mata', () => {
  const jogo = criarJogo(0, { semente: 3, semPreparo: true });
  let baixou = false;
  let morreu = false;
  for (let i = 0; i < 60 * 120 && !morreu; i++) {
    for (const e of passo(jogo, {}, DT)) {
      if (e.tipo === 'baixado') baixou = true;
      if (e.tipo === 'fim') morreu = true;
    }
  }
  ok(baixou, 'o jogador parado nunca foi derrubado');
  ok(morreu, 'o jogador sangrou e nunca morreu');
  igual(jogo.estado, 'morto', 'estado final');
});

prova('ponto por acerto, por morte e por cabeca, na tabela', () => {
  const jogo = criarJogo(0, { semente: 3, semPreparo: true });
  const zumbi = criarZumbi('comum', 1, jogo.mapa.janelas[0]);
  zumbi.estado = 'cacando';
  zumbi.vida = 10000;
  zumbi.x = jogo.jogador.x + 3;
  zumbi.y = jogo.jogador.y;
  jogo.vivos.push(zumbi);
  jogo.jogador.ang = 0;
  jogo.jogador.inclinacao = 0;
  jogo.jogador.armas[1] = equipar('pistola');
  jogo.jogador.naMao = 1;
  const antes = jogo.jogador.pontos;
  passo(jogo, { atirar: true }, DT);
  igual(jogo.jogador.pontos - antes, CONFIG.pontosPorAcerto, 'ponto por acerto');

  // morte na cabeca
  zumbi.vida = 1;
  jogo.jogador.inclinacao = (zumbi.altura * 0.85 - CONFIG.alturaDoOlho) / 3;
  jogo.jogador.armas[1].esfriando = 0;
  const antesDaMorte = jogo.jogador.pontos;
  passo(jogo, { atirar: true }, DT);
  const ganho = jogo.jogador.pontos - antesDaMorte;
  ok(ganho === CONFIG.pontosPorAcerto + CONFIG.pontosPorCabeca
    || ganho === CONFIG.pontosPorAcerto + CONFIG.pontosPorMorte,
    `morte pagou ${ganho}`);
  igual(jogo.estatisticas.mortes, 1, 'a morte nao foi contada');
});

prova('a rodada fecha quando a fila esvazia', () => {
  const jogo = criarJogo(0, { semente: 3, semPreparo: true });
  const rodada = jogo.rodada;
  // mata tudo que nascer, por decreto: o que esta sob prova e o fechamento da
  // rodada, nao a mira
  let fechou = false;
  for (let i = 0; i < 60 * 300 && !fechou; i++) {
    for (const z of jogo.vivos) if (z.estado === 'cacando') z.estado = 'morto';
    for (const e of passo(jogo, {}, DT)) if (e.tipo === 'rodada-vencida') fechou = true;
  }
  ok(fechou, 'a rodada nunca fechou');
  igual(jogo.rodada, rodada + 1, 'a rodada seguinte nao comecou');
  ok(jogo.aNascer.length > 0, 'a rodada seguinte nasceu vazia');
});

prova('a dica de uso diz o preco certo', () => {
  const jogo = criarJogo(0, { semente: 3, semPreparo: true });
  const parede = jogo.mapa.maquinas.find(q => q.tipo === 'arma');
  jogo.jogador.x = parede.x;
  jogo.jogador.y = parede.y;
  const alvo = alvoDeUso(jogo);
  ok(alvo && alvo.tipo === 'maquina', 'a maquina embaixo da mao nao apareceu');
  const texto = textoDoAlvo(jogo, alvo);
  ok(texto.includes(String(ARMAS[parede.arma].custo)),
    `a dica "${texto}" nao tem o preco da arma`);
});

prova('a mesma semente da a mesma partida', () => {
  const rodar = () => {
    const jogo = criarJogo(0, { semente: 99, semPreparo: true });
    for (let i = 0; i < 60 * 30; i++) passo(jogo, { frente: i % 90 < 45, atirar: i % 7 === 0 }, DT);
    const r = resumo(jogo);
    return `${r.rodada}|${r.pontos}|${r.vivos}|${r.mortes}|${jogo.jogador.x.toFixed(4)}`;
  };
  igual(rodar(), rodar(), 'duas partidas com a mesma semente divergiram');
});

// -------------------------------------------------------- 5. o robo joga

const partidas = [];
for (const indice of [0, 1]) {
  for (const semente of [11, 29, 47]) {
    partidas.push(jogarAte(indice, 20, {
      criarJogo, semente, limiteDeSegundos: 60 * 30,
    }));
  }
}

prova('o robo atravessa cinco rodadas nos dois mapas', () => {
  for (const p of partidas) {
    ok(p.chegouNaRodada >= 5,
      `${p.mapa}: o robo parou na rodada ${p.chegouNaRodada} (${p.segundos.toFixed(0)} s)`);
  }
  // Sete na melhor partida, e nao vinte: o robo tem erro de mira proporcional a
  // distancia, nao guarda pontos para rodada de chefe e nao usa o anel de
  // proposito — ele mede se o jogo e jogavel, nao se ele e bom. Gente chega mais
  // longe, e e isso que o jogo tem de permitir.
  const melhor = Math.max(...partidas.map(p => p.chegouNaRodada));
  ok(melhor >= 7, `a melhor partida do robo parou na rodada ${melhor}`);
  const media = partidas.reduce((s, p) => s + p.chegouNaRodada, 0) / partidas.length;
  ok(media >= 5.5, `o robo alcanca a rodada ${media.toFixed(1)} em media`);
});

prova('o robo compra espaco e liga a forca', () => {
  // Um robo que junta pontos e morre com o mapa fechado nao prova que o jogo e
  // jogavel: prova que a economia esta errada. Foi o que aconteceu antes do
  // travamento de uso existir.
  for (const p of partidas) {
    ok(p.estatisticas.portasAbertas >= 2,
      `${p.mapa}: o robo abriu ${p.estatisticas.portasAbertas} porta(s)`);
  }
  ok(partidas.filter(p => p.forcaLigada).length >= partidas.length - 1,
    'o robo quase nunca liga a forca');
});

prova('o robo mata com a cabeca', () => {
  for (const p of partidas) {
    const fracao = p.estatisticas.cabecas / Math.max(1, p.estatisticas.mortes);
    ok(fracao > 0.35,
      `${p.mapa}: so ${(fracao * 100).toFixed(0)}% das mortes foram na cabeca`);
  }
});

prova('nenhum zumbi fica preso durante a partida do robo', () => {
  // Zumbi que nao alcanca o jogador e rodada que nunca fecha. Foi assim que o
  // vao de uma celula apareceu: o bicho vibrava na quina da porta para sempre.
  const jogo = criarJogo(0, { semente: 5, semPreparo: true, pontos: 12000 });
  for (const porta of jogo.mapa.portas.values()) porta.aberta = true;
  for (const zona of jogo.mapa.zonas) zona.aberta = true;
  const fluxo = criarFluxo(jogo.mapa);
  let amostras = 0;
  let presos = 0;
  for (let i = 0; i < 60 * 90; i++) {
    passo(jogo, { frente: i % 120 < 60, dir: i % 240 < 120 }, DT);
    if (i % 30 !== 0) continue;
    refazerFluxo(jogo.mapa, fluxo, jogo.jogador);
    for (const z of zumbisVivos(jogo)) {
      if (z.estado !== 'cacando' && z.estado !== 'mordendo') continue;
      amostras++;
      if (distanciaDoFluxo(jogo.mapa, fluxo, z.x, z.y) < 0) presos++;
    }
  }
  ok(amostras > 50, `so ${amostras} amostras de zumbi cacando`);
  ok(presos / amostras < 0.02,
    `${presos} de ${amostras} amostras de zumbi sem caminho ate o jogador`);
});

// --------------------------------------------------------------- tabelas

console.log('\n\nrodada  zumbis  vida  velocidade  nascimento  composicao');
for (const r of [1, 3, 5, 7, 10, 15, 20, 25, 30]) {
  const c = composicaoDaRodada(r);
  console.log(
    `${String(r).padStart(6)}${String(quantidadeDaRodada(r)).padStart(8)}`
    + `${String(vidaDaRodada(r)).padStart(6)}`
    + `${velocidadeDaRodada(r).toFixed(2).padStart(12)}`
    + `${`${intervaloDeNascimento(r).toFixed(2)} s`.padStart(12)}`
    + `   ${c.comum} comum${c.rastejante ? ` + ${c.rastejante} rastejante` : ''}`
    + `${c.chefe ? ` + ${c.chefe} chefe` : ''}`);
}

console.log('\narma          custo   dps perto   dps 18 m   pente   alcance');
for (const chave of Object.keys(ARMAS)) {
  const a = ARMAS[chave];
  console.log(
    `${a.nome.padEnd(14)}${String(a.custo).padStart(5)}`
    + `${danoPorSegundo(a, 2).toFixed(0).padStart(12)}`
    + `${danoPorSegundo(a, 18).toFixed(0).padStart(11)}`
    + `${String(Number.isFinite(a.pente) ? a.pente : '-').padStart(8)}`
    + `${`${a.alcance} m`.padStart(10)}`);
}

console.log('\nmapa            zonas  janelas  maquinas  celulas  volta  custo');
for (const m of mapas) {
  const v = maiorVolta(m);
  console.log(
    `${m.nome.padEnd(16)}${String(m.zonas.length).padStart(5)}`
    + `${String(m.janelas.length).padStart(9)}`
    + `${String(m.maquinas.length).padStart(10)}`
    + `${String(celulasAbertas(m)).padStart(9)}`
    + `${String(v.tamanho).padStart(7)}`
    + `${String(custoParaAbrirTudo(m)).padStart(7)}`);
}

console.log('\nrobo            mapa            rodada  tempo   mortes  cabecas  portas  forca');
for (const p of partidas) {
  console.log(
    `${'partida'.padEnd(16)}${p.mapa.padEnd(16)}`
    + `${String(p.chegouNaRodada).padStart(6)}`
    + `${`${p.segundos.toFixed(0)} s`.padStart(8)}`
    + `${String(p.estatisticas.mortes).padStart(9)}`
    + `${String(p.estatisticas.cabecas).padStart(9)}`
    + `${String(p.estatisticas.portasAbertas).padStart(8)}`
    + `${(p.forcaLigada ? '  sim' : '  nao').padStart(7)}`);
}

// ------------------------------------------------------- a casca do jogo
//
// Esta prova existe porque uma edicao minha apagou `carregarRecordes` e
// `salvarRecorde` de `js/main.js`: as 41 provas ficaram verdes, `node --check`
// passou, e o jogo nao abria — o corpo do modulo jogava antes de registrar o
// clique do menu. `main.js` era o unico arquivo do jogo que nenhuma prova
// carregava. Agora ele roda aqui, com uma tela de mentira.
await provaAssincrona('a casca carrega inteira, com todo identificador no lugar', async () => {
  const { montarTelaDeMentira } = await import('./provas-dom.mjs');
  montarTelaDeMentira();
  const casca = await import('./js/main.js');
  ok(casca, 'o modulo da casca nao carregou');
});

console.log(`\n${feitas} provas passaram, ${falhas.length} falharam.`);
for (const f of falhas) console.log(`\n  FALHOU  ${f.nome}\n          ${f.erro.message}`);
console.log('');
if (falhas.length) process.exit(1);
// Saida explicita: a casca deixa relogios e ouvintes vivos, como no navegador.
process.exit(0);
