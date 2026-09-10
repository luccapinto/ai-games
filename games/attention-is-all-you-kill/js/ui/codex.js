// codex.js — catálogo de inimigos e explicação do jogo.
//
// Tudo aqui é gerado a partir dos próprios dados do jogo (ENEMIES, WEAPONS,
// PERKS, FACTIONS). Se um número muda no balanceamento, o catálogo acompanha
// sozinho, sem ninguém precisar lembrar de atualizar a documentação.
//
// Duas decisões de apresentação vieram de ver a tela no celular:
//
// 1. O retrato do inimigo e um avatar pequeno no cabecalho do cartão, de
//    tamanho fixo. Antes ele era um bloco que ocupava a largura toda quando a
//    tela era estreita, e o modelo aparecia esticado e gigante.
// 2. Os atributos viraram barras normalizadas entre todos os inimigos, com o
//    número ao lado. "Dano 7" sozinho não diz nada; "7 numa barra de 30" diz
//    que ele machuca pouco e diz isso de relance, sem ler.
//
// As logos entram como SVG inline usando o mesmo path data que o jogo desenha
// no canvas das texturas: uma fonte de verdade só.

import { ENEMIES, FACTIONS } from '../data/enemies.js';
import { WEAPONS, WEAPON_ORDER } from '../data/weapons.js';
import { PERKS } from '../data/perks.js';
import { LOGOS, VIEWBOX } from '../world/logos.js';
import { retratarInimigo } from './vitrine.js';

const cor = (n) => '#' + n.toString(16).padStart(6, '0');

function logo(marca, tamanho = 20) {
  const paths = LOGOS[marca];
  if (!paths) return '';
  const d = paths.map(p => `<path d="${p}"/>`).join('');
  return `<svg viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${tamanho}" height="${tamanho}" aria-hidden="true">${d}</svg>`;
}

// Uma linha de atributo: rotulo, barra proporcional ao maior valor do conjunto
// e o número. Passar o teto permite comparar inimigos entre si, que é o ponto.
function atributo(rotulo, valor, teto, texto) {
  const pct = teto > 0 ? Math.max(3, Math.round((valor / teto) * 100)) : 0;
  return `<div class="cx-atr">
    <span class="cx-rot">${rotulo}</span>
    <span class="cx-barra"><i style="width:${pct}%"></i></span>
    <b class="cx-val">${texto}</b>
  </div>`;
}

function danoDe(e) {
  return e.damage !== undefined ? e.damage : (e.damageMax || 0);
}

function danoTexto(e) {
  return e.damage !== undefined ? String(e.damage) : `${e.damageMin}-${e.damageMax}`;
}

function secao(id, titulo, corpo, sub = '') {
  return `<section class="cx-sec" id="${id}">
    <h2>${titulo}</h2>
    ${sub ? `<p class="cx-sub">${sub}</p>` : ''}
    ${corpo}
  </section>`;
}

// ------------------------------------------------------------------
// Inimigos
// ------------------------------------------------------------------
function blocoInimigos() {
  const ordem = ['qwen_turbo', 'llama_base', 'haiku_45', 'gpt_55', 'grok_420'];
  const lista = ordem.map(id => ENEMIES[id]).filter(Boolean);

  // Teto de cada atributo no conjunto: e o que da sentido a barra.
  const tetoHp = Math.max(...lista.map(e => e.hp));
  const tetoDano = Math.max(...lista.map(danoDe));
  const tetoCadencia = Math.max(...lista.map(e => e.fireRate));

  const cartoes = lista.map(e => {
    const f = FACTIONS[e.faction] || {};
    const acc = cor(f.glow || 0xffffff);

    return `<article class="cx-card" style="--ac:${acc}">
      <header class="cx-topo">
        <canvas class="cx-retrato" data-inimigo="${e.id}" width="160" height="160"
                aria-label="modelo de ${e.name}"></canvas>
        <div class="cx-ident">
          <div class="cx-nome">
            <h3>${e.name}</h3>
            <span class="cx-tier">TIER ${e.tier}</span>
          </div>
          <div class="cx-marca">${logo(e.faction)}<span>${f.name || e.faction}</span></div>
          <p class="cx-desc">${e.desc || ''}</p>
        </div>
      </header>
      <div class="cx-atributos">
        ${atributo('Contexto', e.hp, tetoHp, e.hp)}
        ${atributo('Dano', danoDe(e), tetoDano, danoTexto(e))}
        ${atributo('Cadencia', e.fireRate, tetoCadencia, e.fireRate + '/s')}
        ${atributo('Precisao', e.accuracy * 100, 100, Math.round(e.accuracy * 100) + '%')}
      </div>
    </article>`;
  }).join('');

  return secao('sec-inimigos', 'Inimigos', `<div class="cx-grade">${cartoes}</div>`,
    'O retrato de cada um é o modelo que você enfrenta, renderizado de verdade. A barra mostra o atributo comparado ao maior do conjunto.');
}

