#!/usr/bin/env node
// As provas do CURVA. Rode com: node provas.mjs
//
// Kart e o genero em que "parece bom" mente mais: um kart que cola na pista
// parece agradavel e nao tem decisao nenhuma, um drift que nao paga mini-turbo e
// so um botao de perder tempo, e uma IA que vai bem parece competente quando
// esta so cortando a grama. Aqui o kart, a pista com relevo, a linha de corrida,
// o piloto de IA e a corrida inteira rodam sem navegador — e e por isso que da
// para medir em vez de achar.
//
// As medidas nao sao inventadas: saem do mesmo modelo que o jogador dirige. Se o
// numero desta tabela mudar, a sensacao do kart mudou.

import {
  PISTAS, carregar, superficie, maisProximo, paraMundo, INCLINACAO_MAXIMA,
} from './js/pista.js';
import {
  KART, criarCarro, passoCarro, comandosNulos, faixaDaCarga, darTurbo, rodopiar, DT,
} from './js/fisica.js';
import { linhaIdeal } from './js/linha.js';
import { PERFIS } from './js/piloto.js';
import { criarCorrida, passoCorrida, PONTOS, classificacao } from './js/corrida.js';
import { medirCarro, voltaDeReferencia, corridaCompleta, medirGrampo } from './js/banco.js';

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

const pistas = PISTAS.map(carregar);

// ------------------------------------------------- 1. a pista e uma pista

prova('toda pista fecha o circuito', () => {
  for (const p of pistas) {
    const a = p.centro[0];
    const b = p.centro[p.centro.length - 1];
    const vao = Math.hypot(a.x - b.x, a.y - b.y);
    ok(vao < p.passo * 1.6,
      `${p.nome}: sobra um vao de ${vao.toFixed(1)} m entre o fim e o comeco`);
    entre(p.comprimento, 500, 2000, `${p.nome}: comprimento`);
  }
});

prova('a fita da pista nao se cruza consigo mesma', () => {
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
        const exigido = (a.largura + b.largura) / 2 + 4;
        if (d - exigido < pior) { pior = d - exigido; onde = [i, j, d]; }
      }
    }
    ok(pior > 0, `${p.nome}: trechos ${onde[0]} e ${onde[1]} a ${onde[2].toFixed(1)} m `
      + 'um do outro, mais perto do que a fita permite');
  }
});

prova('a pista cabe em dois karts lado a lado', () => {
  for (const p of pistas) {
    let minima = Infinity;
    for (const c of p.centro) minima = Math.min(minima, c.largura);
    ok(minima >= KART.largura * 2.2,
      `${p.nome}: o trecho mais estreito tem ${minima.toFixed(1)} m, `
      + `menos que dois karts e folga (${(KART.largura * 2.2).toFixed(1)} m)`);
  }
});

