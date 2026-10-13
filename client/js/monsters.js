// WonderBlocks hostile monsters: night spawns, simple chase AI, melee combat.
import { MONSTER_DEFS } from 'wb-shared/monsterDefs.js';

export class MonsterManager {
  constructor(scene, world, player) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.monsters = [];
    this._spawnTick = 0;
  }

  // Spawn monsters at night near the player
  update(dt, isNight, biomeAt) {
    if (this.player.dead) return;
    this._spawnTick += dt;

    // Spawn every 10s at night, max 5 monsters
    if (isNight && this._spawnTick > 10 && this.monsters.length < 5) {
      this._spawnTick = 0;
      this.trySpawn(biomeAt);
    }

    // Update each monster: chase player, attack when close
    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      if (m.health <= 0) { this.kill(m, i); continue; }
      // Despawn at day (except cave monsters)
      if (!isNight && m.def.nightOnly) { this.despawn(m, i); continue; }

      const dx = this.player.pos.x - m.pos.x;
      const dz = this.player.pos.z - m.pos.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 16) {
        // Chase
        const nx = dx / (dist || 1), nz = dz / (dist || 1);
        m.pos.x += nx * m.def.speed * dt;
        m.pos.z += nz * m.def.speed * dt;
        m.mesh.position.copy(m.pos);
        m.mesh.lookAt(this.player.pos.x, m.pos.y, this.player.pos.z);
        // Attack when close
        if (dist < 1.5) {
          m._atkTick = (m._atkTick || 0) + dt;
          if (m._atkTick > 1.0) {
            m._atkTick = 0;
            this.player.damage(m.def.damage, 'mob');
          }
        }
      } else {
        // Wander
        m._wanderT = (m._wanderT || 0) - dt;
        if (m._wanderT <= 0) {
          m._wanderT = 2 + Math.random() * 3;
          m._wx = (Math.random() - 0.5) * 4;
          m._wz = (Math.random() - 0.5) * 4;
        }
        m.pos.x += (m._wx || 0) * dt;
        m.pos.z += (m._wz || 0) * dt;
        m.mesh.position.copy(m.pos);
      }
    }
  }

  trySpawn(biomeAt) {
    const biome = biomeAt(this.player.pos.x, this.player.pos.z);
    const candidates = Object.entries(MONSTER_DEFS).filter(([k, d]) =>
      d.spawnBiomes.includes(biome) && (!d.rare || Math.random() < 0.1));
    if (!candidates.length) return;
    const [key, def] = candidates[(Math.random() * candidates.length) | 0];
    // Spawn 8-12 blocks away from player
    const ang = Math.random() * Math.PI * 2;
    const dist = 8 + Math.random() * 4;
    const x = this.player.pos.x + Math.cos(ang) * dist;
    const z = this.player.pos.z + Math.sin(ang) * dist;
    const y = this.world.groundY ? this.world.groundY(x, z) + 1 : 35;
    this.spawn(key, def, x, y, z);
  }

  spawn(key, def, x, y, z) {
    const s = def.scale || 1;
    // Gemini sprite billboard (falls back to colored box if art missing)
    let mesh;
    const spritePath = `art/sprites/${key}.png`;
    try {
      const tex = new THREE.TextureLoader().load(spritePath);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      mesh = new THREE.Sprite(mat);
      mesh.scale.set(1.0 * s, 1.2 * s, 1);
    } catch {
      const geo = new THREE.BoxGeometry(0.6 * s, 0.8 * s, 0.6 * s);
      const mat = new THREE.MeshLambertMaterial({ color: def.color });
      mesh = new THREE.Mesh(geo, mat);
    }
    const pos = new THREE.Vector3(x, y + 0.6 * s, z);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.monsters.push({ key, def, mesh, pos, health: def.health });
  }

  // Player attacks a monster (called from main.js on hit)
  hitMonster(monster, damage) {
    monster.health -= damage;
    // Knockback
    const dx = monster.pos.x - this.player.pos.x;
    const dz = monster.pos.z - this.player.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    monster.pos.x += (dx / d) * 0.5;
    monster.pos.z += (dz / d) * 0.5;
  }

  kill(m, i) {
    this.scene.remove(m.mesh);
    this.monsters.splice(i, 1);
    // Drops (simplified — just toast for now)
    if (this.onKill) this.onKill(m.def);
  }

  despawn(m, i) {
    this.scene.remove(m.mesh);
    this.monsters.splice(i, 1);
  }
}
