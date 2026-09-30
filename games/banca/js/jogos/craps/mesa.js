// A mesa de craps: o pano de verdade, os dados em 3D quicando na parede de
// pirâmides, o disco ON/OFF no ponto, e o modo que destaca as apostas boas e
// apaga as ruins: a mesa mais assustadora do cassino esconde a melhor aposta
// dele, e aqui ela aparece.

import { criarSessaoCraps } from './sessao.js';
import { REGRAS_TEXTO, ZONAS, ZONA_POR_ID, fichaDe, placa as placaRegras } from './regras.js';
import { simularLance, amostraLance, MESA } from './dados.js';
import { criarDesenhoDados } from './desenho-dados.js';
import { panoLargo, panoAba, svgDoPano, ancoras } from './pano.js';
import { DENOMINACOES, svgFicha, htmlPilha } from '../../visual/fichas.js';
import { voarFichas, respirar, faiscas } from '../../visual/efeitos.js';
import { ICONES, avisar, mostrarDica, esconderDica, htmlConta } from '../../ui.js';
import { fichas, fichasFrac, pct, numero } from '../../nucleo/formato.js';
import * as som from '../../som.js';

export function placa() {
  return placaRegras();
}

const ABAS = [['linha', 'Linha e campo'], ['numeros', 'Números'], ['centro', 'Centro']];
const PALAVRA_CLASSE = { boa: 'boa', media: 'média', ruim: 'ruim' };

