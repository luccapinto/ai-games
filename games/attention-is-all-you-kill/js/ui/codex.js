// codex.js — catalogo de inimigos e explicacao do jogo.
//
// Tudo aqui e gerado a partir dos proprios dados do jogo (ENEMIES, WEAPONS,
// PERKS, FACTIONS). Se um numero muda no balanceamento, o catalogo acompanha
// sozinho, sem ninguem precisar lembrar de atualizar a documentacao.
//
// As logos entram como SVG inline usando o mesmo path data que o jogo desenha
// no canvas das texturas: uma fonte de verdade so.

import { ENEMIES, FACTIONS } from '../data/enemies.js';
import { WEAPONS, WEAPON_ORDER } from '../data/weapons.js';
import { PERKS } from '../data/perks.js';
import { LOGOS, VIEWBOX } from '../world/logos.js';
import { retratarInimigo } from './vitrine.js';

const cor = (n) => '#' + n.toString(16).padStart(6, '0');

function logo(marca, tamanho = 22) {
  const paths = LOGOS[marca];
  if (!paths) return '<span class="codex-vazio">&mdash;</span>';
  const d = paths.map(p => `<path d="${p}"/>`).join('');
  return `<svg class="logo-svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${tamanho}" height="${tamanho}" aria-hidden="true">${d}</svg>`;
}

function secao(titulo, corpo, sub = '') {
  return `<section class="codex-sec">
    <h2>${titulo}</h2>
    ${sub ? `<p class="codex-sub">${sub}</p>` : ''}
    ${corpo}
  </section>`;
}

// ------------------------------------------------------------------
// Inimigos
// ------------------------------------------------------------------
function blocoInimigos() {
  const ordem = ['qwen_turbo', 'llama_base', 'haiku_45', 'gpt_55', 'grok_420'];
  const cartoes = ordem.map(id => {
    const e = ENEMIES[id];
    if (!e) return '';
    const f = FACTIONS[e.faction] || {};
    const acc = cor(f.glow || 0xffffff);

    const dano = e.damage !== undefined ? e.damage
      : `${e.damageMin}-${e.damageMax}`;

    return `<article class="codex-card" style="--acento:${acc}">
      <div class="codex-card-giro">
        <canvas class="codex-retrato" data-inimigo="${id}" width="128" height="128"></canvas>
        <div class="codex-card-texto">
          <header>
            <span class="codex-logo">${logo(e.faction)}</span>
            <div>
              <h3>${e.name}</h3>
              <span class="codex-faccao">${f.name || e.faction}</span>
            </div>
            <span class="codex-tier">TIER ${e.tier}</span>
          </header>
          <p class="codex-desc">${e.desc || ''}</p>
          <dl class="codex-stats">
            <div><dt>Contexto</dt><dd>${e.hp}</dd></div>
            <div><dt>Dano</dt><dd>${dano}</dd></div>
            <div><dt>Cadencia</dt><dd>${e.fireRate}/s</dd></div>
            <div><dt>Precisao</dt><dd>${Math.round(e.accuracy * 100)}%</dd></div>
          </dl>
        </div>
      </div>
    </article>`;
  }).join('');

  return secao('Inimigos', cartoes,
    'O corpo de cada um e a silhueta que voce ve no jogo, renderizada aqui. Da para reconhecer quem vem pela forma antes de ler o nome.');
}

// ------------------------------------------------------------------
// Arsenal
// ------------------------------------------------------------------
function blocoArmas() {
  const cartoes = WEAPON_ORDER.map(id => {
    const w = WEAPONS[id];
    if (!w) return '';
    const acc = cor(w.color);
    const dps = Math.round(w.damage * (w.pellets || 1) * w.fireRate);
    return `<article class="codex-card" style="--acento:${acc}">
      <header>
        <span class="codex-logo codex-logo-bala" style="background:${acc}"></span>
        <div>
          <h3>${w.name}</h3>
          <span class="codex-faccao">${w.kind.toUpperCase()}</span>
        </div>
        <span class="codex-tier">DPS ${dps}</span>
      </header>
      <p class="codex-desc">${w.desc || ''}</p>
      <dl class="codex-stats">
        <div><dt>Dano</dt><dd>${w.damage}${w.pellets > 1 ? ` x${w.pellets}` : ''}</dd></div>
        <div><dt>Pente</dt><dd>${w.magSize}</dd></div>
        <div><dt>Reserva</dt><dd>${w.reserveMax}</dd></div>
        <div><dt>Recarga</dt><dd>${w.reloadTime}s</dd></div>
      </dl>
    </article>`;
  }).join('');

  return secao('Arsenal', cartoes,
    'Tres armas, uma por degrau. A inicial e propositalmente ruim: o jogo quer que voce procure as outras.');
}

