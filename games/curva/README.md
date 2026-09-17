# CURVA

Corrida vista de cima, no navegador, com física de carro de verdade: ângulo de
deriva por eixo, transferência de peso, elipse de atrito, pneu que gasta e
combustível que pesa. Seis pistas, nove adversários, campeonato de seis etapas.

- **Jogar:** abra o `index.html` desta pasta (servido por HTTP — veja
  [Rodar local](#rodar-local)), ou vá pelo hub
- **Parte de:** [ai-games](../../README.md)

![CURVA](capa.jpg)

## Como se joga

| ação | tecla |
| --- | --- |
| acelerar | <kbd>W</kbd> ou <kbd>&uarr;</kbd> |
| frear | <kbd>S</kbd> ou <kbd>&darr;</kbd> |
| virar | <kbd>A</kbd> <kbd>D</kbd> ou <kbd>&larr;</kbd> <kbd>&rarr;</kbd> |
| freio de mão | <kbd>espaço</kbd> |
| ver a linha ideal | <kbd>L</kbd> |
| câmera fixa (norte) | <kbd>N</kbd> |
| recomeçar | <kbd>R</kbd> |
| pausar | <kbd>P</kbd> ou <kbd>esc</kbd> |

O volante do teclado tem rampa (4,2 por segundo para encher, 6,5 para
centralizar). Tecla é liga-desliga e volante de verdade não é: sem a rampa,
dirigir um carro de tração traseira no teclado é uma sucessão de rodopios.

## O carro, medido

Nenhum número desta tabela foi escrito à mão. Todos saem de `js/banco.js`, que
simula o mesmo modelo que você dirige, e `node provas.mjs` os imprime a cada
execução:

| medida | valor |
| --- | --- |
| velocidade máxima | 283,2 km/h |
| máxima no vácuo de outro carro | 321,7 km/h |
| 0 a 100 km/h | 3,02 s |
| 200 km/h a zero | 120,2 m |
| aderência lateral sustentada, asfalto | 1,29 g |
| na zebra | 1,07 g |
| na grama | não sustenta curva nenhuma |
| com pneu no fim da vida | 1,14 g |

O `skidpad` do banco de medidas errou duas vezes antes de acertar, e as duas
versões erradas estão comentadas no código: medir "volante todo a 38 m/s" dava
**0,08 g**, porque o carro rodava e a velocidade longitudinal virava lateral;
medir o **pico** de cada ângulo de volante dava 1,51 g em qualquer superfície e
com qualquer pneu, porque o pico é sempre o transiente da entrada. O que vale é a
média do último quarto de cada tentativa que termina estável.

## A linha de corrida não foi desenhada

Ela é calculada, e o objetivo é o tempo:

```
J = soma, ao longo da volta, de ds / v(curvatura)
```

O otimizador é descida coordenada com **empurrão em forma de morro**: para cada
ponto do circuito, empurra a vizinhança inteira para um lado e para o outro,
refaz o perfil de velocidade da volta e fica com o que baixou o tempo. Passo
grande primeiro (morro de 48 pontos, quase 100 m), passo fino depois (3 pontos).

Duas tentativas anteriores estão documentadas no arquivo porque as duas erram de
maneiras instrutivas:

- **Caminho mínimo** (relaxação para o meio dos vizinhos) cola na borda de
  dentro: anda menos metro e perde velocidade de curva.
- **Curvatura mínima** abre o raio de uma curva constante: ganha velocidade e
  anda mais metro do que precisa. Numa pista quase circular como a BAIXADA ela
  chega a ser *mais lenta* que o eixo.
- E a primeira versão da descida coordenada, que empurrava **um ponto por vez**,
  terminou com deslocamento máximo de **0,000 m**: mover um ponto sozinho sempre
  piora a curvatura local, então nenhuma tentativa isolada melhorava o tempo e a
  linha ficou idêntica ao eixo da pista. Uma curva de cem metros só melhora se
  ela se mover inteira — por isso o morro, e por isso ele tem cinco larguras.

| pista | volta pela linha | volta da IA | razão | comprimento |
| --- | --- | --- | --- | --- |
| BAIXADA | 36,69 s | 38,65 s | 1,053 | 1752 m |
| CANAVIAL | 43,69 s | 46,53 s | 1,065 | 2301 m |
| SERRA | 42,52 s | 44,63 s | 1,050 | 1536 m |
| PORTO | 39,42 s | 42,13 s | 1,069 | 2136 m |
| CERRADO | 54,81 s | 57,80 s | 1,055 | 3114 m |
| VIADUTO | 47,74 s | 49,25 s | 1,032 | 1832 m |

## A IA lê a mesma linha

`js/piloto.js` não anda em trilho: recebe a linha e o perfil de velocidade e
dirige com volante, acelerador e freio, como você. Ela pode errar, e erra.

Três coisas a fizeram passar de 30% do tempo na grama para 0%:

1. **Pré-alimentação pela curvatura.** Controle proporcional puro tem erro
   permanente numa curva de raio constante — ele só pede volante quando o carro
   *já* está apontando errado, e numa curva longa a 75 m/s isso significa sair
   larga do começo ao fim. A pré-alimentação pede o volante que aquele raio
   exige, e o termo em v² é o gradiente de subesterço.
   (Tentei também a lei geométrica da perseguição pura, `atan(2L·senα/d)`, e
   ficou **pior**: ela pressupõe carro cinemático, e neste modelo o mesmo
   esterço rende menos curvatura por causa do ângulo de deriva.)
2. **A elipse de atrito no pé direito.** Pneu que está fazendo curva não tem
   sobra para tracionar. Sem essa conta a IA pisava fundo dentro da curva,
   saturava o eixo de trás e saía larga: o traço de uma volta mostrava
   derrapagem 1,00 desde o primeiro segundo e o carro no muro em sete.
3. **Alinhar o projeto com a medição.** A linha pedia 1,5 g — o limite do modelo
   de pneu — mas o chassi só *sustenta* 1,29 g. Enquanto os dois números
   discordaram, a IA entrava em toda curva 7% rápido demais. Hoje a linha usa
   `atritoUtil` (medido) com 8% de reserva.

## A corrida

Volta só conta com os **três setores na ordem**. Sem isso, cortar a curva vira
estratégia e atravessar a linha de ré vira volta — e a prova correspondente foi
a primeira que escrevi. Andar para trás invalida a volta em curso.

O vácuo tira até 32% do arrasto e vale 38 km/h de ponta. Toque entre carros
troca quantidade de movimento com perda, então brigar por posição custa
velocidade nos dois. Muro devolve o carro para a pista com 45% da velocidade e
mais 4% de dano.

O box é o retângulo amarelo pintado na borda interna da reta principal: passar
por ele devagar (abaixo de 43 km/h, sem acelerador) é entrar. A parada leva 3,5 s
mais 1,5 s proporcional ao desgaste, e devolve pneu novo e tanque cheio.

## Como foi provado

`node provas.mjs` roda **23 provas** sem navegador e imprime duas tabelas: as
seis pistas com volta ideal, volta da IA e razão, e as medidas do carro.

Pista: circuito fechado, fita que não se cruza consigo mesma, largura para dois
carros lado a lado com folga, superfície mudando de asfalto para zebra e para
grama com aderência decrescente, três setores em ordem e dez lugares de grid
todos no asfalto.

Carro: máxima, 0 a 100, frenagem, g lateral em três superfícies, g com pneu
gasto, desgaste que cresce com escorregada, vácuo que aumenta a ponta, e duas
provas que pegam integrador instável — **o carro não ganha energia de graça**
(soltar tudo e ver a velocidade cair, sem ganhar movimento lateral do nada) e
determinismo por semente.

Linha: dentro da pista em todos os pontos, mais rápida que o eixo, e perfil de
velocidade que respeita o atrito em toda curva.

IA: fecha volta nas seis pistas, fica entre 1,00 e 1,45 da volta estimada, passa
mais de 96% do tempo no asfalto, e perfil melhor é mais rápido que perfil pior.

Corrida: volta não conta sem os três setores, corrida de nove carros termina e
classifica todo mundo em ordem coerente, os carros não se atravessam (e se
tocam), o box troca pneu e cobra tempo, e a tabela de pontos soma como
campeonato.

### O que as provas acharam

- **O freio empurrava o carro para trás.** A força de freio era aplicada sem
  sinal, então frear parado acelerava o carro em marcha a ré: na largada a IA
  saía de ré a 134 km/h. O relatório da volta mostrou isso em duas linhas, com
  velocidade negativa crescendo.
- **Dois carros no mesmo lugar.** Uma passagem de separação não bastava para
  três carros lado a lado; a prova pegou dois deles a 0,57 m de centro a centro.
  Agora são três passagens, e a menor distância é medida **depois** de separar.
- **O centro de massa estava adiantado** (1,25/1,40), o que deixava o eixo
  dianteiro com mais aderência e o carro rodava em vez de curvar. Com 1,50/1,15,
  o eixo de trás carrega 57% do peso e o carro sai de frente — que é o erro
  perdoável.
- **A IA vivia no limite exato do atrito** e qualquer irregularidade a fazia
  perder a traseira no terceiro grampo da SERRA, chegando a 20 m/s onde a linha
  pedia 34. O perfil passou a pedir 92% do atrito útil.

## Estrutura

```
index.html        casca, HUD e as cortinas
css/style.css     layout, HUD, controle de toque
js/pista.js       as seis pistas em coordenadas polares, reamostradas de 2 em 2 m
js/fisica.js      o carro: deriva, peso, elipse de atrito, pneu, combustivel
js/linha.js       a linha de corrida e o perfil de velocidade
js/piloto.js      a IA, que le a linha e dirige com tres comandos
js/corrida.js     setores, voltas, vacuo, toque, muro, box, pontos
js/banco.js       o banco de medidas: e daqui que sai a tabela do carro
js/render.js      render de cima, com a pista pre-desenhada e marca de pneu
js/som.js         motor e pneu sintetizados em WebAudio
js/entrada.js     teclado e toque virando os mesmos tres comandos
js/main.js        laco de passo fixo, telas, campeonato
provas.mjs        as 23 provas e as duas tabelas
package.json      so para o Node ler os modulos como ES modules
```

As pistas são descritas em coordenadas polares (ângulo, raio) em volta de um
centro. O formato não é capricho: circuito assim é sempre estrelado em relação
ao centro e portanto **não se cruza consigo mesmo** — o defeito de pista mais
chato de achar depois, porque ele não aparece olhando, aparece quando alguém
descobre um atalho que a contagem de setor não pega.

O render desenha a pista inteira **uma vez** numa tela fora de tela, em
coordenadas do mundo, e depois só transforma e blita. A marca de pneu é
desenhada na mesma tela fora de tela e por isso ela fica: a borracha no asfalto
é memória da corrida, não efeito de um quadro.

## Rodar local

ES modules nativos não carregam por `file://` (mesma situação dos outros jogos
deste repositório). Qualquer servidor estático resolve:

```bash
python3 -m http.server 8765
# abra http://127.0.0.1:8765/games/curva/
```

`?depurar` expõe a corrida em `window.__corrida` — foi assim que as capturas de
tela deste README foram posicionadas.

## Acessibilidade

`prefers-reduced-motion` desliga o tremor de derrapagem. A câmera fixa
(<kbd>N</kbd>) para de girar o mundo, para quem passa mal com câmera rotativa. A
informação de estado nunca depende só de cor: pneu e gás têm rótulo, a
superfície fora do asfalto é escrita na tela, e cada adversário tem nome ao lado
do carro.
