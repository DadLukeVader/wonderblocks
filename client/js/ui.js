// WonderBlocks UI: menus, HUD, inventory, chat, tutorial, touch controls.
import { B, BLOCKS, CATEGORIES, blockDef } from 'wb-shared/blocks.js?v=18';
import { FOODS, foodDef } from 'wb-shared/foods.js?v=18';
import { ITEMS, isItem, itemDef, totalDefense } from 'wb-shared/items.js?v=18';
import { SKIN_TONES, HAIR_STYLES, HAIR_COLORS, SHIRT_COLORS, PANTS_COLORS } from './character.js?v=18';

const SWATCH = {
  1: '#79c95c', 2: '#9a6a44', 3: '#b9b9c4', 4: '#f0dfa4', 5: '#8a5a32', 6: '#58b368',
  7: '#f2f7ff', 8: '#d99a86', 9: '#3fa7e8', 10: '#d9a05e', 11: '#e07864', 12: '#7ec8e8',
  13: '#f2d06b', 14: '#f0a0b8', 15: '#bfe6f7', 16: '#d96a4e', 17: '#ffd76e', 18: '#ff7d9c',
  19: '#ffd94d', 20: '#7db8ff', 21: '#ff9d5c', 22: '#9d7bff', 23: 'linear-gradient(180deg,#ff6b6b,#ffe066,#8ce99a,#74c0fc,#b197fc)',
  24: '#f5c542', 25: '#bfe6f7', 26: '#ffffff', 27: '#9c7040', 28: '#3fa34d', 29: '#f0a8c0',
  30: '#58b368', 31: '#a4713f', 32: '#bfe6f7', 33: '#a9a9b5', 34: '#f2f7ff', 36: '#a4713f',
  37: '#c78f4f', 38: '#ff6b6b', 39: '#ffb84d', 40: '#d9a05e',
};
// Real block texture from the atlas (32px tiles, 8 cols) for inventory icons.
function blockTexStyle(id) {
  try {
    const def = blockDef(id);
    if (!def || def.tiles == null) return '';
    const t = typeof def.tiles === 'number' ? def.tiles : def.tiles.side;
    if (t == null) return '';
    const x = (t % 8) * 32, y = Math.floor(t / 8) * 32;
    return `background-image:url('art/atlas.png');background-position:-${x}px -${y}px;background-size:256px 256px;background-color:#ccc;`;
  } catch { return ''; }
}

