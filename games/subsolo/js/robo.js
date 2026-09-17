// O robo que joga o jogo — a prova principal do SUBSOLO.
//
// Ele nao tem nada de especial: usa `criarJogo`/`passo`, a mesma fisica, as
// mesmas armas e os mesmos bichos do navegador. O que ele tem e o mapa na mao:
// pede caminho para `mapa.caminho`, decide alvo pelo mesmo fechamento de cracha
// que `mapa.completavel` usa, e atira no que aparece na linha de visao.
//
// Se as nove fases nao terminam para ele, nao terminam para ninguem — e se
// terminam num tempo absurdo, a fase esta desenhada errada. provas.mjs cobra as
// duas coisas.

import { FASES } from './fases.js';
import * as M from './mapa.js';
import { ARMAS, linhaLivre } from './armas.js';
import { TIPOS } from './inimigos.js';
import { criarJogo, passo, entradaNula, herdar, DT, CONFIG } from './jogo.js';

const LIMITE_SEGUNDOS = 400;

export function robo(opcoes = {}) {
  let herdado = null;
  const fases = [];
  let vidaFinal = CONFIG.vidaMax;
  const de = opcoes.de ?? 0;
  const ate = opcoes.ate ?? FASES.length - 1;

  for (let i = de; i <= ate; i++) {
    const linha = jogarFase(i, herdado, opcoes);
    fases.push(linha);
    vidaFinal = linha.vida;
    if (!linha.venceu) break;
    herdado = linha.herdado;
  }
  return { fases, vidaFinal };
}

