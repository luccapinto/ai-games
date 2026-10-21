// OS FUNCIONÁRIOS — laço do jogo: jogador em primeira pessoa, rotina das pessoas, dias,
// memorando do RH, crachá, disparo, revelação e relatório.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ELENCO, SINAL, DIAS, FALHAS_MAX, PONTOS, RITMO, PARADO, ARMA, proximosNiveis, sortearDia, rng } from './dados.js';
import { Pessoa, carregarModelos, VEL_HOSTIL } from './pessoas.js';
import { construirEscritorio, rota, noMaisProximo, caminhoLivre, SALA } from './escritorio.js';
import { Som } from './som.js';
import { Arma, grampo } from './arma.js';

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
const RECUO = 0.022;           // rad de coice na câmera por grampo (vezes o coice do nível)
const VIDA_JOGADOR = 5;        // socos que o jogador aguenta por dia

const sol = new THREE.DirectionalLight(0xfff1dc, 2.3);
sol.position.set(14, 7, -3); sol.target.position.set(0, 0, 0);
sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.02;
Object.assign(sol.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
cena.add(sol, sol.target);
cena.add(new THREE.HemisphereLight(0xf4f8ff, 0x8a8478, 1.05));
const fluor = new THREE.DirectionalLight(0xf2f6ff, 0.55); fluor.position.set(-2, 10, 3); cena.add(fluor);
const luzRoxa = new THREE.PointLight(0xa040ff, 0, 4, 2); cena.add(luzRoxa);

const nav = construirEscritorio(cena);

const arma = new Arma(cena.environment);
function ajustar() {
  const w = innerWidth, h = innerHeight;
  render.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  arma.ajustar(w / h);
}
function desenhar() {
  render.render(cena, camera);
  arma.visivel = (S.tela === 'jogando' || S.tela === 'almoxarifado') && !S.semArma;   // semArma: folhas de pose
  arma.desenhar(render);
}
addEventListener('resize', ajustar); ajustar();

// ------------------------------------------------------------------ partículas
const particulas = (() => {
  const lista = [];
  const geoV = new THREE.SphereGeometry(1, 8, 6);
  const geoE = new THREE.TetrahedronGeometry(1, 0);
  return {
    // baforada gelada: nuvem branco-azulada, mais densa e maior que antes, para ler a 2,5 m
    vapor(p, f) {
      for (let i = 0; i < 10; i++) {
        const m = new THREE.Mesh(geoV, new THREE.MeshStandardMaterial({ color: 0xe8f4ff, emissive: 0x8fc4ff, emissiveIntensity: 0.3,
          transparent: true, opacity: 0.8, roughness: 1, depthWrite: false }));
        m.position.copy(p); m.scale.setScalar(0.015);
        cena.add(m);
        lista.push({ m, v: f.clone().multiplyScalar(0.3 + Math.random() * 0.2).add(V((Math.random() - 0.5) * 0.1, 0.04 + Math.random() * 0.06, (Math.random() - 0.5) * 0.1)), vida: 1.5 + i * 0.05, t: -i * 0.04, tipo: 'vapor' });
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
    faiscas(p, n) {
      for (let i = 0; i < 7; i++) {
        const m = new THREE.Mesh(geoE, new THREE.MeshBasicMaterial({ color: 0xfff1b0 }));
        m.position.copy(p); m.scale.setScalar(0.008);
        cena.add(m);
        const v = n.clone().multiplyScalar(1.2).add(V((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2));
        lista.push({ m, v, vida: 0.35, t: 0, tipo: 'caco', rot: V(0, 0, 0) });
      }
    },
    gosma(p) {
      for (let i = 0; i < 12; i++) {
        const m = new THREE.Mesh(geoV, new THREE.MeshStandardMaterial({ color: 0x9a4cff, emissive: 0x5a10c0, emissiveIntensity: 1.2, roughness: 0.3 }));
        m.position.copy(p); m.scale.setScalar(0.012 + Math.random() * 0.012);
        cena.add(m);
        lista.push({ m, v: V((Math.random() - 0.5) * 2.4, 0.6 + Math.random() * 1.6, (Math.random() - 0.5) * 2.4), vida: 1.0, t: 0, tipo: 'caco', rot: V(0, 0, 0) });
      }
    },
    atualizar(dt) {
      for (let i = lista.length - 1; i >= 0; i--) {
        const q = lista[i]; q.t += dt;
        if (q.t < 0) continue;
        q.m.position.addScaledVector(q.v, dt);
        if (q.tipo === 'vapor') { q.m.scale.setScalar(0.015 + q.t * 0.06); q.m.material.opacity = 0.7 * Math.pow(Math.max(0, 1 - q.t / q.vida), 0.7); q.v.multiplyScalar(Math.pow(0.4, dt)); }
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

// ------------------------------------------------------------------ grampos
const grampos = (() => {
  const voando = [], cravados = [];
  return {
    // sai da boca da arma e vai até o ponto de impacto; crava em `alvo` (Object3D) ou no cenário
    lancar(de, ate, alvo, normal) {
      const g = grampo(1.6);
      g.position.copy(de); g.lookAt(ate);
      cena.add(g);
      voando.push({ g, de: de.clone(), ate: ate.clone(), t: 0, dur: Math.max(0.03, de.distanceTo(ate) / 55), alvo, normal });
    },
    atualizar(dt) {
      for (let i = voando.length - 1; i >= 0; i--) {
        const q = voando[i]; q.t += dt;
        const k = Math.min(1, q.t / q.dur);
        q.g.position.lerpVectors(q.de, q.ate, k);
        if (k < 1) continue;
        voando.splice(i, 1);
        if (q.alvo) q.alvo.attach(q.g);
        else if (q.normal) particulas.faiscas(q.ate, q.normal);
        cravados.push(q.g);
        if (cravados.length > 80) { const v = cravados.shift(); v.parent?.remove(v); }
      }
    },
    limpar() { for (const q of voando) cena.remove(q.g); for (const g of cravados) g.parent?.remove(g); voando.length = 0; cravados.length = 0; },
  };
})();

// ------------------------------------------------------------------ estado
const S = {
  tela: 'carregando',       // carregando | titulo | memorando | jogando | pausa | relatorio | almoxarifado | fim
  semente: 1, nDia: 1, pontos: 0, falhas: 0, verba: 0, pontosAntes: 0,
  plano: null, pessoas: [], t: 0, duracao: 240,
  abatidos: [], log: [],
  jogador: { pos: V(0, 1.62, 6.2), yaw: 0, pitch: 0, zoom: false, vida: VIDA_JOGADOR, tremor: 0 },
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
  particulas.limpar(); grampos.limpar();
  luzRoxa.intensity = 0;
  S.pessoas = []; S.abatidos = []; S.crachaDe = null;
  S.plano = forcado || sortearDia(S.nDia, S.semente);
  const r = rng(S.semente * 31 + S.nDia);
  rIA = rng(S.semente * 131 + S.nDia * 7 + 1);     // a IA do dia também segue a semente (simulações repetíveis)
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
    p.ia = { modo: 'parado', ate: 2 + r() * 10, rota: [], alvo: p.mesa };
    p.ritmo = 0.8 + r() * 0.2;        // cada um anda num passo (e a animação acompanha, sem deslizar)
    p.fase = r() * 30;                 // fase das pausas na mesa
    p.t = r() * 100;                   // relógio próprio (ritmo dos sinais que vão e voltam)
    p.mixer.setTime(r() * 3);
    S.pessoas.push(p);
  });
  S.jogador.pos.set(0, 1.62, 6.2); S.jogador.yaw = 0; S.jogador.pitch = 0;
  S.jogador.vida = VIDA_JOGADOR; S.jogador.tremor = 0;
  arma.pente = arma.cfg.pente; arma.recarregando = 0; arma.espera = 0;
  S.pontosAntes = S.pontos;            // a verba do dia = o que se ganhou hoje
  S.log.push({ dia: S.nDia, aliens: S.plano.aliens.slice(), sinais: structuredClone(S.plano.sinaisDe) });
}

// ------------------------------------------------------------------ IA das pessoas
let rIA = Math.random;                 // trocado por um sorteio com semente a cada dia (prepararDia)
// alienígena revelado: corre atrás do jogador e dá soco
function atualizarHostil(p, dt) {
  const j = S.jogador.pos;
  const dj = Math.hypot(j.x - p.pos.x, j.z - p.pos.z);
  if (p.atordoado > 0) { p.atordoado -= dt; if (p.atordoado <= 0) p.reiniciar('Run', 0.15, p.escalaCorrida); return; }
  if (p.socando > 0) {
    p.socando -= dt;
    virarPara(p, j, dt, 8);
    if (!p.socou && p.socando < 0.45) {
      p.socou = true;
      if (dj < 1.35 && S.tela === 'jogando') levarSoco(p);
    }
    if (p.socando <= 0) p.reiniciar('Run', 0.15, p.escalaCorrida);
    return;
  }
  if (dj < 1.05) { p.socando = 0.9; p.socou = false; p.reiniciar('Punch_Right', 0.08, 1.2); return; }
  // rota: direto se a linha está livre; senão pelos corredores
  p._rotaT = (p._rotaT || 0) - dt;
  if (p._rotaT <= 0 || !p._alvo) {
    p._rotaT = 0.4;
    const pj = V(j.x, 0, j.z);
    if (caminhoLivre(p.pos, pj, nav.colisores, 0.18)) p._alvo = pj;
    else {
      const nos = rota(nav, noMaisProximo(nav, p.pos), noMaisProximo(nav, pj));
      const prox = nos.map(i => nav.nos[i]).find(n => n.distanceTo(p.pos) > 0.5 && caminhoLivre(p.pos, n, nav.colisores, 0.1));
      p._alvo = prox ? prox.clone() : pj;
    }
  }
  const d = V(p._alvo.x - p.pos.x, 0, p._alvo.z - p.pos.z);
  if (d.length() < 0.15) { p._rotaT = 0; return; }
  d.normalize();
  const vel = VEL_HOSTIL;
  const novo = p.pos.clone().addScaledVector(d, vel * dt);
  const bate = nav.colisores.some(c => novo.x > c.x0 - 0.2 && novo.x < c.x1 + 0.2 && novo.z > c.z0 - 0.2 && novo.z < c.z1 + 0.2);
  if (!bate) p.pos.copy(novo); else p._rotaT = 0;
  virarPara(p, null, dt, 10, Math.atan2(d.x, d.z));
}

function levarSoco(p) {
  const j = S.jogador;
  j.vida--; j.tremor = 0.45;
  som.soco();
  const f = $('#dano'); f.style.opacity = 0.75; setTimeout(() => f.style.opacity = 0, 140);
  // empurrão para trás
  const dir = V(j.pos.x - p.pos.x, 0, j.pos.z - p.pos.z).normalize().multiplyScalar(0.45);
  moverComColisao(j.pos, dir);
  aviso(j.vida > 0 ? `VOCÊ LEVOU UM SOCO · ${j.vida} de ${VIDA_JOGADOR}` : 'NOCAUTE', 'ruim');
  atualizarHUD();
}

function atualizarIA(p, dt) {
  if (p.estado === 'hostil') { atualizarHostil(p, dt); return; }
  if (p.estado !== 'vivo') return;
  if (p.ia.modo === 'roteiro') return;          // provas/folhas controlam a pessoa
  const ia = p.ia;
  // pedido de crachá: para e vira para o jogador
  if (S.crachaDe === p) { p.andando = false; p.teclado = null; p.anim('Idle_Neutral', 0.25); virarPara(p, S.jogador.pos, dt, 6); return; }
  // "encara de volta": congela enquanto é observado, e de tempos em tempos encara sozinho
  const dj = Math.hypot(S.jogador.pos.x - p.pos.x, S.jogador.pos.z - p.pos.z);
  if (p.sinais.has('encara')) {
    const olhado = S.mira === p && camera.position.distanceTo(p.pos) < 9;
    p._olhado = olhado ? (p._olhado || 0) + dt : Math.max(0, (p._olhado || 0) - dt * 0.5);
    const sozinho = (p.t % RITMO.encara.ciclo) > RITMO.encara.ciclo - RITMO.encara.dura;   // de qualquer ponto do andar
    p.encarando = p._olhado > 1.2 || sozinho;
    if (p.encarando) { p.andando = false; p.teclado = null; p.anim('Idle_Neutral', 0.15); virarPara(p, S.jogador.pos, dt, 2.5); return; }
  }
  // olhada natural para o jogador quando ele chega perto (humanos e aliens)
  if (dj < 3.2 && !ia.olhando && rIA() < dt * 0.25) ia.olhando = 1.5 + rIA() * 1.5;
  if (ia.olhando) ia.olhando = Math.max(0, ia.olhando - dt);
  let olhar = ia.olhando > 0 && dj < 4.5 ? S.jogador.pos : null;

  if (ia.modo === 'parado') {
    p.andando = false;
    if (ia.alvo) virarPara(p, null, dt, 4, ia.alvo.olha);
    const naMesa = ia.alvo === p.mesa;
    if (naMesa) {
      // trabalha: digita uns 8 s, para uns 3 s e olha para o lado (vizinho mais perto)
      const digitando = (p.t + p.fase) % 11 < 8;
      p.teclado = digitando ? tecladoDe(p.mesa) : null;
      if (!digitando && !olhar) olhar = S.pessoas.filter(o => o !== p && o.alvejavel).sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos))[0]?.pos || null;
      p.anim('Idle', 0.35, 0.6);
    } else {
      p.teclado = null;
      // conversa: duas pessoas paradas perto uma da outra se viram e se olham
      const papo = !ia.alvo?.fixo && S.pessoas.find(o => o !== p && o.estado === 'vivo' && o.ia?.modo === 'parado' && o.ia.alvo !== o.mesa && !o.ia.alvo?.fixo && o.pos.distanceTo(p.pos) < 2.2);
      if (papo) { virarPara(p, papo.pos, dt, 3); olhar = olhar || papo.pos; }
      const mexe = ['impressora', 'armario', 'cafe', 'agua'].includes(ia.alvo?.tipo) && (p.t + p.fase) % 7 < 3;
      p.anim(mexe && !papo ? 'Interact' : 'Idle_Neutral', 0.35);
    }
    p.olhar = olhar;
    ia.ate -= dt;
    if (ia.ate <= 0) {
      const destino = escolherDestino(p, rIA);
      if (destino === ia.alvo) { ia.ate = 3 + rIA() * 6; return; }
      const de = noMaisProximo(nav, p.pos);
      const nos = rota(nav, de, destino.no);
      ia.rota = [...nos.filter(i => nav.nos[i]).map(i => nav.nos[i].clone()), destino.p.clone()];
      ia.alvo = destino; ia.modo = 'andando'; p.teclado = null;
    }
  } else {
    p.olhar = olhar;
    const alvo = ia.rota[0];
    if (!alvo) {
      // quem anda de ré ou com os braços duros só mostra o sinal andando: fica menos tempo parado
      const t = (p.sinais.has('re') || p.sinais.has('bracos')) ? PARADO.andarilho : PARADO;
      const [a, b] = ia.alvo === p.mesa ? t.mesa : t.outro;
      ia.modo = 'parado'; ia.ate = a + rIA() * (b - a); return;
    }
    const d = V(alvo.x - p.pos.x, 0, alvo.z - p.pos.z);
    const dist = d.length();
    if (dist < 0.12) { ia.rota.shift(); return; }
    // desvia de quem está na frente andando de lado (o corpo vira para onde vai: não desliza);
    // o jogador na frente faz esperar; preso por muito tempo, escolhe outro destino
    let fr = d.clone().normalize();
    const frente = (o) => o.distanceTo(p.pos) < 0.7 && V().subVectors(o, p.pos).setY(0).dot(fr) > 0.2;
    const jogadorNaFrente = frente(V(S.jogador.pos.x, 0, S.jogador.pos.z));
    const outro = S.pessoas.find(o => o !== p && o.alvejavel && frente(o.pos));
    if (outro && !jogadorNaFrente) {
      const lado = V(-fr.z, 0, fr.x);
      if (V().subVectors(outro.pos, p.pos).dot(lado) > 0) lado.negate();
      const desvio = fr.clone().addScaledVector(lado, 1.3).normalize();
      const livre = (dir) => !nav.colisores.some(c => { const q = p.pos.clone().addScaledVector(dir, 0.35); return q.x > c.x0 - 0.15 && q.x < c.x1 + 0.15 && q.z > c.z0 - 0.15 && q.z < c.z1 + 0.15; });
      if (livre(desvio)) fr = desvio;
      else { const outroLado = fr.clone().addScaledVector(lado, -1.3).normalize(); fr = livre(outroLado) ? outroLado : null; }
    }
    if (jogadorNaFrente || !fr) {
      p.andando = false; p.anim('Idle_Neutral', 0.3); ia.espera = (ia.espera || 0) + dt;
      if (ia.espera > 4) { ia.espera = 0; ia.modo = 'parado'; ia.ate = 0.5 + rIA(); ia.alvo = null; }
      return;
    }
    ia.espera = 0;
    p.andando = true;
    // anda de ré: o corpo vira de costas para onde vai e o passo toca ao contrário
    const re = p.sinais.has('re');
    p.anim('Walk', 0.25, (re ? -1 : 1) * p.ritmo);
    p.pos.addScaledVector(fr, Math.min(dist, p.velPasso * p.ritmo * dt));
    virarPara(p, null, dt, 7, Math.atan2(fr.x, fr.z) + (re ? Math.PI : 0));
  }
}

// ponto do teclado da mesa (onde as mãos de quem trabalha ficam)
function tecladoDe(m) {
  return m._teclado || (m._teclado = V(m.p.x + Math.sin(m.olha) * 0.40, 1.045, m.p.z + Math.cos(m.olha) * 0.40));
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
  j.tremor = Math.max(0, (j.tremor || 0) - dt);
  j.recuo = (j.recuo || 0) * Math.pow(0.0005, dt);     // coice do grampeador: a mira sobe e volta
  const tr = j.tremor * j.tremor * 0.25;
  camera.rotation.set(j.pitch + j.recuo + (Math.random() - 0.5) * tr, j.yaw + (Math.random() - 0.5) * tr, (Math.random() - 0.5) * tr * 0.6, 'YXZ');
  arma.atualizar(dt, { andando: mov.lengthSq() > 0 ? (k.ShiftLeft ? 1.5 : 1) : 0, zoom: j.zoom, giro: (j._yawAnt ?? j.yaw) - j.yaw });
  j._yawAnt = j.yaw;
}

function moverComColisao(pos, mov) {
  const r = 0.3;
  for (const eixo of ['x', 'z']) {
    const novo = pos.clone(); novo[eixo] += mov[eixo];
    novo.x = Math.max(SALA.x0 + r, Math.min(SALA.x1 - r - 0.1, novo.x));
    novo.z = Math.max(SALA.z0 + r, Math.min(SALA.z1 - r, novo.z));
    let ok = true;
    for (const c of nav.colisores) if (novo.x > c.x0 - r && novo.x < c.x1 + r && novo.z > c.z0 - r && novo.z < c.z1 + r) { ok = false; break; }
    if (ok) for (const p of S.pessoas) if (p.alvejavel && Math.hypot(novo.x - p.pos.x, novo.z - p.pos.z) < 0.5) { ok = false; break; }
    if (ok) pos[eixo] = novo[eixo];
  }
}

function quemNaMira() {
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  let melhor = null, dm = Infinity;
  for (const p of S.pessoas) { const t = p.acerto(raycaster.ray); if (t != null && t < dm) { dm = t; melhor = p; } }
  if (melhor) { const o = obstaculo(); if (o && o.distance < dm - 0.15) return null; }
  return melhor ? { p: melhor, dist: dm } : null;
}
// primeira parede/mesa/divisória na linha da mira
const _solidos = [];
function obstaculo() {
  if (!_solidos.length) nav.grupo.traverse(o => { if (o.isMesh && !(o.material.transparent && o.material.opacity < 0.3)) _solidos.push(o); });
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  raycaster.far = 40;
  return raycaster.intersectObjects(_solidos, false)[0] || null;
}

// ------------------------------------------------------------------ ações
function atirar() {
  if (S.tela !== 'jogando') return null;
  if (!arma.disparar()) {
    if (arma.ocupada) return { acertou: null, recarregando: true };
    som.vazio(); return { acertou: null, vazio: true };
  }
  S.totais.tiros++;
  S.jogador.recuo = (S.jogador.recuo || 0) + RECUO * arma.cfg.coice;
  som.tiro();
  atualizarHUD();
  const de = arma.bocaNoMundo(camera);
  const alvo = quemNaMira();
  if (!alvo) {
    const o = obstaculo();
    const ate = o ? o.point.clone() : camera.position.clone().add(raycaster.ray.direction.clone().multiplyScalar(30));
    const n = o?.face ? o.face.normal.clone().transformDirection(o.object.matrixWorld) : V(0, 1, 0);
    grampos.lancar(de, ate.addScaledVector(n, 0.004), null, n);
    if (o) som.impacto();
    return { acertou: null };
  }
  const p = alvo.p;
  const ponto = raycaster.ray.at(alvo.dist, V());
  // crava no osso mais próximo do ponto
  let osso = p.ossos.Chest, dOsso = Infinity;
  for (const n of ['Head', 'Neck', 'Chest', 'Torso', 'Abdomen', 'Hips', 'UpperArmL', 'UpperArmR', 'LowerArmL', 'LowerArmR', 'UpperLegL', 'UpperLegR', 'LowerLegL', 'LowerLegR']) {
    const b = p.ossos[n]; if (!b) continue; const d = b.getWorldPosition(V()).distanceTo(ponto); if (d < dOsso) { dOsso = d; osso = b; }
  }
  grampos.lancar(de, ponto, osso, null);
  fecharCracha();
  const r = p.atingir({ vida: arma.cfg.grampos, particulas, luzAlien: (q) => { luzRoxa.position.copy(q.pos).add(V(0, 1.7, 0)); luzRoxa.intensity = 6; } });
  if (r === 'humano') {
    S.abatidos.push({ id: p.id, alien: false, hora: relogio(S.t / S.duracao) });
    S.pontos += PONTOS.inocente; S.falhas++; S.totais.inocentes++;
    setTimeout(() => som.inocente(), 250);
    aviso(`${p.ficha.nome.toUpperCase()} ERA HUMANO · ${PONTOS.inocente}`, 'ruim');
  } else if (r === 'revelou') {
    setTimeout(() => som.revelacao(), 200);
    aviso(`É ALIENÍGENA! CONTINUE GRAMPEANDO`, 'bom');
  } else if (r === 'feriu') {
    particulas.gosma(ponto); som.impactoAlien();
  } else if (r === 'morreu') {
    particulas.gosma(ponto); som.morteAlien();
    S.abatidos.push({ id: p.id, alien: true, hora: relogio(S.t / S.duracao) });
    S.pontos += PONTOS.alien; S.totais.aliens++;
    aviso(`ALIENÍGENA ELIMINADO · +${PONTOS.alien}`, 'bom');
  }
  atualizarHUD();
  return { acertou: p.id, alien: p.alien, resultado: r, vida: p.vida ?? null };
}

function pedirCracha() {
  if (S.tela !== 'jogando') return null;
  const alvo = quemNaMira();
  if (!alvo || alvo.dist > 4.5) { aviso('Chegue mais perto para pedir o crachá', 'neutro'); return null; }
  if (alvo.p.estado !== 'vivo') return null;
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
  // os dois nomes, um embaixo do outro, em maiúsculas e letra de largura fixa: a letra trocada fica na mesma coluna
  $('#nome-cracha').textContent = p.nomeNoCracha;
  $('#nome-ficha').textContent = ficha.nome;
  $('#cracha').hidden = false;
  som.papel();
}
function fecharCracha() { S.crachaDe = null; $('#cracha').hidden = true; }

let tAviso = 0;
function aviso(txt, tipo) { const a = $('#aviso'); a.textContent = txt; a.className = 'aviso ' + tipo; a.hidden = false; tAviso = 2.6; }

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
  // memorando honesto: diz quantos relatos são verdadeiros (as iscas continuam, mas contadas)
  const total = S.plano.memorando.length, falsos = S.plano.iscas.length, verdade = total - falsos;
  const porAlien = d.sinais === 1 ? 'um sinal' : `${d.sinais} sinais`;
  $('#memo-aviso').innerHTML = `A segurança recebeu ${total} relatos. <b>${verdade} foram confirmados</b>` +
    (falsos ? ` e <b>${falsos} ${falsos === 1 ? 'é boato' : 'são boatos'}</b>: não aparecem em ninguém hoje.` : '.') +
    ` Cada impostor tem ${porAlien} da lista, e nenhum sinal se repete entre impostores.`;
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
  $('#hud-memo-conta').textContent = `${S.plano.memorando.length - S.plano.iscas.length} de ${S.plano.memorando.length} verdadeiros`;
  $('#hud-memo-lista').innerHTML = S.plano.memorando.map(id => `<li>${SINAL[id].nome}</li>`).join('');
  travarMouse();
  som.campainha();
}

function fimDoDia(motivo) {
  if (S.tela !== 'jogando') return;
  const fugas = S.pessoas.filter(p => p.ativo);
  const sobra = Math.max(0, S.duracao - S.t);
  const bonus = fugas.length === 0 ? Math.floor(sobra / 60 * PONTOS.porMinutoSobrando * (540 / S.duracao)) : 0;
  S.pontos += fugas.length * PONTOS.fuga + bonus;
  const ganho = Math.max(0, S.pontos - S.pontosAntes);
  S.verba += ganho;
  S.totais.fugas += fugas.length;
  S.tela = 'relatorio'; fecharCracha(); soltarMouse();
  const demitido = S.falhas >= FALHAS_MAX;
  const ultimo = S.nDia >= DIAS.length;
  $('#rel-titulo').textContent = demitido ? 'Você foi afastado do departamento' : (fugas.length ? 'Expediente encerrado' : 'Andar limpo');
  $('#rel-motivo').textContent = {
    tempo: 'Deu 18h. Todo mundo foi para casa, inclusive quem não devia.',
    falhas: `${FALHAS_MAX} funcionários humanos abatidos. O RH abriu uma sindicância.`,
    nocaute: 'Você foi nocauteado no meio do andar. Quando acordou, o impostor já tinha saído pelo elevador.',
    limpo: 'Todos os impostores do dia foram eliminados antes do fim do expediente.',
  }[motivo];
  const linhas = [];
  for (const id of S.plano.aliens) {
    const p = S.pessoas.find(q => q.id === id);
    const sin = S.plano.sinaisDe[id].map(s => SINAL[s].nome).join(', ');
    linhas.push(`<li class="${p.ativo ? 'fugiu' : 'pego'}"><b>${p.ficha.nome}</b> (${p.ficha.depto}) era alienígena — ${sin}. <em>${p.ativo ? 'Fugiu.' : 'Eliminado.'}</em></li>`);
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
  $('#rel-verba').textContent = `Verba do almoxarifado: +${ganho} hoje · ${S.verba} disponível`;
  $('#rel-seguir').textContent = demitido || ultimo ? 'Ver o resultado final' : 'Ir ao almoxarifado';
  S.fimDeJogo = demitido || ultimo;
  mostrar('relatorio');
}

// ------------------------------------------------------------------ almoxarifado
// Entre um dia e outro: gasta a verba para subir o grampeador de nível. No nível 3 escolhe o ramo.
function telaAlmoxarifado() {
  S.tela = 'almoxarifado';
  const atual = ARMA[arma.nivel];
  $('#alm-verba').textContent = `${S.verba}`;
  $('#alm-atual').innerHTML = `<b>${arma.nivel}</b> ${atual.nome}${fichaArma(atual)}`;
  const opcoes = proximosNiveis(arma.nivel);
  $('#alm-opcoes').innerHTML = opcoes.length ? opcoes.map(id => {
    const n = ARMA[id], pode = S.verba >= n.preco;
    const aviso = n.nivel === 3 ? '<p class="ramo">Escolha definitiva: o ramo define o nível 4.</p>' : '';
    return `<div class="opcao${pode ? '' : ' cara'}"><h3>${id} · ${n.nome}</h3>${fichaArma(n, atual)}${aviso}
      <button data-comprar="${id}" ${pode ? '' : 'disabled'}>Comprar · ${n.preco}</button></div>`;
  }).join('') : '<p>Este é o último nível do grampeador.</p>';
  for (const b of document.querySelectorAll('[data-comprar]')) b.onclick = () => { comprar(b.dataset.comprar); };
  $('#alm-seguir').textContent = `Dia ${S.nDia + 1}`;
  mostrar('almoxarifado');
}
function fichaArma(n, antes) {
  const num = (v, casas) => v.toFixed(casas).replace('.', ',');
  const gps = (c) => num(1 / c, 1);                        // cadência em grampos por segundo
  // (antes → agora), verde se melhorou
  const d = (a, b, melhor, f) => antes && a !== b ? ` <em class="${melhor ? 'mais' : 'menos'}">(${f(a)} → ${f(b)})</em>` : '';
  const v = (k, menorMelhor, f) => antes ? d(antes[k], n[k], menorMelhor ? n[k] < antes[k] : n[k] > antes[k], f) : '';
  return `<ul class="ficha-arma">
    <li>Pente: ${n.pente} grampos${v('pente', false, String)}</li>
    <li>Cadência: ${gps(n.cadencia)} grampos/s${v('cadencia', true, gps)}</li>
    <li>Recarga: ${num(n.recarga, 2)} s${v('recarga', true, (x) => num(x, 2))}</li>
    <li>Derruba um alien com ${n.grampos} grampo${n.grampos > 1 ? 's' : ''}${v('grampos', true, String)}</li>
    <li>Coice: ${n.coice < 1 ? 'leve' : n.coice > 1.5 ? 'forte' : 'normal'}</li></ul>`;
}
// compra o nível `id`: precisa ser o próximo do nível atual (ramo travado) e caber na verba
function comprar(id) {
  const n = ARMA[id];
  if (!n || n.de !== arma.nivel) return { ok: false, motivo: 'fora do caminho', nivel: arma.nivel };
  if (S.verba < n.preco) return { ok: false, motivo: 'verba', nivel: arma.nivel };
  S.verba -= n.preco;
  arma.aplicar(id, true);
  som.recarga();
  if (S.tela === 'almoxarifado') telaAlmoxarifado();
  atualizarHUD();
  return { ok: true, nivel: id, verba: S.verba };
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
  S.nDia = 1; S.pontos = 0; S.falhas = 0; S.log = []; S.fimDeJogo = false; S.verba = 0;
  arma.aplicar('L1');                  // o upgrade vale a semana; nova semana começa no nível 1
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
  const vivos = S.pessoas.filter(p => p.ativo).length;
  $('#hud-aliens').textContent = `${vivos} impostor${vivos === 1 ? '' : 'es'} no andar`;
  $('#hud-grampos').textContent = arma.ocupada ? (arma.troca > 0 ? 'trocando…' : 'recarregando…') : `${arma.pente} / ${arma.cfg.pente}`;
  $('#hud-arma').textContent = `${arma.nivel} · ${ARMA[arma.nivel].nome}`;
  $('#hud-grampos').classList.toggle('pouco', !arma.ocupada && arma.pente <= 3);
  $('#hud-vida').innerHTML = Array.from({ length: VIDA_JOGADOR }, (_, i) => `<span class="${i < S.jogador.vida ? 'ok' : ''}"></span>`).join('');
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
  if (e.button === 0) { S.gatilho = true; atirar(); }
  if (e.button === 2) S.jogador.zoom = true;
});
addEventListener('mouseup', (e) => { if (e.button === 2) S.jogador.zoom = false; if (e.button === 0) S.gatilho = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => {
  S.teclas[e.code] = true;
  if (S.tela === 'jogando') {
    if (e.code === 'KeyE') { if (S.crachaDe) fecharCracha(); else pedirCracha(); }
    if (e.code === 'KeyZ') S.jogador.zoom = true;
    if (e.code === 'KeyR' && arma.recarregar()) { som.recarga(); atualizarHUD(); }
    if (e.code === 'Tab') { e.preventDefault(); $('#hud-memo').classList.toggle('aberto'); }
  }
});
addEventListener('keyup', (e) => { S.teclas[e.code] = false; if (e.code === 'KeyZ') S.jogador.zoom = false; });

$('#btn-comecar').onclick = () => { som.ligar(); novoJogo(); };
$('#btn-expediente').onclick = () => comecarExpediente();
$('#btn-continuar').onclick = () => { S.tela = 'jogando'; mostrar(null); travarMouse(); };
$('#btn-desistir').onclick = () => { S.tela = 'titulo'; mostrar('titulo'); };
$('#rel-seguir').onclick = () => { if (S.fimDeJogo) telaFinal(); else telaAlmoxarifado(); };
$('#alm-seguir').onclick = () => proximoDia();
$('#btn-denovo').onclick = () => novoJogo();

// ------------------------------------------------------------------ laço
let ultimo = performance.now();
function passo(dt) {
  if (S.tela === 'jogando') {
    S.t += dt;
    atualizarJogador(dt);
    const m = quemNaMira();
    S.mira = m?.p || null;
    $('#dica').textContent = S.crachaDe ? '[E] devolver o crachá' : (m && m.dist < 4.5 && m.p.estado === 'vivo' ? '[E] pedir o crachá' : (arma.pente === 0 && !arma.ocupada ? '[R] recarregar' : ''));
    $('#mira').classList.toggle('alvo', !!m);
    for (const p of S.pessoas) atualizarIA(p, dt);
    // segurar o gatilho = grampos em sequência
    if (S.gatilho && arma.espera <= 0 && !arma.ocupada && arma.pente > 0) atirar();
    if (arma._estavaRec && !arma.ocupada) atualizarHUD();
    if (!arma._estavaRec && arma.ocupada) { som.recarga(); atualizarHUD(); }
    arma._estavaRec = arma.ocupada;
    if (S.crachaDe && S.crachaDe.pos.distanceTo(S.jogador.pos) > 6) fecharCracha();
    if (tAviso > 0) { tAviso -= dt; if (tAviso <= 0) $('#aviso').hidden = true; }
    if (Math.floor(S.t) !== Math.floor(S.t - dt)) atualizarHUD();
    const restam = S.pessoas.filter(p => p.ativo).length;
    const animando = S.pessoas.some(p => (p.estado === 'morrendo' || p.estado === 'caindo') && !p.fim);
    if (S.jogador.vida <= 0) { if ((S._nocaute = (S._nocaute || 0) + dt) > 1.2) { S._nocaute = 0; fimDoDia('nocaute'); } }
    else if (S.falhas >= FALHAS_MAX && !animando) fimDoDia('falhas');
    else if (restam === 0 && !animando) fimDoDia('limpo');
    else if (S.t >= S.duracao) fimDoDia('tempo');
  } else if (S.tela === 'almoxarifado') {
    // almoxarifado: o grampeador fica na mão, na frente do escritório parado (a troca de nível aparece)
    camera.position.copy(S.jogador.pos); camera.rotation.set(S.jogador.pitch, S.jogador.yaw, 0, 'YXZ');
    arma.atualizar(dt);
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
  grampos.atualizar(dt);
}
function quadro(agora) {
  const dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora;
  if (!window.__TESTE || window.__TESTE_TEMPO_REAL) passo(dt);
  desenhar();
  requestAnimationFrame(quadro);
}

// ------------------------------------------------------------------ início
(async () => {
  const barra = $('#barra');
  await Promise.all([carregarModelos('./modelos', (f) => barra.style.width = Math.round(f * 100) + '%'), arma.carregar('./modelos/grampeador.glb')]);
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
  avancar: (seg, dt = 1 / 30) => { for (let t = 0; t < seg; t += dt) passo(dt); desenhar(); return { tela: S.tela, t: S.t }; },
  pessoas: () => S.pessoas.map(p => ({ id: p.id, alien: p.alien, sinais: [...p.sinais], estado: p.estado, vida: p.vida ?? null, x: p.pos.x, z: p.pos.z, cracha: p.nomeNoCracha })),
  arma: () => ({ pente: arma.pente, recarregando: arma.recarregando, espera: arma.espera, visivel: arma.rig.visible, nivel: arma.nivel, troca: arma.troca, pecas: arma.pecasVisiveis() }),
  economia: () => ({ verba: S.verba, pontos: S.pontos, nivel: arma.nivel, opcoes: proximosNiveis(arma.nivel), tela: S.tela }),
  comprar: (id) => comprar(id),
  almoxarifado: () => telaAlmoxarifado(),
  darVerba: (n) => { S.verba += n; return S.verba; },
  nivel: (id, animar = false) => { arma.aplicar(id, animar); atualizarHUD(); return arma.nivel; },
  jogador: () => ({ vida: S.jogador.vida, x: S.jogador.pos.x, z: S.jogador.pos.z }),
  recarregar: () => arma.recarregar(),
  armaObj: arma,
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
    atualizarJogador(0); desenhar();
    return quemNaMira()?.p.id || null;
  },
  olharPara: (x, y, z, px, pz) => {
    if (px != null) S.jogador.pos.set(px, 1.62, pz);
    const d = V(x, y, z).sub(S.jogador.pos);
    S.jogador.yaw = Math.atan2(-d.x, -d.z); S.jogador.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    atualizarJogador(0); desenhar(); return true;
  },
  zoom: (on) => { S.jogador.zoom = on; camera.fov = on ? FOV_ZOOM : FOV; camera.updateProjectionMatrix(); desenhar(); return camera.fov; },
  atirar, pedirCracha, fecharCracha,
  // dia sob medida para provas: presentes = ids; aliens = { id: [sinais] }
  diaForcado: (presentes, aliens) => {
    const plano = { dia: { ...DIAS[0], pessoas: presentes.length, aliens: Object.keys(aliens).length }, presentes,
      aliens: Object.keys(aliens), sinaisDe: aliens, memorando: Object.values(aliens).flat(), iscas: [] };
    S.nDia = 1; prepararDia(plano); S.tela = 'jogando'; mostrar(null); atualizarHUD(); return S.pessoas.length;
  },
  tempoPessoa: (id, t) => { S.pessoas.find(q => q.id === id).t = t; return t; },
  caneca: (id) => S.pessoas.find(q => q.id === id).medirCaneca(),
  gole: (id) => { const p = S.pessoas.find(q => q.id === id); p._proxGole = 0; p._gole = 0; return true; },
  // Simula o expediente inteiro do dia `n` da semana `semente` (jogador parado na entrada olhando
  // para o teto, sem mirar ninguém nem atirar) e mede, para cada alien e cada sinal dele, quantos
  // segundos e quantas vezes o sinal esteve à mostra (Pessoa.vis). Para a prova estatística.
  medirSinais: (n, semente, dt = 0.1) => {
    S.semente = semente; S.nDia = n; prepararDia(); S.tela = 'jogando'; S.jogador.pitch = 1.3;
    const med = {};
    for (const p of S.pessoas) if (p.alien) med[p.id] = Object.fromEntries([...p.sinais].map(s => [s, { seg: 0, vezes: 0, antes: false }]));
    while (S.tela === 'jogando') {
      passo(dt);
      for (const p of S.pessoas) if (med[p.id]) for (const s in med[p.id]) {
        const m = med[p.id][s], agora = p.vis.has(s);
        if (agora) { m.seg += dt; if (!m.antes) m.vezes++; }
        m.antes = agora;
      }
    }
    S.log.pop();
    return { dia: n, semente, duracao: S.duracao, aliens: Object.entries(med).map(([id, ss]) => ({ id, sinais: Object.fromEntries(Object.entries(ss).map(([s, m]) => [s, { seg: +m.seg.toFixed(1), vezes: m.vezes }])) })) };
  },
  // põe a pessoa parada num ponto, virada para `yaw`, sem conversar nem sair dali (provas e fotos)
  posicionar: (id, x, z, yaw) => { const p = S.pessoas.find(q => q.id === id); p.pos.set(x, 0, z); p.obj.rotation.y = yaw; p.ia.modo = 'parado'; p.ia.ate = 1e9; p.ia.alvo = { olha: yaw, fixo: true }; return true; },
  andarPara: (id, x, z) => { const p = S.pessoas.find(q => q.id === id); p.ia.modo = 'andando'; p.ia.rota = [V(x, 0, z)]; p.ia.alvo = { olha: 0 }; return true; },
  // congela a pessoa numa animação, no ponto `frac` (0..1) do clipe; a IA para de mexer nela
  pose: (id, anim, frac, x, z, yaw, andando = false) => {
    const p = S.pessoas.find(q => q.id === id);
    p.ia.modo = 'roteiro'; p.andando = andando;
    p.pos.set(x, 0, z); p.obj.rotation.y = yaw;
    p.mixer.stopAllAction();
    const a = p.acoes[anim]; a.reset().play(); a.timeScale = 0; a.time = frac * a.getClip().duration; p.atual = a;
    return a.getClip().duration;
  },
  proximoDia: () => { proximoDia(); return S.tela; },
  tela: () => S.tela,
  // x da cabeça da pessoa na tela (-1 = borda esquerda, 1 = direita)
  naTela: (id) => { const p = S.pessoas.find(q => q.id === id); camera.updateMatrixWorld(); return p.ossos.Head.getWorldPosition(V()).project(camera).x; },
  pessoa: (id) => S.pessoas.find(q => q.id === id),
  render: () => { desenhar(); return true; },
  info: () => ({ calls: render.info.render.calls, tris: render.info.render.triangles, geos: render.info.memory.geometries, tex: render.info.memory.textures }),
};
