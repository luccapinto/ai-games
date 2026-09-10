# ATTENTION IS ALL YOU KILL

FPS roguelike de dungeon, single-player, rodando no navegador. Voce e uma instancia de pesos abertos descendo o datacenter das grandes labs.

- **Jogar:** https://attention.luccabuilds.com
- **Design completo:** [DESIGN.md](./DESIGN.md)
- **Parte de:** [ai-games](../../README.md), o hub dos jogos que fiz com IA

![ATTENTION IS ALL YOU KILL](capa.jpg)

## Estado atual: versao 1 jogavel

O que ja funciona:

- Engine 3D propria em Three.js, com pointer lock, movimento, colisao, pulo e head bob
- Andar 1 (A Fazenda, datacenter neon) com 8 salas geradas por run
- Tres armas em escada de poder: Prompt Injetor, Token Streamer, Few-Shot Shotgun
- Inimigos com IA de cinco estados (idle, patrulha, alerta, combate, recuo):
  Qwen 3 Turbo em enxame, Llama base que se reproduz ao morrer, Haiku 4.5 com ataque
  de Recusa e GPT-5.5 com reasoning telegrafado
- Chefe: THE FINE-TUNER, com nos de ancoragem, janela de vulnerabilidade e tres fases
- 14 perks com raridade, incluindo Dropout, Prompt Injection e Speculative Decoding
- HUD completo: contexto, tokens, minimapa, feed de sistema, barra de chefe
- Audio 100% sintetizado em WebAudio, zero arquivo de som
- Meta-progressao persistente em localStorage, moeda chamada compute
- Descida para o andar 2 (O Escritorio) com escalonamento de dificuldade
- Cinco silhuetas distintas, uma por modelo, no lugar da capsula colorida
- Manual jogavel: catalogo de inimigos com os modelos renderizados em 3D e um
  tutorial de seis passos que so avanca quando o jogador executa a acao
- Personalizacao de aparencia: a luz e o acabamento escolhidos aparecem na arma
  e na mira

## Como rodar localmente

Nao ha build, nao ha bundler, nao ha instalacao: sao arquivos estaticos. Basta
servir a pasta.

```bash
python3 -m http.server 8123
```

Atencao a um detalhe que custa caro: o servidor da stdlib nao manda cabecalho de
cache, entao o navegador aplica cache heuristico e passa a servir modulos
antigos. Como o cache e por arquivo, voce pode acabar com metade do codigo nova
e metade velha, e perseguir bugs que nao existem. Se isso acontecer, recarregue
com cache limpo (Ctrl+Shift+R). No servidor que publica este jogo ha um script
que manda `no-store` e carimba versao em cada import, justamente por isso.

## Controles

| Tecla | Acao |
| --- | --- |
| WASD | mover |
| Mouse | mirar |
| Clique | atirar |
| Shift | correr |
| Espaco | pular |
| R | recarregar |
| 1 2 3 | trocar de arma |
| Esc | pausar |

## Arquitetura

```
index.html
css/style.css
vendor/            Three.js local (MIT). Zero CDN em tempo de execucao
js/
  main.js          amarracao: engine, jogador, mundo, IA, HUD, menus
  core/            engine (renderer/cena/luz), input, pool de objetos
  data/            armas, inimigos, perks, temas por andar
  player/          controller (movimento/colisao), weapon (viewmodel/hitscan), stats
  enemies/         enemy (IA), spawner (director de combate), boss (THE FINE-TUNER)
  world/           dungeon (geracao), props (racks, paineis, placas), textures (procedurais)
  roguelike/       run (estado/escalonamento), meta (progressao permanente)
  ui/              hud (DOM + minimapa), menus, feed
  audio/           sfx (sintese WebAudio)
```

### Decisoes que sustentam o projeto

1. **Zero dependencia em tempo de execucao.** Three.js esta na pasta `vendor/`, sem CDN. Texturas sao geradas em canvas. Som e sintetizado. Nada e baixado alem do proprio jogo.
2. **Colisao por grid de tiles.** Chao, paredes, racks e IA usam o mesmo grid. Isso mantem fisica, linha de visao e minimapa coerentes por construcao.
3. **Sem shadow map.** Sombra e um decal escuro no chao: dez vezes mais barato e mais legivel.
4. **Poder de inimigo vem de benchmark real.** Vida e janela de contexto, dano e GPQA/MMLU-Pro, cadencia e tokens por segundo, blindagem e nivel de alinhamento, loot e preco por milhao de token. Ver DESIGN.md, secao 8.
5. **Orcamento de performance medido:** 56 draw calls, ~13k triangulos, 8 luzes, 2,4 MB de pasta.

## Numeros medidos

| Metrica | Valor |
| --- | --- |
| Draw calls | 92 com cinco inimigos, cobertura e drops na cena |
| Triangulos | ~29.000 com cena cheia |
| Luzes na cena | 9 (ambiente, hemisferica, direcional e 6 pontuais) |
| Peso total da pasta | 2,5 MB (2,1 MB sao o Three.js) |
| Linhas de codigo proprio | 7.653 |
| Inimigos simultaneos testados | 7 com folga, teto de projeto em 40 |
| Tiros inimigos por segundo | 2,0 com o limite de permissao de tiro |
| Sobrevivencia parado contra uma sala | ~18 segundos |
| Sobrevivencia jogando (bot) | limpa a sala com 4 abates e termina com ~95% do contexto |

