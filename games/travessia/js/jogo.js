// O jogo inteiro, sem uma linha de desenho: corpo, sede, hora, coleta, combate,
// missao e recompensa.
//
// Duas decisoes de regra que valem ser ditas em voz alta:
//
// 1. Missao de coletar e de matar se conclui sozinha quando a conta fecha — o
//    recado corre no sertao. Missao de falar, visitar e levar se conclui
//    chegando. Isso evita a caminhada de volta puramente administrativa, e
//    mantem a decisao onde ela interessa: ir ou nao ir, com quanta agua.
// 2. O bicho nasce onde a missao diz que ele esta. Sortear inimigo pelo mapa e
//    barato de escrever e impossivel de provar; com o inimigo ancorado no alvo
//    da missao, `provas.mjs` pode exigir que o robo termine a linha principal.

import { CONFIG, criarSorteio } from './regras.js';
import {
  gerarMundo, TERRENOS, tile, andavel, naEstrada, aguaMaisProxima,
} from './mundo.js';
import { MISSOES } from './missoes.js';

export { CONFIG } from './regras.js';
export const DT = 1 / 60;

export const ARMAS = {
  maos: { nome: 'MÃOS', dano: 6, cadencia: 0.7, alcance: 1.1 },
  faca: { nome: 'FACA', dano: 12, cadencia: 0.55, alcance: 1.3 },
  facao: { nome: 'FACÃO', dano: 20, cadencia: 0.6, alcance: 1.7 },
  rifle: { nome: 'RIFLE', dano: 34, cadencia: 1.1, alcance: 7 },
};

export const BICHOS = {
  // O cangaceiro nao desiste: ele e alvo de missao e cobra pedagio onde esta,
  // inclusive dentro de vila. Quem foge dele foge andando — ele e mais lento.
  cangaceiro: {
    nome: 'CANGACEIRO', vida: 46, dano: 9, cadencia: 1.1,
    velocidade: 2.9, alcance: 1.3, percepcao: 14, desiste: false, cor: '#8a5a3a',
  },
  // A onca era 16 de dano a cada 1,3 s (12,3 por segundo) e corria a 4,4: o
  // jogador morria em 8,1 s e nem andando escapava. Agora sao 7,5 por segundo
  // — 13,3 s de sobrevida — e 4,0 de velocidade: andar (3,4) ainda nao foge,
  // correr (5,6) foge. E bicho do mato: perde o jogador de vista e nao entra
  // em vila.
  onca: {
    nome: 'ONÇA', vida: 70, dano: 12, cadencia: 1.6,
    velocidade: 4.0, alcance: 1.4, percepcao: 17, desiste: true, cor: '#c8923a',
  },
};

export function entradaNula() {
  return { x: 0, y: 0, correr: false, atacar: false, interagir: false, beber: false };
}

export function criarJogo(semente, opcoes = {}) {
  const mundo = gerarMundo(semente);
  const vila = mundo.vilas[0];
  const jogador = {
    x: vila.x + 0.5, y: vila.y + 1.5, ang: 0,
    vida: CONFIG.vidaMaxima,
    sede: CONFIG.sedeMaxima,
    sedeMaxima: CONFIG.sedeMaxima,
    moedas: CONFIG.moedasIniciais,
    arma: opcoes.arma || 'faca',
    armas: { maos: true, faca: true },
    inventario: {},
    recarga: 0,
    dor: 0,
    invulneravel: 0,
    andou: 0,
  };

  const jogo = {
    semente,
    mundo,
    jogador,
    inimigos: [],
    eventos: [],
    hora: opcoes.hora ?? 6.5,
    tempo: 0,
    missoes: mundo.missoes,
    sorteio: criarSorteio(semente ^ 0x77aa),
    bebeu: 0,
    abatidos: 0,
    relogioDeBicho: 3,
    fim: null,
  };

  jogo.concluir = (id) => concluir(jogo, id);
  jogo.aceitar = (id) => aceitar(jogo, id);
  jogo.soltarInimigo = (tipo, x, y) => soltarInimigo(jogo, tipo, x, y);
  jogo.comprar = (id) => comprar(jogo, id);
  abrirDisponiveis(jogo);
  return jogo;
}

