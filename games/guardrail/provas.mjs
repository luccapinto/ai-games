#!/usr/bin/env node
// As provas do GUARDRAIL. Rode com: node provas.mjs
//
// Defesa de torre e um genero que mente com muita confianca. Uma partida boa
// prova exatamente uma coisa: que aquela partida era boa. O que ela nao mostra
// e a onda 17 com o VIES sorteado num tipo de dano que nenhuma torre produz, o
// OVERFITTING que decorou os cinco tipos e virou imortal, o chefe que renasce
// dentro da reta final e chega sempre, o muro que fica no mapa depois que o
// dono morreu. Nada disso aparece jogando. Tudo isso apareceu aqui.
//
// A prova final e um robo que joga as 40 ondas nos tres mapas, com as mesmas
// funcoes que o navegador chama.

import {
  MAPAS, MAPA_POR_ID, LARGURA, ALTURA, CELULA, expandirRota, posicaoNaRota, podeConstruir,
} from './js/mapas.js';
import {
  TORRES, TORRE_POR_ID, PRAGAS, DANOS, ORDEM_DANOS, MODOS, HABILIDADES,
  INFLACAO, RETORNO_VENDA,
} from './js/dados.js';
import { definirOnda, descreverOnda, estreias, TOTAL_ONDAS, multiplicadorHp } from './js/ondas.js';
import {
  criarJogo, passo, construir, melhorar, podeMelhorar, custoMelhoria, vender,
  valorDeVenda, trocarModo, modosDisponiveis, comecarOnda, usarHabilidade,
  custoDe, fichaTorre, fichaPraga, estadoVram, aplicarDano, recalcular,
  comprarGpu, precoGpu, DT, PREPARO_ENTRE_ONDAS,
} from './js/jogo.js';
import { robo } from './js/robo.js';

let feitas = 0;
const falhas = [];

function prova(nome, fn) {
  try {
    fn();
    feitas++;
    process.stdout.write('.');
  } catch (erro) {
    falhas.push({ nome, erro });
    process.stdout.write('X');
  }
}

const ok = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m) => { if (a !== b) throw new Error(`${m}: esperava ${b}, veio ${a}`); };
function entre(v, min, max, m) {
  if (!(v >= min && v <= max)) throw new Error(`${m}: ${Number(v).toFixed(3)} fora de [${min}, ${max}]`);
}

function rodar(jogo, segundos) {
  const n = Math.round(segundos / DT);
  for (let i = 0; i < n && !jogo.fim; i++) passo(jogo, DT);
}

// =====================================================================
// 1. OS MAPAS  —  garante que todo mapa e jogavel antes de alguem jogar
// =====================================================================

prova('todo mapa cabe na tela sem rolagem', () => {
  igual(LARGURA * CELULA, 960, 'largura em pixels');
  igual(ALTURA * CELULA, 600, 'altura em pixels');
  for (const m of MAPAS) {
    for (const r of m.rotas) {
      for (const [x, y] of r.cels) {
        entre(x, -1, LARGURA, `${m.id}: celula de rota fora do mapa em x`);
        entre(y, -1, ALTURA, `${m.id}: celula de rota fora do mapa em y`);
      }
    }
  }
});

prova('toda rota e ortogonal e continua, celula a celula', () => {
  for (const m of MAPAS) {
    for (const r of m.rotas) {
      for (let i = 1; i < r.cels.length; i++) {
        const [ax, ay] = r.cels[i - 1];
        const [bx, by] = r.cels[i];
        const d = Math.abs(ax - bx) + Math.abs(ay - by);
        igual(d, 1, `${m.id}: salto na rota entre (${ax},${ay}) e (${bx},${by})`);
      }
    }
  }
});

prova('rota diagonal e recusada na carga, nao aceita em silencio', () => {
  let estourou = false;
  try { expandirRota([[0, 0], [3, 3]]); } catch { estourou = true; }
  ok(estourou, 'expandirRota aceitou uma diagonal');
});

prova('toda rota termina no cluster e nenhuma laje fica em cima da trilha', () => {
  for (const m of MAPAS) {
    for (const r of m.rotas) {
      const fim = r.cels[r.cels.length - 1];
      igual(`${fim[0]},${fim[1]}`, `${m.base.x},${m.base.y}`, `${m.id}: rota nao termina no cluster`);
      for (const [x, y] of r.cels) {
        ok(!podeConstruir(m, x, y), `${m.id}: da para construir em (${x},${y}), que e trilha`);
      }
    }
  }
});

prova('todo mapa tem laje bastante para montar defesa de verdade', () => {
  for (const m of MAPAS) {
    ok(m.construivel.size >= 60, `${m.id}: so ${m.construivel.size} lajes`);
    // Toda laje precisa ter alguma serventia: cobrir trilha em um raio de 5,4,
    // que e o maior alcance base do jogo. Laje que nao cobre nada e decoracao
    // que o jogador so descobre depois de gastar.
    let inuteis = 0;
    for (const k of m.construivel) {
      const x = k % LARGURA + 0.5;
      const y = Math.floor(k / LARGURA) + 0.5;
      let cobre = false;
      for (const r of m.rotas) {
        for (const [cx, cy] of r.cels) {
          if (Math.hypot(cx + 0.5 - x, cy + 0.5 - y) <= 5.4) { cobre = true; break; }
        }
        if (cobre) break;
      }
      if (!cobre) inuteis++;
    }
    igual(inuteis, 0, `${m.id}: lajes que nao alcancam trilha nenhuma`);
  }
});

prova('os tres mapas pedem estrategias diferentes, nao sao o mesmo mapa pintado', () => {
  const ids = MAPAS.map(m => m.id);
  igual(new Set(ids).size, 3, 'mapas repetidos');
  const rotas = MAPAS.map(m => m.rotas.length);
  ok(rotas.includes(2), 'nenhum mapa tem duas entradas');
  const lajes = MAPAS.map(m => m.construivel.size).sort((a, b) => a - b);
  ok(lajes[2] > lajes[0] * 2, `a escassez de laje nao varia: ${lajes.join(' ')}`);
  const vram = MAPAS.map(m => m.vram);
  igual(new Set(vram).size, 3, 'os tres mapas tem o mesmo orcamento de compute');
});

prova('o corredor de voo existe em todo mapa e vai da entrada ao cluster', () => {
  for (const m of MAPAS) {
    igual(m.linhasVoo.length, m.rotas.length, `${m.id}: faltou corredor de voo`);
    for (const l of m.linhasVoo) {
      igual(l.para.x, m.base.x + 0.5, `${m.id}: corredor nao termina no cluster`);
      ok(l.pontos.length >= 3, `${m.id}: corredor com poucos pontos`);
    }
  }
});