export function jogarFase(indice, herdado, opcoes = {}) {
  const jogo = criarJogo(indice, { herdado, semente: opcoes.semente || 777 });
  const limite = Math.round((opcoes.limite || LIMITE_SEGUNDOS) / DT);
  let paradoEm = { x: jogo.jogador.x, y: jogo.jogador.y, t: 0 };
  let caminho = null;
  let alvoCelula = null;
  let cutucao = 0;
  let recuoRestante = 1.6;
  // Quem tirou quanto de vida. So o relatorio usa isto, mas sem ele "o robo
  // morreu" e uma informacao que nao diz onde mexer.
  const dano = {};

  for (let quadro = 0; quadro < limite && jogo.estado === 'jogando'; quadro++) {
    const j = jogo.jogador;
    const entrada = entradaNula();

    // --- para onde ir ---------------------------------------------------
    const destino = escolherDestino(jogo);
    const celula = destino ? `${Math.floor(destino.x)},${Math.floor(destino.y)}` : null;
    if (!caminho || celula !== alvoCelula || quadro % 45 === 0) {
      alvoCelula = celula;
      caminho = destino ? M.caminho(jogo.mapa, j, destino, { crachas: j.crachas }) : null;
    }

    // Gancho de observacao: e por aqui que se descobre que o robo nao morreu,
    // so ficou indo e voltando entre dois objetivos.
    if (opcoes.espiar && quadro % 30 === 0) opcoes.espiar(jogo, destino);

    // --- em quem atirar -------------------------------------------------
    // Atira no que esta no caminho; passa correndo pelo que nao esta. Sem esta
    // distincao o robo limpava a fase inteira e chegava no elevador sem vida —
    // o cego, que e lento e surdo a luz, so precisa ser contornado.
    const proximo = proximoNo(caminho, j);
    const chefe = jogo.inimigos.find(e => TIPOS[e.tipo].chefe && e.vida > 0);
    const dChefe = chefe ? Math.hypot(chefe.x - j.x, chefe.y - j.y) : Infinity;

    // O capataz tem prioridade enquanto estiver a vista e nada mais estiver
    // colado: e ele que libera o elevador, e a janela sem blindagem e curta.
    // Mas prioridade cega custou uma corrida inteira — o robo dancava com o
    // chefe levando 185 de dano de larva, cego e cuspe pelas costas.
    const perto = ameacaMaisProxima(jogo);
    const duelo = chefe && dChefe < 10 && (!perto || perto.distancia > 4)
      && linhaLivre(jogo.mapa, j, chefe);
    const ameaca = duelo ? { inimigo: chefe, distancia: dChefe } : perto;
    let mira = null;
    if (ameaca) {
      const noCaminho = proximo && produtoEscalar(j, ameaca.inimigo, proximo) > 0.78;
      // Sem "so o que esta perto ou no caminho", o robo parava para brigar com
      // todo bicho que acordou — inclusive o cego, que anda a 2,0 contra os 4,3
      // de quem corre. Bastava seguir andando.
      const atacar = ameaca.inimigo === chefe || ameaca.distancia < 3.6
        || (noCaminho && ameaca.distancia < 9);
      if (atacar) {
        const arma = melhorArma(jogo, ameaca.distancia);
        if (arma !== j.arma) entrada.trocar = ARMAS[arma].chave;
        mira = { x: ameaca.inimigo.x, y: ameaca.inimigo.y };
        if (ameaca.distancia <= ARMAS[arma].alcance) {
          const erro = Math.abs(diferencaAngular(j.ang, anguloAte(j, mira)));
          // A tolerancia acompanha o espalhamento da arma: exigir 0,06 rad da
          // espingarda, que espalha 0,12, e exigir pontaria que a arma nao tem
          // — e o robo deixava de atirar enquanto andava de lado.
          const tolerancia = ARMAS[arma].tipo === 'corpo' ? 0.35
            : Math.max(0.05, ARMAS[arma].espalhamento * 0.8);
          if (erro < tolerancia) entrada.atirar = true;
        }
      }
    }

    // --- volante --------------------------------------------------------
    // Mirar sempre no no seguinte ao no mais proximo: seguir "o primeiro no
    // longe o bastante" faz o robo voltar para um no que ele acabou de passar,
    // e ele gasta a fase inteira balancando no mesmo corredor.
    const paraOnde = mira && ameaca.distancia < 8 ? mira : (proximo || mira);

    // Recuar e um lance, nao um estado: tres bichos cacando a menos de cinco
    // celulas, ou um so com a vida baixa. Sem o limite de 1,6 s o robo de vida
    // baixa recuava para sempre e estourava o tempo da fase.
    const cercado = jogo.inimigos.filter(e => e.vida > 0 && e.estado === 'cacando'
      && Math.hypot(e.x - j.x, e.y - j.y) < 5).length;
    const querRecuar = cercado >= 3 || (j.vida < CONFIG.vidaMax * 0.42 && cercado >= 1);
    if (querRecuar && recuoRestante > 0) recuoRestante -= DT;
    else if (!querRecuar) recuoRestante = Math.min(1.6, recuoRestante + DT * 0.6);
    const recuar = ameaca && querRecuar && recuoRestante > 0;

    if (paraOnde) {
      const erro = diferencaAngular(j.ang, anguloAte(j, paraOnde));
      entrada.girar = Math.max(-0.14, Math.min(0.14, erro * 0.4));
      if (recuar) {
        entrada.frente = -0.9;
        entrada.lado = ameaca.distancia < 2.2 ? 0.7 : 0;
      } else if (proximo) {
        const alinhado = Math.abs(diferencaAngular(j.ang, anguloAte(j, proximo)));
        entrada.frente = alinhado < 0.9 ? 1 : 0.35;
        // Corre quando nao ha nada perto: menos exposicao, mais ruido. E a
        // mesma troca que o jogador faz.
        entrada.correndo = !ameaca || ameaca.distancia > 6;
      }
    }

    // Andar para tras atirando. Bicho de corpo-a-corpo perde a briga contra
    // quem recua: o alcance dele e 1,2 e o da pineira e 26. Sem isto o robo
    // ficava parado no meio de dois cegos, que batem 16 a cada 1,8 s.
    if (ameaca && !TIPOS[ameaca.inimigo.tipo].projetil && !TIPOS[ameaca.inimigo.tipo].chefe
      && ameaca.distancia < 2.8 && temTiro(j)) {
      entrada.frente = -0.7;
      entrada.lado = 0.35;
    }

    // Desviar do cuspe: escorregar de lado enquanto o projetil voa. Se isto
    // nao funcionasse, o cuspidor seria dano garantido e nao uma ameaca que se
    // le na tela.
    const cuspeProximo = jogo.projeteis.find(p => Math.hypot(p.x - j.x, p.y - j.y) < 5.5);
    if (cuspeProximo) {
      entrada.lado = diferencaAngular(j.ang, anguloAte(j, cuspeProximo)) > 0 ? -1 : 1;
      entrada.frente = Math.min(entrada.frente, 0.3);
      entrada.correndo = true;
    }

    // A danca do capataz. Duas regras, as mesmas que um jogador descobre em
    // duas mortes: nao encostar nele, porque de perto o golpe comum acerta
    // sempre, e sair da linha quando ele armar — a investida cobre quatro
    // celulas em meio segundo e recuo nenhum escapa dela.
    //
    // Fora da janela de golpe o desvio do cuspe tem preferencia: projetil no ar
    // e a ameaca mais certa das duas.
    if (chefe && dChefe < 8 && (chefe.fase === 'arma' || !cuspeProximo)) {
      entrada.correndo = true;
      const fuga = diferencaAngular(j.ang, anguloAte(j, chefe)) > 0 ? -1 : 1;
      if (chefe.fase === 'arma') {
        entrada.lado = fuga;
        entrada.frente = 0;
      } else {
        // Ficar na faixa de 4,5 a 6 celulas, que e onde ele se arma: longe
        // demais ele nunca abre a blindagem, e o duelo virava um cerco de cinco
        // minutos raspando 35% do dano. Sem municao de longe, a unica saida e o
        // contrario: colar entre um golpe e outro e bater de picareta.
        const semMunicao = !temTiro(j);
        entrada.lado = fuga * 0.7;
        entrada.frente = semMunicao
          ? (dChefe > 1.2 ? 0.9 : 0)
          : (dChefe < 4.5 ? -0.9 : (dChefe > 6 ? 0.6 : 0.1));
      }
    }

    // --- destravar ------------------------------------------------------
    if (cutucao > 0) {
      cutucao -= DT;
      entrada.girar = 0.09;
      entrada.frente = 0.8;
      entrada.lado = 0.6;
    }
    paradoEm.t += DT;
    if (paradoEm.t > 1.5) {
      if (Math.hypot(j.x - paradoEm.x, j.y - paradoEm.y) < 0.5) {
        cutucao = 0.5;
        caminho = null;
        entrada.usar = true;
      }
      paradoEm = { x: j.x, y: j.y, t: 0 };
    }

    for (const evento of passo(jogo, entrada, DT)) {
      if (evento.tipo !== 'dano') continue;
      const quem = evento.origem && evento.origem.tipo ? evento.origem.tipo : 'cuspe (projetil)';
      dano[quem] = (dano[quem] || 0) + evento.dano;
    }
  }

  const venceu = jogo.estado === 'saiu';
  return {
    nome: jogo.nome,
    venceu,
    motivo: venceu ? 'saiu'
      : jogo.estado === 'morto' ? `morreu em ${jogo.tempo.toFixed(1)} s`
        : `estourou o limite de ${(limite * DT).toFixed(0)} s`,
    segundos: jogo.tempo,
    vida: Math.max(0, jogo.jogador.vida),
    abatidos: jogo.abatidos,
    de: jogo.inimigos.length,
    dano,
    herdado: herdar(jogo),
  };
}

