// Vídeo de demonstração (30 fps, 1280x720, ~30 s), quadro a quadro, com legenda: o memorando, achar a
// impostora pelo sinal, grampear, o relatório do dia, o almoxarifado (compra do nível 2, troca na mão)
// e o dia 2 com o grampeador novo.
//   cd ferramentas && node video.mjs [pasta_quadros]
// Depois: ffmpeg -framerate 30 -i <pasta>/%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 23 -movflags +faststart demo.mp4
import fs from 'node:fs';
import path from 'node:path';
import { launch, serve } from './cdp.mjs';

const jogo = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const OUT = process.argv[2] || path.join(jogo, 'fotos', 'video');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const { srv, url } = await serve(jogo);
const b = await launch({ width: 1280, height: 720 });
const J = (e) => b.eval(`window.__jogo.${e}`);
let n = 0;
const quadro = async () => { await J('avancar(1/30)'); await b.shot(path.join(OUT, String(n++).padStart(5, '0') + '.jpg'), { quality: 88 }); };
const segurar = async (seg) => { for (let i = 0; i < Math.round(seg * 30); i++) await quadro(); };
// legenda no alto, no meio; `direita` a põe sobre a metade direita (no almoxarifado a caixa fica à esquerda)
const legenda = (txt, direita = false) => b.eval(`(() => { let d = document.querySelector('#legenda'); if (!d) { d = document.createElement('div'); d.id = 'legenda';
  d.style.cssText = 'position:fixed;top:70px;transform:translateX(-50%);max-width:80%;padding:10px 20px;background:rgba(0,0,0,.72);color:#fff;font:600 22px system-ui;border-radius:8px;text-align:center;z-index:99;pointer-events:none';
  document.body.appendChild(d); } d.style.left = ${direita} ? '75%' : '50%'; d.style.maxWidth = ${direita} ? '44%' : '80%';
  d.textContent = ${JSON.stringify(txt)}; d.style.display = ${JSON.stringify(txt)} ? 'block' : 'none'; return 1; })()`);
const setJ = (x, z, yaw, pitch) => b.eval(`(() => { const j = window.__jogo.S.jogador; j.pos.set(${x}, 1.62, ${z}); j.yaw = ${yaw}; j.pitch = ${pitch}; return 1; })()`);
const clicar = (sel) => b.eval(`(document.querySelector('${sel}').click(), window.__jogo.tela())`);
const ease = (t) => t * t * (3 - 2 * t);
const lerpAng = (a, c, t) => { const d = Math.atan2(Math.sin(c - a), Math.cos(c - a)); return a + d * t; };
let P = { x: 0, z: 6.2, yaw: 0, pitch: 0 };
// move/vira suavemente de P até o alvo em `seg` segundos
async function ir(alvo, seg) {
  const A = { ...P }, B = { ...P, ...alvo };
  const k = Math.round(seg * 30);
  for (let i = 1; i <= k; i++) {
    const t = ease(i / k);
    await setJ(A.x + (B.x - A.x) * t, A.z + (B.z - A.z) * t, lerpAng(A.yaw, B.yaw, t), A.pitch + (B.pitch - A.pitch) * t);
    await quadro();
  }
  P = B;
}
const yawPara = (x, z, px = P.x, pz = P.z) => Math.atan2(-(x - px), -(z - pz));
const pitchPara = (x, y, z, px = P.x, pz = P.z) => Math.atan2(y - 1.62, Math.hypot(x - px, z - pz));
const M = { x: 7.3, z: -2.2 };     // onde a Márcia fica parada