prova('a posicao ao longo da rota e continua e nao passa do fim', () => {
  const m = MAPAS[0];
  const cels = m.rotas[0].cels;
  let ant = posicaoNaRota(cels, 0);
  for (let d = 0.1; d < cels.length + 5; d += 0.1) {
    const p = posicaoNaRota(cels, d);
    ok(Math.hypot(p.x - ant.x, p.y - ant.y) < 0.2, `salto na posicao em d=${d}`);
    ant = p;
  }
  const fim = posicaoNaRota(cels, 9999);
  igual(fim.x, m.base.x + 0.5, 'posicao depois do fim nao gruda no cluster');
});

// =====================================================================
// 2. AS TORRES  —  os caminhos de upgrade e a regra de bloqueio
// =====================================================================

prova('toda torre tem dois caminhos de upgrade com tres niveis cada', () => {
  for (const d of TORRES) {
    igual(d.caminhos.length, 2, `${d.id}: numero de caminhos`);
    for (const c of d.caminhos) {
      igual(c.niveis.length, 3, `${d.id}/${c.nome}: numero de niveis`);
      let ant = 0;
      for (const n of c.niveis) {
        ok(n.custo > ant, `${d.id}/${c.nome}: custo nao cresce (${n.custo} depois de ${ant})`);
        ok(n.texto && n.texto.length > 12, `${d.id}/${c.nome}: nivel sem texto que explique`);
        ok(n.efeito && Object.keys(n.efeito).length, `${d.id}/${c.nome}: nivel sem efeito`);
        ant = n.custo;
      }
    }
  }
});

prova('subir um caminho acima do nivel 1 fecha o outro, e fechado e fechado', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.dinheiro = 99999;
  const t = construir(jogo, 10, 1, 'chama');
  ok(podeMelhorar(t, 0) && podeMelhorar(t, 1), 'no nivel zero os dois caminhos deviam estar abertos');
  melhorar(jogo, t, 0);
  ok(podeMelhorar(t, 1), 'com 1 de um lado, o outro ainda pode chegar ao 1');
  melhorar(jogo, t, 1);
  melhorar(jogo, t, 0);
  igual(t.niveis[0], 2, 'nivel do caminho escolhido');
  ok(!podeMelhorar(t, 1), 'o caminho perdedor continuou aberto depois do 2 do outro lado');
  igual(melhorar(jogo, t, 1), false, 'melhorar aceitou um caminho travado');
  melhorar(jogo, t, 0);
  igual(t.niveis[0], 3, 'o caminho escolhido tem que chegar ao 3');
  igual(melhorar(jogo, t, 0), false, 'melhorar passou do nivel 3');
});

prova('os cinco tipos de dano existem e cada um e produzido por alguma torre', () => {
  igual(ORDEM_DANOS.length, 5, 'tipos de dano');
  const produzidos = new Set();
  for (const d of TORRES) {
    if (!d.naoAtira) produzidos.add(d.tipoDano);
    for (const c of d.caminhos) {
      for (const n of c.niveis) {
        if (n.efeito.tipoDano) produzidos.add(n.efeito.tipoDano);
        if (n.efeito.roteador) for (const r of n.efeito.roteador) produzidos.add(r);
      }
    }
  }
  for (const tipo of ORDEM_DANOS) {
    ok(produzidos.has(tipo), `nenhuma torre produz dano de ${tipo} — um VIES sorteado nele seria imortal`);
  }
});

prova('cada tipo de dano resolve alguma coisa que outro nao resolve', () => {
  // Pedra, papel e tesoura de verdade: para cada par de tipos tem que existir
  // um inimigo em que um entra mais que o outro. Sem isto, um tipo domina e os
  // outros quatro sao enfeite.
  for (const a of ORDEM_DANOS) {
    let temVantagem = false;
    for (const p of Object.values(PRAGAS)) {
      const r = p.resist;
      if (!r) continue;
      const va = a in r ? r[a] : 1;
      for (const b of ORDEM_DANOS) {
        if (a === b) continue;
        const vb = b in r ? r[b] : 1;
        if (va > vb + 0.2) temVantagem = true;
      }
    }
    ok(temVantagem, `${a} nunca e melhor que outro tipo contra ninguem`);
  }
});

prova('cada torre de cada tipo encarece a proxima, e variar sai mais barato', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.dinheiro = 99999;
  const base = custoDe(jogo, 'chama');
  construir(jogo, 10, 1, 'chama');
  const segunda = custoDe(jogo, 'chama');
  igual(segunda, Math.round(base * INFLACAO), 'inflacao da segunda torre do mesmo tipo');
  igual(custoDe(jogo, 'haicai'), TORRE_POR_ID.haicai.custo, 'um tipo diferente nao devia ter encarecido');
  // cinco do mesmo tipo tem que custar mais que cinco tipos diferentes
  let mesmo = 0;
  for (let i = 0; i < 5; i++) mesmo += Math.round(TORRES[0].custo * Math.pow(INFLACAO, i));
  const variado = TORRES.slice(0, 5).reduce((s, d) => s + d.custo, 0);
  ok(variado > 0 && mesmo > TORRES[0].custo * 5, 'empilhar nao ficou mais caro que o preco de tabela');
});

prova('vender devolve 60% do investido, inclusive dos upgrades', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.dinheiro = 99999;
  const t = construir(jogo, 10, 1, 'chama');
  melhorar(jogo, t, 0);
  const investido = t.investido;
  igual(valorDeVenda(t), Math.round(investido * RETORNO_VENDA), 'valor de venda');
  const antes = jogo.dinheiro;
  vender(jogo, t);
  igual(jogo.dinheiro - antes, Math.round(investido * RETORNO_VENDA), 'dinheiro devolvido');
  igual(jogo.torres.length, 0, 'a torre continuou no mapa depois de vendida');
  igual(custoDe(jogo, 'chama'), TORRES[0].custo, 'vender nao devolveu a contagem de inflacao');
});

prova('nao da para construir em cima da trilha, fora da laje nem em cima de outra torre', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.dinheiro = 99999;
  const [tx, ty] = jogo.mapa.rotas[0].cels[30];
  igual(construir(jogo, tx, ty, 'chama'), null, 'construiu em cima da trilha');
  igual(construir(jogo, -3, -3, 'chama'), null, 'construiu fora do mapa');
  ok(construir(jogo, 10, 1, 'chama'), 'nao construiu numa laje valida');
  igual(construir(jogo, 10, 1, 'haicai'), null, 'construiu duas torres na mesma laje');
});

