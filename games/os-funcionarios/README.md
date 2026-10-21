# OS FUNCIONÁRIOS

**Departamento de Recursos Não Humanos.** Cópias alienígenas estão substituindo
funcionários da Interplan S.A., 7º andar, e elas imitam quase tudo. Quase. Você
anda pelo escritório em primeira pessoa com um grampeador na mão, observa, pede o
crachá e grampeia só os impostores. Um humano abatido é uma falha. Três falhas e você está fora.

- **[Jogar](https://ai-games.luccabuilds.com/games/os-funcionarios/)** ou abra
  `index.html` desta pasta servido por HTTP (ver [Rodar](#rodar))
- **Parte de:** [ai-games](../../README.md)

![OS FUNCIONÁRIOS](capa.jpg)

## Como se joga

Cada dia começa com um **memorando do RH**: quantos impostores há no andar e os
relatos que a segurança recebeu. O memorando é honesto sobre a lista: diz quantos
relatos foram confirmados e quantos são boato ("A segurança recebeu 3 relatos. 2
foram confirmados e 1 é boato"), mas não diz qual é qual. O boato não aparece em ninguém naquele dia.
Quem atira por boato derruba um humano. O mesmo número fica no canto da tela (`Tab`).

| Tecla | Ação |
| --- | --- |
| `W A S D` | andar (`Shift` corre) |
| mouse | olhar |
| botão direito ou `Z` | examinar de perto (zoom) |
| `E` | pedir o crachá e comparar com a ficha do RH |
| clique | disparar o grampeador (segure para rajada) |
| `R` | recarregar (o pente depende do nível do grampeador) |
| `Tab` | abrir o memorando |
| `Esc` | pausa |

Cinco dias, das 9h às 18h (de quatro a cinco minutos e meio de jogo cada). O
andar enche e os sinais ficam mais finos:

| Dia | Pessoas | Impostores | Sinais por impostor | Que tipo de sinal |
| --- | --- | --- | --- | --- |
| 1 | 6 | 1 | 2 | visível de longe ou preste atenção |
| 2 | 7 | 1 | 1 | visível de longe ou preste atenção |
| 3 | 8 | 2 | 1 | preste atenção |
| 4 | 9 | 2 | 1 | preste atenção ou só de perto |
| 5 | 10 | 3 | 1 | qualquer um |

**O grampeador.** Um grampo derruba um humano. No alienígena, o primeiro grampo só
arranca o disfarce: a cabeça vira a roxa e ele corre para cima de você dando soco.
No nível 1 ele aguenta mais três grampos. Cinco socos e você é nocauteado, e o dia
acaba com o impostor fugindo. Então atirar não termina a dúvida: começa a briga.

Alien eliminado vale 100. Humano abatido tira 150 e conta uma falha. Alien que
chega às 18h vivo foge e tira 50. Limpar o andar cedo dá bônus por minuto que
sobrou.

**O almoxarifado.** Depois do relatório de cada dia você desce ao almoxarifado. A
verba é o que você ganhou no dia (se o saldo do dia foi positivo) e acumula na
semana. Com ela o grampeador sobe de nível; as peças trocam na sua mão, com uma
animação curta. No nível 3 você escolhe o ramo, cadência ou impacto, e ele decide o
nível 4: não dá para voltar. Uma semana nova começa no nível 1, sem verba.

| Nível | Nome | Preço | Pente | Grampos/s | Recarga | Grampos para derrubar | Coice |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | Grampeador Improvisado | — | 12 | 3,8 | 1,35 s | 4 | normal |
| L2 | Grampeador Modificado | 150 | 16 | 5,0 | 1,10 s | 3 | normal |
| L3C | Industrial · Cadência | 250 | 30 | 9,1 | 1,25 s | 3 | leve |
| L3I | Industrial · Impacto | 250 | 10 | 2,9 | 0,95 s | 2 | forte |
| L4C | Protótipo Proibido · Cadência | 350 | 48 | 14,3 | 1,00 s | 2 | leve |
| L4I | Protótipo Proibido · Impacto | 350 | 8 | 2,5 | 0,85 s | 1 (revela e derruba) | muito forte |

Os números moram em `ARMA`, em `js/dados.js`. Os preços somam 750. Os dias 1 a 4
têm 6 impostores (600 pontos) e o bônus de quem limpa o andar na metade do
expediente fica perto de 90 por dia: quem joga bem compra o nível 4 antes do dia 5
(a prova 9 joga assim e chega com 195 de sobra). Quem só acerta, sem bônus, chega
ao nível 3.

## Os 14 sinais

Todo sinal que vai e volta aparece várias vezes por expediente, e os sinais "de
longe" e "atenção" se veem a 2,5 m sem zoom. A prova 10 simula 200 expedientes e
confere isso para cada sinal de cada impostor (ver "Por dentro").

| Sinal | Nível | O que você vê |
| --- | --- | --- |
| Gira a cabeça além do limite | longe | vira a cabeça quase toda para trás por 2,8 s, a cada 6 s |
| Anda de ré | longe | anda de costas para onde vai; fica pouco tempo parado |
| Falha na imagem | longe | a cada 4,5 s some, salta para o lado e pisca em ciano e magenta por 0,75 s |
| Olhos brilhando verde | atenção | os olhos acendem verde, com brilho, por 1,6 s a cada 4 s |
| Pé virado para trás | atenção | a canela direita é torcida: o sapato aponta para trás |
| Não tem sombra | atenção | nem a sombra de contato debaixo dos pés, nem a da janela |
| Anda sem balançar os braços | atenção | anda muito, com os braços duros e um pouco abertos |
| Respira vapor gelado | atenção | baforada branca azulada da boca a cada 1,6 s |
| Caneca de cabeça para baixo | atenção | a faixa vermelha da boca da caneca fica embaixo, e o café não cai |
| Encara de volta | atenção | a cada 9 s para tudo e vira para você; também congela quando você o encara |
| Costura no pescoço | perto | cicatriz vermelho-escura com pontos pretos em volta do pescoço |
| Foto do crachá não confere | perto | o cabelo da foto é de outra cor |
| Nome errado no crachá | perto | uma letra trocada; o crachá mostra os dois nomes lado a lado, em maiúsculas |
| Pele molhada | perto | a pele brilha como se estivesse molhada |

## Por dentro

**As pessoas são do pacote, os funcionários são nossos.** Os personagens vêm dos
pacotes Ultimate Modular Men e Women, de [Quaternius](https://quaternius.com).
Cada modelo é dividido em cabeça, tronco, pernas e pés, e todos usam o mesmo
esqueleto. O jogo monta doze funcionários com oito modelos, trocando peças entre
eles: o Jorge, da Manutenção, é a cabeça de bigode do operário (com o capacete
escondido) no corpo de terno do executivo. Depois recolore por nome de material
(`Suit`, `Tie`, `Hair`, `Skin`) e pendura crachá e caneca nos ossos.

**Os sinais são escritos por cima da animação pronta.** O pacote traz andar,
parado, interagir e cair. Os sinais de corpo giram ossos depois que o mixer
anima: a cabeça vai a 170 graus, o pé gira meia volta, os braços voltam à pose
de repouso enquanto as pernas andam. Um bug ensinou a regra: quando a animação
não tem trilha para um osso, o ajuste do quadro anterior fica e o seguinte soma
por cima. A cabeça girava sem parar e o rosto nunca voltava. Agora cada quadro
restaura a pose desses ossos antes de animar.

**Arquivo menor sem Blender.** Cada `.glb` do pacote carrega as mesmas 24
animações. `preparar_modelos.py` (fora desta pasta, no repo de trabalho) reempacota
o binário do glTF à mão: malha e materiais em `modelos/pessoas/`, o esqueleto e as
dez animações usadas uma vez só em `animacoes.glb` (homens) e `animacoes_mulher.glb`
(mulheres). De 9,5 MB para 6,4 MB. São dois arquivos porque os modelos femininos do
pacote têm outra orientação de repouso no tronco, nos braços e nas pernas: a animação
do esqueleto masculino tocada nelas fazia as funcionárias andarem com o braço para trás.

**A arma é nossa.** O grampeador é o kit O GRAMPEADOR, que fizemos em Blender por
código para outro teste: peças modulares, texturas assadas, seis níveis. Um
`grampeador.glb` traz as 31 peças de todos os níveis; o jogo liga as do nível
atual pelo nome do nó, e a lista de peças de cada nível vai dentro do arquivo.
`preparar_arma.py` descarta as tangentes, reduz as texturas para 512 px e quantiza
os vértices (`KHR_mesh_quantization`: posição em int16, normal em int8, UV em
uint16): 5,7 MB do kit inteiro para 1,8 MB (antes, só o nível 1: 590 KB). Ela é
desenhada numa segunda cena por cima do escritório, para nunca atravessar parede
nem mesa, com balanço ao andar, coice (que também levanta a mira), recarga e troca
de nível: a arma desce, as peças trocam e sobem uma a uma. No nível 4 os
fragmentos flutuam e o núcleo pulsa. O grampo é um U de arame que voa da ponta e
fica cravado no osso mais perto de onde acertou, ou solta faísca na parede.

**A caneca é segurada de verdade.** Os braços de quem carrega caneca são
procedurais por cima da animação: IK de dois ossos leva a mão direita à frente do
corpo, os dedos fecham em volta da alça (as falanges que dobram são a 2ª, a 3ª e a
4ª: a 1ª do pacote é o metacarpo) e a caneca é posta na palma a cada quadro. De 8
a 30 s a pessoa toma um gole: a mão sobe até a boca e a cabeça inclina. Na mesa,
as pessoas digitam no teclado (quem tem caneca, só com a esquerda).

**O escritório anda no próprio ritmo.** Cada pessoa anda num passo dela, e a
velocidade vem do comprimento medido da passada de cada esqueleto, então os pés não
deslizam. Na mesa digitam uns 8 s e param para olhar o vizinho; duas pessoas
paradas perto viram uma para a outra e conversam; quem está na impressora, no
armário, no café ou na água mexe nas coisas. A IA de cada dia segue a semente
do dia, então uma simulação se repete igual.

**A prova estatística dos sinais.** Cada pessoa marca, a cada quadro, quais
sinais estão à mostra (`Pessoa.vis`). `__jogo.medirSinais(dia, semente)` simula o
expediente inteiro com o jogador parado na entrada e soma segundos e aparições de
cada sinal de cada impostor. Em 200 expedientes (40 semanas), todo sinal que vai e
volta apareceu pelo menos 6 vezes e 30 s no dia, e todo sinal fixo, o dia inteiro.
Os números de cada rodada ficam em `fotos/prova_estatistica.txt`.

**O alienígena é procedural.** A cabeça roxa, com olho amendoado e brilho, é
geometria do código, e aparece no lugar da cabeça humana no meio da revelação. O
inocente cai com a animação de morte do pacote. O escritório, o crachá (desenhado
num canvas, com a foto e o nome que podem estar errados), as partículas e o som
também são do código: não há textura, fonte ou áudio em arquivo.

## Rodar

```bash
cd games/os-funcionarios
python3 -m http.server 8000      # e abra http://localhost:8000
```

Precisa de HTTP porque o jogo é feito de módulos ES e carrega `.glb`. Abrir o
`index.html` direto do disco não funciona.

As provas abrem o jogo num Chrome sem cabeça e jogam por uma API de teste
(`window.__jogo`):

```bash
node provas.mjs                     # 34 provas
cd ferramentas && node sinais.mjs   # fotos dos sinais a distância de jogo, alien ao lado de um humano
CEGO=1 SEMENTE=303 node sinais.mjs  # prova cega: não diz de que lado está o alien (resposta em verdade.json)
node poses.mjs                      # todas as animações nos dois esqueletos, folha de contato
node armas.mjs                      # os 6 níveis do grampeador na mão, a troca e o almoxarifado
node video.mjs                      # quadros do vídeo de demonstração
```

Em Linux com GPU Intel, o Chrome sem cabeça precisa de WebGL por ANGLE
(`ferramentas/cdp.mjs` já pede `gl-egl`). Se o Chrome não estiver no caminho
padrão, use `CHROME=/caminho/do/chrome node provas.mjs`.

## Como foi feito

O pedido era um jogo de dedução com funcionários de escritório e sinais de
alienígena, desenvolvido de madrugada, sem ninguém validar, para ser jogado de
manhã.

**A maior parte do custo foi chegar ao personagem certo, não o jogo.** A sessão
começou com um kit de funcionários feito do zero em Blender: oito rodadas de
redesenho, 17 sinais, teste cego, vídeo. O dono do repo achou feio ("ainda tá feio
KKKKK") e mandou uma referência no estilo brinquedo 3D. Veio um protótipo em
superfície contínua (metaballs), que melhorou, mas ficou simples. O que resolveu
foi testar um pacote pronto, o Quaternius, e mostrar com uma imagem que dava para
trocar roupa e marcar o alienígena nele. Só então começou o jogo.

**O jogo em si custou cerca de um quinto do total** e saiu em uma noite: dados,
pessoas, escritório, laço do jogo, som, provas, nessa ordem. O que deu trabalho:

- **Nome de osso.** O three.js tira o ponto do nome (`Wrist.R` vira `WristR`). O
  crachá e a caneca não achavam a mão e o jogo travava no carregamento.
- **CSS que não carregava.** O servidor de teste não conhecia `.css`. Quando passou
  a conhecer, todas as telas apareceram juntas ao mesmo tempo: `display: flex`
  vence o atributo `hidden`.
- **Cabeça que não voltava.** É o bug dos ossos descrito acima. A foto do sinal
  mostrava a nuca nos dois quadros, e só medindo a posição do olho a cada quadro
  ficou claro que o giro se acumulava.
- **O alienígena morria direto.** Na primeira versão um clique eliminava
  qualquer um, e o dono do repo reclamou com razão. Agora o primeiro grampo só
  revela, e o alien luta. Veio junto com a arma visível, que também faltava.
- **O jogador começava olhando para a parede.** Foi a prova do teclado de verdade
  que pegou: segurar `W` andava para trás. A direção inicial estava invertida.

Cada etapa visual passou por foto e revisão: as 14 provas de sinal foram refeitas
três vezes até todos aparecerem.

**A segunda rodada: todo impostor achável e o grampeador que cresce.** Jogando, o
dono do repo notou três coisas: o memorando listava boatos sem dizer quantos, vários
sinais duravam um piscar ou só se viam colado na pessoa, e a caneca flutuava na mão
aberta. O que mudou:

- **Memorando honesto.** Agora diz quantos relatos são verdadeiros. As trocas de
  letra do nome errado que sumiam na fonte do crachá (i/l, c/e, u/v) saíram, e o
  crachá aberto compara os dois nomes em maiúsculas.
- **Sinais mais frequentes e mais fortes** (tabela acima): olho com brilho, falha
  com salto e cor, cabeça mais longa, vapor mais denso, encarada sem precisar ser
  encarado, ré andando de costas, sombra de contato que o impostor não tem, canela
  torcida, caneca com faixa vermelha e cicatriz costurada que segue o pescoço.
- **Prova cega com controle.** `sinais.mjs` põe o impostor ao lado de um humano, a
  2,5 m sem zoom (sinais de longe e de atenção) ou a 1,5 m com zoom (de perto), sorteia
  o lado e não diz qual é. Três rodadas: 12/14 (caneca no chute e uma falha da
  ferramenta no "encara"), 14/14 com braços incerto, 14/14 depois de abrir os braços.
- **Varredura das animações** (`poses.mjs`): o soco do esqueleto masculino girava o
  corpo inteiro uns 70 graus; agora o giro da raiz fica em 20.
- **Almoxarifado e seis níveis do grampeador**, descritos acima.

**O que ficou de fora.** O olho do pacote é pintado e não tem pálpebra, então os
sinais de piscar do kit antigo não entraram. Dedo a mais e sombra atrasada também
ficaram de fora. De perto, o rosto do pacote é facetado. No celular não roda: o
controle é teclado e mouse.

## Custo

Medido em 2026-10-17 15:47 no banco de sessões do Hermes (`session_model_usage`),
somando a sessão do projeto e os dois subagentes dela.

| | Chamadas | Entrada | Saída | Cache lido | Cache gravado | US$ (tabela) |
| --- | --- | --- | --- | --- | --- | --- |
| Opus 5.5, caminho inteiro | 421 | 7.711 | 786.495 | 69.067.829 | 4.347.598 | US$ 64,36 |
| DeepSeek Flash, caminho inteiro | 201 | 476.015 | 405.387 | 29.645.312 | 0 | US$ 0,40 |
| **Total do caminho** | | | | | | **US$ 64,76** |
| Opus 5.5, só o jogo | 183 | 3.466 | 421.316 | 32.351.858 | 1.294.008 | US$ 25,27 |
| DeepSeek Flash, só o jogo | 2 | 29.093 | 31.340 | 27.904 | 0 | US$ 0,02 |
| **Total só do jogo** | | | | | | **US$ 25,29** |

- **"Caminho inteiro"** inclui o kit em Blender que foi descartado, o protótipo de
  estilo e o teste do pacote. **"Só o jogo"** é a diferença do contador entre o
  retrato tirado às 00:25 de 17/10, quando o jogo começou, e a medição acima.
- **O dólar é estimado.** O Opus rodou em plano de assinatura: o valor é a tabela de
  preço do modelo aplicada aos tokens, não uma fatura.
- **O cache lido é o maior número e não é o custo.** Cada chamada reenvia o contexto
  acumulado, e o cache evita pagá-lo a preço cheio.
- **Máquina:** tudo rodou num servidor doméstico (i7-7500U, 16 GB, GPU Intel HD 620),
  sem GPU na nuvem. Blender, Chrome sem cabeça e as provas rodaram ali, com prioridade
  baixa. Não houve outro gasto além dos tokens.
- **Tamanho publicado:** 9,3 MB (era 8,0 MB antes do grampeador em seis níveis), dos
  quais 8,2 MB são os modelos (1,8 MB o grampeador) e 0,8 MB o three.js.
