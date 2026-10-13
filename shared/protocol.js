// WonderBlocks multiplayer protocol (JSON messages over WebSocket).
// Client and server MUST follow this file. Room codes: 6 chars A-Z0-9.

export const MSG = {
  JOIN: 'join',           // C->S {room, name, char, clientId}
  WELCOME: 'welcome',     // S->C {id, seed, edits:[[x,y,z,b]...], players:[{id,name,char,x,y,z,ry}], roles:{id:role}, claims:[{x,z,r,ownerId,ownerName}], settings}
  PLAYER_JOIN: 'pjoin',   // S->C {id, name, char, x,y,z, ry}
  PLAYER_LEAVE: 'pleave', // S->C {id}
  POS: 'pos',             // C->S {x,y,z, ry, anim}   (10 Hz)  |  S->C {id,x,y,z, ry, anim}
  EDIT: 'edit',           // C->S {x,y,z, b}          |  S->C {x,y,z, b, by}
  CHAT: 'chat',           // both {from, name, text, ts}
  EMOTE: 'emote',         // both {id, e}  e in: wave,happy,dance,love
  ROLE: 'role',           // C->S {target, role} (owner only)  |  S->C {roles:{id:role}}
  CLAIM: 'claim',          // C->S {x,z} place claim at feet (uses 1 CLAIM_FLAG) | S->C {claims:[...]}
  UNCLAIM: 'unclaim',     // C->S {} remove own claim
  KICK: 'kick',           // C->S {target} (owner only)
  SETTINGS: 'settings',   // C->S {pvp?...} (owner only) | S->C {settings}
  ERROR: 'error',          // S->C {msg}
  PING: 'ping',           // both (keepalive)
};

export const ROLES = { OWNER: 'owner', BUILDER: 'builder', VISITOR: 'visitor' };
export const CLAIM_RADIUS = 10;

export function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[(Math.random() * chars.length) | 0];
  return s;
}

// Server-side edit validation shared helper (pure).
// claims: [{x,z,r,ownerId}], roles: {playerId: role}
export function validateEdit({ x, y, z, b }, playerId, roles, claims, getBlock) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) return 'Bad coordinates.';
  if (x < 0 || x >= 128 || y < 0 || y >= 64 || z < 0 || z >= 128) return 'Outside the world.';
  if (!Number.isInteger(b) || b < 0 || b > 38) return 'Unknown block.';
  const role = roles[playerId] || ROLES.BUILDER;
  if (role === ROLES.VISITOR) return 'Visitors cannot build. Ask the owner to promote you.';
  const cur = getBlock(x, y, z);
  if (cur === 35) return 'Bedrock cannot be broken.';
  for (const c of claims) {
    if (c.ownerId !== playerId && Math.hypot(x - c.x, z - c.z) <= c.r) {
      const ownerRole = roles[c.ownerId];
      if (roles[playerId] !== ROLES.OWNER)
        return `This spot is claimed by ${c.ownerName || 'another player'}.`;
    }
  }
  return null;
}