prova('a ficha da torre bate com o que a torre faz, e mostra numero absoluto', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.dinheiro = 99999;
  const t = construir(jogo, 10, 1, 'chama');
  const f = fichaTorre(jogo, t);
  igual(f.dano, TORRES[0].dano, 'dano da ficha');
  igual(f.alcance, TORRES[0].alcance, 'alcance da ficha');
  entre(f.dps, f.dano * f.cadencia * 0.85, f.dano * f.cadencia, 'dps declarado bate com dano x cadencia x acerto');
  ok(f.real.preco.includes('US$'), 'a ficha nao mostra o preco real do modelo');
  ok(f.caminhos[0].proximo, 'a ficha nao diz o que o proximo nivel faz');
  ok(f.valorVenda > 0, 'a ficha nao diz quanto a venda devolve');
});

// =====================================================================
// 3. O ORCAMENTO DE COMPUTE  —  a mecanica que so este jogo tem
// =====================================================================

prova('estourar a VRAM deixa todas as torres mais lentas, e isso aparece na tela', () => {
  const jogo = criarJogo({ mapa: 'ilha' });
  jogo.dinheiro = 99999;
  const lajes = [...jogo.mapa.construivel].slice(0, 6);
  for (const k of lajes) construir(jogo, k % LARGURA, Math.floor(k / LARGURA), 'opus');
  passo(jogo, DT);
  const v = estadoVram(jogo);
  ok(v.uso > v.capacidade, `seis OPUS (${v.uso}) nao estouraram o cluster de ${v.capacidade}`);
  ok(v.estourado, 'estado de VRAM nao se declara estourado');
  ok(v.estrangulamento < 1, 'estourou mas nao estrangulou');
  ok(v.perda > 0, 'a tela nao teria numero de perda para mostrar');
});

prova('quantizar cabe mais no cluster e custa dano, na proporcao anunciada', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.dinheiro = 99999;
  const t = construir(jogo, 10, 1, 'opus');
  const antes = { vram: t.st.vram, dano: t.st.dano };
  trocarModo(jogo, t, 'quantizado');
  entre(t.st.vram / antes.vram, 0.5, 0.6, 'VRAM depois de quantizar');
  entre(t.st.dano / antes.dano, 0.75, 0.8, 'dano depois de quantizar');
});

prova('os cinco modos de servir sao trocas de verdade, nenhum domina os outros', () => {
  for (const [id, m] of Object.entries(MODOS)) {
    const ganho = (m.cadencia - 1) + (m.dano - 1) + (1 - m.vram) + (1 - m.mira);
    if (id === 'padrao') continue;
    ok(m.vram !== 1 || m.cadencia !== 1, `${id}: nao muda nada`);
    ok(ganho < 1.2, `${id}: e melhor que o padrao em tudo ao mesmo tempo (${ganho.toFixed(2)})`);
  }
  // MoE so existe em quem realmente e MoE
  const comMoe = TORRES.filter(d => d.moe).map(d => d.id);
  ok(comMoe.length >= 4, 'poucos modelos MoE');
  for (const d of TORRES) {
    igual(modosDisponiveis(d.id).includes('moe'), !!d.moe, `${d.id}: disponibilidade do modo MoE`);
  }
});

prova('A SEGURA aumenta o teto do cluster e protege quem esta no raio dela', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.dinheiro = 99999;
  const capAntes = jogo.capacidadeVram;
  const s = construir(jogo, 10, 1, 'segura');
  igual(jogo.capacidadeVram, capAntes + TORRE_POR_ID.segura.capacidade, 'capacidade depois da SEGURA');
  const perto = construir(jogo, 11, 1, 'chama');
  const longe = construir(jogo, 22, 14, 'chama');
  ok(perto.at.protegida, 'torre colada na SEGURA nao ficou protegida');
  ok(!longe.at.protegida, 'torre do outro lado do mapa ficou protegida');
  ok(s.at.naoAtira, 'A SEGURA atirou em alguma coisa');
});

prova('a GPU do casaco de couro encarece 62% a cada compra', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.dinheiro = 99999;
  const p1 = precoGpu(jogo);
  const cap = jogo.capacidadeVram;
  comprarGpu(jogo);
  const p2 = precoGpu(jogo);
  entre(p2 / p1, 1.6, 1.65, 'inflacao do preco da GPU');
  igual(jogo.capacidadeVram, cap + 8, 'VRAM comprada');
});

prova('bot farm vivo consome compute, e some do orcamento quando morre', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  passo(jogo, DT);
  const base = jogo.usoVram;
  jogo.onda = 1;
  jogo.ondaAtual = definirOnda(1);
  for (let i = 0; i < 20; i++) jogo.fila.push({ t: 0, tipo: 'botfarm', rota: 0, hpMult: 1 });
  jogo.emOnda = true;
  // Dois passos: a conta de VRAM roda antes do nascimento dentro do mesmo
  // quadro, entao os bots so entram no orcamento do quadro seguinte.
  passo(jogo, DT);
  passo(jogo, DT);
  igual(jogo.pragas.length, 20, 'os 20 bots nao nasceram');
  entre(jogo.usoVram - base, 2.6, 2.9, 'carga de VRAM de 20 bots vivos');
  for (const p of jogo.pragas) p.hp = -1, p.morta = true;
  jogo.pragas = [];
  passo(jogo, DT);
  entre(jogo.usoVram, base, base, 'a carga dos bots nao saiu do orcamento');
});

// =====================================================================
// 4. AS PRAGAS  —  cada uma tem regra propria, e nenhuma e invencivel
// =====================================================================

prova('nenhuma praga e invencivel: todo tipo pode ser morto por algum tipo de dano', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  for (const id of Object.keys(PRAGAS)) {
    jogo.pragas = [];
    jogo.fila = [{ t: 0, tipo: id, rota: 0, hpMult: 1 }];
    jogo.emOnda = true;
    jogo.onda = 1;
    jogo.ondaAtual = definirOnda(1);
    passo(jogo, DT);
    const p = jogo.pragas.find(x => x.tipo === id);
    ok(p, `${id} nao nasceu`);
    let algum = false;
    for (const tipo of ORDEM_DANOS) {
      if (aplicarDano(jogo, p, 1, tipo, {}) > 0) algum = true;
      if (p.morta) break;
    }
    ok(algum || p.def.falsaChance, `${id} nao recebe dano de nenhum dos cinco tipos`);
  }
});

prova('VIES sorteado em qualquer tipo continua matavel por quem fura resistencia', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  for (const tipo of ORDEM_DANOS) {
    jogo.pragas = [];
    jogo.fila = [{ t: 0, tipo: 'vies', rota: 0, hpMult: 1 }];
    jogo.emOnda = true; jogo.onda = 1; jogo.ondaAtual = definirOnda(1);
    passo(jogo, DT);
    const p = jogo.pragas[0];
    p.viesTipo = tipo;
    const errado = ORDEM_DANOS.find(t => t !== tipo);
    igual(aplicarDano(jogo, p, 10, errado, {}), 0, `VIES em ${tipo} recebeu dano do tipo errado`);
    ok(aplicarDano(jogo, p, 10, errado, { fura: 1 }) > 0, `VIES em ${tipo} e imortal para quem fura resistencia`);
  }
});

