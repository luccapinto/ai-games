// Os numeros do sertao. Ficam num arquivo so porque `mundo.js` precisa deles
// para gerar (quantas vilas, a que distancia) e `jogo.js` para simular (sede,
// velocidade, dano), e um dos dois importa o outro.

export const CONFIG = {
  largura: 256,
  altura: 256,

  vilas: 5,
  distanciaMinimaEntreVilas: 52,

  // Corpo. Sede e um relogio de 100 segundos ao meio-dia parado — andar e
  // correr custam mais, e a madrugada custa menos da metade.
  vidaMaxima: 100,
  sedeMaxima: 100,
  sedePorSegundo: 0.62,
  sedeAndando: 0.3,
  sedeCorrendo: 0.78,
  sedeDeCalor: 0.55,
  danoDeSede: 1.4,
  cura: 0.9,

  velocidade: 3.4,
  velocidadeCorrendo: 5.6,
  velocidadeEstrada: 1.28,
  velocidadeMata: 0.72,
  raioJogador: 0.32,

  // O dia inteiro em oito minutos: tempo bastante para a luz virar informacao
  // (de madrugada se anda mais longe com o mesmo cantil) sem virar espera.
  duracaoDoDia: 480,
  horaDoNascer: 5.5,
  horaDoPor: 18.5,

  alcanceFala: 2.2,
  alcanceBebida: 1.6,
  alcanceColeta: 1.1,

  moedasIniciais: 12,
};

// Gerador congruente linear. Mundo gerado sem semente nao se prova: a prova
// precisa poder pedir o mesmo mundo duas vezes.
export function criarSorteio(semente = 1) {
  let estado = (semente | 0) || 1;
  return () => {
    estado = (estado * 1103515245 + 12345) & 0x7fffffff;
    return estado / 0x7fffffff;
  };
}
