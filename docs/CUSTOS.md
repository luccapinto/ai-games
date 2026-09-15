# Como medir os tokens do seu jogo

O benchmark deste repositório vale exatamente o quanto os números dele forem
honestos. Este documento é a receita: onde cada ferramenta guarda o consumo, como
preencher o `meta.json` com isso, e o que fazer quando não dá para medir direito.

Regra única: **declare o que aconteceu, não o que ficaria bonito na tabela.**
Ninguém está competindo aqui. Um jogo que custou US$ 40 e quase não saiu é um
ponto de dado melhor do que um US$ 3 inventado.

## Os quatro números

```json
"tokens": {
  "entrada": 840000,
  "saida": 190000,
  "cache_leitura": 12400000,
  "cache_escrita": 310000
}
```

| Campo | O que é |
| --- | --- |
| `entrada` | Prompt tokens cobrados a preço cheio — o que **não** veio do cache |
| `saida` | O que o modelo gerou |
| `cache_leitura` | Contexto relido do cache, cobrado a uma fração do preço |
| `cache_escrita` | Contexto gravado no cache, cobrado com um pequeno prêmio |

**A pegadinha que pega todo mundo:** na API da Anthropic, `input_tokens` é só o
resto não-cacheado. O prompt inteiro é
`input_tokens + cache_creation_input_tokens + cache_read_input_tokens`. Se você
somar tudo em `entrada`, o seu jogo aparece no benchmark como se tivesse gasto
dez vezes mais token caro do que gastou. Cada número no seu campo.

O benchmark ordena por **tokens novos** (`entrada + saida`) e mostra cache numa
coluna separada — quanto do contexto vira leitura barata é decisão da ferramenta,
não medida do trabalho. Se a sua ferramenta não separa cache, ponha tudo em
`entrada` e escreva isso em `medicao.metodo`.

## Por ferramenta

As interfaces mudam. Se o que está aqui não bater com o que você vê, confie no
que você vê, e mande um PR corrigindo esta página.

### Claude Code

`/cost` no fim de cada sessão mostra o consumo daquela sessão. Em plano por
assinatura ele indica que o uso está incluído, sem valor em dólar — nesse caso
declare os tokens, ponha `usd_estimado` calculado pela tabela de preços do
modelo, e marque `medicao.confianca` como `estimado`.

O detalhe que estraga a conta: `/cost` é **por sessão**. Um jogo leva várias.
Anote ao fim de cada uma e some, ou marque `parcial` e diga quantas sessões
ficaram de fora.

### API da Anthropic, direto

Cada resposta traz `usage`, e o mapeamento é direto:

| Campo da API | Campo do `meta.json` |
| --- | --- |
| `usage.input_tokens` | `tokens.entrada` |
| `usage.output_tokens` | `tokens.saida` |
| `usage.cache_read_input_tokens` | `tokens.cache_leitura` |
| `usage.cache_creation_input_tokens` | `tokens.cache_escrita` |

Acumule os quatro ao longo da sessão. Esse caso é `medido` — é a própria
contabilidade da chamada.

### API da OpenAI, direto

`usage.prompt_tokens` vai para `entrada`,`usage.completion_tokens` para `saida`,
e `usage.prompt_tokens_details.cached_tokens` para `cache_leitura`. Atenção: ali
`prompt_tokens` costuma **incluir** os cacheados, então subtraia antes de
preencher `entrada`, ou você conta duas vezes.

### OpenRouter

A página de atividade lista tokens e custo por requisição, com exportação.
É a fonte mais fácil de tratar como `medido`, porque já vem somada e em dólar.

### Cursor, Copilot e afins

Ferramenta de assinatura costuma expor **requisições**, não tokens. Nesse caso:

- preencha `chamadas_api` com o que você tem
- estime os tokens, ou deixe o que não souber em zero
- marque `medicao.confianca` como `estimado` ou `parcial`
- explique em `medicao.metodo`: *"Cursor não expõe tokens; contei 180 requisições
  no painel e estimei 6k de entrada por requisição"*

Declaração honesta e incompleta vale mais que número preciso e falso. O benchmark
mostra o selo de medição ao lado de cada linha justamente para isso.

### aider

Imprime tokens enviados/recebidos e custo por mensagem e acumulado na sessão.
Anote o acumulado no fim.

### Modelo local (Ollama, llama.cpp)

Os tokens estão no log do servidor. O custo em dólar é zero: ponha
`usd_estimado: 0` e diga em `medicao.nota` em que máquina rodou — para um
benchmark de custo, "de graça num Mac mini" é informação, não ausência dela.

## Calcular o dólar

Se a ferramenta dá tokens mas não dá custo:

```
usd = (entrada        / 1e6) * preco_entrada
    + (saida          / 1e6) * preco_saida
    + (cache_leitura  / 1e6) * preco_cache_leitura
    + (cache_escrita  / 1e6) * preco_cache_escrita
```

Os preços estão na página do provider. Cache de leitura costuma custar uma fração
pequena da entrada, e cache de escrita um pouco mais que a entrada — usar o preço
de entrada para tudo infla bastante a conta, porque o cache costuma ser o maior
volume.

Isso é `estimado`, não `medido`: é a tabela de preços, não a fatura.

## Quando você não mediu nada

Acontece: o jogo ficou pronto e só depois você descobriu este repositório.
Não invente, e não desista de mandar o jogo. Faça assim:

```json
"medicao": {
  "confianca": "parcial",
  "metodo": "Reconstruído do histórico: 3 sessões de ~2h. Tokens estimados pela média de sessões parecidas; as duas primeiras semanas não estão contadas.",
  "medido_em": "2026-09-15"
}
```

O jogo entra no hub e a linha dele aparece no benchmark com o selo `parcial`.
Quem for analisar os dados filtra por `confianca` se quiser só o que foi medido —
a coluna existe no CSV e no JSON exatamente para isso.

## O que este benchmark não mede

Vale escrever, porque tabela tem um jeito de parecer mais científica do que é:

- **Não é controlado.** Jogos diferentes, pessoas diferentes, ambições
  diferentes. Um Pong e um roguelike 3D na mesma coluna não são comparáveis.
- **Linha de código não é qualidade.** `linhas/US$` mede escala, não valor. Um
  modelo que escreve pouco e bom perde nessa coluna para um que despeja código.
- **A habilidade de quem dirige pesa.** Metade do resultado é o modelo, metade é
  quem soube pedir, testar e apontar o erro. Isso não tem coluna.
- **Ninguém audita.** O que o repositório garante é que a declaração está
  escrita, datada, assinada e versionada junto do código que ela descreve.

O que ele mede, e quase nenhum eval mede: **a ordem de grandeza real de levar uma
coisa que funciona até o fim, conversando com um modelo.** Um jogo tem um juiz
honesto no final — ou dá para jogar, ou não dá. Está tudo a um clique de
distância para qualquer um conferir.