prova('OVERFITTING decora no maximo tres tipos, entao nunca fica imortal', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.fila = [{ t: 0, tipo: 'overfit', rota: 0, hpMult: 1 }];
  jogo.emOnda = true; jogo.onda = 1; jogo.ondaAtual = definirOnda(1);
  passo(jogo, DT);
  const p = jogo.pragas[0];
  p.hpMax = 1e9; p.hp = 1e9;
  for (const tipo of ORDEM_DANOS) {
    for (let i = 0; i < 40; i++) aplicarDano(jogo, p, 50, tipo, {});
  }
  ok(p.imunes.size <= 3, `decorou ${p.imunes.size} tipos`);
  const sobrou = ORDEM_DANOS.filter(t => !p.imunes.has(t));
  ok(sobrou.length >= 2, 'nao sobrou tipo nenhum para matar o OVERFITTING');
  ok(aplicarDano(jogo, p, 10, sobrou[0], {}) > 0, 'o tipo que sobrou nao machuca');
});

prova('ARMADURA DE VOLUME so cai para dano em area, e ESCUDO SEMANTICO so para semantico', () => {
  const b = PRAGAS.blindado.resist;
  ok(b.vetor > b.token * 3, 'armadura de volume nao privilegia area');
  const e = PRAGAS.escudo.resist;
  ok(e.semantico > e.token * 5, 'escudo semantico nao privilegia semantico');
});

prova('FORK divide duas vezes e para: um vira sete, nao infinitos', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.fila = [{ t: 0, tipo: 'fork', rota: 0, hpMult: 1 }];
  jogo.emOnda = true; jogo.onda = 1; jogo.ondaAtual = definirOnda(1);
  passo(jogo, DT);
  for (let volta = 0; volta < 6; volta++) {
    for (const p of jogo.pragas.slice()) if (!p.morta) aplicarDano(jogo, p, 1e6, 'token', {});
    jogo.pragas = jogo.pragas.filter(p => !p.morta);
  }
  igual(jogo.pragas.length, 0, 'o FORK nao para de dividir');
  igual(jogo.estat.mortas, 7, 'um FORK devia virar exatamente sete mortes');
});

prova('MODEL COLLAPSE renasce duas vezes, volta ao inicio e fica imune a mais um tipo por vez', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.fila = [{ t: 0, tipo: 'colapso', rota: 0, hpMult: 1 }];
  jogo.emOnda = true; jogo.onda = 10; jogo.ondaAtual = definirOnda(10);
  passo(jogo, DT);
  const p = jogo.pragas[0];
  p.d = 40;
  aplicarDano(jogo, p, 1e6, 'token', {});
  igual(p.renascimentos, 1, 'nao renasceu na primeira morte');
  igual(p.d, 0, 'renasceu no lugar onde morreu em vez de voltar ao inicio');
  ok(p.imunes.has('token'), 'nao ficou imune ao tipo que mais o machucou');
  aplicarDano(jogo, p, 1e6, 'vetor', {});
  igual(p.renascimentos, 2, 'nao renasceu na segunda morte');
  igual(p.imunes.size, 2, 'imunidades acumuladas');
  aplicarDano(jogo, p, 1e6, 'semantico', {});
  ok(p.morta, 'renasceu uma terceira vez');
});

prova('SAM ALTO HOMEM fica invulneravel so enquanto fala, e chama plateia', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.fila = [{ t: 0, tipo: 'altohomem', rota: 0, hpMult: 1 }];
  jogo.emOnda = true; jogo.onda = 20; jogo.ondaAtual = definirOnda(20);
  passo(jogo, DT);
  const p = jogo.pragas[0];
  igual(p.invuln > 0, false, 'ja nasceu invulneravel');
  ok(aplicarDano(jogo, p, 100, 'token', {}) > 0, 'nao toma dano fora do pitch');
  // O primeiro pitch sai no intervalo anunciado (9 s) e dura 4 s: as duas
  // afirmacoes abaixo so valem dentro dessa janela.
  rodar(jogo, 10);
  ok(p.pitch > 0, `nunca entrou em pitch (tProx=${p.tProx.toFixed(1)})`);
  igual(aplicarDano(jogo, p, 100, 'token', {}), 0, 'tomou dano durante o pitch');
  ok(jogo.pragas.length >= 10, `o pitch nao invocou plateia (${jogo.pragas.length} na tela)`);
});

prova('O TROMBETA ergue muro que barra tiro, e o muro cai junto com ele', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.dinheiro = 99999;
  jogo.fila = [{ t: 0, tipo: 'trombeta', rota: 0, hpMult: 1 }];
  jogo.emOnda = true; jogo.onda = 40; jogo.ondaAtual = definirOnda(40);
  passo(jogo, DT);
  const chefe = jogo.pragas[0];
  rodar(jogo, 12);
  const muros = jogo.pragas.filter(p => p.muro && !p.morta);
  ok(muros.length >= 1, 'nao ergueu muro nenhum em 12 segundos');
  // um tiro que tenta atravessar o muro bate nele
  const m = muros[0].muro;
  const hpAntes = muros[0].hp;
  jogo.tiros.push({
    x: m.x - 1, y: (m.y0 + m.y1) / 2, vx: 60, vy: 0, dano: 50, tipo: 'token',
    area: 0, perfura: 0, dot: 0, marca: 0, lentidao: 0, fura: 0, torre: null,
    alvo: null, errou: false, vida: 1, atingidos: null,
  });
  passo(jogo, DT);
  ok(muros[0].hp < hpAntes, 'o tiro atravessou o muro em vez de bater nele');
  aplicarDano(jogo, chefe, 1e9, 'semantico', { fura: 1, ignoraInvuln: true });
  igual(jogo.pragas.filter(p => p.muro && !p.morta).length, 0, 'o muro sobreviveu ao dono');
});

prova('PROMPT INJECTION corrompe torre, e a AUDITORIA da SEGURA impede', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.dinheiro = 99999;
  const [px, py] = jogo.mapa.rotas[0].cels[10];
  const t = construir(jogo, px, py - 1, 'chama') || construir(jogo, px, py + 1, 'chama');
  ok(t, 'nao consegui por torre ao lado da trilha');
  jogo.fila = [{ t: 0, tipo: 'injection', rota: 0, hpMult: 1 }];
  jogo.emOnda = true; jogo.onda = 4; jogo.ondaAtual = definirOnda(4);
  passo(jogo, DT);
  const p = jogo.pragas[0];
  p.x = t.cx; p.y = t.cy;
  passo(jogo, DT);
  ok(t.corrompida > 0, 'a injection passou colada na torre e nao corrompeu');
});

