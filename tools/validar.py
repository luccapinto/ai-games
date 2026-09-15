#!/usr/bin/env python3
"""Confere os meta.json de todos os jogos. E o que a CI roda em cada PR.

Quando o repositorio e de uma pessoa so, meta.json torto se conserta na hora.
Quando e coletivo, cada PR traz um arquivo escrito por alguem que nunca viu o
gerador, e o estrago aparece depois do merge: o jogo entra sem modelo declarado,
o benchmark soma errado, o cartao do hub sai sem imagem.

Este script e a porta. Ele so olha dados; nao escreve nada.

    python3 tools/validar.py                  todos os jogos
    python3 tools/validar.py meu-jogo         so um
    python3 tools/validar.py --rigoroso       aviso tambem reprova
"""
from __future__ import annotations

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import esquema  # noqa: E402

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PASTA_JOGOS = RAIZ / 'games'

VERDE = '\033[32m'
VERMELHO = '\033[31m'
AMARELO = '\033[33m'
CINZA = '\033[90m'
FIM = '\033[0m'


def colorir(texto, cor):
    return f'{cor}{texto}{FIM}' if sys.stdout.isatty() else texto


def validar_pasta(pasta: pathlib.Path):
    """Devolve (problemas, jogo_normalizado_ou_None)."""
    meta = pasta / 'meta.json'
    if not meta.exists():
        return [esquema.Problema('meta.json', 'a pasta nao tem meta.json')], None

    try:
        bruto = json.loads(meta.read_text(encoding='utf-8'))
    except json.JSONDecodeError as erro:
        return [esquema.Problema('meta.json', f'JSON invalido: {erro}')], None

    if not isinstance(bruto, dict):
        return [esquema.Problema('meta.json', 'a raiz do arquivo precisa ser um objeto')], None

    problemas = esquema.validar(bruto, pasta.name, pasta)
    return problemas, esquema.normalizar(bruto, pasta.name)


def main(argv):
    rigoroso = '--rigoroso' in argv
    alvos = [a for a in argv[1:] if not a.startswith('-')]

    if not PASTA_JOGOS.exists():
        print('nao ha pasta games/', file=sys.stderr)
        return 1

    pastas = [p for p in sorted(PASTA_JOGOS.iterdir())
              if p.is_dir() and not p.name.startswith(('.', '_'))]
    if alvos:
        pastas = [p for p in pastas if p.name in alvos]
        faltando = set(alvos) - {p.name for p in pastas}
        for nome in sorted(faltando):
            print(colorir(f'nao existe games/{nome}/', VERMELHO), file=sys.stderr)
        if faltando:
            return 1

    if not pastas:
        print('nenhum jogo em games/*/', file=sys.stderr)
        return 1

    total_erros = total_avisos = 0

    for pasta in pastas:
        problemas, jogo = validar_pasta(pasta)
        erros = [p for p in problemas if p.grave]
        avisos = [p for p in problemas if not p.grave]
        total_erros += len(erros)
        total_avisos += len(avisos)

        if not problemas:
            resumo = ''
            if jogo:
                soma = esquema.totais(jogo)
                modelos = ', '.join(esquema.modelos_do_jogo(jogo)) or 'sem modelo'
                resumo = colorir(f'  {modelos} | {soma["tokens_novos"]:,} tokens novos'.replace(',', '.'), CINZA)
            print(f'{colorir("ok", VERDE)}  {pasta.name}{resumo}')
            continue

        marca = colorir('FALHOU', VERMELHO) if erros else colorir('avisos', AMARELO)
        print(f'{marca}  {pasta.name}')
        for p in erros:
            print(f'   {colorir("x", VERMELHO)} {p.campo}: {p.mensagem}')
        for p in avisos:
            print(f'   {colorir("!", AMARELO)} {p.campo}: {p.mensagem}')

    print()
    print(f'{len(pastas)} jogo(s), {total_erros} erro(s), {total_avisos} aviso(s)')

    if total_erros:
        print(colorir('reprovado: corrija os erros acima', VERMELHO), file=sys.stderr)
        print('referencia dos campos: docs/ESQUEMA.md', file=sys.stderr)
        return 1
    if total_avisos and rigoroso:
        print(colorir('reprovado no modo rigoroso: os avisos contam', AMARELO), file=sys.stderr)
        return 1

    print(colorir('aprovado', VERDE))
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
