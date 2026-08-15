export type TeamId = string;
export type LotId = string;
export type ItemId = string;

export type RoomStatus = 'lobby' | 'auction' | 'voting' | 'finished';
export type BidKind = 'bid' | 'pass' | 'auto_pass';

export interface Team {
  id: TeamId;
  name: string;
  /** 0..n-1, bosluksuz. Sira bu dizilime gore doner. */
  seat: number;
  budgetLeft: number;
  itemsWon: number;
  connected: boolean;
}

export interface Item {
  id: ItemId;
  name: string;
  /** Bos olabilir. Bos oldugunda arayuz lot numarasini tipografik yedek olarak gosterir. */
  imageUrl: string | null;
}

export interface BidRecord {
  teamId: TeamId;
  kind: BidKind;
  /** Yalnizca kind === 'bid' oldugunda dolu. */
  amount: number | null;
  at: string;
}

export interface Lot {
  id: LotId;
  itemId: ItemId;
  /** 1'den baslar. */
  lotNo: number;
  /** 'granted': kimse teklif vermedi, urun acan takima bedelsiz yazildi. */
  status: 'open' | 'sold' | 'granted';
  currentBid: number | null;
  currentBidderTeamId: TeamId | null;
  turnTeamId: TeamId | null;
  /** Her sira degisiminde artar. Bayat istekleri reddetmek icin kullanilir. */
  turnSeq: number;
  turnDeadline: string | null;
  /**
   * Lotu acan takim: acilis koltugundan baslayarak yeri olan ilk takim.
   * Hic teklif gelmezse urun bedelsiz buna yazilir.
   */
  openerTeamId: TeamId;
  /** Bu lotta hala yarisan takimlar. Pas gecen cikarilir. */
  activeTeamIds: TeamId[];
  log: BidRecord[];
  winnerTeamId: TeamId | null;
  finalPrice: number | null;
}

export interface Vote {
  voterTeamId: TeamId;
  /** Voter disindaki tum takimlar, en iyiden en kotuye. */
  rankedTeamIds: TeamId[];
}

export interface GameState {
  roomId: string;
  code: string;
  status: RoomStatus;
  budget: number;
  itemLimit: number;
  turnSeconds: number;
  hostTeamId: TeamId;
  teams: Team[];
  items: Item[];
  /** Acilmis tum lotlar, acilis sirasinda. */
  lots: Lot[];
  /** Acik lot, ya da sonuc gosterilirken kapanmis son lot. */
  currentLotId: LotId | null;
  nextItemIndex: number;
  /** Sonraki lotu acacak koltuk. Her lotta bir ilerler. */
  openerSeat: number;
  /** Dolu oldugunda sonuc koreografisi oynuyor, yeni lot henuz acilmadi. */
  resultUntil: string | null;
  votes: Vote[];
}

export interface CreateGameInput {
  roomId: string;
  code: string;
  hostTeamId: TeamId;
  hostTeamName: string;
  budget?: number;
  itemLimit?: number;
  turnSeconds?: number;
}

export type Action =
  | { type: 'JOIN'; teamId: TeamId; name: string }
  | { type: 'SET_ITEMS'; byTeamId: TeamId; items: Item[] }
  | { type: 'START_GAME'; byTeamId: TeamId }
  | { type: 'BID'; teamId: TeamId; amount: number; turnSeq: number }
  | { type: 'PASS'; teamId: TeamId; turnSeq: number }
  | { type: 'TIMEOUT'; lotId: LotId; turnSeq: number }
  | { type: 'ADVANCE' }
  | { type: 'VOTE'; teamId: TeamId; rankedTeamIds: TeamId[] }
  | { type: 'SET_PRESENCE'; onlineTeamIds: TeamId[] };

export type GameEvent =
  | { type: 'TEAM_JOINED'; teamId: TeamId }
  | { type: 'LOT_OPENED'; lotId: LotId; lotNo: number; itemId: ItemId }
  | { type: 'TURN_CHANGED'; lotId: LotId; teamId: TeamId; deadline: string }
  | { type: 'BID_PLACED'; lotId: LotId; teamId: TeamId; amount: number }
  | { type: 'TEAM_PASSED'; lotId: LotId; teamId: TeamId; auto: boolean }
  // Teklifle satista fiyat her zaman en az 1'dir; bedelsiz devir LOT_GRANTED ile bildirilir.
  | { type: 'LOT_SOLD'; lotId: LotId; winnerTeamId: TeamId; price: number }
  | { type: 'LOT_GRANTED'; lotId: LotId; teamId: TeamId }
  | { type: 'GAME_ENDED' }
  | { type: 'VOTING_STARTED' }
  | { type: 'VOTE_CAST'; teamId: TeamId }
  | { type: 'PRESENCE_CHANGED' }
  | { type: 'HOST_CHANGED'; teamId: TeamId };

export type RuleErrorCode =
  | 'WRONG_STATUS'
  | 'NOT_HOST'
  | 'NOT_ENOUGH_TEAMS'
  | 'ROOM_FULL'
  | 'NO_ITEMS'
  | 'LOT_NOT_OPEN'
  | 'NOT_YOUR_TURN'
  | 'STALE_TURN'
  | 'BID_TOO_LOW'
  | 'BID_OVER_BUDGET'
  | 'ALREADY_VOTED'
  | 'INVALID_RANKING'
  | 'UNKNOWN_TEAM';

export interface RuleError {
  code: RuleErrorCode;
  message: string;
}

export interface Ctx {
  now: Date;
  newId: () => string;
}

export type ApplyResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: RuleError };
