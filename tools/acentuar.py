#!/usr/bin/env python3
"""Acentua o texto do jogo sem estragar o codigo.

Existe porque fazer isso a mao da errado de um jeito especifico e silencioso: o
acento vaza para dentro de nome de variavel, caminho de import, seletor, chave
de dicionario e at-rule. O sintoma aparece longe da causa, entao a regra fica
escrita aqui, em um lugar so.

A regra
-------
1. Texto que o jogador le leva acento: string, template literal e comentario.
2. Codigo fica em ASCII: nome, caminho, seletor, chave, at-rule.
3. Dentro de ${...} de template e de {..} de f-string tem codigo. Acento ali so
   pode cair dentro de string.

Uso:
    python3 tools/acentuar.py            # aplica e confere
    python3 tools/acentuar.py --conferir # so confere
"""
from __future__ import annotations

import pathlib
import re
import subprocess
import sys
import unicodedata

RAIZ = pathlib.Path(__file__).resolve().parent.parent
FONTE = pathlib.Path.home() / 'games' / 'attention-is-all-you-kill'

# Palavras cujo acento depende do sentido ficam FORA daqui de propósito, e sao
# tratadas por padrao explicito: "esta" (verbo ou pronome) e "e" (verbo ou
# conjuncao) nao podem ser trocados no automatico.
DICIONARIO = {
    'nao': 'não', 'voce': 'você', 'voces': 'vocês', 'sao': 'são', 'estao': 'estão',
    'sera': 'será', 'serao': 'serão', 'tera': 'terá', 'fara': 'fará', 'dara': 'dará',
    'estara': 'estará', 'ficara': 'ficará', 'tambem': 'também', 'porem': 'porém',
    'alias': 'aliás', 'apos': 'após', 'atras': 'atrás', 'atraves': 'através', 'tras': 'trás',
    'ate': 'até', 'ja': 'já', 'so': 'só', 'alguem': 'alguém', 'ninguem': 'ninguém',
    'entao': 'então', 'alem': 'além', 'numero': 'número', 'numeros': 'números',
    'ultimo': 'último', 'ultima': 'última', 'ultimos': 'últimos', 'ultimas': 'últimas',
    'proximo': 'próximo', 'proxima': 'próxima', 'proximos': 'próximos', 'maximo': 'máximo',
    'minimo': 'mínimo', 'area': 'área', 'areas': 'áreas', 'logica': 'lógica', 'logico': 'lógico',
    'tecnico': 'técnico', 'tecnica': 'técnica', 'pratico': 'prático', 'pratica': 'prática',
    'basico': 'básico', 'automatico': 'automático', 'unico': 'único', 'unica': 'única',
    'publico': 'público', 'publica': 'pública', 'fisico': 'físico', 'codigo': 'código',
    'saida': 'saída', 'inicio': 'início', 'video': 'vídeo', 'audio': 'áudio', 'serie': 'série',
    'historia': 'história', 'memoria': 'memória', 'historico': 'histórico',
    'experiencia': 'experiência', 'referencia': 'referência', 'ciencia': 'ciência',
    'eficiencia': 'eficiência', 'frequencia': 'frequência', 'sequencia': 'sequência',
    'licenca': 'licença', 'diferenca': 'diferença', 'distancia': 'distância',
    'importancia': 'importância', 'instancia': 'instância', 'grafico': 'gráfico',
    'estatistica': 'estatística', 'medicao': 'medição', 'configuracao': 'configuração',
    'publicacao': 'publicação', 'geracao': 'geração', 'criacao': 'criação', 'animacao': 'animação',
    'posicao': 'posição', 'direcao': 'direção', 'colisao': 'colisão', 'precisao': 'precisão',
    'decisao': 'decisão', 'versao': 'versão', 'conversao': 'conversão', 'dimensao': 'dimensão',
    'padrao': 'padrão', 'opcao': 'opção', 'opcoes': 'opções', 'funcao': 'função',
    'acao': 'ação', 'acoes': 'ações', 'atencao': 'atenção', 'informacao': 'informação',
    'aplicacao': 'aplicação', 'programacao': 'programação', 'navegacao': 'navegação',
    'operacao': 'operação', 'duracao': 'duração', 'ligacao': 'ligação',
    'verificacao': 'verificação', 'apresentacao': 'apresentação', 'organizacao': 'organização',
    'documentacao': 'documentação', 'instalacao': 'instalação', 'explicacao': 'explicação',
    'comunicacao': 'comunicação', 'solucao': 'solução', 'regiao': 'região', 'questao': 'questão',
    'conclusao': 'conclusão', 'ilusao': 'ilusão', 'confusao': 'confusão', 'expansao': 'expansão',
    'tensao': 'tensão', 'extensao': 'extensão', 'pressao': 'pressão', 'missao': 'missão',
    'sessao': 'sessão', 'expressao': 'expressão', 'impressao': 'impressão',
    'progressao': 'progressão', 'revisao': 'revisão', 'previsao': 'previsão',
    'divisao': 'divisão', 'visao': 'visão', 'alucinacao': 'alucinação', 'inferencia': 'inferência',
    'preferencia': 'preferência', 'acessivel': 'acessível', 'possivel': 'possível',
    'impossivel': 'impossível', 'visivel': 'visível', 'responsavel': 'responsável',
    'disponivel': 'disponível', 'incrivel': 'incrível', 'terrivel': 'terrível',
    'horrivel': 'horrível', 'nivel': 'nível', 'util': 'útil', 'multiplo': 'múltiplo',
    'perimetro': 'perímetro', 'diametro': 'diâmetro', 'equilibrio': 'equilíbrio',
    'criterio': 'critério', 'misterio': 'mistério', 'territorio': 'território',
    'laboratorio': 'laboratório', 'armazem': 'armazém', 'municao': 'munição',
    'faccao': 'facção', 'ancoras': 'âncoras', 'ancora': 'âncora', 'espaco': 'espaço',
    'repositorio': 'repositório', 'preco': 'preço', 'dolar': 'dólar', 'milhao': 'milhão',
    'milhoes': 'milhões', 'bilhao': 'bilhão', 'estatico': 'estático', 'producao': 'produção',
    'descricao': 'descrição', 'secao': 'seção', 'cartao': 'cartão', 'cartoes': 'cartões',
    'indice': 'índice', 'catalogo': 'catálogo', 'pagina': 'página', 'dominio': 'domínio',
    'tunel': 'túnel', 'dependencia': 'dependência', 'traducao': 'tradução', 'ingles': 'inglês',
    'portugues': 'português', 'correcao': 'correção', 'titulo': 'título', 'subtitulo': 'subtítulo',
    'genero': 'gênero', 'sumario': 'sumário', 'cadencia': 'cadência', 'mudanca': 'mudança',
    'confianca': 'confiança', 'esperanca': 'esperança', 'balanco': 'balanço', 'forca': 'força',
    'reforco': 'reforço', 'comeco': 'começo', 'endereco': 'endereço', 'pedaco': 'pedaço',
    'servico': 'serviço', 'exercicio': 'exercício', 'edificio': 'edifício', 'silencio': 'silêncio',
    'privilegio': 'privilégio', 'beneficio': 'benefício', 'prejuizo': 'prejuízo', 'juizo': 'juízo',
    'paraiso': 'paraíso', 'maos': 'mãos', 'mao': 'mão', 'coracao': 'coração', 'irmao': 'irmão',
    'seculo': 'século', 'comodo': 'cômodo', 'onibus': 'ônibus', 'policia': 'polícia',
    'comercio': 'comércio', 'negocio': 'negócio', 'vocabulario': 'vocabulário',
    'conteineres': 'contêineres', 'conteiner': 'contêiner', 'cenario': 'cenário',
    'superficie': 'superfície', 'facil': 'fácil', 'obvio': 'óbvio', 'serio': 'sério',
    'chao': 'chão', 'angulo': 'ângulo', 'arvore': 'árvore', 'agua': 'água', 'otimo': 'ótimo',
    'oleo': 'óleo', 'manha': 'manhã', 'orgao': 'órgão', 'onus': 'ônus', 'lapis': 'lápis',
    'fragil': 'frágil', 'media': 'média', 'cacar': 'caçar', 'aleatorio': 'aleatório',
    'proprio': 'próprio', 'propria': 'própria', 'balao': 'balão', 'cao': 'cão',
    'comecar': 'começar', 'rapido': 'rápido', 'rapida': 'rápida', 'jogavel': 'jogável',
    'destrutivel': 'destrutível', 'atualizacao': 'atualização', 'pais': 'país', 'heroi': 'herói',
    'proposito': 'propósito', 'camera': 'câmera', 'cameras': 'câmeras', 'destroi': 'destrói',
    'concluido': 'concluído', 'concluida': 'concluída', 'desca': 'desça', 'transito': 'trânsito',
    'usavel': 'usável', 'inutil': 'inútil', 'eleicao': 'eleição', 'sancao': 'sanção',
    'tematico': 'temático', 'tematicos': 'temáticos', 'plateia': 'plateia', 'aparencia': 'aparência',
    'consequencia': 'consequência', 'ganancia': 'ganância', 'promessa': 'promessa',
    'vidro': 'vidro', 'reflete': 'reflete', 'engole': 'engole', 'polemico': 'polêmico',
    'polemica': 'polêmica', 'estrategia': 'estratégia', 'carencia': 'carência',
    'emergencia': 'emergência', 'excelencia': 'excelência', 'urgencia': 'urgência',
    'potencia': 'potência', 'violencia': 'violência', 'audiencia': 'audiência',
    'experiencia': 'experiência', 'paciencia': 'paciência', 'consciencia': 'consciência',
}

