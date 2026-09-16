#!/usr/bin/env python3
"""Gera tudo que e indice a partir dos meta.json: README, hub, benchmark, dados.

A regra que este script protege: nao existe lista de jogos mantida a mao. Quem
manda um jogo escreve um meta.json e roda isto aqui. O README, o hub, a tabela do
benchmark e os arquivos de dados saem todos da mesma fonte, entao nenhum deles
pode discordar do outro nem ficar velho.

    python3 tools/build.py              gera os arquivos
    python3 tools/build.py --conferir   nao escreve; falha se algo estiver velho

O modo --conferir e o que a CI usa: se alguem mexer no meta.json e esquecer de
rodar o gerador, o PR acusa em vez de entrar com o indice desatualizado.
"""
from __future__ import annotations

import csv
import io
import json
import pathlib
import re
import sys
from html import escape

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import esquema  # noqa: E402

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PASTA_JOGOS = RAIZ / 'games'
PASTA_DADOS = RAIZ / 'dados'
PASTA_PAGINAS = RAIZ / 'jogos'

# Onde o repositorio fica publicado. Vale so para os links do README: no GitHub,
# um link para .html mostra o codigo-fonte da pagina, nao a pagina. O hub e o
# benchmark seguem com link relativo entre si, porque eles precisam funcionar
# servidos de qualquer lugar, inclusive de uma pasta no disco.
SITE = 'https://luccapinto.github.io/ai-games'
REPO = 'https://github.com/luccapinto/ai-games'

NAO_ASCII = re.compile(r'[^\x00-\x7F]')


# --------------------------------------------------------------------------
# carga
# --------------------------------------------------------------------------

def carregar_jogos():
    """Le e normaliza os meta.json. Quem tem erro grave fica de fora do indice:
    melhor um jogo ausente do que um benchmark somando numero inventado."""
    jogos, recusados = [], []

    for meta_path in sorted(PASTA_JOGOS.glob('*/meta.json')):
        pasta = meta_path.parent
        if pasta.name.startswith(('.', '_')):
            continue
        try:
            bruto = json.loads(meta_path.read_text(encoding='utf-8'))
        except json.JSONDecodeError as erro:
            recusados.append((pasta.name, f'JSON invalido: {erro}'))
            continue

        problemas = [p for p in esquema.validar(bruto, pasta.name, pasta) if p.grave]
        if problemas:
            recusados.append((pasta.name, '; '.join(f'{p.campo}: {p.mensagem}' for p in problemas[:3])))
            continue

        jogo = esquema.normalizar(bruto, pasta.name)
        jogo['_pasta'] = pasta
        jogo['_totais'] = esquema.totais(jogo)
        jogos.append(jogo)

    # mais recente primeiro: o hub e vitrine, o trabalho novo aparece em cima
    jogos.sort(key=lambda j: (j['criado'], j['slug']), reverse=True)
    return jogos, recusados


# --------------------------------------------------------------------------
# formatacao (padrao brasileiro: 7.653 e US$ 1,03)
# --------------------------------------------------------------------------

def moeda(usd):
    if usd is None:
        return 'n/d'
    return 'US$ ' + f'{usd:,.2f}'.replace(',', '\x00').replace('.', ',').replace('\x00', '.')


def milhar(n):
    if n is None:
        return 'n/d'
    return f'{int(n):,}'.replace(',', '.')


def compacto(n):
    """Token se conta aos milhoes. 159076224 nao se le; 159,1 M se le."""
    if not n:
        return '0'
    if n >= 1_000_000_000:
        return f'{n / 1_000_000_000:.1f}'.replace('.', ',') + ' B'
    if n >= 1_000_000:
        return f'{n / 1_000_000:.1f}'.replace('.', ',') + ' M'
    if n >= 1_000:
        return f'{n / 1_000:.1f}'.replace('.', ',') + ' k'
    return str(n)


def decimal(n, casas=1):
    if n is None:
        return 'n/d'
    return f'{n:,.{casas}f}'.replace(',', '\x00').replace('.', ',').replace('\x00', '.')


def nomes_autores(jogo):
    return ', '.join(a['nome'] for a in jogo['autores'] if a['nome']) or 'n/d'


def lista_modelos(jogo):
    return ', '.join(esquema.modelos_do_jogo(jogo)) or 'n/d'


def lista_agentes(jogo):
    vistos = []
    for i in jogo['ia']:
        if i['agente'] and i['agente'] not in vistos:
            vistos.append(i['agente'])
    return ', '.join(vistos) or 'n/d'


# --------------------------------------------------------------------------
# agregacao: e isto que faz do repositorio um benchmark
# --------------------------------------------------------------------------

def agregar(jogos, chave):
    """Junta as entradas de IA de todos os jogos pela chave pedida.

    A unidade somada e a entrada de IA, nao o jogo: um jogo escrito por dois
    modelos entra uma vez em cada, com os tokens que cada um gastou. Por isso a
    soma de 'jogos' por modelo pode passar do total de jogos do repositorio.
    """
    grupos = {}
    for jogo in jogos:
        for ia in jogo['ia']:
            nome = (ia.get(chave) or '').strip() or 'n/d'
            g = grupos.setdefault(nome, {
                'nome': nome, 'jogos': set(), 'tokens_novos': 0, 'tokens_cache': 0,
                'usd': 0.0, 'chamadas': 0, 'linhas': 0,
            })
            g['jogos'].add(jogo['slug'])
            g['tokens_novos'] += ia['tokens']['entrada'] + ia['tokens']['saida']
            g['tokens_cache'] += ia['tokens']['cache_leitura'] + ia['tokens']['cache_escrita']
            g['usd'] += ia['usd_estimado'] or 0
            g['chamadas'] += ia['chamadas_api']

    # Linha de codigo pertence ao jogo, nao a entrada de IA. Quando dois modelos
    # escreveram o mesmo jogo nao da para saber quem escreveu qual linha, entao o
    # jogo inteiro conta para os dois e a coluna vira "linhas dos jogos em que
    # este modelo trabalhou". Esta em docs/ESQUEMA.md, para ninguem ler errado.
    for g in grupos.values():
        g['linhas'] = sum(j['tamanho']['linhas_proprias'] for j in jogos if j['slug'] in g['jogos'])
        g['n_jogos'] = len(g['jogos'])
        g['linhas_por_dolar'] = (g['linhas'] / g['usd']) if g['usd'] > 0 else None
        g['tokens_por_linha'] = (g['tokens_novos'] / g['linhas']) if g['linhas'] > 0 else None

    return sorted(grupos.values(), key=lambda g: (-g['n_jogos'], -g['tokens_novos'], g['nome']))


