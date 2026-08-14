# Bütçe Savaşları — Tasarım Dokümanı

**Tarih:** 11 Ağustos 2026
**Durum:** Onaylandı, uygulama planı bekliyor

---

## 1. Ne yapıyoruz

2-4 takımın aynı anda, kendi cihazlarından oynadığı bir açık artırma oyunu. Ortaya sırayla ürünler (kelimeler) çıkar, takımlar sınırlı bütçeleriyle teklif verir, herkesin alabileceği ürün sayısı sabittir. Oyun sonunda 3 veya daha fazla takım varsa kimin koleksiyonunun daha iyi olduğu oylanır.

Kendi VPS'inizde, mevcut sitenizin bir alt alan adında yayınlanır. Herkes tarayıcıdan girer, kurulum gerektirmez.

### Kapsam dışı

Kullanıcı hesapları, kalıcı profiller, sıralama tabloları, sohbet, sesli iletişim, mobil uygulama, oyun içi satın alma. Odalar geçicidir; oyun bitince önemi kalmaz.

---

## 2. Oyun kuralları

### Kurulum

Odayı kuran kişi (host) şunları belirler ve kendisi de 1. takım olarak oynar:

| Ayar | Varsayılan |
|---|---|
| Başlangıç bütçesi (her takım aynı) | 10 |
| Takım başına ürün limiti | 5 |
| Tur süresi | 30 saniye |
| Ürün havuzu | Hazır paket seçilir ya da elle yazılır |

Takım sayısı 2-4. Oda kodu 4 karakter, karışabilen harfler (`0 O 1 I`) alfabeden çıkarılmıştır. Bir takım bir cihaz demektir; takım içindeki kişiler aynı ekrana bakar.

### Ürün havuzu

İki kaynak:

- **Hazır paketler.** Repo içinde statik JSON (`data/packs/*.json`), görselleri `public/packs/` altında. Küratörlü ve dengeli.
- **Host'un kendi listesi.** Her satır bir ürün, isteğe bağlı görsel URL'i (yapıştırma; dosya yükleme yok, depolama servisi gerekmiyor).

Oda kurulurken seçilen kaynağın ürünleri odanın kendi `items` tablosuna kopyalanır. Böylece paket sonradan değişse bile devam eden oyun etkilenmez.

Görsel isteğe bağlıdır. URL verilmemiş ürünlerde fotoğraf bandına lot numarası büyük tipografiyle oturur; düzen bozulmaz, boş kutu görünmez.

### Teklif turu

Ürünler sırayla lot olarak açılır. Sıra katı biçimde döner: sırası gelen takımın 30 saniyesi vardır, ya artırır ya pas geçer.

- **Asgari teklif:** mevcut teklif + 1. Açılışta 1.
- **Üst sınır:** takımın kalan bütçesi.
- **Pas eleyicidir.** Pas geçen takım o lottan tamamen çıkar, geri dönemez.

**Sıra ilerlemesi.** Koltuk sırasında, hâlâ oyunda olan ve mevcut teklifin sahibi olmayan bir sonraki takıma geçer. Böyle bir takım yoksa lot kapanır. Bu tek kural bütün uç durumları kapatır: en yüksek teklifi verenin sırası atlanır, tur ona döndüyse zaten herkes pas geçmiş demektir.

**Lot kapanışı.**

- Teklif varsa → mevcut teklif sahibine, o fiyata satılır.
- Hiç teklif yoksa → **en son pas geçen takıma bedelsiz (0) kalır.** O takımın ürün limiti doluysa koltuk sırasında yeri olan ilk takıma geçer.

Lot hiçbir zaman satılmadan kapanmaz. "En son pas geçen" belirlenirken lotun kütüğündeki son pas kaydı esas alınır:

- **Limiti dolu takımlar hesaba katılmaz.** Zaten ürün alamayacakları için lot açılışında elenirler ve devralamazlar.
- **Bütçesi yetmediği için elenen takımlar hesaba katılır.** Devir bedelsiz olduğu için parasız bir takım da lot alabilir; ürün limitinde yeri olması yeterlidir.

Bu kuralın oyun üzerindeki etkisi kasıtlıdır: kimse son pas geçen olmak istemez, çünkü kimsenin istemediği bir ürün beş slotundan birini bedavaya yakar.

### Kuralların ürettiği bir sonuç

