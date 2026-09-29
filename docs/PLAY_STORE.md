# Publicação na Google Play

Guia do que já está pronto no repositório e do que precisa ser feito na sua
máquina/conta para publicar.

## O que já está pronto

| Item | Onde |
|---|---|
| Projeto Android (Capacitor 6) | `android/` · `capacitor.config.json` |
| ID do app | `com.lopesleo.guardiao` (**definitivo depois do 1º upload** — troque antes se quiser) |
| Paisagem fixa, tela cheia imersiva, tela sempre ligada | `AndroidManifest.xml` · `MainActivity.java` |
| Pausa ao minimizar, botão Voltar do Android | `src/systems/Platform.js` |
| Ícone adaptativo + splash | gerados por `tools/make-icons.py` → `resources/` → `npm run icons` |
| Ícone da loja 512×512 | `resources/playstore-icon-512.png` |
| Tudo offline (fonte e libs locais) | `assets/fonts/`, `vendor/` |
| Ferramentas de debug fora do build | teclas de debug e botão de moedas só com `?debug=1` |

## Gerar o AAB (uma vez por versão)

Pré-requisitos: **Node 18+** e **Android Studio** (traz Java e o Android SDK).

```bash
npm install
npm run android:sync      # copia o jogo para www/ e sincroniza com android/
npm run android:open      # abre o projeto no Android Studio
```

No Android Studio:
1. Espere o Gradle sincronizar.
2. Teste num celular (▶ Run) — confira som, toque, pausa ao sair do app, botão voltar.
3. **Build → Generate Signed App Bundle** → crie uma *keystore* nova
   (**guarde o arquivo e as senhas em lugar seguro** — sem ela não há atualização).
4. O arquivo sai em `android/app/release/app-release.aab`.

A cada nova versão, aumente `versionCode` (inteiro) e `versionName` em
`android/app/build.gradle` e rode `npm run android:sync` de novo.

## Ficha da loja (sugestão)

**Nome:** Guardião da Floresta

**Descrição curta (80):**
> Sobreviva à horda, combine elementos e desperte a floresta. Roguelite de ação.

**Descrição completa:**
> A floresta está sendo invadida — e você é o último Guardião.
>
> **Guardião da Floresta** é um roguelite de sobrevivência: você só se move, suas
> armas atacam sozinhas, e cada nível traz uma escolha que muda a partida.
>
> 🔥❄️⚡ **Reações elementais** — Fogo + Gelo vira Vapor escaldante. Gelo + Raio
> estilhaça em Cristal. Fogo + Raio dispara a Sobrecarga. Monte combos!
>
> • 6 armas e 6 evoluções supremas
> • 4 personagens com estilos diferentes
> • Enxames, cercos, mini-chefes e o temido Ancião
> • 5 níveis de Perigo e 24 conquistas
> • Bênçãos permanentes: fique mais forte a cada partida
> • Partidas de ~7 minutos, perfeitas para o celular
> • Joga offline, sem anúncios, sem compras dentro do app

**Categoria:** Jogos → Ação · **Classificação indicativa:** questionário IARC
(violência fantasiosa leve, sem sangue → costuma sair Livre/10+).

**Capturas de tela:** mínimo 2 (recomendado 6–8) em paisagem, 16:9. Sugestões:
menu com a fogueira; combate com uma reação ("VAPOR!"); cartas de nível;
mini-chefe com a barra; tela de Vitória; Arsenal com receitas de evolução.
Jogue no navegador com a janela em 1920×1080 e use a captura do sistema.

**Gráfico de destaque (1024×500):** obrigatório — use o menu (título + herói).

## Política de privacidade

Obrigatória mesmo sem coleta de dados. Texto pronto em `docs/PRIVACY.md` —
publique no GitHub Pages (ex.: `https://lopesleo.github.io/guardiao-jogo-p2/docs/PRIVACY.html`)
e cole o link no Play Console. Na seção **Segurança dos dados**, declare:
*o app não coleta nem compartilha dados*.

## Preço

Jogo pago no Brasil: o valor mínimo aceito pelo Google muda por país (confira no
Play Console ao definir o preço). Para vender, a conta precisa de um **perfil de
pagamentos** configurado.

## Próximos passos recomendados (pós-lançamento)

- Tradução para inglês (amplia muito o alcance fora do Brasil).
- Conquistas do Google Play Games (os ids de `ACHIEVEMENTS` já servem de chave).
- Salvar na nuvem (Play Games Saved Games) — hoje o progresso fica no aparelho.
