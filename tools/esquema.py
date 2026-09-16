#!/usr/bin/env python3
"""O contrato do meta.json: o que um jogo precisa declarar para entrar no indice.

Este repositorio e coletivo. Cada pessoa manda um jogo numa pasta, e o indice, o
README e o benchmark saem dos meta.json — ninguem edita lista a mao. Isso so se
sustenta se todo meta.json falar a mesma lingua, e e esse acordo que mora aqui.

Um modulo so, sem dependencia externa, usado por tres lados:

    tools/validar.py    barra meta.json torto antes do merge (e o que a CI roda)
    tools/build.py      gera README, hub e benchmark a partir do que foi validado
    tools/novo_jogo.py  cria o esqueleto ja no formato certo

Duas regras que valem para o arquivo inteiro:

1. Chave de JSON e ASCII. Valor leva acento a vontade. Chave acentuada ja quebrou
   este repositorio duas vezes, porque o erro e silencioso: some do indice.
2. O formato antigo (um jogo, um modelo, `ia` e `custo` como objeto) continua
   valendo. `normalizar()` traduz para o formato novo, entao jogo antigo nao
   precisa ser reescrito para o indice continuar de pe.
"""
from __future__ import annotations

import datetime as _dt
import re
import unicodedata

VERSAO_ESQUEMA = 1

# Estado do jogo em quem abre o link: nao e maturidade do codigo, e o que a
# pessoa encontra ao clicar em JOGAR.
ESTADOS = ('jogavel', 'prototipo', 'em-progresso')

# De onde vem o numero de tokens. Um benchmark coletivo vive disso: sem dizer se
# o numero foi lido do billing ou estimado no olho, a soma nao significa nada.
CONFIANCAS = ('medido', 'estimado', 'parcial')

CAMPOS_TOKENS = ('entrada', 'saida', 'cache_leitura', 'cache_escrita')

# A previa e o loop que toca no cartao do hub. Video e imagem animada
# entram; formato que o navegador nao toca sozinho, nao. Sempre mudo e sem
# controle: quem quiser som e interacao clica em JOGAR.
EXTENSOES_PREVIA = ('.webp', '.gif', '.mp4', '.webm')

# Acima disso a previa continua valendo, mas vira aviso. Quem abre o hub pelo
# celular paga essa conta; recusar um PR por alguns KB custa mais
# contribuicao do que ganha.
PREVIA_MB_MAX = 4.0

RE_SLUG = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
RE_DATA = re.compile(r'^\d{4}-\d{2}-\d{2}$')
RE_GITHUB = re.compile(r'^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$')
NAO_ASCII = re.compile(r'[^\x00-\x7F]')


def sem_acento(texto: str) -> str:
    """Compara valor de enum sem depender de acento: 'jogavel' == 'jogável'."""
    if not isinstance(texto, str):
        return ''
    plano = unicodedata.normalize('NFD', texto)
    plano = ''.join(c for c in plano if unicodedata.category(c) != 'Mn')
    return plano.strip().lower().replace(' ', '-').replace('_', '-')


# --------------------------------------------------------------------------
# normalizacao: de qualquer formato aceito para um formato so
# --------------------------------------------------------------------------

def _lista(valor):
    if valor is None:
        return []
    if isinstance(valor, list):
        return valor
    return [valor]


def _inteiro(valor):
    """Aceita 1294216, '1294216' e '1.294.216'. Numero de token vem colado de
    painel de ferramenta, e cada painel formata de um jeito."""
    if isinstance(valor, bool) or valor is None:
        return 0
    if isinstance(valor, (int, float)):
        return int(valor)
    if isinstance(valor, str):
        limpo = re.sub(r'[^\d]', '', valor)
        return int(limpo) if limpo else 0
    return 0


