// controller.js — jogador: movimento, colisão, pulo e câmera.
// Colisão: circulo contra grid. Movimento resolvido por eixo separado,
// com empurrao de penetracao, para o jogador deslizar em quina em vez de travar.

import * as THREE from '../../vendor/three.module.js';
import { TILE } from '../world/dungeon.js';

const EYE_HEIGHT = 1.68;
const RADIUS = 0.42;
const GRAVITY = 22;
const JUMP_SPEED = 7.2;
const WALK_SPEED = 5.6;
const SPRINT_MUL = 1.45;
const ACCEL = 42;
const FRICTION = 12;

export class Controller {
  constructor(dungeon, camera, input) {
    this.dungeon = dungeon;
    this.camera = camera;
    this.input = input;

    this.position = new THREE.Vector3(0, EYE_HEIGHT, 0);
    this.velocity = new THREE.Vector3();
    this.velY = 0;
    this.onGround = true;
    this.yaw = 0;
    this.pitch = 0;

    this.radius = RADIUS;
    this.speedMul = 1;
    this.bobTime = 0;
    this.bobAmount = 0;
    this.recoilPitch = 0;
    this.shakeTime = 0;
    this.shakeAmount = 0;

    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();
  }

  get eyeHeight() { return EYE_HEIGHT; }

  setPosition(x, z) {
    this.position.set(x, EYE_HEIGHT, z);
    this.velocity.set(0, 0, 0);
    this.velY = 0;
  }

  look(dx, dy, sensitivity) {
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    const limit = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }

  addRecoil(amount) {
    this.recoilPitch += amount;
  }

  shake(amount) {
    this.shakeAmount = Math.min(0.08, this.shakeAmount + amount);
    this.shakeTime = 0.22;
  }

  // Empurra o circulo para fora de qualquer tile solido que ele penetre.
  resolveCollisions() {
    const r = this.radius;
    const { tx, tz } = this.dungeon.worldToTile(this.position.x, this.position.z);

    for (let iz = tz - 1; iz <= tz + 1; iz++) {
      for (let ix = tx - 1; ix <= tx + 1; ix++) {
        if (!this.dungeon.isSolid(ix, iz)) continue;

        const minX = ix * TILE, maxX = minX + TILE;
        const minZ = iz * TILE, maxZ = minZ + TILE;

        // ponto do retangulo mais próximo do centro do circulo
        const cx = Math.max(minX, Math.min(this.position.x, maxX));
        const cz = Math.max(minZ, Math.min(this.position.z, maxZ));

        let dx = this.position.x - cx;
        let dz = this.position.z - cz;
        let dist = Math.hypot(dx, dz);

        if (dist >= r) continue;

        if (dist < 1e-6) {
          // centro dentro do tile: empurra pelo eixo de menor saída
          const toLeft = this.position.x - minX;
          const toRight = maxX - this.position.x;
          const toBack = this.position.z - minZ;
          const toFront = maxZ - this.position.z;
          const minPen = Math.min(toLeft, toRight, toBack, toFront);
          if (minPen === toLeft) this.position.x = minX - r;
          else if (minPen === toRight) this.position.x = maxX + r;
          else if (minPen === toBack) this.position.z = minZ - r;
          else this.position.z = maxZ + r;
          continue;
        }

        const push = (r - dist) / dist;
        this.position.x += dx * push;
        this.position.z += dz * push;
      }
    }
  }

  update(dt) {
    const input = this.input;
    const axis = input.moveAxis();

    // direções no plano, independentes de pitch
    this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    this._wish.set(0, 0, 0)
      .addScaledVector(this._forward, -axis.z)
      .addScaledVector(this._right, axis.x);

    if (this._wish.lengthSq() > 0) this._wish.normalize();

    const sprinting = input.isSprinting() && axis.z < 0;
    const targetSpeed = WALK_SPEED * this.speedMul * (sprinting ? SPRINT_MUL : 1);

    // acelera na direção desejada
    const accel = ACCEL * (this.onGround ? 1 : 0.35);
    this.velocity.x += this._wish.x * accel * dt;
    this.velocity.z += this._wish.z * accel * dt;

    // atrito: só freia de verdade quando o jogador não esta pedindo movimento.
    //
    // Aplicar atrito sempre criava uma velocidade terminal de ACCEL/FRICTION
    // (42/12 = 3.5 m/s), que ficava ABAIXO até da caminhada declarada (5.6) e
    // muito abaixo da corrida (8.12). O Shift não mudava nada porque o atrito
    // cortava a velocidade antes do limite entrar em ação. Verificado: 2.8 m/s
    // com e sem Shift.
    const pedindoMovimento = this._wish.lengthSq() > 0.0001;
    if (this.onGround) {
      const atrito = FRICTION * (pedindoMovimento ? 0.18 : 1);
      const damp = Math.max(0, 1 - atrito * dt);
      this.velocity.x *= damp;
      this.velocity.z *= damp;
    }

    // limita a velocidade
    const horiz = Math.hypot(this.velocity.x, this.velocity.z);
    if (horiz > targetSpeed) {
      const s = targetSpeed / horiz;
      this.velocity.x *= s;
      this.velocity.z *= s;
    }

    // pulo
    if (input.consumeJump() && this.onGround) {
      this.velY = JUMP_SPEED;
      this.onGround = false;
    }

    // gravidade
    this.velY -= GRAVITY * dt;

    // integra por eixo para deslizar em quina
    this.position.x += this.velocity.x * dt;
    this.resolveCollisions();
    this.position.z += this.velocity.z * dt;
    this.resolveCollisions();

    // vertical
    this.position.y += this.velY * dt;
    if (this.position.y <= EYE_HEIGHT) {
      this.position.y = EYE_HEIGHT;
      this.velY = 0;
      this.onGround = true;
    }

    // head bob proporcional a velocidade real
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.onGround && speed > 0.6) {
      this.bobTime += dt * speed * 1.7;
      this.bobAmount += (1 - this.bobAmount) * Math.min(1, dt * 8);
    } else {
      this.bobAmount += (0 - this.bobAmount) * Math.min(1, dt * 8);
    }
    const bobY = Math.sin(this.bobTime * 2) * 0.045 * this.bobAmount;
    const bobX = Math.cos(this.bobTime) * 0.03 * this.bobAmount;

    // retorno do recuo
    this.recoilPitch *= Math.max(0, 1 - 12 * dt);
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    if (this.shakeTime === 0) this.shakeAmount *= Math.max(0, 1 - 8 * dt);
    const shakeX = (Math.random() - 0.5) * this.shakeAmount;
    const shakeY = (Math.random() - 0.5) * this.shakeAmount;

    // aplica na câmera
    this.camera.position.set(
      this.position.x + bobX + shakeX,
      this.position.y + bobY + shakeY,
      this.position.z
    );
    this.camera.rotation.set(this.pitch + this.recoilPitch, this.yaw, 0, 'YXZ');
  }

  // Direção de mira no espaço do mundo.
  aimDirection() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(new THREE.Euler(this.pitch + this.recoilPitch, this.yaw, 0, 'YXZ'));
    return dir.normalize();
  }

  eyePosition() {
    return new THREE.Vector3(this.position.x, this.position.y, this.position.z);
  }
}

export { RADIUS, EYE_HEIGHT };