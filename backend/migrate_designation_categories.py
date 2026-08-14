import sqlite3

def run_migration():
    conn = sqlite3.connect('fleet_app.db')
    cursor = conn.cursor()
    
    # Check if category column exists, if not add it
    try:
        cursor.execute("ALTER TABLE designations ADD COLUMN category VARCHAR(50) DEFAULT 'WORKER'")
        print("Added column category to designations.")
    except Exception as e:
        print("Column category already exists or alter skipped:", e)
        
    # Clear existing designations to reseed clean groups
    cursor.execute("DELETE FROM designations")
    
    # Reseed
    designations = [
        ("ADMIN", "ADMIN"),
        ("MANAGER", "MANAGER"),
        ("STAFF", "WORKER"),
        ("SCE", "WORKER"),
        ("Ajox Operator", "WORKER"),
        ("Coolie", "WORKER"),
        ("Driver", "WORKER"),
        ("Jcb Operator", "WORKER"),
        ("Mistri", "WORKER"),
        ("Reja", "WORKER"),
        ("Time Keeper", "WORKER")
    ]
    
    for name, cat in designations:
        cursor.execute("INSERT INTO designations (name, category) VALUES (?, ?)", (name, cat))
        print(f"Added designation: {name} under category: {cat}")
        
    conn.commit()
    conn.close()

if __name__ == '__main__':
    run_migration()
