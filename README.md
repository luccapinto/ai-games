# ai-games

Um repositório coletivo de jogos feitos conversando com IA — e um benchmark do
que isso custa. Cada jogo vive numa pasta própria, autocontido e jogável sozinho,
com o modelo que escreveu, a ferramenta que dirigiu e os tokens gastos
registrados ao lado.

*A collective repo of games built by talking to AI — and a benchmark of what that
costs. Each game is a self-contained, playable folder that records the model that
wrote it, the agent that drove it, and the tokens it burned.*

**2 jogos** de **1 pessoa**, 11.544 linhas de código,
1,9 M tokens novos e US$ 1,69 de API no total.

👉 **[Jogar tudo](https://luccapinto.github.io/ai-games/)** · **[Ver o benchmark](https://luccapinto.github.io/ai-games/benchmark.html)** · **[Mandar o seu jogo](CONTRIBUTING.md)**

## Os jogos

| Jogo | Gênero | Quem fez | Modelo | Tokens novos | Custo | Jogar |
| --- | --- | --- | --- | --- | --- | --- |
| **PROCESSO** [`processo`](games/processo/README.md) | Cartas com construção de baralho | Lucca Pinto | claude-opus-5 | 44,0 k | US$ 0,66 | [jogar](https://luccapinto.github.io/ai-games/games/processo/) |
| **ATTENTION IS ALL YOU KILL** [`attention-is-all-you-kill`](games/attention-is-all-you-kill/README.md) | FPS roguelike | Lucca Pinto | deepseek-flash | 1,9 M | US$ 1,03 | [jogar](https://luccapinto.github.io/ai-games/games/attention-is-all-you-kill/) |

## O benchmark

| Modelo | Jogos | Tokens novos | Cache | Custo | Linhas |
| --- | --- | --- | --- | --- | --- |
| deepseek-flash | 1 | 1,9 M | 159,1 M | US$ 1,03 | 10.709 |
| claude-opus-5 | 1 | 44,0 k | 0 | US$ 0,66 | 835 |

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
