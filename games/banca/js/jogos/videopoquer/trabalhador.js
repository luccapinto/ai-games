// Trabalhador do vídeo pôquer: um Web Worker de módulo
// (new Worker(url, { type: 'module' })).
//
// Montar as tabelas de subconjuntos custa algumas centenas de milissegundos e
// dezenas de megabytes. Na thread da página isso travaria a animação, então
// tudo mora aqui: a página manda a mão, recebe os 32 valores esperados.
//
// Protocolo:
//   recebe { id, tipo: 'analisar', mao, moedas } -> { id, evs, melhor }
//   recebe { id, tipo: 'rtp', moedas }           -> { id, rtp, variancia, maos, ms }
//   avisa  { tipo: 'pronto', ms } assim que as tabelas ficam de pé.

import { construirTabelas, analisar, rtpOtimo } from './analise.js';

let tabelas = construirTabelas({ quadrados: false });
let comQuadrados = false;

function comVariancia() {
  if (!comQuadrados) {
    tabelas = construirTabelas({ quadrados: true });
    comQuadrados = true;
  }
  return tabelas;
}

self.postMessage({ tipo: 'pronto', ms: tabelas.ms });

self.onmessage = evento => {
  const pedido = evento.data || {};
  const { id, tipo } = pedido;
  try {
    if (tipo === 'analisar') {
      const r = analisar(pedido.mao, tabelas, pedido.moedas);
      self.postMessage({ id, tipo, evs: r.evs, melhor: r.melhor }, [r.evs.buffer]);
      return;
    }
    if (tipo === 'rtp') {
      const r = rtpOtimo(comVariancia(), pedido.moedas);
      self.postMessage({ id, tipo, rtp: r.rtp, variancia: r.variancia, maos: r.maos, ms: r.ms });
      return;
    }
    self.postMessage({ id, tipo, erro: `pedido desconhecido: ${tipo}` });
  } catch (e) {
    self.postMessage({ id, tipo, erro: e.message });
  }
};
