// Aleatoriedade verificável.
//
// Antes da rodada a casa sorteia uma semente secreta e publica só o SHA-256
// dela. O jogador tem a própria semente, que ele pode trocar quando quiser.
// O resultado sai de HMAC-SHA256(semente da casa, "semente do jogador:contador:bloco"),
// e depois da rodada a semente da casa é revelada: qualquer um confere que o
// hash publicado era dela e recalcula o resultado.
//
// Nada aqui recebe saldo, aposta ou histórico. O gerador só conhece as três
// entradas acima, e é isso que as provas conferem.

import { hmacSha256, sha256hex, hex } from './sha256.js';

export function bytesAleatorios(n) {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

export function novaSemente(fonte = bytesAleatorios) {
  return hex(fonte(32));
}

export function sementeJogadorPadrao(fonte = bytesAleatorios) {
  return hex(fonte(8));
}

// Fluxo de bytes determinístico. Cada bloco de 32 bytes é um HMAC.
export function criarGerador(sementeCasa, sementeJogador, contador) {
  let bloco = 0;
  let buf = null;
  let pos = 32;
  let usados = 0;

  function proximoBloco() {
    buf = hmacSha256(sementeCasa, `${sementeJogador}:${contador}:${bloco}`);
    bloco++;
    pos = 0;
  }

  function u32() {
    if (pos >= 32) proximoBloco();
    const v = ((buf[pos] << 24) | (buf[pos + 1] << 16) | (buf[pos + 2] << 8) | buf[pos + 3]) >>> 0;
    pos += 4;
    usados++;
    return v;
  }

  // Inteiro uniforme em [0, n). Rejeição acima do maior múltiplo de n que cabe
  // em 32 bits: sem isso, os primeiros restos sairiam um pouco mais vezes.
  function inteiro(n) {
    if (!(n >= 1 && n <= 0x100000000 && Number.isInteger(n))) throw new Error(`inteiro(${n}) fora do domínio`);
    const limite = Math.floor(0x100000000 / n) * n;
    let v;
    do { v = u32(); } while (v >= limite);
    return v % n;
  }

  // Real em [0, 1) com 53 bits.
  function real() {
    const a = u32() >>> 5, b = u32() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }

  // Fisher-Yates de trás para a frente.
  function embaralhar(lista) {
    for (let i = lista.length - 1; i > 0; i--) {
      const j = inteiro(i + 1);
      const t = lista[i]; lista[i] = lista[j]; lista[j] = t;
    }
    return lista;
  }

  return {
    u32, inteiro, real, embaralhar,
    get sorteios() { return usados; },
    get blocos() { return bloco; },
  };
}

// O cartório: guarda as sementes pendentes de cada jogo, o contador e o
// arquivo das reveladas. O estado é um objeto simples para caber no
// localStorage; quem persiste é a casa.
export function estadoJustoInicial(fonte = bytesAleatorios) {
  return {
    sementeJogador: sementeJogadorPadrao(fonte),
    contadores: {},
    pendentes: {},
    abertos: {},
    revelados: [],
  };
}

export const LIMITE_REVELADOS = 300;

export function criarJusto(estado, fonte = bytesAleatorios) {
  function preparar(jogo) {
    if (!estado.pendentes[jogo]) {
      const semente = novaSemente(fonte);
      estado.pendentes[jogo] = { semente, hash: sha256hex(semente) };
    }
    if (estado.contadores[jogo] === undefined) estado.contadores[jogo] = 0;
    return estado.pendentes[jogo];
  }

  // O que o jogador vê antes de apostar: o hash, a semente dele e o contador.
  function compromisso(jogo) {
    if (estado.abertos[jogo]) {
      const a = estado.abertos[jogo];
      return { hash: a.hash, sementeJogador: a.sementeJogador, contador: a.contador, aberto: true };
    }
    const p = preparar(jogo);
    return { hash: p.hash, sementeJogador: estado.sementeJogador, contador: estado.contadores[jogo], aberto: false };
  }

  // Usa a semente pendente. A semente do jogador fica gravada neste instante:
  // trocar a semente depois não mexe numa rodada ou num sapato já aberto.
  function abrir(jogo) {
    if (estado.abertos[jogo]) throw new Error(`${jogo}: já existe uma rodada aberta`);
    const p = preparar(jogo);
    const registro = {
      jogo,
      hash: p.hash,
      semente: p.semente,
      sementeJogador: estado.sementeJogador,
      contador: estado.contadores[jogo],
    };
    estado.abertos[jogo] = registro;
    delete estado.pendentes[jogo];
    return { registro, gerador: criarGerador(registro.semente, registro.sementeJogador, registro.contador) };
  }

  function aberto(jogo) {
    return estado.abertos[jogo] || null;
  }

  // Um gerador novo, do zero, para um registro já aberto (usado ao recarregar
  // a página com um sapato no meio).
  function geradorDe(registro) {
    return criarGerador(registro.semente, registro.sementeJogador, registro.contador);
  }

  // Fecha a rodada: a semente vai para o arquivo junto com o resumo do que
  // saiu, e o jogo ganha um compromisso novo para a próxima.
  function revelar(jogo, resultado) {
    const r = estado.abertos[jogo];
    if (!r) throw new Error(`${jogo}: nada aberto para revelar`);
    delete estado.abertos[jogo];
    estado.contadores[jogo] = r.contador + 1;
    const revelado = { ...r, resultado, revelado: Date.now() };
    estado.revelados.push(revelado);
    if (estado.revelados.length > LIMITE_REVELADOS) estado.revelados.splice(0, estado.revelados.length - LIMITE_REVELADOS);
    preparar(jogo);
    return revelado;
  }

  function trocarSementeJogador(nova) {
    const limpa = String(nova ?? '').trim();
    if (!limpa || limpa.length > 64 || /[\u0000-\u001f]/.test(limpa)) throw new Error('A semente precisa ter de 1 a 64 caracteres visíveis.');
    estado.sementeJogador = limpa;
    return limpa;
  }

  return {
    estado,
    compromisso, abrir, aberto, geradorDe, revelar, trocarSementeJogador,
    get sementeJogador() { return estado.sementeJogador; },
    get revelados() { return estado.revelados; },
  };
}

// Conferência independente: não usa nada do estado da casa, só os números
// publicados. É o que o painel Conferir roda na frente do jogador.
export function conferirHash(semente, hash) {
  return sha256hex(semente) === String(hash).toLowerCase();
}
