# Bütçe Savaşları

Aynı odadaki takımların sabit bir bütçeyle sırayla ürünlere açık artırma yaptığı,
gerçek zamanlı, tarayıcıdan oynanan bir parti oyunu. Herkes kendi telefonundan
katılır; bir oda kodu yeter.

---

## Hızlı başlangıç (yerel geliştirme)

```bash
npm install
npm run dev            # http://localhost:3000
```

`npm run dev`, Next'in kendi `next dev` komutunu değil, `server.ts` dosyasını
`tsx watch` ile çalıştırır — WebSocket sunucusu aynı süreçte yaşadığı için.

Üretim moduna yakın bir çalıştırma:

```bash
npm run build
NODE_ENV=production PORT=3131 npx tsx server.ts
```

### Doğrulama

```bash
npm test               # birim testleri (Vitest)
npx tsc --noEmit       # tip denetimi
npm run build          # Next derlemesi
```

---

## Mimari

Tek Node süreci, tek olay döngüsü. **Veritabanı yok.** Oyun durumunun tamamı
bellekte bir `Map` içinde durur; süreç yeniden başlarsa açık odalar kaybolur.
Bu bilinçli bir tercih: oyunlar tek oturumluk ve kısa.

```
server.ts                 HTTP + WebSocket'i tek sunucuda birleştirir
  lib/server/wss.ts       /ws yükseltmelerini karşılar (Next HMR soketine dokunmaz)
  lib/server/dispatch.ts  gelen mesajı işler; soket bilmez, {reply, broadcast, attach} döner
  lib/server/protocol.ts  istemci/sunucu mesaj şemaları
  lib/server/rooms.ts     bellekteki oda defteri
  lib/server/codes.ts     oda kodu üretimi
  lib/server/shuffle.ts   oyun kurulurken ürün sırasını karıştırır
  lib/server/tick.ts      sunucunun kendi saati: tur süresi ve sonuç geçişi

  lib/game/               SAF oyun motoru — ağ, zaman, rastgelelik dışarıdan gelir
    types.ts              durum ve eylem tipleri
    rules.ts              eylem indirgeyici (reducer)
    lot.ts                tek bir ürünün açılması/kapanması
    scoring.ts            oylama ve nihai sıralama
    helpers.ts constants.ts index.ts

  lib/client/
    session.ts            localStorage'daki oturum jetonu
    socket.ts             geri çekilmeli yeniden bağlanan soket
    enter.ts              oda kur / odaya katıl (tek seferlik istek-yanıt)
    useRoom.ts            React tutkalı: resume + anlık görüntü + saat farkı

  app/                    3 rota: ana sayfa, /kur, /oda/[code]
  components/             setup, lobby, auction, vote, result ekranları
  data/packs/*.json       küratörlü kategoriler — sistemdeki tek kalıcı veri
  public/packs/<id>/      o kategorinin görselleri
```

Motor saf olduğu için oyun kurallarının tamamı ağ olmadan test edilebilir;
`tests/game/` altındaki testler bunu yapar.

Zaman sunucuda yürür. Tur süresinin dolması ve sonuç ekranından sonraki ürüne
geçiş yarım saniyede bir `tickRooms` ile tetiklenir; tarayıcıların gönderdiği
`timeout`/`advance` mesajları yalnızca yedektir. Aksi halde bütün oyuncular
sekmeyi arka plana aldığında oyun olduğu yerde donardı — telefonlar arka
plandaki zamanlayıcıları kısar.

### Sınırlar

Sunucu, kendi arayüzümüzden gelmeyen istekleri de karşılamak zorunda olduğu
için bütün girdi sınırları `lib/server/protocol.ts` içinde tekrar denetlenir.
Değerler `lib/game/constants.ts` içinde tek yerde durur:

| Sınır                    | Değer                     |
|--------------------------|---------------------------|
| Bütçe                    | 1 – 9999                  |
| Ürün limiti              | 1 – 99                    |
| Tur süresi               | 5 – 300 sn                |
| Bir oyundaki ürün sayısı | en fazla 200              |
| Ürün adı                 | 60 karaktere kırpılır     |
| Takım adı                | 24 karakter               |
| WebSocket çerçevesi      | 256 KB                    |
| Aynı anda açık oda       | 200 (`lib/server/rooms.ts`)|

Oda sayısı üst sınıra ulaştığında yeni kurulum `SERVER_BUSY` ile reddedilir.
Bağlantılar 30 saniyede bir ping alır; pong gelmeyen soket kapatılır, böylece
mobil şebeke düştüğünde takım "bağlı" görünmeye devam etmez.

