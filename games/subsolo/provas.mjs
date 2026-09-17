#!/usr/bin/env node
// As provas do SUBSOLO. Rode com: node provas.mjs
//
// O jogo inteiro roda aqui dentro, sem navegador: `js/jogo.js` e os modulos que
// ele usa nao tocam em DOM, canvas nem window. E isso que permite provar coisa
// que olhar a tela nao prova — que as nove fases terminam, que a municao fecha,
// que o ruido se propaga como a mecanica promete — e provar isso no jogo de
// verdade, nao numa maquete dele.
//
// A prova mais importante e a ultima: um robo joga as nove fases usando a mesma
// fisica, a mesma arma e o mesmo inimigo do navegador, e precisa sair vivo.

import { FASES, LEGENDA, PAREDES } from './js/fases.js';
import * as M from './js/mapa.js';
import { ARMAS, tracar } from './js/armas.js';
import { TIPOS, criarInimigo } from './js/inimigos.js';
import { criarJogo, passo, entradaNula, DT, CONFIG } from './js/jogo.js';
import { robo } from './js/robo.js';

// ---------------------------------------------------------------- arranjo

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

function ok(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

function igual(a, b, mensagem) {
  if (a !== b) throw new Error(`${mensagem}: esperava ${b}, veio ${a}`);
}

function entre(valor, min, max, mensagem) {
  if (!(valor >= min && valor <= max)) {
    throw new Error(`${mensagem}: ${typeof valor === 'number' ? valor.toFixed(3) : valor} fora de [${min}, ${max}]`);
  }
}

// ------------------------------------------------- 1. as fases sao bem formadas

prova('a legenda cobre todo caractere usado nas fases', () => {
  const conhecidos = new Set(Object.keys(LEGENDA));
  for (const fase of FASES) {
    for (const [y, linha] of fase.planta.entries()) {
      for (const [x, ch] of [...linha].entries()) {
        ok(conhecidos.has(ch), `${fase.nome} (${x},${y}): caractere "${ch}" fora da legenda`);
      }
    }
  }
});

prova('toda planta e retangular', () => {
  for (const fase of FASES) {
    const largura = fase.planta[0].length;
    for (const [y, linha] of fase.planta.entries()) {
      igual(linha.length, largura, `${fase.nome}: linha ${y} com largura diferente`);
    }
  }
});

prova('toda fase tem um inicio e pelo menos um elevador', () => {
  for (const fase of FASES) {
    const texto = fase.planta.join('');
    igual((texto.match(/@/g) || []).length, 1, `${fase.nome}: inicios`);
    ok((texto.match(/E/g) || []).length >= 1, `${fase.nome}: nenhum elevador`);
  }
});

prova('a borda de toda fase e solida', () => {
  // Sem isso o jogador anda para fora da grade, onde nao ha tile nenhum e
  // portanto nao ha parede — foi assim que a ANTENA deixou a sonda cair no vazio.
  for (const fase of FASES) {
    const m = M.carregar(fase);
    for (let x = 0; x < m.largura; x++) {
      ok(M.solido(m, x, 0), `${fase.nome}: (${x},0) aberto`);
      ok(M.solido(m, x, m.altura - 1), `${fase.nome}: (${x},${m.altura - 1}) aberto`);
    }
    for (let y = 0; y < m.altura; y++) {
      ok(M.solido(m, 0, y), `${fase.nome}: (0,${y}) aberto`);
      ok(M.solido(m, m.largura - 1, y), `${fase.nome}: (${m.largura - 1},${y}) aberto`);
    }
  }
});

prova('nenhum inimigo ou item nasce dentro de parede', () => {
  for (const fase of FASES) {
    const m = M.carregar(fase);
    for (const e of m.inimigos) {
      ok(!M.solido(m, Math.floor(e.x), Math.floor(e.y)),
        `${fase.nome}: ${e.tipo} dentro de parede em (${e.x},${e.y})`);
    }
    for (const i of m.itens) {
      ok(!M.solido(m, Math.floor(i.x), Math.floor(i.y)),
        `${fase.nome}: item ${i.tipo} dentro de parede em (${i.x},${i.y})`);
    }
  }
});

prova('cada fase tem inimigo e um segredo', () => {
  for (const fase of FASES) {
    const m = M.carregar(fase);
    ok(m.inimigos.length >= 4, `${fase.nome}: so ${m.inimigos.length} inimigos`);
    const segredos = fase.planta.join('').split('*').length - 1;
    ok(segredos >= 1, `${fase.nome}: nenhuma parede falsa`);
  }
});

// --------------------------------------- 2. as fases terminam, na ordem certa

prova('toda fase e completavel respeitando a ordem dos crachas', () => {
  // Fechamento: ande ate onde da, pegue o cracha que alcancou, destranque a
  // porta que ele abre, repita. Porta travada por cracha que so existe atras
  // dela e a maneira classica de um nivel parecer bem e estar morto.
  for (const fase of FASES) {
    const m = M.carregar(fase);
    const veredito = M.completavel(m);
    ok(veredito.ok, `${fase.nome}: ${veredito.motivo}`);
  }
});

prova('todo item declarado e alcancavel', () => {
  for (const fase of FASES) {
    const m = M.carregar(fase);
    const inalcancaveis = M.itensInalcancaveis(m);
    igual(inalcancaveis.length, 0,
      `${fase.nome}: item fora de alcance ${JSON.stringify(inalcancaveis)}`);
  }
});

prova('toda parede falsa esconde algo e da para alcancar', () => {
  for (const fase of FASES) {
    const m = M.carregar(fase);
    for (const s of M.segredos(m)) {
      ok(s.alcancavel, `${fase.nome}: segredo em (${s.x},${s.y}) inalcancavel`);
      ok(s.premio > 0, `${fase.nome}: segredo em (${s.x},${s.y}) nao esconde nada`);
    }
  }
});

// ------------------------------------------------ 3. a economia de recurso fecha

prova('o dano disponivel em cada fase fica na faixa de projeto', () => {
  // Picareta e infinita, entao nunca ha travamento por falta de municao: o que
  // se prova aqui e tensao, nao possibilidade. Abaixo de 0,8 a fase forca
  // corpo-a-corpo contra bicho que mata em dois golpes; acima de 2,5 a
  // municao deixa de ser decisao.
  for (const fase of FASES) {
    const m = M.carregar(fase);
    const vida = m.inimigos.reduce((s, e) => s + TIPOS[e.tipo].vida, 0);
    const dano = M.danoDisponivel(m);
    entre(dano / vida, 0.8, 2.5, `${fase.nome}: dano/vida`);
  }
});

prova('a pilha cobre a travessia, e nao cobre a fase inteira acesa', () => {
  // A lanterna e a decisao central do jogo: ver custa pilha e entrega voce.
  // Pilha de sobra apaga a decisao; pilha curta demais cega o jogador. As duas
  // pontas sao medidas contra coisas diferentes de proposito — o caminho minimo
  // de saida, e a varredura da fase celula por celula.
  for (const fase of FASES) {
    const m = M.carregar(fase);
    const segundos = M.bateriaDisponivel(m) / CONFIG.gastoLanterna;
    const travessia = M.distanciaMinimaDeTravessia(m) / CONFIG.velAndar;
    const varredura = M.celulasAndaveis(m) / CONFIG.velAndar;
    ok(segundos >= travessia * 0.8,
      `${fase.nome}: ${segundos.toFixed(0)} s de pilha nao cobrem os `
      + `${travessia.toFixed(0)} s do caminho de saida`);
    ok(segundos <= varredura * 0.75,
      `${fase.nome}: ${segundos.toFixed(0)} s de pilha dao para varrer a fase `
      + `(${varredura.toFixed(0)} s) com a lanterna acesa`);
  }
});

// ------------------------------------------------------ 4. busca de caminho

prova('o caminho do A* e continuo, andavel e do tamanho da busca em largura', () => {
  for (const fase of FASES) {
    const m = M.carregar(fase);
    const de = { x: Math.floor(m.inicio.x), y: Math.floor(m.inicio.y) };
    const alvo = m.inimigos[m.inimigos.length - 1];
    const para = { x: Math.floor(alvo.x), y: Math.floor(alvo.y) };
    const caminho = M.caminho(m, de, para, { crachas: new Set(['A', 'B', 'C']) });
    ok(caminho, `${fase.nome}: A* nao achou caminho ate o ultimo inimigo`);
    for (const [i, no] of caminho.entries()) {
      ok(!M.solido(m, no.x, no.y, new Set(['A', 'B', 'C'])),
        `${fase.nome}: passo ${i} do caminho atravessa parede`);
      if (i > 0) {
        const d = Math.abs(no.x - caminho[i - 1].x) + Math.abs(no.y - caminho[i - 1].y);
        igual(d, 1, `${fase.nome}: passo ${i} do caminho pula celula`);
      }
    }
    const distancia = M.distancias(m, de, new Set(['A', 'B', 'C'])).get(`${para.x},${para.y}`);
    igual(caminho.length - 1, distancia, `${fase.nome}: A* mais longo que a busca em largura`);
  }
});

// ----------------------------------------------------------------- 5. ruido

prova('o ruido cai com a distancia e nunca sobe', () => {
  const m = M.carregar(FASES[0]);
  const origem = { x: Math.floor(m.inicio.x), y: Math.floor(m.inicio.y) };
  const campo = M.alcanceRuido(m, origem, 20);
  igual(campo.get(`${origem.x},${origem.y}`), 20, 'a origem do ruido guarda a forca cheia');
  for (const [chave, valor] of campo) {
    const [x, y] = chave.split(',').map(Number);
    ok(valor > 0, `celula (${x},${y}) com ruido nao positivo`);
    ok(valor <= 20, `celula (${x},${y}) mais alta que a origem`);
  }
});

prova('porta fechada abafa o ruido', () => {
  const fase = FASES.find(f => f.planta.join('').includes('/'));
  const m = M.carregar(fase);
  const porta = m.portasLista[0];
  const vizinha = M.vizinhaLivre(m, porta.x, porta.y);
  const fechada = M.alcanceRuido(m, vizinha, 24);
  M.abrir(m, porta.x, porta.y);
  const aberta = M.alcanceRuido(m, vizinha, 24);
  let maiorFechada = 0;
  let maiorAberta = 0;
  for (const [, v] of fechada) maiorFechada += v;
  for (const [, v] of aberta) maiorAberta += v;
  ok(maiorAberta > maiorFechada,
    `ruido nao muda ao abrir a porta (${maiorFechada} contra ${maiorAberta})`);
});

prova('o ruido e simetrico entre duas celulas', () => {
  const m = M.carregar(FASES[2]);
  const a = { x: Math.floor(m.inicio.x), y: Math.floor(m.inicio.y) };
  const alvo = m.inimigos[0];
  const b = { x: Math.floor(alvo.x), y: Math.floor(alvo.y) };
  const ida = M.alcanceRuido(m, a, 40).get(`${b.x},${b.y}`) || 0;
  const volta = M.alcanceRuido(m, b, 40).get(`${a.x},${a.y}`) || 0;
  igual(ida, volta, 'ruido de ida e volta');
});

// ------------------------------------------------------------- 6. movimento

prova('o jogador nao atravessa parede correndo contra ela', () => {
  for (const fase of FASES) {
    const jogo = criarJogo(FASES.indexOf(fase));
    for (const angulo of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.7, 2.4]) {
      const j = criarJogo(FASES.indexOf(fase));
      j.jogador.ang = angulo;
      for (let i = 0; i < 240; i++) {
        passo(j, { ...entradaNula(), frente: 1, correndo: true }, DT);
      }
      const dentro = !M.solido(j.mapa, Math.floor(j.jogador.x), Math.floor(j.jogador.y));
      ok(dentro, `${fase.nome}: angulo ${angulo.toFixed(2)} terminou dentro de parede`);
      ok(j.jogador.x > 0 && j.jogador.y > 0
        && j.jogador.x < j.mapa.largura && j.jogador.y < j.mapa.altura,
        `${fase.nome}: angulo ${angulo.toFixed(2)} saiu da grade`);
    }
    ok(jogo.estado === 'jogando', `${fase.nome}: o jogo nao comeca jogando`);
  }
});

