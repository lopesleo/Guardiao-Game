# Guardião da Floresta — 2.5D (Three.js)

Versão **2.5D** do jogo de sobrevivência contra hordas: um mundo 3D real com câmera em perspectiva diagonal fixa, formas geométricas com brilho (glow). Construído com **Three.js**, sem modelos 3D externos — toda a geometria é criada por código. Mantém a mecânica-assinatura de **reações elementais**.

---

## ▶️ COMO RODAR — leia com atenção

Esta versão usa Three.js carregado por **módulos ES**. Por segurança, navegadores **bloqueiam módulos quando o arquivo é aberto direto do disco** (`file://`). Há duas formas de rodar:

### Opção A — Servidor local (recomendado, funciona offline)
Abra um terminal na pasta do jogo e rode **um** destes:

```bash
# Python (já vem na maioria dos sistemas)
python -m http.server 8000
# ou Python 2: python -m SimpleHTTPServer 8000

# Node.js
npx serve .
```

Depois abra no navegador: **http://localhost:8000**

> ⚠️ Mesmo com servidor local, a biblioteca Three.js é baixada de um CDN na primeira vez — então **precisa de internet** ao menos no primeiro carregamento. Veja a Opção C para 100% offline.

### Opção B — Abrir direto (precisa de internet)
Alguns navegadores permitem abrir o `index.html` direto com duplo-clique se houver conexão. Se a tela ficar travada em "Invocando a floresta…", use a Opção A.

### Opção C — 100% offline (para a apresentação, sem depender de internet)
1. Baixe o arquivo da biblioteca: <https://unpkg.com/three@0.169.0/build/three.module.js>
2. Salve como `three.module.js` numa pasta `libs/` ao lado do `index.html`.
3. No `index.html`, troque a linha do *import map* para:
   ```html
   <script type="importmap">
   { "imports": { "three": "./libs/three.module.js" } }
   </script>
   ```
4. Rode via servidor local (Opção A). Agora não depende de internet.

> 💡 **Dica para a apresentação:** use a Opção C + servidor local no seu próprio notebook. Assim nada depende da internet ou do PC da sala.

---

## 🎮 Controles
| Tecla | Ação |
|---|---|
| `W A S D` / setas | Mover |
| `1` / `2` / `3` | Trocar elemento (Fogo / Gelo / Raio) |
| `Espaço` | Alternar elemento |
| `ESC` | Pausar |

Ataque é automático no inimigo mais próximo. Você controla o movimento e o elemento.

---

## 🔥 Mecânica-assinatura: Reações Elementais
| Combinação | Reação | Efeito |
|---|---|---|
| Gelo + Raio | **Cristal Estilhaçado** | Explosão em área (anel expansivo) |
| Fogo + Raio | **Sobrecarga** | Corrente elétrica entre até 4 inimigos |
| Fogo + Gelo | **Vapor** | Nuvem que lentifica a área |

Status individuais: Fogo (dano contínuo), Gelo (lentidão + recebe +35% de dano), Raio (dano rápido).

---

## 🧱 Arquitetura (resumo para defesa)

O ponto técnico central é a **separação entre lógica e renderização**:

- A **lógica** opera no plano do chão em coordenadas `(x, z)` — movimento, colisão (distância ao quadrado entre círculos), spawn, status e reações são números puros, independentes do Three.js.
- A **renderização** (objeto `R`) cuida de cena, câmera, luzes e dos `mesh` 3D. A cada frame, a posição lógica de cada entidade é **sincronizada** ao seu mesh (`sync()`).

Essa separação permitiu **testar toda a lógica do jogo de forma automatizada** (sem GPU), e é uma boa prática de engenharia de jogos.

Outros pontos: máquina de estados (`menu`/`playing`/`levelup`/`paused`/`gameover`/`victory`), câmera que segue o jogador com offset diagonal fixo (o "2.5D"), glow feito com materiais brilhantes + *halos* aditivos (sprites), sombras falsas (círculos no chão), e efeitos transitórios (anel, arcos de raio, partículas) gerenciados por uma lista de `Effect`.

---

## 💡 Por que não é cópia
1. **Mecânica original** — reações elementais com troca ativa de elemento; transforma o gênero de auto-battler passivo em decisão tática.
2. **Escrito do zero** — sem engine, template ou código de terceiros. Three.js é apenas a biblioteca de renderização 3D; toda a lógica de jogo é própria.
3. **Conteúdo e identidade próprios** — fases, inimigos, upgrades, visual geométrico e balanceamento autorais.

---

## 📁 Versões
Existe também uma versão **2D em Canvas puro** (totalmente self-contained, abre com duplo-clique sem servidor nem internet). As duas compartilham a mesma mecânica; esta 2.5D tem maior impacto visual, a 2D tem entrega mais simples.
