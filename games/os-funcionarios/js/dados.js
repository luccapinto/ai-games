// Dados do jogo: o elenco, o catálogo de sinais de alienígena e a escala dos dias.
// Tudo aqui é dado puro (sem three.js), para os testes lerem sem abrir o navegador.

// ---------------------------------------------------------------- elenco
// base = modelo do pacote (pasta modelos/pessoas). trocas = parte -> modelo doador.
// cores = nome do material -> cor (vale para o corpo inteiro).
// coresParte = { Parte: { material: cor } } quando o mesmo material aparece em duas partes.
// esconder = materiais que somem (o capacete do operário, por exemplo).
// olho = nome do material do olho (muda entre os modelos masculinos e femininos).
export const ELENCO = [
  {
    id: 'marcia', nome: 'Márcia Prado', cargo: 'Analista', depto: 'Contabilidade', genero: 'f',
    base: 'mulher_terno', olho: 'Brown', altura: 1.66, caneca: true,
    cores: { Black: '#6e2a3e', Hair_Blond: '#3a2416', Hair_Brown: '#24160d', Skin: '#e0b18e' },
  },
  {
    id: 'jorge', nome: 'Jorge Batista', cargo: 'Chefe de Manutenção', depto: 'Manutenção', genero: 'm',
    base: 'operario', olho: 'Eye', altura: 1.72,
    trocas: { Body: 'executivo', Legs: 'executivo', Feet: 'executivo' },
    esconder: ['Worker_Yellow'],
    cores: { Suit: '#5f6a5a', Tie: '#7a2f2f', Skin: '#8a5a3c', Moustache: '#cfcac4', Eyebrows: '#bdb7b0' },
  },
  {
    id: 'bruno', nome: 'Bruno Tavares', cargo: 'Suporte', depto: 'TI', genero: 'm',
    base: 'executivo', olho: 'Eye', altura: 1.80, caneca: true,
    trocas: { Head: 'casual' },
    cores: { Suit: '#2f3b4c', Tie: '#c9a227', Hair: '#1c1712', Skin: '#c68c64', Skin_Darker: '#a8714e' },
  },
  {
    id: 'celia', nome: 'Célia Monteiro', cargo: 'Gerente', depto: 'RH', genero: 'f',
    base: 'mulher_social', olho: 'Brown', altura: 1.60, caneca: true,
    cores: { LimeGreen: '#7b5a8c', Skin: '#e8c3a0', Gold: '#c9a227' },
    coresParte: { Head: { Red: '#c9c3bd' }, Feet: { Red: '#3a2a22' } },
  },
  {
    id: 'rafael', nome: 'Rafael Duarte', cargo: 'Tesoureiro', depto: 'Financeiro', genero: 'm',
    base: 'executivo', olho: 'Eye', altura: 1.78,
    cores: { Suit: '#1f2a44', Tie: '#a3242c', Hair: '#5a3a1e', Skin: '#d9a77f' },
  },
  {
    id: 'sandra', nome: 'Sandra Lopes', cargo: 'Diretora', depto: 'Diretoria', genero: 'f',
    base: 'mulher_social', olho: 'Brown', altura: 1.70,
    cores: { LimeGreen: '#27365a', Skin: '#8d5a3b', Gold: '#d8d8d8' },
    coresParte: { Head: { Red: '#1a1512' }, Feet: { Red: '#1a1512' } },
  },
  {
    id: 'wesley', nome: 'Wesley Rocha', cargo: 'Estoquista', depto: 'Almoxarifado', genero: 'm',
    base: 'moletom', olho: 'Eye', altura: 1.75,
    cores: { Purple: '#2f5d50', Hair: '#121010', Skin: '#6b4630' },
  },
  {
    id: 'ingrid', nome: 'Ingrid Sales', cargo: 'Auditora', depto: 'Compliance', genero: 'f',
    base: 'mulher_casual', olho: 'Brown', altura: 1.68, caneca: true,
    cores: { White: '#d9dee6', Orange: '#3b4252', Hair_Blond: '#d8b46a', Skin: '#f0cfb4', Grey: '#2b2b30' },
  },
  {
    id: 'paulo', nome: 'Paulo Nunes', cargo: 'Vendedor', depto: 'Comercial', genero: 'm',
    base: 'casual', olho: 'Eye', altura: 1.74,
    cores: { LightBrown: '#7a3b2e', Hair: '#3b2a1d', Skin: '#b07650', Skin_Darker: '#94603f' },
  },
  {
    id: 'tati', nome: 'Tatiana Reis', cargo: 'Designer', depto: 'Marketing', genero: 'f',
    base: 'mulher_casual', olho: 'Brown', altura: 1.63, caneca: true,
    trocas: { Head: 'mulher_punk' },
    cores: { White: '#f2c14e', Orange: '#2b2b33', Pink: '#a8324a', Skin: '#c99470', Grey: '#2b2b30' },
  },
  {
    id: 'edson', nome: 'Edson Carvalho', cargo: 'Advogado', depto: 'Jurídico', genero: 'm',
    base: 'executivo', olho: 'Eye', altura: 1.70,
    trocas: { Head: 'moletom' },
    cores: { Suit: '#3a3a3e', Tie: '#2d5a8c', Hair: '#7a7a7a', Skin: '#e2b48f' },
  },
  {
    id: 'lucia', nome: 'Lúcia Fontes', cargo: 'Recepcionista', depto: 'Recepção', genero: 'f',
    base: 'mulher_terno', olho: 'Brown', altura: 1.64, caneca: true,
    cores: { Black: '#2c4a6e', Hair_Blond: '#7a4a26', Hair_Brown: '#3d2412', Skin: '#a86f4c' },
  },
];

