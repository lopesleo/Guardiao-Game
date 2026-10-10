// Configuração do servidor oficial no Discord (lida por setup.mjs). Tudo por nome: rodar de novo
// ajusta o que mudou, sem duplicar. Textos em português (o público do servidor é o brasileiro).
// Nos textos, :nome: vira o emoji do servidor (arte/emoji/nome.png) e <#canal> vira a menção do canal.
export const SERVIDOR = "Guardião da Floresta";
export const SITE = "https://lopesleo.github.io/guardiao/?utm_source=discord";
export const CONVITE_TESTE = "https://play.google.com/apps/testing/com.lopesleo.guardiao";

// cores da paleta do jogo (src/art/Palette.js)
export const COR = {
  ouro: 0xf2c14e, folha: 0x9ccf62, vento: 0x7fd9bd, gelo: 0x5cc8ff, fogo: 0xff7a3c, perigo: 0xe8434f,
  palha: 0xe3c37e, ourovivo: 0xf6dd8c, raio: 0xc78cff,
};

// Ordem = hierarquia (de cima para baixo). "antes": nome antigo, para renomear sem recriar.
// A cor do nome na lista vem do cargo mais alto: equipe e testadores por cima das lendas.
export const CARGOS = [
  { nome: "Equipe", antes: "Guardião", cor: COR.ouro, separado: true },
  { nome: "Testador", cor: COR.folha, separado: true },
  // lenda favorita (escolhida na entrada): a cor é a do elemento da arma inicial de cada uma
  { nome: "Curupira", cor: COR.fogo, emoji: "curupira" },
  { nome: "Caipora", cor: COR.palha, emoji: "caipora" },
  { nome: "Iara", cor: COR.gelo, emoji: "iara" },
  { nome: "Saci", cor: COR.vento, emoji: "saci" },
  { nome: "Comadre Fulozinha", cor: COR.folha, emoji: "fulozinha" },
  { nome: "Mãe-do-Ouro", cor: COR.ourovivo, emoji: "maedoouro" },
  { nome: "Anhangá", cor: COR.raio, emoji: "anhanga" },
  { nome: "Novidades", cor: COR.vento },
];
export const EQUIPE = "Equipe";

// tipo: texto | voz | forum | anuncios.  leitura: só a equipe escreve.  privado: só os cargos listados veem
export const CATEGORIAS = [
  {
    nome: "INÍCIO", leitura: true,
    canais: [
      { nome: "boas-vindas", tipo: "texto", topico: "Comece por aqui." },
      { nome: "regras", tipo: "texto", topico: "As regras da Clareira." },
      { nome: "avisos", tipo: "anuncios", topico: "Novidades, versões e datas do Guardião da Floresta." },
      { nome: "como-testar", tipo: "texto", topico: "Como entrar no teste fechado na Google Play (Android)." },
      { nome: "perguntas-frequentes", tipo: "texto", topico: "Preço, iPhone, idiomas, anúncios, lançamento e mais." },
    ],
  },
  {
    nome: "A CLAREIRA",
    canais: [
      { nome: "geral", tipo: "texto", topico: "Conversa sobre o jogo e o folclore brasileiro." },
      { nome: "prints-e-clipes", tipo: "texto", topico: "Mostre suas melhores partidas: prints e vídeos." },
      { nome: "builds-e-reações", tipo: "texto", topico: "Combos de armas, evoluções e reações elementais." },
      { nome: "sugestões", tipo: "forum" },
      { nome: "bugs", tipo: "forum" },
    ],
  },
  {
    nome: "TESTE FECHADO", privado: ["Testador", "Equipe"],
    canais: [{ nome: "testadores", tipo: "texto", topico: "Conversa entre quem está no teste fechado." }],
  },
  { nome: "VOZ", canais: [{ nome: "Fogueira", tipo: "voz" }] },
  {
    nome: "EQUIPE", privado: ["Equipe"],
    canais: [{ nome: "moderação", tipo: "texto", topico: "Avisos do Discord para a equipe e registro de moderação." }],
  },
];

const RODAPE = "Guardião da Floresta · roguelite com as lendas do folclore brasileiro";