try {
  await b.goto(`${url}/index.html`); await b.eval('window.__TESTE = true');
  await b.waitFor('window.__pronto === true', 90000);
  // memorando do dia 1 (semente 6: a impostora é a Márcia, com cabeça que gira e vapor gelado; "falha" é boato)
  await J('novoJogo(6)');
  await legenda('O memorando diz quantos relatos são verdadeiros e quantos são boato');
  await segurar(3);
  await J(`posicionar('marcia', ${M.x}, ${M.z}, 0)`);
  await J('comecar()');
  P = { x: 5.0, z: 4.6, yaw: yawPara(M.x, M.z, 5.0, 4.6), pitch: pitchPara(M.x, 1.4, M.z, 5.0, 4.6) };
  await setJ(P.x, P.z, P.yaw, P.pitch);
  await J(`tempoPessoa('marcia', 0.4)`);           // a cabeça gira quando t % 6 > 3,2: daqui a ~2,8 s
  await legenda('Dia 1. Seis pessoas no andar, uma não é humana.');
  await segurar(0.6);
  await ir({ x: 6.5, z: 0.6, yaw: yawPara(M.x, M.z, 6.5, 0.6), pitch: pitchPara(M.x, 1.45, M.z, 6.5, 0.6) }, 2.0);
  await legenda('A 3 m, sem zoom: a cabeça gira quase toda para trás e sai vapor gelado');
  await segurar(3.0);
  await b.eval('window.__jogo.S.jogador.zoom = true');
  await legenda('Zoom: é ela.');
  await segurar(1.2);
  await b.eval('window.__jogo.S.jogador.zoom = false');
  // grampear (nível 1: o 1º grampo revela, mais 3 derrubam)
  const mirarM = async () => { const m = await b.eval(`(() => { const p = window.__jogo.S.pessoas.find(q => q.id === 'marcia'); return { x: p.pos.x, z: p.pos.z }; })()`);
    P.yaw = yawPara(m.x, m.z); P.pitch = pitchPara(m.x, 1.15, m.z); await setJ(P.x, P.z, P.yaw, P.pitch); };
  await mirarM(); await segurar(0.3);
  await legenda('Grampeador nível 1: o 1º grampo arranca o disfarce');
  let r = await J('atirar()'); console.log('tiro 1', JSON.stringify(r));
  for (let i = 0; i < 14; i++) { await mirarM(); await quadro(); }
  await legenda('mais três grampos derrubam');
  for (let k = 0; k < 6 && r.resultado !== 'morreu'; k++) {
    for (let i = 0; i < 9; i++) { await mirarM(); await quadro(); }
    r = await J('atirar()'); console.log('tiro', k + 2, JSON.stringify(r));
  }
  await segurar(1.6);
  await legenda('');
  for (let i = 0; i < 90 && (await J('tela()')) === 'jogando'; i++) await quadro();
  // relatório
  console.log('tela', await J('tela()'));
  await legenda('Relatório: os sinais de cada impostor e a verba do dia');
  await segurar(3.2);
  // almoxarifado
  P.yaw = yawPara(-2, -1); P.pitch = -0.08; await setJ(P.x, P.z, P.yaw, P.pitch);    // vira para o andar
  console.log('->', await clicar('#rel-seguir'));
  await legenda('Almoxarifado: a verba compra o próximo nível do grampeador', true);
  await segurar(1.6);
  console.log('compra', await clicar('[data-comprar="L2"]'));
  await legenda('Nível 2: pente 16, mais rápido, derruba com 3 grampos', true);
  await segurar(2.6);
  console.log('->', await clicar('#alm-seguir'));
  await legenda('');
  await segurar(0.8);
  await J('comecar()');
  P = { x: 0, z: 6.2, yaw: 0, pitch: -0.05 }; await setJ(P.x, P.z, P.yaw, P.pitch);
  await legenda('Dia 2, com o grampeador novo na mão');
  await ir({ x: -1.2, z: 4.4, yaw: 0.5 }, 2.2);
  await segurar(0.6);
  console.log('quadros', n, 'segundos', (n / 30).toFixed(1), 'arma', JSON.stringify(await J('arma()')));
  const erros = b.logs.filter(l => /exception/i.test(l.type) || /Uncaught|TypeError/.test(l.text));
  console.log('ERROS', erros.length, erros.slice(0, 2).map(e => e.text.slice(0, 200)).join(' | '));
} finally { await b.close(); srv.close(); }
