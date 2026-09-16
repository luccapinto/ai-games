// O combate e a corrida inteira, sem DOM.
//
// Jogo de construir baralho se equilibra por taxa de vitoria, e taxa de vitoria
// so aparece rodando a corrida milhares de vezes. Isso exige que o jogo nao
// dependa do navegador — e exige tambem que o sorteio seja semeado, senao duas
// rodadas iguais dao resultados diferentes e nada e reproduzivel.

import {
  CARTAS, BARALHO_INICIAL, RECOMPENSAS, SERVIDORES, SALAS,
  PACIENCIA_INICIAL, TEMPO_POR_TURNO, CARTAS_POR_TURNO, FORCA_MAXIMA,
} from './dados.js';

// Gerador semeado: o mesmo numero de semente da sempre a mesma corrida.
export function semente(n) {
  let s = n >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Corrida {
  constructor(sem = Date.now()) {
    this.rand = semente(sem);
    this.semente = sem;
    this.baralho = [...BARALHO_INICIAL];
    this.paciencia = PACIENCIA_INICIAL;
    this.pacienciaMax = PACIENCIA_INICIAL;
    this.sala = 0;
    this.fim = null;              // 'vitoria' | 'derrota'
    this.recompensas = null;      // cartas a escolher entre salas
    this.combate = null;
    this.registro = [];
    this.abrirSala();
  }

  abrirSala() {
    const chave = SALAS[this.sala];
    this.combate = new Combate(SERVIDORES[chave], this.baralho, this.paciencia, this.pacienciaMax, this.rand);
  }

  // Chamado quando o combate acaba: guarda o resultado e oferece recompensa.
  resolverCombate() {
    const c = this.combate;
    this.paciencia = c.paciencia;
    this.registro.push({ sala: this.sala, servidor: c.servidor.nome, venceu: c.venceu, paciencia: this.paciencia, turnos: c.turno });
    if (!c.venceu) { this.fim = 'derrota'; return; }
    if (this.sala + 1 >= SALAS.length) { this.fim = 'vitoria'; return; }
    // Tres cartas sorteadas, sem repetir.
    const opcoes = [...RECOMPENSAS];
    this.recompensas = [];
    for (let i = 0; i < 3 && opcoes.length; i++) {
      this.recompensas.push(opcoes.splice(Math.floor(this.rand() * opcoes.length), 1)[0]);
    }
  }

  escolher(carta) {
    if (!this.recompensas) return false;
    if (carta !== null && !this.recompensas.includes(carta)) return false;
    if (carta !== null) this.baralho.push(carta);
    // Recuperar entre salas: sem isso a corrida vira uma corrida de paciencia, e
    // a construcao de baralho deixa de importar. Com 9 de recuperacao a
    // simulacao dava 0% de vitoria, com toda corrida morrendo na quarta sala.
    this.paciencia = Math.min(this.pacienciaMax, this.paciencia + 18);
    this.recompensas = null;
    this.sala++;
    this.abrirSala();
    return true;
  }
}

export class Combate {
  constructor(servidor, baralho, paciencia, pacienciaMax, rand) {
    this.rand = rand;
    this.servidor = { ...servidor, guarda: 0, forca: 0, fragil: 0, atordoado: 0, passo: 0 };
    this.servidor.paciencia = servidor.paciencia;
    this.servidor.pacienciaMax = servidor.paciencia;
    this.paciencia = paciencia;
    this.pacienciaMax = pacienciaMax;
    this.guarda = 0;
    this.tempo = TEMPO_POR_TURNO;
    this.turno = 0;
    this.venceu = null;
    this.monte = this._embaralhar([...baralho]);
    this.mao = [];
    this.descarte = [];
    this.registroTurno = [];
    this.novoTurno();
  }

  _embaralhar(lista) {
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    return lista;
  }

  get intencao() {
    const p = this.servidor.padrao;
    return p[this.servidor.passo % p.length];
  }

  // Dano que a proxima intencao vai causar, ja com a forca somada. E o numero
  // que a pessoa precisa ver para decidir entre atacar e se guardar.
  get danoAnunciado() {
    const i = this.intencao;
    if (i.tipo !== 'ataque') return 0;
    return (i.valor + this.servidor.forca) * (i.vezes || 1);
  }

  comprar(n) {
    for (let i = 0; i < n; i++) {
      if (!this.monte.length) {
        if (!this.descarte.length) return;
        this.monte = this._embaralhar(this.descarte);
        this.descarte = [];
      }
      if (this.mao.length >= 10) return;   // teto de mao, senao vira leque
      this.mao.push(this.monte.pop());
    }
  }

  novoTurno() {
    this.turno++;
    this.tempo = TEMPO_POR_TURNO;
    this.guarda = 0;                 // guarda nao acumula entre turnos
    this.comprar(CARTAS_POR_TURNO);
  }

  podeJogar(indice) {
    const carta = CARTAS[this.mao[indice]];
    if (!carta || this.venceu !== null) return false;
    if (carta.custo > this.tempo) return false;
    if (carta.custoPaciencia && this.paciencia <= carta.custoPaciencia) return false;
    return true;
  }

  jogar(indice) {
    if (!this.podeJogar(indice)) return false;
    const chave = this.mao[indice];
    const carta = CARTAS[chave];
    this.tempo -= carta.custo;
    this.mao.splice(indice, 1);
    this.descarte.push(chave);

    if (carta.custoPaciencia) this.paciencia -= carta.custoPaciencia;
    if (carta.tempo) this.tempo += carta.tempo;
    if (carta.guarda) this.guarda += carta.guarda;
    if (carta.cura) this.paciencia = Math.min(this.pacienciaMax, this.paciencia + carta.cura);
    if (carta.compra) this.comprar(carta.compra);
    if (carta.fragiliza) this.servidor.fragil += carta.fragiliza;

    const vezes = carta.vezes || 1;
    let dano = carta.dano || 0;
    if (carta.danoPorCarta) dano = carta.danoPorCarta * this.mao.length;
    for (let i = 0; i < vezes && dano > 0; i++) this._bater(dano);
    if (carta.atordoa) this.servidor.atordoado = 1;

    if (this.servidor.paciencia <= 0) this.venceu = true;
    return true;
  }

  _bater(bruto) {
    const s = this.servidor;
    const real = Math.round(bruto * (s.fragil > 0 ? 1.5 : 1));
    const absorvido = Math.min(s.guarda, real);
    s.guarda -= absorvido;
    s.paciencia -= real - absorvido;
  }

  // Passa a vez: o servidor age, a mao vai para o descarte, novo turno comeca.
  passar() {
    if (this.venceu !== null) return;
    const s = this.servidor;

    if (s.atordoado > 0) {
      s.atordoado--;
    } else {
      const i = this.intencao;
      if (i.tipo === 'ataque') {
        const vezes = i.vezes || 1;
        for (let k = 0; k < vezes; k++) {
          const dano = i.valor + s.forca;
          const absorvido = Math.min(this.guarda, dano);
          this.guarda -= absorvido;
          this.paciencia -= dano - absorvido;
        }
      } else if (i.tipo === 'guarda') {
        s.guarda += i.valor;
      } else if (i.tipo === 'forca') {
        // Teto na forca. Sem ele o dano vira espiral e o jogador nao tem
        // resposta nenhuma: a simulacao mostrou 97% das corridas morrendo no
        // chefe, sempre no terceiro ciclo, quando a forca ja tinha dobrado o
        // golpe anunciado.
        s.forca = Math.min(FORCA_MAXIMA, s.forca + i.valor);
      }
      s.passo++;
    }

    if (s.fragil > 0) s.fragil--;
    if (this.paciencia <= 0) { this.paciencia = 0; this.venceu = false; return; }

    this.descarte.push(...this.mao);
    this.mao = [];
    this.novoTurno();
  }
}
