// Provas de texto: zero emoji, nenhum caractere de naipe, chaves e nomes de
// arquivo em ASCII, e as palavras que um script de acentuação costuma deixar
// para trás não aparecem em nenhum texto de interface.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { bloco, prova, ok } from './base.mjs';

const RAIZ = new URL('..', import.meta.url).pathname;

function arquivos(dir, fora = ['fontes', 'node_modules']) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (fora.includes(nome)) continue;
    if (statSync(p).isDirectory()) saida.push(...arquivos(p, fora));
    else saida.push(p);
  }
  return saida;
}

const TODOS = arquivos(RAIZ);
const FONTES = TODOS.filter(p => /\.(js|mjs|css|html|json|webmanifest)$/.test(p));

bloco('textos');

prova('nenhum emoji e nenhum caractere de naipe em código, interface ou documentação', () => {
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/u;
  for (const p of [...FONTES, ...TODOS.filter(q => q.endsWith('.md'))]) {
    const t = readFileSync(p, 'utf8');
    const m = t.match(emoji);
    ok(!m, `${relative(RAIZ, p)}: caractere ${m && m[0].codePointAt(0).toString(16)}`);
  }
});

prova('nomes de arquivo e de pasta em ASCII', () => {
  for (const p of TODOS) ok(/^[\x20-\x7e]+$/.test(relative(RAIZ, p)), `nome com acento: ${relative(RAIZ, p)}`);
});

prova('texto de interface não tem as palavras que ficam sem acento', () => {
  // palavras que só existem com acento em português; se aparecerem cruas num
  // texto, é descuido (ou um script automático que parou no meio)
  const cruas = /\b(nao|voce|voces|tambem|ate|numero|numeros|proxima|proximo|historico|possivel|estatistica|vantagem da casa e|saida|rodadas gratis|giros gratis|credito|divida|juro composto|pagina|maquina|premio|premios|sequencia|trinca e|faceis|dificil|conferencia|semente da casa e|so paga|so existe|comissao)\b/i;
  for (const p of FONTES.filter(q => /\.(js|html)$/.test(q) && !q.includes('/provas'))) {
    const linhas = readFileSync(p, 'utf8').split('\n');
    linhas.forEach((l, i) => {
      // só o que está entre aspas ou crases, onde mora o texto que o jogador lê
      // atributos de marcação (classe, id, data-*) não são texto de interface
      const semAtributos = l.replace(/\b(class|id|data-[a-z-]+|href|d)="[^"]*"/g, '');
      const strings = semAtributos.match(/(['"`])(?:(?!\1).)*\1/g) ?? [];
      for (const bruto of strings) {
        // o que está dentro de ${...} é código, não texto
        const s = bruto.replace(/\$\{[^}]*\}/g, '');
        if (/^['"`][a-z0-9_./#-]*['"`]$/i.test(s)) continue;
        const m = s.match(cruas);
        ok(!m, `${relative(RAIZ, p)}:${i + 1}: "${m && m[0]}" sem acento em ${s.slice(0, 60)}`);
      }
    });
  }
});

prova('chaves do meta.json em ASCII', () => {
  const meta = JSON.parse(readFileSync(join(RAIZ, 'meta.json'), 'utf8'));
  const chaves = [];
  (function andar(o) { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { chaves.push(k); andar(v); } })(meta);
  for (const k of chaves) ok(/^[a-z0-9_]+$/i.test(k), `chave com acento: ${k}`);
});