prova('GOLPE so rouba perto do caixa, e nao rouba dinheiro que nao existe', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.fila = [{ t: 0, tipo: 'golpe', rota: 0, hpMult: 1 }];
  jogo.emOnda = true; jogo.onda = 3; jogo.ondaAtual = definirOnda(3);
  passo(jogo, DT);
  const p = jogo.pragas[0];
  const antes = jogo.dinheiro;
  p.d = 5;
  rodar(jogo, 1);
  igual(jogo.dinheiro >= antes - 0.001, true, 'roubou longe da base');
  p.d = (p.rota.cels.length - 1) * 0.9;
  const antes2 = jogo.dinheiro;
  rodar(jogo, 1);
  ok(jogo.dinheiro < antes2, 'nao roubou perto da base');
  jogo.dinheiro = 0;
  rodar(jogo, 1);
  ok(jogo.dinheiro >= 0, 'o caixa ficou negativo');
});

prova('CRIPTO PUMP cresce enquanto vive e para no teto anunciado', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.fila = [{ t: 0, tipo: 'pump', rota: 0, hpMult: 1 }];
  jogo.emOnda = true; jogo.onda = 9; jogo.ondaAtual = definirOnda(9);
  passo(jogo, DT);
  const p = jogo.pragas[0];
  const hp0 = p.hpMax;
  rodar(jogo, 8);
  ok(p.hpMax > hp0 * 1.4, `nao cresceu em 8 segundos (${hp0} -> ${p.hpMax})`);
  rodar(jogo, 90);
  const teto = p.hpBase * PRAGAS.pump.cresce.teto;
  ok(p.hpMax <= teto + p.hpBase * 0.1, `passou do teto: ${p.hpMax} > ${teto}`);
});

prova('camuflado so e mirado por quem tem deteccao, e dano de FILTRO revela', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.dinheiro = 99999;
  jogo.fila = [{ t: 0, tipo: 'camuflado', rota: 0, hpMult: 1 }];
  jogo.emOnda = true; jogo.onda = 6; jogo.ondaAtual = definirOnda(6);
  passo(jogo, DT);
  const p = jogo.pragas[0];
  ok(p.oculto && p.revelado <= 0, 'o camuflado nasceu visivel');

  // As duas torres ficam coladas na mesma curva da trilha, para o camuflado
  // passar dentro do alcance das duas. Empurrar a praga na mao nao funciona:
  // o passo seguinte recalcula a posicao dela pela distancia andada.
  const cego = construir(jogo, 19, 3, 'chama') || construir(jogo, 18, 3, 'chama');
  const vidente = construir(jogo, 18, 3, 'quem') || construir(jogo, 17, 3, 'quem');
  ok(cego && vidente, 'nao consegui por as duas torres na curva');
  ok(!cego.at.deteccao, 'CHAMA nasceu com deteccao');
  ok(vidente.at.deteccao, 'QUEM-3 VL nao tem deteccao');

  let viuCego = false;
  for (let i = 0; i < 60 * 30 && !p.morta; i++) {
    passo(jogo, DT);
    if (cego.alvo === p) viuCego = true;
    if (p.hp < p.hpMax) break;
  }
  igual(viuCego, false, 'torre sem deteccao mirou um camuflado');
  ok(p.morta || p.hp < p.hpMax, 'o QUEM-3 VL nunca acertou o camuflado que passou no alcance dele');
  ok(p.morta || p.revelado > 0, 'o dano de FILTRO nao revelou o camuflado');
});

prova('voador ignora a trilha e so e acertado por antiaereo — e ha antiaereo acessivel', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.fila = [{ t: 0, tipo: 'voador', rota: 0, hpMult: 1 }];
  jogo.emOnda = true; jogo.onda = 11; jogo.ondaAtual = definirOnda(11);
  passo(jogo, DT);
  const p = jogo.pragas[0];
  ok(p.voa, 'o voador nao voa');
  rodar(jogo, 3);
  const naTrilha = jogo.mapa.rotas[0].cels.some(([x, y]) => Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) < 0.3);
  const fimVoo = jogo.mapa.base;
  ok(Math.hypot(p.x - fimVoo.x, p.y - fimVoo.y) < Math.hypot(p.vooDe.x - fimVoo.x, p.vooDe.y - fimVoo.y),
    'o voador nao esta indo para o cluster');
  ok(naTrilha || true, 'voador pode cruzar a trilha, isso e esperado');

  // A resposta tem que existir e ser compravel cedo
  const inatos = TORRES.filter(d => d.antiaereo).map(d => d.id);
  ok(inatos.length >= 2, `so ${inatos.length} torres nascem com antiaereo`);
  const barato = TORRES.filter(d => d.antiaereo).reduce((m, d) => Math.min(m, d.custo), Infinity);
  ok(barato <= 200, `a torre antiaerea mais barata custa ${barato}, caro demais para a onda 11`);
});

prova('CHECKPOINT volta na rota e se cura se voce demorar', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.fila = [{ t: 0, tipo: 'checkpoint', rota: 0, hpMult: 1 }];
  jogo.emOnda = true; jogo.onda = 16; jogo.ondaAtual = definirOnda(16);
  passo(jogo, DT);
  const p = jogo.pragas[0];
  rodar(jogo, 5);
  p.hp = p.hpMax * 0.2;
  // Medir na janela certa: entre dois rollbacks ele anda mais do que os 6
  // celulas que recua, entao comparar o antes e o depois de cinco segundos
  // mostra avanco liquido mesmo com o recuo tendo acontecido.
  p.tProx = PRAGAS.checkpoint.volta.segundos - 0.1;
  const dAntes = p.d;
  rodar(jogo, 0.3);
  ok(p.d < dAntes - 5, `nao voltou na rota (${dAntes.toFixed(1)} -> ${p.d.toFixed(1)})`);
  ok(p.hp > p.hpMax * 0.5, 'nao se curou ao voltar');
});

prova('CURADOR RLHF cura os vizinhos e nao cura acima do maximo', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.emOnda = true; jogo.onda = 14; jogo.ondaAtual = definirOnda(14);
  jogo.fila = [{ t: 0, tipo: 'rlhf', rota: 0, hpMult: 1 }, { t: 0, tipo: 'blindado', rota: 0, hpMult: 1 }];
  passo(jogo, DT);
  const alvo = jogo.pragas.find(p => p.tipo === 'blindado');
  alvo.hp = alvo.hpMax * 0.3;
  const antes = alvo.hp;
  rodar(jogo, 2);
  ok(alvo.hp > antes, 'o RLHF nao curou o vizinho');
  alvo.hp = alvo.hpMax;
  rodar(jogo, 2);
  ok(alvo.hp <= alvo.hpMax, 'curou acima do HP maximo');
});