def resumo_geral(jogos):
    autores = {(a['github'] or a['nome']).lower() for j in jogos for a in j['autores'] if a['nome']}
    modelos = {m for j in jogos for m in esquema.modelos_do_jogo(j)}
    return {
        'jogos': len(jogos),
        'autores': len(autores),
        'modelos': len(modelos),
        'linhas': sum(j['_totais']['linhas'] for j in jogos),
        # Mesmo motivo do arredondamento em esquema.totais(): sum() de float
        # mudou de resultado no Python 3.12, e este numero vai para o JSON.
        'usd': round(sum(j['_totais']['usd'] for j in jogos), 4),
        'tokens_novos': sum(j['_totais']['tokens_novos'] for j in jogos),
        'tokens_cache': sum(j['_totais']['tokens_cache'] for j in jogos),
        'chamadas': sum(j['_totais']['chamadas_api'] for j in jogos),
    }


# --------------------------------------------------------------------------
# README
# --------------------------------------------------------------------------

def tabela_jogos_md(jogos):
    linhas = ['| Jogo | Gênero | Quem fez | Modelo | Tokens novos | Custo | Jogar |',
              '| --- | --- | --- | --- | --- | --- | --- |']
    for j in jogos:
        t = j['_totais']
        pasta = f'[`{j["slug"]}`](games/{j["slug"]}/README.md)'
        linhas.append(
            f'| **{j["titulo"]}** {pasta} | {j["genero"]} | {nomes_autores(j)} | {lista_modelos(j)} '
            f'| {compacto(t["tokens_novos"])} | {moeda(t["usd"])} | [jogar]({SITE}/games/{j["slug"]}/) |')
    return '\n'.join(linhas)


def tabela_modelos_md(jogos):
    linhas = ['| Modelo | Jogos | Tokens novos | Cache | Custo | Linhas |',
              '| --- | --- | --- | --- | --- | --- |']
    for g in agregar(jogos, 'modelo'):
        linhas.append(f'| {g["nome"]} | {g["n_jogos"]} | {compacto(g["tokens_novos"])} '
                      f'| {compacto(g["tokens_cache"])} | {moeda(g["usd"])} | {milhar(g["linhas"])} |')
    return '\n'.join(linhas)


def gerar_readme(jogos):
    r = resumo_geral(jogos)
    plural = 'jogos' if r['jogos'] != 1 else 'jogo'
    pessoas = 'pessoas' if r['autores'] != 1 else 'pessoa'

    return f"""# ai-games

Um repositório coletivo de jogos feitos conversando com IA — e um benchmark do
que isso custa. Cada jogo vive numa pasta própria, autocontido e jogável sozinho,
com o modelo que escreveu, a ferramenta que dirigiu e os tokens gastos
registrados ao lado.

*A collective repo of games built by talking to AI — and a benchmark of what that
costs. Each game is a self-contained, playable folder that records the model that
wrote it, the agent that drove it, and the tokens it burned.*

**{r['jogos']} {plural}** de **{r['autores']} {pessoas}**, {milhar(r['linhas'])} linhas de código,
{compacto(r['tokens_novos'])} tokens novos e {moeda(r['usd'])} de API no total.

👉 **[Jogar tudo]({SITE}/)** · **[Ver o benchmark]({SITE}/benchmark.html)** · **[Mandar o seu jogo](CONTRIBUTING.md)**

## Os jogos

{tabela_jogos_md(jogos)}

## O benchmark

{tabela_modelos_md(jogos)}

Tokens novos são entrada + saída. Cache aparece em coluna separada de propósito:
quanto do contexto vira leitura de cache depende da ferramenta que dirigiu o
modelo, não do trabalho que o modelo fez — somar os dois compararia agentes, não
jogos. A metodologia inteira, com o que este benchmark **não** mede, está em
[`docs/CUSTOS.md`](docs/CUSTOS.md).

## Como mandar um jogo

```bash
git clone {REPO} && cd ai-games
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

{detalhes_md(jogos)}
---

Gerado por `tools/build.py` a partir dos `meta.json`. Não edite este arquivo à mão.
"""


def detalhes_md(jogos):
    blocos = []
    for j in jogos:
        t = j['_totais']
        linhas = [f'### {j["titulo"]}', '', j['resumo'], '']
        if j['destaques']:
            linhas += ['O que tem dentro:', '']
            linhas += [f'- {d}' for d in j['destaques']]
            linhas.append('')
        linhas.append(f'- **Quem fez:** {nomes_autores(j)}')
        for ia in j['ia']:
            via = f' via {ia["provider"]}' if ia['provider'] else ''
            agente = f', dirigido por {ia["agente"]}' if ia['agente'] else ''
            tok = ia['tokens']
            linhas.append(
                f'- **Modelo:** {ia["modelo"]}{via}{agente} — '
                f'{compacto(tok["entrada"] + tok["saida"])} tokens novos, '
                f'{compacto(tok["cache_leitura"] + tok["cache_escrita"])} de cache, '
                f'{milhar(ia["chamadas_api"])} chamadas, {moeda(ia["usd_estimado"])}')
        linhas.append(f'- **Custo total:** {moeda(t["usd"])} ({j["medicao"]["confianca"] or "n/d"})')
        mb = decimal(j['tamanho']['mb']) if j['tamanho']['mb'] else 'n/d'
        linhas.append(f'- **Tamanho:** {milhar(t["linhas"])} linhas de código próprio, {mb} MB')
        linhas.append(f'- **Pasta:** [`games/{j["slug"]}/`](games/{j["slug"]}/README.md)')
        linhas.append('')
        blocos.append('\n'.join(linhas))
    return '\n'.join(blocos)


