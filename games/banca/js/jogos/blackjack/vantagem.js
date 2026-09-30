// GERADO por ferramentas/simular_blackjack.mjs. Não edite à mão.
//
// A vantagem da casa desta mesa saiu de 600.000.000 mãos de estratégia
// básica com o sapato, a carta de corte e todas as regras de regras.js.
// A prova provas/blackjack.mjs roda uma simulação independente e confere que
// o número dela cai a menos de 4 erros padrão deste.

export const VANTAGEM_BLACKJACK = {
  vantagem: 0.0035221058333333335,
  erroPadrao: 0.00004657216382526689,
  variancia: 1.3013798660204987,
  maos: 600000000,
  semente: 20260930,
  gerado: "2026-09-30T16:15:16.590Z",
};

// O seguro é uma aposta à parte: custa metade da aposta e paga 2 para 1 se a
// carta furada da banca valer dez. Com 6 baralhos, tirada a carta aberta da
// banca, sobram 311 cartas e 96 delas valem dez, então a casa fica com
// 1 - 3 x 96/311 de tudo que entra no seguro. Não depende de simulação: é
// aritmética, e a função abaixo refaz a conta para qualquer número de baralhos.
export function vantagemSeguro(nBaralhos = 6) {
  const restantes = 52 * nBaralhos - 1;
  const dezes = 16 * nBaralhos;
  return 1 - 3 * (dezes / restantes);
}

export function varianciaSeguro(nBaralhos = 6) {
  const p = (16 * nBaralhos) / (52 * nBaralhos - 1);
  const media = 3 * p - 1;
  return (4 * p + (1 - p)) - media * media;
}

export const VANTAGEM_SEGURO = vantagemSeguro();
export const VARIANCIA_SEGURO = varianciaSeguro();
