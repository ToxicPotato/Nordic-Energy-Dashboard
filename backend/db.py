import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

def _db_url() -> str:
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    user = os.getenv("DB_USER", "app")
    pwd  = os.getenv("DB_PASS", "app")
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", "power")
    return f"postgresql+psycopg://{user}:{pwd}@{host}:{port}/{name}"

engine = create_engine(_db_url(), future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
