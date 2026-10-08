// Cria a CHAVE de assinatura do app (uma vez na vida do jogo) e o android/keystore.properties
// que o Gradle usa para assinar o APK/AAB de loja.
// Uso (num terminal de verdade, para digitar a senha):
//   npm run android:chave                          → guarda em C:\Users\<você>\chaves-android\
//   npm run android:chave -- D:\chaves\guardiao.jks → guarda onde você escolher (fora do projeto)
// Sem a chave e a senha não dá para lançar atualização: faça backup dos dois.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, relative, isAbsolute } from "node:path";
import readline from "node:readline";
import { Writable } from "node:stream";

const home = process.env.USERPROFILE || process.env.HOME || "";
const MS_JDKS = "C:\\Program Files\\Microsoft";
const jdk21 = existsSync(MS_JDKS) && readdirSync(MS_JDKS).filter((d) => d.startsWith("jdk-21")).sort().pop();
const JAVA_HOME = process.env.JAVA21_HOME || (jdk21 ? join(MS_JDKS, jdk21) : process.env.JAVA_HOME || "");
const KEYTOOL = join(JAVA_HOME, "bin", process.platform === "win32" ? "keytool.exe" : "keytool");
const PROPS = join("android", "keystore.properties");
const ALIAS = "upload"; // a chave de ENVIO da Play (a oficial do app fica com o Google: Play App Signing)

const fail = (msg) => {
  console.error("\n✗ " + msg);
  process.exit(1);
};
if (!existsSync(KEYTOOL)) fail(`Não achei o keytool do Java 21 em ${KEYTOOL}. Defina JAVA21_HOME.`);

const keyPath = resolve(process.argv[2] || join(home, "chaves-android", "guardiao-upload.jks"));
const rel = relative(process.cwd(), keyPath);
if (!rel.startsWith("..") && !isAbsolute(rel)) fail("Guarde a chave FORA da pasta do jogo (a pasta pode ser copiada, zipada ou enviada).");
if (existsSync(keyPath)) fail(`Já existe uma chave em ${keyPath}. Não vou sobrescrever: perder a chave antiga impede atualizar o app.`);
if (existsSync(PROPS)) fail(`${PROPS} já existe (a chave já foi configurada). Apague-o só se souber o que está fazendo.`);

// pergunta no terminal; com hidden, o que se digita não aparece na tela
async function ask(question, hidden = false) {
  let muted = false;
  const out = new Writable({
    write(chunk, enc, cb) {
      if (!muted) process.stdout.write(chunk, enc);
      cb();
    },
  });
  const rl = readline.createInterface({ input: process.stdin, output: out, terminal: true });
  const answer = new Promise((res) =>
    rl.question(question, (a) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      res(a);
    }),
  );
  muted = hidden;
  return answer;
}

// o formato da chave (PKCS12) só aceita senha ASCII: letras sem acento, números e símbolos
function checkPass(p) {
  if (p.length < 8) fail("Senha curta demais (mínimo 8 caracteres).");
  if (!/^[\x20-\x7e]+$/.test(p)) fail("Use na senha só letras SEM acento (nada de ç, é, ã…), números e símbolos.");
}

let name, pass;
if (process.stdin.isTTY) {
  console.log("Criando a chave de assinatura do Guardião da Floresta.");
  console.log(`Arquivo: ${keyPath}\n`);
  name = (await ask("Seu nome (vai no certificado): ")).trim();
  pass = await ask("Senha (mín. 8 caracteres, SEM acento; não aparece ao digitar): ", true);
  checkPass(pass);
  if ((await ask("Repita a senha: ", true)) !== pass) fail("As senhas não batem.");
} else {
  // sem terminal (automação/teste): lê das variáveis de ambiente
  name = process.env.GUARDIAO_CHAVE_NOME;
  pass = process.env.GUARDIAO_CHAVE_SENHA;
  if (!name || !pass) fail("Rode num terminal (PowerShell) para digitar nome e senha.");
  checkPass(pass);
}
name = (name || "Guardiao").replace(/[,+="<>#;\\]/g, " ").replace(/\s+/g, " ").trim() || "Guardiao";

mkdirSync(dirname(keyPath), { recursive: true });
// a senha vai por variável de ambiente (não aparece na lista de processos)
const r = spawnSync(
  KEYTOOL,
  ["-genkeypair", "-keystore", keyPath, "-storetype", "PKCS12", "-alias", ALIAS, "-keyalg", "RSA", "-keysize", "2048",
   "-validity", "10000", "-dname", `CN=${name}, O=Guardiao da Floresta, C=BR`, "-storepass:env", "GUARDIAO_PASS", "-keypass:env", "GUARDIAO_PASS"],
  { stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, GUARDIAO_PASS: pass } },
);
if (r.status !== 0 || !existsSync(keyPath)) fail("O keytool não conseguiu criar a chave.");

// .properties: barra invertida é escape e espaço no começo some
const esc = (v) => v.replace(/\\/g, "\\\\").replace(/^ /, "\\ ");
writeFileSync(
  PROPS,
  [
    "# Assinatura do app (NAO vai para o git). Criado por npm run android:chave.",
    `storeFile=${keyPath.replace(/\\/g, "/")}`,
    `storePassword=${esc(pass)}`,
    `keyAlias=${ALIAS}`,
    `keyPassword=${esc(pass)}`,
    "",
  ].join("\n"),
  "latin1",
);

console.log(`
✓ Chave criada: ${keyPath}
✓ Configuração: ${PROPS} (fora do git)

FAÇA BACKUP AGORA, em dois lugares (ex.: pen drive + Google Drive):
  • o arquivo ${keyPath}
  • a senha (num gerenciador de senhas)
Sem eles não dá para lançar atualização do jogo.

Próximo passo: npm run android:apk   (APK para instalar/testar)
               npm run android:aab   (AAB para a Play Store)`);
