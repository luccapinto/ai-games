// A cola: entrada, paineis, laco de quadro e menu. O unico arquivo que sabe
// que existe DOM.
//
// A simulacao anda em passo fixo de 1/60 e a velocidade escolhida (1x, 2x, 4x)
// so muda quantos passos rodam por quadro. Isso mantem a partida identica a
// que o robo de provas.mjs roda em Node — velocidade nao altera equilibrio.

import { CELULA, LARGURA, ALTURA, MAPAS } from './mapas.js';
import {
  TORRES, TORRE_POR_ID, PRAGAS, DANOS, ORDEM_DANOS, MODOS, HABILIDADES,
  HABILIDADE_POR_ID, TROCA_DE_MODO,
} from './dados.js';
import { descreverOnda, estreias, TOTAL_ONDAS } from './ondas.js';
import {
  criarJogo, passo, construir, melhorar, vender, trocarModo, modosDisponiveis,
  comecarOnda, temProximaOnda, usarHabilidade, custoDe, ocupado, torreEm,
  fichaTorre, fichaPraga, estadoVram, consumirEventos, comprarGpu, precoGpu,
  DT,
} from './jogo.js';
import { Render } from './render.js';
import { Som } from './som.js';

const $ = s => document.querySelector(s);
const el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};
const n1 = v => (Math.round(v * 10) / 10).toLocaleString('pt-BR');
const n0 = v => Math.round(v).toLocaleString('pt-BR');

const tela = $('#tela');
const render = new Render(tela);
const som = new Som();

let jogo = null;
let velocidade = 2;
let pausado = false;
let aba = 'loja';
let mapaEscolhido = 'datacenter';
let resto = 0;
let ultimo = performance.now();
let tRepintar = 0;

const ui = {
  colocando: null,
  custoColocando: 0,
  selecionada: null,
  pragaSelecionada: null,
  celula: null,
  ocupado: (x, y) => (jogo ? ocupado(jogo, x, y) : false),
};

// ------------------------------------------------------------------- brinde
let tBrinde = 0;
function brindar(txt) {
  const b = $('#brinde');
  b.textContent = txt;
  b.classList.remove('oculto');
  tBrinde = 2.2;
}

// -------------------------------------------------------------------- menu

function pintarMenu() {
  const caixa = $('#mapas');
  caixa.innerHTML = '';
  for (const m of MAPAS) {
    const b = el('button', 'mapa-cartao' + (m.id === mapaEscolhido ? ' ligada' : ''));
    const mini = el('canvas');
    mini.width = 200; mini.height = 125;
    desenharMini(mini, m);
    b.append(mini, el('b', null, m.nome), el('i', null, m.apelido), el('p', null, m.dica));
    const nums = el('div', 'nums');
    nums.append(
      el('span', null, `VRAM ${m.vram}`),
      el('span', null, `US$ ${m.dinheiro}`),
      el('span', null, `${m.vidas} de integridade`),
      el('span', null, `${m.construivel.size} lajes`),
    );
    b.append(nums);
    b.onclick = () => { mapaEscolhido = m.id; pintarMenu(); };
    caixa.append(b);
  }
}

function desenharMini(c, m) {
  const g = c.getContext('2d');
  const e = c.width / LARGURA;
  const ey = c.height / ALTURA;
  g.fillStyle = m.piso;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(126,164,196,.22)';
  for (const k of m.construivel) g.fillRect((k % LARGURA) * e, Math.floor(k / LARGURA) * ey, e - 0.5, ey - 0.5);
  g.strokeStyle = '#4b6484';
  g.lineWidth = Math.max(2, e * 0.7);
  g.lineJoin = 'round';
  for (const r of m.rotas) {
    g.beginPath();
    r.cels.forEach(([x, y], i) => {
      const px = (x + 0.5) * e;
      const py = (y + 0.5) * ey;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    });
    g.stroke();
  }
  g.fillStyle = '#6ef0a8';
  g.fillRect((m.base.x) * e, (m.base.y) * ey, e * 1.2, ey * 1.2);
}

// ------------------------------------------------------------------ partida

function comecar(modo) {
  jogo = criarJogo({ mapa: mapaEscolhido, modo, semente: 20260917 });
  ui.colocando = null;
  ui.selecionada = null;
  ui.pragaSelecionada = null;
  pausado = false;
  velocidade = 2;
  render.mapaDesenhado = null;
  render.particulas.length = 0;
  render.flutuantes.length = 0;
  $('#menu').classList.add('oculto');
  $('#fim').classList.add('oculto');
  $('#manual').classList.add('oculto');
  no['m-mapa'].textContent = jogo.mapa.nome + (modo === 'semfim' ? ' — SEM FIM' : '');
  // Os caches de escrita no DOM guardam o ultimo valor visto; partida nova
  // comeca com eles limpos, senao o topo herda o numero da partida passada.
  for (const k of Object.keys(visto)) delete visto[k];
  som.acordar();
  mudarVelocidade(2);
  trocarAba('loja');
  pintarTopo();
  ultimo = performance.now();
}

// -------------------------------------------------------------------- abas

function trocarAba(a) {
  aba = a;
  for (const b of document.querySelectorAll('#abas .aba')) b.classList.toggle('ligada', b.dataset.aba === a);
  for (const p of ['loja', 'info', 'onda', 'feed']) $('#painel-' + p).classList.toggle('oculto', p !== a);
  pintarTudo();
}

function pintarTudo() {
  if (!jogo) return;
  if (aba === 'loja') pintarLoja();
  else if (aba === 'info') pintarFicha();
  else if (aba === 'onda') pintarOnda();
  else pintarFeed();
}