Bir lotta uygun tek bir takım kaldığında (diğerlerinin hepsi limitini doldurmuşsa), o takım için pas geçmek teklif vermekten her zaman daha kârlıdır: pas geçerse tek pas geçen olur ve ürünü bedelsiz alır. Oyunun son turlarında slotu kalan son takım kalan ürünleri parasız toplar.

Bu, seçilen kuralların matematiksel sonucudur ve mevcut haliyle kabul edilmiştir. İstenmezse ileride şununla kapatılabilir: *tek uygun takım kalan lotlarda pas seçeneği kapatılır, takım asgari teklifi vermek zorunda kalır.* Bu değişiklik kural motorunda tek bir koşuldur.

**Otomatik pas.** Üç durumda takım kendi seçimi olmadan pas geçer ve kütüğe ayrı işaretlenir:

1. Ürün limitini doldurmuşsa (lot açılışında elenir, hiç sıraya girmez)
2. Kalan bütçesi asgari teklife yetmiyorsa
3. 30 saniye içinde hamle yapmamışsa

### Tur rotasyonu

Her lotun açılış sırası bir sonraki koltuğa kayar. Açılış sırasındaki takım uygun değilse (limiti dolu, parası yetmiyor) tur ilk uygun takımdan başlar, ancak işaretçi yine tam bir koltuk ilerler — rotasyon bozulmaz.

### Oyun sonu

Oyun şu iki durumdan biriyle biter:

- Ürün havuzu tükendi, ya da
- Hiçbir takım artık ürün alamıyor (herkesin limiti dolu).

Her lot açılmadan önce "ürün limitinde yeri olan en az bir takım var mı" kontrolü yapılır. Yoksa oyun biter.

### Oylama

**3 veya 4 takımda:** her takım kendisi dışındaki takımları en iyiden en kötüye sıralar. `k` rakip varsa 1. sıraya `k`, 2. sıraya `k-1` puan verilir. 4 takımda 3-2-1, 3 takımda 2-1. Kimse kendine oy veremez.

Beraberlik sırasıyla şunlarla çözülür: en çok birincilik oyu → kalan bütçe (yüksek olan) → ortak birincilik.

**2 takımda:** oylama yapılamaz (kimse kendine oy veremez). Oylama atlanır, iki koleksiyon yan yana sergilenir, resmî kazanan ilan edilmez.

---

## 3. Mimari

Tek bir Node süreci, kendi VPS'inizde Docker konteynerinde çalışır. Caddy alt alan adını bu konteynere yönlendirir ve TLS'i kendisi halleder.

```
Tarayıcı ──WebSocket──▶ Caddy (TLS) ──▶ Docker: butce-app
                                          │
                                          ├─ Next.js (arayüz)
                                          ├─ WebSocket sunucusu
                                          └─ Bellekte oda defteri
                                               │
                                               └─▶ odadaki herkese anlık görüntü
```

**Yığın:** Next.js (App Router, standalone çıktı) + TypeScript + Tailwind v4, özel bir Node sunucusu içinde. Docker + Caddy ile kendi VPS'te. Veritabanı yok.

**Neden veritabanı yok:** Kalıcı olması gereken tek veri küratörlü kategori paketleri; onlar da repo içinde statik JSON ve görsel dosyası. Oyun durumu geçicidir ve oyun bitince silinir.

**Neden WebSocket doğrudan bizde:** Süreç sürekli ayakta olduğu için kalıcı bağlantı tutabiliyor. Harici bir gerçek zamanlı servise (Supabase Realtime, Pusher) ihtiyaç yok.

**Eşzamanlılık:** Tek süreç, tek olay döngüsü. Aksiyonlar doğal olarak sıraya girer; karşılaştır-ve-değiştir, sürüm sayacı ya da yeniden deneme döngüsü gerekmez. Bu, mimarinin en büyük sadeleşmesi.

### Kritik ayrım: saf kural motoru

Değişmedi. Tüm oyun kuralları veritabanı ve ağdan bağımsız saf bir fonksiyonda yaşar:

```ts
applyAction(state: GameState, action: Action, ctx: Ctx)
  → { state: GameState, events: GameEvent[] } | { error: RuleError }
```

Bu ayrım sayesinde barındırma kararının değişmesi motoru hiç etkilemedi.

### 30 saniyelik sayacın otoritesi

`turn_deadline` sunucu zamanı olarak oda nesnesinde tutulur. Tarayıcı geri sayımı bu andan hesaplar; anlık görüntüyle sunucu saati de geldiği için istemci saat farkını düzeltir.