// ---------------------------------------------------------------- sinais
// nivel: 'obvia' (dá para ver andando pela sala), 'media' (precisa prestar atenção),
// 'sutil' (só com o zoom do examinador, de perto).
export const SINAIS = [
  { id: 'cabeca', nome: 'Gira a cabeça além do limite', nivel: 'obvia',
    dica: 'A cada poucos segundos vira a cabeça quase toda para trás.' },
  { id: 're', nome: 'Anda de ré', nivel: 'obvia',
    dica: 'Anda de costas pelo escritório, como um filme rebobinando.' },
  { id: 'falha', nome: 'Falha na imagem', nivel: 'obvia',
    dica: 'De tempos em tempos pisca, treme para o lado e muda de cor.' },
  { id: 'olho', nome: 'Olhos brilhando verde', nivel: 'media',
    dica: 'Os olhos acendem verde de tempos em tempos.' },
  { id: 'pe', nome: 'Pé virado para trás', nivel: 'media',
    dica: 'A perna direita é torcida no joelho: o sapato aponta para trás.' },
  { id: 'sombra', nome: 'Não tem sombra', nivel: 'media',
    dica: 'Não há sombra debaixo dos pés, nem da luz do teto nem da janela.' },
  { id: 'bracos', nome: 'Anda sem balançar os braços', nivel: 'media',
    dica: 'Anda muito, com os braços duros e um pouco abertos, sem balançar.' },
  { id: 'vapor', nome: 'Respira vapor gelado', nivel: 'media',
    dica: 'Sai fumaça branca da boca, com o ar-condicionado desligado.' },
  { id: 'caneca', nome: 'Caneca de cabeça para baixo', nivel: 'media', requer: 'caneca',
    dica: 'Carrega o café de boca para baixo, e não cai nada.' },
  { id: 'encara', nome: 'Encara de volta', nivel: 'media',
    dica: 'De vez em quando para tudo, vira o corpo e fica encarando você.' },
  { id: 'costura', nome: 'Costura no pescoço', nivel: 'sutil',
    dica: 'Uma cicatriz costurada em volta do pescoço, logo abaixo do queixo.' },
  { id: 'foto', nome: 'Foto do crachá não confere', nivel: 'sutil',
    dica: 'O cabelo da foto do crachá é de outra cor que o da ficha do RH.' },
  { id: 'nome', nome: 'Nome errado no crachá', nivel: 'sutil',
    dica: 'O nome do crachá tem uma letra trocada: compare com a ficha do RH.' },
  { id: 'pele', nome: 'Pele molhada', nivel: 'sutil',
    dica: 'A pele brilha como se estivesse molhada.' },
];
export const SINAL = Object.fromEntries(SINAIS.map(s => [s.id, s]));

