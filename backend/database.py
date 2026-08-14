import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Example fallback for local development if .env is missing
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "sqlite:///./fleet_app.db" # Defaulting to SQLite for easy initial setup, switch to Postgres/MySQL later
)

if SQLALCHEMY_DATABASE_URL.startswith("sqlite:///./") and "/" in SQLALCHEMY_DATABASE_URL[12:]:
    db_folder = os.path.dirname(SQLALCHEMY_DATABASE_URL[10:])
    if db_folder and not os.path.exists(db_folder):
        os.makedirs(db_folder, exist_ok=True)

# Connect args needed for SQLite
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