// -------------------------------------------------------------------- loja

// A loja e construida uma vez e depois so atualizada. Reconstruir os onze
// cartoes quatro vezes por segundo derrubava o quadro sozinho: no medidor de
// 120 pragas, o DOM custava mais que a simulacao e o desenho somados.
let cartoes = null;
let btGpu = null;

function montarLoja() {
  const p = $('#painel-loja');
  p.innerHTML = '';
  cartoes = [];
  for (const classe of ['modelo', 'infra']) {
    p.append(el('div', 'grupo-titulo', classe === 'modelo'
      ? 'MODELOS — as torres que atiram'
      : 'INFRAESTRUTURA — nao atiram, sustentam'));
    for (const d of TORRES.filter(t => t.classe === classe)) {
      const b = el('button', 'cartao');
      const gl = el('div', 'glifo', d.glifo);
      gl.style.color = d.cor;
      const meio = el('div');
      meio.append(el('div', 'nome', d.nome));
      const sub = d.naoAtira
        ? (d.capacidade ? `+${d.capacidade} de VRAM, raio ${n1(d.alcance)}`
          : d.rendaOnda ? `US$ ${d.rendaOnda} por onda, raio ${n1(d.alcance)}`
            : `aura de cadencia, raio ${n1(d.alcance)}`)
        : `${DANOS[d.tipoDano].nome} ${d.dano} x ${n1(d.cadencia)}/s, alcance ${n1(d.alcance)}`;
      meio.append(el('div', 'sub', sub));
      const preco = el('div', 'preco');
      const valor = el('b');
      preco.append(valor, el('span', null, `${n1(d.vram)} VRAM`));
      b.append(gl, meio, preco);
      b.onclick = () => {
        ui.colocando = ui.colocando === d.id ? null : d.id;
        ui.custoColocando = custoDe(jogo, d.id);
        ui.selecionada = null;
        ui.pragaSelecionada = null;
        pintarLoja();
      };
      p.append(b);
      cartoes.push({ d, b, valor, ultimo: -1, caro: null, ligada: null });
    }
  }

  const caixa = el('div', 'loja-gpu');
  caixa.append(el('b', null, 'O DE CASACO DE COURO'));
  caixa.append(el('p', null, 'A mais nova e sempre a mais barata por FLOP, ele diz. Mais 8 de VRAM no cluster. Cada compra encarece a proxima em 62%.'));
  btGpu = el('button', 'bt destaque');
  btGpu.onclick = () => { if (comprarGpu(jogo)) { som.gpu(); pintarTudo(); } else som.negado(); };
  caixa.append(btGpu);
  p.append(caixa);
}

function pintarLoja() {
  if (!cartoes) montarLoja();
  for (const c of cartoes) {
    const custo = custoDe(jogo, c.d.id);
    if (custo !== c.ultimo) { c.ultimo = custo; c.valor.textContent = 'US$ ' + n0(custo); }
    const caro = jogo.dinheiro < custo;
    if (caro !== c.caro) { c.caro = caro; c.b.classList.toggle('cara', caro); }
    const ligada = ui.colocando === c.d.id;
    if (ligada !== c.ligada) { c.ligada = ligada; c.b.classList.toggle('ligada', ligada); }
  }
  const preco = precoGpu(jogo);
  const txt = `COMPRAR GPU — US$ ${n0(preco)}${jogo.loja.desconto ? '  (-35% NESTA ONDA)' : ''}`;
  if (btGpu.textContent !== txt) btGpu.textContent = txt;
  btGpu.disabled = jogo.dinheiro < preco;
}

// ------------------------------------------------------------------- ficha

function pintarFicha() {
  const p = $('#painel-info');
  p.innerHTML = '';
  if (ui.selecionada && jogo.torres.includes(ui.selecionada)) fichaDeTorre(p, ui.selecionada);
  else if (ui.pragaSelecionada && !ui.pragaSelecionada.morta) fichaDePraga(p, ui.pragaSelecionada);
  else {
    p.append(el('p', 'vazio', 'Clique numa torre ou numa praga do mapa para ver os numeros exatos dela: dano por segundo, alcance em celulas, cadencia, HP, resistencias e cada efeito ativo com o tempo que falta.'));
  }
}

function linhaNum(pai, rotulo, valor, classe) {
  const d = el('div', classe);
  d.append(el('span', null, rotulo), el('b', null, valor));
  pai.append(d);
  return d;
}

