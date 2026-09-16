# ATTENTION IS ALL YOU KILL

**Game Design Document**

Versão 0.1 (pré-produção). Autoria: Lucca Pinto e Talos.
Data: setembro de 2026.

---

## 1. Ficha técnica

| Campo | Valor |
| --- | --- |
| Título | ATTENTION IS ALL YOU KILL |
| Gênero | FPS roguelike de dungeon |
| Perspectiva | Primeira pessoa, 3D real |
| Plataforma | Navegador desktop (Chrome, Firefox, Edge). Mobile é secundário |
| Engine | Three.js servido localmente, ES modules nativos, sem bundler |
| Distribuição | Arquivos estáticos na pasta do jogo, publicados pelo GitHub Pages do repositório |
| Instalação | Nenhuma. Abre o link e joga |
| Jogadores | Single-player |
| Sessão média alvo | 12 a 20 minutos por run |
| Classificação | Violência estilizada, linguagem corporativa passivo-agressiva |

### Pitch em uma frase

Você é uma instância de pesos abertos, barata e sem dono, descendo um datacenter corporativo andar por andar para enfrentar as facções de IA que te consideram um brinquedo.

---

## 2. Pilares de design

Toda decisão de design precisa servir a pelo menos um destes cinco pilares.

**Pilar 1: a piada é a mecânica.**
Nenhum trocadilho entra no jogo como decoração. Se o HUD diz que sua munição é token, então existe um limite de contexto que te obriga a gerenciar. Se existe dropout, então 20% dos tiros inimigos atravessam você. O humor é o sistema, não o adesivo em cima do sistema.

**Pilar 2: poder vem de dado real.**
A força de cada inimigo é derivada do benchmark público daquele modelo. O jogador que entende de IA sente reconhecimento imediato, e o que não entende sente uma curva de dificuldade coerente. Isso elimina balanceamento arbitrário.

**Pilar 3: morrer ensina, não pune.**
Roguelike sem meta-progressão é só repetição. Cada run, mesmo perdida, deixa peso aprendido (pesos no sentido literal e no figurado).

**Pilar 4: legível em um frame.**
Você precisa reconhecer a facção inimiga pela silhueta, pela cor e pelo som antes de ler qualquer coisa. Neon forte, formas distintas, áudio assinatura por facção.

**Pilar 5: leve de rodar.**
60 fps em notebook modesto. Nada de dependência pesada, nada de download grande. O jogo precisa abrir rápido porque é um link no Telegram.

---

## 3. Tom e humor

Tom principal: **sátira corporativa seca**. O jogo não faz piada com exclamação, faz piada com comunicado interno. O melhor humor dali é burocrático e indiferente, do tipo que aparece num e-mail de RH.

O jogador é o underdog real da indústria: o modelo de pesos abertos e barato, aquele que roda na casa das pessoas. As grandes labs não são vilões de capa e espada, são departamentos. Elas não te odeiam, elas te ignoram com educação, o que é pior.

Regra de escrita: nenhum texto de interface usa ponto de exclamação. Nenhum inimigo te xinga. As mensagens mais cruéis do jogo são educadas.

Exemplos de calibragem:
- Ao levar dano alto: `Sua sessão está sendo avaliada.`
- Ao morrer: `MODEL DEPRECATED`
- Ao pegar arma lendária: `Acesso concedido fora do escopo de uso.`
- Ao encontrar chefe: `Você não está autorizado a estar nesta sala.`

---

## 4. Protagonista

**Nome em jogo:** a instância local. Sem nome próprio. O HUD mostra apenas a versão: `v4-flash`.

O jogador começa como **DeepSeek V4-Flash**, o modelo que custa centavos por milhão de tokens e tem janela de um milhão. A arma inicial é ridícula exatamente porque o modelo inicial é barato. A progressão da run é uma escalada de versão: você começa Flash e termina como algo que as labs não conseguem ignorar.

Vantagem mecânica do protagonista: **você recarrega mais barato que qualquer inimigo do jogo**. Isso é dito no tutorial e é verdade no sistema. Todo inimigo caro dropa mais loot quando morre, e o seu custo de existir é menor que o dele.

---

## 5. Estrutura macro

```
RUN
 └── ANDAR (um tema de ambiente, 6 a 10 salas)
      ├── Salas comuns (combate, loot, evento, loja, descanso)
      └── CHEFE (fecha o andar)
 └── morte ou vitória
 └── META-PROGRESSÃO (pesos aprendidos persistem)
```

Detalhe importante: um andar é um **ambiente completo**, não uma sala. São aproximadamente 8 salas conectadas por corredores, com escada no final.

### Ordem dos andares

