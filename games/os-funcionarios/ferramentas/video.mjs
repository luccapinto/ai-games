// Vídeo de uma partida guiada do dia 1, quadro a quadro (30 fps), com legenda.
//   cd ferramentas && node video.mjs <pasta_quadros>
// Depois: ffmpeg -framerate 30 -i <pasta>/%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 22 -movflags +faststart saida.mp4
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
const legenda = (txt) => b.eval(`(() => { let d = document.querySelector('#legenda'); if (!d) { d = document.createElement('div'); d.id = 'legenda';
  d.style.cssText = 'position:fixed;left:50%;bottom:44px;transform:translateX(-50%);max-width:80%;padding:10px 20px;background:rgba(0,0,0,.72);color:#fff;font:600 22px system-ui;border-radius:8px;text-align:center;z-index:99;pointer-events:none';
  document.body.appendChild(d); } d.textContent = ${JSON.stringify(txt)}; d.style.display = ${JSON.stringify(txt)} ? 'block' : 'none'; return 1; })()`);
const setJ = (x, z, yaw, pitch) => b.eval(`(() => { const j = window.__jogo.S.jogador; j.pos.set(${x}, 1.62, ${z}); j.yaw = ${yaw}; j.pitch = ${pitch}; return 1; })()`);
const ease = (t) => t * t * (3 - 2 * t);
const lerpAng = (a, c, t) => { let d = Math.atan2(Math.sin(c - a), Math.cos(c - a)); return a + d * t; };
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

try {
  await b.goto(`${url}/index.html`); await b.eval('window.__TESTE = true');
  await b.waitFor('window.__pronto === true', 90000);
  // título
  await segurar(3.5);
  // memorando do dia 1 (semente 6: Márcia é a impostora, com cabeça que gira e vapor gelado)
  await J('novoJogo(6)');
  await legenda('Dia 1: o memorando do RH diz quantos impostores há e lista os sinais (um deles é boato)');
  await segurar(6);
  await J(`posicionar('marcia', 7.3, -2.2, 0)`);
  await J(`tempoPessoa('marcia', 0)`);
  await J('comecar()'); await legenda('');
  await setJ(P.x, P.z, P.yaw, P.pitch); await segurar(0.8);
  // olha em volta com o memorando aberto
  await b.eval(`document.querySelector('#hud-memo').classList.add('aberto')`);
  await legenda('Seis pessoas no andar. Uma delas não é humana.');
  await ir({ yaw: 0.55 }, 1.6); await ir({ yaw: -0.55 }, 2.2); await ir({ yaw: 0 }, 1.4);
  await b.eval(`document.querySelector('#hud-memo').classList.remove('aberto')`);
  await legenda('');
  // anda pelo corredor de baixo até o lado da janela
  await ir({ yaw: -Math.PI / 2 }, 0.7);
  await ir({ x: 6.6, z: 5.6 }, 3.0);
  await ir({ yaw: 0 }, 0.8);
  await legenda('Perto da janela, a Márcia está parada de um jeito estranho...');
  await ir({ z: 0.9, yaw: yawPara(7.3, -2.2, 6.6, 0.9), pitch: pitchPara(7.3, 1.45, -2.2, 6.6, 0.9) }, 2.6);
  await legenda('');
  // zoom: a cabeça vai girar (ciclo do sinal: começa em t ≈ 6,4 - 4,6 = 1,8)
  const tm = await b.eval(`window.__jogo.S.pessoas.find(p => p.id === 'marcia').t`);
  await J(`tempoPessoa('marcia', 4.7)`);   // ciclo do sinal = (t + 10,2) % 9: começa a girar 0,5 s depois
  await b.eval('window.__jogo.S.jogador.zoom = true');
  await legenda('Botão direito: examinar de perto');
  await segurar(0.7);
  await legenda('A cabeça gira quase toda para trás. E sai vapor gelado da boca.');
  await segurar(4.2);
  await b.eval('window.__jogo.S.jogador.zoom = false'); await segurar(0.6);
  // crachá
  await legenda('[E] pedir o crachá e comparar com a ficha do RH');
  await ir({ pitch: pitchPara(7.3, 1.2, -2.2) }, 0.5);
  await J('pedirCracha()'); await segurar(3.2);
  await J('fecharCracha()');
  await legenda('O crachá confere. Mas dois sinais do memorando, sim. Hora de agir.');
  await segurar(1.6);
  await legenda('');
  // recua um pouco para dar espaço à luta
  await ir({ z: 2.6, pitch: pitchPara(7.3, 1.2, -2.2, 6.6, 2.6), yaw: yawPara(7.3, -2.2, 6.6, 2.6) }, 1.0);
  const mirarM = async () => { const m = await b.eval(`(() => { const p = window.__jogo.S.pessoas.find(q => q.id === 'marcia'); return { x: p.pos.x, z: p.pos.z }; })()`);
    P.yaw = yawPara(m.x, m.z); P.pitch = pitchPara(m.x, 1.15, m.z); await setJ(P.x, P.z, P.yaw, P.pitch); return m; };
  await mirarM();
  await legenda('Clique: um grampo');
  let r = await J('atirar()'); console.log('tiro1', JSON.stringify(r));
  await segurar(1.4);
  await legenda('O primeiro grampo só arranca o disfarce. Ela vem para cima.');
  // ela corre até o jogador; a câmera acompanha
  for (let i = 0; i < 24; i++) { await mirarM(); await quadro(); }
  await legenda('Continue grampeando');
  for (let k = 0; k < 6; k++) {
    for (let i = 0; i < 16; i++) { await mirarM(); await quadro(); }
    r = await J('atirar()'); console.log('tiro', k + 2, JSON.stringify(r));
    if (r.resultado === 'morreu') break;
  }
  await legenda('Quatro grampos. Era alienígena: +100');
  await segurar(2.6);
  await legenda('');
  await segurar(2.0);
  // relatório
  console.log('tela', await J('tela()'));
  await segurar(5);
  console.log('quadros', n, 'segundos', (n / 30).toFixed(1), 'tm', tm);
  const erros = b.logs.filter(l => /exception/i.test(l.type) || /Uncaught|TypeError/.test(l.text));
  console.log('ERROS', erros.length);
} finally { await b.close(); srv.close(); }
