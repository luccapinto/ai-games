// Os cinco bichos do subsolo e a maquina de estados deles.
//
// A regra que da forma ao jogo: cada bicho tem um `visao` e um `audicao`
// separados, e a audicao e um raio em celulas de ruido — nao de linha reta. Um
// grito atravessa a curva do corredor; a lanterna nao. Por isso o cego (visao
// zero, audicao 19) e o unico inimigo que o jogador nunca engana ficando no
// escuro, e o unico que se engana andando agachado.

import * as M from './mapa.js';
import { linhaLivre } from './armas.js';

export const TIPOS = {
  larva: {
    nome: 'LARVA', vida: 46, vel: 1.15, dano: 7, cadencia: 1.0,
    visao: 6, audicao: 8, raio: 0.36, alcance: 1.05, altura: 0.58,
    cor: '#93a862', cor2: '#5d6b39', sangue: '#7d9b3c',
  },
  rastejo: {
    nome: 'RASTEJO', vida: 30, vel: 3.3, dano: 6, cadencia: 0.6,
    visao: 4, audicao: 16, raio: 0.3, alcance: 0.95, altura: 0.4,
    cor: '#c8836a', cor2: '#7a4634', sangue: '#c05a3a',
  },
  cego: {
    nome: 'CEGO', vida: 75, vel: 2.0, dano: 16, cadencia: 1.8,
    visao: 0, audicao: 19, raio: 0.42, alcance: 1.25, altura: 0.86,
    cor: '#d9d3c4', cor2: '#8d8778', sangue: '#b8ae96',
  },
  cuspe: {
    nome: 'CUSPIDOR', vida: 62, vel: 1.5, dano: 9, cadencia: 2.1,
    visao: 11, audicao: 6, raio: 0.38, alcance: 10.5, altura: 0.72,
    cor: '#8fae9b', cor2: '#3f5c4c', sangue: '#6fae86',
    projetil: true, distanciaBoa: 7.5,
  },
  capataz: {
    nome: 'CAPATAZ', vida: 200, vel: 2.2, dano: 18, cadencia: 1.7,
    visao: 9, audicao: 14, raio: 0.55, alcance: 1.6, altura: 1.05,
    cor: '#caa24a', cor2: '#6b4a1e', sangue: '#d08a2a',
    blindagem: 0.35, chefe: true,
  },
};

const REPLANEJO = 0.45;

export function criarInimigo(tipo, x, y) {
  const t = TIPOS[tipo];
  if (!t) throw new Error(`inimigo desconhecido: ${tipo}`);
  return {
    tipo, x, y, vida: t.vida, vidaMax: t.vida,
    estado: 'dormindo', ang: 0, alvo: null,
    caminho: null, indice: 0, relogioPlano: 0, recarga: 0,
    esperando: 0, semVista: 0, fase: 'anda', faseRelogio: 0,
    vulneravel: false, jaAcertou: false, tremor: 0, morteEm: 0, dor: 0,
  };
}

