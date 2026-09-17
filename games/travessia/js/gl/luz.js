// O trecho de GLSL que todo material do sertao compartilha: sombra do sol,
// luz difusa com ambiente de ceu, e nevoa por distancia.
//
// Fica num arquivo so porque terreno, mato, casa e bicho tem de receber
// exatamente a mesma luz. Quando isso estava copiado em cada sombreador, o
// mato ficava com a sombra de uma hora e o chao com a de outra.

export const UNIFORMES_DE_LUZ = `
uniform vec3 uSol;
uniform vec3 uCorDoSol;
uniform vec3 uCorAmbiente;
uniform vec3 uCorNevoa;
uniform vec3 uCamera;
uniform float uNevoa;
uniform mat4 uLuzVP;
uniform sampler2D uSombra;
uniform float uTexelSombra;
uniform float uTempo;
uniform vec3 uLampiao;
uniform float uForcaDoLampiao;
`;

// O vento e conta de vertice, e por isso mora separado: o peso vem do proprio
// vertice (raiz nao anda, ponta anda) e nao custa nada de CPU.
export const VENTO = `
uniform float uTempo;
uniform float uVento;

vec3 balancar(vec3 posicao, vec3 base, float peso) {
  float fase = uTempo * 1.7 + base.x * 0.35 + base.z * 0.27;
  float sopro = sin(fase) * 0.6 + sin(fase * 2.3 + 1.7) * 0.3 + sin(fase * 0.41) * 0.5;
  float f = peso * uVento * sopro;
  return posicao + vec3(f, -abs(f) * 0.18, f * 0.62);
}
`;

// Tres por tres de amostras, que e o bastante para a borda da sombra nao
// virar escada num mapa de 2048. O vies cresce com a inclinacao: sem isso o
// chao quase paralelo ao sol fica listrado de sombra propria.
export const FUNCOES_DE_LUZ = `
float naSombra(vec3 mundo, float inclinacao) {
  vec4 p = uLuzVP * vec4(mundo, 1.0);
  vec3 c = p.xyz / p.w * 0.5 + 0.5;
  if (c.x < 0.002 || c.x > 0.998 || c.y < 0.002 || c.y > 0.998 || c.z > 0.999) return 1.0;
  float vies = 0.0012 + 0.0075 * inclinacao;
  float soma = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      float d = texture(uSombra, c.xy + vec2(float(x), float(y)) * uTexelSombra).r;
      soma += (c.z - vies > d) ? 0.0 : 1.0;
    }
  }
  return soma / 9.0;
}

vec3 iluminar(vec3 albedo, vec3 normal, vec3 mundo) {
  float lambert = max(dot(normal, uSol), 0.0);
  float doCeu = 0.45 + 0.55 * clamp(normal.y * 0.5 + 0.5, 0.0, 1.0);
  float sombra = naSombra(mundo, 1.0 - lambert);
  // um respingo de luz de volta do chao quente, so no lado oposto ao sol
  float devolvida = max(0.0, -dot(normal, uSol)) * 0.14;
  vec3 cor = albedo * (uCorAmbiente * doCeu + uCorDoSol * (lambert * sombra + devolvida));

  // Lampiao do jogador. De madrugada o sertao e escuro de verdade — e tem de
  // ser, que e isso que faz a noite valer o risco — mas sem um circulo de luz
  // em volta dos pes nao da para andar.
  if (uForcaDoLampiao > 0.002) {
    vec3 paraLuz = uLampiao - mundo;
    float d = length(paraLuz);
    float queda = uForcaDoLampiao / (1.0 + d * d * 0.055);
    float face = max(0.2, dot(normal, paraLuz / max(d, 0.001)));
    cor += albedo * vec3(1.0, 0.76, 0.44) * queda * face;
  }
  return cor;
}

vec3 comNevoa(vec3 cor, vec3 mundo) {
  float d = length(mundo - uCamera);
  float k = 1.0 - exp(-pow(d * uNevoa, 2.0));
  // nevoa rasteira: de madrugada ela se deita no chao e some conforme sobe
  float rasteira = clamp(1.0 - (mundo.y - uCamera.y + 6.0) * 0.06, 0.0, 1.0);
  k = clamp(k * (0.72 + 0.4 * rasteira), 0.0, 1.0);
  return mix(cor, uCorNevoa, k);
}
`;
