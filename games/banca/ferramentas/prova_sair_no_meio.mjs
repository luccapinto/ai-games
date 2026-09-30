// Prova no navegador: sair da mesa no meio da rodada.
//
// Para cada mesa, começa uma rodada pela própria interface e sai em 0,5 s,
// 1,5 s e 3 s, e em mais dois pontos perto do fim da encenação (55% e 85% da
// duração medida no controle, quando passam de 3,5 s: é onde ficam o pagamento
// da roleta e a revelação do bacará), para outra mesa e para o salão; espera
// 3,5 s lá, volta e termina o que ficou aberto. O controle faz a mesma visita,
// mas só depois de a mesa ficar livre. Exige, em cada rodada:
//
//   - nenhuma exceção na página (nem promessa rejeitada sem tratamento) e
//     nenhum console.error, do começo ao fim;
//   - 3,5 s depois de sair, saldo, dívida e Livro da Casa iguais ao que eram
//     logo depois do sorteio: a animação não move dinheiro, nem ficando nem
//     saindo;
//   - o saldo mostrado no topo igual ao da carteira (nada ficou congelado);
//   - a mesa volta livre e, terminada a rodada, tudo (saldo, Livro, estado de
//     cada mesa, contadores do gerador) idêntico ao do controle, que tem o
//     mesmo sorteio e esperou a animação inteira;
//   - todo sorteio revelado confere no painel Conferir;
//   - blackjack parado na pergunta do seguro: a pergunta continua lá na volta;
//     vídeo pôquer com a mão aberta: a mesma mão, virada para cima, sem mexer
//     no dinheiro enquanto o jogador estava fora.
//
// Para o controle e a saída terem o mesmo sorteio, a página recebe, antes de
// carregar, um crypto.getRandomValues determinístico (xorshift): a casa nasce
// com as mesmas sementes nas duas. Nada mais no jogo usa essa função, e as
// sementes das seis mesas são preparadas logo no início, então visitar outra
// mesa não desloca o fluxo de bytes.
//
// Sem dependência: sobe um servidor estático da pasta do jogo e conversa com o
// Chrome pelo protocolo DevTools, com o WebSocket do próprio Node 22.
//
//   node ferramentas/prova_sair_no_meio.mjs                 # todos os cenários
//   node ferramentas/prova_sair_no_meio.mjs roleta bacara   # só estes
//   node ferramentas/prova_sair_no_meio.mjs --celular       # 390x844, toque
//   CHROME=/caminho/do/chrome node ferramentas/prova_sair_no_meio.mjs

import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, normalize, extname, sep } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// sem a barra do fim: o servidor compara RAIZ + sep com cada caminho pedido
const RAIZ = normalize(fileURLToPath(new URL('..', import.meta.url))).replace(/[\\/]+$/, '');
const args = process.argv.slice(2);
const CELULAR = args.includes('--celular');
const SO = args.filter(a => !a.startsWith('--'));
const PARALELO = 3;

// ------------------------------------------------------------ os cenários

const TEMPOS = [500, 1500, 3000];
const CENARIOS = [
  ['roleta', 'roleta', TEMPOS],
  ['blackjack-dar', 'blackjack', TEMPOS],
  ['blackjack-final', 'blackjack', TEMPOS],
  ['blackjack-seguro', 'blackjack', [500]],
  ['niquel', 'niquel', TEMPOS],
  ['niquel-bonus', 'niquel', TEMPOS],
  ['videopoquer-dar', 'videopoquer', TEMPOS],
  ['videopoquer-trocar', 'videopoquer', TEMPOS],
  ['videopoquer-aberta', 'videopoquer', [500]],
  ['bacara', 'bacara', TEMPOS],
  ['craps', 'craps', TEMPOS],
].filter(([nome, mesa]) => !SO.length || SO.includes(nome) || SO.includes(mesa));

