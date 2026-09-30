# BANCA

_A banca sempre ganha. Aqui ela te mostra quanto._

Um cassino de fichas de mentira num salão de Havana em 1957: roleta europeia,
blackjack, o caça-níquel Malecón 57, vídeo pôquer 9/6, bacará e craps. Cada
aposta mostra a vantagem da casa, calculada por código e provada em
`provas.mjs`. Cada sorteio pode ser refeito pelo jogador. E o Livro da Casa
compara, rodada a rodada, o que você perdeu com o que a matemática previa.

Nada aqui aceita ou paga dinheiro.

## Como jogar

Sirva a pasta e abra no navegador (desktop ou celular):

```bash
python3 -m http.server 8000
# http://localhost:8000/
```

Abrir o `index.html` direto pelo disco não funciona: os módulos ES, o Web Worker
do vídeo pôquer e o service worker exigem `http://`. Depois da primeira visita o
jogo roda sem rede.

- **Salão:** arraste ou role para andar, pince (ou Ctrl e a roda do mouse) para
  aproximar, toque numa mesa para sentar. A fileira de botões embaixo leva direto
  a cada mesa; o Caixa abre o Livro da Casa.
- **Mesas:** escolha a ficha no rack, toque no pano para apostar (toque longo ou
  passe o mouse para ver a conta daquela aposta), e use o botão dourado para
  jogar. Atalhos: Enter ou espaço joga; no blackjack 1 a 5 são pedir, parar,
  dobrar, dividir e desistir; no vídeo pôquer 1 a 5 seguram as cartas.
- **A conta:** a coluna da direita (no celular, a aba na borda) mostra a
  vantagem de cada aposta, a perda esperada do que está no pano e o desvio-padrão
  da rodada.
- **Barra do topo:** saldo, Livro da Casa, Conferir os sorteios, som e o menu
  (treinador, destaque das apostas boas no craps, zerar tudo).
- Começa com 1.000 fichas. Quebrou, a casa oferece crédito de 500 fichas com
  0,10% de juro composto por rodada jogada.

## As mesas e a conta

Todos os números saem do código do jogo; a coluna da direita é a referência
publicada para as mesmas regras.

| Mesa | Regras | Vantagem da casa (BANCA) | Referência |
| --- | --- | --- | --- |
| Roleta | Europeia, um zero, 157 apostas incluindo as anunciadas | 2,70% em todas (1/37, exato) | 2,70% |
| Blackjack | 6 baralhos, banca para em todo 17, 3 para 2, dobra depois de dividir, divide até 4 mãos, ás dividido recebe uma carta, desistência tardia, peek, corte em 234 de 312 | 0,3522% ± 0,0047% jogando a básica (600 milhões de mãos); a prova refaz 20 milhões: 0,3454% ± 0,0255% | 0,40% sem desistência (Wizard of Odds, apêndice 9), menos 0,07% da desistência contra 10: cerca de 0,33%. A diferença de 0,02% é o efeito da carta de corte e da básica por total |
| Seguro | Paga 2 para 1 | 7,40% | cerca de 7,4% em 6 baralhos |
| Vídeo pôquer | Jacks or Better 9/6, um baralho por mão | retorno 99,5439% com cinco moedas e jogo perfeito (98,3735% com 1 a 4), enumeração das 2.598.960 mãos e das 32 retenções de cada | 99,54% |
| Bacará | 8 baralhos, comissão de 5% na Banca, empate 8 para 1, pares 11 para 1 | Banca 1,0579%, Jogador 1,2351%, Empate 14,3596%, pares 10,36%, enumeração exata do sapato | 1,06% / 1,24% / 14,36% / 10,36% |
| Craps | Pano completo com vem e não vem, odds, colocações, campo (2 paga 2, 12 paga 3), centro | passe 1,414%, não passe 1,364%, odds 0%, colocação 6 e 8 1,515%, 5 e 9 4,00%, 4 e 10 6,67%, campo 2,778%, qualquer 7 16,667% | os mesmos, por aposta resolvida |
| Malecón 57 | 5 rolos, 3 linhas visíveis, 25 linhas fixas, curinga A Casa, Lua de Havana dá 8, 12 ou 20 giros grátis com prêmio triplicado | retorno exato 96,0035% (linhas 89,098%, luas 0,643%, giros grátis 6,262%); vantagem 4,00% | máquina própria: conferida por força bruta de 171.861.750 paradas por linha e por 10 milhões de giros (95,9002%, a 0,89 desvio-padrão do exato) |

Das 412 apostas que o robô confere, 98 têm vantagem exatamente zero (todas são
odds do craps) e nenhuma favorece o jogador.

## Aleatoriedade verificável

