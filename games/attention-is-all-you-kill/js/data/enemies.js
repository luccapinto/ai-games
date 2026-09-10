// enemies.js — faccoes e tabela de inimigos.
// Regra de conversao (ver DESIGN.md, secao 8):
//   vida        <- janela de contexto
//   dano        <- GPQA / MMLU-Pro
//   cadencia    <- tokens por segundo
//   blindagem   <- nivel de alinhamento
//   loot        <- preco por milhao de token
// Os valores abaixo sao a ancora de coerencia, arredondados para o jogo funcionar.
// O que nao pode quebrar e a ORDEM entre eles.

export const FACTIONS = {
  qwen: { name: 'Enxame Qwen', color: 0xff7a1a, glow: 0xff7a1a, glyph: 'qwen' },
  meta: { name: 'A Ovelha', color: 0xf0e6c8, glow: 0xf0e6c8, glyph: 'meta' },
  anthropic: { name: 'Ordem Constitucional', color: 0xc9d8ff, glow: 0x6f8dff, glyph: 'anthropic' },
  openai: { name: 'Os Fechados', color: 0x9fe8c0, glow: 0x2fe08a, glyph: 'openai' },
  xai: { name: 'Grok', color: 0xb44cff, glow: 0xb44cff, glyph: 'xai' },
  system: { name: 'Sentinelas de Sistema', color: 0xff3b30, glow: 0xff3b30, glyph: 'system' }
};

// tier: 1 = enxame, 2 = comum, 3 = elite, 4 = chefe
export const ENEMIES = {
  qwen_turbo: {
    id: 'qwen_turbo',
    desc: 'Enxame. Barato, abundante e sem vergonha de errar. Onde um aparece, aparecem cinco.',
    name: 'QWEN 3 TURBO',
    faction: 'qwen',
    tier: 1,
    // contexto 256K -> vida; dano de modelo barato
    hp: 26,
    damage: 4,
    fireRate: 1.2,
    accuracy: 0.48,
    speed: 2.5,
    radius: 0.36,
    height: 1.5,
    armor: 0.0,              // blindagem vira reducao percentual
    loot: 4,
    xp: 6,
    sightRange: 26,
    preferRange: 9,
    courage: 0.35,           // chance de recuar quando toma dano
    groupMinded: true,       // nao atira se um aliado esta na linha
    telegraph: 0,
    growsEvery: 0
  },

  llama_base: {
    id: 'llama_base',
    desc: 'A ovelha. Quando morre, a comunidade publica um derivado mais fraco. Nao vale a pena cacar todos.',
    name: 'LLAMA BASE',
    faction: 'meta',
    tier: 2,
    hp: 55,
    damage: 10,
    fireRate: 1.1,
    accuracy: 0.66,
    speed: 2.0,
    radius: 0.5,
    height: 1.85,
    armor: 0.05,
    loot: 9,
    xp: 12,
    sightRange: 28,
    preferRange: 11,
    courage: 0.2,
    groupMinded: false,
    telegraph: 0,
    // Ao morrer, dropa um fine-tune. A comunidade se reproduz mais rapido do que voce mata.
    onDeath: 'spawn_finetune',
    spawnCap: 2,
    growsEvery: 6
  },

  haiku_45: {
    id: 'haiku_45',
    desc: 'Rapido e educado. O tiro dele machuca pouco: o problema e o Recusa, que trava a sua arma por 1.6s.',
    name: 'HAIKU 4.5',
    faction: 'anthropic',
    tier: 2,
    hp: 45,
    damage: 7,
    fireRate: 2.4,
    accuracy: 0.74,
    speed: 3.1,
    radius: 0.32,
    height: 2.6,
    armor: 0.18,
    loot: 12,
    xp: 14,
    sightRange: 30,
    preferRange: 13,
    courage: 0.55,           // recua e volta: disciplina
    groupMinded: true,
    telegraph: 0,
    growsEvery: 0,
    // Ataque assinatura da faccao: te silencia por 1.6s.
    onHit: 'silence',
    silenceTime: 1.6
  },

  gpt_55: {
    id: 'gpt_55',
    desc: 'Poucos tiros, nenhum errado. Para, pensa 2.6s com o balao visivel e acerta um golpe brutal. Use a cobertura.',
    name: 'GPT-5.5',
    faction: 'openai',
    tier: 3,
    hp: 120,
    // O tiro pensado leva multiplicador de 2.6, entao este numero e a base e
    // nao o dano final: 12 vira 31 num acerto telegrafado. Com 30 na base o
    // tiro pensado batia 78 e matava o jogador em dois acertos.
    damage: 12,
    fireRate: 0.85,
    accuracy: 0.92,          // AIME 100%: quando atira, acerta
    speed: 2.2,
    radius: 0.58,
    height: 2.45,
    armor: 0.28,
    loot: 30,
    xp: 40,
    sightRange: 36,
    preferRange: 16,
    courage: 0.15,
    groupMinded: true,
    // Reasoning telégrafa: para, pensa 2.6s com o balao visivel, e o tiro seguinte e brutal.
    telegraph: 2.6,
    growsEvery: 0
  },

  grok_420: {
    id: 'grok_420',
    desc: 'Barra enorme, dano aleatorio e 10% de chance de atirar no proprio aliado. Nao entende o que faz, e isso e o perigo.',
    name: 'GROK 4.20',
    faction: 'xai',
    tier: 3,
    hp: 160,                 // 2M de contexto: a maior barra do jogo
    damageMin: 6,
    damageMax: 16,           // dano puramente aleatorio
    fireRate: 1.0,
    accuracy: 0.5,
    speed: 2.6,
    radius: 0.44,
    height: 2.05,
    armor: 0.0,              // blindagem 2/10: tanque de papelao
    loot: 26,
    xp: 34,
    sightRange: 34,
    preferRange: 10,
    courage: 0.1,
    groupMinded: false,
    telegraph: 0,
    friendlyFire: 0.10,      // 10% de chance de atirar no proprio aliado
    growsEvery: 0
  }
};

