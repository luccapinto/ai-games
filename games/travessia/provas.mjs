#!/usr/bin/env node
// As provas do TRAVESSIA. Rode com: node provas.mjs
//
// Mundo gerado e o genero em que "parece bom" mente mais rapido: a primeira
// semente sempre parece boa, e a decima tem a vila do meio cercada de rio, a
// missao que pede um item que nao nasce naquele mundo e o acude que fica longe
// demais para chegar vivo. Nada disso aparece jogando uma vez.
//
// Por isso tudo aqui e provado em trinta sementes, e a prova final e um robo que
// joga a linha principal inteira — com a mesma caminhada, a mesma sede e o mesmo
// combate do navegador.

import { gerarMundo, TERRENOS, andavel, caminho, vizinhos } from './js/mundo.js';
import { MISSOES, validarGrafo, ordemPossivel, LIMITE_DE_AGUA } from './js/missoes.js';
import { criarJogo, passo, entradaNula, CONFIG, DT } from './js/jogo.js';
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
    process.stdout.write('x');
  }
}

const ok = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m) => { if (a !== b) throw new Error(`${m}: esperava ${b}, veio ${a}`); };
function entre(v, min, max, m) {
  if (!(v >= min && v <= max)) throw new Error(`${m}: ${Number(v).toFixed(3)} fora de [${min}, ${max}]`);
}

const SEMENTES = Array.from({ length: 30 }, (_, i) => 1000 + i * 37);
const mundos = SEMENTES.map(s => gerarMundo(s));
const primeiro = mundos[0];

// ------------------------------------------------ 1. o gerador e honesto

prova('a mesma semente da o mesmo mundo', () => {
  const a = gerarMundo(4242);
  const b = gerarMundo(4242);
  igual(a.assinatura, b.assinatura, 'assinatura do mundo');
  const c = gerarMundo(4243);
  ok(a.assinatura !== c.assinatura, 'sementes diferentes deram o mesmo mundo');
});

prova('o mundo tem os cinco terrenos, em proporcao de sertao', () => {
  for (const m of mundos) {
    const conta = {};
    for (const t of m.terreno) conta[t] = (conta[t] || 0) + 1;
    const total = m.terreno.length;
    const fatia = (nome) => (conta[TERRENOS[nome]] || 0) / total;
    entre(fatia('caatinga'), 0.3, 0.8, `semente ${m.semente}: caatinga`);
    entre(fatia('agua'), 0.01, 0.2, `semente ${m.semente}: agua`);
    ok(fatia('serra') > 0.02, `semente ${m.semente}: sem serra`);
    ok(fatia('mata') > 0.02, `semente ${m.semente}: sem mata`);
    ok(fatia('salina') > 0.004, `semente ${m.semente}: sem salina`);
  }
});

prova('toda vila nasce em chao andavel e longe das outras', () => {
  for (const m of mundos) {
    igual(m.vilas.length, CONFIG.vilas, `semente ${m.semente}: vilas`);
    for (const vila of m.vilas) {
      ok(andavel(m, vila.x, vila.y),
        `semente ${m.semente}: a vila ${vila.nome} nasceu em ${vila.x},${vila.y} sem chao`);
    }
    for (const a of m.vilas) {
      for (const b of m.vilas) {
        if (a === b) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        ok(d > CONFIG.distanciaMinimaEntreVilas,
          `semente ${m.semente}: ${a.nome} e ${b.nome} a ${d.toFixed(0)} de distancia`);
      }
    }
  }
});

prova('da para ir a pe de qualquer vila a qualquer outra', () => {
  // Vila cercada de rio e o defeito classico de mundo gerado, e ele nao
  // aparece na semente que a gente joga. Aparece na decima.
  for (const m of mundos) {
    const base = m.vilas[0];
    for (const vila of m.vilas.slice(1)) {
      const rota = caminho(m, base, vila);
      ok(rota, `semente ${m.semente}: nao ha caminho de ${base.nome} a ${vila.nome}`);
    }
  }
});

prova('toda vila tem agua, quem vende e quem manda recado', () => {
  for (const m of mundos) {
    for (const vila of m.vilas) {
      ok(vila.agua, `semente ${m.semente}: ${vila.nome} sem cacimba`);
      ok(andavel(m, vila.agua.x, vila.agua.y),
        `semente ${m.semente}: a cacimba de ${vila.nome} ficou dentro de pedra`);
      const papeis = new Set(vila.npcs.map(n => n.papel));
      ok(papeis.has('vendedor'), `semente ${m.semente}: ${vila.nome} sem vendedor`);
      ok(vila.npcs.length >= 3, `semente ${m.semente}: ${vila.nome} com ${vila.npcs.length} pessoas`);
    }
  }
});

