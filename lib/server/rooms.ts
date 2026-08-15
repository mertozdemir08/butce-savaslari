import { randomUUID } from 'node:crypto';
import { applyAction, createGame } from '@/lib/game';
import type {
  Action,
  GameEvent,
  GameState,
  Item,
  RuleErrorCode,
  TeamId,
} from '@/lib/game/types';
import { generateCode, newToken } from './codes';

/** Motorun hata kodlarina defter seviyesindekiler eklenir. */
export type StoreErrorCode =
  | RuleErrorCode
  | 'ROOM_NOT_FOUND'
  | 'NOT_AUTHORIZED'
  | 'SERVER_BUSY';

export interface StoreError {
  code: StoreErrorCode;
  message: string;
}

export interface Room {
  code: string;
  state: GameState;
  /** Cihaz-takim eslemesi. ASLA yayinlanmaz. */
  tokens: Record<TeamId, string>;
  lastActivityAt: number;
}

export interface CreateRoomInput {
  teamName: string;
  items: Item[];
  budget?: number;
  itemLimit?: number;
  turnSeconds?: number;
}

export interface Credentials {
  teamId: TeamId;
  token: string;
}

export type ApplyOutcome =
  | { ok: true; room: Room; events: GameEvent[] }
  | { ok: false; error: StoreError };

export interface RoomStore {
  create(input: CreateRoomInput): { room: Room; teamId: TeamId; token: string };
  get(code: string): Room | undefined;
  join(code: string, teamName: string): Credentials | StoreError;
  /** caller, cagiran baglantinin takim kimligi; kimliksiz baglantilarda null. */
  apply(code: string, caller: TeamId | null, action: Action): ApplyOutcome;
  /** Silinen oda kodlarini doner. */
  sweep(now: number): string[];
  /** Acik oda kodlari. Sunucu tiki butun odalari bunun uzerinden gezer. */
  codes(): string[];
  size(): number;
}

export interface RoomStoreOptions {
  now?: () => number;
  newId?: () => string;
  /** Hicbir hareket olmadan gecen bu sureden sonra oda silinir. */
  idleMs?: number;
  /** Bitmis oyunlar bu sureden sonra silinir. */
  finishedMs?: number;
}

const HOUR = 60 * 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

/**
 * Ayni anda tutulan en fazla oda. Durum bellekte oldugu icin bu, surecin
 * bellek tavani demek: acik adreste sinirsiz oda kurulmasini engeller.
 */
export const MAX_ROOMS = 200;

function err(code: StoreErrorCode, message: string): StoreError {
  return { code, message };
}

/**
 * Aksiyonun hangi takim adina yapildigini soyler.
 * null donmesi "kimlik gerektirmiyor" demektir: timeout ve advance
 * idempotenttir ve odadaki herhangi bir baglanti gonderebilir.
 */
function actorOf(action: Action): TeamId | null {
  switch (action.type) {
    case 'START_GAME':
    case 'SET_ITEMS':
      return action.byTeamId;
    case 'BID':
    case 'PASS':
    case 'VOTE':
      return action.teamId;
    default:
      return null;
  }
}

export function createRoomStore(opts: RoomStoreOptions = {}): RoomStore {
  const now = opts.now ?? (() => Date.now());
  const newId = opts.newId ?? (() => randomUUID());
  const idleMs = opts.idleMs ?? HOUR;
  const finishedMs = opts.finishedMs ?? TEN_MINUTES;

  const rooms = new Map<string, Room>();

  function uniqueCode(): string {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = generateCode();
      if (!rooms.has(code)) return code;
    }
    throw new Error('Benzersiz oda kodu uretilemedi.');
  }

  return {
    create(input) {
      const code = uniqueCode();
      const teamId = newId();
      const token = newToken();

      const base = createGame({
        roomId: code,
        code,
        hostTeamId: teamId,
        hostTeamName: input.teamName,
        budget: input.budget,
        itemLimit: input.itemLimit,
        turnSeconds: input.turnSeconds,
      });

      const room: Room = {
        code,
        state: { ...base, items: input.items },
        tokens: { [teamId]: token },
        lastActivityAt: now(),
      };

      rooms.set(code, room);
      return { room, teamId, token };
    },

    get(code) {
      return rooms.get(code);
    },

    join(code, teamName) {
      const room = rooms.get(code);
      if (!room) return err('ROOM_NOT_FOUND', 'Oda bulunamadı.');

      const teamId = newId();
      const result = applyAction(
        room.state,
        { type: 'JOIN', teamId, name: teamName },
        { now: new Date(now()), newId },
      );
      if (!result.ok) return result.error;

      const token = newToken();
      room.state = result.state;
      room.tokens[teamId] = token;
      room.lastActivityAt = now();
      return { teamId, token };
    },

    apply(code, caller, action) {
      const room = rooms.get(code);
      if (!room) return { ok: false, error: err('ROOM_NOT_FOUND', 'Oda bulunamadı.') };

      const actor = actorOf(action);
      if (actor !== null && actor !== caller) {
        return {
          ok: false,
          error: err('NOT_AUTHORIZED', 'Bu işlemi başka bir takım adına yapamazsınız.'),
        };
      }

      const result = applyAction(room.state, action, { now: new Date(now()), newId });
      if (!result.ok) return { ok: false, error: result.error };

      room.state = result.state;
      room.lastActivityAt = now();
      return { ok: true, room, events: result.events };
    },

    sweep(at) {
      const removed: string[] = [];
      for (const [code, room] of rooms) {
        const idle = at - room.lastActivityAt;
        const expired =
          room.state.status === 'finished' ? idle > finishedMs : idle > idleMs;
        if (expired) {
          rooms.delete(code);
          removed.push(code);
        }
      }
      return removed;
    },

    codes() {
      return [...rooms.keys()];
    },

    size() {
      return rooms.size;
    },
  };
}
