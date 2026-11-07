// ===== Overworld: Gen 3 maps (pret/pokeemerald), PokeRogue windows + Emerald font =====
var WSLOT = 'world';   // which save the overworld uses: 'world' = Test mode, 'story' = Story mode
const OW_SCALE = 3, TS = 16 * OW_SCALE;                 // 16px tiles drawn 3x
const WSTEP = 0.24, RSTEP = 0.13, SSTEP = 0.07;   // SSTEP: Story's 'Run 2' sprint (ancient people are faster than us — it replaces the bicycle)                        // seconds per tile walking / running
const OW = {active: false, data: null, imgs: {}, map: null, x: 0, y: 0, dir: 0, moving: null, npcs: [], dialog: null, menu: null, fade: 0, fadeTo: null, held: {}, joy: null, t: 0, stepAnim: 0, lastBtn: []};
const DIRV = [[0, 1], [0, -1], [-1, 0], [1, 0]];          // 0 down, 1 up, 2 left, 3 right
let owFontReady = false;
(function loadOwFont() {
  try {
    const f = new FontFace('PokeEmerald', `url(${PR_BASE}fonts/pokemon-emerald-pro.ttf)`);
    f.load().then(ff => { document.fonts.add(ff); owFontReady = true; }).catch(() => {});
  } catch (e) {}
})();
const OWF = () => PIXF;
try { document.fonts.load('24px Galmuri11'); document.fonts.load('bold 24px Galmuri11'); document.fonts.load('24px Galmuri14'); } catch (e) {}
function owImg(path) {
  if (OW.imgs[path]) return OW.imgs[path];
  const im = new Image(); im.src = path; OW.imgs[path] = im; return im;
}
const PRUI = n => owImg(PR_BASE + 'images/ui/' + n + '.png');
function winStyle() { return 'windows/window_' + ((OPTS.winStyle || 1)) ; }
// pixel window: dark navy fill, light 2-tone border (drawn in 3px "pixels")
// Gen 3 / Essentials style window: white inside, rounded blue-grey frame
function owWindow(x, y, w, h, thin) {
  x = Math.round(x); y = Math.round(y);
  const rr2 = (X, Y, Wd, Hd, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(X + r, Y); ctx.arcTo(X + Wd, Y, X + Wd, Y + Hd, r); ctx.arcTo(X + Wd, Y + Hd, X, Y + Hd, r); ctx.arcTo(X, Y + Hd, X, Y, r); ctx.arcTo(X, Y, X + Wd, Y, r); ctx.closePath(); ctx.fill(); };
  rr2(x + 3, y + 4, w, h, 12, 'rgba(0,0,0,0.25)');   // drop shadow
  rr2(x, y, w, h, 12, '#4a5a88');
  rr2(x + 4, y + 4, w - 8, h - 8, 9, '#a8c0e8');
  rr2(x + 8, y + 8, w - 16, h - 16, 6, thin ? 'rgba(248,248,248,0.97)' : '#f8f8f8');
}
// dark text with a soft light shadow (white text gets a dark shadow instead)
function owText(s, x, y, size, col, align) {
  ctx.font = `${size || 34}px ${OWF()}`; ctx.imageSmoothingEnabled = false; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
  col = col || '#404048'; const light = /^#(f|e|d|c)/i.test(col) || col === '#fff';
  ctx.fillStyle = light ? 'rgba(0,0,0,0.45)' : '#d0d0c8'; ctx.fillText(s, x + 2, y + 2); ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function owCursor(x, y, s) { ctx.fillStyle = '#404048'; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.9, y - s / 2); ctx.lineTo(x, y); ctx.closePath(); ctx.fill(); }

// ---------- data / map loading ----------
function owLoad(cb) {
  if (OW.data) return cb();
  OW.cache = OW.cache || {};
  if (OW.cache[WSLOT]) { OW.data = OW.cache[WSLOT]; return cb(); }
  Promise.all([fetch(WSLOT === 'story' ? 'world/story.json' : 'world/world.json').then(r => r.json()), OW.learn ? Promise.resolve(OW.learn) : fetch('world/learn.json').then(r => r.json()).catch(() => ({}))])
    .then(([j, l]) => { OW.cache[WSLOT] = OW.data = j; OW.learn = l; cb(); }).catch(() => alert('Could not load the world data.'));
}
function owMapImgs(name) { const m = OW.data.maps[name]; return {b: owImg('world/maps/' + name + '_b.png'), t: m.top ? owImg('world/maps/' + name + '_t.png') : null}; }
const owM = () => OW.data.maps[OW.map];
const behName = (m, x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h) ? '' : (m.behNames[m.beh[y * m.w + x]] || '');
const blocked = (m, x, y) => m.coll[y * m.w + x] !== '0';
function owEnterMap(name, x, y, dir) {
  OW.map = name; OW.x = x; OW.y = y; if (dir != null) OW.dir = dir; OW.moving = null;
  const m = owM(); OW.npcs = m.npcs.map(n => Object.assign({}, n, {hx: n.x, hy: n.y, dir: n.mv.includes('UP') ? 1 : n.mv.includes('LEFT') ? 2 : n.mv.includes('RIGHT') ? 3 : 0, t: rnd(1, 4), mv2: null}));
  owMapImgs(name); for (const c of m.conns) { owMapImgs(c.to); owImg('world/maps/' + c.to + '_border.png'); }   // load the next maps (and their edge tiles) before you walk into them
  const bt = WSLOT === 'story' ? storyTitle(m.title || '') : owTitle(name); OW.banner = bt ? {text: bt, t: 2.2} : null;
  if (WSLOT === 'story') storyEnterMap(name);
  owEnterMusic();
  if (SAVE[WSLOT]) { SAVE[WSLOT].map = name; SAVE[WSLOT].x = x; SAVE[WSLOT].y = y; SAVE[WSLOT].dir = OW.dir; persist(); }
}
function owEnterMusic() { const name = OW.map, m = owM(); playMusic(/Lab/.test(name) ? 'laboratory' : /Woods/.test(name) ? 'forest' : m.type === 'MAP_TYPE_ROUTE' ? 'grass' : 'town'); }
function owTitle(n) { return n.replace(/_.*/, '').replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/Route ?(\d+)/, 'ROUTE $1').toUpperCase(); }
function conOffset(c) {   // where a connected map sits relative to the current one (in tiles)
  const m = owM(), t = OW.data.maps[c.to];
  if (c.dir === 'up') return [c.off, -t.h]; if (c.dir === 'down') return [c.off, m.h];
  if (c.dir === 'left') return [-t.w, c.off]; return [m.w, c.off];
}

// moves a Pokémon knows at a level: the last 4 level-up moves it has learned
function levelMoves(id, lv) {
  const sp = SP[id] || SP[toID(id)]; const L = OW.learn && (OW.learn[id] || (sp && (OW.learn[sp.base] || OW.learn[toID(sp.base)])));
  if (!L) return null; const got = [];
  for (let i = 0; i < L.length; i += 2) if (L[i] <= lv && MVI[L[i + 1]] != null) { const k = got.indexOf(L[i + 1]); if (k >= 0) got.splice(k, 1); got.push(L[i + 1]); }
  return got.length ? got.slice(-4) : null;
}
function worldSet(id, lv) { const s = newSet(id); s.level = lv; const mv = levelMoves(id, lv); if (mv) s.moves = mv; return s; }
// ---------- start / stop ----------
function startWorld(mode) {
  WSLOT = mode || 'world';
  owLoad(() => {
    if (!SAVE[WSLOT]) return WSLOT === 'story' ? storyNewGame() : owNewGame();
    unlockAudio(); document.getElementById('setup').style.display = 'none'; cv.style.display = 'block'; document.body.classList.add('inbattle'); if (window._fitCanvas) window._fitCanvas();
    OW.active = true; OW.runOn = OPTS.runMode !== 'hold'; const w = SAVE[WSLOT]; owEnterMap(w.map, w.x, w.y, w.dir || 0); OW.fade = 1; OW.fadeTo = null;
    owLastT = performance.now(); requestAnimationFrame(owLoop);
    if (WSLOT === 'story') storyResume();
  });
}
function owNewGame() {
  const root = $('#setup'); root.innerHTML = ''; root.style.display = 'block';
  let who = 'brendan', starter = null;
  const STARTERS = ['treecko', 'torchic', 'mudkip'];
  const draw = () => {
    root.innerHTML = '';
    root.append(el('div', {className: 'home'},
      el('div', {className: 'logo'}, tr('Test mode', '테스트 모드')),
      el('div', {className: 'sub'}, tr('Preview: the Gen 3 starting area. Your story maps come later.', '미리보기: 3세대 시작 지역. 스토리 맵은 나중에 추가됩니다.')),
      el('div', {className: 'pickgrid'}, ...['brendan', 'may'].map(p => el('div', {className: 'pickcard' + (who === p ? ' sel' : ''), on: {click: () => { who = p; draw(); }}},
        el('div', {style: `width:48px;height:96px;background:url(world/obj/player_${p}.png) 0 0/${18 * 48}px 96px;image-rendering:pixelated`}), p === 'brendan' ? tr('Boy', '남자') : tr('Girl', '여자')))),
      el('div', {className: 'pickgrid'}, ...STARTERS.map(s => el('div', {className: 'pickcard' + (starter === s ? ' sel' : ''), on: {click: () => { starter = s; draw(); }}},
        el('img', {className: 'pt', src: portraitURL(SP[s], false)}), spName(SP[s])))),
      el('button', {className: 'big', disabled: !starter, on: {click: () => {
        const st = worldSet(starter, 5);
        SAVE[WSLOT] = {map: OW.data.start.map, x: OW.data.start.x, y: OW.data.start.y, dir: 0, who, party: [st], seen: {}, caught: {}};
        persist(); startWorld();
      }}}, tr('▶ Start', '▶ 시작')),
      el('button', {on: {click: renderHome}}, tr('Back', '뒤로'))));
  };
  draw();
}
function owQuit() { swallowNextClick(); OW.active = false; OW.script = null; OW.choice = null; OW.overlay = null; stopMusic(); document.body.classList.remove('inbattle'); document.body.classList.remove('rot', 'rot180'); cv.style.display = 'none'; renderHome(); }

