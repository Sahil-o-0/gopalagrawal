import sqlite3
import urllib.request
import json
import time

db_path = '/app/data/fleet_app.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

# Get admin's push token
row = c.execute("SELECT username, expo_push_token FROM users WHERE username='admin'").fetchone()
conn.close()

if not row or not row[1]:
    print("No push token found for admin. Make sure you are logged in to the app first!")
    exit(1)

username, token = row
print(f"Sending to: {username} -> {token}\n")

messages_list = [
    ("🚛 Test Notification 1/5", "Notification system is working!"),
    ("📦 Test Notification 2/5", "Backend → App connection confirmed ✅"),
    ("💰 Test Notification 3/5", "Financial alerts will appear like this"),
    ("⚠️ Test Notification 4/5", "EMI due date reminders will appear like this"),
    ("🎉 Test Notification 5/5", "All 5 notifications received — system is live!"),
]

for i, (title, body) in enumerate(messages_list, 1):
    payload = [{
        "to": token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": {"test": True, "index": i},
        "priority": "high",
    }]
    try:
        req = urllib.request.Request(
            "https://exp.host/--/api/v2/push/send",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            status = result.get("data", [{}])[0].get("status", "unknown")
            print(f"[{i}/5] Sent '{title}' → {status}")
    except Exception as e:
        print(f"[{i}/5] ERROR: {e}")
    
    if i < 5:
        print(f"  Waiting 5 seconds...")
        time.sleep(5)

print("\nDone! All 5 test notifications dispatched.")
