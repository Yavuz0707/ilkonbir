# ⚽ İlk Onbir — Fantasy Lineup Builder

Dünya kulüplerinin **gerçek kadrolarıyla** ilk onbir kurma uygulaması. Bir takım seç,
gerçek dizilişini sahada gör, oyuncuları yedeklerle ya da başka takımların yıldızlarıyla
değiştir — toplam kadro piyasa değeri altta canlı olarak güncellensin.

| Katman | Teknoloji |
| --- | --- |
| Backend | Python 3.12+, FastAPI, SQLAlchemy (async), Alembic, APScheduler |
| Veritabanı | SQLite (geliştirme) / PostgreSQL (Docker) |
| Frontend | React (Vite), TailwindCSS v4, Framer Motion |
| Veri | API-Football (kadrolar, logolar) + transfermarkt-api (piyasa değerleri, rapidfuzz eşleştirme) |

## Hızlı Başlangıç (API anahtarı gerekmez)

Depo, 10 büyük kulübün (Galatasaray, Fenerbahçe, Real Madrid, Barcelona, Man City,
Liverpool, Arsenal, Bayern, PSG, Inter) 2025-26 kadrolarını içeren seed verisiyle gelir.

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
copy .env.example .env
.\.venv\Scripts\python -m app.seed          # demo verisini yükler
.\.venv\Scripts\python -m uvicorn app.main:app --reload
```

API: http://localhost:8000 — Swagger: http://localhost:8000/docs

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Uygulama: http://localhost:5173

## Gerçek Veriyle Çalıştırma

### API-Football (kadrolar, logolar, fotoğraflar)

1. [api-football.com](https://www.api-football.com/) üzerinden ücretsiz anahtar alın.
2. `backend/.env` içinde `API_FOOTBALL_KEY=...` girin; ligleri `API_FOOTBALL_LEAGUES`
   ile seçin (`203`=Süper Lig, `39`=Premier League, `140`=La Liga, `78`=Bundesliga,
   `135`=Serie A, `61`=Ligue 1).
3. Senkronizasyonu tetikleyin:

```powershell
curl -X POST http://localhost:8000/admin/sync -H "Content-Type: application/json" -d '{"clubs": true, "market_values": false}'
```

> Ücretsiz plan rate-limited'dır; tüm veriler DB'de saklanır, kullanıcı istekleri asla
> canlı API'ye gitmez. `ENABLE_SCHEDULER=true` ile her gece otomatik senkronizasyon açılır.

### transfermarkt-api (piyasa değerleri)

```powershell
docker compose up -d transfermarkt-api
curl -X POST http://localhost:8000/admin/sync -H "Content-Type: application/json" -d '{"clubs": false, "market_values": true}'
```

Oyuncular, isim benzerliği (rapidfuzz `token_set_ratio`) + kulüp kontrolüyle
Transfermarkt kayıtlarına eşleştirilir. Scraping tabanlı bir servis olduğu için
istekler kulüp başına aralıklı atılır ve yalnızca kişisel/eğitim amaçlı kullanım
hedeflenir.

### PostgreSQL'e geçiş

```powershell
docker compose up -d db
# backend/.env:
# DATABASE_URL=postgresql+asyncpg://ilkonbir:ilkonbir@localhost:5432/ilkonbir
cd backend
.\.venv\Scripts\alembic upgrade head
.\.venv\Scripts\python -m app.seed
```

## API Özeti

```
GET   /clubs?q=&league=&country=       kulüp listesi (arama/filtre)
GET   /clubs/{id}                      kulüp + kadro + teknik direktör
GET   /clubs/{id}/default-lineup       gerçek kadrodan otomatik ilk onbir (önizleme)
GET   /players/search?q=&position=&club_id=&exclude_club_id=
GET   /formations                      4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 3-4-3
POST  /lineups                         {club_id, formation_id?} → yeni diziliş
GET   /lineups/{id}                    diziliş detayı (slotlar + oyuncular)
PATCH /lineups/{id}/formation          {formation_id} — oyuncular rol uyumuyla taşınır
PATCH /lineups/{id}/slots/{slot_key}   {player_id} — sahadaki oyuncuysa takas edilir
GET   /lineups/{id}/summary            {total_market_value, player_count, formation}
POST  /admin/sync                      {clubs, market_values} (X-Admin-Token başlığı)
```

## Mimari Notlar

- **Varsayılan onbir**: kadro, formasyon slotlarına pozisyon uyum kademesi
  (tam detay eşleşmesi → aynı kanat → merkez) + piyasa değerine göre atanır
  (`app/services/lineup_service.py`).
- **Formasyon değişimi**: mevcut oyuncular önce aynı slot anahtarına, sonra rol
  uyumuna göre yeni dizilişe taşınır; frontend'de Framer Motion `layout`
  animasyonuyla kayarlar.
- **Kadro değeri**: backend SQL `SUM` ile döner; frontend ayrıca optimistic
  hesaplayıp sayıyı count-up animasyonuyla günceller.
- **Aynı oyuncu iki slotta olamaz**: sahadaki bir oyuncu başka slota seçilirse
  backend iki slotu takas eder; frontend aynı kuralı optimistic uygular.
