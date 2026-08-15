'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SetupForm, type SetupValues } from '@/components/setup/SetupForm';
import { createRoom, isFailure } from '@/lib/client/enter';

export default function SetupPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(values: SetupValues) {
    setBusy(true);
    setError(null);

    const result = await createRoom(values);
    if (isFailure(result)) {
      setError(result.error);
      setBusy(false);
      return;
    }
    router.push(`/oda/${result.code}`);
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="mb-8 font-display text-[40px] font-extrabold uppercase leading-none">
        Oda kur
      </h1>
      <SetupForm onSubmit={create} busy={busy} error={error} />
    </main>
  );
}