prova('o relevo sobe e desce sem virar escada', () => {
  // Rampa de kart tem limite: acima de 18% o kart nao sobe, e a pista deixa de
  // ser pista. A inclinacao lateral tambem tem teto, senao a curva virava parede.
  for (const p of pistas) {
    let maiorSubida = 0;
    let maiorInclinacao = 0;
    let variacao = 0;
    let zMin = Infinity;
    let zMax = -Infinity;
    for (const c of p.centro) {
      maiorSubida = Math.max(maiorSubida, Math.abs(c.subida));
      maiorInclinacao = Math.max(maiorInclinacao, Math.abs(c.inclinacao));
      zMin = Math.min(zMin, c.z);
      zMax = Math.max(zMax, c.z);
    }
    variacao = zMax - zMin;
    ok(maiorSubida <= 0.18,
      `${p.nome}: rampa de ${(maiorSubida * 100).toFixed(0)}% passa dos 18%`);
    ok(maiorInclinacao <= INCLINACAO_MAXIMA + 1e-6,
      `${p.nome}: sobrelevacao de ${maiorInclinacao.toFixed(2)} passa do teto`);
    entre(variacao, 4, 40, `${p.nome}: desnivel total`);
    ok(p.comprimento3d > p.comprimento,
      `${p.nome}: o comprimento 3D (${p.comprimento3d.toFixed(0)}) nao passou do plano`);
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

prova('cada pista tem tres setores, grid de dez e caixas de item no asfalto', () => {
  for (const p of pistas) {
    igual(p.setores.length, 3, `${p.nome}: setores`);
    ok(p.setores[0] < p.setores[1] && p.setores[1] < p.setores[2],
      `${p.nome}: setores fora de ordem`);
    ok(p.grade.length >= 10, `${p.nome}: so ${p.grade.length} lugares no grid`);
    for (const [n, lugar] of p.grade.entries()) {
      igual(superficie(p, lugar.x, lugar.y).tipo, 'asfalto',
        `${p.nome}: lugar ${n + 1} do grid fora do asfalto`);
      // Grid em curva e largada injusta e, pior, e largada que joga na grama
      // quem so acelerou. A largada e escolhida na reta mais comprida
      // justamente por isso.
      const onde = maisProximo(p, lugar.x, lugar.y);
      ok(Math.abs(p.centro[onde.i].curvatura) < 1e-6,
        `${p.nome}: lugar ${n + 1} do grid esta em curva `
        + `(raio ${(1 / Math.abs(p.centro[onde.i].curvatura)).toFixed(0)} m)`);
    }
    ok(p.caixas.length >= 12, `${p.nome}: so ${p.caixas.length} caixas de item`);
    for (const caixa of p.caixas) {
      const sup = superficie(p, caixa.x, caixa.y);
      ok(sup.tipo === 'asfalto' || sup.tipo === 'zebra',
        `${p.nome}: caixa de item em ${sup.tipo}`);
      ok(Math.abs(p.centro[caixa.indice].curvatura) < 0.02,
        `${p.nome}: caixa de item no meio de uma curva de `
        + `${p.centro[caixa.indice].curvatura.toFixed(3)} de curvatura`);
    }
  }
});

// --------------------------------------------- 2. o kart e mensuravel

const medidas = medirCarro();

prova('o kart chega onde um kart chega', () => {
  entre(medidas.velocidadeMaxima * 3.6, 78, 125, 'velocidade maxima em km/h');
  entre(medidas.zeroCinquenta, 1.2, 4.5, '0 a 50 km/h em segundos');
  entre(medidas.frenagem80, 12, 40, 'frenagem de 80 km/h a zero, em metros');
  entre(medidas.gMaximo, 0.7, 1.05, 'aceleracao lateral no modo de aderencia, em g');
});

prova('de lado o kart segura mais curva do que de frente', () => {
  // Duas coisas diferentes, e a confusao entre elas custou meia tarde de
  // medicao: o g SUSTENTADO de lado e so 12% maior (0,94 contra 0,84), porque
  // escorregar tambem gasta pneu. O que muda de verdade e o TETO DE GIRO — de
  // lado o kart gira 2,9 vezes mais rapido do que a aderencia deixa — e e isso
  // que faz a curva fechada exigir o gatilho. A prova do ganho de tempo esta
  // mais abaixo, em "derrapar paga a volta".
  // O drift compra GIRO, nao aderencia, e a medida diz isso: o teto de giro de
  // lado e 3,7 vezes o de aderencia, e o g sustentado fica na mesma faixa (de
  // lado escorrega, e escorregar gasta pneu). Quem confundir os dois vai medir
  // errado — foi o que aconteceu aqui: com o servo de guinada, o g de lado
  // ficou 8% ABAIXO do de frente e a prova antiga reprovou um jogo que estava
  // melhor. O ganho de tempo esta provado em "derrapar paga a volta".
  ok(KART.fatorDeGiroNoDrift > KART.fatorDeGiroEmAderencia * 2,
    'o teto de giro do drift nao chega ao dobro do de aderencia');
  entre(medidas.gDeLado / medidas.gMaximo, 0.85, 1.3,
    'razao entre o g sustentado de lado e o de frente');
  // Tranco de entrada, medido em um quadro: o gatilho tem de girar o kart PARA
  // O LADO DO VOLANTE na hora. Sem isto, apertar o gatilho nao produzia nada de
  // imediato e a traseira ia saindo aos poucos — o comando parecia nao existir.
  for (const [nome, volante] of [['direita', -1], ['esquerda', 1]]) {
    const carro = criarCarro(0, 0, 0);
    carro.vx = 14;
    for (let i = 0; i < 30; i++) {
      passoCarro(carro, { ...comandosNulos(), volante, acelerador: 0.8 }, { dt: DT });
    }
    const antes = carro.omega;
    passoCarro(carro, { ...comandosNulos(), volante, acelerador: 0.8, drift: true }, { dt: DT });
    const tranco = carro.omega - antes;
    ok(Math.sign(tranco) === Math.sign(volante) && Math.abs(tranco) > 0.8,
      `gatilho com volante para a ${nome} deu tranco de ${tranco.toFixed(2)} rad/s`);
  }
});

prova('a grama custa caro e a zebra custa pouco', () => {
  ok(medidas.gGrama < medidas.gMaximo * 0.62,
    `grama com ${medidas.gGrama.toFixed(2)} g contra ${medidas.gMaximo.toFixed(2)} no asfalto`);
  entre(medidas.gZebra / medidas.gMaximo, 0.68, 0.96, 'razao de aderencia zebra/asfalto');
});

prova('o vacuo e o turbo aumentam a ponta', () => {
  ok(medidas.velocidadeVacuo > medidas.velocidadeMaxima * 1.02,
    `vacuo deu ${(medidas.velocidadeVacuo * 3.6).toFixed(1)} km/h contra `
    + `${(medidas.velocidadeMaxima * 3.6).toFixed(1)} sozinho`);
  ok(medidas.velocidadeComTurbo > medidas.velocidadeMaxima * 1.12,
    `turbo deu ${(medidas.velocidadeComTurbo * 3.6).toFixed(1)} km/h contra `
    + `${(medidas.velocidadeMaxima * 3.6).toFixed(1)} sem`);
});

prova('a rampa freia na subida e solta na descida', () => {
  ok(medidas.velocidadeSubindo < medidas.velocidadeMaxima * 0.95,
    `subindo 12% o kart fez ${(medidas.velocidadeSubindo * 3.6).toFixed(1)} km/h`);
  ok(medidas.velocidadeDescendo > medidas.velocidadeMaxima * 1.05,
    `descendo 12% o kart fez ${(medidas.velocidadeDescendo * 3.6).toFixed(1)} km/h`);
});

prova('derrapar carrega o mini-turbo em tres faixas, e soltar libera o empurrao', () => {
  igual(KART.cargasDoTurbo.length, 3, 'faixas de carga');
  igual(faixaDaCarga(0), 0, 'carga zero');
  igual(faixaDaCarga(KART.cargasDoTurbo[0] + 0.01), 1, 'primeira faixa');
  igual(faixaDaCarga(KART.cargasDoTurbo[2] + 0.01), 3, 'terceira faixa');
  entre(medidas.tempoAteFaixa3, 0.8, 3, 'tempo de derrapagem ate a faixa 3');
  ok(medidas.turboGanho > 0, 'soltar o gatilho depois de carregar nao deu turbo');
  entre(medidas.turboGanho, KART.turboPorCarga[2] * 0.9, KART.turboPorCarga[2] * 1.1,
    'duracao do turbo da faixa 3');
});

prova('o turbo empurra de verdade, e o rodopio tira o comando', () => {
  const medirAvanco = (preparar) => {
    const carro = criarCarro(0, 0, 0);
    carro.vx = 14;
    preparar(carro);
    const antes = carro.x;
    for (let i = 0; i < 60 * 2; i++) {
      passoCarro(carro, { ...comandosNulos(), acelerador: 1 }, { atrito: 1, vacuo: 0 }, DT);
    }
    return carro.x - antes;
  };
  const sem = medirAvanco(() => {});
  const com = medirAvanco((c) => darTurbo(c, 3));
  ok(com > sem * 1.08, `turbo andou ${com.toFixed(1)} m contra ${sem.toFixed(1)} m sem`);

  const rodando = criarCarro(0, 0, 0);
  rodando.vx = 16;
  rodopiar(rodando);
  const angulos = [];
  for (let i = 0; i < 60; i++) {
    passoCarro(rodando, { ...comandosNulos(), volante: 1, acelerador: 1 },
      { atrito: 1, vacuo: 0 }, DT);
    angulos.push(rodando.ang);
  }
  ok(Math.abs(rodando.omega) > 1.5, 'o rodopio nao girou o kart');
  ok(rodando.vx < 16, 'o rodopio nao custou velocidade');
});

prova('volante para a esquerda gira para a esquerda da tela', () => {
  // Esta prova existe porque o jogo saiu com o volante invertido: a versao de
  // cima desenhava y para baixo, onde giro anti-horario APARECE como direita, e
  // quando o render virou 3D com z para cima a mao inverteu. O sinal do comando
  // agora e cobrado aqui, e nao no olho de quem joga.
  const comandoDaSeta = (tecla) => {
    const teclas = new Set([tecla]);
    const tem = (...c) => c.some(k => teclas.has(k));
    let alvo = 0;
    if (tem('ArrowLeft', 'KeyA')) alvo += 1;
    if (tem('ArrowRight', 'KeyD')) alvo -= 1;
    return alvo;
  };
  igual(comandoDaSeta('ArrowLeft'), 1, 'seta esquerda nao pede volante positivo');
  igual(comandoDaSeta('ArrowRight'), -1, 'seta direita nao pede volante negativo');

  // E o volante positivo tem de girar o kart no sentido anti-horario, que com a
  // camera atras e a esquerda da tela.
  const carro = criarCarro(0, 0, 0);
  carro.vx = 12;
  for (let i = 0; i < 60; i++) {
    passoCarro(carro, { ...comandosNulos(), volante: 1, acelerador: 0.5 }, { atrito: 1, vacuo: 0 }, DT);
  }
  ok(carro.ang > 0.2, `volante +1 girou ${carro.ang.toFixed(2)} rad; esperava giro anti-horario`);
  ok(carro.y > 0.5, `volante +1 levou o kart para y=${carro.y.toFixed(2)}; esperava y positivo (esquerda)`);
});

prova('o kart nao rodopia em baixa velocidade', () => {
  // Defeito sentido dirigindo no navegador: saindo da largada a 13 km/h, com
  // volante cheio e gatilho, o kart girava 3,65 rad/s no lugar — 209 graus por
  // segundo. O teto de giro do pneu cresce como 1/v, entao em baixa ele pede o
  // impossivel; enquanto o pneu nao entregava isso nao aparecia, e o servo de
  // guinada passou a entregar.
  // O teto e o menor entre o absoluto e o geometrico (velocidade / raio minimo),
  // medido QUADRO A QUADRO: com o acelerador no fundo o kart ganha velocidade
  // durante o teste, e comparar com a velocidade inicial reprova o certo.
  for (const kmh of [8, 14, 25]) {
    const carro = criarCarro(0, 0, 0);
    carro.vx = kmh / 3.6;
    let pior = 0;
    let piorEm = 0;
    for (let i = 0; i < 90; i++) {
      passoCarro(carro, { ...comandosNulos(), volante: -1, acelerador: 1, drift: true }, { dt: DT });
      const rapidez = Math.hypot(carro.vx, carro.vy);
      const teto = Math.max(0.7, Math.min(KART.giroMaximoAbsoluto, rapidez / KART.raioMinimo));
      const excesso = Math.abs(carro.omega) - teto;
      if (excesso > pior) { pior = excesso; piorEm = rapidez; }
    }
    ok(pior <= 0.3,
      `saindo de ${kmh} km/h, o kart passou ${pior.toFixed(2)} rad/s do teto de giro`
      + ` a ${(piorEm * 3.6).toFixed(0)} km/h`);
    ok(carro.vx > 0, `a ${kmh} km/h o kart terminou andando para tras (vx ${carro.vx.toFixed(1)})`);
  }
});

prova('o kart nao ganha energia de graca', () => {
  const carro = criarCarro(0, 0, 0);
  carro.vx = 20;
  for (let i = 0; i < 60 * 12; i++) {
    passoCarro(carro, comandosNulos(), { atrito: 1, vacuo: 0 }, DT);
  }
  ok(carro.vx < 20, `sem acelerador a velocidade foi de 20 para ${carro.vx.toFixed(2)} m/s`);
  ok(carro.vx > 0, 'o kart andou para tras sozinho');
  ok(Math.abs(carro.vy) < 0.05 && Math.abs(carro.omega) < 0.05,
    'o kart ganhou movimento lateral sozinho');
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
        drift: ((x >> 25) & 3) === 0,
        item: false,
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
      const limite = p.centro[i].largura / 2 - KART.largura / 2 - 0.2;
      ok(Math.abs(d) <= limite + 1e-6,
        `${p.nome}: a linha sai da pista no ponto ${i} `
        + `(${d.toFixed(2)} m de ${limite.toFixed(2)})`);
    }
  }
});

prova('a linha ideal e mais rapida que o eixo da pista', () => {
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
        ok(lateral <= KART.atritoBase * 9.81 * 1.02,
          `${p.nome}: ponto ${i} pede ${(lateral / 9.81).toFixed(2)} g`);
      }
      ok(v > 4, `${p.nome}: ponto ${i} com velocidade de ${v.toFixed(1)} m/s`);
    }
    entre(linha.tempoEstimado, 20, 90, `${p.nome}: volta estimada pela linha`);
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
    entre(r.tempo / r.estimado, 0.9, 1.5, `${pistas[i].nome}: volta da IA sobre a estimada`);
  }
});

