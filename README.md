# ai-games

Jogos que fiz conversando com IA. Cada um vive numa pasta própria, autocontido e
jogável sozinho, com o modelo que escreveu e quanto custou registrados ao lado.

*Games I built by talking to AI. Each one lives in its own folder, self-contained
and playable, with the model that wrote it and what it cost recorded next to it.*

**1 jogo** até agora, 10.709 linhas de código próprio, US$ 1,03 de API no total.

## Os jogos

| Jogo | Gênero | IA | Custo | Jogar |
| --- | --- | --- | --- | --- |
| **ATTENTION IS ALL YOU KILL** [`attention-is-all-you-kill`](games/attention-is-all-you-kill/README.md) | FPS roguelike | deepseek-flash | US$ 1,03 | [jogar](games/attention-is-all-you-kill/) |

## Como este repositório se organiza

```
games/<slug>/          o jogo inteiro: código, documentação, capa e meta.json
tools/build.py         gera este README e o hub index.html
index.html             hub navegavel, também gerado
```

Cada jogo e uma pasta fechada. Não ha dependência entre eles, nem pacote
compartilhado, nem build. Você pode copiar uma pasta dessas para qualquer
servidor de arquivos estaticos e ela funciona.

### O meta.json manda

O `meta.json` dentro de cada jogo e a fonte da verdade: título, gênero, modelo
que escreveu, custo medido com os números reais da sessão, destaques e tamanho.
Este README e o `index.html` são gerados dele.

Para somar um jogo novo:

1. Crie `games/<slug>/` com o jogo dentro (o `index.html` na raiz da pasta)
2. Escreva o `meta.json` dessa pasta
3. Rode `python3 tools/build.py`

Não existe lista paralela de jogos para manter em sincronia, então o índice
nunca fica desatualizado.

### De onde vem o custo

O agente que escreve estes jogos registra o consumo de cada sessão: chamadas de
API, tokens de entrada e saída e leitura de cache. O valor no `meta.json` sai
dai, calculado com a tabela de preços do provider. E uma estimativa fiel, não a
fatura.

O número que costuma assustar e o de leitura de cache, e ele e normal: numa
sessão longa de programação, cada turno reenvia o contexto acumulado, e o cache
evita pagar preço cheio por ele outra vez. Sem cache, o custo destes jogos seria
uma ordem de grandeza maior.

## Os jogos por dentro

### ATTENTION IS ALL YOU KILL

Você é uma sessão de inferência invadindo um datacenter. Cada inimigo é um modelo real, com poder derivado dos próprios números públicos dele: a vida vem do contexto declarado, o dano do GPQA, a cadência dos tokens por segundo, o espalhamento da taxa de alucinação e o loot do preço por milhão de tokens. Descer três andares leva ao chefe THE FINE-TUNER.

O que tem dentro:

- Oito andares, cada um com paleta, plano de fundo e planta próprios: sala em cadeia, corredor central, anel em volta de uma praça e labirinto apertado
- Quatro chefes: THE FINE-TUNER, A BOLHA, O CANDIDATO e O JUIZ, com a mesma regra de ouro (corpo blindado enquanto as âncoras estiverem de pé) e ataques temáticos
- Um atributo de jogo para cada número público do modelo: contexto vira vida, GPQA vira dano, tokens por segundo viram cadência, alucinação vira espalhamento e preço por milhão vira loot
- Zero arquivo de asset: texturas desenhadas em canvas, som sintetizado em WebAudio e as logos das marcas embutidas como path data vetorial
- Cinco silhuetas distintas, uma por facção, para o jogador reconhecer o inimigo pela forma antes de ler o nome
- Manual e tutorial gerados a partir dos dados do próprio jogo, então não ficam desatualizados quando o balanceamento muda

- **Modelo:** deepseek-flash via DeepSeek
- **Agente:** Hermes Agent (Talos)
- **Custo estimado:** US$ 1,03 (656 chamadas de API, 1.893.978 tokens)
- **Tamanho:** 10.709 linhas de código próprio, 2,5 MB
- **Pasta:** [`games/attention-is-all-you-kill/`](games/attention-is-all-you-kill/README.md)

---

Gerado por `tools/build.py`. Última atualização: 10/09/2026.
