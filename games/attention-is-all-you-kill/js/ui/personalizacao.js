// personalizacao.js — tela de aparencia do jogador.
//
// Duas paletas e um retrato giratorio. A escolha aparece em dois lugares: nos
// bracos que seguram a arma, dentro da partida, e no próprio retrato. Fica
// salva entre sessões (js/player/skin.js).

import { PALETA } from '../player/skin.js';
import { retratarAvatar } from './vitrine.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export class Personalizacao {
  constructor(game) {
    this.g = game;
    this.el = document.getElementById('skin');
    this.canvas = document.getElementById('skin-preview');
    this.angulo = 0.5;
    this.animando = false;
    this.linhas = {};

    document.getElementById('btn-skin-fechar')
      .addEventListener('click', () => this.fechar());

    this.montarPaletas();
  }

  montarPaletas() {
    const alvo = document.getElementById('skin-paletas');
    alvo.innerHTML = '';

    const grupos = [
      { tipo: 'acabamento', titulo: 'ACABAMENTO DA ARMA', opcoes: PALETA.acabamento },
      { tipo: 'luz', titulo: 'LUZ DA ARMA E DA MIRA', opcoes: PALETA.luz }
    ];

    for (const grupo of grupos) {
      const bloco = document.createElement('div');
      bloco.className = 'skin-grupo';

      const titulo = document.createElement('h3');
      titulo.textContent = grupo.titulo;
      bloco.appendChild(titulo);

      const linha = document.createElement('div');
      linha.className = 'skin-linha';

      for (const opcao of grupo.opcoes) {
        const botao = document.createElement('button');
        botao.className = 'skin-cor';
        botao.style.setProperty('--cor', hex(opcao.cor));
        botao.title = opcao.nome;
        botao.dataset.tipo = grupo.tipo;
        botao.dataset.id = opcao.id;

        const amostra = document.createElement('span');
        amostra.className = 'skin-amostra';
        botao.appendChild(amostra);

        const nome = document.createElement('span');
        nome.className = 'skin-nome';
        nome.textContent = opcao.nome;
        botao.appendChild(nome);

        botao.addEventListener('click', () => this.escolher(grupo.tipo, opcao.id));
        linha.appendChild(botao);
      }

      bloco.appendChild(linha);
      alvo.appendChild(bloco);
      this.linhas[grupo.tipo] = linha;
    }
  }

  escolher(tipo, id) {
    this.g.skin.definir(tipo, id);
    this.marcarSelecao();
    this.atualizarPreview();
    // A cor vale na interface mesmo antes de existir partida: o weapon só nasce
    // quando o andar e construido, e a mira precisa da cor certa já no menu.
    document.documentElement.style.setProperty(
      '--skin-luz', '#' + this.g.skin.corLuz.toString(16).padStart(6, '0')
    );
    if (this.g.weapon && this.g.weapon.aplicarSkin) {
      this.g.weapon.aplicarSkin(this.g.skin);
    }
  }

  marcarSelecao() {
    for (const botao of this.el.querySelectorAll('.skin-cor')) {
      const ativo = botao.dataset.id ===
        (botao.dataset.tipo === 'acabamento' ? this.g.skin.acabamento : this.g.skin.luz);
      botao.classList.toggle('ativo', ativo);
    }
  }

  atualizarPreview() {
    retratarAvatar(this.g.skin.corAcabamento, this.g.skin.corLuz, this.canvas, this.angulo);
  }

  abrir() {
    this.el.classList.remove('hidden');
    this.marcarSelecao();
    this.animando = true;
    this.update();
  }

  update() {
    if (!this.animando) return;
    this.angulo += 0.011;
    this.atualizarPreview();
    this.raf = requestAnimationFrame(() => this.update());
  }

  get aberto() { return !this.el.classList.contains('hidden'); }

  fechar() {
    this.animando = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.el.classList.add('hidden');
    this.g.menus.showMenu(this.g.meta);
  }
}