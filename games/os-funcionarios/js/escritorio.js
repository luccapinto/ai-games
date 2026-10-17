// O escritório: sala, mesas, janelas, copa; grafo de caminhos para as pessoas andarem
// e caixas de colisão para o jogador. Tudo geometria simples, sem textura de arquivo.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const SALA = { x0: -9, x1: 9, z0: -7, z1: 7, h: 3.0 };

function mat(cor, ro = 0.85, extra = {}) { return new THREE.MeshStandardMaterial({ color: cor, roughness: ro, ...extra }); }
function caixa(w, h, d, m, x, y, z, sombra = true) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z); b.castShadow = sombra; b.receiveShadow = true; return b;
}

function texturaCarpete() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#5b6470'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const v = 80 + Math.random() * 40;
    g.fillStyle = `rgba(${v},${v + 8},${v + 18},0.35)`; g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  g.strokeStyle = 'rgba(30,34,40,0.35)'; g.lineWidth = 2;
  g.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 7);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function texturaQuadro(linhas, cor = '#fff') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = cor; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#1f4e79'; g.font = 'bold 34px sans-serif';
  linhas.forEach((l, i) => { g.font = i === 0 ? 'bold 38px sans-serif' : '26px sans-serif'; g.fillStyle = i === 0 ? '#1f4e79' : '#333'; g.fillText(l, 24, 56 + i * 44); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function construirEscritorio(cena) {
  const g = new THREE.Group(); g.name = 'escritorio';
  const colisores = [];          // {x0,x1,z0,z1}
  const bloqueia = (m, folga = 0.05) => {
    const bb = new THREE.Box3().setFromObject(m);
    colisores.push({ x0: bb.min.x - folga, x1: bb.max.x + folga, z0: bb.min.z - folga, z1: bb.max.z + folga });
  };
  const { x0, x1, z0, z1, h } = SALA;
  const W = x1 - x0, D = z1 - z0;

  // piso, teto, paredes
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xffffff, 0.95, { map: texturaCarpete() }));
  piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; g.add(piso);
  const teto = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xe9ecef, 0.95));
  teto.rotation.x = Math.PI / 2; teto.position.y = h; g.add(teto);
  const paredeM = mat(0xd9dcd2, 0.92);
  const pN = new THREE.Mesh(new THREE.PlaneGeometry(W, h), paredeM); pN.position.set(0, h / 2, z0); pN.receiveShadow = true; g.add(pN);
  const pS = new THREE.Mesh(new THREE.PlaneGeometry(W, h), paredeM); pS.rotation.y = Math.PI; pS.position.set(0, h / 2, z1); pS.receiveShadow = true; g.add(pS);
  const pO = new THREE.Mesh(new THREE.PlaneGeometry(D, h), paredeM); pO.rotation.y = Math.PI / 2; pO.position.set(x0, h / 2, 0); pO.receiveShadow = true; g.add(pO);
  // parede leste com janelas: faixas de parede + vidro claro
  const leste = new THREE.Group();
  const peitoril = caixa(0.12, 0.9, D, paredeM, x1, 0.45, 0, false);
  const verga = caixa(0.12, 0.5, D, paredeM, x1, h - 0.25, 0, false);
  leste.add(peitoril, verga);
  const ceu = mat(0xcfe6ff, 1, { emissive: 0xbfdcff, emissiveIntensity: 1.1 });
  for (let i = 0; i < 6; i++) {
    const z = z0 + 1.2 + i * 2.3;
    const vidro = new THREE.Mesh(new THREE.PlaneGeometry(1.9, h - 1.4), ceu);
    vidro.rotation.y = -Math.PI / 2; vidro.position.set(x1 + 0.08, 0.9 + (h - 1.4) / 2, z); leste.add(vidro);
    leste.add(caixa(0.14, h - 1.4, 0.12, mat(0x8d949b, 0.5), x1, 0.9 + (h - 1.4) / 2, z + 1.0, false));
  }
  leste.add(caixa(0.14, h - 1.4, 0.12, mat(0x8d949b, 0.5), x1, 0.9 + (h - 1.4) / 2, z0 + 0.15, false));
  g.add(leste);
  // rodapé
  const rod = mat(0x55595e, 0.6);
  g.add(caixa(W, 0.1, 0.03, rod, 0, 0.05, z0 + 0.015, false), caixa(W, 0.1, 0.03, rod, 0, 0.05, z1 - 0.015, false),
    caixa(0.03, 0.1, D, rod, x0 + 0.015, 0.05, 0, false));

  // luminárias fluorescentes
  const lum = mat(0xffffff, 0.3, { emissive: 0xf4f8ff, emissiveIntensity: 1.6 });
  for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.32), lum);
    l.position.set(i * 3.4, h - 0.03, j * 4.2); g.add(l);
  }

  // estações de trabalho: 3 fileiras x 4 mesas
  const mesaM = mat(0xc9b28f, 0.55), pernaM = mat(0x3c4046, 0.4), monitorM = mat(0x1d1f23, 0.35);
  const telaM = () => mat(0x223040, 0.2, { emissive: new THREE.Color().setHSL(0.58, 0.45, 0.32), emissiveIntensity: 0.9 });
  const divisoriaM = mat(0x5d7a8c, 0.85);
  const mesas = [];
  const fileirasZ = [-4.2, -0.6, 3.0];
  const colunasX = [-6.2, -3.2, 0.4, 3.4];
  for (const zf of fileirasZ) {
    for (const xc of colunasX) {
      // mesa dupla: duas pessoas frente a frente, divisória no meio
      const tampo = caixa(1.6, 0.04, 1.5, mesaM, xc, 1.0, zf); g.add(tampo); bloqueia(tampo, 0.12);
      for (const [dx, dz] of [[-0.75, -0.7], [0.75, -0.7], [-0.75, 0.7], [0.75, 0.7]])
        g.add(caixa(0.05, 0.98, 0.05, pernaM, xc + dx, 0.49, zf + dz));
      g.add(caixa(1.6, 0.42, 0.04, divisoriaM, xc, 1.23, zf));
      for (const lado of [-1, 1]) {
        const mz = zf + lado * 0.32;
        g.add(caixa(0.56, 0.34, 0.03, monitorM, xc, 1.27, mz));
        const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.3), telaM());
        tela.position.set(xc, 1.27, mz - lado * 0.017); if (lado > 0) tela.rotation.y = 0; else tela.rotation.y = Math.PI;
        // tela olha para a pessoa sentada do lado oposto à divisória
        tela.rotation.y = lado > 0 ? 0 : Math.PI; tela.position.z = mz + lado * 0.017;
        g.add(tela);
        g.add(caixa(0.08, 0.15, 0.08, monitorM, xc, 1.09, mz));
        g.add(caixa(0.44, 0.02, 0.15, mat(0x2a2d31, 0.6), xc, 1.03, zf + lado * 0.55));
        mesas.push({ x: xc, z: zf + lado * 0.95, olha: lado > 0 ? Math.PI : 0, fileira: zf, lado });
      }
      // papelada e plantinha
      g.add(caixa(0.22, 0.05, 0.3, mat(0xf4f1ea, 0.9), xc - 0.55, 1.045, zf + 0.35));
      if ((xc + zf) % 2 > 0) {
        g.add(caixa(0.12, 0.12, 0.12, mat(0xa65a3a, 0.8), xc + 0.62, 1.08, zf - 0.4));
        const folha = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mat(0x3f7d3a, 0.8)); folha.position.set(xc + 0.62, 1.23, zf - 0.4); folha.castShadow = true; g.add(folha);
      }
    }
  }

  // copa (canto noroeste): bancada, cafeteira, bebedouro
  const bancada = caixa(3.0, 0.9, 0.6, mat(0xe8e2d6, 0.6), -7.2, 0.45, -6.65); g.add(bancada); bloqueia(bancada);
  const cafeteira = caixa(0.32, 0.42, 0.3, mat(0x24272b, 0.35), -7.8, 1.11, -6.7); g.add(cafeteira);
  g.add(caixa(0.12, 0.05, 0.12, mat(0xb8302a, 0.4, { emissive: 0xff2010, emissiveIntensity: 1.2 }), -7.8, 1.26, -6.54, false));
  const bebedouro = caixa(0.36, 1.1, 0.36, mat(0xf2f4f6, 0.5), -5.3, 0.55, -6.7); g.add(bebedouro); bloqueia(bebedouro);
  const galao = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.42, 16), mat(0x7ab8e6, 0.1, { transparent: true, opacity: 0.6 }));
  galao.position.set(-5.3, 1.31, -6.7); g.add(galao);
  // impressora (canto sudoeste)
  const impressora = caixa(0.7, 1.0, 0.6, mat(0xd8dadc, 0.6), -8.4, 0.5, 6.4); g.add(impressora); bloqueia(impressora);
  g.add(caixa(0.5, 0.04, 0.4, mat(0x3a3d41, 0.5), -8.4, 1.02, 6.4));
  // armários (parede oeste)
  for (let i = 0; i < 4; i++) { const a = caixa(0.5, 1.9, 1.0, mat(0x9aa2a8, 0.55), -8.72, 0.95, -2.6 + i * 1.05); g.add(a); bloqueia(a); }
  // vasos grandes
  for (const [x, z] of [[8.3, -6.3], [8.3, 6.3], [-1.4, 6.4]]) {
    const v = caixa(0.45, 0.5, 0.45, mat(0x6b4a33, 0.8), x, 0.25, z); g.add(v); bloqueia(v);
    for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32 - k * 0.06, 0), mat(0x3d7a3e, 0.85)); f.position.set(x + (k - 1) * 0.08, 0.75 + k * 0.32, z); f.castShadow = true; g.add(f); }
  }
  // sala de reunião envidraçada (sudeste)
  const vidroM = mat(0xbfd9e6, 0.05, { transparent: true, opacity: 0.22 });
  const s1 = caixa(0.05, 2.4, 3.2, vidroM, 5.0, 1.2, 5.4, false); g.add(s1); bloqueia(s1);
  const s2 = caixa(2.2, 2.4, 0.05, vidroM, 6.1, 1.2, 3.8, false); g.add(s2); bloqueia(s2);
  const mesaR = caixa(2.0, 0.04, 1.0, mesaM, 7.0, 0.74, 5.6); g.add(mesaR); bloqueia(mesaR, 0.1);
  // quadro de avisos e logotipo
  const quadro = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), mat(0xffffff, 0.8, { map: texturaQuadro(['INTERPLAN S.A.', 'Metas do trimestre: +12%', 'Aniversariantes: Célia, Wesley', 'Café é coletivo. Lave a caneca.']) }));
  quadro.position.set(1.5, 1.7, z0 + 0.02); g.add(quadro);
  const aviso = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), mat(0xffffff, 0.8, { map: texturaQuadro(['RH INFORMA', 'Recadastramento de crachá', 'até sexta-feira.'], '#fff8dc') }));
  aviso.position.set(x0 + 0.02, 1.6, 4.4); aviso.rotation.y = Math.PI / 2; g.add(aviso);

  cena.add(g);

  // --------------------------------------------------------------- grafo de caminhos
  // Corredores: x nos vãos entre colunas de mesas e z nos vãos entre fileiras.
  const corrX = [-8.0, -4.7, -1.4, 1.9, 5.0, 7.6];
  const corrZ = [-6.0, -2.4, 1.2, 4.9];
  const nos = [];
  const idx = {};
  for (const x of corrX) for (const z of corrZ) {
    if (x > 4.6 && z > 3.5) continue;                  // sala de reunião
    if (x < -7.5 && z > 4) continue;                   // impressora
    idx[x + ',' + z] = nos.length; nos.push(V(x, 0, z));
  }
  const vizinhos = nos.map(() => []);
  const liga = (a, b) => { if (a == null || b == null) return; vizinhos[a].push(b); vizinhos[b].push(a); };
  for (let i = 0; i < corrX.length; i++) for (let j = 0; j < corrZ.length; j++) {
    const a = idx[corrX[i] + ',' + corrZ[j]];
    if (i + 1 < corrX.length) liga(a, idx[corrX[i + 1] + ',' + corrZ[j]]);
    if (j + 1 < corrZ.length) liga(a, idx[corrX[i] + ',' + corrZ[j + 1]]);
  }
  // pontos de interesse ligados ao nó mais próximo por linha reta livre
  const pontos = [];
  const addPonto = (tipo, p, olha) => {
    let melhor = -1, dm = 1e9;
    nos.forEach((n, i) => { const d = n.distanceTo(p); if (d < dm && caminhoLivre(n, p, colisores)) { dm = d; melhor = i; } });
    if (melhor < 0) { nos.forEach((n, i) => { const d = n.distanceTo(p); if (d < dm) { dm = d; melhor = i; } }); console.warn('ponto sem linha livre', tipo, p.x, p.z); }
    pontos.push({ tipo, p, olha, no: melhor });
  };
  mesas.forEach(m => addPonto('mesa', V(m.x, 0, m.z), m.olha));
  addPonto('cafe', V(-7.8, 0, -6.05), Math.PI);
  addPonto('cafe', V(-6.9, 0, -6.05), Math.PI);
  addPonto('agua', V(-5.3, 0, -6.15), Math.PI);
  addPonto('impressora', V(-8.4, 0, 5.75), Math.PI);
  addPonto('janela', V(8.2, 0, -2.4), Math.PI / 2);
  addPonto('janela', V(8.2, 0, 1.2), Math.PI / 2);
  addPonto('quadro', V(1.5, 0, -6.2), Math.PI);
  addPonto('armario', V(-8.0, 0, -1.0), -Math.PI / 2);
  addPonto('reuniao', V(6.4, 0, 5.0), Math.PI / 2);
  return { grupo: g, colisores, nos, vizinhos, pontos, mesas, quadro };
}

