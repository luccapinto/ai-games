// Driver mínimo do Chrome sem cabeça via CDP + servidor estático, sem dependências.
// Em máquina com GPU Intel no Linux, rodar com WebGL por ANGLE (gl-egl); ajuste CHROME=... se precisar.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

try { os.setPriority(os.constants.priority.PRIORITY_LOW); } catch {}

const CHROME = [process.env.CHROME, path.join(os.homedir(), '.local/bin/google-chrome'), '/usr/bin/google-chrome']
  .find(p => p && fs.existsSync(p));
const ANGLE = process.env.ANGLE || 'gl-egl'; // 'gl' gives no WebGL2 here; 'vulkan' also works
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Every descendant pid of `root` (Chrome zygote, GPU, renderers...).
function descendants(root) {
  const kids = new Map();
  for (const d of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const stat = fs.readFileSync(`/proc/${d}/stat`, 'utf8');
      const ppid = +stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1];
      if (!kids.has(ppid)) kids.set(ppid, []);
      kids.get(ppid).push(+d);
    } catch {}
  }
  const out = [], stack = [root];
  while (stack.length) { const p = stack.pop(); out.push(p); stack.push(...(kids.get(p) || [])); }
  return out;
}

export async function launch({ width = 1080, height = 1920, requireGpu = /HD Graphics 620/i } = {}) {
  if (!CHROME) throw new Error('Chrome not found (set CHROME=...)');
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));
  const env = { ...process.env, MESA_LOADER_DRIVER_OVERRIDE: 'iris', VK_ICD_FILENAMES: '/usr/share/vulkan/icd.d/intel_icd.json' };
  const flags = ['--remote-debugging-port=0', `--user-data-dir=${udd}`, '--headless=new', '--no-sandbox', '--no-first-run',
    '--disable-extensions', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--mute-audio',
    `--window-size=${width},${height}`, '--hide-scrollbars', '--use-gl=angle', `--use-angle=${ANGLE}`,
    ...(ANGLE === 'vulkan' ? ['--enable-features=Vulkan'] : []), '--ignore-gpu-blocklist', '--enable-gpu', 'about:blank'];
  const proc = spawn(CHROME, flags, { stdio: 'ignore', env });
  const kill = () => { try { process.kill(proc.pid, 'SIGKILL'); } catch {} };
  process.once('exit', kill);

  // Port 0 -> Chrome writes the chosen port into DevToolsActivePort.
  let port;
  for (let i = 0; i < 200 && !port; i++) {
    try { port = +fs.readFileSync(path.join(udd, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { await sleep(100); }
  }
  if (!port) { kill(); throw new Error('Chrome never opened its CDP port'); }
  let list;
  for (let i = 0; i < 100 && !list?.some(t => t.type === 'page'); i++) {
    try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await sleep(150); }
  }
  const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map(), logs = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      logs.push({ type: 'exception', text: m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text });
    } else if (m.method === 'Runtime.consoleAPICalled') {
      logs.push({ type: m.params.type, text: m.params.args.map(a => a.value ?? a.description).join(' ') });
    } else if (m.method === 'Log.entryAdded') {
      logs.push({ type: 'log.' + m.params.entry.level, text: m.params.entry.text });
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params }));
  });

  // Idle priority for the browser and all children, re-applied (Chrome raises its GPU process by itself).
  const polite = () => { for (const p of descendants(proc.pid)) { try { os.setPriority(p, 19); } catch {} } };
  polite();
  const politeTimer = setInterval(polite, 5000); politeTimer.unref();

  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

  const api = {
    send, logs, proc, port,
    async eval(expr, ms = 120000) {
      let timer;
      const r = await Promise.race([send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }),
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`eval timeout (${ms} ms): ${expr.slice(0, 80)}`)), ms); })])
        .finally(() => clearTimeout(timer));
      if (r.exceptionDetails) throw new Error('eval failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    },
    async goto(url) { await send('Page.navigate', { url }); await api.waitFor('document.readyState === "complete"', 15000); },
    async waitFor(expr, ms = 10000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { try { if (await api.eval(expr, 3000)) return true; } catch {} await sleep(100); }
      throw new Error('timeout: ' + expr);
    },
    async shot(file, { format = 'jpeg', quality = 92, ms = 30000 } = {}) {
      let timer;
      const r = await Promise.race([send('Page.captureScreenshot', { format, ...(format === 'jpeg' ? { quality } : {}), optimizeForSpeed: true }),
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('screenshot timeout')), ms); })]).finally(() => clearTimeout(timer));
      const buf = Buffer.from(r.data, 'base64'); if (file) fs.writeFileSync(file, buf); return buf;
    },
    async close() {
      clearInterval(politeTimer);
      try { ws.close(); } catch {}
      kill(); await sleep(400);
      fs.rmSync(udd, { recursive: true, force: true });
    },
  };

  // GPU probe: abort on any software rasteriser (rule 1). Never render a film on the CPU.
  const gpu = await api.eval(`(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2');
    if (!gl) return { webgl2: false, renderer: '' };
    const e = gl.getExtension('WEBGL_debug_renderer_info');
    return { webgl2: true, renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) }; })()`);
  api.gpu = gpu;
  const bad = !gpu.webgl2 || !gpu.renderer || /swiftshader|software|basic render|llvmpipe/i.test(gpu.renderer)
    || (requireGpu && !requireGpu.test(gpu.renderer));
  if (bad) { await api.close(); throw new Error(`GPU probe failed (refusing to render on CPU): ${JSON.stringify(gpu)}`); }
  // Warm-up capture: without one on the fresh tab, the first capture after heavy WebGL work never returns here.
  await api.shot(null, { format: 'jpeg', quality: 50, ms: 15000 });
  return api;
}

// Static server for the project folder (no-store, so edits always show up).
const MIME = { '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.webmanifest': 'application/manifest+json', '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.wav': 'audio/wav' };
export function serve(root) {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, url: `http://127.0.0.1:${srv.address().port}` }));
  });
}

// Launch + serve + open film.html and wait for the scene. Returns { api, url, close }.
export async function openFilm(query = '') {
  const root = path.dirname(new URL(import.meta.url).pathname);
  const { srv, url } = await serve(root);
  const api = await launch();
  console.error(`[cdp] GPU: ${api.gpu.renderer}`);
  try {
    await api.goto(`${url}/film.html${query ? '?' + query : ''}`);
    await api.waitFor('window.__ready === true', 90000);
  } catch (e) {
    console.error(api.logs.map(l => `${l.type}: ${l.text}`).join('\n'));
    await api.close(); srv.close(); throw e;
  }
  return { api, url, async close() { await api.close(); srv.close(); } };
}

// `node cdp.mjs probe` -> prints the renderer string.
if (process.argv[1] === new URL(import.meta.url).pathname && process.argv[2] === 'probe') {
  const api = await launch({ requireGpu: null });
  console.log(JSON.stringify(api.gpu));
  await api.close();
}