prova('correr faz mais ruido que andar, e agachado nao faz nenhum', () => {
  const jogo = criarJogo(0);
  const medir = (entrada) => {
    const j = criarJogo(0);
    let maior = 0;
    for (let i = 0; i < 120; i++) {
      passo(j, { ...entradaNula(), ...entrada }, DT);
      for (const r of j.ruidos) maior = Math.max(maior, r.forca);
    }
    return maior;
  };
  const agachado = medir({ frente: 1, agachado: true });
  const andando = medir({ frente: 1 });
  const correndo = medir({ frente: 1, correndo: true });
  igual(agachado, 0, 'agachado faz ruido');
  ok(andando > 0, 'andar nao faz ruido nenhum');
  ok(correndo > andando, `correr (${correndo}) nao e mais alto que andar (${andando})`);
  ok(jogo.jogador.vida === CONFIG.vidaMax, 'o jogador nao comeca com vida cheia');
});

// -------------------------------------------------------------- 7. balistica

prova('parede bloqueia tiro', () => {
  const m = M.carregar(FASES[0]);
  const parede = M.primeiraParedeDepoisDoInicio(m);
  const acerto = tracar(m, parede.origem, parede.dir, 30, []);
  ok(acerto && acerto.tipo === 'parede', 'o traco nao parou na parede');
  entre(acerto.distancia, 0.2, parede.distancia + 0.6, 'distancia do acerto na parede');
});

