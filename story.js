// ===== STORY MODE — Chapter 1: The Ashen Tribe =====
// Ancient Sinnoh, long before people had a word for "Pokémon". Creatures are just "monsters", wilder than in Hisui.
// Scripts are small async functions; each await waits for the player (text, choices) or for something to finish (walking, fades).

const STORY_DEFAULT_BABIES = ['riolu', 'froakie', 'dreepy'];   // the official trio: Dialga (Steel) · Palkia (Water) · Giratina (Ghost/Dragon)
const STORY_AUTH = {
  time:  {god: 'dialga',   part: () => tr('right arm', '오른팔'), name: () => tr('Time', '시간'),    en: 'DIALGA',   ko: '디아루가', col: '#5aa9ff'},
  space: {god: 'palkia',   part: () => tr('left arm', '왼팔'),   name: () => tr('Space', '공간'),   en: 'PALKIA',   ko: '펄기아',   col: '#c48cff'},
  anti:  {god: 'giratina', part: () => tr('chest', '가슴'),      name: () => tr('Antimatter', '반물질'), en: 'GIRATINA', ko: '기라티나', col: '#ff5a7a'},
};
const ST = () => SAVE.story;
const flag = k => !!(ST() && ST().flags[k]);
const setFlag = (k, v = true) => { ST().flags[k] = v; persist(); };
const kidName = () => (ST() && ST().name) || tr('Kid', '아이');
function storyTitle(t) { return ({'Ashen Village': tr('ASHEN VILLAGE', '잿빛 마을'), 'Ashen Fields': tr('ASHEN FIELDS', '잿빛 들판')})[t] || ''; }
function storyAuth() { const a = (ST() && ST().auths) || {}; return {time: !!a.time, space: !!a.space, anti: !!a.anti}; }

// ---------- script helpers ----------
const sleep = s => new Promise(r => setTimeout(r, s * 1000));
function say(text, who, opt) {
  return new Promise(res => { owSay(text.replace(/\{K\}/g, kidName()), opt && opt.npc, res, who); if (OW.dialog && opt && opt.color) OW.dialog.whoColor = opt.color; });
}
const narr = t => say(t);   // narration: no speaker
function choose(opts, title) { return new Promise(res => { OW.choice = {opts, i: 0, title, res}; }); }
function owChoicePress(b) {
  const C = OW.choice; if (!C) return;
  if (b === 'UP') C.i = (C.i + C.opts.length - 1) % C.opts.length;
  else if (b === 'DOWN') C.i = (C.i + 1) % C.opts.length;
  else if (b === 'A') { OW.choice = null; C.res(C.i); }
}
function owDrawChoice() {
  const C = OW.choice, rowH = 70, w = Math.min(W - 80, Math.max(420, (C.title || '').length * 19 + 90, ...C.opts.map(o => o.length * 21 + 120))), h = C.opts.length * rowH + 40 + (C.title ? 60 : 0);
  const x = 40, y = Math.max(20, H - 210 - h);   // left side: the scene stays visible on the right
  owWindow(x, y, w, h);
  if (C.title) owText(C.title, x + 40, y + 58, 32, '#506090');
  C.opts.forEach((o, i) => {
    const yy = y + (C.title ? 60 : 0) + 64 + i * rowH; owText(o, x + 72, yy, 34);
    if (i === C.i) owCursor(x + 40, yy - 4, 24);
    owHits.push({x, y: yy - 46, w, h: rowH, fn: () => { C.i = i; owChoicePress('A'); }});
  });
}
function fadeOut(s = 0.6) { return new Promise(r => { const t0 = performance.now(); OW.overlayFade = 0; const tick = () => { OW.fadeLvl = clamp((performance.now() - t0) / (s * 1000), 0, 1); if (OW.fadeLvl < 1) requestAnimationFrame(tick); else r(); }; tick(); }); }
function fadeIn(s = 0.6) { return new Promise(r => { const t0 = performance.now(); const tick = () => { OW.fadeLvl = 1 - clamp((performance.now() - t0) / (s * 1000), 0, 1); if (OW.fadeLvl > 0) requestAnimationFrame(tick); else { OW.fadeLvl = 0; r(); } }; tick(); }); }
function walkPlayer(dirs) { return new Promise(r => { OW.autoWalk = dirs.slice(); OW.autoWalkDone = r; }); }
function walkNpc(n, dirs) { return new Promise(r => { n.path = dirs.slice(); const chk = () => { if (!n.path.length && !n.mv2) r(); else setTimeout(chk, 50); }; chk(); }); }
function face(n, d) { n.dir = d; }
function emote(target, e, s = 0.9) { if (target === 'player') { OW.emote = e; setTimeout(() => { if (OW.emote === e) OW.emote = null; }, s * 1000); } else { target.emote = e; setTimeout(() => { if (target.emote === e) target.emote = null; }, s * 1000); } return sleep(s * 0.8); }
function npcById(id) { return OW.npcs.find(n => n.id === id); }
async function storyRun(fn, npc) {
  if (OW.script) return;
  OW.script = true;
  try { await fn(npc); } catch (e) { console.error(e); }
  OW.script = false; OW.overlay = null; OW.tint = null;
}
function warpTo(map, x, y, dir) { owEnterMap(map, x, y, dir ?? 0); }