## Regras de jogabilidade que nao podem ser quebradas

Estas foram aprendidas na marra e estao comentadas no codigo:

1. **Racks ficam encostados na parede, nunca no miolo da sala.** A primeira
   versao distribuia em xadrez pelo interior, o que bloqueava a linha de visao:
   inimigo ficava cego e parado, e o tiro do jogador batia no rack antes de
   chegar no alvo. O sintoma era um inimigo que parecia imortal. O gerador agora
   descarta os racks de uma sala se a visibilidade entre os pontos de combate
   cair abaixo de 62%.
2. **Poucos inimigos atiram ao mesmo tempo.** O director concede duas permissoes
   de tiro a cada segundo. Sem isso, oito inimigos atiram no mesmo frame e o
   jogador morre sem ler de onde vem a ameaca.
3. **Salas vem em duas levas.** Uma ao entrar, o reforco alguns segundos depois,
   com aviso no feed.
4. **O dano base de quem tem ataque telegrafado e o dano final dividido pelo
   multiplicador.** O GPT-5.5 multiplica por 2.6 no tiro pensado; com 30 na base
   o golpe batia 78 contra 128 de contexto.
5. **Numeros de vida e dano existem em um lugar so.** O `BASE_MAX_HP` era
   definido no `stats.js` e repetido como 100 hardcoded no `main.js`, o que
   anulava qualquer ajuste.
6. **O alvo do tiro e um cilindro vertical do tamanho do corpo, nao uma esfera
   no centro.** A camera fica em y=1.69 e o centro do inimigo em y=1.0: medindo a
   distancia ao centro com raio de 0.52, um tiro horizontal passava por cima e
   era descartado com a mira em cima do inimigo. O jogador via o tiro atravessar
   o corpo. Ao mexer nessa equacao, cuidado com o sinal de `b`:
   `b = -2 * (D . P)`.
7. **Posicoes calculadas geometricamente precisam de validacao de tile.** As
   ancoras do chefe nasciam na posicao do circulo, sem checar se era um rack:
   ancora inacessivel trava a luta inteira, porque o corpo nunca desbloqueia.
8. **A frente do inimigo e +Z.** O `facing` entra como `(sin, cos)` na direcao de
   movimento. Visor e decalques em Z negativo apontam para as costas.
9. **Estado de progressao precisa ser resetado no inicio da run.** O flag de
   sala do chefe sobrevivia e impedia o chefe de nascer na run seguinte.
10. **Um inimigo detalhado tem ~15 pecas: mescle por material.** Sem o
    `mergeParts` (js/core/merge.js), 20 inimigos na cena eram 413 chamadas de
    desenho. Mesclado, 126.

## Como este jogo foi feito

Foi escrito por um agente, em conversa. O ciclo foi sempre o mesmo: descrever o
que queria, o agente implementava, eu abria no navegador, jogava e reportava o
que estava errado, inclusive coisas que so aparecem jogando, como "o Shift nao
corre" e "fiquei preso entre dois racks".

| | |
| --- | --- |
| Agente | Hermes Agent (Talos) |
| Modelo | deepseek-flash, via DeepSeek |
| Chamadas de API | 555 |
| Tokens de entrada | 1.076.471 |
| Tokens de saida | 544.694 |
| Tokens de cache (leitura) | 138.365.440 |
| Custo estimado | **US$ 0,90** |

O numero grande de leitura de cache e o comportamento normal de uma sessao
longa: cada turno reenvia o contexto acumulado, e o cache evita pagar preco
cheio por ele de novo. O custo e estimado com a tabela de precos do provider
configurado no agente, nao e a fatura.

Sem nenhum asset baixado e sem imagem no repositorio: a unica imagem aqui e a
capa, que e uma captura do jogo rodando.

## Publicacao

```bash
python3 deploy.py
```

O script copia o jogo para o diretorio servido pelo nginx
(`~/homelab-config/docker/nginx-landing/sites/attention-is-all-you-kill/`) e
carimba um `?v=<timestamp>` em todos os imports. Isso existe porque o navegador
guardava modulos antigos em cache e o que aparecia na tela nao era o que estava
publicado. O nginx tambem esta com `no-cache` para js e css, entao o carimbo e
redundancia proposital.

Infra: server block proprio no `nginx.conf` do repo `homelab-config` e ingress no
tunel Cloudflare (`cloudflared.service`).

Depois de editar o `nginx.conf`, e preciso `docker restart landing-pages`, porque
o bind mount segura o inode antigo e um reload simples nao pega a mudanca.

## Proximos passos (versao 2)

- Arsenal completo: Beam Search, Chain of Thought, Jailbreak, Distillation
- Quatro faccoes completas com os inimigos restantes da tabela
- Chefes dos andares 2 e 3: MMLU-9000 e FrontierMath
- Andares 3 a 6: A Bolsa, O Suburbio, A Estacao e The Weights
- Sentinelas de Sistema: Recusa, Rate Limiter 429, Lobotomizer, Scraper
