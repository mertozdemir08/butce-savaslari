'use client';

import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

const base =
  'inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-[4px] px-6 ' +
  'text-[11px] font-bold uppercase tracking-[0.11em] ' +
  'transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] ' +
  'disabled:pointer-events-none disabled:opacity-40';

// Beyaz "simdi sen oyna" demek. Kirmizi yalnizca baski anlatir,
// onay ya da basari icin ASLA kullanilmaz.
const variants: Record<Variant, string> = {
  primary: 'bg-[var(--color-text)] text-[var(--color-bg)]',
  ghost: 'border border-[var(--color-line)] text-[var(--color-dim)]',
  danger: 'bg-[var(--color-accent)] text-white',
};

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}