prova('inimigo atras de parede nao toma tiro; na frente, toma', () => {
  const m = M.carregar(FASES[0]);
  const p = M.primeiraParedeDepoisDoInicio(m);
  const atras = criarInimigo('larva',
    p.origem.x + p.dir.x * (p.distancia + 2), p.origem.y + p.dir.y * (p.distancia + 2));
  const frente = criarInimigo('larva',
    p.origem.x + p.dir.x * (p.distancia * 0.5), p.origem.y + p.dir.y * (p.distancia * 0.5));
  const so_atras = tracar(m, p.origem, p.dir, 30, [atras]);
  igual(so_atras.tipo, 'parede', 'tiro acertou inimigo atraves da parede');
  const com_frente = tracar(m, p.origem, p.dir, 30, [atras, frente]);
  igual(com_frente.tipo, 'inimigo', 'tiro nao acertou o inimigo na linha de visao');
  igual(com_frente.alvo, frente, 'tiro acertou o inimigo errado');
});

prova('a espingarda espalha e a pineira nao', () => {
  ok(ARMAS.espingarda.pelotas > 1, 'espingarda com uma pelota');
  ok(ARMAS.espingarda.espalhamento > ARMAS.pineira.espalhamento,
    'espingarda nao espalha mais que a pineira');
  ok(ARMAS.picareta.ruido < ARMAS.pineira.ruido,
    'picareta nao e mais silenciosa que a pineira');
  ok(ARMAS.picareta.municao === null, 'picareta gasta municao');
  for (const [nome, arma] of Object.entries(ARMAS)) {
    ok(arma.dano > 0, `${nome} sem dano`);
    ok(arma.cadencia > 0, `${nome} sem cadencia`);
    ok(arma.alcance > 0, `${nome} sem alcance`);
  }
});

