// Chame um amigo — o toque nos botões (Clareira, Créditos, ranking): abre a folha de compartilhar (systems/Invite.js)
// e responde com um aviso curto que some sozinho (link copiado, obrigado, não deu). Nenhuma janela no caminho.
import { Invite } from "../systems/Invite.js";
import { cloudToast } from "./CloudSaveUI.js";
import { tr } from "../i18n/i18n.js";

export async function inviteFriend(scene, from, brag) {
  const r = await Invite.send(from, brag);
  if (!scene.sys?.isActive()) return r;
  const msg = { copied: tr("Link copiado! Cole numa conversa com seu amigo."), shared: tr("A mata agradece!"), fail: tr("Não deu para compartilhar agora.") }[r];
  if (msg) cloudToast(scene, msg);
  return r;
}
