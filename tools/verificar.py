#!/usr/bin/env python3
"""Confere que acento nao vazou para dentro do codigo.

O texto que o jogador le leva acento. Nome de variavel, caminho de import,
seletor, chave de dicionario e at-rule nao: ali o acento quebra o programa em
silencio, e o sintoma aparece longe da causa (o jogo nao carrega, o layout do
celular nao vale, o indice imprime o slug no lugar do nome).

Roda este script depois de mexer em texto. Ele aponta arquivo e linha.

    python3 tools/verificar.py
"""
from __future__ import annotations

import ast
import json
import pathlib
import re
import subprocess
import sys
import unicodedata

RAIZ = pathlib.Path(__file__).resolve().parent.parent

# O repositorio e coletivo: verifica todo jogo em games/, nao um so. Uma copia
# em desenvolvimento fora do repo, se existir, entra junto: e nela que mora o
# servidor de desenvolvimento, entao e ela que responde ao teste de carregamento.
def _jogos():
    pasta = RAIZ / 'games'
    if not pasta.exists():
        return []
    return [p for p in sorted(pasta.iterdir())
            if p.is_dir() and not p.name.startswith(('.', '_'))]


JOGOS = _jogos()
FONTE = pathlib.Path.home() / 'games'
COPIAS = JOGOS + [FONTE / j.name for j in JOGOS if (FONTE / j.name).exists()]
NAO_ASCII = re.compile(r'[^\x00-\x7F]')

falhas: list[str] = []


def anota(arquivo, linha, msg, trecho):
    falhas.append(f'{arquivo}:{linha}  {msg}\n      {trecho.strip()[:88]}')


def sem_texto(fonte: str) -> str:
    """Devolve a fonte com string e comentario trocados por espaco.

    O que sobra e o codigo. Sobra por linha, para o numero bater com o arquivo.
    """
    fonte = re.sub(r'`[^`]*`', ' ', fonte, flags=re.S)
    fonte = re.sub(r"'''[^']*'''", ' ', fonte, flags=re.S)
    fonte = re.sub(r'"""[^"]*"""', ' ', fonte, flags=re.S)
    fonte = re.sub(r"'[^'\n]*'", ' ', fonte)
    fonte = re.sub(r'"[^"\n]*"', ' ', fonte)
    fonte = re.sub(r'//[^\n]*', ' ', fonte)
    fonte = re.sub(r'#[^\n]*', ' ', fonte)
    fonte = re.sub(r'/\*.*?\*/', ' ', fonte, flags=re.S)
    return fonte


def checar_js(arquivo: pathlib.Path):
    bruto = arquivo.read_text(encoding='utf-8')
    codigo = sem_texto(bruto)

    for i, linha in enumerate(codigo.splitlines(), 1):
        if NAO_ASCII.search(linha):
            anota(arquivo.name, i, 'acento em codigo', bruto.splitlines()[i - 1])

    # caminho de import e seletor casam com nome de arquivo e de elemento: ASCII
    for i, linha in enumerate(bruto.splitlines(), 1):
        for m in re.finditer(r"(?:from|import\s*\()\s*['\"]([^'\"]+)['\"]", linha):
            if NAO_ASCII.search(m.group(1)):
                anota(arquivo.name, i, f'import com acento: {m.group(1)}', linha)
        for m in re.finditer(r"(?:getElementById|querySelector|querySelectorAll|classList\.\w+)\(\s*['\"]([^'\"]+)['\"]", linha):
            if NAO_ASCII.search(m.group(1)):
                anota(arquivo.name, i, f'seletor com acento: {m.group(1)}', linha)
        for m in re.finditer(r'\$\{([^{}]*)\}', linha):
            if NAO_ASCII.search(sem_texto(m.group(1))):
                anota(arquivo.name, i, f'interpolacao com acento: {m.group(1)}', linha)


def checar_css(arquivo: pathlib.Path):
    bruto = arquivo.read_text(encoding='utf-8')
    sem_comentario = re.sub(r'/\*.*?\*/', ' ', bruto, flags=re.S)
    for i, linha in enumerate(sem_comentario.splitlines(), 1):
        if re.match(r'\s*@', linha) and NAO_ASCII.search(linha):
            anota(arquivo.name, i, 'at-rule com acento', linha)
        if re.match(r'\s*[a-z-]+\s*:', linha) and NAO_ASCII.search(linha.split(':')[0]):
            anota(arquivo.name, i, 'propriedade com acento', linha)