// ------------------------------------------------------------- 8. inimigos

prova('o cego nao acorda com luz, acorda com ruido', () => {
  const jogo = criarJogo(0);
  const inimigo = criarInimigo('cego', jogo.jogador.x + 4, jogo.jogador.y);
  jogo.inimigos = [inimigo];
  jogo.jogador.lanterna = true;
  jogo.jogador.bateria = 999;
  for (let i = 0; i < 120; i++) passo(jogo, { ...entradaNula(), agachado: true }, DT);
  igual(inimigo.estado, 'dormindo', 'o cego viu a lanterna');

  for (let i = 0; i < 60; i++) passo(jogo, { ...entradaNula(), frente: 1, correndo: true }, DT);
  ok(inimigo.estado !== 'dormindo', 'o cego nao ouviu a corrida');
});

prova('o rastejo alcanca e machuca o jogador parado num corredor limpo', () => {
  const jogo = criarJogo(0);
  const alvo = M.celulaLongeDoInicio(jogo.mapa, 8);
  jogo.inimigos = [criarInimigo('rastejo', alvo.x + 0.5, alvo.y + 0.5)];
  jogo.inimigos[0].estado = 'cacando';
  jogo.inimigos[0].alvo = { x: jogo.jogador.x, y: jogo.jogador.y };
  let menorDistancia = Infinity;
  for (let i = 0; i < 60 * 30; i++) {
    passo(jogo, entradaNula(), DT);
    const d = Math.hypot(jogo.inimigos[0].x - jogo.jogador.x, jogo.inimigos[0].y - jogo.jogador.y);
    menorDistancia = Math.min(menorDistancia, d);
    if (jogo.jogador.vida < CONFIG.vidaMax) break;
  }
  ok(menorDistancia < 1.2,
    `o rastejo nao chegou em 30 s de corredor livre (parou a ${menorDistancia.toFixed(2)})`);
  ok(jogo.jogador.vida < CONFIG.vidaMax, 'o rastejo chegou e nao machucou');
});