# --------------------------------------------------------------------------
# HTML: uma folha de estilo so para o hub e para o benchmark
# --------------------------------------------------------------------------
# Nao e f-string de proposito. Ja aconteceu de uma passagem de texto acentuar
# seletor aqui dentro (.numeros virou .números) e o estilo morrer calado; texto
# puro, longe das chaves do gerador, e mais dificil de estragar. E conferido em
# _conferir_css_ascii() antes de gravar.

CSS = """
  :root {
    --bg: #05070d; --painel: #0a1018; --linha: #1b2c38; --ink: #d8e6e4;
    --muted: #6f8b88; --neon: #35f0d8; --ambar: #ffb347;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font-family: var(--mono); line-height: 1.6; font-size: 15px;
    background-image: radial-gradient(circle at 15% -10%, rgba(53,240,216,.10), transparent 50%),
                      radial-gradient(circle at 90% 0%, rgba(255,179,71,.06), transparent 42%);
    background-repeat: no-repeat;
  }
  img, video { max-width: 100%; }
  a { color: var(--neon); }
  /* Foco visivel: navegacao por teclado precisa saber onde esta. */
  a:focus-visible, button:focus-visible {
    outline: 2px solid var(--neon); outline-offset: 3px;
  }
  .envelope { max-width: 1160px; margin: 0 auto; padding: 60px 22px 96px; }

  /* ---- cabecalho ---- */
  header.topo { border-bottom: 1px solid var(--linha); padding-bottom: 32px; margin-bottom: 44px; }
  .marca { font-size: 12px; letter-spacing: 6px; color: var(--neon); }
  .marca a { color: var(--neon); text-decoration: none; }
  h1 {
    font-size: clamp(34px, 7vw, 64px); margin: 16px 0 12px;
    letter-spacing: -1.5px; line-height: 1.02; font-weight: 700;
  }
  .sub { color: var(--muted); max-width: 64ch; font-size: 15px; }
  h2.secao {
    font-size: 14px; letter-spacing: 3px; color: var(--ambar); margin: 52px 0 16px;
    text-transform: uppercase; font-weight: 700;
  }

  .numeros { display: flex; flex-wrap: wrap; gap: 34px; margin-top: 30px; }
  .numeros div span {
    display: block; color: var(--muted); font-size: 10px; letter-spacing: 2px;
    text-transform: uppercase;
  }
  .numeros div strong {
    font-size: 26px; color: var(--ambar); font-variant-numeric: tabular-nums;
  }

  .navegacao { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
  .navegacao a {
    color: var(--ink); text-decoration: none; font-size: 11px; letter-spacing: 2px;
    border: 1px solid var(--linha); padding: 11px 18px; transition: border-color .15s, color .15s;
  }
  .navegacao a:hover { border-color: var(--neon); color: var(--neon); }
  .navegacao a.destaque {
    background: var(--neon); color: #04201c; border-color: var(--neon); font-weight: 700;
  }
  .navegacao a.destaque:hover { filter: brightness(1.12); color: #04201c; }

  /* ---- a grade de jogos ---- */
  .grade {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px; align-items: stretch;
  }
  .cartao {
    background: var(--painel); border: 1px solid var(--linha);
    display: flex; flex-direction: column; min-width: 0;
    transition: border-color .15s, transform .15s;
  }
  .cartao:hover { border-color: rgba(53,240,216,.45); transform: translateY(-2px); }
  .midia { position: relative; aspect-ratio: 16 / 9; background: #000; overflow: hidden; }
  .midia img, .midia video {
    width: 100%; height: 100%; object-fit: cover; display: block;
  }
  .midia.vazia {
    display: grid; place-items: center; color: var(--muted); font-size: 12px;
  }
  .marca-previa {
    position: absolute; top: 9px; right: 9px; background: rgba(5,7,13,.82);
    border: 1px solid rgba(53,240,216,.5); color: var(--neon);
    font-size: 9px; letter-spacing: 1px; padding: 3px 7px;
  }
  .cartao-corpo { padding: 16px 16px 18px; display: flex; flex-direction: column; flex: 1; }
  .cartao-corpo h3 { margin: 0; font-size: 17px; letter-spacing: -.3px; line-height: 1.25; }
  .cartao-corpo h3 a { color: var(--ink); text-decoration: none; }
  .cartao-corpo h3 a:hover { color: var(--neon); }
  .genero {
    color: var(--neon); font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
    margin-top: 6px; display: block;
  }
  .autoria { color: var(--muted); font-size: 12px; margin: 8px 0 0; }
  .autoria a { color: var(--muted); }
  .autoria a:hover { color: var(--ink); }

  /* O chip e o tempero: modelo e custo, nada alem disso no cartao. */
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 0; }
  .chip {
    font-size: 10px; letter-spacing: .5px; padding: 4px 9px; border: 1px solid var(--linha);
    color: var(--muted); white-space: nowrap;
  }
  .chip.modelo { color: var(--neon); border-color: rgba(53,240,216,.4); }
  .chip.custo {
    color: var(--ambar); border-color: rgba(255,179,71,.4); font-variant-numeric: tabular-nums;
  }
  .empurra { flex: 1; min-height: 14px; }
  .jogar {
    background: var(--neon); color: #04201c; font-weight: 700; padding: 13px;
    text-decoration: none; font-size: 12px; letter-spacing: 3px; text-align: center;
    display: block; transition: filter .15s;
  }
  .jogar:hover { filter: brightness(1.15); }
  .secundario {
    color: var(--muted); text-decoration: none; font-size: 11px; letter-spacing: 1px;
    border-bottom: 1px solid var(--linha); padding-bottom: 1px;
  }
  .secundario:hover { color: var(--ink); border-color: var(--neon); }

  /* O convite e membro permanente da grade, nao um caso especial de quando ha
     poucos jogos: com um jogo so a grade tem duas celulas e se justifica. */
  .cartao.convite {
    border-style: dashed; background: rgba(53,240,216,.03);
    justify-content: center; padding: 26px 20px; min-height: 260px;
  }
  .cartao.convite:hover { transform: none; }
  .cartao.convite h3 { font-size: 17px; margin: 0 0 10px; }
  .cartao.convite p { color: var(--muted); font-size: 13px; margin: 0 0 16px; }
  .cartao.convite code { color: var(--ambar); font-size: 12px; }

  /* ---- pagina de um jogo ---- */
  .jogo-topo { margin-bottom: 30px; }
  .jogo-topo .midia { aspect-ratio: 16 / 9; border: 1px solid var(--linha); }
  .jogo-acoes { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin-top: 22px; }
  .jogo-acoes .jogar { display: inline-block; padding: 15px 42px; }
  .colunas { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 40px; }
  .destaques { margin: 0; padding-left: 20px; color: var(--ink); font-size: 14px; }
  .destaques li { margin-bottom: 9px; }
  .ficha {
    margin: 0; border: 1px solid var(--linha); background: var(--painel); padding: 4px 18px;
  }
  .ficha div {
    display: flex; justify-content: space-between; gap: 16px; align-items: baseline;
    padding: 11px 0; border-bottom: 1px solid var(--linha);
  }
  .ficha div:last-child { border-bottom: 0; }
  .ficha dt {
    color: var(--muted); font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
  }
  .ficha dd {
    margin: 0; font-size: 14px; text-align: right; font-variant-numeric: tabular-nums;
  }
  .ficha dd.destaque { color: var(--ambar); }
  .arquivos { list-style: none; padding: 0; margin: 0; font-size: 13px; }
  .arquivos li { padding: 9px 0; border-bottom: 1px solid var(--linha); }
  .arquivos li:last-child { border-bottom: 0; }
  .arquivos code { color: var(--neon); }
  .arquivos span { display: block; color: var(--muted); font-size: 12px; margin-top: 3px; }

  /* ---- tabelas do benchmark ---- */
  .rolagem { overflow-x: auto; border: 1px solid var(--linha); background: var(--painel); }
  table { border-collapse: collapse; width: 100%; font-size: 12px; min-width: 620px; }
  th, td { padding: 11px 14px; text-align: left; border-bottom: 1px solid var(--linha); }
  td.txt { white-space: normal; min-width: 92px; }
  th {
    color: var(--muted); font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
    font-weight: 400;
  }
  tbody tr:hover { background: rgba(53,240,216,.04); }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.destaque { color: var(--ambar); }
  td a { color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--linha); }
  td a:hover { color: var(--neon); }
  .selo {
    font-size: 9px; letter-spacing: 1px; padding: 2px 7px; border: 1px solid var(--linha);
    color: var(--muted); text-transform: uppercase;
  }
  .selo.medido { color: var(--neon); border-color: rgba(53,240,216,.4); }
  .selo.parcial { color: var(--ambar); border-color: rgba(255,179,71,.4); }
  .nota { color: var(--muted); font-size: 13px; max-width: 76ch; margin: 14px 0 0; }
  .nota strong { color: var(--ink); }

  footer.rodape {
    border-top: 1px solid var(--linha); margin-top: 60px; padding-top: 24px;
    color: var(--muted); font-size: 12px;
  }
  footer.rodape a { color: var(--neon); }

  @media (max-width: 900px) {
    .colunas { grid-template-columns: 1fr; gap: 30px; }
  }
  @media (max-width: 560px) {
    .envelope { padding: 40px 16px 70px; }
    .grade { grid-template-columns: 1fr; }
    .numeros { gap: 22px; }
    .numeros div strong { font-size: 22px; }
    .jogo-acoes .jogar { display: block; width: 100%; }
  }

  /* Uma grade inteira de coisa se mexendo e exatamente o caso em que isto
     importa. O JS tambem confere, para nao chegar a trocar a imagem. */
  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: .001ms !important; transition-duration: .001ms !important; }
    .cartao:hover { transform: none; }
  }
"""