// Ritmo dos sinais que vão e voltam (segundos). Cada alien tem a sua fase.
// ciclo = de quanto em quanto tempo o sinal volta; dura = quanto tempo ele fica à mostra.
export const RITMO = {
  cabeca: { ciclo: 6, dura: 2.8 },     // antes: 2 s a cada 9 s
  olho: { ciclo: 4, dura: 1.6 },       // antes: 0,7 s a cada 6,5 s
  falha: { ciclo: 4.5, dura: 0.75 },   // antes: 0,15 s a cada 7 s
  vapor: { ciclo: 1.6, dura: 1.2 },    // uma baforada a cada 1,6 s (antes 2,4 a 3,4 s)
  encara: { ciclo: 9, dura: 3.2 },     // encara sozinho, além de quando é encarado (antes só quando encarado)
};
// Quem anda de ré ou sem balançar os braços só mostra o sinal andando: fica pouco na mesa.
export const PARADO = { mesa: [10, 28], outro: [4, 11], andarilho: { mesa: [6, 12], outro: [3, 7] } };

// ---------------------------------------------------------------- dias
// segundos = duração do expediente (09h às 18h).
export const DIAS = [
  { n: 1, pessoas: 6, aliens: 1, sinais: 2, niveis: ['obvia', 'media'], segundos: 240, iscas: 1 },
  { n: 2, pessoas: 7, aliens: 1, sinais: 1, niveis: ['obvia', 'media'], segundos: 240, iscas: 2 },
  { n: 3, pessoas: 8, aliens: 2, sinais: 1, niveis: ['media'], segundos: 270, iscas: 2 },
  { n: 4, pessoas: 9, aliens: 2, sinais: 1, niveis: ['media', 'sutil'], segundos: 300, iscas: 2 },
  { n: 5, pessoas: 10, aliens: 3, sinais: 1, niveis: ['obvia', 'media', 'sutil'], segundos: 330, iscas: 2 },
];
export const FALHAS_MAX = 3;
export const PONTOS = { alien: 100, inocente: -150, fuga: -50, porMinutoSobrando: 20 };

// ---------------------------------------------------------------- sorteio
export function rng(semente) {               // mulberry32
  let a = semente >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const embaralhar = (r, arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// Monta o dia: quem vem, quem é alienígena, que sinais cada um tem e o memorando do RH.
export function sortearDia(nDia, semente) {
  const d = DIAS[nDia - 1];
  const r = rng(semente * 7919 + nDia * 104729);
  const presentes = embaralhar(r, ELENCO).slice(0, d.pessoas);
  const aliens = embaralhar(r, presentes).slice(0, d.aliens).map(p => p.id);
  const usados = new Set();
  const sinaisDe = {};
  for (const id of aliens) {
    const pessoa = ELENCO.find(p => p.id === id);
    const pool = embaralhar(r, SINAIS.filter(s => d.niveis.includes(s.nivel) &&
      (!s.requer || pessoa[s.requer]) && !usados.has(s.id)));
    sinaisDe[id] = pool.slice(0, d.sinais).map(s => s.id);
    sinaisDe[id].forEach(s => usados.add(s));
  }
  const iscas = embaralhar(r, SINAIS.filter(s => !usados.has(s.id) && d.niveis.includes(s.nivel)))
    .slice(0, d.iscas).map(s => s.id);
  const memorando = embaralhar(r, [...usados, ...iscas]);
  return { dia: d, presentes: presentes.map(p => p.id), aliens, sinaisDe, memorando, iscas };
}

// Erros de digitação para o sinal "nome errado no crachá": troca uma letra por outra de desenho
// diferente, que se lê também em maiúscula (o painel do crachá compara os nomes em maiúsculas).
// Pares quase iguais em fonte sem serifa (i/l, c/e, u/v) ficaram de fora: o jogador passava batido.
const PARECIDAS = { a: 'o', o: 'u', e: 'a', i: 'e', l: 't', r: 'n', n: 'm', u: 'o', s: 'z', d: 't', t: 'd', m: 'n', c: 'g', g: 'c', b: 'd', y: 'i', f: 't', p: 'b', w: 'v' };
export function nomeErrado(nome, r = Math.random) {
  const primeiro = nome.split(' ')[0];
  const idx = [];
  for (let i = 1; i < primeiro.length; i++) if (PARECIDAS[primeiro[i].toLowerCase()]) idx.push(i);
  const i = idx[Math.floor(r() * idx.length)] ?? 1;
  const c = PARECIDAS[primeiro[i].toLowerCase()] || 'x';
  return primeiro.slice(0, i) + c + primeiro.slice(i + 1) + nome.slice(primeiro.length);
}
