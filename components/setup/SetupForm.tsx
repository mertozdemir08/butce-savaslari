'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  DEFAULT_BUDGET,
  DEFAULT_ITEM_LIMIT,
  DEFAULT_TURN_SECONDS,
  MAX_BUDGET,
  MAX_ITEM_LIMIT,
  MAX_TURN_SECONDS,
  MIN_BUDGET,
  MIN_ITEMS,
  MIN_ITEM_LIMIT,
  MIN_TURN_SECONDS,
} from '@/lib/game/constants';
import { PACKS, getPack } from '@/lib/packs';
import { parseItemLines, type DraftItem } from './itemLines';

export interface SetupValues {
  teamName: string;
  budget: number;
  itemLimit: number;
  turnSeconds: number;
  items: DraftItem[];
}

const field =
  'min-h-[44px] w-full rounded-card border border-line bg-surface ' +
  'px-3 py-2.5 text-[15px] text-text';
const label =
  'mb-1.5 block font-mono text-[9.5px] tracking-[0.18em] text-mute';
const chip =
  'cursor-pointer rounded-card border bg-surface px-3 py-2 text-left ' +
  'transition-transform duration-200 ease-out-soft active:scale-[0.98]';
const chipOn = 'border-accent';
const chipOff = 'border-line';

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
  /** null: kendi kategorin (metin alani). Aksi halde kuratorlu paket. */
  const [packId, setPackId] = useState<string | null>(null);
  const [itemText, setItemText] = useState('');

  const pack = packId ? getPack(packId) : undefined;
  const items: DraftItem[] = pack ? pack.items : parseItemLines(itemText);
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
            min={MIN_BUDGET}
            max={MAX_BUDGET}
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
            min={MIN_ITEM_LIMIT}
            max={MAX_ITEM_LIMIT}
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
            min={MIN_TURN_SECONDS}
            max={MAX_TURN_SECONDS}
            className={`${field} tnum`}
            value={turnSeconds}
            onChange={(e) => setTurnSeconds(Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <span className={label}>KATEGORİ</span>
        <div className="flex flex-wrap gap-2">
          {PACKS.map((p) => (
            <button
              key={p.id}
              type="button"
              data-testid="pack-option"
              aria-pressed={packId === p.id}
              onClick={() => setPackId(p.id)}
              className={`${chip} ${packId === p.id ? chipOn : chipOff}`}
            >
              <span className="block text-[13px] font-semibold">{p.name}</span>
              <span className="font-mono text-[9px] tracking-[0.12em] text-mute">
                {`${p.items.length} ÜRÜN`}
              </span>
            </button>
          ))}
          <button
            type="button"
            aria-pressed={packId === null}
            onClick={() => setPackId(null)}
            className={`${chip} ${packId === null ? chipOn : chipOff}`}
          >
            <span className="block text-[13px] font-semibold">Kendi kategorin</span>
            <span className="font-mono text-[9px] tracking-[0.12em] text-mute">
              KENDİN YAZ
            </span>
          </button>
        </div>
      </div>

      {pack ? (
        <div>
          <span className={label}>ÜRÜNLER</span>
          {/* Uzun kategorilerde form altindaki "ODAYI KUR" ekran disina
              tasiyordu: liste kendi icinde kayar, yukseklik sabit kalir. */}
          <ul
            data-testid="pack-item-list"
            className="max-h-[228px] overflow-y-auto border-y border-line"
          >
            {pack.items.map((item) => (
              <li
                key={item.name}
                data-testid="pack-item"
                className="border-b border-line-soft px-1 py-2 text-[14px] last:border-b-0"
              >
                {item.name}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 font-mono text-[10px] tracking-widest text-mute">
            {`HAZIR KATEGORİ · ${pack.items.length} ÜRÜN`}
          </p>
        </div>
      ) : (
        <div>
          <label className={label} htmlFor="items">
            ÜRÜNLER
          </label>
          <textarea
            id="items"
            rows={8}
            className={`${field} font-mono text-[13px]`}
            placeholder={'Ev\nAraba\nŞöhret'}
            value={itemText}
            onChange={(e) => setItemText(e.target.value)}
          />
          <p className="mt-1.5 font-mono text-[10px] tracking-widest text-mute">
            {`HER SATIR BİR ÜRÜN · ${items.length} ÜRÜN`}
            {!enoughItems && ` · EN AZ ${MIN_ITEMS} GEREKLİ`}
          </p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="font-mono text-[11px] text-accent"
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
