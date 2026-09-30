#!/usr/bin/env node
// As provas da BANCA. Rode com: node provas.mjs
//
// Cassino é o gênero em que a palavra "honesto" mais custa barato. Aqui ela
// vale o que as provas abaixo conferem: o SHA-256 bate com o NIST, a roleta
// dá 2,70% em toda aposta, o bacará dá 1,06% / 1,24% / 14,36% por enumeração
// das cartas, o blackjack sai de milhões de mãos com a estratégia básica, o
// caça-níquel é enumerado tira por tira, o vídeo pôquer resolve as 2.598.960
// mãos iniciais, e nenhuma aposta de nenhum jogo favorece o jogador.
//
// Cada bloco mora num arquivo de provas/, e todos importam as mesmas regras
// puras que o navegador executa.
import { readdirSync } from 'node:fs';
import { placar } from './provas/base.mjs';

const t0 = performance.now();
// Ordem fixa para os blocos conhecidos; arquivo novo em provas/ entra no fim
// sozinho, e o robô roda por último porque usa todas as mesas.
const ORDEM = ['nucleo', 'roleta', 'blackjack', 'niquel', 'videopoquer', 'bacara', 'craps', 'dados', 'holdem', 'textos', 'robo'];
const existentes = readdirSync(new URL('./provas/', import.meta.url))
  .filter(f => f.endsWith('.mjs') && f !== 'base.mjs')
  .map(f => f.slice(0, -4));
const todos = [...ORDEM.filter(b => existentes.includes(b)), ...existentes.filter(b => !ORDEM.includes(b)).sort()];
const pedidos = process.argv.slice(2);
for (const b of (pedidos.length ? pedidos : todos)) await import(`./provas/${b}.mjs`);

console.log('\n');
for (const l of placar.linhas) console.log(l);
console.log('');
for (const b of placar.blocos) {
  const s = ((b.fim ?? b.inicio) - b.inicio) / 1000;
  console.log(`  ${b.titulo.padEnd(34)} ${String(b.feitas).padStart(3)} provas  ${s.toFixed(1).padStart(6)} s${b.falhas ? `  ${b.falhas} falharam` : ''}`);
}
console.log(`\n${placar.feitas} provas passaram, ${placar.falhas.length} falharam. (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
for (const f of placar.falhas) console.log(`\n  FALHOU  [${f.bloco}] ${f.nome}\n          ${f.erro.message}`);
console.log('');
if (placar.falhas.length) process.exit(1);
