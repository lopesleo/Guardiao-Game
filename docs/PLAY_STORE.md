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

## Gerar o app assinado (APK para instalar, AAB para a loja)

- **APK** (`.apk`) = instala direto no celular ou manda para amigos testarem.
- **AAB** (`.aab`) = o que a **Play Store** aceita (APK não é aceito em app novo).

Os dois são assinados com a **mesma chave**, que é **sua** e nunca vai para o git. Não precisa do
Android Studio: tudo sai por comando, num PowerShell aberto na pasta do jogo (no Explorer, clique
na barra de endereço, digite `powershell` e Enter). Pré-requisitos: **Node 22+**, **JDK 21** e o
**Android SDK** (já instalados neste PC; ver `tools/android-install.mjs`).

### 1. Criar a chave (uma vez na vida do jogo)

```powershell
npm run android:chave
```

Pede seu nome e uma senha (mín. 8 caracteres, **sem acento** — o formato da chave não aceita).
Cria a chave em `C:\Users\<você>\chaves-android\guardiao-upload.jks` (para outro lugar:
`npm run android:chave -- D:\chaves\guardiao.jks`; dentro da pasta do jogo ele recusa) e o
`android/keystore.properties`, que diz ao Gradle onde está a chave e a senha (fora do git).
Nunca sobrescreve uma chave que já existe.

**Faça backup do `.jks` e da senha em dois lugares** (ex.: pen drive + Google Drive, senha num
gerenciador de senhas). Sem eles não dá para lançar atualização. Em outro PC: copie o `.jks` e o
`android/keystore.properties` (ajuste o caminho `storeFile` dentro dele).

### 2. Gerar

```powershell
npm run android:apk     # APK com anúncios de TESTE  → dist/guardiao-v1.0-1-anuncios-teste.apk
npm run android:aab     # AAB com anúncios de VERDADE → dist/guardiao-v1.0-1-anuncios-reais.aab
```

O comando copia o jogo, compila, **confere a assinatura** e põe o arquivo em `dist/` com a versão e
o tipo de anúncio no nome. **Não mexa em `ADS.TESTING` à mão:** o `android:aab` liga os anúncios de
verdade só na cópia empacotada; todo o resto (APK, `android:install`, navegador) usa os de teste.
Clicar em anúncio de verdade do próprio app pode bloquear a conta do AdMob. Para inverter:
`npm run android:apk -- --anuncios-reais` ou `npm run android:aab -- --anuncios-teste`.

**Instalar o APK num celular:** mande o arquivo (cabo, Drive, WhatsApp), abra no celular e
permita "instalar apps desconhecidos". Se o celular já tem o jogo de outra fonte (o de teste do
`npm run android:install` ou, depois, o da Play Store), a assinatura é diferente e ele recusa:
**desinstale antes — isso apaga o progresso salvo naquele celular.**

**Na Play Store:** no 1º envio a Play guarda a chave oficial do app (*Play App Signing*) e a sua
vira a **chave de envio**. Se um dia perder a sua, o Play Console permite pedir a troca da chave
de envio ao suporte — mas não conte com isso: guarde a chave.

A cada nova versão enviada à loja, aumente `versionCode` (inteiro: 1, 2, 3…) e `versionName`
("1.0.1"…) em `android/app/build.gradle` — a Play recusa um código repetido.

**Pelo Android Studio** (se preferir): `npm run android:sync` → `npm run android:open` →
**Build → Generate Signed App Bundle / APK…** → escolha a mesma chave (*Choose existing…*).
Nesse caminho os anúncios seguem o `ADS.TESTING` do `config.js` (de teste).

## Ficha da loja (6 idiomas)

