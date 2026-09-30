// A mesa da roleta: a roda em canvas, o pano e a pista em SVG, as fichas em
// pilha, a conta da casa ao lado. Tudo o que decide dinheiro está em
// sessao.js; aqui só se encena.

import { criarSessaoRoleta } from './sessao.js';
import { APOSTA_POR_ID, fichaDe, contaDaMesa, ANUNCIADAS, apostasAnunciada, numerosAnunciada, vizinhosDe, corDe, nomeNumero, VANTAGEM, NOME_TIPO } from './regras.js';
import { simularGiro, amostra } from './fisica.js';
import { criarRoda } from './roda.js';
import { svgPano, svgPista, centroDaZona, viewBox } from './pano.js';
import { DENOMINACOES, svgFicha, htmlPilha } from '../../visual/fichas.js';
import { voarFichas, aproximar, respirar, faiscas, centro } from '../../visual/efeitos.js';
import { ICONES, mostrarDica, esconderDica, htmlConta, avisar } from '../../ui.js';
import { fichas, fichasFrac, pct, numero, chance } from '../../nucleo/formato.js';
import * as som from '../../som.js';

export function placa() {
  return [
    { rotulo: 'vantagem', valor: pct(VANTAGEM) },
    { rotulo: 'em toda aposta', valor: '1 em 37' },
  ];
}

const TIPOS_TABELA = [
  ['pleno', 'p17'], ['cavalo', 'c17-20'], ['transversal', 't16'], ['quadra', 'q16'], ['linha', 'l16'],
  ['duzia', 'd2'], ['coluna', 'k2'], ['simples', 'vermelho'],
];

