// As regras da cripta. Puzzle por turnos: nada se move sozinho entre jogadas,
// entao o estado inteiro cabe num instantaneo pequeno e desfazer e barato.
//
// Desfazer nao e enfeite num jogo de empurrar caixa: sem ele, um erro a tres
// jogadas de distancia obriga a refazer a sala inteira, e a pessoa fecha a aba.

import { LARGURA, ALTURA } from './nivel.js';

export const VAZIO = 0;
export const PEDRA = 1;
export const PLACA = 2;
export const LAJE = 3;
export const SAIDA = 4;

export class Cripta {
  constructor(sala) {
    this.nome = sala.nome;
    this.dica = sala.dica || '';
    this.grade = new Uint8Array(LARGURA * ALTURA);
    this.inicioCaixas = [];
    this.inicioJogador = { x: 1, y: 1 };
    this.saida = null;
    this.placas = [];

    sala.mapa.forEach((linha, y) => {
      if (linha.length !== LARGURA) {
        throw new Error(`sala "${sala.nome}": linha ${y} tem ${linha.length} colunas`);
      }
      for (let x = 0; x < LARGURA; x++) {
        const s = linha[x];
        const i = y * LARGURA + x;
        if (s === '#') this.grade[i] = PEDRA;
        else if (s === '=') this.grade[i] = LAJE;
        else if (s === 'o') { this.grade[i] = PLACA; this.placas.push({ x, y }); }
        else if (s === 'X') { this.grade[i] = PLACA; this.placas.push({ x, y }); this.inicioCaixas.push({ x, y }); }
        else if (s === 'S') { this.grade[i] = SAIDA; this.saida = { x, y }; }
        else if (s === 'C') this.inicioCaixas.push({ x, y });
        else if (s === 'P') this.inicioJogador = { x, y };
      }
    });
    if (!this.saida) throw new Error(`sala "${sala.nome}": sem saida (S)`);
    this.reiniciar();
  }

  reiniciar() {
    this.jogador = { ...this.inicioJogador };
    this.caixas = this.inicioCaixas.map(c => ({ ...c }));
    this.lajes = new Set();     // lajes ja desmanchadas
    this.pisando = null;        // laje sob os pes agora
    this.historico = [];
    this.jogadas = 0;
    this.venceu = false;
    this.assentar();
  }

  // ---------------------------------------------------------------- consultas
  tile(x, y) {
    if (x < 0 || x >= LARGURA || y < 0 || y >= ALTURA) return PEDRA; // borda e parede
    const i = y * LARGURA + x;
    if (this.grade[i] === LAJE && this.lajes.has(i)) return VAZIO;
    return this.grade[i];
  }

  bloqueia(x, y) {
    const t = this.tile(x, y);
    return t === PEDRA || t === LAJE;
  }

  caixaEm(x, y) { return this.caixas.find(c => c.x === x && c.y === y); }

  livreParaJogador(x, y) { return !this.bloqueia(x, y) && !this.caixaEm(x, y); }

  livreParaCaixa(x, y) {
    return !this.bloqueia(x, y) && !this.caixaEm(x, y)
      && !(this.jogador.x === x && this.jogador.y === y);
  }

  get placasOcupadas() {
    return this.placas.filter(p => this.caixaEm(p.x, p.y)).length;
  }

  get saidaAberta() { return this.placasOcupadas === this.placas.length; }

  // ---------------------------------------------------------------- instantaneo
  salvar() {
    return {
      jogador: { ...this.jogador },
      caixas: this.caixas.map(c => ({ ...c })),
      lajes: new Set(this.lajes),
      pisando: this.pisando,
      jogadas: this.jogadas,
    };
  }

  restaurar(s) {
    this.jogador = { ...s.jogador };
    this.caixas = s.caixas.map(c => ({ ...c }));
    this.lajes = new Set(s.lajes);
    this.pisando = s.pisando;
    this.jogadas = s.jogadas;
    this.venceu = false;
  }

  desfazer() {
    if (!this.historico.length) return false;
    this.restaurar(this.historico.pop());
    return true;
  }

  // ---------------------------------------------------------------- jogada
  // Devolve o que aconteceu, para o som e as particulas saberem o que tocar.
  // `subir` e o modificador (segurar cima): sobe em cima da caixa em vez de
  // empurrar. Sem ele, caixa ja posta numa placa vira parede permanente — o
  // unico jeito de passar seria empurrando ela para fora da placa.
  mover(dir, subir = false) {
    if (this.venceu) return null;
    const antes = this.salvar();
    const { x, y } = this.jogador;
    const ax = x + dir;
    let acao = null;

    const caixa = this.caixaEm(ax, y);
    if (caixa) {
      if (!subir && this.livreParaCaixa(ax + dir, y)) {
        caixa.x = ax + dir;
        this.jogador = { x: ax, y };
        acao = 'empurrou';
      } else if (this.livreParaJogador(ax, y - 1) && this.livreParaJogador(x, y - 1)) {
        this.jogador = { x: ax, y: y - 1 };
        acao = 'subiu';
      } else {
        return null;
      }
    } else if (this.bloqueia(ax, y)) {
      // Subir um degrau, se houver espaco para a cabeca e para o pe.
      if (this.livreParaJogador(ax, y - 1) && this.livreParaJogador(x, y - 1)) {
        this.jogador = { x: ax, y: y - 1 };
        acao = 'subiu';
      } else {
        return null;
      }
    } else {
      this.jogador = { x: ax, y };
      acao = 'andou';
    }

    this.quebrarLajeSeSaiu(x, y);
    const caiu = this.assentar();
    this.jogadas++;
    this.historico.push(antes);
    if (this.historico.length > 400) this.historico.shift();

    if (this.jogador.x === this.saida.x && this.jogador.y === this.saida.y && this.saidaAberta) {
      this.venceu = true;
      acao = 'venceu';
    }
    return caiu ? (acao === 'venceu' ? acao : 'caiu') : acao;
  }

  // A laje desmancha assim que o pe sai de cima: e ponte de uma passagem so.
  quebrarLajeSeSaiu(xAntes, yAntes) {
    const i = yAntes * LARGURA + xAntes;
    const abaixo = (yAntes + 1) * LARGURA + xAntes;
    if (this.grade[abaixo] === LAJE && !this.lajes.has(abaixo)
      && !(this.jogador.x === xAntes && this.jogador.y === yAntes)) {
      this.lajes.add(abaixo);
    }
  }

  // Gravidade ate estabilizar. Caixa pousa em cima do jogador de proposito:
  // sem isso, "segurar" uma caixa com a cabeca deixaria de ser uma ferramenta.
  assentar() {
    let caiu = false;
    for (let giro = 0; giro < ALTURA * 3; giro++) {
      let mexeu = false;
      const ordem = [...this.caixas].sort((a, b) => b.y - a.y);
      for (const c of ordem) {
        if (this.livreParaCaixa(c.x, c.y + 1)) { c.y++; mexeu = true; caiu = true; }
      }
      if (this.livreParaJogador(this.jogador.x, this.jogador.y + 1)) {
        this.jogador.y++; mexeu = true; caiu = true;
      }
      if (!mexeu) break;
    }
    return caiu;
  }
}
