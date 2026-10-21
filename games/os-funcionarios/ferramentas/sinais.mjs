// Prova visual de cada sinal na distância de jogo, com um humano de controle ao lado.
//   cd ferramentas && node sinais.mjs                 # semente 1, imprime quem era o alien
//   CEGO=1 SEMENTE=7 node sinais.mjs [pasta]          # prova cega: a verdade vai só para verdade.json
// Sinais "visível de longe" e "preste atenção": uma foto a 2,5 m, sem zoom, com os dois lado a lado.
// Sinais "só de perto": uma foto de cada pessoa (A e B) a 1,5 m com o zoom do examinador
// (crachá: o painel de comparação aberto). A semente sorteia a dupla e quem é o alien.
import fs from 'node:fs';
import path from 'node:path';
import { launch, serve } from './cdp.mjs';
import { folha } from './folha.mjs';
import { ELENCO, SINAIS, SINAL, rng, embaralhar } from '../js/dados.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const jogo = path.dirname(here);
const OUT = process.argv[2] || process.env.SAIDA || path.join(jogo, 'fotos', 'sinais');
const SEMENTE = +(process.env.SEMENTE || 1);
const CEGO = process.env.CEGO === '1';
fs.mkdirSync(OUT, { recursive: true });

// como fotografar cada sinal. t = tempo interno das duas pessoas antes de avançar `avanca` s
// (põe os sinais que vão e voltam no meio do ciclo); alt = altura para onde a câmera olha
const CASOS = {
  cabeca: { t: 3.2, avanca: 1.5, alt: 1.3 },
  re: { anda: true, avanca: 1.3, alt: 0.9 },
  falha: { t: 3.34 - 1 / 30, avanca: 1 / 30, alt: 1.0 },
  olho: { t: 0.8 - 1 / 30, avanca: 1 / 30, alt: 1.35 },
  pe: { alt: 0.5 },
  sombra: { alt: 0.6 },
  bracos: { anda: true, avanca: 1.1, alt: 0.9 },
  vapor: { vapor: true, avanca: 0.7, alt: 1.35 },
  caneca: { alt: 1.0 },
  encara: { t: 5.8, avanca: 1.4, alt: 1.2, yaw: 0 },
  costura: { perto: true, osso: 'Neck' },
  foto: { perto: true, cracha: true, osso: 'Chest' },
  nome: { perto: true, cracha: true, osso: 'Chest' },
  pele: { perto: true, osso: 'Head' },
};

const r = rng(SEMENTE * 7717 + 3);
const sorteio = {};
for (const s of SINAIS) {
  const pode = ELENCO.filter(e => !s.requer || e[s.requer]);
  const [x, y] = embaralhar(r, pode);
  sorteio[s.id] = r() < 0.5 ? { alien: x.id, controle: y.id } : { alien: y.id, controle: x.id };
}

const { srv, url } = await serve(jogo);
const b = await launch({ width: 1280, height: 720 });
const J = (e) => b.eval(`window.__jogo.${e}`);
const verdade = {}, celulas = [];
try {
  await b.goto(`${url}/index.html`);
  await b.eval('window.__TESTE = true');
  await b.waitFor('window.__pronto === true', 90000);
  for (const s of SINAIS) {
    const c = CASOS[s.id], { alien, controle } = sorteio[s.id];
    // a ordem na fila também é sorteada: a primeira fica numa ponta, a segunda na outra
    const fila = r() < 0.5 ? [alien, controle] : [controle, alien];
    await J(`diaForcado(${JSON.stringify(fila)}, { ${alien}: ['${s.id}'] })`);
    if (c.anda) {
      // andando lado a lado (um à frente do outro na mesma linha), vistos de lado a 2,5 m
      await J(`posicionar('${fila[0]}', 8.2, -2.4, -Math.PI/2)`); await J(`posicionar('${fila[1]}', 6.6, -2.4, -Math.PI/2)`);
      await J(`andarPara('${fila[0]}', 4.4, -2.4)`); await J(`andarPara('${fila[1]}', 2.8, -2.4)`);
    } else {
      const yaw = c.yaw ?? -Math.PI / 2;
      await J(`posicionar('${fila[0]}', 7.5, -2.95, ${yaw})`); await J(`posicionar('${fila[1]}', 7.5, -1.85, ${yaw})`);
    }
    if (c.t != null) for (const id of fila) await J(`tempoPessoa('${id}', ${c.t})`);
    if (c.vapor) await b.eval(`(window.__jogo.pessoa('${alien}')._vapor = 0, 1)`);
    await J(`avancar(${c.avanca ?? 0.5})`);
    if (!c.perto) {
      if (c.anda) await J(`olharPara(6.2, ${c.alt}, -2.4, 6.2, -4.9)`);
      else await J(`olharPara(7.5, ${c.alt}, -2.4, 5.0, -2.4)`);
      const xs = await Promise.all(fila.map(id => J(`naTela('${id}')`)));
      const lado = xs[fila.indexOf(alien)] < xs[fila.indexOf(controle)] ? 'esquerda' : 'direita';
      verdade[s.id] = lado;
      const f = path.join(OUT, `${s.id}.jpg`);
      await J('render()'); await b.shot(f, { quality: 88 });
      celulas.push({ arquivo: f, rotulo: `${s.id} · ${s.nivel} · esquerda ou direita?` });
    } else {
      // uma foto de cada um, A e B, na ordem da fila
      for (const [i, id] of fila.entries()) {
        const p = await b.eval(`(() => { const p = window.__jogo.pessoa('${id}'); const o = p.ossos['${c.osso}'].getWorldPosition(p.pos.clone()); return { x: o.x, y: o.y, z: o.z }; })()`);
        await J(`olharPara(${p.x}, ${p.y}, ${p.z}, ${p.x - 1.5}, ${p.z})`);
        if (c.cracha) { await J('pedirCracha()'); await J('avancar(0.05)'); }
        else { await J('zoom(true)'); await J('avancar(0.4)'); }
        const f = path.join(OUT, `${s.id}_${'AB'[i]}.jpg`);
        await J('render()'); await b.shot(f, { quality: 88 });
        celulas.push({ arquivo: f, rotulo: `${s.id} · ${s.nivel} · ${'AB'[i]}` });
        if (c.cracha) await J('fecharCracha()'); else await J('zoom(false)');
      }
      verdade[s.id] = 'AB'[fila.indexOf(alien)];
    }
  }
  fs.writeFileSync(path.join(OUT, 'verdade.json'), JSON.stringify({ semente: SEMENTE, verdade, sorteio }, null, 1));
  await folha(b, celulas, { colunas: 4, largura: 480, saida: path.join(OUT, 'folha.jpg'),
    titulo: `Sinais na distância de jogo · semente ${SEMENTE} · 2,5 m sem zoom (longe/atenção) · 1,5 m com zoom (perto)` });
  console.log('folha', path.join(OUT, 'folha.jpg'));
  if (!CEGO) console.log(JSON.stringify(Object.fromEntries(Object.entries(verdade).map(([k, v]) => [k, `${v} (${sorteio[k].alien})`]))));
  const erros = b.logs.filter(l => /exception/i.test(l.type) || /Uncaught|TypeError|ReferenceError/.test(l.text));
  console.log('ERROS', erros.length, erros.slice(0, 3).map(e => e.text.slice(0, 300)).join('\n'));
} finally { await b.close(); srv.close(); }
