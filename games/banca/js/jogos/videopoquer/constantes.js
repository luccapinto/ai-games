// GERADO por código: enumeração das 2.598.960 mãos iniciais de vídeo pôquer
// com estratégia ótima, via js/jogos/videopoquer/analise.js. Não edite à mão.
//
// Para refazer:
//   const t = construirTabelas({ quadrados: true });
//   rtpOtimo(t, 5)  ->  RTP5, VARIANCIA5
//   rtpOtimo(t, 1)  ->  RTP1A4
//
// A prova provas/videopoquer.mjs recalcula os três números e confere byte a
// byte com os daqui: nenhum deles é digitado à mão.

export const CONSTANTES_VIDEOPOQUER = {
  // Retorno ótimo por moeda apostada, com as cinco moedas (royal a 800).
  RTP5: 0.9954390436921944,
  // Com uma a quatro moedas o royal paga 250 por moeda e o retorno cai.
  RTP1A4: 0.9837345694815705,
  // Variância do resultado por moeda sob estratégia ótima, cinco moedas.
  VARIANCIA5: 19.514676426930933,
  VARIANCIA1A4: 4.926805983011888,
  // Vantagem da casa por moeda: 1 - RTP.
  VANTAGEM5: 0.004560956307805619,
  VANTAGEM1A4: 0.016265430518429547,
  maos: 2598960,
  gerado: "2026-09-30T16:19:31.919Z",
};

export const { RTP5, RTP1A4, VARIANCIA5, VARIANCIA1A4, VANTAGEM5, VANTAGEM1A4 } = CONSTANTES_VIDEOPOQUER;
