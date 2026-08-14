import { describe, it, expect, beforeEach, vi } from 'vitest';

// Gercek localStorage yerine basit bir taklit; jsdom'a gerek yok.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

const { saveSession, readSession, clearSession } = await import('@/lib/client/session');

describe('session', () => {
  beforeEach(() => store.clear());

  it('kaydeder ve okur', () => {
    saveSession('AB23', { teamId: 't-a', token: 'xyz' });
    expect(readSession('AB23')).toEqual({ teamId: 't-a', token: 'xyz' });
  });

  it('oda kodlarini birbirinden ayirir', () => {
    saveSession('AB23', { teamId: 't-a', token: 'xyz' });
    expect(readSession('CD45')).toBeNull();
  });

  it('kucuk harfli kodu buyuk harfe cevirerek bulur', () => {
    saveSession('AB23', { teamId: 't-a', token: 'xyz' });
    expect(readSession('ab23')).toEqual({ teamId: 't-a', token: 'xyz' });
  });

  it('siler', () => {
    saveSession('AB23', { teamId: 't-a', token: 'xyz' });
    clearSession('AB23');
    expect(readSession('AB23')).toBeNull();
  });

  it('kaydi olmayan oda icin null doner', () => {
    expect(readSession('AB23')).toBeNull();
  });

  it('bozuk JSON icin null doner ve kaydi temizler', () => {
    localStorage.setItem('butce:AB23', '{bozuk');
    expect(readSession('AB23')).toBeNull();
    expect(localStorage.getItem('butce:AB23')).toBeNull();
  });

  it('eksik alanli kaydi gecersiz sayar ve temizler', () => {
    localStorage.setItem('butce:AB23', JSON.stringify({ teamId: 't-a' }));
    expect(readSession('AB23')).toBeNull();
    expect(localStorage.getItem('butce:AB23')).toBeNull();
  });
});
