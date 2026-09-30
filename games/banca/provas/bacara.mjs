// Provas do bacará: a tabela da terceira carta, a comissão em centavo exato, a
// enumeração do sapato inteiro e um milhão de coups simulados para conferir
// que a enumeração não mentiu.
//
// Nenhuma vantagem está escrita à mão aqui: 1,06%, 1,24% e 14,36% saem da
// enumeração e são conferidos contra a simulação em erros padrão.

import { bloco, prova, ok, igual, perto, entre, lanca, relatar, geradorRapido, fonteDeterministica } from './base.mjs';
import { criarCasa, armazemMemoria } from '../js/nucleo/casa.js';
import { conferirHash } from '../js/nucleo/justo.js';
import { lerCurto, valorDe } from '../js/nucleo/baralho.js';
import {
  REGRAS, TOTAL_SAPATO, REGRAS_TEXTO, APOSTAS, valorCarta, totalMao, ehPar,
  jogadorCompra, bancaCompra, jogarMao, derivar, enumerar, recalcularEnumeracao,
  fichas, FICHAS, ENUMERACAO, contaDaMesa, retornoDe, conferir, placa, liquidoPorFicha,
  assinaturaDoSapato,
} from '../js/jogos/bacara/regras.js';
import { criarSessaoBacara } from '../js/jogos/bacara/sessao.js';

const c = t => lerCurto(t);

// Uma mesa de provas: abre o sapato, cria a sessão e escreve as cartas da cena
// por cima do começo do sapato.
function mesa(cartas = [], opcoes = {}) {
  const armazem = opcoes.armazem ?? armazemMemoria();
  const casa = criarCasa({ armazem, fonte: fonteDeterministica(opcoes.semente ?? 11) });
  casa.justo.abrir('bacara');
  const s = criarSessaoBacara(casa);
  if (opcoes.saldo !== undefined) casa.carteira.estado.saldo = opcoes.saldo;
  const sapato = s.cartasDoSapato;
  for (let i = 0; i < cartas.length; i++) sapato[i] = c(cartas[i]);
  return { casa, s, armazem };
}

bloco('bacará: cartas e totais');

prova('o ás vale 1, o dez e as figuras valem 0', () => {
  igual(valorCarta(c('AE')), 1, 'ás');
  igual(valorCarta(c('2C')), 2, 'dois');
  igual(valorCarta(c('9O')), 9, 'nove');
  igual(valorCarta(c('10P')), 0, 'dez');
  igual(valorCarta(c('JE')), 0, 'valete');
  igual(valorCarta(c('QC')), 0, 'dama');
  igual(valorCarta(c('KO')), 0, 'rei');
});

prova('a mão é a soma módulo 10', () => {
  igual(totalMao([c('9E'), c('8C')]), 7, '9+8 = 17 = 7');
  igual(totalMao([c('KE'), c('KC')]), 0, 'duas figuras');
  igual(totalMao([c('5E'), c('5C'), c('5O')]), 5, '15 = 5');
  igual(totalMao([c('AE'), c('2C'), c('3O')]), 6, 'ás, dois e três');
});

prova('par é mesmo índice, não mesmo valor', () => {
  ok(ehPar([c('KE'), c('KC')]), 'rei com rei é par');
  ok(!ehPar([c('KE'), c('QC')]), 'rei com dama vale 0 nos dois, mas não é par');
  ok(!ehPar([c('10E'), c('JC')]), 'dez com valete não é par');
  ok(ehPar([c('7E'), c('7P')]), 'sete com sete é par');
});

bloco('bacará: tabela da terceira carta');