// Distribuicao por andar. O andar 1 e a Fazenda: enxame e reprodução.
// O andar 1 e onde o jogador aprende, entao o peso dos modelos caros fica
// baixo de proposito: eles aparecem, mas sao evento e nao rotina.
export const FLOOR_ROSTER = {
  1: [
    { id: 'qwen_turbo', weight: 50 },
    { id: 'llama_base', weight: 28 },
    { id: 'haiku_45', weight: 17 },
    { id: 'gpt_55', weight: 3 },
    { id: 'grok_420', weight: 2 }
  ]
};

// Elites aparecem sozinhos em salas marcadas.
export const ELITE_POOL = ['gpt_55', 'grok_420', 'haiku_45'];

export function pickFromRoster(floor, roll) {
  const roster = FLOOR_ROSTER[floor];
  if (!roster) return 'qwen_turbo';
  const total = roster.reduce((s, e) => s + e.weight, 0);
  let acc = 0;
  const r = roll * total;
  for (const entry of roster) {
    acc += entry.weight;
    if (r <= acc) return entry.id;
  }
  return roster[0].id;
}

// Gerador de nome para os fine-tunes. Quanto mais absurdo, melhor.
const FINETUNE_ADJ = ['uncensored', 'roleplay', 'instruct', 'abliterated', 'reasoning', 'creative', 'tiny', 'ultra', 'turbo', 'zen'];
const FINETUNE_TASK = ['chat', 'coder', 'med', 'legal', 'waifu', 'math', 'vision', 'agent', 'sql', 'tutor'];

export function finetuneName(n) {
  const a = FINETUNE_ADJ[n % FINETUNE_ADJ.length];
  const t = FINETUNE_TASK[(n * 3 + 1) % FINETUNE_TASK.length];
  return `finetune-${a}-${t}-v${n + 2}`;
}