prova('a estrada entre vilas e andavel do comeco ao fim', () => {
  for (const m of mundos) {
    ok(m.estradas.length >= m.vilas.length - 1,
      `semente ${m.semente}: ${m.estradas.length} estradas para ${m.vilas.length} vilas`);
    for (const estrada of m.estradas) {
      for (const p of estrada.pontos) {
        ok(andavel(m, p.x, p.y),
          `semente ${m.semente}: a estrada passa por ${p.x},${p.y}, que nao da passagem`);
      }
    }
  }
});

// -------------------------------------------- 2. a sede e sobrevivivel

prova('ha agua a menos de meio cantil de qualquer ponto da estrada', () => {
  // Esta e a prova que define o ritmo do jogo: se a proxima agua estiver mais
  // longe que o cantil aguenta, a travessia deixa de ser decisao e vira morte.
  const alcance = (CONFIG.sedeMaxima / CONFIG.sedePorSegundo) * CONFIG.velocidade * 0.5;
  for (const m of mundos) {
    for (const estrada of m.estradas) {
      for (const [i, p] of estrada.pontos.entries()) {
        if (i % 6) continue;
        const d = m.distanciaDaAgua[p.y * m.largura + p.x];
        ok(d * 1 <= alcance,
          `semente ${m.semente}: ponto ${p.x},${p.y} da estrada esta a ${d} da agua, `
          + `e o cantil cheio anda ${alcance.toFixed(0)}`);
      }
    }
  }
});

prova('beber enche o cantil e a sede volta a subir', () => {
  const jogo = criarJogo(1000);
  const j = jogo.jogador;
  j.sede = 40;
  jogo.mundo.terreno[Math.floor(j.y) * jogo.mundo.largura + Math.floor(j.x)] = TERRENOS.agua;
  passo(jogo, { ...entradaNula(), beber: true }, DT);
  igual(Math.round(j.sede), CONFIG.sedeMaxima, 'sede depois de beber');
  for (let i = 0; i < 60 * 30; i++) passo(jogo, entradaNula(), DT);
  ok(j.sede < CONFIG.sedeMaxima, 'a sede nao subiu em 30 s');
});

prova('sede no fim tira vida', () => {
  const jogo = criarJogo(1000);
  jogo.jogador.sede = 0;
  const vida = jogo.jogador.vida;
  for (let i = 0; i < 60 * 20; i++) passo(jogo, entradaNula(), DT);
  ok(jogo.jogador.vida < vida, 'vinte segundos sem agua e sem perder vida');
});

prova('o meio-dia custa mais agua que a madrugada', () => {
  const medir = (hora) => {
    const jogo = criarJogo(1000, { hora });
    const antes = jogo.jogador.sede;
    for (let i = 0; i < 60 * 60; i++) passo(jogo, entradaNula(), DT);
    return antes - jogo.jogador.sede;
  };
  const meioDia = medir(12);
  const madrugada = medir(3);
  ok(meioDia > madrugada * 1.4,
    `meio-dia gastou ${meioDia.toFixed(1)} e a madrugada ${madrugada.toFixed(1)}`);
});

prova('o dia fecha o ciclo', () => {
  const jogo = criarJogo(1000, { hora: 6 });
  const passos = Math.round(CONFIG.duracaoDoDia / DT);
  for (let i = 0; i < passos; i++) {
    // cantil cheio a cada passo: aqui o que se mede e o relogio, e um jogador
    // parado morre de sede antes de o dia fechar — que e outra prova, acima.
    jogo.jogador.sede = CONFIG.sedeMaxima;
    passo(jogo, entradaNula(), DT);
  }
  entre(jogo.hora, 5.8, 6.2, 'hora depois de um dia inteiro');
});

// ------------------------------------------------- 3. as missoes fecham

prova('o grafo de missoes e aciclico e completo', () => {
  const problemas = validarGrafo();
  igual(problemas.length, 0, `grafo de missoes: ${problemas.join('; ')}`);
  const ordem = ordemPossivel();
  igual(ordem.length, MISSOES.length, 'missoes na ordem topologica');
});

