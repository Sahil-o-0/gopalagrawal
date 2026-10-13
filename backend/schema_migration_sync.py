import os
import sqlite3
from database import engine, Base, SQLALCHEMY_DATABASE_URL
import models # imports site, user, trip, workforce
from models.user import User, UserRole
from models.site import Site
from core.security import get_password_hash

def get_sqlite_path():
    # If sqlite URL, extract local file path
    url = SQLALCHEMY_DATABASE_URL
    if url.startswith("sqlite:///"):
        path = url.replace("sqlite:///", "")
        return path
    return "fleet_app.db"

def sync_schema():
    print(f"Connecting to database via URL: {SQLALCHEMY_DATABASE_URL}")
    db_path = get_sqlite_path()
    print(f"Target SQLite path: {db_path}")

    # First, create any completely missing tables
    Base.metadata.create_all(bind=engine)
    print("Base.metadata.create_all completed.")

    # Now inspect columns for existing tables
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    for table_name, table in Base.metadata.tables.items():
        cursor.execute(f"PRAGMA table_info({table_name})")
        existing_cols = {row[1]: row for row in cursor.fetchall()}
        
        for col in table.columns:
            if col.name not in existing_cols:
                # Determine SQLite column type
                col_type = col.type.compile(engine.dialect)
                nullable = "" if col.nullable else ""
                sql = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}"
                try:
                    cursor.execute(sql)
                    print(f"Added column {table_name}.{col.name} ({col_type})")
                except Exception as e:
                    print(f"Could not add {table_name}.{col.name}: {e}")

    conn.commit()
    conn.close()

    # Seed users and sites using SQLAlchemy session
    from database import SessionLocal
    db = SessionLocal()
    try:
        users = [
            {"username": "admin", "password": "123", "role": UserRole.ADMIN},
            {"username": "manager", "password": "123", "role": UserRole.MANAGER},
            {"username": "staff", "password": "123", "role": UserRole.STAFF},
        ]
        for u in users:
            existing = db.query(User).filter(User.username == u["username"]).first()
            if not existing:
                user = User(
                    username=u["username"],
                    hashed_password=get_password_hash(u["password"]),
                    role=u["role"]
                )
                db.add(user)
                print(f"Created {u['role']} user: {u['username']}")

        default_sites = [
            {"name": "Main Site / HQ", "code": "HQ-01", "location": "Headquarters Yard"},
            {"name": "North Quarry Site", "code": "NQ-02", "location": "North Sector"},
            {"name": "West Yard Site", "code": "WY-03", "location": "West Industrial Zone"},
        ]
        for s in default_sites:
            existing = db.query(Site).filter(Site.name == s["name"]).first()
            if not existing:
                site = Site(name=s["name"], code=s["code"], location=s["location"], status="ACTIVE")
                db.add(site)
                print(f"Created site: {s['name']}")

        db.commit()
        print("Schema sync & seeding completed successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    sync_schema()