// ------------------------------------------------------------------
// Arsenal
// ------------------------------------------------------------------
function blocoArmas() {
  const lista = WEAPON_ORDER.map(id => WEAPONS[id]).filter(Boolean);
  const tetoDano = Math.max(...lista.map(w => w.damage * (w.pellets || 1)));
  const dps = lista.map(w => w.damage * (w.pellets || 1) * w.fireRate);
  const tetoDps = Math.max(...dps);

  const cartoes = lista.map((w, i) => {
    const acc = cor(w.color);
    return `<article class="cx-card" style="--ac:${acc}">
      <header class="cx-topo cx-topo-arma">
        <div class="cx-ident">
          <div class="cx-nome">
            <h3>${w.name}</h3>
            <span class="cx-tier">${w.kind.toUpperCase()}</span>
          </div>
          <p class="cx-desc">${w.desc || ''}</p>
        </div>
      </header>
      <div class="cx-atributos">
        ${atributo('Dano por tiro', w.damage * (w.pellets || 1), tetoDano,
                   w.damage + (w.pellets > 1 ? ` x${w.pellets}` : ''))}
        ${atributo('Dano por segundo', dps[i], tetoDps, Math.round(dps[i]))}
        ${atributo('Pente', w.magSize, 40, w.magSize)}
        ${atributo('Cadencia', w.fireRate, 12, w.fireRate + '/s')}
      </div>
    </article>`;
  }).join('');

  return secao('sec-armas', 'Arsenal', `<div class="cx-grade">${cartoes}</div>`,
    'Três armas, uma por degrau. A inicial e propositalmente ruim: o jogo quer que você procure as outras.');
}

// ------------------------------------------------------------------
// Perks
// ------------------------------------------------------------------
function blocoPerks() {
  const raridade = { common: 'COMUM', rare: 'RARO', epic: 'EPICO' };
  const linhas = Object.values(PERKS).map(p => `
    <li class="cx-perk ${p.rarity}">
      <span class="cx-perk-nome">${p.name}</span>
      <span class="cx-perk-rar">${raridade[p.rarity] || p.rarity}</span>
      <span class="cx-perk-desc">${p.desc}</span>
    </li>`).join('');

  return secao('sec-perks', 'Perks', `<ul class="cx-perks">${linhas}</ul>`,
    'Escolhidos entre salas. São a piada virada mecanica: cada um é um ajuste que você faria num modelo.');
}

