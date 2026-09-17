#!/usr/bin/env node
// As provas do CURVA. Rode com: node provas.mjs
//
// Corrida e o genero em que "parece bom" mente mais: um carro que cola na pista
// parece agradavel e nao tem decisao nenhuma, e uma IA que vai bem parece
// competente quando esta so cortando a grama. Aqui o carro, a pista, a linha de
// corrida, o piloto de IA e a corrida inteira rodam sem navegador — e e por isso
// que da para medir em vez de achar.
//
// As medidas nao sao inventadas: sao tiradas do mesmo modelo que o jogador
// dirige. Se o numero desta tabela mudar, a sensacao do carro mudou.

import { PISTAS, carregar, superficie, maisProximo } from './js/pista.js';
import { CARRO, criarCarro, passoCarro, comandosNulos, DT } from './js/fisica.js';
import { linhaIdeal } from './js/linha.js';
import { criarPiloto, pilotar, PERFIS } from './js/piloto.js';
import { criarCorrida, passoCorrida, PONTOS, classificacao } from './js/corrida.js';
import { medirCarro, voltaDeReferencia, corridaCompleta } from './js/banco.js';

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
    throw new Error(`${mensagem}: ${Number(valor).toFixed(3)} fora de [${min}, ${max}]`);
  }
}

const pistas = PISTAS.map(carregar);

// ------------------------------------------------- 1. a pista e uma pista

prova('toda pista fecha o circuito', () => {
  for (const p of pistas) {
    const a = p.centro[0];
    const b = p.centro[p.centro.length - 1];
    const vao = Math.hypot(a.x - b.x, a.y - b.y);
    ok(vao < p.passo * 1.6,
      `${p.nome}: sobra um vao de ${vao.toFixed(1)} m entre o fim e o comeco`);
    entre(p.comprimento, 1200, 5200, `${p.nome}: comprimento`);
  }
});

prova('a fita da pista nao se cruza consigo mesma', () => {
  // Duas partes distantes do circuito que passam perto demais viram um atalho
  // que a contagem de setor nao pega e o jogador acha em duas voltas.
  for (const p of pistas) {
    const n = p.centro.length;
    let pior = Infinity;
    let onde = null;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const separacao = Math.min(j - i, n - (j - i));
        if (separacao < 14) continue;
        const a = p.centro[i];
        const b = p.centro[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const exigido = (a.largura + b.largura) / 2 + 6;
        if (d - exigido < pior) { pior = d - exigido; onde = [i, j, d]; }
      }
    }
    ok(pior > 0, `${p.nome}: trechos ${onde[0]} e ${onde[1]} a ${onde[2].toFixed(1)} m `
      + `um do outro, mais perto do que a fita permite`);
  }
});

prova('a pista cabe em dois carros lado a lado', () => {
  for (const p of pistas) {
    let minima = Infinity;
    for (const c of p.centro) minima = Math.min(minima, c.largura);
    ok(minima >= CARRO.largura * 2.2,
      `${p.nome}: o trecho mais estreito tem ${minima.toFixed(1)} m, `
      + `menos que dois carros e folga (${(CARRO.largura * 2.2).toFixed(1)} m)`);
  }
});

prova('a superficie muda de asfalto para zebra e para grama', () => {
  for (const p of pistas) {
    const c = p.centro[10];
    const nx = -Math.sin(c.ang);
    const ny = Math.cos(c.ang);
    const em = (lateral) => superficie(p, c.x + nx * lateral, c.y + ny * lateral);
    igual(em(0).tipo, 'asfalto', `${p.nome}: o centro da pista`);
    igual(em(c.largura / 2 + 0.6).tipo, 'zebra', `${p.nome}: logo depois da borda`);
    igual(em(c.largura / 2 + 4).tipo, 'grama', `${p.nome}: fora da pista`);
    ok(em(0).atrito > em(c.largura / 2 + 0.6).atrito,
      `${p.nome}: a zebra agarra tanto quanto o asfalto`);
    ok(em(c.largura / 2 + 0.6).atrito > em(c.largura / 2 + 4).atrito,
      `${p.nome}: a grama agarra tanto quanto a zebra`);
  }
});

