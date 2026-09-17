# SUBSOLO

FPS de raycasting no navegador. A mina de manganês foi reaberta como depósito,
as bombas do fundo pararam e você é a manutenção. Nove níveis para baixo.

- **Jogar:** abra o `index.html` desta pasta (servido por HTTP — veja
  [Rodar local](#rodar-local)), ou vá pelo hub
- **Parte de:** [ai-games](../../README.md)

![SUBSOLO](capa.jpg)

## Como se joga

| ação | tecla |
| --- | --- |
| andar | <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> |
| olhar | mouse, ou <kbd>&larr;</kbd> <kbd>&rarr;</kbd> |
| atirar | clique |
| correr | <kbd>shift</kbd> — barulhento |
| agachar | <kbd>ctrl</kbd> ou <kbd>C</kbd> — silencioso |
| lanterna | <kbd>F</kbd> |
| usar, abrir, procurar segredo | <kbd>E</kbd> ou <kbd>espaço</kbd> |
| trocar de arma | <kbd>1</kbd>–<kbd>4</kbd>, roda do mouse ou <kbd>Q</kbd> |
| recomeçar o nível | <kbd>R</kbd> |
| pausar | <kbd>P</kbd> ou <kbd>esc</kbd> |

No celular, o polegar esquerdo anda e o direito olha; toque curto na metade
direita atira, e os botões de luz, arma e agachar ficam no canto.

## A lanterna é a decisão

Ver custa duas coisas ao mesmo tempo: pilha, que acaba, e anonimato, que não
volta. Com a lanterna acesa você vê a 9,5 células e o bicho que tem olho vê você
a **1,7 vez** o alcance normal de visão dele. Apagada, você vê a 4,2 e ele te vê
a metade da distância.

A pilha entra cheia em cada nível (100 unidades, 2,6 por segundo: 38 segundos de
luz) e há pilhas espalhadas. A prova cobra as duas pontas dessa conta: a pilha
disponível tem de cobrir **pelo menos 80%** do tempo do caminho mínimo até o
elevador, e **no máximo 75%** do tempo de varrer a fase célula por célula. A
primeira desigualdade impede um nível cego; a segunda impede que a decisão
desapareça.

## Ruído é mecânica, não enfeite

O som anda pela mesma topologia que o corpo, menos as paredes: `alcanceRuido` é
um Dijkstra na grade em que porta fechada cobra pedágio de 4 células. Cada
evento de ruído tem uma força, e cada bicho tem uma audição que é um **raio em
células de caminhada** — não de linha reta. Um grito dobra a curva do corredor;
a lanterna não.

| evento | força |
| --- | --- |
| andar agachado | 0 |
| andar | 6 |
| correr | 13 |
| pisar em poça | +5 |
| picareta | 0 |
| pineira | 9 |
| espingarda | 20 |
| bicho morrendo | 7 |

Daí a regra que dá forma ao jogo: **matar de picareta é silencioso, mas o grito
do bicho não é.** E a poça de água da fase BOMBAS transforma cada passo num
anúncio — é por isso que a cisterna é o berçário dos cegos.

## Os cinco bichos

| bicho | vida | vê | ouve | o que ele é |
| --- | --- | --- | --- | --- |
| LARVA | 46 | 6 | 8 | lenta, surda, em grupo |
| RASTEJO | 30 | 4 | 16 | frágil e rápida; ouve você antes de ver |
| CEGO | 75 | — | 19 | não vê nada. Do escuro não se esconde dele |
| CUSPIDOR | 62 | 11 | 6 | só cospe no que está **vendo**, e avisa meio segundo antes |
| CAPATAZ | 200 | 9 | 14 | blindado a 35% enquanto anda; abre a guarda ao armar o golpe |

O capataz é a única luta com resposta escrita: ele blinda o corpo enquanto
caminha, e fica **vulnerável durante os 0,9 s em que arma a investida** — os
mesmos 0,9 s em que ele está mirado e parado. Quem só atira quando ele brilha
gasta um terço da munição; quem fica colado nele leva o golpe comum de graça.

## As nove fases

Plantas em ASCII, um caractere por célula, escritas à mão em
[`js/fases.js`](js/fases.js) — geometria, luz, item e bicho no mesmo lugar, nada
sorteado em tempo de jogo.

| # | fase | tamanho | bichos | o que ela ensina |
| --- | --- | --- | --- | --- |
| 01 | BOCA DA MINA | 40×20 | 9 | lanterna, picareta, porta |
| 02 | GALERIA | 40×24 | 12 | crachá e porta travada; a espingarda |
| 03 | BOMBAS | 44×24 | 14 | poça faz ruído; o cego |
| 04 | CORREIA | 48×22 | 17 | cuspidor em corredor reto; o maçarico |
| 05 | SILO | 44×28 | 16 | o elevador está dentro do silo |
| 06 | VENTILAÇÃO | 40×28 | 22 | labirinto apertado, pouca luz |
| 07 | POÇO | 48×28 | 15 | caverna aberta, pilar como cobertura |
| 08 | SUBESTAÇÃO | 48×26 | 18 | três crachás, três portas |
| 09 | FUNDO | 44×26 | 14 | o capataz, e o elevador que ele tranca |

## Como foi provado

`node provas.mjs` roda **25 provas** e imprime duas tabelas: o balanceamento de
cada fase e a corrida do robô. Nada disso precisa de navegador — `fases.js`,
`mapa.js`, `armas.js`, `inimigos.js`, `jogo.js` e `robo.js` não tocam em DOM, e é
isso que torna as provas possíveis.

As provas estruturais: legenda completa, planta retangular, borda vedada, nenhum
item ou bicho dentro de parede, **completabilidade por fechamento de crachás**
(ande até onde dá, pegue o crachá que alcançou, destranque, repita), todo item
alcançável, todo segredo alcançável **e escondendo algo**, faixa de dano
disponível por vida de inimigo, as duas pontas da conta de pilha, A\* contínuo e
do mesmo tamanho da busca em largura, ruído monótono e simétrico, porta fechada
abafando, colisão que não atravessa parede, tiro que a parede bloqueia, o cego
que não acorda com luz, e determinismo por semente.

E a que decide: **um robô joga as nove fases** usando `criarJogo`/`passo`, a
mesma física, as mesmas armas e a mesma IA do navegador. Ele pede caminho para
`mapa.caminho`, escolhe objetivo pelo mesmo fechamento de crachás da prova, e a
prova exige que ele **saia vivo das nove**. Hoje ele termina com 96 de 130 de
vida, entre 14 e 58 segundos por fase.

### O que o robô achou que eu não tinha achado

- **A espingarda estava atrás de uma parede falsa.** O robô empatou 400 segundos
  com o capataz: tinha 32 cartuchos, nenhuma arma que os usasse, e por isso se
  considerava "com munição". Um jogador que não achasse o segredo da GALERIA
  carregaria cartucho o jogo inteiro sem ter espingarda. A arma foi para o
  caminho principal e a munição ficou no segredo.
- **O capataz feria a cada quadro.** A investida durava 0,55 s e o contato
  aplicava dano por quadro: 33 golpes, 726 de dano, morte sem aviso. O relatório
  do robô separa dano por tipo de inimigo, e "capataz: 110" numa fase de 21
  segundos foi o que denunciou.
- **O aviso do capataz não servia para nada**, porque ele refazia a mira no fim
  do aviso e seguia o desvio. A direção passou a travar no início do aviso — é o
  que transforma o golpe numa pergunta em vez de um imposto.
- **O cuspidor cuspia mais longe do que via.** Ele detectava a 5 células no
  escuro e acertava a 10, o que furava a mecânica da lanterna inteira: ficar no
  escuro deixava de proteger. Agora o alcance do cuspe é `min(alcance, o que ele
  está vendo agora)`.
- **Bicho em alerta parado no seu colo não atacava.** Um rastejo perdia você de
  vista no escuro, caminhava até onde você estava, chegava — e ficava ali. A
  prova do rastejo (chega **e** machuca) pegou.
- **Três segredos não escondiam nada.** O do POÇO ficava atrás de parede *e*
  segredo, inalcançável; o do SILO abria um silo que já tinha porta; o da
  SUBESTAÇÃO tinha um armário que encostava na sala de baixo. A prova de segredo
  exige alcançável **e** com prêmio: item que só existe do outro lado.
- **O robô travava em cima de um cartucho.** Item que o jogo recusa entregar
  (kit com a vida cheia, cartucho com a bolsa cheia) fica no chão — isso está
  certo. Errado era o robô escolher esse item como destino: chegava, não pegava,
  o destino não mudava, e a fase estourava o tempo.

### O que a captura de tela achou

Duas coisas que nenhuma prova pegaria, porque são sobre o que se vê:

- **Com a pilha vazia a tela virava um retângulo preto.** A visão sem lanterna
  era de 2,6 células; virou 4,2. Jogo cego não é jogo tenso.
- **O vermelho de dano pintava a cena inteira.** O gradiente começava no meio da
  tela com 0,6 de opacidade: a primeira captura do POÇO saiu irreconhecível.
  Virou um anel estreito na borda, com um terço da opacidade.

## O render

`js/render.js` escreve os 320×200 pixels à mão num `ImageData`: parede por
coluna (DDA), piso e teto por linha com distância perspectiva, sprite por coluna
com teste de profundidade contra o *z-buffer* das paredes, partícula projetada
como os sprites. Não há `drawImage` de coluna nem filtro de CSS.

A razão de ser tudo à mão é a luz: **cada pixel passa pela mesma conta** —
cone da lanterna, lâmpada estática da célula (assada na carga da fase), clarão do
tiro, neblina da paleta. E `inimigos.js` consulta `mapa.luzDaCelula`, o mesmo
valor que tinge o pixel: o bicho não pode ver você num escuro que a tela mostra
iluminado.

Textura, bicho, item e arma são desenhados em canvas fora de tela na carga
(`js/texturas.js`) e lidos como pixel cru. Cada fase tem uma paleta, e a mesma
textura de rocha sai marrom na BOCA DA MINA e azul-chumbo no POÇO — nove fases
que não parecem a mesma fase escura.

## Estrutura

```
index.html        casca, HUD e as cortinas de menu/pausa/fim
css/style.css     layout, HUD, controle de toque
js/regras.js      todo numero que o jogo usa para decidir algo
js/fases.js       as nove plantas ASCII, com paleta e dica
js/mapa.js        grade, colisao, A*, ruido e as provas de fechamento da fase
js/armas.js       as quatro armas e a balistica (tracar)
js/inimigos.js    os cinco bichos e a maquina de estados
js/jogo.js        o jogo inteiro, sem uma linha de DOM
js/robo.js        o robo que joga as nove fases — a prova principal
js/render.js      o raycaster, pixel por pixel
js/texturas.js    textura, sprite e item desenhados em canvas
js/som.js         WebAudio sintetizado, sem arquivo de audio
js/entrada.js     teclado, mouse e toque no mesmo objeto de entrada
js/main.js        laco de passo fixo, telas, minimapa
provas.mjs        as 25 provas + a corrida do robo
package.json      so para o Node ler os modulos como ES modules
```

Passo lógico fixo em 60 Hz; o desenho acompanha o monitor. Sem isso, uma fase
calibrada num monitor de 60 Hz vira outra fase num de 144.

## Rodar local

O jogo usa ES modules nativos, e o navegador recusa `import` por `file://`
(mesma situação dos outros jogos deste repositório). Qualquer servidor estático
resolve:

```bash
python3 -m http.server 8765
# abra http://127.0.0.1:8765/games/subsolo/
```

No hub publicado, que é servido por HTTPS, basta clicar em JOGAR.

`?depurar` na URL expõe a partida em `window.__jogo` — foi assim que as capturas
de tela deste README foram posicionadas. Sem o parâmetro, o jogo não cria nada
global.

## Acessibilidade

`prefers-reduced-motion` desliga cabeceio, tremor de dano e balanço da arma: o
jogo continua inteiro, só para de se mexer sozinho. Os controles de toque só
aparecem em ponteiro grosso. Nada pisca em frequência alta, e a informação de
estado nunca depende só de cor: o crachá tem letra, a arma tem nome, o inimigo
tem silhueta própria.
