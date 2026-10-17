// Abre o jogo no Chrome sem cabeça, joga um pouco por API e tira fotos -> ../../out/jogo/
//   cd ferramentas && node olhar.mjs [tag]
import fs from 'node:fs';
import path from 'node:path';
import { launch, serve } from './cdp.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const jogo = path.dirname(here);
const OUT = process.env.SAIDA || path.join(jogo, 'fotos');
fs.mkdirSync(OUT, { recursive: true });
const tag = process.argv[2] || 'a';
const { srv, url } = await serve(jogo);
const b = await launch({ width: 1280, height: 720 });
const shot = (n) => b.shot(path.join(OUT, `${n}_${tag}.jpg`), { quality: 85 });
const J = (e) => b.eval(`window.__jogo.${e}`);
try {
  await b.eval('window.__TESTE = true');
  await b.goto(`${url}/index.html`);
  await b.eval('window.__TESTE = true');
  await b.waitFor('window.__pronto === true', 90000);
  await b.eval('window.__jogo.avancar(1)');
  await shot('titulo');
  const plano = await J('novoJogo(7)');
  console.log('plano', JSON.stringify({ aliens: plano.aliens, sinais: plano.sinaisDe, memo: plano.memorando }));
  await shot('memorando');
  await J('comecar()');
  await J('avancar(6)');
  await shot('jogo_inicio');
  await J('olharPara(0, 1.0, 0, 0, 6.2)'); await shot('jogo_sala');
  await J('avancar(20)');
  const ps = await J('pessoas()');
  console.log('pessoas', JSON.stringify(ps.map(p => [p.id, p.alien, p.sinais.join('+'), p.x.toFixed(1), p.z.toFixed(1)])));
  const humano = ps.find(p => !p.alien), alien = ps.find(p => p.alien);
  console.log('mira humano', await J(`mirar('${humano.id}', 2.4)`)); await shot('humano');
  console.log('cracha', await J('pedirCracha()')); await J('avancar(0.5)'); await shot('cracha');
  await J('fecharCracha()');
  console.log('mira alien', await J(`mirar('${alien.id}', 2.4)`));
  await J('zoom(true)'); await shot('alien_zoom'); await J('zoom(false)');
  console.log('tiro', JSON.stringify(await J('atirar()')));
  await J('avancar(0.6)'); await shot('revelacao_06');
  await J('avancar(1.4)'); await shot('revelacao_20');
  console.log('info', JSON.stringify(await J('info()')));
  console.log('tiro inocente', JSON.stringify(await (async () => { await J(`mirar('${humano.id}', 2.4)`); return J('atirar()'); })()));
  await J('avancar(1.5)'); await shot('inocente');
  await J('avancar(3)');
  console.log('tela', await J('tela()'));
  await shot('depois');
  const erros = b.logs.filter(l => /exception|error/i.test(l.type) || /Uncaught|TypeError|ReferenceError/.test(l.text));
  console.log('ERROS', erros.length, erros.slice(0, 5).map(e => e.text.slice(0, 300)).join('\n'));
} finally { await b.close(); srv.close(); }
