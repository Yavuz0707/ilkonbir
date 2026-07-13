# İlk Onbir

İlk Onbir; gerçek kulüpler, güncel kadrolar, piyasa değerleri, istatistik panelleri ve futbol mini oyunlarını tek ekranda birleştiren modern bir fantasy football uygulamasıdır. Kullanıcı bir kulüp seçer, sistemin otomatik kurduğu ilk 11'i sahada görür, yedekten veya diğer kulüplerden oyuncu değiştirir, formasyonu değiştirir ve takım değerinin anlık güncellenmesini izler.

Uygulama auth gerektirmez. Her kulüp için oluşturulan lineup id'si tarayıcı `sessionStorage` içinde tutulur; bu yüzden deneyim hızlı, hafif ve misafir kullanıcıya uygundur.

## İçindekiler

- [Öne Çıkanlar](#öne-çıkanlar)
- [Ekran Görüntüleri](#ekran-görüntüleri)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Kurulum](#kurulum)
- [Çalıştırma](#çalıştırma)
- [Uygulama Bölümleri](#uygulama-bölümleri)
- [Veri Kaynakları ve Senkronizasyon](#veri-kaynakları-ve-senkronizasyon)
- [API Özeti](#api-özeti)
- [Proje Yapısı](#proje-yapısı)
- [Güvenlik Notları](#güvenlik-notları)

## Öne Çıkanlar

- Gerçek kulüpler, ligler, oyuncular, koçlar, logolar, fotoğraflar ve piyasa değerleri.
- Formasyon uyumlu otomatik ilk 11 üretimi.
- Saha üzerinde oyuncu seçme, slot değiştirme, yedekten oyuncu yerleştirme ve farklı kulüplerden oyuncu arama.
- 4-3-3, 4-4-2, 4-2-3-1, 3-5-2 ve 3-4-3 formasyon desteği.
- Kulüp detay sayfalarında kadro değeri, ortalama değer, oyuncu sayısı, lig bilgisi, piyasa değeri trendi, son transferler ve en değerli oyuncular.
- Ana sayfada kulüp arama, en değerli kulüpler, gol krallığı ve asist krallığı özetleri.
- Oyun merkezi: Kim Daha İyi?, Logo Bulmaca, Kim Bu Silüet?, İpucu Tahmin, Transfer Rotası ve Turnuva Oyunu.
- Dünya Kupası 2026 merkezi: puan durumu, fikstür, eleme ağacı, gol/asist krallığı, takımlar ve geçmiş şampiyonlar.
- İstatistik ve rekor merkezi: ödüller, turnuvalar, kulüpler, transfer rekorları ve İlk Onbir veritabanından hesaplanan rekorlar.
- Oyuncu merkezi: oyuncu arama, mevki filtresi, kulüp ve değer bilgisi, oyuncu detay sayfaları.
- Tema bazlı görsel dil: sayfa türüne göre renklenen navigasyon, kartlar, grafikler ve scrollbar'lar.
- FastAPI tabanlı async backend, React/Vite tabanlı animasyonlu frontend.

## Ekran Görüntüleri

> Galeri görselleri `app gallery/` klasöründe tutulur ve README içinde doğrudan gösterilir.

| Ana sayfa | Lider tabloları |
| --- | --- |
| ![Ana sayfa](app%20gallery/Screenshot%202026-07-13%20110331.png) | ![Gol ve asist krallığı](app%20gallery/Screenshot%202026-07-13%20110341.png) |

| Oyun merkezi | Kim Daha İyi - piyasa değeri |
| --- | --- |
| ![Oyun merkezi](app%20gallery/Screenshot%202026-07-13%20110352.png) | ![Kim Daha İyi piyasa değeri](app%20gallery/Screenshot%202026-07-13%20110403.png) |

| Kim Daha İyi - gol | Kim Daha İyi - asist |
| --- | --- |
| ![Kim Daha İyi gol modu](app%20gallery/Screenshot%202026-07-13%20110409.png) | ![Kim Daha İyi asist modu](app%20gallery/Screenshot%202026-07-13%20110417.png) |

| Kulüp listesi | Kulüp detay |
| --- | --- |
| ![Kulüp listesi](app%20gallery/Screenshot%202026-07-13%20110422.png) | ![Kulüp detay sayfası](app%20gallery/Screenshot%202026-07-13%20110457.png) |

| İlk 11 kurucu | Dünya Kupası giriş |
| --- | --- |
| ![İlk 11 kurucu](app%20gallery/Screenshot%202026-07-13%20110517.png) | ![Dünya Kupası giriş](app%20gallery/Screenshot%202026-07-13%20110537.png) |

| Dünya Kupası puan durumu | Dünya Kupası maçlar |
| --- | --- |
| ![Dünya Kupası puan durumu](app%20gallery/Screenshot%202026-07-13%20110627.png) | ![Dünya Kupası maçlar](app%20gallery/Screenshot%202026-07-13%20110642.png) |

| Dünya Kupası eleme ağacı | Dünya Kupası gol krallığı |
| --- | --- |
| ![Dünya Kupası eleme ağacı](app%20gallery/Screenshot%202026-07-13%20110707.png) | ![Dünya Kupası gol krallığı](app%20gallery/Screenshot%202026-07-13%20110724.png) |

| Dünya Kupası asist krallığı | İstatistikler |
| --- | --- |
| ![Dünya Kupası asist krallığı](app%20gallery/Screenshot%202026-07-13%20110729.png) | ![İstatistikler ana ekranı](app%20gallery/Screenshot%202026-07-13%20110742.png) |

| Oyuncu rekorları | Kulüp rekorları |
| --- | --- |
| ![Oyuncu rekorları](app%20gallery/Screenshot%202026-07-13%20110843.png) | ![Kulüp rekorları](app%20gallery/Screenshot%202026-07-13%20110850.png) |

| İlk Onbir verileri | Oyuncu merkezi |
| --- | --- |
| ![İlk Onbir verileri](app%20gallery/Screenshot%202026-07-13%20110901.png) | ![Oyuncu merkezi](app%20gallery/Screenshot%202026-07-13%20110926.png) |

## Teknoloji Yığını

| Katman | Teknolojiler |
| --- | --- |
| Backend | FastAPI, SQLAlchemy async, Pydantic, Alembic, APScheduler |
| Veritabanı | SQLite geliştirme varsayılanı, PostgreSQL Docker/prod alternatifi |
| Frontend | React 19, React Router 7, Vite 7, Tailwind CSS v4, Framer Motion |
| Veri | API-Football, football-data.org, local transfermarkt-api, statik rekor datası |
| Yardımcı servis | `transfermarkt-api/` Docker servisi |

## Kurulum

Gereksinimler:

- Python 3.11+
- Node.js 20+
- npm
- Docker Desktop, opsiyonel PostgreSQL ve transfermarkt-api için

Repository'yi klonladıktan sonra:

```powershell
git clone https://github.com/Yavuz0707/ilkonbir.git
cd ilkonbir
```

Backend bağımlılıkları:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
Copy-Item .env.example .env
```

Frontend bağımlılıkları:

```powershell
cd ..\frontend
npm install
Copy-Item .env.example .env.local
```

## Çalıştırma

Backend:

```powershell
cd backend
.\.venv\Scripts\python -m app.seed
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm run dev
```

Yerel adresler:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger/OpenAPI: http://localhost:8000/docs
- Health check: http://localhost:8000/health

Opsiyonel servisler:

```powershell
docker compose up -d db transfermarkt-api
```

PostgreSQL kullanmak için `backend/.env` içindeki `DATABASE_URL` değerini PostgreSQL bağlantısına çevirin ve migration çalıştırın:

```powershell
cd backend
.\.venv\Scripts\alembic upgrade head
```

## Uygulama Bölümleri

### Ana Sayfa

Ana sayfa uygulamanın hızlı kontrol paneli gibi çalışır. Kullanıcı kulüp arayabilir, öne çıkan kulüpleri görebilir, en değerli kulüpler listesine bakabilir ve gol/asist krallığı özetlerinden istatistik sayfalarına geçebilir.

### Kulüpler

`/kulupler` sayfası kulüpleri kart grid yapısında listeler. Arama ve lig filtresiyle kulüp bulunabilir. Kartlarda logo, lig, ülke ve piyasa değeri sinyalleri verilir.

`/kulupler/:clubId` kulüp detay sayfasında:

- Kadro değeri
- Ortalama oyuncu değeri
- Oyuncu sayısı
- Lig bilgisi
- Teknik direktör bilgisi
- Kadro değeri trend grafiği
- En değerli oyuncular
- Son transferler
- Kupa/başarı bağlantıları

görüntülenir.

### İlk 11 Kurucu

`/club/:clubId` tam ekran saha deneyimidir. Uygulama kulübün kadrosundan varsayılan bir ilk 11 kurar. Kullanıcı:

- Formasyon değiştirebilir.
- Saha slotuna tıklayıp oyuncu değiştirebilir.
- Yedek listesinden oyuncu seçip sahaya yerleştirebilir.
- Aynı kulüp içinden veya diğer kulüplerden oyuncu arayabilir.
- Oyuncu swap işlemlerini optimistic UI ile anında görebilir.
- Kadro değerinin değişimini canlı takip edebilir.

Lineup id'si `sessionStorage` içinde `ilkonbir-lineup-{clubId}` anahtarıyla saklanır. Böylece kullanıcı aynı kulübe döndüğünde kendi düzenlediği kadroyu görür.

### Oyunlar

`/oyunlar` merkezi altı farklı oyun modunu toplar:

- **Kim Daha İyi?**: İki oyuncuyu piyasa değeri, kayıtlı gol veya kayıtlı asist modunda karşılaştırır.
- **Logo Bulmaca**: Kulüp logosundan doğru kulübü tahmin ettiren 10 turluk quiz.
- **Kim Bu Silüet?**: Oyuncu fotoğrafı/silüeti üzerinden tahmin oyunu.
- **İpucu Tahmin**: Oyuncuyu üç ipucu üzerinden bulma modu.
- **Transfer Rotası**: Oyuncunun kariyer rotasından gizli oyuncuyu tahmin etme oyunu.
- **Turnuva Oyunu**: Süper Lig kulüpleri veya oyuncularla eleme formatında seçim oyunu.

Oyun skorları tarayıcı tarafında tutulur; en iyi skorlar local deneyimi güçlendirmek için korunur.

### Dünya Kupası

`/dunya-kupasi` sayfası 2026 Dünya Kupası için ayrı bir merkezdir. Sekmeler:

- Puan durumu
- Maçlar ve sonuçlar
- Eleme ağacı
- Gol krallığı
- Asist krallığı
- Takımlar
- Geçmiş şampiyonlar

Backend farklı veri sağlayıcılarından gelen yanıtları normalize eder. Veri sağlayıcısı uygun değilse sayfa kullanıcıya boş/hazır değil durumunu düzgün gösterir.

### İstatistikler ve Rekorlar

`/istatistikler` ve `/istatistikler/rekorlar` sayfaları statik rekor datası ile İlk Onbir veritabanından hesaplanan kayıtları bir araya getirir.

Kategoriler:

- Tüm rekorlar
- Ödüller
- Turnuvalar
- Kulüpler
- Transferler
- İlk Onbir verileri

Bu bölümde kaynak bilgileri, rekor liderleri, açıklamalar, görseller ve doğrulama durumları gösterilir.

### Oyuncu Merkezi

`/oyuncular` sayfası oyuncu arama ve filtreleme ekranıdır. Kullanıcı:

- İsme göre arama yapabilir.
- Mevkiye göre filtreleyebilir.
- Oyuncunun kulübünü ve piyasa değerini görebilir.
- Detay sayfasına geçebilir.

`/oyuncular/:playerId` detay sayfası oyuncu bilgilerini, kulüp bağlantısını, piyasa değerini ve kupa/başarı verilerini gösterir.

## Veri Kaynakları ve Senkronizasyon

### API-Football

API-Football özellikle Süper Lig kulüpleri, kadroları, teknik direktörleri, oyuncu fotoğrafları, kupa verileri ve seçili gol/asist istatistikleri için kullanılır.

Önemli notlar:

- Kulüp/kadro senkronu ile istatistik lig listesi ayrı tutulur.
- UEFA kupası lig id'leri kulüp senkronuna eklenmemelidir; aksi halde phantom kulüpler oluşabilir.
- Ücretsiz planda `/players/topscorers` ve `/players/topassists` sezonları sınırlıdır.
- `/players/squads` ve `/coachs` endpointleri aynı sezon kısıtına tabi değildir.

### football-data.org

football-data.org, API-Football'un güncel sezon erişiminin yetersiz kaldığı yabancı ligler için kullanılır:

- Premier League
- La Liga
- Bundesliga
- Serie A
- Ligue 1
- Champions League istatistikleri

Yeni senkron kodlarında `season=` parametresi açıkça verilmelidir.

### transfermarkt-api

Local `transfermarkt-api` servisi:

- Kulüp eşleştirme
- Oyuncu eşleştirme
- Piyasa değerleri
- Kulüp piyasa değeri geçmişi
- Oyuncu transfer geçmişi

için kullanılır.

### Statik Rekor Datası

`backend/app/data/football_records.json` dosyası futbol rekorlarını, kaynaklarını, liderlerini ve görsel referanslarını barındırır. Frontend bu verileri `/records` endpointleri üzerinden gösterir.

### Senkron Komutları

Backend içinden kullanılabilecek temel scriptler:

```powershell
cd backend
.\.venv\Scripts\python run_full_clubs_sync.py
.\.venv\Scripts\python run_foreign_clubs_sync.py
.\.venv\Scripts\python run_fdo_sync.py
.\.venv\Scripts\python run_trophy_sync.py
.\.venv\Scripts\python run_transfer_history_sync.py
.\.venv\Scripts\python run_retry_unmatched_clubs.py
.\.venv\Scripts\python cleanup_duplicate_clubs.py
```

Admin endpoint:

```powershell
curl -X POST http://localhost:8000/admin/sync `
  -H "Content-Type: application/json" `
  -d '{"clubs": true, "market_values": true, "top_stats": false, "football_data_org": false, "football_data_org_clubs": false}'
```

Uzun süren işler için standalone scriptler tercih edilmelidir. `uvicorn --reload` açıkken backend `.py` dosyası değişirse çalışan background sync sessizce kesilebilir.

## API Özeti

### Clubs

```text
GET /clubs
GET /clubs/{club_id}
GET /clubs/{club_id}/stats
GET /clubs/{club_id}/default-lineup
GET /clubs/coaches/{coach_id}/trophies
```

### Players

```text
GET /players/search
GET /players/{player_id}
GET /players/{player_id}/trophies
```

### Formations ve Lineups

```text
GET   /formations
POST  /lineups
GET   /lineups/{lineup_id}
PATCH /lineups/{lineup_id}/formation
PATCH /lineups/{lineup_id}/slots/{slot_key}
GET   /lineups/{lineup_id}/summary
```

### Stats ve Records

```text
GET /stats/competitions
GET /stats/top-scorers
GET /stats/top-assists
GET /stats/most-valuable-clubs
GET /stats/most-valuable-players

GET /records
GET /records/categories
GET /records/search
GET /records/group/{group_id}
GET /records/ilkonbir/computed
GET /records/{record_id}
```

### Games

```text
GET  /games/higher-lower/next
GET  /games/logo-quiz/next
GET  /games/silhouette/next
GET  /games/clue-guess/next
POST /games/clue-guess/answer
GET  /games/transfer-route/next
GET  /games/tournament/superlig-clubs
GET  /games/tournament/players
```

### World Cup

```text
GET /world-cup/2026/standings
GET /world-cup/2026/fixtures
GET /world-cup/2026/rounds
GET /world-cup/2026/bracket
GET /world-cup/2026/top-scorers
GET /world-cup/2026/top-assists
GET /world-cup/2026/teams
GET /world-cup/history/winners
```

### Admin

```text
POST /admin/sync
```

`ADMIN_TOKEN` tanımlıysa bu endpoint `x-admin-token` header'ı ister.

## Proje Yapısı

```text
ilkonbir/
├─ backend/
│  ├─ app/
│  │  ├─ routers/          # FastAPI route modülleri
│  │  ├─ services/         # veri sağlayıcıları, sync ve domain servisleri
│  │  ├─ data/             # statik rekor datası
│  │  ├─ models.py         # SQLAlchemy modelleri
│  │  ├─ schemas.py        # Pydantic şemaları
│  │  ├─ config.py         # env tabanlı ayarlar
│  │  └─ main.py           # FastAPI app
│  ├─ alembic/             # migration altyapısı
│  └─ run_*.py             # standalone sync scriptleri
├─ frontend/
│  ├─ src/
│  │  ├─ components/       # ortak UI bileşenleri
│  │  ├─ pages/            # route sayfaları
│  │  ├─ utils/            # format ve tema yardımcıları
│  │  ├─ api.js            # frontend API istemcisi
│  │  └─ index.css         # Tailwind v4 tema ve global stiller
│  └─ public/records/      # rekor görselleri
├─ transfermarkt-api/      # local Transfermarkt API servisi
├─ app gallery/            # README ekran görüntüleri
└─ docker-compose.yml
```

## Mimari Notlar

- `Formation.position_slots`, saha slotlarını JSON içinde `{key, label, role, x, y}` formatında saklar.
- Frontend sahayı generic render eder; yeni formasyon eklemek için backend formasyon datası yeterlidir.
- Varsayılan kadro kurma algoritması oyuncunun Türkçe `detail_position` değerini slot `label` değeriyle eşleştirir.
- Formasyon değişiminde önce aynı slot key korunur, sonra rol uyumlu slotlara remap yapılır.
- Squad sync diff tabanlıdır; kaynakta artık bulunmayan oyuncular silinir ve önce bağlı lineup slotları null'lanır.
- API-Football ve football-data.org id alanları ayrıdır: `external_api_football_id` ve `external_football_data_org_id`.
- `PlayerSeasonStat.source`, farklı sağlayıcıların lig id çakışmalarını güvenli şekilde ayırır.
- Transfer geçmişlerinde `Transfer.source` alanı API-Football ve Transfermarkt kayıtlarını ayırır.

## Geliştirme ve Doğrulama

Bu repoda şu an ayrı bir test suite veya linter yapılandırması yoktur. Değişikliklerden sonra pratik doğrulama:

```powershell
cd frontend
npm run build
```

```powershell
cd backend
.\.venv\Scripts\python -m compileall app
```

Ardından backend ve frontend dev server'larını çalıştırıp değişen sayfa veya endpoint elle kontrol edilmelidir.

## Güvenlik Notları

- `backend/.env`, `.env` ve `frontend/.env.local` git'e eklenmemelidir.
- API key değerleri yalnızca local env dosyalarında veya deployment secret store içinde tutulmalıdır.
- Google/Gemini key backend tarafında `GOOGLE_API_KEY` veya `GEMINI_API_KEY` olarak okunabilir; frontend tarafına `VITE_*` ile taşınmamalıdır.
- `ADMIN_TOKEN` tanımlanırsa `/admin/sync` endpoint'i token korumalı çalışır.
- Gerçek credential içeren dosyalar yerine `.env.example` dosyaları paylaşılır.

## Lisans ve Kullanım

Bu proje geliştirme amaçlı bir fantasy football ve futbol veri arayüzüdür. Harici veri sağlayıcılarının kullanım koşulları ve kota limitleri ayrıca dikkate alınmalıdır.
