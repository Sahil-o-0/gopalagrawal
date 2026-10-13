from database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("Connected to database:", engine.url)
        if engine.url.drivername.startswith("sqlite"):
            res = conn.execute(text("PRAGMA table_info(vehicle_emi)")).fetchall()
            cols = [r[1] for r in res]
            print("Existing columns in vehicle_emi table:", cols)
            
            if "registration_date" not in cols:
                print("Adding registration_date column...")
                conn.execute(text("ALTER TABLE vehicle_emi ADD COLUMN registration_date DATE"))
                conn.commit()
                print("registration_date added.")
                
            if "permit_valid_upto" not in cols:
                print("Adding permit_valid_upto column...")
                conn.execute(text("ALTER TABLE vehicle_emi ADD COLUMN permit_valid_upto DATE"))
                conn.commit()
                print("permit_valid_upto added.")

            if "permit_fee" not in cols:
                print("Adding permit_fee column...")
                conn.execute(text("ALTER TABLE vehicle_emi ADD COLUMN permit_fee FLOAT DEFAULT 0.0"))
                conn.commit()
                print("permit_fee added.")
        else:
            try:
                conn.execute(text("ALTER TABLE vehicle_emi ADD COLUMN IF NOT EXISTS registration_date DATE"))
                conn.execute(text("ALTER TABLE vehicle_emi ADD COLUMN IF NOT EXISTS permit_valid_upto DATE"))
                conn.execute(text("ALTER TABLE vehicle_emi ADD COLUMN IF NOT EXISTS permit_fee FLOAT DEFAULT 0.0"))
                conn.commit()
                print("Postgres columns added/verified!")
            except Exception as e:
                print("Error or already exists:", e)

if __name__ == "__main__":
    migrate()