// Um passo de um bicho. `ctx` e o que ele tem direito de saber:
//   mapa, jogador, ruidos (eventos deste quadro, com o campo ja espalhado),
//   ferir(dano), cuspir(inimigo, dir), sorteio(), inimigos (para nao empilhar).
export function passoInimigo(e, ctx, dt) {
  const t = TIPOS[e.tipo];
  if (e.vida <= 0) {
    if (e.estado !== 'morto') e.estado = 'morto';
    e.morteEm += dt;
    return;
  }
  e.recarga = Math.max(0, e.recarga - dt);
  e.dor = Math.max(0, e.dor - dt * 3);
  e.relogioPlano -= dt;
  e.faseRelogio -= dt;
  e.tremor = Math.max(0, e.tremor - dt * 4);

  const jog = ctx.jogador;
  const dx = jog.x - e.x;
  const dy = jog.y - e.y;
  const distancia = Math.hypot(dx, dy);

  // --- percepcao -------------------------------------------------------
  const celula = { x: Math.floor(e.x), y: Math.floor(e.y) };
  for (const ruido of ctx.ruidos) {
    const restante = ruido.campo.get(M.chave(celula.x, celula.y));
    if (restante === undefined) continue;
    if (ruido.forca - restante > t.audicao) continue;
    if (e.estado === 'dormindo' || e.estado === 'alerta') {
      e.estado = 'alerta';
      e.alvo = { x: ruido.x, y: ruido.y };
      e.caminho = null;
      e.esperando = 0;
    }
  }

  e.vendo = 0;
  if (t.visao > 0) {
    const iluminado = jog.lanterna ? 1.7
      : (M.luzDaCelula(ctx.mapa, Math.floor(jog.x), Math.floor(jog.y)) > 0.22 ? 1.15 : 0.5);
    const alcanceVista = t.visao * (iluminado + jog.brilho);
    if (distancia <= alcanceVista && linhaLivre(ctx.mapa, e, jog)) {
      e.vendo = alcanceVista;
      e.estado = 'cacando';
      e.semVista = 0;
      e.alvo = { x: jog.x, y: jog.y };
    } else if (e.estado === 'cacando') {
      e.semVista += dt;
      if (e.semVista > 4 && distancia > 2.2) {
        e.estado = 'alerta';
        e.esperando = 0;
      }
    }
  } else if (e.estado === 'alerta' && distancia < 2.4) {
    // O cego nao ve: a esta distancia ele sente o bafo e passa a cacar.
    e.estado = 'cacando';
    e.alvo = { x: jog.x, y: jog.y };
  }

  // Bicho em alerta que encosta em voce descobre voce — qualquer um, nao so o
  // cego. Sem esta linha um rastejo fica parado no seu colo por nao "ver" no
  // escuro, que e o oposto do que a cena mostra.
  if (e.estado === 'alerta' && distancia < t.alcance + 0.4) {
    e.estado = 'cacando';
    e.alvo = { x: jog.x, y: jog.y };
  }

  if (e.estado === 'dormindo') return;

  if (e.estado === 'cacando') {
    e.alvo = { x: jog.x, y: jog.y };
    if (t.visao === 0 && distancia > 6) {
      e.estado = 'alerta';
      e.esperando = 0;
    }
  }

  // --- capataz: blindado enquanto anda, aberto enquanto arma o golpe -----
  if (t.chefe) {
    if (e.fase === 'anda' && e.estado === 'cacando' && distancia < 6.5
      && linhaLivre(ctx.mapa, e, jog) && e.recarga <= 0) {
      e.fase = 'arma';
      e.faseRelogio = 0.9;
      e.vulneravel = true;
      // A direcao e travada aqui, no aviso — e nao no comeco da investida. Com
      // a mira refeita no fim do aviso, o capataz seguia o desvio e o aviso
      // nao servia para nada: dava 110 de dano no robo numa fase so.
      e.ang = Math.atan2(dy, dx);
    } else if (e.fase === 'arma' && e.faseRelogio <= 0) {
      e.fase = 'investida';
      e.faseRelogio = 0.55;
      e.jaAcertou = false;
    } else if (e.fase === 'investida' && e.faseRelogio <= 0) {
      e.fase = 'anda';
      e.vulneravel = false;
      e.recarga = t.cadencia;
    }
    if (e.fase === 'arma') { e.tremor = 1; return; }
    if (e.fase === 'investida') {
      deslizar(e, Math.cos(e.ang) * 7.2 * dt, Math.sin(e.ang) * 7.2 * dt, ctx.mapa, t.raio);
      // Uma investida, um acerto. Sem a trava, o contato feria a cada quadro:
      // 0,55 s de encosto valiam trinta e tres golpes e matavam sem aviso.
      if (!e.jaAcertou && distancia < t.alcance + 0.3) {
        e.jaAcertou = true;
        ctx.ferir(t.dano, e);
      }
      return;
    }
  }

  // --- ataque -----------------------------------------------------------
  if (e.estado === 'cacando') {
    if (t.projetil) {
      // O cuspidor avisa antes: meio segundo inflando, parado, brilhando. Sem
      // o aviso ele e dano que aparece do nada — com ele, o jogador tem o que
      // fazer, que e sair da linha ou cortar a visada.
      const alcance = Math.min(t.alcance, e.vendo || 0);
      if (e.fase === 'cuspindo') {
        e.tremor = 1;
        if (e.faseRelogio <= 0) {
          e.fase = 'anda';
          e.recarga = t.cadencia;
          if (linhaLivre(ctx.mapa, e, jog)) {
            e.ang = Math.atan2(dy, dx);
            const d = distancia || 1;
            ctx.cuspir(e, { x: dx / d, y: dy / d });
          }
        }
        return;
      }
      if (distancia <= alcance && linhaLivre(ctx.mapa, e, jog) && e.recarga <= 0) {
        e.fase = 'cuspindo';
        e.faseRelogio = 0.5;
        e.ang = Math.atan2(dy, dx);
        ctx.sinal('inflando', e);
        return;
      }
    } else if (distancia <= t.alcance && e.recarga <= 0) {
      e.recarga = t.cadencia;
      ctx.ferir(t.dano, e);
      return;
    }
  }

  // --- andar ------------------------------------------------------------
  let destino = e.alvo;
  if (!destino) return;
  if (t.projetil && e.estado === 'cacando' && distancia < t.distanciaBoa
    && linhaLivre(ctx.mapa, e, jog)) {
    // Cuspidor mantem distancia: recua em vez de colar.
    destino = { x: e.x - dx, y: e.y - dy };
  }

  if (e.relogioPlano <= 0 || !e.caminho) {
    e.relogioPlano = REPLANEJO;
    e.caminho = M.caminho(ctx.mapa, e, destino, { crachas: null });
    e.indice = 1;
  }

  let passoX = 0;
  let passoY = 0;
  if (e.caminho && e.indice < e.caminho.length) {
    const no = e.caminho[e.indice];
    const cx = no.x + 0.5;
    const cy = no.y + 0.5;
    const d = Math.hypot(cx - e.x, cy - e.y);
    if (d < 0.22) {
      e.indice++;
    } else {
      passoX = (cx - e.x) / d;
      passoY = (cy - e.y) / d;
    }
  } else if (distancia > 0.4 && linhaLivre(ctx.mapa, e, destino)) {
    const d = Math.hypot(destino.x - e.x, destino.y - e.y) || 1;
    passoX = (destino.x - e.x) / d;
    passoY = (destino.y - e.y) / d;
  }

  // Separacao: dois bichos no mesmo tile viram um bicho com o dobro de dano,
  // e o jogador nao tem como ler isso na tela.
  for (const outro of ctx.inimigos) {
    if (outro === e || outro.vida <= 0) continue;
    const ox = e.x - outro.x;
    const oy = e.y - outro.y;
    const d2 = ox * ox + oy * oy;
    const minimo = (TIPOS[outro.tipo].raio + t.raio) * 0.95;
    if (d2 > minimo * minimo || d2 < 1e-6) continue;
    const d = Math.sqrt(d2);
    passoX += (ox / d) * 0.6;
    passoY += (oy / d) * 0.6;
  }

  const norma = Math.hypot(passoX, passoY);
  if (norma > 1e-6) {
    const vel = t.vel * (e.estado === 'cacando' ? 1 : 0.65);
    e.ang = Math.atan2(passoY, passoX);
    deslizar(e, (passoX / norma) * vel * dt, (passoY / norma) * vel * dt, ctx.mapa, t.raio);
  } else if (e.estado === 'alerta') {
    e.esperando += dt;
    if (e.esperando > 2.6) {
      e.estado = 'dormindo';
      e.alvo = null;
      e.caminho = null;
    }
  }
}

// Move e escorrega na parede, um eixo por vez. Sem isso o bicho gruda na quina
// e o jogador ganha um esconderijo que nao existe no desenho da fase.
function deslizar(e, dx, dy, mapa, raio) {
  if (!bateu(mapa, e.x + dx, e.y, raio)) e.x += dx;
  if (!bateu(mapa, e.x, e.y + dy, raio)) e.y += dy;
}

function bateu(mapa, x, y, raio) {
  for (const [ox, oy] of [[-raio, -raio], [raio, -raio], [-raio, raio], [raio, raio]]) {
    if (M.solido(mapa, Math.floor(x + ox), Math.floor(y + oy))) return true;
  }
  return false;
}

export function ferirInimigo(e, dano) {
  const t = TIPOS[e.tipo];
  const fator = t.blindagem && !e.vulneravel ? t.blindagem : 1;
  const aplicado = dano * fator;
  e.vida -= aplicado;
  e.dor = 1;
  if (e.estado === 'dormindo' || e.estado === 'alerta') e.estado = 'cacando';
  if (e.vida <= 0) e.estado = 'morto';
  return aplicado;
}
