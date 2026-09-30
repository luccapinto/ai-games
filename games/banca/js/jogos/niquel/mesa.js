// A máquina MALECÓN 57: gabinete déco com letreiro de neon, cinco rolos que
// desaceleram e param em sequência, antecipação quando duas luas já caíram,
// linhas acendendo uma a uma e a comemoração do tamanho do prêmio. O que a
// máquina paga já está decidido quando os rolos começam a girar: eles só
// descem até as paradas que o gerador verificável sorteou.

import { criarSessaoNiquel } from './sessao.js';
import { TIRAS, LINHAS, TABELA, TABELA_DISPERSO, GIROS_GRATIS, APOSTAS_LINHA, N_LINHAS, SIMBOLOS, REGRAS_TEXTO, rtpExato, estatisticas, placa as placaRegras } from './regras.js';
import { imagemDoSimbolo } from './simbolos.js';
import { respirar, faiscas } from '../../visual/efeitos.js';
import { ICONES, avisar, abrirPainel } from '../../ui.js';
import { fichas, fichasFrac, pct, numero, chance } from '../../nucleo/formato.js';
import * as som from '../../som.js';

export function placa() {
  return placaRegras();
}

const NOME = Object.fromEntries(SIMBOLOS.map(s => [s.id, s.nome]));
const CORES_LINHA = ['#ff3d6e', '#35f0d8', '#ffd35a', '#9cc2ff', '#7dff9a', '#ff9a4a', '#e58cff'];
const easeOutBack = u => { const c1 = 1.25, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };

