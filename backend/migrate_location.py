import sqlite3

def run_migration():
    conn = sqlite3.connect('fleet_app.db')
    cursor = conn.cursor()
    columns = [
        ('punch_in_location', 'VARCHAR(100)'),
        ('punch_out_location', 'VARCHAR(100)')
    ]
    for col_name, col_type in columns:
        try:
            cursor.execute(f"ALTER TABLE attendance ADD COLUMN {col_name} {col_type}")
            print(f"Successfully added column: {col_name}")
        except Exception as e:
            print(f"Skipped column {col_name}: {e}")
    conn.commit()
    conn.close()

if __name__ == '__main__':
    run_migration()
