// WonderBlocks main: boot, game loop, building, multiplayer glue, saving.
import * as THREE from 'three';
import { B, blockDef, isBreakable } from 'wb-shared/blocks.js?v=20';
import { getSpawn, getDimensionSpawn, biomeNameAt, DIM, DIM_NAMES, WORLD_Y, buildChunkData } from 'wb-shared/worldgen.js?v=20';
import { MSG, ROLES, makeRoomCode } from 'wb-shared/protocol.js?v=20';
import { World } from './world.js?v=20';
import { loadAtlas } from './textures.js?v=20';
import { loadFaces } from './character.js?v=20';
import { Player, RemotePlayer } from './player.js?v=20';
import { Input } from './input.js?v=20';
import { Inventory } from './inventory.js?v=20';
import { UI } from './ui.js?v=20';
import { CraftingUI } from './crafting.js?v=20';
import { FarmingSystem } from './farming.js?v=20';
import { FishingSystem } from './fishing.js?v=20';
import { FurnaceSystem, FurnaceUI } from './furnace.js?v=20';
import { isItem, itemDef, toolTimeMultiplier } from 'wb-shared/items.js?v=20';
import { CritterManager } from './animals.js?v=20';
import { FOOD_DROPS, FOOD_VALUES, foodDef, isFood } from 'wb-shared/foods.js?v=20';
import { ANIMAL_DEFS } from 'wb-shared/animalDefs.js?v=20';
import { QuestManager } from './quests.js?v=20';
import { AudioSys } from './audio.js?v=20';
import { Net } from './net.js?v=20';

