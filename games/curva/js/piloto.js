// O piloto de IA. Ele nao anda em trilho: le a mesma linha de corrida e o mesmo
// perfil de velocidade que provas.mjs usa como referencia, e dirige o kart com
// os mesmos comandos que o teclado manda — volante, acelerador, freio, drift e
// item.
//
// Quatro coisas fazem esta IA funcionar, e as quatro foram consertos medidos:
//
// 1. O volante do kart pede velocidade de giro, nao angulo de roda. Enquanto
//    esta IA calculava angulo e dividia pelo esterco, ela passava 19% da volta
//    na grama da SERRA. Agora ela pede giro: curvatura vezes velocidade.
// 2. Pre-alimentacao pela curvatura. Controle proporcional puro tem erro
//    permanente em curva de raio constante: ele so pede volante quando o kart
//    JA esta apontando errado.
// 3. Elipse de atrito no pe direito. Pneu que faz curva nao tem sobra para
//    tracionar; sem essa conta a IA pisava fundo dentro da curva e saia larga.
// 4. Decidir o drift ANTES do volante. O gatilho levanta o teto de giro em 55%,
//    entao o mesmo pedido de giro vira volante menor de lado — decidir depois
//    fazia a IA pedir giro demais no quadro em que ela entrava de lado.

import { KART, normalizar } from './fisica.js';
import { maisProximo, paraMundo } from './pista.js';

// Ordem importa: provas.mjs cobra que o tempo de volta cresca desta ordem para
// baixo. Perfil mais fraco nao pode ser mais rapido que perfil mais forte.
// `habilidade` e a fracao do perfil de velocidade da linha que o piloto
// persegue, e o teto do ouro saiu de medida, nao de gosto: em 0,98 e em 0,96 ele
// entrava tao no limite dos grampos que perdia para o prata em uma das seis
// pistas — o perfil mais forte ficando mais lento, o que quebra a promessa do
// campeonato. Em 0,93 o ouro e o mais rapido nas seis, com a soma crescendo do
// ouro ao ferro, medido na media de tres sementes por pista.
// A escala de habilidade foi REAFINADA depois do servo de guinada: com a escala
// antiga (0,93 0,89 0,84 0,77) o ouro deixou de ser o mais rapido na SERRA —
// chassi mais responsivo muda o que cada nivel consegue extrair. Medida do
// afinador: com 0,97 0,90 0,83 0,75, a ordem ouro > prata > bronze > ferro sai
// certa nas SEIS pistas, e nao em cinco.
export const PERFIS = {
  ouro: { habilidade: 0.97, agressao: 0.9, antecipacao: 1.0, erro: 0.0, drift: 1 },
  prata: { habilidade: 0.90, agressao: 0.75, antecipacao: 0.95, erro: 0.04, drift: 0.85 },
  bronze: { habilidade: 0.83, agressao: 0.6, antecipacao: 0.9, erro: 0.08, drift: 0.6 },
  ferro: { habilidade: 0.75, agressao: 0.45, antecipacao: 0.85, erro: 0.13, drift: 0.3 },
};

// Os ganhos da IA, num lugar so e com nome. Nenhum destes numeros foi escolhido
// a olho: eles saem do afinador, que roda uma volta lancada nas seis pistas e
// cobra tempo de volta, tempo fora do asfalto e se o drift paga. Mexer aqui sem
// rodar `provas.mjs` e chute.
export const AJUSTES = {
  // Para onde olhar: base em metros mais tanto por metro por segundo. Em
  // grampo de 10 m, olhar longe demais corta o apice e joga na grama.
  olhadaBase: 2,
  olhadaPorVelocidade: 0.3,
  // Correcao de rumo, em rad/s por radiano de erro.
  ganhoDeRumo: 3,
  // Quanto da deriva atual entra como desconto no giro pedido.
  descontoDeDeriva: 0.5,
  // O quanto a curvatura precisa cair, em multiplos de `KART.curvaturaDeDrift`,
  // para a IA soltar o gatilho e cobrar o mini-turbo.
  folgaDeSaida: 0.8,
  // Piso de acelerador quando o gatilho de drift esta segurado: derrapar e com o
  // pe dentro, e nao economizando pneu.
  pisoDoDrift: 0.85,
  // Cautela: o quanto a IA desconta do alvo depois de escapar, quao rapido esse
  // desconto sobe e quao rapido ele volta a zero.
  cautelaMaxima: 0.22,
  cautelaSubida: 1.4,
  cautelaDescida: 0.18,
  // Reacao: quantos metros a frente a IA olha o perfil de velocidade. Nao e
  // previsao (o perfil ja tem a frenagem dentro), e o tempo de reagir.
  reacaoBase: 1,
  reacaoPorVelocidade: 0.12,
};

