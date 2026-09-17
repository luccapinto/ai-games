// O robo que joga o SUBSOLO. E a prova principal do jogo.
//
// Ele nao tem nada de especial: le o mesmo estado que a tela mostra, manda os
// mesmos comandos que o teclado manda, e nao ve nada atraves de parede. Se ele
// chega na rodada dez, a rodada dez e jogavel; se ele morre na tres com pontos
// no bolso, o defeito esta na economia e nao nele.
//
// Tres taticas, e as tres sao as que um jogador humano usa no genero:
//
// 1. **Arrastar.** Anda para a celula da vizinhanca que fica mais LONGE da
//    horda, calculado por uma busca em largura a partir de todos os zumbis. E
//    isso que transforma o anel do mapa em ferramenta: quem arrasta pelo anel
//    nunca fica cercado.
// 2. **Mirar na cabeca.** Cabeca paga 100 pontos e mata mais rapido. A mira do
//    robo tem erro proporcional a distancia, senao ele viraria um jogador
//    perfeito e a prova nao diria nada sobre o jogo de gente.
// 3. **Comprar na ordem.** Arma de parede primeiro, porta depois, forca e perk
//    quando sobra. A ordem importa: comprar porta antes de arma abre janela
//    para a horda entrar sem ter com que atirar.

import { CONFIG } from './regras.js';
import {
  passo, armaNaMao, alvoDeUso, zumbisVivos, janelasAtivas,
} from './jogo.js';
import { solidoParaTiro, refazerFluxo, criarFluxo, tile, T, chave } from './mapa.js';
import { danoPorSegundo } from './armas.js';

const VIZINHOS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Campo de distancia da horda: quantas celulas de caminho ate o zumbi mais
// perto. O robo sobe esse gradiente quando esta apertado.
function campoDaHorda(jogo) {
  const m = jogo.mapa;
  const distancia = new Int32Array(m.largura * m.altura).fill(-1);
  const fila = [];
  for (const z of zumbisVivos(jogo)) {
    const cx = Math.floor(z.x);
    const cy = Math.floor(z.y);
    if (cx < 0 || cy < 0 || cx >= m.largura || cy >= m.altura) continue;
    const i = cy * m.largura + cx;
    if (distancia[i] === -1) { distancia[i] = 0; fila.push(i); }
  }
  let cabeca = 0;
  while (cabeca < fila.length) {
    const i = fila[cabeca++];
    const x = i % m.largura;
    const y = (i - x) / m.largura;
    for (const [dx, dy] of VIZINHOS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.largura || ny >= m.altura) continue;
      const j = ny * m.largura + nx;
      if (distancia[j] !== -1) continue;
      const t = tile(m, nx, ny);
      if (t >= T.ROCHA && t !== T.PORTA) continue;
      if (t === T.PORTA) {
        const porta = m.portas.get(chave(nx, ny));
        if (!porta || !porta.aberta) continue;
      }
      distancia[j] = distancia[i] + 1;
      fila.push(j);
    }
  }
  return distancia;
}

function distanciaNaCelula(m, campo, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= m.largura || cy >= m.altura) return -1;
  return campo[cy * m.largura + cx];
}

// Sorteio proprio do robo, semeado. Nao e capricho: a mira dele tinha erro por
// `Math.random`, entao duas execucoes da MESMA prova davam resultados
// diferentes — a prova da forja passou duas vezes e reprovou na terceira, em
// `main`. Prova instavel e pior que prova nenhuma, porque ela ensina a ignorar
// vermelho. Mesmo gerador que o piloto do jogo de kart usa.
function sortear(robo) {
  robo.semente = (robo.semente * 1103515245 + 12345) & 0x7FFFFFFF;
  return robo.semente / 0x7FFFFFFF;
}

