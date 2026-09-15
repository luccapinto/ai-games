# Como mandar o seu jogo

Este repositório é coletivo e é um benchmark ao mesmo tempo. Cada jogo que entra
traz junto um registro honesto de **qual modelo escreveu, qual ferramenta
dirigiu e quantos tokens custou** — e é a soma desses registros que vira a
[tabela do benchmark](https://luccapinto.github.io/ai-games/benchmark.html).

Não precisa pedir permissão. Faça o jogo, preencha a ficha, abra o PR.

## O caminho curto

```bash
git clone https://github.com/luccapinto/ai-games && cd ai-games
python3 tools/novo_jogo.py meu-jogo --autor "Seu Nome" --github seu-usuario

# a pasta já abre no navegador: games/meu-jogo/index.html
# agora faça o seu jogo conversando com o modelo que quiser

python3 tools/validar.py meu-jogo   # a mesma checagem que a CI roda
python3 tools/build.py              # regenera README, hub, benchmark e dados
git checkout -b meu-jogo && git add . && git commit -m "feat: meu-jogo"
git push -u origin meu-jogo
```

Depois é abrir o PR. Só precisa de Python 3 — sem `pip install`, sem Node, sem
build.

## As quatro regras

**1. O jogo roda abrindo a pasta.** Um `games/<slug>/index.html` que funciona em
navegador, sem etapa de build e sem servidor obrigatório. Dependência vem
vendorizada dentro da pasta (`vendor/`), não de CDN — o jogo precisa continuar
jogável daqui a três anos, com o CDN fora do ar e você sem tempo de consertar.

**2. A pasta é fechada.** Nada de importar de outro jogo, nem de pacote
compartilhado na raiz. Deve ser possível copiar `games/<slug>/` para qualquer
servidor estático e funcionar. Isso é o que mantém o repositório sem build e sem
conflito entre contribuições.

**3. Os números são honestos.** Declare o que o modelo realmente gastou, mesmo
que seja alto, mesmo que você tenha desistido no meio e trocado de modelo.
Benchmark com número maquiado não serve para nada — e ninguém está competindo
aqui. Se não conseguir medir com precisão, marque `medicao.confianca` como
`estimado` ou `parcial` e diga em `medicao.metodo` de onde veio o número.
[Como medir em cada ferramenta](docs/CUSTOS.md).

**4. O jogo é seu para publicar.** Código próprio ou com licença compatível.
Nada de asset pirateado, sprite rasgado de jogo comercial, trilha de terceiro sem
permissão. Declare a licença em `licenca` — se não tiver preferência, `MIT`.

## O `meta.json`

É a ficha do jogo e a única fonte da verdade: o README, o hub, o benchmark e os
arquivos de `dados/` são **gerados** a partir dele. Ninguém edita lista de jogos
a mão, então o índice nunca fica desatualizado.

O essencial:

```json
{
  "slug": "meu-jogo",
  "titulo": "MEU JOGO",
  "genero": "Plataforma",
  "estado": "jogavel",
  "criado": "2026-09-15",
  "licenca": "MIT",
  "resumo": "Duas ou três linhas sobre o que o jogo é. Aparece no cartão do hub.",
  "autores": [{ "nome": "Seu Nome", "github": "seu-usuario" }],
  "ia": [
    {
      "modelo": "claude-opus-5",
      "provider": "Anthropic",
      "agente": "Claude Code",
      "papel": "o jogo inteiro",
      "chamadas_api": 212,
      "tokens": {
        "entrada": 840000,
        "saida": 190000,
        "cache_leitura": 12400000,
        "cache_escrita": 310000
      },
      "usd_estimado": 4.18
    }
  ],
  "medicao": {
    "confianca": "medido",
    "metodo": "/cost do Claude Code ao fim de cada sessão",
    "medido_em": "2026-09-15"
  },
  "tamanho": { "linhas_proprias": 2400, "mb": 0.8 },
  "destaques": ["três frases sobre o que tem de interessante dentro"]
}
```

Usou mais de um modelo? `ia` é uma lista: ponha uma entrada para cada, com os
tokens de cada um. É assim que o benchmark consegue dizer que um jogo custou
X em Claude e Y em GPT.

A referência campo a campo está em [`docs/ESQUEMA.md`](docs/ESQUEMA.md).
Uma regra que pega todo mundo: **chave de JSON é ASCII** (`licenca`, não
`licença`). Valor leva acento à vontade — o validador reclama se você trocar.

## O que a CI confere

Todo PR passa por `python3 tools/validar.py` e `python3 tools/build.py
--conferir`. Em português:

- o `meta.json` tem tudo que o índice precisa e nada torto
- o jogo tem mesmo um `index.html`, e a capa que ele declara existe
- os tokens estão preenchidos (é o que faz do repositório um benchmark)
- o README, o hub e os dados foram regenerados depois da sua mudança

Se esquecer de rodar `python3 tools/build.py`, a CI avisa em vez de deixar o
índice entrar desatualizado.

Erro barra o merge; aviso só aparece no log e não bloqueia nada — falta de capa
ou de destaques não impede o seu jogo de entrar. Para ver os avisos também, rode
`python3 tools/validar.py --rigoroso` na sua máquina.

## O que faz um bom PR

Um jogo, um PR. Não mexa em jogo de outra pessoa no mesmo PR que traz o seu.

Vale mandar jogo pequeno: um Pong feito numa tarde com um modelo pequeno é um
ponto de dado tão útil quanto um roguelike de dez mil linhas — e mais raro na
tabela. Vale mandar jogo que deu errado, desde que ele abra e rode: um protótipo
marcado como `"estado": "prototipo"`, com o custo real do que foi gasto até
desistir, é exatamente o tipo de número que benchmark nenhum publica.

O `README.md` da sua pasta é onde você conta como foi. Essa parte é metade do
valor do repositório: o número diz quanto custou, o texto diz o que se comprou
com ele — onde o modelo travou, o que você refez a mão, o que saiu melhor do que
esperava.

## Dúvida, ideia, problema

Abra uma [issue](https://github.com/luccapinto/ai-games/issues). Para propor um
jogo antes de fazer, tem um modelo de issue pronto.

---

## In English

A collective repo of browser games built by talking to AI, doubling as a
benchmark of what that costs. Add a game, declare honestly which model wrote it,
which agent drove it, and how many tokens it burned — those declarations are what
the [benchmark table](https://luccapinto.github.io/ai-games/benchmark.html) is made of.

```bash
python3 tools/novo_jogo.py my-game --autor "Your Name" --github your-handle
python3 tools/validar.py my-game    # same check CI runs
python3 tools/build.py              # regenerates README, hub, benchmark, data
```

The four rules: the game runs by opening its folder (no build step, no CDN — vendor
your dependencies); the folder is self-contained; the token numbers are honest
(mark them `estimado` or `parcial` if you had to reconstruct them — see
[`docs/CUSTOS.md`](docs/CUSTOS.md)); and the game is yours to publish.

Field reference in [`docs/ESQUEMA.md`](docs/ESQUEMA.md). Fields and docs are in
Portuguese — English PRs are welcome, just keep the JSON keys as they are, since
the generator reads them.
