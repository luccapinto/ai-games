// As missoes, declaradas como grafo de dependencia — e nao como lista.
//
// Declarar dependencia em vez de ordem e o que permite provar duas coisas que
// mundo aberto costuma errar: que o grafo nao tem ciclo (missao que exige a si
// mesma, direta ou indiretamente, e uma missao que ninguem pega) e que todo alvo
// existe **naquele mundo** e da para chegar nele a pe. O alvo nao esta escrito
// aqui: ele e resolvido na geracao, contra o mundo que saiu daquela semente.

import { TERRENOS, andavel, daParaChegar } from './mundo.js';

export const MISSOES = [
  {
    id: 'a-adutora-secou',
    titulo: 'A adutora secou',
    principal: true,
    requer: [],
    dador: { vila: 0, papel: 'curandeira' },
    tipo: 'falar',
    alvoPapel: 'vendedor',
    alvoVila: 0,
    texto: 'A cacimba baixou um palmo por semana. Fala com quem vende na feira: '
      + 'ele viu a adutora velha quando era menino.',
    recompensa: { moedas: 6 },
  },
  {
    id: 'cantil-furado',
    titulo: 'Cantil furado',
    principal: true,
    requer: ['a-adutora-secou'],
    dador: { vila: 0, papel: 'ferreiro' },
    tipo: 'coletar',
    item: 'couro',
    quantidade: 3,
    texto: 'Sem cantil que segure agua, ninguem atravessa a caatinga. '
      + 'Traz tres couros e eu costuro.',
    recompensa: { moedas: 10, item: 'cantil' },
  },
  {
    id: 'o-cangaco-na-estrada',
    titulo: 'O cangaço na estrada',
    principal: true,
    requer: ['cantil-furado'],
    dador: { vila: 1, papel: 'vaqueiro' },
    tipo: 'matar',
    alvoTipo: 'cangaceiro',
    quantidade: 3,
    naEstrada: true,
    texto: 'Tem tres homens cobrando pedagio na estrada. Enquanto eles estiverem '
      + 'lá, ninguem leva peça nenhuma para a serra.',
    recompensa: { moedas: 22, item: 'facao' },
  },
  {
    id: 'a-chave-da-bomba',
    titulo: 'A chave da bomba',
    principal: true,
    requer: ['o-cangaco-na-estrada'],
    dador: { vila: 1, papel: 'vendedor' },
    tipo: 'visitar',
    alvoLugar: 'ruina',
    texto: 'A casa de bomba fica encostada na serra. A chave da comporta ficou lá, '
      + 'pendurada num gancho, desde que o poço secou.',
    recompensa: { moedas: 18, item: 'chave' },
  },
  {
    id: 'o-vaqueiro-que-sabe',
    titulo: 'O vaqueiro que sabe',
    principal: true,
    requer: ['a-chave-da-bomba'],
    dador: { vila: 2, papel: 'rezadeira' },
    tipo: 'falar',
    alvoPapel: 'vaqueiro',
    alvoVila: 3,
    texto: 'Quem tocou boi por esse sertao antes da seca sabe onde a adutora passa. '
      + 'Procura o vaqueiro da vila do outro lado.',
    recompensa: { moedas: 14 },
  },
  {
    id: 'as-pecas-da-adutora',
    titulo: 'As peças da adutora',
    principal: true,
    requer: ['o-vaqueiro-que-sabe'],
    dador: { vila: 3, papel: 'vaqueiro' },
    tipo: 'coletar',
    item: 'peca',
    quantidade: 4,
    texto: 'Levaram as peças da adutora para vender como ferro velho e espalharam. '
      + 'Sao quatro, e sem as quatro a bomba nao pega.',
    recompensa: { moedas: 26 },
  },
  {
    id: 'abrir-a-adutora',
    titulo: 'Abrir a adutora',
    principal: true,
    requer: ['as-pecas-da-adutora'],
    dador: { vila: 4, papel: 'vendedor' },
    tipo: 'levar',
    item: 'peca',
    quantidade: 4,
    alvoLugar: 'acude',
    texto: 'Com as quatro peças e a chave, a comporta do açude abre. '
      + 'Depois disso a agua desce sozinha.',
    recompensa: { moedas: 60 },
  },

  // --- as de lado -------------------------------------------------------
  {
    id: 'remedio-de-mandacaru',
    titulo: 'Remédio de mandacaru',
    principal: false,
    requer: [],
    dador: { vila: 1, papel: 'rezadeira' },
    tipo: 'coletar',
    item: 'mandacaru',
    quantidade: 2,
    texto: 'Dois mandacarus maduros e eu faço o xarope da tosse do menino.',
    recompensa: { moedas: 8 },
  },
  {
    id: 'a-cabra-fujona',
    titulo: 'A cabra fujona',
    principal: false,
    requer: [],
    dador: { vila: 0, papel: 'vaqueiro' },
    tipo: 'visitar',
    alvoLugar: 'pasto',
    texto: 'A cabra malhada sumiu no mato. Se achar, ela volta sozinha atras de gente.',
    recompensa: { moedas: 9 },
  },
  {
    id: 'a-onca-do-poco',
    titulo: 'A onça do poço',
    principal: false,
    requer: ['cantil-furado'],
    dador: { vila: 2, papel: 'vaqueiro' },
    tipo: 'matar',
    alvoTipo: 'onca',
    quantidade: 1,
    texto: 'Uma onça pintada fez ponto perto da agua. Enquanto ela estiver lá, '
      + 'ninguem enche cantil de noite.',
    recompensa: { moedas: 20, item: 'rifle' },
  },
  {
    id: 'a-carta-atrasada',
    titulo: 'A carta atrasada',
    principal: false,
    requer: [],
    dador: { vila: 2, papel: 'vendedor' },
    tipo: 'falar',
    alvoPapel: 'curandeira',
    alvoVila: 4,
    texto: 'Essa carta esta comigo desde a festa de junho. Leva para a outra vila.',
    recompensa: { moedas: 11 },
  },
  {
    id: 'sal-da-salina',
    titulo: 'Sal da salina',
    principal: false,
    requer: [],
    dador: { vila: 3, papel: 'vendedor' },
    tipo: 'coletar',
    item: 'sal',
    quantidade: 5,
    texto: 'Cinco punhados de sal da salina branca. Pago bem, que carne sem sal apodrece.',
    recompensa: { moedas: 13 },
  },
  {
    id: 'lenha-para-o-forno',
    titulo: 'Lenha para o forno',
    principal: false,
    requer: [],
    dador: { vila: 4, papel: 'ferreiro' },
    tipo: 'coletar',
    item: 'madeira',
    quantidade: 6,
    texto: 'Seis paus de lenha seca da mata do rio e o forno acende amanha.',
    recompensa: { moedas: 12, item: 'cantil' },
  },
];

