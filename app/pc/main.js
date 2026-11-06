// Pokémon Authority — PC app.
// Opens the game website in its own window. Every sprite / sound / music file the game asks for is
// served from the "game-files" folder next to the .exe if it's there; otherwise it is downloaded and saved there.
// The game itself (the website) is kept in the app's private data so it also opens without internet.
const {app, BrowserWindow, protocol, net, ipcMain, shell, Menu} = require('electron');
const path = require('path');
const fs = require('fs');

const GAME_URL = process.env.PA_URL || 'https://ayayajay.github.io/pokemon-authority/';
const G = new URL(GAME_URL), SITE_HOST = G.host, SITE_BASE = G.pathname.replace(/[^/]*$/, '');
const PR = 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/';
// friendly folder names for the downloaded files (same table as the Android app)
const MAP = [
  ['https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/', 'pokemon/'],
  ['https://play.pokemonshowdown.com/sprites/', 'pokemon-showdown/'],
  ['https://play.pokemonshowdown.com/fx/', 'showdown-fx/'],
];
function localPath(url) {
  let rel = null;
  for (const [pre, dir] of MAP) if (url.startsWith(pre)) { rel = dir + url.slice(pre.length); break; }
  if (!rel && url.startsWith(PR)) {   // pokerogue-assets/<commit>/audio/bgm/x.mp3 -> music/x.mp3
    const rest = url.slice(PR.length).split('/').slice(1).join('/');
    rel = rest.startsWith('audio/bgm/') ? 'music/' + rest.slice(10) : rest.startsWith('audio/') ? 'sounds/' + rest.slice(6) : rest.startsWith('images/') ? 'move-animations/' + rest.slice(7) : 'pokerogue/' + rest;
  }
  if (!rel) return null;
  rel = decodeURIComponent(rel.split('?')[0].split('#')[0]);
  if (rel.includes('..')) return null;
  return path.join(FILES, ...rel.split('/'));
}
const ASSET_HOSTS = new Set(['raw.githubusercontent.com', 'play.pokemonshowdown.com']);

// folders: game-files next to the program (portable), private site copy in the app's data folder
const BASE = app.isPackaged ? path.dirname(process.execPath) : __dirname;
let FILES = path.join(BASE, 'game-files');
try { fs.mkdirSync(FILES, {recursive: true}); fs.accessSync(FILES, fs.constants.W_OK); } catch (e) { FILES = path.join(app.getPath('userData'), 'game-files'); fs.mkdirSync(FILES, {recursive: true}); }
const SITE = path.join(app.getPath('userData'), 'site');
const CFG = path.join(app.getPath('userData'), 'config.json');
let cfg = {saving: true}; try { cfg = Object.assign(cfg, JSON.parse(fs.readFileSync(CFG, 'utf8'))); } catch (e) {}
const saveCfg = () => { try { fs.writeFileSync(CFG, JSON.stringify(cfg)); } catch (e) {} };
const README = path.join(FILES, 'README.txt');
if (!fs.existsSync(README)) try { fs.writeFileSync(README, 'Pokémon Authority game files\r\n\r\npokemon/  - Pokémon sprites and portraits\r\nmusic/    - background music (MP3)\r\nsounds/   - sound effects and cries\r\nmove-animations/ - move effect pictures\r\n\r\nTo use your own sprite or music, replace a file with one of the SAME name and type.\r\nDelete a file (or use "Delete downloaded files" in the game) to get the original back.\r\nSaves you export are written to saves/.\r\n'); } catch (e) {}

