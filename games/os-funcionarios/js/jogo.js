// OS FUNCIONÁRIOS — laço do jogo: jogador em primeira pessoa, rotina das pessoas, dias,
// memorando do RH, crachá, disparo, revelação e relatório.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ELENCO, SINAL, DIAS, FALHAS_MAX, PONTOS, sortearDia, rng } from './dados.js';
import { Pessoa, carregarModelos } from './pessoas.js';
import { construirEscritorio, rota, noMaisProximo, caminhoLivre, SALA } from './escritorio.js';
import { Som } from './som.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const $ = (s) => document.querySelector(s);
const relogio = (f) => { const min = 9 * 60 + Math.floor(f * 9 * 60); return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); };

// ------------------------------------------------------------------ cena
const canvas = $('#tela');
const render = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__TESTE });
render.setPixelRatio(Math.min(devicePixelRatio, 1.5));
render.toneMapping = THREE.ACESFilmicToneMapping; render.toneMappingExposure = 1.05;
render.shadowMap.enabled = true; render.shadowMap.type = THREE.PCFSoftShadowMap;
const cena = new THREE.Scene();
cena.background = new THREE.Color(0xcfdae6);
cena.fog = new THREE.Fog(0xcfdae6, 18, 40);
cena.environment = new THREE.PMREMGenerator(render).fromScene(new RoomEnvironment(), 0.04).texture;
cena.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
const FOV = 70, FOV_ZOOM = 20;

const sol = new THREE.DirectionalLight(0xfff1dc, 2.3);
sol.position.set(14, 7, -3); sol.target.position.set(0, 0, 0);
sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.02;
Object.assign(sol.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
cena.add(sol, sol.target);
cena.add(new THREE.HemisphereLight(0xf4f8ff, 0x8a8478, 1.05));
const fluor = new THREE.DirectionalLight(0xf2f6ff, 0.55); fluor.position.set(-2, 10, 3); cena.add(fluor);
const luzRoxa = new THREE.PointLight(0xa040ff, 0, 4, 2); cena.add(luzRoxa);

const nav = construirEscritorio(cena);

function ajustar() {
  const w = innerWidth, h = innerHeight;
  render.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', ajustar); ajustar();

// ------------------------------------------------------------------ partículas
const particulas = (() => {
  const lista = [];
  const geoV = new THREE.SphereGeometry(1, 8, 6);
  const geoE = new THREE.TetrahedronGeometry(1, 0);
  return {
    vapor(p, f) {
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(geoV, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 1, depthWrite: false }));
        m.position.copy(p); m.scale.setScalar(0.01);
        cena.add(m);
        lista.push({ m, v: f.clone().multiplyScalar(0.25 + Math.random() * 0.15).add(V((Math.random() - 0.5) * 0.08, 0.05 + Math.random() * 0.05, (Math.random() - 0.5) * 0.08)), vida: 1.6 + i * 0.08, t: -i * 0.05, tipo: 'vapor' });
      }
    },
    estilhacos(p, cor) {
      for (let i = 0; i < 26; i++) {
        const m = new THREE.Mesh(geoE, new THREE.MeshStandardMaterial({ color: i % 3 ? cor : 0x8a5ad0, roughness: 0.6, emissive: i % 3 ? 0 : 0x5020a0 }));
        m.position.copy(p); m.scale.setScalar(0.015 + Math.random() * 0.02);
        cena.add(m);
        const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9;
        lista.push({ m, v: V(Math.cos(a) * Math.cos(e), Math.sin(e) + 0.4, Math.sin(a) * Math.cos(e)).multiplyScalar(1.4 + Math.random() * 1.6), vida: 2.2, t: 0, tipo: 'caco', rot: V(Math.random(), Math.random(), Math.random()).multiplyScalar(9) });
      }
    },
    atualizar(dt) {
      for (let i = lista.length - 1; i >= 0; i--) {
        const q = lista[i]; q.t += dt;
        if (q.t < 0) continue;
        q.m.position.addScaledVector(q.v, dt);
        if (q.tipo === 'vapor') { q.m.scale.setScalar(0.01 + q.t * 0.045); q.m.material.opacity = 0.38 * (1 - q.t / q.vida); q.v.multiplyScalar(0.97); }
        else {
          q.v.y -= 9.8 * dt; q.m.rotation.x += q.rot.x * dt; q.m.rotation.y += q.rot.y * dt;
          if (q.m.position.y < 0.01) { q.m.position.y = 0.01; q.v.set(0, 0, 0); q.rot.set(0, 0, 0); }
        }
        if (q.t > q.vida) { cena.remove(q.m); q.m.material.dispose(); lista.splice(i, 1); }
      }
    },
    limpar() { for (const q of lista) cena.remove(q.m); lista.length = 0; },
  };
})();

