import pytest
import datetime

"""
EMPIRICAL STRESS TEST SUITE FOR MULTI-SITE DATA ISOLATION AND QUERY FILTERING
Author: Challenger 1 (Milestone 2)
Target Endpoints:
- /sites/
- /trips/ & /trips/my-trips
- /workforce/attendance
- /workforce/leaves
- /workforce/advances
- /workforce/daily-ledger
- /workforce/staff-ledger & /workforce/staff-ledger/{staff_id}
- /workforce/emi
- /workforce/ledger
- /auth/users
"""

@pytest.fixture
def multi_site_environment(client, admin_headers):
    """
    Creates two distinct sites (Site 1 and Site 2) and populates both sites 
    with records across all operational domains.
    Returns site objects and created record identifiers.
    """
    # 1. Fetch default site (Site 1) or ensure Site 1 exists
    res_sites = client.get("/sites/", headers=admin_headers)
    assert res_sites.status_code == 200
    sites = res_sites.json()
    
    site1_id = sites[0]["id"]

    # 2. Create Site 2
    res_site2 = client.post("/sites/", json={
        "name": "Beta Site Stress",
        "location": "North Zone",
        "code": "BETA"
    }, headers=admin_headers)
    assert res_site2.status_code == 201
    site2_id = res_site2.json()["id"]

    # 3. Create distinct users for Site 1 and Site 2
    u1_res = client.post("/auth/users", json={
        "username": "staff_site1",
        "password": "Password123!",
        "full_name": "Staff Site 1",
        "role": "STAFF",
        "site_id": site1_id
    }, headers=admin_headers)
    assert u1_res.status_code == 200
    user_s1 = u1_res.json()

    u2_res = client.post("/auth/users", json={
        "username": "staff_site2",
        "password": "Password123!",
        "full_name": "Staff Site 2",
        "role": "STAFF",
        "site_id": site2_id
    }, headers=admin_headers)
    assert u2_res.status_code == 200
    user_s2 = u2_res.json()

    # 4. Populate Site 1 records
    # Trip S1
    t1 = client.post("/trips/", json={
        "vehicle_number": "S1-TRUCK-01",
        "material_type": "Gravel",
        "weight_tons": 15.0,
        "start_meter_reading": 100.0,
        "end_meter_reading": 150.0,
        "staff_id": user_s1["id"],
        "site_id": site1_id
    }, headers=admin_headers).json()

    # Attendance S1
    att1 = client.post("/workforce/attendance", json={
        "staff_id": user_s1["id"],
        "date": str(datetime.date.today()),
        "status": "PRESENT",
        "site_id": site1_id
    }, headers=admin_headers).json()

    # Leave S1
    leave1 = client.post("/workforce/leaves", json={
        "staff_id": user_s1["id"],
        "start_date": str(datetime.date.today()),
        "end_date": str(datetime.date.today()),
        "reason": "Personal work S1",
        "site_id": site1_id
    }, headers=admin_headers).json()

    # Advance S1
    adv1 = client.post("/workforce/advances", json={
        "staff_id": user_s1["id"],
        "amount": 1000.0,
        "reason": "Advance S1",
        "site_id": site1_id
    }, headers=admin_headers).json()

    # Vehicle EMI S1
    emi1 = client.post("/workforce/emi", json={
        "vehicle_number": "S1-TRUCK-01",
        "financier": "Bank A",
        "monthly_emi": 15000.0,
        "emi_due_date": str(datetime.date.today()),
        "site_id": site1_id
    }, headers=admin_headers).json()

    # Financial Ledger S1
    fl1 = client.post("/workforce/ledger", json={
        "trip_id": t1["id"],
        "total_amount_billed": 20000.0,
        "amount_received": 15000.0,
        "site_id": site1_id
    }, headers=admin_headers).json()

    # 5. Populate Site 2 records
    # Trip S2
    t2 = client.post("/trips/", json={
        "vehicle_number": "S2-TRUCK-02",
        "material_type": "Sand",
        "weight_tons": 25.0,
        "start_meter_reading": 200.0,
        "end_meter_reading": 320.0,
        "staff_id": user_s2["id"],
        "site_id": site2_id
    }, headers=admin_headers).json()

    # Attendance S2
    att2 = client.post("/workforce/attendance", json={
        "staff_id": user_s2["id"],
        "date": str(datetime.date.today()),
        "status": "PRESENT",
        "site_id": site2_id
    }, headers=admin_headers).json()

    # Leave S2
    leave2 = client.post("/workforce/leaves", json={
        "staff_id": user_s2["id"],
        "start_date": str(datetime.date.today()),
        "end_date": str(datetime.date.today()),
        "reason": "Personal work S2",
        "site_id": site2_id
    }, headers=admin_headers).json()

    # Advance S2
    adv2 = client.post("/workforce/advances", json={
        "staff_id": user_s2["id"],
        "amount": 2000.0,
        "reason": "Advance S2",
        "site_id": site2_id
    }, headers=admin_headers).json()

    # Vehicle EMI S2
    emi2 = client.post("/workforce/emi", json={
        "vehicle_number": "S2-TRUCK-02",
        "financier": "Bank B",
        "monthly_emi": 25000.0,
        "emi_due_date": str(datetime.date.today()),
        "site_id": site2_id
    }, headers=admin_headers).json()

    # Financial Ledger S2
    fl2 = client.post("/workforce/ledger", json={
        "trip_id": t2["id"],
        "total_amount_billed": 35000.0,
        "amount_received": 35000.0,
        "site_id": site2_id
    }, headers=admin_headers).json()

    return {
        "site1_id": site1_id,
        "site2_id": site2_id,
        "user_s1": user_s1,
        "user_s2": user_s2,
        "t1": t1, "t2": t2,
        "att1": att1, "att2": att2,
        "leave1": leave1, "leave2": leave2,
        "adv1": adv1, "adv2": adv2,
        "emi1": emi1, "emi2": emi2,
        "fl1": fl1, "fl2": fl2
    }