# Casos de sentido, revisados um por um. Entram como padrao de contexto porque a
# troca cega de "esta" ou de "e" estragaria o texto nos casos em que a palavra e
# pronome ou conjuncao.
CONTEXTO = [
    (r'\bque e\b', 'que é'), (r'\bQue e\b', 'Que é'),
    (r'\bisto e\b', 'isto é'), (r'\bIsto e\b', 'Isto é'),
    (r'\bisso e\b', 'isso é'), (r'\bIsso e\b', 'Isso é'),
    (r'\bVocê e\b', 'Você é'), (r'\bvocê e\b', 'você é'),
    (r'\bEle e\b', 'Ele é'), (r'\bela e\b', 'ela é'),
    (r'\bAqui e\b', 'Aqui é'), (r'\baqui e\b', 'aqui é'),
    (r'\bO jogo e\b', 'O jogo é'), (r'\bo jogo e\b', 'o jogo é'),
    (r'\bnão e\b', 'não é'), (r'\bNão e\b', 'Não é'),
    (r'</b> é a\b', '</b> é a'), (r'</b> é o\b', '</b> é o'),
    (r'\bVocê esta\b', 'Você está'), (r'\bvocê esta\b', 'você está'),
    (r'\bque esta\b', 'que está'), (r'\besta no\b', 'está no'), (r'\besta em\b', 'está em'),
    (r'\bSalas vem\b', 'Salas vêm'), (r'\bos nos de\b', 'os nós de'),
    (r'\bpara usa-la\b', 'para usá-la'), (r'\bLa espera\b', 'Lá espera'),
    (r'\bde proposito\b', 'de propósito'), (r'\bGire a camera\b', 'Gire a câmera'),
    (r'\b1\.6 ?s\b', '1,6s'), (r'\b2\.6 ?s\b', '2,6s'),
    (r'\b1\.6 segundo\b', '1,6 segundo'), (r'\b2\.6 segundos\b', '2,6 segundos'),
]