export function criarRobo(opcoes = {}) {
  return {
    semente: (opcoes.semente | 0) || 20260917,
    // Erro de mira em radianos por metro de distancia: a 10 m, 0,012 rad/m da
    // 7 graus de erro, o que erra cabeca de vez em quando.
    erroDeMira: opcoes.erroDeMira ?? 0.012,
    // Distancia em que ele decide arrastar em vez de ficar parado atirando.
    // 3,2 saiu de varredura com seis partidas por valor, com a retirada durante
    // a recarga ja ligada: 2,2 -> rodada media 8,3; 3,2 -> 9,0; 4,2 -> 8,7;
    // 5,2 -> 8,3. Perto demais ele leva mordida, longe demais ele nao mata e a
    // rodada nunca fecha.
    apertoEm: opcoes.apertoEm ?? 3.2,
    compras: [],
    alvoDeCompra: null,
    relogioDeCompra: 0,
    ultimoDestino: null,
  };
}

// Prioridade de compra. Devolve o que o robo quer agora, com o custo.
function proximaCompra(jogo, robo) {
  const j = jogo.jogador;
  const naMao = armaNaMao(jogo);
  const aberta = (celula) => {
    const z = jogo.mapa.zonaDaCelula[celula.y * jogo.mapa.largura + celula.x];
    return z >= 0 && jogo.mapa.zonas[z].aberta;
  };
  const maquinasAbertas = jogo.mapa.maquinas.filter(q => aberta(q.celula));
  const portasAbertaveis = [...jogo.mapa.portas.values()].filter(porta => !porta.aberta
    && (porta.zonas || []).some(z => jogo.mapa.zonas[z].aberta));
  const comoAlvoDePorta = porta => ({
    maquina: {
      x: porta.x + 0.5, y: porta.y + 0.5, tipo: 'porta', celula: { x: porta.x, y: porta.y },
    },
    custo: porta.custo,
  });

  // A ordem e a tatica, e ela foi medida: a versao anterior varria as maquinas
  // primeiro e voltava na primeira que servisse, entao municao barata sempre
  // ganhava e o robo morria na rodada 5 com 7.820 pontos e o mapa fechado.
  // Aqui a lista e explicita, e porta vem antes de perk — espaco antes de
  // conforto.
  const naOrdem = [
    // 1. Forca: e de graca e liga tudo.
    () => maquinasAbertas.find(q => q.tipo === 'forca' && !jogo.forcaLigada),
    // 2. Municao quando esta acabando de verdade.
    // 45% e nao 20%: com 20% o robo so voltava para a parede quando a arma ja
    // estava seca, e chegava na rodada 5 de picareta na mao. Municao e o
    // recurso que o jogo cobra em pontos — economizar pontos e ficar sem arma.
    () => maquinasAbertas.find((q) => {
      if (q.tipo !== 'arma') return false;
      const arma = j.armas.find(x => x.chave.startsWith(q.arma));
      return arma && arma.naReserva < arma.reserva * 0.45;
    }),
    // 3. Arma melhor, enquanto a da mao nao da conta da rodada.
    () => (danoPorSegundo(naMao) < 400
      ? maquinasAbertas.find(q => q.tipo === 'arma'
        && !j.armas.some(a => a.chave.startsWith(q.arma)))
      : null),
    // 4. CALDO antes da porta: vida dobrada e o que decide se existe rodada 10.
    // Com o perk depois da porta, o robo gastava tudo em espaco e morria com
    // cem de vida na rodada 7 — medido em quatro partidas.
    () => (jogo.forcaLigada
      ? maquinasAbertas.find(q => q.tipo === 'perk' && q.perk === 'caldo'
        && !j.perks.has('caldo') && j.pontos > CONFIG.perks.caldo.custo)
      : null),
    // 5. TALISMA: e o perk mais barato e e uma vida extra. Comprar vida antes
    // de espaco foi medido melhor que o contrario.
    () => (jogo.forcaLigada
      ? maquinasAbertas.find(q => q.tipo === 'perk' && q.perk === 'talisma'
        && !j.perks.has('talisma') && j.pontos > CONFIG.perks.talisma.custo + 400)
      : null),
    // 6. Porta, e cedo.
    () => (portasAbertaveis.find(porta => j.pontos > porta.custo + 300)
      ? comoAlvoDePorta(portasAbertaveis.find(porta => j.pontos > porta.custo + 300))
      : null),
    // 7. Forja, quando ha folga.
    () => (jogo.forcaLigada && !naMao.forjada && naMao.tipo !== 'corpo'
      && j.pontos > CONFIG.custoDaForja + 1200
      ? maquinasAbertas.find(q => q.tipo === 'forja')
      : null),
    // 8. Os outros perks.
    () => (jogo.forcaLigada && j.perks.size < 4
      ? maquinasAbertas.find(q => q.tipo === 'perk' && !j.perks.has(q.perk)
        && j.pontos > CONFIG.perks[q.perk].custo + 600)
      : null),
  ];

  for (const tentar of naOrdem) {
    const achado = tentar();
    if (!achado) continue;
    return achado.maquina ? achado : { maquina: achado, custo: 0 };
  }
  return null;
}

