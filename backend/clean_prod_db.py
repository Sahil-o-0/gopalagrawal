import sqlite3

db_path = '/app/data/fleet_app.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

# Tables to fully clear (all data wiped)
tables_to_clear = [
    'trip_logs',
    'attendance',
    'leave_requests',
    'advance_requests',
    'staff_ledgers',
    'financial_ledgers',
    'vehicle_emi',
    'vehicle_repair_requests',
    'daily_ledger',
    'designations',
]

for table in tables_to_clear:
    try:
        c.execute(f"DELETE FROM {table}")
        print(f"Cleared: {table}")
    except Exception as e:
        print(f"Skipped {table}: {e}")

# Keep only admin user (id=1), delete manager and staff
c.execute("DELETE FROM users WHERE username != 'admin'")
print(f"Users after cleanup: {c.execute('SELECT username, role FROM users').fetchall()}")

# Keep only Adarshila Site (id=1), delete the others we just added
c.execute("DELETE FROM sites WHERE name != 'Adarshila Site'")
print(f"Sites after cleanup: {c.execute('SELECT id, name FROM sites').fetchall()}")

conn.commit()
conn.close()
print("\nDatabase cleaned successfully!")