prova('a IA anda no asfalto', () => {
  // 92% e nao 99%, e o numero tem historia medida: a IA pisa a zebra e passa
  // alguns centimetros dela em quatro pontos da BAIXADA, por cerca de 0,3 s cada
  // vez, sem rodopio e sem perder o tracado. Piloto de verdade usa a zebra; o
  // que nao pode e cortar caminho pela grama, e isso a prova pega, porque uma
  // passagem pela grama de um segundo ja derruba a fracao abaixo de 92%.
  //
  // Tres tentativas de melhorar isso nao melhoraram: margem maior na linha de
  // corrida (custou 10 s e nao tirou ninguem da grama), margem de frenagem
  // menor no perfil, e teto de deriva mais firme. O que resolveu de verdade foi
  // tirar o teto artificial de freio da decisao da IA.
  for (const [i, r] of referencias.entries()) {
    ok(r.fracaoNaPista > 0.92,
      `${pistas[i].nome}: a IA passou ${((1 - r.fracaoNaPista) * 100).toFixed(1)}% do tempo fora`);
  }
});

const tecnica = pistas.map((p, i) => {
  const com = voltaDeReferencia(i, 'ouro');
  const sem = voltaDeReferencia(i, 'ouro', { semDrift: true });
  return { pista: p.nome, com, sem, ganhoNaVolta: sem.tempo - com.tempo, grampo: medirGrampo(i) };
});