export function montar(raiz, app) {
  const { casa } = app;
  const s = criarSessaoRoleta(casa);
  let ficha = casa.mesa('roleta').ficha ?? 500;
  let girando = false;
  let vista = 'pano';
  let orientacao = 'h';
  let giro = null, t0 = 0, subida = null;
  let rotorAng = casa.mesa('roleta').rotorAng ?? 0, rotorVel = 0.35;
  let bolaParada = casa.mesa('roleta').bolaPsi ?? null; // ângulo da bola no referencial do rotor
  let ultimoNumeroVisivel = s.historico[0] ?? null;
  let raf = 0, vivo = true;
  let rapido = !!casa.mesa('roleta').rapido;
  const medidas = { desenho: [] };

  raiz.innerHTML = `
    <div class="feltro"></div><div class="abajur"></div>
    <div class="mesa-grade roleta">
      <div class="palco">
        <div class="roleta-topo">
          <div class="roda-caixa">
            <canvas class="roda" aria-label="A roda da roleta"></canvas>
            <div class="medalha" hidden></div>
            <button class="rapido" title="Giro rápido">${rapido ? 'rápido' : 'normal'}</button>
          </div>
          <div class="pista-caixa"></div>
        </div>
        <div class="alternar-vista"><button data-v="pano" class="ativa">Pano</button><button data-v="pista">Pista francesa</button></div>
        <div class="pano-caixa"><div class="escala pano-escala"></div><div class="banco" aria-hidden="true"></div></div>
        <div class="rodape-mesa">
          <div class="rack"></div>
          <div class="acoes">
            <button class="icone" data-a="desfazer" title="Desfazer a última ficha">${ICONES.desfazer}</button>
            <button class="icone" data-a="limpar" title="Tirar todas as fichas">${ICONES.limpar}</button>
            <button class="icone" data-a="repetir" title="Repetir as apostas do giro anterior">${ICONES.repetir}</button>
            <button class="icone" data-a="dobrar" title="Dobrar todas as apostas">${ICONES.dobrar}</button>
            <div class="na-mesa"><span>na mesa</span><b class="v-total">0</b><span class="pe">perda esperada <b class="v-pe">0</b></span></div>
            <button class="btn grande girar">Girar</button>
          </div>
        </div>
      </div>
      <aside class="conta"></aside>
    </div>
    <button class="aba-conta">${ICONES.conta}<span>a conta</span></button>`;

  const $ = sel => raiz.querySelector(sel);
  const canvas = $('canvas.roda');
  const roda = criarRoda(canvas);
  const conta = $('.conta');
  const panoEscala = $('.pano-escala');
  const banco = $('.banco');

  // ---------------------------------------------------------------- rack

  function pintarRack() {
    const saldo = casa.carteira.saldo;
    $('.rack').innerHTML = DENOMINACOES.map(d => `<button class="ficha${d.valor === ficha ? ' escolhida' : ''}" data-v="${d.valor}" ${d.valor > saldo ? 'disabled' : ''} title="${fichas(d.valor)} ficha${d.valor > 100 ? 's' : ''}">${svgFicha(d.valor)}</button>`).join('');
  }
  $('.rack').addEventListener('click', e => {
    const b = e.target.closest('.ficha');
    if (!b || b.disabled) return;
    ficha = Number(b.dataset.v);
    casa.mesa('roleta').ficha = ficha;
    som.ficha(1, 0.6);
    pintarRack();
  });

  // ---------------------------------------------------------------- pano

  function escolherOrientacao() {
    const nova = innerWidth <= 720 && innerHeight > innerWidth ? 'v' : 'h';
    if (nova === orientacao && panoEscala.firstChild) return;
    orientacao = nova;
    const [, , vw, vh] = viewBox(orientacao);
    panoEscala.style.aspectRatio = `${vw} / ${vh}`;
    panoEscala.style.setProperty('--razao', vw / vh);
    panoEscala.innerHTML = svgPano(orientacao) + '<div class="fichas-pano"></div>';
    raiz.querySelector('.roleta').classList.toggle('em-pe', orientacao === 'v');
    // a pista mora ao lado da roda no pano deitado; em pé, ela troca de lugar com o pano
    raiz.querySelectorAll('.pista-escala').forEach(p => p.remove());
    const pista = document.createElement('div');
    pista.className = `escala pista-escala${orientacao === 'v' ? ' vertical' : ''}`;
    pista.innerHTML = svgPista(orientacao);
    (orientacao === 'v' ? raiz.querySelector('.pano-caixa') : raiz.querySelector('.pista-caixa')).append(pista);
    pintarFichas();
  }

  function posZona(id, onde = 'pano') {
    if (onde === 'pista') return null;
    const c = centroDaZona(id, orientacao);
    const [vx, vy, vw, vh] = viewBox(orientacao);
    return { left: (c[0] - vx) / vw * 100, top: (c[1] - vy) / vh * 100 };
  }

  function pintarFichas(novas = []) {
    const camada = panoEscala.querySelector('.fichas-pano');
    if (!camada) return;
    const larg = panoEscala.clientWidth;
    const [, , vw] = viewBox(orientacao);
    const d = Math.max(20, Math.min(44, larg / vw * 0.66));
    camada.style.setProperty('--d', d + 'px');
    let html = '';
    for (const [id, v] of Object.entries(s.apostas)) {
      const p = posZona(id);
      if (!p) continue;
      html += `<div class="pilha${novas.includes(id) ? ' cai' : ''}" data-id="${id}" style="left:${p.left}%;top:${p.top}%;--d:${d}px">${htmlPilha(v)}</div>`;
    }
    camada.innerHTML = html;
    atualizarTotais();
  }

  function atualizarTotais() {
    // durante o giro as apostas já saíram da sessão, mas continuam no pano até a bola parar
    const c = contaDaMesa(girando ? girando.r.apostas : s.apostas);
    $('.v-total').textContent = fichas(c.total);
    $('.v-pe').textContent = c.total ? '−' + fichasFrac(c.perdaEsperada, 2) : '0';
    $('.girar').disabled = girando || c.total === 0;
    pintarConta();
  }

  function destacar(numeros, liga) {
    for (const el of raiz.querySelectorAll('[data-n]')) {
      if (numeros.includes(Number(el.dataset.n))) el.classList.toggle('coberto', liga);
    }
  }

  const dicaDe = id => {
    const a = APOSTA_POR_ID[id];
    const v = s.apostas[id] ?? ficha;
    const nota = s.apostas[id] ? '' : 'com a ficha escolhida';
    return htmlConta(fichaDe(id), v, { nota: `${NOME_TIPO[a.tipo]} · cobre ${a.numeros.length} número${a.numeros.length > 1 ? 's' : ''}. ${nota}` });
  };

  function aoApostar(id, origem) {
    if (girando) return;
    try {
      s.apostar(id, ficha);
    } catch (e) { som.negado(); avisar(e.message, { erro: true }); if (casa.carteira.saldo < 100) app.oferecerCredito(100); return; }
    som.ficha(1);
    voarDoRack(origem, id);
    pintarFichas([id]);
    pintarRack();
    app.atualizarSaldo();
  }

  function voarDoRack(destinoEl, id) {
    const b = $(`.rack .ficha[data-v="${ficha}"]`);
    const alvo = destinoEl ?? $(`.fichas-pano .pilha[data-id="${id}"]`);
    if (b && alvo) voarFichas({ de: b, para: alvo, valor: ficha, duracao: 380, arco: 60, tamanho: 34, somFinal: false });
  }

  function ligarPano() {
    panoEscala.addEventListener('pointerover', e => {
      const z = e.target.closest('.zona');
      if (!z) return;
      destacar(APOSTA_POR_ID[z.dataset.id].numeros, true);
      if (e.pointerType === 'mouse') mostrarDica(z, dicaDe(z.dataset.id));
    });
    panoEscala.addEventListener('pointerout', e => {
      const z = e.target.closest('.zona');
      if (!z) return;
      destacar(APOSTA_POR_ID[z.dataset.id].numeros, false);
      esconderDica(z);
    });
    let toque = 0, longo = false;
    panoEscala.addEventListener('pointerdown', e => {
      const z = e.target.closest('.zona');
      if (!z || e.pointerType === 'mouse') return;
      longo = false;
      clearTimeout(toque);
      toque = setTimeout(() => { longo = true; mostrarDica(z, dicaDe(z.dataset.id)); destacar(APOSTA_POR_ID[z.dataset.id].numeros, true); }, 420);
    });
    panoEscala.addEventListener('pointerup', () => { clearTimeout(toque); if (longo) setTimeout(() => { esconderDica(); for (const el of raiz.querySelectorAll('.coberto')) el.classList.remove('coberto'); }, 1600); });
    panoEscala.addEventListener('click', e => {
      const z = e.target.closest('.zona');
      if (!z || longo) { longo = false; return; }
      aoApostar(z.dataset.id, z);
    });
    panoEscala.addEventListener('contextmenu', e => {
      const z = e.target.closest('.zona');
      if (!z) return;
      e.preventDefault();
      if (girando || !s.apostas[z.dataset.id]) return;
      s.retirar(z.dataset.id);
      som.ficha(1, 0.5);
      pintarFichas(); pintarRack(); app.atualizarSaldo();
    });
  }

  // ---------------------------------------------------------------- pista

  function ligarPista() {
    const pista = raiz;
    const alvoDe = e => e.target.closest('.setor, .pista-casa');
    const numerosDe = el => el.classList.contains('setor') ? numerosAnunciada(el.dataset.anunciada) : vizinhosDe(Number(el.dataset.viz));
    const nomeDe = el => el.classList.contains('setor') ? ANUNCIADAS[el.dataset.anunciada].nome : `Vizinhos do ${el.dataset.viz}`;
    const dica = el => {
      const nome = el.classList.contains('setor') ? el.dataset.anunciada : 'vizinhosde';
      const itens = apostasAnunciada(nome, Number(el.dataset.viz));
      const unidades = itens.reduce((q, [, k]) => q + k, 0);
      const ns = numerosDe(el);
      return htmlConta({ nome: nomeDe(el), paga: 'composta', chance: ns.length / 37, vantagem: VANTAGEM }, unidades * ficha, {
        nota: `${unidades} fichas de ${fichas(ficha)} em ${itens.length} apostas do pano, cobrindo ${ns.length} números. A vantagem continua 2,70%: a pista só junta apostas comuns.`,
      });
    };
    pista.addEventListener('pointerover', e => { const el = alvoDe(e); if (!el) return; destacar(numerosDe(el), true); if (e.pointerType === 'mouse') mostrarDica(el, dica(el)); });
    pista.addEventListener('pointerout', e => { const el = alvoDe(e); if (!el) return; destacar(numerosDe(el), false); esconderDica(el); });
    pista.addEventListener('click', e => {
      const el = alvoDe(e);
      if (!el || girando) return;
      const nome = el.classList.contains('setor') ? el.dataset.anunciada : 'vizinhosde';
      try {
        const itens = s.apostarAnunciada(nome, ficha, Number(el.dataset.viz));
        som.ficha(Math.min(5, itens.length));
        voarFichas({ de: $(`.rack .ficha[data-v="${ficha}"]`), para: el, valor: ficha * Math.min(4, itens.length), duracao: 420, tamanho: 30, somFinal: false });
        pintarFichas(itens.map(([id]) => id));
        pintarRack(); app.atualizarSaldo();
        avisar(`${nomeDe(el)}: ${itens.length} apostas, ${fichas(itens.reduce((q, [, v]) => q + v, 0))} fichas no pano.`);
      } catch (err) { som.negado(); avisar(err.message, { erro: true }); }
    });
  }

  // ---------------------------------------------------------------- ações

  $('.acoes').addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (!b || girando) return;
    const a = b.dataset.a;
    try {
      if (a === 'desfazer') { if (!s.desfazer()) return; som.ficha(1, 0.5); }
      if (a === 'limpar') { if (!s.limpar()) return; som.ficha(4, 0.5); }
      if (a === 'repetir') { if (!s.repetir()) { avisar(s.total() ? 'Limpe o pano para repetir.' : 'Nenhum giro anterior para repetir.'); return; } som.ficha(4); }
      if (a === 'dobrar') { if (!s.dobrar()) return; som.ficha(4); }
    } catch (err) { som.negado(); avisar(err.message, { erro: true }); return; }
    pintarFichas(Object.keys(s.apostas)); pintarRack(); app.atualizarSaldo();
  });

  $('.girar').addEventListener('click', girar);
  $('.rapido').addEventListener('click', () => {
    rapido = !rapido;
    casa.mesa('roleta').rapido = rapido;
    $('.rapido').textContent = rapido ? 'rápido' : 'normal';
  });
  $('.alternar-vista').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    vista = b.dataset.v;
    for (const x of raiz.querySelectorAll('.alternar-vista button')) x.classList.toggle('ativa', x === b);
    raiz.querySelector('.roleta').classList.toggle('mostra-pista', vista === 'pista');
  });
  $('.aba-conta').addEventListener('click', () => conta.classList.toggle('aberta'));

  // ---------------------------------------------------------------- o giro

  function girar() {
    if (girando) return;
    if (!s.total()) { avisar('Ponha uma ficha no pano.'); return; }
    esconderDica();
    app.congelarSaldo();
    let r;
    try { r = s.girar(); } catch (e) { app.liberarSaldo(); avisar(e.message, { erro: true }); return; }
    girando = { r, eventoIdx: 0 };
    raiz.querySelector('.roleta').classList.add('girando');
    atualizarTotais();
    $('.medalha').hidden = true;
    // trajetória física já resolvida para chegar no número sorteado
    giro = simularGiro(r.numero, (r.contador * 2654435761 + r.numero) >>> 0);
    // o crupiê empurra o rotor: da fase atual até a fase de lançamento, com
    // a velocidade inicial do rotor, em 0,9 s
    const q = giro.quadros;
    const alvoVel = (q[9] - q[4]) / (q[5] - q[0]);
    const dur = rapido ? 0.5 : 0.9;
    let alvo = q[4];
    while (alvo < rotorAng + alvoVel * dur * 0.55) alvo += Math.PI * 2;
    while (alvo > rotorAng + alvoVel * dur * 0.55 + Math.PI * 2) alvo -= Math.PI * 2;
    subida = { de: rotorAng, v0: rotorVel, para: alvo, v1: alvoVel, dur, voltas: alvo - q[4], inicio: performance.now() };
    bolaParada = null;
    som.dadosNaMao?.();
    som.rodaLigar();
  }

  function hermite(p0, v0, p1, v1, T, t) {
    const u = t / T, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * v0 * T + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * v1 * T;
  }

  function quadro(agora) {
    if (!vivo) return;
    raf = requestAnimationFrame(quadro);
    const ini = performance.now();
    let bola = null;
    if (subida) {
      const t = Math.min(subida.dur, (agora - subida.inicio) / 1000);
      rotorAng = hermite(subida.de, subida.v0, subida.para, subida.v1, subida.dur, t);
      som.rodaVelocidade(Math.abs(subida.v1) * (t / subida.dur));
      if (t >= subida.dur) { t0 = agora; subida.fim = true; }
      if (subida.fim) { rotorAng = subida.para; subida = { ...subida, fim: false, voando: true }; }
      if (subida.voando) { const sd = subida; subida = null; giro.voltas = sd.voltas; t0 = agora; }
    } else if (giro) {
      const vel = rapido ? 2 : 1;
      const t = (agora - t0) / 1000 * vel;
      const a = amostra(giro, t);
      rotorAng = a.rotor + giro.voltas;
      bola = { phi: a.phi, rho: a.rho, h: a.h, alfa: Math.min(1, t * 4) };
      // som e eventos da física
      const ev = giro.eventos;
      while (girando.eventoIdx < ev.length && ev[girando.eventoIdx].t <= t) {
        const e = ev[girando.eventoIdx++];
        if (e.tipo === 'defletor') som.quique(0.8 * e.forca + 0.2);
        else if (e.tipo === 'quique') som.quique(e.forca * 0.6);
        else if (e.tipo === 'traste') som.tiqueTrasto(e.forca);
        else if (e.tipo === 'assenta') som.assentar();
      }
      const i = Math.min(giro.quadros.length / 5 - 2, Math.floor(t * 60));
      const q = giro.quadros;
      const wb = Math.abs(q[(i + 1) * 5 + 1] - q[i * 5 + 1]) * 60;
      som.bolaVelocidade(a.rho > 0.9 ? wb : wb * 0.4);
      som.rodaVelocidade(Math.abs(q[(i + 1) * 5 + 4] - q[i * 5 + 4]) * 60);
      if (a.fim) chegou(a);
    } else {
      // sem giro: o rotor desacelera até o ritmo de espera, bola na casa
      rotorVel += (0.35 - rotorVel) * 0.004;
      rotorAng += rotorVel / 60;
      if (bolaParada !== null) bola = { phi: bolaParada + rotorAng, rho: 0.605, h: 0 };
    }
    roda.desenhar({ rotorAng, bola });
    medidas.desenho.push(performance.now() - ini);
    if (medidas.desenho.length > 600) medidas.desenho.shift();
  }

  function chegou(a) {
    const { r } = girando;
    const q = giro.quadros;
    rotorVel = (q[q.length - 1] - q[q.length - 6]) * 60;
    bolaParada = a.phi - a.rotor;
    casa.mesa('roleta').bolaPsi = bolaParada;
    giro = null;
    som.rodaDesligar();
    revelar(r);
  }

  async function revelar(r) {
    ultimoNumeroVisivel = r.numero;
    const cor = corDe(r.numero);
    const med = $('.medalha');
    const atributos = r.numero === 0 ? ['zero'] : [cor, r.numero % 2 ? 'ímpar' : 'par', r.numero <= 18 ? '1 a 18' : '19 a 36'];
    med.className = `medalha ${cor}`;
    med.innerHTML = `<b>${r.numero}</b><span>${atributos.join(' · ')}</span>`;
    med.hidden = false;
    aproximar($('.roda-caixa'), roda.pontoDaCasa(r.numero, rotorAng), { escala: 1.12, duracao: 1500 });
    destacar([r.numero], true);
    raiz.querySelectorAll(`.casa[data-n="${r.numero}"]`).forEach(el => el.classList.add('saiu'));
    pintarConta();
    await espera(550);
    // perdedoras desmoronam e vão para o banco
    const vencedoras = new Set(r.ganhos.map(g => g.id));
    const pilhas = [...raiz.querySelectorAll('.fichas-pano .pilha')];
    const voos = [];
    for (const p of pilhas) {
      if (vencedoras.has(p.dataset.id)) { p.classList.add('ganhou'); continue; }
      p.classList.add('desmorona');
      voos.push(voarFichas({ de: p, para: banco, valor: r.apostas[p.dataset.id] ?? 100, duracao: 520, tamanho: 30, maximo: 3, somFinal: false }));
    }
    if (voos.length) som.ficha(Math.min(6, voos.length + 2), 0.7);
    await espera(420);
    for (const p of pilhas) if (!vencedoras.has(p.dataset.id)) p.remove();
    // a casa paga as vencedoras
    let lucro = 0;
    for (const g of r.ganhos) {
      const p = raiz.querySelector(`.fichas-pano .pilha[data-id="${g.id}"]`);
      const premio = g.retorno - g.aposta;
      lucro += premio;
      if (p) {
        await voarFichas({ de: banco, para: p, valor: premio, duracao: 460, tamanho: 32, maximo: 6 });
        p.innerHTML = htmlPilha(g.retorno);
        p.classList.add('paga');
      }
    }
    const liquido = r.retorno - r.apostado;
    const nome = nomeNumero(r.numero).replace(/^./, c => c.toUpperCase());
    if (r.retorno > 0) {
      const multiplo = r.retorno / r.apostado;
      const nivel = multiplo >= 30 ? 5 : multiplo >= 10 ? 4 : multiplo >= 3 ? 3 : multiplo > 1 ? 2 : 1;
      som.vitoria(nivel);
      if (nivel >= 4) { faiscas($('.roda-caixa'), 90); respirar($('.palco'), nivel); }
      avisar(liquido > 0 ? `${nome}. Você recebeu ${fichas(r.retorno)} (${fichas(liquido, { sinal: true })}).` : `${nome}. Voltaram ${fichas(r.retorno)} de ${fichas(r.apostado)}.`);
    } else {
      som.derrota();
      avisar(`${nome}. A casa ficou com ${fichas(r.apostado)}.`);
    }
    await espera(r.retorno > 0 ? 900 : 300);
    // o que sobrou no pano volta para o jogador
    const restantes = [...raiz.querySelectorAll('.fichas-pano .pilha')];
    await Promise.all(restantes.map((p, i) => voarFichas({ de: p, para: app.elementoSaldo(), valor: r.ganhos.find(g => g.id === p.dataset.id)?.retorno ?? 0, atraso: i * 60, duracao: 600, tamanho: 30, maximo: 4 })));
    for (const p of restantes) p.remove();
    app.liberarSaldo();
    destacar([r.numero], false);
    raiz.querySelectorAll('.saiu').forEach(el => el.classList.remove('saiu'));
    girando = false;
    raiz.querySelector('.roleta').classList.remove('girando');
    pintarFichas(); pintarRack();
    if (casa.carteira.saldo < 100) app.oferecerCredito(100);
  }

  const espera = ms => new Promise(res => setTimeout(res, ms));

  // ---------------------------------------------------------------- a conta

  function pintarConta() {
    const c = contaDaMesa(girando ? girando.r.apostas : s.apostas);
    const hist = s.historico.slice(girando && ultimoNumeroVisivel !== s.historico[0] ? 1 : 0, (girando && ultimoNumeroVisivel !== s.historico[0] ? 1 : 0) + 20);
    const qf = s.quentesEFrios(100);
    const comp = s.compromisso();
    conta.innerHTML = `
      <div class="bloco">
        <h4>A conta desta mesa</h4>
        <div class="grande-numero">${pct(VANTAGEM)}</div>
        <p class="explica">de vantagem da casa em qualquer aposta. A roda tem 37 casas e a mesa paga como se tivesse 36: a casa fica com 1 ficha a cada 37.</p>
      </div>
      <div class="bloco">
        <h4>No pano agora</h4>
        <table>
          <tr><td>Apostado</td><td>${fichas(c.total)}</td></tr>
          <tr><td>Perda esperada</td><td class="casa">${c.total ? '−' + fichasFrac(c.perdaEsperada, 3) : '0'}</td></tr>
          <tr><td>Chance de voltar alguma ficha</td><td>${c.total ? pct(c.chanceDeRetorno, 1) : '–'}</td></tr>
          <tr><td>Desvio-padrão do giro</td><td>${c.total ? fichasFrac(Math.sqrt(c.variancia), 1) : '–'}</td></tr>
        </table>
      </div>
      <div class="bloco">
        <h4>Pagamentos</h4>
        <table>${TIPOS_TABELA.map(([t, id]) => { const f = fichaDe(id); return `<tr><td>${NOME_TIPO[t]}</td><td>${f.paga}</td><td>${chance(f.chance)}</td><td class="casa">${pct(f.vantagem)}</td></tr>`; }).join('')}</table>
      </div>
      <div class="bloco">
        <h4>${hist.length === 1 ? 'Último número' : hist.length ? `Últimos ${hist.length} números` : 'Últimos números'}</h4>
        <div class="historico">${hist.map(n => `<span class="n-${corDe(n)}">${n}</span>`).join('') || '<em>nenhum giro ainda</em>'}</div>
      </div>
      <div class="bloco">
        <h4>Quentes e frios${qf.janela >= 10 ? ` em ${qf.janela} giros` : ''}</h4>
        ${qf.janela >= 10 ? `<div class="qf"><div><span>quentes</span>${qf.quentes.map(([n, k]) => `<i class="n-${corDe(n)}">${n}<small>${k}</small></i>`).join('')}</div>
        <div><span>frios</span>${qf.frios.map(([n, k]) => `<i class="n-${corDe(n)}">${n}<small>${k}</small></i>`).join('')}</div></div>` : ''}
        <p class="explica">A roleta não tem memória. Cada número tem 1 chance em 37 em todo giro, não importa o que saiu antes${qf.janela >= 10 ? `: em ${qf.janela} giros o esperado é ${numero(qf.esperado, 1)} vezes cada um, e o que passa disso é ruído` : ''}.${qf.janela < 10 ? ' Os quentes e frios aparecem depois de dez giros.' : ''}</p>
      </div>
      <div class="bloco">
        <h4>Próximo giro</h4>
        <div class="compromisso" title="Conferir">
          <b>HASH PUBLICADO · CONTADOR ${comp.contador}</b>${comp.hash}
        </div>
      </div>`;
    conta.querySelector('.compromisso').onclick = () => app.abrirConferir('roleta');
  }

  // ---------------------------------------------------------------- montar

  function redimensionar() {
    escolherOrientacao();
    roda.dimensionar();
    pintarFichas();
  }
  const ro = new ResizeObserver(() => redimensionar());
  ro.observe(raiz.querySelector('.roda-caixa'));
  addEventListener('resize', redimensionar);

  escolherOrientacao();
  ligarPano();
  ligarPista();
  pintarRack();
  pintarFichas();
  if (ultimoNumeroVisivel !== null && bolaParada === null) bolaParada = 0;
  raf = requestAnimationFrame(quadro);

  const api = {
    sessao: s, medidas,
    desmontar() {
      vivo = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener('resize', redimensionar);
      casa.mesa('roleta').rotorAng = rotorAng % (Math.PI * 2);
      som.rodaDesligar();
      if (girando) app.liberarSaldo();
    },
    get girando() { return !!girando; },
    girar, apostar: (id, v) => { const f = ficha; ficha = v; aoApostar(id); ficha = f; },
  };
  app.mesaAtual = api;
  return api;
}