// A tabela escrita à mão, letra por letra, para conferir bancaCompra sem usar
// a mesma expressão que ela usa. C = compra, P = para. As dez colunas são o
// valor da terceira carta do jogador, de 0 a 9.
const BANCA_COM_TERCEIRA = [
  'CCCCCCCCCC', // banca 0
  'CCCCCCCCCC', // banca 1
  'CCCCCCCCCC', // banca 2
  'CCCCCCCCPC', // banca 3: para só contra o 8
  'PPCCCCCCPP', // banca 4: compra de 2 a 7
  'PPPPCCCCPP', // banca 5: compra de 4 a 7
  'PPPPPPCCPP', // banca 6: compra contra 6 e 7
  'PPPPPPPPPP', // banca 7
  'PPPPPPPPPP', // banca 8: natural, nem chega aqui
  'PPPPPPPPPP', // banca 9: natural, nem chega aqui
];
// Quando o jogador PAROU, a banca compra com 0 a 5. Índice: total da banca.
const BANCA_SEM_TERCEIRA = 'CCCCCCPPPP';

prova('a tabela inteira da banca bate, os 110 casos', () => {
  let casos = 0;
  for (let tb = 0; tb <= 9; tb++) {
    igual(bancaCompra(tb, null), BANCA_SEM_TERCEIRA[tb] === 'C', `banca ${tb} com o jogador parado`);
    casos++;
    for (let t = 0; t <= 9; t++) {
      igual(bancaCompra(tb, t), BANCA_COM_TERCEIRA[tb][t] === 'C', `banca ${tb} contra terceira ${t}`);
      casos++;
    }
  }
  igual(casos, 110, 'a tabela tem 110 casos');
});

prova('o jogador compra exatamente com 0 a 5', () => {
  for (let t = 0; t <= 9; t++) igual(jogadorCompra(t), t <= 5, `jogador com ${t}`);
});

prova('o natural para o coup nas quatro cartas', () => {
  // Jogador 9 (4+5), banca 5 (2+3): sem o natural o jogador não compraria e a
  // banca compraria, mas o natural manda os dois pararem.
  const fila = ['4E', '2C', '5O', '3P', '9E', '9C'].map(c);
  let i = 0;
  const mao = jogarMao(() => fila[i++]);
  igual(i, 4, 'saíram só quatro cartas');
  igual(mao.totalJogador, 9, 'jogador 9');
  igual(mao.totalBanca, 5, 'banca 5');
  ok(mao.natural, 'é natural');
  igual(mao.vencedor, 'jogador', 'o nove ganha');
});

prova('sem natural o coup pode chegar a seis cartas', () => {
  // Jogador 5 (2+3) compra; banca 0 (K+K) compra sempre.
  const fila = ['2E', 'KC', '3O', 'KP', '9E', '2C'].map(c);
  let i = 0;
  const mao = jogarMao(() => fila[i++]);
  igual(i, 6, 'saíram seis cartas');
  igual(mao.totalJogador, 4, '5 + 9 = 14 = 4');
  igual(mao.totalBanca, 2, '0 + 2');
  igual(mao.vencedor, 'jogador', '4 contra 2');
  ok(!mao.natural, 'não é natural');
});

bloco('bacará: enumeração exata');

const E = enumerar();
const F = fichas();

prova('as probabilidades do coup somam 1', () => {
  perto(E.soma, 1, 1e-9, 'soma da distribuição conjunta');
  perto(E.p.jogador + E.p.banca + E.p.empate, 1, 1e-9, 'soma dos três desfechos');
  igual(E.celulas.length, 12, 'doze células: três vencedores por dois pares por dois pares');
});

prova('a vantagem da casa bate com a literatura em quatro casas', () => {
  perto(F.banca.vantagem * 100, 1.0579, 0.0001, 'banca');
  perto(F.jogador.vantagem * 100, 1.2351, 0.0001, 'jogador');
  perto(F.empate.vantagem * 100, 14.3596, 0.0001, 'empate 8 para 1');
  perto(F.parJogador.vantagem * 100, 10.3614, 0.0001, 'par do jogador');
  perto(F.parBanca.vantagem * 100, 10.3614, 0.0001, 'par da banca');
});

