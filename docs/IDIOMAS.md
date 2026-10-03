# Idiomas

O jogo fala **português (Brasil), inglês, espanhol, japonês e chinês simplificado**.
Na primeira abertura ele usa o idioma do aparelho (idioma sem suporte = inglês); depois,
**Opções → Jogo → Idioma** (cada idioma aparece escrito nele mesmo; trocar recarrega o jogo,
o progresso fica).

## Como funciona

- **O português é o texto-fonte.** Todo texto visível no código passa por `tr()`:
  `tr("Jogar")`, `tr("Nível {0}", n)`. O próprio português é a chave do catálogo; sem tradução,
  aparece o português (nada quebra).
- **Fichas do `config.js`** (nomes, descrições, falas, conquistas…) não usam `tr()`: no fim do
  `config.js`, `localize([...])` traduz no lugar os campos de texto (`name`, `desc`, `text`,
  `label`, `role`, `origin`… — lista `TEXT_FIELDS` em `src/i18n/i18n.js`) antes de qualquer
  outro módulo ler. Ids e chaves (`"STAFF"`, `"kills"`) nunca são traduzidos.
- **Catálogos:** `src/i18n/{en,es,ja,zh}.js` — objeto `"português": "tradução"`.
- **Números:** `fmt(n)` (separador de milhar do idioma) e `dec(x)` (decimal com vírgula ou ponto).
- **Japonês e chinês:** fonte **Fusion Pixel 12px** (OFL) recortada só com os caracteres do jogo
  (`assets/fonts/FusionPixel-{ja,zh}.woff2`, ~40 KB cada), tamanhos na grade de 6 px (a fonte é
  desenhada em 12 px) e quebra de linha por caractere (`cjkWrap`), sem começar linha com
  pontuação de fechamento. A opção "Legível" só aumenta a letra nesses idiomas.
- **Nomes dos idiomas** no seletor (日本語, 简体中文) usam um recorte mínimo (`FusionPixel-langs`)
  carregado sempre, para aparecerem certos em qualquer idioma.
- **Fora do Phaser:** `index.html` ajusta `lang`, título da página e o aviso "gire o aparelho";
  o nome do app no Android vem de `android/app/src/main/res/values-*/strings.xml` (padrão em inglês).

## Escrevendo texto novo (regra)

1. Escreva em português dentro de `tr()`: `this._toast(tr("Baú aberto: {0}", nome))`.
   Use `{0}`, `{1}`… para valores — **nunca** concatene pedaços de frase
   (`"Você tem " + n + " moedas"` não traduz bem; a ordem das palavras muda em cada idioma).
2. Plural português: frases inteiras (`n > 1 ? tr("+{0} sementes") : tr("+1 semente")`). Nas
   missões diárias, `{s}` vira "s" no plural; japonês e chinês tiram o `{s}` da tradução.
3. Não envolva ids, nomes de textura, sons e eventos em `tr()`.
4. Campo de ficha no `config.js` com nome fora de `TEXT_FIELDS`? Acrescente o nome lá.

## Traduzindo o que falta

```bash
npm run check                                  # aponta textos sem tradução e fonte desatualizada
node tools/i18n.mjs missing en > falta.txt     # "N|texto" do que falta em inglês
# escreva traducao.txt com as mesmas linhas "N|tradução" (\n = quebra de linha)
node tools/i18n.mjs build en falta.txt traducao.txt
node tools/font-subset.mjs                     # depois de mexer em ja/zh (precisa de Python + fonttools + brotli)
```

`build` junta ao catálogo, mantém o que já existia e tira traduções de textos que saíram do
código. `check` também confere se `{0}`/`{n}` batem entre o português e a tradução.

## Adicionando um idioma

1. `src/i18n/xx.js` (catálogo vazio) e uma entrada em `LANGS` (`id`, nome no próprio idioma,
   `locale`) em `src/i18n/i18n.js`; importe o catálogo lá. Acrescente o id em `LANG_IDS`
   (`tools/i18n.mjs`) e na lista do script do `index.html`.