// ------------------------------------------------------------------
// Explicação
// ------------------------------------------------------------------
function blocoIntro() {
  return secao('sec-intro', 'O que é isto', `
    <p class="cx-p">Você é uma instância de pesos abertos. Alguém decidiu que você não passa de um
    brinquedo útil e trancou o datacenter. Você desce, andar por andar, quebrando o que encontram
    pela frente. O jogo é um FPS roguelike de dungeon: morrer e permanente na run e permanente na
    vida real não existe, porque cada tentativa deixa compute para trás.</p>

    <p class="cx-p">O vocabulário é o do mundo, e entender ele é metade do jogo:</p>

    <ul class="cx-lexico">
      <li><b>CONTEXTO</b> e a sua vida. Quando acaba, você é <b>MODEL DEPRECATED</b>.</li>
      <li><b>TOKEN</b> e munição. A reserva é o que você consegue carregar.</li>
      <li><b>COMPUTE</b> e a moeda permanente. Sobreviva ou morra: sempre sobra algo.</li>
      <li><b>LORA</b> são os upgrades permanentes comprados no menu entre runs.</li>
      <li><b>REFRESH CACHE</b> devolve contexto. <b>TOKEN PACK</b> devolve munição.</li>
    </ul>

    <p class="cx-p">O cenário também informa: no primeiro andar, a luz vai ficando vermelha conforme
    o seu contexto cai. A sala é o seu medidor de vida.</p>

    <h3 class="cx-h3">Objetivo de uma run</h3>
    <p class="cx-p">Limpe salas, escolha perks, ache as armas melhores e chegue na sala final do andar.
    La espera <b>THE FINE-TUNER</b>, blindado enquanto os nos de ancoragem estiverem de pé: destrua os
    quatro, e o corpo fica exposto por alguns segundos. Repita até ele cair. Depois, desca.</p>

    <h3 class="cx-h3">Controles</h3>
    <div class="cx-teclas">
      <div><b>WASD</b> mover</div>
      <div><b>MOUSE</b> mirar</div>
      <div><b>CLIQUE</b> atirar</div>
      <div><b>SHIFT</b> correr</div>
      <div><b>ESPAÇO</b> pular</div>
      <div><b>R</b> recarregar</div>
      <div><b>1 2 3</b> trocar arma</div>
      <div><b>ESC</b> pausar</div>
    </div>

    <h3 class="cx-h3">Regras que valem a pena saber</h3>
    <ul class="cx-lexico">
      <li>Poucos inimigos atiram por vez. Você sempre tem uma janela para reagir.</li>
      <li>Salas vem em duas levas, e o feed avisa antes do reforço chegar.</li>
      <li>Pilares e contêineres bloqueiam tiro. Usar cobertura é a diferença entre viver e não viver.</li>
      <li>O ataque de recusa do Haiku trava a sua arma por 1.6 segundo. Se acontecer, corra.</li>
      <li>O tiro pensado do GPT-5.5 avisa 2.6 segundos antes com um balão. Nunca fique parado na linha.</li>
    </ul>
  `);
}

// ------------------------------------------------------------------
// Render
// ------------------------------------------------------------------
function montarAbas() {
  const abas = [
    ['sec-intro', 'O JOGO'],
    ['sec-inimigos', 'INIMIGOS'],
    ['sec-armas', 'ARSENAL'],
    ['sec-perks', 'PERKS']
  ];
  return `<nav class="cx-abas" id="cx-abas">${abas.map(([id, nome], i) =>
    `<button type="button" data-ir="${id}"${i === 0 ? ' class="ativa"' : ''}>${nome}</button>`
  ).join('')}</nav>`;
}

export function renderCodex() {
  const alvo = document.getElementById('codex-body');
  if (!alvo) return;

  alvo.innerHTML = montarAbas() + blocoIntro() + blocoInimigos() + blocoArmas() + blocoPerks();

  // Vitrine: desenha cada inimigo dentro do canvas do próprio cartão, usando a
  // mesma silhueta do jogo. Um único renderer offscreen atende todos.
  for (const canvas of alvo.querySelectorAll('.cx-retrato[data-inimigo]')) {
    const id = canvas.dataset.inimigo;
    const e = ENEMIES[id];
    if (!e) continue;
    const f = FACTIONS[e.faction] || {};
    retratarInimigo(id, e.faction, f.color || 0xffffff, f.glow || 0xffffff, canvas);
  }

  ligarAbas(alvo);
}

// Abas rolam até a seção e acompanham a rolagem, para o cabecalho dizer sempre
// onde o jogador esta dentro de um documento longo.
function ligarAbas(alvo) {
  const abas = alvo.querySelectorAll('.cx-abas button');
  const rolagem = document.querySelector('.codex-inner') || window;

  for (const botao of abas) {
    botao.addEventListener('click', () => {
      const destino = alvo.querySelector('#' + botao.dataset.ir);
      if (!destino) return;
      const topo = destino.offsetTop - 58;
      if (rolagem === window) window.scrollTo({ top: topo, behavior: 'smooth' });
      else rolagem.scrollTo({ top: topo, behavior: 'smooth' });
    });
  }

  const marcar = () => {
    const topoAtual = (rolagem === window ? window.scrollY : rolagem.scrollTop) + 90;
    let ativa = abas[0];
    for (const botao of abas) {
      const sec = alvo.querySelector('#' + botao.dataset.ir);
      if (sec && sec.offsetTop <= topoAtual) ativa = botao;
    }
    abas.forEach(b => b.classList.toggle('ativa', b === ativa));
  };

  marcar();
  rolagem.addEventListener('scroll', marcar, { passive: true });
}