// ------------------------------------------------------------------ passo

export function passo(jogo, entrada, dt = DT) {
  jogo.eventos = [];
  if (jogo.fim) return jogo.eventos;

  jogo.tempo += dt;
  jogo.hora = (jogo.hora + (24 / CONFIG.duracaoDoDia) * dt) % 24;

  const j = jogo.jogador;
  j.recarga = Math.max(0, j.recarga - dt);
  j.dor = Math.max(0, j.dor - dt * 2);
  j.invulneravel = Math.max(0, j.invulneravel - dt);

  andar(jogo, entrada, dt);
  gastarSede(jogo, entrada, dt);
  if (entrada.beber) beber(jogo);
  if (entrada.atacar) atacar(jogo);
  if (entrada.interagir) falar(jogo);
  coletar(jogo);
  conferirLugares(jogo);
  cuidarDosBichos(jogo, dt);

  if (j.vida <= 0) {
    j.vida = 0;
    jogo.fim = 'morreu';
    jogo.eventos.push({ tipo: 'morreu' });
  } else if (MISSOES.filter(m => m.principal)
    .every(m => jogo.missoes[m.id].estado === 'concluida')) {
    jogo.fim = 'venceu';
    jogo.eventos.push({ tipo: 'venceu' });
  }
  return jogo.eventos;
}

// ------------------------------------------------------------------ corpo

export function calorDaHora(hora) {
  // Pico as 13h, zero de madrugada. E a curva que faz a madrugada valer a pena.
  const t = Math.cos(((hora - 13) / 24) * Math.PI * 2);
  return Math.max(0, t) ** 1.5;
}

export function claridade(hora) {
  if (hora <= CONFIG.horaDoNascer || hora >= CONFIG.horaDoPor + 1) return 0.12;
  if (hora < CONFIG.horaDoNascer + 1.5) {
    return 0.12 + 0.88 * ((hora - CONFIG.horaDoNascer) / 1.5);
  }
  if (hora > CONFIG.horaDoPor - 1) {
    return 0.12 + 0.88 * Math.max(0, (CONFIG.horaDoPor + 1 - hora) / 2);
  }
  return 1;
}

function velocidadeNoChao(mundo, x, y) {
  const t = tile(mundo, Math.floor(x), Math.floor(y));
  if (naEstrada(mundo, Math.floor(x), Math.floor(y))) return CONFIG.velocidadeEstrada;
  if (t === TERRENOS.mata) return CONFIG.velocidadeMata;
  if (t === TERRENOS.salina) return 0.95;
  return 1;
}

function andar(jogo, entrada, dt) {
  const j = jogo.jogador;
  let dx = entrada.x || 0;
  let dy = entrada.y || 0;
  const norma = Math.hypot(dx, dy);
  if (norma > 1) { dx /= norma; dy /= norma; }
  if (norma > 1e-4) j.ang = Math.atan2(dy, dx);

  const base = entrada.correr ? CONFIG.velocidadeCorrendo : CONFIG.velocidade;
  const vel = base * velocidadeNoChao(jogo.mundo, j.x, j.y);
  const passoX = dx * vel * dt;
  const passoY = dy * vel * dt;
  const antes = { x: j.x, y: j.y };
  if (livre(jogo.mundo, j.x + passoX, j.y)) j.x += passoX;
  if (livre(jogo.mundo, j.x, j.y + passoY)) j.y += passoY;
  j.andou += Math.hypot(j.x - antes.x, j.y - antes.y);
}

function livre(mundo, x, y) {
  const r = CONFIG.raioJogador;
  for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
    if (!andavel(mundo, Math.floor(x + ox), Math.floor(y + oy))) return false;
  }
  return true;
}