def checar_python(arquivo: pathlib.Path):
    bruto = arquivo.read_text(encoding='utf-8')
    try:
        ast.parse(bruto)
    except SyntaxError as e:
        falhas.append(f'{arquivo.name}:{e.lineno}  sintaxe invalida: {e.msg}')
        return
    for i, linha in enumerate(bruto.splitlines(), 1):
        # chave de dicionario e identificador: ASCII
        for m in re.finditer(r"\.get\(\s*['\"]([^'\"]+)['\"]", linha):
            if NAO_ASCII.search(m.group(1)):
                anota(arquivo.name, i, f'chave com acento: {m.group(1)}', linha)
        # dentro de {..} de f-string ha expressao, nao texto
        for m in re.finditer(r'\{([^{}\n]*)\}', linha):
            if NAO_ASCII.search(m.group(1)) and ('f"' in linha or "f'" in linha):
                anota(arquivo.name, i, f'expressao de f-string com acento: {m.group(1)}', linha)


def checar_json_chaves(arquivo: pathlib.Path):
    try:
        dados = json.loads(arquivo.read_text(encoding='utf-8'))
    except json.JSONDecodeError as e:
        falhas.append(f'{arquivo.name}  JSON invalido: {e}')
        return

    def anda(o, caminho=''):
        if isinstance(o, dict):
            for k, v in o.items():
                if NAO_ASCII.search(k):
                    falhas.append(f'{arquivo.name}  chave JSON com acento: {caminho}{k}')
                anda(v, f'{caminho}{k}.')
        elif isinstance(o, list):
            for x in o:
                anda(x, caminho)

    anda(dados)


def checar_sintaxe_js():
    arquivos = [a for copia in COPIAS for a in sorted(copia.glob('js/**/*.js'))
                if 'vendor' not in a.parts]
    if not arquivos:
        return
    r = subprocess.run(['node', '--check'] + [str(a) for a in arquivos],
                       capture_output=True, text=True)
    if r.returncode != 0:
        falhas.append('node --check falhou:\n' + r.stderr.strip()[:400])


def checar_servidor():
    """O jogo carrega de fato? Sobe o servidor e pede o modulo raiz.

    So roda onde ha um serve.py, que e coisa da copia de desenvolvimento. Na
    copia publicada o jogo abre direto do arquivo, entao nao ha o que subir; e
    faltar servidor nao e falha: e o caso normal de quem clonou o repositorio.
    """
    candidatos = [c for c in COPIAS if (c / 'serve.py').exists()]
    if not candidatos:
        return
    jogo = candidatos[0]
    proc = subprocess.Popen(['python3', 'serve.py', '8155'], cwd=jogo,
                            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for _ in range(40):
            r = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
                                'http://127.0.0.1:8155/js/main.js'], capture_output=True, text=True)
            if r.stdout.strip() == '200':
                return
            if proc.poll() is not None:
                erro = (proc.stderr.read().decode()[-300:] if proc.stderr else '')
                falhas.append('o servidor morreu ao servir o jogo:\n' + erro)
                return
            import time
            time.sleep(0.15)
        falhas.append('o servidor nao respondeu em 6s')
    finally:
        proc.terminate()


def main() -> int:
    if not JOGOS:
        print('nenhum jogo em games/', file=sys.stderr)
        return 1

    checar_sintaxe_js()

    for copia in COPIAS:
        for p in sorted(copia.glob('js/**/*.js')):
            if 'vendor' not in p.parts:
                checar_js(p)
        for p in sorted(copia.glob('css/**/*.css')):
            checar_css(p)
    for p in sorted(RAIZ.glob('**/*.py')):
        if '.git' not in p.parts and 'vendor' not in p.parts:
            checar_python(p)
    for p in sorted(RAIZ.glob('**/*.json')):
        if '.git' not in p.parts:
            checar_json_chaves(p)

    checar_servidor()

    if falhas:
        print(f'{len(falhas)} problema(s):\n')
        for f in falhas:
            print(' -', f)
        return 1

    print(f'tudo certo em {len(JOGOS)} jogo(s): codigo em ASCII, texto acentuado')
    return 0


if __name__ == '__main__':
    sys.exit(main())