// Mensagens fixas (o bot publica e fixa; rodar de novo edita a mesma mensagem)
export const MENSAGENS = {
  "boas-vindas": {
    imagem: "videos/promo/entrega/social/post_01_capa.png",
    embeds: [{
      title: "Bem-vindo à Clareira!",
      color: COR.folha,
      description:
        "**Guardião da Floresta** é um roguelite para Android com as lendas do folclore brasileiro.\n" +
        "Você só se move, as armas atacam sozinhas e os elementos se misturam: :fogo: **Fogo** + :gelo: **Gelo** = :vapor: **Vapor**.\n\n" +
        ":curupira: :caipora: :iara: :saci: :fulozinha: :maedoouro: :anhanga:\n" +
        "Aqui as lendas são as heroínas. O vilão é a Podridão.",
      fields: [
        { name: "Por onde começar", value: ":estrela: Leia as <#regras>\n:bau: Quer jogar antes de todo mundo? Veja <#como-testar>\n:vagalume: Novidades saem em <#avisos>\n:ampulheta: Dúvidas: <#perguntas-frequentes>" },
        { name: "Participe", value: ":caveira: Achou um bug? Abra um tópico em <#bugs>\n:semente: Tem uma ideia? Mande em <#sugestões>\n:trofeu: Mostre suas partidas em <#prints-e-clipes>\n:fogueira: Bate-papo na <#Fogueira>" },
      ],
      image: "post_01_capa.png",
      footer: RODAPE,
    }],
    botoes: [{ texto: "Página do jogo", url: SITE }],
  },
  regras: {
    embeds: [{
      title: "Regras da Clareira",
      color: COR.ouro,
      description:
        "**1.** Respeito com todo mundo. Sem ofensa, preconceito ou assédio.\n" +
        "**2.** Nada de conteúdo adulto, violento ou ilegal.\n" +
        "**3.** Sem spam nem divulgação de outros servidores sem combinar com a equipe.\n" +
        "**4.** Spoilers de chefes e segredos: use ||spoiler||.\n" +
        "**5.** Bugs e sugestões nos fóruns certos, um tópico por assunto.\n" +
        "**6.** Respeite a idade mínima do Discord (13 anos).\n" +
        "**7.** As lendas são patrimônio de povos e regiões do Brasil: fale delas com respeito.\n\n" +
        ":escudo: A **Equipe** pode apagar mensagens e remover quem descumprir as regras. Viu algo errado? Clique com o botão direito na mensagem → *Apps* → *Denunciar*, ou chame a Equipe.",
      footer: RODAPE,
    }],
  },
  "como-testar": {
    embeds: [{
      title: "Como entrar no teste fechado",
      color: COR.gelo,
      description:
        "O jogo está em **teste fechado na Google Play** (só Android).\n\n" +
        "**1.** Mande o e-mail da sua conta Google (a do celular) para a Equipe, por mensagem aqui ou pelo botão da página do jogo.\n" +
        "**2.** Quando avisarmos que você entrou na lista, aceite o convite no botão abaixo.\n" +
        "**3.** Instale pela Play e deixe o jogo no celular por pelo menos **14 dias**. Uma partida de vez em quando já ajuda muito.\n\n" +
        ":bau: Quem testa ganha o cargo **Testador** e o canal <#testadores>. Obrigado por ajudar a lenda a chegar na loja!",
      footer: RODAPE,
    }],
    botoes: [{ texto: "Aceitar o convite do teste", url: CONVITE_TESTE }, { texto: "Página do jogo", url: SITE }],
  },
  "perguntas-frequentes": {
    embeds: [{
      title: "Perguntas frequentes",
      color: COR.ourovivo,
      fields: [
        { name: ":moeda: Quanto custa?", value: "Nada. É grátis de verdade: sem energia, sem gacha, e anúncio só se você quiser (em troca de um prêmio, nunca no meio da ação)." },
        { name: ":dash: Tem para iPhone?", value: "Por enquanto só Android (Google Play). Se tiver um Android em casa, dá para testar com a conta Google dele." },
        { name: ":ampulheta: Quando lança?", value: "Lançamento planejado para **03/12/2026**. Até lá, o teste fechado está aberto: <#como-testar>." },
        { name: ":estrela: Em que idiomas?", value: "Português, inglês, espanhol, japonês e chinês (simplificado e tradicional)." },
        { name: ":fogueira: Precisa de internet?", value: "Não. Dá para jogar offline, no ônibus, no metrô ou sem sinal." },
        { name: ":escudo: Roda no meu celular?", value: "Android 7 ou mais novo. A qualidade gráfica se ajusta sozinha ao aparelho." },
        { name: ":curupira: Quem faz o jogo?", value: "A Komedy Games Studio, de Nova Friburgo (RJ). Toda a arte e a música são feitas por código." },
      ],
      footer: RODAPE,
    }],
    botoes: [{ texto: "Página do jogo", url: SITE }],
  },
  avisos: {
    embeds: [{
      title: "A Clareira abriu!",
      color: COR.fogo,
      description:
        ":fogueira: Este é o servidor oficial do **Guardião da Floresta**. Aqui saem as novidades, as datas e as versões de teste antes de qualquer outro lugar.\n\n" +
        "**Agora:** teste fechado na Google Play. Precisamos de mais testadores Android: veja <#como-testar>.\n" +
        "**31/10, Dia do Saci:** conversa na <#Fogueira>, veja em *Eventos*. :saci:\n" +
        "**Lançamento planejado:** 03/12/2026.\n\n" +
        "Quer ser avisado de cada novidade? Pegue o cargo **Novidades** em *Canais e cargos*.",
      footer: RODAPE,
    }],
  },
};

