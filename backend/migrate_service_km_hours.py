import sqlite3
import os

candidates = [
    'backend/fleet_app.db',
    'fleet_app.db',
    'data/fleet_app.db',
    '/app/data/fleet_app.db'
]

new_columns = [
    ("service_km", "FLOAT"),
    ("next_service_km", "FLOAT"),
    ("current_km", "FLOAT"),
    ("service_hours", "FLOAT"),
    ("next_service_hours", "FLOAT"),
    ("current_hours", "FLOAT"),
    ("service_type", "VARCHAR(50) DEFAULT 'DATE'"),
]

for db_path in candidates:
    if os.path.exists(db_path):
        print(f"\n--- Migrating SQLite database at: {db_path} ---")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA table_info(vehicle_emi)")
        existing_cols = {row[1]: row for row in cursor.fetchall()}
        
        for col_name, col_def in new_columns:
            if col_name not in existing_cols:
                sql = f"ALTER TABLE vehicle_emi ADD COLUMN {col_name} {col_def}"
                try:
                    cursor.execute(sql)
                    print(f"[OK] Added column: vehicle_emi.{col_name} ({col_def})")
                except Exception as e:
                    print(f"[ERROR] Error adding {col_name}: {e}")
            else:
                print(f"[INFO] Column already exists: {col_name}")
                
        conn.commit()
        cursor.execute("PRAGMA table_info(vehicle_emi)")
        updated_cols = [row[1] for row in cursor.fetchall()]
        print(f"Columns in {db_path}: {updated_cols}")
        conn.close()

print("\nMigration completed successfully.")