// Exposta so para diagnostico: as provas nao dependem dela.
export function __proximaCompra(jogo, robo) { return proximaCompra(jogo, robo); }

// Destino de fuga, com horizonte. A versao anterior escolhia a CELULA VIZINHA
// mais longe da horda — subir o morro de olhos fechados. Num corredor sem saida
// a melhor vizinha e justamente a que entra no fundo dele, e foi assim que o
// robo morreu cercado com 10 a 14 zumbis vivos nas rodadas 6 a 9 em quatro
// partidas medidas.
//
// O mapa e um anel de proposito, e fugir e correr NO anel: para isso a escolha
// precisa ver alguns metros adiante. Busca em largura a partir do jogador ate
// `PASSOS_DE_FUGA` celulas; a nota de cada celula e a distancia dela ate a horda
// menos o preco de andar ate la. Celula colada em zumbi nao entra.
const PASSOS_DE_FUGA = 16;
const PRECO_DO_PASSO = 0.45;
// Peso da compra na escolha de para onde arrastar. Baixo de proposito: seguranca
// primeiro, e a compra so decide entre celulas parecidas.
const PESO_DA_ATRACAO = 0.22;

function andavel(m, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= m.largura || cy >= m.altura) return false;
  const t = tile(m, cx, cy);
  if (t === T.PORTA) {
    const porta = m.portas.get(chave(cx, cy));
    return !!porta && porta.aberta;
  }
  return t < T.ROCHA;
}

function destinoDeFuga(jogo, campo, atracao) {
  const m = jogo.mapa;
  const largura = m.largura;
  const inicio = Math.floor(jogo.jogador.y) * largura + Math.floor(jogo.jogador.x);
  const passos = new Int32Array(largura * m.altura).fill(-1);
  passos[inicio] = 0;
  const fila = [inicio];
  let melhorCelula = -1;
  let melhorNota = -Infinity;
  let cabeca = 0;
  while (cabeca < fila.length) {
    const i = fila[cabeca++];
    const x = i % largura;
    const y = (i - x) / largura;
    const daHorda = campo[i];
    if (daHorda >= 0) {
      // Atracao: quando existe algo para comprar, arrastar PARA O LADO da
      // maquina vale nota. E o que um jogador faz — ele nao para de fugir para
      // ir comprar, ele foge na direcao da compra. Sem isto o robo passava a
      // partida inteira querendo o talisma (4.420 quadros medidos) e nunca
      // chegava nele, porque da rodada 7 em diante nunca mais existe um momento
      // calmo para atravessar o mapa.
      let nota = daHorda - passos[i] * PRECO_DO_PASSO;
      if (atracao) {
        nota -= Math.hypot(x + 0.5 - atracao.x, y + 0.5 - atracao.y) * PESO_DA_ATRACAO;
      }
      if (nota > melhorNota) { melhorNota = nota; melhorCelula = i; }
    }
    if (passos[i] >= PASSOS_DE_FUGA) continue;
    for (const [dx, dy] of VIZINHOS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!andavel(m, nx, ny)) continue;
      const k = ny * largura + nx;
      if (passos[k] !== -1) continue;
      // Nao atravessa a horda para fugir dela: celula a menos de duas de um
      // zumbi esta dentro do alcance de mordida do proximo segundo.
      if (campo[k] >= 0 && campo[k] < 2) continue;
      passos[k] = passos[i] + 1;
      fila.push(k);
    }
  }
  if (melhorCelula < 0) return null;
  const x = melhorCelula % largura;
  return { x: x + 0.5, y: (melhorCelula - x) / largura + 0.5 };
}

