import os
import sys

def migrate():
    print("Running migration for login_otps table...")
    try:
        from database import engine
        from sqlalchemy import text
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS login_otps (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id VARCHAR(64) NOT NULL UNIQUE,
                    user_id INTEGER NOT NULL,
                    otp_code VARCHAR(10) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    is_used BOOLEAN DEFAULT 0 NOT NULL,
                    attempts INTEGER DEFAULT 0 NOT NULL,
                    ip_address VARCHAR(50),
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                );
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_login_otps_session ON login_otps (session_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_login_otps_user ON login_otps (user_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_login_otps_created ON login_otps (created_at);"))
        print("SQLAlchemy migration completed.")
    except Exception as e:
        import sqlite3
        db_path = os.path.join(os.path.dirname(__file__), "fleet_app.db")
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS login_otps (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id VARCHAR(64) NOT NULL UNIQUE,
                    user_id INTEGER NOT NULL,
                    otp_code VARCHAR(10) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    is_used BOOLEAN DEFAULT 0 NOT NULL,
                    attempts INTEGER DEFAULT 0 NOT NULL,
                    ip_address VARCHAR(50),
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_login_otps_session ON login_otps (session_id);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_login_otps_user ON login_otps (user_id);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_login_otps_created ON login_otps (created_at);")
            conn.commit()
            conn.close()
            print("SQLite direct migration completed.")
        else:
            print("No local SQLite DB found to migrate directly.")


if __name__ == "__main__":
    migrate()