const el = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor(input, h) {
    this.input = input;
    this.h = h;
    this.char = this.loadChar();
    try { this.playerName = localStorage.getItem('wb_name') || 'Builder'; } catch { this.playerName = 'Builder'; }
    this.buildDOM();
    this.buildTouch();
    this.showMenu();
  }

  loadChar() {
    try {
      const c = JSON.parse(localStorage.getItem('wb_char'));
      if (c && c.skin) return c;
    } catch { /* noop */ }
    return { skin: SKIN_TONES[0], hairStyle: 'flat', hairColor: HAIR_COLORS[0], shirt: SHIRT_COLORS[1], pants: PANTS_COLORS[0], accessory: 'none' };
  }
  saveChar() { try { localStorage.setItem('wb_char', JSON.stringify(this.char)); } catch { /* noop */ } }

  buildDOM() {
    document.body.insertAdjacentHTML('beforeend', `
    <div id="ui">
      <div id="loading" class="overlay">
        <div class="loadcard">
          <div class="logo"><img src="art/logo.png" onerror="this.remove()" style="max-width:230px;border-radius:20px;display:block;margin:0 auto 10px">🧱 WonderBlocks</div>
          <div class="tagline">Build Together</div>
          <div class="bar"><div id="loadfill"></div></div>
          <div id="loadlabel">Loading…</div>
        </div>
      </div>
      <div id="menu" class="overlay hidden">
        <div class="menucard">
          <div class="logo"><img src="art/logo.png" onerror="this.remove()" style="max-width:230px;border-radius:20px;display:block;margin:0 auto 10px">🧱 WonderBlocks</div>
          <div class="tagline">Build Together</div>
          <div id="menubody"></div>
        </div>
      </div>
      <div id="hud" class="hidden">
        <div id="crosshair">+</div>
        <div id="targetlabel"></div>
        <div id="topbar">
          <div id="coins">🪙 0</div>
          <div id="xpwrap"><div id="xpbar"><div id="xpfill"></div></div><span id="xplabel">Lv 1</span></div>
          <div id="biome">Wonder Village</div>
          <canvas id="compass" width="220" height="34"></canvas>
        </div>
        <div id="quests"></div>
        <div id="toolbar">
          <button data-a="inventory" title="Inventory (E)">🎒</button>
          <button data-a="chat" title="Chat (Enter)">💬</button>
          <button data-a="players" title="Players">👥</button>
          <button data-a="emotes" title="Emotes">😄</button>
          <button data-a="crafting" title="Crafting (C)">🛠️</button>
          <button data-a="camera" title="Camera: 1st/3rd person (V)">🎥</button>
          <button data-a="claim" title="Claim land">🚩</button>
          <button data-a="mute" title="Mute (M)">🔊</button>
        </div>
        <div id="emotebar" class="hidden">
          <button data-e="wave">👋</button><button data-e="happy">😄</button>
          <button data-e="dance">💃</button><button data-e="love">❤️</button>
        </div>
        <div id="hotbar"></div>
        <div id="vitals"><div id="hearts"></div><div id="hungerbar"></div></div>
        <div id="toasts"></div>
        <div id="chat" class="hidden"><div id="chatlog"></div><input id="chatin" maxlength="200" placeholder="Say something nice… (Enter to send)"></div>
        <div id="players" class="panel hidden"></div>
        <div id="inventory" class="panel hidden"></div>
        <div id="pausemenu" class="panel hidden"></div>
        <div id="help" class="panel hidden"></div>
        <div id="tutorial" class="hidden"></div>
        <button id="adoptbtn" class="hidden">🐾 Adopt pet</button>
        <button id="feedbtn" class="hidden">🍎 Feed</button>
        <button id="pettogglebtn" class="hidden">🐾 Pets: following</button>
      </div>
    </div>`);

    el('toolbar').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      this.h.onToolbar(b.dataset.a);
    });
    el('emotebar').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      this.h.onEmote(b.dataset.e); el('emotebar').classList.add('hidden');
    });
    const chatin = el('chatin');
    chatin.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter' && chatin.value.trim()) { this.h.onSendChat(chatin.value.trim()); chatin.value = ''; chatin.blur(); }
      if (e.key === 'Escape') chatin.blur();
    });
    chatin.addEventListener('blur', () => { el('chat').classList.add('hidden'); });
    el('adoptbtn').addEventListener('click', () => this.h.onAdopt());
    el('feedbtn').addEventListener('click', () => this.h.onFeed());
    el('pettogglebtn').addEventListener('click', () => this.h.onTogglePets());
  }

  // ---------- menu ----------
  showMenu() {
    el('loading').classList.add('hidden');
    el('menu').classList.remove('hidden');
    el('hud').classList.add('hidden');
    this.menuMain();
  }
  menuMain() {
    const mp = !!(location.host);
    el('menubody').innerHTML = `
      <button class="mbtn primary" id="m_demo">🌱 Play Demo <small>offline · single player</small></button>
      <button class="mbtn" id="m_create" ${mp ? '' : 'disabled'}>🌍 Create World <small>${mp ? 'multiplayer · share a code' : 'needs the WonderBlocks server'}</small></button>
      <button class="mbtn" id="m_join" ${mp ? '' : 'disabled'}>🔗 Join World <small>${mp ? 'enter a room code' : 'needs the WonderBlocks server'}</small></button>
      <button class="mbtn" id="m_char">🎨 My Character</button>
      <button class="mbtn" id="m_help">❓ How to Play</button>
      ${mp ? '' : '<p class="note">Tip: run <code>node wonderblocks-host.js</code> on your computer to unlock multiplayer, then open the printed address.</p>'}
      <input id="m_name" maxlength="16" placeholder="Your name" value="${esc(this.playerName || 'Builder')}">`;
    el('m_demo').onclick = () => this.h.onPlayDemo(el('m_name').value.trim() || 'Builder');
    if (mp) {
      el('m_create').onclick = () => this.h.onCreateWorld(el('m_name').value.trim() || 'Builder');
      el('m_join').onclick = () => this.menuJoin();
    }
    el('m_char').onclick = () => this.menuChar();
    el('m_help').onclick = () => this.menuHelp();
  }
  menuJoin() {
    const pre = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
    el('menubody').innerHTML = `
      <h3>Join a World</h3>
      <p>Ask your friend for their 6-letter room code.</p>
      <input id="m_code" maxlength="6" placeholder="ABC123" style="text-transform:uppercase" value="${esc(pre)}">
      <div class="row"><button class="mbtn primary" id="m_go">Join</button>
      <button class="mbtn" id="m_back">Back</button></div>`;
    el('m_back').onclick = () => this.menuMain();
    el('m_go').onclick = () => {
      const code = el('m_code').value.trim().toUpperCase();
      if (code.length === 6) this.h.onJoinWorld(code, this.playerName || 'Builder');
      else this.toast('Enter the 6-letter code.');
    };
  }
  menuChar() {
    const c = this.char;
    const row = (label, opts, cur, key, colors) => `
      <div class="optrow"><span>${label}</span><div class="opts">${opts.map(o =>
        `<button class="opt ${o === cur ? 'sel' : ''}" data-k="${key}" data-v="${o}" ${colors ? `style="background:${o}"` : ''}>${colors ? '' : esc(o)}</button>`).join('')}</div></div>`;
    el('menubody').innerHTML = `
      <h3>My Character</h3>
      <canvas id="charprev" width="120" height="180"></canvas>
      ${row('Skin', SKIN_TONES, c.skin, 'skin', true)}
      ${row('Hair', HAIR_STYLES, c.hairStyle, 'hairStyle')}
      ${row('Hair color', HAIR_COLORS, c.hairColor, 'hairColor', true)}
      ${row('Shirt', SHIRT_COLORS, c.shirt, 'shirt', true)}
      ${row('Pants', PANTS_COLORS, c.pants, 'pants', true)}
      ${row('Accessory', ['none', 'cap', 'glasses', 'crown'], c.accessory, 'accessory')}
      <div class="row"><button class="mbtn primary" id="m_charsave">Done</button></div>`;
    el('menubody').querySelectorAll('.opt').forEach(b => b.onclick = () => {
      this.char[b.dataset.k] = b.dataset.v; this.saveChar(); this.drawCharPreview(); this.menuChar();
    });
    this.drawCharPreview();
    el('m_charsave').onclick = () => this.menuMain();
  }
  drawCharPreview() {
    const cv = el('charprev'); if (!cv) return;
    const g = cv.getContext('2d'); const c = this.char;
    g.clearRect(0, 0, 120, 180);
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    R(42, 118, 14, 34, c.pants); R(64, 118, 14, 34, c.pants);           // legs
    R(40, 152, 18, 12, '#6b4a8a'); R(62, 152, 18, 12, '#6b4a8a');       // shoes
    R(36, 78, 48, 42, c.shirt);                                        // body
    R(22, 80, 12, 36, c.shirt); R(86, 80, 12, 36, c.shirt);            // arms
    R(36, 30, 48, 46, c.skin);                                         // head
    R(46, 44, 8, 10, '#2b2b3a'); R(66, 44, 8, 10, '#2b2b3a');          // eyes
    R(44, 62, 12, 4, '#8a4a5a'); R(64, 62, 12, 4, '#8a4a5a');          // smile? no—blush
    g.fillStyle = '#ff9db0'; g.fillRect(40, 56, 8, 5); g.fillRect(72, 56, 8, 5);
    R(34, 22, 52, 12, c.hairColor);                                    // hair
    if (c.hairStyle === 'long') { R(30, 30, 8, 44, c.hairColor); R(82, 30, 8, 44, c.hairColor); }
    if (c.hairStyle === 'spiky') for (const x of [40, 54, 68]) R(x, 10, 10, 14, c.hairColor);
    if (c.accessory === 'cap') { R(34, 14, 52, 12, '#ff6b6b'); R(70, 22, 26, 6, '#ff6b6b'); }
    if (c.accessory === 'glasses') { R(44, 42, 14, 10, '#2b3a4a'); R(62, 42, 14, 10, '#2b3a4a'); }
    if (c.accessory === 'crown') for (let i = 0; i < 5; i++) R(40 + i * 9, 12, 7, 10, ['#ff6b6b', '#ffe066', '#74c0fc', '#8ce99a', '#b197fc'][i]);
  }
  menuHelp() {
    el('menubody').innerHTML = `
      <h3>How to Play</h3>
      <div class="helptext">
      <b>🖥️ Computer:</b> WASD move · Space jump · mouse look (click to lock) ·
      <b>Left click</b> break · <b>Right click</b> place · wheel / 1–9 hotbar ·
      E inventory · Enter chat · V or 🎥 button = first-person · Shift sprint<br><br>
      <b>📱 Phone/tablet:</b> left joystick moves · drag to look ·
      tap a block to target it, then JUMP / ⛏️ / 🧱 buttons · 🎥 toggles camera.<br><br>
      Break blocks to collect them, open 🎒 to pick materials, and build!
      Claim land with 🚩 to protect your builds. Feed wild animals their favorite snacks to tame them as pets! 🍎
      </div>
      <div class="row"><button class="mbtn primary" id="m_back">Back</button></div>`;
    el('m_back').onclick = () => this.menuMain();
  }

  // ---------- HUD ----------
  showHUD() {
    el('menu').classList.add('hidden');
    el('loading').classList.add('hidden');
    el('hud').classList.remove('hidden');
  }
  hideLoading() { el('loading').classList.add('hidden'); }
  loading(p, label) {
    el('loading').classList.remove('hidden');
    el('loadfill').style.width = Math.round(p * 100) + '%';
    el('loadlabel').textContent = label;
  }

  // Survival HUD: hearts (health) and drumsticks (hunger)
  renderVitals(health, maxHealth, hunger, maxHunger) {
    const h = el('hearts'), f = el('hungerbar');
    if (!h || !f) return;
    const hearts = Math.ceil(maxHealth / 2), hFull = Math.floor(health / 2), hHalf = health % 2;
    let hs = '';
    for (let i = 0; i < hearts; i++) hs += i < hFull ? '❤️' : (i === hFull && hHalf ? '💔' : '🖤');
    const drums = Math.ceil(maxHunger / 2), fFull = Math.floor(hunger / 2), fHalf = hunger % 2;
    let fs = '';
    for (let i = 0; i < drums; i++) fs += i < fFull ? '🍗' : (i === fFull && fHalf ? '🍖' : '🦴');
    h.innerHTML = hs; f.innerHTML = fs;
  }

  renderHotbar(inv) {
    const hb = el('hotbar');
    hb.innerHTML = inv.hotbar.map((id, i) => {
      const it = isItem(id) ? itemDef(id) : null;
      const def = it || blockDef(id);
      const cnt = inv.count(id);
      const swStyle = it ? `background:${it.color}` : blockTexStyle(id);
      return `<div class="slot ${i === inv.sel ? 'sel' : ''}" data-i="${i}">
        <div class="sw" style="${swStyle};display:flex;align-items:center;justify-content:center">${it ? `<span style="font-size:20px">${it.icon}</span>` : ''}</div>
        <span class="key">${i + 1}</span>
        <span class="cnt">${cnt === Infinity ? '∞' : cnt}</span>
        <span class="nm">${esc(def.name)}</span></div>`;
    }).join('');
    hb.querySelectorAll('.slot').forEach(s => s.onclick = () => this.h.onSelectHotbar(+s.dataset.i));
  }

  setStats(coins, xp) {
    el('coins').textContent = '🪙 ' + coins;
    const lv = 1 + Math.floor(xp / 100);
    el('xpfill').style.width = (xp % 100) + '%';
    el('xplabel').textContent = 'Lv ' + lv;
  }
  setBiome(name) { el('biome').textContent = '📍 ' + name; }
  drawCompass(yaw) {
    const cv = el('compass'); const g = cv.getContext('2d');
    g.clearRect(0, 0, 220, 34);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.beginPath(); g.roundRect(0, 0, 220, 34, 17); g.fill();
    const dirs = [['N', 0], ['E', -Math.PI / 2], ['S', Math.PI], ['W', Math.PI / 2]];
    g.textAlign = 'center'; g.font = 'bold 15px system-ui';
    for (const [label, a] of dirs) {
      let d = a - yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const x = 110 + d * 60;
      if (x < 14 || x > 206) continue;
      g.fillStyle = label === 'N' ? '#e03131' : '#495057';
      g.fillText(label, x, 22);
    }
    g.fillStyle = '#e03131';
    g.beginPath(); g.moveTo(110, 4); g.lineTo(105, 12); g.lineTo(115, 12); g.fill();
  }
  setQuests(qm) {
    el('quests').innerHTML = qm.activeQuests().map(q => {
      const p = qm.progress[q.id] || 0;
      return `<div class="quest"><div class="qt">${esc(q.text)}</div>
        <div class="qbar"><div style="width:${Math.round(p / q.target * 100)}%"></div></div>
        <div class="qp">${p}/${q.target}</div></div>`;
    }).join('');
  }
  setTargetLabel(name) { el('targetlabel').textContent = name || ''; }

  toast(msg, ms = 2600) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    el('toasts').appendChild(t);
    setTimeout(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, ms);
  }

  // ---------- chat / players ----------
  toggleChat(show) {
    const c = el('chat');
    const willShow = show === undefined ? c.classList.contains('hidden') : show;
    c.classList.toggle('hidden', !willShow);
    if (willShow) setTimeout(() => el('chatin').focus(), 30);
  }
  chatAdd(name, text, me = false, sys = false) {
    const log = el('chatlog');
    const d = document.createElement('div');
    d.className = 'msg' + (me ? ' me' : '') + (sys ? ' sys' : '');
    d.innerHTML = sys ? esc(text) : `<b>${esc(name)}</b> ${esc(text)}`;
    log.appendChild(d);
    while (log.children.length > 40) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
    el('chat').classList.remove('hidden');
    clearTimeout(this._chatT);
    this._chatT = setTimeout(() => { if (document.activeElement !== el('chatin')) el('chat').classList.add('hidden'); }, 9000);
  }
  togglePlayers(list, myId, isOwner) {
    const p = el('players');
    if (!p.classList.contains('hidden')) { p.classList.add('hidden'); return; }
    document.querySelectorAll('#hud .panel').forEach(x => x.classList.add('hidden'));
    p.innerHTML = `<h3>👥 Players (${list.length})</h3>` + list.map(pl => `
      <div class="prow"><span class="pname">${esc(pl.name)}${pl.id === myId ? ' (you)' : ''}</span>
      <span class="role ${pl.role}">${pl.role}</span>
      ${isOwner && pl.id !== myId ? `<span class="pact">
        <button data-a="promote" data-id="${pl.id}" title="Make builder">🔨</button>
        <button data-a="visitor" data-id="${pl.id}" title="Make visitor">👀</button>
        <button data-a="kick" data-id="${pl.id}" title="Kick">🚫</button></span>` : ''}
      </div>`).join('') +
      `<p class="note">Room code: <b>${esc(this.roomCode || 'demo')}</b><br>Invite friends with this code.</p>
      <button class="mbtn" id="pl_respawn">📍 Respawn at Village</button>
      <button class="mbtn danger" id="pl_leave">🚪 Leave World</button>`;
    p.classList.remove('hidden');
    p.querySelectorAll('button').forEach(b => {
      if (b.id === 'pl_leave') { b.onclick = () => this.h.onLeave(); return; }
      if (b.id === 'pl_respawn') { b.onclick = () => this.h.onRespawn(); return; }
      b.onclick = () => this.h.onPlayerAction(b.dataset.a, b.dataset.id);
    });
  }

  // ---------- inventory panel ----------
  toggleInventory(inv) {
    const p = el('inventory');
    if (!p.classList.contains('hidden')) { p.classList.add('hidden'); return; }
    document.querySelectorAll('#hud .panel').forEach(x => x.classList.add('hidden'));
    const cats = inv.itemsByCat();
    const cat = this._cat || 'natural';
    const foodItems = Object.entries(FOODS)
      .map(([id, f]) => ({ id: +id, name: `${f.icon} ${f.name}`, count: inv.count(+id), desc: f.desc, color: f.color }))
      .filter(i => i.count > 0);
    p.innerHTML = `<h3>🎒 Inventory</h3><div class="cats">${CATEGORIES.map(c =>
      `<button class="cat ${c === cat ? 'sel' : ''}" data-c="${c}">${c}</button>`).join('')}
      <button class="cat ${cat === 'food' ? 'sel' : ''}" data-c="food">🍎 food</button></div>
      <div class="igrid"></div>
      <p class="note">${cat === 'food' ? 'Walk up to a wild animal to feed it its favorite snack!' : `Tap a block to put it in hotbar slot ${inv.sel + 1}.`}</p>`;
    const grid = p.querySelector('.igrid');
    const items = cat === 'food' ? foodItems : cats[cat];
    grid.innerHTML = (items.length ? items.map(it => `
      <div class="cell" data-id="${it.id}" data-food="${cat === 'food' ? 1 : 0}" title="${esc(it.desc || it.name)}">
        <div class="sw" style="${cat === 'food' ? `background:${it.color}` : blockTexStyle(it.id)}">${cat === 'food' ? foodDef(it.id).icon : ''}</div>
        <span class="cnt">${it.count === Infinity ? '∞' : it.count}</span>
        <span class="nm">${esc(it.name)}</span></div>`).join('')
      : '<p class="note">No food yet \u2014 break leaves, berry bushes & tall grass!</p>');
    grid.querySelectorAll('.cell').forEach(cell => cell.onclick = () => {
      if (cell.dataset.food === '1') this.toast('Walk up to a wild animal and tap the feed button to offer it a snack! 🍎');
      else this.h.onHotbarAssign(inv.sel, +cell.dataset.id);
      p.classList.add('hidden');
    });
    p.querySelectorAll('.cat').forEach(b => b.onclick = () => { this._cat = b.dataset.c; this.toggleInventory(inv); this.toggleInventory(inv); });
    // ---- gear: equipped armor + armory (equip buttons) ----
    const gear = document.createElement('div');
    gear.innerHTML = `<h3>⚔️ Gear</h3><div class="gear" style="display:flex;gap:8px;margin:6px 0"></div>
      <div style="margin:4px 0">🛡️ Total defense: <b>${totalDefense(inv.equipment)}</b> <small style="opacity:.65">(display only — no combat yet)</small></div>
      <div class="armory"></div>`;
    const slots = gear.querySelector('.gear');
    for (const slot of ['head', 'chest', 'feet']) {
      const eid = inv.equipment[slot];
      const ed = eid ? itemDef(eid) : null;
      const d = document.createElement('div');
      d.className = 'cell'; d.style.minWidth = '86px'; d.title = ed ? 'Tap to unequip' : slot;
      d.innerHTML = `<div class="sw" style="background:${ed ? ed.color : '#333a44'};display:flex;align-items:center;justify-content:center">${ed ? `<span style="font-size:20px">${ed.icon}</span>` : ''}</div>
        <span class="nm">${ed ? esc(ed.name) : slot + ' (empty)'}</span>`;
      if (ed) d.onclick = () => { inv.equipment[slot] = null; inv.add(eid); this.toggleInventory(inv); this.toggleInventory(inv); };
      slots.appendChild(d);
    }
    const armory = gear.querySelector('.armory');
    let anyArmor = false;
    for (const [idStr, it] of Object.entries(ITEMS)) {
      const aid = +idStr;
      if (it.kind !== 'armor') continue;
      const c = inv.counts.get(aid) || 0;
      if (c <= 0 && !inv.unlimited) continue;
      anyArmor = true;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0';
      row.innerHTML = `<div class="sw" style="background:${it.color};display:flex;align-items:center;justify-content:center"><span style="font-size:20px">${it.icon}</span></div>
        <span style="flex:1">${esc(it.name)} <small>(${it.slot} · +${it.defense} def · ×${inv.unlimited ? '∞' : c})</small></span>`;
      const btn = document.createElement('button');
      btn.className = 'mbtn'; btn.textContent = 'Equip';
      btn.onclick = () => {
        if (!inv.remove(aid)) return;
        const cur = inv.equipment[it.slot];
        if (cur) inv.add(cur);
        inv.equipment[it.slot] = aid;
        this.toggleInventory(inv); this.toggleInventory(inv);
      };
      row.appendChild(btn);
      armory.appendChild(row);
    }
    if (!anyArmor) armory.innerHTML = '<p class="note">No armor yet — craft some with 🛠️!</p>';
    p.appendChild(gear);
    p.classList.remove('hidden');
  }

  // ---------- pause menu ----------
  togglePause(isMultiplayer, isOwner) {
    const p = el('pausemenu');
    if (!p.classList.contains('hidden')) { p.classList.add('hidden'); this.input.enabled = true; return; }
    document.querySelectorAll('#hud .panel').forEach(x => x.classList.add('hidden'));
    p.innerHTML = `<h3>⏸️ Paused</h3>
      <button class="mbtn primary" id="p_resume">▶️ Resume</button>
      <button class="mbtn" id="p_help">❓ Controls</button>
      <label class="chk"><input type="checkbox" id="p_unlim" ${this.h.unlimited ? 'checked' : ''}> Unlimited blocks (creative)</label>
      <label class="chk"><input type="checkbox" id="p_invert" ${this.h.invertLook ? 'checked' : ''}> Invert look (up/down)</label>
      <label class="chk">Sound <input type="range" id="p_vol" min="0" max="100" value="${this.h.volume * 100}"></label>
      ${isMultiplayer && isOwner ? `<p class="note">You own this world. Manage players in 👥.</p>` : ''}
      ${isMultiplayer ? `<p class="note">Invite friends: share code <b>${esc(this.roomCode || '')}</b><br>or the link:<br><code>${esc(location.origin + location.pathname)}?room=${esc(this.roomCode || '')}</code></p>` : ''}
      <button class="mbtn danger" id="p_leave">${isMultiplayer ? '🚪 Leave World' : '💾 Save & Exit to Menu'}</button>`;
    p.classList.remove('hidden');
    this.input.enabled = false;
    el('p_resume').onclick = () => { p.classList.add('hidden'); this.input.enabled = true; };
    el('p_help').onclick = () => { p.classList.add('hidden'); this.toggleHelp(); };
    el('p_unlim').onchange = e => this.h.onToggleUnlimited(e.target.checked);
    el('p_invert').onchange = e => this.h.onToggleInvert(e.target.checked);
    el('p_vol').oninput = e => this.h.onVolume(e.target.value / 100);
    el('p_leave').onclick = () => this.h.onLeave();
  }
  toggleHelp() {
    const p = el('help');
    if (!p.classList.contains('hidden')) { p.classList.add('hidden'); this.input.enabled = true; return; }
    document.querySelectorAll('#hud .panel').forEach(x => x.classList.add('hidden'));
    p.innerHTML = `<h3>❓ Controls</h3><div class="helptext">
      <b>Move</b> WASD / arrows / joystick · <b>Jump</b> Space · <b>Sprint</b> Shift<br>
      <b>Look</b> mouse (click game to lock) / drag on touch<br>
      <b>Break</b> left-click (hold) / ⛏️ button · <b>Place</b> right-click / 🧱 button<br>
      <b>Hotbar</b> 1–9 / wheel · <b>Inventory</b> E · <b>Chat</b> Enter · <b>Menu</b> Esc · <b>Camera</b> V<br>
      <b>Adopt a pet:</b> walk up to a rabbit or chicken and tap 🐾<br>
      <b>Protect builds:</b> place a 🚩 Claim Flag, or tap 🚩 in the toolbar.
      </div><button class="mbtn primary" id="h_back">Back</button>`;
    p.classList.remove('hidden');
    this.input.enabled = false;
    el('h_back').onclick = () => { p.classList.add('hidden'); this.input.enabled = true; };
  }

  // ---------- tutorial ----------
  tutorialStep(i, total, text) {
    const t = el('tutorial');
    t.classList.remove('hidden');
    t.innerHTML = `<div class="ttext">✨ <b>Tutorial ${i + 1}/${total}:</b> ${text}</div>
      <div class="tdots">${Array.from({ length: total }, (_, k) => `<span class="${k <= i ? 'on' : ''}"></span>`).join('')}</div>`;
  }
  tutorialDone() {
    el('tutorial').classList.add('hidden');
    this.toast('🎉 Tutorial complete! Have fun building!');
  }

  showAdopt(name) {
    const b = el('adoptbtn');
    b.classList.remove('hidden');
    b.textContent = `🐾 Adopt ${name}`;
    clearTimeout(this._adoptT);
    this._adoptT = setTimeout(() => b.classList.add('hidden'), 6000);
  }
  hideAdopt() { el('adoptbtn').classList.add('hidden'); }
  showFeed(label) {
    const b = el('feedbtn');
    b.classList.remove('hidden');
    b.textContent = label;
    clearTimeout(this._feedT);
    this._feedT = setTimeout(() => b.classList.add('hidden'), 6000);
  }
  hideFeed() { el('feedbtn').classList.add('hidden'); clearTimeout(this._feedT); }
  showPetToggle(mode) {
    const b = el('pettogglebtn');
    b.classList.remove('hidden');
    b.textContent = mode === 'stay' ? '🐾 Pets: staying \u2014 tap to follow' : '🐾 Pets: following \u2014 tap to stay';
  }
  hidePetToggle() { el('pettogglebtn').classList.add('hidden'); }

  // ---------- touch controls ----------
  buildTouch() {
    if (!this.input.isTouch) return;
    document.body.insertAdjacentHTML('beforeend', `
    <div id="touchui">
      <div id="joy"><div id="knob"></div></div>
      <div id="tbtns">
        <button id="tb_jump">⬆️<small>Jump</small></button>
        <button id="tb_break">⛏️<small>Break</small></button>
        <button id="tb_place">🧱<small>Place</small></button>
        <button id="tb_invert">🔄<small>Invert</small></button>
      </div>
    </div>`);
    const joy = el('joy'), knob = el('knob');
    let jid = null, cx = 0, cy = 0;
    const setKnob = (dx, dy) => {
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      this.input.joy.x = dx / 40; this.input.joy.y = dy / 40;
      this.input.joy.active = true;
    };
    joy.addEventListener('touchstart', e => {
      const t = e.changedTouches[0]; jid = t.identifier;
      const r = joy.getBoundingClientRect(); cx = r.left + 50; cy = r.top + 50;
      e.preventDefault();
    }, { passive: false });
    joy.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) if (t.identifier === jid) {
        let dx = t.clientX - cx, dy = t.clientY - cy;
        const l = Math.hypot(dx, dy);
        if (l > 40) { dx = dx / l * 40; dy = dy / l * 40; }
        setKnob(dx, dy);
      }
      e.preventDefault();
    }, { passive: false });
    const endJ = e => {
      for (const t of e.changedTouches) if (t.identifier === jid) {
        jid = null; knob.style.transform = 'translate(0,0)';
        this.input.joy.x = 0; this.input.joy.y = 0; this.input.joy.active = false;
      }
    };
    joy.addEventListener('touchend', endJ); joy.addEventListener('touchcancel', endJ);

    const hold = (id, down, up) => {
      const b = el(id);
      b.addEventListener('touchstart', e => { down(); e.preventDefault(); }, { passive: false });
      b.addEventListener('touchend', e => { up && up(); e.preventDefault(); });
    };
    hold('tb_jump', () => this.input.jumpHeld = true, () => this.input.jumpHeld = false);
    hold('tb_break', () => { this.input.breakHeld = true; this.input.breakEdge = true; }, () => this.input.breakHeld = false);
    hold('tb_place', () => { this.input.placeEdge = true; });
    const invBtn = document.getElementById('tb_invert');
    if (invBtn) invBtn.onclick = () => {
      const v = !this.h.invertLook;
      this.h.onToggleInvert(v);
    };
  }
}