prova('cada pista tem tres setores e um grid de dez lugares', () => {
  for (const p of pistas) {
    igual(p.setores.length, 3, `${p.nome}: setores`);
    ok(p.setores[0] < p.setores[1] && p.setores[1] < p.setores[2],
      `${p.nome}: setores fora de ordem`);
    ok(p.grade.length >= 10, `${p.nome}: so ${p.grade.length} lugares no grid`);
    for (const [n, lugar] of p.grade.entries()) {
      igual(superficie(p, lugar.x, lugar.y).tipo, 'asfalto',
        `${p.nome}: lugar ${n + 1} do grid fora do asfalto`);
    }
  }
});

// --------------------------------------------- 2. o carro e mensuravel

const medidas = medirCarro();

prova('o carro chega onde um carro de corrida chega', () => {
  entre(medidas.velocidadeMaxima * 3.6, 240, 340, 'velocidade maxima em km/h');
  entre(medidas.zeroCem, 2.4, 6.0, '0 a 100 km/h em segundos');
  entre(medidas.frenagem200, 60, 150, 'frenagem de 200 km/h a zero, em metros');
  entre(medidas.gMaximo, 1.05, 2.3, 'aceleracao lateral maxima em g');
});

prova('a grama custa caro e a zebra custa pouco', () => {
  ok(medidas.gGrama < medidas.gMaximo * 0.55,
    `grama com ${medidas.gGrama.toFixed(2)} g contra ${medidas.gMaximo.toFixed(2)} no asfalto`);
  entre(medidas.gZebra / medidas.gMaximo, 0.7, 0.95, 'razao de aderencia zebra/asfalto');
});

prova('o vacuo aumenta a velocidade de reta', () => {
  ok(medidas.velocidadeVacuo > medidas.velocidadeMaxima * 1.015,
    `vacuo deu ${(medidas.velocidadeVacuo * 3.6).toFixed(1)} km/h contra `
    + `${(medidas.velocidadeMaxima * 3.6).toFixed(1)} sozinho`);
});

prova('pneu gasto perde aderencia, e o desgaste vem de escorregar', () => {
  ok(medidas.gPneuGasto < medidas.gMaximo * 0.92,
    `pneu a 100% de desgaste ainda faz ${medidas.gPneuGasto.toFixed(2)} g`);
  ok(medidas.desgasteDerrapando > medidas.desgasteLiso * 2,
    `derrapar desgastou ${medidas.desgasteDerrapando.toFixed(4)} contra `
    + `${medidas.desgasteLiso.toFixed(4)} andando liso`);
});

prova('o carro nao ganha energia de graca', () => {
  // Integrador instavel aparece assim: soltar tudo e ver a velocidade subir.
  const carro = criarCarro(0, 0, 0);
  carro.vx = 40;
  for (let i = 0; i < 60 * 12; i++) {
    passoCarro(carro, comandosNulos(), { atrito: 1, vacuo: 0 }, DT);
  }
  ok(carro.vx < 40, `sem acelerador a velocidade foi de 40 para ${carro.vx.toFixed(2)} m/s`);
  ok(carro.vx > 0, 'o carro andou para tras sozinho');
  ok(Math.abs(carro.vy) < 0.05 && Math.abs(carro.omega) < 0.05,
    'o carro ganhou movimento lateral sozinho');
});

prova('a mesma entrada da a mesma volta', () => {
  const rodar = () => {
    const carro = criarCarro(0, 0, 0);
    let x = 3;
    for (let i = 0; i < 60 * 20; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      passoCarro(carro, {
        volante: (((x >> 7) % 200) - 100) / 100,
        acelerador: ((x >> 15) % 100) / 100,
        freio: ((x >> 21) % 40) / 100,
        freioMao: false,
      }, { atrito: 1, vacuo: 0 }, DT);
    }
    return `${carro.x.toFixed(6)}|${carro.y.toFixed(6)}|${carro.ang.toFixed(6)}`;
  };
  igual(rodar(), rodar(), 'duas simulacoes identicas divergiram');
});

// ------------------------------------------ 3. a linha de corrida existe

prova('a linha ideal fica dentro da pista', () => {
  for (const p of pistas) {
    const linha = linhaIdeal(p);
    igual(linha.deslocamentos.length, p.centro.length, `${p.nome}: tamanho da linha`);
    for (const [i, d] of linha.deslocamentos.entries()) {
      const limite = p.centro[i].largura / 2 - CARRO.largura / 2 - 0.2;
      ok(Math.abs(d) <= limite + 1e-6,
        `${p.nome}: a linha sai da pista no ponto ${i} (${d.toFixed(2)} m de ${limite.toFixed(2)})`);
    }
  }
});

