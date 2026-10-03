# Publicação na Google Play

Guia do que já está pronto no repositório e do que precisa ser feito na sua
máquina/conta para publicar.

## O que já está pronto

| Item | Onde |
|---|---|
| Projeto Android (Capacitor 8, alvo Android 16 / API 36, mínimo Android 7 / API 24) | `android/` · `capacitor.config.json` |
| ID do app | `com.lopesleo.guardiao` (**definitivo depois do 1º upload** — troque antes se quiser) |
| Paisagem fixa, tela cheia imersiva, tela sempre ligada | `AndroidManifest.xml` · `MainActivity.java` |
| Pausa ao minimizar, botão Voltar do Android | `src/systems/Platform.js` |
| Ícone adaptativo + splash | gerados por `tools/make-icons.py` → `resources/` → `npm run icons` |
| Ícone da loja 512×512 | `resources/playstore-icon-512.png` |
| Tudo offline (fonte e libs locais) | `assets/fonts/`, `vendor/` |
| Ferramentas de debug fora do build | teclas de debug e botão de moedas só com `?debug=1` |

## Gerar o AAB (uma vez por versão)

Pré-requisitos: **Node 22+**, **JDK 21** e **Android Studio** recente (Gradle 8.14, AGP 8.13).

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

## Ficha da loja (5 idiomas)

Números conferidos com o `config.js` em 03/10/2026 (18 armas, 18 evoluções, 7 guardiões,
12 lendas, 2 mapas, 5 Perigos, 32 conquistas). Limites da Play: nome 30, descrição curta 80,
completa 4000 caracteres. No Play Console: **Presença na loja → Traduções** (pt-BR padrão).

### Português (Brasil) — padrão

**Nome:** Guardião da Floresta

**Descrição curta:**
> Sobreviva à horda, combine elementos e liberte as lendas da floresta brasileira.

**Descrição completa:**
> A Podridão tomou a floresta. Você é o último Guardião.
>
> **Guardião da Floresta** é um roguelite de sobrevivência inspirado no folclore brasileiro:
> você só se move, suas armas atacam sozinhas e cada nível traz uma carta que muda a partida.
>
> 🔥❄️⚡🌀 **Reações elementais** — Fogo + Gelo vira Vapor, Gelo + Raio estilhaça em Cristal,
> Fogo + Raio dispara a Sobrecarga, e o Vento traz Labareda, Geada e Temporal.
>
> • 18 armas, 18 evoluções e laços entre armas que combinam
> • 7 guardiões: Curupira, Caipora, Iara, Saci e outras lendas
> • Chefes com golpes que dá para desviar só andando: Mapinguari, Caboclo d'Água…
> • 2 mapas (Amazônia e Caatinga), 5 níveis de Perigo e 32 conquistas
> • A Clareira: horta, pesca, cozinha e obras entre uma partida e outra
> • Partidas de ~7 minutos, feitas para o celular · joga offline
> • Grátis: anúncios só se você quiser, nunca durante a ação

### English

**Name:** Forest Guardian

**Short description:**
> Survive the horde, combine elements and free the legends of Brazil's forest.

**Full description:**
> The Rot has taken the forest. You are the last Guardian.
>
> **Forest Guardian** is a survival roguelite inspired by Brazilian folklore: you only move,
> your weapons attack on their own, and every level brings a card that changes the run.
>
> 🔥❄️⚡🌀 **Elemental reactions** — Fire + Ice becomes Steam, Ice + Lightning shatters into
> Crystal, Fire + Lightning sets off an Overload, and Wind brings Blaze, Frost and Tempest.
>
> • 18 weapons, 18 evolutions and links between weapons that combine
> • 7 guardians: Curupira, Caipora, Iara, Saci and other legends
> • Bosses whose attacks you can dodge just by walking: Mapinguari, Caboclo d'Água…
> • 2 maps (Amazon and Caatinga), 5 Danger levels and 32 achievements
> • The Clearing: gardening, fishing, cooking and building between runs
> • ~7-minute runs made for mobile · plays offline
> • Free: ads only if you want them, never during the action

### Español

**Nombre:** Guardián del Bosque

**Descripción breve:**
> Sobrevive a la horda, combina elementos y libera las leyendas de Brasil.

