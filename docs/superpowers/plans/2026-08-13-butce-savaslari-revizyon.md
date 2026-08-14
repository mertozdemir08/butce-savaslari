# Bütçe Savaşları — Plan Revizyonu (barındırma değişikliği)

**Tarih:** 13 Ağustos 2026
**Önceki plan:** `2026-08-12-hero-bet.md` — Faz 1 (Task 1-7) geçerli ve tamamlandı.

---

## Ne değişti

Oyun **Vercel + Supabase** yerine **kendi VPS'te, Docker + Caddy** ile yayınlanacak. Adı **Bütçe Savaşları**.

Bu, mimariyi karmaşıklaştırmıyor; **sadeleştiriyor**. Supabase Realtime'a ihtiyaç duymamızın tek sebebi Vercel'in serverless fonksiyonlarının kalıcı WebSocket tutamamasıydı. Kendi sürecimiz sürekli ayakta olacağı için:

| Eskiden | Şimdi |
|---|---|
| Supabase Postgres + `rooms.state jsonb` | Bellekte `Map<string, Room>` |
| Supabase Realtime Broadcast | Kendi WebSocket sunucumuz |
| `version` sütunu + karşılaştır-ve-değiştir + yeniden deneme | Yok. Tek olay döngüsü aksiyonları zaten sıraya sokuyor |
| 8 HTTP route handler | Tek WebSocket, mesaj tipiyle ayrışıyor |
| Vercel dağıtımı | Dockerfile + compose + Caddy |

**Faz 1 (kural motoru) hiç etkilenmedi.** Motoru veritabanı ve ağdan bağımsız tutmanın karşılığı tam olarak bu.

**Faz 3 (arayüz, Task 12-20) da neredeyse etkilenmedi.** Bileşenler `useRoom`'un döndürdüğü `{ state, me, connection, clockOffsetMs, call }` sözleşmesinden besleniyor; taşıma katmanı değişti, sözleşme aynı kaldı.

### Geçersiz olan task'lar

Eski plandaki **Task 8, 9, 10, 11 ve 21** tamamen geçersiz. Yerlerine aşağıdaki 8R-11R ve 21R geçiyor. Task 19 (paketler) öne alınıp 11R oldu.

---

## Global kısıtlara eklenenler

- **Veritabanı yok.** Kalıcı tek veri `data/packs/*.json` ve `public/packs/` altındaki görseller.
- **Oyun durumu yalnızca bellekte.** Süreç yeniden başlarsa devam eden oyunlar sona erer; istemci "oda bulunamadı" gösterir.
- **Tek süreç varsayımı.** Yatay ölçekleme yok; oda defteri süreç belleğinde. Birden fazla kopya çalıştırılamaz (sticky session bile yetmez, oda tek bir süreçte yaşar).
- **Jetonlar asla yayınlanmaz.** `Room.tokens` hiçbir `state` mesajına girmez.
- **Alt alan adı.** `basePath` kullanılmaz; uygulama kendi alan adının kökünde çalışır.

---

## Task 8R: Bellekte oda defteri

**Files:** `lib/server/rooms.ts`, `lib/server/codes.ts` (mevcut, korunuyor) · Test: `tests/server/rooms.test.ts`

**Neden önce bu:** Ağ katmanından bağımsız, tamamen test edilebilir. Odaların ömrü, jeton doğrulaması ve motor çağrısı burada; WebSocket sadece bunu dışarı açacak.

**Üretilen arayüz:**

```ts
export interface Room {
  code: string;
  state: GameState;
  tokens: Record<TeamId, string>;
  lastActivityAt: number;
}

export interface RoomStore {
  create(input: CreateRoomInput): { room: Room; teamId: TeamId; token: string };
  get(code: string): Room | undefined;
  join(code: string, teamName: string): { teamId: TeamId; token: string } | RuleError;
  apply(code: string, teamId: TeamId | null, action: Action): ApplyOutcome;
  sweep(now: number): string[];   // silinen oda kodlarini doner
  size(): number;
}

export type ApplyOutcome =
  | { ok: true; room: Room; events: GameEvent[] }
  | { ok: false; error: RuleError };

export function createRoomStore(opts?: {
  now?: () => number;
  newId?: () => string;
  idleMs?: number;      // varsayilan 60 * 60 * 1000
  finishedMs?: number;  // varsayilan 10 * 60 * 1000
}): RoomStore;
```

**Kurallar:**

- `apply` kimlik doğrular: `teamId` gerektiren aksiyonlarda (`start`, `bid`, `pass`, `vote`) çağıran takım kimliği aksiyondaki takımla aynı olmalı. `timeout` ve `advance` kimlik istemez (idempotent, herkes çağırabilir).
- `apply` her başarılı çağrıda `lastActivityAt` günceller.
- `sweep` iki eşik uygular: `status === 'finished'` ve üzerinden `finishedMs` geçmiş odalar; ve durumu ne olursa olsun `idleMs` boyunca sessiz kalmış odalar.
- Kod çakışmasında `create` yeniden dener (en fazla 5 kez), sonra hata fırlatır.