prova('a placa mostra os mesmos números em duas casas', () => {
  const p = placa();
  igual(p.length, 3, 'três números na placa');
  igual(p[0].valor, '1,06%', 'banca');
  igual(p[1].valor, '1,24%', 'jogador');
  igual(p[2].valor, '14,36%', 'empate');
});

prova('o par sai em 31 de 415, como manda a combinatória', () => {
  perto(E.par.jogador, 31 / 415, 1e-12, 'par do jogador');
  perto(E.par.banca, 31 / 415, 1e-12, 'par da banca');
  // Os dois pares ao mesmo tempo não são o produto: as quatro cartas saem do
  // mesmo sapato, e um par de um lado consome dois índices iguais, o que deixa
  // o resto do sapato um pouco mais casado para o outro lado.
  ok(E.par.ambos > E.par.jogador * E.par.banca, 'os dois pares são positivamente correlacionados');
  perto(E.par.ambos / (E.par.jogador * E.par.banca), 1, 0.001, 'a correlação é pequena');
});

prova('nenhuma aposta da mesa favorece o jogador', () => {
  for (const id of APOSTAS) {
    ok(F[id].vantagem > 0, `${id} tem vantagem da casa positiva`);
    ok(FICHAS[id].vantagem === F[id].vantagem, `${id} sai igual por FICHAS`);
  }
});

prova('a enumeração é rápida e completa', () => {
  const novo = recalcularEnumeracao();
  ok(novo.ms < 2000, `a enumeração levou ${novo.ms} ms, o limite é 2000`);
  ok(novo.sequencias > 1e6, `${novo.sequencias} sequências enumeradas`);
  entre(novo.cartasMedias, 4.9, 5.0, 'cartas por coup');
  relatar(`  bacará enumeração                  ${novo.sequencias.toLocaleString('pt-BR')} sequências em ${novo.ms} ms, ${novo.cartasMedias.toFixed(4)} cartas por coup`);
  relatar(`  bacará vantagem exata              banca ${(F.banca.vantagem * 100).toFixed(4)}%, jogador ${(F.jogador.vantagem * 100).toFixed(4)}%, empate ${(F.empate.vantagem * 100).toFixed(4)}%, par ${(F.parJogador.vantagem * 100).toFixed(4)}%`);
});

prova('o texto das regras cobre a mesa', () => {
  ok(REGRAS_TEXTO.length >= 10, 'há regras declaradas');
  ok(REGRAS_TEXTO.every(t => typeof t === 'string' && t.length > 20), 'toda regra é uma frase');
  igual(REGRAS.baralhos, 8, 'oito baralhos');
  igual(TOTAL_SAPATO, 416, '416 cartas');
  igual(REGRAS.corte, 402, 'corte na 402');
});

bloco('bacará: pagamentos');

prova('a comissão de 5% sai em centavo exato', () => {
  // Jogador 6 (2+4) para, banca 7 (5+2) para: a banca ganha.
  const { casa, s } = mesa(['2E', '5C', '4O', '2P']);
  const saldo = casa.carteira.saldo;
  s.apostar('banca', 1000);
  const { eventos } = s.dar();
  const r = eventos.find(e => e.tipo === 'resultado' && e.zona === 'banca');
  igual(r.pago, 1950, 'volta a aposta mais 95% dela');
  igual(casa.carteira.saldo, saldo + 950, 'o lucro é 9,50 fichas em centavo inteiro');
  igual(s.mao.vencedor, 'banca', 'a banca ganhou');
  // Em qualquer aposta de ficha inteira o pagamento continua inteiro.
  for (let fichasApostadas = 5; fichasApostadas <= 2000; fichasApostadas += 7) {
    const v = fichasApostadas * 100;
    const pago = retornoDe('banca', v, { vencedor: 'banca', parJogador: false, parBanca: false });
    ok(Number.isInteger(pago), `${fichasApostadas} fichas paga inteiro`);
    igual(pago, v + v * 95 / 100, 'aposta mais 0,95 por ficha');
  }
});

