# O design do site

Este documento é o contrato visual e estrutural das páginas que o
[`tools/build.py`](../tools/build.py) gera. Ele existe para que uma mudança de
layout não vire uma discussão de gosto a cada PR, e para que quem mexer no
gerador saiba o que pode quebrar sem aparecer.

## Para que o site serve

É uma **vitrine do que a IA está conseguindo construir**, não um relatório de
avaliação de modelos. A ordem de prioridade é:

1. A pessoa quer **ver e jogar** os jogos. Tudo roda no navegador, sem instalar.
2. A pessoa quer **mandar o jogo dela**. Isso vem de graça: um site que dá
   vontade de visitar atrai quem cria com IA.
3. Modelo e custo são **tempero**, não a tese. O que se quer provocar é
   "caraca, isso aqui custou um dólar", não uma tabela de ranking.

O terceiro item é o que dá sentido de comparação aos outros dois. Comparar
jogos entre si não diz nada sozinho: um jogo pode estar melhor porque o modelo
era melhor, ou porque a pessoa iterou dez vezes mais. Modelo, tokens e custo
lado a lado é o que separa as duas coisas. É por isso que eles aparecem em todo
card — e é por isso que eles não dominam nenhuma página a não ser o benchmark.

## Direção visual

Fundo quase preto, monoespaçada, neon. É a mesma família do
ATTENTION IS ALL YOU KILL — terminal, datacenter, máquina.

### Tokens

| token | valor | papel |
| --- | --- | --- |
| `--bg` | `#05070d` | fundo da página |
| `--painel` | `#0a1018` | fundo de card e de tabela |
| `--linha` | `#1b2c38` | borda e divisória |
| `--ink` | `#d8e6e4` | texto principal |
| `--muted` | `#6f8b88` | rótulo, texto secundário |
| `--neon` | `#35f0d8` | ação: JOGAR, link, foco |
| `--ambar` | `#ffb347` | número: custo, tokens, agregados |

A regra de uso que mantém a página legível: **neon é ação, âmbar é número.**
Neon em texto que não é clicável ensina a pessoa a ignorar o neon, e aí o botão
JOGAR perde força.

### Tipografia

**Monoespaçada em tudo.** Não há segunda família e não há fonte vendorizada.

A tentação era trazer uma fonte de display para os títulos, porque mono em
corpo pequeno tem cara de site de desenvolvedor. A decisão foi não: a identidade
escolhida é essa, um binário de fonte no repositório contraria o espírito do
projeto (nada de asset, nada de build, nada de CDN) e fonte que falha ao carregar
troca um problema de acabamento por um de layout pulando na cara da pessoa.

O acabamento vem de escala e espaçamento, não de outra fonte:

- Título de página: `clamp(34px, 7vw, 64px)`, peso 700, `letter-spacing: -1.5px`.
  Mono grande e apertada lê como deliberada; mono pequena é que lê como terminal.
- Texto corrido: mínimo 15px com `line-height: 1.6`. Abaixo disso o mono cansa.
- Rótulo: 10px, `letter-spacing: 2px`, maiúsculas, cor `--muted`.
- Número: `font-variant-numeric: tabular-nums` sempre. Em tabela e em card, para
  os dígitos alinharem entre linhas.

## As três páginas

### `index.html` — a home

```
cabeçalho   marca, título, tese em uma frase
            números agregados: jogos · modelos · custo total
            navegação: mandar o seu, benchmark, dados, código
grade       1 coluna no celular, 2 até 1000px, 3 acima
            um card por jogo + o card de contribuição, sempre por último
rodapé
```

Os números agregados ficam no topo porque é ali que "tudo isso por US$ 1,03"
funciona como gancho. Eles são três, não oito: a lista completa é o benchmark.

**O card de contribuição é membro permanente da grade**, com borda tracejada e o
mesmo tamanho dos outros. Não é um caso especial de quando há poucos jogos.

Isso resolve o pior caso da grade uniforme. Com um jogo só, uma grade de um item
parece site abandonado; com o card de convite ao lado, são duas células e a
grade se justifica. Com doze jogos ele continua no fim, virando o convite a
contribuir sem ocupar espaço nobre. Um elemento só resolve as duas pontas.

### `jogos/<slug>.html` — a página do jogo

**Não pode ser `games/<slug>/index.html`: esse arquivo é o jogo.** A página de
apresentação mora em `jogos/<slug>.html`, na raiz, e é ela que se manda para
alguém que ainda não decidiu jogar.

```
prévia grande (ou capa), título, gênero, autoria
JOGAR em destaque
resumo
destaques
ficha: modelo, agente, tokens novos, cache, custo, linhas, licença
arquivos-chave, se o meta.json trouxer
links: jogar, como foi feito (README), repositório
```

É aqui que mora o detalhe que não cabe no card da grade.

### `benchmark.html` — os números

Mantém o papel de hoje: tabela por jogo, tabela agregada por modelo e por
agente, ordenadas por tokens novos, com o cache ao lado e nunca somado. Herda os
tokens e a tipografia; não ganha tratamento próprio.