Números conferidos com o `config.js` em 03/10/2026 (18 armas, 18 evoluções, 7 guardiões,
12 lendas, 2 mapas, 5 Perigos, 32 conquistas). Limites da Play: nome 30, descrição curta 80,
completa 4000 caracteres. No Play Console: **Presença na loja → Traduções** (pt-BR padrão;
chinês tradicional = `zh-TW` e `zh-HK`, a mesma ficha nos dois).

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
> • Chefes que avisam cada golpe: desvie andando ou com o dash (Mapinguari, Caboclo d'Água…)
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
> • Bosses that telegraph every attack: dodge by moving or dashing (Mapinguari, Caboclo d'Água…)
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
> • Jefes que avisan cada golpe: esquívalos moviéndote o con el impulso (Mapinguari, Caboclo d'Água…)
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
> • すべての大技に予告があるボス：移動かダッシュでかわせる（マピングアリ、カボクロ・ダグア…）
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
> • 每次大招都有预警的头目：移动或冲刺都能躲开（马品瓜里、卡博克洛水灵……）
> • 2张地图（亚马孙与卡廷加）、5级危险度、32项成就
> • 空地：局与局之间种菜、钓鱼、烹饪和建造
> • 每局约7分钟，专为手机设计 · 可离线游玩
> • 免费：广告只在你想看时出现，战斗中绝不打扰

### 繁體中文（台灣、香港）

**名稱:** 森林守護者

**簡短說明:**
> 在獸群中生存，組合元素，解放巴西森林中的傳說。

**完整說明:**
> 腐朽吞沒了森林。你是最後的守護者。
>
> **森林守護者**是一款取材於巴西民間傳說的生存類 Roguelite 遊戲：你只需移動，武器會自動攻擊，
> 每次升級都會獲得一張改變戰局的卡牌。
>
> 🔥❄️⚡🌀 **元素反應** —— 火＋冰化為蒸汽，冰＋雷碎成結晶，火＋雷引發超載，風還能帶來烈焰、寒霜與風暴。
>
> • 18種武器、18種進化，以及相配武器之間的羈絆
> • 7位守護者：庫魯皮拉、凱波拉、伊亞拉、薩西等傳說人物
> • 每次大招都有預警的頭目：移動或衝刺都能躲開（馬品瓜里、卡博克洛水靈……）
> • 2張地圖（亞馬孫與卡廷加）、5級危險度、32項成就
> • 空地：局與局之間種菜、釣魚、烹飪和建造
> • 每局約7分鐘，專為手機設計 · 可離線遊玩
> • 免費：廣告只在你想看時出現，戰鬥中絕不打擾

**Categoria:** Jogos → Ação · **Classificação indicativa:** questionário IARC
(violência fantasiosa leve, sem sangue → costuma sair Livre/10+).

**Capturas de tela:** mínimo 2 (recomendado 6–8) em paisagem, 16:9. Sugestões:
menu com a fogueira; combate com uma reação ("VAPOR!"); cartas de nível;
mini-chefe com a barra; tela de Vitória; Arsenal com receitas de evolução.
Jogue no navegador com a janela em 1920×1080 e use a captura do sistema.

**Gráfico de destaque (1024×500):** obrigatório — use o menu (título + herói).

## Notas da versão ("Novidades")

Colar no Play Console (Versão → Notas da versão) como está; limite de 500 caracteres por idioma.
O chinês tradicional vale para `zh-TW` e `zh-HK`.

### 1.0.9 (código 10) — 19/10/2026

AAB: `dist/guardiao-v1.0.9-10-anuncios-reais.aab`. Só no Teste interno (o Alpha fica na 1.0.7 em revisão). Horta da
Clareira Ancestral: cerca entalhada, portal com lamparinas e placa ao vento, espantalho de poncho com lamparina no braço.

```
<pt-BR>
• Horta da Clareira Ancestral (Pacote Fundador): cerca de estacas entalhadas com trançado de palha, portal com ponteiras de cobre, placa do broto e lamparinas balançando ao vento, e um espantalho novo de poncho tecido, com pena azul no chapéu e lamparina no braço.
</pt-BR>
<en-US>
• Ancestral Clearing garden (Founder Pack): a fence of carved stakes woven with straw, a gate with copper finials, a sprout sign and lanterns swaying in the wind, and a new scarecrow in a woven poncho, with a blue feather in its hat and a lantern on its arm.
</en-US>
<es-419>
• Huerta del Claro Ancestral (Pack Fundador): cerca de estacas talladas con trenzado de paja, portal con remates de cobre, cartel del brote y faroles que se mecen con el viento, y un espantapájaros nuevo con poncho tejido, pluma azul en el sombrero y farol en el brazo.
</es-419>
<es-ES>
• Huerta del Claro Ancestral (Pack Fundador): cerca de estacas talladas con trenzado de paja, portal con remates de cobre, cartel del brote y faroles que se mecen con el viento, y un espantapájaros nuevo con poncho tejido, pluma azul en el sombrero y farol en el brazo.
</es-ES>
<ja-JP>
• いにしえの広場（創設者パック）の畑：わらを編み込んだ彫刻の杭の柵、銅飾りの門、新芽の看板と風に揺れるランプ。新しいかかしは織りのポンチョ姿で、帽子に青い羽、腕にランプ。
</ja-JP>
<zh-CN>
• 远古空地（创始者礼包）的菜园：编草的雕花木桩围栏、铜饰尖顶的门、嫩芽招牌和随风摇曳的灯笼；新的稻草人身穿编织斗篷，帽上插着蓝色羽毛，手臂上挂着灯笼。
</zh-CN>
<zh-TW>
• 遠古空地（創始者禮包）的菜園：編草的雕花木樁圍欄、銅飾尖頂的門、嫩芽招牌和隨風搖曳的燈籠；新的稻草人身穿編織斗篷，帽上插著藍色羽毛，手臂上掛著燈籠。
</zh-TW>
<zh-HK>
• 遠古空地（創始者禮包）的菜園：編草的雕花木樁圍欄、銅飾尖頂的門、嫩芽招牌和隨風搖曳的燈籠；新的稻草人身穿編織斗篷，帽上插著藍色羽毛，手臂上掛著燈籠。
</zh-HK>
```

### 1.0.8 (código 9) — 19/10/2026

AAB: `dist/guardiao-v1.0.8-9-anuncios-reais.aab`. Só no Teste interno (o Alpha fica na 1.0.7 em revisão). Animações
da Clareira Ancestral refeitas (borboleta com voo de verdade e sombra, tucano, estandarte, lamparinas, cogumelos).

```
<pt-BR>
• Clareira Ancestral (Pacote Fundador) com animações refeitas: borboletas-azuis com voo de verdade e sombra, pousando nos canteiros; tucano mais vivo; estandarte ao vento; lamparinas balançando com o vento; cogumelos que respiram à noite.
</pt-BR>
<en-US>
• Ancestral Clearing (Founder Pack) with redone animations: blue morpho butterflies with real flight and shadows, landing on the flowerbeds; a livelier toucan; a banner in the wind; lanterns swaying in the breeze; mushrooms that breathe at night.
</en-US>
<es-419>
• Claro Ancestral (Pack Fundador) con animaciones rehechas: mariposas morfo azules con vuelo de verdad y sombra, posándose en los canteros; un tucán más vivo; estandarte al viento; faroles que se mecen con la brisa; hongos que respiran de noche.
</es-419>
<es-ES>
• Claro Ancestral (Pack Fundador) con animaciones rehechas: mariposas morfo azules con vuelo de verdad y sombra, posándose en los canteros; un tucán más vivo; estandarte al viento; faroles que se mecen con la brisa; hongos que respiran de noche.
</es-ES>
<ja-JP>
• いにしえの広場（創設者パック）のアニメーションを作り直し：影を落として本当に飛び、花壇にとまる青いモルフォチョウ、もっと生き生きしたオオハシ、風になびく旗、そよ風に揺れるランプ、夜に呼吸するように光るキノコ。
</ja-JP>
<zh-CN>
• 远古空地（创始者礼包）动画全面重做：蓝色大闪蝶真正飞舞、投下影子、停在花圃上；巨嘴鸟更加生动；旗帜随风飘扬；灯笼随微风摇曳；蘑菇在夜里像呼吸一样发光。
</zh-CN>
<zh-TW>
• 遠古空地（創始者禮包）動畫全面重做：藍色大閃蝶真正飛舞、投下影子、停在花圃上；巨嘴鳥更加生動；旗幟隨風飄揚；燈籠隨微風搖曳；蘑菇在夜裡像呼吸一樣發光。
</zh-TW>
<zh-HK>
• 遠古空地（創始者禮包）動畫全面重做：藍色大閃蝶真正飛舞、投下影子、停在花圃上；巨嘴鳥更加生動；旗幟隨風飄揚；燈籠隨微風搖曳；蘑菇在夜裡像呼吸一樣發光。
</zh-HK>
```

### 1.0.7 (código 8) — 19/10/2026

AAB: `dist/guardiao-v1.0.7-8-anuncios-reais.aab`. Clareira Ancestral redesenhada (o acampamento inteiro: esteios
entalhados, lamparinas de cabaça, bancos e rede, tucano, borboletas-azuis, cogumelos que brilham, estandarte, pólen
nos raios) e o joystick religando no próprio toque da carta. As notas contam também o que veio na 1.0.6 (loja e
Guarda-roupa): os testadores do Alpha pulam da 1.0.4 direto para esta.

```
<pt-BR>
• Novo: Guarda-roupa na Clareira (efeitos de libertação, rastro e Despertar; peças grátis e kits) e Loja com o Pacote Fundador por tempo limitado.
• Clareira Ancestral do Fundador: esteios entalhados, lamparinas que acendem à noite, tucano, borboletas-azuis e cogumelos que brilham.
• Joystick: anda logo depois de escolher a carta e em toda a metade da tela.
</pt-BR>
<en-US>
• New: Wardrobe in the Clearing (freeing, trail and Awakening effects; free pieces and kits) and a Shop with the limited-time Founder Pack.
• Founder's Ancestral Clearing: carved posts, lanterns that light up at night, a toucan, blue morpho butterflies and glowing mushrooms.
• Joystick: move right after picking a card, anywhere on your half of the screen.
</en-US>
<es-419>
• Nuevo: Vestuario en el Claro (efectos de liberación, estela y Despertar; piezas gratis y kits) y Tienda con el Pack Fundador por tiempo limitado.
• Claro Ancestral del Fundador: postes tallados, faroles que se encienden de noche, un tucán, mariposas morfo azules y hongos que brillan.
• Joystick: te mueves justo después de elegir la carta, en toda tu mitad de la pantalla.
</es-419>
<es-ES>
• Nuevo: Vestuario en el Claro (efectos de liberación, estela y Despertar; piezas gratis y kits) y Tienda con el Pack Fundador por tiempo limitado.
• Claro Ancestral del Fundador: postes tallados, faroles que se encienden de noche, un tucán, mariposas morfo azules y hongos que brillan.
• Joystick: te mueves justo después de elegir la carta, en toda tu mitad de la pantalla.
</es-ES>
<ja-JP>
• 新機能：広場に衣装箱（解放・軌跡・覚醒のエフェクト。無料アイテムとセット）、期間限定の創設者パックがあるショップ。
• 創設者の「いにしえの広場」：彫刻の柱、夜に灯るランプ、オオハシ、青いモルフォチョウ、光るキノコ。
• ジョイスティック：カードを選んだ直後から、片側半分のどこでも操作できるように。
</ja-JP>
<zh-CN>
• 新内容：空地新增衣橱（解放、拖尾和觉醒特效，含免费物品与套装），以及推出限时创始者礼包的商店。
• 创始者的远古空地：雕花木柱、夜里点亮的灯、巨嘴鸟、蓝色大闪蝶和会发光的蘑菇。
• 摇杆：选完卡牌后立刻就能移动，屏幕一侧任意位置都能操作。
</zh-CN>
<zh-TW>
• 新內容：空地新增衣櫥（解放、拖尾和覺醒特效，含免費物品與套裝），以及推出限時創始者禮包的商店。
• 創始者的遠古空地：雕花木柱、夜裡點亮的燈、巨嘴鳥、藍色大閃蝶和會發光的蘑菇。
• 搖桿：選完卡牌後立刻就能移動，螢幕一側任意位置都能操作。
</zh-TW>
<zh-HK>
• 新內容：空地新增衣櫥（解放、拖尾和覺醒特效，含免費物品與套裝），以及推出限時創始者禮包的商店。
• 創始者的遠古空地：雕花木柱、夜裡點亮的燈、巨嘴鳥、藍色大閃蝶和會發光的蘑菇。
• 搖桿：選完卡牌後立刻就能移動，螢幕一側任意位置都能操作。
</zh-HK>
```

### 1.0.6 (código 7) — 19/10/2026

AAB: `dist/guardiao-v1.0.6-7-anuncios-reais.aab`. Liga a loja de cosméticos (`COSMETICS.ENABLED`/`SHOP`):
Guarda-roupa, kits a R$ 4,90, Pacote Fundador e Clareira Ancestral, com os produtos já ativos no Console; e o
joystick começa em toda a metade da tela (antes, só no quarto de baixo). Enviada pelo `npm run play:versao`.

```
<pt-BR>
• Novo: Guarda-roupa na Clareira — efeitos de libertação, rastro e Despertar, com peças grátis e kits (Ipê-rosa, Paineira, Coruja-buraqueira, Festa Junina). Só aparência.
• Novo: Loja com o Pacote Fundador por tempo limitado: Sem anúncios, os 4 kits e a Clareira Ancestral exclusiva.
• Joystick: agora começa em toda a metade da tela, não só embaixo.
</pt-BR>
<en-US>
• New: Wardrobe in the Clearing — freeing, trail and Awakening effects, with free pieces and kits (Pink Ipê, Silk Floss Tree, Burrowing Owl, Festa Junina). Looks only.
• New: Shop with the limited-time Founder Pack: No Ads, all 4 kits and the exclusive Ancestral Clearing.
• Joystick: now starts anywhere on your half of the screen, not just at the bottom.
</en-US>
<es-419>
• Nuevo: Vestuario en el Claro — efectos de liberación, estela y Despertar, con piezas gratis y kits (Ipê rosa, Palo borracho, Lechucita vizcachera, Fiesta Junina). Solo apariencia.
• Nuevo: Tienda con el Pack Fundador por tiempo limitado: Sin anuncios, los 4 kits y el Claro Ancestral exclusivo.
• Joystick: ahora empieza en toda tu mitad de la pantalla, no solo abajo.
</es-419>
<es-ES>
• Nuevo: Vestuario en el Claro — efectos de liberación, estela y Despertar, con piezas gratis y kits (Ipê rosa, Palo borracho, Lechucita vizcachera, Fiesta Junina). Solo apariencia.
• Nuevo: Tienda con el Pack Fundador por tiempo limitado: Sin anuncios, los 4 kits y el Claro Ancestral exclusivo.
• Joystick: ahora empieza en toda tu mitad de la pantalla, no solo abajo.
</es-ES>
<ja-JP>
• 新機能：広場に衣装箱 — 解放・軌跡・覚醒のエフェクト。無料アイテムとセット（ピンクのイペー、トックリキワタ、アナホリフクロウ、フェスタ・ジュニーナ）。見た目だけのアイテムです。
• 新機能：ショップに期間限定の創設者パック — 「広告なし」、セット4つ、限定の「いにしえの広場」。
• ジョイスティック：画面の下だけでなく、片側半分のどこからでも操作できるように。
</ja-JP>
<zh-CN>
• 新内容：空地新增衣橱——解放、拖尾和觉醒特效，含免费物品与套装（粉色风铃木、美丽异木棉、穴鸮、六月节）。仅外观。
• 新内容：商店推出限时创始者礼包：免广告、全部 4 个套装和独家的远古空地。
• 摇杆：现在在屏幕一侧的任意位置都能开始操作，不再只限下方。
</zh-CN>
<zh-TW>
• 新內容：空地新增衣櫥——解放、拖尾和覺醒特效，含免費物品與套裝（粉紅風鈴木、美人樹、穴鴞、六月節）。僅外觀。
• 新內容：商店推出限時創始者禮包：免廣告、全部 4 個套裝和獨家的遠古空地。
• 搖桿：現在在螢幕一側的任意位置都能開始操作，不再只限下方。
</zh-TW>
<zh-HK>
• 新內容：空地新增衣櫥——解放、拖尾和覺醒特效，含免費物品與套裝（粉紅風鈴木、美人樹、穴鴞、六月節）。僅外觀。
• 新內容：商店推出限時創始者禮包：免廣告、全部 4 個套裝和獨家的遠古空地。
• 搖桿：現在在螢幕一側的任意位置都能開始操作，不再只限下方。
</zh-HK>
```

### 1.0.5 (código 6) — 19/10/2026

AAB: `dist/guardiao-v1.0.5-6-anuncios-reais.aab`. Corrige o joystick da 1.0.4 (morria depois da 1ª carta
no celular): substituir a 1.0.4 do Alpha por esta.

```
<pt-BR>
• Correção: o joystick parava de funcionar depois de escolher uma carta, pausar ou reviver.
• Compra "Sem anúncios": o jogo agora avisa quando o pagamento é aprovado e quando a compra é estornada.
• Clareira: botão da loja "Sem anúncios" no topo, e o quadro do canto se ajusta ao texto grande.
</pt-BR>
<en-US>
• Fix: the joystick stopped working after picking a card, pausing or reviving.
• "No Ads" purchase: the game now tells you when your payment is approved and when a purchase is refunded.
• Clearing: "No Ads" shop button at the top, and the corner panel now fits large text.
</en-US>
<es-419>
• Corrección: el joystick dejaba de funcionar después de elegir una carta, pausar o revivir.
• Compra "Sin anuncios": el juego ahora avisa cuando el pago se aprueba y cuando la compra se reembolsa.
• Claro: botón de la tienda "Sin anuncios" arriba, y el panel de la esquina se ajusta al texto grande.
</es-419>
<es-ES>
• Corrección: el joystick dejaba de funcionar después de elegir una carta, pausar o revivir.
• Compra "Sin anuncios": el juego ahora avisa cuando el pago se aprueba y cuando la compra se reembolsa.
• Claro: botón de la tienda "Sin anuncios" arriba, y el panel de la esquina se ajusta al texto grande.
</es-ES>
<ja-JP>
• 修正：カードを選んだ後・一時停止後・復活後にジョイスティックが動かなくなる問題を修正。
• 購入「広告なし」：支払いが完了したときと、購入が返金されたときにお知らせするように。
• 広場：上部に「広告なし」ショップボタンを追加。隅のパネルが大きい文字に合わせて広がるように。
</ja-JP>
<zh-CN>
• 修复：选择卡牌、暂停或复活后摇杆失灵的问题。
• “免广告”购买：付款确认和购买退款时，游戏现在会提示你。
• 空地：顶部新增“免广告”商店按钮，角落面板会随大字号自动调整。
</zh-CN>
<zh-TW>
• 修正：選擇卡牌、暫停或復活後搖桿失靈的問題。
• 「免廣告」購買：付款確認和購買退款時，遊戲現在會提示你。
• 空地：頂部新增「免廣告」商店按鈕，角落面板會隨大字級自動調整。
</zh-TW>
<zh-HK>
• 修正：選擇卡牌、暫停或復活後搖桿失靈的問題。
• 「免廣告」購買：付款確認和購買退款時，遊戲現在會提示你。
• 空地：頂部新增「免廣告」商店按鈕，角落面板會隨大字級自動調整。
</zh-HK>
```

### 1.0.4 (código 5) — 16/10/2026

AAB: `dist/guardiao-v1.0.4-5-anuncios-reais.aab`. **Antes de mandar para revisão**, criar o produto
`sem_anuncios` (ver "Compra Sem anúncios" abaixo): sem ele, a janela da compra mostra "Loja indisponível".

```
<pt-BR>
• Novo: compra opcional "Sem anúncios" — os prêmios dos anúncios saem na hora, sem assistir.
• Acessibilidade nas Opções: clarões suaves, joystick fixo, para canhotos e maior, pesca assistida e avisos de perigo mais fáceis de ver para daltônicos.
• Zoom também na Clareira e pesca um pouco mais fácil.
• Correção: o botão das Opções não vira mais um traço ao ser tocado.
</pt-BR>
<en-US>
• New: optional "No Ads" purchase — ad rewards are yours instantly, no watching.
• Accessibility in Options: softer flashes, fixed, left-handed and larger joystick, assisted fishing, and danger warnings easier to see for colorblind players.
• Zoom now works in the Clearing too, and fishing is a little easier.
• Fix: the Options button no longer turns into a line when tapped.
</en-US>
<es-419>
• Nuevo: compra opcional "Sin anuncios": las recompensas de los anuncios son tuyas al instante, sin verlos.
• Accesibilidad en Opciones: destellos suaves, joystick fijo, para zurdos y más grande, pesca asistida y avisos de peligro más fáciles de ver para daltónicos.
• Zoom también en el Claro y pesca un poco más fácil.
• Corrección: el botón de Opciones ya no se convierte en una raya al tocarlo.
</es-419>
<es-ES>
• Nuevo: compra opcional "Sin anuncios": las recompensas de los anuncios son tuyas al instante, sin verlos.
• Accesibilidad en Opciones: destellos suaves, joystick fijo, para zurdos y más grande, pesca asistida y avisos de peligro más fáciles de ver para daltónicos.
• Zoom también en el Claro y pesca un poco más fácil.
• Corrección: el botón de Opciones ya no se convierte en una raya al tocarlo.
</es-ES>
<ja-JP>
• 新機能：任意の購入「広告なし」— 広告の報酬を、見ずにすぐ受け取れます。
• オプションにアクセシビリティを追加：フラッシュ軽減、固定・左利き用・大きいジョイスティック、釣りアシスト、色覚多様性に配慮した見やすい危険表示。
• ズームが広場でも使えるように。釣りが少し簡単に。
• 修正：オプションボタンをタップすると線になる問題を修正。
</ja-JP>
<zh-CN>
• 新增：可选购买“免广告”——广告奖励立即到手，无需观看。
• 选项中新增无障碍功能：柔和闪光、固定/左手/更大的摇杆、钓鱼辅助，以及色觉障碍玩家更易辨认的危险提示。
• 空地也能使用缩放；钓鱼稍微变简单。
• 修复：点击选项按钮时不再变成一条线。
</zh-CN>
<zh-TW>
• 新增：可選購買「免廣告」——廣告獎勵立即到手，無需觀看。
• 選項中新增無障礙功能：柔和閃光、固定／左手／更大的搖桿、釣魚輔助，以及色覺障礙玩家更易辨認的危險提示。
• 空地也能使用縮放；釣魚稍微變簡單。
• 修正：點擊選項按鈕時不再變成一條線。
</zh-TW>
<zh-HK>
• 新增：可選購買「免廣告」——廣告獎勵立即到手，無需觀看。
• 選項中新增無障礙功能：柔和閃光、固定／左手／更大的搖桿、釣魚輔助，以及色覺障礙玩家更易辨認的危險提示。
• 空地也能使用縮放；釣魚稍微變簡單。
• 修正：點擊選項按鈕時不再變成一條線。
</zh-HK>
```

### 1.0.3 (código 4) — 15/10/2026

```
<pt-BR>
• Novo: Zoom nas Opções (acessibilidade) — o mundo fica maior na tela, a interface continua do mesmo tamanho.
• Pesca: o toque agora vale na tela inteira.
</pt-BR>
<en-US>
• New: Zoom in Options (accessibility) — the world looks bigger on screen while the interface keeps its size.
• Fishing: taps now work anywhere on the screen.
</en-US>
<es-419>
• Nuevo: Zoom en Opciones (accesibilidad): el mundo se ve más grande y la interfaz mantiene su tamaño.
• Pesca: ahora el toque funciona en toda la pantalla.
</es-419>
<es-ES>
• Nuevo: Zoom en Opciones (accesibilidad): el mundo se ve más grande y la interfaz mantiene su tamaño.
• Pesca: ahora el toque funciona en toda la pantalla.
</es-ES>
<ja-JP>
• 新機能：オプションに「ズーム」を追加（アクセシビリティ）。画面の世界が大きく見え、UIのサイズはそのままです。
• 釣り：画面のどこをタップしても反応するようになりました。
</ja-JP>
<zh-CN>
• 新增：选项中的“缩放”（无障碍）——游戏画面放大，界面大小不变。
• 钓鱼：现在点击屏幕任何位置都有效。
</zh-CN>
<zh-TW>
• 新增：選項中的「縮放」（無障礙）——遊戲畫面放大，介面大小不變。
• 釣魚：現在點擊螢幕任何位置都有效。
</zh-TW>
<zh-HK>
• 新增：選項中的「縮放」（無障礙）——遊戲畫面放大，介面大小不變。
• 釣魚：現在點擊螢幕任何位置都有效。
</zh-HK>
```

## O que foi declarado no Play Console (09/10/2026)

Refazer quando o app mudar (compra "Remover anúncios", login do Play Games, novos SDKs).

- **App:** "Guardião da Floresta", `com.lopesleo.guardiao`, jogo, **grátis** (não pode virar pago depois
  de publicado), idioma padrão pt-BR, categoria **Ação**. Contato: `lopesleo.dev@gmail.com`, site
  `https://lopesleo.github.io` (é dele que o AdMob lê o `app-ads.txt`)
- **Política de privacidade:** `https://lopesleo.github.io/Guardiao-Game/docs/PRIVACY.html` (continua no ar, gerada
  pelo site). Endereço novo, para trocar aqui quando der: `https://lopesleo.github.io/guardiao/privacidade/`.
  Ao mudar `docs/PRIVACY.md`, copiar para `guardiao/privacy/pt.md` no repositório `lopesleo.github.io` (e revisar o `en.md`)
- **Anúncios:** sim. **ID de publicidade:** sim (análise, publicidade, prevenção de fraudes); a permissão
  `AD_ID` entra pelo SDK do AdMob
- **Detalhes do login:** nada restrito. Apps governamentais, recursos financeiros, saúde: não
- **Público-alvo:** 13–15, 16–17 e 18+
- **Classificação (IARC):** violência contra criaturas fantásticas, irreal, pixelizada, vista de longe, sem
  sangue; elementos assustadores raros; sem tabaco (a Vara Encantada é "acesa em brasa"); compras de bens
  digitais (sem itens aleatórios pagos). Resultado: Livre/PG/PEGI 7 na maior parte, **14 no Brasil**
  (a ClassInd não listou descritor de conteúdo — o que sobra é "Compras no jogo")
- **Segurança dos dados:** coleta e compartilha; criptografado em trânsito; sem conta; sem pedido de
  exclusão (os dados do Firebase não são ligados a uma pessoa). Tipos:

  | Dado | Coleta | Compartilha | Obrigatório? | Finalidades |
  |---|---|---|---|---|
  | Local aproximado (IP, AdMob) | sim | sim | sim | análise, publicidade, fraudes |
  | Interações no app | sim | sim | sim | análise, publicidade, fraudes |
  | Registros de falhas (Crashlytics) | sim | não | **opcional** (Opções) | análise |
  | Diagnóstico | sim | sim | sim | análise, publicidade, fraudes |
  | IDs do dispositivo | sim | sim | sim | análise, publicidade, fraudes |

  Ao publicar a compra "Sem anúncios", acrescentar: **Informações financeiras → Histórico de compras** |
  coleta: sim | compartilha: não | **opcional** (Opções) | análise. O Firebase Analytics registra sozinho o
  evento `in_app_purchase` (produto, preço, moeda); o jogo nunca vê dados de pagamento.

## Progresso na nuvem (Google Play Games)

O código está pronto (`android/.../PlayGamesPlugin.java` + `src/systems/CloudSave.js`), mas fica
**desligado** até existir o ID do projeto do Play Games. Sem ID, o app funciona normalmente e a
linha "Progresso na nuvem" nem aparece em Opções. Para ligar (depende da conta da Play Console):

1. Play Console → o app → **Play Games Services → Configuração** → criar o projeto do Play Games
   (pode usar o projeto do Google Cloud do Firebase, `guardiao-da-floresta`).
2. **Credenciais → Android (OAuth)**: pacote `com.lopesleo.guardiao` e o **SHA-1**. Cadastrar
   **dois**: o da chave de upload/debug (testes pelo Android Studio) e o da **chave de assinatura
   do app** da Play (Configuração → Integridade do app). Sem o segundo, o login falha só na versão
   baixada da loja.
3. **Propriedades → Jogos salvos: ATIVADO.**
4. **Testadores**: enquanto o projeto do Play Games não for publicado, só as contas da lista
   conseguem entrar.
5. Copiar o **ID do projeto** (só números) para `android/app/src/main/res/values/games-ids.xml`.
6. **Revisar e publicar** as alterações do Play Games.
7. Teste no celular: jogar 1 partida → desinstalar → reinstalar → o título mostra "Progresso
   recuperado do Play Games". Com outro celular na mesma conta, o jogo pergunta qual progresso usar.

**Segurança dos dados:** o save vai para a conta Google do próprio jogador (Jogos salvos do
Play Games), não para servidor nosso. Confira no guia do Google como declarar o SDK do Play
Games no formulário.

**Política de privacidade** (só quando a nuvem for ligada; até lá o app não usa o Play Games): pôr em
`docs/PRIVACY.md` e na versão em inglês do site (`lopesleo.github.io/guardiao/privacidade/` e `/en/privacy/`):

- No **Resumo**, trocar "Seu progresso fica **no seu aparelho**." por: "Seu progresso fica **no seu
  aparelho**. Se você entrar no **Google Play Games**, uma cópia também fica guardada na sua conta
  Google, para voltar ao reinstalar ou trocar de celular."
- Seção nova, antes de "Anúncios":

  > ## Cópia do progresso na nuvem (Google Play Games)
  >
  > Se você estiver conectado ao **Google Play Games**, o jogo guarda uma cópia do progresso
  > com o recurso **Jogos salvos** do Google. A cópia fica no espaço do jogo na sua conta Google
  > (uma pasta oculta, que só este jogo acessa), **não em servidores nossos**, e serve para
  > recuperar o progresso ao reinstalar ou trocar de aparelho. As opções (volume, idioma etc.)
  > não vão para a nuvem. O Google Play Games trata a sua conta e o seu perfil de jogador
  > conforme a [Política de Privacidade do Google](https://policies.google.com/privacy).
  > Para não usar a nuvem, basta não entrar no Play Games. "Apagar progresso" apaga também a
  > cópia na nuvem, e você pode excluir os dados do jogo no app ou nas configurações do Google
  > Play Games.

- Em "Seus direitos": "(apagar o progresso, inclusive a cópia no Play Games; redefinir o ID de
  publicidade; desativar notificações)".

## Preço

**Grátis**, com anúncios opcionais e a compra única **"Sem anúncios"** (perfil de pagamentos criado em
16/10/2026).

**Conta pessoal, sem CNPJ (decidido em 16/10/2026).** Ao vender pela Play Store, a ficha passa a mostrar o
nome legal e o **endereço residencial** do Leonardo, o que foi aceito. O CNPJ foi descartado: o MEI não cobre
"edição de jogos eletrônicos" (CNAE 5821-2/00; exigiria uma SLU com contador), e só traria privacidade com um
endereço fiscal separado. Se um dia mudar de ideia, o Google converte a conta pessoal em organização sem
trocar de conta (pede D-U-N-S, site verificado e perfil de pagamentos da empresa; não tem volta). A receita
do Google entra como pessoa física (carnê-leão).

## Compra "Sem anúncios" (Play Billing)

**O que é:** compra única (não consumível) que libera os prêmios dos anúncios sem assistir: reviver, mais
uma carta, troca e banimento extras, dobrar moedas, baú do dia e adiantar obra, **com os mesmos limites**.
Não vende moeda nem poder. No jogo: botão "SEM ANÚNCIOS" no título (ao lado de Créditos, some depois da
compra) e linha em **Opções → Privacidade**; com a compra, os botões de prêmio trocam o ▶ por ★.

**Código:** `src/systems/Billing.js` (plugin `@capgo/native-purchases` 8.8.1, versão fixa, Play Billing 9),
janela em `src/ui/NoAdsModal.js`, id do produto em `STORE.NO_ADS` (`src/config.js`). Sem servidor: a cada
abertura e a cada volta ao app (no máximo a cada 30 s) o jogo pergunta à loja o que a conta comprou.
- **Reconhecimento:** o próprio jogo reconhece a compra e espera a resposta (sem isso o Google estorna em
  3 dias — e em **3 a 5 minutos** para conta de teste de licença). Se falhar, tenta de novo sozinho a cada
  15 s (até 8 vezes) e em toda conferência seguinte.
- **Pendente** (boleto, Pix em análise, cartão de teste "aprova com atraso"): não libera até virar comprado;
  a janela mostra "Pagamento pendente" e o botão CONFERIR AGORA. O plugin não avisa quando vira pago, então
  **com o app aberto o jogo confere a loja a cada 20 s** enquanto houver pendente; quando libera, mostra o
  aviso "PAGAMENTO APROVADO" na próxima tela de menu. (Até 18/10/2026 só conferia na volta ao app: um
  pendente aprovado com o jogo aberto ficaria sem reconhecer e seria estornado.)
- **Reinstalar ou trocar de aparelho** na mesma conta Google: volta sozinho ("Restaurar compra" força).
- **Estorno/reembolso:** a compra some da loja → o jogo confere uma 2ª vez (e nunca nos 2 min logo depois de
  liberar), tira o "sem anúncios" (só o que veio da loja) e mostra o aviso **"COMPRA ESTORNADA"** no título
  ou na Clareira, com o botão para comprar de novo. A estrela da loja volta na Clareira. (Até 18/10/2026
  tirava calado: no teste, a compra aceita e reconhecida foi estornada e o item só sumiu, sem explicação.)
- **Métricas (GA4):** `iap_view` (de onde abriu), `iap_start`, `iap_result` (ok, pending, cancelled,
  unavailable), `iap_grant`, `iap_revoked` (`acked`: se o jogo tinha reconhecido — `false` = estorno por falta
  de reconhecimento), `iap_ack_fail` (`try`), `iap_notice` (`approved`/`revoked`), além do `in_app_purchase`
  automático do Firebase.
- Teste sem celular: **`npm run test:compra`** (`tools/test-compra.mjs`, loja falsa no navegador): compra,
  reconhecimento que falha, pendente aprovado com o app aberto, estorno com aviso (título e Clareira),
  resposta vazia isolada, loja fora do ar e carência logo depois da compra.

**Passo a passo no Play Console (👤):**
1. **Enviar uma versão com a compra** (1.0.4, código 5) ao teste fechado. O Console só deixa criar produtos
   depois que um pacote com a permissão `com.android.vending.BILLING` foi enviado.
2. **Monetizar com o Google Play → Produtos → Produtos únicos → Criar.** ID do produto: **`sem_anuncios`**
   (igual ao `STORE.NO_ADS`; não dá para mudar nem reaproveitar depois). Opção de compra: comprar (não
   alugar). Preço (definido em 16/10): **US$ 2,99** em massa para todos os países (Set prices → Editar preços em massa) e
   depois o Brasil à mão em **R$ 14,90** (a conversão dá R$ 14,99). Ativar. Opção de compra criada: `compra`.
3. **Nome e descrição** (nome até 55 caracteres, descrição até 200). O `es-419` vale também para `es-ES`, e
   o `zh-TW` vale para `zh-HK`:

   | Idioma | Nome | Descrição |
   |---|---|---|
   | pt-BR | Sem anúncios | Os prêmios dos anúncios (reviver, mais uma carta, dobrar moedas, baú do dia…) saem na hora, sem assistir. Compra única que apoia um jogo independente feito no Brasil. |
   | en-US | No Ads | Ad rewards (revive, one more card, double coins, daily chest…) are yours instantly, no watching. A one-time purchase that supports an indie game made in Brazil. |
   | es-419 | Sin anuncios | Las recompensas de los anuncios (revivir, una carta más, duplicar monedas, cofre diario…) son tuyas al instante. Compra única que apoya un juego independiente de Brasil. |
   | ja-JP | 広告なし | 広告の報酬（復活、カードをもう1枚、コイン2倍、毎日の宝箱など）を、見ずにすぐ受け取れます。ブラジルのインディーゲームを応援できる買い切りアイテムです。 |
   | zh-CN | 免广告 | 广告奖励（复活、再来一张卡、金币翻倍、每日宝箱等）无需观看，立即到手。一次性购买，支持一款巴西独立游戏。 |
   | zh-TW | 免廣告 | 廣告獎勵（復活、再來一張卡、金幣翻倍、每日寶箱等）無需觀看，立即到手。一次性購買，支持一款巴西獨立遊戲。 |

4. **Teste de licença:** Configuração → Teste de licença → pôr a sua conta (e, se quiser, a de testadores).
   Essas contas compram com "cartão de teste", sem cobrança.
5. **Testar no celular instalado pela Play Store** (link do teste; o APK de depuração não conversa com o
   produto). Cartão de teste "sempre aprova" → libera e o botão do título some. Cartão "aprova com atraso"
   → aparece "Pagamento pendente" e, minutos depois, libera **com o jogo aberto** (aviso "PAGAMENTO APROVADO");
   esperar 10 min e conferir em **Pedidos** que não foi estornado. "Sempre recusa" → aviso de falha. Desinstalar e
   reinstalar → volta ativo. Reembolsar em **Pedidos** → ao reabrir, os anúncios voltam e aparece o aviso "COMPRA ESTORNADA".
6. **Segurança dos dados:** acrescentar "Histórico de compras" (ver a tabela acima) e copiar a política
   (`docs/PRIVACY.md`, seção Compras) para o site.

## Produtos pelo script (recomendado)

Cadastrar produto à mão no site leva ~25 min cada (8 idiomas, menus que mudam de lugar, preço em massa que
arredonda o Brasil). O catálogo inteiro — IDs, preços, nomes e descrições nos 8 idiomas — vive em
`tools/play/produtos.json` (fonte de verdade; as tabelas abaixo são a mesma coisa para leitura) e
`tools/play-produtos.mjs` envia pela Google Play Developer API:

```
npm run play:produtos -- conferir      # o catálogo sozinho: tamanhos, 8 idiomas, IDs iguais aos do config.js
npm run play:produtos -- listar        # o que está no Console (só leitura; serve para testar a credencial)
npm run play:produtos -- enviar        # cria o que falta e ativa; o que já existe só é conferido (avisa se difere)
npm run play:produtos -- enviar --atualizar      # reescreve também os existentes com o catálogo
npm run play:produtos -- desativar pacote_fundador pacote_fundador_kits    # 31/01/2027
npm run play:produtos -- enviar pacote_apoiador                             # 01/02/2027
```

Preço: o base em US$ é convertido pela própria Play Store para cada país (o mesmo do "Editar preços em
massa", impostos incluídos) e o Brasil fica com o valor exato do catálogo. `--seco` mostra sem gravar.

**👤 Credencial (uma vez, ~10 min).** A chave é da sua conta Google, por isso fica com você:
1. [Google Cloud Console](https://console.cloud.google.com/) no projeto **guardiao-da-floresta** (o mesmo do
   Firebase) → **APIs e serviços → Biblioteca** → "Google Play Android Developer API" → **Ativar**.
2. **IAM e administrador → Contas de serviço → Criar conta de serviço**: nome `play-produtos`; pular os papéis
   → Concluir. Abrir a conta → **Chaves → Adicionar chave → Criar nova chave → JSON**. Salvar como
   `C:\Users\leona\chaves-android\play-api.json` (fora do git, junto da chave de upload; quem tem esse
   arquivo mexe nos produtos do app).
3. **Play Console → Usuários e permissões → Convidar novos usuários**: o e-mail da conta de serviço
   (`play-produtos@guardiao-da-floresta.iam.gserviceaccount.com`) → **Permissões do app** → Guardião da
   Floresta → **Gerenciar presença na loja** (inclui "Editar preços, produtos no app") → Convidar.
4. `npm run play:produtos -- listar`. Se responder 403, a permissão ainda não chegou (pode levar algumas horas).

## Versão nova pelo script

`npm run android:aab` gera o AAB; `npm run play:versao -- subir` o envia e cria a versão na faixa como
**rascunho**, com as notas dos 8 idiomas da seção "### X.Y.Z (código N)" deste arquivo (sem limite de 10 MB,
sem arrastar arquivo). Nada vai para revisão sozinho: 👤 no Console, abrir o rascunho → Avançar → Salvar e
publicar → Visão geral da publicação → Enviar mudanças para revisão.

```
npm run play:versao -- faixas                       # o que está em cada faixa (só leitura)
npm run play:versao -- subir --seco                 # confere arquivo, notas e faixa sem gravar
npm run play:versao -- subir                        # Teste fechado (alpha), rascunho
npm run play:versao -- subir --faixa=internal       # Teste interno (sem revisão do Google; minutos)
```

Este app grava as mudanças "enviando para revisão automaticamente" (a API recusa `changesNotSentForReview`);
o rascunho, mesmo assim, não é revisado nem chega a ninguém até ser publicado no Console.

## Novidades por notificação (Firebase Cloud Messaging)

Para avisar quem joga de **versão nova, evento (Dia do Saci) ou conteúdo novo**. No app (`src/systems/News.js`,
desde a 1.0.10): só para quem aceitou notificações; chave própria em **Opções › Jogo › Novidades** e canal
próprio no Android ("Novidades"), separados dos lembretes do baú e da colheita; o aparelho entra só no tópico
do seu idioma (`novidades_pt`, `_en`, `_es`, `_ja`, `_zh`, `_zht`) e sem aceite nem cria o token
(`firebase_messaging_auto_init_enabled = false`). Tocar na notificação abre o jogo e registra `news_open`.

Cada aviso é um JSON em `tools/play/avisos/` (id, `validade_dias`, `titulo` e `texto` nos 6 idiomas; título até
45 caracteres, texto até 160). O que já saiu fica em `tools/play/avisos/enviados.json` (commit junto).

```
npm run aviso -- conferir tools/play/avisos/<aviso>.json   # textos e tamanhos, sem rede
npm run aviso -- validar  tools/play/avisos/<aviso>.json   # o Google valida as 6 mensagens sem entregar
npm run aviso -- enviar   tools/play/avisos/<aviso>.json   # envia para os 6 tópicos e registra
```

**Regras (seguir sempre):** no máximo **1 aviso a cada 7 dias** (o script recusa; `--forcar` só com motivo);
nunca o mesmo aviso duas vezes; só novidade de verdade — nada de "volte a jogar", contagem regressiva, culpa ou
urgência falsa; texto revisado nos 6 idiomas como qualquer texto do jogo. Com o jogo aberto a notificação não
aparece (nunca no meio da partida). Teste: um aparelho só com `--token=<token> --idioma=pt`; enquanto a versão
com as novidades estiver só no Teste interno, o tópico só chega a quem está nele.

**Credencial (👤 uma vez):** a conta de serviço dos scripts (`play-produtos@guardiao-da-floresta.iam.gserviceaccount.com`)
precisa do papel **"Administrador da API Firebase Cloud Messaging"** no projeto `guardiao-da-floresta`:
<https://console.cloud.google.com/iam-admin/iam?project=guardiao-da-floresta> → na linha da conta, lápis
(Editar principal) → Adicionar outro papel → procurar "Firebase Cloud Messaging API Admin" → Salvar. Sem isso o
script responde 403 (`cloudmessaging.messages.create`). A API do FCM já está ativa no projeto.

**Segurança dos dados (👤 ao levar a 1.0.10 para o Alpha/produção):** em **IDs do dispositivo**, acrescentar
as finalidades **Funcionalidade do app** e **Comunicações do desenvolvedor** (o token do FCM entrega as
novidades). Nada mais muda (sem dado pessoal; o envio é o mesmo para todos de um idioma). A política
(`docs/PRIVACY.md`, seção "Novidades por notificação") já explica; copiar para o site como sempre.

## Kits de cosméticos (fase 2 dos cosméticos, `docs/COSMETICOS.md`)

Quatro **produtos únicos** (não consumíveis), cada um libera 3 peças do Guarda-roupa. Só aparência: não
mexem em dano, vida, moedas nem anúncios. Código pronto (`Billing.buyKit`, `npm run test:compra`); no build da
loja fica tudo desligado até `COSMETICS.ENABLED` e `COSMETICS.SHOP` (`src/config.js`) irem para `true`.

**Estado (19/10/2026):** os 4 kits e os 2 pacotes do Fundador estão **criados e ativos** no Console (8 idiomas, 174
países, opção `compra` compatível com versões anteriores; `kit_ipe` e `kit_paineira` à mão, os outros 4 pelo
script). Falta só o `pacote_apoiador` (01/02/2027). Credencial da API criada no mesmo dia (conta de serviço
`play-produtos@guardiao-da-floresta.iam.gserviceaccount.com`: ver informações, presença na loja, faixas de teste,
produção e avaliações; sem dados financeiros nem listas de testadores).

**Passo a passo à mão (👤, se não for pelo script):**
1. **Monetizar → Produtos → Produtos únicos → Criar**, um por kit, com os IDs **exatamente** iguais aos de
   `STORE.KITS` (não dá para mudar nem reaproveitar): `kit_ipe`, `kit_paineira`, `kit_coruja`, `kit_junina`.
2. Opção de compra: comprar. Preço: **R$ 4,90** no Brasil e **US$ 0,99** de base nos outros países (mesmo
   jeito do "Sem anúncios": editar em massa e depois o Brasil à mão). Ativar. (Por que esse preço:
   `docs/COSMETICOS.md`, "Estratégia de preços".)
3. Nome e descrição (nome ≤ 55, descrição ≤ 200; `es-419` vale para `es-ES`, `zh-TW` para `zh-HK`):

   | Idioma | Kit | Nome | Descrição |
   |---|---|---|---|
   | pt-BR | ipe | Kit Ipê-rosa | Pétalas de ipê ao libertar a mata, rastro de pétalas e o Despertar em rosa com um anel de ipês. Só aparência. |
   | pt-BR | paineira | Kit Paineira | O fruto da barriguda estala e solta painas, rastro de algodão e uma nuvem de algodão no Despertar. Só aparência. |
   | pt-BR | coruja | Kit Coruja-buraqueira | Uma corujinha voa de cada libertado, rastro de penas e asas de coruja no Despertar. Só aparência. |
   | pt-BR | junina | Kit Festa Junina | Bandeirinhas de chita, rastro de bandeirinhas e um arraiá em volta de você no Despertar. Só aparência. |
   | en-US | ipe | Pink Ipê Kit | Ipê petals when you free the forest, a petal trail and a pink Awakening with a ring of ipês. Looks only. |
   | en-US | paineira | Silk Floss Tree Kit | The pod cracks open and lets out floss, a cotton trail and a cotton cloud when you awaken. Looks only. |
   | en-US | coruja | Burrowing Owl Kit | A little owl flies out of everyone you free, a feather trail and owl wings when you awaken. Looks only. |
   | en-US | junina | Festa Junina Kit | Calico bunting flags, a flag trail and a June party around you when you awaken. Looks only. |
   | es-419 | ipe | Kit Ipê rosa | Pétalos de ipê al liberar el bosque, estela de pétalos y el Despertar rosa con un anillo de ipês. Solo apariencia. |
   | es-419 | paineira | Kit Palo borracho | El fruto se abre y suelta copos, estela de algodón y una nube de algodón en el Despertar. Solo apariencia. |
   | es-419 | coruja | Kit Lechucita vizcachera | Una lechucita sale volando de cada liberado, estela de plumas y alas en el Despertar. Solo apariencia. |
   | es-419 | junina | Kit Fiesta Junina | Banderines de chita, estela de banderines y una verbena a tu alrededor en el Despertar. Solo apariencia. |
   | ja-JP | ipe | ピンクのイペーセット | 解放するとイペーの花びらが舞い、花びらの軌跡、イペーの輪が咲くピンクの覚醒。見た目だけのアイテムです。 |
   | ja-JP | paineira | トックリキワタセット | 実がはじけて綿毛が舞い、綿毛の軌跡、覚醒で綿の雲が立ちのぼります。見た目だけのアイテムです。 |
   | ja-JP | coruja | アナホリフクロウセット | 解放した者から小さなフクロウが飛び立ち、羽根の軌跡、覚醒でフクロウの翼。見た目だけのアイテムです。 |
   | ja-JP | junina | フェスタ・ジュニーナセット | 花柄の小旗、小旗の軌跡、覚醒でまわりに村祭りが始まります。見た目だけのアイテムです。 |
   | zh-CN | ipe | 粉色风铃木套装 | 解放时飘落风铃木花瓣、花瓣拖尾，以及绽放一圈风铃木花的粉色觉醒。仅外观。 |
   | zh-CN | paineira | 美丽异木棉套装 | 果实裂开飘出棉絮、棉絮拖尾，以及觉醒时升起的棉絮之云。仅外观。 |
   | zh-CN | coruja | 穴鸮套装 | 被解放者身上飞出小猫头鹰、羽毛拖尾，以及觉醒时展开的猫头鹰之翼。仅外观。 |
   | zh-CN | junina | 六月节套装 | 花布彩旗、彩旗拖尾，以及觉醒时在你身边办起的六月庆典。仅外观。 |
   | zh-TW | ipe | 粉紅風鈴木套裝 | 解放時飄落風鈴木花瓣、花瓣拖尾，以及綻放一圈風鈴木花的粉色覺醒。僅外觀。 |
   | zh-TW | paineira | 美人樹套裝 | 果實裂開飄出棉絮、棉絮拖尾，以及覺醒時升起的棉絮之雲。僅外觀。 |
   | zh-TW | coruja | 穴鴞套裝 | 被解放者身上飛出小貓頭鷹、羽毛拖尾，以及覺醒時展開的貓頭鷹之翼。僅外觀。 |
   | zh-TW | junina | 六月節套裝 | 花布彩旗、彩旗拖尾，以及覺醒時在你身邊辦起的六月慶典。僅外觀。 |

4. **Segurança dos dados:** nada muda (o "Histórico de compras" já declarado cobre os kits e os pacotes).
5. Criar também os pacotes (abaixo), ligar `COSMETICS.ENABLED` e `COSMETICS.SHOP`, gerar a versão e testar no
   celular instalado pela loja: comprar um kit, estornar em **Pedidos** e voltar ao jogo ("COMPRA ESTORNADA" do
   kit), cartão "aprova com atraso" com o jogo aberto ("PAGAMENTO APROVADO"), reinstalar (os kits voltam).

## Pacotes (Fundador e Apoiador)

Também **produtos únicos**. O código (`STORE.PACKS`, `Billing.buyPack`) já sabe o que cada um libera; a Loja
mostra "Separado sai por" e "Você economiza N%" com os preços que a Play Store devolver em cada país.

| ID (exato) | Leva | Preço (Brasil · base) | Quando |
|---|---|---|---|
| `pacote_fundador` | Sem anúncios + 4 kits + Clareira Ancestral + insígnia | **R$ 19,90 · US$ 3,99** | do lançamento até 31/01/2027 |
| `pacote_fundador_kits` | 4 kits + Clareira Ancestral + insígnia (para quem já tem o Sem anúncios) | **R$ 9,90 · US$ 1,99** | idem |
| `pacote_apoiador` | Sem anúncios + 4 kits (sem exclusivos) | **R$ 24,90 · US$ 4,99** | criar só em 01/02/2027 |

👤 Passo a passo: criar os dois do Fundador junto com os kits; em **31/01/2027**, **desativar** os dois (não
apagar: quem comprou continua com eles) e **ativar** o `pacote_apoiador`. A Loja troca sozinha (produto
desativado não volta no `getProducts`). O "Só até 31 de jan. de 2027" na Loja vem de `COSMETICS.FOUNDER_UNTIL`.

Nome e descrição (nome ≤ 55, descrição ≤ 200):

| Idioma | ID | Nome | Descrição |
|---|---|---|---|
| pt-BR | fundador | Pacote Fundador | Sem anúncios, os 4 kits de cosméticos (12 peças), a Clareira Ancestral e a insígnia de Fundador, exclusivas. Só aparência; por tempo limitado. |
| pt-BR | fundador_kits | Pacote Fundador (sem o Sem anúncios) | Para quem já tem o Sem anúncios: os 4 kits de cosméticos (12 peças), a Clareira Ancestral e a insígnia de Fundador, exclusivas. Só aparência; por tempo limitado. |
| pt-BR | apoiador | Pacote Apoiador | Sem anúncios e os 4 kits de cosméticos (12 peças) por menos que separados. Só aparência; apoia um jogo independente feito no Brasil. |
| en-US | fundador | Founder Pack | No Ads, all 4 cosmetic kits (12 pieces), plus the exclusive Ancestral Clearing and Founder badge. Looks only; for a limited time. |
| en-US | fundador_kits | Founder Pack (without No Ads) | For players who already have No Ads: all 4 cosmetic kits (12 pieces), plus the exclusive Ancestral Clearing and Founder badge. Looks only; for a limited time. |
| en-US | apoiador | Supporter Pack | No Ads and all 4 cosmetic kits (12 pieces) for less than buying them separately. Looks only; supports an indie game made in Brazil. |
| es-419 | fundador | Pack Fundador | Sin anuncios, los 4 kits de cosméticos (12 piezas), el Claro Ancestral y la insignia de Fundador, exclusivos. Solo apariencia; por tiempo limitado. |
| es-419 | fundador_kits | Pack Fundador (sin el Sin anuncios) | Para quien ya tiene Sin anuncios: los 4 kits de cosméticos (12 piezas), el Claro Ancestral y la insignia de Fundador, exclusivos. Solo apariencia; por tiempo limitado. |
| es-419 | apoiador | Pack Colaborador | Sin anuncios y los 4 kits de cosméticos (12 piezas) por menos que por separado. Solo apariencia; apoya un juego independiente hecho en Brasil. |
| ja-JP | fundador | 創設者パック | 「広告なし」、コスメセット4つ（12点）、限定の「いにしえの広場」と創設者バッジ。見た目だけのアイテムです。期間限定。 |
| ja-JP | fundador_kits | 創設者パック（広告なしを除く） | 「広告なし」を購入済みの方へ：コスメセット4つ（12点）、限定の「いにしえの広場」と創設者バッジ。見た目だけのアイテムです。期間限定。 |
| ja-JP | apoiador | サポーターパック | 「広告なし」とコスメセット4つ（12点）を、別々に買うよりお得に。見た目だけのアイテムです。ブラジル生まれのインディーゲームを応援できます。 |
| zh-CN | fundador | 创始者礼包 | 免广告、全部 4 个外观套装（12 件），以及独家的远古空地和创始者徽章。仅外观；限时发售。 |
| zh-CN | fundador_kits | 创始者礼包（不含免广告） | 适合已拥有免广告的玩家：全部 4 个外观套装（12 件），以及独家的远古空地和创始者徽章。仅外观；限时发售。 |
| zh-CN | apoiador | 支持者礼包 | 免广告和全部 4 个外观套装（12 件），比单独购买更划算。仅外观；支持一款巴西制作的独立游戏。 |
| zh-TW | fundador | 創始者禮包 | 免廣告、全部 4 個外觀套裝（12 件），以及獨家的遠古空地和創始者徽章。僅外觀；限時販售。 |
| zh-TW | fundador_kits | 創始者禮包（不含免廣告） | 適合已擁有免廣告的玩家：全部 4 個外觀套裝（12 件），以及獨家的遠古空地和創始者徽章。僅外觀；限時販售。 |
| zh-TW | apoiador | 支持者禮包 | 免廣告和全部 4 個外觀套裝（12 件），比單獨購買更划算。僅外觀；支持一款巴西製作的獨立遊戲。 |

Testar no celular instalado pela loja (Teste de licença): comprar o Fundador (anúncios somem, os 4 kits e a
Clareira Ancestral aparecem), estornar em **Pedidos** (aviso diz o que saiu; o Sem anúncios avulso, se houver,
continua) e reinstalar (tudo volta).

## Próximos passos recomendados (pós-lançamento)

- Conquistas do Google Play Games (os ids de `ACHIEVEMENTS` já servem de chave).
