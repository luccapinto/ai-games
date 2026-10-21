// Provas do jogo inteiro no Chrome sem cabeça.
//   node provas.mjs
// 1) sorteio: 200 semanas, regras de cada dia (pessoas, aliens, sinais, iscas)
// 2) jogador perfeito: elimina só os aliens nos 5 dias -> FUNCIONÁRIO DO MÊS
// 3) jogador desastrado: atira em 3 humanos no dia 1 -> AFASTADO
// 4) tempo esgotado: ninguém atira -> aliens fogem, pontos negativos
// 5) teclado de verdade: W anda para a frente em tempo real, colisão com mesa segura o jogador
// 6) grampeador: arma na mão, 1 grampo derruba humano, alien aguenta 4 (o 1º só revela), pente e recarga
// 7) alien revelado corre atrás do jogador e soca; 5 socos = nocaute
// 8) caneca na mão: encostada na palma (< 3 cm), dedos fechados nela e em pé, parado e andando; gole leva à boca
// 9) almoxarifado: bom jogador (limpa cada dia na metade do expediente) chega ao nível 4 no dia 5 comprando
//    pela tela; compra muda pente/cadência/grampos para derrubar e troca as peças na mão (com animação);
//    ramo travado no nível 3; sem verba não compra; semana nova volta ao nível 1
// 10) estatística dos sinais: 200 expedientes simulados; todo sinal de todo alien aparece no dia
import fs from 'node:fs';
import path from 'node:path';
import { launch, serve } from './ferramentas/cdp.mjs';
import { sortearDia, DIAS, SINAL, ELENCO, ARMA } from './js/dados.js';

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
      let r = null, n = 0;
      while (n < 8) {
        const mirou = await J(`mirar('${a.id}', 2.2)`);
        r = await J('atirar()'); n++;
        if (r.recarregando) { await J('avancar(1.5)'); continue; }
        if (mirou !== a.id || r.acertou !== a.id || !r.alien) { tudoCerto = false; console.log('  dia', d, 'mira', mirou, 'tiro', JSON.stringify(r)); break; }
        if (r.resultado === 'morreu') break;
        await J('avancar(0.3)');
      }
      if (r?.resultado !== 'morreu') { tudoCerto = false; console.log('  dia', d, a.id, 'não morreu', JSON.stringify(r)); }
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

  // ---------------------------------------------------------- 6) grampeador
  await J('diaForcado(["rafael","marcia","jorge"], { marcia: ["olho"] })');
  await J('posicionar("rafael", 1.9, 1.2, 0)'); await J('posicionar("marcia", -1.4, 1.2, 0)'); await J('posicionar("jorge", 5.0, -2.4, 0)');
  await J('avancar(0.3)');
  const a0 = await J('arma()');
  prova('arma: grampeador na mão, pente cheio', a0.visivel && a0.pente === 12, JSON.stringify(a0));
  await J('mirar("marcia", 2.5)'); const t1 = await J('atirar()'); await J('avancar(0.5)');
  const m1 = (await J('pessoas()')).find(p => p.id === 'marcia');
  prova('alien: o 1º grampo só arranca o disfarce (não morre direto)', t1.resultado === 'revelou' && m1.estado !== 'morrendo' && m1.vida === 3, JSON.stringify(t1) + ' ' + m1.estado);
  const res = [];
  for (let i = 0; i < 3; i++) { await J('mirar("marcia", 2.5)'); res.push((await J('atirar()')).resultado); await J('avancar(0.3)'); }
  prova('alien: cai no 4º grampo', res.join(',') === 'feriu,feriu,morreu', res.join(','));
  const a1 = await J('arma()');
  prova('arma: cada grampo gasta 1 do pente', a1.pente === 8, `pente ${a1.pente}`);
  await J('mirar("rafael", 2.5)'); const th = await J('atirar()');
  prova('humano: cai com 1 grampo', th.resultado === 'humano', JSON.stringify(th));
  await J('diaForcado(["rafael","marcia"], { marcia: ["olho"] })'); await J('avancar(0.2)');
  await b.eval('(() => { const j = window.__jogo.S.jogador; j.pos.set(0, 1.62, 6.2); j.yaw = 0; j.pitch = 1.2; return 1; })()');
  for (let i = 0; i < 12; i++) { await J('atirar()'); await J('avancar(0.3)'); }
  const a2 = await J('arma()');
  prova('arma: pente vazio recarrega sozinho', a2.recarregando > 0 || a2.pente === 12, JSON.stringify(a2));
  await J('avancar(2)');
  prova('arma: recarga devolve 12 grampos', (await J('arma()')).pente === 12);

  // ---------------------------------------------------------- 7) alien revelado ataca
  await J('diaForcado(["rafael","marcia"], { marcia: ["olho"] })');
  await J('posicionar("rafael", -6.2, 4.9, 0)'); await J('posicionar("marcia", 1.9, -2.4, 0)');
  await J('avancar(0.2)');
  await J('mirar("marcia", 4)'); const r7 = await J('atirar()');
  let socado = false;
  for (let i = 0; i < 20 && !socado; i++) { await J('avancar(0.5)'); socado = (await J('jogador()')).vida < 5; }
  prova('alien revelado corre até o jogador e soca', r7.resultado === 'revelou' && socado, JSON.stringify(r7) + ' ' + JSON.stringify(await J('jogador()')));
  await J('avancar(12)');
  const t7 = await J('tela()'); const mot = await b.eval('document.querySelector("#rel-motivo").textContent');
  prova('5 socos = nocaute, o dia acaba', t7 === 'relatorio' && /nocaute/i.test(mot), `${t7} · ${mot.slice(0, 60)}`);

  // ---------------------------------------------------------- 8) caneca na mão
  await J('diaForcado(["marcia", "bruno", "rafael"], { rafael: ["sombra"] })');
  await J('posicionar("marcia", -6.2, 4.9, 0)'); await J('posicionar("rafael", 7, -2.4, 0)');
  await J('posicionar("bruno", -8.0, 1.2, 0)'); await J('andarPara("bruno", 7.6, 1.2)');
  await J('avancar(1)');
  let piorFolga = 0, piorDedo = 0, menosEmPe = 1, andou = 0;
  for (let i = 0; i < 16; i++) {
    await J('avancar(0.25)');
    for (const id of ['marcia', 'bruno']) {
      const c = await J(`caneca("${id}")`);
      piorFolga = Math.max(piorFolga, c.folga); piorDedo = Math.max(piorDedo, c.dedos);
      if (c.bebendo === 0) menosEmPe = Math.min(menosEmPe, c.emPe);
    }
    if (await b.eval('window.__jogo.S.pessoas.find(p => p.id === "bruno").andando')) andou++;
  }
  prova('caneca: encostada na palma, em pé e andando (< 3 cm)', piorFolga < 0.03 && andou >= 12, `folga máx ${(piorFolga * 100).toFixed(1)} cm · ${andou}/16 amostras andando`);
  prova('caneca: dedos fechados em volta dela e caneca em pé', piorDedo < 0.03 && menosEmPe > 0.9, `ponta do dedo a ${(piorDedo * 100).toFixed(1)} cm da parede · em pé ${menosEmPe.toFixed(2)}`);
  await J('gole("marcia")'); await J('avancar(1.3)');
  const g = await J('caneca("marcia")');
  prova('caneca: no gole a mão leva a caneca à boca', g.bebendo > 0.95 && g.boca < 0.25 && g.folga < 0.03, JSON.stringify(g));

  // ---------------------------------------------------------- 9) almoxarifado e níveis do grampeador
  await J('novoJogo(4321)');
  const e0 = await J('economia()');
  const r0 = await J(`comprar('L2')`);
  prova('upgrade: semana nova começa no L1, sem verba, e sem verba não compra', e0.nivel === 'L1' && e0.verba === 0 && !r0.ok && r0.motivo === 'verba', JSON.stringify(r0));
  const clicar = (sel) => b.eval(`(document.querySelector('${sel}').click(), window.__jogo.tela())`);
  const compras = [], efeitos = [], trocas = [], grampos = [];
  let bomOk = true;
  for (let d = 1; d <= 4; d++) {
    await J('comecar()');
    const dur = await b.eval('window.__jogo.S.duracao');
    await J(`avancar(${dur * 0.5}, 1/10)`);                 // "bom", não perfeito: acha os aliens na metade do dia
    for (const a of (await J('pessoas()')).filter(p => p.alien && p.estado === 'vivo')) {
      let r = null, n = 0, tent = 0;
      while (n < 12 && tent < 40) {
        // bom jogador não atira com alguém na frente: chega mais perto/longe ou espera a pessoa passar
        const mirou = await J(`mirar('${a.id}', ${[2.2, 1.6, 3][tent % 3]})`);
        if (mirou !== a.id) { tent++; await J('avancar(0.3)'); continue; }
        r = await J('atirar()');
        if (r.recarregando || r.vazio) { await J('avancar(0.5)'); continue; }
        n++;
        if (r.resultado === 'morreu') break;
        await J('avancar(0.45)');
      }
      grampos.push(`${(await J('arma()')).nivel}:${n}`);
      if (r?.resultado !== 'morreu') bomOk = false;
    }
    await J('avancar(4)');
    if ((await J('tela()')) !== 'relatorio') { bomOk = false; break; }
    if ((await clicar('#rel-seguir')) !== 'almoxarifado') { bomOk = false; break; }
    // compra pelo botão da tela o que a verba pagar (ramo de cadência no nível 3)
    for (;;) {
      const e = await J('economia()');
      const id = e.opcoes.find(o => !o.startsWith('L3I') && ARMA[o].preco <= e.verba);
      if (!id) break;
      const antes = await J('arma()');
      await clicar(`[data-comprar="${id}"]`);
      const logo = await J('arma()');
      await J('avancar(1.2)');
      const depois = await J('arma()');
      const esperado = await b.eval(`window.__jogo.armaObj.variantes['${id}']`);
      compras.push(`dia ${d}: ${id} (${ARMA[id].preco})`);
      efeitos.push(depois.nivel === id && depois.pente === ARMA[id].pente && logo.troca > 0 && depois.troca === 0);
      trocas.push(JSON.stringify(depois.pecas.slice().sort()) === JSON.stringify(esperado.slice().sort()) && JSON.stringify(antes.pecas) !== JSON.stringify(depois.pecas));
      if (id === 'L3C') {
        const lado = await J(`comprar('L3I')`), pula = await J(`comprar('L4I')`);
        const op = (await J('economia()')).opcoes;
        prova('upgrade: ramo travado (no L3C não compra L3I nem L4I; só aparece L4C)', !lado.ok && !pula.ok && op.join() === 'L4C', `${JSON.stringify(lado)} ${JSON.stringify(pula)} opções ${op}`);
      }
    }
    await J('avancar(0.3)');
    await b.shot(path.join(FOTOS, `prova_almoxarifado_${d}.jpg`), { quality: 80 });
    if ((await clicar('#alm-seguir')) !== 'memorando') { bomOk = false; break; }
  }
  const e5 = await J('economia()');
  const hud = await b.eval(`document.querySelector('#hud-arma').textContent`);
  prova('upgrade: bom jogador chega ao nível 4 no dia 5', bomOk && e5.nivel === 'L4C' && /L4C/.test(hud), `${compras.join(' · ')} · sobra ${e5.verba} · HUD "${hud}"`);
  prova('upgrade: a compra aplica pente do nível e anima a troca', efeitos.length >= 3 && efeitos.every(Boolean), JSON.stringify(efeitos));
  prova('upgrade: as peças na mão trocam para as do nível comprado', trocas.length >= 3 && trocas.every(Boolean), JSON.stringify(trocas));
  const porNivel = (n) => grampos.filter(g => g.startsWith(n + ':')).map(g => +g.split(':')[1]);
  prova('upgrade: grampos para derrubar seguem o nível (L1 4, L2 3, L3C 3)', grampos.every(g => +g.split(':')[1] === ARMA[g.split(':')[0]].grampos) && porNivel('L1').length > 0, grampos.join(' '));
  // ramo de impacto: L3I derruba com 2, L4I com 1 (o mesmo grampo revela e derruba); cadência real
  const derruba = {};
  for (const id of ['L3I', 'L4I']) {
    await J('diaForcado(["rafael","marcia"], { marcia: ["olho"] })'); await J(`nivel('${id}')`); await J('avancar(0.2)');
    const rs = [];
    for (let i = 0; i < 4 && rs.at(-1) !== 'morreu'; i++) { await J('mirar("marcia", 2.5)'); rs.push((await J('atirar()')).resultado); await J('avancar(0.5)'); }
    derruba[id] = rs.join(',');
  }
  prova('upgrade: L3I derruba com 2 grampos, L4I com 1', derruba.L3I === 'revelou,morreu' && derruba.L4I === 'morreu', JSON.stringify(derruba));
  const cad = {};
  for (const id of ['L1', 'L4C']) {
    await J('diaForcado(["rafael","marcia"], { marcia: ["olho"] })'); await J(`nivel('${id}')`);
    await b.eval('(() => { const j = window.__jogo.S.jogador; j.pos.set(0, 1.62, 6.2); j.yaw = 0; j.pitch = 1.2; window.__jogo.S.gatilho = true; return 1; })()');
    await J('avancar(1, 1/60)');
    await b.eval('window.__jogo.S.gatilho = false');
    cad[id] = ARMA[id].pente - (await J('arma()')).pente;
  }
  prova('upgrade: segurando o gatilho 1 s, L4C dispara muito mais que L1', cad.L4C >= 10 && cad.L1 <= 5, JSON.stringify(cad));
  await J('novoJogo(77)');
  const ef = await J('economia()'), af = await J('arma()');
  prova('upgrade: jogo novo volta ao L1 com verba zero e peças do L1', ef.nivel === 'L1' && ef.verba === 0 && af.pecas.every(n => /_l1$/.test(n)), JSON.stringify(af.pecas));

  // ---------------------------------------------------------- 10) estatística dos sinais
  // 40 semanas x 5 dias = 200 expedientes inteiros simulados (passo de 0,2 s; a IA segue a semente).
  // Sinal que vai e volta: à mostra pelo menos 6 vezes e 30 s no dia. Sinal fixo: o dia inteiro.
  {
    const FIXOS = ['pe', 'sombra', 'caneca', 'costura', 'foto', 'nome', 'pele'];
    const porSinal = {}, ruins = [];
    const t0 = Date.now();
    for (let s = 1; s <= 40; s++) for (let d = 1; d <= 5; d++) {
      const r = await b.eval(`window.__jogo.medirSinais(${d}, ${1000 + s}, 0.2)`);
      for (const a of r.aliens) for (const [sin, m] of Object.entries(a.sinais)) {
        (porSinal[sin] ||= []).push({ ...m, fr: m.seg / r.duracao });
        const bom = FIXOS.includes(sin) ? m.seg >= 0.95 * r.duracao : m.vezes >= 6 && m.seg >= 30;
        if (!bom) ruins.push(`${1000 + s}/${d} ${a.id} ${sin} ${m.seg}s ${m.vezes}x`);
      }
    }
    const tab = Object.entries(porSinal).sort().map(([s, l]) => {
      const v = l.map(m => m.vezes).sort((x, y) => x - y), f = l.map(m => m.fr).sort((x, y) => x - y);
      return `${s} n${l.length} vezes mín ${v[0]} med ${v[v.length >> 1]} · fração do dia mín ${f[0].toFixed(2)} med ${f[f.length >> 1].toFixed(2)}`;
    });
    fs.writeFileSync(path.join(FOTOS, 'prova_estatistica.txt'), tab.join('\n') + '\n');
    console.log('  ' + tab.join('\n  '));
    prova('estatística: 200 expedientes, todo sinal de todo alien aparece várias vezes no dia', ruins.length === 0 && Object.keys(porSinal).length === Object.keys(SINAL).length,
      `${Object.keys(porSinal).length} sinais · ${((Date.now() - t0) / 1000).toFixed(0)} s · ${ruins.slice(0, 5).join(' | ')}`);
  }

  const erros = b.logs.filter(l => /exception/i.test(l.type) || /Uncaught|TypeError|ReferenceError/.test(l.text));
  prova('nenhuma exceção no console', erros.length === 0, erros.slice(0, 3).map(e => e.text.slice(0, 200)).join(' | '));
} finally { await b.close(); srv.close(); }
console.log(`\n${ok} ok, ${falhou} falhas`);
process.exit(falhou ? 1 : 0);