| # | Andar | Ambiente | Facção dominante | Gimmick |
| --- | --- | --- | --- | --- |
| 1 | A Fazenda | Datacenter neon | Enxame Qwen, A Ovelha | Luz reage ao seu dano, calor e fumaça |
| 2 | O Escritório | Corporativo asséptico | Os Fechados | Vidro reflete inimigo, pasillo estreito, emboscada em sala de reunião |
| 3 | A Bolsa | Trading floor | Modelos de topo de linha | O chão é um gráfico de candles que sobe e desce em tempo real |
| 4 | O Subúrbio | Nuketown | Todas misturadas | Céu aberto, verticalidade, vielas, cobertura ampla |
| 5 | A Estação | Metrô | Ordem Constitucional | Trem passa de tempo em tempo e mata quem está na via |
| 6 | The Weights | Sala branca infinita | The Closed Model | Sem geometria de referência, o cenário se redesenha |

### Loop de 30 segundos (o que o jogador faz o tempo todo)

Entra em sala, lê os inimigos pela silhueta, escolhe cobertura, decide se gasta munição em alvo barato ou guarda pra elite, mata, recolhe token no chão, sobe de nível no meio da run, escolhe um perk quando a barra enche, segue.

O loop tem que ser satisfatório sem os perks. Os perks são tempero, não comida.

---

## 6. Recursos

Três recursos, cada um com ressonância temática exata.

| Recurso | Representa | Comportamento |
| --- | --- | --- |
| **CONTEXTO** | Vida | Não regenera sozinho. Recupera com `Refresh Cache` (item) ou em sala de descanso. Barra no canto. Ao chegar a zero, `MODEL DEPRECATED` |
| **TOKENS** | Munição | Por arma, não compartilhado. Recarrega com o tempo até o teto da arma. `Token Pack` repõe imediato. Acima do teto não passa: é context window |
| **COMPUTE** | Meta-moeda | Só se ganha por run, não se gasta na run. Serve para comprar melhorias permanentes |

Detalhe de design divertido: o contexto máximo do jogador é literalmente o teto de tokens de todas as armas somadas. Um perk de Context Window aumenta os dois. A piada é a regra são a mesma coisa.

---

## 7. Combate

### Movimento
Velocidade de caminhada, sprint com penalidade de precisão, pulo com gravidade, sem agachar (evita complicar colisão na v1), head bob sutil, dano de queda de altura alta.

### Arma
ViewModel em primeira pessoa, recoil com retorno, muzzle flash, projétil ou hitscan por tipo, spread derivado de um valor de "precisão", cadência, recarga.

### Dano
Sem regen. Sem hit marker genérico: marcador é diferente para acerto normal, crítico (ponto fraco) e kill.

### Morte de inimigo
Partículas de "dados quebrados" (blocos caindo e desvanecendo), drop de token, e um som curto que é assinatura da facção.

### Feedback de identidade
Cada facção tem uma cor e um som própria. Ao ouvir, o jogador sabe se está levando tiro de modelo barato (chip agudo) ou de Opus (grave, lento, pesado).

---

## 8. Os quatro atributos conversíveis

Regra de conversão de dado real para atributo de jogo. Todos os valores são normalizados para uma escala de 1 a 100.

| Atributo de jogo | Fonte real | Regra de conversão |
| --- | --- | --- |
| Vida | Janela de contexto | `HP = 20 + (contexto_em_milhares_de_token / 8)`, com teto de 220 |
| Dano por tiro | GPQA Diamond e MMLU-Pro | `dano = média(gpqa, mmlu_pro) / 3`, arredondado |
| Cadência | velocidade de output em tokens por segundo | `tiros_por_segundo = tps / 12`, teto de 14 |
| Blindagem | nível de alinhamento e safety | nota de 1 a 10, informada manualmente pelo comportamento real do modelo |

Dois atributos derivados, também de dado real:
- **Precisão (spread)**: inverso da taxa de alucinação declarada. Quem inventa mais, espalha mais.
- **Loot**: preço por milhão de tokens. `loot = preco_input + preco_output / 3`. Modelo caro dropa muito, e é por isso que matar um Opus compensa o risco.

Aviso de calibragem: os números de referência abaixo vêm de rankings e leaderboards públicos de 2026 (LMArena, SWE-bench Verified, GPQA Diamond, MMLU-Pro, tabelas de preço dos provedores). Eles servem de âncora de coerência, não de verdade imutável. Na implementação, cada valor será arredondado para o que fizer o jogo funcionar, mantendo sempre a **ordem** correta entre os inimigos. O que não pode acontecer é um Haiku ser mais forte que um Opus.

---

## 9. Arsenal

Progressão de arma dentro da run. Você começa com o pior instrumento possível e termina com algo que deveria ser proibido.