// ---------- drawing monsters in the overworld (PMD sprites) ----------
function owDrawMon(id, X, Y, dir, walking, npc) {
  const e = getSprite(id, npc && npc.shiny); if (!e.ready || !e.data) return;
  const D = e.data;
  if (D.type === 'pmd') {
    const A = D.anims, a = (npc && npc.anim && A[npc.anim]) || (walking && A.Walk) || A.Idle || A.Walk; if (!a) return;
    const fi = animFrame(a, OW.t + (npc ? (npc.x * 0.37) : 0), true), row = Math.min([0, 4, 6, 2][dir ?? 0], a.rows - 1);
    const sc = OW_SCALE * (npc && npc.scale || 1);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(X, Y - 6, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(a.img, fi * a.fw, row * a.fh, a.fw, a.fh, X - a.fw * sc / 2, Y - 10 - a.fh * sc * 0.62, a.fw * sc, a.fh * sc);
    ctx.restore();
  } else if (D.front) {
    const img = D.front, sc = 1.2; ctx.drawImage(img, X - img.width * sc / 2, Y - img.height * sc, img.width * sc, img.height * sc);
  }
}
function owDrawEmote(e, X, Y) {
  ctx.save(); owWindow(X - 26, Y - 52, 52, 52, true);
  ctx.font = 'bold 34px ' + OWF(); ctx.textAlign = 'center'; ctx.fillStyle = e === '!' ? '#e03030' : e === '♥' ? '#ff5a8a' : '#304070'; ctx.fillText(e, X, Y - 14); ctx.restore();
}
// the partner walks one tile behind you
function storyFollower(chars, p) {
  const s = ST(); if (!s || !flag('partner') || !s.party.length || OW.hideFollower || owM().type === 'MAP_TYPE_INDOOR') return;
  const t = (OW.trail && OW.trail[0]) || {x: OW.x, y: OW.y + 1};
  let fx = t.x, fy = t.y;
  if (OW.moving && OW.trail && OW.trail[1]) { const k = clamp(OW.moving.t / OW.moving.d, 0, 1); fx = OW.trail[1].x + (t.x - OW.trail[1].x) * k; fy = OW.trail[1].y + (t.y - OW.trail[1].y) * k; }
  if (Math.abs(fx - p.x) + Math.abs(fy - p.y) > 2.5) { fx = p.x; fy = p.y + 0.6; }   // just arrived on a map
  const dx = p.x - fx, dy = p.y - fy, dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : (dy > 0 ? 0 : 1);
  chars.push({mon: s.party[0].id, x: fx, y: fy, dir, moving: !!OW.moving, npc: {x: 0, shiny: s.party[0].shiny}});
}

// ---------- new game ----------
function storyNewGame() {
  const root = $('#setup'); root.innerHTML = ''; root.style.display = 'block';
  let who = 'brendan', name = '', babies = STORY_DEFAULT_BABIES.slice(), custom = false;
  const firstStage = s => !s.pre && s.evo && !s.leg && !s.ub && !NOT_FOR_TRAINERS(s) && !(typeof isGod === 'function' && isGod(s)) && !s.fm;
  const draw = () => {
    root.innerHTML = '';
    const nameIn = el('input', {value: name, placeholder: tr('Your name', '이름'), maxLength: 10, style: 'font-size:22px;padding:8px;width:220px', on: {input: e => { name = e.target.value; go.disabled = !name.trim(); }}});
    const go = el('button', {className: 'big', disabled: !name.trim(), on: {click: () => {
      SAVE.story = {map: OW.data.start.map, x: OW.data.start.x, y: OW.data.start.y, dir: 0, who, name: name.trim().slice(0, 10), party: [], box: [], seen: {}, caught: {}, bag: {}, quick: [], money: 0, flags: {}, babies, auths: {}};
      persist(); startWorld('story');
    }}}, tr('▶ Begin', '▶ 시작'));
    root.append(el('div', {className: 'home'},
      el('div', {className: 'logo'}, tr('Story', '스토리')),
      el('div', {className: 'sub'}, tr('Chapter 1 — The Ashen Tribe', '1장 — 잿빛 부족')),
      el('h3', {}, tr('Who are you?', '당신은 누구인가요?')),
      el('div', {className: 'pickgrid'}, ...['brendan', 'may'].map(p => el('div', {className: 'pickcard' + (who === p ? ' sel' : ''), on: {click: () => { who = p; draw(); }}},
        el('div', {style: `width:48px;height:96px;background:url(world/obj/player_${p}.png) 0 0/${18 * 48}px 96px;image-rendering:pixelated`}), p === 'brendan' ? tr('Boy', '남자') : tr('Girl', '여자')))),
      el('div', {className: 'row'}, nameIn),
      el('h3', {}, tr('The three little monsters', '세 마리의 작은 몬스터')),
      el('div', {className: 'small'}, tr('In the story it is Riolu, Froakie and Dreepy. You can pick your own three (non-legendary, first stage).', '스토리에서는 리오르, 개구마르, 드라꼰이에요. 직접 세 마리를 고를 수도 있어요 (전설 제외, 1단계).')),
      el('div', {className: 'pickgrid'}, ...babies.map((id, k) => el('div', {className: 'pickcard', on: {click: () => { if (!custom) return; openPicker(sp => { if (!firstStage(sp)) { alert(tr('Pick a first-stage, non-legendary monster.', '1단계 일반 몬스터만 고를 수 있어요.')); return; } if (babies.includes(sp.id)) return; babies[k] = sp.id; draw(); }); }}},
        el('img', {className: 'pt', src: portraitURL(SP[id], false)}), spName(SP[id]), custom ? el('div', {className: 'small'}, tr('tap to change', '눌러서 바꾸기')) : null))),
      el('div', {className: 'row'},
        el('button', {style: custom ? '' : 'background:#e8a317;color:#1b1b2b', on: {click: () => { custom = false; babies = STORY_DEFAULT_BABIES.slice(); draw(); }}}, (custom ? '' : '✓ ') + tr('Story three', '스토리 기본')),
        el('button', {style: custom ? 'background:#e8a317;color:#1b1b2b' : '', on: {click: () => { custom = true; draw(); }}}, (custom ? '✓ ' : '') + tr('Choose my own', '직접 고르기'))),
      go, el('button', {on: {click: renderHome}}, tr('Back', '뒤로'))));
    if (first && !IS_TOUCH) setTimeout(() => nameIn.focus(), 50);   // only once, and never on phones (it pops the keyboard up)
    first = false;
  };
  let first = true;
  draw();
}

// ---------- NPCs per map (who stands where, depending on story progress) ----------
function storyNpcs(map) {
  const L = [];
  const add = (o) => L.push(Object.assign({dir: 0, mv: '', rx: 1, ry: 1, t: 2, still: true}, o));
  if (map === 'S_AshenVillage_Home') {
    add({id: 'mom', s: 'woman_5', x: 3, y: 4, dir: 0, talk: talkMom});
    if (flag('backHome') ) add({id: 'dad', s: 'man_5', x: 8, y: 4, dir: 0, talk: talkDad});
  }
  if (map === 'S_AshenVillage') {
    add({id: 'v1', s: 'man_1', x: 12, y: 15, dir: 3, mv: 'WANDER', still: false, talk: () => say(flag('partner') ? tr("Keep that thing on a short leash, kid.\nIf it bites someone, the hunters will deal with it.", '그 녀석 잘 붙잡고 있어라.\n누굴 물기라도 하면 사냥꾼들이 처리할 거다.') : tr("The fire pit burns day and night.\nMonsters fear the flames… most of them.", '불구덩이는 밤낮으로 타오르지.\n몬스터들은 불을 무서워해… 대부분은.'), tr('Villager', '마을 사람'))});
    add({id: 'v2', s: 'girl_1', x: 20, y: 16, dir: 0, mv: 'WANDER', still: false, talk: () => say(flag('partner') ? tr('Is it… really not going to eat us?', '정말… 우리를 잡아먹지 않는 거야?') : tr('Mother says monsters took my uncle.\nI never go past the fields.', '엄마가 그러는데 몬스터가 삼촌을 데려갔대.\n난 절대 들판 너머로 안 가.'), tr('Girl', '소녀'))});
    add({id: 'v3', s: 'woman_4', x: 26, y: 15, dir: 0, talk: () => say(tr('The crops grow slowly in this ash.\nBut the ash also keeps the bigger monsters away.', '이 잿빛 땅에선 작물이 더디게 자라.\n그래도 재 덕분에 큰 몬스터들은 오지 않지.'), tr('Farmer', '농부'))});
    add({id: 'guard', s: 'black_belt', x: 33, y: 13, dir: 2, talk: () => say(flag('partner') ? tr("Hm. You came back with a monster…\nGo see the Elder before the whole village panics.", '흠. 몬스터를 데리고 돌아왔군…\n마을이 난리 나기 전에 장로님을 뵈러 가라.') : tr("East is the fields. Past the tall grass, it's monster land.\nDon't wander off, {K}.", '동쪽은 들판이다. 수풀 너머는 몬스터들의 땅이지.\n멀리 가지 마라, {K}.'), tr('Watchman', '파수꾼'))});
  }
  if (map === 'S_AshenVillage_Elder') add({id: 'elder', s: 'expert_m', x: 5, y: 3, dir: 0, talk: talkElder});
  if (map === 'S_AshenVillage_Lodge') add({id: 'hunter', s: 'expert_f', x: 4, y: 3, dir: 0, talk: talkHunter});
  if (map === 'S_AshenVillage_Hut4') add({id: 'old', s: 'woman_2', x: 3, y: 3, dir: 0, talk: () => say(tr("When I was young, a single angry monster burned half this village.\nThat's why we're called the Ashen tribe.", '내가 젊었을 때, 성난 몬스터 한 마리가 이 마을의 절반을 태웠단다.\n그래서 우리를 잿빛 부족이라 부르지.'), tr('Old woman', '할머니'))});
  if (map === 'S_AshenVillage_Hut5') add({id: 'boy', s: 'boy_1', x: 5, y: 5, dir: 0, mv: 'WANDER', still: false, talk: () => say(tr("Someday I'll be a hunter!\nI'll protect everyone from monsters!", '나중에 커서 사냥꾼이 될 거야!\n몬스터들로부터 모두를 지킬 거야!'), tr('Boy', '소년'))});
  return L.map(o => Object.assign(o, {hx: o.x, hy: o.y}));
}
function storyEnterMap(name) {
  OW.npcs = storyNpcs(name);
  if (name === 'S_AshenVillage' && flag('partner') && !flag('villageGasp')) setTimeout(() => storyRun(sceneVillageGasp), 300);
}
// step triggers
function storyStep() {
  if (OW.map === 'S_AshenFields' && !flag('clash') && OW.x >= 30) { storyRun(sceneClash); return true; }
  return false;
}
function storyResume() {
  OW.fadeLvl = 0;
  // load the pictures the opening needs ahead of time (gods, the three babies, your partner)
  if (!flag('godsGift')) { ['dialga', 'palkia', 'giratina'].forEach(id => getSprite(id)); (ST().babies || STORY_DEFAULT_BABIES).forEach(id => getSprite(id)); }
  if (ST().party[0]) getSprite(ST().party[0].id, ST().party[0].shiny);
  if (!flag('intro')) storyRun(sceneIntro);
}
function storyAfterBattle(result) {
  if (result === 'win' && flag('trial1')) { ST().wins = (ST().wins || 0) + 1; persist(); }
}

// ---------- scenes ----------
async function sceneIntro() {
  OW.overlay = (c) => { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); };
  await sleep(0.4);
  await narr(tr('Long, long ago — before anyone had a name for them —\nthe creatures of this land were simply called monsters.', '아주 먼 옛날, 그들을 부르는 이름조차 없던 시절.\n이 땅의 생명체들은 그저 "몬스터"라 불렸다.'));
  await narr(tr('They were wild and fierce, and people feared them.\nOnly a few gentle kinds would ever come near a human.', '그들은 거칠고 사나웠고, 사람들은 그들을 두려워했다.\n사람 곁에 다가오는 건 온순한 몇몇 종류뿐이었다.'));
  await narr(tr('So people built their villages around fire,\nand the bravest among them became hunters.', '그래서 사람들은 불 곁에 마을을 세웠고,\n가장 용감한 자들은 사냥꾼이 되었다.'));
  await narr(tr('At the foot of the great mountain lived the Ashen tribe.\nAnd in one small hut lived a farm kid named {K}.', '거대한 산자락 아래에 잿빛 부족이 살았다.\n그리고 작은 오두막 하나에 {K}라는 농부의 아이가 살고 있었다.'));
  OW.overlay = null; await fadeIn(0.8);
  const mom = npcById('mom'); face(mom, 0); OW.dir = 1;
  await say(tr("{K}, you're up! Your father's already gone to the lodge.", '{K}, 일어났구나! 아버지는 벌써 사냥꾼 막사에 가셨단다.'), tr('Mother', '어머니'));
  await say(tr("Go check the east fields for me, will you?\nThe sky looks strange today… like a storm that can't decide.", '동쪽 들판 좀 살펴봐 주겠니?\n오늘 하늘이 이상해… 폭풍이 올 듯 말 듯 해.'), tr('Mother', '어머니'));
  await say(tr("And stay out of the tall grass. Monsters hide there.", '그리고 수풀엔 들어가지 마라. 몬스터들이 숨어 있으니까.'), tr('Mother', '어머니'));
  setFlag('intro');
}
async function talkMom() {
  if (flag('backHome')) return say(tr("Whatever that mark is… you're still my {K}.\nGo on. The Elder is waiting.", '그 표식이 뭐든… 넌 여전히 우리 {K}야.\n어서 가렴. 장로님이 기다리셔.'), tr('Mother', '어머니'));
  if (flag('partner')) return;
  return say(tr("The east fields are past the village gate, to the right.\nCome straight back if anything feels wrong.", '동쪽 들판은 마을 문을 나가 오른쪽이야.\n뭔가 이상하면 바로 돌아오렴.'), tr('Mother', '어머니'));
}
async function talkDad() {
  return say(tr("A mark like that… I've only heard of it in the old songs.\nListen to the Elder, {K}.", '그런 표식은… 옛 노래에서나 들어봤다.\n장로님 말씀을 잘 듣거라, {K}.'), tr('Father', '아버지'));
}