2. `node tools/i18n.mjs keys > textos.txt`, traduza, `build`.
3. Alfabeto sem glifo na Jersey 15 / Atkinson (cirílico, coreano…): faça um recorte da Fusion
   Pixel como o de ja/zh (`tools/font-subset.mjs`) e uma família em `Theme.js`.
4. `values-xx/strings.xml` no Android e textos da loja (`docs/PLAY_STORE.md`).

## Glossário

| Português | English | Español | 日本語 | 简体中文 |
|---|---|---|---|---|
| Podridão (o vilão) | the Rot | la Podredumbre | 腐敗 | 腐朽 |
| Clareira | the Clearing | el Claro | 広場 | 空地 |
| Perigo (dificuldade) | Danger | Peligro | 危険度 | 危险度 |
| Aprendiz · Guardião · Veterano · Implacável · Pesadelo | Apprentice · Guardian · Veteran · Relentless · Nightmare | Aprendiz · Guardián · Veterano · Implacable · Pesadilla | 見習い・守護者・歴戦・無慈悲・悪夢 | 学徒・守护者・老兵・无情・梦魇 |
| partida | run | partida | プレイ | 局 |
| moedas · Madeira Ancestral | coins · Ancestral Wood | monedas · Madera Ancestral | コイン・古代の木材 | 金币・远古木材 |
| Santuário · Forja · Fogueira · Mural | Shrine · Forge · Campfire · Board | Santuario · Forja · Hoguera · Mural | 祠・鍛冶場・焚き火・掲示板 | 神龛・锻造坊・篝火・告示板 |
| João-de-barro · Anciã · Samaúma | Hornero · Elder · Samaúma | Hornero · Anciana · Samaúma | カマドドリ・長老・サマウーマ | 灶鸟・长老・萨马乌玛树 |
| Bênção · Despertar · Dash | Blessing · Awakening · Dash | Bendición · Despertar · Impulso | 祝福・覚醒・ダッシュ | 祝福・觉醒・冲刺 |
| Vapor · Cristal · Sobrecarga | Steam · Crystal · Overload | Vapor · Cristal · Sobrecarga | 蒸気・結晶・過負荷 | 蒸汽・结晶・超载 |
| Labareda · Geada · Temporal | Blaze · Frost · Tempest | Llamarada · Escarcha · Temporal | 烈火・霜・嵐 | 烈焰・寒霜・风暴 |
| Fogo · Gelo · Raio · Vento | Fire · Ice · Lightning · Wind | Fuego · Hielo · Rayo · Viento | 炎・氷・雷・風 | 火・冰・雷・风 |
| Laço (combo de armas) · Trato da Mata | Link · Forest Pact | Vínculo · Pacto de la Selva | 絆・森の契約 | 羁绊・森林契约 |
| minichefe · chefe | miniboss · boss | minijefe · jefe | 中ボス・ボス | 小头目・头目 |

**Lendas:** os nomes ficam em português no inglês e no espanhol (Curupira, Caipora, Iara, Saci,
Mapinguari, Boitatá, Anhangá, Corpo-Seco, Caboclo d'Água, Comadre Fulozinha, Cabra Cabriola),
com duas exceções de sentido claro: **Mula sem Cabeça** (Headless Mule / Mula sin Cabeza) e
**Mãe-do-Ouro** (Mother of Gold / Madre del Oro). Em japonês ficam em katakana (クルピラ,
マピングアリ…) e em chinês transliteradas (库鲁皮拉, 马品瓜里…), exceto as de sentido claro
(首なしラバ / 无头骡, 黄金の母 / 黄金之母, 干尸 para Corpo-Seco). As origens (tupi, guarani,
ibérica) são mantidas nas descrições — ver `TEMA_FOLCLORE.md`.

👤 **Revisão por falantes nativos** (principalmente japonês e chinês) antes do lançamento nesses
mercados: as traduções foram feitas com cuidado, mas um nativo pega tom e termos de jogo.
