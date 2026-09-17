// Audio do Subsolo: tudo sintetizado em WebAudio, a pasta nao tem um unico
// arquivo de som. O modulo nunca encosta no DOM (so em AudioContext) porque as
// provas importam o jogo no Node, onde `document` nao existe — uma referencia
// solta aqui quebraria o arquivo vizinho. Nada roda no topo: o contexto so
// nasce na primeira interacao do jogador.

const VOLUME_MESTRE = 0.55;

// Grafo fixo: mestre e o volume final (alternarSom zera), seco e o caminho
// direto, eco e um convolver compartilhado (a galeria toda reverbera igual) e
// ruido e o unico buffer branco do jogo.
let ctx = null, mestre = null, seco = null, eco = null, ruido = null;
let ambiente = null;  // nos continuos do zumbido/coro/eletrico
let relogios = [];    // timers de gotejamento e batimento, limpos em pararAmbiente()
let ligado = true;
// Distancia vinda de tocar(nome, { volume }): o efeito e montado de forma
// sincrona, entao variavel de modulo evita arrastar o parametro por estouro/tom.
let escala = 1;

const canais = new Map();  // cadeia persistente por arma
const mix = { rodada: 1, zumbisPerto: 0, vida: 100, baixado: false, forcaLigada: false };

// Atalhos de construcao: o grafo inteiro se resume a esses tres nos.
function osc(tipo, frequencia) { const o = ctx.createOscillator(); o.type = tipo; o.frequency.value = frequencia; return o; }
function banda(tipo, frequencia, q = 1) { const f = ctx.createBiquadFilter(); f.type = tipo; f.frequency.value = frequencia; f.Q.value = q; return f; }
function ganho(valor) { const g = ctx.createGain(); g.gain.value = valor; return g; }

// Resposta ao impulso gerada na hora: ruido com cauda exponencial. E a rocha —
// som seco na cara do jogador e uma cauda longa voltando do fundo do tunel.
function impulso(duracao, decaimento) {
  const buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * duracao), ctx.sampleRate);
  for (let canal = 0; canal < 2; canal++) {
    const dados = buffer.getChannelData(canal), n = dados.length;
    for (let i = 0; i < n; i++) dados[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decaimento);
  }
  return buffer;
}