function fichaDeTorre(p, t) {
  const f = fichaTorre(jogo, t);
  const topo = el('div', 'ficha-topo');
  const gl = el('div', 'glifo', f.glifo);
  gl.style.color = f.cor;
  const tit = el('div');
  tit.append(el('h3', null, f.nome), el('p', null, `${f.familia} — ${f.classe === 'modelo' ? 'modelo' : 'infraestrutura'}`));
  topo.append(gl, tit);
  p.append(topo);
  p.append(el('p', 'frase', f.frase));

  if (f.estados.length) {
    const et = el('div', 'etiquetas');
    for (const e of f.estados) {
      const x = el('span', 'etiqueta', e);
      x.style.color = e.startsWith('PROTEGIDA') || e.startsWith('AUDITADA') ? '#6ef0a8' : '#ff8f6b';
      et.append(x);
    }
    p.append(et);
  }

  p.append(el('div', 'secao', 'O QUE ELA FAZ AGORA'));
  const g = el('div', 'numeros');
  linhaNum(g, 'DANO/S', n1(f.dps), 'largo bom');
  linhaNum(g, 'DANO', n1(f.dano));
  linhaNum(g, 'TIPO', f.roteador ? 'ROTEADOR' : DANOS[f.tipoDano].nome);
  linhaNum(g, 'CADENCIA', n1(f.cadencia) + '/s');
  linhaNum(g, 'ALCANCE', n1(f.alcance) + ' cel');
  linhaNum(g, 'MIRA', n1(f.mira) + ' s');
  linhaNum(g, 'ERRA', (f.erro * 100).toFixed(1) + '%');
  linhaNum(g, 'VRAM', n1(f.vram), f.vram > 6 ? 'ruim' : '');
  linhaNum(g, 'ALVOS', String(f.alvos));
  if (f.area) linhaNum(g, 'AREA', 'raio ' + n1(f.area));
  if (f.perfura) linhaNum(g, 'ATRAVESSA', String(f.perfura));
  if (f.dot) linhaNum(g, 'CONTINUO', n1(f.dot) + '/s');
  if (f.marca) linhaNum(g, 'MARCA', '+' + Math.round(f.marca * 100) + '% recebido');
  if (f.lentidao) linhaNum(g, 'LENTIDAO', '-' + Math.round(f.lentidao * 100) + '%');
  if (f.furaResist) linhaNum(g, 'FURA RESIST', Math.round(f.furaResist * 100) + '%');
  if (f.capacidade) linhaNum(g, 'DA DE VRAM', '+' + n1(f.capacidade), 'bom');
  if (f.rendaOnda) linhaNum(g, 'POR ONDA', 'US$ ' + n0(f.rendaOnda), 'bom');
  if (f.rendaMorte) linhaNum(g, 'POR MORTE', 'US$ ' + n0(f.rendaMorte), 'bom');
  if (f.auraCadencia) linhaNum(g, 'AURA CADENCIA', '+' + Math.round(f.auraCadencia * 100) + '%');
  if (f.auraDano) linhaNum(g, 'AURA DANO', '+' + Math.round(f.auraDano * 100) + '%');
  if (f.auraErro) linhaNum(g, 'AURA ERRO', '-' + Math.round(f.auraErro * 100) + '%');
  if (f.auraCadencia || f.auraDano || f.auraErro || f.capacidade) linhaNum(g, 'RAIO DA AURA', n1(f.auraRaio) + ' cel');
  if (f.acumulo) linhaNum(g, 'ACUMULADO', '+' + Math.round(f.acumulo * 100) + '%', 'bom');
  linhaNum(g, 'ABATES', n0(f.abates));
  linhaNum(g, 'DANO TOTAL', n0(f.danoTotal));
  p.append(g);

  const tags = el('div', 'etiquetas');
  if (f.deteccao) { const x = el('span', 'etiqueta', 'DETECCAO'); x.style.color = '#6ef0a8'; tags.append(x); }
  if (f.antiaereo) { const x = el('span', 'etiqueta', 'ANTIAEREO'); x.style.color = '#7ee2ff'; tags.append(x); }
  if (f.recusa) { const x = el('span', 'etiqueta', 'RECUSA ALVO DISFARCADO'); x.style.color = '#ffd166'; tags.append(x); }
  if (f.roteador) { const x = el('span', 'etiqueta', 'ROTEIA: ' + f.roteador.map(r => DANOS[r].curto).join(' ')); x.style.color = '#5fe0d0'; tags.append(x); }
  if (tags.children.length) p.append(tags);

  p.append(el('div', 'secao', 'FICHA TECNICA REAL DO MODELO'));
  const r = el('div', 'numeros');
  linhaNum(r, 'PRECO', f.real.preco, 'largo');
  linhaNum(r, 'BENCHMARK', f.real.bench);
  linhaNum(r, 'VELOCIDADE', f.real.tps);
  linhaNum(r, 'CONTEXTO', f.real.ctx);
  linhaNum(r, 'PRIMEIRO TOKEN', f.real.ttft);
  linhaNum(r, 'ALUCINACAO', f.real.aluc);
  linhaNum(r, 'TAMANHO', f.real.peso);
  p.append(r);

  p.append(el('div', 'secao', 'MODO DE SERVIR — US$ ' + TROCA_DE_MODO + ' PARA TROCAR'));
  const mods = el('div', 'modos');
  for (const id of modosDisponiveis(t.tipo)) {
    const b = el('button', 'modo' + (t.modoServir === id ? ' ligada' : ''), MODOS[id].nome);
    b.title = MODOS[id].desc;
    b.onclick = () => { if (trocarModo(jogo, t, id)) { som.melhorou(); pintarTudo(); } else som.negado(); };
    mods.append(b);
  }
  p.append(mods);
  p.append(el('p', 'frase', MODOS[t.modoServir].desc));

  p.append(el('div', 'secao', 'CAMINHOS DE UPGRADE — SUBIR UM FECHA O OUTRO'));
  f.caminhos.forEach((c, i) => {
    const caixa = el('div', 'caminho' + (c.travado ? ' travado' : ''));
    const topo2 = el('div', 'caminho-topo');
    topo2.append(el('b', null, c.nome));
    const pips = el('div', 'pips');
    for (let k = 0; k < 3; k++) pips.append(el('span', 'pip' + (k < c.nivel ? ' cheio' : '')));
    topo2.append(pips);
    caixa.append(topo2);
    caixa.append(el('p', null, c.desc));
    for (const comp of c.comprados) caixa.append(el('p', 'comprado', 'OK  ' + comp));
    if (c.proximo) caixa.append(el('p', null, 'PROXIMO  ' + c.proximo));
    const b = el('button');
    if (c.nivel >= 3) { b.textContent = 'CAMINHO COMPLETO'; b.disabled = true; }
    else if (c.travado) { b.textContent = 'FECHADO — o outro caminho passou do nivel 1'; b.disabled = true; }
    else {
      b.textContent = `SUBIR PARA ${c.nivel + 1} — US$ ${n0(c.custo)}`;
      b.disabled = jogo.dinheiro < c.custo;
      b.onclick = () => { if (melhorar(jogo, t, i)) { som.melhorou(); pintarTudo(); } else som.negado(); };
    }
    caixa.append(b);
    p.append(caixa);
  });

  const acoes = el('div', 'acoes-ficha');
  const bv = el('button', 'vender', `VENDER — US$ ${n0(f.valorVenda)} (60% de ${n0(f.investido)})`);
  bv.onclick = () => { vender(jogo, t); som.vendeu(); ui.selecionada = null; pintarTudo(); };
  acoes.append(bv);
  p.append(acoes);
}