// segmento a-b não cruza nenhum colisor (amostragem)
export function caminhoLivre(a, b, colisores, folga = 0.22) {
  const n = Math.ceil(a.distanceTo(b) / 0.15);
  for (let i = 1; i < n; i++) {
    const x = a.x + (b.x - a.x) * i / n, z = a.z + (b.z - a.z) * i / n;
    for (const c of colisores) if (x > c.x0 - folga && x < c.x1 + folga && z > c.z0 - folga && z < c.z1 + folga) return false;
  }
  return true;
}

// menor caminho por BFS ponderado (Dijkstra simples; o grafo é pequeno)
export function rota(nav, deNo, paraNo) {
  const n = nav.nos.length, dist = new Array(n).fill(Infinity), ant = new Array(n).fill(-1), feito = new Array(n).fill(false);
  dist[deNo] = 0;
  for (let k = 0; k < n; k++) {
    let u = -1; for (let i = 0; i < n; i++) if (!feito[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    feito[u] = true; if (u === paraNo) break;
    for (const v of nav.vizinhos[u]) { const d = dist[u] + nav.nos[u].distanceTo(nav.nos[v]); if (d < dist[v]) { dist[v] = d; ant[v] = u; } }
  }
  const out = []; for (let u = paraNo; u >= 0; u = ant[u]) out.unshift(u);
  return out[0] === deNo ? out : [deNo, paraNo];
}

export function noMaisProximo(nav, p) {
  let melhor = 0, dm = 1e9;
  nav.nos.forEach((n, i) => { const d = (n.x - p.x) ** 2 + (n.z - p.z) ** 2; if (d < dm) { dm = d; melhor = i; } });
  return melhor;
}