// ------------------------------------------------------------------ estado
const S = {
  tela: 'carregando',       // carregando | titulo | memorando | jogando | pausa | relatorio | fim
  semente: 1, nDia: 1, pontos: 0, falhas: 0,
  plano: null, pessoas: [], t: 0, duracao: 240,
  abatidos: [], log: [],
  jogador: { pos: V(0, 1.62, 6.2), yaw: 0, pitch: 0, zoom: false },
  teclas: {}, crachaDe: null, mira: null,
  totais: { aliens: 0, inocentes: 0, fugas: 0, tiros: 0 },
};
const som = new Som();

// ------------------------------------------------------------------ dia
function escolherDestino(p, r) {
  const m = p.mesa;
  if (r() < 0.45) return m;
  const outros = nav.pontos.filter(q => q.tipo !== 'mesa' || r() < 0.08);
  return outros[Math.floor(r() * outros.length)];
}

function prepararDia(forcado) {
  for (const p of S.pessoas) p.remover();
  particulas.limpar();
  luzRoxa.intensity = 0;
  S.pessoas = []; S.abatidos = []; S.crachaDe = null;
  S.plano = forcado || sortearDia(S.nDia, S.semente);
  const r = rng(S.semente * 31 + S.nDia);
  S.duracao = S.plano.dia.segundos; S.t = 0;
  const mesas = nav.pontos.filter(q => q.tipo === 'mesa');
  const livres = mesas.slice().sort(() => r() - 0.5);
  S.plano.presentes.forEach((id, i) => {
    const ficha = ELENCO.find(e => e.id === id);
    const p = new Pessoa(ficha, cena, './modelos');
    p.mesa = livres[i % livres.length];
    p.obj.position.copy(p.mesa.p); p.obj.rotation.y = p.mesa.olha;
    p.obj.updateMatrixWorld(true);
    const alien = S.plano.aliens.includes(id);
    p.vestir({ alien, sinais: alien ? S.plano.sinaisDe[id] : [] }, r);
    p.ia = { modo: 'parado', ate: 2 + r() * 10, rota: [], alvo: null };
    p.mixer.setTime(r() * 3);
    S.pessoas.push(p);
  });
  S.jogador.pos.set(0, 1.62, 6.2); S.jogador.yaw = 0; S.jogador.pitch = 0;
  S.log.push({ dia: S.nDia, aliens: S.plano.aliens.slice(), sinais: structuredClone(S.plano.sinaisDe) });
}