function fichaDePraga(p, praga) {
  const f = fichaPraga(jogo, praga);
  const topo = el('div', 'ficha-topo');
  const gl = el('div', 'glifo', f.chefe ? 'CH' : f.elite ? 'EL' : 'PR');
  gl.style.color = f.cor;
  const tit = el('div');
  tit.append(el('h3', null, f.nome), el('p', null, f.chefe ? 'chefe' : f.elite ? 'elite' : f.estrutura ? 'estrutura' : 'praga'));
  topo.append(gl, tit);
  p.append(topo);
  p.append(el('p', 'regra', f.regra));

  const barra = el('div', 'barra-hp');
  const i = el('i');
  i.style.width = Math.max(0, f.hp / f.hpMax * 100) + '%';
  i.style.background = f.hp / f.hpMax > 0.5 ? '#6ef0a8' : f.hp / f.hpMax > 0.22 ? '#ffd166' : '#ff6b5c';
  barra.append(i);
  p.append(barra);

  const g = el('div', 'numeros');
  linhaNum(g, 'HP', `${n0(f.hp)} / ${n0(f.hpMax)}`, 'largo');
  linhaNum(g, 'VELOCIDADE', f.vel + ' cel/s');
  linhaNum(g, 'PREMIO', 'US$ ' + n0(f.premio));
  linhaNum(g, 'TIRA', f.danoNaBase + ' de integridade');
  linhaNum(g, 'FALTAM', n1(f.faltam) + ' cel');
  linhaNum(g, 'PERCURSO', Math.round(f.progresso * 100) + '%', f.progresso > 0.7 ? 'ruim' : '');
  p.append(g);

  p.append(el('div', 'secao', 'QUANTO DE CADA DANO ELE RECEBE'));
  const res = el('div', 'resist');
  for (const tipo of ORDEM_DANOS) {
    const d = el('div');
    const pct = Math.round(f.resist[tipo] * 100);
    d.append(el('span', null, DANOS[tipo].curto), el('b', null, pct + '%'));
    d.style.color = pct === 0 ? '#5b6880' : pct >= 100 ? DANOS[tipo].cor : '#c8d4e2';
    d.style.borderColor = pct >= 100 ? DANOS[tipo].cor : '#263148';
    res.append(d);
  }
  p.append(res);
  if (f.viesTipo) p.append(el('p', 'frase', `Este so recebe dano de ${DANOS[f.viesTipo].nome}. Qualquer outro tipo passa reto.`));
  if (f.imunes.length) p.append(el('p', 'frase', 'Ja ficou imune a: ' + f.imunes.map(x => DANOS[x].nome).join(', ') + '.'));

  if (f.efeitos.length) {
    p.append(el('div', 'secao', 'EFEITOS ATIVOS'));
    const et = el('div', 'etiquetas');
    for (const e of f.efeitos) et.append(el('span', 'etiqueta', e));
    p.append(et);
  }
}

// -------------------------------------------------------------------- onda