// Tudo o que roda dentro da página. Usa só a interface pública das mesas
// (window.__banca.mesaAtual), a mesma que os botões chamam.
const PAGINA = String.raw`(() => {
  const esp = ms => new Promise(r => setTimeout(r, ms));
  const b = () => window.__banca;
  const JOGOS = ['roleta', 'blackjack', 'niquel', 'videopoquer', 'bacara', 'craps'];
  const url = p => new URL(p, location.href).href;
  async function ate(f, ms, oque) {
    const t0 = performance.now();
    for (;;) {
      let ok = false;
      try { ok = f(); } catch {}
      if (ok) return;
      if (performance.now() - t0 > ms) throw new Error('tempo esgotado esperando ' + oque);
      await esp(50);
    }
  }
  function clicar(sel) {
    const el = document.querySelector(sel);
    if (!el) throw new Error('não achei ' + sel);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }
  const LIVRE = {
    roleta: m => !m.girando,
    blackjack: m => !m.ocupado,
    niquel: m => !m.ocupado && !m.sessao.emGirosGratis,
    videopoquer: m => !m.ocupado,
    bacara: m => !m.ocupado,
    craps: m => !m.ocupado,
  };
  const livre = id => { const m = b().mesaAtual; return !!(m && m.sessao && LIVRE[id](m)); };
  async function sentar(id, anterior = b().mesaAtual, esperarLivre = true) {
    location.hash = '#/' + id;
    await ate(() => b().mesaAtual && b().mesaAtual !== anterior && b().mesaAtual.sessao, 15000, 'montar ' + id);
    await esp(300);
    if (esperarLivre) await ate(() => livre(id), 180000, id + ' livre');
    return b().mesaAtual;
  }

  // estado que a interface guarda só para se desenhar: fica fora da comparação
  const DA_TELA = new Set(['ficha', 'rapido', 'rotorAng', 'bolaPsi', 'aba']);
  let fichas = null;
  async function foto() {
    fichas ??= (await import(url('js/nucleo/formato.js'))).fichas;
    const c = b().casa;
    const r = j => { const x = c.livro.resumo(j); return [x.n, x.apostado, x.real, Math.round(x.perdaEsperada * 1e6) / 1e6]; };
    return {
      dinheiro: { saldo: c.carteira.saldo, divida: c.carteira.divida, livro: r(), mesas: Object.fromEntries(JOGOS.map(j => [j, r(j)])) },
      mostrado: document.getElementById('saldo-valor').textContent.trim(),
      esperado: fichas(c.carteira.saldo),
      mesas: Object.fromEntries(JOGOS.map(j => [j, JSON.stringify(c.mesa(j), (k, v) => DA_TELA.has(k) ? undefined : v)])),
      gerador: JSON.stringify({ contadores: c.justo.estado.contadores, abertos: Object.keys(c.justo.estado.abertos).sort(), revelados: c.justo.revelados.length }),
    };
  }
  async function conferir() {
    const falhas = [];
    for (const r of b().casa.justo.revelados) {
      const mod = await import(url('js/jogos/' + r.jogo + '/regras.js'));
      const x = mod.conferir(r);
      if (!x.confere) falhas.push(r.jogo + ' ' + r.contador + ': ' + x.descricao);
    }
    return { n: b().casa.justo.revelados.length, falhas };
  }

  async function terminarBlackjack() {
    for (let k = 0; k < 20; k++) {
      await ate(() => livre('blackjack'), 60000, 'blackjack livre');
      const m = b().mesaAtual, e = m.sessao.estado;
      if (e === 'seguro') await m.acao('seguroNao');
      else if (e === 'jogando') await m.acao(m.sessao.conselho().acao);
      else return;
    }
    throw new Error('a mão de blackjack não terminou');
  }
  async function segurarOtimo() {
    await ate(() => livre('videopoquer'), 60000, 'análise da mão');
    const m = b().mesaAtual, c = m.sessao.conselho();
    for (let i = 0; i < 5; i++) if (!!m.sessao.segurar[i] !== !!(c.melhor & (1 << i))) clicar('.vp-segurar[data-i="' + i + '"]');
  }
  async function trocarOtimo() {
    await ate(() => livre('videopoquer'), 60000, 'vídeo pôquer livre');
    if (b().mesaAtual.sessao.estado !== 'descarte') return;
    await segurarOtimo();
    await b().mesaAtual.jogar();
    await ate(() => livre('videopoquer'), 60000, 'fim da troca');
  }

  const CENARIOS = {
    roleta: {
      mesa: 'roleta',
      async preparar(m) { m.apostar('vermelho', 500); m.apostar('p17', 100); m.apostar('d2', 500); },
      iniciar: m => { m.girar(); },
    },
    'blackjack-dar': {
      mesa: 'blackjack',
      async preparar(m) { await m.acao('limpar'); await m.acao('dobrarAposta'); },
      iniciar: m => { m.acao('dar'); },
      terminar: terminarBlackjack,
    },
    'blackjack-final': {
      mesa: 'blackjack',
      async preparar(m) {
        await m.acao('limpar'); await m.acao('dobrarAposta'); await m.acao('dar');
        await ate(() => livre('blackjack'), 30000, 'cartas dadas');
        if (m.sessao.estado === 'seguro') { await m.acao('seguroNao'); await ate(() => livre('blackjack'), 30000, 'seguro recusado'); }
      },
      // parar resolve a mão: a banca joga e paga, tudo dentro da sessão
      iniciar: m => { if (m.sessao.estado === 'jogando') m.acao('parar'); },
      terminar: terminarBlackjack,
    },
    'blackjack-seguro': {
      mesa: 'blackjack',
      // mãos jogadas direto na sessão, sem mesa montada, até a banca mostrar um ás
      async antes() {
        const { criarSessaoBlackjack } = await import(url('js/jogos/blackjack/sessao.js'));
        const s = criarSessaoBlackjack(b().casa);
        for (let k = 0; k < 300 && s.estado !== 'seguro'; k++) {
          if (s.estado === 'fim') s.novaRodada();
          s.definirAposta(500);
          s.dar();
          while (s.estado === 'jogando') s.agir('parar');
        }
        if (s.estado !== 'seguro') throw new Error('a banca não mostrou um ás em 300 mãos');
      },
      async preparar() {},
      iniciar() {},
      terminar: terminarBlackjack,
      depoisDeVoltar: () => ({ pergunta: !!document.querySelector('.bj-pergunta'), estado: b().mesaAtual.sessao.estado }),
    },
    niquel: {
      mesa: 'niquel',
      async preparar() {},
      iniciar: m => { m.girar(); },
    },
    // giros grátis já ganhos, jogados sozinhos pela máquina: sair no meio do bônus
    'niquel-bonus': {
      mesa: 'niquel',
      async antes() {
        const { criarSessaoNiquel } = await import(url('js/jogos/niquel/sessao.js'));
        const { APOSTAS_LINHA } = await import(url('js/jogos/niquel/regras.js'));
        const s = criarSessaoNiquel(b().casa);
        s.definirApostaLinha(APOSTAS_LINHA[0]);
        for (let k = 0; k < 20000 && !s.emGirosGratis; k++) s.girar();
        if (!s.emGirosGratis) throw new Error('nenhum bônus em 20.000 giros');
        b().casa.salvar();
      },
      // a máquina retoma os giros grátis sozinha 1,2 s depois de montar
      semEsperarLivre: true,
      async preparar() {},
      iniciar() {},
    },
    'videopoquer-dar': {
      mesa: 'videopoquer',
      async preparar() {},
      iniciar: m => { m.jogar(); },
      terminar: trocarOtimo,
    },
    'videopoquer-trocar': {
      mesa: 'videopoquer',
      async preparar(m) { await m.jogar(); await segurarOtimo(); },
      iniciar: m => { m.jogar(); },
    },
    'videopoquer-aberta': {
      mesa: 'videopoquer',
      async preparar(m) { await m.jogar(); await ate(() => livre('videopoquer'), 60000, 'análise da mão'); },
      iniciar() {},
      terminar: trocarOtimo,
      depoisDeVoltar: () => {
        const s = b().mesaAtual.sessao;
        const vistas = [...document.querySelectorAll('.vp-lugar .carta')].filter(c => !c.classList.contains('virada')).length;
        return { estado: s.estado, mao: s.mao.join(), cartasViradasParaCima: vistas, botao: document.querySelector('.vp-dar').textContent };
      },
    },
    bacara: {
      mesa: 'bacara',
      async preparar(m) { await m.apostar('banca'); },
      iniciar: m => { m.dar(); },
    },
    craps: {
      mesa: 'craps',
      async preparar() { clicar('.cr-mesa .zona[data-id="pass"]'); clicar('.cr-mesa .zona[data-id="field"]'); },
      iniciar: m => { m.lancar(); },
    },
  };

  window.__prova = {
    async comecar(nome) {
      const cen = CENARIOS[nome];
      await ate(() => b() && document.readyState === 'complete', 15000, 'a página');
      for (const j of JOGOS) b().casa.justo.compromisso(j);
      if (cen.antes) await cen.antes();
      const m = await sentar(cen.mesa, b().mesaAtual, !cen.semEsperarLivre);
      await cen.preparar(m);
      if (!cen.semEsperarLivre) await ate(() => livre(cen.mesa), 60000, 'mesa preparada');
      await esp(250);
      return foto();
    },
    // sair.ms: quando sair, contado do começo da rodada; null é o controle, que
    // espera a mesa ficar livre e só então faz a mesma visita
    async jogar(nome, sair) {
      const cen = CENARIOS[nome];
      const t0 = performance.now();
      cen.iniciar(b().mesaAtual);
      await esp(120);
      const pos = await foto();
      let duracao = null;
      if (sair.ms === null) {
        await ate(() => livre(cen.mesa), 180000, 'fim da rodada');
        duracao = Math.round(performance.now() - t0);
      } else {
        await esp(Math.max(0, sair.ms - (performance.now() - t0)));
      }
      const anterior = b().mesaAtual;
      const saida = await foto();
      location.hash = sair.para ? '#/' + sair.para : '';
      if (sair.para) await ate(() => b().mesaAtual && b().mesaAtual !== anterior, 15000, 'mesa de destino');
      await esp(3500);
      const meio = await foto();
      await sentar(cen.mesa, b().mesaAtual);
      const voltou = cen.depoisDeVoltar ? cen.depoisDeVoltar() : null;
      if (cen.terminar) await cen.terminar();
      await esp(1200);
      return { pos, saida, meio, voltou, duracao, fim: await foto(), conferir: await conferir() };
    },
  };
  return true;
})()`;

