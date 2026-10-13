# Estúdio (skills e guarda do git para o Claude Code)

O que aproveitamos do [Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)
(MIT). Os 49 agentes e a hierarquia de diretores não vieram: é coordenação demais para um projeto de uma
pessoa. Vieram as ideias que resolvem problemas que este projeto já teve, reescritas com as nossas regras:

| Peça | Origem no Game Studios | O que faz aqui |
|---|---|---|
| `skills/revisao-design` | `/design-review` | Confere uma novidade contra os pilares do `CLAUDE.md` (só andar, justiça, chefes justos, arte por código, 6 idiomas, config.js) antes do merge |
| `skills/balanco` | `/balance-check` | Roda os laboratórios (`npm run balance`, `rx-lab`, `bot-lab`) e compara com as metas do `docs/BALANCING.md` |
| `skills/versao-loja` | `/release-checklist`, `/launch-checklist` | Lista de conferência antes de cada AAB |
| `hooks/guarda-git.mjs` | `validate-commit.sh`, `validate-push.sh` | Bloqueia Co-Authored-By, commit direto na main, mensagem fora do padrão, `ADS.TESTING = false` e merge sem `--no-ff`; pergunta antes de push |

Regra herdada que vale para todas: **"NÃO AVALIADO" é um resultado válido** — o que não foi medido ou
conferido nunca aparece como aprovado.

## Instalar (uma vez por máquina)

A pasta `.claude/` fica fora do git, então a fonte é esta pasta e a instalação é uma cópia. No Claude
Code, digite (o `!` roda o comando nesta sessão):

```
! mkdir -p .claude/skills .claude/hooks && cp -r tools/estudio/skills/* .claude/skills/ && cp tools/estudio/hooks/guarda-git.mjs .claude/hooks/ && cp -n tools/estudio/settings.json .claude/settings.json
```

O `cp -n` não sobrescreve um `.claude/settings.json` que já exista: nesse caso, junte o bloco `hooks`
à mão. Depois de mudar algo aqui, rode o comando de novo. As skills aparecem como `/revisao-design`,
`/balanco` e `/versao-loja`.
