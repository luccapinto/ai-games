// Provas do jogo inteiro no Chrome sem cabeça.
//   node provas.mjs
// 1) sorteio: 200 semanas, regras de cada dia (pessoas, aliens, sinais, iscas)
// 2) jogador perfeito: elimina só os aliens nos 5 dias -> FUNCIONÁRIO DO MÊS
// 3) jogador desastrado: atira em 3 humanos no dia 1 -> AFASTADO
// 4) tempo esgotado: ninguém atira -> aliens fogem, pontos negativos
// 5) teclado de verdade: W anda para a frente em tempo real, colisão com mesa segura o jogador
import fs from 'node:fs';
import path from 'node:path';
import { launch, serve } from './ferramentas/cdp.mjs';
import { sortearDia, DIAS, SINAL, ELENCO } from './js/dados.js';

const aqui = path.dirname(new URL(import.meta.url).pathname);
const FOTOS = process.env.SAIDA || path.join(aqui, 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
let ok = 0, falhou = 0;
const prova = (nome, cond, extra = '') => { if (cond) ok++; else falhou++; console.log(`${cond ? 'ok  ' : 'FALHA'} ${nome}${extra ? ' · ' + extra : ''}`); };

// ---------------------------------------------------------- 1) sorteio (sem navegador)
{
  let erros = 0;
  for (let s = 1; s <= 200; s++) for (let d = 1; d <= DIAS.length; d++) {
    const p = sortearDia(d, s), D = DIAS[d - 1];
    const sinais = Object.values(p.sinaisDe).flat();
    const bad = p.presentes.length !== D.pessoas || new Set(p.presentes).size !== D.pessoas
      || p.aliens.length !== D.aliens || p.aliens.some(a => !p.presentes.includes(a))
      || Object.values(p.sinaisDe).some(l => l.length !== D.sinais)
      || new Set(sinais).size !== sinais.length
      || sinais.some(s => !D.niveis.includes(SINAL[s].nivel))
      || sinais.some(s => SINAL[s].requer && !ELENCO.find(e => p.aliens.find(a => p.sinaisDe[a].includes(s)) === e.id)[SINAL[s].requer])
      || p.iscas.some(i => sinais.includes(i))
      || !sinais.every(s => p.memorando.includes(s));
    if (bad) erros++;
  }
  prova('sorteio: 1000 dias seguem as regras', erros === 0, `${erros} dias errados`);
  const a = JSON.stringify(sortearDia(3, 77)), b = JSON.stringify(sortearDia(3, 77));
  prova('sorteio: mesma semente, mesmo dia', a === b);
}

const { srv, url } = await serve(aqui);
const b = await launch({ width: 1280, height: 720 });
const J = (e) => b.eval(`window.__jogo.${e}`);
try {
  await b.goto(`${url}/index.html`);
  await b.eval('window.__TESTE = true');
  await b.waitFor('window.__pronto === true', 90000);
  prova('carrega e mostra o título', (await J('tela()')) === 'titulo');

  // ---------------------------------------------------------- 2) jogador perfeito
  await J('novoJogo(1234)'); await J('comecar()'); await J('avancar(0.2)'); await b.shot(path.join(FOTOS, 'prova_inicio.jpg'), { quality: 85 }); await J('novoJogo(1234)');
  let tudoCerto = true, diasJogados = 0;
  for (let d = 1; d <= DIAS.length; d++) {
    if ((await J('tela()')) !== 'memorando') { tudoCerto = false; break; }
    await J('comecar()');
    await J('avancar(3)');
    const ps = await J('pessoas()');
    const aliens = ps.filter(p => p.alien);
    for (const a of aliens) {
      const mirou = await J(`mirar('${a.id}', 2.2)`);
      const r = await J('atirar()');
      if (mirou !== a.id || r.acertou !== a.id || !r.alien) { tudoCerto = false; console.log('  dia', d, 'mira', mirou, 'tiro', JSON.stringify(r)); }
      await J('avancar(0.4)');
    }
    await J('avancar(4)');
    const t = await J('tela()');
    if (t !== 'relatorio') { tudoCerto = false; console.log('  dia', d, 'tela', t); break; }
    diasJogados++;
    await J('proximoDia()');
  }
  const S1 = await b.eval('JSON.stringify({ tela: window.__jogo.S.tela, pontos: window.__jogo.S.pontos, totais: window.__jogo.S.totais, titulo: document.querySelector("#fim-titulo").textContent })');
  const s1 = JSON.parse(S1);
  prova('perfeito: 5 dias jogados, todo alien na mira é eliminado', tudoCerto && diasJogados === 5, `${diasJogados} dias`);
  prova('perfeito: tela final "FUNCIONÁRIO DO MÊS"', s1.tela === 'fim' && s1.titulo === 'FUNCIONÁRIO DO MÊS', S1);
  prova('perfeito: 9 aliens, 0 inocentes, 0 fugas', s1.totais.aliens === 9 && s1.totais.inocentes === 0 && s1.totais.fugas === 0);
  await b.shot(path.join(FOTOS, 'prova_fim_perfeito.jpg'), { quality: 85 });

  // ---------------------------------------------------------- 3) jogador desastrado
  await J('novoJogo(99)'); await J('comecar()'); await J('avancar(2)');
  const humanos = (await J('pessoas()')).filter(p => !p.alien).slice(0, 3);
  for (const h of humanos) { await J(`mirar('${h.id}', 2.2)`); await J('atirar()'); await J('avancar(0.3)'); }
  await J('avancar(5)');
  const rel = await b.eval('document.querySelector("#rel-titulo").textContent');
  prova('desastrado: 3 humanos abatidos encerram o dia', (await J('tela()')) === 'relatorio' && /afastado/i.test(rel), rel);
  await J('proximoDia()');
  const fim = await b.eval('document.querySelector("#fim-titulo").textContent');
  prova('desastrado: tela final "AFASTADO"', (await J('tela()')) === 'fim' && fim === 'AFASTADO', fim);

  // ---------------------------------------------------------- 4) tempo esgotado
  await J('novoJogo(5)'); await J('comecar()');
  const dur = await b.eval('window.__jogo.S.duracao');
  await J(`avancar(${dur + 1}, 1/10)`);
  const s4 = JSON.parse(await b.eval('JSON.stringify({ tela: window.__jogo.S.tela, pontos: window.__jogo.S.pontos, fugas: window.__jogo.S.totais.fugas })'));
  prova('tempo: às 18h o dia acaba e o alien foge (-50)', s4.tela === 'relatorio' && s4.fugas === 1 && s4.pontos === -50, JSON.stringify(s4));

  // ---------------------------------------------------------- 5) teclado de verdade (tempo real)
  await J('novoJogo(8)'); await J('comecar()');
  await b.eval('window.__TESTE_TEMPO_REAL = true');
  const p0 = JSON.parse(await b.eval('JSON.stringify(window.__jogo.S.jogador.pos)'));
  const tecla = async (tipo, code, key) => b.send('Input.dispatchKeyEvent', { type: tipo, code, key, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) });
  await tecla('keyDown', 'KeyW', 'w');
  await new Promise(r => setTimeout(r, 1500));
  await tecla('keyUp', 'KeyW', 'w');
  const p1 = JSON.parse(await b.eval('JSON.stringify(window.__jogo.S.jogador.pos)'));
  const andou = p0.z - p1.z;
  prova('teclado: segurar W anda para a frente', andou > 0.5, `andou ${andou.toFixed(2)} m`);
  // anda 30 s para a frente: não pode atravessar a parede do fundo nem as mesas
  await tecla('keyDown', 'KeyW', 'w');
  await new Promise(r => setTimeout(r, 6000));
  await tecla('keyUp', 'KeyW', 'w');
  const p2 = JSON.parse(await b.eval('JSON.stringify(window.__jogo.S.jogador.pos)'));
  const dentro = await b.eval(`(() => { const { x, z } = window.__jogo.S.jogador.pos; return x > -9 && x < 9.5 && z > -6 && z < 8; })()`);
  prova('teclado: colisão segura o jogador dentro da sala', dentro, `x ${p2.x.toFixed(2)} z ${p2.z.toFixed(2)}`);
  await b.eval('window.__TESTE_TEMPO_REAL = false');

  const erros = b.logs.filter(l => /exception/i.test(l.type) || /Uncaught|TypeError|ReferenceError/.test(l.text));
  prova('nenhuma exceção no console', erros.length === 0, erros.slice(0, 3).map(e => e.text.slice(0, 200)).join(' | '));
} finally { await b.close(); srv.close(); }
console.log(`\n${ok} ok, ${falhou} falhas`);
process.exit(falhou ? 1 : 0);