const SAVE_KEY = 'wb_demo';
const REACH = 6;
const FLINT_ID = 141; // Flint & Steel (Phase 8): lights obsidian portal frames

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
    this.hemi = hemi; this.sun = sun; // Phase 8: dimmed/tinted per dimension

    this.input = new Input(this.canvas);
    this.audio = new AudioSys();
    this.net = new Net();
    this.inv = new Inventory();
    this.quests = new QuestManager();
    this.remotes = new Map();
    this.isMulti = false;
    this.myRole = ROLES.BUILDER;
    this.settings = { volume: 0.5, unlimited: false, invertLook: false };
    this.tutorial = -1;
    this.pet = null;
    this.breakState = null;
    this.lastPosSend = 0;
    this.wasInWater = false;
    this.dimension = DIM.OVERWORLD; // Phase 8: current dimension
    this._portalCooldown = 0;       // seconds of teleport immunity after hopping

    this.ui = new UI(this.input, {
      onPlayDemo: name => this.startDemo(name),
      onCreateWorld: name => this.startMulti(name, makeRoomCode()),
      onJoinWorld: (code, name) => this.startMulti(name, code),
      onLeave: () => this.leave(),
      onRespawn: () => this.respawn(),
      onSendChat: text => this.sendChat(text),
      onSelectHotbar: i => { this.inv.sel = i; this.ui.renderHotbar(this.inv); this.audio.click(); this.updateHeldItem(); },
      onHotbarAssign: (slot, id) => { this.inv.setHotbarSlot(slot, id); this.ui.renderHotbar(this.inv); this.tutEvent('inventory'); this.audio.click(); },
      onToolbar: a => this.toolbar(a),
      onEmote: e => this.doEmote(e),
      onPlayerAction: (a, id) => this.playerAction(a, id),
      onAdopt: () => this.adoptPet(),
      onFeed: () => this.feedPet(),
      onTogglePets: () => this.togglePets(),
      onRide: () => this.mountPet(),
      onBreed: () => this.breedPet(),
      onCollar: () => this.collarPet(),
      onDismount: () => this.dismountPet(),
      onToggleUnlimited: v => { this.inv.unlimited = v; this.ui.renderHotbar(this.inv); },
      onToggleInvert: v => { this.settings.invertLook = v; this.ui.h.invertLook = v; this.ui.toast(v ? '🔄 Look inverted' : '🔄 Look normal'); },
      onVolume: v => { this.settings.volume = v; this.audio.volume = v; if (this.audio.master) this.audio.master.gain.value = this.audio.muted ? 0 : v; },
    });
    this.ui.playerName = localStorage.getItem('wb_name') || 'Builder';
    this.ui.h.unlimited = false;
    this.ui.h.volume = this.settings.volume;
    this.ui.h.invertLook = this.settings.invertLook;

    // crafting panel (C key / 🛠️ toolbar button)
    this.farming = new FarmingSystem(this);
    this.fishing = new FishingSystem(this);
    this.furnaceUI = new FurnaceUI();
    this.furnace = new FurnaceSystem(this, this.furnaceUI);
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
    // Survival callbacks
    const vitals = () => this.ui.renderVitals(this.player.health, this.player.maxHealth, this.player.hunger, this.player.maxHunger);
    this.player.onDamage = (amt, cause) => { vitals(); this.audio.hurt?.(); };
    this.player.onHeal = () => vitals();
    this.player.onHunger = () => vitals();
    this.player.onEat = () => vitals();
    this.player.onDeath = (cause) => {
      if (this.player.riding) this.dismountPet(); // don't respawn glued to a horse
      const msgs = { fall: 'took a long fall', starve: 'starved', mob: 'was defeated', drown: 'drowned' };
      this.ui.toast(`💀 You ${msgs[cause] || 'died'}! Respawning…`);
      setTimeout(() => { this.player.revive(); this.respawn(); vitals(); }, 2000);
    };
    vitals();
    // Failsafe: stale/corrupt saves can place the player inside solid terrain,
    // at invalid coords, or trapped under a structure (camera collapses into
    // the character). Lift to open air, ensure open sky above, or reset to spawn.
    {
      const p = this.player.pos;
      const s = getSpawn();
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) p.set(s[0], s[1], s[2]);
      const solidAt = (x, y, z) => { const b = this.world.get(Math.floor(x), Math.floor(y), Math.floor(z)); return b !== B.AIR && blockDef(b).solid; };
      let guard = 0;
      while (guard++ < 80 && solidAt(p.x, p.y, p.z)) p.y += 1;
      // Sky check: if there's a roof/structure within 8 blocks above, the
      // camera can't get a clear view — relocate to the spawn pad.
      let skyClear = true;
      for (let y = Math.floor(p.y) + 2; y < Math.floor(p.y) + 10; y++) {
        if (solidAt(p.x, y, p.z)) { skyClear = false; break; }
      }
      if (guard >= 80 || p.y >= 63 || !Number.isFinite(p.y) || !skyClear) p.set(s[0], s[1], s[2]);
    }
    this.critters = new CritterManager(this.scene, this.world);
    await this.critters.spawnInitial();
    // Hostile monsters (Phase 6)
    try {
      const { MonsterManager } = await import('./monsters.js?v=20');
      this.monsters = new MonsterManager(this.scene, this.world, this.player);
      this.monsters.onKill = (def) => {
        this.ui.toast(`⚔️ Defeated ${def.label}! +${def.xp} XP`);
        this.audio.pickup();
      };
    } catch { /* monsters are optional */ }
    // Villager NPCs (Phase 7)
    try {
      const { VillagerManager } = await import('./villagers.js?v=18');
      this.villagers = new VillagerManager(
        this.scene, this.world, this.player, this.inv, this.ui, this.audio);
      // Restore saved villagers or spawn fresh
      const vsave = save?.villagers || null;
      this.villagers.load(vsave);
    } catch { /* villagers are optional */ }
    // Load item sprites for the 3D held-item display
    try {
      const { loadItemIcons } = await import('./itemArt.js?v=20');
      this.player.itemIconMap = await loadItemIcons();
      this.updateHeldItem();
    } catch { /* held item is decorative */ }
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
    // Phase 8: always boot the overworld first; the saved dimension (if any)
    // is restored after edits are applied below.
    this.dimension = DIM.OVERWORLD;
    await this.bootWorld(seed, save?.player || getSpawn());
    this.applyDimensionSky();
    // edits are [x,y,z,b] (legacy) or [x,y,z,b,dim] (Phase 8+) — restore per dimension
    if (save?.edits) for (const [x, y, z, b, d] of save.edits) this.world.setRaw(x, y, z, b, d ?? DIM.OVERWORLD);
    // Phase 8: resume in the saved dimension
    if (save?.dimension && save.dimension !== DIM.OVERWORLD && save.player) {
      await this.enterDimension(save.dimension, save.player[0], save.player[1], save.player[2], { silent: true });
    }
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
    this.dimension = DIM.OVERWORLD; // multiplayer rooms live in the overworld
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

  respawn() {
    // Phase 8: respawn in the current dimension (village in the overworld).
    const s = getDimensionSpawn(this.world ? this.world.seed : 0, this.dimension);
    this.player.pos.set(s[0], s[1], s[2]);
    this.player.vel.set(0, 0, 0);
    this.ui.toast(this.dimension === DIM.OVERWORLD ? '📍 Respawned at the village!' : `📍 Respawned in the ${DIM_NAMES[this.dimension]}!`);
    this.ui.showPlayers(false);
  }

  // ---------------- Phase 8: dimensions & portals ----------------
  // Tint sky, fog and lights per dimension.
  applyDimensionSky() {
    const d = this.dimension;
    if (d === DIM.EMBER) {
      this.scene.background.set(0x200505);
      this.scene.fog.color.set(0x521505);
      this.scene.fog.near = 20; this.scene.fog.far = 90;
      this.sun.intensity = 0.7; this.sun.color.set(0xff9a5c);
      this.hemi.intensity = 0.5;
    } else if (d === DIM.CLOUD) {
      this.scene.background.set(0x9fd4ff);
      this.scene.fog.color.set(0xcfeaff);
      this.scene.fog.near = 50; this.scene.fog.far = 200;
      this.sun.intensity = 1.8; this.sun.color.set(0xfff4d6);
      this.hemi.intensity = 1.2;
    } else {
      this.scene.background.set(0x87ceeb);
      this.scene.fog.color.set(0x9fd8f0);
      this.scene.fog.near = 40; this.scene.fog.far = 140;
      this.sun.intensity = 1.6; this.sun.color.set(0xfff4d6);
      this.hemi.intensity = 1.0;
    }
  }

  // Hop to another dimension: clear chunks, regenerate around the target,
  // keep inventory + player. Pets stay behind (they'll be there when you return).
  async enterDimension(dim, x, y, z, opts = {}) {
    if (!this.world || !this.player) return;
    this.dimension = dim;
    this.world.setDimension(dim);
    this.player.pos.set(x, y, z);
    this.player.vel.set(0, 0, 0);
    this.ui.loading(0.5, `Entering the ${DIM_NAMES[dim]}… 🌀`);
    await this.world.bootAround(x, z);
    this.applyDimensionSky();
    this.ui.loading(1, 'Ready!');
    if (!opts.silent) {
      this.ui.toast(`🌀 Welcome to the ${DIM_NAMES[dim]}!`);
      this.audio.quest();
    }
    this._portalCooldown = 3; // don't bounce straight back through
    this._biome = null; // refresh the location label
  }

  // Find a safe landing spot in the target dimension near (x, z):
  // topmost solid block with two air blocks above it.
  findLanding(dim, x, z) {
    const w = this.world;
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
    // generate the target chunk data directly (pure) without switching worlds
    const data = buildChunkData(w.seed, cx, cz, dim);
    const cidx = (lx, y, lz) => (y * 16 + lz) * 16 + lx;
    const lx = x - cx * 16, lz = z - cz * 16;
    for (let y = WORLD_Y - 2; y > 1; y--) {
      const b = data[cidx(lx, y, lz)];
      if (b !== B.AIR && b !== B.WATER && b !== B.LAVA && blockDef(b).solid &&
          data[cidx(lx, y + 1, lz)] === B.AIR && data[cidx(lx, y + 2, lz)] === B.AIR) {
        return [x + 0.5, y + 1.01, z + 0.5];
      }
    }
    return null; // void (cloud) — caller falls back to the dimension spawn
  }

  // Step through a portal block: overworld -> ember -> cloud -> overworld…
  async teleportThroughPortal() {
    if (this._portalCooldown > 0 || this._teleporting) return;
    this._teleporting = true;
    this._portalCooldown = 3; // set immediately — don't bounce straight back
    try {
      const order = [DIM.OVERWORLD, DIM.EMBER, DIM.CLOUD];
      const next = order[(order.indexOf(this.dimension) + 1) % order.length];
      const p = this.player.pos;
      const landing = this.findLanding(next, Math.floor(p.x), Math.floor(p.z));
      if (landing) await this.enterDimension(next, landing[0], landing[1], landing[2]);
      else {
        const s = getDimensionSpawn(this.world.seed, next);
        await this.enterDimension(next, s[0], s[1], s[2]);
      }
    } finally {
      this._teleporting = false;
    }
  }

  // Scan a 13^3 box around the clicked block for a 4x5 obsidian frame ring
  // (outer 4 wide x 5 tall, hollow 2x3 interior) in either the XY or ZY plane.
  // Returns the interior cell list or null.
  findPortalFrame(hx, hy, hz) {
    const w = this.world;
    const R = 6;
    for (const plane of ['xy', 'zy']) {
      // group obsidian cells by the fixed axis
      const groups = new Map();
      for (let x = hx - R; x <= hx + R; x++)
        for (let y = hy - R; y <= hy + R; y++)
          for (let z = hz - R; z <= hz + R; z++) {
            if (w.get(x, y, z) !== B.OBSIDIAN) continue;
            const fk = plane === 'xy' ? z : x;
            const k = fk + '';
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(plane === 'xy' ? [x, y] : [z, y]);
          }
      for (const [fk, cells] of groups) {
        let minA = 1e9, maxA = -1e9, minY = 1e9, maxY = -1e9;
        const set = new Set(cells.map(([a, y]) => a + ',' + y));
        for (const [a, y] of cells) {
          if (a < minA) minA = a; if (a > maxA) maxA = a;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
        const W = maxA - minA + 1, H = maxY - minY + 1;
        if (W !== 4 || H !== 5) continue;
        // border must be fully obsidian: 2*4 + 2*3 = 14 cells
        let border = 0;
        for (let a = minA; a <= maxA; a++)
          for (let y = minY; y <= maxY; y++) {
            const edge = a === minA || a === maxA || y === minY || y === maxY;
            if (edge && set.has(a + ',' + y)) border++;
            else if (!edge && set.has(a + ',' + y)) border = -1; // obsidian inside
          }
        if (border !== 14) continue;
        // interior must be clear of obsidian
        const interior = [];
        let ok = true;
        for (let a = minA + 1; a <= maxA - 1 && ok; a++)
          for (let y = minY + 1; y <= maxY - 1 && ok; y++) {
            const gx = plane === 'xy' ? a : +fk, gz = plane === 'xy' ? +fk : a;
            if (w.get(gx, y, gz) === B.OBSIDIAN) { ok = false; break; }
            interior.push([gx, y, gz]);
          }
        if (ok && interior.length === 6) return interior;
      }
    }
    return null;
  }

  // Flint & Steel on a valid obsidian frame -> fill the 2x3 interior with portal.
  tryLightPortal(hit) {
    const interior = this.findPortalFrame(hit.x, hit.y, hit.z);
    if (!interior) {
      this.ui.toast('🪔 No 4×5 obsidian frame here. Build one first!');
      return;
    }
    for (const [x, y, z] of interior) this.applyEdit(x, y, z, B.PORTAL);
    this.audio.quest();
    this.ui.toast('🌀 Portal ignited! Step through to the next realm…');
  }

  // Update the 3D item shown in the player's hand from the hotbar selection.
  updateHeldItem() {
    if (!this.player || !this.inv) return;
    const id = this.inv.hotbar[this.inv.sel];
    // Only show items (tools/weapons), not blocks
    if (id && isItem(id)) this.player.setHeldItem(id);
    else this.player.setHeldItem(null);
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
        dimension: this.dimension, // Phase 8
        edits: this.world ? this.world.editsList() : [],
        player: [this.player.pos.x, this.player.pos.y, this.player.pos.z],
        inv: this.inv.serialize(),
        quests: this.quests.serialize(),
        tutorialDone: this.tutorialDoneFlag,
        pet: this.pet ? { kind: this.pet.kind, name: this.pet.name } : null, // legacy (read path only)
        pets: this.critters ? this.critters.myPets().map(c => ({ kind: c.kind, name: c.name, collar: c.collarColor || null, baby: !!c.baby })) : [],
        villagers: this.villagers ? this.villagers.save() : null, // Phase 7
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
  // ---------- Phase 5: breeding / riding / collars ----------
  mountPet() {
    if (this.player.riding) return;
    const c = this.critters.nearestRideable(this.player.pos);
    if (!c) return;
    this.player.riding = c;
    c.ridden = true;
    c.mode = 'follow';
    this.ui.hideRide();
    this.audio.pop();
    this.ui.toast(`🐴 You're riding ${c.name || 'your ' + c.kind}! Jump to hop, tap ⬇️ Dismount to get off.`);
  }
  dismountPet() {
    const c = this.player.riding;
    if (!c) return;
    c.ridden = false;
    this.player.riding = null;
    this.ui.hideDismount();
    this.audio.click();
    this.ui.toast('⬇️ Dismounted.');
  }
  breedPet() {
    const c = this.critters.nearestPet(this.player.pos);
    if (!c || c.baby) return;
    const r = this.critters.feedTamed(c, this.inv);
    if (!r.ok) {
      if (r.reason === 'nofood' && r.food) this.ui.toast(`You need ${r.food.icon} ${r.food.name} to breed ${c.name || 'this pet'}!`);
      else if (r.reason === 'cooldown') this.ui.toast('💕 Give the new parents a little rest first!');
      return;
    }
    this.audio.pop();
    this.ui.hideBreed();
    if (r.bred && r.baby) {
      this.audio.quest();
      const label = ANIMAL_DEFS[r.baby.kind].label;
      this.ui.toast(`💕 A baby ${label} was born! Say hi to ${r.baby.name}!`);
      this.ui.chatAdd('', `💕 ${r.parents[0].name} and ${r.parents[1].name} had a baby ${label} (${r.baby.name})!`, false, true);
    } else {
      this.ui.toast(`💕 ${c.name || 'Your pet'} is in love! Feed another ${ANIMAL_DEFS[c.kind].label} nearby.`);
    }
  }
  collarPet() {
    const c = this.critters.nearestPet(this.player.pos);
    if (!c || c.collarColor) return;
    if (this.inv.count(140) < 1) { this.ui.toast('You need a 🎀 Pet Collar! Craft one from the Tools tab.'); return; }
    this.inv.remove(140, 1);
    const color = this.critters.setCollarOn(c);
    this.audio.pop();
    this.ui.hideCollar();
    this.ui.toast(`🎀 ${c.name || 'Your pet'} is wearing a fancy new collar!`);
  }
  restorePet(saved) {
    // accepts legacy {kind,name}, {pets:[...]}, or an array — restores via the manager
    const list = saved?.pets || (Array.isArray(saved) ? saved : (saved ? [saved] : []));
    let first = null;
    for (const s of list) {
      if (!s || !ANIMAL_DEFS[s.kind]) continue;
      const c = this.critters.tameByKind(s.kind, s.name);
      if (c && !first) first = c;
      if (c) { // Phase 5: restore collar + baby state
        if (s.collar) c.setCollar(s.collar);
        if (s.baby) c.setBaby();
      }
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
    // Phase 6: attack monsters first (if a weapon/tool is wielded and monster is in range)
    if (breaking && this.monsters && this.monsters.monsters.length) {
      const sel = this.inv.selectedItem();
      const idef = sel ? itemDef(sel) : null;
      if (idef && (idef.kind === 'weapon' || idef.kind === 'tool')) {
        // Find nearest monster within 3 blocks in front of player
        const px = this.player.pos.x, pz = this.player.pos.z;
        let best = null, bestD = 3.5;
        for (const m of this.monsters.monsters) {
          const d = Math.hypot(m.pos.x - px, m.pos.z - pz);
          if (d < bestD) { best = m; bestD = d; }
        }
        if (best) {
          this.player.swing();
          const dmg = idef.damage || 3;
          this.monsters.hitMonster(best, dmg);
          this.audio.breakB();
          return; // don't also break blocks
        }
      }
    }
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

    // placing (edge) — or lighting a portal with Flint & Steel
    if (this.input.consumePlaceEdge() && hit) {
      // Phase 7: right-click a villager to trade (takes priority over placing)
      if (this.villagers && this.villagers.tryInteract()) {
        // villager handled it — don't place a block too
      } else {
        const sel = this.inv.hotbar[this.inv.sel];
        if (sel === FLINT_ID) this.tryLightPortal(hit);
        else this.tryPlace(hit);
      }
    }
    // hotbar select
    const w = this.input.consumeWheel();
    if (w) { this.inv.sel = (this.inv.sel + w + 9) % 9; this.ui.renderHotbar(this.inv); }
    const d = this.input.consumeDigit();
    if (d >= 1 && d <= 9) { this.inv.sel = d - 1; this.ui.renderHotbar(this.inv); }
  }

  breakBlock(x, y, z, id) {
    const def = blockDef(id);
    this.applyEdit(x, y, z, B.AIR);
    // Phase 4 hooks: crop tracking + furnace contents.
    if (this.farming) this.farming.onBreak(x, y, z);
    if (id === B.FURNACE && this.furnace) this.furnace.onBreak(x, y, z);
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
    this.player.swing();
    this.quests.handle('break', id);
    this.tutEvent('break');
    if (Math.random() < 0.4) this.audio.pickup();
  }

  // Right-click with food: plant on tilled soil (seeds/carrot/potato) or eat it.
  tryEatOrPlant(sel, hit) {
    if (hit.id === B.TILLED_SOIL) {
      const crop = sel === 133 ? 'wheat' : sel === 131 ? 'carrot' : sel === 143 ? 'potato' : null;
      if (crop) {
        if (this.world.get(hit.x, hit.y + 1, hit.z) !== B.AIR) {
          this.ui.toast('🌱 Need empty space above the soil!'); return;
        }
        if (!this.inv.remove(sel, 1)) return;
        if (this.farming.plant(hit.x, hit.y + 1, hit.z, crop)) {
          this.ui.toast(`🌱 Planted ${crop}!`);
          this.audio.pop();
        }
        return;
      }
    }
    const val = FOOD_VALUES[sel] ?? 2;
    if (!this.inv.remove(sel, 1)) return;
    this.player.eat(val);
    const f = foodDef(sel);
    this.ui.toast(`${f ? f.icon : '🍽️'} Ate ${f ? f.name : 'food'} (+${val} hunger)`);
    this.audio.pickup();
  }

  tryPlace(hit) {
    const sel = this.inv.selectedBlock();
    const selItem = isItem(sel) ? itemDef(sel) : null;
    // Hoe: till dirt/grass into farmland.
    if (selItem && selItem.toolType === 'hoe' && (hit.id === B.DIRT || hit.id === B.GRASS)) {
      this.applyEdit(hit.x, hit.y, hit.z, B.TILLED_SOIL);
      this.audio.pop();
      this.player.swing();
      return;
    }
    // Fishing rod: cast near water.
    if (selItem && selItem.toolType === 'rod') {
      this.fishing.cast();
      this.player.swing();
      return;
    }
    // Craftable utilities (torch/workbench/furnace) are items that resolve to a real block.
    const placeId = selItem ? (selItem.placesBlock || null) : sel;
    // Right-click a furnace with a non-block selected -> open the furnace UI.
    if (hit.id === B.FURNACE && placeId == null) {
      this.furnace.open(hit.x, hit.y, hit.z);
      return;
    }
    // Food: plant seeds/carrot/potato on tilled soil, otherwise eat it.
    if (isFood(sel)) { this.tryEatOrPlant(sel, hit); return; }
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
      const inv = this.settings.invertLook ? -1 : 1;
      this.player.pitch -= dy * 0.0032 * (this.settings.sens || 1) * inv;
      this.player.pitch = Math.max(-1.25, Math.min(1.25, this.player.pitch));
    }
    const mv = this.input.moveVec();
    if (this.input.enabled) {
      this.player.update(dt, { f: mv.f, s: mv.s, jump: this.input.jumpHeld, sprint: this.input.sprintKey || (this.input.joy.active && Math.hypot(mv.f, mv.s) > 0.92) });
      // Safety net: falling through the world (or into the cloud void) respawns
      // in the current dimension.
      if (this.player.pos.y < 10) {
        const s = getDimensionSpawn(this.world.seed, this.dimension);
        this.player.pos.set(s[0], s[1], s[2]);
        this.player.vel.set(0, 0, 0);
        if (this.dimension === DIM.CLOUD) this.ui.toast('☁️ The void caught you! Back to the islands…');
      }
      // Phase 8: stepping into a lit portal hops dimensions (with cooldown).
      if (this._portalCooldown > 0) this._portalCooldown -= dt;
      else {
        const px = Math.floor(this.player.pos.x), pz = Math.floor(this.player.pos.z);
        const feetB = this.world.get(px, Math.floor(this.player.pos.y) + 0, pz);
        const waistB = this.world.get(px, Math.floor(this.player.pos.y) + 1, pz);
        if (feetB === B.PORTAL || waistB === B.PORTAL) this.teleportThroughPortal();
      }
      if (Math.hypot(mv.f, mv.s) > 0.3 && this.player.speed2d > 1) this.tutEvent('move');
      if (this.input.jumpHeld && this.player.vel.y > 3) this.tutEvent('jump');
    }
    // Phase 5: riding — the mount is glued under the rider; the rider sits on top.
    // Player physics still drive (faster + higher jump while riding); the horse
    // mesh just follows visually so collisions/terrain never break.
    const mount = this.player.riding;
    if (mount) {
      mount.g.position.set(this.player.pos.x, this.player.pos.y, this.player.pos.z);
      mount.g.rotation.y = this.player.mesh.rotation.y;
      this.player.mesh.position.y = this.player.pos.y + (mount.kind === 'horse' ? 1.45 : 0.95);
    }
    this.player.updateCamera(this.camera);
    if (this.started) this.updateTargeting(dt);
    this.world.setTime(now / 1000); // water animation clock (uTime + texture frames)
    this.world.update(this.player.pos.x, this.player.pos.z);
    this.world.playerY = this.player.pos.y; // for minimap height sampling
    this.critters.update(dt, this.player.pos);
    if (this.farming) this.farming.update(dt);
    if (this.fishing) this.fishing.update(dt);
    if (this.furnace) this.furnace.update(dt);
    if (this.monsters) {
      const isNight = this.world.isNight ? this.world.isNight() : false;
      this.monsters.update(dt, isNight, (x, z) => this.world.biomeAt ? this.world.biomeAt(x, z) : 'forest');
    }
    // Phase 7: villagers (day wander, night indoors)
    if (this.villagers) {
      const isNight = this.world.isNight ? this.world.isNight() : false;
      this.villagers.update(dt, isNight);
    }
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

    // Phase 5: ride / breed / collar prompts (animals subsystem)
    if (this.player.riding) {
      this.ui.showDismount();
      this.ui.hideRide(); this.ui.hideBreed(); this.ui.hideCollar();
      this.ui.hideFeed(); this.ui.hideAdopt();
    } else {
      this.ui.hideDismount();
      const rideable = this.critters.nearestRideable(this.player.pos);
      if (rideable) this.ui.showRide(`🐴 Ride ${rideable.name || ANIMAL_DEFS[rideable.kind].label}`);
      else this.ui.hideRide();
      const pet = this.critters.nearestPet(this.player.pos);
      if (pet && !pet.baby) {
        const fav = ANIMAL_DEFS[pet.kind].favoriteFood;
        if (this.inv.count(fav) > 0) this.ui.showBreed(`💕 Breed ${pet.name || ANIMAL_DEFS[pet.kind].label}`);
        else this.ui.hideBreed();
      } else this.ui.hideBreed();
      if (pet && !pet.collarColor && this.inv.count(140) > 0)
        this.ui.showCollar(`🎀 Collar ${pet.name || ANIMAL_DEFS[pet.kind].label}`);
      else this.ui.hideCollar();
    }

    // multiplayer pos sync 10Hz
    if (this.isMulti && now - this.lastPosSend > 100) {
      this.lastPosSend = now;
      const p = this.player.pos;
      this.net.send({ t: MSG.POS, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), ry: +this.player.mesh.rotation.y.toFixed(2), anim: this.player.anim });
    }

    // HUD
    this.ui.drawCompass(this.player.yaw);
    // Minimap throttled to 2x/sec — full rescan every frame was a perf killer
    this._mmTick = (this._mmTick || 0) + dt;
    if (this._mmTick > 0.5) {
      this._mmTick = 0;
      this.ui.drawMinimap(this.world, this.player.pos.x, this.player.pos.z, this.player.yaw);
    }
    // Phase 8: in other dimensions the location label shows the realm name.
    const dimLabel = this.dimension === DIM.OVERWORLD
      ? biomeNameAt(Math.floor(this.player.pos.x), Math.floor(this.player.pos.z))
      : DIM_NAMES[this.dimension];
    if (dimLabel !== this._biome) { this._biome = dimLabel; this.ui.setBiome(dimLabel); if (this.started && this._biomeInit) this.ui.toast('📍 ' + dimLabel); this._biomeInit = true; }

    // autosave demo
    if (!this.isMulti && now - this.lastSave > 20000) { this.lastSave = now; this.saveDemo(); }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => { window._game = new Game(); });