**Testler (en az):** oda kurma ve kod benzersizliği · katılma ve jeton üretimi · yanlış jetonla aksiyonun reddi · başkasının adına aksiyon denemesinin reddi · `timeout`/`advance`'in kimliksiz kabulü · bitmiş odanın süpürülmesi · sessiz odanın süpürülmesi · aktif odanın süpürülmemesi.

---

## Task 9R: WebSocket protokolü ve sunucu

**Files:** `lib/server/protocol.ts`, `lib/server/wss.ts`, `server.ts` · Test: `tests/server/protocol.test.ts`

**Bağımlılık:** `npm install ws` + `npm install -D @types/ws`

**Protokol** (spec §4'teki tabloyla birebir):

```ts
export type ClientMessage =
  | { t: 'create'; teamName: string; budget: number; itemLimit: number; turnSeconds: number; items: RawItem[] }
  | { t: 'join'; code: string; teamName: string }
  | { t: 'resume'; code: string; teamId: string; token: string }
  | { t: 'start' }
  | { t: 'bid'; amount: number; turnSeq: number }
  | { t: 'pass'; turnSeq: number }
  | { t: 'timeout'; lotId: string; turnSeq: number }
  | { t: 'advance' }
  | { t: 'vote'; rankedTeamIds: string[] };

export type ServerMessage =
  | { t: 'welcome'; code: string; teamId: string; token: string }
  | { t: 'state'; state: GameState; serverTime: string }
  | { t: 'error'; code: RuleErrorCode | 'BAD_REQUEST' | 'ROOM_NOT_FOUND'; message: string };

export function parseClientMessage(raw: unknown): ClientMessage | null;
```

`parseClientMessage` savunma katmanıdır: tanınmayan `t`, eksik alan, yanlış tip → `null`. Testleri buna odaklanır (geçerli her mesaj tipi kabul edilir; bozuk JSON, bilinmeyen tip, eksik alan, yanlış tipte alan reddedilir).

**Sunucu davranışı:**

- Her bağlantı bir odaya bağlıdır; `create`/`join`/`resume` öncesi diğer mesajlar `ROOM_NOT_FOUND` ile reddedilir.
- Başarılı `create`/`join` → o bağlantıya `welcome`, ardından odaya `state` yayını.
- Başarılı aksiyon → odaya `state` yayını. Hata → yalnızca gönderene `error`.
- Bağlantı kapanınca soket odadan düşürülür; oyun durmaz.
- `server.ts` Next.js'i `next({ dev })` ile hazırlar, HTTP sunucusunu kurar, `/ws` yolunda WebSocket yükseltmesi yapar ve süpürücüyü `setInterval` ile başlatır.

---

## Task 10R: İstemci taşıma katmanı

**Files:** `lib/client/session.ts`, `lib/client/useRoom.ts` · Test: `tests/client/session.test.ts`

`session.ts` eski plandaki gibi (`saveSession`, `readSession`, `clearSession`), değişmedi.

`useRoom(code)` **aynı sözleşmeyi** döndürür, böylece Faz 3 bileşenleri etkilenmez:

```ts
{ state, me, connection, clockOffsetMs, notFound, call }
connection: 'connecting' | 'live' | 'reconnecting'
call: (t: ClientMessage['t'], payload?: object) => void
```

Farklar: HTTP `fetch` yok, tek bir WebSocket var. Bağlantı koparsa üstel geri çekilmeyle (1s, 2s, 4s, en fazla 10s) yeniden bağlanır ve `resume` mesajıyla oturumu geri alır. `clockOffsetMs` her `state` mesajındaki `serverTime` ile güncellenir.

---

## Task 11R: Küratörlü kategori paketleri

Eski plandaki Task 19 ile aynı: `data/packs/*.json`, `lib/packs.ts` (`PACKS`, `getPack`, `packToLines`) ve testleri. Öne alındı çünkü artık kalıcı verinin tamamı bu.

Ek: görseller `public/packs/<paket-id>/<urun>.jpg` altında durur; paket JSON'unda `imageUrl` alanı `/packs/hayat/ev.jpg` gibi köke göre bir yol olur.

---

## Task 21R: Docker, Caddy ve dağıtım

**Files:** `Dockerfile`, `docker-compose.yml`, `Caddyfile` örneği, `README.md`, `.dockerignore`

- `next.config.ts` içinde `output: 'standalone'`.
- Çok aşamalı Dockerfile: bağımlılıklar → derleme → `node:22-alpine` üzerinde ince çalışma imajı. `server.ts` derlenmiş haliyle giriş noktası.
- `docker-compose.yml`: tek servis, `restart: unless-stopped`, `PORT` ve `NODE_ENV` ortam değişkenleri, kalıcı birim **yok** (durum bellekte).
- Caddy örneği:

```
oyun.siteniz.com {
    reverse_proxy butce-app:3000
}
```

Caddy v2 WebSocket yükseltmesini kendiliğinden geçirir, ek yapılandırma gerekmez.

- README: yerel geliştirme, testler, mimari özeti, dağıtım adımları, ve "yeni kategori nasıl eklenir" bölümü.

**Doğrulama:** imaj yerel olarak derlenip çalıştırılır; iki tarayıcı sekmesiyle bir lot uçtan uca oynanır; konteyner yeniden başlatılıp odanın gerçekten kaybolduğu ve istemcinin "oda bulunamadı" gösterdiği görülür.