prova('toda missao tem dador, alvo e recompensa que existem no mundo', () => {
  for (const m of mundos) {
    for (const missao of MISSOES) {
      const estado = m.missoes[missao.id];
      ok(estado, `semente ${m.semente}: a missao ${missao.id} nao foi instanciada`);
      ok(estado.dador, `semente ${m.semente}: ${missao.id} sem dador`);
      ok(estado.alvo, `semente ${m.semente}: ${missao.id} sem alvo`);
      const alvo = estado.alvo;
      ok(andavel(m, Math.floor(alvo.x), Math.floor(alvo.y)),
        `semente ${m.semente}: o alvo de ${missao.id} caiu em ${alvo.x},${alvo.y}, sem chao`);
      const rota = caminho(m, m.vilas[0], { x: Math.floor(alvo.x), y: Math.floor(alvo.y) });
      ok(rota, `semente ${m.semente}: o alvo de ${missao.id} e inalcancavel a pe`);
    }
  }
});

prova('o mundo tem recurso bastante para as missoes que pedem coleta', () => {
  for (const m of mundos) {
    for (const missao of MISSOES) {
      if (missao.tipo !== 'coletar' && missao.tipo !== 'levar') continue;
      if (!missao.item) continue;
      const quantos = m.recursos.filter(r => r.tipo === missao.item).length;
      ok(quantos >= missao.quantidade,
        `semente ${m.semente}: ${missao.id} pede ${missao.quantidade} de `
        + `${missao.item} e o mundo tem ${quantos}`);
    }
  }
});

prova('todo alvo de missao tem agua a meio cantil de distancia', () => {
  // Chegar nao basta: tem de dar para voltar. A ruina encostada na serra era
  // alcancavel e mortal, e foi assim que duas sementes de tres mataram o robo.
  for (const m of mundos) {
    for (const missao of MISSOES) {
      const alvo = m.missoes[missao.id].alvo;
      const d = m.distanciaDaAgua[Math.floor(alvo.y) * m.largura + Math.floor(alvo.x)];
      ok(d <= LIMITE_DE_AGUA,
        `semente ${m.semente}: o alvo de ${missao.id} esta a ${d} celulas da agua, `
        + `e o limite de projeto e ${LIMITE_DE_AGUA}`);
    }
  }
});

prova('a linha principal tem sete missoes e uma so ordem de dependencia', () => {
  const principais = MISSOES.filter(m => m.principal);
  igual(principais.length, 7, 'missoes principais');
  for (const [i, missao] of principais.entries()) {
    if (i === 0) igual(missao.requer.length, 0, `${missao.id} deveria abrir o jogo`);
    else ok(missao.requer.includes(principais[i - 1].id),
      `${missao.id} nao depende de ${principais[i - 1].id}`);
  }
});

prova('missao entregue paga a recompensa e nao paga duas vezes', () => {
  const jogo = criarJogo(1000);
  const primeira = MISSOES.find(m => m.principal && m.requer.length === 0);
  jogo.missoes[primeira.id].estado = 'aceita';
  jogo.missoes[primeira.id].progresso = primeira.quantidade || 1;
  const antes = jogo.jogador.moedas;
  jogo.concluir(primeira.id);
  const depois = jogo.jogador.moedas;
  ok(depois > antes, 'concluir missao nao pagou nada');
  jogo.concluir(primeira.id);
  igual(jogo.jogador.moedas, depois, 'concluir de novo pagou de novo');
});

// --------------------------------------------------- 4. corpo e combate

prova('o jogador nao atravessa serra nem rio', () => {
  for (const semente of SEMENTES.slice(0, 6)) {
    const jogo = criarJogo(semente);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
      const j = criarJogo(semente);
      for (let i = 0; i < 60 * 40; i++) {
        passo(j, { ...entradaNula(), x: dx, y: dy, correr: true }, DT);
      }
      ok(andavel(j.mundo, Math.floor(j.jogador.x), Math.floor(j.jogador.y)),
        `semente ${semente}: andando para ${dx},${dy} terminou dentro de ${j.mundo.terreno[Math.floor(j.jogador.y) * j.mundo.largura + Math.floor(j.jogador.x)]}`);
      ok(j.jogador.x > 0 && j.jogador.y > 0
        && j.jogador.x < j.mundo.largura && j.jogador.y < j.mundo.altura,
        `semente ${semente}: saiu do mundo indo para ${dx},${dy}`);
    }
    ok(jogo.jogador.vida > 0, 'o jogo nao comeca com o jogador vivo');
  }
});

