---
name: versao-loja
description: "Lista de conferência antes de gerar um AAB novo para a Play Store (versão, anúncios, idiomas, laboratórios, documentos). Use quando o Leonardo pedir um AAB/APK novo ou 'prepara a versão'."
argument-hint: "[versionName, ex.: 1.0.3]"
user-invocable: true
---

# Versão para a loja

Adaptada do `/release-checklist` e do `/launch-checklist` do Claude-Code-Game-Studios, reduzida ao que
de fato já quebrou ou pode quebrar neste projeto. Cada item: **OK**, **FALHOU** (com a saída) ou
**NÃO RODOU** (diga por quê). Item que não rodou nunca vira OK.

## Antes do build

1. `git status` limpo e na `main` (a versão sai da main, depois do merge `--no-ff`).
2. `npm run check` sem erro (conteúdo e os 6 idiomas).
3. `npm run balance` sem FALHA.
4. Teste de fumaça: `DIFFS=0 SEEDS=11 node tools/bot-lab.mjs medir` roda até o fim **sem "ERRO"** na
   coluna final (erro de página = exceção no jogo). Com servidor em :8151.
5. `src/config.js`: `ADS.TESTING` continua `true` no repositório — **nunca** mudar à mão; o
   `npm run android:aab` só inverte na cópia empacotada. `ADS.MAX_AD_RATING` = "Teen".
6. Nada de debug fora de `?debug=1`.

## Versão

7. `android/app/build.gradle`: `versionCode` +1 e `versionName` novo (ver `docs/PLAY_STORE.md`).
   Commit `chore(versao): X.Y.Z (código N) — <resumo>` numa branch `chore/versao-X.Y.Z`, merge `--no-ff`.
8. `npm run android:aab` → `dist/guardiao-vX.Y.Z-N-anuncios-reais.aab`. **Nunca** crie a chave de
   assinatura pelo Leonardo; se faltar `android/keystore.properties`, pare e avise.
9. `cap sync` costuma deixar `android/app/capacitor.build.gradle` alterado só por fim de linha: confira
   com `git diff` e reverta se for só isso.

## Loja e documentos

10. Notas da versão ("Novidades") curtas, nos 8 idiomas da ficha, sem prometer o que não está no app.
11. Mudou dado coletado (Analytics, nuvem, anúncios)? Conferir política (`docs/PRIVACY.md`, site
    `lopesleo.github.io/guardiao/privacidade/`) e "Segurança dos dados" no Play Console.
12. `CLAUDE.md` → "Pendências atuais": item do envio aponta para o AAB novo. `docs/ROADMAP.md` em dia.

## Fim

Resumo em português: arquivo gerado (caminho e tamanho), o que mudou desde a última versão
(`git log --oneline <tag-ou-commit-anterior>..main`), e os passos 👤 que só o Leonardo faz (enviar no
Play Console, trocar o pacote do rascunho, mandar para revisão). **Push só se ele pedir.**