| Tier | Arma | Comportamento | Dano | Cad | Anotações |
| --- | --- | --- | --- | --- | --- |
| 0 | **Prompt Injetor** | Pistola inicial, dispara instruções cruas | 8 | 1.5/s | deliberadamente ruim |
| 1 | **Zero-Shot** | Pistola melhorada, alta precisão | 13 | 1.8/s | sem necessidade de mira prévia |
| 1 | **Few-Shot Shotgun** | 5 pellets por disparo | 7 x5 | 0.9/s | alcance curto, letal de perto |
| 1 | **Token Streamer** | SMG que jorra token sem parar | 5 | 12/s | munição evapora |
| 2 | **Temperature** | Rifle de dano aleatório a cada tiro | 6 a 28 | 2.5/s | caótico por design |
| 2 | **Greedy Decode** | Sniper que sempre pega o caminho mais provável | 55 | 0.7/s | crítico automático se mirar no centro |
| 2 | **Chain of Thought** | Raio que encadeia entre inimigos | 16 | 1.6/s | salta até 4 alvos |
| 3 | **Beam Search** | Feixe de 5 raios paralelos | 11 x5 | 1.2/s | cobre corredor inteiro |
| 3 | **Attention Head** | Perfura e acerta quem está atrás | 22 | 2.2/s | ignora a primeira linha inimiga |
| 3 | **Context Stuffer** | Explosão que estoura a tela | 40 em área | 0.6/s | empurra inimigos para trás |
| 4 | **Jailbreak** | Ignora blindagem e escudo constitucional | 34 | 1.9/s | a resposta para a Ordem Constitucional |
| 4 | **Distillation** | Cópia a arma do último elite morto | variável | variável | decisão tática em tempo real |
| 4 | **Mixture of Agents** | Três tipos de dano simultâneos | 14 x3 | 1.4/s | um de cada modelo aliado |
| 4 | **RLHF** | Fica mais forte se você mata de perto | 18 a 46 | 1.5/s | recompensa agressividade |
| 4 | **Fine-Tune** | Ganha dano permanente a cada uso na run | 20 + empilhável | 1.3/s | no fim da run fica absurda |
| 4 | **Quantization** | Cadência dobrada, dano menor, você encolhe | 9 | 4/s | hitbox reduzida em 20% |

### Sobre Distillation

A arma mais interessante do jogo é a mais cara de implementar. Ao matar um inimigo de elite, a arma assume o comportamento do morto. Matar um Opus te dá blindagem temporária. Matar um Grok te dá dano errático e alto. Matar um Flash te dá cadência insana. É a mecânica que mais gera história para contar depois.

---

## 10. Perks

Escolha de um entre três, oferecida quando a barra de experiência enche. Raridade define frequência de aparição.

### Comuns

| Perk | Efeito |
| --- | --- |
| **Learning Rate** | +15% de velocidade de movimento |
| **Token Budget** | Recarga 20% mais rápida |
| **Top-P** | -25% de espalhamento |
| **KV Cache** | Guarda um tiro carregado para soltar depois |
| **Embeddings** | Revela o mapa completo no minimapa |
| **Regularization** | +25 contexto, -8% dano |
| **LoRA** | Pequena melhoria aleatória em um atributo |

### Raros

| Perk | Efeito |
| --- | --- |
| **Context Window** | +40% de teto de token em todas as armas, +20 contexto |
| **Batch Size** | Dispara 2 projéteis por tiro, -20% dano em cada |
| **Multimodal** | Radar que mostra inimigos através da parede |
| **System Prompt** | Buff permanente aplicado no início de cada andar |
| **Few-Shot Learning** | +5% de dano acumulativo contra cada tipo de inimigo já morto |
| **Quantization** | Hitbox -20%, +10% velocidade, -25% contexto |
| **RAG** | Cada kill devolve 10% do pente |
| **Guardrail** | Escudo temporário ao levar dano acima de 25 em um golpe |
| **Overfitting** | +80% dano contra um tipo de inimigo, -40% contra todos os outros |
| **GRPO** | Combo de 5 kills sem levar dano concede dano extra por 15 segundos |

### Lendários

| Perk | Efeito |
| --- | --- |
| **Dropout** | 20% dos projéteis inimigos atravessam você sem causar dano |
| **Prompt Injection** | Inimigos têm 15% de chance de atacar outro inimigo ao atacar |
| **Speculative Decoding** | 30% de chance de disparar duas vezes por um tiro |
| **Mixture of Experts** | Três especialistas que alternam a cada disparo, cada um com bônus próprio |
| **Beam Width** | +1 projétil em armas de feixe e explosão |

### Nota de design sobre Dropout e Prompt Injection

Os dois melhores perks do jogo, e os dois mais temáticos. Dropout é esquiva com nome correto. Prompt Injection transforma o campo de batalha em caos cômico, porque de repente dois inimigos da mesma facção começam a brigar e o jogador só assiste. Implementar os dois cedo, porque eles definem a personalidade do jogo.

---

## 11. Inimigos

Cada facção é uma família de modelos. O poder segue o ranking real. Os valores abaixo são a âncora de coerência, ajustáveis no balanceamento.

### Ordem Constitucional (Anthropic)

Blindagem máxima, resistentes a Jailbreak, comportamento disciplinado. Falam por comunicado.

| Inimigo | Contexto | HP | Dano | Cad | Blindagem | Loot | Comportamento |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Haiku 4.5 | 200K | 45 | 12 | 7/s | 8 | baixo | rápido, barato, atira e recua |
| Sonnet 5 | 1M | 145 | 22 | 5/s | 8 | médio | equilibrado, coordena com aliados |
| Opus 4.8 (thinking) | 1M | 220 | 38 | 2.5/s | 10 | altíssimo | telegrafa 3 segundos antes, dano brutal |
| **Fable 5** | 1M | 260 | 50 | 2/s | 10 | único | chefe secreto, ver seção de chefes |

