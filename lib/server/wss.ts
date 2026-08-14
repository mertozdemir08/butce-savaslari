import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { dispatch, type Conn } from './dispatch';
import { parseClientMessage, type ServerMessage } from './protocol';
import { createRoomStore, type RoomStore } from './rooms';

const SWEEP_INTERVAL_MS = 60_000;

export interface GameServer {
  wss: WebSocketServer;
  store: RoomStore;
  stop(): void;
}

/**
 * Soket tesisati. Tum yonlendirme karari dispatch()'te; burasi yalnizca
 * baglantilari tutar, mesajlari cozer ve sonucu tellere yazar.
 */
export function attachGameServer(
  server: Server,
  opts: { store?: RoomStore; path?: string } = {},
): GameServer {
  const store = opts.store ?? createRoomStore();
  const path = opts.path ?? '/ws';
  const wss = new WebSocketServer({ noServer: true });
  const conns = new Map<WebSocket, Conn>();

  // Upgrade'i kendimiz suzuyoruz: yalnizca oyun yolunu aliyoruz, gerisini
  // (dev modunda Next'in /_next/hmr soketi) sunucunun oteki dinleyicilerine
  // birakiyoruz. `{ server, path }` secenegi eslesmeyen her upgrade'i 400 ile
  // kapatirdi ve HMR'i oldururdu.
  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== path) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  };
  server.on('upgrade', onUpgrade);

  function send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  /** Odadaki tum baglantilara tam anlik goruntu yayinlar. Jetonlar dahil degildir. */
  function broadcast(code: string): void {
    const room = store.get(code);
    if (!room) return;
    const frame = JSON.stringify({
      t: 'state',
      state: room.state,
      serverTime: new Date().toISOString(),
    } satisfies ServerMessage);

    for (const [socket, conn] of conns) {
      if (conn.code === code && socket.readyState === WebSocket.OPEN) socket.send(frame);
    }
  }

  /**
   * Odanin bagli takim listesini soketlerden turetip motora bildirir.
   * Motor degisiklik yoksa yazmaz; host ayrildiysa yetkiyi kendiliginden devreder.
   */
  function syncPresence(code: string): void {
    const online: string[] = [];
    for (const [socket, conn] of conns) {
      if (conn.code === code && conn.teamId && socket.readyState === WebSocket.OPEN) {
        online.push(conn.teamId);
      }
    }
    const outcome = store.apply(code, null, { type: 'SET_PRESENCE', onlineTeamIds: online });
    if (outcome.ok && outcome.events.length > 0) broadcast(code);
  }

  wss.on('connection', (socket: WebSocket) => {
    conns.set(socket, { code: null, teamId: null });

    socket.on('message', (data) => {
      let raw: unknown;
      try {
        raw = JSON.parse(data.toString());
      } catch {
        return send(socket, { t: 'error', code: 'BAD_REQUEST', message: 'Geçersiz istek.' });
      }

      const msg = parseClientMessage(raw);
      if (!msg) {
        return send(socket, { t: 'error', code: 'BAD_REQUEST', message: 'Geçersiz istek.' });
      }

      const conn = conns.get(socket);
      if (!conn) return;

      const result = dispatch(store, conn, msg);
      if (result.attach) conns.set(socket, result.attach);
      for (const reply of result.reply) send(socket, reply);
      if (result.broadcast) broadcast(result.broadcast);
      // Yeni bir baglanti odaya bagliysa varlik listesi degismis olabilir.
      if (result.attach?.code) syncPresence(result.attach.code);
    });

    const drop = () => {
      const gone = conns.get(socket);
      conns.delete(socket);
      if (gone?.code) syncPresence(gone.code);
    };
    socket.on('close', drop);
    socket.on('error', drop);
  });

  const sweeper = setInterval(() => {
    const removed = store.sweep(Date.now());
    if (removed.length === 0) return;
    // Odasi silinen baglantilari serbest birak; istemci yeniden kurmayi dener.
    for (const [socket, conn] of conns) {
      if (conn.code && removed.includes(conn.code)) {
        send(socket, { t: 'error', code: 'ROOM_NOT_FOUND', message: 'Oda kapandı.' });
        conns.set(socket, { code: null, teamId: null });
      }
    }
  }, SWEEP_INTERVAL_MS);

  return {
    wss,
    store,
    stop() {
      clearInterval(sweeper);
      server.off('upgrade', onUpgrade);
      wss.close();
    },
  };
}
