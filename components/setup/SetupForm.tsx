'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  DEFAULT_BUDGET,
  DEFAULT_ITEM_LIMIT,
  DEFAULT_TURN_SECONDS,
  MIN_ITEMS,
} from '@/lib/game/constants';
import { PACKS, packToLines } from '@/lib/packs';
import { parseItemLines, type DraftItem } from './itemLines';

export interface SetupValues {
  teamName: string;
  budget: number;
  itemLimit: number;
  turnSeconds: number;
  items: DraftItem[];
}

const field =
  'min-h-[44px] w-full rounded-[4px] border border-[var(--color-line)] bg-[var(--color-surface)] ' +
  'px-3 py-2.5 text-[15px] text-[var(--color-text)]';
const label =
  'mb-1.5 block font-[family-name:var(--font-mono)] text-[9.5px] tracking-[0.18em] text-[var(--color-mute)]';

export function SetupForm({
  onSubmit,
  busy,
  error,
}: {
  onSubmit: (values: SetupValues) => void;
  busy: boolean;
  error: string | null;
}) {
  const [teamName, setTeamName] = useState('');
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [itemLimit, setItemLimit] = useState(DEFAULT_ITEM_LIMIT);
  const [turnSeconds, setTurnSeconds] = useState(DEFAULT_TURN_SECONDS);
  const [itemText, setItemText] = useState('');

  const items = parseItemLines(itemText);
  const enoughItems = items.length >= MIN_ITEMS;
  const ready = teamName.trim().length > 0 && enoughItems && !busy;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        onSubmit({ teamName: teamName.trim(), budget, itemLimit, turnSeconds, items });
      }}
    >
      <div>
        <label className={label} htmlFor="teamName">
          TAKIM ADIN
        </label>
        <input
          id="teamName"
          className={field}
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          maxLength={24}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label} htmlFor="budget">
            BÜTÇE
          </label>
          <input
            id="budget"
            type="number"
            min={1}
            max={9999}
            className={`${field} tnum`}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
          />
        </div>
        <div>
          <label className={label} htmlFor="itemLimit">
            ÜRÜN LİMİTİ
          </label>
          <input
            id="itemLimit"
            type="number"
            min={1}
            max={99}
            className={`${field} tnum`}
            value={itemLimit}
            onChange={(e) => setItemLimit(Number(e.target.value))}
          />
        </div>
        <div>
          <label className={label} htmlFor="turnSeconds">
            TUR SÜRESİ (SN)
          </label>
          <input
            id="turnSeconds"
            type="number"
            min={5}
            max={300}
            className={`${field} tnum`}
            value={turnSeconds}
            onChange={(e) => setTurnSeconds(Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <span className={label}>HAZIR KATEGORİ</span>
        <div className="flex flex-wrap gap-2">
          {PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              onClick={() => setItemText(packToLines(pack))}
              className="cursor-pointer rounded-[4px] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-left transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98]"
            >
              <span className="block text-[13px] font-semibold">{pack.name}</span>
              <span className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.12em] text-[var(--color-mute)]">
                {`${pack.items.length} ÜRÜN`}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.1em] text-[var(--color-mute)]">
          KATEGORİ SEÇİNCE AŞAĞIDAKİ LİSTEYE YAZILIR, SONRA DÜZENLEYEBİLİRSİN
        </p>
      </div>

      <div>
        <label className={label} htmlFor="items">
          ÜRÜNLER
        </label>
        <textarea
          id="items"
          rows={8}
          className={`${field} font-[family-name:var(--font-mono)] text-[13px]`}
          placeholder={'Ev\nAraba | https://ornek.test/araba.jpg\nŞöhret'}
          value={itemText}
          onChange={(e) => setItemText(e.target.value)}
        />
        <p className="mt-1.5 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.1em] text-[var(--color-mute)]">
          {`HER SATIR BİR ÜRÜN · GÖRSEL İÇİN: AD | URL · ${items.length} ÜRÜN`}
          {!enoughItems && ` · EN AZ ${MIN_ITEMS} GEREKLİ`}
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-accent)]"
        >
          {error}
        </p>
      )}

      <Button type="submit" disabled={!ready}>
        {busy ? 'ODA KURULUYOR' : 'ODAYI KUR'}
      </Button>
    </form>
  );
}