// ------------------------------------------------------------------ IA das pessoas
const rIA = Math.random;
function atualizarIA(p, dt) {
  if (p.estado !== 'vivo') return;
  const ia = p.ia;
  // pedido de crachá: para e vira para o jogador
  if (S.crachaDe === p) { p.andando = false; p.anim('Idle_Neutral', 0.25); virarPara(p, S.jogador.pos, dt, 6); return; }
  // "encara de volta": congela enquanto é observado
  if (p.sinais.has('encara')) {
    const olhado = S.mira === p && camera.position.distanceTo(p.pos) < 9;
    p._olhado = olhado ? (p._olhado || 0) + dt : Math.max(0, (p._olhado || 0) - dt * 0.5);
    p.encarando = p._olhado > 1.2;
    if (p.encarando) { p.andando = false; p.anim('Idle_Neutral', 0.15); virarPara(p, S.jogador.pos, dt, 2.5); return; }
  }
  // olhada natural para o jogador quando ele chega perto (humanos e aliens)
  const dj = Math.hypot(S.jogador.pos.x - p.pos.x, S.jogador.pos.z - p.pos.z);
  if (dj < 3.2 && !ia.olhando && rIA() < dt * 0.25) ia.olhando = 1.5 + rIA() * 1.5;
  if (ia.olhando) { ia.olhando -= dt; p.olhar = ia.olhando > 0 && dj < 4.5 ? S.jogador.pos : null; if (ia.olhando <= 0) { ia.olhando = 0; p.olhar = null; } }

  if (ia.modo === 'parado') {
    p.andando = false;
    if (ia.alvo) virarPara(p, null, dt, 4, ia.alvo.olha);
    const naMesa = ia.alvo === p.mesa || !ia.alvo;
    p.anim(naMesa ? (Math.floor(p.t / 4 + p.id.length) % 3 === 0 ? 'Interact' : 'Idle') : 'Idle_Neutral', 0.35, naMesa ? 0.6 : 1);
    ia.ate -= dt;
    if (ia.ate <= 0) {
      const destino = escolherDestino(p, rIA);
      if (destino === ia.alvo) { ia.ate = 3 + rIA() * 6; return; }
      const de = noMaisProximo(nav, p.pos);
      const nos = rota(nav, de, destino.no);
      ia.rota = [...nos.filter(i => nav.nos[i]).map(i => nav.nos[i].clone()), destino.p.clone()];
      ia.alvo = destino; ia.modo = 'andando';
    }
  } else {
    const alvo = ia.rota[0];
    if (!alvo) { ia.modo = 'parado'; ia.ate = ia.alvo === p.mesa ? 10 + rIA() * 18 : 4 + rIA() * 7; return; }
    const d = V(alvo.x - p.pos.x, 0, alvo.z - p.pos.z);
    const dist = d.length();
    if (dist < 0.12) { ia.rota.shift(); return; }
    // espera quem está na frente
    const fr = d.clone().normalize();
    const bloqueado = S.pessoas.some(o => o !== p && o.estado === 'vivo' && o.pos.distanceTo(p.pos) < 0.7 && V().subVectors(o.pos, p.pos).dot(fr) > 0.2)
      || (Math.hypot(S.jogador.pos.x - p.pos.x, S.jogador.pos.z - p.pos.z) < 0.75 && V(S.jogador.pos.x - p.pos.x, 0, S.jogador.pos.z - p.pos.z).dot(fr) > 0.2);
    if (bloqueado) { p.andando = false; p.anim('Idle_Neutral', 0.3); ia.espera = (ia.espera || 0) + dt; if (ia.espera > 2.5) { p.pos.addScaledVector(V(-fr.z, 0, fr.x), 0.3 * dt); } return; }
    ia.espera = 0;
    p.andando = true;
    const re = p.sinais.has('re');
    p.anim('Walk', 0.25, re ? -1 : 1);
    const vel = 1.05;
    p.pos.addScaledVector(fr, Math.min(dist, vel * dt));
    virarPara(p, null, dt, 7, Math.atan2(fr.x, fr.z));
  }
}

function virarPara(p, ponto, dt, k, yawAlvo) {
  if (ponto) yawAlvo = Math.atan2(ponto.x - p.pos.x, ponto.z - p.pos.z);
  let d = yawAlvo - p.obj.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  p.obj.rotation.y += d * Math.min(1, dt * k);
}

// ------------------------------------------------------------------ jogador
const raycaster = new THREE.Raycaster();
function atualizarJogador(dt) {
  const j = S.jogador, k = S.teclas;
  const f = V(-Math.sin(j.yaw), 0, -Math.cos(j.yaw)), l = V(-f.z, 0, f.x);
  const mov = V();
  if (k.KeyW || k.ArrowUp) mov.add(f);
  if (k.KeyS || k.ArrowDown) mov.sub(f);
  if (k.KeyD || k.ArrowRight) mov.add(l);
  if (k.KeyA || k.ArrowLeft) mov.sub(l);
  if (mov.lengthSq() > 0) {
    mov.normalize().multiplyScalar((k.ShiftLeft ? 3.4 : 2.1) * (j.zoom ? 0.45 : 1) * dt);
    moverComColisao(j.pos, mov);
    j.passo = (j.passo || 0) + mov.length();
    if (j.passo > 0.75) { j.passo = 0; som.passo(); }
  }
  const alvoFov = j.zoom ? FOV_ZOOM : FOV;
  camera.fov += (alvoFov - camera.fov) * Math.min(1, dt * 10); camera.updateProjectionMatrix();
  camera.position.copy(j.pos);
  camera.rotation.set(j.pitch, j.yaw, 0, 'YXZ');
}

