#!/usr/bin/env python3
"""Cria a pasta de um jogo novo, ja no formato que o indice entende.

A primeira coisa que alguem faz ao contribuir e a mais facil de errar: em que
pasta, com que nome, que arquivo precisa existir, que campo o meta.json quer. Em
vez de escrever isso num guia e torcer, o esqueleto sai pronto daqui — com um
jogo minusculo que ja abre no navegador, para a pessoa ter algo rodando antes de
escrever a primeira linha.

    python3 tools/novo_jogo.py meu-jogo
    python3 tools/novo_jogo.py meu-jogo --titulo "MEU JOGO" --autor "Fulana" \\
        --github fulana --modelo claude-opus-5 --agente "Claude Code"

O que o script nao sabe fica em branco de proposito, e nao com texto de exemplo:
campo vazio o validador aponta pelo nome, texto de exemplo vaza para o benchmark
como se fosse dado de verdade.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import esquema  # noqa: E402
import validar as validador  # noqa: E402

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PASTA_JOGOS = RAIZ / 'games'


JOGO_EXEMPLO = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITULO__</title>
<style>
  html, body { margin: 0; height: 100%; background: #05070d; color: #d8e6e4;
               font-family: ui-monospace, Menlo, Consolas, monospace; overflow: hidden; }
  canvas { display: block; width: 100%; height: 100%; touch-action: none; }
  #aviso { position: fixed; inset: auto 0 8px 0; text-align: center; font-size: 12px;
           color: #6f8b88; pointer-events: none; }
</style>
</head>
<body>
<canvas id="tela"></canvas>
<p id="aviso">mova o mouse ou arraste — apanhe os tokens, evite o vermelho</p>
<script type="module">
// Jogo de partida. Troque por inteiro: ele existe so para a pasta ja abrir
// jogando, e para mostrar a unica regra tecnica deste repositorio — um
// index.html que roda sem build, sem servidor e sem dependencia externa.
const tela = document.getElementById('tela');
const ctx = tela.getContext('2d');
let larg = 0, alt = 0;

function redimensionar() {
  const escala = window.devicePixelRatio || 1;
  larg = tela.clientWidth; alt = tela.clientHeight;
  tela.width = larg * escala; tela.height = alt * escala;
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
}
window.addEventListener('resize', redimensionar);
redimensionar();

const BASE = 64;  // altura do jogador, acima da linha de aviso
const jogador = { x: larg / 2, r: 16 };
const quedas = [];
let pontos = 0, vidas = 3, ultimo = performance.now(), desdeSpawn = 0;

function mover(x) { jogador.x = Math.max(jogador.r, Math.min(larg - jogador.r, x)); }
addEventListener('mousemove', e => mover(e.clientX));
addEventListener('touchmove', e => { mover(e.touches[0].clientX); e.preventDefault(); },
                 { passive: false });

function quadro(agora) {
  const dt = Math.min((agora - ultimo) / 1000, 0.05);
  ultimo = agora;

  desdeSpawn += dt;
  if (desdeSpawn > 0.55) {
    desdeSpawn = 0;
    quedas.push({ x: Math.random() * larg, y: -20, v: 120 + Math.random() * 160,
                  ruim: Math.random() < 0.28 });
  }

  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, larg, alt);

  for (let i = quedas.length - 1; i >= 0; i--) {
    const q = quedas[i];
    q.y += q.v * dt;
    ctx.fillStyle = q.ruim ? '#ff5f6d' : '#35f0d8';
    ctx.fillRect(q.x - 4, q.y - 8, 8, 16);

    const perto = Math.abs(q.x - jogador.x) < jogador.r + 6 && Math.abs(q.y - (alt - BASE)) < 20;
    if (perto) {
      if (q.ruim) { vidas--; } else { pontos++; }
      quedas.splice(i, 1);
    } else if (q.y > alt + 20) {
      quedas.splice(i, 1);
    }
  }

  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.arc(jogador.x, alt - BASE, jogador.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#6f8b88';
  ctx.font = '13px ui-monospace, monospace';
  ctx.fillText(`tokens ${pontos}`, 16, 26);
  ctx.fillText(`vidas ${Math.max(vidas, 0)}`, 16, 46);

  if (vidas <= 0) {
    ctx.fillStyle = '#d8e6e4';
    ctx.font = '20px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`fim — ${pontos} tokens`, larg / 2, alt / 2);
    ctx.textAlign = 'left';
    return;
  }
  requestAnimationFrame(quadro);
}
requestAnimationFrame(quadro);
</script>
</body>
</html>
"""