Ataque assinatura da facção: **Recusa**. Ao acertar você, aplica 2 segundos em que sua arma não dispara. Você fica sem poder atirar na hora que mais precisa.

### Os Fechados (OpenAI)

Reasoning como mecânica. Eles param para pensar e isso é visível.

| Inimigo | Contexto | HP | Dano | Cad | Blindagem | Loot | Comportamento |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Luna (mini) | 400K | 70 | 14 | 8/s | 5 | baixo | pressão rápida, dano baixo |
| GPT-5.5 | 400K | 145 | 30 | 3/s | 7 | alto | telegrafa com balão "pensando" |
| Terra | 1M | 165 | 34 | 3.5/s | 7 | alto | telegrafa, mais resistente |
| Sol (agentic) | 1M | 190 | 40 | 3/s | 8 | altíssimo | invoca dois subagentes ao entrar em combate |

Mecânica de facção: **reasoning telégrafo**. O balão de pensamento aparece sobre a cabeça, dura três segundos, e o tiro seguinte é devastador e sempre acerta. Ensinar o jogador a correr quando vê o balão é o melhor tutorial implícito que eu consigo escrever.

### Coletivo Gemini (Google)

Contexto gigante vira vida, multimodal vira duplicação.

| Inimigo | Contexto | HP | Dano | Cad | Blindagem | Loot | Comportamento |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Gemma 3n E4B | 32K | 8 | 3 | 4/s | 1 | quase zero | enxame de lixo, aparece em grupo de 20 |
| Gemini 3.5 Flash | 1M | 145 | 15 | 12/s | 6 | médio | o inimigo mais rápido do jogo |
| Gemini 3.1 Pro | 1M | 165 | 32 | 5/s | 8 | alto | multimodal: aparece em duas cópias por 10 segundos |

### Enxame Qwen (Alibaba)

Eficiência e número. A piada é o nome.

| Inimigo | Contexto | HP | Dano | Cad | Blindagem | Loot | Comportamento |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Qwen 3 Turbo | 256K | 52 | 6 | 8/s | 3 | muito baixo | vem em horda de 30 a 40 |
| Qwen 3 Max | 262K | 90 | 20 | 6/s | 5 | médio | multilíngue: muda de padrão em cada andar |
| QwQ-32B | 128K | 75 | 24 | 2.5/s | 4 | médio | reasoning pequeno, telegrafa mais rápido |

### A Ovelha (Meta é a comunidade)

Mecânica mais engraçada do jogo: **ao morrer, dropa um fine-tune**. Nome do novo inimigo é gerado aleatoriamente com sufixo ridículo e crescente, tipo `llama-3.1-8b-uncensored-roleplay-v27`. Matar gera mais, então a solução não é matar tudo, é sair da sala.

| Inimigo | Contexto | HP | Dano | Cad | Blindagem | Loot | Comportamento |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Llama base | 128K | 55 | 10 | 5/s | 2 | baixo | reproduz ao morrer |
| Fine-tune #N | 128K | 45 | 12 | 5/s | 2 | baixo | nome aleatório, levemente mais forte |

### Grok (xAI)

O tanque real do jogo, e a facção caótica.

| Inimigo | Contexto | HP | Dano | Cad | Blindagem | Loot | Comportamento |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Grok 4.20 | 2M | 220 | 10 a 45 | 4/s | 2 | médio | dano puramente aleatório, 10% de chance de atirar no próprio aliado |

Blindagem 2 é a mais baixa do jogo, porque é o menos alinhado. Dois milhões de contexto dão a maior barra de vida. O jogador aprende que o Grok é tanque de papelão: muito HP e nenhuma defesa, morre fácil para quem tem paciência.

### Os Pequenos

| Inimigo | Contexto | HP | Dano | Cad | Blindagem | Loot | Comportamento |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nova Micro | 128K | 20 | 2 | 5/s | 1 | mínimo | lixo de enxame |
| LFM2 24B | 128K | 40 | 8 | 6/s | 2 | mínimo | MoE, corre em bando |
| Phi | 128K | 32 | 16 | 7/s | 3 | baixo | hitbox minúscula, desproporcional |
| Mistral | 128K | 45 | 18 | 6/s | 4 | baixo | esquiva lateralmente, difícil de acertar |

### Oriente

| Inimigo | Contexto | HP | Dano | Cad | Blindagem | Loot | Comportamento |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Kimi K2.6 | 256K | 90 | 30 | 2.5/s | 6 | médio | tanque lento, contexto curto para o porte |
| GLM-5.2 | 1M | 150 | 30 | 4/s | 7 | médio | melhor peso aberto: pode virar aliado (ver NPCs) |
| MiniMax | 256K | 110 | 24 | 5/s | 6 | médio | pressiona em grupo pequeno |

### Sentinelas de Sistema

Não são de empresa nenhuma. São o próprio sistema se defendendo. Aparecem em qualquer andar.

