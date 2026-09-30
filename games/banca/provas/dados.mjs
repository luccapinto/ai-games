// Provas da física dos dados do craps: para as 36 combinações, os dados
// simulados param com a face sorteada para cima, dentro da mesa e parados, e
// a renumeração das faces é uma simetria do cubo (a trajetória não muda).

import { bloco, prova, ok, igual, perto, entre, relatar } from './base.mjs';
import { simularLance, amostraLance, faceDeCima, qrot, MESA, PASSO_QUADRO } from '../js/jogos/craps/dados.js';

bloco('craps: física dos dados');

const lances = [];
prova('para as 36 combinações, a face de cima onde o dado parou é a sorteada', () => {
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let s = 1; s <= 4; s++) {
    const l = simularLance([a, b], s * 7777 + a * 13 + b);
    lances.push(l);
    igual(l.faces.join(), `${a},${b}`, `alvo ${a} e ${b}, semente ${s}`);
    ok(l.parou, `os dados não pararam em ${a} e ${b}`);
  }
});

prova('os dados param dentro da mesa, deitados no feltro, em 1 a 4 segundos', () => {
  for (const l of lances) {
    entre(l.duracao, 0.8, 4.5, 'duração');
    const q = l.quadros, f = q.length - PASSO_QUADRO;
    for (const off of [1, 8]) {
      entre(q[f + off], MESA.x0, MESA.x1, 'x final');
      entre(q[f + off + 1], MESA.y0, MESA.y1, 'y final');
      perto(q[f + off + 2], 0.5, 0.02, 'altura final (meia aresta)');
      // a face de cima está alinhada com a vertical, não apoiada numa aresta
      const qq = [q[f + off + 3], q[f + off + 4], q[f + off + 5], q[f + off + 6]];
      const eixos = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]].map(e => qrot(qq, e)[2]);
      ok(Math.max(...eixos) > 0.995, 'dado apoiado numa aresta');
    }
  }
  const comParede = lances.filter(l => l.eventos.some(e => e.tipo === 'parede')).length;
  relatar(`  dados     ${lances.length} lances simulados, todos na face sorteada; ${Math.round(100 * comParede / lances.length)}% batem na parede de pirâmides`);
});

prova('renumerar as faces não muda a trajetória: mesma semente, alvos diferentes, mesmo caminho', () => {
  const x = simularLance([1, 1], 42), y = simularLance([6, 3], 42);
  igual(x.quadros.length, y.quadros.length, 'duração');
  for (let i = 0; i < x.quadros.length; i += PASSO_QUADRO) {
    for (const off of [1, 2, 3, 8, 9, 10]) igual(x.quadros[i + off], y.quadros[i + off], 'posição');
  }
  const a = amostraLance(y, 99);
  igual(faceDeCima(a.dados[0].q), 6, 'amostra final do primeiro dado');
  igual(faceDeCima(a.dados[1].q), 3, 'amostra final do segundo dado');
});
