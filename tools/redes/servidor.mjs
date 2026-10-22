// Página local das redes: o plano de posts (docs/PLANO_DE_CONTEUDO.md) com os vídeos e as imagens de verdade de
// videos/promo/entrega/ (fora do git), para copiar texto e imagem e pegar o vídeo na hora de postar.
//
//   npm run redes                 → http://localhost:8170 (abre o navegador)
//   npm run redes -- --celular    → também na rede de casa: abra o endereço que aparece no celular (mesmo Wi-Fi)
//                                   para salvar o vídeo e postar pelo app
//
// Só leitura da pasta de entrega. "Mostrar na pasta" (abre o Explorer no arquivo) só responde a quem está neste PC.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const MIDIA = path.join(ROOT, "videos", "promo", "entrega");
const FONTES = path.join(ROOT, "assets", "fonts");
const PORTA = Number(process.env.PORTA || 8170);
const CELULAR = process.argv.includes("--celular");
const SEM_ABRIR = process.argv.includes("--sem-abrir");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
};
// O que a página lista (subpasta de entrega → tipo)
const PASTAS = [
  { dir: "reels", tipos: [".mp4", ".jpg", ".png"] },
  { dir: "social", tipos: [".png", ".jpg"] },
  { dir: "", tipos: [".mp4"] }, // o vídeo promocional, na raiz da entrega
];

const local = (req) => {
  const a = req.socket.remoteAddress || "";
  return a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
};

// Caminho pedido → arquivo dentro de uma pasta permitida (nada de ../ para fora)
function dentro(base, rel) {
  const p = path.resolve(base, rel);
  return p === base || p.startsWith(base + path.sep) ? p : null;
}

function listar(req) {
  const itens = [];
  for (const { dir, tipos } of PASTAS) {
    const abs = path.join(MIDIA, dir);
    let nomes = [];
    try {
      nomes = fs.readdirSync(abs);
    } catch {
      continue;
    }
    for (const n of nomes.sort()) {
      const ext = path.extname(n).toLowerCase();
      if (!tipos.includes(ext)) continue;
      const f = path.join(abs, n);
      const st = fs.statSync(f);
      if (!st.isFile()) continue;
      itens.push({
        url: "/midia/" + (dir ? dir + "/" : "") + encodeURIComponent(n),
        arquivo: (dir ? dir + "/" : "") + n,
        nome: n,
        tipo: ext === ".mp4" ? "video" : "imagem",
        bytes: st.size,
        alterado: st.mtimeMs,
        // o caminho completo só para quem está neste PC (para colar na janela de envio)
        caminho: local(req) ? f : null,
      });
    }
  }
  return { itens, local: local(req), pasta: local(req) ? MIDIA : null };
}

function enviarArquivo(req, res, f) {
  let st;
  try {
    st = fs.statSync(f);
  } catch {
    res.writeHead(404).end("não encontrado");
    return;
  }
  const tipo = TIPOS[path.extname(f).toLowerCase()] || "application/octet-stream";
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  const base = { "Content-Type": tipo, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" };
  if (req.url.includes("baixar=1")) base["Content-Disposition"] = `attachment; filename="${path.basename(f)}"`;
  if (range) {
    const ini = range[1] ? Number(range[1]) : 0;
    const fim = range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    if (ini > fim || ini >= st.size) {
      res.writeHead(416, { "Content-Range": `bytes */${st.size}` }).end();
      return;
    }
    res.writeHead(206, { ...base, "Content-Range": `bytes ${ini}-${fim}/${st.size}`, "Content-Length": fim - ini + 1 });
    fs.createReadStream(f, { start: ini, end: fim }).pipe(res);
    return;
  }
  res.writeHead(200, { ...base, "Content-Length": st.size });
  if (req.method === "HEAD") return void res.end();
  fs.createReadStream(f).pipe(res);
}

const servidor = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const rota = decodeURIComponent(u.pathname);
  if (rota === "/" || rota === "/index.html") return enviarArquivo(req, res, path.join(HERE, "pagina.html"));
  if (rota === "/api/midia") {
    res.writeHead(200, { "Content-Type": TIPOS[".json"], "Cache-Control": "no-store" });
    return void res.end(JSON.stringify(listar(req)));
  }
  if (rota === "/api/abrir" && req.method === "POST") {
    if (!local(req)) return void res.writeHead(403).end("só neste PC");
    const f = dentro(MIDIA, u.searchParams.get("arquivo") || "");
    if (!f || !fs.existsSync(f)) return void res.writeHead(404).end("não encontrado");
    if (process.platform === "win32") spawn("explorer.exe", ["/select,", f], { detached: true, stdio: "ignore" }).unref();
    else spawn(process.platform === "darwin" ? "open" : "xdg-open", [path.dirname(f)], { detached: true, stdio: "ignore" }).unref();
    return void res.writeHead(204).end();
  }
  if (rota.startsWith("/midia/")) {
    const f = dentro(MIDIA, rota.slice("/midia/".length));
    return f ? enviarArquivo(req, res, f) : void res.writeHead(404).end();
  }
  if (rota.startsWith("/fontes/")) {
    const f = dentro(FONTES, rota.slice("/fontes/".length));
    return f ? enviarArquivo(req, res, f) : void res.writeHead(404).end();
  }
  res.writeHead(404).end("não encontrado");
});

servidor.listen(PORTA, CELULAR ? "0.0.0.0" : "127.0.0.1", () => {
  const url = `http://localhost:${PORTA}`;
  console.log(`Página das redes: ${url}`);
  if (CELULAR) {
    const ips = Object.values(os.networkInterfaces())
      .flat()
      .filter((i) => i && i.family === "IPv4" && !i.internal)
      .map((i) => i.address);
    for (const ip of ips) console.log(`No celular (mesmo Wi-Fi): http://${ip}:${PORTA}`);
    console.log("Se o Windows perguntar, permita o Node na rede privada.");
  }
  console.log("Para parar: Ctrl+C");
  if (!SEM_ABRIR && process.platform === "win32") spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
});
servidor.on("error", (e) => {
  console.error(e.code === "EADDRINUSE" ? `A porta ${PORTA} está ocupada (a página já está aberta?). Use PORTA=8171 npm run redes` : e.message);
  process.exit(1);
});
