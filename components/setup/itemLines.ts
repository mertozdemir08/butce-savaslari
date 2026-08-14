export interface DraftItem {
  name: string;
  imageUrl?: string;
}

/**
 * Kurulum formunun metin alanini urun listesine cevirir.
 * Satir bicimi: "Ad | gorsel-url". Gorsel istege baglidir.
 */
export function parseItemLines(text: string): DraftItem[] {
  return text
    .split('\n')
    .map((line) => {
      const [rawName, rawUrl] = line.split('|');
      const name = (rawName ?? '').trim();
      if (!name) return null;
      const imageUrl = (rawUrl ?? '').trim();
      return imageUrl ? { name, imageUrl } : { name };
    })
    .filter((v): v is DraftItem => v !== null);
}