prova('o empate devolve Jogador e Banca e paga 8 para 1', () => {
  const { casa, s } = mesa(['2E', '5C', '4O', 'AP']);
  const saldo = casa.carteira.saldo;
  s.apostar('jogador', 1000);
  s.apostar('banca', 1000);
  s.apostar('empate', 500);
  const { eventos } = s.dar();
  igual(s.mao.vencedor, 'empate', 'empatou em 6');
  const por = Object.fromEntries(eventos.filter(e => e.tipo === 'resultado').map(e => [e.zona, e]));
  igual(por.jogador.pago, 1000, 'jogador devolvido');
  igual(por.jogador.resultado, 'empatou', 'jogador empatou');
  igual(por.banca.pago, 1000, 'banca devolvida');
  igual(por.empate.pago, 4500, 'empate paga 8 para 1');
  igual(casa.carteira.saldo, saldo + 4000, 'o empate rendeu 40 fichas');
});

prova('os pares pagam 11 para 1 e olham só as duas primeiras cartas', () => {
  // Jogador K+K (par, total 0), banca 9+9 (par, total 8, natural).
  const { casa, s } = mesa(['KE', '9O', 'KC', '9P']);
  const saldo = casa.carteira.saldo;
  s.apostar('parJogador', 500);
  s.apostar('parBanca', 500);
  const { eventos } = s.dar();
  ok(s.mao.parJogador && s.mao.parBanca, 'os dois pares saíram');
  ok(s.mao.natural, 'o 8 da banca é natural');
  igual(s.mao.jogador.length, 2, 'o natural parou o coup');
  const por = Object.fromEntries(eventos.filter(e => e.tipo === 'resultado').map(e => [e.zona, e]));
  igual(por.parJogador.pago, 6000, '11 para 1 sobre 5 fichas');
  igual(casa.carteira.saldo, saldo + 11000, 'os dois pares renderam 110 fichas');
});

prova('dez com valete não é par', () => {
  const { s } = mesa(['10E', '2C', 'JC', '3P']);
  s.apostar('parJogador', 500);
  s.dar();
  ok(!s.mao.parJogador, 'valores iguais, índices diferentes');
});

bloco('bacará: a mesa');

prova('a aposta é debitada na hora e devolvida ao retirar', () => {
  const { casa, s } = mesa();
  const saldo = casa.carteira.saldo;
  s.apostar('jogador', 1000);
  igual(casa.carteira.saldo, saldo - 1000, 'debitou na hora');
  s.apostar('jogador', 500);
  igual(s.apostas.jogador, 1500, 'somou na mesma zona');
  igual(casa.carteira.saldo, saldo - 1500, 'debitou o acréscimo');
  s.retirar('jogador');
  igual(casa.carteira.saldo, saldo, 'devolveu tudo');
  igual(s.total(), 0, 'mesa limpa');
});

prova('limites e fichas inteiras são cobrados', () => {
  const { s } = mesa();
  lanca(() => s.apostar('jogador', 150), 'centavo quebrado');
  lanca(() => s.apostar('jogador', 400), 'abaixo do mínimo de 5 fichas');
  lanca(() => s.apostar('jogador', 200100), 'acima do máximo de 2000 fichas');
  lanca(() => s.apostar('naoexiste', 1000), 'zona inexistente');
  s.apostar('jogador', 500);
  igual(s.apostas.jogador, 500, 'o mínimo passa');
});

prova('o saldo nunca fica negativo', () => {
  const { casa, s } = mesa([], { saldo: 1000 });
  s.apostar('jogador', 1000);
  lanca(() => s.apostar('banca', 500), 'sem saldo para a segunda aposta');
  igual(casa.carteira.saldo, 0, 'zerou, não passou disso');
  s.dar();
  ok(casa.carteira.saldo >= 0, 'saldo não negativo depois do coup');
});

