import sqlite3
import os
import sys

TARGET_TABLES = [
    "users",
    "trip_logs",
    "attendance",
    "leave_requests",
    "advance_requests",
    "vehicle_emi",
    "financial_ledgers",
    "staff_ledgers",
    "daily_ledger"
]

def migrate_database(db_path: str = None):
    if db_path is None:
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(backend_dir, "fleet_app.db")

    print(f"--- Starting Migration on: {db_path} ---")
    if not os.path.exists(db_path):
        print(f"Warning: Database file at '{db_path}' does not exist. Migration will create schema.")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 1. Create sites table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL UNIQUE,
                location VARCHAR(255),
                code VARCHAR(50) UNIQUE,
                status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)
        print("[+] Ensured 'sites' table exists.")

        # 2. Seed default site (ID 1, Name: 'Main Site')
        cursor.execute("""
            INSERT OR IGNORE INTO sites (id, name, location, code, status)
            VALUES (1, 'Main Site', 'Headquarters', 'MAIN', 'ACTIVE');
        """)
        print("[+] Seeded default Site ID 1 ('Main Site').")

        # 3. Add site_id foreign key column to target operational tables
        for table in TARGET_TABLES:
            # Check if table exists first
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
            if not cursor.fetchone():
                print(f"[*] Table '{table}' does not exist yet. Skipping column alter (will be created by ORM).")
                continue

            # Check table columns
            cursor.execute(f"PRAGMA table_info({table});")
            columns = [column[1] for column in cursor.fetchall()]

            if "site_id" not in columns:
                cursor.execute(f"ALTER TABLE {table} ADD COLUMN site_id INTEGER DEFAULT 1 REFERENCES sites(id);")
                print(f"[+] Added 'site_id' column to table '{table}'.")

            # Backfill any NULL site_id values to 1
            cursor.execute(f"UPDATE {table} SET site_id = 1 WHERE site_id IS NULL;")
            rows_updated = cursor.rowcount
            if rows_updated > 0:
                print(f"[+] Backfilled {rows_updated} records in '{table}' with site_id = 1.")

        conn.commit()
        print("--- Migration Completed Successfully ---")
    except Exception as e:
        conn.rollback()
        print(f"[!] Migration Failed: {e}", file=sys.stderr)
        raise e
    finally:
        conn.close()

if __name__ == "__main__":
    target_db = sys.argv[1] if len(sys.argv) > 1 else None
    migrate_database(target_db)
