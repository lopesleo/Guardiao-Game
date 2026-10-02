// Compila o app de TESTE (debug) e instala no celular via adb.
// Uso: npm run android:install     (celular com depuração USB ligada, plugado e autorizado)
// Procura o Java 17 e o Android SDK nos lugares onde foram instalados neste PC; se estiverem em
// outro lugar, defina JAVA_HOME e ANDROID_HOME antes de rodar.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const home = process.env.USERPROFILE || process.env.HOME || "";
const JAVA_HOME = process.env.JAVA_HOME || join(home, "dev-tools", "jdk-17.0.20.1+1");
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
need(JAVA_HOME, "o Java 17 (JAVA_HOME)");
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
