import os
import sqlite3
import pytest
import models
from models.site import Site
from migrate_add_site_id import migrate_database, TARGET_TABLES

def test_site_model_creation(db_session):
    site = Site(
        name="Test Industrial Site",
        location="Industrial Area Zone 3",
        code="IND_ZONE3",
        status="ACTIVE"
    )
    db_session.add(site)
    db_session.commit()
    db_session.refresh(site)

    assert site.id is not None
    assert site.name == "Test Industrial Site"
    assert site.location == "Industrial Area Zone 3"
    assert site.code == "IND_ZONE3"
    assert site.status == "ACTIVE"
    assert site.created_at is not None

def test_foreign_keys_on_models(db_session, seed_sites):
    default_site = seed_sites[0]
    
    # 1. User
    user = models.user.User(
        username="site_fk_user",
        hashed_password="pw",
        role="STAFF",
        site_id=default_site.id
    )
    db_session.add(user)
    db_session.commit()
    assert user.site.name == default_site.name

    # 2. TripLog
    trip = models.trip.TripLog(
        staff_id=user.id,
        site_id=default_site.id,
        vehicle_number="MH12AB1234",
        material_type="Coal",
        weight_tons=15.0,
        start_meter_reading=100.0,
        end_meter_reading=200.0,
        total_km=100.0
    )
    db_session.add(trip)
    db_session.commit()
    assert trip.site.id == default_site.id

    # 3. Attendance
    att = models.workforce.Attendance(
        staff_id=user.id,
        site_id=default_site.id,
        status="PRESENT"
    )
    db_session.add(att)

    # 4. LeaveRequest
    import datetime
    leave = models.workforce.LeaveRequest(
        staff_id=user.id,
        site_id=default_site.id,
        start_date=datetime.date.today(),
        end_date=datetime.date.today(),
        reason="Medical"
    )
    db_session.add(leave)

    # 5. AdvanceWageRequest
    adv = models.workforce.AdvanceWageRequest(
        staff_id=user.id,
        site_id=default_site.id,
        amount=5000.0,
        reason="Emergency"
    )
    db_session.add(adv)

    # 6. VehicleEMI
    emi = models.workforce.VehicleEMI(
        site_id=default_site.id,
        vehicle_number="MH12AB1234",
        emi_amount=15000.0,
        emi_due_date=datetime.date.today()
    )
    db_session.add(emi)

    # 7. StaffLedger
    staff_ledger = models.workforce.StaffLedger(
        staff_id=user.id,
        site_id=default_site.id,
        amount=10000.0,
        transaction_type="SALARY"
    )
    db_session.add(staff_ledger)

    # 8. DailyLedger
    daily_ledger = models.workforce.DailyLedger(
        site_id=default_site.id,
        transaction_type="EXPENSE",
        category="SALARY",
        amount=10000.0
    )
    db_session.add(daily_ledger)

    db_session.commit()

    # 9. FinancialLedger
    fin_ledger = models.workforce.FinancialLedger(
        trip_id=trip.id,
        site_id=default_site.id,
        total_amount_billed=25000.0,
        amount_received=20000.0,
        amount_pending=5000.0
    )
    db_session.add(fin_ledger)
    db_session.commit()

    assert att.site_id == default_site.id
    assert leave.site_id == default_site.id
    assert adv.site_id == default_site.id
    assert emi.site_id == default_site.id
    assert staff_ledger.site_id == default_site.id
    assert daily_ledger.site_id == default_site.id
    assert fin_ledger.site_id == default_site.id

def test_migration_idempotency(tmp_path):
    test_db = os.path.join(tmp_path, "migration_test.db")
    
    # Create tables using Base metadata so sqlite tables exist before migration runs
    from sqlalchemy import create_engine
    from database import Base
    engine = create_engine(f"sqlite:///{test_db}")
    Base.metadata.create_all(bind=engine)
    engine.dispose()
    
    # 1. First migration run
    migrate_database(test_db)
    
    conn = sqlite3.connect(test_db)
    cur = conn.cursor()
    
    # Check default site
    cur.execute("SELECT id, name FROM sites WHERE id=1;")
    site_row = cur.fetchone()
    assert site_row == (1, "Main Site")
    
    # Check site_id column on all target tables
    for table in TARGET_TABLES:
        cur.execute(f"PRAGMA table_info({table});")
        cols = [c[1] for c in cur.fetchall()]
        assert "site_id" in cols, f"site_id missing in table {table}"
        
    conn.close()
    
    # 2. Second run should be idempotent without error
    migrate_database(test_db)

