// WonderBlocks net client: WebSocket wrapper following shared/protocol.js.
import { MSG } from 'wb-shared/protocol.js?v=11';

export class Net {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.handlers = {};
    this.roomCode = null;
    this.playerId = null;
  }
  on(type, fn) {
    (this.handlers[type] = this.handlers[type] || []).push(fn);
  }
  emit(type, data) {
    for (const fn of this.handlers[type] || []) fn(data);
  }
  // Resolves when the socket opens; rejects on error/timeout.
  connect() {
    return new Promise((resolve, reject) => {
      if (this.ws) { try { this.ws.close(); } catch { /* noop */ } }
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      let url;
      try { url = `${proto}://${location.host}/`; }
      catch { reject(new Error('no-host')); return; }
      if (!location.host) { reject(new Error('no-host')); return; }
      const ws = new WebSocket(url);
      const to = setTimeout(() => { try { ws.close(); } catch { /* noop */ } reject(new Error('timeout')); }, 8000);
      ws.onopen = () => { clearTimeout(to); this.ws = ws; this.connected = true; this.attach(); resolve(); };
      ws.onerror = () => { clearTimeout(to); reject(new Error('connect-failed')); };
    });
  }
  attach() {
    this.ws.onmessage = ev => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === MSG.PING) { this.send({ t: MSG.PING }); return; }
      this.emit(m.t, m);
    };
    this.ws.onclose = () => { this.connected = false; this.emit('__close', {}); };
  }
  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }
  join(room, name, char, clientId) {
    this.roomCode = room;
    this.send({ t: MSG.JOIN, room, name, char, clientId });
  }
  close() { try { this.ws && this.ws.close(); } catch { /* noop */ } this.connected = false; }
}
