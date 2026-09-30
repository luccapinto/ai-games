// Provas do núcleo: SHA-256, HMAC, gerador verificável, carteira, Livro, casa.

import { createHash, createHmac } from 'node:crypto';
import { bloco, prova, ok, igual, perto, lanca, quiQuadrado, limiteQui, fonteDeterministica, geradorRapido } from './base.mjs';
import { sha256hex, hmacSha256hex, deHex, hex } from '../js/nucleo/sha256.js';
import { criarGerador, criarJusto, estadoJustoInicial, conferirHash } from '../js/nucleo/justo.js';
import { criarCarteira, estadoCarteiraInicial, SALDO_INICIAL, CREDITO } from '../js/nucleo/carteira.js';
import { criarLivro, estadoLivroInicial } from '../js/nucleo/livro.js';
import { criarCasa, armazemMemoria, CHAVE } from '../js/nucleo/casa.js';
import { fichas, pct, numero, chance } from '../js/nucleo/formato.js';

bloco('núcleo: SHA-256 e HMAC');

prova('SHA-256 da string vazia bate com o vetor do NIST', () => {
  igual(sha256hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'vazio');
});

prova('SHA-256 de "abc" bate com o vetor do NIST', () => {
  igual(sha256hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'abc');
});

prova('SHA-256 da mensagem de 448 bits bate com o vetor do NIST', () => {
  igual(sha256hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1', '448 bits');
});

prova('SHA-256 da mensagem de 896 bits e de um milhão de "a" bate com o NIST', () => {
  igual(sha256hex('abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu'),
    'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1', '896 bits');
  igual(sha256hex('a'.repeat(1000000)), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0', 'um milhão de a');
});

prova('SHA-256 bate com o do Node em 2.000 mensagens de 0 a 300 bytes, com acento', () => {
  const g = geradorRapido(11);
  for (let i = 0; i < 2000; i++) {
    const n = i % 301;
    const b = new Uint8Array(n);
    for (let j = 0; j < n; j++) b[j] = g.u32() & 255;
    igual(sha256hex(b), createHash('sha256').update(b).digest('hex'), `mensagem de ${n} bytes`);
  }
  igual(sha256hex('ação, pão, coração'), createHash('sha256').update('ação, pão, coração', 'utf8').digest('hex'), 'UTF-8');
});

prova('HMAC-SHA256 bate com os casos 1, 2 e 6 da RFC 4231', () => {
  igual(hmacSha256hex(deHex('0b'.repeat(20)), 'Hi There'),
    'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7', 'caso 1');
  igual(hmacSha256hex('Jefe', 'what do ya want for nothing?'),
    '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843', 'caso 2');
  igual(hmacSha256hex(deHex('aa'.repeat(131)), 'Test Using Larger Than Block-Size Key - Hash Key First'),
    '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54', 'caso 6, chave maior que o bloco');
});

prova('HMAC-SHA256 bate com o do Node em 500 pares de chave e mensagem', () => {
  const g = geradorRapido(12);
  for (let i = 0; i < 500; i++) {
    const chave = hex(Uint8Array.from({ length: (i * 7) % 90 }, () => g.u32() & 255));
    const msg = `${i}:${g.u32()}:${'x'.repeat(i % 70)}`;
    igual(hmacSha256hex(chave, msg), createHmac('sha256', chave).update(msg).digest('hex'), `par ${i}`);
  }
});

bloco('núcleo: gerador verificável');

prova('mesma semente da casa, do jogador e contador dão sempre a mesma sequência', () => {
  const a = criarGerador('casa-abc', 'jogador-1', 5);
  const b = criarGerador('casa-abc', 'jogador-1', 5);
  for (let i = 0; i < 500; i++) igual(a.inteiro(37), b.inteiro(37), `sorteio ${i}`);
});

prova('trocar qualquer uma das três entradas muda a sequência', () => {
  const base = Array.from({ length: 20 }, ((g) => () => g.inteiro(1000))(criarGerador('s', 'j', 1)));
  for (const [s, j, c] of [['t', 'j', 1], ['s', 'k', 1], ['s', 'j', 2]]) {
    const g = criarGerador(s, j, c);
    const outra = Array.from({ length: 20 }, () => g.inteiro(1000));
    ok(outra.join() !== base.join(), `(${s}, ${j}, ${c}) repetiu a sequência`);
  }
});

prova('o primeiro sorteio é recalculável à mão a partir do HMAC publicado', () => {
  const h = hmacSha256hex('semente-da-casa', 'minha-semente:42:0');
  const u = parseInt(h.slice(0, 8), 16);
  const g = criarGerador('semente-da-casa', 'minha-semente', 42);
  igual(g.u32(), u, 'primeiro uint32');
});

prova('inteiro(n) é uniforme: qui-quadrado de 370 mil sorteios em 37 casas', () => {
  const g = criarGerador('uniforme', 'teste', 0);
  const c = new Array(37).fill(0);
  for (let i = 0; i < 370000; i++) c[g.inteiro(37)]++;
  const q = quiQuadrado(c);
  ok(q < limiteQui(36), `qui-quadrado ${q.toFixed(1)} acima de ${limiteQui(36).toFixed(1)}`);
});

prova('inteiro(n) rejeita o resto: com n = 3·2^30 nunca sai viés de 2 para 1', () => {
  const g = criarGerador('vies', 'teste', 0);
  const n = 3 * 2 ** 30;
  let baixo = 0;
  for (let i = 0; i < 30000; i++) if (g.inteiro(n) < 2 ** 30) baixo++;
  // Sem rejeição, o primeiro terço sairia com probabilidade 1/2 em vez de 1/3.
  perto(baixo / 30000, 1 / 3, 0.02, 'primeiro terço');
});

prova('embaralhar devolve uma permutação e cada posição é uniforme', () => {
  const cont = Array.from({ length: 8 }, () => new Array(8).fill(0));
  for (let r = 0; r < 16000; r++) {
    const g = criarGerador('emb', 'j', r);
    const p = g.embaralhar([0, 1, 2, 3, 4, 5, 6, 7]);
    igual([...p].sort().join(), '0,1,2,3,4,5,6,7', 'permutação');
    p.forEach((v, i) => cont[i][v]++);
  }
  for (const linha of cont) ok(quiQuadrado(linha) < limiteQui(7), `posição enviesada: ${linha}`);
});

prova('o cartório publica o hash antes e a semente revelada bate com ele', () => {
  const justo = criarJusto(estadoJustoInicial(fonteDeterministica(3)), fonteDeterministica(4));
  const antes = justo.compromisso('roleta');
  const { registro, gerador } = justo.abrir('roleta');
  igual(registro.hash, antes.hash, 'hash mudou entre publicar e abrir');
  ok(conferirHash(registro.semente, antes.hash), 'semente não bate com o hash publicado');
  const n = gerador.inteiro(37);
  const rev = justo.revelar('roleta', { numero: n });
  igual(rev.contador, 0, 'contador da rodada');
  const depois = justo.compromisso('roleta');
  ok(depois.hash !== antes.hash, 'a próxima rodada reusou a semente');
  igual(depois.contador, 1, 'contador não andou');
  igual(criarGerador(rev.semente, rev.sementeJogador, rev.contador).inteiro(37), n, 'recalcular não reproduz');
});

prova('trocar a semente do jogador vale para a próxima abertura, não para a aberta', () => {
  const justo = criarJusto(estadoJustoInicial(fonteDeterministica(5)), fonteDeterministica(6));
  const { registro } = justo.abrir('blackjack');
  justo.trocarSementeJogador('outra semente');
  igual(justo.aberto('blackjack').sementeJogador, registro.sementeJogador, 'sapato aberto mudou de semente');
  justo.revelar('blackjack', {});
  igual(justo.abrir('blackjack').registro.sementeJogador, 'outra semente', 'semente nova não entrou');
  lanca(() => justo.trocarSementeJogador(''), 'aceitou semente vazia');
  lanca(() => justo.abrir('blackjack'), 'abriu duas rodadas do mesmo jogo');
});

bloco('núcleo: carteira e Livro');

prova('a carteira nunca fica negativa e só aceita centavos inteiros', () => {
  const c = criarCarteira(estadoCarteiraInicial());
  igual(c.saldo, SALDO_INICIAL, 'saldo inicial');
  lanca(() => c.debitar(SALDO_INICIAL + 1), 'debitou além do saldo');
  lanca(() => c.debitar(1.5), 'aceitou centavo fracionário');
  lanca(() => c.debitar(-1), 'aceitou débito negativo');
  c.debitar(SALDO_INICIAL);
  igual(c.saldo, 0, 'zerou');
});

prova('o crédito da casa entra no saldo e na dívida, e o juro arredonda para cima', () => {
  const c = criarCarteira(estadoCarteiraInicial());
  c.debitar(SALDO_INICIAL);
  c.pedirCredito();
  igual(c.saldo, CREDITO, 'saldo depois do crédito');
  igual(c.divida, CREDITO, 'dívida');
  const j = c.jurosDaRodada();
  igual(j, Math.ceil(CREDITO * 0.0025), 'juro da rodada');
  igual(c.divida, CREDITO + j, 'dívida com juro');
  igual(c.quitar(10000), 10000, 'pagamento parcial');
  igual(c.divida, CREDITO + j - 10000, 'dívida depois do pagamento');
  igual(c.liquido, c.saldo - c.divida, 'líquido');
});

prova('a perda esperada acumulada do Livro é a soma exata das perdas registradas', () => {
  const l = criarLivro(estadoLivroInicial());
  const g = geradorRapido(9);
  let soma = 0, somaVar = 0, real = 0;
  const jogos = ['roleta', 'bacara', 'craps'];
  const porJogo = { roleta: 0, bacara: 0, craps: 0 };
  for (let i = 0; i < 3000; i++) {
    const apostado = 100 * (1 + g.inteiro(50));
    const retorno = g.inteiro(3) === 0 ? apostado * 2 : 0;
    const pe = apostado * (0.01 + g.real() * 0.1);
    const jogo = jogos[i % 3];
    l.registrar({ jogo, apostado, retorno, perdaEsperada: pe, variancia: apostado * apostado });
    soma += pe; somaVar += apostado * apostado; real += retorno - apostado; porJogo[jogo] += pe;
  }
  const r = l.resumo();
  perto(r.perdaEsperada, soma, 1e-6, 'soma total');
  perto(r.variancia, somaVar, 1e-3, 'variância');
  igual(r.real, real, 'resultado real');
  for (const j of jogos) perto(l.resumo(j).perdaEsperada, porJogo[j], 1e-6, j);
  perto(l.resumo('roleta').perdaEsperada + l.resumo('bacara').perdaEsperada + l.resumo('craps').perdaEsperada, soma, 1e-6, 'jogos somam o total');
  const ult = l.estado.rodadas.at(-1);
  perto(-ult.esperado, soma, 1e-6, 'acumulado da última rodada');
  perto(r.sorte, (real + soma) / Math.sqrt(somaVar), 1e-9, 'desvios-padrão');
});

prova('o Livro recusa rodada com perda esperada negativa ou valor fracionário', () => {
  const l = criarLivro(estadoLivroInicial());
  lanca(() => l.registrar({ jogo: 'x', apostado: 100, retorno: 0, perdaEsperada: -5, variancia: 1 }), 'aceitou aposta com vantagem do jogador');
  lanca(() => l.registrar({ jogo: 'x', apostado: 1.5, retorno: 0, perdaEsperada: 0, variancia: 1 }), 'aceitou apostado fracionário');
  lanca(() => l.registrar({ jogo: 'x', apostado: 100, retorno: 0, perdaEsperada: NaN, variancia: 1 }), 'aceitou NaN');
});

bloco('núcleo: casa e persistência');

prova('a casa grava e recarrega saldo, Livro, sementes e preferências', () => {
  const armazem = armazemMemoria();
  const a = criarCasa({ armazem, fonte: fonteDeterministica(1) });
  a.carteira.debitar(1000);
  a.fecharRodada({ jogo: 'roleta', apostado: 1000, retorno: 0, perdaEsperada: 27.03, variancia: 1e6 });
  a.justo.trocarSementeJogador('lucca');
  a.prefs.som = false;
  const hash = a.justo.compromisso('roleta').hash;
  a.salvar();
  const b = criarCasa({ armazem, fonte: fonteDeterministica(2) });
  igual(b.carteira.saldo, a.carteira.saldo, 'saldo');
  igual(b.livro.resumo().n, 1, 'rodadas');
  igual(b.justo.sementeJogador, 'lucca', 'semente do jogador');
  igual(b.justo.compromisso('roleta').hash, hash, 'o compromisso publicado sobreviveu à recarga');
  igual(b.prefs.som, false, 'preferência');
});

prova('estado corrompido no armazém não impede a casa de abrir', () => {
  const armazem = armazemMemoria();
  armazem.gravar(CHAVE, '{isto não é json');
  const c = criarCasa({ armazem });
  igual(c.carteira.saldo, SALDO_INICIAL, 'saldo inicial');
});

prova('zerar tudo volta ao saldo inicial, limpa o Livro e troca as sementes', () => {
  const armazem = armazemMemoria();
  const c = criarCasa({ armazem });
  c.carteira.debitar(50000);
  c.pedirCredito();
  c.fecharRodada({ jogo: 'roleta', apostado: 100, retorno: 0, perdaEsperada: 2.7, variancia: 1e4 });
  const hash = c.justo.compromisso('roleta').hash;
  const carteira = c.carteira;
  c.zerar();
  igual(carteira.saldo, SALDO_INICIAL, 'a mesma carteira voltou ao saldo inicial');
  igual(c.carteira.divida, 0, 'dívida');
  igual(c.livro.resumo().n, 0, 'Livro');
  ok(c.justo.compromisso('roleta').hash !== hash, 'semente da casa sobreviveu ao zerar');
  igual(criarCasa({ armazem }).carteira.saldo, SALDO_INICIAL, 'recarregado');
});

prova('fechar uma rodada com dívida cobra o juro e registra no Livro', () => {
  const c = criarCasa({ armazem: armazemMemoria() });
  c.carteira.debitar(SALDO_INICIAL);
  c.pedirCredito();
  const d0 = c.carteira.divida;
  const r = c.fecharRodada({ jogo: 'craps', apostado: 0, retorno: 0, perdaEsperada: 0, variancia: 0 });
  igual(r.juros, Math.ceil(d0 * 0.0025), 'juro');
  igual(c.livro.estado.eventos[0].tipo, 'credito', 'evento de crédito');
});

bloco('núcleo: formato');

prova('números saem em português: milhar com ponto, decimal com vírgula', () => {
  igual(fichas(123456789), '1.234.567,89', 'fichas');
  igual(fichas(100000), '1.000', 'ficha inteira sem casas');
  igual(pct(0.027027), '2,70%', 'percentual');
  igual(numero(-0.004, 2), '0,00', 'zero sem sinal');
  igual(numero(-3.5, 1), '−3,5', 'sinal de menos tipográfico');
  igual(chance(1 / 37), '1 em 37', 'chance');
});
