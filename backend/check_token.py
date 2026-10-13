import sqlite3
c = sqlite3.connect('/app/data/fleet_app.db')
rows = c.execute("SELECT username, expo_push_token FROM users").fetchall()
for r in rows:
    print(f"user={r[0]}, token={r[1]}")
c.close()