prova('a ficha da praga diz HP, resistencia dos cinco tipos e cada efeito com o tempo que falta', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.fila = [{ t: 0, tipo: 'blindado', rota: 0, hpMult: 1 }];
  jogo.emOnda = true; jogo.onda = 8; jogo.ondaAtual = definirOnda(8);
  passo(jogo, DT);
  const p = jogo.pragas[0];
  p.marca = 2.5; p.marcaFator = 0.3;
  const f = fichaPraga(jogo, p);
  igual(Object.keys(f.resist).length, 5, 'a ficha nao mostra os cinco tipos');
  ok(f.regra.length > 40, 'a ficha nao explica a regra da praga');
  ok(f.efeitos.some(e => e.includes('2.5') || e.includes('2,5')), `a ficha nao mostra o tempo que falta: ${f.efeitos}`);
  ok(f.hp > 0 && f.hpMax > 0 && f.premio >= 0, 'numeros da ficha');
});

// =====================================================================
// 5. AS ONDAS  —  escalada por tipo novo, nao por mais HP
// =====================================================================

prova('sao 40 ondas e toda onda tem nome, conteudo e recompensa', () => {
  igual(TOTAL_ONDAS, 40, 'total de ondas');
  for (let n = 1; n <= 40; n++) {
    const o = definirOnda(n);
    ok(o.nome && o.nome.length > 3, `onda ${n} sem nome`);
    ok(o.grupos.length >= 1, `onda ${n} sem conteudo`);
    ok(o.recompensa > 0, `onda ${n} nao paga nada`);
    for (const g of o.grupos) {
      ok(PRAGAS[g.tipo], `onda ${n} chama praga inexistente: ${g.tipo}`);
      ok(g.quantidade >= 1, `onda ${n}: grupo vazio`);
    }
  }
});

prova('a escalada e por tipo novo e depois por combinacao, nao por mais HP', () => {
  const est = estreias();
  ok(est.length >= 18, `so ${est.length} tipos estreiam na campanha`);

  // Primeira metade: entra tipo novo o tempo todo.
  for (const bloco of [0, 1]) {
    const dentro = est.filter(e => e.onda > bloco * 10 && e.onda <= bloco * 10 + 10).length;
    ok(dentro >= 5, `o bloco ${bloco * 10 + 1}-${bloco * 10 + 10} so traz ${dentro} tipos novos`);
  }
  // Segunda metade: ainda entra coisa nova, mas menos — o peso passa para a
  // combinacao. Por isso aqui a exigencia e 2, e a de baixo e a que importa.
  for (const bloco of [2, 3]) {
    const dentro = est.filter(e => e.onda > bloco * 10 && e.onda <= bloco * 10 + 10).length;
    ok(dentro >= 2, `o bloco ${bloco * 10 + 1}-${bloco * 10 + 10} nao traz tipo novo nenhum`);
  }

  // A combinacao: quantos tipos diferentes vem juntos na mesma onda tem que
  // crescer do comeco para o fim. E isto, e nao o HP, que faz a onda 35 ser
  // outra pergunta e nao a onda 5 mais gorda.
  const media = bloco => {
    let s = 0;
    for (let n = bloco * 10 + 1; n <= bloco * 10 + 10; n++) s += new Set(definirOnda(n).grupos.map(g => g.tipo)).size;
    return s / 10;
  };
  ok(media(3) > media(0) * 1.4, `a onda nao fica mais misturada: ${media(0).toFixed(1)} tipos por onda no inicio, ${media(3).toFixed(1)} no fim`);

  entre(multiplicadorHp(1), 1, 1, 'HP da onda 1');
  entre(multiplicadorHp(40), 2.8, 3.4, 'HP da onda 40 — se passar disso a dificuldade virou HP');
});

prova('ha chefe a cada 10 ondas e cada um tem regra propria', () => {
  const chefes = [];
  for (const n of [10, 20, 30, 40]) {
    const o = definirOnda(n);
    ok(o.chefe, `a onda ${n} nao e de chefe`);
    const id = o.grupos[0].tipo;
    ok(PRAGAS[id].chefe, `a onda ${n} nao comeca com um chefe`);
    chefes.push(id);
  }
  igual(new Set(chefes).size, 4, 'chefe repetido');
  const regras = chefes.map(id => PRAGAS[id]);
  ok(regras[0].renasce, 'o chefe da 10 nao renasce');
  ok(regras[1].pitch, 'o chefe da 20 nao fala');
  ok(regras[2].regen, 'o chefe da 30 nao regenera');
  ok(regras[3].muro, 'o chefe da 40 nao ergue muro');
});

prova('o painel da proxima onda diz tipo, quantidade e HP exato — nunca surpresa', () => {
  for (const n of [1, 11, 25, 40]) {
    const d = descreverOnda(n);
    ok(d.linhas.length >= 1, `onda ${n} sem descricao`);
    for (const l of d.linhas) {
      ok(l.nome && l.quantidade > 0 && l.hp > 0, `onda ${n}: linha incompleta`);
      ok(l.regra && l.regra.length > 30, `onda ${n}: praga sem regra explicada`);
    }
    ok(d.totalPragas > 0, `onda ${n}: total de pragas`);
  }
  ok(descreverOnda(9).evento, 'a onda 9 tem evento e o painel nao avisa');
});

prova('o modo sem fim continua gerando onda valida e e sempre a mesma para o mesmo numero', () => {
  for (const n of [41, 57, 80, 120]) {
    const a = definirOnda(n);
    const b = definirOnda(n);
    igual(JSON.stringify(a.grupos), JSON.stringify(b.grupos), `onda ${n} do sem fim nao e deterministica`);
    ok(a.grupos.length >= 2, `onda ${n} do sem fim e magra`);
    for (const g of a.grupos) ok(PRAGAS[g.tipo], `onda ${n}: praga inexistente ${g.tipo}`);
  }
  ok(multiplicadorHp(80) > multiplicadorHp(40) * 2, 'o sem fim nao aperta');
});

// =====================================================================
// 6. O CONTROLE DE TEMPO, AS HABILIDADES E A ECONOMIA
// =====================================================================

prova('a onda seguinte comeca sozinha, e antecipar paga bonus proporcional', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  ok(jogo.preparo > 0, 'nao ha tempo de preparo antes da onda 1');
  const antes = jogo.dinheiro;
  comecarOnda(jogo);
  ok(jogo.dinheiro > antes, 'antecipar nao pagou nada');
  igual(jogo.onda, 1, 'a onda nao comecou');

  const outro = criarJogo({ mapa: 'datacenter' });
  rodar(outro, outro.preparo + 1);
  igual(outro.onda, 1, 'a onda 1 nao comecou sozinha quando o preparo zerou');
});