def _conferir_css_ascii(html, destino):
    """Seletor, classe e at-rule sao ASCII. Acento ali nao da erro: da silencio.

    Foi exatamente assim que o layout de celular do hub morreu antes — '@média'
    nao e at-rule nenhuma, e o navegador pula o bloco sem reclamar.
    """
    for regra in re.findall(r'^\s*([.#@][^\s{,:]*)', CSS, flags=re.M):
        if NAO_ASCII.search(regra):
            raise SystemExit(f'{destino}: seletor com acento no CSS: {regra}')
    for classe in re.findall(r'class="([^"]*)"', html):
        if NAO_ASCII.search(classe):
            raise SystemExit(f'{destino}: atributo class com acento: {classe}')


def cabecalho_html(titulo, descricao):
    return f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(titulo)}</title>
<meta name="description" content="{escape(descricao)}">
<style>{CSS}</style>
</head>
<body>
<div class="envelope">"""


RODAPE_HTML = """  <footer class="rodape">
    Repositório coletivo. O índice, esta página e os arquivos de <code>dados/</code> são gerados
    por <code>tools/build.py</code> a partir dos <code>meta.json</code> de cada jogo.
    <a href="https://github.com/luccapinto/ai-games/blob/main/CONTRIBUTING.md">Mande o seu jogo</a>.
  </footer>