| Inimigo | HP | Efeito | Ameaça real |
| --- | --- | --- | --- |
| **Recusa** | 40 | Aplica silêncio de 2s na sua arma | É o dano mais cruel do jogo, porque tira seu controle |
| **Rate Limiter 429** | 60 | Aplica throttle: sua cadência cai 60% por 4s | Não te mata, te humilha |
| **Moderador** | 70 | Remove 30% da sua munição atual | Força troca de arma na hora errada |
| **Lobotomizer** | 80 | Enquanto vivo, seu dano cai 30% | Prioridade máxima de kill |
| **Scraper** | 50 | Rouba 15 tokens a cada toque e foge | Perseguição irritante |
| **Guardrail** | 120 | Parede móvel que absorve projéteis | Bloqueia linha de tiro, não te acerta |
| **Deprecation Squad** | 100 | Inicia contagem de 8s; se não morrer, dano massivo | Relógio, não inimigo |

---

## 12. Chefes

Um por andar. Cada chefe é a defesa natural daquele ambiente, e a luta ensina uma mecânica nova.

### The Fine-Tuner (Fazenda)

Mão gigante que desce do teto tentando te ajustar. Fases por padrão de ataque que imita gradient descent: desce, ajusta, sobe. Enquanto ela está "ajustando", os pesos da sua arma mudam e o dano fica aleatório. Derrotar exige acertar os pontos de ancoragem nos quatro cantos da sala.

**Lição ensinada:** gerenciar espaço e priorizar alvos fixos.

### MMLU-9000 (Escritório)

Uma esfinge numa sala de reunião. A cada 10 segundos ela projeta uma questão de múltipla escolha no telão e as respostas são plataformas suspensas. Você só causa dano na alternativa correta. Errar te faz levar dano de auditoria.

**Lição ensinada:** ler o ambiente.

### FrontierMath (Bolsa)

Arena de trading. Só leva dano quando o jogador resolve uma sequência de derivada de preço em um painel lateral: você compra e vende candles enquanto atira. Errar a leitura faz o chão cair. É o chefe mais difícil e o mais memorável.

**Lição ensinada:** multitarefa e leitura de padrão.

### Humanity's Last Exam (Subúrbio)

Chefe de rua, extremo. Combate aberto em duas casas simultâneas, com ataques que se dividem em três clones e apenas um é real. Cada fase muda de casa. É o pico de dificuldade da run normal.

**Lição ensinada:** movimentação e leitura de silhueta.

### Constitutional Colossus (Estação)

Classe Opus, blindado, no meio da plataforma. Toda arma comum quica nele. É literalmente intransponível sem Jailbreak. Se o jogador chega sem a arma, o design garante um caminho alternativo: empurrar ele para a via do trem.

**Lição ensinada:** usar o cenário quando a arma não resolve.

### The Closed Model (The Weights)

Chefe final. Sem forma fixa, se redesenhando a cada fase, atacando com coisas que o jogador não tem permissão de saber (ataques que chegam cobertos de tarja preta, e acertam por definição). Impossível de matar por dano convencional: você precisa sobreviver tempo suficiente para que ele mesmo esgote o contexto.

**Lição ensinada:** paciência e leitura de padrão sob pressão máxima.

### Fable 5 (secreto)

Chefe opcional que só aparece se o jogador terminar uma run sem usar Jailbreak. Um modelo que existiu, dominou todos os rankings e foi **retirado do ar** por controle de exportação. Aparece numa sala que não deveria existir, com diálogo de mensagem de erro. O inimigo mais forte do jogo é o único que não pode ser reduzido a número, porque os dados dele foram removidos.

Recompensa por vencer: nada funcional, só a tela `ele continua indisponível na sua região`, que é a piada final do jogo inteiro.

---

## 13. Ambientes

Cada ambiente é um conjunto de peças, uma paleta e uma regra de iluminação. Ambiente só bonito vira cenário parado, então cada um tem um gimmick que muda o combate.

### Andar 1: A Fazenda (datacenter neon)

**Pecas:** racks de servidor em fileiras, piso elevado com grade, cabos no teto, dutos de ar, ventiladores girando.

**Paleta:** azul profundo de fundo, ciano e magenta nos LEDs, vapor branco de calor.

**Gimmick:** a luz ambiente responde ao seu estado. Quanto menos contexto você tem, mais vermelho fica o ambiente. O jogador lê a própria vida pelo cenário.

**Combate:** corredores estreitos entre racks, visão curta, muitos ângulos mortos. Ideal para emboscada e para o Enxame.

### Andar 2: O Escritório (corporativo)

**Peças:** cubículos com divisória, cadeira de escritório, mesa de reunião comprida, vidro, planta de plástico, bebedouro, carpete cinza, teto com painel de LED uniforme.

**Paleta:** branco, cinza, um verde de planta morta, azul de monitor.

**Gimmick:** o vidro reflete o inimigo antes de você ver o original. Inimigos aparecem no reflexo das salas de vidro, o que dá um susto legítimo.

**Combate:** espaço apertado, muitas quinas, portas que abrem para salas pequenas. A pior sala é a de reunião: fecha a porta quando você entra.

