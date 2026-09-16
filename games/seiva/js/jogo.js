// O estado do jogo, sem uma linha de DOM.
//
// Isso e proposital: defesa de torre se equilibra por numero, e numero so se
// confere rodando. Com o jogo separado do desenho, da para simular as dez ondas
// em Node e responder duas perguntas que so olhar nao responde — "da para
// vencer?" e "da para vencer sem fazer nada?".

import {
  TRILHA, TORRES, PRAGAS, ONDAS, SEIVA_INICIAL, VIDAS_INICIAIS, podePlantar,
} from './mapa.js';

export class Jogo {
  constructor() {
    this.reiniciar();
  }

  reiniciar() {
    this.seiva = SEIVA_INICIAL;
    this.vidas = VIDAS_INICIAIS;
    this.onda = 0;
    this.torres = [];
    this.pragas = [];
    this.tiros = [];
    this.quadro = 0;
    this.emOnda = false;
    this.fila = [];
    this.vazou = 0;
    this.mortas = 0;
    this.fim = null;       // 'vitoria' | 'derrota'
    this.eventos = [];     // consumidos pelo som e pelas particulas
  }

  // ---------------------------------------------------------------- torres
  torreEm(x, y) { return this.torres.find(t => t.x === x && t.y === y); }

  // Cada torre encarece a proxima do mesmo tipo. Sem isso, a simulacao mostrou
  // que espalhar 35 espinhos baratos vence sem perder uma vida — e ai as outras
  // tres torres viram enfeite e o jogo deixa de ter decisao. A arvore nao
  // sustenta mais do mesmo: diversificar fica mais barato que repetir.
  custoDe(tipo) {
    const modelo = TORRES[tipo];
    if (!modelo) return Infinity;
    const iguais = this.torres.filter(t => t.tipo === tipo).length;
    return Math.round(modelo.custo * (1 + 0.38 * iguais));
  }

  plantar(x, y, tipo) {
    const modelo = TORRES[tipo];
    if (!modelo) return false;
    if (!podePlantar(x, y) || this.torreEm(x, y)) return false;
    const custo = this.custoDe(tipo);
    if (this.seiva < custo) return false;
    this.seiva -= custo;
    this.torres.push({
      x, y, tipo, nivel: 1, recarga: 0, custoPago: custo,
      ...this._atributos(tipo, 1),
    });
    this.eventos.push({ tipo: 'plantou', x, y });
    return true;
  }

  melhorar(x, y) {
    const t = this.torreEm(x, y);
    if (!t || t.nivel >= 2) return false;
    const custo = TORRES[t.tipo].melhoria.custo;
    if (this.seiva < custo) return false;
    this.seiva -= custo;
    t.nivel = 2;
    Object.assign(t, this._atributos(t.tipo, 2));
    this.eventos.push({ tipo: 'melhorou', x, y });
    return true;
  }

  // Vender devolve 60%: o suficiente para corrigir um erro, pouco o bastante
  // para nao virar estrategia de reconstruir a cada onda.
  vender(x, y) {
    const i = this.torres.findIndex(t => t.x === x && t.y === y);
    if (i < 0) return false;
    const t = this.torres[i];
    const pago = (t.custoPago || TORRES[t.tipo].custo)
      + (t.nivel > 1 ? TORRES[t.tipo].melhoria.custo : 0);
    this.seiva += Math.floor(pago * 0.6);
    this.torres.splice(i, 1);
    this.eventos.push({ tipo: 'vendeu', x, y });
    return true;
  }

  _atributos(tipo, nivel) {
    const m = TORRES[tipo];
    const base = {
      alcance: m.alcance, dano: m.dano, recargaMax: m.recarga,
      raio: m.raio, fator: m.fator, duracao: m.duracao,
      perfura: !!m.perfura, comportamento: m.tipo,
    };
    if (nivel > 1) {
      const u = m.melhoria;
      base.alcance = u.alcance ?? base.alcance;
      base.dano = u.dano ?? base.dano;
      base.recargaMax = u.recarga ?? base.recargaMax;
      base.raio = u.raio ?? base.raio;
      base.fator = u.fator ?? base.fator;
      base.duracao = u.duracao ?? base.duracao;
    }
    return base;
  }

  // ---------------------------------------------------------------- ondas
  get temProximaOnda() { return !this.emOnda && this.onda < ONDAS.length && !this.fim; }

  comecarOnda() {
    if (!this.temProximaOnda) return false;
    const onda = ONDAS[this.onda];
    this.fila = [];
    for (const g of onda.grupos) {
      for (let i = 0; i < g.quantidade; i++) {
        this.fila.push({ praga: g.praga, quando: (g.espera || 0) + i * g.atraso });
      }
    }
    this.fila.sort((a, b) => a.quando - b.quando);
    this.emOnda = true;
    this.relogioOnda = 0;
    this.eventos.push({ tipo: 'onda', numero: this.onda + 1 });
    return true;
  }