function pintarOnda() {
  const p = $('#painel-onda');
  p.innerHTML = '';
  const proxima = jogo.onda + 1;
  const temProx = temProximaOnda(jogo);

  if (jogo.emOnda) {
    const atual = descreverOnda(jogo.onda);
    const c = el('div', 'onda-cabeca' + (atual.chefe ? ' chefe' : ''));
    c.append(el('h3', null, `AGORA — ONDA ${atual.numero}: ${atual.nome}`));
    c.append(el('p', null, `${jogo.pragas.filter(x => !x.estrutura).length} na tela, ${jogo.fila.length} por vir`));
    p.append(c);
  }

  if (!temProx) { p.append(el('p', 'vazio', 'Nao ha mais ondas. Sobreviveu.')); return; }

  const d = descreverOnda(proxima);
  const c = el('div', 'onda-cabeca' + (d.chefe ? ' chefe' : ''));
  c.append(el('h3', null, `PROXIMA — ONDA ${d.numero}: ${d.nome}`));
  const espera = jogo.emOnda ? 'comeca quando voce chamar, ou ao fim desta' : `comeca sozinha em ${Math.max(0, jogo.preparo).toFixed(0)} s`;
  c.append(el('p', null, `${d.totalPragas} pragas, HP x${d.hpMult.toFixed(2)}, paga US$ ${d.recompensa} no fim. ${espera}`));
  p.append(c);

  if (d.evento) {
    const e = el('div', 'evento');
    e.textContent = `EVENTO — ${d.evento.nome}: ${d.evento.desc}`;
    p.append(e);
  }

  for (const l of d.linhas) {
    const linha = el('div', 'praga-linha');
    const m = el('div', 'marcador');
    m.style.background = l.cor;
    const meio = el('div');
    meio.append(el('div', 'nome', l.nome + (l.chefe ? ' (CHEFE)' : l.elite ? ' (ELITE)' : '')));
    meio.append(el('div', 'det', `${n0(l.hp)} de HP, ${n1(l.vel)} de velocidade, paga US$ ${l.premio}`));
    linha.append(m, meio, el('div', 'qtd', 'x' + l.quantidade));
    linha.onclick = () => { brindar(l.nome); alert(`${l.nome}\n\n${l.regra}`); };
    p.append(linha);
  }

  p.append(el('div', 'secao', 'O QUE AINDA VAI APARECER'));
  const futuras = estreias().filter(e => e.onda > proxima).slice(0, 5);
  if (!futuras.length) p.append(el('p', 'vazio', 'Todos os tipos ja apareceram. Agora e combinacao.'));
  for (const e of futuras) {
    const linha = el('div', 'praga-linha');
    const m = el('div', 'marcador');
    m.style.background = PRAGAS[e.tipo].cor;
    const meio = el('div');
    meio.append(el('div', 'nome', e.nome));
    meio.append(el('div', 'det', e.regra));
    linha.append(m, meio, el('div', 'qtd', 'w' + e.onda));
    p.append(linha);
  }
}

// -------------------------------------------------------------------- feed

const CLASSE_FEED = {
  vazou: 'alerta', estourou: 'alerta', roubo: 'alerta', corrompida: 'alerta',
  ratelimit: 'alerta', derrota: 'alerta',
  ondaLimpa: 'bom', vitoria: 'bom', normalizou: 'bom', chefeMorreu: 'bom',
  groque: 'meme', altohomem: 'meme', foguete: 'meme', metaverso: 'meme',
  trombeta: 'meme', colapso: 'meme', scroll: 'meme', gpu: 'meme', gpuLoja: 'meme',
  falsa: 'meme', recusou: 'meme',
};

let feedPintado = -1;

function pintarFeed() {
  // O feed so e redesenhado quando entra linha nova. Redesenhar sessenta
  // paragrafos quatro vezes por segundo nao acrescenta nada e custa quadro.
  if (feedPintado === jogo.feed.length) return;
  feedPintado = jogo.feed.length;
  const p = $('#painel-feed');
  p.innerHTML = '';
  const lista = jogo.feed.slice().reverse();
  for (const f of lista) {
    const d = el('div', 'feed-linha ' + (CLASSE_FEED[f.chave] || ''));
    d.append(el('b', null, 'w' + f.onda), document.createTextNode(f.texto));
    p.append(d);
  }
}

// --------------------------------------------------------------------- topo

// O topo e redesenhado em todo quadro, entao ele nao pode procurar elemento
// nem escrever no DOM a toa: `querySelector` e `style.width` por quadro, vezes
// dez elementos, custavam mais que o desenho do mapa inteiro. Os nos sao
// guardados uma vez e cada escrita so acontece quando o valor muda.
const no = {};
const visto = {};

function guardarNos() {
  for (const id of ['m-onda', 'm-vidas', 'm-dinheiro', 'm-mapa', 'vram-num', 'vram-aviso',
    'vram-cheio', 'vram-marca', 'bt-onda', 'bt-pausa', 'brinde']) no[id] = $('#' + id);
  no.barraVram = $('.vram-barra');
}

function escrever(chave, elemento, valor) {
  if (visto[chave] === valor) return;
  visto[chave] = valor;
  elemento.textContent = valor;
}

function estilo(chave, elemento, prop, valor) {
  if (visto[chave] === valor) return;
  visto[chave] = valor;
  elemento.style[prop] = valor;
}

function pintarTopo() {
  escrever('onda', no['m-onda'], jogo.modo === 'semfim' ? String(jogo.onda) : `${jogo.onda}/${TOTAL_ONDAS}`);
  escrever('vidas', no['m-vidas'], String(jogo.vidas));
  escrever('dinheiro', no['m-dinheiro'], n0(jogo.dinheiro));

  const v = estadoVram(jogo);
  escrever('vramNum', no['vram-num'], `${n1(v.uso)} / ${n1(v.capacidade)}`);
  escrever('vramAviso', no['vram-aviso'], v.estourado
    ? `ESTOURADO: -${v.perda}% de cadencia`
    : v.capturada > 0 ? `OOM KILLER levou ${n1(v.capturada)} do teto` : '');
  if (visto.estourado !== v.estourado) {
    visto.estourado = v.estourado;
    no.barraVram.classList.toggle('estourado', v.estourado);
  }
  const teto = Math.max(v.capacidade, v.uso, 1);
  estilo('vramCheio', no['vram-cheio'], 'width', Math.round(Math.min(100, v.uso / teto * 100)) + '%');
  estilo('vramMarca', no['vram-marca'], 'left', Math.round(v.capacidade / teto * 100) + '%');

  for (const b of botoesHab) {
    const h = jogo.habilidades.find(x => x.id === b.id);
    const pronta = h.recarga <= 0;
    if (b.pronta !== pronta) { b.pronta = pronta; b.bt.classList.toggle('pronta', pronta); }
    const pct = Math.round((1 - h.recarga / b.def.recarga) * 100);
    if (b.pct !== pct) { b.pct = pct; b.barra.style.width = pct + '%'; }
    const txt = pronta ? 'PRONTA' : Math.ceil(h.recarga) + ' s';
    if (b.txt !== txt) { b.txt = txt; b.tempo.textContent = txt; }
  }

  const bo = no['bt-onda'];
  const temProx = temProximaOnda(jogo);
  escrever('btOnda', bo, !temProx ? 'FIM'
    : jogo.emOnda ? 'ONDA +' : `ONDA ${Math.ceil(Math.max(0, jogo.preparo))}s`);
  if (visto.btOndaOff !== !temProx) { visto.btOndaOff = !temProx; bo.disabled = !temProx; }
  if (visto.pausado !== pausado) {
    visto.pausado = pausado;
    no['bt-pausa'].classList.toggle('ligada', pausado);
    no['bt-pausa'].textContent = pausado ? 'PAUSADO' : 'PAUSA';
  }
}