function moverComColisao(pos, mov) {
  const r = 0.3;
  for (const eixo of ['x', 'z']) {
    const novo = pos.clone(); novo[eixo] += mov[eixo];
    novo.x = Math.max(SALA.x0 + r, Math.min(SALA.x1 - r - 0.1, novo.x));
    novo.z = Math.max(SALA.z0 + r, Math.min(SALA.z1 - r, novo.z));
    let ok = true;
    for (const c of nav.colisores) if (novo.x > c.x0 - r && novo.x < c.x1 + r && novo.z > c.z0 - r && novo.z < c.z1 + r) { ok = false; break; }
    if (ok) for (const p of S.pessoas) if (p.estado === 'vivo' && Math.hypot(novo.x - p.pos.x, novo.z - p.pos.z) < 0.5) { ok = false; break; }
    if (ok) pos[eixo] = novo[eixo];
  }
}

function quemNaMira() {
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  let melhor = null, dm = Infinity;
  for (const p of S.pessoas) { const t = p.acerto(raycaster.ray); if (t != null && t < dm) { dm = t; melhor = p; } }
  return melhor ? { p: melhor, dist: dm } : null;
}

// ------------------------------------------------------------------ ações
function atirar() {
  if (S.tela !== 'jogando') return null;
  S.totais.tiros++;
  som.tiro();
  flash();
  const alvo = quemNaMira();
  if (!alvo) return { acertou: null };
  const p = alvo.p;
  fecharCracha();
  p.atingir({ luzAlien: (q) => { luzRoxa.position.copy(q.pos).add(V(0, 1.7, 0)); luzRoxa.intensity = 6; } });
  S.abatidos.push({ id: p.id, alien: p.alien, hora: relogio(S.t / S.duracao) });
  if (p.alien) {
    S.pontos += PONTOS.alien; S.totais.aliens++;
    setTimeout(() => som.revelacao(), 300);
    aviso(`ALIENÍGENA ELIMINADO · +${PONTOS.alien}`, 'bom');
  } else {
    S.pontos += PONTOS.inocente; S.falhas++; S.totais.inocentes++;
    setTimeout(() => som.inocente(), 250);
    aviso(`${p.ficha.nome.toUpperCase()} ERA HUMANO · ${PONTOS.inocente}`, 'ruim');
  }
  atualizarHUD();
  return { acertou: p.id, alien: p.alien };
}

function pedirCracha() {
  if (S.tela !== 'jogando') return null;
  const alvo = quemNaMira();
  if (!alvo || alvo.dist > 4.5) { aviso('Chegue mais perto para pedir o crachá', 'neutro'); return null; }
  abrirCracha(alvo.p);
  return alvo.p.id;
}

function abrirCracha(p) {
  S.crachaDe = p;
  const tex = p.cracha.material[4].map.image;
  const c = $('#cracha-img'); c.getContext('2d').drawImage(tex, 0, 0, c.width, c.height);
  const ficha = p.ficha;
  // ficha do RH: nome e foto corretos
  const f = $('#ficha-img'); const g = f.getContext('2d');
  g.fillStyle = '#efe9da'; g.fillRect(0, 0, f.width, f.height);
  g.fillStyle = '#b9c6d2'; g.fillRect(10, 10, 100, 128);
  g.fillStyle = ficha.cores.Skin || '#e0b18e'; g.beginPath(); g.ellipse(60, 78, 30, 38, 0, 0, Math.PI * 2); g.fill(); g.fillRect(42, 108, 36, 30);
  const cab = ficha.coresParte?.Head?.Red || ficha.cores.Hair || ficha.cores.Hair_Blond || ficha.cores.Pink || ficha.cores.Hair_Brown || '#3a2416';
  g.fillStyle = cab; g.beginPath(); g.ellipse(60, 56, 34, 23, 0, Math.PI, 0); g.fill();
  if (ficha.genero === 'f') { g.fillRect(25, 54, 12, 50); g.fillRect(83, 54, 12, 50); }
  g.fillStyle = '#222'; g.fillRect(48, 74, 5, 5); g.fillRect(67, 74, 5, 5);
  g.fillStyle = '#111'; g.font = 'bold 19px sans-serif'; g.fillText(ficha.nome, 124, 40);
  g.font = '16px sans-serif'; g.fillText(ficha.cargo, 124, 66); g.fillText(ficha.depto, 124, 88);
  g.fillStyle = '#7a1f1f'; g.font = 'bold 14px sans-serif'; g.fillText('FICHA FUNCIONAL · RH', 124, 128);
  $('#cracha').hidden = false;
  som.papel();
}
function fecharCracha() { S.crachaDe = null; $('#cracha').hidden = true; }

