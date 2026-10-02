// Compila o app de TESTE (debug) e instala no celular via adb.
// Uso: npm run android:install     (celular com depuração USB ligada, plugado e autorizado)
// Procura o Java 21 (exigido pelo Capacitor 8) e o Android SDK nos lugares onde foram instalados
// neste PC; se estiverem em outro lugar, defina JAVA21_HOME e ANDROID_HOME antes de rodar.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const home = process.env.USERPROFILE || process.env.HOME || "";
// o JAVA_HOME do sistema aponta para o 17; prefere um JDK 21 instalado pelo winget
const MS_JDKS = "C:\\Program Files\\Microsoft";
const jdk21 = existsSync(MS_JDKS) && readdirSync(MS_JDKS).filter((d) => d.startsWith("jdk-21")).sort().pop();
const JAVA_HOME = process.env.JAVA21_HOME || (jdk21 ? join(MS_JDKS, jdk21) : process.env.JAVA_HOME || "");
const SDK = process.env.ANDROID_HOME || join(home, "AppData", "Local", "Android", "Sdk");
const ADB = join(SDK, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
const APK = join("android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const PKG = "com.lopesleo.guardiao";
const env = { ...process.env, JAVA_HOME, ANDROID_HOME: SDK };

const need = (p, what) => {
  if (!existsSync(p)) {
    console.error(`Não achei ${what} em ${p}. Defina a variável de ambiente correspondente.`);
    process.exit(1);
  }
};
need(JAVA_HOME, "o Java 21 (JAVA21_HOME)");
need(ADB, "o adb (ANDROID_HOME)");

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", env, shell: process.platform === "win32" && !cmd.endsWith(".exe"), ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// 1) celular conectado?
const list = execFileSync(ADB, ["devices"], { env }).toString().split("\n").slice(1).filter((l) => /\sdevice$/.test(l.trim()));
if (!list.length) {
  console.error("Nenhum celular conectado e autorizado. Plugue o cabo, ligue a depuração USB e aceite o aviso no celular.");
  process.exit(1);
}
console.log("Celular:", list[0].split(/\s+/)[0]);

// 2) sincroniza o jogo e compila
run("npm", ["run", "android:sync"]);
// caminho completo: o cmd do Windows pode não procurar comandos na pasta atual
run(join(process.cwd(), "android", process.platform === "win32" ? "gradlew.bat" : "gradlew"), ["assembleDebug", "--console=plain"], { cwd: "android" });

// 3) instala (mantém os dados do jogo) e abre
run(ADB, ["install", "-r", APK]);
run(ADB, ["shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1"]);
console.log("Pronto: o jogo foi instalado e aberto no celular.");