prova('inimigo morto para de agir e conta ponto', () => {
  const jogo = criarJogo(0);
  const inimigo = criarInimigo('larva', jogo.jogador.x + 1, jogo.jogador.y);
  jogo.inimigos = [inimigo];
  jogo.jogador.ang = 0;
  inimigo.x = jogo.jogador.x + Math.cos(0) * 0.9;
  inimigo.y = jogo.jogador.y + Math.sin(0) * 0.9;
  let voltas = 0;
  while (inimigo.vida > 0 && voltas++ < 600) {
    passo(jogo, { ...entradaNula(), atirar: true }, DT);
  }
  ok(inimigo.vida <= 0, 'a picareta nao mata uma larva a queima-roupa');
  igual(inimigo.estado, 'morto', 'inimigo sem vida continua ativo');
  igual(jogo.abatidos, 1, 'o abate nao foi contado');
});

// ---------------------------------------------------------- 9. determinismo

prova('a mesma semente da a mesma partida', () => {
  const rodar = () => {
    const j = criarJogo(3, { semente: 12345 });
    const entradas = [];
    let x = 7;
    for (let i = 0; i < 900; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      entradas.push({
        ...entradaNula(),
        frente: ((x >> 5) % 3) - 1,
        lado: ((x >> 9) % 3) - 1,
        girar: (((x >> 13) % 100) - 50) / 900,
        atirar: ((x >> 17) & 7) === 0,
      });
    }
    for (const e of entradas) passo(j, e, DT);
    return `${j.jogador.x.toFixed(6)}|${j.jogador.y.toFixed(6)}|${j.jogador.vida.toFixed(3)}|${j.abatidos}`;
  };
  igual(rodar(), rodar(), 'duas partidas identicas divergiram');
});

// ------------------------------------------------- 10. a prova que importa

let corridaDoRobo = null;

prova('um robo vence as nove fases com a fisica do jogo', () => {
  corridaDoRobo = robo();
  for (const linha of corridaDoRobo.fases) {
    ok(linha.venceu, `${linha.nome}: o robo nao saiu (${linha.motivo})`);
    entre(linha.segundos, 8, 420, `${linha.nome}: tempo do robo`);
  }
  igual(corridaDoRobo.fases.length, FASES.length, 'fases que o robo jogou');
  ok(corridaDoRobo.vidaFinal > 0, 'o robo terminou morto');
});

// ---------------------------------------------------------------- resultado

// A tabela sai antes do veredito, e sai mesmo quando alguma prova falha: quem
// mexeu num numero precisa ver o estrago, e o estrago costuma estar aqui.
console.log('\n\nfase                inimigos   vida   dano   dano/vida   bateria/travessia');
for (const fase of FASES) {
  const m = M.carregar(fase);
  const vida = m.inimigos.reduce((s, e) => s + TIPOS[e.tipo].vida, 0);
  const dano = M.danoDisponivel(m);
  const bateria = (M.bateriaDisponivel(m) / CONFIG.gastoLanterna)
    / (M.distanciaMinimaDeTravessia(m) / CONFIG.velAndar);
  console.log(
    `${fase.nome.padEnd(20)}${String(m.inimigos.length).padStart(5)}`
    + `${String(vida).padStart(8)}${String(dano).padStart(7)}`
    + `${(dano / vida).toFixed(2).padStart(11)}${bateria.toFixed(2).padStart(19)}`);
}

// E a corrida do robo, que e a prova que decide se o jogo e jogavel: em que
// fase ele parou, quanto tempo levou, com quanta vida saiu e quem tirou dela.
if (corridaDoRobo) {
  console.log('\nfase                  robo   tempo   vida   abates   de onde veio o dano');
  for (const l of corridaDoRobo.fases) {
    const fonte = Object.entries(l.dano).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ') || '-';
    console.log(
      `${l.nome.padEnd(20)}${(l.venceu ? 'saiu' : 'FALHA').padStart(6)}`
      + `${`${l.segundos.toFixed(0)} s`.padStart(8)}${l.vida.toFixed(0).padStart(7)}`
      + `${`${l.abatidos}/${l.de}`.padStart(9)}   ${fonte}`);
  }
}

console.log(`\n${feitas} provas passaram, ${falhas.length} falharam.`);
for (const f of falhas) {
  console.log(`\n  FALHOU  ${f.nome}\n          ${f.erro.message}`);
}
console.log('');
if (falhas.length) process.exit(1);
