import pytest
import datetime

def test_trip_site_filtering(client, admin_headers, seed_sites):
    site1, site2 = seed_sites[0], seed_sites[1]

    # Create trip for Site 1
    t1_payload = {
        "vehicle_number": "KA01A1000",
        "material_type": "Gravel",
        "weight_tons": 10.0,
        "start_meter_reading": 1000.0,
        "end_meter_reading": 1050.0,
        "site_id": site1.id
    }
    r1 = client.post("/trips/", json=t1_payload, headers=admin_headers)
    assert r1.status_code == 200
    trip1 = r1.json()
    assert trip1["site_id"] == site1.id

    # Create trip for Site 2
    t2_payload = {
        "vehicle_number": "KA02B2000",
        "material_type": "Sand",
        "weight_tons": 20.0,
        "start_meter_reading": 500.0,
        "end_meter_reading": 600.0,
        "site_id": site2.id
    }
    r2 = client.post("/trips/", json=t2_payload, headers=admin_headers)
    assert r2.status_code == 200
    trip2 = r2.json()
    assert trip2["site_id"] == site2.id

    # Filter by site_id = site1.id
    res1 = client.get(f"/trips/?site_id={site1.id}", headers=admin_headers)
    assert res1.status_code == 200
    trips_s1 = res1.json()
    assert all(t["site_id"] == site1.id for t in trips_s1)
    assert any(t["id"] == trip1["id"] for t in trips_s1)
    assert not any(t["id"] == trip2["id"] for t in trips_s1)

    # Filter by site_id = site2.id
    res2 = client.get(f"/trips/?site_id={site2.id}", headers=admin_headers)
    assert res2.status_code == 200
    trips_s2 = res2.json()
    assert all(t["site_id"] == site2.id for t in trips_s2)
    assert any(t["id"] == trip2["id"] for t in trips_s2)
    assert not any(t["id"] == trip1["id"] for t in trips_s2)

def test_workforce_attendance_filtering(client, admin_headers, seed_sites):
    site1, site2 = seed_sites[0], seed_sites[1]
    
    # Get test users
    u_res = client.get("/auth/users", headers=admin_headers)
    user_id = u_res.json()[0]["id"]

    today = str(datetime.date.today())
    yesterday = str(datetime.date.today() - datetime.timedelta(days=1))

    # Mark attendance Site 1
    a1_res = client.post("/workforce/attendance", json={
        "staff_id": user_id,
        "date": today,
        "status": "PRESENT",
        "site_id": site1.id
    }, headers=admin_headers)
    assert a1_res.status_code in [200, 409]

    # Query by site_id
    get_res = client.get(f"/workforce/attendance?site_id={site1.id}", headers=admin_headers)
    assert get_res.status_code == 200
    records = get_res.json()
    assert all(r["site_id"] == site1.id for r in records)

def test_advance_approval_cascade_site_propagation(client, admin_headers, seed_sites):
    site2 = seed_sites[1]

    u_res = client.get("/auth/users", headers=admin_headers)
    user_id = u_res.json()[0]["id"]

    # 1. Request advance for Site 2
    adv_res = client.post("/workforce/advances", json={
        "staff_id": user_id,
        "amount": 2500.0,
        "reason": "Site 2 Fuel Advance",
        "site_id": site2.id
    }, headers=admin_headers)
    assert adv_res.status_code == 200
    adv = adv_res.json()
    assert adv["site_id"] == site2.id

    # 2. Approve advance
    appr_res = client.patch(f"/workforce/advances/{adv['id']}/status", json={"status": "APPROVED"}, headers=admin_headers)
    assert appr_res.status_code == 200

    # 3. Check staff-ledger for site_id = site2.id
    sl_res = client.get(f"/workforce/staff-ledger?site_id={site2.id}", headers=admin_headers)
    assert sl_res.status_code == 200
    sl_entries = sl_res.json()
    assert any(e["amount"] == -2500.0 and e["site_id"] == site2.id for e in sl_entries)

    # 4. Check daily-ledger for site_id = site2.id
    dl_res = client.get(f"/workforce/daily-ledger?site_id={site2.id}", headers=admin_headers)
    assert dl_res.status_code == 200
    dl_entries = dl_res.json()
    assert any(e["amount"] == 2500.0 and e["site_id"] == site2.id and e["category"] == "ADVANCE" for e in dl_entries)

def test_financial_ledger_cascade_site_propagation(client, admin_headers, manager_headers, seed_sites):
    site2 = seed_sites[1]

    # Create trip on site 2
    t_payload = {
        "vehicle_number": "KA03C3000",
        "material_type": "Iron",
        "weight_tons": 25.0,
        "start_meter_reading": 100.0,
        "end_meter_reading": 200.0,
        "site_id": site2.id
    }
    t_res = client.post("/trips/", json=t_payload, headers=admin_headers)
    trip_id = t_res.json()["id"]

    # Post financial ledger entry for site 2 trip
    fl_payload = {
        "trip_id": trip_id,
        "total_amount_billed": 50000.0,
        "amount_received": 30000.0,
        "site_id": site2.id
    }
    fl_res = client.post("/workforce/ledger", json=fl_payload, headers=manager_headers)
    assert fl_res.status_code == 200
    fl_data = fl_res.json()
    assert fl_data["site_id"] == site2.id
    assert fl_data["amount_pending"] == 20000.0

    # Verify daily ledger entry created with site_id = site2.id
    dl_res = client.get(f"/workforce/daily-ledger?site_id={site2.id}", headers=admin_headers)
    assert dl_res.status_code == 200
    dl_entries = dl_res.json()
    assert any(e["amount"] == 50000.0 and e["site_id"] == site2.id and e["category"] == "TRIP_INCOME" for e in dl_entries)
