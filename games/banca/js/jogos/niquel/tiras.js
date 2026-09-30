// MALECÓN 57: as tiras, as linhas e a tabela de prêmios.
//
// Este arquivo é só dado: nenhum número aqui é calculado, e nenhum número aqui
// é uma vantagem da casa. O RTP sai da enumeração em regras.js, e muda se uma
// linha destas mudar. As provas conferem o RTP, o espaçamento das luas e a
// distribuição de cada símbolo.
//
// Cinco rolos com 41 a 46 paradas. A janela mostra três símbolos por rolo: as
// paradas (p, p+1, p+2) da tira, em ciclo. A linha 0 é a de cima.

export const SIMBOLOS = [
  { id: 'casa', nome: 'A Casa', tipo: 'curinga' },
  { id: 'lua', nome: 'Lua de Havana', tipo: 'disperso' },
  { id: 'flamingo', nome: 'Flamingo', tipo: 'alto' },
  { id: 'trompete', nome: 'Trompete', tipo: 'alto' },
  { id: 'conversivel', nome: 'Conversível', tipo: 'alto' },
  { id: 'coquetel', nome: 'Daiquiri', tipo: 'medio' },
  { id: 'maraca', nome: 'Maraca', tipo: 'medio' },
  { id: 'palmeira', nome: 'Palmeira', tipo: 'medio' },
  { id: 'espadas', nome: 'Espadas', tipo: 'baixo' },
  { id: 'copas', nome: 'Copas', tipo: 'baixo' },
  { id: 'ouros', nome: 'Ouros', tipo: 'baixo' },
  { id: 'paus', nome: 'Paus', tipo: 'baixo' },
];

export const IDS = SIMBOLOS.map(s => s.id);
export const INDICE = Object.fromEntries(IDS.map((id, i) => [id, i]));
export const CURINGA = 'casa';
export const DISPERSO = 'lua';

export const ROLOS = 5;
export const FILAS = 3;

export const TIRAS = [
  // rolo 1: 45 paradas
  [
    'trompete', 'coquetel', 'paus', 'trompete', 'ouros', 'copas',
    'palmeira', 'conversivel', 'paus', 'coquetel', 'flamingo', 'lua',
    'ouros', 'espadas', 'maraca', 'casa', 'ouros', 'casa',
    'ouros', 'paus', 'copas', 'espadas', 'flamingo', 'coquetel',
    'paus', 'conversivel', 'flamingo', 'coquetel', 'palmeira', 'espadas',
    'conversivel', 'maraca', 'espadas', 'ouros', 'palmeira', 'maraca',
    'copas', 'flamingo', 'trompete', 'copas', 'maraca', 'palmeira',
    'trompete', 'paus', 'conversivel',
  ],
  // rolo 2: 45 paradas
  [
    'espadas', 'coquetel', 'ouros', 'maraca', 'paus', 'conversivel',
    'espadas', 'flamingo', 'paus', 'trompete', 'ouros', 'maraca',
    'copas', 'flamingo', 'espadas', 'coquetel', 'casa', 'paus',
    'palmeira', 'copas', 'ouros', 'maraca', 'espadas', 'copas',
    'conversivel', 'coquetel', 'paus', 'maraca', 'coquetel', 'flamingo',
    'copas', 'espadas', 'palmeira', 'ouros', 'palmeira', 'trompete',
    'casa', 'ouros', 'conversivel', 'copas', 'paus', 'palmeira',
    'conversivel', 'lua', 'trompete',
  ],
  // rolo 3: 45 paradas
  [
    'casa', 'espadas', 'maraca', 'coquetel', 'copas', 'ouros',
    'palmeira', 'espadas', 'trompete', 'copas', 'conversivel', 'coquetel',
    'paus', 'maraca', 'copas', 'casa', 'palmeira', 'flamingo',
    'palmeira', 'paus', 'flamingo', 'paus', 'flamingo', 'ouros',
    'paus', 'espadas', 'palmeira', 'maraca', 'lua', 'copas',
    'espadas', 'ouros', 'trompete', 'ouros', 'flamingo', 'ouros',
    'conversivel', 'coquetel', 'conversivel', 'maraca', 'conversivel', 'trompete',
    'paus', 'trompete', 'coquetel',
  ],
  // rolo 4: 41 paradas
  [
    'trompete', 'palmeira', 'casa', 'maraca', 'trompete', 'flamingo',
    'ouros', 'paus', 'trompete', 'maraca', 'coquetel', 'ouros',
    'conversivel', 'paus', 'flamingo', 'coquetel', 'espadas', 'copas',
    'paus', 'palmeira', 'ouros', 'coquetel', 'paus', 'copas',
    'casa', 'ouros', 'conversivel', 'espadas', 'copas', 'paus',
    'flamingo', 'espadas', 'maraca', 'copas', 'conversivel', 'espadas',
    'lua', 'palmeira', 'casa', 'copas', 'ouros',
  ],
  // rolo 5: 46 paradas
  [
    'casa', 'trompete', 'palmeira', 'conversivel', 'flamingo', 'coquetel',
    'ouros', 'casa', 'paus', 'flamingo', 'casa', 'paus',
    'palmeira', 'espadas', 'copas', 'trompete', 'paus', 'casa',
    'coquetel', 'maraca', 'ouros', 'trompete', 'copas', 'conversivel',
    'copas', 'palmeira', 'espadas', 'coquetel', 'flamingo', 'coquetel',
    'palmeira', 'maraca', 'ouros', 'paus', 'maraca', 'espadas',
    'conversivel', 'ouros', 'paus', 'copas', 'ouros', 'maraca',
    'lua', 'paus', 'espadas', 'ouros',
  ],
];

// 25 linhas fixas. Cada linha diz a FILA visitada em cada rolo (0 é a de cima).
export const LINHAS = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 2, 2, 2, 1],
  [1, 0, 0, 0, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [1, 2, 1, 0, 1],
  [1, 0, 1, 2, 1],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [1, 1, 0, 1, 1],
  [1, 1, 2, 1, 1],
  [0, 0, 1, 0, 0],
  [2, 2, 1, 2, 2],
  [0, 2, 0, 2, 0],
  [2, 0, 2, 0, 2],
  [1, 0, 2, 0, 1],
  [1, 2, 0, 2, 1],
  [0, 2, 2, 2, 0],
  [2, 0, 0, 0, 2],
];

// Prêmio de linha em múltiplos da APOSTA DE LINHA, para 3, 4 e 5 iguais da
// esquerda para a direita a partir do rolo 1.
export const TABELA = {
  casa: [75, 500, 2500],
  flamingo: [50, 250, 1000],
  trompete: [40, 200, 750],
  conversivel: [30, 150, 600],
  coquetel: [25, 100, 400],
  maraca: [20, 80, 300],
  palmeira: [15, 60, 240],
  espadas: [10, 40, 175],
  copas: [8, 30, 125],
  ouros: [5, 25, 100],
  paus: [5, 25, 100],
};

// A lua paga em múltiplos da APOSTA TOTAL, em qualquer posição das quinze.
export const TABELA_DISPERSO = { 3: 2, 4: 10, 5: 50 };

// Giros grátis: quantos a lua dá, e por quanto os prêmios são multiplicados.
// Uma lua a mais durante os giros grátis soma mais giros (retrigger).
export const GIROS_GRATIS = { 3: 8, 4: 12, 5: 20, multiplicador: 3 };

// Aposta por linha, em centavos. São sempre as 25 linhas.
export const APOSTAS_LINHA = [1, 2, 5, 10, 20, 50, 100];
