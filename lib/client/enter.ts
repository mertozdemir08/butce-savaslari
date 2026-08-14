'use client';

import type { ClientMessage } from '@/lib/server/protocol';
import { saveSession } from './session';
import { createRoomSocket, gameSocketUrl } from './socket';

export interface EnterResult {
  code: string;
  teamId: string;
  token: string;
}

export interface EnterFailure {
  error: string;
}

const TIMEOUT_MS = 8000;

/**
 * Odaya girisin tek seferlik kismi: bir soket acar, tek mesaj gonderir,
 * welcome ya da error bekler, oturumu kaydeder ve soketi kapatir.
 *
 * Canli oda aboneligi useRoom'un isi; burasi yalnizca giris bileti alir.
 */
function enter(message: ClientMessage): Promise<EnterResult | EnterFailure> {
  return new Promise((resolve) => {
    let settled = false;
    const holder: { socket: ReturnType<typeof createRoomSocket> | null } = { socket: null };

    const finish = (result: EnterResult | EnterFailure) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      holder.socket?.close();
      resolve(result);
    };

    const timer = setTimeout(
      () => finish({ error: 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.' }),
      TIMEOUT_MS,
    );

    holder.socket = createRoomSocket({
      url: gameSocketUrl(),
      onStatus: () => {},
      onOpen: () => holder.socket?.send(message),
      onMessage: (msg) => {
        if (msg.t === 'welcome') {
          saveSession(msg.code, { teamId: msg.teamId, token: msg.token });
          finish({ code: msg.code, teamId: msg.teamId, token: msg.token });
        } else if (msg.t === 'error') {
          finish({ error: msg.message });
        }
      },
    });
  });
}

export function createRoom(input: {
  teamName: string;
  budget: number;
  itemLimit: number;
  turnSeconds: number;
  items: { name: string; imageUrl?: string }[];
}): Promise<EnterResult | EnterFailure> {
  return enter({ t: 'create', ...input });
}

export function joinRoom(code: string, teamName: string): Promise<EnterResult | EnterFailure> {
  return enter({ t: 'join', code: code.toUpperCase(), teamName });
}

export function isFailure(r: EnterResult | EnterFailure): r is EnterFailure {
  return 'error' in r;
}