**Descripción completa:**
> La Podredumbre tomó el bosque. Eres el último Guardián.
>
> **Guardián del Bosque** es un roguelite de supervivencia inspirado en el folclore brasileño:
> solo te mueves, tus armas atacan solas y cada nivel trae una carta que cambia la partida.
>
> 🔥❄️⚡🌀 **Reacciones elementales** — Fuego + Hielo se vuelve Vapor, Hielo + Rayo estalla en
> Cristal, Fuego + Rayo desata la Sobrecarga, y el Viento trae Llamarada, Escarcha y Temporal.
>
> • 18 armas, 18 evoluciones y vínculos entre armas que combinan
> • 7 guardianes: Curupira, Caipora, Iara, Saci y otras leyendas
> • Jefes con ataques que se esquivan solo caminando: Mapinguari, Caboclo d'Água…
> • 2 mapas (Amazonía y Caatinga), 5 niveles de Peligro y 32 logros
> • El Claro: huerto, pesca, cocina y obras entre partida y partida
> • Partidas de ~7 minutos, pensadas para el móvil · juega sin conexión
> • Gratis: anuncios solo si tú quieres, nunca durante la acción

### 日本語

**名前:** 森の守護者

**簡単な説明:**
> 群れを生き抜き、属性を組み合わせ、ブラジルの森の伝説たちを解き放とう。

**詳しい説明:**
> 腐敗が森を飲み込んだ。あなたは最後の守護者だ。
>
> **森の守護者**は、ブラジルの民間伝承をもとにしたサバイバル・ローグライト。操作は移動だけ。
> 武器は自動で攻撃し、レベルアップのたびに選ぶカードがプレイを変えていく。
>
> 🔥❄️⚡🌀 **属性反応** — 炎＋氷で蒸気、氷＋雷で結晶、炎＋雷で過負荷。さらに風が烈火・霜・嵐を呼ぶ。
>
> • 18種の武器、18種の進化、相性のいい武器同士の「絆」
> • 7人の守護者：クルピラ、カイポラ、イアラ、サシなどの伝説たち
> • 歩くだけでかわせる大技を持つボス：マピングアリ、カボクロ・ダグア…
> • 2つのマップ（アマゾンとカアチンガ）、5段階の危険度、32の実績
> • 広場：プレイの合間に畑、釣り、料理、建設
> • スマホ向けの1プレイ約7分・オフラインで遊べる
> • 基本無料：広告は見たいときだけ。プレイ中には出ません

### 简体中文

**名称:** 森林守护者

**简短说明:**
> 在兽群中生存，组合元素，解放巴西森林中的传说。

**完整说明:**
> 腐朽吞没了森林。你是最后的守护者。
>
> **森林守护者**是一款取材于巴西民间传说的生存类肉鸽游戏：你只需移动，武器会自动攻击，
> 每次升级都会获得一张改变战局的卡牌。
>
> 🔥❄️⚡🌀 **元素反应** —— 火＋冰化为蒸汽，冰＋雷碎成结晶，火＋雷引发超载，风还能带来烈焰、寒霜与风暴。
>
> • 18种武器、18种进化，以及相配武器之间的羁绊
> • 7位守护者：库鲁皮拉、凯波拉、伊亚拉、萨西等传说人物
> • 只靠走位就能躲开大招的头目：马品瓜里、卡博克洛水灵……
> • 2张地图（亚马孙与卡廷加）、5级危险度、32项成就
> • 空地：局与局之间种菜、钓鱼、烹饪和建造
> • 每局约7分钟，专为手机设计 · 可离线游玩
> • 免费：广告只在你想看时出现，战斗中绝不打扰

**Categoria:** Jogos → Ação · **Classificação indicativa:** questionário IARC
(violência fantasiosa leve, sem sangue → costuma sair Livre/10+).

**Capturas de tela:** mínimo 2 (recomendado 6–8) em paisagem, 16:9. Sugestões:
menu com a fogueira; combate com uma reação ("VAPOR!"); cartas de nível;
mini-chefe com a barra; tela de Vitória; Arsenal com receitas de evolução.
Jogue no navegador com a janela em 1920×1080 e use a captura do sistema.

**Gráfico de destaque (1024×500):** obrigatório — use o menu (título + herói).

## Política de privacidade

Obrigatória mesmo sem coleta de dados. Texto pronto em `docs/PRIVACY.md` —
publique no GitHub Pages (ex.: `https://lopesleo.github.io/Guardiao-Game/docs/PRIVACY.html`)
e cole o link no Play Console. Na seção **Segurança dos dados**, declare:
*o app não coleta nem compartilha dados*.

## Preço

Jogo pago no Brasil: o valor mínimo aceito pelo Google muda por país (confira no
Play Console ao definir o preço). Para vender, a conta precisa de um **perfil de
pagamentos** configurado.

## Próximos passos recomendados (pós-lançamento)

- Conquistas do Google Play Games (os ids de `ACHIEVEMENTS` já servem de chave).
- Salvar na nuvem (Play Games Saved Games) — hoje o progresso fica no aparelho.
