"""
One-time migration: adds 'origin' and 'destination' columns to trip_logs table.
Run once: python migrate_add_trip_columns.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "fleet_app.db")

def run():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check existing columns
    cursor.execute("PRAGMA table_info(trip_logs)")
    existing = {row[1] for row in cursor.fetchall()}

    added = []
    if "origin" not in existing:
        cursor.execute("ALTER TABLE trip_logs ADD COLUMN origin TEXT")
        added.append("origin")
    if "destination" not in existing:
        cursor.execute("ALTER TABLE trip_logs ADD COLUMN destination TEXT")
        added.append("destination")

    conn.commit()
    conn.close()

    if added:
        print(f"✅ Added columns: {', '.join(added)}")
    else:
        print("ℹ️  Columns already exist, nothing to do.")

if __name__ == "__main__":
    run()
