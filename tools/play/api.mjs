// Login e chamadas da Google Play Developer API (v3) com a chave da conta de serviço, para os scripts
// tools/play-produtos.mjs e tools/play-versao.mjs. Sem dependências: JWT RS256 com crypto + fetch.
// Credencial fora do git: ~/chaves-android/play-api.json (ou PLAY_KEY); passo a passo em docs/PLAY_STORE.md.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const PKG = process.env.PLAY_PKG || "com.lopesleo.guardiao";
const BASE = process.env.PLAY_API || "https://androidpublisher.googleapis.com/androidpublisher/v3";
const UPLOAD = process.env.PLAY_UPLOAD || "https://androidpublisher.googleapis.com/upload/androidpublisher/v3";
const KEY = process.env.PLAY_KEY || path.join(os.homedir(), "chaves-android", "play-api.json");

let token = null;
export async function auth() {
  if (token) return token;
  if (!fs.existsSync(KEY)) {
    console.error(`Sem a credencial em ${KEY}.\nCrie a conta de serviço (docs/PLAY_STORE.md, "Produtos pelo script") ou aponte PLAY_KEY para o JSON.`);
    process.exit(2);
  }
  const k = JSON.parse(fs.readFileSync(KEY, "utf8"));
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const aud = k.token_uri || "https://oauth2.googleapis.com/token";
  const body = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: k.client_email, scope: "https://www.googleapis.com/auth/androidpublisher", aud, iat: now, exp: now + 3600 })}`;
  const jwt = `${body}.${crypto.sign("RSA-SHA256", Buffer.from(body), k.private_key).toString("base64url")}`;
  const r = await fetch(aud, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`login da conta de serviço falhou (${r.status}): ${j.error_description || j.error || "?"}`);
  return (token = j.access_token);
}

async function call(base, method, url, body, type) {
  const r = await fetch(`${base}/applications/${PKG}/${url}`, {
    method,
    headers: { authorization: `Bearer ${await auth()}`, "content-type": type || "application/json" },
    body: body == null ? undefined : type ? body : JSON.stringify(body),
  });
  if (r.status === 404 && method === "GET") return null;
  const txt = await r.text();
  let j = {};
  try {
    j = txt ? JSON.parse(txt) : {};
  } catch {}
  if (!r.ok) {
    const msg = j.error?.message || `${r.statusText} ${txt.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160)}`;
    const dica = r.status === 403 ? "\n  → a conta de serviço não tem essa permissão neste app (Play Console → Usuários e permissões); a liberação pode levar algumas horas" : "";
    throw new Error(`${method} ${url.split("?")[0]}: ${r.status} ${msg}${dica}`);
  }
  return j;
}

// Chamada comum (JSON) a applications/{pacote}/…; GET de algo que não existe volta null
export const api = (method, url, body) => call(BASE, method, url, body);
// Envio de arquivo (o AAB) para o endereço de upload da API
export const upload = (url, buf, type = "application/octet-stream") => call(UPLOAD, "POST", url, buf, type);