const MIME = {png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', xml: 'text/xml', json: 'application/json', html: 'text/html; charset=utf-8', js: 'text/javascript', css: 'text/css', woff2: 'font/woff2', woff: 'font/woff', txt: 'text/plain'};
const mimeOf = p => MIME[path.extname(p).slice(1).toLowerCase()] || 'application/octet-stream';
const CORS = {'access-control-allow-origin': '*'};
const fileResp = p => new Response(fs.readFileSync(p), {status: 200, headers: Object.assign({'content-type': mimeOf(p)}, CORS)});

async function handle(req) {
  const url = req.url, u = new URL(url);
  if (req.method !== 'GET') return net.fetch(req, {bypassCustomProtocolHandlers: true});
  // the game website: newest from the internet, saved copy when offline
  if (u.host === SITE_HOST) {
    let p = (u.pathname.startsWith(SITE_BASE) ? u.pathname.slice(SITE_BASE.length) : u.pathname.slice(1)) || 'index.html'; if (p.endsWith('/')) p += 'index.html';
    const lp = path.join(SITE, ...decodeURIComponent(p).split('/').filter(x => x && x !== '..'));
    try {
      const r = await net.fetch(url, {bypassCustomProtocolHandlers: true, cache: 'no-cache'});
      if (r.ok) { const buf = Buffer.from(await r.arrayBuffer()); try { fs.mkdirSync(path.dirname(lp), {recursive: true}); fs.writeFileSync(lp, buf); } catch (e) {} return new Response(buf, {status: 200, headers: {'content-type': r.headers.get('content-type') || mimeOf(lp)}}); }
      if (fs.existsSync(lp)) return fileResp(lp);
      return r;
    } catch (e) { if (fs.existsSync(lp)) return fileResp(lp); return new Response('Offline and this page was never saved.', {status: 503}); }
  }
  // sprites / sounds / music: local file first, then download (and save)
  const lp = ASSET_HOSTS.has(u.hostname) ? localPath(url) : null;
  if (lp) {
    if (fs.existsSync(lp)) return fileResp(lp);
    try {
      const r = await net.fetch(url.split('?')[0], {bypassCustomProtocolHandlers: true});
      if (!r.ok) return new Response(null, {status: r.status, headers: CORS});
      const buf = Buffer.from(await r.arrayBuffer());
      if (cfg.saving) try { fs.mkdirSync(path.dirname(lp), {recursive: true}); fs.writeFileSync(lp, buf); } catch (e) {}
      return new Response(buf, {status: 200, headers: Object.assign({'content-type': r.headers.get('content-type') || mimeOf(lp)}, CORS)});
    } catch (e) { return new Response(null, {status: 503, headers: CORS}); }
  }
  return net.fetch(req, {bypassCustomProtocolHandlers: true});
}

function dirBytes(d) { let n = 0; try { for (const f of fs.readdirSync(d, {withFileTypes: true})) { const p = path.join(d, f.name); n += f.isDirectory() ? dirBytes(p) : fs.statSync(p).size; } } catch (e) {} return n; }

// the game calls these through window.PAApp (see preload.js)
ipcMain.on('pa', (e, cmd, a, b) => {
  try {
    if (cmd === 'platform') e.returnValue = 'pc';
    else if (cmd === 'folder') e.returnValue = FILES;
    else if (cmd === 'getSaving') e.returnValue = cfg.saving;
    else if (cmd === 'setSaving') { cfg.saving = !!a; saveCfg(); e.returnValue = true; }
    else if (cmd === 'filesBytes') e.returnValue = dirBytes(FILES);
    else if (cmd === 'clearFiles') { for (const f of fs.readdirSync(FILES)) if (!['saves', 'README.txt'].includes(f)) fs.rmSync(path.join(FILES, f), {recursive: true, force: true}); e.returnValue = true; }
    else if (cmd === 'saveFile') { const d = path.join(FILES, 'saves'); fs.mkdirSync(d, {recursive: true}); const p = path.join(d, path.basename(String(a))); fs.writeFileSync(p, String(b)); e.returnValue = p; }
    else if (cmd === 'openFolder') { shell.openPath(FILES); e.returnValue = true; }
    else e.returnValue = null;
  } catch (err) { e.returnValue = null; }
});

if (process.env.PA_TEST) app.commandLine.appendSwitch('ignore-certificate-errors');   // test sandbox only
app.whenReady().then(() => {
  protocol.handle('https', handle);
  if (G.protocol === 'http:') protocol.handle('http', handle);   // only for local testing
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({width: 1400, height: 820, backgroundColor: '#151726', title: 'Pokémon Authority', autoHideMenuBar: true,
    webPreferences: {preload: path.join(__dirname, 'preload.js'), contextIsolation: true, autoplayPolicy: 'no-user-gesture-required'}});
  win.loadURL(GAME_URL);
  win.webContents.on('before-input-event', (e, input) => { if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); } });
  win.webContents.setWindowOpenHandler(({url}) => { shell.openExternal(url); return {action: 'deny'}; });
});
app.on('window-all-closed', () => app.quit());
