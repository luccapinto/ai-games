// A carteira. Todo valor é inteiro em centavos de ficha: 1 ficha = 100.
//
// O blackjack paga 3 para 2 e o bacará cobra 5% de comissão, então meia
// ficha e noventa e cinco centavos existem de verdade. Com inteiros não há
// arredondamento escondido: o que a mesa diz que paga é o que entra.

export const CENTAVOS = 100;
export const SALDO_INICIAL = 1000 * CENTAVOS;
export const CREDITO = 500 * CENTAVOS;
// 0,25% por rodada jogada com dívida aberta, composto. A casa arredonda o
// centavo para cima, como toda casa.
export const JUROS_POR_RODADA = 0.0025;

export function estadoCarteiraInicial() {
  return { saldo: SALDO_INICIAL, divida: 0, emprestado: 0, juros: 0, pago: 0, emprestimos: 0 };
}

function inteiroValido(v, nome) {
  if (!Number.isInteger(v) || v < 0) throw new Error(`${nome} precisa ser inteiro não negativo em centavos, veio ${v}`);
}

export function criarCarteira(estado) {
  function debitar(v) {
    inteiroValido(v, 'débito');
    if (v > estado.saldo) throw new Error('saldo insuficiente');
    estado.saldo -= v;
    return estado.saldo;
  }

  function creditar(v) {
    inteiroValido(v, 'crédito');
    estado.saldo += v;
    return estado.saldo;
  }

  function pode(v) {
    return Number.isInteger(v) && v >= 0 && v <= estado.saldo;
  }

  // A casa sempre empresta. É o que ela tem de mais generoso e de mais caro.
  function pedirCredito() {
    estado.saldo += CREDITO;
    estado.divida += CREDITO;
    estado.emprestado += CREDITO;
    estado.emprestimos++;
    return CREDITO;
  }

  function jurosDaRodada() {
    if (estado.divida <= 0) return 0;
    const j = Math.ceil(estado.divida * JUROS_POR_RODADA);
    estado.divida += j;
    estado.juros += j;
    return j;
  }

  function quitar(v = estado.divida) {
    const valor = Math.min(v, estado.divida, estado.saldo);
    if (valor <= 0) return 0;
    estado.saldo -= valor;
    estado.divida -= valor;
    estado.pago += valor;
    return valor;
  }

  return {
    estado,
    debitar, creditar, pode, pedirCredito, jurosDaRodada, quitar,
    get saldo() { return estado.saldo; },
    get divida() { return estado.divida; },
    // Patrimônio: o que sobraria se você pagasse a casa agora.
    get liquido() { return estado.saldo - estado.divida; },
  };
}
