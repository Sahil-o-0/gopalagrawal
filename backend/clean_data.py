import sqlite3
import os

# Path to database
db_path = os.path.join(os.path.dirname(__file__), "fleet_app.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 1. Clear all attendance punch logs
for tbl in ["attendance", "staff_ledgers", "leave_requests", "advance_wage_requests"]:
    try:
        cursor.execute(f"DELETE FROM {tbl}")
    except Exception as e:
        print(f"Skipping {tbl}: {e}")

# 2. Delete all users except the 'admin' account
cursor.execute("DELETE FROM users WHERE username != 'admin'")

conn.commit()

# Print remaining users for confirmation
cursor.execute("SELECT id, username, role, full_name FROM users")
remaining_users = cursor.fetchall()
print("Remaining users in database:")
for u in remaining_users:
    print(f"ID: {u[0]}, Username: {u[1]}, Role: {u[2]}, Name: {u[3]}")

cursor.execute("SELECT COUNT(*) FROM attendance")
print(f"Total attendance records: {cursor.fetchone()[0]}")

conn.close()