// ---------- input ----------
function owDirHeld() {
  if (OW.joy && OW.joy.d != null) return OW.joy.d;
  const h = a => (KEYS[a] || []).some(k => OW.held[k]);
  if (h('fUp')) return 1; if (h('fDown')) return 0; if (h('fLeft')) return 2; if (h('fRight')) return 3; return null;
}
const owStepT = () => !owRun() ? WSTEP : (WSLOT === 'story' && OW.runLv === 2 ? SSTEP : RSTEP);
const owRun = () => { const held = !!((KEYS.run || []).some(k => OW.held[k]) || (OW.joy && OW.joy.run) || OW.bHeld); return OPTS.runMode === 'hold' ? held : (!!OW.runOn !== held); };
window.addEventListener('keydown', e => {
  if (!OW.active || battle || document.querySelector('.overlay')) return;
  const k = keyName(e); OW.held[k] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k) || keyIs(e, 'confirm') || keyIs(e, 'cancel') || keyIs(e, 'menu')) e.preventDefault();
  if (e.repeat) return;
  if (OW.choice && !OW.dialog) { if (keyIs(e, 'fUp')) return owChoicePress('UP'); if (keyIs(e, 'fDown')) return owChoicePress('DOWN'); }
  if (OW.menu && !OW.dialog) { const d = keyIs(e, 'fUp') ? 'UP' : keyIs(e, 'fDown') ? 'DOWN' : keyIs(e, 'fLeft') ? 'LEFT' : keyIs(e, 'fRight') ? 'RIGHT' : null; if (d) { owMenuPress(d); OW.menuDir = {UP: 1, DOWN: 0, LEFT: 2, RIGHT: 3}[d]; return; } }
  if (keyIs(e, 'confirm')) owPress('A'); else if (keyIs(e, 'cancel')) owPress('B'); else if (keyIs(e, 'menu') || k === 'escape') owPress('MENU');
  else if (keyIs(e, 'runToggle') && !OW.dialog && !OW.menu) { if (OPTS.runMode === 'hold') { OW.toast = {text: tr('Running is set to HOLD (Options)', '달리기: 누르고 있기 모드 (설정)'), t: 1.4}; return; } OW.runOn = !OW.runOn; OW.toast = {text: OW.runOn ? tr('Running: ON', '달리기: 켜짐') : tr('Running: OFF', '달리기: 꺼짐'), t: 1.2}; }
  else if (keyIs(e, 'bike') && !OW.dialog && !OW.menu && WSLOT === 'story') owToggleSprint();
  else if (keyIs(e, 'bike') && !OW.dialog && !OW.menu) { if (SAVE[WSLOT].bike) { OW.biking = !OW.biking; } else owSay(tr("You don't have a BICYCLE yet.", '아직 자전거가 없다.')); }
});
window.addEventListener('keyup', e => { OW.held[keyName(e)] = false; });
function owPress(b) {
  if (OW.fadeTo) return;
  if (OW.choice && !OW.dialog) return owChoicePress(b);
  if (OW.script && !OW.dialog) { if (OW.waitKey && (b === 'A' || b === 'B')) { const f = OW.waitKey; OW.waitKey = null; f(); } return; }
  if (OW.dialog) return owDialogPress(b);
  if (OW.menu) return owMenuPress(b);
  if (b === 'A') return owInteract();
  if (b === 'MENU') return owOpenMenu();
}

// ---------- movement ----------
function owTryStep(dir, forced) {
  OW.dir = dir; const m = owM(); const [dx, dy] = DIRV[dir]; let nx = OW.x + dx, ny = OW.y + dy;
  // arrow-warp mats (exit by walking onto the edge)
  const here = behName(m, OW.x, OW.y);
  if ((here === 'MB_SOUTH_ARROW_WARP' && dir === 0) || (here === 'MB_NORTH_ARROW_WARP' && dir === 1) || (here === 'MB_DEEP_SOUTH_WARP' && dir === 0)) { const w = m.warps.find(w => w.x === OW.x && w.y === OW.y); if (w) return owWarp(w); }
  // leaving the map: connected route / town
  if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) {
    const c = m.conns.find(c => (c.dir === 'up' && ny < 0) || (c.dir === 'down' && ny >= m.h) || (c.dir === 'left' && nx < 0) || (c.dir === 'right' && nx >= m.w));
    if (!c) return false;
    const t = OW.data.maps[c.to]; let tx = nx, ty = ny;
    if (c.dir === 'up') { ty = t.h - 1; tx = nx - c.off; } else if (c.dir === 'down') { ty = 0; tx = nx - c.off; } else if (c.dir === 'left') { tx = t.w - 1; ty = ny - c.off; } else { tx = 0; ty = ny - c.off; }
    if (tx < 0 || ty < 0 || tx >= t.w || ty >= t.h || blocked(t, tx, ty)) return false;
    OW.moving = {fx: OW.x, fy: OW.y, tx: nx, ty: ny, t: 0, d: owStepT(), conn: {to: c.to, x: tx, y: ty}};
    return true;
  }
  const bn = behName(m, nx, ny);
  // ledges: hop over going the ledge's way
  const ledge = {MB_JUMP_SOUTH: 0, MB_JUMP_EAST: 3, MB_JUMP_WEST: 2, MB_JUMP_NORTH: 1}[bn];
  if (ledge != null) { if (ledge !== dir) return false; const lx = nx + dx, ly = ny + dy; if (lx < 0 || ly < 0 || lx >= m.w || ly >= m.h || blocked(m, lx, ly) || owNpcAt(lx, ly)) return false; OW.moving = {fx: OW.x, fy: OW.y, tx: lx, ty: ly, t: 0, d: WSTEP * 2, jump: true}; return true; }
  if (/WATER|OCEAN|POND/.test(bn) && !/PUDDLE/.test(bn)) return false;
  const warp = m.warps.find(w => w.x === nx && w.y === ny);
  if (blocked(m, nx, ny) && !(warp && /DOOR/.test(bn))) return false;
  if (owNpcAt(nx, ny) && !forced) return false;
  OW.moving = {fx: OW.x, fy: OW.y, tx: nx, ty: ny, t: 0, d: forced ? WSTEP : owStepT()};
  OW.trail = [{x: OW.x, y: OW.y}].concat(OW.trail || []).slice(0, 4);
  return true;
}
const owNpcAt = (x, y) => OW.npcs.find(n => (n.x === x && n.y === y) || (n.mv2 && n.mv2.tx === x && n.mv2.ty === y));
function owStepDone() {
  const mv = OW.moving; OW.moving = null; OW.stepAnim++; if (mv && mv.d < WSTEP) OW.lastRunEnd = OW.t;
  if (mv.conn) { const d = OW.dir; owEnterMap(mv.conn.to, mv.conn.x, mv.conn.y, d); return; }
  OW.x = mv.tx; OW.y = mv.ty;
  const m = owM(), bn = behName(m, OW.x, OW.y);
  const w = m.warps.find(w => w.x === OW.x && w.y === OW.y);
  if (w && !/ARROW_WARP|DEEP_SOUTH/.test(bn)) return owWarp(w);
  if (SAVE[WSLOT]) { SAVE[WSLOT].x = OW.x; SAVE[WSLOT].y = OW.y; SAVE[WSLOT].dir = OW.dir; }
  if (WSLOT === 'story' && storyStep()) return;   // a story event started here
  if ((bn === 'MB_TALL_GRASS' || bn === 'MB_ASHGRASS') && m.wild && Math.random() < m.wild.rate / 160) owWildBattle(m.wild);
}
function owWarp(w) {
  OW.fadeTo = () => {
    const t = OW.data.maps[w.to], dw = t.warps[w.w] || t.warps[0];
    let x = dw ? dw.x : 1, y = dw ? dw.y : 1, dir = 0;
    owEnterMap(w.to, x, y, 0);
    const bn = behName(t, x, y);
    if (/DOOR/.test(bn)) { OW.moving = {fx: x, fy: y, tx: x, ty: y + 1, t: 0, d: WSTEP, noWarp: true}; }   // step out of the door
    else if (/ARROW_WARP|DEEP_SOUTH/.test(bn)) { dir = bn.includes('SOUTH') ? 1 : 0; OW.dir = dir; OW.moving = {fx: x, fy: y, tx: x, ty: y + (dir === 1 ? -1 : 1), t: 0, d: WSTEP, noWarp: true}; }
  };
  OW.fade = 0;
}