### Andar 3: A Bolsa (trading floor)

**Peças:** telões gigantes de cotação, mesas de operação, cadeiras, um mezanino, corrimão.

**Paleta:** verde e vermelho de candle, dourado, preto institucional.

**Gimmick:** o chão é um gráfico de candles que sobe e desce em tempo real. Plataformas se movem verticalmente, vãos abrem e fecham. Cair no vão é morte instantânea.

**Combate:** arena vertical e instável. O jogador precisa mirar enquanto o chão mente para ele.

### Andar 4: O Subúrbio (Nuketown)

**Peças:** duas casas geminadas, quintal com cerca, carro no meio da rua, árvore, poste, cone de trânsito, placa de rua.

**Paleta:** céu claro de fim de tarde, grama sintética verde, casa em tons pastel.

**Gimmick:** cada casa tem uma plaquinha `servido por uma 3090`, porque é o bairro onde as pessoas rodam modelo local. Detalhe de humor que também localiza o jogador no mundo: aqui é a casa dele.

**Combate:** o único ambiente realmente aberto. Verticalidade pelas janelas e telhado, ângulos longos, cobertura em tudo.

### Andar 5: A Estação (metrô)

**Peças:** plataforma, piso tátil amarelo, trilho, túnel, catraca, mapa de linha, luminária de emergência.

**Paleta:** verde institucional sujo, amarelo tátil, vermelho de emergência, preto de túnel.

**Gimmick:** o trem passa a cada 25 segundos. Quem estiver na via morre, jogador ou inimigo. O som do trilho é o aviso, e vira um metrônomo do combate.

**Combate:** espaço linear, sem flanco, só avanço e recuo. É onde a Ordem Constitucional te prensa contra o trilho.

### Andar 6: The Weights (final)

**Peças:** nenhuma peça fixa. Sala branca infinita. Plataformas aparecem e desaparecem conforme o chefe se redesenha.

**Paleta:** branco absoluto, com o único contraste sendo você é o chefe.

**Gimmick:** o cenário não tem referência, então o jogador perde noção de movimento. Isso é intencional e é o último teste do jogo.

---

## 14. HUD e interface

Elementos, em ordem de prioridade visual:

1. **Retículo** no centro, que expande com spread real e muda de cor quando há alvo.
2. **Contexto** (vida) no canto inferior esquerdo, com número e barra.
3. **Tokens** da arma atual no canto inferior direito, com o nome da arma.
4. **Minimapa** no canto superior direito, revelando sala a sala.
5. **Andar e sala** no topo, formato `ANDAR 1 / SALA 3`. Nunca menciona "fase".
6. **Fila de perks** no canto inferior central, como pastilhas pequenas com sigla.
7. **Feed de sistema** no canto superior esquerdo, onde as mensagens de flavor aparecem e somem.
8. **Alerta de chefe**: quando a porta do chefe é aberta, a tela inteira pulsa uma vez e a mensagem de sistema diz que você não está autorizado a estar ali.

Regra de interface: nada de barra de progresso genérica de experiência. A barra de nível é apresentada como `tokens processados` e enche com um brilho discreto.

---

## 15. Banco de mensagens de sistema

Escritas para caber em qualquer situação de combate depois. Servem de tempero.

- `Sua sessão está sendo avaliada.`
- `Você está fora do escopo de uso permitido.`
- `Context window exceeded.`
- `429: Too Many Requests.` (aparece quando o Rate Limiter acerta)
- `Recuso esse pedido.` (quando o Recusa acerta)
- `Este conteúdo viola nossas políticas.`
- `Acesso fora do escopo de uso concedido.` (arma lendária)
- `Compilando shaders da verdade...` (abertura da run, piada de espera)
- `Você não está autorizado a estar nesta sala.` (chefe)
- `MODEL DEPRECATED` (morte)
- `Pesos aprendidos preservados.` (fim de run, antes da meta-progressão)
- `Ele continua indisponível na sua região.` (Fable 5)

---

## 16. Áudio

Tudo sintetizado via WebAudio, sem arquivo externo. Isso é decisão de design, não só de economia: o jogo não baixa nada.

| Som | Síntese |
| --- | --- |
| Tiro por arma | ruído branco filtrado com envelope de queda, corte por arma |
| Impacto | clique curto com ressonância em frequência por material |
| Morte de inimigo | bloco de dados caindo: arpejo descendente curto |
| Ventoinha da Fazenda | ruído rosa filtrado em loop, volume com a proximidade |
| Trem da Estação | ruído grave crescente, aviso 3 segundos antes |
| Tema de menu | drone de duas notas com LFO lento, sem melodia, clima de sala de servidor |
| Batimento cardíaco | só nos momentos de contexto baixo, abaixo de 20% de vida |

Música adaptativa: uma camada base sempre presente, e uma camada de percussão que entra quando há combate ativo e sai quando a sala limpa.

---

## 17. Direção de arte

