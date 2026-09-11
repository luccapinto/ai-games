// skin.js — aparência do jogador, salva entre sessões.
//
// O jogo é em primeira pessoa, então a aparência só importa se ela aparecer em
// algum lugar. Aparece em dois: nos bracos que seguram a arma (visiveis o tempo
// todo) e no retrato do HUD. Foi por isso que a customizacao virou bracos +
// paleta em vez de um menu de opções que não muda nada na tela.

const CHAVE = 'aiayk_skin_v2';

export const PALETA = {
  acabamento: [
    { id: 'grafite', nome: 'GRAFITE', cor: 0x2a3138 },
    { id: 'aco', nome: 'ACO', cor: 0x4a5560 },
    { id: 'areia', nome: 'AREIA', cor: 0x8a7a5c },
    { id: 'oliva', nome: 'OLIVA', cor: 0x5c6b45 },
    { id: 'vinho', nome: 'VINHO', cor: 0x6b3540 },
    { id: 'gelo', nome: 'GELO', cor: 0x9fb4bf }
  ],
  luz: [
    { id: 'ciano', nome: 'CIANO', cor: 0x35f0d8 },
    { id: 'ambar', nome: 'AMBAR', cor: 0xffb347 },
    { id: 'magenta', nome: 'MAGENTA', cor: 0xff2e88 },
    { id: 'verde', nome: 'VERDE', cor: 0x7dff6b },
    { id: 'azul', nome: 'AZUL', cor: 0x5aa8ff },
    { id: 'vermelho', nome: 'VERMELHO', cor: 0xff4a3b }
  ]
};

const PADRAO = { acabamento: 'grafite', luz: 'ciano' };

function acharCor(lista, id, padraoId) {
  const achado = lista.find(c => c.id === id) || lista.find(c => c.id === padraoId);
  return achado ? achado.cor : 0xffffff;
}

export class Skin {
  constructor() {
    this.acabamento = PADRAO.acabamento;
    this.luz = PADRAO.luz;
    this.carregar();
  }

  carregar() {
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (!bruto) return;
      const dados = JSON.parse(bruto);
      if (dados && dados.acabamento) this.acabamento = dados.acabamento;
      if (dados && dados.luz) this.luz = dados.luz;
    } catch (e) {
      // localStorage bloqueado ou dado corrompido: mantem o padrão em silêncio,
      // aparência não pode impedir o jogo de abrir
    }
  }

  salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ acabamento: this.acabamento, luz: this.luz }));
    } catch (e) {
      // idem: falha de persistencia não é motivo para quebrar a partida
    }
  }

  get corAcabamento() { return acharCor(PALETA.acabamento, this.acabamento, PADRAO.acabamento); }
  get corLuz() { return acharCor(PALETA.luz, this.luz, PADRAO.luz); }

  definir(tipo, id) {
    if (tipo === 'acabamento') this.acabamento = id;
    if (tipo === 'luz') this.luz = id;
    this.salvar();
  }

  get resumo() {
    const a = PALETA.acabamento.find(c => c.id === this.acabamento);
    const l = PALETA.luz.find(c => c.id === this.luz);
    return `${a ? a.nome : this.acabamento} / ${l ? l.nome : this.luz}`;
  }
}