const botoesHab = [];

function montarHabilidades() {
  const c = $('#habilidades');
  c.innerHTML = '';
  botoesHab.length = 0;
  for (const h of HABILIDADES) {
    const bt = el('button', 'hab');
    bt.title = h.desc;
    const tempo = el('span', 'tempo', 'PRONTA');
    const barra = el('i', 'recarga');
    barra.style.width = '100%';
    bt.append(el('b', null, `${h.tecla}  ${h.nome.split(' ')[0]}`), tempo, barra);
    bt.onclick = () => acionar(h.id);
    c.append(bt);
    botoesHab.push({ id: h.id, def: h, bt, tempo, barra, pronta: null, pct: null, txt: null });
  }
}

function acionar(id) {
  if (!jogo) return;
  if (usarHabilidade(jogo, id)) {
    som.habilidade(id);
    brindar(HABILIDADE_POR_ID[id].nome);
    if (id === 'release') render.sacudir(9);
  } else som.negado();
}

// ------------------------------------------------------------------ entrada

function celulaDoEvento(ev) {
  const r = tela.getBoundingClientRect();
  const x = Math.floor((ev.clientX - r.left) / r.width * LARGURA);
  const y = Math.floor((ev.clientY - r.top) / r.height * ALTURA);
  if (x < 0 || y < 0 || x >= LARGURA || y >= ALTURA) return null;
  return { x, y, fx: (ev.clientX - r.left) / r.width * LARGURA, fy: (ev.clientY - r.top) / r.height * ALTURA };
}

tela.addEventListener('pointermove', ev => {
  ui.celula = celulaDoEvento(ev);
});
tela.addEventListener('pointerleave', () => { ui.celula = null; });

tela.addEventListener('pointerdown', ev => {
  if (!jogo || jogo.fim) return;
  som.acordar();
  const c = celulaDoEvento(ev);
  if (!c) return;
  ui.celula = c;

  if (ui.colocando) {
    const t = construir(jogo, c.x, c.y, ui.colocando);
    if (t) {
      som.construiu();
      render.anel(c.x + 0.5, c.y + 0.5, 1.2, TORRE_POR_ID[ui.colocando].cor);
      if (!ev.shiftKey) { ui.colocando = null; ui.selecionada = t; trocarAba('info'); }
      else { ui.custoColocando = custoDe(jogo, t.tipo); pintarLoja(); }
    } else som.negado();
    pintarTopo();
    return;
  }

  const t = torreEm(jogo, c.x, c.y);
  if (t) {
    ui.selecionada = t;
    ui.pragaSelecionada = null;
    trocarAba('info');
    return;
  }

  // praga mais proxima do clique, com folga generosa para o toque
  let melhor = null;
  let md = 1.3;
  for (const p of jogo.pragas) {
    if (p.morta) continue;
    const d = Math.hypot(p.x - c.fx, p.y - c.fy);
    if (d < md) { md = d; melhor = p; }
  }
  if (melhor) {
    ui.pragaSelecionada = melhor;
    ui.selecionada = null;
    trocarAba('info');
  } else {
    ui.selecionada = null;
    ui.pragaSelecionada = null;
    if (aba === 'info') pintarFicha();
  }
});

addEventListener('keydown', ev => {
  if (ev.target.tagName === 'INPUT') return;
  const k = ev.key.toLowerCase();
  if (k === 'h') { alternarManual(); ev.preventDefault(); return; }
  if (!jogo) return;
  if (k === '1') acionar('ratelimit');
  else if (k === '2') acionar('release');
  else if (k === '3') acionar('overclock');
  else if (k === ' ' || k === 'p') { pausado = !pausado; pintarTopo(); ev.preventDefault(); }
  else if (k === 'n') chamarOnda();
  else if (k === '[') mudarVelocidade(Math.max(1, velocidade === 4 ? 2 : 1));
  else if (k === ']') mudarVelocidade(velocidade === 1 ? 2 : 4);
  else if (k === 'v' && ui.selecionada) { vender(jogo, ui.selecionada); som.vendeu(); ui.selecionada = null; pintarTudo(); }
  else if (k === 'escape') { ui.colocando = null; ui.selecionada = null; ui.pragaSelecionada = null; pintarTudo(); }
});

function chamarOnda() {
  if (!jogo || !temProximaOnda(jogo)) return;
  comecarOnda(jogo);
  pintarTudo();
}

function mudarVelocidade(v) {
  velocidade = v;
  for (const b of document.querySelectorAll('.vel')) b.classList.toggle('ligada', Number(b.dataset.vel) === v);
}

// ------------------------------------------------------------------- manual

