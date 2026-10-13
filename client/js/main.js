// WonderBlocks main: boot, game loop, building, multiplayer glue, saving.
import * as THREE from 'three';
import { B, blockDef, isBreakable } from 'wb-shared/blocks.js';
import { getSpawn, biomeNameAt } from 'wb-shared/worldgen.js';
import { MSG, ROLES, makeRoomCode } from 'wb-shared/protocol.js';
import { World } from './world.js';
import { loadAtlas } from './textures.js';
import { loadFaces } from './character.js';
import { Player, RemotePlayer } from './player.js';
import { Input } from './input.js';
import { Inventory } from './inventory.js';
import { UI } from './ui.js';
import { CraftingUI } from './crafting.js';
import { isItem, itemDef, toolTimeMultiplier } from 'wb-shared/items.js';
import { CritterManager } from './animals.js';
import { FOOD_DROPS, foodDef, isFood } from 'wb-shared/foods.js';
import { ANIMAL_DEFS } from 'wb-shared/animalDefs.js';
import { QuestManager } from './quests.js';
import { AudioSys } from './audio.js';
import { Net } from './net.js';

const SAVE_KEY = 'wb_demo';
const REACH = 6;

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x9fd8f0, 40, 140);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);

    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a9a6a, 1.0);
    const sun = new THREE.DirectionalLight(0xfff4d6, 1.6);
    sun.position.set(60, 100, 30);
    this.scene.add(hemi, sun);

    this.input = new Input(this.canvas);
    this.audio = new AudioSys();
    this.net = new Net();
    this.inv = new Inventory();
    this.quests = new QuestManager();
    this.remotes = new Map();
    this.isMulti = false;
    this.myRole = ROLES.BUILDER;
    this.settings = { volume: 0.5, unlimited: false };
    this.tutorial = -1;
    this.pet = null;
    this.breakState = null;
    this.lastPosSend = 0;
    this.wasInWater = false;

    this.ui = new UI(this.input, {
      onPlayDemo: name => this.startDemo(name),
      onCreateWorld: name => this.startMulti(name, makeRoomCode()),
      onJoinWorld: (code, name) => this.startMulti(name, code),
      onLeave: () => this.leave(),
      onSendChat: text => this.sendChat(text),
      onSelectHotbar: i => { this.inv.sel = i; this.ui.renderHotbar(this.inv); this.audio.click(); },
      onHotbarAssign: (slot, id) => { this.inv.setHotbarSlot(slot, id); this.ui.renderHotbar(this.inv); this.tutEvent('inventory'); this.audio.click(); },
      onToolbar: a => this.toolbar(a),
      onEmote: e => this.doEmote(e),
      onPlayerAction: (a, id) => this.playerAction(a, id),
      onAdopt: () => this.adoptPet(),
      onFeed: () => this.feedPet(),
      onTogglePets: () => this.togglePets(),
      onToggleUnlimited: v => { this.inv.unlimited = v; this.ui.renderHotbar(this.inv); },
      onVolume: v => { this.settings.volume = v; this.audio.volume = v; if (this.audio.master) this.audio.master.gain.value = this.audio.muted ? 0 : v; },
    });
    this.ui.playerName = localStorage.getItem('wb_name') || 'Builder';
    this.ui.h.unlimited = false;
    this.ui.h.volume = this.settings.volume;

    // crafting panel (C key / 🛠️ toolbar button)
    this.crafting = new CraftingUI({
      onToast: m => this.ui.toast(m),
      playSound: () => { this.audio.ensure(); this.audio.pop(); },
      onCrafted: itemId => { if (this.isMulti) this.net.send({ t: MSG.CRAFT, recipe: itemId }); },
      isWorkbenchNearby: () => this.nearWorkbench(),
    });

    // input action callbacks
    this.input.onAction.inventory = () => { this.audio.ensure(); this.ui.toggleInventory(this.inv); this.unlockPointer(); };
    this.input.onAction.crafting = () => { this.audio.ensure(); this.crafting.toggle(this.inv); this.unlockPointer(); };
    this.input.onAction.chat = () => this.ui.toggleChat();
    this.input.onAction.menu = () => { if (this.started) this.ui.togglePause(this.isMulti, this.myRole === ROLES.OWNER); };
    this.input.onAction.firstperson = () => { this.audio.ensure(); this.audio.click(); this.toggleCamera(); };
    this.input.onAction.mute = () => this.toggleMute();

    this.quests.onUpdate = () => this.ui.setQuests(this.quests);
    this.quests.onReward = q => {
      this.audio.quest();
      this.ui.toast(`🎉 Quest complete: ${q.text} (+${q.reward.coins} 🪙)`);
      this.ui.setStats(this.quests.coins, this.quests.xp);
      this.ui.setQuests(this.quests);
    };
    this.inv.onChange = () => { if (this.started) this.ui.renderHotbar(this.inv); };

    const roomParam = new URLSearchParams(location.search).get('room');
    if (roomParam && location.host) this.ui.menuJoin();

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.input.attach();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    // test hook: ?autostart=1 skips the menu (used by automated smoke tests)
    if (new URLSearchParams(location.search).get('autostart') === '1') {
      setTimeout(() => this.startDemo('Tester'), 600);
    }
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
  unlockPointer() { if (document.pointerLockElement) document.exitPointerLock(); }
  toggleMute() {
    this.audio.ensure();
    this.audio.setMuted(!this.audio.muted);
    this.ui.toast(this.audio.muted ? '🔇 Muted' : '🔊 Sound on');
  }

  // ---------------- startup ----------------
  async bootWorld(seed, spawnPos) {
    this.ui.loading(0.05, 'Growing the world… 🌱');
    const atl = await loadAtlas();
    this.faceTexs = await loadFaces();
    this.world = new World(this.scene, seed, atl.a);
    this.atlasB = atl.b;
    this._atlasT = 0; this._atlasFrame = 0;
    await this.world.bootAround(spawnPos[0], spawnPos[2], p => this.ui.loading(0.05 + p * 0.85, 'Growing the world… 🌱'));
    const faceTex = this.faceTexs ? this.faceTexs[(Math.random() * this.faceTexs.length) | 0] : null;
    this.player = new Player(this.scene, this.world, this.ui.char, spawnPos, faceTex);
    // Failsafe: stale/corrupt saves can place the player inside solid terrain
    // or at invalid coords (camera collapses into the character). Lift to open
    // air, or reset to spawn.
    {
      const p = this.player.pos;
      const s = getSpawn();
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) p.set(s[0], s[1], s[2]);
      const solidAt = (x, y, z) => { const b = this.world.get(Math.floor(x), Math.floor(y), Math.floor(z)); return b !== B.AIR && blockDef(b).solid; };
      let guard = 0;
      while (guard++ < 80 && solidAt(p.x, p.y, p.z)) p.y += 1;
      if (guard >= 80 || p.y >= 63 || !Number.isFinite(p.y)) p.set(s[0], s[1], s[2]);
    }
    this.critters = new CritterManager(this.scene, this.world);
    await this.critters.spawnInitial();
    // highlight + ghost preview
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
      new THREE.LineBasicMaterial({ color: 0xffffff }));
    this.highlight.visible = false;
    this.scene.add(this.highlight);
    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.98, 0.98),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
    this.ghost.visible = false;
    this.scene.add(this.ghost);
    this.ui.loading(1, 'Ready!');
    this.ui.showHUD();
    this.ui.renderHotbar(this.inv);
    this.ui.setStats(this.quests.coins, this.quests.xp);
    this.ui.setQuests(this.quests);
    this.started = true;
    this.input.enabled = true;
    this.audio.ensure();
    this.audio.startMusic();
    this.lastSave = performance.now();
  }

  async startDemo(name) {
    this.saveName(name);
    this.isMulti = false;
    let save = null;
    try { save = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { /* noop */ }
    const seed = save?.seed ?? (Math.random() * 2 ** 32) | 0;
    if (save?.inv) this.inv.deserialize(save.inv);
    if (save?.quests) this.quests.deserialize(save.quests);
    await this.bootWorld(seed, save?.player || getSpawn());
    if (save?.edits) for (const [x, y, z, b] of save.edits) this.world.set(x, y, z, b);
    this.ui.chatAdd('', `Welcome back to WonderBlocks, ${name}! 🌱`, false, true);
    if (!save?.tutorialDone) this.startTutorial();
    if (save?.pet || save?.pets) this.restorePet(save);
  }

  async startMulti(name, code) {
    this.saveName(name);
    this.ui.loading(0.02, 'Connecting… 🔗');
    try { await this.net.connect(); }
    catch {
      this.ui.showMenu();
      this.ui.toast('Could not reach a WonderBlocks server. Play the demo, or run node wonderblocks-host.js on your computer.');
      return;
    }
    this.isMulti = true;
    this.ui.roomCode = code;
    const clientId = localStorage.getItem('wb_client') || (Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem('wb_client', clientId);
    this.wireNet(name);
    this.net.join(code, name, this.ui.char, clientId);
    this._joinName = name;
    this._joinCode = code;
    // WELCOME handler continues boot
  }

  wireNet(name) {
    const net = this.net;
    net.on(MSG.WELCOME, async m => {
      this.myId = m.id;
      this.myRole = (m.roles && m.roles[m.id]) || ROLES.BUILDER;
      await this.bootWorld(m.seed, getSpawn());
      for (const [x, y, z, b] of m.edits || []) this.world.set(x, y, z, b);
      for (const p of m.players || []) this.addRemote(p);
      this.ui.chatAdd('', `Joined world ${this._joinCode}! Share the code with friends. 🎉`, false, true);
      this.ui.toast(`Room code: ${this._joinCode} — invite friends!`);
    });
    net.on(MSG.PLAYER_JOIN, p => { this.addRemote(p); this.ui.chatAdd('', `${p.name} joined! 👋`, false, true); });
    net.on(MSG.PLAYER_LEAVE, m => { this.removeRemote(m.id); });
    net.on(MSG.POS, m => {
      const r = this.remotes.get(m.id);
      if (r) r.setTarget(m.x, m.y, m.z, m.ry, m.anim);
    });
    net.on(MSG.EDIT, m => { this.world.set(m.x, m.y, m.z, m.b); });
    net.on(MSG.CHAT, m => this.ui.chatAdd(m.name, m.text, m.from === this.myId));
    net.on(MSG.CRAFT, m => {
      if (m.by === this.myId) return; // we already toasted our own craft locally
      const idef = itemDef(m.item);
      this.ui.toast(`🔨 ${m.name || 'Someone'} crafted ${idef ? idef.name : 'something'}`);
    });
    net.on(MSG.EMOTE, m => { const r = this.remotes.get(m.id); if (r) r.mode = m.e; });
    net.on(MSG.ROLE, m => {
      this.myRole = m.roles[this.myId] || ROLES.BUILDER;
      this.ui.toast('Your role: ' + this.myRole);
    });
    net.on('claims', m => this.ui.toast(m.claims.length ? `🚩 ${m.claims.length} claimed area(s)` : '🚩 Claim removed'));
    net.on(MSG.ERROR, m => this.ui.toast('⚠️ ' + m.msg));
    net.on('__close', () => {
      if (this.isMulti && this.started) { this.ui.toast('Disconnected from world.'); this.leave(); }
    });
  }

  addRemote(p) {
    if (p.id === this.myId || this.remotes.has(p.id)) return;
    let faceTex = null;
    if (this.faceTexs) {
      let hsh = 0;
      for (const ch of String(p.id)) hsh = (hsh * 31 + ch.charCodeAt(0)) | 0;
      faceTex = this.faceTexs[Math.abs(hsh) % this.faceTexs.length];
    }
    const r = new RemotePlayer(this.scene, p.char, p.name, faceTex);
    r.snap(p.x, p.y, p.z);
    // name label
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 48;
    const g = cv.getContext('2d');
    g.font = 'bold 30px system-ui'; g.textAlign = 'center';
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(28, 4, 200, 40);
    g.fillStyle = '#fff'; g.fillText(p.name.slice(0, 14), 128, 34);
    const tex = new THREE.CanvasTexture(cv);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    spr.scale.set(2.2, 0.42, 1); spr.position.y = 2.35;
    r.mesh.add(spr);
    this.remotes.set(p.id, r);
  }
  removeRemote(id) {
    const r = this.remotes.get(id);
    if (r) { this.ui.chatAdd('', `${r.name} left. 👋`, false, true); r.dispose(this.scene); this.remotes.delete(id); }
  }

  saveName(name) {
    this.playerName = name;
    this.ui.playerName = name;
    try { localStorage.setItem('wb_name', name); } catch { /* noop */ }
  }

  leave() {
    if (!this.isMulti) this.saveDemo();
    this.net.close();
    this.isMulti = false;
    this.started = false;
    this.input.enabled = false;
    for (const [, r] of this.remotes) r.dispose(this.scene);
    this.remotes.clear();
    location.hash = '';
    this.ui.showMenu();
  }

  saveDemo() {
    if (!this.world || !this.player) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        seed: this.world.seed,
        edits: this.world ? this.world.editsList() : [],
        player: [this.player.pos.x, this.player.pos.y, this.player.pos.z],
        inv: this.inv.serialize(),
        quests: this.quests.serialize(),
        tutorialDone: this.tutorialDoneFlag,
        pet: this.pet ? { kind: this.pet.kind, name: this.pet.name } : null, // legacy (read path only)
        pets: this.critters ? this.critters.myPets().map(c => ({ kind: c.kind, name: c.name })) : [],
      }));
    } catch { /* noop */ }
  }

  // ---------------- actions ----------------
  toolbar(a) {
    this.audio.ensure(); this.audio.click();
    if (a === 'inventory') { this.ui.toggleInventory(this.inv); this.unlockPointer(); }
    else if (a === 'chat') this.ui.toggleChat();
    else if (a === 'players') this.ui.togglePlayers(this.playerList(), this.myId || 'me', this.myRole === ROLES.OWNER);
    else if (a === 'emotes') document.getElementById('emotebar').classList.toggle('hidden');
    else if (a === 'crafting') { this.crafting.toggle(this.inv); this.unlockPointer(); }
    else if (a === 'claim') this.claimLand();
    else if (a === 'mute') this.toggleMute();
    else if (a === 'camera') this.toggleCamera();
    else if (a === 'menu') this.ui.togglePause(this.isMulti, this.myRole === ROLES.OWNER);
  }
  toggleCamera() {
    if (!this.player) return;
    this.player.firstPerson = !this.player.firstPerson;
    this.ui.toast(this.player.firstPerson ? '🎥 First-person' : '🎥 Third-person');
  }
  playerList() {
    const list = [{ id: this.myId || 'me', name: this.playerName || 'Builder', role: this.myRole }];
    for (const [id, r] of this.remotes) list.push({ id, name: r.name, role: ROLES.BUILDER });
    return list;
  }
  playerAction(a, id) {
    if (a === 'promote') this.net.send({ t: MSG.ROLE, target: id, role: ROLES.BUILDER });
    else if (a === 'visitor') this.net.send({ t: MSG.ROLE, target: id, role: ROLES.VISITOR });
    else if (a === 'kick') this.net.send({ t: MSG.KICK, target: id });
  }
  sendChat(text) {
    if (this.isMulti) this.net.send({ t: MSG.CHAT, text });
    else this.ui.chatAdd(this.playerName || 'Builder', text, true);
    this.audio.click();
  }
  doEmote(e) {
    this.player.playEmote(e);
    if (this.isMulti) this.net.send({ t: MSG.EMOTE, e });
    this.audio.pop();
  }
  claimLand() {
    if (!this.isMulti) { this.ui.toast('🚩 Claims protect builds in multiplayer worlds.'); return; }
    const p = this.player.pos;
    this.net.send({ t: MSG.CLAIM, x: Math.floor(p.x), z: Math.floor(p.z) });
  }
  // true when a workbench block is within 8 blocks of the player (unlocks gold/crystal recipes)
  nearWorkbench() {
    if (!this.world || !this.player) return true; // menu contexts stay permissive
    const px = Math.floor(this.player.pos.x), py = Math.floor(this.player.pos.y), pz = Math.floor(this.player.pos.z);
    for (let dx = -8; dx <= 8; dx++) for (let dy = -4; dy <= 4; dy++) for (let dz = -8; dz <= 8; dz++) {
      if (this.world.get(px + dx, py + dy, pz + dz) === B.WORKBENCH) return true;
    }
    return false;
  }
  adoptPet() {
    const c = this.critters.nearestAdoptable(this.player.pos);
    if (!c) return;
    c.petOf = 'me';
    c.name = (c.kind === 'rabbit' ? 'Bunny' : 'Clucky') + ' ' + ['Boo', 'Mochi', 'Pip', 'Lulu'][(Math.random() * 4) | 0];
    this.pet = c;
    this.ui.hideAdopt();
    this.ui.toast(`🐾 You adopted ${c.name}! They'll follow you everywhere.`);
    this.audio.quest();
  }
  feedPet() {
    const c = this.critters.nearestTameable(this.player.pos);
    if (!c) return;
    const r = this.critters.feed(c, this.inv);
    if (!r.ok) {
      const f = r.food;
      this.ui.toast(`You need ${f?.icon || '🍎'} ${f?.name || 'food'}! ${f?.desc || ''}`);
      return;
    }
    this.audio.pop();
    this.ui.hideFeed();
    if (r.tamed) {
      this.audio.quest();
      this.ui.toast(`💕 ${r.critter.name} the ${r.critter.kind} is tamed! They'll follow you.`);
      this.ui.chatAdd('', `💕 You tamed ${r.critter.name} the ${r.critter.kind}!`, false, true);
    } else {
      this.ui.toast(`${ANIMAL_DEFS[r.critter.kind].label} nibbles… 💛 (trust ${r.trust}/${r.need})`);
    }
  }
  togglePets() {
    const pets = this.critters.myPets();
    if (!pets.length) return;
    const to = pets[0].mode === 'follow' ? 'stay' : 'follow';
    this.critters.setPetsMode(to);
    this.audio.click();
    this.ui.toast(to === 'stay' ? '🐾 Pets are staying put.' : '🐾 Pets are following you!');
  }
  restorePet(saved) {
    // accepts legacy {kind,name}, {pets:[...]}, or an array — restores via the manager
    const list = saved?.pets || (Array.isArray(saved) ? saved : (saved ? [saved] : []));
    let first = null;
    for (const s of list) {
      if (!s || !ANIMAL_DEFS[s.kind]) continue;
      const c = this.critters.tameByKind(s.kind, s.name);
      if (c && !first) first = c;
    }
    if (first) this.pet = first; // legacy single-pet pointer (adopt button compat)
  }

  // ---------------- tutorial ----------------
  startTutorial() {
    this.tutorial = 0;
    this.tutFlags = {};
    this.showTutStep();
  }
  showTutStep() {
    const steps = [
      'Move with <b>WASD</b> / arrows (or the joystick).',
      'Jump with <b>Space</b>!',
      'Break a block: aim at it and <b>hold Left-click</b> (or tap it, then ⛏️).',
      'Press <b>E</b> to open your inventory and pick a block for your hotbar.',
      'Place it with <b>Right-click</b> (or the 🧱 button). Nice!',
    ];
    if (this.tutorial >= steps.length) {
      this.tutorial = -1; this.tutorialDoneFlag = true;
      this.ui.tutorialDone(); this.saveDemo();
      return;
    }
    this.ui.tutorialStep(this.tutorial, steps.length, steps[this.tutorial] + ' <small>(tap here to skip)</small>');
    document.getElementById('tutorial').onclick = () => { this.tutorial = -1; this.ui.tutorialDone(); };
  }
  tutEvent(ev) {
    if (this.tutorial < 0) return;
    const order = ['move', 'jump', 'break', 'inventory', 'place'];
    if (order[this.tutorial] === ev) { this.tutorial++; this.showTutStep(); }
  }

  // ---------------- block interaction ----------------
  applyEdit(x, y, z, b) {
    // world.set records the edit in world.edits (the save/load source of truth)
    if (!this.world.set(x, y, z, b)) return false;
    if (this.isMulti) this.net.send({ t: MSG.EDIT, x, y, z, b });
    return true;
  }

  currentTarget() {
    const cam = this.camera;
    const tap = this.input.consumeTap();
    let ox, oy, oz, dx, dy, dz;
    if (tap) {
      const nx = (tap.x / innerWidth) * 2 - 1, ny = -(tap.y / innerHeight) * 2 + 1;
      const v = new THREE.Vector3(nx, ny, 0.5).unproject(cam);
      const dir = v.sub(cam.position).normalize();
      ox = cam.position.x; oy = cam.position.y; oz = cam.position.z;
      dx = dir.x; dy = dir.y; dz = dir.z;
      this._tapTargetUntil = performance.now() + 8000;
    } else if (this._tapTargetUntil && performance.now() < this._tapTargetUntil && this._lastTapHit) {
      return this._lastTapHit; // keep tap target while placing/breaking
    } else {
      const d = this.player.viewDir();
      const h = this.player.headPos();
      ox = h.x; oy = h.y; oz = h.z; dx = d.x; dy = d.y; dz = d.z;
    }
    const hit = this.world.raycast(ox, oy, oz, dx, dy, dz, REACH);
    if (tap) this._lastTapHit = hit;
    return hit;
  }

  updateTargeting(dt) {
    const hit = this.currentTarget();
    this.target = hit;
    if (hit) {
      this.highlight.visible = true;
      this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      this.ui.setTargetLabel(blockDef(hit.id).name);
      const px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
      const sel = this.inv.selectedBlock();
      const existing = this.world.get(px, py, pz);
      if ((existing === B.AIR || existing === B.WATER) && this.inv.canPlace(sel) && blockDef(sel)) {
        this.ghost.visible = true;
        this.ghost.position.set(px + 0.5, py + 0.5, pz + 0.5);
        this.ghost.material.color.set(this.ui ? 0xffffff : 0xffffff);
      } else this.ghost.visible = false;
    } else {
      this.highlight.visible = false;
      this.ghost.visible = false;
      this.ui.setTargetLabel('');
    }

    // breaking (hold)
    const breaking = this.input.breakHeld || this.input.consumeBreakEdge();
    if (breaking && hit && isBreakable(hit.id)) {
      const key = hit.x + ',' + hit.y + ',' + hit.z;
      if (!this.breakState || this.breakState.key !== key) this.breakState = { key, t: 0 };
      this.breakState.t += dt;
      const need = blockDef(hit.id).hardness * toolTimeMultiplier(this.inv.selectedItem(), hit.id);
      this.ui.setTargetLabel(`${blockDef(hit.id).name}… ${Math.min(99, Math.round(this.breakState.t / need * 100))}%`);
      if (this.breakState.t >= need) {
        this.breakBlock(hit.x, hit.y, hit.z, hit.id);
        this.breakState = null;
      }
    } else this.breakState = null;

    // placing (edge)
    if (this.input.consumePlaceEdge() && hit) this.tryPlace(hit);
    // hotbar select
    const w = this.input.consumeWheel();
    if (w) { this.inv.sel = (this.inv.sel + w + 9) % 9; this.ui.renderHotbar(this.inv); }
    const d = this.input.consumeDigit();
    if (d >= 1 && d <= 9) { this.inv.sel = d - 1; this.ui.renderHotbar(this.inv); }
  }

  breakBlock(x, y, z, id) {
    const def = blockDef(id);
    this.applyEdit(x, y, z, B.AIR);
    const drop = def.drop ?? id;
    this.inv.add(drop);
    // food bonus drops (animals subsystem)
    for (const r of (FOOD_DROPS[id] || [])) {
      if (Math.random() < r.chance) {
        this.inv.add(r.food, r.n);
        const f = foodDef(r.food);
        if (f) { this.ui.toast(`${f.icon} +${r.n} ${f.name}!`); this.audio.pickup(); }
      }
    }
    this.audio.breakB();
    this.quests.handle('break', id);
    this.tutEvent('break');
    if (Math.random() < 0.4) this.audio.pickup();
  }

  tryPlace(hit) {
    const sel = this.inv.selectedBlock();
    if (isFood(sel)) { this.ui.toast("That's food — feed it to a wild animal instead! 🍎"); return; }
    // Craftable utilities (torch/workbench) are items that resolve to a real block.
    const selItem = isItem(sel) ? itemDef(sel) : null;
    const placeId = selItem ? (selItem.placesBlock || null) : sel;
    if (placeId == null) return; // wielding a non-placeable item (sword, armor...): nothing to place
    const px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
    const existing = this.world.get(px, py, pz);
    if (existing !== B.AIR && existing !== B.WATER) return;
    if (py < 1 || py > 62) return;
    if (!this.inv.canPlace(placeId)) { this.ui.toast('Out of blocks! Break some or pick another in 🎒.'); return; }
    // don't place solid blocks inside the player
    const def = blockDef(placeId);
    if (def.solid) {
      const p = this.player.pos;
      if (px + 1 > p.x - 0.3 && px < p.x + 0.3 && pz + 1 > p.z - 0.3 && pz < p.z + 0.3 && py + 1 > p.y && py < p.y + 1.8) {
        this.ui.toast('Too close to place there!'); return;
      }
    }
    this.inv.remove(placeId);
    this.applyEdit(px, py, pz, placeId);
    this.audio.pop();
    this.quests.handle('place', placeId);
    this.quests.handle('house', placeId);
    if ([B.FLOWER_RED, B.FLOWER_YELLOW, B.FLOWER_BLUE].includes(placeId)) this.quests.handle('plant', placeId);
    this.tutEvent('place');
    if (placeId === B.CLAIM_FLAG && this.isMulti) this.claimLand();
  }

  // ---------------- main loop ----------------
  loop() {
    requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - (this._last || now)) / 1000);
    this._last = now;

    if (!this.started) { this.renderer.render(this.scene, this.camera); return; }

    // look
    const { dx, dy } = this.input.consumeLook();
    if (this.input.enabled) {
      this.player.yaw -= dx * 0.0032 * (this.settings.sens || 1);
      this.player.pitch -= dy * 0.0032 * (this.settings.sens || 1);
      this.player.pitch = Math.max(-1.25, Math.min(1.25, this.player.pitch));
    }
    const mv = this.input.moveVec();
    if (this.input.enabled) {
      this.player.update(dt, { f: mv.f, s: mv.s, jump: this.input.jumpHeld, sprint: this.input.sprintKey || (this.input.joy.active && Math.hypot(mv.f, mv.s) > 0.92) });
      if (Math.hypot(mv.f, mv.s) > 0.3 && this.player.speed2d > 1) this.tutEvent('move');
      if (this.input.jumpHeld && this.player.vel.y > 3) this.tutEvent('jump');
    }
    this.player.updateCamera(this.camera);
    if (this.started) this.updateTargeting(dt);
    this.world.setTime(now / 1000); // water animation clock (uTime + texture frames)
    this.world.update(this.player.pos.x, this.player.pos.z);
    this.critters.update(dt, this.player.pos);
    for (const [, r] of this.remotes) r.update(dt);

    // animated atlas frames (water shimmer, glow pulse, crystal sparkle)
    if (this.atlasB && this.world) {
      this._atlasT += dt;
      if (this._atlasT > 0.55) {
        this._atlasT = 0;
        this._atlasFrame ^= 1;
        this.world.setAtlasFrame(this._atlasFrame ? this.atlasB : this.world.atlas);
      }
    }

    // water splash
    if (this.player.inWater && !this.wasInWater) this.audio.splash();
    this.wasInWater = this.player.inWater;

    // depth quest
    if (this.player.pos.y < 14) this.quests.handle('depth');

    // feed-to-tame prompt (animals subsystem)
    const tameable = this.critters.nearestTameable(this.player.pos);
    const favFood = tameable ? ANIMAL_DEFS[tameable.kind].favoriteFood : null;
    const hasFood = favFood != null && this.inv.count(favFood) > 0;
    if (tameable && hasFood) {
      const f = foodDef(favFood);
      this.ui.showFeed(`${f.icon} Feed ${ANIMAL_DEFS[tameable.kind].label}`);
    } else this.ui.hideFeed();
    // legacy instant-adopt: only when the player has no favorite food on hand (no double buttons)
    const adoptable = this.critters.nearestAdoptable(this.player.pos);
    const myPetCount = this.critters.myPets().length;
    if (adoptable && myPetCount === 0 && !(tameable === adoptable && hasFood)) this.ui.showAdopt(adoptable.kind === 'rabbit' ? 'Bunny' : 'Chick');
    else this.ui.hideAdopt();
    // stay/follow toggle for pets
    if (myPetCount > 0) this.ui.showPetToggle(this.critters.myPets()[0].mode);
    else this.ui.hidePetToggle();

    // multiplayer pos sync 10Hz
    if (this.isMulti && now - this.lastPosSend > 100) {
      this.lastPosSend = now;
      const p = this.player.pos;
      this.net.send({ t: MSG.POS, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), ry: +this.player.mesh.rotation.y.toFixed(2), anim: this.player.anim });
    }

    // HUD
    this.ui.drawCompass(this.player.yaw);
    const bn = biomeNameAt(Math.floor(this.player.pos.x), Math.floor(this.player.pos.z));
    if (bn !== this._biome) { this._biome = bn; this.ui.setBiome(bn); if (this.started && this._biomeInit) this.ui.toast('📍 ' + bn); this._biomeInit = true; }

    // autosave demo
    if (!this.isMulti && now - this.lastSave > 20000) { this.lastSave = now; this.saveDemo(); }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => { window._game = new Game(); });
