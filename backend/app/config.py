import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Dolly POS - Dolly Toys and Kids Wear"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database Settings
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "somesh123"
    DB_HOST: str = "localhost"
    DB_PORT: str = "5432"
    DB_NAME: str = "dollytoyskidswear"
    
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    # JWT Authentication
    SECRET_KEY: str = "dolly-toys-dhule-super-secure-secret-key-2026-xyz987654321"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days for POS cashier terminals
    
    # Store Default Info
    SHOP_NAME: str = "Dolly Toys and Kids Wear"
    SHOP_ADDRESS: str = "Agra Road, Near Mahatma Gandhi Statue, Dhule"
    SHOP_MOBILE: str = "7972558842"
    SHOP_UPI_ID: str = "7972558842@upi"
    
    # Printing Defaults
    DEFAULT_THERMAL_WIDTH: str = "80mm"  # or 58mm
    DEFAULT_LABEL_SIZE: str = "50x25mm"

    # Backup Defaults
    BACKUP_DIR: str = os.path.join(os.path.expanduser("~"), "DollyPOS_Backups")
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