function gastarSede(jogo, entrada, dt) {
  const j = jogo.jogador;
  const movendo = Math.hypot(entrada.x || 0, entrada.y || 0) > 0.05;
  let taxa = 0.2;
  if (movendo) taxa += entrada.correr ? CONFIG.sedeCorrendo : CONFIG.sedeAndando;
  taxa += calorDaHora(jogo.hora) * CONFIG.sedeDeCalor;
  j.sede = Math.max(0, j.sede - taxa * dt);
  if (j.sede <= 0) {
    j.vida -= CONFIG.danoDeSede * dt;
    j.dor = Math.max(j.dor, 0.35);
  } else if (j.sede > j.sedeMaxima * 0.45 && j.vida < CONFIG.vidaMaxima) {
    j.vida = Math.min(CONFIG.vidaMaxima, j.vida + CONFIG.cura * dt);
  }
}

function beber(jogo) {
  const j = jogo.jogador;
  const agua = aguaMaisProxima(jogo.mundo, j.x, j.y);
  const perto = tile(jogo.mundo, Math.floor(j.x), Math.floor(j.y)) === TERRENOS.agua
    || (agua && Math.hypot(agua.x + 0.5 - j.x, agua.y + 0.5 - j.y) <= CONFIG.alcanceBebida);
  if (!perto) {
    jogo.eventos.push({ tipo: 'sem-agua' });
    return;
  }
  j.sede = j.sedeMaxima;
  jogo.bebeu++;
  jogo.eventos.push({ tipo: 'bebeu' });
}

// ------------------------------------------------------------------- loja
//
// As moedas so viravam placar: o HUD anunciava mil reis em destaque e nao
// havia o que comprar. Os precos saem da propria tabela de recompensas — a
// linha principal paga 156 mil reis e as missoes de lado outros 87.

export const LOJA = [
  { id: 'rapadura', nome: 'RAPADURA', preco: 8, texto: 'volta 35 de vida na hora' },
  { id: 'cantil', nome: 'CANTIL GRANDE', preco: 30, texto: 'mais 40 de água no cinto' },
  { id: 'facao', nome: 'FACÃO', preco: 45, texto: 'dano 20, alcance de braço e meio' },
  { id: 'rifle', nome: 'RIFLE', preco: 70, texto: 'dano 34, acerta a sete passos' },
];

export function vendedorPerto(jogo) {
  const j = jogo.jogador;
  let melhor = null;
  for (const vila of jogo.mundo.vilas) {
    for (const npc of vila.npcs) {
      if (npc.papel !== 'vendedor') continue;
      const d = Math.hypot(npc.x - j.x, npc.y - j.y);
      if (d > CONFIG.alcanceFala) continue;
      if (!melhor || d < melhor.d) melhor = { npc, d };
    }
  }
  return melhor ? melhor.npc : null;
}

function comprar(jogo, id) {
  const item = LOJA.find(i => i.id === id);
  if (!item) return { ok: false, motivo: 'nao-vende' };
  const vendedor = vendedorPerto(jogo);
  if (!vendedor) return { ok: false, motivo: 'sem-vendedor' };
  const j = jogo.jogador;
  if (ARMAS[id] && j.armas[id]) return { ok: false, motivo: 'ja-tem', item };
  if (id === 'cantil' && j.sedeMaxima >= 200) return { ok: false, motivo: 'ja-tem', item };
  if (id === 'rapadura' && j.vida >= CONFIG.vidaMaxima) return { ok: false, motivo: 'ja-tem', item };
  if (j.moedas < item.preco) return { ok: false, motivo: 'sem-dinheiro', item };

  j.moedas -= item.preco;
  if (ARMAS[id]) {
    j.armas[id] = true;
    j.arma = id;
  } else if (id === 'cantil') {
    j.sedeMaxima = Math.min(200, j.sedeMaxima + 40);
    j.sede = j.sedeMaxima;
  } else {
    j.vida = Math.min(CONFIG.vidaMaxima, j.vida + 35);
  }
  return { ok: true, item, vendedor };
}

// --------------------------------------------------------------- combate

// Arco curto: o golpe pega o bicho mais perto inteiro e, se houver um segundo
// na mesma direcao, metade nele. Com um alvo so por golpe, dois bichos em cima
// significavam apanhar dos dois enquanto se bate em um.
const ARCO_DO_GOLPE = Math.PI / 3;

