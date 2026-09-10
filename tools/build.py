#!/usr/bin/env python3
"""Gera o índice do hub a partir dos metadados de cada jogo.

Cada jogo vive em games/<slug>/ e traz um meta.json. Esse arquivo e a única
fonte da verdade sobre o jogo: título, gênero, qual IA escreveu, quanto custou,
números medidos. O README da raiz e o hub navegavel são GERADOS a partir dele.

A regra que isso protege: adicionar um jogo novo e criar a pasta com o meta.json
e rodar este script. Não existe lista paralela para manter em sincronia, então
o índice nunca fica desatualizado em relacao aos jogos.

Uso:
    python3 tools/build.py
"""

import json
import pathlib
import sys
from datetime import datetime

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PASTA_JOGOS = RAIZ / 'games'


def carregar_jogos():
    jogos = []
    for meta_path in sorted(PASTA_JOGOS.glob('*/meta.json')):
        try:
            dados = json.loads(meta_path.read_text(encoding='utf-8'))
        except json.JSONDecodeError as erro:
            print(f'  meta.json invalido em {meta_path.parent.name}: {erro}', file=sys.stderr)
            continue

        dados['_pasta'] = meta_path.parent
        dados['_slug'] = meta_path.parent.name
        jogos.append(dados)

    # mais recente primeiro: o hub e uma vitrine, o ultimo trabalho aparece
    jogos.sort(key=lambda j: j.get('criado', ''), reverse=True)
    return jogos


def moeda(usd):
    """Custo em dólar, com decimal e milhar no padrão brasileiro."""
    if usd is None:
        return 'n/d'
    return 'US$ ' + f'{usd:,.2f}'.replace(',', '\x00').replace('.', ',').replace('\x00', '.')


def milhar(n):
    """Separador de milhar brasileiro: 7.653, não 7,653."""
    if n is None:
        return 'n/d'
    return f'{n:,}'.replace(',', '.')


def tabela_do_readme(jogos):
    linhas = [
        '| Jogo | Gênero | IA | Custo | Jogar |',
        '| --- | --- | --- | --- | --- |'
    ]
    for j in jogos:
        titulo = j.get('título', j['_slug'])
        genero = j.get('gênero', '')
        ia = j.get('ia', {})
        modelo = ia.get('modelo', '')
        custo = moeda((j.get('custo') or {}).get('usd_estimado'))
        # O link de jogar aponta para a pasta do jogo dentro do próprio repo, e
        # nao para um endereco externo: assim o hub funciona sozinho, servido de
        # qualquer lugar (GitHub Pages inclusive), sem depender de outro host.
        link = f'[jogar](games/{j["_slug"]}/)'
        pasta = f'[`{j["_slug"]}`](games/{j["_slug"]}/README.md)'
        linhas.append(f'| **{titulo}** {pasta} | {genero} | {modelo} | {custo} | {link} |')
    return '\n'.join(linhas)


def detalhes_do_readme(jogos):
    blocos = []
    for j in jogos:
        custo = j.get('custo') or {}
        tamanho = j.get('tamanho') or {}
        ia = j.get('ia') or {}
        destaques = j.get('destaques') or []

        linhas = [
            f'### {j.get("titulo", j["_slug"])}',
            '',
            j.get('resumo', ''),
            ''
        ]

        if destaques:
            linhas.append('O que tem dentro:')
            linhas.append('')
            for d in destaques:
                linhas.append(f'- {d}')
            linhas.append('')

        linhas.append(f'- **Modelo:** {ia.get("modelo", "n/d")} via {ia.get("provider", "n/d")}')
        linhas.append(f'- **Agente:** {ia.get("agente", "n/d")}')
        tokens = (custo.get('tokens_entrada', 0) or 0) + (custo.get('tokens_saida', 0) or 0)
        linhas.append(f'- **Custo estimado:** {moeda(custo.get("usd_estimado"))} '
                      f'({milhar(custo.get("chamadas_api"))} chamadas de API, '
                      f'{milhar(tokens)} tokens)')
        if tamanho:
            mb = tamanho.get('mb')
            mb = f'{mb:.1f}'.replace('.', ',') if isinstance(mb, (int, float)) else 'n/d'
            linhas.append(f'- **Tamanho:** {milhar(tamanho.get("linhas_proprias"))} linhas de código próprio, '
                          f'{mb} MB')
        linhas.append(f'- **Pasta:** [`games/{j["_slug"]}/`](games/{j["_slug"]}/README.md)')
        linhas.append('')

        blocos.append('\n'.join(linhas))
    return '\n'.join(blocos)