// ------------------------------------------------------------ servidor estático

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8',
};

function servir() {
  const servidor = createServer(async (req, res) => {
    const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const arquivo = normalize(join(RAIZ, caminho === '/' ? 'index.html' : caminho));
    if (!arquivo.startsWith(RAIZ + sep) && arquivo !== RAIZ) { res.writeHead(403).end(); return; }
    try {
      const dados = await readFile(arquivo);
      res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(dados);
    } catch { res.writeHead(404).end(); }
  });
  return new Promise(res => servidor.listen(0, '127.0.0.1', () => res(servidor)));
}

// ------------------------------------------------------------ Chrome pelo DevTools

function acharChrome() {
  const candidatos = [process.env.CHROME, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', join(homedir(), '.local/bin/google-chrome')].filter(Boolean);
  for (const c of candidatos) {
    if (c.includes('/')) { if (existsSync(c)) return c; continue; }
    const r = spawnSync('which', [c]);
    if (r.status === 0) return r.stdout.toString().trim();
  }
  throw new Error('Chrome não encontrado; defina CHROME=/caminho/do/chrome');
}

// Tenta com o sandbox do Chrome; se o sistema não deixa (Ubuntu 23.10+ sem
// user namespaces, por exemplo), abre sem ele. A página só visita o servidor
// local desta prova.
async function abrirChrome(semSandbox = false) {
  const perfil = await mkdtemp(join(tmpdir(), 'banca-prova-'));
  const processo = spawn(acharChrome(), [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--mute-audio',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    ...(semSandbox ? ['--no-sandbox'] : []),
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let texto = '';
  try {
    const ws = await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('o Chrome não abriu o DevTools em 20 s')), 20000);
      processo.stderr.on('data', d => {
        texto += d;
        const m = texto.match(/DevTools listening on (ws:\/\/\S+)/);
        if (m) { clearTimeout(t); res(m[1]); }
      });
      processo.on('exit', c => { clearTimeout(t); rej(new Error(`o Chrome saiu (${c}): ${texto.split('\n')[0]}`)); });
    });
    const cdp = await conectar(ws);
    return { cdp, async fechar() { processo.kill('SIGKILL'); await rm(perfil, { recursive: true, force: true }).catch(() => {}); } };
  } catch (e) {
    processo.kill('SIGKILL');
    await rm(perfil, { recursive: true, force: true }).catch(() => {});
    if (!semSandbox && /No usable sandbox/.test(texto)) {
      console.log('  (o sistema não permite o sandbox do Chrome; abrindo com --no-sandbox)');
      return abrirChrome(true);
    }
    throw e;
  }
}

