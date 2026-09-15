# O `meta.json`, campo a campo

Cada jogo tem um `games/<slug>/meta.json`. Ele é a única fonte da verdade do
repositório: o `README.md`, o `index.html`, o `benchmark.html` e os arquivos de
`dados/` são gerados dele por `tools/build.py`. Não existe lista paralela de
jogos, então nada fica desatualizado — e nada entra no índice sem passar por
`tools/validar.py`.

O contrato em código está em [`tools/esquema.py`](../tools/esquema.py). Este
documento é a versão legível dele.

## Duas regras que valem para o arquivo inteiro

**Chave é ASCII, valor leva acento.** `"licenca"`, nunca `"licença"`; mas
`"resumo": "Você é uma sessão..."` está certo. Chave acentuada não quebra o JSON
— quebra quem lê, e o jogo some do índice sem erro nenhum. Já aconteceu duas
vezes aqui. O validador reprova.

**Campo vazio é melhor que campo inventado.** Se você não mediu, não chute um
número bonito: deixe em branco e marque `medicao.confianca` como `parcial`. Aviso
no validador é barato; número falso no benchmark contamina a tabela de todo mundo.

## Identidade

| Campo | Obrigatório | O que é |
| --- | --- | --- |
| `slug` | sim | Igual ao nome da pasta: minúscula-com-hífen, sem acento |
| `titulo` | sim | Como o jogo aparece no hub |
| `subtitulo` | não | Uma linha abaixo do título |
| `genero` | recomendado | Texto livre: `Plataforma`, `FPS roguelike`, `Puzzle` |
| `plataforma` | não | Onde roda: `Navegador`, `Navegador, desktop e celular` |
| `estado` | sim | `jogavel`, `prototipo` ou `em-progresso` |
| `criado` | sim | `AAAA-MM-DD` |
| `licenca` | sim | `MIT`, `CC BY 4.0`, `GPL-3.0`... A do seu jogo, não a do repo |
| `resumo` | sim | Dois ou três períodos. É o texto do cartão no hub |
| `capa` | recomendado | Nome do arquivo de imagem **dentro da pasta**: `capa.jpg` |
| `espelho` | não | URL onde você também publicou. Entra como link secundário |
| `repo` | não | URL do repositório do jogo, se ele também mora fora daqui |

`estado` é sobre o que a pessoa encontra ao clicar em JOGAR, não sobre a
maturidade do código. `prototipo` é uma coisa legítima de se mandar.

## Autoria

```json
"autores": [
  { "nome": "Seu Nome", "github": "seu-usuario", "site": "https://seu.site" }
]
```

`nome` é obrigatório; `github` e `site` são opcionais. Mais de uma pessoa? Mais
de uma entrada. Um atalho aceito: `"autores": ["seu-usuario"]` vira
`{nome, github}` com o mesmo valor.

## A parte que é o benchmark

`ia` é uma **lista**, uma entrada por modelo que trabalhou no jogo.

```json
"ia": [
  {
    "modelo": "claude-opus-5",
    "provider": "Anthropic",
    "agente": "Claude Code",
    "papel": "arquitetura e render",
    "chamadas_api": 212,
    "tokens": {
      "entrada": 840000,
      "saida": 190000,
      "cache_leitura": 12400000,
      "cache_escrita": 310000
    },
    "usd_estimado": 4.18
  }
]
```

| Campo | Obrigatório | O que é |
| --- | --- | --- |
| `modelo` | sim | O identificador, não o apelido: `claude-opus-5`, `gpt-5`, `deepseek-flash` |
| `provider` | recomendado | Quem serviu: `Anthropic`, `OpenAI`, `OpenRouter`, `local` |
| `agente` | recomendado | A ferramenta que dirigiu: `Claude Code`, `Cursor`, `aider`, `chat no site` |
| `papel` | não | O que esse modelo fez, quando houve mais de um |
| `chamadas_api` | não | Quantas requisições |
| `tokens.entrada` | sim | Prompt tokens que **não** vieram do cache |
| `tokens.saida` | sim | O que o modelo gerou |
| `tokens.cache_leitura` | não | Contexto relido do cache. Normalmente o maior número |
| `tokens.cache_escrita` | não | Contexto gravado no cache |
| `usd_estimado` | recomendado | O custo em dólar, pela tabela do provider |

