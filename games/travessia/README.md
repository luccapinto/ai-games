# TRAVESSIA

Mundo aberto no sertão, no navegador. O mundo é gerado por semente — relevo,
rios, biomas, cinco vilas, estradas e gente — e a sede é que manda no caminho.
Sete missões em linha principal, seis de lado, e trinta sementes provadas.

- **Jogar:** abra o `index.html` desta pasta (servido por HTTP — veja
  [Rodar local](#rodar-local)), ou vá pelo hub
- **Parte de:** [ai-games](../../README.md)

![TRAVESSIA](capa.jpg)

## Como se joga

| ação | tecla |
| --- | --- |
| andar | <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> ou setas |
| correr | <kbd>shift</kbd> — gasta mais água |
| golpear | <kbd>espaço</kbd> |
| conversar | <kbd>E</kbd> |
| beber | <kbd>Q</kbd>, perto de água |
| diário | <kbd>J</kbd> |
| mapa grande | <kbd>M</kbd> |
| pausar | <kbd>P</kbd> ou <kbd>esc</kbd> |

No celular, o manche do polegar esquerdo anda e os botões da direita agem.

## A sede é a mecânica

O dia inteiro leva oito minutos, e o calor segue uma curva com pico às 13h. O
cantil gasta a soma de três coisas: estar vivo (0,2 por segundo), se mover (0,3
andando, 0,78 correndo) e o calor da hora (até 0,55). Ao meio-dia, andando, o
cantil cheio dura pouco mais de um minuto e meio; de madrugada, quase o dobro.

Daí a decisão que o jogo repete a cada travessia: **ir agora no sol ou esperar a
noite**. Correr chega mais rápido e chega com menos água. Quando o cantil zera, a
vida cai 1,4 por segundo — dá setenta segundos para achar água, o que é susto e
não sentença.

O mundo carrega um campo de distância da água (busca em largura a partir de toda
célula de água e de toda cacimba ao mesmo tempo), e é esse campo que sustenta a
garantia de projeto mais importante do jogo:

> **Todo alvo de missão, todo recurso coletável e todo ponto de estrada tem água
> a menos de meio cantil de distância.**

Isso não é sorte da semente: é provado em trinta mundos por `provas.mjs`.

## O mundo é gerado, e provado

O gerador é ruído de valor somado em oitavas para relevo e umidade; nove rios
descem sempre para o vizinho mais baixo e vestem o vale de mata — e é essa mata
verde-escura que diz ao jogador, de longe, onde tem água. As vilas nascem na
**maior região andável conexa**, a 52 células uma da outra, com roça em volta
(que muda a cor do chão e se vê de longe), cacimba, casas e de três a cinco
pessoas com nome e papel.

O corte entre água, caatinga e serra é um **quantil do próprio relevo daquela
semente**, e não um número fixo. Com corte fixo, a proporção de água ia de 0,5% a
22% entre sementes — a prova de terreno pegou as duas pontas no mesmo dia.

| terreno | semente 1000 | passa |
| --- | --- | --- |
| caatinga | 59,9% | seco, mandacaru, onde tudo acontece |
| serra | 15,9% | não |
| mata | 12,0% | sim, devagar (0,72) |
| água | 6,6% | não — mas se bebe da margem |
| salina | 5,0% | sim, devagar (0,95) |
| roça | 0,5% | sim, é o entorno das vilas |

A estrada é o A\* entre vilas com a estrada custando 0,55 por célula contra 1 da
caatinga, e por isso o caminho prefere estrada quando ela existe — como faz
qualquer um que anda no sertão.

## As missões são um grafo

Treze missões declaradas como **dependência**, não como ordem: sete na linha
principal (cada uma exigindo a anterior) e seis de lado. O que essa forma permite
provar:

- o grafo não tem ciclo (ordem topológica cobre as treze);
- todo dador, todo alvo e toda recompensa **existem naquele mundo**;
- todo alvo é alcançável a pé e tem água por perto;
- o mundo tem recurso bastante para o que as missões pedem.

O alvo não está escrito na declaração da missão: ele é resolvido na geração,
contra o mundo que saiu daquela semente. A ruína fica encostada na serra, o
açude é o maior corpo de água, o pedágio do cangaço fica no meio de uma estrada —
e cada um desses lugares é escolhido entre milhares de candidatos, com as
condições de alcance e de água como filtro.

Duas regras de conclusão, escolhidas de propósito: **coletar e matar se concluem
sozinhas** quando a conta fecha (o recado corre no sertão), e **falar, visitar e
levar se concluem chegando**. Isso corta a caminhada de volta puramente
administrativa e mantém a decisão onde ela interessa — ir ou não ir, com quanta
água.

## Como foi provado

`node provas.mjs` roda **21 provas** em **trinta mundos** e termina com um robô
atravessando o sertão.

Gerador: mesma semente dá o mesmo mundo (e sementes diferentes dão mundos
diferentes), os cinco terrenos aparecem em proporção de sertão, toda vila nasce
em chão andável e longe das outras, dá para ir a pé de qualquer vila a qualquer
outra, toda vila tem cacimba e vendedor, e a estrada é andável do começo ao fim.

Corpo: beber enche o cantil, sede no fim tira vida, o meio-dia custa mais água
que a madrugada, o dia fecha o ciclo, o jogador não atravessa serra nem rio, com
faca dá para ganhar de um cangaceiro e de mão vazia não, e a mesma semente com a
mesma entrada dá a mesma partida.

E a prova que decide: **um robô termina a linha principal em três sementes
diferentes**, usando a mesma caminhada, a mesma sede, o mesmo combate e as mesmas
missões do navegador. Hoje ele atravessa em 5,2, 5,3 e 6,7 minutos, com 100 de
vida, bebendo de 11 a 18 vezes.

### O que as provas acharam

Sete defeitos que jogar uma semente boa não acharia:

- **A vila sem vendedor.** Os papéis rodavam pelo índice da vila, e a segunda
  vila saía sem quem comprasse o que o jogador achava.
- **Dois NPCs na mesma célula.** A conversa escolhia o vizinho mais próximo, e o
  robô ficou vinte segundos a um metro da curandeira conversando com a rezadeira
  que estava meio metro mais perto. Hoje a conversa percorre todos os que estão
  no alcance e para no primeiro que tem assunto.
- **A ruína que matava.** O alvo da quarta missão ficava encostado na serra,
  alcançável e a setenta células da água: em duas de três sementes o robô chegava
  lá e morria de sede com quatro missões feitas.
- **Pedir rota para dentro do rio.** `aguaMaisProxima` devolvia a célula de água,
  que não é andável, então o A\* não devolvia rota nenhuma — e o robô ficava
  parado na beira do nada, com zero goles, até morrer. Agora ela devolve a
  **margem**: de onde se bebe.
- **Cinco punhados de sal a 64 células da água.** Recurso nascia em qualquer
  célula do bioma certo, sem olhar distância de água.
- **A semente com três vilas.** Conferir alcance com A\* por candidato era lento
  e deixava passar; hoje as vilas só nascem na maior região conexa, calculada por
  rotulagem de componentes antes de plantar.
- **A proporção de água indo de 0,5% a 22%.** Corte de bioma fixo não sobrevive a
  trinta sementes.

## Estrutura

```
index.html        casca, HUD, diario e as cortinas
css/style.css     layout, HUD, manche de toque
js/regras.js      os numeros: sede, velocidade, dia, vilas
js/mundo.js       gerador: relevo, rios, biomas, vilas, estradas, distancia da agua
js/missoes.js     o grafo de missoes e a instanciacao contra o mundo
js/jogo.js        corpo, sede, hora, coleta, combate, recompensa — sem DOM
js/robo.js        o robo que atravessa o sertao (a prova principal)
js/render.js      render por tile, com luz do dia e neblina no mapa
js/som.js         vento, cigarra e efeitos em WebAudio
js/entrada.js     teclado e manche de toque
js/main.js        laco de passo fixo, HUD, diario, telas
provas.mjs        as 21 provas, em trinta mundos, e a corrida do robo
package.json      so para o Node ler os modulos como ES modules
```

Zero arquivo de imagem e de áudio: chão, mandacaru, casa, gente, onça, vento e
cigarra saem de código. A única imagem da pasta é a `capa.jpg`, que é uma captura
do jogo rodando.

## Rodar local

ES modules nativos não carregam por `file://` (mesma situação dos outros jogos
deste repositório):

```bash
python3 -m http.server 8765
# abra http://127.0.0.1:8765/games/travessia/
```

`?depurar` expõe a partida em `window.__jogo` — foi assim que a captura deste
README foi posicionada.

## Acessibilidade

`prefers-reduced-motion` desliga o tremor de calor do meio-dia. A informação de
estado nunca depende só de cor: cantil e vida têm rótulo, a hora está escrita, a
bússola da missão diz a direção por letra (N, NL, L, SL...) e a distância em
passos, e a distância até a água aparece em número no canto. O mapa grande
(<kbd>M</kbd>) existe para quem não quer depender do minimapa pequeno.