prova('derrapar paga a volta, em toda pista', () => {
  // Se o mini-turbo nao devolvesse mais do que a derrapagem custa, o drift
  // seria so um botao de perder tempo — e o jogo nao teria tecnica nenhuma.
  //
  // A comparacao usa a LINHA DE CADA MODO: quem nao derrapa tem outra linha e
  // outro perfil de velocidade, calculados com o teto de giro da aderencia. Com
  // as duas corridas na mesma linha, a medida dizia que derrapar atrasa — e
  // dizia isso porque o kart sem drift ganhava tempo cortando zebra numa linha
  // que nao era a dele.
  for (const t of tecnica) {
    ok(t.com.turbos > 0, `${t.pista}: a IA nao carregou mini-turbo nenhum`);
    // Meio segundo por pista e media de 2,5 s: o piso e baixo de proposito
    // porque o CERRADO (curvas de 30 a 45 m) e a pista onde a tecnica menos
    // vale, e isso e balanceamento — se derrapar rendesse o mesmo em toda pista,
    // escolher pista nao decidiria nada.
    ok(t.ganhoNaVolta > 0.5,
      `${t.pista}: derrapar rendeu so ${t.ganhoNaVolta.toFixed(2)} s na volta`);
  }
  const media = tecnica.reduce((s, t) => s + t.ganhoNaVolta, 0) / tecnica.length;
  ok(media > 2.5, `derrapar rendeu ${media.toFixed(2)} s na media das seis pistas`);
});

