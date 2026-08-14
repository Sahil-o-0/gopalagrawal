import sqlite3

def run_migration():
    conn = sqlite3.connect('fleet_app.db')
    cursor = conn.cursor()
    
    # Create designations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS designations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) UNIQUE NOT NULL
    )
    """)
    print("Created designations table if it did not exist.")
    
    # Seed default designations
    default_designations = ["ADMIN", "MANAGER", "STAFF"]
    for name in default_designations:
        try:
            cursor.execute("INSERT INTO designations (name) VALUES (?)", (name,))
            print(f"Seeded default designation: {name}")
        except sqlite3.IntegrityError:
            print(f"Designation {name} already exists.")
            
    conn.commit()
    conn.close()

if __name__ == '__main__':
    run_migration()