---

## Dağıtım

Ubuntu sunucuda Docker ile çalışır. Dışarıya port açmaz; tek giriş, aynı
Docker ağındaki Caddy konteyneridir. TLS'i Caddy kendi halleder.

### 1. DNS

Alan adı için VPS'in IPv4 adresine bir `A` kaydı açın:

```
butcesavaslari    A    <VPS_IP>
```

Yayılmasını doğrulayın — Caddy sertifikayı ancak kayıt görünürse alabilir:

```bash
dig +short butcesavaslari.valientedyazilim.com
```

### 2. Depoyu sunucuya alın

Depo private ise sunucuya salt okunur bir **deploy key** koyun (hesabın
tamamına erişen bir token'dan daha dar bir yetki):

```bash
ssh-keygen -t ed25519 -C "vps-butce" -f ~/.ssh/butce_deploy -N ""
cat ~/.ssh/butce_deploy.pub
# Bu anahtarı GitHub'da: repo > Settings > Deploy keys > Add deploy key
# ("Allow write access" işaretlenmez.)

cat >> ~/.ssh/config <<'EOF'
Host github-butce
    HostName github.com
    User git
    IdentityFile ~/.ssh/butce_deploy
EOF

git clone github-butce:mertozdemir08/hero-bet.git /opt/butce-savaslari
```

### 3. Caddy'nin ağını bulun

Uygulama, Caddy'nin bulunduğu ağa katılmalı; yoksa Caddy `butce-app` adını
çözemez.

```bash
docker ps --format '{{.Names}}'                      # Caddy konteynerinin adı
docker inspect <caddy-konteyneri> \
  --format '{{range $n, $_ := .NetworkSettings.Networks}}{{$n}}{{"\n"}}{{end}}'
```

Çıkan ağ adını `CADDY_NETWORK` ile geçin (varsayılan `caddy_default`):

```bash
cd /opt/butce-savaslari
echo "CADDY_NETWORK=<ag-adi>" > .env
docker compose up -d --build
```

`.env` dosyası `.gitignore` kapsamındadır, depoya girmez.

### 4. Caddy'ye site bloğunu ekleyin

Caddy'nin kendi `Caddyfile`'ına ekleyin (bu depodaki `Caddyfile` yalnızca
kopyalanacak örnektir):

```
butcesavaslari.valientedyazilim.com {
    reverse_proxy butce-app:3000
}
```

Sonra yeniden yükleyin — bu, çalışan siteleri düşürmez:

```bash
docker exec <caddy-konteyneri> caddy reload --config /etc/caddy/Caddyfile
```

Caddy v2 WebSocket yükseltmesini kendiliğinden geçirir; `/ws` için ek
yapılandırma gerekmez.

### 5. Doğrulama

```bash
docker compose logs -f app        # "Bütçe Savaşları hazır" satırı
curl -I https://butcesavaslari.valientedyazilim.com
```

Tarayıcıda bir oda kurup ikinci bir sekmeden koda katılın; teklif verildiğinde
diğer sekmenin anında güncellenmesi WebSocket'in vekil arkasından geçtiğini
gösterir.

**Güncelleme:** `git pull && docker compose up -d --build`. Bu, çalışan tüm
odaları düşürür — durum bellekte olduğu için kaçınılmaz. Kimse oynamıyorken
yapın.

### Ortam değişkenleri

| Değişken   | Varsayılan   | Açıklama                         |
|------------|--------------|----------------------------------|
| `PORT`     | `3000`       | HTTP + WebSocket portu           |
| `HOST`     | `0.0.0.0`    | Dinlenen arayüz                  |
| `NODE_ENV` | —            | `production` olmalı              |

Başka gizli anahtar yok.

---

## Yeni kategori nasıl eklenir

1. `data/packs/<kategori-id>.json` dosyasını oluşturun:

```json
{
  "id": "kategori-id",
  "name": "Kategorinin Görünen Adı",
  "items": [
    { "name": "Ürün Adı", "imageUrl": "/packs/kategori-id/urun.webp" }
  ]
}
```

2. Görselleri `public/packs/<kategori-id>/` altına koyun. `imageUrl` alanı köke
   göre bir yoldur. Alan yoksa bilet tipografik yedeğe düşer, kırılmaz.
3. `lib/packs.ts` içinde JSON'u import edip `PACKS` dizisine ekleyin.
4. `npm test` çalıştırın — `tests/packs.test.ts` yapıyı doğrular.

Ürün sırası oyun kurulurken sunucuda karıştırılır; JSON'daki sıra oyun içi sırayı
belirlemez.
