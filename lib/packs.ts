import hayatinTemelleri from '@/data/packs/hayatin-temelleri.json';
import kariyer from '@/data/packs/kariyer.json';
import superGucler from '@/data/packs/super-gucler.json';

export interface PackItem {
  name: string;
  /** Koke gore yol, orn. "/packs/hayatin-temelleri/ev.jpg". Yoksa bilet
   *  tipografik yedege duser. */
  imageUrl?: string;
}

export interface Pack {
  id: string;
  name: string;
  items: PackItem[];
}

/**
 * Kuratorlu kategoriler. Sistemdeki tek kalici veri budur.
 * Yeni kategori eklemek: data/packs/ altina bir JSON, gorseller
 * public/packs/<id>/ altina, sonra buraya import.
 */
export const PACKS: Pack[] = [hayatinTemelleri, superGucler, kariyer] as Pack[];

export function getPack(id: string): Pack | undefined {
  return PACKS.find((p) => p.id === id);
}

/** Paketi kurulum formunun metin alani bicimine cevirir: "Ad | gorsel-url". */
export function packToLines(pack: Pack): string {
  return pack.items
    .map((item) => (item.imageUrl ? `${item.name} | ${item.imageUrl}` : item.name))
    .join('\n');
}