function atacar(jogo) {
  const j = jogo.jogador;
  if (j.recarga > 0) return;
  const arma = ARMAS[j.arma] || ARMAS.maos;
  j.recarga = arma.cadencia;

  const naMira = [];
  for (const bicho of jogo.inimigos) {
    if (bicho.vida <= 0) continue;
    const d = Math.hypot(bicho.x - j.x, bicho.y - j.y);
    if (d > arma.alcance + 0.4) continue;
    naMira.push({ bicho, d });
  }
  naMira.sort((a, b) => a.d - b.d);
  // O evento diz se o golpe pegou alguma coisa: sem isso o golpe no vazio
  // saia com o mesmo som e a mesma resposta do golpe que acerta.
  jogo.eventos.push({ tipo: 'golpe', arma: j.arma, acertou: naMira.length > 0 });
  if (!naMira.length) return;

  const alvo = naMira[0].bicho;
  const direcao = Math.atan2(alvo.y - j.y, alvo.x - j.x);
  const atingidos = [{ bicho: alvo, dano: arma.dano }];
  for (const { bicho } of naMira.slice(1)) {
    const bruto = Math.atan2(bicho.y - j.y, bicho.x - j.x) - direcao;
    const desvio = Math.abs(Math.atan2(Math.sin(bruto), Math.cos(bruto)));
    if (desvio > ARCO_DO_GOLPE) continue;
    atingidos.push({ bicho, dano: arma.dano * 0.5 });
    break;
  }

  for (const { bicho, dano } of atingidos) {
    bicho.vida -= dano;
    bicho.irritado = true;
    bicho.piscar = 0.2;
    jogo.eventos.push({
      tipo: 'acerto', x: bicho.x, y: bicho.y, tipo_bicho: bicho.tipo, dano,
    });
    if (bicho.vida <= 0) {
      jogo.abatidos++;
      jogo.eventos.push({ tipo: 'abate', tipo_bicho: bicho.tipo, x: bicho.x, y: bicho.y });
      contarAbate(jogo, bicho.tipo);
    }
  }
}

function soltarInimigo(jogo, tipo, x, y) {
  const modelo = BICHOS[tipo];
  const bicho = {
    tipo, x, y, vida: modelo.vida, recarga: 0,
    irritado: false, ang: 0,
  };
  jogo.inimigos.push(bicho);
  return bicho;
}

