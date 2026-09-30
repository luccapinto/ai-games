// O catálogo das mesas do salão: nome, a tese de cada uma em uma linha e o
// módulo que monta a mesa. Os números da placa (vantagem, RTP) não moram
// aqui: cada mesa exporta os seus, calculados pelas próprias regras.

export const MESAS = [
  { id: 'roleta', nome: 'Roleta', tese: 'Um zero, trinta e sete casas e a mesma conta em toda aposta.', modulo: './jogos/roleta/mesa.js' },
  { id: 'blackjack', nome: 'Blackjack', tese: 'O único jogo da casa em que a sua decisão mexe na vantagem.', modulo: './jogos/blackjack/mesa.js' },
  { id: 'niquel', nome: 'Malecón 57', tese: 'Cinco rolos, vinte e cinco linhas, enumerado tira por tira.', modulo: './jogos/niquel/mesa.js' },
  { id: 'videopoquer', nome: 'Vídeo pôquer', tese: 'Jacks or Better 9/6: quase justo, se você jogar perfeito.', modulo: './jogos/videopoquer/mesa.js' },
  { id: 'bacara', nome: 'Bacará', tese: 'Nenhuma decisão, três apostas, e uma delas é um assalto.', modulo: './jogos/bacara/mesa.js' },
  { id: 'craps', nome: 'Craps', tese: 'A mesa mais assustadora esconde a melhor aposta do cassino.', modulo: './jogos/craps/mesa.js' },
  { id: 'caixa', nome: 'Caixa', tese: 'O Livro da Casa, o crédito e as sementes da aleatoriedade.', modulo: null },
];

export const MESA_POR_ID = Object.fromEntries(MESAS.map(m => [m.id, m]));