Süre dolduğunda istemci `timeout` mesajı gönderir ve elindeki `turn_seq` değerini ekler. Sunucu "süre gerçekten doldu mu ve sıra hâlâ bu mu" diye bakar; uymuyorsa hiçbir şey yapmaz. Dört istemci aynı anda gönderse bile otomatik pas bir kez uygulanır, çünkü tek süreçte mesajlar sırayla işlenir.

### Oda ömrü

Odalar bellekte bir sözlükte durur. Bir süpürücü düzenli aralıklarla çalışır ve bitmiş ya da uzun süredir sessiz odaları siler. Konteyner yeniden başlarsa devam eden oyunlar sona erer; istemciler "oda bulunamadı" görür ve yeni oda kurar. Bu kabul edilmiş bir taviz: oyunlar 15-25 dakika sürüyor ve dağıtım zamanını siz seçiyorsunuz.

### Modül sınırları

```
lib/game/          saf, bağımlılıksız (değişmedi)
lib/server/
  rooms.ts         bellekte oda defteri: kur, katıl, uygula, süpür
  protocol.ts      istemci ve sunucu mesaj tipleri
  wss.ts           WebSocket sunucusu, mesaj yönlendirme, yayın
  codes.ts         oda kodu üretimi ve jeton
server.ts          Next.js + WebSocket'i tek süreçte birleştiren giriş noktası
lib/client/
  session.ts       localStorage: oda kodu -> takım jetonu
  useRoom.ts       WebSocket bağlantısı, yeniden bağlanma, anlık görüntü
components/        sunum bileşenleri, anlık görüntüden beslenir
data/packs/        küratörlü kategori paketleri (JSON)
public/packs/      paket görselleri
```

## 4. Veri modeli

Kalıcı depolama yok. İki tür veri var:

**Küratörlü kategoriler (kalıcı, repo içinde).** `data/packs/*.json` dosyaları ve `public/packs/` altındaki görselleri. Yalnızca biz ekleriz; kategori eklemek bir commit ve yeniden dağıtım demektir. Host oyun kurarken bir paket seçer ya da kendi listesini yazar; her iki durumda da ürünler odanın kendi kopyasına geçer.

**Oda durumu (geçici, bellekte).** Süreçte bir sözlük:

```ts
Map<string /* oda kodu */, Room>

interface Room {
  state: GameState;                    // saf motorun durumu
  tokens: Record<TeamId, string>;      // cihaz-takım eşlemesi, asla yayınlanmaz
  sockets: Map<WebSocket, TeamId | null>;
  lastActivityAt: number;
}
```

Oda kodu 4 karakter, karışan harfler (`0 O 1 I`) çıkarılmış alfabeden.

### WebSocket protokolü

İstemciden sunucuya:

| Mesaj | Alanlar |
|---|---|
| `create` | takım adı, bütçe, ürün limiti, tur süresi, ürünler |
| `join` | oda kodu, takım adı |
| `resume` | oda kodu, takım id, jeton |
| `start` | — |
| `bid` | tutar, `turnSeq` |
| `pass` | `turnSeq` |
| `timeout` | `lotId`, `turnSeq` |
| `advance` | — |
| `vote` | sıralanmış takım id listesi |

Sunucudan istemciye:

| Mesaj | İçerik |
|---|---|
| `welcome` | oda kodu, takım id, jeton (yalnızca `create`/`join` sonrası) |
| `state` | tam anlık görüntü + sunucu saati |
| `error` | kural hatası kodu ve mesajı |

Her başarılı aksiyondan sonra sunucu odadaki tüm bağlantılara `state` yayınlar. Jetonlar hiçbir yayına dahil edilmez.

## 5. Görsel sistem

**Yön:** Koyu arena. Tek kırmızı vurgu baskıyı taşır (sayaç, mevcut teklif, eleme); beyaz "şimdi sen oyna" anını gösterir. Bu ikili ayrım oyun boyunca yüzlerce kez tekrarlanır ve tek bakışta okunur.

**İmza öğesi: lot bileti.** Perfore kenarlı, numaralı, kesikli ayraçlı fiziksel bir nesne. Satılınca damgalanır, kazananın şeridine kayar, koleksiyonda birikir ve final oylamasında yeniden görünür. Cesaret burada harcanır; ekranın geri kalanı sessiz durur.

**Özgünlük notu.** Yakın-siyah zemin + tek parlak vurgu kombinasyonu bugün AI üretimi arayüzlerin kümelendiği kalıplardan biridir. Bu tasarımın ayrıştığı yer palet değil kompozisyondur: perfore bilet, eleme durumunu taşıyan takım şeritleri, ürün limiti göstergesi. Bunlar bu oyuna özgüdür ve başka bir briefe taşınamaz.