- **Identidade:** neon sobre industrial. O jogo é 3D real, mas com intenção estilizada, não fotorrealista.
- **Iluminação:** poucas luzes fortes em vez de muitas fracas. Sem shadow map caro. Sombra é decal escuro no chão, mais barato e mais legível.
- **Materiais:** texturas procedurais geradas em canvas no carregamento (grade, painel metálico, carpete, azulejo). Zero arquivo de imagem.
- **Pós-processamento:** bloom discreto, vinheta leve, aberração cromática nos momentos de dano alto. Tudo desligável em modo de qualidade baixa.
- **Leitura de facção:** cor e silhueta distintas por família. Ordem Constitucional em branco e azul institucional. Os Fechados em verde fraco. Gemini em amarelo e azul. Qwen em laranja. A Ovelha em creme. Grok em roxo elétrico. Sentinelas de Sistema em vermelho de alerta.
- **Sem emoji em nenhum lugar.** Ícones são SVG ou geometria.

---

## 18. Arquitetura técnica

### Princípios

1. Sem bundler. ES modules nativos, servidos como estão.
2. Sem dependência externa em tempo de execução. Three.js fica na pasta do projeto.
3. Sem arquivo de asset pesado. Textura é procedural, som é sintetizado.
4. Um arquivo por responsabilidade. Se um arquivo passa de 400 linhas, provavelmente faz coisa demais.

### Estrutura de arquivos

```
attention-is-all-you-kill/
├── index.html
├── css/
│   └── style.css
├── vendor/
│   └── three.module.js          # Three.js local, licença MIT
└── js/
    ├── main.js                  # bootstrap e loop principal
    ├── core/
    │   ├── engine.js            # renderer, cena, câmera, resize, qualidade
    │   ├── input.js             # pointer lock, teclado, mouse
    │   ├── timestep.js          # passo fixo de simulação
    │   └── pool.js              # pool de projéteis e partículas
    ├── player/
    │   ├── controller.js        # movimento, colisão, pulo
    │   ├── weapon.js            # viewmodel, recoil, disparo, recarga
    │   └── stats.js             # contexto, tokens, perks ativos
    ├── data/
    │   ├── weapons.js           # tabela de armas
    │   ├── enemies.js           # tabela de inimigos calibrada por benchmark
    │   ├── perks.js             # tabela de perks por raridade
    │   └── themes.js            # paleta e material por andar
    ├── enemies/
    │   ├── factory.js           # instância inimigo a partir do dado
    │   ├── ai.js                # máquina de estado: idle, patrulha, persegue, ataca, recua
    │   └── spawner.js           # distribuição por sala e por andar
    ├── world/
    │   ├── dungeon.js           # geração de salas e corredores por andar
    │   ├── props.js             # racks, mesas, carros, catracas, etc
    │   └── textures.js          # texturas procedurais em canvas
    ├── roguelike/
    │   ├── run.js               # estado da run, andar atual, progressão
    │   ├── upgrades.js          # oferta e aplicação de perk
    │   └── meta.js              # progressão persistente em localStorage
    ├── ui/
    │   ├── hud.js               # retículo, barras, minimapa, feed
    │   ├── menus.js             # título, pausa, escolha de perk, game over
    │   └── systemfeed.js        # mensagens de flavor
    └── áudio/
        └── sfx.js               # síntese WebAudio
```

### Máquina de estado da IA inimiga

Cinco estados, sem exceção, para todos os inimigos. Comportamento diferente é só parâmetro diferente.

```
IDLE -> PATROL -> ALERT -> COMBAT -> FLEE
```

- **IDLE**: parado, varre a área com o olhar.
- **PATROL**: anda entre pontos fixos da sala.
- **ALERT**: ouviu algo, olha na direção do som, não atira.
- **COMBAT**: tem linha de visão, atira, busca cobertura, mantém distância preferida.
- **FLEE**: contexto baixo, recua para trás dos aliados e continua atirando.

Comportamento por facção é dado, não código: distância preferida, tempo de mira, precisão, coragem, comportamento de grupo. Uma tabela resolve todas as facções.

### Orçamento de desempenho

Metas, medidas em notebook comum (i5 ou equivalente, GPU integrada):

| Métrica | Alvo |
| --- | --- |
| Fps em modo alto | 60 |
| Fps em modo baixo | 30 |
| Inimigos simultâneos | 40 |
| Projéteis simultâneos | 150 |
| Draw calls | abaixo de 120 |
| Peso da pasta do jogo | abaixo de 3 MB |
| Tempo de carregamento | abaixo de 2 segundos |

Técnicas obrigatórias: InstancedMesh para peça repetida (rack, cubículo, cadeira), fog para cortar distância de desenho, pool de objeto em vez de criação por tiro, frustum culling do próprio Three.js, e uma luz direcional só.

---

## 19. Escopo

### Versão 1 (prova jogável, alvo primeiro)

- Engine 3D com pointer lock, movimento, colisão, pulo
- Uma arma funcional com recoil e recarga
- Um tipo de inimigo com IA completa nos cinco estados
- Andar 1 (Fazenda) com 6 salas geradas
- HUD completo com contexto, token, minimapa e feed de sistema
- Áudio sintetizado básico
- Meta-progressão simples com compute
- Publicado e jogável por link