def gerar_readme(jogos):
    total_usd = sum((j.get('custo') or {}).get('usd_estimado') or 0 for j in jogos)
    total_linhas = sum((j.get('tamanho') or {}).get('linhas_proprias') or 0 for j in jogos)

    conteudo = f"""# ai-games

Jogos que fiz conversando com IA. Cada um vive numa pasta própria, autocontido e
jogável sozinho, com o modelo que escreveu e quanto custou registrados ao lado.

*Games I built by talking to AI. Each one lives in its own folder, self-contained
and playable, with the model that wrote it and what it cost recorded next to it.*

{f'**{len(jogos)} jogos**' if len(jogos) != 1 else '**1 jogo**'} até agora, \
{milhar(total_linhas)} linhas de código próprio, {moeda(total_usd)} de API no total.

## Os jogos

{tabela_do_readme(jogos)}

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

{detalhes_do_readme(jogos)}
---

Gerado por `tools/build.py`. Última atualização: {datetime.now().strftime('%d/%m/%Y')}.
"""

    (RAIZ / 'README.md').write_text(conteudo, encoding='utf-8')
    return len(conteudo)


def gerar_hub(jogos):
    cartoes = []
    for j in jogos:
        ia = j.get('ia') or {}
        custo = j.get('custo') or {}
        tamanho = j.get('tamanho') or {}
        destaques = (j.get('destaques') or [])[:3]
        capa = j.get('capa')
        espelho = j.get('espelho')
        slug = j['_slug']
        pasta = j['_pasta']

        src = f'games/{slug}/{capa}' if capa and (pasta / capa).exists() else ''
        imagem = (f'<img class="capa" src="{src}" alt="captura de {j.get("titulo", slug)}" loading="lazy">'
                  if src else '<div class="capa vazia">sem captura</div>')

        # O botao principal leva para a pasta do jogo DENTRO do repo. Endereco
        # externo entra como espelho, em segundo plano: o hub nao pode depender
        # de outro servidor estar no ar para alguem conseguir jogar.
        acao = f'<a class="jogar" href="games/{slug}/">JOGAR</a>'
        espelho_link = (f'<a class="secundario" href="{espelho}">espelho no servidor</a>'
                        if espelho else '')
        itens = ''.join(f'<li>{d}</li>' for d in destaques)

        cartoes.append(f"""      <article class="jogo">
        {imagem}
        <div class="corpo">
          <header>
            <h2>{j.get('titulo', slug)}</h2>
            <span class="genero">{j.get('genero', '')}</span>
          </header>
          <p class="resumo">{j.get('resumo', '')}</p>
          <ul class="destaques">{itens}</ul>
          <dl class="ficha">
            <div><dt>Escreveu</dt><dd>{ia.get('modelo', 'n/d')}</dd></div>
            <div><dt>Custo</dt><dd>{moeda(custo.get('usd_estimado'))}</dd></div>
            <div><dt>Chamadas</dt><dd>{custo.get('chamadas_api', 'n/d')}</dd></div>
            <div><dt>Linhas</dt><dd>{milhar(tamanho.get('linhas_proprias'))}</dd></div>
          </dl>
          <footer>
            {acao}
            <a class="secundario" href="games/{slug}/README.md">como foi feito</a>
            {espelho_link}
          </footer>
        </div>
      </article>""")

    total_usd = sum((j.get('custo') or {}).get('usd_estimado') or 0 for j in jogos)
    total_linhas = sum((j.get('tamanho') or {}).get('linhas_proprias') or 0 for j in jogos)

    html = f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ai-games — jogos feitos com IA</title>
