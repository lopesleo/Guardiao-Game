// Configuração do servidor oficial no Discord (lida por setup.mjs). Tudo por nome: rodar de novo
// ajusta o que mudou, sem duplicar. Textos em português (o público do servidor é o brasileiro).
export const SERVIDOR = "Guardião da Floresta";
export const SITE = "https://lopesleo.github.io/guardiao/?utm_source=discord";
export const CONVITE_TESTE = "https://play.google.com/apps/testing/com.lopesleo.guardiao";

// cores da paleta do jogo (src/art/Palette.js)
export const COR = { ouro: 0xf2c14e, folha: 0x9ccf62, vento: 0x7fd9bd, gelo: 0x5cc8ff, fogo: 0xff7a3c, perigo: 0xe8434f };

export const CARGOS = {
  Guardião: { cor: COR.ouro, separado: true },
  Testador: { cor: COR.folha, separado: true },
  Novidades: { cor: COR.vento, separado: false },
};

// tipo: texto | voz | forum | anuncios.  leitura: só a equipe escreve.  privado: só os cargos listados veem
export const CATEGORIAS = [
  {
    nome: "INÍCIO", leitura: true,
    canais: [
      { nome: "boas-vindas", tipo: "texto", topico: "Comece por aqui." },
      { nome: "regras", tipo: "texto", topico: "As regras da Clareira." },
      { nome: "avisos", tipo: "anuncios", topico: "Novidades, versões e datas do Guardião da Floresta." },
      { nome: "como-testar", tipo: "texto", topico: "Como entrar no teste fechado na Google Play (Android)." },
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
    nome: "TESTE FECHADO", privado: ["Testador", "Guardião"],
    canais: [{ nome: "testadores", tipo: "texto", topico: "Conversa entre quem está no teste fechado." }],
  },
  { nome: "VOZ", canais: [{ nome: "Fogueira", tipo: "voz" }] },
  {
    nome: "EQUIPE", privado: ["Guardião"],
    canais: [{ nome: "moderação", tipo: "texto", topico: "Avisos do Discord para a equipe e registro de moderação." }],
  },
];

// Mensagens fixas (o bot publica e fixa; rodar de novo edita a mesma mensagem)
export const MENSAGENS = {
  "boas-vindas": {
    imagem: "videos/promo/entrega/social/post_01_capa.png",
    embeds: [{
      title: "Bem-vindo à Clareira! 🌳",
      color: COR.folha,
      description:
        "**Guardião da Floresta** é um roguelite para Android com as lendas do folclore brasileiro.\n" +
        "Você só se move, as armas atacam sozinhas e os elementos se misturam: **Fogo + Gelo = Vapor**.\n\n" +
        "Aqui as lendas são as heroínas. O vilão é a Podridão.",
      fields: [
        { name: "Por onde começar", value: "• Leia as <#regras>\n• Quer jogar antes de todo mundo? Veja <#como-testar>\n• Novidades saem em <#avisos>" },
        { name: "Participe", value: "• Achou um bug? Abra um tópico em <#bugs>\n• Tem uma ideia? Mande em <#sugestões>\n• Mostre suas partidas em <#prints-e-clipes>" },
      ],
      image: "post_01_capa.png",
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
        "**6.** Respeite a idade mínima do Discord (13 anos).\n\n" +
        "A equipe (cargo **Guardião**) pode apagar mensagens e remover quem descumprir as regras.",
    }],
  },
  "como-testar": {
    embeds: [{
      title: "Como entrar no teste fechado",
      color: COR.gelo,
      description:
        "O jogo está em **teste fechado na Google Play** (só Android).\n\n" +
        "**1.** Mande o e-mail da sua conta Google (a do celular) para a equipe, por mensagem aqui ou pelo botão da página do jogo.\n" +
        "**2.** Quando avisarmos que você entrou na lista, aceite o convite no botão abaixo.\n" +
        "**3.** Instale pela Play e deixe o jogo no celular por pelo menos **14 dias**. Uma partida de vez em quando já ajuda muito.\n\n" +
        "Quem testa ganha o cargo **Testador** e o canal <#testadores>. Obrigado por ajudar a lenda a chegar na loja!",
    }],
    botoes: [{ texto: "Aceitar o convite do teste", url: CONVITE_TESTE }, { texto: "Página do jogo", url: SITE }],
  },
  avisos: {
    embeds: [{
      title: "A Clareira abriu! 🔥",
      color: COR.fogo,
      description:
        "Este é o servidor oficial do **Guardião da Floresta**. Aqui saem as novidades, as datas e as versões de teste antes de qualquer outro lugar.\n\n" +
        "**Agora:** teste fechado na Google Play. Precisamos de mais testadores Android: veja <#como-testar>.\n" +
        "**Lançamento planejado:** 03/12/2026.\n\n" +
        "Quer ser avisado de cada novidade? Pegue o cargo **Novidades** em *Canais e cargos*.",
    }],
  },
};

// Tela de boas-vindas (aparece para quem entra pelo convite)
export const BOAS_VINDAS = {
  descricao: "Roguelite brasileiro com as lendas do folclore. Novidades, teste fechado, bugs e sugestões.",
  canais: [
    { canal: "regras", texto: "Leia as regras", emoji: "📜" },
    { canal: "como-testar", texto: "Jogue antes de todo mundo", emoji: "🧪" },
    { canal: "avisos", texto: "Novidades e versões", emoji: "📣" },
    { canal: "sugestões", texto: "Mande sua ideia", emoji: "💡" },
    { canal: "bugs", texto: "Relate um problema", emoji: "🐛" },
  ],
};

// Integração (perguntas na entrada). O cargo Testador é dado pela equipe, não por escolha própria.
export const INTEGRACAO = {
  padrao: ["boas-vindas", "regras", "avisos", "como-testar", "geral", "prints-e-clipes", "builds-e-reações", "sugestões", "bugs", "Fogueira"],
  perguntas: [
    {
      titulo: "O que te trouxe à Clareira?", multipla: true, obrigatoria: false,
      opcoes: [
        { titulo: "Quero testar o jogo", descricao: "Teste fechado no Android", emoji: "🧪", canais: ["como-testar"] },
        { titulo: "Tenho ideias para o jogo", emoji: "💡", canais: ["sugestões"] },
        { titulo: "Achei um bug", emoji: "🐛", canais: ["bugs"] },
        { titulo: "Quero mostrar minhas partidas", emoji: "🎮", canais: ["prints-e-clipes", "builds-e-reações"] },
      ],
    },
    {
      titulo: "Quer ser avisado de cada novidade?", multipla: false, obrigatoria: false,
      opcoes: [
        // pergunta opcional: quem não quer, só não marca (o Discord exige cargo ou canal em toda opção)
        { titulo: "Sim, me avise", descricao: "Ganha o cargo Novidades (marcado nos avisos)", emoji: "📣", cargos: ["Novidades"] },
      ],
    },
  ],
};
