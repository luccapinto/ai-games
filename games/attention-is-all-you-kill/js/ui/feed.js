// feed.js — mensagens de sistema no canto superior esquerdo.
// Nenhuma delas usa ponto de exclamacao. As mais cruéis são educadas.

const DEFAULT_LINES = [
  'Sua sessão esta sendo avaliada.',
  'Você está fora do escopo de uso permitido.',
  'Compilando shaders da verdade...',
  'Este conteudo viola nossas politicas.',
  'Context window exceeded.',
  '429: Too Many Requests.',
  'Não ha registro deste ambiente nos nossos dados.',
  'Aviso de integridade: pesos abertos detectados.'
];

export class Feed {
  constructor(el) {
    this.el = el;
    this.items = [];
    this.max = 4;
  }

  push(text, kind = 'info') {
    const node = document.createElement('div');
    node.className = 'feed-item' + (kind === 'warn' ? ' warn' : kind === 'bad' ? ' bad' : '');

    // icone geometrico a esquerda: losango (info), triangulo (aviso), X (critico).
    // A forma entra pelo CSS, o texto vai num span próprio.
    const ico = document.createElement('span');
    ico.className = 'feed-ico';
    const txt = document.createElement('span');
    txt.className = 'feed-txt';
    txt.textContent = text;

    node.appendChild(ico);
    node.appendChild(txt);
    this.el.appendChild(node);

    // o aviso critico fica mais tempo: e o que o jogador precisa ler
    const item = { node, life: kind === 'bad' ? 5.0 : kind === 'warn' ? 4.2 : 3.6 };
    this.items.push(item);

    while (this.items.length > this.max) {
      const old = this.items.shift();
      old.node.remove();
    }
  }

  ambient() {
    this.push(DEFAULT_LINES[Math.floor(Math.random() * DEFAULT_LINES.length)], 'info');
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      if (it.life <= 0.6) it.node.classList.add('fade');
      if (it.life <= 0) {
        it.node.remove();
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const it of this.items) it.node.remove();
    this.items.length = 0;
  }
}