function alternarManual() {
  const m = $('#manual');
  const fechado = m.classList.contains('oculto');
  m.classList.toggle('oculto', !fechado);
  if (fechado) pintarManual('dano');
}

function pintarManual(qual) {
  for (const b of document.querySelectorAll('#manual-abas .aba')) b.classList.toggle('ligada', b.dataset.man === qual);
  const c = $('#manual-corpo');
  c.innerHTML = '';
  const t = el('table', 'tabela');
  const cab = el('tr');
  const linhas = [];

  if (qual === 'dano') {
    ['TIPO', 'O QUE RESOLVE'].forEach(h => cab.append(el('th', null, h)));
    for (const id of ORDEM_DANOS) {
      const r = el('tr');
      const a = el('td', 'destaque', DANOS[id].nome);
      a.style.color = DANOS[id].cor;
      r.append(a, el('td', null, DANOS[id].desc));
      linhas.push(r);
    }
    const nota = el('p', 'linha');
    nota.textContent = 'Resistencia e multiplicador: 25% quer dizer que o alvo recebe um quarto do dano. Clique numa praga no mapa para ver a tabela dela dos cinco tipos.';
    c.append(nota);
  } else if (qual === 'torres') {
    ['MODELO', 'CUSTO', 'VRAM', 'DANO', 'CADENCIA', 'ALCANCE', 'MIRA', 'ERRA', 'TIPO', 'CAMINHOS'].forEach(h => cab.append(el('th', null, h)));
    for (const d of TORRES) {
      const r = el('tr');
      const a = el('td', 'destaque', d.nome);
      a.style.color = d.cor;
      r.append(a);
      r.append(el('td', 'num', 'US$ ' + d.custo));
      r.append(el('td', 'num', n1(d.vram)));
      r.append(el('td', 'num', d.naoAtira ? '-' : String(d.dano)));
      r.append(el('td', 'num', d.naoAtira ? '-' : n1(d.cadencia) + '/s'));
      r.append(el('td', 'num', n1(d.alcance)));
      r.append(el('td', 'num', d.naoAtira ? '-' : n1(d.mira) + ' s'));
      r.append(el('td', 'num', d.naoAtira ? '-' : (d.erro * 100).toFixed(1) + '%'));
      r.append(el('td', null, d.naoAtira ? 'apoio' : DANOS[d.tipoDano].nome));
      r.append(el('td', null, d.caminhos.map(x => x.nome).join('  |  ')));
      linhas.push(r);
    }
  } else if (qual === 'modos') {
    ['MODO', 'VRAM', 'DANO', 'CADENCIA', 'MIRA', 'O QUE E'].forEach(h => cab.append(el('th', null, h)));
    for (const [id, m] of Object.entries(MODOS)) {
      const r = el('tr');
      r.append(el('td', 'destaque', m.nome));
      r.append(el('td', 'num', 'x' + m.vram));
      r.append(el('td', 'num', 'x' + m.dano));
      r.append(el('td', 'num', 'x' + m.cadencia));
      r.append(el('td', 'num', 'x' + m.mira));
      r.append(el('td', null, m.desc));
      linhas.push(r);
    }
  } else {
    ['PRAGA', 'ESTREIA', 'HP', 'VEL', 'PAGA', 'A REGRA'].forEach(h => cab.append(el('th', null, h)));
    const quando = Object.fromEntries(estreias().map(e => [e.tipo, e.onda]));
    for (const [id, p] of Object.entries(PRAGAS)) {
      const r = el('tr');
      const a = el('td', 'destaque', p.nome);
      a.style.color = p.cor;
      r.append(a);
      r.append(el('td', 'num', quando[id] ? 'onda ' + quando[id] : '-'));
      r.append(el('td', 'num', n0(p.hp)));
      r.append(el('td', 'num', n1(p.vel)));
      r.append(el('td', 'num', 'US$ ' + p.premio));
      r.append(el('td', null, p.regra));
      linhas.push(r);
    }
  }
  const cabeca = el('thead');
  cabeca.append(cab);
  t.append(cabeca);
  const tb = el('tbody');
  for (const l of linhas) tb.append(l);
  t.append(tb);
  c.append(t);
}

// ---------------------------------------------------------------------- fim

function mostrarFim() {
  const v = jogo.venceu;
  $('#fim-titulo').textContent = v ? 'O PIPELINE AGUENTOU' : 'A BASE DE DADOS CAIU';
  $('#fim-titulo').className = v ? 'bom' : 'ruim';
  $('#fim-resumo').textContent = v
    ? `Quarenta ondas em ${jogo.mapa.nome} com ${jogo.vidas} de ${jogo.vidasMax} de integridade. Ninguem vai saber, mas aguentou.`
    : `Caiu na onda ${jogo.onda} de ${jogo.mapa.nome}. ${jogo.estat.vazadas} pragas chegaram no banco.`;
  const p = $('#fim-placar');
  p.innerHTML = '';
  const dados = [
    ['ONDAS', jogo.estat.ondasLimpas],
    ['PRAGAS MORTAS', n0(jogo.estat.mortas)],
    ['VAZARAM', jogo.estat.vazadas],
    ['TIROS', n0(jogo.estat.tiros)],
    ['ERRADOS', n0(jogo.estat.errados)],
    ['GASTO', 'US$ ' + n0(jogo.estat.gasto)],
    ['ROUBADO', 'US$ ' + n0(jogo.estat.roubado)],
    ['TORRES', jogo.torres.length],
    ['VRAM', `${n1(jogo.usoVram)}/${n1(jogo.capacidadeVram)}`],
  ];
  for (const [k, val] of dados) {
    const d = el('div');
    d.append(el('b', null, String(val)), document.createTextNode(k));
    p.append(d);
  }
  $('#fim').classList.remove('oculto');
  som.fim(v);
}

