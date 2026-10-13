import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "fleet_app.db")
print(f"Connecting to database at {db_path}...")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 1. Create vehicle_repair_requests table
cursor.execute('''
CREATE TABLE IF NOT EXISTS vehicle_repair_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER DEFAULT 1,
    staff_id INTEGER,
    vehicle_number VARCHAR(50),
    issue_description VARCHAR(255),
    estimated_cost FLOAT DEFAULT 0.0,
    actual_cost FLOAT DEFAULT 0.0,
    receipt_photo_url TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    admin_notes VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id),
    FOREIGN KEY (staff_id) REFERENCES users(id)
)
''')
print("vehicle_repair_requests table ready.")

# 2. Add columns to trip_logs table
columns_to_add = [
    ("advance_freight_received", "FLOAT DEFAULT 0.0"),
    ("pending_freight", "FLOAT DEFAULT 0.0"),
    ("freight_status", "VARCHAR(20) DEFAULT 'PENDING'"),
    ("freight_notes", "VARCHAR(255)")
]

cursor.execute("PRAGMA table_info(trip_logs)")
existing_cols = [row[1] for row in cursor.fetchall()]

for col_name, col_type in columns_to_add:
    if col_name not in existing_cols:
        cursor.execute(f"ALTER TABLE trip_logs ADD COLUMN {col_name} {col_type}")
        print(f"Added column {col_name} to trip_logs.")
    else:
        print(f"Column {col_name} already in trip_logs.")

# Recalculate pending_freight for existing trips where bhada > 0
cursor.execute('''
UPDATE trip_logs 
SET pending_freight = CASE 
    WHEN bhada > 0 AND (advance_freight_received IS NULL OR advance_freight_received = 0) THEN bhada 
    ELSE MAX(0, bhada - COALESCE(advance_freight_received, 0)) 
END,
freight_status = CASE 
    WHEN bhada > 0 AND (advance_freight_received IS NULL OR advance_freight_received = 0) THEN 'PENDING'
    WHEN bhada > 0 AND advance_freight_received >= bhada THEN 'PAID'
    WHEN bhada > 0 AND advance_freight_received > 0 THEN 'PARTIAL'
    ELSE 'PENDING'
END
WHERE bhada > 0
''')

conn.commit()
conn.close()
print("Migration completed successfully!")
