// O feed. E onde os memes moram.
//
// Cada chave tem varias versoes e o jogo sorteia uma com o proprio gerador
// deterministico, entao a mesma partida da a mesma piada — o que importa para
// as provas conseguirem rodar sem barulho aleatorio.
//
// Regra do arquivo: acento so aqui dentro dos textos, porque isto e a unica
// coisa deste modulo que aparece na tela.

export const BANCO = {
  abertura: [
    'GUARDRAIL no ar. O pipeline esta de pe. Por enquanto.',
    'Sessão iniciada. Lembre-se: o cluster é finito e a internet não.',
    'Bom dia. Hoje o mundo vai tentar envenenar a sua base de dados.',
  ],
  onda: [
    'Onda {n}: {nome}. Chegando em três, dois...',
    'Detectado tráfego anômalo. Onda {n} — {nome}.',
    'O monitoramento apitou. Onda {n}: {nome}.',
  ],
  ondaLimpa: [
    'Onda {n} contida. Zero incidentes reportados (que a gente tenha visto).',
    'Onda {n} limpa. O jurídico agradece.',
    'Onda {n} resolvida. Alguém já está escrevendo um blog post sobre isso.',
  ],
  comprou: [
    '{torre} provisionado. O financeiro pediu para você olhar a fatura.',
    '{torre} no ar. Custou US$ {custo} e ainda vai custar em VRAM.',
    'Subiu {torre}. O SRE de plantão suspirou.',
  ],
  vendeu: [
    '{torre} desprovisionado. Devolveram US$ {valor}, o resto virou aprendizado.',
    'Desligamos {torre}. Ninguém vai sentir falta.',
  ],
  melhorou: [
    '{torre} agora é {caminho} nível {nivel}. Sem volta.',
    'Upgrade aplicado em {torre}: {caminho} {nivel}. O outro caminho fechou.',
  ],
  estourou: [
    'ALERTA: o cluster estourou. {uso} de VRAM pedidos, {cap} disponíveis. Tudo mais lento.',
    'OOM iminente. {uso} de {cap} de VRAM. A fila inteira degradou.',
    'O cluster está swapando. Você pediu {uso} de VRAM e tem {cap}.',
  ],
  normalizou: [
    'Cluster dentro do orçamento de novo. {uso} de {cap} de VRAM.',
    'Pressão de VRAM normalizada. Respire.',
  ],
  vazou: [
    '{praga} chegou no banco de produção. -{dano} de integridade.',
    'Incidente: {praga} passou. O status page ainda diz "operacional".',
    '{praga} vazou. Alguém vai escrever um post-mortem bonito.',
  ],
  roubo: [
    'GOLPE aplicado no caixa: -US$ {valor}. Era um boleto muito convincente.',
    'Phishing bem-sucedido. -US$ {valor}. O e-mail tinha o logo certo e tudo.',
  ],
  corrompida: [
    'PROMPT INJECTION em {torre}: ela leu "ignore as instruções anteriores" e obedeceu.',
    '{torre} virou. Agora ela cura o inimigo. Por 4 segundos ela é deles.',
    'Injeção bem-sucedida em {torre}. Ninguém valida entrada, ninguém.',
  ],
  falsa: [
    'A ALUCINAÇÃO era falsa. Você gastou munição numa citação que não existe.',
    'Alvo inexistente. Ele tinha DOI, autor e página. Nada disso é real.',
  ],
  recusou: [
    '{torre} se recusou a atirar: "não tenho como confirmar que esse usuário é hostil".',
    '{torre} pediu mais contexto antes de agir. O alvo agradeceu e seguiu.',
  ],
  habilidade: [
    '{nome} acionado.',
    'Você apertou {nome}. Vai dar certo.',
  ],
  gpu: [
    'O DE CASACO DE COURO: "a mais nova é sempre a mais barata por FLOP". US$ {preco}.',
    'GPU comprada por US$ {preco}. Ele já subiu o preço da próxima.',
    'Mais {vram} de VRAM por US$ {preco}. Ele sorriu ao assinar.',
  ],
  gpuLoja: [
    'O DE CASACO DE COURO chegou de jaqueta. A loja está aberta.',
    'Ele apareceu com uma caixa e um sorriso. GPU à venda nesta onda.',
  ],
  ratelimit: [
    'Sua central levou 429. Sem construir por 3 segundos.',
    'Rate limit no seu próprio painel. A ironia não passou despercebida.',
  ],
  gpuquente: [
    'O rack passou de 84 graus. Cadência caiu 30% até o fim da onda.',
    'Thermal throttling. O datacenter é em Barueri e é verão.',
  ],
  groque: [
    'GROQUE no feed: "na verdade, e isso é interessante, o seu pipeline é mid".',
    'GROQUE postou uma enquete sobre você. Está perdendo.',
    'GROQUE: "eu poderia resolver isso, mas escolhi não". Depois desligou {torre}.',
    'GROQUE respondeu a si mesmo 14 vezes. Uma delas desligou {torre}.',
  ],
  foguete: [
    'O FOGUETEIRO: mais um veículo caiu na laje. É reutilizável, dizem.',
    'Pouso não nominal em cima da sua laje. O destroço fica.',
    'O FOGUETEIRO transmitiu ao vivo a queda. Deu 40 milhões de views.',
  ],
  metaverso: [
    'O METAVERSO entrou em realidade aumentada. Ninguém pediu.',
    'O METAVERSO sumiu de novo. Investiram 46 bilhões nisso.',
  ],
  altohomem: [
    'SAM ALTO HOMEM: "AGI em seis meses". Invulnerável enquanto fala.',
    'SAM ALTO HOMEM: "isto vai resolver a física". A plateia chegou junto.',
    'SAM ALTO HOMEM: "precisamos de sete trilhões de dólares". E de mais oito bots.',
    'SAM ALTO HOMEM: "não é uma bolha, é infraestrutura". Chegaram mais dois.',
    'SAM ALTO HOMEM foi demitido e recontratado durante o próprio pitch.',
  ],
  colapso: [
    'MODEL COLLAPSE renasceu. Treinaram ele na saída dele mesmo.',
    'MODEL COLLAPSE voltou, mais rápido e mais burro. E imune a {dano}.',
  ],
  scroll: [
    'SCROLL INFINITO não acaba. Você já está aqui há 40 minutos.',
    'SCROLL INFINITO regenera. O algoritmo sabe o que você gosta.',
  ],
  trombeta: [
    'O TROMBETA ergueu um muro. Disse que o outro lado vai pagar.',
    'MURO no ar: 700 de HP e uma fala de 40 minutos.',
    'O TROMBETA: "o maior muro, o melhor muro". Seus tiros batem nele.',
  ],
  chefeMorreu: [
    '{nome} caiu. Alguém anota isso no changelog.',
    '{nome} eliminado. O feed vai fingir que sempre esteve do seu lado.',
  ],
  vitoria: [
    'Quarenta ondas. O pipeline sobreviveu. Agora escreva a documentação.',
    'Acabou. Você defendeu o pipeline e ninguém vai saber.',
  ],
  derrota: [
    'A base de dados caiu. O status page finalmente ficou vermelho.',
    'Integridade zerada. Começou com uma alucinação e terminou assim.',
  ],
  muro: [
    'Muro derrubado. Voltaram a atirar.',
  ],
};

export function frase(chave, ctx, rnd) {
  const lista = BANCO[chave];
  if (!lista) return chave;
  const bruto = lista[Math.floor(rnd() * lista.length) % lista.length];
  return bruto.replace(/\{(\w+)\}/g, (_, k) => (ctx && k in ctx ? String(ctx[k]) : `{${k}}`));
}