// Um passo do robo: devolve os comandos que ele mandaria.
export function passoDoRobo(jogo, robo, dt) {
  const j = jogo.jogador;
  const vivos = zumbisVivos(jogo);
  const comandos = {
    frente: false, tras: false, esq: false, dir: false, correr: false,
    atirar: false, recarregar: false, usar: false, trocar: false, girar: 0, inclinar: 0,
  };

  // --- escolher alvo ---------------------------------------------------
  let alvo = null;
  let menor = Infinity;
  for (const z of vivos) {
    const d = Math.hypot(z.x - j.x, z.y - j.y);
    if (d > 26) continue;
    const meio = { x: (z.x + j.x) / 2, y: (z.y + j.y) / 2 };
    if (d > 2 && solidoParaTiro(jogo.mapa, meio.x, meio.y)) continue;
    if (d < menor) { menor = d; alvo = z; }
  }

  const arma = armaNaMao(jogo);
  if (alvo) {
    const desejado = Math.atan2(alvo.y - j.y, alvo.x - j.x);
    let erro = desejado - j.ang;
    while (erro > Math.PI) erro -= Math.PI * 2;
    while (erro < -Math.PI) erro += Math.PI * 2;
    // Gira no maximo 6 rad/s: robo com giro instantaneo mediria um jogo que
    // ninguem joga.
    comandos.girar = Math.max(-6 * dt, Math.min(6 * dt, erro));
    // Mira na cabeca: a inclinacao que poe a bala na faixa alta do corpo.
    const alturaDaCabeca = alvo.altura * 0.85;
    const alvoInclinacao = (alturaDaCabeca - CONFIG.alturaDoOlho) / Math.max(1, menor);
    comandos.inclinar = (alvoInclinacao - j.inclinacao) * Math.min(1, dt * 9)
      + (sortear(robo) - 0.5) * robo.erroDeMira * menor * dt;
    const mirado = Math.abs(erro) < 0.09 + robo.erroDeMira * menor;
    const noAlcance = menor <= arma.alcance * 0.95;
    if (mirado && noAlcance && arma.recarregando <= 0) comandos.atirar = true;
  }

  // --- recarregar quando da -------------------------------------------
  if (arma.tipo !== 'corpo') {
    const apertado = menor < 6;
    if (arma.noPente <= 0) comandos.recarregar = true;
    else if (!apertado && arma.noPente < arma.pente * 0.35) comandos.recarregar = true;
    if (arma.noPente <= 0 && arma.naReserva <= 0) {
      // Sem municao: troca para a outra arma se ela tiver bala. A picareta e o
      // ultimo recurso, nao o primeiro — trocar para ela com a pistola cheia no
      // outro slot era como o robo morria na rodada 5.
      const outra = j.armas[(j.naMao + 1) % j.armas.length];
      if (outra && (outra.tipo === 'corpo' || outra.noPente > 0 || outra.naReserva > 0)) {
        comandos.trocar = true;
      }
    }
  }

  // --- arrastar ou repor tabua ----------------------------------------
  // Cercado = zumbi perto em mais de um rumo. A versao anterior fugia sempre
  // que oito zumbis estavam vivos, o que na rodada 5 e sempre: ela nunca
  // atirava, a rodada nao fechava, e o robo acabava encurralado de qualquer
  // jeito. Fugir e resposta a cerco, nao a contagem.
  let cercado = 0;
  for (const z of vivos) {
    const d = Math.hypot(z.x - j.x, z.y - j.y);
    if (d > 6) continue;
    const rumo = Math.atan2(z.y - j.y, z.x - j.x);
    cercado += Math.abs(Math.atan2(Math.sin(rumo - j.ang), Math.cos(rumo - j.ang))) > 1.2 ? 2 : 1;
  }
  // Recarregando com a horda perto, nao existe motivo para ficar: o robo foi
  // derrubado RECARREGANDO com quatro zumbis colados na rodada 9, e recarregar
  // andando e o que qualquer jogador faz. Enquanto a arma esta fora de combate,
  // o limite de aperto dobra.
  const recarregandoAgora = arma.recarregando > 0;
  const limiteDeAperto = recarregandoAgora ? robo.apertoEm * 2 : robo.apertoEm;
  const apertado = menor < limiteDeAperto || cercado >= 5;
  if (apertado && vivos.length) {
    const campo = campoDaHorda(jogo);
    const compra = proximaCompra(jogo, robo);
    // Comprar no meio da rodada, se a maquina esta ao alcance e a horda nao esta
    // colada. Antes a compra acontecia so no ramo calmo, e a partir da rodada 7
    // o ramo calmo nunca mais roda: o robo morria com pontos no bolso e sem
    // perk, o que era exatamente o defeito que ele existe para achar.
    if (compra && menor > 2.5) {
      const daMaquina = Math.hypot(compra.maquina.x - j.x, compra.maquina.y - j.y);
      if (daMaquina < CONFIG.alcanceDeUso * 0.8) {
        robo.relogioDeCompra -= dt;
        if (robo.relogioDeCompra <= 0) {
          comandos.usar = true;
          robo.relogioDeCompra = 0.5;
        }
      }
    }
    const melhor = destinoDeFuga(jogo, campo, compra ? compra.maquina : null);
    if (melhor) {
      // Duas fugas diferentes, e a diferenca e a que um jogador faz sem pensar:
      //
      // - com zumbi colado (menos de `COLADO` metros) nao da para andar de
      //   costas atirando: de re o jogador faz 3,4 m/s e o zumbi da rodada 15
      //   faz 3,6. Ele VIRA o corpo e corre, abre a distancia, e so depois
      //   volta a atirar. Sem isto o robo morria de costas com dez zumbis
      //   vivos, e as rodadas acima da 10 nunca foram medidas por ninguem.
      // - com a horda a alguns metros, anda de lado atirando, que e o que
      //   mantem a rodada fechando.
      // Anda de lado atirando, e nao de costas em silencio: virar o corpo para
      // correr foi medido e e PIOR (media de rodada 6,7 contra 8,2 em seis
      // partidas), porque quem para de matar nunca fecha a rodada e a horda so
      // cresce. Fuga aqui e reposicionamento com o dedo no gatilho.
      andarPara(jogo, comandos, melhor, true);
      if (alvo && menor < arma.alcance * 0.85 && arma.recarregando <= 0) {
        comandos.atirar = true;
      }
    }
  } else {
    // Sem aperto: comprar, repor tabua, ou ficar de frente para a janela ativa.
    const compra = proximaCompra(jogo, robo);
    const perto = alvoDeUso(jogo);
    if (perto && perto.tipo === 'janela') {
      comandos.usar = true;
    } else if (compra) {
      const chegou = Math.hypot(compra.maquina.x - j.x, compra.maquina.y - j.y) < CONFIG.alcanceDeUso * 0.8;
      if (chegou) {
        olharPara(jogo, comandos, compra.maquina);
        // Aperta uma vez a cada meio segundo: o jogo trava o uso, e apertar em
        // todo quadro so enche o registro de evento negado.
        robo.relogioDeCompra -= 1 / 60;
        if (robo.relogioDeCompra <= 0) {
          comandos.usar = true;
          robo.relogioDeCompra = 0.5;
        }
      } else {
        andarPara(jogo, comandos, compra.maquina, false);
      }
    } else if (!vivos.length) {
      const janela = janelasAtivas(jogo)
        .map(w => ({ w, d: Math.hypot(w.dentro.x + 0.5 - j.x, w.dentro.y + 0.5 - j.y) }))
        .filter(x => x.w.tabuas < CONFIG.tabuasPorJanela)
        .sort((a, b) => a.d - b.d)[0];
      if (janela) andarPara(jogo, comandos, { x: janela.w.dentro.x + 0.5, y: janela.w.dentro.y + 0.5 }, false);
    }
  }

  return comandos;
}

