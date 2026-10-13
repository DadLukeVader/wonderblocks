// WonderBlocks: Build Together — multiplayer server.
//
// - Serves static files from the project root (client/, shared/, vendor/).
// - Hosts WebSocket rooms with server-authoritative world state.
// - Persists rooms to <dataDir>/wonderblocks-data/<CODE>.json.
//
// Message contract: see shared/protocol.js. Every message carries a `t` field
// with the message type (MSG.*).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { buildWorld, idx, inBounds, getSpawn } from '../shared/worldgen.js';
import { MSG, ROLES, CLAIM_RADIUS, validateEdit } from '../shared/protocol.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const log = (...a) => console.log('[WonderBlocks]', ...a);
const errLog = (...a) => console.error('[WonderBlocks]', ...a);

const send = (ws, obj) => {
  if (ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify(obj)); } catch { /* ignore */ }
  }
};
const sendError = (ws, msg) => send(ws, { t: MSG.ERROR, msg });

// ---- static file serving -------------------------------------------------

function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('method not allowed');
    return;
  }
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('bad request');
    return;
  }
  // Redirect bare "/" to /client/ so the page's relative asset URLs resolve.
  if (urlPath === '/') {
    const q = new URL(req.url, 'http://localhost').search;
    res.writeHead(302, { Location: '/client/' + q });
    res.end();
    return;
  }

  // Block path traversal: resolve inside PROJECT_ROOT only.
  let filePath = path.normalize(path.join(PROJECT_ROOT, urlPath));
  if (filePath !== PROJECT_ROOT && !filePath.startsWith(PROJECT_ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('forbidden');
    return;
  }
  fs.stat(filePath, (statErr, st) => {
    if (!statErr && st.isDirectory()) filePath = path.join(filePath, 'index.html');
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Content-Length': data.length,
        'Cache-Control': 'no-store',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
}

// ---- server entry point --------------------------------------------------

export function startServer({ port = 8080, dataDir = './wonderblocks-data' } = {}) {
  const DATA_DIR = path.resolve(dataDir);

  // Rooms live only in memory while the server runs; saves live on disk.
  // room = { code, seed, world:Uint8Array, players:Map, roles:{}, clientIds:{},
  //          claims:[], settings:{}, edits:Map, dirty, emptyTimer }
  const rooms = new Map();

  const savePath = code => path.join(DATA_DIR, 'wonderblocks-data', `${code}.json`);

  function saveRoom(room) {
    try {
      fs.mkdirSync(path.dirname(savePath(room.code)), { recursive: true });
      const data = {
        seed: room.seed,
        edits: [...room.edits.values()],
        roles: room.roles,
        clientIds: room.clientIds,
        claims: room.claims,
        settings: room.settings,
        savedAt: Date.now(),
      };
      fs.writeFileSync(savePath(room.code), JSON.stringify(data));
      room.dirty = false;
    } catch (e) {
      errLog('save failed for room', room.code, e.message);
    }
  }

  function loadRoom(code) {
    try {
      const f = savePath(code);
      if (!fs.existsSync(f)) return null;
      const data = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (!data || typeof data !== 'object') return null;
      return data;
    } catch (e) {
      errLog('load failed for room', code, e.message);
      return null;
    }
  }

  function createRoom(code) {
    const saved = loadRoom(code);
    let seed = (Math.random() * 2 ** 32) >>> 0; // unsigned, so it round-trips through JSON saves identically
    if (saved && Number.isInteger(saved.seed)) seed = saved.seed >>> 0;
    const world = buildWorld(seed);
    const room = {
      code, seed, world,
      players: new Map(),
      roles: {}, clientIds: {}, claims: [], settings: {},
      edits: new Map(),
      dirty: false,
      emptyTimer: null,
    };
    if (saved) {
      room.roles = saved.roles && typeof saved.roles === 'object' ? saved.roles : {};
      room.clientIds = saved.clientIds && typeof saved.clientIds === 'object' ? saved.clientIds : {};
      room.claims = Array.isArray(saved.claims) ? saved.claims : [];
      room.settings = saved.settings && typeof saved.settings === 'object' ? saved.settings : {};
      if (Array.isArray(saved.edits)) {
        for (const e of saved.edits) {
          if (Array.isArray(e) && e.length === 4) {
            const [x, y, z, b] = e;
            if (Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) &&
                Number.isInteger(b) && inBounds(x, y, z)) {
              world[idx(x, y, z)] = b;
              room.edits.set(`${x},${y},${z}`, [x, y, z, b]);
            }
          }
        }
      }
      log(`room ${code} restored from save (${room.edits.size} edits)`);
    } else {
      log(`room ${code} created (seed ${seed})`);
    }
    rooms.set(code, room);
    return room;
  }

  function broadcast(room, obj, exceptId) {
    let s;
    try { s = JSON.stringify(obj); } catch { return; }
    for (const p of room.players.values()) {
      if (p.id === exceptId) continue;
      if (p.ws.readyState === WebSocket.OPEN) {
        try { p.ws.send(s); } catch { /* ignore */ }
      }
    }
  }

  const playerOf = ws => (ws.room && ws.playerId ? ws.room.players.get(ws.playerId) : undefined);

  // ---- message handlers --------------------------------------------------

  function doJoin(ws, msg) {
    const code = String(msg.room || '').toUpperCase().trim();
    if (!/^[A-Z0-9]{6}$/.test(code)) return sendError(ws, 'Invalid room code.');
    const name = String(msg.name || 'Builder').slice(0, 24) || 'Builder';
    const char = msg.char && typeof msg.char === 'object' && !Array.isArray(msg.char) ? msg.char : {};
    const clientId = String(msg.clientId || '').slice(0, 64);

    let room = rooms.get(code);
    if (!room) room = createRoom(code);
    if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; }

    // Reconnect: a stable clientId keeps the same player id (and role).
    let playerId = clientId ? room.clientIds[clientId] : undefined;
    const stale = playerId ? room.players.get(playerId) : undefined;
    if (stale) {
      try { stale.ws.close(4001, 'replaced by new connection'); } catch { /* ignore */ }
      room.players.delete(playerId);
    }
    if (!playerId) {
      playerId = 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    }
    if (clientId) {
      room.clientIds[clientId] = playerId;
      room.dirty = true;
    }

    let role = room.roles[playerId];
    if (!role) {
      // First player ever in this room becomes owner; everyone after is builder.
      role = Object.values(room.roles).includes(ROLES.OWNER) ? ROLES.BUILDER : ROLES.OWNER;
      room.roles[playerId] = role;
      room.dirty = true;
    }

    const [sx, sy, sz] = getSpawn();
    const player = { ws, id: playerId, name, char, x: sx, y: sy, z: sz, ry: 0, clientId, lastPos: 0 };
    room.players.set(playerId, player);
    ws.room = room;
    ws.playerId = playerId;
    ws.roomCode = code;

    send(ws, {
      t: MSG.WELCOME,
      id: playerId,
      seed: room.seed,
      edits: [...room.edits.values()],
      players: [...room.players.values()]
        .filter(p => p.id !== playerId)
        .map(p => ({ id: p.id, name: p.name, char: p.char, x: p.x, y: p.y, z: p.z, ry: p.ry })),
      roles: { ...room.roles },
      claims: room.claims,
      settings: room.settings,
    });
    broadcast(room, {
      t: MSG.PLAYER_JOIN, id: playerId, name, char, x: sx, y: sy, z: sz, ry: 0,
    }, playerId);
    log(`join ${name} (${playerId}) -> room ${code} as ${role} (${room.players.size} online)`);
  }

  function doPos(ws, msg) {
    const room = ws.room, p = playerOf(ws);
    if (!p) return;
    const now = Date.now();
    if (now - p.lastPos < 80) return; // throttle: 80ms per player
    const { x, y, z, ry, anim } = msg;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
    if (ry !== undefined && !Number.isFinite(ry)) return;
    p.lastPos = now;
    p.x = x; p.y = y; p.z = z;
    p.ry = Number.isFinite(ry) ? ry : 0;
    broadcast(room, {
      t: MSG.POS, id: p.id, x, y, z, ry: p.ry,
      anim: typeof anim === 'string' ? anim.slice(0, 16) : undefined,
    }, p.id);
  }

  function doEdit(ws, msg) {
    const room = ws.room, p = playerOf(ws);
    if (!p) return;
    const { x, y, z, b } = msg;
    const problem = validateEdit({ x, y, z, b }, p.id, room.roles, room.claims,
      (gx, gy, gz) => room.world[idx(gx, gy, gz)]);
    if (problem) return sendError(ws, problem);
    room.world[idx(x, y, z)] = b;
    room.edits.set(`${x},${y},${z}`, [x, y, z, b]);
    room.dirty = true;
    broadcast(room, { t: MSG.EDIT, x, y, z, b, by: p.id });
    log(`edit ${p.name} @${x},${y},${z}=${b} room ${room.code}`);
  }

  function doChat(ws, msg) {
    const room = ws.room, p = playerOf(ws);
    if (!p) return;
    const text = String(msg.text ?? '').slice(0, 200);
    if (!text.trim()) return;
    broadcast(room, { t: MSG.CHAT, from: p.id, name: p.name, text, ts: Date.now() });
  }

  function doEmote(ws, msg) {
    const room = ws.room, p = playerOf(ws);
    if (!p) return;
    const e = String(msg.e || '');
    if (!['wave', 'happy', 'dance', 'love'].includes(e)) return sendError(ws, 'Unknown emote.');
    broadcast(room, { t: MSG.EMOTE, id: p.id, e });
  }

  function doClaim(ws, msg) {
    const room = ws.room, p = playerOf(ws);
    if (!p) return;
    const x = Math.round(Number(msg.x));
    const z = Math.round(Number(msg.z));
    if (!Number.isFinite(x) || !Number.isFinite(z) || x < 0 || x >= 128 || z < 0 || z >= 128) {
      return sendError(ws, 'Bad claim location.');
    }
    if (room.claims.some(c => c.ownerId === p.id)) {
      return sendError(ws, 'You already have a claim. Unclaim it first.');
    }
    if (Math.hypot(x - p.x, z - p.z) > 20) {
      return sendError(ws, 'You must stand within 20 blocks of where you place your claim.');
    }
    room.claims.push({ x, z, r: CLAIM_RADIUS, ownerId: p.id, ownerName: p.name });
    room.dirty = true;
    broadcast(room, { t: 'claims', claims: room.claims });
    log(`claim ${p.name} @${x},${z} room ${room.code}`);
  }

  function doUnclaim(ws) {
    const room = ws.room, p = playerOf(ws);
    if (!p) return;
    const before = room.claims.length;
    room.claims = room.claims.filter(c => c.ownerId !== p.id);
    if (room.claims.length === before) return sendError(ws, 'You have no claim.');
    room.dirty = true;
    broadcast(room, { t: 'claims', claims: room.claims });
    log(`unclaim ${p.name} room ${room.code}`);
  }

  function doRole(ws, msg) {
    const room = ws.room, p = playerOf(ws);
    if (!p) return;
    if (room.roles[p.id] !== ROLES.OWNER) return sendError(ws, 'Only the owner can change roles.');
    const target = String(msg.target || '');
    const role = String(msg.role || '');
    if (!Object.values(ROLES).includes(role)) return sendError(ws, 'Unknown role.');
    if (!room.roles[target]) return sendError(ws, 'Unknown player.');
    room.roles[target] = role;
    room.dirty = true;
    broadcast(room, { t: MSG.ROLE, roles: { ...room.roles } });
    log(`role ${target} -> ${role} by ${p.name} room ${room.code}`);
  }

  function doKick(ws, msg) {
    const room = ws.room, p = playerOf(ws);
    if (!p) return;
    if (room.roles[p.id] !== ROLES.OWNER) return sendError(ws, 'Only the owner can kick players.');
    const target = room.players.get(String(msg.target || ''));
    if (!target) return sendError(ws, 'Player is not online.');
    if (target.id === p.id) return sendError(ws, 'You cannot kick yourself.');
    sendError(target.ws, 'You were kicked by the room owner.');
    try { target.ws.close(4000, 'kicked'); } catch { /* ignore */ }
    log(`kick ${target.name} by ${p.name} room ${room.code}`);
  }

  function doSettings(ws, msg) {
    const room = ws.room, p = playerOf(ws);
    if (!p) return;
    if (room.roles[p.id] !== ROLES.OWNER) return sendError(ws, 'Only the owner can change settings.');
    if (msg.settings && typeof msg.settings === 'object' && !Array.isArray(msg.settings)) {
      room.settings = { ...room.settings, ...msg.settings };
      room.dirty = true;
      broadcast(room, { t: MSG.SETTINGS, settings: room.settings });
    }
  }

  function handleMessage(ws, msg) {
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
      return sendError(ws, 'Malformed message.');
    }
    if (msg.t === MSG.JOIN) return doJoin(ws, msg);
    if (msg.t === MSG.PING) return send(ws, { t: MSG.PING });
    if (!ws.room || !ws.playerId || !ws.room.players.has(ws.playerId)) {
      return sendError(ws, 'Join a room first.');
    }
    switch (msg.t) {
      case MSG.POS: return doPos(ws, msg);
      case MSG.EDIT: return doEdit(ws, msg);
      case MSG.CHAT: return doChat(ws, msg);
      case MSG.EMOTE: return doEmote(ws, msg);
      case MSG.CLAIM: return doClaim(ws, msg);
      case MSG.UNCLAIM: return doUnclaim(ws, msg);
      case MSG.ROLE: return doRole(ws, msg);
      case MSG.KICK: return doKick(ws, msg);
      case MSG.SETTINGS: return doSettings(ws, msg);
      default: return sendError(ws, 'Unknown message.');
    }
  }

  function onDisconnect(ws) {
    const room = ws.room, pid = ws.playerId;
    ws.room = null; ws.playerId = null; ws.roomCode = null;
    if (!room || !pid) return;
    const cur = room.players.get(pid);
    if (cur && cur.ws === ws) {
      room.players.delete(pid);
      broadcast(room, { t: MSG.PLAYER_LEAVE, id: pid });
      log(`leave ${cur.name} (${pid}) room ${room.code} (${room.players.size} online)`);
      if (room.players.size === 0) {
        saveRoom(room); // flush immediately on empty
        room.emptyTimer = setTimeout(() => {
          rooms.delete(room.code);
          log(`room ${room.code} unloaded (empty 5 min)`);
        }, 5 * 60 * 1000);
      }
    }
  }

  // ---- wire up http + ws -----------------------------------------------

  const server = http.createServer(serveStatic);
  const wss = new WebSocketServer({ server });

  wss.on('connection', ws => {
    ws.lastMsg = Date.now();
    ws.room = null; ws.playerId = null; ws.roomCode = null;
    ws.on('message', raw => {
      ws.lastMsg = Date.now();
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return sendError(ws, 'Malformed message.');
      }
      try {
        handleMessage(ws, msg);
      } catch (e) {
        errLog('handler error:', e && e.message);
        sendError(ws, 'Server error.');
      }
    });
    ws.on('close', () => onDisconnect(ws));
    ws.on('error', () => { /* handled via close */ });
  });

  // Autosave dirty rooms every 20s.
  const saveTimer = setInterval(() => {
    for (const room of rooms.values()) {
      if (room.dirty) saveRoom(room);
    }
  }, 20_000);
  saveTimer.unref?.();

  // Keepalive: drop connections silent for 75s.
  const sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const ws of wss.clients) {
      if (now - (ws.lastMsg || 0) > 75_000) {
        try { ws.terminate(); } catch { /* ignore */ }
      }
    }
  }, 30_000);
  sweepTimer.unref?.();

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, () => {
      const actual = server.address().port;
      log(`listening on :${actual}`);
      resolve({
        port: actual,
        close: async () => {
          clearInterval(saveTimer);
          clearInterval(sweepTimer);
          for (const room of rooms.values()) {
            if (room.emptyTimer) clearTimeout(room.emptyTimer);
            if (room.dirty) saveRoom(room);
          }
          rooms.clear();
          for (const ws of wss.clients) {
            try { ws.terminate(); } catch { /* ignore */ }
          }
          wss.close();
          await new Promise(r => server.close(r));
          log('shut down');
        },
      });
    });
  });
}
