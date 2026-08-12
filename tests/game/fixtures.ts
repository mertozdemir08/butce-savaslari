import { createGame, applyAction } from '@/lib/game';
import type { Ctx, GameState, Item, Team } from '@/lib/game/types';

export function mkCtx(nowMs = 1_000_000, startId = 0): Ctx {
  let n = startId;
  return { now: new Date(nowMs), newId: () => `lot-${++n}` };
}

/** Ctx'i ileri saran yardimci: ayni id sayacini korur. */
export function advanceCtx(ctx: Ctx, deltaMs: number): Ctx {
  return { now: new Date(ctx.now.getTime() + deltaMs), newId: ctx.newId };
}

const NAMES = ['A', 'B', 'C', 'D'];
const IDS = ['t-a', 't-b', 't-c', 't-d'];

export interface AuctionOpts {
  teams?: number;
  budget?: number;
  itemLimit?: number;
  items?: number;
  turnSeconds?: number;
  nowMs?: number;
}

/** Acik artirma durumunda, ilk lotu acilmis bir oyun uretir. */
export function auctionGame(opts: AuctionOpts = {}): { state: GameState; ctx: Ctx } {
  const teamCount = opts.teams ?? 3;
  const budget = opts.budget ?? 10;
  const itemCount = opts.items ?? 3;

  let state = createGame({
    roomId: 'room-1',
    code: 'AB23',
    hostTeamId: IDS[0],
    hostTeamName: NAMES[0],
    budget,
    itemLimit: opts.itemLimit ?? 5,
    turnSeconds: opts.turnSeconds ?? 30,
  });

  const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
    id: IDS[i],
    name: NAMES[i],
    seat: i,
    budgetLeft: budget,
    itemsWon: 0,
    connected: true,
  }));

  const items: Item[] = Array.from({ length: itemCount }, (_, i) => ({
    id: `i-${i + 1}`,
    name: `Urun ${i + 1}`,
    imageUrl: null,
  }));

  state = { ...state, teams, items };

  const ctx = mkCtx(opts.nowMs ?? 1_000_000);
  const started = applyAction(state, { type: 'START_GAME', byTeamId: IDS[0] }, ctx);
  if (!started.ok) throw new Error(`fixture START_GAME basarisiz: ${started.error.code}`);

  return { state: started.state, ctx };
}

/** Acik lotu kisayoldan okur. */
export function lotOf(state: GameState) {
  const lot = state.lots.find((l) => l.id === state.currentLotId);
  if (!lot) throw new Error('lot yok');
  return lot;
}
