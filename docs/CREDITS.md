# Créditos

Todos os assets de terceiros usados neste projeto, com autor, URL e licença.
Mantemos esta lista atualizada conforme novos assets são adicionados.

---

## Engine & Bibliotecas

| Item | Autor | Versão | Licença | URL |
|---|---|---|---|---|
| Phaser | Photon Storm | 4.2.1 | MIT | <https://phaser.io/> |
| nipplejs | Yoann Moïnet | 0.10.2 | MIT | <https://github.com/yoannmoinet/nipplejs> |

---

## Arte

**100% própria.** Heróis, criaturas, chefe, baús, cenário, ícones, projéteis,
partículas, molduras de UI e ícone do app são gerados por código com uma paleta
única (`src/art/`, `tools/make-icons.py`). Nenhum pack de sprites de terceiros é
usado (os packs Kenney/Tiny Creatures e a bola de fogo de Revon foram removidos).

---

## Áudio

**100% próprio.** Os ~21 efeitos sonoros e as 3 músicas ("Clareira", "Horda" e
"O Ancião") são sintetizados por código no carregamento do jogo
(`src/audio/Synth.js`) — não há arquivos de áudio de terceiros.

---

## Fonte tipográfica

| Fonte | Autor | Licença | URL |
|---|---|---|---|
| Jersey 15 | The Soft Type Project Authors | OFL 1.1 | <https://fonts.google.com/specimen/Jersey+15> |

Empacotada localmente (`assets/fonts/`, licença em `OFL-Jersey15.txt`) — funciona offline.

---

## Resumo de licenças

- **CC0 1.0** (domínio público equivalente): livre para qualquer uso, sem atribuição obrigatória — atribuímos por boa prática.
- **CC-BY 4.0**: livre para qualquer uso **com atribuição** ao autor original. Atribuída acima e na tela de Créditos do jogo.
- **MIT / OFL**: licenças permissivas; mantemos avisos de copyright nos arquivos originais (`vendor/` para JS).