// Anda na direcao do destino usando o campo de fluxo do proprio mapa quando o
// destino esta longe: em corredor, andar reto bate na parede.
function andarPara(jogo, comandos, destino, fugindo) {
  const j = jogo.jogador;
  let dx = destino.x - j.x;
  let dy = destino.y - j.y;
  const d = Math.hypot(dx, dy);
  if (d > 2.5) {
    const fluxo = refazerFluxo(jogo.mapa, jogo.roboFluxo || (jogo.roboFluxo = criarFluxo(jogo.mapa)), destino);
    const cx = Math.floor(j.x);
    const cy = Math.floor(j.y);
    const i = cy * jogo.mapa.largura + cx;
    const prox = fluxo.proximo[i];
    if (prox >= 0) {
      const px = prox % jogo.mapa.largura;
      const py = (prox - px) / jogo.mapa.largura;
      dx = px + 0.5 - j.x;
      dy = py + 0.5 - j.y;
    }
  }
  const ang = Math.atan2(dy, dx);
  let erro = ang - j.ang;
  while (erro > Math.PI) erro -= Math.PI * 2;
  while (erro < -Math.PI) erro += Math.PI * 2;
  // Fugindo, ele NAO gira o corpo para o destino: anda de lado e de re para
  // continuar de frente para a horda. E o que um jogador faz.
  if (fugindo) {
    const cos = Math.cos(erro);
    const sen = Math.sin(erro);
    comandos.frente = cos > 0.35;
    comandos.tras = cos < -0.35;
    // Erro angular positivo e sentido anti-horario, que e a ESQUERDA da tela.
    // Este sinal acompanha o conserto de mao em `jogo.js`.
    comandos.esq = sen > 0.35;
    comandos.dir = sen < -0.35;
    comandos.correr = cos > 0.6;
  } else {
    comandos.girar = Math.max(-6 * (1 / 60), Math.min(6 * (1 / 60), erro));
    comandos.frente = Math.abs(erro) < 0.8;
    comandos.correr = Math.abs(erro) < 0.3;
  }
}