let tAviso = 0;
function aviso(txt, tipo) { const a = $('#aviso'); a.textContent = txt; a.className = 'aviso ' + tipo; a.hidden = false; tAviso = 2.6; }
function flash() { const f = $('#flash'); f.style.opacity = 0.55; setTimeout(() => f.style.opacity = 0, 60); }

// ------------------------------------------------------------------ telas
function mostrar(id) {
  for (const el of document.querySelectorAll('.tela')) el.hidden = el.id !== id;
  $('#hud').hidden = !(id === null);
}

function telaMemorando() {
  S.tela = 'memorando';
  const d = S.plano.dia;
  $('#memo-dia').textContent = `Dia ${S.nDia} de ${DIAS.length}`;
  $('#memo-qtd').textContent = d.aliens === 1 ? 'UM impostor' : `${d.aliens} impostores`;
  $('#memo-pessoas').textContent = `${d.pessoas} funcionários no andar hoje.`;
  preencherSinais($('#memo-sinais'));
  mostrar('memorando');
}
function preencherSinais(ul) {
  ul.innerHTML = '';
  for (const id of S.plano.memorando) {
    const s = SINAL[id];
    const li = document.createElement('li');
    li.innerHTML = `<b>${s.nome}</b><span>${s.dica}</span><i class="nivel ${s.nivel}">${{ obvia: 'visível de longe', media: 'preste atenção', sutil: 'só de perto' }[s.nivel]}</i>`;
    ul.appendChild(li);
  }
}

function comecarExpediente() {
  S.tela = 'jogando'; mostrar(null); atualizarHUD();
  $('#hud-memo-lista').innerHTML = S.plano.memorando.map(id => `<li>${SINAL[id].nome}</li>`).join('');
  travarMouse();
  som.campainha();
}

function fimDoDia(motivo) {
  if (S.tela !== 'jogando') return;
  const fugas = S.pessoas.filter(p => p.alien && p.estado === 'vivo');
  const sobra = Math.max(0, S.duracao - S.t);
  const bonus = fugas.length === 0 ? Math.floor(sobra / 60 * PONTOS.porMinutoSobrando * (540 / S.duracao)) : 0;
  S.pontos += fugas.length * PONTOS.fuga + bonus;
  S.totais.fugas += fugas.length;
  S.tela = 'relatorio'; fecharCracha(); soltarMouse();
  const demitido = S.falhas >= FALHAS_MAX;
  const ultimo = S.nDia >= DIAS.length;
  $('#rel-titulo').textContent = demitido ? 'Você foi afastado do departamento' : (fugas.length ? 'Expediente encerrado' : 'Andar limpo');
  $('#rel-motivo').textContent = motivo === 'tempo' ? 'Deu 18h. Todo mundo foi para casa, inclusive quem não devia.' : (motivo === 'falhas' ? `${FALHAS_MAX} funcionários humanos abatidos. O RH abriu uma sindicância.` : 'Todos os impostores do dia foram eliminados antes do fim do expediente.');
  const linhas = [];
  for (const id of S.plano.aliens) {
    const p = S.pessoas.find(q => q.id === id);
    const sin = S.plano.sinaisDe[id].map(s => SINAL[s].nome).join(', ');
    linhas.push(`<li class="${p.estado === 'vivo' ? 'fugiu' : 'pego'}"><b>${p.ficha.nome}</b> (${p.ficha.depto}) era alienígena — ${sin}. <em>${p.estado === 'vivo' ? 'Fugiu.' : 'Eliminado.'}</em></li>`);
  }
  for (const a of S.abatidos.filter(a => !a.alien)) {
    const p = S.pessoas.find(q => q.id === a.id);
    linhas.push(`<li class="inocente"><b>${p.ficha.nome}</b> (${p.ficha.depto}) era humano. Abatido às ${a.hora}.</li>`);
  }
  const iscas = S.plano.iscas.map(s => SINAL[s].nome);
  if (iscas.length) linhas.push(`<li class="isca">Boatos do memorando que não eram verdade hoje: ${iscas.join(', ')}.</li>`);
  $('#rel-lista').innerHTML = linhas.join('');
  $('#rel-pontos').textContent = `${S.pontos} pontos${bonus ? ` (bônus de pontualidade +${bonus})` : ''}${fugas.length ? ` · ${fugas.length} fuga(s) ${fugas.length * PONTOS.fuga}` : ''}`;
  $('#rel-falhas').textContent = `Falhas: ${S.falhas} de ${FALHAS_MAX}`;
  $('#rel-seguir').textContent = demitido || ultimo ? 'Ver o resultado final' : `Dia ${S.nDia + 1}`;
  S.fimDeJogo = demitido || ultimo;
  mostrar('relatorio');
}