def sem_acento(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn')


def com_acento(txt: str) -> str:
    def troca(m: re.Match) -> str:
        p = m.group(0)
        b = p.lower()
        if b not in DICIONARIO:
            return p
        novo = DICIONARIO[b]
        if p.isupper():
            return novo.upper()
        if p[0].isupper():
            return novo[0].upper() + novo[1:]
        return novo

    return re.sub(r'\b[A-Za-zÀ-ÿ]+\b', troca, txt)


def acentuar(texto: str) -> str:
    """Percorre a fonte e acentua so o que é texto."""
    saida: list[str] = []
    i, n = 0, len(texto)

    while i < n:
        ch = texto[i]

        if texto.startswith('//', i):
            fim = texto.find('\n', i)
            fim = n if fim == -1 else fim
            saida.append(com_acento(texto[i:fim]))
            i = fim
            continue

        if texto.startswith('/*', i):
            fim = texto.find('*/', i + 2)
            fim = n if fim == -1 else fim + 2
            saida.append(com_acento(texto[i:fim]))
            i = fim
            continue

        if ch in ('"', "'"):
            q = ch
            j = i + 1
            while j < n and texto[j] != q:
                if texto[j] == '\\':
                    j += 2
                    continue
                j += 1
            j = min(j + 1, n)
            saida.append(com_acento(texto[i:j]))
            i = j
            continue

        if ch == '`':
            j = i + 1
            pedacos = ['`']
            texto_pendente = ''
            while j < n:
                if texto[j] == '\\':
                    texto_pendente += texto[j:j + 2]
                    j += 2
                    continue
                if texto[j] == '`':
                    pedacos.append(texto_pendente + '`')
                    texto_pendente = ''
                    j += 1
                    break
                if texto.startswith('${', j):
                    prof = 1
                    k = j + 2
                    while k < n and prof:
                        if texto[k] == '{':
                            prof += 1
                        elif texto[k] == '}':
                            prof -= 1
                        k += 1
                    pedacos.append(texto_pendente)
                    texto_pendente = ''
                    pedacos.append('${' + acentuar(texto[j + 2:k - 1]) + '}')
                    j = k
                    continue
                texto_pendente += texto[j]
                j += 1
            pedacos.append(texto_pendente)
            saida.append(''.join(p if p.startswith('${') else com_acento(p) for p in pedacos))
            i = j
            continue

        saida.append(ch)
        i += 1

    return ''.join(saida)


def normalizar_tecnico(texto: str) -> str:
    """Endereco, seletor e nome de atributo voltam para ASCII.

    Eles casam com o nome real do arquivo, do elemento ou da classe. Acento aqui
    nao deixa nada mais bonito, deixa o import quebrado.
    """
    texto = re.sub(r"(from\s*['\"])([^'\"]+)(['\"])",
                   lambda m: m.group(1) + sem_acento(m.group(2)) + m.group(3), texto)
    texto = re.sub(r"(import\s*\(\s*['\"])([^'\"]+)(['\"])",
                   lambda m: m.group(1) + sem_acento(m.group(2)) + m.group(3), texto)
    texto = re.sub(r"((?:getElementById|querySelector|querySelectorAll|closest|matches|"
                   r"classList\.(?:add|remove|toggle|contains))\(\s*['\"])([^'\"]+)(['\"])",
                   lambda m: m.group(1) + sem_acento(m.group(2)) + m.group(3), texto)
    texto = re.sub(r'((?:class|id)=")([^"$]*?)(")',
                   lambda m: m.group(1) + sem_acento(m.group(2)) + m.group(3), texto)
    return texto


def normalizar_chaves_python(texto: str) -> str:
    """Chave de dicionario e identificador: 'titulo', nunca 'título'.

    Se a chave muda, o acesso em outro lugar (que continua em ASCII) deixa de
    encontrar o valor e o codigo cai no padrao.
    """
    texto = re.sub(r"\.get\(\s*(['\"])([^'\"]+)\1",
                   lambda m: '.get(' + m.group(1) + sem_acento(m.group(2)) + m.group(1), texto)
    texto = re.sub(r"\[\s*(['\"])([^'\"]+)\1\s*\]",
                   lambda m: '[' + m.group(1) + sem_acento(m.group(2)) + m.group(1) + ']', texto)
    return texto


def normalizar_chaves_json(caminho: pathlib.Path) -> bool:
    import json

    bruto = caminho.read_text(encoding='utf-8')
    try:
        dados = json.loads(bruto)
    except json.JSONDecodeError:
        return False

    def arruma(o):
        if isinstance(o, dict):
            return {sem_acento(k): arruma(v) for k, v in o.items()}
        if isinstance(o, list):
            return [arruma(x) for x in o]
        return o

    novo = json.dumps(arruma(dados), indent=2, ensure_ascii=False) + '\n'
    if novo != bruto:
        caminho.write_text(novo, encoding='utf-8')
        return True
    return False


def acentuar_python(texto: str) -> str:
    """Em f-string, {expressao} e codigo: nome de variavel fica em ASCII."""
    def conserta(m: re.Match) -> str:
        return '{' + sem_acento(m.group(1)) + '}'

    anterior = None
    while anterior != texto:
        anterior = texto
        texto = re.sub(r'\{([^{}\n]*)\}', conserta, texto)
    for padrao, novo in CONTEXTO:
        texto = re.sub(padrao, novo, texto)
    return texto


def arquivos_alvo() -> list[pathlib.Path]:
    alvos = []
    for raiz in (FONTE, RAIZ):
        if not raiz.exists():
            continue
        alvos += [p for p in raiz.glob('**/*')
                  if p.suffix in ('.js', '.css', '.html', '.md', '.json', '.py')
                  and 'vendor' not in p.parts and '.git' not in p.parts]
    return sorted(set(alvos))


def main() -> int:
    so_conferir = '--conferir' in sys.argv
    mudados = 0

    for p in arquivos_alvo():
        try:
            t = p.read_text(encoding='utf-8')
        except (UnicodeDecodeError, IsADirectoryError):
            continue
        if p.suffix == '.py':
            novo = normalizar_chaves_python(acentuar_python(t))
        elif p.suffix == '.json':
            novo = t  # chave e valor em JSON sao tratados abaixo, com o parser
        else:
            novo = normalizar_tecnico(acentuar(t))
        for padrao, troca in CONTEXTO:
            novo = re.sub(padrao, troca, novo)
        if novo != t and not so_conferir:
            p.write_text(novo, encoding='utf-8')
            mudados += 1
            print('ajustado:', p.relative_to(p.anchor))

    for p in arquivos_alvo():
        if p.suffix == '.json' and not so_conferir and normalizar_chaves_json(p):
            mudados += 1
            print('chaves normalizadas:', p.name)

    print(f'{mudados} arquivo(s) ajustado(s)')
    r = subprocess.run([sys.executable, str(RAIZ / 'tools' / 'verificar.py')],
                       capture_output=True, text=True)
    print(r.stdout.strip())
    return 0 if r.returncode == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