function olharPara(jogo, comandos, destino) {
  const j = jogo.jogador;
  const ang = Math.atan2(destino.y - j.y, destino.x - j.x);
  let erro = ang - j.ang;
  while (erro > Math.PI) erro -= Math.PI * 2;
  while (erro < -Math.PI) erro += Math.PI * 2;
  comandos.girar = Math.max(-0.2, Math.min(0.2, erro));
}

// Roda o robo por N rodadas (ou ate morrer) e devolve o relatorio. E esta
// funcao que as provas chamam.
export function jogarAte(indiceMapa, rodadaAlvo, opcoes = {}) {
  const criar = opcoes.criarJogo;
  const jogo = criar(indiceMapa, { semente: opcoes.semente || 11, semPreparo: true });
  const robo = criarRobo(opcoes);
  const DT = 1 / 60;
  const limite = Math.round((opcoes.limiteDeSegundos || 60 * 22) / DT);
  const porRodada = [];
  let rodadaAnterior = jogo.rodada;
  let quadros = 0;
  let mordidas = 0;

  while (quadros < limite && jogo.estado !== 'morto' && jogo.rodada <= rodadaAlvo) {
    const comandos = passoDoRobo(jogo, robo, DT);
    for (const evento of passo(jogo, comandos, DT)) {
      if (evento.tipo === 'dano') mordidas++;
    }
    if (jogo.rodada !== rodadaAnterior) {
      porRodada.push({
        rodada: rodadaAnterior,
        pontos: jogo.jogador.pontos,
        vida: Math.round(jogo.jogador.vida),
        arma: armaNaMao(jogo).nome,
        perks: [...jogo.jogador.perks],
        segundos: Math.round(jogo.tempo),
      });
      rodadaAnterior = jogo.rodada;
    }
    quadros++;
  }

  return {
    mapa: jogo.mapa.nome,
    chegouNaRodada: jogo.rodada,
    morreu: jogo.estado === 'morto',
    segundos: jogo.tempo,
    mordidas,
    porRodada,
    estatisticas: { ...jogo.estatisticas },
    forcaLigada: jogo.forcaLigada,
    perks: [...jogo.jogador.perks],
    arma: armaNaMao(jogo).nome,
  };
}