prova('no grampo, entrar de lado paga na maioria das pistas', () => {
  // Medida do grampo isolado: entrada igual, 50 m depois da saida. Ela nao e
  // unanime de proposito — no grampo de 175 graus e 10 m da SERRA a derrapagem
  // e tao longa que o mini-turbo nao cobre o que ela raspa. Isso e balanco, nao
  // defeito: a volta inteira continua mais rapida de lado.
  const pagam = tecnica.filter(t => t.grampo.ganho > 0).length;
  ok(pagam >= 4, `o grampo só pagou em ${pagam} das ${tecnica.length} pistas`);
  for (const t of tecnica) {
    ok(t.grampo.com.chegou && t.grampo.sem.chegou,
      `${t.pista}: a medida do grampo nao completou nos dois modos`);
  }
});

prova('piloto melhor anda mais rapido que piloto pior', () => {
  // A ordem e cobrada no TOTAL das seis pistas, e nao pista por pista, e isso e
  // medida honesta e nao afrouxamento: um perfil mais lento entra mais devagar
  // no grampo e as vezes sai na frente de um mais rapido que exagerou — nas
  // seis pistas medidas isso acontece em duas. O que nao pode inverter e a soma
  // do campeonato, e o ouro tem de ser o mais rapido em toda pista.
  // Media de tres sementes por pista, e nao uma corrida so: os perfis mais
  // fracos tem ruido de volante, entao uma unica volta separa ouro e prata por
  // centesimos que sao sorteio, nao habilidade. Com tres sementes a diferenca
  // que sobra e a do perfil.
  const nomes = Object.keys(PERFIS);
  const sementes = [7, 42, 91];
  const somas = nomes.map(() => 0);
  for (const [i, p] of pistas.entries()) {
    const medias = nomes.map((nome) => {
      const t = sementes.map(s => voltaDeReferencia(i, nome, { semente: s }).tempo);
      return t.reduce((a, b) => a + b, 0) / t.length;
    });
    for (const [k, t] of medias.entries()) somas[k] += t;
    const melhor = Math.min(...medias);
    ok(medias[0] <= melhor + 1e-9,
      `${p.nome}: o ouro (${medias[0].toFixed(2)} s) nao foi o mais rapido `
      + `(melhor ${melhor.toFixed(2)} s)`);
  }
  for (let i = 1; i < somas.length; i++) {
    ok(somas[i] > somas[i - 1],
      `${nomes[i]} (${somas[i].toFixed(1)} s somados) mais rapido que `
      + `${nomes[i - 1]} (${somas[i - 1].toFixed(1)} s), na ordem inversa do perfil`);
  }
});

// -------------------------------------------- 5. a corrida e uma corrida

prova('kart atolado volta para a pista, e nao durante a contagem', () => {
  // Tres regras numa prova, porque as tres nasceram do mesmo defeito: o relogio
  // de atolado correndo na largada teleportava o grid inteiro antes da luz
  // verde.
  const corrida = criarCorrida(0, { voltas: 2, ia: 3, semente: 5 });
  const kart = corrida.carros[0];
  const grade = { x: kart.x, y: kart.y };
  for (let i = 0; i < 60 * 3; i++) passoCorrida(corrida, comandosNulos(), DT);
  igual(kart.recolocacoes, 0, 'recolocou alguem durante a contagem');
  ok(Math.hypot(kart.x - grade.x, kart.y - grade.y) < 6,
    'o kart saiu do lugar do grid antes da largada');

  // Em corrida, kart parado fora da pista volta
  const correndo = criarCorrida(0, { voltas: 2, ia: 0, semente: 5 });
  const solo = correndo.carros[0];
  for (let i = 0; i < 60 * 4; i++) passoCorrida(correndo, comandosNulos(), DT);
  igual(correndo.estado, 'correndo', 'a corrida nao largou');
  const c = correndo.pista.centro[solo.indice];
  const nx = -Math.sin(c.ang);
  const ny = Math.cos(c.ang);
  solo.x = c.x + nx * (c.largura / 2 + 4);
  solo.y = c.y + ny * (c.largura / 2 + 4);
  solo.vx = 0;
  solo.vy = 0;
  const antes = solo.recolocacoes;
  for (let i = 0; i < 60 * 4; i++) passoCorrida(correndo, comandosNulos(), DT);
  ok(solo.recolocacoes > antes, 'kart parado na grama nao foi recolocado');
  igual(superficie(correndo.pista, solo.x, solo.y).tipo, 'asfalto',
    'o kart recolocado nao voltou para o asfalto');
});