const PRINCIPAIS = MISSOES.filter(m => m.principal);

// Em celulas: a ida e a volta ate a agua mais proxima tem de caber num cantil.
export const LIMITE_DE_AGUA = 55;

// --------------------------------------------------------------- o grafo

export function validarGrafo() {
  const problemas = [];
  const vistos = new Set();
  for (const m of MISSOES) {
    if (vistos.has(m.id)) problemas.push(`missao repetida: ${m.id}`);
    vistos.add(m.id);
  }
  for (const m of MISSOES) {
    for (const req of m.requer) {
      if (!vistos.has(req)) problemas.push(`${m.id} exige ${req}, que nao existe`);
    }
    if (m.requer.includes(m.id)) problemas.push(`${m.id} exige a si mesma`);
  }
  if (ordemPossivel().length !== MISSOES.length) {
    problemas.push('ha ciclo no grafo: a ordem topologica nao cobre todas as missoes');
  }
  return problemas;
}

// Kahn: se sobrar missao sem entrar na ordem, e porque existe ciclo.
export function ordemPossivel() {
  const pendentes = new Map(MISSOES.map(m => [m.id, new Set(m.requer)]));
  const ordem = [];
  let mexeu = true;
  while (mexeu) {
    mexeu = false;
    for (const [id, requer] of pendentes) {
      if (requer.size) continue;
      ordem.push(id);
      pendentes.delete(id);
      for (const outro of pendentes.values()) outro.delete(id);
      mexeu = true;
    }
  }
  return ordem;
}

// --------------------------------------------- instanciar contra o mundo

export function instanciar(mundo, sorteio) {
  const vila = (i) => mundo.vilas[i % mundo.vilas.length];
  const npcDe = (indiceVila, papel) => {
    const v = vila(indiceVila);
    return v.npcs.find(n => n.papel === papel) || v.npcs[0];
  };

  for (const missao of MISSOES) {
    const dador = npcDe(missao.dador.vila, missao.dador.papel);
    let alvo = null;
    if (missao.tipo === 'falar') {
      alvo = npcDe(missao.alvoVila ?? missao.dador.vila, missao.alvoPapel);
    } else if (missao.tipo === 'coletar') {
      alvo = recursoMaisProximo(mundo, missao.item, dador) || { x: dador.x, y: dador.y };
    } else if (missao.tipo === 'matar') {
      alvo = pontoDeEstrada(mundo, sorteio) || { x: dador.x, y: dador.y };
    } else if (missao.tipo === 'visitar' || missao.tipo === 'levar') {
      alvo = lugar(mundo, missao.alvoLugar, sorteio) || { x: dador.x, y: dador.y };
    }
    mundo.missoes[missao.id] = {
      id: missao.id,
      estado: missao.requer.length ? 'fechada' : 'disponivel',
      progresso: 0,
      dador,
      alvo,
    };
  }
}

