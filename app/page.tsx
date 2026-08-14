'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { isFailure, joinRoom } from '@/lib/client/enter';
import { CODE_LENGTH } from '@/lib/game/constants';

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canJoin = code.trim().length === CODE_LENGTH && teamName.trim().length > 0 && !busy;

  async function join(e: FormEvent) {
    e.preventDefault();
    if (!canJoin) return;

    setBusy(true);
    setError(null);

    const result = await joinRoom(code.trim(), teamName.trim());
    if (isFailure(result)) {
      setError(result.error);
      setBusy(false);
      return;
    }
    router.push(`/oda/${result.code}`);
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center gap-10 px-5 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-[52px] font-extrabold uppercase leading-[0.9] sm:text-[64px]">
        Bütçe
        <br />
        Savaşları
      </h1>

      <form className="flex flex-col gap-4" onSubmit={join}>
        <div>
          <label
            className="mb-1.5 block font-[family-name:var(--font-mono)] text-[9.5px] tracking-[0.18em] text-[var(--color-mute)]"
            htmlFor="code"
          >
            ODA KODU
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toLocaleUpperCase('tr-TR'))}
            maxLength={CODE_LENGTH}
            autoComplete="off"
            autoCapitalize="characters"
            className="tnum w-full rounded-[4px] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-3 text-center font-[family-name:var(--font-mono)] text-[28px] font-bold tracking-[0.3em]"
          />
        </div>

        <div>
          <label
            className="mb-1.5 block font-[family-name:var(--font-mono)] text-[9.5px] tracking-[0.18em] text-[var(--color-mute)]"
            htmlFor="name"
          >
            TAKIM ADIN
          </label>
          <input
            id="name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            maxLength={24}
            autoComplete="off"
            className="min-h-[44px] w-full rounded-[4px] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5 text-[15px]"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-accent)]"
          >
            {error}
          </p>
        )}

        <Button type="submit" disabled={!canJoin}>
          {busy ? 'KATILIYOR' : 'ODAYA KATIL'}
        </Button>
      </form>

      <div className="border-t border-[var(--color-line)] pt-6">
        <Button variant="ghost" className="w-full" onClick={() => router.push('/kur')}>
          YENİ ODA KUR
        </Button>
      </div>
    </main>
  );
}