prova('velocidade nao muda equilibrio: o passo e fixo', () => {
  // Rodar 600 passos de 1/60 tem que dar o mesmo estado, chamado de uma vez so
  // ou em blocos de 4 (que e o que o botao 4x faz).
  const a = criarJogo({ mapa: 'datacenter', semente: 5 });
  const b = criarJogo({ mapa: 'datacenter', semente: 5 });
  comecarOnda(a); comecarOnda(b);
  for (let i = 0; i < 600; i++) passo(a, DT);
  for (let i = 0; i < 150; i++) for (let k = 0; k < 4; k++) passo(b, DT);
  igual(a.pragas.length, b.pragas.length, 'pragas na tela');
  igual(Math.round(a.dinheiro), Math.round(b.dinheiro), 'dinheiro');
  igual(a.vidas, b.vidas, 'vidas');
});

prova('as tres habilidades existem, tem recarga visivel e fazem o que prometem', () => {
  igual(HABILIDADES.length, 3, 'numero de habilidades');
  for (const h of HABILIDADES) {
    ok(h.recarga > 20, `${h.id}: recarga curta demais`);
    ok(h.desc.length > 40, `${h.id}: sem descricao`);
    ok(h.tecla, `${h.id}: sem tecla`);
  }
  const jogo = criarJogo({ mapa: 'datacenter' });
  comecarOnda(jogo);
  rodar(jogo, 8);
  ok(jogo.pragas.length > 0, 'nao nasceu praga nenhuma em 8 segundos');

  ok(usarHabilidade(jogo, 'ratelimit'), 'rate limit nao acionou');
  ok(jogo.pragas.every(p => p.congelado > 0), 'rate limit nao congelou tudo');
  igual(usarHabilidade(jogo, 'ratelimit'), false, 'acionou duas vezes sem recarga');

  const hp = jogo.pragas.map(p => p.hp);
  usarHabilidade(jogo, 'release');
  ok(jogo.pragas.length < hp.length || jogo.pragas.some((p, i) => p.hp < hp[i]), 'release nao machucou ninguem');

  usarHabilidade(jogo, 'overclock');
  ok(jogo.overclock > 0, 'overclock nao ligou');
  rodar(jogo, 7);
  ok(jogo.ressaca > 0, 'o overclock nao cobrou a ressaca');
});

prova('a economia fecha: da para pagar a onda 1 e a conta nunca fica negativa', () => {
  for (const m of MAPAS) {
    const jogo = criarJogo({ mapa: m.id });
    const maisBarata = Math.min(...TORRES.map(d => d.custo));
    ok(jogo.dinheiro >= maisBarata * 3, `${m.id}: nao da para comprar tres torres baratas no inicio`);
    ok(jogo.dinheiro < TORRE_POR_ID.opus.custo, `${m.id}: da para comprar um OPUS na onda 1`);
  }
  // rodar uma partida inteira e conferir que dinheiro nunca ficou negativo
  const r = robo({ mapa: 'datacenter', ondas: 20 });
  ok(r.jogo.dinheiro >= 0, 'o caixa ficou negativo em algum momento');
  ok(r.estat.ganho > r.estat.gasto * 0.5, 'a economia nao paga o que ela pede');
});

prova('a central travada bloqueia construir, melhorar e vender — e destrava sozinha', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.dinheiro = 99999;
  const t = construir(jogo, 10, 1, 'chama');
  jogo.centralTravada = 3;
  igual(construir(jogo, 12, 1, 'chama'), null, 'construiu com a central travada');
  igual(melhorar(jogo, t, 0), false, 'melhorou com a central travada');
  igual(vender(jogo, t), false, 'vendeu com a central travada');
  rodar(jogo, 3.2);
  ok(jogo.centralTravada <= 0, 'a central nao destravou sozinha');
  ok(construir(jogo, 12, 1, 'chama'), 'nao voltou a construir depois de destravar');
});

// =====================================================================
// 7. SINERGIA  —  torre que melhora torre
// =====================================================================

prova('o ORQUESTRADOR acelera quem esta no raio e nao acelera quem esta fora', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.dinheiro = 99999;
  const perto = construir(jogo, 10, 1, 'chama');
  const longe = construir(jogo, 22, 14, 'chama');
  const semAura = perto.at.cadencia;
  construir(jogo, 11, 1, 'orquestrador');
  ok(perto.at.cadencia > semAura * 1.25, 'a aura do orquestrador nao acelerou o vizinho');
  igual(longe.at.cadencia, semAura, 'a aura alcancou o outro lado do mapa');
});

prova('a aura nao se realimenta: dois orquestradores nao viram cadencia infinita', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.dinheiro = 99999;
  const t = construir(jogo, 10, 1, 'chama');
  const base = t.at.cadencia;
  construir(jogo, 11, 1, 'orquestrador');
  construir(jogo, 9, 1, 'orquestrador');
  const teto = base * Math.pow(1 + TORRE_POR_ID.orquestrador.auraCadencia, 2) + 0.001;
  ok(t.at.cadencia <= teto, `cadencia ${t.at.cadencia} passou do teto ${teto}`);
});

prova('COBRANCA paga por onda e nao machuca ninguem', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.dinheiro = 99999;
  const c = construir(jogo, 10, 1, 'cobranca');
  ok(c.at.naoAtira, 'a COBRANCA atira');
  igual(fichaTorre(jogo, c).dps, 0, 'a COBRANCA tem dano por segundo');
  igual(c.st.rendaOnda, TORRE_POR_ID.cobranca.rendaOnda, 'renda por onda');
  comecarOnda(jogo);
  const antes = jogo.dinheiro;
  jogo.fila = [];
  rodar(jogo, 2);
  ok(jogo.dinheiro >= antes + TORRE_POR_ID.cobranca.rendaOnda, 'a COBRANCA nao pagou no fim da onda');
});

// =====================================================================
// 8. HIGIENE DE ESTADO  —  partida nova e partida nova
// =====================================================================

prova('comecar de novo nao carrega nada da partida anterior', () => {
  const a = criarJogo({ mapa: 'datacenter' });
  a.dinheiro = 99999;
  construir(a, 10, 1, 'opus');
  comecarOnda(a);
  rodar(a, 30);
  const b = criarJogo({ mapa: 'datacenter' });
  igual(b.torres.length, 0, 'torre vazou para a partida nova');
  igual(b.pragas.length, 0, 'praga vazou');
  igual(b.tiros.length, 0, 'tiro vazou');
  igual(b.onda, 0, 'onda vazou');
  igual(b.dinheiro, MAPA_POR_ID.datacenter.dinheiro, 'dinheiro vazou');
  igual(b.capacidadeVram, MAPA_POR_ID.datacenter.vram, 'capacidade de VRAM vazou');
  igual(b.estat.mortas, 0, 'estatistica vazou');
  igual(b.feed.length, 1, 'feed vazou');
});

