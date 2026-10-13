# WonderBlocks — Phase Report (2026-10-12)

Honest status of what genuinely works, verified by automated tests where noted.

## Phase 1 — 3D world, movement, camera, jumping, collision ✅
- Chunked voxel world (128×128×64, 16×16-column chunks), face-culled meshing,
  3 draw layers (opaque / alpha-cutout / water), baked face shading + fog.
- AABB player physics: walk, sprint, jump, gravity, swimming (buoyancy + swim-up),
  minimal-penetration collision resolution. Verified by deterministic headless
  tests: 12.8 blocks / 3 s walk, exact wall stop at 75.30, jump apex 1.57,
  embedded-player recovery pops up correctly.
- Third-person orbit camera with terrain pull-in; first-person toggle (V).
- BUG FOUND & FIXED during testing: position integration was missing
  (velocity never applied); collision used velocity-sign instead of
  minimal-penetration (could shove an embedded player sideways).

## Phase 2 — Targeting, breaking, placing, inventory, hotbar ✅
- DDA voxel raycast targeting (6-block reach), highlight wireframe, ghost preview.
- Hold-to-break with per-block hardness; drops go to inventory.
- Right-click / 🧱 place with player-overlap guard; 9-slot hotbar (wheel, 1–9, click);
  full inventory panel with 4 categories; starter kit builds a small house.
- Creative "unlimited blocks" toggle in pause menu.

## Phase 3 — Starter biome, character, tutorial ✅
- Wonder Village + 5 more biomes generated (Blossom Forest, Sunbeam Beach,
  Frosty Peaks + ice cave, Rainbow Sky Island + bridge, crystal caves).
- Worldgen verified: deterministic, 75 ms build, village houses/doors/well,
  ocean, sky island, ice cave, crystals, treasure all asserted in tests.
- Chibi character customizer (skin, hair style/color, shirt, pants, accessories);
  5-step interactive tutorial; cheerful procedural WebAudio music + SFX.
- Gemini art direction (user request): all 8 texture sheets generated via the user's
  own Gemini session on 2026-10-12 (5 block sheets 2×4, 1 anim strip 1×4, 2×2 faces,
  logo) and sliced into client/art/ by tools/slice_atlas.py. Verified live in
  headless Chromium: zero 404s, zero console errors, kawaii face decals on the
  character, new terrain/flora/palm textures, logo on the menu. Fixes applied
  during wiring: sheet_c's extra empty rows auto-cropped; lantern/crystal tiles
  had dark vignette backgrounds — converted both blocks to cross-sprites with a
  two-pass background removal (verified the objects survived intact);
  crystal anim frame B re-keyed to transparent.
- Procedural textures remain as automatic fallback if art files are absent.

## Phase 4 — Save / reload ✅ (demo) / ✅ (multiplayer)
- Demo: localStorage (seed, edits, player, inventory, quests, pet, tutorial state),
  autosave every 20 s.
- Multiplayer: server persists rooms to JSON (seed, edits, roles, claims),
  autosave 20 s + on empty; reconnect keeps identity via clientId.

## Phase 5 — Real multiplayer ✅ (LAN)
- Node.js WebSocket server, authoritative edits (server validates bounds, roles,
  land claims via shared validateEdit), 10 Hz movement relay, chat, emotes,
  player list, owner/builder/visitor roles, kick, one land claim per player.
- Protocol test suite passes (join/welcome, edit broadcast, chat relay,
  visitor rejection, claim enforcement, malformed-JSON survival).
- `node wonderblocks-host.js` prints LAN URLs + room-code invite links.
- LIMIT: internet play needs port forwarding/VPS (documented in README).
  No simulated/fake players anywhere.

## Phase 6 — Biomes, quests, pets, decor, rewards ⚠️ partial
- DONE: 6 biomes, 8 quests with coin/XP rewards + tracker, adoptable pets
  (rabbits/chickens follow you), 40 block types, land-claim flags, emotes, chat.
- NOT DONE: quest-gated biome unlocking (all biomes open from the start),
  pet accessories/renaming, unlockable costumes, daily quest rotation,
  treasure-chest loot UI (gold blocks mark treasure spots).

## Phase 7 — Mobile, responsive, optimization, testing ⚠️ partial
- DONE: touch joystick, Jump/Break/Place buttons, tap-to-target, drag look,
  responsive HUD/CSS; headless-Chromium gameplay tests (boot, HUD, inventory,
  physics) with zero console errors.
- NOT DONE: on-device testing with real phones/tablets; performance profiling
  on low-end mobile GPUs; minimap (compass only).

## Known issues / notes
- Fixed: `../shared/` imports broke when served (now via `wb-shared/` import map).
- Art 404s in console until Gemini sheets land (fallback is intentional).
- AudioContext needs a user gesture (browser policy); starts on first click.
