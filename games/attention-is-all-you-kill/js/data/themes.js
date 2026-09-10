// themes.js — identidade visual por andar.
// Cada andar tem paleta, densidade de nevoa e uma regra de luz própria.

export const THEMES = {
  1: {
    id: 1,
    name: 'A FAZENDA',
    ambient: 0x7498b0,
    hemi: 0x4d82a0,
    fog: 0x0e2230,
    fogDensity: 0.014,
    floorColor: 0x3e5468,
    ceilingColor: 0x243240,
    wallColor: 0x4e6a82,
    wallAccent: 0x35f0d8,
    propColor: 0x2a3a48,
    propEmissive: 0x2ad8ff,
    lightColor: 0x4fd4ff,
    // Quando o contexto cai, o ambiente fica vermelho. Lido pelo engine.setMood.
    dangerAmbient: 0x6a1a18,
    dangerFog: 0x180608,
    dangerHemi: 0x4a1114,
    hint: 'Racks de servidor. Leds azuis. O calor sai pelo duto.'
  },
  2: {
    id: 2,
    name: 'O ESCRITORIO',
    ambient: 0xb8c6d4,
    hemi: 0x8a97a6,
    fog: 0x141820,
    fogDensity: 0.017,
    floorColor: 0x565c64,
    ceilingColor: 0x3c424a,
    wallColor: 0xc2cad4,
    wallAccent: 0x2fe08a,
    propColor: 0x6c7680,
    propEmissive: 0x9fe8c0,
    lightColor: 0xeaf2fa,
    dangerAmbient: 0x6a1a18,
    dangerFog: 0x1a0a0a,
    dangerHemi: 0x4a1114,
    hint: 'Cubiculos, carpete cinza, vidro por toda parte.'
  },
  3: {
    id: 3,
    name: 'A BOLSA',
    ambient: 0x2a2418,
    hemi: 0x1f1a10,
    fog: 0x0d0a06,
    fogDensity: 0.030,
    floorColor: 0x14120c,
    ceilingColor: 0x0a0906,
    wallColor: 0x2a2418,
    wallAccent: 0xffb347,
    propColor: 0x1a1710,
    propEmissive: 0x35d06a,
    lightColor: 0xffc76a,
    dangerAmbient: 0x6a1a18,
    dangerFog: 0x180d08,
    dangerHemi: 0x4a1114,
    hint: 'O chão é um gráfico de candles. Ele mente para você.'
  },
  4: {
    id: 4,
    name: 'O SUBURBIO',
    ambient: 0x9ab0c8,
    hemi: 0x7c93ac,
    fog: 0x1a2430,
    fogDensity: 0.016,
    floorColor: 0x3d5a34,
    ceilingColor: 0x4a5f7a,
    wallColor: 0xb0a494,
    wallAccent: 0xf0e6c8,
    propColor: 0x5a6a5a,
    propEmissive: 0xffd89a,
    lightColor: 0xffe6c0,
    dangerAmbient: 0x6a1a18,
    dangerFog: 0x241014,
    dangerHemi: 0x4a1114,
    hint: 'Cada casa tem uma plaquinha: servido por uma 3090.'
  },
  5: {
    id: 5,
    name: 'A ESTACAO',
    ambient: 0x2a3a30,
    hemi: 0x1c2a24,
    fog: 0x060a08,
    fogDensity: 0.040,
    floorColor: 0x24302a,
    ceilingColor: 0x101816,
    wallColor: 0x30403a,
    wallAccent: 0xffd21e,
    propColor: 0x1a2420,
    propEmissive: 0xff3b30,
    lightColor: 0x9ad0b0,
    dangerAmbient: 0x6a1a18,
    dangerFog: 0x180808,
    dangerHemi: 0x4a1114,
    hint: 'O trem passa a cada 25 segundos. Fique fora da via.'
  }
};

export function themeForFloor(floor) {
  return THEMES[floor] || THEMES[1];
}