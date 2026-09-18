// O minimo de WebGL2 que o sertao precisa: compilar programa, montar malha,
// montar alvo de desenho fora da tela e gerar textura a partir de canvas.
//
// Nao ha biblioteca nem arquivo de asset em lugar nenhum do jogo. O que se
// desenha e geometria gerada por semente e cor por vertice; textura so existe
// para letra, e a letra sai de um canvas 2D escrito na hora.

export function pegarContexto(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: true,
    depth: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  return gl;
}

function compilar(gl, tipo, fonte, nome) {
  const sombreador = gl.createShader(tipo);
  gl.shaderSource(sombreador, fonte);
  gl.compileShader(sombreador);
  if (!gl.getShaderParameter(sombreador, gl.COMPILE_STATUS)) {
    const erro = gl.getShaderInfoLog(sombreador);
    const linhas = fonte.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
    throw new Error(`sombreador ${nome} nao compilou\n${erro}\n${linhas}`);
  }
  return sombreador;
}

// Devolve o programa com os locais de uniforme ja resolvidos: procurar
// uniforme por nome dentro do laco de desenho custa mais que desenhar.
export function criarPrograma(gl, nome, fonteVertice, fonteFragmento) {
  const programa = gl.createProgram();
  gl.attachShader(programa, compilar(gl, gl.VERTEX_SHADER, fonteVertice, `${nome}.vs`));
  gl.attachShader(programa, compilar(gl, gl.FRAGMENT_SHADER, fonteFragmento, `${nome}.fs`));
  gl.linkProgram(programa);
  if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
    throw new Error(`programa ${nome} nao ligou: ${gl.getProgramInfoLog(programa)}`);
  }
  const uniformes = {};
  const quantos = gl.getProgramParameter(programa, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < quantos; i++) {
    const info = gl.getActiveUniform(programa, i);
    const limpo = info.name.replace(/\[0\]$/, '');
    uniformes[limpo] = gl.getUniformLocation(programa, info.name);
  }
  return { programa, u: uniformes, nome };
}

export function criarBuffer(gl, dados, uso = gl.STATIC_DRAW) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, dados, uso);
  return buffer;
}

// atributos: [{ buffer, local, tamanho, passo, deslocamento, divisor }]
// passo e deslocamento em floats, nao em bytes — e o que se erra sempre.
export function criarVao(gl, atributos) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  for (const a of atributos) {
    gl.bindBuffer(gl.ARRAY_BUFFER, a.buffer);
    gl.enableVertexAttribArray(a.local);
    gl.vertexAttribPointer(a.local, a.tamanho, gl.FLOAT, false,
      (a.passo || 0) * 4, (a.deslocamento || 0) * 4);
    if (a.divisor) gl.vertexAttribDivisor(a.local, a.divisor);
  }
  gl.bindVertexArray(null);
  return vao;
}

// Alvo fora da tela. `profundidadeLegivel` troca o anexo de profundidade por
// uma textura: e assim que a passada do sol vira mapa de sombra.
export function criarAlvo(gl, largura, altura, opcoes = {}) {
  const quadro = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, quadro);
  const alvo = { quadro, largura, altura, cor: null, profundidade: null };

  if (opcoes.cor !== false) {
    const cor = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, cor);
    // Meia precisao quando da: a cena e guardada em linear, e em oito bits
    // por canal a madrugada sai em degraus.
    const flutuante = opcoes.flutuante && gl.getExtension('EXT_color_buffer_half_float');
    if (flutuante) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, largura, altura, 0,
        gl.RGBA, gl.HALF_FLOAT, null);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, largura, altura, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, cor, 0);
    alvo.cor = cor;
  } else {
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
  }

  if (opcoes.profundidadeLegivel) {
    const prof = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, prof);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, largura, altura, 0,
      gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, prof, 0);
    alvo.profundidade = prof;
  } else if (opcoes.profundidade !== false) {
    const rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, largura, altura);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    alvo.buffer = rb;
  }

  const estado = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (estado !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`alvo ${largura}x${altura} incompleto: ${estado.toString(16)}`);
  }
  return alvo;
}

export function apagarAlvo(gl, alvo) {
  if (!alvo) return;
  if (alvo.cor) gl.deleteTexture(alvo.cor);
  if (alvo.profundidade) gl.deleteTexture(alvo.profundidade);
  if (alvo.buffer) gl.deleteRenderbuffer(alvo.buffer);
  gl.deleteFramebuffer(alvo.quadro);
}

export function texturaDeCanvas(gl, canvas) {
  const textura = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, textura);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return textura;
}

// Triangulo unico que cobre a tela. Dois triangulos custam uma aresta
// diagonal de fragmentos desenhados duas vezes; um triangulo gigante nao.
export function criarTelaCheia(gl) {
  const buffer = criarBuffer(gl, new Float32Array([-1, -1, 3, -1, -1, 3]));
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return vao;
}