</div>
</body>
</html>
"""


def bloco_numeros(pares):
    itens = ''.join(f'<div><span>{escape(rotulo)}</span><strong>{escape(valor)}</strong></div>'
                    for rotulo, valor in pares)
    return f'<div class="numeros">{itens}</div>'


# --------------------------------------------------------------------------
# hub
# --------------------------------------------------------------------------

# A previa so entra depois que o elemento aparece na tela, e nunca entra se a
# pessoa pediu menos movimento no sistema. Sem JS nada disso roda e a capa fica
# onde esta: por isso o src da capa vem no HTML e a previa vem em data-previa,
# em vez do contrario.
SCRIPT_PREVIA = """  <script>
  (function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }
    var alvos = document.querySelectorAll('[data-previa]');
    if (!alvos.length || !('IntersectionObserver' in window)) { return; }
    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        var el = entrada.target;
        if (entrada.isIntersecting) {
          if (el.tagName === 'VIDEO') {
            if (!el.getAttribute('src')) { el.setAttribute('src', el.dataset.previa); }
            var tocando = el.play();
            if (tocando && tocando.catch) { tocando.catch(function () {}); }
          } else if (el.dataset.previa) {
            el.src = el.dataset.previa;
            observador.unobserve(el);
          }
        } else if (el.tagName === 'VIDEO') {
          el.pause();
        }
      });
    }, { rootMargin: '150px' });
    alvos.forEach(function (el) { observador.observe(el); });
  })();
  </script>"""


def creditos_html(jogo):
    creditos = []
    for a in jogo['autores']:
        if a['github']:
            creditos.append(f'<a href="https://github.com/{escape(a["github"])}">{escape(a["nome"])}</a>')
        elif a['nome']:
            creditos.append(escape(a['nome']))
    return ' e '.join(creditos) or 'n/d'


def midia_html(jogo, prefixo='', destaque=False):
    """A capa e o que o HTML entrega; a previa e so uma promessa em data-previa.

    Nessa ordem de proposito: sem JS, com conexao ruim ou com movimento reduzido,
    o que sobra e a capa — e nao um quadro preto esperando video que nao veio.
    """
    base = f'{prefixo}games/{escape(jogo["slug"])}/'
    capa = jogo['capa']
    previa = jogo['previa']
    tem_capa = capa and (jogo['_pasta'] / capa).exists()
    tem_previa = previa and (jogo['_pasta'] / previa).exists()

    if not tem_capa and not tem_previa:
        return '<div class="midia vazia">sem captura</div>'

    alt = f'captura de {escape(jogo["titulo"])}'
    src_capa = f'{base}{escape(capa)}' if tem_capa else ''
    carregar = 'eager' if destaque else 'lazy'
    selo = '<span class="marca-previa">&#9654; PRÉVIA</span>' if tem_previa else ''

    if not tem_previa:
        return (f'<div class="midia"><img src="{src_capa}" alt="{alt}" '
                f'loading="{carregar}"></div>')

    src_previa = f'{base}{escape(previa)}'
    if previa.lower().endswith(('.mp4', '.webm')):
        # preload=none: numa grade de doze jogos, doze videos baixando de uma vez
        # e o celular da pessoa pagando a conta antes de ela ver qualquer coisa.
        corpo = (f'<video data-previa="{src_previa}" poster="{src_capa}" muted loop '
                 f'playsinline preload="none" aria-label="{alt}"></video>')
    else:
        corpo = (f'<img src="{src_capa}" data-previa="{src_previa}" alt="{alt}" '
                 f'loading="{carregar}">')
    return f'<div class="midia">{corpo}{selo}</div>'


def cartao_jogo(jogo):
    t = jogo['_totais']
    slug = escape(jogo['slug'])
    chips = f'<span class="chip modelo">{escape(lista_modelos(jogo))}</span>'
    if t['usd']:
        chips += f'<span class="chip custo">{moeda(t["usd"])}</span>'

    return f"""      <article class="cartao">
        {midia_html(jogo)}
        <div class="cartao-corpo">
          <h3><a href="jogos/{slug}.html">{escape(jogo['titulo'])}</a></h3>
          <span class="genero">{escape(jogo['genero'])}</span>
          <p class="autoria">por {creditos_html(jogo)}</p>
          <div class="chips">{chips}</div>
          <div class="empurra"></div>
          <a class="jogar" href="games/{slug}/">JOGAR</a>
        </div>
      </article>"""


def gerar_hub(jogos):
    r = resumo_geral(jogos)

    cartoes = [cartao_jogo(j) for j in jogos]

    # O convite entra como celula da grade, nao como secao depois dela. Com um
    # jogo so isso e o que separa "grade com duas celulas" de "site abandonado",
    # e com doze ele continua no fim sem tomar espaco de ninguem.
    cartoes.append("""      <article class="cartao convite">
        <h3>O próximo jogo pode ser o seu</h3>
        <p>Faça um jogo conversando com qualquer modelo, em qualquer ferramenta.
          Rode <code>python3 tools/novo_jogo.py meu-jogo</code>, preencha o
          <code>meta.json</code> com o que o modelo gastou e abra um PR.</p>
        <a class="jogar" href="https://github.com/luccapinto/ai-games/blob/main/CONTRIBUTING.md">MANDAR O MEU</a>
      </article>""")

    # Tres numeros, nao oito: aqui eles sao o gancho ("tudo isso por US$ 1,03"),
    # e a lista completa e o benchmark.
    numeros = bloco_numeros([
        ('JOGOS', str(r['jogos'])),
        ('MODELOS', str(r['modelos'])),
        ('CUSTO DE API', moeda(r['usd'])),
    ])

    html = f"""{cabecalho_html('ai-games — jogos feitos com IA',
                               'Vitrine de jogos feitos com IA: cada um roda no navegador, com o '
                               'modelo que escreveu e quanto custou ao lado.')}
  <header class="topo">
    <div class="marca">AI-GAMES</div>
    <h1>O que a IA está construindo</h1>
    <p class="sub">Repositório coletivo de jogos feitos conversando com modelos. Todos abrem no
      navegador, sem instalar nada. Ao lado de cada um está quem escreveu e quanto custou —
      porque um jogo bom por dez dólares e um jogo bom por um dólar não são a mesma coisa.</p>
    {numeros}
    <nav class="navegacao">
      <a class="destaque" href="https://github.com/luccapinto/ai-games/blob/main/CONTRIBUTING.md">MANDAR O SEU JOGO</a>
      <a href="benchmark.html">VER O BENCHMARK</a>
      <a href="dados/benchmark.csv">BAIXAR OS DADOS</a>
      <a href="https://github.com/luccapinto/ai-games">CÓDIGO</a>
    </nav>
  </header>

  <div class="grade">
{chr(10).join(cartoes)}
  </div>
{SCRIPT_PREVIA}
{RODAPE_HTML}"""

    _conferir_css_ascii(html, 'index.html')
    return html


# --------------------------------------------------------------------------
# HTML: a pagina de um jogo
# --------------------------------------------------------------------------
# Mora em jogos/<slug>.html, nunca em games/<slug>/index.html: aquele arquivo e
# o jogo. Esta e a pagina que se manda para quem ainda nao decidiu jogar, entao
# ela leva o detalhe que nao cabe no cartao da grade.

def gerar_pagina_jogo(jogo):
    t = jogo['_totais']
    slug = escape(jogo['slug'])
    pasta = f'../games/{slug}/'

    destaques = ''.join(f'<li>{escape(d)}</li>' for d in jogo['destaques'])
    bloco_destaques = ('<h2 class="secao">O que tem dentro</h2>\n'
                       f'      <ul class="destaques">{destaques}</ul>' if destaques else '')

    arquivos = ''.join(
        f'<li><code>{escape(a.get("caminho", ""))}</code>'
        f'<span>{escape(a.get("papel", ""))}</span></li>'
        for a in jogo['arquivos_chave'] if a.get('caminho'))
    bloco_arquivos = ('<h2 class="secao">Por onde começar a ler</h2>\n'
                      f'      <ul class="arquivos">{arquivos}</ul>' if arquivos else '')

    ficha = ''
    for rotulo, valor, forte in (
        ('Escreveu', escape(lista_modelos(jogo)), False),
        ('Agente', escape(lista_agentes(jogo)), False),
        ('Tokens novos', compacto(t['tokens_novos']), True),
        ('Tokens de cache', compacto(t['tokens_cache']), False),
        ('Custo de API', moeda(t['usd']), True),
        ('Linhas próprias', milhar(t['linhas']), False),
        ('Licença', escape(jogo['licenca']) or 'n/d', False),
        ('Estado', escape(jogo['estado']), False),
    ):
        classe = ' class="destaque"' if forte else ''
        ficha += f'<div><dt>{rotulo}</dt><dd{classe}>{valor}</dd></div>'

    stack = ''.join(f'<span class="chip">{escape(s)}</span>' for s in jogo['stack'])
    bloco_stack = f'<div class="chips">{stack}</div>' if stack else ''

    subtitulo = f'<p class="sub">{escape(jogo["subtitulo"])}</p>' if jogo['subtitulo'] else ''
    repo = (f'<a class="secundario" href="{escape(jogo["repo"])}">repositório do jogo</a>'
            if jogo['repo'] else '')
    nota = jogo['medicao']['nota']
    bloco_nota = f'<p class="nota">{escape(nota)}</p>' if nota else ''
    marca_genero = f' / {escape(jogo["genero"].upper())}' if jogo['genero'] else ''

    html = f"""{cabecalho_html(f'{jogo["titulo"]} — ai-games',
                               jogo['resumo'][:160] or f'{jogo["titulo"]}, um jogo feito com IA.')}
  <header class="topo">
    <div class="marca"><a href="../index.html">AI-GAMES</a>{marca_genero}</div>
    <h1>{escape(jogo['titulo'])}</h1>
    {subtitulo}
    <p class="autoria">por {creditos_html(jogo)} · {escape(jogo['criado'])}</p>
  </header>

  <div class="jogo-topo">
    {midia_html(jogo, '../', destaque=True)}
    <div class="jogo-acoes">
      <a class="jogar" href="{pasta}">JOGAR</a>
      <a class="secundario" href="{pasta}README.md">como foi feito</a>
      {repo}
    </div>
  </div>

  <div class="colunas">
    <div>
      <p class="sub" style="max-width:none">{escape(jogo['resumo'])}</p>
      {bloco_destaques}
      {bloco_arquivos}
    </div>
    <div>
      <h2 class="secao" style="margin-top:0">A ficha</h2>
      <dl class="ficha">{ficha}</dl>
      {bloco_stack}
      {bloco_nota}
    </div>
  </div>

  <nav class="navegacao" style="margin-top:44px">
    <a href="../index.html">VOLTAR AO HUB</a>
    <a href="../benchmark.html">VER O BENCHMARK</a>
  </nav>
{SCRIPT_PREVIA}
{RODAPE_HTML}"""

    _conferir_css_ascii(html, f'jogos/{jogo["slug"]}.html')
    return html

# --------------------------------------------------------------------------
# benchmark
# --------------------------------------------------------------------------

def linha_tabela(celulas):
    return '<tr>' + ''.join(celulas) + '</tr>'


NUMERICAS = {'Jogos', 'Tokens novos', 'Cache', 'Chamadas', 'Custo', 'Linhas',
             'Tokens/linha', 'Linhas/US$'}


def tabela_html(cabecalhos, linhas):
    cab = ''.join(f'<th class="num">{escape(c)}</th>' if c in NUMERICAS else f'<th>{escape(c)}</th>'
                  for c in cabecalhos)
    return (f'<div class="rolagem"><table><thead><tr>{cab}</tr></thead>'
            f'<tbody>{"".join(linhas)}</tbody></table></div>')


def tabela_por_jogo(jogos):
    linhas = []
    for j in jogos:
        t = j['_totais']
        confianca = esquema.sem_acento(j['medicao']['confianca']) or 'n/d'
        selo = f'<span class="selo {escape(confianca)}">{escape(confianca)}</span>'
        linhas.append(linha_tabela([
            f'<td class="txt"><a href="games/{escape(j["slug"])}/">{escape(j["titulo"])}</a></td>',
            f'<td class="txt">{escape(nomes_autores(j))}</td>',
            f'<td class="txt">{escape(lista_modelos(j))}</td>',
            f'<td class="txt">{escape(lista_agentes(j))}</td>',
            f'<td class="num">{compacto(t["tokens_novos"])}</td>',
            f'<td class="num">{compacto(t["tokens_cache"])}</td>',
            f'<td class="num destaque">{moeda(t["usd"])}</td>',
            f'<td class="num">{milhar(t["linhas"])}</td>',
            f'<td>{selo}</td>',
        ]))
    # Chamadas fica de fora daqui e segue no CSV e no JSON: numa tabela larga, a
    # coluna que nao pode sumir da tela e a de custo.
    return tabela_html(['Jogo', 'Quem fez', 'Modelo', 'Agente', 'Tokens novos', 'Cache',
                        'Custo', 'Linhas', 'Medição'], linhas)


def tabela_agregada(jogos, chave, rotulo):
    linhas = []
    for g in agregar(jogos, chave):
        linhas.append(linha_tabela([
            f'<td class="txt">{escape(g["nome"])}</td>',
            f'<td class="num">{g["n_jogos"]}</td>',
            f'<td class="num">{compacto(g["tokens_novos"])}</td>',
            f'<td class="num">{compacto(g["tokens_cache"])}</td>',
            f'<td class="num destaque">{moeda(g["usd"])}</td>',
            f'<td class="num">{milhar(g["linhas"])}</td>',
            f'<td class="num">{decimal(g["tokens_por_linha"])}</td>',
            f'<td class="num">{milhar(g["linhas_por_dolar"]) if g["linhas_por_dolar"] else "n/d"}</td>',
        ]))
    return tabela_html([rotulo, 'Jogos', 'Tokens novos', 'Cache', 'Custo', 'Linhas',
                        'Tokens/linha', 'Linhas/US$'], linhas)


def gerar_benchmark(jogos):
    r = resumo_geral(jogos)
    numeros = bloco_numeros([
        ('JOGOS', str(r['jogos'])),
        ('MODELOS', str(r['modelos'])),
        ('TOKENS NOVOS', compacto(r['tokens_novos'])),
        ('TOKENS DE CACHE', compacto(r['tokens_cache'])),
        ('CHAMADAS', milhar(r['chamadas'])),
        ('CUSTO TOTAL', moeda(r['usd'])),
    ])

    html = f"""{cabecalho_html('Benchmark — ai-games',
                               'Quanto custou, em tokens e em dólar, cada jogo feito com IA neste repositório.')}
  <header class="topo">
    <div class="marca"><a href="index.html">AI-GAMES</a> / BENCHMARK</div>
    <h1>O que custou cada jogo</h1>
    <p class="sub">Um jogo inteiro é uma tarefa longa, bagunçada e com um juiz honesto no fim:
      ou dá para jogar, ou não dá. Esta tabela registra quanto cada modelo gastou para chegar lá,
      declarado por quem fez.</p>
    {numeros}
    <nav class="navegacao">
      <a href="index.html">VOLTAR AO HUB</a>
      <a href="dados/benchmark.csv">CSV</a>
      <a href="dados/benchmark.json">JSON</a>
      <a href="https://github.com/luccapinto/ai-games/blob/main/docs/CUSTOS.md">METODOLOGIA</a>
    </nav>
  </header>

  <h2 class="secao">Por jogo</h2>
  {tabela_por_jogo(jogos)}

  <h2 class="secao">Por modelo</h2>
  {tabela_agregada(jogos, 'modelo', 'Modelo')}

  <h2 class="secao">Por agente</h2>
  {tabela_agregada(jogos, 'agente', 'Agente')}
  <p class="nota">A mesma tarefa muda de preço conforme a ferramenta que dirige o modelo: quanto
    contexto ela reenvia, quanto ela acerta de cache, quantas chamadas ela gasta para aplicar uma
    edição. Por isso agente é uma coluna do benchmark, não um detalhe.</p>

  <h2 class="secao">Por provider</h2>
  {tabela_agregada(jogos, 'provider', 'Provider')}

  <h2 class="secao">Como ler isto</h2>
  <p class="nota"><strong>Tokens novos</strong> é entrada mais saída. <strong>Cache</strong> fica
    à parte porque depende da ferramenta, não do trabalho: numa sessão longa cada turno reenvia o
    contexto acumulado, e quanto disso vira leitura barata de cache é decisão do agente. Somar os
    dois num número só compara agentes, não jogos.</p>
  <p class="nota"><strong>Linhas por dólar</strong> é uma medida de escala, não de qualidade. Um
    modelo que escreve um jogo enxuto e bom perde nessa coluna para um que despeja código. Leia
    junto com o jogo: ele está a um clique, e ou é divertido, ou não é.</p>
  <p class="nota"><strong>Medição</strong> diz de onde veio o número: <em>medido</em> saiu da
    contabilidade da própria ferramenta, <em>estimado</em> foi reconstruído por quem fez,
    <em>parcial</em> cobre só parte das sessões. Ninguém audita a declaração de ninguém — o que
    o repositório garante é que ela está escrita, datada e versionada ao lado do código.</p>
  <p class="nota">Isto <strong>não</strong> é um benchmark controlado: jogos diferentes, pessoas
    diferentes, ambições diferentes. O que ele mostra é a ordem de grandeza real de construir algo
    que funciona conversando com um modelo — o número que nenhum eval de tarefa curta dá.</p>