def test_strict_site_query_filtering(client, admin_headers, multi_site_environment):
    """
    STRESS TEST 1: Verify querying site_id=1 returns ONLY Site 1 records,
    querying site_id=2 returns ONLY Site 2 records across all operational endpoints.
    """
    s1_id = multi_site_environment["site1_id"]
    s2_id = multi_site_environment["site2_id"]

    endpoints = [
        "/trips/",
        "/workforce/attendance",
        "/workforce/leaves",
        "/workforce/advances",
        "/workforce/daily-ledger",
        "/workforce/staff-ledger",
        "/workforce/emi",
        "/workforce/ledger",
        "/auth/users"
    ]

    for ep in endpoints:
        # Query Site 1
        res1 = client.get(f"{ep}?site_id={s1_id}", headers=admin_headers)
        assert res1.status_code == 200, f"Failed GET {ep}?site_id={s1_id}"
        items1 = res1.json()
        assert len(items1) > 0, f"Expected non-empty results for {ep} site {s1_id}"
        for item in items1:
            assert item.get("site_id") == s1_id, f"Data leak in {ep}! Found record with site_id={item.get('site_id')} when querying site {s1_id}"

        # Query Site 2
        res2 = client.get(f"{ep}?site_id={s2_id}", headers=admin_headers)
        assert res2.status_code == 200, f"Failed GET {ep}?site_id={s2_id}"
        items2 = res2.json()
        assert len(items2) > 0, f"Expected non-empty results for {ep} site {s2_id}"
        for item in items2:
            assert item.get("site_id") == s2_id, f"Data leak in {ep}! Found record with site_id={item.get('site_id')} when querying site {s2_id}"


def test_unfiltered_querying_returns_all_sites(client, admin_headers, multi_site_environment):
    """
    STRESS TEST 2: Verify queries without site_id return records from ALL accessible sites.
    """
    s1_id = multi_site_environment["site1_id"]
    s2_id = multi_site_environment["site2_id"]

    endpoints = [
        "/trips/",
        "/workforce/attendance",
        "/workforce/leaves",
        "/workforce/advances",
        "/workforce/daily-ledger",
        "/workforce/emi",
        "/workforce/ledger",
        "/auth/users"
    ]

    for ep in endpoints:
        res = client.get(ep, headers=admin_headers)
        assert res.status_code == 200, f"Failed GET {ep} without site_id"
        items = res.json()
        site_ids = {item.get("site_id") for item in items if item.get("site_id") is not None}
        assert s1_id in site_ids, f"Missing site {s1_id} records in unfiltered query for {ep}"
        assert s2_id in site_ids, f"Missing site {s2_id} records in unfiltered query for {ep}"


def test_edge_case_invalid_site_ids(client, admin_headers, multi_site_environment):
    """
    STRESS TEST 3: Verify behavior with invalid site_ids (999, negative, 0, string).
    - Invalid site IDs (999, -1, 0) should return 200 with empty list []
    - Non-integer string should return 422 Unprocessable Entity
    """
    invalid_ids = [999, -1, -999, 0]

    endpoints = [
        "/trips/",
        "/workforce/attendance",
        "/workforce/leaves",
        "/workforce/advances",
        "/workforce/daily-ledger",
        "/workforce/staff-ledger",
        "/workforce/emi",
        "/workforce/ledger",
        "/auth/users"
    ]

    for invalid_id in invalid_ids:
        for ep in endpoints:
            res = client.get(f"{ep}?site_id={invalid_id}", headers=admin_headers)
            assert res.status_code == 200, f"Failed GET {ep}?site_id={invalid_id}"
            items = res.json()
            assert items == [], f"Expected empty list [] for invalid site_id={invalid_id} on {ep}, got {items}"

    # Test string type error (HTTP 422)
    for ep in endpoints:
        res_str = client.get(f"{ep}?site_id=invalid_site_code", headers=admin_headers)
        assert res_str.status_code == 422, f"Expected 422 for string site_id on {ep}, got {res_str.status_code}"