// the three gods fight above the fields
const prBg = n => owImg(PR_BASE + 'images/battle_anims/' + encodeURIComponent('PRAS- ' + n) + '.png');
const prSfx = (n, v = 0.8) => { try { playSound(PR_BASE + 'audio/battle_anims/' + encodeURIComponent(n), v, 1); } catch (e) {} };
function godsOverlay(state) {
  const sprs = {dialga: getSprite('dialga'), palkia: getSprite('palkia'), giratina: getSprite('giratina')};
  const space = prBg('Space BG'), voidBg = prBg('Dark Void BG'), rend = prBg('Spacial Rend'), rendBg = prBg('Spacial Rend BG');
  // a jagged tear across the sky (fixed shape, opens over time)
  const N = 26, jag = [...Array(N + 1)].map((_, i) => ({x: i / N, up: 0.4 + 0.6 * Math.abs(Math.sin(i * 2.7 + 1)), dn: 0.4 + 0.6 * Math.abs(Math.cos(i * 1.9 + 2))}));
  const dust = [...Array(70)].map(() => ({x: Math.random() * W, y: Math.random() * H, s: 2 + Math.random() * 4, v: 40 + Math.random() * 120}));
  const tear = (c, cx, cy, wid, open, img, edge, t) => {
    if (open <= 0) return;
    c.save(); c.beginPath();
    jag.forEach((p, i) => { const x = cx - wid / 2 + p.x * wid, taper = Math.sin(p.x * Math.PI); const y = cy - open * p.up * taper; i ? c.lineTo(x, y) : c.moveTo(x, y); });
    for (let i = N; i >= 0; i--) { const p = jag[i], x = cx - wid / 2 + p.x * wid, taper = Math.sin(p.x * Math.PI); c.lineTo(x, cy + open * p.dn * taper); }
    c.closePath();
    c.save(); c.clip();
    if (img.complete && img.naturalWidth) { c.imageSmoothingEnabled = false; const sc = 3, iw = img.naturalWidth * sc, ih = img.naturalHeight * sc, ox = (t * 20) % iw; for (let x = cx - wid / 2 - iw; x < cx + wid / 2 + iw; x += iw) for (let y = cy - 200; y < cy + 200; y += ih) c.drawImage(img, x - ox, y, iw, ih); }
    else { c.fillStyle = '#080416'; c.fill(); }
    c.restore();
    c.shadowColor = edge; c.shadowBlur = 28; c.strokeStyle = edge; c.lineWidth = 5; c.stroke();
    c.shadowBlur = 0; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2; c.stroke();
    c.restore();
  };
  return (c, t) => {
    const k = state.k();
    // darkening sky
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(12,4,30,${0.82 * k})`); g.addColorStop(0.6, `rgba(30,6,40,${0.55 * k})`); g.addColorStop(1, `rgba(10,0,10,${0.35 * k})`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // dust and pebbles shaken loose
    if (k > 0) { c.fillStyle = `rgba(150,120,110,${0.6 * k})`; for (const d of dust) { const y = (d.y + t * d.v) % H; c.fillRect(d.x, y, d.s, d.s); } }
    // the sky tears open, showing the void between worlds
    tear(c, W / 2, H * 0.3, W * 1.05, state.rift ? state.rift() * H * 0.2 : 0, space, '#ff7ad9', t);
    // Giratina's own dark rift
    if (state.giratina) tear(c, W / 2, H * 0.14, W * 0.36, state.giratina() * H * 0.12, voidBg, '#ff3355', t);
    const drawGod = (id, x, y, dir, size, alpha, aura) => {
      const e = sprs[id]; if (!e.ready || !e.data || e.data.type !== 'pmd') return; const A = e.data.anims, a = state.attack ? (A.Attack || A.SpAttack || A.Idle) : (A.Idle || A.Walk);
      const fi = animFrame(a, t, true), row = Math.min(dir, a.rows - 1), sc = size / (e.data.refH || 40);
      c.save(); c.globalAlpha = alpha; c.imageSmoothingEnabled = false; c.filter = `drop-shadow(0 0 18px ${aura})`;
      c.drawImage(a.img, fi * a.fw, row * a.fh, a.fw, a.fh, x - a.fw * sc / 2, y - a.fh * sc / 2, a.fw * sc, a.fh * sc); c.restore();
    };
    const gk = state.gods();
    if (gk > 0) {
      const bob = Math.sin(t * 2) * 10, rise = (1 - gk) * 120;
      drawGod('dialga', W * 0.2, H * 0.4 + bob + rise, 2, 340, gk, '#4aa8ff');
      drawGod('palkia', W * 0.8, H * 0.4 - bob + rise, 6, 340, gk, '#e070ff');
      if (state.giratina) { const gi = state.giratina(); drawGod('giratina', W * 0.5, H * 0.14 + (1 - gi) * 90, 0, 400, gi, '#ff3355'); }
      if (state.beams) {   // Roar of Time (blue) vs Spacial Rend (pink), colliding in the middle
        const mid = W * 0.5 + Math.sin(t * 4) * 40, y = H * 0.42, wob = Math.sin(t * 40);
        c.save(); c.globalCompositeOperation = 'lighter';
        const beam = (x0, x1, core, glow) => {
          for (const [w, a, col] of [[90 + 10 * wob, 0.25, glow], [52 + 6 * wob, 0.55, glow], [20, 0.95, core]]) { c.fillStyle = col; c.globalAlpha = a; c.beginPath(); c.moveTo(x0, y - w * 0.25); c.lineTo(x1, y - w / 2); c.lineTo(x1, y + w / 2); c.lineTo(x0, y + w * 0.25); c.closePath(); c.fill(); }
          c.globalAlpha = 0.8; c.fillStyle = core; for (let i = 0; i < 14; i++) { const f = ((t * 2.3 + i / 14) % 1), x = x0 + (x1 - x0) * f; c.fillRect(x, y + Math.sin(i * 9 + t * 20) * 30, 6, 6); }
        };
        beam(W * 0.27, mid, '#e8f6ff', '#3b8dff'); beam(W * 0.73, mid, '#ffe8fb', '#d85cff');
        c.globalAlpha = 1;
        // Spacial Rend's pink vortex frames at the impact point
        if (rend.complete && rend.naturalWidth) { const f = Math.floor(t * 12) % 4, sz = 96 * 4; c.drawImage(rend, f * 96, 0, 96, 96, mid - sz / 2, y - sz / 2, sz, sz); }
        const r = 90 + 30 * Math.sin(t * 18); const rg = c.createRadialGradient(mid, y, 0, mid, y, r); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = rg; c.beginPath(); c.arc(mid, y, r, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    }
    // the final blast: a shockwave ring then pure white
    if (state.blast) {
      const b = state.blast(), mid = W / 2, y = H * 0.42;
      c.save(); c.globalCompositeOperation = 'lighter';
      if (rendBg.complete && rendBg.naturalWidth) { c.globalAlpha = Math.min(1, b * 2) * 0.8; c.drawImage(rendBg, 0, 0, W, H); }
      c.globalAlpha = 1; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 30 * (1 - b) + 4; c.beginPath(); c.arc(mid, y, b * W * 1.2, 0, Math.PI * 2); c.stroke();
      c.restore();
    }
    if (state.white) { c.fillStyle = `rgba(255,255,255,${state.white()})`; c.fillRect(0, 0, W, H); }
  };
}
async function sceneClash() {
  OW.dir = 3;
  ['Space BG', 'Dark Void BG', 'Spacial Rend', 'Spacial Rend BG'].forEach(prBg);
  OW.shake = 0.6; prSfx('PRSFX- Earthquake1.wav', 0.6); await sleep(0.8);
  await narr(tr('…The ground is trembling.', '…땅이 흔들린다.'));
  const T = () => performance.now() / 1000, ramp = (t0, d) => () => clamp((T() - t0) / d, 0, 1);
  const st = {k: ramp(T(), 1.5), gods: () => 0};
  OW.overlay = godsOverlay(st);
  OW.shake = 1.2; prSfx('PRSFX- Earthquake2.wav', 0.7); await sleep(1.3);
  st.rift = ramp(T(), 1.4); prSfx('PRSFX- Spacial Rend.wav', 0.5); OW.shake = 0.8; await sleep(1.5);
  await narr(tr('The sky tears open like a wound!', '하늘이 상처처럼 찢어진다!'));
  st.gods = ramp(T(), 1.4);
  try { playMusic('battle_legendary_dia_pal'); } catch (e) {}
  await sleep(1.5);
  await narr(tr('Two enormous monsters burst out of the tear —\none gleaming like blue steel, one shining pale like a pearl.', '찢어진 하늘에서 거대한 두 몬스터가 뛰쳐나온다 —\n하나는 푸른 강철처럼 빛나고, 하나는 진주처럼 하얗게 빛난다.'));
  st.attack = true; st.beams = true; OW.shake = 2; prSfx('Blow1.m4a', 0.8); prSfx('PRSFX- Spacial Rend.wav', 0.8); await sleep(1.8);
  st.giratina = ramp(T(), 1.6); prSfx('PRSFX- Shadow Force2.wav', 0.7);
  await sleep(1.4);
  await narr(tr('And from a second, darker rift, a third one rises —\na shadow with wings.', '그리고 더 어두운 두 번째 균열에서 세 번째가 솟아오른다 —\n날개 달린 그림자.'));
  emote('player', '!', 1); await sleep(0.6);
  await say(tr('W-what… what are those…?!', '저, 저게… 뭐야…?!'), kidName());
  OW.shake = 3; st.blast = ramp(T(), 0.9); prSfx('PRSFX- Earthquake2.wav', 1); prSfx('PRSFX- Spacial Rend.wav', 1); await sleep(0.6);
  st.white = ramp(T(), 0.6);
  await sleep(1.1);
  await narr(tr('A blinding light. A roar that shakes the whole world.', '눈을 멀게 하는 빛. 온 세상을 뒤흔드는 굉음.'));
  await narr(tr('Then — nothing at all.', '그리고 — 아무것도 없었다.'));
  stopMusic();
  OW.overlay = (c) => { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); };
  await sleep(1);
  setFlag('clash');
  await sceneGods();
}
// the void: the gods repair the world and find the kid
async function sceneGods() {
  const sprs = ['dialga', 'palkia', 'giratina'].map(id => getSprite(id));
  let glow = null;
  OW.overlay = (c, t) => {
    c.fillStyle = '#05030c'; c.fillRect(0, 0, W, H);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 40; i++) { const a = i * 2.39 + t * 0.1, r = 80 + (i * 37 % 500); c.fillStyle = `rgba(${120 + i * 3},${60 + i * 2},255,0.05)`; c.beginPath(); c.arc(W / 2 + Math.cos(a) * r, H * 0.45 + Math.sin(a) * r * 0.5, 30 + i % 5 * 8, 0, Math.PI * 2); c.fill(); }
    c.restore();
    sprs.forEach((e, i) => {
      if (!e.ready || !e.data || e.data.type !== 'pmd') return; const a = e.data.anims.Idle || e.data.anims.Walk; const fi = animFrame(a, t, true), sc = 260 / (e.data.refH || 40);
      c.save(); c.globalAlpha = 0.75; c.imageSmoothingEnabled = false; c.filter = 'brightness(0.6) saturate(0.8)';
      c.drawImage(a.img, fi * a.fw, 0, a.fw, a.fh, W * (0.22 + i * 0.28) - a.fw * sc / 2, H * 0.32 - a.fh * sc / 2 + Math.sin(t * 1.5 + i) * 8, a.fw * sc, a.fh * sc); c.restore();
    });
    if (glow) { c.fillStyle = `rgba(220,20,50,${glow()})`; c.fillRect(0, 0, W, H); }
  };
  OW.hidePlayer = true; OW.hideFollower = true;
  const G = (id) => ({time: tr('Blue voice', '푸른 목소리'), space: tr('Pale voice', '하얀 목소리'), anti: tr('Shadow voice', '그림자 목소리')})[id], C = id => ({color: STORY_AUTH[id].col});   // the kid doesn't know their names yet — the Elder names them later
  await sleep(0.8);
  await say(tr('The rift is closing. Space is whole once more.', '균열이 닫히고 있다. 공간이 다시 하나가 되었다.'), G('space'), C('space'));
  await say(tr('And time flows as it should. …Our quarrel nearly unmade this world.', '시간도 제대로 흐른다. …우리의 다툼이 이 세계를 부술 뻔했군.'), G('time'), C('time'));
  await say(tr('Look below. A human child, caught in our battle.\nIts life is slipping into the dark.', '아래를 보아라. 우리의 싸움에 휘말린 인간의 아이다.\n그 생명이 어둠 속으로 빠져나가고 있다.'), G('anti'), C('anti'));
  await say(tr('We mended the world. We will mend this one too.', '세계를 고쳤으니, 이 아이도 고치겠다.'), G('time'), C('time'));
  await say(tr('A body can be healed. But a soul this close to the edge\nneeds something to hold on to.', '몸은 고칠 수 있다. 하지만 이토록 끝에 가까운 영혼에겐\n붙잡을 무언가가 필요하다.'), G('space'), C('space'));
  await say(tr('Then let it hold a piece of us.\nChild… choose.', '그렇다면 우리의 조각을 쥐게 하자.\n아이야… 선택하라.'), G('anti'), C('anti'));
  const opts = ['time', 'space', 'anti'];
  const pick = await choose(opts.map(a => ({time: tr('Time — the blue one', '시간 — 푸른 존재'), space: tr('Space — the pale one', '공간 — 하얀 존재'), anti: tr('Antimatter — the shadow', '반물질 — 그림자')})[a]), tr('Which power do you reach for?', '어떤 힘에 손을 뻗을까?'));
  const a = opts[pick], info = STORY_AUTH[a];
  ST().auths = {[a]: true}; ST().firstAuth = a; persist();
  await say(tr('So be it. This power was never meant for mortal hands.\nUse it only for a breath — or it will burn you away.', '그리 하라. 이 힘은 결코 필멸자의 것이 아니다.\n한 호흡만큼만 써라 — 그렇지 않으면 너를 태워버릴 것이다.'), G(a), C(a));
  const tg = performance.now(); glow = () => { const x = (performance.now() - tg) / 1000; return x < 0.4 ? x / 0.4 * 0.7 : Math.max(0, 0.7 - (x - 0.4) * 0.6); };
  OW.shake = 0.6;
  await narr(tr(`A searing heat spreads across your ${info.part()}.\nA crimson mark burns into your skin…`, `${info.part()}에 타는 듯한 열기가 퍼진다.\n진홍빛 표식이 살갗에 새겨진다…`));
  await narr(tr('…and everything fades away again.', '…그리고 모든 것이 다시 희미해진다.'));
  glow = null; await sleep(0.8);
  setFlag('godsGift');
  await sceneWake();
}
// waking up: three baby monsters looking after the kid
async function sceneWake() {
  const s = ST(), B = s.babies || STORY_DEFAULT_BABIES;
  warpTo('S_AshenFields', 38, 14, 0); OW.hidePlayer = false; OW.lying = true;
  OW.npcs.push(...B.map((id, i) => ({id: 'baby' + i, mon: id, x: [37, 39, 38][i], y: [14, 14, 15][i], hx: 0, hy: 0, dir: [3, 2, 1][i], still: true, t: 9})));
  B.forEach(id => getSprite(id));
  OW.overlay = (c) => { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); };
  await narr(tr('…Something warm and wet is on your face.', '…뭔가 따뜻하고 축축한 것이 얼굴에 닿는다.'));
  await narr(tr('…Something is licking you?', '…뭔가 핥고 있어?'));
  OW.overlay = null; await sleep(0.3);
  const babies = B.map((_, i) => npcById('baby' + i));
  for (const b of babies) emote(b, '♥', 1.2);
  await sleep(1.2);
  OW.lying = false; OW.dir = 0;
  await emote('player', '!', 1.1);
  await say(tr('Wh— monsters!!', '모, 몬스터다!!'), kidName());
  // they jump back, scared
  for (const b of babies) { const dx = Math.sign(b.x - 38), dy = Math.sign(b.y - 14); b.path = [dx > 0 ? 3 : dx < 0 ? 2 : dy > 0 ? 0 : 1]; b.dir = [1, 0, 3, 2][b.path[0]] ?? 0; emote(b, '!', 0.9); }
  await sleep(0.9);
  for (const b of babies) b.dir = b.x > 38 ? 2 : b.x < 38 ? 3 : 1;
  await narr(tr("The little monsters flinch away from you, trembling.\nBut they don't run. They just… watch you.", '작은 몬스터들이 몸을 떨며 물러선다.\n그런데 도망가지 않는다. 그저… 너를 바라본다.'));
  await narr(tr('Your clothes are wet. Your wounds are cleaned.\n…They were taking care of you?', '옷이 젖어 있다. 상처도 깨끗해져 있다.\n…이 녀석들이 날 돌봐준 거야?'));
  await say(tr("…It's okay. I won't hurt you.\nThank you… really.", '…괜찮아. 해치지 않을게.\n고마워… 정말로.'), kidName());
  const a = s.firstAuth || 'time';
  await narr(tr(`Your ${STORY_AUTH[a].part()} throbs. A crimson mark is there —\nso it wasn't a dream after all.`, `${STORY_AUTH[a].part()}이 욱신거린다. 진홍빛 표식이 그대로 있다 —\n꿈이 아니었던 거야.`));
  for (const b of babies) emote(b, '♥', 1);
  await sleep(0.8);
  await narr(tr('One of them takes a small, brave step toward you.', '그중 한 마리가 작고 용감하게 한 걸음 다가온다.'));
  const pick = await choose(B.map(id => spName(SP[id])), tr('Which one comes with you?', '누가 너와 함께 갈까?'));
  const chosen = B[pick];
  s.party = [Object.assign(worldSet(chosen, 5), {curHpFrac: 1})]; s.seen[chosen] = 1; s.caught[chosen] = 1;
  s.later = B.filter((_, i) => i !== pick);
  persist();
  await say(tr(`${spName(SP[chosen])}… want to come home with me?`, `${spName(SP[chosen])}… 나랑 같이 집에 갈래?`), kidName());
  await emote(babies[pick], '♥', 1.2);
  await narr(tr(`${spName(SP[chosen])} joined you!`, `${spName(SP[chosen])}이(가) 함께하게 되었다!`));
  // the other two slip back into the forest — they'll be back
  const others = babies.filter((_, i) => i !== pick);
  for (const b of others) { b.path = [3, 3, 3, 3, 3]; b.still = true; }
  await sleep(1.6);
  for (const b of others) b.hidden = true;
  await narr(tr('The other two slip into the forest…\nbut you can feel them watching from the trees.', '나머지 둘은 숲속으로 사라졌다…\n하지만 나무 사이에서 지켜보는 시선이 느껴진다.'));
  OW.npcs = OW.npcs.filter(n => !/^baby/.test(n.id));
  OW.hideFollower = false; setFlag('partner');
  await narr(tr('Head back to the village. Monsters in the tall grass\nmay attack now — your partner will fight beside you.', '마을로 돌아가자. 이제 수풀의 몬스터들이 덤벼들 수도 있다.\n파트너가 함께 싸워줄 것이다.'));
  try { owEnterMusic(); } catch (e) {}
}
async function sceneVillageGasp() {
  setFlag('villageGasp');
  const g = npcById('guard'), v1 = npcById('v1'), v2 = npcById('v2');
  if (g) { face(g, 2); emote(g, '!', 1.2); } if (v1) { face(v1, 3); emote(v1, '!', 1.2); } if (v2) emote(v2, '!', 1.2);
  await sleep(1);
  await say(tr("{K}?! Is that a— A MONSTER! Everyone, get back!", '{K}?! 그건— 몬스터다! 모두 물러서!'), tr('Watchman', '파수꾼'));
  await say(tr("Wait! It's not dangerous! It saved me!", '잠깐만요! 위험하지 않아요! 날 구해줬어요!'), kidName());
  await say(tr("…Saved you? A monster?\nYour face is pale, kid. What happened out there?", '…구해줬다고? 몬스터가?\n얼굴이 창백하구나. 거기서 무슨 일이 있었던 거냐?'), tr('Watchman', '파수꾼'));
  await say(tr("Go home first. Your parents must be worried sick.\nAfter that, the Elder will want to hear about this.", '일단 집에 가라. 부모님이 걱정하고 계실 거다.\n그 다음엔 장로님께서 이 얘기를 듣고 싶어 하실 거다.'), tr('Watchman', '파수꾼'));
  setFlag('backHome');
}
async function talkElder() {
  if (!flag('backHome')) return say(tr("Mm? Ah, {K}. The sky was restless this morning.\nBe careful out in the fields.", '음? 아, {K}로구나. 오늘 아침 하늘이 심상치 않더구나.\n들판에서 조심하거라.'), tr('Elder', '장로'));
  if (flag('trial1')) return say(tr("The master-hunter is waiting at the lodge.\nShow her what you and your monster can do.", '사냥꾼 대장이 막사에서 기다린다.\n너와 네 몬스터가 무엇을 할 수 있는지 보여주거라.'), tr('Elder', '장로'));
  const a = ST().firstAuth || 'time', info = STORY_AUTH[a];
  await say(tr('So. A monster that follows a child, and a child who returns\nfrom where the sky broke open.', '그래. 아이를 따르는 몬스터와, 하늘이 갈라진 곳에서\n돌아온 아이라.'), tr('Elder', '장로'));
  await say(tr(`Show me your ${info.part()}.`, `${info.part()}을 보여다오.`), tr('Elder', '장로'));
  await narr(tr('The Elder stares at the crimson mark for a long time.', '장로가 진홍빛 표식을 한참 동안 바라본다.'));
  await say(tr('The old songs speak of three great ones who shaped this world:\none who rules time, one who rules space, and one cast into shadow.', '옛 노래는 이 세계를 빚은 세 위대한 존재를 노래하지.\n시간을 다스리는 자, 공간을 다스리는 자, 그리고 그림자로 쫓겨난 자.'), tr('Elder', '장로'));
  await say(tr('DIALGA, the blue one who rules time. PALKIA, the pale one who rules space.\nAnd GIRATINA, the shadow, cast out of this world.', '시간을 다스리는 푸른 존재, 디아루가. 공간을 다스리는 하얀 존재, 펄기아.\n그리고 이 세계에서 쫓겨난 그림자, 기라티나.'), tr('Elder', '장로'));
  await say(tr(`This is the sign of ${tr(info.en, info.ko)}. Their power… is inside you.`, `이건 ${tr(info.en, info.ko)}의 표식이다. 그 힘이… 네 안에 있구나.`), tr('Elder', '장로'));
  await say(tr("Listen well. No human was ever meant to hold this.\nUse it only for a heartbeat — never longer.", '잘 들어라. 어떤 인간도 이 힘을 가져선 안 되었다.\n심장이 한 번 뛸 만큼만 써라 — 절대 그 이상은 안 된다.'), tr('Elder', '장로'));
  await say(tr("And the monsters will sense it. Some will come to you…\nand some will come for you.", '그리고 몬스터들도 그걸 느낄 것이다. 어떤 녀석들은 네게 다가오겠지…\n어떤 녀석들은 너를 노리고 올 것이다.'), tr('Elder', '장로'));
  await say(tr("You'll need to learn to fight beside that monster.\nGo to the hunters' lodge. The master-hunter will test you.", '그 몬스터와 함께 싸우는 법을 배워야 한다.\n사냥꾼 막사로 가거라. 사냥꾼 대장이 너를 시험할 것이다.'), tr('Elder', '장로'));
  setFlag('trial1');
}
async function talkHunter() {
  if (!flag('trial1')) return say(tr("The lodge is for hunters, kid. Run along.", '여긴 사냥꾼들 막사다, 꼬마야. 가서 놀아라.'), tr('Master-hunter', '사냥꾼 대장'));
  const wins = ST().wins || 0;
  if (!flag('trialStart')) {
    await say(tr("So you're the kid who walked out of the light with a monster at your heels.", '네가 그 빛 속에서 몬스터를 달고 걸어 나왔다는 꼬마로군.'), tr('Master-hunter', '사냥꾼 대장'));
    await say(tr("A monster that doesn't attack its human… I've never seen that.\nBut taming isn't the same as fighting.", '사람을 공격하지 않는 몬스터라… 처음 보는군.\n하지만 길들이는 것과 싸우는 건 다른 문제다.'), tr('Master-hunter', '사냥꾼 대장'));
    await say(tr("Here's your first trial: go to the fields and defeat\nthree wild monsters with that partner of yours.", '첫 번째 시험이다. 들판으로 가서\n네 파트너와 함께 야생 몬스터 셋을 쓰러뜨려라.'), tr('Master-hunter', '사냥꾼 대장'));
    setFlag('trialStart'); ST().wins = 0; persist(); return;
  }
  if (wins < 3) return say(tr(`${wins} down, ${3 - wins} to go. The tall grass in the fields is full of them.`, `${wins}마리 쓰러뜨렸군. 앞으로 ${3 - wins}마리. 들판의 수풀에 잔뜩 있다.`), tr('Master-hunter', '사냥꾼 대장'));
  if (!flag('trialDone')) {
    await say(tr("Three, already? Hah! Not bad for a farm kid.", '벌써 셋이라고? 하! 농부의 아이치곤 나쁘지 않군.'), tr('Master-hunter', '사냥꾼 대장'));
    await say(tr("The real trial comes next — you'll face me.\nBut that's a story for another day.", '진짜 시험은 이제부터다 — 나와 싸우게 될 거다.\n하지만 그건 다음 이야기다.'), tr('Master-hunter', '사냥꾼 대장'));
    setFlag('trialDone');
    await narr(tr('— End of the Chapter 1 preview. To be continued! —', '— 1장 미리보기 끝. 다음 이야기에 계속! —'));
    return;
  }
  return say(tr("Rest up. The real trial is coming.", '쉬어 둬라. 진짜 시험이 다가오고 있으니.'), tr('Master-hunter', '사냥꾼 대장'));
}