// ---------- talking / signs ----------
function owInteract() {
  const [dx, dy] = DIRV[OW.dir], fx = OW.x + dx, fy = OW.y + dy, m = owM();
  let n = owNpcAt(fx, fy);
  if (!n && /COUNTER/.test(behName(m, fx, fy))) n = owNpcAt(fx + dx, fy + dy);   // talk across a counter
  if (n) { n.dir = [1, 0, 3, 2][OW.dir]; n.mv2 = null; if (n.talk) return storyRun(() => n.talk(n), n); return owSay(n.text || '…', n); }
  const s = m.signs.find(s => s.x === fx && s.y === fy) || (OW.dir === 1 && m.signs.find(s => s.x === OW.x && s.y === OW.y - 1));
  if (s) return owSay(s.text);
  const bn = behName(m, fx, fy);
  if (bn === 'MB_PC') return owSay(tr('Booted up the PC.\nThe POKéMON Storage System isn\'t ready yet.', 'PC를 켰다.\n포켓몬 보관 시스템은 아직 준비 중이다.'));
  if (/BOOKSHELF/.test(bn)) return owSay(tr('It\'s crammed full of POKéMON books.', '포켓몬 책이 가득 꽂혀 있다.'));
  if (bn === 'MB_TELEVISION') return owSay(tr('There\'s a movie on TV.\nFour boys are walking on railroad tracks…', 'TV에서 영화를 하고 있다.\n소년 넷이 철길을 걷고 있다…'));
  // nurse: heal
}
function owSay(text, npc, onDone, who) {
  const name = (SAVE[WSLOT] && SAVE[WSLOT].name) || (SAVE[WSLOT] && SAVE[WSLOT].who === 'may' ? 'MAY' : 'BRENDAN');
  text = text.replace(/\{P\}/g, name).replace(/^'s /, name + "'s ");
  // wrap long lines to the box width (Korean text and narrow screens used to run off the edge)
  ctx.font = `40px ${OWF()}`; const maxW = W - 80 - 100;
  const wrap = ln => { if (ctx.measureText(ln).width <= maxW) return [ln]; const out = []; let cur = ''; const parts = ln.split(/(\s+)/);
    for (const w of parts) { const t = cur + w; if (ctx.measureText(t).width > maxW && cur.trim()) { out.push(cur.trimEnd()); cur = w.trimStart(); } else cur = t;
      while (ctx.measureText(cur).width > maxW) { let k = cur.length; while (k > 1 && ctx.measureText(cur.slice(0, k)).width > maxW) k--; out.push(cur.slice(0, k)); cur = cur.slice(k); } }
    if (cur.trim()) out.push(cur); return out; };
  const pages = []; for (const para of text.split('\n\n')) { const ls = para.split('\n').flatMap(wrap); for (let i = 0; i < ls.length; i += 2) pages.push(ls.slice(i, i + 2)); }
  OW.dialog = {pages, i: 0, shown: 0, npc, onDone, who};
  if (npc && /nurse/.test(npc.s)) OW.dialog.heal = true;
  if (npc && /mart_employee/.test(npc.s) && /Mart/.test(OW.map)) { OW.dialog.shop = true; OW.dialog.pages = [[tr('Welcome! How may I serve you?', '어서 오세요! 무엇을 드릴까요?')]]; }
}
function owDialogPress(b) {
  const d = OW.dialog, full = d.pages[d.i].join('\n').length;
  if (d.shown < full) { d.shown = full; return; }
  if (b !== 'A' && b !== 'B') return;
  d.i++; d.shown = 0;
  if (d.i >= d.pages.length) { OW.dialog = null; if (d.onDone) { d.onDone(); return; } if (d.heal) { for (const s of SAVE[WSLOT].party) { s.curHpFrac = 1; s.curStatus = null; } persist(); playMusic('heal'); setTimeout(() => owEnterMusic(), 2600); owSay(tr('Your POKéMON are fully healed.\nWe hope to see you again!', '포켓몬이 모두 회복되었습니다.\n또 오세요!')); } if (d.shop) { OW.paused = true; openShop(); const iv = setInterval(() => { if (!document.querySelector('.pxov')) { clearInterval(iv); OW.paused = false; } }, 200); } }
}

// ---------- menu (C) ----------
const OW_MENU = [['party', 'POKéMON', '포켓몬'], ['dex', 'POKéDEX', '포켓몬 도감'], ['bag', 'BAG', '가방'], ['card', 'TRAINER', '트레이너'], ['save', 'SAVE', '저장'], ['opt', 'OPTIONS', '설정'], ['keys', 'CONTROLS', '조작 키'], ['quit', 'TITLE', '타이틀로'], ['exit', 'EXIT', '닫기']];
function owOpenMenu() { OW.menu = {i: OW.lastMenu || 0, sub: null}; }
function owMenuPress(b) {
  const M = OW.menu;
  if (M.sub === 'opt') return owOptPress(b);
  if (M.sub === 'party' || M.sub === 'summary' || M.sub === 'dex') return owListPress(M, b);
  if (M.sub) { if (b === 'B' || b === 'MENU' || b === 'A') M.sub = null; return; }
  if (b === 'B' || b === 'MENU') { OW.menu = null; return; }
  if (b === 'UP') M.i = (M.i + OW_MENU.length - 1) % OW_MENU.length;
  if (b === 'DOWN') M.i = (M.i + 1) % OW_MENU.length;
  if (b !== 'A') return;
  OW.lastMenu = M.i; const id = OW_MENU[M.i][0];
  if (id === 'exit') OW.menu = null;
  else if (id === 'bag') { OW.menu = null; OW.paused = true; openBag(false, () => { OW.paused = false; }); }
  else if (id === 'party' || id === 'card' || id === 'dex') { M.sub = id; M.pi = 0; M.di = M.di || 0; }
  else if (id === 'save') { persist(); OW.menu = null; owSay(tr('Your progress was saved.', '진행 상황을 저장했다.')); }
  else if (id === 'opt') { M.sub = 'opt'; M.oi = 0; }
  else if (id === 'keys') { OW.menu = null; OW.paused = true; openControls(() => { OW.paused = false; }); }
  else if (id === 'quit') { persist(); owQuit(); }
}

// ---------- wild battles ----------
function owWildBattle(wild) {
  const W2 = [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1]; let r = Math.random() * 100, k = 0;
  for (; k < wild.mons.length - 1; k++) { r -= W2[k] || 1; if (r < 0) break; }
  const [sp, lo, hi] = wild.mons[k]; if (!SP[sp]) return;
  const foe = worldSet(sp, lo + Math.floor(Math.random() * (hi - lo + 1)));
  SAVE[WSLOT].seen[sp] = 1;
  if (!SAVE[WSLOT].party.some(s => (s.curHpFrac ?? 1) > 0)) return;
  // the classic "wild Pokémon!" screen effect first: white flashes, then black bars closing in; the battle starts after it
  getSprite(foe.id, foe.shiny); for (const s of SAVE[WSLOT].party) getSprite(s.id, s.shiny);
  try { playMusic('battle_wild'); } catch (e) {}
  OW.trans = {t: 0, go: () => owStartWild(foe)};
}
const OW_TRANS = 1.35;
function owDrawTrans() {
  const T = OW.trans; if (!T) return; const t = T.t;
  if (t < 0.5) { const a = Math.max(0, Math.sin(t / 0.5 * Math.PI * 3)); ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`; ctx.fillRect(0, 0, W, H); return; }   // three white flashes
  const k = Math.min(1, (t - 0.5) / 0.7), n = 12, bh = H / n;   // black bars slide in from alternating sides
  ctx.fillStyle = '#000';
  for (let i = 0; i < n; i++) { const w = W * Math.min(1, k * (1 + i * 0.04)); if (i % 2) ctx.fillRect(W - w, i * bh, w + 1, bh + 1); else ctx.fillRect(0, i * bh, w + 1, bh + 1); }
}
function owStartWild(foe) {
  worldBag(); OW.active = false;
  const party = SAVE[WSLOT].party.map(s => JSON.parse(JSON.stringify(s)));
  for (const s of party) getSprite(s.id, s.shiny); getSprite(foe.id, foe.shiny);
  startBattle([party, [foe]], {map: 'field', ground: {map: OW.map, x: OW.x, y: OW.y}, swapCD: 20, auth: WSLOT === 'story' ? storyAuth() : {}, antiMode: 'reversal', wild: true, bag: true}, result => {
    if (WSLOT === 'story') storyAfterBattle(result);
    const B = OW.lastBattle; if (B) B.sides[0].mons.forEach((m, i) => { const s = SAVE[WSLOT].party[i]; if (!s) return; s.curHpFrac = m.fainted ? 0 : Math.max(0.01, m.hp / m.maxhp); s.curStatus = m.fainted ? null : (m.status || null); });
    battle = null;
    let caughtMsg = null;
    if (B && B.caught) {   // add the caught Pokémon to the party (or the PC box when the party is full)
      const c = B.caught, set = JSON.parse(JSON.stringify(foe)); set.curHpFrac = Math.max(0.01, c.hp / c.maxhp); set.curStatus = c.status || null;
      SAVE[WSLOT].caught = SAVE[WSLOT].caught || {}; SAVE[WSLOT].caught[foe.id] = 1; const nm = spName(SP[foe.id]);
      if (SAVE[WSLOT].party.length < 6) { SAVE[WSLOT].party.push(set); caughtMsg = tr(nm + ' joined your party!', nm + '이(가) 동료가 되었다!'); }
      else { (SAVE[WSLOT].box = SAVE[WSLOT].box || []).push(set); caughtMsg = tr(nm + ' was sent to the PC.', nm + '은(는) PC로 보내졌다.'); }
    }
    if (result === 'win') { SAVE[WSLOT].money = (SAVE[WSLOT].money || 0) + foe.level * 25; for (const s of SAVE[WSLOT].party) { const before = s.level || 5; s.level = Math.min(LEVEL_CAP, before + (foe.level >= before - 2 ? 1 : 0)); if (s.level !== before) { const mv = levelMoves(s.id, s.level); if (mv) s.moves = mv; } } }
    else { const st = OW.data.start; SAVE[WSLOT].map = st.map; SAVE[WSLOT].x = st.x; SAVE[WSLOT].y = st.y; for (const s of SAVE[WSLOT].party) { s.curHpFrac = 1; s.curStatus = null; } SAVE[WSLOT].money = Math.floor((SAVE[WSLOT].money || 0) / 2); }
    persist();
    cv.style.display = 'block'; document.body.classList.add('inbattle'); OW.active = true;
    const w = SAVE[WSLOT]; owEnterMap(w.map, w.x, w.y, w.dir); if (result !== 'win') owSay(tr('You hurried back home to rest…', '서둘러 집으로 돌아가 쉬었다…')); else if (caughtMsg) owSay(caughtMsg);
    owLastT = performance.now(); requestAnimationFrame(owLoop);
  });
  OW.lastBattle = battle;
}

// ---------- update ----------
let owLastT = 0;
function owLoop(t) {
  if (!OW.active || battle) return;
  const dt = Math.max(0, Math.min(0.05, (t - owLastT) / 1000)); owLastT = t;
  requestAnimationFrame(owLoop);   // keep the loop alive even if one frame fails
  if (OW.trans) { OW.trans.t += dt; if (OW.trans.t >= OW_TRANS) { const g = OW.trans.go; OW.trans = null; g(); return; } }
  else if (!OW.paused) owUpdate(dt);
  try { owDraw(); owDrawTrans(); } catch (err) { console.error(err); if (OW.menu && OW.menu.sub) OW.menu.sub = null; }
}
function owUpdate(dt) {
  OW.t += dt;
  if (OW.banner) { OW.banner.t -= dt; if (OW.banner.t <= 0) OW.banner = null; }
  if (OW.fadeTo) { OW.fade += dt * 4; if (OW.fade >= 1) { const f = OW.fadeTo; OW.fadeTo = null; f(); OW.fade = 1; } return; }
  if (OW.fade > 0) OW.fade = Math.max(0, OW.fade - dt * 3);
  if (OW.dialog) { const d = OW.dialog; d.shown = Math.min(d.pages[d.i].join('\n').length, d.shown + dt * 60); }
  // menu cursor via held direction (repeat)
  if (OW.menu && OW.menu.sub !== 'card') { const d = owDirHeld(); if (d !== OW.menuDir) { OW.menuDir = d; if (d === 1) owMenuPress('UP'); if (d === 0) owMenuPress('DOWN'); if (d === 2) owMenuPress('LEFT'); if (d === 3) owMenuPress('RIGHT'); } }
  else OW.menuDir = null;
  // player
  if (OW.moving) {
    const mv = OW.moving; mv.t += dt;
    if (mv.t >= mv.d) { if (mv.noWarp) { OW.moving = null; OW.x = mv.tx; OW.y = mv.ty; } else owStepDone(); }
  } else if (OW.autoWalk && OW.autoWalk.length && !OW.dialog) { owTryStep(OW.autoWalk.shift(), true); if (!OW.autoWalk.length && OW.autoWalkDone) { const f = OW.autoWalkDone; OW.autoWalkDone = null; setTimeout(f, WSTEP * 1000 + 30); } }
  else if (!OW.dialog && !OW.menu && !OW.script && !OW.choice && OW.fade <= 0.5) {
    const d = owDirHeld();
    if (d != null) {
      if (d !== OW.dir && !OW.turnT) { OW.dir = d; OW.turnT = 0.09; }
      else if (!(OW.turnT > 0)) owTryStep(d);
    } else OW.turnT = 0;
    if (OW.turnT > 0) OW.turnT = Math.max(0, OW.turnT - dt) || -1;
  }
  // NPCs: wander inside their range, look around
  const m = owM();
  for (const n of OW.npcs) {
    if (n.mv2) { n.mv2.t += dt; if (n.mv2.t >= WSTEP * 1.3) { n.x = n.mv2.tx; n.y = n.mv2.ty; n.mv2 = null; } continue; }
    if (OW.dialog && OW.dialog.npc === n) continue;
    if (n.path && n.path.length) { const d = n.path.shift(), [dx, dy] = DIRV[d]; n.dir = d; n.mv2 = {fx: n.x, fy: n.y, tx: n.x + dx, ty: n.y + dy, t: 0}; continue; }
    if (n.still || OW.script) continue;
    n.t -= dt; if (n.t > 0) continue; n.t = rnd(1.5, 4);
    if (/WANDER/.test(n.mv)) {
      const d = Math.floor(Math.random() * 4), [dx, dy] = DIRV[d], tx = n.x + dx, ty = n.y + dy; n.dir = d;
      if (Math.abs(tx - n.hx) > Math.max(1, n.rx) || Math.abs(ty - n.hy) > Math.max(1, n.ry)) continue;
      const pt = OW.moving ? [OW.moving.tx, OW.moving.ty] : [OW.x, OW.y];
      if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h || blocked(m, tx, ty) || (tx === OW.x && ty === OW.y) || (tx === pt[0] && ty === pt[1]) || owNpcAt(tx, ty) || m.warps.some(w => w.x === tx && w.y === ty)) continue;
      n.mv2 = {fx: n.x, fy: n.y, tx, ty, t: 0};
    } else if (/LOOK_AROUND|ROTATE|FACE_DOWN_AND_UP|FACE_LEFT_AND_RIGHT|UP_AND_DOWN|LEFT_AND_RIGHT/.test(n.mv)) n.dir = Math.floor(Math.random() * 4);
  }
}

// ---------- drawing ----------
function owPlayerPos() {
  const mv = OW.moving; if (!mv) return {x: OW.x, y: OW.y, hop: 0};
  const k = clamp(mv.t / mv.d, 0, 1); return {x: mv.fx + (mv.tx - mv.fx) * k, y: mv.fy + (mv.ty - mv.fy) * k, hop: mv.jump ? Math.sin(k * Math.PI) * 10 : 0};
}
function owDrawChar(sheet, x, y, dir, walking, phase, run) {
  const S = OW.data.sprites[sheet]; if (!S) return; const im = owImg('world/obj/' + S.img + '.png'); if (!im.complete || !im.naturalWidth) return;
  const n = im.naturalWidth / S.w;
  // frames: 0 down, 1 up, 2 left, 3-4 walk down, 5-6 walk up, 7-8 walk left; right = mirrored left
  const base = [0, 1, 2, 2][dir], walkBase = [3, 5, 7, 7][dir];
  let f = walking ? walkBase + (phase % 2) : base; if (n < 9) f = Math.min(f, n - 1);
  if (run && n >= 18) f += 9;
  const w = S.w * OW_SCALE, h = S.h * OW_SCALE;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x, y - 4, w * 0.32, 8, 0, 0, Math.PI * 2); ctx.fill();
  if (dir === 3) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(im, f * S.w, 0, S.w, S.h, -w / 2, y - h, w, h); }
  else ctx.drawImage(im, f * S.w, 0, S.w, S.h, x - w / 2, y - h, w, h);
  ctx.restore();
}
function owDraw() {
  owHits = [];
  const m = owM(); const p = owPlayerPos();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  // camera centred on the player (clamped only when the map is bigger than the screen)
  let cx = (p.x + 0.5) * TS - W / 2, cy = (p.y + 0.5) * TS - H / 2;
  const hasConn = d => m.conns.some(c => c.dir === d);
  if (m.w * TS > W) { if (!hasConn('left')) cx = Math.max(cx, 0); if (!hasConn('right')) cx = Math.min(cx, m.w * TS - W); } else cx = (m.w * TS - W) / 2;
  if (m.h * TS > H) { if (!hasConn('up')) cy = Math.max(cy, 0); if (!hasConn('down')) cy = Math.min(cy, m.h * TS - H); } else cy = (m.h * TS - H) / 2;
  if (OW.shake > 0) { cx += (Math.random() - 0.5) * OW.shake * 24; cy += (Math.random() - 0.5) * OW.shake * 24; OW.shake = Math.max(0, OW.shake - 1 / 60); }
  cx = Math.round(cx); cy = Math.round(cy); OW.cam = {x: cx, y: cy};
  ctx.save(); ctx.translate(-cx, -cy); ctx.imageSmoothingEnabled = false;
  const drawLayer = (name, ox, oy, top) => { const I = owMapImgs(name), im = top ? I.t : I.b; if (im && im.complete && im.naturalWidth) ctx.drawImage(im, ox * TS, oy * TS, im.naturalWidth * OW_SCALE, im.naturalHeight * OW_SCALE); };
  // border tiles everywhere past the edges (tiled 2x2 block, like the GBA)
  let bdr = owImg('world/maps/' + OW.map + '_border.png');
  if (bdr.complete && bdr.naturalWidth) OW.lastBdr = bdr; else if (OW.lastBdr) bdr = OW.lastBdr;   // not loaded yet: keep the previous map's edge tiles instead of a black flash
  if (bdr.complete && bdr.naturalWidth) { const bs = 2 * TS; for (let by = Math.floor(cy / bs) * bs; by < cy + H; by += bs) for (let bx = Math.floor(cx / bs) * bs; bx < cx + W; bx += bs) ctx.drawImage(bdr, bx, by, bs, bs); }
  for (const c of m.conns) { const [ox, oy] = conOffset(c); drawLayer(c.to, ox, oy, false); }
  drawLayer(OW.map, 0, 0, false);
  // characters sorted by y
  const chars = OW.npcs.filter(n => !n.hidden).map(n => { const k = n.mv2 ? clamp(n.mv2.t / (WSTEP * 1.3), 0, 1) : 0; return {npc: n, mon: n.mon, emote: n.emote, sheet: n.s, x: n.mv2 ? n.mv2.fx + (n.mv2.tx - n.mv2.fx) * k : n.x, y: n.mv2 ? n.mv2.fy + (n.mv2.ty - n.mv2.fy) * k : n.y, dir: n.dir, walk: !!n.mv2 && k < 0.5, ph: n.mv2 ? (n.mv2.tx + n.mv2.ty) & 1 : 0}; });
  const run = OW.moving ? OW.moving.d < WSTEP : OW.t - (OW.lastRunEnd ?? -9) < 0.12;   // stay in the running pose between running steps (no 1-frame pop to the walking pose)
  const who = 'player_' + ((SAVE[WSLOT] && SAVE[WSLOT].who) || 'brendan');
  if (WSLOT === 'story') storyFollower(chars, p);
  if (!OW.hidePlayer) chars.push({emote: OW.emote, sheet: who, x: p.x, y: p.y, dir: OW.dir, lying: OW.lying, walk: !!OW.moving && OW.moving.t / OW.moving.d < 0.5, ph: OW.stepAnim, hop: p.hop, run: run || false, moving: !!OW.moving});   // GBA style: foot forward for the first half of a step, standing for the second half
  chars.sort((a, b) => a.y - b.y);
  for (const c of chars) {
    const X = Math.round((c.x + 0.5) * TS), Y = Math.round((c.y + 1) * TS - (c.hop || 0) * OW_SCALE);   // whole pixels: no shimmer
    if (c.mon) owDrawMon(c.mon, X, Y, c.dir, c.walk || c.moving, c.npc);
    else if (c.lying) { ctx.save(); ctx.translate(X, Y - 12); ctx.rotate(-Math.PI / 2); owDrawChar(c.sheet, 0, 24, 0, false, 0, false); ctx.restore(); }
    else owDrawChar(c.sheet, X, Y, c.dir, c.walk, c.ph, c.run);
    if (c.emote) owDrawEmote(c.emote, X, Y - (c.mon ? TS * 1.4 : TS * 2.1));
  }
  for (const c of m.conns) { const [ox, oy] = conOffset(c); drawLayer(c.to, ox, oy, true); }
  drawLayer(OW.map, 0, 0, true);
  ctx.restore();
  if (OW.tint) { ctx.fillStyle = OW.tint; ctx.fillRect(0, 0, W, H); }
  if (OW.overlay) { try { OW.overlay(ctx, OW.t); } catch (e) { console.error(e); } }
  // map name banner
  if (OW.banner && !OW.overlay) { const k = clamp(Math.min(OW.banner.t, 2.2 - OW.banner.t) * 4, 0, 1); ctx.save(); ctx.translate(0, -60 * (1 - k)); owWindow(16, 12, 360, 70, true); owText(OW.banner.text, 40, 60, 34); ctx.restore(); }
  if (OW.toast) { OW.toast.t -= 1 / 60; if (OW.toast.t <= 0) OW.toast = null; else { owWindow(W / 2 - 150, 90, 300, 56, true); owText(OW.toast.text, W / 2, 128, 26, null, 'center'); } }
  // dialog box
  if (OW.dialog) {
    const d = OW.dialog, lines = d.pages[d.i]; let left = Math.floor(d.shown);
    owWindow(40, H - 190, W - 80, 170);
    if (d.who) { ctx.font = `32px ${OWF()}`; const tw = Math.max(150, ctx.measureText(d.who).width + 60); owWindow(56, H - 250, tw, 64, true); owText(d.who, 56 + tw / 2, H - 205, 32, d.whoColor || null, 'center'); }
    lines.forEach((ln, k) => { const s = ln.slice(0, Math.max(0, left)); left -= ln.length + 1; owText(s, 84, H - 120 + k * 56, 40); });
    if (d.shown >= lines.join('\n').length) { const pr = PRUI('prompt'); if (pr.complete) { ctx.imageSmoothingEnabled = false; const fr = Math.floor(OW.t * 6) % 3; ctx.drawImage(pr, 0, 0, 7, 8, W - 100, H - 70 + (fr === 1 ? 4 : 0), 21, 24); } else owText('▼', W - 100, H - 50, 30); }
  }
  // key guide (like the battle screen): what each button does out here
  if (OW.choice && !OW.dialog) owDrawChoice();
  if (!OW.menu && !OW.dialog && !OW.script && !OW.overlay) owDrawKeyGuide();
  // menu
  if (OW.menu) owDrawMenu();
  // touch controls
  if (IS_TOUCH && !OW.menu) owDrawTouch();
  if (OW.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp(OW.fade, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
  if (OW.fadeLvl > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp(OW.fadeLvl, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
}
function owDrawMenu() {
  const M = OW.menu;
  if (M.sub) return owDrawSub(M.sub);
  const x = W - 330, y = 16, rowH = 62;
  owWindow(x, y, 314, OW_MENU.length * rowH + 40);
  OW_MENU.forEach(([id, en, ko], i) => {
    const label = id === 'card' ? ((SAVE[WSLOT] && SAVE[WSLOT].name) || (SAVE[WSLOT] && SAVE[WSLOT].who === 'may' ? 'MAY' : 'BRENDAN')) : (LANG === 'ko' ? ko : en);
    owText(label, x + 60, y + 62 + i * rowH, 36);
    if (i === M.i) owCursor(x + 30, y + 58 + i * rowH, 24);
    owHits.push({x, y: y + 20 + i * rowH, w: 314, h: rowH, fn: () => { M.i = i; owMenuPress('A'); }});
  });
}
// ----- OPTIONS (in-game, like a Pokémon game's option screen) -----
function owOptRows() {
  const ko = LANG === 'ko', vol = v => ({bar: Math.round(v * 10)});
  return [
    [ko ? '배경음악' : 'MUSIC', vol(OPTS.music), d => { OPTS.music = clamp(Math.round(OPTS.music * 10 + d) / 10, 0, 1); }],
    [ko ? '효과음' : 'SOUND FX', vol(OPTS.sfx), d => { OPTS.sfx = clamp(Math.round(OPTS.sfx * 10 + d) / 10, 0, 1); }],
    [ko ? '달리기' : 'RUNNING', OPTS.runMode === 'hold' ? (ko ? '누르고 있기' : 'HOLD') : (ko ? '켜기/끄기' : 'TOGGLE'), () => { OPTS.runMode = OPTS.runMode === 'hold' ? 'toggle' : 'hold'; OW.runOn = OPTS.runMode !== 'hold'; }],
    [ko ? '화면 흔들림' : 'SCREEN SHAKE', OPTS.shake ? 'ON' : 'OFF', () => { OPTS.shake = !OPTS.shake; }],
    [ko ? '데미지 숫자' : 'DAMAGE NUMBERS', OPTS.dmgNums ? 'ON' : 'OFF', () => { OPTS.dmgNums = !OPTS.dmgNums; }],
    [ko ? '난이도' : 'DIFFICULTY', {easy: ko ? '쉬움' : 'EASY', normal: ko ? '보통' : 'NORMAL', hard: ko ? '어려움' : 'HARD'}[OPTS.difficulty || 'normal'], d => { const L = ['easy', 'normal', 'hard'], i = L.indexOf(OPTS.difficulty || 'normal'); OPTS.difficulty = L[(i + (d < 0 ? 2 : 1)) % 3]; }],
    [ko ? '배틀 시작' : 'BATTLE START', OPTS.autoStart ? (ko ? '자동' : 'AUTO') : (ko ? '직접 조작' : 'MANUAL'), () => { OPTS.autoStart = !OPTS.autoStart; }],
    [ko ? '언어' : 'LANGUAGE', LANG === 'ko' ? '한국어' : 'ENGLISH', () => { LANG = SAVE.lang = LANG === 'ko' ? 'en' : 'ko'; persist(); }],
    [ko ? '조작 키 설정' : 'CONTROLS…', '', null, () => { OW.menu = null; OW.paused = true; openControls(() => { OW.paused = false; }); }],
    [ko ? '모든 설정…' : 'ALL SETTINGS…', '', null, () => { OW.menu = null; OW.paused = true; settingsOverlay(() => { OW.paused = false; }); }],
    [ko ? '닫기' : 'CLOSE', '', null, () => { OW.menu.sub = null; }]];
}
function owOptPress(b) {
  const M = OW.menu, rows = owOptRows(), r = rows[M.oi];
  if (b === 'B' || b === 'MENU') { M.sub = null; return; }
  if (b === 'UP') M.oi = (M.oi + rows.length - 1) % rows.length;
  else if (b === 'DOWN') M.oi = (M.oi + 1) % rows.length;
  else if ((b === 'LEFT' || b === 'RIGHT') && r[2]) { r[2](b === 'LEFT' ? -1 : 1); saveOpts(); }
  else if (b === 'A') { if (r[3]) r[3](); else if (r[2]) { r[2](1); saveOpts(); } }
}
function owDrawOptions() {
  const M = OW.menu, rows = owOptRows(), x = 150, y = 24, w = W - 300, rowH = 54;
  owWindow(x, y, w, 146 + rows.length * rowH);
  owText(LANG === 'ko' ? '설정' : 'OPTIONS', x + 44, y + 62, 42);
  rows.forEach(([label, val, change, act], i) => {
    const ry = y + 92 + i * rowH;
    if (i === M.oi) { ctx.fillStyle = 'rgba(168,192,232,0.45)'; ctx.fillRect(x + 16, ry - 4, w - 32, rowH - 4); owCursor(x + 30, ry + 40, 22); }
    owText(label, x + 66, ry + 38, 32);
    if (val) {
      const vx = x + w - 330;
      if (change) { owText('◀', vx, ry + 38, 28, '#5068a8'); owText('▶', x + w - 60, ry + 38, 28, '#5068a8');
        owHits.push({x: vx - 10, y: ry - 4, w: 60, h: rowH, fn: () => { M.oi = i; change(-1); saveOpts(); }});
        owHits.push({x: x + w - 90, y: ry - 4, w: 70, h: rowH, fn: () => { M.oi = i; change(1); saveOpts(); }}); }
      if (typeof val === 'object') { for (let k = 0; k < 10; k++) { ctx.fillStyle = k < val.bar ? '#e05030' : '#d8dce8'; ctx.fillRect(x + w - 290 + k * 22, ry + 16, 16, 24); } }
      else owText(val, x + w - 175, ry + 38, 30, '#e05030', 'center');
    }
    owHits.push({x: x + 16, y: ry - 4, w: w - 360, h: rowH, fn: () => { M.oi = i; owOptPress('A'); }});
  });
  owText(LANG === 'ko' ? '↑↓ 고르기 · ←→ 바꾸기 · Z 닫기' : '↑↓ choose · ←→ change · Z close', x + w / 2, y + 120 + rows.length * rowH, 22, '#707078', 'center');
}
// ----- POKéMON list → summary, and the POKéDEX -----
function owDexList() {
  if (!OW.dexList) { const seen = new Set(); OW.dexList = Object.values(SP).filter(s => s.num >= 1 && s.num <= 386 && s.id === s.base && !seen.has(s.num) && seen.add(s.num)).sort((a, b) => a.num - b.num); }
  return OW.dexList;
}
function owListPress(M, b) {
  const party = SAVE[WSLOT].party || [];
  if (M.sub === 'party') {
    if (b === 'B' || b === 'MENU') M.sub = null;
    else if (b === 'UP') M.pi = (M.pi + party.length - 1) % Math.max(1, party.length);
    else if (b === 'DOWN') M.pi = (M.pi + 1) % Math.max(1, party.length);
    else if (b === 'A' && party[M.pi]) M.sub = 'summary';
  } else if (M.sub === 'summary') {
    if (b === 'B' || b === 'MENU' || b === 'A') M.sub = 'party';
    else if (b === 'UP' || b === 'LEFT') M.pi = (M.pi + party.length - 1) % party.length;
    else if (b === 'DOWN' || b === 'RIGHT') M.pi = (M.pi + 1) % party.length;
  } else if (M.sub === 'dex') {
    const n = owDexList().length;
    if (b === 'B' || b === 'MENU' || b === 'A') M.sub = null;
    else if (b === 'UP') M.di = (M.di + n - 1) % n; else if (b === 'DOWN') M.di = (M.di + 1) % n;
    else if (b === 'LEFT') M.di = Math.max(0, M.di - 8); else if (b === 'RIGHT') M.di = Math.min(n - 1, M.di + 8);
  }
}
function owTypeTag(t, x, y, w2) { ctx.fillStyle = TYPE_COLOR[t]; ctx.fillRect(x, y, w2, 32); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + 28, w2, 4); owText(tyName(t).toUpperCase(), x + w2 / 2, y + 25, 22, '#fff', 'center'); }
function owDrawSummary() {
  const M = OW.menu, party = SAVE[WSLOT].party, s = party[M.pi]; if (!s) { M.sub = 'party'; return; }
  const sp = SP[s.id] || SP[toID(s.id)], mon = new Mon(s, 0), ko = LANG === 'ko';
  owWindow(40, 24, W - 80, H - 48);
  // left: picture + basics
  owWindow(64, 50, 400, 330, true);
  const pt = getPortrait(s.id, s.shiny); if (pt.img) { ctx.imageSmoothingEnabled = false; if (pt.crop) ctx.drawImage(pt.img, 16, 10, 64, 64, 144, 74, 240, 240); else ctx.drawImage(pt.img, 144, 74, 240, 240); }
  owText((s.shiny ? '★ ' : '') + spName(sp), 84, 350, 34); owText('Lv' + mon.level, 444, 350, 30, null, 'right');
  sp.t.forEach((t, k) => owTypeTag(t, 84 + k * 130, 396, 120));
  const fr = s.curHpFrac ?? 1, hp = Math.max(0, Math.round(mon.maxhp * fr));
  owText('HP', 84, 476, 28); ctx.fillStyle = '#505060'; ctx.fillRect(140, 456, 300, 20); ctx.fillStyle = fr > 0.5 ? '#38c050' : fr > 0.2 ? '#e0b020' : '#e04030'; ctx.fillRect(143, 459, 294 * fr, 14);
  owText(hp + ' / ' + mon.maxhp, 440, 512, 26, null, 'right');
  owText((ko ? '성격: ' : 'NATURE: ') + (ko && NATURES[s.nature] ? NATURES[s.nature][2] : (s.nature || '-')), 84, 562, 26);
  owText((ko ? '특성: ' : 'ABILITY: ') + abName(s.ability || sp.ab[0]), 84, 600, 26);
  if (s.curStatus) owText((ko ? '상태: ' : 'STATUS: ') + s.curStatus.toUpperCase(), 84, 638, 26, '#e05030');
  // right: stats + moves
  const rx = 500;
  owText(ko ? '능력치' : 'STATS', rx, 92, 32, '#5068a8');
  const nat = NATURES[s.nature] || [];
  [['atk', ko ? '공격' : 'ATTACK'], ['def', ko ? '방어' : 'DEFENSE'], ['spa', ko ? '특수공격' : 'SP. ATK'], ['spd', ko ? '특수방어' : 'SP. DEF'], ['spe', ko ? '스피드' : 'SPEED']].forEach(([k, lab], i) => {
    const y = 134 + i * 40, c = nat[0] === k ? '#e05030' : nat[1] === k ? '#3068c8' : null;
    owText(lab, rx, y, 26, c); owText(String(Math.round(mon.stats[k])), rx + 330, y, 26, c, 'right');
    ctx.fillStyle = '#d8dce8'; ctx.fillRect(rx + 350, y - 16, 330, 12); ctx.fillStyle = c || '#58a0e0'; ctx.fillRect(rx + 350, y - 16, 330 * Math.min(1, sp.bs[['hp', 'atk', 'def', 'spa', 'spd', 'spe'].indexOf(k)] / 180), 12);
  });
  owText(ko ? '기술' : 'MOVES', rx, 364, 32, '#5068a8');
  (s.moves || []).slice(0, 4).forEach((id, i) => {
    const mv = MV[MVI[id]]; if (!mv) return; const y = 382 + i * 64;
    owTypeTag(mv.t, rx, y, 110); owText(mvName(mv), rx + 126, y + 26, 28);
    owText((mv.c === 'X' ? (ko ? '변화' : 'STATUS') : (ko ? '위력 ' : 'POW ') + (mv.bp || '-')) + '  PP ' + (mv.pp ? Math.floor(mv.pp * 8 / 5) : 1), rx + 690, y + 26, 22, '#707078', 'right');
  });
  owText(party.length > 1 ? (ko ? '←→ 다른 포켓몬 · Z 뒤로' : '←→ other Pokémon · Z back') : (ko ? 'Z 뒤로' : 'Z back'), W - 70, H - 46, 22, '#707078', 'right');
  if (party.length > 1) { owHits.push({x: 0, y: 0, w: 60, h: H, fn: () => owListPress(M, 'LEFT')}); owHits.push({x: W - 60, y: 0, w: 60, h: H, fn: () => owListPress(M, 'RIGHT')}); owText('◀', 6, H / 2, 40, '#ffffff'); owText('▶', W - 6, H / 2, 40, '#ffffff', 'right'); }
  owHits.push({x: 60, y: 0, w: W - 120, h: H, fn: () => { M.sub = 'party'; }});
}
function owDrawDex() {
  const M = OW.menu, list = owDexList(), w2 = SAVE[WSLOT], ko = LANG === 'ko', seen = w2.seen || {}, caught = w2.caught || {};
  const isSeen = s => seen[s.id] || caught[s.id] || (w2.party || []).some(p => (SP[p.id] || {}).base === s.id);
  const isCaught = s => caught[s.id] || (w2.party || []).some(p => (SP[p.id] || {}).base === s.id);
  owWindow(40, 24, W - 80, H - 48);
  owText('POKéDEX', 80, 84, 42);
  owText((ko ? '본 수 ' : 'SEEN ') + list.filter(isSeen).length + '   ' + (ko ? '잡은 수 ' : 'OWN ') + list.filter(isCaught).length, W - 90, 84, 28, '#5068a8', 'right');
  // list on the left
  const rows = 11, top = Math.max(0, Math.min(list.length - rows, M.di - 5));
  for (let i = 0; i < rows; i++) {
    const k = top + i, s = list[k]; if (!s) break; const y = 104 + i * 50, on = k === M.di;
    if (on) { ctx.fillStyle = 'rgba(168,192,232,0.5)'; ctx.fillRect(64, y, 470, 48); owCursor(76, y + 36, 20); }
    owText('No' + String(s.num).padStart(3, '0'), 104, y + 36, 26, '#707078');
    owText(isSeen(s) ? spName(s) : '-----', 230, y + 36, 28);
    if (isCaught(s)) { ctx.fillStyle = '#e05030'; ctx.beginPath(); ctx.arc(510, y + 25, 9, 0, Math.PI * 2); ctx.fill(); }
    owHits.push({x: 64, y, w: 470, h: 48, fn: () => { M.di = k; }});
  }
  // up / down buttons for touch
  owText('▲', 300, 100, 26, '#5068a8', 'center'); owHits.push({x: 240, y: 70, w: 120, h: 34, fn: () => owListPress(M, 'LEFT')});
  owText('▼', 300, H - 46, 26, '#5068a8', 'center'); owHits.push({x: 240, y: H - 76, w: 120, h: 40, fn: () => owListPress(M, 'RIGHT')});
  // details on the right
  const s = list[M.di]; owWindow(570, 110, W - 650, H - 190, true);
  if (s && isSeen(s)) {
    const pt = getPortrait(s.id, false); if (pt.img) { ctx.imageSmoothingEnabled = false; if (pt.crop) ctx.drawImage(pt.img, 16, 10, 64, 64, 600, 140, 200, 200); else ctx.drawImage(pt.img, 600, 140, 200, 200); }
    owText('No' + String(s.num).padStart(3, '0'), 830, 180, 30, '#707078'); owText(spName(s), 830, 226, 38);
    s.t.forEach((t, k) => owTypeTag(t, 830 + k * 130, 250, 120));
    owText((ko ? '키 ' : 'HT ') + (s.h || '?') + ' m   ' + (ko ? '몸무게 ' : 'WT ') + (s.w || '?') + ' kg', 600, 400, 28);
    owText(isCaught(s) ? (ko ? '잡았다!' : 'Caught!') : (ko ? '본 적 있다' : 'Seen only'), 600, 450, 28, isCaught(s) ? '#38a050' : '#707078');
  } else owText(ko ? '아직 만나지 못했다' : 'Not seen yet', 600, 200, 30, '#909098');
  owText(ko ? '↑↓ 고르기 · ←→ 8칸 · Z 닫기' : '↑↓ choose · ←→ jump 8 · Z close', W - 90, H - 46, 22, '#707078', 'right');
  owHits.push({x: W - 300, y: H - 80, w: 260, h: 50, fn: () => { M.sub = null; }});
}
function owDrawSub(id) {
  if (id === 'opt') return owDrawOptions();
  if (id === 'summary') return owDrawSummary();
  if (id === 'dex') return owDrawDex();
  owWindow(60, 40, W - 120, H - 80);
  if (id !== 'party') owHits.push({x: 0, y: 0, w: W, h: H, fn: () => { OW.menu.sub = null; }});
  else owHits.push({x: 0, y: 0, w: W, h: H, fn: () => { OW.menu.sub = null; }});
  const w = SAVE[WSLOT];
  if (id === 'party') {
    owText(LANG === 'ko' ? '포켓몬' : 'POKéMON', 110, 110, 44);
    (w.party || []).forEach((s, i) => {
      const sp = SP[s.id] || SP[toID(s.id)], y = 150 + i * 80;
      owWindow(100, y, W - 200, 70, true); if (i === OW.menu.pi) { owCursor(76, y + 48, 20); ctx.strokeStyle = '#e05030'; ctx.lineWidth = 3; ctx.strokeRect(108, y + 8, W - 216, 54); }
      owHits.push({x: 100, y, w: W - 200, h: 70, fn: () => { OW.menu.pi = i; OW.menu.sub = 'summary'; }});
      const pt = getPortrait(s.id, s.shiny); if (pt.img) { ctx.imageSmoothingEnabled = false; if (pt.crop) ctx.drawImage(pt.img, 16, 10, 64, 64, 120, y + 8, 54, 54); else ctx.drawImage(pt.img, 120, y + 8, 54, 54); }
      owText(sp ? spName(sp) : s.id, 200, y + 48, 34); owText('Lv' + (s.level || 5), 520, y + 48, 32);
      const fr = s.curHpFrac ?? 1; ctx.fillStyle = '#14161f'; ctx.fillRect(620, y + 26, 160, 16); ctx.fillStyle = fr > 0.5 ? '#2fa84a' : fr > 0.2 ? '#d9a521' : '#c9353d'; ctx.fillRect(620, y + 26, 160 * fr, 16); owText(fr <= 0 ? (LANG === 'ko' ? '기절' : 'FNT') : s.curStatus ? s.curStatus.toUpperCase() : Math.round(fr * 100) + '%', 700, y + 62, 20, '#606070', 'center');
      if (sp) (sp.t || []).forEach((t, k) => { ctx.fillStyle = TYPE_COLOR[t]; ctx.fillRect(810 + k * 130, y + 18, 120, 34); owText(tyName(t).toUpperCase(), 870 + k * 130, y + 46, 24, '#fff', 'center'); });
    });
  } else if (id === 'card') {
    const nm = w.name || (w.who === 'may' ? 'MAY' : 'BRENDAN');
    owText((LANG === 'ko' ? '돈: ₽' : 'MONEY: ₽') + (w.money || 0), 140, 320, 40);
    owText(LANG === 'ko' ? '트레이너 카드' : 'TRAINER CARD', 110, 110, 44);
    owText((LANG === 'ko' ? '이름: ' : 'NAME: ') + nm, 140, 200, 40);
    owText((LANG === 'ko' ? '도감: 본 포켓몬 ' : 'POKéDEX seen: ') + Object.keys(w.seen || {}).length, 140, 260, 40);
    owDrawChar('player_' + w.who, W - 260, 420, 0, false, 0);
  } else {
    owText(id === 'dex' ? 'POKéDEX' : (LANG === 'ko' ? '가방' : 'BAG'), 110, 110, 44);
    owText(LANG === 'ko' ? '아직 준비 중입니다.' : 'Coming soon.', 140, 200, 38);
    if (id === 'dex') owText((LANG === 'ko' ? '본 포켓몬: ' : 'Seen: ') + Object.keys(w.seen || {}).map(k => SP[k] ? spName(SP[k]) : k).join(', '), 140, 260, 30);
  }
  owText(id === 'party' ? (LANG === 'ko' ? 'X / 탭: 자세히 보기 · Z 닫기' : 'X / tap: summary · Z close') : (LANG === 'ko' ? 'Z / 탭: 닫기' : 'Z / tap: close'), W - 120, H - 70, 30, '#707078', 'right');
}
let owHits = [];
function owDrawKeyGuide() {
  const ko = LANG === 'ko';
  const items = IS_TOUCH ? [] : [[[keyOf('fUp'), keyOf('fLeft'), keyOf('fDown'), keyOf('fRight')].join(''), ko ? '이동' : 'Move'], [keyOf('confirm'), ko ? '확인·말걸기' : 'Talk / OK'], [keyOf('cancel'), ko ? '취소' : 'Cancel'],
    [keyOf('menu'), ko ? '메뉴' : 'Menu'], ...(OPTS.runMode === 'hold' ? [[keyOf('run'), ko ? '달리기(누르기)' : 'Run (hold)']] : [[keyOf('runToggle'), (ko ? '달리기 ' : 'Run ') + (OW.runOn ? 'ON' : 'OFF')]]), WSLOT === 'story' ? [keyOf('bike'), ko ? '달리기 ' + (OW.runLv === 2 ? '2' : '1') : 'Run ' + (OW.runLv === 2 ? '2' : '1')] : [keyOf('bike'), ko ? '자전거' : 'Bike']];   // no bicycles in ancient Sinnoh: Run 1 / Run 2 instead
  if (!items.length) return;
  ctx.save(); ctx.font = '700 15px ' + PIXF; ctx.textBaseline = 'middle';
  let tw = 0; const parts = items.map(([k, l]) => { const kw = ctx.measureText(k).width + 14, lw = ctx.measureText(l).width; tw += kw + lw + 22; return [k, l, kw, lw]; });
  let x = W / 2 - tw / 2; const y = H - 30;
  ctx.fillStyle = 'rgba(16,18,30,0.72)'; ctx.fillRect(x - 12, y - 18, tw + 14, 36);
  for (const [k, l, kw, lw] of parts) {
    ctx.fillStyle = '#ffd34a'; ctx.fillRect(x, y - 11, kw, 22); ctx.fillStyle = '#1d2033'; ctx.textAlign = 'center'; ctx.fillText(k, x + kw / 2, y + 1);
    ctx.fillStyle = '#f2f4ff'; ctx.textAlign = 'left'; ctx.fillText(l, x + kw + 6, y + 1); x += kw + lw + 22;
  }
  ctx.restore();
}
// touch: joystick on the left half, A / B / menu buttons on the right
function owDrawTouch() {
  if (!OW.joy && JOY_FIXED()) { const C = JOY_C(); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(C.x, C.y, 70, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(80,140,255,0.45)'; ctx.beginPath(); ctx.arc(C.x, C.y, 30, 0, Math.PI * 2); ctx.fill(); }
  if (OW.joy) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(OW.joy.ox, OW.joy.oy, 70, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(80,140,255,0.8)'; ctx.beginPath(); ctx.arc(OW.joy.x, OW.joy.y, 30, 0, Math.PI * 2); ctx.fill();
  }
  const btnC = (x, y, r, label, col, fn, holdB, sub) => {
    ctx.fillStyle = col; ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff'; ctx.font = '900 26px ' + FF; ctx.textAlign = 'center'; ctx.fillText(label, x, y + 9);
    if (sub) { ctx.font = '700 14px ' + PIXF; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(sub, x, y + r + 18); ctx.fillText(sub, x, y + r + 18); }
    owHits.push({x: x - r, y: y - r, w: r * 2, h: r * 2, fn, holdB});
  };
  const ko = LANG === 'ko';
  btnC(W - 90, H - 170, 52, 'A', '#2fb35a', () => owPress('A'), false, ko ? '확인·말걸기' : 'Talk / OK');
  btnC(W - 200, H - 100, 46, 'B', '#d9443a', () => owPress('B'), true, OPTS.runMode === 'hold' ? (ko ? '취소 · 누르면 달리기' : 'Cancel · hold to run') : (ko ? '취소 · 누르면 걷기' : 'Cancel · hold to walk'));
  if (WSLOT === 'story' && !OW.script) btnC(W - 90, H - 300, 38, OW.runLv === 2 ? '»»' : '»', '#c06a2a', () => owToggleSprint(), false, ko ? '달리기 ' + (OW.runLv === 2 ? '2' : '1') : 'Run ' + (OW.runLv === 2 ? '2' : '1'));
  if (!OW.script) btnC(W - 70, 70, 36, '☰', '#3a5fcf', () => owPress('MENU'), false, ko ? '메뉴' : 'Menu');
}
(function owPointer() {
  const toC = e => { const r = cv.getBoundingClientRect(); if (cv._rot) return rotPt(e); return {x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H}; };
  const attach = () => {
    if (!cv) return setTimeout(attach, 200);
    cv.addEventListener('pointerdown', e => {
      if (!OW.active || battle) return;
      const {x, y} = toC(e);
      for (let i = owHits.length - 1; i >= 0; i--) { const h = owHits[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) { if (h.holdB) { OW.bHeld = true; OW.bId = e.pointerId; } h.fn(); return; } }
      const C = JOY_C(); if (JOY_FIXED() && Math.hypot(x - C.x, y - C.y) > 200) return;
      if (x < W / 2 && !OW.joy) { OW.joy = JOY_FIXED() ? {id: e.pointerId, ox: C.x, oy: C.y, x, y, d: null, fixed: true} : {id: e.pointerId, ox: x, oy: y, x, y, d: null}; try { cv.setPointerCapture(e.pointerId); } catch (er) {} }
    });
    cv.addEventListener('pointermove', e => {
      if (!OW.joy || e.pointerId !== OW.joy.id) return;
      const {x, y} = toC(e); const j = OW.joy; j.x = x; j.y = y; const dx = x - j.ox, dy = y - j.oy, l = Math.hypot(dx, dy);
      if (l > 70) { if (j.fixed) { j.x = j.ox + dx / l * 70; j.y = j.oy + dy / l * 70; } else { j.ox = x - dx / l * 70; j.oy = y - dy / l * 70; } }
      j.d = l < 18 ? null : Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
      if (OW.menu && !OW.menu.sub && j.d != null) { /* menu moves via owUpdate */ }
    });
    const end = e => { if (OW.joy && e.pointerId === OW.joy.id) OW.joy = null; if (e.pointerId === OW.bId) OW.bHeld = false; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  };
  attach();
})();

// Story: Run 1 (normal run) / Run 2 (sprint, about bicycle speed). Switching to Run 2 also turns running on.
function owToggleSprint() {
  OW.runLv = OW.runLv === 2 ? 1 : 2;
  if (OW.runLv === 2 && OPTS.runMode !== 'hold') OW.runOn = true;
  OW.toast = {text: OW.runLv === 2 ? tr('Run 2 — sprint!', '달리기 2 — 전력 질주!') : tr('Run 1', '달리기 1'), t: 1.2};
  try { localStorage.setItem('pkrt_runlv', OW.runLv); } catch (e) {}
}
try { OW.runLv = +localStorage.getItem('pkrt_runlv') === 2 ? 2 : 1; } catch (e) { OW.runLv = 1; }
