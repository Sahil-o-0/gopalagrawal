import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "fleet_app.db")

def migrate():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS vehicle_tyres (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id INTEGER DEFAULT 1,
        vehicle_id INTEGER NULL,
        vehicle_number VARCHAR(50) NOT NULL,
        purchase_date DATE NOT NULL,
        serial_number VARCHAR(100) NOT NULL,
        tyre_position VARCHAR(100) NULL,
        brand_model VARCHAR(100) NULL,
        purchase_cost FLOAT DEFAULT 0.0,
        odometer_at_fitting FLOAT DEFAULT 0.0,
        status VARCHAR(30) DEFAULT 'FITTED',
        notes VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(site_id) REFERENCES sites(id),
        FOREIGN KEY(vehicle_id) REFERENCES vehicle_emi_records(id)
    );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS ix_vehicle_tyres_id ON vehicle_tyres(id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_vehicle_tyres_site_id ON vehicle_tyres(site_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_vehicle_tyres_vehicle_id ON vehicle_tyres(vehicle_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_vehicle_tyres_vehicle_number ON vehicle_tyres(vehicle_number);")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_vehicle_tyres_serial_number ON vehicle_tyres(serial_number);")

    conn.commit()
    conn.close()
    print("Migrated vehicle_tyres table successfully.")

if __name__ == "__main__":
    migrate()