// Bicho nasce onde a missao diz. Sem isso, "mate tres cangaceiros" depende de
// sorteio e a prova do robo nao teria como fechar.
function cuidarDosBichos(jogo, dt) {
  const j = jogo.jogador;
  jogo.relogioDeBicho -= dt;
  if (jogo.relogioDeBicho <= 0) {
    jogo.relogioDeBicho = 2.5;
    for (const missao of MISSOES) {
      if (missao.tipo !== 'matar') continue;
      const estado = jogo.missoes[missao.id];
      if (estado.estado !== 'aceita') continue;
      const d = Math.hypot(estado.alvo.x - j.x, estado.alvo.y - j.y);
      if (d > 34) continue;
      const vivos = jogo.inimigos.filter(b => b.tipo === missao.alvoTipo && b.vida > 0).length;
      if (vivos >= 2) continue;
      const ang = jogo.sorteio() * Math.PI * 2;
      const raio = 9 + jogo.sorteio() * 7;
      const x = j.x + Math.cos(ang) * raio;
      const y = j.y + Math.sin(ang) * raio;
      if (!livre(jogo.mundo, x, y)) continue;
      const bicho = soltarInimigo(jogo, missao.alvoTipo, x, y);
      bicho.irritado = true;
      jogo.eventos.push({ tipo: 'apareceu', tipo_bicho: bicho.tipo, x, y });
    }
  }

  // Vila e abrigo e quarenta passos e o fim da perseguicao — para quem desiste.
  // E o que faz correr ser fuga de verdade em vez de adiar a mordida.
  const emVila = jogo.mundo.vilas.some(v =>
    Math.hypot(v.x + 0.5 - j.x, v.y + 0.5 - j.y) < CONFIG.raioDeVila);

  for (const bicho of jogo.inimigos) {
    if (bicho.vida <= 0) continue;
    const modelo = BICHOS[bicho.tipo];
    bicho.recarga = Math.max(0, bicho.recarga - dt);
    bicho.piscar = Math.max(0, (bicho.piscar || 0) - dt);
    const dx = j.x - bicho.x;
    const dy = j.y - bicho.y;
    const d = Math.hypot(dx, dy) || 1;
    if (modelo.desiste && (d > CONFIG.desistencia || emVila)) {
      if (bicho.irritado) jogo.eventos.push({ tipo: 'desistiu', tipo_bicho: bicho.tipo });
      bicho.irritado = false;
      continue;
    }
    if (d < modelo.percepcao && !bicho.irritado) {
      bicho.irritado = true;
      jogo.eventos.push({
        tipo: 'percebeu', tipo_bicho: bicho.tipo, x: bicho.x, y: bicho.y,
      });
    }
    if (!bicho.irritado) continue;
    bicho.ang = Math.atan2(dy, dx);
    if (d <= modelo.alcance) {
      if (bicho.recarga <= 0) {
        bicho.recarga = modelo.cadencia;
        if (j.invulneravel <= 0) {
          j.vida -= modelo.dano;
          j.dor = 1;
          j.invulneravel = CONFIG.invulneravel;
          jogo.eventos.push({
            tipo: 'dano', dano: modelo.dano, de: bicho.tipo,
            angulo: Math.atan2(bicho.y - j.y, bicho.x - j.x),
          });
        }
      }
      continue;
    }
    const passo = modelo.velocidade * dt;
    const nx = bicho.x + (dx / d) * passo;
    const ny = bicho.y + (dy / d) * passo;
    if (andavel(jogo.mundo, Math.floor(nx), Math.floor(bicho.y))) bicho.x = nx;
    if (andavel(jogo.mundo, Math.floor(bicho.x), Math.floor(ny))) bicho.y = ny;
  }
  jogo.inimigos = jogo.inimigos.filter(b => b.vida > 0 || (b.morreuEm = (b.morreuEm || 0) + dt) < 8);
}

// -------------------------------------------------------- coleta e fala

function coletar(jogo) {
  const j = jogo.jogador;
  for (const r of jogo.mundo.recursos) {
    if (r.pego) continue;
    if (Math.hypot(r.x - j.x, r.y - j.y) > CONFIG.alcanceColeta) continue;
    r.pego = true;
    j.inventario[r.tipo] = (j.inventario[r.tipo] || 0) + 1;
    jogo.eventos.push({ tipo: 'pegou', item: r.tipo, quanto: j.inventario[r.tipo] });
    contarColeta(jogo, r.tipo);
  }
}

// Conversa com TODO mundo que estiver no alcance, do mais perto para o mais
// longe, e para no primeiro que tem assunto. Olhar so o vizinho mais proximo
// falhava em vila apertada: o robo ficou vinte segundos a um metro da
// curandeira, conversando com a rezadeira que estava meio metro mais perto.
function falar(jogo) {
  const j = jogo.jogador;
  const perto = [];
  for (const vila of jogo.mundo.vilas) {
    for (const npc of vila.npcs) {
      const d = Math.hypot(npc.x - j.x, npc.y - j.y);
      if (d <= CONFIG.alcanceFala) perto.push({ npc, d });
    }
  }
  if (!perto.length) return;
  perto.sort((a, b) => a.d - b.d);

  for (const { npc } of perto) {
    for (const missao of MISSOES) {
      const estado = jogo.missoes[missao.id];
      if (estado.estado === 'disponivel' && estado.dador === npc) {
        jogo.eventos.push({ tipo: 'fala', npc: npc.nome, papel: npc.papel });
        aceitar(jogo, missao.id);
        return;
      }
      if (estado.estado !== 'aceita') continue;
      if (missao.tipo === 'falar' && estado.alvo === npc) {
        jogo.eventos.push({ tipo: 'fala', npc: npc.nome, papel: npc.papel });
        concluir(jogo, missao.id);
        return;
      }
      if (missao.tipo === 'levar' && estado.dador === npc
        && (j.inventario[missao.item] || 0) >= missao.quantidade) {
        jogo.eventos.push({ tipo: 'fala', npc: npc.nome, papel: npc.papel });
        concluir(jogo, missao.id);
        return;
      }
    }
  }
  const npc = perto[0].npc;
  jogo.eventos.push({ tipo: 'fala', npc: npc.nome, papel: npc.papel, assunto: 'nenhum' });
}