def _decimal(valor):
    if isinstance(valor, bool) or valor is None:
        return None
    if isinstance(valor, (int, float)):
        return float(valor)
    if isinstance(valor, str):
        limpo = valor.replace('US$', '').replace('$', '').strip().replace(',', '.')
        limpo = re.sub(r'[^\d.]', '', limpo)
        try:
            return float(limpo)
        except ValueError:
            return None
    return None


def _normalizar_autor(bruto):
    if isinstance(bruto, str):
        # "@fulano" ou "Fulano" — o mais curto que alguem escreveria na pressa
        apelido = bruto.strip().lstrip('@')
        if RE_GITHUB.match(apelido):
            return {'nome': apelido, 'github': apelido, 'site': ''}
        return {'nome': bruto.strip(), 'github': '', 'site': ''}
    if isinstance(bruto, dict):
        return {
            'nome': (bruto.get('nome') or bruto.get('name') or '').strip(),
            'github': (bruto.get('github') or '').strip().lstrip('@'),
            'site': (bruto.get('site') or bruto.get('url') or '').strip(),
        }
    return {'nome': '', 'github': '', 'site': ''}


def _normalizar_ia(bruto, custo_solto):
    """Uma entrada de IA: qual modelo, por qual ferramenta, quanto consumiu.

    No formato antigo o custo vinha num objeto `custo` separado, ao lado de um
    `ia` que so descrevia o modelo. Quando ha uma entrada so, os dois se juntam
    aqui — e o caso de todo jogo escrito antes deste esquema existir.
    """
    bruto = bruto if isinstance(bruto, dict) else {}
    custo_solto = custo_solto if isinstance(custo_solto, dict) else {}

    tokens_brutos = bruto.get('tokens')
    if not isinstance(tokens_brutos, dict):
        tokens_brutos = {}

    tokens = {}
    for campo in CAMPOS_TOKENS:
        valor = tokens_brutos.get(campo)
        if valor is None:
            # formato antigo: tokens_entrada, tokens_saida... dentro de `custo`
            valor = bruto.get(f'tokens_{campo}', custo_solto.get(f'tokens_{campo}'))
        tokens[campo] = _inteiro(valor)

    usd = bruto.get('usd_estimado')
    if usd is None:
        usd = custo_solto.get('usd_estimado')

    chamadas = bruto.get('chamadas_api')
    if chamadas is None:
        chamadas = custo_solto.get('chamadas_api')

    return {
        'modelo': (bruto.get('modelo') or '').strip(),
        'provider': (bruto.get('provider') or '').strip(),
        'agente': (bruto.get('agente') or '').strip(),
        'papel': (bruto.get('papel') or bruto.get('interacao') or '').strip(),
        'chamadas_api': _inteiro(chamadas),
        'tokens': tokens,
        'usd_estimado': _decimal(usd),
    }