prova('não dá para dar cartas sem aposta nem apostar depois do coup', () => {
  const { s } = mesa(['2E', '5C', '4O', '2P']);
  lanca(() => s.dar(), 'coup sem aposta');
  s.apostar('banca', 500);
  s.dar();
  igual(s.estado, 'fim', 'o coup terminou');
  lanca(() => s.apostar('banca', 500), 'aposta com o coup dado');
  lanca(() => s.limpar(), 'limpar com o coup dado');
  lanca(() => s.dar(), 'dar duas vezes');
  s.novaRodada();
  igual(s.estado, 'aposta', 'a mesa reabriu');
  igual(s.total(), 0, 'as apostas saíram da mesa');
});

prova('repetir recoloca a aposta do coup anterior', () => {
  const { casa, s } = mesa(['2E', '5C', '4O', '2P']);
  s.apostar('banca', 1000);
  s.apostar('empate', 500);
  s.dar();
  s.novaRodada();
  const saldo = casa.carteira.saldo;
  s.repetir();
  igual(s.apostas.banca, 1000, 'banca repetida');
  igual(s.apostas.empate, 500, 'empate repetido');
  igual(casa.carteira.saldo, saldo - 1500, 'debitou de novo');
});

prova('a estrada guarda os últimos coups', () => {
  const { s } = mesa();
  for (let i = 0; i < 5; i++) {
    s.apostar('banca', 500);
    s.dar();
    s.novaRodada();
  }
  igual(s.estrada.length, 5, 'cinco marcas na estrada');
  const m = s.estrada[0];
  ok(['jogador', 'banca', 'empate'].includes(m.vencedor), 'vencedor registrado');
  ok(Number.isInteger(m.totalJogador) && Number.isInteger(m.totalBanca), 'totais registrados');
});

prova('as apostas colocadas sobrevivem a um recarregamento', () => {
  const armazem = armazemMemoria();
  const { casa, s } = mesa([], { armazem });
  s.apostar('jogador', 1500);
  s.apostar('parBanca', 500);
  const saldo = casa.carteira.saldo;
  const outra = criarCasa({ armazem, fonte: fonteDeterministica(3) });
  const s2 = criarSessaoBacara(outra);
  igual(s2.apostas.jogador, 1500, 'jogador de pé');
  igual(s2.apostas.parBanca, 500, 'par da banca de pé');
  igual(outra.carteira.saldo, saldo, 'o saldo é o mesmo');
  igual(s2.sapato.pos, s.sapato.pos, 'a posição do sapato sobreviveu');
});

bloco('bacará: sapato verificável');

prova('derivar reproduz o sapato inteiro da semente', () => {
  const { casa, s } = mesa();
  const reg = casa.justo.aberto('bacara');
  const outra = derivar(casa.justo.geradorDe(reg));
  igual(outra.length, TOTAL_SAPATO, '416 cartas');
  const conta = new Map();
  for (const carta of outra) conta.set(carta, (conta.get(carta) ?? 0) + 1);
  igual(conta.size, 52, '52 cartas distintas');
  ok([...conta.values()].every(v => v === 8), 'oito de cada');
  ok(conferirHash(reg.semente, reg.hash), 'a semente bate com o hash publicado');
});

prova('a carta de corte troca o sapato e abre um compromisso novo', () => {
  const { casa, s } = mesa();
  const antes = s.compromisso().hash;
  s.mesa.pos = REGRAS.corte;
  s.apostar('banca', 500);
  const { eventos } = s.dar();
  ok(eventos[0].tipo === 'embaralhar', 'o primeiro evento é o embaralho');
  ok(s.compromisso().hash !== antes, 'o compromisso mudou');
  igual(s.sapato.pos <= 6, true, 'o sapato novo começou do zero');
  const revelado = casa.justo.estado.revelados.at(-1);
  ok(conferirHash(revelado.semente, revelado.hash), 'a semente revelada bate com o hash');
  const r = conferir(revelado);
  ok(r.confere, `conferir aprova o sapato revelado: ${r.descricao}`);
});

