# ai-games

Jogos que fiz conversando com IA. Cada um vive numa pasta propria, autocontido e
jogavel sozinho, com o modelo que escreveu e quanto custou registrados ao lado.

*Games I built by talking to AI. Each one lives in its own folder, self-contained
and playable, with the model that wrote it and what it cost recorded next to it.*

**1 jogo** ate agora, 7.653 linhas de codigo proprio, US$ 0,90 de API no total.

## Os jogos

| Jogo | Genero | IA | Custo | Jogar |
| --- | --- | --- | --- | --- |
| **ATTENTION IS ALL YOU KILL** [`attention-is-all-you-kill`](games/attention-is-all-you-kill/README.md) | FPS roguelike | deepseek-flash | US$ 0,90 | [jogar](games/attention-is-all-you-kill/) |

## Como este repositorio se organiza

```
games/<slug>/          o jogo inteiro: codigo, documentacao, capa e meta.json
tools/build.py         gera este README e o hub index.html
index.html             hub navegavel, tambem gerado
```

Cada jogo e uma pasta fechada. Nao ha dependencia entre eles, nem pacote
compartilhado, nem build. Voce pode copiar uma pasta dessas para qualquer
servidor de arquivos estaticos e ela funciona.

### O meta.json manda

O `meta.json` dentro de cada jogo e a fonte da verdade: titulo, genero, modelo
que escreveu, custo medido com os numeros reais da sessao, destaques e tamanho.
Este README e o `index.html` sao gerados dele.

Para somar um jogo novo:

1. Crie `games/<slug>/` com o jogo dentro (o `index.html` na raiz da pasta)
2. Escreva o `meta.json` dessa pasta
3. Rode `python3 tools/build.py`

Nao existe lista paralela de jogos para manter em sincronia, entao o indice
nunca fica desatualizado.

### De onde vem o custo

O agente que escreve estes jogos registra o consumo de cada sessao: chamadas de
API, tokens de entrada e saida e leitura de cache. O valor no `meta.json` sai
dai, calculado com a tabela de precos do provider. E uma estimativa fiel, nao a
fatura.

O numero que costuma assustar e o de leitura de cache, e ele e normal: numa
sessao longa de programacao, cada turno reenvia o contexto acumulado, e o cache
evita pagar preco cheio por ele outra vez. Sem cache, o custo destes jogos seria
uma ordem de grandeza maior.

## Os jogos por dentro

### ATTENTION IS ALL YOU KILL

Voce e uma sessao de inferencia invadindo um datacenter. Cada inimigo e um modelo real, com poder derivado dos proprios numeros publicos dele: a vida vem do contexto declarado, o dano do GPQA, a cadencia dos tokens por segundo, o espalhamento da taxa de alucinacao e o loot do preco por milhao de tokens. Descer tres andares leva ao chefe THE FINE-TUNER.

O que tem dentro:

- Um atributo de jogo para cada numero publico do modelo: contexto vira vida, GPQA vira dano, tokens por segundo viram cadencia, alucinacao vira espalhamento e preco por milhao vira loot
- Zero arquivo de asset: texturas desenhadas em canvas, som sintetizado em WebAudio e as logos das marcas embutidas como path data vetorial
- Cinco silhuetas distintas, uma por faccao, para o jogador reconhecer o inimigo pela forma antes de ler o nome
- Chefe THE FINE-TUNER com ancoras destrutiveis, janelas de vulnerabilidade e leque telegrafado
- Manual e tutorial gerados a partir dos dados do proprio jogo, entao nao ficam desatualizados quando o balanceamento muda
- Publicado sem abrir porta nenhuma: nginx local atras de tunel Cloudflare

- **Modelo:** deepseek-flash via DeepSeek
- **Agente:** Hermes Agent (Talos)
- **Custo estimado:** US$ 0,90 (555 chamadas de API, 1.621.165 tokens)
- **Tamanho:** 7.653 linhas de codigo proprio, 2,5 MB
- **Pasta:** [`games/attention-is-all-you-kill/`](games/attention-is-all-you-kill/README.md)

---

Gerado por `tools/build.py`. Ultima atualizacao: 10/09/2026.