// Tela de boas-vindas (para quem entra pelo convite). emoji: nome de emoji do servidor ou um emoji comum
export const BOAS_VINDAS = {
  descricao: "Roguelite brasileiro com as lendas do folclore. Novidades, teste fechado, bugs e sugestões.",
  canais: [
    { canal: "regras", texto: "Leia as regras", emoji: "estrela" },
    { canal: "como-testar", texto: "Jogue antes de todo mundo", emoji: "bau" },
    { canal: "avisos", texto: "Novidades e versões", emoji: "vagalume" },
    { canal: "sugestões", texto: "Mande sua ideia", emoji: "semente" },
    { canal: "bugs", texto: "Relate um problema", emoji: "caveira" },
  ],
};

// Integração (perguntas na entrada). O cargo Testador é dado pela Equipe, não por escolha própria.
export const INTEGRACAO = {
  padrao: ["boas-vindas", "regras", "avisos", "como-testar", "perguntas-frequentes", "geral", "prints-e-clipes", "builds-e-reações", "sugestões", "bugs", "Fogueira"],
  perguntas: [
    {
      titulo: "Qual lenda você escolheria?", multipla: false, obrigatoria: false,
      opcoes: CARGOS.filter((c) => c.emoji).map((c) => ({ titulo: c.nome, emoji: c.emoji, cargos: [c.nome] })),
    },
    {
      titulo: "O que te trouxe à Clareira?", multipla: true, obrigatoria: false,
      opcoes: [
        { titulo: "Quero testar o jogo", descricao: "Teste fechado no Android", emoji: "bau", canais: ["como-testar"] },
        { titulo: "Tenho ideias para o jogo", emoji: "semente", canais: ["sugestões"] },
        { titulo: "Achei um bug", emoji: "caveira", canais: ["bugs"] },
        { titulo: "Quero mostrar minhas partidas", emoji: "trofeu", canais: ["prints-e-clipes", "builds-e-reações"] },
      ],
    },
    {
      titulo: "Quer ser avisado de cada novidade?", multipla: false, obrigatoria: false,
      // pergunta opcional: quem não quer, só não marca (o Discord exige cargo ou canal em toda opção)
      opcoes: [{ titulo: "Sim, me avise", descricao: "Ganha o cargo Novidades (marcado nos avisos)", emoji: "vagalume", cargos: ["Novidades"] }],
    },
  ],
};

// Arte (gerada por arte.py a partir do jogo)
export const FIGURINHAS = {
  Curupira: { tag: "🔥", descricao: "O guardião da mata, de pés virados" },
  Saci: { tag: "🌪️", descricao: "Redemoinho travesso, pulando numa perna só" },
  Iara: { tag: "🌊", descricao: "A senhora das águas" },
  "Anhangá": { tag: "🦌", descricao: "O cervo branco que protege a caça" },
  Mapinguari: { tag: "👹", descricao: "O chefe final, tomado pela Podridão" },
};
export const SONS = {
  "Grito do Mapinguari": { arquivo: "sfx_boss_roar", emoji: "👹", volume: 0.8 },
  "Assobio do Saci": { arquivo: "sfx_assobio", emoji: "🌪️", volume: 0.8 },
  "VAPOR!": { arquivo: "sfx_react_vapor", emoji: "☁️", volume: 0.8 },
  "SOBRECARGA!": { arquivo: "sfx_react_overload", emoji: "⚡", volume: 0.8 },
  "Subiu de nível": { arquivo: "sfx_levelup", emoji: "⭐", volume: 0.7 },
  "Baú premiado": { arquivo: "sfx_chest_jackpot", emoji: "🎁", volume: 0.7 },
  "Galope da Mula": { arquivo: "sfx_hooves", emoji: "🔥", volume: 0.8 },
  Carranca: { arquivo: "sfx_carranca", emoji: "🗿", volume: 0.8 },
};

// Eventos agendados (horário de Brasília). Um por mês, como o guia do Discord recomenda.
export const EVENTOS = [
  {
    nome: "Dia do Saci na Fogueira",
    canal: "Fogueira",
    inicio: "2026-10-31T19:00:00-03:00",
    fim: "2026-10-31T20:00:00-03:00",
    capa: "evento_dia_do_saci.png",
    descricao:
      "31 de outubro é o Dia do Saci! Conversa ao vivo com o desenvolvedor na Fogueira: como o Saci virou guardião no jogo, " +
      "bastidores da arte feita por código e o que vem até o lançamento. Traga suas perguntas.",
  },
];
