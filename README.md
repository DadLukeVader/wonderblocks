# 🧱 WonderBlocks: Build Together

A cute, colorful multiplayer voxel sandbox for browsers — computers, tablets, and phones.
Explore, gather, build houses and villages together, adopt pets, and complete quests.

## Play it

### Option A — Offline demo (single player, no setup)
Just open the game in a browser:
- If you're running the server (Option B): `http://<your-ip>:8080/client/` → **🌱 Play Demo**
- The demo saves to your browser automatically.

### Option B — Real multiplayer (recommended)
On your computer (or any always-on machine / VPS):
```bash
cd wonderblocks
node wonderblocks-host.js
```
It prints addresses like `http://192.168.1.5:8080`. Open that on any device on the
same Wi-Fi → **🌍 Create World** → share the 6-letter room code or the
`?room=CODE` link with friends. They open the link and hit **🔗 Join World**.

> Playing over the internet (not just Wi-Fi) needs port forwarding or a VPS —
> the server is a plain Node.js app, so it runs fine on any $5 VPS with
> `node wonderblocks-host.js` (set `PORT` env if needed).

## Controls

**Computer:** WASD/arrows move · Space jump · Shift sprint · click the game for mouse look ·
hold **Left-click** break · **Right-click** place · wheel / 1–9 hotbar · E inventory ·
Enter chat · V first-person · M mute · Esc menu.

**Phone/tablet:** left joystick moves · drag to look · tap a block to target it,
then ⛏️ break / 🧱 place / ⬆️ jump buttons.

## What's in the world

- **Wonder Village** — safe spawn with houses, a well, gardens, and a building tutorial
- **Blossom Forest** — pink berry-leaf trees, rabbits, butterflies
- **Sunbeam Beach** — ocean, sand, palm trees, fish
- **Frosty Peaks** — snowy mountain with a glowing **ice cave** (treasure inside!)
- **Rainbow Sky Island** — floating island with a rainbow bridge and waterfall
- **Crystal caves** — glowing crystals underground
- Pets (adopt rabbits & chickens 🐾), quests with coin rewards, land claims 🚩
  to protect your builds, emotes, text chat, character customizer

## Project layout

```
wonderblocks/
  client/            game client (Three.js, ES modules)
    index.html       entry page
    css/style.css    pastel UI theme
    js/              main.js, world.js, player.js, character.js, input.js,
                     inventory.js, ui.js, animals.js, quests.js, audio.js, net.js, textures.js
  shared/            blocks.js, worldgen.js, protocol.js (client + server)
  server/            server.js (static host + WebSocket rooms), package.json
  vendor/            three.module.js (r160, served locally — works offline)
  tests/             worldgen + server protocol tests
  wonderblocks-host.js   one-command LAN host
  wonderblocks-data/     room saves (created at runtime)
```

## Tech notes

- Chunked voxel meshing (16×16 columns, face culling, 3 draw layers:
  opaque / alpha-cutout / water), baked face shading, fog — no per-block meshes.
- Deterministic procedural generation: client and server build the identical base
  world from the room seed; only block *edits* travel over the network.
- Server is authoritative for edits (validates bounds, roles, land claims),
  persists rooms to JSON, and relays 10 Hz player movement.
- Music/SFX are 100% procedural WebAudio — zero asset downloads.

See `PHASES.md` for the honest per-phase feature report.