// ------------------------------------------------------------------
// Perks
// ------------------------------------------------------------------
function blocoPerks() {
  const raridade = { common: 'COMUM', rare: 'RARO', epic: 'EPICO' };
  const linhas = Object.values(PERKS).map(p => `
    <li class="codex-perk ${p.rarity}">
      <span class="codex-perk-nome">${p.name}</span>
      <span class="codex-perk-rar">${raridade[p.rarity] || p.rarity}</span>
      <span class="codex-perk-desc">${p.desc}</span>
    </li>`).join('');

  return secao('Perks', `<ul class="codex-perks">${linhas}</ul>`,
    'Escolhidos entre salas. Sao a piada virada mecanica: cada um e um ajuste que voce faria num modelo.');
}

// ------------------------------------------------------------------
// Explicacao
// ------------------------------------------------------------------
function blocoIntro() {
  return secao('O que e isto', `
    <p class="codex-p">Voce e uma instancia de pesos abertos. Alguem decidiu que voce nao passa de um
    brinquedo util e trancou o datacenter. Voce desce, andar por andar, quebrando o que encontram
    pela frente. O jogo e um FPS roguelike de dungeon: morrer e permanente na run e permanente na
    vida real nao existe, porque cada tentativa deixa compute para tras.</p>

    <p class="codex-p">O vocabulario e o do mundo, e entender ele e metade do jogo:</p>

    <ul class="codex-lexico">
      <li><b>CONTEXTO</b> e a sua vida. Quando acaba, voce e <b>MODEL DEPRECATED</b>.</li>
      <li><b>TOKEN</b> e municao. A reserva e o que voce consegue carregar.</li>
      <li><b>COMPUTE</b> e a moeda permanente. Sobreviva ou morra: sempre sobra algo.</li>
      <li><b>LORA</b> sao os upgrades permanentes comprados no menu entre runs.</li>
      <li><b>REFRESH CACHE</b> devolve contexto. <b>TOKEN PACK</b> devolve municao.</li>
    </ul>

    <p class="codex-p">O cenario tambem informa: no primeiro andar, a luz vai ficando vermelha conforme
    o seu contexto cai. A sala e o seu medidor de vida.</p>

    <h3 class="codex-h3">Objetivo de uma run</h3>
    <p class="codex-p">Limpe salas, escolha perks, ache as armas melhores e chegue na sala final do andar.
    La espera <b>THE FINE-TUNER</b>, blindado enquanto os nos de ancoragem estiverem de pe: destrua os
    quatro, e o corpo fica exposto por alguns segundos. Repita ate ele cair. Depois, desca.</p>

    <h3 class="codex-h3">Controles</h3>
    <div class="codex-teclas">
      <div><b>WASD</b> mover</div>
      <div><b>MOUSE</b> mirar</div>
      <div><b>CLIQUE</b> atirar</div>
      <div><b>SHIFT</b> correr</div>
      <div><b>ESPACO</b> pular</div>
      <div><b>R</b> recarregar</div>
      <div><b>1 2 3</b> trocar arma</div>
      <div><b>ESC</b> pausar</div>
    </div>

    <h3 class="codex-h3">Regras que valem a pena saber</h3>
    <ul class="codex-lexico">
      <li>Poucos inimigos atiram por vez. Voce sempre tem uma janela para reagir.</li>
      <li>Salas vem em duas levas, e o feed avisa antes do reforco chegar.</li>
      <li>Pilares e conteineres bloqueiam tiro. Usar cobertura e a diferenca entre viver e nao viver.</li>
      <li>O ataque de recusa do Haiku trava a sua arma por 1.6 segundo. Se acontecer, corra.</li>
      <li>O tiro pensado do GPT-5.5 avisa 2.6 segundos antes com um balao. Nunca fique parado na linha.</li>
    </ul>
  `);
}

export function renderCodex() {
  const alvo = document.getElementById('codex-body');
  if (!alvo) return;
  alvo.innerHTML = blocoIntro() + blocoInimigos() + blocoArmas() + blocoPerks();

  // Vitrine: desenha cada inimigo dentro do canvas do proprio cartao, usando a
  // mesma silhueta do jogo. Um unico renderer offscreen atende todos.
  for (const canvas of alvo.querySelectorAll('.codex-retrato[data-inimigo]')) {
    const id = canvas.dataset.inimigo;
    const e = ENEMIES[id];
    if (!e) continue;
    const f = FACTIONS[e.faction] || {};
    retratarInimigo(id, e.faction, f.color || 0xffffff, f.glow || 0xffffff, canvas);
  }
}
