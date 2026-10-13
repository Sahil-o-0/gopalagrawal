import sqlite3
c = sqlite3.connect('/app/data/fleet_app.db')
tables = [t[0] for t in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print('Tables:', tables)
print('DB size (bytes):', c.execute("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()").fetchone()[0])
sites = c.execute("SELECT id, name, status FROM sites").fetchall()
print('Sites:', sites)
users = c.execute("SELECT id, username, role FROM users").fetchall()
print('Users:', users)
emis = c.execute("SELECT id, vehicle_number, emi_amount, emi_due_date, insurance_premium, insurance_expiry, permit_fee, permit_valid_upto, fitness_fee, fitness_expiry, road_tax_amount, road_tax_expiry, pucc_fee, pucc_expiry, registration_date FROM vehicle_emi").fetchall()
print('EMIs:', emis)