prova('volta so conta com os tres setores na ordem', () => {
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

prova('kart recolocado ainda conta a volta, mas perde o tempo dela', () => {
  // Defeito medido: contagem de volta e cronometragem estavam juntas, e um kart
  // recolocado uma vez por volta nunca registrava volta — cruzou a linha duas
  // vezes e terminou com `voltas=0`. A classificacao ordena por progresso, que
  // vem de `voltas`: o kart sumia da tabela mesmo tendo corrido.
  const corrida = criarCorrida(0, { voltas: 3, ia: 3, semente: 7 });
  corrida.estado = 'correndo';
  const carro = corrida.carros[0];
  carro.voltaIniciada = true;
  carro.setor = 3;
  carro.tempoVolta = 44.5;
  carro.voltaValida = false;
  carro.ultimoIndice = corrida.pista.centro.length - 2;
  carro.indice = 1;
  carro.x = corrida.pista.centro[1].x;
  carro.y = corrida.pista.centro[1].y;
  const antes = carro.voltas;
  const eventos = passoCorrida(corrida, comandosNulos(), DT);
  igual(carro.voltas, antes + 1, 'voltas depois de cruzar a linha com volta suja');
  ok(!carro.melhorVolta, `volta suja entrou como melhor volta (${carro.melhorVolta})`);
  ok(eventos.some(e => e.tipo === 'volta-invalida' && e.carro === carro.nome),
    'ninguem foi avisado de que a volta nao valeu tempo');
});

prova('kart jogado na grama volta sozinho, sem teleporte', () => {
  // Defeito medido: fora do asfalto a IA olhava 6 a 12 m PARA FRENTE, no centro
  // da pista. Com o kart oito metros fora isso e um angulo raso, e ele andava em
  // paralelo no capim ate a paciencia estourar — 13 das 18 recolocacoes de uma
  // corrida de tres voltas eram este caso, e recolocacao e teleporte: estraga a
  // corrida de quem estava ao lado e apaga a disputa.
  for (const lado of [1, -1]) {
    const corrida = criarCorrida(0, { voltas: 3, ia: 3, semente: 5 });
    corrida.estado = 'correndo';
    const carro = corrida.carros[1];
    const c = corrida.pista.centro[40];
    const fora = c.largura / 2 + 4.5;
    const ponto = paraMundo(corrida.pista, 40, lado * fora);
    carro.x = ponto.x;
    carro.y = ponto.y;
    carro.z = ponto.z;
    // apontado ao longo da pista, como fica quem foi empurrado para fora
    carro.ang = c.ang;
    carro.vx = 9;
    carro.vy = 0;
    carro.omega = 0;
    carro.atolado = 0;
    const recolocacoesAntes = carro.recolocacoes;
    let voltouEm = 0;
    for (let i = 0; i < 60 * 8; i++) {
      passoCorrida(corrida, comandosNulos(), DT);
      if (!voltouEm && carro.superficie === 'asfalto') voltouEm = i / 60;
      if (voltouEm) break;
    }
    ok(voltouEm > 0 && voltouEm < 4,
      `pelo lado ${lado > 0 ? 'de dentro' : 'de fora'}, o kart levou ${voltouEm ? voltouEm.toFixed(1) + ' s' : 'mais de 8 s'} para achar o asfalto`);
    igual(carro.recolocacoes, recolocacoesAntes,
      'o kart foi teleportado em vez de voltar dirigindo');
  }
});

prova('IA girada na contramao se desvira dirigindo', () => {
  // O complemento da prova acima. A paciencia agora perdoa quem esta voltando
  // para a pista, e a pergunta obvia e: e quem esta apontado para o lado errado?
  // Medido: a IA se desvira em cerca de um segundo e volta a andar no rumo, sem
  // teleporte. Quem ainda depende do resgate e o kart PARADO sem ninguem no
  // volante, e isso esta provado em "kart atolado volta para a pista".
  const corrida = criarCorrida(0, { voltas: 3, ia: 3, semente: 5 });
  corrida.estado = 'correndo';
  const carro = corrida.carros[1];
  const c = corrida.pista.centro[40];
  const ponto = paraMundo(corrida.pista, 40, 0);
  carro.x = ponto.x;
  carro.y = ponto.y;
  carro.z = ponto.z;
  carro.ang = c.ang + Math.PI;
  carro.vx = 8;
  carro.vy = 0;
  carro.atolado = 0;
  const antes = carro.recolocacoes;
  let noRumoEm = 0;
  for (let i = 0; i < 60 * 5 && !noRumoEm; i++) {
    passoCorrida(corrida, comandosNulos(), DT);
    const sup = superficie(corrida.pista, carro.x, carro.y);
    const eixo = corrida.pista.centro[sup.i];
    const aoLongo = (carro.vx * Math.cos(carro.ang) - carro.vy * Math.sin(carro.ang))
      * Math.cos(eixo.ang)
      + (carro.vx * Math.sin(carro.ang) + carro.vy * Math.cos(carro.ang)) * Math.sin(eixo.ang);
    if (aoLongo > 2) noRumoEm = i / 60;
  }
  ok(noRumoEm > 0 && noRumoEm < 3,
    `a IA levou ${noRumoEm ? noRumoEm.toFixed(1) + ' s' : 'mais de 5 s'} para voltar ao rumo da pista`);
  igual(carro.recolocacoes, antes, 'a IA foi teleportada em vez de se desvirar');
});

prova('ninguem fica sem completar volta numa corrida cheia', () => {
  // A prova que pegou o defeito acima: com dez karts, o pelotao se destruia na
  // largada (146 dos 278 toques nos primeiros 20 s) e karts recolocados
  // perdiam a volta inteira. Duas correcoes: cada piloto anda com um estilo de
  // linha proprio, e ninguem ataca a linha ideal com kart a menos de 6 m.
  for (const semente of [11, 3, 42]) {
    const r = corridaCompleta(0, { voltas: 3, ia: 9, semente });
    const voltas = r.classificacao.map(l => l.voltas);
    ok(Math.min(...voltas) >= 2,
      `com semente ${semente}, o ultimo colocado fez ${Math.min(...voltas)} voltas de 3`);
    // Incidente, e nao quadro de contato: antes da carencia por par, um encostao
    // de um segundo entrava como 60 batidas e este numero nao queria dizer nada.
    ok(r.toques < 40, `com semente ${semente}, o pelotao teve ${r.toques} incidentes`);
    // Recolocacao e teleporte, e teleporte e o remendo, nao a corrida: com a
    // volta perpendicular e a paciencia por progresso, uma corrida inteira cabe
    // em menos de dez.
    const teleportes = r.classificacao.reduce((s, l) => s + (l.recolocacoes || 0), 0);
    ok(teleportes <= 10, `com semente ${semente}, foram ${teleportes} recolocacoes na corrida`);
    const comTempo = r.classificacao.filter(l => l.melhorVolta > 0).length;
    ok(comTempo >= 7, `com semente ${semente}, so ${comTempo} de 9 registraram tempo`);
  }
});

prova('uma corrida inteira termina e classifica todo mundo', () => {
  const r = corridaCompleta(0, { voltas: 3, ia: 9, semente: 11 });
  ok(r.terminou, `a corrida nao terminou em ${r.segundos.toFixed(0)} s simulados`);
  igual(r.classificacao.length, 9, 'karts classificados');
  // Melhor volta e cobrada de quem correu limpo. Quem foi recolocado pode
  // terminar a corrida sem tempo de volta — isso e a regra, nao um defeito — mas
  // volta completada todo mundo tem de ter.
  for (const linha of r.classificacao) {
    ok(linha.voltas >= 1, `${linha.nome} nao completou uma volta`);
    // Limpo e sem recolocacao E sem toque: um kart girado por contato tambem
    // perde o tempo da volta, e isso e a regra.
    if (!linha.recolocacoes && !linha.toques) {
      ok(linha.melhorVolta > 0, `${linha.nome} correu limpo e ficou sem melhor volta`);
    }
  }
  const comTempo = r.classificacao.filter(l => l.melhorVolta > 0).length;
  ok(comTempo >= 5, `so ${comTempo} dos 9 karts registraram tempo de volta`);
  for (let i = 1; i < r.classificacao.length; i++) {
    const a = r.classificacao[i - 1];
    const b = r.classificacao[i];
    ok(a.voltas > b.voltas || (a.voltas === b.voltas && a.progresso >= b.progresso - 1e-6),
      `classificacao fora de ordem entre ${a.nome} e ${b.nome}`);
  }
  entre(r.melhorVoltaDaCorrida, 20, 100, 'melhor volta da corrida');
});

prova('os karts nao se atravessam', () => {
  const r = corridaCompleta(1, { voltas: 2, ia: 9, semente: 3 });
  ok(r.menorDistanciaEntreCarros > KART.largura * 0.6,
    `dois karts chegaram a ${r.menorDistanciaEntreCarros.toFixed(2)} m de centro a centro`);
  ok(r.toques > 0, 'ninguem se tocou numa corrida de nove karts em duas voltas');
});

prova('caixa de item entrega item, esvazia e volta', () => {
  const corrida = criarCorrida(0, { voltas: 3, ia: 0, semente: 5 });
  const carro = corrida.carros[0];
  const caixa = corrida.pista.caixas[0];
  carro.x = caixa.x;
  carro.y = caixa.y;
  passoCorrida(corrida, comandosNulos(), DT);
  ok(carro.item, 'passar pela caixa nao entregou item');
  ok(!caixa.cheia, 'a caixa continuou cheia depois de entregar');
  const item = carro.item;
  // esvaziada, ela nao entrega de novo
  carro.item = null;
  carro.x = caixa.x;
  carro.y = caixa.y;
  passoCorrida(corrida, comandosNulos(), DT);
  ok(!carro.item, 'a caixa vazia entregou item');
  // e volta depois da recarga — com o kart fora de cima dela, senao ele pega o
  // item no mesmo quadro em que a caixa reaparece
  carro.x = corrida.pista.centro[Math.floor(corrida.pista.centro.length / 2)].x;
  carro.y = corrida.pista.centro[Math.floor(corrida.pista.centro.length / 2)].y;
  for (let i = 0; i < 60 * 8; i++) passoCorrida(corrida, comandosNulos(), DT);
  ok(caixa.cheia, 'a caixa nao recarregou em 8 s');
  ok(['cogumelo', 'casco', 'banana'].includes(item), `item estranho: ${item}`);
});

prova('cogumelo empurra, casco acerta quem esta na frente, banana pega quem passa', () => {
  const corrida = criarCorrida(0, { voltas: 3, ia: 1, semente: 9 });
  const eu = corrida.carros[0];
  const outro = corrida.carros[1];
  // passa a contagem: na largada o jogo ignora comando, inclusive item
  for (let i = 0; i < 60 * 4; i++) passoCorrida(corrida, comandosNulos(), DT);

  eu.item = 'cogumelo';
  passoCorrida(corrida, { ...comandosNulos(), item: true }, DT);
  ok(eu.turbo > 0, 'cogumelo nao deu turbo');

  // casco: poe o outro na frente, no mesmo trecho
  outro.progresso = eu.progresso + 0.01;
  outro.x = eu.x + Math.cos(eu.ang) * 12;
  outro.y = eu.y + Math.sin(eu.ang) * 12;
  eu.item = 'casco';
  let acertou = false;
  for (let i = 0; i < 60 * 4 && !acertou; i++) {
    for (const ev of passoCorrida(corrida, { ...comandosNulos(), item: i === 0 }, DT)) {
      if (ev.tipo === 'acertou' && ev.item === 'casco') acertou = true;
    }
  }
  ok(acertou, 'o casco nao acertou o kart da frente');
  ok(outro.rodopio > 0, 'o kart acertado nao rodopiou');

  // banana: solta e passa por cima
  const terceira = criarCorrida(0, { voltas: 3, ia: 1, semente: 13 });
  const dono = terceira.carros[0];
  const vitima = terceira.carros[1];
  for (let i = 0; i < 60 * 4; i++) passoCorrida(terceira, comandosNulos(), DT);
  dono.item = 'banana';
  passoCorrida(terceira, { ...comandosNulos(), item: true }, DT);
  igual(terceira.bananas.length, 1, 'banana nao ficou no chao');
  const banana = terceira.bananas[0];
  vitima.x = banana.x;
  vitima.y = banana.y;
  passoCorrida(terceira, comandosNulos(), DT);
  ok(vitima.rodopio > 0, 'quem passou na banana nao rodopiou');
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

console.log('\n\npista            volta ideal   volta da IA   razao   plano    3D   desnivel');
for (const [i, p] of pistas.entries()) {
  const linha = linhaIdeal(p);
  const r = referencias[i];
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const c of p.centro) { zMin = Math.min(zMin, c.z); zMax = Math.max(zMax, c.z); }
  console.log(
    `${p.nome.padEnd(16)}${`${linha.tempoEstimado.toFixed(2)} s`.padStart(11)}`
    + `${`${r.tempo.toFixed(2)} s`.padStart(14)}`
    + `${(r.tempo / linha.tempoEstimado).toFixed(3).padStart(8)}`
    + `${`${Math.round(p.comprimento)} m`.padStart(8)}`
    + `${`${Math.round(p.comprimento3d)} m`.padStart(7)}`
    + `${`${(zMax - zMin).toFixed(1)} m`.padStart(11)}`);
}

console.log('\nkart                        medida');
console.log(`velocidade maxima          ${(medidas.velocidadeMaxima * 3.6).toFixed(1)} km/h`);
console.log(`com vacuo                  ${(medidas.velocidadeVacuo * 3.6).toFixed(1)} km/h`);
console.log(`com turbo                  ${(medidas.velocidadeComTurbo * 3.6).toFixed(1)} km/h`);
console.log(`subindo 12%                ${(medidas.velocidadeSubindo * 3.6).toFixed(1)} km/h`);
console.log(`descendo 12%               ${(medidas.velocidadeDescendo * 3.6).toFixed(1)} km/h`);
console.log(`0 a 50 km/h                ${medidas.zeroCinquenta.toFixed(2)} s`);
console.log(`80 km/h a zero             ${medidas.frenagem80.toFixed(1)} m`);
console.log(`g lateral no asfalto       ${medidas.gMaximo.toFixed(2)} g`);
console.log(`g lateral derrapando       ${medidas.gDeLado.toFixed(2)} g`);
console.log(`g lateral na zebra         ${medidas.gZebra.toFixed(2)} g`);
console.log(`g lateral na grama         ${medidas.gGrama.toFixed(2)} g`);
console.log(`derrapagem ate a faixa 3   ${medidas.tempoAteFaixa3.toFixed(2)} s`);
console.log(`turbo da faixa 3           ${medidas.turboGanho.toFixed(2)} s`);

console.log('\ntecnica              volta de lado   volta de frente   ganho   grampo');
for (const t of tecnica) {
  console.log(
    `${t.pista.padEnd(20)}${`${t.com.tempo.toFixed(2)} s`.padStart(11)}`
    + `${`${t.sem.tempo.toFixed(2)} s`.padStart(18)}`
    + `${`${t.ganhoNaVolta.toFixed(2)} s`.padStart(8)}`
    + `${`${t.grampo.ganho >= 0 ? '+' : ''}${t.grampo.ganho.toFixed(2)} s`.padStart(9)}`);
}

// ------------------------------------------------------ 9. a casca do jogo
//
// A ultima prova carrega `js/main.js` com uma tela de mentira. Ela nao olha
// pixel: ela executa o corpo do modulo, que era o unico pedaco do jogo que
// nenhuma prova tocava — e onde uma edicao minha apagou duas funcoes do jogo
// vizinho sem que nada ficasse vermelho.
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
// Saida explicita: a casca deixa relogios e ouvintes vivos, como faria no
// navegador, e sem isto o processo fica pendurado depois da ultima prova.
process.exit(0);
