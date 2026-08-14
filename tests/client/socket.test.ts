import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoomSocket, type SocketLike, type SocketStatus } from '@/lib/client/socket';
import type { ClientMessage, ServerMessage } from '@/lib/server/protocol';

/** Testin elle tetikledigi sahte WebSocket. */
class FakeSocket implements SocketLike {
  static instances: FakeSocket[] = [];
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;

  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.();
  }
  receive(msg: unknown) {
    this.onmessage?.({ data: typeof msg === 'string' ? msg : JSON.stringify(msg) });
  }
  drop() {
    this.onclose?.();
  }
}

function harness() {
  const messages: ServerMessage[] = [];
  const statuses: SocketStatus[] = [];
  const opens: number[] = [];

  const socket = createRoomSocket({
    url: 'ws://test/ws',
    onMessage: (m) => messages.push(m),
    onStatus: (s) => statuses.push(s),
    onOpen: () => opens.push(Date.now()),
    factory: (url) => new FakeSocket(url),
  });

  return { socket, messages, statuses, opens, sockets: FakeSocket.instances };
}

beforeEach(() => {
  FakeSocket.instances = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('createRoomSocket', () => {
  it('hemen baglanmayi dener ve connecting bildirir', () => {
    const { statuses, sockets } = harness();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].url).toBe('ws://test/ws');
    expect(statuses[0]).toBe('connecting');
  });

  it('acilinca open bildirir ve onOpen cagirir', () => {
    const { statuses, opens, sockets } = harness();
    sockets[0].open();
    expect(statuses.at(-1)).toBe('open');
    expect(opens).toHaveLength(1);
  });

  it('gelen mesaji cozup iletir', () => {
    const { messages, sockets } = harness();
    sockets[0].open();
    sockets[0].receive({ t: 'error', code: 'BAD_REQUEST', message: 'x' });
    expect(messages).toHaveLength(1);
    expect(messages[0].t).toBe('error');
  });

  it('bozuk mesaji sessizce yok sayar', () => {
    const { messages, sockets } = harness();
    sockets[0].open();
    sockets[0].receive('bu json degil');
    expect(messages).toHaveLength(0);
  });

  it('acikken mesaj gonderir', () => {
    const { socket, sockets } = harness();
    sockets[0].open();
    const msg: ClientMessage = { t: 'advance' };
    expect(socket.send(msg)).toBe(true);
    expect(JSON.parse(sockets[0].sent[0])).toEqual(msg);
  });

  it('acik degilken gondermeyi reddeder', () => {
    const { socket, sockets } = harness();
    expect(socket.send({ t: 'advance' })).toBe(false);
    expect(sockets[0].sent).toHaveLength(0);
  });

  it('baglanti kopunca reconnecting bildirir ve geri cekilerek yeniden baglanir', () => {
    const { statuses, sockets } = harness();
    sockets[0].open();
    sockets[0].drop();

    expect(statuses.at(-1)).toBe('reconnecting');
    expect(sockets).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
  });

  it('ardarda kopmalarda bekleme suresi artar', () => {
    const { sockets } = harness();

    sockets[0].open();
    sockets[0].drop();
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);

    // Ikinci deneme acilmadan koparsa bekleme 2 saniyeye cikar.
    sockets[1].drop();
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(3);
  });

  it('basarili baglantidan sonra bekleme suresi sifirlanir', () => {
    const { sockets } = harness();

    sockets[0].open();
    sockets[0].drop();
    vi.advanceTimersByTime(1000);
    sockets[1].drop();
    vi.advanceTimersByTime(2000);
    expect(sockets).toHaveLength(3);

    // Ucuncu deneme acilirsa sayac sifirlanir; sonraki kopmada yine 1 saniye.
    sockets[2].open();
    sockets[2].drop();
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(4);
  });

  it('her yeniden baglantida onOpen tekrar cagrilir', () => {
    const { opens, sockets } = harness();
    sockets[0].open();
    sockets[0].drop();
    vi.advanceTimersByTime(1000);
    sockets[1].open();
    expect(opens).toHaveLength(2);
  });

  it('close() sonrasi yeniden baglanmaz', () => {
    const { socket, sockets } = harness();
    sockets[0].open();
    socket.close();
    sockets[0].drop();

    vi.advanceTimersByTime(20_000);
    expect(sockets).toHaveLength(1);
    expect(sockets[0].closed).toBe(true);
  });
});