// O destino segue o mesmo fechamento de `mapa.completavel`: cracha alcancavel
// primeiro, elevador quando ele estiver alcancavel — e capataz antes do
// elevador, na fase em que o elevador so libera com ele no chao.
function escolherDestino(jogo) {
  const j = jogo.jogador;
  const mapa = jogo.mapa;

  // Um item que o jogo recusa entregar — kit com a vida cheia, cartucho com a
  // bolsa cheia — fica no chao, e isso esta certo. O que estava errado era o
  // robo escolher esse item de destino: ele chegava, nao pegava, o destino nao
  // mudava, e a fase estourava o tempo com o robo de pe em cima do cartucho.
  const querPegar = (i) => {
    if (i.tipo === 'kit') return j.vida < CONFIG.vidaMax;
    if (i.tipo === 'pinos' || i.tipo === 'cartuchos') {
      return j.municao[i.tipo] < CONFIG.municaoMax[i.tipo];
    }
    return true;
  };

  if (j.vida < CONFIG.vidaMax * 0.7) {
    const kit = itemMaisProximo(jogo, i => i.tipo === 'kit' && querPegar(i),
      j.vida < 35 ? Infinity : 20);
    if (kit) return kit;
  }
  if (j.municao.pinos < 12) {
    const municao = itemMaisProximo(jogo,
      i => (i.tipo === 'pinos' || i.tipo === 'cartuchos') && querPegar(i), 16);
    if (municao) return municao;
  }

  if (mapa.exigeCapataz) {
    const chefe = jogo.inimigos.find(e => TIPOS[e.tipo].chefe && e.vida > 0);
    if (chefe) return { x: chefe.x, y: chefe.y };
  }

  const alcance = M.distancias(mapa, j, j.crachas);
  if (mapa.elevador && alcance.has(M.chave(mapa.elevador.x, mapa.elevador.y))) {
    return { x: mapa.elevador.x + 0.5, y: mapa.elevador.y + 0.5 };
  }
  const cracha = itemMaisProximo(jogo, i => i.cracha && !j.crachas.has(i.cracha), Infinity, alcance);
  return cracha || (mapa.elevador
    ? { x: mapa.elevador.x + 0.5, y: mapa.elevador.y + 0.5 }
    : null);
}

