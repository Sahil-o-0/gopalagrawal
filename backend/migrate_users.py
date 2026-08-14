import sqlite3

def run_migration():
    conn = sqlite3.connect('fleet_app.db')
    cursor = conn.cursor()
    columns = [
        ('designation', 'VARCHAR(100)'),
        ('profile_photo_url', 'TEXT'),
        ('aadhar_id', 'VARCHAR(20)'),
        ('address', 'TEXT'),
        ('relative_name', 'VARCHAR(100)'),
        ('relative_relation', 'VARCHAR(50)'),
        ('relative_phone_number', 'VARCHAR(15)'),
        ('opening_balance', 'FLOAT DEFAULT 0.0'),
        ('salary', 'FLOAT DEFAULT 0.0'),
        ('starting_date', 'DATE'),
        ('employment_type', "VARCHAR(20) DEFAULT 'PERMANENT'"),
        ('aadhar_front_url', 'TEXT'),
        ('aadhar_back_url', 'TEXT')
    ]
    for col_name, col_type in columns:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
            print(f"Successfully added column: {col_name}")
        except Exception as e:
            print(f"Skipped column {col_name}: {e}")
    conn.commit()
    conn.close()

if __name__ == '__main__':
    run_migration()