function telaFinal() {
  S.tela = 'fim';
  const demitido = S.falhas >= FALHAS_MAX;
  const recorde = +(localStorage.getItem('funcionarios.recorde') || 0);
  if (S.pontos > recorde) localStorage.setItem('funcionarios.recorde', S.pontos);
  $('#fim-titulo').textContent = demitido ? 'AFASTADO' : (S.totais.fugas === 0 && S.totais.inocentes === 0 ? 'FUNCIONÁRIO DO MÊS' : 'CONTRATO RENOVADO');
  $('#fim-texto').textContent = demitido
    ? `Você chegou ao dia ${S.nDia}. A Interplan agradece os serviços prestados.`
    : `Cinco dias, ${S.totais.aliens} impostores eliminados, ${S.totais.inocentes} inocente(s) no caminho, ${S.totais.fugas} fuga(s).`;
  $('#fim-pontos').textContent = `${S.pontos} pontos` + (S.pontos > recorde ? ' · novo recorde' : (recorde ? ` · recorde ${recorde}` : ''));
  mostrar('fim');
}

function novoJogo(semente) {
  S.semente = semente ?? (Math.floor(Math.random() * 1e6) + 1);
  S.nDia = 1; S.pontos = 0; S.falhas = 0; S.log = []; S.fimDeJogo = false;
  S.totais = { aliens: 0, inocentes: 0, fugas: 0, tiros: 0 };
  prepararDia(); telaMemorando();
}
function proximoDia() {
  if (S.fimDeJogo) { telaFinal(); return; }
  S.nDia++; prepararDia(); telaMemorando();
}

function atualizarHUD() {
  $('#hud-dia').textContent = `DIA ${S.nDia}`;
  $('#hud-hora').textContent = relogio(Math.min(1, S.t / S.duracao));
  $('#hud-pontos').textContent = S.pontos;
  $('#hud-falhas').innerHTML = Array.from({ length: FALHAS_MAX }, (_, i) => `<span class="${i < S.falhas ? 'x' : ''}"></span>`).join('');
  const vivos = S.pessoas.filter(p => p.alien && p.estado === 'vivo').length;
  $('#hud-aliens').textContent = `${vivos} impostor${vivos === 1 ? '' : 'es'} no andar`;
}

