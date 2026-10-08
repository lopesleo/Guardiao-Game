// Gera o app ASSINADO com a sua chave (crie antes com `npm run android:chave`).
//   npm run android:apk  → APK para instalar à mão / mandar a amigos (anúncios de TESTE)
//   npm run android:aab  → AAB para a Play Store (anúncios de VERDADE)
// Para inverter: `npm run android:apk -- --anuncios-reais` ou `npm run android:aab -- --anuncios-teste`.
// O arquivo final vai para dist/ com versão e tipo de anúncio no nome.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const kind = process.argv[2];
if (kind !== "apk" && kind !== "aab") {
  console.error("Uso: node tools/android-release.mjs apk|aab [--anuncios-reais|--anuncios-teste]");
  process.exit(1);
}
const real = process.argv.includes("--anuncios-reais") || (kind === "aab" && !process.argv.includes("--anuncios-teste"));

const home = process.env.USERPROFILE || process.env.HOME || "";
const MS_JDKS = "C:\\Program Files\\Microsoft";
const jdk21 = existsSync(MS_JDKS) && readdirSync(MS_JDKS).filter((d) => d.startsWith("jdk-21")).sort().pop();
const JAVA_HOME = process.env.JAVA21_HOME || (jdk21 ? join(MS_JDKS, jdk21) : process.env.JAVA_HOME || "");
const SDK = process.env.ANDROID_HOME || join(home, "AppData", "Local", "Android", "Sdk");
const env = { ...process.env, JAVA_HOME, ANDROID_HOME: SDK };
const win = process.platform === "win32";
const PROPS = join("android", "keystore.properties");

const fail = (msg) => {
  console.error("\n✗ " + msg);
  process.exit(1);
};
if (!existsSync(JAVA_HOME)) fail(`Não achei o Java 21 em ${JAVA_HOME}. Defina JAVA21_HOME.`);
if (!existsSync(SDK)) fail(`Não achei o Android SDK em ${SDK}. Defina ANDROID_HOME.`);
if (!existsSync(PROPS)) fail("Falta a chave de assinatura. Crie uma vez com:  npm run android:chave");
const storeFile = /^storeFile=(.+)$/m.exec(readFileSync(PROPS, "latin1"))?.[1]?.trim();
if (!storeFile || !existsSync(storeFile)) fail(`A chave indicada em ${PROPS} não está em ${storeFile}. Recoloque o arquivo (do backup) nesse lugar.`);

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", env, shell: win && !cmd.endsWith(".exe"), ...opts });
  if (r.status !== 0) fail(`Falhou: ${cmd} ${args.join(" ")}`);
  return r;
};

// 1) jogo → www/ (com o tipo de anúncio certo) → projeto Android
run("node", ["tools/build-www.mjs"], { env: { ...env, GUARDIAO_ADS: real ? "real" : "teste" } });
run("npx", ["cap", "sync", "android"]);

// 2) compila o release assinado
const task = kind === "apk" ? "assembleRelease" : "bundleRelease";
run(join(process.cwd(), "android", win ? "gradlew.bat" : "gradlew"), [task, "--console=plain"], { cwd: "android" });
const out = kind === "apk"
  ? join("android", "app", "build", "outputs", "apk", "release", "app-release.apk")
  : join("android", "app", "build", "outputs", "bundle", "release", "app-release.aab");
if (!existsSync(out)) fail(`O Gradle terminou mas não achei ${out}.`);

// 3) confere a assinatura
let signer = "";
if (kind === "apk") {
  const bt = join(SDK, "build-tools");
  const ver = existsSync(bt) && readdirSync(bt).sort().pop();
  const apksigner = ver && join(bt, ver, win ? "apksigner.bat" : "apksigner");
  if (apksigner && existsSync(apksigner)) {
    const r = spawnSync(apksigner, ["verify", "--print-certs", out], { env, shell: win, encoding: "utf8" });
    if (r.status !== 0) fail("O APK saiu SEM assinatura válida:\n" + r.stdout + r.stderr);
    signer = /certificate DN: (.+)/.exec(r.stdout)?.[1] ?? "";
  }
} else {
  const r = spawnSync(join(JAVA_HOME, "bin", win ? "jarsigner.exe" : "jarsigner"), ["-verify", out], { env, encoding: "utf8" });
  if (!/jar verified/.test(r.stdout)) fail("O AAB saiu SEM assinatura válida:\n" + r.stdout + r.stderr);
  signer = "ok";
}

// 4) copia para dist/ com um nome que diz o que é
const gradle = readFileSync(join("android", "app", "build.gradle"), "utf8");
const vName = /versionName\s+"([^"]+)"/.exec(gradle)?.[1] ?? "x";
const vCode = /versionCode\s+(\d+)/.exec(gradle)?.[1] ?? "0";
mkdirSync("dist", { recursive: true });
const final = join("dist", `guardiao-v${vName}-${vCode}-${real ? "anuncios-reais" : "anuncios-teste"}.${kind}`);
copyFileSync(out, final);

console.log(`
✓ ${kind.toUpperCase()} assinado: ${final}
  versão ${vName} (código ${vCode}) · anúncios de ${real ? "VERDADE" : "TESTE"}${signer && signer !== "ok" ? ` · assinado por ${signer}` : ""}`);
if (kind === "aab") console.log("  Envie esse arquivo no Play Console. Na próxima versão, aumente versionCode e versionName em android/app/build.gradle.");
else console.log("  Para instalar: mande o arquivo ao celular e abra. Se já houver o jogo de outra fonte, desinstale antes (apaga o progresso daquele celular).");
if (real && kind === "apk") console.log("  ⚠ APK com anúncios de VERDADE: não clique nos anúncios do seu próprio app (o AdMob bloqueia a conta).");
