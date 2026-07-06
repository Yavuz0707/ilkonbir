from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Veritabani: gelistirmede SQLite, Docker/prod'da PostgreSQL
    database_url: str = "sqlite+aiosqlite:///./ilkonbir.db"

    # API-Football (api-sports.io dogrudan ya da RapidAPI uzerinden)
    api_football_key: str | None = None
    api_football_base_url: str = "https://v3.football.api-sports.io"
    api_football_use_rapidapi: bool = False
    api_football_rapidapi_host: str = "api-football-v1.p.rapidapi.com"
    # Kulup/kadro senkronu icin lig ID'leri (API-Football): 203=Super Lig, 39=Premier League,
    # 140=La Liga, 78=Bundesliga, 135=Serie A, 61=Ligue 1
    api_football_leagues: str = "203,39,140,78,135,61"
    api_football_season: int = 2025

    # Gol/asist krallığı (top_stats) icin AYRI lig listesi — kulup sync'inden bagimsiz,
    # boylece UEFA kupasi ID'leri kulup tablosunu kirletmez.
    # 203=Super Lig, 2=Sampiyonlar Ligi, 3=Avrupa Ligi, 848=Konferans Ligi
    api_football_stat_leagues: str = "203,2,3,848"
    # Stat'lerin cekilecegi sezonlar (ucretsiz plan: 2022-2024). En yeni=varsayilan.
    api_football_stat_seasons: str = "2024,2023"

    # football-data.org — API-Football'un kilitlediği güncel sezona (2025-26)
    # erişim için ikinci kaynak. Sadece gol verisi var (asist yok).
    football_data_org_api_key: str | None = None
    football_data_org_base_url: str = "https://api.football-data.org/v4"
    # PL=Premier League, PD=La Liga, BL1=Bundesliga, SA=Serie A, FL1=Ligue 1, CL=Şampiyonlar Ligi
    football_data_org_competitions: str = "PL,PD,BL1,SA,FL1,CL"
    # ÖNEMLİ: season parametresi VERİLMEZSE API takvime göre otomatik sezon seçiyor
    # ve yaz aylarında (sezon arası) henüz başlamamış yeni sezona (0 sonuç) düşebiliyor.
    # Bu yüzden hedef sezon açıkça sabitleniyor; yeni sezon gerçekten başlayınca elle güncellenir.
    football_data_org_season: int = 2025

    # felipeall/transfermarkt-api servisi (docker-compose ile ayaga kalkar)
    transfermarkt_api_url: str = "http://localhost:8001"

    # Zamanlanmis senkronizasyon (APScheduler)
    enable_scheduler: bool = False
    sync_clubs_cron_hour: int = 3
    sync_market_values_cron_hour: int = 4

    # /admin/sync endpoint'i icin basit token korumasi (bos ise koruma yok)
    admin_token: str | None = None

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def league_ids(self) -> list[int]:
        return [int(x) for x in self.api_football_leagues.split(",") if x.strip()]

    @property
    def stat_league_ids(self) -> list[int]:
        return [int(x) for x in self.api_football_stat_leagues.split(",") if x.strip()]

    @property
    def stat_seasons(self) -> list[int]:
        return [int(x) for x in self.api_football_stat_seasons.split(",") if x.strip()]

    @property
    def football_data_org_competition_codes(self) -> list[str]:
        return [x.strip() for x in self.football_data_org_competitions.split(",") if x.strip()]

    @property
    def cors_origin_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
