// Provas de que a BANCA roda sem rede: o service worker guarda exatamente os
// arquivos que o jogo usa, todo import aponta para um arquivo guardado e
// nenhum arquivo do jogo busca nada fora da própria pasta.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, normalize } from 'node:path';
import { bloco, prova, ok, relatar } from './base.mjs';

const RAIZ = new URL('..', import.meta.url).pathname;
const ler = p => readFileSync(join(RAIZ, p), 'utf8');

function listar(dir) {
  const saida = [];
  for (const nome of readdirSync(join(RAIZ, dir))) {
    const p = join(dir, nome);
    if (statSync(join(RAIZ, p)).isDirectory()) saida.push(...listar(p));
    else saida.push(p);
  }
  return saida;
}

const sw = ler('sw.js');
const guardados = new Set(sw.match(/const ARQUIVOS = \[([\s\S]*?)\];/)[1].match(/'[^']+'/g).map(s => s.slice(1, -1)));

// o que o navegador carrega: a página, o manifesto, o ícone, estilos, fontes e scripts
const EM_USO = [
  'index.html', 'manifest.webmanifest', 'icone.svg',
  ...listar('css'), ...listar('js'), ...listar('fontes').filter(f => f.endsWith('.woff2')),
];

bloco('offline');

prova('o service worker guarda todos os arquivos do jogo, e só os que existem', () => {
  for (const f of EM_USO) ok(guardados.has(f), `fora do cache offline: ${f}`);
  for (const f of guardados) if (f !== './') ok(existsSync(join(RAIZ, f)), `o cache pede um arquivo que não existe: ${f}`);
  ok(guardados.has('./'), 'a pasta (./) também precisa estar guardada');
  ok(/const VERSAO = 'banca-v\d+'/.test(sw), 'versão do cache');
});

prova('todo import, worker e link da página aponta para um arquivo guardado', () => {
  let n = 0;
  for (const f of EM_USO.filter(f => f.endsWith('.js'))) {
    const t = ler(f);
    const alvos = [
      ...[...t.matchAll(/\bimport\s[^'"]*?from\s*['"]([^'"]+)['"]/g)].map(m => m[1]),
      ...[...t.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]),
      ...[...t.matchAll(/new URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g)].map(m => m[1]),
    ];
    for (const a of alvos) {
      const destino = normalize(join(dirname(f), a));
      ok(guardados.has(destino), `${f} importa ${a}, que não está no cache`);
      n++;
    }
  }
  const html = ler('index.html');
  for (const [, a] of html.matchAll(/(?:href|src)="([^"#:]+)"/g)) {
    ok(guardados.has(normalize(a)), `index.html aponta para ${a}, que não está no cache`);
    n++;
  }
  for (const css of EM_USO.filter(f => f.endsWith('.css'))) {
    for (const [, a] of ler(css).matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      if (a.startsWith('data:') || a.startsWith('#')) continue;
      ok(guardados.has(normalize(join(dirname(css), a))), `${css} usa ${a}, que não está no cache`);
      n++;
    }
  }
  relatar(`  offline   ${guardados.size} arquivos no cache; ${n} referências entre eles, todas guardadas`);
});

prova('nenhum arquivo do jogo busca nada na rede', () => {
  for (const f of EM_USO.filter(f => /\.(js|css|html|webmanifest|svg)$/.test(f))) {
    const t = ler(f).replace(/http:\/\/www\.w3\.org\/[0-9]{4}\/(svg|xlink)/g, '');
    const m = t.match(/(https?:)?\/\/[a-z0-9-]+\.[a-z]{2,}[^\s'"`)]*/i);
    ok(!m, `${f} aponta para fora: ${m && m[0]}`);
    ok(!/@import\s+url\(\s*['"]?https?:/i.test(t), `${f} importa estilo remoto`);
  }
});

prova('o manifesto aponta para ícone e página que existem', () => {
  const m = JSON.parse(ler('manifest.webmanifest'));
  ok(existsSync(join(RAIZ, m.start_url)), `start_url ${m.start_url}`);
  for (const i of m.icons) ok(existsSync(join(RAIZ, i.src)), `ícone ${i.src}`);
  ok(m.display === 'standalone', 'display');
});
