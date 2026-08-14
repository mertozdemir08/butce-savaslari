import type { ClientMessage, ServerMessage } from '@/lib/server/protocol';

export type SocketStatus = 'connecting' | 'open' | 'reconnecting';

/** WebSocket'in bu modulun kullandigi kadari. Testte sahtesi verilebilir. */
export interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
}

export interface RoomSocket {
  /** Baglanti acik degilse false doner ve mesaji atar. */
  send(msg: ClientMessage): boolean;
  close(): void;
}

export interface RoomSocketOptions {
  url: string;
  onMessage: (msg: ServerMessage) => void;
  onStatus: (status: SocketStatus) => void;
  /** Her acilista cagrilir: ilk baglantida da, her yeniden baglantida da. */
  onOpen: () => void;
  factory?: (url: string) => SocketLike;
}

/** Ardarda kopmalarda beklenecek sureler; son deger tavan olarak tekrarlanir. */
const BACKOFF_MS = [1000, 2000, 4000, 8000, 10_000];

/** Oyun soketinin adresi: sayfa hangi protokoldeyse ona uyar. */
export function gameSocketUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

/**
 * Kendini yeniden baglayan oyun soketi.
 *
 * Kuyruk tutmaz: kapaliyken gonderilen mesaj atilir. Tur tabanli bir oyunda
 * gecikmis bir aksiyonu sonradan oynatmak, turn_seq zaten reddedecegi icin
 * faydasiz; onun yerine arayuz baglanti durumunu gosterip aksiyonlari kapatir.
 */
export function createRoomSocket(opts: RoomSocketOptions): RoomSocket {
  const make = opts.factory ?? ((url: string) => new WebSocket(url) as unknown as SocketLike);

  let socket: SocketLike | null = null;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let isOpen = false;
  let closedByUs = false;

  function connect(): void {
    opts.onStatus(attempt === 0 ? 'connecting' : 'reconnecting');

    const next = make(opts.url);
    socket = next;

    next.onopen = () => {
      if (closedByUs) return;
      isOpen = true;
      attempt = 0; // basarili baglanti geri cekilmeyi sifirlar
      opts.onStatus('open');
      opts.onOpen();
    };

    next.onmessage = (ev) => {
      try {
        opts.onMessage(JSON.parse(String(ev.data)) as ServerMessage);
      } catch {
        // Bozuk cerceve yok sayilir; baglantiyi dusurmeye degmez.
      }
    };

    const fallOver = () => {
      if (closedByUs) return;
      isOpen = false;
      opts.onStatus('reconnecting');
      scheduleReconnect();
    };

    next.onclose = fallOver;
    next.onerror = fallOver;
  }

  function scheduleReconnect(): void {
    if (timer) return;
    const wait = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
    attempt++;
    timer = setTimeout(() => {
      timer = null;
      if (!closedByUs) connect();
    }, wait);
  }

  connect();

  return {
    send(msg) {
      if (!socket || !isOpen) return false;
      socket.send(JSON.stringify(msg));
      return true;
    },
    close() {
      closedByUs = true;
      isOpen = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      socket?.close();
    },
  };
}