Só `modelo` e os tokens de entrada/saída são obrigatórios — o resto melhora o
benchmark, mas ninguém fica de fora por não ter.

**Por que entrada e cache são campos separados.** O benchmark ordena por *tokens
novos* (entrada + saída) e mostra cache numa coluna ao lado. Quanto do contexto
vira leitura barata de cache é decisão da ferramenta, não do trabalho que o
modelo fez: somar os dois num número só compara agentes, não jogos. Se a sua
ferramenta não separa, ponha tudo em `entrada` e diga isso em `medicao.metodo`.

Tudo isso também aceita número como texto: `"1.294.216"` e `"1294216"` dão no
mesmo, e `"US$ 4,18"` vira `4.18`. Copiar e colar do painel da ferramenta
funciona.

## De onde veio o número

```json
"medicao": {
  "confianca": "medido",
  "metodo": "/cost do Claude Code ao fim de cada sessão",
  "medido_em": "2026-09-15",
  "nota": "Duas sessões perdidas antes de eu começar a anotar."
}
```

| `confianca` | Quando usar |
| --- | --- |
| `medido` | O número saiu da contabilidade da própria ferramenta ou do painel do provider |
| `estimado` | Você reconstruiu: contou sessões, multiplicou por preço, olhou a fatura |
| `parcial` | Só parte das sessões está contada. Diga o que faltou em `nota` |

`confianca` é obrigatório. `metodo` é o que permite outra pessoa repetir a sua
medição — [`docs/CUSTOS.md`](CUSTOS.md) tem a receita por ferramenta.

Ninguém audita a declaração de ninguém. O que o repositório garante é que ela
está escrita, datada e versionada ao lado do código.

## Tamanho e vitrine

```json
"tamanho": { "linhas_proprias": 2400, "mb": 0.8, "modulos_js": 12 },
"stack": ["JavaScript", "Canvas 2D"],
"destaques": ["três frases sobre o que tem de interessante dentro"],
"arquivos_chave": [
  { "caminho": "js/mundo.js", "papel": "geração do nível" }
]
```

`linhas_proprias` **não conta `vendor/`**: é o que a IA e você escreveram. Para
contar:

```bash
find games/meu-jogo -name '*.js' -o -name '*.html' -o -name '*.css' \
  | grep -v vendor | xargs wc -l | tail -1
```

Os três primeiros `destaques` aparecem no cartão do hub. `arquivos_chave` é o
mapa para quem for ler o código — o validador avisa se apontar para arquivo que
não existe.

## O formato antigo continua valendo

Jogo escrito antes deste esquema usava `ia` como objeto único e um `custo` ao
lado:

```json
"ia": { "modelo": "x", "provider": "y" },
"custo": { "usd_estimado": 1.03, "tokens_entrada": 100, "tokens_saida": 50 }
```

`tools/esquema.py` traduz isso para o formato novo na leitura, então nenhum jogo
antigo precisa ser reescrito para o índice continuar de pé. Para jogo novo, use
o formato em lista: ele é o único que sabe representar mais de um modelo.

## Como o benchmark agrega

A unidade somada é a **entrada de IA**, não o jogo. Um jogo escrito por dois
modelos entra uma vez em cada grupo, com os tokens que cada um gastou — por isso
a soma da coluna "jogos" por modelo pode passar do total de jogos do repositório.

A exceção é `linhas`: linha de código pertence ao jogo, e não dá para saber qual
modelo escreveu qual linha. Quando dois modelos trabalharam no mesmo jogo, o
total de linhas conta para os dois, e a coluna quer dizer "linhas dos jogos em
que este modelo trabalhou". No CSV isso fica explícito na coluna
`linhas_do_jogo`, que se repete entre as linhas do mesmo jogo — somar essa coluna
direto conta o mesmo código duas vezes.