## O card de jogo

```
prévia (ou capa) · título · gênero · chip do modelo · chip do custo · JOGAR
```

O chip é a unidade que carrega o tempero: modelo em neon-borda, custo em
âmbar-borda, ambos pequenos. Um card não mostra mais que dois chips — tokens e
linhas ficam para a página do jogo.

### A prévia animada

Campo novo e **opcional** no `meta.json`. Um card sem prévia usa a capa estática
e não fica pior que hoje.

- Formatos aceitos: `.webp` animado, `.gif`, `.mp4`, `.webm`.
- Sempre **muda**, em **loop**, **sem controles** e **sem áudio**.
- Toca ao entrar na tela (`IntersectionObserver`), não no carregamento da
  página: uma grade com doze vídeos tocando ao mesmo tempo derruba o celular.
- `prefers-reduced-motion: reduce` congela na capa estática. Não é enfeite de
  acessibilidade: é o que evita enjoar quem tem sensibilidade a movimento numa
  página que é uma grade inteira de coisa se mexendo.
- **Quem tem prévia precisa ter capa**, porque a capa é o fallback, é o cartão de
  compartilhamento e é o que aparece antes do vídeo decodificar.

## O que muda no contrato

Um campo novo em `meta.json`:

```json
"previa": "previa.webp"
```

| campo | obrigatório | o que é |
| --- | --- | --- |
| `previa` | não | Nome do arquivo **dentro da pasta do jogo**. Vazio = usa a capa |

Regras que o validador passa a cobrar quando o campo vier preenchido:

**Erro** (barra o merge, porque gera página quebrada):

- a extensão está fora da lista aceita;
- o arquivo não existe na pasta do jogo;
- o jogo tem `previa` mas não tem `capa`. A capa é o fallback, o que aparece
  antes do vídeo decodificar e o que vai no cartão de compartilhamento — uma
  prévia sem capa é uma página que pisca vazia. Sem `previa`, a `capa` segue
  apenas recomendada, como está no [`ESQUEMA.md`](ESQUEMA.md).

**Aviso** (aparece no log, não barra):

- o arquivo passa de **4 MB**. Quem entra pelo celular paga essa conta, mas
  recusar um PR por 300 KB de excesso custa mais contribuição do que ganha.

A chave é ASCII (`previa`, nunca `prévia`), como todas as outras. Esta regra já
quebrou o repositório duas vezes e o sintoma é silencioso: o jogo some do índice.

## Como o gerador muda

O `build.py` já tem a camada compartilhada certa: uma constante `CSS`, um
`cabecalho_html()`, um `RODAPE_HTML`, helpers como `bloco_numeros()`. **Não se
extrai folha de estilo para `assets/`**: cada arquivo gerado abre sozinho, sem
depender de outro arquivo, e essa propriedade vale mais que o cache do navegador
entre páginas. Um CSS externo também traria caminho relativo diferente por
página (`jogos/<slug>.html` está um nível abaixo), que é exatamente o tipo de
coisa que quebra calada.

O que entra:

1. `CSS` cresce com os componentes novos: grade, card, chip, prévia, card de
   contribuição, página de jogo. Continua **string pura, nunca f-string** — o
   comentário que explica isso fica onde está.
2. `cabecalho_html()` ganha um parâmetro de **prefixo relativo**, porque
   `jogos/<slug>.html` precisa de `../` para chegar em `games/` e na home.
3. Função nova `gerar_pagina_jogo()`, uma página por jogo.
4. `gerar_hub()` vira a grade.
5. `_conferir_css_ascii()` deixa de rodar só dentro da geração de cada página e
   passa a ser uma checagem explícita sobre **todas** as páginas geradas.
6. `esquema.py` normaliza `previa`; `validar.py` confere arquivo e peso;
   `novo_jogo.py` cria o campo vazio; `ESQUEMA.md` e `CONTRIBUTING.md`
   documentam.

## O que não muda

Invariantes. Quebrar qualquer um destes é regressão, não redesign:

- **Todo arquivo gerado é commitado.** É assim que o Pages publica.
- **Nenhuma dependência externa.** Sem CDN, sem build, sem npm. O `build.py` é
  stdlib.
- **O jogo abre pela pasta dele**, sem servidor. O botão JOGAR aponta para
  dentro do repositório, nunca para um endereço externo.
- **Código em ASCII, texto acentuado.** Nome de variável, seletor CSS, at-rule e
  caminho de import sem acento; comentário e string com acento.
- **Chave de JSON em ASCII.**
- O site funciona **sem JavaScript**: sem JS a prévia não toca e a capa fica no
  lugar. Nada além disso se perde — nem navegação, nem o botão de jogar.

## Verificação

```
python3 tools/validar.py --rigoroso
python3 tools/build.py --conferir
python3 tools/verificar.py
```

Mexeu em `meta.json`, rode `python3 tools/build.py` antes de commitar, senão a
CI reprova por índice desatualizado.
