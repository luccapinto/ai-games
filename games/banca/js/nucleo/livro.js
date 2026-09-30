// O Livro da Casa.
//
// Cada rodada entra com quatro números: quanto foi apostado, quanto voltou,
// quanto a matemática dizia que você perderia (a soma de valor x vantagem da
// casa de cada aposta) e a variância do resultado. Com isso o livro mostra, por
// jogo e no total, a distância entre o que aconteceu e o que era esperado, em
// desvios-padrão. É a sua sorte, medida.

export const LIMITE_RODADAS = 4000;

function totalVazio() {
  return { n: 0, apostado: 0, retorno: 0, perdaEsperada: 0, variancia: 0, custoErros: 0, maiorPremio: 0 };
}

export function estadoLivroInicial() {
  return { seq: 0, totais: { total: totalVazio() }, rodadas: [], eventos: [] };
}

function finito(v, nome) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${nome} inválido: ${v}`);
}

export function criarLivro(estado) {
  function registrar(r) {
    const { jogo } = r;
    if (!jogo || typeof jogo !== 'string') throw new Error('rodada sem jogo');
    if (!Number.isInteger(r.apostado) || r.apostado < 0) throw new Error(`apostado inválido: ${r.apostado}`);
    if (!Number.isInteger(r.retorno) || r.retorno < 0) throw new Error(`retorno inválido: ${r.retorno}`);
    finito(r.perdaEsperada, 'perda esperada');
    finito(r.variancia, 'variância');
    if (r.perdaEsperada < -1e-9) throw new Error('perda esperada negativa: alguma aposta favorece o jogador');
    if (r.variancia < 0) throw new Error('variância negativa');
    const custoErro = r.custoErro ?? 0;
    finito(custoErro, 'custo do erro');

    const t = estado.totais.total;
    const g = estado.totais[jogo] ?? (estado.totais[jogo] = totalVazio());
    for (const a of [t, g]) {
      a.n++;
      a.apostado += r.apostado;
      a.retorno += r.retorno;
      a.perdaEsperada += r.perdaEsperada;
      a.variancia += r.variancia;
      a.custoErros += custoErro;
      a.maiorPremio = Math.max(a.maiorPremio, r.retorno - r.apostado);
    }
    const registro = {
      i: ++estado.seq,
      t: r.t ?? Date.now(),
      jogo,
      apostado: r.apostado,
      retorno: r.retorno,
      perdaEsperada: r.perdaEsperada,
      variancia: r.variancia,
      custoErro,
      rotulo: r.rotulo ?? '',
      contador: r.contador ?? null,
      // Acumulados no momento da rodada: o gráfico continua certo mesmo depois
      // que as rodadas mais antigas saem da memória.
      real: t.retorno - t.apostado,
      esperado: -t.perdaEsperada,
      var: t.variancia,
      realJogo: g.retorno - g.apostado,
      esperadoJogo: -g.perdaEsperada,
      varJogo: g.variancia,
      nJogo: g.n,
    };
    estado.rodadas.push(registro);
    if (estado.rodadas.length > LIMITE_RODADAS) estado.rodadas.splice(0, estado.rodadas.length - LIMITE_RODADAS);
    return registro;
  }

  function evento(tipo, valor, texto) {
    estado.eventos.push({ tipo, valor, texto, t: Date.now(), apos: estado.seq });
    if (estado.eventos.length > 400) estado.eventos.splice(0, estado.eventos.length - 400);
  }

  function resumo(jogo = 'total') {
    const a = estado.totais[jogo] ?? totalVazio();
    const real = a.retorno - a.apostado;
    const esperado = -a.perdaEsperada;
    const sigma = Math.sqrt(a.variancia);
    return {
      ...a,
      real,
      esperado,
      sigma,
      sorte: sigma > 0 ? (real - esperado) / sigma : 0,
      vantagemMedia: a.apostado > 0 ? a.perdaEsperada / a.apostado : 0,
      vantagemReal: a.apostado > 0 ? -real / a.apostado : 0,
    };
  }

  function rodadas(jogo) {
    return jogo && jogo !== 'total' ? estado.rodadas.filter(r => r.jogo === jogo) : estado.rodadas;
  }

  function jogos() {
    return Object.keys(estado.totais).filter(k => k !== 'total');
  }

  return { estado, registrar, evento, resumo, rodadas, jogos };
}

// Interpretação honesta de um número de desvios-padrão.
export function lerSorte(z) {
  const a = Math.abs(z);
  if (a < 0.5) return 'Exatamente o que a matemática previa.';
  if (a < 1) return z > 0 ? 'Um pouco de sorte, dentro do normal.' : 'Um pouco de azar, dentro do normal.';
  if (a < 2) return z > 0 ? 'Sorte clara: acontece com cerca de 1 em cada 6 jogadores.' : 'Azar claro: acontece com cerca de 1 em cada 6 jogadores.';
  if (a < 3) return z > 0 ? 'Sorte rara: menos de 1 em cada 40 jogadores chega aqui.' : 'Azar raro: menos de 1 em cada 40 jogadores chega aqui.';
  return z > 0 ? 'Sorte extraordinária. Não conte com ela amanhã.' : 'Azar extraordinário. A roleta não tem memória, mas o seu saldo tem.';
}