`js/nucleo/sha256.js` implementa SHA-256 e HMAC-SHA256 em JavaScript puro
(conferidos contra os vetores do NIST e contra o `crypto` do Node).

Antes de cada rodada a casa publica `SHA-256(semente da casa)`. O resultado sai
de `HMAC-SHA256(semente da casa, "sua semente:contador:bloco")`, em blocos de 32
bytes lidos como inteiros sem viés (rejeição). A sua semente pode ser trocada
no painel Conferir, e vale a partir da próxima rodada: a casa não sabe a sua
quando se compromete, você não sabe a dela quando escolhe a sua.

Roleta, dados, rolos e vídeo pôquer revelam a semente a cada rodada. Blackjack
e bacará se comprometem com o sapato inteiro e revelam quando ele é trocado. O
painel Conferir refaz cada sorteio revelado com as três entradas e diz se bate:
o número da roleta, os dois dados, as cinco paradas, as cartas da mão e o
sapato carta a carta.

A animação obedece ao sorteio, nunca o contrário. A física da roleta simula a
bola de verdade (defletores, quiques, trastes) e depois gira a fase do rotor em
casas inteiras até o bolso onde ela assentou ser o sorteado. Os dados rolam como
corpos rígidos e, no fim, as faces são renumeradas por uma simetria do cubo para
que a de cima seja a sorteada; a trajetória não muda.

## O Livro da Casa, o crédito e o treinador

Cada rodada registra o apostado, o retorno e a perda esperada (valor apostado
vezes a vantagem daquela aposta). O Livro soma tudo: o gráfico mostra o saldo de
jogo contra a linha do que a matemática previa, com faixas de um e dois
desvios-padrão, e a sua sorte medida em desvios. Por mesa, mostra também quanto
custaram os seus desvios da estratégia.

O treinador (menu, ligado por padrão) mostra a jogada da estratégia básica no
blackjack e a retenção ótima no vídeo pôquer, e depois de cada jogada diz quanto
valor esperado aquele desvio custou, em fichas.

O crédito da casa aparece quando o saldo não cobre a aposta mínima. O juro não é
aposta e não entra na vantagem de nenhuma mesa; aparece separado no Livro.

## Offline

`sw.js` guarda os 68 arquivos do jogo na primeira visita. Com rede, cada pedido
vai ao servidor primeiro (com revalidação, para nunca rodar um módulo velho) e
atualiza o cache; sem rede, tudo sai do cache. `provas/offline.mjs` confere que
a lista do cache é exatamente a dos arquivos do jogo, que cada import, worker,
fonte e link aponta para um arquivo guardado, e que nenhum arquivo busca nada
fora da pasta.

Prova feita no Chromium: com o servidor desligado e o modo offline ligado, a
página recarregou e jogou uma rodada em cada uma das seis mesas, com o Web
Worker do vídeo pôquer carregado do cache, sem nenhum erro na página.

## Provas

```bash
node provas.mjs            # tudo, cerca de 40 s
node provas.mjs roleta     # só um bloco
```

210 provas em 11 arquivos de `provas/`. As que valem a pena ler:

- vantagem de cada aposta por enumeração exata (roleta, bacará, craps, vídeo
  pôquer, caça-níquel) e por simulação com erro-padrão (blackjack);
- pagamento de cada resultado conferido contra a tabela, em centavo inteiro;
- 296 giros de roleta e 144 lances de dados simulados, todos parando no sorteado;
- sapatos e sementes: o que foi revelado bate com o que foi publicado, e
  adulterar a semente, o contador ou o resultado é recusado;
- o robô: 200 rodadas em cada mesa pelas mesmas funções que a interface chama,
  sem saldo negativo e sem mesa travada; o Livro fecha em centavo com o saldo; um
  robô quebrado pega crédito e segue; tudo o que foi revelado confere;
- textos: nenhum emoji, nenhum caractere de naipe, nenhuma palavra sem acento em
  texto de interface.

## Desempenho

Medido no Chromium sem GPU deste servidor (i7-7500U), tempo de JavaScript por
quadro, mediana e p95:

| Cena | Desktop 1440x900 | Celular 390x844 |
| --- | --- | --- |
| Salão, arrastando | 0,5 / 0,8 ms | 0,5 / 0,7 ms |
| Roleta girando (física amostrada e desenho da roda e da bola) | 0,2 / 0,4 ms | 0,2 / 0,4 ms |
| Caça-níquel girando | 0,2 / 0,4 ms | 0,2 / 0,5 ms |
| Craps, dados no ar | 0,2 / 0,4 ms | 0,2 / 0,4 ms |