### Renk

| Token | Değer | Kullanım |
|---|---|---|
| `--bg` | `#111111` | Zemin |
| `--surface` | `#191919` | Bilet, adımlayıcı, kart yüzeyleri |
| `--line` | `#2A2A2A` | Ana ayraçlar, kenarlıklar |
| `--line-soft` | `#1E1E1E` | Şerit araları |
| `--text` | `#EDEDED` | Ana metin, senin sıran, birincil buton zemini |
| `--text-dim` | `#9A9A9A` | İkincil metin |
| `--text-mute` | `#6E6E6E` | Etiketler, mono üst yazılar |
| `--accent` | `#FF4438` | Sayaç, mevcut teklif, elenme, tehdit |

`#FF4438` üzerine `#111111` kontrastı 5.5:1 — normal metin için de WCAG AA'yı geçer. Kırmızı yalnızca baskıyı anlatır; onay, başarı ve "sıra sende" için kullanılmaz. Tek vurgu rengi kuralı tüm ekranlarda geçerlidir.

### Tipografi

| Rol | Yüz | Kullanım |
|---|---|---|
| Display | Saira Condensed 700/800 | Ürün adı, sayaç, bütçe ve teklif rakamları |
| Gövde | Space Grotesk 400-700 | Arayüz metni, takım adları, butonlar |
| Utility | JetBrains Mono 400-700 | Etiketler, lot numarası, oda kodu, teklif kütüğü |

Rakamlar her yerde `font-variant-numeric: tabular-nums` — sayaç ve bütçe değişirken düzen oynamaz.

Fontlar `next/font` ile self-host edilir; üretimde harici `<link>` kullanılmaz.

### Biçim ve boşluk

Tek yarıçap sistemi: 4px (kartlar, butonlar, girişler). Şeritler keskin (0). Biletin perfore delikleri dairedir; bunlar nesnenin parçası, ayrı bir yarıçap sistemi değil.

Boşluk 4/8 tabanlı. Masaüstünde ana bölgeler arası ayrım kenarlıkla yapılır, kart gölgesiyle değil.

### Hareket

150-250ms, `cubic-bezier(0.16, 1, 0.3, 1)`. Yalnızca `transform` ve `opacity` animasyonlanır.

Hareket üç iş yapar, dekorasyon yoktur:

1. **Sıra devri** — şerit beyaza dönerken kısa bir geçiş, "sıra sana geldi" bilgisini taşır.
2. **Son 5 saniye** — sayaç nabız atar, kırmızı bar hızlanır.
3. **Kazanma anı** — turun tek koreografi anı ve oyunun duygusal zirvesi. Aşağıda ayrıntılı.

`prefers-reduced-motion` altında üçü de anlık duruma iner; bilgi kaybı olmaz, sadece geçişler atlanır.

#### Kazanma anı (zorunlu, sıralı koreografi)

Lot kapandığında sırayla, toplam yaklaşık 2 saniye:

1. **Kilit** (0ms) — sayaç durur, aksiyon çubuğu sönümlenir. Diğer takım şeritleri geri çekilir.
2. **Damga** (~120ms) — bilet hafifçe büyüyüp yerine oturur ve üstüne damga basılır: `SATILDI · TAKIM B · 4` ya da `BEDELSİZ · TAKIM A`. Damga hafif eğik oturur, tek darbe hissi verir.
3. **Kazananın anılması** (~500ms) — kazanan takımın şeridi beyaza döner, adı öne çıkar.
4. **Devir** (~800ms) — bilet küçülerek kazananın şeridine doğru bir yay çizerek kayar ve kaybolur.
5. **Sayaç** (~1200ms) — kazananın ürün limiti göstergesinde bir kutucuk dolar; bütçesi ödenen tutar kadar sayarak düşer (rakamlar tek tek iner, anında değişmez).
6. **Sonraki lot** (~2000ms) — yeni bilet alttan yükselerek girer, sayaç sıfırdan başlar.

Tüm adımlar `transform` ve `opacity` üzerinden çalışır, düzen yeniden hesaplanmaz. Koreografi kesintiye uğrarsa (bağlantı gecikmesi, sekme arkaya alınmışsa) doğrudan son duruma atlanır; oyun akışı animasyonu beklemez.