prova('a linha ideal e mais rapida que o eixo da pista', () => {
  // E este o ponto de uma linha de corrida, e nao "ser menos curva": curvatura
  // minima abre o raio de uma curva constante e anda metro a mais, caminho
  // minimo cola na borda de dentro e mata a velocidade. O que vale e o tempo, e
  // e o tempo que o otimizador da linha minimiza.
  for (const p of pistas) {
    const linha = linhaIdeal(p);
    const eixo = linhaIdeal(p, { otimizar: false });
    ok(linha.tempoEstimado < eixo.tempoEstimado * 0.995,
      `${p.nome}: linha em ${linha.tempoEstimado.toFixed(2)} s contra `
      + `${eixo.tempoEstimado.toFixed(2)} s do eixo`);
  }
});

prova('o perfil de velocidade respeita o atrito e a frenagem', () => {
  for (const p of pistas) {
    const linha = linhaIdeal(p);
    for (const [i, v] of linha.velocidades.entries()) {
      const k = Math.abs(linha.curvaturas[i]);
      if (k > 1e-4) {
        const lateral = v * v * k;
        ok(lateral <= CARRO.atritoBase * 9.81 * 1.02,
          `${p.nome}: ponto ${i} pede ${(lateral / 9.81).toFixed(2)} g`);
      }
      ok(v > 4, `${p.nome}: ponto ${i} com velocidade de ${v.toFixed(1)} m/s`);
    }
    entre(linha.tempoEstimado, 30, 160, `${p.nome}: volta estimada pela linha`);
  }
});

// -------------------------------------------------- 4. a IA sabe correr

const referencias = pistas.map((p, i) => voltaDeReferencia(i));

prova('a IA completa uma volta em toda pista', () => {
  for (const [i, r] of referencias.entries()) {
    ok(r.completou, `${pistas[i].nome}: a IA nao fechou a volta (${r.motivo})`);
  }
});

prova('a IA fica perto da linha ideal, e nao acima dela', () => {
  for (const [i, r] of referencias.entries()) {
    const razao = r.tempo / r.estimado;
    entre(razao, 1.0, 1.45, `${pistas[i].nome}: volta da IA sobre a estimada`);
  }
});

prova('a IA anda no asfalto', () => {
  for (const [i, r] of referencias.entries()) {
    ok(r.fracaoNaPista > 0.96,
      `${pistas[i].nome}: a IA passou ${((1 - r.fracaoNaPista) * 100).toFixed(1)}% do tempo fora`);
  }
});

prova('piloto melhor anda mais rapido que piloto pior', () => {
  const nomes = Object.keys(PERFIS);
  const tempos = nomes.map(nome => voltaDeReferencia(0, nome).tempo);
  for (let i = 1; i < tempos.length; i++) {
    ok(tempos[i] >= tempos[i - 1] - 0.05,
      `${nomes[i]} (${tempos[i].toFixed(2)} s) mais rapido que `
      + `${nomes[i - 1]} (${tempos[i - 1].toFixed(2)} s), na ordem inversa do perfil`);
  }
});

// -------------------------------------------- 5. a corrida e uma corrida

prova('volta so conta com os tres setores na ordem', () => {
  // Sem isto, atravessar a linha de chegada de re conta volta, e cortar a
  // chicane vira estrategia.
  const corrida = criarCorrida(0, { voltas: 2, ia: 3, semente: 7 });
  const carro = corrida.carros[0];
  const chegada = corrida.pista.centro[0];
  carro.x = chegada.x;
  carro.y = chegada.y;
  carro.voltaValida = false;
  carro.setor = 0;
  const antes = carro.voltas;
  passoCorrida(corrida, comandosNulos(), DT);
  igual(carro.voltas, antes, 'contou volta sem passar pelos setores');
});

prova('uma corrida inteira termina e classifica todo mundo', () => {
  const r = corridaCompleta(0, { voltas: 3, ia: 9, semente: 11 });
  ok(r.terminou, `a corrida nao terminou em ${r.segundos.toFixed(0)} s simulados`);
  igual(r.classificacao.length, 9, 'carros classificados');
  for (const linha of r.classificacao) {
    ok(linha.voltas >= 1, `${linha.nome} nao completou uma volta`);
    ok(linha.melhorVolta > 0, `${linha.nome} sem melhor volta`);
  }
  // Quem acabou na frente tem de ter andado mais, ou o mesmo em menos tempo.
  for (let i = 1; i < r.classificacao.length; i++) {
    const a = r.classificacao[i - 1];
    const b = r.classificacao[i];
    ok(a.voltas > b.voltas || (a.voltas === b.voltas && a.progresso >= b.progresso - 1e-6),
      `classificacao fora de ordem entre ${a.nome} e ${b.nome}`);
  }
  entre(r.melhorVoltaDaCorrida, 30, 170, 'melhor volta da corrida');
});

