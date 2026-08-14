/** Cihazi bir odadaki takima baglayan yerel kayit. */
export interface Session {
  teamId: string;
  token: string;
}

function key(code: string): string {
  return `butce:${code.toUpperCase()}`;
}

export function saveSession(code: string, session: Session): void {
  localStorage.setItem(key(code), JSON.stringify(session));
}

/** Bozuk ya da eksik kayitlari sessizce temizler ve null doner. */
export function readSession(code: string): Session | null {
  const raw = localStorage.getItem(key(code));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed?.teamId !== 'string' || typeof parsed?.token !== 'string') {
      localStorage.removeItem(key(code));
      return null;
    }
    return { teamId: parsed.teamId, token: parsed.token };
  } catch {
    localStorage.removeItem(key(code));
    return null;
  }
}

export function clearSession(code: string): void {
  localStorage.removeItem(key(code));
}