`prefers-reduced-motion` altında: damga ve sonuç metni yerinde belirir, bilet kaymaz, bütçe tek adımda güncellenir. Süre yine ~2 saniye kalır ki herkes sonucu okuyabilsin.

### Düzen

**Masaüstü öncelikli**, telefonda tam çalışır.

- **Masaüstü:** Üst şerit (lot no, sayaç, oda kodu). Sol sütun: yatay bilet (fotoğraf solda geniş bant) ve altında aksiyon çubuğu. Sağ ray: takım şeritleri dikey, içlerinde ürün limiti göstergesi (limit kadar kutucuk, dolular kazanılanlar), altında teklif kütüğü.
- **Telefon (< 768px):** Bilet dikeye döner, sağ ray altına iner, teklif kütüğü gizlenir, butonlar tam genişliğe yayılır.

Tam yükseklik gereken yerlerde `min-h-[100dvh]` kullanılır.

### Teklif girişi

Bütçeler düşüktür (varsayılan 10). Sayı klavyesi yerine adımlayıcı kullanılır: `− değer +` ve yanında `MAX` düğmesi. Değer asgari teklifte açılır, bütçeyi aşamaz.

Masaüstünde klavye asıl giriş yöntemidir: `↑` `↓` ayarlar, `Enter` teklif verir, `P` pas geçer. Kısayollar ekranda yazılıdır.

Sıra sende değilken adımlayıcı ve butonlar sönüktür; şeritler ve sayaç canlı kalır.

### Erişilebilirlik tabanı

Görünür klavye odağı, ekran okuyucu için anlamlı etiketler, renk tek başına bilgi taşımaz (elenen takım hem soluklaşır hem üstü çizilir hem `PAS` yazar), dokunma hedefleri en az 44px.

---

## 6. Ekran akışı

Tüm oyun tek bir route altındadır (`/oda/[kod]`) ve oda durumuna göre değişir.

| Ekran | İçerik |
|---|---|
| **Ana sayfa** | İki iş: oda kur, ya da kod girip katıl. Başka hiçbir şey yok. |
| **Oda kurulumu** | Takım adı, bütçe, ürün limiti, tur süresi, ürün kaynağı (paket seç ya da kendi listeni yaz; her satır bir ürün, isteğe bağlı görsel URL, anında önizleme). |
| **Lobi** | Oda kodu ekranın en büyük öğesi, tek tıkla kopyalanır. Katılan takımlar koltuk sırasıyla dizilir. Host en az 2 takım olunca başlatabilir, 4'te dolar. |
| **Açık artırma** | Bilet, takım şeritleri, sayaç, aksiyon çubuğu. |
| **Lot sonucu** | Bilete damga: `SATILDI · TAKIM B · 4` ya da `BEDELSİZ · TAKIM A`. Bilet kazananın şeridine kayar, limit göstergesinde bir kutucuk dolar. ~3 saniye, sonra sonraki lot. |
| **Oylama** | Sürükle-sırala. Kendi satırın kesikli çerçeveli ve devre dışı. Kaç takımın tamamladığı görünür. |
| **Sonuç** | Sıralama, puanlar, koleksiyonlar. 2 takımda oylama atlanır, doğrudan vitrin gelir. |

### Boş ve bekleme durumları

Tasarımın parçasıdır, sonradan eklenmez:

- Lobide tek takım varken: "Kodu paylaş, katılmalarını bekle"
- Ürün listesi eksikken: "En az 5 ürün gir"
- Oylamada: "3 takımdan 1'i tamamladı"
- Sıra başkasındayken: kimde olduğu ve ne kadar süre kaldığı

---

## 7. Bağlantı kopması ve hatalar

Takıma katılırken üretilen `session_token` tarayıcıda oda koduyla birlikte saklanır. Sekme kapanıp açılsa, telefon uyusa, sayfa yenilense — aynı jetonla girilip aynı takım olarak devam edilir.

**Oyun kimse için durmaz.** Bağlantısı kopan takımın sırası geldiğinde sayaç işler ve süre dolunca otomatik pas geçilir. Şeridinde bağlantı uyarısı görünür ama diğerleri beklemez. Bu kasıtlı bir karardır: bir kişinin interneti yüzünden oyunun kilitlenmesi, o kişinin bir turu kaçırmasından çok daha kötüdür.

Realtime bağlantısı düşerse istemci 3 saniyede bir anlık görüntü çekmeye geçer ve üstte ince bir uyarı şeridi çıkar. Bağlantı dönünce şerit kaybolur.

