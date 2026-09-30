// Service worker da BANCA: guarda todos os arquivos na primeira visita e,
// sem rede, serve tudo do cache. Com rede, busca a versão nova primeiro e
// atualiza o cache (rede primeiro, cache de reserva): quem está online nunca
// joga numa versão velha, e quem está offline joga a última que viu.
//
// A lista abaixo é conferida por provas/offline.mjs contra os arquivos do
// disco: arquivo novo fora da lista faz a prova falhar.

const VERSAO = 'banca-v3';

const ARQUIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icone.svg',
  'css/banca.css',
  'css/mesas.css',
  'css/roleta.css',
  'css/blackjack.css',
  'css/videopoquer.css',
  'css/bacara.css',
  'css/craps.css',
  'css/niquel.css',
  'fontes/limelight.woff2',
  'fontes/jost.woff2',
  'js/main.js',
  'js/ui.js',
  'js/mesas.js',
  'js/som.js',
  'js/vida.js',
  'js/nucleo/sha256.js',
  'js/nucleo/justo.js',
  'js/nucleo/carteira.js',
  'js/nucleo/livro.js',
  'js/nucleo/casa.js',
  'js/nucleo/estat.js',
  'js/nucleo/formato.js',
  'js/nucleo/baralho.js',
  'js/visual/texturas.js',
  'js/visual/cartas.js',
  'js/visual/fichas.js',
  'js/visual/efeitos.js',
  'js/visual/cena-cartas.js',
  'js/salao/iso.js',
  'js/salao/cena.js',
  'js/salao/salao.js',
  'js/telas/livro.js',
  'js/telas/conferir.js',
  'js/jogos/roleta/regras.js',
  'js/jogos/roleta/fisica.js',
  'js/jogos/roleta/sessao.js',
  'js/jogos/roleta/roda.js',
  'js/jogos/roleta/pano.js',
  'js/jogos/roleta/mesa.js',
  'js/jogos/blackjack/regras.js',
  'js/jogos/blackjack/estrategia.js',
  'js/jogos/blackjack/ev.js',
  'js/jogos/blackjack/sessao.js',
  'js/jogos/blackjack/vantagem.js',
  'js/jogos/blackjack/mesa.js',
  'js/jogos/videopoquer/regras.js',
  'js/jogos/videopoquer/analise.js',
  'js/jogos/videopoquer/trabalhador.js',
  'js/jogos/videopoquer/sessao.js',
  'js/jogos/videopoquer/constantes.js',
  'js/jogos/videopoquer/mesa.js',
  'js/jogos/bacara/regras.js',
  'js/jogos/bacara/sessao.js',
  'js/jogos/bacara/mesa.js',
  'js/jogos/craps/regras.js',
  'js/jogos/craps/sessao.js',
  'js/jogos/craps/dados.js',
  'js/jogos/craps/pano.js',
  'js/jogos/craps/desenho-dados.js',
  'js/jogos/craps/mesa.js',
  'js/jogos/niquel/tiras.js',
  'js/jogos/niquel/regras.js',
  'js/jogos/niquel/sessao.js',
  'js/jogos/niquel/simbolos.js',
  'js/jogos/niquel/mesa.js',
];

self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(VERSAO)
      // cache: 'reload' pula o cache HTTP do navegador: o que entra aqui é o que está no servidor
      .then(cache => cache.addAll(ARQUIVOS.map(a => new Request(a, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n.startsWith('banca-') && n !== VERSAO).map(n => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', evento => {
  const pedido = evento.request;
  if (pedido.method !== 'GET' || new URL(pedido.url).origin !== location.origin) return;
  // cache: 'no-cache' pergunta ao servidor se mudou (um 304 custa quase nada);
  // sem isso o cache HTTP do navegador entregaria um módulo velho mesmo online
  const revalidar = pedido.mode === 'navigate' ? new Request(pedido.url, { cache: 'no-cache' }) : new Request(pedido, { cache: 'no-cache' });
  evento.respondWith(
    fetch(revalidar)
      .then(resposta => {
        if (resposta.ok && resposta.type === 'basic') {
          const copia = resposta.clone();
          caches.open(VERSAO).then(cache => cache.put(pedido, copia));
        }
        return resposta;
      })
      .catch(() => caches.match(pedido, { ignoreSearch: true })
        .then(guardada => guardada ?? (pedido.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