export function montar(raiz, app, vida) {
  const { casa } = app;
  const s = criarSessaoNiquel(casa);
  let ocupado = false, automatico = 0;
  const espera = ms => vida.espera(ms);
  const exato = rtpExato();
  const medidas = { desenho: [] };

  raiz.innerHTML = `
    <div class="feltro azul"></div><div class="abajur"></div>
    <div class="mesa-grade niquel">
      <div class="palco nq-palco">
        <div class="nq-gabinete">
          <div class="nq-letreiro"><span>MALECÓN</span><em>57</em></div>
          <div class="nq-sub">cinco rolos · vinte e cinco linhas · retorno exato de ${pct(exato.rtp)}</div>
          <div class="nq-janela"><canvas class="nq-rolos"></canvas><div class="nq-faixa" hidden></div><div class="nq-comemora" hidden></div></div>
          <div class="nq-painel">
            <div><span>créditos</span><b class="nq-creditos"></b></div>
            <div><span>aposta</span><b class="nq-aposta"></b></div>
            <div><span>ganho</span><b class="nq-ganho">0</b></div>
          </div>
          <div class="nq-linha-msg"></div>
          <div class="nq-botoes">
            <div class="nq-valor"><button class="icone" data-a="menos" title="Menos por linha">−</button><div><span>por linha</span><b class="nq-porlinha"></b></div><button class="icone" data-a="mais" title="Mais por linha">+</button></div>
            <button class="btn fantasma" data-a="tabela">Tabela</button>
            <button class="btn escuro" data-a="auto">Automático</button>
            <button class="nq-girar" data-a="girar" aria-label="Girar"><span>GIRAR</span></button>
          </div>
        </div>
      </div>
      <aside class="conta"></aside>
    </div>
    <button class="aba-conta">${ICONES.conta}<span>a conta</span></button>`;

  const $ = sel => raiz.querySelector(sel);
  const conta = $('.conta');
  const canvas = $('.nq-rolos');
  const g = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, cs = 0, ox = 0, oy = 0;

  // ---------------------------------------------------------------- rolos

  const ultimo = s.ultimo?.paradas ?? [0, 0, 0, 0, 0];
  const rolos = TIRAS.map((t, i) => ({ tira: t, L: t.length, pos: ultimo[i], fase: 'parado', vel: 0, destaque: 0 }));
  let vitrine = null; // { linhas, luas, idx, t }

  function dimensionar() {
    dpr = Math.min(2, devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    cs = Math.min(W / 5, H / 3);
    ox = (W - cs * 5) / 2; oy = (H - cs * 3) / 2;
  }

  function simboloEm(rolo, j) {
    const L = rolo.L;
    return rolo.tira[((j % L) + L) % L];
  }

  function desenhar(t) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const tam = Math.round(cs * dpr * 0.86);
    for (let r = 0; r < 5; r++) {
      const rolo = rolos[r];
      const x = ox + r * cs;
      // fundo do rolo com curvatura de cilindro
      const fundo = g.createLinearGradient(0, oy, 0, oy + cs * 3);
      fundo.addColorStop(0, '#03050f'); fundo.addColorStop(0.18, '#0e1636'); fundo.addColorStop(0.5, '#18265a'); fundo.addColorStop(0.82, '#0e1636'); fundo.addColorStop(1, '#03050f');
      g.fillStyle = fundo;
      g.fillRect(x + 1, oy, cs - 2, cs * 3);
      g.save();
      g.beginPath(); g.rect(x + 1, oy, cs - 2, cs * 3); g.clip();
      const base = Math.floor(rolo.pos);
      const rapido = Math.abs(rolo.vel) > 6;
      for (let j = base - 1; j <= base + 3; j++) {
        const y = oy + (j - rolo.pos) * cs;
        if (y < oy - cs || y > oy + cs * 3) continue;
        const id = simboloEm(rolo, j);
        const img = imagemDoSimbolo(id, tam);
        const lado = cs * 0.86;
        if (rapido) {
          g.globalAlpha = 0.45;
          g.drawImage(img, x + (cs - lado) / 2, y + (cs - lado) / 2 - cs * 0.28, lado, lado * 1.5);
          g.globalAlpha = 1;
        } else {
          const linhaVis = j - Math.round(rolo.pos);
          let escala = 1;
          if (vitrine && rolo.fase === 'parado' && linhaVis >= 0 && linhaVis < 3 && vitrine.marcadas.has(`${r},${linhaVis}`)) escala = 1 + 0.06 * Math.sin(t * 9);
          const l2 = lado * escala;
          g.drawImage(img, x + (cs - l2) / 2, y + (cs - l2) / 2, l2, l2);
        }
      }
      g.restore();
      // sombra de cilindro em cima e embaixo
      const sombra = g.createLinearGradient(0, oy, 0, oy + cs * 3);
      sombra.addColorStop(0, 'rgba(0,0,0,.65)'); sombra.addColorStop(0.2, 'rgba(0,0,0,0)'); sombra.addColorStop(0.8, 'rgba(0,0,0,0)'); sombra.addColorStop(1, 'rgba(0,0,0,.65)');
      g.fillStyle = sombra; g.fillRect(x + 1, oy, cs - 2, cs * 3);
      // antecipação: o rolo que ainda gira brilha
      if (rolo.destaque > 0) {
        g.strokeStyle = `rgba(53,240,216,${0.5 + 0.4 * Math.sin(t * 16)})`;
        g.lineWidth = 3;
        g.strokeRect(x + 3, oy + 2, cs - 6, cs * 3 - 4);
      }
      g.fillStyle = 'rgba(201,164,92,.8)'; g.fillRect(x + cs - 1, oy, 2, cs * 3);
    }
    if (vitrine) desenharVitrine(t);
  }

  // Linha vencedora da vez: moldura nos símbolos e o traço de neon.
  function desenharVitrine(t) {
    const { linhas, luas } = vitrine;
    for (const [r, f] of luas) {
      g.strokeStyle = `rgba(53,240,216,${0.7 + 0.3 * Math.sin(t * 8)})`; g.lineWidth = 3;
      g.strokeRect(ox + r * cs + 4, oy + f * cs + 4, cs - 8, cs - 8);
    }
    if (!linhas.length) return;
    const k = Math.floor(t / 1.1) % linhas.length;
    const l = linhas[k];
    const cor = CORES_LINHA[l.linha % CORES_LINHA.length];
    const fila = LINHAS[l.linha];
    g.save();
    g.shadowColor = cor; g.shadowBlur = 12;
    g.strokeStyle = cor; g.lineWidth = 3.5; g.lineJoin = 'round';
    g.beginPath();
    for (let r = 0; r < 5; r++) {
      const x = ox + r * cs + cs / 2, y = oy + fila[r] * cs + cs / 2;
      r ? g.lineTo(x, y) : g.moveTo(x - cs * 0.5, y);
    }
    g.lineTo(ox + 5 * cs, oy + fila[4] * cs + cs / 2);
    g.stroke();
    g.restore();
    g.strokeStyle = cor; g.lineWidth = 2.5;
    for (let r = 0; r < l.quantidade; r++) g.strokeRect(ox + r * cs + 5, oy + fila[r] * cs + 5, cs - 10, cs - 10);
    $('.nq-linha-msg').textContent = `linha ${l.linha + 1}: ${l.quantidade} ${NOME[l.simbolo]} · ${fichas(l.pago)}`;
  }

  let anterior = performance.now();
  function quadro(agora) {
    vida.quadro(quadro);
    const dt = Math.min(0.05, (agora - anterior) / 1000);
    anterior = agora;
    const ini = performance.now();
    for (const rolo of rolos) {
      if (rolo.fase === 'girando') {
        rolo.pos -= rolo.vel * dt;
      } else if (rolo.fase === 'parando') {
        const u = Math.min(1, (agora - rolo.t0) / rolo.dur);
        rolo.pos = rolo.de + (rolo.para - rolo.de) * easeOutBack(u);
        rolo.vel = u < 0.6 ? rolo.vel : 0;
        if (u >= 1) { rolo.pos = rolo.para; rolo.fase = 'parado'; rolo.vel = 0; rolo.resolver?.(); }
      }
    }
    desenhar(agora / 1000);
    medidas.desenho.push(performance.now() - ini);
    if (medidas.desenho.length > 600) medidas.desenho.shift();
  }

  function pararRolo(i, parada) {
    return new Promise(resolve => {
      const rolo = rolos[i];
      const L = rolo.L;
      // o maior alvo abaixo de pos - 4 que caia na parada sorteada
      let alvo = Math.floor(rolo.pos) - 4;
      alvo -= ((alvo - parada) % L + L) % L;
      rolo.de = rolo.pos; rolo.para = alvo; rolo.t0 = performance.now();
      rolo.dur = 420 + (rolo.de - alvo) * 14;
      rolo.fase = 'parando';
      rolo.destaque = 0;
      rolo.resolver = () => { som.paradaRolo(i); resolve(); };
    });
  }

  // ---------------------------------------------------------------- jogo

  function pintarPainel(ganho = null) {
    $('.nq-creditos').textContent = fichas(casa.carteira.saldo);
    const linha = s.emGirosGratis ? casa.mesa('niquel').apostaDoBonus : s.apostaLinha;
    $('.nq-aposta').textContent = s.emGirosGratis ? 'grátis' : fichas(s.totalAposta());
    $('.nq-porlinha').textContent = fichas(linha, { casas: 2 });
    if (ganho !== null) $('.nq-ganho').textContent = fichas(ganho);
    const faixa = $('.nq-faixa');
    faixa.hidden = !s.emGirosGratis;
    if (s.emGirosGratis) faixa.innerHTML = `GIROS GRÁTIS · faltam ${s.girosRestantes} · prêmios × ${GIROS_GRATIS.multiplicador} · no bônus ${fichas(s.ganhoDoBonus)}`;
    raiz.querySelector('.niquel').classList.toggle('bonus', s.emGirosGratis);
    $('[data-a="menos"]').disabled = $('[data-a="mais"]').disabled = ocupado || s.emGirosGratis;
    $('.nq-girar').disabled = ocupado && !automatico;
    $('[data-a="auto"]').classList.toggle('ativo', automatico > 0);
    $('[data-a="auto"]').textContent = automatico > 0 ? `Parar (${automatico})` : 'Automático';
  }

  raiz.querySelector('.nq-botoes').addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'menos' || a === 'mais') {
      const i = APOSTAS_LINHA.indexOf(s.apostaLinha);
      const j = Math.max(0, Math.min(APOSTAS_LINHA.length - 1, i + (a === 'mais' ? 1 : -1)));
      s.definirApostaLinha(APOSTAS_LINHA[j]);
      som.clique();
      pintarPainel(); pintarConta();
    }
    if (a === 'tabela') abrirTabela();
    if (a === 'auto') { automatico = automatico ? 0 : 10; pintarPainel(); if (automatico && !ocupado) girar(); }
    if (a === 'girar') girar();
  });
  function tecla(e) {
    if (document.querySelector('.cortina')) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); girar(); }
  }
  vida.ouvir(window, 'keydown', tecla);

  async function girar() {
    if (ocupado) return;
    const custo = s.emGirosGratis ? 0 : s.totalAposta();
    if (custo > casa.carteira.saldo) {
      automatico = 0; pintarPainel();
      if (!app.oferecerCredito(custo)) avisar('Saldo insuficiente para esse giro.', { erro: true });
      return;
    }
    ocupado = true;
    vitrine = null;
    $('.nq-linha-msg').textContent = '';
    $('.nq-comemora').hidden = true;
    const soltar = vida.congelar();
    let r;
    try { r = s.girar(); } catch (err) { ocupado = false; soltar(); avisar(err.message, { erro: true }); return; }
    // o débito aparece na hora; o prêmio só depois dos rolos
    $('.nq-creditos').textContent = fichas(casa.carteira.saldo - r.avaliacao.total);
    pintarPainel(0);
    try {
      for (const rolo of rolos) { rolo.fase = 'girando'; rolo.vel = 16 + Math.random() * 2; }
      som.rolosLigar();
      await espera(r.gratis ? 520 : 780);
      let luas = 0;
      for (let i = 0; i < 5; i++) {
        if (luas >= 2 && i >= 2) {
          // antecipação: duas luas já na janela, os rolos seguintes demoram mais
          for (let k = i; k < 5; k++) rolos[k].destaque = 1;
          som.antecipacao(1.1);
          await espera(1050);
        } else if (i > 0) await espera(r.gratis ? 170 : 240);
        await vida.seguir(pararRolo(i, r.paradas[i]));
        luas += [0, 1, 2].filter(f => simboloEm(rolos[i], r.paradas[i] + f) === 'lua').length;
      }
      som.rolosDesligar();
      await apresentar(r);
    } finally {
      soltar();
      ocupado = false;
      pintarPainel(); pintarConta();
    }
    // bônus em andamento ou automático: o próximo giro sai sozinho
    if (s.emGirosGratis) { await espera(900); girar(); }
    else if (automatico > 0) { automatico--; pintarPainel(); if (automatico > 0) { await espera(700); if (automatico > 0) girar(); } }
  }

  async function apresentar(r) {
    const av = r.avaliacao;
    const marcadas = new Set();
    for (const l of av.linhas) for (let k = 0; k < l.quantidade; k++) marcadas.add(`${k},${LINHAS[l.linha][k]}`);
    const luas = av.disperso.quantidade >= 3 ? av.disperso.posicoes : [];
    for (const [a, b] of luas) marcadas.add(`${a},${b}`);
    vitrine = { linhas: av.linhas, luas, marcadas };
    const aposta = r.gratis ? casa.mesa('niquel').apostaDoBonus * N_LINHAS : s.totalAposta();
    if (av.total > 0) {
      const mult = av.total / aposta;
      const nivel = mult >= 60 ? 5 : mult >= 25 ? 4 : mult >= 10 ? 3 : mult >= 2 ? 2 : 1;
      som.vitoria(nivel);
      await vida.seguir(contarGanho(av.total, nivel));
      if (nivel >= 3) {
        const c = $('.nq-comemora');
        c.hidden = false;
        c.innerHTML = `<b>${nivel === 5 ? 'PRÊMIO ENORME' : nivel === 4 ? 'GRANDE PRÊMIO' : 'PRÊMIO BOM'}</b><span>${fichas(av.total)} · ${numero(mult, 0)} vezes a aposta</span>`;
        respirar($('.nq-gabinete'), nivel);
        faiscas($('.nq-janela'), 30 * nivel);
        await espera(900 + nivel * 300);
      }
    } else if (!r.gratis) som.derrota();
    const ev = r.eventos.find(e => e.tipo === 'gratis');
    if (ev) {
      const f = $('.nq-faixa');
      f.hidden = false;
      f.innerHTML = ev.retomada ? `MAIS ${ev.giros} GIROS GRÁTIS` : `${ev.giros} GIROS GRÁTIS · PRÊMIOS × ${GIROS_GRATIS.multiplicador}`;
      f.classList.remove('pulsa'); void f.offsetWidth; f.classList.add('pulsa');
      som.vitoria(3);
      await espera(1500);
    }
    const fim = r.eventos.find(e => e.tipo === 'bonusFim');
    if (fim) avisar(`Bônus encerrado: ${fichas(fim.ganho)} fichas em ${fim.giros} giros grátis.`, { ms: 4000 });
  }

  function contarGanho(v, nivel) {
    return new Promise(res => {
      const el = $('.nq-ganho');
      const ini = performance.now(), dur = Math.min(3800, 400 + nivel * 500);
      function passo() {
        const p = Math.min(1, (performance.now() - ini) / dur);
        el.textContent = fichas(Math.round(v * (1 - Math.pow(1 - p, 2))));
        if (p < 1) vida.quadro(passo); else { el.textContent = fichas(v); res(); }
      }
      vida.quadro(passo);
    });
  }

  // ---------------------------------------------------------------- tabela e conta

  function abrirTabela() {
    const combos = exato.combinacoes;
    const linhaDe = id => [3, 4, 5].map(q => combos.find(c => c.simbolo === id && c.quantidade === q));
    const sims = Object.keys(TABELA);
    abrirPainel('tabela-niquel', `
      <h2>Tabela do Malecón 57</h2>
      <p class="sub">Prêmio em múltiplos da aposta de linha, com três, quatro ou cinco iguais seguidos a partir do primeiro rolo. A chance é por linha, calculada pela enumeração das tiras; a última coluna é quanto cada símbolo devolve do que você aposta.</p>
      <div class="rolagem"><table class="livro-tabela nq-tabela">
        <thead><tr><th>Símbolo</th><th>3</th><th>4</th><th>5</th><th>chance por linha</th><th>devolve</th></tr></thead>
        <tbody>${sims.map(id => {
          const [a, b, c] = linhaDe(id);
          const p = (a?.p ?? 0) + (b?.p ?? 0) + (c?.p ?? 0);
          const contr = (a?.contribuicao ?? 0) + (b?.contribuicao ?? 0) + (c?.contribuicao ?? 0);
          return `<tr><td><span class="nq-ico" data-id="${id}"></span>${NOME[id]}${id === 'casa' ? ' <em>curinga</em>' : ''}</td><td>${TABELA[id][0]}</td><td>${TABELA[id][1]}</td><td>${TABELA[id][2]}</td><td>${chance(p)}</td><td>${pct(contr, 2)}</td></tr>`;
        }).join('')}
        <tr><td><span class="nq-ico" data-id="lua"></span>Lua de Havana <em>em qualquer lugar</em></td><td>${TABELA_DISPERSO[3]}×</td><td>${TABELA_DISPERSO[4]}×</td><td>${TABELA_DISPERSO[5]}×</td><td>${chance(exato.chanceBonus)}</td><td>${pct(exato.disperso, 2)}</td></tr>
        <tr><td>Giros grátis (${GIROS_GRATIS[3]}, ${GIROS_GRATIS[4]} ou ${GIROS_GRATIS[5]}, prêmios × ${GIROS_GRATIS.multiplicador})</td><td colspan="4"></td><td>${pct(exato.bonus, 2)}</td></tr>
        <tr class="soma"><td>Retorno total</td><td colspan="4"></td><td>${pct(exato.rtp, 2)}</td></tr>
        </tbody></table></div>
      <p class="nota-painel">A lua paga em múltiplos da aposta total. A Casa substitui qualquer símbolo menos a lua. Cada linha paga só o seu maior prêmio.</p>`);
    document.querySelectorAll('.nq-ico').forEach(el => {
      const c = imagemDoSimbolo(el.dataset.id, 64);
      const img = document.createElement('canvas');
      img.width = 64; img.height = 64; img.getContext('2d').drawImage(c, 0, 0);
      el.append(img);
    });
  }

  function pintarConta() {
    const e = estatisticas();
    const aposta = s.totalAposta();
    conta.innerHTML = `
      <div class="bloco">
        <h4>A conta desta máquina</h4>
        <div class="grande-numero">${pct(exato.rtp)}</div>
        <p class="explica">de retorno, calculado de forma exata: para cada linha, os cinco símbolos visíveis são independentes e têm a distribuição das tiras, então a enumeração das combinações dá o valor esperado sem sorteio nenhum. Os giros grátis entram como um processo de ramificação. A casa fica com ${pct(1 - exato.rtp)}.</p>
        <table>
          <tr><td>Aposta por giro</td><td>${fichas(aposta)}</td></tr>
          <tr><td>Perda esperada por giro</td><td class="casa">−${fichasFrac(aposta * (1 - exato.rtp), 3)}</td></tr>
          <tr><td>Giros com algum prêmio</td><td>${pct(e.medido.acerto, 1)}</td></tr>
          <tr><td>Bônus de giros grátis</td><td>${chance(exato.chanceBonus)}</td></tr>
          <tr><td>Desvio-padrão por giro</td><td>${numero(e.medido.desvio, 2)} apostas</td></tr>
        </table>
        <p class="explica">Um terço dos giros "ganha" alguma coisa, mas a maioria desses prêmios é menor que a aposta: é assim que a máquina parece generosa e continua ficando com ${pct(1 - exato.rtp)}.</p>
        <button class="btn fantasma" data-a2="tabela">Ver a tabela inteira</button>
      </div>
      <div class="bloco">
        <h4>Últimos giros</h4>
        <div class="historico nq-hist">${s.historico.slice(0, 14).map(h => `<span class="${h.retorno > h.apostado ? 'bom' : h.retorno > 0 ? '' : 'ruim'}" title="${h.texto}">${h.gratis ? 'G ' : ''}${fichas(h.retorno - h.apostado, { sinal: true })}</span>`).join('') || '<em>nenhum ainda</em>'}</div>
      </div>
      <div class="bloco">
        <h4>Regras da máquina</h4>
        <ul class="regras">${REGRAS_TEXTO.map(t => `<li>${t}</li>`).join('')}</ul>
      </div>
      <div class="bloco">
        <h4>Próximo giro</h4>
        <div class="compromisso"><b>HASH PUBLICADO · CONTADOR ${s.compromisso().contador}</b>${s.compromisso().hash}</div>
      </div>`;
    conta.querySelector('.compromisso').onclick = () => app.abrirConferir('niquel');
    conta.querySelector('[data-a2="tabela"]').onclick = abrirTabela;
  }

  $('.aba-conta').addEventListener('click', () => conta.classList.toggle('aberta'));

  // ---------------------------------------------------------------- início

  vida.redimensionar(canvas, dimensionar);
  dimensionar();
  pintarPainel(0);
  pintarConta();
  vida.quadro(quadro);
  // giros grátis que ficaram guardados quando o jogador saiu recomeçam sozinhos
  if (s.emGirosGratis) vida.depois(1200, girar);
  vida.aoMorrer(() => { automatico = 0; som.rolosDesligar(); });

  return {
    sessao: s, medidas,
    get ocupado() { return ocupado; },
    girar,
  };
}