prova('conferir recusa um resultado trocado', () => {
  const { casa, s } = mesa();
  s.mesa.pos = REGRAS.corte;
  s.apostar('banca', 500);
  s.dar();
  const revelado = casa.justo.estado.revelados.at(-1);
  const falso = { ...revelado, resultado: { ...revelado.resultado, assinatura: assinaturaDoSapato([1, 2, 3]) } };
  ok(!conferir(falso).confere, 'assinatura trocada é recusada');
  ok(conferir({ ...revelado, contador: revelado.contador + 1 }).confere === false, 'contador trocado é recusado');
});

bloco('bacará: o Livro');

prova('a perda esperada é a soma de valor por vantagem, exata', () => {
  const apostas = { jogador: 1500, banca: 2500, empate: 500, parJogador: 300, parBanca: 0 };
  const conta = contaDaMesa(apostas);
  let soma = 0;
  for (const id of APOSTAS) soma += (apostas[id] ?? 0) * F[id].vantagem;
  perto(conta.perdaEsperada, soma, 1e-6, 'perda esperada da mesa');
  ok(conta.variancia > 0, 'variância positiva');
});

prova('a variância da mesa inclui a covariância entre as apostas', () => {
  // Jogador e Empate perdem juntos quando a Banca ganha: covariância positiva,
  // a mesa varia MAIS que a soma das duas apostas isoladas.
  const juntas = contaDaMesa({ jogador: 1000, empate: 1000 });
  const so1 = contaDaMesa({ jogador: 1000 });
  const so2 = contaDaMesa({ empate: 1000 });
  ok(juntas.variancia > so1.variancia + so2.variancia, 'jogador com empate varia mais que a soma');
  // Jogador contra Banca é o contrário: uma ganha quando a outra perde, e as
  // duas juntas quase não balançam.
  const contra = contaDaMesa({ jogador: 1000, banca: 1000 });
  const soBanca = contaDaMesa({ banca: 1000 });
  ok(contra.variancia < so1.variancia + soBanca.variancia, 'jogador contra banca varia menos que a soma');
  // A conta bate na unha: E[x] e E[x^2] sobre as doze células.
  let m1 = 0;
  let m2 = 0;
  for (const cel of E.celulas) {
    const x = 1000 * liquidoPorFicha('jogador', cel) + 1000 * liquidoPorFicha('empate', cel);
    m1 += cel.p * x;
    m2 += cel.p * x * x;
  }
  perto(juntas.variancia, m2 - m1 * m1, 1e-6, 'variância conferida célula a célula');
});

prova('o Livro recebe a rodada com os números da enumeração', () => {
  const { casa, s } = mesa(['2E', '5C', '4O', '2P']);
  s.apostar('banca', 1000);
  s.apostar('empate', 500);
  s.dar();
  const r = casa.livro.rodadas('bacara').at(-1);
  igual(r.apostado, 1500, 'apostado');
  const conta = contaDaMesa({ banca: 1000, empate: 500 });
  perto(r.perdaEsperada, conta.perdaEsperada, 1e-9, 'perda esperada gravada');
  perto(r.variancia, conta.variancia, 1e-9, 'variância gravada');
  ok(r.rotulo.length > 0, 'rótulo em português');
});

bloco('bacará: um milhão de coups');