function contexto() {
  if (!ctx) {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) return null;
    ctx = new Audio();
    mestre = ganho(ligado ? VOLUME_MESTRE : 0); mestre.connect(ctx.destination);
    seco = ganho(1); seco.connect(mestre);
    eco = ctx.createConvolver(); eco.buffer = impulso(1.9, 2.4); eco.connect(mestre);
    // Dois segundos de ruido dao offset aleatorio de sobra: cada tiro entra num
    // ponto diferente do buffer, e por isso nenhum par de tiros sai identico.
    ruido = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
    const dados = ruido.getChannelData(0);
    for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Todo envelope tem ataque e queda: ganho pulando de 0 para 1 estala o alto-falante.
function bater(g, volume, ataque, queda, t) {
  const p = g.gain;
  p.cancelScheduledValues(t);
  p.setValueAtTime(Math.max(p.value, 0.0001), t);
  p.linearRampToValueAtTime(Math.max(0.0002, volume * escala), t + ataque);
  p.exponentialRampToValueAtTime(0.0001, t + ataque + queda);
}

function saida(g, envio) { g.connect(seco); if (envio > 0) g.connect(ganho(envio)).connect(eco); }

// Estouro de ruido filtrado: a base de tiro, impacto, tabua e gotejamento.
function estouro({ duracao = 0.2, volume = 0.4, corte = 1600, tipo = 'bandpass', q = 1, eco: envio = 0, atraso = 0 }) {
  const c = contexto();
  if (!c || !ligado) return;
  const t = c.currentTime + atraso;
  const fonte = c.createBufferSource(); fonte.buffer = ruido;
  const g = ganho(0.0001);
  fonte.connect(banda(tipo, corte, q)).connect(g);
  saida(g, envio); bater(g, volume, 0.004, duracao, t);
  fonte.start(t, Math.random() * 1.5, duracao + 0.1);
}

function tom({ de, para = de, duracao = 0.2, volume = 0.25, onda = 'triangle', atraso = 0, eco: envio = 0 }) {
  const c = contexto();
  if (!c || !ligado) return;
  const t = c.currentTime + atraso;
  const o = osc(onda, de); o.frequency.setValueAtTime(de, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(18, para), t + duracao);
  const g = ganho(0.0001); o.connect(g);
  saida(g, envio); bater(g, volume, 0.006, duracao, t);
  o.start(t); o.stop(t + duracao + 0.1);
}

// As quatro armas se distinguem pela fisica do estouro, nao por sorteio:
// pistola = banda media curta com corpo (sub caindo de 195 para 62);
// SMG = banda mais aguda e metade da duracao, corpo quase inexistente;
// espingarda = passa-baixa larga e grave, sub longo = cauda de polvora;
// rifle = estalo de 45 ms quase todo em alta frequencia e o maior envio ao
// convolver, de onde vem a cauda longa batendo na parede da galeria.
const ARMAS = {
  'tiro-pistola':    { duracao: 0.13, corte: 1150, tipo: 'bandpass', q: 0.7, volume: 0.5, sub: 195, subPara: 62, subVol: 0.3, envio: 0.14 },
  'tiro-smg':        { duracao: 0.06, corte: 2700, tipo: 'bandpass', q: 1.3, volume: 0.34, sub: 260, subPara: 130, subVol: 0.12, envio: 0.07 },
  'tiro-espingarda': { duracao: 0.4, corte: 760, tipo: 'lowpass', q: 0.5, volume: 0.66, sub: 108, subPara: 34, subVol: 0.42, envio: 0.3 },
  'tiro-rifle':      { duracao: 0.045, corte: 4200, tipo: 'highpass', q: 0.9, volume: 0.6, sub: 320, subPara: 88, subVol: 0.2, envio: 0.6 },
};

// A SMG dispara dez vezes por segundo: criar oscilador por tiro lotaria o
// contexto. Entao filtro, sub (o corpo do tiro) e envio nascem uma vez por arma
// e ficam vivos — o tiro so joga um BufferSource dentro e redispara envelopes.
function canalArma(nome) {
  const pronto = canais.get(nome);
  if (pronto) return pronto;
  const arma = ARMAS[nome];
  const filtro = banda(arma.tipo, arma.corte, arma.q);
  const g = ganho(0.0001);
  filtro.connect(g); saida(g, arma.envio);
  const sub = osc('triangle', arma.sub);
  const ganhoSub = ganho(0.0001);
  sub.connect(ganhoSub).connect(seco); sub.start();
  const canal = { arma, filtro, ganho: g, sub, ganhoSub };
  canais.set(nome, canal); return canal;
}

function disparar(nome) {
  const c = contexto();
  if (!c || !ligado) return;
  const { arma, filtro, ganho: g, sub, ganhoSub } = canalArma(nome);
  const t = c.currentTime;
  const fonte = c.createBufferSource(); fonte.buffer = ruido;
  fonte.connect(filtro); fonte.start(t, Math.random() * 1.5, arma.duracao + 0.1);
  bater(g, arma.volume, 0.002, arma.duracao, t);
  sub.frequency.cancelScheduledValues(t); sub.frequency.setValueAtTime(arma.sub, t);
  sub.frequency.exponentialRampToValueAtTime(arma.subPara, t + arma.duracao);
  bater(ganhoSub, arma.subVol, 0.003, arma.duracao * 1.4, t);
}

const EFEITOS = {
  vazio: () => { estouro({ duracao: 0.03, volume: 0.22, corte: 3800, tipo: 'highpass' }); tom({ de: 300, para: 210, duracao: 0.05, volume: 0.08, onda: 'square' }); },
  // Recarga sao tres cliques em alturas crescentes: pente fora, pente dentro, ferrolho.
  recarga: () => [0, 0.13, 0.3].forEach((a, i) => estouro({ duracao: 0.05, volume: 0.2 + i * 0.05, corte: 1400 + i * 900, q: 2.2, atraso: a })),
  'impacto-carne': () => { estouro({ duracao: 0.1, volume: 0.34, corte: 480, tipo: 'lowpass' }); tom({ de: 120, para: 52, duracao: 0.12, volume: 0.16 }); },
  'impacto-pedra': () => estouro({ duracao: 0.05, volume: 0.28, corte: 3200, q: 3, eco: 0.35 }),
  grunhido: () => { tom({ de: 96, para: 62, duracao: 0.42, volume: 0.22, onda: 'sawtooth', eco: 0.2 }); estouro({ duracao: 0.34, volume: 0.14, corte: 700, q: 0.8 }); },
  grito: () => { tom({ de: 210, para: 480, duracao: 0.55, volume: 0.26, onda: 'sawtooth', eco: 0.4 }); estouro({ duracao: 0.5, volume: 0.16, corte: 1500, q: 1.4 }); },
  // Madeira quebrando = estalo agudo de Q alto, depois o tombo grave da tabua no chao.
  'tabua-arrancada': () => { estouro({ duracao: 0.16, volume: 0.42, corte: 2200, q: 4 }); tom({ de: 620, para: 140, duracao: 0.22, volume: 0.14, onda: 'square', eco: 0.25 }); estouro({ duracao: 0.2, volume: 0.2, corte: 520, tipo: 'lowpass', atraso: 0.1 }); },
  'tabua-reposta': () => { estouro({ duracao: 0.08, volume: 0.3, corte: 900, tipo: 'lowpass' }); estouro({ duracao: 0.12, volume: 0.26, corte: 700, tipo: 'lowpass', atraso: 0.14 }); },
  compra: () => { tom({ de: 660, duracao: 0.09, volume: 0.18 }); tom({ de: 990, duracao: 0.16, volume: 0.16, atraso: 0.1 }); },
  negado: () => tom({ de: 150, para: 92, duracao: 0.26, volume: 0.2, onda: 'square' }),
  perk: () => [330, 415, 554, 660].forEach((f, i) => tom({ de: f, duracao: 0.3, volume: 0.13, onda: 'sine', atraso: i * 0.08, eco: 0.3 })),
  // Caixa: Q altissimo em quatro frequencias soltas = metal batendo, sem afinacao.
  caixa: () => [1480, 1970, 2630, 1240].forEach((f, i) => estouro({ duracao: 0.18, volume: 0.13, corte: f, q: 14, atraso: i * 0.11, eco: 0.4 })),
  // O som mais importante da partida: acorde grave subindo uma quinta com sino
  // por cima. O jogador precisa ouvir "a rodada virou" de costas e sem HUD.
  rodada: () => {
    [55, 82.5, 110].forEach((f, i) => tom({ de: f, para: f * 1.5, duracao: 2.4, volume: 0.2 - i * 0.03, onda: 'sawtooth', atraso: i * 0.05, eco: 0.5 }));
    [220, 330, 440].forEach((f, i) => tom({ de: f, para: f * 1.5, duracao: 2.2, volume: 0.09, onda: 'sine', atraso: 0.25 + i * 0.12, eco: 0.6 }));
    estouro({ duracao: 1.6, volume: 0.1, corte: 300, tipo: 'lowpass', atraso: 0.1, eco: 0.4 });
  },
  // Disjuntor: estalo largo de contato e, em seguida, o zumbido eletrico que
  // fica no ambiente — energia ligada e informacao permanente, nao um efeito.
  forca: () => {
    estouro({ duracao: 0.07, volume: 0.6, corte: 2600, tipo: 'highpass', eco: 0.5 });
    estouro({ duracao: 0.3, volume: 0.2, corte: 400, tipo: 'lowpass', atraso: 0.05 });
    atualizarAmbiente({ forcaLigada: true });
  },
  baixado: () => { tom({ de: 180, para: 44, duracao: 1.1, volume: 0.3, onda: 'sawtooth', eco: 0.4 }); estouro({ duracao: 0.9, volume: 0.2, corte: 360, tipo: 'lowpass' }); },
  revive: () => { tom({ de: 110, para: 440, duracao: 0.7, volume: 0.2, eco: 0.3 }); [440, 550, 660].forEach((f, i) => tom({ de: f, duracao: 0.4, volume: 0.1, onda: 'sine', atraso: 0.5 + i * 0.07 })); },
  fim: () => [110, 87, 65].forEach((f, i) => tom({ de: f, para: f * 0.5, duracao: 3, volume: 0.2 - i * 0.04, onda: 'sawtooth', atraso: i * 0.12, eco: 0.6 })),
};

export function tocar(nome, opcoes = {}) {
  if (!contexto() || !ligado) return;
  const volume = typeof opcoes.volume === 'number' ? opcoes.volume : 1;
  if (volume <= 0) return;
  escala = Math.min(1.4, volume);
  try {  // nome desconhecido falha em silencio: audio nunca derruba o laco do jogo
    if (ARMAS[nome]) disparar(nome);
    else if (EFEITOS[nome]) EFEITOS[nome]();
  } finally { escala = 1; }
}

// Ambiente continuo. Tudo passa por um passa-baixa comum para que "baixado"
// consiga afundar a mina inteira de uma vez, como se o ouvido fosse ao chao.
export function ligarAmbiente() {
  const c = contexto();
  if (!c || ambiente) return;
  const filtro = banda('lowpass', 2200); filtro.connect(mestre);
  // Zumbido: duas fundamentais desafinadas e um LFO lento no ganho. A batida da
  // desafinacao e o que impede o fundo de virar um bipe de eletrodomestico.
  const base = ganho(0.0001); base.connect(filtro);
  const graves = [osc('sawtooth', 52), osc('sine', 38.6), osc('sine', 0.09)];
  graves[0].connect(base); graves[1].connect(base);
  graves[2].connect(ganho(0.02)).connect(base.gain);
  // Coro de grunhidos: ruido em banda de formante com LFO passeando pela
  // frequencia. Sobe com zumbisPerto e vira radar, sem gastar espaco de HUD.
  const coro = c.createBufferSource(); coro.buffer = ruido; coro.loop = true;
  const coroFiltro = banda('bandpass', 240, 7);
  const ganhoCoro = ganho(0.0001), coroLfo = osc('sine', 0.7);
  coroLfo.connect(ganho(70)).connect(coroFiltro.frequency);
  coro.connect(coroFiltro).connect(ganhoCoro).connect(filtro);
  // Zumbido eletrico de 60 Hz com harmonico de 180: so existe depois da forca.
  const rede = [osc('sawtooth', 60), osc('square', 180)];
  const eletricoFiltro = banda('bandpass', 900, 2), ganhoEletrico = ganho(0.0001);
  rede.forEach((o) => o.connect(eletricoFiltro));
  eletricoFiltro.connect(ganhoEletrico).connect(filtro);
  const fontes = [...graves, coroLfo, ...rede, coro];
  fontes.forEach((no) => no.start());
  ambiente = { filtro, base, ganhoCoro, ganhoEletrico, fontes };
  gotejar(); bombear(); atualizarAmbiente(mix);
}

// Gotejamento espacado: e o que faz o silencio da mina ficar audivel. Intervalo
// sorteado de proposito — gota com metronomo soa como maquina, nao como agua.
function gotejar() {
  if (!ambiente) return;
  if (ligado) estouro({ duracao: 0.06, volume: 0.07, corte: 2400 + Math.random() * 2600, q: 9, eco: 0.5 });
  relogios.push(setTimeout(gotejar, 2600 + Math.random() * 6500));
}

// Batimento cardiaco com vida baixa: dois golpes graves que aceleram conforme a
// vida cai. E o unico jeito de sentir que esta perto de cair sem olhar a barra —
// num jogo de rodadas o olho fica no zumbi, nunca no HUD.
function bombear() {
  if (!ambiente) return;
  const fraco = mix.baixado || mix.vida <= 35;
  if (fraco && ligado) {
    const forca = mix.baixado ? 0.34 : 0.3 - mix.vida * 0.004;
    tom({ de: 62, para: 34, duracao: 0.17, volume: forca, onda: 'sine' });
    tom({ de: 54, para: 30, duracao: 0.22, volume: forca * 0.7, onda: 'sine', atraso: 0.2 });
  }
  relogios.push(setTimeout(bombear, fraco ? (mix.baixado ? 700 : 560 + Math.max(0, mix.vida) * 9) : 500));
}

export function atualizarAmbiente(estado = {}) {
  Object.assign(mix, estado);
  if (!ctx || !ambiente) return;
  const t = ctx.currentTime;
  // Rodada alta deixa o fundo mais pesado: a mina reage ao avanco da partida.
  ambiente.base.gain.setTargetAtTime(0.05 + Math.min(mix.rodada, 25) * 0.003, t, 2);
  ambiente.ganhoCoro.gain.setTargetAtTime(0.0001 + Math.min(0.2, Math.max(0, mix.zumbisPerto) * 0.028), t, 0.6);
  ambiente.ganhoEletrico.gain.setTargetAtTime(mix.forcaLigada ? 0.035 : 0.0001, t, 1.5);
  // Baixado: o filtro fecha e o mundo abafa. Constante longa para nao soar corte.
  ambiente.filtro.frequency.setTargetAtTime(mix.baixado ? 260 : 2200, t, 0.5);
}

export function pararAmbiente() {
  relogios.forEach(clearTimeout); relogios = [];
  if (!ambiente) return;
  const t = ctx.currentTime;
  [ambiente.base, ambiente.ganhoCoro, ambiente.ganhoEletrico].forEach((g) => g.gain.setTargetAtTime(0.0001, t, 0.3));
  // Para depois do fade: cortar a fonte junto com o ganho daria estalo.
  ambiente.fontes.forEach((no) => { try { no.stop(t + 1.2); } catch (e) { /* fonte ja encerrada */ } });
  ambiente = null;
}

export function alternarSom() {
  ligado = !ligado;
  if (mestre) mestre.gain.setTargetAtTime(ligado ? VOLUME_MESTRE : 0, ctx.currentTime, 0.05);
  return ligado;
}

export function somLigado() { return ligado; }
