// Prova visual de cada sinal: um alien com só aquele sinal, ao lado de um humano igual de controle.
//   cd ferramentas && node sinais.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, serve } from './cdp.mjs';
const here = path.dirname(new URL(import.meta.url).pathname);
const jogo = path.dirname(here);
const OUT = process.env.SAIDA || path.join(jogo, 'fotos', 'sinais');
fs.mkdirSync(OUT, { recursive: true });
const { srv, url } = await serve(jogo);
const b = await launch({ width: 960, height: 600 });
const J = (e) => b.eval(`window.__jogo.${e}`);
// sinal -> [quem, como fotografar]
const CASOS = {
  cabeca: ['rafael', { t: 1.3, fase: 5.0, d: 2.6, alt: 1.5, zoom: true }],
  re: ['rafael', { andar: true, t: 0.9, d: 3.2, alt: 0.9, lado: 1.4 }],
  falha: ['rafael', { t: 0.2, fase: 6.44, d: 2.6, alt: 1.1 }],
  olho: ['rafael', { t: 0.2, fase: 0.65, d: 1.2, alt: 1.69, zoom: true }],
  pe: ['rafael', { t: 1, d: 1.6, alt: 0.1, zoom: true }],
  sombra: ['rafael', { t: 1, d: 3.4, alt: 0.6 }],
  bracos: ['rafael', { andar: true, t: 0.5, d: 3.2, alt: 1.0, lado: 1.4 }],
  vapor: ['rafael', { t: 3.4, d: 1.4, alt: 1.6 }],
  caneca: ['marcia', { t: 1, d: 1.6, alt: 0.85, zoom: true }],
  encara: ['rafael', { t: 2.5, d: 2.6, alt: 1.5, encarar: true }],
  costura: ['rafael', { t: 1, d: 0.9, alt: 1.52, zoom: true }],
  foto: ['rafael', { t: 1, d: 1.5, alt: 1.3, cracha: true }],
  nome: ['rafael', { t: 1, d: 1.5, alt: 1.3, cracha: true }],
  pele: ['rafael', { t: 1, d: 1.3, alt: 1.62, zoom: true }],
};
const res = {};
try {
  await b.goto(`${url}/index.html`);
  await b.eval('window.__TESTE = true');
  await b.waitFor('window.__pronto === true', 90000);
  for (const [sinal, [quem, c]] of Object.entries(CASOS)) {
    await J(`diaForcado(['${quem}'], { ${quem}: ['${sinal}'] })`);
    await J(`posicionar('${quem}', 7.6, -2.4, -Math.PI/2)`);
    if (c.andar) await J(`andarPara('${quem}', 7.6, 4.0)`);
    if (c.fase != null) await J(`tempoPessoa('${quem}', ${c.fase})`);
    await J(`avancar(${c.t})`);
    if (c.encarar) { await J(`mirar('${quem}', ${c.d}, ${c.alt})`); await J('avancar(2.0)'); }
    const alvo = await J(`mirar('${quem}', ${c.d}, ${c.alt})`);
    if (c.lado) { const p = (await J('pessoas()'))[0]; await J(`olharPara(${p.x}, ${c.alt}, ${p.z}, ${p.x - 3.2}, ${p.z})`); }
    if (c.zoom) await J('zoom(true)');
    if (c.cracha) { await J('pedirCracha()'); await J('render()'); }
    await b.shot(path.join(OUT, `${sinal}.jpg`), { quality: 85 });
    if (c.zoom) await J('zoom(false)');
    if (c.cracha) await J('fecharCracha()');
    const p = (await J('pessoas()'))[0];
    res[sinal] = { alvo, cracha: p.cracha, sinais: p.sinais };
  }
  console.log(JSON.stringify(res));
  const erros = b.logs.filter(l => /exception/i.test(l.type) || /Uncaught|TypeError|ReferenceError/.test(l.text));
  console.log('ERROS', erros.length, erros.slice(0, 3).map(e => e.text.slice(0, 300)).join('\n'));
} finally { await b.close(); srv.close(); }