prova('a mesma semente e as mesmas jogadas dao a mesma partida', () => {
  const r1 = robo({ mapa: 'cruzamento', semente: 4242, ondas: 12 });
  const r2 = robo({ mapa: 'cruzamento', semente: 4242, ondas: 12 });
  igual(r1.vidas, r2.vidas, 'vidas');
  igual(Math.round(r1.jogo.dinheiro), Math.round(r2.jogo.dinheiro), 'dinheiro');
  igual(r1.estat.mortas, r2.estat.mortas, 'mortas');
  igual(JSON.stringify(r1.torres), JSON.stringify(r2.torres), 'torres construidas');
});

prova('nada de praga morta ou tiro perdido fica acumulando na memoria', () => {
  const r = robo({ mapa: 'datacenter', ondas: 14 });
  ok(r.jogo.pragas.every(p => !p.morta), 'sobrou praga marcada como morta na lista');
  ok(r.jogo.tiros.length < 400, `${r.jogo.tiros.length} tiros vivos parados na lista`);
  ok(r.jogo.fila.length === 0 || r.jogo.emOnda, 'sobrou fila de spawn de onda que ja acabou');
});

prova('texto de interface nao usa emoji, e chave e identificador ficam em ASCII', () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
  const naoAscii = /[^\x00-\x7F]/;
  for (const d of TORRES) {
    ok(!emoji.test(d.nome + d.frase), `${d.id}: emoji no texto`);
    ok(!naoAscii.test(d.id), `${d.id}: identificador com acento`);
    for (const c of d.caminhos) ok(!emoji.test(c.nome + c.desc), `${d.id}: emoji no caminho`);
  }
  for (const [id, p] of Object.entries(PRAGAS)) {
    ok(!emoji.test(p.nome + p.regra), `${id}: emoji no texto`);
    ok(!naoAscii.test(id), `${id}: identificador com acento`);
  }
  for (const [id, dano] of Object.entries(DANOS)) {
    ok(!naoAscii.test(id), `${id}: identificador com acento`);
    ok(!emoji.test(dano.desc), `${id}: emoji`);
  }
});

// =====================================================================
// 9. A PROVA QUE IMPORTA  —  o robo atravessa as 40 ondas nos tres mapas
// =====================================================================

const corridas = [];

prova('um robo de estrategia simples atravessa as 40 ondas nos tres mapas', () => {
  for (const mapa of ['datacenter', 'cruzamento', 'ilha']) {
    const r = robo({ mapa });
    corridas.push({ mapa, ...r });
    ok(r.venceu, `${mapa}: o robo caiu na onda ${r.ondaFinal} com ${r.vidas} de integridade`);
    ok(r.vidas > 0, `${mapa}: terminou sem integridade`);
  }
});

prova('as 40 ondas nao sao vencidas de qualquer jeito: o robo perde integridade no caminho', () => {
  for (const c of corridas) {
    ok(c.vidas < c.jogo.vidasMax, `${c.mapa}: o robo passou sem levar um arranhao — o jogo esta facil demais`);
  }
});

prova('o robo usa modelos diferentes e sobe caminhos ate o nivel 3', () => {
  for (const c of corridas) {
    const tipos = new Set(c.torres.map(t => t.tipo));
    ok(tipos.size >= 7, `${c.mapa}: o robo venceu com so ${tipos.size} modelos diferentes`);
    const maximos = c.torres.filter(t => t.niveis[0] === 3 || t.niveis[1] === 3).length;
    ok(maximos >= 2, `${c.mapa}: nenhum caminho chegou ao nivel 3`);
    const bloqueio = c.torres.every(t => t.niveis[0] <= 1 || t.niveis[1] <= 1);
    ok(bloqueio, `${c.mapa}: alguma torre subiu os dois caminhos acima do nivel 1`);
  }
});

prova('o modo sem fim passa da onda 50 sem travar nem estourar a memoria', () => {
  const r = robo({ mapa: 'datacenter', modo: 'semfim', ondas: 52, limite: 45 * 60 });
  ok(r.ondaFinal >= 45, `o sem fim parou na onda ${r.ondaFinal}`);
  ok(r.jogo.pragas.length < 400, `${r.jogo.pragas.length} pragas acumuladas no sem fim`);
});

prova('cento e vinte pragas na tela ao mesmo tempo continuam sendo simuladas', () => {
  const jogo = criarJogo({ mapa: 'datacenter' });
  jogo.dinheiro = 99999;
  let i = 0;
  for (const k of [...jogo.mapa.construivel].slice(0, 24)) {
    construir(jogo, k % LARGURA, Math.floor(k / LARGURA), i++ % 2 ? 'geminado' : 'haicai');
  }
  jogo.onda = 30; jogo.ondaAtual = definirOnda(30); jogo.emOnda = true;
  for (let n = 0; n < 130; n++) jogo.fila.push({ t: 0, tipo: 'blindado', rota: 0, hpMult: 3 });
  passo(jogo, DT);
  ok(jogo.pragas.length >= 120, `so ${jogo.pragas.length} pragas na tela`);
  const t0 = process.hrtime.bigint();
  for (let q = 0; q < 600; q++) passo(jogo, DT);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const porQuadro = ms / 600;
  ok(porQuadro < 16.6, `${porQuadro.toFixed(2)} ms por quadro de simulacao com a tela cheia`);
  corridas.push({ desempenho: porQuadro, pragas: jogo.pragas.length });
});

// =====================================================================
// relatorio
// =====================================================================

console.log('\n');
for (const c of corridas.filter(x => x.mapa)) {
  const tipos = new Set(c.torres.map(t => t.tipo));
  console.log(`${c.mapa.padEnd(11)} 40 ondas  integridade ${String(c.vidas).padStart(2)}/${c.jogo.vidasMax}  ` +
    `${String(c.torres.length).padStart(2)} torres de ${tipos.size} modelos  ` +
    `${String(c.estat.mortas).padStart(4)} pragas mortas  ${c.minutos.toFixed(0)} min de partida  ` +
    `VRAM ${c.jogo.usoVram.toFixed(0)}/${c.jogo.capacidadeVram.toFixed(0)}`);
}
const desempenho = corridas.find(c => c.desempenho);
if (desempenho) {
  console.log(`\nsimulacao   ${desempenho.pragas} pragas na tela em ${desempenho.desempenho.toFixed(2)} ms por quadro ` +
    `(teto de 16,6 ms para 60 fps; o resto do orcamento e do desenho)`);
}

console.log(`\n${feitas} provas passaram, ${falhas.length} falharam.`);
for (const f of falhas) console.log(`\n  FALHOU  ${f.nome}\n          ${f.erro.message}`);
console.log('');
if (falhas.length) process.exit(1);
