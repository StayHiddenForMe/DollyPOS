import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

Base = declarative_base()

def init_engine():
    """Initializes database engine. Connects to PostgreSQL 16 if available, or falls back to local SQLite on fresh laptops."""
    hosts_to_try = [settings.DB_HOST]
    for h in ["127.0.0.1", "localhost"]:
        if h not in hosts_to_try:
            hosts_to_try.append(h)

    for host in hosts_to_try:
        try:
            db_url = f"postgresql://{settings.DB_USER}:{settings.DB_PASSWORD}@{host}:{settings.DB_PORT}/{settings.DB_NAME}"
            pg_engine = create_engine(
                db_url,
                pool_pre_ping=True,
                pool_size=10,
                max_overflow=20,
                echo=False,
                connect_args={"connect_timeout": 4}
            )
            with pg_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return pg_engine
        except Exception:
            continue
    # Fallback to local zero-configuration SQLite database
    if getattr(sys, "frozen", False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    db_path = os.path.join(base_dir, "dollypos_local.db")
    sqlite_url = f"sqlite:///{db_path}"
    sqlite_engine = create_engine(
        sqlite_url,
        connect_args={"check_same_thread": False},
        echo=False
    )
    return sqlite_engine

engine = init_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
