'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameState, Team } from '@/lib/game/types';
import type { ClientMessage } from '@/lib/server/protocol';
import { readSession } from './session';
import { createRoomSocket, gameSocketUrl, type RoomSocket, type SocketStatus } from './socket';

export type Connection = SocketStatus;

export interface UseRoom {
  state: GameState | null;
  /** Bu cihazin takimi; anlik goruntu gelene kadar null. */
  me: Team | null;
  connection: Connection;
  /** sunucuSaati - tarayiciSaati. Geri sayim bununla duzeltilir. */
  clockOffsetMs: number;
  /** Oda yok ya da kapanmis. */
  notFound: boolean;
  /** Bu cihazin bu odada kayitli bir takimi var mi. */
  hasSession: boolean;
  /** Son kural hatasi; her yeni aksiyonda temizlenir. */
  error: string | null;
  call: (msg: ClientMessage) => void;
}

/**
 * Bir odaya canli abonelik.
 *
 * Odaya giris (create/join) burada degil, lib/client/enter.ts'te yapilir.
 * Bu kanca yalnizca kayitli oturumu geri alir ve anlik goruntuleri dinler.
 */
export function useRoom(code: string): UseRoom {
  const [state, setState] = useState<GameState | null>(null);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);

  const socketRef = useRef<RoomSocket | null>(null);

  useEffect(() => {
    const session = readSession(code);
    setHasSession(session !== null);
    if (!session) return;

    const socket = createRoomSocket({
      url: gameSocketUrl(),
      onStatus: setConnection,
      onOpen: () => {
        // Her acilista oturumu geri al: ilk baglantida da, kopma sonrasinda da.
        socketRef.current?.send({
          t: 'resume',
          code,
          teamId: session.teamId,
          token: session.token,
        });
      },
      onMessage: (msg) => {
        if (msg.t === 'state') {
          setState(msg.state);
          setClockOffsetMs(new Date(msg.serverTime).getTime() - Date.now());
          setNotFound(false);
        } else if (msg.t === 'error') {
          if (msg.code === 'ROOM_NOT_FOUND') setNotFound(true);
          setError(msg.message);
        }
      },
    });

    socketRef.current = socket;
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [code]);

  const call = useCallback((msg: ClientMessage) => {
    setError(null);
    socketRef.current?.send(msg);
  }, []);

  const me = useMemo(() => {
    if (!state) return null;
    const session = typeof window === 'undefined' ? null : readSession(code);
    if (!session) return null;
    return state.teams.find((t) => t.id === session.teamId) ?? null;
  }, [state, code]);

  return { state, me, connection, clockOffsetMs, notFound, hasSession, error, call };
}