prova('os carros nao se atravessam', () => {
  const r = corridaCompleta(1, { voltas: 2, ia: 9, semente: 3 });
  ok(r.menorDistanciaEntreCarros > CARRO.largura * 0.6,
    `dois carros chegaram a ${r.menorDistanciaEntreCarros.toFixed(2)} m de centro a centro`);
  ok(r.toques > 0, 'ninguem se tocou numa corrida de nove carros em duas voltas');
});

prova('parar no box troca pneu e custa tempo', () => {
  const corrida = criarCorrida(0, { voltas: 3, ia: 0, semente: 5 });
  const carro = corrida.carros[0];
  carro.pneus.desgaste = 0.8;
  const box = corrida.pista.box;
  carro.x = box.x;
  carro.y = box.y;
  carro.ang = box.ang;
  carro.vx = 8;
  let parou = false;
  for (let i = 0; i < 60 * 12 && !parou; i++) {
    for (const e of passoCorrida(corrida, { ...comandosNulos(), freio: 1 }, DT)) {
      if (e.tipo === 'box-fim') parou = true;
    }
  }
  ok(parou, 'o box nao atendeu em 12 s');
  ok(carro.pneus.desgaste < 0.05, `saiu do box com ${carro.pneus.desgaste.toFixed(2)} de desgaste`);
  entre(carro.tempoDeBox, 2, 9, 'tempo parado no box');
});

prova('o campeonato soma pontos como campeonato', () => {
  igual(PONTOS.length, 10, 'tamanho da tabela de pontos');
  ok(PONTOS[0] > PONTOS[1] && PONTOS[1] > PONTOS[2], 'tabela de pontos fora de ordem');
  const tabela = classificacao([
    { pilotos: ['A', 'B', 'C'] },
    { pilotos: ['B', 'A', 'C'] },
  ]);
  igual(tabela[0].nome, 'A', 'lider do campeonato');
  igual(tabela[0].pontos, PONTOS[0] + PONTOS[1], 'pontos do lider');
  igual(tabela[2].pontos, PONTOS[2] * 2, 'pontos do terceiro');
});

// --------------------------------------------------------------- tabelas

console.log('\n\npista            volta ideal   volta da IA   razao   comprimento   largura min');
for (const [i, p] of pistas.entries()) {
  const linha = linhaIdeal(p);
  const r = referencias[i];
  let minima = Infinity;
  for (const c of p.centro) minima = Math.min(minima, c.largura);
  console.log(
    `${p.nome.padEnd(16)}${`${linha.tempoEstimado.toFixed(2)} s`.padStart(11)}`
    + `${`${r.tempo.toFixed(2)} s`.padStart(14)}`
    + `${(r.tempo / linha.tempoEstimado).toFixed(3).padStart(8)}`
    + `${`${Math.round(p.comprimento)} m`.padStart(14)}`
    + `${`${minima.toFixed(1)} m`.padStart(14)}`);
}

console.log('\ncarro                     medida');
console.log(`velocidade maxima        ${(medidas.velocidadeMaxima * 3.6).toFixed(1)} km/h`);
console.log(`com vacuo                ${(medidas.velocidadeVacuo * 3.6).toFixed(1)} km/h`);
console.log(`0 a 100 km/h             ${medidas.zeroCem.toFixed(2)} s`);
console.log(`200 km/h a zero          ${medidas.frenagem200.toFixed(1)} m`);
console.log(`g lateral no asfalto     ${medidas.gMaximo.toFixed(2)} g`);
console.log(`g lateral na zebra       ${medidas.gZebra.toFixed(2)} g`);
console.log(`g lateral na grama       ${medidas.gGrama.toFixed(2)} g`);
console.log(`g com pneu no fim        ${medidas.gPneuGasto.toFixed(2)} g`);

console.log(`\n${feitas} provas passaram, ${falhas.length} falharam.`);
for (const f of falhas) {
  console.log(`\n  FALHOU  ${f.nome}\n          ${f.erro.message}`);
}
console.log('');
if (falhas.length) process.exit(1);