export function montar(raiz, app, vida) {
  const { casa } = app;
  const s = criarSessaoCraps(casa);
  let ficha = casa.mesa('craps').ficha ?? 500;
  let ocupado = false;
  let estreito = null, aba = casa.mesa('craps').aba ?? 'linha';
  let pano = null, ancora = {};
  // O último lance volta parado onde a física o deixou: a simulação é
  // determinística, então refazê-la com a mesma semente dá o mesmo repouso, com
  // as faces sorteadas para cima (inclusive para quem saiu no meio do lance).
  const ultimoDoHistorico = s.historico[0];
  let lance = null, t0 = 0;
  let ultimoLance = ultimoDoHistorico ? simularLance(ultimoDoHistorico.dados, (s.lances * 2654435761 + ultimoDoHistorico.soma) >>> 0) : null;
  const medidas = { desenho: [] };

  raiz.innerHTML = `
    <div class="feltro"></div><div class="abajur"></div>
    <div class="mesa-grade craps">
      <div class="palco cr-palco">
        <div class="cr-topo">
          <canvas class="cr-pista"></canvas>
          <div class="cr-ponto"></div>
        </div>
        <div class="cr-abas">${ABAS.map(([id, n]) => `<button data-aba="${id}">${n}</button>`).join('')}</div>
        <div class="cr-caixa"><div class="cr-mesa"><div class="cr-fichas"></div><canvas class="cr-dados"></canvas></div><div class="bj-rack cr-banco" aria-hidden="true"></div></div>
        <div class="cr-mensagem mensagem-mesa"></div>
        <div class="rodape-mesa cr-rodape">
          <div class="rack"></div>
          <div class="acoes">
            <label class="cr-boas" title="Destaca as apostas de menor vantagem e apaga as piores"><input type="checkbox" ${casa.prefs.destacarBoas ? 'checked' : ''}> mostrar a conta</label>
            <div class="na-mesa"><span>na mesa</span><b class="v-total">0</b><span class="pe">perda esperada <b class="v-pe">0</b></span></div>
            <button class="btn grande" data-a="lancar">Lançar</button>
          </div>
        </div>
      </div>
      <aside class="conta"></aside>
    </div>
    <button class="aba-conta">${ICONES.conta}<span>a conta</span></button>`;

  const $ = sel => raiz.querySelector(sel);
  const palco = $('.cr-palco');
  const conta = $('.conta');
  const mesa = $('.cr-mesa');
  const desenhoMesa = criarDesenhoDados($('.cr-dados'));
  const desenhoPista = criarDesenhoDados($('.cr-pista'));

  // ---------------------------------------------------------------- pano

  function montarPano() {
    const agora = palco.clientWidth < 700;
    if (agora !== estreito) {
      estreito = agora;
      raiz.querySelector('.craps').classList.toggle('estreito', estreito);
    }
    pano = estreito ? panoAba(aba) : panoLargo();
    ancora = ancoras(pano);
    mesa.querySelector('svg')?.remove();
    mesa.insertAdjacentHTML('afterbegin', svgDoPano(pano));
    mesa.style.aspectRatio = `${pano.vb[2]} / ${pano.vb[3]}`;
    mesa.style.setProperty('--razao', pano.vb[2] / pano.vb[3]);
    for (const b of raiz.querySelectorAll('.cr-abas button')) b.classList.toggle('ativa', b.dataset.aba === aba);
    pintarClasses();
    pintarFichas();
    pintarPuck();
    vida.quadro(dimensionarDados);
  }

  function dimensionarDados() {
    const esc = mesa.clientWidth / pano.vb[2];
    if (!estreito && pano.dados) {
      const d = pano.dados;
      desenhoMesa.dimensionar({ x0: d.x0 * esc, x1: d.x1 * esc, y0: d.y0 * esc, y1: d.y1 * esc });
    } else desenhoMesa.dimensionar({ x0: 0, x1: 1, y0: 0, y1: 1 });
    const p = $('.cr-pista');
    const w = p.clientWidth, h = p.clientHeight;
    desenhoPista.dimensionar({ x0: w * 0.04, x1: w * 0.96, y0: h * 0.16, y1: h * 0.94 });
    desenharEstado();
  }

  function pintarClasses() {
    const liga = casa.prefs.destacarBoas;
    raiz.querySelector('.craps').classList.toggle('mostra-conta', liga);
    for (const el of mesa.querySelectorAll('.zona')) {
      const f = fichaDe(el.dataset.id, s.ponto);
      el.dataset.classe = f.classe;
    }
    let rotulos = '';
    if (liga) {
      const vistos = new Set();
      for (const q of pano.zonas) {
        if (!q.w || vistos.has(q.id) || q.sub) continue;
        vistos.add(q.id);
        const f = fichaDe(q.id, s.ponto);
        rotulos += `<text class="rotulo-casa ${f.classe}" x="${q.x + q.w - 6}" y="${q.y + 15}" text-anchor="end">${pct(f.vantagem, f.vantagem < 0.1 ? 2 : 1)}</text>`;
      }
    }
    mesa.querySelector('.puck-camada').insertAdjacentHTML('beforebegin', `<g class="rotulos-casa">${rotulos}</g>`);
    mesa.querySelectorAll('.rotulos-casa').forEach((g, i, todos) => { if (i < todos.length - 1) g.remove(); });
  }

  function posicaoDe(id) {
    const a = ancora[id];
    if (!a) return null;
    return { left: a[0] / pano.vb[2] * 100, top: a[1] / pano.vb[3] * 100 };
  }

  function pintarFichas(novas = []) {
    const d = Math.max(22, Math.min(40, mesa.clientWidth / pano.vb[2] * (estreito ? 46 : 44)));
    let html = '';
    for (const z of ZONAS) {
      const v = s.apostas[z.id];
      if (!(v > 0)) continue;
      const p = posicaoDe(z.id);
      if (!p) continue;
      html += `<div class="pilha${novas.includes(z.id) ? ' cai' : ''}" data-id="${z.id}" style="left:${p.left}%;top:${p.top}%;--d:${d}px">${htmlPilha(v)}</div>`;
    }
    $('.cr-fichas').innerHTML = html;
    atualizarTotais();
  }

  function pintarPuck() {
    const camada = mesa.querySelector('.puck-camada');
    if (!camada) return;
    let x, y;
    if (s.ponto) {
      const a = pano.zonas.find(q => q.id === `place${s.ponto}`);
      if (!a) { camada.innerHTML = ''; } else { x = a.x + a.w - 22; y = a.y + 22; }
    } else {
      const a = pano.zonas.find(q => q.id === 'dontcome');
      if (a) { x = a.x + a.w - 24; y = a.y + 24; }
    }
    camada.innerHTML = x === undefined ? '' : `<g class="puck ${s.ponto ? 'on' : 'off'}" transform="translate(${x} ${y})"><circle r="19"/><text y="5" text-anchor="middle">${s.ponto ? 'ON' : 'OFF'}</text></g>`;
    $('.cr-ponto').innerHTML = s.ponto ? `ponto <b>${s.ponto}</b>` : 'saída';
  }

  function atualizarTotais() {
    let total = 0, pe = 0;
    for (const z of ZONAS) {
      const v = s.apostas[z.id];
      if (v > 0) { total += v; pe += v * fichaDe(z.id, s.ponto).vantagem; }
    }
    $('.v-total').textContent = fichas(total);
    $('.v-pe').textContent = total ? '−' + fichasFrac(pe, 3) : '0';
    $('[data-a="lancar"]').disabled = ocupado || total === 0;
  }

  // ---------------------------------------------------------------- rack e cliques

  function pintarRack() {
    const saldo = casa.carteira.saldo;
    $('.rack').innerHTML = DENOMINACOES.map(d => `<button class="ficha${d.valor === ficha ? ' escolhida' : ''}" data-v="${d.valor}" ${d.valor > saldo ? 'disabled' : ''}>${svgFicha(d.valor)}</button>`).join('');
  }
  $('.rack').addEventListener('click', e => {
    const b = e.target.closest('.ficha');
    if (!b || b.disabled) return;
    ficha = Number(b.dataset.v);
    casa.mesa('craps').ficha = ficha;
    som.ficha(1, 0.6);
    pintarRack();
  });

  const dicaDe = id => {
    const f = fichaDe(id, s.ponto);
    const z = ZONA_POR_ID[id];
    const pode = s.podeApostar(id);
    const aviso = pode.ok ? '' : ` Agora não: ${pode.motivo}`;
    return htmlConta(f, s.apostas[id] || ficha, { nota: `Aposta ${PALAVRA_CLASSE[f.classe]}. Vantagem por aposta resolvida${z.umLance ? ', decidida num lance só' : ''}.${aviso}` });
  };

  mesa.addEventListener('pointerover', e => { const z = e.target.closest('.zona'); if (z && e.pointerType === 'mouse') mostrarDica(z, dicaDe(z.dataset.id)); });
  mesa.addEventListener('pointerout', e => { const z = e.target.closest('.zona'); if (z) esconderDica(z); });
  mesa.addEventListener('click', e => {
    const z = e.target.closest('.zona');
    if (!z || ocupado) return;
    const id = z.dataset.id;
    try {
      const r = s.apostar(id, ficha);
      som.ficha(1);
      if (r.motivo) avisar(r.motivo, { ms: 4200 });
      voarFichas({ de: $(`.rack .ficha[data-v="${ficha}"]`), para: z, valor: r.valor, duracao: 380, tamanho: 32, somFinal: false });
      pintarFichas([id]); pintarRack(); app.atualizarSaldo(); pintarConta();
    } catch (err) { som.negado(); avisar(err.message, { erro: true }); if (casa.carteira.saldo < 100) app.oferecerCredito(100); }
  });
  mesa.addEventListener('contextmenu', e => {
    const z = e.target.closest('.zona');
    if (!z) return;
    e.preventDefault();
    if (ocupado) return;
    try { s.retirar(z.dataset.id); som.ficha(1, 0.5); pintarFichas(); pintarRack(); app.atualizarSaldo(); pintarConta(); } catch (err) { avisar(err.message, { erro: true }); }
  });
  $('.cr-abas').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    aba = b.dataset.aba;
    casa.mesa('craps').aba = aba;
    montarPano();
  });
  $('.cr-boas input').addEventListener('change', e => {
    casa.prefs.destacarBoas = e.target.checked;
    casa.salvar();
    pintarClasses();
  });
  $('[data-a="lancar"]').addEventListener('click', lancar);
  function tecla(e) {
    if (document.querySelector('.cortina')) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); lancar(); }
  }
  vida.ouvir(window, 'keydown', tecla);

  // ---------------------------------------------------------------- o lance

  const espera = ms => vida.espera(ms);

  function desenhoAtivo() { return estreito ? desenhoPista : desenhoMesa; }

  function desenharEstado(estado) {
    desenhoMesa.desenhar(null);
    desenhoPista.desenhar(null);
    const e = estado ?? (ultimoLance ? amostraLance(ultimoLance, 99) : null);
    if (e) desenhoAtivo().desenhar(e);
  }

  async function lancar() {
    if (ocupado) return;
    let total = 0;
    for (const z of ZONAS) total += s.apostas[z.id] ?? 0;
    if (!total) { avisar('Ponha ao menos uma ficha no pano.'); return; }
    esconderDica();
    const soltar = vida.congelar();
    let r;
    const antes = { ...s.apostas };
    const pontoAntes = s.ponto;
    try { r = s.lancar(); } catch (err) { soltar(); avisar(err.message, { erro: true }); return; }
    ocupado = true;
    atualizarTotais();
    try {
      som.dadosNaMao();
      await espera(260);
      lance = simularLance(r.dados, (s.lances * 2654435761 + r.total) >>> 0);
      await vida.seguir(animarLance());
      ultimoLance = lance;
      lance = null;
      mensagem(textoDoLance(r, pontoAntes));
      await resolverVisual(r, antes);
    } finally {
      ocupado = false;
      soltar();
      pintarClasses(); pintarFichas(); pintarPuck(); pintarRack(); pintarConta();
      if (casa.carteira.saldo < 100) vida.depois(300, () => app.oferecerCredito(100));
    }
  }

  function animarLance() {
    return new Promise(resolve => {
      const eventos = lance.eventos;
      let k = 0;
      t0 = performance.now();
      function quadro(agora) {
        const t = (agora - t0) / 1000;
        const ini = performance.now();
        const a = amostraLance(lance, t);
        desenharEstado(a);
        medidas.desenho.push(performance.now() - ini);
        if (medidas.desenho.length > 600) medidas.desenho.shift();
        while (k < eventos.length && eventos[k].t <= t) {
          const e = eventos[k++];
          if (e.tipo === 'mesa' || e.tipo === 'parede' || e.tipo === 'dados') som.dado(e.forca);
        }
        if (a.fim) { resolve(); return; }
        vida.quadro(quadro);
      }
      vida.quadro(quadro);
    });
  }

  function textoDoLance(r, pontoAntes) {
    const [a, b] = r.dados;
    let t = `${a} e ${b}, ${r.total}${a === b && [4, 6, 8, 10].includes(r.total) ? ' difícil' : ''}`;
    if (!pontoAntes && [7, 11].includes(r.total)) t += ': o passe ganha na saída';
    else if (!pontoAntes && [2, 3, 12].includes(r.total)) t += ': craps na saída';
    else if (!pontoAntes && r.ponto) t += `: o ponto é ${r.ponto}`;
    else if (pontoAntes && r.total === pontoAntes) t += ': o ponto saiu, o passe ganha';
    else if (pontoAntes && r.total === 7) t += ': sete, a rodada acabou';
    return t;
  }

  async function resolverVisual(r, antes) {
    const banco = $('.cr-banco');
    const voos = [];
    const paraSaldo = [];
    for (const e of r.eventos) {
      const p = raiz.querySelector(`.cr-fichas .pilha[data-id="${e.zona}"]`);
      if (e.resultado === 'perdeu') {
        if (p) { p.classList.add('desmorona'); voos.push(voarFichas({ de: p, para: banco, valor: e.aposta, duracao: 520, tamanho: 30, maximo: 3, somFinal: false })); }
      } else if (e.resultado === 'ganhou') {
        const premio = e.permanece ? e.pago : e.pago - e.aposta;
        if (p) voos.push(voarFichas({ de: banco, para: p, valor: premio, duracao: 500, tamanho: 30, maximo: 4 }));
        paraSaldo.push({ id: e.zona, valor: e.pago, fica: e.permanece });
      } else if (e.resultado === 'devolveu') {
        paraSaldo.push({ id: e.zona, valor: e.pago, fica: false });
      } else if (e.resultado === 'moveu') {
        const destino = posicaoDe(e.para);
        if (p && destino) {
          const r2 = mesa.getBoundingClientRect();
          voos.push(voarFichas({ de: p, para: { x: r2.left + destino.left / 100 * r2.width, y: r2.top + destino.top / 100 * r2.height }, valor: e.aposta, duracao: 520, tamanho: 30, maximo: 3 }));
          p.style.opacity = '0';
        }
      }
    }
    await vida.seguir(Promise.all(voos));
    const ganhoTotal = r.eventos.filter(e => e.resultado === 'ganhou').reduce((q, e) => q + (e.permanece ? e.pago : e.pago - e.aposta), 0);
    const perdaTotal = r.eventos.filter(e => e.resultado === 'perdeu').reduce((q, e) => q + e.aposta, 0);
    if (ganhoTotal > 0) {
      const nivel = ganhoTotal >= 3000 * 100 ? 5 : ganhoTotal >= 500 * 100 ? 4 : ganhoTotal >= 100 * 100 ? 3 : ganhoTotal >= 2 * perdaTotal ? 2 : 1;
      som.vitoria(nivel);
      if (nivel >= 4) { faiscas(mesa, 80); respirar(palco, nivel); }
    } else if (perdaTotal > 0) som.derrota();
    if (paraSaldo.length) {
      await espera(450);
      await vida.seguir(Promise.all(paraSaldo.map((x, i) => {
        const p = raiz.querySelector(`.cr-fichas .pilha[data-id="${x.id}"]`);
        return voarFichas({ de: p ?? banco, para: app.elementoSaldo(), valor: x.valor, atraso: i * 60, duracao: 600, tamanho: 28, maximo: 4 });
      })));
    }
  }

  function mensagem(t) {
    const m = $('.cr-mensagem');
    m.textContent = t;
    m.classList.remove('mostra'); void m.offsetWidth; m.classList.add('mostra');
  }

  // ---------------------------------------------------------------- conta

  function pintarConta() {
    const lista = [];
    const vistos = new Set();
    for (const z of ZONAS) {
      if (z.tipo === 'pontovem') continue;
      const chave = z.tipo === 'odds' ? (z.id.startsWith('dont') ? 'odds contra' : 'odds') : z.id.replace(/\d+$/, n => ([6, 8].includes(Number(n)) ? '68' : [5, 9].includes(Number(n)) ? '59' : '410'));
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const f = fichaDe(z.id, null);
      let nome = z.nome;
      if (z.tipo === 'odds') nome = z.id.startsWith('dont') ? 'Odds contra (qualquer ponto)' : 'Odds (qualquer ponto)';
      if (z.tipo === 'place') nome = `Colocação no ${[6, 8].includes(z.numero) ? '6 ou 8' : [5, 9].includes(z.numero) ? '5 ou 9' : '4 ou 10'}`;
      if (z.tipo === 'hard') nome = `${[6, 8].includes(z.numero) ? '6 ou 8' : '4 ou 10'} difícil`;
      if (['three', 'eleven'].includes(z.id)) nome = 'O 3 ou o 11';
      if (['two', 'twelve'].includes(z.id)) nome = 'O 2 ou o 12';
      if (z.id === 'dontcome') nome = 'Não vem';
      lista.push({ nome, f });
    }
    const unicos = [];
    const nomes = new Set();
    for (const x of lista.sort((a, b) => a.f.vantagem - b.f.vantagem)) { if (!nomes.has(x.nome)) { nomes.add(x.nome); unicos.push(x); } }
    const max = Math.max(...unicos.map(x => x.f.vantagem));
    conta.innerHTML = `
      <div class="bloco">
        <h4>A conta desta mesa</h4>
        <p class="explica">Da melhor para a pior, a vantagem da casa por aposta resolvida. As odds pagam o preço justo: são a única aposta do cassino sem vantagem nenhuma, e só existem atrás de uma aposta de linha.</p>
        <table class="escada">${unicos.map(x => `<tr class="${x.f.classe}"><td>${x.nome}<div class="barra-vantagem"><i class="${x.f.vantagem < 1e-12 ? 'zero' : ''}" style="width:${Math.max(2, x.f.vantagem / max * 100)}%"></i></div></td><td class="${x.f.vantagem < 1e-12 ? 'zero' : 'casa'}">${pct(x.f.vantagem, 2)}</td></tr>`).join('')}</table>
      </div>
      <div class="bloco">
        <h4>Últimos lances</h4>
        <div class="historico">${s.historico.slice(0, 16).map(h => `<span class="${h.soma === 7 ? 'sete' : ''}" title="${h.texto}">${h.soma}</span>`).join('') || '<em>nenhum ainda</em>'}</div>
      </div>
      <div class="bloco">
        <h4>Regras da mesa</h4>
        <ul class="regras">${REGRAS_TEXTO.map(t => `<li>${t}</li>`).join('')}</ul>
      </div>
      <div class="bloco">
        <h4>Próximo lance</h4>
        <div class="compromisso"><b>HASH PUBLICADO · CONTADOR ${s.compromisso().contador}</b>${s.compromisso().hash}</div>
      </div>`;
    conta.querySelector('.compromisso').onclick = () => app.abrirConferir('craps');
  }

  $('.aba-conta').addEventListener('click', () => conta.classList.toggle('aberta'));

  // ---------------------------------------------------------------- início

  vida.redimensionar(palco, () => { if (!ocupado) montarPano(); else dimensionarDados(); });
  pintarRack();
  montarPano();
  pintarConta();

  return {
    sessao: s, medidas,
    get ocupado() { return ocupado; },
    lancar,
  };
}
