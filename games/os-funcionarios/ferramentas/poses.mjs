// Varredura das animações: seis pessoas lado a lado em cada animação usada pelo jogo, de frente,
// de lado e de costas, nos dois esqueletos e nas cabeças trocadas. Sai uma folha de contato por grupo.
//   cd ferramentas && node poses.mjs [pasta]
import fs from 'node:fs';
import path from 'node:path';
import { launch, serve } from './cdp.mjs';
import { folha } from './folha.mjs';

const jogo = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const OUT = process.argv[2] || path.join(jogo, 'fotos', 'poses');
fs.mkdirSync(OUT, { recursive: true });
const GRUPOS = {
  corpos: ['rafael', 'paulo', 'wesley', 'marcia', 'celia', 'ingrid'],            // os 3 corpos de cada esqueleto
  cabecas: ['jorge', 'bruno', 'edson', 'tati', 'sandra', 'lucia'],              // cabeças trocadas e o resto
};
// animação -> pontos do clipe (0..1) e se a pessoa "anda" (para os sinais/caneca)
const ANIMS = [
  ['Idle', 0.3], ['Idle_Neutral', 0.3], ['Interact', 0.45], ['Walk', 0.25, true], ['Walk', 0.75, true], ['Run', 0.3, true],
  ['Punch_Right', 0.45], ['HitRecieve', 0.4], ['HitRecieve_2', 0.4], ['Death', 1.0], ['Wave', 0.4],
];
const VISTAS = [['frente', 0], ['lado', Math.PI / 2], ['costas', Math.PI]];
const { srv, url } = await serve(jogo);
const b = await launch({ width: 1280, height: 720 });
const J = (e) => b.eval(`window.__jogo.${e}`);
try {
  await b.goto(`${url}/index.html`);
  await b.eval('window.__TESTE = true');
  await b.waitFor('window.__pronto === true', 90000);
  const todas = [];
  for (const [grupo, ids] of Object.entries(GRUPOS)) {
    // um "alien" só com o sinal sem sombra, para o dia não terminar como "andar limpo"
    await J(`diaForcado(${JSON.stringify(ids)}, { ${ids[5]}: ['sombra'] })`);
    await b.eval(`(document.querySelector('#hud').hidden = true, window.__jogo.S.semArma = true, 1)`);
    const celulas = [];
    for (const [anim, frac, andando] of ANIMS) for (const [vista, yaw] of VISTAS) {
      for (let i = 0; i < ids.length; i++) await J(`pose('${ids[i]}', '${anim}', ${frac}, ${-2.5 + i}, 4.1, ${yaw}, ${!!andando})`);
      await J('avancar(0.6)');        // deixa os ajustes procedurais (caneca, olhar) assentarem
      await b.eval(`(() => { const j = window.__jogo.S.jogador; j.pos.set(0, 1.3, 6.6); j.yaw = 0; j.pitch = Math.atan2(0.9 - 1.3, 2.5); return 1; })()`);
      await J('avancar(1/30)');
      const f = path.join(OUT, `${grupo}_${anim}_${frac}_${vista}.jpg`);
      await b.shot(f, { quality: 85 });
      celulas.push({ arquivo: f, rotulo: `${anim} ${frac} · ${vista}` });
    }
    await folha(b, celulas, { colunas: 3, largura: 640, saida: path.join(OUT, `poses_${grupo}.jpg`), titulo: `${grupo}: ${ids.join(', ')}` });
    console.log('folha', path.join(OUT, `poses_${grupo}.jpg`));
    todas.push(...celulas.map(c => ({ ...c, rotulo: `${grupo} · ${c.rotulo}` })));
  }
  // trabalhando na mesa: mãos no teclado (quem tem caneca digita com a esquerda)
  {
    const ids = ['marcia', 'bruno', 'rafael', 'sandra', 'celia', 'wesley'];
    await J(`diaForcado(${JSON.stringify(ids)}, { wesley: ['sombra'] })`);
    await b.eval(`(document.querySelector('#hud').hidden = true, window.__jogo.S.semArma = true,
      window.__jogo.S.pessoas.forEach(p => { p.ia.ate = 1e9; p.fase = 0; p.t = 1; }), 1)`);
    await J('avancar(2.5)');
    const celulas = [];
    for (const id of ids) for (const [vista, lado, tras] of [['lado', 1.7, 0.3], ['diagonal', 1.1, 1.3]]) {
      await b.eval(`(() => { const S = window.__jogo.S, p = S.pessoas.find(q => q.id === '${id}'), y = p.obj.rotation.y;
        const F = [Math.sin(y), Math.cos(y)], E = [Math.cos(y), -Math.sin(y)];
        const c = [p.pos.x + E[0] * ${lado} - F[0] * ${tras}, p.pos.z + E[1] * ${lado} - F[1] * ${tras}], a = [p.pos.x + F[0] * 0.25, p.pos.z + F[1] * 0.25];
        S.jogador.pos.set(c[0], 1.5, c[1]); S.jogador.yaw = Math.atan2(-(a[0] - c[0]), -(a[1] - c[1]));
        S.jogador.pitch = Math.atan2(1.1 - 1.5, Math.hypot(a[0] - c[0], a[1] - c[1])); return 1; })()`);
      await J('avancar(1/30)');
      const f = path.join(OUT, `mesa_${id}_${vista}.jpg`);
      await b.shot(f, { quality: 85 });
      celulas.push({ arquivo: f, rotulo: `mesa · ${id} · ${vista}` });
    }
    await folha(b, celulas, { colunas: 4, largura: 640, saida: path.join(OUT, 'poses_mesa.jpg'), titulo: 'trabalhando na mesa' });
    todas.push(...celulas);
  }
  await folha(b, todas, { colunas: 6, largura: 400, saida: path.join(OUT, 'poses.jpg'), titulo: 'OS FUNCIONÁRIOS · todas as animações, dois esqueletos, cabeças trocadas, de frente/lado/costas + trabalho na mesa' });
  console.log('folha', path.join(OUT, 'poses.jpg'));
  const erros = b.logs.filter(l => /exception/i.test(l.type) || /Uncaught|TypeError|ReferenceError/.test(l.text));
  console.log('ERROS', erros.length, erros.slice(0, 3).map(e => e.text.slice(0, 300)).join('\n'));
} finally { await b.close(); srv.close(); }