def test_cascading_site_isolation(client, admin_headers, multi_site_environment):
    """
    STRESS TEST 4: Verify cascading automatic records (Advance Approval -> Staff Ledger -> Daily Ledger)
    strictly inherit the original record's site_id and are isolated during query filtering.
    """
    s1_id = multi_site_environment["site1_id"]
    s2_id = multi_site_environment["site2_id"]
    adv2 = multi_site_environment["adv2"]

    # Approve advance on Site 2
    appr = client.patch(f"/workforce/advances/{adv2['id']}/status", json={"status": "APPROVED"}, headers=admin_headers)
    assert appr.status_code == 200

    # Query staff ledger for Site 1 -> must NOT contain Site 2 advance
    sl1_res = client.get(f"/workforce/staff-ledger?site_id={s1_id}", headers=admin_headers)
    assert sl1_res.status_code == 200
    for entry in sl1_res.json():
        assert entry["site_id"] == s1_id
        assert entry["description"] != f"Approved Advance: {adv2['reason']}"

    # Query staff ledger for Site 2 -> MUST contain Site 2 advance
    sl2_res = client.get(f"/workforce/staff-ledger?site_id={s2_id}", headers=admin_headers)
    assert sl2_res.status_code == 200
    assert any(entry["site_id"] == s2_id and adv2["reason"] in entry["description"] for entry in sl2_res.json())

    # Query daily ledger for Site 1 -> must NOT contain Site 2 advance expense
    dl1_res = client.get(f"/workforce/daily-ledger?site_id={s1_id}", headers=admin_headers)
    assert dl1_res.status_code == 200
    for entry in dl1_res.json():
        assert entry["site_id"] == s1_id
        assert entry["description"] != f"Staff Advance: {multi_site_environment['user_s2']['username']} - {adv2['reason']}"

    # Query daily ledger for Site 2 -> MUST contain Site 2 advance expense
    dl2_res = client.get(f"/workforce/daily-ledger?site_id={s2_id}", headers=admin_headers)
    assert dl2_res.status_code == 200
    assert any(entry["site_id"] == s2_id and adv2["reason"] in entry["description"] for entry in dl2_res.json())


def test_individual_staff_ledger_site_filtering(client, admin_headers, multi_site_environment):
    """
    STRESS TEST 5: Verify /workforce/staff-ledger/{staff_id} query parameter filtering by site_id.
    """
    s1_id = multi_site_environment["site1_id"]
    s2_id = multi_site_environment["site2_id"]
    u_s2 = multi_site_environment["user_s2"]

    # Create staff ledger entry for user_s2 on Site 2
    sl_res = client.post("/workforce/staff-ledger", json={
        "staff_id": u_s2["id"],
        "amount": 5000.0,
        "transaction_type": "SALARY",
        "description": "Site 2 Salary Payment",
        "site_id": s2_id
    }, headers=admin_headers)
    assert sl_res.status_code == 200

    # Query staff ledger for u_s2 with site_id=s1_id -> should return empty list
    res_s1 = client.get(f"/workforce/staff-ledger/{u_s2['id']}?site_id={s1_id}", headers=admin_headers)
    assert res_s1.status_code == 200
    assert res_s1.json() == []

    # Query staff ledger for u_s2 with site_id=s2_id -> should return entry
    res_s2 = client.get(f"/workforce/staff-ledger/{u_s2['id']}?site_id={s2_id}", headers=admin_headers)
    assert res_s2.status_code == 200
    entries = res_s2.json()
    assert len(entries) >= 1
    assert all(e["site_id"] == s2_id for e in entries)


def test_user_site_context_fallback(client, admin_headers, multi_site_environment):
    """
    STRESS TEST 6: Test user context default behavior when creating operational records 
    without specifying site_id explicitly.
    """
    s2_id = multi_site_environment["site2_id"]
    u_s2 = multi_site_environment["user_s2"]

    # Generate token for user_s2
    from core.security import create_access_token
    token = create_access_token(data={"sub": u_s2["username"], "role": u_s2["role"]})
    user_s2_headers = {"Authorization": f"Bearer {token}"}

    # Post trip without site_id parameter -> should inherit user_s2's site_id (Site 2)
    trip_res = client.post("/trips/", json={
        "vehicle_number": "AUTO-SITE-TRUCK",
        "material_type": "Soil",
        "weight_tons": 12.0,
        "start_meter_reading": 10.0,
        "end_meter_reading": 40.0
    }, headers=user_s2_headers)
    assert trip_res.status_code == 200
    trip_data = trip_res.json()
    assert trip_data["site_id"] == s2_id, f"Expected trip site_id to default to user's site_id {s2_id}, got {trip_data['site_id']}"
