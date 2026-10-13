from database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("Connected to database:", engine.url)
        # Check columns
        if engine.url.drivername.startswith("sqlite"):
            res = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            cols = [r[1] for r in res]
            print("Existing columns in users table:", cols)
            if "assigned_vehicle" not in cols:
                print("Adding assigned_vehicle column...")
                conn.execute(text("ALTER TABLE users ADD COLUMN assigned_vehicle VARCHAR(50)"))
                conn.commit()
                print("Column added successfully!")
            else:
                print("Column assigned_vehicle already exists.")
        else:
            # Postgres / MySQL
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_vehicle VARCHAR(50)"))
                conn.commit()
                print("Postgres column added/verified!")
            except Exception as e:
                print("Error or already exists:", e)

if __name__ == "__main__":
    migrate()
