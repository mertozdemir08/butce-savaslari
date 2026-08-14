import type { Action } from '@/lib/game/types';
import {
  toItems,
  type ClientMessage,
  type ServerErrorCode,
  type ServerMessage,
} from './protocol';
import type { RoomStore } from './rooms';

/** Bir baglantinin hangi odaya ve hangi takima bagli oldugu. */
export interface Conn {
  code: string | null;
  teamId: string | null;
}

export interface DispatchResult {
  /** Yalnizca gonderene gidecek mesajlar. */
  reply: ServerMessage[];
  /** Doluysa bu oda koduna tam anlik goruntu yayinlanir. */
  broadcast: string | null;
  /** Doluysa baglantinin kimligi bununla degistirilir. */
  attach: Conn | null;
}

/** Kimlik gerektiren mesajlar; digerleri (timeout, advance) idempotenttir. */
const NEEDS_TEAM = new Set<ClientMessage['t']>(['start', 'bid', 'pass', 'vote']);

function only(reply: ServerMessage): DispatchResult {
  return { reply: [reply], broadcast: null, attach: null };
}

function fail(code: ServerErrorCode, message: string): DispatchResult {
  return only({ t: 'error', code, message });
}

/**
 * Bir istemci mesajini oda defterine uygular ve ne yapilmasi gerektigini soyler.
 *
 * Soket bilmez: yalnizca "sunu gonderene yolla", "su odaya yayinla" ve
 * "baglantiyi su takima bagla" der. Boylece tum yonlendirme mantigi
 * ag olmadan test edilebilir.
 */
export function dispatch(store: RoomStore, conn: Conn, msg: ClientMessage): DispatchResult {
  // --- Odaya baglanma ---

  if (msg.t === 'create') {
    const items = toItems(msg.items);
    if (items.length === 0) return fail('NO_ITEMS', 'Ürün listesi boş.');

    const { room, teamId, token } = store.create({
      teamName: msg.teamName,
      items,
      budget: msg.budget,
      itemLimit: msg.itemLimit,
      turnSeconds: msg.turnSeconds,
    });

    return {
      reply: [{ t: 'welcome', code: room.code, teamId, token }],
      broadcast: room.code,
      attach: { code: room.code, teamId },
    };
  }

  if (msg.t === 'join') {
    const result = store.join(msg.code, msg.teamName);
    if ('code' in result) return fail(result.code, result.message);

    return {
      reply: [{ t: 'welcome', code: msg.code, teamId: result.teamId, token: result.token }],
      broadcast: msg.code,
      attach: { code: msg.code, teamId: result.teamId },
    };
  }

  if (msg.t === 'resume') {
    const room = store.get(msg.code);
    if (!room) return fail('ROOM_NOT_FOUND', 'Oda bulunamadı.');
    if (room.tokens[msg.teamId] !== msg.token) {
      return fail('NOT_AUTHORIZED', 'Bu takım size ait değil.');
    }
    return {
      reply: [{ t: 'state', state: room.state, serverTime: new Date().toISOString() }],
      broadcast: null,
      attach: { code: msg.code, teamId: msg.teamId },
    };
  }

  // --- Oyun aksiyonlari ---

  if (!conn.code) return fail('ROOM_NOT_FOUND', 'Önce bir odaya katılın.');
  if (NEEDS_TEAM.has(msg.t) && !conn.teamId) {
    return fail('NOT_AUTHORIZED', 'Bu işlem için takım kimliği gerekli.');
  }

  const action = toAction(msg, conn.teamId);
  if (!action) return fail('BAD_REQUEST', 'Geçersiz istek.');

  const outcome = store.apply(conn.code, conn.teamId, action);
  if (!outcome.ok) return fail(outcome.error.code, outcome.error.message);

  return { reply: [], broadcast: conn.code, attach: null };
}

/** Istemci mesajini motorun anladigi aksiyona cevirir. */
function toAction(msg: ClientMessage, teamId: string | null): Action | null {
  switch (msg.t) {
    case 'start':
      return { type: 'START_GAME', byTeamId: teamId! };
    case 'bid':
      return { type: 'BID', teamId: teamId!, amount: msg.amount, turnSeq: msg.turnSeq };
    case 'pass':
      return { type: 'PASS', teamId: teamId!, turnSeq: msg.turnSeq };
    case 'vote':
      return { type: 'VOTE', teamId: teamId!, rankedTeamIds: msg.rankedTeamIds };
    case 'timeout':
      return { type: 'TIMEOUT', lotId: msg.lotId, turnSeq: msg.turnSeq };
    case 'advance':
      return { type: 'ADVANCE' };
    default:
      return null;
  }
}