{RODAPE_HTML}"""

    _conferir_css_ascii(html, 'benchmark.html')
    return html


# --------------------------------------------------------------------------
# dados para quem quiser analisar por fora
# --------------------------------------------------------------------------

def gerar_json(jogos):
    """Os mesmos numeros do benchmark, em JSON, para quem nao quer raspar HTML."""
    saida = {
        'esquema': esquema.VERSAO_ESQUEMA,
        'resumo': resumo_geral(jogos),
        'jogos': [],
        'por_modelo': [], 'por_agente': [], 'por_provider': [],
    }
    for j in jogos:
        t = j['_totais']
        saida['jogos'].append({
            'slug': j['slug'], 'titulo': j['titulo'], 'genero': j['genero'],
            'criado': j['criado'], 'estado': esquema.sem_acento(j['estado']),
            'licenca': j['licenca'],
            'autores': j['autores'],
            'ia': j['ia'],
            'medicao': j['medicao'],
            'totais': t,
            'url': f'games/{j["slug"]}/',
        })
    for chave, destino in (('modelo', 'por_modelo'), ('agente', 'por_agente'),
                           ('provider', 'por_provider')):
        for g in agregar(jogos, chave):
            saida[destino].append({
                'nome': g['nome'], 'jogos': sorted(g['jogos']), 'n_jogos': g['n_jogos'],
                'tokens_novos': g['tokens_novos'], 'tokens_cache': g['tokens_cache'],
                'chamadas_api': g['chamadas'], 'usd': round(g['usd'], 4), 'linhas': g['linhas'],
                'tokens_por_linha': round(g['tokens_por_linha'], 2) if g['tokens_por_linha'] else None,
                'linhas_por_dolar': round(g['linhas_por_dolar'], 2) if g['linhas_por_dolar'] else None,
            })
    return json.dumps(saida, ensure_ascii=False, indent=2) + '\n'


COLUNAS_CSV = ['slug', 'titulo', 'criado', 'genero', 'estado', 'autor', 'github',
               'modelo', 'provider', 'agente', 'chamadas_api', 'tokens_entrada', 'tokens_saida',
               'tokens_novos', 'tokens_cache', 'usd_estimado', 'linhas_do_jogo', 'confianca']


def gerar_csv(jogos):
    """Uma linha por (jogo, modelo): a unidade que se compara num benchmark.

    `linhas_do_jogo` e do jogo inteiro e se repete quando ha mais de um modelo —
    somar essa coluna direto conta o mesmo codigo duas vezes.
    """
    buf = io.StringIO()
    escritor = csv.writer(buf, lineterminator='\n')
    escritor.writerow(COLUNAS_CSV)
    for j in jogos:
        autor = j['autores'][0] if j['autores'] else {'nome': '', 'github': ''}
        for ia in j['ia']:
            tok = ia['tokens']
            escritor.writerow([
                j['slug'], j['titulo'], j['criado'], j['genero'], esquema.sem_acento(j['estado']),
                autor['nome'], autor['github'],
                ia['modelo'], ia['provider'], ia['agente'], ia['chamadas_api'],
                tok['entrada'], tok['saida'], tok['entrada'] + tok['saida'],
                tok['cache_leitura'] + tok['cache_escrita'],
                '' if ia['usd_estimado'] is None else f'{ia["usd_estimado"]:.4f}',
                j['tamanho']['linhas_proprias'],
                esquema.sem_acento(j['medicao']['confianca']),
            ])
    return buf.getvalue()


# --------------------------------------------------------------------------

def main(argv):
    conferir = '--conferir' in argv

    if not PASTA_JOGOS.exists():
        print('nao ha pasta games/', file=sys.stderr)
        return 1

    jogos, recusados = carregar_jogos()
    for slug, motivo in recusados:
        print(f'fora do indice: {slug} ({motivo})', file=sys.stderr)
    if not jogos:
        print('nenhum jogo valido em games/*/meta.json', file=sys.stderr)
        return 1

    saidas = {
        RAIZ / 'README.md': gerar_readme(jogos),
        RAIZ / 'index.html': gerar_hub(jogos),
        RAIZ / 'benchmark.html': gerar_benchmark(jogos),
        PASTA_DADOS / 'benchmark.json': gerar_json(jogos),
        PASTA_DADOS / 'benchmark.csv': gerar_csv(jogos),
    }
    for j in jogos:
        saidas[PASTA_PAGINAS / f'{j["slug"]}.html'] = gerar_pagina_jogo(j)

    # Jogo que saiu de games/ deixa para tras a pagina dele, e pagina orfa
    # continua no ar linkando para uma pasta que nao existe mais. Some aqui.
    orfas = sorted(p for p in PASTA_PAGINAS.glob('*.html') if p not in saidas)

    if conferir:
        velhos = [c for c, novo in saidas.items()
                  if not c.exists() or c.read_text(encoding='utf-8') != novo]
        if velhos or orfas:
            if velhos:
                print('desatualizado: '
                      + ', '.join(c.relative_to(RAIZ).as_posix() for c in velhos),
                      file=sys.stderr)
            if orfas:
                print('pagina sem jogo correspondente: '
                      + ', '.join(p.relative_to(RAIZ).as_posix() for p in orfas),
                      file=sys.stderr)
            print('rode: python3 tools/build.py', file=sys.stderr)
            return 1
        print(f'em dia: {len(jogos)} jogo(s), {len(saidas)} arquivo(s) gerado(s)')
        return 0 if not recusados else 1

    PASTA_DADOS.mkdir(exist_ok=True)
    PASTA_PAGINAS.mkdir(exist_ok=True)
    for p in orfas:
        p.unlink()
        print(f'removida: {p.relative_to(RAIZ).as_posix()}')
    for caminho, conteudo in sorted(saidas.items()):
        caminho.write_text(conteudo, encoding='utf-8')
        print(f'{caminho.relative_to(RAIZ).as_posix():<28} {len(conteudo):>7} bytes')

    print(f'\n{len(jogos)} jogo(s): {", ".join(j["slug"] for j in jogos)}')
    return 1 if recusados else 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
