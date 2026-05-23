# Roteiro de Apresentação — Guardião da Floresta

Roteiro de ~5 minutos para apresentar em sala. Adapte ao seu jeito de falar.

---

## 1. Abertura (30s)
"Meu jogo se chama **Guardião da Floresta**. É um sobrevivente de hordas — você controla um guardião arcano cercado por ondas de criaturas e precisa resistir. Construí ele do zero, em HTML5 com Canvas 2D e JavaScript puro: sem engine, sem bibliotecas, sem imagens externas. Tudo o que aparece na tela é desenhado por código, e o som é gerado em tempo real."

*(Abra o jogo, mostre o menu.)*

## 2. O gênero e a diferença (45s)
"O gênero foi popularizado pelo Vampire Survivors, onde o ataque é automático e você só se movimenta. Mas eu não quis fazer uma cópia. A minha contribuição é uma **mecânica de reações elementais** que adiciona decisão tática: eu escolho ativamente qual elemento usar — Fogo, Gelo ou Raio — e a ordem em que aplico importa."

## 3. Demonstração da mecânica (90s) — o ponto alto
*(Comece a jogar.)*
"Cada magia deixa um status no inimigo. Quando dois status se combinam, dispara uma reação:"
- "Aplico **Gelo** e depois **Raio** → **Cristal Estilhaçado**, uma explosão em área." *(demonstre)*
- "**Fogo** e depois **Raio** → **Sobrecarga**, uma corrente que salta entre inimigos." *(demonstre)*
- "**Fogo** e **Gelo** → **Vapor**, que lentifica a horda." *(demonstre)*

"Então, contra um grupo grande, congelo todo mundo e solto um raio para estilhaçar. Isso é estratégia, não só segurar um botão."

## 4. Mostrar progressão (45s)
*(Suba de nível.)*
"Matando inimigos eu coleto essência e subo de nível. A cada nível, escolho uma de três bênçãos sorteadas — mais dano, mais projéteis, perfuração, vida... isso cria builds diferentes a cada partida."

## 5. Decisões técnicas (45s)
"Esta é a versão 2.5D, feita em Three.js: o mundo é 3D de verdade, com câmera diagonal fixa e formas geométricas com brilho. O ponto técnico de que mais me orgulho é a separação entre lógica e renderização — a lógica do jogo opera em coordenadas no chão, totalmente separada do Three.js, o que me permitiu até testar a lógica de forma automatizada. Organizei o código numa máquina de estados — menu, jogando, level-up, pausa, vitória, game over. O loop usa delta time fixo pra rodar suave em qualquer máquina. Cada inimigo guarda seus status num objeto e, quando recebe um novo elemento, eu checo as combinações possíveis para disparar a reação. As partículas, a câmera que segue o jogador e a detecção de colisão são todas implementação própria."

## 6. Fechamento (20s)
"São três fases com dificuldade crescente, terminando num chefe. O jogo é completo, roda em qualquer navegador só abrindo o arquivo, e a mecânica de elementos é o que o torna uma construção própria. Obrigado!"

---

## Perguntas prováveis do professor (e respostas curtas)

**P: Por que Canvas e não uma engine como Unity?**
R: Three.js é só a biblioteca de renderização 3D — não é uma engine de jogo. Todo o loop, colisão, spawn, reações e progressão são meus. Quis o impacto visual do 3D mantendo controle total sobre a lógica.

**P: Como funciona a detecção de colisão?**
R: Comparo a distância ao quadrado entre os centros dos círculos com a soma dos raios — evito a raiz quadrada por performance. É checado a cada frame entre projéteis e inimigos, e entre inimigos e o jogador.

**P: Como a reação elemental é implementada no código?**
R: Cada inimigo tem um objeto `status` com os elementos ativos e seus tempos. Quando um projétil acerta, chamo `applyElement`. Se já existe outro status, monto a combinação ordenada (ex: "bolt+ice") e disparo a reação correspondente, consumindo os status usados.

**P: Como você garante que roda suave?**
R: O loop limita o delta time a 50ms. Se a aba perde o foco e volta, o jogo não "pula" — ele pausa sozinho ao perder o foco da janela.

**P: O que você faria com mais tempo?**
R: Mais elementos e reações, inimigos com ataques à distância, e um sistema de save para guardar o progresso entre sessões.
