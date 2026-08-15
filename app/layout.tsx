import type { Metadata } from 'next';
import { Saira_Condensed, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { VersionTag } from '@/components/ui/VersionTag';
import './globals.css';

// Degisken adlari "-src" ile biter: globals.css'teki @theme bunlari
// --font-display / --font-body / --font-mono olarak yeniden yayinlar ve
// boylece font-display, font-body, font-mono birer Tailwind utility'si olur.
// Ayni adi kullansaydik @theme kendi degerine referans verip donguye girerdi.
const display = Saira_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display-src',
  display: 'swap',
});

const body = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body-src',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono-src',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Bütçe Savaşları',
  description: 'Takımların sınırlı bütçeyle ürün kapmaya çalıştığı açık artırma oyunu.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        {children}
        <VersionTag />
      </body>
    </html>
  );
}