// ------------------------------------------------------------------ entrada
function travarMouse() { if (!window.__TESTE && canvas.requestPointerLock) canvas.requestPointerLock(); }
function soltarMouse() { if (document.pointerLockElement) document.exitPointerLock(); }
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && S.tela === 'jogando' && !window.__TESTE) { S.tela = 'pausa'; S.teclas = {}; S.jogador.zoom = false; mostrar('pausa'); }
});
document.addEventListener('mousemove', (e) => {
  if (S.tela !== 'jogando' || !document.pointerLockElement) return;
  const k = 0.0022 * (S.jogador.zoom ? FOV_ZOOM / FOV : 1);
  S.jogador.yaw -= e.movementX * k;
  S.jogador.pitch = Math.max(-1.3, Math.min(1.3, S.jogador.pitch - e.movementY * k));
});
canvas.addEventListener('mousedown', (e) => {
  if (S.tela !== 'jogando') return;
  if (!document.pointerLockElement) { travarMouse(); return; }
  if (e.button === 0) atirar();
  if (e.button === 2) S.jogador.zoom = true;
});
addEventListener('mouseup', (e) => { if (e.button === 2) S.jogador.zoom = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => {
  S.teclas[e.code] = true;
  if (S.tela === 'jogando') {
    if (e.code === 'KeyE') { if (S.crachaDe) fecharCracha(); else pedirCracha(); }
    if (e.code === 'KeyZ') S.jogador.zoom = true;
    if (e.code === 'Tab') { e.preventDefault(); $('#hud-memo').classList.toggle('aberto'); }
  }
});
addEventListener('keyup', (e) => { S.teclas[e.code] = false; if (e.code === 'KeyZ') S.jogador.zoom = false; });

$('#btn-comecar').onclick = () => { som.ligar(); novoJogo(); };
$('#btn-expediente').onclick = () => comecarExpediente();
$('#btn-continuar').onclick = () => { S.tela = 'jogando'; mostrar(null); travarMouse(); };
$('#btn-desistir').onclick = () => { S.tela = 'titulo'; mostrar('titulo'); };
$('#rel-seguir').onclick = () => proximoDia();
$('#btn-denovo').onclick = () => novoJogo();

// ------------------------------------------------------------------ laço
let ultimo = performance.now();
function passo(dt) {
  if (S.tela === 'jogando') {
    S.t += dt;
    atualizarJogador(dt);
    const m = quemNaMira();
    S.mira = m?.p || null;
    $('#dica').textContent = S.crachaDe ? '[E] devolver o crachá' : (m && m.dist < 4.5 ? '[E] pedir o crachá' : '');
    $('#mira').classList.toggle('alvo', !!m);
    for (const p of S.pessoas) atualizarIA(p, dt);
    if (S.crachaDe && S.crachaDe.pos.distanceTo(S.jogador.pos) > 6) fecharCracha();
    if (tAviso > 0) { tAviso -= dt; if (tAviso <= 0) $('#aviso').hidden = true; }
    if (Math.floor(S.t) !== Math.floor(S.t - dt)) atualizarHUD();
    const restam = S.pessoas.filter(p => p.alien && p.estado === 'vivo').length;
    const animando = S.pessoas.some(p => p.estado !== 'vivo' && !p.fim);
    if (S.falhas >= FALHAS_MAX && !animando) fimDoDia('falhas');
    else if (restam === 0 && !animando) fimDoDia('limpo');
    else if (S.t >= S.duracao) fimDoDia('tempo');
  } else if (S.tela !== 'carregando') {
    // vitrine: câmera passeia devagar pelo andar atrás dos menus
    const a = performance.now() / 1000 * 0.05;
    camera.position.set(Math.sin(a) * 6.5, 2.3, Math.cos(a) * 4.6); camera.lookAt(0, 1.1, 0);
    camera.fov = FOV; camera.updateProjectionMatrix();
    for (const p of S.pessoas) atualizarIA(p, dt);
  }
  for (const p of S.pessoas) p.atualizar(dt, { camera, particulas });
  luzRoxa.intensity *= Math.pow(0.25, dt);
  particulas.atualizar(dt);
}
function quadro(agora) {
  const dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora;
  if (!window.__TESTE || window.__TESTE_TEMPO_REAL) passo(dt);
  render.render(cena, camera);
  requestAnimationFrame(quadro);
}

// ------------------------------------------------------------------ início
(async () => {
  const barra = $('#barra');
  await carregarModelos('./modelos', (f) => barra.style.width = Math.round(f * 100) + '%');
  // fundo do título: o andar com gente trabalhando
  S.plano = sortearDia(1, 4242); S.nDia = 1; S.semente = 4242; prepararDia(); S.log = [];
  S.tela = 'titulo'; mostrar('titulo');
  const recorde = localStorage.getItem('funcionarios.recorde');
  if (recorde) $('#recorde').textContent = `Recorde: ${recorde} pontos`;
  requestAnimationFrame(quadro);
  window.__pronto = true;
})();

// ------------------------------------------------------------------ API de teste (provas.mjs)
window.__jogo = {
  S, ELENCO,
  novoJogo: (s) => { novoJogo(s); return S.plano; },
  comecar: () => { comecarExpediente(); return S.tela; },
  avancar: (seg, dt = 1 / 30) => { for (let t = 0; t < seg; t += dt) passo(dt); render.render(cena, camera); return { tela: S.tela, t: S.t }; },
  pessoas: () => S.pessoas.map(p => ({ id: p.id, alien: p.alien, sinais: [...p.sinais], estado: p.estado, x: p.pos.x, z: p.pos.z, cracha: p.nomeNoCracha })),
  // posiciona o jogador a `dist` metros da pessoa, olhando para o peito dela
  mirar: (id, dist = 2.2, alt = 1.25) => {
    const p = S.pessoas.find(q => q.id === id);
    // procura um ponto a `dist` metros com linha de visão livre (sem mesa no meio), preferindo a frente
    const yaw0 = p.obj.rotation.y;
    let pos = null;
    for (const da of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.2, -2.2, Math.PI]) {
      const a = yaw0 + da;
      const c = p.pos.clone().add(V(Math.sin(a) * dist, 0, Math.cos(a) * dist));
      if (c.x < SALA.x0 + 0.4 || c.x > SALA.x1 - 0.5 || c.z < SALA.z0 + 0.4 || c.z > SALA.z1 - 0.4) continue;
      if (caminhoLivre(p.pos, c, nav.colisores, 0.1)) { pos = c; break; }
    }
    if (!pos) { const f = V(0, 0, 1).applyQuaternion(p.obj.quaternion); pos = p.pos.clone().addScaledVector(f, dist); }
    pos.y = 1.62;
    S.jogador.pos.copy(pos);
    S.jogador.yaw = Math.atan2(-(p.pos.x - pos.x), -(p.pos.z - pos.z));
    S.jogador.pitch = Math.atan2(alt - 1.62, dist);
    atualizarJogador(0); render.render(cena, camera);
    return quemNaMira()?.p.id || null;
  },
  olharPara: (x, y, z, px, pz) => {
    if (px != null) S.jogador.pos.set(px, 1.62, pz);
    const d = V(x, y, z).sub(S.jogador.pos);
    S.jogador.yaw = Math.atan2(-d.x, -d.z); S.jogador.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    atualizarJogador(0); render.render(cena, camera); return true;
  },
  zoom: (on) => { S.jogador.zoom = on; camera.fov = on ? FOV_ZOOM : FOV; camera.updateProjectionMatrix(); render.render(cena, camera); return camera.fov; },
  atirar, pedirCracha, fecharCracha,
  // dia sob medida para provas: presentes = ids; aliens = { id: [sinais] }
  diaForcado: (presentes, aliens) => {
    const plano = { dia: { ...DIAS[0], pessoas: presentes.length, aliens: Object.keys(aliens).length }, presentes,
      aliens: Object.keys(aliens), sinaisDe: aliens, memorando: Object.values(aliens).flat(), iscas: [] };
    S.nDia = 1; prepararDia(plano); S.tela = 'jogando'; mostrar(null); atualizarHUD(); return S.pessoas.length;
  },
  tempoPessoa: (id, t) => { S.pessoas.find(q => q.id === id).t = t; return t; },
  posicionar: (id, x, z, yaw) => { const p = S.pessoas.find(q => q.id === id); p.pos.set(x, 0, z); p.obj.rotation.y = yaw; p.ia.modo = 'parado'; p.ia.ate = 1e9; p.ia.alvo = { olha: yaw }; return true; },
  andarPara: (id, x, z) => { const p = S.pessoas.find(q => q.id === id); p.ia.modo = 'andando'; p.ia.rota = [V(x, 0, z)]; p.ia.alvo = { olha: 0 }; return true; },
  proximoDia: () => { proximoDia(); return S.tela; },
  tela: () => S.tela,
  render: () => { render.render(cena, camera); return true; },
  info: () => ({ calls: render.info.render.calls, tris: render.info.render.triangles, geos: render.info.memory.geometries, tex: render.info.memory.textures }),
};