def normalizar(dados: dict, slug: str) -> dict:
    """Devolve o jogo no formato canonico, com toda chave que o resto do
    codigo consulta ja presente. Quem chama nunca precisa de `.get()` com
    valor padrao, e nao precisa saber em que formato o arquivo foi escrito."""
    dados = dados if isinstance(dados, dict) else {}
    custo_solto = dados.get('custo') if isinstance(dados.get('custo'), dict) else {}

    ias = [_normalizar_ia(i, custo_solto) for i in _lista(dados.get('ia'))]
    if not ias and custo_solto:
        ias = [_normalizar_ia({}, custo_solto)]

    medicao = dados.get('medicao') if isinstance(dados.get('medicao'), dict) else {}
    tamanho = dados.get('tamanho') if isinstance(dados.get('tamanho'), dict) else {}

    return {
        'esquema': _inteiro(dados.get('esquema')) or VERSAO_ESQUEMA,
        'slug': (dados.get('slug') or slug).strip(),
        'titulo': (dados.get('titulo') or slug).strip(),
        'subtitulo': (dados.get('subtitulo') or '').strip(),
        'genero': (dados.get('genero') or '').strip(),
        'plataforma': (dados.get('plataforma') or '').strip(),
        'estado': (dados.get('estado') or 'jogavel').strip(),
        'criado': (dados.get('criado') or '').strip(),
        'licenca': (dados.get('licenca') or '').strip(),
        'capa': (dados.get('capa') or '').strip(),
        'previa': (dados.get('previa') or '').strip(),
        'repo': (dados.get('repo') or '').strip(),
        'resumo': (dados.get('resumo') or '').strip(),
        'autores': [_normalizar_autor(a) for a in _lista(dados.get('autores') or dados.get('autor'))],
        'ia': ias,
        'medicao': {
            'metodo': (medicao.get('metodo') or custo_solto.get('fonte') or '').strip(),
            'confianca': (medicao.get('confianca') or '').strip(),
            'medido_em': (medicao.get('medido_em') or custo_solto.get('medido_em') or '').strip(),
            'nota': (medicao.get('nota') or custo_solto.get('nota') or '').strip(),
        },
        'stack': [str(s) for s in _lista(dados.get('stack'))],
        'tamanho': {
            'linhas_proprias': _inteiro(tamanho.get('linhas_proprias')),
            'mb': _decimal(tamanho.get('mb')),
            'modulos_js': _inteiro(tamanho.get('modulos_js')),
        },
        'destaques': [str(d) for d in _lista(dados.get('destaques'))],
        'arquivos_chave': [a for a in _lista(dados.get('arquivos_chave')) if isinstance(a, dict)],
    }


# --------------------------------------------------------------------------
# totais: o que o benchmark soma
# --------------------------------------------------------------------------

def totais(jogo: dict) -> dict:
    """Soma as entradas de IA de um jogo ja normalizado.

    `tokens_novos` (entrada + saida) e separado de `tokens_cache` de proposito.
    Cache e o numero que estoura: uma sessao longa reenvia o contexto todo a cada
    turno, e quanto disso vira leitura de cache depende da ferramenta, nao do
    jogo. Somar os dois num numero so compara agente com agente, nao trabalho com
    trabalho — entao o benchmark ordena por tokens novos e mostra o cache ao lado.
    """
    entrada = sum(i['tokens']['entrada'] for i in jogo['ia'])
    saida = sum(i['tokens']['saida'] for i in jogo['ia'])
    cache = sum(i['tokens']['cache_leitura'] + i['tokens']['cache_escrita'] for i in jogo['ia'])
    # Arredondar a soma nao e capricho: o Python 3.12 passou a usar somatorio
    # compensado no sum() de float, entao a MESMA soma da valores diferentes
    # em 3.11 e em 3.12+. Sem isto, o arquivo gerado depende da versao do
    # Python de quem rodou, e build.py --conferir acusa desatualizado numa
    # maquina que so tem uma versao diferente da CI.
    usd = round(sum(i['usd_estimado'] or 0 for i in jogo['ia']), 4)
    return {
        'tokens_entrada': entrada,
        'tokens_saida': saida,
        'tokens_novos': entrada + saida,
        'tokens_cache': cache,
        'tokens_totais': entrada + saida + cache,
        'usd': usd,
        'chamadas_api': sum(i['chamadas_api'] for i in jogo['ia']),
        'linhas': jogo['tamanho']['linhas_proprias'],
        'tem_custo': any(i['usd_estimado'] is not None for i in jogo['ia']),
    }


def modelos_do_jogo(jogo: dict) -> list:
    """Modelos distintos, na ordem em que foram declarados."""
    vistos, saida = set(), []
    for i in jogo['ia']:
        if i['modelo'] and i['modelo'] not in vistos:
            vistos.add(i['modelo'])
            saida.append(i['modelo'])
    return saida


# --------------------------------------------------------------------------
# validacao
# --------------------------------------------------------------------------