prova('com faca da para ganhar de um cangaceiro; de mao vazia, nao', () => {
  const lutar = (arma) => {
    const jogo = criarJogo(1000);
    jogo.jogador.arma = arma;
    const bicho = jogo.soltarInimigo('cangaceiro', jogo.jogador.x + 3, jogo.jogador.y);
    for (let i = 0; i < 60 * 60 && jogo.jogador.vida > 0 && bicho.vida > 0; i++) {
      const dx = bicho.x - jogo.jogador.x;
      const dy = bicho.y - jogo.jogador.y;
      const d = Math.hypot(dx, dy) || 1;
      passo(jogo, {
        ...entradaNula(),
        x: d > 1.1 ? dx / d : 0,
        y: d > 1.1 ? dy / d : 0,
        atacar: true,
      }, DT);
    }
    return { venceu: bicho.vida <= 0, vida: jogo.jogador.vida };
  };
  const comFaca = lutar('faca');
  ok(comFaca.venceu, 'com faca o cangaceiro nao caiu em um minuto');
  ok(comFaca.vida > 0, 'com faca o jogador morreu');
  const semNada = lutar('maos');
  ok(!semNada.venceu || semNada.vida < comFaca.vida,
    'lutar de mao vazia saiu igual ou melhor que com faca');
});

prova('a mesma semente e a mesma entrada dao a mesma partida', () => {
  const rodar = () => {
    const jogo = criarJogo(777);
    let x = 11;
    for (let i = 0; i < 60 * 30; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      passo(jogo, {
        ...entradaNula(),
        x: (((x >> 5) % 3) - 1),
        y: (((x >> 9) % 3) - 1),
        atacar: ((x >> 13) & 7) === 0,
      }, DT);
    }
    return `${jogo.jogador.x.toFixed(6)}|${jogo.jogador.y.toFixed(6)}|${jogo.jogador.sede.toFixed(3)}`;
  };
  igual(rodar(), rodar(), 'duas partidas identicas divergiram');
});

// ------------------------------------------- 5. a prova que importa

let corrida = null;

prova('um robo termina a linha principal em tres sementes diferentes', () => {
  corrida = [1000, 1111, 1222].map(s => robo(s));
  for (const r of corrida) {
    ok(r.terminou,
      `semente ${r.semente}: o robo parou em ${r.concluidas}/7 (${r.motivo})`);
    entre(r.minutos, 2, 45, `semente ${r.semente}: tempo do robo em minutos`);
    ok(r.vidaFinal > 0, `semente ${r.semente}: o robo terminou morto`);
  }
});

// ----------------------------------------------------------------- saida

const m = primeiro;
const conta = {};
for (const t of m.terreno) conta[t] = (conta[t] || 0) + 1;
console.log(`\n\nmundo da semente ${m.semente}: ${m.largura}x${m.altura} celulas`);
console.log('terreno   ' + Object.entries(TERRENOS)
  .map(([nome, codigo]) => `${nome} ${((conta[codigo] || 0) / m.terreno.length * 100).toFixed(1)}%`)
  .join('   '));
console.log('vilas     ' + m.vilas.map(v => `${v.nome} (${v.x},${v.y}, ${v.npcs.length} pessoas)`).join(' · '));
console.log(`estradas  ${m.estradas.length}, somando ${m.estradas.reduce((s, e) => s + e.pontos.length, 0)} celulas`);

if (corrida) {
  console.log('\nsemente   robo   missoes   minutos   vida   sede   bebeu   lutou');
  for (const r of corrida) {
    console.log(
      `${String(r.semente).padEnd(10)}${(r.terminou ? 'ok' : 'FALHA').padEnd(7)}`
      + `${`${r.concluidas}/7`.padStart(7)}${r.minutos.toFixed(1).padStart(10)}`
      + `${r.vidaFinal.toFixed(0).padStart(7)}${r.sedeFinal.toFixed(0).padStart(7)}`
      + `${String(r.bebeu).padStart(8)}${String(r.lutas).padStart(8)}`);
  }
}

console.log(`\n${feitas} provas passaram, ${falhas.length} falharam.`);
for (const f of falhas) console.log(`\n  FALHOU  ${f.nome}\n          ${f.erro.message}`);
console.log('');
if (falhas.length) process.exit(1);