function itemMaisProximo(jogo, filtro, maximo, alcance = null) {
  const j = jogo.jogador;
  const d = alcance || M.distancias(jogo.mapa, j, j.crachas);
  let melhor = null;
  for (const item of jogo.itens) {
    if (item.pego || !filtro(item)) continue;
    const dist = d.get(M.chave(Math.floor(item.x), Math.floor(item.y)));
    if (dist === undefined || dist > maximo) continue;
    if (!melhor || dist < melhor.dist) melhor = { dist, x: item.x, y: item.y };
  }
  return melhor;
}

function ameacaMaisProxima(jogo) {
  const j = jogo.jogador;
  let melhor = null;
  for (const e of jogo.inimigos) {
    // O chefe sai desta conta: ele tem tratamento proprio, e deixa-lo entrar
    // aqui fazia o robo trata-lo como bicho comum e colar nele.
    if (e.vida <= 0 || TIPOS[e.tipo].chefe) continue;
    const distancia = Math.hypot(e.x - j.x, e.y - j.y);
    // Bicho longe e dormindo nao e ameaca: atirar nele so gasta municao,
    // acorda a vizinhanca e faz o robo limpar a fase em vez de atravessar.
    if (distancia > (e.estado === 'cacando' ? 13 : 7)) continue;
    if (!melhor || distancia < melhor.distancia) {
      if (!linhaLivre(jogo.mapa, j, e)) continue;
      melhor = { inimigo: e, distancia };
    }
  }
  return melhor;
}

// Municao que este jogador consegue disparar agora. Cartucho sem espingarda
// nao conta — foi o que travou o duelo do capataz por 400 s: o robo tinha 32
// cartuchos, nenhuma arma que os usasse, e por isso "tinha municao".
function temTiro(j) {
  return j.municao.pinos >= 1
    || (j.armas.espingarda && j.municao.cartuchos >= 1)
    || (j.armas.macarico && j.municao.gas > 4);
}

function melhorArma(jogo, distancia) {
  const j = jogo.jogador;
  const temCartucho = j.armas.espingarda && j.municao.cartuchos > 0;
  if (temCartucho && (distancia < 6.5 || j.municao.pinos < 1)
    && distancia < ARMAS.espingarda.alcance) return 'espingarda';
  if (j.municao.pinos >= 1 && distancia < ARMAS.pineira.alcance) return 'pineira';
  if (j.armas.macarico && j.municao.gas > 4 && distancia < 3) return 'macarico';
  return 'picareta';
}

function proximoNo(caminho, j) {
  if (!caminho || !caminho.length) return null;
  let indice = 0;
  let menor = Infinity;
  for (const [i, no] of caminho.entries()) {
    const d = Math.hypot(no.x + 0.5 - j.x, no.y + 0.5 - j.y);
    if (d < menor) { menor = d; indice = i; }
  }
  const alvo = caminho[Math.min(indice + 1, caminho.length - 1)];
  return { x: alvo.x + 0.5, y: alvo.y + 0.5 };
}

// Quanto dois rumos concordam: 1 e "na mesma direcao", 0 e "de lado". Serve
// para decidir se o bicho esta no caminho ou so por perto.
function produtoEscalar(de, a, b) {
  const ax = a.x - de.x;
  const ay = a.y - de.y;
  const bx = b.x - de.x;
  const by = b.y - de.y;
  const na = Math.hypot(ax, ay) || 1;
  const nb = Math.hypot(bx, by) || 1;
  return (ax / na) * (bx / nb) + (ay / na) * (by / nb);
}

const anguloAte = (de, para) => Math.atan2(para.y - de.y, para.x - de.x);

function diferencaAngular(de, para) {
  let d = para - de;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