export function criarPiloto(nome, perfilNome = 'prata', semente = 1) {
  const perfil = PERFIS[perfilNome] || PERFIS.prata;
  return {
    nome,
    perfilNome,
    perfil,
    desvio: 0,
    desvioAlvo: 0,
    // Estilo de linha: cada piloto anda alguns centimetros deslocado da linha
    // ideal, para sempre. Sem isso, dez karts perseguiam a MESMA curva com a
    // mesma precisao e o pelotao virava uma fila de batidas — 235 toques numa
    // corrida de tres voltas, com dois karts sem completar uma volta. Piloto de
    // verdade tambem nao usa a linha do vizinho.
    estilo: (((semente | 0) % 7) - 3) * 0.42,
    semente: semente | 0 || 1,
    ruido: 0,
    relogioRuido: 0,
    driftando: false,
    cautela: 0,
  };
}

function sortear(piloto) {
  piloto.semente = (piloto.semente * 1103515245 + 12345) & 0x7fffffff;
  return piloto.semente / 0x7fffffff;
}

export function pilotar(carro, piloto, pista, linha, ctx = {}, dt = 1 / 60) {
  const perto = maisProximo(pista, carro.x, carro.y);
  const n = pista.centro.length;
  const velocidade = Math.max(0, carro.vx);

  piloto.relogioRuido -= dt;
  if (piloto.relogioRuido <= 0) {
    piloto.relogioRuido = 0.6 + sortear(piloto) * 1.2;
    piloto.ruido = (sortear(piloto) - 0.5) * 2 * piloto.perfil.erro;
  }

  // --- para onde olhar ---------------------------------------------------
  const naGrama = ctx.superficie === 'grama' || ctx.superficie === 'muro';
  // Fora da pista a IA precisa VOLTAR, e nao andar em paralelo na grama. A
  // olhada fixa de 6 a 12 m apontava para o centro la na frente: com o kart oito
  // metros fora, isso e um angulo raso, e ele fazia meia volta de circuito no
  // capim antes de reencontrar o asfalto. Medido numa corrida de tres voltas com
  // nove karts: 13 das 18 recolocacoes eram exatamente este caso.
  //
  // Agora a olhada encurta conforme o quanto ele esta fora: perto da borda ele
  // volta suave e mantem velocidade; longe, ele aponta quase perpendicular. Nao
  // e mais agressivo — e mais curto, o que e o contrario de agressivo em curva.
  const foraDaBorda = naGrama
    ? Math.max(0, Math.abs(ctx.lateral ?? 0) - perto.largura / 2)
    : 0;
  const distanciaOlhada = naGrama
    ? Math.max(2.5, 9 - foraDaBorda * 1.4) + velocidade * 0.1
    : AJUSTES.olhadaBase + velocidade * AJUSTES.olhadaPorVelocidade
      * piloto.perfil.antecipacao;
  const olhada = Math.max(2, Math.round(distanciaOlhada / pista.passo));
  const alvoIndice = (perto.i + olhada) % n;
  const linhaIdeal = naGrama
    ? 0
    : linha.deslocamentos[alvoIndice] + piloto.desvio + piloto.estilo;
  // Pelotao colado: segure a sua coluna. Com kart a menos de 6 m, a IA para de
  // puxar para a linha ideal e mantem a lateral onde esta — e o que um piloto
  // faz na largada, e sem isso dez karts convergiam na mesma curva 1 e se
  // destruiam antes da primeira volta.
  const aperto = Number.isFinite(ctx.aperto) ? ctx.aperto : Infinity;
  const apertado = naGrama ? 0 : Math.max(0, Math.min(1, (6 - aperto) / 4));
  const colunaAtual = Number.isFinite(ctx.lateral) ? ctx.lateral : linhaIdeal;
  const deslocaLinha = linhaIdeal * (1 - apertado) + colunaAtual * apertado;
  const limite = pista.centro[alvoIndice].largura / 2 - KART.largura / 2 - 0.3;
  const alvo = paraMundo(pista, alvoIndice, Math.max(-limite, Math.min(limite, deslocaLinha)));

  // --- drift: decidido antes do volante ---------------------------------
  // O ganho do drift esta no mini-turbo da saida, nao na curva em si. Por isso
  // a IA solta o gatilho quando a curva acaba — e nao quando ela aperta.
  const curvaturaAqui = Math.abs(linha.curvaturas[perto.i]);
  const curvaturaAdiante = Math.abs(
    linha.curvaturas[(perto.i + Math.round(10 / pista.passo)) % n]);
  const valeDriftar = curvaturaAqui > KART.curvaturaDeDrift * (2 - piloto.perfil.drift)
    && velocidade > 8 && !naGrama;
  const acabou = curvaturaAdiante < KART.curvaturaDeDrift * AJUSTES.folgaDeSaida;
  if (piloto.driftando) piloto.driftando = !acabou && velocidade > 6;
  else piloto.driftando = valeDriftar && piloto.perfil.drift > 0.2;

  // --- volante: quanto giro por segundo eu quero -------------------------
  const anguloParaAlvo = Math.atan2(alvo.y - carro.y, alvo.x - carro.x);
  const deriva = Math.atan2(carro.vy, Math.max(3, velocidade));
  const erro = normalizar(anguloParaAlvo - carro.ang);
  const curvaturaAlvo = naGrama ? 0 : linha.curvaturas[alvoIndice];
  // Giro que a curva pede: curvatura vezes velocidade, direto da cinematica.
  // A correcao de rumo entra em rad/s, e a deriva desconta o que o kart JA esta
  // girando de lado.
  const giroPedido = curvaturaAlvo * velocidade + erro * AJUSTES.ganhoDeRumo
    - deriva * AJUSTES.descontoDeDeriva;
  const giroDisponivel = ((KART.atritoBase * (ctx.atrito ?? 1) * 9.81)
    / Math.max(5, velocidade))
    * (piloto.driftando ? KART.fatorDeGiroNoDrift : KART.fatorDeGiroEmAderencia);
  const volante = Math.max(-1, Math.min(1,
    giroPedido / giroDisponivel + piloto.ruido * 0.25));

  // --- velocidade alvo ---------------------------------------------------
  // A IA nao faz conta propria de frenagem: ela SEGUE o perfil de velocidade da
  // linha, que ja foi calculado com passagem de tras para frente e ja tem a
  // margem de frenagem dentro. A versao anterior calculava a janela sozinha
  // supondo 1,07 g de freio — que o pneu nao tem enquanto vira — e por isso
  // chegava no apice do grampo da SERRA a 72 km/h onde a linha pedia 45, batia
  // no muro e saia atolada. Duas contas para a mesma coisa era o defeito; agora
  // ha uma.
  //
  // A olhada curta a frente e reacao, nao previsao: o que o perfil ja sabe, ela
  // nao precisa recalcular.
  // Cautela: quem acabou de escapar entra mais devagar na proxima. Sem isso a
  // `habilidade` do perfil era um numero cego — o ouro (0,96 do perfil) perdia
  // do prata (0,91) na BAIXADA por 0,3 s em tres sementes, porque o alvo mais
  // agressivo o jogava para fora dos dois grampos e ninguem aprendia nada.
  // Agora o alvo desce quando o kart escapa e volta a subir quando ele para de
  // escapar, entao todo perfil encontra o proprio limite — e o perfil mais forte
  // encontra um limite mais alto.
  const escapando = naGrama
    || Math.abs(deriva) > (piloto.driftando ? KART.derivaDoDrift : KART.derivaDeAderencia) * 1.6;
  piloto.cautela = escapando
    ? Math.min(AJUSTES.cautelaMaxima, piloto.cautela + dt * AJUSTES.cautelaSubida)
    : Math.max(0, piloto.cautela - dt * AJUSTES.cautelaDescida);

  const reacao = Math.max(2, Math.round((AJUSTES.reacaoBase
    + velocidade * AJUSTES.reacaoPorVelocidade) / pista.passo));
  let alvoVelocidade = Infinity;
  for (let k = 0; k <= reacao; k++) {
    const i = (perto.i + k) % n;
    if (linha.velocidades[i] < alvoVelocidade) alvoVelocidade = linha.velocidades[i];
  }
  alvoVelocidade *= piloto.perfil.habilidade * (1 - piloto.cautela) * (1 + piloto.ruido * 0.04);
  // Fora da pista, velocidade e o inimigo. A grama da 0,64 g: a 43 km/h o raio
  // minimo e 23 m, e um kart quatro metros fora nao consegue apontar de volta
  // nessa curvatura — medido, ele AUMENTAVA a distancia da borda e terminava
  // teleportado. Quanto mais longe, mais devagar, que e o que um piloto faz ao
  // sair da pista: levanta o pe, aponta, volta.
  if (naGrama) {
    alvoVelocidade = Math.min(alvoVelocidade, Math.max(6, 12 - foraDaBorda * 1.5));
  }
  if (carro.turbo > 0) alvoVelocidade += 6;

  // --- kart na frente ----------------------------------------------------
  let acelerador = 0;
  let freio = 0;
  const frente = ctx.frente || null;
  if (frente && frente.distancia < 5 && frente.fechado) {
    freio = Math.min(1, (5 - frente.distancia) / 4);
  }
  if (frente && frente.distancia < 18) {
    const espacoEsquerda = perto.largura / 2 - frente.lateral - KART.largura;
    const espacoDireita = perto.largura / 2 + frente.lateral - KART.largura;
    const lado = espacoEsquerda > espacoDireita ? 1 : -1;
    piloto.desvioAlvo = lado * Math.min(2.8, perto.largura / 2 - KART.largura / 2 - 0.5)
      * piloto.perfil.agressao;
  } else {
    piloto.desvioAlvo = 0;
  }
  // 3,2 e nao 1,6: o desvio levava 0,6 s para sair, e nesse tempo o kart de
  // tras ja tinha encostado. Com o chassi respondendo (servo de guinada), o
  // desvio pode ser rapido.
  piloto.desvio += (piloto.desvioAlvo - piloto.desvio) * Math.min(1, dt * 3.2);

  if (velocidade < alvoVelocidade - 0.3) {
    acelerador = Math.min(1, (alvoVelocidade - velocidade) / 3 + 0.4);
  } else if (velocidade > alvoVelocidade + 0.3) {
    freio = Math.max(freio, Math.min(1, (velocidade - alvoVelocidade) / 5));
  } else {
    acelerador = 0.5;
  }

  // A elipse de atrito no pe direito: pneu que faz curva nao traciona. O uso
  // lateral sai da forca do pneu (`aceleracaoLateral`), e nao de `v * omega`:
  // derrapando, omega e grande DE PROPOSITO, e com a conta antiga a IA lia
  // "pneu saturado", fechava o acelerador em 0,15 e andava a 12 km/h de media
  // com o gatilho de drift segurado — medido, e era por isso que o drift nunca
  // pagava.
  const lateralAgora = Math.abs(carro.aceleracaoLateral);
  const tetoLateral = KART.atritoUtil * 9.81;
  const usado = Math.min(1, lateralAgora / tetoLateral);
  const sobra = Math.sqrt(Math.max(0, 1 - usado * usado));
  // Derrapagem e com o pe dentro: quem derrapa esta trocando tracao por giro,
  // nao economizando pneu.
  const pisoDoDrift = piloto.driftando ? AJUSTES.pisoDoDrift : 0.15;
  acelerador = Math.min(acelerador, Math.max(pisoDoDrift, 0.15 + 0.85 * sobra));
  // O freio NAO leva teto aqui, e isso foi um conserto medido: a elipse de
  // atrito ja limita a forca de freio dentro de `passoCarro`, e limitar de novo
  // na decisao deixava a IA com 20% de freio exatamente onde ela precisa de
  // freio — dentro da curva. Ela chegava 14 km/h acima do alvo no grampo da
  // BAIXADA e passava 8% da volta na grama.
  if (!piloto.driftando && carro.derrapagem > 0.75) acelerador *= 0.6;

  // --- item --------------------------------------------------------------
  let usarItem = false;
  if (ctx.temItem) {
    if (carro.item === 'cogumelo') usarItem = curvaturaAqui < KART.curvaturaDeDrift * 0.7;
    else if (carro.item === 'casco') usarItem = !!frente && frente.distancia < 40;
    else usarItem = !frente || frente.distancia > 12;
  }

  return { volante, acelerador, freio, drift: piloto.driftando, item: usarItem };
}