  // ---------------------------------------------------------------- passo
  passo() {
    if (this.fim) return;
    this.quadro++;

    if (this.emOnda) {
      this.relogioOnda++;
      while (this.fila.length && this.fila[0].quando <= this.relogioOnda) {
        const { praga } = this.fila.shift();
        const modelo = PRAGAS[praga];
        this.pragas.push({
          tipo: praga, pos: 0, vida: modelo.vida, vidaMax: modelo.vida,
          velocidade: modelo.velocidade, casca: modelo.casca,
          premio: modelo.premio, cor: modelo.cor, lento: 0, fator: 1,
        });
      }
    }

    this._moverPragas();
    this._atirar();
    this._moverTiros();

    if (this.emOnda && !this.fila.length && !this.pragas.length) {
      this.emOnda = false;
      this.onda++;
      // Bonus por onda limpa: recompensa quem segurou, e paga a proxima torre.
      const bonus = 15 + this.onda * 3;
      this.seiva += bonus;
      this.eventos.push({ tipo: 'ondaLimpa', bonus });
      if (this.onda >= ONDAS.length) this.fim = 'vitoria';
    }
  }

  _moverPragas() {
    for (const p of this.pragas) {
      if (p.lento > 0) { p.lento--; if (p.lento === 0) p.fator = 1; }
      p.pos += p.velocidade * p.fator;
      if (p.pos >= TRILHA.length - 1) {
        p.vazou = true;
      }
    }
    const vazadas = this.pragas.filter(p => p.vazou);
    if (vazadas.length) {
      this.vidas -= vazadas.length;
      this.vazou += vazadas.length;
      this.eventos.push({ tipo: 'vazou', quantidade: vazadas.length });
      this.pragas = this.pragas.filter(p => !p.vazou);
      if (this.vidas <= 0) { this.vidas = 0; this.fim = 'derrota'; }
    }
  }

  posicaoDe(p) {
    const i = Math.min(Math.floor(p.pos), TRILHA.length - 1);
    const prox = Math.min(i + 1, TRILHA.length - 1);
    const f = p.pos - i;
    return {
      x: TRILHA[i][0] + (TRILHA[prox][0] - TRILHA[i][0]) * f,
      y: TRILHA[i][1] + (TRILHA[prox][1] - TRILHA[i][1]) * f,
    };
  }

  _atirar() {
    for (const t of this.torres) {
      if (t.recarga > 0) { t.recarga--; continue; }
      // Mira em quem esta mais adiante na trilha: e a praga mais perigosa,
      // porque e a que falta menos para chegar no coracao.
      let alvo = null, melhor = -1;
      for (const p of this.pragas) {
        const pos = this.posicaoDe(p);
        const d = Math.hypot(pos.x - t.x, pos.y - t.y);
        if (d <= t.alcance && p.pos > melhor) { melhor = p.pos; alvo = p; }
      }
      if (!alvo) continue;
      t.recarga = t.recargaMax;
      const pos = this.posicaoDe(alvo);
      this.tiros.push({
        x: t.x, y: t.y, alvo, torre: t, vida: 26,
        comportamento: t.comportamento, cor: TORRES[t.tipo].cor,
        ax: pos.x, ay: pos.y,
      });
      this.eventos.push({ tipo: 'tiro', torre: t.tipo, x: t.x, y: t.y });
    }
  }

  _moverTiros() {
    for (const tiro of this.tiros) {
      tiro.vida--;
      const vivo = this.pragas.includes(tiro.alvo);
      if (vivo) {
        const pos = this.posicaoDe(tiro.alvo);
        tiro.ax = pos.x; tiro.ay = pos.y;
      }
      const dx = tiro.ax - tiro.x, dy = tiro.ay - tiro.y;
      const d = Math.hypot(dx, dy);
      const passo = 0.42;
      if (d <= passo || tiro.vida <= 0) {
        this._acertar(tiro);
        tiro.acabou = true;
      } else {
        tiro.x += dx / d * passo;
        tiro.y += dy / d * passo;
      }
    }
    this.tiros = this.tiros.filter(t => !t.acabou);
  }

  _acertar(tiro) {
    const t = tiro.torre;
    if (t.comportamento === 'area') {
      for (const p of [...this.pragas]) {
        const pos = this.posicaoDe(p);
        if (Math.hypot(pos.x - tiro.ax, pos.y - tiro.ay) <= t.raio) this._dano(p, t);
      }
      this.eventos.push({ tipo: 'area', x: tiro.ax, y: tiro.ay, raio: t.raio });
    } else if (t.comportamento === 'lentidao') {
      for (const p of [...this.pragas]) {
        const pos = this.posicaoDe(p);
        if (Math.hypot(pos.x - tiro.ax, pos.y - tiro.ay) <= 0.9) {
          p.fator = t.fator;
          p.lento = t.duracao;
          this._dano(p, t);
        }
      }
    } else if (this.pragas.includes(tiro.alvo)) {
      this._dano(tiro.alvo, t);
    }
  }

  // Casca subtrai do dano, com piso de 1: torre fraca contra alvo blindado
  // continua fazendo cocegas, mas nunca fica literalmente inutil.
  _dano(p, t) {
    const bruto = t.perfura ? t.dano : Math.max(1, t.dano - p.casca);
    p.vida -= bruto;
    if (p.vida <= 0) {
      const i = this.pragas.indexOf(p);
      if (i >= 0) {
        this.pragas.splice(i, 1);
        this.seiva += p.premio;
        this.mortas++;
        const pos = this.posicaoDe(p);
        this.eventos.push({ tipo: 'morreu', x: pos.x, y: pos.y, cor: p.cor });
      }
    }
  }

  consumirEventos() {
    const e = this.eventos;
    this.eventos = [];
    return e;
  }
}