LEIAME = """# __TITULO__

_Uma frase sobre o que o jogo e._

## Como jogar

Abra `index.html` no navegador, ou sirva a pasta:

```bash
python3 -m http.server 8000
```

Controles, objetivo, o que ganha e o que perde.

## Como foi feito

Conte a parte interessante: o que voce pediu, onde o modelo travou, o que
precisou refazer a mao, o que saiu melhor do que voce esperava. Esta parte e
metade do valor do repositorio — o numero de tokens diz quanto custou, esta
secao diz o que se comprou com ele.

- **Modelo:** __MODELO__
- **Agente:** __AGENTE__
- **Custo:** veja `meta.json`

## O que falta

- [ ] preencher o `meta.json` (rode `python3 tools/validar.py __SLUG__`)
- [ ] trocar o jogo de partida pelo seu
- [ ] tirar uma captura e salvar como `capa.jpg`
"""


def esqueleto_meta(slug, args, hoje):
    """Campo que o script nao sabe fica vazio, e o validador cobra pelo nome."""
    return {
        'esquema': esquema.VERSAO_ESQUEMA,
        'slug': slug,
        'titulo': args.titulo or '',
        'subtitulo': '',
        'genero': args.genero or '',
        'plataforma': 'Navegador',
        'estado': 'em-progresso',
        'criado': hoje,
        'licenca': args.licenca,
        'capa': 'capa.jpg',
        'espelho': '',
        'resumo': '',
        'autores': [{
            'nome': args.autor or '',
            'github': (args.github or '').lstrip('@'),
            'site': '',
        }],
        'ia': [{
            'modelo': args.modelo or '',
            'provider': args.provider or '',
            'agente': args.agente or '',
            'papel': '',
            'chamadas_api': 0,
            'tokens': {'entrada': 0, 'saida': 0, 'cache_leitura': 0, 'cache_escrita': 0},
            'usd_estimado': 0,
        }],
        'medicao': {
            'confianca': '',
            'metodo': '',
            'medido_em': hoje,
            'nota': '',
        },
        'stack': [],
        'tamanho': {'linhas_proprias': 0, 'mb': 0, 'modulos_js': 0},
        'destaques': [],
        'arquivos_chave': [],
    }


def main(argv=None):
    p = argparse.ArgumentParser(
        description='Cria games/<slug>/ com um jogo que ja abre e um meta.json no formato certo.')
    p.add_argument('slug', help='nome da pasta: minuscula-com-hifen')
    p.add_argument('--titulo', default='')
    p.add_argument('--genero', default='')
    p.add_argument('--autor', default='')
    p.add_argument('--github', default='')
    p.add_argument('--modelo', default='', help='ex: claude-opus-5')
    p.add_argument('--provider', default='', help='ex: Anthropic')
    p.add_argument('--agente', default='', help='a ferramenta: Claude Code, Cursor, aider...')
    p.add_argument('--licenca', default='MIT')
    args = p.parse_args(argv)

    slug = args.slug.strip().strip('/')
    if not esquema.RE_SLUG.match(slug):
        print(f'"{slug}" nao serve de pasta: use minuscula-com-hifen, sem acento', file=sys.stderr)
        return 1

    pasta = PASTA_JOGOS / slug
    if pasta.exists():
        print(f'games/{slug}/ ja existe', file=sys.stderr)
        return 1

    hoje = dt.date.today().isoformat()
    titulo = args.titulo or slug.replace('-', ' ').upper()

    pasta.mkdir(parents=True)
    (pasta / 'index.html').write_text(
        JOGO_EXEMPLO.replace('__TITULO__', titulo), encoding='utf-8')
    (pasta / 'README.md').write_text(
        LEIAME.replace('__TITULO__', titulo)
              .replace('__MODELO__', args.modelo or 'n/d')
              .replace('__AGENTE__', args.agente or 'n/d')
              .replace('__SLUG__', slug), encoding='utf-8')

    meta = esqueleto_meta(slug, args, hoje)
    meta['titulo'] = args.titulo or ''
    (pasta / 'meta.json').write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print(f'games/{slug}/ criado:')
    print('  index.html   um jogo minusculo que ja abre no navegador (troque por inteiro)')
    print('  meta.json    a ficha que entra no indice e no benchmark')
    print('  README.md    onde voce conta como foi feito')
    print()
    print(f'Abra games/{slug}/index.html no navegador para ver que a pasta ja roda.')
    print()

    problemas, _ = validador.validar_pasta(pasta)
    faltando = [p for p in problemas if p.grave]
    if faltando:
        print(f'Falta preencher no meta.json ({len(faltando)} campo(s)):')
        for item in faltando:
            print(f'  - {item.campo}: {item.mensagem}')
        print()
    print('Quando terminar:')
    print(f'  python3 tools/validar.py {slug}')
    print('  python3 tools/build.py')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
