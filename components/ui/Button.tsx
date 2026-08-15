'use client';

import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

const base =
  'inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-card px-6 ' +
  'text-[11px] font-bold uppercase tracking-[0.11em] ' +
  'transition-transform duration-200 ease-out-soft active:scale-[0.98] ' +
  'disabled:pointer-events-none disabled:opacity-40';

// Beyaz "simdi sen oyna" demek. Kirmizi yalnizca baski anlatir,
// onay ya da basari icin ASLA kullanilmaz.
const variants: Record<Variant, string> = {
  primary: 'bg-text text-bg',
  ghost: 'border border-line text-dim',
  danger: 'bg-accent text-white',
};

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}