class Problema:
    """Um achado. `grave` decide se a CI barra o merge ou so avisa."""

    def __init__(self, campo, mensagem, grave=True):
        self.campo = campo
        self.mensagem = mensagem
        self.grave = grave

    def __str__(self):
        marca = 'erro ' if self.grave else 'aviso'
        return f'{marca}  {self.campo}: {self.mensagem}'


def _chaves_ascii(dados, caminho=''):
    """Chave acentuada nao quebra o JSON, quebra quem le. Pegar aqui e barato."""
    achados = []
    if isinstance(dados, dict):
        for chave, valor in dados.items():
            if NAO_ASCII.search(str(chave)):
                achados.append(Problema(f'{caminho}{chave}',
                                        'chave de JSON precisa ser ASCII (o acento vai no valor)'))
            achados += _chaves_ascii(valor, f'{caminho}{chave}.')
    elif isinstance(dados, list):
        for item in dados:
            achados += _chaves_ascii(item, caminho)
    return achados


def validar(bruto: dict, slug: str, pasta=None) -> list:
    """Confere um meta.json. Devolve a lista de problemas; vazia e aprovado.

    `pasta` e opcional: com ela, tambem confere o que o arquivo promete existir
    (o index.html do jogo, a capa). Sem ela, valida so o conteudo.
    """
    achados = _chaves_ascii(bruto)
    jogo = normalizar(bruto, slug)

    # --- identidade -------------------------------------------------------
    if not RE_SLUG.match(slug):
        achados.append(Problema('slug', f'pasta "{slug}" precisa ser minuscula-com-hifen'))
    if jogo['slug'] != slug:
        achados.append(Problema('slug', f'diz "{jogo["slug"]}" mas a pasta e "{slug}"'))
    if not jogo['titulo'] or jogo['titulo'] == slug:
        achados.append(Problema('titulo', 'faltando'))
    if not jogo['resumo']:
        achados.append(Problema('resumo', 'faltando: e o texto que aparece no cartao do hub'))
    elif len(jogo['resumo']) < 40:
        achados.append(Problema('resumo', 'muito curto para o cartao do hub', grave=False))
    if not jogo['genero']:
        achados.append(Problema('genero', 'faltando', grave=False))

    if sem_acento(jogo['estado']) not in ESTADOS:
        achados.append(Problema('estado', f'"{jogo["estado"]}" nao e um de {", ".join(ESTADOS)}'))

    if not RE_DATA.match(jogo['criado']):
        achados.append(Problema('criado', 'faltando ou fora do formato AAAA-MM-DD'))
    else:
        try:
            _dt.date.fromisoformat(jogo['criado'])
        except ValueError:
            achados.append(Problema('criado', f'"{jogo["criado"]}" nao e uma data valida'))

    if not jogo['licenca']:
        achados.append(Problema('licenca', 'faltando: diga sob qual licenca o jogo entra'))

    # --- autoria ----------------------------------------------------------
    if not jogo['autores']:
        achados.append(Problema('autores', 'faltando: o benchmark e coletivo, o credito tem dono'))
    for n, autor in enumerate(jogo['autores']):
        if not autor['nome']:
            achados.append(Problema(f'autores[{n}].nome', 'faltando'))
        if autor['github'] and not RE_GITHUB.match(autor['github']):
            achados.append(Problema(f'autores[{n}].github',
                                    f'"{autor["github"]}" nao parece um usuario do GitHub'))

    # --- a parte que e o benchmark ---------------------------------------
    if not jogo['ia']:
        achados.append(Problema('ia', 'faltando: sem modelo declarado o jogo fica fora do benchmark'))

    for n, ia in enumerate(jogo['ia']):
        if not ia['modelo']:
            achados.append(Problema(f'ia[{n}].modelo', 'faltando'))
        if not ia['provider']:
            achados.append(Problema(f'ia[{n}].provider', 'faltando', grave=False))
        if not ia['agente']:
            achados.append(Problema(f'ia[{n}].agente',
                                    'faltando: qual ferramenta dirigiu o modelo', grave=False))
        for campo in CAMPOS_TOKENS:
            if ia['tokens'][campo] < 0:
                achados.append(Problema(f'ia[{n}].tokens.{campo}', 'negativo'))
        if ia['tokens']['entrada'] + ia['tokens']['saida'] == 0:
            achados.append(Problema(f'ia[{n}].tokens',
                                    'entrada e saida zeradas: o benchmark conta tokens'))
        if ia['usd_estimado'] is None:
            achados.append(Problema(f'ia[{n}].usd_estimado', 'faltando', grave=False))
        elif ia['usd_estimado'] < 0:
            achados.append(Problema(f'ia[{n}].usd_estimado', 'negativo'))

    confianca = sem_acento(jogo['medicao']['confianca'])
    if not confianca:
        achados.append(Problema('medicao.confianca',
                                f'faltando: diga se o numero foi {", ".join(CONFIANCAS)}'))
    elif confianca not in CONFIANCAS:
        achados.append(Problema('medicao.confianca',
                                f'"{jogo["medicao"]["confianca"]}" nao e um de {", ".join(CONFIANCAS)}'))
    if not jogo['medicao']['metodo']:
        achados.append(Problema('medicao.metodo',
                                'faltando: de onde saiu o numero de tokens', grave=False))

    # --- tamanho e destaques ---------------------------------------------
    if jogo['tamanho']['linhas_proprias'] <= 0:
        achados.append(Problema('tamanho.linhas_proprias',
                                'faltando: e a escala do que a IA escreveu', grave=False))
    if not jogo['destaques']:
        achados.append(Problema('destaques', 'faltando: tres bastam', grave=False))

    # --- previa -----------------------------------------------------------
    if jogo['previa']:
        if not jogo['previa'].lower().endswith(EXTENSOES_PREVIA):
            achados.append(Problema('previa',
                                    f'"{jogo["previa"]}" nao termina em '
                                    f'{", ".join(EXTENSOES_PREVIA)}'))
        # A capa e o que aparece antes de o video decodificar, e o que fica
        # quando a pessoa pediu menos movimento no sistema, e o que vai no
        # cartao de compartilhamento. Previa sem capa e cartao que pisca vazio.
        if not jogo['capa']:
            achados.append(Problema('capa',
                                    'obrigatoria quando ha previa: e o que aparece '
                                    'antes de a previa carregar'))

    # --- o que o arquivo promete que existe -------------------------------
    if pasta is not None:
        if not (pasta / 'index.html').exists():
            achados.append(Problema('index.html',
                                    'a pasta do jogo precisa de um index.html que abre o jogo'))
        if jogo['capa']:
            if not (pasta / jogo['capa']).exists():
                achados.append(Problema('capa', f'"{jogo["capa"]}" nao existe na pasta'))
        elif not jogo['previa']:
            # Com previa, a falta da capa ja saiu como erro la em cima; repetir
            # aqui como aviso so faz a pessoa procurar dois problemas onde ha um.
            achados.append(Problema('capa', 'faltando: o cartao do hub fica sem imagem', grave=False))
        if jogo['previa']:
            arquivo = pasta / jogo['previa']
            if not arquivo.exists():
                achados.append(Problema('previa', f'"{jogo["previa"]}" nao existe na pasta'))
            else:
                mb = arquivo.stat().st_size / (1024 * 1024)
                if mb > PREVIA_MB_MAX:
                    achados.append(Problema(
                        'previa',
                        f'{mb:.1f} MB passa dos {PREVIA_MB_MAX:.0f} MB recomendados: '
                        f'quem abre o hub pelo celular baixa isso',
                        grave=False))
        for n, arq in enumerate(jogo['arquivos_chave']):
            caminho = arq.get('caminho', '')
            if caminho and not (pasta / caminho).exists():
                achados.append(Problema(f'arquivos_chave[{n}]',
                                        f'"{caminho}" nao existe na pasta', grave=False))

    return achados
