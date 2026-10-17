// Capa do jogo: o momento da revelação, com o andar cheio em volta -> capa.jpg
//   cd ferramentas && node capa.mjs
import path from 'node:path';
import { launch, serve } from './cdp.mjs';
const jogo = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const { srv, url } = await serve(jogo);
const b = await launch({ width: 1280, height: 720 });
const J = (e) => b.eval(`window.__jogo.${e}`);
try {
  await b.goto(`${url}/index.html`); await b.eval('window.__TESTE = true');
  await b.waitFor('window.__pronto === true', 90000);
  await J(`diaForcado(['rafael','marcia','bruno','celia','wesley','sandra','paulo','ingrid'], { rafael: ['olho'] })`);
  await J('avancar(8)');
  await J(`posicionar('rafael', 1.2, 1.6, Math.PI * 0.85)`);
  await J(`posicionar('marcia', -0.6, 2.6, Math.PI * 0.7)`);
  await J(`posicionar('bruno', 2.9, 2.9, -Math.PI * 0.8)`);
  await J('avancar(0.6)');
  const pr = (await J('pessoas()')).find(p => p.id === 'rafael'); console.log('rafael', pr.x.toFixed(2), pr.z.toFixed(2));
  await J(`mirar('rafael', 2.3, 1.45)`);
  await b.eval(`document.querySelector('#hud').hidden = true`);
  await J('atirar()'); await J('avancar(0.95)');
  await J(`mirar('rafael', 2.3, 1.5)`); await J(`avancar(0.02)`);
  await b.eval(`document.querySelector('#hud').hidden = true; document.querySelector('#aviso').hidden = true`);
  await b.shot(path.join(jogo, 'capa.jpg'), { quality: 86 });
  console.log('ok');
} finally { await b.close(); srv.close(); }
