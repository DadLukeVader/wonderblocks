// WonderBlocks: Build Together — LAN host launcher.
//
// Run:  node wonderblocks-host.js        (or: npm start --prefix server)
// Env:  PORT=8080  (default 8080)
//
// Starts the multiplayer server and prints the LAN addresses friends can use
// to join. World saves go to ./wonderblocks-data/wonderblocks-data/<CODE>.json.

import { networkInterfaces } from 'node:os';
import { startServer } from './server/server.js';

const port = Number(process.env.PORT || 8080);
const { port: actual } = await startServer({ port, dataDir: './wonderblocks-data' });

const ips = [];
for (const addrs of Object.values(networkInterfaces())) {
  for (const a of addrs || []) {
    if (a.family === 'IPv4' && !a.internal) ips.push(a.address);
  }
}

console.log('');
console.log('🌈  WonderBlocks: Build Together — server is up!');
console.log('');
if (ips.length > 0) {
  for (const ip of ips) console.log(`    Play at:  http://${ip}:${actual}`);
} else {
  console.log(`    Play at:  http://localhost:${actual}`);
}
console.log('');
console.log('    1. Open the link above on this computer or any device on the same Wi-Fi.');
console.log('    2. Press "Create World" in the game to get a 6-letter room code.');
console.log(`    3. Friends join with the code, or open  http://<this-ip>:${actual}/?room=CODE`);
console.log('');
console.log('    Worlds auto-save every 20 seconds. Press Ctrl+C to stop.');
