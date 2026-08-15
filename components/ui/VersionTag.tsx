/**
 * Ekranin sag alt kosesinde duran surum etiketi.
 *
 * Tek isi var: canlida hangi surumun kostugunu soylemek. Basarisiz bir
 * dagitimin sitede hicbir belirtisi yoktur — eski surum calismaya devam eder
 * ve her sey normal gorunur. Bu etiket o sessiz durumu bozar.
 *
 * Deger package.json'daki surumden gelir ve derleme aninda gomulur (bkz.
 * Dockerfile'daki APP_VERSION). Yerelde "dev" yazar. Yeni bir dagitimi
 * ayirt edebilmek icin package.json'daki surumu bump'lamak gerekir.
 */
const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';

export function VersionTag() {
  return (
    <span
      // Okuyucular icin gurultu, tiklamalari da engellememeli: yalnizca goz
      // icin duran bir isaret.
      aria-hidden
      className="pointer-events-none fixed bottom-1 right-1.5 z-50 select-none font-mono text-[8px] tracking-widest text-text opacity-25"
    >
      {VERSION}
    </span>
  );
}