// ------------------------------------------------------------------- eventos

function tratarEventos() {
  for (const e of consumirEventos(jogo)) {
    switch (e.tipo) {
      case 'tiro': som.tiro(e.dano); break;
      case 'acerto': som.acerto(); render.faisca(e.x, e.y, DANOS[e.dano].cor, 3, 0.7); break;
      case 'estouro': som.estouro(); render.anel(e.x, e.y, e.raio, DANOS[e.dano].cor); render.faisca(e.x, e.y, DANOS[e.dano].cor, 8, 1.2); break;
      case 'morreu':
        som[e.chefe ? 'morreuChefe' : 'morreu']();
        render.faisca(e.x, e.y, e.cor, e.chefe ? 46 : e.elite ? 22 : 7, e.chefe ? 2.4 : 1);
        if (e.chefe) render.sacudir(10);
        break;
      case 'vazou': som.vazou(); render.sacudir(7); break;
      case 'onda': som.onda(e.chefe); brindar(`ONDA ${e.n}`); break;
      case 'ondaLimpa': som.ondaLimpa(); brindar(`ONDA LIMPA  +US$ ${e.renda}`); break;
      case 'antecipou': brindar(`ANTECIPOU  +US$ ${e.bonus}`); break;
      case 'corrompeu': som.corrompeu(); render.anel(e.x, e.y, 2, '#ff5ca8'); break;
      case 'desligou': render.anel(e.x, e.y, 1.6, '#ff5c5c'); break;
      case 'estourou': som.alerta(); brindar('CLUSTER ESTOUROU'); break;
      case 'ratelimit': som.alerta(); break;
      case 'negado': som.negado(); break;
      case 'falsa': render.texto(e.x, e.y, 'FALSA', '#c9a0ff'); break;
      case 'imune': render.texto(e.x, e.y, 'IMUNE', '#8695ab'); break;
      case 'decorou': render.texto(e.x, e.y, 'DECOROU ' + DANOS[e.dano].curto, '#b0e07a'); break;
      case 'renasceu': render.anel(e.x, e.y, 3, '#b46bff'); render.sacudir(8); break;
      case 'pitch': render.anel(e.x, e.y, 3.4, '#ffd98a'); break;
      case 'muro': render.sacudir(6); break;
      case 'destroco': render.faisca(e.x, e.y, '#e8e8f0', 12, 1.4); render.sacudir(4); break;
      case 'roubo': render.texto(e.x, e.y, '-US$', '#ff7a5c'); break;
      case 'voltou': render.texto(e.x, e.y, 'ROLLBACK', '#d0a05c'); break;
      case 'dividiu': render.anel(e.x, e.y, 1.1, '#63d2a4'); break;
      case 'fim': mostrarFim(); break;
      default: break;
    }
  }
}

// ---------------------------------------------------------------------- laco

function quadro(agora) {
  requestAnimationFrame(quadro);
  const dt = Math.min(0.1, (agora - ultimo) / 1000);
  ultimo = agora;
  if (!jogo) return;

  if (!pausado && !jogo.fim) {
    resto += dt * velocidade;
    let passos = 0;
    while (resto >= DT && passos < 16) { passo(jogo, DT); resto -= DT; passos++; }
    if (resto > DT * 16) resto = 0;
  }
  tratarEventos();
  render.desenhar(jogo, ui, dt);
  pintarTopo();

  if (tBrinde > 0) { tBrinde -= dt; if (tBrinde <= 0) $('#brinde').classList.add('oculto'); }

  tRepintar += dt;
  if (tRepintar > 0.25) {
    tRepintar = 0;
    if (aba === 'info' || aba === 'onda' || aba === 'feed' || aba === 'loja') pintarTudo();
  }
}

// ------------------------------------------------------------------- ligacao

$('#bt-campanha').onclick = () => comecar('campanha');
$('#bt-semfim').onclick = () => comecar('semfim');
$('#bt-manual').onclick = alternarManual;
$('#bt-manual2').onclick = alternarManual;
$('#bt-fechar-manual').onclick = alternarManual;
$('#bt-pausa').onclick = () => { pausado = !pausado; pintarTopo(); };
$('#bt-onda').onclick = chamarOnda;
$('#bt-som').onclick = () => { som.acordar(); $('#bt-som').textContent = 'SOM ' + (som.alternar() ? 'ON' : 'OFF'); };
$('#bt-denovo').onclick = () => comecar(jogo ? jogo.modo : 'campanha');
$('#bt-menu').onclick = () => { $('#fim').classList.add('oculto'); $('#menu').classList.remove('oculto'); };
for (const b of document.querySelectorAll('.vel')) b.onclick = () => mudarVelocidade(Number(b.dataset.vel));
for (const b of document.querySelectorAll('#abas .aba')) b.onclick = () => trocarAba(b.dataset.aba);
for (const b of document.querySelectorAll('#manual-abas .aba')) b.onclick = () => pintarManual(b.dataset.man);

guardarNos();
montarHabilidades();
pintarMenu();
requestAnimationFrame(quadro);

// Deixa o estado a mao para medir fps e depurar no console do navegador.
window.GUARDRAIL = {
  get jogo() { return jogo; },
  render, ui, som,
  velocidade: v => mudarVelocidade(v),
  comecar,
};
