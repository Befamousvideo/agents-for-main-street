#!/usr/bin/env node
// Start a production Next server, grant analytics consent in headless Chrome,
// and record a GA4 /g/collect request with tid=G-ECB8CXZGD7.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-ECB8CXZGD7";
const artifactDir = process.env.GA_EVIDENCE_DIR || "/opt/cursor/artifacts";
const chromeBin = process.env.CHROME_PATH || "google-chrome";
const timeoutMs = Number(process.env.GA_COLLECT_TIMEOUT_MS || 30000);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(err => err ? reject(err) : resolve(port));
    });
    s.on("error", reject);
  });
}

async function waitHttp(url, ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(url, { redirect: "manual" });
      if (r.status > 0) return;
    } catch {}
    await sleep(250);
  }
  throw new Error("timed out waiting for " + url);
}

function spawnLogged(cmd, args, opts) {
  const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...opts });
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  return child;
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }
  ready() {
    return new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", () => reject(new Error("cdp websocket failed")), { once: true });
    });
  }
  listen() {
    this.ws.addEventListener("message", ev => {
      const msg = JSON.parse(ev.data);
      if (Object.prototype.hasOwnProperty.call(msg, "id") && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result || {});
        return;
      }
      if (msg.method) {
        const fns = this.listeners.get(msg.method) || [];
        for (const fn of fns) fn(msg.params || {}, msg);
      }
    });
  }
  on(method, fn) {
    const list = this.listeners.get(method) || [];
    list.push(fn);
    this.listeners.set(method, list);
  }
  send(method, params, sessionId) {
    const id = this.nextId++;
    const p = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return p;
  }
  wait(method, ms) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timed out waiting for " + method)), ms);
      const fn = params => {
        clearTimeout(t);
        const list = (this.listeners.get(method) || []).filter(x => x !== fn);
        this.listeners.set(method, list);
        resolve(params);
      };
      this.on(method, fn);
    });
  }
  close() {
    try { this.ws.close(); } catch {}
  }
}

function collectUrl(u) {
  try { return new URL(u); } catch { return null; }
}

function tidFrom(urlString, postData) {
  const u = collectUrl(urlString);
  const fromQuery = u?.searchParams.get("tid");
  if (fromQuery) return fromQuery;
  if (postData) {
    const m = String(postData).match(/(?:^|[&\n])tid=([^&\n]+)/);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

function isCollectPath(urlString) {
  const u = collectUrl(urlString);
  if (!u) return false;
  return u.pathname.includes("/g/collect") || u.pathname.endsWith("/collect");
}

async function main() {
  const appPort = await freePort();
  const debugPort = await freePort();
  const userData = join(tmpdir(), "afms-chrome-" + Date.now());
  mkdirSync(userData, { recursive: true });
  mkdirSync(artifactDir, { recursive: true });

  const nextBin = join(root, "node_modules/next/dist/bin/next");
  const server = spawnLogged(process.execPath, [nextBin, "start", "-p", String(appPort), "-H", "127.0.0.1"], {
    cwd: root,
    env: { ...process.env, PORT: String(appPort), HOSTNAME: "127.0.0.1" }
  });
  const chrome = spawnLogged(chromeBin, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${debugPort}`,
    "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${userData}`,
    "about:blank"
  ]);

  const stop = () => {
    try { server.kill("SIGTERM"); } catch {}
    try { chrome.kill("SIGTERM"); } catch {}
  };
  process.on("exit", stop);

  try {
    await waitHttp(`http://127.0.0.1:${appPort}/`, 20000);
    await waitHttp(`http://127.0.0.1:${debugPort}/json/version`, 15000);
    const version = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json();
    const pageUrl = `http://127.0.0.1:${appPort}/`;
    const requests = [];
    const cdp = new Cdp(version.webSocketDebuggerUrl);
    await cdp.ready();
    cdp.listen();
    try {
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      const send = (method, params) => cdp.send(method, params, sessionId);
      await send("Network.enable");
      await send("Page.enable");
      await send("Runtime.enable");
      cdp.on("Network.requestWillBeSent", params => {
        requests.push({
          type: "request",
          url: params.request?.url,
          method: params.request?.method,
          postData: params.request?.postData,
          timestamp: params.wallTime || params.timestamp
        });
      });
      const loaded = cdp.wait("Page.loadEventFired", 20000);
      await send("Page.navigate", { url: pageUrl });
      await loaded.catch(() => {});
      await sleep(1000);
      const click = await send("Runtime.evaluate", {
        expression: `(function(){ var b = document.querySelector('[data-consent="allow"]'); if (!b) return "missing"; b.click(); return "clicked"; })()`,
        returnByValue: true
      });
      const deadline = Date.now() + timeoutMs;
      let hit;
      while (Date.now() < deadline) {
        hit = requests.find(r => r.url && isCollectPath(r.url) && tidFrom(r.url, r.postData) === GA_ID);
        if (hit) break;
        await sleep(250);
      }
      const out = {
        ok: Boolean(hit),
        measurementId: GA_ID,
        pageUrl,
        consent: { action: "click [data-consent=allow]", result: click.result?.value },
        collect: hit || null,
        relatedRequests: requests.filter(r => r.url && /google|gtag|collect|analytics/i.test(r.url)),
        capturedAt: new Date().toISOString()
      };
      const artifactPath = join(artifactDir, "ga4-g-collect.json");
      writeFileSync(artifactPath, JSON.stringify(out, null, 2));
      console.log(artifactPath);
      if (!out.ok) {
        console.error("no /g/collect request with tid=" + GA_ID);
        process.exit(1);
      }
      console.log("ok  /g/collect " + hit.url);
    } finally {
      cdp.close();
    }
  } finally {
    stop();
    await sleep(300);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