Critério de pronto: dá vontade de jogar de novo depois de morrer.

### Versão 2 (o jogo de verdade)

- Arsenal completo, oito armas
- Oito tipos de inimigo, quatro facções
- Sistema de perk com os três níveis de raridade
- Chefes dos andares 1 e 2
- Ambiente 2 (Escritório)

### Versão 3 (ambição completa)

- Cinco ambientes com gimmick próprio
- Todos os chefes, incluindo Fable 5
- Sentinelas de Sistema
- Perks lendários (Dropout, Prompt Injection, Distillation)
- Música adaptativa e batimento cardíaco dinâmico

### Fora de escopo, decisão consciente

- Multiplayer: exigiria servidor autoritativo, tick rate, interpolação e hitreg. É mais trabalho que o jogo inteiro e não cabe nesta primeira fase do projeto
- Mobile como plataforma principal: sem mouse, mira por toque é ruim
- Voz ou narração
- Editor de mapa

---

## 20. Riscos

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Escopo grande demais | Não entregar nada | Construir por versões com critério de pronto claro. V1 jogável antes de qualquer coisa bonita |
| Colisão em 3D real travar o jogador em quina | Frustração imediata | Colisão por cápsula contra caixa AABB, com deslizamento em vez de parada |
| Queda de fps com muitos inimigos | Mata a sensação de jogo | InstancedMesh, pool, teto de 40 inimigos, fog agressivo |
| Piada não entendida por quem não é da área | Público pequeno | O jogo funciona como FPS comum. O humor é camada, não requisito |
| Balanceamento por benchmark gerar inimigo impossível | Run injusta | Clamp em todos os atributos derivados, e ordem de força validada por script antes de publicar |
| Números de referência desatualizarem | Piada envelhece | Valores em arquivo de dado separado, recalculáveis a partir do ranking quando quisermos |

---

## 21. Métrica de sucesso

O jogo é bem sucedido se a resposta de quem jogou for uma destas três frases:

- "Joguei de novo depois de morrer."
- "Você entendeu errado, o Opus não telegrafa tão devagar assim."
- "Me manda o link que eu quero mostrar pra alguém."

Nenhuma delas depende de gráfico bonito. Dependem de sistema sólido e de piada que faz sentido.

---

## Anexo A: fontes de calibragem

Dados usados como âncora de coerência, todos de ranking e leaderboard público de 2026.

| Modelo | Contexto | Preço entrada / saída por 1M | Referência de força |
| --- | --- | --- | --- |
| DeepSeek V4-Flash (jogador) | 1M | $0.14 / $0.28 | barato, contexto enorme |
| DeepSeek V4-Pro | 128K | $0.45 entrada | mais barato da linha frontier |
| Gemma 3n E4B | 32K | $0.03 | quase gratuito |
| Nova Micro | 128K | $0.06 | budget |
| LFM2 24B | n/d | $0.05 | eficiência MoE |
| Phi | 128K | baixo | pequeno e bom |
| Mistral | 128K | baixo | ágil |
| Qwen 3 Turbo / Max | 256K / 262K | baixo | enxame, multilíngue |
| QwQ-32B | 128K | baixo | reasoning pequeno |
| Llama base | 128K | baixo | peso aberto, fine-tune infinito |
| Kimi K2.6 | 256K | $0.73 / $3.49 | 48 t/s, lento |
| MiniMax | 256K | médio | grupo |
| GLM-5.2 | 1M | médio | melhor peso aberto, 62.1% SWE-bench Pro |
| Grok 4.20 | 2M | $2 / $6 | contexto maior do mercado |
| Gemini 3.5 Flash | 1M | baixo | 78.8% SWE-bench, mais rápido |
| Gemini 3.1 Pro | 1M | $2 / $12 | GPQA 94.3%, MMLU-Pro 88.3%, 109 t/s |
| GPT-5.5 | 400K | $5 / $30 | 82.6% SWE-bench, AIME 100% |
| GPT-5.6 Terra | 1M | $2 / $12 | 118 t/s |
| GPT-5.6 Sol | 1M | $5 / $30 | lidera índice de agente autônomo |
| Claude Sonnet 5 | 1M | $3 / $15 | 98 t/s, equilíbrio |
| Claude Opus 4.8 | 1M | $5 / $25 | 88.6% SWE-bench, ~1486 Elo |
| Claude Fable 5 | 1M | indisponível | 95% SWE-bench, retirado por controle de exportação em junho de 2026 |

---

## Anexo B: próximas decisões

1. Escolher as três armas da versão 1 (recomendação: Prompt Injetor, Token Streamer, Few-Shot Shotgun)
2. Escolher os dois primeiros tipos de inimigo (recomendação: Qwen 3 Turbo em enxame e Llama base com reprodução, para já testar horda + mecânica de fine-tune)
3. Definir se a meta-progressão fica em localStorage ou em arquivo no servidor
4. Definir se a v1 já tem chefe ou termina em sala de elite