<meta name="description" content="Jogos feitos conversando com IA, com o modelo que escreveu e o custo de cada um.">
<style>
  :root {{
    --bg: #05070d;
    --painel: #0a1018;
    --linha: #1b2c38;
    --ink: #d8e6e4;
    --muted: #6f8b88;
    --neon: #35f0d8;
    --ambar: #ffb347;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; background: var(--bg); color: var(--ink);
    font-family: var(--mono); line-height: 1.55;
    background-image: radial-gradient(circle at 20% -10%, rgba(53,240,216,.08), transparent 45%),
                      radial-gradient(circle at 90% 0%, rgba(255,179,71,.06), transparent 40%);
    background-repeat: no-repeat;
  }}
  .envelope {{ max-width: 1080px; margin: 0 auto; padding: 64px 22px 96px; }}
  header.topo {{ border-bottom: 1px solid var(--linha); padding-bottom: 28px; margin-bottom: 44px; }}
  .marca {{ font-size: 12px; letter-spacing: 6px; color: var(--neon); }}
  h1 {{ font-size: clamp(30px, 6vw, 52px); margin: 12px 0 10px; letter-spacing: -1px; }}
  .sub {{ color: var(--muted); max-width: 62ch; font-size: 14px; }}
  .números {{ display: flex; flex-wrap: wrap; gap: 30px; margin-top: 26px; }}
  .números div span {{ display: block; color: var(--muted); font-size: 10px; letter-spacing: 2px; }}
  .números div strong {{ font-size: 22px; color: var(--ambar); }}

  .jogo {{
    display: grid; grid-template-columns: minmax(0, 380px) 1fr; gap: 26px;
    background: var(--painel); border: 1px solid var(--linha);
    padding: 20px; margin-bottom: 28px; align-items: start;
  }}
  .capa {{ width: 100%; display: block; border: 1px solid var(--linha); background: #000; }}
  .capa.vazia {{ aspect-ratio: 16/9; display: grid; place-items: center; color: var(--muted); font-size: 12px; }}
  .corpo h2 {{ margin: 0 0 4px; font-size: 21px; letter-spacing: .5px; }}
  .gênero {{ color: var(--neon); font-size: 11px; letter-spacing: 2px; }}
  .resumo {{ color: #a9c0bd; font-size: 13px; margin: 14px 0; }}
  .destaques {{ margin: 0 0 18px; padding-left: 18px; color: var(--muted); font-size: 12px; }}
  .destaques li {{ margin-bottom: 5px; }}
  .ficha {{ display: flex; flex-wrap: wrap; gap: 22px; margin: 0 0 20px; padding: 14px 0;
            border-top: 1px solid var(--linha); border-bottom: 1px solid var(--linha); }}
  .ficha dt {{ color: var(--muted); font-size: 10px; letter-spacing: 2px; }}
  .ficha dd {{ margin: 2px 0 0; font-size: 15px; }}
  footer {{ display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }}
  .jogar {{ background: var(--neon); color: #04201c; font-weight: 700; padding: 11px 20px;
            text-decoration: none; font-size: 12px; letter-spacing: 2px; }}
  .jogar:hover {{ filter: brightness(1.15); }}
  .secundario {{ color: var(--muted); text-decoration: none; font-size: 11px;
                 letter-spacing: 1px; border-bottom: 1px solid var(--linha); padding-bottom: 1px; }}
  .secundario:hover {{ color: var(--ink); border-color: var(--neon); }}
  footer.rodape {{ border-top: 1px solid var(--linha); margin-top: 50px; padding-top: 22px;
                   color: var(--muted); font-size: 11px; }}
  footer.rodape a {{ color: var(--neon); }}
  @média (max-width: 760px) {{
    .jogo {{ grid-template-columns: 1fr; }}
    .envelope {{ padding: 40px 16px 70px; }}
  }}
</style>
</head>
<body>
<div class="envelope">
  <header class="topo">
    <div class="marca">AI-GAMES</div>
    <h1>Jogos que fiz conversando com IA</h1>
    <p class="sub">Cada jogo vive numa pasta própria e roda sozinho no navegador. Ao lado de cada um
      esta o modelo que escreveu, quantas chamadas de API levou e quanto custou de verdade.</p>
    <div class="numeros">
      <div><span>JOGOS</span><strong>{len(jogos)}</strong></div>
      <div><span>LINHAS PROPRIAS</span><strong>{milhar(total_linhas)}</strong></div>
      <div><span>CUSTO DE API</span><strong>{moeda(total_usd)}</strong></div>
    </div>
  </header>

{chr(10).join(cartoes)}

  <footer class="rodape">
    Repositório gerado por <code>tools/build.py</code> a partir dos <code>meta.json</code> de cada jogo.
    Todo jogo aqui e jogável a partir desta pasta, sem depender de outro servidor.
  </footer>
</div>
</body>
</html>
"""
    (RAIZ / 'index.html').write_text(html, encoding='utf-8')
    return len(html)


def main():
    if not PASTA_JOGOS.exists():
        print('não ha pasta games/', file=sys.stderr)
        return 1

    jogos = carregar_jogos()
    if not jogos:
        print('nenhum jogo encontrado (games/*/meta.json)', file=sys.stderr)
        return 1

    n_readme = gerar_readme(jogos)
    n_hub = gerar_hub(jogos)

    print(f'{len(jogos)} jogo(s): {", ".join(j["_slug"] for j in jogos)}')
    print(f'README.md  {n_readme} bytes')
    print(f'index.html {n_hub} bytes')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
