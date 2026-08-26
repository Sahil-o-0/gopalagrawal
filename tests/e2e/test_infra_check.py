"""
Sanity check tests verifying E2E test client, isolated DB fixtures, seed data, and helper utilities.
"""

import pytest
import datetime
from models.user import User, UserRole
from models.trip import TripLog
from models.workforce import (
    Attendance, AttendanceType, LeaveRequest, AdvanceWageRequest,
    VehicleEMI, StaffLedger, DailyLedger
)
from conftest import Site, seed_default_site, seed_default_users, make_auth_headers, E2EHelpers


def test_client_health_check(client):
    """Verify that TestClient connects to FastAPI app and health endpoint responds."""
    response = client.get("/health")
    assert response.status_code == 200, f"Unexpected status code: {response.status_code}"
    data = response.json()
    assert data.get("status") == "ok", f"Expected status 'ok', got {data}"


def test_database_isolation_and_seed_site(db_session):
    """Verify isolated database fixture initializes with seed site (id=1, 'Main Site / HQ')."""
    site = db_session.query(Site).filter(Site.id == 1).first()
    assert site is not None, "Seed site id=1 must exist"
    assert site.name == "Main Site / HQ", f"Expected name 'Main Site / HQ', got '{site.name}'"
    assert site.code == "SITE-001", f"Expected code 'SITE-001', got '{site.code}'"
    assert site.status == "ACTIVE", f"Expected status 'ACTIVE', got '{site.status}'"


def test_seed_users_and_login(client, db_session):
    """Verify seed users exist and can authenticate via /auth/login."""
    # Verify users exist in DB
    users = db_session.query(User).all()
    usernames = [u.username for u in users]
    assert "admin" in usernames, "Admin user must exist"
    assert "manager" in usernames, "Manager user must exist"
    assert "staff" in usernames, "Staff user must exist"

    # Test login endpoint with admin credentials
    response = client.post(
        "/auth/login",
        data={"username": "admin", "password": "admin123"}
    )
    assert response.status_code == 200, f"Login failed for admin: {response.text}"
    json_data = response.json()
    assert "access_token" in json_data, "Response missing access_token"
    assert json_data["token_type"] == "bearer"


def test_auth_headers_fixtures(client, admin_auth_headers, manager_auth_headers, staff_auth_headers):
    """Verify auth header fixtures grant authorized access to RBAC endpoints."""
    # Admin access to /auth/users should succeed (200 OK)
    admin_res = client.get("/auth/users", headers=admin_auth_headers)
    assert admin_res.status_code == 200, f"Admin auth failed: {admin_res.text}"
    assert isinstance(admin_res.json(), list), "Expected list of users"

    # Manager access to /auth/users should succeed (200 OK)
    manager_res = client.get("/auth/users", headers=manager_auth_headers)
    assert manager_res.status_code == 200, f"Manager auth failed: {manager_res.text}"

    # Staff access to /auth/users should be forbidden (403)
    staff_res = client.get("/auth/users", headers=staff_auth_headers)
    assert staff_res.status_code == 403, f"Expected 403 Forbidden for staff, got {staff_res.status_code}"


def test_domain_helper_utilities(db_session, helpers):
    """Verify helper utilities create valid domain entities in isolated test DB."""
    # 1. Site creation helper
    new_site = helpers.create_site(db_session, name="North Quarry", location="Zone 1", code="NQ-01")
    assert new_site.id is not None
    assert new_site.name == "North Quarry"
    assert new_site.code == "NQ-01"

    # 2. Staff user creation helper
    staff_user = helpers.create_user(db_session, username="field_worker_1", role=UserRole.STAFF)
    assert staff_user.id is not None

    # 3. Trip log helper
    trip = helpers.create_trip_log(db_session, staff_id=staff_user.id, vehicle_number="KA-01-EQ-5555", site_id=new_site.id)
    assert trip.id is not None
    assert trip.vehicle_number == "KA-01-EQ-5555"

    # 4. Daily ledger helper
    ledger = helpers.create_daily_ledger_entry(db_session, site_id=new_site.id, amount=25000.0, transaction_type="INCOME")
    assert ledger.id is not None
    assert ledger.amount == 25000.0

    # 5. Attendance helper
    att = helpers.create_attendance_entry(db_session, staff_id=staff_user.id, site_id=new_site.id, status=AttendanceType.PRESENT)
    assert att.id is not None
    assert att.status == AttendanceType.PRESENT

    # 6. Leave request helper
    leave = helpers.create_leave_request(db_session, staff_id=staff_user.id, site_id=new_site.id, reason="Vacation")
    assert leave.id is not None
    assert leave.reason == "Vacation"

    # 7. Advance request helper
    adv = helpers.create_advance_request(db_session, staff_id=staff_user.id, site_id=new_site.id, amount=3000.0)
    assert adv.id is not None
    assert adv.amount == 3000.0

    # 8. Vehicle EMI helper
    emi = helpers.create_vehicle_emi(db_session, vehicle_number="KA-01-EQ-5555", emi_amount=12000.0, site_id=new_site.id)
    assert emi.id is not None
    assert emi.emi_amount == 12000.0

    # 9. Staff ledger helper
    staff_ledger = helpers.create_staff_ledger_entry(db_session, staff_id=staff_user.id, amount=15000.0, transaction_type="SALARY")
    assert staff_ledger.id is not None
    assert staff_ledger.amount == 15000.0
