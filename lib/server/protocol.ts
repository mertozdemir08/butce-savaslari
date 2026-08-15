import { randomUUID } from 'node:crypto';
import {
  CODE_LENGTH,
  MAX_BUDGET,
  MAX_ITEMS,
  MAX_ITEM_LIMIT,
  MAX_ITEM_NAME,
  MAX_TURN_SECONDS,
  MIN_BUDGET,
  MIN_ITEM_LIMIT,
  MIN_TURN_SECONDS,
} from '@/lib/game/constants';
import type { GameState, Item } from '@/lib/game/types';
import type { StoreErrorCode } from './rooms';

const MAX_TEAM_NAME = 24;
const MAX_IMAGE_URL = 300;

export interface RawItem {
  name: string;
  imageUrl?: string | null;
}

export type ClientMessage =
  | {
      t: 'create';
      teamName: string;
      budget: number;
      itemLimit: number;
      turnSeconds: number;
      items: RawItem[];
    }
  | { t: 'join'; code: string; teamName: string }
  | { t: 'resume'; code: string; teamId: string; token: string }
  | { t: 'start' }
  | { t: 'bid'; amount: number; turnSeq: number }
  | { t: 'pass'; turnSeq: number }
  | { t: 'timeout'; lotId: string; turnSeq: number }
  | { t: 'advance' }
  | { t: 'vote'; rankedTeamIds: string[] };

export type ServerErrorCode = StoreErrorCode | 'BAD_REQUEST';

export type ServerMessage =
  | { t: 'welcome'; code: string; teamId: string; token: string }
  | { t: 'state'; state: GameState; serverTime: string }
  | { t: 'error'; code: ServerErrorCode; message: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function int(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) ? v : null;
}

/** Tam sayi, ayrica kapali aralikta. Disindaysa null. */
function intInRange(v: unknown, min: number, max: number): number | null {
  const n = int(v);
  return n !== null && n >= min && n <= max ? n : null;
}

/** Takim adi: kirpilir, bos olamaz, uzunluk sinirlidir. */
function teamName(v: unknown): string | null {
  const s = str(v)?.trim();
  if (!s || s.length > MAX_TEAM_NAME) return null;
  return s;
}

/** Oda kodu: buyuk harfe cevrilir, uzunlugu sabittir. */
function roomCode(v: unknown): string | null {
  const s = str(v)?.trim().toUpperCase();
  if (!s || s.length !== CODE_LENGTH) return null;
  return s;
}

/**
 * Istemciden gelen ham mesaji dogrular.
 * Bu, guvenilmeyen girdinin girdigi tek nokta; tanimadigi her seye null doner.
 */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (!isRecord(raw)) return null;

  switch (raw.t) {
    case 'create': {
      const name = teamName(raw.teamName);
      const budget = intInRange(raw.budget, MIN_BUDGET, MAX_BUDGET);
      const itemLimit = intInRange(raw.itemLimit, MIN_ITEM_LIMIT, MAX_ITEM_LIMIT);
      const turnSeconds = intInRange(raw.turnSeconds, MIN_TURN_SECONDS, MAX_TURN_SECONDS);
      if (!name || budget === null || itemLimit === null || turnSeconds === null) return null;
      if (!Array.isArray(raw.items) || raw.items.length > MAX_ITEMS) return null;
      return {
        t: 'create',
        teamName: name,
        budget,
        itemLimit,
        turnSeconds,
        items: raw.items as RawItem[],
      };
    }

    case 'join': {
      const code = roomCode(raw.code);
      const name = teamName(raw.teamName);
      if (!code || !name) return null;
      return { t: 'join', code, teamName: name };
    }

    case 'resume': {
      const code = roomCode(raw.code);
      const teamId = str(raw.teamId);
      const token = str(raw.token);
      if (!code || !teamId || !token) return null;
      return { t: 'resume', code, teamId, token };
    }

    case 'start':
      return { t: 'start' };

    case 'bid': {
      const amount = int(raw.amount);
      const turnSeq = int(raw.turnSeq);
      if (amount === null || turnSeq === null) return null;
      return { t: 'bid', amount, turnSeq };
    }

    case 'pass': {
      const turnSeq = int(raw.turnSeq);
      if (turnSeq === null) return null;
      return { t: 'pass', turnSeq };
    }

    case 'timeout': {
      const lotId = str(raw.lotId);
      const turnSeq = int(raw.turnSeq);
      if (!lotId || turnSeq === null) return null;
      return { t: 'timeout', lotId, turnSeq };
    }

    case 'advance':
      return { t: 'advance' };

    case 'vote': {
      if (!Array.isArray(raw.rankedTeamIds)) return null;
      if (!raw.rankedTeamIds.every((v) => typeof v === 'string')) return null;
      return { t: 'vote', rankedTeamIds: raw.rankedTeamIds as string[] };
    }

    default:
      return null;
  }
}

/** Gorsel adresi yalnizca http(s) ya da koke gore bir yol olabilir. */
function safeImageUrl(value: unknown): string | null {
  const raw = str(value)?.trim();
  if (!raw || raw.length > MAX_IMAGE_URL) return null;
  // "//host/x.png" tek egik cizgiyle baslar ama tarayici onu dis siteden
  // yukler; koke gore yol sayilmaz.
  if (raw.startsWith('//')) return null;
  if (raw.startsWith('/')) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Ham urun listesini motorun bekledigi Item[] haline getirir. */
export function toItems(raw: unknown): Item[] {
  if (!Array.isArray(raw)) return [];
  const items: Item[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const name = str(entry.name)?.trim().slice(0, MAX_ITEM_NAME);
    if (!name) continue;
    items.push({ id: randomUUID(), name, imageUrl: safeImageUrl(entry.imageUrl) });
    if (items.length === MAX_ITEMS) break;
  }
  return items;
}
