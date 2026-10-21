// Folha do grampeador na mão: os seis níveis em jogo (com o HUD) e a animação de troca de nível
// quadro a quadro, mais a tela do almoxarifado.
//   cd ferramentas && node armas.mjs [pasta]
import fs from 'node:fs';
import path from 'node:path';
import { launch, serve } from './cdp.mjs';
import { folha } from './folha.mjs';

const jogo = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const OUT = process.argv[2] || path.join(jogo, 'fotos', 'armas');
fs.mkdirSync(OUT, { recursive: true });
const NIVEIS = ['L1', 'L2', 'L3C', 'L3I', 'L4C', 'L4I'];
const { srv, url } = await serve(jogo);
const b = await launch({ width: 1280, height: 720 });
const J = (e) => b.eval(`window.__jogo.${e}`);
try {
  await b.goto(`${url}/index.html`);
  await b.eval('window.__TESTE = true');
  await b.waitFor('window.__pronto === true', 90000);
  await J(`diaForcado(['rafael', 'marcia', 'celia'], { celia: ['sombra'] })`);
  // de frente para a janela, olhando o andar
  const olhar = `(() => { const j = window.__jogo.S.jogador; j.pos.set(1.5, 1.62, 5.4); j.yaw = 0.35; j.pitch = -0.08; return 1; })()`;
  const celulas = [];
  for (const id of NIVEIS) {
    await J(`nivel('${id}')`); await b.eval(olhar); await J('avancar(1.2)');
    const f = path.join(OUT, `nivel_${id}.jpg`);
    await b.shot(f, { quality: 88 });
    celulas.push({ arquivo: f, rotulo: `${id} · em jogo` });
  }
  // troca animada L2 -> L3C, quadro a quadro
  await J(`nivel('L2')`); await b.eval(olhar); await J('avancar(1)');
  await J(`nivel('L3C', true)`);
  let t = 0;
  for (const ate of [0.12, 0.25, 0.38, 0.5, 0.65, 1.1]) {
    await J(`avancar(${ate - t})`); t = ate;
    const f = path.join(OUT, `troca_${ate}.jpg`);
    await b.shot(f, { quality: 88 });
    celulas.push({ arquivo: f, rotulo: `troca L2 → L3C · ${ate.toFixed(2)} s` });
  }
  // almoxarifado com verba para os dois ramos
  await J(`nivel('L2')`); await J('darVerba(600)'); await J('almoxarifado()'); await J('avancar(0.5)');
  const fa = path.join(OUT, 'almoxarifado.jpg');
  await b.shot(fa, { quality: 88 });
  celulas.push({ arquivo: fa, rotulo: 'almoxarifado (no nível 2: escolha do ramo)' });
  const saida = path.join(OUT, 'armas.jpg');
  await folha(b, celulas, { colunas: 3, largura: 640, saida, titulo: 'OS FUNCIONÁRIOS · grampeador na mão: 6 níveis, troca animada e almoxarifado' });
  console.log('folha', saida);
  const erros = b.logs.filter(l => /exception/i.test(l.type) || /Uncaught|TypeError|ReferenceError/.test(l.text));
  console.log('ERROS', erros.length, erros.slice(0, 3).map(e => e.text.slice(0, 300)).join('\n'));
} finally { await b.close(); srv.close(); }
