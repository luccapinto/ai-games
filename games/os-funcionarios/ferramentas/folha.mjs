// Folha de contato montada no próprio Chrome (canvas), sem dependências.
//   await folha(b, [{ arquivo, rotulo }], { colunas: 4, largura: 480, saida: 'folha.jpg' })
import fs from 'node:fs';

export async function folha(b, celulas, { colunas = 4, largura = 480, altura = Math.round(largura * 9 / 16), saida, titulo = '' } = {}) {
  const linhas = Math.ceil(celulas.length / colunas);
  const topo = titulo ? 40 : 0;
  await b.eval(`(() => { const c = document.createElement('canvas'); c.width = ${colunas * largura}; c.height = ${linhas * altura + topo};
    const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
    if (${JSON.stringify(titulo)}) { g.fillStyle = '#fff'; g.font = 'bold 24px sans-serif'; g.fillText(${JSON.stringify(titulo)}, 12, 28); }
    window.__folha = { c, g }; return 1; })()`);
  for (let i = 0; i < celulas.length; i++) {
    const { arquivo, rotulo = '' } = celulas[i];
    const url = 'data:image/jpeg;base64,' + fs.readFileSync(arquivo).toString('base64');
    const x = (i % colunas) * largura, y = Math.floor(i / colunas) * altura + topo;
    await b.eval(`new Promise(ok => { const im = new Image(); im.onload = () => { const { g } = window.__folha;
      g.drawImage(im, ${x}, ${y}, ${largura}, ${altura});
      g.font = 'bold ${Math.max(14, Math.round(largura / 24))}px sans-serif'; const t = ${JSON.stringify(rotulo)};
      if (t) { const w = g.measureText(t).width; g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(${x}, ${y}, w + 14, ${Math.max(14, Math.round(largura / 24)) + 12});
        g.fillStyle = '#ffe14a'; g.fillText(t, ${x} + 7, ${y} + ${Math.max(14, Math.round(largura / 24)) + 4}); }
      g.strokeStyle = '#000'; g.lineWidth = 2; g.strokeRect(${x}, ${y}, ${largura}, ${altura}); ok(1); }; im.src = ${JSON.stringify(url)}; })`);
  }
  const dados = await b.eval(`window.__folha.c.toDataURL('image/jpeg', 0.86)`);
  fs.writeFileSync(saida, Buffer.from(dados.split(',')[1], 'base64'));
  await b.eval('(delete window.__folha, 1)');
  return saida;
}
