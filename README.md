# ai-games

Um repositório coletivo de jogos feitos conversando com IA — e um benchmark do
que isso custa. Cada jogo vive numa pasta própria, autocontido e jogável sozinho,
com o modelo que escreveu, a ferramenta que dirigiu e os tokens gastos
registrados ao lado.

*A collective repo of games built by talking to AI — and a benchmark of what that
costs. Each game is a self-contained, playable folder that records the model that
wrote it, the agent that drove it, and the tokens it burned.*

**4 jogos** de **1 pessoa**, 14.613 linhas de código,
2,2 M tokens novos e US$ 5,86 de API no total.

👉 **[Jogar tudo](https://luccapinto.github.io/ai-games/)** · **[Ver o benchmark](https://luccapinto.github.io/ai-games/benchmark.html)** · **[Mandar o seu jogo](CONTRIBUTING.md)**

## Os jogos

| Jogo | Gênero | Quem fez | Modelo | Tokens novos | Custo | Jogar |
| --- | --- | --- | --- | --- | --- | --- |
| **SEIVA** [`seiva`](games/seiva/README.md) | Defesa de torre | Lucca Pinto | claude-opus-5 | 70,0 k | US$ 1,05 | [jogar](https://luccapinto.github.io/ai-games/games/seiva/) |
| **CRIPTA** [`cripta`](games/cripta/README.md) | Puzzle | Lucca Pinto | claude-opus-5 | 86,0 k | US$ 1,30 | [jogar](https://luccapinto.github.io/ai-games/games/cripta/) |
| **ANTENA** [`antena`](games/antena/README.md) | Plataforma de precisão | Lucca Pinto | claude-opus-5 | 165,0 k | US$ 2,48 | [jogar](https://luccapinto.github.io/ai-games/games/antena/) |
| **ATTENTION IS ALL YOU KILL** [`attention-is-all-you-kill`](games/attention-is-all-you-kill/README.md) | FPS roguelike | Lucca Pinto | deepseek-flash | 1,9 M | US$ 1,03 | [jogar](https://luccapinto.github.io/ai-games/games/attention-is-all-you-kill/) |

## O benchmark

| Modelo | Jogos | Tokens novos | Cache | Custo | Linhas |
| --- | --- | --- | --- | --- | --- |
| claude-opus-5 | 3 | 321,0 k | 0 | US$ 4,83 | 3.904 |
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