function recursoMaisProximo(mundo, tipo, de) {
  let melhor = null;
  for (const r of mundo.recursos) {
    if (r.tipo !== tipo) continue;
    const d = Math.hypot(r.x - de.x, r.y - de.y);
    if (!melhor || d < melhor.d) melhor = { d, x: r.x, y: r.y, tipo };
  }
  return melhor;
}

// Ponto de estrada com agua a distancia de cantil: o pedagio do cangaco fica
// onde da para brigar e voltar, e nao no trecho mais seco da estrada.
function pontoDeEstrada(mundo, sorteio) {
  if (!mundo.estradas.length) return null;
  const estrada = mundo.estradas[Math.floor(sorteio() * mundo.estradas.length)];
  const pontos = estrada.pontos;
  const meio = Math.floor(pontos.length * 0.5);
  for (let passo = 0; passo < pontos.length; passo++) {
    for (const i of [meio + passo, meio - passo]) {
      if (i < 0 || i >= pontos.length) continue;
      const p = pontos[i];
      if (mundo.distanciaDaAgua[p.y * mundo.largura + p.x] > LIMITE_DE_AGUA) continue;
      return { x: p.x + 0.5, y: p.y + 0.5, lugar: 'estrada' };
    }
  }
  const p = pontos[meio];
  return { x: p.x + 0.5, y: p.y + 0.5, lugar: 'estrada' };
}

// Os tres lugares que as missoes citam, achados no mundo daquela semente:
// a ruina encostada na serra, o acude (maior corpo de agua) e o pasto na mata.
function lugar(mundo, qual, sorteio) {
  const { largura, altura } = mundo;
  const longeDeVila = (x, y) => mundo.vilas.every(v => Math.hypot(v.x - x, v.y - y) > 14);
  // Alvo de missao tem de ser alcancavel a pe. O acude e o pior caso: a conta
  // de "celula com seis vizinhos de agua" acha ilha no meio do rio com a mesma
  // facilidade com que acha margem, e a prova pegou exatamente isso.
  // Alvo de missao tem de ser alcancavel a pe E ter agua a meio cantil de
  // distancia. A ruina encostada na serra passava no primeiro teste e matava o
  // jogador no segundo: nas sementes 1111 e 1222 o robo chegava lá e morria de
  // sede, com quatro missoes feitas e a quinta impossivel.
  const chega = (x, y) => andavel(mundo, x, y) && daParaChegar(mundo, x, y)
    && mundo.distanciaDaAgua[y * largura + x] <= LIMITE_DE_AGUA;

  if (qual === 'ruina') {
    let melhor = null;
    for (let tentativa = 0; tentativa < 4000; tentativa++) {
      const x = 8 + Math.floor(sorteio() * (largura - 16));
      const y = 8 + Math.floor(sorteio() * (altura - 16));
      if (mundo.terreno[y * largura + x] !== TERRENOS.caatinga) continue;
      let serra = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (mundo.terreno[(y + dy) * largura + (x + dx)] === TERRENOS.serra) serra++;
        }
      }
      if (serra < 4) continue;
      const nota = serra + (longeDeVila(x, y) ? 10 : 0);
      if (melhor && nota <= melhor.nota) continue;
      if (!chega(x, y)) continue;
      melhor = { x: x + 0.5, y: y + 0.5, nota, lugar: 'ruina' };
    }
    return melhor;
  }

  if (qual === 'acude') {
    let melhor = null;
    for (let tentativa = 0; tentativa < 4000; tentativa++) {
      const x = 6 + Math.floor(sorteio() * (largura - 12));
      const y = 6 + Math.floor(sorteio() * (altura - 12));
      if (mundo.terreno[y * largura + x] === TERRENOS.serra) continue;
      if (mundo.terreno[y * largura + x] === TERRENOS.agua) continue;
      let agua = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (mundo.terreno[(y + dy) * largura + (x + dx)] === TERRENOS.agua) agua++;
        }
      }
      if (agua < 6) continue;
      const nota = agua + (longeDeVila(x, y) ? 6 : 0);
      if (melhor && nota <= melhor.nota) continue;
      if (!chega(x, y)) continue;
      melhor = { x: x + 0.5, y: y + 0.5, nota, lugar: 'acude' };
    }
    return melhor;
  }

  // pasto: mata longe de vila
  let melhor = null;
  for (let tentativa = 0; tentativa < 4000; tentativa++) {
    const x = 6 + Math.floor(sorteio() * (largura - 12));
    const y = 6 + Math.floor(sorteio() * (altura - 12));
    if (mundo.terreno[y * largura + x] !== TERRENOS.mata) continue;
    const nota = sorteio() + (longeDeVila(x, y) ? 3 : 0);
    if (melhor && nota <= melhor.nota) continue;
    if (!chega(x, y)) continue;
    melhor = { x: x + 0.5, y: y + 0.5, nota, lugar: 'pasto' };
  }
  return melhor;
}

export { PRINCIPAIS };
