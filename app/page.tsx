'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { isFailure, joinRoom } from '@/lib/client/enter';
import { CODE_LENGTH, DEFAULT_BUDGET, DEFAULT_ITEM_LIMIT, DEFAULT_TURN_SECONDS } from '@/lib/game/constants';

const STEPS = [
  {
    n: '01',
    title: 'Ortaya bir ürün çıkar',
    body: 'Sırayla ürünler açık artırmaya çıkar. Görseli varsa bilette görünür.',
  },
  {
    n: '02',
    title: 'Sıra sende, 30 saniyen var',
    body: 'Ya artırırsın ya pas geçersin. Pas geçtiysen o ürüne bir daha giremezsin.',
  },
  {
    n: '03',
    title: 'İstemezsen ürün yanar',
    body: 'Kimse teklif vermezse ürün kimseye gitmez, elenir. İstiyorsan en az 1 vereceksin.',
  },
  {
    n: '04',
    title: 'Sonunda koleksiyonlar oylanır',
    body: '3+ takımda herkes diğerlerini sıralar. Kimse kendine oy veremez.',
  },
];

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
    <main className="min-h-dvh">
      <div className="mx-auto grid max-w-[1400px] gap-12 px-5 py-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:px-10 lg:py-16">
        {/* Sol: oyunun ne oldugu */}
        <section className="flex flex-col">
          <span className="font-mono text-[10px] tracking-[0.24em] text-accent">
            2-4 TAKIM · TARAYICIDA · KURULUM YOK
          </span>

          <h1 className="mt-4 font-display text-[64px] font-extrabold uppercase leading-[0.86] sm:text-[84px] lg:text-[104px]">
            Bütçe
            <br />
            Savaşları
          </h1>

          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-dim">
            Herkesin bütçesi aynı, alabileceği ürün sayısı sınırlı. Ortaya çıkan her şey için
            sırayla teklif verirsiniz. Sonunda kimin koleksiyonu daha iyi, onu da siz oylarsınız.
          </p>

          <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-4 border-y border-line py-5">
            {[
              ['BÜTÇE', DEFAULT_BUDGET],
              ['ÜRÜN LİMİTİ', DEFAULT_ITEM_LIMIT],
              ['TUR SÜRESİ', `${DEFAULT_TURN_SECONDS} sn`],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="font-mono text-[9px] tracking-[0.18em] text-mute">
                  {label}
                </dt>
                <dd className="tnum mt-1 font-display text-[28px] font-extrabold leading-none">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <ol className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {STEPS.map((step) => (
              <li key={step.n} className="flex gap-3">
                <span className="font-display text-[20px] font-extrabold leading-none text-accent">
                  {step.n}
                </span>
                <div>
                  <h2 className="text-[14px] font-semibold">{step.title}</h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-dim">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Sag: giris */}
        <section className="lg:sticky lg:top-16 lg:self-start">
          <div className="rounded-card border border-line bg-surface p-6 sm:p-7">
            <h2 className="font-display text-[28px] font-extrabold uppercase leading-none">
              Odaya katıl
            </h2>
            <p className="mt-2 text-[13px] text-dim">
              Odayı kuran arkadaşın sana 4 haneli bir kod verecek.
            </p>

            <form className="mt-6 flex flex-col gap-4" onSubmit={join}>
              <div>
                <label
                  className="mb-1.5 block font-mono text-[9.5px] tracking-[0.18em] text-mute"
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
                  placeholder="····"
                  className="tnum w-full rounded-card border border-line bg-bg px-3 py-3 text-center font-mono text-[30px] font-bold tracking-[0.3em] placeholder:text-line"
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block font-mono text-[9.5px] tracking-[0.18em] text-mute"
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
                  className="min-h-[44px] w-full rounded-card border border-line bg-bg px-3 py-2.5 text-[15px]"
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="font-mono text-[11px] text-accent"
                >
                  {error}
                </p>
              )}

              <Button type="submit" disabled={!canJoin}>
                {busy ? 'KATILIYOR' : 'ODAYA KATIL'}
              </Button>
            </form>
          </div>

          <div className="mt-4 rounded-card border border-dashed border-line p-6 sm:p-7">
            <h2 className="text-[14px] font-semibold">Kod yok mu?</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-dim">
              Sen kur. Hazır kategorilerden birini seç ya da kendi kelimelerini yaz, kodu
              arkadaşlarınla paylaş.
            </p>
            <Button variant="ghost" className="mt-4 w-full" onClick={() => router.push('/kur')}>
              YENİ ODA KUR
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