// Simulação com gerador rápido: sapato de 416 cartas, corte na 402, coups até
// passar do corte. Só conta desfechos, não usa saldo nenhum.
function simular(n, semente) {
  const g = geradorRapido(semente);
  const sapato = new Uint8Array(TOTAL_SAPATO);
  for (let i = 0; i < TOTAL_SAPATO; i++) sapato[i] = i % 52;
  const valor = new Uint8Array(52);
  for (let i = 0; i < 52; i++) valor[i] = (i % 13) <= 8 ? (i % 13) + 1 : 0;
  let pos = TOTAL_SAPATO;

  function embaralhar() {
    for (let i = TOTAL_SAPATO - 1; i > 0; i--) {
      const j = (g.u32() / 4294967296 * (i + 1)) | 0;
      const t = sapato[i]; sapato[i] = sapato[j]; sapato[j] = t;
    }
    pos = 0;
  }

  let nJ = 0;
  let nB = 0;
  let nE = 0;
  let pj = 0;
  let pb = 0;
  let cartas = 0;
  const t0 = performance.now();
  for (let k = 0; k < n; k++) {
    if (pos >= REGRAS.corte) embaralhar();
    const a = sapato[pos++];
    const b = sapato[pos++];
    const d = sapato[pos++];
    const e = sapato[pos++];
    cartas += 4;
    if (a % 13 === d % 13) pj++;
    if (b % 13 === e % 13) pb++;
    let tj = (valor[a] + valor[d]) % 10;
    let tb = (valor[b] + valor[e]) % 10;
    if (tj < 8 && tb < 8) {
      let terceira = -1;
      if (tj <= 5) {
        const t = sapato[pos++];
        cartas++;
        terceira = valor[t];
        tj = (tj + terceira) % 10;
      }
      const compra = terceira < 0
        ? tb <= 5
        : tb <= 2 || (tb === 3 && terceira !== 8) || (tb === 4 && terceira >= 2 && terceira <= 7)
          || (tb === 5 && terceira >= 4 && terceira <= 7) || (tb === 6 && terceira >= 6 && terceira <= 7);
      if (compra) {
        tb = (tb + valor[sapato[pos++]]) % 10;
        cartas++;
      }
    }
    if (tj > tb) nJ++; else if (tb > tj) nB++; else nE++;
  }
  return { n, nJ, nB, nE, pj, pb, cartas, ms: performance.now() - t0 };
}

prova('um milhão de coups caem a menos de 3 erros padrão da enumeração', () => {
  const N = 1000000;
  const sim = simular(N, 777);
  igual(sim.nJ + sim.nB + sim.nE, N, 'todo coup teve desfecho');

  const medidas = {
    jogador: (sim.nJ - sim.nB) / N,
    banca: (0.95 * sim.nB - sim.nJ) / N,
    empate: (8 * sim.nE - (N - sim.nE)) / N,
    parJogador: (11 * sim.pj - (N - sim.pj)) / N,
    parBanca: (11 * sim.pb - (N - sim.pb)) / N,
  };
  const linhas = [];
  for (const id of APOSTAS) {
    const exata = -F[id].vantagem;
    const se = Math.sqrt(F[id].variancia / N);
    const z = (medidas[id] - exata) / se;
    ok(Math.abs(z) <= 3, `${id}: simulado ${(-medidas[id] * 100).toFixed(4)}% contra ${(F[id].vantagem * 100).toFixed(4)}% exato, ${z.toFixed(2)} erros padrão`);
    linhas.push(`${id} ${(-medidas[id] * 100).toFixed(4)}% (${z >= 0 ? '+' : ''}${z.toFixed(2)} σ)`);
  }
  perto(sim.cartas / N, E.cartasMedias, 0.01, 'cartas por coup');
  relatar(`  bacará simulação 1.000.000 coups   ${linhas.join(', ')}`);
  relatar(`  bacará simulação tempo             ${(sim.ms / 1000).toFixed(2)} s, ${Math.round(N / (sim.ms / 1000)).toLocaleString('pt-BR')} coups/s`);
});

prova('a simulação reproduz a frequência dos pares', () => {
  const sim = simular(200000, 777);
  perto(sim.pj / sim.n, 31 / 415, 0.003, 'par do jogador');
  perto(sim.pb / sim.n, 31 / 415, 0.003, 'par da banca');
});
