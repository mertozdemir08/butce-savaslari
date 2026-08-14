import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { Action } from '@/lib/game/types';
import { parseClientMessage, toItems, type ServerMessage } from './protocol';
import { createRoomStore, type RoomStore } from './rooms';

/** Bir baglantinin hangi odaya ve hangi takima bagli oldugu. */
interface Conn {
  code: string | null;
  teamId: string | null;
}

const SWEEP_INTERVAL_MS = 60_000;

export interface GameServer {
  wss: WebSocketServer;
  store: RoomStore;
  stop(): void;
}

export function attachGameServer(
  server: Server,
  opts: { store?: RoomStore; path?: string } = {},
): GameServer {
  const store = opts.store ?? createRoomStore();
  const wss = new WebSocketServer({ server, path: opts.path ?? '/ws' });
  const conns = new Map<WebSocket, Conn>();

  function send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  function fail(socket: WebSocket, code: ServerMessage & { t: 'error' }): void {
    send(socket, code);
  }

  /** Odadaki tum baglantilara tam anlik goruntu yayinlar. Jetonlar dahil edilmez. */
  function broadcast(code: string): void {
    const room = store.get(code);
    if (!room) return;
    const payload: ServerMessage = {
      t: 'state',
      state: room.state,
      serverTime: new Date().toISOString(),
    };
    const frame = JSON.stringify(payload);
    for (const [socket, conn] of conns) {
      if (conn.code === code && socket.readyState === WebSocket.OPEN) socket.send(frame);
    }
  }

  wss.on('connection', (socket: WebSocket) => {
    conns.set(socket, { code: null, teamId: null });

    socket.on('message', (data) => {
      let raw: unknown;
      try {
        raw = JSON.parse(data.toString());
      } catch {
        return fail(socket, { t: 'error', code: 'BAD_REQUEST', message: 'Geçersiz istek.' });
      }

      const msg = parseClientMessage(raw);
      if (!msg) {
        return fail(socket, { t: 'error', code: 'BAD_REQUEST', message: 'Geçersiz istek.' });
      }

      const conn = conns.get(socket)!;

      // --- Odaya baglanma mesajlari ---

      if (msg.t === 'create') {
        const items = toItems(msg.items);
        if (items.length === 0) {
          return fail(socket, { t: 'error', code: 'NO_ITEMS', message: 'Ürün listesi boş.' });
        }
        const { room, teamId, token } = store.create({
          teamName: msg.teamName,
          items,
          budget: msg.budget,
          itemLimit: msg.itemLimit,
          turnSeconds: msg.turnSeconds,
        });
        conn.code = room.code;
        conn.teamId = teamId;
        send(socket, { t: 'welcome', code: room.code, teamId, token });
        return broadcast(room.code);
      }

      if (msg.t === 'join') {
        const result = store.join(msg.code, msg.teamName);
        if ('code' in result) {
          return fail(socket, { t: 'error', code: result.code, message: result.message });
        }
        conn.code = msg.code;
        conn.teamId = result.teamId;
        send(socket, {
          t: 'welcome',
          code: msg.code,
          teamId: result.teamId,
          token: result.token,
        });
        return broadcast(msg.code);
      }

      if (msg.t === 'resume') {
        const room = store.get(msg.code);
        if (!room) {
          return fail(socket, {
            t: 'error',
            code: 'ROOM_NOT_FOUND',
            message: 'Oda bulunamadı.',
          });
        }
        if (room.tokens[msg.teamId] !== msg.token) {
          return fail(socket, {
            t: 'error',
            code: 'NOT_AUTHORIZED',
            message: 'Bu takım size ait değil.',
          });
        }
        conn.code = msg.code;
        conn.teamId = msg.teamId;
        return send(socket, {
          t: 'state',
          state: room.state,
          serverTime: new Date().toISOString(),
        });
      }

      // --- Oyun aksiyonlari: once odaya bagli olmak gerekir ---

      if (!conn.code) {
        return fail(socket, {
          t: 'error',
          code: 'ROOM_NOT_FOUND',
          message: 'Önce bir odaya katılın.',
        });
      }

      const needsTeam = msg.t === 'start' || msg.t === 'bid' || msg.t === 'pass' || msg.t === 'vote';
      if (needsTeam && !conn.teamId) {
        return fail(socket, {
          t: 'error',
          code: 'NOT_AUTHORIZED',
          message: 'Bu işlem için takım kimliği gerekli.',
        });
      }

      let action: Action;
      switch (msg.t) {
        case 'start':
          action = { type: 'START_GAME', byTeamId: conn.teamId! };
          break;
        case 'bid':
          action = {
            type: 'BID',
            teamId: conn.teamId!,
            amount: msg.amount,
            turnSeq: msg.turnSeq,
          };
          break;
        case 'pass':
          action = { type: 'PASS', teamId: conn.teamId!, turnSeq: msg.turnSeq };
          break;
        case 'vote':
          action = { type: 'VOTE', teamId: conn.teamId!, rankedTeamIds: msg.rankedTeamIds };
          break;
        case 'timeout':
          action = { type: 'TIMEOUT', lotId: msg.lotId, turnSeq: msg.turnSeq };
          break;
        case 'advance':
          action = { type: 'ADVANCE' };
          break;
        default:
          return fail(socket, { t: 'error', code: 'BAD_REQUEST', message: 'Geçersiz istek.' });
      }

      const outcome = store.apply(conn.code, conn.teamId, action);
      if (!outcome.ok) {
        return fail(socket, {
          t: 'error',
          code: outcome.error.code,
          message: outcome.error.message,
        });
      }
      broadcast(conn.code);
    });

    socket.on('close', () => {
      conns.delete(socket);
    });

    // Hatali soket sessizce dusurulur; oyun durmaz.
    socket.on('error', () => {
      conns.delete(socket);
    });
  });

  const sweeper = setInterval(() => {
    const removed = store.sweep(Date.now());
    if (removed.length === 0) return;
    // Silinen odalarin baglantilarini serbest birak; istemci yeniden baglanmayi dener.
    for (const [socket, conn] of conns) {
      if (conn.code && removed.includes(conn.code)) {
        send(socket, { t: 'error', code: 'ROOM_NOT_FOUND', message: 'Oda kapandı.' });
        conn.code = null;
        conn.teamId = null;
      }
    }
  }, SWEEP_INTERVAL_MS);

  return {
    wss,
    store,
    stop() {
      clearInterval(sweeper);
      wss.close();
    },
  };
}
