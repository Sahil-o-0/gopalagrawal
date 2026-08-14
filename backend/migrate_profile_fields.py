import sqlite3
import datetime

def run_migration():
    conn = sqlite3.connect('fleet_app.db')
    cursor = conn.cursor()
    
    columns = [
        ("created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
        ("created_by", "VARCHAR(50) DEFAULT 'admin'"),
        ("employee_of", "VARCHAR(50) DEFAULT 'DEPARTMENTAL'"),
        ("department", "VARCHAR(100) DEFAULT ''"),
        ("employee_id_custom", "VARCHAR(50) DEFAULT ''")
    ]
    
    for col_name, col_type in columns:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
            print(f"Added column {col_name} to users table.")
        except Exception as e:
            print(f"Column {col_name} already exists or alter skipped:", e)
            
    conn.commit()
    conn.close()

if __name__ == '__main__':
    run_migration()
