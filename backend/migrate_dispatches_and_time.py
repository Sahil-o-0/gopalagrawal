"""
Migration: Add dispatch, trade, client, and time-tracking columns to trip_logs table.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "fleet_app.db")

def run():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}, skipping.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(trip_logs)")
    existing_cols = {row[1] for row in cursor.fetchall()}

    columns_to_add = [
        ("trade_type", "TEXT DEFAULT 'TRIP'"),
        ("client_id", "INTEGER"),
        ("client_name", "TEXT"),
        ("transporter_name", "TEXT"),
        ("vehicle_source", "TEXT DEFAULT 'OWN'"),
        ("rate_type", "TEXT DEFAULT 'TON'"),
        ("rate", "REAL DEFAULT 0.0"),
        ("start_time", "TEXT"),
        ("end_time", "TEXT"),
        ("total_minutes", "REAL DEFAULT 0.0"),
        ("hourly_rate", "REAL DEFAULT 0.0")
    ]

    added = []
    for col_name, col_def in columns_to_add:
        if col_name not in existing_cols:
            try:
                cursor.execute(f"ALTER TABLE trip_logs ADD COLUMN {col_name} {col_def}")
                added.append(col_name)
            except Exception as e:
                print(f"Error adding {col_name}: {e}")

    conn.commit()
    conn.close()

    if added:
        print(f"[SUCCESS] Added columns to trip_logs: {', '.join(added)}")
    else:
        print("[INFO] All trip_logs columns already exist.")

if __name__ == "__main__":
    run()
