import sqlite3
import os

db_paths = ['/app/data/fleet_app.db', 'fleet_app.db', 'data/fleet_app.db']
db_path = None
for p in db_paths:
    if os.path.exists(p):
        db_path = p
        break

if not db_path:
    db_path = '/app/data/fleet_app.db'

print(f"Connecting to SQLite database at: {db_path}")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check table info for vehicle_emi
cursor.execute("PRAGMA table_info(vehicle_emi)")
existing_cols = {row[1]: row for row in cursor.fetchall()}
print(f"Existing columns in vehicle_emi: {list(existing_cols.keys())}")

new_columns = [
    ("insurance_premium", "FLOAT DEFAULT 0.0"),
    ("fitness_fee", "FLOAT DEFAULT 0.0"),
    ("road_tax_expiry", "DATE"),
    ("road_tax_amount", "FLOAT DEFAULT 0.0"),
    ("pucc_expiry", "DATE"),
    ("pucc_fee", "FLOAT DEFAULT 0.0"),
]

for col_name, col_def in new_columns:
    if col_name not in existing_cols:
        sql = f"ALTER TABLE vehicle_emi ADD COLUMN {col_name} {col_def}"
        try:
            cursor.execute(sql)
            print(f"✅ Added column: vehicle_emi.{col_name} ({col_def})")
        except Exception as e:
            print(f"❌ Error adding {col_name}: {e}")
    else:
        print(f"ℹ️ Column already exists: {col_name}")

conn.commit()

# Verify columns after migration
cursor.execute("PRAGMA table_info(vehicle_emi)")
updated_cols = [row[1] for row in cursor.fetchall()]
print(f"\nUpdated columns in vehicle_emi:\n{updated_cols}")

conn.close()
print("\nMigration completed successfully!")
