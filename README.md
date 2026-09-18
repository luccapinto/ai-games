# ai-games

Um repositório coletivo de jogos feitos conversando com IA — e um benchmark do
que isso custa. Cada jogo vive numa pasta própria, autocontido e jogável sozinho,
com o modelo que escreveu, a ferramenta que dirigiu e os tokens gastos
registrados ao lado.

*A collective repo of games built by talking to AI — and a benchmark of what that
costs. Each game is a self-contained, playable folder that records the model that
wrote it, the agent that drove it, and the tokens it burned.*

**10 jogos** de **1 pessoa**, 37.164 linhas de código,
3,7 M tokens novos e US$ 24,62 de API no total.

👉 **[Jogar tudo](https://luccapinto.github.io/ai-games/)** · **[Ver o benchmark](https://luccapinto.github.io/ai-games/benchmark.html)** · **[Mandar o seu jogo](CONTRIBUTING.md)**

## Os jogos

| Jogo | Gênero | Quem fez | Modelo | Tokens novos | Custo | Jogar |
| --- | --- | --- | --- | --- | --- | --- |
| **TRAVESSIA** [`travessia`](games/travessia/README.md) | Mundo aberto | Lucca Pinto | claude-opus-5 | 103,0 k | US$ 1,54 | [jogar](https://luccapinto.github.io/ai-games/games/travessia/) |
| **SUBSOLO** [`subsolo`](games/subsolo/README.md) | FPS de rodadas | Lucca Pinto | claude-opus-5 | 705,0 k | US$ 8,30 | [jogar](https://luccapinto.github.io/ai-games/games/subsolo/) |
| **GUARDRAIL** [`guardrail`](games/guardrail/README.md) | Defesa de torre | Lucca Pinto | claude-opus-5 | 165,0 k | US$ 2,48 | [jogar](https://luccapinto.github.io/ai-games/games/guardrail/) |
| **CURVA** [`curva`](games/curva/README.md) | Kart 3D | Lucca Pinto | claude-opus-5 | 441,0 k | US$ 5,31 | [jogar](https://luccapinto.github.io/ai-games/games/curva/) |
| **SEIVA** [`seiva`](games/seiva/README.md) | Defesa de torre | Lucca Pinto | claude-opus-5 | 70,0 k | US$ 1,05 | [jogar](https://luccapinto.github.io/ai-games/games/seiva/) |
| **PROCESSO** [`processo`](games/processo/README.md) | Cartas com construção de baralho | Lucca Pinto | claude-opus-5 | 44,0 k | US$ 0,66 | [jogar](https://luccapinto.github.io/ai-games/games/processo/) |
| **CRIPTA** [`cripta`](games/cripta/README.md) | Puzzle | Lucca Pinto | claude-opus-5 | 86,0 k | US$ 1,30 | [jogar](https://luccapinto.github.io/ai-games/games/cripta/) |
| **A CEIA** [`ceia`](games/ceia/README.md) | Dedução lógica | Lucca Pinto | claude-opus-5 | 31,0 k | US$ 0,47 | [jogar](https://luccapinto.github.io/ai-games/games/ceia/) |
| **ANTENA** [`antena`](games/antena/README.md) | Plataforma de precisão | Lucca Pinto | claude-opus-5 | 165,0 k | US$ 2,48 | [jogar](https://luccapinto.github.io/ai-games/games/antena/) |
| **ATTENTION IS ALL YOU KILL** [`attention-is-all-you-kill`](games/attention-is-all-you-kill/README.md) | FPS roguelike | Lucca Pinto | deepseek-flash | 1,9 M | US$ 1,03 | [jogar](https://luccapinto.github.io/ai-games/games/attention-is-all-you-kill/) |

## O benchmark

| Modelo | Jogos | Tokens novos | Cache | Custo | Linhas |
| --- | --- | --- | --- | --- | --- |
| claude-opus-5 | 9 | 1,8 M | 0 | US$ 23,59 | 26.455 |
| deepseek-flash | 1 | 1,9 M | 159,1 M | US$ 1,03 | 10.709 |

Tokens novos são entrada + saída. Cache aparece em coluna separada de propósito:
quanto do contexto vira leitura de cache depende da ferramenta que dirigiu o
modelo, não do trabalho que o modelo fez — somar os dois compararia agentes, não
jogos. A metodologia inteira, com o que este benchmark **não** mede, está em
[`docs/CUSTOS.md`](docs/CUSTOS.md).

## Como mandar um jogo

```bash
git clone https://github.com/luccapinto/ai-games && cd ai-games
python3 tools/novo_jogo.py meu-jogo      # cria a pasta já jogável
# faça o jogo, preencha o meta.json
python3 tools/validar.py meu-jogo        # a mesma checagem que a CI roda
python3 tools/build.py                   # regenera índice, hub e benchmark
```

Depois é abrir o PR. O guia completo está em [`CONTRIBUTING.md`](CONTRIBUTING.md);
a referência de cada campo do `meta.json`, em [`docs/ESQUEMA.md`](docs/ESQUEMA.md).

O que se pede de um jogo: que rode no navegador abrindo a pasta, sem build e sem
servidor obrigatório; que declare honestamente qual modelo escreveu e quanto
gastou; e que seja seu para publicar.

## Como este repositório se organiza

```
games/<slug>/          o jogo inteiro: código, documentação, capa e meta.json
tools/esquema.py       o contrato do meta.json, usado pelos três scripts
tools/validar.py       barra meta.json torto (é o que a CI roda em cada PR)
tools/novo_jogo.py     cria a pasta de um jogo novo já no formato certo
tools/build.py         gera README, hub, benchmark e os arquivos de dados
index.html             hub navegável, gerado
benchmark.html         a tabela comparativa, gerada
dados/benchmark.json   os mesmos números em JSON, para quem quiser analisar
dados/benchmark.csv    uma linha por (jogo, modelo), para abrir na planilha
```

Cada jogo é uma pasta fechada. Não há dependência entre eles, nem pacote
compartilhado, nem build. Você pode copiar uma pasta dessas para qualquer
servidor de arquivos estáticos e ela funciona.

### O meta.json manda

O `meta.json` dentro de cada jogo é a fonte da verdade: título, gênero, quem fez,
qual modelo escreveu, quantos tokens custou, destaques e tamanho. Este README, o
`index.html`, o `benchmark.html` e os arquivos de `dados/` são gerados dele.

Não existe lista paralela de jogos para manter em sincronia, então o índice nunca
fica desatualizado — e a CI reprova o PR que mexe num `meta.json` sem regenerar.

### De onde vem o custo

Quem manda o jogo declara o consumo da sessão: chamadas de API, tokens de entrada
e saída, leitura de cache, e o custo calculado com a tabela de preços do provider.
É uma estimativa fiel, não a fatura — e cada jogo diz em `medicao.confianca` se o
número foi **medido** na contabilidade da ferramenta, **estimado** ou **parcial**.

O número que costuma assustar é o de leitura de cache, e ele é normal: numa sessão
longa de programação, cada turno reenvia o contexto acumulado, e o cache evita
pagar preço cheio por ele outra vez. Sem cache, o custo destes jogos seria uma
ordem de grandeza maior.

## Os jogos por dentro

### TRAVESSIA

A adutora velha secou e cinco vilas estão bebendo do fundo da cacimba. O sertão é gerado por semente — relevo, rios, biomas, vilas, estradas e gente — e a sede é que manda no caminho: ao meio-dia o cantil dura um minuto e meio andando, de madrugada quase o dobro. Sete missões em grafo de dependência, treze no total.

O que tem dentro:

- Mundo gerado por semente e provado em trinta sementes de uma vez: vila em chão andável, vila alcançável a pé de qualquer outra, estrada inteira caminhável e os cinco terrenos em proporção de sertão — a primeira semente sempre parece boa, a décima é que tem a vila cercada de rio
- A garantia de projeto que sustenta o jogo: todo alvo de missão, todo recurso coletável e todo ponto de estrada tem água a menos de meio cantil de distância, medida num campo de distância da água calculado por busca em largura
- Um robô atravessa a linha principal inteira em três sementes diferentes usando a mesma caminhada, a mesma sede, o mesmo combate e as mesmas missões do navegador — hoje termina em 5 a 7 minutos com vida cheia
- As missões são um grafo de dependência, não uma lista: dá para provar que não há ciclo, que todo alvo existe naquele mundo e que dá para chegar nele vivo
- O corte entre água, caatinga e serra é um quantil do próprio relevo de cada semente, e não um número fixo: com corte fixo a proporção de água ia de 0,5% a 22% entre sementes
- As provas acharam sete defeitos que jogar uma semente boa não acharia, incluindo pedir rota para dentro do rio (a célula de água não é andável, então o robô ficava parado na margem até morrer de sede)

- **Quem fez:** Lucca Pinto
- **Modelo:** claude-opus-5 via Anthropic, dirigido por Oh My Pi — 103,0 k tokens novos, 0 de cache, 74 chamadas, US$ 1,54
- **Custo total:** US$ 1,54 (estimado)
- **Tamanho:** 3.299 linhas de código próprio, 0,2 MB
- **Pasta:** [`games/travessia/`](games/travessia/README.md)

### SUBSOLO

Uma mina de manganes reaberta como deposito, quatro zonas em anel e uma horda que cresce a cada rodada. Voce comeca com lanterna, pistola e quinhentos pontos; ponto vem de dano, e o que voce faz com ele entre duas rodadas e o jogo: abrir escombro, comprar arma de parede, ligar a forca, tomar perk, forjar. Zumbi nao mata, derruba — e o talisma e a diferenca entre um erro e o fim. Render 3D em WebGL2 escrito a mao, onde a luz e a decisao principal: lanterna conica, lampadas da planta e o clarao do cano como luz de verdade.

O que tem dentro:

- A luz e a decisao de render, nao a geometria: lanterna conica presa na camera, as oito lampadas mais proximas da planta (as mesmas que o mapa usa para decidir o que esta iluminado) e o clarao do cano como luz de verdade por 60 ms — e o clarao que mostra o corredor no escuro
- Rocha sem textura de arquivo: o fragmento sombreia por ruido de posicao de mundo em duas escalas, e as quinas tem oclusao por vertice, porque numa mina sem sol quina escura e a unica pista de forma quando a lanterna aponta para outro lado
- O anel do mapa e requisito de projeto e prova numerica: a maior volta da BOCA DA MINA tem 216 celulas e cruza as quatro zonas. Mapa de horda sem volta e mapa onde a rodada 12 mata todo mundo no mesmo canto, sempre
- Escada do jogo tardio medida com robo deterministico: tres perks NAO passam da rodada 10 (53 s), e a mesma partida com forja atravessa ate a rodada 23 - o multiplicador de dano e o que abre o jogo tardio, e perk nenhum substitui ele
- Nada da simulacao usa Math.random: a mira do robo e o rosnado do zumbi saem do sorteio semeado do jogo, porque uma prova que muda de resultado a cada execucao ensina a ignorar vermelho
- Porta e VAO de tres celulas, cobrado uma vez, e isso foi um defeito achado por prova: com vao de uma celula, o zumbi de 0,45 de raio tinha 0,1 de largura livre para o centro e ficava vibrando na quina — a rodada nunca fechava
- Uso tem travamento de 0,6 s, e isso foi o defeito mais caro: sem ele, segurar a tecla comprava municao sessenta vezes por segundo, e o robo morreu na rodada 7 com 11.240 pontos e o mapa fechado
- Nenhuma arma domina todos os eixos, e a prova cobra isso comparando dano de perto, dano de cabeca a 18 m, pente e preco: enquanto a tabela comparava so dano de corpo, a pineira dominava a carabina e a escolha de arma nao existia
- Vinte e quatro zumbis navegam por um campo de fluxo refeito quatro vezes por segundo, e nao por A* individual: todos perseguem o mesmo ponto, entao vinte e quatro buscas dariam o mesmo resultado custando mais que o resto do jogo
- O capataz nao e um zumbi com mais vida: blindagem que corta 45% do dano de corpo e nada do dano de cabeca, entao rajada no peito nao resolve e mira resolve

- **Quem fez:** Lucca Pinto
- **Modelo:** claude-opus-5 via Anthropic, dirigido por Oh My Pi — 705,0 k tokens novos, 0 de cache, 524 chamadas, US$ 8,30
- **Custo total:** US$ 8,30 (estimado)
- **Tamanho:** 6.568 linhas de código próprio, 0,4 MB
- **Pasta:** [`games/subsolo/`](games/subsolo/README.md)

### GUARDRAIL

Você defende o pipeline e as torres são os modelos: o preço por milhão de tokens vira o custo de compra, o benchmark vira o dano, os tokens por segundo viram a cadência, a janela de contexto vira o alcance e a taxa de alucinação vira a chance de errar o tiro. Cada modelo come VRAM de um cluster de tamanho fixo — estourar o orçamento deixa todas as suas torres mais lentas, e a pergunta do jogo deixa de ser quanta torre cabe no mapa para ser quantos modelos cabem no cluster. Vinte e três pragas, quarenta ondas, três mapas e um robô que atravessa tudo.

O que tem dentro:

- As torres são modelos e nenhum atributo é inventado: preço por milhão de tokens vira custo, benchmark vira dano, tokens por segundo viram cadência, janela de contexto vira alcance, latência do primeiro token vira tempo de mira e taxa de alucinação vira chance de errar — o PROFUNDO R1 pensa 2,4 segundos antes do primeiro tiro porque é isso que ele faz na vida real
- O orçamento de compute é a mecânica central: cada modelo ocupa VRAM de um cluster de tamanho fixo e estourar o teto deixa todas as torres mais lentas, o que transforma quantizar, servir em batch, fazer offload e rotear MoE em decisões de partida e não em enfeite temático
- Onze torres com dois caminhos de upgrade de três níveis cada, e subir um acima do nível 1 fecha o outro para sempre: o CHAMA 8B vira dano semântico pelo fine-tune ou metralhadora de RUÍDO pelo enxame local, e não dá para ter os dois
- Cinco tipos de dano que se resolvem de formas diferentes, provado par a par: ARMADURA DE VOLUME só cai para área, ESCUDO SEMÂNTICO só para semântico, MODO ANÔNIMO precisa de detecção, GOLPE é burro demais para o modelo sofisticado levar a sério e só o TOKEN cru entra inteiro, e o DEEPFAKE só quebra com RUÍDO adversarial
- Um robô de estratégia deliberadamente simples atravessa as 40 ondas nos três mapas com 11, 13 e 13 de integridade, e foi ele que achou os sete defeitos que jogar uma partida boa não acharia — inclusive dois estados invencíveis: um VIÉS sorteado num tipo de dano que nenhuma torre produzia e um OVERFITTING que decorava os cinco tipos
- A prova que mais rendeu olha da trilha para a laje em vez de olhar da laje para a trilha: a ILHA CENTRAL passava na verificação antiga e mesmo assim tinha 55% da espiral fora do alcance de qualquer torre possível — meio minuto por onda vendo a praga andar sem levar um tiro

- **Quem fez:** Lucca Pinto
- **Modelo:** claude-opus-5 via Anthropic, dirigido por Oh My Pi — 165,0 k tokens novos, 0 de cache, 96 chamadas, US$ 2,48
- **Custo total:** US$ 2,48 (estimado)
- **Tamanho:** 6.243 linhas de código próprio, 0,2 MB
- **Pasta:** [`games/guardrail/`](games/guardrail/README.md)

### CURVA

Seis kartódromos com relevo, nove adversários e um kart com duas personalidades: no modo de aderência ele gira 65% do que o pneu daria e não faz grampo de 10 m; com o gatilho segurado ele gira 2,4 vezes mais e carrega mini-turbo em três faixas. Derrapar vale de 1 a 6 segundos por volta, e isso não é opinião: está medido pista por pista nas provas, cada modo seguindo a linha de corrida dele.

O que tem dentro:

- Kartodromo de verdade: seis circuitos escritos como projetista escreve - reta de 120 m, curva de 175 graus com raio 11 - e o fechamento do circuito e resolvido por conta (soma de angulos 360 exatos, erro de posicao linear nas retas)
- Drift que paga: de lado o kart gira 3,7 vezes mais do que a aderencia deixa, e soltar o gatilho entrega mini-turbo em tres faixas. Medido nas seis pistas: 3,1 a 6,2 s por volta
- Servo de guinada: o chassi persegue a velocidade de giro pedida em vez de chegar nela meio segundo depois - foi o que tirou a sensacao de barco sem levantar o teto de aderencia (subir o teto foi medido e revertido: derrapar passava a CUSTAR 1,43 s por volta)
- Teto geometrico de giro: nenhum kart gira mais rapido que velocidade / raio minimo, porque o teto do pneu cresce como 1/v e a 13 km/h ele pedia 6,6 rad/s - o kart rodopiava no lugar ao apertar o gatilho na largada
- Nove adversarios com estilo de linha proprio: dez karts na mesma linha ideal viravam uma fila de batidas (146 dos 278 contatos nos primeiros 20 s), e ninguem ataca a linha com kart a menos de 6 m
- Fora da pista a IA volta dirigindo, e nao por teleporte: olhada curta (quase perpendicular quando esta longe) e teto de velocidade que cai com a distancia da borda, porque a grama da 0,64 g e a 43 km/h o raio minimo e 23 m
- Volta conta mesmo suja: contagem e cronometragem separadas, porque kart recolocado uma vez por volta nunca registrava volta - cruzava a linha duas vezes e terminava com zero
- Render 3D em WebGL2 escrito a mao - sem biblioteca, sem modelo, sem textura em disco: a fita da pista sai da mesma lista de numeros que a fisica usa
- 36 provas sem navegador, incluindo uma que carrega a casca inteira com uma tela de mentira - o arquivo que fala com a tela era o unico que nenhuma prova tocava

- **Quem fez:** Lucca Pinto
- **Modelo:** claude-opus-5 via Anthropic, dirigido por Oh My Pi — 441,0 k tokens novos, 0 de cache, 316 chamadas, US$ 5,31
- **Custo total:** US$ 5,31 (estimado)
- **Tamanho:** 4.910 linhas de código próprio, 0,3 MB
- **Pasta:** [`games/curva/`](games/curva/README.md)

### SEIVA

Dez ondas de brocas, besouros e fungos subindo o tronco em direção ao coração da árvore. Quatro torres com papéis distintos e uma regra que muda tudo: cada torre encarece a próxima do mesmo tipo, então variar sai mais barato que repetir. A regra não é enfeite temático — a simulação provou que, sem ela, espalhar a torre mais barata vencia sem custar uma vida.

O que tem dentro:

- O módulo do jogo não tem uma linha de DOM, então as dez ondas rodam em Node e o balanceamento é conferido por simulação em vez de no olho
- A simulação achou o defeito que esvaziava o jogo: espalhar 35 espinhos baratos vencia sem perder uma vida, e as outras três torres viravam enfeite
- A correção virou mecânica: cada torre encarece a próxima do mesmo tipo, e depois dela variar vale quase o dobro em corações (11/12 contra 6/12)
- Navegador e simulação foram comparados rodando a mesma estratégia, e deram resultado idêntico — uma simulação que não bate com o jogo não prova nada
- A primeira versão pintou trilha, terra e casca em marrons do mesmo valor e o tabuleiro sumia; a hierarquia de contraste foi refeita para a trilha saltar
- Zero arquivo de imagem ou de áudio: tronco, casca, torres, pragas e som saem de código

- **Quem fez:** Lucca Pinto
- **Modelo:** claude-opus-5 via Anthropic, dirigido por Claude Code — 70,0 k tokens novos, 0 de cache, 24 chamadas, US$ 1,05
- **Custo total:** US$ 1,05 (estimado)
- **Tamanho:** 1.127 linhas de código próprio, 0,1 MB
- **Pasta:** [`games/seiva/`](games/seiva/README.md)

### PROCESSO

Seu requerimento tem cinco instâncias, do atendente que diz que não é com ele até O Setor Responsável, que está fora do ar. Paciência é vida, tempo é energia, e o servidor sempre anuncia o próximo golpe. A taxa de vitória e o valor de cada carta foram medidos rodando milhares de corridas, não estimados no olho.

O que tem dentro:

- Taxa de vitória medida em milhares de corridas simuladas, não estimada: saiu de 0% para 51% depois de uma varredura de parâmetros
- O valor de cada carta foi medido forçando a escolha dela e comparando a vitória, porque contar 'carta mais escolhida' só mede a tabela de notas do robô e não o jogo
- A medição achou uma carta dominante (forçá-la subia a vitória de 40% para 70%), duas armadilhas e uma carta que nunca compensava — essa foi removida
- Um robô sem duas regras (não se defender quando dá para matar, curar quando a paciência acaba) perdeu 6 de 6 corridas; com elas, ganhou metade. O jogo tem decisão, não sorteio
- Interface em DOM e CSS, não canvas: cada carta é um button de verdade, que navega por Tab e responde a Enter sem código extra
- Zero arquivo de imagem ou de áudio: a textura de papel são duas tramas de gradiente cruzadas

- **Quem fez:** Lucca Pinto
- **Modelo:** claude-opus-5 via Anthropic, dirigido por Claude Code — 44,0 k tokens novos, 0 de cache, 22 chamadas, US$ 0,66
- **Custo total:** US$ 0,66 (estimado)
- **Tamanho:** 835 linhas de código próprio, 0,1 MB
- **Pasta:** [`games/processo/`](games/processo/README.md)

### CRIPTA

Oito salas de uma tumba soterrada, onde a caixa só é empurrada e nunca puxada, e a gravidade vale para todo mundo. Caixa sem chão cai; caixa sem saída vira degrau. Todas as salas têm solução provada por busca em largura, e as soluções encontradas são reproduzidas no jogo de verdade para confirmar.

O que tem dentro:

- Oito salas com solução provada por busca em largura, que também devolve o mínimo de jogadas de cada uma
- As soluções achadas pela busca são reproduzidas no navegador, no jogo de verdade: como é por turnos, não há timing envolvido e a prova é exata
- Na primeira rodada as dez salas eram insolúveis, e a busca expôs o porquê: não dava para subir em cima de uma caixa, o que dissolve o gênero inteiro
- Desfazer com histórico completo, porque num jogo de empurrar caixa um erro de três jogadas atrás significaria refazer a sala inteira
- A vinheta do lampião foi de 74% para 26% depois que uma captura mostrou que ela escondia metade do tabuleiro: em puzzle isso não é clima, é sabotagem
- Zero arquivo de imagem ou de áudio: pedra, madeira, lampião e som saem de código

- **Quem fez:** Lucca Pinto
- **Modelo:** claude-opus-5 via Anthropic, dirigido por Claude Code — 86,0 k tokens novos, 0 de cache, 26 chamadas, US$ 1,30
- **Custo total:** US$ 1,30 (estimado)
- **Tamanho:** 1.044 linhas de código próprio, 0,1 MB
- **Pasta:** [`games/cripta/`](games/cripta/README.md)

### A CEIA

Cinco convidados, cada um numa cadeira, com uma bebida e uma prenda. As pistas bastam, e isso não é promessa: o gerador resolve cada enigma por força bruta e exige solução única, depois tira cada pista uma por vez e exige que sem ela a solução deixe de ser única. Pista que dá para remover é pista que o jogador lê e não usa.

O que tem dentro:

- Todo enigma tem solução única provada por força bruta, e nenhuma pista sobrando: cada pista é removida uma por vez e a solução precisa deixar de ser única sem ela
- Quarenta enigmas gerados e provados no teste, todos únicos e mínimos, de 11 a 13 pistas cada
- A poda por categoria é o que faz a força bruta caber: as pistas de cadeira filtram as 120 permutações antes de a bebida entrar, e a checagem de minimalidade roda o solucionador uma vez por pista
- Errar diz em qual coluna há erro e quantas células, nunca quais: apontar a célula exata entregaria o enigma em duas tentativas
- Riscar pista já usada é caderno, não regra — não muda nada no jogo, só evita reler a mesma coisa dez vezes
- Zero arquivo de imagem ou de áudio; o módulo do enigma não tem uma linha de DOM, e é isso que permite prová-lo fora do navegador

- **Quem fez:** Lucca Pinto
- **Modelo:** claude-opus-5 via Anthropic, dirigido por Claude Code — 31,0 k tokens novos, 0 de cache, 16 chamadas, US$ 0,47
- **Custo total:** US$ 0,47 (estimado)
- **Tamanho:** 696 linhas de código próprio, 0,1 MB
- **Pasta:** [`games/ceia/`](games/ceia/README.md)

### ANTENA

A tempestade derrubou a torre de transmissão e você é a sonda de reparo. Dez torres, cada uma numa tela só, com pulo de altura variável, investida de oito direções e salto de parede. Morrer devolve ao início da torre na hora: a ideia é tentar de novo em menos de um segundo, não punir.

O que tem dentro:

- Dez torres de tela única, todas provadamente termináveis: a física não toca no DOM, então roda no Node e uma busca em feixe procura a sequência de teclas que chega na antena
- A busca pegou uma fase impossível (a primeira plataforma estava a 8 tiles do chão, e o salto sobe 3) e outra que só passava pelo motivo errado
- Os vãos são desenhados contra medidas reais, tiradas com o jogo rodando: salto alcança 3,1 tiles de altura, investida lateral vence vão de 6
- Coyote time, buffer de pulo e perdão de canto: a culpa de um salto perdido é do jogador, nunca do relógio
- Zero arquivo de imagem ou de áudio: chuva, relâmpago, metal, espinho e som saem todos de código
- Passo lógico fixo em 60 Hz, para uma fase calibrada não virar impossível num monitor de 144

- **Quem fez:** Lucca Pinto
- **Modelo:** claude-opus-5 via Anthropic, dirigido por Claude Code — 165,0 k tokens novos, 0 de cache, 48 chamadas, US$ 2,48
- **Custo total:** US$ 2,48 (estimado)
- **Tamanho:** 1.733 linhas de código próprio, 0,1 MB
- **Pasta:** [`games/antena/`](games/antena/README.md)

### ATTENTION IS ALL YOU KILL

Você é uma sessão de inferência invadindo um datacenter. Cada inimigo é um modelo real, com poder derivado dos próprios números públicos dele: a vida vem do contexto declarado, o dano do GPQA, a cadência dos tokens por segundo, o espalhamento da taxa de alucinação e o loot do preço por milhão de tokens. Descer três andares leva ao chefe THE FINE-TUNER.

O que tem dentro:

- Oito andares, cada um com paleta, plano de fundo e planta próprios: sala em cadeia, corredor central, anel em volta de uma praça e labirinto apertado
- Quatro chefes: THE FINE-TUNER, A BOLHA, O CANDIDATO e O JUIZ, com a mesma regra de ouro (corpo blindado enquanto as âncoras estiverem de pé) e ataques temáticos
- Um atributo de jogo para cada número público do modelo: contexto vira vida, GPQA vira dano, tokens por segundo viram cadência, alucinação vira espalhamento e preço por milhão vira loot
- Zero arquivo de asset: texturas desenhadas em canvas, som sintetizado em WebAudio e as logos das marcas embutidas como path data vetorial
- Cinco silhuetas distintas, uma por facção, para o jogador reconhecer o inimigo pela forma antes de ler o nome
- Manual e tutorial gerados a partir dos dados do próprio jogo, então não ficam desatualizados quando o balanceamento muda

- **Quem fez:** Lucca Pinto
- **Modelo:** deepseek-flash via DeepSeek, dirigido por Hermes Agent (Talos) — 1,9 M tokens novos, 159,1 M de cache, 656 chamadas, US$ 1,03
- **Custo total:** US$ 1,03 (medido)
- **Tamanho:** 10.709 linhas de código próprio, 2,5 MB
- **Pasta:** [`games/attention-is-all-you-kill/`](games/attention-is-all-you-kill/README.md)

---

Gerado por `tools/build.py` a partir dos `meta.json`. Não edite este arquivo à mão.