| Durum | Davranış |
|---|---|
| `turn_seq` uyuşmuyor | 409. İstemci anlık görüntüyü tazeler, "bu tur geçti" der. |
| Kural ihlali (asgariden düşük, bütçe üstü, sıra sende değil) | 422 + sebep. Adımlayıcının altında gösterilir. Arayüz bu değerleri zaten üretemez; bu savunma katmanıdır. |
| Oda yok / oyun başlamış / oda dolu | 404 veya 409. Katılma ekranında açık mesaj. |
| Host ayrıldı | Host yetkisi koltuk sırasındaki bir sonraki bağlı takıma geçer, oyun devam eder. |

---

## 8. Test stratejisi

Ağırlık saf kural motorundadır, çünkü riskin tamamı oradadır. Supabase'e hiç bağlanmadan çalışan senaryolar:

**Sıra ilerlemesi**
- Normal tur dönüşü
- Pas sonrası elenme, geri dönememe
- En yüksek teklif sahibinin sırasının atlanması

**Lot kapanışı**
- Teklifle satış
- Herkes pas geçince en son pas geçene bedelsiz devir
- Devralacak takımın limiti doluyken koltuk sırasında bir sonrakine kayma
- Lot açılmadan önce "yeri olan takım var mı" kontrolü

**Otomatik pas**
- Ürün limiti dolu (lot açılışında elenme)
- Bütçe asgari teklife yetmiyor
- Süre doldu

**Eşzamanlılık**
- Aynı zaman aşımının iki kez uygulanamaması
- Bayat `turn_seq` ile gelen isteğin reddi

**Rotasyon**
- Her lotta açılışın bir koltuk kayması
- Uygun olmayan açıcının rotasyonu bozmaması

**Oyun sonu**
- Ürünler bitince
- Herkes limitte

**Oylama**
- Puanlama (4 ve 3 takım)
- Kendine oy verememe
- Beraberlik sıralaması (birincilik oyu → kalan bütçe → ortak)

**Uç durumlar**
- 2 takımla oynanış ve vitrin ekranı
- Tek uygun takım kalması: pas geçtiğinde lotu bedelsiz alması
- Bütçesi 0 olan takımın bedelsiz lot alabilmesi
- Limiti dolu takımın devralamaması, sıranın bir sonrakine kayması

Route handler'lar ince olduğu için onlarda yalnızca sözleşme testi vardır: yanlış jeton reddediliyor mu, hata kodları doğru mu, yayın tetikleniyor mu.

Çok cihazlı akış için elle test: aynı tarayıcıda üç sekme, biri host.

---

## 9. Kararlar ve gerekçeleri

| Karar | Gerekçe |
|---|---|
| Oda kodu + herkes kendi cihazından | Uzaktan oynanabilirlik ve gizli teklif hazırlığı |
| Katı sıra, takım başına 30 sn | Adil ve anlaşılır; hızlı tıklayanın avantajı olmaz |
| 1 takım = 1 cihaz, host da oynar | En basit veri modeli, kimse oyun dışı kalmaz |
| Görseller URL ile | Depolama servisi ve kotası gerekmiyor |
| Sıralama oylaması | Tek oya göre çok daha az beraberlik |
| 2 takımda kazanan yok | Tarafsız oy verecek kimse yok; tartışmayı masaya bırakır |
| Asgari artış +1 | Bütçeler düşük (10 civarı), yüzde veya sabit adım fazla sert |
| Teklifsiz lot son pas geçene bedelsiz | Lot hep sahip bulur; "son pas geçen olma" gerilimi yaratır |
| Kendi VPS, Docker + Caddy | Barındırma sizde; Vercel'in serverless kısıtı ortadan kalkıyor |
| Veritabanı yok | Kalıcı tek veri küratörlü kategoriler; onlar da repo dosyası |
| Oyun durumu bellekte | Oyunlar geçici; yeniden başlatma devam eden oyunu bitirir, kabul edildi |
| Doğrudan WebSocket | Süreç sürekli ayakta; harici gerçek zamanlı servise gerek yok |
| Tek süreç, CAS yok | Olay döngüsü aksiyonları zaten sıraya sokuyor |
| Saf kural motoru | Riskin tamamı tek modülde ve tamamı test edilebilir |
| Masaüstü öncelikli | Asıl kullanım masa başı; telefon tam destekli |
| Adımlayıcı + MAX | Düşük bütçelerde sayı klavyesi yanlış araç |
