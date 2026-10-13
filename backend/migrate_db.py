import sqlite3
import os
import database

# Use database engine connection to alter table
try:
    from sqlalchemy import text
    with database.engine.connect() as conn:
        conn.execute(text("ALTER TABLE login_otps ADD COLUMN firebase_verification_id VARCHAR(255);"))
        conn.commit()
        print("SQLAlchemy migration successful: added firebase_verification_id to login_otps")
except Exception as e:
    print("SQLAlchemy migration result:", e)

# Also direct SQLite file check
for root, dirs, files in os.walk("/app"):
    for f in files:
        if f.endswith(".db"):
            db_path = os.path.join(root, f)
            print("Checking direct sqlite file:", db_path)
            try:
                conn = sqlite3.connect(db_path)
                conn.execute("ALTER TABLE login_otps ADD COLUMN firebase_verification_id VARCHAR(255);")
                conn.commit()
                conn.close()
                print("Direct SQLite alter success for:", db_path)
            except Exception as e:
                print("Direct SQLite error:", e)

print("Migration script completed.")