async function conectar(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('falha no WebSocket do DevTools')); });
  let id = 0;
  const pendentes = new Map();
  const ouvintes = new Set();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id) {
      const p = pendentes.get(m.id);
      pendentes.delete(m.id);
      if (m.error) p.rej(new Error(`${p.metodo}: ${m.error.message}`)); else p.res(m.result);
    } else for (const f of ouvintes) f(m);
  };
  return {
    ouvintes,
    enviar(metodo, params = {}, sessionId) {
      const n = ++id;
      ws.send(JSON.stringify({ id: n, method: metodo, params, sessionId }));
      return new Promise((res, rej) => pendentes.set(n, { res, rej, metodo }));
    },
  };
}

// crypto.getRandomValues determinístico, instalado antes de qualquer script da página
const sementeCripto = n => `(() => {
  let x = ${(n >>> 0) || 1};
  const proximo = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };
  Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: a => {
    const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    for (let i = 0; i < b.length; i++) b[i] = proximo() & 255;
    return a;
  } });
})();`;

async function novaPagina(cdp, semente) {
  const { browserContextId } = await cdp.enviar('Target.createBrowserContext', { disposeOnDetach: true });
  const { targetId } = await cdp.enviar('Target.createTarget', { url: 'about:blank', browserContextId, newWindow: true });
  const { sessionId } = await cdp.enviar('Target.attachToTarget', { targetId, flatten: true });
  const erros = [];
  const ouvinte = m => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      const onde = d.url ? ` em ${d.url.replace(/^.*?\/js\//, 'js/')}:${d.lineNumber + 1}` : '';
      erros.push(`${(d.exception?.description ?? d.text).split('\n')[0]}${onde}`);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      erros.push('console.error: ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').split('\n')[0]);
    }
  };
  cdp.ouvintes.add(ouvinte);
  const env = (metodo, params) => cdp.enviar(metodo, params, sessionId);
  await env('Page.enable');
  await env('Runtime.enable');
  await env('Page.addScriptToEvaluateOnNewDocument', { source: sementeCripto(semente) });
  await env('Emulation.setDeviceMetricsOverride', CELULAR
    ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
    : { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  if (CELULAR) await env('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await env('Emulation.setFocusEmulationEnabled', { enabled: true });
  return {
    erros,
    async ir(u) { await env('Page.navigate', { url: u }); },
    async avaliar(expr) {
      const r = await env('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description ?? r.exceptionDetails.text).split('\n')[0]);
      return r.result.value;
    },
    async fechar() {
      cdp.ouvintes.delete(ouvinte);
      await cdp.enviar('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
    },
  };
}

// ------------------------------------------------------------ uma rodada

const dormir = ms => new Promise(r => setTimeout(r, ms));
const semente = nome => [...nome].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

async function rodada(cdp, base, nome, sair) {
  const p = await novaPagina(cdp, semente(nome));
  try {
    await p.ir(base + 'index.html');
    for (let i = 0; i < 200; i++) {
      if (await p.avaliar(`!!window.__banca && document.readyState === 'complete'`).catch(() => false)) break;
      await dormir(100);
    }
    await p.avaliar(PAGINA);
    const antes = await p.avaliar(`__prova.comecar(${JSON.stringify(nome)})`);
    const r = await p.avaliar(`__prova.jogar(${JSON.stringify(nome)}, ${JSON.stringify(sair)})`);
    await dormir(300);
    return { ...r, antes, erros: p.erros.slice() };
  } catch (e) {
    const estado = await p.avaliar(`JSON.stringify({ pronto: document.readyState, banca: typeof window.__banca, endereco: location.href, mesa: !!(window.__banca && window.__banca.mesaAtual) })`).catch(x => 'sem página: ' + x.message);
    return { falhou: `${e.message} [${estado}]`, erros: p.erros.slice() };
  } finally {
    await p.fechar();
  }
}

// ------------------------------------------------------------ as exigências

const mesmo = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const seg = ms => (ms / 1000).toLocaleString('pt-BR');

function diferencas(a, b) {
  const d = [];
  if (!mesmo(a.dinheiro, b.dinheiro)) d.push(`dinheiro ${JSON.stringify(a.dinheiro)} contra ${JSON.stringify(b.dinheiro)}`);
  for (const j of Object.keys(a.mesas)) if (a.mesas[j] !== b.mesas[j]) d.push(`mesa ${j}: ${a.mesas[j].slice(0, 300)} contra ${b.mesas[j].slice(0, 300)}`);
  if (a.gerador !== b.gerador) d.push(`gerador ${a.gerador} contra ${b.gerador}`);
  return d;
}

function julgar(t, sair, r, controle) {
  const nome = t.nome;
  const f = [];
  if (r.falhou) f.push(`travou: ${r.falhou}`);
  for (const e of r.erros) f.push(`erro na página: ${e}`);
  if (r.falhou) return f;
  if (r.conferir.falhas.length) f.push(...r.conferir.falhas.map(x => `não confere: ${x}`));
  // enquanto o jogador está fora, nada da rodada muda: nem dinheiro, nem a mesa
  if (!mesmo(r.meio.dinheiro, r.saida.dinheiro)) f.push(`o dinheiro mudou com o jogador fora: ${JSON.stringify(r.saida.dinheiro)} virou ${JSON.stringify(r.meio.dinheiro)}`);
  if (r.meio.mesas[t.mesa] !== r.saida.mesas[t.mesa]) f.push(`a mesa mudou com o jogador fora: ${r.saida.mesas[t.mesa].slice(0, 200)} virou ${r.meio.mesas[t.mesa].slice(0, 200)}`);
  // e, fora o bônus, que sorteia giro após giro, a animação não move dinheiro: o
  // que havia logo depois do sorteio é o que havia na hora de sair
  if (nome !== 'niquel-bonus' && !mesmo(r.saida.dinheiro, r.pos.dinheiro)) f.push(`o dinheiro mudou depois do sorteio: ${JSON.stringify(r.pos.dinheiro)} virou ${JSON.stringify(r.saida.dinheiro)}`);
  if (r.meio.mostrado !== r.meio.esperado) f.push(`fora da mesa o topo mostra ${r.meio.mostrado} e a carteira tem ${r.meio.esperado}`);
  if (r.fim.mostrado !== r.fim.esperado) f.push(`no fim o topo mostra ${r.fim.mostrado} e a carteira tem ${r.fim.esperado}`);
  if (nome === 'blackjack-seguro' && !(r.voltou.pergunta && r.voltou.estado === 'seguro')) f.push(`a pergunta do seguro sumiu: ${JSON.stringify(r.voltou)}`);
  if (nome === 'videopoquer-aberta') {
    const m0 = JSON.parse(r.antes.mesas.videopoquer);
    if (r.voltou.estado !== 'descarte' || r.voltou.mao !== m0.mao.join() || r.voltou.cartasViradasParaCima !== 5) f.push(`a mão aberta não voltou igual: ${JSON.stringify(r.voltou)} (era ${m0.mao.join()})`);
    if (!mesmo(r.meio.dinheiro, r.antes.dinheiro)) f.push('a mão aberta mexeu no dinheiro enquanto o jogador estava fora');
  }
  if (controle) {
    if (controle.falhou) f.push('sem controle para comparar');
    else {
      const d1 = diferencas(r.pos, controle.pos);
      if (d1.length) f.push('o sorteio saiu diferente do controle: ' + d1.join('; '));
      const d2 = diferencas(r.fim, controle.fim);
      if (d2.length) f.push('terminou diferente de quem esperou: ' + d2.join('; '));
    }
  }
  return f;
}

// o que ficou da rodada no instante em que o jogador saiu (para o relatório)
function comoFicou(mesa, foto) {
  const m = JSON.parse(foto.mesas[mesa]);
  if (mesa === 'craps') return m.ponto ? `ponto ${m.ponto}` : 'saída';
  if (mesa === 'niquel') {
    const n = m.girosRestantes ?? 0;
    return n ? `${n} giro${n > 1 ? 's' : ''} grátis guardado${n > 1 ? 's' : ''}` : 'liquidado';
  }
  if (mesa === 'roleta') return 'liquidado';
  return m.estado ?? '?';
}

async function principal() {
  const servidor = await servir();
  const base = `http://127.0.0.1:${servidor.address().port}/`;
  const chrome = await abrirChrome();
  const tarefas = CENARIOS.map(([nome, mesa, tempos]) => ({ nome, mesa, tempos, destino: mesa === 'roleta' ? 'craps' : 'roleta' }));
  const t0 = Date.now();
  let falhas = 0;
  const linhas = [];
  const registrar = (t, sair, r, f) => {
    if (f.length) falhas++;
    linhas.push({ t, sair, f, r });
    process.stdout.write(f.length ? 'X' : '.');
  };
  // Cada cenário: primeiro os controles (espera a mesa ficar livre e só então
  // faz a mesma visita), depois as saídas no meio. Cenários em paralelo.
  const fila = [...tarefas];
  async function trabalhador() {
    for (let t; (t = fila.shift());) {
      const controles = {};
      for (const para of [t.destino, '']) {
        const sair = { ms: null, para };
        const r = await rodada(chrome.cdp, base, t.nome, sair);
        controles[para] = r;
        registrar(t, sair, r, julgar(t, sair, r, null));
      }
      // mais três pontos no fim da encenação, pela duração medida no controle
      // (55%, 85% e 0,7 s antes do fim): é onde moram o pagamento da roleta, a
      // comemoração do caça-níquel e a revelação lenta do bacará
      const T = controles[''].duracao ?? 0;
      const extras = t.tempos.length > 1
        ? [...new Set([0.55 * T, 0.85 * T, T - 700].map(ms => Math.round(ms / 100) * 100))].filter(ms => ms > 3500)
        : [];
      for (const ms of [...t.tempos, ...extras]) {
        for (const para of [t.destino, '']) {
          const sair = { ms, para };
          const r = await rodada(chrome.cdp, base, t.nome, sair);
          registrar(t, sair, r, julgar(t, sair, r, controles[para]));
        }
      }
    }
  }
  await Promise.all(Array.from({ length: PARALELO }, trabalhador));
  process.stdout.write('\n\n');
  const ordem = new Map(tarefas.map((t, i) => [t.nome, i]));
  const quando = s => s.ms ?? -1;
  linhas.sort((a, b) => ordem.get(a.t.nome) - ordem.get(b.t.nome) || quando(a.sair) - quando(b.sair) || a.sair.para.localeCompare(b.sair.para));
  for (const { t, sair, f, r } of linhas) {
    const para = (sair.para || 'o salão').padEnd(8);
    const onde = sair.ms === null
      ? `controle: espera ${r.duracao != null ? seg(Math.round(r.duracao / 100) * 100).padEnd(4) : '?   '} s e vai para ${para}`
      : `sai em ${seg(sair.ms).padEnd(4)} s para ${para}             `;
    const ficou = sair.ms !== null && !r.falhou ? `  ao sair: ${comoFicou(t.mesa, r.meio)}` : '';
    console.log(`  ${f.length ? 'FALHOU' : 'ok    '}  ${t.nome.padEnd(19)} ${onde}${ficou}`);
    for (const x of f) console.log(`          ${x}`);
  }
  console.log(`\n${linhas.length - falhas} rodadas passaram, ${falhas} falharam, ${CELULAR ? '390x844 celular' : '1440x900'}. (${Math.round((Date.now() - t0) / 1000)} s)`);
  await chrome.fechar();
  servidor.close();
  process.exit(falhas ? 1 : 0);
}

principal().catch(e => { console.error(e); process.exit(2); });
