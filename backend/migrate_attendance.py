import sqlite3

def run_migration():
    conn = sqlite3.connect('fleet_app.db')
    cursor = conn.cursor()
    columns = [
        ('punch_in_time', 'DATETIME'),
        ('punch_out_time', 'DATETIME'),
        ('punch_in_photo_url', 'TEXT'),
        ('punch_out_photo_url', 'TEXT'),
        ('hours_worked', 'FLOAT DEFAULT 0.0')
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