Blackjack, bacará e vídeo pôquer são DOM e transformações CSS: o intervalo entre
quadros ficou em 16,7 ms de mediana durante as rodadas. Custos pontuais: resolver
a física de um giro de roleta leva 0,07 ms (p95 1,1 ms), a de um lance de dados
3,4 ms (p95 9,4 ms), a análise exata de uma mão de vídeo pôquer de 0,017 a
0,055 ms conforme a execução, e montar as tabelas do vídeo pôquer de 0,4 a 0,6 s,
uma vez, dentro do Web Worker.

## Decisões

Ninguém respondeu perguntas durante o trabalho; estas foram as escolhas, e o
porquê.

- **Dinheiro em centavos inteiros** (1 ficha = 100). Onde o pagamento tem
  fração (3 para 2, comissão de 5%, meio seguro), as apostas são em fichas
  inteiras, então o centavo sempre fecha. Nada de ponto flutuante no saldo.
- **Compromisso por sapato** no blackjack e no bacará, porque é assim que a mesa
  física funciona: revelar a semente a cada mão entregaria o resto do sapato.
- **Giros grátis entram com apostado zero** no Livro: a perda esperada deles já
  está no giro pago que os disparou (o retorno de 96,0035% inclui os 6,262% do
  bônus).
- **O custo do desvio no blackjack é medido contra a estratégia básica** da
  mesa, não contra o valor esperado de baralho infinito, para o treinador e o
  quadro nunca se contradizerem. Duas mãos (A,4 contra 4 e A,2 contra 5) têm
  decisão marginal diferente entre as duas contas; a básica publicada vence.
- **Análise do vídeo pôquer num Web Worker**, e a tela só libera a troca quando
  ela chegou, para o custo do erro sair do mesmo número que o treinador mostrou.
- **Craps com "mostrar a conta"**: as apostas abaixo de 2% acendem, as de 2% a
  5% ficam normais, as acima de 5% apagam. Desligado por padrão, porque a
  vantagem já está impressa em cada caixa do pano; liga na própria mesa ou no menu.
- **Tema do caça-níquel:** Malecón 57, Havana em 1957. A Casa é o curinga; a Lua
  de Havana é o scatter.
- **Juro do crédito em 0,10% por rodada, composto.** Começou em 0,25%; o robô
  quebrado mostrou a dívida explodindo em poucas centenas de rodadas, o que
  virava punição e não lição. Com 0,10%, 500 fichas viram cerca de 824 em 500
  rodadas.
- **Service worker de rede primeiro**, não de cache primeiro: quem está online
  sempre joga a versão publicada; o cache é reserva.
- **Dar cartas no bacará com o pano vazio repete as apostas do coup anterior**,
  como no blackjack, onde a aposta montada fica para a mão seguinte.
- **Fontes:** Limelight (letreiros) e Jost (interface, algarismos tabulares),
  escolhidas numa folha de contato, as duas OFL e vendorizadas em `fontes/`.
- **Texas Hold'em ficou de fora.** Era o sétimo jogo, opcional; o tempo foi para
  o polimento das seis mesas e para as provas.

## Como foi feito

- **Modelo principal:** claude-opus-5-5, no Oh My Pi, com o conselheiro do
  próprio Oh My Pi (o mesmo modelo) revisando ao lado.
- **Subagentes:** claude-opus-5. Um escreveu a matemática do blackjack
  (simulador de 600 milhões de mãos) e do vídeo pôquer (resolvedor exato das 32
  retenções). Outro escreveu as regras puras do bacará e do craps e começou a
  matemática do caça-níquel; ele bateu no limite de 45 minutos e o agente
  principal terminou e provou as tiras.
- **Custo:** veja `meta.json`.

O que deu trabalho: fazer a física obedecer ao sorteio sem parecer trapaça (a
roleta ajusta o rotor, não a bola; os dados trocam a numeração das faces, não a
trajetória). O que só apareceu jogando de verdade, com o robô e com o navegador:
o vídeo pôquer escutava cliques no contêiner compartilhado das mesas e jogava
uma mão quando alguém clicava em "Dar cartas" no bacará; o bacará redesenhava as
fichas perdidas depois do coup; o service worker, sem revalidar, entregava um
módulo velho do cache HTTP estando online. Os três foram corrigidos e
conferidos no navegador.

## O que falta

- Texas Hold'em (opcional no escopo) não foi feito.
- O ícone do app é só SVG: instala no Chrome e no Android, mas o iOS ignora SVG
  em `apple-touch-icon` e usa uma captura da página.
- O desempenho foi medido sem GPU; em aparelho real o custo de rasterizar o
  canvas não aparece nesses números.

## Créditos

Limelight (Sorkin Type Co) e Jost (The Jost Project Authors) sob a SIL Open Font
License 1.1; as licenças estão em `fontes/`. Todo o resto, inclusive cartas,
fichas, símbolos, salão e som, é desenhado ou sintetizado por código.