function conferirLugares(jogo) {
  const j = jogo.jogador;
  for (const missao of MISSOES) {
    const estado = jogo.missoes[missao.id];
    if (estado.estado !== 'aceita') continue;
    if (missao.tipo !== 'visitar' && missao.tipo !== 'levar') continue;
    const d = Math.hypot(estado.alvo.x - j.x, estado.alvo.y - j.y);
    if (d > 2.6) continue;
    if (missao.tipo === 'levar'
      && (j.inventario[missao.item] || 0) < missao.quantidade) continue;
    concluir(jogo, missao.id);
  }
}

// --------------------------------------------------------------- missoes

function contarColeta(jogo, item) {
  for (const missao of MISSOES) {
    if (missao.tipo !== 'coletar' || missao.item !== item) continue;
    const estado = jogo.missoes[missao.id];
    if (estado.estado !== 'aceita') continue;
    estado.progresso = jogo.jogador.inventario[item] || 0;
    if (estado.progresso >= missao.quantidade) concluir(jogo, missao.id);
  }
}

function contarAbate(jogo, tipo) {
  for (const missao of MISSOES) {
    if (missao.tipo !== 'matar' || missao.alvoTipo !== tipo) continue;
    const estado = jogo.missoes[missao.id];
    if (estado.estado !== 'aceita') continue;
    estado.progresso++;
    if (estado.progresso >= missao.quantidade) concluir(jogo, missao.id);
  }
}

function aceitar(jogo, id) {
  const estado = jogo.missoes[id];
  if (!estado || estado.estado !== 'disponivel') return false;
  estado.estado = 'aceita';
  const missao = MISSOES.find(m => m.id === id);
  if (missao.tipo === 'coletar') {
    estado.progresso = jogo.jogador.inventario[missao.item] || 0;
    if (estado.progresso >= missao.quantidade) {
      concluir(jogo, id);
      return true;
    }
  }
  jogo.eventos.push({ tipo: 'missao-aceita', id, titulo: missao.titulo, texto: missao.texto });
  return true;
}

function concluir(jogo, id) {
  const estado = jogo.missoes[id];
  const missao = MISSOES.find(m => m.id === id);
  if (!estado || !missao || estado.estado === 'concluida') return false;
  estado.estado = 'concluida';
  const premio = missao.recompensa || {};
  if (premio.moedas) jogo.jogador.moedas += premio.moedas;
  if (premio.item) {
    if (ARMAS[premio.item]) {
      jogo.jogador.armas[premio.item] = true;
      jogo.jogador.arma = premio.item;
    } else if (premio.item === 'cantil') {
      jogo.jogador.sedeMaxima = Math.min(200, jogo.jogador.sedeMaxima + 50);
      jogo.jogador.sede = jogo.jogador.sedeMaxima;
    } else {
      jogo.jogador.inventario[premio.item] = (jogo.jogador.inventario[premio.item] || 0) + 1;
    }
  }
  jogo.eventos.push({
    tipo: 'missao-concluida', id, titulo: missao.titulo,
    moedas: premio.moedas || 0, item: premio.item || null,
  });
  abrirDisponiveis(jogo);
  return true;
}

function abrirDisponiveis(jogo) {
  for (const missao of MISSOES) {
    const estado = jogo.missoes[missao.id];
    if (estado.estado !== 'fechada') continue;
    if (missao.requer.every(r => jogo.missoes[r].estado === 'concluida')) {
      estado.estado = 'disponivel';
      jogo.eventos.push({ tipo: 'missao-aberta', id: missao.id, titulo: missao.titulo });
    }
  }
}

export { MISSOES, aguaMaisProxima };
